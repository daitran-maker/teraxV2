const path = require('path');
const fs = require('fs');
const pool = require('../db');

function getDirSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        size += stats.size;
      } else if (stats.isDirectory()) {
        size += getDirSize(filePath);
      }
    }
  } catch (e) {
    // ignore
  }
  return size;
}

async function getSystemStatus() {
  // 1. Get entire app folder size (source code, node_modules, etc.)
  const appDir = path.join(__dirname, '../../');
  const appSize = getDirSize(appDir);

  // 2. Get uploads size (both inside and potentially outside app directory)
  const localUploadsDir = path.join(appDir, 'public/uploads');
  let uploadsSize = getDirSize(localUploadsDir);
  
  const envUploadsDir = process.env.UPLOADS_DIR;
  let externalUploadsSize = 0;
  if (envUploadsDir && fs.existsSync(envUploadsDir)) {
    const resolvedEnvDir = path.resolve(envUploadsDir);
    const resolvedAppDir = path.resolve(appDir);
    if (!resolvedEnvDir.startsWith(resolvedAppDir)) {
      externalUploadsSize = getDirSize(resolvedEnvDir);
      uploadsSize += externalUploadsSize;
    }
  }

  const codeSize = Math.max(0, appSize - getDirSize(localUploadsDir));

  // 3. Get DB size
  let dbSize = 0;
  try {
    const dbRes = await pool.query('SELECT pg_database_size(current_database()) AS size');
    if (dbRes.rows.length && dbRes.rows[0].size !== null) {
      dbSize = parseInt(dbRes.rows[0].size, 10);
    }
  } catch (e) {
    console.error('[SystemStatus] Failed to query db size:', e.message);
  }

  // Total used is app folder size + any external uploads + db size
  const totalUsedBytes = appSize + externalUploadsSize + dbSize;

  // 3. Get tenant info
  const tenantRes = await pool.query('SELECT * FROM cms_tenant_info LIMIT 1');
  const tenant = tenantRes.rows[0] || {};
  const features = typeof tenant.features === 'string' ? JSON.parse(tenant.features) : tenant.features || {};

  // Parse storage limit
  let storageLimitGb = -1;
  if (features.storage_gb !== undefined && features.storage_gb !== null) {
    storageLimitGb = parseFloat(features.storage_gb);
  } else {
    const storageStr = String(features.storage || '').toLowerCase();
    if (storageStr.includes('gb')) {
      storageLimitGb = parseFloat(storageStr);
    }
  }
  const storageLimitBytes = storageLimitGb > 0 ? storageLimitGb * 1024 * 1024 * 1024 : -1;

  // 4. Get active users count and details
  const activeUsersRes = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL'
  );
  const activeUsersCount = activeUsersRes.rows[0].cnt;
  const userLimit = tenant.user_limit !== null && tenant.user_limit !== undefined ? tenant.user_limit : -1;

  const activeUsersListRes = await pool.query(
    'SELECT employee_id, username, full_name, email, role, status FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL ORDER BY username ASC'
  );
  const activeUsersList = activeUsersListRes.rows;

  // 5. Get total employees count
  const totalEmpRes = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM employee WHERE deleted_at IS NULL'
  );
  const totalEmpCount = totalEmpRes.rows[0].cnt;
  
  let employeeScaleLimit = -1;
  if (features.employee_scale !== undefined && features.employee_scale !== null) {
    const scaleVal = features.employee_scale;
    if (typeof scaleVal === 'number') {
      employeeScaleLimit = scaleVal;
    } else {
      const parsedScale = parseInt(String(scaleVal).replace(/[^0-9]/g, ''), 10);
      employeeScaleLimit = isNaN(parsedScale) ? -1 : parsedScale;
    }
  }

  return {
    tenant,
    features,
    storage: {
      usedBytes: totalUsedBytes,
      uploadsBytes: uploadsSize,
      codeBytes: codeSize,
      dbBytes: dbSize,
      limitGb: storageLimitGb,
      limitBytes: storageLimitBytes,
      percentage: storageLimitBytes > 0 ? (totalUsedBytes / storageLimitBytes) * 100 : 0
    },
    activeUsers: {
      count: activeUsersCount,
      limit: userLimit,
      percentage: userLimit > 0 ? (activeUsersCount / userLimit) * 100 : 0,
      list: activeUsersList
    },
    employees: {
      count: totalEmpCount,
      limit: employeeScaleLimit,
      percentage: employeeScaleLimit > 0 ? (totalEmpCount / employeeScaleLimit) * 100 : 0
    }
  };
}

module.exports = { getSystemStatus };
