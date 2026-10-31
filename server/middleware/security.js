/**
 * Security middleware: rate limiting, security headers, body hardening,
 * role guards, CORS whitelist and payload error handling.
 */
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const WINDOW_15_MIN = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function roleOf(user) {
  return String((user && user.role) || '').trim().toUpperCase();
}

function isSuperAdmin(user) {
  return roleOf(user) === 'SUPER ADMIN';
}

/** Express middleware: only allow the given roles (case-insensitive). */
function requireRoles(...roles) {
  const allowed = roles.map(r => String(r).trim().toUpperCase());
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowed.includes(roleOf(req.user))) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

/** Try to resolve a verified user key from the Bearer token (for rate limit keys only). */
function verifiedUserKey(req) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token || !process.env.JWT_SECRET) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && decoded.employee_id ? `u:${decoded.employee_id}` : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/**
 * Global limiter for every /api endpoint.
 *  - authenticated users are counted per user (so offices behind one NAT are not throttled together)
 *  - anonymous callers are counted per IP with a much lower ceiling
 */
const globalLimiter = rateLimit({
  validate: { trustProxy: false, xForwardedForHeader: false },
  windowMs: WINDOW_15_MIN,
  limit: (req) => (req.rateKey && req.rateKey.startsWith('u:') ? 3000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/stream',
  keyGenerator: (req) => {
    const uk = verifiedUserKey(req);
    req.rateKey = uk || `ip:${ipKeyGenerator(req.ip)}`;
    return req.rateKey;
  },
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }
});

/**
 * Authentication limiter: max 5 FAILED attempts / 15 minutes per IP + account.
 * Successful requests are not counted so legitimate users are not locked out.
 */
const authLimiter = rateLimit({
  validate: { trustProxy: false, xForwardedForHeader: false },
  windowMs: WINDOW_15_MIN,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const id = String(b.login_id || b.username || b.email || '').toLowerCase().slice(0, 254);
    return `${ipKeyGenerator(req.ip)}|${id}`;
  },
  message: { error: 'Quá nhiều lần thử không thành công. Vui lòng thử lại sau 15 phút.' }
});

/** Upload limiter (per authenticated user, falls back to IP). */
const uploadLimiter = rateLimit({
  validate: { trustProxy: false, xForwardedForHeader: false },
  windowMs: WINDOW_15_MIN,
  limit: 600, // chunked uploads send many small requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => verifiedUserKey(req) || `ip:${ipKeyGenerator(req.ip)}`,
  message: { error: 'Quá nhiều yêu cầu tải lên. Vui lòng thử lại sau.' }
});

/** Limiter for machine-to-machine public routes (CMS sync, helpdesk sync). */
const publicSyncLimiter = rateLimit({
  validate: { trustProxy: false, xForwardedForHeader: false },
  windowMs: WINDOW_15_MIN,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  message: { error: 'Too many requests.' }
});

// ---------------------------------------------------------------------------
// Security headers (helmet-lite, no CSP to avoid breaking inline scripts / Google SSO)
// ---------------------------------------------------------------------------
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  res.removeHeader('X-Powered-By');
  next();
}

// ---------------------------------------------------------------------------
// CORS whitelist (env CORS_ORIGINS="https://a.com,https://b.com"). Empty = allow all (legacy).
// Auth uses Authorization header (no cookies), so wildcard CORS is not CSRF-exploitable.
// ---------------------------------------------------------------------------
function buildCorsOptions() {
  const list = String(process.env.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return {};
  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / server-to-server
      const ok = list.some(o => {
        if (o.startsWith('*.')) return origin.endsWith(o.slice(1)) || origin.endsWith('//' + o.slice(2));
        return o === origin;
      });
      cb(null, ok);
    }
  };
}

// ---------------------------------------------------------------------------
// Body hardening: prototype pollution, excessive nesting, NUL bytes.
// ---------------------------------------------------------------------------
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 25;

function scrub(value, depth) {
  if (depth > MAX_DEPTH) throw Object.assign(new Error('Payload nesting too deep'), { status: 400 });
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) scrub(value[i], depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(k)) {
        delete value[k];
        continue;
      }
      scrub(value[k], depth + 1);
    }
    return;
  }
  if (typeof value === 'string' && value.length < 1024 * 1024 && value.indexOf('\u0000') !== -1) {
    throw Object.assign(new Error('Invalid characters in payload'), { status: 400 });
  }
}

function sanitizeBody(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') scrub(req.body, 0);
    if (req.query && typeof req.query === 'object') {
      for (const k of Object.keys(req.query)) {
        if (FORBIDDEN_KEYS.has(k)) delete req.query[k];
      }
    }
    next();
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}

/** Reject bodies whose Content-Type is not JSON / form (for public + auth routes). */
function requireJsonBody(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const len = parseInt(req.headers['content-length'] || '0', 10);
  const hasBody = len > 0 || req.headers['transfer-encoding'];
  if (!hasBody) return next();
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json') || ct.includes('application/x-www-form-urlencoded')) return next();
  return res.status(415).json({ error: 'Unsupported Media Type. Use application/json.' });
}

// ---------------------------------------------------------------------------
// Final error handler: payload too large / malformed JSON / everything else.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload quá lớn.' });
  }
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  }
  if (err && (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported')) {
    return res.status(415).json({ error: 'Unsupported encoding.' });
  }
  if (err && err.type === 'request.aborted') return;
  console.error('[Unhandled Error]', err && err.stack ? err.stack : err);
  res.status((err && err.status) || 500).json({ error: 'Lỗi hệ thống.' });
}

module.exports = {
  isSuperAdmin,
  requireRoles,
  globalLimiter,
  authLimiter,
  uploadLimiter,
  publicSyncLimiter,
  securityHeaders,
  buildCorsOptions,
  sanitizeBody,
  requireJsonBody,
  errorHandler
};
