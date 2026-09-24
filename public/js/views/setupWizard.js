/**
 * TeraX ΓÇô Setup Wizard (Light Theme)
 * M├áu sß║»c ─æiß╗üu chß╗ënh ph├╣ hß╗úp vß╗¢i glassmorphism light theme cß╗ºa app
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedEmployees = [];
window.setupStep2ActiveTab = 'choose';
window.setupStep3ActiveTab = 'excel';
window.setupStep4ActiveTab = 'library';
window.setupStep4Category = 'all';
window.setupStep4Search = '';

// ΓöÇΓöÇΓöÇ CSS helper injected once ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
  if (titleEl) titleEl.textContent = 'Thiß║┐t lß║¡p ban ─æß║ºu';
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) { subtitleEl.textContent = 'Khß╗ƒi tß║ío kh├┤ng gian l├ám viß╗çc theo 5 b╞░ß╗¢c'; subtitleEl.style.display = 'block'; }
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

// ΓöÇΓöÇ Cache: chß╗ë fetch API khi cß║ºn thiß║┐t (lß║ºn ─æß║ºu hoß║╖c sau khi save) ΓöÇΓöÇ
window._setupDataLoaded = false;

window.renderSetupContent = async function (forceRefresh) {
  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  // Nß║┐u ch╞░a c├│ data hoß║╖c y├¬u cß║ºu refresh (sau khi save) th├¼ mß╗¢i gß╗ìi API
  if (!window._setupDataLoaded || forceRefresh) {
    contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#374151;"><div class="spinner" style="margin:0 auto 12px;"></div> ─Éang tß║úi th├┤ng tin thiß║┐t lß║¡p...</div>';
    try {
      const [statusRes, dataRes] = await Promise.all([apiGet('/system-setup/status'), apiGet('/system-setup/data')]);
      window.setupCompleted = statusRes.setupCompleted;
      window.setupTableCounts = statusRes.tableCounts || {};
      window.setupWizardData = dataRes || {};
      window._setupDataLoaded = true;
    } catch (err) {
      contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;"><span class="material-symbols-rounded" style="font-size:43px;">error</span><div style="font-size:14px;font-weight:600;margin-top:10px;color:#111827;">Lß╗ùi tß║úi dß╗» liß╗çu</div></div>';
      return;
    }
  }
  const counts = window.setupTableCounts || {};
  const comp = window.setupWizardData.company || {};
  const currentStep = window.setupCurrentStep || 1;
  const stepDone = [counts.my_company>0, counts.department>0, counts.employee>0, counts.policy_and_program>0, counts.account>0];
  const completedCount = stepDone.filter(Boolean).length;
  const pct = Math.round((completedCount/5)*100);
  const stepLabels = ['Th├┤ng tin c├┤ng ty','Ph├▓ng ban','Nh├ón vi├¬n','Quy tr├¼nh','T├ái khoß║ún tiß╗ün','Bß║»t ─æß║ºu sß╗¡ dß╗Ñng'];

  // ΓöÇΓöÇ Stepper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Progress sidebar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const sideLabels = ['Th├┤ng tin c├┤ng ty','Ph├▓ng ban','Nh├ón vi├¬n','Quy tr├¼nh','T├ái khoß║ún tiß╗ün'];
  let stepList = '';
  for (let i=0;i<5;i++) {
    const num=i+1, done=stepDone[i], isAct=num===currentStep;
    const st = done?'─É├ú ho├án th├ánh':isAct?'─Éang thß╗▒c hiß╗çn':'Ch╞░a thiß║┐t lß║¡p';
    const stColor = done?'#16a34a':isAct?'#ea580c':'#9CA3AF';
    const cirBg = done?'#22c55e':isAct?'#f97316':'#E5E7EB';
    const cirText = done?'<span class="material-symbols-rounded" style="font-size:13px;color:white;">check</span>':'<span style="color:'+(isAct?'white':'#6B7280')+';">'+num+'</span>';
    stepList += '<div onclick="window.setSetupStep('+num+')" class="sw-step-item '+(isAct?'active':'inactive')+'">';
    stepList += '<div style="width:22px;height:22px;border-radius:50%;background:'+cirBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;">'+cirText+'</div>';
    stepList += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#111827;">'+sideLabels[i]+'</div><div style="font-size:10.5px;color:'+stColor+';font-weight:500;">'+st+'</div></div></div>';
  }
  const tips = ['Chß╗ìn mß║½u c├│ sß║╡n ─æß╗â tiß║┐t kiß╗çm thß╗¥i gian','Kh├┤ng cß║ºn tß║ío tß║Ñt cß║ú ngay, bß╗ò sung sau ─æ╞░ß╗úc','Sau khi tß║ío, chß╗ënh sß╗¡a ─æ╞░ß╗úc bß║Ñt kß╗│ l├║c n├áo','Quy tr├¼nh n├¬n d├╣ng vai tr├▓ thay v├¼ chß╗ë ─æß╗ïnh cß╗Ñ thß╗â'];
  let tipsHtml = '';
  for (const t of tips) tipsHtml += '<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#6B7280;line-height:1.5;"><span class="material-symbols-rounded" style="font-size:13px;color:#16a34a;flex-shrink:0;margin-top:1px;">check_circle</span><span>'+t+'</span></div>';
  const descText = completedCount<5 ? 'C├▓n '+(5-completedCount)+' b╞░ß╗¢c nß╗»a l├á xong!' : 'Tuyß╗çt vß╗¥i! Sß║╡n s├áng sß╗¡ dß╗Ñng.';

  const progressSidebar = '<div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">'
    // Donut card
    + '<div class="sw-sidebar-card">'
    + '<div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:14px;">Tiß║┐n ─æß╗Ö thiß║┐t lß║¡p</div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">'
    + '<div style="position:relative;width:68px;height:68px;flex-shrink:0;">'
    + '<svg viewBox="0 0 36 36" style="width:68px;height:68px;transform:rotate(-90deg)">'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" stroke-width="3"/>'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="'+pct+' '+(100-pct)+'" stroke-linecap="round"/>'
    + '</svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#111827;">'+pct+'%</div></div>'
    + '<div><div style="font-size:12.5px;font-weight:700;color:#111827;">'+completedCount+'/5 b╞░ß╗¢c ho├án th├ánh</div>'
    + '<div style="font-size:11px;color:#6B7280;margin-top:3px;line-height:1.5;">'+descText+'</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+stepList+'</div>'
    + '</div>'
    // Tips card
    + '<div class="sw-sidebar-card">'
    + '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="material-symbols-rounded" style="font-size:17px;color:#f59e0b;">lightbulb</span><span style="font-size:12px;font-weight:700;color:#111827;">Mß║╣o hß╗»u ├¡ch</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+tipsHtml+'</div>'
    + '</div>'
    // Docs link
    + '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:14px;cursor:pointer;">'
    + '<div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="font-size:18px;color:#1D4ED8;">menu_book</span>'
    + '<div><div style="font-size:12px;font-weight:700;color:#1E40AF;">T├ái liß╗çu h╞░ß╗¢ng dß║½n</div>'
    + '<div style="font-size:10.5px;color:#3B82F6;margin-top:2px;">Xem h╞░ß╗¢ng dß║½n chi tiß║┐t Γåù</div></div></div>'
    + '</div>'
    + '</div>';

  const supportWidget = '<div class="sw-card" style="margin-top:16px;">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div>'
    + '<div><div style="font-size:13px;font-weight:700;color:#111827;">Cß║ºn hß╗ù trß╗ú?</div><div style="font-size:11px;color:#6B7280;">─Éß╗Öi ng┼⌐ TeraX lu├┤n sß║╡n s├áng hß╗ù trß╗ú bß║ín</div></div></div>'
    + '<button style="width:100%;padding:9px;border-radius:10px;border:1.5px solid #f97316;background:transparent;color:#f97316;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> Li├¬n hß╗ç hß╗ù trß╗ú</button>'
    + '</div>';

  const mainBodyHTML = currentStep===6 ? renderStep6HTML(counts, comp) : renderCurrentStepHTML(currentStep, comp, window.setupWizardData.admin||{}, counts);

  contentEl.innerHTML = '<div class="detail-scroll" style="max-width:1280px;margin:0 auto;width:100%;padding:16px 20px 60px;">'
    // Title trong card - lu├┤n ─æß╗ìc ─æ╞░ß╗úc, kh├┤ng ch├¼m background
    + '<div class="sw-card" style="padding:16px 22px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">'
    + '<div><h2 style="font-size:17px;font-weight:800;color:#111827;margin-bottom:2px;">Thiß║┐t lß║¡p TeraX cho doanh nghiß╗çp cß╗ºa bß║ín</h2>'
    + '<p style="font-size:12px;color:#6B7280;">Chß╗ë v├ái b╞░ß╗¢c ─æ╞ín giß║ún ─æß╗â bß║»t ─æß║ºu. Bß║ín c├│ thß╗â bß╗Å qua v├á bß╗ò sung sau.</p></div>'
    + '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;padding:4px 10px;border-radius:20px;background:#FFF7ED;color:#EA580C;border:1px solid #FED7AA;font-weight:600;">'+completedCount+'/5 b╞░ß╗¢c</span></div>'
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

window.setSetupStep = function(n){window.setupCurrentStep=Math.max(1,Math.min(6,n));renderSetupContent();}; // d├╣ng cache, kh├┤ng gß╗ìi API

function renderCurrentStepHTML(step,comp,admin,counts){switch(step){case 1:return renderStep1HTML(comp);case 2:return renderStep2HTML(counts);case 3:return renderStep3HTML(counts);case 4:return renderStep4HTML(counts);case 5:return renderStep5HTML(comp,counts);default:return renderStep1HTML(comp);}}

// ΓöÇΓöÇ Shared helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function swStepHeader(icon, num, title, sub) {
  // ─É╞ín giß║ún: chß╗ë title + subtitle, kh├┤ng c├│ icon thß╗½a hay n├║t H╞░ß╗¢ng dß║½n
  return '<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
    + '<span style="font-size:10px;font-weight:700;color:#EA580C;background:#FFF7ED;border:1px solid #FED7AA;padding:2px 8px;border-radius:20px;">B╞░ß╗¢c '+num+'/5</span>'
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
    + '<button class="sw-btn-back" onclick="window.setSetupStep('+back+')"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lß║íi</button>'
    + '<div style="display:flex;gap:10px;align-items:center;">'
    + '<button class="sw-btn-ghost" onclick="window.setSetupStep('+skip+')">Bß╗Å qua b╞░ß╗¢c n├áy</button>'
    + '<button class="sw-btn-primary" onclick="'+action+'"><span>'+label+'</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    + '</div></div>';
}
function swInput(id, ph, val, type) {
  return '<input type="'+(type||'text')+'" id="'+id+'" class="sw-input" placeholder="'+ph+'" value="'+(val||'')+'">';
}
function swLabel(text, req) {
  return '<label class="sw-label">'+text+(req?' <span style="color:#ef4444;">*</span>':'')+'</label>';
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 1
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
  const _IC = (comp.base_currency||'VND').toUpperCase();
  const _IC2 = comp.country||'Vietnam';
  setTimeout(async()=>{
    const [ctrs,curs]=await Promise.all([fetchLookup('countries','/system-setup/lookups/countries'),fetchLookup('currencies','/system-setup/lookups/currencies')]);
    const sC=document.getElementById('step1_country'),sCur=document.getElementById('step1_currency');
    if(sC&&ctrs.length)sC.innerHTML=ctrs.map(c=>'<option value="'+c.name+'" '+(c.name.toLowerCase()===_IC2.toLowerCase()||c.code===_IC2?'selected':'')+'>'+c.display_name+'</option>').join('');
    if(sCur&&curs.length)sCur.innerHTML=curs.map(c=>'<option value="'+c.code+'" '+(c.code===_IC?'selected':'')+'>'+c.code+'</option>').join('');
  },0);
  return '<div class="sw-card">'
    + swStepHeader('apartment',1,'Th├┤ng tin c├┤ng ty','Tß║ío c╞í sß╗ƒ dß╗» liß╗çu nß╗ün tß║úng cho doanh nghiß╗çp. C├│ thß╗â chß╗ënh sß╗¡a sau.')
    + '<form id="form-step1" onsubmit="event.preventDefault();saveStep1AndAdvance();">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel('T├¬n ─æß║ºy ─æß╗º c├┤ng ty / doanh nghiß╗çp',true)+swInput('step1_fullname','VD: C├öNG TY Cß╗ö PHß║ªN C├öNG NGHß╗å TERAX',escapeHTML(comp.company_fullname||''))+'</div>'
    + '<div class="form-group">'+swLabel('T├¬n viß║┐t tß║»t / Brand Name',true)+swInput('step1_shortname','VD: TERAX',escapeHTML(comp.company_shortname||''))+'</div>'
    + '<div class="form-group">'+swLabel('M├ú sß╗æ thuß║┐',false)+swInput('step1_tax_code','VD: 0101234567',escapeHTML(comp.tax_code||''))+'</div>'
    + '<div class="form-group">'+swLabel('Quß╗æc gia',true)+'<select id="step1_country" class="sw-select"><option>Đang tải...</option></select></div>'
    + '<div class="form-group">'+swLabel('─É╞ín vß╗ï tiß╗ün tß╗ç ch├¡nh',true)+'<select id="step1_currency" class="sw-select"><option>Đang tải...</option></select></div>'
    + '<div class="form-group" style="grid-column:span 2;">'+swLabel('─Éß╗ïa chß╗ë trß╗Ñ sß╗ƒ ch├¡nh',false)+swInput('step1_address','VD: Tß║ºng 5, T├▓a nh├á Landmark, H├á Nß╗Öi',escapeHTML(comp.address||''))+'</div>'
    + '<div class="form-group">'+swLabel('Website',false)+swInput('step1_website','https://terax.ai',escapeHTML(comp.website||''))+'</div>'
    + '<div class="form-group">'+swLabel('M├║i giß╗¥ hß╗ç thß╗æng',false)+'<input type="text" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;cursor:default;" value="'+tz+'"></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    + '<button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(2)">Bß╗Å qua b╞░ß╗¢c n├áy</button>'
    + '<button type="submit" class="sw-btn-primary"><span>L╞░u v├á tiß║┐p tß╗Ñc</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    + '</div></form></div>';
}
window.saveStep1AndAdvance = async function(){
  const fn=document.getElementById('step1_fullname')?.value?.trim(),sn=document.getElementById('step1_shortname')?.value?.trim();
  if(!fn||!sn){showToast('Vui l├▓ng ─æiß╗ün t├¬n ─æß║ºy ─æß╗º v├á t├¬n viß║┐t tß║»t','warning');return;}
  try{showToast('─Éang l╞░u th├┤ng tin c├┤ng ty...','info');const res=await apiPost('/system-setup/company',{company_fullname:fn,company_shortname:sn,tax_code:document.getElementById('step1_tax_code')?.value?.trim(),country:document.getElementById('step1_country')?.value,base_currency:document.getElementById('step1_currency')?.value,address:document.getElementById('step1_address')?.value?.trim(),website:document.getElementById('step1_website')?.value?.trim()});
  if(res.success){showToast('─É├ú l╞░u th├┤ng tin c├┤ng ty!','success');window.setupCurrentStep=2;await renderSetupContent(true);}else showToast(res.error||'L╞░u thß║Ñt bß║íi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}

};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 2: PH├ÆNG BAN
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const DEPT_ICONS={BGD:{icon:'workspace_premium',color:'#D97706',bg:'#FEF3C7'},HCNS:{icon:'supervised_user_circle',color:'#2563EB',bg:'#EFF6FF'},TCKT:{icon:'account_balance',color:'#059669',bg:'#ECFDF5'},KD:{icon:'bar_chart',color:'#EA580C',bg:'#FFF7ED'},KT:{icon:'construction',color:'#7C3AED',bg:'#F5F3FF'},IT:{icon:'laptop',color:'#0284C7',bg:'#F0F9FF'},MH:{icon:'shopping_cart',color:'#DB2777',bg:'#FDF2F8'},CSKH:{icon:'headset_mic',color:'#0D9488',bg:'#F0FDFA'},PC:{icon:'gavel',color:'#9333EA',bg:'#FAF5FF'}};
const PRESET_DEPARTMENTS=[{code:'BGD',name:'Ban Gi├ím ─æß╗æc',type:'Operation',desc:'─Éiß╗üu h├ánh v├á quß║ún trß╗ï doanh nghiß╗çp',checked:true},{code:'HCNS',name:'H├ánh ch├¡nh ΓÇô Nh├ón sß╗▒',type:'Operation',desc:'Quß║ún l├╜ nh├ón sß╗▒, h├ánh ch├¡nh, ph├íp chß║┐',checked:true},{code:'TCKT',name:'T├ái ch├¡nh ΓÇô Kß║┐ to├ín',type:'Finance',desc:'T├ái ch├¡nh, kß║┐ to├ín, thuß║┐',checked:true},{code:'KD',name:'Kinh doanh',type:'Sale and MKT',desc:'Ph├ít triß╗ân thß╗ï tr╞░ß╗¥ng, ch─âm s├│c kh├ích h├áng',checked:true},{code:'KT',name:'Kß╗╣ thuß║¡t',type:'Technical',desc:'Triß╗ân khai dß╗▒ ├ín, kß╗╣ thuß║¡t, vß║¡n h├ánh',checked:true},{code:'IT',name:'CNTT',type:'Technical',desc:'Hß║í tß║ºng, hß╗ç thß╗æng, hß╗ù trß╗ú IT',checked:false},{code:'MH',name:'Mua h├áng',type:'Operation',desc:'Mua sß║»m, nh├á cung cß║Ñp',checked:false},{code:'CSKH',name:'Ch─âm s├│c kh├ích h├áng',type:'Sale and MKT',desc:'Hß╗ù trß╗ú kh├ích h├áng, dß╗ïch vß╗Ñ',checked:false},{code:'PC',name:'Ph├íp chß║┐',type:'Operation',desc:'Ph├íp l├╜, tu├ón thß╗º',checked:false}];
window.switchStep2Tab=function(t){window.setupStep2ActiveTab=t;renderSetupContent();};
function renderStep2HTML(counts){
  const tab=window.setupStep2ActiveTab;
  let tc='';
  if(tab==='choose'){
    let cards='';
    for(const d of PRESET_DEPARTMENTS){const m=DEPT_ICONS[d.code]||{icon:'business',color:'#EA580C',bg:'#FFF7ED'};
      cards+='<label class="sw-preset-card"><input type="checkbox" name="preset_dept" value="'+d.code+'" '+(d.checked?'checked':'')+' style="margin-top:2px;accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+d.name+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+d.desc+'</div></div></label>';}
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Chß╗ìn c├íc ph├▓ng ban ph├╣ hß╗úp vß╗¢i doanh nghiß╗çp. C├│ thß╗â chß╗ënh sß╗¡a sau.</p>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">'+cards+'</div>'
      +'<button onclick="showCustomDeptForm()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px dashed #D1D5DB;background:#F9FAFB;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> Th├¬m ph├▓ng ban t├╣y chß╗ënh</button>'
      +'<div id="custom-dept-form" style="display:none;margin-top:12px;padding:16px;border-radius:12px;border:1px solid #E5E7EB;background:#F9FAFB;">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;align-items:end;">'
      +'<div>'+swLabel('M├ú ph├▓ng ban',false)+swInput('custom_dept_code','VD: MKT','')+'</div>'
      +'<div>'+swLabel('T├¬n ph├▓ng ban',false)+swInput('custom_dept_name','VD: Marketing','')+'</div>'
      +'<div><button onclick="addCustomDeptToList()" class="sw-btn-primary" style="width:100%;justify-content:center;">+ Th├¬m v├áo danh s├ích</button></div>'
      +'</div></div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">K├⌐o &amp; Thß║ú file Excel v├áo ─æ├óy</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'department\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tß║úi mß║½u (.xlsx)</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chß╗ìn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'department\')"></label></div></div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:110px 1fr 150px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qdept-code" placeholder="M├ú PB"><input type="text" class="sw-input qdept-name" placeholder="T├¬n ph├▓ng ban"><select class="sw-select qdept-type"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Nhß║¡p trß╗▒c tiß║┐p tß╗½ng ph├▓ng ban.</p><div id="quick-dept-rows">'+r3+'</div><button onclick="addQuickDeptRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> Th├¬m d├▓ng</button></div>';
  } else {
    tc='<div><div style="background:#F9FAFB;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="padding:10px 16px;background:#F3F4F6;font-size:12px;font-weight:700;color:#374151;">Hiß╗çn c├│: <strong style="color:#16a34a;">'+(counts.department||0)+'</strong> ph├▓ng ban trong hß╗ç thß╗æng</div>'+(counts.department>0?'<div style="padding:16px;font-size:12px;color:#6B7280;">─É├ú c├│ ph├▓ng ban. C├│ thß╗â th├¬m tß╗½ tab Chß╗ìn mß║½u.</div>':'<div style="padding:20px;text-align:center;font-size:12px;color:#9CA3AF;">Ch╞░a c├│ ph├▓ng ban. H├úy chß╗ìn tß╗½ tab Chß╗ìn mß║½u.</div>')+'</div></div>';
  }
  return '<div class="sw-card">'+swStepHeader('account_tree',2,'Thiß║┐t lß║¡p ph├▓ng ban','Tß║ío c╞í cß║Ñu tß╗ò chß╗⌐c. Chß╗ìn tß╗½ mß║½u gß╗úi ├╜ hoß║╖c nhß║¡p tß╗½ Excel.')+swTabBar([{key:'choose',label:'Chß╗ìn mß║½u'},{key:'excel',label:'Nhß║¡p tß╗½ Excel'},{key:'quick',label:'Nhß║¡p nhanh'},{key:'preview',label:'Xem tr╞░ß╗¢c'}],tab,'window.switchStep2Tab')+tc+swBottomNav(1,3,'Tß║ío c├íc ph├▓ng ban ─æ├ú chß╗ìn','saveStep2AndAdvance()')+'</div>';
}
window.showCustomDeptForm=function(){const el=document.getElementById('custom-dept-form');if(el)el.style.display=el.style.display==='none'?'block':'none';};
window.addQuickDeptRow=function(){const c=document.getElementById('quick-dept-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:110px 1fr 150px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="sw-input qdept-code" placeholder="M├ú PB"><input type="text" class="sw-input qdept-name" placeholder="T├¬n ph├▓ng ban"><select class="sw-select qdept-type"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.addCustomDeptToList=function(){const code=document.getElementById('custom_dept_code')?.value?.trim(),name=document.getElementById('custom_dept_name')?.value?.trim();if(!code||!name){showToast('Vui l├▓ng ─æiß╗ün ─æß╗º M├ú v├á T├¬n ph├▓ng ban','warning');return;}showToast('─É├ú th├¬m ph├▓ng ban "'+name+'" ('+code+') v├áo danh s├ích','info');};
window.saveStep2AndAdvance=async function(){
  const tab=window.setupStep2ActiveTab;
  if(tab==='quick'){const codes=document.querySelectorAll('.qdept-code'),names=document.querySelectorAll('.qdept-name'),types=document.querySelectorAll('.qdept-type'),payload=[];codes.forEach((c,i)=>{const code=c.value.trim(),name=names[i]?.value?.trim(),type=types[i]?.value||'Operation';if(code&&name)payload.push({department_code:code,department_name:name,type});});if(!payload.length){window.setSetupStep(3);return;}try{const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('─É├ú tß║ío '+res.count+' ph├▓ng ban!','success');window.setupCurrentStep=3;await renderSetupContent(true);}else showToast(res.error||'Lß╗ùi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}return;}
  const cbs=document.querySelectorAll('input[name="preset_dept"]:checked'),sels=Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(3);return;}
  const payload=PRESET_DEPARTMENTS.filter(d=>sels.includes(d.code)).map(d=>({department_code:d.code,department_name:d.name,type:d.type}));
  try{showToast('─Éang tß║ío '+payload.length+' ph├▓ng ban...','info');const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('─É├ú tß║ío '+res.count+' ph├▓ng ban!','success');window.setupCurrentStep=3;await renderSetupContent(true);}else showToast(res.error||'Lß╗ùi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}
};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 3: NH├éN VI├èN
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
window.switchStep3Tab=function(t){window.setupStep3ActiveTab=t;renderSetupContent();};
function renderStep3HTML(counts){
  const tab=window.setupStep3ActiveTab,parsed=window.setupParsedEmployees||[];
  const modes=[{key:'excel',icon:'table_view',color:'#059669',bg:'#ECFDF5',title:'Nhß║¡p tß╗½ Excel',desc:'Tß║úi l├¬n file Excel. Hß╗ç thß╗æng tß╗▒ nhß║¡n diß╗çn cß╗Öt.'},{key:'quick',icon:'bolt',color:'#EA580C',bg:'#FFF7ED',title:'Th├¬m nhanh',desc:'Nhß║¡p trß╗▒c tiß║┐p tr├¬n giao diß╗çn.'},{key:'sample',icon:'description',color:'#7C3AED',bg:'#F5F3FF',title:'D├╣ng dß╗» liß╗çu mß║½u',desc:'Tß║úi file mß║½u chuß║⌐n TeraX.'}];
  let modeCards='';
  for(const m of modes)modeCards+='<label onclick="window.switchStep3Tab(\''+m.key+'\')" class="sw-mode-card '+(tab===m.key?'active':'')+'""><div style="width:38px;height:38px;border-radius:10px;background:'+m.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:20px;color:'+m.color+';">'+m.icon+'</span></div><div><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">'+m.title+'</div><div style="font-size:11px;color:#6B7280;line-height:1.4;">'+m.desc+'</div></div></label>';
  let tc='';
  if(tab==='excel'){
    let prev='';
    if(parsed.length>0){
      const vc=parsed.filter(e=>e.full_name&&e.email).length,wc=parsed.filter(e=>!e.department_code).length,ec=parsed.filter(e=>!e.full_name||!e.email).length;
      let rows='';for(let i=0;i<Math.min(parsed.length,10);i++){const e=parsed[i],v=e.full_name&&e.email;rows+='<tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:7px 12px;color:#9CA3AF;font-size:12px;">'+(i+1)+'</td><td style="padding:7px 12px;font-weight:600;color:#111827;font-size:12px;">'+escapeHTML(e.full_name||'ΓÇô')+'</td><td style="padding:7px 12px;color:#2563EB;font-size:12px;">'+escapeHTML(e.email||'ΓÇô')+'</td><td style="padding:7px 12px;color:#374151;font-size:12px;">'+escapeHTML(e.department_code||'ΓÇô')+'</td><td style="padding:7px 12px;color:#374151;font-size:12px;">'+escapeHTML(e.position||'Nh├ón vi├¬n')+'</td><td style="padding:7px 12px;">'+(v?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#16a34a;font-weight:600;">Hß╗úp lß╗ç</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;font-weight:600;">Lß╗ùi</span>')+'</td></tr>';}
      prev='<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:14px;"><span class="material-symbols-rounded" style="font-size:26px;color:#059669;">grid_on</span><div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#111827;">File nh├ón vi├¬n</div><div style="font-size:11px;color:#6B7280;">'+parsed.length+' d├▓ng dß╗» liß╗çu</div></div><span style="font-size:11px;color:#059669;font-weight:600;display:flex;align-items:center;gap:4px;"><span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Tß║úi l├¬n th├ánh c├┤ng</span><button onclick="window.setupParsedEmployees=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button></div>'
      +'<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px;">├ünh xß║í cß╗Öt dß╗» liß╗çu</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px;">'
      +['Hß╗ì v├á t├¬n *','Email *','Ph├▓ng ban','Chß╗⌐c danh','Quß║ún l├╜'].map((lbl,fi)=>'<div>'+swLabel(lbl,false)+'<select class="sw-select" style="font-size:11.5px;padding:6px 10px;">'+['A ΓÇô Hß╗ì v├á t├¬n','B ΓÇô Email','C ΓÇô Ph├▓ng ban','D ΓÇô Chß╗⌐c danh','E ΓÇô Quß║ún l├╜'].map((o,oi)=>'<option '+(oi===fi?'selected':'')+'>'+o+'</option>').join('')+'</select></div>').join('')
      +'</div></div>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:#111827;">Xem tr╞░ß╗¢c (10 d├▓ng ─æß║ºu)</span><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#DCFCE7;color:#16a34a;">'+vc+' hß╗úp lß╗ç</span>'+(wc>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#FEF9C3;color:#CA8A04;">'+wc+' cß║únh b├ío</span>':'')+(ec>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#FEE2E2;color:#EF4444;">'+ec+' lß╗ùi</span>':'')+'</div>'
      +'<div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;"><div style="overflow-x:auto;max-height:220px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">#</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Hß╗ì v├á t├¬n</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Email</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Ph├▓ng ban</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Chß╗⌐c danh</th><th style="padding:8px 12px;text-align:left;font-size:11.5px;font-weight:600;color:#6B7280;">Trß║íng th├íi</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }
    tc='<div><div class="sw-upload-zone" style="margin-bottom:16px;"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">K├⌐o &amp; Thß║ú file Excel v├áo ─æ├óy</div><div style="font-size:12px;color:#6B7280;margin-bottom:14px;">(.xlsx, .xls, .csv)</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="downloadEmployeeTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">download</span> Tß║úi file mß║½u 5 cß╗Öt</button><label style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">folder_open</span> Chß╗ìn file Excel<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleEmployeeExcelUpload(event)"></label></div></div>'+prev+'</div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:1fr 1fr 130px 130px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="sw-input qemp-name" placeholder="Hß╗ì v├á t├¬n *"><input type="email" class="sw-input qemp-email" placeholder="Email *"><input type="text" class="sw-input qemp-dept" placeholder="M├ú ph├▓ng ban"><input type="text" class="sw-input qemp-pos" placeholder="Chß╗⌐c danh"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Nhß║¡p trß╗▒c tiß║┐p tß╗½ng nh├ón vi├¬n.</p><div id="quick-emp-rows">'+r3+'</div><button onclick="addQuickEmpRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed #D1D5DB;background:transparent;color:#374151;font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">person_add</span> Th├¬m nh├ón vi├¬n</button></div>';
  } else {
    tc='<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:14px;padding:24px;text-align:center;"><div style="width:56px;height:56px;border-radius:14px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><span class="material-symbols-rounded" style="font-size:28px;color:#7C3AED;">description</span></div><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">File mß║½u nh├ón vi├¬n ΓÇô 5 cß╗Öt chuß║⌐n TeraX</div><div style="font-size:12px;color:#6B7280;margin-bottom:16px;line-height:1.6;">Gß╗ôm: Hß╗ì v├á t├¬n ┬╖ Email ┬╖ Ph├▓ng ban ┬╖ Chß╗⌐c danh ┬╖ Quß║ún l├╜ trß╗▒c tiß║┐p</div><button onclick="downloadEmployeeTemplate()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">download</span>Tß║úi file mß║½u (.xlsx)</button></div>';
  }
  const btnLabel=parsed.length>0?'Nhß║¡p '+parsed.length+' nh├ón vi├¬n':'Tiß║┐p tß╗Ñc b╞░ß╗¢c tiß║┐p theo';
  return '<div class="sw-card">'+swStepHeader('group',3,'Thiß║┐t lß║¡p nh├ón vi├¬n','Nhß║¡p danh s├ích nh├ón sß╗▒. C├│ thß╗â nhß║¡p tß╗½ Excel, th├¬m nhanh hoß║╖c d├╣ng dß╗» liß╗çu mß║½u.')+'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">'+modeCards+'</div>'+tc+swBottomNav(2,4,btnLabel,'saveStep3AndAdvance()')+'</div>';
}
window.addQuickEmpRow=function(){const c=document.getElementById('quick-emp-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:1fr 1fr 130px 130px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="sw-input qemp-name" placeholder="Hß╗ì v├á t├¬n *"><input type="email" class="sw-input qemp-email" placeholder="Email *"><input type="text" class="sw-input qemp-dept" placeholder="M├ú ph├▓ng ban"><input type="text" class="sw-input qemp-pos" placeholder="Chß╗⌐c danh"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid #FEE2E2;background:#FFF5F5;color:#EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.downloadEmployeeTemplate=function(){const h=['Hß╗ì v├á t├¬n *','Email *','Ph├▓ng ban (M├ú hoß║╖c T├¬n)','Chß╗⌐c vß╗Ñ','Email Quß║ún l├╜ trß╗▒c tiß║┐p'],data=[{'Hß╗ì v├á t├¬n *':'Nguyß╗àn V─ân Quß║ún L├╜','Email *':'manager@company.com','Ph├▓ng ban (M├ú hoß║╖c T├¬n)':'KD','Chß╗⌐c vß╗Ñ':'Tr╞░ß╗ƒng ph├▓ng','Email Quß║ún l├╜ trß╗▒c tiß║┐p':''},{'Hß╗ì v├á t├¬n *':'Trß║ºn Thß╗ï Nh├ón Vi├¬n','Email *':'staff@company.com','Ph├▓ng ban (M├ú hoß║╖c T├¬n)':'KD','Chß╗⌐c vß╗Ñ':'Chuy├¬n vi├¬n','Email Quß║ún l├╜ trß╗▒c tiß║┐p':'manager@company.com'}];const ws=XLSX.utils.json_to_sheet(data,{header:h});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'NhanVien');XLSX.writeFile(wb,'Mau_Nhan_Vien_5_Cot.xlsx');showToast('─É├ú tß║úi xuß╗æng file mß║½u','success');};
window.handleEmployeeExcelUpload=function(event){const file=event.target.files[0];if(!file)return;const r=new FileReader();r.onload=(e)=>{try{const data=new Uint8Array(e.target.result),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows||!rows.length){showToast('File kh├┤ng c├│ d├▓ng dß╗» liß╗çu','warning');return;}const mapped=[];for(const row of rows){const k=Object.keys(row),nk=k.find(x=>/t├¬n|name|hß╗ì/i.test(x)),ek=k.find(x=>/email|th╞░/i.test(x)),dk=k.find(x=>/ph├▓ng|dept|ban/i.test(x)),pk=k.find(x=>/chß╗⌐c|vß╗ï tr├¡|title|position/i.test(x)),mk=k.find(x=>/quß║ún l├╜|manager/i.test(x)),fn=nk?String(row[nk]).trim():'',em=ek?String(row[ek]).trim():'';if(fn&&em)mapped.push({full_name:fn,email:em,department_code:dk?String(row[dk]).trim():'',position:pk?String(row[pk]).trim():'Nh├ón vi├¬n',direct_manager:mk?String(row[mk]).trim():''});}if(!mapped.length){showToast('Kh├┤ng t├¼m thß║Ñy d├▓ng hß╗úp lß╗ç','warning');return;}window.setupParsedEmployees=mapped;showToast('─É├ú nhß║¡n diß╗çn '+mapped.length+' nh├ón vi├¬n','success');renderSetupContent();}catch(err){showToast('Lß╗ùi ─æß╗ìc file: '+err.message,'error');}};r.readAsArrayBuffer(file);};
window.saveStep3AndAdvance=async function(){const tab=window.setupStep3ActiveTab;if(tab==='quick'){const ns=document.querySelectorAll('.qemp-name'),es=document.querySelectorAll('.qemp-email'),ds=document.querySelectorAll('.qemp-dept'),ps=document.querySelectorAll('.qemp-pos'),p=[];ns.forEach((n,i)=>{const fn=n.value.trim(),em=es[i]?.value?.trim();if(fn&&em)p.push({full_name:fn,email:em,department_code:ds[i]?.value?.trim()||'',position:ps[i]?.value?.trim()||'Nh├ón vi├¬n',direct_manager:''});});if(!p.length){window.setSetupStep(4);return;}window.setupParsedEmployees=p;}const employees=window.setupParsedEmployees||[];if(!employees.length){window.setSetupStep(4);return;}try{showToast('─Éang nhß║¡p '+employees.length+' nh├ón vi├¬n...','info');const res=await apiPost('/system-setup/import-employees',{employees});if(res.success){showToast('─É├ú nhß║¡p '+res.count+' nh├ón vi├¬n!','success');window.setupParsedEmployees=[];window.setupCurrentStep=4;await renderSetupContent(true);}else showToast(res.error||'Lß╗ùi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 4: QUY TR├îNH
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const PRESET_POLICIES_FULL=[
  {id:'P-LEAVE',name:'Xin nghß╗ë ph├⌐p',type:'Operation',cat:'Nhan su',nameVi:'Xin nghß╗ë ph├⌐p',descVi:'Quy tr├¼nh nh├ón vi├¬n xin nghß╗ë ph├⌐p (ng├áy, d├ái ng├áy)',tags:['Phß╗ò biß║┐n'],elements:'ASSIGN_TASK',sla:1,checked:true},
  {id:'P-RECRUIT',name:'Tuyen dung',type:'Operation',cat:'Nhan su',nameVi:'Tuyß╗ân dß╗Ñng',descVi:'─Éß╗ü xuß║Ñt v├á ph├¬ duyß╗çt tuyß╗ân dß╗Ñng nh├ón sß╗▒',tags:['Phß╗ò biß║┐n'],elements:'ASSIGN_TASK',sla:3,checked:true},
  {id:'P-ONBOARD',name:'Onboarding',type:'Operation',cat:'Nhan su',nameVi:'Onboarding',descVi:'Quy tr├¼nh tiß║┐p nhß║¡n nh├ón vi├¬n mß╗¢i',tags:['Mß╗¢i'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-OFFBOARD',name:'Offboarding',type:'Operation',cat:'Nhan su',nameVi:'Offboarding',descVi:'Nghß╗ë viß╗çc v├á b├án giao c├┤ng viß╗çc',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false},
  {id:'P-SALARY',name:'Dieu chinh luong',type:'Finance',cat:'Nhan su',nameVi:'─Éiß╗üu chß╗ënh l╞░╞íng',descVi:'─Éß╗ü xuß║Ñt ─æiß╗üu chß╗ënh l╞░╞íng, th╞░ß╗ƒng',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-STATION',name:'Mua VPP',type:'Operation',cat:'Hanh chinh',nameVi:'Mua v─ân ph├▓ng phß║⌐m',descVi:'─Éß╗ü xuß║Ñt mua sß║»m v─ân ph├▓ng phß║⌐m',tags:['Phß╗ò biß║┐n'],elements:'EXPENSE',sla:2,checked:false},
  {id:'P-ASSET',name:'Cap phat TS',type:'Operation',cat:'Hanh chinh',nameVi:'Cß║Ñp ph├ít t├ái sß║ún',descVi:'Y├¬u cß║ºu cß║Ñp ph├ít thiß║┐t bß╗ï, t├ái sß║ún c├┤ng ty',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-VEHICLE',name:'Dat xe',type:'Operation',cat:'Hanh chinh',nameVi:'─Éß║╖t xe / Di chuyß╗ân',descVi:'─Éß║╖t xe c├┤ng t├íc, di chuyß╗ân nß╗Öi bß╗Ö',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-ADVANCE',name:'Tam ung',type:'Finance',cat:'Tai chinh',nameVi:'─Éß╗ü nghß╗ï tß║ím ß╗⌐ng',descVi:'Tß║ím ß╗⌐ng c├┤ng t├íc ph├¡ v├á ho├án ß╗⌐ng chß╗⌐ng tß╗½',tags:['Phß╗ò biß║┐n'],elements:'EXPENSE',sla:2,checked:true},
  {id:'P-PAYMENT',name:'Thanh toan',type:'Finance',cat:'Tai chinh',nameVi:'Thanh to├ín chi ph├¡',descVi:'Ph├¬ duyß╗çt thanh to├ín h├│a ─æ╞ín, chi ph├¡ ph├ít sinh',tags:['Phß╗ò biß║┐n'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-BUDGET',name:'Ngan sach',type:'Finance',cat:'Tai chinh',nameVi:'─Éß╗ü xuß║Ñt ng├ón s├ích',descVi:'Lß║¡p v├á ph├¬ duyß╗çt ng├ón s├ích dß╗▒ ├ín, ph├▓ng ban',tags:[],elements:'EXPENSE',sla:5,checked:false},
  {id:'P-CONTRACT',name:'Hop dong',type:'Finance',cat:'Tai chinh',nameVi:'K├╜ kß║┐t hß╗úp ─æß╗ông',descVi:'Ph├¬ duyß╗çt v├á k├╜ kß║┐t hß╗úp ─æß╗ông kinh tß║┐',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-IT-ACC',name:'Tai khoan IT',type:'Technical',cat:'CNTT',nameVi:'Cß║Ñp t├ái khoß║ún IT',descVi:'Y├¬u cß║ºu cß║Ñp t├ái khoß║ún phß║ºn mß╗üm, hß╗ç thß╗æng',tags:['Mß╗¢i'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-IT-ISSUE',name:'Bao loi',type:'Technical',cat:'CNTT',nameVi:'B├ío lß╗ùi hß╗ç thß╗æng',descVi:'B├ío c├ío sß╗▒ cß╗æ kß╗╣ thuß║¡t v├á xß╗¡ l├╜',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-PURCHASE',name:'Mua hang',type:'Operation',cat:'Mua hang',nameVi:'─Éß╗ü nghß╗ï mua h├áng',descVi:'─Éß╗ü xuß║Ñt v├á ph├¬ duyß╗çt mua sß║»m vß║¡t t╞░, thiß║┐t bß╗ï',tags:['Phß╗ò biß║┐n'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-DEAL',name:'Bao gia',type:'Sale and MKT',cat:'Kinh doanh',nameVi:'Ph├¬ duyß╗çt b├ío gi├í',descVi:'Ph├¬ duyß╗çt b├ío gi├í, ─æß╗ü xuß║Ñt th╞░╞íng mß║íi',tags:['Phß╗ò biß║┐n'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-WFH',name:'WFH',type:'Operation',cat:'Khac',nameVi:'L├ám viß╗çc tß╗½ xa (WFH)',descVi:'Xin ph├⌐p l├ám viß╗çc tß║íi nh├á / tß╗½ xa',tags:['Mß╗¢i'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-OT',name:'Tang ca',type:'Operation',cat:'Khac',nameVi:'T─âng ca / L├ám th├¬m giß╗¥',descVi:'─É─âng k├╜ v├á ph├¬ duyß╗çt l├ám th├¬m giß╗¥',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-BUSINESS',name:'Cong tac',type:'Operation',cat:'Khac',nameVi:'C├┤ng t├íc / Xuß║Ñt ngoß║íi',descVi:'Ph├¬ duyß╗çt c├┤ng t├íc, ─æi n╞░ß╗¢c ngo├ái',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false}
];
const STEP4_CATS=[{key:'all',label:'Tß║Ñt cß║ú',count:19},{key:'Nhan su',label:'Nh├ón sß╗▒',count:5},{key:'Hanh chinh',label:'H├ánh ch├¡nh',count:3},{key:'Tai chinh',label:'T├ái ch├¡nh',count:4},{key:'CNTT',label:'CNTT',count:2},{key:'Mua hang',label:'Mua h├áng',count:1},{key:'Kinh doanh',label:'Kinh doanh',count:1},{key:'Khac',label:'Kh├íc',count:3}];
const P_CAT_ICONS={'Nhan su':'group','Hanh chinh':'admin_panel_settings','Tai chinh':'account_balance','CNTT':'computer','Mua hang':'shopping_cart','Kinh doanh':'trending_up','Khac':'more_horiz','all':'apps'};
const P_CAT_COLORS={'Nhan su':'#2563EB','Hanh chinh':'#EA580C','Tai chinh':'#059669','CNTT':'#0284C7','Mua hang':'#DB2777','Kinh doanh':'#D97706','Khac':'#7C3AED','all':'#374151'};
const P_CAT_BGS={'Nhan su':'#EFF6FF','Hanh chinh':'#FFF7ED','Tai chinh':'#ECFDF5','CNTT':'#F0F9FF','Mua hang':'#FDF2F8','Kinh doanh':'#FFFBEB','Khac':'#F5F3FF','all':'#F3F4F6'};
const P_TAG_STYLES={'Phß╗ò biß║┐n':{bg:'#FFF7ED',color:'#EA580C',border:'#FED7AA'},'Mß╗¢i':{bg:'#ECFDF5',color:'#059669',border:'#A7F3D0'}};
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
    if(!pCards)pCards='<div style="grid-column:span 3;text-align:center;padding:30px;color:#9CA3AF;font-size:13px;">Kh├┤ng t├¼m thß║Ñy quy tr├¼nh ph├╣ hß╗úp</div>';
    tc='<div style="display:flex;gap:16px;">'
      +'<div style="width:155px;flex-shrink:0;"><div style="font-size:10px;font-weight:700;color:#9CA3AF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Danh mß╗Ñc</div><div style="display:flex;flex-direction:column;gap:2px;">'+catBtns+'</div></div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="position:relative;margin-bottom:14px;"><span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:#9CA3AF;">search</span><input type="text" value="'+escapeHTML(window.setupStep4Search||'')+'" oninput="window.setStep4Search(this.value)" placeholder="T├¼m kiß║┐m quy tr├¼nh..." class="sw-input" style="padding-left:36px;"></div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">'+pCards+'</div>'
      +'</div></div>';
  } else if(tab==='create'){
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:16px;">Tß╗▒ ─æß╗ïnh ngh─⌐a quy tr├¼nh theo nhu cß║ºu ri├¬ng cß╗ºa doanh nghiß╗çp.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="grid-column:span 2;">'+swLabel('T├¬n quy tr├¼nh',true)+swInput('new_policy_name','VD: Quy tr├¼nh ph├¬ duyß╗çt hß╗úp ─æß╗ông dß╗ïch vß╗Ñ','')+'</div><div>'+swLabel('Loß║íi',false)+'<select id="new_policy_type" class="sw-select"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select></div><div>'+swLabel('SLA (ng├áy)',false)+'<input id="new_policy_sla" type="number" class="sw-input" min="1" value="3"></div><div style="grid-column:span 2;">'+swLabel('M├┤ tß║ú',false)+'<textarea id="new_policy_desc" class="sw-input" rows="3" style="resize:vertical;" placeholder="M├┤ tß║ú ngß║»n gß╗ìn vß╗ü mß╗Ñc ─æ├¡ch quy tr├¼nh..."></textarea></div></div><div class="sw-info-box" style="margin-top:12px;"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;">info</span> Ph├¬ duyß╗çt mß║╖c ─æß╗ïnh: <strong>Quß║ún l├╜ trß╗▒c tiß║┐p (Tier 1)</strong> ΓÇö c├│ thß╗â t├╣y chß╗ënh sau khi tß║ío.</div></div>';
  } else if(tab==='excel'){
    tc='<div class="sw-upload-zone"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:5px;">K├⌐o &amp; Thß║ú file Excel v├áo ─æ├óy</div><div style="display:flex;gap:12px;justify-content:center;margin-top:14px;"><button onclick="downloadSetupTemplate(\'policy\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tß║úi mß║½u</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chß╗ìn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'policy\')"></label></div></div>';
  } else {
    tc='<div><p style="font-size:12px;color:#6B7280;margin-bottom:14px;">Hiß╗çn c├│ <strong style="color:#16a34a;">'+(counts.policy_and_program||0)+'</strong> quy tr├¼nh ─æ├ú thiß║┐t lß║¡p.</p>'+(counts.policy_and_program>0?'<div style="padding:20px;text-align:center;background:#ECFDF5;border-radius:12px;border:1px solid #A7F3D0;"><span class="material-symbols-rounded" style="font-size:40px;color:#059669;">task_alt</span><div style="margin-top:8px;font-size:13px;color:#111827;font-weight:600;">─É├ú c├│ '+counts.policy_and_program+' quy tr├¼nh</div></div>':'<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px;">Ch╞░a c├│ quy tr├¼nh n├áo. H├úy chß╗ìn tß╗½ th╞░ viß╗çn mß║½u.</div>')+'</div>';
  }
  return '<div class="sw-card">'+swStepHeader('policy',4,'Thiß║┐t lß║¡p quy tr├¼nh','Chß╗ìn quy tr├¼nh mß║½u ph├╣ hß╗úp hoß║╖c tß╗▒ tß║ío theo nhu cß║ºu doanh nghiß╗çp.')+swTabBar([{key:'library',label:'Chß╗ìn tß╗½ th╞░ viß╗çn mß║½u'},{key:'create',label:'Tß║ío quy tr├¼nh mß╗¢i'},{key:'excel',label:'Nhß║¡p tß╗½ Excel'},{key:'manage',label:'Quß║ún l├╜'}],tab,'window.switchStep4Tab')+tc+swBottomNav(3,5,'Tß║ío c├íc quy tr├¼nh ─æ├ú chß╗ìn','saveStep4AndAdvance()')+'</div>';
}
window.saveStep4AndAdvance=async function(){const tab=window.setupStep4ActiveTab;if(tab==='create'){const name=document.getElementById('new_policy_name')?.value?.trim();if(!name){showToast('Vui l├▓ng nhß║¡p t├¬n quy tr├¼nh','warning');return;}const p=[{policy_name:name,policy_type:document.getElementById('new_policy_type')?.value||'Operation',description:document.getElementById('new_policy_desc')?.value?.trim()||name,elements:'ASSIGN_TASK',sla:parseInt(document.getElementById('new_policy_sla')?.value)||3}];try{const res=await apiPost('/system-setup/presets/policies',{policies:p});if(res.success){showToast('─É├ú tß║ío quy tr├¼nh "'+name+'"!','success');window.setupCurrentStep=5;await renderSetupContent(true);}else showToast(res.error||'Lß╗ùi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}return;}const cbs=document.querySelectorAll('input[name="preset_policy"]:checked'),sels=Array.from(cbs).map(c=>c.value);if(!sels.length){window.setSetupStep(5);return;}const payload=PRESET_POLICIES_FULL.filter(p=>sels.includes(p.id)).map(p=>({policy_name:p.name,policy_type:p.type,description:p.descVi||p.name,elements:p.elements,sla:p.sla}));try{showToast('─Éang khß╗ƒi tß║ío '+payload.length+' quy tr├¼nh...','info');const res=await apiPost('/system-setup/presets/policies',{policies:payload});if(res.success){showToast('─É├ú tß║ío '+res.count+' quy tr├¼nh!','success');window.setupCurrentStep=5;await renderSetupContent(true);}else showToast(res.error||'Lß╗ùi','error');}catch(err){showToast('Lß╗ùi: '+err.message,'error');}};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 5: T├ÇI KHOß║óN TIß╗ÇN
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function renderStep5HTML(comp,counts){
  const cur=comp.base_currency||'VND';
  const banks=['Vietcombank','Vietinbank','BIDV','Techcombank','MB Bank','ACB','Agribank','TPBank','VPBank','OCB','SHB','HDBank','MSB','VIB','SeABank'];
  let bopts='<option value="">-- Chß╗ìn ng├ón h├áng --</option>';for(const b of banks)bopts+='<option value="'+b+'">'+b+'</option>';
  const acctInfo=counts.account>0?'<div style="padding:12px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:16px;font-size:12px;color:#374151;"><span class="material-symbols-rounded" style="font-size:14px;color:#059669;vertical-align:middle;">check_circle</span> Hiß╗çn c├│ <strong style="color:#059669;">'+counts.account+'</strong> t├ái khoß║ún ─æ├ú thiß║┐t lß║¡p.</div>':'';
  return '<div class="sw-card">'
    +swStepHeader('account_balance',5,'T├ái khoß║ún ng├ón h├áng & Quß╗╣ tiß╗ün mß║╖t','Thiß║┐t lß║¡p t├ái khoß║ún thanh to├ín ─æß╗â quß║ún l├╜ d├▓ng tiß╗ün thu chi.')
    +'<form id="form-step5" onsubmit="event.preventDefault();saveStep5AndAdvance();">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">'
    +'<div style="grid-column:span 2;">'+swLabel('T├¬n t├ái khoß║ún giao dß╗ïch',false)+swInput('step5_account_name','VD: T├ái khoß║ún ch├¡nh Vietcombank','')+'</div>'
    +'<div>'+swLabel('Ng├ón h├áng',false)+'<select id="step5_bank_name" class="sw-select">'+bopts+'</select></div>'
    +'<div>'+swLabel('Sß╗æ t├ái khoß║ún',false)+swInput('step5_account_number','VD: 0011001234567','')+'</div>'
    +'<div>'+swLabel('Loß║íi tiß╗ün tß╗ç',false)+'<input type="text" id="step5_currency" readonly class="sw-input" style="background:#F9FAFB;color:#9CA3AF;" value="'+cur+'"></div>'
    +'</div>'+acctInfo
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;">'
    +'<button type="button" class="sw-btn-back" onclick="window.setSetupStep(4)"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lß║íi</button>'
    +'<div style="display:flex;gap:10px;align-items:center;"><button type="button" class="sw-btn-ghost" onclick="window.setSetupStep(6)">Bß╗Å qua b╞░ß╗¢c n├áy</button><button type="submit" class="sw-btn-primary"><span>L╞░u v├á xem tß╗òng kß║┐t</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button></div>'
    +'</div></form></div>';
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  STEP 6: SUCCESS SCREEN
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function renderStep6HTML(counts,comp){
  const name=escapeHTML(comp.company_fullname||comp.company_shortname||'TeraX');
  const summary=[{label:'Th├┤ng tin c├┤ng ty',val:counts.my_company||0,unit:'c├┤ng ty',color:'#EA580C',bg:'#FFF7ED',done:counts.my_company>0},{label:'Ph├▓ng ban',val:counts.department||0,unit:'ph├▓ng ban',color:'#2563EB',bg:'#EFF6FF',done:counts.department>0},{label:'Nh├ón vi├¬n',val:counts.employee||0,unit:'nh├ón vi├¬n',color:'#059669',bg:'#ECFDF5',done:counts.employee>0},{label:'Quy tr├¼nh',val:counts.policy_and_program||0,unit:'quy tr├¼nh',color:'#7C3AED',bg:'#F5F3FF',done:counts.policy_and_program>0},{label:'T├ái khoß║ún tiß╗ün',val:counts.account||0,unit:'t├ái khoß║ún',color:'#D97706',bg:'#FFFBEB',done:counts.account>0}];
  let sumCards='';for(const s of summary)sumCards+='<div style="padding:14px 12px;border-radius:12px;background:'+(s.done?s.bg:'#F9FAFB')+';border:1px solid '+(s.done?'rgba(0,0,0,0.06)':'#E5E7EB')+';text-align:center;"><div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;">'+(s.done?'<span class="material-symbols-rounded" style="font-size:14px;color:#059669;">check_circle</span><span style="font-size:11px;font-weight:600;color:#059669;">Ho├án th├ánh</span>':'<span class="material-symbols-rounded" style="font-size:14px;color:#D1D5DB;">radio_button_unchecked</span><span style="font-size:11px;font-weight:600;color:#9CA3AF;">Ch╞░a thiß║┐t lß║¡p</span>')+'</div><div style="font-size:22px;font-weight:800;color:'+(s.done?s.color:'#D1D5DB')+';">'+s.val+'</div><div style="font-size:11px;color:'+(s.done?'#374151':'#9CA3AF')+';">'+s.unit+'</div><div style="font-size:10px;color:#9CA3AF;margin-top:2px;">'+s.label+'</div></div>';
  const qas=[{icon:'post_add',color:'#EA580C',bg:'#FFF7ED',title:'Tß║ío y├¬u cß║ºu ─æß║ºu ti├¬n',desc:'Trß║úi nghiß╗çm quy tr├¼nh ph├¬ duyß╗çt v├á xß╗¡ l├╜.',action:'request',btn:'Tß║ío y├¬u cß║ºu'},{icon:'task_alt',color:'#2563EB',bg:'#EFF6FF',title:'Giao nhiß╗çm vß╗Ñ',desc:'Ph├ón c├┤ng c├┤ng viß╗çc v├á theo d├╡i tiß║┐n ─æß╗Ö.',action:'assigned_task',btn:'Tß║ío nhiß╗çm vß╗Ñ'},{icon:'bar_chart',color:'#059669',bg:'#ECFDF5',title:'Xem b├ío c├ío',desc:'Kh├ím ph├í c├íc b├ío c├ío quß║ún trß╗ï.',action:'home',btn:'Xem b├ío c├ío'},{icon:'badge',color:'#7C3AED',bg:'#F5F3FF',title:'Quß║ún l├╜ nh├ón sß╗▒',desc:'Cß║¡p nhß║¡t th├┤ng tin nh├ón vi├¬n, ph├▓ng ban.',action:'employee',btn:'Xem danh s├ích'}];
  let qaCards='';for(const q of qas)qaCards+='<div style="padding:16px;border-radius:14px;background:white;border:1px solid #E5E7EB;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,0.05);"><div style="width:38px;height:38px;border-radius:10px;background:'+q.bg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:20px;color:'+q.color+';">'+q.icon+'</span></div><div style="font-size:13px;font-weight:700;color:#111827;">'+q.title+'</div><div style="font-size:11.5px;color:#6B7280;line-height:1.4;flex:1;">'+q.desc+'</div><button onclick="completeSetupWizard(\''+q.action+'\')" style="width:100%;padding:8px;border-radius:9px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:var(--transition);">'+q.btn+'</button></div>';
  const resources=[{icon:'menu_book',color:'#2563EB',title:'H╞░ß╗¢ng dß║½n sß╗¡ dß╗Ñng',desc:'T├¼m hiß╗âu c├íc t├¡nh n─âng c╞í bß║ún'},{icon:'play_circle',color:'#EA580C',title:'Video h╞░ß╗¢ng dß║½n',desc:'Xem video thao t├íc chi tiß║┐t'},{icon:'table_chart',color:'#059669',title:'Th╞░ viß╗çn quy tr├¼nh mß║½u',desc:'Tham khß║úo c├íc quy tr├¼nh phß╗ò biß║┐n'},{icon:'help',color:'#7C3AED',title:'C├óu hß╗Åi th╞░ß╗¥ng gß║╖p',desc:'Giß║úi ─æ├íp c├íc thß║»c mß║»c'}];
  let resItems='';for(const r of resources)resItems+='<button style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;width:100%;transition:var(--transition);" onmouseover="this.style.background=\'#F9FAFB\'" onmouseout="this.style.background=\'transparent\'"><div style="width:34px;height:34px;border-radius:9px;background:#F3F4F6;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:18px;color:'+r.color+';">'+r.icon+'</span></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+r.title+'</div><div style="font-size:10.5px;color:#9CA3AF;">'+r.desc+'</div></div><span class="material-symbols-rounded" style="font-size:15px;color:#D1D5DB;flex-shrink:0;">chevron_right</span></button>';
  return '<div style="display:flex;gap:20px;align-items:flex-start;">'
    // Hero
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;">'
    +'<div style="background:linear-gradient(135deg,#1E3A5F,#1D4ED8);border-radius:18px;padding:32px;color:white;overflow:hidden;position:relative;">'
    +'<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.08),transparent 70%);pointer-events:none;"></div>'
    +'<div style="display:flex;align-items:center;gap:24px;"><div style="flex:1;">'
    +'<div style="font-size:13px;color:#FCD34D;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px;"><span>≡ƒÄë</span> Ho├án tß║Ñt thiß║┐t lß║¡p!</div>'
    +'<h2 style="font-size:24px;font-weight:800;color:white;margin-bottom:10px;">TeraX ─æ├ú sß║╡n s├áng ─æß╗â sß╗¡ dß╗Ñng</h2>'
    +'<p style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:20px;">M├┤i tr╞░ß╗¥ng l├ám viß╗çc cß╗ºa <strong style="color:white;">'+name+'</strong> ─æ├ú ─æ╞░ß╗úc thiß║┐t lß║¡p. H├úy bß║»t ─æß║ºu kh├ím ph├í TeraX.</p>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;"><button onclick="completeSetupWizard()" class="sw-btn-primary" style="background:linear-gradient(135deg,#f97316,#ea580c);"><span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span> V├áo hß╗ç thß╗æng ngay</button>'
    +'<button style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.3);background:transparent;color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">play_circle</span> Xem h╞░ß╗¢ng dß║½n nhanh</button>'
    +'</div></div>'
    +'<div style="width:100px;flex-shrink:0;text-align:center;"><div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="material-symbols-rounded" style="font-size:48px;color:#FCD34D;">verified</span></div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:8px;">C├╣ng TeraX vß║¡n h├ánh tß╗æt h╞ín</div></div>'
    +'</div></div>'
    // Summary
    +'<div class="sw-card">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#111827;">Tß╗òng quan thiß║┐t lß║¡p</div><button onclick="window.setSetupStep(1)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">settings</span> Chß╗ënh sß╗¡a</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'+sumCards+'</div>'
    +'</div>'
    // Quick actions
    +'<div><div style="font-size:13px;font-weight:700;color:#F8FAFC;margin-bottom:12px;">Bß║»t ─æß║ºu vß╗¢i TeraX</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">'+qaCards+'</div></div>'
    +'</div>'
    // Right sidebar
    +'<div style="width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">'
    +'<div class="sw-card"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:12px;">T├ái nguy├¬n hß╗»u ├¡ch</div><div style="display:flex;flex-direction:column;gap:2px;">'+resItems+'</div></div>'
    +'<div class="sw-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div style="width:34px;height:34px;border-radius:50%;background:#FFF7ED;border:1px solid #FED7AA;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div><div><div style="font-size:12px;font-weight:700;color:#111827;">Bß║ín cß║ºn hß╗ù trß╗ú?</div><div style="font-size:10.5px;color:#6B7280;">─Éß╗Öi ng┼⌐ TeraX lu├┤n sß║╡n s├áng.</div></div></div><button class="sw-btn-primary" style="width:100%;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> Li├¬n hß╗ç hß╗ù trß╗ú</button></div>'
    +'<div class="sw-card" style="background:rgba(255,255,255,0.7);"><div style="font-size:11.5px;color:#6B7280;line-height:1.6;font-style:italic;margin-bottom:10px;">"Cß║úm ╞ín bß║ín ─æ├ú tin t╞░ß╗ƒng TeraX. Ch├║ng t├┤i cam kß║┐t tiß║┐p tß╗Ñc ─æß╗ông h├ánh ─æß╗â doanh nghiß╗çp cß╗ºa bß║ín vß║¡n h├ánh hiß╗çu quß║ú v├á ph├ít triß╗ân bß╗ün vß╗»ng."</div><div style="font-size:11px;color:#9CA3AF;font-weight:600;">ΓÇö ─Éß╗Öi ng┼⌐ TeraX</div></div>'
    +'</div></div>';
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//  SYSTEM CONTROLS
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
window.completeSetupWizard=async function(redirectTo){try{showToast('─Éang k├¡ch hoß║ít hß╗ç thß╗æng...','info');const res=await apiPost('/system-setup/complete');if(res.success){showToast('K├¡ch hoß║ít th├ánh c├┤ng!','success');window.setupCompleted=true;document.body.classList.remove('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='none';window.location.hash=redirectTo||'home';}else showToast('Lß╗ùi: '+(res.message||'Unknown'),'error');}catch(err){showToast('Lß╗ùi server: '+err.message,'error');}};
window.resetSetupStatusDev=async function(){if(!confirm('Kh├┤i phß╗Ñc lß║íi chß║┐ ─æß╗Ö Setup?'))return;try{const res=await apiPost('/system-setup/reset');if(res.success){showToast('─É├ú kh├┤i phß╗Ñc.','success');window.setupCompleted=false;window.setupCurrentStep=1;document.body.classList.add('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='flex';window.location.hash='setup';await renderSetupContent();}}catch(err){showToast('Lß╗ùi: '+err.message,'error');}};
window.downloadSetupTemplate=function(moduleKey){const mod=(typeof MODULES!=='undefined')?MODULES[moduleKey]:null;if(!mod){showToast('Kh├┤ng t├¼m thß║Ñy cß║Ñu h├¼nh mß║½u.','warning');return;}const headers=mod.fields.filter(f=>!f.section&&f.key&&f.type!=='file'&&!f.hidden).map(f=>f.key);if(!headers.length){showToast('Kh├┤ng t├¼m thß║Ñy tr╞░ß╗¥ng.','warning');return;}const ws=XLSX.utils.json_to_sheet([{}],{header:headers});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,(mod.label||moduleKey).substring(0,30));XLSX.writeFile(wb,moduleKey+'_template.xlsx');showToast('─É├ú tß║úi xuß╗æng mß║½u.','success');};
window.importSetupFile=async function(event,moduleKey){const file=event.target.files[0];if(!file)return;showToast('─Éang ph├ón t├¡ch...','info');const r=new FileReader();r.onload=async(e)=>{try{const data=new Uint8Array(e.target.result),wb=XLSX.read(data,{type:'array'}),jd=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!jd.length){showToast('Tß╗çp trß╗æng.','warning');return;}const tn=moduleKey==='policy'?'policy_and_program':moduleKey;const res=await apiPost('/table/'+tn+'/bulk',jd);showToast(res.message||'Nhß║¡p th├ánh c├┤ng!','success');await renderSetupContent();}catch(err){showToast('Tß║úi l├¬n thß║Ñt bß║íi: '+err.message,'error');}finally{event.target.value='';}};r.readAsArrayBuffer(file);};
