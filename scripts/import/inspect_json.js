const fs = require('fs');

const files = ['data/mymps.json', 'mymps.json', 'new_data_mps.json', '0206_mymps.json', '0206_mymps2.json'];

for (const file of files) {
  if (fs.existsSync(file)) {
    console.log(`\n=================== FILE: ${file} ===================`);
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.tables) {
        const keys = Object.keys(data.tables);
        console.log('Tables found:', keys);
        // Let's search for similar names:
        const matches = keys.filter(k => /service|asset|mtr/i.test(k));
        console.log('Matching tables:', matches);
        for (const m of matches) {
          console.log(`Table ${m} has ${data.tables[m]?.rows?.length || 0} rows.`);
          if (data.tables[m]?.rows?.length > 0) {
            console.log(`Sample row from ${m}:`, JSON.stringify(data.tables[m].rows[0], null, 2));
          }
        }
      } else {
        console.log('No .tables property found. Top level keys:', Object.keys(data));
      }
    } catch (err) {
      console.log(`Error parsing ${file}:`, err.message);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
}
