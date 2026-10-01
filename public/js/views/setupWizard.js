/**
 * TeraX – Setup Wizard (Light Theme)
 * i18n compliant, CMS DB lookups with top 5 popular prioritized,
 * clean department setup, full required employee fields, flexible multi-tier approval policies.
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedCompanies = [];
window.setupParsedDepartments = [];
window.setupParsedEmployees = [];
window.setupParsedPolicies = [];
window.setupParsedAccounts = [];
window.setupStep1ActiveTab = 'form';
window.setupStep2ActiveTab = 'choose';
window.setupStep3ActiveTab = 'quick';
window.setupStep4ActiveTab = 'library';
window.setupStep4Category = 'all';
window.setupStep4Search = '';
window.setupStep4ApprovalLevel = 'Tier 1';
window.setupStep5ActiveTab = 'quick';
window.setupCustomPolicies = [
  { policy_name: '', policy_type: 'Operation', sla: 3, approval_level: 'Tier 1', tier1_approval: 'Direct Manager', tier2_approval: '', tier3_approval: '', description: '' }
];

// ─── Setup Wizard Draft Cache (in memory & localStorage) ────────
window.setupDraft = {
  company: null,
  departments: [],
  employees: [],
  policies: [],
  accounts: []
};

function saveSetupDraftToStorage() {
  try {
    localStorage.setItem('terax_setup_draft_v2', JSON.stringify(window.setupDraft));
  } catch(e){}
}

function loadSetupDraftFromStorage() {
  try {
    const raw = localStorage.getItem('terax_setup_draft_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        window.setupDraft = {
          company: parsed.company || null,
          departments: Array.isArray(parsed.departments) ? parsed.departments : [],
          employees: Array.isArray(parsed.employees) ? parsed.employees : [],
          policies: Array.isArray(parsed.policies) ? parsed.policies : [],
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : []
        };
      }
    }
  } catch(e){}
}
loadSetupDraftFromStorage();

// ─── i18n helper ─────────────────────────────────────────────
function swT(key, fallbackVi, fallbackEn) {
  if (typeof t === 'function') {
    const res = t(key, swIsVi() ? fallbackVi : (fallbackEn || undefined));
    if (res && res !== key) return res;
  }
  return swIsVi() ? (fallbackVi || key) : (fallbackEn || fallbackVi || key);
}

function swIsVi() {
  const lang = (typeof currentLang !== 'undefined' ? currentLang : '') || localStorage.getItem('crc_lang') || 'en';
  return lang === 'vi';
}

function swRemoveAccents(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
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
    .sw-preset-card.checked, .sw-preset-card:has(input:checked) { border-color:#f97316 !important; background:#FFF7ED !important; }
    .sw-policy-card { cursor:pointer; display:flex; flex-direction:column; padding:14px; border-radius:12px; border:1.5px solid #E5E7EB; background:#FFFFFF; transition:var(--transition); }
    .sw-policy-card:hover { border-color:#FDBA74; }
    .sw-policy-card.checked, .sw-policy-card:has(input:checked) { border-color:#f97316 !important; background:#FFF7ED !important; }
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
    .sw-table-scroll-container { scrollbar-width:thin; scrollbar-color:#94a3b8 #f1f5f9; }
    .sw-table-scroll-container::-webkit-scrollbar { width:8px; height:8px; }
    .sw-table-scroll-container::-webkit-scrollbar-track { background:#f1f5f9; border-radius:4px; }
    .sw-table-scroll-container::-webkit-scrollbar-thumb { background:#94a3b8; border-radius:4px; }
    .sw-table-scroll-container::-webkit-scrollbar-thumb:hover { background:#64748b; }
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
  const draft = window.setupDraft || {};
  const comp = draft.company ? (Array.isArray(draft.company) ? draft.company[0] : draft.company) : (window.setupWizardData.company || {});
  const currentStep = window.setupCurrentStep || 1;
  const hasComp = (counts.my_company > 0) || Boolean(draft.company);
  const hasDepts = (counts.department > 0) || (draft.departments && draft.departments.length > 0);
  const hasEmps = (counts.employee > 0) || (draft.employees && draft.employees.length > 0);
  const hasPolicies = (counts.policy_and_program > 0) || (draft.policies && draft.policies.length > 0);
  const hasAccounts = (counts.account > 0) || (draft.accounts && draft.accounts.length > 0);
  const stepDone = [hasComp, hasDepts, hasEmps, hasPolicies, hasAccounts];
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

// Setup searchable dropdown for country, currency & timezone
window.swSearchOptions = {
  country: [],
  currency: [],
  timezone: []
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

  let filtered = [];
  if (q) {
    filtered = options.filter(o => o.searchLabel.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  } else {
    // Top popular values only by default (12 for timezone, 5 for country/currency)
    const topCount = type === 'timezone' ? 12 : 5;
    filtered = options.slice(0, topCount);
    if (currentVal && !filtered.some(o => String(o.value).toLowerCase() === String(currentVal).toLowerCase())) {
      const selectedOpt = options.find(o => String(o.value).toLowerCase() === String(currentVal).toLowerCase());
      if (selectedOpt) filtered.push(selectedOpt);
    }
  }

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

function buildTimezoneOptions(selectedTz) {
  const popularTzs = [
    { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7 - Hà Nội, TP.HCM)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (GMT+7 - Bangkok)' },
    { value: 'Asia/Jakarta', label: 'Asia/Jakarta (GMT+7 - Jakarta)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8 - Singapore)' },
    { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (GMT+8 - Kuala Lumpur)' },
    { value: 'Asia/Manila', label: 'Asia/Manila (GMT+8 - Manila)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9 - Tokyo)' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul (GMT+9 - Seoul)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (GMT+8 - Beijing, Shanghai)' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (GMT+8 - Hong Kong)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (GMT+10/11 - Sydney)' },
    { value: 'Europe/London', label: 'Europe/London (GMT+0/1 - London)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1/2 - Paris)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1/2 - Berlin)' },
    { value: 'America/New_York', label: 'America/New_York (GMT-5/4 - New York)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8/7 - Los Angeles)' },
    { value: 'America/Chicago', label: 'America/Chicago (GMT-6/5 - Chicago)' },
    { value: 'UTC', label: 'UTC (GMT+0 - Coordinated Universal Time)' }
  ];

  let allTzs = [];
  try {
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      allTzs = Intl.supportedValuesOf('timeZone');
    }
  } catch (e) {}

  const popularSet = new Set(popularTzs.map(p => p.value));
  const options = [...popularTzs];

  allTzs.forEach(tzName => {
    if (!popularSet.has(tzName)) {
      let offsetStr = '';
      try {
        const d = new Date();
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'shortOffset' }).formatToParts(d);
        const p = parts.find(x => x.type === 'timeZoneName');
        if (p && p.value) offsetStr = ` (${p.value})`;
      } catch (err) {}
      options.push({
        value: tzName,
        label: `${tzName}${offsetStr}`,
        searchLabel: `${tzName} ${offsetStr}`
      });
    }
  });

  return options.map(o => ({
    value: o.value,
    label: o.label,
    searchLabel: (o.searchLabel || o.label || o.value).toLowerCase()
  }));
}

let _taxDebounceTimer = null;
window.handleTaxCodeInput = function(rawVal, immediate) {
  if (_taxDebounceTimer) clearTimeout(_taxDebounceTimer);
  const clean = String(rawVal || '').trim().replace(/[^0-9A-Za-z-]/g, '');

  const hintEl = document.getElementById('step1_tax_hint');
  const iconEl = document.getElementById('step1_tax_status_icon');

  if (clean.length < 10) {
    if (hintEl) hintEl.style.display = 'none';
    if (iconEl) iconEl.style.display = 'none';
    return;
  }

  if (immediate) {
    window.autoFetchTaxCode(clean);
  } else {
    _taxDebounceTimer = setTimeout(() => {
      window.autoFetchTaxCode(clean);
    }, 600);
  }
};

window.autoFetchTaxCode = async function(cleanCode) {
  if (!cleanCode || cleanCode.length < 10) return;
  if (window.autoFetchTaxCode._lastFetchedCode === cleanCode) return;
  if (window.autoFetchTaxCode._running) return;

  const hintEl = document.getElementById('step1_tax_hint');
  const iconEl = document.getElementById('step1_tax_status_icon');

  try {
    window.autoFetchTaxCode._running = true;
    if (iconEl) {
      iconEl.textContent = 'progress_activity';
      iconEl.style.color = '#F97316';
      iconEl.style.display = 'inline-block';
      iconEl.style.animation = 'spin 1s linear infinite';
    }
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.style.color = '#6B7280';
      hintEl.textContent = swT('common.loading', 'Đang tự động nhận diện thông tin doanh nghiệp...');
    }

    const res = await apiGet('/system-setup/tax-payer/' + encodeURIComponent(cleanCode));
    if (res && res.success && res.data) {
      const data = res.data;
      const fnInput = document.getElementById('step1_fullname');
      const snInput = document.getElementById('step1_shortname');
      const addrInput = document.getElementById('step1_address');

      const nameVal = data.fullname || '';
      if (fnInput && nameVal) {
        fnInput.value = nameVal;
        fnInput.style.transition = 'background-color 0.5s';
        fnInput.style.backgroundColor = '#FEF3C7';
        setTimeout(() => { fnInput.style.backgroundColor = ''; }, 1500);
      }
      if (snInput && (data.shortname || nameVal)) {
        snInput.value = data.shortname || nameVal;
        snInput.style.transition = 'background-color 0.5s';
        snInput.style.backgroundColor = '#FEF3C7';
        setTimeout(() => { snInput.style.backgroundColor = ''; }, 1500);
      }
      if (addrInput && data.address) {
        addrInput.value = data.address;
        addrInput.style.transition = 'background-color 0.5s';
        addrInput.style.backgroundColor = '#FEF3C7';
        setTimeout(() => { addrInput.style.backgroundColor = ''; }, 1500);
      }

      window.autoFetchTaxCode._lastFetchedCode = cleanCode;

      if (iconEl) {
        iconEl.textContent = 'check_circle';
        iconEl.style.color = '#16A34A';
        iconEl.style.animation = 'none';
        iconEl.style.display = 'inline-block';
      }
      if (hintEl) {
        hintEl.style.display = 'block';
        hintEl.style.color = '#15803D';
        hintEl.textContent = '✓ ' + (nameVal || '') + (data.status ? ` (${data.status})` : '');
      }

      showToast(swT('sw.tax_lookup_success', 'Đã tự động lấy thông tin từ mã số thuế!'), 'success');
    } else {
      if (iconEl) iconEl.style.display = 'none';
      if (hintEl) {
        hintEl.style.display = 'block';
        hintEl.style.color = '#DC2626';
        hintEl.textContent = (res && (res.message || res.error)) || swT('sw.tax_lookup_not_found', 'Không tìm thấy thông tin cho mã số thuế này');
      }
    }
  } catch (err) {
    if (iconEl) iconEl.style.display = 'none';
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.style.color = '#DC2626';
      hintEl.textContent = swT('sw.tax_lookup_error', 'Lỗi tra cứu mã số thuế: ') + err.message;
    }
  } finally {
    window.autoFetchTaxCode._running = false;
  }
};

function renderStep1HTML(compRaw) {
  const draftComp = window.setupDraft?.company ? (Array.isArray(window.setupDraft.company) ? window.setupDraft.company[0] : window.setupDraft.company) : null;
  const comp = draftComp || compRaw || {};
  const defaultTz = comp.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  const defaultCountry = comp.country || 'Vietnam';
  const defaultCurrency = (comp.base_currency || 'VND').toUpperCase();
  const tab = window.setupStep1ActiveTab || 'form';

  let logoSrc = '';
  if (comp.logo) {
    if (typeof comp.logo === 'string') {
      logoSrc = (comp.logo.startsWith('data:') || comp.logo.startsWith('http://') || comp.logo.startsWith('https://') || comp.logo.startsWith('/'))
        ? comp.logo
        : 'data:image/png;base64,' + comp.logo;
    } else if (typeof comp.logo === 'object' && Array.isArray(comp.logo.data)) {
      try {
        const bytes = new Uint8Array(comp.logo.data);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 8192) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
        }
        logoSrc = 'data:image/png;base64,' + btoa(binary);
      } catch (e) {}
    }
  }

  window.step1LogoBase64 = logoSrc || null;

  // Async load lookups from CMS database via /system-setup/lookups
  setTimeout(async () => {
    window.swSearchOptions.timezone = buildTimezoneOptions(defaultTz);
    const matchedTz = window.swSearchOptions.timezone.find(t => t.value === defaultTz);
    const tzLabelEl = document.getElementById('sw_search_label_timezone');
    if (tzLabelEl && matchedTz) tzLabelEl.textContent = matchedTz.label;
    window.filterSwSearchOptions('timezone', '');

    const [cts, cus] = await Promise.all([
      fetchLookup('countries', '/system-setup/lookups/countries'),
      fetchLookup('currencies', '/system-setup/lookups/currencies')
    ]);

    window.swSearchOptions.country = cts.map(c => ({
      value: c.name,
      label: c.display_name || c.name,
      searchLabel: (c.code ? c.code + ' ' : '') + (c.name || '') + ' ' + (c.display_name || '')
    }));

    window.swSearchOptions.currency = cus.map(c => ({
      value: c.code,
      label: c.code,
      searchLabel: c.code + ' ' + (c.label || '')
    }));

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

  let tabContent = '';
  if (tab === 'form') {
    tabContent = '<form id="form-step1" onsubmit="event.preventDefault();saveStep1AndAdvance();">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      + '<div class="form-group" style="grid-column:span 2;">'+swLabel(swT('sw.step1_fullname', 'Tên đầy đủ công ty / doanh nghiệp'), true)+swInput('step1_fullname', swT('sw.step1_fullname_ph', 'VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ TERAX'), escapeHTML(comp.company_fullname||''))+'</div>'
      + '<div class="form-group">'+swLabel(swT('sw.step1_shortname', 'Tên viết tắt / Brand Name'), true)+swInput('step1_shortname', swT('sw.step1_shortname_ph', 'VD: TERAX'), escapeHTML(comp.company_shortname||''))+'</div>'
      + '<div class="form-group">'
      + swLabel(swT('sw.step1_tax_code', 'Mã số thuế'), false)
      + '<div style="position:relative;">'
      + '<input type="text" id="step1_tax_code" class="sw-input" style="padding-right:36px;" placeholder="' + swT('sw.step1_tax_code_ph', 'VD: 0101234567') + '" value="' + escapeHTML(comp.tax_code||'') + '" oninput="window.handleTaxCodeInput(this.value)" onblur="window.handleTaxCodeInput(this.value, true)">'
      + '<span id="step1_tax_status_icon" class="material-symbols-rounded" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:18px;color:#9CA3AF;pointer-events:none;display:none;"></span>'
      + '</div>'
      + '<div id="step1_tax_hint" style="font-size:11.5px;color:#6B7280;margin-top:4px;display:none;"></div>'
      + '</div>'
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
      + '<div class="form-group">'+swLabel(swT('sw.step1_currency', 'Currency'), true)
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
      + '<div class="form-group">' + swLabel(swT('sw.step1_timezone', 'Múi giờ hệ thống'), true)
      + '<div class="sw-search-dropdown">'
      + '<input type="hidden" id="step1_timezone" value="' + escapeHTML(defaultTz) + '">'
      + '<div class="sw-search-display" id="sw_search_display_timezone" onclick="window.toggleSwSearchDropdown(\'timezone\')">'
      + '<span id="sw_search_label_timezone">' + escapeHTML(defaultTz) + '</span>'
      + '<span class="material-symbols-rounded" style="font-size:18px;color:#6B7280;">arrow_drop_down</span>'
      + '</div>'
      + '<div class="sw-search-menu" id="sw_search_menu_timezone">'
      + '<input type="text" class="sw-search-input" id="sw_search_input_timezone" placeholder="' + swT('sw.step1_search_timezone', 'Tìm kiếm múi giờ...') + '" oninput="window.filterSwSearchOptions(\'timezone\', this.value)" onclick="event.stopPropagation()">'
      + '<div id="sw_search_list_timezone"></div>'
      + '</div></div></div>'
      + '<div class="form-group" style="grid-column:span 2;">'+swLabel(swT('sw.step1_logo', 'Logo thương hiệu công ty'), false)
      + '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;">'
      + '<div id="step1_logo_preview" style="width:48px;height:48px;border-radius:8px;background:#FFFFFF;border:1px dashed #D1D5DB;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">'
      + (logoSrc ? '<img src="'+escapeHTML(logoSrc)+'" style="width:100%;height:100%;object-fit:contain;">' : '<span class="material-symbols-rounded" style="color:#9CA3AF;font-size:24px;">image</span>')
      + '</div>'
      + '<div style="flex:1;">'
      + '<input type="file" id="step1_logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="window.handleStep1Logo(event)" style="font-size:12px;color:#4B5563;">'
      + '<div style="font-size:11px;color:#9CA3AF;margin-top:3px;">' + swT('sw.step1_logo_tip', 'Khuyến nghị ảnh định dạng PNG nền trong suốt, dung lượng tối đa 1MB.') + '</div>'
      + '</div></div></div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
      + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(2)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
      + '<button type="submit" class="sw-btn-primary"><span>' + swT('sw.btn_save_continue', 'Lưu và tiếp tục') + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
      + '</div></form>';
  } else {
    // Excel upload tab
    const parsed = window.setupParsedCompanies || [];
    let prev = '';
    if (parsed.length > 0) {
      let rows = '';
      for (let i = 0; i < parsed.length; i++) {
        const c = parsed[i];
        rows += '<tr style="border-bottom:1px solid #F1F5F9;">'
          + '<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">' + (i + 1) + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#ea580c;font-size:11.5px;">' + escapeHTML(c.my_company_id || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#111827;font-size:11.5px;">' + escapeHTML(c.company_shortname || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(c.company_fullname || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(c.tax_code || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(c.country || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(c.city || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#059669;font-weight:600;font-size:11.5px;">' + escapeHTML(c.base_currency || '–') + '</td>'
          + '</tr>';
      }
      prev = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-top:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="material-symbols-rounded" style="font-size:26px;color:#059669;">domain</span>'
        + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step1_preview_title', 'Danh sách công ty đã đọc') + '</div>'
        + '<div style="font-size:11px;color:#6B7280;">' + parsed.length + ' ' + swT('sw.step3_rows', 'dòng dữ liệu') + '</div></div>'
        + '</div>'
        + '<button onclick="window.setupParsedCompanies=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa file') + '"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button>'
        + '</div>'
        + '<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div style="overflow-x:auto;max-height:260px;overflow-y:auto;">'
        + '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">'
        + '<thead><tr style="background:#F8FAFC;">'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Company ID</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step1_shortname', 'Tên viết tắt') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step1_fullname', 'Tên đầy đủ') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step1_tax_code', 'Mã số thuế') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step1_country', 'Quốc gia') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.city', 'Thành phố') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step1_currency', 'Tiền tệ') + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></div>';
    }
    tabContent = '<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'company\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="handleCompanyExcelUpload(event)"></label></div></div>'
      + prev
      + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
      + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(2)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
      + '<button type="button" class="sw-btn-primary" onclick="saveStep1AndAdvance()"><span>' + swT('sw.btn_save_continue', 'Lưu và tiếp tục') + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
      + '</div>';
  }

  return '<div class="sw-card">'
    + swStepHeader('apartment', 1, swT('sw.step1_header', 'Thông tin công ty'), swT('sw.step1_desc', 'Tạo cơ sở dữ liệu nền tảng cho doanh nghiệp. Có thể chỉnh sửa sau.'))
    + swTabBar([
        { key: 'form', label: swT('sw.step1_tab_form', 'Điền thông tin') },
        { key: 'excel', label: swT('sw.step1_tab_excel', 'Nhập từ Excel') }
      ], tab, 'window.switchStep1Tab')
    + tabContent
    + '</div>';
}

window.switchStep1Tab = function(t){ window.setupStep1ActiveTab = t; renderSetupContent(); };

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

window.handleCompanyExcelUpload = async function(event){
  const file = event.target.files[0];
  if (!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows || !rows.length) {
        showToast(swT('common.empty_file', 'File không có dòng dữ liệu'), 'warning');
        return;
      }
      const mapped = [];
      for (const row of rows) {
        const k = Object.keys(row);
        const cidK = k.find(x => /my_company_id|^company_id$|^id$/i.test(x));
        const snK = k.find(x => /company_shortname|shortname|viết tắt/i.test(x));
        const fnK = k.find(x => /company_fullname|fullname|tên đầy đủ/i.test(x)) || k.find(x => /tên|name/i.test(x));
        const addrK = k.find(x => /address|địa chỉ/i.test(x));
        const taxK = k.find(x => /tax_code|tax|mã số thuế/i.test(x));
        const ctryK = k.find(x => /country|quốc gia/i.test(x));
        const cityK = k.find(x => /city|thành phố/i.test(x));
        const curK = k.find(x => /base_currency|currency|tiền tệ/i.test(x));

        const fn = fnK ? String(row[fnK]).trim() : '';
        const sn = snK ? String(row[snK]).trim() : (fn ? fn.substring(0, 10).toUpperCase() : '');
        if (fn || sn) {
          mapped.push({
            my_company_id: cidK && row[cidK] != null ? String(row[cidK]).trim() : String(mapped.length + 1),
            company_shortname: sn,
            company_fullname: fn || sn,
            address: addrK ? String(row[addrK]).trim() : '',
            tax_code: taxK ? String(row[taxK]).trim() : '',
            country: ctryK ? String(row[ctryK]).trim() : 'Vietnam',
            city: cityK ? String(row[cityK]).trim() : '',
            base_currency: curK ? String(row[curK]).trim() : 'VND'
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ trong file'), 'warning');
        return;
      }
      window.setupParsedCompanies = mapped;
      window.setupDraft.company = mapped.length === 1 ? mapped[0] : mapped;
      saveSetupDraftToStorage();
      showToast(swT('sw.step1_parsed_count', 'Đã nhận diện {{count}} công ty từ file Excel').replace('{{count}}', mapped.length), 'success');
      renderSetupContent();
    } catch(err) {
      showToast(swT('sw.file_read_error', 'Lỗi đọc file: ') + err.message, 'error');
    }
  };
  r.readAsArrayBuffer(file);
};

window.saveStep1AndAdvance = async function(){
  const tab = window.setupStep1ActiveTab || 'form';
  if (tab === 'excel' && (window.setupParsedCompanies || []).length > 0) {
    window.setupDraft.company = window.setupParsedCompanies.length === 1 ? window.setupParsedCompanies[0] : window.setupParsedCompanies;
    saveSetupDraftToStorage();
    showToast(swT('sw.step1_draft_saved', 'Đã lưu tạm thông tin công ty vào bộ nhớ!'), 'success');
    window.setupCurrentStep = 2;
    await renderSetupContent();
    return;
  }
  const fn = document.getElementById('step1_fullname')?.value?.trim();
  const sn = document.getElementById('step1_shortname')?.value?.trim();
  if (!fn || !sn) {
    showToast(swT('sw.step1_required_error', 'Vui lòng điền tên đầy đủ và tên viết tắt'), 'warning');
    return;
  }
  const tzVal = document.getElementById('step1_timezone')?.value || 'Asia/Ho_Chi_Minh';
  const currVal = document.getElementById('step1_currency')?.value || 'VND';
  window.setupDraft.company = {
    company_fullname: fn,
    company_shortname: sn,
    tax_code: document.getElementById('step1_tax_code')?.value?.trim() || null,
    country: document.getElementById('step1_country')?.value || 'Vietnam',
    city: document.getElementById('step1_city')?.value?.trim() || null,
    base_currency: currVal,
    timezone: tzVal,
    address: document.getElementById('step1_address')?.value?.trim() || null,
    website: document.getElementById('step1_website')?.value?.trim() || null,
    logo: window.step1LogoBase64 || null
  };
  saveSetupDraftToStorage();
  localStorage.setItem('crc_timezone', tzVal);
  localStorage.setItem('crc_base_currency', currVal);
  showToast(swT('sw.step1_draft_saved', 'Đã lưu tạm thông tin công ty vào bộ nhớ!'), 'success');
  window.setupCurrentStep = 2;
  await renderSetupContent();
};

// ─────────────────────────────────────────────────────────────
//  STEP 2: PHÒNG BAN (Mã PB, Tên PB, Người quản lý tùy chọn - Bỏ Operation/Finance)
// ─────────────────────────────────────────────────────────────
const DEPT_ICONS={BGD:{icon:'workspace_premium',color:'#D97706',bg:'#FEF3C7'},HCNS:{icon:'supervised_user_circle',color:'#2563EB',bg:'#EFF6FF'},TCKT:{icon:'account_balance',color:'#059669',bg:'#ECFDF5'},KD:{icon:'bar_chart',color:'#EA580C',bg:'#FFF7ED'},KT:{icon:'construction',color:'#7C3AED',bg:'#F5F3FF'},IT:{icon:'laptop',color:'#0284C7',bg:'#F0F9FF'},MH:{icon:'shopping_cart',color:'#DB2777',bg:'#FDF2F8'},CSKH:{icon:'headset_mic',color:'#0D9488',bg:'#F0FDFA'},PC:{icon:'gavel',color:'#9333EA',bg:'#FAF5FF'}};
const PRESET_DEPARTMENTS=[
  {code:'BGD',name:'Ban Giám đốc',nameEn:'Board of Directors',desc:'Điều hành và quản trị doanh nghiệp',descEn:'Executive management and corporate governance',checked:true},
  {code:'HCNS',name:'Hành chính – Nhân sự',nameEn:'HR & Administration',desc:'Quản lý nhân sự, hành chính, pháp chế',descEn:'Human resources, administration, and compliance',checked:true},
  {code:'TCKT',name:'Tài chính – Kế toán',nameEn:'Finance & Accounting',desc:'Tài chính, kế toán, thuế',descEn:'Finance, accounting, and tax management',checked:true},
  {code:'KD',name:'Kinh doanh',nameEn:'Sales & Business Development',desc:'Phát triển thị trường, chăm sóc khách hàng',descEn:'Market development and customer relations',checked:true},
  {code:'KT',name:'Kỹ thuật',nameEn:'Engineering & Technical',desc:'Triển khai dự án, kỹ thuật, vận hành',descEn:'Project deployment, engineering, and operations',checked:true},
  {code:'IT',name:'CNTT',nameEn:'Information Technology (IT)',desc:'Hạ tầng, hệ thống, hỗ trợ IT',descEn:'IT infrastructure, systems, and technical support',checked:false},
  {code:'MH',name:'Mua hàng',nameEn:'Procurement',desc:'Mua sắm, nhà cung cấp',descEn:'Purchasing, supplier management, and sourcing',checked:false},
  {code:'CSKH',name:'Chăm sóc khách hàng',nameEn:'Customer Support',desc:'Hỗ trợ khách hàng, dịch vụ',descEn:'Customer service and helpdesk support',checked:false},
  {code:'PC',name:'Pháp chế',nameEn:'Legal & Compliance',desc:'Pháp lý, tuân thủ',descEn:'Legal advisory, compliance, and governance',checked:false}
];

window.switchStep2Tab=function(t){window.setupStep2ActiveTab=t;renderSetupContent();};
window.togglePresetDept=function(code, isChecked){
  const d = PRESET_DEPARTMENTS.find(x => x.code === code);
  if (d) d.checked = isChecked;
};

function renderStep2HTML(counts){
  const tab=window.setupStep2ActiveTab;
  let tc='';
  if(tab==='choose'){
    let cards='';
    for(const d of PRESET_DEPARTMENTS){
      const dName = swIsVi() ? d.name : (d.nameEn || d.name);
      const dDesc = swIsVi() ? d.desc : (d.descEn || d.desc);
      cards+='<label class="sw-preset-card '+(d.checked?'checked':'')+'"><input type="checkbox" name="preset_dept" value="'+d.code+'" '+(d.checked?'checked':'')+' onchange="this.closest(\'.sw-preset-card\').classList.toggle(\'checked\', this.checked); window.togglePresetDept(\''+d.code+'\', this.checked);" style="margin-top:2px;accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+escapeHTML(dName)+' ('+d.code+')</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+escapeHTML(dDesc)+'</div></div></label>';
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
    let prev = '';
    const parsed = window.setupParsedDepartments || [];
    if (parsed.length > 0) {
      let rows = '';
      for (let i = 0; i < Math.min(parsed.length, 50); i++) {
        const d = parsed[i];
        const isValid = Boolean(d.department_code && d.department_name);
        rows += '<tr style="border-bottom:1px solid #F1F5F9;">'
          + '<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">' + (i + 1) + '</td>'
          + '<td style="padding:7px 10px;font-weight:600;color:#4B5563;font-size:11.5px;">' + escapeHTML(d.company_id || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#ea580c;font-size:11.5px;">' + escapeHTML(d.department_code || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:600;color:#111827;font-size:11.5px;">' + escapeHTML(d.department_name || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(d.type || 'Operation') + '</td>'
          + '<td style="padding:7px 10px;color:#2563EB;font-size:11.5px;">' + escapeHTML(d.manager_email || '–') + '</td>'
          + '<td style="padding:7px 10px;">' + (isValid ? '<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">' + swT('common.valid', 'Hợp lệ') + '</span>' : '<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">' + swT('common.invalid', 'Thiếu mã/tên') + '</span>') + '</td>'
          + '<td style="padding:5px 8px;text-align:center;white-space:nowrap;">'
          + '<button type="button" onclick="window.editSetupParsedItem(\'department\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #D1D5DB;background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:4px;" title="' + swT('common.edit', 'Sửa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#2563EB;">edit</span></button>'
          + '<button type="button" onclick="window.deleteSetupParsedItem(\'department\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#EF4444;">delete</span></button>'
          + '</td>'
          + '</tr>';
      }
      const validCount = parsed.filter(d => d.department_code && d.department_name).length;
      prev = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-top:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="material-symbols-rounded" style="font-size:26px;color:#059669;">domain</span>'
        + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step2_preview_title', 'Danh sách phòng ban tải lên') + '</div>'
        + '<div style="font-size:11px;color:#6B7280;">' + parsed.length + ' ' + swT('sw.step3_rows', 'dòng dữ liệu') + ' (' + validCount + ' ' + swT('sw.step3_valid', 'hợp lệ') + ')</div></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<button onclick="saveStep2AndAdvance()" class="sw-btn-primary" style="padding:6px 14px;font-size:12px;"><span class="material-symbols-rounded" style="font-size:16px;">check</span> ' + swT('sw.step2_confirm_import', 'Xác nhận lưu danh sách') + '</button>'
        + '<button onclick="window.setupParsedDepartments=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa file') + '"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button>'
        + '</div>'
        + '</div>'
        + '<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div style="overflow-x:auto;max-height:260px;overflow-y:auto;">'
        + '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">'
        + '<thead><tr style="background:#F8FAFC;">'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Company ID</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_code', 'Mã phòng ban') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_name', 'Tên phòng ban') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.type', 'Loại') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_manager', 'Email Quản lý') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.status', 'Trạng thái') + '</th>'
        + '<th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.actions', 'Thao tác') + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></div>';
    }
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'department\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="handleDepartmentExcelUpload(event)"></label></div></div>' + prev;
  } else if(tab==='quick'){
    // Quick Add: Only 3 fields (Mã PB, Tên PB, Người quản lý tùy chọn) - No Operation/Finance dropdown
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qdept-code" placeholder="' + swT('sw.step2_dept_code', 'Mã PB') + ' *"><input type="text" class="sw-input qdept-name" placeholder="' + swT('sw.step2_dept_name', 'Tên phòng ban') + ' *"><input type="text" class="sw-input qdept-manager" placeholder="' + swT('sw.step2_dept_manager', 'Người quản lý (tùy chọn)') + '"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step2_desc', 'Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.') + '</p><div id="quick-dept-rows">'+r3+'</div><button onclick="addQuickDeptRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> ' + swT('sw.step2_add_row', 'Thêm dòng') + '</button></div>';
  } else {
    const parsed = window.setupParsedDepartments || [];
    if (parsed.length > 0) {
      let rows = '';
      for (let i = 0; i < Math.min(parsed.length, 50); i++) {
        const d = parsed[i];
        const isValid = Boolean(d.department_code && d.department_name);
        rows += '<tr style="border-bottom:1px solid #F1F5F9;">'
          + '<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">' + (i + 1) + '</td>'
          + '<td style="padding:7px 10px;font-weight:600;color:#4B5563;font-size:11.5px;">' + escapeHTML(d.company_id || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#ea580c;font-size:11.5px;">' + escapeHTML(d.department_code || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:600;color:#111827;font-size:11.5px;">' + escapeHTML(d.department_name || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(d.type || 'Operation') + '</td>'
          + '<td style="padding:7px 10px;color:#2563EB;font-size:11.5px;">' + escapeHTML(d.manager_email || '–') + '</td>'
          + '<td style="padding:7px 10px;">' + (isValid ? '<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">' + swT('common.valid', 'Hợp lệ') + '</span>' : '<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">' + swT('common.invalid', 'Thiếu mã/tên') + '</span>') + '</td>'
          + '<td style="padding:5px 8px;text-align:center;white-space:nowrap;">'
          + '<button type="button" onclick="window.editSetupParsedItem(\'department\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #D1D5DB;background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:4px;" title="' + swT('common.edit', 'Sửa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#2563EB;">edit</span></button>'
          + '<button type="button" onclick="window.deleteSetupParsedItem(\'department\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#EF4444;">delete</span></button>'
          + '</td>'
          + '</tr>';
      }
      tc = '<div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:14px;">'
        + '<div><div style="font-size:13px;font-weight:700;color:#065F46;">' + swT('sw.step2_preview_title', 'Xem trước phòng ban từ file Excel') + '</div>'
        + '<div style="font-size:11.5px;color:#047857;">' + parsed.length + ' ' + swT('sw.step3_rows', 'dòng dữ liệu') + '</div></div>'
        + '<button onclick="saveStep2AndAdvance()" class="sw-btn-primary" style="padding:6px 14px;font-size:12px;"><span class="material-symbols-rounded" style="font-size:16px;">check</span> ' + swT('sw.step2_confirm_import', 'Xác nhận lưu danh sách') + '</button>'
        + '</div>'
        + '<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="overflow-x:auto;max-height:300px;overflow-y:auto;">'
        + '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">'
        + '<thead><tr style="background:#F8FAFC;">'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Company ID</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_code', 'Mã phòng ban') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_name', 'Tên phòng ban') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.type', 'Loại') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step2_dept_manager', 'Email Quản lý') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.status', 'Trạng thái') + '</th>'
        + '<th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.actions', 'Thao tác') + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></div></div>';
    } else {
      tc='<div><div style="background:#F9FAFB;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="padding:10px 16px;background:#F3F4F6;font-size:12px;font-weight:700;color:#374151;">' + swT('sw.step2_header', 'Thiết lập phòng ban') + ': <strong style="color:#16a34a;">'+(counts.department||0)+'</strong> ' + swT('sw.step2_name', 'Phòng ban') + '</div>'+(counts.department>0?'<div style="padding:16px;font-size:12px;color:#6B7280;">' + swT('sw.step2_choose_desc', 'Chọn các phòng ban phù hợp với doanh nghiệp.') + '</div>':'<div style="padding:20px;text-align:center;font-size:12px;color:#9CA3AF;">' + swT('sw.status_pending', 'Chưa thiết lập') + '</div>')+'</div></div>';
    }
  }
  const btnLabel = ((tab === 'excel' || tab === 'preview') && (window.setupParsedDepartments || []).length > 0)
    ? (swT('sw.step2_imported_btn', 'Lưu {{count}} phòng ban từ Excel').replace('{{count}}', window.setupParsedDepartments.length))
    : swT('sw.step2_save_btn', 'Tạo các phòng ban đã chọn');
  return '<div class="sw-card">'+swStepHeader('account_tree',2, swT('sw.step2_header', 'Thiết lập phòng ban'), swT('sw.step2_desc', 'Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.'))+swTabBar([{key:'choose',label:swT('sw.step2_tab_choose', 'Chọn mẫu')},{key:'excel',label:swT('sw.step2_tab_excel', 'Nhập từ Excel')},{key:'quick',label:swT('sw.step2_tab_quick', 'Nhập nhanh')},{key:'preview',label:swT('sw.step2_tab_preview', 'Xem trước')}],tab,'window.switchStep2Tab')+tc+swBottomNav(1,3, btnLabel,'saveStep2AndAdvance()')+'</div>';
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
  const mgrDesc = mgr ? (swIsVi() ? 'Quản lý: ' + mgr : 'Manager: ' + mgr) : name;
  PRESET_DEPARTMENTS.push({code, name, desc: mgrDesc, checked:true, manager: mgr});
  showToast(swT('sw.step2_added', 'Đã thêm phòng ban') + ' "' + name + '" (' + code + ')','info');
  renderSetupContent();
};

window.handleDepartmentExcelUpload = async function(event){
  const file = event.target.files[0];
  if (!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows || !rows.length) {
        showToast(swT('common.empty_file', 'File không có dòng dữ liệu'), 'warning');
        return;
      }
      const mapped = [];
      for (const row of rows) {
        const k = Object.keys(row);
        const didK = k.find(x => /department_id|dept_id|^id$/i.test(x));
        const compk = k.find(x => /company/i.test(x) || /công ty/i.test(x));
        const ck = k.find(x => /mã|department_code|dept_code|code/i.test(x));
        const nk = k.find(x => /department_name|dept_name|tên/i.test(x) && !/quản lý|manager/i.test(x));
        const tk = k.find(x => /loại|type/i.test(x));
        const mk = k.find(x => /quản lý|manager|email/i.test(x) && !/tên/i.test(x)) || k.find(x => /manager/i.test(x));

        const did = didK && row[didK] != null ? String(row[didK]).trim() : '';
        const compId = compk && row[compk] != null ? String(row[compk]).trim() : (window.setupDraft?.company?.my_company_id || '1');
        const code = ck ? String(row[ck] != null ? row[ck] : '').trim() : '';
        const name = nk ? String(row[nk] != null ? row[nk] : '').trim() : '';
        const type = tk ? String(row[tk] != null ? row[tk] : '').trim() : 'Operation';
        const mgr = mk ? String(row[mk] != null ? row[mk] : '').trim() : '';

        if (code || name) {
          mapped.push({
            department_id: did,
            company_id: compId,
            department_code: code || name.substring(0, 6).toUpperCase(),
            department_name: name || code,
            type: type || 'Operation',
            manager_email: mgr || null
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ trong file'), 'warning');
        return;
      }
      window.setupParsedDepartments = mapped;
      window.setupDraft.departments = mapped;
      saveSetupDraftToStorage();
      showToast(swT('sw.step2_parsed_count', 'Đã nhận diện {{count}} phòng ban').replace('{{count}}', mapped.length), 'success');
      renderSetupContent();
    } catch(err) {
      showToast(swT('sw.file_read_error', 'Lỗi đọc file: ') + err.message, 'error');
    }
  };
  r.readAsArrayBuffer(file);
};

window.applyParsedDepartments = async function(){
  const depts = window.setupParsedDepartments || [];
  if (!depts.length) {
    window.setSetupStep(3);
    return;
  }
  window.setupDraft.departments = depts;
  saveSetupDraftToStorage();
  showToast(swT('sw.step2_draft_saved', 'Đã lưu tạm {{count}} phòng ban vào bộ nhớ!').replace('{{count}}', depts.length), 'success');
  window.setupCurrentStep = 3;
  await renderSetupContent();
};

window.saveStep2AndAdvance = async function(){
  const tab = window.setupStep2ActiveTab;
  let deptsToSave = [];

  if (tab === 'excel' || (tab === 'preview' && (window.setupParsedDepartments || []).length > 0)) {
    deptsToSave = window.setupParsedDepartments || [];
  } else if (tab === 'quick') {
    const codes = document.querySelectorAll('.qdept-code');
    const names = document.querySelectorAll('.qdept-name');
    const mgrs = document.querySelectorAll('.qdept-manager');
    const curCompId = window.setupDraft?.company?.my_company_id || '1';
    codes.forEach((c, i) => {
      const code = c.value.trim();
      const name = names[i]?.value?.trim();
      const mgr = mgrs[i]?.value?.trim();
      if (code && name) {
        deptsToSave.push({
          department_id: '',
          company_id: curCompId,
          department_code: code,
          department_name: name,
          manager_email: mgr || null,
          type: 'Operation'
        });
      }
    });
  } else {
    // Presets
    const cbs = document.querySelectorAll('input[name="preset_dept"]:checked');
    const sels = Array.from(cbs).map(c => c.value);
    const curCompId = window.setupDraft?.company?.my_company_id || '1';
    deptsToSave = PRESET_DEPARTMENTS.filter(d => sels.includes(d.code)).map(d => ({
      department_id: '',
      company_id: curCompId,
      department_code: d.code,
      department_name: swIsVi() ? d.name : (d.nameEn || d.name),
      manager_email: d.manager || null,
      type: 'Operation'
    }));
  }

  if (deptsToSave.length > 0) {
    window.setupDraft.departments = deptsToSave;
    saveSetupDraftToStorage();
    showToast(swT('sw.step2_draft_saved', 'Đã lưu tạm {{count}} phòng ban vào bộ nhớ!').replace('{{count}}', deptsToSave.length), 'success');
  }
  window.setupCurrentStep = 3;
  await renderSetupContent();
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
    {key:'excel',icon:'table_view',color:'#059669',bg:'#ECFDF5',title:swT('sw.step3_tab_excel', 'Nhập từ Excel'),desc:swT('sw.step3_drag_drop', 'Tải lên file Excel đầy đủ cột.')}
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
  } else {
    let prev='';
    if(parsed.length>0){
      const vc=parsed.filter(e=>e.full_name&&e.email).length;
      let rows='';
      for(let i=0;i<Math.min(parsed.length,50);i++){
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
          +'<td style="padding:7px 10px;">'+(v?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">' + swT('common.valid', 'Hợp lệ') + '</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">' + swT('common.invalid', 'Lỗi') + '</span>')+'</td>'
          +'<td style="padding:5px 8px;text-align:center;white-space:nowrap;">'
          +'<button type="button" onclick="window.editSetupParsedItem(\'employee\', '+i+')" style="width:26px;height:26px;border-radius:6px;border:1px solid #D1D5DB;background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:4px;" title="' + swT('common.edit', 'Sửa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#2563EB;">edit</span></button>'
          +'<button type="button" onclick="window.deleteSetupParsedItem(\'employee\', '+i+')" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#EF4444;">delete</span></button>'
          +'</td>'
          +'</tr>';
      }
      prev='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:14px;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
        +'<span class="material-symbols-rounded" style="font-size:26px;color:#059669;">grid_on</span>'
        +'<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step3_file_title', 'File nhân viên') + '</div>'
        +'<div style="font-size:11px;color:#6B7280;">'+parsed.length+' ' + swT('sw.step3_rows', 'dòng dữ liệu') + ' ('+vc+' ' + swT('sw.step3_valid', 'hợp lệ') + ')</div></div>'
        +'</div>'
        +'<div style="display:flex;gap:8px;align-items:center;">'
        +'<button onclick="saveStep3AndAdvance()" class="sw-btn-primary" style="padding:6px 14px;font-size:12px;"><span class="material-symbols-rounded" style="font-size:16px;">check</span> ' + swT('sw.step3_confirm_import', 'Xác nhận lưu danh sách') + '</button>'
        +'<button onclick="window.setupParsedEmployees=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa file') + '"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button>'
        +'</div>'
        +'</div>'
        +'<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div class="sw-table-scroll-container" style="overflow-x:auto;max-height:280px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;white-space:nowrap;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_name', 'Họ và tên') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_username', 'Username') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_email', 'Email') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_dept', 'Phòng ban') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_position', 'Chức vụ') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_start_date', 'Ngày bắt đầu') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_direct_mgr', 'Quản lý trực tiếp') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_emg_name', 'Liên hệ khẩn cấp') + '</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.status', 'Trạng thái') + '</th><th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.actions', 'Thao tác') + '</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }
    tc='<div><div class="sw-upload-zone" style="margin-bottom:16px;"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:14px;">(.xlsx, .xls, .csv)</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="downloadEmployeeTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleEmployeeExcelUpload(event)"></label></div></div>'+prev+'</div>';
  }
  const btnLabel = parsed.length>0 ? (swT('sw.step3_imported', 'Nhập {{count}} nhân viên').replace('{{count}}', parsed.length)) : swT('sw.btn_continue', 'Tiếp tục bước tiếp theo');
  return '<div class="sw-card">'+swStepHeader('group', 3, swT('sw.step3_header', 'Thiết lập nhân viên'), swT('sw.step3_desc', 'Nhập danh sách nhân sự. Có thể nhập từ Excel hoặc thêm nhanh.'))+'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px;">'+modeCards+'</div>'+tc+swBottomNav(2,4,btnLabel,'saveStep3AndAdvance()')+'</div>';
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

// ── Helper: SheetJS loader on-demand ─────────────────────────
async function swEnsureXLSX() {
  if (window.XLSX) return;
  if (typeof window.ensureXLSX === 'function') {
    await window.ensureXLSX();
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error(swIsVi() ? 'Không thể tải thư viện xử lý Excel. Vui lòng kiểm tra kết nối mạng.' : 'Unable to load Excel library. Please check your network connection.'));
    document.head.appendChild(script);
  });
}

window.downloadEmployeeTemplate = async function(){
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    return;
  }
  const isVi = swIsVi();
  const headers = [
    'employee_id',
    'employee_code',
    'nick_name',
    'user_name',
    'full_name',
    'gen',
    'position',
    'company_id',
    'department_id',
    'status',
    'direct_manager',
    'role',
    'location_base',
    'email',
    'phone',
    'address',
    'start_date'
  ];
  const sampleData = [
    {
      employee_id: 1,
      employee_code: 'NV001',
      nick_name: '',
      user_name: 'dung.pham',
      full_name: 'Phạm Văn Dũng',
      gen: 'Nam',
      position: 'Tổng Giám đốc',
      company_id: 1,
      department_id: 1,
      status: 17,
      direct_manager: 1,
      role: 'Super Admin',
      location_base: 'Hà Nội',
      email: 'dung.pham@company.com',
      phone: '0982363845',
      address: 'Trần Phú, Hà Nội',
      start_date: new Date().toISOString().split('T')[0]
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 5, 16) }));
  const wb = XLSX.utils.book_new();
  const sheetName = isVi ? 'NhanVien' : 'Employees';
  const fileName = isVi ? 'Mau_Nhan_Vien_TeraX.xlsx' : 'Employee_Template_TeraX.xlsx';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
  showToast(swT('common.download_success', 'Đã tải xuống file mẫu nhân viên'),'success');
};

window.handleEmployeeExcelUpload = async function(event){
  const file = event.target.files[0];
  if (!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }
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
      const curCompId = window.setupDraft?.company?.my_company_id || '1';
      for (const row of rows) {
        const k = Object.keys(row);
        const eidK = k.find(x => /employee_id|^id$/i.test(x));
        const codeK = k.find(x => /employee_code|emp_code|mã nhân viên|mã nv/i.test(x));
        const nickK = k.find(x => /nick_name|nickname|biệt danh/i.test(x));
        const unK = k.find(x => /user_name|username|tên đăng nhập/i.test(x));
        const fnK = k.find(x => /full_name|họ và tên|họ tên|tên/i.test(x) && !/khẩn|emergency|quản lý|manager/i.test(x));
        const genK = k.find(x => /^gen$|gender|giới tính/i.test(x));
        const posK = k.find(x => /position|chức vụ|vị trí|chức danh/i.test(x));
        const compK = k.find(x => /company_id|công ty/i.test(x));
        const deptIdK = k.find(x => /department_id|dept_id/i.test(x));
        const deptNameK = k.find(x => /department_name|phòng ban/i.test(x)) || (row.__EMPTY ? '__EMPTY' : null);
        const statusK = k.find(x => /^status$|trạng thái/i.test(x));
        const mgrK = k.find(x => /direct_manager|quản lý trực tiếp/i.test(x)) || k.find(x => /quản lý|manager/i.test(x) && !/hr|head/i.test(x));
        const roleK = k.find(x => /^role$|vai trò/i.test(x));
        const locK = k.find(x => /location_base|location|địa điểm/i.test(x));
        const emailK = k.find(x => /email|thư/i.test(x) && !/quản lý|manager/i.test(x));
        const phoneK = k.find(x => /phone|điện thoại|sđt/i.test(x) && !/khẩn|emergency/i.test(x));
        const addrK = k.find(x => /address|địa chỉ/i.test(x) && !/công ty|company/i.test(x));
        const sdK = k.find(x => /start_date|ngày bắt đầu|ngày vào/i.test(x));

        const fn = fnK ? String(row[fnK]).trim() : '';
        const un = unK ? String(row[unK]).trim() : '';
        const em = emailK ? String(row[emailK]).trim() : '';
        let phone = phoneK && row[phoneK] != null ? String(row[phoneK]).trim() : '';
        if (phone && phone.length === 9) phone = '0' + phone;

        if (fn || un || em) {
          mapped.push({
            employee_id: eidK && row[eidK] != null ? String(row[eidK]).trim() : '',
            employee_code: codeK && row[codeK] != null ? String(row[codeK]).trim() : '',
            nick_name: nickK && row[nickK] != null ? String(row[nickK]).trim() : '',
            username: un || (em ? em.split('@')[0] : (fn ? fn.toLowerCase().replace(/\s+/g, '.') : '')),
            full_name: fn || un || em,
            gen: genK && row[genK] != null ? String(row[genK]).trim() : '',
            position: posK && row[posK] != null ? String(row[posK]).trim() : (swIsVi() ? 'Nhân viên' : 'Employee'),
            company_id: compK && row[compK] != null ? String(row[compK]).trim() : curCompId,
            department_id: deptIdK && row[deptIdK] != null ? String(row[deptIdK]).trim() : '',
            department_name: deptNameK && row[deptNameK] != null ? String(row[deptNameK]).trim() : '',
            status: statusK && row[statusK] != null && row[statusK] !== '' ? row[statusK] : 17,
            direct_manager: mgrK && row[mgrK] != null ? String(row[mgrK]).trim() : '',
            role: roleK && row[roleK] != null ? String(row[roleK]).trim() : 'Staff',
            location_base: locK && row[locK] != null ? String(row[locK]).trim() : '',
            email: em,
            phone: phone,
            address: addrK && row[addrK] != null ? String(row[addrK]).trim() : '',
            start_date: sdK && row[sdK] != null ? String(row[sdK]).trim() : new Date().toISOString().split('T')[0]
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ'),'warning');
        return;
      }
      window.setupParsedEmployees = mapped;
      window.setupDraft.employees = mapped;
      saveSetupDraftToStorage();
      showToast(swT('sw.step3_parsed_count', 'Đã nhận diện {{count}} nhân viên').replace('{{count}}', mapped.length),'success');
      renderSetupContent();
    } catch(err) {
      showToast(swT('sw.file_read_error', 'Lỗi đọc file: ') + err.message, 'error');
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

      if (fn || un || em) {
        employeesToSave.push({
          employee_id: '',
          employee_code: '',
          full_name: fn || un || em,
          username: un,
          email: em,
          department_code: dp,
          department_name: dp,
          position: pos,
          start_date: sd,
          direct_manager: dm,
          head_manager: hm,
          emergency_contact_name: en,
          emergency_contact_phone: ep
        });
      }
    });
  } else {
    employeesToSave = window.setupParsedEmployees || [];
  }

  if (employeesToSave.length > 0) {
    window.setupDraft.employees = employeesToSave;
    saveSetupDraftToStorage();
    showToast(swT('sw.step3_draft_saved', 'Đã lưu tạm {{count}} nhân viên vào bộ nhớ!').replace('{{count}}', employeesToSave.length), 'success');
  }
  window.setupCurrentStep = 4;
  await renderSetupContent();
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
window.handleStep4Search=function(val){
  window.setupStep4Search = val;
  const q = swRemoveAccents(val || '').toLowerCase().trim();
  const currentCat = window.setupStep4Category || 'all';
  const grid = document.getElementById('step4-policy-cards-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.sw-policy-card-item');
  let visibleCount = 0;
  cards.forEach(card => {
    const cat = card.dataset.cat;
    const searchTarget = card.dataset.search || '';
    const matchCat = (currentCat === 'all' || cat === currentCat);
    const matchSearch = (!q || searchTarget.includes(q));
    if (matchCat && matchSearch) {
      card.style.display = 'flex';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });
  const noResEl = document.getElementById('step4-no-results');
  if (noResEl) {
    noResEl.style.display = visibleCount === 0 ? 'block' : 'none';
  }
};
window.setStep4Search=function(v){
  window.setupStep4Search = v;
  const inp = document.getElementById('step4-search-input');
  if (inp && inp.value !== v) inp.value = v;
  window.handleStep4Search(v);
};
window.setStep4Category=function(c){
  window.setupStep4Category = c;
  const grid = document.getElementById('step4-policy-cards-grid');
  if (grid) {
    document.querySelectorAll('.sw-cat-btn').forEach(btn => {
      const isAct = btn.dataset.cat === c;
      const bColor = P_CAT_COLORS[btn.dataset.cat] || '#EA580C';
      const bBg = P_CAT_BGS[btn.dataset.cat] || '#FFF7ED';
      btn.style.background = isAct ? bBg : 'transparent';
      const titleEl = btn.querySelector('.cat-btn-title');
      if (titleEl) {
        titleEl.style.fontWeight = isAct ? '700' : '500';
        titleEl.style.color = isAct ? bColor : '#374151';
      }
      const iconEl = btn.querySelector('.cat-btn-icon');
      if (iconEl) {
        iconEl.style.color = isAct ? bColor : '#9CA3AF';
      }
    });
    window.handleStep4Search(window.setupStep4Search || '');
  } else {
    renderSetupContent();
  }
};
window.togglePresetPolicy=function(id, isChecked){
  const p = PRESET_POLICIES_FULL.find(x => x.id === id);
  if (p) p.checked = isChecked;
};
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

window.getSetupAvailableEmployees = function() {
  const list = [];
  const seen = new Set();

  const addEmp = (emp) => {
    if (!emp) return;
    const email = (emp.email || '').trim();
    const username = (emp.username || '').trim();
    const empId = (emp.employee_id || emp.id || '').trim();
    const fullName = (emp.full_name || emp.name || '').trim();

    const val = email || empId || username || fullName;
    if (!val) return;
    const key = val.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (email) seen.add(email.toLowerCase());
    if (empId) seen.add(empId.toLowerCase());
    if (username) seen.add(username.toLowerCase());

    const label = fullName
      ? `${fullName} (${email || username || empId})`
      : (email || username || empId);

    list.push({
      value: val,
      email: email,
      employee_id: empId,
      username: username,
      full_name: fullName,
      label: label
    });
  };

  // 1. From setup wizard cache (Step 3 employees parsed/entered, not yet in DB)
  if (Array.isArray(window.setupParsedEmployees)) {
    window.setupParsedEmployees.forEach(addEmp);
  }

  // 2. From setupWizardData
  if (Array.isArray(window.setupWizardData?.employees)) {
    window.setupWizardData.employees.forEach(addEmp);
  }

  // 3. From setup lookup cache
  if (Array.isArray(window._setupLookupCache?.['employee'])) {
    window._setupLookupCache['employee'].forEach(addEmp);
  }

  // 4. From selectCache if already fetched
  if (typeof selectCache !== 'undefined' && Array.isArray(selectCache['employee'])) {
    selectCache['employee'].forEach(addEmp);
  }

  // 5. Default Admin fallback
  const adminEmail = window.setupWizardData?.admin?.email || 'admin@company.com';
  const adminName = window.setupWizardData?.admin?.full_name || 'Super Admin';
  addEmp({ full_name: adminName, email: adminEmail, username: 'admin' });

  return list;
};

window.buildSetupEmployeeOptions = function(selectedVal, allowDirectManager = false, placeholder = '') {
  const isVi = typeof swIsVi === 'function' ? swIsVi() : true;
  const employees = window.getSetupAvailableEmployees();
  let opts = '';

  if (allowDirectManager) {
    // Only Tier 1 allows Direct Manager
    const isDm = !selectedVal || selectedVal === 'Direct Manager' || selectedVal.toLowerCase() === 'quản lý trực tiếp';
    opts += '<option value="Direct Manager" ' + (isDm ? 'selected' : '') + '>'
      + (isVi ? 'Direct Manager (Quản lý trực tiếp)' : 'Direct Manager')
      + '</option>';
  } else {
    // Other tiers and columns MUST select from employees
    const ph = placeholder || (isVi ? 'Chọn nhân viên' : 'Select Employee');
    opts += '<option value="">-- ' + escapeHTML(ph) + ' --</option>';
  }

  let foundSelected = false;
  for (const emp of employees) {
    const isSel = selectedVal && (
      String(selectedVal).toLowerCase() === emp.value.toLowerCase() ||
      String(selectedVal).toLowerCase() === (emp.email || '').toLowerCase() ||
      String(selectedVal).toLowerCase() === (emp.employee_id || '').toLowerCase() ||
      String(selectedVal).toLowerCase() === (emp.username || '').toLowerCase() ||
      String(selectedVal).toLowerCase() === (emp.full_name || '').toLowerCase()
    );
    if (isSel) foundSelected = true;
    opts += '<option value="' + escapeHTML(emp.value) + '" ' + (isSel ? 'selected' : '') + '>' + escapeHTML(emp.label) + '</option>';
  }

  if (selectedVal && !foundSelected && selectedVal !== 'Direct Manager' && selectedVal !== 'Auto') {
    opts += '<option value="' + escapeHTML(selectedVal) + '" selected>' + escapeHTML(selectedVal) + '</option>';
  }

  return opts;
};

window.renderStep4CustomPolicyCardHTML = function(idx, data = {}) {
  const lvl = data.approval_level || 'Tier 1';
  const name = data.policy_name || '';
  const type = data.policy_type || 'Operation';
  const sla = data.sla || 3;
  const desc = data.description || '';
  const t1 = data.tier1_approval || (lvl === 'Tier 0' ? 'Auto' : 'Direct Manager');
  const t2 = data.tier2_approval || '';
  const t3 = data.tier3_approval || '';

  const types = ['Operation', 'Finance', 'Technical', 'Sale and MKT'];
  let topts = '';
  for (const t of types) {
    topts += '<option value="' + t + '" ' + (type === t ? 'selected' : '') + '>' + t + '</option>';
  }

  const tierBtns = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'].map(l => 
    '<button type="button" class="sw-tier-btn" data-lvl="' + l + '" onclick="window.setStep4RowApprovalLevel(this, \'' + l + '\')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ' + (lvl === l ? '#ea580c' : '#D1D5DB') + ';background:' + (lvl === l ? '#ea580c' : '#FFFFFF') + ';color:' + (lvl === l ? '#FFFFFF' : '#374151') + ';">' + l + '</button>'
  ).join('');

  const isVi = swIsVi();
  const deptList = (window.setupParsedDepartments && window.setupParsedDepartments.length > 0)
    ? window.setupParsedDepartments
    : (window.setupWizardData?.departments || []);
  let deptOpts = '<option value="">-- ' + (isVi ? 'Chọn phòng ban (tùy chọn)' : 'Select Department (Optional)') + ' --</option>';
  for (const d of deptList) {
    const code = d.department_code || d.code || '';
    const dname = d.department_name || d.name || code;
    const isSel = (data.department_id && (data.department_id === code || data.department_id === dname || data.department_id === d.department_id));
    deptOpts += '<option value="' + escapeHTML(code || dname) + '" ' + (isSel ? 'selected' : '') + '>' + escapeHTML((code ? code + ' - ' : '') + dname) + '</option>';
  }

  const t1Opts = window.buildSetupEmployeeOptions(t1, true);
  const t2Opts = window.buildSetupEmployeeOptions(t2, false, isVi ? 'Chọn người duyệt Bậc 2' : 'Select Tier 2 Approver');
  const t3Opts = window.buildSetupEmployeeOptions(t3, false, isVi ? 'Chọn người duyệt Bậc 3' : 'Select Tier 3 Approver');
  const leadOpts = window.buildSetupEmployeeOptions(data.policy_lead || '', false, isVi ? 'Chọn Policy Lead (tùy chọn)' : 'Select Policy Lead (Optional)');
  const ownerOpts = window.buildSetupEmployeeOptions(data.sr_owner || '', false, isVi ? 'Chọn SR Owner (tùy chọn)' : 'Select SR Owner (Optional)');

  return '<div class="step4-policy-row" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:14px;position:relative;">'
    + '<input type="hidden" class="step4-pol-level" value="' + escapeHTML(lvl) + '">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #F3F4F6;">'
    + '<div class="step4-pol-title" style="font-size:12.5px;font-weight:700;color:#EA580C;display:flex;align-items:center;gap:6px;">'
    + '<span class="material-symbols-rounded" style="font-size:16px;">alt_route</span> '
    + swT('sw.step4_process_item', 'Quy trình') + ' #' + (idx + 1)
    + '</div>'
    + '<button type="button" onclick="window.removeStep4CustomPolicyRow(this)" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '">'
    + '<span class="material-symbols-rounded" style="font-size:15px;">close</span>'
    + '</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
    + '<div style="grid-column:span 2;">'
    + swLabel(swT('sw.step4_policy_name', 'Tên quy trình'), true)
    + '<input type="text" list="new-policy-name-datalist" class="sw-input step4-pol-name" value="' + escapeHTML(name) + '" placeholder="' + swT('sw.step4_policy_name_ph', 'VD: Quy trình phê duyệt hợp đồng dịch vụ') + '">'
    + '</div>'
    + '<div>'
    + swLabel(swT('sw.step4_policy_type', 'Loại'), false)
    + '<select class="sw-select step4-pol-type">' + topts + '</select>'
    + '</div>'
    + '<div>'
    + swLabel(swT('sw.step4_sla', 'SLA (ngày)'), false)
    + '<input type="number" min="1" class="sw-input step4-pol-sla" value="' + escapeHTML(String(sla)) + '">'
    + '</div>'
    + '<div>'
    + swLabel(isVi ? 'Policy Lead (Trưởng QT)' : 'Policy Lead', false)
    + '<select class="sw-select step4-pol-lead">' + leadOpts + '</select>'
    + '</div>'
    + '<div>'
    + swLabel(isVi ? 'SR Owner (Người xử lý)' : 'SR Owner', false)
    + '<select class="sw-select step4-pol-owner">' + ownerOpts + '</select>'
    + '</div>'
    + '<div style="grid-column:span 2;">'
    + swLabel(swT('sw.step3_emp_dept', 'Phòng ban phụ trách'), false)
    + '<select class="sw-select step4-pol-dept">' + deptOpts + '</select>'
    + '</div>'
    + '<div style="grid-column:span 2;">'
    + swLabel(swT('sw.step4_desc_field', 'Mô tả'), false)
    + '<textarea class="sw-input step4-pol-desc" rows="2" style="resize:vertical;" placeholder="' + swT('sw.step4_policy_desc_ph', 'Mô tả ngắn gọn về mục đích quy trình...') + '">' + escapeHTML(desc) + '</textarea>'
    + '</div>'
    + '<div style="grid-column:span 2;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
    + '<div style="font-size:12px;font-weight:700;color:#111827;">' + swT('sw.step4_approval_level', 'Cấp độ duyệt') + '</div>'
    + '<div style="display:flex;gap:6px;">' + tierBtns + '</div>'
    + '</div>'
    + '<div class="step4-tier0-note" style="display:' + (lvl === 'Tier 0' ? 'block' : 'none') + ';padding:8px 12px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:12px;margin-top:8px;">'
    + '<span class="material-symbols-rounded" style="vertical-align:middle;font-size:16px;margin-right:4px;">check_circle</span>'
    + swT('sw.step4_tier0_desc', 'Tự động phê duyệt (không yêu cầu bước duyệt)')
    + '</div>'
    + '<div class="step4-tier1-container" style="margin-top:8px;display:' + (lvl === 'Tier 0' ? 'none' : 'block') + ';">'
    + swLabel(swT('sw.step4_tier1', 'Bậc 1 (Tier 1)'), true)
    + '<select class="sw-select step4-pol-t1">' + t1Opts + '</select>'
    + '</div>'
    + '<div class="step4-tier2-container" style="margin-top:8px;display:' + (lvl === 'Tier 2' || lvl === 'Tier 3' ? 'block' : 'none') + ';">'
    + swLabel(swT('sw.step4_tier2', 'Bậc 2 (Tier 2)'), true)
    + '<select class="sw-select step4-pol-t2">' + t2Opts + '</select>'
    + '</div>'
    + '<div class="step4-tier3-container" style="margin-top:8px;display:' + (lvl === 'Tier 3' ? 'block' : 'none') + ';">'
    + swLabel(swT('sw.step4_tier3', 'Bậc 3 (Tier 3)'), true)
    + '<select class="sw-select step4-pol-t3">' + t3Opts + '</select>'
    + '</div>'
    + '<div style="font-size:11px;color:#6B7280;margin-top:8px;line-height:1.5;">* ' + (isVi ? 'Duy nhất Bậc 1 hỗ trợ Direct Manager. Các bậc khác và người phụ trách chọn trực tiếp từ nhân viên.' : 'Only Tier 1 supports Direct Manager. Other tiers and leads are selected from employees.') + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
};

window.addStep4CustomPolicyRow = function(data = {}) {
  const container = document.getElementById('step4-custom-policies-container');
  if (!container) return;
  const count = container.querySelectorAll('.step4-policy-row').length;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.renderStep4CustomPolicyCardHTML(count, data);
  container.appendChild(tempDiv.firstElementChild);
};

window.removeStep4CustomPolicyRow = function(btn) {
  const container = document.getElementById('step4-custom-policies-container');
  const rows = container?.querySelectorAll('.step4-policy-row');
  if (rows && rows.length <= 1) {
    showToast(swT('sw.step4_at_least_one', 'Cần giữ lại ít nhất 1 quy trình'), 'warning');
    return;
  }
  btn.closest('.step4-policy-row')?.remove();
  if (container) {
    container.querySelectorAll('.step4-policy-row').forEach((row, i) => {
      const titleEl = row.querySelector('.step4-pol-title');
      if (titleEl) {
        titleEl.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px;">alt_route</span> '
          + swT('sw.step4_process_item', 'Quy trình') + ' #' + (i + 1);
      }
    });
  }
};

window.setStep4RowApprovalLevel = function(btn, lvl) {
  const row = btn.closest('.step4-policy-row');
  if (!row) return;
  const hiddenLvl = row.querySelector('.step4-pol-level');
  if (hiddenLvl) hiddenLvl.value = lvl;

  row.querySelectorAll('.sw-tier-btn').forEach(b => {
    const isAct = b.dataset.lvl === lvl;
    b.style.borderColor = isAct ? '#ea580c' : '#D1D5DB';
    b.style.backgroundColor = isAct ? '#ea580c' : '#FFFFFF';
    b.style.color = isAct ? '#FFFFFF' : '#374151';
  });

  const t0Note = row.querySelector('.step4-tier0-note');
  const t1Cont = row.querySelector('.step4-tier1-container');
  const t2Cont = row.querySelector('.step4-tier2-container');
  const t3Cont = row.querySelector('.step4-tier3-container');

  if (t0Note) t0Note.style.display = (lvl === 'Tier 0') ? 'block' : 'none';
  if (t1Cont) t1Cont.style.display = (lvl === 'Tier 0') ? 'none' : 'block';
  if (t2Cont) t2Cont.style.display = (lvl === 'Tier 2' || lvl === 'Tier 3') ? 'block' : 'none';
  if (t3Cont) t3Cont.style.display = (lvl === 'Tier 3') ? 'block' : 'none';
};

function renderStep4HTML(counts){
  const tab=window.setupStep4ActiveTab;
  let tc='';
  if(tab==='library'){
    const cat=window.setupStep4Category||'all',search=(window.setupStep4Search||'').toLowerCase();
    const searchClean = swRemoveAccents(search);
    let filtered=PRESET_POLICIES_FULL;
    if(cat!=='all')filtered=filtered.filter(p=>p.cat===cat);
    if(searchClean) {
      filtered=filtered.filter(p => {
        const fullStr = swRemoveAccents(p.nameVi + ' ' + (p.nameEn||'') + ' ' + p.descVi + ' ' + (p.descEn||'')).toLowerCase();
        return fullStr.includes(searchClean);
      });
    }
    
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
      catBtns+='<button class="sw-cat-btn" data-cat="'+c.key+'" onclick="window.setStep4Category(\''+c.key+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:9px;border:none;cursor:pointer;text-align:left;transition:var(--transition);width:100%;background:'+(isAct?P_CAT_BGS[c.key]||'#FFF7ED':'transparent')+';"><div style="display:flex;align-items:center;gap:6px;font-size:12px;"><span class="material-symbols-rounded cat-btn-icon" style="font-size:15px;color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#9CA3AF')+';">'+(P_CAT_ICONS[c.key]||'folder')+'</span><span class="cat-btn-title" style="font-weight:'+(isAct?'700':'500')+';color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#374151')+';">'+clabel+'</span></div><span style="font-size:11px;padding:1px 6px;border-radius:10px;background:#F3F4F6;color:#6B7280;font-weight:600;">'+c.count+'</span></button>';
    }
    let pCards='';
    const isVi = swIsVi();
    for(const p of PRESET_POLICIES_FULL){
      let tgs='';
      for(const tag of p.tags){
        const s=P_TAG_STYLES[tag]||{bg:'#F3F4F6',color:'#374151',border:'#E5E7EB'};
        const tagLabel = tag === 'Phổ biến' ? swT('sw.tag_popular', 'Phổ biến') : (tag === 'Mới' ? swT('sw.tag_new', 'Mới') : tag);
        tgs+='<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+s.bg+';color:'+s.color+';border:1px solid '+s.border+';font-weight:600;">'+tagLabel+'</span>';
      }
      const catColor=P_CAT_COLORS[p.cat]||'#EA580C',catBg=P_CAT_BGS[p.cat]||'#FFF7ED';
      const pName = isVi ? p.nameVi : (p.nameEn || p.name);
      const pDesc = isVi ? p.descVi : (p.descEn || p.descVi);
      const searchMeta = swRemoveAccents(pName + ' ' + (p.nameEn||'') + ' ' + pDesc + ' ' + (p.descEn||'') + ' ' + p.cat).toLowerCase();
      const isVisible = (cat === 'all' || p.cat === cat) && (!searchClean || searchMeta.includes(searchClean));
      pCards+='<label class="sw-policy-card sw-policy-card-item '+(p.checked?'checked':'')+'" data-cat="'+p.cat+'" data-search="'+escapeHTML(searchMeta)+'" style="display:'+(isVisible?'flex':'none')+';flex-direction:column;"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:9px;background:'+catBg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:17px;color:'+catColor+'">'+(P_CAT_ICONS[p.cat]||'policy')+'</span></div><input type="checkbox" name="preset_policy" value="'+p.id+'" '+(p.checked?'checked':'')+' style="accent-color:#f97316;width:16px;height:16px;flex-shrink:0;" onchange="this.closest(\'.sw-policy-card\').classList.toggle(\'checked\', this.checked); window.togglePresetPolicy(\''+p.id+'\', this.checked);"></div><div style="font-size:12.5px;font-weight:700;color:#111827;margin-bottom:4px;">'+escapeHTML(pName)+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;flex:1;margin-bottom:8px;">'+escapeHTML(pDesc)+'</div><div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;gap:4px;">'+tgs+'</div><span style="font-size:10.5px;color:#9CA3AF;">SLA: '+p.sla+'d</span></div></label>';
    }

    let policyDatalist = '<datalist id="sw-step4-search-datalist">';
    for (const p of PRESET_POLICIES_FULL) {
      if (isVi) {
        policyDatalist += '<option value="' + escapeHTML(p.nameVi) + '">' + escapeHTML(p.nameEn || '') + '</option>';
        if (p.nameEn && p.nameEn !== p.nameVi) {
          policyDatalist += '<option value="' + escapeHTML(p.nameEn) + '">' + escapeHTML(p.nameVi) + '</option>';
        }
      } else {
        const enName = p.nameEn || p.name;
        policyDatalist += '<option value="' + escapeHTML(enName) + '">' + escapeHTML(p.descEn || '') + '</option>';
      }
    }
    policyDatalist += '</datalist>';

    tc='<div style="display:flex;gap:16px;">'
      +'<div style="width:155px;flex-shrink:0;"><div style="font-size:10px;font-weight:700;color:#9CA3AF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">' + swT('category.title', 'Danh mục') + '</div><div style="display:flex;flex-direction:column;gap:2px;">'+catBtns+'</div></div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="position:relative;margin-bottom:14px;"><span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:#9CA3AF;pointer-events:none;">search</span><input type="text" id="step4-search-input" list="sw-step4-search-datalist" value="'+escapeHTML(window.setupStep4Search||'')+'" oninput="window.handleStep4Search(this.value)" placeholder="' + swT('sw.step4_search_ph', 'Tìm kiếm quy trình...') + '" class="sw-input" style="padding-left:36px;" autocomplete="off">'+policyDatalist+'</div>'
      +'<div id="step4-policy-cards-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">'+pCards+'<div id="step4-no-results" style="grid-column:span 3;text-align:center;padding:30px;color:#9CA3AF;font-size:13px;display:none;">' + swT('form.no_results', 'Không tìm thấy quy trình phù hợp') + '</div></div>'
      +'</div></div>';
  } else if(tab==='create'){
    const isVi = swIsVi();
    const policySuggestions = isVi ? [
      'Đề xuất thanh toán chi phí',
      'Đề nghị tạm ứng công tác',
      'Xin nghỉ phép',
      'Đề xuất cấp phát tài sản / thiết bị',
      'Đề xuất tuyển dụng nhân sự',
      'Quy trình tiếp nhận nhân viên mới (Onboarding)',
      'Thủ tục nghỉ việc (Offboarding)',
      'Đề xuất mua sắm vật tư',
      'Phê duyệt báo giá / Hợp đồng thương mại',
      'Đăng ký làm thêm giờ (OT)',
      'Xin phép làm việc từ xa (WFH)',
      'Báo cáo sự cố CNTT'
    ] : [
      'Expense Reimbursement Request',
      'Business Travel Advance Request',
      'Leave Request',
      'Asset Allocation Request',
      'Recruitment Proposal',
      'New Employee Onboarding',
      'Employee Offboarding',
      'Purchase Request',
      'Quotation / Commercial Contract Approval',
      'Overtime Registration (OT)',
      'Work From Home (WFH) Request',
      'IT Support Ticket'
    ];
    let policyNameDatalist = '<datalist id="new-policy-name-datalist">';
    for (const ps of policySuggestions) policyNameDatalist += '<option value="' + escapeHTML(ps) + '">';
    policyNameDatalist += '</datalist>';

    const approverSuggestions = isVi ? [
      'Direct Manager',
      'Quản lý trực tiếp',
      'HR Manager',
      'Finance Lead',
      'Trưởng phòng',
      'Super Admin',
      'CEO',
      'Ban Giám Đốc'
    ] : [
      'Direct Manager',
      'HR Manager',
      'Finance Lead',
      'Department Head',
      'Super Admin',
      'CEO',
      'Board of Directors'
    ];
    let approverDatalist = '<datalist id="new-policy-approver-datalist">';
    for (const as of approverSuggestions) approverDatalist += '<option value="' + escapeHTML(as) + '">';
    approverDatalist += '</datalist>';

    const customPolicies = (window.setupCustomPolicies && window.setupCustomPolicies.length > 0)
      ? window.setupCustomPolicies
      : [{ policy_name: '', policy_type: 'Operation', sla: 3, approval_level: 'Tier 1', tier1_approval: 'Direct Manager', tier2_approval: '', tier3_approval: '', description: '' }];
    window.setupCustomPolicies = customPolicies;

    const cardsHtml = customPolicies.map((p, i) => window.renderStep4CustomPolicyCardHTML(i, p)).join('');

    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:16px;">' + swT('sw.step4_desc', 'Tự định nghĩa quy trình theo nhu cầu riêng của doanh nghiệp.') + '</p>'
      + policyNameDatalist
      + approverDatalist
      + '<div id="step4-custom-policies-container">' + cardsHtml + '</div>'
      + '<button type="button" onclick="window.addStep4CustomPolicyRow()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px dashed #ea580c;background:#FFF7ED;color:#ea580c;font-size:12.5px;font-weight:600;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:18px;">add</span> ' + swT('sw.step4_add_process', 'Thêm quy trình khác') + '</button>'
      + '</div>';
  } else if(tab==='excel'){
    let prev = '';
    const parsed = window.setupParsedPolicies || [];
    if (parsed.length > 0) {
      let rows = '';
      for (let i = 0; i < Math.min(parsed.length, 50); i++) {
        const p = parsed[i];
        const t1Display = p.tier1_display || p.tier1_approval || 'Direct Manager';
        const t2Display = p.tier2_display || p.tier2_approval || '–';
        const t3Display = p.tier3_display || p.tier3_approval || '–';
        const leadDisplay = p.policy_lead_display || p.policy_lead || '–';
        const ownerDisplay = p.sr_owner_display || p.sr_owner || '–';
        const deptDisplay = p.department_id || '–';
        const t1Warn = (!p.tier1_matched && p.tier1_approval && p.tier1_approval !== 'Direct Manager')
          ? ' <span style="font-size:9.5px;color:#d97706;background:#FEF3C7;padding:1px 4px;border-radius:4px;font-weight:600;" title="' + swT('sw.emp_not_found_tip', 'Email chưa khớp với nhân viên nào') + '">' + swT('sw.emp_not_found', 'Chưa có NV') + '</span>'
          : '';
        const t2Warn = (!p.tier2_matched && p.tier2_approval)
          ? ' <span style="font-size:9.5px;color:#d97706;background:#FEF3C7;padding:1px 4px;border-radius:4px;font-weight:600;" title="' + swT('sw.emp_not_found_tip', 'Email chưa khớp với nhân viên nào') + '">' + swT('sw.emp_not_found', 'Chưa có NV') + '</span>'
          : '';
        const t3Warn = (!p.tier3_matched && p.tier3_approval)
          ? ' <span style="font-size:9.5px;color:#d97706;background:#FEF3C7;padding:1px 4px;border-radius:4px;font-weight:600;" title="' + swT('sw.emp_not_found_tip', 'Email chưa khớp với nhân viên nào') + '">' + swT('sw.emp_not_found', 'Chưa có NV') + '</span>'
          : '';

        rows += '<tr style="border-bottom:1px solid #F1F5F9;">'
          + '<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">' + (i + 1) + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#111827;font-size:11.5px;">' + escapeHTML(p.policy_name) + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(p.policy_type) + '</td>'
          + '<td style="padding:7px 10px;color:#ea580c;font-weight:600;font-size:11.5px;">' + escapeHTML(p.approval_level) + '</td>'
          + '<td style="padding:7px 10px;color:#2563EB;font-size:11.5px;" title="' + escapeHTML(p.tier1_approval || '') + '">' + escapeHTML(t1Display) + t1Warn + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;" title="' + escapeHTML(p.tier2_approval || '') + '">' + escapeHTML(t2Display) + t2Warn + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;" title="' + escapeHTML(p.tier3_approval || '') + '">' + escapeHTML(t3Display) + t3Warn + '</td>'
          + '<td style="padding:7px 10px;color:#059669;font-size:11.5px;" title="' + escapeHTML(p.policy_lead || '') + '">' + escapeHTML(leadDisplay) + '</td>'
          + '<td style="padding:7px 10px;color:#6366F1;font-size:11.5px;" title="' + escapeHTML(p.sr_owner || '') + '">' + escapeHTML(ownerDisplay) + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(deptDisplay) + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + (p.sla || 3) + ' ' + swT('common.days', 'ngày') + '</td>'
          + '<td style="padding:7px 10px;color:#6B7280;font-size:11.5px;max-width:180px;overflow:hidden;text-overflow:ellipsis;">' + escapeHTML(p.description || p.policy_name) + '</td>'
          + '<td style="padding:7px 10px;"><span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">' + swT('common.valid', 'Hợp lệ') + '</span></td>'
          + '<td style="padding:5px 8px;text-align:center;white-space:nowrap;">'
          + '<button type="button" onclick="window.editSetupParsedItem(\'policy\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #D1D5DB;background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:4px;" title="' + swT('common.edit', 'Sửa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#2563EB;">edit</span></button>'
          + '<button type="button" onclick="window.deleteSetupParsedItem(\'policy\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#EF4444;">delete</span></button>'
          + '</td>'
          + '</tr>';
      }
      prev = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-top:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="material-symbols-rounded" style="font-size:26px;color:#059669;">rule</span>'
        + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step4_preview_title', 'Danh sách quy trình tải lên') + '</div>'
        + '<div style="font-size:11px;color:#6B7280;">' + parsed.length + ' ' + swT('sw.step3_rows', 'dòng dữ liệu') + ' (' + parsed.length + ' ' + swT('sw.step3_valid', 'hợp lệ') + ')</div></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<button onclick="saveStep4AndAdvance()" class="sw-btn-primary" style="padding:6px 14px;font-size:12px;"><span class="material-symbols-rounded" style="font-size:16px;">check</span> ' + swT('sw.step4_confirm_import', 'Xác nhận lưu danh sách') + '</button>'
        + '<button onclick="window.setupParsedPolicies=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa file') + '"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button>'
        + '</div>'
        + '</div>'
        + '<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div class="sw-table-scroll-container" style="overflow-x:auto;max-height:280px;overflow-y:auto;">'
        + '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">'
        + '<thead><tr style="background:#F8FAFC;">'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step4_policy_name', 'Tên quy trình') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.type', 'Loại') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step4_approval_level', 'Cấp duyệt') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step4_tier1', 'Bậc 1') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step4_tier2', 'Bậc 2') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step4_tier3', 'Bậc 3') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Policy Lead</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">SR Owner</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step3_emp_dept', 'Phòng ban') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">SLA</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.description', 'Mô tả') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('common.status', 'Trạng thái') + '</th>'
        + '<th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;width:70px;">' + swT('common.actions', 'Thao tác') + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></div>';
    }
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="display:flex;gap:12px;justify-content:center;margin-top:14px;"><button onclick="downloadSetupTemplate(\'policy\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handlePolicyExcelUpload(event)"></label></div></div>' + prev;
  } else {
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step4_header', 'Thiết lập quy trình') + ': <strong style="color:#16a34a;">'+(counts.policy_and_program||0)+'</strong> ' + swT('sw.step4_name', 'Quy trình') + '</p>'+(counts.policy_and_program>0?'<div style="padding:20px;text-align:center;background:#ECFDF5;border-radius:12px;border:1px solid #A7F3D0;"><span class="material-symbols-rounded" style="font-size:40px;color:#059669;">task_alt</span><div style="margin-top:8px;font-size:13px;color:#111827;font-weight:600;">' + swT('sw.step4_existing_count', 'Đã có {{count}} quy trình').replace('{{count}}', counts.policy_and_program) + '</div></div>':'<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px;">' + swT('sw.status_pending', 'Chưa thiết lập') + '</div>')+'</div>';
  }
  const parsedPolicies = window.setupParsedPolicies || [];
  const btnLabel = (tab === 'excel' && parsedPolicies.length > 0)
    ? (swT('sw.step4_imported_btn', 'Lưu {{count}} quy trình từ Excel').replace('{{count}}', parsedPolicies.length))
    : (tab === 'create' ? swT('sw.step4_create_btn', 'Lưu quy trình mới') : swT('sw.step4_save_btn', 'Tạo các quy trình đã chọn'));
  return '<div class="sw-card">'+swStepHeader('policy', 4, swT('sw.step4_header', 'Thiết lập quy trình'), swT('sw.step4_desc', 'Chọn quy trình mẫu phù hợp hoặc tự tạo theo nhu cầu doanh nghiệp.'))+swTabBar([{key:'library',label:swT('sw.step4_tab_library', 'Chọn từ thư viện mẫu')},{key:'create',label:swT('sw.step4_tab_create', 'Tạo quy trình mới')},{key:'excel',label:swT('sw.step4_tab_excel', 'Nhập từ Excel')},{key:'manage',label:swT('sw.step4_tab_manage', 'Quản lý')}],tab,'window.switchStep4Tab')+tc+swBottomNav(3, 5, btnLabel,'saveStep4AndAdvance()')+'</div>';
}

window.handlePolicyExcelUpload = async function(event){
  const file = event.target.files[0];
  if (!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }

  // Pre-load employees to auto-resolve email/username -> employee_id in preview
  const emailToEmp = new Map();

  // 1. From setup wizard cache (Step 3 employees in RAM/state)
  try {
    const cachedEmps = window.getSetupAvailableEmployees ? window.getSetupAvailableEmployees() : [];
    cachedEmps.forEach(e => {
      const empObj = { employee_id: e.employee_id || e.value, email: e.email, full_name: e.full_name, username: e.username };
      if (e.employee_id) emailToEmp.set(String(e.employee_id).toLowerCase(), empObj);
      if (e.email) {
        const cleanEmail = String(e.email).trim().toLowerCase();
        emailToEmp.set(cleanEmail, empObj);
        const prefix = cleanEmail.split('@')[0];
        if (prefix && !emailToEmp.has(prefix)) emailToEmp.set(prefix, empObj);
      }
      if (e.username) emailToEmp.set(String(e.username).toLowerCase(), empObj);
      if (e.full_name) emailToEmp.set(String(e.full_name).toLowerCase(), empObj);
    });
  } catch(e) {
    console.warn('Error reading setup cached employees for policy preview:', e);
  }

  // 2. From DB
  try {
    const res = await apiGet('/table/employee?limit=1000');
    const empList = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    empList.forEach(e => {
      if (e.employee_id) {
        const empId = String(e.employee_id).trim();
        emailToEmp.set(empId.toLowerCase(), e);
        if (e.email) {
          const cleanEmail = String(e.email).trim().toLowerCase();
          emailToEmp.set(cleanEmail, e);
          const prefix = cleanEmail.split('@')[0];
          if (prefix && !emailToEmp.has(prefix)) emailToEmp.set(prefix, e);
        }
        if (e.username) {
          const cleanUser = String(e.username).trim().toLowerCase();
          if (!emailToEmp.has(cleanUser)) emailToEmp.set(cleanUser, e);
        }
      }
    });
  } catch(e) {
    console.warn('Could not fetch employees for policy preview:', e);
  }

  const resolveApprover = (val, isTier1 = false) => {
    if (!val || typeof val !== 'string') return { id: isTier1 ? 'Direct Manager' : null, display: isTier1 ? 'Direct Manager' : '–', matched: true };
    const trimmed = val.trim();
    if (!trimmed) return { id: isTier1 ? 'Direct Manager' : null, display: isTier1 ? 'Direct Manager' : '–', matched: true };
    if (trimmed.toLowerCase() === 'direct manager' || trimmed.toLowerCase() === 'quản lý trực tiếp') {
      if (isTier1) {
        return { id: 'Direct Manager', display: 'Direct Manager', matched: true };
      } else {
        // Chỉ duy nhất Tier 1 mới cho phép Direct Manager!
        return { id: '', display: '– (Chỉ Tier 1 dùng Direct Manager)', matched: false };
      }
    }
    const lower = trimmed.toLowerCase();
    if (emailToEmp.has(lower)) {
      const emp = emailToEmp.get(lower);
      const name = emp.full_name || emp.username || emp.employee_id;
      return { id: emp.email || emp.employee_id, display: `${name} (${emp.email || emp.employee_id})`, matched: true };
    }
    return { id: trimmed, display: trimmed, matched: false };
  };

  const r = new FileReader();
  r.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows || !rows.length) {
        showToast(swT('common.empty_file', 'File không có dòng dữ liệu'), 'warning');
        return;
      }
      const mapped = [];
      for (const row of rows) {
        const k = Object.keys(row);
        const nk = k.find(x => /quy trình.*tên|tên.*quy trình|policy_name|policy.*name|tên/i.test(x));
        const tk = k.find(x => /loại|policy_type|type/i.test(x));
        const slak = k.find(x => /sla|thời hạn|thời gian/i.test(x));
        const lvk = k.find(x => /approval_level|cấp duyệt|bậc duyệt|level/i.test(x));
        const t1k = k.find(x => /tier1|bậc 1|cấp 1|người duyệt 1/i.test(x));
        const t2k = k.find(x => /tier2|bậc 2|cấp 2|người duyệt 2/i.test(x));
        const t3k = k.find(x => /tier3|bậc 3|cấp 3|người duyệt 3/i.test(x));
        const leadk = k.find(x => /policy_lead|lead|trưởng.*quy trình|phụ trách/i.test(x));
        const ownerk = k.find(x => /sr_owner|owner|xử lý|chủ sở hữu/i.test(x));
        const deptk = k.find(x => /department|phòng.*ban|bộ phận/i.test(x));
        const elk = k.find(x => /elements|thành phần|module/i.test(x));
        const dk = k.find(x => /mô tả|description|desc/i.test(x));

        const name = nk ? String(row[nk]).trim() : '';
        if (name) {
          const t1Val = t1k ? String(row[t1k]).trim() : 'Direct Manager';
          const t2Val = t2k ? String(row[t2k]).trim() : '';
          const t3Val = t3k ? String(row[t3k]).trim() : '';
          const leadVal = leadk ? String(row[leadk]).trim() : '';
          const ownerVal = ownerk ? String(row[ownerk]).trim() : '';
          const deptVal = deptk ? String(row[deptk]).trim() : '';

          const t1Resolved = resolveApprover(t1Val, true);
          const t2Resolved = resolveApprover(t2Val, false);
          const t3Resolved = resolveApprover(t3Val, false);
          const leadResolved = resolveApprover(leadVal, false);
          const ownerResolved = resolveApprover(ownerVal, false);

          let lvl = lvk ? String(row[lvk]).trim() : '';
          if (!lvl) {
            lvl = t3Val ? 'Tier 3' : (t2Val ? 'Tier 2' : 'Tier 1');
          }
          mapped.push({
            policy_name: name,
            policy_type: tk ? String(row[tk]).trim() : 'Operation',
            sla: slak ? (parseInt(row[slak]) || 3) : 3,
            approval_level: lvl,
            tier1_approval: t1Resolved.id,
            tier1_display: t1Resolved.display,
            tier1_matched: t1Resolved.matched,
            tier2_approval: t2Resolved.id,
            tier2_display: t2Resolved.display,
            tier2_matched: t2Resolved.matched,
            tier3_approval: t3Resolved.id,
            tier3_display: t3Resolved.display,
            tier3_matched: t3Resolved.matched,
            policy_lead: leadResolved.id || leadVal || '',
            policy_lead_display: leadResolved.display || leadVal || '–',
            policy_lead_matched: leadResolved.matched,
            sr_owner: ownerResolved.id || ownerVal || '',
            sr_owner_display: ownerResolved.display || ownerVal || '–',
            sr_owner_matched: ownerResolved.matched,
            department_id: deptVal,
            elements: elk ? String(row[elk]).trim() : 'ASSIGN_TASK',
            description: dk ? String(row[dk]).trim() : name
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ trong file'), 'warning');
        return;
      }
      window.setupParsedPolicies = mapped;
      showToast(swT('sw.step4_parsed_count', 'Đã nhận diện {{count}} quy trình').replace('{{count}}', mapped.length), 'success');
      renderSetupContent();
    } catch(err) {
      showToast(swT('sw.file_read_error', 'Lỗi đọc file: ') + err.message, 'error');
    }
  };
  r.readAsArrayBuffer(file);
};

window.applyParsedPolicies = async function(){
  const policies = window.setupParsedPolicies || [];
  if (!policies.length) {
    window.setSetupStep(5);
    return;
  }
  window.setupDraft.policies = policies;
  saveSetupDraftToStorage();
  showToast(swT('sw.step4_draft_saved', 'Đã lưu tạm {{count}} quy trình vào bộ nhớ!').replace('{{count}}', policies.length), 'success');
  window.setupCurrentStep = 5;
  await renderSetupContent();
};

window.saveStep4AndAdvance = async function(){
  const tab = window.setupStep4ActiveTab;
  let policiesToSave = [];

  if (tab === 'excel') {
    policiesToSave = window.setupParsedPolicies || [];
  } else if (tab === 'create') {
    const rows = document.querySelectorAll('#step4-custom-policies-container .step4-policy-row');
    rows.forEach(r => {
      const name = r.querySelector('.step4-pol-name')?.value?.trim();
      if (!name) return;
      const type = r.querySelector('.step4-pol-type')?.value || 'Operation';
      const sla = parseInt(r.querySelector('.step4-pol-sla')?.value) || 3;
      const desc = r.querySelector('.step4-pol-desc')?.value?.trim() || name;
      const lvl = r.querySelector('.step4-pol-level')?.value || 'Tier 1';
      const tier1 = (lvl === 'Tier 0') ? 'Auto' : (r.querySelector('.step4-pol-t1')?.value?.trim() || 'Direct Manager');
      const tier2 = (lvl === 'Tier 2' || lvl === 'Tier 3') ? (r.querySelector('.step4-pol-t2')?.value?.trim() || null) : null;
      const tier3 = (lvl === 'Tier 3') ? (r.querySelector('.step4-pol-t3')?.value?.trim() || null) : null;
      const lead = r.querySelector('.step4-pol-lead')?.value?.trim() || null;
      const owner = r.querySelector('.step4-pol-owner')?.value?.trim() || null;
      const dept = r.querySelector('.step4-pol-dept')?.value?.trim() || null;
      policiesToSave.push({
        policy_name: name,
        policy_type: type,
        description: desc,
        elements: 'ASSIGN_TASK',
        sla: sla,
        approval_level: lvl,
        tier1_approval: tier1,
        tier2_approval: tier2,
        tier3_approval: tier3,
        policy_lead: lead,
        sr_owner: owner,
        department_id: dept
      });
    });
  } else {
    // Library presets
    const cbs = document.querySelectorAll('input[name="preset_policy"]:checked');
    const sels = Array.from(cbs).map(c => c.value);
    policiesToSave = PRESET_POLICIES_FULL.filter(p => sels.includes(p.id)).map(p => ({
      policy_name: swIsVi() ? (p.nameVi || p.name) : (p.nameEn || p.name),
      policy_type: p.type,
      description: swIsVi() ? (p.descVi || p.name) : (p.descEn || p.descVi || p.name),
      elements: p.elements,
      sla: p.sla,
      approval_level: 'Tier 1',
      tier1_approval: 'Direct Manager'
    }));
  }

  if (policiesToSave.length > 0) {
    window.setupDraft.policies = policiesToSave;
    saveSetupDraftToStorage();
    showToast(swT('sw.step4_draft_saved', 'Đã lưu tạm {{count}} quy trình vào bộ nhớ!').replace('{{count}}', policiesToSave.length), 'success');
  }
  window.setupCurrentStep = 5;
  await renderSetupContent();
};

// ─────────────────────────────────────────────────────────────
//  STEP 5: TÀI KHOẢN TIỀN (Cho phép nhập nhiều tài khoản ngân hàng)
// ─────────────────────────────────────────────────────────────
window.renderStep5AccountRowHTML = function(idx, data = {}) {
  const comp = window.setupWizardData?.company || {};
  const cur = data.currency || comp.base_currency || 'VND';
  const defaultBank = data.bank_name || 'MBV';
  return '<div class="step5-account-row" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:12px;position:relative;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #F3F4F6;">'
    + '<div style="font-size:12.5px;font-weight:700;color:#EA580C;display:flex;align-items:center;gap:6px;">'
    + '<span class="material-symbols-rounded" style="font-size:16px;">account_balance</span> '
    + swT('sw.step5_account_item', 'Tài khoản ngân hàng') + ' #' + (idx + 1)
    + '</div>'
    + '<button type="button" onclick="window.removeStep5AccountRow(this)" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '">'
    + '<span class="material-symbols-rounded" style="font-size:15px;">close</span>'
    + '</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
    + '<div style="grid-column:span 2;">'
    + swLabel(swT('sw.step5_acct_name', 'Tên tài khoản giao dịch'), false)
    + '<input type="text" list="step5-acct-name-datalist" class="sw-input step5-acct-name" placeholder="' + swT('sw.step5_acct_name_ph', 'VD: Tài khoản thanh toán chính Vietcombank') + '" value="' + escapeHTML(data.account_name || '') + '">'
    + '</div>'
    + '<div>'
    + swLabel(swT('sw.step5_bank', 'Ngân hàng (chọn hoặc tự nhập)'), false)
    + '<input type="text" list="step5-banks-datalist" class="sw-input step5-bank-name" placeholder="' + swT('sw.step5_bank_ph', 'VD: MBV, Vietcombank...') + '" value="' + escapeHTML(defaultBank) + '">'
    + '</div>'
    + '<div>'
    + swLabel(swT('sw.step5_acct_num', 'Số tài khoản'), false)
    + '<input type="text" class="sw-input step5-acct-num" placeholder="' + swT('sw.step5_acct_num_ph', 'VD: 0011001234567') + '" value="' + escapeHTML(data.account_number || '') + '">'
    + '</div>'
    + '<div style="grid-column:span 2;">'
    + swLabel(swT('sw.step5_currency', 'Loại tiền tệ'), false)
    + '<input type="text" list="step5-currency-datalist" class="sw-input step5-currency" value="' + escapeHTML(cur) + '">'
    + '</div>'
    + '</div>'
    + '</div>';
};

window.addStep5AccountRow = function(data = {}) {
  const container = document.getElementById('step5-accounts-container');
  if (!container) return;
  const count = container.querySelectorAll('.step5-account-row').length;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.renderStep5AccountRowHTML(count, data);
  container.appendChild(tempDiv.firstElementChild);
};

window.removeStep5AccountRow = function(btn) {
  const container = document.getElementById('step5-accounts-container');
  const rows = container?.querySelectorAll('.step5-account-row');
  if (rows && rows.length <= 1) {
    showToast(swT('sw.step5_at_least_one', 'Cần giữ lại ít nhất 1 tài khoản'), 'warning');
    return;
  }
  btn.closest('.step5-account-row')?.remove();
  // Re-number labels
  if (container) {
    container.querySelectorAll('.step5-account-row').forEach((row, i) => {
      const titleEl = row.querySelector('div > div');
      if (titleEl) {
        titleEl.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px;">account_balance</span> '
          + swT('sw.step5_account_item', 'Tài khoản ngân hàng') + ' #' + (i + 1);
      }
    });
  }
};

window.switchStep5Tab = function(t){ window.setupStep5ActiveTab = t; renderSetupContent(); };

function renderStep5HTML(comp, counts) {
  const tab = window.setupStep5ActiveTab || 'quick';
  const cur = (window.setupDraft?.company?.base_currency) || comp.base_currency || 'VND';
  const acctCount = (window.setupDraft?.accounts && window.setupDraft.accounts.length > 0)
    ? window.setupDraft.accounts.length
    : (counts.account || 0);

  const acctInfo = acctCount > 0 ? '<div style="padding:12px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:16px;font-size:12px;color:#374151;"><span class="material-symbols-rounded" style="font-size:14px;color:#059669;vertical-align:middle;">check_circle</span> ' + swT('sw.step5_existing_count', 'Hiện có {{count}} tài khoản đã thiết lập.').replace('{{count}}', acctCount) + '</div>' : '';

  const initialRowHTML = window.renderStep5AccountRowHTML(0, {
    account_name: '',
    bank_name: 'MBV',
    account_number: '',
    currency: cur
  });

  const isVi = swIsVi();
  const acctSuggestions = isVi ? [
    'Tài khoản thanh toán chính',
    'Tài khoản nhận thanh toán khách hàng',
    'Tài khoản chi lương & chế độ',
    'Tài khoản dự phòng / Tiết kiệm',
    'Tài khoản thanh toán chi nhánh',
    'Tài khoản ngoại tệ (USD)'
  ] : [
    'Main Operating Account',
    'Customer Collection Account',
    'Payroll & Benefits Account',
    'Reserve / Savings Account',
    'Branch Operating Account',
    'Foreign Currency Account (USD)'
  ];
  let acctNameDatalist = '<datalist id="step5-acct-name-datalist">';
  for (const as of acctSuggestions) acctNameDatalist += '<option value="' + escapeHTML(as) + '">';
  acctNameDatalist += '</datalist>';

  const popularBanks = [
    'MBV',
    'MB Bank (MBV)',
    'Vietcombank',
    'Vietinbank',
    'BIDV',
    'Techcombank',
    'ACB',
    'Agribank',
    'TPBank',
    'VPBank',
    'OCB',
    'SHB',
    'HDBank',
    'MSB',
    'VIB',
    'SeABank',
    'Sacombank',
    'Kienlongbank',
    'LPBank',
    'Viet Capital Bank',
    'Shinhan Bank',
    'Standard Chartered',
    'HSBC',
    'Woori Bank'
  ];
  let banksDatalist = '<datalist id="step5-banks-datalist">';
  for (const b of popularBanks) banksDatalist += '<option value="' + escapeHTML(b) + '">';
  banksDatalist += '</datalist>';

  const currencyDatalist = '<datalist id="step5-currency-datalist"><option value="VND"><option value="USD"><option value="EUR"><option value="JPY"><option value="SGD"><option value="CNY"></datalist>';

  let tabContent = '';
  if (tab === 'quick') {
    tabContent = '<form id="form-step5" onsubmit="event.preventDefault();saveStep5AndAdvance();">'
      + '<p style="font-size:12px;color:#6B7280;margin-bottom:14px;">' + swT('sw.step5_multi_desc', 'Bạn có thể nhập một hoặc nhiều tài khoản ngân hàng của doanh nghiệp.') + '</p>'
      + '<div id="step5-accounts-container">'
      + initialRowHTML
      + '</div>'
      + '<button type="button" onclick="window.addStep5AccountRow()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:9px;border:1px dashed #D1D5DB;background:#F9FAFB;color:#374151;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:16px;">'
      + '<span class="material-symbols-rounded" style="font-size:16px;">add</span> '
      + swT('sw.step5_add_account', 'Thêm tài khoản ngân hàng khác')
      + '</button>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;">'
      + '<button type="button" class="sw-btn-back" onclick="window.setSetupStep(4)"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> ' + swT('sw.btn_back', 'Quay lại') + '</button>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
      + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(6)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
      + '<button type="submit" class="sw-btn-primary"><span>' + swT('sw.btn_save_summary', 'Lưu và xem tổng kết') + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
      + '</div>'
      + '</div></form>';
  } else {
    // Excel upload tab
    const parsed = window.setupParsedAccounts || [];
    let prev = '';
    if (parsed.length > 0) {
      let rows = '';
      for (let i = 0; i < Math.min(parsed.length, 50); i++) {
        const a = parsed[i];
        rows += '<tr style="border-bottom:1px solid #F1F5F9;">'
          + '<td style="padding:7px 10px;color:#9CA3AF;font-size:11.5px;">' + (i + 1) + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#ea580c;font-size:11.5px;">' + escapeHTML(a.account_id || '–') + '</td>'
          + '<td style="padding:7px 10px;font-weight:700;color:#111827;font-size:11.5px;">' + escapeHTML(a.account_name || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#374151;font-size:11.5px;">' + escapeHTML(a.type || 'Bank Account') + '</td>'
          + '<td style="padding:7px 10px;color:#059669;font-weight:600;font-size:11.5px;">' + escapeHTML(a.account_status || 'active') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(a.currency || 'VND') + '</td>'
          + '<td style="padding:7px 10px;color:#2563EB;font-weight:600;font-size:11.5px;">' + escapeHTML(a.account_number || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#111827;font-size:11.5px;">' + escapeHTML(a.bank_name || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(String(a.exchange_rate || 1)) + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(a.transaction_managed_by || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(a.finance_control || '–') + '</td>'
          + '<td style="padding:7px 10px;color:#4B5563;font-size:11.5px;">' + escapeHTML(a.company_entity || '–') + '</td>'
          + '<td style="padding:5px 8px;text-align:center;white-space:nowrap;">'
          + '<button type="button" onclick="window.editSetupParsedItem(\'account\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #D1D5DB;background:#FFFFFF;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:4px;" title="' + swT('common.edit', 'Sửa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#2563EB;">edit</span></button>'
          + '<button type="button" onclick="window.deleteSetupParsedItem(\'account\', ' + i + ')" style="width:26px;height:26px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa') + '"><span class="material-symbols-rounded" style="font-size:15px;color:#EF4444;">delete</span></button>'
          + '</td>'
          + '</tr>';
      }
      prev = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-top:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="material-symbols-rounded" style="font-size:26px;color:#059669;">account_balance</span>'
        + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">' + swT('sw.step5_preview_title', 'Danh sách tài khoản đọc từ file Excel') + '</div>'
        + '<div style="font-size:11px;color:#6B7280;">' + parsed.length + ' ' + swT('sw.step3_rows', 'dòng dữ liệu') + '</div></div>'
        + '</div>'
        + '<button onclick="window.setupParsedAccounts=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="' + swT('common.delete', 'Xóa file') + '"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button>'
        + '</div>'
        + '<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:14px;"><div style="overflow-x:auto;max-height:280px;overflow-y:auto;">'
        + '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">'
        + '<thead><tr style="background:#F8FAFC;">'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">#</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Account ID</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step5_acct_name', 'Tên tài khoản') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Loại</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Trạng thái</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Tiền tệ</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step5_acct_num', 'Số tài khoản') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">' + swT('sw.step5_bank', 'Ngân hàng') + '</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Tỷ giá</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">QL Giao dịch</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Kiểm soát TC</th>'
        + '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;">Pháp nhân</th>'
        + '<th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;width:70px;">' + swT('common.actions', 'Thao tác') + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></div>';
    }
    tabContent = '<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">' + swT('sw.step3_drag_drop', 'Kéo & Thả file Excel vào đây') + '</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'account\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> ' + swT('sw.step3_download_tpl', 'Tải file mẫu Excel') + '</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> ' + swT('sw.step3_upload_excel', 'Chọn file Excel') + '<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="handleAccountExcelUpload(event)"></label></div></div>'
      + prev
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
      + '<button type="button" class="sw-btn-back" onclick="window.setSetupStep(4)"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> ' + swT('sw.btn_back', 'Quay lại') + '</button>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
      + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(6)">' + swT('sw.btn_skip', 'Bỏ qua bước này') + '</button>'
      + '<button type="button" class="sw-btn-primary" onclick="saveStep5AndAdvance()"><span>' + (parsed.length > 0 ? swT('sw.step5_imported_btn', 'Lưu {{count}} tài khoản từ Excel').replace('{{count}}', parsed.length) : swT('sw.btn_save_summary', 'Lưu và xem tổng kết')) + '</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
      + '</div>'
      + '</div>';
  }

  return '<div class="sw-card">'
    + swStepHeader('account_balance', 5, swT('sw.step5_header', 'Tài khoản ngân hàng'), swT('sw.step5_desc', 'Thiết lập các tài khoản thanh toán để quản lý dòng tiền thu chi.'))
    + acctInfo
    + acctNameDatalist
    + banksDatalist
    + currencyDatalist
    + swTabBar([
        { key: 'quick', label: swT('sw.step5_tab_quick', 'Điền thông tin') },
        { key: 'excel', label: swT('sw.step5_tab_excel', 'Nhập từ Excel') }
      ], tab, 'window.switchStep5Tab')
    + tabContent
    + '</div>';
}

window.handleAccountExcelUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows || !rows.length) {
        showToast(swT('common.empty_file', 'File không có dòng dữ liệu'), 'warning');
        return;
      }
      const mapped = [];
      for (const row of rows) {
        const k = Object.keys(row);
        const idK = k.find(x => /account_id|^id$|mã.*tài.*khoản/i.test(x));
        const nameK = k.find(x => /account_name|tên.*tài.*khoản/i.test(x));
        const typeK = k.find(x => /^type$|loại/i.test(x));
        const statusK = k.find(x => /account_status|status|trạng.*thái/i.test(x));
        const curK = k.find(x => /currency|tiền.*tệ/i.test(x));
        const numK = k.find(x => /account_number|số.*tài.*khoản|stk/i.test(x));
        const bankK = k.find(x => /bank_name|ngân.*hàng|bank/i.test(x));
        const rateK = k.find(x => /exchange_rate|tỷ.*giá/i.test(x));
        const transK = k.find(x => /transaction_managed_by|giao.*dịch/i.test(x));
        const finK = k.find(x => /finance_control|kiểm.*soát/i.test(x));
        const compK = k.find(x => /company_entity|pháp.*nhân|công.*ty/i.test(x));

        const aid = idK && row[idK] != null ? String(row[idK]).trim() : '';
        const aname = nameK && row[nameK] != null ? String(row[nameK]).trim() : '';
        const bname = bankK && row[bankK] != null ? String(row[bankK]).trim() : '';
        const anum = numK && row[numK] != null ? String(row[numK]).trim() : '';
        const atype = typeK && row[typeK] != null ? String(row[typeK]).trim() : 'Bank Account';
        const astatus = statusK && row[statusK] != null ? String(row[statusK]).trim() : 'active';
        const acur = curK && row[curK] != null ? String(row[curK]).trim() : 'VND';
        const arate = rateK && row[rateK] != null ? (parseFloat(row[rateK]) || 1) : 1;
        const atrans = transK && row[transK] != null ? String(row[transK]).trim() : '';
        const afin = finK && row[finK] != null ? String(row[finK]).trim() : '';
        const acomp = compK && row[compK] != null ? String(row[compK]).trim() : '';

        if (aname || bname || anum) {
          mapped.push({
            account_id: aid,
            account_name: aname || (bname ? (bname + (anum ? ' - ' + anum : '')) : 'Bank Account'),
            type: atype || 'Bank Account',
            account_status: astatus || 'active',
            currency: acur || 'VND',
            account_number: anum,
            bank_name: bname,
            exchange_rate: arate,
            transaction_managed_by: atrans,
            finance_control: afin,
            company_entity: acomp
          });
        }
      }
      if (!mapped.length) {
        showToast(swT('common.no_valid_rows', 'Không tìm thấy dòng hợp lệ trong file'), 'warning');
        return;
      }
      window.setupParsedAccounts = mapped;
      window.setupDraft.accounts = mapped;
      saveSetupDraftToStorage();
      showToast(swT('sw.step5_parsed_count', 'Đã nhận diện {{count}} tài khoản').replace('{{count}}', mapped.length), 'success');
      renderSetupContent();
    } catch(err) {
      showToast(swT('sw.file_read_error', 'Lỗi đọc file: ') + err.message, 'error');
    }
  };
  r.readAsArrayBuffer(file);
};

window.saveStep5AndAdvance = async function() {
  const tab = window.setupStep5ActiveTab || 'quick';
  let accounts = [];

  if (tab === 'excel' && window.setupParsedAccounts && window.setupParsedAccounts.length > 0) {
    accounts = window.setupParsedAccounts;
  } else {
    const rows = document.querySelectorAll('.step5-account-row');
    rows.forEach(r => {
      const an = r.querySelector('.step5-acct-name')?.value?.trim();
      const bn = r.querySelector('.step5-bank-name')?.value?.trim();
      const num = r.querySelector('.step5-acct-num')?.value?.trim();
      const cur = r.querySelector('.step5-currency')?.value?.trim() || 'VND';
      if (an || bn || num) {
        accounts.push({
          account_id: '',
          account_name: an || (bn ? (bn + (num ? ' - ' + num : '')) : swT('sw.step5_account_item', 'Tài khoản ngân hàng', 'Bank Account')),
          bank_name: bn,
          account_number: num,
          currency: cur,
          type: 'Bank Account',
          account_status: 'active'
        });
      }
    });
  }

  if (accounts.length > 0) {
    window.setupDraft.accounts = accounts;
    saveSetupDraftToStorage();
    showToast(swT('sw.step5_draft_saved', 'Đã lưu tạm {{count}} tài khoản vào bộ nhớ!').replace('{{count}}', accounts.length), 'success');
  }
  window.setupCurrentStep = 6;
  await renderSetupContent();
};

// ─────────────────────────────────────────────────────────────
//  STEP 6: SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────
function renderStep6HTML(counts,comp){
  const draft = window.setupDraft || {};
  const effectiveCounts = {
    my_company: draft.company ? 1 : (counts.my_company || 0),
    department: (draft.departments && draft.departments.length > 0) ? draft.departments.length : (counts.department || 0),
    employee: (draft.employees && draft.employees.length > 0) ? draft.employees.length : (counts.employee || 0),
    policy_and_program: (draft.policies && draft.policies.length > 0) ? draft.policies.length : (counts.policy_and_program || 0),
    account: (draft.accounts && draft.accounts.length > 0) ? draft.accounts.length : (counts.account || 0)
  };
  const compName = (draft.company && (draft.company.company_fullname || draft.company.company_shortname))
    || comp.company_fullname
    || comp.company_shortname
    || 'TeraX';
  const name=escapeHTML(compName);
  const summary=[
    {label:swT('sw.step1_name', 'Thông tin công ty'),val:effectiveCounts.my_company||0,unit:swT('sw.unit_company', 'công ty'),color:'#EA580C',bg:'#FFF7ED',done:effectiveCounts.my_company>0},
    {label:swT('sw.step2_name', 'Phòng ban'),val:effectiveCounts.department||0,unit:swT('sw.unit_department', 'phòng ban'),color:'#2563EB',bg:'#EFF6FF',done:effectiveCounts.department>0},
    {label:swT('sw.step3_name', 'Nhân viên'),val:effectiveCounts.employee||0,unit:swT('sw.unit_employee', 'nhân viên'),color:'#059669',bg:'#ECFDF5',done:effectiveCounts.employee>0},
    {label:swT('sw.step4_name', 'Quy trình'),val:effectiveCounts.policy_and_program||0,unit:swT('sw.unit_process', 'quy trình'),color:'#7C3AED',bg:'#F5F3FF',done:effectiveCounts.policy_and_program>0},
    {label:swT('sw.step5_name', 'Tài khoản tiền'),val:effectiveCounts.account||0,unit:swT('sw.unit_account', 'tài khoản'),color:'#D97706',bg:'#FFFBEB',done:effectiveCounts.account>0}
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
    {icon:'menu_book',color:'#2563EB',title:swT('sw.guide_doc', 'Hướng dẫn sử dụng'),desc:swT('sw.step6_res1_desc', 'Tìm hiểu các tính năng cơ bản')},
    {icon:'play_circle',color:'#EA580C',title:swT('sw.step6_res2_title', 'Video hướng dẫn'),desc:swT('sw.step6_res2_desc', 'Xem video thao tác chi tiết')},
    {icon:'table_chart',color:'#059669',title:swT('sw.step6_res3_title', 'Thư viện quy trình mẫu'),desc:swT('sw.step6_res3_desc', 'Tham khảo các quy trình phổ biến')},
    {icon:'help',color:'#7C3AED',title:swT('sw.step6_res4_title', 'Câu hỏi thường gặp'),desc:swT('sw.step6_res4_desc', 'Giải đáp các thắc mắc')}
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
    +'<p style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:20px;">' + swT('sw.step6_ready_message', 'Môi trường làm việc của {{name}} đã được thiết lập. Hãy bắt đầu khám phá TeraX.').replace('{{name}}', '<strong style="color:white;">'+name+'</strong>') + '</p>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;"><button onclick="completeSetupWizard()" class="sw-btn-primary" style="background:linear-gradient(135deg,#f97316,#ea580c);"><span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span> ' + swT('sw.step6_enter_app', 'Vào hệ thống ngay') + '</button>'
    +'<div style="width:100px;flex-shrink:0;text-align:center;"><div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="material-symbols-rounded" style="font-size:48px;color:#FCD34D;">verified</span></div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:8px;">' + swT('sw.step6_tagline', 'Cùng TeraX vận hành tốt hơn') + '</div></div>'
    +'</div></div>'
    +'<div class="sw-card">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#111827;">' + swT('sw.step6_overview', 'Tổng quan thiết lập') + '</div><button onclick="window.setSetupStep(1)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">settings</span> ' + swT('sw.step6_edit', 'Chỉnh sửa') + '</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'+sumCards+'</div>'
    +'</div>'
    +'<div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">' + swT('sw.step6_get_started', 'Bắt đầu với TeraX') + '</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">'+qaCards+'</div></div>'
    +'</div>'
    +'<div style="width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">'
    +'<div class="sw-card"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">' + swT('sw.step6_useful_resources', 'Tài nguyên hữu ích') + '</div><div style="display:flex;flex-direction:column;gap:2px;">'+resItems+'</div></div>'
    +'<div class="sw-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div style="width:34px;height:34px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div><div><div style="font-size:12px;font-weight:700;color:#111827;">' + swT('sw.need_support', 'Bạn cần hỗ trợ?') + '</div><div style="font-size:10.5px;color:#6B7280;">' + swT('sw.support_desc', 'Đội ngũ TeraX luôn sẵn sàng.') + '</div></div></div><button class="sw-btn-primary" style="width:100%;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> ' + swT('sw.contact_support', 'Liên hệ hỗ trợ') + '</button></div>'
    +'<div class="sw-card" style="background:rgba(255,255,255,0.7);"><div style="font-size:11.5px;color:#6B7280;line-height:1.6;font-style:italic;margin-bottom:10px;">"' + swT('sw.step6_quote', 'Cảm ơn bạn đã tin tưởng TeraX. Chúng tôi cam kết tiếp tục đồng hành để doanh nghiệp của bạn vận hành hiệu quả và phát triển bền vững.') + '"</div><div style="font-size:11px;color:#9CA3AF;font-weight:600;">' + swT('sw.step6_team', '— Đội ngũ TeraX') + '</div></div>'
    +'</div></div>';
}

// ─────────────────────────────────────────────────────────────
//  SYSTEM CONTROLS
// ─────────────────────────────────────────────────────────────
window.completeSetupWizard = async function(redirectTo){
  try {
    showToast(swT('sw.activating', 'Đang lưu thiết lập và kích hoạt hệ thống...'),'info');

    // Check if we have draft data to commit
    const draft = window.setupDraft || {};
    const hasDraftData = Boolean(
      draft.company ||
      (draft.departments && draft.departments.length > 0) ||
      (draft.employees && draft.employees.length > 0) ||
      (draft.policies && draft.policies.length > 0) ||
      (draft.accounts && draft.accounts.length > 0)
    );

    let res;
    if (hasDraftData) {
      res = await apiPost('/system-setup/commit-draft', {
        company: draft.company,
        departments: draft.departments || [],
        employees: draft.employees || [],
        policies: draft.policies || [],
        accounts: draft.accounts || []
      });
    } else {
      res = await apiPost('/system-setup/complete');
    }

    if(res.success){
      showToast(swT('sw.activated_success', 'Kích hoạt thành công! Dữ liệu đã được lưu vào hệ thống.'),'success');
      // Clear draft storage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('terax_setup_draft');
      }
      window.setupDraft = { company: null, departments: [], employees: [], policies: [], accounts: [] };
      window.setupCompleted = true;
      document.body.classList.remove('setup-active');
      const ns = document.getElementById('nav-setup');
      if(ns) ns.style.display = 'none';
      window.location.hash = redirectTo || 'home';
    } else {
      showToast(swT('common.error', 'Lỗi: ') + (res.message || 'Unknown'),'error');
    }
  } catch(err){
    showToast(swT('sw.server_error', 'Lỗi máy chủ: ') + err.message,'error');
  }
};

window.resetSetupStatusDev = async function(){
  if(!confirm(swT('sw.confirm_reset', 'Khôi phục lại chế độ Setup?'))) return;
  try {
    const res = await apiPost('/system-setup/reset');
    if(res.success){
      showToast(swT('sw.reset_success', 'Đã khôi phục.'), 'success');
      window.setupCompleted = false;
      window.setupCurrentStep = 1;
      document.body.classList.add('setup-active');
      const ns = document.getElementById('nav-setup');
      if(ns) ns.style.display = 'flex';
      window.location.hash = 'setup';
      await renderSetupContent();
    }
  } catch(err){showToast(swT('common.error', 'Lỗi: ') + err.message, 'error');}
};

window.downloadSetupTemplate = async function(moduleKey){
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    return;
  }

  const isVi = swIsVi();
  let headers = [];
  let sampleData = [];
  let fileName = moduleKey + '_template.xlsx';
  let sheetName = moduleKey;

  if (moduleKey === 'company') {
    headers = [
      'my_company_id',
      'company_shortname',
      'company_fullname',
      'address',
      'tax_code',
      'country',
      'city',
      'base_currency'
    ];
    sampleData = [
      {
        'my_company_id': 1,
        'company_shortname': 'SaoViet',
        'company_fullname': 'Công ty Cổ phần Sao Việt',
        'address': 'Hà Nội, Việt Nam',
        'tax_code': '0101234567',
        'country': 'Vietnam',
        'city': 'Hà Nội',
        'base_currency': 'VND'
      }
    ];
    fileName = isVi ? 'Mau_Cong_Ty_TeraX.xlsx' : 'Company_Template_TeraX.xlsx';
    sheetName = isVi ? 'CongTy' : 'Company';
  } else if (moduleKey === 'department') {
    headers = [
      'department_code',
      'department_name',
      'type',
      'manager_email',
      'company_id',
      'department_id'
    ];
    sampleData = isVi ? [
      {
        'department_code': 'BGD',
        'department_name': 'Ban Giám Đốc',
        'type': 'Operation',
        'manager_email': 'ceo@company.com',
        'company_id': 1,
        'department_id': 1
      },
      {
        'department_code': 'KD',
        'department_name': 'Phòng Kinh Doanh',
        'type': 'Sale and MKT',
        'manager_email': 'manager@company.com',
        'company_id': 1,
        'department_id': 2
      },
      {
        'department_code': 'KT',
        'department_name': 'Phòng Kỹ Thuật',
        'type': 'Technical',
        'manager_email': 'tech@company.com',
        'company_id': 1,
        'department_id': 3
      },
      {
        'department_code': 'TCKT',
        'department_name': 'Phòng Tài Chính Kế Toán',
        'type': 'Finance',
        'manager_email': 'accountant@company.com',
        'company_id': 1,
        'department_id': 4
      }
    ] : [
      {
        'department_code': 'BGD',
        'department_name': 'Board of Directors',
        'type': 'Operation',
        'manager_email': 'ceo@company.com',
        'company_id': 1,
        'department_id': 1
      },
      {
        'department_code': 'KD',
        'department_name': 'Sales & Marketing',
        'type': 'Sale and MKT',
        'manager_email': 'manager@company.com',
        'company_id': 1,
        'department_id': 2
      },
      {
        'department_code': 'KT',
        'department_name': 'Engineering & Technical',
        'type': 'Technical',
        'manager_email': 'tech@company.com',
        'company_id': 1,
        'department_id': 3
      },
      {
        'department_code': 'TCKT',
        'department_name': 'Finance & Accounting',
        'type': 'Finance',
        'manager_email': 'accountant@company.com',
        'company_id': 1,
        'department_id': 4
      }
    ];
    fileName = isVi ? 'Mau_Phong_Ban_TeraX.xlsx' : 'Department_Template_TeraX.xlsx';
    sheetName = isVi ? 'PhongBan' : 'Departments';
  } else if (moduleKey === 'employee') {
    return window.downloadEmployeeTemplate();
  } else if (moduleKey === 'account') {
    headers = [
      'account_id',
      'account_name',
      'type',
      'account_status',
      'currency',
      'account_number',
      'bank_name',
      'exchange_rate',
      'transaction_managed_by',
      'finance_control',
      'company_entity'
    ];
    sampleData = [
      {
        'account_id': 1,
        'account_name': 'Tài khoản chính MBV',
        'type': 'Bank Account',
        'account_status': 'active',
        'currency': 'VND',
        'account_number': '0011001234567',
        'bank_name': 'MBV',
        'exchange_rate': 1,
        'transaction_managed_by': '',
        'finance_control': '',
        'company_entity': 'SaoViet'
      }
    ];
    fileName = isVi ? 'Mau_Tai_Khoan_TeraX.xlsx' : 'Account_Template_TeraX.xlsx';
    sheetName = isVi ? 'TaiKhoan' : 'Accounts';
  } else if (moduleKey === 'policy') {
    headers = [
      'policy_name',
      'policy_type',
      'sla',
      'approval_level',
      'tier1_approval',
      'tier2_approval',
      'tier3_approval',
      'policy_lead',
      'sr_owner',
      'department_id',
      'elements',
      'description'
    ];
    sampleData = isVi ? [
      {
        'policy_name': 'Đề xuất thanh toán chi phí',
        'policy_type': 'Finance',
        'sla': 2,
        'approval_level': 'Tier 1',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': '',
        'tier3_approval': '',
        'policy_lead': 'manager@company.com',
        'sr_owner': 'accountant@company.com',
        'department_id': 'TCKT',
        'elements': 'PAYMENT,EXPENSE',
        'description': 'Quy trình xét duyệt và thanh toán các khoản chi phí hoạt động'
      },
      {
        'policy_name': 'Đề xuất tạm ứng công tác',
        'policy_type': 'Finance',
        'sla': 2,
        'approval_level': 'Tier 2',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': 'admin@company.com',
        'tier3_approval': '',
        'policy_lead': 'manager@company.com',
        'sr_owner': 'accountant@company.com',
        'department_id': 'TCKT',
        'elements': 'PAYMENT',
        'description': 'Quy trình tạm ứng kinh phí trước khi đi công tác'
      },
      {
        'policy_name': 'Đề xuất cấp phát tài sản / thiết bị',
        'policy_type': 'Operation',
        'sla': 3,
        'approval_level': 'Tier 3',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': 'it.lead@company.com',
        'tier3_approval': 'admin@company.com',
        'policy_lead': 'it.lead@company.com',
        'sr_owner': 'it.support@company.com',
        'department_id': 'KT',
        'elements': 'ASSET',
        'description': 'Quy trình cấp phát laptop, công cụ dụng cụ làm việc cho nhân viên'
      }
    ] : [
      {
        'policy_name': 'Expense Reimbursement Request',
        'policy_type': 'Finance',
        'sla': 2,
        'approval_level': 'Tier 1',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': '',
        'tier3_approval': '',
        'policy_lead': 'manager@company.com',
        'sr_owner': 'accountant@company.com',
        'department_id': 'TCKT',
        'elements': 'PAYMENT,EXPENSE',
        'description': 'Workflow for reviewing and paying operational business expenses'
      },
      {
        'policy_name': 'Business Travel Cash Advance',
        'policy_type': 'Finance',
        'sla': 2,
        'approval_level': 'Tier 2',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': 'admin@company.com',
        'tier3_approval': '',
        'policy_lead': 'manager@company.com',
        'sr_owner': 'accountant@company.com',
        'department_id': 'TCKT',
        'elements': 'PAYMENT',
        'description': 'Workflow for requesting travel funds before business trips'
      },
      {
        'policy_name': 'Equipment & Asset Allocation Request',
        'policy_type': 'Operation',
        'sla': 3,
        'approval_level': 'Tier 3',
        'tier1_approval': 'Direct Manager',
        'tier2_approval': 'it.lead@company.com',
        'tier3_approval': 'admin@company.com',
        'policy_lead': 'it.lead@company.com',
        'sr_owner': 'it.support@company.com',
        'department_id': 'KT',
        'elements': 'ASSET',
        'description': 'Workflow for allocating laptops, tools, and office equipment to employees'
      }
    ];
    fileName = isVi ? 'Mau_Quy_Trinh_TeraX.xlsx' : 'Process_Template_TeraX.xlsx';
    sheetName = isVi ? 'QuyTrinh' : 'Processes';
  } else {
    const mod = (typeof MODULES !== 'undefined') ? MODULES[moduleKey] : null;
    if (!mod) {
      showToast(swT('sw.no_template_config', 'Không tìm thấy cấu hình mẫu.'), 'warning');
      return;
    }
    const fields = (mod.fields || mod.columns || []).filter(f => !f.section && f.key && f.type !== 'file' && !f.hidden && !f.virtual);
    headers = fields.map(f => f.key);
    if (!headers.length) {
      showToast(swT('sw.no_fields_config', 'Không tìm thấy trường cấu hình.'), 'warning');
      return;
    }
    const sampleRow = {};
    fields.forEach(f => {
      sampleRow[f.key] = f.label || f.key;
    });
    sampleData = [sampleRow];
    sheetName = (mod.label || moduleKey).substring(0, 30);
    fileName = moduleKey + '_template.xlsx';
  }

  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
  showToast(swT('common.download_success', 'Đã tải xuống mẫu.'), 'success');
};

window.importSetupFile = async function(event,moduleKey){
  if (moduleKey === 'company') {
    return window.handleCompanyExcelUpload(event);
  }
  if (moduleKey === 'department') {
    return window.handleDepartmentExcelUpload(event);
  }
  if (moduleKey === 'employee') {
    return window.handleEmployeeExcelUpload(event);
  }
  if (moduleKey === 'policy') {
    return window.handlePolicyExcelUpload(event);
  }
  if (moduleKey === 'account') {
    return window.handleAccountExcelUpload(event);
  }
  const file = event.target.files[0];
  if(!file) return;
  try {
    await swEnsureXLSX();
  } catch(e) {
    showToast(e.message || swT('sw.excel_load_error', 'Lỗi tải thư viện Excel'), 'error');
    event.target.value = '';
    return;
  }
  showToast(swT('sw.analyzing', 'Đang phân tích...'),'info');
  const r = new FileReader();
  r.onload = async(e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      let jd = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
      if(!jd || !jd.length){
        showToast(swT('common.empty_file', 'Tệp không có dữ liệu.'),'warning');
        return;
      }
      // Tự động gán company_id nếu bảng cần
      const compId = window.setupWizardData?.company?.my_company_id || window.setupWizardData?.company?.company_id;
      if (compId) {
        const compIdStr = String(compId);
        jd = jd.map(row => {
          if (!row.company_id && !row.company) {
            return { ...row, company_id: compIdStr };
          }
          return row;
        });
      }
      const tn = moduleKey==='policy'?'policy_and_program':moduleKey;
      const res = await apiPost('/table/'+tn+'/bulk', jd);
      showToast(res.message || swT('sw.import_success', 'Nhập thành công {{count}} bản ghi!').replace('{{count}}', jd.length),'success');
      await renderSetupContent(true);
    } catch(err){
      showToast(swT('sw.upload_failed', 'Tải lên thất bại: ') + err.message,'error');
    } finally {
      event.target.value = '';
    }
  };
  r.readAsArrayBuffer(file);
};

// ─────────────────────────────────────────────────────────────
//  PREVIEW DATA EDIT & DELETE HANDLERS
// ─────────────────────────────────────────────────────────────
window.deleteSetupParsedItem = function(type, index) {
  if (type === 'department') {
    if (window.setupParsedDepartments && window.setupParsedDepartments[index] !== undefined) {
      window.setupParsedDepartments.splice(index, 1);
      window.setupDraft.departments = window.setupParsedDepartments;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_deleted', 'Đã xóa dòng thành công'), 'info');
      renderSetupContent();
    }
  } else if (type === 'employee') {
    if (window.setupParsedEmployees && window.setupParsedEmployees[index] !== undefined) {
      window.setupParsedEmployees.splice(index, 1);
      window.setupDraft.employees = window.setupParsedEmployees;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_deleted', 'Đã xóa dòng thành công'), 'info');
      renderSetupContent();
    }
  } else if (type === 'policy') {
    if (window.setupParsedPolicies && window.setupParsedPolicies[index] !== undefined) {
      window.setupParsedPolicies.splice(index, 1);
      window.setupDraft.policies = window.setupParsedPolicies;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_deleted', 'Đã xóa dòng thành công'), 'info');
      renderSetupContent();
    }
  } else if (type === 'account') {
    if (window.setupParsedAccounts && window.setupParsedAccounts[index] !== undefined) {
      window.setupParsedAccounts.splice(index, 1);
      window.setupDraft.accounts = window.setupParsedAccounts;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_deleted', 'Đã xóa dòng thành công'), 'info');
      renderSetupContent();
    }
  }
};

window.editSetupParsedItem = function(type, index) {
  let item = null;
  if (type === 'department') {
    item = window.setupParsedDepartments?.[index];
  } else if (type === 'employee') {
    item = window.setupParsedEmployees?.[index];
  } else if (type === 'policy') {
    item = window.setupParsedPolicies?.[index];
  } else if (type === 'account') {
    item = window.setupParsedAccounts?.[index];
  }
  if (!item) return;

  document.getElementById('sw-parsed-edit-modal-backdrop')?.remove();

  const isVi = swIsVi();
  let fieldsHtml = '';
  let title = swT('sw.edit_item_title', 'Chỉnh sửa thông tin');

  if (type === 'department') {
    title = (isVi ? 'Sửa thông tin phòng ban #' : 'Edit Department #') + (index + 1);
    const types = ['Operation', 'Finance', 'Technical', 'Sale and MKT'];
    const typeOpts = types.map(t => '<option value="' + t + '" ' + ((item.type || 'Operation') === t ? 'selected' : '') + '>' + t + '</option>').join('');
    const comp = window.setupWizardData?.company || {};
    const compShort = comp.company_shortname || window.authUser?.company_shortname || '';
    const compFull = comp.company_fullname || window.authUser?.company_name || '';
    const compDisplay = (compShort && compFull) ? `${compShort} - ${compFull}` : (compShort || compFull || (item.company_id ? `ID: ${item.company_id}` : (isVi ? 'Công ty mặc định' : 'Default Company')));

    fieldsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
      + '<input type="hidden" id="sw-edit-comp-id" value="' + escapeHTML(item.company_id || comp.my_company_id || '') + '">'
      + '<div style="grid-column:span 2;">' + swLabel(isVi ? 'Công ty' : 'Company', false)
      + '<div style="padding:9px 12px;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:10px;font-size:12.5px;font-weight:600;color:#1F2937;display:flex;align-items:center;gap:6px;"><span class="material-symbols-rounded" style="font-size:18px;color:#EA580C;">business</span>' + escapeHTML(compDisplay) + '</div></div>'
      + '<div>' + swLabel(swT('sw.step2_dept_code', 'Mã phòng ban'), true) + '<input type="text" id="sw-edit-dept-code" class="sw-input" value="' + escapeHTML(item.department_code || '') + '"></div>'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step2_dept_name', 'Tên phòng ban'), true) + '<input type="text" id="sw-edit-dept-name" class="sw-input" value="' + escapeHTML(item.department_name || '') + '"></div>'
      + '<div>' + swLabel(swT('common.type', 'Loại'), false) + '<select id="sw-edit-dept-type" class="sw-select">' + typeOpts + '</select></div>'
      + '<div>' + swLabel(swT('sw.step2_dept_manager', 'Email Quản lý'), false) + '<input type="email" id="sw-edit-dept-mgr" class="sw-input" value="' + escapeHTML(item.manager_email || '') + '"></div>'
      + '</div>';
  } else if (type === 'employee') {
    title = (isVi ? 'Sửa thông tin nhân viên #' : 'Edit Employee #') + (index + 1);

    // Build Department dropdown options
    const deptList = (window.setupParsedDepartments && window.setupParsedDepartments.length > 0)
      ? window.setupParsedDepartments
      : (window.setupWizardData?.departments || []);
    let deptOpts = '<option value="">-- ' + (isVi ? 'Chọn phòng ban' : 'Select Department') + ' --</option>';
    let curDeptMatched = false;
    for (const d of deptList) {
      const code = d.department_code || d.code || '';
      const name = d.department_name || d.name || code;
      const isSel = (item.department_code && (item.department_code === code || item.department_code === name));
      if (isSel) curDeptMatched = true;
      deptOpts += '<option value="' + escapeHTML(code || name) + '" ' + (isSel ? 'selected' : '') + '>' + escapeHTML((code ? code + ' - ' : '') + name) + '</option>';
    }
    if (item.department_code && !curDeptMatched) {
      deptOpts += '<option value="' + escapeHTML(item.department_code) + '" selected>' + escapeHTML(item.department_code) + '</option>';
    }

    // Build Manager dropdown options (Direct & HR)
    const empList = (window.setupParsedEmployees && window.setupParsedEmployees.length > 0)
      ? window.setupParsedEmployees
      : (window.setupWizardData?.employees || []);
    const buildMgrOpts = (curVal) => {
      let opts = '<option value="Super Admin" ' + (curVal === 'Super Admin' || !curVal ? 'selected' : '') + '>Super Admin</option>';
      let matched = (curVal === 'Super Admin' || !curVal);
      for (const e of empList) {
        if (!e.full_name && !e.email) continue;
        const val = e.email || e.full_name || e.username;
        const isSel = (curVal && (curVal === val || curVal === e.full_name || curVal === e.email));
        if (isSel) matched = true;
        opts += '<option value="' + escapeHTML(val) + '" ' + (isSel ? 'selected' : '') + '>' + escapeHTML(e.full_name + (e.email ? ' (' + e.email + ')' : '')) + '</option>';
      }
      if (curVal && !matched) {
        opts += '<option value="' + escapeHTML(curVal) + '" selected>' + escapeHTML(curVal) + '</option>';
      }
      return opts;
    };

    const directOpts = buildMgrOpts(item.direct_manager || 'Super Admin');
    const hrOpts = buildMgrOpts(item.hr_manager || 'Super Admin');

    fieldsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
      + '<div>' + swLabel(swT('sw.step3_emp_name', 'Họ và tên'), true) + '<input type="text" id="sw-edit-emp-name" class="sw-input" value="' + escapeHTML(item.full_name || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_username', 'Tên đăng nhập'), true) + '<input type="text" id="sw-edit-emp-user" class="sw-input" value="' + escapeHTML(item.username || '') + '"></div>'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step3_emp_email', 'Email'), true) + '<input type="email" id="sw-edit-emp-email" class="sw-input" value="' + escapeHTML(item.email || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_dept', 'Phòng ban'), false) + '<select id="sw-edit-emp-dept" class="sw-select">' + deptOpts + '</select></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_position', 'Chức vụ'), false) + '<input type="text" id="sw-edit-emp-pos" class="sw-input" value="' + escapeHTML(item.position || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_start_date', 'Ngày bắt đầu'), true) + '<input type="date" id="sw-edit-emp-start" class="sw-input" value="' + escapeHTML(item.start_date || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_direct_mgr', 'Quản lý trực tiếp'), true) + '<select id="sw-edit-emp-direct" class="sw-select">' + directOpts + '</select></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_hr_mgr', 'Quản lý nhân sự'), false) + '<select id="sw-edit-emp-hr" class="sw-select">' + hrOpts + '</select></div>'
      + '<div>' + swLabel(swT('sw.step3_emp_emg_name', 'Tên LH khẩn cấp'), false) + '<input type="text" id="sw-edit-emp-emg-name" class="sw-input" value="' + escapeHTML(item.emergency_contact_name || '') + '"></div>'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step3_emp_emg_phone', 'SĐT LH khẩn cấp'), false) + '<input type="text" id="sw-edit-emp-emg-phone" class="sw-input" value="' + escapeHTML(item.emergency_contact_phone || '') + '"></div>'
      + '</div>';
  } else if (type === 'policy') {
    title = (isVi ? 'Sửa thông tin quy trình #' : 'Edit Process #') + (index + 1);
    const types = ['Operation', 'Finance', 'Technical', 'Sale and MKT'];
    const typeOpts = types.map(t => '<option value="' + t + '" ' + ((item.policy_type || 'Operation') === t ? 'selected' : '') + '>' + t + '</option>').join('');
    const lvl = item.approval_level || 'Tier 1';
    const tierBtns = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'].map(l => 
      '<button type="button" class="sw-modal-tier-btn" data-lvl="' + l + '" onclick="window.handleEditPolLevelChange(\'' + l + '\')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ' + (lvl === l ? '#ea580c' : '#D1D5DB') + ';background:' + (lvl === l ? '#ea580c' : '#FFFFFF') + ';color:' + (lvl === l ? '#FFFFFF' : '#374151') + ';">' + l + '</button>'
    ).join('');

    // Department options for policy
    const deptList = (window.setupParsedDepartments && window.setupParsedDepartments.length > 0)
      ? window.setupParsedDepartments
      : (window.setupWizardData?.departments || []);
    let deptOpts = '<option value="">-- ' + (isVi ? 'Chọn phòng ban (tùy chọn)' : 'Select Department (Optional)') + ' --</option>';
    for (const d of deptList) {
      const code = d.department_code || d.code || '';
      const name = d.department_name || d.name || code;
      const isSel = (item.department_id && (item.department_id === code || item.department_id === name || item.department_id === d.department_id));
      deptOpts += '<option value="' + escapeHTML(code || name) + '" ' + (isSel ? 'selected' : '') + '>' + escapeHTML((code ? code + ' - ' : '') + name) + '</option>';
    }

    const t1Opts = window.buildSetupEmployeeOptions(item.tier1_approval || 'Direct Manager', true);
    const t2Opts = window.buildSetupEmployeeOptions(item.tier2_approval || '', false, isVi ? 'Chọn người duyệt Bậc 2' : 'Select Tier 2 Approver');
    const t3Opts = window.buildSetupEmployeeOptions(item.tier3_approval || '', false, isVi ? 'Chọn người duyệt Bậc 3' : 'Select Tier 3 Approver');
    const leadOpts = window.buildSetupEmployeeOptions(item.policy_lead || '', false, isVi ? 'Chọn Policy Lead (tùy chọn)' : 'Select Policy Lead (Optional)');
    const ownerOpts = window.buildSetupEmployeeOptions(item.sr_owner || '', false, isVi ? 'Chọn SR Owner (tùy chọn)' : 'Select SR Owner (Optional)');

    fieldsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
      + '<input type="hidden" id="sw-edit-pol-level" value="' + escapeHTML(lvl) + '">'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step4_policy_name', 'Tên quy trình'), true) + '<input type="text" id="sw-edit-pol-name" class="sw-input" value="' + escapeHTML(item.policy_name || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step4_policy_type', 'Loại'), false) + '<select id="sw-edit-pol-type" class="sw-select">' + typeOpts + '</select></div>'
      + '<div>' + swLabel(swT('sw.step4_sla', 'SLA (ngày)'), false) + '<input type="number" min="1" id="sw-edit-pol-sla" class="sw-input" value="' + escapeHTML(String(item.sla || 3)) + '"></div>'
      + '<div>' + swLabel(isVi ? 'Policy Lead (Trưởng QT)' : 'Policy Lead', false) + '<select id="sw-edit-pol-lead" class="sw-select">' + leadOpts + '</select></div>'
      + '<div>' + swLabel(isVi ? 'SR Owner (Người xử lý)' : 'SR Owner', false) + '<select id="sw-edit-pol-owner" class="sw-select">' + ownerOpts + '</select></div>'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step3_emp_dept', 'Phòng ban phụ trách'), false) + '<select id="sw-edit-pol-dept" class="sw-select">' + deptOpts + '</select></div>'
      + '<div style="grid-column:span 2;">' + swLabel(swT('sw.step4_desc_field', 'Mô tả'), false) + '<textarea id="sw-edit-pol-desc" class="sw-input" rows="2" style="resize:vertical;">' + escapeHTML(item.description || '') + '</textarea></div>'
      + '<div style="grid-column:span 2;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#F9FAFB;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<div style="font-size:12px;font-weight:700;color:#111827;">' + swT('sw.step4_approval_level', 'Cấp độ duyệt') + '</div>'
      + '<div style="display:flex;gap:6px;">' + tierBtns + '</div>'
      + '</div>'
      + '<div id="sw-edit-pol-t0-note" style="display:' + (lvl === 'Tier 0' ? 'block' : 'none') + ';padding:8px 12px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:12px;margin-top:8px;">'
      + '<span class="material-symbols-rounded" style="vertical-align:middle;font-size:16px;margin-right:4px;">check_circle</span>'
      + swT('sw.step4_tier0_desc', 'Tự động phê duyệt (không yêu cầu bước duyệt)')
      + '</div>'
      + '<div id="sw-edit-pol-t1-cont" style="margin-top:8px;display:' + (lvl === 'Tier 0' ? 'none' : 'block') + ';">'
      + swLabel(swT('sw.step4_tier1', 'Bậc 1 (Tier 1)'), true)
      + '<select id="sw-edit-pol-t1" class="sw-select">' + t1Opts + '</select>'
      + '</div>'
      + '<div id="sw-edit-pol-t2-cont" style="margin-top:8px;display:' + (lvl === 'Tier 2' || lvl === 'Tier 3' ? 'block' : 'none') + ';">'
      + swLabel(swT('sw.step4_tier2', 'Bậc 2 (Tier 2)'), true)
      + '<select id="sw-edit-pol-t2" class="sw-select">' + t2Opts + '</select>'
      + '</div>'
      + '<div id="sw-edit-pol-t3-cont" style="margin-top:8px;display:' + (lvl === 'Tier 3' ? 'block' : 'none') + ';">'
      + swLabel(swT('sw.step4_tier3', 'Bậc 3 (Tier 3)'), true)
      + '<select id="sw-edit-pol-t3" class="sw-select">' + t3Opts + '</select>'
      + '</div>'
      + '<div style="font-size:11px;color:#6B7280;margin-top:8px;line-height:1.5;">* ' + (isVi ? 'Duy nhất Bậc 1 hỗ trợ Direct Manager. Các bậc khác và người phụ trách chọn trực tiếp từ nhân viên.' : 'Only Tier 1 supports Direct Manager. Other tiers and leads are selected from employees.') + '</div>'
      + '</div>'
      + '</div>';
  } else if (type === 'account') {
    title = (isVi ? 'Sửa thông tin tài khoản #' : 'Edit Account #') + (index + 1);
    fieldsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
      + '<div>' + swLabel('Account ID', false) + '<input type="text" id="sw-edit-acct-id" class="sw-input" value="' + escapeHTML(item.account_id || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step5_acct_name', 'Tên tài khoản'), true) + '<input type="text" id="sw-edit-acct-name" class="sw-input" value="' + escapeHTML(item.account_name || '') + '"></div>'
      + '<div>' + swLabel(swT('common.type', 'Loại'), false) + '<input type="text" id="sw-edit-acct-type" class="sw-input" value="' + escapeHTML(item.type || 'Bank Account') + '"></div>'
      + '<div>' + swLabel(swT('common.status', 'Trạng thái'), false) + '<input type="text" id="sw-edit-acct-status" class="sw-input" value="' + escapeHTML(item.account_status || 'active') + '"></div>'
      + '<div>' + swLabel(swT('sw.step5_currency', 'Tiền tệ'), false) + '<input type="text" id="sw-edit-acct-currency" class="sw-input" value="' + escapeHTML(item.currency || 'VND') + '"></div>'
      + '<div>' + swLabel(swT('sw.step5_acct_num', 'Số tài khoản'), false) + '<input type="text" id="sw-edit-acct-num" class="sw-input" value="' + escapeHTML(item.account_number || '') + '"></div>'
      + '<div>' + swLabel(swT('sw.step5_bank', 'Ngân hàng'), false) + '<input type="text" id="sw-edit-acct-bank" class="sw-input" value="' + escapeHTML(item.bank_name || '') + '"></div>'
      + '<div>' + swLabel('Tỷ giá', false) + '<input type="number" step="any" id="sw-edit-acct-rate" class="sw-input" value="' + escapeHTML(String(item.exchange_rate || 1)) + '"></div>'
      + '<div>' + swLabel('QL Giao dịch', false) + '<input type="text" id="sw-edit-acct-trans" class="sw-input" value="' + escapeHTML(item.transaction_managed_by || '') + '"></div>'
      + '<div>' + swLabel('Kiểm soát TC', false) + '<input type="text" id="sw-edit-acct-fin" class="sw-input" value="' + escapeHTML(item.finance_control || '') + '"></div>'
      + '<div style="grid-column:span 2;">' + swLabel('Pháp nhân công ty', false) + '<input type="text" id="sw-edit-acct-comp" class="sw-input" value="' + escapeHTML(item.company_entity || '') + '"></div>'
      + '</div>';
  }

  const modalHtml = '<div id="sw-parsed-edit-modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">'
    + '<div style="background:#FFFFFF;border-radius:16px;max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #E5E7EB;">'
    + '<div style="font-size:14px;font-weight:700;color:#111827;display:flex;align-items:center;gap:6px;"><span class="material-symbols-rounded" style="color:#ea580c;font-size:20px;">edit_note</span> ' + escapeHTML(title) + '</div>'
    + '<button type="button" onclick="window.closeSwParsedEditModal()" style="width:30px;height:30px;border-radius:8px;border:none;background:#F3F4F6;color:#6B7280;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;">close</span></button>'
    + '</div>'
    + '<div style="padding:20px;overflow-y:auto;flex:1;">' + fieldsHtml + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #E5E7EB;background:#F9FAFB;">'
    + '<button type="button" onclick="window.closeSwParsedEditModal()" class="sw-btn-back" style="padding:8px 16px;font-size:12.5px;">' + swT('common.cancel', 'Hủy') + '</button>'
    + '<button type="button" onclick="window.saveSwParsedEditModal(\'' + type + '\', ' + index + ')" class="sw-btn-primary" style="padding:8px 18px;font-size:12.5px;"><span class="material-symbols-rounded" style="font-size:16px;">save</span> ' + swT('common.save_changes', 'Lưu thay đổi') + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  const div = document.createElement('div');
  div.innerHTML = modalHtml;
  document.body.appendChild(div.firstElementChild);
};

window.handleEditPolLevelChange = function(lvl) {
  const hidden = document.getElementById('sw-edit-pol-level');
  if (hidden) hidden.value = lvl;
  document.querySelectorAll('.sw-modal-tier-btn').forEach(b => {
    const isAct = b.dataset.lvl === lvl;
    b.style.borderColor = isAct ? '#ea580c' : '#D1D5DB';
    b.style.backgroundColor = isAct ? '#ea580c' : '#FFFFFF';
    b.style.color = isAct ? '#FFFFFF' : '#374151';
  });
  const t0 = document.getElementById('sw-edit-pol-t0-note');
  const t1 = document.getElementById('sw-edit-pol-t1-cont');
  const t2 = document.getElementById('sw-edit-pol-t2-cont');
  const t3 = document.getElementById('sw-edit-pol-t3-cont');
  if (t0) t0.style.display = (lvl === 'Tier 0') ? 'block' : 'none';
  if (t1) t1.style.display = (lvl === 'Tier 0') ? 'none' : 'block';
  if (t2) t2.style.display = (lvl === 'Tier 2' || lvl === 'Tier 3') ? 'block' : 'none';
  if (t3) t3.style.display = (lvl === 'Tier 3') ? 'block' : 'none';
};

window.closeSwParsedEditModal = function() {
  document.getElementById('sw-parsed-edit-modal-backdrop')?.remove();
};

window.saveSwParsedEditModal = function(type, index) {
  if (type === 'department') {
    const code = document.getElementById('sw-edit-dept-code')?.value?.trim();
    const name = document.getElementById('sw-edit-dept-name')?.value?.trim();
    if (!code || !name) {
      showToast(swT('form.required_field', 'Vui lòng điền đủ mã và tên phòng ban'), 'warning');
      return;
    }
    const compId = document.getElementById('sw-edit-comp-id')?.value?.trim() || '';
    const deptType = document.getElementById('sw-edit-dept-type')?.value || 'Operation';
    const mgr = document.getElementById('sw-edit-dept-mgr')?.value?.trim() || '';

    if (window.setupParsedDepartments && window.setupParsedDepartments[index]) {
      window.setupParsedDepartments[index] = {
        ...window.setupParsedDepartments[index],
        company_id: compId,
        department_code: code,
        department_name: name,
        type: deptType,
        manager_email: mgr
      };
      window.setupDraft.departments = window.setupParsedDepartments;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_updated', 'Đã cập nhật dòng thành công'), 'success');
      window.closeSwParsedEditModal();
      renderSetupContent();
    }
  } else if (type === 'employee') {
    const fullName = document.getElementById('sw-edit-emp-name')?.value?.trim();
    const username = document.getElementById('sw-edit-emp-user')?.value?.trim();
    const email = document.getElementById('sw-edit-emp-email')?.value?.trim();
    if (!fullName || !username || !email) {
      showToast(swT('form.required_field', 'Vui lòng điền đủ Họ tên, Username và Email'), 'warning');
      return;
    }
    const dept = document.getElementById('sw-edit-emp-dept')?.value?.trim() || '';
    const pos = document.getElementById('sw-edit-emp-pos')?.value?.trim() || '';
    const startDate = document.getElementById('sw-edit-emp-start')?.value?.trim() || new Date().toISOString().split('T')[0];
    const directMgr = document.getElementById('sw-edit-emp-direct')?.value?.trim() || 'Super Admin';
    const hrMgr = document.getElementById('sw-edit-emp-hr')?.value?.trim() || 'Super Admin';
    const emgName = document.getElementById('sw-edit-emp-emg-name')?.value?.trim() || '';
    const emgPhone = document.getElementById('sw-edit-emp-emg-phone')?.value?.trim() || '';

    if (window.setupParsedEmployees && window.setupParsedEmployees[index]) {
      window.setupParsedEmployees[index] = {
        ...window.setupParsedEmployees[index],
        full_name: fullName,
        username: username,
        email: email,
        department_code: dept,
        position: pos,
        start_date: startDate,
        direct_manager: directMgr,
        hr_manager: hrMgr,
        emergency_contact_name: emgName,
        emergency_contact_phone: emgPhone
      };
      window.setupDraft.employees = window.setupParsedEmployees;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_updated', 'Đã cập nhật dòng thành công'), 'success');
      window.closeSwParsedEditModal();
      renderSetupContent();
    }
  } else if (type === 'policy') {
    const polName = document.getElementById('sw-edit-pol-name')?.value?.trim();
    if (!polName) {
      showToast(swT('form.required_field', 'Vui lòng nhập tên quy trình'), 'warning');
      return;
    }
    const polType = document.getElementById('sw-edit-pol-type')?.value || 'Operation';
    const sla = parseInt(document.getElementById('sw-edit-pol-sla')?.value) || 3;
    const desc = document.getElementById('sw-edit-pol-desc')?.value?.trim() || polName;
    const lvl = document.getElementById('sw-edit-pol-level')?.value || 'Tier 1';
    const t1 = (lvl === 'Tier 0') ? 'Auto' : (document.getElementById('sw-edit-pol-t1')?.value?.trim() || 'Direct Manager');
    const t2 = (lvl === 'Tier 2' || lvl === 'Tier 3') ? (document.getElementById('sw-edit-pol-t2')?.value?.trim() || '') : '';
    const t3 = (lvl === 'Tier 3') ? (document.getElementById('sw-edit-pol-t3')?.value?.trim() || '') : '';
    const polLead = document.getElementById('sw-edit-pol-lead')?.value?.trim() || '';
    const srOwner = document.getElementById('sw-edit-pol-owner')?.value?.trim() || '';
    const deptId = document.getElementById('sw-edit-pol-dept')?.value?.trim() || '';

    const empList = window.getSetupAvailableEmployees ? window.getSetupAvailableEmployees() : [];
    const empMap = new Map();
    empList.forEach(e => {
      if (e.value) empMap.set(e.value.toLowerCase(), e);
      if (e.email) empMap.set(e.email.toLowerCase(), e);
      if (e.employee_id) empMap.set(e.employee_id.toLowerCase(), e);
      if (e.username) empMap.set(e.username.toLowerCase(), e);
    });
    const resolveDisplay = (val, isT1 = false) => {
      if (!val) return isT1 ? 'Direct Manager' : '–';
      if (val === 'Direct Manager') return 'Direct Manager';
      const found = empMap.get(val.toLowerCase());
      return found ? found.label : val;
    };

    if (window.setupParsedPolicies && window.setupParsedPolicies[index]) {
      window.setupParsedPolicies[index] = {
        ...window.setupParsedPolicies[index],
        policy_name: polName,
        policy_type: polType,
        sla: sla,
        description: desc,
        approval_level: lvl,
        tier1_approval: t1,
        tier1_display: resolveDisplay(t1, true),
        tier1_matched: true,
        tier2_approval: t2,
        tier2_display: resolveDisplay(t2, false),
        tier2_matched: !!t2,
        tier3_approval: t3,
        tier3_display: resolveDisplay(t3, false),
        tier3_matched: !!t3,
        policy_lead: polLead,
        policy_lead_display: resolveDisplay(polLead, false),
        policy_lead_matched: !!polLead,
        sr_owner: srOwner,
        sr_owner_display: resolveDisplay(srOwner, false),
        sr_owner_matched: !!srOwner,
        department_id: deptId
      };
      window.setupDraft.policies = window.setupParsedPolicies;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_updated', 'Đã cập nhật dòng thành công'), 'success');
      window.closeSwParsedEditModal();
      renderSetupContent();
    }
  } else if (type === 'account') {
    const aid = document.getElementById('sw-edit-acct-id')?.value?.trim() || '';
    const aname = document.getElementById('sw-edit-acct-name')?.value?.trim();
    if (!aname) {
      showToast(swT('form.required_field', 'Vui lòng điền tên tài khoản'), 'warning');
      return;
    }
    const atype = document.getElementById('sw-edit-acct-type')?.value?.trim() || 'Bank Account';
    const astatus = document.getElementById('sw-edit-acct-status')?.value?.trim() || 'active';
    const acur = document.getElementById('sw-edit-acct-currency')?.value?.trim() || 'VND';
    const anum = document.getElementById('sw-edit-acct-num')?.value?.trim() || '';
    const abank = document.getElementById('sw-edit-acct-bank')?.value?.trim() || '';
    const arate = parseFloat(document.getElementById('sw-edit-acct-rate')?.value) || 1;
    const atrans = document.getElementById('sw-edit-acct-trans')?.value?.trim() || '';
    const afin = document.getElementById('sw-edit-acct-fin')?.value?.trim() || '';
    const acomp = document.getElementById('sw-edit-acct-comp')?.value?.trim() || '';

    if (window.setupParsedAccounts && window.setupParsedAccounts[index]) {
      window.setupParsedAccounts[index] = {
        ...window.setupParsedAccounts[index],
        account_id: aid,
        account_name: aname,
        type: atype,
        account_status: astatus,
        currency: acur,
        account_number: anum,
        bank_name: abank,
        exchange_rate: arate,
        transaction_managed_by: atrans,
        finance_control: afin,
        company_entity: acomp
      };
      window.setupDraft.accounts = window.setupParsedAccounts;
      saveSetupDraftToStorage();
      showToast(swT('sw.row_updated', 'Đã cập nhật dòng thành công'), 'success');
      window.closeSwParsedEditModal();
      renderSetupContent();
    }
  }
};
