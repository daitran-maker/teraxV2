/**
 * CRC App - Setup Wizard & Training Dashboard
 * Extracted as part of Phase 2 Modularization
 */

// ============================================================
// SETUP WIZARD & TRAINING DASHBOARD
// ============================================================
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
    subtitleEl.textContent = t('setup.subtitle', 'Thiết lập dữ liệu ban đầu để kích hoạt hệ thống');
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

  let setupStatus;
  try {
    setupStatus = await apiGet('/system-setup/status');
    window.setupCompleted = setupStatus.setupCompleted;
    window.setupTableCounts = setupStatus.tableCounts;
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

  const steps = [
    {
      key: 'my_company',
      title: t('setup.step.my_company.title', '1. My Company (Công ty của bạn)'),
      desc: t('setup.step.my_company.desc', 'Thông tin công ty nội bộ (Tên ngắn, Tên đầy đủ, Mã số thuế, Website, Địa chỉ, Quốc gia...)'),
      dep: t('setup.step.my_company.dep', 'Bắt đầu ở đây. Cần thiết cho Nhân sự và Quy trình.'),
      icon: '🏢',
      count: counts.my_company || 0,
      req: true
    },
    {
      key: 'my_location',
      title: t('setup.step.my_location.title', '2. Locations (Địa điểm)'),
      desc: t('setup.step.my_location.desc', 'Danh sách địa điểm làm việc/văn phòng của công ty.'),
      dep: t('setup.step.my_location.dep', 'Yêu cầu: My Company.'),
      icon: 'location_on',
      count: counts.my_location || 0,
      req: false
    },
    {
      key: 'department',
      title: t('setup.step.department.title', '3. Departments (Phòng ban)'),
      desc: t('setup.step.department.desc', 'Danh sách phòng ban/đội nhóm thuộc các công ty.'),
      dep: t('setup.step.department.dep', 'Yêu cầu: My Company.'),
      icon: 'account_tree',
      count: counts.department || 0,
      req: false
    },
    {
      key: 'employee',
      title: t('setup.step.employee.title', '4. Employees (Nhân viên)'),
      desc: t('setup.step.employee.desc', 'Danh sách nhân viên, tài khoản email, chức vụ, phòng ban, người quản lý trực tiếp.'),
      dep: t('setup.step.employee.dep', 'Yêu cầu: My Company (để liên kết company_id).'),
      icon: 'group',
      count: counts.employee || 0,
      req: true
    },
    {
      key: 'policy',
      title: t('setup.step.policy.title', '5. Process (Quy trình phê duyệt)'),
      desc: t('setup.step.policy.desc', 'Quy trình xét duyệt yêu cầu (SR), chỉ định người phê duyệt Tier 1, 2, 3 và chủ sở hữu.'),
      dep: t('setup.step.policy.dep', 'Yêu cầu: Employee (để chọn người phê duyệt).'),
      icon: 'policy',
      count: counts.policy_and_program || 0,
      req: false
    },
    {
      key: 'account',
      title: t('setup.step.account.title', '6. Account (Tài khoản Giao dịch)'),
      desc: t('setup.step.account.desc', 'Danh sách tài khoản ngân hàng, ví/quỹ tiền mặt của công ty để quản lý dòng tiền.'),
      dep: t('setup.step.account.dep', 'Yêu cầu: My Company, Employee.'),
      icon: 'account_balance',
      count: counts.account || 0,
      req: false
    },
    {
      key: 'company',
      title: t('setup.step.company.title', '7. Customer / Supplier (Khách hàng & Nhà cung cấp)'),
      desc: t('setup.step.company.desc', 'Danh sách các công ty đối tác, nhà cung cấp, khách hàng giao dịch bên ngoài.'),
      dep: t('setup.step.company.dep', 'Bảng độc lập. Có thể import bất kỳ lúc nào.'),
      icon: 'corporate_fare',
      count: counts.company || 0,
      req: false
    },
    {
      key: 'contact',
      title: t('setup.step.contact.title', '8. Contacts (Người liên hệ đối tác)'),
      desc: t('setup.step.contact.desc', 'Thông tin liên hệ của nhân sự thuộc các công ty đối tác bên ngoài.'),
      dep: t('setup.step.contact.dep', 'Yêu cầu: Customer / Supplier.'),
      icon: 'contacts',
      count: counts.contact || 0,
      req: false
    },
    {
      key: 'service',
      title: t('setup.step.service.title', '9. Services (Dịch vụ)'),
      desc: t('setup.step.service.desc', 'Các gói dịch vụ công ty cung cấp hoặc sử dụng (Subscription, bảo trì, hỗ trợ...).'),
      dep: t('setup.step.service.dep', 'Yêu cầu: Employee.'),
      icon: 'settings_suggest',
      count: counts.service || 0,
      req: false
    },
    {
      key: 'asset',
      title: t('setup.step.asset.title', '10. Assets (Tài sản văn phòng)'),
      desc: t('setup.step.asset.desc', 'Danh sách trang thiết bị, máy móc công ty sở hữu, kèm theo người quản lý/sử dụng.'),
      dep: t('setup.step.asset.dep', 'Yêu cầu: Employee.'),
      icon: 'inventory_2',
      count: counts.asset || 0,
      req: false
    }
  ];

  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.count > 0).length;
  const coreCompleted = (counts.my_company > 0 && counts.employee > 0);

  let html = `
    <div class="detail-scroll" style="max-width: 1200px; margin: 0 auto; width: 100%;">
      <!-- Welcome Banner -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; color: white; backdrop-filter: blur(10px); box-shadow: var(--shadow);">
        <h2 style="font-size:20px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
          <span class="material-symbols-rounded" style="color: #f97316; font-size:27px;">auto_awesome</span>
          ${t('setup.title', 'TeraX App Setup Wizard & Training')}
        </h2>
        <p style="font-size:12.5px; line-height: 1.6; color: var(--text-light-muted); max-width: 900px; margin-bottom: 16px;">
          ${t('setup.desc', 'Hệ thống đang chạy ở chế độ cấu hình ban đầu. Bạn cần thiết lập dữ liệu mẫu hoặc thông tin thực tế cho các bảng chính của doanh nghiệp trước khi bắt đầu sử dụng app. Vui lòng tải các file Excel mẫu (.xlsx) bên dưới, điền dữ liệu theo các cột định sẵn và tải lên hệ thống.')}
        </p>
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; font-size:12px;">
          <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #3b82f6; font-size:16px;">info</span>
            <span>${t('setup.req_rule', 'Quy định bắt buộc: Cần tối thiểu dữ liệu My Company và Employees.')}</span>
          </div>
          
          <button class="btn btn-outline" style="color: #f43f5e; border-color: rgba(244,63,94,0.3); background: rgba(244,63,94,0.05); padding: 6px 12px; font-size:11px;" onclick="resetSetupStatusDev()">
            <span class="material-symbols-rounded" style="font-size:14px;">restart_alt</span> ${t('setup.reset_dev', 'Khôi phục chế độ Setup (Dev)')}
          </button>
        </div>
      </div>

      <!-- Grid of Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px;">
  `;

  steps.forEach(s => {
    const isCompleted = s.count > 0;
    const statusText = isCompleted ? t('setup.imported', 'Đã nhập ({{count}} dòng)').replace('{{count}}', s.count) : t('setup.no_data', 'Chưa có dữ liệu');
    const statusColor = isCompleted ? 'var(--accent-green)' : 'var(--text-muted)';
    const iconClass = s.icon.length > 2 ? 'material-symbols-rounded' : '';
    const reqBadge = s.req ? `<span style="background: rgba(239, 68, 68, 0.15); color: var(--accent-red); font-size:9px; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 8px;">${t('setup.required_badge', 'BẮT BUỘC')}</span>` : '';

    html += `
      <div style="background: var(--bg-card); border: 1px solid ${isCompleted ? 'rgba(22, 163, 74, 0.3)' : 'var(--border)'}; border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 14px; position: relative; box-shadow: var(--shadow-sm); backdrop-filter: blur(10px); transition: all 0.2s ease;">
        
        <!-- Header Info -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:40px; height:40px; border-radius:10px; background: ${isCompleted ? 'rgba(22, 163, 74, 0.1)' : 'rgba(255, 255, 255, 0.15)'}; border: 1px solid ${isCompleted ? 'rgba(22, 163, 74, 0.2)' : 'var(--border-light)'}; display:flex; align-items:center; justify-content:center;">
              <span class="${iconClass}" style="font-size:18px; color: ${isCompleted ? 'var(--accent-green)' : 'var(--accent)'};">${s.icon}</span>
            </div>
            <div>
              <div style="font-size:13px; font-weight: 700; color: var(--text-primary); display:flex; align-items:center; flex-wrap:wrap;">
                ${s.title}
                ${reqBadge}
              </div>
              <div style="font-size:10px; color: ${statusColor}; font-weight: 600; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
                ${statusText}
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p style="font-size:11.5px; color: var(--text-secondary); line-height: 1.5; flex: 1;">
          ${s.desc}
        </p>

        <!-- Dependencies -->
        <div style="font-size:10.5px; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.05); padding: 8px 10px; border-radius: 8px; color: var(--text-muted); display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-rounded" style="font-size:13px;">link</span>
          <span style="font-style: italic;">${s.dep}</span>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 6px; margin-top: auto; border-top: 1px solid var(--border-light); padding-top: 12px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" style="flex: 1; min-width: 65px; justify-content: center; font-size: 11.5px; padding: 6px 8px;" onclick="downloadSetupTemplate('${s.key}')" title="${t('setup.download_template_tip', 'Tải file mẫu Excel')}">
            <span class="material-symbols-rounded" style="font-size:14px;">download</span> ${t('setup.template', 'Mẫu')}
          </button>
          
          <button class="btn btn-secondary btn-sm" style="flex: 1; min-width: 70px; justify-content: center; font-size: 11.5px; padding: 6px 8px;" onclick="document.getElementById('setup-file-input-${s.key}').click()" title="${t('setup.upload_tip', 'Tải lên file Excel/CSV')}">
            <span class="material-symbols-rounded" style="font-size:14px;">upload</span> ${isCompleted ? t('setup.reupload', 'Tải lại') : t('setup.upload', 'Tải lên')}
          </button>
          <input type="file" id="setup-file-input-${s.key}" accept=".xlsx,.csv" onchange="importSetupFile(event, '${s.key}')" style="display:none;" />

          <button class="btn btn-primary btn-sm" style="flex: 1.1; min-width: 80px; justify-content: center; font-size: 11.5px; padding: 6px 8px; background: ${isCompleted ? 'rgba(22, 163, 74, 0.15)' : 'var(--accent)'}; color: ${isCompleted ? 'var(--accent-green)' : 'white'}; border: ${isCompleted ? '1px solid rgba(22, 163, 74, 0.3)' : 'none'};" onclick="openAddModal('${s.key}')" title="${t('setup.quick_add_tip', 'Nhập liệu trực tiếp')}">
            <span class="material-symbols-rounded" style="font-size:14px;">add_circle</span> ${t('setup.quick_add', 'Tạo nhanh')}
          </button>
        </div>
      </div>
    `;
  });

  const progressStatusText = t('setup.completed_status', 'Hoàn thành: {{completed}} / {{total}} bảng dữ liệu.')
    .replace('{{completed}}', completedSteps)
    .replace('{{total}}', totalSteps);

  const reqStatusText = coreCompleted
    ? t('setup.min_met', '🟢 Đã đủ điều kiện tối thiểu để kích hoạt dùng thử!')
    : t('setup.min_not_met', '🔴 Cần hoàn thành ít nhất My Company và Employees.');

  html += `
      </div>

      <!-- Sticky Setup Progress & Complete Action -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius); padding: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: var(--shadow); color: white; backdrop-filter: blur(10px);">
        <div>
          <div style="font-size:14px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: #fbbf24; font-size:18px;">progress_activity</span>
            ${t('setup.progress', 'Tiến trình thiết lập hệ thống')}
          </div>
          <div style="font-size:12px; color: var(--text-light-muted);">
            ${progressStatusText} 
            ${reqStatusText}
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 16px;">
          <button class="btn btn-primary" id="btn-start-trial" style="padding: 12px 24px; font-size:13.5px; border-radius: var(--radius); gap: 10px; background: ${coreCompleted ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#475569'}; cursor: ${coreCompleted ? 'pointer' : 'not-allowed'}; box-shadow: ${coreCompleted ? '0 8px 20px rgba(234, 88, 12, 0.3)' : 'none'}; border: none;" ${coreCompleted ? '' : 'disabled'} onclick="completeSetupWizard()">
            <span class="material-symbols-rounded" style="font-size:18px;">rocket_launch</span>
            🚀 ${t('setup.start_app', 'Bắt đầu dùng thử App')}
          </button>
        </div>
      </div>
    </div>
  `;

  contentEl.innerHTML = html;
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

  showToast(t('toast.parsing_file', 'Đang phân tích...'), 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        showToast(t('toast.empty_file', 'Tệp trống.'), 'warning');
        return;
      }

      showToast(t('toast.importing', 'Đang nhập {{count}} bản ghi...').replace('{{count}}', jsonData.length), 'info');

      let tableName = moduleKey;
      if (moduleKey === 'policy') tableName = 'policy_and_program';

      const bulkEndpoint = `/table/${tableName}/bulk`;
      const res = await apiPost(bulkEndpoint, jsonData);
      showToast(res.message || t('toast.import_success', 'Nhập thành công!'), 'success');

      await renderSetupContent();
    } catch (err) {
      showToast(`Tải lên thất bại: ${err.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

window.completeSetupWizard = async function () {
  try {
    showToast('Đang kích hoạt hệ thống...', 'info');
    const res = await apiPost('/system-setup/complete');
    if (res.success) {
      showToast(t('setup.activate_success', 'Kích hoạt dùng thử thành công!'), 'success');
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
    if (!confirm(t('setup.reset_confirm', 'Bạn có chắc chắn muốn khôi phục lại chế độ Setup không? Hành động này sẽ khóa các chức năng của ứng dụng cho đến khi bạn hoàn thành lại.'))) return;
    const res = await apiPost('/system-setup/reset');
    if (res.success) {
      showToast(t('setup.reset_success', 'Đã khôi phục chế độ setup.'), 'success');
      window.setupCompleted = false;
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
