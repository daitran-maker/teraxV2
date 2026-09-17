require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Find RQC-CP-Database.xlsx path
let excelPath = 'RQC-CP-Database.xlsx';
if (!fs.existsSync(excelPath)) {
  excelPath = 'data/RQC-CP-Database.xlsx';
}
if (!fs.existsSync(excelPath)) {
  excelPath = path.join(__dirname, '../../data/RQC-CP-Database.xlsx');
}

console.log(`Using Excel file: ${excelPath}`);
const workbook = XLSX.readFile(excelPath);

function getSheetData(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`Warning: Sheet ${sheetName} not found in Excel.`);
    return [];
  }
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

function roundVal(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : Math.round(num);
}

function toSqlArray(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

async function execSafe(query, params) {
  try {
    await pool.query(query, params);
  } catch (err) {
    console.error("Error executing query:", err.message, "Params:", params);
    throw err; // Re-throw to fail fast and inspect
  }
}

function getVal(r, key) {
  if (!r) return null;
  const foundKey = Object.keys(r).find(k => k.trim().toUpperCase() === key.toUpperCase());
  return foundKey ? r[foundKey] : null;
}

async function restoreAll() {
  try {
    console.log("Connecting to VPS database:", process.env.DATABASE_URL);

    // Schema updates to support larger values
    console.log("Updating column types to bigint to prevent integer overflows...");
    await pool.query(`
      ALTER TABLE mtr ALTER COLUMN amount TYPE bigint;
      ALTER TABLE payment ALTER COLUMN value TYPE bigint;
      ALTER TABLE expense ALTER COLUMN value_before_vat TYPE bigint;
      ALTER TABLE expense ALTER COLUMN vat_value TYPE bigint;
      ALTER TABLE oppotunity ALTER COLUMN estimated_revenue TYPE bigint;
    `);
    console.log("Schema types updated to bigint.");

    // 1. Truncate target tables in cascade
    console.log("Truncating target tables for clean restore...");
    const tablesToTruncate = [
      'my_company',
      'department',
      'employee',
      'policy_and_program',
      'company',
      'contact',
      'request',
      'comment',
      'expense',
      'mtr',
      'payment',
      'invoice',
      'account',
      'asset',
      'service',
      'my_product_and_service',
      'operation_program',
      'oppotunity',
      'my_location'
    ];
    await pool.query(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} CASCADE`);
    console.log("Truncated successfully.");

    // 2. MY COMPANY
    console.log("Importing MY COMPANY...");
    const myCompanies = getSheetData('MY COMPANY');
    let insertedMyCompanies = 0;
    for (const row of myCompanies) {
      if (!row['MY COMPANY ID']) continue;
      await execSafe(`
        INSERT INTO my_company (my_company_id, company_shortname, company_fullname, tax_code, website, address, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [row['MY COMPANY ID'], row['COMPANY SHORTNAME'], row['COMPANY FULLNAME'], row['TAX CODE'], row['WEBSITE'], row['ADDRESS'], row['COUNTRY']]);
      insertedMyCompanies++;
    }
    console.log(`Inserted ${insertedMyCompanies} my_companies.`);

    // 3. DEPARTMENT
    console.log("Importing DEPARTMENT...");
    const departments = getSheetData('DEPARTMENT');
    let insertedDeps = 0;
    for (const row of departments) {
      if (!row['DEPARTMENT ID']) continue;
      const deptId = String(row['DEPARTMENT ID']).trim();
      await execSafe(`
        INSERT INTO department (department_id, department_name, manager_email, company_id)
        VALUES ($1, $2, $3, $4)
      `, [deptId, row['DEPARTMENT NAME'], row['DEPARTMENT HEAD'], row['MY COMPANY']]);
      insertedDeps++;
    }
    console.log(`Inserted ${insertedDeps} departments.`);

    // 4. EMPLOYEE
    console.log("Importing EMPLOYEE...");
    const employees = getSheetData('EMPLOYEE');
    let insertedEmps = 0;
    for (const row of employees) {
      const emailVal = getVal(row, 'EMAIL');
      if (!emailVal) continue;
      const email = emailVal.trim().toLowerCase();
      
      const fullName = getVal(row, 'FULL NAME');
      const phone = getVal(row, 'PHONE') ? String(getVal(row, 'PHONE')) : null;
      const gen = getVal(row, 'GEN');
      const position = getVal(row, 'POSITION');
      const department = getVal(row, 'DEPARTMENT') ? String(getVal(row, 'DEPARTMENT')).trim() : null;
      const myCompany = getVal(row, 'MY COMPANY');
      const level = getVal(row, 'EMPLOYEE LEVEL') || getVal(row, 'LEVEL');
      let role = getVal(row, 'ROLE TYPE') || getVal(row, 'ROLE');
      if (!role || String(role).trim() === '' || String(role).toLowerCase() === 'undefined' || String(role).toLowerCase() === 'null') {
        role = 'Staff';
      }
      const status = getVal(row, 'STATUS') || 'Active';
      const locBase = getVal(row, 'LOCATION BASE');
      const sow = getVal(row, 'SOW');

      const employeeId = row['EMPLOYEE ID'] ? String(row['EMPLOYEE ID']).trim() : ('EMP-' + email);

      await execSafe(`
        INSERT INTO employee (employee_id, email, full_name, phone, gen, position, department_id, company_id, employee_level, role, status, location_base, sow)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [employeeId, email, fullName, phone, gen, position, department, myCompany, level, role, status, locBase, sow]);
      insertedEmps++;
    }
    console.log(`Inserted ${insertedEmps} employees.`);

    // 5. PROCESS -> policy_and_program
    console.log("Importing PROCESS (policy_and_program)...");
    const processes = getSheetData('PROCESS');
    let insertedProcesses = 0;
    for (const row of processes) {
      if (!row['PROCESS ID']) continue;
      await execSafe(`
        INSERT INTO policy_and_program (policy_id, policy_name, description, policy_type, policy_lead, sr_owner, tier1_approval, tier2_approval, tier3_approval)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [row['PROCESS ID'], row['PROCESS NAME'], row['DESCRIPTION'], row['PROCESS TYPE'], row['POLICY LEAD'], toSqlArray(row['SR OWNER']), row['TIER 1'], row['TIER 2'], row['TIER 3']]);
      insertedProcesses++;
    }
    console.log(`Inserted ${insertedProcesses} policies.`);

    // 6. COMPANY (partners)
    console.log("Importing COMPANY...");
    const companies = getSheetData('COMPANY');
    let insertedCompanies = 0;
    for (const row of companies) {
      if (!row['COMPANY ID']) continue;
      await execSafe(`
        INSERT INTO company (company_id, company_shortname, company_fullname, type, website, address, country, city)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [row['COMPANY ID'], row['COMPANY SHORTNAME'], row['COMPANY FULLNAME'], row['TYPE'], row['WEBSITE'], row['ADDRESS'], row['COUNTRY'], row['CITY']]);
      insertedCompanies++;
    }
    console.log(`Inserted ${insertedCompanies} partner companies.`);

    // 7. CONTACT
    console.log("Importing CONTACT...");
    const contacts = getSheetData('CONTACT');
    let insertedContacts = 0;
    for (const row of contacts) {
      if (!row['CONTACT ID']) continue;
      await execSafe(`
        INSERT INTO contact (contact_id, company_id, title, name, gen, email, mobile_no)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [row['CONTACT ID'], row['COMPANY'], row['TITLE'], row['NAME'], row['GEN'], row['EMAIL'], row['MOBILE NO']]);
      insertedContacts++;
    }
    console.log(`Inserted ${insertedContacts} contacts.`);

    // 8. REQUEST
    console.log("Importing REQUEST...");
    const requests = getSheetData('REQUEST');
    let insertedRequests = 0;
    for (const row of requests) {
      if (!row['REQUEST ID']) continue;
      await execSafe(`
        INSERT INTO request (request_id, request_type, sr_creater, requester, description, policy_lead, sr_owner, sr_status, process_status, sr_created_date, approval_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [row['REQUEST ID'], row['REQUEST TYPE'], row['SR CREATER'], row['REQUESTER'], row['DESCRIPTION'], row['POLICY LEAD'], toSqlArray(row['SR OWNER']), row['SR STATUS'], row['PROCESS STATUS'], excelDateToJSDate(row['SR CREATED DATE']), row['APPROVAL LEVEL']]);
      insertedRequests++;
    }
    console.log(`Inserted ${insertedRequests} requests.`);

    // 9. COMMENT (REQUEST DETAIL)
    console.log("Importing COMMENT (REQUEST DETAIL)...");
    const comments = getSheetData('REQUEST DETAIL');
    let insertedComments = 0;
    for (const row of comments) {
      if (!row['REQUEST DETAIL ID']) continue;
      await execSafe(`
        INSERT INTO comment (comment_id, request, comment, file, link)
        VALUES ($1, $2, $3, $4, $5)
      `, [row['REQUEST DETAIL ID'], row['REQUEST'], row['COMMENT'], row['FILE'], row['LINK']]);
      insertedComments++;
    }
    console.log(`Inserted ${insertedComments} comments.`);

    // 10. EXPENSE
    console.log("Importing EXPENSE...");
    const expenses = getSheetData('EXPENSE');
    let insertedExpenses = 0;
    for (const row of expenses) {
      if (!row['EXPENSE ID']) continue;
      await execSafe(`
        INSERT INTO expense (expense_id, request, expense, description, employee, value_before_vat, vat_value, currency, expense_type, created_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        row['EXPENSE ID'], row['REQUEST'], row['EXPENSE'], row[' DESCRIPTION'], row['EMPLOYEE'], 
        roundVal(row['VALUE BEFORE VAT']), roundVal(row['VAT VALUE']), row['CURRENCY'], row['EXPENSE TYPE'], 
        excelDateToJSDate(row['CREATED DATE'])
      ]);
      insertedExpenses++;
    }
    console.log(`Inserted ${insertedExpenses} expenses.`);

    // 11. MTR
    console.log("Importing MTR...");
    const mtrs = getSheetData('MTR');
    let insertedMtrs = 0;
    for (const row of mtrs) {
      if (!row['TRANSACTION ID']) continue;
      await execSafe(`
        INSERT INTO mtr (transaction_id, request, account, transaction_date, transaction_type, amount, exchange_rate, description, note, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        row['TRANSACTION ID'], row['REQUEST'], row['ACCOUNT'], excelDateToJSDate(row['TRANSACTION DATE']), 
        row['TRANSACTION TYPE'], roundVal(row['AMOUNT']), roundVal(row['EXCHANGE RATE']), 
        row['DESCRIPTION'], row['NOTE'], row['STATUS']
      ]);
      insertedMtrs++;
    }
    console.log(`Inserted ${insertedMtrs} MTR transactions.`);

    // 12. PAYMENT
    console.log("Importing PAYMENT...");
    const payments = getSheetData('PAYMENT');
    let insertedPayments = 0;
    for (const row of payments) {
      if (!row['PAYMENT ID']) continue;
      const paymentId = String(row['PAYMENT ID']).trim();
      await execSafe(`
        INSERT INTO payment (payment_id, request, employee, payment_type, payment_description, value, currency, due_date, payment_status, payment_method, transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        paymentId, row['REQUEST'], row['EMPLOYEE (beneficiaries)'], row['PAYMENT TYPE'], 
        row['PAYMENT DESCRIPTION'], roundVal(row['VALUE']), row['CURRENCY'], excelDateToJSDate(row['DUE DATE']), 
        row['PAYMENT STATUS'], row['PAYMENT METHOD'], row['TRANSACTION ID']
      ]);
      insertedPayments++;
    }
    console.log(`Inserted ${insertedPayments} payments.`);

    // 13. INVOICE
    console.log("Importing INVOICE...");
    const invoices = getSheetData('INVOICE');
    let insertedInvoices = 0;
    for (const row of invoices) {
      if (!row['INVOICE ID']) continue;
      await execSafe(`
        INSERT INTO invoice (invoice_id, request, invoice_type, invoice_no, description, value_before_vat, currency, invoice_date, invoice_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        row['INVOICE ID'], row['REQUEST'], row['INVOICE TYPE'], row['INVOICE NO'], row['DESCRIPTION'], 
        row['VALUE BEFORE VAT'] ? parseFloat(row['VALUE BEFORE VAT']) : null, row['CURRENCY'], 
        excelDateToJSDate(row['INVOICE DATE']), row['INVOICE STATUS']
      ]);
      insertedInvoices++;
    }
    console.log(`Inserted ${insertedInvoices} invoices.`);

    // 14. ACCOUNT
    console.log("Importing ACCOUNT...");
    const accounts = getSheetData('ACCOUNT');
    let insertedAccounts = 0;
    for (const row of accounts) {
      if (!row['ACCOUNT ID']) continue;
      await execSafe(`
        INSERT INTO account (
          account_id, account_name, type, currency, account_infor, 
          account_status, account_number, bank_name, exchange_rate, 
          transaction_managed_by, finance_control, company_entity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        row['ACCOUNT ID'], row['ACCOUNT NAME'], row['TYPE'], row['CURRENCY'], row['ACCOUNT INFOR'],
        row['ACCOUNT STATUS'], row['ACCOUNT NUMBER'] ? String(row['ACCOUNT NUMBER']) : null, row['BANK NAME'], 
        roundVal(row['EXCHANGE RATE']), row['TRANSACTION MANAGED BY'], row['FINANCE CONTROL'], row['COMPANY ENTITY']
      ]);
      insertedAccounts++;
    }
    console.log(`Inserted ${insertedAccounts} accounts.`);

    // 15. ASSET
    console.log("Importing ASSET...");
    const assets = getSheetData('ASSET');
    let insertedAssets = 0;
    for (const row of assets) {
      if (!row['OFFICE ASSET ID']) continue;
      const officeAssetId = String(row['OFFICE ASSET ID']).trim();
      await execSafe(`
        INSERT INTO asset (
          office_asset_id, asset_name, request, identity_number, type, qty, 
          status, purchase_date, purchase_cost, currency, exchange_rate, 
          current_owner, location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        officeAssetId, row['ASSET NAME'], row['REQUEST'] ? String(row['REQUEST']) : null, row['IDENTITY NUMBER'],
        row['TYPE'], roundVal(row['QTY']), row['STATUS'], excelDateToJSDate(row['PURCHASE DATE']), 
        row['PURCHASE COST'] ? String(row['PURCHASE COST']) : null, row['CURRENCY'], 
        row['EXCHANGE RATE'] ? String(row['EXCHANGE RATE']) : null, row['CURRENT OWNER'], row['LOCATION']
      ]);
      insertedAssets++;
    }
    console.log(`Inserted ${insertedAssets} assets.`);

    // 16. SERVICE
    console.log("Importing SERVICE...");
    const services = getSheetData('SERVICE');
    let insertedServices = 0;
    for (const row of services) {
      if (!row['SERVICE ID']) continue;
      const serviceId = String(row['SERVICE ID']).trim();
      await execSafe(`
        INSERT INTO service (service_id, request, service_type, service_name, status, start_date, end_date, fy)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        serviceId, row['REQUEST'], row['SERVICE TYPE'], row['SERVICE NAME'], row['STATUS'],
        excelDateToJSDate(row['START DATE']), excelDateToJSDate(row['END DATE']), row['FY'] ? String(row['FY']) : null
      ]);
      insertedServices++;
    }
    console.log(`Inserted ${insertedServices} services.`);

    // 17. MY SERVICE -> my_product_and_service
    console.log("Importing MY SERVICE (my_product_and_service)...");
    const myServices = getSheetData('MY SERVICE');
    let insertedMyServices = 0;
    for (const row of myServices) {
      if (!row['MY SERVICE ID']) continue;
      const psName = row['SERVICE  NAME'] || row['SERVICE NAME'];
      await execSafe(`
        INSERT INTO my_product_and_service (psid, ps_name, type, vendor)
        VALUES ($1, $2, $3, $4)
      `, [row['MY SERVICE ID'], psName, row['TYPE'], row['VENDOR']]);
      insertedMyServices++;
    }
    console.log(`Inserted ${insertedMyServices} my_services.`);

    // 18. OPERATION PROGRAM
    console.log("Importing OPERATION PROGRAM...");
    const opPrograms = getSheetData('OPERATION PROGRAM');
    let insertedOpPrograms = 0;
    for (const row of opPrograms) {
      if (!row['OPER ID']) continue;
      await execSafe(`
        INSERT INTO operation_program (oper_id, expense_code, expense_name, expense_type)
        VALUES ($1, $2, $3, $4)
      `, [String(row['OPER ID']), row['EXPENSE CODE'], row['EXPENSE NAME'], row['EXPENSE TYPE']]);
      insertedOpPrograms++;
    }
    console.log(`Inserted ${insertedOpPrograms} operation programs.`);

    // 19. OPPORTUNITIES -> oppotunity
    console.log("Importing OPPORTUNITIES (oppotunity)...");
    const opps = getSheetData('OPPORTUNITIES');
    let insertedOpps = 0;
    for (const row of opps) {
      if (!row['PROJECT ID']) continue;
      let endUserVal = row['END-USER'];
      let endUserInt = null;
      if (endUserVal !== null) {
        const parsed = parseInt(endUserVal, 10);
        if (!isNaN(parsed)) {
          endUserInt = parsed;
        }
      }
      await execSafe(`
        INSERT INTO oppotunity (project_id, project_name, enduser, estimated_revenue, currency, exchange_rate, status, stage, close_date, sale_lead)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        row['PROJECT ID'], row['PROJECT NAME'], endUserInt, roundVal(row['ESTIMATED GM']),
        row['CURRENCY'], roundVal(row['EXCHANGE RATE']), row['STATUS'],
        row['PROJECT TYPE'], excelDateToJSDate(row['TARGET CLOSE DATE']), row['SALES']
      ]);
      insertedOpps++;
    }
    console.log(`Inserted ${insertedOpps} opportunities.`);

    // 20. POPULATE my_location
    console.log("Populating my_location table with correct mappings for RQC companies...");
    const locationsToInsert = [
      { id: 'Hanoi', code: 'HAN', type: 'Office', address: '58 Louis VIII – LK 24, KĐT Mới Hoàng Văn Thụ, Phường Hoàng Mai, Thành phố Hà Nội, Việt Nam', company: 'VN-CP' },
      { id: 'Ho Chi Minh City', code: 'HCM', type: 'Office', address: 'Diamond Plaza, Quận 1, TP. HCM', company: 'VN-CP' },
      { id: 'HCMC', code: 'HCM', type: 'Office', address: 'Diamond Plaza, Quận 1, TP. HCM', company: 'VN-CP' },
      { id: 'Yangon', code: 'RGN', type: 'Office', address: 'Green Tower Building, Khlong Toei, Bangkok / Yangon Office', company: 'TH-TERAX' },
      { id: 'Singapore', code: 'SIN', type: 'Office', address: 'Singapore Bartley Ridge', company: 'TH-TERAX' },
      { id: 'Phnom Penh', code: 'PNH', type: 'Office', address: 'Phnom Penh Office', company: 'VN-CP' }
    ];

    for (const loc of locationsToInsert) {
      await execSafe(`
        INSERT INTO my_location (my_location_id, location_code, type, address, my_company, status, created_by)
        VALUES ($1, $2, $3, $4, $5, 'Active', 'restore_script')
      `, [loc.id, loc.code, loc.type, loc.address, loc.company]);
    }
    console.log(`Inserted ${locationsToInsert.length} location records.`);

    // 21. Re-create default Admin login account
    console.log("Ensuring admin@cp-invest.net has an active user login account...");
    await execSafe(`
      INSERT INTO employee (employee_id, email, full_name, gen, position, employee_level, company_id, department_id, status, role, location_base, sow)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (email) DO NOTHING
    `, [
      'CPI-001', 'admin@cp-invest.net', 'DƯƠNG NGỌC QUANG', 'Male', 'Managing Director', 'M3', '7032cc61', 'c9b4fccb-1', 'Active', 'Admin', 'Hanoi', 'System Administrator Account'
    ]);
    
    // Check if test account script exists
    try {
      if (fs.existsSync('scripts/dev/create_test_account.js')) {
        console.log("Restoring active test login account via dev script...");
        const { execSync } = require('child_process');
        execSync('node scripts/dev/create_test_account.js', { stdio: 'inherit' });
      }
    } catch(e) {
      console.warn("Dev test account script warning:", e.message);
    }

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: DATABASE FULLY RESTORED TO RQC-CP-DATABASE STATE 🎉");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ RESTORATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

restoreAll();
