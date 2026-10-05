/**
 * QA - write-path scenarios for scripts/qa/ab-compare.js (--writes).
 * Runs the SAME sequence of state-changing calls on BASE and CUR (each on its own copy of the
 * same DB snapshot) and records every difference in status/body and in the resulting record.
 *
 * Coverage is DATA-DRIVEN so no workflow knowledge is hard-coded:
 *   1. Requests sampled across (request_type, sr_status). For each, we act as every person tied to
 *      it (requester, creator, policy lead, owners, approvers) + the admin token.
 *   2. For each (request, person, view) we ask the API which actions are available and execute
 *      the first and last one, then re-read the request.
 *   3. Generic CRUD pipeline on the main tables: update-with-same-data, soft delete, restore, create.
 */
const VIEWS = ['my_request', 'my_approval', 'my_process_owner', 'my_team'];
const CRUD_TABLES = ['contact', 'company', 'department', 'payment', 'invoice', 'expense', 'contract', 'asset', 'service', 'target_table'];
const PK_CANDIDATES = ['request_id', 'payment_id', 'invoice_id', 'contract_id', 'contact_id', 'company_id', 'department_id', 'office_asset_id', 'service_id', 'target_table_id', 'id'];

function identitiesOf(r) {
  const ids = [r.requester, r.sr_creater, r.policy_lead];
  if (Array.isArray(r.sr_owner)) ids.push(...r.sr_owner); else if (r.sr_owner) ids.push(r.sr_owner);
  let flow = r.approval_flow;
  if (typeof flow === 'string') { try { flow = JSON.parse(flow); } catch { flow = null; } }
  if (flow && Array.isArray(flow.steps)) flow.steps.forEach((s) => s.approver && ids.push(s.approver));
  return [...new Set(ids.filter(Boolean).map((x) => String(x).trim()))].slice(0, 4);
}

module.exports = async function scenario({ pool, mint, both, log, maxRequests = Number(process.env.QA_MAX_REQUESTS || 30) }) {
  const admin = await mint(null);
  const sampled = (await pool.query(
    `SELECT DISTINCT ON (request_type, sr_status) request_id, requester, sr_creater, policy_lead, sr_owner, approval_flow
       FROM request WHERE deleted_at IS NULL ORDER BY request_type, sr_status, request_id LIMIT $1`, [maxRequests])).rows;
  log(`[writes] ${sampled.length} sampled requests`);

  const tokenCache = new Map();
  const tokenFor = async (identity) => {
    if (tokenCache.has(identity)) return tokenCache.get(identity);
    const t = await mint(identity);
    tokenCache.set(identity, t);
    return t;
  };

  for (const r of sampled) {
    const people = [null, ...identitiesOf(r)];
    for (const who of people) {
      const token = who ? await tokenFor(who) : admin;
      if (!token) continue;
      for (const view of VIEWS) {
        const list = await both(`actions ${r.request_id} ${who || 'admin'} ${view}`, token, 'GET', `/api/actions/request/${encodeURIComponent(r.request_id)}?view=${view}`);
        const actions = Array.isArray(list.a?.body) ? list.a.body.map((x) => x && x.action_id).filter(Boolean) : [];
        const pick = [...new Set([actions[0], actions[actions.length - 1]].filter(Boolean))];
        for (const action_id of pick) {
          await both(`execute ${action_id} on ${r.request_id} as ${who || 'admin'} (${view})`, token, 'POST', '/api/actions/execute',
            { action_id, table_name: 'request', record_id: r.request_id, view, data: {} });
          await both(`state ${r.request_id} after ${action_id}`, admin, 'GET', `/api/table/request/${encodeURIComponent(r.request_id)}`);
        }
      }
    }
  }

  for (const t of CRUD_TABLES) {
    const listed = await both(`list ${t}`, admin, 'GET', `/api/table/${t}?limit=3`);
    const row = listed.a?.body?.data?.[0];
    if (!row) { log(`[writes] ${t}: no rows, skipped`); continue; }
    const pk = PK_CANDIDATES.find((k) => row[k] !== undefined && row[k] !== null);
    if (!pk) { log(`[writes] ${t}: pk unknown, skipped`); continue; }
    const id = encodeURIComponent(row[pk]);
    const copy = { ...row }; delete copy[pk];
    await both(`PUT ${t}/${row[pk]}`, admin, 'PUT', `/api/table/${t}/${id}`, row);
    await both(`GET ${t}/${row[pk]} after PUT`, admin, 'GET', `/api/table/${t}/${id}`);
    await both(`DELETE ${t}/${row[pk]}`, admin, 'DELETE', `/api/table/${t}/${id}`);
    await both(`GET ${t}/${row[pk]} after DELETE`, admin, 'GET', `/api/table/${t}/${id}`);
    await both(`RESTORE ${t}/${row[pk]}`, admin, 'POST', `/api/table/${t}/${id}/restore`, {});
    await both(`POST ${t} (create copy)`, admin, 'POST', `/api/table/${t}`, copy);
    await both(`list ${t} after writes`, admin, 'GET', `/api/table/${t}?limit=5`);
  }
};
