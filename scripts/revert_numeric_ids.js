#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('Starting revert transaction...');
    await client.query('BEGIN');

    // 1. Drop foreign key constraint on employee(department_id)
    console.log('Dropping employee_department_id_fkey...');
    await client.query('ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_department_id_fkey');

    // 2. Revert department_id (remove DEP-)
    console.log('Reverting department_id (removing DEP- prefix)...');
    
    await client.query(`
      UPDATE department 
      SET department_id = SUBSTRING(department_id FROM 5) 
      WHERE department_id LIKE 'DEP-%'
    `);
    
    await client.query(`
      UPDATE employee 
      SET department_id = SUBSTRING(department_id FROM 5) 
      WHERE department_id LIKE 'DEP-%'
    `);

    await client.query(`
      UPDATE policy_and_program 
      SET department_id = SUBSTRING(department_id FROM 5) 
      WHERE department_id LIKE 'DEP-%'
    `);

    await client.query(`
      UPDATE audit_logs 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'department' AND record_id LIKE 'DEP-%'
    `);


    // 3. Revert service_id (remove SRV-)
    console.log('Reverting service_id (removing SRV- prefix)...');
    
    await client.query(`
      UPDATE service 
      SET service_id = SUBSTRING(service_id FROM 5) 
      WHERE service_id LIKE 'SRV-%'
    `);

    await client.query(`
      UPDATE uploaded_files 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'service' AND record_id LIKE 'SRV-%'
    `);

    await client.query(`
      UPDATE audit_logs 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'service' AND record_id LIKE 'SRV-%'
    `);


    // 4. Revert office_asset_id (remove AST-)
    console.log('Reverting office_asset_id (removing AST- prefix)...');
    
    await client.query(`
      UPDATE asset 
      SET office_asset_id = SUBSTRING(office_asset_id FROM 5) 
      WHERE office_asset_id LIKE 'AST-%'
    `);

    await client.query(`
      UPDATE uploaded_files 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'asset' AND record_id LIKE 'AST-%'
    `);

    await client.query(`
      UPDATE audit_logs 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'asset' AND record_id LIKE 'AST-%'
    `);


    // 5. Revert payment_id (remove PAY-)
    console.log('Reverting payment_id (removing PAY- prefix)...');
    
    await client.query(`
      UPDATE payment 
      SET payment_id = SUBSTRING(payment_id FROM 5) 
      WHERE payment_id LIKE 'PAY-%'
    `);

    await client.query(`
      UPDATE uploaded_files 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'payment' AND record_id LIKE 'PAY-%'
    `);

    await client.query(`
      UPDATE audit_logs 
      SET record_id = SUBSTRING(record_id FROM 5) 
      WHERE table_name = 'payment' AND record_id LIKE 'PAY-%'
    `);


    // 6. Recreate the employee_department_id_fkey constraint
    console.log('Recreating employee_department_id_fkey constraint...');
    await client.query(`
      ALTER TABLE employee 
      ADD CONSTRAINT employee_department_id_fkey 
      FOREIGN KEY (department_id) REFERENCES department(department_id)
    `);

    await client.query('COMMIT');
    console.log('Successfully reverted all prefixed database IDs back to numeric format!');
  } catch (err) {
    console.error('Error during revert, rolling back...', err);
    await client.query('ROLLBACK');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
