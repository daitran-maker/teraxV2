/**
 * CRC App - Automation View
 * Extracted as part of Modularization
 */

function formatAutomationDate(value) {
  if (!value) return '-';
  return formatDateTime(value) || '-';
}

function automationBadge(text, tone = 'neutral') {
  const styles = {
    active: 'background:#ECFDF5;color:#047857;border-color:#A7F3D0;',
    inactive: 'background:#FEF2F2;color:#B91C1C;border-color:#FECACA;',
    app: 'background:#EFF6FF;color:#1D4ED8;border-color:#BFDBFE;',
    database: 'background:#F5F3FF;color:#6D28D9;border-color:#DDD6FE;',
    neutral: 'background:#F8FAFC;color:#475569;border-color:#E2E8F0;'
  };
  return `<span style="display:inline-flex;align-items:center;height:24px;padding:0 8px;border:1px solid;border-radius:6px;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;${styles[tone] || styles.neutral}">${escapeHTML(text)}</span>`;
}

async function loadAutomationView() {
  currentModule = 'automation';
  currentView = 'table';
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.id === 'nav-automation');
  });

  const content = document.getElementById('content');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarSubtitle = document.getElementById('topbar-subtitle');
  const topbarActions = document.getElementById('topbar-actions-custom');
  if (topbarTitle) topbarTitle.innerHTML = 'Automation';
  if (topbarSubtitle) topbarSubtitle.textContent = 'Manage hard-code and database automations';
  if (topbarActions) topbarActions.innerHTML = '';
  updatePaneMeta('Automation');

  content.innerHTML = `<div class="loading"><div class="spinner"></div> Loading automations...</div>`;
  try {
    const automations = await apiGet('/automations');
    const appCount = automations.filter(a => a.source === 'app').length;
    const dbCount = automations.filter(a => a.source === 'database').length;
    const activeCount = automations.filter(a => a.active).length;
    const totalRuns = automations.reduce((sum, a) => sum + Number(a.run_count || 0), 0);

    content.innerHTML = `
      <div class="view active" id="view-automation" style="display:flex;flex-direction:column;height:100%;overflow:hidden;background:#FFFFFF;font-family:'Inter',sans-serif;">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;padding:16px 24px;border-bottom:1px solid #E5E7EB;background:#F8FAFC;">
          ${renderAutomationStat('Total', automations.length, 'rule_settings')}
          ${renderAutomationStat('App', appCount, 'code')}
          ${renderAutomationStat('Database', dbCount, 'storage')}
          ${renderAutomationStat('Runs', totalRuns, 'history')}
        </div>
        <div class="dv-search-header" style="padding:12px 24px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #E5E7EB;background:#FFFFFF;height:72px;flex-shrink:0;">
          <div style="position:relative;flex:1;min-width:220px;height:48px;">
            <span class="material-symbols-rounded" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:18px;color:#6B7280;">search</span>
            <input id="automation-search" type="text" class="search-input form-input" placeholder="Search automation..." oninput="filterAutomationRows()" style="padding:12px 16px 12px 44px;width:100%;border-radius:8px;border:1px solid #E5E7EB;height:48px;font-size:13px;font-family:'Inter',sans-serif;color:#111827;background:#FFFFFF;">
          </div>
          <select id="automation-source-filter" onchange="filterAutomationRows()" style="height:40px;border:1px solid #E5E7EB;border-radius:6px;padding:0 10px;font-size:12px;font-family:'Inter',sans-serif;color:#374151;background:#FFFFFF;">
            <option value="">All sources</option>
            <option value="app">App</option>
            <option value="database">Database</option>
          </select>
          <select id="automation-active-filter" onchange="filterAutomationRows()" style="height:40px;border:1px solid #E5E7EB;border-radius:6px;padding:0 10px;font-size:12px;font-family:'Inter',sans-serif;color:#374151;background:#FFFFFF;">
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div class="table-wrapper" style="flex:1;overflow:auto;">
          <table class="data-table">
            <thead>
              <tr class="header-row">
                <th>Automation</th>
                <th>Source</th>
                <th>Tables</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Runs</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody id="automation-tbody">
              ${automations.map(renderAutomationRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    window.automationRows = automations;
  } catch (err) {
    content.innerHTML = `<div style="padding:24px;color:#B91C1C;font-size:13px;">Failed to load automations: ${escapeHTML(err.message)}</div>`;
  }
}

function renderAutomationStat(label, value, icon) {
  return `
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <span class="material-symbols-rounded" style="font-size:22px;color:#EA580C;">${icon}</span>
      <div>
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;">${label}</div>
        <div style="font-size:22px;color:#111827;font-weight:700;line-height:1.2;">${value}</div>
      </div>
    </div>
  `;
}

function renderAutomationRow(item) {
  const tableText = (item.tables || []).slice(0, 4).join(', ') + ((item.tables || []).length > 4 ? ` +${item.tables.length - 4}` : '');
  return `
    <tr class="automation-row" data-source="${escapeHTML(item.source)}" data-active="${item.active ? 'active' : 'inactive'}" data-search="${escapeHTML(`${item.name} ${item.description} ${item.trigger} ${(item.tables || []).join(' ')}`.toLowerCase())}" onclick="window.location.hash='automation/${encodeURIComponent(item.id)}'" style="cursor:pointer;">
      <td>
        <div style="font-size:13px;font-weight:700;color:#111827;">${escapeHTML(item.name)}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px;">${escapeHTML(item.id)}</div>
      </td>
      <td>${automationBadge(item.source === 'database' ? 'Database' : 'App', item.source)}</td>
      <td style="font-size:12px;color:#374151;">${escapeHTML(tableText || '-')}</td>
      <td style="font-size:12px;color:#374151;max-width:360px;">${escapeHTML(item.trigger || '-')}</td>
      <td>${automationBadge(item.active ? 'Active' : 'Inactive', item.active ? 'active' : 'inactive')}</td>
      <td style="font-size:12px;font-weight:700;color:#111827;">${Number(item.run_count || 0)}</td>
      <td style="font-size:12px;color:#64748B;">${formatAutomationDate(item.last_run_at)}</td>
    </tr>
  `;
}

function filterAutomationRows() {
  const q = (document.getElementById('automation-search')?.value || '').toLowerCase();
  const source = document.getElementById('automation-source-filter')?.value || '';
  const active = document.getElementById('automation-active-filter')?.value || '';
  document.querySelectorAll('.automation-row').forEach(row => {
    const matchText = !q || row.dataset.search.includes(q);
    const matchSource = !source || row.dataset.source === source;
    const matchActive = !active || row.dataset.active === active;
    row.style.display = (matchText && matchSource && matchActive) ? '' : 'none';
  });
}

async function loadAutomationDetail(automationId) {
  currentModule = 'automation';
  currentView = 'detail';
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.id === 'nav-automation');
  });
  const content = document.getElementById('content');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarSubtitle = document.getElementById('topbar-subtitle');
  const topbarActions = document.getElementById('topbar-actions-custom');
  if (topbarTitle) topbarTitle.innerHTML = 'Automation Detail';
  if (topbarSubtitle) topbarSubtitle.textContent = automationId;
  if (topbarActions) topbarActions.innerHTML = '';
  updatePaneMeta('Automation Detail');

  content.innerHTML = `<div class="loading"><div class="spinner"></div> Loading automation detail...</div>`;
  try {
    const item = await apiGet(`/automations/${encodeURIComponent(automationId)}`);
    if (topbarTitle) topbarTitle.innerHTML = escapeHTML(item.name);
    if (topbarSubtitle) topbarSubtitle.textContent = item.description || '';
    content.innerHTML = renderAutomationDetail(item);
  } catch (err) {
    content.innerHTML = `<div style="padding:24px;color:#B91C1C;font-size:13px;">Failed to load automation: ${escapeHTML(err.message)}</div>`;
  }
}

function renderAutomationDetail(item) {
  const logs = item.logs || [];
  return `
    <div class="view active automation-detail detail-view-2" style="display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F8FAFC;font-family:'Inter',sans-serif;">
      <div class="detail-layout" style="display:flex;gap:24px;padding:24px;flex:1;min-height:0;overflow:hidden;background:#F8FAFC;">
        <div class="detail-left" style="flex:0 0 42%;max-width:42%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:24px;display:flex;flex-direction:column;gap:18px;box-shadow:0 1px 3px rgba(0,0,0,0.04);overflow:auto;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
            <div>
              <button class="btn btn-outline btn-sm" onclick="window.location.hash='automation'" style="margin-bottom:14px;"><span class="material-symbols-rounded" style="font-size:16px;">arrow_back</span> Back</button>
              <div style="font-size:20px;font-weight:800;color:#111827;line-height:1.25;">${escapeHTML(item.name)}</div>
              <div style="font-size:12px;color:#64748B;margin-top:6px;">${escapeHTML(item.id)}</div>
            </div>
            <button class="btn btn-sm" onclick="toggleAutomationActive('${escapeHTML(item.id)}', ${item.active ? 'false' : 'true'})" style="background:${item.active ? '#FEF2F2' : '#ECFDF5'};color:${item.active ? '#B91C1C' : '#047857'};border:1px solid ${item.active ? '#FECACA' : '#A7F3D0'};">
              <span class="material-symbols-rounded" style="font-size:16px;">${item.active ? 'pause_circle' : 'play_circle'}</span>
              ${item.active ? 'Set Inactive' : 'Set Active'}
            </button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${automationBadge(item.source === 'database' ? 'Database' : 'App', item.source)}
            ${automationBadge(item.active ? 'Active' : 'Inactive', item.active ? 'active' : 'inactive')}
            ${automationBadge(item.type || 'automation')}
          </div>
          ${automationInfoBlock('Tables', (item.tables || []).join(', ') || '-')}
          ${automationInfoBlock('Trigger', item.trigger || '-')}
          ${automationInfoBlock('Condition', item.condition || '-')}
          ${automationInfoBlock('Schedule', item.schedule || '-')}
          ${automationInfoBlock('Output', item.output || '-')}
          ${automationInfoBlock('Description', item.description || '-')}
          ${automationInfoBlock('Code Location', item.code_location || '-')}
        </div>
        <div class="detail-right" style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;">
          <div class="detail-right-card" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:20px;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(0,0,0,0.04);flex:1;min-height:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <div>
                <div style="font-size:14px;font-weight:800;color:#111827;">Automation Run Logs</div>
                <div style="font-size:11px;color:#64748B;margin-top:3px;">${Number(item.run_count || 0)} total runs, showing latest ${logs.length}</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="loadAutomationDetail('${escapeHTML(item.id)}')"><span class="material-symbols-rounded" style="font-size:16px;">refresh</span> Refresh</button>
            </div>
            <div class="table-wrapper" style="flex:1;overflow:auto;border:1px solid #E5E7EB;border-radius:8px;">
              <table class="data-table">
                <thead>
                  <tr class="header-row">
                    <th>Run At</th>
                    <th>Status</th>
                    <th>Table</th>
                    <th>Record</th>
                    <th>Changed Columns</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.length ? logs.map(renderAutomationLogRow).join('') : `<tr><td colspan="6" style="text-align:center;color:#64748B;font-size:12px;padding:24px;">No run logs yet.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function automationInfoBlock(label, value) {
  return `
    <div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:6px;">${escapeHTML(label)}</div>
      <div style="font-size:13px;color:#111827;line-height:1.5;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;">${escapeHTML(value)}</div>
    </div>
  `;
}

function renderAutomationLogRow(log) {
  const output = log.output_snapshot ? JSON.stringify(log.output_snapshot) : '-';
  const columns = Array.isArray(log.changed_columns) ? log.changed_columns.join(', ') : '-';
  return `
    <tr>
      <td style="font-size:12px;color:#374151;">${formatAutomationDate(log.run_at)}</td>
      <td>${automationBadge(log.status || 'success', log.status === 'failed' ? 'inactive' : 'active')}</td>
      <td style="font-size:12px;color:#374151;">${escapeHTML(log.table_name || '-')}</td>
      <td style="font-size:12px;color:#374151;">${escapeHTML(log.record_id || '-')}</td>
      <td style="font-size:12px;color:#374151;">${escapeHTML(columns)}</td>
      <td style="font-size:11px;color:#64748B;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(output)}">${escapeHTML(output)}</td>
    </tr>
  `;
}

async function toggleAutomationActive(automationId, active) {
  try {
    await apiPut(`/automations/${encodeURIComponent(automationId)}/active`, { active });
    await loadAutomationDetail(automationId);
  } catch (err) {
    alert(`Failed to update automation status: ${err.message}`);
  }
}


// Window Bridge for Automation View
window.loadAutomationView = loadAutomationView;
window.loadAutomationDetail = loadAutomationDetail;
window.toggleAutomationActive = toggleAutomationActive;
