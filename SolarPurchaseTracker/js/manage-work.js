/* =========================================================================
   manage-work.js — Progress & Workflow Stage Management Tracker
   ========================================================================= */

let sortCol = 'SlNo';
let sortDir = 'asc';

let selectedDistricts = [];
let selectedPartners = [];
let selectedStage = 'ALL';

const WORKFLOW_STAGES = [
  { key: 'LoginDate', name: 'Login', num: 1 },
  { key: 'AgreementDate', name: 'Agreement', num: 2 },
  { key: 'MaterialDispatchedDate', name: 'Dispatched', num: 3 },
  { key: 'InstallationDate', name: 'Installation', num: 4 },
  { key: 'NetMeter', name: 'NetMeter', num: 5 },
  { key: 'InspectionDate', name: 'Inspection', num: 6 },
  { key: 'MeterConnectedDate', name: 'Connection', num: 7 },
  { key: 'CommissioningDate', name: 'Subsidy', num: 8 }
];

function getRowHighestStageIdx(r) {
  const isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
  const stages = [
    Boolean(r.LoginDate),
    Boolean(r.AgreementDate),
    Boolean(r.MaterialDispatchedDate),
    Boolean(r.InstallationDate),
    isNm,
    Boolean(r.InspectionDate),
    Boolean(r.MeterConnectedDate),
    Boolean(r.CommissioningDate)
  ];
  let highestIdx = -1;
  stages.forEach((d, idx) => {
    if (d) highestIdx = Math.max(highestIdx, idx);
  });
  return highestIdx < 0 ? 0 : highestIdx;
}

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
  ['fSearch', 'chkShowDeactive'].forEach(id => {
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
      const fSearch = document.getElementById('fSearch');
      if (fSearch) fSearch.value = '';
      const chkDeactive = document.getElementById('chkShowDeactive');
      if (chkDeactive) chkDeactive.checked = false;

      selectedDistricts = [];
      selectedPartners = [];
      selectedStage = 'ALL';
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
      }
      updateSortHeadersUI();
      renderList();
    });
  });

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
    currentUser.role === 'superadmin'
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
  let activeRows = allRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');

  // Filter by search text
  const search = (document.getElementById('fSearch') ? document.getElementById('fSearch').value : '').toLowerCase().trim();
  if (search) {
    activeRows = activeRows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search) ||
      String(r.BrokerName || '').toLowerCase().includes(search)
    );
  }

  // Filter by selected partners
  if (selectedPartners.length > 0) {
    activeRows = activeRows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return selectedPartners.includes(partnerName);
    });
  }

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

window.toggleStageBadgeFilter = function(stageKey, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (stageKey === 'ALL' || selectedStage === stageKey) {
    selectedStage = 'ALL';
  } else {
    selectedStage = stageKey;
  }
  renderList();
};

function updateStageStats() {
  const container = document.getElementById('stageStatsContainer');
  if (!container) return;

  const allRows = getWorkRows();
  const showDeactive = document.getElementById('chkShowDeactive') ? document.getElementById('chkShowDeactive').checked : false;
  let activeRows = allRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');

  // Filter by search text
  const search = (document.getElementById('fSearch') ? document.getElementById('fSearch').value : '').toLowerCase().trim();
  if (search) {
    activeRows = activeRows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search) ||
      String(r.BrokerName || '').toLowerCase().includes(search)
    );
  }

  // Filter by selected districts
  if (selectedDistricts.length > 0) {
    activeRows = activeRows.filter(r => {
      const dist = r.District ? r.District.trim() : '(No District)';
      const distName = dist === '' ? '(No District)' : dist;
      return selectedDistricts.includes(distName);
    });
  }

  // Filter by selected partners
  if (selectedPartners.length > 0) {
    activeRows = activeRows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return selectedPartners.includes(partnerName);
    });
  }

  const stageCounts = [0, 0, 0, 0, 0, 0, 0, 0];
  activeRows.forEach(r => {
    const idx = getRowHighestStageIdx(r);
    if (idx >= 0 && idx < 8) {
      stageCounts[idx]++;
    }
  });

  const totalCount = activeRows.length;
  const isTotalActive = (selectedStage === 'ALL');

  const totalBadge = `<button type="button" onclick="window.toggleStageBadgeFilter('ALL', event)" class="stage-filter-tag ${isTotalActive ? 'active' : ''}" title="Show all stages">Total (${totalCount})</button>`;

  const stageBadges = WORKFLOW_STAGES.map((st, idx) => {
    const count = stageCounts[idx] || 0;
    const isSelected = (selectedStage === st.key);
    return `<button type="button" onclick="window.toggleStageBadgeFilter('${st.key}', event)" class="stage-filter-tag stage-tag-${st.num} ${isSelected ? 'active' : ''}" title="Filter by Stage ${st.num}: ${st.name}">${st.num}. ${st.name} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + stageBadges;
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
  updateStageStats();

  const search = (document.getElementById('fSearch')?.value || '').toLowerCase().trim();
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

  // Stage filter (matching highest reached stage)
  if (selectedStage && selectedStage !== 'ALL') {
    const targetIdx = WORKFLOW_STAGES.findIndex(s => s.key === selectedStage);
    if (targetIdx !== -1) {
      rows = rows.filter(r => getRowHighestStageIdx(r) === targetIdx);
    }
  }

  // Sort rows: Customers with Subsidy ON (CommissioningDate) are always placed at the bottom
  rows.sort((a, b) => {
    const aSubsidy = Boolean(a.CommissioningDate);
    const bSubsidy = Boolean(b.CommissioningDate);
    if (aSubsidy !== bSubsidy) {
      return aSubsidy ? 1 : -1; // Subsidy ON always placed last
    }

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
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted fs-7">No customer workflow records found.</td></tr>`;
    window._lastFilteredWorkRows = [];
    return;
  }

  window._lastFilteredWorkRows = rows;

  tbody.innerHTML = rows.map((r, idx) => {
    const slNo = r.SlNo;
    const isDeactive = (r.Status === 'Deactive');

    // Dates
    const loginDate = r.LoginDate || '';
    const hasLogin = Boolean(loginDate);
    const loginDelay = getDelayInfo(loginDate);

    const agreementDate = r.AgreementDate || '';
    const hasAgreement = Boolean(agreementDate);
    const agrmtDelay = getDelayInfo(agreementDate);

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

    const isAllComplete = hasLogin && hasAgreement && hasDispatched && hasInstallation && isNetMeterPaid && hasInspection && hasMeterConnected && hasSubsidy;

    // Highest reached stage calculation
    const isNm = isNetMeterPaid || Boolean(r.NetMeterDate);
    const stages = [
      hasLogin,
      hasAgreement,
      hasDispatched,
      hasInstallation,
      isNm,
      hasInspection,
      hasMeterConnected,
      hasSubsidy
    ];
    let highestMarkedIdx = -1;
    stages.forEach((d, stageIdx) => {
      if (d) highestMarkedIdx = Math.max(highestMarkedIdx, stageIdx);
    });
    if (highestMarkedIdx < 0 && hasLogin) highestMarkedIdx = 0;

    // Stage 1 (Login) delay condition: strictly for customers whose highest reached stage is Login (idx === 0)
    let loginSwitchClass = '';
    let loginDateClass = '';
    let loginTitle = 'Toggle Login';
    if (hasLogin && highestMarkedIdx === 0 && loginDelay) {
      if (loginDelay.totalDays >= 90) {
        loginSwitchClass = 'switch-delay-red';
        loginDateClass = 'date-delay-red';
        loginTitle = `Login: Delayed >= 3 Months (${loginDelay.text}, ${loginDelay.totalDays} days)`;
      } else if (loginDelay.totalDays >= 60) {
        loginSwitchClass = 'switch-delay-yellow';
        loginDateClass = 'date-delay-yellow';
        loginTitle = `Login: Delayed >= 2 Months (${loginDelay.text}, ${loginDelay.totalDays} days)`;
      }
    }

    // Stage 2 (Agreement) delay condition: for customers whose highest stage is Agreement, Dispatch, Installation, or NetMeter (idx 1-4)
    let agrmtSwitchClass = '';
    let agrmtDateClass = '';
    let agrmtTitle = 'Toggle Agreement';
    const isEligibleForAgrmtAlert = (highestMarkedIdx >= 1 && highestMarkedIdx <= 4);
    if (hasAgreement && isEligibleForAgrmtAlert && agrmtDelay) {
      if (agrmtDelay.totalDays >= 90) {
        agrmtSwitchClass = 'switch-delay-red';
        agrmtDateClass = 'date-delay-red';
        agrmtTitle = `Agreement: Delayed >= 3 Months (${agrmtDelay.text}, ${agrmtDelay.totalDays} days)`;
      } else if (agrmtDelay.totalDays >= 60) {
        agrmtSwitchClass = 'switch-delay-yellow';
        agrmtDateClass = 'date-delay-yellow';
        agrmtTitle = `Agreement: Delayed >= 2 Months (${agrmtDelay.text}, ${agrmtDelay.totalDays} days)`;
      }
    }

    // Delay Badge for customer (hidden if Subsidy is ON)
    const delayInfo = !hasSubsidy ? getDelayInfo(r.LoginDate) : null;
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

        <!-- 2. Login -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch ${loginSwitchClass}" title="${loginTitle}">
              <input type="checkbox" class="mw-stage-toggle" data-stage="LoginDate" ${hasLogin ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'LoginDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasLogin ? '' : 'd-none'}" id="wrap_LoginDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input ${loginDateClass}" value="${loginDate}" onchange="handleStageDateChange(${slNo}, 'LoginDate', this.value)" title="${loginTitle}">
            </div>
          </div>
        </td>

        <!-- 3. Aggreement -->
        <td>
          <div class="mw-stage-cell">
            <label class="mw-switch ${agrmtSwitchClass}" title="${agrmtTitle}">
              <input type="checkbox" class="mw-stage-toggle" data-stage="AgreementDate" ${hasAgreement ? 'checked' : ''} onchange="handleStageToggle(this, ${slNo}, 'AgreementDate')">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${hasAgreement ? '' : 'd-none'}" id="wrap_AgreementDate_${slNo}">
              <input type="date" class="form-control form-control-sm mw-date-input ${agrmtDateClass}" value="${agreementDate}" onchange="handleStageDateChange(${slNo}, 'AgreementDate', this.value)" title="${agrmtTitle}">
            </div>
          </div>
        </td>

        <!-- 4. MaterialDispatched -->
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

        <!-- 5. InstallationDone (Mapped to InstallationDate) -->
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

        <!-- 6. NetMeterApplied (Toggle: NetMeterPaid, Date: NetMeterDate, Amount: NetMeterPayment) -->
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

        <!-- 7. InspectionDone -->
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

        <!-- 8. MeterConnected -->
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

        <!-- 9. SubsidyApplied (Mapped to CommissioningDate) -->
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
    currentUser.role === 'superadmin'
  );

  document.getElementById('cdModalSlNo').textContent = `#${r.SlNo}`;
  document.getElementById('cdModalTitle').textContent = r.Name || 'Customer Details';
  
  const statusEl = document.getElementById('cdModalStatus');
  if (statusEl) {
    statusEl.textContent = r.Status || 'Active';
    statusEl.className = `badge ${r.Status === 'Deactive' ? 'bg-danger' : 'bg-success'} ms-1`;
  }

  const hasSubsidy = Boolean(r.CommissioningDate);
  const delayInfo = !hasSubsidy ? getDelayInfo(r.LoginDate) : null;
  const delayStr = delayInfo ? `${delayInfo.text} (${delayInfo.totalDays} days ago)` : (hasSubsidy ? 'Completed' : '―');

  // Stage Stepper calculation across columns
  const stageBadges = [
    { label: 'Login', date: r.LoginDate },
    { label: 'Agreement', date: r.AgreementDate },
    { label: 'Dispatched', date: r.MaterialDispatchedDate },
    { label: 'Installation', date: r.InstallationDate },
    { label: 'NetMeter', date: r.NetMeterDate || ((r.NetMeterPaid) ? (r.InstallationDate || 'Paid') : '') },
    { label: 'Inspection', date: r.InspectionDate },
    { label: 'Connection', date: r.MeterConnectedDate },
    { label: 'Subsidy', date: r.CommissioningDate }
  ];

  let highestMarkedIdx = -1;
  stageBadges.forEach((st, idx) => {
    if (st.date) {
      highestMarkedIdx = Math.max(highestMarkedIdx, idx);
    }
  });

  let trackPct = 0;
  if (highestMarkedIdx > 0) {
    trackPct = Math.round((highestMarkedIdx / (stageBadges.length - 1)) * 100);
  } else if (highestMarkedIdx === 0) {
    trackPct = 10;
  }

  const loginDelay = getDelayInfo(r.LoginDate);
  const agrmtDelay = getDelayInfo(r.AgreementDate);

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

      <!-- 3. Workflow Stage Progress Stepper (Timeline across Column Names) -->
      <div class="card border rounded-1 bg-white p-3">
        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
          <div class="fw-bold text-dark fs-7 text-uppercase" style="letter-spacing: 0.03em;">Stage Milestone Progression</div>
          <span class="fs-8 text-secondary">Login: <strong>${r.LoginDate || '―'}</strong> ${delayStr !== '―' ? `(${delayStr})` : ''}</span>
        </div>
        <div class="position-relative mw-stage-stepper-container mt-1">
          <div class="mw-stepper-track-wrap">
            <div class="mw-stepper-track-fill" style="width: ${trackPct}%;"></div>
          </div>
          ${stageBadges.map((st, i) => {
            const isDone = (i <= highestMarkedIdx) || Boolean(st.date);
            let delayStepClass = '';
            if (i === 0 && highestMarkedIdx === 0 && loginDelay) {
              if (loginDelay.totalDays >= 90) delayStepClass = 'stepper-delay-red';
              else if (loginDelay.totalDays >= 60) delayStepClass = 'stepper-delay-yellow';
            } else if (i === 1 && (highestMarkedIdx >= 1 && highestMarkedIdx <= 4) && agrmtDelay) {
              if (agrmtDelay.totalDays >= 90) delayStepClass = 'stepper-delay-red';
              else if (agrmtDelay.totalDays >= 60) delayStepClass = 'stepper-delay-yellow';
            }

            return `
              <div class="mw-stepper-step ${isDone ? 'completed' : ''} ${delayStepClass}">
                <div class="mw-stepper-circle">${isDone ? '✓' : (i + 1)}</div>
                <div class="mw-stepper-col-name">${st.label}</div>
                <div class="mw-stepper-date">${st.date ? st.date : '&nbsp;'}</div>
              </div>
            `;
          }).join('')}
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
  LoginDate: 'Login',
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

  let latestDates = {
    AgreementDate: '',
    MaterialDispatchedDate: '',
    InstallationDate: '',
    NetMeterDate: '',
    InspectionDate: '',
    MeterConnectedDate: '',
    CommissioningDate: ''
  };

  let stageCurrentCounts = {
    'LoginDate': 0,
    'AgreementDate': 0,
    'MaterialDispatchedDate': 0,
    'InstallationDate': 0,
    'NetMeter': 0,
    'InspectionDate': 0,
    'MeterConnectedDate': 0,
    'CommissioningDate': 0
  };

  rows.forEach(r => {
    const isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
    const stages = [
      Boolean(r.LoginDate),
      Boolean(r.AgreementDate),
      Boolean(r.MaterialDispatchedDate),
      Boolean(r.InstallationDate),
      isNm,
      Boolean(r.InspectionDate),
      Boolean(r.MeterConnectedDate),
      Boolean(r.CommissioningDate)
    ];
    let highestIdx = -1;
    stages.forEach((d, idx) => {
      if (d) highestIdx = Math.max(highestIdx, idx);
    });

    if (highestIdx === 0) stageCurrentCounts.LoginDate++;
    else if (highestIdx === 1) stageCurrentCounts.AgreementDate++;
    else if (highestIdx === 2) stageCurrentCounts.MaterialDispatchedDate++;
    else if (highestIdx === 3) stageCurrentCounts.InstallationDate++;
    else if (highestIdx === 4) stageCurrentCounts.NetMeter++;
    else if (highestIdx === 5) stageCurrentCounts.InspectionDate++;
    else if (highestIdx === 6) stageCurrentCounts.MeterConnectedDate++;
    else if (highestIdx === 7) stageCurrentCounts.CommissioningDate++;
  });

  const getPct = (cnt) => (total > 0 ? Math.round((cnt / total) * 100) : 0);

  const loginCount = stageCurrentCounts.LoginDate;
  const agreementCount = stageCurrentCounts.AgreementDate;
  const dispatchedCount = stageCurrentCounts.MaterialDispatchedDate;
  const installedCount = stageCurrentCounts.InstallationDate;
  const netMeterCount = stageCurrentCounts.NetMeter;
  const inspectionCount = stageCurrentCounts.InspectionDate;
  const connectedCount = stageCurrentCounts.MeterConnectedDate;
  const subsidyCount = stageCurrentCounts.CommissioningDate;

  let selectedSummaryStage = 'ALL';

  const kpiGrid = document.getElementById('workKpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <!-- Total -->
      <div class="mw-kpi-card border-start border-3 border-dark kpi-card-selected" data-stage="ALL" title="Click to show all customers">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">TOTAL</span>
          <span class="badge bg-light text-dark border" style="font-size: 0.50rem; padding: 1px 3px;">All</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-dark">${total}</span>
          <span class="mw-kpi-subtext">all</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-dark" role="progressbar" style="width: 100%;"></div>
        </div>
      </div>

      <!-- Login -->
      <div class="mw-kpi-card border-start border-3" style="border-color: #0284c7 !important;" data-stage="LoginDate" title="Click to filter by Login stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Login</span>
          <span class="mw-kpi-pct" style="color: #0284c7;">${getPct(loginCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value" style="color: #0284c7;">${loginCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar" role="progressbar" style="background-color: #0284c7; width: ${getPct(loginCount)}%;"></div>
        </div>
      </div>

      <!-- Agreement -->
      <div class="mw-kpi-card border-start border-3 border-primary" data-stage="AgreementDate" title="Click to filter by Agreement stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Agreement</span>
          <span class="mw-kpi-pct text-primary">${getPct(agreementCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-primary">${agreementCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-primary" role="progressbar" style="width: ${getPct(agreementCount)}%;"></div>
        </div>
      </div>

      <!-- Dispatched -->
      <div class="mw-kpi-card border-start border-3 border-info" data-stage="MaterialDispatchedDate" title="Click to filter by Dispatched stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Dispatched</span>
          <span class="mw-kpi-pct text-info">${getPct(dispatchedCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-info">${dispatchedCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-info" role="progressbar" style="width: ${getPct(dispatchedCount)}%;"></div>
        </div>
      </div>

      <!-- Installation -->
      <div class="mw-kpi-card border-start border-3 border-warning" data-stage="InstallationDate" title="Click to filter by Installation stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Installation</span>
          <span class="mw-kpi-pct text-warning">${getPct(installedCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-warning">${installedCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-warning" role="progressbar" style="width: ${getPct(installedCount)}%;"></div>
        </div>
      </div>

      <!-- NetMeter -->
      <div class="mw-kpi-card border-start border-3" style="border-color: #8b5cf6 !important;" data-stage="NetMeter" title="Click to filter by NetMeter stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">NetMeter</span>
          <span class="mw-kpi-pct" style="color: #8b5cf6;">${getPct(netMeterCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value" style="color: #8b5cf6;">${netMeterCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar" role="progressbar" style="background-color: #8b5cf6; width: ${getPct(netMeterCount)}%;"></div>
        </div>
      </div>

      <!-- Inspection -->
      <div class="mw-kpi-card border-start border-3 border-secondary" data-stage="InspectionDate" title="Click to filter by Inspection stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Inspection</span>
          <span class="mw-kpi-pct text-secondary">${getPct(inspectionCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-secondary">${inspectionCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-secondary" role="progressbar" style="width: ${getPct(inspectionCount)}%;"></div>
        </div>
      </div>

      <!-- Connection -->
      <div class="mw-kpi-card border-start border-3 border-primary" data-stage="MeterConnectedDate" title="Click to filter by Connection stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Connection</span>
          <span class="mw-kpi-pct text-primary">${getPct(connectedCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-primary">${connectedCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-primary" role="progressbar" style="width: ${getPct(connectedCount)}%;"></div>
        </div>
      </div>

      <!-- Subsidy (Final Milestone) -->
      <div class="mw-kpi-card border-start border-3 border-success" data-stage="CommissioningDate" title="Click to filter by Subsidy stage">
        <div class="mw-kpi-header">
          <span class="mw-kpi-title">Subsidy</span>
          <span class="mw-kpi-pct text-success">${getPct(subsidyCount)}%</span>
        </div>
        <div class="mw-kpi-value-row">
          <span class="mw-kpi-value text-success">${subsidyCount}</span>
          <span class="mw-kpi-subtext">of ${total}</span>
        </div>
        <div class="mw-kpi-progress">
          <div class="progress-bar bg-success" role="progressbar" style="width: ${getPct(subsidyCount)}%;"></div>
        </div>
      </div>
    `;

    // Click event on KPI cards to filter customer list
    kpiGrid.querySelectorAll('.mw-kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const stage = card.getAttribute('data-stage') || 'ALL';
        if (selectedSummaryStage === stage && stage !== 'ALL') {
          selectedSummaryStage = 'ALL';
        } else {
          selectedSummaryStage = stage;
        }

        kpiGrid.querySelectorAll('.mw-kpi-card').forEach(c => {
          c.classList.remove('kpi-card-selected');
          if (c.getAttribute('data-stage') === selectedSummaryStage) {
            c.classList.add('kpi-card-selected');
          }
        });

        const searchInput = document.getElementById('fSumModalSearch');
        renderPopupTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
      });
    });
  }

  const stageKeys = [
    'LoginDate',
    'AgreementDate',
    'MaterialDispatchedDate',
    'InstallationDate',
    'NetMeter',
    'InspectionDate',
    'MeterConnectedDate',
    'CommissioningDate'
  ];

  let sumModalSortCol = null;
  let sumModalSortDir = 'desc';

  function getLoginSortScore(r) {
    const isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
    const stages = [
      Boolean(r.LoginDate),
      Boolean(r.AgreementDate),
      Boolean(r.MaterialDispatchedDate),
      Boolean(r.InstallationDate),
      isNm,
      Boolean(r.InspectionDate),
      Boolean(r.MeterConnectedDate),
      Boolean(r.CommissioningDate)
    ];
    let highestIdx = -1;
    stages.forEach((d, idx) => {
      if (d) highestIdx = Math.max(highestIdx, idx);
    });

    const loginDate = r.LoginDate || '';
    const loginDelay = getDelayInfo(loginDate);
    let alertScore = 0; // 0 = inactive
    let delayDays = loginDelay ? loginDelay.totalDays : -999;

    if (highestIdx === 0 && loginDelay) {
      if (loginDelay.totalDays >= 90) {
        alertScore = 3; // RED (>= 3 months delay)
      } else if (loginDelay.totalDays >= 60) {
        alertScore = 2; // YELLOW (>= 2 months delay)
      } else {
        alertScore = 1; // BLUE (normal)
      }
    } else if (highestIdx > 0) {
      alertScore = 0.5; // Progressed past Login
    }

    return { alertScore, delayDays };
  }

  function getAgreementSortScore(r) {
    const isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
    const stages = [
      Boolean(r.LoginDate),
      Boolean(r.AgreementDate),
      Boolean(r.MaterialDispatchedDate),
      Boolean(r.InstallationDate),
      isNm,
      Boolean(r.InspectionDate),
      Boolean(r.MeterConnectedDate),
      Boolean(r.CommissioningDate)
    ];
    let highestIdx = -1;
    stages.forEach((d, idx) => {
      if (d) highestIdx = Math.max(highestIdx, idx);
    });

    const agrmtDate = r.AgreementDate || '';
    const agrmtDelay = getDelayInfo(agrmtDate);
    const isEligibleForAlert = (highestIdx >= 1 && highestIdx <= 4);

    let alertScore = 0; // 0 = inactive
    let delayDays = agrmtDelay ? agrmtDelay.totalDays : -999;

    if (highestIdx >= 1) {
      if (isEligibleForAlert && agrmtDelay && agrmtDelay.totalDays >= 90) {
        alertScore = 3; // RED (>= 3 months delay)
      } else if (isEligibleForAlert && agrmtDelay && agrmtDelay.totalDays >= 60) {
        alertScore = 2; // YELLOW (>= 2 months delay)
      } else {
        alertScore = 1; // BLUE (normal / no delay)
      }
    }

    return { alertScore, delayDays };
  }

  const renderPopupTable = (filterTxt = '') => {
    let filtered = [...rows];

    // Filter by selected summary stage (strictly customers whose maximum reached level is this stage)
    if (selectedSummaryStage && selectedSummaryStage !== 'ALL') {
      const targetStageIdx = stageKeys.indexOf(selectedSummaryStage);
      filtered = filtered.filter(r => {
        const stages = [
          Boolean(r.LoginDate),
          Boolean(r.AgreementDate),
          Boolean(r.MaterialDispatchedDate),
          Boolean(r.InstallationDate),
          Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate),
          Boolean(r.InspectionDate),
          Boolean(r.MeterConnectedDate),
          Boolean(r.CommissioningDate)
        ];
        let highestIdx = -1;
        stages.forEach((d, idx) => {
          if (d) highestIdx = Math.max(highestIdx, idx);
        });
        return highestIdx === targetStageIdx;
      });
    }

    // Filter by search text
    if (filterTxt) {
      filtered = filtered.filter(r =>
        String(r.Name || '').toLowerCase().includes(filterTxt) ||
        String(r.ConsumerNo || '').toLowerCase().includes(filterTxt) ||
        String(r.BrokerName || '').toLowerCase().includes(filterTxt) ||
        String(r.District || '').toLowerCase().includes(filterTxt)
      );
    }

    // Sort by Login or Agreement Alert Status (Red -> Yellow -> Blue) or Partner Name
    if (sumModalSortCol === 'Login') {
      filtered.sort((a, b) => {
        const scoreA = getLoginSortScore(a);
        const scoreB = getLoginSortScore(b);

        if (scoreA.alertScore !== scoreB.alertScore) {
          return sumModalSortDir === 'desc'
            ? scoreB.alertScore - scoreA.alertScore
            : scoreA.alertScore - scoreB.alertScore;
        }
        return sumModalSortDir === 'desc'
          ? scoreB.delayDays - scoreA.delayDays
          : scoreA.delayDays - scoreB.delayDays;
      });
    } else if (sumModalSortCol === 'Agreement') {
      filtered.sort((a, b) => {
        const scoreA = getAgreementSortScore(a);
        const scoreB = getAgreementSortScore(b);

        if (scoreA.alertScore !== scoreB.alertScore) {
          return sumModalSortDir === 'desc'
            ? scoreB.alertScore - scoreA.alertScore
            : scoreA.alertScore - scoreB.alertScore;
        }
        // Sub-sort by total delay days within the same color group
        return sumModalSortDir === 'desc'
          ? scoreB.delayDays - scoreA.delayDays
          : scoreA.delayDays - scoreB.delayDays;
      });
    } else if (sumModalSortCol === 'Partner') {
      // Sort by Partner Name (A-Z / Z-A)
      filtered.sort((a, b) => {
        const pA = String(a.BrokerName || 'Direct').toLowerCase().trim();
        const pB = String(b.BrokerName || 'Direct').toLowerCase().trim();
        return sumModalSortDir === 'asc' ? pA.localeCompare(pB) : pB.localeCompare(a.BrokerName || 'Direct');
      });
    }

    const countBadge = document.getElementById('sumModalRowCount');
    if (countBadge) {
      countBadge.textContent = `${filtered.length} of ${rows.length} customers`;
    }

    const tbody = document.querySelector('#workSummaryTable tbody');
    if (tbody) {
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted fs-8">No records matching search.</td></tr>`;
        return;
      }
      tbody.innerHTML = filtered.map((r, i) => {
        const isNetMeterMarked = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
        const loginDate = r.LoginDate || '';
        const loginDelay = getDelayInfo(loginDate);
        const agrmtDate = r.AgreementDate || '';
        const agrmtDelay = getDelayInfo(agrmtDate);

        const stages = [
          { num: 1, date: r.LoginDate || '', isMarked: Boolean(r.LoginDate) },
          { num: 2, date: r.AgreementDate || '', isMarked: Boolean(r.AgreementDate) },
          { num: 3, date: r.MaterialDispatchedDate || '', isMarked: Boolean(r.MaterialDispatchedDate) },
          { num: 4, date: r.InstallationDate || '', isMarked: Boolean(r.InstallationDate) },
          { num: 5, date: r.NetMeterDate || '', isMarked: isNetMeterMarked },
          { num: 6, date: r.InspectionDate || '', isMarked: Boolean(r.InspectionDate) },
          { num: 7, date: r.MeterConnectedDate || '', isMarked: Boolean(r.MeterConnectedDate) },
          { num: 8, date: r.CommissioningDate || '', isMarked: Boolean(r.CommissioningDate) }
        ];

        let highestMarkedIdx = -1;
        stages.forEach((st, idx) => {
          if (st.isMarked || st.date) {
            highestMarkedIdx = Math.max(highestMarkedIdx, idx);
          }
        });

        const stageCellsHtml = stages.map((st, idx) => {
          const isDone = (idx <= highestMarkedIdx) || st.isMarked || Boolean(st.date);
          const hasLeftLine = idx > 0;
          const hasRightLine = idx < stages.length - 1;
          const leftFilled = hasLeftLine && (idx <= highestMarkedIdx);
          const rightFilled = hasRightLine && (idx < highestMarkedIdx);

          let nodeClass = 'node-inactive';
          let nodeTitle = `Stage ${st.num}`;
          let dateClass = '';

          if (isDone) {
            nodeClass = 'node-active';
            // Stage 1 (Login) delay alert: only for customers whose highest stage is strictly Login (idx === 0)
            if (idx === 0 && highestMarkedIdx === 0 && loginDelay) {
              if (loginDelay.totalDays >= 90) {
                nodeClass += ' node-delay-red';
                nodeTitle = `Login: ${loginDelay.text} (${loginDelay.totalDays} days ago - Delayed >= 3 Months)`;
                dateClass = 'date-delay-red';
              } else if (loginDelay.totalDays >= 60) {
                nodeClass += ' node-delay-yellow';
                nodeTitle = `Login: ${loginDelay.text} (${loginDelay.totalDays} days ago - Delayed >= 2 Months)`;
                dateClass = 'date-delay-yellow';
              }
            }

            // Stage 2 (Agreement) delay alert: for customers whose maximum reached stage is Agreement, Dispatch, Installation, or NetMeter (Stages 2-5, idx 1-4)
            const isEligibleForAlert = (highestMarkedIdx >= 1 && highestMarkedIdx <= 4);
            if (idx === 1 && isEligibleForAlert && agrmtDelay) {
              if (agrmtDelay.totalDays >= 90) {
                nodeClass += ' node-delay-red';
                nodeTitle = `Agreement: ${agrmtDelay.text} (${agrmtDelay.totalDays} days ago - Delayed >= 3 Months)`;
                dateClass = 'date-delay-red';
              } else if (agrmtDelay.totalDays >= 60) {
                nodeClass += ' node-delay-yellow';
                nodeTitle = `Agreement: ${agrmtDelay.text} (${agrmtDelay.totalDays} days ago - Delayed >= 2 Months)`;
                dateClass = 'date-delay-yellow';
              }
            }
          }

          return `
            <td class="mw-stepper-td">
              <div class="mw-row-stepper-cell" title="${nodeTitle}">
                ${hasLeftLine ? `<div class="mw-row-line-left ${leftFilled ? 'filled' : ''}"></div>` : ''}
                ${hasRightLine ? `<div class="mw-row-line-right ${rightFilled ? 'filled' : ''}"></div>` : ''}
                <div class="mw-row-node ${nodeClass}">
                  ${st.num}
                </div>
                <div class="mw-row-node-date ${dateClass}">
                  ${st.date ? st.date : '&nbsp;'}
                </div>
              </div>
            </td>
          `;
        }).join('');

        return `
          <tr>
            <td class="td-col-sl text-center text-muted">${r.SlNo || (i + 1)}</td>
            <td class="td-col-cust">
              <span class="mw-sum-cust-name" title="${r.Name || '-'}">${r.Name || '-'}</span>
            </td>
            <td class="td-col-partner">
              <span class="badge bg-light text-secondary border fw-normal mw-sum-partner-badge" title="${r.BrokerName || 'Direct'}">${r.BrokerName || 'Direct'}</span>
            </td>
            ${stageCellsHtml}
          </tr>
        `;
      }).join('');
    }
  };

  const updateSortIcons = () => {
    const thLogin = document.getElementById('thSumLogin');
    const thAgreement = document.getElementById('thSumAgreement');
    const thPartner = document.getElementById('thSumPartner');
    const sortIconLogin = document.getElementById('sortIconLogin');
    const sortIconAgreement = document.getElementById('sortIconAgreement');
    const sortIconPartner = document.getElementById('sortIconPartner');

    if (thLogin && sortIconLogin) {
      if (sumModalSortCol === 'Login') {
        thLogin.classList.add('sort-active');
        sortIconLogin.className = sumModalSortDir === 'desc' 
          ? 'bi bi-sort-down fs-9 ms-0.5 text-primary' 
          : 'bi bi-sort-up fs-9 ms-0.5 text-primary';
      } else {
        thLogin.classList.remove('sort-active');
        sortIconLogin.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
      }
    }

    if (thAgreement && sortIconAgreement) {
      if (sumModalSortCol === 'Agreement') {
        thAgreement.classList.add('sort-active');
        sortIconAgreement.className = sumModalSortDir === 'desc' 
          ? 'bi bi-sort-down fs-9 ms-0.5 text-primary' 
          : 'bi bi-sort-up fs-9 ms-0.5 text-primary';
      } else {
        thAgreement.classList.remove('sort-active');
        sortIconAgreement.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
      }
    }

    if (thPartner && sortIconPartner) {
      if (sumModalSortCol === 'Partner') {
        thPartner.classList.add('sort-active');
        sortIconPartner.className = sumModalSortDir === 'asc' 
          ? 'bi bi-sort-alpha-down fs-9 ms-0.5 text-primary' 
          : 'bi bi-sort-alpha-up-alt fs-9 ms-0.5 text-primary';
      } else {
        thPartner.classList.remove('sort-active');
        sortIconPartner.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
      }
    }
  };

  renderPopupTable();

  // Attach sort listener to Login column header
  const thLogin = document.getElementById('thSumLogin');
  if (thLogin) {
    thLogin.onclick = () => {
      if (sumModalSortCol === 'Login') {
        sumModalSortDir = sumModalSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sumModalSortCol = 'Login';
        sumModalSortDir = 'desc';
      }
      updateSortIcons();
      const searchInput = document.getElementById('fSumModalSearch');
      renderPopupTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
    };
  }

  // Attach sort listener to Agreement column header
  const thAgreement = document.getElementById('thSumAgreement');
  if (thAgreement) {
    thAgreement.onclick = () => {
      if (sumModalSortCol === 'Agreement') {
        sumModalSortDir = sumModalSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sumModalSortCol = 'Agreement';
        sumModalSortDir = 'desc';
      }
      updateSortIcons();
      const searchInput = document.getElementById('fSumModalSearch');
      renderPopupTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
    };
  }

  // Attach sort listener to Partner column header
  const thPartner = document.getElementById('thSumPartner');
  if (thPartner) {
    thPartner.onclick = () => {
      if (sumModalSortCol === 'Partner') {
        sumModalSortDir = sumModalSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sumModalSortCol = 'Partner';
        sumModalSortDir = 'asc';
      }
      updateSortIcons();
      const searchInput = document.getElementById('fSumModalSearch');
      renderPopupTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
    };
  }

  // SVG Icon Templates for Window Angle Double Arrow Expand / Restore
  const EXPAND_ICON_SVG = `
    <svg id="iconSummaryExpand" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  `;

  const RESTORE_ICON_SVG = `
    <svg id="iconSummaryExpand" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 14 10 14 10 20"></polyline>
      <polyline points="20 10 14 10 14 4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  `;

  // Attach expand / compress toggle listener
  const btnExpand = document.getElementById('btnToggleSummaryExpand');
  if (btnExpand) {
    btnExpand.onclick = () => {
      const dialog = document.querySelector('#workSummaryModal .modal-dialog');
      if (dialog) {
        // Reset manual drag inline styles so CSS classes take effect
        dialog.style.width = '';
        dialog.style.maxWidth = '';
        dialog.style.height = '';
        dialog.style.maxHeight = '';

        dialog.classList.toggle('mw-summary-modal-expanded');
        const isExp = dialog.classList.contains('mw-summary-modal-expanded');
        btnExpand.innerHTML = isExp ? RESTORE_ICON_SVG : EXPAND_ICON_SVG;
        btnExpand.title = isExp ? 'Restore / Normal Size' : 'Maximize / Fullscreen';
      }
    };
  }

  // Attach interactive drag resize handler for Height & Width
  const resizeHandle = document.getElementById('mwModalResizeHandle');
  const modalDialog = document.querySelector('#workSummaryModal .modal-dialog');
  if (resizeHandle && modalDialog) {
    resizeHandle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = modalDialog.offsetWidth;
      const startHeight = modalDialog.offsetHeight;

      modalDialog.style.transition = 'none';
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';

      const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const maxAvailW = window.innerWidth * 0.98;
        const maxAvailH = window.innerHeight * 0.96;

        const newWidth = Math.max(380, Math.min(maxAvailW, startWidth + deltaX * 2));
        const newHeight = Math.max(320, Math.min(maxAvailH, startHeight + deltaY));

        modalDialog.style.width = `${newWidth}px`;
        modalDialog.style.maxWidth = `${newWidth}px`;
        modalDialog.style.height = `${newHeight}px`;
        modalDialog.style.maxHeight = `${newHeight}px`;
        modalDialog.classList.remove('mw-summary-modal-expanded');

        const btnExp = document.getElementById('btnToggleSummaryExpand');
        if (btnExp) {
          btnExp.innerHTML = EXPAND_ICON_SVG;
          btnExp.title = 'Maximize / Fullscreen';
        }
      };

      const onMouseUp = () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        modalDialog.style.transition = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  }

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
