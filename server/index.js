require('dotenv').config();
const express = require('express');
let compression;
try { compression = require('compression'); } catch (e) {}
const fs = require('fs');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const cors = require('cors');
const path = require('path');
const security = require('./middleware/security');
const pool = require('./db');

// Trigger server reload to apply view_name updates in DB action rules
// Modular Monolith Core Event Bus & Subscribed Modules
require('./core/events');
require('../modules/notification/server');
const identityModule = require('../modules/identity/server');
const organizationModule = require('../modules/organization/server');

const app = express();
// TRUST_PROXY: number of reverse-proxy hops (e.g. 1). Defaults to legacy behaviour when unset.
const _trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', _trustProxy === undefined ? true : (/^\d+$/.test(_trustProxy) ? parseInt(_trustProxy, 10) : _trustProxy === 'true'));
app.disable('x-powered-by');
app.use(security.securityHeaders);

// Transparent proxy for Helpdesk standalone app (wildcard DNS support)
const http = require('http');
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (/^helpdesk\.[a-z0-9.-]+(:\d+)?$/i.test(host) && process.env.IS_HELPDESK !== 'true') {
    const targetHost = process.env.HELPDESK_PROXY_TARGET || 'crc-helpdesk-service';
    const targetPort = process.env.HELPDESK_PROXY_PORT || 5223;

    const proxyReq = http.request({
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error]:', err);
      res.status(502).send('Helpdesk service is temporarily unavailable.');
    });

    req.pipe(proxyReq, { end: true });
    return;
  }
  next();
});

const PORT = process.env.PORT || 5221;

// Rate limiters (see server/middleware/security.js)
const { authLimiter, uploadLimiter, publicSyncLimiter } = security;

// Middleware
if (compression) {
  app.use(compression());
}
app.use(cors(security.buildCorsOptions()));

// Global rate limit for every API endpoint
app.use('/api', security.globalLimiter);

// Public / unauthenticated routes get small body limits and must send JSON.
// (body-parser skips parsing once req.body is set, so these take precedence.)
app.use('/api/auth', security.requireJsonBody, express.json({ limit: '100kb' }), express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 50 }));
app.use(['/api/cms', '/api/support'], publicSyncLimiter, express.json({ limit: process.env.PUBLIC_BODY_LIMIT || '5mb' }));

// Authenticated routes: default body limit (override with BODY_LIMIT, e.g. '50mb')
const BODY_LIMIT = process.env.BODY_LIMIT || '25mb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT, parameterLimit: 5000 }));
app.use(security.sanitizeBody);
try {
  app.use('/api', require('./helpers/hashidMiddleware'));
} catch (e) {
  console.warn('hashidMiddleware not loaded:', e.message);
}

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

// Serve static frontend files with smart caching headers
// Uploaded files: never let the browser sniff or execute active content from user uploads
const ACTIVE_CONTENT_EXT = /\.(html?|xhtml|svg|svgz|xml|xsl|xslt|js|mjs|php\d?|phtml|jsp|aspx?|swf|hta)$/i;
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (ACTIVE_CONTENT_EXT.test(req.path)) {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  }
  next();
});

app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html')) {
      // HTML files must never be aggressively cached so clients immediately get updated script/style version tags
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filepath.endsWith('setupWizard.js') || filepath.endsWith('tableView.js') || filepath.endsWith('detailView.js') || filepath.endsWith('i18n.js') || filepath.endsWith('.config.js')) {
      // Frequently updated core views/i18n, bypass cache to ensure instant client updates
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
      // Versioned JS & CSS files (cached for 1 day, reducing repeat load times to 0ms)
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    } else if (filepath.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/i)) {
      // Media & font assets
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Serve modular domain frontend files
// Never expose server-side module source code over static hosting
app.use('/modules', (req, res, next) => {
  if (/(^|\/)server(\/|$)/i.test(req.path) || /package\.json$/i.test(req.path)) {
    return res.status(404).end();
  }
  next();
});
app.use('/modules', express.static(path.join(__dirname, '../modules'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.config.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    }
  }
}));

// Public API Routes — max 5 failed attempts / 15 min on every credential-handling route
app.use([
  '/api/auth/login',
  '/api/auth/google-login',
  '/api/auth/change-password',
  '/api/auth/magic-login',
  '/api/auth/google/sso-callback',
  '/api/auth/switch-user'
], authLimiter);

app.use('/api/auth', identityModule.authRouter);

async function checkStorageQuota(incomingBytes = 0) {
  try {
    const { getSystemStatus } = require('./helpers/systemStatus');
    const status = await getSystemStatus();
    if (status.storage.limitBytes > 0) {
      if (status.storage.usedBytes + incomingBytes > status.storage.limitBytes) {
        const limitGb = status.storage.limitGb;
        const usedGb = (status.storage.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        throw new Error(`Vượt quá giới hạn dung lượng lưu trữ của gói dịch vụ (${usedGb} GB / ${limitGb} GB). Vui lòng giải phóng dung lượng hoặc nâng cấp gói dịch vụ.`);
      }
    }
  } catch (e) {
    if (e.message.includes('giới hạn dung lượng')) throw e;
    console.error('[StorageCheckError]', e.message);
  }
}

const DISALLOWED_FILE_EXTENSIONS = new Set([
  // executables / scripts
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'vbe', 'msi', 'dll', 'com', 'ps1', 'scr', 'bin', 'pif', 'application', 'gadget', 'hta', 'cpl', 'msc', 'jar',
  'js', 'mjs', 'wsf', 'lnk', 'reg', 'php', 'php3', 'php4', 'php5', 'phtml', 'jsp', 'asp', 'aspx', 'cgi', 'pl', 'py', 'swf',
  // active content that would run in the app origin (stored XSS)
  'html', 'htm', 'xhtml', 'svg', 'svgz', 'xml', 'xsl', 'xslt'
]);

const MAX_UPLOAD_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(200 * 1024 * 1024), 10); // 200 MB / file
const MAX_CHUNK_BYTES = parseInt(process.env.UPLOAD_MAX_CHUNK_BYTES || String(5 * 1024 * 1024), 10); // 5 MB / chunk
const MAX_CHUNKS = 1000;
const UPLOAD_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

function isFileExtensionDisallowed(filename) {
  if (!filename) return false;
  const ext = path.extname(String(filename)).replace('.', '').toLowerCase();
  return DISALLOWED_FILE_EXTENSIONS.has(ext);
}

function safeExt(rawName) {
  const ext = path.extname(String(rawName || '')).replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
}

function sanitizeUploadFileName(rawName) {
  if (!rawName) return 'file';
  let decoded = String(rawName).slice(0, 500);
  try { decoded = decodeURIComponent(decoded); } catch (e) {}
  const base = path.basename(decoded, path.extname(decoded)).trim();
  // Strip commas, quotes, brackets, semicolons, and illegal filesystem characters
  const sanitized = base.replace(/[,;[\]'"\\/:*?<>|\x00-\x1f]/g, '_').replace(/\.{2,}/g, '_').trim().slice(0, 120);
  return sanitized || 'file';
}

function getUploadsDir() {
  const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

function sendUploadError(res, err, tag) {
  const msg = String((err && err.message) || '');
  if (msg.includes('giới hạn dung lượng')) {
    return res.status(413).json({ error: msg });
  }
  console.error(`[${tag}] Error:`, err);
  return res.status(500).json({ error: 'Upload failed.' });
}

/**
 * Stream request body to disk while enforcing a hard byte limit.
 * Aborts and removes the partial file (when `removeOnAbort`) if the limit is exceeded.
 */
function streamToFile(req, res, filePath, { flags = 'w', maxBytes, existingBytes = 0, removeOnAbort = true, onDone, tag }) {
  const declared = parseInt(req.headers['content-length'] || '0', 10);
  if (declared && declared + existingBytes > maxBytes) {
    req.resume();
    return res.status(413).json({ error: 'File quá lớn.' });
  }

  const writeStream = fs.createWriteStream(filePath, { flags });
  let received = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    received += chunk.length;
    if (!aborted && received + existingBytes > maxBytes) {
      aborted = true;
      req.unpipe(writeStream);
      writeStream.destroy();
      req.resume(); // drain
      if (removeOnAbort) fs.unlink(filePath, () => {});
      if (!res.headersSent) res.status(413).json({ error: 'File quá lớn.' });
    }
  });
  req.on('aborted', () => {
    if (!aborted) {
      aborted = true;
      writeStream.destroy();
      if (removeOnAbort) fs.unlink(filePath, () => {});
    }
  });

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    if (aborted || res.headersSent) return;
    onDone(received);
  });
  writeStream.on('error', (err) => {
    if (res.headersSent) return;
    console.error(`[${tag}] Error writing file:`, err);
    res.status(500).json({ error: 'Upload failed.' });
  });
}

// All upload endpoints require a valid login + are rate limited
app.use(['/api/upload-file', '/api/upload-binary', '/api/upload-chunk'], uploadLimiter, identityModule.authenticate);

// Pre-upload endpoint for large attachments to avoid Base64 payload limits
app.post('/api/upload-file', async (req, res) => {
  try {
    const { name, base64 } = req.body || {};
    if (typeof base64 !== 'string' || typeof name !== 'string' || !base64 || !name) {
      return res.status(400).json({ error: 'Missing file data or name' });
    }
    if (name.length > 500) {
      return res.status(400).json({ error: 'File name too long' });
    }
    if (isFileExtensionDisallowed(name)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(name)}). Executable, script and web-page files are prohibited for security.` });
    }
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
    let buffer, ext;
    if (matches) {
      buffer = Buffer.from(matches[2], 'base64');
      const mime = matches[1];
      const mimeToExt = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'text/plain': 'txt',
        'application/zip': 'zip',
        'application/x-zip-compressed': 'zip',
        'image/png': 'png',
        'image/jpeg': 'jpg'
      };
      ext = mimeToExt[mime] || safeExt(name);
    } else {
      buffer = Buffer.from(base64, 'base64');
      ext = safeExt(name);
    }
    if (DISALLOWED_FILE_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: `File type not allowed (.${ext}).` });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'File quá lớn.' });
    }

    // Enforce storage quota check
    await checkStorageQuota(buffer.length);

    const cleanName = sanitizeUploadFileName(name);
    const filename = `upload_${Date.now()}_${cleanName}.${ext}`;
    fs.writeFileSync(path.join(getUploadsDir(), filename), buffer);
    const fileUrl = `/uploads/${filename}`;
    console.log(`[UploadFile] Pre-uploaded file '${cleanName}' -> ${fileUrl} (${buffer.length} bytes)`);
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    sendUploadError(res, err, 'UploadFile');
  }
});

// Stream raw file binary upload: POST /api/upload-binary?name=test.pdf
app.post('/api/upload-binary', async (req, res) => {
  try {
    const rawName = String(req.query.name || 'file.bin').slice(0, 500);
    if (isFileExtensionDisallowed(rawName)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(rawName)}). Executable, script and web-page files are prohibited for security.` });
    }
    // Check storage limit before streaming
    await checkStorageQuota(parseInt(req.headers['content-length'] || '0', 10) || 0);

    const cleanName = sanitizeUploadFileName(rawName);
    const ext = safeExt(rawName);
    const filename = `upload_${Date.now()}_${cleanName}.${ext}`;
    const filePath = path.join(getUploadsDir(), filename);

    streamToFile(req, res, filePath, {
      maxBytes: MAX_UPLOAD_BYTES,
      tag: 'UploadBinary',
      onDone: () => {
        const fileUrl = `/uploads/${filename}`;
        console.log(`[UploadBinary] Streamed binary file '${cleanName}' -> ${fileUrl}`);
        res.json({ success: true, url: fileUrl });
      }
    });
  } catch (err) {
    sendUploadError(res, err, 'UploadBinary');
  }
});

// Chunked file upload endpoint to bypass 1MB proxy body limits
app.post('/api/upload-chunk', async (req, res) => {
  try {
    const rawName = String(req.query.name || 'file.bin').slice(0, 500);
    if (isFileExtensionDisallowed(rawName)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(rawName)}). Executable, script and web-page files are prohibited for security.` });
    }

    const uploadId = String(req.query.uploadId || Date.now());
    if (!UPLOAD_ID_REGEX.test(uploadId)) {
      return res.status(400).json({ error: 'Invalid uploadId' });
    }
    const chunkIndex = parseInt(req.query.chunkIndex || '0', 10);
    const totalChunks = parseInt(req.query.totalChunks || '1', 10);
    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) ||
        totalChunks < 1 || totalChunks > MAX_CHUNKS || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return res.status(400).json({ error: 'Invalid chunk parameters' });
    }

    // Check storage limit before writing chunk
    await checkStorageQuota(parseInt(req.headers['content-length'] || '0', 10) || 0);

    const cleanName = sanitizeUploadFileName(rawName);
    const ext = safeExt(rawName);
    const filename = `upload_${uploadId}_${cleanName}.${ext}`;
    const filePath = path.join(getUploadsDir(), filename);

    // First chunk always starts a fresh file; later chunks append
    let existingBytes = 0;
    if (chunkIndex > 0) {
      try { existingBytes = fs.statSync(filePath).size; } catch (e) { existingBytes = 0; }
    }

    if (existingBytes + (parseInt(req.headers['content-length'] || '0', 10) || 0) > MAX_UPLOAD_BYTES) {
      req.resume();
      return res.status(413).json({ error: 'File quá lớn.' });
    }

    streamToFile(req, res, filePath, {
      flags: chunkIndex === 0 ? 'w' : 'a',
      maxBytes: MAX_CHUNK_BYTES,
      existingBytes: 0,
      removeOnAbort: chunkIndex === 0,
      tag: 'UploadChunk',
      onDone: () => {
        if (chunkIndex === totalChunks - 1) {
          const fileUrl = `/uploads/${filename}`;
          console.log(`[UploadChunk] Completed chunked upload '${cleanName}' -> ${fileUrl} (${totalChunks} chunks)`);
          res.json({ success: true, url: fileUrl });
        } else {
          res.json({ success: true, chunkIndex });
        }
      }
    });
  } catch (err) {
    sendUploadError(res, err, 'UploadChunk');
  }
});

// SSE Endpoint (Must be after auth if we want it protected, or before if public. Let's make it protected)
// Wait, actually let's keep it protected by placing it after authenticate middleware, OR before if we pass token in URL.
// Since EventSource doesn't support headers easily natively, we pass token in query.
app.get('/api/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    jwt.verify(token, JWT_SECRET);
    require('./helpers/sseHelper').addClient(req, res);
  } catch(e) {
    res.status(401).end();
  }
});

// Public CMS Sync Route (bypasses standard JWT token auth)
app.use('/api/cms', require('../modules/system/server/cmsSync.routes'));
app.use('/api/support', require('../modules/support/server/support.routes').router);

// Health check (Public for K8s readiness/liveness probes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public Brand Info Endpoint (Used by login, index, mobile PWA)
app.get(['/api/public/brand-info', '/api/brand-info'], async (req, res) => {
  try {
    let features = {};
    let tenantCompany = '';
    let tenantLogo = null;

    try {
      const { rows: tRows } = await pool.query('SELECT features, company_name, logo FROM cms_tenant_info LIMIT 1');
      if (tRows.length > 0) {
        tenantCompany = tRows[0].company_name || '';
        tenantLogo = tRows[0].logo || null;
        if (tRows[0].features) {
          features = typeof tRows[0].features === 'string' ? JSON.parse(tRows[0].features) : tRows[0].features;
        }
      }
    } catch (e) {
      // cms_tenant_info may not exist yet
    }

    const hasBranding = features.custom_branding === true || features.custom_branding === 'true';

    let compShortname = '';
    let compFullname = '';
    let compLogo = null;

    try {
      const { rows: cRows } = await pool.query('SELECT company_shortname, company_fullname, logo FROM my_company ORDER BY my_company_id ASC LIMIT 1');
      if (cRows.length > 0) {
        compShortname = cRows[0].company_shortname || '';
        compFullname = cRows[0].company_fullname || '';
        compLogo = cRows[0].logo || null;
      }
    } catch (e) {
      // my_company may not exist yet
    }

    const effectiveBrand = compShortname || compFullname || tenantCompany || 'TeraX';
    const effectiveLogo = compLogo || tenantLogo || null;

    if (hasBranding && (effectiveLogo || compShortname || compFullname || tenantCompany)) {
      return res.json({
        has_branding: true,
        brand_name: effectiveBrand,
        app_title: `${effectiveBrand} – Company Request Center`,
        app_name: `[${effectiveBrand} – Company Request Center]`,
        logo: effectiveLogo || '/assets/terax-logo-light.png',
        icon: effectiveLogo || '/icon-v2.png?v=20260912'
      });
    }

    // Default fallback
    res.json({
      has_branding: false,
      brand_name: 'TeraX',
      app_title: 'TeraX – Company Request Center',
      app_name: '[TeraX – Company Request Center]',
      logo: '/assets/terax-logo-light.png',
      icon: '/icon-v2.png?v=20260912'
    });
  } catch (err) {
    res.json({
      has_branding: false,
      brand_name: 'TeraX',
      app_title: 'TeraX – Company Request Center',
      app_name: '[TeraX – Company Request Center]',
      logo: '/assets/terax-logo-light.png',
      icon: '/icon-v2.png?v=20260912'
    });
  }
});

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Auth token missing' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (decoded && (!decoded.employee_id || decoded.employee_id === 'system' || decoded.employee_id.includes('@'))) {
      const searchKey = decoded.employee_id || decoded.email || decoded.username;
      if (searchKey) {
        try {
          const empRes = await pool.query('SELECT employee_id FROM employee WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(employee_id) = LOWER($1)) AND deleted_at IS NULL LIMIT 1', [searchKey]);
          if (empRes.rows.length > 0) {
            req.user.employee_id = empRes.rows[0].employee_id;
          }
        } catch (dbErr) {
          console.error('Error resolving employee_id in auth middleware:', dbErr.message);
        }
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Protect all subsequent API Routes
app.use('/api', identityModule.authenticate);

app.get('/api/system-status', async (req, res) => {
  try {
    const { getSystemStatus } = require('./helpers/systemStatus');
    const status = await getSystemStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-status/cleanup-logs', security.requireRoles('Super Admin'), async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE audit_logs CASCADE');
    console.log('[SystemStatus] Successfully truncated audit_logs table.');
    res.json({ success: true, message: 'Đã dọn dẹp lịch sử hoạt động (Audit logs) thành công.' });
  } catch (err) {
    console.error('[SystemStatus] Failed to truncate audit_logs:', err.message);
    res.status(500).json({ error: 'Không thể dọn dẹp lịch sử hoạt động: ' + err.message });
  }
});

// API Routes
app.get('/api/files/download/:id/:filename', require('./helpers/fileStorageHelper').handleFileDownload);
app.use('/api/system-setup', require('../modules/system/server/systemSetup.routes'));
app.use('/api/my-company', organizationModule.myCompanyRouter);
app.use('/api/departments', organizationModule.departmentRouter);
app.use('/api/employees', organizationModule.employeeRouter);
app.use('/api/companies', organizationModule.companyRouter);
app.use('/api/contacts', organizationModule.contactRouter);
app.use('/api/policies', require('../modules/workflow/server/policy.routes'));
app.use('/api/permissions', identityModule.permissionsRouter);
app.use('/api/schema', require('../modules/system/server/schema.routes'));
app.use('/api/cms-lookups', require('../modules/system/server/cmsLookups.routes'));
app.use('/api/table', require('./routes/dynamic_crud')); // Dynamic Router for 15+ Tables
app.use('/api/actions', require('./routes/actions'));
app.use('/api/my-views', require('../modules/request/server/myViews.routes'));
app.use('/api/notifications', require('../modules/notification/server').router);
app.use('/api/backup', require('../modules/system/server/backup.routes'));
app.use('/api/automations', require('../modules/system/server/automations.routes'));

// Fallback: serve index.html for all non-API routes
// 404 handler for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize scheduled background jobs
require('./cron');
require('./helpers/backupCron');

pool.query(`
  INSERT INTO action_rules (action_id, view_name, roles, description, display_name, display)
  VALUES ('payment_change_mtr', 'payment', '[request.sr_owner],[request.policy_lead]', 'Thay đổi MTR transaction cho payment đã thanh toán.', 'Change MTR', true)
  ON CONFLICT (action_id) DO NOTHING
`).catch(err => console.error('Failed to seed action rule for payment_change_mtr:', err.message));

require('../modules/service_delivery/server/service_delivery.cron');

pool.query(`
  INSERT INTO action_rules (action_id, view_name, roles, description, display_name, display)
  VALUES ('sdc_submit', 'service_delivery_contract', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater],[coordinator__employee],[created_by]', 'Gửi Service Delivery Contract để phê duyệt (RSDC_service_delivery).', 'Submit for approval', true)
  ON CONFLICT (action_id) DO NOTHING
`).catch(err => console.error('Failed to seed action rule for sdc_submit:', err.message));

// Payload too large / malformed JSON / unexpected errors
app.use(security.errorHandler);

app.listen(PORT, () => {
  console.log(`✅ CRC App Server running on http://localhost:${PORT}`);
});
