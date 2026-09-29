const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Reading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json!');
  }
  const mymps = JSON.parse(raw);

  // Helper mappings
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
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
    return null;
  }

  function resolveEmpList(val) {
    if (!val) return null;
    return val.split(',')
      .map(id => resolveEmp(id.trim()))
      .filter(email => email !== null)
      .join(', ');
  }

  const currencyMap = {};
  mymps.tables['CURRENCY']?.rows.forEach(r => {
    currencyMap[r.ID] = r.SHORT_NAME;
  });

  const accountTypeMap = {};
  mymps.tables['ACCOUNT_TYPE']?.rows.forEach(r => {
    accountTypeMap[r.ID] = r.NAME;
  });

  const accountStatusMap = {};
  mymps.tables['ACCOUNT_STATUS']?.rows.forEach(r => {
    accountStatusMap[r.ID] = r.NAME;
  });

  const myCompanyMap = {};
  mymps.tables['MY_COMPANY']?.rows.forEach(r => {
    myCompanyMap[r.ID] = r.COMPANY_SHORTNAME || r.COMPANY_FULLNAME;
  });

  const accountRows = mymps.tables['ACCOUNT']?.rows || [];
  console.log(`Processing ${accountRows.length} accounts...`);

  const mappedAccounts = accountRows.map(r => {
    return {
      account_id: String(r.ID),
      account_name: r.ACCOUNT_NAME || null,
      type: accountTypeMap[r.TYPE__ID_ACCOUNT_TYPE] || null,
      currency: currencyMap[r.CURRENCY__ID_CURRENCY] || 'VND',
      account_infor: r.ACCOUNT_INFOR || null,
      account_status: accountStatusMap[r.STATUS__ACCOUNT_STATUS] || 'Open',
      account_number: r.ACCOUNT_NUMBER || null,
      bank_name: r.BANK_NAME || null,
      exchange_rate: r.EXCHANGE_RATE !== null ? parseInt(r.EXCHANGE_RATE) : 1,
      transaction_managed_by: resolveEmpList(r.TRANSACTION_MANAGED_BY),
      finance_control: resolveEmp(r.FINANCE_CONTROL__EMPLOYEE),
      company_entity: myCompanyMap[r.COMPANY_ENTITY__MY_COMPANY] || null,
      created_by: 'mps_import',
      created_date: new Date(),
      updated_by: null,
      updated_date: null,
      log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null
    };
  });

  console.log('🔴 TRUNCATING account table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: account CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE account CASCADE');
  }
  console.log('✅ Account table truncated.');

  console.log('📥 Inserting accounts...');
  let aInserted = 0;
  for (const r of mappedAccounts) {
    try {
      await pool.query(`
        INSERT INTO account (
          account_id, account_name, type, currency, account_infor,
          account_status, account_number, bank_name, exchange_rate,
          transaction_managed_by, finance_control, company_entity,
          created_by, created_date, updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) ON CONFLICT (account_id) DO NOTHING
      `, [
        r.account_id, r.account_name, r.type, r.currency, r.account_infor,
        r.account_status, r.account_number, r.bank_name, r.exchange_rate,
        r.transaction_managed_by, r.finance_control, r.company_entity,
        r.created_by, r.created_date, r.updated_by, r.updated_date, r.log
      ]);
      aInserted++;
    } catch (e) {
      console.error(`  ❌ Failed account ID ${r.account_id}:`, e.message);
    }
  }
  console.log(`✅ Accounts: ${aInserted}/${mappedAccounts.length} successfully inserted.`);
  await pool.end();
  console.log('🎉 Accounts import complete!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
