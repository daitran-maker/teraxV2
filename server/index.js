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
const rateLimit = require('express-rate-limit');
const pool = require('./db');

// Trigger server reload to apply view_name updates in DB action rules
// Modular Monolith Core Event Bus & Subscribed Modules
require('./core/events');
require('./modules/notification');
const identityModule = require('./modules/identity');
const organizationModule = require('./modules/organization');

const app = express();
app.set('trust proxy', true);

// Transparent proxy for Helpdesk standalone app (wildcard DNS support)
const http = require('http');
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('helpdesk.') && process.env.IS_HELPDESK !== 'true') {
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

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 15 phút.' }
});


// Middleware
if (compression) {
  app.use(compression());
}
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html')) {
      // HTML files must never be aggressively cached so clients immediately get updated script/style version tags
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
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

// Public API Routes — apply rate limiters to prevent brute-force
app.use('/api/auth/login', authLimiter);

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
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'dll', 'com', 'ps1', 'scr', 'bin', 'pif', 'application', 'gadget', 'hta', 'cpl', 'msc', 'jar'
]);

function isFileExtensionDisallowed(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return DISALLOWED_FILE_EXTENSIONS.has(ext);
}

function sanitizeUploadFileName(rawName) {
  if (!rawName) return 'file';
  let decoded = rawName;
  try { decoded = decodeURIComponent(rawName); } catch (e) {}
  const base = path.basename(decoded, path.extname(decoded)).trim();
  // Only replace characters forbidden by operating systems (\ / : * ? " < > | and control chars)
  const sanitized = base.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return sanitized || 'file';
}

// Pre-upload endpoint for large attachments to avoid Base64 payload limits
app.post('/api/upload-file', async (req, res) => {
  try {
    const { name, base64 } = req.body || {};
    if (!base64 || !name) {
      return res.status(400).json({ error: 'Missing file data or name' });
    }
    if (isFileExtensionDisallowed(name)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(name)}). Executable and script files are prohibited for security.` });
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
      ext = mimeToExt[mime] || path.extname(name).replace('.', '') || 'bin';
    } else {
      buffer = Buffer.from(base64, 'base64');
      ext = path.extname(name).replace('.', '') || 'bin';
    }

    // Enforce storage quota check
    await checkStorageQuota(buffer.length);

    const cleanName = sanitizeUploadFileName(name);
    const filename = `upload_${Date.now()}_${cleanName}.${ext}`;
    const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    const fileUrl = `/uploads/${filename}`;
    console.log(`[UploadFile] Pre-uploaded file '${name}' -> ${fileUrl} (${buffer.length} bytes)`);
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('[UploadFile] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stream raw file binary upload: POST /api/upload-binary?name=test.pdf
app.post('/api/upload-binary', async (req, res) => {
  try {
    const rawName = req.query.name || 'file.bin';
    if (isFileExtensionDisallowed(rawName)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(rawName)}). Executable and script files are prohibited for security.` });
    }
    // Check storage limit before streaming
    await checkStorageQuota(0);

    const cleanName = sanitizeUploadFileName(rawName);
    const ext = path.extname(rawName).replace('.', '') || 'bin';
    const filename = `upload_${Date.now()}_${cleanName}.${ext}`;
    const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const fileUrl = `/uploads/${filename}`;
      console.log(`[UploadBinary] Streamed binary file '${rawName}' -> ${fileUrl}`);
      res.json({ success: true, url: fileUrl });
    });

    writeStream.on('error', (err) => {
      console.error('[UploadBinary] Error writing file:', err);
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    console.error('[UploadBinary] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Chunked file upload endpoint to bypass 1MB proxy body limits
app.post('/api/upload-chunk', async (req, res) => {
  try {
    const rawName = req.query.name || 'file.bin';
    if (isFileExtensionDisallowed(rawName)) {
      return res.status(400).json({ error: `File type not allowed (${path.extname(rawName)}). Executable and script files are prohibited for security.` });
    }
    // Check storage limit before writing chunk
    await checkStorageQuota(0);

    const uploadId = req.query.uploadId || Date.now();
    const chunkIndex = parseInt(req.query.chunkIndex || '0', 10);
    const totalChunks = parseInt(req.query.totalChunks || '1', 10);

    const cleanName = sanitizeUploadFileName(rawName);
    const ext = path.extname(rawName).replace('.', '') || 'bin';
    const filename = `upload_${uploadId}_${cleanName}.${ext}`;
    const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filePath = path.join(UPLOADS_DIR, filename);

    const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      if (chunkIndex === totalChunks - 1) {
        const fileUrl = `/uploads/${filename}`;
        console.log(`[UploadChunk] Completed chunked upload '${rawName}' -> ${fileUrl} (${totalChunks} chunks)`);
        res.json({ success: true, url: fileUrl });
      } else {
        res.json({ success: true, chunkIndex });
      }
    });

    writeStream.on('error', (err) => {
      console.error('[UploadChunk] Error writing chunk:', err);
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    console.error('[UploadChunk] Error:', err);
    res.status(500).json({ error: err.message });
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
app.use('/api/cms', require('./routes/cmsSync'));
app.use('/api/support', require('./routes/support').router);

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

app.post('/api/system-status/cleanup-logs', async (req, res) => {
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
app.use('/api/system-setup', require('./routes/systemSetup'));
app.use('/api/my-company', organizationModule.myCompanyRouter);
app.use('/api/departments', organizationModule.departmentRouter);
app.use('/api/employees', organizationModule.employeeRouter);
app.use('/api/companies', organizationModule.companyRouter);
app.use('/api/contacts', organizationModule.contactRouter);
app.use('/api/policies', require('./routes/policy'));
app.use('/api/permissions', identityModule.permissionsRouter);
app.use('/api/schema', require('./routes/schema'));
app.use('/api/cms-lookups', require('./routes/cmsLookups'));
app.use('/api/table', require('./routes/dynamic_crud')); // Dynamic Router for 15+ Tables
app.use('/api/actions', require('./routes/actions'));
app.use('/api/my-views', require('./routes/myViews'));
app.use('/api/notifications', require('./modules/notification').router);
app.use('/api/backup', require('./routes/backup'));
app.use('/api/automations', require('./routes/automations'));

// Fallback: serve index.html for all non-API routes
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

app.listen(PORT, () => {
  console.log(`✅ CRC App Server running on http://localhost:${PORT}`);
});
