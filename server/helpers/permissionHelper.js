const pool = require('../db');

/**
 * Checks if a user has access to a specific rule (Exception or Action).
 * Logic: User gets access if their email is in 'exceptions', or if their 
 * level, position, or role is in the respective allowed lists.
 * 
 * @param {string} ruleType - 'exception_rules' or 'action_rules'
 * @param {string} ruleName - The name (for exception) or action_id (for action)
 * @param {Object} user - The user object containing email, employee_level, position, role
 * @returns {Promise<boolean>}
 */

// In-memory cache to avoid repeated DB round-trips for the same permission rule.
// Rules change rarely so a 5-minute TTL keeps things fresh without hammering the DB
// on every child-tab load (8 tabs × 1 DB query each = 8 queries per detail view open).
const _ruleCache = new Map();
const RULE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getRuleFromCache(tableName, nameColumn, ruleName) {
  const cacheKey = `${tableName}::${ruleName}`;
  const cached = _ruleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RULE_CACHE_TTL_MS) {
    return cached.rows;
  }
  const result = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${nameColumn} = $1`,
    [ruleName]
  );
  _ruleCache.set(cacheKey, { rows: result.rows, ts: Date.now() });
  return result.rows;
}

async function checkPermission(ruleType, ruleName, user, viewName = null) {
  let normalizedRuleName = ruleName;
  let normalizedViewName = viewName;

  // Normalize request-like views to 'request' for child table operations
  const childTables = ['payment', 'expense', 'invoice', 'mtr', 'service', 'asset', 'contract', 'target_table', 'assigned_task'];
  const actionMatch = String(ruleName).match(/^(add|edit|delete)_(.+)$/i);
  if (actionMatch && childTables.includes(actionMatch[2].toLowerCase())) {
    if (['my_request', 'my_approval', 'my_task', 'my_process_owner', 'my_team'].includes(viewName)) {
      normalizedViewName = 'request';
    }
  }

  if (!user || (!user.email && !user.employee_level && !user.position && !user.role)) {
    return false;
  }

  // comment tab is always accessible
  if (normalizedRuleName === 'comment') {
    return true;
  }

  const tableName = ruleType === 'exception_rules' ? 'exception_rules' : 'action_rules';
  const nameColumn = ruleType === 'exception_rules' ? 'name' : 'action_id';

  try {
    let rows = await getRuleFromCache(tableName, nameColumn, normalizedRuleName);

    // Filter by viewName if it is action_rules
    if (ruleType === 'action_rules' && normalizedViewName) {
      const targetView = normalizedViewName.toLowerCase();
      const suffix = normalizedRuleName.replace(/^(add|edit|delete)_/i, '').toLowerCase();

      // First, try to find rules explicitly matching the targetView (e.g., 'request')
      const explicitRules = rows.filter(rule => {
        if (!rule.view_name) return false;
        const views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
        return views.includes(targetView);
      });

      if (explicitRules.length > 0) {
        rows = explicitRules;
      } else {
        // Fall back to rules matching suffix (e.g. 'expense') or empty/global rules
        rows = rows.filter(rule => {
          if (!rule.view_name) return true;
          const views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
          return views.includes(suffix);
        });
      }
    }

    if (rows.length === 0) {
      // No rule defined → allow (permissive default, matches AppSheet behaviour)
      return true;
    }

    // Check if the rules are action rules and ALL matching ones are disabled (display === false)
    if (ruleType === 'action_rules') {
      const allDisabled = rows.every(rule => rule.display === false || String(rule.display).toLowerCase() === 'false');
      if (allDisabled) {
        return false;
      }
    }

    // Super Admin bypass for active/enabled rules
    if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
      return true;
    }

    // Helper: check if userVal exists in a comma-separated allowed list
    const match = (allowedStr, userVal) => {
      if (!allowedStr || !userVal) return false;
      const cleanVal = String(userVal).trim().replace(/^\[|\]$/g, '').toLowerCase();
      const allowed = (Array.isArray(allowedStr) ? allowedStr : allowedStr.split(','))
        .map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase());
      return allowed.includes(cleanVal);
    };

    let hasExplicitRules = false;

    for (const rule of rows) {
      const exceptions = rule.exceptions ? rule.exceptions.split(',').map(s => s.trim()) : [];
      const levels = rule.levels ? rule.levels.split(',').map(s => s.trim()) : [];
      const positions = rule.positions ? rule.positions.split(',').map(s => s.trim()) : [];
      const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()) : [];

      if (exceptions.length > 0 || levels.length > 0 || positions.length > 0 || roles.length > 0) {
        hasExplicitRules = true;
      } else {
        // If there's a rule but it has no criteria:
        // For menu slices (exception_rules), treat it as restricted/denied by default (requires explicit role)
        if (ruleType === 'exception_rules') {
          hasExplicitRules = true;
        } else {
          // For action rules, keep permissive default
          return true;
        }
      }

      // 1. Email exception (highest priority)
      if (match(rule.exceptions, user.email)) return true;

      // Dynamic placeholders like [sr_creater] / [requester] for add actions apply to any authenticated creator
      if (rule.roles) {
        const roleList = (Array.isArray(rule.roles) ? rule.roles : rule.roles.split(',')).map(s => s.trim().toLowerCase());
        if (roleList.some(r => r === '[requester]' || r === '[sr_creater]' || r === 'requester' || r === 'sr_creater')) {
          return true;
        }
      }

      // 2. Role match
      if (match(rule.roles, user.role)) return true;

      // 3. Level match
      if (match(rule.levels, user.employee_level)) return true;

      // 4. Position match
      if (match(rule.positions, user.position)) return true;
    }

    // If all matching rules have empty criteria, allow access
    if (!hasExplicitRules) {
      return true;
    }

    console.log(`[checkPermission] Rule found for ${normalizedRuleName} (view: ${normalizedViewName || 'N/A'}), but user did not match any allowed criteria.`);
    return false;
  } catch (err) {
    console.error(`Permission check failed for ${ruleType}:${normalizedRuleName}`, err);
    return false;
  }
}

function clearPermissionCache() {
  _ruleCache.clear();
  console.log('[permissionHelper] Rule cache cleared.');
}

module.exports = { checkPermission, clearPermissionCache };
