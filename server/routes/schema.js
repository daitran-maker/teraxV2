const express = require('express');
const router = express.Router();
const pool = require('../db');

const ALLOWED_TABLES = [
  'account',               'action_rules',
  'asset',                 'department',
  'employee',              'contract',
  'customize',             'column_permissions',
  'exception_rules',
  'company',               'invoice',
  'mtr',                   'my_product_and_service',
  'operation_program',     'my_company',
  'oppotunity',            'payment',
  'permission_positions',  'permission_roles',
  'policy_and_program',    'project',
  'request',               'service',
  'permission_levels',     'contact',
  'permission_exceptions',
  'my_location',
  'v_finance',             'finance',
  'v_department',          'v_department_select',   'expense'
];


// GET /api/schema/tables
// Fetch a grouped list of tables and their respective columns from the "public" schema
router.get('/tables', async (req, res) => {
  try {
    const q = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    const result = await pool.query(q);
    
    // Group columns by table_name
    const schemaObj = {};
    result.rows.forEach(row => {
      if (!ALLOWED_TABLES.includes(row.table_name)) return;
      if (!schemaObj[row.table_name]) {
        schemaObj[row.table_name] = [];
      }
      schemaObj[row.table_name].push({
        column: row.column_name,
        type: row.data_type
      });
    });

    res.json(schemaObj);
  } catch (err) {
    console.error('Error fetching schema:', err);
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

module.exports = router;
