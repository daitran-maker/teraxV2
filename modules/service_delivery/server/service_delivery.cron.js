// Daily job: keep approved Service Delivery Contract statuses in line with start_date / end_date.
const cron = require('node-cron');
const { syncSdcRunningStatuses } = require('./service_delivery.actions');

async function run(label) {
  try {
    const changed = await syncSdcRunningStatuses();
    if (changed > 0) console.log(`[SDC cron] ${label}: updated ${changed} contract status(es)`);
  } catch (err) {
    console.error('[SDC cron] sync failed:', err.message);
  }
}

// 00:05 every day
cron.schedule('5 0 * * *', () => run('daily'));
// once shortly after startup (DB migrations have run by then)
setTimeout(() => run('startup'), 30 * 1000);

module.exports = { run };
