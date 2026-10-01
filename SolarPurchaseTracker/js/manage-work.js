/* =========================================================================
   manage-work.js — Progress & Workflow Stage Management Tracker
   ========================================================================= */

let sortCol = 'SlNo';
let sortDir = 'asc';

let selectedDistricts = [];
let selectedPartners = [];

const DISTRICTS = [
  'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
  'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
  'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Khordha',
  'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada',
  'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'
];

window.onDbReady = function () {
  UI.renderSidebar('manage-work.html');
  UI.renderTopbar('Manage Work');

  // Search & Filter event listeners
  ['fSearch', 'fLoginFrom', 'fLoginTo', 'fDateType', 'chkShowDeactive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', Utils.debounce(renderList, 200));
      el.addEventListener('change', renderList);
    }
  });

  // Clear filters
  const btnClear = document.getElementById('btnClearFilters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      ['fSearch', 'fLoginFrom', 'fLoginTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const dateTypeSel = document.getElementById('fDateType');
      if (dateTypeSel) dateTypeSel.value = 'LoginDate';
      const chkDeactive = document.getElementById('chkShowDeactive');
      if (chkDeactive) chkDeactive.checked = false;

      selectedDistricts = [];
      selectedPartners = [];
      document.querySelectorAll('.district-chk').forEach(c => c.checked = false);
      document.querySelectorAll('.partner-chk').forEach(c => c.checked = false);
      updatePartnerDropdownButton();
      renderList();
    });
  }

  // Table header sorting listeners
  document.querySelectorAll('#manageWorkTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      updateSortHeadersUI();
      renderList();
    });
  });

  // Filter collapse indicator
  const collapseEl = document.getElementById('searchCollapse');
  if (collapseEl) {
    collapseEl.addEventListener('shown.bs.collapse', () => {
      const ind = document.getElementById('searchCollapseIndicator');
      if (ind) ind.textContent = '▲ Hide';
    });
    collapseEl.addEventListener('hidden.bs.collapse', () => {
      const ind = document.getElementById('searchCollapseIndicator');
      if (ind) ind.textContent = '▼ Show';
    });
  }

  populateFilterDatalists();
  updateSortHeadersUI();
  renderList();

  // Single Row Selection click listener
  const tableTbody = document.querySelector('#manageWorkTable tbody');
  if (tableTbody) {
    tableTbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || tr.classList.contains('no-print') || tr.querySelector('td[colspan]')) return;

      // If clicked inside input, select, datepicker, or toggle switch
      if (e.target.closest('input') || e.target.closest('select') || e.target.closest('.mw-switch')) {
        document.querySelectorAll('#manageWorkTable tbody tr').forEach(r => {
          if (r !== tr) r.classList.remove('selected-row');
        });
        tr.classList.add('selected-row');
        return;
      }

      // If clicked on customer button, allow modal to open and select this row
      if (e.target.closest('.mw-customer-btn')) {
        document.querySelectorAll('#manageWorkTable tbody tr').forEach(r => {
          if (r !== tr) r.classList.remove('selected-row');
        });
        tr.classList.add('selected-row');
        return;
      }

      const isAlreadySelected = tr.classList.contains('selected-row');

      // Clear all other selections (strictly single selection)
      document.querySelectorAll('#manageWorkTable tbody tr').forEach(r => {
        r.classList.remove('selected-row');
      });

      if (!isAlreadySelected) {
        tr.classList.add('selected-row');
      }
    });
  }
};

function updateSortHeadersUI() {
  document.querySelectorAll('#manageWorkTable th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.getAttribute('data-sort') === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function getWorkRows() {
  const allRows = DB.getAll('installments') || [];
  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  const isPowerUser = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin' ||
    String(currentUser.userid || '').toLowerCase() === 'amar'
  );

  if (isPowerUser) {
    return allRows;
  }

  if (!currentUser) return [];

  const partnerNames = [
    (currentUser.username || '').toLowerCase().trim(),
    (currentUser.userid || '').toLowerCase().trim()
  ].filter(Boolean);
  if (currentUser.username && currentUser.username.includes(',')) {
    currentUser.username.split(',').forEach(s => partnerNames.push(s.toLowerCase().trim()));
  }

  return allRows.filter(r => {
    const broker = (r.BrokerName || '').toLowerCase().trim();
    if (partnerNames.includes(broker)) return true;
    if (r.BrokerNumber && r.BrokerNumber.includes(`|creator:${currentUser.userid}`)) return true;
    return false;
  });
}

function populateFilterDatalists() {
  const partnerMenu = document.getElementById('partnerMultiselectMenu');
  if (partnerMenu) {
    const allRows = getWorkRows();
    const rawPartners = allRows.map(r => r.BrokerName ? r.BrokerName.trim() : '').filter(Boolean);
    const uniquePartners = [...new Set(rawPartners)].sort();

    partnerMenu.innerHTML = [
      `<div class="form-check mb-1">
         <input class="form-check-input partner-chk" type="checkbox" value="(No Partner)" id="chk_nopartner" ${selectedPartners.includes('(No Partner)') ? 'checked' : ''}>
         <label class="form-check-label w-100 fs-8" for="chk_nopartner">(No Partner)</label>
       </div>`
    ].concat(
      uniquePartners.map(p => `
        <div class="form-check mb-1">
          <input class="form-check-input partner-chk" type="checkbox" value="${p}" id="chk_partner_${p.replace(/\s+/g, '_')}" ${selectedPartners.includes(p) ? 'checked' : ''}>
          <label class="form-check-label w-100 fs-8" for="chk_partner_${p.replace(/\s+/g, '_')}">${p}</label>
        </div>
      `)
    ).join('');

    document.querySelectorAll('.partner-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        selectedPartners = Array.from(document.querySelectorAll('.partner-chk:checked')).map(c => c.value);
        updatePartnerDropdownButton();
        renderList();
      });
    });
  }
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
  renderList();
};

function updateDistrictStats() {
  const container = document.getElementById('districtStatsContainer');
  if (!container) return;

  const allRows = getWorkRows();
  const showDeactive = document.getElementById('chkShowDeactive') ? document.getElementById('chkShowDeactive').checked : false;
  const activeRows = allRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');
  const totalCount = activeRows.length;
  const counts = {};

  activeRows.forEach(r => {
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

  const isTotalActive = selectedDistricts.length === 0;
  const totalBadge = `<button type="button" onclick="window.toggleDistrictBadgeFilter('ALL', event)" class="erp-tag ${isTotalActive ? 'active' : ''}" title="Show all districts">Total: ${totalCount}</button>`;

  const districtBadges = sortedDistricts.map((dist) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistricts.includes(targetDist);
    const safeDist = dist.replace(/'/g, "\\'");

    return `<button type="button" onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="erp-tag ${isSelected ? 'active' : ''}" title="Filter by ${dist}">${dist} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + districtBadges;
}

function getDelayInfo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - d.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (totalDays < 0) return { totalDays, text: '0D', colorType: 'normal' };

  let y = today.getFullYear() - d.getFullYear();
  let m = today.getMonth() - d.getMonth();
  let day = today.getDate() - d.getDate();

  if (day < 0) {
    m -= 1;
    const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    day += prevMonthDays;
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }

  const parts = [];
  if (y > 0) parts.push(`${y}Y`);
  if (m > 0) parts.push(`${m}M`);
  if (day > 0 || parts.length === 0) parts.push(`${day}D`);

  const text = parts.join(' ');
  let colorType = 'normal';
  if (totalDays > 90) {
    colorType = 'red';
  } else if (totalDays > 60) {
    colorType = 'yellow';
  } else {
    colorType = 'normal';
  }

  return { totalDays, text, colorType };
}

function renderList() {
  updateDistrictStats();

  const search = (document.getElementById('fSearch')?.value || '').toLowerCase().trim();
  const loginFrom = document.getElementById('fLoginFrom')?.value;
  const loginTo = document.getElementById('fLoginTo')?.value;
  const dateType = document.getElementById('fDateType')?.value || 'LoginDate';
  const showDeactive = document.getElementById('chkShowDeactive')?.checked || false;

  let rows = getWorkRows();

  // Active / Deactive filter
  if (showDeactive) {
    rows = rows.filter(r => r.Status === 'Deactive');
  } else {
    rows = rows.filter(r => r.Status !== 'Deactive');
  }

  // Search filter
  if (search) {
    rows = rows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search) ||
      String(r.BrokerName || '').toLowerCase().includes(search) ||
      String(r.LoginDate || '').toLowerCase().includes(search) ||
      String(r.AgreementDate || '').toLowerCase().includes(search) ||
      String(r.MaterialDispatchedDate || '').toLowerCase().includes(search) ||
      String(r.InstallationDate || '').toLowerCase().includes(search) ||
      String(r.NetMeterDate || '').toLowerCase().includes(search) ||
      String(r.InspectionDate || '').toLowerCase().includes(search) ||
      String(r.MeterConnectedDate || '').toLowerCase().includes(search) ||
      String(r.CommissioningDate || '').toLowerCase().includes(search)
    );
  }

  // District filter
  if (selectedDistricts.length > 0) {
    rows = rows.filter(r => {
      const distVal = r.District ? r.District.trim() : '(No District)';
      const distName = distVal === '' ? '(No District)' : distVal;
      return selectedDistricts.includes(distName);
    });
  }

  // Partner filter
  if (selectedPartners.length > 0) {
    rows = rows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return selectedPartners.includes(partnerName);
    });
  }

  // Date Range filter
  if (loginFrom) {
    rows = rows.filter(r => r[dateType] && r[dateType] >= loginFrom);
  }
  if (loginTo) {
    rows = rows.filter(r => r[dateType] && r[dateType] <= loginTo);
  }

  // Sort rows
  rows.sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (sortCol === 'SlNo') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else if (typeof aVal === 'string' && (aVal.includes('-') || aVal.includes('/'))) {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    } else {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.querySelector('#manageWorkTable tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted fs-7">No customer workflow records found.</td></tr>`;
    window._lastFilteredWorkRows = [];
    return;
  }

  window._lastFilteredWorkRows = rows;

  tbody.innerHTML = rows.map((r, idx) => {
    const slNo = r.SlNo;
    const isDeactive = (r.Status === 'Deactive');

    // Dates
    const agreementDate = r.AgreementDate || '';
    const hasAgreement = Boolean(agreementDate);

    const dispatchedDate = r.MaterialDispatchedDate || '';
    const hasDispatched = Boolean(dispatchedDate);

    const installationDate = r.InstallationDate || '';
    const hasInstallation = Boolean(installationDate);

    const isNetMeterPaid = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1);
    const netMeterDate = r.NetMeterDate || (isNetMeterPaid ? (r.InstallationDate || '') : '');
    const netMeterPayment = (r.NetMeterPayment !== undefined && r.NetMeterPayment !== null && r.NetMeterPayment !== '') ? r.NetMeterPayment : '';

    const inspectionDate = r.InspectionDate || '';
    const hasInspection = Boolean(inspectionDate);

    const meterConnectedDate = r.MeterConnectedDate || '';
    const hasMeterConnected = Boolean(meterConnectedDate);

    const subsidyDate = r.CommissioningDate || '';
    const hasSubsidy = Boolean(subsidyDate);

    const isAllComplete = hasAgreement && hasDispatched && hasInstallation && isNetMeterPaid && hasInspection && hasMeterConnected && hasSubsidy;

    // Delay Badge for customer
    const delayInfo = getDelayInfo(r.LoginDate);
    const delayBadgeHtml = delayInfo
      ? `<span class="badge erp-delay-badge delay-${delayInfo.colorType} fs-8" title="Login: ${r.LoginDate || ''} (${delayInfo.totalDays} days)">(${delayInfo.text})</span>`
      : '';

    return `
      <tr data-slno="${slNo}" class="${isDeactive ? 'deactive-row' : ''} ${isAllComplete ? 'stage-complete-all' : ''}">
        <!-- 1. Customer Cell (Click name for modal) -->
        <td>
          <div class="mw-customer-cell">
            <span class="mw-sl-badge">#${r.SlNo || (idx + 1)}</span>
            <button type="button" class="mw-customer-btn" onclick="openCustomerDetailsModal(${slNo})" title="Click to view full details of ${r.Name || ''}">
              ${r.Name || 'Unnamed Customer'}
            </button>
            ${delayBadgeHtml}
          </div>
        </td>

        <!-- 2. Aggreement -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Agreement">
              <input type="checkbox" class="mw-stage-toggle" data-stage="AgreementDate" ${hasAgreement ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'AgreementDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasAgreement ? '' : 'd-none'}" id="wrap_AgreementDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${agreementDate}" onchange="handleStageDateChange(${slNo}, 'AgreementDate', this.value)">
            </div>
          </div>
        </td>

        <!-- 3. MaterialDispatched -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Dispatched">
              <input type="checkbox" class="mw-stage-toggle" data-stage="MaterialDispatchedDate" ${hasDispatched ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'MaterialDispatchedDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasDispatched ? '' : 'd-none'}" id="wrap_MaterialDispatchedDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${dispatchedDate}" onchange="handleStageDateChange(${slNo}, 'MaterialDispatchedDate', this.value)">
            </div>
          </div>
        </td>

        <!-- 4. InstallationDone (Mapped to InstallationDate) -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Installation">
              <input type="checkbox" class="mw-stage-toggle" data-stage="InstallationDate" ${hasInstallation ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'InstallationDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasInstallation ? '' : 'd-none'}" id="wrap_InstallationDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${installationDate}" onchange="handleStageDateChange(${slNo}, 'InstallationDate', this.value)">
            </div>
          </div>
        </td>

        <!-- 5. NetMeterApplied (Toggle: NetMeterPaid, Date: NetMeterDate, Amount: NetMeterPayment) -->
        <td>
          <div class="mw-netmeter-cell">
            <label class="mw-switch" title="Toggle NetMeter">
              <input type="checkbox" class="mw-stage-toggle" data-stage="NetMeter" ${isNetMeterPaid ? 'checked' : ''} onchange="handleNetMeterToggle(this, ${slNo})">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap d-inline-flex align-items-center gap-1 ${isNetMeterPaid ? '' : 'd-none'}" id="wrap_NetMeter_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${netMeterDate}" onchange="handleNetMeterDateChange(${slNo}, this.value)" title="NetMeter Application Date">
              <div class="input-group input-group-sm mw-netmeter-pay-group" title="NetMeter Payment (Optional)">
                <span class="input-group-text">₹</span>
                <input type="number" step="0.01" class="form-control form-control-sm" placeholder="Amount" value="${netMeterPayment}" onchange="handleNetMeterPaymentChange(${slNo}, this.value)">
              </div>
            </div>
          </div>
        </td>

        <!-- 6. InspectionDone -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Inspection">
              <input type="checkbox" class="mw-stage-toggle" data-stage="InspectionDate" ${hasInspection ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'InspectionDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasInspection ? '' : 'd-none'}" id="wrap_InspectionDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${inspectionDate}" onchange="handleStageDateChange(${slNo}, 'InspectionDate', this.value)">
            </div>
          </div>
        </td>

        <!-- 7. MeterConnected -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Connection">
              <input type="checkbox" class="mw-stage-toggle" data-stage="MeterConnectedDate" ${hasMeterConnected ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'MeterConnectedDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasMeterConnected ? '' : 'd-none'}" id="wrap_MeterConnectedDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${meterConnectedDate}" onchange="handleStageDateChange(${slNo}, 'MeterConnectedDate', this.value)">
            </div>
          </div>
        </td>

        <!-- 8. SubsidyApplied (Mapped to CommissioningDate) -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch" title="Toggle Subsidy">
              <input type="checkbox" class="mw-stage-toggle" data-stage="CommissioningDate" ${hasSubsidy ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'CommissioningDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasSubsidy ? '' : 'd-none'}" id="wrap_CommissioningDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input" value="${subsidyDate}" onchange="handleStageDateChange(${slNo}, 'CommissioningDate', this.value)">
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ══ Customer Details Popup Modal ═════════════════════════════════════════════
window.openCustomerDetailsModal = function (slNo) {
  const allRows = DB.getAll('installments') || [];
  const r = allRows.find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  const currentUser = Auth.getUser();
  const isPowerUser = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin' ||
    String(currentUser.userid || '').toLowerCase() === 'amar'
  );

  document.getElementById('cdModalSlNo').textContent = `#${r.SlNo}`;
  document.getElementById('cdModalTitle').textContent = r.Name || 'Customer Details';
  
  const statusEl = document.getElementById('cdModalStatus');
  if (statusEl) {
    statusEl.textContent = r.Status || 'Active';
    statusEl.className = `badge ${r.Status === 'Deactive' ? 'bg-danger' : 'bg-success'} ms-1`;
  }

  const delayInfo = getDelayInfo(r.LoginDate);
  const delayStr = delayInfo ? `${delayInfo.text} (${delayInfo.totalDays} days ago)` : '―';

  // Format stages status list
  const stageBadges = [
    { label: 'Agreement', date: r.AgreementDate },
    { label: 'Dispatched', date: r.MaterialDispatchedDate },
    { label: 'Installation', date: r.InstallationDate },
    { label: 'NetMeter', date: r.NetMeterDate || ((r.NetMeterPaid) ? 'Done' : '') },
    { label: 'Inspection', date: r.InspectionDate },
    { label: 'Connection', date: r.MeterConnectedDate },
    { label: 'Subsidy', date: r.CommissioningDate }
  ];

  const modalBody = document.getElementById('cdModalBody');
  if (modalBody) {
    modalBody.innerHTML = `
      <div class="cd-info-grid">
        <!-- 1. General & Contact Info -->
        <div class="cd-info-card">
          <div class="cd-card-title">Consumer & Contact</div>
          <div class="cd-row"><span class="cd-label">Consumer No:</span> <span class="cd-val">${r.ConsumerNo || '―'}</span></div>
          <div class="cd-row"><span class="cd-label">Mobile:</span> <span class="cd-val">${r.MobileNumber ? `<a href="tel:${r.MobileNumber}" class="text-decoration-none">${r.MobileNumber}</a>` : '―'}</span></div>
          <div class="cd-row"><span class="cd-label">District:</span> <span class="cd-val">${r.District || '―'}</span></div>
          <div class="cd-row"><span class="cd-label">Address:</span> <span class="cd-val text-truncate" style="max-width: 140px;" title="${r.Address || ''}">${r.Address || '―'}</span></div>
          <div class="cd-row"><span class="cd-label">PIN / State:</span> <span class="cd-val">${r.PinCode || ''} ${r.State || ''}</span></div>
        </div>

        <!-- 2. System & Commercial Info -->
        <div class="cd-info-card">
          <div class="cd-card-title">System & Commercial</div>
          <div class="cd-row"><span class="cd-label">Brand:</span> <span class="cd-val">${r.CommittedBrand || '―'}</span></div>
          <div class="cd-row"><span class="cd-label">Partner / Broker:</span> <span class="cd-val">${r.BrokerName || '―'}</span></div>
          <div class="cd-row"><span class="cd-label">Partner Contact:</span> <span class="cd-val">${r.BrokerNumber ? r.BrokerNumber.split('|')[0] : '―'}</span></div>
          ${isPowerUser ? `<div class="cd-row"><span class="cd-label">Total Expense:</span> <span class="cd-val text-primary font-monospace">₹${(Number(r.CommittedPrice) || 0).toLocaleString('en-IN')}</span></div>` : ''}
          <div class="cd-row"><span class="cd-label">Net Meter Paid:</span> <span class="cd-val">${r.NetMeterPaid ? `₹${(Number(r.NetMeterPayment) || 0).toLocaleString('en-IN')}` : 'No'}</span></div>
        </div>
      </div>

      <!-- 3. Workflow Progress Tracker -->
      <div class="card border rounded-1 bg-white p-3">
        <div class="fw-bold text-dark fs-7 mb-2 text-uppercase" style="letter-spacing: 0.03em;">Progress & Milestones</div>
        <div class="d-flex flex-wrap gap-2">
          <div class="badge ${r.LoginDate ? 'bg-light text-dark border' : 'bg-light text-muted border'} p-2 d-flex flex-column align-items-start gap-1">
            <span class="fw-semibold fs-8">Login Date</span>
            <span class="fs-8">${r.LoginDate || '―'}</span>
            <span class="text-secondary fs-8">${delayStr}</span>
          </div>
          ${stageBadges.map(st => `
            <div class="badge ${st.date ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-light text-muted border'} p-2 d-flex flex-column align-items-start gap-1">
              <span class="fw-semibold fs-8">${st.date ? '✓' : '○'} ${st.label}</span>
              <span class="fs-8">${st.date || 'Pending'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const modalEl = document.getElementById('customerDetailsModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
};

// ══ Helper for BrokerNumber metadata synchronization ════════════════════════
function formatBrokerNumberWithWorkMeta(existingBrokerNumber, workUpdates) {
  let basePhone = '';
  let expensesJson = '';
  let creatorId = '';
  let workObj = {};

  if (existingBrokerNumber) {
    const parts = existingBrokerNumber.split('|');
    basePhone = parts[0] || '';
    parts.slice(1).forEach(p => {
      if (p.startsWith('expenses:')) {
        expensesJson = p.slice('expenses:'.length);
      } else if (p.startsWith('creator:')) {
        creatorId = p.slice('creator:'.length);
      } else if (p.startsWith('work:')) {
        try {
          workObj = JSON.parse(p.slice('work:'.length));
        } catch (e) {}
      }
    });
  }

  Object.assign(workObj, workUpdates);

  let result = basePhone;
  if (expensesJson) result += '|expenses:' + expensesJson;
  if (creatorId) result += '|creator:' + creatorId;
  result += '|work:' + JSON.stringify(workObj);
  return result;
}

async function saveWorkProgress(slNo, patch, metaUpdates) {
  try {
    const existing = (DB.getAll('installments') || []).find(r => Number(r.SlNo) === Number(slNo));
    if (!existing) return;

    const newBrokerNumber = formatBrokerNumberWithWorkMeta(existing.BrokerNumber || '', metaUpdates || patch);
    const finalPayload = {
      ...patch,
      BrokerNumber: newBrokerNumber
    };

    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), finalPayload);
    UI.toast('Saved progress successfully', 'success');
  } catch (err) {
    console.error('Error saving progress:', err);
    UI.toast('Failed to save: ' + err.message, 'danger');
  }
}

// ══ Toggle and Input Handlers ════════════════════════════════════════════════
const STAGE_DISPLAY_NAMES = {
  AgreementDate: 'Agreement',
  MaterialDispatchedDate: 'Dispatched',
  InstallationDate: 'Installation',
  NetMeter: 'NetMeter',
  InspectionDate: 'Inspection',
  MeterConnectedDate: 'Connection',
  CommissioningDate: 'Subsidy'
};

window.handleStageToggle = async function (toggleEl, slNo, fieldName) {
  const isChecked = toggleEl.checked;
  const stageName = STAGE_DISPLAY_NAMES[fieldName] || fieldName;
  const existing = (DB.getAll('installments') || []).find(r => Number(r.SlNo) === Number(slNo));
  const custName = existing?.Name || `Customer #${slNo}`;
  const consumerNo = existing?.ConsumerNo ? ` (CN: ${existing.ConsumerNo})` : '';
  const today = UI.todayISO();

  let confirmed = false;
  if (isChecked) {
    const msg = `Are you sure you want to mark "${stageName}" as COMPLETED for ${custName}${consumerNo} with date ${today}?`;
    confirmed = await UI.confirmDialog(msg, `Confirm ${stageName}`, 'Yes, Turn ON', 'btn-success');
  } else {
    const existingDate = existing ? existing[fieldName] : '';
    const msg = `Are you sure you want to turn OFF "${stageName}" for ${custName}${consumerNo}? This will clear the recorded date (${existingDate || 'Not set'}) and revert its status.`;
    confirmed = await UI.confirmDialog(msg, `Warning: Turn OFF ${stageName}`, 'Yes, Turn OFF', 'btn-danger');
  }

  if (!confirmed) {
    toggleEl.checked = !isChecked; // Revert switch without saving
    return;
  }

  const wrapEl = document.getElementById(`wrap_${fieldName}_${slNo}`);

  if (isChecked) {
    if (wrapEl) {
      wrapEl.classList.remove('d-none');
      const input = wrapEl.querySelector('input');
      if (input) {
        if (!input.value) input.value = today;
      }
    }
    const dateVal = wrapEl?.querySelector('input')?.value || today;
    const patch = { [fieldName]: dateVal };
    await saveWorkProgress(slNo, patch, patch);
  } else {
    if (wrapEl) {
      wrapEl.classList.add('d-none');
      const input = wrapEl.querySelector('input');
      if (input) input.value = '';
    }
    const patch = { [fieldName]: '' };
    await saveWorkProgress(slNo, patch, patch);
  }
  renderList();
};

window.handleStageDateChange = async function (slNo, fieldName, dateVal) {
  const patch = { [fieldName]: dateVal || '' };
  await saveWorkProgress(slNo, patch, patch);
  renderList();
};

window.handleNetMeterToggle = async function (toggleEl, slNo) {
  const isChecked = toggleEl.checked;
  const existing = (DB.getAll('installments') || []).find(r => Number(r.SlNo) === Number(slNo));
  const custName = existing?.Name || `Customer #${slNo}`;
  const consumerNo = existing?.ConsumerNo ? ` (CN: ${existing.ConsumerNo})` : '';
  const today = UI.todayISO();

  let confirmed = false;
  if (isChecked) {
    const msg = `Are you sure you want to mark "NetMeter" as APPLIED for ${custName}${consumerNo} with date ${today}?`;
    confirmed = await UI.confirmDialog(msg, `Confirm NetMeter`, 'Yes, Turn ON', 'btn-success');
  } else {
    const existingDate = existing?.NetMeterDate || '';
    const existingAmt = existing?.NetMeterPayment ? `₹${Number(existing.NetMeterPayment).toLocaleString('en-IN')}` : '₹0';
    const msg = `Are you sure you want to turn OFF "NetMeter" for ${custName}${consumerNo}? This will clear the NetMeter date (${existingDate || 'None'}) and payment (${existingAmt}).`;
    confirmed = await UI.confirmDialog(msg, `Warning: Turn OFF NetMeter`, 'Yes, Turn OFF', 'btn-danger');
  }

  if (!confirmed) {
    toggleEl.checked = !isChecked; // Revert switch without saving
    return;
  }

  const wrapEl = document.getElementById(`wrap_NetMeter_${slNo}`);

  if (isChecked) {
    if (wrapEl) {
      wrapEl.classList.remove('d-none');
      const dateInput = wrapEl.querySelector('input[type="date"]');
      if (dateInput && !dateInput.value) {
        dateInput.value = today;
      }
    }
    const dateVal = wrapEl?.querySelector('input[type="date"]')?.value || today;
    const paymentVal = wrapEl?.querySelector('input[type="number"]')?.value;
    const numPayment = paymentVal ? Number(paymentVal) : 0;

    const patch = {
      NetMeterPaid: true,
      NetMeterDate: dateVal,
      NetMeterPayment: numPayment
    };
    await saveWorkProgress(slNo, patch, { NetMeterDate: dateVal, NetMeterPayment: numPayment, NetMeterPaid: true });
  } else {
    if (wrapEl) {
      wrapEl.classList.add('d-none');
      const dateInput = wrapEl.querySelector('input[type="date"]');
      if (dateInput) dateInput.value = '';
      const payInput = wrapEl.querySelector('input[type="number"]');
      if (payInput) payInput.value = '';
    }
    const patch = {
      NetMeterPaid: false,
      NetMeterDate: '',
      NetMeterPayment: 0
    };
    await saveWorkProgress(slNo, patch, { NetMeterDate: '', NetMeterPayment: 0, NetMeterPaid: false });
  }
  renderList();
};

window.handleNetMeterDateChange = async function (slNo, dateVal) {
  const patch = { NetMeterDate: dateVal || '' };
  await saveWorkProgress(slNo, patch, { NetMeterDate: dateVal || '' });
  renderList();
};

window.handleNetMeterPaymentChange = async function (slNo, paymentVal) {
  const numVal = paymentVal ? Number(paymentVal) : 0;
  const patch = { NetMeterPayment: numVal };
  await saveWorkProgress(slNo, patch, { NetMeterPayment: numVal });
  renderList();
};

// ══ Summary Modal ═══════════════════════════════════════════════════════════
window.openWorkSummaryModal = function () {
  const rows = window._lastFilteredWorkRows || getWorkRows().filter(r => r.Status !== 'Deactive');
  const total = rows.length;

  let agreementCount = 0;
  let dispatchedCount = 0;
  let installedCount = 0;
  let netMeterCount = 0;
  let inspectionCount = 0;
  let connectedCount = 0;
  let subsidyCount = 0;

  rows.forEach(r => {
    if (r.AgreementDate) agreementCount++;
    if (r.MaterialDispatchedDate) dispatchedCount++;
    if (r.InstallationDate) installedCount++;
    if (r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate) netMeterCount++;
    if (r.InspectionDate) inspectionCount++;
    if (r.MeterConnectedDate) connectedCount++;
    if (r.CommissioningDate) subsidyCount++;
  });

  const kpiGrid = document.getElementById('workKpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Total Customers</span>
        <span class="mw-kpi-value text-dark">${total}</span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Agreement</span>
        <span class="mw-kpi-value text-primary">${agreementCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(agreementCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Dispatched</span>
        <span class="mw-kpi-value text-info">${dispatchedCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(dispatchedCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Installation</span>
        <span class="mw-kpi-value text-warning">${installedCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(installedCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">NetMeter</span>
        <span class="mw-kpi-value text-purple">${netMeterCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(netMeterCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Inspection</span>
        <span class="mw-kpi-value text-secondary">${inspectionCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(inspectionCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Connection</span>
        <span class="mw-kpi-value text-primary">${connectedCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(connectedCount/total*100) : 0}%)</span></span>
      </div>
      <div class="mw-kpi-card">
        <span class="mw-kpi-title">Subsidy</span>
        <span class="mw-kpi-value text-success">${subsidyCount} <span class="fs-8 text-muted fw-normal">(${total ? Math.round(subsidyCount/total*100) : 0}%)</span></span>
      </div>
    `;
  }

  const renderPopupTable = (filterTxt = '') => {
    const filtered = rows.filter(r => {
      if (!filterTxt) return true;
      return (
        String(r.Name || '').toLowerCase().includes(filterTxt) ||
        String(r.ConsumerNo || '').toLowerCase().includes(filterTxt) ||
        String(r.BrokerName || '').toLowerCase().includes(filterTxt) ||
        String(r.District || '').toLowerCase().includes(filterTxt)
      );
    });

    const tbody = document.querySelector('#workSummaryTable tbody');
    if (tbody) {
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No records matching popup search.</td></tr>`;
        return;
      }
      tbody.innerHTML = filtered.map((r, i) => `
        <tr>
          <td class="text-center text-muted fs-8">${r.SlNo || (i + 1)}</td>
          <td><span class="fw-semibold text-dark">${r.Name || '-'}</span></td>
          <td><span class="text-secondary fs-8">${r.BrokerName || '-'}</span></td>
          <td class="text-center">${r.AgreementDate ? `<span class="badge bg-success-subtle text-success border border-success-subtle">✓ ${r.AgreementDate}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${r.MaterialDispatchedDate ? `<span class="badge bg-info-subtle text-info border border-info-subtle">✓ ${r.MaterialDispatchedDate}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${r.InstallationDate ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">✓ ${r.InstallationDate}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${(r.NetMeterPaid || r.NetMeterDate) ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle">✓ ${r.NetMeterDate || 'Paid'}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${r.InspectionDate ? `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">✓ ${r.InspectionDate}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${r.MeterConnectedDate ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle">✓ ${r.MeterConnectedDate}</span>` : '<span class="text-muted">―</span>'}</td>
          <td class="text-center">${r.CommissioningDate ? `<span class="badge bg-success-subtle text-success border border-success-subtle">✓ ${r.CommissioningDate}</span>` : '<span class="text-muted">―</span>'}</td>
        </tr>
      `).join('');
    }
  };

  renderPopupTable();

  const searchInput = document.getElementById('fSumModalSearch');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = (e) => renderPopupTable(e.target.value.toLowerCase().trim());
  }

  const modalEl = document.getElementById('workSummaryModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
};
