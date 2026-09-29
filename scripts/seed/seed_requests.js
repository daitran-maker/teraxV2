const pool = require('./server/db');

async function seedData() {
  const userEmail = 'leeanh1002@gmail.com';
  const otherEmail = 'other@gmail.com';

  const srStatuses = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Open'];
  const processStatuses = ['Not started yet', 'Processing', 'Completed'];

  let count = 0;

  try {
    // 1. My Request: 20 items
    for (let i = 0; i < 20; i++) {
      const id = `TEST-REQ-MR-${i + 1}`;
      const srStatus = srStatuses[Math.floor(Math.random() * srStatuses.length)];
      const processStatus = processStatuses[Math.floor(Math.random() * processStatuses.length)];
      const role = Math.random() > 0.5 ? 'sr_creater' : 'requester';
      
      let sr_creater = role === 'sr_creater' ? userEmail : otherEmail;
      let requester = role === 'requester' ? userEmail : otherEmail;
      
      let t1_status = 'Not started yet';
      let t2_status = 'Not started yet';
      let t3_status = 'Not started yet';
      
      if (srStatus !== 'Draft') {
        t1_status = ['Pending Approval', 'Approved', 'Rejected'][Math.floor(Math.random() * 3)];
        if (t1_status === 'Approved') {
           t2_status = ['Pending Approval', 'Approved', 'Rejected'][Math.floor(Math.random() * 3)];
        }
      }

      const q = `
        INSERT INTO request (
          request_id, request_type, sr_creater, requester, description, 
          sr_status, process_status, sr_owner,
          tier_1_approval, tier_1_status, tier_2_approval, tier_2_status, tier_3_approval, tier_3_status,
          sr_created_date, created_date
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          NOW(), NOW()
        )
      `;
      await pool.query(q, [
        id, 'Policy_Test_A', sr_creater, requester, `Mock my request #${i+1}`,
        srStatus, processStatus, otherEmail,
        otherEmail, t1_status, otherEmail, t2_status, otherEmail, t3_status
      ]);
      count++;
    }

    // 2. My Approval: 20 items
    for (let i = 0; i < 20; i++) {
      const id = `TEST-REQ-MA-${i + 1}`;
      const srStatus = 'Pending Approval';
      const processStatus = processStatuses[Math.floor(Math.random() * processStatuses.length)];
      
      let t1_app = otherEmail, t1_stat = 'Approved';
      let t2_app = otherEmail, t2_stat = 'Approved';
      let t3_app = otherEmail, t3_stat = 'Not started yet';
      
      const r = Math.random();
      if (r < 0.33) {
        // User is tier 1
        t1_app = userEmail;
        t1_stat = ['Pending Approval', 'Approved'][Math.floor(Math.random() * 2)];
        t2_stat = 'Not started yet';
      } else if (r < 0.66) {
        // User is tier 2
        t2_app = userEmail;
        t2_stat = ['Pending Approval', 'Approved'][Math.floor(Math.random() * 2)];
      } else {
        // User is tier 3
        t3_app = userEmail;
        t3_stat = 'Pending Approval';
      }

      const q = `
        INSERT INTO request (
          request_id, request_type, sr_creater, requester, description, 
          sr_status, process_status, sr_owner,
          tier_1_approval, tier_1_status, tier_2_approval, tier_2_status, tier_3_approval, tier_3_status,
          sr_created_date, created_date
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          NOW() - interval '1 day', NOW() - interval '1 day'
        )
      `;
      await pool.query(q, [
        id, 'Policy_Test_B', otherEmail, otherEmail, `Mock my approval #${i+1}`,
        srStatus, processStatus, otherEmail,
        t1_app, t1_stat, t2_app, t2_stat, t3_app, t3_stat
      ]);
      count++;
    }

    // 3. My Task: 20 items
    for (let i = 0; i < 20; i++) {
      const id = `TEST-REQ-MT-${i + 1}`;
      const srStatus = srStatuses[Math.floor(Math.random() * srStatuses.length)];
      const processStatus = processStatuses[Math.floor(Math.random() * processStatuses.length)];
      
      const q = `
        INSERT INTO request (
          request_id, request_type, sr_creater, requester, description, 
          sr_status, process_status, sr_owner,
          tier_1_approval, tier_1_status, tier_2_approval, tier_2_status, tier_3_approval, tier_3_status,
          sr_created_date, created_date
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          NOW() - interval '2 days', NOW() - interval '2 days'
        )
      `;
      await pool.query(q, [
        id, 'Policy_Test_C', otherEmail, otherEmail, `Mock my task #${i+1}`,
        srStatus, processStatus, userEmail,
        otherEmail, 'Approved', otherEmail, 'Approved', otherEmail, 'Approved'
      ]);
      count++;
    }

    console.log(`Successfully seeded ${count} requests for user: ${userEmail}`);
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    process.exit(0);
  }
}

seedData();
