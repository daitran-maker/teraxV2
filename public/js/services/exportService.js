/**
 * CRC App - Export / Import Service (XLSX, CSV)
 * Lazy-loads SheetJS on-demand.
 * Extracted as part of Phase 2 Modularization.
 */

async function ensureXLSX() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load SheetJS. Check your internet connection.'));
    document.head.appendChild(script);
  });
}
window.ensureXLSX = ensureXLSX;

window.exportToCSV = async function (moduleKey) {
  if (!window.currentData || window.currentData.length === 0) {
    showToast('No data available to export.', 'warning');
    return;
  }

  try {
    await ensureXLSX();
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  // Create a new sheet from data 
  const worksheet = XLSX.utils.json_to_sheet(window.currentData);
  const workbook = XLSX.utils.book_new();
  const label = (window.MODULES && window.MODULES[moduleKey] && window.MODULES[moduleKey].label) || moduleKey;
  XLSX.utils.book_append_sheet(workbook, worksheet, label.substring(0, 30));

  // Generate download
  XLSX.writeFile(workbook, `${moduleKey}_export_${new Date().getTime()}.xlsx`);
  showToast(`Exported ${window.currentData.length} records successfully.`, 'success');
};

window.importFromCSV = async function (event, moduleKey) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('Parsing file...', 'info');

  try {
    await ensureXLSX();
  } catch (e) {
    showToast(e.message, 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to JSON
      let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        showToast('The uploaded file is empty.', 'warning');
        return;
      }

      // Send to backend /bulk endpoint
      showToast(`Importing ${jsonData.length} records...`, 'info');

      // Always route bulk uploads to the dynamic CRUD router for all tables
      const bulkEndpoint = `/table/${moduleKey}/bulk`;

      const res = await apiPost(bulkEndpoint, jsonData);
      showToast(res.message || 'Import successful!', 'success');

      // Reload Table
      if (typeof window.renderTableView === 'function') {
        await window.renderTableView(moduleKey);
      }
    } catch (err) {
      showToast(`Import Failed: ${err.message}`, 'error');
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
