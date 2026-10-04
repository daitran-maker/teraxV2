/**
 * CRC App - Global Inline Comment Handlers
 * Extracted as part of Phase 2 Modularization
 */

// ============================================================
// GLOBAL INLINE COMMENT HANDLERS (Multi-tab Safe & Context-aware)
// ============================================================
window.addInlineTag = function (el, email, fullName) {
  const commentBox = el.closest('.inline-comment-box');
  if (!commentBox) return;
  if (!commentBox.selectedInlineTags) commentBox.selectedInlineTags = [];
  if (!commentBox.selectedInlineTags.includes(email)) {
    commentBox.selectedInlineTags.push(email);
    window.renderSelectedTags(commentBox);
  }
  const searchInput = commentBox.querySelector('#tag-search-input');
  if (searchInput) searchInput.value = '';
  const dropdown = commentBox.querySelector('#tag-search-dropdown');
  if (dropdown) dropdown.style.display = 'none';
};

window.removeInlineTag = function (el, email) {
  const commentBox = el.closest('.inline-comment-box');
  if (!commentBox) return;
  if (!commentBox.selectedInlineTags) commentBox.selectedInlineTags = [];
  commentBox.selectedInlineTags = commentBox.selectedInlineTags.filter(e => e !== email);
  window.renderSelectedTags(commentBox);
};

window.renderSelectedTags = function (commentBox) {
  if (!commentBox) return;
  const container = commentBox.querySelector('#selected-tags-chips');
  if (!container) return;

  if (!commentBox.selectedInlineTags || commentBox.selectedInlineTags.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = commentBox.selectedInlineTags.map(email => {
    const name = (window.inlineEmpOpts || []).find(o => o.email === email)?.full_name || email.split('@')[0];
    return `
      <span class="modern-tag-chip">
        @${escapeHTML(name)}
        <span class="remove-btn" onclick="window.removeInlineTag(this, '${escapeHTML(email)}')">&times;</span>
      </span>
    `;
  }).join('');
};

window.filterInlineTags = function (inputEl) {
  const query = inputEl.value;
  const commentBox = inputEl.closest('.inline-comment-box');
  if (!commentBox) return;
  const dropdown = commentBox.querySelector('#tag-search-dropdown');
  if (!dropdown) return;

  if (!query) {
    dropdown.style.display = 'none';
    return;
  }

  const filtered = (window.inlineEmpOpts || []).filter(o =>
    (o.full_name || '').toLowerCase().includes(query.toLowerCase()) ||
    (o.email || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div style="padding:8px 12px; font-size:11px; color:var(--text-muted);">No matching employees</div>';
  } else {
    dropdown.innerHTML = filtered.map(o => `
      <div class="tag-dropdown-item" onclick="window.addInlineTag(this, '${escapeHTML(o.email)}', '${escapeHTML(o.full_name || '')}')">
        <strong>${escapeHTML(o.full_name || '')}</strong> <span style="opacity:0.7; font-size:10px;">(${escapeHTML(o.email)})</span>
      </div>
    `).join('');
  }
  dropdown.style.display = 'block';
};

window.submitInlineComment = async function (btn, parentKey, parentPkVal, childKey = 'comment') {
  const commentBox = btn.closest('.inline-comment-box');
  if (!commentBox) return;

  if (commentBox._isSubmitting) return;
  commentBox._isSubmitting = true;
  btn.disabled = true;
  const origOpacity = btn.style.opacity;
  btn.style.opacity = '0.5';

  const textEl = commentBox.querySelector('#inline-comment-text');
  const linkEl = commentBox.querySelector('#inline-comment-link');
  const fileEl = commentBox.querySelector('#inline-comment-file-b64');
  const nameEl = commentBox.querySelector('#inline-file-name');

  if (nameEl && nameEl.textContent.includes('Uploading')) {
    showToast(typeof t === 'function' ? t('msg.file_uploading', 'File is still uploading, please wait a moment...') : 'File is still uploading, please wait a moment...', 'warning');
    commentBox._isSubmitting = false;
    btn.disabled = false;
    btn.style.opacity = origOpacity;
    return;
  }

  const text = textEl ? textEl.value : '';
  const link = linkEl ? linkEl.value : '';
  const file = fileEl ? fileEl.value : '';

  const tags = commentBox.selectedInlineTags || [];

  if (!text && !file && !link) {
    showToast(typeof t === 'function' ? t('toast.empty_comment', 'Please enter a comment or attach a file/link') : 'Please enter a comment or attach a file/link', 'error');
    commentBox._isSubmitting = false;
    btn.disabled = false;
    btn.style.opacity = origOpacity;
    return;
  }

  let dbCol = parentKey;
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(parentKey)) dbCol = 'request';
  else if (parentKey === 'support' || parentKey === 'ticket') dbCol = 'ticket';

  const body = {
    [dbCol]: parentPkVal,
    comment: text,
    link: link,
    file: file,
    tag: tags.join(',')
  };

  try {
    await apiPost('/table/' + childKey, body);
    showToast(typeof t === 'function' ? t('toast.comment_sent', 'Comment sent!') : 'Comment sent!', 'success');
    if (textEl) textEl.value = '';
    if (linkEl) linkEl.value = '';
    if (fileEl) fileEl.value = '';
    if (nameEl) nameEl.textContent = '';
    commentBox.selectedInlineTags = [];
    window.renderSelectedTags(commentBox);

    // Reload the child table in the correct pane
    clearChildTableCache(childKey, parentKey, parentPkVal);
    markReportPanesDirty([childKey, getActiveHashModule()]);
    loadChildTable(childKey, parentKey, parentPkVal);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    commentBox._isSubmitting = false;
    btn.disabled = false;
    btn.style.opacity = origOpacity;
  }
};

function renderGmailProgressHTML(fileName, fileSizeMB, pct, isUploaded = false, error = null, showRemoveBtn = true) {
  const isComplete = pct >= 100 || isUploaded;
  const barColor = error ? '#ef4444' : (isComplete ? '#10b981' : '#f97316');
  const pctText = error ? 'Failed' : (isComplete ? '100% (Completed)' : `${pct}%`);
  const statusIcon = error ? 'error' : (isComplete ? 'check_circle' : 'upload');
  const displayName = typeof truncateFileName === 'function' ? truncateFileName(fileName, 28) : (fileName && fileName.length > 28 ? fileName.substring(0, 16) + '...' + fileName.slice(-8) : fileName);

  return `
    <div class="gmail-attachment-card" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:0; display:flex; flex-direction:column; justify-content:center; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.03); width:100%; min-height:84px; min-width:0; box-sizing:border-box;">
      <div style="display:flex; align-items:center; gap:10px; width:100%; min-width:0;">
        <span class="material-symbols-rounded" style="font-size:22px; color:${barColor}; flex-shrink:0;">${statusIcon}</span>
        <div style="display:flex; flex-direction:column; flex:1; min-width:0; overflow:hidden;">
          <span title="${escapeHTML(fileName)}" style="font-size:13px; font-weight:600; color:#1E293B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; width:100%; min-width:0;">${escapeHTML(displayName)}</span>
          <span style="font-size:11px; color:#64748B; margin-top:2px;">${fileSizeMB ? fileSizeMB + ' MB' : ''}</span>
        </div>
        <span style="font-size:11.5px; font-weight:700; color:${barColor}; flex-shrink:0; text-align:right; margin-left:auto; white-space:nowrap;">${pctText}</span>
        ${showRemoveBtn ? `<button onclick="window.removeInlineAttachment(this)" style="background:none; border:none; font-size:16px; color:#94A3B8; cursor:pointer; padding:0 4px; line-height:1; flex-shrink:0;" title="Remove file">×</button>` : ''}
      </div>
      <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden; position:relative; width:100%;">
        <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:3px; transition:width 0.2s ease-out;"></div>
      </div>
    </div>
  `;
}
window.renderGmailProgressHTML = renderGmailProgressHTML;

window.removeInlineAttachment = function (btn) {
  const commentBox = btn.closest('.inline-comment-box');
  if (!commentBox) return;
  const input = commentBox.querySelector('#inline-comment-file');
  const b64Input = commentBox.querySelector('#inline-comment-file-b64');
  const progressContainer = commentBox.querySelector('#inline-file-progress');
  const sendBtn = commentBox.querySelector('button[onclick*="submitInlineComment"]');

  if (input) input.value = '';
  if (b64Input) b64Input.value = '';
  if (progressContainer) progressContainer.innerHTML = '';
  if (sendBtn) sendBtn.disabled = false;
};

window.handleInlineFileChange = function (input) {
  const file = input.files[0];
  const commentBox = input.closest('.inline-comment-box');
  if (!commentBox) return;

  let progressContainer = commentBox.querySelector('#inline-file-progress');
  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'inline-file-progress';
    const actionRow = commentBox.querySelector('button[onclick*="submitInlineComment"]').closest('div');
    actionRow.parentNode.insertBefore(progressContainer, actionRow.nextSibling);
  }

  const b64Input = commentBox.querySelector('#inline-comment-file-b64');
  const sendBtn = commentBox.querySelector('button[onclick*="submitInlineComment"]');

  if (file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast(typeof t === 'function' ? t('toast.file_too_large', 'File too large! Max size is 10MB.') : 'File too large! Max size is 10MB.', 'error');
      input.value = '';
      if (progressContainer) progressContainer.innerHTML = '';
      if (b64Input) b64Input.value = '';
      return;
    }

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    progressContainer.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0);
    if (sendBtn) sendBtn.disabled = true;

    uploadBinaryFile(file, pct => {
      if (progressContainer) progressContainer.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, pct);
    })
      .then(url => {
        if (b64Input) b64Input.value = url;
        if (progressContainer) progressContainer.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 100, true);
        if (sendBtn) sendBtn.disabled = false;
      })
      .catch(err => {
        console.error('Inline upload failed:', err);
        showToast('File upload failed: ' + err.message, 'error');
        if (progressContainer) progressContainer.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0, false, err.message);
        if (sendBtn) sendBtn.disabled = false;
      });
  } else {
    if (progressContainer) progressContainer.innerHTML = '';
    if (b64Input) b64Input.value = '';
  }
};

async function uploadBinaryFile(file, onProgress) {
  const token = localStorage.getItem('crc_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const CHUNK_SIZE = 750 * 1024; // 750 KB per chunk (guaranteed 100% under 1MB limit!)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = Date.now() + '_' + Math.floor(Math.random() * 10000);
  let finalUrl = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunk = file.slice(start, end);

    if (typeof onProgress === 'function') {
      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(pct);
    }

    const res = await fetch(`/api/upload-chunk?name=${encodeURIComponent(file.name)}&uploadId=${uploadId}&chunkIndex=${i}&totalChunks=${totalChunks}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream'
      },
      body: chunk
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Chunk ${i + 1}/${totalChunks} upload failed`);
    }
    if (json.url) finalUrl = json.url;
  }

  return finalUrl;
}

function processInlineNonImage(file, dataUrl, b64Input, nameSpan) {
  if (file) {
    if (nameSpan) nameSpan.textContent = file.name + ' (Uploading 0%)...';
    uploadBinaryFile(file, pct => {
      if (nameSpan) nameSpan.textContent = `${file.name} (Uploading ${pct}%)...`;
    })
      .then(url => {
        if (b64Input) b64Input.value = url;
        if (nameSpan) nameSpan.textContent = file.name + ' (Uploaded)';
      })
      .catch(err => {
        console.error('Inline upload failed:', err);
        if (b64Input) b64Input.value = dataUrl || '';
        if (nameSpan) nameSpan.textContent = file.name;
      });
  } else {
    if (b64Input) b64Input.value = dataUrl || '';
  }
}

window.replyToComment = function (btn, authorEmail, commentId, pKey, pPkVal) {
  const wrapper = btn.closest('.comments-wrapper');
  if (!wrapper) return;
  const commentBox = wrapper.querySelector('.inline-comment-box');
  const text = commentBox ? commentBox.querySelector('#inline-comment-text') : null;
  if (text) {
    const mention = `@${authorEmail.split('@')[0]} `;
    if (!text.value.includes(mention)) {
      text.value = mention + text.value;
    }
    text.focus();
  }
  if (authorEmail && authorEmail.includes('@') && commentBox) {
    window.addInlineTag(commentBox, authorEmail, authorEmail.split('@')[0]);
  }
};

if (!window.hasTagClickOutsideListener) {
  window.hasTagClickOutsideListener = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.inline-comment-box').forEach(box => {
      const dropdown = box.querySelector('#tag-search-dropdown');
      const input = box.querySelector('#tag-search-input');
      if (dropdown && e.target !== dropdown && e.target !== input && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  });
}

