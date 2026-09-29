// ============================================================
// CRC APP - Internationalization (i18n) Engine
// ============================================================

const SUPPORTED_LANGS = {
  en: { label: 'English', flag: '🇬🇧' },
  vi: { label: 'Tiếng Việt', flag: '🇻🇳' },
  km: { label: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  my: { label: 'မြန်မာ', flag: '🇲🇲' },
  zh: { label: '中文', flag: '🇨🇳' },
};

let currentLang = localStorage.getItem('crc_lang') || 'en';
let _translations = {};

// Load locale JSON file
async function loadLocale(lang) {
  try {
    const res = await fetch(`/locales/${lang}.json?v=` + new Date().getTime());
    if (!res.ok) throw new Error(`Locale ${lang} not found`);
    _translations = await res.json();
    currentLang = lang;
    localStorage.setItem('crc_lang', lang);
  } catch (e) {
    console.warn(`[i18n] Failed to load locale "${lang}", falling back to en`, e);
    if (lang !== 'en') {
      await loadLocale('en');
    }
  }
}

/**
 * Translate a key. Falls back to the provided fallback string or the key itself.
 * Usage: t('btn.save')  →  "Lưu" (vi) or "Save" (en)
 *        t('field.full_name', 'Full Name')  →  uses 'Full Name' if key not found
 */
function t(key, fallback) {
  if (!key || key === 'col.undefined' || key === 'col.null' || key === 'col.') return fallback || '';
  let result = key;
  if (key in _translations) {
    result = _translations[key];
  } else if (fallback !== undefined) {
    result = fallback;
  } else {
    console.debug(`[i18n] Missing translation key: "${key}"`);
    return key;
  }
  
  // Dynamic replacement for Base Currency / VN / VND in labels
  if (typeof result === 'string' && key !== 'col.base_currency') {
    const hasBaseCurrency = result.includes('Base Currency') || result.includes('base currency') || result.includes('tiền tệ cơ sở') || result.includes('Tiền tệ cơ sở');
    const hasBalanceInVN = result.includes('BALANCE IN VN') || result.includes('BASE IN VN');
    const hasInVnd = /in\s+VND/i.test(result) || /_in_vnd/i.test(result) || /theo\s+VND/i.test(result);
    if (hasBaseCurrency || hasBalanceInVN || hasInVnd) {
      let activeCurrency = (typeof window !== 'undefined' && typeof window.getActiveBaseCurrency === 'function') ? window.getActiveBaseCurrency() : 'VND';
      if (!activeCurrency || activeCurrency === 'Base Currency') activeCurrency = 'VND';
      result = result.replace(/Base Currency/g, activeCurrency)
                    .replace(/base currency/g, activeCurrency)
                    .replace(/tiền tệ cơ sở/g, activeCurrency)
                    .replace(/Tiền tệ cơ sở/g, activeCurrency)
                    .replace(/BALANCE IN VN/g, 'BALANCE IN ' + activeCurrency)
                    .replace(/BASE IN VN/g, 'BALANCE IN ' + activeCurrency)
                    .replace(/in\s+VND/ig, (m) => {
                      if (m.startsWith('IN ') || m.startsWith('IN\t')) return 'IN ' + activeCurrency.toUpperCase();
                      if (m.startsWith('In ') || m.startsWith('In\t')) return 'In ' + activeCurrency;
                      return 'in ' + activeCurrency;
                    })
                    .replace(/theo\s+VND/ig, 'theo ' + activeCurrency)
                    .replace(/_in_vnd/ig, '_in_base_currency');
    }
  }
  if (typeof result === 'string') {
    result = result
      .replace(/\bProcess Sla\b/g, 'Process SLA')
      .replace(/\bSla Qualification\b/g, 'SLA Qualification')
      .replace(/\bSr Owner\b/g, 'SR Owner');
  }
  return result;
}

/**
 * Translate a data value for display only.
 * DB values remain English; this translates for UI display.
 * Usage: t_val('Active')  →  "Đang hoạt động" (vi)
 *        t_val('Male')    →  "Nam" (vi)
 */
function t_val(value) {
  if (value === null || value === undefined || value === '') return '';
  const cleanVal = String(value).trim().replace(/^\[|\]$/g, '');
  if (!cleanVal) return '';
  const idToKey = {
    // request.sr_status
    '1': 'draft', '2': 'pending_approval', '3': 'approved', '4': 'rejected', '5': 'closed', '6': 'cancelled',
    // request.process_status
    '7': 'not_started', '8': 'processing', '9': 'completed', '117': 'canceled',
    // ticket.sr_status
    '10': 'draft', '11': 'pending', '12': 'in_progress', '13': 'completed', '118': 'cancelled',
    // ticket.process_status
    '14': 'not_started', '15': 'processing', '16': 'completed', '119': 'cancelled', '120': 'draft',
    // employee.status
    '17': 'active', '18': 'inactive',
    // account.account_status
    '19': 'active', '20': 'inactive',
    // asset.status
    '21': 'failured', '22': 'in_used', '23': 'no_used',
    // service.status
    '26': 'not_started_yet', '27': 'on_going', '28': 'going_to_expired', '29': 'expired',
    // payment.payment_status
    '30': 'draft', '31': 'ready_for_payment', '32': 'paid', '33': 'deleted',
    // invoice.invoice_status
    '34': 'draft', '35': 'ready_to_issue', '36': 'issued', '37': 'paid', '38': 'void', '39': 'deleted',
    // cms_tenant_info.billing_status
    '40': 'active', '41': 'grace', '42': 'expired', '43': 'canceled', '44': 'inactive',
    // cms_tenant_info.subscription_status
    '45': 'active', '46': 'grace', '47': 'expired', '48': 'canceled', '49': 'inactive',
    // my_location.status
    '50': 'active', '51': 'inactive',
    // oppotunity.status
    '52': 'open', '53': 'closed_won', '54': 'closed_lost',
    // mtr.status
    '55': 'draft', '56': 'approved',
    // finance.status
    '57': 'active', '58': 'inactive',
    // payment.payment_type
    '60': 'incoming', '61': 'outgoing',
    // assigned_task.status
    '62': 'not_started', '63': 'processing', '64': 'completed',
    // task_subtask.status
    '65': 'pending', '66': 'completed',
    // my_company.status
    '67': 'active', '68': 'inactive',
    // contract.type
    '69': 'selling', '70': 'buying', '71': 'internal',
    // expense.id__expense_type
    '72': 'expense', '73': 'non_expense',
    // expense.id__expense_cost
    '74': 'operation_cost', '75': 'sales_cost', '76': 'fixed_cost', '77': 'variable_cost', '78': 'operation_expense', '79': 'sale_expense', '80': 'others',
    // service.service_type
    '81': 'subcription', '82': '1_time_service', '83': 'rental_loan', '84': 'borrow', '85': 'annual_renew'
  };
  const mappedValue = idToKey[cleanVal] || cleanVal;
  const key = 'val.' + String(mappedValue).toLowerCase().replace(/\s+/g, '_');
  if (_translations[key]) {
    const res = _translations[key];
    return typeof res === 'string' ? (res.charAt(0).toUpperCase() + res.slice(1)) : res;
  }
  if (typeof mappedValue === 'string') {
    if (mappedValue.toLowerCase() === 'not_started' || mappedValue.toLowerCase() === 'not_started_yet') {
      return 'Not started yet';
    }
    // Only format pure snake_case status strings (e.g. "in_progress", "pending_approval")
    if (/^[a-z]+(_[a-z]+)+$/i.test(mappedValue)) {
      const formatted = mappedValue
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return formatted;
    }
  }
  return mappedValue;
}

/**
 * Update all elements with data-i18n and data-i18n-placeholder attributes.
 */
function updateStaticTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated !== key) {
      el.textContent = translated;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (translated !== key) {
      el.placeholder = translated;
    }
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const translated = t(key);
    if (translated !== key) {
      el.innerHTML = translated;
    }
  });
}

/**
 * Build the language selector dropdown HTML.
 * @param {string} currentVal - Currently selected language code
 * @param {string} [selectId] - HTML id for the select element
 * @param {string} [extraStyle] - Extra inline CSS
 */
function buildLangSelectorHTML(selectId = 'lang-selector', extraStyle = '') {
  let html = `<div class="lang-selector-container" style="position: relative; display: flex; align-items: center; width: 100%;">`;
  html += `<span class="material-symbols-rounded" style="position: absolute; left: 12px; font-size: 18px; color: rgba(255,255,255,0.6); pointer-events: none;">language</span>`;
  html += `<select id="${selectId}" onchange="switchLanguage(this.value)" style="
    padding: 8px 30px 8px 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(0,0,0,0.2); color: #f8fafc; font-size: 13px; cursor: pointer;
    font-family: inherit; width: 100%; -webkit-appearance: none; -moz-appearance: none; appearance: none;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>');
    background-repeat: no-repeat; background-position: right 10px center; background-size: 14px;
    ${extraStyle}">`;
  for (const [code, meta] of Object.entries(SUPPORTED_LANGS)) {
    const selected = code === currentLang ? 'selected' : '';
    const label = code === 'en' ? 'English (GB)' : meta.label;
    html += `<option value="${code}" style="background: #0f172a; color: #f8fafc;" ${selected}>${meta.flag} ${label}</option>`;
  }
  html += '</select></div>';
  return html;
}

/**
 * Switch language, reload translations, and re-render current view.
 */
async function switchLanguage(lang) {
  if (!SUPPORTED_LANGS[lang]) return;
  await loadLocale(lang);
  updateStaticTexts();
  // Sync all language selectors on the page
  document.querySelectorAll('select[id$="lang-selector"], #lang-selector, #sidebar-lang-selector').forEach(sel => {
    if (sel.value !== lang) sel.value = lang;
  });
  // Re-render current module view
  if (typeof currentModule !== 'undefined' && currentModule) {
    if (currentModule === 'setup' && typeof loadSetupView === 'function') {
      await loadSetupView();
    } else if (typeof loadModule === 'function') {
      if (typeof currentView !== 'undefined' && currentView === 'detail' && typeof currentRecord !== 'undefined' && currentRecord) {
        const mod = MODULES[currentModule];
        const pkVal = currentRecord[mod.pk];
        if (typeof openDetailInternal === 'function') {
          // force=true, silent=false, skipFetch=true
          await openDetailInternal(currentModule, pkVal, true, false, true);
        }
      } else {
        // skipFetch=true
        await loadModule(currentModule, true);
      }
    }
  }
}
