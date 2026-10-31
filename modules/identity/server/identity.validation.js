const { z } = require('zod');

// ---- Input validation schemas (unknown keys are stripped) ----
const str = (max) => z.string().max(max);

const loginSchema = z.object({
  credential: str(4096).optional(),
  login_id: str(254).optional(),
  username: str(254).optional(),
  email: str(254).optional(),
  password: str(128).optional()
});

const googleLoginSchema = z.object({
  credential: str(4096).min(1)
});

const changePasswordSchema = z.object({
  oldPassword: str(128).optional(),
  old_password: str(128).optional(),
  newPassword: str(128).optional(),
  new_password: str(128).optional()
});

const switchUserSchema = z.object({
  employee_id: str(100).min(1)
});

const ssoQuerySchema = z.object({
  sso_token: str(4096).min(1),
  sso_sig: str(128).min(1)
});

const magicQuerySchema = z.object({
  token: str(4096).min(1)
});

/** Parse `data` with `schema`; on failure responds 400 and returns null. */
function parseOrReject(schema, data, res, message = 'Dữ liệu gửi lên không hợp lệ.') {
  const parsed = schema.safeParse(data === undefined ? {} : data);
  if (!parsed.success) {
    res.status(400).json({ error: message });
    return null;
  }
  return parsed.data;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  parseOrReject,
  escapeHtml,
  loginSchema,
  googleLoginSchema,
  changePasswordSchema,
  switchUserSchema,
  ssoQuerySchema,
  magicQuerySchema
};
