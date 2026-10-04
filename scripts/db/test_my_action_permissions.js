require('dotenv').config();
const pool = require('../../server/db');

async function test() {
  const user = {
    role: 'SUPER ADMIN',
    email: 'admin@quangminhmedia.com',
    employee_level: 1,
    position: 'CEO'
  };

  try {
    const rulesResult = await pool.query('SELECT * FROM action_rules');
    const rules = rulesResult.rows;

    const match = (allowedStr, userVal) => {
      if (!allowedStr || !userVal) return false;
      const cleanVal = String(userVal).trim().replace(/^\[|\]$/g, '').toLowerCase();
      const allowed = (Array.isArray(allowedStr) ? allowedStr : allowedStr.split(','))
        .map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase());
      return allowed.includes(cleanVal);
    };

    const permissions = {};

    for (const rule of rules) {
      const rawActionId = (rule.action_id || '').trim();
      if (!rawActionId) continue;

      let hasAccess = false;
      if (rule.display === false || String(rule.display).toLowerCase() === 'false') {
        hasAccess = false;
      } else if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
        hasAccess = true;
      } else {
        const exceptions = rule.exceptions ? rule.exceptions.split(',').map(s => s.trim()) : [];
        const levels = rule.levels ? rule.levels.split(',').map(s => s.trim()) : [];
        const positions = rule.positions ? rule.positions.split(',').map(s => s.trim()) : [];
        const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()) : [];

        if (match(rule.exceptions, user.email)) hasAccess = true;
        else if (match(rule.roles, user.role)) hasAccess = true;
        else if (match(rule.levels, user.employee_level)) hasAccess = true;
        else if (match(rule.positions, user.position)) hasAccess = true;
        else if (exceptions.length === 0 && levels.length === 0 && positions.length === 0 && roles.length === 0) {
          hasAccess = true;
        }
      }

      const crudMatch = rawActionId.match(/^(add|edit|delete)_(.+)$/i);
      if (crudMatch) {
        const verb = crudMatch[1].toLowerCase();
        const viewSuffix = crudMatch[2].toLowerCase();

        if (!permissions[verb]) permissions[verb] = {};

        let views = [viewSuffix];
        if (rule.view_name) {
          views = rule.view_name.split(',').map(v => v.trim().toLowerCase());
        }

        for (const view of views) {
          if (view === viewSuffix) {
            if (permissions[verb][view] !== true) {
              permissions[verb][view] = hasAccess;
            }
            const contextKey = `${viewSuffix}@${view}`;
            if (permissions[verb][contextKey] !== true) {
              permissions[verb][contextKey] = hasAccess;
            }
          } else {
            if (permissions[verb][view] !== true) {
              permissions[verb][view] = hasAccess;
            }
            const contextKey = `${viewSuffix}@${view}`;
            if (permissions[verb][contextKey] !== true) {
              permissions[verb][contextKey] = hasAccess;
            }
          }
        }
      }
    }

    console.log('--- Permissions for verb "edit": ---');
    console.log(JSON.stringify(permissions.edit, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
