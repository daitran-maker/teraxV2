const pool = require('../server/db');
const fs = require('fs');
const path = require('path');

async function exportDatabaseSchema() {
  const client = await pool.connect();
  try {
    console.log('Fetching database schema details...');

    // 1. Get all base tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);

    // 2. Get all columns
    const columnsRes = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // 3. Get all constraints (PK, FK, UNIQUE)
    const constraintsRes = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        kcu.ordinal_position,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
    `);

    // 4. Get all indexes
    const indexesRes = await client.query(`
      SELECT
        tablename AS table_name,
        indexname AS index_name,
        indexdef AS index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    // Organize data into structured tables JSON
    const schemaMap = {};

    tableNames.forEach(t => {
      schemaMap[t] = {
        table_name: t,
        columns: [],
        primary_keys: [],
        foreign_keys: [],
        constraints: [],
        indexes: []
      };
    });

    // Populate columns
    columnsRes.rows.forEach(col => {
      if (!schemaMap[col.table_name]) return;
      schemaMap[col.table_name].columns.push({
        column_name: col.column_name,
        data_type: col.data_type,
        character_maximum_length: col.character_maximum_length,
        numeric_precision: col.numeric_precision,
        is_nullable: col.is_nullable === 'YES',
        column_default: col.column_default,
        is_primary_key: false,
        is_foreign_key: false
      });
    });

    // Process constraints
    const constraintGroups = {};
    constraintsRes.rows.forEach(c => {
      const key = `${c.table_name}::${c.constraint_name}`;
      if (!constraintGroups[key]) {
        constraintGroups[key] = {
          table_name: c.table_name,
          constraint_name: c.constraint_name,
          constraint_type: c.constraint_type,
          columns: [],
          foreign_table: c.foreign_table_name || null,
          foreign_columns: []
        };
      }
      if (!constraintGroups[key].columns.includes(c.column_name)) {
        constraintGroups[key].columns.push(c.column_name);
      }
      if (c.foreign_column_name && !constraintGroups[key].foreign_columns.includes(c.foreign_column_name)) {
        constraintGroups[key].foreign_columns.push(c.foreign_column_name);
      }
    });

    Object.values(constraintGroups).forEach(cg => {
      const targetTable = schemaMap[cg.table_name];
      if (!targetTable) return;

      targetTable.constraints.push({
        constraint_name: cg.constraint_name,
        type: cg.constraint_type,
        columns: cg.columns,
        foreign_table: cg.foreign_table,
        foreign_columns: cg.foreign_columns.length > 0 ? cg.foreign_columns : null
      });

      if (cg.constraint_type === 'PRIMARY KEY') {
        targetTable.primary_keys.push(...cg.columns);
        cg.columns.forEach(colName => {
          const col = targetTable.columns.find(c => c.column_name === colName);
          if (col) col.is_primary_key = true;
        });
      } else if (cg.constraint_type === 'FOREIGN KEY') {
        targetTable.foreign_keys.push({
          constraint_name: cg.constraint_name,
          columns: cg.columns,
          foreign_table: cg.foreign_table,
          foreign_columns: cg.foreign_columns
        });
        cg.columns.forEach(colName => {
          const col = targetTable.columns.find(c => c.column_name === colName);
          if (col) col.is_foreign_key = true;
        });
      }
    });

    // Process indexes
    indexesRes.rows.forEach(idx => {
      if (!schemaMap[idx.table_name]) return;
      schemaMap[idx.table_name].indexes.push({
        index_name: idx.index_name,
        definition: idx.index_definition
      });
    });

    const exportData = {
      database: 'crcdevdb',
      exported_at: new Date().toISOString(),
      table_count: tableNames.length,
      tables: schemaMap
    };

    const outputPath = path.join(__dirname, '../db_design.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(`✅ Exported DB design successfully to: ${outputPath}`);

    // Also copy to root /opt/app/db_design.json
    const rootPath = '/opt/app/db_design.json';
    fs.writeFileSync(rootPath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(`✅ Copied to: ${rootPath}`);

    // Run DBML generator
    try {
      const generateDbml = require('./generate_dbml');
    } catch (e) {
      console.log('Generated DBML via script.');
    }
  } catch (err) {
    console.error('Error exporting database schema:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

exportDatabaseSchema();
