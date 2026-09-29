const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../db_design.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const schema = JSON.parse(rawData);

function formatType(col) {
  let type = col.data_type;
  if (type === 'character varying') {
    type = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'varchar';
  } else if (type === 'timestamp without time zone' || type === 'timestamp with time zone') {
    type = 'timestamp';
  } else if (type === 'double precision') {
    type = 'double';
  }
  return type;
}

function formatDefault(defStr) {
  if (!defStr) return null;
  let clean = defStr.trim();
  
  // Clean up pg sequence nextval defaults
  if (clean.includes('nextval(')) {
    const match = clean.match(/nextval\((.*?)\)/);
    if (match) {
      const seq = match[1].replace(/::[a-zA-Z0-9_\s]+/g, '').trim();
      return `\`nextval(${seq})\``;
    }
  }

  // Remove PostgreSQL type casts like ::character varying, ::integer, ::text
  clean = clean.replace(/::[a-zA-Z0-9_\s\(\)]+/g, '').trim();
  
  if (clean.startsWith("'") && clean.endsWith("'")) {
    return clean;
  }
  if (!isNaN(clean)) {
    return clean;
  }
  if (clean.toLowerCase() === 'true' || clean.toLowerCase() === 'false') {
    return clean.toLowerCase();
  }
  if (clean.includes('(') || clean.includes('CURRENT_') || clean.includes('now()')) {
    return `\`${clean}\``;
  }
  return `'${clean}'`;
}

function cleanIndexCol(rawCol, validColNames) {
  let col = rawCol.trim();
  // Strip ASC/DESC NULLS FIRST/LAST
  col = col.replace(/\s+(ASC|DESC)/gi, '');
  col = col.replace(/\s+NULLS\s+(FIRST|LAST)/gi, '');
  
  // Extract column name from expression like lower((direct_manager)::text) or lower(policy_lead)
  const lowerMatch = col.match(/lower\s*\(\s*\(?\s*([a-zA-Z0-9_]+)/i);
  if (lowerMatch && validColNames.includes(lowerMatch[1])) {
    return lowerMatch[1];
  }

  // Remove typecasts like ::text
  col = col.replace(/::[a-zA-Z0-9_\s]+/g, '');
  // Remove outer parens and quotes
  col = col.replace(/^[\(\"\']+|[\)\"\']+$/g, '').trim();

  if (validColNames.includes(col)) {
    return col;
  }
  return null; // Invalid column expression
}

let dbml = `// Database Markup Language (DBML) generated for ${schema.database || 'crcdevdb'}\n`;
dbml += `// Exported at: ${schema.exported_at || new Date().toISOString()}\n\n`;

dbml += `Project crc_app {\n`;
dbml += `  database_type: 'PostgreSQL'\n`;
dbml += `  Note: 'Database schema for crc_app system'\n`;
dbml += `}\n\n`;

// 1. Table Definitions
const tables = schema.tables;
const tableNames = Object.keys(tables).sort();

for (const tableName of tableNames) {
  const tbl = tables[tableName];
  const validColNames = tbl.columns.map(c => c.column_name);

  dbml += `Table "${tableName}" {\n`;
  
  for (const col of tbl.columns) {
    const colType = formatType(col);
    const attrs = [];
    
    if (col.is_primary_key) {
      attrs.push('pk');
    }
    if (!col.is_nullable && !col.is_primary_key) {
      attrs.push('not null');
    }
    if (col.column_default !== null && col.column_default !== undefined) {
      const defVal = formatDefault(col.column_default);
      if (defVal !== null) {
        attrs.push(`default: ${defVal}`);
      }
    }
    
    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    dbml += `  "${col.column_name}" ${colType}${attrStr}\n`;
  }

  // Indexes if any
  if (tbl.indexes && tbl.indexes.length > 0) {
    const validIndexes = tbl.indexes.filter(idx => !idx.index_name.endsWith('_pkey'));
    const indexLines = [];
    const seenColCombos = new Set();

    for (const idx of validIndexes) {
      const match = idx.definition.match(/\((.*?)\)/);
      if (match) {
        const rawCols = match[1].split(',');
        const cleanedCols = [];
        let valid = true;

        for (const rc of rawCols) {
          const cName = cleanIndexCol(rc, validColNames);
          if (cName) {
            cleanedCols.push(`"${cName}"`);
          } else {
            valid = false;
            break;
          }
        }

        if (valid && cleanedCols.length > 0) {
          const colCombo = cleanedCols.join(', ');
          const isUnique = idx.definition.toUpperCase().includes('UNIQUE');

          // Avoid duplicating identical column index combinations for the same table
          if (!seenColCombos.has(colCombo)) {
            seenColCombos.add(colCombo);
            const idxAttrs = [];
            if (idx.index_name) idxAttrs.push(`name: "${idx.index_name}"`);
            if (isUnique) idxAttrs.push('unique');
            const idxAttrStr = idxAttrs.length > 0 ? ` [${idxAttrs.join(', ')}]` : '';
            indexLines.push(`    (${colCombo})${idxAttrStr}`);
          }
        }
      }
    }

    if (indexLines.length > 0) {
      dbml += `\n  Indexes {\n`;
      dbml += indexLines.join('\n') + '\n';
      dbml += `  }\n`;
    }
  }

  dbml += `}\n\n`;
}

// 2. Explicit Foreign Key References
dbml += `// Explicit Foreign Key Constraints\n`;
const explicitRefsSet = new Set();

for (const tableName of tableNames) {
  const tbl = tables[tableName];
  if (tbl.foreign_keys && tbl.foreign_keys.length > 0) {
    for (const fk of tbl.foreign_keys) {
      if (fk.foreign_table && fk.foreign_columns && fk.foreign_columns.length > 0) {
        const fromCol = fk.columns[0];
        const toTable = fk.foreign_table;
        const toCol = fk.foreign_columns[0];
        const refLine = `Ref: "${tableName}"."${fromCol}" > "${toTable}"."${toCol}"`;
        if (!explicitRefsSet.has(refLine)) {
          explicitRefsSet.add(refLine);
          dbml += `${refLine}\n`;
        }
      }
    }
  }
}

// 3. Logical / Convention References (excluding generic 'id')
dbml += `\n// Additional Logical Relationships (inferred by column naming convention)\n`;
const logicalRefsSet = new Set();

for (const tableName of tableNames) {
  const tbl = tables[tableName];
  for (const col of tbl.columns) {
    const colName = col.column_name;
    if (col.is_primary_key) continue;
    if (col.is_foreign_key) continue;
    if (colName === 'id') continue;

    for (const targetTName of tableNames) {
      if (targetTName === tableName) continue;
      const targetTbl = tables[targetTName];
      if (targetTbl.primary_keys.includes(colName)) {
        const explicitLine = `Ref: "${tableName}"."${colName}" > "${targetTName}"."${colName}"`;
        if (!explicitRefsSet.has(explicitLine) && !logicalRefsSet.has(explicitLine)) {
          logicalRefsSet.add(explicitLine);
          dbml += `Ref: "${tableName}"."${colName}" > "${targetTName}"."${colName}"\n`;
        }
      }
    }
  }
}

const outputPath = path.join(__dirname, '../schema.dbml');
fs.writeFileSync(outputPath, dbml, 'utf8');
console.log(`✅ DBML generated successfully at: ${outputPath}`);

const rootPath = '/opt/app/schema.dbml';
fs.writeFileSync(rootPath, dbml, 'utf8');
console.log(`✅ DBML copied to: ${rootPath}`);

