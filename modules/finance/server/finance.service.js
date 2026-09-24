
const pool = require('../../../server/db');
const repo = require('./finance.repository');

function normalizeFinanceCurrency(curr) {
  if (!curr) return '';
  const s = String(curr).trim().toUpperCase();
  if (s === '1') return 'VND';
  if (s === '2') return 'USD';
  if (s === '3') return 'EUR';
  if (s === '4') return 'MMK';
  if (s === '5') return 'SGD';
  if (s === '6') return 'THB';
  if (/^\d+$/.test(s)) return 'VND';
  return s;
}

async function calculateRequestFinanceSummary(requestId, dbClient) {
  const client = dbClient || pool;
  if (!requestId) return null;

  // 1. Request Info
  const reqRes = await client.query(
    `SELECT r.request_id, r.request_type, r.sr_submitted_date, r.sr_created_date, r.deleted_at,
            p.policy_name, p.elements as policy_elements, r.elements as request_elements
     FROM request r
     LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text OR r.request_type = p.policy_name
     WHERE r.request_id = $1`,
    [requestId]
  );
  if (reqRes.rows.length === 0) return null;
  const reqRow = reqRes.rows[0];

  // 2. Contracts
  const conRes = await client.query(
    `SELECT contract_id, type, 
            COALESCE(value_before_vat, 0) as val_wo_vat,
            COALESCE(vat_value, 0) as vat_val,
            COALESCE(total_value, COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) as total_val,
            COALESCE(exchance_rate, 1.0) as rate, currency,
            value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
     FROM contract
     WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL`,
    [requestId]
  );

  const sellingConIds = [];
  const buyingConIds = [];

  let sellingContractCount = 0;
  let sellingTotalBase = 0;
  let sellingTotalOrig = 0;
  let vatSellingBase = 0;
  let vatSellingOrig = 0;
  let sellingWoVatBase = 0;
  let sellingWoVatOrig = 0;
  let sellingCurrencies = new Set();

  let buyingContractCount = 0;
  let buyingTotalBase = 0;
  let buyingTotalOrig = 0;
  let vatBuyingBase = 0;
  let vatBuyingOrig = 0;
  let buyingWoVatBase = 0;
  let buyingWoVatOrig = 0;
  let buyingCurrencies = new Set();

  for (const c of conRes.rows) {
    const rawType = String(c.type || '').trim().toLowerCase();
    const t = Number(c.type);
    const isSelling = t === 69 || rawType === '69' || rawType.includes('sell') || rawType.includes('bán');
    const isBuying = t === 70 || rawType === '70' || rawType.includes('buy') || rawType.includes('mua');

    const rate = parseFloat(c.rate) || 1.0;
    const curr = normalizeFinanceCurrency(c.currency);

    let valOrigVat = parseFloat(c.vat_val) || 0;
    let valOrigWoVat = parseFloat(c.val_wo_vat) || 0;
    let valOrigTotal = parseFloat(c.total_val) || 0;

    // WO VAT ALWAYS has value:
    // If valOrigWoVat is not set or 0, but total exists: WO VAT = total - VAT (or total if VAT is 0)
    if (valOrigWoVat === 0 && valOrigTotal > 0) {
      valOrigWoVat = Math.max(0, valOrigTotal - valOrigVat);
    }
    // If total is 0 or not set, but valOrigWoVat exists: total = WO VAT + VAT
    if (valOrigTotal === 0 && valOrigWoVat > 0) {
      valOrigTotal = valOrigWoVat + valOrigVat;
    }

    // Base currency values:
    let vatBase = c.vat_value_in_base_currency != null && c.vat_value_in_base_currency !== ''
      ? parseFloat(c.vat_value_in_base_currency)
      : (valOrigVat * rate);
    let woVatBase = c.value_before_vat_in_base_currency != null && c.value_before_vat_in_base_currency !== ''
      ? parseFloat(c.value_before_vat_in_base_currency)
      : (valOrigWoVat * rate);
    let totBase = c.total_value_in_base_currency != null && c.total_value_in_base_currency !== ''
      ? parseFloat(c.total_value_in_base_currency)
      : (valOrigTotal * rate);

    if (woVatBase === 0 && totBase > 0) {
      woVatBase = Math.max(0, totBase - vatBase);
    }
    if (totBase === 0 && woVatBase > 0) {
      totBase = woVatBase + vatBase;
    }

    if (isSelling) {
      sellingContractCount++;
      if (c.contract_id) sellingConIds.push(c.contract_id);
      sellingTotalBase += totBase;
      sellingTotalOrig += valOrigTotal;
      vatSellingBase += vatBase;
      vatSellingOrig += valOrigVat;
      sellingWoVatBase += woVatBase;
      sellingWoVatOrig += valOrigWoVat;
      if (curr) sellingCurrencies.add(curr);
    } else if (isBuying) {
      buyingContractCount++;
      if (c.contract_id) buyingConIds.push(c.contract_id);
      buyingTotalBase += totBase;
      buyingTotalOrig += valOrigTotal;
      vatBuyingBase += vatBase;
      vatBuyingOrig += valOrigVat;
      buyingWoVatBase += woVatBase;
      buyingWoVatOrig += valOrigWoVat;
      if (curr) buyingCurrencies.add(curr);
    }
  }
  const allConIds = [...sellingConIds, ...buyingConIds];

  // 3. Payments
  let payRes;
  if (allConIds.length > 0) {
    payRes = await client.query(
      `SELECT payment_id, contract_id, payment_type, payment_status, due_date, payment_date,
              COALESCE(value, 0) as val, COALESCE(exchange_rate, 1.0) as rate, currency,
              value_in_base_currency
       FROM payment
       WHERE (request = $1 OR contract_id = ANY($2)) AND deleted_at IS NULL`,
      [requestId, allConIds]
    );
  } else {
    payRes = await client.query(
      `SELECT payment_id, contract_id, payment_type, payment_status, due_date, payment_date,
              COALESCE(value, 0) as val, COALESCE(exchange_rate, 1.0) as rate, currency,
              value_in_base_currency
       FROM payment
       WHERE request = $1 AND deleted_at IS NULL`,
      [requestId]
    );
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let incomingPmCount = 0;
  let incomingPaidCount = 0;
  let incomingNotDueYetCount = 0;
  let incomingPendingCount = 0;
  let incomingPaymentBase = 0;
  let incomingPaymentOrig = 0;
  let incomingPaymentPaidBase = 0;
  let incomingPaymentPaidOrig = 0;
  let incomingPmNotDueYetBase = 0;
  let incomingPmNotDueYetOrig = 0;
  let incomingPmPendingPmBase = 0;
  let incomingPmPendingPmOrig = 0;
  let incomingCurrencies = new Set();

  let outgoingPmCount = 0;
  let outgoingPaidCount = 0;
  let outgoingNotDueYetCount = 0;
  let outgoingPendingCount = 0;
  let outgoingPaymentBase = 0;
  let outgoingPaymentOrig = 0;
  let outgoingPaymentPaidBase = 0;
  let outgoingPaymentPaidOrig = 0;
  let outgoingPmNotDueYetBase = 0;
  let outgoingPmNotDueYetOrig = 0;
  let outgoingPmPendingPmBase = 0;
  let outgoingPmPendingPmOrig = 0;
  let outgoingCurrencies = new Set();

  for (const p of payRes.rows) {
    const pType = Number(p.payment_type);
    const pStatus = Number(p.payment_status);
    const isPaid = (pStatus === 32 || String(p.payment_status || '').toLowerCase() === 'paid');
    const rate = parseFloat(p.rate) || 1.0;
    const valOrig = parseFloat(p.val) || 0;
    const valBase = p.value_in_base_currency != null ? parseFloat(p.value_in_base_currency) : (valOrig * rate);
    const curr = normalizeFinanceCurrency(p.currency);

    const isIncoming = (p.contract_id && sellingConIds.includes(p.contract_id)) || pType === 60;
    const isOutgoing = (p.contract_id && buyingConIds.includes(p.contract_id)) || pType === 61;

    const dDateStr = p.due_date ? new Date(p.due_date).toISOString().split('T')[0] : '';
    const isNotDueYet = !isPaid && dDateStr && dDateStr > todayStr;

    if (isIncoming) {
      incomingPmCount++;
      incomingPaymentBase += valBase;
      incomingPaymentOrig += valOrig;
      if (curr) incomingCurrencies.add(curr);
      if (isPaid) {
        incomingPaidCount++;
        incomingPaymentPaidBase += valBase;
        incomingPaymentPaidOrig += valOrig;
      } else if (isNotDueYet) {
        incomingNotDueYetCount++;
        incomingPmNotDueYetBase += valBase;
        incomingPmNotDueYetOrig += valOrig;
      } else {
        incomingPendingCount++;
        incomingPmPendingPmBase += valBase;
        incomingPmPendingPmOrig += valOrig;
      }
    } else if (isOutgoing) {
      outgoingPmCount++;
      outgoingPaymentBase += valBase;
      outgoingPaymentOrig += valOrig;
      if (curr) outgoingCurrencies.add(curr);
      if (isPaid) {
        outgoingPaidCount++;
        outgoingPaymentPaidBase += valBase;
        outgoingPaymentPaidOrig += valOrig;
      } else if (isNotDueYet) {
        outgoingNotDueYetCount++;
        outgoingPmNotDueYetBase += valBase;
        outgoingPmNotDueYetOrig += valOrig;
      } else {
        outgoingPendingCount++;
        outgoingPmPendingPmBase += valBase;
        outgoingPmPendingPmOrig += valOrig;
      }
    }
  }

  // 4. Invoices
  let invRes;
  if (allConIds.length > 0) {
    invRes = await client.query(
      `SELECT invoice_id, contract_id, invoice_type, invoice_status,
              COALESCE(value_before_vat, 0) as val_wo_vat,
              COALESCE(NULLIF(regexp_replace(COALESCE(vat_value, '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) as vat_val,
              COALESCE(total_value, 0) as total_val,
              COALESCE(exchange_rate, 1) as rate, currency,
              value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
       FROM invoice
       WHERE (request = $1 OR contract_id = ANY($2)) AND deleted_at IS NULL`,
      [requestId, allConIds]
    );
  } else {
    invRes = await client.query(
      `SELECT invoice_id, contract_id, invoice_type, invoice_status,
              COALESCE(value_before_vat, 0) as val_wo_vat,
              COALESCE(NULLIF(regexp_replace(COALESCE(vat_value, '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) as vat_val,
              COALESCE(total_value, 0) as total_val,
              COALESCE(exchange_rate, 1) as rate, currency,
              value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
       FROM invoice
       WHERE request = $1 AND deleted_at IS NULL`,
      [requestId]
    );
  }

  let sellingInvoiceCount = 0;
  let sellingInvoiceTotalBase = 0;
  let sellingInvoiceTotalOrig = 0;
  let sellingInvoiceCurrencies = new Set();

  let buyingInvoiceCount = 0;
  let buyingInvoiceTotalBase = 0;
  let buyingInvoiceTotalOrig = 0;
  let buyingInvoiceCurrencies = new Set();

  for (const inv of invRes.rows) {
    const rate = parseFloat(inv.rate) || 1.0;
    let valVatOrig = parseFloat(inv.vat_val) || 0;
    let valWoVatOrig = parseFloat(inv.val_wo_vat) || 0;
    let totOrig = parseFloat(inv.total_val) || 0;

    if (valWoVatOrig === 0 && totOrig > 0) {
      valWoVatOrig = Math.max(0, totOrig - valVatOrig);
    }
    if (totOrig === 0 && valWoVatOrig > 0) {
      totOrig = valWoVatOrig + valVatOrig;
    }

    let vatBase = inv.vat_value_in_base_currency != null && inv.vat_value_in_base_currency !== ''
      ? parseFloat(inv.vat_value_in_base_currency)
      : (valVatOrig * rate);
    let woVatBase = inv.value_before_vat_in_base_currency != null && inv.value_before_vat_in_base_currency !== ''
      ? parseFloat(inv.value_before_vat_in_base_currency)
      : (valWoVatOrig * rate);
    let totBase = inv.total_value_in_base_currency != null && inv.total_value_in_base_currency !== ''
      ? parseFloat(inv.total_value_in_base_currency)
      : (totOrig * rate);

    if (woVatBase === 0 && totBase > 0) {
      woVatBase = Math.max(0, totBase - vatBase);
    }
    if (totBase === 0 && woVatBase > 0) {
      totBase = woVatBase + vatBase;
    }
    const curr = normalizeFinanceCurrency(inv.currency);

    const isSelling = (inv.contract_id && sellingConIds.includes(inv.contract_id)) || String(inv.invoice_type).toLowerCase() === 'selling';
    if (isSelling) {
      sellingInvoiceCount++;
      sellingInvoiceTotalBase += totBase;
      sellingInvoiceTotalOrig += totOrig;
      if (curr) sellingInvoiceCurrencies.add(curr);
    } else {
      buyingInvoiceCount++;
      buyingInvoiceTotalBase += totBase;
      buyingInvoiceTotalOrig += totOrig;
      if (curr) buyingInvoiceCurrencies.add(curr);
    }
  }

  // 5. Expenses
  const expRes = await client.query(
    `SELECT id, id__expense_type, id__expense_cost, fy,
            COALESCE(value_before_vat, 0) as val_wo_vat,
            COALESCE(vat_value, 0) as vat_val,
            COALESCE(total_value, COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) as total_val,
            COALESCE(exchange_rate, 1.0) as rate, id__currency as currency,
            value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
     FROM expense
     WHERE id__request = $1 AND deleted_at IS NULL`,
    [requestId]
  );

  let expenseBase = 0;
  let expenseOrig = 0;
  let expenseVatBase = 0;
  let expenseCount = 0;
  let nonExpenseBase = 0;
  let nonExpenseOrig = 0;
  let nonExpenseCount = 0;
  let expenseCurrencies = new Set();
  let fyValues = new Set();

  for (const e of expRes.rows) {
    const rate = parseFloat(e.rate) || 1.0;
    let valWoVatOrig = parseFloat(e.val_wo_vat) || 0;
    let valVatOrig = parseFloat(e.vat_val) || 0;
    let valTotalOrig = parseFloat(e.total_val) || 0;

    if (valWoVatOrig === 0 && valTotalOrig > 0) {
      valWoVatOrig = Math.max(0, valTotalOrig - valVatOrig);
    }
    if (valTotalOrig === 0 && valWoVatOrig > 0) {
      valTotalOrig = valWoVatOrig + valVatOrig;
    }

    let valWoVatBase = e.value_before_vat_in_base_currency != null && e.value_before_vat_in_base_currency !== ''
      ? parseFloat(e.value_before_vat_in_base_currency)
      : (valWoVatOrig * rate);
    let vatBase = e.vat_value_in_base_currency != null && e.vat_value_in_base_currency !== ''
      ? parseFloat(e.vat_value_in_base_currency)
      : (valVatOrig * rate);
    let valTotalBase = e.total_value_in_base_currency != null && e.total_value_in_base_currency !== ''
      ? parseFloat(e.total_value_in_base_currency)
      : (valTotalOrig * rate);

    if (valWoVatBase === 0 && valTotalBase > 0) {
      valWoVatBase = Math.max(0, valTotalBase - vatBase);
    }
    if (valTotalBase === 0 && valWoVatBase > 0) {
      valTotalBase = valWoVatBase + vatBase;
    }

    const curr = normalizeFinanceCurrency(e.currency);
    if (e.fy) fyValues.add(e.fy);

    const typeStr = String(e.id__expense_type || '').toLowerCase();
    if (typeStr === 'non-expense' || typeStr === 'non expense' || typeStr === '73' || typeStr === 'non_expense') {
      nonExpenseCount++;
      nonExpenseBase += valWoVatBase;
      nonExpenseOrig += valWoVatOrig;
    } else {
      expenseCount++;
      expenseBase += valWoVatBase;
      expenseOrig += valWoVatOrig;
      expenseVatBase += vatBase;
    }
    if (curr) expenseCurrencies.add(curr);
  }

  // 6. Assets
  const assetRes = await client.query(
    `SELECT office_asset_id, purchase_cost, exchange_rate, currency, value_in_base_currency
     FROM asset
     WHERE request = $1 AND deleted_at IS NULL`,
    [requestId]
  );

  let assetCount = 0;
  let assetBase = 0;
  let assetOrig = 0;
  let assetCurrencies = new Set();

  for (const a of assetRes.rows) {
    assetCount++;
    const costNum = parseFloat(String(a.purchase_cost || '').replace(/[^0-9.]/g, '')) || 0;
    const rate = parseFloat(String(a.exchange_rate || '').replace(/[^0-9.]/g, '')) || 1.0;
    const valBase = a.value_in_base_currency != null ? parseFloat(a.value_in_base_currency) : (costNum * rate);
    assetBase += valBase;
    assetOrig += costNum;
    if (a.currency) assetCurrencies.add(normalizeFinanceCurrency(a.currency));
  }

  // Profitability (strictly based on contract selling and buying)
  const gmBase = sellingTotalBase - buyingTotalBase;
  const gmWoVatBase = sellingWoVatBase - buyingWoVatBase;

  let fy = Array.from(fyValues)[0];
  if (!fy) {
    const txDate = reqRow.sr_submitted_date || reqRow.sr_created_date || now;
    fy = 'FY' + new Date(txDate).getFullYear();
  }
  if (fy && !String(fy).startsWith('FY')) {
    fy = 'FY' + fy;
  }

  return {
    request_id: requestId,
    process_name: reqRow.policy_name || reqRow.request_type,
    fy: fy,
    base_currency: 'VND',

    // The 28 requested fields (Base Currency Values)
    selling_contract_count: sellingContractCount,
    selling: sellingTotalBase,
    buying_contract_count: buyingContractCount,
    buying: buyingTotalBase,
    gm: gmBase,
    vat_selling: vatSellingBase,
    selling_wo_vat: sellingWoVatBase,
    vat_buying: vatBuyingBase,
    buying_wo_vat: buyingWoVatBase,
    gm_wo_vat: gmWoVatBase,
    incoming_pm_count: incomingPmCount,
    incoming_payment: incomingPaymentBase,
    incoming_payment_paid: incomingPaymentPaidBase,
    incoming_pm_not_due_yet: incomingPmNotDueYetBase,
    incoming_pm_pending_pm: incomingPmPendingPmBase,
    outgoing_pm_count: outgoingPmCount,
    outgoing_payment: outgoingPaymentBase,
    outgoing_payment_paid: outgoingPaymentPaidBase,
    outgoing_pm_not_due_yet: outgoingPmNotDueYetBase,
    outgoing_pm_pending_pm: outgoingPmPendingPmBase,
    selling_invoice_count: sellingInvoiceCount,
    selling_invoice_total_value: sellingInvoiceTotalBase,
    buying_invoice_count: buyingInvoiceCount,
    buying_invoice_total_value: buyingInvoiceTotalBase,
    expense: expenseBase,
    non_expense: nonExpenseBase,
    asset: assetBase,
    fy_col: fy,

    // Detailed metrics for Borderless Column View
    details: {
      contract_selling: {
        count: sellingContractCount,
        value_orig: sellingTotalOrig,
        value_base: sellingTotalBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      vat_selling: {
        count: null,
        value_orig: vatSellingOrig,
        value_base: vatSellingBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      selling_wo_vat: {
        count: null,
        value_orig: sellingWoVatOrig,
        value_base: sellingWoVatBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      selling_invoice: {
        count: sellingInvoiceCount,
        value_orig: sellingInvoiceTotalOrig,
        value_base: sellingInvoiceTotalBase,
        currency: Array.from(sellingInvoiceCurrencies)[0] || ''
      },
      contract_buying: {
        count: buyingContractCount,
        value_orig: buyingTotalOrig,
        value_base: buyingTotalBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      vat_buying: {
        count: null,
        value_orig: vatBuyingOrig,
        value_base: vatBuyingBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      buying_wo_vat: {
        count: null,
        value_orig: buyingWoVatOrig,
        value_base: buyingWoVatBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      buying_invoice: {
        count: buyingInvoiceCount,
        value_orig: buyingInvoiceTotalOrig,
        value_base: buyingInvoiceTotalBase,
        currency: Array.from(buyingInvoiceCurrencies)[0] || ''
      },
      incoming_payment: {
        count: incomingPmCount,
        value_orig: incomingPaymentOrig,
        value_base: incomingPaymentBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_payment_paid: {
        count: incomingPaidCount,
        value_orig: incomingPaymentPaidOrig,
        value_base: incomingPaymentPaidBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_pm_not_due_yet: {
        count: incomingNotDueYetCount,
        value_orig: incomingPmNotDueYetOrig,
        value_base: incomingPmNotDueYetBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_pm_pending_pm: {
        count: incomingPendingCount,
        value_orig: incomingPmPendingPmOrig,
        value_base: incomingPmPendingPmBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      outgoing_payment: {
        count: outgoingPmCount,
        value_orig: outgoingPaymentOrig,
        value_base: outgoingPaymentBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_payment_paid: {
        count: outgoingPaidCount,
        value_orig: outgoingPaymentPaidOrig,
        value_base: outgoingPaymentPaidBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_pm_not_due_yet: {
        count: outgoingNotDueYetCount,
        value_orig: outgoingPmNotDueYetOrig,
        value_base: outgoingPmNotDueYetBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_pm_pending_pm: {
        count: outgoingPendingCount,
        value_orig: outgoingPmPendingPmOrig,
        value_base: outgoingPmPendingPmBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      expense: {
        count: expenseCount,
        value_orig: expenseOrig,
        value_base: expenseBase,
        currency: Array.from(expenseCurrencies)[0] || ''
      },
      non_expense: {
        count: nonExpenseCount,
        value_orig: nonExpenseOrig,
        value_base: nonExpenseBase,
        currency: Array.from(expenseCurrencies)[0] || ''
      },
      asset: {
        count: assetCount,
        value_orig: assetOrig,
        value_base: assetBase,
        currency: Array.from(assetCurrencies)[0] || ''
      },
      gm: {
        count: null,
        value_orig: null,
        value_base: gmBase,
        currency: ''
      },
      gm_wo_vat: {
        count: null,
        value_orig: null,
        value_base: gmWoVatBase,
        currency: ''
      }
    }
  };
}



async function resolveTicketApprovals(data, client) {
  if (!data.ticket_type) return;
  try {
    const policyRes = await client.query(
      'SELECT tier_1_engineer, tier_2_engineer, tier_3_engineer, ticket_lead, sr_coordinator, processing_tier FROM ticket_type WHERE ticket_type_id = $1 OR ticket_name = $1',
      [data.ticket_type]
    );

    if (policyRes.rows.length === 0) return;
    const policy = policyRes.rows[0];
    const t1Config = policy.tier_1_engineer;


    if (policy.ticket_lead) data.policy_lead = policy.ticket_lead;
    if (policy.sr_coordinator) data.sr_coordinator = policy.sr_coordinator;

    let t1_eng = t1Config;
    if (t1_eng) {
      if (t1_eng.toLowerCase() === 'direct manager') {
        const empRes = await client.query(
          'SELECT direct_manager FROM employee WHERE email = $1',
          [data.requester]
        );
        if (empRes.rows.length > 0 && empRes.rows[0].direct_manager) {
          t1_eng = empRes.rows[0].direct_manager;
        }
      }

    }

    data.approval_level = 'Standard';

    const max_tiers = parseInt(policy.processing_tier, 10) || 3;


    data.tier_2_status = 'Not started yet';
    data.tier_3_status = 'Not started yet';
    data.sr_status = 12; // in_progress
    data.process_status = 15; // processing

    const steps = [];
    const tzTimeStr = new Date().toISOString();
    for (let i = 1; i <= max_tiers; i++) {
      const engineer = i === 1 ? t1_eng : (i === 2 ? policy.tier_2_engineer : policy.tier_3_engineer);
      steps.push({
        level: i,
        status: i === 1 ? 'Pending' : 'Not started yet',
        assigned_engineer: engineer || null,
        history: i === 1 ? [{ status: 'Pending', timestamp: tzTimeStr, by: 'system' }] : []
      });
    }

    data.processing_flow = JSON.stringify({
      total_levels: max_tiers,
      current_level: max_tiers > 0 ? 1 : 0,
      steps: steps
    });

  } catch (err) {
    console.error('Error resolving ticket approvals:', err);
    throw err;
  }
}


module.exports = {
  normalizeFinanceCurrency,
  calculateRequestFinanceSummary,
  getCurrencies: () => repo.getDistinctAccountCurrencies()
};
