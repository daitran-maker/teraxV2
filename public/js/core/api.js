/**
 * CRC App - Core HTTP & API Client
 * Extracted as part of Phase 2 Modularization
 * All functions are safely mounted to window.* for zero-regression backward compatibility.
 */

const API_BASE = '/api';
window.API_BASE = API_BASE;

function redirectToAccessDenied() {
  const returnTo = window.location.hash || '';
  window.location.href = `/access-denied.html?returnTo=${encodeURIComponent(returnTo)}`;
}
window.redirectToAccessDenied = redirectToAccessDenied;

function isAccessDeniedError(err) {
  const msg = String(err && err.message ? err.message : err || '').toLowerCase();
  return msg.includes('access denied') ||
    msg.includes('permission') ||
    msg.includes('403');
}
window.isAccessDeniedError = isAccessDeniedError;

async function apiFetch(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('crc_token');
  const user = localStorage.getItem('crc_user');

  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + endpoint, {
    method,
    headers,
    cache: 'no-store',
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();

  if (res.status === 401) {
    localStorage.removeItem('crc_token');
    window.location.href = '/login.html';
    return;
  }

  let json = null;
  let isJson = false;
  try {
    json = JSON.parse(text);
    isJson = true;
  } catch (parseErr) {
    isJson = false;
  }

  if (isJson) {
    if (res.status === 403) {
      const msg = json.error_code ? (typeof t === 'function' ? t(json.error_code, json.error) : json.error) : (json.error || 'Access denied (403)');
      throw new Error(msg);
    }
    if (!res.ok) {
      let msg = json.error_code ? (typeof t === 'function' ? t(json.error_code, json.error) : json.error) : (json.error || 'Request failed');
      if (json.details) {
        let detailStr = '';
        if (Array.isArray(json.details)) {
          detailStr = json.details.map(d => typeof d === 'string' ? d : `${d.field ? d.field + ': ' : ''}${d.message || d.error || JSON.stringify(d)}`).join(', ');
        } else if (typeof json.details === 'string') {
          detailStr = json.details;
        } else if (typeof json.details === 'object') {
          detailStr = Object.entries(json.details).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        if (detailStr) {
          msg = `${msg}: ${detailStr}`;
        }
      }
      throw new Error(msg);
    }
    return json;
  } else {
    if (res.status === 403) {
      throw new Error('Access denied (403): You do not have permission to perform this action.');
    }
    if (!res.ok) {
      const errorSnippet = text.length > 150 ? text.substring(0, 150) + '...' : text;
      throw new Error(`Server returned error ${res.status}: ${errorSnippet || 'Unknown error'}`);
    }
    throw new Error('Server returned invalid data format. Please check Console.');
  }
}
window.apiFetch = apiFetch;

async function apiGet(path) { return apiFetch(path); }
window.apiGet = apiGet;

async function apiPost(path, body) { return apiFetch(path, 'POST', body); }
window.apiPost = apiPost;

async function apiPut(path, body) { return apiFetch(path, 'PUT', body); }
window.apiPut = apiPut;

async function apiDelete(path) { return apiFetch(path, 'DELETE'); }
window.apiDelete = apiDelete;

function getRecordEndpoint(moduleKey, pkVal, withParams = true) {
  const mod = typeof MODULES !== 'undefined' ? MODULES[moduleKey] : null;
  if (!mod) return '';
  if (moduleKey === 'permissions') {
    return `/permissions/column-permissions/${pkVal}`;
  }
  let endpoint = mod.endpoint;
  if (endpoint.startsWith('/my-views/') && moduleKey !== 'request_activity_log') {
    endpoint = `/table/${mod.writeTable || 'request'}`;
  }
  let path = `${endpoint}/${pkVal}`;
  if (withParams && mod.pk) {
    path += `?pk=${mod.pk}`;
  }
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  if (moduleKey === 'request' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule)) {
    path += (path.includes('?') ? '&' : '?') + `view=${hashModule}`;
  }
  return path;
}
window.getRecordEndpoint = getRecordEndpoint;
