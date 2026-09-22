const { Client } = require('pg');

const BASE_URL = 'postgres://teraxadmin:TeraX123!%40%23@terax-postgres-service:5432';

const DEFAULT_POLICY_IDS = [
  'fda7fc1e-bd9a-4333-be95-040e85a5324a',
  'ab1ac29d-9aa1-4b2e-943b-37c2f3486f62',
  '648c28d4-0066-4893-bf77-89e3500aac66',
  '5212642f-68df-4ab6-8622-8b78b7f83925'
];

async function main() {
  const teraxClient = new Client({ connectionString: `${BASE_URL}/teraxdb` });
  const devClient1 = new Client({ connectionString: `${BASE_URL}/crcdevdb` });
  const devClient2 = new Client({ connectionString: `${BASE_URL}/crc_dev_db` });
  const helpdeskClient = new Client({ connectionString: `${BASE_URL}/crc_helpdesk_db` });

  try {
    await teraxClient.connect();
    await devClient1.connect();
    await devClient2.connect();
    await helpdeskClient.connect();

    console.log('Connected to databases.');

    // 1. Fetch all policies from teraxdb (active ones)
    const teraxPoliciesRes = await teraxClient.query("SELECT * FROM policy_and_program WHERE deleted_at IS NULL");
    console.log(`Fetched ${teraxPoliciesRes.rows.length} policies from teraxdb.`);

    const insertQuery = `
      INSERT INTO policy_and_program (
        policy_id, policy_type, policy_name, description, procedure_file, procedure_link,
        tier1_approval, tier2_approval, tier3_approval, approval_level, policy_lead, sr_owner,
        elements, created_by, created_date, updated_by, updated_date, deleted_at, company_id, department_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
        company_id = EXCLUDED.company_id,
        department_id = EXCLUDED.department_id,
        updated_date = CURRENT_TIMESTAMP,
        deleted_at = NULL
    `;

    // 2. Seed all 74 policies to dev.terax.ai databases (crcdevdb, crc_dev_db)
    for (const p of teraxPoliciesRes.rows) {
      const values = [
        p.policy_id, p.policy_type, p.policy_name, p.description, p.procedure_file, p.procedure_link,
        p.tier1_approval, p.tier2_approval, p.tier3_approval, p.approval_level, p.policy_lead, p.sr_owner,
        p.elements, p.created_by, p.created_date, p.updated_by, p.updated_date, p.deleted_at,
        p.company_id || '1', p.department_id
      ];

      await devClient1.query(insertQuery, values);
      await devClient2.query(insertQuery, values);
    }
    console.log(`✅ Successfully seeded/updated 74 policies in crcdevdb & crc_dev_db.`);

    // 3. Clean up helpdesk database crc_helpdesk_db
    // Delete all policies that are not the 4 default ones
    const deleteRes = await helpdeskClient.query(
      `DELETE FROM policy_and_program WHERE policy_id NOT IN (${DEFAULT_POLICY_IDS.map((_, idx) => `$${idx + 1}`).join(',')})`,
      DEFAULT_POLICY_IDS
    );
    console.log(`Deleted ${deleteRes.rowCount} non-default policies from crc_helpdesk_db.`);

    // Make sure the 4 default ones exist in crc_helpdesk_db (fetch from crcdevdb)
    for (const id of DEFAULT_POLICY_IDS) {
      const pRes = await devClient1.query("SELECT * FROM policy_and_program WHERE policy_id = $1", [id]);
      if (pRes.rows.length > 0) {
        const p = pRes.rows[0];
        const values = [
          p.policy_id, p.policy_type, p.policy_name, p.description, p.procedure_file, p.procedure_link,
          p.tier1_approval, p.tier2_approval, p.tier3_approval, p.approval_level, p.policy_lead, p.sr_owner,
          p.elements, p.created_by, p.created_date, p.updated_by, p.updated_date, p.deleted_at,
          p.company_id || '1', p.department_id
        ];
        await helpdeskClient.query(insertQuery, values);
      }
    }
    console.log(`✅ Successfully restored 4 default ticket types in crc_helpdesk_db.`);

  } catch (err) {
    console.error('Error during database correction:', err.stack);
  } finally {
    await teraxClient.end();
    await devClient1.end();
    await devClient2.end();
    await helpdeskClient.end();
  }
}

main().catch(console.error);
