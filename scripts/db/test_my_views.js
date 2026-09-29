const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5221;

async function test() {
  try {
    // 1. Get an employee email from DB
    const resEmp = await pool.query('SELECT email, role, employee_level, position FROM employee LIMIT 1');
    if (resEmp.rows.length === 0) {
      console.log('No employees found in DB. Cannot test.');
      return;
    }
    const emp = resEmp.rows[0];
    console.log(`Testing with user: ${emp.email} (Role: ${emp.role})`);

    // 2. Generate a JWT token
    const token = jwt.sign(
      { 
        email: emp.email, 
        role: emp.role || 'Employee', 
        employee_level: emp.employee_level, 
        position: emp.position 
      }, 
      JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // 3. Import dynamically or fetch from localhost:5221
    const viewTypes = ['my-request', 'my-approval', 'my-task', 'my-team'];
    for (const vt of viewTypes) {
      const url = `http://localhost:${PORT}/api/my-views/${vt}`;
      console.log(`Fetching: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const status = response.status;
      const data = await response.json();
      console.log(`Status: ${status}`);
      if (status === 200) {
        console.log(`Success: Found ${data.data ? data.data.length : 0} items`);
      } else {
        console.error('Error details:', data);
      }
      console.log('----------------------------------------');
    }
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await pool.end();
  }
}

test();
