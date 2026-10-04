const pool = require('../../../server/db');

class OrganizationRepository {
  async getEmployeeById(employeeId) {
    const res = await pool.query(
      `SELECT employee_id, username, email, full_name, nick_name, role, employee_level, position, 
              company_id, department_id, head_manager, status, app_user_enabled, avatar
       FROM employee
       WHERE (employee_id = $1 OR LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1))
         AND deleted_at IS NULL
       LIMIT 1`,
      [employeeId]
    );
    return res.rows[0] || null;
  }

  async getEmployeesByDepartment(departmentId) {
    const res = await pool.query(
      `SELECT employee_id, full_name, email, position, employee_level
       FROM employee
       WHERE department_id = $1 AND deleted_at IS NULL
       ORDER BY full_name ASC`,
      [departmentId]
    );
    return res.rows;
  }

  async getDepartmentById(departmentId) {
    const res = await pool.query(
      `SELECT * FROM department WHERE department_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [departmentId]
    );
    return res.rows[0] || null;
  }

  async getCompanyById(companyId) {
    const res = await pool.query(
      `SELECT * FROM company WHERE company_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [companyId]
    );
    return res.rows[0] || null;
  }

  async getMyCompanyInfo() {
    const res = await pool.query(
      `SELECT company_shortname, company_fullname, logo, address, phone, email
       FROM my_company
       ORDER BY my_company_id ASC
       LIMIT 1`
    );
    return res.rows[0] || null;
  }
}

module.exports = new OrganizationRepository();
