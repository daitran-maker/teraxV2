const repo = require('./organization.repository');

class OrganizationService {
  async getEmployee(employeeId) {
    if (!employeeId) return null;
    return await repo.getEmployeeById(employeeId);
  }

  async getDepartment(departmentId) {
    if (!departmentId) return null;
    return await repo.getDepartmentById(departmentId);
  }

  async getCompany(companyId) {
    if (!companyId) return null;
    return await repo.getCompanyById(companyId);
  }

  async getMyCompany() {
    return await repo.getMyCompanyInfo();
  }

  async getDepartmentMembers(departmentId) {
    if (!departmentId) return [];
    return await repo.getEmployeesByDepartment(departmentId);
  }
}

module.exports = new OrganizationService();
