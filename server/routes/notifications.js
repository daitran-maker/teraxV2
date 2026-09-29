const express = require('express');
const router = express.Router();
const pool = require('../db');
const webpush = require('web-push');

const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

let notificationSchemaReady = null;

async function ensureNotificationSchema() {
    if (!notificationSchemaReady) {
        notificationSchemaReady = pool.query(`
            CREATE TABLE IF NOT EXISTS "notification" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_employee_id VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                body TEXT,
                link VARCHAR(512),
                is_read BOOLEAN DEFAULT FALSE,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE "notification"
              ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(255),
              ADD COLUMN IF NOT EXISTS title VARCHAR(255),
              ADD COLUMN IF NOT EXISTS body TEXT,
              ADD COLUMN IF NOT EXISTS link VARCHAR(512),
              ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS flagged_note TEXT,
              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        `).catch(err => {
            notificationSchemaReady = null;
            throw err;
        });
    }
    return notificationSchemaReady;
}

const PUBLIC_VAPID_KEY = process.env.PUBLIC_VAPID_KEY || 'BB9c2sN9HL17iyM6UtISHRN-NEDR9v490BoaOkzWdOq8GOs08c-hDgMQvc0xORsps2mS9GoHIbyqzgdh7898_PI';
const PRIVATE_VAPID_KEY = process.env.PRIVATE_VAPID_KEY || 'K6kBBA6lRLAF0OD2ItuQtKwh-UIM_U3RPrzThM4fgfU';

webpush.setVapidDetails(
    'mailto:admin@example.com',
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
);

// Gửi Web Push
async function sendPushNotification(userEmail, title, body, url = '/') {
    try {
        const result = await pool.query('SELECT * FROM push_subscriptions WHERE user_employee_id = $1', [userEmail]);
        const subscriptions = result.rows;
        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({ title, body, url });
        const promises = subscriptions.map(async (sub) => {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            try {
                await webpush.sendNotification(pushSub, payload);
            } catch (error) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                } else {
                    console.error('[Web Push] Lỗi gửi:', error);
                }
            }
        });
        await Promise.all(promises);
    } catch (e) {
        console.error('[Web Push] System Error:', e);
    }
}


// GET /api/notifications
// Fetch notifications for the current user (with pagination)
router.get('/', async (req, res) => {
    const userEmail = req.user.employee_id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
        await ensureNotificationSchema();
        // Fetch total count of notifications
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM "notification" WHERE user_employee_id = $1`,
            [userEmail]
        );
        const total = parseInt(countRes.rows[0].count, 10);

        // Fetch paginated results
        const result = await pool.query(
            `SELECT * FROM "notification" 
             WHERE user_employee_id = $1 
             ORDER BY is_read ASC, created_date DESC 
             LIMIT $2 OFFSET $3`,
            [userEmail, limit, offset]
        );

        res.json({
            data: result.rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('[Notification] Error fetching notifications:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
    const userEmail = req.user.employee_id;
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `SELECT COUNT(*) FROM "notification" WHERE user_employee_id = $1 AND is_read = false`,
            [userEmail]
        );
        res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        console.error('[Notification] Error fetching unread count', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/read
// Mark a notification as read
router.put('/:id/read', async (req, res) => {
    const { id } = req.params;
    const userEmail = req.user.employee_id;
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `UPDATE "notification" SET is_read = true WHERE id = $1 AND user_employee_id = $2 RETURNING *`,
            [id, userEmail]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Notification] Error marking notification as read', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
    const userEmail = req.user.employee_id;
    try {
        await ensureNotificationSchema();
        await pool.query(
            `UPDATE "notification" SET is_read = true WHERE user_employee_id = $1 AND is_read = false`,
            [userEmail]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/pin – Toggle ghim/bỏ ghim
router.put('/:id/pin', async (req, res) => {
    const { id } = req.params;
    const userEmail = req.user.employee_id;
    console.log(`[Notification API] Pin request received - ID: ${id}, User: ${userEmail}`);
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `UPDATE "notification"
             SET is_pinned = NOT COALESCE(is_pinned, false)
             WHERE id = $1 AND user_employee_id = $2
             RETURNING *`,
            [id, userEmail]
        );
        if (DEBUG_SQL) console.log(`[Notification API] Pin SQL executed - rows returned: ${result.rows.length}`);
        if (result.rows.length === 0) {
            console.log(`[Notification API] Pin failed - notification not found or not owned by user`);
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Notification API] Error toggling pin', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/flag – Toggle gắn cờ/bỏ cờ (task)
router.put('/:id/flag', async (req, res) => {
    const { id } = req.params;
    const userEmail = req.user.employee_id;
    const { note } = req.body || {};
    console.log(`[Notification API] Flag request received - ID: ${id}, User: ${userEmail}, Note: ${note}`);
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `UPDATE "notification"
             SET is_flagged = NOT COALESCE(is_flagged, false),
                 flagged_note = CASE WHEN NOT COALESCE(is_flagged, false) THEN $3 ELSE NULL END
             WHERE id = $1 AND user_employee_id = $2
             RETURNING *`,
            [id, userEmail, note || null]
        );
        if (DEBUG_SQL) console.log(`[Notification API] Flag SQL executed - rows returned: ${result.rows.length}`);
        if (result.rows.length === 0) {
            console.log(`[Notification API] Flag failed - notification not found or not owned by user`);
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Notification API] Error toggling flag', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/tasks – Lấy danh sách notification đang flagged (Task Pending)
router.get('/tasks', async (req, res) => {
    const userEmail = req.user.employee_id;
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `SELECT * FROM "notification"
             WHERE user_employee_id = $1 AND is_flagged = true AND deleted_at IS NULL
             ORDER BY created_date DESC`,
            [userEmail]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Notification] Error fetching tasks:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/complete-task – Đánh dấu task hoàn thành (bỏ flag)
router.put('/:id/complete-task', async (req, res) => {
    const { id } = req.params;
    const userEmail = req.user.employee_id;
    try {
        await ensureNotificationSchema();
        const result = await pool.query(
            `UPDATE "notification"
             SET is_flagged = false, is_pinned = false, flagged_note = NULL
             WHERE id = $1 AND user_employee_id = $2
             RETURNING *`,
            [id, userEmail]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Notification] Error completing task', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/watches – Lấy danh sách request user đang theo dõi
router.get('/watches', async (req, res) => {
    const userEmail = req.user.employee_id;
    try {
        const result = await pool.query(
            `SELECT * FROM request_watches WHERE user_employee_id = $1 ORDER BY updated_at DESC`,
            [userEmail]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Notification] Error fetching watches', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/watch – Bắt đầu theo dõi request (auto-called when tagged)
router.post('/watch', async (req, res) => {
    const userEmail = req.user.employee_id;
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
    try {
        await pool.query(
            `INSERT INTO request_watches (user_employee_id, request_id, is_watching)
             VALUES ($1, $2, true)
             ON CONFLICT (user_employee_id, request_id)
             DO UPDATE SET is_watching = true, updated_at = CURRENT_TIMESTAMP`,
            [userEmail, requestId]
        );
        res.json({ message: 'Now watching request', requestId });
    } catch (err) {
        console.error('[Notification] Error watching request', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/unwatch – Bỏ theo dõi request
router.put('/unwatch', async (req, res) => {
    const userEmail = req.user.employee_id;
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
    try {
        await pool.query(
            `INSERT INTO request_watches (user_employee_id, request_id, is_watching)
             VALUES ($1, $2, false)
             ON CONFLICT (user_employee_id, request_id)
             DO UPDATE SET is_watching = false, updated_at = CURRENT_TIMESTAMP`,
            [userEmail, requestId]
        );
        res.json({ message: 'Unfollowed request', requestId });
    } catch (err) {
        console.error('[Notification] Error unwatching request', err);
        res.status(500).json({ error: err.message });
    }
});

// Đăng ký Web Push
router.post('/subscribe', async (req, res) => {
    try {
        const userEmail = req.user.employee_id;
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Missing subscription details' });
        }
        await pool.query(
            `INSERT INTO push_subscriptions (user_employee_id, endpoint, p256dh, auth)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (endpoint) DO UPDATE 
             SET user_employee_id = EXCLUDED.user_employee_id,
                 p256dh = EXCLUDED.p256dh,
                 auth = EXCLUDED.auth,
                 created_at = CURRENT_TIMESTAMP`,
            [userEmail, subscription.endpoint, subscription.keys?.p256dh, subscription.keys?.auth]
        );

        res.json({ message: 'Subscribed to push notifications' });
    } catch (err) {
        console.error('[Web Push] Subscribe error', err);
        res.status(500).json({ error: err.message });
    }
});

// Cập nhật subscription khi token thay đổi
router.post('/update-subscription', async (req, res) => {
    try {
        const { oldEndpoint, newSubscription } = req.body;
        if (oldEndpoint) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [oldEndpoint]);
        }
        // Vì đây có thể gọi ngầm mà không có token auth nên chúng ta chỉ xóa cái cũ.
        // User sẽ được map lại ở lần truy cập app sau.
        res.json({ message: 'Subscription updated' });
    } catch (err) {
        console.error('[Web Push] Update error', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    sendPushNotification
};
