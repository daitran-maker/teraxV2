require('dotenv').config();
const XLSX = require('xlsx');
const pool = require('./server/db');

async function importData() {
  const workbook = XLSX.readFile('MPS - CPI _ DOCUMENT LISTS.xlsx');
  
  try {
    // 1. Import Company
    console.log('Importing Companies...');
    const compSheet = workbook.Sheets['Company'];
    if (compSheet) {
      const companies = XLSX.utils.sheet_to_json(compSheet);
      for (const row of companies) {
        if (!row['Company Name']) continue;
        const name = row['Company Name'].trim();
        const shortName = name.split(' ')[0] || name; // Just a guess for shortname
        
        await pool.query(`
          INSERT INTO my_company (company_fullname, company_shortname, country, city, address)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [name, shortName, row['Country'], row['City'], row['Registered Office']]);
      }
    }

    // 2. Import Department
    console.log('Importing Departments...');
    const deptSheet = workbook.Sheets['Department'];
    if (deptSheet) {
      const depts = XLSX.utils.sheet_to_json(deptSheet);
      for (const row of depts) {
        if (!row['Department']) continue;
        const name = row['Department'].trim();
        
        await pool.query(`
          INSERT INTO department (department_name)
          VALUES ($1)
          ON CONFLICT DO NOTHING
        `, [name]);
      }
    }

    // 3. Import Employee
    console.log('Importing Employees...');
    const empSheet = workbook.Sheets['Employee'];
    if (empSheet) {
      const emps = XLSX.utils.sheet_to_json(empSheet);
      for (const row of emps) {
        if (!row['Email']) continue;
        const email = row['Email'].trim().toLowerCase();
        const fullName = row['Full Name'];
        const phone = row['Phone Number'];
        const gen = row['Gender'];
        const position = row['Position'];
        const directManager = row['Direct manager'];
        
        await pool.query(`
          INSERT INTO employee (email, full_name, phone, gen, position, direct_manager)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (email) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            gen = EXCLUDED.gen,
            position = EXCLUDED.position,
            direct_manager = EXCLUDED.direct_manager
        `, [email, fullName, phone, gen, position, directManager]);
      }
    }

    // 4. Import Process (Policy)
    console.log('Importing Processes/Policies...');
    const processSheet = workbook.Sheets['Process'];
    if (processSheet) {
      const processes = XLSX.utils.sheet_to_json(processSheet);
      for (const row of processes) {
        if (!row['Policy name']) continue;
        const name = row['Policy name'].trim();
        const desc = row['Description'];
        const pType = row['Policy type'];
        const lead = row['Policy lead'];
        const owner = row['SR owner'];
        const tier1 = row['Tier 1'];
        const tier2 = row['Tier 2'];
        const tier3 = row['Tier 3'];
        
        await pool.query(`
          INSERT INTO policy_and_program (policy_id, policy_name, description, policy_type, policy_lead, sr_owner, tier1_approval, tier2_approval, tier3_approval)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [name, desc, pType, lead, owner, tier1, tier2, tier3]);
      }
    }

    console.log('✅ Import completed successfully!');
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    pool.end();
  }
}

importData();
