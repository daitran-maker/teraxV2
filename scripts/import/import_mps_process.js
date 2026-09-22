/**
 * SCRIPT 2: Import MPS PROCESS → CRC POLICY_AND_PROGRAM table
 *
 * DRY_RUN = true  → chỉ in preview, không touch DB
 * DRY_RUN = false → thực sự TRUNCATE + INSERT vào DB
 *
 * Lưu ý:
 * - MPS.PROCESS.ID (NUMBER) → policy_id = String(ID) e.g. "38"
 *   → REQUEST.request_type cũng dùng String(ID) → match hoàn toàn
 * - tier1_approval: VARCHAR2 trong MPS → có data (email / "Direct manager")
 * - tier2_approval, tier3_approval: RAW type trong MPS → null trong export
 *   → Khi có full data, điền thêm sau
 * - approval_level: "Tier 1" / "Tier 2" / "Tier 3" / "Tier 0" → match 100% với CRC
 *
 * Chạy: node import_mps_process.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // ← đổi thành false khi muốn import thật

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PROCESS (POLICY_AND_PROGRAM) IMPORT — DRY_RUN=${DRY_RUN}`);
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
  
  // Build employee UUID to Email Map
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  const uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });
  console.log(`Built employee UUID mapping: ${uuidToEmailMap.size} resolved employees.`);

  function resolveEmp(val) {
    if (!val) return null;
    const clean = String(val).toUpperCase().trim();
    if (uuidToEmailMap.has(clean)) {
      return uuidToEmailMap.get(clean);
    }
    return val; // Keep original if not a Hex UUID (e.g. "Direct manager" or already email)
  }

  const procRows = mymps.tables['PROCESS']?.rows || [];
  console.log(`Total MPS processes: ${procRows.length}`);

  // Build mapped rows
  const mapped = procRows.map(r => ({
    // policy_id = String of MPS numeric ID (e.g. "38")
    // This ensures REQUEST.request_type (also stored as "38") can join correctly
    policy_id: String(r.ID),
    policy_type: r.PROCESS_TYPE || null,
    policy_name: r.PROCESS_NAME || null,
    description: r.DESCRIPTION || null,

    // Procedure
    procedure_file: null,   // BLOB — not exportable from MPS
    procedure_link: r.LINK || null,

    // Approvers resolved via UUID map
    tier1_approval: resolveEmp(r['TIER_1_APPROVAL__EMPLOYEE']),
    tier2_approval: resolveEmp(r['TIER_2_APPROVAL__EMPLOYEE']),
    tier3_approval: resolveEmp(r['TIER_3_APPROVAL__EMPLOYEE']),

    // approval_level: "Tier 0" / "Tier 1" / "Tier 2" / "Tier 3"
    // Matches CRC App format exactly
    approval_level: r.APPROVAL_LEVEL || null,

    // Policy lead / SR owner resolved via UUID map
    policy_lead: resolveEmp(r['PROCESS_LEAD__EMPLOYEE']),
    sr_owner: resolveEmp(r['SR_OWNER__EMPLOYEE']),

    // Elements (process element tags)
    elements: null,   // Junction table data not available in this export

    // Metadata
    created_by: 'mps_import',
    created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
  }));

  // Preview by type
  const byType = {};
  mapped.forEach(r => {
    const t = r.policy_type || 'Unknown';
    if (!byType[t]) byType[t] = 0;
    byType[t]++;
  });

  console.log('\n===== PROCESS TYPES DISTRIBUTION =====');
  Object.entries(byType).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

  console.log('\n===== SAMPLE (first 5 rows) =====');
  mapped.slice(0, 5).forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r, null, 2)));

  console.log('\n===== APPROVAL LEVEL DISTRIBUTION =====');
  const byLevel = {};
  mapped.forEach(r => {
    const l = r.approval_level || 'null';
    byLevel[l] = (byLevel[l] || 0) + 1;
  });
  Object.entries(byLevel).forEach(([l, c]) => console.log(`  ${l}: ${c}`));

  console.log('\n===== tier1_approval samples =====');
  const t1Samples = [...new Set(mapped.map(r => r.tier1_approval))].filter(Boolean).slice(0, 10);
  t1Samples.forEach(v => console.log(`  "${v}"`));

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total to INSERT: ${mapped.length}`);
  console.log(`With tier1_approval: ${mapped.filter(r => r.tier1_approval).length}`);
  console.log(`With tier2_approval: ${mapped.filter(r => r.tier2_approval).length}`);
  console.log(`With tier3_approval: ${mapped.filter(r => r.tier3_approval).length}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    console.log('   Set DRY_RUN=false to execute.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING policy_and_program table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: policy_and_program CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE policy_and_program CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting processes...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO policy_and_program (
          policy_id, policy_type, policy_name, description,
          procedure_file, procedure_link,
          tier1_approval, tier2_approval, tier3_approval,
          approval_level, policy_lead, sr_owner, elements
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
        ) ON CONFLICT (policy_id) DO NOTHING
      `, [
        r.policy_id, r.policy_type, r.policy_name, r.description,
        r.procedure_file, r.procedure_link,
        r.tier1_approval, r.tier2_approval, r.tier3_approval,
        r.approval_level, r.policy_lead, r.sr_owner, r.elements
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed [${r.policy_id}] ${r.policy_name}:`, e.message);
    }
  }

  console.log(`\n✅ DONE: ${inserted}/${mapped.length} processes inserted.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
