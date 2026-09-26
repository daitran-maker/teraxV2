/**
 * TeraX – Setup Wizard (Light Theme)
 * i18n compliant, CMS DB lookups with top 5 popular prioritized,
 * clean department setup, full required employee fields, flexible multi-tier approval policies.
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedEmployees = [];
window.setupStep2ActiveTab = 'choose';
window.setupStep3ActiveTab = 'quick';
window.setupStep4ActiveTab = 'library';
window.setupStep4Category = 'all';
window.setupStep4Search = '';
window.setupStep4ApprovalLevel = 'Tier 1';

// ─── i18n helper ─────────────────────────────────────────────
function swT(key, fallback) {
  if (typeof t === 'function') {
    return t(key, fallback);
  }
  return fallback;
}

// ─── CSS helper injected once ───────────────────────────────
function injectSetupStyles() {
  if (document.getElementById('setup-wizard-styles')) return;
  const style = document.createElement('style');
  style.id = 'setup-wizard-styles';
  style.textContent = `
    .sw-card { background:rgba(255,255,255,0.85); border:1px solid rgba(255,255,255,0.9); border-radius:16px; padding:24px; backdrop-filter:blur(12px); box-shadow:0 4px 24px rgba(0,0,0,0.06); }
    .sw-input { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; transition:border 0.2s; box-sizing:border-box; }
    .sw-input:focus { outline:none; border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,0.1); }
    .sw-select { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; box-sizing:border-box; }
    .sw-label { font-size:11.5px; font-weight:600; color:#374151; display:block; margin-bottom:5px; }
    .sw-btn-primary { display:inline-flex; align-items:center; gap:8px; padding:10px 22px; border-radius:10px; border:none; background:linear-gradient(135deg,#f97316,#ea580c); color:white; font-size:13.5px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(249,115,22,0.3); transition:var(--transition); }
    .sw-btn-ghost { padding:9px 14px; border:none; background:transparent; color:#9CA3AF; font-size:12.5px; cursor:pointer; }
    .sw-btn-back { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:10px; border:1px solid #E5E7EB; background:#F9FAFB; color:#374151; font-size:13px; cursor:pointer; }
    .sw-tab-bar { display:flex; gap:2px; background:#F3F4F6; border-radius:10px; padding:3px; margin-bottom:20px; }
    .sw-tab { flex:1; padding:8px 12px; border-radius:8px; border:none; font-size:12.5px; font-weight:600; cursor:pointer; transition:var(--transition); background:transparent; color:#6B7280; }
    .sw-tab.active { background:#ffffff; color:#ea580c; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
    .sw-sidebar-card { background:rgba(255,255,255,0.85); border:1px solid rgba(255,255,255,0.9); border-radius:16px; padding:18px; backdrop-filter:blur(12px); box-shadow:0 4px 24px rgba(0,0,0,0.06); }
    .sw-step-item { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:10px; cursor:pointer; transition:var(--transition); }
    .sw-step-item:hover { background:#FFF7ED; }
    .sw-step-item.active { background:#FFF7ED; border-left:3px solid #f97316; }
    .sw-step-item.inactive { border-left:3px solid transparent; }
    .sw-upload-zone { border:2px dashed #FED7AA; border-radius:14px; padding:32px; text-align:center; background:#FFF7ED; }
    .sw-preset-card { cursor:pointer; display:flex; align-items:flex-start; gap:10px; padding:14px; border-radius:12px; border:1.5px solid #E5E7EB; background:#FFFFFF; transition:var(--transition); }
    .sw-preset-card:hover { border-color:#FDBA74; background:#FFF7ED; }
    .sw-policy-card { cursor:pointer; display:flex; flex-direction:column; padding:14px; border-radius:12px; border:1.5px solid #E5E7EB; background:#FFFFFF; transition:var(--transition); }
    .sw-policy-card:hover { border-color:#FDBA74; }
    .sw-policy-card.checked { border-color:#f97316; background:#FFF7ED; }
    .sw-mode-card { cursor:pointer; display:flex; align-items:flex-start; gap:10px; padding:14px; border-radius:12px; border:2px solid #E5E7EB; background:#FFFFFF; transition:var(--transition); }
    .sw-mode-card.active { border-color:#f97316; background:#FFF7ED; }
    .sw-info-box { padding:12px 14px; border-radius:10px; background:#EFF6FF; border:1px solid #BFDBFE; font-size:12px; color:#1E40AF; }
    .sw-search-dropdown { position:relative; width:100%; }
    .sw-search-display { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:space-between; user-select:none; box-sizing:border-box; }
    .sw-search-display:focus, .sw-search-display.open { border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,0.1); }
    .sw-search-menu { position:absolute; top:calc(100% + 4px); left:0; width:100%; max-height:240px; overflow-y:auto; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05); z-index:999; display:none; }
    .sw-search-input { width:100%; padding:8px 12px; border:none; border-bottom:1px solid #F3F4F6; font-size:12.5px; outline:none; font-family:inherit; box-sizing:border-box; }
    .sw-search-item { padding:9px 14px; font-size:12.5px; color:#1F2937; cursor:pointer; transition:background 0.15s; }
    .sw-search-item:hover, .sw-search-item.highlighted { background:#FFF7ED; color:#EA580C; }
    .sw-search-item.selected { font-weight:700; background:#FFF7ED; color:#EA580C; }
    .sw-emp-card { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; padding:14px; margin-bottom:12px; transition:box-shadow 0.2s; }
    .sw-emp-card:hover { box-shadow:0 2px 10px rgba(0,0,0,0.04); }
  `;
  document.head.appendChild(style);
}
injectSetupStyles();

window.loadSetupView = async function () {
  currentModule = 'setup'; currentView = 'setup';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.id === 'nav-setup'));
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = swT('sw.title', 'Thiết lập ban đầu');
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) { subtitleEl.textContent = swT('sw.subtitle', 'Khởi tạo không gian làm việc theo 5 bước'); subtitleEl.style.display = 'block'; }
  const actionsEl = document.getElementById('topbar-actions-custom');
  if (actionsEl) actionsEl.innerHTML = '';
  updateGlobalStatusCards('');
  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) tabsBar.style.display = 'none';
  injectSetupStyles();
  await renderSetupContent();
};

// ── Cache: chỉ fetch API khi cần thiết ──
window._setupDataLoaded = false;

window.renderSetupContent = async function (forceRefresh) {
  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  if (!window._setupDataLoaded || forceRefresh) {
    contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#374151;"><div class="spinner" style="margin:0 auto 12px;"></div> ' + swT('sw.loading', 'Đang tải thông tin thiết lập...') + '</div>';
    try {
      const [statusRes, dataRes] = await Promise.all([apiGet('/system-setup/status'), apiGet('/system-setup/data')]);
      window.setupCompleted = statusRes.setupCompleted;
      window.setupTableCounts = statusRes.tableCounts || {};
      window.setupWizardData = dataRes || {};
      window._setupDataLoaded = true;
    } catch (err) {
      contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;"><span class="material-symbols-rounded" style="font-size:43px;">error</span><div style="font-size:14px;font-weight:600;margin-top:10px;color:#111827;">' + swT('sw.error_loading', 'Lỗi tải dữ liệu') + '</div></div>';
      return;
    }
  }
  const counts = window.setupTableCounts || {};
  const comp = window.setupWizardData.company || {};
  const currentStep = window.setupCurrentStep || 1;
  const stepDone = [counts.my_company>0, counts.department>0, counts.employee>0, counts.policy_and_program>0, counts.account>0];
  const completedCount = stepDone.filter(Boolean).length;
  const pct = Math.round((completedCount/5)*100);
  const stepLabels = [
    swT('sw.step1_name', 'Thông tin công ty'),
    swT('sw.step2_name', 'Phòng ban'),
    swT('sw.step3_name', 'Nhân viên'),
    swT('sw.step4_name', 'Quy trình'),
    swT('sw.step5_name', 'Tài khoản tiền'),
    swT('sw.step6_name', 'Bắt đầu sử dụng')
  ];

  // ── Stepper ──────────────────────────────────────────────────
  let stepperHtml = '<div style="display:flex;align-items:center;margin-bottom:24px;padding:0 4px;">';
  for (let i = 0; i < 6; i++) {
    const num = i+1, isActive = num===currentStep, isDone = num<currentStep||(num<6&&stepDone[i]);
    const cirBg  = isDone ? '#22c55e' : isActive ? '#f97316' : '#E5E7EB';
    const cirBdr = isDone ? '#22c55e' : isActive ? '#f97316' : '#D1D5DB';
    const lblColor = isActive ? '#f97316' : isDone ? '#16a34a' : '#9CA3AF';
    const lblWeight = isActive ? '700' : '500';
    const lineColor = isDone ? '#f97316' : '#E5E7EB';
    const inner = (isDone&&!isActive) ? '<span class="material-symbols-rounded" style="font-size:17px;color:white;">check</span>' : '<span style="color:'+(isActive||isDone?'white':'#6B7280')+';">'+num+'</span>';
    stepperHtml += '<div style="display:flex;align-items:center;flex:'+(i<5?'1':'0')+';">';
    stepperHtml += '<div onclick="window.setSetupStep('+num+')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;gap:5px;min-width:60px;">';
    stepperHtml += '<div style="width:34px;height:34px;border-radius:50%;background:'+cirBg+';border:2px solid '+cirBdr+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;transition:var(--transition);flex-shrink:0;box-shadow:'+(isActive?'0 0 0 4px rgba(249,115,22,0.15)':'none')+';">'+inner+'</div>';
    stepperHtml += '<div style="font-size:10.5px;font-weight:'+lblWeight+';color:'+lblColor+';text-align:center;white-space:nowrap;">'+stepLabels[i]+'</div></div>';
    if (i < 5) stepperHtml += '<div style="flex:1;height:2px;background:'+lineColor+';margin:0 4px;margin-bottom:16px;border-radius:2px;transition:var(--transition);"></div>';
    stepperHtml += '</div>';
  }
  stepperHtml += '</div>';

  // ── Progress sidebar ──────────────────────────────────────────
  const sideLabels = [
    swT('sw.step1_name', 'Thông tin công ty'),
    swT('sw.step2_name', 'Phòng ban'),
    swT('sw.step3_name', 'Nhân viên'),
    swT('sw.step4_name', 'Quy trình'),
    swT('sw.step5_name', 'Tài khoản tiền')
  ];
  let stepList = '';
  for (let i=0;i<5;i++) {
    const num=i+1, done=stepDone[i], isAct=num===currentStep;
    const st = done ? swT('sw.status_done', 'Đã hoàn thành') : isAct ? swT('sw.status_active', 'Đang thực hiện') : swT('sw.status_pending', 'Chưa thiết lập');
    const stColor = done?'#16a34a':isAct?'#ea580c':'#9CA3AF';
    const cirBg = done?'#22c55e':isAct?'#f97316':'#E5E7EB';
    const cirText = done?'<span class="material-symbols-rounded" style="font-size:13px;color:white;">check</span>':'<span style="color:'+(isAct?'white':'#6B7280')+';">'+num+'</span>';
    stepList += '<div onclick="window.setSetupStep('+num+')" class="sw-step-item '+(isAct?'active':'inactive')+'">';
    stepList += '<div style="width:22px;height:22px;border-radius:50%;background:'+cirBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;">'+cirText+'</div>';
    stepList += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#111827;">'+sideLabels[i]+'</div><div style="font-size:10.5px;color:'+stColor+';font-weight:500;">'+st+'</div></div></div>';
  }
  const tips = [
    swT('sw.tip1', 'Chọn mẫu có sẵn để tiết kiệm thời gian'),
    swT('sw.tip2', 'Không cần tạo tất cả ngay, bổ sung sau được'),
    swT('sw.tip3', 'Sau khi tạo, chỉnh sửa được bất kỳ lúc nào'),
    swT('sw.tip4', 'Quy trình nên dùng vai trò thay vì chỉ định cụ thể')
  ];
  let tipsHtml = '';
  for (const t of tips) tipsHtml += '<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#6B7280;line-height:1.5;"><span class="material-symbols-rounded" style="font-size:13px;color:#16a34a;flex-shrink:0;margin-top:1px;">check_circle</span><span>'+t+'</span></div>';
  const descText = completedCount<5
    ? swT('sw.steps_remaining', 'Còn {{count}} bước nữa là xong!').replace('{{count}}', 5-completedCount)
    : swT('sw.ready_desc', 'Tuyệt vời! Sẵn sàng sử dụng.');

  const progressSidebar = '<div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">'
    + '<div class="sw-sidebar-card">'
    + '<div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:14px;">' + swT('sw.progress_title', 'Tiến độ thiết lập') + '</div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">'
    + '<div style="position:relative;width:68px;height:68px;flex-shrink:0;">'
    + '<svg viewBox="0 0 36 36" style="width:68px;height:68px;transform:rotate(-90deg)">'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" stroke-width="3"/>'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="'+pct+' '+(100-pct)+'" stroke-linecap="round"/>'
    + '</svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#111827;">'+pct+'%</div></div>'
    + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + completedCount + '/5 ' + swT('sw.steps_completed', 'bước hoàn thành') + '</div>'
    + '<div style="font-size:11px;color:#6B7280;margin-top:3px;line-height:1.5;">'+descText+'</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+stepList+'</div>'
    + '</div>'
    + '<div class="sw-sidebar-card">'
    + '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="material-symbols-rounded" style="font-size:17px;color:#f59e0b;">lightbulb</span><span style="font-size:12px;font-weight:700;color:#111827;">' + swT('sw.useful_tips', 'Mẹo hữu ích') + '</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+tipsHtml+'</div>'
    + '</div>'
    + '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:14px;cursor:pointer;">'
    + '<div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="font-size:18px;color:#1D4ED8;">menu_book</span>'
    + '<div><div style="font-size:12px;font-weight:700;color:#1E40AF;">' + swT('sw.guide_doc', 'Tài liệu hướng dẫn') + '</div>'
    + '<div style="font-size:10.5px;color:#3B82F6;margin-top:2px;">' + swT('sw.guide_doc_link', 'Xem hướng dẫn chi tiết ↗') + '</div></div></div>'
    + '</div>'
    + '</div>';

  const supportWidget = '<div class="sw-card" style="margin-top:16px;">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div>'
    + '<div><div style="font-size:13px;font-weight:700;color:#111827;">' + swT('sw.need_support', 'Cần hỗ trợ?') + '</div><div style="font-size:11px;color:#6B7280;">' + swT('sw.support_desc', 'Đội ngũ TeraX luôn sẵn sàng hỗ trợ bạn') + '</div></div></div>'
    + '<button style="width:100%;padding:9px;border-radius:10px;border:1.5px solid #f97316;background:transparent;color:#f97316;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> ' + swT('sw.contact_support', 'Liên hệ hỗ trợ') + '</button>'
    + '</div>';

  const mainBodyHTML = currentStep===6 ? renderStep6HTML(counts, comp) : renderCurrentStepHTML(currentStep, comp, window.setupWizardData.admin||{}, counts);

  contentEl.innerHTML = '<div class="detail-scroll" style="max-width:1280px;margin:0 auto;width:100%;padding:16px 20px 60px;">'
    + '<div class="sw-card" style="padding:16px 22px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">'
    + '<div><h2 style="font-size:17px;font-weight:800;color:#111827;margin-bottom:2px;">' + swT('sw.banner_title', 'Thiết lập TeraX cho doanh nghiệp của bạn') + '</h2>'
    + '<p style="font-size:12px;color:#6B7280;">' + swT('sw.banner_desc', 'Chỉ vài bước đơn giản để bắt đầu. Bạn có thể bỏ qua và bổ sung sau.') + '</p></div>'
    + '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;padding:4px 10px;border-radius:20px;background:#FFF7ED;color:#EA580C;border:1px solid #FED7AA;font-weight:600;">'+completedCount+'/5 ' + swT('sw.steps_completed', 'bước hoàn thành') + '</span></div>'
    + '</div>'
    + '<div style="display:flex;gap:20px;align-items:flex-start;">'
    + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;">'
    + '<div class="sw-card" style="padding:20px 24px 10px;">'+stepperHtml+'</div>'
    + '<div id="setup-step-container" style="margin-top:16px;">'+mainBodyHTML+'</div>'
    + supportWidget
    + '</div>'
    + (currentStep < 6 ? progressSidebar : '')
    + '</div></div>';
};

window.setSetupStep = function(n){window.setupCurrentStep=Math.max(1,Math.min(6,n));renderSetupContent();};

function renderCurrentStepHTML(step,comp,admin,counts){switch(step){case 1:return renderStep1HTML(comp);case 2:return renderStep2HTML(counts);case 3:return renderStep3HTML(counts);case 4:return renderStep4HTML(counts);case 5:return renderStep5HTML(comp,counts);default:return renderStep1HTML(comp);}}

// ── Shared helpers ─────────────────────────────────────────────
function swStepHeader(icon, num, title, sub) {
  const badgeText = swT('sw.step_badge', 'Bước {{num}}/5').replace('{{num}}', num);
  return '<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
    + '<span style="font-size:10px;font-weight:700;color:#EA580C;background:#FFF7ED;border:1px solid #FED7AA;padding:2px 8px;border-radius:20px;">' + badgeText + '</span>'
    + '</div>'
    + '<h3 style="font-size:16px;font-weight:800;color:#111827;margin-bottom:3px;">'+title+'</h3>'
    + '<p style="font-size:12px;color:#6B7280;margin:0;">'+sub+'</p>'
    + '</div>';
}
function swTabBar(tabs, activeKey, fn) {
  let h='<div class="sw-tab-bar">';
  for(const t of tabs) h+='<button class="sw-tab '+(activeKey===t.key?'active':'')+'" onclick="'+fn+'(\''+t.key+'\')">'+t.label+'</button>';
  return h+'</div>';
}
function swBottomNav(back, skip, label, action) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    + '<button class="sw-btn-back" onclick="window.setSetupStep('+back+')"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> ' + swT('sw.btn_back', 'Quay lại') + '</button>'
    + '<div style="display:flex;gap:10px;align-items:center;">'
    + '<button class="sw-btn-ghost" onclick="window.setSetupStep('+skip+')">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
    + '<button class="sw-btn-primary" onclick="'+action+'"><span>'+label+'</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    + '</div></div>';
}
function swInput(id, ph, val, type) {
  return '<input type="'+(type||'text')+'" id="'+id+'" class="sw-input" placeholder="'+ph+'" value="'+(val||'')+'">';
}
function swLabel(text, req) {
  return '<label class="sw-label">'+text+(req?' <span style="color:#ef4444;">*</span>':'')+'</label>';
}

// ─────────────────────────────────────────────────────────────
//  STEP 1: CÔNG TY
// ─────────────────────────────────────────────────────────────
window._setupLookupCache = {};
async function fetchLookup(key, apiPath) {
  if (window._setupLookupCache[key]) return window._setupLookupCache[key];
  try {
    const res = await apiGet(apiPath);
    window._setupLookupCache[key] = res.data || [];
  } catch(e) {
    window._setupLookupCache[key] = [];
  }
  return window._setupLookupCache[key];
}

// Setup searchable dropdown for country & currency
window.swSearchOptions = {
  country: [],
  currency: []
};

window.toggleSwSearchDropdown = function(type, forceOpen) {
  const menu = document.getElementById('sw_search_menu_' + type);
  const display = document.getElementById('sw_search_display_' + type);
  if (!menu || !display) return;
  const isHidden = menu.style.display === 'none' || menu.style.display === '';
  const shouldOpen = forceOpen !== undefined ? forceOpen : isHidden;

  // Close all other dropdowns first
  document.querySelectorAll('.sw-search-menu').forEach(m => {
    if (m !== menu) m.style.display = 'none';
  });
  document.querySelectorAll('.sw-search-display').forEach(d => {
    if (d !== display) d.classList.remove('open');
  });

  if (shouldOpen) {
    menu.style.display = 'block';
    display.classList.add('open');
    const input = document.getElementById('sw_search_input_' + type);
    if (input) {
      input.value = '';
      window.filterSwSearchOptions(type, '');
      setTimeout(() => input.focus(), 50);
    }
  } else {
    menu.style.display = 'none';
    display.classList.remove('open');
  }
};

window.filterSwSearchOptions = function(type, term) {
  const listEl = document.getElementById('sw_search_list_' + type);
  if (!listEl) return;
  const options = window.swSearchOptions[type] || [];
  const q = String(term || '').trim().toLowerCase();
  const currentVal = document.getElementById('step1_' + type)?.value || '';

  const filtered = q
    ? options.filter(o => o.searchLabel.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    : options;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:12px;text-align:center;color:#9CA3AF;font-size:12px;">' + swT('form.no_results', 'Không tìm thấy kết quả') + '</div>';
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const isSelected = String(o.value).toLowerCase() === String(currentVal).toLowerCase();
    return '<div class="sw-search-item ' + (isSelected ? 'selected' : '') + '" onclick="window.selectSwSearchOption(\'' + type + '\', \'' + escapeHTML(o.value).replace(/'/g, "\\'") + '\', \'' + escapeHTML(o.label).replace(/'/g, "\\'") + '\')">' + escapeHTML(o.label) + '</div>';
  }).join('');
};

window.selectSwSearchOption = function(type, val, label) {
  const hiddenInput = document.getElementById('step1_' + type);
  const labelEl = document.getElementById('sw_search_label_' + type);
  if (hiddenInput) hiddenInput.value = val;
  if (labelEl) labelEl.textContent = label;
  window.toggleSwSearchDropdown(type, false);
};

// Global click to close search dropdowns
document.addEventListener('click', function(e) {
  if (!e.target.closest('.sw-search-dropdown')) {
    document.querySelectorAll('.sw-search-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.sw-search-display').forEach(d => d.classList.remove('open'));
  }
});

function renderStep1HTML(comp) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Ho_Chi_Minh';
  const defaultCountry = comp.country || 'Vietnam';
  const defaultCurrency = (comp.base_currency || 'VND').toUpperCase();

  // Async load lookups from CMS database via /system-setup/lookups
  setTimeout(async () => {
    const [cts, cus] = await Promise.all([
      fetchLookup('countries', '/system-setup/lookups/countries'),
      fetchLookup('currencies', '/system-setup/lookups/currencies')
    ]);

    // Format countries: 5 popular already prioritized at top from backend
    window.swSearchOptions.country = cts.map(c => ({
      value: c.name,
      label: c.display_name || c.name,
      searchLabel: (c.code ? c.code + ' ' : '') + (c.name || '') + ' ' + (c.display_name || '')
    }));

    // Format currencies: 5 popular already prioritized at top from backend
    window.swSearchOptions.currency = cus.map(c => ({
      value: c.code,
      label: c.code,
      searchLabel: c.code + ' ' + (c.label || '')
    }));

    // Set initial display labels
    const matchedCountry = window.swSearchOptions.country.find(c =>
      c.value.toLowerCase() === defaultCountry.toLowerCase() ||
      c.label.toLowerCase().includes(defaultCountry.toLowerCase())
    );
    const countryLabelEl = document.getElementById('sw_search_label_country');
    if (countryLabelEl && matchedCountry) countryLabelEl.textContent = matchedCountry.label;

    const matchedCurrency = window.swSearchOptions.currency.find(c => c.value.toUpperCase() === defaultCurrency);
    const currencyLabelEl = document.getElementById('sw_search_label_currency');
    if (currencyLabelEl && matchedCurrency) currencyLabelEl.textContent = matchedCurrency.label;

    window.filterSwSearchOptions('country', '');
    window.filterSwSearchOptions('currency', '');
  }, 0);

  return '<div class="sw-card">'
    + swStepHeader('apartment', 1, swT('sw.step1_header', 'Thông tin công ty'), swT('sw.step1_desc', 'Tạo cơ sở dữ liệu nền tảng cho doanh nghiệp. Có thể chỉnh sửa sau.'))
    + '<form id="form-step1" onsubmit="event.preventDefault();saveStep1AndAdvance();">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel(swT('sw.step1_fullname', 'Tên đầy đủ công ty / doanh nghiệp'), true)+swInput('step1_fullname', swT('sw.step1_fullname_ph', 'VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ TERAX'), escapeHTML(comp.company_fullname||''))+'</div>'
    + '<div class="form-group">'+swLabel(swT('sw.step1_shortname', 'Tên viết tắt / Brand Name'), true)+swInput('step1_shortname', swT('sw.step1_shortname_ph', 'VD: TERAX'), escapeHTML(comp.company_shortname||''))+'</div>'
    + '<div class="form-group">'+swLabel(swT('sw.step1_tax_code', 'Mã số thuế'), false)+swInput('step1_tax_code', swT('sw.step1_tax_code_ph', 'VD: 0101234567'), escapeHTML(comp.tax_code||''))+'</div>'

    // Country Searchable Select (top 5 popular first, flat list, searchable)
    + '<div class="form-group">'+swLabel(swT('sw.step1_country', 'Quốc gia'), true)
    + '<div class="sw-search-dropdown">'
    + '<input type="hidden" id="step1_country" value="'+escapeHTML(defaultCountry)+'">'
    + '<div class="sw-search-display" id="sw_search_display_country" onclick="window.toggleSwSearchDropdown(\'country\')">'
    + '<span id="sw_search_label_country">'+escapeHTML(defaultCountry)+'</span>'
    + '<span class="material-symbols-rounded" style="font-size:18px;color:#6B7280;">arrow_drop_down</span>'
    + '</div>'
    + '<div class="sw-search-menu" id="sw_search_menu_country">'
    + '<input type="text" class="sw-search-input" id="sw_search_input_country" placeholder="'+swT('sw.step1_search_country', 'Tìm kiếm quốc gia...')+'" oninput="window.filterSwSearchOptions(\'country\', this.value)" onclick="event.stopPropagation()">'
    + '<div id="sw_search_list_country"></div>'
    + '</div></div></div>'

    // Currency Searchable Select (top 5 popular first, flat list, searchable)
    + '<div class="form-group">'+swLabel(swT('sw.step1_currency', 'Đơn vị tiền tệ chính'), true)
    + '<div class="sw-search-dropdown">'
    + '<input type="hidden" id="step1_currency" value="'+escapeHTML(defaultCurrency)+'">'
    + '<div class="sw-search-display" id="sw_search_display_currency" onclick="window.toggleSwSearchDropdown(\'currency\')">'
    + '<span id="sw_search_label_currency">'+escapeHTML(defaultCurrency)+'</span>'
    + '<span class="material-symbols-rounded" style="font-size:18px;color:#6B7280;">arrow_drop_down</span>'
    + '</div>'
    + '<div class="sw-search-menu" id="sw_search_menu_currency">'
    + '<input type="text" class="sw-search-input" id="sw_search_input_currency" placeholder="'+swT('sw.step1_search_currency', 'Tìm kiếm loại tiền tệ...')+'" oninput="window.filterSwSearchOptions(\'currency\', this.value)" onclick="event.stopPropagation()">'
    + '<div id="sw_search_list_currency"></div>'
    + '</div></div></div>'

    + '<div class="form-group" style="grid-column:span 2;">'+swLabel(swT('sw.step1_address', 'Địa chỉ trụ sở chính'), false)+swInput('step1_address', swT('sw.step1_address_ph', 'VD: Tầng 5, Tòa nhà Landmark, Hà Nội'), escapeHTML(comp.address||''))+'</div>'
    + '<div class="form-group">'+swLabel(swT('sw.step1_website', 'Website'), false)+swInput('step1_website', 'https://terax.ai', escapeHTML(comp.website||''))+'</div>'
    + '<div class="form-group">'+swLabel(swT('sw.step1_timezone', 'Múi giờ hệ thống'), false)+'<input type="text" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;cursor:default;" value="'+tz+'"></div>'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel(swT('sw.step1_logo', 'Logo thương hiệu công ty'), false)
    + '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;">'
    + '<div id="step1_logo_preview" style="width:48px;height:48px;border-radius:8px;background:#FFFFFF;border:1px dashed #D1D5DB;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">'
    + (comp.logo ? '<img src="'+(comp.logo.startsWith('data:')?comp.logo:'data:image/png;base64,'+comp.logo)+'" style="width:100%;height:100%;object-fit:contain;">' : '<span class="material-symbols-rounded" style="color:#9CA3AF;font-size:24px;">image</span>')
    + '</div>'
    + '<div style="flex:1;">'
    + '<input type="file" id="step1_logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="window.handleStep1Logo(event)" style="font-size:12px;color:#4B5563;">'
    + '<div style="font-size:11px;color:#9CA3AF;margin-top:3px;">' + swT('sw.step1_logo_tip', 'Khuyến nghị ảnh định dạng PNG nền trong suốt, dung lượng tối đa 1MB.') + '</div>'
    + '</div></div></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(2)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
    + '<button type="submit" class="sw-btn-primary"><span>' + swT('sw.btn_save_continue', 'Lưu và tiếp tục') + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    + '</div></form></div>';
}

window.step1LogoBase64 = null;
window.handleStep1Logo = function(e){
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 1024 * 1024){ showToast(swT('sw.step1_logo_large', 'Kích thước ảnh quá lớn! Tối đa 1MB'),'warning'); e.target.value=''; return; }
  const reader = new FileReader();
  reader.onload = (evt) => {
    window.step1LogoBase64 = evt.target.result;
    const prev = document.getElementById('step1_logo_preview');
    if(prev) prev.innerHTML = '<img src="'+evt.target.result+'" style="width:100%;height:100%;object-fit:contain;">';
  };
  reader.readAsDataURL(file);
};

window.saveStep1AndAdvance = async function(){
  const fn=document.getElementById('step1_fullname')?.value?.trim(),sn=document.getElementById('step1_shortname')?.value?.trim();
  if(!fn||!sn){showToast(swT('sw.step1_required_error', 'Vui lòng điền tên đầy đủ và tên viết tắt'),'warning');return;}
  try{
    showToast(swT('sw.step1_saving', 'Đang lưu thông tin công ty...'),'info');
    const res=await apiPost('/system-setup/company',{
      company_fullname:fn,
      company_shortname:sn,
      tax_code:document.getElementById('step1_tax_code')?.value?.trim(),
      country:document.getElementById('step1_country')?.value,
      base_currency:document.getElementById('step1_currency')?.value,
      address:document.getElementById('step1_address')?.value?.trim(),
      website:document.getElementById('step1_website')?.value?.trim(),
      logo: window.step1LogoBase64 || null
    });
    if(res.success){showToast(swT('sw.step1_saved', 'Đã lưu thông tin công ty!'),'success');window.setupCurrentStep=2;await renderSetupContent(true);}
    else showToast(res.error||'Lưu thất bại','error');
  }catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 2: PHÒNG BAN (Mã PB, Tên PB, Người quản lý tùy chọn - Bỏ Operation/Finance)
// ─────────────────────────────────────────────────────────────
const DEPT_ICONS={BGD:{icon:'workspace_premium',color:'#D97706',bg:'#FEF3C7'},HCNS:{icon:'supervised_user_circle',color:'#2563EB',bg:'#EFF6FF'},TCKT:{icon:'account_balance',color:'#059669',bg:'#ECFDF5'},KD:{icon:'bar_chart',color:'#EA580C',bg:'#FFF7ED'},KT:{icon:'construction',color:'#7C3AED',bg:'#F5F3FF'},IT:{icon:'laptop',color:'#0284C7',bg:'#F0F9FF'},MH:{icon:'shopping_cart',color:'#DB2777',bg:'#FDF2F8'},CSKH:{icon:'headset_mic',color:'#0D9488',bg:'#F0FDFA'},PC:{icon:'gavel',color:'#9333EA',bg:'#FAF5FF'}};
const PRESET_DEPARTMENTS=[
  {code:'BGD',name:'Ban Giám đốc',desc:'Điều hành và quản trị doanh nghiệp',checked:true},
  {code:'HCNS',name:'Hành chính – Nhân sự',desc:'Quản lý nhân sự, hành chính, pháp chế',checked:true},
  {code:'TCKT',name:'Tài chính – Kế toán',desc:'Tài chính, kế toán, thuế',checked:true},
  {code:'KD',name:'Kinh doanh',desc:'Phát triển thị trường, chăm sóc khách hàng',checked:true},
  {code:'KT',name:'Kỹ thuật',desc:'Triển khai dự án, kỹ thuật, vận hành',checked:true},
  {code:'IT',name:'CNTT',desc:'Hạ tầng, hệ thống, hỗ trợ IT',checked:false},
  {code:'MH',name:'Mua hàng',desc:'Mua sắm, nhà cung cấp',checked:false},
  {code:'CSKH',name:'Chăm sóc khách hàng',desc:'Hỗ trợ khách hàng, dịch vụ',checked:false},
  {code:'PC',name:'Pháp chế',desc:'Pháp lý, tuân thủ',checked:false}
];

window.switchStep2Tab=function(t){window.setupStep2ActiveTab=t;renderSetupContent();};

function renderStep2HTML(counts){
  const tab=window.setupStep2ActiveTab;
  let tc='';
  if(tab==='choose'){
    let cards='';
    for(const d of PRESET_DEPARTMENTS){
      cards+='<label class="sw-preset-card"><input type="checkbox" name="preset_dept" value="'+d.code+'" '+(d.checked?'checked':'')+' style="margin-top:2px;accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+d.name+' ('+d.code+')</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+d.desc+'</div></div></label>';
    }
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step2_choose_desc', 'Chọn các phòng ban phù hợp với doanh nghiệp. Có thể chỉnh sửa sau.') + '</p>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">'+cards+'</div>'
      +'<button onclick="showCustomDeptForm()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px dashed #D1D5DB;background:#F9FAFB;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> ' + swT('sw.step2_add_custom', 'Thêm phòng ban tùy chỉnh') + '</button>'
      +'<div id="custom-dept-form" style="display:none;margin-top:12px;padding:16px;border-radius:12px;border:1px solid #E5E7EB;background:#F9FAFB;">'
      +'<div style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:10px;align-items:end;">'
      +'<div>'+swLabel(swT('sw.step2_dept_code', 'Mã phòng ban'), true)+swInput('custom_dept_code', swT('sw.step2_dept_code_ph', 'VD: MKT'), '')+'</div>'
      +'<div>'+swLabel(swT('sw.step2_dept_name', 'Tên phòng ban'), true)+swInput('custom_dept_name', swT('sw.step2_dept_name_ph', 'VD: Marketing'), '')+'</div>'
      +'<div>'+swLabel(swT('sw.step2_dept_manager', 'Người quản lý (tùy chọn)'), false)+swInput('custom_dept_mgr', swT('sw.step2_dept_mgr_ph', 'VD: manager@company.com'), '')+'</div>'
      +'<div><button onclick="addCustomDeptToList()" class="sw-btn-primary" style="padding:10px 16px;">+ ' + swT('common.add', 'Thêm') + '</button></div>'
      +'</div></div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'department\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'department\')"></label></div></div>';
  } else if(tab==='quick'){
    // Quick Add: Only 3 fields (Mã PB, Tên PB, Người quản lý tùy chọn) - No Operation/Finance dropdown
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qdept-code" placeholder="' + swT('sw.step2_dept_code', 'Mã PB') + ' *"><input type="text" class="sw-input qdept-name" placeholder="' + swT('sw.step2_dept_name', 'Tên phòng ban') + ' *"><input type="text" class="sw-input qdept-manager" placeholder="' + swT('sw.step2_dept_manager', 'Người quản lý (tùy chọn)') + '"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step2_desc', 'Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.') + '</p><div id="quick-dept-rows">'+r3+'</div><button onclick="addQuickDeptRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> ' + swT('sw.step2_add_row', 'Thêm dòng') + '</button></div>';
  } else {
    tc='<div><div style="background:#F9FAFB;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="padding:10px 16px;background:#F3F4F6;font-size:12px;font-weight:700;color:#374151;">' + swT('sw.step2_header', 'Thiết lập phòng ban') + ': <strong style="color:#16a34a;">'+(counts.department||0)+'</strong> ' + swT('sw.step2_name', 'Phòng ban') + '</div>'+(counts.department>0?'<div style="padding:16px;font-size:12px;color:#6B7280;">' + swT('sw.step2_choose_desc', 'Chọn các phòng ban phù hợp với doanh nghiệp.') + '</div>':'<div style="padding:20px;text-align:center;font-size:12px;color:#9CA3AF;">' + swT('sw.status_pending', 'Chưa thiết lập') + '</div>')+'</div></div>';
  }
  return '<div class="sw-card">'+swStepHeader('account_tree',2, swT('sw.step2_header', 'Thiết lập phòng ban'), swT('sw.step2_desc', 'Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.'))+swTabBar([{key:'choose',label:swT('sw.step2_tab_choose', 'Chọn mẫu')},{key:'excel',label:swT('sw.step2_tab_excel', 'Nhập từ Excel')},{key:'quick',label:swT('sw.step2_tab_quick', 'Nhập nhanh')},{key:'preview',label:swT('sw.step2_tab_preview', 'Xem trước')}],tab,'window.switchStep2Tab')+tc+swBottomNav(1,3, swT('sw.step2_save_btn', 'Tạo các phòng ban đã chọn'),'saveStep2AndAdvance()')+'</div>';
}

window.showCustomDeptForm=function(){const el=document.getElementById('custom-dept-form');if(el)el.style.display=el.style.display==='none'?'block':'none';};
window.addQuickDeptRow=function(){
  const c=document.getElementById('quick-dept-rows');if(!c)return;
  const d=document.createElement('div');
  d.style.cssText='display:grid;grid-template-columns:120px 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;';
  d.innerHTML='<input type="text" class="sw-input qdept-code" placeholder="' + swT('sw.step2_dept_code', 'Mã PB') + ' *"><input type="text" class="sw-input qdept-name" placeholder="' + swT('sw.step2_dept_name', 'Tên phòng ban') + ' *"><input type="text" class="sw-input qdept-manager" placeholder="' + swT('sw.step2_dept_manager', 'Người quản lý (tùy chọn)') + '"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';
  c.appendChild(d);
};

window.addCustomDeptToList=function(){
  const code=document.getElementById('custom_dept_code')?.value?.trim(),
        name=document.getElementById('custom_dept_name')?.value?.trim(),
        mgr=document.getElementById('custom_dept_mgr')?.value?.trim();
  if(!code||!name){showToast(swT('sw.step2_required_error', 'Vui lòng điền đủ Mã và Tên phòng ban'),'warning');return;}
  PRESET_DEPARTMENTS.push({code, name, desc: mgr ? 'Quản lý: ' + mgr : name, checked:true, manager: mgr});
  showToast(swT('sw.step2_added', 'Đã thêm phòng ban') + ' "' + name + '" (' + code + ')','info');
  renderSetupContent();
};

window.saveStep2AndAdvance=async function(){
  const tab=window.setupStep2ActiveTab;
  if(tab==='quick'){
    const codes=document.querySelectorAll('.qdept-code'),
          names=document.querySelectorAll('.qdept-name'),
          mgrs=document.querySelectorAll('.qdept-manager'),
          payload=[];
    codes.forEach((c,i)=>{
      const code=c.value.trim(), name=names[i]?.value?.trim(), mgr=mgrs[i]?.value?.trim();
      if(code&&name) payload.push({department_code:code, department_name:name, manager_email:mgr||null, type:'Operation'});
    });
    if(!payload.length){window.setSetupStep(3);return;}
    try{
      const res=await apiPost('/system-setup/presets/departments',{departments:payload});
      if(res.success){
        showToast(swT('sw.step2_created', 'Đã tạo {{count}} phòng ban!').replace('{{count}}', res.count),'success');
        window.setupCurrentStep=3;await renderSetupContent(true);
      } else showToast(res.error||'Lỗi','error');
    }catch(err){showToast('Lỗi: '+err.message,'error');}
    return;
  }
  const cbs=document.querySelectorAll('input[name="preset_dept"]:checked'),sels=Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(3);return;}
  const payload=PRESET_DEPARTMENTS.filter(d=>sels.includes(d.code)).map(d=>({
    department_code:d.code,
    department_name:d.name,
    manager_email:d.manager||null,
    type:'Operation'
  }));
  try{
    showToast(swT('sw.step2_creating', 'Đang tạo phòng ban...'),'info');
    const res=await apiPost('/system-setup/presets/departments',{departments:payload});
    if(res.success){
      showToast(swT('sw.step2_created', 'Đã tạo {{count}} phòng ban!').replace('{{count}}', res.count),'success');
      window.setupCurrentStep=3;await renderSetupContent(true);
    } else showToast(res.error||'Lỗi','error');
  }catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 3: NHÂN VIÊN (Toàn bộ các cột bắt buộc của Form Employee)
// ─────────────────────────────────────────────────────────────
window.switchStep3Tab=function(t){window.setupStep3ActiveTab=t;renderSetupContent();};

function renderStep3HTML(counts){
  const tab=window.setupStep3ActiveTab,parsed=window.setupParsedEmployees||[];
  const todayStr=new Date().toISOString().split('T')[0];
  const modes=[
    {key:'quick',icon:'bolt',color:'#EA580C',bg:'#FFF7ED',title:swT('sw.step3_tab_quick', 'Thêm nhanh'),desc:swT('sw.step3_desc', 'Nhập trực tiếp các nhân viên chính.')},
    {key:'excel',icon:'table_view',color:'#059669',bg:'#ECFDF5',title:swT('sw.step3_tab_excel', 'Nhập từ Excel'),desc:swT('sw.step3_drag_drop', 'Tải lên file Excel đầy đủ cột.')},
    {key:'sample',icon:'description',color:'#7C3AED',bg:'#F5F3FF',title:swT('sw.step3_tab_sample', 'Dùng dữ liệu mẫu'),desc:swT('sw.step3_download_tpl', 'Tải file mẫu chuẩn TeraX.')}
  ];
  let modeCards='';
  for(const m of modes)modeCards+='<label onclick="window.switchStep3Tab(\''+m.key+'\')" class="sw-mode-card '+(tab===m.key?'active':'')+'"><div style="width:38px;height:38px;border-radius:10px;background:'+m.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:20px;color:'+m.color+';">'+m.icon+'</span></div><div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+m.title+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+m.desc+'</div></div></label>';

  let tc='';
  if(tab==='quick'){
    // Quick entry with full required employee fields:
    // Full Name *, Username *, Email *, Department, Position, Start Date *, Direct Mgr *, HR Mgr *, Emergency Contact Name *, Emergency Contact Phone *
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step3_sample_desc', 'File mẫu nhân viên chuẩn TeraX gồm đầy đủ các cột bắt buộc: Họ tên, Tên đăng nhập, Email, Phòng ban, Chức vụ, Ngày bắt đầu, Quản lý trực tiếp, Quản lý nhân sự, Người liên hệ khẩn cấp và SĐT.') + '</p>'
      +'<div id="quick-emp-container">'
      +renderQuickEmpCard(0, {full_name:'', username:'', email:'', dept:'', pos:'', start_date:todayStr, direct_mgr:'Super Admin', hr_mgr:'Super Admin', emg_name:'', emg_phone:''})
      +'</div>'
      +'<button onclick="addQuickEmpCard()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:6px;"><span class="material-symbols-rounded" style="font-size:16px;">person_add</span> ' + swT('sw.step3_add_emp', 'Thêm nhân viên') + '</button>'
      +'</div>';
  } else if(tab==='excel'){
    let prev='';
    if(parsed.length>0){
      const vc=parsed.filter(e=>e.full_name&&e.email).length;
      let rows='';
      for(let i=0;i<Math.min(parsed.length,10);i++){
        const e=parsed[i],v=e.full_name&&e.email;
        rows+='<tr style="border-bottom:1px solid #F1F5F9;">'
          +'<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">'+(i+1)+'</td>'
          +'<td style="padding:7px 10px;font-weight:600;color:#111827;font-size:11.5px;">'+escapeHTML(e.full_name||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#2563EB;font-size:11.5px;">'+escapeHTML(e.username||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.email||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.department_code||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.position||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.start_date||todayStr)+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.direct_manager||'–')+'</td>'
          +'<td style="padding:7px 10px;color:#374151;font-size:11.5px;">'+escapeHTML(e.emergency_contact_name ? e.emergency_contact_name + (e.emergency_contact_phone ? ' (' + e.emergency_contact_phone + ')' : '') : '–')+'</td>'
          +'<td style="padding:7px 10px;">'+(v?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">' + swT('common.valid', 'Hợp lệ') + '</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">' + swT('common.invalid', 'Lỗi') + '</span>')+'</td></tr>';
      }
      prev='<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:14px;"><span class="material-symbols-rounded" style="font-size:26px;color:#059669;">grid_on</span><div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step3_file_title', 'File nhân viên') + '</div><div style="font-size:11px;color:#6B7280;">'+parsed.length+' ' + swT('sw.step3_rows', 'dòng dữ liệu') + ' ('+vc+' ' + swT('sw.step3_valid', 'hợp lệ') + ')</div></div><button onclick="window.setupParsedEmployees=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button></div>'
        +'<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div style="overflow-x:auto;max-height:240px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;white-space:nowrap;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_name', 'Họ và tên') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_username', 'Username') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_email', 'Email') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_dept', 'Phòng ban') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_position', 'Chức vụ') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_start_date', 'Ngày bắt đầu') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_direct_mgr', 'Quản lý trực tiếp') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_emg_name', 'Liên hệ khẩn cấp') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.status', 'Trạng thái') + '</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }
    tc='<div><div class="sw-upload-zone" style="margin-bottom:16px;"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:14px;">(.xlsx, .xls, .csv)</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="downloadEmployeeTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleEmployeeExcelUpload(event)"></label></div></div>'+prev+'</div>';
  } else {
    tc='<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:14px;padding:24px;text-align:center;"><div style="width:56px;height:56px;border-radius:14px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><span class="material-symbols-rounded" style="font-size:28px;color:#7C3AED;">description</span></div><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;line-height:1.6;">' + swT('sw.step3_sample_desc', 'File mẫu nhân viên chuẩn TeraX gồm đầy đủ các cột bắt buộc: Họ tên, Tên đăng nhập, Email, Phòng ban, Chức vụ, Ngày bắt đầu, Quản lý trực tiếp, Quản lý nhân sự, Người liên hệ khẩn cấp và SĐT.') + '</div><button onclick="downloadEmployeeTemplate()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + ' (.xlsx)</button></div>';
  }
  const btnLabel = parsed.length>0 ? (swT('sw.step3_imported', 'Nhập {{count}} nhân viên').replace('{{count}}', parsed.length)) : swT('sw.btn_continue', 'Tiếp tục bước tiếp theo');
  return '<div class="sw-card">'+swStepHeader('group', 3, swT('sw.step3_header', 'Thiết lập nhân viên'), swT('sw.step3_desc', 'Nhập danh sách nhân sự. Có thể nhập từ Excel, thêm nhanh hoặc dùng dữ liệu mẫu.'))+'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">'+modeCards+'</div>'+tc+swBottomNav(2,4,btnLabel,'saveStep3AndAdvance()')+'</div>';
}

function renderQuickEmpCard(idx, data) {
  const d = data || {};
  const defaultPos = swT('sw.step3_emp_pos_default', 'Nhân viên');
  return '<div class="sw-emp-card qemp-card" data-idx="'+idx+'">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #F3F4F6;">'
    + '<div style="font-size:12px;font-weight:700;color:#EA580C;display:flex;align-items:center;gap:5px;"><span class="material-symbols-rounded" style="font-size:16px;">badge</span> ' + swT('sw.step3_name', 'Nhân viên') + ' #' + (idx+1) + '</div>'
    + '<button onclick="this.closest(\'.sw-emp-card\').remove()" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:14px;">close</span></button>'
    + '</div>'
    // 4 inputs per row, orderly and cleanly aligned
    + '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;align-items:start;">'
    // Row 1 (4 inputs)
    + '<div>'+swLabel(swT('sw.step3_emp_name', 'Họ và tên'), true)+'<input type="text" class="sw-input qemp-name" placeholder="' + swT('sw.step3_emp_name_ph', 'Họ và tên đầy đủ') + '" value="'+escapeHTML(d.full_name||'')+'" oninput="window.autoFillEmpUsername(this)"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_username', 'Tên đăng nhập'), true)+'<input type="text" class="sw-input qemp-username" placeholder="' + swT('sw.step3_emp_username_ph', 'john.doe') + '" value="'+escapeHTML(d.username||'')+'"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_email', 'Email'), true)+'<input type="email" class="sw-input qemp-email" placeholder="' + swT('sw.step3_emp_email_ph', 'john@company.com') + '" value="'+escapeHTML(d.email||'')+'" oninput="window.autoFillEmpUsernameFromEmail(this)"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_dept', 'Phòng ban'), false)+'<input type="text" class="sw-input qemp-dept" placeholder="' + swT('sw.step3_emp_dept_ph', 'Mã PB / Tên PB') + '" value="'+escapeHTML(d.dept||'')+'"></div>'
    // Row 2 (4 inputs)
    + '<div>'+swLabel(swT('sw.step3_emp_position', 'Chức vụ'), false)+'<input type="text" class="sw-input qemp-pos" placeholder="' + swT('sw.step3_emp_pos_ph', 'Chức danh') + '" value="'+escapeHTML(d.pos||defaultPos)+'"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_start_date', 'Ngày bắt đầu'), true)+'<input type="date" class="sw-input qemp-start-date" value="'+(d.start_date||new Date().toISOString().split('T')[0])+'"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_direct_mgr', 'Quản lý trực tiếp'), true)+'<input type="text" class="sw-input qemp-direct-mgr" placeholder="' + swT('sw.step3_emp_direct_mgr_ph', 'Email / Tên QL') + '" value="'+escapeHTML(d.direct_mgr||'Super Admin')+'"></div>'
    + '<div>'+swLabel(swT('sw.step3_emp_hr_mgr', 'Quản lý nhân sự'), true)+'<input type="text" class="sw-input qemp-hr-mgr" placeholder="' + swT('sw.step3_emp_hr_mgr_ph', 'Email / Tên HR') + '" value="'+escapeHTML(d.hr_mgr||'Super Admin')+'"></div>'
    // Row 3 (2 inputs spanning 2 columns each)
    + '<div style="grid-column:span 2;">'+swLabel(swT('sw.step3_emp_emg_name', 'Tên LH khẩn cấp'), true)+'<input type="text" class="sw-input qemp-emg-name" placeholder="' + swT('sw.step3_emp_emg_name_ph', 'Tên người thân') + '" value="'+escapeHTML(d.emg_name||'')+'"></div>'
    + '<div style="grid-column:span 2;">'+swLabel(swT('sw.step3_emp_emg_phone', 'SĐT LH khẩn cấp'), true)+'<input type="text" class="sw-input qemp-emg-phone" placeholder="' + swT('sw.step3_emp_emg_phone_ph', '0901234567') + '" value="'+escapeHTML(d.emg_phone||'')+'"></div>'
    + '</div>'
    + '</div>';
}

window.autoFillEmpUsername = function(nameEl) {
  const card = nameEl.closest('.qemp-card');
  if (!card) return;
  const usernameEl = card.querySelector('.qemp-username');
  if (!usernameEl || usernameEl.dataset.customized === 'true') return;
  const nameVal = nameEl.value.trim().toLowerCase();
  if (nameVal && !usernameEl.value) {
    const slug = nameVal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    usernameEl.value = slug;
  }
};

window.autoFillEmpUsernameFromEmail = function(emailEl) {
  const card = emailEl.closest('.qemp-card');
  if (!card) return;
  const usernameEl = card.querySelector('.qemp-username');
  if (!usernameEl || usernameEl.dataset.customized === 'true') return;
  const emailVal = emailEl.value.trim().toLowerCase();
  if (emailVal.includes('@')) {
    usernameEl.value = emailVal.split('@')[0];
  }
};

window.addQuickEmpCard = function(){
  const c = document.getElementById('quick-emp-container');
  if (!c) return;
  const idx = c.querySelectorAll('.qemp-card').length;
  const div = document.createElement('div');
  div.innerHTML = renderQuickEmpCard(idx, {full_name:'', username:'', email:'', dept:'', pos:'', start_date:new Date().toISOString().split('T')[0], direct_mgr:'Super Admin', hr_mgr:'Super Admin', emg_name:'', emg_phone:''});
  c.appendChild(div.firstElementChild);
};

window.downloadEmployeeTemplate = function(){
  const h = [
    'Họ và tên *',
    'Tên đăng nhập *',
    'Email *',
    'Phòng ban (Mã hoặc Tên)',
    'Chức vụ',
    'Ngày bắt đầu (YYYY-MM-DD) *',
    'Email Quản lý trực tiếp *',
    'Email Quản lý nhân sự *',
    'Tên liên hệ khẩn cấp *',
    'SĐT liên hệ khẩn cấp *'
  ];
  const today = new Date().toISOString().split('T')[0];
  const data = [
    {
      'Họ và tên *': 'Nguyễn Văn Quản Lý',
      'Tên đăng nhập *': 'nguyen.quanly',
      'Email *': 'manager@company.com',
      'Phòng ban (Mã hoặc Tên)': 'KD',
      'Chức vụ': 'Trưởng phòng',
      'Ngày bắt đầu (YYYY-MM-DD) *': today,
      'Email Quản lý trực tiếp *': 'admin@company.com',
      'Email Quản lý nhân sự *': 'admin@company.com',
      'Tên liên hệ khẩn cấp *': 'Nguyễn Thị Vợ',
      'SĐT liên hệ khẩn cấp *': '0901234567'
    },
    {
      'Họ và tên *': 'Trần Thị Nhân Viên',
      'Tên đăng nhập *': 'tran.nhanvien',
      'Email *': 'staff@company.com',
      'Phòng ban (Mã hoặc Tên)': 'KD',
      'Chức vụ': 'Chuyên viên',
      'Ngày bắt đầu (YYYY-MM-DD) *': today,
      'Email Quản lý trực tiếp *': 'manager@company.com',
      'Email Quản lý nhân sự *': 'admin@company.com',
      'Tên liên hệ khẩn cấp *': 'Trần Văn Mẹ',
      'SĐT liên hệ khẩn cấp *': '0912345678'
    }
  ];
  const ws = XLSX.utils.json_to_sheet(data, { header: h });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NhanVien');
  XLSX.writeFile(wb, 'Mau_Nhan_Vien_Chuan_TeraX.xlsx');
  showToast(swT('common.download_success', 'Đã tải xuống file mẫu'),'success');
};

window.handleEmployeeExcelUpload = function(event){
  const file = event.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows || !rows.length) {
        showToast(swT('common.empty_file', 'File không có dòng dữ liệu'),'warning');
        return;
      }
      const mapped = [];
      for (const row of rows) {
        const k = Object.keys(row);
        const nk = k.find(x => /tên|name|họ/i.test(x) && !/khẩn|emergency|quản lý|manager/i.test(x));
        const unk = k.find(x => /username|đăng nhập|tai khoan/i.test(x));
        const ek = k.find(x => /email|thư/i.test(x) && !/quản lý|manager/i.test(x));
        const dk = k.find(x => /phòng|dept|ban/i.test(x));
        const pk = k.find(x => /chức|vị trí|title|position/i.test(x));
        const sdk = k.find(x => /ngày bắt đầu|start_date|start date/i.test(x));
        const mk = k.find(x => /quản lý trực tiếp|direct_manager|direct manager/i.test(x)) || k.find(x => /quản lý|manager/i.test(x));
        const hrmk = k.find(x => /quản lý nhân sự|hr_manager|head_manager|hr manager/i.test(x));
        const enk = k.find(x => /khẩn cấp.*tên|tên.*khẩn cấp|emergency.*name/i.test(x));
        const epk = k.find(x => /khẩn cấp.*sđt|sđt.*khẩn cấp|phone.*emergency|emergency.*phone|điện thoại/i.test(x));

        const fn = nk ? String(row[nk]).trim() : '';
        const em = ek ? String(row[ek]).trim() : '';
        if (fn && em) {
          mapped.push({
            full_name: fn,
            username: unk ? String(row[unk]).trim() : em.split('@')[0],
            email: em,
            department_code: dk ? String(row[dk]).trim() : '',
            position: pk ? String(row[pk]).trim() : 'Nhân viên',
            start_date: sdk ? String(row[sdk]).trim() : new Date().toISOString().split('T')[0],
            direct_manager: mk ? String(row[mk]).trim() : '',
            head_manager: hrmk ? String(row[hrmk]).trim() : '',
            emergency_contact_name: enk ? String(row[enk]).trim() : '',
            emergency_contact_phone: epk ? String(row[epk]).trim() : ''
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ'),'warning');
        return;
      }
      window.setupParsedEmployees = mapped;
      showToast(swT('sw.step3_parsed_count', 'Đã nhận diện {{count}} nhân viên').replace('{{count}}', mapped.length),'success');
      renderSetupContent();
    } catch(err) {
      showToast('Lỗi đọc file: ' + err.message,'error');
    }
  };
  r.readAsArrayBuffer(file);
};

window.saveStep3AndAdvance = async function(){
  const tab = window.setupStep3ActiveTab;
  let employeesToSave = [];

  if (tab === 'quick') {
    const defaultPos = swT('sw.step3_emp_pos_default', 'Nhân viên');
    const cards = document.querySelectorAll('.qemp-card');
    cards.forEach(c => {
      const fn = c.querySelector('.qemp-name')?.value?.trim();
      const em = c.querySelector('.qemp-email')?.value?.trim();
      const un = c.querySelector('.qemp-username')?.value?.trim() || (em ? em.split('@')[0] : '');
      const dp = c.querySelector('.qemp-dept')?.value?.trim();
      const pos = c.querySelector('.qemp-pos')?.value?.trim() || defaultPos;
      const sd = c.querySelector('.qemp-start-date')?.value || new Date().toISOString().split('T')[0];
      const dm = c.querySelector('.qemp-direct-mgr')?.value?.trim();
      const hm = c.querySelector('.qemp-hr-mgr')?.value?.trim();
      const en = c.querySelector('.qemp-emg-name')?.value?.trim();
      const ep = c.querySelector('.qemp-emg-phone')?.value?.trim();

      if (fn && em) {
        employeesToSave.push({
          full_name: fn,
          username: un,
          email: em,
          department_code: dp,
          position: pos,
          start_date: sd,
          direct_manager: dm,
          head_manager: hm,
          emergency_contact_name: en,
          emergency_contact_phone: ep
        });
      }
    });
    if (!employeesToSave.length) {
      window.setSetupStep(4);
      return;
    }
  } else {
    employeesToSave = window.setupParsedEmployees || [];
  }

  if (!employeesToSave.length) {
    window.setSetupStep(4);
    return;
  }

  try {
    showToast(swT('sw.step3_importing', 'Đang nhập {{count}} nhân viên...').replace('{{count}}', employeesToSave.length),'info');
    const res = await apiPost('/system-setup/import-employees', { employees: employeesToSave });
    if (res.success) {
      showToast(swT('sw.step3_imported', 'Đã nhập {{count}} nhân viên!').replace('{{count}}', res.count),'success');
      window.setupParsedEmployees = [];
      window.setupCurrentStep = 4;
      await renderSetupContent(true);
    } else {
      showToast(res.error || 'Lỗi','error');
    }
  } catch(err) {
    showToast('Lỗi: ' + err.message,'error');
  }
};

// ─────────────────────────────────────────────────────────────
//  STEP 4: QUY TRÌNH (Cho phép cấu hình các bậc duyệt: Tier 0, 1, 2, 3)
// ─────────────────────────────────────────────────────────────
const PRESET_POLICIES_FULL=[
  {id:'P-LEAVE',name:'Leave Request',nameEn:'Leave Request',type:'Operation',cat:'Nhan su',nameVi:'Xin nghỉ phép',descEn:'Staff leave application (annual, sick, personal)',descVi:'Quy trình nhân viên xin nghỉ phép (ngày, dài ngày)',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:1,checked:true},
  {id:'P-RECRUIT',name:'Recruitment',nameEn:'Recruitment',type:'Operation',cat:'Nhan su',nameVi:'Tuyển dụng',descEn:'Hiring proposal and candidate recruitment approval',descVi:'Đề xuất và phê duyệt tuyển dụng nhân sự',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:3,checked:true},
  {id:'P-ONBOARD',name:'Onboarding',nameEn:'Onboarding',type:'Operation',cat:'Nhan su',nameVi:'Onboarding',descEn:'New employee onboarding checklist and setup',descVi:'Quy trình tiếp nhận nhân viên mới',tags:['Mới'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-OFFBOARD',name:'Offboarding',nameEn:'Offboarding',type:'Operation',cat:'Nhan su',nameVi:'Offboarding',descEn:'Handover and resignation process',descVi:'Nghỉ việc và bàn giao công việc',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false},
  {id:'P-SALARY',name:'Salary Adjustment',nameEn:'Salary Adjustment',type:'Finance',cat:'Nhan su',nameVi:'Điều chỉnh lương',descEn:'Compensation & salary adjustment proposal',descVi:'Đề xuất điều chỉnh lương, thưởng',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-STATION',name:'Office Supplies',nameEn:'Office Supplies',type:'Operation',cat:'Hanh chinh',nameVi:'Mua văn phòng phẩm',descEn:'Office stationery and supplies request',descVi:'Đề xuất mua sắm văn phòng phẩm',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:false},
  {id:'P-ASSET',name:'Asset Allocation',nameEn:'Asset Allocation',type:'Operation',cat:'Hanh chinh',nameVi:'Cấp phát tài sản',descEn:'Equipment & company asset allocation',descVi:'Yêu cầu cấp phát thiết bị, tài sản công ty',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-VEHICLE',name:'Vehicle Booking',nameEn:'Vehicle Booking',type:'Operation',cat:'Hanh chinh',nameVi:'Đặt xe / Di chuyển',descEn:'Business trip transport & vehicle booking',descVi:'Đặt xe công tác, di chuyển nội bộ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-ADVANCE',name:'Cash Advance',nameEn:'Cash Advance',type:'Finance',cat:'Tai chinh',nameVi:'Đề nghị tạm ứng',descEn:'Business travel and petty cash advance',descVi:'Tạm ứng công tác phí và hoàn ứng chứng từ',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:true},
  {id:'P-PAYMENT',name:'Payment Request',nameEn:'Payment Request',type:'Finance',cat:'Tai chinh',nameVi:'Thanh toán chi phí',descEn:'Invoice and operational payment approval',descVi:'Phê duyệt thanh toán hóa đơn, chi phí phát sinh',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-BUDGET',name:'Budget Proposal',nameEn:'Budget Proposal',type:'Finance',cat:'Tai chinh',nameVi:'Đề xuất ngân sách',descEn:'Department and project budget proposal',descVi:'Lập và phê duyệt ngân sách dự án, phòng ban',tags:[],elements:'EXPENSE',sla:5,checked:false},
  {id:'P-CONTRACT',name:'Contract Signing',nameEn:'Contract Signing',type:'Finance',cat:'Tai chinh',nameVi:'Ký kết hợp đồng',descEn:'Commercial and economic contract approval',descVi:'Phê duyệt và ký kết hợp đồng kinh tế',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-IT-ACC',name:'IT Account Request',nameEn:'IT Account Request',type:'Technical',cat:'CNTT',nameVi:'Cấp tài khoản IT',descEn:'Software, system and email account provisioning',descVi:'Yêu cầu cấp tài khoản phần mềm, hệ thống',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-IT-ISSUE',name:'IT Support Ticket',nameEn:'IT Support Ticket',type:'Technical',cat:'CNTT',nameVi:'Báo lỗi hệ thống',descEn:'Technical incident report and troubleshooting',descVi:'Báo cáo sự cố kỹ thuật và xử lý',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-PURCHASE',name:'Purchase Request',nameEn:'Purchase Request',type:'Operation',cat:'Mua hang',nameVi:'Đề nghị mua hàng',descEn:'Material and equipment purchasing proposal',descVi:'Đề xuất và phê duyệt mua sắm vật tư, thiết bị',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-DEAL',name:'Quotation Approval',nameEn:'Quotation Approval',type:'Sale and MKT',cat:'Kinh doanh',nameVi:'Phê duyệt báo giá',descEn:'Commercial proposal and quotation approval',descVi:'Phê duyệt báo giá, đề xuất thương mại',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-WFH',name:'Work From Home',nameEn:'Work From Home',type:'Operation',cat:'Khac',nameVi:'Làm việc từ xa (WFH)',descEn:'Remote work / WFH permission request',descVi:'Xin phép làm việc tại nhà / từ xa',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-OT',name:'Overtime Registration',nameEn:'Overtime Registration',type:'Operation',cat:'Khac',nameVi:'Tăng ca / Làm thêm giờ',descEn:'Overtime work registration and compensation',descVi:'Đăng ký và phê duyệt làm thêm giờ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-BUSINESS',name:'Business Travel',nameEn:'Business Travel',type:'Operation',cat:'Khac',nameVi:'Công tác / Xuất ngoại',descEn:'Domestic and international business travel approval',descVi:'Phê duyệt công tác, đi nước ngoài',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false}
];
const STEP4_CATS=[{key:'all',label:'Tất cả',count:19},{key:'Nhan su',label:'Nhân sự',count:5},{key:'Hanh chinh',label:'Hành chính',count:3},{key:'Tai chinh',label:'Tài chính',count:4},{key:'CNTT',label:'CNTT',count:2},{key:'Mua hang',label:'Mua hàng',count:1},{key:'Kinh doanh',label:'Kinh doanh',count:1},{key:'Khac',label:'Khác',count:3}];
const P_CAT_ICONS={'Nhan su':'group','Hanh chinh':'admin_panel_settings','Tai chinh':'account_balance','CNTT':'computer','Mua hang':'shopping_cart','Kinh doanh':'trending_up','Khac':'more_horiz','all':'apps'};
const P_CAT_COLORS={'Nhan su':'#2563EB','Hanh chinh':'#EA580C','Tai chinh':'#059669','CNTT':'#0284C7','Mua hang':'#DB2777','Kinh doanh':'#D97706','Khac':'#7C3AED','all':'#374151'};
const P_CAT_BGS={'Nhan su':'#EFF6FF','Hanh chinh':'#FFF7ED','Tai chinh':'#ECFDF5','CNTT':'#F0F9FF','Mua hang':'#FDF2F8','Kinh doanh':'#FFFBEB','Khac':'#F5F3FF','all':'#F3F4F6'};
const P_TAG_STYLES={'Phổ biến':{bg:'#FFF7ED',color:'#EA580C',border:'#FED7AA'},'Mới':{bg:'#ECFDF5',color:'#059669',border:'#A7F3D0'}};

window.switchStep4Tab=function(t){window.setupStep4ActiveTab=t;renderSetupContent();};
window.setStep4Category=function(c){window.setupStep4Category=c;renderSetupContent();};
window.setStep4Search=function(v){window.setupStep4Search=v;renderSetupContent();};
window.setStep4ApprovalLevel=function(lvl){
  window.setupStep4ApprovalLevel=lvl;
  document.querySelectorAll('.sw-tier-btn').forEach(btn => {
    const isCur = btn.dataset.lvl === lvl;
    btn.style.borderColor = isCur ? '#ea580c' : '#D1D5DB';
    btn.style.backgroundColor = isCur ? '#ea580c' : '#FFFFFF';
    btn.style.color = isCur ? '#FFFFFF' : '#374151';
  });
  const t0=document.getElementById('new_policy_tier0_note');
  const t1=document.getElementById('new_policy_tier1_container');
  const t2=document.getElementById('new_policy_tier2_container');
  const t3=document.getElementById('new_policy_tier3_container');
  if(t0) t0.style.display=(lvl==='Tier 0')?'block':'none';
  if(t1) t1.style.display=(lvl==='Tier 0')?'none':'block';
  if(t2) t2.style.display=(lvl==='Tier 2'||lvl==='Tier 3')?'block':'none';
  if(t3) t3.style.display=(lvl==='Tier 3')?'block':'none';
};

function renderStep4HTML(counts){
  const tab=window.setupStep4ActiveTab;
  let tc='';
  if(tab==='library'){
    const cat=window.setupStep4Category||'all',search=(window.setupStep4Search||'').toLowerCase();
    let filtered=PRESET_POLICIES_FULL;
    if(cat!=='all')filtered=filtered.filter(p=>p.cat===cat);
    if(search)filtered=filtered.filter(p=>p.nameVi.toLowerCase().includes(search)||p.descVi.toLowerCase().includes(search)||(p.nameEn||'').toLowerCase().includes(search)||(p.descEn||'').toLowerCase().includes(search));
    
    const catLabels = {
      'all': swT('sw.cat_all', 'Tất cả'),
      'Nhan su': swT('sw.cat_hr', 'Nhân sự'),
      'Hanh chinh': swT('sw.cat_admin', 'Hành chính'),
      'Tai chinh': swT('sw.cat_finance', 'Tài chính'),
      'CNTT': swT('sw.cat_it', 'CNTT'),
      'Mua hang': swT('sw.cat_procure', 'Mua hàng'),
      'Kinh doanh': swT('sw.cat_sales', 'Kinh doanh'),
      'Khac': swT('sw.cat_other', 'Khác')
    };
    let catBtns='';
    for(const c of STEP4_CATS){
      const isAct=cat===c.key;
      const clabel = catLabels[c.key] || c.label;
      catBtns+='<button onclick="window.setStep4Category(\''+c.key+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:9px;border:none;cursor:pointer;text-align:left;transition:var(--transition);width:100%;background:'+(isAct?P_CAT_BGS[c.key]||'#FFF7ED':'transparent')+';"><div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:'+(isAct?'700':'500')+';color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#374151')+';"><span class="material-symbols-rounded" style="font-size:15px;color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#9CA3AF')+'">'+(P_CAT_ICONS[c.key]||'folder')+'</span>'+clabel+'</div><span style="font-size:11px;padding:1px 6px;border-radius:10px;background:#F3F4F6;color:#6B7280;font-weight:600;">'+c.count+'</span></button>';
    }
    let pCards='';
    const isVi = (window.currentLocale || localStorage.getItem('crc_locale') || 'vi') === 'vi';
    for(const p of filtered){
      let tgs='';
      for(const tag of p.tags){
        const s=P_TAG_STYLES[tag]||{bg:'#F3F4F6',color:'#374151',border:'#E5E7EB'};
        const tagLabel = tag === 'Phổ biến' ? swT('sw.tag_popular', 'Phổ biến') : (tag === 'Mới' ? swT('sw.tag_new', 'Mới') : tag);
        tgs+='<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+s.bg+';color:'+s.color+';border:1px solid '+s.border+';font-weight:600;">'+tagLabel+'</span>';
      }
      const catColor=P_CAT_COLORS[p.cat]||'#EA580C',catBg=P_CAT_BGS[p.cat]||'#FFF7ED';
      const pName = isVi ? p.nameVi : (p.nameEn || p.name);
      const pDesc = isVi ? p.descVi : (p.descEn || p.descVi);
      pCards+='<label class="sw-policy-card '+(p.checked?'checked':'')+'" onclick="this.querySelector(\'input\').click();this.classList.toggle(\'checked\')"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:9px;background:'+catBg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:17px;color:'+catColor+'">'+(P_CAT_ICONS[p.cat]||'policy')+'</span></div><input type="checkbox" name="preset_policy" value="'+p.id+'" '+(p.checked?'checked':'')+' style="accent-color:#f97316;width:16px;height:16px;flex-shrink:0;" onclick="event.stopPropagation()"></div><div style="font-size:12.5px;font-weight:700;color:#111827;margin-bottom:4px;">'+escapeHTML(pName)+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;flex:1;margin-bottom:8px;">'+escapeHTML(pDesc)+'</div><div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;gap:4px;">'+tgs+'</div><span style="font-size:10.5px;color:#9CA3AF;">SLA: '+p.sla+'d</span></div></label>';
    }
    if(!pCards) pCards='<div style="grid-column:span 3;text-align:center;padding:30px;color:#9CA3AF;font-size:13px;">' + swT('form.no_results', 'Không tìm thấy quy trình phù hợp') + '</div>';
    tc='<div style="display:flex;gap:16px;">'
      +'<div style="width:155px;flex-shrink:0;"><div style="font-size:10px;font-weight:700;color:#9CA3AF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">' + swT('category.title', 'Danh mục') + '</div><div style="display:flex;flex-direction:column;gap:2px;">'+catBtns+'</div></div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="position:relative;margin-bottom:14px;"><span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:#9CA3AF;">search</span><input type="text" value="'+escapeHTML(window.setupStep4Search||'')+'" oninput="window.setStep4Search(this.value)" placeholder="' + swT('sw.step4_search_ph', 'Tìm kiếm quy trình...') + '" class="sw-input" style="padding-left:36px;"></div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">'+pCards+'</div>'
      +'</div></div>';
  } else if(tab==='create'){
    // Create new process with configurable approval levels (Tier 0, Tier 1, Tier 2, Tier 3)
    const currentLvl = window.setupStep4ApprovalLevel || 'Tier 1';
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:16px;">' + swT('sw.step4_desc', 'Tự định nghĩa quy trình theo nhu cầu riêng của doanh nghiệp.') + '</p>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
      +'<div style="grid-column:span 2;">'+swLabel(swT('sw.step4_policy_name', 'Tên quy trình'), true)+swInput('new_policy_name', swT('sw.step4_policy_name_ph', 'VD: Quy trình phê duyệt hợp đồng dịch vụ'), '')+'</div>'
      +'<div>'+swLabel(swT('sw.step4_policy_type', 'Loại'), false)+'<select id="new_policy_type" class="sw-select"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select></div>'
      +'<div>'+swLabel(swT('sw.step4_sla', 'SLA (ngày)'), false)+'<input id="new_policy_sla" type="number" class="sw-input" min="1" value="3"></div>'
      +'<div style="grid-column:span 2;">'+swLabel(swT('sw.step4_desc_field', 'Mô tả'), false)+'<textarea id="new_policy_desc" class="sw-input" rows="2" style="resize:vertical;" placeholder="' + swT('sw.step4_policy_desc_ph', 'Mô tả ngắn gọn về mục đích quy trình...') + '"></textarea></div>'

      // Approval Level Selection
      +'<div style="grid-column:span 2;padding:14px;border:1px solid #E5E7EB;border-radius:12px;background:#F9FAFB;">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      +'<div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step4_approval_level', 'Cấp độ duyệt') + '</div>'
      +'<div style="display:flex;gap:6px;">'
      +['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'].map(lvl => '<button type="button" class="sw-tier-btn" data-lvl="'+lvl+'" onclick="window.setStep4ApprovalLevel(\''+lvl+'\')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid '+(currentLvl===lvl?'#ea580c':'#D1D5DB')+';background:'+(currentLvl===lvl?'#ea580c':'#FFFFFF')+';color:'+(currentLvl===lvl?'#FFFFFF':'#374151')+';">'+lvl+'</button>').join('')
      +'</div></div>'

      // Tier 0 note (Auto approved)
      +'<div id="new_policy_tier0_note" style="display:'+(currentLvl==='Tier 0'?'block':'none')+';padding:10px 14px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:12px;margin-top:10px;">'
      +'<span class="material-symbols-rounded" style="vertical-align:middle;font-size:16px;margin-right:4px;">check_circle</span>'
      +swT('sw.step4_tier0_desc', 'Tự động phê duyệt (không yêu cầu bước duyệt)')
      +'</div>'

      // Tier 1 approver
      +'<div id="new_policy_tier1_container" style="margin-top:10px;display:'+(currentLvl==='Tier 0'?'none':'block')+';">'
      +swLabel(swT('sw.step4_tier1', 'Bậc 1 (Tier 1)'), true)
      +'<input type="text" id="new_policy_tier1" class="sw-input" value="Direct Manager" placeholder="' + swT('sw.step4_tier1_ph', 'Direct Manager / Email / Tên người duyệt') + '">'
      +'</div>'

      // Tier 2 approver (shown for Tier 2 and Tier 3)
      +'<div id="new_policy_tier2_container" style="margin-top:10px;display:'+(currentLvl==='Tier 2'||currentLvl==='Tier 3'?'block':'none')+';">'
      +swLabel(swT('sw.step4_tier2', 'Bậc 2 (Tier 2)'), true)
      +'<input type="text" id="new_policy_tier2" class="sw-input" placeholder="' + swT('sw.step4_tier2_ph', 'VD: Trưởng phòng / HR Manager / Finance Lead / Email') + '">'
      +'</div>'

      // Tier 3 approver (shown for Tier 3)
      +'<div id="new_policy_tier3_container" style="margin-top:10px;display:'+(currentLvl==='Tier 3'?'block':'none')+';">'
      +swLabel(swT('sw.step4_tier3', 'Bậc 3 (Tier 3)'), true)
      +'<input type="text" id="new_policy_tier3" class="sw-input" placeholder="' + swT('sw.step4_tier3_ph', 'VD: Ban Giám đốc / Tổng giám đốc / Email') + '">'
      +'</div>'

      +'<div style="font-size:11px;color:#6B7280;margin-top:8px;line-height:1.5;">'
      +'* ' + swT('sw.tip4', 'Quy trình nên dùng vai trò thay vì chỉ định cụ thể') + ' (VD: Direct Manager, HR Manager, Finance Lead)'
      +'</div>'
      +'</div>'
      +'</div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="display:flex;gap:12px;justify-content:center;margin-top:14px;"><button onclick="downloadSetupTemplate(\'policy\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'policy\')"></label></div></div>';
  } else {
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step4_header', 'Thiết lập quy trình') + ': <strong style="color:#16a34a;">'+(counts.policy_and_program||0)+'</strong> ' + swT('sw.step4_name', 'Quy trình') + '</p>'+(counts.policy_and_program>0?'<div style="padding:20px;text-align:center;background:#ECFDF5;border-radius:12px;border:1px solid #A7F3D0;"><span class="material-symbols-rounded" style="font-size:40px;color:#059669;">task_alt</span><div style="margin-top:8px;font-size:13px;color:#111827;font-weight:600;">' + swT('sw.step4_existing_count', 'Đã có {{count}} quy trình').replace('{{count}}', counts.policy_and_program) + '</div></div>':'<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px;">' + swT('sw.status_pending', 'Chưa thiết lập') + '</div>')+'</div>';
  }
  return '<div class="sw-card">'+swStepHeader('policy', 4, swT('sw.step4_header', 'Thiết lập quy trình'), swT('sw.step4_desc', 'Chọn quy trình mẫu phù hợp hoặc tự tạo theo nhu cầu doanh nghiệp.'))+swTabBar([{key:'library',label:swT('sw.step4_tab_library', 'Chọn từ thư viện mẫu')},{key:'create',label:swT('sw.step4_tab_create', 'Tạo quy trình mới')},{key:'excel',label:swT('sw.step4_tab_excel', 'Nhập từ Excel')},{key:'manage',label:swT('sw.step4_tab_manage', 'Quản lý')}],tab,'window.switchStep4Tab')+tc+swBottomNav(3, 5, swT('sw.step4_save_btn', 'Tạo các quy trình đã chọn'),'saveStep4AndAdvance()')+'</div>';
}

window.saveStep4AndAdvance = async function(){
  const tab = window.setupStep4ActiveTab;
  if(tab === 'create'){
    const name = document.getElementById('new_policy_name')?.value?.trim();
    if(!name){showToast(swT('form.required_field', 'Vui lòng nhập tên quy trình'),'warning');return;}
    const lvl = window.setupStep4ApprovalLevel || 'Tier 1';
    const tier1 = (lvl==='Tier 0') ? 'Auto' : (document.getElementById('new_policy_tier1')?.value?.trim() || 'Direct Manager');
    const tier2 = (lvl==='Tier 2'||lvl==='Tier 3') ? (document.getElementById('new_policy_tier2')?.value?.trim() || null) : null;
    const tier3 = (lvl==='Tier 3') ? (document.getElementById('new_policy_tier3')?.value?.trim() || null) : null;

    const p = [{
      policy_name: name,
      policy_type: document.getElementById('new_policy_type')?.value || 'Operation',
      description: document.getElementById('new_policy_desc')?.value?.trim() || name,
      elements: 'ASSIGN_TASK',
      sla: parseInt(document.getElementById('new_policy_sla')?.value) || 3,
      approval_level: lvl,
      tier1_approval: tier1,
      tier2_approval: tier2,
      tier3_approval: tier3
    }];
    try {
      const res = await apiPost('/system-setup/presets/policies', { policies: p });
      if(res.success){
        showToast(swT('sw.step4_created_success', 'Đã tạo quy trình "{{name}}"!').replace('{{name}}', name),'success');
        window.setupCurrentStep = 5;
        await renderSetupContent(true);
      } else showToast(res.error || 'Lỗi','error');
    } catch(err){showToast('Lỗi: '+err.message,'error');}
    return;
  }
  const cbs = document.querySelectorAll('input[name="preset_policy"]:checked'), sels = Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(5);return;}
  const payload = PRESET_POLICIES_FULL.filter(p=>sels.includes(p.id)).map(p=>({
    policy_name: p.name,
    policy_type: p.type,
    description: p.descVi || p.name,
    elements: p.elements,
    sla: p.sla,
    approval_level: 'Tier 1',
    tier1_approval: 'Direct Manager'
  }));
  try {
    showToast(swT('sw.step4_creating', 'Đang khởi tạo quy trình...'),'info');
    const res = await apiPost('/system-setup/presets/policies', { policies: payload });
    if(res.success){
      showToast(swT('sw.step4_created_count', 'Đã tạo {{count}} quy trình!').replace('{{count}}', res.count),'success');
      window.setupCurrentStep = 5;
      await renderSetupContent(true);
    } else showToast(res.error || 'Lỗi','error');
  } catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 5: TÀI KHOẢN TIỀN
// ─────────────────────────────────────────────────────────────
function renderStep5HTML(comp,counts){
  const cur=comp.base_currency||'VND';
  const banks=['Vietcombank','Vietinbank','BIDV','Techcombank','MB Bank','ACB','Agribank','TPBank','VPBank','OCB','SHB','HDBank','MSB','VIB','SeABank'];
  let bopts='<option value="">-- ' + swT('sw.step5_bank', 'Ngân hàng') + ' --</option>';
  for(const b of banks) bopts+='<option value="'+b+'">'+b+'</option>';
  const acctInfo=counts.account>0?'<div style="padding:12px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:16px;font-size:12px;color:#374151;"><span class="material-symbols-rounded" style="font-size:14px;color:#059669;vertical-align:middle;">check_circle</span> ' + swT('sw.step5_existing_count', 'Hiện có {{count}} tài khoản đã thiết lập.').replace('{{count}}', counts.account) + '</div>':'';
  return '<div class="sw-card">'
    +swStepHeader('account_balance',5, swT('sw.step5_header', 'Tài khoản ngân hàng'), swT('sw.step5_desc', 'Thiết lập tài khoản thanh toán để quản lý dòng tiền thu chi.'))
    +'<form id="form-step5" onsubmit="event.preventDefault();saveStep5AndAdvance();">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">'
    +'<div style="grid-column:span 2;">'+swLabel(swT('sw.step5_acct_name', 'Tên tài khoản giao dịch'),false)+swInput('step5_account_name', swT('sw.step5_acct_name_ph', 'VD: Tài khoản chính Vietcombank'), '')+'</div>'
    +'<div>'+swLabel(swT('sw.step5_bank', 'Ngân hàng'),false)+'<select id="step5_bank_name" class="sw-select">'+bopts+'</select></div>'
    +'<div>'+swLabel(swT('sw.step5_acct_num', 'Số tài khoản'),false)+swInput('step5_account_number', swT('sw.step5_acct_num_ph', 'VD: 0011001234567'), '')+'</div>'
    +'<div>'+swLabel(swT('sw.step5_currency', 'Loại tiền tệ'),false)+'<input type="text" id="step5_currency" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;" value="'+cur+'"></div>'
    +'</div>'+acctInfo
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    +'<button type="button" class="sw-btn-back" onclick="window.setSetupStep(4)"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> ' + swT('sw.btn_back', 'Quay lại') + '</button>'
    +'<div style="display:flex;gap:10px;align-items:center;"><button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(6)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button><button type="submit" class="sw-btn-primary"><span>' + swT('sw.btn_save_summary', 'Lưu và xem tổng kết') + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button></div>'
    +'</div></form></div>';
}

window.saveStep5AndAdvance = async function(){
  const an = document.getElementById('step5_account_name')?.value?.trim();
  const bn = document.getElementById('step5_bank_name')?.value;
  const num = document.getElementById('step5_account_number')?.value?.trim();
  const cur = document.getElementById('step5_currency')?.value || 'VND';
  try {
    showToast(swT('sw.step5_setting_up', 'Đang thiết lập tài khoản...'),'info');
    await apiPost('/system-setup/quick-account', {
      account_name: an,
      bank_name: bn,
      account_number: num,
      currency: cur,
      create_cash: true
    });
    showToast(swT('sw.step5_saved', 'Đã lưu tài khoản!'),'success');
    window.setupCurrentStep = 6;
    await renderSetupContent(true);
  } catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 6: SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────
function renderStep6HTML(counts,comp){
  const name=escapeHTML(comp.company_fullname||comp.company_shortname||'TeraX');
  const summary=[
    {label:swT('sw.step1_name', 'Thông tin công ty'),val:counts.my_company||0,unit:'công ty',color:'#EA580C',bg:'#FFF7ED',done:counts.my_company>0},
    {label:swT('sw.step2_name', 'Phòng ban'),val:counts.department||0,unit:'phòng ban',color:'#2563EB',bg:'#EFF6FF',done:counts.department>0},
    {label:swT('sw.step3_name', 'Nhân viên'),val:counts.employee||0,unit:'nhân viên',color:'#059669',bg:'#ECFDF5',done:counts.employee>0},
    {label:swT('sw.step4_name', 'Quy trình'),val:counts.policy_and_program||0,unit:'quy trình',color:'#7C3AED',bg:'#F5F3FF',done:counts.policy_and_program>0},
    {label:swT('sw.step5_name', 'Tài khoản tiền'),val:counts.account||0,unit:'tài khoản',color:'#D97706',bg:'#FFFBEB',done:counts.account>0}
  ];
  let sumCards='';
  for(const s of summary) {
    sumCards+='<div style="padding:14px 12px;border-radius:12px;background:'+(s.done?s.bg:'#F9FAFB')+';border:1px solid '+(s.done?'rgba(0,0,0,0.06)':'#E5E7EB')+';text-align:center;"><div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;">'+(s.done?'<span class="material-symbols-rounded" style="font-size:14px;color:#059669;">check_circle</span><span style="font-size:11px;font-weight:600;color:#059669;">' + swT('sw.status_done', 'Hoàn thành') + '</span>':'<span class="material-symbols-rounded" style="font-size:14px;color:#D1D5DB;">radio_button_unchecked</span><span style="font-size:11px;font-weight:600;color:#9CA3AF;">' + swT('sw.status_pending', 'Chưa thiết lập') + '</span>')+'</div><div style="font-size:22px;font-weight:800;color:'+(s.done?s.color:'#D1D5DB')+';">'+s.val+'</div><div style="font-size:11px;color:'+(s.done?'#374151':'#9CA3AF')+';">'+s.unit+'</div><div style="font-size:10px;color:#9CA3AF;margin-top:2px;">'+s.label+'</div></div>';
  }
  const qas=[
    {icon:'post_add',color:'#EA580C',bg:'#FFF7ED',title:swT('sw.step6_qa1_title', 'Tạo yêu cầu đầu tiên'),desc:swT('sw.step6_qa1_desc', 'Trải nghiệm quy trình phê duyệt và xử lý.'),action:'request',btn:swT('sw.step6_qa1_btn', 'Tạo yêu cầu')},
    {icon:'task_alt',color:'#2563EB',bg:'#EFF6FF',title:swT('sw.step6_qa2_title', 'Giao nhiệm vụ'),desc:swT('sw.step6_qa2_desc', 'Phân công công việc và theo dõi tiến độ.'),action:'assigned_task',btn:swT('sw.step6_qa2_btn', 'Tạo nhiệm vụ')},
    {icon:'bar_chart',color:'#059669',bg:'#ECFDF5',title:swT('sw.step6_qa3_title', 'Xem báo cáo'),desc:swT('sw.step6_qa3_desc', 'Khám phá các báo cáo quản trị.'),action:'home',btn:swT('sw.step6_qa3_btn', 'Xem báo cáo')},
    {icon:'badge',color:'#7C3AED',bg:'#F5F3FF',title:swT('sw.step6_qa4_title', 'Quản lý nhân sự'),desc:swT('sw.step6_qa4_desc', 'Cập nhật thông tin nhân viên, phòng ban.'),action:'employee',btn:swT('sw.step6_qa4_btn', 'Xem danh sách')}
  ];
  let qaCards='';
  for(const q of qas) {
    qaCards+='<div style="padding:16px;border-radius:14px;background:white;border:1px solid #E5E7EB;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,0.05);"><div style="width:38px;height:38px;border-radius:10px;background:'+q.bg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:20px;color:'+q.color+';">'+q.icon+'</span></div><div style="font-size:13px;font-weight:700;color:#111827;">'+q.title+'</div><div style="font-size:11.5px;color:#6B7280;line-height:1.4;flex:1;">'+q.desc+'</div><button onclick="completeSetupWizard(\''+q.action+'\')" style="width:100%;padding:8px;border-radius:9px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:var(--transition);">'+q.btn+'</button></div>';
  }
  const resources=[
    {icon:'menu_book',color:'#2563EB',title:swT('sw.guide_doc', 'Hướng dẫn sử dụng'),desc:'Tìm hiểu các tính năng cơ bản'},
    {icon:'play_circle',color:'#EA580C',title:'Video hướng dẫn',desc:'Xem video thao tác chi tiết'},
    {icon:'table_chart',color:'#059669',title:'Thư viện quy trình mẫu',desc:'Tham khảo các quy trình phổ biến'},
    {icon:'help',color:'#7C3AED',title:'Câu hỏi thường gặp',desc:'Giải đáp các thắc mắc'}
  ];
  let resItems='';
  for(const r of resources) {
    resItems+='<button style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;width:100%;transition:var(--transition);" onmouseover="this.style.background=\'#F9FAFB\'" onmouseout="this.style.background=\'transparent\'"><div style="width:34px;height:34px;border-radius:9px;background:#F3F4F6;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:18px;color:'+r.color+';">'+r.icon+'</span></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+r.title+'</div><div style="font-size:10.5px;color:#9CA3AF;">'+r.desc+'</div></div><span class="material-symbols-rounded" style="font-size:15px;color:#D1D5DB;flex-shrink:0;">chevron_right</span></button>';
  }
  return '<div style="display:flex;gap:20px;align-items:flex-start;">'
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;">'
    +'<div style="background:linear-gradient(135deg,#1E3A5F,#1D4ED8);border-radius:18px;padding:32px;color:white;overflow:hidden;position:relative;">'
    +'<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.08),transparent 70%);pointer-events:none;"></div>'
    +'<div style="display:flex;align-items:center;gap:24px;"><div style="flex:1;">'
    +'<div style="font-size:13px;color:#FCD34D;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px;"><span>🎉</span> ' + swT('sw.step6_ready_subtitle', 'Hoàn tất thiết lập!') + '</div>'
    +'<h2 style="font-size:24px;font-weight:800;color:white;margin-bottom:10px;">' + swT('sw.step6_ready_title', 'TeraX đã sẵn sàng để sử dụng') + '</h2>'
    +'<p style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:20px;">Môi trường làm việc của <strong style="color:white;">'+name+'</strong> đã được thiết lập. Hãy bắt đầu khám phá TeraX.</p>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;"><button onclick="completeSetupWizard()" class="sw-btn-primary" style="background:linear-gradient(135deg,#f97316,#ea580c);"><span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span> ' + swT('sw.step6_enter_app', 'Vào hệ thống ngay') + '</button>'
    +'<button style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.3);background:transparent;color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">play_circle</span> ' + swT('sw.step6_quick_guide', 'Xem hướng dẫn nhanh') + '</button>'
    +'</div></div>'
    +'<div style="width:100px;flex-shrink:0;text-align:center;"><div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="material-symbols-rounded" style="font-size:48px;color:#FCD34D;">verified</span></div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:8px;">Cùng TeraX vận hành tốt hơn</div></div>'
    +'</div></div>'
    +'<div class="sw-card">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#111827;">' + swT('sw.step6_overview', 'Tổng quan thiết lập') + '</div><button onclick="window.setSetupStep(1)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">settings</span> ' + swT('sw.step6_edit', 'Chỉnh sửa') + '</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'+sumCards+'</div>'
    +'</div>'
    +'<div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">' + swT('sw.step6_ready_title', 'Bắt đầu với TeraX') + '</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">'+qaCards+'</div></div>'
    +'</div>'
    +'<div style="width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">'
    +'<div class="sw-card"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">' + swT('sw.guide_doc', 'Tài nguyên hữu ích') + '</div><div style="display:flex;flex-direction:column;gap:2px;">'+resItems+'</div></div>'
    +'<div class="sw-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div style="width:34px;height:34px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div><div><div style="font-size:12px;font-weight:700;color:#111827;">' + swT('sw.need_support', 'Bạn cần hỗ trợ?') + '</div><div style="font-size:10.5px;color:#6B7280;">' + swT('sw.support_desc', 'Đội ngũ TeraX luôn sẵn sàng.') + '</div></div></div><button class="sw-btn-primary" style="width:100%;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> ' + swT('sw.contact_support', 'Liên hệ hỗ trợ') + '</button></div>'
    +'<div class="sw-card" style="background:rgba(255,255,255,0.7);"><div style="font-size:11.5px;color:#6B7280;line-height:1.6;font-style:italic;margin-bottom:10px;">"Cảm ơn bạn đã tin tưởng TeraX. Chúng tôi cam kết tiếp tục đồng hành để doanh nghiệp của bạn vận hành hiệu quả và phát triển bền vững."</div><div style="font-size:11px;color:#9CA3AF;font-weight:600;">— Đội ngũ TeraX</div></div>'
    +'</div></div>';
}

// ─────────────────────────────────────────────────────────────
//  SYSTEM CONTROLS
// ─────────────────────────────────────────────────────────────
window.completeSetupWizard = async function(redirectTo){
  try {
    showToast('Đang kích hoạt hệ thống...','info');
    const res = await apiPost('/system-setup/complete');
    if(res.success){
      showToast('Kích hoạt thành công!','success');
      window.setupCompleted = true;
      document.body.classList.remove('setup-active');
      const ns = document.getElementById('nav-setup');
      if(ns) ns.style.display = 'none';
      window.location.hash = redirectTo || 'home';
    } else showToast('Lỗi: ' + (res.message || 'Unknown'),'error');
  } catch(err){showToast('Lỗi server: '+err.message,'error');}
};

window.resetSetupStatusDev = async function(){
  if(!confirm('Khôi phục lại chế độ Setup?')) return;
  try {
    const res = await apiPost('/system-setup/reset');
    if(res.success){
      showToast('Đã khôi phục.','success');
      window.setupCompleted = false;
      window.setupCurrentStep = 1;
      document.body.classList.add('setup-active');
      const ns = document.getElementById('nav-setup');
      if(ns) ns.style.display = 'flex';
      window.location.hash = 'setup';
      await renderSetupContent();
    }
  } catch(err){showToast('Lỗi: '+err.message,'error');}
};

window.downloadSetupTemplate = function(moduleKey){
  const mod = (typeof MODULES!=='undefined') ? MODULES[moduleKey] : null;
  if(!mod){showToast('Không tìm thấy cấu hình mẫu.','warning');return;}
  const headers = mod.fields.filter(f=>!f.section&&f.key&&f.type!=='file'&&!f.hidden).map(f=>f.key);
  if(!headers.length){showToast('Không tìm thấy trường.','warning');return;}
  const ws = XLSX.utils.json_to_sheet([{}],{header:headers});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (mod.label||moduleKey).substring(0,30));
  XLSX.writeFile(wb, moduleKey+'_template.xlsx');
  showToast(swT('common.download_success', 'Đã tải xuống mẫu.'),'success');
};

window.importSetupFile = async function(event,moduleKey){
  const file = event.target.files[0];
  if(!file) return;
  showToast('Đang phân tích...','info');
  const r = new FileReader();
  r.onload = async(e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const jd = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
      if(!jd.length){showToast('Tệp trống.','warning');return;}
      const tn = moduleKey==='policy'?'policy_and_program':moduleKey;
      const res = await apiPost('/table/'+tn+'/bulk', jd);
      showToast(res.message || 'Nhập thành công!','success');
      await renderSetupContent();
    } catch(err){
      showToast('Tải lên thất bại: '+err.message,'error');
    } finally {
      event.target.value = '';
    }
  };
  r.readAsArrayBuffer(file);
};
