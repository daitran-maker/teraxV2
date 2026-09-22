const express = require('express');
const router = express.Router();
const pool = require('../db');
const { Pool } = require('pg');
const crypto = require('crypto');
const { broadcastSSE } = require('../helpers/sseHelper');

const HELPDESK_SECRET = process.env.HELPDESK_SECRET || process.env.CMS_HMAC_SECRET;
const IS_HELPDESK = process.env.IS_HELPDESK === 'true';
const HELPDESK_URL = process.env.HELPDESK_URL || 'https://support.terax.ai';

// Middleware to verify HMAC signatures
function verifyHmacSignature(req, res, next) {
  const signature = req.headers['x-support-signature'];
  const timestamp = req.headers['x-support-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Reject if timestamp is older than 5 minutes to prevent replay attacks
  const diff = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp));
  if (isNaN(diff) || diff > 300) {
    return res.status(401).json({ error: 'Timestamp expired or invalid' });
  }

  const strPayload = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', HELPDESK_SECRET).update(strPayload).digest('hex');

  try {
    const isMatched = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
    if (!isMatched) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }
  next();
}

// Helper to sign payload and send HTTP POST
async function sendSignedRequest(url, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const strPayload = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', HELPDESK_SECRET).update(strPayload).digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-support-signature': signature,
        'x-support-timestamp': timestamp
      },
      body: strPayload
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[SupportSync] Sync request to ${url} failed with status ${res.status}:`, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[SupportSync] Error sending sync request to ${url}:`, err.message);
    return false;
  }
}

function getTenantUrl(subdomain) {
  if (!subdomain) return null;
  if (subdomain.startsWith('http://') || subdomain.startsWith('https://')) {
    return subdomain;
  }
  return `http://${subdomain}`;
}

// Both crc_app and helpdesk_app now read/write ticket & ticket_comment
// directly from crc_helpdesk_db via getPoolForTable() in dynamic_crud.js.
// These sync functions are kept as no-ops for backward compatibility.
async function syncTicketToHelpdesk(ticket) {
  // No-op: crc_app writes directly to crc_helpdesk_db via helpdeskPool
}

async function syncCommentToHelpdesk(comment) {
  // No-op: crc_app writes directly to crc_helpdesk_db via helpdeskPool
}

async function syncCommentToTenant(comment, subdomain) {
  if (!IS_HELPDESK || !subdomain) return;
  const tenantBase = getTenantUrl(subdomain);
  if (!tenantBase) return;
  console.log(`[SupportSync] Syncing comment ${comment.comment_id} to tenant ${subdomain}...`);
  const targetUrl = `${tenantBase}/api/support/sync-comment`;
  await sendSignedRequest(targetUrl, {
    ...comment,
    ticket: comment.ticket || comment.request,
    request: comment.ticket || comment.request
  });
}

async function syncStatusToTenant(requestId, srStatus, processStatus, subdomain) {
  if (!IS_HELPDESK || !subdomain) return;
  const tenantBase = getTenantUrl(subdomain);
  if (!tenantBase) return;
  console.log(`[SupportSync] Syncing status of ticket ${requestId} to tenant ${subdomain}...`);
  const targetUrl = `${tenantBase}/api/support/sync-ticket-status`;
  await sendSignedRequest(targetUrl, {
    ticket_id: requestId,
    sr_status: srStatus,
    process_status: processStatus
  });
}

async function syncRatingToHelpdesk(requestId, rating) {
  if (IS_HELPDESK || !HELPDESK_URL) return;
  console.log(`[SupportSync] Syncing rating of ticket ${requestId} to Helpdesk...`);
  const targetUrl = `${HELPDESK_URL}/api/support/sync-ticket-rating`;
  await sendSignedRequest(targetUrl, {
    ticket_id: requestId,
    rating: rating
  });
}

// ─── EXPRESS ROUTE HANDLERS (HMAC PROTECTED) ────────────────────────────────

// 1. Sync Ticket (Tenant -> Helpdesk)
router.post('/sync-ticket', verifyHmacSignature, async (req, res) => {
  const {
    ticket_id,
    ticket_type,
    requester,
    sr_creater,
    description,
    sr_status,
    process_status,
    subdomain,
    rating,
    created_date,
    updated_date
  } = req.body;

  try {
    // If helpdesk receives ticket, automatically resolve policy lead / owner coordinator from database
    let policyLead = null;
    let srOwner = null;
    
    if (IS_HELPDESK) {
      const policyRes = await pool.query(
        'SELECT ticket_lead as policy_lead, COALESCE(sr_coordinator, coordinator) as sr_owner FROM ticket_type WHERE ticket_type_id::text = $1 OR ticket_name = $1',
        [ticket_type]
      );
      if (policyRes.rows.length > 0) {
        policyLead = policyRes.rows[0].policy_lead;
        srOwner = policyRes.rows[0].sr_owner;
      }
    }

    await pool.query(`
      INSERT INTO ticket (
        ticket_id, ticket_type, requester, sr_creater, description, 
        sr_status, process_status, subdomain, rating, 
        policy_lead, sr_owner, created_date, updated_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, CURRENT_TIMESTAMP), COALESCE($13, CURRENT_TIMESTAMP))
      ON CONFLICT (ticket_id) DO UPDATE SET
        ticket_type = EXCLUDED.ticket_type,
        requester = EXCLUDED.requester,
        sr_creater = EXCLUDED.sr_creater,
        description = EXCLUDED.description,
        sr_status = EXCLUDED.sr_status,
        process_status = EXCLUDED.process_status,
        subdomain = EXCLUDED.subdomain,
        rating = EXCLUDED.rating,
        updated_date = CURRENT_TIMESTAMP
    `, [
      ticket_id,
      ticket_type,
      requester,
      sr_creater || requester,
      description,
      sr_status,
      process_status,
      subdomain,
      rating ? JSON.stringify(rating) : null,
      policyLead,
      srOwner,
      created_date,
      updated_date
    ]);

    broadcastSSE({ type: 'update', table: 'ticket', id: ticket_id });
    res.json({ success: true, message: 'Ticket sync completed successfully' });
  } catch (err) {
    console.error('[SupportSync] Failed to sync ticket:', err.message);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// 2. Sync Comment (Bi-directional)
router.post('/sync-comment', verifyHmacSignature, async (req, res) => {
  const {
    comment_id,
    request,
    ticket,
    comment,
    file,
    link,
    comment_by,
    comment_date,
    reply_to,
    tag,
    created_by,
    created_date,
    updated_by,
    updated_date
  } = req.body;

  try {
    // If tenant side receives comment from helpdesk, rewrite commenter info to "Admin" for privacy
    const finalCommentBy = IS_HELPDESK ? comment_by : 'Admin';
    const finalCreatedBy = IS_HELPDESK ? (created_by || comment_by) : 'Admin';

    const targetTable = IS_HELPDESK ? 'comment' : 'ticket_comment';
    const targetCol = IS_HELPDESK ? 'request' : 'ticket';
    const targetParentId = ticket || request;

    await pool.query(`
      INSERT INTO ${targetTable} (
        comment_id, ${targetCol}, comment, file, link, comment_by, comment_date, 
        reply_to, tag
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP), $8, $9)
      ON CONFLICT (comment_id) DO UPDATE SET
        comment = EXCLUDED.comment,
        file = EXCLUDED.file,
        link = EXCLUDED.link
    `, [
      comment_id,
      targetParentId,
      comment,
      file,
      link,
      finalCommentBy,
      comment_date,
      reply_to,
      tag
    ]);

    broadcastSSE({ type: 'update', table: targetTable, id: comment_id, request_id: targetParentId });
    res.json({ success: true, message: 'Comment sync completed successfully' });
  } catch (err) {
    console.error('[SupportSync] Failed to sync comment:', err.message);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// 3. Sync Status (Helpdesk -> Tenant)
router.post('/sync-ticket-status', verifyHmacSignature, async (req, res) => {
  const { ticket_id, sr_status, process_status } = req.body;

  try {
    await pool.query(`
      UPDATE ticket
      SET sr_status = $1, process_status = $2, updated_date = CURRENT_TIMESTAMP
      WHERE ticket_id = $3
    `, [sr_status, process_status, ticket_id]);

    broadcastSSE({ type: 'update', table: 'ticket', id: ticket_id });
    res.json({ success: true, message: 'Status sync completed successfully' });
  } catch (err) {
    console.error('[SupportSync] Failed to sync status:', err.message);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// 4. Sync Rating (Tenant -> Helpdesk)
router.post('/sync-ticket-rating', verifyHmacSignature, async (req, res) => {
  const { ticket_id, rating } = req.body;

  try {
    await pool.query(`
      UPDATE ticket
      SET rating = $1, updated_date = CURRENT_TIMESTAMP
      WHERE ticket_id = $2
    `, [rating ? JSON.stringify(rating) : null, ticket_id]);

    broadcastSSE({ type: 'update', table: 'ticket', id: ticket_id });
    res.json({ success: true, message: 'Rating sync completed successfully' });
  } catch (err) {
    console.error('[SupportSync] Failed to sync rating:', err.message);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// 5. Get Ticket Types from Helpdesk
let helpdeskPool = null;

function getHelpdeskPool() {
  if (helpdeskPool) return helpdeskPool;

  const mainDbUrl = process.env.DATABASE_URL;
  let helpdeskDbUrl = mainDbUrl;

  try {
    const parsed = new URL(mainDbUrl);
    parsed.pathname = '/crc_helpdesk_db';
    helpdeskDbUrl = parsed.toString();
  } catch (e) {
    helpdeskDbUrl = mainDbUrl.substring(0, mainDbUrl.lastIndexOf('/')) + '/crc_helpdesk_db';
  }

  console.log(`[Support] Initializing connection to Helpdesk DB: ${helpdeskDbUrl.replace(/:([^:@]+)@/, ':****@')}`);
  helpdeskPool = new Pool({ connectionString: helpdeskDbUrl });
  return helpdeskPool;
}

router.get('/ticket-types', async (req, res) => {
  try {
    const hPool = getHelpdeskPool();
    const result = await hPool.query(
      'SELECT ticket_type_id AS policy_id, ticket_name AS policy_name, ticket_type AS policy_type, description FROM ticket_type WHERE deleted_at IS NULL ORDER BY ticket_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Support] Failed to fetch ticket types from helpdesk:', err.message);
    res.status(500).json({ error: 'Failed to fetch ticket types from helpdesk' });
  }
});

// 6. Get CMS Plan & MiniPC options from cms_terax database
let cmsPool = null;

function getCmsPool() {
  if (cmsPool) return cmsPool;

  const mainDbUrl = process.env.DATABASE_URL;
  let cmsDbUrl = mainDbUrl;

  try {
    const parsed = new URL(mainDbUrl);
    parsed.pathname = '/cms_terax';
    cmsDbUrl = parsed.toString();
  } catch (e) {
    cmsDbUrl = mainDbUrl.substring(0, mainDbUrl.lastIndexOf('/')) + '/cms_terax';
  }

  console.log(`[Support] Initializing connection to CMS DB: ${cmsDbUrl.replace(/:([^:@]+)@/, ':****@')}`);
  cmsPool = new Pool({ connectionString: cmsDbUrl });
  return cmsPool;
}

router.get('/cms-plans', async (req, res) => {
  try {
    const cPool = getCmsPool();
    const result = await cPool.query(
      'SELECT id, name FROM plans ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Support] Failed to fetch CMS plans:', err.message);
    res.status(500).json({ error: 'Failed to fetch CMS plans' });
  }
});

router.get('/cms-minipcs', async (req, res) => {
  try {
    const cPool = getCmsPool();
    const result = await cPool.query(
      'SELECT id, name FROM minipcs ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Support] Failed to fetch CMS minipcs:', err.message);
    res.status(500).json({ error: 'Failed to fetch CMS minipcs' });
  }
});

module.exports = {
  router,
  syncTicketToHelpdesk,
  syncCommentToHelpdesk,
  syncCommentToTenant,
  syncStatusToTenant,
  syncRatingToHelpdesk
};
