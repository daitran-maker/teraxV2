/**
 * TeraX / CRC App - Setup Wizard & Training Dashboard
 * 5-Step Sequential Onboarding Flow + Completion Screen
 */

window.setupCurrentStep = 1;
window.setupWizardData = null;
window.setupParsedEmployees = [];

window.loadSetupView = async function () {
  currentModule = 'setup';
  currentView = 'setup';

  // Update nav UI directly (deactivate all except setup)
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.id === 'nav-setup');
  });

  // Update topbar title & subtitle
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = t('setup.title', 'Setup Wizard & Training Dashboard');
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = t('setup.subtitle', 'Khởi tạo không gian làm việc doanh nghiệp theo 5 bước tiêu chuẩn');
    subtitleEl.style.display = 'block';
  }

  // Clear custom actions
  const actionsEl = document.getElementById('topbar-actions-custom');
  if (actionsEl) actionsEl.innerHTML = '';

  // Hide tabs bar & status cards
  updateGlobalStatusCards('');
  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) tabsBar.style.display = 'none';

  // Render the setup view contents
  await renderSetupContent();
};

window.renderSetupContent = async function () {
  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <div style="padding: 40px; text-align: center; color: white;">
      <div class="spinner" style="margin: 0 auto 12px;"></div> ${t('setup.loading', 'Đang tải thông tin thiết lập...')}
    </div>
  `;

  try {
    const [statusRes, dataRes] = await Promise.all([
      apiGet('/system-setup/status'),
      apiGet('/system-setup/data')
    ]);

    window.setupCompleted = statusRes.setupCompleted;
    window.setupTableCounts = statusRes.tableCounts || {};
    window.setupWizardData = dataRes || {};
  } catch (err) {
    contentEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--accent-red);">
        <span class="material-symbols-rounded" style="font-size:43px;">error</span>
        <div style="font-size:14px; font-weight: 600; margin-top: 10px;">${t('setup.error_load', 'Lỗi tải dữ liệu trạng thái setup')}</div>
        <div style="font-size:12px; margin-top: 5px;">${escapeHTML(err.message)}</div>
      </div>
    `;
    return;
  }

  const counts = window.setupTableCounts || {};
  const comp = window.setupWizardData.company || {};
  const admin = window.setupWizardData.admin || {};
  const currentStep = window.setupCurrentStep || 1;

  // 6 Steps definition
  const stepItems = [
    { num: 1, label: 'Thông tin công ty', icon: 'apartment', count: counts.my_company || 0 },
    { num: 2, label: 'Phòng ban', icon: 'account_tree', count: counts.department || 0 },
    { num: 3, label: 'Nhân sự', icon: 'group', count: counts.employee || 0 },
    { num: 4, label: 'Quy trình', icon: 'policy', count: counts.policy_and_program || 0 },
    { num: 5, label: 'Tài khoản tiền', icon: 'account_balance', count: counts.account || 0 },
    { num: 6, label: 'Bắt đầu sử dụng', icon: 'rocket_launch', count: 1 }
  ];

  const pct = Math.min(100, Math.round(((currentStep - 1) / 5) * 100));

  let html = `
    <div class="detail-scroll" style="max-width: 1100px; margin: 0 auto; width: 100%; padding-bottom: 60px;">
      
      <!-- Stepper Navigation Bar -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); padding: 18px 24px; margin-bottom: 24px; color: white; backdrop-filter: blur(12px); box-shadow: var(--shadow);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
              <span class="material-symbols-rounded" style="color: white; font-size: 20px;">auto_awesome</span>
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: white;">Khởi Tạo Workspace Doanh Nghiệp</div>
              <div style="font-size: 12px; color: var(--text-light-muted);">Bước ${currentStep} / 6 - Tiến độ thiết lập ${pct}%</div>
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" onclick="resetSetupStatusDev()" style="font-size: 11.5px; padding: 6px 12px; background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15);">
              <span class="material-symbols-rounded" style="font-size: 14px;">restart_alt</span> Reset dữ liệu mẫu
            </button>
          </div>
        </div>

        <!-- Stepper Items -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; position: relative;">
          ${stepItems.map(s => {
            const isActive = s.num === currentStep;
            const isCompleted = s.num < currentStep || (s.num !== 6 && s.count > 0);
            return `
              <div onclick="window.setSetupStep(${s.num})" style="cursor: pointer; padding: 10px 8px; border-radius: 12px; text-align: center; background: ${isActive ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isActive ? '#f97316' : (isCompleted ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.08)')}; transition: var(--transition);">
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px;">
                  <span class="material-symbols-rounded" style="font-size: 16px; color: ${isActive ? '#f97316' : (isCompleted ? '#22c55e' : '#94a3b8')};">
                    ${isCompleted && !isActive ? 'check_circle' : s.icon}
                  </span>
                  <span style="font-size: 11px; font-weight: 700; color: ${isActive ? '#f97316' : (isCompleted ? '#22c55e' : '#94a3b8')};">
                    B${s.num}
                  </span>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: ${isActive ? 'white' : 'var(--text-light-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${s.label}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Main Step Body -->
      <div id="setup-step-container">
        ${renderCurrentStepHTML(currentStep, comp, admin, counts)}
      </div>

    </div>
  `;

  contentEl.innerHTML = html;
};

window.setSetupStep = function (stepNum) {
  window.setupCurrentStep = Math.max(1, Math.min(6, stepNum));
  renderSetupContent();
};

function renderCurrentStepHTML(step, comp, admin, counts) {
  switch (step) {
    case 1:
      return renderStep1HTML(comp);
    case 2:
      return renderStep2HTML(counts);
    case 3:
      return renderStep3HTML(counts);
    case 4:
      return renderStep4HTML(counts);
    case 5:
      return renderStep5HTML(comp);
    case 6:
      return renderStep6HTML(counts, comp);
    default:
      return renderStep1HTML(comp);
  }
}

// ============================================================
// STEP 1: THÔNG TIN CÔNG TY
// ============================================================
function renderStep1HTML(comp) {
  const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  const popularCurrencies = ['VND', 'USD', 'EUR', 'SGD', 'JPY', 'CNY', 'THB', 'GBP', 'AUD', 'KRW'];
  const popularCountries = [
    { code: 'Vietnam', name: 'Việt Nam' },
    { code: 'United States', name: 'Hoa Kỳ' },
    { code: 'Singapore', name: 'Singapore' },
    { code: 'Japan', name: 'Nhật Bản' },
    { code: 'Korea', name: 'Hàn Quốc' },
    { code: 'China', name: 'Trung Quốc' },
    { code: 'Thailand', name: 'Thái Lan' },
    { code: 'Malaysia', name: 'Malaysia' },
    { code: 'Germany', name: 'Đức' },
    { code: 'United Kingdom', name: 'Vương Quốc Anh' }
  ];

  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 28px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #f97316;">apartment</span>
            1. Thông Tin Công Ty & Nhận Diện Doanh Nghiệp
          </h3>
          <p style="font-size: 12.5px; color: var(--text-light-muted); margin: 0;">
            Thông tin được kế thừa tự động từ quá trình đăng ký Workspace. Bạn có thể kiểm tra và cập nhật thêm.
          </p>
        </div>
        <span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: rgba(249, 115, 22, 0.2); color: #f97316; font-weight: 600;">
          Bắt buộc tối thiểu
        </span>
      </div>

      <form id="form-step1" onsubmit="event.preventDefault(); saveStep1AndAdvance();">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          
          <div class="form-group" style="grid-column: span 2;">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Tên đầy đủ công ty / doanh nghiệp <span style="color: #ef4444;">*</span>
            </label>
            <input type="text" id="step1_fullname" class="form-input" required style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" value="${escapeHTML(comp.company_fullname || '')}" placeholder="VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ TERAX">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Tên viết tắt / Brand Name <span style="color: #ef4444;">*</span>
            </label>
            <input type="text" id="step1_shortname" class="form-input" required style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" value="${escapeHTML(comp.company_shortname || '')}" placeholder="VD: TERAX">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Mã số thuế doanh nghiệp
            </label>
            <input type="text" id="step1_tax_code" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" value="${escapeHTML(comp.tax_code || '')}" placeholder="VD: 0101234567">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Quốc gia <span style="color: #ef4444;">*</span>
            </label>
            <select id="step1_country" class="form-input" required style="width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;">
              ${popularCountries.map(c => `
                <option value="${c.code}" ${((comp.country || 'Vietnam').toLowerCase() === c.code.toLowerCase()) ? 'selected' : ''}>
                  ${c.name} (${c.code})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Đơn vị tiền tệ chính <span style="color: #ef4444;">*</span>
            </label>
            <select id="step1_currency" class="form-input" required style="width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;">
              ${popularCurrencies.map(cur => `
                <option value="${cur}" ${((comp.base_currency || 'VND').toUpperCase() === cur) ? 'selected' : ''}>
                  ${cur} - ${cur === 'VND' ? 'Việt Nam Đồng' : (cur === 'USD' ? 'Đô la Mỹ' : cur)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Địa chỉ trụ sở chính
            </label>
            <input type="text" id="step1_address" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" value="${escapeHTML(comp.address || '')}" placeholder="VD: Tầng 5, Tòa nhà Landmark, Hà Nội">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Website
            </label>
            <input type="text" id="step1_website" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" value="${escapeHTML(comp.website || '')}" placeholder="https://terax.ai">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Múi giờ hệ thống (Tự động nhận diện)
            </label>
            <input type="text" id="step1_timezone" readonly class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #94a3b8;" value="${defaultTz}">
          </div>

        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 28px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(2)" style="padding: 10px 20px; font-size: 13px; color: #94a3b8; border: none; background: transparent;">
            Bỏ qua bước này
          </button>
          
          <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-size: 13.5px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span>Lưu và tiếp tục</span>
            <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
          </button>
        </div>
      </form>
    </div>
  `;
}

window.saveStep1AndAdvance = async function () {
  const fullname = document.getElementById('step1_fullname')?.value?.trim();
  const shortname = document.getElementById('step1_shortname')?.value?.trim();
  const tax_code = document.getElementById('step1_tax_code')?.value?.trim();
  const country = document.getElementById('step1_country')?.value;
  const currency = document.getElementById('step1_currency')?.value;
  const address = document.getElementById('step1_address')?.value?.trim();
  const website = document.getElementById('step1_website')?.value?.trim();

  if (!fullname || !shortname) {
    showToast('Vui lòng điền tên đầy đủ và tên viết tắt của công ty', 'warning');
    return;
  }

  try {
    showToast('Đang lưu thông tin công ty...', 'info');
    const res = await apiPost('/system-setup/company', {
      company_fullname: fullname,
      company_shortname: shortname,
      tax_code,
      country,
      base_currency: currency,
      address,
      website
    });

    if (res.success) {
      showToast('Đã lưu thông tin công ty thành công!', 'success');
      window.setupCurrentStep = 2;
      await renderSetupContent();
    } else {
      showToast(res.error || 'Lưu thất bại', 'error');
    }
  } catch (err) {
    showToast('Lỗi lưu công ty: ' + err.message, 'error');
  }
};

// ============================================================
// STEP 2: PHÒNG BAN & CƠ CẤU TỔ CHỨC (9 PRESETS)
// ============================================================
const PRESET_DEPARTMENTS = [
  { code: 'BGD', name: 'Ban Giám đốc', type: 'Operation', desc: 'Quản trị điều hành và chiến lược toàn diện', checked: true },
  { code: 'HCNS', name: 'Hành chính - Nhân sự', type: 'Operation', desc: 'Quản lý tuyển dụng, nhân sự và cơ sở vật chất', checked: true },
  { code: 'TCKT', name: 'Tài chính - Kế toán', type: 'Finance', desc: 'Hạch toán thu chi, dòng tiền, công nợ và thuế', checked: true },
  { code: 'KD', name: 'Kinh doanh & Phát triển', type: 'Sale and MKT', desc: 'Tìm kiếm khách hàng, đối tác và doanh số', checked: true },
  { code: 'KT', name: 'Kỹ thuật & Vận hành', type: 'Technical', desc: 'Triển khai kỹ thuật và hỗ trợ vận hành dịch vụ', checked: true },
  { code: 'IT', name: 'Công nghệ thông tin', type: 'Technical', desc: 'Hạ tầng hệ thống, bảo mật và phát triển phần mềm', checked: false },
  { code: 'MH', name: 'Mua hàng & Cung ứng', type: 'Operation', desc: 'Mua sắm vật tư thiết bị và đàm phán nhà cung cấp', checked: false },
  { code: 'CSKH', name: 'Chăm sóc khách hàng', type: 'Sale and MKT', desc: 'Hỗ trợ, tư vấn và duy trì trải nghiệm khách hàng', checked: false },
  { code: 'PC', name: 'Pháp chế & Tuân thủ', type: 'Operation', desc: 'Rà soát pháp lý hợp đồng và quy chuẩn doanh nghiệp', checked: false }
];

function renderStep2HTML(counts) {
  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 28px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #f97316;">account_tree</span>
            2. Cơ Cấu Tổ Chức & Phòng Ban Tiêu Chuẩn
          </h3>
          <p style="font-size: 12.5px; color: var(--text-light-muted); margin: 0;">
            Chọn nhanh các phòng ban mẫu phù hợp với doanh nghiệp của bạn (hoặc tải lên file Excel nếu có sẵn).
          </p>
        </div>
        <div style="font-size: 12px; color: var(--text-light-muted);">
          Hiện có: <strong style="color: #22c55e;">${counts.department || 0}</strong> phòng ban
        </div>
      </div>

      <!-- 9 Preset Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px;">
        ${PRESET_DEPARTMENTS.map((dept, idx) => `
          <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);" class="preset-dept-card">
            <input type="checkbox" name="preset_dept" value="${dept.code}" ${dept.checked ? 'checked' : ''} style="margin-top: 3px; accent-color: #f97316; width: 16px; height: 16px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                <span style="font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(249, 115, 22, 0.2); color: #f97316;">${dept.code}</span>
                <span style="font-size: 13px; font-weight: 700; color: white;">${dept.name}</span>
              </div>
              <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">${dept.desc}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Phân loại: ${dept.type}</div>
            </div>
          </label>
        `).join('')}
      </div>

      <!-- Option to Import Excel instead -->
      <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="material-symbols-rounded" style="color: #38bdf8;">table_view</span>
          <div>
            <div style="font-size: 12.5px; font-weight: 600; color: white;">Hoặc bạn muốn tải lên danh sách phòng ban từ Excel?</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Tải mẫu template và tải lên danh sách phòng ban tùy chỉnh.</div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" onclick="downloadSetupTemplate('department')" style="font-size: 11.5px; padding: 6px 12px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2);">
            Tải mẫu (.xlsx)
          </button>
          <label class="btn btn-secondary" style="font-size: 11.5px; padding: 6px 12px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">
            Tải lên Excel
            <input type="file" accept=".xlsx,.xls" style="display: none;" onchange="importSetupFile(event, 'department')">
          </label>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(1)" style="padding: 10px 18px; font-size: 13px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-rounded" style="font-size: 16px;">arrow_back</span>
          Quay lại
        </button>

        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(3)" style="padding: 10px 18px; font-size: 13px; color: #94a3b8; border: none; background: transparent;">
            Bỏ qua bước này
          </button>
          <button type="button" class="btn btn-primary" onclick="saveStep2AndAdvance()" style="padding: 10px 24px; font-size: 13.5px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span>Tạo các phòng ban đã chọn</span>
            <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

window.saveStep2AndAdvance = async function () {
  const checkboxes = document.querySelectorAll('input[name="preset_dept"]:checked');
  const selectedCodes = Array.from(checkboxes).map(c => c.value);

  if (selectedCodes.length === 0) {
    window.setSetupStep(3);
    return;
  }

  const payload = PRESET_DEPARTMENTS
    .filter(d => selectedCodes.includes(d.code))
    .map(d => ({
      department_code: d.code,
      department_name: d.name,
      type: d.type
    }));

  try {
    showToast(`Đang tạo ${payload.length} phòng ban...`, 'info');
    const res = await apiPost('/system-setup/presets/departments', { departments: payload });
    if (res.success) {
      showToast(`Đã tạo thành công ${res.count} phòng ban mới!`, 'success');
      window.setupCurrentStep = 3;
      await renderSetupContent();
    } else {
      showToast(res.error || 'Lỗi tạo phòng ban', 'error');
    }
  } catch (err) {
    showToast('Lỗi server: ' + err.message, 'error');
  }
};

// ============================================================
// STEP 3: NHÂN SỰ & IMPORT 5 CỘT CỐT LÕI
// ============================================================
function renderStep3HTML(counts) {
  const parsed = window.setupParsedEmployees || [];

  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 28px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #f97316;">group</span>
            3. Danh Sách Nhân Sự Doanh Nghiệp (5 Cột Cốt Lõi)
          </h3>
          <p style="font-size: 12.5px; color: var(--text-light-muted); margin: 0;">
            Nhập nhanh danh sách nhân viên từ Excel với 5 thông tin cơ bản. Hệ thống tự động tạo mã nhân viên và kích hoạt trạng thái.
          </p>
        </div>
        <div style="font-size: 12px; color: var(--text-light-muted);">
          Hiện có: <strong style="color: #22c55e;">${counts.employee || 0}</strong> nhân viên
        </div>
      </div>

      <!-- 5 Columns Explanation Banner -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #f97316;">Cột 1</div>
          <div style="font-size: 12px; font-weight: 600; color: white;">Họ và tên *</div>
          <div style="font-size: 10.5px; color: #94a3b8;">Bắt buộc</div>
        </div>
        <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #f97316;">Cột 2</div>
          <div style="font-size: 12px; font-weight: 600; color: white;">Email công việc *</div>
          <div style="font-size: 10.5px; color: #94a3b8;">Dùng đăng nhập</div>
        </div>
        <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #f97316;">Cột 3</div>
          <div style="font-size: 12px; font-weight: 600; color: white;">Mã/Tên phòng ban</div>
          <div style="font-size: 10.5px; color: #94a3b8;">Khớp với Bước 2</div>
        </div>
        <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #f97316;">Cột 4</div>
          <div style="font-size: 12px; font-weight: 600; color: white;">Chức danh / Vị trí</div>
          <div style="font-size: 10.5px; color: #94a3b8;">Mặc định: Nhân viên</div>
        </div>
        <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #f97316;">Cột 5</div>
          <div style="font-size: 12px; font-weight: 600; color: white;">Email người QLTT</div>
          <div style="font-size: 10.5px; color: #94a3b8;">Để duyệt quy trình</div>
        </div>
      </div>

      <!-- File Dropzone -->
      <div style="border: 2px dashed rgba(249, 115, 22, 0.4); border-radius: 14px; padding: 28px; text-align: center; background: rgba(249, 115, 22, 0.03); margin-bottom: 20px;">
        <span class="material-symbols-rounded" style="font-size: 40px; color: #f97316; margin-bottom: 8px;">upload_file</span>
        <div style="font-size: 14px; font-weight: 700; color: white; margin-bottom: 4px;">Kéo & Thả file Excel (.xlsx, .xls, .csv) vào đây</div>
        <div style="font-size: 12px; color: var(--text-light-muted); margin-bottom: 14px;">hoặc nhấn nút bên dưới để chọn file từ máy tính của bạn</div>
        
        <div style="display: flex; gap: 12px; justify-content: center; align-items: center;">
          <button type="button" class="btn btn-secondary" onclick="downloadEmployeeTemplate()" style="font-size: 12px; padding: 8px 16px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2);">
            <span class="material-symbols-rounded" style="font-size: 16px;">download</span> Tải file mẫu 5 cột (.xlsx)
          </button>

          <label class="btn btn-primary" style="font-size: 12px; padding: 8px 18px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-rounded" style="font-size: 16px;">folder_open</span> Chọn file Excel
            <input type="file" accept=".xlsx,.xls,.csv" style="display: none;" onchange="handleEmployeeExcelUpload(event)">
          </label>
        </div>
      </div>

      <!-- Preview Table if parsed -->
      ${parsed.length > 0 ? `
        <div style="margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; background: rgba(0,0,0,0.25);">
          <div style="padding: 10px 16px; background: rgba(255,255,255,0.05); font-size: 12px; font-weight: 700; color: white; display: flex; justify-content: space-between; align-items: center;">
            <span>Xem trước danh sách (${parsed.length} dòng hợp lệ)</span>
            <button type="button" onclick="window.setupParsedEmployees = []; renderSetupContent();" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer;">Xóa xem trước</button>
          </div>
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8;">
                  <th style="padding: 8px 12px;">#</th>
                  <th style="padding: 8px 12px;">Họ và tên</th>
                  <th style="padding: 8px 12px;">Email</th>
                  <th style="padding: 8px 12px;">Phòng ban</th>
                  <th style="padding: 8px 12px;">Chức danh</th>
                  <th style="padding: 8px 12px;">Quản lý trực tiếp</th>
                </tr>
              </thead>
              <tbody>
                ${parsed.map((e, idx) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 6px 12px; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 6px 12px; font-weight: 600; color: white;">${escapeHTML(e.full_name || '')}</td>
                    <td style="padding: 6px 12px; color: #38bdf8;">${escapeHTML(e.email || '')}</td>
                    <td style="padding: 6px 12px;">${escapeHTML(e.department_code || e.department_name || '-')}</td>
                    <td style="padding: 6px 12px;">${escapeHTML(e.position || 'Nhân viên')}</td>
                    <td style="padding: 6px 12px; color: #94a3b8;">${escapeHTML(e.direct_manager || '-')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(2)" style="padding: 10px 18px; font-size: 13px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-rounded" style="font-size: 16px;">arrow_back</span>
          Quay lại
        </button>

        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(4)" style="padding: 10px 18px; font-size: 13px; color: #94a3b8; border: none; background: transparent;">
            Bỏ qua bước này
          </button>
          <button type="button" class="btn btn-primary" onclick="saveStep3AndAdvance()" style="padding: 10px 24px; font-size: 13.5px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span>${parsed.length > 0 ? `Nhập ${parsed.length} nhân sự & Tiếp tục` : 'Tiếp tục bước tiếp theo'}</span>
            <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

window.downloadEmployeeTemplate = function () {
  const headers = ['Họ và tên *', 'Email *', 'Phòng ban (Mã hoặc Tên)', 'Chức vụ', 'Email Quản lý trực tiếp'];
  const sampleData = [
    {
      'Họ và tên *': 'Nguyễn Văn Quản Lý',
      'Email *': 'manager@company.com',
      'Phòng ban (Mã hoặc Tên)': 'KD',
      'Chức vụ': 'Trưởng phòng Kinh doanh',
      'Email Quản lý trực tiếp': ''
    },
    {
      'Họ và tên *': 'Trần Thị Chuyên Viên',
      'Email *': 'staff@company.com',
      'Phòng ban (Mã hoặc Tên)': 'KD',
      'Chức vụ': 'Chuyên viên Kinh doanh',
      'Email Quản lý trực tiếp': 'manager@company.com'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NhanVien');
  XLSX.writeFile(workbook, 'Mau_Nhap_Nhan_Su_5_Cot.xlsx');
  showToast('Đã tải xuống file mẫu nhân viên 5 cột', 'success');
};

window.handleEmployeeExcelUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });

      if (!rows || rows.length === 0) {
        showToast('Tệp Excel không có dòng dữ liệu nào', 'warning');
        return;
      }

      // Map dynamic column names to 5 fields
      const mapped = [];
      for (const r of rows) {
        const keys = Object.keys(r);
        const nameKey = keys.find(k => /tên|name|họ/i.test(k));
        const emailKey = keys.find(k => /email|thư/i.test(k));
        const deptKey = keys.find(k => /phòng|dept|ban/i.test(k));
        const posKey = keys.find(k => /chức|vị trí|title|position/i.test(k));
        const mgrKey = keys.find(k => /quản lý|manager|ql/i.test(k));

        const fullName = nameKey ? String(r[nameKey]).trim() : '';
        const email = emailKey ? String(r[emailKey]).trim() : '';

        if (fullName && email) {
          mapped.push({
            full_name: fullName,
            email: email,
            department_code: deptKey ? String(r[deptKey]).trim() : '',
            position: posKey ? String(r[posKey]).trim() : 'Nhân viên',
            direct_manager: mgrKey ? String(r[mgrKey]).trim() : ''
          });
        }
      }

      if (mapped.length === 0) {
        showToast('Không tìm thấy dòng nào hợp lệ có đầy đủ Họ tên và Email', 'warning');
        return;
      }

      window.setupParsedEmployees = mapped;
      showToast(`Đã nhận diện thành công ${mapped.length} nhân viên từ file`, 'success');
      renderSetupContent();
    } catch (err) {
      showToast('Lỗi đọc file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
};

window.saveStep3AndAdvance = async function () {
  const employees = window.setupParsedEmployees || [];
  if (employees.length === 0) {
    window.setSetupStep(4);
    return;
  }

  try {
    showToast(`Đang nhập ${employees.length} nhân sự vào hệ thống...`, 'info');
    const res = await apiPost('/system-setup/import-employees', { employees });
    if (res.success) {
      showToast(`Đã nhập thành công ${res.count} nhân sự mới!`, 'success');
      window.setupParsedEmployees = [];
      window.setupCurrentStep = 4;
      await renderSetupContent();
    } else {
      showToast(res.error || 'Lỗi nhập nhân sự', 'error');
    }
  } catch (err) {
    showToast('Lỗi server: ' + err.message, 'error');
  }
};

// ============================================================
// STEP 4: QUY TRÌNH PHÊ DUYỆT (TIER 1 DIRECT MANAGER)
// ============================================================
const PRESET_POLICIES = [
  { id: 'P-LEAVE', name: 'Đơn xin nghỉ phép', type: 'Operation', elements: 'ASSIGN_TASK', sla: 1, desc: 'Quy trình nhân viên gửi đơn xin nghỉ ốm, nghỉ phép năm hoặc việc riêng', checked: true },
  { id: 'P-RECRUIT', name: 'Đề xuất tuyển dụng', type: 'Operation', elements: 'ASSIGN_TASK', sla: 3, desc: 'Đề xuất bổ sung nhân sự từ các bộ phận kèm định biên và mô tả công việc', checked: true },
  { id: 'P-ONBOARD', name: 'Tiếp nhận nhân viên mới (Onboarding)', type: 'Operation', elements: 'ASSIGN_TASK', sla: 2, desc: 'Quy trình cấp tài khoản, thiết bị và bàn giao công việc cho nhân viên mới', checked: true },
  { id: 'P-ADVANCE', name: 'Đề nghị tạm ứng & hoàn ứng', type: 'Finance', elements: 'EXPENSE', sla: 2, desc: 'Đề xuất tạm ứng công tác phí và duyệt hoàn ứng chứng từ chi phí thực tế', checked: true }
];

function renderStep4HTML(counts) {
  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 28px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #f97316;">policy</span>
            4. Quy Trình Phê Duyệt Cốt Lõi (Cấu hình duyệt Quản Lý Trực Tiếp)
          </h3>
          <p style="font-size: 12.5px; color: var(--text-light-muted); margin: 0;">
            Các quy trình được cài đặt sẵn cơ chế phê duyệt 1 tầng là Quản lý trực tiếp (Direct Manager) của người gửi.
          </p>
        </div>
        <div style="font-size: 12px; color: var(--text-light-muted);">
          Hiện có: <strong style="color: #22c55e;">${counts.policy_and_program || 0}</strong> quy trình
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
        ${PRESET_POLICIES.map((p, idx) => `
          <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 14px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);">
            <input type="checkbox" name="preset_policy" value="${p.id}" ${p.checked ? 'checked' : ''} style="margin-top: 4px; accent-color: #f97316; width: 18px; height: 18px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 13.5px; font-weight: 700; color: white;">${p.name}</span>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${p.type}</span>
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 8px;">${p.desc}</div>
              <div style="display: flex; gap: 12px; font-size: 11px; color: #cbd5e1;">
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span class="material-symbols-rounded" style="font-size: 14px; color: #22c55e;">check_circle</span> Duyệt: Quản lý trực tiếp (T1)
                </span>
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span class="material-symbols-rounded" style="font-size: 14px; color: #fbbf24;">timer</span> SLA: ${p.sla} ngày
                </span>
              </div>
            </div>
          </label>
        `).join('')}
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(3)" style="padding: 10px 18px; font-size: 13px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-rounded" style="font-size: 16px;">arrow_back</span>
          Quay lại
        </button>

        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(5)" style="padding: 10px 18px; font-size: 13px; color: #94a3b8; border: none; background: transparent;">
            Bỏ qua bước này
          </button>
          <button type="button" class="btn btn-primary" onclick="saveStep4AndAdvance()" style="padding: 10px 24px; font-size: 13.5px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span>Khởi tạo quy trình đã chọn</span>
            <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

window.saveStep4AndAdvance = async function () {
  const checkboxes = document.querySelectorAll('input[name="preset_policy"]:checked');
  const selectedIds = Array.from(checkboxes).map(c => c.value);

  if (selectedIds.length === 0) {
    window.setSetupStep(5);
    return;
  }

  const payload = PRESET_POLICIES
    .filter(p => selectedIds.includes(p.id))
    .map(p => ({
      policy_name: p.name,
      policy_type: p.type,
      description: p.desc,
      elements: p.elements,
      sla: p.sla
    }));

  try {
    showToast(`Đang khởi tạo ${payload.length} quy trình mẫu...`, 'info');
    const res = await apiPost('/system-setup/presets/policies', { policies: payload });
    if (res.success) {
      showToast(`Đã tạo thành công ${res.count} quy trình mẫu!`, 'success');
      window.setupCurrentStep = 5;
      await renderSetupContent();
    } else {
      showToast(res.error || 'Lỗi khởi tạo quy trình', 'error');
    }
  } catch (err) {
    showToast('Lỗi server: ' + err.message, 'error');
  }
};

// ============================================================
// STEP 5: TÀI KHOẢN TIỀN (NGÂN HÀNG & TIỀN MẶT)
// ============================================================
function renderStep5HTML(comp) {
  const cur = comp.base_currency || 'VND';

  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 28px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #f97316;">account_balance</span>
            5. Tài Khoản Ngân Hàng & Quỹ Tiền Mặt
          </h3>
          <p style="font-size: 12.5px; color: var(--text-light-muted); margin: 0;">
            Thiết lập tài khoản thanh toán ban đầu để sẵn sàng quản lý dòng tiền thu chi của công ty.
          </p>
        </div>
      </div>

      <form id="form-step5" onsubmit="event.preventDefault(); saveStep5AndAdvance();">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          
          <div class="form-group" style="grid-column: span 2;">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Tên tài khoản giao dịch
            </label>
            <input type="text" id="step5_account_name" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" placeholder="VD: Tài khoản chính Vietcombank">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Tên ngân hàng
            </label>
            <input type="text" id="step5_bank_name" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" placeholder="VD: Vietcombank / Techcombank / BIDV...">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Số tài khoản ngân hàng
            </label>
            <input type="text" id="step5_account_number" class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;" placeholder="VD: 0011001234567">
          </div>

          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">
              Loại tiền tệ
            </label>
            <input type="text" id="step5_currency" readonly class="form-input" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #94a3b8;" value="${cur}">
          </div>

          <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 24px;">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px; color: white;">
              <input type="checkbox" id="step5_create_cash" checked style="accent-color: #f97316; width: 18px; height: 18px;">
              <span>Tự động tạo kèm <strong>Quỹ tiền mặt (${cur})</strong></span>
            </label>
          </div>

        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(4)" style="padding: 10px 18px; font-size: 13px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-rounded" style="font-size: 16px;">arrow_back</span>
            Quay lại
          </button>

          <div style="display: flex; gap: 12px;">
            <button type="button" class="btn btn-secondary" onclick="window.setSetupStep(6)" style="padding: 10px 18px; font-size: 13px; color: #94a3b8; border: none; background: transparent;">
              Bỏ qua bước này
            </button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-size: 13.5px; border-radius: 8px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>Lưu và xem tổng kết</span>
              <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

window.saveStep5AndAdvance = async function () {
  const account_name = document.getElementById('step5_account_name')?.value?.trim();
  const bank_name = document.getElementById('step5_bank_name')?.value?.trim();
  const account_number = document.getElementById('step5_account_number')?.value?.trim();
  const currency = document.getElementById('step5_currency')?.value || 'VND';
  const create_cash = document.getElementById('step5_create_cash')?.checked ?? true;

  try {
    showToast('Đang lưu tài khoản tiền...', 'info');
    const res = await apiPost('/system-setup/quick-account', {
      account_name,
      bank_name,
      account_number,
      currency,
      create_cash
    });

    if (res.success) {
      showToast('Đã thiết lập tài khoản tiền thành công!', 'success');
      window.setupCurrentStep = 6;
      await renderSetupContent();
    } else {
      showToast(res.error || 'Lưu thất bại', 'error');
    }
  } catch (err) {
    showToast('Lỗi server: ' + err.message, 'error');
  }
};

// ============================================================
// STEP 6: MÀN HÌNH HOÀN TẤT & KÍCH HOẠT HỆ THỐNG
// ============================================================
function renderStep6HTML(counts, comp) {
  const coreCompleted = (counts.my_company > 0 && counts.employee > 0);

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Success Celebration Card -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); padding: 32px; color: white; backdrop-filter: blur(12px); box-shadow: var(--shadow); text-align: center;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(34, 197, 94, 0.35);">
          <span class="material-symbols-rounded" style="font-size: 36px; color: white;">verified</span>
        </div>
        
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: white;">
          Chúc mừng! Không Gian Làm Việc Đã Sẵn Sàng 🎉
        </h2>
        <p style="font-size: 13.5px; color: #cbd5e1; max-width: 650px; margin: 0 auto 24px; line-height: 1.6;">
          Dữ liệu cấu hình cốt lõi cho doanh nghiệp <strong>${escapeHTML(comp.company_fullname || comp.company_shortname || 'TeraX')}</strong> đã được khởi tạo hoàn tất. Bạn có thể bắt đầu sử dụng toàn bộ tính năng của hệ thống.
        </p>

        <!-- Metric Summary Badges -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; max-width: 750px; margin: 0 auto 28px;">
          <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 20px; font-weight: 800; color: #f97316;">${counts.my_company || 0}</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Công ty</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 20px; font-weight: 800; color: #38bdf8;">${counts.department || 0}</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Phòng ban</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 20px; font-weight: 800; color: #22c55e;">${counts.employee || 0}</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Nhân sự</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 20px; font-weight: 800; color: #a855f7;">${counts.policy_and_program || 0}</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Quy trình</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 20px; font-weight: 800; color: #fbbf24;">${counts.account || 0}</div>
            <div style="font-size: 11px; color: var(--text-light-muted);">Tài khoản</div>
          </div>
        </div>

        <button class="btn btn-primary" onclick="completeSetupWizard()" style="padding: 14px 36px; font-size: 15px; font-weight: 700; border-radius: 12px; background: ${coreCompleted ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#475569'}; cursor: ${coreCompleted ? 'pointer' : 'not-allowed'}; box-shadow: ${coreCompleted ? '0 10px 25px rgba(249, 115, 22, 0.4)' : 'none'}; border: none; display: inline-flex; align-items: center; gap: 10px;">
          <span class="material-symbols-rounded" style="font-size: 22px;">rocket_launch</span>
          <span>Vào Hệ Thống Ngay -></span>
        </button>

        ${!coreCompleted ? `
          <div style="font-size: 12px; color: #ef4444; margin-top: 10px;">
            * Cần hoàn thành tối thiểu thông tin Công ty (B1) và Nhân sự (B3) trước khi kích hoạt.
          </div>
        ` : ''}
      </div>

      <!-- 4 Quick Start Shortcuts -->
      <div>
        <h4 style="font-size: 14px; font-weight: 700; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded" style="color: #38bdf8; font-size: 18px;">bolt</span>
          Bắt đầu các thao tác đầu tiên
        </h4>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
          <div onclick="window.setupCompleted ? window.location.hash = 'request' : completeSetupWizard()" style="cursor: pointer; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(249, 115, 22, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <span class="material-symbols-rounded" style="color: #f97316; font-size: 20px;">post_add</span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: white; margin-bottom: 4px;">Tạo yêu cầu mới</div>
            <div style="font-size: 11px; color: var(--text-light-muted); line-height: 1.4;">Gửi đơn nghỉ phép hoặc đề xuất thanh toán</div>
          </div>

          <div onclick="window.setupCompleted ? window.location.hash = 'assigned_task' : completeSetupWizard()" style="cursor: pointer; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <span class="material-symbols-rounded" style="color: #38bdf8; font-size: 20px;">task_alt</span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: white; margin-bottom: 4px;">Giao việc & Quản lý</div>
            <div style="font-size: 11px; color: var(--text-light-muted); line-height: 1.4;">Phân công công việc và theo dõi tiến độ</div>
          </div>

          <div onclick="window.setupCompleted ? window.location.hash = 'employee' : completeSetupWizard()" style="cursor: pointer; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(34, 197, 94, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <span class="material-symbols-rounded" style="color: #22c55e; font-size: 20px;">badge</span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: white; margin-bottom: 4px;">Hồ sơ nhân sự</div>
            <div style="font-size: 11px; color: var(--text-light-muted); line-height: 1.4;">Xem thông tin nhân viên, chức vụ, quản lý</div>
          </div>

          <div onclick="window.setupCompleted ? window.location.hash = 'payment' : completeSetupWizard()" style="cursor: pointer; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: var(--transition);">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(168, 85, 247, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <span class="material-symbols-rounded" style="color: #a855f7; font-size: 20px;">payments</span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: white; margin-bottom: 4px;">Quản lý tài chính</div>
            <div style="font-size: 11px; color: var(--text-light-muted); line-height: 1.4;">Theo dõi các khoản thu chi và hợp đồng</div>
          </div>
        </div>
      </div>

      <!-- Optional Modules To Configure Later -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 20px; color: white;">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded" style="color: #94a3b8; font-size: 18px;">schedule</span>
          Các bảng dữ liệu có thể thiết lập bổ sung sau này:
        </div>

        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
          <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 11.5px;">
            <div style="font-weight: 600; color: white;">📍 Địa điểm văn phòng</div>
            <div style="font-size: 10.5px; color: #94a3b8;">(${counts.my_location || 0} bản ghi)</div>
          </div>
          <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 11.5px;">
            <div style="font-weight: 600; color: white;">🏬 Khách hàng & NCC</div>
            <div style="font-size: 10.5px; color: #94a3b8;">(${counts.company || 0} bản ghi)</div>
          </div>
          <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 11.5px;">
            <div style="font-weight: 600; color: white;">📎 Người liên hệ đối tác</div>
            <div style="font-size: 10.5px; color: #94a3b8;">(${counts.contact || 0} bản ghi)</div>
          </div>
          <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 11.5px;">
            <div style="font-weight: 600; color: white;">⚙️ Danh mục dịch vụ</div>
            <div style="font-size: 10.5px; color: #94a3b8;">(${counts.service || 0} bản ghi)</div>
          </div>
          <div style="padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 11.5px;">
            <div style="font-weight: 600; color: white;">📦 Tài sản trang thiết bị</div>
            <div style="font-size: 10.5px; color: #94a3b8;">(${counts.asset || 0} bản ghi)</div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ============================================================
// SYSTEM ACTIVATION & RESET HELPERS
// ============================================================
window.completeSetupWizard = async function () {
  try {
    showToast('Đang kích hoạt hệ thống...', 'info');
    const res = await apiPost('/system-setup/complete');
    if (res.success) {
      showToast('Kích hoạt dùng thử thành công!', 'success');
      window.setupCompleted = true;
      document.body.classList.remove('setup-active');
      const navSetup = document.getElementById('nav-setup');
      if (navSetup) navSetup.style.display = 'none';

      window.location.hash = 'employee';
    } else {
      showToast('Lỗi kích hoạt: ' + (res.message || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Lỗi server: ' + err.message, 'error');
  }
};

window.resetSetupStatusDev = async function () {
  try {
    if (!confirm('Bạn có chắc chắn muốn khôi phục lại chế độ Setup không? Hành động này sẽ khóa các chức năng của ứng dụng cho đến khi bạn hoàn thành lại.')) return;
    const res = await apiPost('/system-setup/reset');
    if (res.success) {
      showToast('Đã khôi phục chế độ setup.', 'success');
      window.setupCompleted = false;
      window.setupCurrentStep = 1;
      document.body.classList.add('setup-active');
      const navSetup = document.getElementById('nav-setup');
      if (navSetup) navSetup.style.display = 'flex';
      window.location.hash = 'setup';
      await renderSetupContent();
    }
  } catch (err) {
    showToast('Lỗi khôi phục: ' + err.message, 'error');
  }
};

window.downloadSetupTemplate = function (moduleKey) {
  let configKey = moduleKey;
  const mod = MODULES[configKey];
  if (!mod) return;

  const headers = mod.fields
    .filter(f => !f.section && f.key && f.type !== 'file' && !f.hidden)
    .map(f => f.key);

  if (headers.length === 0) {
    showToast('Không tìm thấy trường cấu hình cho bảng này.', 'warning');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet([{}], { header: headers });
  const workbook = XLSX.utils.book_new();
  const sheetName = mod.label.substring(0, 30);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const filename = `${moduleKey}_template.xlsx`;
  XLSX.writeFile(workbook, filename);
  showToast(`Đã tải xuống mẫu Excel: ${filename}`, 'success');
};

window.importSetupFile = async function (event, moduleKey) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('Đang phân tích...', 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        showToast('Tệp trống.', 'warning');
        return;
      }

      showToast(`Đang nhập ${jsonData.length} bản ghi...`, 'info');

      let tableName = moduleKey;
      if (moduleKey === 'policy') tableName = 'policy_and_program';

      const bulkEndpoint = `/table/${tableName}/bulk`;
      const res = await apiPost(bulkEndpoint, jsonData);
      showToast(res.message || 'Nhập thành công!', 'success');

      await renderSetupContent();
    } catch (err) {
      showToast(`Tải lên thất bại: ${err.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
