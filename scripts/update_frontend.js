const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  '/opt/app/dev/crc_app/public/config.js',
  '/opt/app/dev/crc_app/public/app.js',
  '/opt/app/dev/helpdesk_app/public/config.js',
  '/opt/app/dev/helpdesk_app/public/app.js'
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Replace optionValue: 'email' with optionValue: 'employee_id' where optionsFrom is employee or employee_active
    // We'll use a regex that handles both single and double quotes, and arbitrary spacing.
    content = content.replace(/(optionsFrom\s*:\s*['"]employee(?:_active)?['"]\s*,\s*optionValue\s*:\s*['"])email(['"])/g, '$1employee_id$2');
    
    // Reverse order just in case optionValue comes first
    content = content.replace(/(optionValue\s*:\s*['"])email(['"]\s*,\s*optionsFrom\s*:\s*['"]employee(?:_active)?['"])/g, '$1employee_id$2');

    // 2. Fix pk: 'email' in employee_active (or any other config that might erroneously use it)
    content = content.replace(/(pk\s*:\s*['"])email(['"])/g, (match, p1, p2) => {
      // It's safer to just change it. The only table that has pk='email' naturally might be something else, but here we only have employee stuff
      return `${p1}employee_id${p2}`;
    });

    // 3. Fix defaultValue: () => authUser.email
    content = content.replace(/authUser\.email/g, 'authUser.employee_id');

    // 4. Update the multiselect 'exceptions' to use employee_id
    content = content.replace(/(key\s*:\s*['"]exceptions['"].*?optionValue\s*:\s*['"])email(['"])/g, '$1employee_id$2');
    content = content.replace(/(key\s*:\s*['"]exceptions['"].*?optionLabel\s*:\s*['"])email(['"])/g, '$1full_name$2');

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
}
