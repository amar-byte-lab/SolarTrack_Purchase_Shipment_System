/* =========================================================================
   work-note.js — Work Note Generator & Tracker Logic
   ========================================================================= */

let selectedCustomerSlNos = [];
let selectedDistricts = [];
let selectedBadges = [
  { key: 'CommittedBrand', label: 'Brand', type: 'preset' },
  { key: 'CommittedPrice', label: 'Cust. Cost', type: 'preset' },
  { key: 'PartnerPrice', label: 'Part. Cost', type: 'preset' },
  { key: 'NetMeterPayment', label: 'Meter', type: 'preset' }
];
let customBadgeIndex = 1;
let selectedPartners = [];
let editingNoteID = null;
let currentEditedCellValues = {}; // key: `${slNo}_${badgeKey}` -> value
let currentViewingNoteID = null;

const PRESET_BADGES = [
  { key: 'CommittedBrand', label: 'Brand', type: 'preset' },
  { key: 'CommittedPrice', label: 'Cust. Cost', type: 'preset' },
  { key: 'PartnerPrice', label: 'Part. Cost', type: 'preset' },
  { key: 'NetMeterPayment', label: 'Meter', type: 'preset' }
];

// Initialize UI immediately
UI.renderSidebar('work-note.html');
UI.renderTopbar('Work Note');

window.onDbReady = async function () {
  initFilterListeners();
  initBadgeSection();
  initEventListeners();

  updateDistrictStats();
  renderCustomerSelectionList();
  renderWorkNoteTable();

  // Fetch saved notes directly from database API and render
  await fetchAndRenderSavedNotes();
};

async function fetchAndRenderSavedNotes() {
  try {
    const res = await fetch('/api/get?table=work_notes');
    if (res.ok) {
      const dbNotes = await res.json();
      if (Array.isArray(dbNotes)) {
        if (typeof DB !== 'undefined' && typeof DB.replaceAll === 'function') {
          await DB.replaceAll('work_notes', dbNotes);
        }
      }
    }
  } catch (e) {
    console.warn('Error fetching fresh work_notes from DB:', e);
  }
  renderSavedNotesList();
}

function initFilterListeners() {
  ['fSearch', 'fLoginFrom', 'fLoginTo', 'fDateType', 'chkShowDeactive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', Utils.debounce(() => {
        updateDistrictStats();
        renderCustomerSelectionList();
      }, 200));
      el.addEventListener('change', () => {
        updateDistrictStats();
        renderCustomerSelectionList();
      });
    }
  });

  const clearBtn = document.getElementById('btnClearFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ['fSearch', 'fLoginFrom', 'fLoginTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const dateTypeSel = document.getElementById('fDateType');
      if (dateTypeSel) dateTypeSel.value = 'LoginDate';
      const chkDeactive = document.getElementById('chkShowDeactive');
      if (chkDeactive) chkDeactive.checked = false;
      selectedPartners = [];
      selectedDistricts = [];
      updatePartnerDropdownButton();
      updateDistrictStats();
      renderCustomerSelectionList();
    });
  }

  // Search collapse toggle indicator
  const searchCollapseEl = document.getElementById('searchCollapse');
  const searchIndicator = document.getElementById('searchCollapseIndicator');
  if (searchCollapseEl && searchIndicator) {
    searchCollapseEl.addEventListener('show.bs.collapse', () => {
      searchIndicator.textContent = '▲ Hide';
    });
    searchCollapseEl.addEventListener('hide.bs.collapse', () => {
      searchIndicator.textContent = '▼ Show';
    });
  }

  // Select All Customers checkbox
  const selectAllChk = document.getElementById('chkSelectAllCustomers');
  if (selectAllChk) {
    selectAllChk.addEventListener('change', (e) => {
      const filtered = getFilteredCustomers();
      if (e.target.checked) {
        filtered.forEach(r => {
          const sl = Number(r.SlNo);
          if (!selectedCustomerSlNos.includes(sl)) {
            selectedCustomerSlNos.push(sl);
          }
        });
      } else {
        const filteredSlNos = filtered.map(r => Number(r.SlNo));
        selectedCustomerSlNos = selectedCustomerSlNos.filter(sl => !filteredSlNos.includes(sl));
      }
      renderCustomerSelectionList();
      renderWorkNoteTable();
    });
  }

  // Saved note search
  const savedSearchInput = document.getElementById('fSavedNoteSearch');
  if (savedSearchInput) {
    savedSearchInput.addEventListener('input', Utils.debounce(renderSavedNotesList, 200));
  }
}

function initBadgeSection() {
  renderBadgesContainer();
}

function initEventListeners() {
  // Add Custom Column confirm button
  const confirmAddColBtn = document.getElementById('btnConfirmAddCustomCol');
  if (confirmAddColBtn) {
    confirmAddColBtn.addEventListener('click', handleAddCustomColumnConfirm);
  }

  // Save Work Note button
  const saveNoteBtn = document.getElementById('btnSaveWorkNote');
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener('click', saveWorkNote);
  }

  // View modal edit/delete buttons
  const modalEditBtn = document.getElementById('btnEditSavedNoteFromModal');
  if (modalEditBtn) {
    modalEditBtn.addEventListener('click', () => {
      if (currentViewingNoteID) {
        const modalEl = document.getElementById('viewNoteModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        loadSavedNoteIntoEditor(currentViewingNoteID);
      }
    });
  }

  const modalDeleteBtn = document.getElementById('btnDeleteSavedNoteFromModal');
  if (modalDeleteBtn) {
    modalDeleteBtn.addEventListener('click', async () => {
      if (currentViewingNoteID) {
        const confirmed = await UI.confirmDialog('Are you sure you want to delete this Work Note?');
        if (confirmed) {
          await DB.remove('work_notes', x => x.NoteID === currentViewingNoteID);
          UI.toast('Work Note deleted successfully.', 'success');
          const modalEl = document.getElementById('viewNoteModal');
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
          if (editingNoteID === currentViewingNoteID) {
            resetWorkNoteEditor();
          }
          await fetchAndRenderSavedNotes();
        }
      }
    });
  }
}

window.toggleDistrictBadgeFilter = function(dist, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (dist === 'ALL' || dist === 'Total') {
    selectedDistricts = [];
  } else {
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const idx = selectedDistricts.indexOf(targetDist);
    if (idx > -1) {
      selectedDistricts.splice(idx, 1);
    } else {
      selectedDistricts.push(targetDist);
    }
  }

  updateDistrictStats();
  renderCustomerSelectionList();
};

function updateDistrictStats() {
  const container = document.getElementById('districtStatsContainer');
  if (!container) return;

  const allRows = DB.getAll('installments') || [];
  const showDeactive = document.getElementById('chkShowDeactive') ? document.getElementById('chkShowDeactive').checked : false;
  const filteredStatusRows = showDeactive ? allRows : allRows.filter(r => r.Status !== 'Deactive');
  const totalCount = filteredStatusRows.length;
  const counts = {};

  filteredStatusRows.forEach(r => {
    const dist = r.District ? r.District.trim() : '';
    const key = dist || 'No District';
    counts[key] = (counts[key] || 0) + 1;
  });

  const sortedDistricts = Object.keys(counts)
    .filter(k => counts[k] >= 1)
    .sort((a, b) => {
      if (a === 'No District') return 1;
      if (b === 'No District') return -1;
      return a.localeCompare(b);
    });

  const badgeStyles = [
    'bg-primary-subtle text-primary-emphasis border border-primary-subtle',
    'bg-success-subtle text-success-emphasis border border-success-subtle',
    'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    'bg-danger-subtle text-danger-emphasis border border-danger-subtle',
    'bg-info-subtle text-info-emphasis border border-info-subtle',
    'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle'
  ];

  const isTotalActive = selectedDistricts.length === 0;
  const totalBadgeClass = isTotalActive
    ? 'bg-dark text-white border border-2 border-success shadow-sm fw-bold'
    : 'bg-success-subtle text-success-emphasis border border-success-subtle';

  const totalBadge = `<span onclick="window.toggleDistrictBadgeFilter('ALL', event)" class="badge rounded-pill ${totalBadgeClass} px-1.5 py-0.5" style="font-size: 0.62rem !important; font-weight: ${isTotalActive ? '700' : '500'}; cursor: pointer; transition: all 0.15s ease;" title="Click to clear filter and show all districts">${isTotalActive ? '✓ ' : ''}Total: ${totalCount}</span>`;

  const districtBadges = sortedDistricts.map((dist, index) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistricts.includes(targetDist);
    const style = badgeStyles[index % badgeStyles.length];

    const safeDist = dist.replace(/'/g, "\\'");
    if (isSelected) {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="badge rounded-pill bg-primary text-white border border-2 border-dark shadow-sm px-1.5 py-0.5" style="font-size: 0.62rem !important; font-weight: 700 !important; cursor: pointer; transition: all 0.15s ease;" title="Selected filter. Click to toggle off.">✓ ${dist}: ${count}</span>`;
    } else {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="badge rounded-pill ${style} px-1.5 py-0.5" style="font-size: 0.6rem !important; font-weight: 500; cursor: pointer; opacity: 0.85; transition: all 0.15s ease;" title="Click to filter by ${dist}">${dist}: ${count}</span>`;
    }
  });

  container.innerHTML = [totalBadge, ...districtBadges].join(' ');
}

function getFilteredCustomers() {
  const search = (document.getElementById('fSearch') ? document.getElementById('fSearch').value : '').toLowerCase();
  const loginFrom = document.getElementById('fLoginFrom') ? document.getElementById('fLoginFrom').value : '';
  const loginTo = document.getElementById('fLoginTo') ? document.getElementById('fLoginTo').value : '';
  const dateType = document.getElementById('fDateType') ? document.getElementById('fDateType').value : 'LoginDate';
  const showDeactive = document.getElementById('chkShowDeactive') ? document.getElementById('chkShowDeactive').checked : false;

  let rows = DB.getAll('installments') || [];

  if (!showDeactive) {
    rows = rows.filter(r => r.Status !== 'Deactive');
  }

  if (search) {
    rows = rows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.PinCode || '').toLowerCase().includes(search) ||
      String(r.State || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search)
    );
  }

  if (selectedDistricts.length > 0) {
    rows = rows.filter(r => {
      const distVal = r.District ? r.District.trim() : '(No District)';
      const distName = distVal === '' ? '(No District)' : distVal;
      return selectedDistricts.includes(distName);
    });
  }

  if (selectedPartners.length > 0) {
    rows = rows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return selectedPartners.includes(partnerName);
    });
  }

  if (loginFrom) {
    rows = rows.filter(r => r[dateType] && r[dateType] >= loginFrom);
  }
  if (loginTo) {
    rows = rows.filter(r => r[dateType] && r[dateType] <= loginTo);
  }

  return rows;
}

function renderCustomerSelectionList() {
  populatePartnerMultiselectMenu();
  const filtered = getFilteredCustomers();
  const container = document.getElementById('customerSelectionContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-muted text-center py-1" style="font-size: 0.68rem;">No customers found.</div>`;
  } else {
    container.innerHTML = filtered.map(r => {
      const sl = Number(r.SlNo);
      const isChecked = selectedCustomerSlNos.includes(sl);
      return `
        <div class="d-flex align-items-center gap-1.5 py-0.5 px-1.5 border-bottom border-light hover-bg cust-item-row">
          <input class="form-check-input cust-chk m-0 cursor-pointer flex-shrink-0" type="checkbox" value="${sl}" id="cust_chk_${sl}" ${isChecked ? 'checked' : ''} style="width: 12px; height: 12px;">
          <label class="form-check-label text-dark cursor-pointer mb-0 flex-grow-1" for="cust_chk_${sl}" style="font-size: 0.68rem !important; font-weight: 600;">
            ${r.Name || 'Unnamed'}
          </label>
        </div>
      `;
    }).join('');

    // Attach click listeners to customer checkboxes
    container.querySelectorAll('.cust-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const sl = Number(chk.value);
        if (chk.checked) {
          if (!selectedCustomerSlNos.includes(sl)) selectedCustomerSlNos.push(sl);
        } else {
          selectedCustomerSlNos = selectedCustomerSlNos.filter(x => x !== sl);
        }
        updateSelectAllState(filtered);
        renderWorkNoteTable();
      });
    });
  }

  updateSelectAllState(filtered);
  updateCustomerCountLabel();
}

function updateSelectAllState(filtered) {
  const selectAllChk = document.getElementById('chkSelectAllCustomers');
  if (!selectAllChk || filtered.length === 0) return;
  const filteredSlNos = filtered.map(r => Number(r.SlNo));
  const allSelected = filteredSlNos.length > 0 && filteredSlNos.every(sl => selectedCustomerSlNos.includes(sl));
  selectAllChk.checked = allSelected;
}

function updateCustomerCountLabel() {
  const label = document.getElementById('selectedCustomerCountLabel');
  if (label) {
    label.textContent = `${selectedCustomerSlNos.length} selected`;
  }
}

function populatePartnerMultiselectMenu() {
  const partnerMenu = document.getElementById('partnerMultiselectMenu');
  if (!partnerMenu) return;
  const allRows = DB.getAll('installments') || [];
  const rawPartners = allRows.map(r => r.BrokerName ? r.BrokerName.trim() : '').filter(Boolean);
  const uniquePartners = [...new Set(rawPartners)].sort();

  partnerMenu.innerHTML = [
    `<div class="form-check mb-1">
       <input class="form-check-input partner-chk" type="checkbox" value="(No Partner)" id="chk_nopartner" ${selectedPartners.includes('(No Partner)') ? 'checked' : ''}>
       <label class="form-check-label w-100" for="chk_nopartner">(No Partner)</label>
     </div>`
  ].concat(
    uniquePartners.map(p => `
      <div class="form-check mb-1">
        <input class="form-check-input partner-chk" type="checkbox" value="${p}" id="chk_partner_${p.replace(/\s+/g, '_')}" ${selectedPartners.includes(p) ? 'checked' : ''}>
        <label class="form-check-label w-100" for="chk_partner_${p.replace(/\s+/g, '_')}">${p}</label>
      </div>
    `)
  ).join('');

  partnerMenu.querySelectorAll('.partner-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      selectedPartners = Array.from(partnerMenu.querySelectorAll('.partner-chk:checked')).map(c => c.value);
      updatePartnerDropdownButton();
      renderCustomerSelectionList();
    });
  });
  updatePartnerDropdownButton();
}

function updatePartnerDropdownButton() {
  const btn = document.getElementById('btnPartnerMultiselect');
  if (!btn) return;
  if (selectedPartners.length === 0) {
    btn.textContent = 'All Partners';
  } else if (selectedPartners.length === 1) {
    btn.textContent = selectedPartners[0];
  } else {
    btn.textContent = `${selectedPartners.length} Partners`;
  }
}

function renderBadgesContainer() {
  const container = document.getElementById('badgesContainer');
  if (!container) return;

  const presetHtml = PRESET_BADGES.map(badge => {
    const isSelected = selectedBadges.some(b => b.key === badge.key);
    return `
      <span class="badge-toggle ${isSelected ? 'active' : ''}" onclick="toggleBadge('${badge.key}')">
        <span>${badge.label}</span>
        <span class="ms-1 fw-bold">${isSelected ? '✓' : '+'}</span>
      </span>
    `;
  }).join('');

  const customBadgesHtml = selectedBadges.filter(b => b.type && b.type.startsWith('custom')).map(badge => {
    return `
      <span class="badge-toggle active" onclick="removeCustomBadge('${badge.key}')" title="Click to remove column">
        <span>${badge.label} (${badge.type === 'custom_date' ? '📅 Date' : '✏️ Text'})</span>
        <span class="ms-1 text-danger fw-bold">✕</span>
      </span>
    `;
  }).join('');

  const actionButtonsHtml = `
    <button class="badge-toggle badge-toggle-custom" onclick="openAddCustomColModal('custom_text')">
      <span>➕ Custom Text</span>
    </button>
    <button class="badge-toggle badge-toggle-custom" onclick="openAddCustomColModal('custom_date')">
      <span>📅 Custom Date</span>
    </button>
  `;

  container.innerHTML = presetHtml + customBadgesHtml + actionButtonsHtml;
}

window.toggleBadge = function(key) {
  const exists = selectedBadges.some(b => b.key === key);
  if (exists) {
    selectedBadges = selectedBadges.filter(b => b.key !== key);
  } else {
    const preset = PRESET_BADGES.find(b => b.key === key);
    if (preset) {
      selectedBadges.push(preset);
    }
  }
  renderBadgesContainer();
  renderWorkNoteTable();
};

window.removeCustomBadge = function(key) {
  selectedBadges = selectedBadges.filter(b => b.key !== key);
  renderBadgesContainer();
  renderWorkNoteTable();
};

window.openAddCustomColModal = function(type) {
  document.getElementById('hdnCustomColType').value = type;
  document.getElementById('txtCustomColName').value = '';
  document.getElementById('customColModalTitle').textContent = type === 'custom_date' ? 'Add Custom Date Column' : 'Add Custom Text Column';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('customColumnModal'));
  modal.show();
  setTimeout(() => document.getElementById('txtCustomColName').focus(), 300);
};

function handleAddCustomColumnConfirm() {
  const nameInput = document.getElementById('txtCustomColName');
  const name = nameInput ? nameInput.value.trim() : '';
  const type = document.getElementById('hdnCustomColType').value;

  if (!name) {
    UI.toast('Please enter a column title.', 'warning');
    nameInput.focus();
    return;
  }

  const key = `custom_${type}_${customBadgeIndex++}`;
  selectedBadges.push({
    key: key,
    label: name,
    type: type
  });

  const modalEl = document.getElementById('customColumnModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  renderBadgesContainer();
  renderWorkNoteTable();
  UI.toast(`Added column "${name}".`, 'success');
}

function getCustomerDefaultValue(r, badge) {
  if (!r) return '';
  const k = badge.key;
  if (k === 'NetMeterPayment' || k === 'NetMeterPaid') {
    let expenses = null;
    if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try { expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]); } catch(e){}
    }
    if (k === 'NetMeterPayment') return (r.NetMeterPayment != null && r.NetMeterPayment !== '') ? r.NetMeterPayment : (expenses ? expenses.net_meter_payment || 0 : 0);
    if (k === 'NetMeterPaid') return (r.NetMeterPaid != null) ? (r.NetMeterPaid ? 'Paid' : 'Unpaid') : (expenses && expenses.net_meter_paid ? 'Paid' : 'Unpaid');
  }
  if (k === 'PartnerPrice') {
    let expenses = null;
    if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try { expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]); } catch(e){}
    }
    if (expenses) return expenses.partner || 0;
  }

  if (r[k] !== undefined && r[k] !== null) return r[k];
  return '';
}

function renderWorkNoteTable() {
  const tableCard = document.getElementById('tableCard');
  const theadRow = document.getElementById('workNoteTheadRow');
  const tbody = document.getElementById('workNoteTbody');
  const rowCountLabel = document.getElementById('tableRowCountLabel');
  if (!theadRow || !tbody) return;

  const allInstallments = DB.getAll('installments') || [];
  const selectedRows = allInstallments.filter(r => selectedCustomerSlNos.includes(Number(r.SlNo)));

  // Dynamically show/hide table card based on customer selection
  if (selectedRows.length > 0) {
    if (tableCard) tableCard.style.display = 'block';
  } else {
    if (tableCard) tableCard.style.display = 'none';
    return;
  }

  if (rowCountLabel) rowCountLabel.textContent = `${selectedRows.length} rows`;

  // Render Borderless Ultra-Compact Table Headers (0.65rem)
  theadRow.innerHTML = `
    <th class="text-center" style="width:25px; font-size: 0.65rem !important;">#</th>
    <th style="min-width:110px; font-size: 0.65rem !important;">CUSTOMER NAME</th>
    ${selectedBadges.map(b => `<th style="min-width:85px; font-size: 0.65rem !important;">${b.label.toUpperCase()}</th>`).join('')}
    <th class="text-center" style="width:30px; font-size: 0.65rem !important;">ACT</th>
  `;

  // Render Table Rows (Populates raw DB default values for new notes or edited values for existing notes)
  tbody.innerHTML = selectedRows.map((r, idx) => {
    const sl = Number(r.SlNo);
    const cellsHtml = selectedBadges.map(badge => {
      const cellKey = `${sl}_${badge.key}`;
      let val = currentEditedCellValues[cellKey];
      if (val === undefined) {
        val = getCustomerDefaultValue(r, badge);
      }

      // If badge is NetMeterPayment, render Paid checkbox INSIDE the textbox itself
      if (badge.key === 'NetMeterPayment') {
        const paidKey = `${sl}_NetMeterPaid`;
        let paidVal = currentEditedCellValues[paidKey];
        if (paidVal === undefined) {
          paidVal = getCustomerDefaultValue(r, { key: 'NetMeterPaid' });
        }
        const isPaid = paidVal === true || paidVal === 'Paid' || paidVal === 'true' || paidVal === 1 || paidVal === '1';

        return `
          <td class="py-0.5">
            <div class="position-relative d-flex align-items-center">
              <input type="text" class="editable-cell-input pe-4" data-sl="${sl}" data-badge="NetMeterPayment" value="${val !== null && val !== undefined ? String(val).replace(/"/g, '&quot;') : ''}" onchange="handleCellInputChange(this)">
              <input type="checkbox" class="form-check-input cursor-pointer position-absolute end-0 me-1.5" data-sl="${sl}" data-badge="NetMeterPaid" ${isPaid ? 'checked' : ''} onchange="handleCellChkChange(this)" style="width:12px; height:12px; top:50%; transform:translateY(-50%);" title="Meter Paid Checkbox">
            </div>
          </td>
        `;
      }

      const inputType = badge.type === 'custom_date' ? 'date' : 'text';
      return `
        <td class="py-0.5">
          <input type="${inputType}" class="editable-cell-input" data-sl="${sl}" data-badge="${badge.key}" value="${val !== null && val !== undefined ? String(val).replace(/"/g, '&quot;') : ''}" onchange="handleCellInputChange(this)">
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="text-center fw-bold align-middle py-0.5" style="font-size: 0.68rem !important;">${idx + 1}</td>
        <td class="text-dark align-middle py-0.5" style="font-size: 0.68rem !important; font-weight: 600;">
          ${r.Name || 'Unnamed'}
        </td>
        ${cellsHtml}
        <td class="text-center align-middle py-0.5">
          <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="removeCustomerFromNote(${sl})" title="Remove" style="font-size: 0.65rem;">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.handleCellInputChange = function(inputEl) {
  const sl = Number(inputEl.getAttribute('data-sl'));
  const badgeKey = inputEl.getAttribute('data-badge');
  const val = inputEl.value;
  currentEditedCellValues[`${sl}_${badgeKey}`] = val;
};

window.handleCellChkChange = function(chkEl) {
  const sl = Number(chkEl.getAttribute('data-sl'));
  const badgeKey = chkEl.getAttribute('data-badge');
  currentEditedCellValues[`${sl}_${badgeKey}`] = chkEl.checked ? 'Paid' : 'Unpaid';
};

window.removeCustomerFromNote = function(slNo) {
  selectedCustomerSlNos = selectedCustomerSlNos.filter(x => x !== slNo);
  renderCustomerSelectionList();
  renderWorkNoteTable();
};

async function saveWorkNote() {
  const titleInput = document.getElementById('txtNoteTitle');
  const title = titleInput ? titleInput.value.trim() : '';
  const commonNoteInput = document.getElementById('txtCommonNote');
  const commonNote = commonNoteInput ? commonNoteInput.value.trim() : '';

  if (!title) {
    UI.toast('Please enter a Work Note Title.', 'danger');
    if (titleInput) titleInput.focus();
    return;
  }

  if (selectedCustomerSlNos.length === 0) {
    UI.toast('Please select at least one customer.', 'warning');
    return;
  }

  if (selectedBadges.length === 0) {
    UI.toast('Please select at least one column badge.', 'warning');
    return;
  }

  const allInstallments = DB.getAll('installments') || [];
  const selectedRows = allInstallments.filter(r => selectedCustomerSlNos.includes(Number(r.SlNo)));

  // Build Customer Data array with all row cell values for this specific note
  const customerData = selectedRows.map(r => {
    const sl = Number(r.SlNo);
    const rowValues = {
      SlNo: sl,
      Name: r.Name || '',
      ConsumerNo: r.ConsumerNo || '',
      MobileNumber: r.MobileNumber || '',
      District: r.District || ''
    };

    selectedBadges.forEach(badge => {
      const cellKey = `${sl}_${badge.key}`;
      let val = currentEditedCellValues[cellKey];
      if (val === undefined) {
        val = getCustomerDefaultValue(r, badge);
      }
      rowValues[badge.key] = val;

      // If badge is NetMeterPayment, also save NetMeterPaid status
      if (badge.key === 'NetMeterPayment') {
        const paidKey = `${sl}_NetMeterPaid`;
        let paidVal = currentEditedCellValues[paidKey];
        if (paidVal === undefined) {
          paidVal = getCustomerDefaultValue(r, { key: 'NetMeterPaid' });
        }
        rowValues['NetMeterPaid'] = paidVal;
      }
    });

    return rowValues;
  });

  const nowISO = new Date().toISOString();
  const noteID = editingNoteID || Utils.uid('WORKNOTE');

  const noteRecord = {
    NoteID: noteID,
    NoteTitle: title,
    CommonNote: commonNote,
    SelectedBadges: JSON.stringify(selectedBadges),
    CustomerData: JSON.stringify(customerData),
    CreatedAt: editingNoteID ? ((DB.getAll('work_notes') || []).find(x => x.NoteID === editingNoteID) || {}).CreatedAt || nowISO : nowISO,
    UpdatedAt: nowISO
  };

  UI.showLoading(true);
  try {
    if (editingNoteID) {
      await DB.update('work_notes', x => x.NoteID === editingNoteID, noteRecord);
      UI.toast(`Work Note "${title}" updated.`, 'success');
    } else {
      await DB.insert('work_notes', noteRecord);
      UI.toast(`Work Note "${title}" saved.`, 'success');
    }

    resetWorkNoteEditor();
    await fetchAndRenderSavedNotes();
  } catch (err) {
    console.error('Error saving work note:', err);
    UI.toast('Failed to save Work Note.', 'danger');
  } finally {
    UI.showLoading(false);
  }
}

window.resetWorkNoteEditor = function() {
  editingNoteID = null;
  currentEditedCellValues = {};
  selectedCustomerSlNos = [];
  document.getElementById('txtNoteTitle').value = '';
  document.getElementById('txtNoteID').value = '';
  document.getElementById('txtCommonNote').value = '';
  const cancelBtn = document.getElementById('btnCancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';

  const saveBtn = document.getElementById('btnSaveWorkNote');
  if (saveBtn) saveBtn.textContent = '💾 Save Work Note';

  selectedBadges = [
    { key: 'CommittedBrand', label: 'Brand', type: 'preset' },
    { key: 'CommittedPrice', label: 'Cust. Cost', type: 'preset' },
    { key: 'PartnerPrice', label: 'Part. Cost', type: 'preset' },
    { key: 'NetMeterPayment', label: 'Meter', type: 'preset' }
  ];

  renderBadgesContainer();
  renderCustomerSelectionList();
  renderWorkNoteTable();
};

function renderSavedNotesList() {
  const container = document.getElementById('savedNotesContainer');
  if (!container) return;

  const search = (document.getElementById('fSavedNoteSearch') ? document.getElementById('fSavedNoteSearch').value : '').toLowerCase();
  let notes = DB.getAll('work_notes') || [];
  notes = [...notes];
  notes.sort((a, b) => new Date(b.UpdatedAt || b.CreatedAt) - new Date(a.UpdatedAt || a.CreatedAt));

  if (search) {
    notes = notes.filter(n =>
      String(n.NoteTitle || '').toLowerCase().includes(search) ||
      String(n.NoteID || '').toLowerCase().includes(search) ||
      String(n.CommonNote || '').toLowerCase().includes(search)
    );
  }

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-2 bg-light rounded border border-dashed" style="font-size: 0.68rem;">
        No saved notes found.
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map(n => {
    let customerCount = 0;
    let badgeCount = 0;
    try {
      const custData = JSON.parse(n.CustomerData || '[]');
      customerCount = custData.length;
      const badges = JSON.parse(n.SelectedBadges || '[]');
      badgeCount = badges.length;
    } catch(e){}

    const formattedDate = Utils.fmtDate(n.UpdatedAt || n.CreatedAt) || 'Recent';

    return `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="saved-note-card p-2 d-flex flex-column h-100 shadow-sm cursor-pointer" onclick="viewSavedNoteModal('${n.NoteID}')">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <h6 class="fw-bold text-primary mb-0 text-truncate" style="font-size: 0.68rem !important;" title="${n.NoteTitle}">${n.NoteTitle || 'Untitled Note'}</h6>
          </div>
          <div class="text-secondary mb-1" style="font-size: 0.62rem !important;">
            📅 ${formattedDate} | 👥 ${customerCount} Cust | 🏷️ ${badgeCount} Cols
          </div>
          ${n.CommonNote ? `
            <div class="keep-note-box p-1 mb-1 text-dark text-truncate" style="max-height: 40px; font-size: 0.62rem !important;">
              💬 ${n.CommonNote}
            </div>
          ` : ''}
          <div class="mt-auto pt-1 d-flex justify-content-between align-items-center border-top" onclick="event.stopPropagation();">
            <button class="btn btn-xs btn-outline-primary fw-bold py-0" onclick="viewSavedNoteModal('${n.NoteID}')" style="font-size: 0.62rem;">
              👁️ View
            </button>
            <button class="btn btn-xs btn-outline-warning text-dark fw-bold py-0" onclick="loadSavedNoteIntoEditor('${n.NoteID}')" style="font-size: 0.62rem;">
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.viewSavedNoteModal = function(noteID) {
  currentViewingNoteID = noteID;
  const note = (DB.getAll('work_notes') || []).find(x => x.NoteID === noteID);
  if (!note) return;

  let badges = [];
  let custData = [];
  try {
    badges = JSON.parse(note.SelectedBadges || '[]');
    custData = JSON.parse(note.CustomerData || '[]');
  } catch(e){}

  document.getElementById('viewNoteModalTitle').textContent = `📝 ${note.NoteTitle}`;
  document.getElementById('viewNoteModalMeta').textContent = `Created: ${Utils.fmtDate(note.CreatedAt)} | Customers: ${custData.length}`;

  const bodyEl = document.getElementById('viewNoteModalBody');
  if (bodyEl) {
    bodyEl.innerHTML = `
      ${note.CommonNote ? `
        <div class="keep-note-box mb-2">
          <h6 class="fw-bold text-warning-emphasis mb-1" style="font-size: 0.68rem;">📝 Common Remarks:</h6>
          <div class="text-dark" style="white-space: pre-wrap; font-size: 0.68rem;">${note.CommonNote}</div>
        </div>
      ` : ''}

      <div class="table-responsive" style="max-height: 380px;">
        <table class="table table-borderless table-striped align-middle mb-0" style="font-size: 0.68rem;">
          <thead class="table-dark sticky-top">
            <tr>
              <th class="text-center" style="width:25px; font-size: 0.65rem;">#</th>
              <th style="font-size: 0.65rem;">Customer Name</th>
              ${badges.map(b => `<th style="font-size: 0.65rem;">${b.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${custData.length === 0 ? `
              <tr><td colspan="${badges.length + 2}" class="text-center text-muted">No data saved.</td></tr>
            ` : custData.map((row, idx) => `
              <tr>
                <td class="text-center fw-bold">${idx + 1}</td>
                <td class="fw-bold text-dark" style="font-size: 0.68rem !important;">${row.Name || 'Unnamed'}</td>
                ${badges.map(b => {
                  let val = row[b.key];
                  if (b.key === 'NetMeterPayment') {
                    const paidVal = row['NetMeterPaid'];
                    const isPaid = paidVal === true || paidVal === 'Paid' || paidVal === 'true' || paidVal === 1 || paidVal === '1';
                    return `<td>${val !== undefined && val !== null ? String(val) : '—'} <span class="badge ${isPaid ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}" style="font-size:0.62rem;">${isPaid ? '✓ Paid' : 'Unpaid'}</span></td>`;
                  }
                  return `<td>${val !== undefined && val !== null ? String(val) : '—'}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('viewNoteModal'));
  modal.show();
};

window.loadSavedNoteIntoEditor = function(noteID) {
  const note = (DB.getAll('work_notes') || []).find(x => x.NoteID === noteID);
  if (!note) return;

  editingNoteID = noteID;
  currentEditedCellValues = {};

  document.getElementById('txtNoteTitle').value = note.NoteTitle || '';
  document.getElementById('txtNoteID').value = note.NoteID;
  document.getElementById('txtCommonNote').value = note.CommonNote || '';

  const cancelBtn = document.getElementById('btnCancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';

  const saveBtn = document.getElementById('btnSaveWorkNote');
  if (saveBtn) saveBtn.textContent = '💾 Update Work Note';

  try {
    selectedBadges = JSON.parse(note.SelectedBadges || '[]').filter(b => b.key !== 'NetMeterPaid');
    const custData = JSON.parse(note.CustomerData || '[]');
    selectedCustomerSlNos = custData.map(r => Number(r.SlNo));

    // Restore saved cell values into currentEditedCellValues
    custData.forEach(r => {
      const sl = Number(r.SlNo);
      selectedBadges.forEach(b => {
        if (r[b.key] !== undefined) {
          currentEditedCellValues[`${sl}_${b.key}`] = r[b.key];
        }
      });
      if (r['NetMeterPaid'] !== undefined) {
        currentEditedCellValues[`${sl}_NetMeterPaid`] = r['NetMeterPaid'];
      }
    });
  } catch(e) {
    console.error('Error parsing saved note data:', e);
  }

  renderBadgesContainer();
  renderCustomerSelectionList();
  renderWorkNoteTable();

  // Scroll to editor top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  UI.toast(`Editing Work Note "${note.NoteTitle}".`, 'info');
};
