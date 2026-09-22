const fs = require('fs');
const files = [
  '/opt/app/dev/crc_app/server/routes/dynamic_crud.js',
  '/opt/app/dev/helpdesk_app/server/routes/dynamic_crud.js'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Remove Interceptor from GET /:tableName
    // Find the interceptor block
    const interceptorStart = `    // Intercept query parameters that match current user's email or username and replace with employee_id`;
    const interceptorEnd = `    const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';`;
    
    // We replace the block from interceptorStart to interceptorEnd with just interceptorEnd
    // First, let's just do a regex replace if it exists
    const interceptorRegex = new RegExp(`\\s*// Intercept query parameters.*?\\s+const isSuperAdmin = user && user\\.role && user\\.role\\.toUpperCase\\(\\) === 'SUPER ADMIN';`, 's');
    content = content.replace(interceptorRegex, `\n    const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';`);

    // Replace userEmail with userEmployeeId
    content = content.replace(/userEmail/g, 'userEmployeeId');

    // There might be some local `const email = (userEmployeeId || '').toLowerCase();`
    // No need to rename `email` variable inside validateRequestChildPermissions, it's just a variable. But wait, `email` implies it's an email! Let's leave local variables if they are not exposed.

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
