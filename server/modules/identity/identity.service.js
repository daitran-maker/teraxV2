const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const repo = require('./identity.repository');
const { checkPermission, clearPermissionCache } = require('../../helpers/permissionHelper');
const { pushLoginToCMS } = require('../../helpers/cmsSeats');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

const CLIENT_ID = '57927835497-1sv59lihil921e8cg3vpp1fr7oeef7pc.apps.googleusercontent.com';
const googleClient = new OAuth2Client(CLIENT_ID);

class IdentityService {
  createAuthToken(user) {
    return jwt.sign(
      {
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        company_id: user.company_id,
        department_id: user.department_id,
        full_name: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  async loginWithPassword(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Tài khoản và mật khẩu là bắt buộc');
    }

    const user = await repo.findEmployeeForAuth(identifier);
    if (!user) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    if (user.status === 'Inactive' || user.app_user_enabled === false) {
      throw new Error('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    // Password verification via bcryptjs
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      // Fallback for temporary unhashed migration passwords
      if (user.password === password) {
        // Auto-upgrade password to bcrypt
        const hashed = await bcrypt.hash(password, 10);
        await repo.updatePassword(user.employee_id, hashed);
      } else {
        throw new Error('Tài khoản hoặc mật khẩu không chính xác');
      }
    }

    const token = this.createAuthToken(user);

    // Sync seat with CMS non-blocking
    pushLoginToCMS(user.email).catch(() => {});

    return {
      token,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        nick_name: user.nick_name,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        company_id: user.company_id,
        department_id: user.department_id
      }
    };
  }

  async loginWithGoogle(credential) {
    if (!credential) throw new Error('Google credential missing');

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new Error('Invalid Google payload');

    const user = await repo.findEmployeeByEmail(payload.email);
    if (!user) {
      throw new Error('Tài khoản Google này chưa được liên kết với nhân viên nào trong hệ thống');
    }

    const token = this.createAuthToken(user);
    pushLoginToCMS(user.email).catch(() => {});

    return {
      token,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        nick_name: user.nick_name,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        company_id: user.company_id,
        department_id: user.department_id
      }
    };
  }

  async changePassword(employeeId, oldPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const user = await repo.findEmployeeForAuth(employeeId);
    if (!user) throw new Error('Không tìm thấy tài khoản');

    const isMatch = await bcrypt.compare(oldPassword, user.password || '');
    if (!isMatch && user.password !== oldPassword) {
      throw new Error('Mật khẩu hiện tại không chính xác');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await repo.updatePassword(user.employee_id, hashed);
    return true;
  }

  async getSwitchUsers() {
    return await repo.getActiveEmployeesForSwitch();
  }

  async switchUser(targetEmployeeId) {
    if (!targetEmployeeId) {
      throw new Error('Missing employee_id.');
    }

    const user = await repo.findActiveEmployeeById(targetEmployeeId);
    if (!user) {
      throw new Error('User not found or inactive.');
    }

    if (user.app_user_enabled === false) {
      throw new Error('This account has been disabled.');
    }

    const token = this.createAuthToken(user);
    return {
      token,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        full_name: user.full_name,
        nick_name: user.nick_name,
        email: user.email,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        company_id: user.company_id,
        department_id: user.department_id
      }
    };
  }

  // Permission evaluation delegate
  checkFieldPermission(table, column, user) {
    return checkPermission(table, column, user);
  }

  clearPermissions() {
    clearPermissionCache();
  }
}

module.exports = new IdentityService();
