#!/usr/bin/env node
/**
 * Complete Seeder - CRC App (schema-corrected)
 * request cols: request_id, request_type, sr_creater, requester, description,
 *   sr_created_date, policy_lead, sr_owner, sr_status, process_status,
 *   approval_level, approval_flow, created_by, created_date, company_id, log, elements
 * expense cols: expense_id, request, expense, description, employee, value_before_vat,
 *   currency, expense_type, created_by, created_date, log, my_company
 * payment cols: payment_id, request, payment_type, payment_description, value,
 *   currency, payment_status, payment_request, created_by, created_date, log, my_company
 * service cols: service_id, request, service_type, service_name, status,
 *   created_by, created_date, log, my_company
 * asset cols: office_asset_id, asset_name, request, type, qty, status,
 *   created_by, created_date, log
 * ticket cols: ticket_id, ticket_type, sr_creater, requester, description,
 *   sr_status, process_status, created_by, created_date, log
 * comment cols: comment_id, request, comment, comment_by, comment_date,
 *   created_by, created_date, logs
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const { z } = require('zod');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Zod Schemas (matching actual DB columns) ──────────────────────────────────
const STATUS_SR     = [1, 2, 3, 4, 5, 6];
const STATUS_PROC   = [7, 8, 9];
const PRIORITY_LIST = ['Low','Medium','High','Critical','Urgent'];
const CURRENCIES    = ['VND','USD','EUR'];

const requestSchema = z.object({
  request_id:      z.string().min(1),
  request_type:    z.string().min(1),
  sr_status:       z.union([z.number(), z.string()]),
  process_status:  z.union([z.number(), z.string()]).nullable().optional(),
  description:     z.string().nullable().optional(),
  requester:       z.string().nullable().optional(),
  sr_owner:        z.string().nullable().optional(),
  policy_id_ref:   z.string().nullable().optional(),
});

const expenseSchema = z.object({
  expense_id:    z.string().min(1),
  expense:       z.string().min(1),
  description:   z.string().nullable().optional(),
  value_before_vat: z.number().nonnegative(),
  request:       z.string().nullable().optional(),
});

const paymentSchema = z.object({
  payment_id:          z.string().min(1),
  payment_description: z.string().min(1),
  value:               z.number().nonnegative(),
  payment_status:      z.union([z.number(), z.string()]).nullable().optional(),
  request:             z.string().nullable().optional(),
});

const serviceSchema = z.object({
  service_id:   z.string().min(1),
  service_name: z.string().min(1),
  status:       z.union([z.number(), z.string()]).nullable().optional(),
  request:      z.string().nullable().optional(),
});

const assetSchema = z.object({
  office_asset_id: z.string().min(1),
  asset_name:      z.string().min(1),
  status:          z.union([z.number(), z.string()]).nullable().optional(),
  request:         z.string().nullable().optional(),
});

const ticketSchema = z.object({
  ticket_id:   z.string().min(1),
  ticket_type: z.string().min(1),
  sr_status:   z.union([z.number(), z.string()]).nullable().optional(),
});

function validate(schema, data, label) {
  const r = schema.safeParse(data);
  if (!r.success) {
    console.error('  FAIL [' + label + ']: ' + JSON.stringify(r.error.flatten()));
    return false;
  }
  return true;
}

function pick(arr, n) {
  const s = [...arr].sort(() => Math.random() - 0.5);
  return n && n > 1 ? s.slice(0, n) : s[0];
}

function randDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * (daysAgo || 90)));
  return d.toISOString();
}

const now = new Date().toISOString();
const CREATOR = 'EMP-1001'; // Neo Duong

(async () => {
  const client = await pool.connect();
  try {
    // ── 0. Clear all data (outside transaction to avoid aborting on missing relations) ──
    console.log('\n=== CLEARING DATA ===');
    for (const t of ['comment','ticket','asset','service','payment','expense','request','policy_and_program','audit_logs','notification','push_subscriptions']) {
      try { await client.query('DELETE FROM "' + t + '"'); console.log('  cleared: ' + t); }
      catch(e) { console.warn('  skip ' + t + ': ' + e.message); }
    }
    const bkChk = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%backup%' OR table_name LIKE '%_bak' OR table_name LIKE 'bak_%')");
    for (const row of bkChk.rows) {
      try { await client.query('DELETE FROM "' + row.table_name + '"'); console.log('  cleared backup: ' + row.table_name); }
      catch(e) {}
    }

    await client.query('BEGIN');

    // ── 1. Load employees ─────────────────────────────────────────────────────
    console.log('\n=== LOADING EMPLOYEES ===');
    const empRes = await client.query("SELECT employee_id, full_name, email, username FROM employee WHERE deleted_at IS NULL ORDER BY employee_id");
    const empIds = empRes.rows.map(e => e.employee_id);
    console.log('  Found ' + empIds.length + ' employees');

    // Fix app_user_enabled
    await client.query("UPDATE employee SET app_user_enabled = false WHERE deleted_at IS NULL");
    await client.query("UPDATE employee SET app_user_enabled = true WHERE username ILIKE 'Neo.duong' OR username ILIKE 'leeanh1002%'");
    console.log('  app_user_enabled => true: Neo.duong + leeanh1002% only');

    const tableCheckRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const existingTables = new Set(tableCheckRes.rows.map(r => r.table_name));
    const hasExpenseTable = existingTables.has('expense');

    // Pick random approvers for tier assignments
    const pool9 = [...empIds].sort(() => Math.random() - 0.5).slice(0, 9);
    const [t1a, t1b, t1c, t2a, t2b, t2c, t3a, t3b, t3c] = pool9;

    const ALL_ELEMENTS = ['CONTRACT', 'EXPENSE', 'PAYMENT', 'SERVICE', 'ASSET'];

    // ── 2. Seed processes (policy_and_program) ────────────────────────────────
    console.log('\n=== SEEDING PROCESSES ===');
    const processes = [
      { id:'1', name:'IT Procurement Process',    type:'Process', t1:t1a, t2:t2a, t3:t3a, lvl:'3', dept:'674', pri:'High',     els:['ASSET', 'CONTRACT', 'SERVICE'] },
      { id:'2', name:'HR Onboarding Request',     type:'Process', t1:t1b, t2:t2a, t3:null,  lvl:'2', dept:'670', pri:'Medium',  els:['CONTRACT'] },
      { id:'3', name:'General Service Request',   type:'Process', t1:t1c, t2:t2b, t3:null,  lvl:'2', dept:'678', pri:'Low',    els:['SERVICE'] },
      { id:'4', name:'Finance & Budget Approval', type:'Process', t1:t1a, t2:t2c, t3:t3b,  lvl:'3', dept:'671', pri:'Critical',els:['EXPENSE', 'PAYMENT'] },
      { id:'5', name:'Payment Request (RPM)',     type:'Process', t1:t1a, t2:t2a, t3:t3a,  lvl:'3', dept:'671', pri:'High',   els:['EXPENSE', 'PAYMENT'] },
      { id:'6', name:'Admin & Office Management', type:'Process', t1:t1b, t2:t3a, t3:null,  lvl:'2', dept:'672', pri:'Low',    els:['ASSET', 'SERVICE'] },
      { id:'7', name:'Legal & Compliance Review', type:'Policy',  t1:t3a, t2:t3b, t3:null,  lvl:'2', dept:'673', pri:'Critical',els:['CONTRACT'] },
    ];

    for (const p of processes) {
      const desc = 'Approval process: ' + p.name + '. Requires ' + p.lvl + ' tier(s).';
      await client.query(`
        INSERT INTO policy_and_program
          (policy_id, policy_name, policy_type, description,
           tier1_approval, tier2_approval, tier3_approval,
           approval_level, elements, priority, department_id,
           policy_lead, sr_owner, company_id, log)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'MYCOMP-001','[]')
        ON CONFLICT (policy_id) DO UPDATE SET
          policy_name=EXCLUDED.policy_name, description=EXCLUDED.description,
          tier1_approval=EXCLUDED.tier1_approval, tier2_approval=EXCLUDED.tier2_approval,
          tier3_approval=EXCLUDED.tier3_approval, approval_level=EXCLUDED.approval_level,
          elements=EXCLUDED.elements, priority=EXCLUDED.priority, company_id=EXCLUDED.company_id
      `, [p.id, p.name, p.type, desc, p.t1, p.t2, p.t3, p.lvl,
          JSON.stringify(p.els), p.pri, p.dept, p.t1, p.t1]);
      console.log('  [' + p.id + '] ' + p.name + ' | T1:' + p.t1 + ' T2:' + p.t2 + (p.t3 ? ' T3:'+p.t3 : ''));
    }

    // ── 3. Seed Requests ──────────────────────────────────────────────────────
    console.log('\n=== SEEDING REQUESTS ===');
    const requestDefs = [
      ['Laptop Procurement for Engineering Team',    '1'],
      ['New Employee Onboarding Q3 2026',            '2'],
      ['Office Supplies Replenishment',              '6'],
      ['Marketing Campaign Budget Approval',         '4'],
      ['Server Infrastructure Upgrade',              '1'],
      ['Legal Contract Review - Vendor ABC',         '7'],
      ['Data Analytics Training Program',            '2'],
      ['Customer Support Software License',          '1'],
      ['Finance System Migration',                   '4'],
      ['Facility Maintenance - AC Repair',           '3'],
      ['Dev Tools Subscription Renewal',             '1'],
      ['HR Policy Update Distribution',              '2'],
      ['Cloud Storage Expansion 50TB',               '1'],
      ['Team Building Event Q3 2026',                '6'],
      ['Security Audit Services',                    '7'],
      ['Business Travel HCM Conference Aug 2026',    '6'],
      ['Printer Replacement Admin Dept',             '6'],
      ['ERP System Integration Services',            '3'],
      ['Q4 Budget Planning Resources',               '4'],
      ['Compliance Training Materials',              '2'],
      ['Payment Request for Q3 Software Licences',   '5'],
      ['Vendor Payment for Server Maintenance',      '5'],
      ['Office Expansion Deposit Payment',           '5']
    ];

    const seededReqs = [];
    for (let i = 0; i < 110; i++) {
      const [title, policyId] = requestDefs[i % requestDefs.length];
      const rid        = 'SR-2026-' + String(i+1).padStart(3,'0');
      const srStatus   = pick(STATUS_SR);
      const pStatus    = srStatus === 1 ? 7
                       : srStatus === 2 ? 7
                       : srStatus === 3 ? pick([7, 8, 9])
                       : srStatus === 4 ? 7
                       : srStatus === 5 ? 9
                       : srStatus === 6 ? 7
                       : 7;
      const requester  = pick(empIds);
      const owner      = pick(empIds.filter(e => e !== requester));
      const proc       = processes.find(p => p.id === policyId);

      const req = { request_id:rid, request_type:policyId, sr_status:srStatus,
                    process_status:pStatus, description:'Request for '+title+'. Submitted for departmental processing.',
                    requester, sr_owner:owner, policy_id_ref:policyId };
      if (!validate(requestSchema, req, rid)) continue;

      // Build approval_flow JSON
      const flowSteps = [];
      if (proc) {
        const lvlApprovers = [proc.t1, proc.t2, proc.t3].filter(Boolean).slice(0, parseInt(proc.lvl));
        lvlApprovers.forEach((approver, li) => {
          const st = srStatus === 3 || srStatus === 5 ? 3
                   : srStatus === 4 ? 4
                   : srStatus === 6 ? 4
                   : srStatus === 1 ? 7
                   : li === 0 ? pick([3, 2, 7])
                   : 7;
          flowSteps.push({ level: li+1, approver, status: st, updated_at: randDate(30) });
        });
      }

      await client.query(`
        INSERT INTO request
          (request_id, request_type, requester, sr_owner, description,
           sr_status, process_status, approval_level, approval_flow,
           policy_lead, elements,
           sr_creater, sr_created_date, company_id, log)
        VALUES ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9::jsonb,$10,$11::text[],$12,$13,'1','[]')
      `, [rid, policyId, requester, [owner],
          'Request for '+title+'. Submitted for departmental processing.',
          srStatus, pStatus, proc ? proc.lvl : '1',
          JSON.stringify({ steps: flowSteps, total_levels: flowSteps.length, current_level: 1 }),
          proc ? proc.t1 : null,
          proc ? proc.els : [],
          CREATOR, randDate(90)]);

      seededReqs.push(rid);
      console.log('  ' + rid + ' [' + srStatus + '/' + pStatus + ']');
    }

    // ── 4. Seed Expenses ──────────────────────────────────────────────────────
    console.log('\n=== SEEDING EXPENSES ===');
    if (hasExpenseTable) {
      const EXP_TYPES  = ['Hardware','Software','Travel','Training','Office','Marketing','Consulting','Utilities'];
      const COST_TYPES = ['CAPEX','OPEX'];
      let expCount = 0;
      for (let i = 0; i < 110; i++) {
        const rid = seededReqs[i % seededReqs.length];
        expCount++;
        const eid  = 'EXP-2026-' + String(expCount).padStart(3,'0');
        const etype = pick(EXP_TYPES);
        const val  = Math.round(Math.random() * 50000000 + 500000);
        const exp  = { expense_id:eid, expense:etype+' - '+eid, description:etype+' expense for '+rid, value_before_vat:val, request:rid };
        if (!validate(expenseSchema, exp, eid)) continue;
        await client.query(`
          INSERT INTO expense (expense_id, request, expense, description, employee, value_before_vat, currency, expense_type, cost_type, created_by, created_date, log, my_company)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]','Terax Tech Group')
        `, [eid, rid, exp.expense, exp.description, pick(empIds), val, pick(CURRENCIES), etype, pick(COST_TYPES), CREATOR, randDate(60)]);
      }
      console.log('  Seeded ' + expCount + ' expenses');
    } else {
      console.log('  Skipping expenses (table does not exist)');
    }

    // ── 5. Seed Payments ──────────────────────────────────────────────────────
    console.log('\n=== SEEDING PAYMENTS ===');
    const PMT_TYPES   = ['Outgoing', 'Incoming'];
    const PMT_METHODS = ['Wire Transfer','Cash Payment','Card Payment','Cheque'];
    // Fetch seeded request statuses
    const reqStatusRes = await client.query('SELECT request_id, sr_status FROM request');
    const reqStatusMap = {};
    reqStatusRes.rows.forEach(r => {
      reqStatusMap[r.request_id] = r.sr_status;
    });

    let pmtCount = 0;
    for (let i = 0; i < 110; i++) {
      const rid = seededReqs[i % seededReqs.length];
      pmtCount++;
      const pid  = 'PAY-2026-' + String(pmtCount).padStart(3,'0');
      const amt  = Math.round(Math.random() * 100000000 + 1000000);
      const parentSrStatus = reqStatusMap[rid] || 1;
      const pmtStatus = parentSrStatus === 5 ? 32
                      : parentSrStatus === 3 ? pick([31, 32])
                      : 30;
      const pmt  = { payment_id:pid, payment_description:'Payment for '+rid+' item '+(i+1), value:amt, payment_status:pmtStatus, request:rid };
      if (!validate(paymentSchema, pmt, pid)) continue;
      await client.query(`
        INSERT INTO payment (payment_id, request, payment_type, payment_description, value, currency, payment_method, payment_status, payment_request, log, my_company)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'[]','Terax Tech Group')
      `, [pid, rid, pick(PMT_TYPES), pmt.payment_description, amt, pick(CURRENCIES), pick(PMT_METHODS), pmtStatus, null]);
    }
    console.log('  Seeded ' + pmtCount + ' payments');

    // ── 6. Seed Services ──────────────────────────────────────────────────────
    console.log('\n=== SEEDING SERVICES ===');
    const SVC_TYPES = ['Maintenance','Installation','Consulting','Cleaning','Repair','Training','Delivery'];
    const svcNames  = ['Office AC Maintenance','Network Infrastructure Setup','Data Migration Consulting',
      'Security Camera Installation','Elevator Maintenance','Website Development',
      'Graphic Design Services','Translation Services','Audit Consulting','Cleaning Service Contract'];
    let svcCount = 0;
    for (let i = 0; i < 110; i++) {
      svcCount++;
      const sid = 'SVC-2026-' + String(svcCount).padStart(3,'0');
      const baseName = svcNames[i % svcNames.length];
      const svcStatus = pick([27, 28, 29, 26]); // Pending=27, In Progress=28, Completed=29, Draft=26
      const svc = { service_id:sid, service_name:baseName, status:svcStatus, request:seededReqs[i % seededReqs.length] };
      if (!validate(serviceSchema, svc, sid)) continue;
      await client.query(`
        INSERT INTO service (service_id, request, service_type, service_name, status, log, my_company)
        VALUES ($1,$2,$3,$4,$5,'[]','Terax Tech Group')
      `, [sid, svc.request, pick(SVC_TYPES), svc.service_name, svc.status]);
    }
    console.log('  Seeded ' + svcCount + ' services');

    // ── 7. Seed Assets ────────────────────────────────────────────────────────
    console.log('\n=== SEEDING ASSETS ===');
    const AST_TYPES = ['Hardware','Furniture','Vehicle','Electronics','Software License','Tool'];
    const astNames  = ['MacBook Pro 16 2025','Dell Monitor 27 inch','Ergonomic Office Chair',
      'Standing Desk Adjustable','iPad Pro 12.9 inch','Cisco Router X500',
      'Canon A3 Printer','UPS Battery Backup 3KVA','NAS Storage 24TB',
      'Conference Projector 4K','Wireless Keyboard Mouse Set','IP Camera System 8ch'];
    let astCount = 0;
    for (let i = 0; i < 110; i++) {
      astCount++;
      const aid = 'AST-2026-' + String(astCount).padStart(3,'0');
      const baseName = astNames[i % astNames.length];
      const astStatus = pick([22, 23, 25, 21, 24]); // Pending=22, In Progress=23, Completed=25, Draft=21, Approved=24
      const ast = { office_asset_id:aid, asset_name:baseName, status:astStatus, request:seededReqs[i % seededReqs.length] };
      if (!validate(assetSchema, ast, aid)) continue;
      await client.query(`
        INSERT INTO asset (office_asset_id, asset_name, request, type, qty, status, purchase_cost, currency, log)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]')
      `, [aid, ast.asset_name, ast.request, pick(AST_TYPES), Math.floor(Math.random()*5)+1,
          ast.status, Math.round(Math.random()*80000000+2000000), pick(CURRENCIES)]);
    }
    console.log('  Seeded ' + astCount + ' assets');

    // ── 8. Seed Tickets ───────────────────────────────────────────────────────
    console.log('\n=== SEEDING TICKETS ===');
    const TKT_TYPES = ['IT Support','HR Request','Facilities','General'];
    const tktDefs   = [
      ['Cannot access ERP after password reset',  'High',   'Locked out of ERP. Urgent access restore needed.'],
      ['Slow network in meeting room B',           'Medium', 'Network speed below threshold. Affects video calls.'],
      ['Additional monitor setup request',         'Low',    'Need second monitor for Finance workstation.'],
      ['Email not syncing on mobile',              'Medium', 'Outlook not syncing since OS update.'],
      ['Printer offline - Admin floor 3',          'High',   'Main printer floor 3 not responding. 20+ jobs queued.'],
    ];
    let tktCount = 0;
    for (let i = 0; i < 110; i++) {
      const [desc, pri, fullDesc] = tktDefs[i % tktDefs.length];
      tktCount++;
      const tid = 'TKT-2026-' + String(tktCount).padStart(3,'0');
      const tktStatus = pick([10, 11, 12, 13]); // Draft=10, Pending=11, In Progress=12, Completed=13
      const tkt = { ticket_id:tid, ticket_type:pick(TKT_TYPES), sr_status:tktStatus };
      if (!validate(ticketSchema, tkt, tid)) continue;
      await client.query(`
        INSERT INTO ticket (ticket_id, ticket_type, sr_creater, requester, description, sr_status, process_status, approval_level, sr_created_date, log)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'[]')
        ON CONFLICT (ticket_id) DO NOTHING
      `, [tid, tkt.ticket_type, pick(empIds), pick(empIds), fullDesc, tkt.sr_status, 14, '1', randDate(30)]);
    }
    console.log('  Seeded ' + tktCount + ' tickets');

    // ── 9. Seed Comments ──────────────────────────────────────────────────────
    console.log('\n=== SEEDING COMMENTS ===');
    const cmtTexts = [
      'Please expedite - blocking the team workflow.',
      'Documents submitted for review.',
      'Approved at tier 1 — forwarding to finance for sign-off.',
      'Additional information requested from requester.',
      'Vendor confirmed delivery timeline next week.',
      'Budget allocated. Proceed with procurement.',
      'Request on hold pending management decision.',
      'Invoice received and verified. Ready for payment.',
    ];
    let cmtCount = 0;
    for (let i = 0; i < 110; i++) {
      const rid = seededReqs[i % seededReqs.length];
      cmtCount++;
      const cid      = 'CMT-2026-' + String(cmtCount).padStart(4,'0');
      const commenter = pick(empIds);
      await client.query(`
        INSERT INTO comment (comment_id, request, comment, comment_by, comment_date, logs)
        VALUES ($1,$2,$3,$4,$5,'[]')
        ON CONFLICT (comment_id) DO NOTHING
      `, [cid, rid, pick(cmtTexts), commenter, randDate(15)]);
    }
    console.log('  Seeded ' + cmtCount + ' comments');

    await client.query('COMMIT');
    console.log('\n=== SEED COMPLETE ===');

    // Final count summary
    const countTables = ['policy_and_program','request','expense','payment','service','asset','ticket','comment','audit_logs'];
    for (const t of countTables) {
      try { const r = await pool.query('SELECT COUNT(*) FROM "' + t + '"'); console.log('  ' + t + ': ' + r.rows[0].count); }
      catch(e) { console.log('  ' + t + ': error'); }
    }
    // Verify app_user_enabled
    const uCheck = await pool.query("SELECT username, app_user_enabled FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL");
    console.log('\n  Users with app_user_enabled=true:');
    uCheck.rows.forEach(u => console.log('    ' + u.username));

  } catch(err) {
    await client.query('ROLLBACK');
    console.error('\nSEED FAILED (rolled back):', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
})();
