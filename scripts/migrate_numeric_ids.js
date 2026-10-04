#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('Starting migration transaction...');
    await client.query('BEGIN');

    // 1. Drop the foreign key constraint on employee(department_id)
    console.log('Dropping employee_department_id_fkey constraint...');
    await client.query('ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_department_id_fkey');

    // 2. Migrate department_id (DEP-)
    console.log('Migrating department_id to DEP- prefix...');
    
    // Update department table
    const deptUpdate = await client.query(`
      UPDATE department 
      SET department_id = 'DEP-' || department_id 
      WHERE department_id ~ '^[0-9]+$'
      RETURNING department_id
    `);
    console.log(`  - Updated ${deptUpdate.rowCount} rows in department table.`);

    // Update employee references
    const empDeptUpdate = await client.query(`
      UPDATE employee 
      SET department_id = 'DEP-' || department_id 
      WHERE department_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${empDeptUpdate.rowCount} rows in employee table.`);

    // Update policy_and_program references
    const policyDeptUpdate = await client.query(`
      UPDATE policy_and_program 
      SET department_id = 'DEP-' || department_id 
      WHERE department_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${policyDeptUpdate.rowCount} rows in policy_and_program table.`);

    // Update audit_logs references
    const auditDeptUpdate = await client.query(`
      UPDATE audit_logs 
      SET record_id = 'DEP-' || record_id 
      WHERE table_name = 'department' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${auditDeptUpdate.rowCount} rows in audit_logs for department.`);


    // 3. Migrate service_id (SRV-)
    console.log('Migrating service_id to SRV- prefix...');

    // Update service table
    const svcUpdate = await client.query(`
      UPDATE service 
      SET service_id = 'SRV-' || service_id 
      WHERE service_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${svcUpdate.rowCount} rows in service table.`);

    // Update uploaded_files references
    const fileSvcUpdate = await client.query(`
      UPDATE uploaded_files 
      SET record_id = 'SRV-' || record_id 
      WHERE table_name = 'service' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${fileSvcUpdate.rowCount} rows in uploaded_files for service.`);

    // Update audit_logs references
    const auditSvcUpdate = await client.query(`
      UPDATE audit_logs 
      SET record_id = 'SRV-' || record_id 
      WHERE table_name = 'service' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${auditSvcUpdate.rowCount} rows in audit_logs for service.`);


    // 4. Migrate office_asset_id (AST-)
    console.log('Migrating office_asset_id to AST- prefix...');

    // Update asset table
    const assetUpdate = await client.query(`
      UPDATE asset 
      SET office_asset_id = 'AST-' || office_asset_id 
      WHERE office_asset_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${assetUpdate.rowCount} rows in asset table.`);

    // Update uploaded_files references
    const fileAssetUpdate = await client.query(`
      UPDATE uploaded_files 
      SET record_id = 'AST-' || record_id 
      WHERE table_name = 'asset' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${fileAssetUpdate.rowCount} rows in uploaded_files for asset.`);

    // Update audit_logs references
    const auditAssetUpdate = await client.query(`
      UPDATE audit_logs 
      SET record_id = 'AST-' || record_id 
      WHERE table_name = 'asset' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${auditAssetUpdate.rowCount} rows in audit_logs for asset.`);


    // 5. Migrate payment_id (PAY-)
    console.log('Migrating payment_id to PAY- prefix...');

    // Update payment table
    const pmtUpdate = await client.query(`
      UPDATE payment 
      SET payment_id = 'PAY-' || payment_id 
      WHERE payment_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${pmtUpdate.rowCount} rows in payment table.`);

    // Update uploaded_files references
    const filePmtUpdate = await client.query(`
      UPDATE uploaded_files 
      SET record_id = 'PAY-' || record_id 
      WHERE table_name = 'payment' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${filePmtUpdate.rowCount} rows in uploaded_files for payment.`);

    // Update audit_logs references
    const auditPmtUpdate = await client.query(`
      UPDATE audit_logs 
      SET record_id = 'PAY-' || record_id 
      WHERE table_name = 'payment' AND record_id ~ '^[0-9]+$'
    `);
    console.log(`  - Updated ${auditPmtUpdate.rowCount} rows in audit_logs for payment.`);


    // 6. Re-create the employee_department_id_fkey constraint
    console.log('Recreating employee_department_id_fkey constraint...');
    await client.query(`
      ALTER TABLE employee 
      ADD CONSTRAINT employee_department_id_fkey 
      FOREIGN KEY (department_id) REFERENCES department(department_id)
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully and changes committed.');
  } catch (err) {
    console.error('Error during migration, rolling back...', err);
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
