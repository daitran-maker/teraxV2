const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const repo = require('./identity.repository');
const { checkPermission, clearPermissionCache } = require('../../../server/helpers/permissionHelper');
const { pushLoginToCMS } = require('../../../server/helpers/cmsSeats');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

// Session lifetime (was 365d). Override with JWT_EXPIRES_IN, e.g. "12h", "7d".
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// SSO token (issued by CMS) must be fresher than this and can be used only once.
const SSO_MAX_AGE_MS = 5 * 60 * 1000;
const usedSsoSignatures = new Map(); // signature -> expiry timestamp

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '57927835497-1sv59lihil921e8cg3vpp1fr7oeef7pc.apps.googleusercontent.com';
const googleClient = new OAuth2Client(CLIENT_ID);

// Used to keep response time similar when the account does not exist.
const DUMMY_HASH = bcrypt.hashSync('terax-dummy-password', 10);

/** Error whose message is safe to show to the client. */
class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.expose = true;
  }
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function publicUser(user) {
  return {
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
  };
}

function isInactive(user) {
  return user.status === 'Inactive' || user.app_user_enabled === false;
}

class IdentityService {
  createAuthToken(user, extraClaims = {}) {
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
        full_name: user.full_name,
        ...extraClaims
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
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
      throw new AuthError('Tài khoản và mật khẩu là bắt buộc', 400);
    }

    const user = await repo.findEmployeeForAuth(identifier);
    if (!user) {
      await bcrypt.compare(String(password), DUMMY_HASH); // equalize timing
      throw new AuthError('Tài khoản hoặc mật khẩu không chính xác');
    }

    // Password verification via bcryptjs
    const stored = user.password || '';
    let verified = false;
    if (isBcryptHash(stored)) {
      verified = await bcrypt.compare(String(password), stored);
    } else if (stored) {
      // Legacy unhashed password: compare in constant time, then upgrade to bcrypt below.
      verified = safeEqual(stored, password);
      if (verified) {
        const hashed = await bcrypt.hash(String(password), BCRYPT_COST);
        await repo.updatePassword(user.employee_id, hashed);
      }
    } else {
      await bcrypt.compare(String(password), DUMMY_HASH);
    }
    if (!verified) {
      throw new AuthError('Tài khoản hoặc mật khẩu không chính xác');
    }

    // Only reveal "disabled" once the caller proved they know the password
    if (isInactive(user)) {
      throw new AuthError('Tài khoản của bạn đã bị vô hiệu hóa', 403);
    }

    const token = this.createAuthToken(user);

    // Sync seat with CMS non-blocking
    pushLoginToCMS(user.email).catch(() => {});

    return { token, user: publicUser(user) };
  }

  async loginWithGoogle(credential) {
    if (!credential || typeof credential !== 'string') throw new AuthError('Google credential missing', 400);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (e) {
      throw new AuthError('Google credential is invalid');
    }
    if (!payload || !payload.email || payload.email_verified === false) throw new AuthError('Invalid Google payload');

    const user = await repo.findEmployeeByEmail(payload.email);
    if (!user) {
      throw new AuthError('Tài khoản Google này chưa được liên kết với nhân viên nào trong hệ thống');
    }
    if (isInactive(user)) {
      throw new AuthError('Tài khoản của bạn đã bị vô hiệu hóa', 403);
    }

    const token = this.createAuthToken(user);
    pushLoginToCMS(user.email).catch(() => {});

    return { token, user: publicUser(user) };
  }

  /**
   * Verify the HMAC-signed SSO token issued by the CMS.
   * Returns the lower-cased e-mail on success, throws AuthError otherwise.
   */
  verifySsoToken(ssoToken, signature, hostname) {
    const secret = process.env.CMS_HMAC_SECRET;
    if (!secret) throw new AuthError('SSO is not configured', 500);
    if (typeof ssoToken !== 'string' || typeof signature !== 'string' || ssoToken.length > 4096 || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new AuthError('Invalid SSO token', 400);
    }

    const expected = crypto.createHmac('sha256', secret).update(ssoToken).digest('hex');
    if (!safeEqual(expected, signature.toLowerCase())) {
      throw new AuthError('Invalid SSO signature');
    }

    let data;
    try {
      data = JSON.parse(Buffer.from(ssoToken, 'base64').toString('utf-8'));
    } catch (e) {
      throw new AuthError('Invalid SSO payload', 400);
    }
    if (!data || typeof data.email !== 'string' || !data.email) {
      throw new AuthError('Invalid SSO payload', 400);
    }
    if (typeof data.ts !== 'number' || Math.abs(Date.now() - data.ts) > SSO_MAX_AGE_MS) {
      throw new AuthError('SSO token expired');
    }
    if (!data.aud || String(data.aud).toLowerCase() !== String(hostname || '').toLowerCase()) {
      throw new AuthError('SSO token was issued for a different site');
    }

    // single use
    const now = Date.now();
    for (const [sig, exp] of usedSsoSignatures) {
      if (exp < now) usedSsoSignatures.delete(sig);
    }
    const sigKey = signature.toLowerCase();
    if (usedSsoSignatures.has(sigKey)) throw new AuthError('SSO token already used');
    usedSsoSignatures.set(sigKey, now + SSO_MAX_AGE_MS * 2);

    return data.email.toLowerCase();
  }

  /** Magic-login tokens must be dedicated, short-lived tokens (purpose = "magic"). */
  verifyMagicToken(token) {
    const decoded = this.verifyToken(token);
    if (!decoded || decoded.purpose !== 'magic' || !decoded.exp || !decoded.email) return null;
    return decoded;
  }

  async changePassword(employeeId, oldPassword, newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`, 400);
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      throw new AuthError(`Mật khẩu mới tối đa ${MAX_PASSWORD_LENGTH} ký tự`, 400);
    }

    const user = await repo.findEmployeeForAuth(employeeId);
    if (!user) throw new AuthError('Không tìm thấy tài khoản', 404);

    const stored = user.password || '';
    let ok = false;
    if (isBcryptHash(stored)) ok = await bcrypt.compare(String(oldPassword), stored);
    else if (stored) ok = safeEqual(stored, oldPassword);
    if (!ok) {
      throw new AuthError('Mật khẩu hiện tại không chính xác', 400);
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_COST);
    await repo.updatePassword(user.employee_id, hashed);
    return true;
  }

  async getSwitchUsers() {
    return await repo.getActiveEmployeesForSwitch();
  }

  /**
   * Impersonation / "switch user". The caller (decoded token) must be a Super Admin,
   * or a session that was itself started by a Super Admin (so they can switch back).
   */
  async switchUser(targetEmployeeId, actor) {
    if (!targetEmployeeId) {
      throw new AuthError('Missing employee_id.', 400);
    }

    const user = await repo.findActiveEmployeeById(targetEmployeeId);
    if (!user) {
      throw new AuthError('User not found or inactive.', 404);
    }

    if (user.app_user_enabled === false) {
      throw new AuthError('This account has been disabled.', 403);
    }

    const impersonatedBy = (actor && actor.impersonated_by) || (actor && actor.employee_id) || undefined;
    const token = this.createAuthToken(user, impersonatedBy ? { impersonated_by: impersonatedBy } : {});
    console.log(`[Audit] switch-user: ${impersonatedBy || 'unknown'} -> ${user.employee_id}`);
    return { token, user: publicUser(user) };
  }

  /** Can this decoded token use the user-switcher? */
  canSwitchUsers(decoded) {
    if (!decoded) return false;
    if (decoded.impersonated_by) return true;
    return String(decoded.role || '').trim().toUpperCase() === 'SUPER ADMIN';
  }

  // Permission evaluation delegate
  checkFieldPermission(table, column, user) {
    return checkPermission(table, column, user);
  }

  clearPermissions() {
    clearPermissionCache();
  }
}

const service = new IdentityService();
service.AuthError = AuthError;
service.MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;
service.MAX_PASSWORD_LENGTH = MAX_PASSWORD_LENGTH;
module.exports = service;
