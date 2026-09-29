const pool = require('../../server/db');
const { v4: uuidv4 } = require('uuid');

const newPrograms = [
  { category: 'Revenue', type: 'Doanh thu', debit: '131', credit: '511', vatCredit: '333' },
  { category: 'Cost of Goods Sold', type: 'Chi phí', debit: '632', credit: '156' },
  { category: 'Basic Salary', type: 'Chi phí', debit: '642', credit: '334' },
  { category: '13th Month Salary', type: 'Chi phí', debit: '642', credit: '334' },
  { category: 'Performance Bonus', type: 'Chi phí', debit: '642', credit: '334' },
  { category: 'Social Insurance - By Company', type: 'Chi phí', debit: '642', credit: '338' },
  { category: 'Bank Fees (VND)', type: 'Chi phí', debit: '635', credit: '1121' },
  { category: 'Bank Fees (Foreign)', type: 'Chi phí', debit: '635', credit: '1122' },
  { category: 'Money Transfer Fees (VND)', type: 'Chi phí', debit: '635', credit: '1121' },
  { category: 'Money Transfer Fees (Foreign)', type: 'Chi phí', debit: '635', credit: '1122' },
  { category: 'Interest Expense (VND)', type: 'Chi phí', debit: '635', credit: '1121' },
  { category: 'Interest Expense (Foreign)', type: 'Chi phí', debit: '635', credit: '1122' },
  { category: 'Marketing Fees', type: 'Chi phí', debit: '641', credit: '331', vatDebit: '133' },
  { category: 'Gift for Customers', type: 'Chi phí', debit: '641', credit: '331', vatDebit: '133' },
  { category: 'Brokerage Fees', type: 'Chi phí', debit: '641', credit: '331', vatDebit: '133' },
  { category: 'Freight & Courier', type: 'Chi phí', debit: '641', credit: '331', vatDebit: '133' },
  { category: 'Logistics Services', type: 'Chi phí', debit: '641', credit: '331', vatDebit: '133' },
  { category: 'Cleaning Fees', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Training Fees', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Legal Fees', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Office Rental', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Travel - National', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Travel - International', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Travel - Hotel', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Travel - Air Tickets', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Transportation', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Health Care', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Light, Power, Heating', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Fuel Expenses', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Car Maintenance Services', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Office Repairs & Maintenance', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Telephone', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Internet Subscription', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Other Subscriptions', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Entertainment', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Company Party', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Recruitment Fees', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Financial Support for Staff', type: 'Chi phí', debit: '642', credit: '331' },
  { category: 'Welfare', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Office Refreshment', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Printing & Stationery', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Company Trip', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Licensing Fee', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Tender Support', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Other Expenses', type: 'Chi phí', debit: '642', credit: '331', vatDebit: '133' },
  { category: 'Other Taxes', type: 'Chi phí', debit: '811', credit: '333' },
  { category: 'Company Income Tax', type: 'Chi phí', debit: '821', credit: '333' },
  { category: 'Depreciation', type: 'Chi phí', debit: '642', credit: '214' },
  { category: 'Inventory Purchase', type: 'Đầu tư', debit: '156', credit: '331', vatDebit: '133' },
  { category: 'Office Equipment', type: 'Đầu tư', debit: '153', credit: '331', vatDebit: '133' },
  { category: 'Staff Equipment', type: 'Đầu tư', debit: '153', credit: '331', vatDebit: '133' },
  { category: 'Fixed Asset Purchase', type: 'Đầu tư', debit: '211', credit: '331', vatDebit: '133' },
  { category: 'Software Purchase (Tools)', type: 'Đầu tư', debit: '153', credit: '331', vatDebit: '133' },
  { category: 'Software Purchase (Fixed Asset)', type: 'Đầu tư', debit: '211', credit: '331', vatDebit: '133' },
  { category: 'Term Deposit (VND)', type: 'Đầu tư', debit: '128', credit: '1121' },
  { category: 'Term Deposit (Foreign)', type: 'Đầu tư', debit: '128', credit: '1122' },
  { category: 'Term Deposit Withdrawal (VND)', type: 'Đầu tư', debit: '1121', credit: '128' },
  { category: 'Term Deposit Withdrawal (Foreign)', type: 'Đầu tư', debit: '1122', credit: '128' },
  { category: 'Advance Payment (VND)', type: 'Kế toán', debit: '141', credit: '1121' },
  { category: 'Advance Payment (Foreign)', type: 'Kế toán', debit: '141', credit: '1122' },
  { category: 'Customer Receipt (VND)', type: 'Kế toán', debit: '1121', credit: '131' },
  { category: 'Customer Receipt (Foreign)', type: 'Kế toán', debit: '1122', credit: '131' },
  { category: 'Supplier Payment (VND)', type: 'Kế toán', debit: '331', credit: '1121' },
  { category: 'Supplier Payment (Foreign)', type: 'Kế toán', debit: '331', credit: '1122' },
  { category: 'Personal Income Tax', type: 'Kế toán', debit: '334', credit: '333' },
  { category: 'Withholding Tax', type: 'Kế toán', debit: '334', credit: '333' },
  { category: 'Social Insurance - By Employee', type: 'Kế toán', debit: '334', credit: '338' },
  { category: 'Dividend (VND)', type: 'Kế toán', debit: '421', credit: '1121' },
  { category: 'Dividend (Foreign)', type: 'Kế toán', debit: '421', credit: '1122' }
];

function getPaymentTypes(category) {
  if (category === 'Revenue') {
    return '[Contract - Selling], [Invoice]';
  }
  if ([
    'Cost of Goods Sold', 'Basic Salary', '13th Month Salary', 'Performance Bonus',
    'Social Insurance - By Company', 'Bank Fees (VND)', 'Bank Fees (Foreign)',
    'Money Transfer Fees (VND)', 'Money Transfer Fees (Foreign)', 'Interest Expense (VND)',
    'Interest Expense (Foreign)', 'Financial Support for Staff', 'Other Taxes',
    'Company Income Tax', 'Depreciation', 'Term Deposit (VND)', 'Term Deposit (Foreign)',
    'Term Deposit Withdrawal (VND)', 'Term Deposit Withdrawal (Foreign)',
    'Advance Payment (VND)', 'Advance Payment (Foreign)', 'Customer Receipt (VND)',
    'Customer Receipt (Foreign)', 'Supplier Payment (VND)', 'Supplier Payment (Foreign)',
    'Personal Income Tax', 'Withholding Tax', 'Social Insurance - By Employee',
    'Dividend (VND)', 'Dividend (Foreign)'
  ].includes(category)) {
    return '[Payment]';
  }
  if ([
    'Marketing Fees', 'Gift for Customers', 'Brokerage Fees', 'Freight & Courier',
    'Logistics Services', 'Office Rental', 'Inventory Purchase', 'Office Equipment',
    'Staff Equipment', 'Fixed Asset Purchase', 'Software Purchase (Tools)', 'Software Purchase (Fixed Asset)'
  ].includes(category)) {
    return '[Contract - Buying], [Invoice], [Payment]';
  }
  // Default to Invoice and Payment for other operational expenses
  return '[Invoice], [Payment]';
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('Altering payment_type column size...');
    await client.query('ALTER TABLE "operation_program" ALTER COLUMN "payment_type" TYPE varchar(255)');

    console.log('Fetching finance accounts...');
    const financeRes = await client.query('SELECT fcid, finance_account_number FROM "finance"');
    const financeMap = new Map();
    financeRes.rows.forEach(r => {
      financeMap.set(r.finance_account_number, r.fcid);
    });

    console.log('Starting transaction...');
    await client.query('BEGIN');

    console.log('Deleting existing operation program data...');
    const delRes = await client.query('DELETE FROM "operation_program"');
    console.log(`Deleted ${delRes.rowCount} rows.`);

    console.log('Inserting new operation program data...');
    for (let i = 0; i < newPrograms.length; i++) {
      const prog = newPrograms[i];
      
      const debitFcid = financeMap.get(prog.debit);
      const creditFcid = financeMap.get(prog.credit);

      if (!debitFcid) {
        throw new Error(`Debit account number ${prog.debit} not found in finance table.`);
      }
      if (!creditFcid) {
        throw new Error(`Credit account number ${prog.credit} not found in finance table.`);
      }

      let financeMappings = [];
      if (prog.vatDebit) {
        const vatFcid = financeMap.get(prog.vatDebit);
        if (!vatFcid) {
          throw new Error(`VAT account number ${prog.vatDebit} not found in finance table.`);
        }
        financeMappings = [
          { value: 'WO VAT', nature: 'Debit', finance_category_id: debitFcid },
          { value: 'VAT', nature: 'Debit', finance_category_id: vatFcid },
          { value: 'TOTAL VALUE', nature: 'Credit', finance_category_id: creditFcid }
        ];
      } else if (prog.vatCredit) {
        const vatFcid = financeMap.get(prog.vatCredit);
        if (!vatFcid) {
          throw new Error(`VAT account number ${prog.vatCredit} not found in finance table.`);
        }
        financeMappings = [
          { value: 'TOTAL VALUE', nature: 'Debit', finance_category_id: debitFcid },
          { value: 'WO VAT', nature: 'Credit', finance_category_id: creditFcid },
          { value: 'VAT', nature: 'Credit', finance_category_id: vatFcid }
        ];
      } else {
        financeMappings = [
          { value: 'TOTAL VALUE', nature: 'Debit', finance_category_id: debitFcid },
          { value: 'TOTAL VALUE', nature: 'Credit', finance_category_id: creditFcid }
        ];
      }

      const seqNum = String(i + 1).padStart(2, '0');
      const paymentCode = `OP-${seqNum}`;
      const description = `Debit ${prog.debit}${prog.vatDebit ? ` + ${prog.vatDebit}` : ''} Credit ${prog.credit}${prog.vatCredit ? ` + ${prog.vatCredit}` : ''}`;
      const operId = uuidv4();
      const paymentType = getPaymentTypes(prog.category);

      await client.query(
        `INSERT INTO "operation_program" (
          oper_id, payment_code, payment_name, payment_type, description, 
          company_id, finance_mappings, log
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          operId,
          paymentCode,
          prog.category,
          paymentType,
          description,
          '1', // Company '1'
          JSON.stringify(financeMappings),
          '[]'
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Successfully migrated and inserted ${newPrograms.length} operation program records.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed. Rolled back.', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

main();
