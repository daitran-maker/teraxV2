/**
 * SCRIPT 1: Import MPS EMPLOYEE → CRC EMPLOYEE table
 * 
 * DRY_RUN = true  → chỉ in preview, không touch DB
 * DRY_RUN = false → thực sự TRUNCATE + INSERT vào DB
 * 
 * Chạy: node import_mps_employee.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // ← đổi thành false khi muốn import thật

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== STATUS MAPPING =====
// MPS: STATUS = 0 (inactive) / 1 (active)
function mapStatus(val) {
  return val === 1 ? 'Active' : 'Inactive';
}

// ===== DEPARTMENT LOOKUP (MPS ID → name) =====
const DEPT_LOOKUP = {
  669: 'Board of Director',
  670: 'Operation',
  671: 'Operation',
  672: 'Sales and Marketing',
  673: 'Finance',
  674: 'Technical',
  675: 'App & AI',
  676: 'Technical',
  677: 'Sales and Marketing',
  678: 'Operation',
  679: 'Sales and Marketing',
};

// ===== TEAM LOOKUP (MPS ID → name) =====
const TEAM_LOOKUP = {
  298: null,
  299: 'Presales',
  300: 'System',
  301: 'Operation',
  302: 'NPD',
  303: 'Application & AI',
  304: 'Service Coordinator',
  305: 'Database',
  306: 'Sales Director',
  307: 'Finance',
  308: 'Managing Director',
  309: 'Sales Operation',
  310: 'Sales Manager',
};

const POSITION_LOOKUP = {
  "1848": "Trainer DBA",
  "1849": "DBA",
  "1850": "Junior BigData Engineer",
  "1851": "Chief Sales Officer",
  "1852": "QA Executive",
  "1853": "Intern Sales",
  "1854": "AI Engineer",
  "1855": "Chief Accountant",
  "1856": "Appsheet Developer",
  "1857": "Operation Admin",
  "1858": "Cloud Engineer",
  "1859": "Technical Service Manager",
  "1860": "Trainer",
  "1861": "Managing Director",
  "1862": "Executive Assistant",
  "1863": "Deputy Technical Director - Regional Service Delivery",
  "1864": "Intern System Engineer",
  "1865": "Pre-Sales",
  "1866": "Fresher Technical Coordinator",
  "1867": "Senior Sales Manager",
  "1868": "Junior Technical Coordinator",
  "1869": "Technical Service Delivery",
  "1870": "Fresher DBA",
  "1871": "Service Coordinator",
  "1872": "Junior System Engineer",
  "1873": "Deputy Technical Director",
  "1874": "Senior System Engineer",
  "1875": "Sales Director",
  "1876": "Business Practice",
  "1877": "Accountant",
  "1878": "HR Executive",
  "1879": "Sale Executive",
  "1880": "Senior DBA",
  "1881": "Junior DBA",
  "1882": "Sales Manager",
  "1883": "Project Manager",
  "1884": "Project & Service Delivery Manager",
  "1885": "Legal Representative",
  "1886": "Operation Manager",
  "1887": "Graphic Designer Intern",
  "1888": "System Engineer",
  "1889": "Sales Admin",
  "1890": "Sale Director",
  "1891": "Solutions Director",
  "1892": "Junior Sales Admin",
  "1893": "Pre-Sale",
  "1894": "Technical Delivery Executive",
  "1895": "Junior Data Engineer",
  "1896": "Sale Manager",
  "1897": "Admin",
  "1898": "Deputy New Production Manager",
  "1899": "AI-Dev Engineer",
  "1900": "Fresher System Engineer",
  "1901": "System Manager",
  "1902": "Technical Manager",
  "1903": "Presales & System Engineer",
  "1904": "Junior Presales",
  "1905": "Data Engineer",
  "1906": "Technical Data Coordinator"
};

function resolvePosition(id) {
  return id ? (POSITION_LOOKUP[id] || String(id)) : null;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EMPLOYEE IMPORT — DRY_RUN=${DRY_RUN}`);
  console.log('='.repeat(60));

  // Read mymps.json
  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json or data/mymps.json!');
  }
  const mymps = JSON.parse(raw);
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  console.log(`Total MPS employees: ${empRows.length}`);
  
  // Build location map from LOCATION_BASE -> CITY -> NAME
  const cityMap = {};
  if (mymps.tables['CITY']?.rows) {
    for (const row of mymps.tables['CITY'].rows) {
      cityMap[row.ID] = row.NAME;
    }
  }
  
  function resolveLocation(id) {
    if (!id) return null;
    // For location_base, the ID stored in employee (ID__LOCATION_BASE) maps directly to a City ID!
    // Since we know PK__CITY is the primary ID linking to CITY... wait! 
    // In our check, LOCATION_BASE table doesn't have an ID, it just has PK__CITY. 
    // And ID__LOCATION_BASE is actually a City ID.
    return cityMap[id] || String(id);
  }

  // Build employee UUID to Email Map for resolving direct_manager
  const uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });

  function resolveEmp(val) {
    if (!val) return null;
    const clean = String(val).toUpperCase().trim();
    if (uuidToEmailMap.has(clean)) {
      return uuidToEmailMap.get(clean);
    }
    return val;
  }

  // Filter: only employees WITH email
  const withEmail = empRows.filter(r => r.EMAIL && r.EMAIL.trim());
  console.log(`With email (importable): ${withEmail.length}`);
  console.log(`Without email (skipped): ${empRows.length - withEmail.length}`);

  // Build mapped rows
  const mapped = withEmail.map(r => ({
    // === IDENTITY ===
    employee_id: r.ID ? String(r.ID).trim() : null,
    email: r.EMAIL ? r.EMAIL.trim().toLowerCase() : null,
    full_name: r.FULL_NAME || null,
    gen: r.GEN !== null ? String(r.GEN) : null,          // 0=female, 1=male typically
    employee_level: r.EMPLOYEE_LEVEL || null,

    // === ORG STRUCTURE ===
    department_id: r.DEPARTMENT ? String(r.DEPARTMENT) : null,
    // team stored in log/elements since no CRC column — store as note
    direct_manager: resolveEmp(r.DIRECT_MANAGER),
    company_id: r.MY_COMPANY ? String(r.MY_COMPANY) : null,
    location_base: resolveLocation(r.ID__LOCATION_BASE),
    position: resolvePosition(r.ID__POSITION),

    // === CONTACT ===
    phone: r.PHONE || null,
    address: r.ADDRESS || null,
    emergency_contact_name: r.EMERGENCY_CONTACT_NAME || null,
    emergency_contact_phone: r.EMERGENCY_CONTACT_PHONE || null,

    // === HR ===
    social_insurance_code: r.SOCIAL_INSURANCE_CODE || null,
    pit_code: r.PIT_CODE || null,
    start_date: r.START_DATE ? r.START_DATE.split('T')[0] : null,
    end_date: r.END_DATE ? r.END_DATE.split('T')[0] : null,
    status: mapStatus(r.STATUS),
    sow: r.SOW || null,

    // === BANK ===
    bank_account: r.BANK_ACCOUNT || null,
    bank_name: r.BANK_NAME || null,
    bank_city: r.BANK_CITY || null,

    // === CRC APP SPECIFIC ===
    role: 'Staff',                  // default role — update manually if needed
    created_by: 'mps_import',
    created_date: new Date(),

    // Store team info and original Hex UUID in log since no team column in employee table
    log: `MPS_ID:${r.ID || 'null'}` + (r.ID__TEAM ? ` | MPS_TEAM_ID:${r.ID__TEAM} (${TEAM_LOOKUP[r.ID__TEAM] || 'Unknown'})` : ''),
  }));

  // Preview
  console.log('\n===== SAMPLE (first 5 rows to be imported) =====');
  mapped.slice(0, 5).forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r, null, 2)));

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total rows to INSERT: ${mapped.length}`);
  console.log(`Active employees:   ${mapped.filter(r => r.status === 'Active').length}`);
  console.log(`Inactive employees: ${mapped.filter(r => r.status === 'Inactive').length}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    console.log('   Set DRY_RUN=false to execute.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING employee table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: employee CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE employee CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting employees (Pass 1: No managers)...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO employee (
          employee_id, email, full_name, gen, employee_level,
          department_id, direct_manager, company_id, location_base, position,
          phone, address, emergency_contact_name, emergency_contact_phone,
          social_insurance_code, pit_code,
          start_date, end_date, status, sow,
          bank_account, bank_name, bank_city,
          role, created_by, created_date, log
        ) VALUES (
          $1,$2,$3,$4,$5,$6,null,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,$25,$26,$27
        ) ON CONFLICT (email) DO NOTHING
      `, [
        r.employee_id, r.email, r.full_name, r.gen, r.employee_level,
        r.department_id, r.company_id, r.location_base, r.position,
        r.phone, r.address, r.emergency_contact_name, r.emergency_contact_phone,
        r.social_insurance_code, r.pit_code,
        r.start_date, r.end_date, r.status, r.sow,
        r.bank_account, r.bank_name, r.bank_city,
        r.role, r.created_by, r.created_date, r.log
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed to insert ${r.email}:`, e.message);
    }
  }
  console.log(`\n✅ Pass 1 Done: ${inserted}/${mapped.length} employees inserted.`);

  console.log('\n📥 Updating direct managers (Pass 2)...');
  let updatedManagers = 0;
  for (const r of mapped) {
    if (r.direct_manager) {
      try {
        await pool.query(`
          UPDATE employee 
          SET direct_manager = (SELECT employee_id FROM employee WHERE email = $1) 
          WHERE employee_id = $2
        `, [r.direct_manager, r.employee_id]);
        updatedManagers++;
      } catch (e) {
        console.error(`  ❌ Failed to update manager for ${r.email}:`, e.message);
      }
    }
  }
  console.log(`\n✅ Pass 2 Done: ${updatedManagers} direct managers updated.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
