/**
 * SCRIPT 3: Import MPS REQUEST → CRC REQUEST table
 *
 * DRY_RUN = true  → chỉ in preview, không touch DB
 * DRY_RUN = false → thực sự TRUNCATE + INSERT vào DB
 *
 * Key mappings:
 * - request_id    = String(MPS.ID)          e.g. "200441"
 * - request_type  = String(MPS.REQUEST_TYPE__PROCESS)  e.g. "38"
 *                   matches policy_and_program.policy_id exactly
 * - sr_creater    = MPS.SR_CREATER__EMPLOYEE  (null in current export → fill when full data)
 * - requester     = MPS.REQUESTER__EMPLOYEE   (null in current export → fill when full data)
 * - tier_X_approval = MPS.TIER_X_APPROVAL__EMPLOYEE (null in current export → fill later)
 * - tier_X_status   = mapped from MPS numeric ID → string
 * - approval_flow   = rebuilt from tier statuses + approval_level
 *
 * SKIP: requests with REQUEST_TYPE__PROCESS in [410, 411] (no matching process)
 *
 * Chạy: node import_mps_request.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // ← đổi thành false khi muốn import thật
const SKIP_PROCESS_IDS = new Set([410, 411]); // Missing process IDs

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== EMPLOYEE UUID RESOLVER =====
let uuidToEmailMap = new Map();

function resolveEmp(val) {
  if (!val) return null;
  const clean = String(val).toUpperCase().trim();
  if (uuidToEmailMap.has(clean)) {
    return uuidToEmailMap.get(clean);
  }
  return val; // Fallback to raw value if not found
}

// ===== STATUS MAPPINGS =====
const TIER_STATUS_MAP = {
  1: 'Approved',
  2: 'Not started yet',
  3: 'Rejected',
  5: 'Pending approval',
};

const SR_STATUS_MAP = {
  1: 'Closed',
  2: 'Draft',
  3: 'Pending Approval',
};

const PROCESS_STATUS_MAP = {
  1: 'Canceled',
  2: 'Completed',
  3: 'Not started yet',
  4: 'Processing',
};

// ===== APPROVAL LEVEL → MAX TIERS =====
function getMaxTiers(approvalLevel) {
  if (!approvalLevel) return 3;
  const l = approvalLevel.toLowerCase();
  if (l.includes('tier 0')) return 0;
  if (l.includes('tier 1')) return 1;
  if (l.includes('tier 2')) return 2;
  if (l.includes('tier 3')) return 3;
  return 3; // default
}

// ===== BUILD approval_flow JSONB =====
// Matches CRC App format from requestModel.js
function buildApprovalFlow(r) {
  const maxTiers = getMaxTiers(r.APPROVAL_LEVEL);

  if (maxTiers === 0) {
    return JSON.stringify({
      total_levels: 0,
      current_level: 0,
      steps: [],
      audit_log: ['Auto-approved (Tier 0 process) - MPS Import']
    });
  }

  const tierStatuses = [
    { mps: r['TIER_1_STATUS__REQUEST_TIER_STATUS'], date: r['TIER_1_UPDATE_DATE'], approver: r['TIER_1_APPROVAL__EMPLOYEE'] },
    { mps: r['TIER_2_STATUS__REQUEST_TIER_STATUS'], date: r['TIER_2_UPDATE_DATE'], approver: r['TIER_2_APPROVAL__EMPLOYEE'] },
    { mps: r['TIER_3_STATUS__REQUEST_TIER_STATUS'], date: r['TIER_3_UPDATE_DATE'], approver: r['TIER_3_APPROVAL__EMPLOYEE'] },
  ];

  const steps = [];
  let currentLevel = 1;

  for (let i = 0; i < maxTiers; i++) {
    const ts = tierStatuses[i];
    const status = ts.mps ? (TIER_STATUS_MAP[ts.mps] || 'Not started yet') : 'Not started yet';
    const actionDate = ts.date ? ts.date : null;
    const actionBy = resolveEmp(ts.approver) || null;

    steps.push({
      level: i + 1,
      status: status,
      action_by: actionBy,
      action_date: actionDate
    });

    // Determine current_level = last approved tier + 1
    if (status === 'Approved') currentLevel = i + 2;
    if (status === 'Rejected') currentLevel = i + 1;
    if (status === 'Pending approval') currentLevel = i + 1;
  }

  // Cap current_level
  currentLevel = Math.min(currentLevel, maxTiers);

  const processStat = r['PROCESS_STATUS__ID_REQUEST_PROCESS_STATUS'];
  const isCompleted = processStat === 2; // Completed

  const auditLog = [
    `${r['SR_CREATED_DATE'] || new Date().toISOString()} - Request Created (MPS Import)`,
  ];
  if (r['SR_CLOSE_DATE']) {
    auditLog.push(`${r['SR_CLOSE_DATE']} - Request Closed`);
  }

  return JSON.stringify({
    total_levels: maxTiers,
    current_level: isCompleted ? maxTiers : currentLevel,
    steps: steps,
    audit_log: auditLog
  });
}

// ===== PARSE DATE SAFELY =====
function parseDate(val) {
  if (!val) return null;
  const d = val.split('T')[0];
  return d || null;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`REQUEST IMPORT — DRY_RUN=${DRY_RUN}`);
  console.log('='.repeat(60));

  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else if (fs.existsSync('new_data_mps.json')) {
    raw = fs.readFileSync('new_data_mps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json, data/mymps.json, or new_data_mps.json!');
  }
  const mymps = JSON.parse(raw);

  // Initialize employee UUID to Email mapping
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });
  console.log(`Built employee UUID mapping: ${uuidToEmailMap.size} resolved employees.`);

  const reqRows = mymps.tables['REQUEST']?.rows || [];
  console.log(`Total MPS requests: ${reqRows.length}`);

  // Filter: skip missing process IDs
  const filtered = reqRows.filter(r => !SKIP_PROCESS_IDS.has(r.REQUEST_TYPE__PROCESS));
  const skipped = reqRows.length - filtered.length;
  console.log(`Skipped (missing process): ${skipped}`);
  console.log(`To import: ${filtered.length}`);

  // Build mapped rows
  const mapped = filtered.map(r => {
    const approvalFlow = buildApprovalFlow(r);

    return {
      // === IDENTITY ===
      request_id: String(r.ID),
      request_type: String(r.REQUEST_TYPE__PROCESS),

      // === PEOPLE (resolved via UUID map) ===
      sr_creater: resolveEmp(r['SR_CREATER__EMPLOYEE']),
      requester: resolveEmp(r['REQUESTER__EMPLOYEE']),

      // === CONTENT ===
      description: r.DESCRIPTION || null,

      // === TIER APPROVERS (resolved via UUID map) ===
      tier_1_approval: resolveEmp(r['TIER_1_APPROVAL__EMPLOYEE']),
      tier_2_approval: resolveEmp(r['TIER_2_APPROVAL__EMPLOYEE']),
      tier_3_approval: resolveEmp(r['TIER_3_APPROVAL__EMPLOYEE']),

      // === TIER STATUSES (mapped from numeric → string) ===
      tier_1_status: r['TIER_1_STATUS__REQUEST_TIER_STATUS'] ? (TIER_STATUS_MAP[r['TIER_1_STATUS__REQUEST_TIER_STATUS']] || null) : null,
      tier_1_update_date: r['TIER_1_UPDATE_DATE'] || null,
      tier_2_status: r['TIER_2_STATUS__REQUEST_TIER_STATUS'] ? (TIER_STATUS_MAP[r['TIER_2_STATUS__REQUEST_TIER_STATUS']] || null) : null,
      tier_2_update_date: r['TIER_2_UPDATE_DATE'] || null,
      tier_3_status: r['TIER_3_STATUS__REQUEST_TIER_STATUS'] ? (TIER_STATUS_MAP[r['TIER_3_STATUS__REQUEST_TIER_STATUS']] || null) : null,
      tier_3_update_date: r['TIER_3_UPDATE_DATE'] || null,

      // === DATES ===
      sr_created_date: parseDate(r['SR_START_DATE']),
      sr_submitted_date: parseDate(r['SR_CREATED_DATE'] || r['TIER_1_UPDATE_DATE'] || r['PROCESS_START_DATE']),
      sr_close_date: parseDate(r['SR_CLOSE_DATE']),
      process_start_date: parseDate(r['PROCESS_START_DATE']),
      process_end_date: parseDate(r['PROCESS_END_DATE']),

      // === STATUS ===
      sr_status: r['SR_STATUS__ID_REQUEST_SR_STATUS'] ? (SR_STATUS_MAP[r['SR_STATUS__ID_REQUEST_SR_STATUS']] || null) : null,
      process_status: r['PROCESS_STATUS__ID_REQUEST_PROCESS_STATUS'] ? (PROCESS_STATUS_MAP[r['PROCESS_STATUS__ID_REQUEST_PROCESS_STATUS']] || null) : null,
      approval_level: r['APPROVAL_LEVEL'] || null,

      // === POLICY LEAD / SR OWNER (resolved via UUID map) ===
      policy_lead: resolveEmp(r['PROCESS_LEAD__EMPLOYEE']),
      sr_owner: resolveEmp(r['SR_OWNER__EMPLOYEE']),

      // === APPROVAL FLOW JSONB ===
      approval_flow: approvalFlow,

      // === METADATA ===
      created_by: 'mps_import',
      created_date: r['SR_CREATED_DATE'] ? new Date(r['SR_CREATED_DATE']) : 
                    (r['TIER_1_UPDATE_DATE'] ? new Date(r['TIER_1_UPDATE_DATE']) : 
                    (r['PROCESS_START_DATE'] ? new Date(r['PROCESS_START_DATE']) : new Date())),
      log: `MPS_OLD_ID:${r.OLD_ID || r.ID}`,
    };
  });

  // Preview
  console.log('\n===== SAMPLE (first 3 rows) =====');
  mapped.slice(0, 3).forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r, null, 2)));

  // Stats
  console.log('\n===== APPROVAL_LEVEL DISTRIBUTION =====');
  const byLevel = {};
  mapped.forEach(r => { const l = r.approval_level || 'null'; byLevel[l] = (byLevel[l] || 0) + 1; });
  Object.entries(byLevel).forEach(([l, c]) => console.log(`  ${l}: ${c}`));

  console.log('\n===== SR_STATUS DISTRIBUTION =====');
  const bySr = {};
  mapped.forEach(r => { const s = r.sr_status || 'null'; bySr[s] = (bySr[s] || 0) + 1; });
  Object.entries(bySr).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  console.log('\n===== PROCESS_STATUS DISTRIBUTION =====');
  const byProc = {};
  mapped.forEach(r => { const s = r.process_status || 'null'; byProc[s] = (byProc[s] || 0) + 1; });
  Object.entries(byProc).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  console.log('\n===== COLUMNS WITH NULL (shows what needs full MPS data) =====');
  const nullCounts = {};
  ['sr_creater','requester','tier_1_approval','tier_2_approval','tier_3_approval','policy_lead','sr_owner'].forEach(col => {
    const nullCount = mapped.filter(r => r[col] === null).length;
    nullCounts[col] = `${nullCount}/${mapped.length} null (${Math.round(nullCount/mapped.length*100)}%)`;
  });
  Object.entries(nullCounts).forEach(([c, v]) => console.log(`  ${c}: ${v}`));

  console.log(`\n===== TOTAL: ${mapped.length} requests ready to import =====`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    console.log('   Set DRY_RUN=false to execute.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING request table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: request CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE request CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting requests (batch of 100)...');
  let inserted = 0;
  let failed = 0;

  // Batch insert for performance
  const BATCH = 100;
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH);
    for (const r of batch) {
      try {
        await pool.query(`
          INSERT INTO request (
            request_id, request_type, sr_creater, requester, description,
            tier_1_approval, tier_1_status, tier_1_update_date,
            tier_2_approval, tier_2_status, tier_2_update_date,
            tier_3_approval, tier_3_status, tier_3_update_date,
            sr_created_date, policy_lead, sr_owner,
            sr_status, sr_submitted_date, sr_close_date,
            process_status, process_start_date, process_end_date,
            approval_level, approval_flow,
            created_by, created_date, log
          ) VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,$11,$12,$13,$14,
            $15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,
            $26,$27,$28
          ) ON CONFLICT (request_id) DO NOTHING
        `, [
          r.request_id, r.request_type, r.sr_creater, r.requester, r.description,
          r.tier_1_approval, r.tier_1_status, r.tier_1_update_date,
          r.tier_2_approval, r.tier_2_status, r.tier_2_update_date,
          r.tier_3_approval, r.tier_3_status, r.tier_3_update_date,
          r.sr_created_date, r.policy_lead, r.sr_owner,
          r.sr_status, r.sr_submitted_date, r.sr_close_date,
          r.process_status, r.process_start_date, r.process_end_date,
          r.approval_level, r.approval_flow,
          r.created_by, r.created_date, r.log
        ]);
        inserted++;
      } catch (e) {
        console.error(`  ❌ Failed [${r.request_id}]:`, e.message);
        failed++;
      }
    }
    if ((i / BATCH) % 10 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH, mapped.length)}/${mapped.length}...`);
    }
  }

  console.log(`\n✅ DONE: ${inserted} inserted, ${failed} failed out of ${mapped.length} requests.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
