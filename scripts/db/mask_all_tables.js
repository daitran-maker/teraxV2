const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🏁 Starting comprehensive data masking process...');
  try {
    // 1. Employee
    console.log('👤 Masking employee PII...');
    await pool.query(`
      UPDATE employee 
      SET full_name = 'Employee ' || left(md5(email), 6),
          phone = '0900000000',
          address = 'Masked Address ' || left(md5(email), 4),
          emergency_contact_name = 'Emergency Contact ' || left(md5(email), 4),
          emergency_contact_phone = '0900000000',
          social_insurance_code = '0000000000',
          pit_code = '0000000000',
          bank_account = '0000000000',
          bank_name = 'Masked Bank',
          bank_city = 'Masked City',
          sow = 'Masked SOW',
          picture = NULL,
          avatar = NULL
      WHERE role != 'Admin' AND email NOT LIKE '%@cp-invest.net' AND email != 'leeanh1002@gmail.com';
    `);

    // 2. Contact
    console.log('📇 Masking contact details...');
    await pool.query(`
      UPDATE contact
      SET name = 'Contact ' || left(contact_id::text, 6),
          mobile_no = '0900000000',
          email = 'contact_' || left(contact_id::text, 6) || '@example.com'
    `);

    // 3. Company
    console.log('🏢 Masking supplier/partner companies...');
    await pool.query(`
      UPDATE company
      SET company_shortname = 'Company ' || left(company_id::text, 6),
          company_fullname = 'Masked Company Full Name ' || left(company_id::text, 6),
          address = 'Masked Address ' || left(company_id::text, 6),
          website = 'https://example.com'
    `);

    // 4. My Company
    console.log('🏢 Masking internal my_company details...');
    await pool.query(`
      UPDATE my_company
      SET company_fullname = 'My Company Full Name ' || left(my_company_id::text, 6),
          address = 'Masked Address ' || left(my_company_id::text, 6),
          tax_code = '0000000000',
          website = 'https://example.com'
    `);

    // 5. My Location
    console.log('📍 Masking office locations...');
    await pool.query(`
      UPDATE my_location
      SET address = 'Masked Location Address ' || left(my_location_id::text, 6)
    `);

    // 6. Account
    console.log('💳 Masking bank accounts...');
    await pool.query(`
      UPDATE account
      SET account_name = 'Account ' || left(account_id::text, 6),
          bank_name = 'Masked Bank',
          account_number = '0000000000',
          account_infor = 'Masked Account Info'
    `);

    // 7. Asset
    console.log('🖥️ Masking asset information...');
    await pool.query(`
      UPDATE asset
      SET asset_name = 'Masked Asset ' || left(office_asset_id::text, 6),
          identity_number = 'ID-' || left(office_asset_id::text, 6)
    `);

    // 8. Payment
    console.log('💸 Masking payment records...');
    await pool.query(`
      UPDATE payment
      SET payment_description = 'Masked payment description ' || payment_id::text,
          bank_info = 'Masked Bank Info'
    `);

    // 9. Invoice
    console.log('📄 Masking invoice references...');
    await pool.query(`
      UPDATE invoice
      SET invoice_no = 'INV-' || left(invoice_id::text, 6),
          description = 'Masked invoice description ' || left(invoice_id::text, 6),
          attached_file = 'https://example.com/invoice/' || left(invoice_id::text, 6)
    `);

    // 10. MTR (Money Transaction)
    console.log('📊 Masking money transactions...');
    await pool.query(`
      UPDATE mtr
      SET description = 'Masked MTR description ' || transaction_id::text,
          note = 'Masked note'
    `);

    // 11. Expense
    console.log('📉 Masking expense details...');
    await pool.query(`
      UPDATE expense
      SET description = 'Masked expense description ' || expense_id::text,
          expense = 'Masked Expense ' || expense_id::text
    `);

    // 12. Request
    console.log('📝 Masking request details...');
    await pool.query(`
      UPDATE request
      SET description = 'Masked request description ' || request_id::text
    `);

    // 13. Service
    console.log('⚙️ Masking service renewals...');
    await pool.query(`
      UPDATE service
      SET service_name = 'Masked Service ' || service_id::text,
          note = 'Masked note'
    `);

    // 14. Comment
    console.log('💬 Masking comments...');
    await pool.query(`
      UPDATE comment
      SET comment = 'Masked comment ' || comment_id::text
      WHERE comment IS NOT NULL AND comment NOT LIKE 'OD %'
    `);

    // 15. Contract
    console.log('📝 Masking contracts...');
    await pool.query(`
      UPDATE contract
      SET contractspood_no = 'CTR-' || left(contract_id::text, 6),
          contract_name_or_description = 'Masked contract ' || left(contract_id::text, 6)
    `);

    console.log('✨ All tables have been successfully masked!');
  } catch (err) {
    console.error('❌ Error during database masking:', err);
  } finally {
    await pool.end();
  }
}

main();
