require('dotenv').config();
const pool = require('../../server/db');

function cleanElements(elementsStr) {
  if (!elementsStr) return elementsStr;
  let hasOuterBrackets = elementsStr.startsWith('[') && elementsStr.endsWith(']') && !elementsStr.slice(1, -1).includes(']');
  let items = [];
  if (hasOuterBrackets) {
    const inner = elementsStr.slice(1, -1);
    items = inner.split(',').map(s => s.trim());
    items = items.filter(x => {
      const u = x.toUpperCase();
      return u !== 'PAYMENT' && u !== 'INVOICE';
    });
    return '[' + items.join(',') + ']';
  } else {
    items = elementsStr.split(',').map(s => s.trim());
    items = items.filter(x => {
      const clean = x.replace(/[\[\]]/g, '').toUpperCase();
      return clean !== 'PAYMENT' && clean !== 'INVOICE';
    });
    return items.join(', ');
  }
}

console.log('Querying policy_and_program...');
pool.query("SELECT policy_id, policy_name, elements FROM policy_and_program WHERE elements ILIKE '%CONTRACT%'", (err, polRes) => {
  if (err) {
    console.error('Pol query err:', err);
    pool.end();
    return;
  }
  
  let updates = [];
  for (const row of polRes.rows) {
    const oldVal = row.elements;
    const newVal = cleanElements(oldVal);
    if (oldVal !== newVal) {
      updates.push({
        query: "UPDATE policy_and_program SET elements = $1 WHERE policy_id = $2",
        params: [newVal, row.policy_id],
        log: `Updated Policy ${row.policy_id} (${row.policy_name}): ${oldVal} -> ${newVal}`
      });
    }
  }
  
  console.log('Querying request...');
  pool.query("SELECT request_id, elements FROM request WHERE 'CONTRACT' = ANY(elements) OR 'Contract' = ANY(elements) OR '[CONTRACT]' = ANY(elements)", (err, reqRes) => {
    if (err) {
      console.error('Req query err:', err);
      pool.end();
      return;
    }
    
    for (const row of reqRes.rows) {
      if (Array.isArray(row.elements)) {
        const oldVal = [...row.elements];
        const newVal = row.elements.filter(x => {
          const u = String(x).replace(/[\[\]]/g, '').toUpperCase();
          return u !== 'PAYMENT' && u !== 'INVOICE';
        });
        if (oldVal.length !== newVal.length) {
          updates.push({
            query: "UPDATE request SET elements = $1 WHERE request_id = $2",
            params: [newVal, row.request_id],
            log: `Updated Request ${row.request_id}: [${oldVal.join(', ')}] -> [${newVal.join(', ')}]`
          });
        }
      }
    }
    
    console.log(`Planned ${updates.length} updates. Executing...`);
    
    function runNext(idx) {
      if (idx >= updates.length) {
        console.log('Cleanup completed successfully!');
        // Delay ending pool by 3 seconds to let auto-migrations finish cleanly
        setTimeout(() => pool.end(), 3000);
        return;
      }
      const item = updates[idx];
      pool.query(item.query, item.params, (err) => {
        if (err) console.error('Update err:', err);
        else console.log(item.log);
        runNext(idx + 1);
      });
    }
    
    runNext(0);
  });
});
