/**
 * TeraX – Setup Wizard (Redesigned)
 * 5-Step Onboarding + Completion Screen
 * Layout: 3-col stepper + main + right progress sidebar
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedEmployees = [];
window.setupStep2ActiveTab = 'choose';
window.setupStep3ActiveTab = 'excel';
window.setupStep4ActiveTab = 'library';
window.setupStep4Category = 'all';
window.setupStep4Search = '';

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
  await renderSetupContent();
};

window.renderSetupContent = async function () {
  const contentEl = document.getElementById('content');
  if (!contentEl) return;
  contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:white;"><div class="spinner" style="margin:0 auto 12px;"></div> Đang tải thông tin thiết lập...</div>';
  try {
    const [statusRes, dataRes] = await Promise.all([apiGet('/system-setup/status'), apiGet('/system-setup/data')]);
    window.setupCompleted = statusRes.setupCompleted;
    window.setupTableCounts = statusRes.tableCounts || {};
    window.setupWizardData = dataRes || {};
  } catch (err) {
    contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--accent-red);"><span class="material-symbols-rounded" style="font-size:43px;">error</span><div style="font-size:14px;font-weight:600;margin-top:10px;">Lỗi tải dữ liệu</div></div>';
    return;
  }
  const counts = window.setupTableCounts || {};
  const comp = window.setupWizardData.company || {};
  const currentStep = window.setupCurrentStep || 1;
  const stepDone = [counts.my_company>0, counts.department>0, counts.employee>0, counts.policy_and_program>0, counts.account>0];
  const completedCount = stepDone.filter(Boolean).length;
  const pct = Math.round((completedCount/5)*100);
  const stepLabels = ['Thông tin công ty','Phòng ban','Nhân viên','Quy trình','Tài khoản tiền','Bắt đầu sử dụng'];
  const stepIcons  = ['apartment','account_tree','group','account_tree','account_balance','rocket_launch'];

  // ── Stepper ──
  let stepperHtml = '<div style="display:flex;align-items:center;margin-bottom:28px;padding:0 4px;">';
  for (let i = 0; i < 6; i++) {
    const num = i+1;
    const isActive = num === currentStep;
    const isDone   = num < currentStep || (num < 6 && stepDone[i]);
    const bg   = isDone ? '#22c55e' : isActive ? '#f97316' : 'rgba(255,255,255,0.1)';
    const bdr  = isDone ? '#22c55e' : isActive ? '#f97316' : 'rgba(255,255,255,0.2)';
    const lc   = isActive ? 'white' : isDone ? '#22c55e' : 'rgba(255,255,255,0.45)';
    const lnc  = isDone ? '#f97316' : 'rgba(255,255,255,0.12)';
    const inner= (isDone&&!isActive) ? '<span class="material-symbols-rounded" style="font-size:18px;">check</span>' : num;
    stepperHtml += '<div style="display:flex;align-items:center;flex:'+(i<5?'1':'0')+';">';
    stepperHtml += '<div onclick="window.setSetupStep('+num+')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;gap:5px;min-width:56px;">';
    stepperHtml += '<div style="width:34px;height:34px;border-radius:50%;background:'+bg+';border:2px solid '+bdr+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;transition:var(--transition);flex-shrink:0;">'+inner+'</div>';
    stepperHtml += '<div style="font-size:10.5px;font-weight:'+(isActive?'700':'500')+';color:'+lc+';text-align:center;white-space:nowrap;">'+stepLabels[i]+'</div></div>';
    if (i < 5) stepperHtml += '<div style="flex:1;height:2px;background:'+lnc+';margin:0 4px;margin-bottom:18px;border-radius:2px;"></div>';
    stepperHtml += '</div>';
  }
  stepperHtml += '</div>';

  // ── Right Sidebar ──
  let stepList = '';
  const sideLabels = ['Thông tin công ty','Phòng ban','Nhân viên','Quy trình','Tài khoản tiền'];
  for (let i = 0; i < 5; i++) {
    const num = i+1;
    const done = stepDone[i];
    const isAct = num === currentStep;
    const stText = done ? 'Đã hoàn thành' : isAct ? 'Đang thực hiện' : 'Chưa thiết lập';
    const stColor = done ? '#22c55e' : isAct ? '#f97316' : 'rgba(255,255,255,0.35)';
    const cirBg = done ? '#22c55e' : isAct ? '#f97316' : 'rgba(255,255,255,0.12)';
    const cirInner = done ? '<span class="material-symbols-rounded" style="font-size:13px;">check</span>' : num;
    stepList += '<div onclick="window.setSetupStep('+num+')" style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;cursor:pointer;background:'+(isAct?'rgba(249,115,22,0.1)':'transparent')+';border-left:'+(isAct?'3px solid #f97316':'3px solid transparent')+';transition:var(--transition);">';
    stepList += '<div style="width:22px;height:22px;border-radius:50%;background:'+cirBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:white;">'+cirInner+'</div>';
    stepList += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:white;">'+sideLabels[i]+'</div><div style="font-size:10.5px;color:'+stColor+';font-weight:500;">'+stText+'</div></div></div>';
  }
  const tipsVi = ['Bạn có thể chọn mẫu có sẵn để tiết kiệm thời gian','Không cần tạo tất cả ngay, có thể bổ sung sau','Sau khi tạo, bạn có thể chỉnh sửa bất kỳ lúc nào','Quy trình nên sử dụng vai trò thay vì chỉ định người cụ thể'];
  let tipsHtml = '';
  for (const tip of tipsVi) {
    tipsHtml += '<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:rgba(255,255,255,0.6);line-height:1.4;"><span class="material-symbols-rounded" style="font-size:13px;color:#22c55e;flex-shrink:0;margin-top:1px;">check_circle</span><span>'+tip+'</span></div>';
  }
  const descText = completedCount < 5 ? 'Bạn đang đi đúng hướng!<br>Hoàn thành thêm '+(5-completedCount)+' bước nữa<br>để bắt đầu sử dụng TeraX.' : 'Tuyệt vời! Đã sẵn sàng sử dụng TeraX.';
  const progressSidebar = '<div style="width:270px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">'
    + '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:18px;color:white;">'
    + '<div style="font-size:13px;font-weight:700;color:white;margin-bottom:14px;">Tiến độ thiết lập</div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">'
    + '<div style="position:relative;width:72px;height:72px;flex-shrink:0;">'
    + '<svg viewBox="0 0 36 36" style="width:72px;height:72px;transform:rotate(-90deg)">'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>'
    + '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="'+pct+' '+(100-pct)+'" stroke-linecap="round"/>'
    + '</svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:white;">'+pct+'%</div></div>'
    + '<div><div style="font-size:13px;font-weight:700;color:white;">Đã hoàn thành '+completedCount+'/5 bước</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;line-height:1.5;">'+descText+'</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;">'+stepList+'</div></div>'
    + '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;color:white;">'
    + '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><span class="material-symbols-rounded" style="font-size:17px;color:#fbbf24;">lightbulb</span><span style="font-size:12px;font-weight:700;color:white;">Mẹo hữu ích</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:6px;">'+tipsHtml+'</div></div>'
    + '<div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:14px;padding:14px;cursor:pointer;">'
    + '<div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="font-size:18px;color:#38bdf8;">menu_book</span>'
    + '<div><div style="font-size:12px;font-weight:700;color:white;">Tài liệu hướng dẫn</div>'
    + '<div style="font-size:10.5px;color:rgba(255,255,255,0.5);margin-top:2px;">Xem hướng dẫn chi tiết <span style="color:#38bdf8;">↗</span></div></div></div></div>'
    + '</div>';

  const supportWidget = '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;color:white;margin-top:16px;">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
    + '<div style="width:30px;height:30px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:17px;color:#f97316;">headset_mic</span></div>'
    + '<div><div style="font-size:12px;font-weight:700;">Cần hỗ trợ?</div><div style="font-size:10.5px;color:rgba(255,255,255,0.5);">Đội ngũ TeraX luôn sẵn sàng hỗ trợ</div></div></div>'
    + '<button style="width:100%;padding:8px;border-radius:10px;border:1.5px solid #f97316;background:transparent;color:#f97316;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">'
    + '<span class="material-symbols-rounded" style="font-size:15px;">chat</span> Liên hệ hỗ trợ</button></div>';

  const mainBodyHTML = currentStep === 6
    ? renderStep6HTML(counts, comp)
    : renderCurrentStepHTML(currentStep, comp, window.setupWizardData.admin || {}, counts);

  contentEl.innerHTML = '<div class="detail-scroll" style="max-width:1280px;margin:0 auto;width:100%;padding:24px 20px 60px;">'
    + '<div style="margin-bottom:20px;">'
    + '<h2 style="font-size:22px;font-weight:800;color:white;margin-bottom:4px;">Thiết lập TeraX cho doanh nghiệp của bạn</h2>'
    + '<p style="font-size:13px;color:rgba(255,255,255,0.55);">Chỉ vài bước đơn giản để bắt đầu. Bạn có thể bỏ qua các bước không cần thiết và bổ sung sau.</p></div>'
    + '<div style="display:flex;gap:20px;align-items:flex-start;">'
    + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;">'
    + '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px 24px 10px;">'+stepperHtml+'</div>'
    + '<div id="setup-step-container" style="margin-top:16px;">'+mainBodyHTML+'</div>'
    + supportWidget + '</div>'
    + (currentStep < 6 ? progressSidebar : '')
    + '</div></div>';
};

window.setSetupStep = function (stepNum) { window.setupCurrentStep = Math.max(1,Math.min(6,stepNum)); renderSetupContent(); };

function renderCurrentStepHTML(step, comp, admin, counts) {
  switch(step){case 1:return renderStep1HTML(comp);case 2:return renderStep2HTML(counts);case 3:return renderStep3HTML(counts);case 4:return renderStep4HTML(counts);case 5:return renderStep5HTML(comp,counts);default:return renderStep1HTML(comp);}
}

// Helpers
function cardShell(c){return '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;color:white;backdrop-filter:blur(10px);">'+c+'</div>';}
function stepHeader(icon,num,title,sub){return '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);"><div style="display:flex;align-items:center;gap:12px;"><div style="width:44px;height:44px;border-radius:12px;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:22px;color:#f97316;">'+icon+'</span></div><div><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:2px;">Bước '+num+'/5</div><h3 style="font-size:17px;font-weight:800;color:white;margin-bottom:3px;">'+title+'</h3><p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">'+sub+'</p></div></div><button style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.8);font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">play_circle</span> Hướng dẫn</button></div>';}
function makeTabBar(tabs, activeKey, fn){let h='<div style="display:flex;gap:2px;background:rgba(0,0,0,0.2);border-radius:10px;padding:3px;margin-bottom:20px;">';for(const t of tabs){h+='<button onclick="'+fn+'(\''+t.key+'\')" style="flex:1;padding:8px 12px;border-radius:8px;border:none;font-size:12.5px;font-weight:600;cursor:pointer;transition:var(--transition);background:'+(activeKey===t.key?'rgba(249,115,22,0.2)':'transparent')+';color:'+(activeKey===t.key?'#f97316':'rgba(255,255,255,0.5)')+';">'+t.label+'</button>';}h+='</div>';return h;}
function bottomNav(back,skip,label,action){return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);"><button onclick="window.setSetupStep('+back+')" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lại</button><div style="display:flex;gap:10px;align-items:center;"><button onclick="window.setSetupStep('+skip+')" style="padding:9px 14px;border:none;background:transparent;color:rgba(255,255,255,0.45);font-size:12.5px;cursor:pointer;">Bỏ qua bước này</button><button onclick="'+action+'" style="display:flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,0.35);"><span>'+label+'</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button></div></div>';}
function fmtInput(id,ph,val){return '<input type="text" id="'+id+'" class="form-input" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;" placeholder="'+ph+'" value="'+(val||'')+'">';}
function fmtLabel(text,req){return '<label style="font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.7);display:block;margin-bottom:5px;">'+text+(req?' <span style="color:#ef4444;">*</span>':'')+'</label>';}

// ── STEP 1 ──
function renderStep1HTML(comp){
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Ho_Chi_Minh';
  const curs=['VND','USD','EUR','SGD','JPY','CNY','THB','GBP','AUD','KRW'];
  const ctrs=[{c:'Vietnam',n:'Việt Nam'},{c:'United States',n:'Hoa Kỳ'},{c:'Singapore',n:'Singapore'},{c:'Japan',n:'Nhật Bản'},{c:'Korea',n:'Hàn Quốc'},{c:'China',n:'Trung Quốc'},{c:'Thailand',n:'Thái Lan'},{c:'Malaysia',n:'Malaysia'},{c:'Germany',n:'Đức'},{c:'United Kingdom',n:'Vương Quốc Anh'}];
  let copts='';for(const c of ctrs)copts+='<option value="'+c.c+'" '+((comp.country||'Vietnam').toLowerCase()===c.c.toLowerCase()?'selected':'')+'>'+c.n+' ('+c.c+')</option>';
  let cuopts='';for(const cur of curs)cuopts+='<option value="'+cur+'" '+((comp.base_currency||'VND').toUpperCase()===cur?'selected':'')+'>'+cur+(cur==='VND'?' – Việt Nam Đồng':cur==='USD'?' – Đô la Mỹ':'')+'</option>';
  return cardShell(stepHeader('apartment',1,'Thông tin công ty','Tạo cơ sở dữ liệu nền tảng. Bạn có thể chỉnh sửa sau.')
    +'<form id="form-step1" onsubmit="event.preventDefault();saveStep1AndAdvance();">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
    +'<div class="form-group" style="grid-column:span 2;">'+fmtLabel('Tên đầy đủ công ty',true)+fmtInput('step1_fullname','VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ TERAX',escapeHTML(comp.company_fullname||''))+'</div>'
    +'<div class="form-group">'+fmtLabel('Tên viết tắt / Brand Name',true)+fmtInput('step1_shortname','VD: TERAX',escapeHTML(comp.company_shortname||''))+'</div>'
    +'<div class="form-group">'+fmtLabel('Mã số thuế',false)+fmtInput('step1_tax_code','VD: 0101234567',escapeHTML(comp.tax_code||''))+'</div>'
    +'<div class="form-group">'+fmtLabel('Quốc gia',true)+'<select id="step1_country" class="form-input" style="width:100%;padding:10px 14px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;">'+copts+'</select></div>'
    +'<div class="form-group">'+fmtLabel('Đơn vị tiền tệ chính',true)+'<select id="step1_currency" class="form-input" style="width:100%;padding:10px 14px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;">'+cuopts+'</select></div>'
    +'<div class="form-group" style="grid-column:span 2;">'+fmtLabel('Địa chỉ trụ sở chính',false)+fmtInput('step1_address','VD: Tầng 5, Tòa nhà Landmark, Hà Nội',escapeHTML(comp.address||''))+'</div>'
    +'<div class="form-group">'+fmtLabel('Website',false)+fmtInput('step1_website','https://terax.ai',escapeHTML(comp.website||''))+'</div>'
    +'<div class="form-group">'+fmtLabel('Múi giờ hệ thống',false)+'<input type="text" id="step1_timezone" readonly class="form-input" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:rgba(255,255,255,0.45);" value="'+tz+'"></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">'
    +'<button type="button" onclick="window.setSetupStep(2)" style="padding:9px 14px;border:none;background:transparent;color:rgba(255,255,255,0.45);font-size:12.5px;cursor:pointer;">Bỏ qua bước này</button>'
    +'<button type="submit" style="display:flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,0.35);"><span>Lưu và tiếp tục</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    +'</div></form>');
}

window.saveStep1AndAdvance = async function(){
  const fn=document.getElementById('step1_fullname')?.value?.trim();
  const sn=document.getElementById('step1_shortname')?.value?.trim();
  if(!fn||!sn){showToast('Vui lòng điền tên đầy đủ và tên viết tắt','warning');return;}
  try{
    showToast('Đang lưu thông tin công ty...','info');
    const res=await apiPost('/system-setup/company',{company_fullname:fn,company_shortname:sn,tax_code:document.getElementById('step1_tax_code')?.value?.trim(),country:document.getElementById('step1_country')?.value,base_currency:document.getElementById('step1_currency')?.value,address:document.getElementById('step1_address')?.value?.trim(),website:document.getElementById('step1_website')?.value?.trim()});
    if(res.success){showToast('Đã lưu thông tin công ty!','success');window.setupCurrentStep=2;await renderSetupContent();}
    else showToast(res.error||'Lưu thất bại','error');
  }catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ── STEP 2 ──
const DEPT_ICONS={BGD:{icon:'workspace_premium',color:'#f59e0b',bg:'rgba(245,158,11,0.15)'},HCNS:{icon:'supervised_user_circle',color:'#60a5fa',bg:'rgba(96,165,250,0.15)'},TCKT:{icon:'account_balance',color:'#34d399',bg:'rgba(52,211,153,0.15)'},KD:{icon:'bar_chart',color:'#f97316',bg:'rgba(249,115,22,0.15)'},KT:{icon:'construction',color:'#a78bfa',bg:'rgba(167,139,250,0.15)'},IT:{icon:'laptop',color:'#38bdf8',bg:'rgba(56,189,248,0.15)'},MH:{icon:'shopping_cart',color:'#fb7185',bg:'rgba(251,113,133,0.15)'},CSKH:{icon:'headset_mic',color:'#2dd4bf',bg:'rgba(45,212,191,0.15)'},PC:{icon:'gavel',color:'#c084fc',bg:'rgba(192,132,252,0.15)'}};
const PRESET_DEPARTMENTS=[
  {code:'BGD',name:'Ban Giám đốc',type:'Operation',desc:'Điều hành và quản trị doanh nghiệp',checked:true},
  {code:'HCNS',name:'Hành chính – Nhân sự',type:'Operation',desc:'Quản lý nhân sự, hành chính, pháp chế',checked:true},
  {code:'TCKT',name:'Tài chính – Kế toán',type:'Finance',desc:'Tài chính, kế toán, thuế',checked:true},
  {code:'KD',name:'Kinh doanh',type:'Sale and MKT',desc:'Phát triển thị trường, chăm sóc khách hàng',checked:true},
  {code:'KT',name:'Kỹ thuật',type:'Technical',desc:'Triển khai dự án, kỹ thuật, vận hành',checked:true},
  {code:'IT',name:'CNTT',type:'Technical',desc:'Hạ tầng, hệ thống, hỗ trợ IT',checked:false},
  {code:'MH',name:'Mua hàng',type:'Operation',desc:'Mua sắm, nhà cung cấp',checked:false},
  {code:'CSKH',name:'Chăm sóc khách hàng',type:'Sale and MKT',desc:'Hỗ trợ khách hàng, dịch vụ',checked:false},
  {code:'PC',name:'Pháp chế',type:'Operation',desc:'Pháp lý, tuân thủ',checked:false}
];
window.switchStep2Tab=function(t){window.setupStep2ActiveTab=t;renderSetupContent();};
function renderStep2HTML(counts){
  const tab=window.setupStep2ActiveTab;
  let tc='';
  if(tab==='choose'){
    let cards='';
    for(const d of PRESET_DEPARTMENTS){const m=DEPT_ICONS[d.code]||{icon:'business',color:'#f97316',bg:'rgba(249,115,22,0.15)'};cards+='<label style="cursor:pointer;display:flex;align-items:flex-start;gap:10px;padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);transition:var(--transition);"><input type="checkbox" name="preset_dept" value="'+d.code+'" '+(d.checked?'checked':'')+' style="margin-top:2px;accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"><div style="flex:1;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><div style="width:30px;height:30px;border-radius:8px;background:'+m.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:17px;color:'+m.color+';">'+m.icon+'</span></div><span style="font-size:13px;font-weight:700;color:white;">'+d.name+'</span></div><div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;">'+d.desc+'</div></div></label>';}
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Chọn mẫu cơ cấu tổ chức</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:14px;">Chọn các phòng ban phù hợp với doanh nghiệp.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">'+cards+'</div><button onclick="showCustomDeptForm()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px dashed rgba(255,255,255,0.2);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.6);font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">settings</span> Tùy chỉnh thêm</button><div id="custom-dept-form" style="display:none;margin-top:12px;padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.2);"><div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;align-items:end;"><div><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">Mã phòng ban</label><input id="custom_dept_code" type="text" class="form-input" style="width:100%;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:white;font-size:12px;" placeholder="VD: MKT"></div><div><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">Tên phòng ban</label><input id="custom_dept_name" type="text" class="form-input" style="width:100%;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:white;font-size:12px;" placeholder="VD: Marketing"></div><div><button onclick="addCustomDeptToList()" style="width:100%;padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;">+ Thêm vào danh sách</button></div></div></div></div>';
  } else if(tab==='excel'){
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Nhập từ file Excel</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Tải file mẫu và nhập danh sách phòng ban từ Excel.</p><div style="border:2px dashed rgba(249,115,22,0.3);border-radius:14px;padding:32px;text-align:center;background:rgba(249,115,22,0.03);"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:white;margin-bottom:5px;">Kéo &amp; Thả file Excel vào đây</div><div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:16px;">(.xlsx, .xls)</div><div style="display:flex;gap:12px;justify-content:center;"><button onclick="downloadSetupTemplate(\'department\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:white;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tải mẫu (.xlsx)</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chọn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'department\')"></label></div></div></div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:120px 1fr 160px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="form-input qdept-code" placeholder="Mã PB" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qdept-name" placeholder="Tên phòng ban" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><select class="form-input qdept-type" style="padding:8px 12px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Nhập nhanh</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:14px;">Nhập trực tiếp từng phòng ban.</p><div id="quick-dept-rows">'+r3+'</div><button onclick="addQuickDeptRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">add</span> Thêm dòng</button></div>';
  } else {
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Xem trước &amp; xác nhận</div><div style="background:rgba(0,0,0,0.2);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);"><div style="padding:10px 16px;background:rgba(255,255,255,0.04);font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);">Hiện có: <strong style="color:#22c55e;">'+(counts.department||0)+'</strong> phòng ban</div>'+(counts.department>0?'<div style="padding:16px;font-size:12px;color:rgba(255,255,255,0.5);">Đã có phòng ban. Có thể thêm từ tab Chọn mẫu.</div>':'<div style="padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.35);">Chưa có phòng ban. Chọn từ tab Chọn mẫu hoặc nhập từ Excel.</div>')+'</div></div>';
  }
  return cardShell(stepHeader('account_tree',2,'Thiết lập phòng ban','Tạo cơ cấu tổ chức. Chọn từ mẫu gợi ý hoặc nhập từ Excel.')+makeTabBar([{key:'choose',label:'Chọn mẫu'},{key:'excel',label:'Nhập từ Excel'},{key:'quick',label:'Nhập nhanh'},{key:'preview',label:'Xem trước & xác nhận'}],tab,'window.switchStep2Tab')+tc+bottomNav(1,3,'Tạo các phòng ban đã chọn','saveStep2AndAdvance()'));
}
window.showCustomDeptForm=function(){const el=document.getElementById('custom-dept-form');if(el)el.style.display=el.style.display==='none'?'block':'none';};
window.addQuickDeptRow=function(){const c=document.getElementById('quick-dept-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:120px 1fr 160px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="form-input qdept-code" placeholder="Mã PB" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qdept-name" placeholder="Tên phòng ban" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><select class="form-input qdept-type" style="padding:8px 12px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.addCustomDeptToList=function(){const code=document.getElementById('custom_dept_code')?.value?.trim();const name=document.getElementById('custom_dept_name')?.value?.trim();if(!code||!name){showToast('Vui lòng điền đủ Mã và Tên phòng ban','warning');return;}showToast('Đã thêm phòng ban "'+name+'" ('+code+') vào danh sách','info');};
window.saveStep2AndAdvance=async function(){
  const tab=window.setupStep2ActiveTab;
  if(tab==='quick'){
    const codes=document.querySelectorAll('.qdept-code'),names=document.querySelectorAll('.qdept-name'),types=document.querySelectorAll('.qdept-type'),payload=[];
    codes.forEach((c,i)=>{const code=c.value.trim(),name=names[i]?.value?.trim(),type=types[i]?.value||'Operation';if(code&&name)payload.push({department_code:code,department_name:name,type});});
    if(!payload.length){window.setSetupStep(3);return;}
    try{showToast('Đang tạo '+payload.length+' phòng ban...','info');const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('Đã tạo '+res.count+' phòng ban!','success');window.setupCurrentStep=3;await renderSetupContent();}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
    return;
  }
  const cbs=document.querySelectorAll('input[name="preset_dept"]:checked'),sels=Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(3);return;}
  const payload=PRESET_DEPARTMENTS.filter(d=>sels.includes(d.code)).map(d=>({department_code:d.code,department_name:d.name,type:d.type}));
  try{showToast('Đang tạo '+payload.length+' phòng ban...','info');const res=await apiPost('/system-setup/presets/departments',{departments:payload});if(res.success){showToast('Đã tạo '+res.count+' phòng ban!','success');window.setupCurrentStep=3;await renderSetupContent();}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ── STEP 3 ──
window.switchStep3Tab=function(t){window.setupStep3ActiveTab=t;renderSetupContent();};
function renderStep3HTML(counts){
  const tab=window.setupStep3ActiveTab,parsed=window.setupParsedEmployees||[];
  const modes=[{key:'excel',icon:'table_view',color:'#22c55e',bg:'rgba(34,197,94,0.1)',title:'Nhập từ Excel',desc:'Tải lên file Excel. Hệ thống tự động nhận diện cột.'},{key:'quick',icon:'bolt',color:'#f97316',bg:'rgba(249,115,22,0.1)',title:'Thêm nhanh',desc:'Nhập trực tiếp trên giao diện.'},{key:'sample',icon:'description',color:'#a78bfa',bg:'rgba(167,139,250,0.1)',title:'Dùng dữ liệu mẫu',desc:'Tải file mẫu của TeraX đúng định dạng.'}];
  let modeCards='';
  for(const m of modes)modeCards+='<label onclick="window.switchStep3Tab(\''+m.key+'\')" style="cursor:pointer;display:flex;align-items:flex-start;gap:10px;padding:14px;border-radius:12px;border:2px solid '+(tab===m.key?m.color:'rgba(255,255,255,0.1)')+';background:'+(tab===m.key?m.bg:'rgba(255,255,255,0.03)')+';transition:var(--transition);"><div style="width:38px;height:38px;border-radius:10px;background:'+m.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:20px;color:'+m.color+';">'+m.icon+'</span></div><div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:3px;">'+m.title+'</div><div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;">'+m.desc+'</div></div></label>';
  let tc='';
  if(tab==='excel'){
    let previewHtml='';
    if(parsed.length>0){
      const vc=parsed.filter(e=>e.full_name&&e.email).length,wc=parsed.filter(e=>!e.department_code).length,ec=parsed.filter(e=>!e.full_name||!e.email).length;
      let rows='';
      for(let i=0;i<Math.min(parsed.length,10);i++){const e=parsed[i],v=e.full_name&&e.email;rows+='<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:7px 12px;color:rgba(255,255,255,0.35);">'+(i+1)+'</td><td style="padding:7px 12px;font-weight:600;color:white;">'+escapeHTML(e.full_name||'–')+'</td><td style="padding:7px 12px;color:#38bdf8;">'+escapeHTML(e.email||'–')+'</td><td style="padding:7px 12px;color:rgba(255,255,255,0.7);">'+escapeHTML(e.department_code||e.department_name||'–')+'</td><td style="padding:7px 12px;color:rgba(255,255,255,0.7);">'+escapeHTML(e.position||'Nhân viên')+'</td><td style="padding:7px 12px;color:rgba(255,255,255,0.5);">'+escapeHTML(e.direct_manager||'–')+'</td><td style="padding:7px 12px;">'+(v?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:rgba(34,197,94,0.15);color:#22c55e;font-weight:600;">Hợp lệ</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:rgba(239,68,68,0.15);color:#ef4444;font-weight:600;">Lỗi</span>')+'</td></tr>';}
      previewHtml='<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);margin-bottom:14px;"><span class="material-symbols-rounded" style="font-size:28px;color:#22c55e;">grid_on</span><div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:white;">File nhân viên</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">'+parsed.length+' dòng dữ liệu</div></div><span style="font-size:11px;color:#22c55e;font-weight:600;display:flex;align-items:center;gap:4px;"><span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Tải lên thành công</span><button onclick="window.setupParsedEmployees=[];renderSetupContent();" style="width:28px;height:28px;border-radius:6px;border:none;background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:15px;">delete</span></button></div>'
      +'<div style="margin-bottom:14px;"><div style="font-size:12.5px;font-weight:700;color:white;margin-bottom:3px;">Ánh xạ cột dữ liệu</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">'
      +['Họ và tên *','Email *','Phòng ban','Chức danh','Quản lý trực tiếp'].map((lbl,fi)=>'<div><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">'+lbl+'</label><select style="width:100%;padding:7px 10px;background:rgba(10,20,40,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:white;font-size:11.5px;">'+['A - Họ và tên','B - Email','C - Phòng ban','D - Chức danh','E - Quản lý'].map((o,oi)=>'<option '+(oi===fi?'selected':'')+'>'+o+'</option>').join('')+'</select></div>').join('')
      +'</div><button style="margin-top:8px;padding:5px 12px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;">Đặt lại</button></div>'
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><span style="font-size:12px;font-weight:700;color:white;">Xem trước (10 dòng đầu)</span><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(34,197,94,0.15);color:#22c55e;">'+vc+' hợp lệ</span>'+(wc>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(251,191,36,0.15);color:#fbbf24;">'+wc+' cảnh báo</span>':'')+(ec>0?'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(239,68,68,0.15);color:#ef4444;">'+ec+' lỗi</span>':'')+'</div>'
      +'<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);"><div style="overflow-x:auto;max-height:220px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:11.5px;"><thead style="position:sticky;top:0;z-index:1;"><tr style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);"><th style="padding:8px 12px;text-align:left;">#</th><th style="padding:8px 12px;text-align:left;">Họ và tên</th><th style="padding:8px 12px;text-align:left;">Email</th><th style="padding:8px 12px;text-align:left;">Phòng ban</th><th style="padding:8px 12px;text-align:left;">Chức danh</th><th style="padding:8px 12px;text-align:left;">Quản lý</th><th style="padding:8px 12px;text-align:left;">Trạng thái</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }
    tc='<div><div style="border:2px dashed rgba(249,115,22,0.35);border-radius:14px;padding:28px;text-align:center;background:rgba(249,115,22,0.03);margin-bottom:16px;"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:white;margin-bottom:4px;">Kéo &amp; Thả file Excel vào đây</div><div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:14px;">(.xlsx, .xls, .csv)</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="downloadEmployeeTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:white;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">download</span> Tải file mẫu 5 cột</button><label style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">folder_open</span> Chọn file Excel<input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleEmployeeExcelUpload(event)"></label></div></div>'+previewHtml+'</div>';
  } else if(tab==='quick'){
    const r3=['','',''].map(()=>'<div style="display:grid;grid-template-columns:1fr 1fr 140px 140px auto;gap:8px;margin-bottom:8px;align-items:center;"><input type="text" class="form-input qemp-name" placeholder="Họ và tên *" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="email" class="form-input qemp-email" placeholder="Email *" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qemp-dept" placeholder="Mã phòng ban" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qemp-pos" placeholder="Chức danh" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(239,68,68,0.12);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button></div>').join('');
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Thêm nhân viên nhanh</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:14px;">Nhập trực tiếp từng nhân viên.</p><div id="quick-emp-rows">'+r3+'</div><button onclick="addQuickEmpRow()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px dashed rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;margin-top:4px;"><span class="material-symbols-rounded" style="font-size:16px;">person_add</span> Thêm nhân viên</button></div>';
  } else {
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Dùng dữ liệu mẫu</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Tải file mẫu của TeraX để nhập dữ liệu đúng định dạng.</p><div style="background:rgba(167,139,248,0.08);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:20px;text-align:center;"><div style="width:56px;height:56px;border-radius:14px;background:rgba(167,139,250,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><span class="material-symbols-rounded" style="font-size:28px;color:#a78bfa;">description</span></div><div style="font-size:14px;font-weight:700;color:white;margin-bottom:5px;">File mẫu nhân viên – 5 cột chuẩn TeraX</div><div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px;line-height:1.6;">Gồm: Họ và tên · Email · Phòng ban · Chức danh · Quản lý trực tiếp</div><button onclick="downloadEmployeeTemplate()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:white;font-size:13px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">download</span>Tải file mẫu (.xlsx)</button></div></div>';
  }
  const btnLabel=parsed.length>0?'Nhập '+parsed.length+' nhân viên':'Tiếp tục bước tiếp theo';
  return cardShell(stepHeader('group',3,'Thiết lập nhân viên','Nhập danh sách nhân sự. Có thể nhập từ Excel, thêm nhanh hoặc dùng dữ liệu mẫu.')+'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">'+modeCards+'</div>'+tc+bottomNav(2,4,btnLabel,'saveStep3AndAdvance()'));
}
window.addQuickEmpRow=function(){const c=document.getElementById('quick-emp-rows');if(!c)return;const d=document.createElement('div');d.style.cssText='display:grid;grid-template-columns:1fr 1fr 140px 140px auto;gap:8px;margin-bottom:8px;align-items:center;';d.innerHTML='<input type="text" class="form-input qemp-name" placeholder="Họ và tên *" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="email" class="form-input qemp-email" placeholder="Email *" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qemp-dept" placeholder="Mã phòng ban" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><input type="text" class="form-input qemp-pos" placeholder="Chức danh" style="padding:8px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:white;font-size:12px;"><button onclick="this.closest(\'div\').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(239,68,68,0.12);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:16px;">close</span></button>';c.appendChild(d);};
window.downloadEmployeeTemplate=function(){const headers=['Họ và tên *','Email *','Phòng ban (Mã hoặc Tên)','Chức vụ','Email Quản lý trực tiếp'];const sampleData=[{'Họ và tên *':'Nguyễn Văn Quản Lý','Email *':'manager@company.com','Phòng ban (Mã hoặc Tên)':'KD','Chức vụ':'Trưởng phòng Kinh doanh','Email Quản lý trực tiếp':''},{'Họ và tên *':'Trần Thị Chuyên Viên','Email *':'staff@company.com','Phòng ban (Mã hoặc Tên)':'KD','Chức vụ':'Chuyên viên Kinh doanh','Email Quản lý trực tiếp':'manager@company.com'}];const ws=XLSX.utils.json_to_sheet(sampleData,{header:headers});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'NhanVien');XLSX.writeFile(wb,'Mau_Nhap_Nhan_Su_5_Cot.xlsx');showToast('Đã tải xuống file mẫu 5 cột','success');};
window.handleEmployeeExcelUpload=function(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=(e)=>{try{const data=new Uint8Array(e.target.result);const wb=XLSX.read(data,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows||!rows.length){showToast('File Excel không có dòng dữ liệu','warning');return;}const mapped=[];for(const r of rows){const keys=Object.keys(r);const nk=keys.find(k=>/tên|name|họ/i.test(k));const ek=keys.find(k=>/email|thư/i.test(k));const dk=keys.find(k=>/phòng|dept|ban/i.test(k));const pk=keys.find(k=>/chức|vị trí|title|position/i.test(k));const mk=keys.find(k=>/quản lý|manager|ql/i.test(k));const fn=nk?String(r[nk]).trim():'';const em=ek?String(r[ek]).trim():'';if(fn&&em)mapped.push({full_name:fn,email:em,department_code:dk?String(r[dk]).trim():'',position:pk?String(r[pk]).trim():'Nhân viên',direct_manager:mk?String(r[mk]).trim():''});}if(!mapped.length){showToast('Không tìm thấy dòng hợp lệ','warning');return;}window.setupParsedEmployees=mapped;showToast('Đã nhận diện '+mapped.length+' nhân viên từ file','success');renderSetupContent();}catch(err){showToast('Lỗi đọc file: '+err.message,'error');}};reader.readAsArrayBuffer(file);};
window.saveStep3AndAdvance=async function(){
  const tab=window.setupStep3ActiveTab;
  if(tab==='quick'){const ns=document.querySelectorAll('.qemp-name'),es=document.querySelectorAll('.qemp-email'),ds=document.querySelectorAll('.qemp-dept'),ps=document.querySelectorAll('.qemp-pos'),p=[];ns.forEach((n,i)=>{const fn=n.value.trim(),em=es[i]?.value?.trim();if(fn&&em)p.push({full_name:fn,email:em,department_code:ds[i]?.value?.trim()||'',position:ps[i]?.value?.trim()||'Nhân viên',direct_manager:''});});if(!p.length){window.setSetupStep(4);return;}window.setupParsedEmployees=p;}
  const employees=window.setupParsedEmployees||[];if(!employees.length){window.setSetupStep(4);return;}
  try{showToast('Đang nhập '+employees.length+' nhân viên...','info');const res=await apiPost('/system-setup/import-employees',{employees});if(res.success){showToast('Đã nhập '+res.count+' nhân viên!','success');window.setupParsedEmployees=[];window.setupCurrentStep=4;await renderSetupContent();}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ── STEP 4 ──
const PRESET_POLICIES_FULL=[
  {id:'P-LEAVE',name:'Xin nghỉ phép',type:'Operation',cat:'Nhan su',nameVi:'Xin nghỉ phép',descVi:'Quy trình nhân viên xin nghỉ phép (nghỉ ngày, nghỉ dài ngày)',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:1,checked:true},
  {id:'P-RECRUIT',name:'Tuyển dụng',type:'Operation',cat:'Nhan su',nameVi:'Tuyển dụng',descVi:'Quy trình đề xuất và phê duyệt tuyển dụng nhân sự',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:3,checked:true},
  {id:'P-ONBOARD',name:'Onboarding',type:'Operation',cat:'Nhan su',nameVi:'Onboarding',descVi:'Quy trình tiếp nhận nhân viên mới',tags:['Mới'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-OFFBOARD',name:'Offboarding',type:'Operation',cat:'Nhan su',nameVi:'Offboarding',descVi:'Quy trình nghỉ việc và bàn giao công việc',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false},
  {id:'P-SALARY',name:'Dieu chinh luong',type:'Finance',cat:'Nhan su',nameVi:'Điều chỉnh lương',descVi:'Quy trình đề xuất điều chỉnh lương, thưởng',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-TRAINING',name:'Dao tao noi bo',type:'Operation',cat:'Nhan su',nameVi:'Đào tạo nội bộ',descVi:'Quy trình đề xuất và tổ chức đào tạo',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false},
  {id:'P-STATION',name:'Mua van phong pham',type:'Operation',cat:'Hanh chinh',nameVi:'Mua văn phòng phẩm',descVi:'Quy trình đề xuất mua sắm văn phòng phẩm',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:false},
  {id:'P-ASSET',name:'Cap phat tai san',type:'Operation',cat:'Hanh chinh',nameVi:'Cấp phát tài sản',descVi:'Quy trình yêu cầu cấp phát thiết bị, tài sản công ty',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-VEHICLE',name:'Dat xe',type:'Operation',cat:'Hanh chinh',nameVi:'Đặt xe / Di chuyển',descVi:'Quy trình đặt xe công tác, di chuyển nội bộ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-ADVANCE',name:'De nghi tam ung',type:'Finance',cat:'Tai chinh',nameVi:'Đề nghị tạm ứng',descVi:'Đề xuất tạm ứng công tác phí và hoàn ứng chứng từ',tags:['Phổ biến'],elements:'EXPENSE',sla:2,checked:true},
  {id:'P-PAYMENT',name:'Thanh toan chi phi',type:'Finance',cat:'Tai chinh',nameVi:'Thanh toán chi phí',descVi:'Quy trình phê duyệt thanh toán hóa đơn, chi phí phát sinh',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-BUDGET',name:'De xuat ngan sach',type:'Finance',cat:'Tai chinh',nameVi:'Đề xuất ngân sách',descVi:'Quy trình lập và phê duyệt ngân sách dự án',tags:[],elements:'EXPENSE',sla:5,checked:false},
  {id:'P-CONTRACT',name:'Ky ket hop dong',type:'Finance',cat:'Tai chinh',nameVi:'Ký kết hợp đồng',descVi:'Quy trình phê duyệt và ký kết hợp đồng kinh tế',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-IT-ACC',name:'Cap tai khoan IT',type:'Technical',cat:'CNTT',nameVi:'Cấp tài khoản IT',descVi:'Quy trình yêu cầu cấp tài khoản phần mềm, hệ thống',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-IT-ISSUE',name:'Bao loi he thong',type:'Technical',cat:'CNTT',nameVi:'Báo lỗi hệ thống',descVi:'Quy trình báo cáo sự cố kỹ thuật và xử lý',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-PURCHASE',name:'De nghi mua hang',type:'Operation',cat:'Mua hang',nameVi:'Đề nghị mua hàng',descVi:'Quy trình đề xuất và phê duyệt mua sắm vật tư, thiết bị',tags:['Phổ biến'],elements:'EXPENSE',sla:3,checked:false},
  {id:'P-VENDOR',name:'Them NCC moi',type:'Operation',cat:'Mua hang',nameVi:'Thêm nhà cung cấp mới',descVi:'Quy trình đề xuất và phê duyệt nhà cung cấp mới',tags:[],elements:'ASSIGN_TASK',sla:5,checked:false},
  {id:'P-DEAL',name:'Phe duyet bao gia',type:'Sale and MKT',cat:'Kinh doanh',nameVi:'Phê duyệt báo giá',descVi:'Quy trình phê duyệt báo giá, đề xuất thương mại',tags:['Phổ biến'],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-WFH',name:'Lam viec tu xa',type:'Operation',cat:'Khac',nameVi:'Làm việc từ xa (WFH)',descVi:'Quy trình xin phép làm việc tại nhà / từ xa',tags:['Mới'],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-OT',name:'Tang ca',type:'Operation',cat:'Khac',nameVi:'Tăng ca / Làm thêm giờ',descVi:'Quy trình đăng ký và phê duyệt làm thêm giờ',tags:[],elements:'ASSIGN_TASK',sla:1,checked:false},
  {id:'P-BUSINESS',name:'Cong tac',type:'Operation',cat:'Khac',nameVi:'Công tác / Xuất ngoại',descVi:'Quy trình phê duyệt công tác, đi nước ngoài',tags:[],elements:'ASSIGN_TASK',sla:2,checked:false},
  {id:'P-COMPLAINT',name:'Phan anh noi bo',type:'Operation',cat:'Khac',nameVi:'Phản ánh nội bộ',descVi:'Quy trình tiếp nhận và xử lý phản ánh nhân viên',tags:[],elements:'ASSIGN_TASK',sla:3,checked:false}
];
const STEP4_CATS=[{key:'all',label:'Tất cả',count:22},{key:'Nhan su',label:'Nhân sự',count:6},{key:'Hanh chinh',label:'Hành chính',count:3},{key:'Tai chinh',label:'Tài chính',count:4},{key:'CNTT',label:'CNTT',count:2},{key:'Mua hang',label:'Mua hàng',count:2},{key:'Kinh doanh',label:'Kinh doanh',count:1},{key:'Khac',label:'Khác',count:4}];
const P_CAT_ICONS={'Nhan su':'group','Hanh chinh':'admin_panel_settings','Tai chinh':'account_balance','CNTT':'computer','Mua hang':'shopping_cart','Kinh doanh':'trending_up','Khac':'more_horiz','all':'list'};
const P_TAG_STYLES={'Phổ biến':{bg:'rgba(249,115,22,0.2)',color:'#f97316'},'Mới':{bg:'rgba(34,197,94,0.15)',color:'#22c55e'}};
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
    for(const c of STEP4_CATS)catBtns+='<button onclick="window.setStep4Category(\''+c.key+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:9px;border:none;cursor:pointer;text-align:left;transition:var(--transition);background:'+(cat===c.key?'rgba(249,115,22,0.15)':'transparent')+';color:'+(cat===c.key?'#f97316':'rgba(255,255,255,0.6)')+'width:100%;"><div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:'+(cat===c.key?'700':'500')+';"><span class="material-symbols-rounded" style="font-size:15px;">'+(P_CAT_ICONS[c.key]||'folder')+'</span>'+c.label+'</div><span style="font-size:11px;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.45);">'+c.count+'</span></button>';
    let pCards='';
    for(const p of filtered){let tagHtml='';for(const tag of p.tags){const s=P_TAG_STYLES[tag]||{bg:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)'};tagHtml+='<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:'+s.bg+';color:'+s.color+';font-weight:600;">'+tag+'</span>';}pCards+='<label style="cursor:pointer;display:flex;flex-direction:column;padding:14px;border-radius:12px;border:1.5px solid '+(p.checked?'rgba(249,115,22,0.5)':'rgba(255,255,255,0.08)')+';background:'+(p.checked?'rgba(249,115,22,0.07)':'rgba(255,255,255,0.03)')+';transition:var(--transition);"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;"><div style="width:32px;height:32px;border-radius:9px;background:rgba(249,115,22,0.12);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:17px;color:#f97316;">'+(P_CAT_ICONS[p.cat]||'policy')+'</span></div><input type="checkbox" name="preset_policy" value="'+p.id+'" '+(p.checked?'checked':'')+' style="accent-color:#f97316;width:16px;height:16px;flex-shrink:0;"></div><div style="font-size:12.5px;font-weight:700;color:white;margin-bottom:4px;">'+p.nameVi+'</div><div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;flex:1;margin-bottom:8px;">'+p.descVi+'</div><div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;gap:4px;">'+tagHtml+'</div><span style="font-size:10.5px;color:rgba(255,255,255,0.35);">SLA: '+p.sla+'d</span></div></label>';}
    if(!pCards)pCards='<div style="grid-column:span 3;text-align:center;padding:30px;color:rgba(255,255,255,0.3);font-size:13px;">Không tìm thấy quy trình phù hợp</div>';
    tc='<div style="display:flex;gap:16px;"><div style="width:160px;flex-shrink:0;"><div style="font-size:11.5px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Danh mục</div><div style="display:flex;flex-direction:column;gap:2px;">'+catBtns+'</div></div><div style="flex:1;min-width:0;"><div style="position:relative;margin-bottom:14px;"><span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:rgba(255,255,255,0.35);">search</span><input type="text" value="'+escapeHTML(window.setupStep4Search||'')+'" oninput="window.setStep4Search(this.value)" placeholder="Tìm kiếm quy trình..." style="width:100%;padding:9px 14px 9px 36px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:white;font-size:12.5px;"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">'+pCards+'</div></div></div>';
  } else if(tab==='create'){
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Tạo quy trình mới</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Tự định nghĩa quy trình theo nhu cầu riêng.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="grid-column:span 2;"><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">Tên quy trình *</label><input id="new_policy_name" type="text" class="form-input" style="width:100%;padding:9px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.15);border-radius:9px;color:white;font-size:12.5px;" placeholder="VD: Quy trình phê duyệt hợp đồng dịch vụ"></div><div><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">Loại</label><select id="new_policy_type" class="form-input" style="width:100%;padding:9px 14px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:9px;color:white;font-size:12.5px;"><option>Operation</option><option>Finance</option><option>Technical</option><option>Sale and MKT</option></select></div><div><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">SLA (ngày)</label><input id="new_policy_sla" type="number" class="form-input" min="1" value="3" style="width:100%;padding:9px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.15);border-radius:9px;color:white;font-size:12.5px;"></div><div style="grid-column:span 2;"><label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px;">Mô tả</label><textarea id="new_policy_desc" class="form-input" rows="3" style="width:100%;padding:9px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.15);border-radius:9px;color:white;font-size:12px;resize:vertical;" placeholder="Mô tả ngắn gọn về mục đích quy trình..."></textarea></div></div><div style="margin-top:12px;padding:14px;border-radius:10px;background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.15);"><div style="font-size:12px;color:rgba(255,255,255,0.7);"><span class="material-symbols-rounded" style="font-size:14px;color:#38bdf8;vertical-align:middle;">info</span> Phê duyệt mặc định: <strong style="color:white;">Quản lý trực tiếp (Tier 1)</strong></div></div></div>';
  } else if(tab==='excel'){
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Nhập từ Excel</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Nhập danh sách quy trình từ file Excel.</p><div style="border:2px dashed rgba(249,115,22,0.3);border-radius:14px;padding:28px;text-align:center;background:rgba(249,115,22,0.03);"><span class="material-symbols-rounded" style="font-size:44px;color:#f97316;display:block;margin-bottom:10px;">upload_file</span><div style="font-size:14px;font-weight:700;color:white;margin-bottom:5px;">Kéo &amp; Thả file Excel vào đây</div><div style="display:flex;gap:12px;justify-content:center;margin-top:14px;"><button onclick="downloadSetupTemplate(\'policy\')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:white;font-size:12px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">download</span> Tải mẫu</button><label style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:15px;">folder_open</span> Chọn file<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importSetupFile(event,\'policy\')"></label></div></div></div>';
  } else {
    tc='<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">Quản lý quy trình</div><p style="font-size:11.5px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Hiện có <strong style="color:#22c55e;">'+(counts.policy_and_program||0)+'</strong> quy trình đã thiết lập.</p>'+(counts.policy_and_program>0?'<div style="padding:20px;text-align:center;background:rgba(34,197,94,0.07);border-radius:12px;border:1px solid rgba(34,197,94,0.2);"><span class="material-symbols-rounded" style="font-size:40px;color:#22c55e;">task_alt</span><div style="margin-top:8px;font-size:13px;color:white;font-weight:600;">Đã có '+counts.policy_and_program+' quy trình</div></div>':'<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px;">Chưa có quy trình nào.</div>')+'</div>';
  }
  return cardShell(stepHeader('policy',4,'Thiết lập quy trình','Chọn quy trình mẫu phù hợp hoặc tự tạo theo nhu cầu doanh nghiệp.')+makeTabBar([{key:'library',label:'Chọn từ thư viện mẫu'},{key:'create',label:'Tạo quy trình mới'},{key:'excel',label:'Nhập từ Excel'},{key:'manage',label:'Quản lý quy trình'}],tab,'window.switchStep4Tab')+tc+bottomNav(3,5,'Tạo các quy trình đã chọn','saveStep4AndAdvance()'));
}
window.saveStep4AndAdvance=async function(){
  const tab=window.setupStep4ActiveTab;
  if(tab==='create'){const name=document.getElementById('new_policy_name')?.value?.trim();if(!name){showToast('Vui lòng nhập tên quy trình','warning');return;}const p=[{policy_name:name,policy_type:document.getElementById('new_policy_type')?.value||'Operation',description:document.getElementById('new_policy_desc')?.value?.trim()||name,elements:'ASSIGN_TASK',sla:parseInt(document.getElementById('new_policy_sla')?.value)||3}];try{const res=await apiPost('/system-setup/presets/policies',{policies:p});if(res.success){showToast('Đã tạo quy trình "'+name+'"!','success');window.setupCurrentStep=5;await renderSetupContent();}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}return;}
  const cbs=document.querySelectorAll('input[name="preset_policy"]:checked'),sels=Array.from(cbs).map(c=>c.value);
  if(!sels.length){window.setSetupStep(5);return;}
  const payload=PRESET_POLICIES_FULL.filter(p=>sels.includes(p.id)).map(p=>({policy_name:p.name,policy_type:p.type,description:p.descVi||p.name,elements:p.elements,sla:p.sla}));
  try{showToast('Đang khởi tạo '+payload.length+' quy trình...','info');const res=await apiPost('/system-setup/presets/policies',{policies:payload});if(res.success){showToast('Đã tạo '+res.count+' quy trình!','success');window.setupCurrentStep=5;await renderSetupContent();}else showToast(res.error||'Lỗi','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ── STEP 5 ──
function renderStep5HTML(comp,counts){
  const cur=comp.base_currency||'VND';
  const banks=['Vietcombank','Vietinbank','BIDV','Techcombank','MB Bank','ACB','Agribank','TPBank','VPBank','OCB','SHB','HDBank','MSB','VIB','SeABank'];
  let bopts='<option value="">-- Chọn ngân hàng --</option>';for(const b of banks)bopts+='<option value="'+b+'">'+b+'</option>';
  const acctInfo=counts.account>0?'<div style="padding:12px 16px;border-radius:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);margin-bottom:16px;"><div style="font-size:12px;color:rgba(255,255,255,0.7);"><span class="material-symbols-rounded" style="font-size:14px;color:#22c55e;vertical-align:middle;">check_circle</span> Hiện có <strong style="color:#22c55e;">'+counts.account+'</strong> tài khoản đã thiết lập.</div></div>':'';
  return cardShell(stepHeader('account_balance',5,'Tài khoản ngân hàng & Quỹ tiền mặt','Thiết lập tài khoản thanh toán để quản lý dòng tiền thu chi.')
    +'<form id="form-step5" onsubmit="event.preventDefault();saveStep5AndAdvance();">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">'
    +'<div style="grid-column:span 2;">'+fmtLabel('Tên tài khoản giao dịch',false)+fmtInput('step5_account_name','VD: Tài khoản chính Vietcombank','')+'</div>'
    +'<div>'+fmtLabel('Ngân hàng',false)+'<select id="step5_bank_name" class="form-input" style="width:100%;padding:10px 14px;background:rgba(10,20,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;">'+bopts+'</select></div>'
    +'<div>'+fmtLabel('Số tài khoản',false)+fmtInput('step5_account_number','VD: 0011001234567','')+'</div>'
    +'<div>'+fmtLabel('Loại tiền tệ',false)+'<input type="text" id="step5_currency" readonly class="form-input" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:rgba(255,255,255,0.45);" value="'+cur+'"></div>'
    +'<div style="grid-column:span 2;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);"><input type="checkbox" id="step5_create_cash" checked style="accent-color:#f97316;width:18px;height:18px;flex-shrink:0;"><label for="step5_create_cash" style="cursor:pointer;font-size:13px;color:rgba(255,255,255,0.8);">Tự động tạo kèm <strong style="color:white;">Quỹ tiền mặt ('+cur+')</strong></label></div>'
    +'</div>'+acctInfo
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">'
    +'<button type="button" onclick="window.setSetupStep(4)" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Quay lại</button>'
    +'<div style="display:flex;gap:10px;align-items:center;"><button type="button" onclick="window.setSetupStep(6)" style="padding:9px 14px;border:none;background:transparent;color:rgba(255,255,255,0.45);font-size:12.5px;cursor:pointer;">Bỏ qua bước này</button>'
    +'<button type="submit" style="display:flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,0.35);"><span>Lưu và xem tổng kết</span><span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span></button>'
    +'</div></div></form>');
}
window.saveStep5AndAdvance=async function(){
  const an=document.getElementById('step5_account_name')?.value?.trim(),bn=document.getElementById('step5_bank_name')?.value?.trim(),num=document.getElementById('step5_account_number')?.value?.trim(),cur=document.getElementById('step5_currency')?.value||'VND',cc=document.getElementById('step5_create_cash')?.checked??true;
  try{showToast('Đang lưu tài khoản tiền...','info');const res=await apiPost('/system-setup/quick-account',{account_name:an,bank_name:bn,account_number:num,currency:cur,create_cash:cc});if(res.success){showToast('Đã thiết lập tài khoản!','success');window.setupCurrentStep=6;await renderSetupContent();}else showToast(res.error||'Lưu thất bại','error');}catch(err){showToast('Lỗi: '+err.message,'error');}
};

// ── STEP 6 ──
function renderStep6HTML(counts,comp){
  const name=escapeHTML(comp.company_fullname||comp.company_shortname||'TeraX');
  const summaryItems=[{label:'Thông tin công ty',val:counts.my_company||0,unit:'công ty',color:'#f97316',done:counts.my_company>0},{label:'Phòng ban',val:counts.department||0,unit:'phòng ban',color:'#38bdf8',done:counts.department>0},{label:'Nhân viên',val:counts.employee||0,unit:'nhân viên',color:'#22c55e',done:counts.employee>0},{label:'Quy trình',val:counts.policy_and_program||0,unit:'quy trình',color:'#a855f7',done:counts.policy_and_program>0},{label:'Tài khoản tiền',val:counts.account||0,unit:'tài khoản',color:'#fbbf24',done:counts.account>0}];
  let sumCards='';
  for(const s of summaryItems)sumCards+='<div style="padding:14px 12px;border-radius:12px;background:'+(s.done?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.03)')+';border:1px solid '+(s.done?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)')+';text-align:center;"><div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;">'+(s.done?'<span class="material-symbols-rounded" style="font-size:14px;color:#22c55e;">check_circle</span>':'<span class="material-symbols-rounded" style="font-size:14px;color:rgba(255,255,255,0.2);">radio_button_unchecked</span>')+'<span style="font-size:11px;font-weight:600;color:'+(s.done?'#22c55e':'rgba(255,255,255,0.3)')+';">'+(s.done?'Hoàn thành':'Chưa thiết lập')+'</span></div><div style="font-size:22px;font-weight:800;color:'+(s.done?s.color:'rgba(255,255,255,0.2)')+';">'+s.val+'</div><div style="font-size:11px;color:'+(s.done?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)')+';">'+s.unit+'</div><div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">'+s.label+'</div></div>';
  const qaActions=[{icon:'post_add',color:'#f97316',bg:'rgba(249,115,22,0.15)',title:'Tạo yêu cầu đầu tiên',desc:'Trải nghiệm quy trình phê duyệt và xử lý công việc.',action:'request',btn:'Tạo yêu cầu'},{icon:'task_alt',color:'#38bdf8',bg:'rgba(56,189,248,0.15)',title:'Giao nhiệm vụ',desc:'Phân công công việc và theo dõi tiến độ.',action:'assigned_task',btn:'Tạo nhiệm vụ'},{icon:'bar_chart',color:'#22c55e',bg:'rgba(34,197,94,0.15)',title:'Xem báo cáo',desc:'Khám phá các báo cáo quản trị có sẵn.',action:'home',btn:'Xem báo cáo'},{icon:'badge',color:'#a855f7',bg:'rgba(168,85,247,0.15)',title:'Quản lý nhân sự',desc:'Cập nhật thông tin nhân viên, phòng ban.',action:'employee',btn:'Xem danh sách'}];
  let qaCards='';
  for(const q of qaActions)qaCards+='<div style="padding:16px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:10px;"><div style="width:38px;height:38px;border-radius:10px;background:'+q.bg+';display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:20px;color:'+q.color+';">'+q.icon+'</span></div><div style="font-size:13px;font-weight:700;color:white;">'+q.title+'</div><div style="font-size:11.5px;color:rgba(255,255,255,0.5);line-height:1.4;flex:1;">'+q.desc+'</div><button onclick="completeSetupWizard(\''+q.action+'\')" style="width:100%;padding:8px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;cursor:pointer;">'+q.btn+'</button></div>';
  const resources=[{icon:'menu_book',color:'#38bdf8',title:'Hướng dẫn sử dụng',desc:'Tìm hiểu các tính năng cơ bản'},{icon:'play_circle',color:'#f97316',title:'Video hướng dẫn',desc:'Xem video thao tác chi tiết'},{icon:'table_chart',color:'#22c55e',title:'Thư viện quy trình mẫu',desc:'Tham khảo các quy trình phổ biến'},{icon:'help',color:'#a78bfa',title:'Câu hỏi thường gặp',desc:'Giải đáp các thắc mắc'}];
  let resItems='';
  for(const r of resources)resItems+='<button style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;width:100%;"><div style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:18px;color:'+r.color+';">'+r.icon+'</span></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+r.title+'</div><div style="font-size:10.5px;color:rgba(255,255,255,0.45);">'+r.desc+'</div></div><span class="material-symbols-rounded" style="font-size:15px;color:rgba(255,255,255,0.3);flex-shrink:0;">chevron_right</span></button>';
  return '<div style="display:flex;gap:20px;align-items:flex-start;">'
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px;">'
    +'<div style="background:linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.9));border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:32px;color:white;overflow:hidden;position:relative;">'
    +'<div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,0.15),transparent 70%);pointer-events:none;"></div>'
    +'<div style="display:flex;align-items:center;gap:20px;"><div style="flex:1;">'
    +'<div style="font-size:13px;color:#f97316;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px;"><span style="font-size:16px;">🎉</span> Hoàn tất thiết lập!</div>'
    +'<h2 style="font-size:24px;font-weight:800;color:white;margin-bottom:10px;">TeraX đã sẵn sàng để sử dụng</h2>'
    +'<p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:20px;">Môi trường làm việc của <strong style="color:white;">'+name+'</strong> đã được thiết lập. Hãy bắt đầu khám phá TeraX.</p>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;"><button onclick="completeSetupWizard()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(249,115,22,0.4);"><span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span> Vào hệ thống ngay</button>'
    +'<button style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.25);background:transparent;color:white;font-size:13.5px;font-weight:600;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:17px;">play_circle</span> Xem hướng dẫn nhanh</button>'
    +'</div></div>'
    +'<div style="width:120px;flex-shrink:0;text-align:center;"><div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,rgba(249,115,22,0.25),rgba(34,197,94,0.15));border:2px solid rgba(249,115,22,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto;"><span class="material-symbols-rounded" style="font-size:48px;color:#f97316;">verified</span></div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:10px;">Cùng TeraX vận hành hiệu quả hơn</div></div>'
    +'</div></div>'
    +'<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:white;">Tổng quan thiết lập</div><button onclick="window.setSetupStep(1)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);font-size:11.5px;cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">settings</span> Chỉnh sửa thiết lập</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'+sumCards+'</div></div>'
    +'<div><div style="font-size:13px;font-weight:700;color:white;margin-bottom:12px;">Bắt đầu với TeraX</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">'+qaCards+'</div></div>'
    +'</div>'
    +'<div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">'
    +'<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;color:white;"><div style="font-size:13px;font-weight:700;margin-bottom:12px;">Tài nguyên hữu ích</div><div style="display:flex;flex-direction:column;gap:2px;">'+resItems+'</div></div>'
    +'<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;color:white;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><div style="width:34px;height:34px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="font-size:18px;color:#f97316;">headset_mic</span></div><div><div style="font-size:12px;font-weight:700;">Bạn cần hỗ trợ?</div><div style="font-size:10.5px;color:rgba(255,255,255,0.5);">Đội ngũ TeraX luôn sẵn sàng.</div></div></div><button style="width:100%;padding:9px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:white;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-symbols-rounded" style="font-size:15px;">chat</span> Liên hệ hỗ trợ →</button></div>'
    +'<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:16px;color:white;"><div style="font-size:11.5px;color:rgba(255,255,255,0.55);line-height:1.6;font-style:italic;margin-bottom:10px;">"Cảm ơn bạn đã tin tưởng TeraX. Chúng tôi cam kết tiếp tục đồng hành để doanh nghiệp của bạn vận hành hiệu quả và phát triển bền vững."</div><div style="font-size:11px;color:rgba(255,255,255,0.4);font-weight:600;">— Đội ngũ TeraX</div></div>'
    +'</div></div>';
}

// ── SYSTEM CONTROLS ──
window.completeSetupWizard=async function(redirectTo){
  try{showToast('Đang kích hoạt hệ thống...','info');const res=await apiPost('/system-setup/complete');if(res.success){showToast('Kích hoạt thành công!','success');window.setupCompleted=true;document.body.classList.remove('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='none';window.location.hash=redirectTo||'home';}else showToast('Lỗi kích hoạt: '+(res.message||'Unknown error'),'error');}catch(err){showToast('Lỗi server: '+err.message,'error');}
};
window.resetSetupStatusDev=async function(){
  if(!confirm('Khôi phục lại chế độ Setup? Các chức năng sẽ bị khóa cho đến khi hoàn thành lại.'))return;
  try{const res=await apiPost('/system-setup/reset');if(res.success){showToast('Đã khôi phục chế độ setup.','success');window.setupCompleted=false;window.setupCurrentStep=1;document.body.classList.add('setup-active');const ns=document.getElementById('nav-setup');if(ns)ns.style.display='flex';window.location.hash='setup';await renderSetupContent();}}catch(err){showToast('Lỗi: '+err.message,'error');}
};
window.downloadSetupTemplate=function(moduleKey){const mod=(typeof MODULES!=='undefined')?MODULES[moduleKey]:null;if(!mod){showToast('Không tìm thấy cấu hình mẫu cho module này.','warning');return;}const headers=mod.fields.filter(f=>!f.section&&f.key&&f.type!=='file'&&!f.hidden).map(f=>f.key);if(!headers.length){showToast('Không tìm thấy trường cấu hình.','warning');return;}const ws=XLSX.utils.json_to_sheet([{}],{header:headers});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,(mod.label||moduleKey).substring(0,30));XLSX.writeFile(wb,moduleKey+'_template.xlsx');showToast('Đã tải xuống mẫu: '+moduleKey+'_template.xlsx','success');};
window.importSetupFile=async function(event,moduleKey){const file=event.target.files[0];if(!file)return;showToast('Đang phân tích...','info');const reader=new FileReader();reader.onload=async(e)=>{try{const data=new Uint8Array(e.target.result);const wb=XLSX.read(data,{type:'array'});let jsonData=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!jsonData.length){showToast('Tệp trống.','warning');return;}showToast('Đang nhập '+jsonData.length+' bản ghi...','info');let tn=moduleKey==='policy'?'policy_and_program':moduleKey;const res=await apiPost('/table/'+tn+'/bulk',jsonData);showToast(res.message||'Nhập thành công!','success');await renderSetupContent();}catch(err){showToast('Tải lên thất bại: '+err.message,'error');}finally{event.target.value='';}};reader.readAsArrayBuffer(file);};
