const pool = require('../../../server/db');

class NotificationRepository {
  async ensureSchema() {
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

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_employee_id VARCHAR(255) NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS request_watches (
        id SERIAL PRIMARY KEY,
        user_employee_id VARCHAR(255) NOT NULL,
        request_id VARCHAR(255) NOT NULL,
        is_watching BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_employee_id, request_id)
      );
    `);
  }

  async getByUser(userId, limit = 50, offset = 0, filter = null) {
    let sql = `
      SELECT * FROM "notification"
      WHERE user_employee_id = $1 AND deleted_at IS NULL
    `;
    const params = [userId];

    if (filter === 'unread') {
      sql += ' AND is_read = false';
    } else if (filter === 'pinned') {
      sql += ' AND is_pinned = true';
    } else if (filter === 'flagged') {
      sql += ' AND is_flagged = true';
    }

    sql += ' ORDER BY is_pinned DESC, created_date DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);

    const res = await pool.query(sql, params);
    return res.rows;
  }

  async getTotalCount(userId, filter = null) {
    let sql = `
      SELECT COUNT(*) as total FROM "notification"
      WHERE user_employee_id = $1 AND deleted_at IS NULL
    `;
    const params = [userId];

    if (filter === 'unread') {
      sql += ' AND is_read = false';
    } else if (filter === 'pinned') {
      sql += ' AND is_pinned = true';
    } else if (filter === 'flagged') {
      sql += ' AND is_flagged = true';
    }

    const res = await pool.query(sql, params);
    return parseInt(res.rows[0]?.total || '0', 10);
  }

  async getUnreadCount(userId) {
    const res = await pool.query(
      `SELECT COUNT(*) as unread_count FROM "notification" WHERE user_employee_id = $1 AND is_read = false AND deleted_at IS NULL`,
      [userId]
    );
    return parseInt(res.rows[0]?.unread_count || '0', 10);
  }

  async markAsRead(id, userId) {
    const res = await pool.query(
      `UPDATE "notification" SET is_read = true WHERE id = $1 AND user_employee_id = $2 RETURNING *`,
      [id, userId]
    );
    return res.rows[0];
  }

  async markAllAsRead(userId) {
    const res = await pool.query(
      `UPDATE "notification" SET is_read = true WHERE user_employee_id = $1 AND is_read = false AND deleted_at IS NULL RETURNING id`,
      [userId]
    );
    return res.rows.length;
  }

  async togglePin(id, userId) {
    const res = await pool.query(
      `UPDATE "notification" SET is_pinned = NOT COALESCE(is_pinned, false) WHERE id = $1 AND user_employee_id = $2 RETURNING *`,
      [id, userId]
    );
    return res.rows[0];
  }

  async toggleFlag(id, userId, note = '') {
    const res = await pool.query(
      `UPDATE "notification" SET is_flagged = NOT COALESCE(is_flagged, false), flagged_note = $3 WHERE id = $1 AND user_employee_id = $2 RETURNING *`,
      [id, userId, note]
    );
    return res.rows[0];
  }

  async getTasks(userId) {
    const res = await pool.query(
      `SELECT * FROM "notification"
       WHERE user_employee_id = $1 AND is_flagged = true AND deleted_at IS NULL
       ORDER BY created_date DESC`,
      [userId]
    );
    return res.rows;
  }

  async completeTask(id, userId) {
    const res = await pool.query(
      `UPDATE "notification"
       SET is_flagged = false, is_pinned = false, flagged_note = NULL
       WHERE id = $1 AND user_employee_id = $2
       RETURNING *`,
      [id, userId]
    );
    return res.rows[0];
  }

  async getWatches(userId) {
    const res = await pool.query(
      `SELECT * FROM request_watches WHERE user_employee_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows;
  }

  async watchRequest(userId, requestId) {
    const res = await pool.query(
      `INSERT INTO request_watches (user_employee_id, request_id, is_watching)
       VALUES ($1, $2, true)
       ON CONFLICT (user_employee_id, request_id)
       DO UPDATE SET is_watching = true, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, requestId]
    );
    return res.rows[0];
  }

  async unwatchRequest(userId, requestId) {
    const res = await pool.query(
      `INSERT INTO request_watches (user_employee_id, request_id, is_watching)
       VALUES ($1, $2, false)
       ON CONFLICT (user_employee_id, request_id)
       DO UPDATE SET is_watching = false, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, requestId]
    );
    return res.rows[0];
  }

  async softDelete(id, userId) {
    const res = await pool.query(
      `UPDATE "notification" SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_employee_id = $2 RETURNING id`,
      [id, userId]
    );
    return res.rows.length > 0;
  }

  async create(userId, title, body, link) {
    const res = await pool.query(
      `INSERT INTO "notification" (user_employee_id, title, body, link, is_read, created_date)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, title, body, link]
    );
    return res.rows[0];
  }

  async getPushSubscriptions(userId) {
    const res = await pool.query(
      `SELECT * FROM push_subscriptions WHERE user_employee_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async savePushSubscription(userId, subscription) {
    const { endpoint, keys } = subscription;
    const res = await pool.query(
      `INSERT INTO push_subscriptions (user_employee_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_employee_id = EXCLUDED.user_employee_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    return res.rows[0];
  }

  async removePushSubscription(endpoint) {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  }
}

module.exports = new NotificationRepository();
