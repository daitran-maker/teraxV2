const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Starting data masking process...');
  try {
    // 1. Mask Employees & Contacts
    console.log('Masking Employee & Contact names/phones...');
    await pool.query(`
      UPDATE employee 
      SET full_name = 'User ' || left(md5(email), 6),
          phone = '0900000000',
          sow = 'Masked SOW'
      WHERE role != 'Admin' AND email NOT LIKE '%@cp-invest.net' AND email != 'leeanh1002@gmail.com';
    `);
    
    await pool.query(`
      UPDATE contact
      SET name = 'Contact ' || left(contact_id::text, 6),
          mobile_no = '0900000000',
          email = 'contact_' || left(contact_id::text, 6) || '@example.com'
    `);

    // 2. Mask Companies
    console.log('Masking Company names & addresses...');
    await pool.query(`
      UPDATE company
      SET company_shortname = 'Company ' || left(company_id::text, 6),
          company_fullname = 'Masked Company Full Name ' || left(company_id::text, 6),
          address = 'Masked Address ' || left(company_id::text, 6),
          website = 'https://example.com'
    `);

    await pool.query(`
      UPDATE my_company
      SET company_fullname = 'My Company ' || left(my_company_id::text, 6),
          address = 'Masked Address ' || left(my_company_id::text, 6),
          tax_code = '0000000000',
          website = 'https://example.com'
      WHERE company_shortname NOT IN ('VN-MPS', 'MM-MPS', 'KH-MPS', 'SG-MPS', 'THAI-MPS', 'VN-CP', 'TH-TERAX');
    `);

    // 3. Mask Locations
    console.log('Masking Location addresses...');
    await pool.query(`
      UPDATE my_location
      SET address = 'Masked Location Address ' || left(my_location_id::text, 6)
    `);

    // 4. Mask Accounts
    console.log('Masking Bank Accounts...');
    await pool.query(`
      UPDATE account
      SET account_name = 'Account ' || left(account_id::text, 6),
          bank_name = 'Masked Bank',
          account_number = '0000000000',
          account_infor = 'Masked Account Info'
    `);

    // 5. Mask Descriptions (Request, Expense, Payment, Invoice, MTR, Comment, etc)
    console.log('Masking Request descriptions...');
    await pool.query(`
      UPDATE request
      SET description = 'Masked request description ' || request_id::text
      WHERE description IS NOT NULL;
    `);

    console.log('Masking Expense descriptions...');
    await pool.query(`
      UPDATE expense
      SET description = 'Masked expense description ' || expense_id::text,
          expense = 'Masked Expense ' || expense_id::text
      WHERE description IS NOT NULL OR expense IS NOT NULL;
    `);

    console.log('Masking Payment descriptions...');
    await pool.query(`
      UPDATE payment
      SET payment_description = 'Masked payment description ' || payment_id::text
      WHERE payment_description IS NOT NULL;
    `);
    
    // Check if contract has description or name
    console.log('Masking Contract/Service/Asset...');
    await pool.query(`
      UPDATE service
      SET service_name = 'Masked Service ' || service_id::text;
    `);
    
    await pool.query(`
      UPDATE asset
      SET asset_name = 'Masked Asset ' || left(office_asset_id::text, 6);
    `);
    
    await pool.query(`
      UPDATE mtr
      SET description = 'Masked MTR description ' || transaction_id::text,
          note = 'Masked note'
    `);

    console.log('Masking Comments...');
    await pool.query(`
      UPDATE comment
      SET comment = 'Masked comment ' || comment_id::text
      WHERE comment IS NOT NULL AND comment NOT LIKE 'OD %';
    `);

    console.log('✅ All sensitive data masked successfully!');
  } catch (e) {
    console.error('Error masking data:', e);
  } finally {
    pool.end();
  }
}

main();
