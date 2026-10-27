/* =========================================================================
   files.js — Files Management Module
   Stand-alone module for file uploads, multi-file renaming, filtering,
   sorting, in-modal previews (PDF, Excel, Word, Image), downloading, and deleting.
   ========================================================================= */

const FilesApp = (() => {
  let allFiles = [];
  let sortColumn = 'date';
  let sortOrder = 'desc';
  let pendingFiles = [];
  let isUploading = false;

  // Helper: Format bytes
  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper: HTML escape
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Helper: Get badge & icon for file type
  function getFileTypeInfo(ext) {
    const e = (ext || '').toLowerCase().replace('.', '');
    if (e === 'pdf') {
      return { label: 'PDF', cls: 'file-badge-pdf', icon: '📄' };
    }
    if (['doc', 'docx'].includes(e)) {
      return { label: 'WORD', cls: 'file-badge-word', icon: '📝' };
    }
    if (['xls', 'xlsx', 'csv'].includes(e)) {
      return { label: 'EXCEL', cls: 'file-badge-excel', icon: '📊' };
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(e)) {
      return { label: 'IMAGE', cls: 'file-badge-image', icon: '🖼️' };
    }
    return { label: e.toUpperCase() || 'FILE', cls: 'file-badge-generic', icon: '📁' };
  }

  // Helper: Format file name with extension
  function getFormattedFileName(file) {
    if (!file) return 'Untitled File';
    let name = (file.fileName || 'Untitled File').trim();
    const ext = (file.ext || '').trim();
    if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) {
      name += ext;
    }
    return name;
  }

  // Open the Upload Modal
  function openUploadModal() {
    renderModalUploadBody();
    const modalEl = document.getElementById('fileUploadModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  // On files selected via file input or drag-and-drop
  function onFilesSelected(source) {
    const fileList = source && source.files ? source.files : (source || []);
    if (!fileList || fileList.length === 0) return;
    const newFiles = Array.from(fileList);

    newFiles.forEach(file => {
      const exists = pendingFiles.some(pf => 
        pf.file.name === file.name && pf.file.size === file.size && pf.file.lastModified === file.lastModified
      );
      if (!exists) {
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const ext = (file.name.slice((file.name.lastIndexOf('.') - 1 >>> 0) + 2) || '').toLowerCase();
        pendingFiles.push({
          id: 'pf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          file: file,
          originalName: file.name,
          customName: baseName,
          size: file.size,
          ext: ext ? `.${ext}` : ''
        });
      }
    });

    if (source && source.value !== undefined) source.value = ''; // Reset input to allow re-selection
    renderModalUploadBody();
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) dropzone.classList.add('drag-over');
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
  }

  function onFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files) {
      onFilesSelected(e.dataTransfer);
    }
  }

  function updatePendingCustomName(id, newName) {
    const item = pendingFiles.find(f => f.id === id);
    if (!item) return;
    let clean = (newName || '').trim();
    if (item.ext && clean.toLowerCase().endsWith(item.ext.toLowerCase())) {
      clean = clean.slice(0, -item.ext.length).trim();
    }
    item.customName = clean;
  }

  function removePendingFile(id) {
    pendingFiles = pendingFiles.filter(f => f.id !== id);
    renderModalUploadBody();
  }

  function clearAllPendingFiles() {
    pendingFiles = [];
    renderModalUploadBody();
  }

  // Render content inside the Upload File Modal
  function renderModalUploadBody() {
    const bodyEl = document.getElementById('fileUploadModalBody');
    const footerEl = document.getElementById('fileUploadModalFooter');
    if (!bodyEl || !footerEl) return;

    if (!pendingFiles || pendingFiles.length === 0) {
      bodyEl.innerHTML = `
        <div class="upload-dropzone p-4 text-center rounded border border-2 border-dashed d-flex flex-column align-items-center justify-content-center cursor-pointer" onclick="document.getElementById('fileInputEl').click()" id="uploadDropzone" ondragover="FilesApp.onDragOver(event)" ondragleave="FilesApp.onDragLeave(event)" ondrop="FilesApp.onFileDrop(event)">
          <div class="upload-dropzone-icon mb-2 text-primary opacity-75">
            <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div class="fw-bold text-dark fs-7 mb-1">Click to browse or drag &amp; drop files here</div>
          <div class="text-muted fs-8 mb-3">Supports Word, PDF, Excel, Images, and Text files</div>
          <button type="button" class="btn btn-sm btn-outline-primary px-3 fs-8 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-xs" onclick="event.stopPropagation(); document.getElementById('fileInputEl').click()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Browse Files</span>
          </button>
        </div>
      `;

      footerEl.innerHTML = `
        <div class="text-muted fs-8">No files selected</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-secondary fs-8 px-3" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-sm btn-primary fs-8 px-4 opacity-50" disabled>Upload File</button>
        </div>
      `;
      return;
    }

    const rowsHtml = pendingFiles.map((item) => {
      return `
        <div class="p-2 border rounded bg-white d-flex align-items-center justify-content-between gap-2 shadow-xs" id="pendingRow_${item.id}">
          <div class="input-group input-group-sm flex-grow-1">
            <input type="text" class="form-control form-control-sm fs-8" id="pendingName_${item.id}" value="${escapeHtml(item.customName)}" placeholder="Enter file name..." oninput="FilesApp.updatePendingCustomName('${item.id}', this.value)">
            <span class="input-group-text bg-light text-secondary font-monospace fs-8 fw-semibold">${escapeHtml(item.ext)}</span>
          </div>
          <button type="button" class="btn btn-xs btn-outline-danger p-1.5 px-2.5 fs-8 rounded d-flex align-items-center justify-content-center flex-shrink-0" onclick="FilesApp.removePendingFile('${item.id}')" title="Remove file">
            ✕
          </button>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = `
      <div class="d-flex flex-column gap-2.5">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-2 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-semibold text-secondary" style="font-size:0.82rem;">Selected Documents:</span>
            <span class="badge bg-primary-subtle text-primary border fs-8">${pendingFiles.length} File${pendingFiles.length === 1 ? '' : 's'}</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-xs btn-outline-primary py-1 px-2.5 d-flex align-items-center gap-1 fs-8" onclick="document.getElementById('fileInputEl').click()">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add More</span>
            </button>
            <button type="button" class="btn btn-xs btn-outline-secondary py-1 px-2 fs-8" onclick="FilesApp.clearAllPendingFiles()" title="Clear all selected files">
              Clear All
            </button>
          </div>
        </div>

        <div class="pending-files-scroll-list d-flex flex-column gap-2" style="max-height: 280px; overflow-y: auto; padding-right: 2px;">
          ${rowsHtml}
        </div>
      </div>
    `;

    footerEl.innerHTML = `
      <div class="text-secondary fs-8">${pendingFiles.length} File${pendingFiles.length === 1 ? '' : 's'} ready to upload</div>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-sm btn-outline-secondary fs-8 px-3" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-sm btn-primary fw-semibold px-4 d-flex align-items-center gap-1.5 shadow-sm fs-8" id="btnUploadAction" onclick="FilesApp.uploadFiles()">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <span id="btnUploadActionText">${pendingFiles.length === 1 ? 'Upload File' : `Upload ${pendingFiles.length} Files`}</span>
        </button>
      </div>
    `;
  }

  // Upload pending files to server
  async function uploadFiles() {
    if (isUploading) return;
    if (!pendingFiles || pendingFiles.length === 0) {
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('Please choose at least one file to upload.', 'warning');
      return;
    }

    const dateInput = document.getElementById('modalUploadDateInput');
    const fileDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().slice(0, 10);
    const uploadBtn = document.getElementById('btnUploadAction');
    const uploadBtnText = document.getElementById('btnUploadActionText');
    const origBtnHtml = uploadBtn ? uploadBtn.innerHTML : '';

    isUploading = true;
    if (uploadBtn) uploadBtn.disabled = true;

    const total = pendingFiles.length;
    let successCount = 0;
    const errors = [];

    for (let i = 0; i < total; i++) {
      const item = pendingFiles[i];
      if (uploadBtnText) {
        uploadBtnText.textContent = `Uploading ${i + 1} of ${total}...`;
      }

      let customName = (item.customName && item.customName.trim())
        ? item.customName.trim()
        : item.originalName.replace(/\.[^/.]+$/, '');
      if (item.ext && !customName.toLowerCase().endsWith(item.ext.toLowerCase())) {
        customName += item.ext;
      }

      try {
        const arrayBuffer = await item.file.arrayBuffer();
        const uploadUrl = `/api/files/upload?fileName=${encodeURIComponent(customName)}&originalName=${encodeURIComponent(item.originalName)}&fileDate=${encodeURIComponent(fileDate)}`;

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: arrayBuffer
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const resJson = await response.json();
        if (!resJson.success) {
          throw new Error(resJson.error || 'Server rejected file upload');
        }

        successCount++;
      } catch (err) {
        console.error(`Error uploading ${item.originalName}:`, err);
        errors.push(`${item.originalName}: ${err.message}`);
      }
    }

    isUploading = false;
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = origBtnHtml;
    }

    if (successCount > 0) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(`Successfully uploaded ${successCount} file${successCount === 1 ? '' : 's'}!`, 'success');
      }
      pendingFiles = [];
      const modalEl = document.getElementById('fileUploadModal');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }
      await loadFiles();
    }

    if (errors.length > 0) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(`Failed to upload ${errors.length} file(s):\n${errors.join('\n')}`, 'danger');
      }
    }
  }

  // Load files list from server
  async function loadFiles() {
    const tbody = document.getElementById('filesTableTbody');
    const countBadge = document.getElementById('lblFilesCount');

    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allFiles = Array.isArray(data.files) ? data.files : (Array.isArray(data.bills) ? data.bills : []);
      filterFiles();
    } catch (err) {
      console.error('Error loading files:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">Failed to load files: ${escapeHtml(err.message)}</td></tr>`;
      }
      if (countBadge) countBadge.textContent = '0 Files';
    }
  }

  // Filter, sort, and render table
  function filterFiles() {
    const tbody = document.getElementById('filesTableTbody');
    const countBadge = document.getElementById('lblFilesCount');
    if (!tbody) return;

    const searchQuery = (document.getElementById('fileSearchQuery')?.value || '').trim().toLowerCase();
    const filterFrom = document.getElementById('fileFilterDateFrom')?.value || '';
    const filterTo = document.getElementById('fileFilterDateTo')?.value || '';

    // Update table header sort indicators
    ['name', 'date'].forEach(col => {
      const icon = document.getElementById(`sortIcon_${col}`);
      if (icon) {
        if (sortColumn === col) {
          icon.textContent = sortOrder === 'asc' ? '▲' : '▼';
          icon.classList.add('text-primary', 'fw-bold');
        } else {
          icon.textContent = '↕';
          icon.classList.remove('text-primary', 'fw-bold');
        }
      }
    });

    // Filter
    let filtered = allFiles.filter(item => {
      if (searchQuery) {
        const fullDisplay = getFormattedFileName(item).toLowerCase();
        const matchName = (item.fileName || '').toLowerCase().includes(searchQuery) || fullDisplay.includes(searchQuery);
        if (!matchName) return false;
      }

      const itemDate = item.fileDate || item.billDate || (item.createdAt ? item.createdAt.slice(0, 10) : '');
      if (filterFrom && itemDate && itemDate < filterFrom) return false;
      if (filterTo && itemDate && itemDate > filterTo) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      if (sortColumn === 'name') {
        valA = (getFormattedFileName(a)).toLowerCase();
        valB = (getFormattedFileName(b)).toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = a.fileDate || a.billDate || a.createdAt || '';
        valB = b.fileDate || b.billDate || b.createdAt || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} File${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center py-5 text-muted">
            <div class="d-flex flex-column align-items-center justify-content-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-secondary opacity-50 mb-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span class="fw-semibold">No files found matching your search</span>
              <small class="text-muted mt-1">Upload a file above or adjust your search / date filters.</small>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const html = filtered.map((file) => {
      const typeInfo = getFileTypeInfo(file.ext);
      const dateFormatted = file.fileDate || file.billDate || (file.createdAt ? file.createdAt.slice(0, 10) : '—');
      const displayName = getFormattedFileName(file);

      return `
        <tr class="align-middle">
          <!-- File Name with Extension and Icon -->
          <td class="py-2 text-start ps-3">
            <span class="fw-semibold text-dark fs-7 d-flex align-items-center gap-2 file-name-link" style="cursor: pointer;" onclick="FilesApp.previewFile('${file.id}')" title="Click to preview file">
              <span>${typeInfo.icon}</span>
              <span>${escapeHtml(displayName)}</span>
            </span>
          </td>

          <!-- Date -->
          <td class="py-2 text-center text-nowrap font-monospace fs-8">
            <span class="badge bg-light text-dark border px-2 py-1">${dateFormatted}</span>
          </td>

          <!-- Actions: ONLY Icons -->
          <td class="py-2 text-center text-nowrap no-print">
            <div class="d-inline-flex align-items-center gap-1.5">
              <button type="button" class="btn btn-xs btn-outline-primary p-1 px-2 d-inline-flex align-items-center justify-content-center shadow-xs" onclick="FilesApp.previewFile('${file.id}')" title="Preview File" aria-label="Preview">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button type="button" class="btn btn-xs btn-outline-success p-1 px-2 d-inline-flex align-items-center justify-content-center shadow-xs" onclick="FilesApp.downloadFile('${file.id}')" title="Download File" aria-label="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button type="button" class="btn btn-xs btn-outline-danger p-1 px-2 d-inline-flex align-items-center justify-content-center shadow-xs" onclick="FilesApp.deleteFile('${file.id}')" title="Delete File" aria-label="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
  }

  function toggleSort(col) {
    if (sortColumn === col) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortOrder = col === 'name' ? 'asc' : 'desc';
    }
    filterFiles();
  }

  function clearFilters() {
    const searchEl = document.getElementById('fileSearchQuery');
    const fromEl = document.getElementById('fileFilterDateFrom');
    const toEl = document.getElementById('fileFilterDateTo');
    if (searchEl) searchEl.value = '';
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    sortColumn = 'date';
    sortOrder = 'desc';
    filterFiles();
  }

  // Interactive in-modal preview
  async function previewFile(fileId) {
    const file = allFiles.find(b => b.id === fileId || b.storedFileName === fileId);
    if (!file) {
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('File record not found.', 'warning');
      return;
    }

    const modalEl = document.getElementById('filePreviewModal');
    const titleEl = document.getElementById('filePreviewModalLabel');
    const badgeEl = document.getElementById('filePreviewTypeBadge');
    const sizeBadge = document.getElementById('filePreviewSizeBadge');
    const bodyEl = document.getElementById('filePreviewModalBody');
    const openTabBtn = document.getElementById('btnFilePreviewOpenTab');
    const downloadBtn = document.getElementById('btnFilePreviewDownload');

    if (!modalEl || !bodyEl) return;

    const typeInfo = getFileTypeInfo(file.ext || '');

    if (titleEl) titleEl.textContent = getFormattedFileName(file);
    if (badgeEl) {
      badgeEl.textContent = typeInfo.label;
      badgeEl.className = `badge ${typeInfo.cls} font-monospace fs-8`;
    }
    if (sizeBadge) {
      sizeBadge.textContent = file.sizeFormatted || formatBytes(file.size);
    }

    if (openTabBtn) {
      openTabBtn.onclick = () => window.open(file.url, '_blank');
    }
    if (downloadBtn) {
      downloadBtn.onclick = () => downloadFile(file.id);
    }

    const ext = (file.ext || '').toLowerCase();
    const isPdf = ext === '.pdf';
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
    const isExcel = ['.xls', '.xlsx', '.csv', '.tsv'].includes(ext);
    const isWordDocx = ext === '.docx';
    const isLegacyWordDoc = ext === '.doc';
    const isText = ['.txt', '.log', '.json', '.xml'].includes(ext);

    bodyEl.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center p-5 text-center w-100" style="min-height: 480px;">
        <div class="spinner-border text-primary" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
        <div class="mt-3 fw-semibold text-dark fs-7">Loading file content...</div>
        <small class="text-muted mt-1 font-monospace fs-8">${escapeHtml(file.fileName)} (${file.sizeFormatted || ''})</small>
      </div>
    `;

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    try {
      // 1. PDF Preview
      if (isPdf) {
        bodyEl.innerHTML = `
          <div style="width: 100%; height: 78vh; position: relative; background: #525659;">
            <iframe src="${file.url}#toolbar=1&navpanes=0" style="width: 100%; height: 100%; border: none;" title="PDF Preview"></iframe>
          </div>
        `;
        return;
      }

      // 2. Image Preview
      if (isImage) {
        bodyEl.innerHTML = `
          <div class="d-flex align-items-center justify-content-center p-3 w-100" style="min-height: 500px; max-height: 78vh; overflow: auto; background: #1e293b10;">
            <img src="${file.url}" alt="${escapeHtml(file.fileName)}" class="img-fluid rounded shadow-sm" style="max-height: 74vh; max-width: 95%; object-fit: contain;">
          </div>
        `;
        return;
      }

      // 3. Excel Preview (.xlsx, .xls, .csv)
      if (isExcel) {
        const resp = await fetch(file.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} while fetching file`);
        const arrayBuffer = await resp.arrayBuffer();

        if (typeof XLSX === 'undefined') {
          throw new Error('SheetJS XLSX library is not loaded');
        }

        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = wb.SheetNames || [];
        if (sheetNames.length === 0) {
          throw new Error('No sheets found in Excel file');
        }

        const tabsHtml = sheetNames.map((name, idx) => `
          <button type="button" class="excel-sheet-tab ${idx === 0 ? 'active' : ''}" onclick="FilesApp.switchExcelTab('${idx}')" id="excelTabBtn_${idx}">
            📊 ${escapeHtml(name)}
          </button>
        `).join('');

        const tablesHtml = sheetNames.map((name, idx) => {
          const sheet = wb.Sheets[name];
          let sheetHtml = XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' });
          sheetHtml = sheetHtml.replace('<table', '<table class="table table-bordered table-sm excel-rendered-table mb-0"');
          return `
            <div class="excel-sheet-content" id="excelSheetContent_${idx}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">
              ${sheetHtml}
            </div>
          `;
        }).join('');

        bodyEl.innerHTML = `
          <div class="excel-preview-container">
            <div class="excel-sheet-tabs">
              ${tabsHtml}
            </div>
            <div class="excel-table-scroll">
              ${tablesHtml}
            </div>
          </div>
        `;
        return;
      }

      // 4. Word (.docx) Preview
      if (isWordDocx) {
        const resp = await fetch(file.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} while fetching document`);
        const arrayBuffer = await resp.arrayBuffer();

        let renderedHtml = '';
        if (typeof mammoth !== 'undefined' && typeof mammoth.convertToHtml === 'function') {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          renderedHtml = result.value || '<p class="text-muted fst-italic">This document contains no text.</p>';
        } else {
          throw new Error('Word document renderer (Mammoth) not available');
        }

        bodyEl.innerHTML = `
          <div class="word-doc-container">
            <div class="word-doc-paper shadow-sm">
              <div class="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-center">
                <div>
                  <h4 class="fw-bold text-dark mb-1">${escapeHtml(file.fileName)}</h4>
                  <div class="text-muted fs-8 font-monospace">${file.fileDate || file.billDate || '—'} &bull; ${file.sizeFormatted || ''}</div>
                </div>
                <span class="badge file-badge-word font-monospace fs-8 px-2 py-1">WORD DOCUMENT</span>
              </div>
              <div class="word-content-body">
                ${renderedHtml}
              </div>
            </div>
          </div>
        `;
        return;
      }

      // 5. Legacy Word (.doc) Preview
      if (isLegacyWordDoc) {
        try {
          const resp = await fetch(file.url);
          const arrayBuf = await resp.arrayBuffer();
          if (typeof mammoth !== 'undefined') {
            const res = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
            if (res && res.value) {
              bodyEl.innerHTML = `
                <div class="word-doc-container">
                  <div class="word-doc-paper shadow-sm">
                    <div class="border-bottom pb-3 mb-4">
                      <h4 class="fw-bold text-dark mb-1">${escapeHtml(file.fileName)}</h4>
                      <span class="badge file-badge-word font-monospace fs-8">WORD (.DOC)</span>
                    </div>
                    <div>${res.value}</div>
                  </div>
                </div>
              `;
              return;
            }
          }
        } catch (e) {
          console.warn('Binary .doc mammoth parse fallback:', e);
        }

        const fullUrl = window.location.origin + file.url;
        bodyEl.innerHTML = `
          <div class="w-100 h-100 d-flex flex-column" style="min-height: 550px;">
            <div class="alert alert-info py-2 px-3 m-2 fs-8 d-flex justify-content-between align-items-center">
              <span>Viewing Legacy Word Document (<strong>.doc</strong>).</span>
              <button type="button" class="btn btn-xs btn-primary px-2 py-1" onclick="FilesApp.downloadFile('${file.id}')">Download</button>
            </div>
            <iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}" style="width:100%; flex:1; min-height:480px; border:none;" title="Office Viewer"></iframe>
          </div>
        `;
        return;
      }

      // 6. Text / Code Preview
      if (isText) {
        const resp = await fetch(file.url);
        const text = await resp.text();
        bodyEl.innerHTML = `
          <div class="p-4 w-100" style="max-height: 78vh; overflow: auto; background: #0f172a;">
            <pre class="text-light font-monospace fs-8 mb-0" style="white-space: pre-wrap; word-break: break-all;">${escapeHtml(text)}</pre>
          </div>
        `;
        return;
      }

      // 7. Generic Fallback
      bodyEl.innerHTML = `
        <div class="p-5 text-center w-100" style="min-height: 440px;">
          <div class="fs-1 mb-2">${typeInfo.icon}</div>
          <h5 class="fw-bold text-dark">${escapeHtml(file.fileName)}</h5>
          <p class="text-muted fs-8 font-monospace mb-4">Size: ${file.sizeFormatted || ''} &bull; ${file.fileDate || file.billDate || ''}</p>
          <button type="button" class="btn btn-primary px-4 py-2" onclick="FilesApp.downloadFile('${file.id}')">
            Download File to View
          </button>
        </div>
      `;
    } catch (err) {
      console.error('Error rendering file preview:', err);
      bodyEl.innerHTML = `
        <div class="p-4 text-center w-100">
          <div class="text-danger fs-3 mb-2">⚠️</div>
          <h6 class="fw-bold text-dark">Unable to render preview automatically</h6>
          <p class="text-muted fs-8 mb-3">${escapeHtml(err.message)}</p>
          <div class="d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-sm btn-primary px-3" onclick="FilesApp.downloadFile('${file.id}')">
              Download File
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary px-3" onclick="window.open('${file.url}', '_blank')">
              Open in New Window
            </button>
          </div>
        </div>
      `;
    }
  }

  function switchExcelTab(activeIdx) {
    document.querySelectorAll('.excel-sheet-tab').forEach((tab, idx) => {
      tab.classList.toggle('active', String(idx) === String(activeIdx));
    });
    document.querySelectorAll('.excel-sheet-content').forEach((content, idx) => {
      content.style.display = String(idx) === String(activeIdx) ? 'block' : 'none';
    });
  }

  function downloadFile(fileId) {
    const file = allFiles.find(b => b.id === fileId || b.storedFileName === fileId);
    if (!file) return;

    const downloadExt = file.ext || '';
    const finalDownloadName = file.fileName.toLowerCase().endsWith(downloadExt.toLowerCase())
      ? file.fileName
      : (file.fileName + downloadExt);

    const downloadUrl = `${file.url}?download=1&name=${encodeURIComponent(finalDownloadName)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = finalDownloadName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); }, 1000);
  }

  async function deleteFile(fileId) {
    const file = allFiles.find(b => b.id === fileId || b.storedFileName === fileId);
    if (!file) return;

    const displayName = getFormattedFileName(file);
    const ok = confirm(`Are you sure you want to remove the file "${displayName}"?\n\nThis will permanently delete the file from the project's uploads folder.`);
    if (!ok) return;

    if (typeof UI !== 'undefined' && UI.showLoading) UI.showLoading(true);
    try {
      const resp = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: file.id })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Failed with status ${resp.status}`);
      }

      const resJson = await resp.json();
      if (!resJson.success) throw new Error(resJson.error || 'Delete failed');

      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(`File "${file.fileName}" removed successfully.`, 'info');
      }
      await loadFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Error deleting file: ' + err.message, 'danger');
      }
    } finally {
      if (typeof UI !== 'undefined' && UI.showLoading) UI.showLoading(false);
    }
  }

  // Initialize page components and wire collapse indicators
  function init() {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const isPowerUser = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    if (!isPowerUser) {
      window.location.href = 'dashboard.html';
      return;
    }

    const buttonsHtml = `
      <button class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fs-8 px-2.5 py-1.5 shadow-sm text-nowrap rounded-1" id="btnOpenUploadModal" onclick="FilesApp.openUploadModal()" title="Upload File">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span>Upload File</span>
      </button>
    `;

    if (typeof UI !== 'undefined') {
      UI.renderSidebar('files.html');
      UI.renderTopbar('Files', buttonsHtml);
    }

    const btnUpload = document.getElementById('btnOpenUploadModal');
    if (btnUpload) {
      btnUpload.addEventListener('click', openUploadModal);
    }

    // Arrow indicator toggles for Search & Filters collapse
    const searchCollapseEl = document.getElementById('fileSearchCollapse');
    if (searchCollapseEl) {
      searchCollapseEl.addEventListener('shown.bs.collapse', () => {
        const ind = document.getElementById('fileSearchCollapseIndicator');
        if (ind) ind.textContent = '▲';
      });
      searchCollapseEl.addEventListener('hidden.bs.collapse', () => {
        const ind = document.getElementById('fileSearchCollapseIndicator');
        if (ind) ind.textContent = '▼';
      });
    }

    // Filter listeners
    const searchInput = document.getElementById('fileSearchQuery');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (typeof Utils !== 'undefined' && Utils.debounce) {
          Utils.debounce(filterFiles, 200)();
        } else {
          filterFiles();
        }
      });
    }

    const fromDateInput = document.getElementById('fileFilterDateFrom');
    if (fromDateInput) fromDateInput.addEventListener('change', filterFiles);

    const toDateInput = document.getElementById('fileFilterDateTo');
    if (toDateInput) toDateInput.addEventListener('change', filterFiles);

    const btnClear = document.getElementById('btnClearFileFilters');
    if (btnClear) btnClear.addEventListener('click', clearFilters);

    loadFiles();
  }

  return {
    init,
    openUploadModal,
    onFilesSelected,
    onDragOver,
    onDragLeave,
    onFileDrop,
    updatePendingCustomName,
    removePendingFile,
    clearAllPendingFiles,
    uploadFiles,
    loadFiles,
    filterFiles,
    toggleSort,
    clearFilters,
    previewFile,
    switchExcelTab,
    downloadFile,
    deleteFile
  };
})();

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', FilesApp.init);
} else {
  FilesApp.init();
}
