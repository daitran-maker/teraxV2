/**
 * CRC App - Finance Summary View & Currency Tabs
 * Extracted as part of Phase 2 Modularization
 */

// ============================================================
// FINANCE SUMMARY TAB
// ============================================================
async function loadFinanceSummary(parentModuleKey, pkVal, targetId) {
  let container;
  if (targetId && typeof targetId !== 'string') {
    container = targetId;
  } else {
    const contentPane = document.getElementById('content');
    const tid = targetId || 'finance-summary-content';
    container = contentPane ? contentPane.querySelector('#' + tid) : document.getElementById(tid);
  }
  if (!container) return;

  const loadingText = typeof t === 'function' ? t('detail.loading', 'Loading finance summary...') : 'Loading finance summary...';
  container.innerHTML = `<div style="color:#6B7280; font-size:12px; padding:20px; text-align:center;">${loadingText}</div>`;

  try {
    const res = await apiGet(`/table/finance/request-summary/${pkVal}`);
    const data = (res && res.data) ? res.data : null;
    if (!data) {
      const noDataText = typeof t === 'function' ? t('finance.no_data', 'No finance records found.') : 'No finance records found.';
      container.innerHTML = `<div style="color:#6B7280; font-size:12px; padding:16px;">${noDataText}</div>`;
      return;
    }

    const formatMoneyVal = (num) => {
      return Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtValue = (v, currCode) => {
      if (v === null || v === undefined || v === '') return '';
      const num = parseFloat(v);
      if (isNaN(num)) return '';
      if (num === 0 && !currCode) return '';
      const isNeg = num < 0;
      const absFormatted = formatMoneyVal(num);
      let c = String(currCode || '').trim().toUpperCase();
      if (c === '1' || c === 'Đ' || c === '₫') c = 'VND';
      else if (c === '2' || c === '$') c = 'USD';
      else if (c === '3' || c === '€') c = 'EUR';
      else if (c === '4') c = 'MMK';
      else if (c === '5') c = 'SGD';
      else if (c === '6') c = 'THB';
      else if (c === '£') c = 'GBP';
      else if (/^\d+$/.test(c)) c = 'VND';

      const currSuffix = c ? ` ${c}` : '';
      return isNeg ? `-${absFormatted}${currSuffix}` : `${absFormatted}${currSuffix}`;
    };

    const fmtBaseValue = (v, allowZero = false) => {
      if (v === null || v === undefined || v === '') return '';
      const num = parseFloat(v);
      if (isNaN(num)) return '';
      if (num === 0 && !allowZero) return '';
      const isNeg = num < 0;
      const absFormatted = formatMoneyVal(num);
      return isNeg ? `-${absFormatted}` : absFormatted;
    };

    const fmtCount = (c) => {
      if (c === null || c === undefined || c === '-' || c === 0) return '';
      return String(c);
    };

    const details = data.details || {};

    // 1. Toolbar (Minimalist Title + Clean Toggle)
    const toolbarHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #E5E7EB; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:13px; font-weight:500; color:#111827; text-transform:uppercase; letter-spacing:0.5px;">${typeof t === 'function' ? t('finance.summary_title', 'Finance Summary') : 'Finance Summary'}</span>
          ${data.fy ? `<span style="font-size:11px; font-weight:500; padding:2px 8px; border-radius:4px; background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB;">${escapeHTML(data.fy)}</span>` : ''}
        </div>
        <div style="display:inline-flex; background:#F3F4F6; border-radius:4px; padding:2px; gap:2px;">
          <button type="button" id="btn-fin-view-borderless" onclick="window.switchFinanceSummaryView('borderless')" style="padding:4px 12px; font-size:12px; font-weight:500; border-radius:3px; border:none; cursor:pointer; background:#FFFFFF; color:#111827; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:all 0.15s ease;">
            ${typeof t === 'function' ? t('finance.borderless_view', 'Borderless View') : 'Borderless View'}
          </button>
          <button type="button" id="btn-fin-view-table" onclick="window.switchFinanceSummaryView('table')" style="padding:4px 12px; font-size:12px; font-weight:500; border-radius:3px; border:none; cursor:pointer; background:transparent; color:#6B7280; transition:all 0.15s ease;">
            ${typeof t === 'function' ? t('finance.table_view', 'Table View') : 'Table View'}
          </button>
        </div>
      </div>
    `;

    // 2. Borderless View Rows definition
    // Columns: [Label] | Value | Value in Base Currency | Count
    const borderlessRows = [
      { key: 'contract_selling', label: 'Contract selling', item: details.contract_selling },
      { key: 'contract_buying', label: 'Contract buying', item: details.contract_buying },
      { key: 'incoming_payment', label: 'Incoming Payment', item: details.incoming_payment },
      { key: 'incoming_payment_paid', label: 'Paid', item: details.incoming_payment_paid, isSub: true },
      { key: 'incoming_pm_not_due_yet', label: 'Not due yet', item: details.incoming_pm_not_due_yet, isSub: true },
      { key: 'incoming_pm_pending_pm', label: 'Pending PM', item: details.incoming_pm_pending_pm, isSub: true },
      { key: 'outgoing_payment', label: 'Outgoing Payment', item: details.outgoing_payment },
      { key: 'outgoing_payment_paid', label: 'Paid', item: details.outgoing_payment_paid, isSub: true },
      { key: 'outgoing_pm_not_due_yet', label: 'Not due yet', item: details.outgoing_pm_not_due_yet, isSub: true },
      { key: 'outgoing_pm_pending_pm', label: 'Pending PM', item: details.outgoing_pm_pending_pm, isSub: true },
      { key: 'selling_invoice', label: 'Selling invoice', item: details.selling_invoice },
      { key: 'buying_invoice', label: 'Buying invoice', item: details.buying_invoice },
      { key: 'vat_buying', label: 'Vat buying', item: details.vat_buying },
      { key: 'vat_selling', label: 'Vat Selling', item: details.vat_selling },
      { key: 'selling_wo_vat', label: 'Selling wo VAT', item: details.selling_wo_vat },
      { key: 'buying_wo_vat', label: 'Buying wo VAT', item: details.buying_wo_vat },
      { key: 'expense', label: 'Expense', item: details.expense },
      { key: 'non_expense', label: 'Non Expense', item: details.non_expense },
      { key: 'asset', label: 'Asset', item: details.asset },
      { key: 'gm', label: 'GM', item: details.gm, allowZero: true },
      { key: 'gm_wo_vat', label: 'GM wo VAT', item: details.gm_wo_vat, allowZero: true },
    ];

    const baseCurr = data.base_currency || (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
    const valBaseHeader = typeof t === 'function' ? t('finance.col_value_base', `Value in ${baseCurr}`) : `Value in ${baseCurr}`;

    let borderlessHTML = `
      <div id="finance-view-borderless" style="display:block; width:100%;">
        <table style="width:100%; table-layout:fixed; border-collapse:collapse; font-size:13px; text-align:left; border:none; background:transparent;">
          <colgroup>
            <col style="width:37%;">
            <col style="width:21%;">
            <col style="width:21%;">
            <col style="width:21%;">
          </colgroup>
          <thead>
            <tr style="border:none; color:#6B7280; font-weight:500; font-size:12px;">
              <th style="padding:8px 12px; border:none; width:37%; text-align:left;"></th>
              <th style="padding:8px 12px; border:none; width:21%; text-align:right;">${typeof t === 'function' ? t('finance.col_value', 'Value') : 'Value'}</th>
              <th style="padding:8px 12px; border:none; width:21%; text-align:right;">${valBaseHeader}</th>
              <th style="padding:8px 12px; border:none; width:21%; text-align:right;">${typeof t === 'function' ? t('finance.col_count', 'Count') : 'Count'}</th>
            </tr>
          </thead>
          <tbody>
    `;

    const hasAnyTransaction = (
      (details.contract_selling && details.contract_selling.count > 0) ||
      (details.contract_buying && details.contract_buying.count > 0) ||
      (details.expense && details.expense.count > 0) ||
      (details.asset && details.asset.count > 0) ||
      (details.incoming_payment && details.incoming_payment.count > 0) ||
      (details.outgoing_payment && details.outgoing_payment.count > 0) ||
      (details.selling_invoice && details.selling_invoice.count > 0) ||
      (details.buying_invoice && details.buying_invoice.count > 0)
    );

    let visibleRowCount = 0;
    borderlessRows.forEach((r) => {
      const it = r.item || {};
      const allowZero = !!r.allowZero && hasAnyTransaction;
      const origValStr = it.value_orig != null ? fmtValue(it.value_orig, it.currency) : '';
      const baseValStr = it.value_base != null ? fmtBaseValue(it.value_base, allowZero) : '';
      const countStr = fmtCount(it.count);

      // Chỗ nào không có thông tin thì ẩn đi
      if (!origValStr && !baseValStr && !countStr) {
        return;
      }

      visibleRowCount++;
      const rowWeight = '400';
      const labelPadding = r.isSub ? 'padding:6px 12px 6px 28px;' : 'padding:7px 12px;';
      const cellPadding = 'padding:7px 12px;';
      const textColor = r.isSub ? '#475569' : '#1E293B';
      const rowLabel = typeof t === 'function' ? (t('finance.' + r.key, t('col.' + r.key, r.label))) : r.label;

      borderlessHTML += `
        <tr style="border:none; transition:background 0.1s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
          <td style="${labelPadding} border:none; width:37%; font-weight:${rowWeight}; color:${textColor}; text-align:left; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHTML(rowLabel)}
          </td>
          <td style="${cellPadding} border:none; width:21%; text-align:right; font-variant-numeric:tabular-nums; font-weight:${rowWeight}; color:#1E293B; white-space:nowrap;">
            ${origValStr}
          </td>
          <td style="${cellPadding} border:none; width:21%; text-align:right; font-variant-numeric:tabular-nums; font-weight:${rowWeight}; color:#1E293B; white-space:nowrap;">
            ${baseValStr}
          </td>
          <td style="${cellPadding} border:none; width:21%; text-align:right; font-weight:${rowWeight}; color:#64748B; white-space:nowrap;">
            ${escapeHTML(countStr)}
          </td>
        </tr>
      `;
    });

    if (visibleRowCount === 0) {
      borderlessHTML += `
        <tr>
          <td colspan="4" style="padding:24px 12px; text-align:center; color:#94A3B8; border:none; font-size:13px;">
            ${typeof t === 'function' ? t('finance.no_data', 'No finance records found.') : 'No finance records found.'}
          </td>
        </tr>
      `;
    }

    borderlessHTML += `
          </tbody>
        </table>
      </div>
    `;

    // 3. Table View (28 Columns)
    const tableCols = [
      { key: 'selling_contract_count', label: 'Selling contract count' },
      { key: 'selling', label: 'Selling', isMoney: true },
      { key: 'buying_contract_count', label: 'Buying contract count' },
      { key: 'buying', label: 'Buying', isMoney: true },
      { key: 'gm', label: 'GM', isMoney: true, allowZero: true },
      { key: 'vat_selling', label: 'Vat Selling', isMoney: true },
      { key: 'selling_wo_vat', label: 'Selling wo VAT', isMoney: true },
      { key: 'vat_buying', label: 'Vat Buying', isMoney: true },
      { key: 'buying_wo_vat', label: 'Buying wo VAT', isMoney: true },
      { key: 'gm_wo_vat', label: 'GM wo VAT', isMoney: true, allowZero: true },
      { key: 'incoming_pm_count', label: 'Incoming PM count' },
      { key: 'incoming_payment', label: 'Incoming payment', isMoney: true },
      { key: 'incoming_payment_paid', label: 'Incoming payment_Paid', isMoney: true },
      { key: 'incoming_pm_not_due_yet', label: 'Incoming PM_Not due yet', isMoney: true },
      { key: 'incoming_pm_pending_pm', label: 'Incoming PM_Pending PM', isMoney: true },
      { key: 'outgoing_pm_count', label: 'Outgoing PM count' },
      { key: 'outgoing_payment', label: 'Outgoing payment', isMoney: true },
      { key: 'outgoing_payment_paid', label: 'Outgoing payment_Paid', isMoney: true },
      { key: 'outgoing_pm_not_due_yet', label: 'Outgoing PM_Not due yet', isMoney: true },
      { key: 'outgoing_pm_pending_pm', label: 'Outgoing PM_Pending PM', isMoney: true },
      { key: 'selling_invoice_count', label: 'Selling invoice count' },
      { key: 'selling_invoice_total_value', label: 'Selling invoice total value', isMoney: true },
      { key: 'buying_invoice_count', label: 'Buying invoice count' },
      { key: 'buying_invoice_total_value', label: 'Buying invoice total value', isMoney: true },
      { key: 'expense', label: 'Expense', isMoney: true },
      { key: 'non_expense', label: 'Non Expense', isMoney: true },
      { key: 'asset', label: 'Asset', isMoney: true },
      { key: 'fy_col', label: 'FY' }
    ];

    let tableHTML = `
      <div id="finance-view-table" style="display:none; width:100%; overflow-x:auto; border:1px solid #E2E8F0; border-radius:4px;">
        <table style="width:100%; border-collapse:collapse; font-size:12px; white-space:nowrap; text-align:left;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
    `;

    tableCols.forEach(col => {
      const colLabel = typeof t === 'function' ? (t('col.' + col.key, t('finance.' + col.key, col.label))) : col.label;
      tableHTML += `
        <th style="padding:8px 12px; font-weight:500; color:#475569; font-size:11px; ${col.isMoney ? 'text-align:right;' : ''}">
          ${escapeHTML(colLabel)}
        </th>
      `;
    });

    tableHTML += `
            </tr>
          </thead>
          <tbody>
            <tr style="background:#FFFFFF;">
    `;

    tableCols.forEach(col => {
      const rawVal = data[col.key];
      let displayVal = rawVal;
      if (col.isMoney) {
        displayVal = fmtBaseValue(rawVal, !!col.allowZero && hasAnyTransaction);
      } else if (col.key.includes('_count')) {
        displayVal = (rawVal && rawVal !== 0 && rawVal !== '-') ? String(rawVal) : '';
      }

      tableHTML += `
        <td style="padding:8px 12px; border-bottom:1px solid #F1F5F9; font-variant-numeric:tabular-nums; ${col.isMoney ? 'text-align:right;' : ''} font-weight:500; color:#1E293B;">
          ${escapeHTML(displayVal)}
        </td>
      `;
    });

    tableHTML += `
            </tr>
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = `
      <div class="finance-loaded" style="padding:4px 0;">
        ${toolbarHTML}
        ${borderlessHTML}
        ${tableHTML}
      </div>
    `;

  } catch (err) {
    console.error('[Finance Summary] Error:', err);
    container.innerHTML = `<div style="color:#6B7280; font-size:12px; padding:12px;">Failed to load finance data: ${escapeHTML(err.message)}</div>`;
  }
}
window.loadFinanceSummary = loadFinanceSummary;

window.switchFinanceSummaryView = function(viewMode) {
  const borderlessEl = document.getElementById('finance-view-borderless');
  const tableEl = document.getElementById('finance-view-table');
  const btnBorderless = document.getElementById('btn-fin-view-borderless');
  const btnTable = document.getElementById('btn-fin-view-table');

  if (viewMode === 'table') {
    if (borderlessEl) borderlessEl.style.display = 'none';
    if (tableEl) tableEl.style.display = 'block';
    if (btnBorderless) {
      btnBorderless.style.background = 'transparent';
      btnBorderless.style.color = '#6B7280';
      btnBorderless.style.boxShadow = 'none';
    }
    if (btnTable) {
      btnTable.style.background = '#FFFFFF';
      btnTable.style.color = '#111827';
      btnTable.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    }
  } else {
    if (borderlessEl) borderlessEl.style.display = 'block';
    if (tableEl) tableEl.style.display = 'none';
    if (btnBorderless) {
      btnBorderless.style.background = '#FFFFFF';
      btnBorderless.style.color = '#111827';
      btnBorderless.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    }
    if (btnTable) {
      btnTable.style.background = 'transparent';
      btnTable.style.color = '#6B7280';
      btnTable.style.boxShadow = 'none';
    }
  }
};
