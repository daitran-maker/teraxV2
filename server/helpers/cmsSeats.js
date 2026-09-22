/**
 * cmsSeats.js — Tenant Helper
 * Gửi event đến CMS để tracking user seat usage.
 * Dùng HMAC-SHA256 signing giống cmsSync.js hiện tại.
 *
 * Events:
 *   - login:      gửi sau khi user login thành công
 *   - activate:   gửi khi Super Admin bật app_user_enabled cho employee
 *   - deactivate: gửi khi Super Admin tắt app_user_enabled cho employee
 */

const crypto = require('crypto');

const CMS_BASE_URL   = process.env.CMS_BASE_URL   || 'http://cms.terax.ai';
const HMAC_SECRET    = process.env.CMS_HMAC_SECRET;
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || process.env.SUBDOMAIN || '';

if (!HMAC_SECRET) {
  console.warn('[CmsSeats] ⚠️  CMS_HMAC_SECRET not set — seat events will fail silently');
}

/**
 * Build HMAC-signed headers for CMS API call
 */
function buildSignedHeaders(body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = HMAC_SECRET
    ? crypto.createHmac('sha256', HMAC_SECRET).update(JSON.stringify(body)).digest('hex')
    : 'no-secret';
  return {
    'Content-Type': 'application/json',
    'x-cms-signature': signature,
    'x-cms-timestamp': timestamp
  };
}

/**
 * pushLoginToCMS
 * Gọi sau khi user đăng nhập thành công.
 * @returns {{ seat_count, seat_limit, over_limit, is_active } | null}
 */
async function pushLoginToCMS({ email, username, full_name }) {
  if (!CMS_BASE_URL || !HMAC_SECRET) return null;

  const subdomain = TENANT_SUBDOMAIN;
  if (!subdomain) {
    console.warn('[CmsSeats] TENANT_SUBDOMAIN not set — skipping login push');
    return null;
  }

  const body = { subdomain, email: email || null, username: username || null, full_name: full_name || null };

  try {
    const response = await fetch(`${CMS_BASE_URL}/api/user-seats/login`, {
      method:  'POST',
      headers: buildSignedHeaders(body),
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(5000) // 5s timeout — không block login
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[CmsSeats] Login push non-OK (${response.status}): ${text}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    // Never block login due to CMS push failure
    console.warn('[CmsSeats] Login push failed (non-critical):', err.message);
    return null;
  }
}

/**
 * pushAppAccessToCMS
 * Gọi khi Super Admin bật/tắt app_user_enabled cho employee.
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} opts.username
 * @param {string} opts.full_name
 * @param {'activate'|'deactivate'} opts.action
 * @returns {{ seat_count, is_active } | null}
 */
async function pushAppAccessToCMS({ email, username, full_name, action }) {
  if (!CMS_BASE_URL || !HMAC_SECRET) return null;

  const subdomain = TENANT_SUBDOMAIN;
  if (!subdomain) {
    console.warn('[CmsSeats] TENANT_SUBDOMAIN not set — skipping app-access push');
    return null;
  }

  const body = {
    subdomain,
    email:     email     || null,
    username:  username  || null,
    full_name: full_name || null,
    action                           // 'activate' | 'deactivate'
  };

  try {
    const response = await fetch(`${CMS_BASE_URL}/api/user-seats/app-access`, {
      method:  'POST',
      headers: buildSignedHeaders(body),
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[CmsSeats] App-access push non-OK (${response.status}): ${text}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('[CmsSeats] App-access push failed (non-critical):', err.message);
    return null;
  }
}

module.exports = { pushLoginToCMS, pushAppAccessToCMS };
