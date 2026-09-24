/**
 * TeraX – Setup Wizard (Light Theme)
 * Màu sắc điều chỉnh phù hợp với glassmorphism light theme của app
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedEmployees = [];
window.setupStep2ActiveTab = 'choose';
window.setupStep3ActiveTab = 'excel';
window.setupStep4ActiveTab = 'library';
window.setupStep4Category = 'all';
window.setupStep4Search = '';

// ─── CSS helper injected once ───────────────────────────────
(function injectSetupStyles() {
  if (document.getElementById('setup-wizard-styles')) return;
  const style = document.createElement('style');
  style.id = 'setup-wizard-styles';
  style.textContent = `
    .sw-card { background:rgba(255,255,255,0.85); border:1px solid rgba(255,255,255,0.9); border-radius:16px; padding:24px; backdrop-filter:blur(12px); box-shadow:0 4px 24px rgba(0,0,0,0.06); }
    .sw-input { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; transition:border 0.2s; }
    .sw-input:focus { outline:none; border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,0.1); }
    .sw-select { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; }
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
  `;
  document.head.appendChild(style);
})();

window.loadSetupView = async function () {
  currentModule = 'setup'; currentView = 'setup';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.id === 'nav-setup'));
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = 'Thiết lập ban đầu';
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) { subtitleEl.textContent = 'Khởi tạo không gian làm việc theo 5 bước'; subtitleEl.style.display = 'block'; }
  const actionsEl = document.getElementById('topbar-actions-custom');
  if (actionsEl) actionsEl.innerHTML = '';
  updateGlobalStatusCards('');
  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) tabsBar.style.display = 'none';
  injectSetupStyles();
  await renderSetupContent();
};

function injectSetupStyles() {
  if (document.getElementById('setup-wizard-styles')) return;
  const style = document.createElement('style');
  style.id = 'setup-wizard-styles';
  style.textContent = `
    .sw-card { background:rgba(255,255,255,0.85); border:1px solid rgba(255,255,255,0.9); border-radius:16px; padding:24px; backdrop-filter:blur(12px); box-shadow:0 4px 24px rgba(0,0,0,0.06); }
    .sw-input { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; transition:border 0.2s; }
    .sw-input:focus { outline:none; border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,0.1); }
    .sw-select { width:100%; padding:10px 14px; background:#ffffff; border:1px solid #E5E7EB; border-radius:10px; color:#111827; font-size:13px; font-family:inherit; }
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
  `;
  document.head.appendChild(style);
}

// ── Cache: chỉ fetch API khi cần thiết (lần đầu hoặc sau khi save) ──
window._setupDataLoaded = false;

window.renderSetupContent = async function (forceRefresh) {
  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  // Nếu chưa có data hoặc yêu cầu refresh (sau khi save) thì mới gọi API
  if (!window._setupDataLoaded || forceRefresh) {
    contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#374151;"><div class="spinner" style="margin:0 auto 12px;"></div> Đang tải thông tin thiết lập...</div>';
    try {
      const [statusRes, dataRes] = await Promise.all([apiGet('/system-setup/status'), apiGet('/system-setup/data')]);
      window.setupCompleted = statusRes.setupCompleted;
      window.setupTableCounts = statusRes.tableCounts || {};
      window.setupWizardData = dataRes || {};
      window._setupDataLoaded = true;
    } catch (err) {
      contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;"><span class="material-symbols-rounded" style="font-size:43px;">error</span><div style="font-size:14px;font-weight:600;margin-top:10px;color:#111827;">Lỗi tải dữ liệu</div></div>';
      return;
    }
  }
  const counts = window.setupTableCounts || {};
  const comp = window.setupWizardData.company || {};
  const currentStep = window.setupCurrentStep || 1;
  const stepDone = [counts.my_company>0, counts.department>0, counts.employee>0, counts.policy_and_program>0, counts.account>0];
  const completedCount = stepDone.filter(Boolean).length;
  const pct = Math.round((completedCount/5)*100);
  const stepLabels = ['Thông tin công ty','Phòng ban','Nhân viên','Quy trình','Tài khoản tiền','Bắt đầu sử dụng'];

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
  const sideLabels = ['Thông tin công ty','Phòng ban','Nhân viên','Quy trình','Tài khoản tiền'];
  let stepList = '';
  for (let i=0;i<5;i++) {
    const num=i+1, done=stepDone[i], isAct=num===currentStep;
    const st = done?'Đã hoàn thành':isAct?'Đang thực hiện':'Chưa thiết lập';
    const stColor = done?'#16a34a':isAct?'#ea580c':'#9CA3AF';
    const cirBg = done?'#22c55e':isAct?'#f97316':'#E5E7EB';
    const cirText = done?'<span class="material-symbols-rounded" style="font-size:13px;color:white;">check</span>':'<span style="color:'+(isAct?'white':'#6B7280')+';">'+num+'</span>';
    stepList += '<div onclick="window.setSetupStep('+num+')" class="sw-step-item '+(isAct?'active':'inactive')+'">';
    stepList += '<div style="width:22px;height:22px;border-radius:50%;background:'+cirBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;">'+cirText+'</div>';
    stepList += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#111827;">'+sideLabels[i]+'</div><div style="font-size:10.5px;color:'+stColor+';font-weight:500;">'+st+'</div></div></div>';
  }
  const tips = ['Chọn mẫu có sẵn để tiết kiệm thời gian','Không cần tạo tất cả ngay, bổ sung sau được','Sau khi tạo, chỉnh sửa được bất kỳ lúc nào','Quy trình nên dùng vai trò thay vì chỉ định cụ thể'];
  let tipsHtml = '';
  for (const t of tips) tipsHtml += '<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#6B7280;line-height:1.5;"><span class="material-symbols-rounded" style="font-size:13px;color:#16a34a;flex-shrink:0;margin-top:1px;">check_circle</span><span>'+t+'</span></div>';
  const descText = completedCount<5 ? 'Còn '+(5-completedCount)+' bước nữa là xong!' : 'Tuyệt vời! Sẵn sàng sử dụng.';

  const progressSidebar = '<div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">'
    // Donut card
    + '<div class="sw-sidebar-card">'
    + '<div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:14px;">Tiến độ thiết lập</div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">'
    + '<div style="position:relative;width:68px;height:68px;flex-shrink:0;">'
    + '<svg viewBox="0 0 36 36" style="width:68px;height:68px;transform:rotate(-90deg)">'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" stroke-width="3"/>'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="'+pct+' '+(100-pct)+'" stroke-linecap="round"/>'
    + '</svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#111827;">'+pct+'%</div></div>'
    + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">'+completedCount+'/5 bước hoàn thành</div>'
    + '<div style="font-size:11px;color:#6B7280;margin-top:3px;line-height:1.5;">'+descText+'</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+stepList+'</div>'
    + '</div>'
    // Tips card
    + '<div class="sw-sidebar-card">'
    + '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="material-symbols-rounded" style="font-size:17px;color:#f59e0b;">lightbulb</span><span style="font-size:12px;font-weight:700;color:#111827;">Mẹo hữu ích</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+tipsHtml+'</div>'
    + '</div>'
    // Docs link
    + '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:14px;cursor:pointer;">'
    + '<div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="font-size:18px;color:#1D4ED8;">menu_book</span>'
    + '<div><div style="font-size:12px;font-weight:700;color:#1E40AF;">Tài liệu hướng dẫn</div>'
    + '<div style="font-size:10.5px;color:#3B82F6;margin-top:2px;">Xem hướng dẫn chi tiết ↗</div></div></div>'
    + '</div>'
    + '</div>';

  const supportWidget = '<div class="sw-card" style="margin-top:16px;">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div>'
    + '<div><div style="font-size:13px;font-weight:700;color:#111827;">Cần hỗ trợ?</div><div style="font-size:11px;color:#6B7280;">Đội ngũ TeraX luôn sẵn sàng hỗ trợ bạn</div></div></div>'
    + '<button style="width:100%;padding:9px;border-radius:10px;border:1.5px solid #f97316;background:transparent;color:#f97316;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> Liên hệ hỗ trợ</button>'
    + '</div>';

  const mainBodyHTML = currentStep===6 ? renderStep6HTML(counts, comp) : renderCurrentStepHTML(currentStep, comp, window.setupWizardData.admin||{}, counts);

  contentEl.innerHTML = '<div class="detail-scroll" style="max-width:1280px;margin:0 auto;width:100%;padding:16px 20px 60px;">'
    // Title trong card - luôn đọc được, không chìm background
    + '<div class="sw-card" style="padding:16px 22px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">'
    + '<div><h2 style="font-size:17px;font-weight:800;color:#111827;margin-bottom:2px;">Thiết lập TeraX cho doanh nghiệp của bạn</h2>'
    + '<p style="font-size:12px;color:#6B7280;">Chỉ vài bước đơn giản để bắt đầu. Bạn có thể bỏ qua và bổ sung sau.</p></div>'
    + '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;padding:4px 10px;border-radius:20px;background:#FFF7ED;color:#EA580C;border:1px solid #FED7AA;font-weight:600;">'+completedCount+'/5 bước</span></div>'
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

window.setSetupStep = function(n){window.setupCurrentStep=Math.max(1,Math.min(6,n));renderSetupContent();}; // dùng cache, không gọi API

function renderCurrentStepHTML(step,comp,admin,counts){switch(step){case 1:return renderStep1HTML(comp);case 2:return renderStep2HTML(counts);case 3:return renderStep3HTML(counts);case 4:return renderStep4HTML(counts);case 5:return renderStep5HTML(comp,counts);default:return renderStep1HTML(comp);}}

// ── Shared helpers ─────────────────────────────────────────────
function swStepHeader(icon, num, title, sub) {
  // Đơn giản: chỉ title + subtitle, không có icon thừa hay nút Hướng dẫn
  return '<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
    + '<span style="font-size:10px;font-weight:700;color:#EA580C;background:#FFF7ED;border:1px solid #FED7AA;padding:2px 8px;border-radius:20px;">Bước '+num+'/5</span>'
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
    + '<button class="sw-btn-back" onclick="window.setSetupStep('+back+')"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lại</button>'
    + '<div style="display:flex;gap:10px;align-items:center;">'
    + '<button class="sw-btn-ghost" onclick="window.setSetupStep('+skip+')">Bỏ qua bước này</button>'
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
//  STEP 1
// ─────────────────────────────────────────────────────────────
// Cache for CMS lookup data
window._setupLookupCache = {};
async function fetchLookup(key, apiPath) {
  if (window._setupLookupCache[key]) return window._setupLookupCache[key];
  try { const res = await apiGet(apiPath); window._setupLookupCache[key] = res.data || []; }
  catch(e) { window._setupLookupCache[key] = []; }
  return window._setupLookupCache[key];
}

function renderStep1HTML(comp) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Ho_Chi_Minh';
  const _IC=(comp.base_currency||'VND').toUpperCase(),_IC2=comp.country||'Vietnam';
  setTimeout(async()=>{
    const [cts,cus]=await Promise.all([fetchLookup('countries','/system-setup/lookups/countries'),fetchLookup('currencies','/system-setup/lookups/currencies')]);
    const sC=document.getElementById('step1_country'),sCur=document.getElementById('step1_currency');
    if(sC&&cts.length)sC.innerHTML=cts.map(c=>'<option value="'+c.name+'" '+(c.name.toLowerCase()===_IC2.toLowerCase()||c.code===_IC2?'selected':'')+'>'+c.display_name+'</option>').join('');
    if(sCur&&cus.length)sCur.innerHTML=cus.map(c=>'<option value="'+c.code+'" '+(c.code===_IC?'selected':'')+'>'+c.code+'</option>').join('');
  },0);
  return '<div class="sw-card">'
    + swStepHeader('apartment',1,'Thông tin công ty','Tạo cơ sở dữ liệu nền tảng cho doanh nghiệp. Có thể chỉnh sửa sau.')
    + '<form id="form-step1" onsubmit="event.preventDefault();saveStep1AndAdvance();">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel('Tên đầy đủ công ty / doanh nghiệp',true)+swInput('step1_fullname','VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ TERAX',escapeHTML(comp.company_fullname||''))+'</div>'
    + '<div class="form-group">'+swLabel('Tên viết tắt / Brand Name',true)+swInput('step1_shortname','VD: TERAX',escapeHTML(comp.company_shortname||''))+'</div>'
    + '<div class="form-group">'+swLabel('Mã số thuế',false)+swInput('step1_tax_code','VD: 0101234567',escapeHTML(comp.tax_code||''))+'</div>'
    + '<div class="form-group">'+swLabel('Quốc gia',true)+'<select id="step1_country" class="sw-select"><option>Loading...</option></select></div>'
    + '<div class="form-group">'+swLabel('Đơn vị tiền tệ chính',true)+'<select id="step1_currency" class="sw-select"><option>Loading...</option></select></div>'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel('Địa chỉ trụ sở chính',false)+swInput('step1_address','VD: Tầng 5, Tòa nhà Landmark, Hà Nội',escapeHTML(comp.address||''))+'</div>'
    + '<div class="form-group">'+swLabel('Website',false)+swInput('step1_website','https://terax.ai',escapeHTML(comp.website||''))+'</div>'
    + '<div class="form-group">'+swLabel('Múi giờ hệ thống',false)+'<input type="text" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;cursor:default;" value="'+tz+'"></div>'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel('Logo thương hiệu công ty',false)
    + '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;">'
    + '<div id="step1_logo_preview" style="width:48px;height:48px;border-radius:8px;background:#FFFFFF;border:1px dashed #D1D5DB;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">'
    + (comp.logo ? '<img src="'+(comp.logo.startsWith('data:')?comp.logo:'data:image/png;base64,'+comp.logo)+'" style="width:100%;height:100%;object-fit:contain;">' : '<span class="material-symbols-rounded" style="color:#9CA3AF;font-size:24px;">image</span>')
    + '</div>'
    + '<div style="flex:1;">'
    + '<input type="file" id="step1_logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="window.handleStep1Logo(event)" style="font-size:12px;color:#4B5563;">'
    + '<div style="font-size:11px;color:#9CA3AF;margin-top:3px;">Khuyến nghị ảnh định dạng PNG nền trong suốt, dung lượng tối đa 1MB.</div>'
    + '</div></div></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(2)">Bỏ qua bước này</button>'
    + '<button type="submit" class="sw-btn-primary"><span>Lưu và tiếp tục</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    + '</div></form></div>';
}

window.step1LogoBase64 = null;
window.handleStep1Logo = function(e){
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 1024 * 1024){ showToast('Kích thước ảnh quá lớn! Tối đa 1MB','warning'); e.target.value=''; return; }
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
  if(!fn||!sn){showToast('Vui lòng điền tên đầy đủ và tên viết tắt','warning');return;}
  try{
    showToast('Đang lưu thông tin công ty...','info');
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
    if(res.success){showToast('Đã lưu thông tin công ty!','success');window.setupCurrentStep=2;await renderSetupContent(true);}
    else showToast(res.error||'Lưu thất bại','error');
  }catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 2: PHÒNG BAN
// ─────────────────────────────────────────────────────────────
const DEPT_ICONS={BGD:{icon:'workspace_premium',color:'#D97706',bg:'#FEF3C7'},HCNS:{icon:'supervised_user_circle',color:'#2563EB',bg:'#EFF6FF'},TCKT:{icon:'account_balance',color:'#059669',bg:'#ECFDF5'},KD:{icon:'bar_chart',color:'#EA580C',bg:'#FFF7ED'},KT:{icon:'construction',color:'#7C3AED',bg:'#F5F3FF'},IT:{icon:'laptop',color:'#0284C7',bg:'#F0F9FF'},MH:{icon:'shopping_cart',color:'#DB2777',bg:'#FDF2F8'},CSKH:{icon:'headset_mic',color:'#0D9488',bg:'#F0FDFA'},PC:{icon:'gavel',color:'#9333EA',bg:'#FAF5FF'}};
const PRESET_DEPARTMENTS=[{code:'BGD',name:'Ban Giám đốc',type:'Operation',desc:'Điều hành và quản trị doanh nghiệp',checked:true},{code:'HCNS',name:'Hành chính – Nhân sự',type:'Operation',desc:'Quản lý nhân sự, hành chính, pháp chế',checked:true},{code:'TCKT',name:'Tài chính – Kế toán',type:'Finance',desc:'Tài chính, kế toán, thuế',checked:true},{code:'KD',name:'Kinh doanh',type:'Sale and MKT',desc:'Phát triển thị trường, chăm sóc khách hàng',checked:true},{code:'KT',name:'Kỹ thuật',type:'Technical',desc:'Triển khai dự án, kỹ thuật, vận hành',checked:true},{code:'IT',name:'CNTT',type:'Technical',desc:'Hạ tầng, hệ thống, hỗ trợ IT',checked:false},{code:'MH',name:'Mua hàng',type:'Operation',desc:'Mua sắm, nhà cung cấp',checked:false},{code:'CSKH',name:'Chăm sóc khách hàng',type:'Sale and MKT',desc:'Hỗ trợ khách hàng, dịch vụ',checked:false},{code:'PC',name:'Pháp chế',type:'Operation',desc:'Pháp lý, tuân thủ',checked:false}];
window.switchStep2Tab=function(t){window.setupStep2ActiveTab=t;renderSetupContent();};
function renderStep2HTML(counts){
  const tab=window.setupStep2ActiveTab;
  let tc='';
  if(tab==='choose'){
    let cards='';
    for(const d of PRESET_DEPARTMENTS){const m=DEPT_ICONS[d.code]||{icon:'business',color:'#EA580C',bg:'#FFF7ED'};
      cards+='<label class="sw-preset-card"><input type="checkbox" name="preset_dept" value="'+d.code+'" '+(d.checked?'checked':'')+' style="margin-top:2px;accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+d.name+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+d.desc+'</div></div></label>';}
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Chọn các phòng ban phù hợp với doanh nghiệp. Có thể chỉnh sửa sau.</p>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">'+cards+'</div>'
      +'<button onclick="showCustomDeptForm()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px dashed #D1D5DB;background:#F9FAFB;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> Thêm phòng ban tùy chỉnh</button>'
      +'<div id="custom-dept-form" style="display:none;margin-top:12px;padding:16px;border-radius:12px;border:1px solid #E5E7EB;background:#F9FAFB;">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;align-items:end;">'
      +'<div>'+swLabel('Mã phòng ban',false)+swInput('custom_dept_code','VD: MKT','')+'</div>'
      +'<div>'+swLabel('Tên phòng ban',false)+swInput('custom_dept_name','VD: Marketing','')+'</div>'
      +'<div><button onclick="addCustomDeptToList()" class="sw-btn-primary" style="width:100%;justify-content:center;">+ Thêm vào danh sách</button></div>'
      +'</div></div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">Kéo &amp; Thả file Excel vào đây</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'department\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tải mẫu (.xlsx)</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chọn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'department\')"></label></div></div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:110px 1fr 150px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qdept-code" placeholder="Mã PB"><input type="text" class="sw-input qdept-name" placeholder="Tên phòng ban"><select class="sw-select qdept-type"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Nhập trực tiếp từng phòng ban.</p><div id="quick-dept-rows">'+r3+'</div><button onclick="addQuickDeptRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> Thêm dòng</button></div>';
  } else {
    tc='<div><div style="background:#F9FAFB;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="padding:10px 16px;background:#F3F4F6;font-size:12px;font-weight:700;color:#374151;">Hiện có: <strong style="color:#16a34a;">'+(counts.department||0)+'</strong> phòng ban trong hệ thống</div>'+(counts.department>0?'<div style="padding:16px;font-size:12px;color:#6B7280;">Đã có phòng ban. Có thể thêm từ tab Chọn mẫu.</div>':'<div style="padding:20px;text-align:center;font-size:12px;color:#9CA3AF;">Chưa có phòng ban. Hãy chọn từ tab Chọn mẫu.</div>')+'</div></div>';
  }
  return '<div class="sw-card">'+swStepHeader('account_tree',2,'Thiết lập phòng ban','Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.')+swTabBar([{key:'choose',label:'Chọn mẫu'},{key:'excel',label:'Nhập từ Excel'},{key:'quick',label:'Nhập nhanh'},{key:'preview',label:'Xem trước'}],tab,'window.switchStep2Tab')+tc+swBottomNav(1,3,'Tạo các phòng ban đã chọn','saveStep2AndAdvance()')+'</div>';
}
window.showCustomDeptForm=function(){const el=document.getElementById('custom-dept-form');if(el)el.style.display=el.style.display==='none'?'block':'none';};
window.addQuickDeptRow=function(){const c=document.getElementById('quick-dept-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:110px 1fr 150px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="sw-input qdept-code" placeholder="Mã PB"><input type="text" class="sw-input qdept-name" placeholder="Tên phòng ban"><select class="sw-select qdept-type"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.addCustomDeptToList=function(){const code=document.getElementById('custom_dept_code')?.value?.trim(),name=document.getElementById('custom_dept_name')?.value?.trim();if(!code||!name){showToast('Vui lòng điền đủ Mã và Tên phòng ban','warning');return;}showToast('Đã thêm phòng ban "'+name+'" ('+code+') vào danh sách','info');};
window.saveStep2AndAdvance=async function(){
  const tab=window.setupStep2ActiveTab;
  if(tab==='quick'){const codes=document.querySelectorAll('.qdept-code'),names=document.querySelectorAll('.qdept-name'),types=document.querySelectorAll('.qdept-type'),payload=[];codes.forEach((c,i)=>{const code=c.value.trim(),name=names[i]?.value?.trim(),type=types[i]?.value||'Operation';if(code&&name)payload.push({department_code:code,department_name:name,type});});if(!payload.length){window.setSetupStep(3);return;}try{const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('Đã tạo '+res.count+' phòng ban!','success');window.setupCurrentStep=3;await renderSetupContent(true);}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}return;}
  const cbs=document.querySelectorAll('input[name="preset_dept"]:checked'),sels=Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(3);return;}
  const payload=PRESET_DEPARTMENTS.filter(d=>sels.includes(d.code)).map(d=>({department_code:d.code,department_name:d.name,type:d.type}));
  try{showToast('Đang tạo '+payload.length+' phòng ban...','info');const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('Đã tạo '+res.count+' phòng ban!','success');window.setupCurrentStep=3;await renderSetupContent(true);}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ─────────────────────────────────────────────────────────────
//  STEP 3: NHÂN VIÊN
// ─────────────────────────────────────────────────────────────
window.switchStep3Tab=function(t){window.setupStep3ActiveTab=t;renderSetupContent();};
function renderStep3HTML(counts){
  const tab=window.setupStep3ActiveTab,parsed=window.setupParsedEmployees||[];
  const modes=[{key:'excel',icon:'table_view',color:'#059669',bg:'#ECFDF5',title:'Nhập từ Excel',desc:'Tải lên file Excel. Hệ thống tự nhận diện cột.'},{key:'quick',icon:'bolt',color:'#EA580C',bg:'#FFF7ED',title:'Thêm nhanh',desc:'Nhập trực tiếp trên giao diện.'},{key:'sample',icon:'description',color:'#7C3AED',bg:'#F5F3FF',title:'Dùng dữ liệu mẫu',desc:'Tải file mẫu chuẩn TeraX.'}];
  let modeCards='';
  for(const m of modes)modeCards+='<label onclick="window.switchStep3Tab(\''+m.key+'\')" class="sw-mode-card '+(tab===m.key?'active':'')+'""><div style="width:38px;height:38px;border-radius:10px;background:'+m.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:20px;color:'+m.color+';">'+m.icon+'</span></div><div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+m.title+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+m.desc+'</div></div></label>';
  let tc='';
  if(tab==='excel'){
    let prev='';
    if(parsed.length>0){
      const vc=parsed.filter(e=>e.full_name&&e.email).length,wc=parsed.filter(e=>!e.department_code).length,ec=parsed.filter(e=>!e.full_name||!e.email).length;
      let rows='';for(let i=0;i<Math.min(parsed.length,10);i++){const e=parsed[i],v=e.full_name&&e.email;rows+='<tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:7px 12px;color:#9CA3AF;font-size:12px;">'+(i+1)+'</td><td style="padding:7px 12px;font-weight:600;color:#111827;font-size:12px;">'+escapeHTML(e.full_name||'–')+'</td><td style="padding:7px 12px;color:#2563EB;font-size:12px;">'+escapeHTML(e.email||'–')+'</td><td style="padding:7px 12px;color:#374151;font-size:12px;">'+escapeHTML(e.department_code||'–')+'</td><td style="padding:7px 12px;color:#374151;font-size:12px;">'+escapeHTML(e.position||'Nhân viên')+'</td><td style="padding:7px 12px;">'+(v?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">Hợp lệ</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">Lỗi</span>')+'</td></tr>';}
      prev='<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:14px;"><span class="material-symbols-rounded" style="font-size:26px;color:#059669;">grid_on</span><div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#111827;">File nhân viên</div><div style="font-size:11px;color:#6B7280;">'+parsed.length+' dòng dữ liệu</div></div><span style="font-size:11px;color:#059669;font-weight:600;display:flex;align-items:center;gap:4px;"><span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Tải lên thành công</span><button onclick="window.setupParsedEmployees=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button></div>'
      +'<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px;">Ánh xạ cột dữ liệu</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px;">'
      +['Họ và tên *','Email *','Phòng ban','Chức danh','Quản lý'].map((lbl,fi)=>'<div>'+swLabel(lbl,false)+'<select class="sw-select" style="font-size:11.5px;padding:6px 10px;">'+['A – Họ và tên','B – Email','C – Phòng ban','D – Chức danh','E – Quản lý'].map((o,oi)=>'<option '+(oi===fi?'selected':'')+'>'+o+'</option>').join('')+'</select></div>').join('')
      +'</div></div>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:#111827;">Xem trước (10 dòng đầu)</span><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#DCFCE7;color:#16a34a;">'+vc+' hợp lệ</span>'+(wc>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#FEF9C3;color:#CA8A04;">'+wc+' cảnh báo</span>':'')+(ec>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#FEE2E2;color:#EF4444;">'+ec+' lỗi</span>':'')+'</div>'
      +'<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="overflow-x:auto;max-height:220px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">#</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Họ và tên</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Email</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Phòng ban</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Chức danh</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Trạng thái</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }
    tc='<div><div class="sw-upload-zone" style="margin-bottom:16px;"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">Kéo &amp; Thả file Excel vào đây</div><div style="font-size:12px;color:#6B7280;margin-bottom:14px;">(.xlsx, .xls, .csv)</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="downloadEmployeeTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">download</span> Tải file mẫu 5 cột</button><label style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">folder_open</span> Chọn file Excel<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleEmployeeExcelUpload(event)"></label></div></div>'+prev+'</div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:1fr 1fr 130px 130px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qemp-name" placeholder="Họ và tên *"><input type="email" class="sw-input qemp-email" placeholder="Email *"><input type="text" class="sw-input qemp-dept" placeholder="Mã phòng ban"><input type="text" class="sw-input qemp-pos" placeholder="Chức danh"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Nhập trực tiếp từng nhân viên.</p><div id="quick-emp-rows">'+r3+'</div><button onclick="addQuickEmpRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">person_add</span> Thêm nhân viên</button></div>';
  } else {
    tc='<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:14px;padding:24px;text-align:center;"><div style="width:56px;height:56px;border-radius:14px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><span class="material-symbols-rounded" style="font-size:28px;color:#7C3AED;">description</span></div><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">File mẫu nhân viên – 5 cột chuẩn TeraX</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;line-height:1.6;">Gồm: Họ và tên · Email · Phòng ban · Chức danh · Quản lý trực tiếp</div><button onclick="downloadEmployeeTemplate()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">download</span>Tải file mẫu (.xlsx)</button></div>';
  }
  const btnLabel=parsed.length>0?'Nhập '+parsed.length+' nhân viên':'Tiếp tục bước tiếp theo';
  return '<div class="sw-card">'+swStepHeader('group',3,'Thiết lập nhân viên','Nhập danh sách nhân sự. Có thể nhập từ Excel, thêm nhanh hoặc dùng dữ liệu mẫu.')+'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">'+modeCards+'</div>'+tc+swBottomNav(2,4,btnLabel,'saveStep3AndAdvance()')+'</div>';
}
window.addQuickEmpRow=function(){const c=document.getElementById('quick-emp-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:1fr 1fr 130px 130px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="sw-input qemp-name" placeholder="Họ và tên *"><input type="email" class="sw-input qemp-email" placeholder="Email *"><input type="text" class="sw-input qemp-dept" placeholder="Mã phòng ban"><input type="text" class="sw-input qemp-pos" placeholder="Chức danh"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.downloadEmployeeTemplate=function(){const h=['Họ và tên *','Email *','Phòng ban (Mã hoặc Tên)','Chức vụ','Email Quản lý trực tiếp'],data=[{'Họ và tên *':'Nguyễn Văn Quản Lý','Email *':'manager@company.com','Phòng ban (Mã hoặc Tên)':'KD','Chức vụ':'Trưởng phòng','Email Quản lý trực tiếp':''},{'Họ và tên *':'Trần Thị Nhân Viên','Email *':'staff@company.com','Phòng ban (Mã hoặc Tên)':'KD','Chức vụ':'Chuyên viên','Email Quản lý trực tiếp':'manager@company.com'}];const ws=XLSX.utils.json_to_sheet(data,{header:h});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'NhanVien');XLSX.writeFile(wb,'Mau_Nhan_Vien_5_Cot.xlsx');showToast('Đã tải xuống file mẫu','success');};
window.handleEmployeeExcelUpload=function(event){const file=event.target.files[0];if(!file)return;const r=new FileReader();r.onload=(e)=>{try{const data=new Uint8Array(e.target.result),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows||!rows.length){showToast('File không có dòng dữ liệu','warning');return;}const mapped=[];for(const row of rows){const k=Object.keys(row),nk=k.find(x=>/tên|name|họ/i.test(x)),ek=k.find(x=>/email|thư/i.test(x)),dk=k.find(x=>/phòng|dept|ban/i.test(x)),pk=k.find(x=>/chức|vị trí|title|position/i.test(x)),mk=k.find(x=>/quản lý|manager/i.test(x)),fn=nk?String(row[nk]).trim():'',em=ek?String(row[ek]).trim():'';if(fn&&em)mapped.push({full_name:fn,email:em,department_code:dk?String(row[dk]).trim():'',position:pk?String(row[pk]).trim():'Nhân viên',direct_manager:mk?String(row[mk]).trim():''});}if(!mapped.length){showToast('Không tìm thấy dòng hợp lệ','warning');return;}window.setupParsedEmployees=mapped;showToast('Đã nhận diện '+mapped.length+' nhân viên','success');renderSetupContent();}catch(err){showToast('Lỗi đọc file: '+err.message,'error');}};r.readAsArrayBuffer(file);};
window.saveStep3AndAdvance=async function(){const tab=window.setupStep3ActiveTab;if(tab==='quick'){const ns=document.querySelectorAll('.qemp-name'),es=document.querySelectorAll('.qemp-email'),ds=document.querySelectorAll('.qemp-dept'),ps=document.querySelectorAll('.qemp-pos'),p=[];ns.forEach((n,i)=>{const fn=n.value.trim(),em=es[i]?.value?.trim();if(fn&&em)p.push({full_name:fn,email:em,department_code:ds[i]?.value?.trim()||'',position:ps[i]?.value?.trim()||'Nhân viên',direct_manager:''});});if(!p.length){window.setSetupStep(4);return;}window.setupParsedEmployees=p;}const employees=window.setupParsedEmployees||[];if(!employees.length){window.setSetupStep(4);return;}try{showToast('Đang nhập '+employees.length+' nhân viên...','info');const res=await apiPost('/system-setup/import-employees',{employees});if(res.success){showToast('Đã nhập '+res.count+' nhân viên!','success');window.setupParsedEmployees=[];window.setupCurrentStep=4;await renderSetupContent(true);}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}};

// ─────────────────────────────────────────────────────────────
//  STEP 4: QUY TRÌNH
// ─────────────────────────────────────────────────────────────
const PRESET_POLICIES_FULL=[
  {id:'P-LEAVE',name:'Xin nghỉ phép',type:'Operation',cat:'Nhan su',nameVi:'Xin nghỉ phép',descVi:'Quy trình nhân viên xin nghỉ phép (ngày, dài ngày)',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:1,checked:true},
  {id:'P-RECRUIT',name:'Tuyen dung',type:'Operation',cat:'Nhan su',nameVi:'Tuyển dụng',descVi:'Đề xuất và phê duyệt tuyển dụng nhân sự',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:3,checked:true},
  {id:'P-ONBOARD',name:'Onboarding',type:'Operation',cat:'Nhan su',nameVi:'Onboarding',descVi:'Quy trình tiếp nhận nhân viên mới',tags:['Mới'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-OFFBOARD',name:'Offboarding',type:'Operation',cat:'Nhan su',nameVi:'Offboarding',descVi:'Nghỉ việc và bàn giao công việc',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false},
  {id:'P-SALARY',name:'Dieu chinh luong',type:'Finance',cat:'Nhan su',nameVi:'Điều chỉnh lương',descVi:'Đề xuất điều chỉnh lương, thưởng',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-STATION',name:'Mua VPP',type:'Operation',cat:'Hanh chinh',nameVi:'Mua văn phòng phẩm',descVi:'Đề xuất mua sắm văn phòng phẩm',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:false},
  {id:'P-ASSET',name:'Cap phat TS',type:'Operation',cat:'Hanh chinh',nameVi:'Cấp phát tài sản',descVi:'Yêu cầu cấp phát thiết bị, tài sản công ty',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-VEHICLE',name:'Dat xe',type:'Operation',cat:'Hanh chinh',nameVi:'Đặt xe / Di chuyển',descVi:'Đặt xe công tác, di chuyển nội bộ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-ADVANCE',name:'Tam ung',type:'Finance',cat:'Tai chinh',nameVi:'Đề nghị tạm ứng',descVi:'Tạm ứng công tác phí và hoàn ứng chứng từ',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:true},
  {id:'P-PAYMENT',name:'Thanh toan',type:'Finance',cat:'Tai chinh',nameVi:'Thanh toán chi phí',descVi:'Phê duyệt thanh toán hóa đơn, chi phí phát sinh',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-BUDGET',name:'Ngan sach',type:'Finance',cat:'Tai chinh',nameVi:'Đề xuất ngân sách',descVi:'Lập và phê duyệt ngân sách dự án, phòng ban',tags:[],elements:'EXPENSE',sla:5,checked:false},
  {id:'P-CONTRACT',name:'Hop dong',type:'Finance',cat:'Tai chinh',nameVi:'Ký kết hợp đồng',descVi:'Phê duyệt và ký kết hợp đồng kinh tế',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-IT-ACC',name:'Tai khoan IT',type:'Technical',cat:'CNTT',nameVi:'Cấp tài khoản IT',descVi:'Yêu cầu cấp tài khoản phần mềm, hệ thống',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-IT-ISSUE',name:'Bao loi',type:'Technical',cat:'CNTT',nameVi:'Báo lỗi hệ thống',descVi:'Báo cáo sự cố kỹ thuật và xử lý',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-PURCHASE',name:'Mua hang',type:'Operation',cat:'Mua hang',nameVi:'Đề nghị mua hàng',descVi:'Đề xuất và phê duyệt mua sắm vật tư, thiết bị',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-DEAL',name:'Bao gia',type:'Sale and MKT',cat:'Kinh doanh',nameVi:'Phê duyệt báo giá',descVi:'Phê duyệt báo giá, đề xuất thương mại',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-WFH',name:'WFH',type:'Operation',cat:'Khac',nameVi:'Làm việc từ xa (WFH)',descVi:'Xin phép làm việc tại nhà / từ xa',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-OT',name:'Tang ca',type:'Operation',cat:'Khac',nameVi:'Tăng ca / Làm thêm giờ',descVi:'Đăng ký và phê duyệt làm thêm giờ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-BUSINESS',name:'Cong tac',type:'Operation',cat:'Khac',nameVi:'Công tác / Xuất ngoại',descVi:'Phê duyệt công tác, đi nước ngoài',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false}
];
const STEP4_CATS=[{key:'all',label:'Tất cả',count:19},{key:'Nhan su',label:'Nhân sự',count:5},{key:'Hanh chinh',label:'Hành chính',count:3},{key:'Tai chinh',label:'Tài chính',count:4},{key:'CNTT',label:'CNTT',count:2},{key:'Mua hang',label:'Mua hàng',count:1},{key:'Kinh doanh',label:'Kinh doanh',count:1},{key:'Khac',label:'Khác',count:3}];
const P_CAT_ICONS={'Nhan su':'group','Hanh chinh':'admin_panel_settings','Tai chinh':'account_balance','CNTT':'computer','Mua hang':'shopping_cart','Kinh doanh':'trending_up','Khac':'more_horiz','all':'apps'};
const P_CAT_COLORS={'Nhan su':'#2563EB','Hanh chinh':'#EA580C','Tai chinh':'#059669','CNTT':'#0284C7','Mua hang':'#DB2777','Kinh doanh':'#D97706','Khac':'#7C3AED','all':'#374151'};
const P_CAT_BGS={'Nhan su':'#EFF6FF','Hanh chinh':'#FFF7ED','Tai chinh':'#ECFDF5','CNTT':'#F0F9FF','Mua hang':'#FDF2F8','Kinh doanh':'#FFFBEB','Khac':'#F5F3FF','all':'#F3F4F6'};
const P_TAG_STYLES={'Phổ biến':{bg:'#FFF7ED',color:'#EA580C',border:'#FED7AA'},'Mới':{bg:'#ECFDF5',color:'#059669',border:'#A7F3D0'}};
window.switchStep4Tab=function(t){window.setupStep4ActiveTab=t;renderSetupContent();};
window.setStep4Category=function(c){window.setupStep4Category=c;renderSetupContent();};
window.setStep4Search=function(v){window.setupStep4Search=v;renderSetupContent();};
function renderStep4HTML(counts){
  const tab=window.setupStep4ActiveTab;
  let tc='';
  if(tab==='library'){
    const cat=window.setupStep4Category||'all',search=(window.setupStep4Search||'').toLowerCase();
    let filtered=PRESET_POLICIES_FULL;
    if(cat!=='all')filtered=filtered.filter(p=>p.cat===cat);
    if(search)filtered=filtered.filter(p=>p.nameVi.toLowerCase().includes(search)||p.descVi.toLowerCase().includes(search));
    let catBtns='';
    for(const c of STEP4_CATS){const isAct=cat===c.key;catBtns+='<button onclick="window.setStep4Category(\''+c.key+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:9px;border:none;cursor:pointer;text-align:left;transition:var(--transition);width:100%;background:'+(isAct?P_CAT_BGS[c.key]||'#FFF7ED':'transparent')+';"><div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:'+(isAct?'700':'500')+';color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#374151')+';"><span class="material-symbols-rounded" style="font-size:15px;color:'+(isAct?P_CAT_COLORS[c.key]||'#EA580C':'#9CA3AF')+'">'+(P_CAT_ICONS[c.key]||'folder')+'</span>'+c.label+'</div><span style="font-size:11px;padding:1px 6px;border-radius:10px;background:#F3F4F6;color:#6B7280;font-weight:600;">'+c.count+'</span></button>';}
    let pCards='';
    for(const p of filtered){let tgs='';for(const tag of p.tags){const s=P_TAG_STYLES[tag]||{bg:'#F3F4F6',color:'#374151',border:'#E5E7EB'};tgs+='<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+s.bg+';color:'+s.color+';border:1px solid '+s.border+';font-weight:600;">'+tag+'</span>';}const catColor=P_CAT_COLORS[p.cat]||'#EA580C',catBg=P_CAT_BGS[p.cat]||'#FFF7ED';pCards+='<label class="sw-policy-card '+(p.checked?'checked':'')+'" onclick="this.querySelector(\'input\').click();this.classList.toggle(\'checked\')"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:9px;background:'+catBg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:17px;color:'+catColor+'">'+(P_CAT_ICONS[p.cat]||'policy')+'</span></div><input type="checkbox" name="preset_policy" value="'+p.id+'" '+(p.checked?'checked':'')+' style="accent-color:#f97316;width:16px;height:16px;flex-shrink:0;" onclick="event.stopPropagation()"></div><div style="font-size:12.5px;font-weight:700;color:#111827;margin-bottom:4px;">'+p.nameVi+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;flex:1;margin-bottom:8px;">'+p.descVi+'</div><div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;gap:4px;">'+tgs+'</div><span style="font-size:10.5px;color:#9CA3AF;">SLA: '+p.sla+'d</span></div></label>';}
    if(!pCards)pCards='<div style="grid-column:span 3;text-align:center;padding:30px;color:#9CA3AF;font-size:13px;">Không tìm thấy quy trình phù hợp</div>';
    tc='<div style="display:flex;gap:16px;">'
      +'<div style="width:155px;flex-shrink:0;"><div style="font-size:10px;font-weight:700;color:#9CA3AF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Danh mục</div><div style="display:flex;flex-direction:column;gap:2px;">'+catBtns+'</div></div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="position:relative;margin-bottom:14px;"><span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:#9CA3AF;">search</span><input type="text" value="'+escapeHTML(window.setupStep4Search||'')+'" oninput="window.setStep4Search(this.value)" placeholder="Tìm kiếm quy trình..." class="sw-input" style="padding-left:36px;"></div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">'+pCards+'</div>'
      +'</div></div>';
  } else if(tab==='create'){
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:16px;">Tự định nghĩa quy trình theo nhu cầu riêng của doanh nghiệp.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="grid-column:span 2;">'+swLabel('Tên quy trình',true)+swInput('new_policy_name','VD: Quy trình phê duyệt hợp đồng dịch vụ','')+'</div><div>'+swLabel('Loại',false)+'<select id="new_policy_type" class="sw-select"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select></div><div>'+swLabel('SLA (ngày)',false)+'<input id="new_policy_sla" type="number" class="sw-input" min="1" value="3"></div><div style="grid-column:span 2;">'+swLabel('Mô tả',false)+'<textarea id="new_policy_desc" class="sw-input" rows="3" style="resize:vertical;" placeholder="Mô tả ngắn gọn về mục đích quy trình..."></textarea></div></div><div class="sw-info-box" style="margin-top:12px;"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;">info</span> Phê duyệt mặc định: <strong>Quản lý trực tiếp (Tier 1)</strong> — có thể tùy chỉnh sau khi tạo.</div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">Kéo &amp; Thả file Excel vào đây</div><div style="display:flex;gap:12px;justify-content:center;margin-top:14px;"><button onclick="downloadSetupTemplate(\'policy\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tải mẫu</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chọn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'policy\')"></label></div></div>';
  } else {
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Hiện có <strong style="color:#16a34a;">'+(counts.policy_and_program||0)+'</strong> quy trình đã thiết lập.</p>'+(counts.policy_and_program>0?'<div style="padding:20px;text-align:center;background:#ECFDF5;border-radius:12px;border:1px solid #A7F3D0;"><span class="material-symbols-rounded" style="font-size:40px;color:#059669;">task_alt</span><div style="margin-top:8px;font-size:13px;color:#111827;font-weight:600;">Đã có '+counts.policy_and_program+' quy trình</div></div>':'<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px;">Chưa có quy trình nào. Hãy chọn từ thư viện mẫu.</div>')+'</div>';
  }
  return '<div class="sw-card">'+swStepHeader('policy',4,'Thiết lập quy trình','Chọn quy trình mẫu phù hợp hoặc tự tạo theo nhu cầu doanh nghiệp.')+swTabBar([{key:'library',label:'Chọn từ thư viện mẫu'},{key:'create',label:'Tạo quy trình mới'},{key:'excel',label:'Nhập từ Excel'},{key:'manage',label:'Quản lý'}],tab,'window.switchStep4Tab')+tc+swBottomNav(3,5,'Tạo các quy trình đã chọn','saveStep4AndAdvance()')+'</div>';
}
window.saveStep4AndAdvance=async function(){const tab=window.setupStep4ActiveTab;if(tab==='create'){const name=document.getElementById('new_policy_name')?.value?.trim();if(!name){showToast('Vui lòng nhập tên quy trình','warning');return;}const p=[{policy_name:name,policy_type:document.getElementById('new_policy_type')?.value||'Operation',description:document.getElementById('new_policy_desc')?.value?.trim()||name,elements:'ASSIGN_TASK',sla:parseInt(document.getElementById('new_policy_sla')?.value)||3}];try{const res=await apiPost('/system-setup/presets/policies',{policies:p});if(res.success){showToast('Đã tạo quy trình "'+name+'"!','success');window.setupCurrentStep=5;await renderSetupContent(true);}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}return;}const cbs=document.querySelectorAll('input[name="preset_policy"]:checked'),sels=Array.from(cbs).map(c=>c.value);if(!sels.length){window.setSetupStep(5);return;}const payload=PRESET_POLICIES_FULL.filter(p=>sels.includes(p.id)).map(p=>({policy_name:p.name,policy_type:p.type,description:p.descVi||p.name,elements:p.elements,sla:p.sla}));try{showToast('Đang khởi tạo '+payload.length+' quy trình...','info');const res=await apiPost('/system-setup/presets/policies',{policies:payload});if(res.success){showToast('Đã tạo '+res.count+' quy trình!','success');window.setupCurrentStep=5;await renderSetupContent(true);}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}};

// ─────────────────────────────────────────────────────────────
//  STEP 5: TÀI KHOẢN TIỀN
// ─────────────────────────────────────────────────────────────
function renderStep5HTML(comp,counts){
  const cur=comp.base_currency||'VND';
  const banks=['Vietcombank','Vietinbank','BIDV','Techcombank','MB Bank','ACB','Agribank','TPBank','VPBank','OCB','SHB','HDBank','MSB','VIB','SeABank'];
  let bopts='<option value="">-- Chọn ngân hàng --</option>';for(const b of banks)bopts+='<option value="'+b+'">'+b+'</option>';
  const acctInfo=counts.account>0?'<div style="padding:12px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:16px;font-size:12px;color:#374151;"><span class="material-symbols-rounded" style="font-size:14px;color:#059669;vertical-align:middle;">check_circle</span> Hiện có <strong style="color:#059669;">'+counts.account+'</strong> tài khoản đã thiết lập.</div>':'';
  return '<div class="sw-card">'
    +swStepHeader('account_balance',5,'Tài khoản ngân hàng','Thiết lập tài khoản thanh toán để quản lý dòng tiền thu chi.')
    +'<form id="form-step5" onsubmit="event.preventDefault();saveStep5AndAdvance();">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">'
    +'<div style="grid-column:span 2;">'+swLabel('Tên tài khoản giao dịch',false)+swInput('step5_account_name','VD: Tài khoản chính Vietcombank','')+'</div>'
    +'<div>'+swLabel('Ngân hàng',false)+'<select id="step5_bank_name" class="sw-select">'+bopts+'</select></div>'
    +'<div>'+swLabel('Số tài khoản',false)+swInput('step5_account_number','VD: 0011001234567','')+'</div>'
    +'<div>'+swLabel('Loại tiền tệ',false)+'<input type="text" id="step5_currency" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;" value="'+cur+'"></div>'
    +'</div>'+acctInfo
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    +'<button type="button" class="sw-btn-back" onclick="window.setSetupStep(4)"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lại</button>'
    +'<div style="display:flex;gap:10px;align-items:center;"><button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(6)">Bỏ qua bước này</button><button type="submit" class="sw-btn-primary"><span>Lưu và xem tổng kết</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button></div>'
    +'</div></form></div>';
}

// ─────────────────────────────────────────────────────────────
//  STEP 6: SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────
function renderStep6HTML(counts,comp){
  const name=escapeHTML(comp.company_fullname||comp.company_shortname||'TeraX');
  const summary=[{label:'Thông tin công ty',val:counts.my_company||0,unit:'công ty',color:'#EA580C',bg:'#FFF7ED',done:counts.my_company>0},{label:'Phòng ban',val:counts.department||0,unit:'phòng ban',color:'#2563EB',bg:'#EFF6FF',done:counts.department>0},{label:'Nhân viên',val:counts.employee||0,unit:'nhân viên',color:'#059669',bg:'#ECFDF5',done:counts.employee>0},{label:'Quy trình',val:counts.policy_and_program||0,unit:'quy trình',color:'#7C3AED',bg:'#F5F3FF',done:counts.policy_and_program>0},{label:'Tài khoản tiền',val:counts.account||0,unit:'tài khoản',color:'#D97706',bg:'#FFFBEB',done:counts.account>0}];
  let sumCards='';for(const s of summary)sumCards+='<div style="padding:14px 12px;border-radius:12px;background:'+(s.done?s.bg:'#F9FAFB')+';border:1px solid '+(s.done?'rgba(0,0,0,0.06)':'#E5E7EB')+';text-align:center;"><div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;">'+(s.done?'<span class="material-symbols-rounded" style="font-size:14px;color:#059669;">check_circle</span><span style="font-size:11px;font-weight:600;color:#059669;">Hoàn thành</span>':'<span class="material-symbols-rounded" style="font-size:14px;color:#D1D5DB;">radio_button_unchecked</span><span style="font-size:11px;font-weight:600;color:#9CA3AF;">Chưa thiết lập</span>')+'</div><div style="font-size:22px;font-weight:800;color:'+(s.done?s.color:'#D1D5DB')+';">'+s.val+'</div><div style="font-size:11px;color:'+(s.done?'#374151':'#9CA3AF')+';">'+s.unit+'</div><div style="font-size:10px;color:#9CA3AF;margin-top:2px;">'+s.label+'</div></div>';
  const qas=[{icon:'post_add',color:'#EA580C',bg:'#FFF7ED',title:'Tạo yêu cầu đầu tiên',desc:'Trải nghiệm quy trình phê duyệt và xử lý.',action:'request',btn:'Tạo yêu cầu'},{icon:'task_alt',color:'#2563EB',bg:'#EFF6FF',title:'Giao nhiệm vụ',desc:'Phân công công việc và theo dõi tiến độ.',action:'assigned_task',btn:'Tạo nhiệm vụ'},{icon:'bar_chart',color:'#059669',bg:'#ECFDF5',title:'Xem báo cáo',desc:'Khám phá các báo cáo quản trị.',action:'home',btn:'Xem báo cáo'},{icon:'badge',color:'#7C3AED',bg:'#F5F3FF',title:'Quản lý nhân sự',desc:'Cập nhật thông tin nhân viên, phòng ban.',action:'employee',btn:'Xem danh sách'}];
  let qaCards='';for(const q of qas)qaCards+='<div style="padding:16px;border-radius:14px;background:white;border:1px solid #E5E7EB;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,0.05);"><div style="width:38px;height:38px;border-radius:10px;background:'+q.bg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:20px;color:'+q.color+';">'+q.icon+'</span></div><div style="font-size:13px;font-weight:700;color:#111827;">'+q.title+'</div><div style="font-size:11.5px;color:#6B7280;line-height:1.4;flex:1;">'+q.desc+'</div><button onclick="completeSetupWizard(\''+q.action+'\')" style="width:100%;padding:8px;border-radius:9px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:var(--transition);">'+q.btn+'</button></div>';
  const resources=[{icon:'menu_book',color:'#2563EB',title:'Hướng dẫn sử dụng',desc:'Tìm hiểu các tính năng cơ bản'},{icon:'play_circle',color:'#EA580C',title:'Video hướng dẫn',desc:'Xem video thao tác chi tiết'},{icon:'table_chart',color:'#059669',title:'Thư viện quy trình mẫu',desc:'Tham khảo các quy trình phổ biến'},{icon:'help',color:'#7C3AED',title:'Câu hỏi thường gặp',desc:'Giải đáp các thắc mắc'}];
  let resItems='';for(const r of resources)resItems+='<button style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;width:100%;transition:var(--transition);" onmouseover="this.style.background=\'#F9FAFB\'" onmouseout="this.style.background=\'transparent\'"><div style="width:34px;height:34px;border-radius:9px;background:#F3F4F6;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:18px;color:'+r.color+';">'+r.icon+'</span></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+r.title+'</div><div style="font-size:10.5px;color:#9CA3AF;">'+r.desc+'</div></div><span class="material-symbols-rounded" style="font-size:15px;color:#D1D5DB;flex-shrink:0;">chevron_right</span></button>';
  return '<div style="display:flex;gap:20px;align-items:flex-start;">'
    // Hero
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;">'
    +'<div style="background:linear-gradient(135deg,#1E3A5F,#1D4ED8);border-radius:18px;padding:32px;color:white;overflow:hidden;position:relative;">'
    +'<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.08),transparent 70%);pointer-events:none;"></div>'
    +'<div style="display:flex;align-items:center;gap:24px;"><div style="flex:1;">'
    +'<div style="font-size:13px;color:#FCD34D;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px;"><span>🎉</span> Hoàn tất thiết lập!</div>'
    +'<h2 style="font-size:24px;font-weight:800;color:white;margin-bottom:10px;">TeraX đã sẵn sàng để sử dụng</h2>'
    +'<p style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:20px;">Môi trường làm việc của <strong style="color:white;">'+name+'</strong> đã được thiết lập. Hãy bắt đầu khám phá TeraX.</p>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;"><button onclick="completeSetupWizard()" class="sw-btn-primary" style="background:linear-gradient(135deg,#f97316,#ea580c);"><span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span> Vào hệ thống ngay</button>'
    +'<button style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.3);background:transparent;color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">play_circle</span> Xem hướng dẫn nhanh</button>'
    +'</div></div>'
    +'<div style="width:100px;flex-shrink:0;text-align:center;"><div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="material-symbols-rounded" style="font-size:48px;color:#FCD34D;">verified</span></div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:8px;">Cùng TeraX vận hành tốt hơn</div></div>'
    +'</div></div>'
    // Summary
    +'<div class="sw-card">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#111827;">Tổng quan thiết lập</div><button onclick="window.setSetupStep(1)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">settings</span> Chỉnh sửa</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'+sumCards+'</div>'
    +'</div>'
    // Quick actions
    +'<div><div style="font-size:13px;font-weight:700;color:#F8FAFC;margin-bottom:12px;">Bắt đầu với TeraX</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">'+qaCards+'</div></div>'
    +'</div>'
    // Right sidebar
    +'<div style="width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">'
    +'<div class="sw-card"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">Tài nguyên hữu ích</div><div style="display:flex;flex-direction:column;gap:2px;">'+resItems+'</div></div>'
    +'<div class="sw-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div style="width:34px;height:34px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div><div><div style="font-size:12px;font-weight:700;color:#111827;">Bạn cần hỗ trợ?</div><div style="font-size:10.5px;color:#6B7280;">Đội ngũ TeraX luôn sẵn sàng.</div></div></div><button class="sw-btn-primary" style="width:100%;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> Liên hệ hỗ trợ</button></div>'
    +'<div class="sw-card" style="background:rgba(255,255,255,0.7);"><div style="font-size:11.5px;color:#6B7280;line-height:1.6;font-style:italic;margin-bottom:10px;">"Cảm ơn bạn đã tin tưởng TeraX. Chúng tôi cam kết tiếp tục đồng hành để doanh nghiệp của bạn vận hành hiệu quả và phát triển bền vững."</div><div style="font-size:11px;color:#9CA3AF;font-weight:600;">— Đội ngũ TeraX</div></div>'
    +'</div></div>';
}

// ─────────────────────────────────────────────────────────────
//  SYSTEM CONTROLS
// ─────────────────────────────────────────────────────────────
window.completeSetupWizard=async function(redirectTo){try{showToast('Đang kích hoạt hệ thống...','info');const res=await apiPost('/system-setup/complete');if(res.success){showToast('Kích hoạt thành công!','success');window.setupCompleted=true;document.body.classList.remove('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='none';window.location.hash=redirectTo||'home';}else showToast('Lỗi: '+(res.message||'Unknown'),'error');}catch(err){showToast('Lỗi server: '+err.message,'error');}};
window.resetSetupStatusDev=async function(){if(!confirm('Khôi phục lại chế độ Setup?'))return;try{const res=await apiPost('/system-setup/reset');if(res.success){showToast('Đã khôi phục.','success');window.setupCompleted=false;window.setupCurrentStep=1;document.body.classList.add('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='flex';window.location.hash='setup';await renderSetupContent();}}catch(err){showToast('Lỗi: '+err.message,'error');}};
window.downloadSetupTemplate=function(moduleKey){const mod=(typeof MODULES!=='undefined')?MODULES[moduleKey]:null;if(!mod){showToast('Không tìm thấy cấu hình mẫu.','warning');return;}const headers=mod.fields.filter(f=>!f.section&&f.key&&f.type!=='file'&&!f.hidden).map(f=>f.key);if(!headers.length){showToast('Không tìm thấy trường.','warning');return;}const ws=XLSX.utils.json_to_sheet([{}],{header:headers});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,(mod.label||moduleKey).substring(0,30));XLSX.writeFile(wb,moduleKey+'_template.xlsx');showToast('Đã tải xuống mẫu.','success');};
window.importSetupFile=async function(event,moduleKey){const file=event.target.files[0];if(!file)return;showToast('Đang phân tích...','info');const r=new FileReader();r.onload=async(e)=>{try{const data=new Uint8Array(e.target.result),wb=XLSX.read(data,{type:'array'}),jd=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!jd.length){showToast('Tệp trống.','warning');return;}const tn=moduleKey==='policy'?'policy_and_program':moduleKey;const res=await apiPost('/table/'+tn+'/bulk',jd);showToast(res.message||'Nhập thành công!','success');await renderSetupContent();}catch(err){showToast('Tải lên thất bại: '+err.message,'error');}finally{event.target.value='';}};r.readAsArrayBuffer(file);};
