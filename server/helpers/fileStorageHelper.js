const pool = require('../db');
const { Pool } = require('pg');

const FILE_STORAGE_URL = process.env.FILE_STORAGE_URL || 'http://127.0.0.1:5005';
const HELPDESK_TABLES = ['ticket', 'ticket_comment', 'ticket_type'];

let _helpdeskPool = null;
function getHelpdeskPool() {
  if (_helpdeskPool) return _helpdeskPool;
  const mainDbUrl = process.env.DATABASE_URL || '';
  let helpdeskDbUrl;
  try {
    const parsed = new URL(mainDbUrl);
    parsed.pathname = '/crc_helpdesk_db';
    helpdeskDbUrl = parsed.toString();
  } catch (e) {
    helpdeskDbUrl = mainDbUrl.substring(0, mainDbUrl.lastIndexOf('/')) + '/crc_helpdesk_db';
  }
  _helpdeskPool = new Pool({ connectionString: helpdeskDbUrl, max: 10 });
  return _helpdeskPool;
}

function getPoolForTable(tableName) {
  return HELPDESK_TABLES.includes(tableName) ? getHelpdeskPool() : pool;
}

function getPrimaryKey(tableName) {
  if (tableName === 'employee' || tableName === 'employee_active') return 'employee_id';
  if (tableName === 'policy_and_program') return 'policy_id';
  if (tableName === 'ticket_type') return 'ticket_type_id';
  if (tableName === 'comment' || tableName === 'ticket_comment') return 'comment_id';
  if (tableName === 'column_permissions') return 'id';
  if (['action_rules', 'exception_rules', 'customize', 'my_product_and_service', 'notification', 'cms_tenant_info'].includes(tableName)) return 'id';
  if (tableName === 'asset') return 'office_asset_id';
  if (tableName === 'mtr') return 'transaction_id';
  return `${tableName}_id`; 
}

const schemaCache = {};
async function getTableColumns(tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];
  try {
    const p = getPoolForTable(tableName);
    const res = await p.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [tableName]
    );
    const cols = res.rows.map(r => r.column_name);
    schemaCache[tableName] = cols;
    return cols;
  } catch (err) {
    return [];
  }
}

/**
 * Checks if the current user request has read access to a specific table record.
 */
async function checkRecordAccess(tableName, recordId, req) {
  const user = req.user || {};
  const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
  const isAdmin = user.role && (
    user.role.toUpperCase() === 'SUPER ADMIN' ||
    user.role.toUpperCase() === 'HR' ||
    user.role.toUpperCase() === 'ADMINISTRATOR' ||
    user.role.toUpperCase() === 'ADMIN'
  );

  const pk = getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  const hasIdCol = dbCols.includes('id');

  // Query the record
  let query = `SELECT * FROM "${tableName}" WHERE (${pk}::text = $1`;
  if (hasIdCol && pk !== 'id') {
    query += ` OR id::text = $1`;
  }
  if (tableName === 'action_rules') {
    query += ` OR action_id = $1`;
  }
  query += `)`;
  if (dbCols.includes('deleted_at') && !isSuperAdmin) {
    query += ` AND deleted_at IS NULL`;
  }
  
  const result = await getPoolForTable(tableName).query(query, [recordId]);
  if (result.rows.length === 0) {
    return false; // Record not found
  }
  const record = result.rows[0];

  // === SUBDOMAIN ISOLATION FOR MULTI-TENANCY ===
  const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
  const isHelpdeskHost = requestHost === 'support.terax.ai';
  if (!isHelpdeskHost && requestHost && requestHost !== 'localhost' && requestHost !== '127.0.0.1') {
    let recordSubdomain = null;
    if (tableName === 'cms_tenant_info') {
      recordSubdomain = record.tenant_domain;
    } else if (tableName === 'ticket' || tableName === 'request') {
      recordSubdomain = record.subdomain;
    } else {
      const ticketId = record.ticket || record.request;
      if (ticketId) {
        const tRes = await getHelpdeskPool().query('SELECT subdomain FROM "ticket" WHERE ticket_id = $1', [ticketId]);
        if (tRes.rows.length > 0) {
          recordSubdomain = tRes.rows[0].subdomain;
        }
      }
    }
    if (recordSubdomain && recordSubdomain.toLowerCase() !== requestHost) {
      return false; // Access denied
    }
  }

  // === ROW-LEVEL SECURITY for request and child records ===
  const tablesWithRequestCol = ['mtr', 'payment', 'comment', 'service', 'contract', 'asset', 'invoice'];
  if (tableName === 'request' || tablesWithRequestCol.includes(tableName)) {
    if (!isAdmin && user.employee_id) {
      const userEmpId = user.employee_id;
      let targetRequest = null;
      
      if (tableName === 'request') {
        targetRequest = record;
      } else if (record.request) {
        const reqRes = await pool.query('SELECT * FROM "request" WHERE request_id = $1', [record.request]);
        if (reqRes.rows.length > 0) {
          targetRequest = reqRes.rows[0];
        }
      }
      
      if (targetRequest) {
        const requester = targetRequest.requester || '';
        const creator = targetRequest.sr_creater || '';
        const srOwnerArr = Array.isArray(targetRequest.sr_owner)
          ? targetRequest.sr_owner
          : (targetRequest.sr_owner ? [targetRequest.sr_owner] : []);
        const policyLead = targetRequest.policy_lead || '';
                  let isInApprovalFlow = false;
          if (targetRequest.approval_flow && Array.isArray(targetRequest.approval_flow.steps)) {
            isInApprovalFlow = targetRequest.approval_flow.steps.some(step => 
              step.approver && step.approver === userEmpId
            );
          }
          let isTaggedInComment = false;
          if (targetRequest.request_id) {
            try {
              const tagRes = await pool.query(
                `SELECT 1 FROM comment WHERE request::text = $1::text AND LOWER(tag) LIKE LOWER($2) LIMIT 1`,
                [targetRequest.request_id, `%${userEmpId}%`]
              );
              if (tagRes.rows.length > 0) isTaggedInComment = true;
            } catch (err) {
              console.error('Error checking comment tags:', err);
            }
          }

          const isDirectlyInvolved = (
            userEmpId === requester || userEmpId === creator ||
            srOwnerArr.includes(userEmpId) || userEmpId === policyLead ||
            isInApprovalFlow || isTaggedInComment
          );
        
        let isManager = false;
        if (!isDirectlyInvolved && srOwnerArr.length > 0) {
          try {
            const mgrRes = await pool.query(
              `SELECT 1 FROM "employee" 
               WHERE employee_id = ANY($1) AND (
                 LOWER(direct_manager) = (SELECT LOWER(email) FROM "employee" WHERE employee_id = $2) OR
                 direct_manager = $2
               ) LIMIT 1`,
              [srOwnerArr, userEmpId]
            );
            isManager = mgrRes.rows.length > 0;
          } catch (mgrErr) { /* ignore */ }
        }
        
        let isTagged = false;
        if (!isDirectlyInvolved && !isManager) {
          try {
            let userEmail = '';
            try {
              const empEmailRes = await pool.query(`SELECT email FROM employee WHERE employee_id = $1 LIMIT 1`, [userEmpId]);
              if (empEmailRes.rows.length > 0) userEmail = empEmailRes.rows[0].email || '';
            } catch (e) { /* ignore */ }

            const tagRes = await pool.query(
              `SELECT 1 FROM "comment" 
               WHERE request = $1 AND deleted_at IS NULL AND (
                 tag = $2 OR tag LIKE $3 OR tag LIKE $4 OR tag LIKE $5
                 ${userEmail ? `OR tag = $6 OR tag LIKE $7 OR tag LIKE $8 OR tag LIKE $9` : ''}
               ) LIMIT 1`,
              userEmail
                ? [targetRequest.request_id, userEmpId, `%,${userEmpId}`, `${userEmpId},%`, `%,${userEmpId},%`, userEmail, `%,${userEmail}`, `${userEmail},%`, `%,${userEmail},%`]
                : [targetRequest.request_id, userEmpId, `%,${userEmpId}`, `${userEmpId},%`, `%,${userEmpId},%`]
            );
            isTagged = tagRes.rows.length > 0;
          } catch (tagErr) { /* ignore */ }
        }
        
        if (!isDirectlyInvolved && !isManager && !isTagged) {
          return false;
        }
      } else if (tablesWithRequestCol.includes(tableName) && record.request) {
        return false;
      }
    }
  }

  return true;
}


/**
 * Uploads a base64 encoded file to the sidecar container and registers it in uploaded_files
 */
async function uploadBase64File(base64Str, tableName, recordId, columnName, uploadedBy, dbPool = pool) {
  const matches = base64Str.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 payload format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  const mimeToExt = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt'
  };

  const ext = mimeToExt[mimeType] || 'bin';
  const filename = `${tableName}_${columnName}_${recordId}.${ext}`;

  // Build FormData payload
  const formData = new global.FormData();
  const blob = new global.Blob([buffer], { type: mimeType });
  formData.append('file', blob, filename);

  console.log(`[FileStorage] Uploading file to sidecar service: ${filename} (${buffer.length} bytes)...`);
  const response = await fetch(`${FILE_STORAGE_URL}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file to sidecar: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const fileId = result.id;
  const filePath = result.filePath;

  // Insert metadata into the uploaded_files database table
  const insertQuery = `
    INSERT INTO "uploaded_files" (id, table_name, record_id, column_name, file_name, mime_type, file_path, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  await dbPool.query(insertQuery, [
    fileId,
    tableName,
    recordId,
    columnName,
    filename,
    mimeType,
    filePath,
    uploadedBy
  ]);

  console.log(`[FileStorage] Uploaded successfully. ID: ${fileId}`);
  return `/api/files/download/${fileId}/${encodeURIComponent(filename)}`;
}

/**
 * Handles proxying the download requests securely
 */
async function handleFileDownload(req, res) {
  const { id } = req.params;

  try {
    // 1. Fetch file meta from uploaded_files
    const metaRes = await pool.query('SELECT * FROM "uploaded_files" WHERE id = $1', [id]);
    if (metaRes.rows.length === 0) {
      return res.status(404).json({ error: 'File metadata not found' });
    }
    const fileMeta = metaRes.rows[0];

    // 2. Perform security authorization check
    const hasAccess = await checkRecordAccess(fileMeta.table_name, fileMeta.record_id, req);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this file.' });
    }

    // 3. Fetch from sidecar storage and stream to response
    const sidecarUrl = `${FILE_STORAGE_URL}/files/${encodeURIComponent(fileMeta.file_path)}`;
    const downloadRes = await fetch(sidecarUrl);

    if (!downloadRes.ok) {
      return res.status(downloadRes.status).json({ error: 'Failed to retrieve file from sidecar storage' });
    }

    res.setHeader('Content-Type', fileMeta.mime_type || downloadRes.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileMeta.file_name)}"`);

    // Stream the body
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);

  } catch (err) {
    console.error('[FileStorage] Download Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  uploadBase64File,
  handleFileDownload,
  checkRecordAccess
};
