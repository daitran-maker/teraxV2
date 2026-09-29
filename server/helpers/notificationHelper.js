const pool = require('../db');
const { broadcastSSE } = require('./sseHelper');
const { sendPushNotification } = require('../routes/notifications');

function flattenArray(arr) {
    if (!Array.isArray(arr)) return [arr];
    return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenArray(val) : val), []);
}

function parseMultiOptionUser(u) {
    if (typeof u !== 'string') return [u];
    const trimmed = u.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map(x => String(x).trim());
        } catch(e) {}
    }
    // Also parse bracket format like [val1],[val2]
    if (trimmed.includes('],[') || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed.replace(/[\[\]]/g, '').split(',').map(x => x.trim()).filter(Boolean);
    }
    if (trimmed.includes(',')) {
        return trimmed.split(',').map(x => x.trim()).filter(Boolean);
    }
    if (trimmed.includes(';')) {
        return trimmed.split(';').map(x => x.trim()).filter(Boolean);
    }
    return [trimmed];
}

async function initNotificationTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "notification" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_employee_id VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                body TEXT,
                link VARCHAR(512),
                is_read BOOLEAN DEFAULT FALSE,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            ALTER TABLE "notification"
              ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(255),
              ADD COLUMN IF NOT EXISTS title VARCHAR(255),
              ADD COLUMN IF NOT EXISTS body TEXT,
              ADD COLUMN IF NOT EXISTS link VARCHAR(512),
              ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS flagged_note TEXT;
        `);
        console.log('[Notification] Table initialized');
    } catch (e) {
        console.error('[Notification] Error initializing table', e);
    }
}

async function resolveToEmployeeId(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const cleanId = identifier.trim();
    if (cleanId.toUpperCase().startsWith('EMP-')) {
        return cleanId; // Already employee_id
    }
    try {
        const res = await pool.query(
            `SELECT employee_id FROM employee WHERE email = $1 OR username = $1 OR employee_id = $1 LIMIT 1`,
            [cleanId]
        );
        if (res.rows.length > 0) {
            return res.rows[0].employee_id;
        }
    } catch (e) {
        console.error('[Notification Helper] Error resolving user ID for:', cleanId, e);
    }
    return cleanId; // Fallback to original
}

async function createNotification(users, title, body, link, context = null) {
    if (!users || users.length === 0) return;
    
    let expandedUsers = [];
    const flatUsers = flattenArray(users);
    for (const u of flatUsers) {
        if (typeof u === 'string') {
            expandedUsers.push(...parseMultiOptionUser(u));
        } else if (u) {
            expandedUsers.push(u);
        }
    }
    
    const resolvedUsers = [];
    for (const u of expandedUsers) {
        if (typeof u === 'string' && u.trim() !== '') {
            const empId = await resolveToEmployeeId(u);
            if (empId) resolvedUsers.push(empId);
        }
    }

    const uniqueUsers = [...new Set(resolvedUsers)];
    if (uniqueUsers.length === 0) return;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const user_employee_id of uniqueUsers) {
                const res = await client.query(
                    `INSERT INTO "notification" (user_employee_id, title, body, link) VALUES ($1, $2, $3, $4) RETURNING *`,
                    [user_employee_id, title, body, link]
                );
                broadcastSSE('new_notification', res.rows[0]);
                
                // Web Push Notification
                const plainBody = (body || '').replace(/<[^>]*>?/gm, '');
                sendPushNotification(user_employee_id, title, plainBody, link).catch(err => console.error(err));
            }
            
            // Append log to parent record if context is provided
            if (context && context.tableName && context.id && context.pk) {
                try {
                    const logEntry = JSON.stringify([{
                        sent_at: new Date().toISOString(),
                        recipients: uniqueUsers,
                        title,
                        body
                    }]);
                    await client.query(
                        `UPDATE "${context.tableName}" 
                         SET notification_logs = COALESCE(notification_logs, '[]'::jsonb) || $1::jsonb
                         WHERE "${context.pk}" = $2`,
                        [logEntry, context.id]
                    );
                } catch(e) {
                    console.error('[Notification] Failed to update notification_logs in parent record:', e.message);
                }
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('[Notification] Error creating notification', e);
    }
}

async function triggerNotifications(tableName, oldRecord, newRecord) {
    try {
        if (tableName === 'payment') {
            const oldStatus = oldRecord ? oldRecord.payment_status : null;
            const newStatus = newRecord.payment_status;
            
            if (oldStatus !== newStatus && Number(newStatus) === 32) { // 32 = Paid
                // Fetch related request
                const reqRes = await pool.query(`SELECT requester, sr_creater, sr_owner, policy_lead FROM "request" WHERE request_id = $1`, [newRecord.request]);
                if (reqRes.rows.length > 0) {
                    const req = reqRes.rows[0];
                    const users = [req.requester, req.sr_creater, req.sr_owner, req.policy_lead];
                    const title = `💵 Payment Paid`;
                    const body = `${newRecord.payment_type} ${newRecord.value} ${newRecord.currency} | ${newRecord.payment_description}`;
                    const link = `payment/${newRecord.payment_id}`;
                    await createNotification(users, title, body, link, { tableName: 'payment', id: newRecord.payment_id, pk: 'payment_id' });
                }
            }
        }
        
        if (tableName === 'request') {
            const usersBase = [newRecord.requester, newRecord.sr_creater, newRecord.sr_owner, newRecord.policy_lead];
            const baseLink = `my_request/${newRecord.request_id}`;
            const context = { tableName: 'request', id: newRecord.request_id, pk: 'request_id' };
            const notifyTier = async (oldStatus, newStatus, approverId, tierName) => {
                if (oldStatus !== newStatus && Number(newRecord.sr_status) !== 1 && approverId) {
                    if (Number(newStatus) === 2) { // 2 = Pending Approval
                        const title = `✍️ Action Required: Pending Approval`;
                        const body = `Please review: ${newRecord.request_type || 'Request'} | ${newRecord.description || ''}`;
                        const approvalLink = `my_approval/${newRecord.request_id}`;
                        await createNotification([approverId], title, body, approvalLink, context);
                    }
                }
            };

            let flow = null;
            if (newRecord.approval_flow && typeof newRecord.approval_flow === 'string') {
              try { flow = JSON.parse(newRecord.approval_flow); } catch(e) {}
            } else {
              flow = newRecord.approval_flow;
            }
            if (flow && flow.steps) {
               for (let i = 0; i < flow.steps.length; i++) {
                 const step = flow.steps[i];
                 let oldFlow = oldRecord ? oldRecord.approval_flow : null;
                 if (oldFlow && typeof oldFlow === 'string') {
                   try { oldFlow = JSON.parse(oldFlow); } catch(e) {}
                 }
                 const oldStep = (oldFlow && oldFlow.steps) ? oldFlow.steps[i] : null;
                 await notifyTier(oldStep ? oldStep.status : null, step.status, step.approver, 'Tier ' + (i+1));
               }
            }

            // Final Approval Status
            const getEnrichedApprovalStatus = (rec) => {
                if (!rec) return null;
                const status = Number(rec.sr_status);
                if (status === 1) return 'Draft';
                if (status === 2) return 'Pending Approval';
                if (status === 3) return 'Approved';
                if (status === 4) return 'Rejected';
                if (status === 5) return 'Closed';
                if (status === 6) return 'Cancelled';
                return null;
            };
            const oldAppStatus = getEnrichedApprovalStatus(oldRecord);
            const newAppStatus = getEnrichedApprovalStatus(newRecord);
            if (oldRecord && oldAppStatus !== newAppStatus && Number(newRecord.sr_status) !== 1) {
                const title = `📄 Request ${newAppStatus}`;
                const body = `${newRecord.request_type || 'Request'} | ${newRecord.description || ''}`;
                await createNotification(usersBase, title, body, baseLink, context);
            }
            // Process Status Processing (8 = Processing)
            if (oldRecord && Number(oldRecord.process_status) !== Number(newRecord.process_status) && (newRecord.request_type === '5' || newRecord.request_type === 'RPM') && Number(newRecord.process_status) === 8) {
                const title = `💳 Action Required | Process Payment`;
                const body = `Dear Money Account Owner. Please make money transaction for : ${newRecord.description}. Request ID: ${newRecord.request_id}`;
                await createNotification(usersBase, title, body, baseLink, context);
            }

            // Process Status Completed (9 = Completed) (Rating trigger)
            if (oldRecord && Number(oldRecord.process_status) !== Number(newRecord.process_status) && Number(newRecord.process_status) === 9 && newRecord.sr_owner) {
                const title = `⭐ Request Completed - Rating Required`;
                const body = `Please rate the completed request: ${newRecord.request_type || 'Request'} | ${newRecord.description || ''}`;
                await createNotification([newRecord.sr_owner], title, body, baseLink, context);
            }
        }
        
        if (tableName === 'comment') {
            let tags = [];
            if (newRecord.tag) {
                tags = newRecord.tag.split(',').map(t => t.trim()).filter(Boolean);
            }

                        let owners = [];
            let link = '';
            let moduleName = 'Request';
            let parentDesc = '';
            let parentContext = { tableName: 'comment', id: newRecord.comment_id, pk: 'comment_id' };

            if (newRecord.request) {
                const reqRes = await pool.query(`
                    SELECT r.requester, r.sr_creater, r.sr_owner, p.policy_name AS request_type, r.description 
                    FROM "request" r 
                    LEFT JOIN "policy_and_program" p ON r.request_type = p.policy_id::text
                    WHERE r.request_id = $1
                `, [newRecord.request]);
                if (reqRes.rows.length > 0) {
                    owners.push(reqRes.rows[0].requester, reqRes.rows[0].sr_creater, reqRes.rows[0].sr_owner);
                    parentDesc = `(${reqRes.rows[0].request_type || 'SR'} | ${reqRes.rows[0].description || 'No description'})`;
                }
                link = `request/${newRecord.request}`;
                moduleName = 'Request';
                parentContext = { tableName: 'request', id: newRecord.request, pk: 'request_id' };

            } else if (newRecord.contract) {
                const reqRes = await pool.query(`SELECT created_by, contract_type, description FROM "contract" WHERE contract_id = $1`, [newRecord.contract]);
                if (reqRes.rows.length > 0) {
                    owners.push(reqRes.rows[0].created_by);
                    parentDesc = `(${reqRes.rows[0].contract_type || 'Contract'} | ${reqRes.rows[0].description || 'No description'})`;
                }
                link = `contract/${newRecord.contract}`;
                moduleName = 'Contract';
                parentContext = { tableName: 'contract', id: newRecord.contract, pk: 'contract_id' };
            } else if (newRecord.payment) {
                const reqRes = await pool.query(`SELECT created_by, payment_type, description FROM "payment" WHERE payment_id = $1`, [newRecord.payment]);
                if (reqRes.rows.length > 0) {
                    owners.push(reqRes.rows[0].created_by);
                    parentDesc = `(${reqRes.rows[0].payment_type || 'Payment'} | ${reqRes.rows[0].description || 'No description'})`;
                }
                link = `payment/${newRecord.payment}`;
                moduleName = 'Payment';
                parentContext = { tableName: 'payment', id: newRecord.payment, pk: 'payment_id' };
            } else if (newRecord.invoice) {
                const reqRes = await pool.query(`SELECT created_by, invoice_type, description FROM "invoice" WHERE invoice_id = $1`, [newRecord.invoice]);
                if (reqRes.rows.length > 0) {
                    owners.push(reqRes.rows[0].created_by);
                    parentDesc = `(${reqRes.rows[0].invoice_type || 'Invoice'} | ${reqRes.rows[0].description || 'No description'})`;
                }
                link = `invoice/${newRecord.invoice}`;
                moduleName = 'Invoice';
                parentContext = { tableName: 'invoice', id: newRecord.invoice, pk: 'invoice_id' };
            } else if (newRecord.asset) {
                const reqRes = await pool.query(`SELECT created_by, asset_type, description FROM "asset" WHERE asset_id = $1`, [newRecord.asset]);
                if (reqRes.rows.length > 0) {
                    owners.push(reqRes.rows[0].created_by);
                    parentDesc = `(${reqRes.rows[0].asset_type || 'Asset'} | ${reqRes.rows[0].description || 'No description'})`;
                }
                link = `asset/${newRecord.asset}`;
                moduleName = 'Asset';
                parentContext = { tableName: 'asset', id: newRecord.asset, pk: 'asset_id' };
            }

            // Get Full Name of comment author
            let authorName = newRecord.comment_by || 'User';
            if (newRecord.comment_by) {
                try {
                    const empRes = await pool.query(`SELECT full_name as fname FROM employee WHERE employee_id = $1`, [newRecord.comment_by]);
                    if (empRes.rows.length > 0 && empRes.rows[0].fname) authorName = empRes.rows[0].fname;
                } catch(e) {}
            }

            const flatOwners = flattenArray(owners);
            const flatTags = flattenArray(tags);
            const allUsers = [...new Set([...flatTags, ...flatOwners])]
                .filter(u => typeof u === 'string' && u.trim() !== '')
                .filter(u => u.toLowerCase() !== (newRecord.comment_by || '').toLowerCase());
            
            for (const u of allUsers) {
                let title = `🏷️ Mentioned you in a comment`;
                if (!flatTags.includes(u)) {
                    title = `💬 New comment on your ${moduleName}`;
                }
                
                let body = '';
                if (parentDesc) body += `<span style="color:rgba(255,255,255,0.85); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">${parentDesc}</span><br>`;
                body += `<strong>${authorName}</strong> comment: ${newRecord.comment}`;
                
                const context = parentContext;
                await createNotification([u], title, body, link, context);
            }
        }
    } catch (e) {
        console.error('[Notification Trigger] Error:', e);
    }
}

module.exports = {
    initNotificationTable,
    createNotification,
    triggerNotifications
};
