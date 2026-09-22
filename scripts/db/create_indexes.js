require('dotenv').config();
const pool = require('../../server/db');

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_expense_request ON "expense"("request");',
    'CREATE INDEX IF NOT EXISTS idx_expense_employee ON "expense"("employee");',
    
    'CREATE INDEX IF NOT EXISTS idx_contract_request ON "contract"("request");',
    'CREATE INDEX IF NOT EXISTS idx_contract_owner ON "contract"("contract_owner");',
    
    'CREATE INDEX IF NOT EXISTS idx_payment_request ON "payment"("request");',
    'CREATE INDEX IF NOT EXISTS idx_payment_employee ON "payment"("employee");',
    'CREATE INDEX IF NOT EXISTS idx_payment_payment_request ON "payment"("payment_request");',
    
    'CREATE INDEX IF NOT EXISTS idx_invoice_request ON "invoice"("request");',
    'CREATE INDEX IF NOT EXISTS idx_invoice_invoice_request ON "invoice"("invoice_request");',
    
    'CREATE INDEX IF NOT EXISTS idx_mtr_request ON "mtr"("request");',
    'CREATE INDEX IF NOT EXISTS idx_mtr_account ON "mtr"("account");',
    
    'CREATE INDEX IF NOT EXISTS idx_comment_request ON "comment"("request");',
    
    'CREATE INDEX IF NOT EXISTS idx_request_type ON "request"("request_type");',
    'CREATE INDEX IF NOT EXISTS idx_request_requester ON "request"("requester");',
    'CREATE INDEX IF NOT EXISTS idx_request_owner ON "request"("sr_owner");',
    
    'CREATE INDEX IF NOT EXISTS idx_employee_department ON "employee"("department_id");',
    'CREATE INDEX IF NOT EXISTS idx_employee_company ON "employee"("company_id");',
    
    'CREATE INDEX IF NOT EXISTS idx_department_company ON "department"("company_id");'
  ];

  try {
    // Ensure invoice_request column exists in invoice table
    console.log('Ensuring invoice_request column exists in invoice table...');
    await pool.query('ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "invoice_request" TEXT;');

    for (const q of indexes) {
      console.log(`Running: ${q}`);
      await pool.query(q);
    }
    console.log('✅ All indexes created successfully!');
  } catch (err) {
    console.error('❌ Error creating indexes:', err.message);
  } finally {
    pool.end();
  }
}

createIndexes();
