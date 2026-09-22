const cron = require('node-cron');
const pool = require('./db');

// Run everyday at 00:00
cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily automation job at 00:00...');
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // ─────────────────────────────────────────────────────────────
        // OUTGOING PAYMENT RULES
        // ─────────────────────────────────────────────────────────────

        // Rule O-1: Outgoing → Ready for payment when due
        const resOutgoingPending = await client.query(`
            UPDATE "payment"
            SET payment_status = 31,
                updated_by = 'system_cron'
            WHERE payment_type = 61
              AND payment_status = 30
              AND due_date <= CURRENT_DATE
        `);
        console.log(`[CRON] Outgoing: Updated ${resOutgoingPending.rowCount} Draft payments to Ready for payment.`);

        await client.query('COMMIT');
        console.log('[CRON] Daily automation job completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[CRON] Error during daily automation job:', error);
    } finally {
        client.release();
    }
});

console.log('🕒 Cron jobs initialized.');
