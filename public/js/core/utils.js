/**
 * CRC App - Core Utility Functions
 * Extracted as part of Phase 2 Modularization
 * All functions are safely mounted to window.* for zero-regression backward compatibility.
 */

// Helper to escape HTML to prevent XSS
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHTML = escapeHTML;

// Helper to handle PostgreSQL bytea Buffer objects sent as JSON
function parseBufferVal(val) {
  if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
    let str = "";
    const chunk = 8192;
    for (let i = 0; i < val.data.length; i += chunk) {
      str += String.fromCharCode.apply(null, val.data.slice(i, i + chunk));
    }
    return str;
  }
  return val;
}
window.parseBufferVal = parseBufferVal;

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
window.debounce = debounce;

// Date & Time Formatting
function formatDateTime(val) {
  if (!val || (typeof val === 'object' && !(val instanceof Date))) return '';

  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'string') {
    const legacyFormat = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
    if (legacyFormat.test(val)) {
      date = new Date(val + ' +07:00');
    } else {
      date = new Date(val);
    }
  } else {
    date = new Date(val);
  }

  if (isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const D = pad(date.getDate());
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthStr = months[date.getMonth()];
  const Y = date.getFullYear();

  return `${D}-${monthStr}-${Y} ${h}:${m}:${s}`;
}
window.formatDateTime = formatDateTime;

function formatDateMON(val) {
  if (!val || (typeof val === 'object' && !(val instanceof Date))) return '';
  if (typeof val === 'string') {
    const ymdMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const monthIdx = parseInt(ymdMatch[2], 10) - 1;
      const day = ymdMatch[3];
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthStr = months[monthIdx] || ymdMatch[2];
      return `${day}-${monthStr}-${year}`;
    }
  }
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${monthStr}-${year}`;
}
window.formatDateMON = formatDateMON;

function formatDate(val) {
  return formatDateMON(val);
}
window.formatDate = formatDate;

// Number & Currency Formatting
function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) return num.toLocaleString('en-US');
  return val;
}
window.formatNumber = formatNumber;

function formatExchangeRate(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return val;
}
window.formatExchangeRate = formatExchangeRate;

function truncateFileName(fileName, maxLen = 30) {
  if (!fileName || typeof fileName !== 'string') return fileName || '';
  if (fileName.length <= maxLen) return fileName;
  const lastDot = fileName.lastIndexOf('.');
  const ext = (lastDot !== -1 && lastDot > fileName.length - 8) ? fileName.substring(lastDot) : '';
  const nameWithoutExt = ext ? fileName.substring(0, lastDot) : fileName;
  const availableLen = maxLen - ext.length - 3;
  if (availableLen <= 4) {
    return fileName.substring(0, maxLen - 3) + '...';
  }
  const frontLen = Math.ceil(availableLen * 0.65);
  const backLen = Math.floor(availableLen * 0.35);
  return `${nameWithoutExt.substring(0, frontLen)}...${nameWithoutExt.slice(-backLen)}${ext}`;
}
window.truncateFileName = truncateFileName;

function formatFileNameDisplay(val, maxLen = 30) {
  if (!val) return '';
  if (typeof val !== 'string') return String(val);
  if (val.startsWith('data:')) return 'Attached File';
  let raw = val.split('/').pop().split('?')[0];
  try { raw = decodeURIComponent(raw); } catch (e) {}
  let cleanName = raw.replace(/^upload_\d+(_\d+)?_/i, '');
  if (cleanName === raw) {
    cleanName = raw.replace(/^[a-zA-Z0-9_-]+_\d{10,}(_\d+)?_/i, '');
  }
  const finalName = cleanName || raw || 'Attachment';
  return truncateFileName(finalName, maxLen);
}
window.formatFileNameDisplay = formatFileNameDisplay;
