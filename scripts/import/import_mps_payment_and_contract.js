/**
 * SCRIPT: Import MPS PAYMENT and CONTRACT → CRC DB
 *
 * Chạy: node scripts/import/import_mps_payment_and_contract.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== LOOKUPS =====
const PAYMENT_STATUS_MAP = {
  21: 'Not started yet',
  9: 'Pending confirmation',
  1: 'Draft',
  2: 'Submitted for payment',
  3: 'Ready for payment',
  4: 'Paid',
  5: 'Pending payment',
  6: 'Not due yet',
  7: 'Cancel',
  8: 'Collection working'
};

const PAYMENT_METHOD_MAP = {
  1: 'Bank TT',
  2: 'Cash',
  3: 'Other'
};

const PAYMENT_TYPE_MAP = {
  1: 'Outgoing',
  3: 'Incoming'
};

const CURRENCY_MAP = {
  1: 'VND',
  2: 'USD',
  3: 'MMK',
  4: 'SGD',
  5: 'THB',
  6: 'EUR'
};

const CONTRACT_TYPE_MAP = {
  1: 'Selling',
  2: 'Buying'
};

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('PAYMENT & CONTRACT IMPORT');
  console.log('='.repeat(60));

  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else if (fs.existsSync('0206_mymps.json')) {
    raw = fs.readFileSync('0206_mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json!');
  }
  const mymps = JSON.parse(raw);
  
  // Build employee UUID to Email Map
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  const uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });
  console.log(`Resolved ${uuidToEmailMap.size} employees for manager/owner resolution.`);

  function resolveEmp(val) {
    if (!val) return null;
    const clean = String(val).toUpperCase().trim();
    if (uuidToEmailMap.has(clean)) {
      return uuidToEmailMap.get(clean);
    }
    return val;
  }

  function parseDate(val) {
    if (!val) return null;
    return val.split('T')[0];
  }

  // ==========================================
  // 1. MAPPING PAYMENTS (3,612 rows expected)
  // ==========================================
  const paymentRows = mymps.tables['PAYMENT']?.rows || [];
  console.log(`Total payments in JSON: ${paymentRows.length}`);

  const mappedPayments = paymentRows.map(r => ({
    payment_id: String(r.ID),
    request: r.ID__REQUEST ? String(r.ID__REQUEST) : null,
    contractspood: r.CONTRACTS_PO_OD ? String(r.CONTRACTS_PO_OD) : null,
    my_company: r.ID__MY_COMPANY ? String(r.ID__MY_COMPANY) : null,
    payment_type: r.TYPE__ID_PAYMENT_TYPE ? (PAYMENT_TYPE_MAP[r.TYPE__ID_PAYMENT_TYPE] || null) : null,
    counter_party: r.ID__COUNTER_PARTY ? String(r.ID__COUNTER_PARTY) : null,
    company: r.ID__COMPANY ? String(r.ID__COMPANY) : null,
    employee: resolveEmp(r.ID__EMPLOYEE),
    payment_description: r.PAYMENT_DESCRIPTION || null,
    payment_period: r.PAYMENT_PERIOD !== null ? Number(r.PAYMENT_PERIOD) : null,
    due_date: parseDate(r.DUE_DATE),
    value: r.VALUE !== null ? Number(r.VALUE) : null,
    currency: r.ID__CURRENCY ? (CURRENCY_MAP[r.ID__CURRENCY] || null) : null,
    exchange_rate: r.EXCHANGE_RATE !== null ? Number(r.EXCHANGE_RATE) : null,
    payment_method: r.METHOD__PAYMENT_METHOD ? (PAYMENT_METHOD_MAP[r.METHOD__PAYMENT_METHOD] || null) : null,
    bank_info: r.BANK_INFO || null,
    payment_status: r.STATUS__PAYMENT_STATUS ? (PAYMENT_STATUS_MAP[r.STATUS__PAYMENT_STATUS] || null) : null,
    payment_date: parseDate(r.PAYMENT_DATE),
    transaction_id: r.TRANSACTION_ID__ID_MTR ? String(r.TRANSACTION_ID__ID_MTR) : null,
    payment_request: r.PAYMENT_REQUEST__ID_REQUEST ? String(r.PAYMENT_REQUEST__ID_REQUEST) : null,
    created_by: 'mps_import',
    created_date: new Date(),
    log: r.LABEL_ID || null
  }));

  // ==========================================
  // 2. MAPPING CONTRACTS (2,874 rows expected)
  // ==========================================
  const contractRows = mymps.tables['CONTRACT']?.rows || [];
  console.log(`Total contracts in JSON: ${contractRows.length}`);

  const mappedContracts = contractRows.map(r => ({
    contract_id: String(r.ID),
    request: r.ID__REQUEST ? String(r.ID__REQUEST) : null,
    my_company: r.ID__MY_COMPANY !== null ? Number(r.ID__MY_COMPANY) : null,
    contract_owner: resolveEmp(r.CREATED_BY__EMPLOYEE),
    type: r.ID__CONTRACT_TYPE ? (CONTRACT_TYPE_MAP[r.ID__CONTRACT_TYPE] || null) : null,
    contractor: r.CONTRACTOR__COMPANY !== null ? Number(r.CONTRACTOR__COMPANY) : null,
    project: r.ID__OPPORTUNITY ? String(r.ID__OPPORTUNITY) : null,
    contractspood_no: r.PO_OD_NUMBER || null,
    contract_name_or_description: r.DESCRIPTION || null,
    contract_signed_date: parseDate(r.CONTRACT_SIGNED_DATE),
    value_before_vat: r.VALUE_BEFORE_VAT !== null ? Number(r.VALUE_BEFORE_VAT) : null,
    vat_value: r.VAT_VALUE !== null ? Number(r.VAT_VALUE) : null,
    currency: r.ID__CURRENCY ? (CURRENCY_MAP[r.ID__CURRENCY] || null) : null,
    exchance_rate: r.EXCHANGE_RATE !== null ? Number(r.EXCHANGE_RATE) : null,
    created_by: 'mps_import',
    created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
    log: r.LABEL_ID || null
  }));

  // ==========================================
  // 3. EXECUTE IMPORT
  // ==========================================
  console.log('\n🔴 TRUNCATING payment and contract tables...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: payment, contract CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE payment, contract CASCADE');
  }
  console.log('✅ Truncated.');

  // A. Insert Payments
  console.log('\n📥 Inserting payments...');
  let payInserted = 0;
  for (const r of mappedPayments) {
    try {
      await pool.query(`
        INSERT INTO payment (
          payment_id, request, contractspood, my_company, payment_type,
          counter_party, company, employee, payment_description, payment_period,
          due_date, value, currency, exchange_rate, payment_method,
          bank_info, payment_status, payment_date, transaction_id, payment_request,
          created_by, created_date, log
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23
        ) ON CONFLICT (payment_id) DO NOTHING
      `, [
        r.payment_id, r.request, r.contractspood, r.my_company, r.payment_type,
        r.counter_party, r.company, r.employee, r.payment_description, r.payment_period,
        r.due_date, r.value, r.currency, r.exchange_rate, r.payment_method,
        r.bank_info, r.payment_status, r.payment_date, r.transaction_id, r.payment_request,
        r.created_by, r.created_date, r.log
      ]);
      payInserted++;
    } catch (e) {
      console.error(`  ❌ Payment ID ${r.payment_id} failed:`, e.message);
    }
  }
  console.log(`✅ Payments imported: ${payInserted}/${mappedPayments.length}`);

  // B. Insert Contracts
  console.log('\n📥 Inserting contracts...');
  let conInserted = 0;
  for (const r of mappedContracts) {
    try {
      await pool.query(`
        INSERT INTO contract (
          contract_id, request, my_company, contract_owner, type,
          contractor, project, contractspood_no, contract_name_or_description,
          contract_signed_date, value_before_vat, vat_value, currency,
          exchance_rate, created_by, created_date, log
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        ) ON CONFLICT (contract_id) DO NOTHING
      `, [
        r.contract_id, r.request, r.my_company, r.contract_owner, r.type,
        r.contractor, r.project, r.contractspood_no, r.contract_name_or_description,
        r.contract_signed_date, r.value_before_vat, r.vat_value, r.currency,
        r.exchance_rate, r.created_by, r.created_date, r.log
      ]);
      conInserted++;
    } catch (e) {
      console.error(`  ❌ Contract ID ${r.contract_id} failed:`, e.message);
    }
  }
  console.log(`✅ Contracts imported: ${conInserted}/${mappedContracts.length}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
