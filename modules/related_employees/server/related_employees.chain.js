/**
 * Related Employees Extension - Request chain resolver
 *
 *   request -> opportunity -> contract (service contract) -> service delivery contract -> service task request
 *
 * Visibility rules (applied identically to list and detail endpoints, via related_employees):
 *   - a record's related people = its own people + the people of ALL its ANCESTORS + the people of ALL its DESCENDANTS
 *   - everybody related to the request is related to every record created under it
 * Consequences:
 *   - whoever can see a parent can see all of its children (ancestor people flow down)
 *   - whoever can see a child can see its parents (descendant people flow up)
 *   - siblings are NOT merged into each other, so chains never grow transitively across unrelated records.
 */

const clean = (arr) => [...new Set([...arr].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(v => String(v)))];

async function rows(client, sql, params) {
  try { return (await client.query(sql, params)).rows; } catch (e) { return []; }
}

const getOppos = ({ client, projectIds = [], requestIds = [] }) => {
  const p = clean(projectIds), r = clean(requestIds);
  if (!p.length && !r.length) return [];
  return rows(client,
    `SELECT project_id, id__request, sale_lead, sale_team FROM "oppotunity"
     WHERE deleted_at IS NULL AND (project_id = ANY($1::text[]) OR id__request = ANY($2::text[]))`, [p, r]);
};

const getContracts = ({ client, projectIds = [], requestIds = [], contractIds = [] }) => {
  const p = clean(projectIds), r = clean(requestIds), c = clean(contractIds);
  if (!p.length && !r.length && !c.length) return [];
  return rows(client,
    `SELECT contract_id, request, id__request, project, contract_owner, sc_coordinator__employee FROM "contract"
     WHERE deleted_at IS NULL AND (project = ANY($1::text[]) OR request = ANY($2::text[]) OR id__request = ANY($2::text[]) OR contract_id = ANY($3::text[]))`,
    [p, r, c]);
};

const getSdcs = ({ client, projectIds = [], requestIds = [], contractIds = [], sdcIds = [] }) => {
  const p = clean(projectIds), r = clean(requestIds), c = clean(contractIds), s = clean(sdcIds);
  if (!p.length && !r.length && !c.length && !s.length) return [];
  return rows(client,
    `SELECT id, id__contract, id__service_request, project, coordinator__employee, created_by FROM "service_delivery_contract"
     WHERE deleted_at IS NULL AND (project = ANY($1::text[]) OR id__service_request = ANY($2::text[]) OR id__contract = ANY($3::text[]) OR id = ANY($4::text[]))`,
    [p, r, c, s]);
};

const getStrs = ({ client, sdcIds = [] }) => {
  const s = clean(sdcIds);
  if (!s.length) return [];
  return rows(client,
    `SELECT id, service_delivery, tier1_engineer__employee, service_coordinator__employee, created_by FROM "service_task_request"
     WHERE deleted_at IS NULL AND service_delivery = ANY($1::text[])`, [s]);
};

/**
 * Collect the ancestors and descendants of a record.
 * @param {string} table oppotunity | contract | service_delivery_contract | service_task_request
 * @returns {{oppos:object[], contracts:object[], sdcs:object[], strs:object[], requestIds:string[]}}
 */
async function collectRelations(client, table, rec) {
  const out = { oppos: [], contracts: [], sdcs: [], strs: [], requestIds: [] };
  if (!client || !rec) return out;
  const reqIds = new Set();
  const ctx = { client };
  const t = String(table).toLowerCase();

  if (t === 'oppotunity' || t === 'opportunity' || t === 'oppo') {
    if (rec.id__request) reqIds.add(String(rec.id__request));
    out.contracts = await getContracts({ ...ctx, projectIds: [rec.project_id], requestIds: [rec.id__request] });
    out.sdcs = await getSdcs({
      ...ctx, projectIds: [rec.project_id], requestIds: [rec.id__request],
      contractIds: out.contracts.map(c => c.contract_id)
    });
    out.strs = await getStrs({ ...ctx, sdcIds: out.sdcs.map(d => d.id) });
  } else if (t === 'contract' || t === 'service_contract') {
    const reqOf = rec.request || rec.id__request;
    if (reqOf) reqIds.add(String(reqOf));
    out.oppos = await getOppos({ ...ctx, projectIds: [rec.project], requestIds: [rec.request, rec.id__request] });
    out.sdcs = await getSdcs({ ...ctx, contractIds: [rec.contract_id] });
    out.strs = await getStrs({ ...ctx, sdcIds: out.sdcs.map(d => d.id) });
  } else if (t === 'service_delivery_contract') {
    if (rec.id__service_request) reqIds.add(String(rec.id__service_request));
    out.contracts = await getContracts({ ...ctx, contractIds: [rec.id__contract] });
    out.oppos = await getOppos({
      ...ctx,
      projectIds: [rec.project, ...out.contracts.map(c => c.project)],
      requestIds: [rec.id__service_request, ...out.contracts.flatMap(c => [c.request, c.id__request])]
    });
    out.strs = await getStrs({ ...ctx, sdcIds: [rec.id] });
  } else if (t === 'service_task_request') {
    out.sdcs = await getSdcs({ ...ctx, sdcIds: [rec.service_delivery] });
    out.contracts = await getContracts({ ...ctx, contractIds: out.sdcs.map(d => d.id__contract) });
    out.oppos = await getOppos({
      ...ctx,
      projectIds: [...out.sdcs.map(d => d.project), ...out.contracts.map(c => c.project)],
      requestIds: [...out.sdcs.map(d => d.id__service_request), ...out.contracts.flatMap(c => [c.request, c.id__request])]
    });
  }

  out.oppos.forEach(o => o.id__request && reqIds.add(String(o.id__request)));
  out.contracts.forEach(c => { if (c.request) reqIds.add(String(c.request)); if (c.id__request) reqIds.add(String(c.id__request)); });
  out.sdcs.forEach(d => d.id__service_request && reqIds.add(String(d.id__service_request)));
  out.requestIds = clean(reqIds);
  return out;
}

const canon = (t) => {
  const n = String(t || '').toLowerCase().trim();
  if (n === 'opportunity' || n === 'oppo') return 'oppotunity';
  if (n === 'service_contract') return 'contract';
  return n;
};

// The employees stored in the record itself
function ownPeople(table, r) {
  switch (canon(table)) {
    case 'oppotunity': return [r.sale_lead, r.sale_team];
    case 'contract': return [r.contract_owner, r.sc_coordinator__employee];
    case 'service_delivery_contract': return [r.coordinator__employee, r.created_by];
    case 'service_task_request': return [r.tier1_engineer__employee, r.service_coordinator__employee, r.created_by];
    default: return [];
  }
}

// People of a collectRelations() result
function relationPeople(rel) {
  const people = [];
  rel.oppos.forEach(o => people.push(...ownPeople('oppotunity', o)));
  rel.contracts.forEach(c => people.push(...ownPeople('contract', c)));
  rel.sdcs.forEach(d => people.push(...ownPeople('service_delivery_contract', d)));
  rel.strs.forEach(x => people.push(...ownPeople('service_task_request', x)));
  return people;
}

/**
 * Top records of the tree a record belongs to:
 * the opportunity(ies) above it, otherwise the highest contract / SDC above it, otherwise the record itself.
 */
function rootsOf(table, rec, rel) {
  const t = canon(table);
  if (t === 'oppotunity') return [{ table: 'oppotunity', row: rec }];
  if (rel.oppos.length) return rel.oppos.map(row => ({ table: 'oppotunity', row }));
  if (t === 'contract') return [{ table: 'contract', row: rec }];
  if (t === 'service_delivery_contract') {
    return rel.contracts.length ? rel.contracts.map(row => ({ table: 'contract', row })) : [{ table: t, row: rec }];
  }
  if (t === 'service_task_request') {
    if (rel.contracts.length) return rel.contracts.map(row => ({ table: 'contract', row }));
    if (rel.sdcs.length) return rel.sdcs.map(row => ({ table: 'service_delivery_contract', row }));
    return [{ table: t, row: rec }];
  }
  return [{ table: t, row: rec }];
}

async function requestPeople(client, requestIds) {
  const ids = clean(requestIds);
  if (!ids.length) return [];
  const people = [];
  for (const r of await rows(client,
    `SELECT requester, sr_creater, policy_lead, sr_owner, related_employees FROM "request" WHERE request_id = ANY($1::text[])`, [ids])) {
    people.push(r.requester, r.sr_creater, r.policy_lead, r.sr_owner, r.related_employees);
  }
  return people;
}

/**
 * People (raw ids) that must be related to a record:
 *   everybody in the whole tree below its top record(s) (so that anyone who sees a parent sees ALL of its
 *   children, and anyone who sees a child sees its parents) + everyone related to the linked request(s).
 * The record's own people are added by the table config `sources`.
 * Trees stay separate: siblings of different opportunities are never merged.
 */
async function resolveChain(client, table, rec) {
  const rel = await collectRelations(client, table, rec);
  const people = [...relationPeople(rel)];
  const requestIds = [...rel.requestIds];
  for (const root of rootsOf(table, rec, rel)) {
    const rrel = await collectRelations(client, root.table, root.row);
    people.push(...ownPeople(root.table, root.row), ...relationPeople(rrel));
    requestIds.push(...rrel.requestIds);
    const rq = root.row.id__request || root.row.request || root.row.id__service_request;
    if (rq) requestIds.push(rq);
  }
  people.push(...await requestPeople(client, requestIds));
  return { people: people.filter(Boolean), relations: rel };
}

module.exports = { resolveChain, collectRelations, rootsOf, getOppos, getContracts, getSdcs, getStrs };
