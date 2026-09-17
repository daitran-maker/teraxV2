const fs = require('fs');
const pool = require('../../server/db');
const data = require('../../data/action_cl_data.json');

async function seed() {
  for (const item of data) {
    const actionId = item['ACTION ID'];
    let entity = item['DATA ENTITY'] ? item['DATA ENTITY'].toLowerCase() : '';
    // Map request to all workflow views
    if (entity === 'request' && actionId !== 'add_request' && actionId !== 'edit_request' && actionId !== 'delete_request') {
      entity = 'my_request,my_task,my_team,my_approval,request';
    }
    const who = item['Who can do this action ?'];
    
    // Parse 'who' into dynamic roles or specific roles.
    let roles = [];
    let exceptions = [];
    
    if (who) {
      if (who.includes('POLICY LEAD')) roles.push('[POLICY LEAD]');
      if (who.includes('SR OWNER') || who.includes('sr_owner')) roles.push('[sr_owner]');
      if (who.includes('SR CREATER') || who.includes('NGƯỜI TẠO') || who.includes('sr_creater')) roles.push('[sr_creater]');
      if (who.includes('REQUESTER') || who.includes('NGƯỜI YÊU CẦU') || who.includes('requester')) roles.push('[requester]');
      if (who.includes('TIER 1 APPROVER') || who.includes('PHÊ DUYỆT CẤP 1') || who.includes('tier_1_approval')) roles.push('[tier_1_approval]');
      if (who.includes('TIER 2 APPROVER') || who.includes('tier_2_approval')) roles.push('[tier_2_approval]');
      if (who.includes('TIER 3 APPROVER') || who.includes('tier_3_approval')) roles.push('[tier_3_approval]');
    }
    const displayName = item['ACTION'] ? item['ACTION'].trim() : '';
    const description = item['DESCRIPTION'] || '';
    
    try {
      await pool.query(
        `INSERT INTO action_rules (action_id, view_name, description, roles, exceptions, display_name) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (action_id) 
         DO UPDATE SET 
           description = EXCLUDED.description, 
           display_name = EXCLUDED.display_name,
           roles = COALESCE(action_rules.roles, EXCLUDED.roles)`,
        [actionId, entity, description, roles.length > 0 ? roles.join(',') : null, exceptions.length > 0 ? exceptions.join(',') : null, displayName]
      );
      console.log('Upserted', actionId);
    } catch (err) {
      console.log('Error for', actionId, err.message);
    }
  }
  pool.end();
}
seed();
