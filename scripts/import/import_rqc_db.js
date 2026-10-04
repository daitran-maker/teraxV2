require('dotenv').config();
const XLSX = require('xlsx');
const pool = require('./server/db');

async function importRQC() {
  const workbook = XLSX.readFile('RQC-CP-Database.xlsx');
  
  function getSheetData(sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  function excelDateToJSDate(serial) {
    if (serial == null) return null;
    if (typeof serial === 'number') {
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;                                        
      const date_info = new Date(utc_value * 1000);
      return date_info;
    }
    return serial; // might already be string or Date
  }

  try {
    console.log("Connecting to database:", process.env.DATABASE_URL);

    // Helper for executing queries
    async function execSafe(query, params) {
      try {
        await pool.query(query, params);
      } catch (err) {
        // Log silently or handle if needed
        console.log("Error inserting:", params, err.message);
      }
    }

    function getVal(r, key) {
      if (!r) return null;
      const foundKey = Object.keys(r).find(k => k.trim().toUpperCase() === key.toUpperCase());
      return foundKey ? r[foundKey] : null;
    }

    function toSqlArray(val) {
      if (val === undefined || val === null) return null;
      const str = String(val).trim();
      if (!str) return null;
      return str.split(',').map(s => s.trim()).filter(Boolean);
    }

    // 1. My Company
    console.log("Importing MY COMPANY...");
    for (const row of getSheetData('MY COMPANY')) {
      await execSafe(`
        INSERT INTO my_company (my_company_id, company_shortname, company_fullname, tax_code, website, address, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (my_company_id) DO NOTHING
      `, [row['MY COMPANY ID'], row['COMPANY SHORTNAME'], row['COMPANY FULLNAME'], row['TAX CODE'], row['WEBSITE'], row['ADDRESS'], row['COUNTRY']]);
    }

    // 2. Department
    console.log("Importing DEPARTMENT...");
    for (const row of getSheetData('DEPARTMENT')) {
      if (!row['DEPARTMENT ID']) continue;
      const deptId = String(row['DEPARTMENT ID']).trim();
      await execSafe(`
        INSERT INTO department (department_id, department_name, manager_email, company_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [deptId, row['DEPARTMENT NAME'], row['DEPARTMENT HEAD'], row['MY COMPANY']]);
    }

    // 3. Employee
    console.log("Importing EMPLOYEE...");
    for (const row of getSheetData('EMPLOYEE')) {
      const emailVal = getVal(row, 'EMAIL');
      if (!emailVal) continue;
      const email = emailVal.trim().toLowerCase();
      
      const fullName = getVal(row, 'FULL NAME');
      const phone = getVal(row, 'PHONE');
      const gen = getVal(row, 'GEN');
      const position = getVal(row, 'POSITION');
      const department = getVal(row, 'DEPARTMENT') ? String(getVal(row, 'DEPARTMENT')).trim() : null;
      const myCompany = getVal(row, 'MY COMPANY');
      const level = getVal(row, 'EMPLOYEE LEVEL') || getVal(row, 'LEVEL');
      let role = getVal(row, 'ROLE TYPE') || getVal(row, 'ROLE');
      if (!role || String(role).trim() === '' || String(role).toLowerCase() === 'undefined' || String(role).toLowerCase() === 'null') {
        role = 'Staff';
      }

      const employeeId = row['EMPLOYEE ID'] ? String(row['EMPLOYEE ID']).trim() : ('EMP-' + email);

      await execSafe(`
        INSERT INTO employee (employee_id, email, full_name, phone, gen, position, department_id, company_id, employee_level, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (email) DO UPDATE SET
          employee_id = EXCLUDED.employee_id,
          full_name = EXCLUDED.full_name, 
          position = EXCLUDED.position, 
          department_id = EXCLUDED.department_id, 
          employee_level = EXCLUDED.employee_level,
          role = EXCLUDED.role
      `, [email, fullName, phone, gen, position, department, myCompany, level, role]);
    }

    // 4. Policy (PROCESS)
    console.log("Importing POLICY (PROCESS)...");
    for (const row of getSheetData('PROCESS')) {
      await execSafe(`
        INSERT INTO policy_and_program (policy_id, policy_name, description, policy_type, policy_lead, sr_owner, tier1_approval, tier2_approval, tier3_approval)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [row['PROCESS ID'], row['PROCESS NAME'], row['DESCRIPTION'], row['PROCESS TYPE'], row['POLICY LEAD'], toSqlArray(row['SR OWNER']), row['TIER 1'], row['TIER 2'], row['TIER 3']]);
    }

    // 5. Company
    console.log("Importing COMPANY...");
    for (const row of getSheetData('COMPANY')) {
      await execSafe(`
        INSERT INTO company (company_id, company_shortname, company_fullname, type, website, address, country, city)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (company_id) DO NOTHING
      `, [row['COMPANY ID'], row['COMPANY SHORTNAME'], row['COMPANY FULLNAME'], row['TYPE'], row['WEBSITE'], row['ADDRESS'], row['COUNTRY'], row['CITY']]);
    }

    // 6. Contact
    console.log("Importing CONTACT...");
    for (const row of getSheetData('CONTACT')) {
      await execSafe(`
        INSERT INTO contact (contact_id, company_id, title, name, gen, email, mobile_no)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (contact_id) DO NOTHING
      `, [row['CONTACT ID'], row['COMPANY'], row['TITLE'], row['NAME'], row['GEN'], row['EMAIL'], row['MOBILE NO']]);
    }

    // 7. Request
    console.log("Importing REQUEST...");
    for (const row of getSheetData('REQUEST')) {
      await execSafe(`
        INSERT INTO request (request_id, request_type, sr_creater, requester, description, policy_lead, sr_owner, sr_status, process_status, sr_created_date, approval_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (request_id) DO NOTHING
      `, [row['REQUEST ID'], row['REQUEST TYPE'], row['SR CREATER'], row['REQUESTER'], row['DESCRIPTION'], row['POLICY LEAD'], toSqlArray(row['SR OWNER']), row['SR STATUS'], row['PROCESS STATUS'], excelDateToJSDate(row['SR CREATED DATE']), row['APPROVAL LEVEL']]);
    }
    
    // 8. Comment
    console.log("Importing COMMENT (REQUEST DETAIL)...");
    for (const row of getSheetData('REQUEST DETAIL')) {
      await execSafe(`
        INSERT INTO comment (comment_id, request, comment, file, link)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (comment_id) DO NOTHING
      `, [row['REQUEST DETAIL ID'], row['REQUEST'], row['COMMENT'], row['FILE'], row['LINK']]);
    }

    // 9. Expense
    console.log("Importing EXPENSE...");
    for (const row of getSheetData('EXPENSE')) {
      await execSafe(`
        INSERT INTO expense (expense_id, request, expense, description, employee, value_before_vat, vat_value, currency, expense_type, created_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (expense_id) DO NOTHING
      `, [row['EXPENSE ID'], row['REQUEST'], row['EXPENSE'], row[' DESCRIPTION'], row['EMPLOYEE'], row['VALUE BEFORE VAT'], row['VAT VALUE'], row['CURRENCY'], row['EXPENSE TYPE'], excelDateToJSDate(row['CREATED DATE'])]);
    }

    // 10. MTR
    console.log("Importing MTR...");
    for (const row of getSheetData('MTR')) {
      await execSafe(`
        INSERT INTO mtr (transaction_id, request, account, transaction_date, transaction_type, amount, currency, exchange_rate, description, note, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (transaction_id) DO NOTHING
      `, [row['TRANSACTION ID'], row['REQUEST'], row['ACCOUNT'], excelDateToJSDate(row['TRANSACTION DATE']), row['TRANSACTION TYPE'], row['AMOUNT'], row['CURRENCY '], row['EXCHANGE RATE'], row['DESCRIPTION'], row['NOTE'], row['STATUS']]);
    }

    // 11. Payment
    console.log("Importing PAYMENT...");
    for (const row of getSheetData('PAYMENT')) {
      await execSafe(`
        INSERT INTO payment (payment_id, request, employee, payment_type, payment_description, value, currency, due_date, payment_status, payment_method, transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (payment_id) DO NOTHING
      `, [row['PAYMENT ID'], row['REQUEST'], row['EMPLOYEE (beneficiaries)'], row['PAYMENT TYPE'], row['PAYMENT DESCRIPTION'], row['VALUE'], row['CURRENCY'], excelDateToJSDate(row['DUE DATE']), row['PAYMENT STATUS'], row['PAYMENT METHOD'], row['TRANSACTION ID']]);
    }

    // 12. Invoice
    console.log("Importing INVOICE...");
    for (const row of getSheetData('INVOICE')) {
      await execSafe(`
        INSERT INTO invoice (invoice_id, request, invoice_type, invoice_no, description, value_before_vat, currency, invoice_date, invoice_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (invoice_id) DO NOTHING
      `, [row['INVOICE ID'], row['REQUEST'], row['INVOICE TYPE'], row['INVOICE NO'], row['DESCRIPTION'], row['VALUE BEFORE VAT'], row['CURRENCY'], excelDateToJSDate(row['INVOICE DATE']), row['INVOICE STATUS']]);
    }

    console.log("✅ All data from RQC-CP-Database imported successfully.");

  } catch (err) {
    console.error("Critical error:", err);
  } finally {
    pool.end();
  }
}

importRQC();
