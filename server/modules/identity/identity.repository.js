const pool = require('../../db');

class IdentityRepository {
  /**
   * Find employee by username, email, or employee_id
   */
  async findEmployeeForAuth(identifier) {
    const query = `
      SELECT employee_id, username, email, password, role, employee_level, position, 
             company_id, department_id, full_name, nick_name, status, app_user_enabled
      FROM employee 
      WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR LOWER(employee_id) = LOWER($1))
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = await pool.query(query, [identifier]);
    return res.rows[0] || null;
  }

  async findEmployeeByEmail(email) {
    const query = `
      SELECT employee_id, username, email, role, employee_level, position, 
             company_id, department_id, full_name, nick_name, status, app_user_enabled
      FROM employee 
      WHERE LOWER(email) = LOWER($1)
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = await pool.query(query, [email]);
    return res.rows[0] || null;
  }

  async updatePassword(employeeId, hashedPassword) {
    const query = `UPDATE employee SET password = $1 WHERE employee_id = $2 RETURNING employee_id`;
    const res = await pool.query(query, [hashedPassword, employeeId]);
    return res.rows[0] || null;
  }

  async getActiveEmployeesForSwitch() {
    const query = `
      SELECT employee_id, username, full_name, email, role, position, employee_level
      FROM employee
      WHERE (status = 17 OR status IS NULL)
        AND deleted_at IS NULL
        AND COALESCE(app_user_enabled, true) = true
      ORDER BY full_name NULLS LAST, employee_id
    `;
    const res = await pool.query(query);
    return res.rows;
  }

  async findActiveEmployeeById(employeeId) {
    const query = `
      SELECT employee_id, username, full_name, nick_name, email, role, employee_level, position, department_id, company_id, app_user_enabled, status
      FROM employee
      WHERE employee_id = $1
        AND (status = 17 OR status IS NULL)
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = await pool.query(query, [employeeId]);
    return res.rows[0] || null;
  }

  // --- Column Permissions ---

  async getAllColumnPermissions() {
    const res = await pool.query('SELECT * FROM column_permissions WHERE deleted_at IS NULL ORDER BY table_name, column_name');
    return res.rows;
  }

  async getColumnPermissionById(id) {
    const cp = await pool.query('SELECT * FROM column_permissions WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (cp.rows.length === 0) return null;

    const [levels, positions, roles, exceptions] = await Promise.all([
      pool.query('SELECT * FROM permission_levels WHERE permission_id = $1 AND deleted_at IS NULL', [id]),
      pool.query('SELECT * FROM permission_positions WHERE permission_id = $1 AND deleted_at IS NULL', [id]),
      pool.query('SELECT * FROM permission_roles WHERE permission_id = $1 AND deleted_at IS NULL', [id]),
      pool.query('SELECT * FROM permission_exceptions WHERE permission_id = $1 AND deleted_at IS NULL', [id])
    ]);

    return {
      ...cp.rows[0],
      levels: levels.rows,
      positions: positions.rows,
      roles: roles.rows,
      exceptions: exceptions.rows
    };
  }

  // --- Exception Rules ---

  async getAllExceptionRules() {
    const res = await pool.query('SELECT * FROM exception_rules WHERE deleted_at IS NULL ORDER BY priority ASC, id ASC');
    return res.rows;
  }
}

module.exports = new IdentityRepository();
