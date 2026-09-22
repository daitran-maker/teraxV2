const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('MPS - CPI _ DOCUMENT LISTS.xlsx');
const sheet = workbook.Sheets['Database CL'];
const json = XLSX.utils.sheet_to_json(sheet);

const tables = {};

// Parse sheet
let currentEntity = null;
for (const row of json) {
  if (row['DATA ENTITY'] && row['DATA ENTITY'].trim() !== '') {
    currentEntity = row['DATA ENTITY'].trim().toLowerCase().replace(/ /g, '_');
    if (currentEntity === 'request_detail') currentEntity = 'comment'; // Handle naming discrepancy
    if (currentEntity === 'process') currentEntity = 'policy_and_program';
  }
  
  if (!currentEntity) continue;
  if (row['TYPE'] !== 'Physical') continue; // Only physical columns go to DB

  if (!tables[currentEntity]) {
    tables[currentEntity] = [];
  }

  const colName = row['COLUMN NAME'] ? row['COLUMN NAME'].trim().toLowerCase().replace(/ /g, '_') : null;
  if (!colName) continue;

  const appType = row['DATA TYPE'] ? row['DATA TYPE'].trim() : 'Text';
  let pgType = 'TEXT';
  
  if (appType.toLowerCase().includes('date') && !appType.toLowerCase().includes('time')) pgType = 'DATE';
  else if (appType.toLowerCase().includes('datetime')) pgType = 'TIMESTAMP';
  else if (appType.toLowerCase().includes('price') || appType.toLowerCase().includes('number') || appType.toLowerCase().includes('decimal')) pgType = 'NUMERIC';
  else if (appType.toLowerCase() === 'yes/no' || appType.toLowerCase() === 'boolean') pgType = 'BOOLEAN';

  tables[currentEntity].push({
    colName,
    pgType,
    required: row['REQUIRED '] === true || row['REQUIRED '] === 'TRUE' || String(row['REQUIRED ']).toLowerCase() === 'true'
  });
}

let sql = '';

for (const [tableName, cols] of Object.entries(tables)) {
  sql += `-- Table: ${tableName}\n`;
  sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
  
  const colDefs = cols.map(c => `  "${c.colName}" ${c.pgType}`);
  // Try to find the ID column (usually the first one or named id / table_id)
  let pk = cols.find(c => c.colName === `${tableName}_id` || c.colName === 'id');
  if (!pk) pk = cols[0]; // Fallback to first column
  
  sql += colDefs.join(',\n');
  if (pk) {
    sql += `,\n  PRIMARY KEY ("${pk.colName}")`;
  }
  sql += `\n);\n\n`;

  // Also generate ALTER TABLE ADD COLUMN IF NOT EXISTS for existing tables
  for (const c of cols) {
    sql += `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${c.colName}') THEN\n`;
    sql += `    ALTER TABLE "${tableName}" ADD COLUMN "${c.colName}" ${c.pgType};\n`;
    sql += `  END IF;\nEND $$;\n\n`;
  }
}

fs.writeFileSync('sync_excel_schema.sql', sql);
console.log('Generated sync_excel_schema.sql successfully!');
