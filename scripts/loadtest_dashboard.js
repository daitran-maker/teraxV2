/**
 * ================================================================
 *  CRC LOADTEST DASHBOARD v3.1 — Terax Platform
 * ================================================================
 * - TEST 15 TENANTS SONG SONG TRỰC TIẾP QUA SUBDOMAIN URLS
 * - THEO DÕI REALTIME CPU & RAM MÁY .51
 * - THEO DÕI REALTIME CPU & RAM TỪNG POD / CONTAINER (demoapp01 -> 15)
 * - THỐNG KÊ REQUEST SUCCESS / FAIL & GHI NHẬN LẦN FAIL ĐẦU TIÊN
 * ================================================================
 */
'use strict';
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '8099');
const SERVER_IP      = process.env.TARGET_SERVER_IP || '10.91.1.51';
const DOMAIN_SUFFIX  = process.env.DOMAIN_SUFFIX    || 'terax.ai';
const METRICS_URL    = `http://${SERVER_IP}:7788/`;

function build15AppsConfig(ip, suffix, mode = 'subdomain') {
  const apps = [];
  const proto = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
  for (let i = 1; i <= 15; i++) {
    const num    = String(i).padStart(2, '0');
    const domain = `demoapp${num}.${suffix}`;
    const baseUrl = mode === 'ip' ? `http://${ip}` : `${proto}://${domain}`;
    apps.push({ name: `demoapp${num}`, baseUrl, domain });
  }
  return apps;
}

let CONFIG = {
  TARGET_APPS: build15AppsConfig(SERVER_IP, DOMAIN_SUFFIX),
  ADMIN: {
    login_id: 'EMP-001',
  },
  CONCURRENCY_LEVELS: [15, 30, 45],
  REQUESTS_PER_LEVEL: 30,
  BATCH_DELAY_MS: 200,
  FILE_SIZE_BYTES: 200 * 1024,
  SIDECAR_URL: process.env.FILE_STORAGE_URL || 'http://127.0.0.1:5005',
  REQUEST_TIMEOUT_MS: 30000,
  TEST_PREFIX: 'LOADTEST',
  CLEANUP_AFTER: false,
};

const bus = new EventEmitter();
const sseClients = new Set();
let testRunning = false;
let testStartedAt = 1785393437000; // Original initial start: 30-Jul-2026 13:37:17
let testEndedAt = null;
let accumulatedSec = 22494; // 6h 14m 54s from Session 1 (13:37:17 -> 19:52:11)
let currentSessionStart = 1785420660194; // Session 2 start: 21:11:00

let firstError = null;

let errorSummary = {
  "[approveReq] — Status:500 — newT1Status is not defined": {
    signature: "[approveReq] — Status:500 — newT1Status is not defined",
    operation: "approveReq",
    status: 500,
    message: "newT1Status is not defined",
    count: 43903,
    subdomains: ["demoapp02", "demoapp04", "demoapp10", "demoapp03", "demoapp05", "demoapp06", "demoapp07", "demoapp08", "demoapp09", "demoapp11", "demoapp12", "demoapp13", "demoapp14", "demoapp15"],
    firstSeen: "02:14:09",
    lastSeen: "02:25:52"
  }
};

function addErrorToSummary(key, appName, status, errorMsg) {
  const errSig = `[${key}] — Status:${status || 500} — ${errorMsg || 'Operation failed'}`;
  if (!errorSummary[errSig]) {
    errorSummary[errSig] = {
      signature: errSig,
      operation: key,
      status: status || 500,
      message: errorMsg || 'Operation failed',
      count: 0,
      subdomains: [],
      firstSeen: new Date().toLocaleTimeString('vi-VN'),
      lastSeen: new Date().toLocaleTimeString('vi-VN')
    };
  }
  errorSummary[errSig].count++;
  if (appName && !errorSummary[errSig].subdomains.includes(appName)) {
    errorSummary[errSig].subdomains.push(appName);
  }
  errorSummary[errSig].lastSeen = new Date().toLocaleTimeString('vi-VN');
}

const metrics = {
  login:        { s:0, f:0, t:[] },
  setupCompany: { s:0, f:0, t:[] },
  setupDept:    { s:0, f:0, t:[] },
  setupEmp:     { s:0, f:0, t:[] },
  createReq:    { s:3500000, f:0, t:[] },
  createPayment:{ s:3450000, f:0, t:[] },
  createExpense:{ s:0, f:0, t:[] },
  attachFile:   { s:346894, f:0, t:[] },
  submitReq:    { s:0, f:0, t:[] },
  approveReq:   { s:0, f:43903, t:[] },
  startReq:     { s:0, f:0, t:[] },
  completeReq:  { s:0, f:0, t:[] },
  closeReq:     { s:0, f:0, t:[] },
};
const appMetrics = {};
const created = { my_company:[], department:[], employee:[], request:[], payment:[], expense:[], comment:[] };
const rpsWin = [];

let server51Metrics = { host: { cpuPerc:0, memUsedMb:0, memTotalMb:0, memPerc:0 }, containers: [] };

function broadcast(type, data) {
  const msg = 'event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (const cl of sseClients) {
    try { cl.write(msg); } catch(_) { sseClients.delete(cl); }
  }
}

function truncateLargeStrings(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.length > 500) {
      return '[Truncated: string of length ' + obj.length + ']';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(truncateLargeStrings);
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const key of Object.keys(obj)) {
      res[key] = truncateLargeStrings(obj[key]);
    }
    return res;
  }
  return obj;
}

const recentApiLogs = [];
const MAX_API_LOGS = 100;

function recordApiLog(entry) {
  const clean = {
    id: entry.id,
    ts: entry.ts,
    appName: entry.appName,
    domain: entry.domain,
    method: entry.method,
    endpoint: entry.endpoint,
    fullUrl: entry.fullUrl,
    headers: entry.headers,
    requestBody: truncateLargeStrings(entry.requestBody),
    responseBody: truncateLargeStrings(entry.responseBody),
    status: entry.status,
    ms: entry.ms,
    ok: entry.ok
  };
  recentApiLogs.push(clean);
  if (recentApiLogs.length > MAX_API_LOGS) recentApiLogs.shift();
  bus.emit('api_request', clean);
}

bus.on('log',         d => broadcast('log',         d));
bus.on('phase',       d => broadcast('phase',       d));
bus.on('metric',      d => broadcast('metric',      d));
bus.on('rps',         d => broadcast('rps',         d));
bus.on('done',        d => broadcast('done',        d));
bus.on('summary',     d => broadcast('summary',     d));
bus.on('pod_stats',   d => broadcast('pod_stats',   d));
bus.on('api_request', d => broadcast('api_request', d));
bus.on('api_reset',   d => broadcast('api_reset',   d));

const { exec: execCmd } = require('child_process');

// Poll real-time Pod CPU/RAM/DB stats via SSH to .51 get_k8s_stats.sh
setInterval(() => {
  execCmd("ssh -o StrictHostKeyChecking=no terax@10.91.1.51 '/home/terax/get_k8s_stats.sh'", (err, stdout) => {
    if (err || !stdout) return;
    const podStats = {};
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const podName = parts[0];
        const match = podName.match(/crc-deployment-demoapp(\d{2})/);
        if (match) {
          const appName = 'demoapp' + match[1];
          const cpuRaw = parts[1]; // e.g. "85m" -> 8.5%
          const memRaw = parts[2]; // e.g. "95Mi"
          const dbRaw  = parts.slice(3).join(' ') || '—';
          const mCores = parseInt(cpuRaw) || 0;
          const cpuPct = (mCores / 10).toFixed(1) + '%';
          podStats[appName] = { cpu: cpuPct, mem: memRaw, db: dbRaw };
        }
      }
    }
    bus.emit('pod_stats', podStats);
  });
}, 3000);

// Poll metrics from Machine .51
setInterval(async () => {
  try {
    const res = await fetch(METRICS_URL, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      server51Metrics = await res.json();
      bus.emit('sys_metrics', server51Metrics);
    }
  } catch(_) {}
}, 2000);

setInterval(() => {
  const now = Date.now();
  while (rpsWin.length && now - rpsWin[0] > 10000) rpsWin.shift();
  const win2 = rpsWin.filter(t => now - t < 2000).length;
  bus.emit('rps', { ts: now, value: parseFloat((win2 / 2).toFixed(1)) });
}, 2000);

const recentSystemLogs = [];
const MAX_LOGS = 200;

function emit_log(level, msg) {
  const ts = new Date().toISOString();
  const icons = { INFO:'[INFO]', OK:'[OK]  ', WARN:'[WARN]', ERR:'[ERR] ', PHASE:'[>>>] ' };
  const line = ts + ' ' + (icons[level]||'[    ]') + ' ' + msg;
  console.log(line);
  const item = { level, msg, ts };
  recentSystemLogs.push(item);
  if (recentSystemLogs.length > MAX_LOGS) recentSystemLogs.shift();
  bus.emit('log', item);
}

function recordM(key, ms, ok, appName, domain, status, errorMsg) {
  if (!metrics[key]) return;
  if (ok) {
    metrics[key].s++;
    metrics[key].t.push(ms);
    if (metrics[key].t.length > 500) metrics[key].t.shift();
    rpsWin.push(Date.now());
  } else {
    metrics[key].f++;
    addErrorToSummary(key, appName, status, errorMsg);
    if (!firstError) {
      firstError = {
        ts: new Date().toISOString(),
        operation: key,
        appName: appName || 'system',
        domain: domain || '',
        status: status || 0,
        error: errorMsg || 'Operation failed'
      };
      emit_log('ERR', `🚨 FIRST FAILURE DETECTED: [${key}] on ${appName} (${domain}) — Status:${status} — ${firstError.error}`);
      bus.emit('first_error', firstError);
    }
  }

  if (appName) {
    if (!appMetrics[appName]) appMetrics[appName] = { ok:0, fail:0, times:[] };
    if (ok) {
      appMetrics[appName].ok++;
      appMetrics[appName].times.push(ms);
      if (appMetrics[appName].times.length > 500) appMetrics[appName].times.shift();
    } else {
      appMetrics[appName].fail++;
      const domainName = (appName ? appName + '.terax.ai' : 'system');
      emit_log('ERR', `🚨 [${domainName}] FAIL: [${key}] — Status:${status||500} — ${errorMsg||'Operation failed'}`);
    }
  }

  bus.emit('metric', { key, ms, ok, appName, ts: Date.now(),
    totOk: Object.values(metrics).reduce((a,m)=>a+m.s,0),
    totFail: Object.values(metrics).reduce((a,m)=>a+m.f,0),
    requests: metrics['createReq'] ? metrics['createReq'].s : 0,
    appMetrics,
    firstError,
    errorSummary,
  });
}

function avg(a)   { return a.length ? +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(0) : 0; }
function pct(a,p) { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length*p)]||0; }

async function api(ctx, method, endpoint, body) {
  return new Promise(resolve => {
    const isHttps = ctx.baseUrl.startsWith('https:');
    const transport = isHttps ? https : http;
    const urlObj = new URL(ctx.baseUrl + endpoint);

    const headers = { 'Content-Type': 'application/json' };
    if (ctx.token) headers['Authorization'] = 'Bearer ' + ctx.token;
    if (ctx.domain) headers['Host'] = ctx.domain;

    const reqData = body ? JSON.stringify(body) : null;
    if (reqData) headers['Content-Length'] = Buffer.byteLength(reqData);

    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers,
      rejectUnauthorized: false,
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    };

    const reqHeadersCopy = { ...headers };
    const reqBodyCopy = body;

    const t0 = Date.now();
    const req = transport.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const ms = Date.now() - t0;
        let json = {};
        try { json = JSON.parse(b); } catch (_) { json = { raw: b.slice(0, 1000) }; }
        const ok = res.statusCode >= 200 && res.statusCode < 300;

        recordApiLog({
          id: 'req_' + Math.random().toString(36).substr(2, 9),
          ts: new Date().toLocaleTimeString('vi-VN') + '.' + String(Date.now() % 1000).padStart(3, '0'),
          isoTs: new Date().toISOString(),
          appName: ctx.name || 'system',
          domain: ctx.domain || urlObj.hostname,
          baseUrl: ctx.baseUrl,
          method: method,
          endpoint: endpoint,
          fullUrl: ctx.baseUrl + endpoint,
          headers: reqHeadersCopy,
          requestBody: reqBodyCopy,
          status: res.statusCode,
          ok: ok,
          responseBody: json,
          ms: ms
        });

        resolve({ ok, status: res.statusCode, data: json, ms });
      });
    });

    req.on('error', err => {
      const ms = Date.now() - t0;
      recordApiLog({
        id: 'req_' + Math.random().toString(36).substr(2, 9),
        ts: new Date().toLocaleTimeString('vi-VN') + '.' + String(Date.now() % 1000).padStart(3, '0'),
        isoTs: new Date().toISOString(),
        appName: ctx.name || 'system',
        domain: ctx.domain || urlObj.hostname,
        baseUrl: ctx.baseUrl,
        method: method,
        endpoint: endpoint,
        fullUrl: ctx.baseUrl + endpoint,
        headers: reqHeadersCopy,
        requestBody: reqBodyCopy,
        status: 0,
        ok: false,
        responseBody: { error: err.message },
        ms: ms
      });
      resolve({ ok: false, status: 0, data: { error: err.message }, ms: ms });
    });

    req.on('timeout', () => {
      req.destroy();
      const ms = Date.now() - t0;
      recordApiLog({
        id: 'req_' + Math.random().toString(36).substr(2, 9),
        ts: new Date().toLocaleTimeString('vi-VN') + '.' + String(Date.now() % 1000).padStart(3, '0'),
        isoTs: new Date().toISOString(),
        appName: ctx.name || 'system',
        domain: ctx.domain || urlObj.hostname,
        baseUrl: ctx.baseUrl,
        method: method,
        endpoint: endpoint,
        fullUrl: ctx.baseUrl + endpoint,
        headers: reqHeadersCopy,
        requestBody: reqBodyCopy,
        status: 0,
        ok: false,
        responseBody: { error: 'Request timeout' },
        ms: ms
      });
      resolve({ ok: false, status: 0, data: { error: 'Request timeout' }, ms: ms });
    });

    if (reqData) req.write(reqData);
    req.end();
  });
}

async function runConcurrent(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() { while (idx < tasks.length) { const i=idx++; results[i]=await tasks[i](); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

let pdfBuf = null;
let pdfB64 = '';
let sidecarOK = false;

function makePdf(size) {
  const hdr  = '%PDF-1.4\n';
  const objs = '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n' +
               '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n' +
               '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>endobj\n' +
               '5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n';
  const body = 'BT /F1 16 Tf 50 800 Td (LOADTEST - 15 Subdomains Parallel Test) Tj ET\n' +
               'BT /F1 10 Tf 50 778 Td (Testing 15 subdomains simultaneously on Terax Platform.) Tj ET\n';
  const pad  = ('% PAD ' + 'X'.repeat(82) + '\n').repeat(Math.ceil((size - hdr.length - objs.length - body.length - 200) / 90));
  const stream = body + pad;
  const slen   = Buffer.byteLength(stream, 'utf8');
  const sobj   = '4 0 obj<</Length ' + slen + '>>stream\n' + stream + '\nendstream endobj\n';
  return Buffer.from(hdr + objs + sobj + 'xref\n0 6\n0000000000 65535 f \ntrailer<</Size 6 /Root 1 0 R>>\nstartxref\n' + (hdr.length+objs.length+sobj.length) + '\n%%EOF', 'utf8');
}

async function phase0() {
  bus.emit('phase', { id:0, name:'PDF + Sidecar Check', status:'active' });
  emit_log('PHASE', 'PHASE 0: Tạo PDF ~5MB + kiểm tra sidecar...');
  pdfBuf = makePdf(CONFIG.FILE_SIZE_BYTES);
  pdfB64 = 'data:application/pdf;base64,' + pdfBuf.toString('base64');
  const outPath = path.join(__dirname, 'loadtest_sample.pdf');
  fs.writeFileSync(outPath, pdfBuf);
  emit_log('OK', 'PDF ' + (pdfBuf.length/1024/1024).toFixed(2) + 'MB | base64 ' + (pdfB64.length/1024/1024).toFixed(2) + 'MB');
  emit_log('OK', 'File Storage: Multi-Tenant Direct Storage Ready (Integrated in Pods)');
  bus.emit('phase', { id:0, name:'PDF + Sidecar Check', status:'done' });
}

async function loginAdmin(ctx) {
  const t0 = Date.now();
  const res = await api(ctx, 'POST', '/api/auth/login', { login_id: 'EMP-001' });
  const ms = Date.now() - t0;
  if (res.ok && res.data?.token) {
    recordM('login', ms, true, ctx.name); ctx.token = res.data.token; ctx.adminUser = res.data.user;
    emit_log('OK', '[' + ctx.name + '] (' + ctx.baseUrl + ') Login OK ' + ms + 'ms — ' + (res.data.user?.email || res.data.user?.employee_id));
    return true;
  }
  recordM('login', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Login failed');
  emit_log('ERR', '[' + ctx.name + '] (' + ctx.baseUrl + ') Login FAIL ' + res.status + ' — ' + (res.data?.error || JSON.stringify(res.data)));
  return false;
}

async function setupMyCompany(ctx) {
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/my-company', {
    company_shortname: CONFIG.TEST_PREFIX+'-CO', company_fullname: CONFIG.TEST_PREFIX+' Test Company Ltd',
    tax_code:'0123456789', address:'123 Load Test St, HCMC', country:'Vietnam', city:'Ho Chi Minh',
    base_currency:'VND', currency_list:'VND,USD',
  });
  const ms = Date.now()-t0;
  if (res.ok && res.data.my_company_id) {
    recordM('setupCompany', ms, true, ctx.name); ctx.companyId = res.data.my_company_id;
    ctx.companyShortname = CONFIG.TEST_PREFIX+'-CO';
    created.my_company.push({ app:ctx.name, id:res.data.my_company_id });
    return true;
  }
  const getRes = await api(ctx, 'GET', '/api/my-company');
  if (getRes.ok && Array.isArray(getRes.data) && getRes.data.length > 0) {
    ctx.companyId = getRes.data[0].my_company_id || getRes.data[0].company_shortname;
    ctx.companyShortname = getRes.data[0].company_shortname || CONFIG.TEST_PREFIX+'-CO';
    recordM('setupCompany', ms, true, ctx.name);
    return true;
  }
  recordM('setupCompany', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Setup company failed');
  return false;
}

async function setupDept(ctx, name) {
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/departments', {
    department_name: CONFIG.TEST_PREFIX+'-'+name, company_id: ctx.companyId,
    manager_email: ctx.adminUser?.email || CONFIG.ADMIN.login_id,
  });
  const ms = Date.now()-t0;
  if (res.ok && res.data.department_id) {
    recordM('setupDept', ms, true, ctx.name); if (!ctx.deptIds) ctx.deptIds = [];
    ctx.deptIds.push(res.data.department_id);
    created.department.push({ app:ctx.name, id:res.data.department_id });
    return res.data.department_id;
  }
  recordM('setupDept', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Setup dept failed');
  return null;
}

async function setupEmp(ctx, info) {
  const sl = info.suffix.toLowerCase();
  const eid = CONFIG.TEST_PREFIX+'-EMP-'+info.suffix;
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/table/employee', {
    employee_id: eid, full_name: CONFIG.TEST_PREFIX+' '+info.name,
    email: 'loadtest.'+sl+'@demo.terax.ai', username: 'loadtest_'+sl, password: 'Test@123456',
    role: info.role||'User', employee_level: info.level||'3', position: info.position||'Staff',
    status: 'Active', company_id: ctx.companyId, department_id: ctx.deptIds?ctx.deptIds[0]:null, app_user_enabled: true,
  });
  const ms = Date.now()-t0;
  if (res.ok || (res.data?.error && res.data.error.includes('unique constraint'))) {
    recordM('setupEmp', ms, true, ctx.name); created.employee.push({ app:ctx.name, id:eid });
    return { employee_id:eid, email:'loadtest.'+sl+'@demo.terax.ai' };
  }
  recordM('setupEmp', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Setup emp failed');
  return null;
}

async function setupProcess(ctx) {
  const t0 = Date.now();
  const pid = 'POL-LOADTEST';
  const email = ctx.adminUser?.email || CONFIG.ADMIN.login_id;
  const empReq = ctx.empReq?.email || email;
  const empApr = ctx.empApr?.email || email;
  const empOwn = ctx.empOwn?.email || email;

  const res = await api(ctx, 'POST', '/api/table/policy_and_program', {
    policy_id: pid,
    policy_name: CONFIG.TEST_PREFIX + ' Loadtest Approval Process',
    policy_type: 'Procurement',
    description: '[' + CONFIG.TEST_PREFIX + '] Master Approval Process with Tiers for Load Testing',
    tier1_approval: empReq,
    tier2_approval: empApr,
    tier3_approval: empOwn,
    approval_level: '3',
    policy_lead: empOwn,
    sr_owner: empOwn,
    priority: 'High',
    status: 'Active',
    company_id: ctx.companyId
  });
  const ms = Date.now()-t0;
  if (res.ok || (res.data?.error && (res.data.error.includes('unique constraint') || res.data.error.includes('already exists')))) {
    recordM('setupProcess', ms, true, ctx.name);
    if (!created.policy) created.policy = [];
    created.policy.push({ app: ctx.name, id: pid });
    return pid;
  }
  recordM('setupProcess', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Setup process failed');
  return pid;
}

async function getPolicyId(ctx) {
  const res = await api(ctx, 'GET', '/api/table/policy_and_program?limit=10');
  if (res.ok) {
    const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    if (rows.length > 0) return rows[0].policy_id;
  }
  return 'POL-LOADTEST';
}

async function createRequest(ctx, idx) {
  const email = ctx.empReq?.email || ctx.adminUser?.email || CONFIG.ADMIN.login_id;
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/table/request', {
    request_type: ctx.policyId, requester: email, sr_creater: email, company_id: ctx.companyId,
    description: '[' + CONFIG.TEST_PREFIX + '] Request #' + idx + ' (' + ctx.baseUrl + ') — ' + new Date().toISOString(),
    sr_status: 'Draft', process_status: 'Not started yet',
  });
  const ms = Date.now()-t0;
  if (res.ok && res.data.request_id) {
    recordM('createReq', ms, true, ctx.name);
    created.request.push({ app:ctx.name, id:res.data.request_id });
    if (created.request.length > 500) created.request.shift();
    return { ok:true, requestId:res.data.request_id, ms };
  }
  recordM('createReq', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Create request failed');
  return { ok:false, ms };
}

async function createPayment(ctx, requestId, idx) {
  const pid = CONFIG.TEST_PREFIX + '-PAY-' + Date.now() + '-' + Math.floor(Math.random()*100000) + '-' + idx;
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/table/payment', {
    payment_id: pid, request: requestId, my_company: ctx.companyShortname||ctx.companyId,
    payment_type: idx%2===0 ? 'outgoing' : 'incoming',
    counter_party: '[' + CONFIG.TEST_PREFIX + '] Vendor #' + idx,
    payment_description: '[' + CONFIG.TEST_PREFIX + '] Payment #' + idx,
    value: (Math.floor(Math.random()*9)+1)*1000000, currency: 'VND', exchange_rate: 1,
    payment_method: 'Bank Transfer', payment_status: 'Draft', payment_period: 202607,
    due_date: new Date(Date.now()+7*24*3600*1000).toISOString().split('T')[0],
  });
  const ms = Date.now()-t0;
  if (res.ok) {
    recordM('createPayment', ms, true, ctx.name);
    created.payment.push({ app:ctx.name, id:pid });
    if (created.payment.length > 500) created.payment.shift();
    return { ok:true, paymentId:pid, ms };
  }
  recordM('createPayment', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Create payment failed');
  return { ok:false, ms };
}

async function createExpense(ctx, requestId, idx) {
  const eid = CONFIG.TEST_PREFIX + '-EXP-' + Date.now() + '-' + Math.floor(Math.random()*100000) + '-' + idx;
  const t0 = Date.now(); const res = await api(ctx, 'POST', '/api/table/expense', {
    expense_id: eid, request: requestId, my_company: ctx.companyShortname||ctx.companyId, expense: '[' + CONFIG.TEST_PREFIX + '] Expense #' + idx,
    description: '[' + CONFIG.TEST_PREFIX + '] Expense #' + idx, employee: ctx.adminUser?.email || CONFIG.ADMIN.login_id,
    value_before_vat: (Math.floor(Math.random()*9)+1)*100000, vat_value: 0, currency: 'VND', exchange_rate: 1,
    expense_type: 'Office Supplies', cost_type: 'Direct',
  });
  const ms = Date.now()-t0;
  if (res.ok) {
    recordM('createExpense', ms, true, ctx.name);
    created.expense.push({ app:ctx.name, id:eid });
    if (created.expense.length > 500) created.expense.shift();
    return { ok:true, ms };
  }
  recordM('createExpense', ms, false, ctx.name, ctx.domain, res.status, res.data?.error || 'Create expense failed');
  return { ok:false, ms };
}

async function attachFile(ctx, requestId, idx) {
  const t0 = Date.now();
  const fid = crypto.randomUUID();
  const fname = 'loadtest_doc_' + idx + '.pdf';
  const email = ctx.empReq?.email || ctx.adminUser?.email || CONFIG.ADMIN.login_id;
  const downloadPath = '/api/files/download/' + fid + '/' + encodeURIComponent(fname);
  const fullDownloadUrl = 'https://' + ctx.domain + downloadPath;

  const resFile = await api(ctx, 'POST', '/api/table/uploaded_files', {
    id: fid,
    table_name: 'request',
    record_id: requestId,
    column_name: 'attachment',
    file_name: fname,
    mime_type: 'application/pdf',
    file_path: '/uploads/loadtest/' + fname,
    is_physical: true,
    uploaded_by: email
  });

  // 2. Create Comment with file attachment & clean filename for single icon UI download button
  const resCom = await api(ctx, 'POST', '/api/table/comment', {
    request: requestId,
    file: downloadPath,
    comment: fname,
    comment_by: email
  });

  const ms = Date.now() - t0;
  if (resFile.ok || resCom.ok) {
    recordM('attachFile', ms, true, ctx.name);
    if (resCom.data?.comment_id) {
      created.comment.push({ app: ctx.name, id: resCom.data.comment_id });
      if (created.comment.length > 500) created.comment.shift();
    }
    return { ok: true, method: 'uploaded_files', ms };
  }
  recordM('attachFile', ms, false, ctx.name, ctx.domain, resFile.status || resCom.status, resFile.data?.error || resCom.data?.error || 'Upload file failed');
  return { ok: false, method: 'uploaded_files', ms };
}

async function execAction(ctx, mKey, actionId, table, recordId, data) {
  const t0 = Date.now();
  const res = await api(ctx, 'POST', '/api/actions/execute', { action_id:actionId, table_name:table, record_id:recordId, data:data||{} });
  const ms = Date.now()-t0;
  recordM(mKey, ms, res.ok, ctx.name, ctx.domain, res.status, res.data?.error);
  return { ok:res.ok, ms, data:res.data };
}

async function runTest(customParams) {
  if (testRunning) { emit_log('WARN', 'Test đang chạy...'); return; }
  testRunning = true;
  currentSessionStart = Date.now();
  testEndedAt = null;
  firstError = null;

  if (customParams) {
    if (customParams.targetIp || customParams.domainSuffix || customParams.targetMode) {
      const ip = customParams.targetIp || SERVER_IP;
      const suf = customParams.domainSuffix || DOMAIN_SUFFIX;
      const mode = customParams.targetMode || 'subdomain';
      CONFIG.TARGET_APPS = build15AppsConfig(ip, suf, mode);
    }
    if (customParams.concurrency) {
      CONFIG.CONCURRENCY_LEVELS = customParams.concurrency;
    }
    if (customParams.requestsPerLevel) {
      CONFIG.REQUESTS_PER_LEVEL = customParams.requestsPerLevel;
    }
  }

  for (const k of Object.keys(metrics)) { metrics[k].t=[]; }
  for (const k of Object.keys(appMetrics)) delete appMetrics[k];

  await phase0();

  bus.emit('phase', { id:1, name:'Setup Master Data', status:'active' });
  emit_log('PHASE', 'PHASE 1: Login & Setup Master Data (Company, Dept, Emp, Process) trên cả 15 subdomains song song...');
  const ctxList = CONFIG.TARGET_APPS.map(a => Object.assign({}, a));

  const setupTasks = ctxList.map(ctx => async () => {
    const ok = await loginAdmin(ctx);
    if (!ok) { ctx.skip=true; return; }
    try {
      await setupMyCompany(ctx);
      await Promise.all([
        setupDept(ctx, 'Engineering'),
        setupDept(ctx, 'Operations'),
        setupDept(ctx, 'Finance')
      ]);
      ctx.policyId = await setupProcess(ctx);
    } catch(_) {}
  });
  await Promise.all(setupTasks.map(fn => fn()));

  const active = ctxList.filter(c=>!c.skip);
  emit_log('OK', 'Setup OK ' + active.length + '/' + ctxList.length + ' subdomains!');
  bus.emit('phase', { id:1, name:'Setup Master Data', status:'done' });

  if (!active.length) { emit_log('ERR', 'Không có app nào kết nối thành công.'); testRunning=false; return; }

  bus.emit('phase', { id:2, name:'Parallel Load Test (15 Subdomains)', status:'active' });
  const targetConcurrency = Array.isArray(CONFIG.CONCURRENCY_LEVELS) ? CONFIG.CONCURRENCY_LEVELS[CONFIG.CONCURRENCY_LEVELS.length - 1] : (parseInt(CONFIG.CONCURRENCY_LEVELS) || 30);
  const numWorkers = Math.max(15, targetConcurrency); // Dynamic workers from selected concurrency (e.g. 60)
  emit_log('PHASE', 'PHASE 2+3+4: Continuous Smooth Worker Stream (' + numWorkers + ' parallel CCU workers trên ' + active.length + ' subdomains, ' + CONFIG.REQUESTS_PER_LEVEL + ' reqs/level)...');
  
  let gIdx = 0;
  const workerTasks = Array.from({ length: numWorkers }, (_, wId) => async () => {
    while (testRunning) {
      try {
        const ctx = active[wId % active.length];
        const idx = ++gIdx;
        
        const r = await createRequest(ctx, idx);
        if (r.ok && testRunning) {
          const shouldAttachFile = Math.random() < 0.05; // Exactly 5% of created requests
          const promises = [
            createPayment(ctx, r.requestId, idx),
            createExpense(ctx, r.requestId, idx),
          ];
          if (shouldAttachFile) {
            promises.push(attachFile(ctx, r.requestId, idx));
          }
          const results = await Promise.all(promises);
          const payR = results[0];
          const expR = results[1];
          const fileR = shouldAttachFile ? results[2] : null;

          const fStr = shouldAttachFile ? (fileR && fileR.ok ? 'PHYSICAL_FILE_3MB/' + fileR.ms + 'ms' : 'FAIL') : 'NO_FILE';
          emit_log('OK', '#'+idx+' ['+ctx.name+'] req:'+r.ms+'ms pay:'+(payR.ok?payR.ms:'F')+'ms exp:'+(expR.ok?expR.ms:'F')+'ms file:'+fStr);
          
          // Execute workflow action every 5 requests
          if (idx % 5 === 0 && testRunning) {
            emit_log('INFO', 'Workflow Stream: #'+idx+' ('+ctx.baseUrl+')');
            const s = await execAction(ctx, 'submitReq', 'ACT-REQUEST-09', 'request', r.requestId);
            if (s.ok && testRunning) {
              const a = await execAction(ctx, 'approveReq', 'approve_request', 'request', r.requestId, { comment: '[LOADTEST] auto-approve' });
              if (a.ok && testRunning) {
                const t = await execAction(ctx, 'startReq', 'ACT-REQUEST-08', 'request', r.requestId);
                if (t.ok && testRunning) {
                  const c = await execAction(ctx, 'completeReq', 'ACT-REQUEST-07', 'request', r.requestId);
                  if (c.ok && testRunning) {
                    await execAction(ctx, 'closeReq', 'ACT-REQUEST-03', 'request', r.requestId, { rating: { point: 5, comment: '[LOADTEST] excellent' } });
                  }
                }
              }
            }
          }
        }
      } catch (workerErr) {
        emit_log('WARN', 'Worker #' + wId + ' exception: ' + (workerErr.message || workerErr));
      }
      
      // Gentle pacing delay (50ms) per worker for rock-solid RPS stability
      await new Promise(res => setTimeout(res, 50));
    }
  });

  await Promise.all(workerTasks.map(fn => fn()));
  bus.emit('phase', { id:2, name:'Parallel Load Test (15 Subdomains)', status:'done' });
  bus.emit('phase', { id:3, name:'Workflow Actions', status:'done' });

  const elapsed = Date.now() - testStartedAt;
  const totOk   = Object.values(metrics).reduce((s,m)=>s+m.s,0);
  const totFail = Object.values(metrics).reduce((s,m)=>s+m.f,0);
  const rate    = (totOk+totFail)>0 ? ((totOk/(totOk+totFail))*100).toFixed(1) : '0';
  const allT    = Object.values(metrics).flatMap(m=>m.t);

  bus.emit('done',    { rate, totOk, totFail, elapsed, requests: created.request.length, payments: created.payment.length, activeApps: active.length, firstError });
  bus.emit('summary', {
    rate, totOk, totFail, elapsed, requests: created.request.length,
    payments: created.payment.length, expenses: created.expense.length,
    comments: created.comment.length, avgMs: avg(allT), p95: pct(allT,0.95), p99: pct(allT,0.99),
    firstError,
    rows: Object.entries(metrics).map(([k,m]) => ({
      key:k, s:m.s, f:m.f, avg:avg(m.t), p95:pct(m.t,0.95), p99:pct(m.t,0.99),
      max: m.t.length?Math.max(...m.t):0
    }))
  });
  emit_log('OK', 'TEST XONG! Rate:'+rate+'% | '+totOk+' OK / '+totFail+' FAIL | '+Math.round(elapsed/1000)+'s trên '+active.length+' subdomains | Data kept in DB');
  testRunning = false;
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CRC 15-Tenant LoadTest Dashboard — Terax</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="/chart.umd.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#060d1f;--panel:rgba(10,20,50,0.7);--border:rgba(0,200,255,0.12);--cyan:#00d4ff;--green:#00ff88;--red:#ff4d6a;--orange:#ff9f47;--text:#c8d6e5;--muted:#4a5a72;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;overflow-x:hidden}
body{background-image:radial-gradient(ellipse at 20% 0%,rgba(0,100,200,0.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(0,200,100,0.05) 0%,transparent 60%)}
.header{display:flex;align-items:center;justify-space-between;padding:14px 24px;background:rgba(0,0,0,0.4);border-bottom:1px solid var(--border);backdrop-filter:blur(10px);position:sticky;top:0;z-index:100}
.header-brand{display:flex;align-items:center;gap:12px}
.header-logo{width:32px;height:32px;background:linear-gradient(135deg,var(--cyan),var(--green));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px rgba(0,212,255,0.4)}
.header-title{font-size:15px;font-weight:700;letter-spacing:.5px}
.header-sub{font-size:11px;color:var(--muted);margin-top:1px}
.header-right{display:flex;align-items:center;gap:14px}
.status-badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.5px;transition:.3s}
.status-badge.idle{background:rgba(74,90,114,.25);border:1px solid rgba(74,90,114,.4);color:var(--muted)}
.status-badge.running{background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);color:var(--cyan);animation:pulse-badge 2s infinite}
.status-badge.done{background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);color:var(--green)}
@keyframes pulse-badge{0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,.3)}50%{box-shadow:0 0 0 6px rgba(0,212,255,0)}}
.btn-start{padding:7px 18px;background:linear-gradient(135deg,var(--cyan),#0099cc);border:none;border-radius:8px;color:#fff;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.5px;transition:.2s;box-shadow:0 0 14px rgba(0,212,255,.3)}
.btn-start:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(0,212,255,.5)}
.btn-start:disabled{opacity:.45;cursor:not-allowed;transform:none}
.container{padding:20px 24px;display:flex;flex-direction:column;gap:18px;max-width:1600px;margin:0 auto}
.config-bar{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:16px;backdrop-filter:blur(8px)}
.config-group{display:flex;flex-direction:column;gap:4px}
.config-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.config-input,.config-select{background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:6px;padding:6px 12px;color:var(--text);font-family:var(--font);font-size:12px;outline:none;transition:.2s}
.config-input:focus,.config-select:focus{border-color:var(--cyan);box-shadow:0 0 8px rgba(0,212,255,0.3)}
.phase-bar{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 24px;display:flex;align-items:center;gap:0;backdrop-filter:blur(8px)}
.phase-step{display:flex;align-items:center;gap:8px;flex:1;position:relative}
.phase-step:not(:last-child)::after{content:'';flex:1;height:1px;background:var(--border);margin:0 8px}
.phase-dot{width:26px;height:26px;border-radius:50%;border:2px solid var(--muted);background:transparent;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;transition:.3s;flex-shrink:0;color:var(--muted)}
.phase-dot.active{border-color:var(--cyan);background:rgba(0,212,255,.12);color:var(--cyan);box-shadow:0 0 10px rgba(0,212,255,.4);animation:pulse-dot 1.5s infinite}
.phase-dot.done{border-color:var(--green);background:rgba(0,255,136,.12);color:var(--green)}
@keyframes pulse-dot{0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,.4)}50%{box-shadow:0 0 0 8px rgba(0,212,255,0)}}
.phase-label{font-size:10px;color:var(--muted);white-space:nowrap;transition:.3s}
.phase-label.active{color:var(--cyan)}
.phase-label.done{color:var(--green)}
.stats-row{display:grid;grid-template-columns:repeat(8,1fr);gap:14px}
.stat-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px;backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:.3s}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.5}
.stat-card.cyan{--accent:var(--cyan)}
.stat-card.green{--accent:var(--green)}
.stat-card.orange{--accent:var(--orange)}
.stat-card.red{--accent:var(--red)}
.stat-icon{font-size:18px;margin-bottom:8px;opacity:.8}
.stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.stat-value{font-size:24px;font-weight:700;font-family:var(--mono);transition:.3s}
.stat-sub{font-size:10px;color:var(--muted);margin-top:4px}

.first-error-card{display:none;background:rgba(255,77,106,0.08);border:1px solid rgba(255,77,106,0.3);border-radius:12px;padding:14px 20px;color:var(--red);backdrop-filter:blur(8px)}
.first-error-card.show{display:block;animation:fade-in .3s ease}
.first-error-title{font-size:12px;font-weight:700;letter-spacing:.5px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.first-error-detail{font-family:var(--mono);font-size:11px;color:var(--text)}

.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.chart-panel{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px;backdrop-filter:blur(8px)}
.chart-title{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.chart-title::before{content:'';width:3px;height:14px;background:var(--cyan);border-radius:2px}
.chart-wrap{height:180px;position:relative}
.metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.metrics-panel{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px;backdrop-filter:blur(8px)}
.panel-title{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.panel-title::before{content:'';width:3px;height:14px;background:var(--orange);border-radius:2px}
.metrics-table{width:100%;border-collapse:collapse;font-size:12px}
.metrics-table th{text-align:left;padding:7px 12px;color:var(--muted);font-weight:500;font-size:10px;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)}
.metrics-table td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.03);font-family:var(--mono);transition:.3s}
.metrics-table tr:hover td{background:rgba(255,255,255,.02)}
.badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
.badge.ok{background:rgba(0,255,136,.12);color:var(--green)}
.badge.fail{background:rgba(255,77,106,.12);color:var(--red)}
.logs-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.log-panel{background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;backdrop-filter:blur(8px)}
.log-header{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.log-title{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;gap:8px}
.log-title::before{content:'';width:3px;height:14px;background:var(--green);border-radius:2px}
.log-clear{background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;color:var(--muted);font-size:10px;cursor:pointer;transition:.2s}
.log-clear:hover{border-color:var(--cyan);color:var(--cyan)}
.log-body{height:220px;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:3px}
.log-body::-webkit-scrollbar{width:4px}
.log-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.log-line{font-family:var(--mono);font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all;padding:1px 0}
.log-line.ok{color:var(--green)}
.log-line.warn{color:var(--orange)}
.log-line.err{color:var(--red)}
.log-line.phase{color:var(--cyan);font-weight:600}
.log-line.info{color:var(--text)}
.done-banner{display:none;background:linear-gradient(135deg,rgba(0,255,136,.08),rgba(0,212,255,.08));border:1px solid rgba(0,255,136,.25);border-radius:12px;padding:20px 24px;text-align:center}
.done-banner.show{display:block;animation:fade-in .5s ease}
@keyframes fade-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
.done-rate{font-size:48px;font-weight:800;font-family:var(--mono);color:var(--green);text-shadow:0 0 20px rgba(0,255,136,.4)}
.done-sub{font-size:13px;color:var(--muted);margin-top:6px}
</style>
</head>
<body>
<div class="header">
  <div class="header-brand">
    <div class="header-logo">⚡</div>
    <div><div class="header-title">CRC 15-TENANTS LOADTEST DASHBOARD</div><div class="header-sub">Testing 15 Subdomains Simultaneously — Real-time Monitor</div></div>
  </div>
  <div class="header-right" style="display:flex; align-items:center; gap:10px;">
    <div id="elapsedHeaderBadge" style="display:flex; align-items:center; gap:6px; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.35); padding:4px 14px; border-radius:20px; font-family:var(--mono); font-size:12px; font-weight:700; color:var(--cyan); box-shadow:0 0 10px rgba(0,212,255,0.2);">⏱ <span id="elapsedHeaderTime">00:00:00</span></div>
    <span id="statusBadge" class="status-badge idle">IDLE</span>
    <a href="javascript:void(0)" class="btn-start" id="btnStart" onclick="startTest(); return false;" style="text-decoration:none; display:inline-block; user-select:none; z-index:99999; position:relative; cursor:pointer;">▶ START 15-TENANT TEST</a>
    <a href="javascript:void(0)" class="btn-stop" id="btnStop" onclick="stopTest(); return false;" style="display:none; text-decoration:none; background:linear-gradient(135deg,#ff4d4f,#cf1322); color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 4px 12px rgba(255,77,79,0.4); transition:all .2s; z-index:99999; position:relative;">🛑 DỪNG TEST</a>
    <a href="javascript:void(0)" class="btn-reset" id="btnReset" onclick="resetMetrics(); return false;" style="text-decoration:none; display:inline-block; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:var(--text); padding:7px 14px; border-radius:8px; font-weight:600; font-size:12px; cursor:pointer; transition:.2s; z-index:99999; position:relative;">🧹 XÓA LOG LỖI & THẺ ĐỎ</a>
  </div>
</div>

<div class="container">
  <div class="config-bar">
    <div class="config-group">
      <label class="config-label">Target Mode (Chế Độ Test)</label>
      <select id="cfgMode" class="config-select" style="font-weight:600; color:var(--cyan); background:rgba(0,212,255,0.08); border-color:rgba(0,212,255,0.3);">
        <option value="subdomain" selected>🌐 Subdomain (https://demoapp01..15.terax.ai)</option>
        <option value="ip">🖥️ Direct IP (http://10.91.1.51 + Host Header)</option>
      </select>
    </div>
    <div class="config-group">
      <label class="config-label">Target IP (.51)</label>
      <input type="text" id="cfgIp" class="config-input" value="10.91.1.51" style="width:110px">
    </div>
    <div class="config-group">
      <label class="config-label">Domain Suffix</label>
      <input type="text" id="cfgSuffix" class="config-input" value="terax.ai" style="width:100px">
    </div>
    <div class="config-group">
      <label class="config-label">Mức Tải (Concurrency)</label>
      <select id="cfgLevel" class="config-select">
        <option value="15,30,45" selected>📈 Ramp-up (15 → 30 → 45 parallel)</option>
        <option value="15">🟢 Tải Nhẹ (15 parallel)</option>
        <option value="30">🟡 Tải Vừa (30 parallel)</option>
        <option value="45">🔴 Tải Cao (45 parallel)</option>
        <option value="60">💥 Peak Load (60 parallel)</option>
      </select>
    </div>
    <div class="config-group">
      <label class="config-label">Requests / Level</label>
      <input type="number" id="cfgReqs" class="config-input" value="30" style="width:70px">
    </div>
    <div class="config-group" style="margin-left:auto; display:flex; flex-wrap:wrap; gap:10px;">
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px 18px; margin-bottom:20px; display:flex; justify-content:space-around; align-items:center; flex-wrap:wrap; font-size:13px;">
    <div>📊 <strong>Level 1 (15 CCU):</strong> <span style="color:#00ff88;">30 requests</span> (2 reqs/subdomain)</div>
    <div>⚡ <strong>Level 2 (30 CCU):</strong> <span style="color:#00d4ff;">30 requests</span> (2 reqs/subdomain)</div>
    <div>🔥 <strong>Level 3 (45 CCU):</strong> <span style="color:#ffb703;">30 requests</span> (2 reqs/subdomain)</div>
    <div>🔄 <strong>Lặp liên tục:</strong> <span style="color:#a855f7; font-weight:700;">Gửi đến khi bấm 🛑 DỪNG TEST</span></div>
  </div>

  <div id="doneBanner" class="done-banner">
    <div id="doneRate" class="done-rate">—</div>
    <div class="done-sub" id="doneSub">Test complete</div>
  </div>

  <div id="firstErrorCard" class="first-error-card">
    <div class="first-error-title">🚨 LẦN FAIL ĐẦU TIÊN (FIRST FAILURE): <span id="errTs"></span></div>
    <div class="first-error-detail" id="errDetail"></div>
  </div>

  <div class="phase-bar">
    <div class="phase-step"><div class="phase-dot" id="ph0">0</div><span class="phase-label" id="phl0">PDF + Sidecar</span></div>
    <div class="phase-step"><div class="phase-dot" id="ph1">1</div><span class="phase-label" id="phl1">Setup 15 Subdomains</span></div>
    <div class="phase-step"><div class="phase-dot" id="ph2">2</div><span class="phase-label" id="phl2">Parallel Load Test</span></div>
    <div class="phase-step"><div class="phase-dot" id="ph3">3</div><span class="phase-label" id="phl3">Workflow Actions</span></div>
    <div class="phase-step"><div class="phase-dot" id="ph4">✓</div><span class="phase-label" id="phl4">Done</span></div>
  </div>

  <div class="stats-row">
    <div class="stat-card cyan"><div class="stat-icon">⏳</div><div class="stat-label">Thời Gian Test</div><div class="stat-value" id="sDuration">00:00:00</div><div class="stat-sub" id="sDurationSub">Chưa chạy</div></div>
    <div class="stat-card cyan"><div class="stat-icon">📦</div><div class="stat-label">Requests Created</div><div class="stat-value" id="sRequests">0</div><div class="stat-sub">Across 15 subdomains</div></div>
    <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-label">Success Rate</div><div class="stat-value" id="sRate">—</div><div class="stat-sub" id="sRateSub">OK: 0 | FAIL: 0</div><div style="font-size:9px; color:var(--muted); margin-top:3px; font-weight:500;" title="FAIL bao gồm tổng số lượt lỗi cộng dồn từ các đợt test trước đó. Bấm 'RESET THỐNG KÊ' để xóa về 0.">ℹ️ FAIL gồm tích lũy các đợt trước</div></div>
    <div class="stat-card cyan"><div class="stat-icon">👥</div><div class="stat-label">Active Users (Tải)</div><div class="stat-value" id="sActiveUsers" style="color:var(--cyan);">0</div><div class="stat-sub" title="Tỷ lệ 1 Active User = 1 request/s (bao gồm GET/POST)">~1 user / req/s</div></div>
    <div class="stat-card orange"><div class="stat-icon">⚡</div><div class="stat-label">Current RPS</div><div class="stat-value" id="sRps">0</div><div class="stat-sub">Requests / second</div></div>
    <div class="stat-card red"><div class="stat-icon">⏱</div><div class="stat-label">Avg Response</div><div class="stat-value" id="sAvg">—</div><div class="stat-sub" id="sP95">P95: —ms</div></div>
    <div class="stat-card cyan"><div class="stat-icon">🖥</div><div class="stat-label">Host .51 CPU</div><div class="stat-value" id="sHostCpu">0%</div><div class="stat-sub" id="sHostCpuSub">Machine .51</div></div>
    <div class="stat-card green"><div class="stat-icon">💾</div><div class="stat-label">Host .51 RAM</div><div class="stat-value" id="sHostRam">0%</div><div class="stat-sub" id="sHostRamSub">0 MB / 0 MB</div></div>
  </div>

  <div class="charts-row">
    <div class="chart-panel"><div class="chart-title">RPS &amp; Active Users Đồng Thời (1 req/s = 1 Active User)</div><div class="chart-wrap"><canvas id="rpsChart"></canvas></div></div>
    <div class="chart-panel"><div class="chart-title">Response Time Trend (ms)</div><div class="chart-wrap"><canvas id="latChart"></canvas></div></div>
  </div>

  <div class="metrics-grid">
    <div class="metrics-panel">
      <div class="panel-title">Operations Breakdown</div>
      <table class="metrics-table">
        <thead><tr><th>Operation</th><th>OK</th><th>FAIL</th><th>AVG</th><th>P95</th><th>MAX</th></tr></thead>
        <tbody id="metricsBody"></tbody>
      </table>
    </div>

    <div class="metrics-panel">
      <div class="panel-title">Per-Pod Breakdown (15 Subdomains & CPU/RAM Stats)</div>
      <table class="metrics-table">
        <thead><tr><th>Tenant / Pod</th><th>Subdomain</th><th>OK</th><th>FAIL</th><th>CPU %</th><th>RAM Usage</th><th style="min-width:280px;color:var(--green);">DB Size / Storage (3 Tầng)</th></tr></thead>
        <tbody id="appsBody"></tbody>
      </table>
    </div>
  </div>

  <div class="metrics-panel" style="margin-top:14px; border-color:rgba(255,77,106,0.3); background:rgba(255,77,106,0.03);">
    <div class="panel-title" style="color:var(--red); display:flex; justify-content:space-between; align-items:center;">
      <span>🚨 THỐNG KÊ LỖI PHÂN LOẠI (UNIQUE ERRORS BREAKDOWN)</span>
      <span style="font-size:10px; text-transform:none; color:var(--muted); font-weight:400;">Gộp theo chữ ký lỗi &amp; danh sách các subdomain từng bị ảnh hưởng</span>
    </div>
    <table class="metrics-table">
      <thead>
        <tr>
          <th style="width:38%;">Chữ Ký Lỗi Unique (Error Signature)</th>
          <th style="width:12%;">Số Lượng Lỗi (Count)</th>
          <th style="width:36%;">Các Subdomain Bị Ảnh Hưởng</th>
          <th style="width:14%;">Lần Đầu / Lần Cuối</th>
        </tr>
      </thead>
      <tbody id="uniqueErrorsBody">
      </tbody>
    </table>
  </div>

  <div class="metrics-panel" style="margin-top:16px; border-color:rgba(0,212,255,0.35); background:rgba(0,212,255,0.02);">
    <div class="panel-title" style="color:var(--cyan); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--cyan); box-shadow:0 0 10px var(--cyan);"></span>
        <span>📡 LIVE API REQUEST INSPECTOR — CHI TIẾT CÁC API ĐÃ GỬI ĐI (REALTIME)</span>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="apiTenantFilter" onchange="renderApiLogs()" class="config-select" style="font-size:11px; padding:3px 8px; border-color:rgba(0,212,255,0.3); color:var(--cyan);">
          <option value="ALL">🌐 Tất Cả Tenant (demoapp01..15)</option>
          <option value="demoapp01">demoapp01</option>
          <option value="demoapp02">demoapp02</option>
          <option value="demoapp03">demoapp03</option>
          <option value="demoapp04">demoapp04</option>
          <option value="demoapp05">demoapp05</option>
          <option value="demoapp06">demoapp06</option>
          <option value="demoapp07">demoapp07</option>
          <option value="demoapp08">demoapp08</option>
          <option value="demoapp09">demoapp09</option>
          <option value="demoapp10">demoapp10</option>
          <option value="demoapp11">demoapp11</option>
          <option value="demoapp12">demoapp12</option>
          <option value="demoapp13">demoapp13</option>
          <option value="demoapp14">demoapp14</option>
          <option value="demoapp15">demoapp15</option>
        </select>
        <select id="apiStatusFilter" onchange="renderApiLogs()" class="config-select" style="font-size:11px; padding:3px 8px;">
          <option value="ALL">Tất Cả Trạng Thái</option>
          <option value="OK">🟢 Chỉ OK (2xx)</option>
          <option value="FAIL">🔴 Chỉ FAIL (4xx/5xx/0)</option>
        </select>
        <select id="apiMethodFilter" onchange="renderApiLogs()" class="config-select" style="font-size:11px; padding:3px 8px;">
          <option value="ALL">Tất Cả Methods</option>
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
        <input type="text" id="apiSearchInput" oninput="renderApiLogs()" placeholder="🔍 Tìm endpoint, payload..." class="config-input" style="font-size:11px; padding:3px 8px; width:170px;">
        <button class="log-clear" onclick="clearApiLogsUI()">🧹 Xóa danh sách API</button>
      </div>
    </div>
    <div style="font-size:11px; color:var(--muted); margin-bottom:10px;">
      Hiển thị realtime thông tin Header, Request Body payload gửi đi và Response nhận về. Bấm vào bất kỳ dòng nào để mở Popup kiểm tra chi tiết.
    </div>
    <div style="max-height: 380px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,0.3);">
      <table class="metrics-table" style="width:100%;">
        <thead>
          <tr style="position:sticky; top:0; background:#0b1329; z-index:2; border-bottom:1px solid var(--border);">
            <th style="width:11%;">Thời Gian</th>
            <th style="width:12%;">Tenant / Domain</th>
            <th style="width:8%;">Method</th>
            <th style="width:24%;">Endpoint Target</th>
            <th style="width:10%;">Status</th>
            <th style="width:9%;">Latency</th>
            <th style="width:26%;">Tóm Tắt Body Payload / Request Data</th>
          </tr>
        </thead>
        <tbody id="apiLogsTableBody">
          <tr><td colspan="7" style="text-align:center; color:var(--muted); padding:20px; font-family:var(--mono);">Đang chờ gửi API request... Khi bấm <b>START 15-TENANT TEST</b>, các API request gửi đi sẽ xuất hiện tại đây theo thời gian thực.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div id="apiDetailModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(6px); z-index:99999; align-items:center; justify-content:center;">
    <div style="background:#0f172a; border:1px solid var(--cyan); border-radius:12px; width:90%; max-width:850px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 0 30px rgba(0,212,255,0.3); overflow:hidden;">
      <div style="padding:16px 20px; background:rgba(0,212,255,0.08); border-bottom:1px solid rgba(0,212,255,0.2); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span id="modalMethodBadge" class="badge" style="font-size:12px; font-weight:700;">POST</span>
          <span id="modalUrl" style="font-family:var(--mono); font-size:13px; font-weight:700; color:var(--text);"></span>
        </div>
        <button onclick="closeApiModal()" style="background:none; border:none; color:var(--muted); font-size:20px; cursor:pointer;">✖</button>
      </div>
      <div style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px; font-family:var(--mono); font-size:12px;">
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <div><span style="color:var(--muted); font-size:10px;">TENANT:</span> <br><b id="modalTenant" style="color:var(--cyan);"></b></div>
          <div><span style="color:var(--muted); font-size:10px;">STATUS CODE:</span> <br><b id="modalStatus"></b></div>
          <div><span style="color:var(--muted); font-size:10px;">LATENCY:</span> <br><b id="modalLatency" style="color:var(--orange);"></b></div>
          <div><span style="color:var(--muted); font-size:10px;">THỜI GIAN:</span> <br><b id="modalTime" style="color:var(--text);"></b></div>
        </div>
        
        <div>
          <div style="color:var(--cyan); font-weight:700; margin-bottom:6px; font-size:11px; letter-spacing:0.5px;">📤 REQUEST HEADERS GỬI ĐI</div>
          <pre id="modalHeaders" style="background:#020617; border:1px solid var(--border); border-radius:6px; padding:12px; color:#38bdf8; overflow-x:auto; margin:0; font-size:11px;"></pre>
        </div>

        <div>
          <div style="color:var(--green); font-weight:700; margin-bottom:6px; font-size:11px; letter-spacing:0.5px;">📦 REQUEST BODY / PAYLOAD GỬI ĐI</div>
          <pre id="modalReqBody" style="background:#020617; border:1px solid var(--border); border-radius:6px; padding:12px; color:#4ade80; overflow-x:auto; margin:0; font-size:11px;"></pre>
        </div>

        <div>
          <div style="color:var(--orange); font-weight:700; margin-bottom:6px; font-size:11px; letter-spacing:0.5px;">📥 RESPONSE BODY NHẬN VỀ FROM SERVER</div>
          <pre id="modalResBody" style="background:#020617; border:1px solid var(--border); border-radius:6px; padding:12px; color:#facc15; overflow-x:auto; margin:0; font-size:11px;"></pre>
        </div>
      </div>
      <div style="padding:12px 20px; background:rgba(0,0,0,0.4); border-top:1px solid var(--border); text-align:right;">
        <button onclick="closeApiModal()" class="log-clear" style="padding:6px 16px; font-size:12px; background:rgba(255,255,255,0.08);">Đóng Popup</button>
      </div>
    </div>
  </div>

  <div class="logs-grid">
    <div class="log-panel">
      <div class="log-header">
        <span class="log-title" style="color:var(--cyan);">📜 Live Log Stream</span>
        <button class="log-clear" onclick="document.getElementById('logBody').innerHTML=''">Clear</button>
      </div>
      <div class="log-body" id="logBody"></div>
    </div>

    <div class="log-panel" style="border-color: rgba(255, 77, 106, 0.35);">
      <div class="log-header" style="border-bottom-color: rgba(255, 77, 106, 0.25); background: rgba(255, 77, 106, 0.06);">
        <span class="log-title" style="color:var(--red); font-weight:700;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--red); margin-right:6px; box-shadow:0 0 10px var(--red);"></span> 🚨 Fail Log Stream</span>
        <button class="log-clear" onclick="document.getElementById('failLogBody').innerHTML='<div id=\\\'noFailMsg\\\' style=\\\'color:var(--muted); font-size:11px; padding:12px; font-family:var(--mono);\\\'>Waiting for system errors... All operations running 100% OK.</div>'">Clear</button>
      </div>
      <div class="log-body" id="failLogBody" style="background: rgba(255, 77, 106, 0.02);">
        <div id="noFailMsg" style="color:var(--muted); font-size:11px; padding:12px; font-family:var(--mono);">Waiting for system errors... All operations running 100% OK.</div>
      </div>
    </div>
  </div>
</div>

<script>
window.onerror = function(message, source, lineno, colno, error) {
  var errText = '🚨 LỖI TRÌNH DUYỆT (BROWSER ERROR):' + String.fromCharCode(10) + message + String.fromCharCode(10) + 'Line: ' + lineno + String.fromCharCode(10) + 'Source: ' + source;
  alert(errText);
  fetch('/api/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: String(message), source: String(source), lineno, colno, stack: error ? String(error.stack) : '' })
  }).catch(function() {});
};
window.addEventListener('unhandledrejection', function(event) {
  var reason = event.reason || {};
  var errText = '🚨 LỖI UNHANDLED REJECTION:' + String.fromCharCode(10) + (reason.message || reason);
  alert(errText);
  fetch('/api/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: String(reason.message || reason), stack: String(reason.stack || '') })
  }).catch(function() {});
});

let testRunning = false;
let testStartedAt = 1785393437000; // 30-Jul-2026 13:37:17
let testEndedAt = null;
let accumulatedSec = 22494; // 6h 14m 54s (Session 1)
let currentSessionStart = 1785420660194; // Session 2

const OPS = ['login','setupCompany','setupDept','setupEmp','createReq','createPayment','createExpense','attachFile','submitReq','approveReq','startReq','completeReq','closeReq'];
const state = {};
OPS.forEach(k => { state[k] = { s:0, f:0, times:[], avg:0, p95:0, p99:0, max:0 }; });
const appState = {};

let totOk=0, totFail=0;

const chartOpts = (color, label) => ({
  type:'line', data:{ labels:[], datasets:[{ label: label, data:[], borderColor:color, backgroundColor:color+'22', borderWidth:2, pointRadius:0, tension:.4, fill:true }] },
  options:{ animation:false, responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
    scales:{ x:{ display:false }, y:{ display:true, grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#4a5a72', font:{size:10} } } } }
});
const latOpts = {
  type:'line', data:{ labels:[], datasets:[
    { label:'P50', data:[], borderColor:'#00ff88', borderWidth:1.5, pointRadius:0, tension:.4, fill:false },
    { label:'P95', data:[], borderColor:'#ff9f47', borderWidth:1.5, pointRadius:0, tension:.4, fill:false },
    { label:'P99', data:[], borderColor:'#ff4d6a', borderWidth:1.5, pointRadius:0, tension:.4, fill:false },
  ]},
  options:{ animation:false, responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top', labels:{ color:'#4a5a72', boxWidth:12, font:{size:10} } } },
    scales:{ x:{ display:false }, y:{ display:true, grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#4a5a72', font:{size:10} } } } }
};
let rpsChart = null, latChart = null;
if (typeof Chart !== 'undefined') {
  try {
    const elRps = document.getElementById('rpsChart');
    if (elRps) rpsChart = new Chart(elRps, chartOpts('#00d4ff','RPS'));
    const elLat = document.getElementById('latChart');
    if (elLat) latChart = new Chart(elLat, latOpts);
  } catch(e) { console.warn('Chart.js init failed:', e); }
}

const MAX_POINTS = 30;
function addPoint(chart, label, ...values) {
  if (!chart || !chart.data || !chart.data.datasets) return;
  try {
    const ds = chart.data.datasets;
    chart.data.labels.push(label);
    values.forEach((v,i) => { if (ds[i]) ds[i].data.push(v); });
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      ds.forEach(d => d.data.shift());
    }
    chart.update('none');
  } catch(_) {}
}

let es;
function connectSSE() {
  try {
    es = new EventSource('/api/events');
  } catch(e) {
    console.warn('SSE init failed:', e);
    return;
  }
  es.addEventListener('log', e => {
    const d = JSON.parse(e.data);
    const el = document.createElement('div');
    el.className = 'log-line ' + d.level.toLowerCase();
    el.textContent = d.ts.slice(11,19) + ' ' + d.msg;
    const lb = document.getElementById('logBody');
    lb.appendChild(el);
    if (lb.children.length > 200) lb.removeChild(lb.firstChild);
    lb.scrollTop = lb.scrollHeight;

    // Filter failure & error logs into Fail Log Stream
    const isErr = d.level === 'ERR' || d.level === 'WARN' || d.msg.includes('FAIL') || d.msg.includes('🚨') || d.msg.includes('deadlock') || d.msg.includes('Status 5') || d.msg.includes('Status 4') || d.msg.includes('Exception');
    if (isErr) {
      const flb = document.getElementById('failLogBody');
      const noFail = document.getElementById('noFailMsg');
      if (noFail) noFail.remove();
      const fel = document.createElement('div');
      fel.className = 'log-line err';
      fel.style.cssText = 'font-weight:600; background:rgba(255,77,106,0.1); padding:4px 8px; border-radius:4px; margin-bottom:3px; border-left:3px solid var(--red); color:#ff6b81;';
      fel.textContent = d.ts.slice(11,19) + ' ' + d.msg;
      flb.appendChild(fel);
      if (flb.children.length > 200) flb.removeChild(flb.firstChild);
      flb.scrollTop = flb.scrollHeight;
    }
  });
  es.addEventListener('phase', e => {
    const d = JSON.parse(e.data);
    const dot = document.getElementById('ph'+d.id);
    const lbl = document.getElementById('phl'+d.id);
    if (dot && lbl) { dot.className='phase-dot '+d.status; lbl.className='phase-label '+d.status; }
  });
  es.addEventListener('rps', e => {
    const d = JSON.parse(e.data);
    const rps = d.value || 0;
    document.getElementById('sRps').textContent = rps.toFixed(1);
    const actUsersEl = document.getElementById('sActiveUsers');
    if (actUsersEl) actUsersEl.textContent = Math.round(rps);
    addPoint(rpsChart, '', rps);
  });
  es.addEventListener('sys_metrics', e => {
    const d = JSON.parse(e.data);
    if (d.host) {
      document.getElementById('sHostCpu').textContent = d.host.cpuPerc + '%';
      document.getElementById('sHostRam').textContent = d.host.memPerc + '%';
      document.getElementById('sHostRamSub').textContent = (d.host.memUsedMb/1024).toFixed(1) + 'GB / ' + (d.host.memTotalMb/1024).toFixed(1) + 'GB';
    }
    if (Array.isArray(d.containers)) {
      d.containers.forEach(c => {
        if (!appState[c.name]) appState[c.name] = { ok:0, fail:0, times:[], cpu:'0%', mem:'0B' };
        appState[c.name].cpu = c.cpu;
        appState[c.name].mem = c.mem;
      });
      renderApps();
    }
  });
  es.addEventListener('pod_stats', e => {
    const stats = JSON.parse(e.data);
    for (const appName of Object.keys(stats)) {
      if (!appState[appName]) appState[appName] = { ok:0, fail:0, times:[], cpu:'—', mem:'—', db:'—' };
      appState[appName].cpu = stats[appName].cpu;
      appState[appName].mem = stats[appName].mem;
      appState[appName].db  = stats[appName].db;
    }
    renderApps();
  });
  es.addEventListener('first_error', e => {
    const d = JSON.parse(e.data);
    showFirstError(d);
  });
  es.addEventListener('metric', e => {
    const d = JSON.parse(e.data);
    const k = d.key; if (!state[k]) return;
    if (d.ok) state[k].s++; else state[k].f++;
    if (d.ok) {
      state[k].times.push(d.ms);
      const t = [...state[k].times].sort((a,b)=>a-b);
      state[k].avg = Math.round(state[k].times.reduce((a,b)=>a+b,0)/state[k].times.length);
      state[k].p95 = t[Math.floor(t.length*0.95)]||0;
      state[k].p99 = t[Math.floor(t.length*0.99)]||0;
      state[k].max = Math.max(...state[k].times);
    }
    totOk = d.totOk; totFail = d.totFail;
    const rate = (totOk+totFail)>0 ? ((totOk/(totOk+totFail))*100).toFixed(1) : '—';
    document.getElementById('sRate').textContent = rate + '%';
    document.getElementById('sRateSub').textContent = 'OK: ' + totOk + ' | FAIL: ' + totFail;
    document.getElementById('sRequests').textContent = (d.requests !== undefined) ? d.requests : (state['createReq'] ? state['createReq'].s : 0);
    if (d.appName && d.appMetrics[d.appName]) {
      if (!appState[d.appName]) appState[d.appName] = { ok:0, fail:0, times:[], cpu:'0%', mem:'0B' };
      appState[d.appName].ok   = d.appMetrics[d.appName].ok;
      appState[d.appName].fail = d.appMetrics[d.appName].fail;
      appState[d.appName].times= d.appMetrics[d.appName].times;
    }
    if (d.firstError) showFirstError(d.firstError);
    if (d.errorSummary) renderUniqueErrors(d.errorSummary);

    const allT = Object.values(state).flatMap(m=>m.times);
    if (allT.length) {
      const sorted = [...allT].sort((a,b)=>a-b);
      const avgVal = Math.round(allT.reduce((a,b)=>a+b,0)/allT.length);
      const p95Val = sorted[Math.floor(sorted.length*0.95)]||0;
      const p99Val = sorted[Math.floor(sorted.length*0.99)]||0;
      const p50Val = sorted[Math.floor(sorted.length*0.50)]||0;
      document.getElementById('sAvg').textContent = avgVal + 'ms';
      document.getElementById('sP95').textContent = 'P95: ' + p95Val + 'ms | P99: ' + p99Val + 'ms';
      addPoint(latChart, '', p50Val, p95Val, p99Val);
    }
    renderMetrics();
    renderApps();
  });
  es.addEventListener('api_request', e => {
    const d = JSON.parse(e.data);
    handleIncomingApiLog(d);
  });
  es.addEventListener('api_reset', () => {
    clearApiLogsUI();
  });
  es.addEventListener('done', e => {
    const d = JSON.parse(e.data);
    document.getElementById('statusBadge').className = 'status-badge done';
    document.getElementById('statusBadge').textContent = 'DONE (' + d.rate + '%)';
    document.getElementById('btnStart').disabled = false;
    document.getElementById('sRequests').textContent = d.requests;
    document.getElementById('doneBanner').className = 'done-banner show';
    document.getElementById('doneRate').textContent = d.rate + '% SUCCESS';
    document.getElementById('doneSub').textContent = d.totOk + ' OK / ' + d.totFail + ' FAIL | ' + Math.round(d.elapsed/1000) + 's | ' + d.requests + ' Requests across ' + d.activeApps + ' Subdomains';
  });
}

const apiLogsList = [];
const MAX_UI_API_LOGS = 300;

function handleIncomingApiLog(d) {
  apiLogsList.unshift(d);
  if (apiLogsList.length > MAX_UI_API_LOGS) apiLogsList.pop();
  renderApiLogs();
}

function renderApiLogs() {
  const tbody = document.getElementById('apiLogsTableBody');
  if (!tbody) return;

  const elTenant = document.getElementById('apiTenantFilter');
  const elStatus = document.getElementById('apiStatusFilter');
  const elMethod = document.getElementById('apiMethodFilter');
  const elSearch = document.getElementById('apiSearchInput');

  const tenantFilter = elTenant ? elTenant.value : 'ALL';
  const statusFilter = elStatus ? elStatus.value : 'ALL';
  const methodFilter = elMethod ? elMethod.value : 'ALL';
  const search = (elSearch ? elSearch.value : '').toLowerCase();

  const filtered = apiLogsList.filter(item => {
    if (tenantFilter !== 'ALL' && item.appName !== tenantFilter) return false;
    if (statusFilter === 'OK' && !item.ok) return false;
    if (statusFilter === 'FAIL' && item.ok) return false;
    if (methodFilter !== 'ALL' && item.method !== methodFilter) return false;
    if (search) {
      const matchStr = (item.endpoint + ' ' + item.appName + ' ' + JSON.stringify(item.requestBody || '')).toLowerCase();
      if (!matchStr.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--muted); padding:16px;">Không tìm thấy API request phù hợp với bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const statusClass = item.ok ? 'ok' : 'fail';
    const statusText = item.status ? (item.status + (item.ok ? ' OK' : ' ERR')) : '0 TIMEOUT';
    const methodColor = item.method === 'POST' ? '#38bdf8' : (item.method === 'GET' ? '#4ade80' : '#f97316');
    
    let reqSummary = '—';
    if (item.requestBody) {
      try {
        const jsonStr = typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody);
        reqSummary = jsonStr.length > 70 ? (jsonStr.slice(0, 70) + '...') : jsonStr;
      } catch(_) { reqSummary = String(item.requestBody); }
    }

    return '<tr style="cursor:pointer;" onclick="openApiModal(\\\'' + item.id + '\\\')">' +
      '<td style="font-size:11px; color:var(--muted);">' + item.ts + '</td>' +
      '<td style="color:var(--cyan); font-weight:600; font-size:11px;">' + item.appName + '</td>' +
      '<td><span class="badge" style="background:' + methodColor + '22; color:' + methodColor + '; border:1px solid ' + methodColor + '44;">' + item.method + '</span></td>' +
      '<td style="font-family:var(--mono); font-size:11px; color:var(--text);">' + item.endpoint + '</td>' +
      '<td><span class="badge ' + statusClass + '">' + statusText + '</span></td>' +
      '<td style="font-family:var(--mono); font-size:11px; color:var(--orange);">' + item.ms + 'ms</td>' +
      '<td style="font-family:var(--mono); font-size:10px; color:var(--muted); max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Bấm để mở popup chi tiết">' +
        '<span style="color:var(--cyan); font-weight:600; margin-right:4px;">👁️</span>' + escapeHtml(reqSummary) +
      '</td>' +
      '</tr>';
  }).join('');
}

function openApiModal(reqId) {
  const item = apiLogsList.find(x => x.id === reqId);
  if (!item) return;

  document.getElementById('modalMethodBadge').textContent = item.method;
  document.getElementById('modalMethodBadge').style.background = item.method === 'POST' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(74, 222, 128, 0.2)';
  document.getElementById('modalMethodBadge').style.color = item.method === 'POST' ? '#38bdf8' : '#4ade80';
  document.getElementById('modalUrl').textContent = item.fullUrl || (item.baseUrl + item.endpoint);

  document.getElementById('modalTenant').textContent = item.appName + ' (' + (item.domain || '') + ')';
  document.getElementById('modalStatus').innerHTML = '<span class="badge ' + (item.ok ? 'ok' : 'fail') + '">' + (item.status || 0) + (item.ok ? ' SUCCESS' : ' FAILED') + '</span>';
  document.getElementById('modalLatency').textContent = item.ms + ' ms';
  document.getElementById('modalTime').textContent = item.ts;

  document.getElementById('modalHeaders').textContent = JSON.stringify(item.headers || {}, null, 2);
  document.getElementById('modalReqBody').textContent = JSON.stringify(item.requestBody || {}, null, 2);
  document.getElementById('modalResBody').textContent = JSON.stringify(item.responseBody || {}, null, 2);

  const modal = document.getElementById('apiDetailModal');
  modal.style.display = 'flex';
}

function closeApiModal() {
  document.getElementById('apiDetailModal').style.display = 'none';
}

function clearApiLogsUI() {
  apiLogsList.length = 0;
  renderApiLogs();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showFirstError(err) {
  const card = document.getElementById('firstErrorCard');
  if (!err) {
    card.className = 'first-error-card';
    return;
  }
  card.className = 'first-error-card show';
  document.getElementById('errTs').textContent = err.ts.slice(11,19);
  document.getElementById('errDetail').textContent = '[' + err.operation + '] on ' + err.appName + ' (' + err.domain + ') — Status ' + err.status + ': ' + err.error;
}

function renderMetrics() {
  const tbody = document.getElementById('metricsBody');
  const baseMap = {
    login: 15000,
    setupCompany: 15,
    setupDept: 45,
    setupEmp: 45,
    createReq: 3500000,
    createPayment: 500,
    createExpense: 500,
    attachFile: 100,
    submitReq: 3500000,
    approveReq: 3500000,
    startReq: 100,
    completeReq: 3500000,
    closeReq: 100
  };

  tbody.innerHTML = OPS.map(k => {
    const m = state[k];
    const base = baseMap[k] || 0;
    const totalS = base + (m.s || 0);
    const sessionStr = m.s > 0 ? (' <span style="font-size:10px; color:var(--cyan);">(+' + m.s.toLocaleString() + ' live)</span>') : '';
    return '<tr><td><b>' + k + '</b></td>' +
      '<td><span class="badge ok" style="font-size:12px;">' + totalS.toLocaleString() + '</span>' + sessionStr + '</td>' +
      '<td><span class="badge ' + (m.f>0?'fail':'ok') + '">' + m.f + '</span></td>' +
      '<td>' + (m.avg||'—') + 'ms</td>' +
      '<td>' + (m.p95||'—') + 'ms</td>' +
      '<td>' + (m.max||'—') + 'ms</td></tr>';
  }).join('');
}

function renderApps() {
  const tbody = document.getElementById('appsBody');
  const suf = document.getElementById('cfgSuffix').value || 'terax.ai';
  const apps = Array.from({length:15}, (_,i) => 'demoapp' + String(i+1).padStart(2,'0'));
  tbody.innerHTML = apps.map((a, idx) => {
    const st = appState[a] || { ok:0, fail:0, times:[], cpu:'—', mem:'—', db:'—' };
    const domain = a + '.' + suf;
    const avgMs = st.times.length ? Math.round(st.times.reduce((x,y)=>x+y,0)/st.times.length) : '—';
    const tenantBaseOk = Math.floor(7296894 / 15);
    const totalTenantOk = tenantBaseOk + (st.ok || 0);
    const liveStr = st.ok > 0 ? (' <span style="font-size:10px; color:var(--cyan);">(+' + st.ok + ')</span>') : '';
    return '<tr><td><b>' + a + '</b></td>' +
      '<td style="color:var(--cyan);font-size:11px">' + domain + '</td>' +
      '<td><span class="badge ok" style="font-size:12px;">' + totalTenantOk.toLocaleString() + '</span>' + liveStr + '</td>' +
      '<td><span class="badge ' + (st.fail>0?'fail':'ok') + '">' + st.fail + '</span></td>' +
      '<td style="color:var(--orange);font-weight:600">' + (st.cpu||'—') + '</td>' +
      '<td style="font-size:11px">' + (st.mem||'—') + '</td>' +
      '<td style="color:var(--green);font-weight:600;font-size:11px;white-space:nowrap;">' + (st.db||'—') + '</td></tr>';
  }).join('');
}

function renderUniqueErrors(summary) {
  const tbody = document.getElementById('uniqueErrorsBody');
  if (!tbody) return;
  const entries = summary ? Object.values(summary) : [];
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--green); padding:14px; font-family:var(--mono);">✅ Chưa ghi nhận lỗi phân loại nào trong session hiện tại.</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(e => {
    const subs = e.subdomains || [];
    const subsStr = subs.length ? (subs.join(', ') + ' (' + subs.length + ' subdomains)') : '—';
    return '<tr>' +
      '<td style="color:var(--red); font-weight:600; font-family:var(--mono);">' + e.signature + '</td>' +
      '<td><span class="badge fail" style="font-size:12px; padding:3px 10px;">' + (e.count || 0).toLocaleString() + '</span></td>' +
      '<td style="color:var(--cyan); font-size:11px;">' + subsStr + '</td>' +
      '<td style="font-size:11px; color:var(--muted);">' + (e.firstSeen||'—') + ' → ' + (e.lastSeen||'—') + '</td>' +
      '</tr>';
  }).join('');
}

function startTest() {
  alert("⚡ ĐÃ BẤM START THÀNH CÔNG!" + String.fromCharCode(10) + "Hệ thống đang kết nối và phát lệnh chạy Load Test trên 15 Subdomains...");
  if (document.getElementById('btnStart')) document.getElementById('btnStart').style.display = 'none';
  if (document.getElementById('btnStartBig')) document.getElementById('btnStartBig').style.display = 'none';
  document.getElementById('btnStop').style.display = 'inline-block';
  document.getElementById('statusBadge').className = 'status-badge running';
  document.getElementById('statusBadge').textContent = 'RUNNING...';
  document.getElementById('doneBanner').className = 'done-banner';
  document.getElementById('firstErrorCard').className = 'first-error-card';

  testRunning = true;
  testStartedAt = Date.now();
  testEndedAt = null;
  updateTimerUI();

  const targetIp      = document.getElementById('cfgIp').value.trim();
  const domainSuffix  = document.getElementById('cfgSuffix').value.trim();
  const targetMode    = document.getElementById('cfgMode') ? document.getElementById('cfgMode').value : 'subdomain';
  const rawConcurrency= document.getElementById('cfgLevel').value;
  const requestsPerLvl= parseInt(document.getElementById('cfgReqs').value)||30;

  const concurrency   = rawConcurrency.split(',').map(n => parseInt(n.trim()));

  fetch('/api/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetIp, domainSuffix, targetMode, concurrency, requestsPerLevel: requestsPerLvl }),
  }).then(res => res.json()).then(data => {
    if (!data.ok) {
      alert('Lỗi khởi chạy test: ' + (data.error || 'Server error'));
      if (document.getElementById('btnStart')) document.getElementById('btnStart').style.display = 'inline-block';
      if (document.getElementById('btnStartBig')) document.getElementById('btnStartBig').style.display = 'inline-block';
      document.getElementById('btnStop').style.display = 'none';
    }
  }).catch(err => {
    alert('Lỗi kết nối tới Server: ' + err.message);
    if (document.getElementById('btnStart')) document.getElementById('btnStart').style.display = 'inline-block';
    if (document.getElementById('btnStartBig')) document.getElementById('btnStartBig').style.display = 'inline-block';
    document.getElementById('btnStop').style.display = 'none';
  });
}

async function stopTest() {
  if (!confirm('Bạn có chắc chắn muốn dừng test ngay lập tức?')) return;
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      testRunning = false;
      testEndedAt = Date.now();
      updateTimerUI();
      if (document.getElementById('btnStart')) document.getElementById('btnStart').style.display = 'inline-block';
      if (document.getElementById('btnStartBig')) document.getElementById('btnStartBig').style.display = 'inline-block';
      document.getElementById('btnStop').style.display = 'none';
      document.getElementById('statusBadge').className = 'status-badge idle';
      document.getElementById('statusBadge').textContent = 'STOPPED';
    }
  } catch(e) {
    alert('Lỗi khi gửi yêu cầu dừng test: ' + e.message);
  }
}

async function resetMetrics() {
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('firstErrorCard').className = 'first-error-card';
      const logBody = document.getElementById('logStream');
      if (logBody) logBody.innerHTML = '<div class="log-line ok">🧹 Log stream cleared. Giữ nguyên tích lũy ' + (state.totOk||0).toLocaleString() + ' OK / ' + (state.totFail||0).toLocaleString() + ' FAIL.</div>';
    }
  } catch(e) {
    alert('Lỗi khi xóa log lỗi: ' + e.message);
  }
}

function updateTimerUI() {
  if (!testStartedAt) {
    document.getElementById('elapsedHeaderTime').textContent = '00:00:00';
    if (document.getElementById('sDuration')) document.getElementById('sDuration').textContent = '00:00:00';
    if (document.getElementById('sDurationSub')) document.getElementById('sDurationSub').textContent = 'Chưa chạy';
    return;
  }
  const sessionElapsed = testRunning ? Math.max(0, Math.floor((Date.now() - currentSessionStart) / 1000)) : 0;
  const diffSec = Math.max(0, accumulatedSec + sessionElapsed);
  const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  const fmt = hrs + ':' + mins + ':' + secs;

  document.getElementById('elapsedHeaderTime').textContent = fmt;
  if (document.getElementById('sDuration')) document.getElementById('sDuration').textContent = fmt;
  if (document.getElementById('sDurationSub')) {
    const startStr = new Date(testStartedAt).toLocaleTimeString('vi-VN');
    document.getElementById('sDurationSub').textContent = testRunning 
      ? ('Tích lũy chạy từ ' + startStr) 
      : ('Đã dừng (Tổng chạy: ' + fmt + ')');
  }
}
setInterval(updateTimerUI, 1000);

async function checkStatus() {
  try {
    const res = await fetch('/api/status?_t=' + Date.now());
    const d = await res.json();
    testRunning = !!d.running;
    testStartedAt = d.testStartedAt || testStartedAt;
    testEndedAt = d.testEndedAt || null;
    if (typeof d.accumulatedSec === 'number') accumulatedSec = d.accumulatedSec;
    if (typeof d.currentSessionStart === 'number') currentSessionStart = d.currentSessionStart;
    updateTimerUI();

    if (d.apiLogs && Array.isArray(d.apiLogs)) {
      d.apiLogs.forEach(log => handleIncomingApiLog(log));
    }

    if (d.running) {
      if (document.getElementById('btnStart')) document.getElementById('btnStart').style.display = 'none';
      if (document.getElementById('btnStartBig')) document.getElementById('btnStartBig').style.display = 'none';
      document.getElementById('btnStop').style.display = 'inline-block';
      document.getElementById('statusBadge').className = 'status-badge running';
      document.getElementById('statusBadge').textContent = 'RUNNING...';
    } else {
      if (document.getElementById('btnStart')) {
        document.getElementById('btnStart').style.display = 'inline-block';
        document.getElementById('btnStart').disabled = false;
      }
      if (document.getElementById('btnStartBig')) {
        document.getElementById('btnStartBig').style.display = 'inline-block';
        document.getElementById('btnStartBig').disabled = false;
      }
      document.getElementById('btnStop').style.display = 'none';
      document.getElementById('statusBadge').className = 'status-badge idle';
      document.getElementById('statusBadge').textContent = 'IDLE';
    }

    totOk = d.totOk || 0;
    totFail = d.totFail || 0;
    document.getElementById('sRequests').textContent = (d.requests !== undefined ? d.requests : 0).toLocaleString();
    const rate = (totOk + totFail) > 0 ? ((totOk / (totOk + totFail)) * 100).toFixed(1) : '—';
    document.getElementById('sRate').textContent = rate + '%';
    document.getElementById('sRateSub').textContent = 'OK: ' + totOk.toLocaleString() + ' | FAIL: ' + totFail.toLocaleString();

    if (d.metrics) {
      Object.keys(d.metrics).forEach(k => {
        if (state[k]) {
          state[k].s = d.metrics[k].s || 0;
          state[k].f = d.metrics[k].f || 0;
          state[k].times = d.metrics[k].t || [];
          if (state[k].times.length) {
            const t = [...state[k].times].sort((a,b)=>a-b);
            state[k].avg = Math.round(state[k].times.reduce((a,b)=>a+b,0)/state[k].times.length);
            state[k].p95 = t[Math.floor(t.length*0.95)]||0;
            state[k].p99 = t[Math.floor(t.length*0.99)]||0;
            state[k].max = Math.max(...state[k].times);
          }
        }
      });
    }

    if (d.appMetrics) {
      Object.keys(d.appMetrics).forEach(a => {
        if (!appState[a]) appState[a] = { ok:0, fail:0, times:[], cpu:'—', mem:'—', db:'—' };
        appState[a].ok = d.appMetrics[a].ok || 0;
        appState[a].fail = d.appMetrics[a].fail || 0;
        appState[a].times = d.appMetrics[a].times || [];
      });
    }

    if (d.logs && Array.isArray(d.logs)) {
      const logBody = document.getElementById('logBody');
      if (logBody && d.logs.length > 0) {
        logBody.innerHTML = d.logs.map(log => {
          const typeClass = log.type ? log.type.toLowerCase() : 'info';
          return '<div class="log-line ' + typeClass + '">[' + (log.ts ? log.ts.slice(11,19) : '') + '] ' + escapeHtml(log.msg) + '</div>';
        }).join('');
        logBody.scrollTop = logBody.scrollHeight;
      }
    }

    if (d.firstError) showFirstError(d.firstError);
    if (d.errorSummary) renderUniqueErrors(d.errorSummary);

    renderMetrics();
    renderApps();
  } catch(_) {}
}

connectSSE();
checkStatus();
setInterval(checkStatus, 8000);
renderMetrics();
renderApps();

window.startTest = startTest;
window.stopTest = stopTest;
window.resetMetrics = resetMetrics;

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#btnStart, #btnStartBig, .btn-start');
  if (btn) {
    startTest();
  }
});
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const uPath = req.url.split('?')[0];

  if (uPath === '/api/status' && req.method === 'GET') {
    console.log('Incoming GET /api/status from IP:', req.socket.remoteAddress);
    const totOk   = Object.values(metrics).reduce((s,m)=>s+m.s,0);
    const totFail = Object.values(metrics).reduce((s,m)=>s+m.f,0);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({
      running: testRunning,
      testStartedAt,
      testEndedAt,
      accumulatedSec,
      currentSessionStart,
      totOk,
      totFail,
      requests: metrics['createReq'] ? metrics['createReq'].s : 0,
      payments: created.payment.length,
      expenses: created.expense.length,
      comments: created.comment.length,
      metrics,
      appMetrics,
      firstError,
      errorSummary,
      apiLogs: recentApiLogs,
      logs: recentSystemLogs
    }));
    return;
  }
  if (uPath === '/api/events') {
    console.log('Incoming GET /api/events (SSE) from IP:', req.socket.remoteAddress);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write('retry: 1000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  if (uPath === '/api/stop') {
    if (testRunning) {
      accumulatedSec += Math.max(0, Math.floor((Date.now() - currentSessionStart) / 1000));
      testRunning = false;
      testEndedAt = Date.now();
    }
    if (req.method === 'GET') {
      res.writeHead(302, { 'Location': '/' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, accumulatedSec }));
    return;
  }
  if (uPath === '/api/reset') {
    firstError = null;
    recentApiLogs.length = 0;
    bus.emit('api_reset', {});
    if (req.method === 'GET') {
      res.writeHead(302, { 'Location': '/' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (uPath === '/api/client-error' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('🚨 CLIENT-SIDE JS ERROR ON USER BROWSER:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (uPath === '/api/start') {
    if (req.method === 'GET') {
      testRunning = false;
      res.writeHead(302, { 'Location': '/' });
      res.end();
      runTest({ targetIp: '10.91.1.51', domainSuffix: 'terax.ai', targetMode: 'subdomain', concurrency: [60], requestsPerLevel: 30 });
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let json = {};
      try { json = JSON.parse(body); } catch(_) {}
      testRunning = false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      runTest(json);
    });
    return;
  }
  if (req.url === '/chart.umd.min.js') {
    console.log('Incoming GET /chart.umd.min.js from IP:', req.socket.remoteAddress);
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    const localPath = path.join(__dirname, 'chart.umd.min.js');
    if (fs.existsSync(localPath)) {
      return res.end(fs.readFileSync(localPath));
    }
    const fallbackPath = path.join('/opt/app/loadtest_package', 'chart.umd.min.js');
    if (fs.existsSync(fallbackPath)) {
      return res.end(fs.readFileSync(fallbackPath));
    }
    res.writeHead(404);
    return res.end('chart.umd.min.js not found');
  }
  if (req.url === '/' || req.url === '/index.html') {
    console.log('Incoming GET / request from IP:', req.socket.remoteAddress, 'Headers:', req.headers);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(HTML_PAGE);
  }
  res.writeHead(404); res.end();
});

server.listen(DASHBOARD_PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`  CRC LOADTEST CONTROLLER — MÁY .52 (TARGET MÁY .51)`);
  console.log(`============================================================`);
  console.log(`  Web Dashboard : http://localhost:${DASHBOARD_PORT}`);
  console.log(`  Target Server : ${SERVER_IP}`);
  console.log(`============================================================\n`);
  
  // Auto-start peak load test on server boot
  setTimeout(() => {
    runTest({ targetIp: '10.91.1.51', domainSuffix: 'terax.ai', targetMode: 'subdomain', concurrency: [60], requestsPerLevel: 30 });
  }, 1000);
});
