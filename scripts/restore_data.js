const { Client } = require('pg');

const BASE_URL = 'postgres://teraxadmin:TeraX123!%40%23@terax-postgres-service:5432';

async function restore() {
  const teraxClient = new Client({ connectionString: `${BASE_URL}/teraxdb` });
  const devClient1 = new Client({ connectionString: `${BASE_URL}/crcdevdb` });
  const devClient2 = new Client({ connectionString: `${BASE_URL}/crc_dev_db` });
  const helpdeskClient = new Client({ connectionString: `${BASE_URL}/crc_helpdesk_db` });

  try {
    await teraxClient.connect();
    await devClient1.connect();
    await devClient2.connect();
    await helpdeskClient.connect();

    console.log('Connected to all databases.');

    // 1. Fetch policy ID '2' (Process) from teraxdb
    const processRes = await teraxClient.query("SELECT * FROM policy_and_program WHERE policy_id = '2'");
    if (processRes.rows.length > 0) {
      const p = processRes.rows[0];
      console.log(`Found Process policy (ID 2): "${p.policy_name}"`);

      // Insert policy ID '2' into crcdevdb and crc_dev_db
      const insertQuery = `
        INSERT INTO policy_and_program (
          policy_id, policy_type, policy_name, description, procedure_file, procedure_link,
          tier1_approval, tier2_approval, tier3_approval, approval_level, policy_lead, sr_owner,
          elements, created_by, created_date, updated_by, updated_date, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (policy_id) DO UPDATE SET
          policy_type = EXCLUDED.policy_type,
          policy_name = EXCLUDED.policy_name,
          description = EXCLUDED.description,
          procedure_file = EXCLUDED.procedure_file,
          procedure_link = EXCLUDED.procedure_link,
          tier1_approval = EXCLUDED.tier1_approval,
          tier2_approval = EXCLUDED.tier2_approval,
          tier3_approval = EXCLUDED.tier3_approval,
          approval_level = EXCLUDED.approval_level,
          policy_lead = EXCLUDED.policy_lead,
          sr_owner = EXCLUDED.sr_owner,
          elements = EXCLUDED.elements,
          updated_date = CURRENT_TIMESTAMP
      `;

      const values = [
        p.policy_id, p.policy_type, p.policy_name, p.description, p.procedure_file, p.procedure_link,
        p.tier1_approval, p.tier2_approval, p.tier3_approval, p.approval_level, p.policy_lead, p.sr_owner,
        p.elements, p.created_by, p.created_date, p.updated_by, p.updated_date, p.deleted_at
      ];

      await devClient1.query(insertQuery, values);
      console.log('Successfully seeded policy 2 into crcdevdb.');

      await devClient2.query(insertQuery, values);
      console.log('Successfully seeded policy 2 into crc_dev_db.');
    } else {
      console.error('Process policy (ID 2) NOT found in teraxdb!');
    }

    // 2. Fetch all active policies from teraxdb and seed them to crc_helpdesk_db
    const allPoliciesRes = await teraxClient.query("SELECT * FROM policy_and_program WHERE deleted_at IS NULL");
    console.log(`Fetched ${allPoliciesRes.rows.length} policies from teraxdb.`);

    for (const p of allPoliciesRes.rows) {
      const insertQueryHD = `
        INSERT INTO policy_and_program (
          policy_id, policy_type, policy_name, description, procedure_file, procedure_link,
          tier1_approval, tier2_approval, tier3_approval, approval_level, policy_lead, sr_owner,
          elements, created_by, created_date, updated_by, updated_date, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (policy_id) DO UPDATE SET
          policy_type = EXCLUDED.policy_type,
          policy_name = EXCLUDED.policy_name,
          description = EXCLUDED.description,
          procedure_file = EXCLUDED.procedure_file,
          procedure_link = EXCLUDED.procedure_link,
          tier1_approval = EXCLUDED.tier1_approval,
          tier2_approval = EXCLUDED.tier2_approval,
          tier3_approval = EXCLUDED.tier3_approval,
          approval_level = EXCLUDED.approval_level,
          policy_lead = EXCLUDED.policy_lead,
          sr_owner = EXCLUDED.sr_owner,
          elements = EXCLUDED.elements,
          updated_date = CURRENT_TIMESTAMP
      `;

      const valuesHD = [
        p.policy_id, p.policy_type, p.policy_name, p.description, p.procedure_file, p.procedure_link,
        p.tier1_approval, p.tier2_approval, p.tier3_approval, p.approval_level, p.policy_lead, p.sr_owner,
        p.elements, p.created_by, p.created_date, p.updated_by, p.updated_date, p.deleted_at
      ];

      await helpdeskClient.query(insertQueryHD, valuesHD);
    }
    console.log(`Successfully seeded ${allPoliciesRes.rows.length} policies into crc_helpdesk_db.`);

  } catch (err) {
    console.error('Error executing restore:', err.stack);
  } finally {
    await teraxClient.end();
    await devClient1.end();
    await devClient2.end();
    await helpdeskClient.end();
  }
}

restore();
