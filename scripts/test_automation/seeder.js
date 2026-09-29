const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanUp() {
  // Clean up any test records to avoid FK violations or duplicates
  await pool.query("DELETE FROM payment WHERE request LIKE 'TEST-REQ%' OR payment_id LIKE 'TEST-PAY%'");
  await pool.query("DELETE FROM request WHERE request_id LIKE 'TEST-REQ%'");
}

async function seedRequestForAction(actionId) {
  await cleanUp();

  const baseRequest = {
    request_id: 'TEST-REQ-001',
    request_type: '40', // Valid request type in active DB
    sr_creater: 'giang.nguyen@mps-asia.com',
    requester: 'giang.nguyen@mps-asia.com',
    description: `Kiểm thử tự động cho action ${actionId}`,
    policy_lead: 'dzung.nguyen@mps-asia.com',
    sr_owner: ['admin_hn@mps-asia.com'],
    sr_status: 'Draft',
    process_status: 'Not started yet',
    approval_flow: null,
    rating: null,
    created_by: 'qa_automation',
    created_date: new Date()
  };

  switch (actionId) {
    case 'ACT-REQUEST-09': // Submit
      baseRequest.sr_status = 'Draft';
      baseRequest.process_status = 'Not started yet';
      break;

    case 'withdraw_request': // Withdraw
      baseRequest.sr_status = 'Pending Approval';
      baseRequest.approval_flow = {
        steps: [
          { level: 1, approver: 'dzung.nguyen@mps-asia.com', status: 'Pending Approval', action_by: null, action_date: null },
          { level: 2, approver: 'thang.le@mps-asia.com', status: 'Not started yet', action_by: null, action_date: null }
        ],
        audit_log: [],
        total_levels: 2,
        current_level: 1
      };
      break;

    case 'approve_request':
    case 'reject_request': // Approve/Reject
      baseRequest.sr_status = 'Pending Approval';
      baseRequest.approval_flow = {
        steps: [
          { level: 1, approver: 'dzung.nguyen@mps-asia.com', status: 'Pending Approval', action_by: null, action_date: null },
          { level: 2, approver: 'thang.le@mps-asia.com', status: 'Not started yet', action_by: null, action_date: null }
        ],
        audit_log: [],
        total_levels: 2,
        current_level: 1
      };
      break;

    case 'ACT-REQUEST-08': // Request Start
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Not started yet';
      break;

    case 'ACT-REQUEST-07': // Request Complete
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Processing';
      break;

    case 'ACT-REQUEST-06': // Request Closed
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Completed';
      break;

    case 'ACT-REQUEST-03': // Rating
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Completed';
      baseRequest.rating = null;
      break;

    case 'ACT-REQUEST-03-RE': // Rate again
      baseRequest.sr_status = 'Closed';
      baseRequest.process_status = 'Completed';
      baseRequest.rating = {
        point: 4,
        comment: 'Good initial support',
        by: 'giang.nguyen@mps-asia.com',
        at: new Date().toISOString()
      };
      break;

    case 'ACT-REQUEST-05': // Request Cancel
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Processing';
      break;

    case 'ACT-REQUEST-04': // Re-update Process Status
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Completed';
      break;

    case 'change_sr_owner': // Change SR Owner
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Processing';
      baseRequest.policy_lead = 'dzung.nguyen@mps-asia.com'; // Matches Policy Lead email
      break;

    case 'ACT-REQUEST-02': // Elements
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Processing';
      break;

    case 'ACT-REQUEST-016': // View Main Request
      baseRequest.request_id = 'TEST-REQ-001-PAY';
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Completed';
      break;

    case 'payment_req_outgoing':
    case 'payment_ready':
    case 'payment_req_incoming_collection':
    case 'payment_req_incoming_status':
    case 'payment_paid':
    case 'payment_update_transaction':
      baseRequest.sr_status = 'Approved';
      baseRequest.process_status = 'Processing';
      break;

    default:
      throw new Error(`Unknown action ID: ${actionId}`);
  }

  // Insert base request
  const query = `
    INSERT INTO request (
      request_id, request_type, sr_creater, requester, description,
      policy_lead, sr_owner, sr_status, process_status,
      approval_flow, rating, created_by, created_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
  `;

  const values = [
    baseRequest.request_id,
    baseRequest.request_type,
    baseRequest.sr_creater,
    baseRequest.requester,
    baseRequest.description,
    baseRequest.policy_lead,
    baseRequest.sr_owner,
    baseRequest.sr_status,
    baseRequest.process_status,
    baseRequest.approval_flow ? JSON.stringify(baseRequest.approval_flow) : null,
    baseRequest.rating ? JSON.stringify(baseRequest.rating) : null,
    baseRequest.created_by,
    baseRequest.created_date
  ];

  await pool.query(query, values);

  // If testing ACT-REQUEST-016, also seed the payment record referencing this request
  if (actionId === 'ACT-REQUEST-016') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001-PAY', 'outgoing', 1000000, 'VND', 'Draft')
    `);
  }

  if (actionId === 'payment_req_outgoing') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'outgoing', 1000000, 'VND', 'Draft')
    `);
  } else if (actionId === 'payment_ready') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'outgoing', 1000000, 'VND', 'Submitted for payment')
    `);
  } else if (actionId === 'payment_req_incoming_collection') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'incoming', 2000000, 'VND', 'Pending Payment')
    `);
  } else if (actionId === 'payment_req_incoming_status') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'incoming', 2000000, 'VND', 'Draft')
    `);
  } else if (actionId === 'payment_paid') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'outgoing', 1000000, 'VND', 'Ready for Payment')
    `);
  } else if (actionId === 'payment_update_transaction') {
    await pool.query(`
      INSERT INTO payment (payment_id, request, payment_type, value, currency, payment_status)
      VALUES ('TEST-PAY-001', 'TEST-REQ-001', 'outgoing', 1000000, 'VND', 'Paid')
    `);
  }

  console.log(`[SEEDER] Successfully seeded state for Action: ${actionId}`);
}

module.exports = {
  seedRequestForAction,
  cleanUp,
  pool
};

if (require.main === module) {
  // Can be called directly for debugging
  const action = process.argv[2] || 'ACT-REQUEST-09';
  seedRequestForAction(action)
    .then(() => pool.end())
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
