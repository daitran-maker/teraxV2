/**
 * CRC App - Super Admin Workload & Performance Dashboard
 * Features:
 * 1. Individual Productivity Matrix (Requests & Workflow)
 * 2. Opportunity-Centric Performance & Team Breakdown
 * 3. Visual SVG Donut & Stacked Bar Charts for Ratio Tracking
 * 4. Revenue & Contract Financial Progress Gauges
 */

let workloadState = {
  perspective: 'request', // 'request' | 'opportunity'
  timeRange: '30d',
  departmentId: 'all',
  searchQuery: '',
  data: null,
  loading: false,
  sortCol: 'as_owner_active',
  sortAsc: false,
  selectedEmpId: null,
  oppPage: 1,
  oppPageSize: 25
};

// Status Maps matching DB status_catalog
const WL_REQUEST_STATUS = {
  1: { key: 'draft', vi: 'Bản nháp', en: 'Draft', color: '#64748B', bg: '#F1F5F9' },
  2: { key: 'pending_approval', vi: 'Chờ duyệt', en: 'Pending Approval', color: '#1D4ED8', bg: '#EFF6FF' },
  3: { key: 'approved', vi: 'Đã duyệt', en: 'Approved', color: '#059669', bg: '#ECFDF5' },
  4: { key: 'rejected', vi: 'Từ chối', en: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
  5: { key: 'closed', vi: 'Đã đóng', en: 'Closed', color: '#475569', bg: '#F1F5F9' },
  6: { key: 'cancelled', vi: 'Đã hủy', en: 'Cancelled', color: '#EF4444', bg: '#FEF2F2' },
  9: { key: 'completed', vi: 'Hoàn thành', en: 'Completed', color: '#10B981', bg: '#ECFDF5' },
  117: { key: 'cancelled', vi: 'Đã hủy', en: 'Cancelled', color: '#EF4444', bg: '#FEF2F2' }
};

function wlIsVi() {
  if (typeof currentLang !== 'undefined' && currentLang) return currentLang === 'vi';
  if (typeof localStorage !== 'undefined') {
    const l = localStorage.getItem('crc_lang');
    if (l) return l === 'vi';
  }
  return false;
}

function wlGetBaseCurrency() {
  if (typeof window !== 'undefined' && typeof window.getActiveBaseCurrency === 'function') {
    const b = window.getActiveBaseCurrency();
    if (b && b !== 'Base Currency') return b;
  }
  return 'VND';
}

function wlGetContractBaseValue(c) {
  if (!c) return 0;
  const b = parseFloat(c.total_value_in_base_currency);
  if (!isNaN(b) && b > 0) return b;
  const t = parseFloat(c.total_value);
  if (!isNaN(t)) return t;
  return 0;
}

function wlGetPaymentBaseValue(p) {
  if (!p) return 0;
  const b = parseFloat(p.value_in_base_currency);
  if (!isNaN(b) && b > 0) return b;
  const t = parseFloat(p.total_value);
  if (!isNaN(t) && t > 0) return t;
  const v = parseFloat(p.value);
  if (!isNaN(v)) return v;
  return 0;
}

function wlRenderMoneyWithOriginal(baseAmount, origCurrency, origAmount) {
  const baseCurr = wlGetBaseCurrency();
  const baseHtml = wlFormatMoney(baseAmount, baseCurr);
  const origCurr = (origCurrency === '1' || origCurrency === 1) ? 'VND' : ((origCurrency === '2' || origCurrency === 2) ? 'USD' : (origCurrency || 'VND'));
  if (origCurr !== baseCurr && origAmount && Number(origAmount) > 0 && Math.abs(Number(origAmount) - Number(baseAmount)) > 0.01) {
    return `<div style="line-height:1.2;"><div>${baseHtml}</div><div style="font-size:9.5px; color:#64748B; font-weight:normal; margin-top:2px;" title="Original Currency">(${wlFormatMoney(origAmount, origCurr)})</div></div>`;
  }
  return baseHtml;
}

function wlGetRequestStatusBadge(status) {
  const info = WL_REQUEST_STATUS[status] || { key: `status_${status}`, vi: `Trạng thái ${status}`, en: `Status ${status}`, color: '#64748B', bg: '#F1F5F9' };
  const fallback = wlIsVi() ? info.vi : info.en;
  const label = typeof t === 'function' ? t(`status.${info.key}`, fallback) : fallback;
  return `<span style="background:${info.bg}; color:${info.color}; border:1px solid ${info.color}30; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; display:inline-block; white-space:nowrap;">${escapeHTML(label)}</span>`;
}

const WL_TASK_STATUS = {
  1: { key: 'not_started', vi: 'Chưa bắt đầu', en: 'Not started yet', color: '#64748B', bg: '#F1F5F9' },
  2: { key: 'processing', vi: 'Đang xử lý', en: 'Processing', color: '#2563EB', bg: '#EFF6FF' },
  3: { key: 'customer_review', vi: 'Đang đánh giá', en: 'Customer review', color: '#D97706', bg: '#FFFBEB' },
  4: { key: 'completed', vi: 'Hoàn thành', en: 'Completed', color: '#059669', bg: '#ECFDF5' },
  5: { key: 'closed', vi: 'Đã đóng', en: 'Closed', color: '#475569', bg: '#F1F5F9' },
  6: { key: 'pending', vi: 'Chờ xử lý', en: 'Pending', color: '#DB2777', bg: '#FDF2F8' },
  7: { key: 'spare_in_custom', vi: 'Linh kiện hải quan', en: 'Spare in custom', color: '#7C3AED', bg: '#F5F3FF' },
  8: { key: 'monitoring', vi: 'Đang theo dõi', en: 'Monitoring', color: '#0891B2', bg: '#ECFEFF' },
  9: { key: 'cancelled', vi: 'Đã hủy', en: 'Canceled', color: '#DC2626', bg: '#FEF2F2' }
};

function wlGetTaskStatusBadge(status) {
  const info = WL_TASK_STATUS[status] || { key: `task_${status}`, vi: `Nhiệm vụ ${status}`, en: `Task ${status}`, color: '#64748B', bg: '#F1F5F9' };
  const fallback = wlIsVi() ? info.vi : info.en;
  const label = typeof t === 'function' ? t(`status.${info.key}`, fallback) : fallback;
  return `<span style="background:${info.bg}; color:${info.color}; border:1px solid ${info.color}30; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; display:inline-block; white-space:nowrap;">${escapeHTML(label)}</span>`;
}

// Service Delivery Contract (SDC) Statuses matching SD_STATUS_OPTIONS
const WL_SDC_STATUS = {
  1: { key: 'not_started_yet', vi: 'Chưa bắt đầu', en: 'Not started yet', color: '#64748B', bg: '#F1F5F9' },
  2: { key: 'on_going', vi: 'Đang thực hiện', en: 'On going', color: '#2563EB', bg: '#EFF6FF' },
  3: { key: 'going_to_expire', vi: 'Sắp hết hạn', en: 'Going to expire', color: '#D97706', bg: '#FFFBEB' },
  4: { key: 'completed', vi: 'Hoàn thành', en: 'Completed', color: '#059669', bg: '#ECFDF5' },
  5: { key: 'expired', vi: 'Đã hết hạn', en: 'Expired', color: '#DC2626', bg: '#FEF2F2' },
  6: { key: 'no_task_created', vi: 'Chưa có task', en: 'No task created', color: '#9333EA', bg: '#FAF5FF' },
  7: { key: 'canceled', vi: 'Đã hủy', en: 'Canceled', color: '#EF4444', bg: '#FEF2F2' },
  10: { key: 'draft', vi: 'Bản nháp', en: 'Draft', color: '#64748B', bg: '#F1F5F9' },
  11: { key: 'waiting_for_approval', vi: 'Chờ phê duyệt', en: 'Waiting for approval', color: '#0284C7', bg: '#F0F9FF' },
  22: { key: 'on_hold', vi: 'Tạm dừng', en: 'On hold', color: '#F59E0B', bg: '#FFFBEB' }
};

function wlGetSdcStatusBadge(status) {
  const info = WL_SDC_STATUS[status] || { key: `sdc_${status}`, vi: `Trạng thái ${status}`, en: `Status ${status}`, color: '#64748B', bg: '#F1F5F9' };
  const fallback = wlIsVi() ? info.vi : info.en;
  let label = fallback;
  if (typeof t === 'function') {
    label = t(`status.${info.key}`, fallback);
  }
  return `<span style="background:${info.bg}; color:${info.color}; border:1px solid ${info.color}30; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; display:inline-block; white-space:nowrap;">${escapeHTML(label)}</span>`;
}

function wlRenderSdcProgressBar(sdc) {
  const total = sdc.task_count || 0;
  if (total <= 0) {
    const lbl = typeof t === 'function' ? t('oppo.prog.no_task', 'Chưa có task') : 'Chưa có task';
    return `<div style="height:18px; background:#E2E8F0; border-radius:4px; position:relative; overflow:hidden; min-width:130px;" title="${lbl}">
      <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; color:#64748B;">${lbl}</span>
    </div>`;
  }
  const comp = sdc.completed_tasks || 0;
  const proc = sdc.processing_tasks || 0;
  const nots = Math.max(0, total - comp - proc);
  const compPct = Math.round((comp / total) * 100);
  const procPct = Math.round((proc / total) * 100);
  const notsPct = Math.max(0, 100 - compPct - procPct);
  const domLabel = `${comp}/${total} (${compPct}%)`;
  return `
    <div style="height:18px; background:#E2E8F0; border-radius:4px; position:relative; overflow:hidden; display:flex; min-width:130px;" title="${comp} ${t('val.completed', 'hoàn thành')} • ${proc} ${t('val.processing', 'đang xử lý')} • ${nots} ${t('val.not_started', 'chưa bắt đầu')}">
      <div style="width:${compPct}%; background:#10B981; height:100%; transition:width 0.2s;"></div>
      <div style="width:${procPct}%; background:#F59E0B; height:100%; transition:width 0.2s;"></div>
      <div style="width:${notsPct}%; background:#CBD5E1; height:100%; transition:width 0.2s;"></div>
      <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#FFFFFF; text-shadow:0 1px 2px rgba(15,23,42,0.8);">${domLabel}</span>
    </div>
  `;
}

function wlRenderSdcRemainingTimeBar(sdc) {
  if (!sdc.start_date || !sdc.end_date) {
    return '<span style="color:#94A3B8; font-size:11px;">—</span>';
  }
  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(sdc.start_date); start.setHours(0, 0, 0, 0);
  const end = new Date(sdc.end_date); end.setHours(0, 0, 0, 0);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return '<span style="color:#94A3B8; font-size:11px;">—</span>';
  }
  const endIncl = new Date(end.getTime() + DAY);
  const totalDays = Math.max(1, Math.round((endIncl - start) / DAY));
  const loc = wlIsVi() ? 'vi-VN' : 'en-GB';
  const range = `${start.toLocaleDateString(loc)} → ${end.toLocaleDateString(loc)} (${totalDays} ${wlIsVi() ? 'ngày' : 'days'})`;

  let pct = 0;
  let color = '#10B981';
  let fullTitle = '';

  if (today < start) {
    const startsIn = Math.max(1, Math.round((start - today) / DAY));
    pct = 100;
    color = '#94A3B8';
    fullTitle = `${range} · ${typeof t === 'function' ? t('oppo.rem.starts_in', wlIsVi() ? `Bắt đầu sau ${startsIn} ngày` : `Starts in ${startsIn} days`, { n: startsIn }) : (wlIsVi() ? `Bắt đầu sau ${startsIn} ngày` : `Starts in ${startsIn} days`)}`;
  } else if (today >= endIncl) {
    const expiredDays = Math.max(1, Math.round((today - end) / DAY));
    pct = 0;
    color = '#EF4444';
    fullTitle = `${range} · ${typeof t === 'function' ? t('oppo.rem.expired', wlIsVi() ? `Hết hạn ${expiredDays} ngày` : `Expired ${expiredDays} days`, { n: expiredDays }) : (wlIsVi() ? `Hết hạn ${expiredDays} ngày` : `Expired ${expiredDays} days`)}`;
  } else {
    const leftDays = Math.max(0, Math.round((endIncl - today) / DAY));
    pct = Math.max(0, Math.min(100, Math.round((leftDays / totalDays) * 100)));
    color = leftDays <= 30 ? '#F59E0B' : '#10B981';
    fullTitle = `${range} · ${typeof t === 'function' ? t('oppo.rem.days_left', wlIsVi() ? `Còn ${leftDays} ngày` : `${leftDays} days left`, { n: leftDays }) : (wlIsVi() ? `Còn ${leftDays} ngày` : `${leftDays} days left`)}`;
  }

  return `
    <div style="min-width:140px;" title="${escapeHTML(fullTitle)}">
      <div style="height:18px; background:#E2E8F0; border-radius:4px; position:relative; overflow:hidden; display:flex;">
        <div style="width:${pct}%; background:${color}; height:100%; transition:width 0.2s;"></div>
        <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:${pct < 40 ? '#1E293B' : '#FFFFFF'}; text-shadow:${pct < 40 ? 'none' : '0 1px 2px rgba(15,23,42,0.8)'};">${pct}%</span>
      </div>
    </div>
  `;
}

const WL_OPP_STATUS = {
  1: { key: 'cancel', vi: 'Đã hủy', en: 'Cancel', color: '#EF4444' },
  2: { key: 'closed', vi: 'Đã đóng', en: 'Closed', color: '#64748B' },
  3: { key: 'commit', vi: 'Cam kết', en: 'Commit', color: '#3B82F6' },
  4: { key: 'internal', vi: 'Nội bộ', en: 'Internal', color: '#8B5CF6' },
  5: { key: 'lost', vi: 'Thất bại', en: 'Lost', color: '#DC2626' },
  6: { key: 'open', vi: 'Đang mở', en: 'Open', color: '#0EA5E9' },
  7: { key: 'pending', vi: 'Chờ xử lý', en: 'Pending', color: '#F59E0B' },
  8: { key: 'won', vi: 'Thành công', en: 'Won', color: '#10B981' },
  9: { key: 'upside', vi: 'Tiềm năng cao', en: 'Upside', color: '#06B6D4' },
  10: { key: 'at_risk', vi: 'Rủi ro', en: 'At risk', color: '#F97316' }
};

function wlGetOppStatusBadge(statusInfo, statusId) {
  const info = statusInfo || (statusId ? WL_OPP_STATUS[statusId] : null) || { key: 'unknown', vi: 'Khác', en: 'Other', color: '#64748B' };
  const fallback = wlIsVi() ? (info.vi || info.en) : (info.en || info.vi);
  const label = typeof t === 'function' ? t(`opp.status.${info.key || 'unknown'}`, fallback) : fallback;
  const color = info.color || '#64748B';
  return `<span style="font-size:11px; font-weight:700; color:${color}; background:${color}15; padding:3px 8px; border-radius:6px; border:1px solid ${color}30; white-space:nowrap;">${escapeHTML(label)}</span>`;
}

function wlGetOppStatusLabel(statusInfo, statusId) {
  const info = statusInfo || (statusId ? WL_OPP_STATUS[statusId] : null) || { key: 'unknown', vi: 'Khác', en: 'Other' };
  const fallback = wlIsVi() ? (info.vi || info.en) : (info.en || info.vi);
  return typeof t === 'function' ? t(`opp.status.${info.key || 'unknown'}`, fallback) : fallback;
}

// Friendly helpers
function wlFormatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('vi-VN');
}

function wlFormatMoney(val, curr = 'VND') {
  let c = curr;
  if (c === '1' || c === 1 || !c) c = 'VND';
  else if (c === '2' || c === 2) c = 'USD';
  if (!val || isNaN(val)) return '0 ' + c;
  return Number(val).toLocaleString('vi-VN') + ' ' + c;
}

const WL_SDC_SERVICE_NAMES = {
  1: 'Oracle Premier Support (PS)',
  2: 'Health Check (HC)',
  3: 'Implementation & Deployment',
  4: 'Troubleshooting & Support',
  5: 'Managed Service (MS)',
  6: 'Consulting & Assessment',
  7: 'Training & Knowledge Transfer',
  8: 'Warranty & Maintenance'
};

function wlGetSdcLabel(sdc) {
  if (!sdc) return 'N/A';
  const scope = (sdc.service_scope || '').trim();
  if (scope && scope !== '-' && scope !== '—') {
    return scope;
  }
  const svcId = Number(sdc.service);
  if (svcId && WL_SDC_SERVICE_NAMES[svcId]) {
    return WL_SDC_SERVICE_NAMES[svcId];
  }
  if (sdc.service && sdc.service !== '-' && sdc.service !== '—') {
    return String(sdc.service);
  }
  return 'Service Delivery';
}

function wlFormatCounterparty(id, shortname, fullname, empName) {
  if (!id && !shortname && !fullname && !empName) return '—';

  if (empName) {
    return id ? `[${id}] ${empName}` : empName;
  }

  let label = '';
  if (shortname && fullname && String(shortname).trim() !== String(fullname).trim()) {
    label = `${shortname} | ${fullname}`;
  } else {
    label = shortname || fullname || '';
  }

  if (id && label) {
    return `[${id}] ${label}`;
  }
  if (label) return label;

  if (id) {
    if (typeof resolveLookupValue === 'function') {
      const resolved = resolveLookupValue('payment', 'counter_party', String(id));
      if (resolved && resolved !== String(id) && !resolved.includes('Counter party')) {
        return `[${id}] ${resolved.replace(/^(Company|Employee)\s*\|\s*/, '')}`;
      }
    }
    return `[${id}]`;
  }
  return '—';
}

function wlSvgIcon(name, color = '#64748B', size = 18) {
  const icons = {
    cases: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    briefcase: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    service: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    receipt: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path><path d="M16 8H8"></path><path d="M16 12H8"></path><path d="M12 16H8"></path></svg>`,
    wallet: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>`,
    payment: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
    cart: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    task: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    groups: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    assignment: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="15" x2="16" y2="15"></line></svg>`,
    outbox: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    chevron_down: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    chevron_up: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="18 15 12 9 6 15"></polyline></svg>`
  };
  return icons[name] || icons.briefcase;
}

function wlTimeAgo(dateStr) {
  if (!dateStr) return typeof t === 'function' ? t('wl.no_activity', 'Chưa có hoạt động') : 'Chưa có hoạt động';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return typeof t === 'function' ? t('wl.just_now', 'Vừa xong') : 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} ${typeof t === 'function' ? t('wl.minutes_ago', 'phút trước') : 'phút trước'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${typeof t === 'function' ? t('wl.hours_ago', 'giờ trước') : 'giờ trước'}`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ${typeof t === 'function' ? t('wl.days_ago', 'ngày trước') : 'ngày trước'}`;
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function wlGetInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function wlGetAvatarBg(name) {
  const colors = [
    'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    'linear-gradient(135deg, #10B981, #047857)',
    'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    'linear-gradient(135deg, #F59E0B, #B45309)',
    'linear-gradient(135deg, #EC4899, #BE185D)',
    'linear-gradient(135deg, #06B6D4, #0E7490)',
    'linear-gradient(135deg, #6366F1, #4338CA)'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Visual SVG Donut Chart Component
 * Renders crisp, responsive donut charts with percentage or total in center
 */
function wlRenderDonutChart(slices, size = 100, strokeWidth = 12, centerText = '') {
  const total = slices.reduce((sum, s) => sum + (s.value || 0), 0);
  if (total === 0) {
    return `
      <div style="width:${size}px; height:${size}px; border-radius:50%; border:3px dashed #E2E8F0; display:flex; align-items:center; justify-content:center; color:#94A3B8; font-size:10px;">
        0
      </div>
    `;
  }
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const circles = slices.map(s => {
    if (!s.value || s.value <= 0) return '';
    const ratio = s.value / total;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += ratio;

    return `
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="transparent"
        stroke="${s.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        style="transition: all 0.3s ease;">
        <title>${escapeHTML(s.label)}: ${wlFormatNumber(s.value)} (${Math.round(ratio * 100)}%)</title>
      </circle>
    `;
  }).join('');

  return `
    <div style="position:relative; width:${size}px; height:${size}px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
      <svg width="${size}" height="${size}" style="transform: rotate(-90deg);">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="#F1F5F9" stroke-width="${strokeWidth}"></circle>
        ${circles}
      </svg>
      <div style="position:absolute; text-align:center; font-weight:700; font-size:${size > 90 ? '13px' : '11px'}; color:#0F172A; line-height:1.1;">
        ${centerText || Math.round(((slices[0]?.value || 0) / total) * 100) + '%'}
      </div>
    </div>
  `;
}

/**
 * Main View Loader: loadWorkloadDashboardView
 */
window.loadWorkloadDashboardView = async function(containerId = 'content') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isSuperAdmin = window.authUser && window.authUser.role && window.authUser.role.toUpperCase() === 'SUPER ADMIN';
  if (!isSuperAdmin) {
    if (window.userPermissionsMap && window.userPermissionsMap['workload_report'] === false) {
      container.innerHTML = `
        <div style="padding:40px; text-align:center; color:#6B7280;">
          <span class="material-symbols-rounded" style="font-size:48px; color:#EF4444;">lock</span>
          <h2 style="margin:12px 0 6px; color:#1F2937;">${t('wl.access_denied_title', 'Quyền truy cập bị giới hạn')}</h2>
          <p>${t('wl.access_denied_desc', 'Chỉ có Super Admin mới có quyền xem Báo cáo Workload & Hoạt động toàn hệ thống.')}</p>
        </div>
      `;
      return;
    }
  }

  // Render Shell
  container.innerHTML = `
    <div class="workload-dashboard-root" id="workload-dashboard-root" style="padding: 16px 20px 40px; max-width: 1600px; margin: 0 auto;">
      <!-- Header Card -->
      <div class="wl-header-card" style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; padding:14px 18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:8px; background:linear-gradient(135deg, #1D4ED8, #3B82F6); color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(29, 78, 216, 0.2);">
                <span class="material-symbols-rounded" style="font-size:20px;">monitoring</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h2 style="font-size:17px; font-weight:700; color:#111827; margin:0;">${t('wl.header_title', 'Báo Cáo Năng Suất & Workload Nhân Sự')}</h2>
                <span style="background:rgba(29, 78, 216, 0.08); color:#1D4ED8; font-size:11px; font-weight:600; padding:2px 7px; border-radius:10px; border:1px solid rgba(29, 78, 216, 0.15); display:inline-flex; align-items:center; gap:3px;">
                  <span class="material-symbols-rounded" style="font-size:13px;">shield_person</span> Super Admin
                </span>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <!-- Time Range Buttons -->
            <div class="wl-btn-group" style="display:flex; background:#F3F4F6; padding:3px; border-radius:8px; gap:2px;">
              <button class="wl-time-btn ${workloadState.timeRange === 'today' ? 'active' : ''}" onclick="wlSetTimeRange('today')">${t('wl.time_today', 'Hôm nay')}</button>
              <button class="wl-time-btn ${workloadState.timeRange === '7d' ? 'active' : ''}" onclick="wlSetTimeRange('7d')">${t('wl.time_7d', '7 ngày qua')}</button>
              <button class="wl-time-btn ${workloadState.timeRange === '30d' ? 'active' : ''}" onclick="wlSetTimeRange('30d')">${t('wl.time_30d', '30 ngày qua')}</button>
              <button class="wl-time-btn ${workloadState.timeRange === 'this_month' ? 'active' : ''}" onclick="wlSetTimeRange('this_month')">${t('wl.time_this_month', 'Tháng này')}</button>
              <button class="wl-time-btn ${workloadState.timeRange === 'all' ? 'active' : ''}" onclick="wlSetTimeRange('all')">${t('wl.time_all', 'Tất cả')}</button>
            </div>

            <!-- Department Filter -->
            <select id="wl-dept-filter" onchange="wlSetDeptFilter(this.value)" style="height:32px; font-size:12px; border:1px solid #D1D5DB; border-radius:6px; padding:0 10px; background:#fff; color:#374151; cursor:pointer;">
              <option value="all">${t('wl.all_departments', 'Tất cả phòng ban')}</option>
            </select>

            <!-- Refresh Button -->
            <button class="btn btn-sm" onclick="wlFetchData(true)" title="${t('wl.refresh_tooltip', 'Làm mới dữ liệu')}" style="height:32px; padding:0 10px; background:#fff; border:1px solid #D1D5DB; border-radius:6px; color:#374151; cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
              <span class="material-symbols-rounded" id="wl-refresh-icon" style="font-size:16px;">refresh</span>
              <span>${t('wl.refresh_btn', 'Làm mới')}</span>
            </button>

            <!-- Export Button -->
            <button class="btn btn-sm" onclick="wlExportExcel()" title="${t('wl.export_tooltip', 'Xuất báo cáo Excel / CSV')}" style="height:32px; padding:0 12px; background:#10B981; border:none; border-radius:6px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px; font-weight:500;">
              <span class="material-symbols-rounded" style="font-size:16px;">download</span>
              <span>${t('wl.export_excel', 'Xuất Excel')}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div id="wl-kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:18px;">
        ${wlRenderSkeletonKpis()}
      </div>

      <!-- Opportunity Financial Gauge Card (Rendered only in Opportunity Perspective) -->
      <div id="wl-opp-financial-gauge" style="display:none; margin-bottom:18px;"></div>

      <!-- Perspective Switcher & Search Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #E5E7EB; padding-bottom:12px; flex-wrap:wrap; gap:12px;">
        <!-- Clean Segment Buttons (Request vs Opportunity) -->
        <div class="wl-perspective-group" style="display:inline-flex; background:#F1F5F9; padding:3px; border-radius:8px; gap:2px; border:1px solid #E2E8F0;">
          <button class="wl-perspective-btn ${workloadState.perspective === 'request' ? 'active' : ''}" onclick="wlSetPerspective('request')" style="border:none; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s ease;">
            <span class="material-symbols-rounded" style="font-size:16px;">assignment</span>
            <span>${t('wl.source_request', 'Yêu Cầu & Quy Trình')}</span>
          </button>
          <button class="wl-perspective-btn ${workloadState.perspective === 'opportunity' ? 'active' : ''}" onclick="wlSetPerspective('opportunity')" style="border:none; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s ease;">
            <span class="material-symbols-rounded" style="font-size:16px; color:#D97706;">cases</span>
            <span>${t('wl.source_opportunity', 'Cơ Hội Bán Hàng')}</span>
          </button>
        </div>

        <!-- Quick Search in Table -->
        <div style="position:relative; width:280px;">
          <input type="text" id="wl-search-input" placeholder="${t('wl.search_placeholder', 'Tìm nhân sự, email, chức vụ...')}"
            oninput="wlOnSearch(this.value)"
            style="width:100%; height:34px; border:1px solid #D1D5DB; border-radius:20px; padding:0 12px 0 34px; font-size:12px; background:#fff; color:#111827; outline:none;" />
          <span class="material-symbols-rounded" style="position:absolute; left:10px; top:8px; font-size:17px; color:#9CA3AF;">search</span>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div id="wl-tab-content">
        <div style="padding:60px 0; text-align:center; color:#9CA3AF;">
          <div class="spinner" style="margin:0 auto 12px; width:28px; height:28px; border:3px solid #E5E7EB; border-top-color:#1D4ED8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
          <div>${t('wl.loading_data', 'Đang tổng hợp dữ liệu năng suất và khối lượng công việc...')}</div>
        </div>
      </div>
    </div>

    <!-- Modals Container -->
    <div id="wl-modal-container"></div>
  `;

  wlInjectStyles();
  await wlFetchData();
};

function wlInjectStyles() {
  if (document.getElementById('wl-dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'wl-dashboard-styles';
  style.textContent = `
    .wl-time-btn {
      border: none;
      background: transparent;
      font-size: 12px;
      font-weight: 500;
      color: #4B5563;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .wl-time-btn.active {
      background: #FFFFFF;
      color: #1D4ED8;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    .wl-perspective-btn {
      background: transparent;
      color: #4B5563;
    }
    .wl-perspective-btn.active {
      background: #FFFFFF;
      color: #1D4ED8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .wl-kpi-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .wl-kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .wl-table-container {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      overflow-x: auto;
      overflow-y: auto;
      max-height: calc(100vh - 280px);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      position: relative;
    }
    .wl-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12px;
    }
    .wl-table th {
      background: #F9FAFB;
      color: #374151;
      font-weight: 600;
      text-align: left;
      padding: 11px 12px;
      border-bottom: 2px solid #E5E7EB;
      white-space: nowrap;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    .wl-table th.sortable {
      cursor: pointer;
    }
    .wl-table th.sortable:hover {
      background: #F3F4F6;
      color: #111827;
    }
    .wl-table td {
      padding: 12px;
      border-bottom: 1px solid #F3F4F6;
      color: #1F2937;
      vertical-align: middle;
    }
    .wl-table tr:hover td {
      background: #F8FAFC;
    }
    .wl-stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .wl-sub-tab-btn {
      border: none;
      background: transparent;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      cursor: pointer;
    }
    .wl-sub-tab-btn.active {
      background: #EFF6FF;
      color: #1D4ED8;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function wlRenderSkeletonKpis() {
  return [1, 2, 3, 4].map(() => `
    <div class="wl-kpi-card">
      <div style="width:42px; height:42px; border-radius:10px; background:#F3F4F6;"></div>
      <div style="flex:1;">
        <div style="width:60px; height:12px; background:#F3F4F6; border-radius:4px; margin-bottom:6px;"></div>
        <div style="width:100px; height:20px; background:#E5E7EB; border-radius:4px;"></div>
      </div>
    </div>
  `).join('');
}

window.wlFetchData = async function(forceRefresh = false) {
  const refreshIcon = document.getElementById('wl-refresh-icon');
  if (refreshIcon) refreshIcon.style.animation = 'spin 0.8s linear infinite';

  // Instant render from memory cache to eliminate lag
  if (workloadState.data && !forceRefresh) {
    wlUpdateDeptDropdown(workloadState.data.departments);
    wlRenderKpiCards();
    wlRenderFinancialGaugeCard();
    wlRenderMainTable();
  }

  try {
    const params = new URLSearchParams({
      time_range: workloadState.timeRange,
      department_id: workloadState.departmentId
    });
    if (forceRefresh) params.append('refresh', '1');

    const res = await apiGet(`/workload/overview?${params.toString()}`);
    if (res && res.summary) {
      workloadState.data = res;
      wlUpdateDeptDropdown(res.departments);
      wlRenderKpiCards();
      wlRenderFinancialGaugeCard();
      wlRenderMainTable();
    }
  } catch (err) {
    console.error('[Workload] Failed to fetch data:', err);
    const content = document.getElementById('wl-tab-content');
    if (content) {
      content.innerHTML = `
        <div style="padding:40px; text-align:center; color:#EF4444;">
          <span class="material-symbols-rounded" style="font-size:36px;">error</span>
          <p style="margin-top:8px;">${t('wl.error_loading', 'Không thể tải dữ liệu báo cáo')}: ${err.message || 'Lỗi kết nối'}</p>
          <button class="btn btn-sm btn-secondary" onclick="wlFetchData(true)">${t('wl.retry_btn', 'Thử lại')}</button>
        </div>
      `;
    }
  } finally {
    if (refreshIcon) refreshIcon.style.animation = '';
  }
};

function wlUpdateDeptDropdown(depts) {
  const select = document.getElementById('wl-dept-filter');
  if (!select || !Array.isArray(depts)) return;
  const currentVal = workloadState.departmentId;
  const defaultLabel = typeof t === 'function' ? t('wl.all_departments', 'Tất cả phòng ban') : 'Tất cả phòng ban';
  select.innerHTML = `<option value="all">${defaultLabel}</option>` +
    depts.map(d => `<option value="${escapeHTML(String(d.id))}" ${String(d.id) === String(currentVal) ? 'selected' : ''}>${escapeHTML(d.name || d.code || d.id)}</option>`).join('');
}

function wlRenderKpiCards() {
  const grid = document.getElementById('wl-kpi-grid');
  if (!grid || !workloadState.data) return;
  const summary = workloadState.data.summary || {};

  let cards = [];

  if (workloadState.perspective === 'request') {
    cards = [
      {
        title: t('wl.kpi_active_staff', 'Nhân Sự Hoạt Động'),
        val: `${wlFormatNumber(summary.active_employees_period)} <span style="font-size:13px; font-weight:normal; color:#6B7280;">/ ${summary.total_employees}</span>`,
        sub: `${Math.round((summary.active_employees_period / (summary.total_employees || 1)) * 100)}% ${t('wl.kpi_staff_active_pct', 'tổng nhân sự')}`,
        icon: 'engineering',
        color: '#1D4ED8',
        bg: 'rgba(29, 78, 216, 0.1)'
      },
      {
        title: t('wl.kpi_tasks_handled', 'Sản Lượng Xử Lý'),
        val: wlFormatNumber(summary.total_audit_actions),
        sub: t('wl.kpi_tasks_handled_sub', 'Tạo mới & cập nhật'),
        icon: 'task_alt',
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.1)'
      },
      {
        title: t('wl.kpi_active_requests', 'Yêu Cầu Đang Mở'),
        val: wlFormatNumber(summary.total_active_requests),
        sub: t('wl.kpi_active_requests_sub', 'Đang phụ trách'),
        icon: 'pending_actions',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.1)'
      },
      {
        title: t('wl.kpi_pending_approvals', 'Chờ Phê Duyệt'),
        val: wlFormatNumber(summary.total_pending_approvals),
        sub: t('wl.kpi_pending_approvals_sub', 'Cần xử lý'),
        icon: 'notification_important',
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.1)'
      }
    ];
  } else {
    // Opportunity Perspective
    cards = [
      {
        title: t('wl.kpi_opp_active_staff', 'Nhân Sự Phụ Trách'),
        val: `${wlFormatNumber(summary.active_employees_period)} <span style="font-size:13px; font-weight:normal; color:#6B7280;">/ ${summary.total_employees}</span>`,
        sub: `${summary.total_opportunities || 0} ${t('wl.total_opps_in_system', 'cơ hội')}`,
        icon: 'groups',
        color: '#1D4ED8',
        bg: 'rgba(29, 78, 216, 0.1)'
      },
      {
        title: t('wl.kpi_opp_pipeline', 'Cơ Hội Đang Theo Đuổi'),
        val: wlFormatNumber(summary.total_active_pipeline),
        sub: t('wl.kpi_opp_pipeline_sub', 'Pipeline'),
        icon: 'hourglass_top',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.1)'
      },
      {
        title: t('wl.kpi_opp_won', 'Cơ Hội Thành Công'),
        val: wlFormatNumber(summary.total_won_deals),
        sub: `${summary.total_lost_deals || 0} ${t('wl.lost_deals_sub', 'thất bại')}`,
        icon: 'verified',
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.1)'
      },
      {
        title: t('wl.kpi_opp_value', 'Giá Trị Pipeline'),
        val: wlFormatMoney(summary.total_pipeline_value),
        sub: `${t('wl.won_label', 'Đã chốt')}: ${wlFormatMoney(summary.total_won_value)}`,
        icon: 'monetization_on',
        color: '#8B5CF6',
        bg: 'rgba(139, 92, 246, 0.1)'
      }
    ];
  }

  grid.innerHTML = cards.map(c => `
    <div class="wl-kpi-card">
      <div style="width:44px; height:44px; border-radius:10px; background:${c.bg}; color:${c.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <span class="material-symbols-rounded" style="font-size:24px;">${c.icon}</span>
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:#6B7280; letter-spacing:0.5px;">${c.title}</div>
        <div style="font-size:20px; font-weight:700; color:#111827; margin:2px 0;">${c.val}</div>
        <div style="font-size:11px; color:#9CA3AF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.sub}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Financial Fulfillment Overview Chart (Top Gauge for Opportunity Mode)
 * Answers Requirement 2: Visual ratio chart for Revenue & Contract
 */
function wlRenderFinancialGaugeCard() {
  const container = document.getElementById('wl-opp-financial-gauge');
  if (!container || !workloadState.data) return;

  if (workloadState.perspective !== 'opportunity') {
    container.style.display = 'none';
    return;
  }

  const opps = workloadState.data.opportunities || [];
  const totalSellingContract = opps.reduce((sum, o) => sum + (o.selling_contract_val || o.contract_val || 0), 0);
  const totalIncomingPaid = opps.reduce((sum, o) => sum + (o.incoming_paid_val || o.paid_val || 0), 0);
  const totalRemainingCollect = Math.max(0, totalSellingContract - totalIncomingPaid);
  const sellingPaidPct = totalSellingContract > 0 ? Math.round((totalIncomingPaid / totalSellingContract) * 100) : (totalIncomingPaid > 0 ? 100 : 0);

  const totalBuyingContract = opps.reduce((sum, o) => sum + (o.buying_contract_val || 0), 0);
  const totalOutgoingPaid = opps.reduce((sum, o) => sum + (o.outgoing_paid_val || 0), 0);
  const totalRemainingDisburse = Math.max(0, totalBuyingContract - totalOutgoingPaid);
  const buyingPaidPct = totalBuyingContract > 0 ? Math.round((totalOutgoingPaid / totalBuyingContract) * 100) : (totalOutgoingPaid > 0 ? 100 : 0);

  const totalMargin = totalSellingContract - totalBuyingContract;
  const marginPct = totalSellingContract > 0 ? Math.round((totalMargin / totalSellingContract) * 100) : 0;

  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; padding:16px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.04); display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px; align-items:center;">
      
      <!-- 1. Bán Ra & Thu Hồi (Selling & Collection) -->
      <div style="display:flex; align-items:center; gap:14px; padding-right:12px; border-right:1px solid #F1F5F9;">
        ${wlRenderDonutChart([
          { label: t('wl.collected_paid', 'Đã thu'), value: totalIncomingPaid, color: '#10B981' },
          { label: t('wl.remaining_collect', 'Còn phải thu'), value: totalRemainingCollect, color: '#E2E8F0' }
        ], 68, 9, `${sellingPaidPct}%`)}
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; font-weight:700; color:#0F172A; display:flex; align-items:center; gap:6px;">
            <span style="font-size:9px; font-weight:700; text-transform:uppercase; background:#E0F2FE; color:#0369A1; padding:1px 6px; border-radius:4px;">${t('wl.selling', 'Bán ra')}</span>
            <span>${t('wl.financial_overview_selling', 'Bán Ra & Thu Hồi')}</span>
          </div>
          <div style="font-size:11px; color:#64748B; margin-top:3px;">
            ${t('wl.selling_contract', 'HĐ Bán')}: <strong style="color:#1E293B;">${wlFormatMoney(totalSellingContract)}</strong>
          </div>
          <div style="font-size:11px; color:#059669; font-weight:600; margin-top:1px;">
            ${t('wl.collected_paid', 'Đã thu')}: ${wlFormatMoney(totalIncomingPaid)} (${sellingPaidPct}%)
          </div>
        </div>
      </div>

      <!-- 2. Mua Vào & Chi Trả (Buying & Disbursement) -->
      <div style="display:flex; align-items:center; gap:14px; padding-right:12px; border-right:1px solid #F1F5F9;">
        ${wlRenderDonutChart([
          { label: t('wl.disbursed_paid', 'Đã chi'), value: totalOutgoingPaid, color: '#F59E0B' },
          { label: t('wl.remaining_disburse', 'Còn phải chi'), value: totalRemainingDisburse, color: '#E2E8F0' }
        ], 68, 9, `${buyingPaidPct}%`)}
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; font-weight:700; color:#0F172A; display:flex; align-items:center; gap:6px;">
            <span style="font-size:9px; font-weight:700; text-transform:uppercase; background:#FEF3C7; color:#92400E; padding:1px 6px; border-radius:4px;">${t('wl.buying', 'Mua vào')}</span>
            <span>${t('wl.financial_overview_buying', 'Mua Vào & Chi Trả')}</span>
          </div>
          <div style="font-size:11px; color:#64748B; margin-top:3px;">
            ${t('wl.buying_contract', 'HĐ Mua')}: <strong style="color:#1E293B;">${wlFormatMoney(totalBuyingContract)}</strong>
          </div>
          <div style="font-size:11px; color:#D97706; font-weight:600; margin-top:1px;">
            ${t('wl.disbursed_paid', 'Đã chi')}: ${wlFormatMoney(totalOutgoingPaid)} (${buyingPaidPct}%)
          </div>
        </div>
      </div>

      <!-- 3. Lợi Nhuận Gộp (Gross Margin) -->
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:48px; height:48px; border-radius:10px; background:#EFF6FF; color:#1D4ED8; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <span class="material-symbols-rounded" style="font-size:24px;">account_balance_wallet</span>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:#64748B; letter-spacing:0.5px;">
            ${t('wl.financial_overview_margin', 'Lợi Nhuận Gộp (Margin)')}
          </div>
          <div style="font-size:18px; font-weight:700; color:${totalMargin >= 0 ? '#10B981' : '#EF4444'}; margin:2px 0;">
            ${wlFormatMoney(totalMargin)}
          </div>
          <div style="font-size:11px; color:#64748B;">
            ${t('wl.gross_margin', 'Biên lợi nhuận')}: <strong style="color:#0F172A;">${marginPct}%</strong>
          </div>
        </div>
      </div>

    </div>
  `;
}

window.wlSetPerspective = function(mode) {
  workloadState.perspective = mode;
  workloadState.oppPage = 1;
  if (mode === 'request') {
    workloadState.sortCol = 'as_owner_active';
    workloadState.sortAsc = false;
  } else {
    workloadState.sortCol = 'create_date';
    workloadState.sortAsc = false;
  }

  document.querySelectorAll('.wl-perspective-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mode}'`));
  });

  wlRenderKpiCards();
  wlRenderFinancialGaugeCard();
  wlRenderMainTable();
};

window.wlSetTimeRange = function(range) {
  workloadState.timeRange = range;
  workloadState.oppPage = 1;
  document.querySelectorAll('.wl-time-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${range}'`));
  });
  wlFetchData();
};

window.wlSetDeptFilter = function(deptId) {
  workloadState.departmentId = deptId;
  workloadState.oppPage = 1;
  wlFetchData();
};

window.wlOnSearch = function(query) {
  workloadState.searchQuery = (query || '').toLowerCase().trim();
  workloadState.oppPage = 1;
  wlRenderMainTable();
};

window.wlChangeOppPage = function(page) {
  workloadState.oppPage = page;
  wlRenderMainTable();
};

window.wlChangeOppPageSize = function(size) {
  workloadState.oppPageSize = parseInt(size, 10);
  workloadState.oppPage = 1;
  wlRenderMainTable();
};

window.wlSortBy = function(col) {
  if (workloadState.sortCol === col) {
    workloadState.sortAsc = !workloadState.sortAsc;
  } else {
    workloadState.sortCol = col;
    workloadState.sortAsc = false;
  }
  wlRenderMainTable();
};

function wlSortIcon(col) {
  if (workloadState.sortCol !== col) {
    return '<span class="material-symbols-rounded" style="font-size:14px; color:#CBD5E1; vertical-align:middle; margin-left:2px;">unfold_more</span>';
  }
  return workloadState.sortAsc
    ? '<span class="material-symbols-rounded" style="font-size:14px; color:#1D4ED8; vertical-align:middle; margin-left:2px; font-weight:bold;">arrow_upward</span>'
    : '<span class="material-symbols-rounded" style="font-size:14px; color:#1D4ED8; vertical-align:middle; margin-left:2px; font-weight:bold;">arrow_downward</span>';
}

/**
 * Render Core Table: Request Matrix OR Opportunity-Centric View
 */
function wlRenderMainTable() {
  const container = document.getElementById('wl-tab-content');
  if (!container || !workloadState.data) return;

  if (workloadState.perspective === 'request') {
    wlRenderRequestTable(container);
  } else {
    wlRenderOpportunityTable(container);
  }
}

/**
 * 1. REQUEST PERSPECTIVE TABLE (Cleaned without clutter)
 */
function wlRenderRequestTable(container) {
  let employees = [...(workloadState.data.employees || [])];

  if (workloadState.searchQuery) {
    const q = workloadState.searchQuery;
    employees = employees.filter(e =>
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.position || '').toLowerCase().includes(q) ||
      (e.department_name || '').toLowerCase().includes(q)
    );
  }

  const col = workloadState.sortCol;
  const asc = workloadState.sortAsc;
  employees.sort((a, b) => {
    let valA = a[col] ?? 0;
    let valB = b[col] ?? 0;
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });

  const maxAudit = Math.max(...employees.map(e => e.audit_actions || 0), 1);

  if (employees.length === 0) {
    container.innerHTML = `
      <div style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:40px; text-align:center; color:#6B7280;">
        <span class="material-symbols-rounded" style="font-size:36px; color:#9CA3AF;">person_search</span>
        <div style="margin-top:8px; font-weight:500;">${t('wl.no_matching_staff', 'Không tìm thấy nhân sự phù hợp')}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div class="wl-table-container" style="border:none; border-radius:0;">
        <table class="wl-table">
          <thead>
            <tr>
              <th style="min-width:220px;" class="sortable" onclick="wlSortBy('full_name')">${t('wl.col_employee', 'Nhân viên')} ${wlSortIcon('full_name')}</th>
              <th style="min-width:180px;" class="sortable" onclick="wlSortBy('as_owner_active')">${t('wl.col_sr_owner', 'Chủ trì Yêu cầu (SR Owner)')} ${wlSortIcon('as_owner_active')}</th>
              <th style="min-width:180px;" class="sortable" onclick="wlSortBy('pending_my_approval')">${t('wl.col_approvals', 'Kết quả Phê duyệt')} ${wlSortIcon('pending_my_approval')}</th>
              <th style="text-align:center;" class="sortable" onclick="wlSortBy('as_policy_lead')">${t('wl.col_policy_lead', 'Chủ trì Quy trình')} ${wlSortIcon('as_policy_lead')}</th>
              <th style="text-align:center;" class="sortable" onclick="wlSortBy('as_requester')">${t('wl.col_requester', 'Đã khởi tạo')} ${wlSortIcon('as_requester')}</th>
              <th style="min-width:190px;" class="sortable" onclick="wlSortBy('audit_actions')">${t('wl.col_tasks_volume', 'Sản lượng Xử lý')} ${wlSortIcon('audit_actions')}</th>
              <th style="min-width:190px;">${t('wl.col_top_modules', 'Mảng nghiệp vụ thực hiện chính')}</th>
              <th style="min-width:130px;" class="sortable" onclick="wlSortBy('last_active')">${t('wl.col_last_active', 'Thời điểm gần nhất')} ${wlSortIcon('last_active')}</th>
              <th style="text-align:center; width:65px;">${t('wl.col_action', 'Chi tiết')}</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => wlRenderRequestRow(e, maxAudit)).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:10px 18px; background:#F9FAFB; border-top:1px solid #E5E7EB; font-size:12px; color:#6B7280; display:flex; justify-content:space-between; align-items:center;">
        <span>${t('wl.showing_staff_count', 'Hiển thị')} <strong>${employees.length}</strong> ${t('wl.staff_members', 'nhân sự')}</span>
      </div>
    </div>
  `;
}

function wlRenderRequestRow(e, maxAudit) {
  const pct = Math.min(100, Math.round(((e.audit_actions || 0) / maxAudit) * 100));
  const initials = wlGetInitials(e.full_name);
  const avatarBg = wlGetAvatarBg(e.full_name);
  const tableEntries = Object.entries(e.table_actions || {}).sort((a, b) => b[1].total - a[1].total).slice(0, 3);

  return `
    <tr style="cursor:pointer;" onclick="wlOpenEmployeeModal('${escapeHTML(e.employee_id)}')">
      <!-- Employee Info -->
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:36px; height:36px; border-radius:50%; background:${avatarBg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px; flex-shrink:0;">
            ${e.avatar ? `<img src="${escapeHTML(e.avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.remove()" />` : initials}
          </div>
          <div style="min-width:0;">
            <div style="font-weight:600; color:#111827; display:flex; align-items:center; gap:6px;">
              <span>${escapeHTML(e.full_name || 'N/A')}</span>
              ${e.role === 'Super Admin' ? '<span style="font-size:9px; background:#FEF3C7; color:#92400E; padding:1px 5px; border-radius:4px; font-weight:600;">SUPER ADMIN</span>' : ''}
            </div>
            <div style="font-size:11px; color:#6B7280; display:flex; gap:6px; align-items:center; margin-top:2px;">
              <span style="background:#F3F4F6; padding:1px 5px; border-radius:4px; font-size:10px;">${escapeHTML(e.department_name || 'N/A')}</span>
              ${e.position ? `<span style="color:#9CA3AF;">•</span> <span>${escapeHTML(e.position)}</span>` : ''}
            </div>
          </div>
        </div>
      </td>

      <!-- SR Owner Execution -->
      <td>
        ${e.as_owner_active > 0 ? `
          <div style="display:inline-flex; align-items:center; gap:4px; background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11px;">
            <span class="material-symbols-rounded" style="font-size:14px; color:#10B981;">timelapse</span>
            <span>${wlFormatNumber(e.as_owner_active)} ${t('wl.in_progress', 'đang xử lý')}</span>
          </div>
        ` : `
          <span style="color:#9CA3AF; font-size:11px;">0</span>
        `}
        <div style="font-size:11px; color:#64748B; margin-top:3px;">
          ${wlFormatNumber(e.as_owner_completed)} / ${wlFormatNumber(e.as_owner)} ${t('wl.completed', 'xong')}
        </div>
      </td>

      <!-- Approvals Handled & Backlog -->
      <td>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          ${e.pending_my_approval > 0 ? `
            <span class="wl-stat-pill" style="background:#FEF2F2; color:#991B1B; border:1px solid #FECACA;">
              <span class="material-symbols-rounded" style="font-size:13px; color:#EF4444;">pending</span>
              <span><strong>${wlFormatNumber(e.pending_my_approval)}</strong> ${t('wl.pending_now', 'chờ duyệt')}</span>
            </span>
          ` : `
            <span class="wl-stat-pill" style="background:#F0FDF4; color:#166534;">
              <span class="material-symbols-rounded" style="font-size:13px;">check_circle</span>
              <span>0 ${t('wl.pending_now', 'chờ duyệt')}</span>
            </span>
          `}
          <span style="font-size:11px; color:#374151; font-weight:500;">
            ${t('wl.approved_cnt', 'Đã duyệt')}: <strong>${wlFormatNumber(e.approvals_approved)}</strong>
          </span>
        </div>
      </td>

      <!-- Policy Lead -->
      <td style="text-align:center;">
        <span class="wl-stat-pill" style="background:${e.as_policy_lead > 0 ? '#F5F3FF' : '#F9FAFB'}; color:${e.as_policy_lead > 0 ? '#7C3AED' : '#9CA3AF'};">
          ${wlFormatNumber(e.as_policy_lead)}
        </span>
      </td>

      <!-- Requester -->
      <td style="text-align:center;">
        <span class="wl-stat-pill" style="background:${e.as_requester > 0 ? '#F0F9FF' : '#F9FAFB'}; color:${e.as_requester > 0 ? '#0284C7' : '#9CA3AF'};">
          ${wlFormatNumber(e.as_requester)}
        </span>
      </td>

      <!-- Task Volume Handled in Period -->
      <td>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
          <span style="font-weight:700; color:#111827; font-size:13px;">
            ${wlFormatNumber(e.audit_actions)} <span style="font-size:10px; font-weight:normal; color:#6B7280;">${t('wl.tasks_unit', 'tác vụ')}</span>
          </span>
          <span style="color:#9CA3AF; font-size:10px;">${pct}%</span>
        </div>
        <div style="height:5px; background:#E5E7EB; border-radius:3px; overflow:hidden; margin-bottom:3px;">
          <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #3B82F6, #1D4ED8); border-radius:3px;"></div>
        </div>
        <div style="font-size:10px; color:#64748B;">
          ${t('wl.created_cnt', 'Tạo')}: <strong>${wlFormatNumber(e.tasks_created)}</strong> • ${t('wl.updated_cnt', 'Cập nhật')}: <strong>${wlFormatNumber(e.tasks_updated)}</strong>
        </div>
      </td>

      <!-- Top Handled Modules -->
      <td>
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          ${tableEntries.length === 0 ? `<span style="color:#9CA3AF; font-size:11px;">${t('wl.no_tasks_in_period', 'Không có trong kỳ')}</span>` : tableEntries.map(([tbl, data]) => `
            <span style="display:inline-flex; align-items:center; gap:3px; font-size:10px; padding:2px 6px; border-radius:4px; background:#F1F5F9; border:1px solid #E2E8F0; color:#1E293B;" title="${escapeHTML(tbl)}: ${data.total} ${t('wl.tasks_unit', 'tác vụ')}">
              <span>${escapeHTML(tbl)}:</span> <strong>${wlFormatNumber(data.total)}</strong>
            </span>
          `).join('')}
        </div>
      </td>

      <!-- Last Active Time -->
      <td style="font-size:11px; color:#4B5563;">
        ${wlTimeAgo(e.last_active)}
      </td>

      <!-- Action Button -->
      <td style="text-align:center;" onclick="event.stopPropagation(); wlOpenEmployeeModal('${escapeHTML(e.employee_id)}')">
        <button class="btn btn-sm" style="background:#EFF6FF; border:none; color:#1D4ED8; width:28px; height:28px; border-radius:6px; cursor:pointer; padding:0; display:inline-flex; align-items:center; justify-content:center;" title="${t('wl.view_dossier', 'Xem hồ sơ chi tiết')}">
          <span class="material-symbols-rounded" style="font-size:16px;">visibility</span>
        </button>
      </td>
    </tr>
  `;
}

/**
 * 2. OPPORTUNITY-CENTRIC TABLE (With Visual Financial Chart / Progress Gauges)
 * Answers Requirement 2 & 5: Visual chart for Revenue & Contract
 */
function wlRenderOpportunityTable(container) {
  let opps = [...(workloadState.data.opportunities || [])];

  if (workloadState.searchQuery) {
    const q = workloadState.searchQuery;
    opps = opps.filter(o =>
      String(o.project_id || '').toLowerCase().includes(q) ||
      (o.project_name || '').toLowerCase().includes(q) ||
      (o.sale_lead_name || '').toLowerCase().includes(q) ||
      (o.department_name || '').toLowerCase().includes(q)
    );
  }

  const col = workloadState.sortCol;
  const asc = workloadState.sortAsc;
  opps.sort((a, b) => {
    let valA = a[col] ?? 0;
    let valB = b[col] ?? 0;
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });

  if (opps.length === 0) {
    container.innerHTML = `
      <div style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:40px; text-align:center; color:#6B7280;">
        <span class="material-symbols-rounded" style="font-size:36px; color:#9CA3AF;">cases</span>
        <div style="margin-top:8px; font-weight:500;">${t('wl.no_matching_staff', 'Không tìm thấy cơ hội phù hợp')}</div>
      </div>
    `;
    return;
  }

  const totalItems = opps.length;
  const pageSize = workloadState.oppPageSize || 25;
  const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize === -1 ? totalItems || 1 : pageSize)));
  const currentPage = Math.min(Math.max(1, workloadState.oppPage || 1), totalPages);
  workloadState.oppPage = currentPage;

  const startIdx = (currentPage - 1) * (pageSize === -1 ? totalItems : pageSize);
  const endIdx = pageSize === -1 ? totalItems : Math.min(startIdx + pageSize, totalItems);
  const paginatedOpps = pageSize === -1 ? opps : opps.slice(startIdx, endIdx);

  container.innerHTML = `
    <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div class="wl-table-container" style="border:none; border-radius:0;">
        <table class="wl-table">
          <thead>
            <tr>
              <th style="min-width:240px;" class="sortable" onclick="wlSortBy('project_name')">${t('wl.col_opp_title', 'Cơ Hội / Dự Án')} ${wlSortIcon('project_name')}</th>
              <th style="min-width:120px;" class="sortable" onclick="wlSortBy('status')">${t('wl.col_opp_status', 'Trạng Thái')} ${wlSortIcon('status')}</th>
              <th style="min-width:180px;" class="sortable" onclick="wlSortBy('sale_lead_name')">${t('wl.col_sale_lead', 'Chủ Trì (Sale Lead)')} ${wlSortIcon('sale_lead_name')}</th>
              <th style="min-width:240px;" class="sortable" onclick="wlSortBy('contract_val')">${t('wl.col_values', 'Doanh Thu & Hợp Đồng')} ${wlSortIcon('contract_val')}</th>
              <th style="text-align:center; min-width:110px;" class="sortable" onclick="wlSortBy('team_count')">${t('wl.col_team_members', 'Nhân Sự')} ${wlSortIcon('team_count')}</th>
              <th style="text-align:center; min-width:110px;" class="sortable" onclick="wlSortBy('requests_count')">${t('wl.col_linked_requests', 'Yêu Cầu')} ${wlSortIcon('requests_count')}</th>
              <th style="min-width:180px;" class="sortable" onclick="wlSortBy('tasks_count')">${t('wl.col_task_progress', 'Tiến Độ Nhiệm Vụ')} ${wlSortIcon('tasks_count')}</th>
              <th style="min-width:110px;" class="sortable" onclick="wlSortBy('create_date')">${t('wl.col_req_created', 'Ngày tạo')} ${wlSortIcon('create_date')}</th>
              <th style="text-align:center; width:65px;">${t('wl.col_action', 'Chi tiết')}</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedOpps.map(o => wlRenderOpportunityRow(o)).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:10px 18px; background:#F9FAFB; border-top:1px solid #E5E7EB; font-size:12px; color:#6B7280; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${t('wl.showing_staff_count', 'Hiển thị')} <strong>${totalItems === 0 ? 0 : startIdx + 1} - ${endIdx}</strong> / <strong>${totalItems}</strong> ${t('wl.tab_opportunities', 'cơ hội')}</span>
          <select onchange="wlChangeOppPageSize(this.value)" style="font-size:11px; padding:2px 6px; border:1px solid #D1D5DB; border-radius:4px; background:#fff; color:#374151; cursor:pointer;">
            <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 ${t('wl.page_size_unit', '/ trang')}</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 ${t('wl.page_size_unit', '/ trang')}</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 ${t('wl.page_size_unit', '/ trang')}</option>
            <option value="-1" ${pageSize === -1 ? 'selected' : ''}>${t('wl.all_page_size', 'Tất cả')}</option>
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <button class="btn btn-sm" onclick="wlChangeOppPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed; padding:2px 8px;"' : 'style="cursor:pointer; padding:2px 8px;"'}>
            ‹ ${t('wl.prev_page', 'Trang trước')}
          </button>
          <span style="font-weight:600; color:#374151; padding:0 6px;">${currentPage} / ${totalPages}</span>
          <button class="btn btn-sm" onclick="wlChangeOppPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed; padding:2px 8px;"' : 'style="cursor:pointer; padding:2px 8px;"'}>
            ${t('wl.next_page', 'Trang sau')} ›
          </button>
        </div>
      </div>
    </div>
  `;
}

function wlRenderOpportunityRow(o) {
  const statusInfo = o.status_info || { vi: 'N/A', en: 'N/A', color: '#64748B' };
  const taskPct = o.tasks_count > 0 ? Math.round((o.tasks_completed_count / o.tasks_count) * 100) : 0;
  const baseCurr = wlGetBaseCurrency();
  
  // Selling side calculations (strictly base currency)
  const sVal = o.selling_contract_val || o.contract_val || 0;
  const inPaid = o.incoming_paid_val || o.paid_val || 0;
  const inRem = Math.max(0, sVal - inPaid);
  const inPct = sVal > 0 ? Math.min(100, Math.round((inPaid / sVal) * 100)) : (inPaid > 0 ? 100 : 0);

  // Buying side calculations (strictly base currency)
  const bVal = o.buying_contract_val || 0;
  const outPaid = o.outgoing_paid_val || 0;
  const outRem = Math.max(0, bVal - outPaid);
  const outPct = bVal > 0 ? Math.min(100, Math.round((outPaid / bVal) * 100)) : (outPaid > 0 ? 100 : 0);
  const hasBuying = bVal > 0 || outPaid > 0;
  const marginVal = (sVal > 0 ? sVal : 0) - bVal;

  return `
    <tr style="cursor:pointer;" onclick="wlOpenOpportunityModal('${escapeHTML(String(o.project_id))}')">
      <!-- Opportunity Project ID & Name -->
      <td>
        <div style="font-weight:700; color:#1D4ED8; font-size:13px;">
          #${escapeHTML(String(o.project_id))}
        </div>
        <div style="font-weight:600; color:#111827; margin-top:2px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHTML(o.project_name || 'N/A')}
        </div>
      </td>

      <!-- Status badge with catalog color -->
      <td>
        ${wlGetOppStatusBadge(statusInfo, o.status)}
      </td>

      <!-- Sale Lead -->
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:28px; height:28px; border-radius:50%; background:${wlGetAvatarBg(o.sale_lead_name)}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:10px; flex-shrink:0;">
            ${o.sale_lead_avatar ? `<img src="${escapeHTML(o.sale_lead_avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.remove()" />` : wlGetInitials(o.sale_lead_name)}
          </div>
          <div>
            <div style="font-weight:600; color:#111827; font-size:12px;">${escapeHTML(o.sale_lead_name || 'N/A')}</div>
            <div style="font-size:10px; color:#6B7280;">${escapeHTML(o.department_name || '')}</div>
          </div>
        </div>
      </td>

      <!-- Financial Values: Selling & Buying (Executive Overview) -->
      <td style="min-width:230px;">
        <!-- Selling line -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:11px; margin-bottom:2px;">
            <span style="font-weight:700; color:#1E293B; display:flex; align-items:center; gap:4px;">
              <span style="font-size:9px; font-weight:700; text-transform:uppercase; background:#E0F2FE; color:#0369A1; padding:1px 5px; border-radius:4px;">${t('wl.selling', 'Bán')}</span>
              <span>${wlFormatMoney(sVal, baseCurr)}</span>
            </span>
            <span style="font-weight:700; color:${inPct >= 100 ? '#059669' : '#1D4ED8'}; font-size:10px;">${inPct}% ${t('wl.collected_paid', 'thu')}</span>
          </div>
          <div style="height:5px; background:#E2E8F0; border-radius:2px; overflow:hidden; display:flex; margin-bottom:3px;">
            <div style="height:100%; width:${inPct}%; background:linear-gradient(90deg, #10B981, #059669); border-radius:2px;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748B;">
            <span>${t('wl.collected_paid', 'Đã thu')}: <strong style="color:#059669;">${wlFormatMoney(inPaid, baseCurr)}</strong></span>
            ${sVal > inPaid ? `<span>${t('wl.remaining_collect', 'Còn')}: ${wlFormatMoney(inRem, baseCurr)}</span>` : ''}
          </div>
        </div>

        ${hasBuying ? `
          <!-- Buying line -->
          <div style="margin-top:6px; padding-top:4px; border-top:1px dashed #E2E8F0;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:11px; margin-bottom:2px;">
              <span style="font-weight:700; color:#475569; display:flex; align-items:center; gap:4px;">
                <span style="font-size:9px; font-weight:700; text-transform:uppercase; background:#FEF3C7; color:#92400E; padding:1px 5px; border-radius:4px;">${t('wl.buying', 'Mua')}</span>
                <span>${wlFormatMoney(bVal, baseCurr)}</span>
              </span>
              <span style="font-weight:700; color:#D97706; font-size:10px;">${outPct}% ${t('wl.disbursed_paid', 'chi')}</span>
            </div>
            <div style="height:5px; background:#E2E8F0; border-radius:2px; overflow:hidden; display:flex; margin-bottom:3px;">
              <div style="height:100%; width:${outPct}%; background:linear-gradient(90deg, #F59E0B, #D97706); border-radius:2px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748B;">
              <span>${t('wl.disbursed_paid', 'Đã chi')}: <strong style="color:#D97706;">${wlFormatMoney(outPaid, baseCurr)}</strong></span>
              ${sVal > 0 && bVal > 0 ? `
                <span style="font-weight:700; color:${marginVal >= 0 ? '#059669' : '#DC2626'};" title="${t('wl.gross_margin', 'Lợi nhuận gộp')}">
                  Margin: ${wlFormatMoney(marginVal, baseCurr)}
                </span>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </td>

      <!-- Team Members Count -->
      <td style="text-align:center;">
        <span class="wl-stat-pill" style="background:#EFF6FF; color:#1D4ED8;">
          <span class="material-symbols-rounded" style="font-size:13px;">group</span>
          <span>${o.team_count}</span>
        </span>
      </td>

      <!-- Related Requests Count -->
      <td style="text-align:center;">
        <span class="wl-stat-pill" style="background:${o.requests_count > 0 ? '#ECFDF5' : '#F9FAFB'}; color:${o.requests_count > 0 ? '#059669' : '#9CA3AF'};">
          <span class="material-symbols-rounded" style="font-size:13px;">assignment</span>
          <span>${o.requests_count}</span>
        </span>
      </td>

      <!-- Service Tasks Progress -->
      <td>
        ${o.tasks_count > 0 ? `
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
            <span style="font-weight:600; color:#111827;">${o.tasks_completed_count}/${o.tasks_count} ${t('wl.tasks_completed_rate', 'hoàn thành')}</span>
            <span style="font-weight:700; color:#059669;">${taskPct}%</span>
          </div>
          <div style="height:5px; background:#E5E7EB; border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${taskPct}%; background:#10B981; border-radius:3px;"></div>
          </div>
        ` : `
          <span style="color:#9CA3AF; font-size:11px;">${t('wl.no_tasks', 'Không có task')}</span>
        `}
      </td>

      <!-- Created Date -->
      <td style="font-size:11px; color:#64748B;">
        ${o.create_date ? new Date(o.create_date).toLocaleDateString('vi-VN') : '—'}
      </td>

      <!-- Action Button -->
      <td style="text-align:center;" onclick="event.stopPropagation(); wlOpenOpportunityModal('${escapeHTML(String(o.project_id))}')">
        <button class="btn btn-sm" style="background:#EFF6FF; border:none; color:#1D4ED8; width:28px; height:28px; border-radius:6px; cursor:pointer; padding:0; display:inline-flex; align-items:center; justify-content:center;" title="${t('wl.view_dossier', 'Xem hồ sơ chi tiết')}">
          <span class="material-symbols-rounded" style="font-size:16px;">visibility</span>
        </button>
      </td>
    </tr>
  `;
}

/**
 * 3. OPPORTUNITY DEEP-DIVE MODAL (With Visual Ratio Charts)
 * Fixes: open class + explicit display flex
 * Adds: Donut charts for financial fulfillment, tasks ratio, requests ratio
 */
window.wlOpenOpportunityModal = async function(oppId) {
  const container = document.getElementById('wl-modal-container');
  if (!container) return;

  // Use explicit styles to guarantee visibility
  container.innerHTML = `
    <div class="modal-overlay open" id="wl-modal-overlay" style="display:flex !important; position:fixed !important; inset:0 !important; z-index:99999 !important; background:rgba(15,23,42,0.75) !important; backdrop-filter:blur(6px) !important; align-items:center !important; justify-content:center !important;" onclick="wlCloseModal(event)">
      <div class="modal" style="max-width:1160px; width:95%; max-height:92vh; display:flex; flex-direction:column; border-radius:14px; overflow:hidden; background:#FFFFFF; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);" onclick="event.stopPropagation()">
        <div class="modal-header" style="padding:14px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div id="wl-opp-modal-header-title" style="display:flex; align-items:center; gap:10px; min-width:0; flex:1; margin-right:12px;">
            ${wlSvgIcon('briefcase', '#2563EB', 20)}
            <div style="font-weight:700; font-size:16px; color:#0F172A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${t('wl.modal_opp_title', 'Hồ Sơ Cơ Hội')} #${escapeHTML(oppId)}
            </div>
          </div>
          <button class="modal-close" onclick="wlCloseModal()" style="border:none; background:transparent; font-size:18px; cursor:pointer; color:#6B7280; padding:4px 8px; border-radius:6px; flex-shrink:0;">✕</button>
        </div>
        <div class="modal-body" id="wl-modal-body" style="padding:20px; overflow-y:auto; flex:1;">
          <div style="padding:40px; text-align:center; color:#9CA3AF;">
            <div class="spinner" style="margin:0 auto 10px; width:24px; height:24px; border:2px solid #E5E7EB; border-top-color:#1D4ED8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <div>${t('wl.loading_profile', 'Đang tải hồ sơ...')}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await apiGet(`/workload/opportunity/${encodeURIComponent(oppId)}`);
    const modalBody = document.getElementById('wl-modal-body');
    if (!modalBody) return;
    if (!res || !res.opportunity) {
      modalBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:#EF4444;">
          <span class="material-symbols-rounded" style="font-size:36px;">error</span>
          <p style="margin-top:8px;">${escapeHTML(res?.error || t('wl.error_loading', 'Không thể tải dữ liệu cơ hội'))}</p>
        </div>
      `;
      return;
    }

    const opp = res.opportunity;
    const team = res.team_breakdown || [];
    const reqs = res.requests || [];
    const sdcs = res.service_deliveries || [];
    const tasks = res.tasks || [];
    const contracts = res.contracts || [];
    const payments = res.payments || [];
    const statusInfo = opp.status_info || { vi: 'N/A', en: 'N/A', color: '#64748B' };

    // Update modal header with Opportunity title/description + status badge
    const headerTitleEl = document.getElementById('wl-opp-modal-header-title');
    if (headerTitleEl) {
      headerTitleEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
          ${wlSvgIcon('briefcase', '#2563EB', 20)}
          <div style="font-weight:700; font-size:16px; color:#0F172A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(opp.project_name || opp.description || '')}">
            #${escapeHTML(oppId)} — ${escapeHTML(opp.project_name || opp.description || t('wl.opp_modal_title', 'Hồ Sơ Cơ Hội'))}
          </div>
          ${wlGetOppStatusBadge(statusInfo, opp.status)}
        </div>
      `;
    }

    // Helper to find payments linked to a contract
    function wlGetContractPayments(c) {
      const cid = String(c.contract_id || '');
      const cno = String(c.contractspood_no || '');
      return payments.filter(p => {
        const pCid = String(p.contract_id || '');
        const pCsp = String(p.contractspood || '');
        return (cid && (pCid === cid || pCsp === cid)) || (cno && (pCid === cno || pCsp === cno));
      });
    }

    // Split contracts: Selling (69) vs Buying (70)
    const sellingContracts = contracts.filter(c => c.type === 69);
    const buyingContracts = contracts.filter(c => c.type === 70);
    const otherContracts = contracts.filter(c => c.type !== 69 && c.type !== 70);
    if (otherContracts.length > 0) {
      sellingContracts.push(...otherContracts);
    }

    // Link payments to selling contracts
    // Link payments to selling contracts (strictly base currency)
    const sellingLinkedPayIds = new Set();
    sellingContracts.forEach(c => {
      const allLinked = wlGetContractPayments(c);
      c.incomingPayments = allLinked.filter(p => p.payment_type === 60 || !p.payment_type);
      c.incomingPayments.forEach(p => sellingLinkedPayIds.add(p.payment_id));
      c.paidVal = c.incomingPayments
        .filter(p => p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid')
        .reduce((sum, p) => sum + wlGetPaymentBaseValue(p), 0);
      const cTot = wlGetContractBaseValue(c);
      c.paidPct = cTot > 0 ? Math.round((c.paidVal / cTot) * 100) : (c.paidVal > 0 ? 100 : 0);
      c.remVal = Math.max(0, cTot - c.paidVal);
    });

    const unlinkedIncoming = payments.filter(p => (p.payment_type === 60 || !p.payment_type) && !sellingLinkedPayIds.has(p.payment_id));
    const unlinkedIncomingTotal = unlinkedIncoming.reduce((sum, p) => sum + wlGetPaymentBaseValue(p), 0);

    // Link payments to buying contracts (strictly base currency)
    const buyingLinkedPayIds = new Set();
    buyingContracts.forEach(c => {
      const allLinked = wlGetContractPayments(c);
      c.outgoingPayments = allLinked.filter(p => p.payment_type === 61);
      c.outgoingPayments.forEach(p => buyingLinkedPayIds.add(p.payment_id));
      c.paidVal = c.outgoingPayments
        .filter(p => p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid')
        .reduce((sum, p) => sum + wlGetPaymentBaseValue(p), 0);
      const cTot = wlGetContractBaseValue(c);
      c.paidPct = cTot > 0 ? Math.round((c.paidVal / cTot) * 100) : (c.paidVal > 0 ? 100 : 0);
      c.remVal = Math.max(0, cTot - c.paidVal);
    });

    const unlinkedOutgoing = payments.filter(p => p.payment_type === 61 && !buyingLinkedPayIds.has(p.payment_id));
    const unlinkedOutgoingTotal = unlinkedOutgoing.reduce((sum, p) => sum + wlGetPaymentBaseValue(p), 0);

    // Selling & Buying Ratios (strictly base currency)
    const baseCurr = wlGetBaseCurrency();
    const sVal = opp.selling_contract_value || opp.contract_value || 0;
    const inPaid = opp.incoming_paid_value || opp.paid_value || 0;
    const inRem = Math.max(0, sVal - inPaid);
    const inPct = sVal > 0 ? Math.round((inPaid / sVal) * 100) : (inPaid > 0 ? 100 : 0);

    const bVal = opp.buying_contract_value || 0;
    const outPaid = opp.outgoing_paid_value || 0;
    const outRem = Math.max(0, bVal - outPaid);
    const outPct = bVal > 0 ? Math.round((outPaid / bVal) * 100) : (outPaid > 0 ? 100 : 0);

    const hasBuying = bVal > 0 || outPaid > 0;
    const marginVal = opp.margin_value != null ? opp.margin_value : ((sVal > 0 ? sVal : 0) - bVal);
    const marginPct = sVal > 0 ? Math.round((marginVal / sVal) * 100) : 0;

    const completedTasks = tasks.filter(t => t.status === 5).length;
    const inProgTasks = tasks.filter(t => t.status === 4 || t.status === 2).length;
    const pendingTasks = tasks.length - completedTasks - inProgTasks;
    const taskPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const closedReqs = reqs.filter(r => [4, 5, 6, 9, 117].includes(r.sr_status)).length;
    const activeReqs = reqs.length - closedReqs;
    const reqPct = reqs.length > 0 ? Math.round((closedReqs / reqs.length) * 100) : 0;

    modalBody.innerHTML = `
      <div>
        <!-- Executive Overview Banner (Balanced Layout) -->
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:18px 20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <!-- Top Meta Row -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px 18px; padding-bottom:16px; border-bottom:1px solid #F1F5F9; font-size:12px;">
            <div>
              <span style="color:#64748B;">${t('col.company', 'Khách hàng / Đối tác')}:</span>
              <strong style="color:#0F172A; margin-left:6px;">${escapeHTML(wlFormatCounterparty(opp.id__company, opp.company_name) || '—')}</strong>
            </div>
            <div>
              <span style="color:#64748B;">${t('wl.col_sale_lead', 'Sale Lead')}:</span>
              <strong style="color:#0F172A; margin-left:6px;">${escapeHTML(opp.sale_lead_name || 'N/A')}${opp.sale_lead_dept ? ` (${escapeHTML(opp.sale_lead_dept)})` : ''}</strong>
            </div>
            <div>
              <span style="color:#64748B;">${t('wl.col_req_created', 'Ngày tạo')}:</span>
              <strong style="color:#0F172A; margin-left:6px;">${opp.create_date ? new Date(opp.create_date).toLocaleDateString('vi-VN') : '—'}</strong>
            </div>
          </div>

          <!-- Symmetrical 3-Card Financial Metric Grid -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-top:16px;">
            <!-- Selling Card -->
            <div style="background:linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 100%); border:1px solid #BAE6FD; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:11px; font-weight:700; color:#0369A1; text-transform:uppercase; letter-spacing:0.5px;">${t('wl.selling', 'Bán ra')}</span>
                  <span style="font-size:11px; font-weight:700; color:#0284C7; background:#E0F2FE; padding:2px 8px; border-radius:12px;">${inPct}%</span>
                </div>
                <div style="font-size:18px; font-weight:800; color:#0369A1;">${wlFormatMoney(sVal, baseCurr)}</div>
              </div>
              <div style="margin-top:12px;">
                <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden; margin-bottom:8px;">
                  <div style="height:100%; width:${Math.min(100, inPct)}%; background:#0284C7; border-radius:3px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                  <span style="color:#059669; font-weight:600;">${t('wl.collected_paid', 'Đã thu')}: ${wlFormatMoney(inPaid, baseCurr)}</span>
                  <span style="color:#64748B;">${t('wl.remaining_collect', 'Còn lại')}: ${wlFormatMoney(inRem, baseCurr)}</span>
                </div>
              </div>
            </div>

            <!-- Buying Card -->
            <div style="background:linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%); border:1px solid #FDE68A; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:11px; font-weight:700; color:#92400E; text-transform:uppercase; letter-spacing:0.5px;">${t('wl.buying', 'Mua vào')}</span>
                  <span style="font-size:11px; font-weight:700; color:#D97706; background:#FEF3C7; padding:2px 8px; border-radius:12px;">${outPct}%</span>
                </div>
                <div style="font-size:18px; font-weight:800; color:#92400E;">${wlFormatMoney(bVal, baseCurr)}</div>
              </div>
              <div style="margin-top:12px;">
                <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden; margin-bottom:8px;">
                  <div style="height:100%; width:${Math.min(100, outPct)}%; background:#F59E0B; border-radius:3px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                  <span style="color:#D97706; font-weight:600;">${t('wl.disbursed_paid', 'Đã chi')}: ${wlFormatMoney(outPaid, baseCurr)}</span>
                  <span style="color:#64748B;">${t('wl.remaining_disburse', 'Còn lại')}: ${wlFormatMoney(outRem, baseCurr)}</span>
                </div>
              </div>
            </div>

            <!-- Gross Margin Card -->
            <div style="background:linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%); border:1px solid #BBF7D0; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase; letter-spacing:0.5px;">${t('wl.gross_margin', 'Lợi nhuận gộp')}</span>
                  <span style="font-size:11px; font-weight:700; color:#059669; background:#DCFCE7; padding:2px 8px; border-radius:12px;">${marginPct}% Margin</span>
                </div>
                <div style="font-size:18px; font-weight:800; color:${marginVal >= 0 ? '#166534' : '#DC2626'};">${wlFormatMoney(marginVal, baseCurr)}</div>
              </div>
              <div style="margin-top:12px;">
                <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden; margin-bottom:8px;">
                  <div style="height:100%; width:${Math.max(0, Math.min(100, marginPct))}%; background:#10B981; border-radius:3px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                  <span style="color:#166534; font-weight:600;">${t('wl.gross_margin', 'Tỷ suất biên')}: ${marginPct}%</span>
                  <span style="color:#64748B;">${marginVal >= 0 ? t('wl.profitable', 'Hiệu quả') : t('wl.deficit', 'Thâm hụt')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 1: Team Members Working on this Opportunity -->
        <div style="margin-bottom:24px;">
          <h4 style="font-size:14px; font-weight:700; color:#1E293B; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            ${wlSvgIcon('groups', '#1D4ED8', 18)}
            <span>${t('wl.team_breakdown_title', 'Đội Ngũ Nhân Sự')} (${team.length})</span>
          </h4>

          ${team.length === 0 ? `<div style="font-size:12px; color:#94A3B8; padding:12px; background:#F8FAFC; border-radius:6px;">${t('wl.no_matching_staff', 'Không có dữ liệu nhân sự')}</div>` : `
            <div style="border:1px solid #E2E8F0; border-radius:8px; overflow-x:auto; overflow-y:auto; max-height:280px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_employee', 'Nhân viên')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_role_in_opp', 'Vai Trò Trong Cơ Hội')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_requests_in_opp', 'Yêu Cầu Phụ Trách & Vai Trò')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_tasks_in_opp', 'Tiến Độ Nhiệm Vụ (Tasks)')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${team.map(m => `
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <!-- Employee -->
                      <td style="padding:10px 12px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:30px; height:30px; border-radius:50%; background:${wlGetAvatarBg(m.full_name)}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:11px; flex-shrink:0;">
                            ${m.avatar ? `<img src="${escapeHTML(m.avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.remove()" />` : wlGetInitials(m.full_name)}
                          </div>
                          <div>
                            <div style="font-weight:600; color:#111827;">${escapeHTML(m.full_name || 'N/A')}</div>
                            <div style="font-size:10px; color:#6B7280;">${escapeHTML(m.department_name || '')} • ${escapeHTML(m.position || '')}</div>
                          </div>
                        </div>
                      </td>

                      <!-- Roles in Opp -->
                      <td style="padding:10px 12px;">
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                          ${m.roles.map(r => `
                            <span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; background:${r === 'Sale Lead' ? '#FEF3C7' : '#EFF6FF'}; color:${r === 'Sale Lead' ? '#92400E' : '#1D4ED8'};">
                              ${escapeHTML(r)}
                            </span>
                          `).join('')}
                        </div>
                      </td>

                      <!-- Requests in Opp -->
                      <td style="padding:10px 12px;">
                        ${m.requests_count > 0 ? `
                          <div style="font-weight:600; color:#059669; font-size:11px;">
                            ${m.requests_count} ${t('wl.tab_requests', 'yêu cầu')}
                          </div>
                          <div style="font-size:10px; color:#64748B; margin-top:2px;">
                            ${Object.entries(m.request_roles_detail).map(([rName, rCnt]) => `${escapeHTML(rName)}: ${rCnt}`).join(', ')}
                          </div>
                        ` : `
                          <span style="color:#9CA3AF; font-size:11px;">${t('wl.no_requests', 'Không có yêu cầu')}</span>
                        `}
                      </td>

                      <!-- Tasks in Opp & Progress Bar -->
                      <td style="padding:10px 12px; min-width:200px;">
                        ${m.tasks_count > 0 ? `
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                            <span style="font-weight:600; color:#111827; font-size:11px;">
                              ${m.task_status.completed}/${m.tasks_count} ${t('wl.tasks_completed_rate', 'hoàn thành')}
                            </span>
                            <span style="font-weight:700; color:#059669; font-size:11px;">${m.task_completed_pct}%</span>
                          </div>
                          <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;">
                            <div style="height:100%; width:${m.task_completed_pct}%; background:#10B981; border-radius:3px;"></div>
                          </div>
                          <div style="font-size:10px; color:#64748B; margin-top:3px;">
                            ${m.task_status.completed} ${t('val.completed', 'xong')} • ${m.task_status.in_progress} ${t('val.in_progress', 'đang làm')} • ${m.task_status.pending} ${t('val.pending', 'chờ')}
                          </div>
                        ` : `
                          <span style="color:#9CA3AF; font-size:11px;">${t('wl.no_tasks', 'Không có task')}</span>
                        `}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Section 2: Linked Requests List -->
        <div style="margin-bottom:20px;">
          <h4 style="font-size:14px; font-weight:700; color:#1E293B; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
            ${wlSvgIcon('assignment', '#10B981', 18)}
            <span>${t('wl.tab_requests', 'Yêu Cầu Liên Quan')} (${reqs.length})</span>
          </h4>
          ${reqs.length === 0 ? `<div style="font-size:12px; color:#94A3B8; padding:10px; background:#F8FAFC; border-radius:6px;">${t('wl.no_requests', 'Không có yêu cầu nào')}</div>` : `
            <div style="max-height:220px; overflow-y:auto; overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_id', 'Mã SR')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_desc', 'Mô tả')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_status', 'Trạng thái')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_created', 'Ngày tạo')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${reqs.map(r => `
                    <tr style="border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="window.location.hash='request/${escapeHTML(r.request_id)}'">
                      <td style="padding:8px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(r.request_id)}</td>
                      <td style="padding:8px 10px; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(r.description || 'N/A')}</td>
                      <td style="padding:8px 10px;">${wlGetRequestStatusBadge(r.sr_status)}</td>
                      <td style="padding:8px 10px; color:#64748B;">${r.sr_created_date ? new Date(r.sr_created_date).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Section 3: Service Delivery (SDC) with Progress & Remaining Time & Tasks Drilldown -->
        <div style="margin-bottom:24px;">
          <h4 style="font-size:14px; font-weight:700; color:#1E293B; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            ${wlSvgIcon('service', '#0284C7', 18)}
            <span>${t('col.sd_service_delivery', 'Hợp Đồng Dịch Vụ (Service Delivery)')} (${sdcs.length})</span>
          </h4>

          ${sdcs.length === 0 ? `
            <div style="font-size:12px; color:#94A3B8; padding:12px; background:#F8FAFC; border-radius:8px; border:1px dashed #E2E8F0;">
              ${t('wl.no_sdc', 'Không có hợp đồng dịch vụ nào')}
            </div>
          ` : `
            <div style="border:1px solid #E2E8F0; border-radius:8px; overflow-x:auto; overflow-y:auto; max-height:360px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:130px;">${t('col.sd_service_delivery', 'Mã SDC')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); min-width:200px;">${t('col.sd_service_scope', 'Hạng Mục Dịch Vụ')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:120px;">${t('col.status', 'Trạng Thái')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:170px;">${t('col.oppo_progress', 'Tiến Độ')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:100px;">${t('col.start_date', 'Ngày Bắt Đầu')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:100px;">${t('col.end_date', 'Ngày Kết Thúc')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:160px;">${t('col.sd_service_coordinator', 'Điều Phối Viên')}</th>
                    <th style="padding:10px 12px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05); width:95px; text-align:center;">${t('col.sd_task_request_count', 'Nhiệm Vụ')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${sdcs.map(sdc => {
                    const sdcTasks = tasks.filter(tk => String(tk.service_delivery) === String(sdc.id));
                    const safeId = escapeHTML(String(sdc.id).replace(/[^a-zA-Z0-9_-]/g, ''));
                    const sdcCode = sdc.sd_old_id || (sdc.contract_no ? `HĐ: ${sdc.contract_no}` : (sdc.id ? sdc.id.substring(0, 8) : 'SDC'));
                    const sdcStart = sdc.start_date ? new Date(sdc.start_date).toLocaleDateString(wlIsVi() ? 'vi-VN' : 'en-GB') : '—';
                    const sdcEnd = sdc.end_date ? new Date(sdc.end_date).toLocaleDateString(wlIsVi() ? 'vi-VN' : 'en-GB') : '—';
                    return `
                      <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                        <td style="padding:10px 12px; font-weight:600; color:#0284C7; cursor:pointer;" onclick="window.location.hash='service_delivery_contract/${escapeHTML(sdc.id)}'">
                          #${escapeHTML(sdcCode)}
                        </td>
                        <td style="padding:10px 12px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#0F172A;" title="${escapeHTML(sdc.service_scope || sdc.service || '')}">
                          <strong>${escapeHTML(wlGetSdcLabel(sdc))}</strong>
                        </td>
                        <td style="padding:10px 12px;">
                          ${wlGetSdcStatusBadge(sdc.status)}
                        </td>
                        <td style="padding:10px 12px;">
                          ${wlRenderSdcProgressBar(sdc)}
                        </td>
                        <td style="padding:10px 12px; color:#475569; white-space:nowrap;">
                          ${sdcStart}
                        </td>
                        <td style="padding:10px 12px; color:#475569; white-space:nowrap;">
                          ${sdcEnd}
                        </td>
                        <td style="padding:10px 12px;">
                          ${sdc.coordinator_name ? `
                            <div style="display:flex; align-items:center; gap:6px;">
                              <div style="width:22px; height:22px; border-radius:50%; background:#0284C7; color:#fff; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700;">
                                ${sdc.coordinator_avatar ? `<img src="${escapeHTML(sdc.coordinator_avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.remove()" />` : wlGetInitials(sdc.coordinator_name)}
                              </div>
                              <span style="color:#334155; font-weight:500;">${escapeHTML(sdc.coordinator_name)}</span>
                            </div>
                          ` : `<span style="color:#94A3B8;">—</span>`}
                        </td>
                        <td style="padding:10px 12px; text-align:center;">
                          ${sdcTasks.length > 0 ? `
                            <button type="button" onclick="wlToggleSdcTasks('${safeId}')" style="background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                              <span>${sdcTasks.length}</span>
                              <span id="icon-sdc-${safeId}" style="display:inline-flex; align-items:center; transition:transform 0.2s;">
                                ${wlSvgIcon('chevron_down', '#1D4ED8', 14)}
                              </span>
                            </button>
                          ` : `<span style="color:#94A3B8; font-size:11px;">0</span>`}
                        </td>
                      </tr>
                      ${sdcTasks.length > 0 ? `
                        <tr id="sdc-row-${safeId}" style="display:none; background:#F8FAFC;">
                          <td colspan="8" style="padding:10px 14px 14px 28px; border-bottom:1px solid #E2E8F0;">
                            <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; overflow:hidden;">
                              <div style="padding:6px 12px; background:#F1F5F9; border-bottom:1px solid #E2E8F0; font-size:11px; font-weight:700; color:#475569; display:flex; align-items:center; gap:6px;">
                                ${wlSvgIcon('task', '#F59E0B', 15)}
                                <span>${t('wl.tab_service_tasks', 'Nhiệm Vụ Dịch Vụ')} (${sdcTasks.length})</span>
                              </div>
                              <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                  <tr style="background:#FAFAFA; text-align:left; color:#64748B; border-bottom:1px solid #F1F5F9;">
                                    <th style="padding:6px 10px; width:110px;">${t('wl.col_task_code', 'Mã Task')}</th>
                                    <th style="padding:6px 10px;">${t('wl.col_task_title', 'Tiêu đề')}</th>
                                    <th style="padding:6px 10px; width:160px;">${t('col.engineer', 'Kỹ sư')}</th>
                                    <th style="padding:6px 10px; width:110px;">${t('wl.col_task_status', 'Trạng thái')}</th>
                                    <th style="padding:6px 10px; width:100px;">${t('wl.col_req_created', 'Ngày bắt đầu')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${sdcTasks.map(tk => `
                                    <tr style="border-bottom:1px solid #F8FAFC; cursor:pointer;" onclick="window.location.hash='service_task_request/${escapeHTML(tk.id)}'" onmouseover="this.style.background='#F0F9FF'" onmouseout="this.style.background='transparent'">
                                      <td style="padding:6px 10px; font-weight:600; color:#D97706;">${escapeHTML(tk.task_id_view || tk.id)}</td>
                                      <td style="padding:6px 10px; color:#1E293B; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(tk.title || 'N/A')}</td>
                                      <td style="padding:6px 10px; color:#475569;">${escapeHTML(tk.engineer_name || '—')}</td>
                                      <td style="padding:6px 10px;">${wlGetTaskStatusBadge(tk.status)}</td>
                                      <td style="padding:6px 10px; color:#64748B;">${tk.started_date ? new Date(tk.started_date).toLocaleDateString('vi-VN') : '—'}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ` : ''}
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Section 4: Financial Ledger (Compact Contract-First Tables with Collapsible Payment Accordions) -->
        <div style="margin-top:24px; padding-top:20px; border-top:1px solid #E2E8F0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <h4 style="font-size:14px; font-weight:700; color:#1E293B; margin:0; display:flex; align-items:center; gap:8px;">
              ${wlSvgIcon('receipt', '#1D4ED8', 18)}
              <span>${t('wl.financial_ledger_title', 'Hồ Sơ Hợp Đồng & Thanh Toán Thu Chi')}</span>
            </h4>
            <div style="display:flex; gap:6px;">
              <button class="wl-sub-tab-btn active" id="btn-opp-fin-selling" onclick="wlSwitchOppFinTab('selling')" style="display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <span style="width:8px; height:8px; border-radius:50%; background:#059669;"></span>
                <span>${t('wl.selling', 'Bán ra')} (${sellingContracts.length})</span>
              </button>
              <button class="wl-sub-tab-btn" id="btn-opp-fin-buying" onclick="wlSwitchOppFinTab('buying')" style="display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <span style="width:8px; height:8px; border-radius:50%; background:#D97706;"></span>
                <span>${t('wl.buying', 'Mua vào')} (${buyingContracts.length}${unlinkedOutgoing.length > 0 ? ` + ${unlinkedOutgoing.length} chi` : ''})</span>
              </button>
            </div>
          </div>

          <!-- Panel 1: Selling Contracts & Integrated Payments -->
          <div id="opp-fin-panel-selling" class="wl-opp-fin-panel">
            <!-- Selling KPI Summary Bar -->
            <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                ${wlSvgIcon('wallet', '#059669', 18)}
                <span style="font-size:12px; font-weight:700; color:#166534;">${t('wl.financial_overview_selling', 'Bán Ra & Thu Hồi')}</span>
              </div>
              <div style="display:flex; gap:16px; font-size:12px;">
                <span>${t('wl.col_contract_value', 'Tổng HĐ')}: <strong style="color:#0F172A;">${wlFormatMoney(sVal, baseCurr)}</strong></span>
                <span>${t('wl.collected_paid', 'Đã thu')}: <strong style="color:#059669;">${wlFormatMoney(inPaid, baseCurr)} (${inPct}%)</strong></span>
                <span>${t('wl.remaining_collect', 'Còn phải thu')}: <strong style="color:#EA580C;">${wlFormatMoney(inRem, baseCurr)}</strong></span>
              </div>
            </div>

            ${sellingContracts.length === 0 && unlinkedIncoming.length === 0 ? `
              <div style="font-size:12px; color:#94A3B8; padding:14px; background:#F8FAFC; border-radius:8px; text-align:center;">
                ${t('wl.no_selling_contracts', 'Không có hợp đồng bán ra nào')}
              </div>
            ` : `
              <div style="border:1px solid #E2E8F0; border-radius:8px; overflow-x:auto; background:#FFFFFF;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                      <th style="padding:10px 12px; width:130px;">${t('wl.col_contract_code', 'Mã HĐ')}</th>
                      <th style="padding:10px 12px;">${t('wl.col_contract_name', 'Tên hợp đồng')}</th>
                      <th style="padding:10px 12px; min-width:180px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                      <th style="padding:10px 12px; text-align:right; width:130px;">${t('wl.col_contract_value', 'Giá trị HĐ')}</th>
                      <th style="padding:10px 12px; text-align:right; width:140px;">${t('wl.collected_paid', 'Đã thu')}</th>
                      <th style="padding:10px 12px; text-align:right; width:120px;">${t('wl.remaining_collect', 'Còn lại')}</th>
                      <th style="padding:10px 12px; width:100px;">${t('wl.col_contract_signed', 'Ngày ký')}</th>
                      <th style="padding:10px 12px; width:110px; text-align:center;">${t('wl.contract_payments_col', 'Thanh toán')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sellingContracts.map(c => {
                      const safeConId = escapeHTML(String(c.contract_id).replace(/[^a-zA-Z0-9_-]/g, ''));
                      const cIncoming = c.incomingPayments || [];
                      const cTot = wlGetContractBaseValue(c);
                      return `
                        <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                          <td style="padding:10px 12px; font-weight:700; color:#1D4ED8; cursor:pointer;" onclick="window.location.hash='contract/${escapeHTML(c.contract_id)}'">
                            #${escapeHTML(c.contractspood_no || c.contract_id)}
                          </td>
                          <td style="padding:10px 12px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#0F172A;" title="${escapeHTML(c.contract_name_or_description || '')}">
                            <strong>${escapeHTML(c.contract_name_or_description || 'N/A')}</strong>
                          </td>
                          <td style="padding:10px 12px; color:#334155; font-weight:500;">
                            ${escapeHTML(wlFormatCounterparty(c.contractor, c.company_shortname, c.company_fullname))}
                          </td>
                          <td style="padding:10px 12px; text-align:right; font-weight:700; color:#0F172A;">
                            ${wlRenderMoneyWithOriginal(cTot, c.currency, c.total_value)}
                          </td>
                          <td style="padding:10px 12px; text-align:right;">
                            <div style="font-weight:700; color:#059669;">${wlFormatMoney(c.paidVal, baseCurr)}</div>
                            <div style="font-size:10px; color:#64748B;">${c.paidPct}%</div>
                          </td>
                          <td style="padding:10px 12px; text-align:right; color:#EA580C; font-weight:600;">
                            ${wlFormatMoney(c.remVal, baseCurr)}
                          </td>
                          <td style="padding:10px 12px; color:#64748B;">
                            ${c.contract_signed_date ? new Date(c.contract_signed_date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style="padding:10px 12px; text-align:center;">
                            ${cIncoming.length > 0 ? `
                              <button type="button" onclick="wlToggleContractPayments('selling-${safeConId}')" style="background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                <span>${cIncoming.length} ${t('wl.payments_count', 'GD')}</span>
                                <span id="icon-pay-selling-${safeConId}" style="display:inline-flex; align-items:center; transition:transform 0.2s;">
                                  ${wlSvgIcon('chevron_down', '#1D4ED8', 14)}
                                </span>
                              </button>
                            ` : `<span style="color:#94A3B8; font-size:11px;">0 ${t('wl.payments_count', 'GD')}</span>`}
                          </td>
                        </tr>
                        ${cIncoming.length > 0 ? `
                          <tr id="pay-row-selling-${safeConId}" style="display:none; background:#F8FAFC;">
                            <td colspan="8" style="padding:10px 14px 14px 28px; border-bottom:1px solid #E2E8F0;">
                              <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; overflow:hidden;">
                                <div style="padding:8px 12px; background:#F0FDF4; border-bottom:1px solid #DCFCE7; font-size:11px; font-weight:700; color:#166534; display:flex; justify-content:space-between; align-items:center;">
                                  <div style="display:flex; align-items:center; gap:6px;">
                                    ${wlSvgIcon('payment', '#059669', 15)}
                                    <span>${t('wl.contract_payments', 'Lịch Sử Thanh Toán Đã Thu Theo Hợp Đồng')} (${cIncoming.length})</span>
                                  </div>
                                  <span style="font-weight:700; color:#059669;">${wlFormatMoney(c.paidVal, baseCurr)} (${c.paidPct}%)</span>
                                </div>
                                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                  <thead>
                                    <tr style="background:#FAFAFA; text-align:left; color:#64748B; border-bottom:1px solid #F1F5F9;">
                                      <th style="padding:6px 10px; width:110px;">${t('wl.col_trans_id', 'Mã GD')}</th>
                                      <th style="padding:6px 10px; width:95px;">${t('wl.col_trans_date', 'Ngày GD')}</th>
                                      <th style="padding:6px 10px; min-width:160px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                                      <th style="padding:6px 10px; text-align:right; width:130px;">${t('wl.col_payment_amount', 'Số tiền')}</th>
                                      <th style="padding:6px 10px; width:110px;">${t('wl.col_payment_status', 'Trạng thái')}</th>
                                      <th style="padding:6px 10px;">${t('col.note', 'Diễn giải')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${cIncoming.map(p => {
                                      const pValBase = wlGetPaymentBaseValue(p);
                                      return `
                                        <tr style="border-bottom:1px solid #F8FAFC; cursor:pointer;" onclick="window.location.hash='payment/${escapeHTML(p.payment_id)}'" onmouseover="this.style.background='#F0FDF4'" onmouseout="this.style.background='transparent'">
                                          <td style="padding:6px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(p.payment_id)}</td>
                                          <td style="padding:6px 10px; color:#64748B;">${p.payment_date ? new Date(p.payment_date).toLocaleDateString('vi-VN') : '—'}</td>
                                          <td style="padding:6px 10px; color:#334155; font-weight:500;">
                                            ${escapeHTML(wlFormatCounterparty(p.counter_party_id || p.counter_party, p.cp_company_shortname, p.cp_company_fullname, p.cp_employee_name))}
                                          </td>
                                          <td style="padding:6px 10px; text-align:right; font-weight:700; color:#059669;">
                                            +${wlRenderMoneyWithOriginal(pValBase, p.currency, p.total_value || p.value)}
                                          </td>
                                          <td style="padding:6px 10px;">
                                            ${p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid' ? `
                                              <span style="font-size:10px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 6px; border-radius:4px;">${t('wl.payment_status_paid', 'Đã thanh toán')}</span>
                                            ` : `
                                              <span style="font-size:10px; font-weight:600; color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:4px;">${escapeHTML(String(p.payment_status || t('wl.payment_status_pending', 'Chờ')))}</span>
                                            `}
                                          </td>
                                          <td style="padding:6px 10px; color:#475569; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                            ${escapeHTML(p.payment_description || '—')}
                                          </td>
                                        </tr>
                                      `;
                                    }).join('')}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ` : ''}
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Unlinked Incoming Payments Collapsible Section -->
              ${unlinkedIncoming.length > 0 ? `
                <div style="margin-top:14px; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden; background:#FFFFFF;">
                  <div style="padding:10px 14px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="wlToggleUnlinkedPayments('selling')">
                    <div style="display:flex; align-items:center; gap:8px;">
                      ${wlSvgIcon('receipt', '#059669', 16)}
                      <span style="font-size:12px; font-weight:700; color:#1E293B;">${t('wl.unlinked_incoming', 'Khoản thu trực tiếp dự án (không gắn số HĐ)')} (${unlinkedIncoming.length})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:12px; font-weight:700; color:#059669;">+${wlFormatMoney(unlinkedIncomingTotal, baseCurr)}</span>
                      <span id="icon-unlinked-selling" style="display:inline-flex; align-items:center; transition:transform 0.2s;">
                        ${wlSvgIcon('chevron_down', '#64748B', 14)}
                      </span>
                    </div>
                  </div>
                  <div id="unlinked-selling-body" style="display:none; padding:10px 14px;">
                    <div style="overflow-x:auto; border:1px solid #E2E8F0; border-radius:6px; background:#FFFFFF;">
                      <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                          <tr style="background:#F1F5F9; text-align:left; color:#64748B;">
                            <th style="padding:6px 10px; width:110px;">${t('wl.col_trans_id', 'Mã GD')}</th>
                            <th style="padding:6px 10px; width:95px;">${t('wl.col_trans_date', 'Ngày GD')}</th>
                            <th style="padding:6px 10px; min-width:160px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                            <th style="padding:6px 10px; text-align:right; width:130px;">${t('wl.col_payment_amount', 'Số tiền')}</th>
                            <th style="padding:6px 10px; width:110px;">${t('wl.col_payment_status', 'Trạng thái')}</th>
                            <th style="padding:6px 10px;">${t('col.note', 'Diễn giải')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${unlinkedIncoming.map(p => {
                            const pValBase = wlGetPaymentBaseValue(p);
                            return `
                              <tr style="border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="window.location.hash='payment/${escapeHTML(p.payment_id)}'">
                                <td style="padding:6px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(p.payment_id)}</td>
                                <td style="padding:6px 10px; color:#64748B;">${p.payment_date ? new Date(p.payment_date).toLocaleDateString('vi-VN') : '—'}</td>
                                <td style="padding:6px 10px; color:#334155; font-weight:500;">
                                  ${escapeHTML(wlFormatCounterparty(p.counter_party_id || p.counter_party, p.cp_company_shortname, p.cp_company_fullname, p.cp_employee_name))}
                                </td>
                                <td style="padding:6px 10px; text-align:right; font-weight:700; color:#059669;">
                                  +${wlRenderMoneyWithOriginal(pValBase, p.currency, p.total_value || p.value)}
                                </td>
                                <td style="padding:6px 10px;">
                                  ${p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid' ? `
                                    <span style="font-size:10px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 6px; border-radius:4px;">${t('wl.payment_status_paid', 'Đã thanh toán')}</span>
                                  ` : `
                                    <span style="font-size:10px; font-weight:600; color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:4px;">${escapeHTML(String(p.payment_status || t('wl.payment_status_pending', 'Chờ')))}</span>
                                  `}
                                </td>
                                <td style="padding:6px 10px; color:#475569;">${escapeHTML(p.payment_description || '—')}</td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ` : ''}
            `}
          </div>

          <!-- Panel 2: Buying Contracts & Disbursements Ledger -->
          <div id="opp-fin-panel-buying" class="wl-opp-fin-panel" style="display:none;">
            <!-- Buying KPI Summary Bar -->
            <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                ${wlSvgIcon('cart', '#D97706', 18)}
                <span style="font-size:12px; font-weight:700; color:#92400E;">${t('wl.financial_overview_buying', 'Mua Vào & Chi Trả')}</span>
              </div>
              <div style="display:flex; gap:16px; font-size:12px;">
                <span>${t('wl.col_contract_value', 'Tổng HĐ Mua')}: <strong style="color:#0F172A;">${wlFormatMoney(bVal, baseCurr)}</strong></span>
                <span>${t('wl.disbursed_paid', 'Đã chi')}: <strong style="color:#D97706;">${wlFormatMoney(outPaid, baseCurr)} (${outPct}%)</strong></span>
                <span>${t('wl.remaining_disburse', 'Còn phải chi')}: <strong style="color:#64748B;">${wlFormatMoney(outRem, baseCurr)}</strong></span>
              </div>
            </div>

            ${buyingContracts.length === 0 && unlinkedOutgoing.length === 0 ? `
              <div style="font-size:12px; color:#94A3B8; padding:14px; background:#F8FAFC; border-radius:8px; text-align:center;">
                ${t('wl.no_buying_contracts', 'Không có hợp đồng mua vào hoặc chi phí phát sinh nào')}
              </div>
            ` : `
              <div style="border:1px solid #E2E8F0; border-radius:8px; overflow-x:auto; background:#FFFFFF;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                      <th style="padding:10px 12px; width:130px;">${t('wl.col_contract_code', 'Mã HĐ')}</th>
                      <th style="padding:10px 12px;">${t('wl.col_contract_name', 'Tên hợp đồng')}</th>
                      <th style="padding:10px 12px; min-width:180px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                      <th style="padding:10px 12px; text-align:right; width:130px;">${t('wl.committed_value', 'Giá trị cam kết')}</th>
                      <th style="padding:10px 12px; text-align:right; width:140px;">${t('wl.disbursed_paid', 'Đã chi')}</th>
                      <th style="padding:10px 12px; text-align:right; width:120px;">${t('wl.remaining_disburse', 'Còn lại')}</th>
                      <th style="padding:10px 12px; width:100px;">${t('wl.col_contract_signed', 'Ngày ký')}</th>
                      <th style="padding:10px 12px; width:110px; text-align:center;">${t('wl.contract_disbursements_col', 'Chi trả')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buyingContracts.map(c => {
                      const safeConId = escapeHTML(String(c.contract_id).replace(/[^a-zA-Z0-9_-]/g, ''));
                      const cOutgoing = c.outgoingPayments || [];
                      const cTot = wlGetContractBaseValue(c);
                      return `
                        <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#FFFBEB'" onmouseout="this.style.background='transparent'">
                          <td style="padding:10px 12px; font-weight:700; color:#1D4ED8; cursor:pointer;" onclick="window.location.hash='contract/${escapeHTML(c.contract_id)}'">
                            #${escapeHTML(c.contractspood_no || c.contract_id)}
                          </td>
                          <td style="padding:10px 12px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#0F172A;" title="${escapeHTML(c.contract_name_or_description || '')}">
                            <strong>${escapeHTML(c.contract_name_or_description || 'N/A')}</strong>
                          </td>
                          <td style="padding:10px 12px; color:#334155; font-weight:500;">
                            ${escapeHTML(wlFormatCounterparty(c.contractor, c.company_shortname, c.company_fullname))}
                          </td>
                          <td style="padding:10px 12px; text-align:right; font-weight:700; color:#0F172A;">
                            ${wlRenderMoneyWithOriginal(cTot, c.currency, c.total_value)}
                          </td>
                          <td style="padding:10px 12px; text-align:right;">
                            <div style="font-weight:700; color:#D97706;">${wlFormatMoney(c.paidVal, baseCurr)}</div>
                            <div style="font-size:10px; color:#64748B;">${c.paidPct}%</div>
                          </td>
                          <td style="padding:10px 12px; text-align:right; color:#64748B; font-weight:600;">
                            ${wlFormatMoney(c.remVal, baseCurr)}
                          </td>
                          <td style="padding:10px 12px; color:#64748B;">
                            ${c.contract_signed_date ? new Date(c.contract_signed_date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style="padding:10px 12px; text-align:center;">
                            ${cOutgoing.length > 0 ? `
                              <button type="button" onclick="wlToggleContractPayments('buying-${safeConId}')" style="background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                <span>${cOutgoing.length} ${t('wl.payments_count', 'GD')}</span>
                                <span id="icon-pay-buying-${safeConId}" style="display:inline-flex; align-items:center; transition:transform 0.2s;">
                                  ${wlSvgIcon('chevron_down', '#1D4ED8', 14)}
                                </span>
                              </button>
                            ` : `<span style="color:#94A3B8; font-size:11px;">0 ${t('wl.payments_count', 'GD')}</span>`}
                          </td>
                        </tr>
                        ${cOutgoing.length > 0 ? `
                          <tr id="pay-row-buying-${safeConId}" style="display:none; background:#FFFDF7;">
                            <td colspan="8" style="padding:10px 14px 14px 28px; border-bottom:1px solid #E2E8F0;">
                              <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; overflow:hidden;">
                                <div style="padding:8px 12px; background:#FFFBEB; border-bottom:1px solid #FEF3C7; font-size:11px; font-weight:700; color:#92400E; display:flex; justify-content:space-between; align-items:center;">
                                  <div style="display:flex; align-items:center; gap:6px;">
                                    ${wlSvgIcon('payment', '#D97706', 15)}
                                    <span>${t('wl.contract_disbursements', 'Lịch Sử Chi Trả Theo Hợp Đồng')} (${cOutgoing.length})</span>
                                  </div>
                                  <span style="font-weight:700; color:#D97706;">${wlFormatMoney(c.paidVal, baseCurr)} (${c.paidPct}%)</span>
                                </div>
                                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                  <thead>
                                    <tr style="background:#FAFAFA; text-align:left; color:#64748B; border-bottom:1px solid #F1F5F9;">
                                      <th style="padding:6px 10px; width:110px;">${t('wl.col_trans_id', 'Mã GD')}</th>
                                      <th style="padding:6px 10px; width:95px;">${t('wl.col_trans_date', 'Ngày GD')}</th>
                                      <th style="padding:6px 10px; min-width:160px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                                      <th style="padding:6px 10px; text-align:right; width:130px;">${t('wl.col_payment_amount', 'Số tiền')}</th>
                                      <th style="padding:6px 10px; width:110px;">${t('wl.col_payment_status', 'Trạng thái')}</th>
                                      <th style="padding:6px 10px;">${t('col.note', 'Diễn giải')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${cOutgoing.map(p => {
                                      const pValBase = wlGetPaymentBaseValue(p);
                                      return `
                                        <tr style="border-bottom:1px solid #F8FAFC; cursor:pointer;" onclick="window.location.hash='payment/${escapeHTML(p.payment_id)}'" onmouseover="this.style.background='#FFFBEB'" onmouseout="this.style.background='transparent'">
                                          <td style="padding:6px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(p.payment_id)}</td>
                                          <td style="padding:6px 10px; color:#64748B;">${p.payment_date ? new Date(p.payment_date).toLocaleDateString('vi-VN') : '—'}</td>
                                          <td style="padding:6px 10px; color:#334155; font-weight:500;">
                                            ${escapeHTML(wlFormatCounterparty(p.counter_party_id || p.counter_party, p.cp_company_shortname, p.cp_company_fullname, p.cp_employee_name))}
                                          </td>
                                          <td style="padding:6px 10px; text-align:right; font-weight:700; color:#D97706;">
                                            -${wlRenderMoneyWithOriginal(pValBase, p.currency, p.total_value || p.value)}
                                          </td>
                                          <td style="padding:6px 10px;">
                                            ${p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid' ? `
                                              <span style="font-size:10px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 6px; border-radius:4px;">${t('wl.payment_status_paid', 'Đã thanh toán')}</span>
                                            ` : `
                                              <span style="font-size:10px; font-weight:600; color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:4px;">${escapeHTML(String(p.payment_status || t('wl.payment_status_pending', 'Chờ')))}</span>
                                            `}
                                          </td>
                                          <td style="padding:6px 10px; color:#475569; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                            ${escapeHTML(p.payment_description || '—')}
                                          </td>
                                        </tr>
                                      `;
                                    }).join('')}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ` : ''}
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Unlinked Outgoing Payments Collapsible Section -->
              ${unlinkedOutgoing.length > 0 ? `
                <div style="margin-top:14px; border:1px solid #FDE68A; border-radius:8px; overflow:hidden; background:#FFFFFF;">
                  <div style="padding:10px 14px; background:#FFFBEB; border-bottom:1px solid #FEF3C7; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="wlToggleUnlinkedPayments('buying')">
                    <div style="display:flex; align-items:center; gap:8px;">
                      ${wlSvgIcon('outbox', '#D97706', 16)}
                      <span style="font-size:12px; font-weight:700; color:#92400E;">${t('wl.unlinked_outgoing', 'Khoản chi giải ngân trực tiếp & Chi phí mua ngoài')} (${unlinkedOutgoing.length})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:12px; font-weight:700; color:#D97706;">-${wlFormatMoney(unlinkedOutgoingTotal, baseCurr)}</span>
                      <span id="icon-unlinked-buying" style="display:inline-flex; align-items:center; transition:transform 0.2s;">
                        ${wlSvgIcon('chevron_down', '#92400E', 14)}
                      </span>
                    </div>
                  </div>
                  <div id="unlinked-buying-body" style="display:none; padding:10px 14px;">
                    <div style="overflow-x:auto; border:1px solid #FEF3C7; border-radius:6px; background:#FFFFFF; max-height:260px; overflow-y:auto;">
                      <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                          <tr style="background:#FFFBEB; text-align:left; color:#78350F; position:sticky; top:0; z-index:1;">
                            <th style="padding:6px 10px; width:110px;">${t('wl.col_trans_id', 'Mã GD')}</th>
                            <th style="padding:6px 10px; width:95px;">${t('wl.col_trans_date', 'Ngày GD')}</th>
                            <th style="padding:6px 10px; min-width:160px;">${t('col.pay_to_from', 'Thu từ / Chi cho')}</th>
                            <th style="padding:6px 10px; text-align:right; width:130px;">${t('wl.col_payment_amount', 'Số tiền')}</th>
                            <th style="padding:6px 10px; width:110px;">${t('wl.col_payment_status', 'Trạng thái')}</th>
                            <th style="padding:6px 10px;">${t('col.note', 'Diễn giải')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${unlinkedOutgoing.map(p => {
                            const pValBase = wlGetPaymentBaseValue(p);
                            return `
                              <tr style="border-bottom:1px solid #F8FAFC; cursor:pointer;" onclick="window.location.hash='payment/${escapeHTML(p.payment_id)}'" onmouseover="this.style.background='#FFFBEB'" onmouseout="this.style.background='transparent'">
                                <td style="padding:6px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(p.payment_id)}</td>
                                <td style="padding:6px 10px; color:#64748B;">${p.payment_date ? new Date(p.payment_date).toLocaleDateString('vi-VN') : '—'}</td>
                                <td style="padding:6px 10px; color:#334155; font-weight:500;">
                                  ${escapeHTML(wlFormatCounterparty(p.counter_party_id || p.counter_party, p.cp_company_shortname, p.cp_company_fullname, p.cp_employee_name))}
                                </td>
                                <td style="padding:6px 10px; text-align:right; font-weight:700; color:#D97706;">
                                  -${wlRenderMoneyWithOriginal(pValBase, p.currency, p.total_value || p.value)}
                                </td>
                                <td style="padding:6px 10px;">
                                  ${p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid' ? `
                                    <span style="font-size:10px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 6px; border-radius:4px;">${t('wl.payment_status_paid', 'Đã thanh toán')}</span>
                                  ` : `
                                    <span style="font-size:10px; font-weight:600; color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:4px;">${escapeHTML(String(p.payment_status || t('wl.payment_status_pending', 'Chờ')))}</span>
                                  `}
                                </td>
                                <td style="padding:6px 10px; color:#475569; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                  ${escapeHTML(p.payment_description || '—')}
                                </td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ` : ''}
            `}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load opportunity details:', err);
    const modalBody = document.getElementById('wl-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:#EF4444;">
          <span class="material-symbols-rounded" style="font-size:36px;">error</span>
          <p style="margin-top:8px;">${t('wl.error_loading', 'Không thể tải dữ liệu cơ hội')}: ${escapeHTML(err.message || 'Lỗi mạng')}</p>
        </div>
      `;
    }
  }
};

window.wlToggleSdcTasks = function(safeId) {
  const row = document.getElementById(`sdc-row-${safeId}`);
  const icon = document.getElementById(`icon-sdc-${safeId}`);
  if (row) {
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

window.wlToggleContractPayments = function(key) {
  const row = document.getElementById(`pay-row-${key}`);
  const icon = document.getElementById(`icon-pay-${key}`);
  if (row) {
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

window.wlToggleUnlinkedPayments = function(type) {
  const body = document.getElementById(`unlinked-${type}-body`);
  const icon = document.getElementById(`icon-unlinked-${type}`);
  if (body) {
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

window.wlSwitchOppFinTab = function(tab) {
  const pSell = document.getElementById('opp-fin-panel-selling');
  const pBuy = document.getElementById('opp-fin-panel-buying');
  const bSell = document.getElementById('btn-opp-fin-selling');
  const bBuy = document.getElementById('btn-opp-fin-buying');
  if (pSell) pSell.style.display = tab === 'selling' ? 'block' : 'none';
  if (pBuy) pBuy.style.display = tab === 'buying' ? 'block' : 'none';
  if (bSell) bSell.classList.toggle('active', tab === 'selling');
  if (bBuy) bBuy.classList.toggle('active', tab === 'buying');
};

/**
 * 4. INDIVIDUAL EMPLOYEE DOSSIER MODAL (With Visual Ratio Charts)
 * Fixes: open class + explicit display flex
 * Adds: Donut charts for Requests ratio, Approvals ratio, Tasks ratio
 */
window.wlOpenEmployeeModal = async function(employeeId) {
  const container = document.getElementById('wl-modal-container');
  if (!container) return;

  // Use explicit styles to guarantee visibility
  container.innerHTML = `
    <div class="modal-overlay open" id="wl-modal-overlay" style="display:flex !important; position:fixed !important; inset:0 !important; z-index:99999 !important; background:rgba(15,23,42,0.75) !important; backdrop-filter:blur(6px) !important; align-items:center !important; justify-content:center !important;" onclick="wlCloseModal(event)">
      <div class="modal" style="max-width:1100px; width:95%; max-height:92vh; display:flex; flex-direction:column; border-radius:14px; overflow:hidden; background:#FFFFFF; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);" onclick="event.stopPropagation()">
        <div class="modal-header" style="padding:16px 20px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-symbols-rounded" style="color:#1D4ED8; font-size:24px;">account_circle</span>
            <div style="font-weight:700; font-size:16px; color:#111827;">${t('wl.modal_title', 'Hồ Sơ Nhân Sự')}</div>
          </div>
          <button class="modal-close" onclick="wlCloseModal()" style="border:none; background:transparent; font-size:18px; cursor:pointer; color:#6B7280; padding:4px 8px;">✕</button>
        </div>
        <div class="modal-body" id="wl-modal-body" style="padding:20px; overflow-y:auto; flex:1;">
          <div style="padding:40px; text-align:center; color:#9CA3AF;">
            <div class="spinner" style="margin:0 auto 10px; width:24px; height:24px; border:2px solid #E5E7EB; border-top-color:#1D4ED8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <div>${t('wl.loading_profile', 'Đang tải hồ sơ nhân viên...')}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await apiGet(`/workload/employee/${employeeId}`);
    const modalBody = document.getElementById('wl-modal-body');
    if (!modalBody || !res || !res.employee) return;

    const emp = res.employee;
    const reqs = res.requests || [];
    const opps = res.opportunities || [];
    const tasks = res.tasks || [];
    const logs = res.recent_logs || [];

    // Calculate user ratios
    const baseCurr = wlGetBaseCurrency();
    const activeReqs = reqs.filter(r => ![4, 5, 6, 9, 117].includes(r.sr_status)).length;
    const completedReqs = reqs.length - activeReqs;
    const reqPct = reqs.length > 0 ? Math.round((completedReqs / reqs.length) * 100) : 0;

    const completedTasks = tasks.filter(t => t.status === 5).length;
    const taskPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const totalContract = opps.reduce((sum, o) => sum + (parseFloat(o.estimated_revenue) || 0), 0);

    modalBody.innerHTML = `
      <div>
        <!-- Profile Banner -->
        <div style="display:flex; align-items:center; gap:16px; padding:16px 20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; margin-bottom:18px;">
          <div style="width:52px; height:52px; border-radius:50%; background:${wlGetAvatarBg(emp.full_name)}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700;">
            ${wlGetInitials(emp.full_name)}
          </div>
          <div>
            <div style="font-size:17px; font-weight:700; color:#0F172A; display:flex; align-items:center; gap:8px;">
              <span>${escapeHTML(emp.full_name || 'N/A')}</span>
              <span style="font-size:11px; font-weight:600; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:12px;">${escapeHTML(emp.role || 'Staff')}</span>
            </div>
            <div style="font-size:12px; color:#475569; margin-top:3px; display:flex; gap:14px; flex-wrap:wrap;">
              <span><strong>Email:</strong> ${escapeHTML(emp.email || 'N/A')}</span>
              <span><strong>${t('wl.dept', 'Phòng ban')}:</strong> ${escapeHTML(emp.department_name || t('wl.unassigned_dept', 'Chưa phân bổ'))}</span>
              ${emp.position ? `<span><strong>${t('wl.position', 'Chức danh')}:</strong> ${escapeHTML(emp.position)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Visual Proportion / Ratio Charts Row (Requirement 1) -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-bottom:20px;">
          <!-- Chart 1: Requests Resolution Donut -->
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:16px;">
            ${wlRenderDonutChart([
              { label: t('wl.completed', 'Đã xong'), value: completedReqs, color: '#10B981' },
              { label: t('wl.in_progress', 'Đang xử lý'), value: activeReqs, color: '#F59E0B' }
            ], 76, 10, `${reqPct}%`)}
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:#0F172A;">${t('wl.request_resolution_rate', 'Tỷ Lệ Xử Lý Yêu Cầu')}</div>
              <div style="font-size:11px; color:#059669; font-weight:600; margin-top:2px;">${completedReqs}/${reqs.length} ${t('wl.completed', 'đã xong')} (${reqPct}%)</div>
              <div style="font-size:10px; color:#64748B; margin-top:1px;">${activeReqs} ${t('val.in_progress', 'đang xử lý')}</div>
            </div>
          </div>

          <!-- Chart 2: Task Completion Donut -->
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:16px;">
            ${wlRenderDonutChart([
              { label: t('val.completed', 'Hoàn thành'), value: completedTasks, color: '#10B981' },
              { label: t('val.in_progress', 'Chưa xong'), value: tasks.length - completedTasks, color: '#E2E8F0' }
            ], 76, 10, `${taskPct}%`)}
            <div style="flex:1;">
              <div style="font-size:12px; font-weight:700; color:#0F172A;">${t('wl.task_completion_rate', 'Tiến Độ Nhiệm Vụ')}</div>
              <div style="font-size:11px; color:#1D4ED8; font-weight:600; margin-top:2px;">${completedTasks}/${tasks.length} ${t('wl.tasks_completed_rate', 'hoàn thành')} (${taskPct}%)</div>
              <div style="font-size:10px; color:#64748B; margin-top:1px;">${tasks.length} ${t('wl.tab_service_tasks', 'nhiệm vụ')}</div>
            </div>
          </div>

          <!-- Scorecard 3: Opportunities & Contracts -->
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px;">
            <div style="font-size:12px; font-weight:700; color:#0F172A; margin-bottom:4px;">${t('wl.tab_opportunities', 'Cơ Hội')} & ${t('wl.contract_val', 'Hợp Đồng')}</div>
            <div style="font-size:18px; font-weight:700; color:#D97706;">${opps.length} <span style="font-size:11px; font-weight:normal; color:#64748B;">${t('wl.opp_unit', 'cơ hội')}</span></div>
            <div style="font-size:11px; color:#059669; font-weight:600; margin-top:2px;">${wlFormatMoney(totalContract, baseCurr)}</div>
          </div>
        </div>

        <!-- Sub Tabs inside Modal -->
        <div style="display:flex; gap:6px; border-bottom:1px solid #E2E8F0; padding-bottom:8px; margin-bottom:14px;">
          <button class="wl-sub-tab-btn active" id="btn-sub-reqs" onclick="wlSwitchSubTab('reqs')">
            ${t('wl.tab_requests', 'Yêu Cầu')} (${reqs.length})
          </button>
          <button class="wl-sub-tab-btn" id="btn-sub-opps" onclick="wlSwitchSubTab('opps')">
            ${t('wl.tab_opportunities', 'Cơ Hội')} (${opps.length})
          </button>
          <button class="wl-sub-tab-btn" id="btn-sub-tasks" onclick="wlSwitchSubTab('tasks')">
            ${t('wl.tab_service_tasks', 'Nhiệm Vụ')} (${tasks.length})
          </button>
        </div>

        <!-- Sub Content: Requests -->
        <div id="sub-panel-reqs" class="wl-sub-panel">
          ${reqs.length === 0 ? `<div style="font-size:12px; color:#94A3B8; padding:10px; background:#F8FAFC; border-radius:6px;">${t('wl.no_requests', 'Không có yêu cầu nào')}</div>` : `
            <div style="max-height:260px; overflow-y:auto; overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_id', 'Mã SR')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_desc', 'Mô tả')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_status', 'Trạng thái')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_created', 'Ngày tạo')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${reqs.map(r => `
                    <tr style="border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="window.location.hash='request/${escapeHTML(r.request_id)}'">
                      <td style="padding:8px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(r.request_id)}</td>
                      <td style="padding:8px 10px; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(r.description || 'N/A')}</td>
                      <td style="padding:8px 10px;">${wlGetRequestStatusBadge(r.sr_status)}</td>
                      <td style="padding:8px 10px; color:#64748B;">${r.sr_created_date ? new Date(r.sr_created_date).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Sub Content: Opportunities -->
        <div id="sub-panel-opps" class="wl-sub-panel" style="display:none;">
          ${opps.length === 0 ? `<div style="font-size:12px; color:#94A3B8; padding:10px; background:#F8FAFC; border-radius:6px;">${t('wl.no_matching_staff', 'Không có cơ hội nào')}</div>` : `
            <div style="max-height:260px; overflow-y:auto; overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_opp_id', 'Mã Dự Án')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_opp_name', 'Tên Cơ Hội')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.pipeline_val', 'Dự kiến')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_opp_status', 'Trạng thái')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_created', 'Ngày tạo')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${opps.map(o => `
                    <tr style="border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="window.location.hash='oppotunity/${escapeHTML(o.project_id)}'">
                      <td style="padding:8px 10px; font-weight:600; color:#1D4ED8;">#${escapeHTML(o.project_id)}</td>
                      <td style="padding:8px 10px; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(o.project_name || 'N/A')}</td>
                      <td style="padding:8px 10px; font-weight:600; color:#059669;">${wlFormatMoney(o.estimated_revenue, o.currency)}</td>
                      <td style="padding:8px 10px;">
                        ${wlGetOppStatusBadge(o.status_info, o.status)}
                      </td>
                      <td style="padding:8px 10px; color:#64748B;">${o.create_date ? new Date(o.create_date).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Sub Content: Service Tasks -->
        <div id="sub-panel-tasks" class="wl-sub-panel" style="display:none;">
          ${tasks.length === 0 ? `<div style="font-size:12px; color:#94A3B8; padding:10px; background:#F8FAFC; border-radius:6px;">${t('wl.no_tasks', 'Không có nhiệm vụ nào')}</div>` : `
            <div style="max-height:260px; overflow-y:auto; overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px; position:relative;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#F1F5F9; text-align:left; color:#475569;">
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_task_code', 'Mã Task')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_task_title', 'Tiêu đề')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_task_status', 'Trạng thái')}</th>
                    <th style="padding:8px 10px; position:sticky; top:0; background:#F1F5F9; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${t('wl.col_req_created', 'Ngày bắt đầu')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${tasks.map(tk => `
                    <tr style="border-bottom:1px solid #F1F5F9; cursor:pointer;" onclick="window.location.hash='service_task_request/${escapeHTML(tk.id)}'">
                      <td style="padding:8px 10px; font-weight:600; color:#D97706;">${escapeHTML(tk.task_id_view || tk.id)}</td>
                      <td style="padding:8px 10px; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(tk.title || 'N/A')}</td>
                      <td style="padding:8px 10px;">${wlGetTaskStatusBadge(tk.status)}</td>
                      <td style="padding:8px 10px; color:#64748B;">${tk.started_date ? new Date(tk.started_date).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load employee details:', err);
    const modalBody = document.getElementById('wl-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:#EF4444;">
          <span class="material-symbols-rounded" style="font-size:36px;">error</span>
          <p style="margin-top:8px;">${t('wl.error_loading', 'Không thể tải dữ liệu nhân sự')}: ${escapeHTML(err.message || 'Lỗi mạng')}</p>
        </div>
      `;
    }
  }
};

window.wlSwitchSubTab = function(tabName) {
  document.querySelectorAll('.wl-sub-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.wl-sub-panel').forEach(panel => panel.style.display = 'none');

  const btn = document.getElementById(`btn-sub-${tabName}`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`sub-panel-${tabName}`);
  if (panel) panel.style.display = 'block';
};

window.wlCloseModal = function(e) {
  if (e && e.target && e.target.id !== 'wl-modal-overlay' && !e.target.classList.contains('modal-close')) return;
  const overlay = document.getElementById('wl-modal-overlay');
  if (overlay) overlay.remove();
};

/**
 * 5. EXPORT WORKLOAD REPORT
 */
window.wlExportExcel = function() {
  if (!workloadState.data) {
    showToast(t('wl.no_data_export', 'Chưa có dữ liệu để xuất'), 'warning');
    return;
  }

  let rows = [];

  if (workloadState.perspective === 'request') {
    rows = (workloadState.data.employees || []).map(e => ({
      [t('wl.col_name', 'Họ và tên')]: e.full_name,
      'Email': e.email,
      [t('wl.dept', 'Phòng ban')]: e.department_name,
      [t('wl.position', 'Chức danh')]: e.position,
      [t('wl.system_role', 'Vai trò')]: e.role,
      [t('wl.owner_active_col', 'SR Owner (Đang xử lý)')]: e.as_owner_active,
      [t('wl.owner_completed_col', 'SR Owner (Đã hoàn thành)')]: e.as_owner_completed,
      [t('wl.owner_total_col', 'SR Owner (Tổng số)')]: e.as_owner,
      [t('wl.approved_col', 'Hồ sơ đã duyệt')]: e.approvals_approved,
      [t('wl.pending_col', 'Hồ sơ nợ chờ duyệt')]: e.pending_my_approval,
      [t('wl.policy_lead_col', 'Chủ trì quy trình')]: e.as_policy_lead,
      [t('wl.requester_col', 'Người tạo (Requester)')]: e.as_requester,
      [t('wl.tasks_created_col', 'Tác vụ tạo mới')]: e.tasks_created,
      [t('wl.tasks_updated_col', 'Tác vụ xử lý/cập nhật')]: e.tasks_updated,
      [t('wl.total_tasks_col', 'Tổng sản lượng tác vụ')]: e.audit_actions,
      [t('wl.last_active_col', 'Hoạt động gần nhất')]: e.last_active || 'N/A'
    }));
  } else {
    rows = (workloadState.data.opportunities || []).map(o => ({
      [t('wl.col_opp_id', 'Mã Dự Án')]: o.project_id,
      [t('wl.col_opp_name', 'Tên Cơ Hội')]: o.project_name,
      [t('wl.col_opp_status', 'Trạng Thái')]: wlGetOppStatusLabel(o.status_info, o.status),
      [t('wl.col_sale_lead', 'Chủ Trì (Sale Lead)')]: o.sale_lead_name,
      [t('wl.pipeline_val', 'Dự kiến')]: o.estimated_revenue,
      [t('wl.contract_val', 'Hợp đồng')]: o.contract_val,
      [t('wl.paid_val', 'Đã thu')]: o.paid_val,
      [t('wl.col_team_members', 'Số nhân sự')]: o.team_count,
      [t('wl.col_linked_requests', 'Số yêu cầu liên quan')]: o.requests_count,
      [t('wl.col_task_progress', 'Số nhiệm vụ')]: o.tasks_count,
      [t('wl.tasks_completed_rate', 'Nhiệm vụ hoàn thành')]: o.tasks_completed_count,
      [t('wl.col_req_created', 'Ngày tạo')]: o.create_date || 'N/A'
    }));
  }

  const prefix = workloadState.perspective === 'request' ? 'Bao_cao_Workload_Request' : 'Bao_cao_Workload_Opportunity';

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workload Report');
    XLSX.writeFile(wb, `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(t('wl.export_success', 'Đã xuất file Excel thành công'), 'success');
  } else {
    const headers = Object.keys(rows[0] || {});
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast(t('wl.export_csv_success', 'Đã tải xuống file CSV thành công'), 'success');
  }
};
