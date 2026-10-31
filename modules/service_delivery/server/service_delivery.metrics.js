/**
 * service_delivery.metrics.js - Dashboard metrics (Payment ratio / Progress / Remaining time)
 * for the Service Delivery extension.
 *
 * The module plugs into the generic "list extension" seam of server/core/tableRegistry.js:
 * the core list query is wrapped with extra computed (virtual) columns, so the columns are
 * available for display AND server-side sorting without touching table structures.
 *
 * Calculation rules (see docs in the PR / README of the module):
 *
 *  PAYMENT RATIO  (paid value / total value, in base currency)
 *    - Opportunity            : summary of all payments of the opportunity (Selling + Buying)
 *    - Service Delivery Contr.: opportunity summary (inherited)
 *    - Service Task Request   : opportunity summary (inherited through its contract)
 *    - Contract               : ONLY the payments of that contract (Selling or Buying by contract type)
 *
 *  PROGRESS  (% of tasks by status)
 *    - Service Delivery Contr.: tasks of that contract
 *    - Service Task Request   : tasks of its parent contract
 *    - Opportunity / Contract : average of the progress of every Service Delivery Contract of the
 *                               opportunity (contracts without task are ignored)
 *
 *  REMAINING TIME  (start_date / end_date of Service Delivery Contract)
 *    - Service Delivery Contr. / Task : dates of the (parent) contract
 *    - Opportunity / Contract         : earliest start - latest end of the opportunity's contracts
 *
 * Added columns:
 *   oppo_pay_sell_total / oppo_pay_sell_paid / oppo_pay_buy_total / oppo_pay_buy_paid
 *   oppo_prog_completed / oppo_prog_processing / oppo_prog_not_started (percent), oppo_prog_sdc_count, oppo_prog_task_count
 *   oppo_start_date / oppo_end_date (YYYY-MM-DD text)
 *   oppo_payment_ratio (%), oppo_progress (% completed), oppo_remaining_time (days left)  -> sortable scalars
 */

const METRIC_TABLES = ['oppotunity', 'contract', 'service_delivery_contract', 'service_task_request'];
const SORTABLE_COLUMNS = [
  'oppo_payment_ratio', 'oppo_progress', 'oppo_remaining_time', 'oppo_task_count', 'sc_sd_count',
  'oppo_end_user', 'oppo_country', 'eff_start_date', 'eff_end_date', 'eff_coordinator',
  'oppo_fin_sell_wo_vat', 'oppo_fin_buy_wo_vat', 'oppo_fin_gm_wo_vat', 'oppo_fin_sell', 'oppo_fin_buy',
  'oppo_fin_gm', 'oppo_fin_paid_sell', 'oppo_fin_paid_buy', 'oppo_fin_paid_gm'
];

// Same business keys used by the finance module (status_catalog values).
const PAYMENT_TYPE_INCOMING = 60;
const PAYMENT_TYPE_OUTGOING = 61;
const CONTRACT_TYPE_SELLING = 69;
const CONTRACT_TYPE_BUYING = 70;
const PAYMENT_STATUS_PAID = 32;

/** SQL expression: opportunity project_id of the current row (table alias == table name). */
function projectKeyExpr(t) {
  const byRequest = (reqExpr) =>
    `(SELECT o2.project_id FROM "oppotunity" o2 WHERE o2.id__request IS NOT NULL AND o2.id__request = ${reqExpr} AND o2.deleted_at IS NULL LIMIT 1)`;
  switch (t) {
    case 'oppotunity':
      return `"oppotunity".project_id`;
    case 'contract':
      return `COALESCE(NULLIF("contract".project, ''), ${byRequest(`COALESCE("contract".request, "contract".id__request)`)})`;
    case 'service_delivery_contract':
      return `COALESCE(NULLIF("service_delivery_contract".project, ''), ${byRequest(`"service_delivery_contract".id__service_request`)})`;
    case 'service_task_request':
      return `(SELECT COALESCE(NULLIF(d0.project, ''), ${byRequest('d0.id__service_request')})
               FROM "service_delivery_contract" d0
               WHERE d0.id = "service_task_request".service_delivery LIMIT 1)`;
    default:
      return 'NULL';
  }
}

/** SQL expression: Service Delivery Contract id of the current row (NULL for oppotunity / contract). */
function sdcKeyExpr(t) {
  if (t === 'service_delivery_contract') return `"service_delivery_contract".id`;
  if (t === 'service_task_request') return `"service_task_request".service_delivery`;
  return 'NULL';
}

/** SQL expression (text): contract_id the current row is linked to (NULL for oppotunity). */
function contractKeyExpr(t) {
  if (t === 'contract') return `"contract".contract_id::text`;
  if (t === 'service_delivery_contract') return `"service_delivery_contract".id__contract::text`;
  if (t === 'service_task_request') {
    return `(SELECT d1.id__contract::text FROM "service_delivery_contract" d1 WHERE d1.id = "service_task_request".service_delivery LIMIT 1)`;
  }
  return 'NULL';
}

/**
 * Wrap the base list query of `tableName` with the metric columns.
 * @param {string} tableName
 * @param {string} baseTableOrCTE  FROM-item already aliased as "tableName"
 * @returns {string}
 */
function wrapWithMetrics(tableName, baseTableOrCTE) {
  if (!METRIC_TABLES.includes(tableName)) return baseTableOrCTE;

  const isContractView = tableName === 'contract';
  const isSdcScoped = tableName === 'service_delivery_contract' || tableName === 'service_task_request';


  const isOppo = tableName === 'oppotunity';
  const isStr = tableName === 'service_task_request';

  // ---- payments (indexed on payment.project and payment.request) --------------------------
  const amount = `COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0)`;
  const isPaid = `(p.payment_status = ${PAYMENT_STATUS_PAID} OR LOWER(p.payment_status::text) = 'paid')`;
  const sellCond = isContractView
    ? `("contract".type = ${CONTRACT_TYPE_SELLING} OR p.payment_type = ${PAYMENT_TYPE_INCOMING})`
    : `(c.type = ${CONTRACT_TYPE_SELLING} OR p.payment_type = ${PAYMENT_TYPE_INCOMING})`;
  const buyCond = isContractView
    ? `("contract".type = ${CONTRACT_TYPE_BUYING} OR p.payment_type = ${PAYMENT_TYPE_OUTGOING})`
    : `(c.type = ${CONTRACT_TYPE_BUYING} OR p.payment_type = ${PAYMENT_TYPE_OUTGOING})`;

  const paymentScope = isContractView
    ? `FROM "payment" p
       WHERE p.deleted_at IS NULL AND p.contract_id = "contract".contract_id`
    : `FROM "payment" p
       LEFT JOIN "contract" c ON p.contract_id = c.contract_id AND c.deleted_at IS NULL
       WHERE p.deleted_at IS NULL AND op.project_id IS NOT NULL
         AND (p.project = op.project_id OR (op.rid IS NOT NULL AND p.request = op.rid))`;

  // ---- tasks (direct status codes without repeated catalog scan) --------------------------
  const canceled = `s.status::text IN ('canceled', 'cancelled', '9')`;
  const completed = `s.status::text IN ('completed', 'closed', '4', '5')`;
  const notStarted = `s.status::text IN ('not_started_yet', 'not_started', '1')`;

  const sdcScope = isSdcScoped
    ? `d.id = k.sdc_id`
    : (isContractView
      ? `d.id__contract::text = k.contract_id`
      : `op.project_id IS NOT NULL AND (d.project = op.project_id OR (op.rid IS NOT NULL AND d.id__service_request = op.rid))`);

  // Contract the row belongs to (for END USER): the row itself in the contract view.
  const ctExpr = isContractView
    ? `(SELECT "contract".contractor::text AS contractor, "contract".type AS type)`
    : `(SELECT cc.contractor::text AS contractor, cc.type AS type FROM "contract" cc WHERE cc.contract_id::text = k.contract_id AND cc.deleted_at IS NULL LIMIT 1)`;

  const finSelect = isOppo ? `,
      COALESCE(fc.sell_wo, 0) AS oppo_fin_sell_wo_vat,
      COALESCE(fc.buy_wo, 0) AS oppo_fin_buy_wo_vat,
      COALESCE(fc.sell_wo, 0) - COALESCE(fc.buy_wo, 0) AS oppo_fin_gm_wo_vat,
      COALESCE(fc.sell_tot, 0) AS oppo_fin_sell,
      COALESCE(fc.buy_tot, 0) AS oppo_fin_buy,
      COALESCE(fc.sell_tot, 0) - COALESCE(fc.buy_tot, 0) AS oppo_fin_gm,
      COALESCE(pm.sell_paid, 0) AS oppo_fin_paid_sell,
      COALESCE(pm.buy_paid, 0) AS oppo_fin_paid_buy,
      COALESCE(pm.sell_paid, 0) - COALESCE(pm.buy_paid, 0) AS oppo_fin_paid_gm` : '';

  const finJoin = isOppo ? `
    LEFT JOIN LATERAL (
      SELECT
        SUM(CASE WHEN c.type = ${CONTRACT_TYPE_SELLING} THEN COALESCE(c.total_value_in_base_currency, 0) END) AS sell_tot,
        SUM(CASE WHEN c.type = ${CONTRACT_TYPE_BUYING} THEN COALESCE(c.total_value_in_base_currency, 0) END) AS buy_tot,
        SUM(CASE WHEN c.type = ${CONTRACT_TYPE_SELLING} THEN COALESCE(c.value_before_vat_in_base_currency, 0) END) AS sell_wo,
        SUM(CASE WHEN c.type = ${CONTRACT_TYPE_BUYING} THEN COALESCE(c.value_before_vat_in_base_currency, 0) END) AS buy_wo
      FROM "contract" c
      WHERE c.deleted_at IS NULL AND op.project_id IS NOT NULL
        AND (c.project = op.project_id OR (op.rid IS NOT NULL AND (c.request = op.rid OR c.id__request = op.rid)))
    ) fc ON true` : '';

  const strSelect = isStr ? `,
      COALESCE(to_char("service_task_request".started_date::date, 'YYYY-MM-DD'), to_char(sx.start_date, 'YYYY-MM-DD')) AS eff_start_date,
      COALESCE(to_char("service_task_request".end_date::date, 'YYYY-MM-DD'), to_char(sx.end_date, 'YYYY-MM-DD')) AS eff_end_date,
      COALESCE(NULLIF("service_task_request".service_coordinator__employee::text, ''), sx.coordinator::text) AS eff_coordinator,
      sx.service_scope AS sd_service_scope,
      COALESCE(sx.service_scope, sx.sd_old_id, "service_task_request".service_delivery::text) AS service_delivery_label` : '';

  const strJoin = isStr ? `
    LEFT JOIN LATERAL (
      SELECT d.start_date, d.end_date, d.coordinator__employee AS coordinator, d.service_scope, d.sd_old_id
      FROM "service_delivery_contract" d WHERE d.id = "service_task_request".service_delivery LIMIT 1
    ) sx ON true` : '';

  const countSelect = tableName === 'service_delivery_contract'
    ? `,
      (SELECT COUNT(*) FROM "service_task_request" s2 WHERE s2.service_delivery = "service_delivery_contract".id AND s2.deleted_at IS NULL) AS oppo_task_count`
    : (isContractView
      ? `,
      (SELECT COUNT(*) FROM "service_delivery_contract" d2 WHERE d2.id__contract::text = "contract".contract_id::text AND d2.deleted_at IS NULL) AS sc_sd_count`
      : '');

  const startExpr = isContractView ? `COALESCE("contract".sc_start_date, sd.start_date)` : 'sd.start_date';
  const endExpr = isContractView ? `COALESCE("contract".sc_end_date, sd.end_date)` : 'sd.end_date';

  const opLateral = isOppo
    ? `(SELECT "${tableName}".project_id AS project_id, "${tableName}".id__request AS rid, "${tableName}".id__company::text AS company_id)`
    : `(SELECT o.project_id, o.id__request AS rid, o.id__company::text AS company_id FROM "oppotunity" o
        WHERE k.pid IS NOT NULL AND o.project_id = k.pid AND o.deleted_at IS NULL LIMIT 1)`;

  // ---- payment ratio scope: paid payments vs CONTRACT VALUE of the related contract(s) -----
  //  contract view      : the contract itself
  //  SDC / STR          : the contract linked to the SDC (id__contract); when none, the contracts of its opportunity
  //  opportunity        : every contract of the opportunity + contracts referenced by its SDCs
  const rcScope = isContractView
    ? `cc.contract_id::text = "contract".contract_id::text`
    : `((k.contract_id IS NOT NULL AND cc.contract_id::text = k.contract_id)
        OR (k.contract_id IS NULL AND op.project_id IS NOT NULL AND (
              cc.project = op.project_id
              OR (op.rid IS NOT NULL AND (cc.request = op.rid OR cc.id__request = op.rid))
              OR cc.contract_id::text IN (SELECT dd.id__contract::text FROM "service_delivery_contract" dd
                                          WHERE dd.project = op.project_id AND dd.id__contract IS NOT NULL AND dd.deleted_at IS NULL))))`;
  const rcJoin = `
    LEFT JOIN LATERAL (
      SELECT
        SUM(CASE WHEN x.ctype = ${CONTRACT_TYPE_SELLING} THEN x.tv ELSE 0 END) AS sell_total,
        SUM(CASE WHEN x.ctype = ${CONTRACT_TYPE_SELLING} THEN LEAST(x.paid, x.tv) ELSE 0 END) AS sell_paid,
        SUM(CASE WHEN x.ctype = ${CONTRACT_TYPE_BUYING} THEN x.tv ELSE 0 END) AS buy_total,
        SUM(CASE WHEN x.ctype = ${CONTRACT_TYPE_BUYING} THEN LEAST(x.paid, x.tv) ELSE 0 END) AS buy_paid
      FROM (
        SELECT cc.type AS ctype,
          COALESCE(cc.total_value_in_base_currency, 0) AS tv,
          COALESCE((SELECT SUM(${amount}) FROM "payment" p
                    WHERE p.deleted_at IS NULL AND p.contract_id = cc.contract_id AND ${isPaid}), 0) AS paid
        FROM "contract" cc
        WHERE cc.deleted_at IS NULL AND COALESCE(cc.total_value_in_base_currency, 0) > 0 AND ${rcScope}
      ) x
    ) rc ON true`;

  return `(
    SELECT "${tableName}".*,
      COALESCE(rc.sell_total, 0) AS oppo_pay_sell_total,
      COALESCE(rc.sell_paid, 0) AS oppo_pay_sell_paid,
      COALESCE(rc.buy_total, 0) AS oppo_pay_buy_total,
      COALESCE(rc.buy_paid, 0) AS oppo_pay_buy_paid,
      ROUND(tk.pc, 2) AS oppo_prog_completed,
      ROUND(tk.pp, 2) AS oppo_prog_processing,
      ROUND(tk.pn, 2) AS oppo_prog_not_started,
      COALESCE(tk.sdc_n, 0) AS oppo_prog_sdc_count,
      COALESCE(tk.tasks, 0) AS oppo_prog_task_count,
      to_char(${startExpr}, 'YYYY-MM-DD') AS oppo_start_date,
      to_char(${endExpr}, 'YYYY-MM-DD') AS oppo_end_date,
      ROUND(100.0 * (COALESCE(rc.sell_paid, 0) + COALESCE(rc.buy_paid, 0))
            / NULLIF(COALESCE(rc.sell_total, 0) + COALESCE(rc.buy_total, 0), 0), 2) AS oppo_payment_ratio,
      ROUND(tk.pc, 2) AS oppo_progress,
      (${endExpr} - CURRENT_DATE + 1) AS oppo_remaining_time,
      eu.company_id AS oppo_end_user,
      eu.country AS oppo_country${countSelect}${strSelect}${finSelect}
    FROM ${baseTableOrCTE}
    LEFT JOIN LATERAL (SELECT ${projectKeyExpr(tableName)} AS pid, ${sdcKeyExpr(tableName)} AS sdc_id, ${contractKeyExpr(tableName)} AS contract_id) k ON true
    LEFT JOIN LATERAL ${opLateral} op ON true
    LEFT JOIN LATERAL ${ctExpr} ct ON true
    LEFT JOIN LATERAL (
      SELECT co.company_id::text AS company_id, co.country::text AS country FROM "company" co
      WHERE co.company_id::text = COALESCE(CASE WHEN ct.type = ${CONTRACT_TYPE_SELLING} THEN NULLIF(ct.contractor, '') END, op.company_id)
        AND co.deleted_at IS NULL LIMIT 1
    ) eu ON true${strJoin}${finJoin}${rcJoin}
    LEFT JOIN LATERAL (
      SELECT
        SUM(CASE WHEN ${sellCond} THEN ${amount} ELSE 0 END) AS sell_total,
        SUM(CASE WHEN ${sellCond} AND ${isPaid} THEN ${amount} ELSE 0 END) AS sell_paid,
        SUM(CASE WHEN ${buyCond} THEN ${amount} ELSE 0 END) AS buy_total,
        SUM(CASE WHEN ${buyCond} AND ${isPaid} THEN ${amount} ELSE 0 END) AS buy_paid
      ${paymentScope}
    ) pm ON true
    LEFT JOIN LATERAL (
      SELECT
        AVG(100.0 * x.completed / NULLIF(x.total, 0)) AS pc,
        AVG(100.0 * x.processing / NULLIF(x.total, 0)) AS pp,
        AVG(100.0 * x.not_started / NULLIF(x.total, 0)) AS pn,
        COUNT(*) AS sdc_n,
        SUM(x.total) AS tasks
      FROM (
        SELECT d.id,
          COUNT(*) FILTER (WHERE NOT (${canceled})) AS total,
          COUNT(*) FILTER (WHERE ${completed}) AS completed,
          COUNT(*) FILTER (WHERE NOT (${canceled}) AND NOT (${completed}) AND NOT (${notStarted})) AS processing,
          COUNT(*) FILTER (WHERE ${notStarted}) AS not_started
        FROM "service_task_request" s
        JOIN "service_delivery_contract" d ON d.id = s.service_delivery AND d.deleted_at IS NULL
        WHERE s.deleted_at IS NULL AND (${sdcScope})
        GROUP BY d.id
      ) x WHERE x.total > 0
    ) tk ON true
    LEFT JOIN LATERAL (
      SELECT MIN(d.start_date) AS start_date, MAX(d.end_date) AS end_date
      FROM "service_delivery_contract" d
      WHERE d.deleted_at IS NULL AND (${sdcScope})
    ) sd ON true
  ) as "${tableName}"`;
}

/**
 * Plug the metrics into the core list query (generic seam of tableRegistry).
 * @param {object} tableRegistry
 */
function registerMetrics(tableRegistry) {
  tableRegistry.registerListExtension(METRIC_TABLES, {
    columns: SORTABLE_COLUMNS,
    wrap: wrapWithMetrics
  });
}

module.exports = { registerMetrics, wrapWithMetrics, METRIC_TABLES, SORTABLE_COLUMNS };
