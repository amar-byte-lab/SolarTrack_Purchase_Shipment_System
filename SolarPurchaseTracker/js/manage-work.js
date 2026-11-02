/* =========================================================================
   manage-work.js — Progress & Workflow Stage Management Tracker
   ========================================================================= */

let sortCol = 'SlNo';
let sortDir = 'asc';

let selectedDistricts = [];
let selectedPartners = [];
let selectedStage = 'ALL';
let selectedPaymentFilters = [];
let isCollapseAll = true;
let expandedSlNo = null;

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

  // Collapse Cards toggle listener
  const chkCollapse = document.getElementById('chkCollapseAll');
  if (chkCollapse) {
    chkCollapse.checked = isCollapseAll;
    chkCollapse.addEventListener('change', () => {
      isCollapseAll = chkCollapse.checked;
      expandedSlNo = null;
      renderList();
    });
  }

  // Clear filters
  const btnClear = document.getElementById('btnClearFilters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const fSearch = document.getElementById('fSearch');
      if (fSearch) fSearch.value = '';
      const chkDeactive = document.getElementById('chkShowDeactive');
      if (chkDeactive) chkDeactive.checked = false;

      isCollapseAll = true;
      expandedSlNo = null;
      if (chkCollapse) chkCollapse.checked = true;

      selectedDistricts = [];
      selectedPartners = [];
      selectedStage = 'ALL';
      selectedPaymentFilters = [];
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
  const btnPartnerMain = document.getElementById('btnPartnerMultiselect');
  if (btnPartnerMain) {
    btnPartnerMain.addEventListener('click', () => populateFilterDatalists());
    btnPartnerMain.addEventListener('show.bs.dropdown', () => populateFilterDatalists());
  }
  updateSortHeadersUI();
  renderList();

  // Single Row Selection click listener
  const tableTbody = document.querySelector('#manageWorkTable tbody');
  if (tableTbody) {
    tableTbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || tr.classList.contains('no-print') || tr.classList.contains('mw-empty-state-row')) return;

      // If clicked inside input, select, datepicker, toggle switch, or expand/collapse buttons
      if (e.target.closest('input') || e.target.closest('select') || e.target.closest('.mw-switch') || e.target.closest('.mw-card-toggle-btn') || e.target.closest('.mw-bottom-collapse-td')) {
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

window.toggleCardExpansion = function (slNo, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const sl = Number(slNo);
  if (expandedSlNo === sl) {
    expandedSlNo = null; // collapse
  } else {
    expandedSlNo = sl; // expand this one, collapse others
  }
  renderList();
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
    // Read from DB.getAll('installments') or getWorkRows to ensure partners are always found on mobile
    const dbRows = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installments') || []) : [];
    const allRows = dbRows.length > 0 ? dbRows : (getWorkRows() || []);
    const rawPartners = allRows.map(r => r.BrokerName ? r.BrokerName.trim() : '').filter(Boolean);
    const uniquePartners = [...new Set(rawPartners)].sort();

    const noPartnerHtml = `
      <div class="form-check mb-1">
        <input class="form-check-input partner-chk" type="checkbox" value="(No Partner)" id="chk_nopartner" ${selectedPartners.includes('(No Partner)') ? 'checked' : ''}>
        <label class="form-check-label fs-8 cursor-pointer" for="chk_nopartner">(No Partner)</label>
      </div>`;

    const partnerHtml = uniquePartners.map(p => `
      <div class="form-check mb-1">
        <input class="form-check-input partner-chk" type="checkbox" value="${escapeHtml(p)}" id="chk_partner_${p.replace(/\s+/g, '_')}" ${selectedPartners.includes(p) ? 'checked' : ''}>
        <label class="form-check-label fs-8 cursor-pointer" for="chk_partner_${p.replace(/\s+/g, '_')}">${escapeHtml(p)}</label>
      </div>
    `).join('');

    partnerMenu.innerHTML = noPartnerHtml + partnerHtml;

    partnerMenu.querySelectorAll('.partner-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        selectedPartners = Array.from(partnerMenu.querySelectorAll('.partner-chk:checked')).map(c => c.value);
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

function getCustomerPaymentsMap() {
  const txns = DB.getAll('installment_txns') || [];
  const map = {};
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    if (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === '') {
      const sl = Number(t.SlNo);
      map[sl] = (map[sl] || 0) + (Number(t.Amount) || 0);
    }
  }
  return map;
}

function getRowPaymentCategory(r, payMap) {
  const total = payMap ? (payMap[Number(r.SlNo)] || 0) : 0;
  const price = Number(r.CommittedPrice) || 0;
  const isFullyPaid = (price > 0 && total >= price);
  const isPartiallyPaid = (total > 0 && !isFullyPaid);
  const isUnpaid = (total <= 0);

  let isNetMeterPaid = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
  if (!isNetMeterPaid && r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
    try {
      const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
      const expenses = JSON.parse(jsonStr);
      if (expenses && expenses.net_meter_paid) isNetMeterPaid = true;
    } catch (e) {}
  }

  return { total, price, isFullyPaid, isPartiallyPaid, isUnpaid, isNetMeterPaid };
}

function matchesPaymentFilter(r, payMap, filters) {
  if (!filters || filters.length === 0) return true;

  const cat = getRowPaymentCategory(r, payMap);
  const hasMainFilters = filters.some(f => f === 'FullyPaid' || f === 'PartiallyPaid' || f === 'Unpaid');
  const hasNetMeterFilter = filters.includes('NetMeterPaid');

  let mainMatch = true;
  if (hasMainFilters) {
    mainMatch = (
      (filters.includes('FullyPaid') && cat.isFullyPaid) ||
      (filters.includes('PartiallyPaid') && cat.isPartiallyPaid) ||
      (filters.includes('Unpaid') && cat.isUnpaid)
    );
  }

  let nmMatch = true;
  if (hasNetMeterFilter) {
    nmMatch = cat.isNetMeterPaid;
  }

  return mainMatch && nmMatch;
}

window.togglePaymentBadgeFilter = function(filterKey, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (filterKey === 'ALL') {
    selectedPaymentFilters = [];
  } else {
    const idx = selectedPaymentFilters.indexOf(filterKey);
    if (idx >= 0) {
      selectedPaymentFilters.splice(idx, 1);
    } else {
      selectedPaymentFilters.push(filterKey);
    }
  }
  renderList();
};

function updatePaymentStats() {
  const container = document.getElementById('paymentStatsContainer');
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

  // Filter by workflow stage
  if (selectedStage && selectedStage !== 'ALL') {
    const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === selectedStage);
    if (targetIdx >= 0) {
      activeRows = activeRows.filter(r => getRowHighestStageIdx(r) === targetIdx);
    }
  }

  const payMap = getCustomerPaymentsMap();
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;
  let netMeterPaidCount = 0;

  activeRows.forEach(r => {
    const cat = getRowPaymentCategory(r, payMap);
    if (cat.isFullyPaid) fullyPaidCount++;
    else if (cat.isPartiallyPaid) partiallyPaidCount++;
    else if (cat.isUnpaid) unpaidCount++;

    if (cat.isNetMeterPaid) netMeterPaidCount++;
  });

  const totalCount = activeRows.length;
  const isTotalActive = (selectedPaymentFilters.length === 0);

  const totalBadge = `<button type="button" onclick="window.togglePaymentBadgeFilter('ALL', event)" class="pay-filter-tag pay-tag-all ${isTotalActive ? 'active' : ''}" title="Show all payment statuses">Total (${totalCount})</button>`;
  const fullyPaidBadge = `<button type="button" onclick="window.togglePaymentBadgeFilter('FullyPaid', event)" class="pay-filter-tag pay-tag-full ${selectedPaymentFilters.includes('FullyPaid') ? 'active' : ''}" title="Filter by Fully Paid">Fully Paid (${fullyPaidCount})</button>`;
  const partialBadge = `<button type="button" onclick="window.togglePaymentBadgeFilter('PartiallyPaid', event)" class="pay-filter-tag pay-tag-partial ${selectedPaymentFilters.includes('PartiallyPaid') ? 'active' : ''}" title="Filter by Partially Paid">Partially Paid (${partiallyPaidCount})</button>`;
  const unpaidBadge = `<button type="button" onclick="window.togglePaymentBadgeFilter('Unpaid', event)" class="pay-filter-tag pay-tag-unpaid ${selectedPaymentFilters.includes('Unpaid') ? 'active' : ''}" title="Filter by Unpaid">Unpaid (${unpaidCount})</button>`;
  const netMeterBadge = `<button type="button" onclick="window.togglePaymentBadgeFilter('NetMeterPaid', event)" class="pay-filter-tag pay-tag-netmeter ${selectedPaymentFilters.includes('NetMeterPaid') ? 'active' : ''}" title="Filter by Net Meter Paid">NetMeter Paid (${netMeterPaidCount})</button>`;

  container.innerHTML = `${totalBadge} ${fullyPaidBadge} ${partialBadge} ${unpaidBadge} ${netMeterBadge}`;
}

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

  // Filter by payment status
  if (selectedPaymentFilters.length > 0) {
    const payMap = getCustomerPaymentsMap();
    activeRows = activeRows.filter(r => matchesPaymentFilter(r, payMap, selectedPaymentFilters));
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

  // Filter by payment status
  if (selectedPaymentFilters.length > 0) {
    const payMap = getCustomerPaymentsMap();
    activeRows = activeRows.filter(r => matchesPaymentFilter(r, payMap, selectedPaymentFilters));
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
  if (!document.querySelector('#partnerMultiselectMenu .partner-chk')) populateFilterDatalists();
  updateDistrictStats();
  updateStageStats();
  updatePaymentStats();

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

  // Payment filter
  const payMap = getCustomerPaymentsMap();
  if (selectedPaymentFilters.length > 0) {
    rows = rows.filter(r => matchesPaymentFilter(r, payMap, selectedPaymentFilters));
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
    tbody.innerHTML = `<tr class="mw-empty-state-row"><td colspan="9" class="text-center py-5 text-muted fs-7">No customer workflow records found.</td></tr>`;
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

    const isCardCollapsed = isCollapseAll && (Number(expandedSlNo) !== Number(slNo));

    // Payment info for Customer Cell (Row 1 of Card)
    const payCategory = getRowPaymentCategory(r, payMap);
    const total = payCategory.total;
    const price = payCategory.price;
    const pending = Math.max(0, price - total);
    const isFullyPaid = payCategory.isFullyPaid || (price > 0 && pending <= 0);

    // User requirement: "Instead of paid only write pending value. No need to write customer price."
    let paymentHtml = '';
    if (isFullyPaid) {
      paymentHtml = `
        <span class="mw-pay-status-label badge bg-success-subtle text-success border border-success-subtle font-monospace text-nowrap ms-auto" style="font-size: 0.72rem; padding: 2px 6px;">
          Fully Paid
        </span>
      `;
    } else if (pending > 0) {
      paymentHtml = `
        <span class="mw-pay-status-label text-danger fw-bold font-monospace text-nowrap ms-auto" style="font-size: 0.74rem;">
          Pending: ₹${Math.round(pending).toLocaleString('en-IN')}
        </span>
      `;
    } else {
      paymentHtml = `
        <span class="mw-pay-status-label text-muted font-monospace text-nowrap ms-auto" style="font-size: 0.74rem;">
          Pending: ₹0
        </span>
      `;
    }

    // User requirement: "Customer side re jahara net meter payment heichi tara gote meter icon deiki tara netmeter payment ta show karao only collapse time re re."
    let netMeterHtml = '';
    const isNetMeterActuallyPaid = Boolean(payCategory.isNetMeterPaid || isNetMeterPaid || netMeterPayment);
    if (isCardCollapsed && isNetMeterActuallyPaid) {
      const nmAmt = Number(netMeterPayment) || 0;
      netMeterHtml = `
        <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle d-inline-flex align-items-center gap-1 font-monospace text-nowrap" style="font-size: 0.70rem; padding: 2px 6px;" title="NetMeter Paid${nmAmt > 0 ? `: ₹${Math.round(nmAmt).toLocaleString('en-IN')}` : ''}">
          <i class="bi bi-speedometer2 text-primary"></i> ${nmAmt > 0 ? `₹${Math.round(nmAmt).toLocaleString('en-IN')}` : 'Paid'}
        </span>
      `;
    }

    // Stage icons mapping: (1: Login, 2: Agreement, 3: Dispatched [truck facing left-to-right], 4: Installation, 5: NetMeter [currency], 6: Inspection, 7: Connection [meter], 8: Subsidy [trophy/cup])
    const STAGE_ICONS = {
      1: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
      2: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      3: `<svg width="11" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="14" height="13" rx="1"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>`,
      4: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      5: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="18" y2="3"/><line x1="6" y1="8" x2="18" y2="8"/><path d="M6 3h7a4.5 4.5 0 0 1 0 9H6"/><path d="M10 12l6 9"/></svg>`,
      6: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="m9 11 1.5 1.5 3-3"/></svg>`,
      7: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12A10 10 0 0 0 2 12"/><path d="M6 12a6 6 0 0 1 12 0"/><line x1="12" y1="12" x2="15.5" y2="8.5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
      8: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`
    };

    // Progress bar calculations for collapsed state
    const stagesInfo = [
      { num: 1, name: 'Login', isDone: hasLogin, date: loginDate },
      { num: 2, name: 'Agreement', isDone: hasAgreement, date: agreementDate },
      { num: 3, name: 'Dispatched', isDone: hasDispatched, date: dispatchedDate },
      { num: 4, name: 'Installation', isDone: hasInstallation, date: installationDate },
      { num: 5, name: 'NetMeter', isDone: isNm, date: netMeterDate },
      { num: 6, name: 'Inspection', isDone: hasInspection, date: inspectionDate },
      { num: 7, name: 'Connection', isDone: hasMeterConnected, date: meterConnectedDate },
      { num: 8, name: 'Subsidy', isDone: hasSubsidy, date: subsidyDate }
    ];

    const completedCount = stagesInfo.filter(s => s.isDone).length;

    const segmentsHtml = stagesInfo.map((s, sIdx) => {
      let segColor = s.isDone ? '#10b981' : '#e2e8f0';
      let segTextColor = s.isDone ? '#ffffff' : '#64748b';
      let statusText = s.isDone ? `Completed ${s.date ? `(${s.date})` : ''}` : 'Pending';

      if (s.isDone && sIdx === 0 && highestMarkedIdx === 0 && loginDelay) {
        if (loginDelay.totalDays >= 90) { segColor = '#ef4444'; segTextColor = '#ffffff'; }
        else if (loginDelay.totalDays >= 60) { segColor = '#f59e0b'; segTextColor = '#ffffff'; }
      } else if (s.isDone && sIdx === 1 && isEligibleForAgrmtAlert && agrmtDelay) {
        if (agrmtDelay.totalDays >= 90) { segColor = '#ef4444'; segTextColor = '#ffffff'; }
        else if (agrmtDelay.totalDays >= 60) { segColor = '#f59e0b'; segTextColor = '#ffffff'; }
      }

      const iconSvg = STAGE_ICONS[s.num] || '';

      return `
        <div class="mw-progress-segment" style="flex: 1; height: 20px; background-color: ${segColor}; color: ${segTextColor}; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-size: 0.65rem; font-weight: 700; transition: all 0.2s ease; padding: 0 2px;" title="Stage ${s.num} (${s.name}): ${statusText}">
          <span>${s.num}</span>
          <span class="mw-seg-icon d-inline-flex align-items-center opacity-85" style="line-height: 1;">${iconSvg}</span>
          ${s.isDone ? '<span class="mw-seg-check" style="font-size: 0.70rem; line-height: 1; margin-left: 1px;">✓</span>' : ''}
        </div>
      `;
    }).join('');

    const progressBarHtml = `
      <div class="mw-card-progress-wrap d-flex align-items-center w-100" style="cursor: pointer;" title="Click to expand 1 to 8 stages">
        <div class="d-flex gap-1 flex-grow-1" style="min-width: 0;">
          ${segmentsHtml}
        </div>
      </div>
    `;

    const toggleBtnIcon = isCardCollapsed ? 'bi-chevron-down' : 'bi-chevron-up';
    const toggleBtnTitle = isCardCollapsed ? 'Click to expand 1 to 8 stages' : 'Click to collapse card';

    if (isCardCollapsed) {
      return `
        <tr data-slno="${slNo}" class="mw-card-row mw-card-collapsed ${isDeactive ? 'deactive-row' : ''} ${isAllComplete ? 'stage-complete-all' : ''}">
          <!-- 1. Customer Cell -->
          <td class="td-customer-col" onclick="window.toggleCardExpansion(${slNo}, event)" style="cursor: pointer;">
            <div class="mw-customer-cell">
              <span class="mw-sl-badge">${idx + 1}</span>
              <div class="mw-cust-name-wrap d-inline-flex align-items-center" style="min-width: 0;">
                <span class="mw-customer-name" title="${r.Name || ''}" onclick="window.toggleCardExpansion(${slNo}, event)" style="cursor: pointer;">
                  ${r.Name || 'Unnamed Customer'}
                </span>
                <button type="button" class="btn btn-xs mw-btn-edit-cust p-0 d-inline-flex align-items-center justify-content-center ms-1" onclick="window.openCustomerModal(${slNo}); event.stopPropagation();" title="Edit Customer Record">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
              </div>
              ${netMeterHtml}
              ${paymentHtml}
              <button type="button" class="btn btn-sm btn-link p-0 mw-card-toggle-btn text-muted ms-1" onclick="window.toggleCardExpansion(${slNo}, event)" title="${toggleBtnTitle}">
                <i class="bi ${toggleBtnIcon} fs-7"></i>
              </button>
            </div>
          </td>

          <!-- 2. Progress Bar Cell -->
          <td colspan="8" class="td-progress-col" onclick="window.toggleCardExpansion(${slNo}, event)" title="Click to expand 1 to 8 stages">
            ${progressBarHtml}
          </td>
        </tr>
      `;
    }

    return `
      <tr data-slno="${slNo}" class="mw-card-row mw-card-expanded ${isDeactive ? 'deactive-row' : ''} ${isAllComplete ? 'stage-complete-all' : ''}">
        <!-- 1. Customer Cell -->
        <td class="td-customer-col" onclick="window.toggleCardExpansion(${slNo}, event)" style="cursor: pointer;">
          <div class="mw-customer-cell">
            <span class="mw-sl-badge">${idx + 1}</span>
            <div class="mw-cust-name-wrap d-inline-flex align-items-center" style="min-width: 0;">
              <span class="mw-customer-name" title="${r.Name || ''}" onclick="window.toggleCardExpansion(${slNo}, event)" style="cursor: pointer;">
                ${r.Name || 'Unnamed Customer'}
              </span>
              <button type="button" class="btn btn-xs mw-btn-edit-cust p-0 d-inline-flex align-items-center justify-content-center ms-1" onclick="window.openCustomerModal(${slNo}); event.stopPropagation();" title="Edit Customer Record">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
            </div>
            ${paymentHtml}
            <button type="button" class="btn btn-sm btn-link p-0 mw-card-toggle-btn text-primary ms-1" onclick="window.toggleCardExpansion(${slNo}, event)" title="${toggleBtnTitle}">
              <i class="bi ${toggleBtnIcon} fs-7"></i>
            </button>
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

        <!-- 3. Agreement -->
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

        <!-- 4. Dispatched -->
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

        <!-- 5. Installation -->
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

        <!-- 6. NetMeter -->
        <td>
          <div class="mw-stage-cell mw-netmeter-stage-cell">
            <label class="mw-switch" title="Toggle NetMeter">
              <input type="checkbox" class="mw-stage-toggle" data-stage="NetMeter" ${isNetMeterPaid ? 'checked' : ''} onchange="handleNetMeterToggle(this, ${slNo})">
              <span class="mw-slider"></span>
            </label>
            <div class="mw-stage-input-wrap ${isNetMeterPaid ? '' : 'd-none'}" id="wrap_NetMeter_${slNo}">
              <div class="input-group input-group-sm mw-netmeter-input-group">
                <span class="input-group-text p-1 text-muted" style="font-size: 0.70rem;">₹</span>
                <input type="number" class="form-control mw-netmeter-amount" id="nmAmount_${slNo}" value="${netMeterPayment}" placeholder="Amount" readonly style="background-color: #f8fafc;" onchange="window.saveNetMeterInline(${slNo})">
                <button type="button" class="btn btn-sm btn-outline-primary p-0 d-inline-flex align-items-center justify-content-center" id="btnNmEdit_${slNo}" onclick="window.toggleNetMeterEdit(${slNo})" title="Edit Payment">
                  <i class="bi bi-pencil" style="font-size: 0.70rem;"></i>
                </button>
              </div>
              <input type="date" class="form-control form-control-sm mw-date-input" id="nmDate_${slNo}" value="${netMeterDate}" onchange="window.saveNetMeterInline(${slNo})">
            </div>
          </div>
        </td>

        <!-- 7. Inspection -->
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

        <!-- 8. Connection -->
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

        <!-- 9. Subsidy -->
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

        <!-- 10. Bottom Collapse Row/Bar for Mobile Card -->
        <td class="mw-bottom-collapse-td" onclick="window.toggleCardExpansion(${slNo}, event)" title="Collapse Card">
          <div class="mw-bottom-collapse-inner text-center w-100">
            <button type="button" class="btn btn-xs btn-light border text-secondary rounded-pill px-3 py-0.5 d-inline-flex align-items-center gap-1 shadow-none" style="font-size: 0.70rem;">
              <i class="bi bi-chevron-up"></i> <span>Collapse</span>
            </button>
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

// ══ Edit Customer Modal Integration ═════════════════════════════════════════
function updateModalLoginDelayBadge() {
  const badge = document.getElementById('cLoginDelayBadge');
  const input = document.getElementById('cLoginDate');
  if (!badge || !input) return;
  const val = input.value;
  if (!val) {
    badge.style.display = 'none';
    badge.textContent = '';
    return;
  }
  const info = getDelayInfo(val);
  if (!info) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.textContent = info.text;
  badge.className = 'badge erp-delay-badge font-monospace fs-8 ' + (info.totalDays >= 90 ? 'bg-danger text-white' : (info.totalDays >= 60 ? 'bg-warning text-dark' : 'bg-secondary text-white'));
}

window.openCustomerModal = function(slNo) {
  const modalEl = document.getElementById('customerModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const titleEl = document.getElementById('customerModalTitle');
  if (titleEl) titleEl.textContent = slNo ? 'Edit Customer Record' : 'Add New Customer Record';
  const slNoInput = document.getElementById('cSlNo');
  if (slNoInput) slNoInput.value = slNo || '';

  const distSelect = document.getElementById('cDistrict');
  if (distSelect) {
    distSelect.innerHTML = '<option value="">-- Select District --</option>' + DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  if (slNo) {
    const allRows = DB.getAll('installments') || [];
    const r = allRows.find(x => Number(x.SlNo) === Number(slNo));
    if (r) {
      if (document.getElementById('cName')) document.getElementById('cName').value = r.Name || '';
      if (document.getElementById('cConsumerNo')) document.getElementById('cConsumerNo').value = r.ConsumerNo || '';
      if (document.getElementById('cApplicationNo')) document.getElementById('cApplicationNo').value = r.ApplicationNumber || r.ApplicationNo || '';
      if (document.getElementById('cProposedCapacity')) document.getElementById('cProposedCapacity').value = r.ProposedCapacity || r.Capacity || '';
      if (document.getElementById('cCircle')) document.getElementById('cCircle').value = r.CircleName || r.Circle || '';
      if (document.getElementById('cDivision')) document.getElementById('cDivision').value = r.DivisionName || r.Division || '';
      if (document.getElementById('cSubDivision')) document.getElementById('cSubDivision').value = r.SubDivision || r.Subdivision || '';
      if (document.getElementById('cMobile')) document.getElementById('cMobile').value = r.MobileNumber || '';
      if (document.getElementById('cDistrict')) document.getElementById('cDistrict').value = r.District || '';
      if (document.getElementById('cAddress')) document.getElementById('cAddress').value = r.Address || '';
      if (document.getElementById('cBrand')) document.getElementById('cBrand').value = r.CommittedBrand || '';
      if (document.getElementById('cPrice')) document.getElementById('cPrice').value = r.CommittedPrice || '';
      if (document.getElementById('cVendorPrice')) document.getElementById('cVendorPrice').value = r.VendorPrice || '';
      if (document.getElementById('cLoginDate')) {
        document.getElementById('cLoginDate').value = r.LoginDate ? new Date(r.LoginDate).toISOString().slice(0, 10) : '';
      }
      if (document.getElementById('cBrokerName')) document.getElementById('cBrokerName').value = r.BrokerName || '';
      if (document.getElementById('cCommission')) document.getElementById('cCommission').value = r.Commission || '';

      let expenses = null;
      if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
        try {
          expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]);
        } catch(e) { console.error(e); }
      }
      if (document.getElementById('cMaterialCost')) document.getElementById('cMaterialCost').value = (expenses && expenses.material) || 0;
      if (document.getElementById('cPartnerPrice')) document.getElementById('cPartnerPrice').value = (expenses && expenses.partner) || 0;
      if (document.getElementById('cInstallationCost')) document.getElementById('cInstallationCost').value = (expenses && expenses.install) || 0;
      if (document.getElementById('cTransportCost')) document.getElementById('cTransportCost').value = (expenses && expenses.transport) || 0;
      const defaultGstVal = (expenses && expenses.gst_pct !== undefined && expenses.gst_pct !== null && expenses.gst_pct !== '') ? expenses.gst_pct : ((typeof Utils !== 'undefined' && Utils.getDefaultGST) ? Utils.getDefaultGST(18) : 18);
      if (document.getElementById('cGSTPercentage')) document.getElementById('cGSTPercentage').value = defaultGstVal;
      if (document.getElementById('cOtherCost')) document.getElementById('cOtherCost').value = (expenses && expenses.other) || 0;
      if (document.getElementById('cNetMeterPayment')) {
        const netMeterVal = (r.NetMeterPayment != null && r.NetMeterPayment !== '') ? r.NetMeterPayment : ((expenses && expenses.net_meter_payment != null && expenses.net_meter_payment !== '') ? expenses.net_meter_payment : '');
        document.getElementById('cNetMeterPayment').value = netMeterVal;
      }
      if (document.getElementById('cNetMeterPaid')) {
        const isPaid = (r.NetMeterPaid != null) ? !!r.NetMeterPaid : !!(expenses && expenses.net_meter_paid);
        document.getElementById('cNetMeterPaid').checked = isPaid;
      }
    }
  }

  updateModalLoginDelayBadge();

  const updateModalCalculations = () => {
    const custPriceVal = Number(document.getElementById('cPrice')?.value) || 0;
    const gstPct = Number(document.getElementById('cGSTPercentage')?.value) || 0;
    const gstVal = custPriceVal * (gstPct / 100);

    const gstLabel = document.getElementById('lblGSTAmount');
    if (gstLabel) gstLabel.textContent = '₹' + gstVal.toFixed(2);

    const mat = Number(document.getElementById('cMaterialCost')?.value) || 0;
    const inst = Number(document.getElementById('cInstallationCost')?.value) || 0;
    const trans = Number(document.getElementById('cTransportCost')?.value) || 0;
    const oth = Number(document.getElementById('cOtherCost')?.value) || 0;
    const totalExpense = mat + inst + trans + gstVal + oth;

    const totalField = document.getElementById('cVendorPrice');
    if (totalField) totalField.value = totalExpense.toFixed(2);

    const partnerPrice = Number(document.getElementById('cPartnerPrice')?.value) || 0;
    const comm = Number(document.getElementById('cCommission')?.value) || 0;
    const profitVal = partnerPrice - comm - totalExpense;

    const profitField = document.getElementById('cProfit');
    if (profitField) {
      profitField.value = profitVal.toFixed(2);
      profitField.style.color = (profitVal >= 0) ? '#198754' : '#dc3545';
    }
  };

  ['cPrice', 'cCommission', 'cPartnerPrice', 'cMaterialCost', 'cTransportCost', 'cOtherCost', 'cInstallationCost', 'cGSTPercentage'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.oninput = updateModalCalculations;
    }
  });

  const loginDateInput = document.getElementById('cLoginDate');
  if (loginDateInput) {
    loginDateInput.oninput = updateModalLoginDelayBadge;
    loginDateInput.onchange = updateModalLoginDelayBadge;
  }

  updateModalCalculations();
  modal.show();
};

async function saveCustomerModalRecord() {
  const slNoVal = document.getElementById('cSlNo')?.value;
  const name = document.getElementById('cName')?.value.trim();
  if (!name) {
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('Customer Name is required.', 'danger');
    document.getElementById('cName')?.focus();
    return;
  }

  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  let creatorSuffix = '';
  if (slNoVal) {
    const slNo = Number(slNoVal);
    const existing = (DB.getAll('installments') || []).find(x => Number(x.SlNo) === slNo);
    if (existing && (existing.BrokerNumber || '').includes('|creator:')) {
      creatorSuffix = '|creator:' + existing.BrokerNumber.split('|creator:')[1].split('|')[0];
    }
  }
  if (!creatorSuffix && currentUser) {
    creatorSuffix = '|creator:' + currentUser.userid;
  }

  const custPriceVal = Number(document.getElementById('cPrice')?.value) || 0;
  const gstPctVal = Number(document.getElementById('cGSTPercentage')?.value) || 0;
  const calculatedGSTAmount = custPriceVal * (gstPctVal / 100);

  const existingRow = slNoVal ? (DB.getAll('installments') || []).find(x => Number(x.SlNo) === Number(slNoVal)) : null;

  const expenses = {
    material: Number(document.getElementById('cMaterialCost')?.value) || 0,
    partner: Number(document.getElementById('cPartnerPrice')?.value) || 0,
    install: Number(document.getElementById('cInstallationCost')?.value) || 0,
    transport: Number(document.getElementById('cTransportCost')?.value) || 0,
    gst_pct: gstPctVal,
    gst: calculatedGSTAmount,
    other: Number(document.getElementById('cOtherCost')?.value) || 0,
    net_meter_payment: document.getElementById('cNetMeterPayment') ? (Number(document.getElementById('cNetMeterPayment').value) || 0) : (existingRow ? (existingRow.NetMeterPayment || 0) : 0),
    net_meter_paid: document.getElementById('cNetMeterPaid') ? document.getElementById('cNetMeterPaid').checked : (existingRow ? !!existingRow.NetMeterPaid : false)
  };

  const calculatedVendorPrice = expenses.material + expenses.install + expenses.transport + expenses.gst + expenses.other;
  let phoneClean = existingRow && existingRow.BrokerNumber ? existingRow.BrokerNumber.split('|')[0] : '';

  const workMeta = {
    SubDivision: document.getElementById('cSubDivision') ? document.getElementById('cSubDivision').value.trim() : (existingRow ? (existingRow.SubDivision || '') : ''),
    DivisionName: document.getElementById('cDivision') ? document.getElementById('cDivision').value.trim() : (existingRow ? (existingRow.DivisionName || '') : ''),
    CircleName: document.getElementById('cCircle') ? document.getElementById('cCircle').value.trim() : (existingRow ? (existingRow.CircleName || '') : ''),
    ApplicationNumber: document.getElementById('cApplicationNo') ? document.getElementById('cApplicationNo').value.trim() : (existingRow ? (existingRow.ApplicationNumber || '') : ''),
    ProposedCapacity: document.getElementById('cProposedCapacity') ? document.getElementById('cProposedCapacity').value.trim() : (existingRow ? (existingRow.ProposedCapacity || '') : '')
  };

  if (existingRow) {
    if (existingRow.ProductSpecs) workMeta.ProductSpecs = existingRow.ProductSpecs;
    if (existingRow.SpecsUpdatedBy) workMeta.SpecsUpdatedBy = existingRow.SpecsUpdatedBy;
    if (existingRow.SpecsUpdatedAt) workMeta.SpecsUpdatedAt = existingRow.SpecsUpdatedAt;
    ['AgreementDate', 'MaterialDispatchedDate', 'NetMeterDate', 'InspectionDate', 'MeterConnectedDate', 'SubsidyDate'].forEach(k => {
      if (existingRow[k]) workMeta[k] = existingRow[k];
    });
  }

  const baseForMeta = existingRow && existingRow.BrokerNumber ? existingRow.BrokerNumber : (phoneClean + creatorSuffix + '|expenses:' + JSON.stringify(expenses));
  const formattedBrokerNumber = formatBrokerNumberWithWorkMeta(baseForMeta, workMeta);

  const rowData = {
    Name: name,
    ConsumerNo: document.getElementById('cConsumerNo') ? document.getElementById('cConsumerNo').value.trim() : '',
    ApplicationNumber: workMeta.ApplicationNumber,
    ProposedCapacity: workMeta.ProposedCapacity,
    CircleName: workMeta.CircleName,
    DivisionName: workMeta.DivisionName,
    SubDivision: workMeta.SubDivision,
    MobileNumber: document.getElementById('cMobile') ? document.getElementById('cMobile').value.trim() : '',
    District: document.getElementById('cDistrict') ? document.getElementById('cDistrict').value : '',
    Address: document.getElementById('cAddress') ? document.getElementById('cAddress').value.trim() : (existingRow ? (existingRow.Address || '') : ''),
    CommittedBrand: document.getElementById('cBrand') ? document.getElementById('cBrand').value.trim() : (existingRow ? (existingRow.CommittedBrand || '') : ''),
    CommittedPrice: Number(document.getElementById('cPrice')?.value) || 0,
    VendorPrice: calculatedVendorPrice,
    LoginDate: document.getElementById('cLoginDate')?.value || null,
    BrokerName: document.getElementById('cBrokerName') ? document.getElementById('cBrokerName').value.trim() : (existingRow ? (existingRow.BrokerName || '') : ''),
    BrokerNumber: formattedBrokerNumber,
    Commission: Number(document.getElementById('cCommission')?.value) || 0,
    NetMeterPayment: expenses.net_meter_payment,
    NetMeterPaid: expenses.net_meter_paid
  };

  if (typeof UI !== 'undefined' && UI.showLoading) UI.showLoading(true);
  try {
    if (slNoVal) {
      const slNo = Number(slNoVal);
      await DB.update('installments', r => Number(r.SlNo) === slNo, rowData);
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('Customer record updated.', 'success');
    }
    const modalEl = document.getElementById('customerModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    renderList();
  } catch (err) {
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('Error saving customer: ' + err.message, 'danger');
  } finally {
    if (typeof UI !== 'undefined' && UI.showLoading) UI.showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnSave = document.getElementById('btnSaveCustomer');
  if (btnSave) {
    btnSave.onclick = saveCustomerModalRecord;
  }
});

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

  if (expensesJson && (workUpdates.NetMeterPayment !== undefined || workUpdates.NetMeterPaid !== undefined)) {
    try {
      const exp = JSON.parse(expensesJson);
      if (workUpdates.NetMeterPayment !== undefined) {
        exp.net_meter_payment = workUpdates.NetMeterPayment;
      }
      if (workUpdates.NetMeterPaid !== undefined) {
        exp.net_meter_paid = workUpdates.NetMeterPaid;
      }
      expensesJson = JSON.stringify(exp);
    } catch (e) {}
  }

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

window.toggleNetMeterEdit = function (slNo) {
  const input = document.getElementById(`nmPayInput_${slNo}`);
  const btnEdit = document.getElementById(`btnNmEdit_${slNo}`);
  const btnSave = document.getElementById(`btnNmSave_${slNo}`);
  const btnCancel = document.getElementById(`btnNmCancel_${slNo}`);
  if (!input) return;

  const group = input.closest('.mw-netmeter-pay-group');
  if (group) group.classList.add('is-editing');

  input.dataset.origVal = input.value;
  input.disabled = false;
  input.focus();
  input.select();

  if (btnEdit) btnEdit.classList.add('d-none');
  if (btnSave) {
    btnSave.classList.remove('d-none');
    btnSave.classList.add('d-inline-flex');
  }
  if (btnCancel) {
    btnCancel.classList.remove('d-none');
    btnCancel.classList.add('d-inline-flex');
  }
};

window.cancelNetMeterEdit = function (slNo) {
  const input = document.getElementById(`nmPayInput_${slNo}`);
  const btnEdit = document.getElementById(`btnNmEdit_${slNo}`);
  const btnSave = document.getElementById(`btnNmSave_${slNo}`);
  const btnCancel = document.getElementById(`btnNmCancel_${slNo}`);
  if (!input) return;

  const group = input.closest('.mw-netmeter-pay-group');
  if (group) group.classList.remove('is-editing');

  if (input.dataset.origVal !== undefined) {
    input.value = input.dataset.origVal;
  }
  input.disabled = true;

  if (btnSave) {
    btnSave.classList.add('d-none');
    btnSave.classList.remove('d-inline-flex');
  }
  if (btnCancel) {
    btnCancel.classList.add('d-none');
    btnCancel.classList.remove('d-inline-flex');
  }
  if (btnEdit) {
    btnEdit.classList.remove('d-none');
  }
};

window.saveNetMeterPayment = async function (slNo) {
  const input = document.getElementById(`nmPayInput_${slNo}`);
  const btnEdit = document.getElementById(`btnNmEdit_${slNo}`);
  const btnSave = document.getElementById(`btnNmSave_${slNo}`);
  const btnCancel = document.getElementById(`btnNmCancel_${slNo}`);
  if (!input) return;

  const group = input.closest('.mw-netmeter-pay-group');
  if (group) group.classList.remove('is-editing');

  const paymentVal = input.value.trim();
  const numVal = paymentVal ? Number(paymentVal) : 0;

  const existing = (DB.getAll('installments') || []).find(r => Number(r.SlNo) === Number(slNo));
  const custName = existing?.Name || `Customer #${slNo}`;
  const consumerNo = existing?.ConsumerNo ? ` (CN: ${existing.ConsumerNo})` : '';
  const formattedAmt = `₹${numVal.toLocaleString('en-IN')}`;

  const confirmed = await UI.confirmDialog(
    `Are you sure you want to save NetMeter payment of ${formattedAmt} for "${custName}"${consumerNo}?`,
    'Confirm NetMeter Payment',
    'Yes, Save Payment',
    'btn-primary'
  );

  if (!confirmed) {
    window.cancelNetMeterEdit(slNo);
    return;
  }

  try {
    const patch = { NetMeterPayment: numVal };
    await saveWorkProgress(slNo, patch, { NetMeterPayment: numVal });
    input.dataset.origVal = input.value;
    input.disabled = true;

    if (btnSave) {
      btnSave.classList.add('d-none');
      btnSave.classList.remove('d-inline-flex');
    }
    if (btnCancel) {
      btnCancel.classList.add('d-none');
      btnCancel.classList.remove('d-inline-flex');
    }
    if (btnEdit) {
      btnEdit.classList.remove('d-none');
    }
    UI.toast(`NetMeter payment updated to ${formattedAmt}`, 'success');
    renderList();
  } catch (err) {
    UI.toast('Error saving NetMeter payment: ' + err.message, 'danger');
  }
};

// ══ Summary Modal ═══════════════════════════════════════════════════════════
window.openWorkSummaryModal = function () {
  const allWorkRows = getWorkRows();
  const showDeactive = document.getElementById('chkShowDeactive')?.checked || false;
  let baseRows = allWorkRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');
  const payMap = getCustomerPaymentsMap();

  // Helper: Parse brand for module & inverter
  function parseCustomerBrandForSpecs(committedBrand) {
    if (!committedBrand) return { moduleMake: '', inverterMake: '' };
    const str = String(committedBrand).trim();
    let moduleMake = '';
    let inverterMake = '';
    if (str.includes('M:') || str.includes('Inv:')) {
      const mMatch = str.match(/M:\s*([^|]+)/i);
      const invMatch = str.match(/Inv:\s*([^|]+)/i);
      if (mMatch) moduleMake = mMatch[1].trim();
      if (invMatch) inverterMake = invMatch[1].trim();
    } else {
      moduleMake = str;
      inverterMake = str;
    }
    return {
      moduleMake: moduleMake || '',
      inverterMake: inverterMake || ''
    };
  }

  function getCustomerModuleMake(r) {
    let specs = {};
    if (r.ProductSpecs) {
      try { specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs; } catch(e) {}
    }
    if (!specs || Object.keys(specs).length === 0) {
      if (r.BrokerNumber && r.BrokerNumber.includes('|work:')) {
        try {
          const workData = JSON.parse(r.BrokerNumber.split('|work:')[1].split('|')[0]);
          if (workData.ProductSpecs) {
            specs = typeof workData.ProductSpecs === 'string' ? JSON.parse(workData.ProductSpecs) : workData.ProductSpecs;
          }
        } catch(e) {}
      }
    }
    const brandInfo = parseCustomerBrandForSpecs(r.CommittedBrand);
    return (specs?.PvModule?.Make || brandInfo.moduleMake || r.CommittedBrand || '-').toUpperCase();
  }

  function getCustomerInverterMake(r) {
    let specs = {};
    if (r.ProductSpecs) {
      try { specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs; } catch(e) {}
    }
    if (!specs || Object.keys(specs).length === 0) {
      if (r.BrokerNumber && r.BrokerNumber.includes('|work:')) {
        try {
          const workData = JSON.parse(r.BrokerNumber.split('|work:')[1].split('|')[0]);
          if (workData.ProductSpecs) {
            specs = typeof workData.ProductSpecs === 'string' ? JSON.parse(workData.ProductSpecs) : workData.ProductSpecs;
          }
        } catch(e) {}
      }
    }
    const brandInfo = parseCustomerBrandForSpecs(r.CommittedBrand);
    return (specs?.GridTiedInverter?.Make || brandInfo.inverterMake || '-').toUpperCase();
  }

  // Status can be Login, Agreement or Subsidy
  function getCustomerWorkStatus(r) {
    if (r.CommissioningDate || r.SubsidyDate) return 'Subsidy';
    if (r.AgreementDate) return 'Agreement';
    return 'Login';
  }

  // Financials and Set Cost formula: Set Cost = Material + Install + Meter + Delivery + Others
  function getCustomerSummaryFinancials(r) {
    let expenses = {};
    if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try {
        expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]) || {};
      } catch (e) {}
    }

    const paid = payMap ? (payMap[Number(r.SlNo)] || 0) : 0;
    const turnover = Number(r.CommittedPrice) || (expenses && Number(expenses.partner)) || 0;
    const unpaid = Math.max(0, turnover - paid);

    const material = (expenses.material !== undefined && expenses.material !== '')
      ? Number(expenses.material)
      : ((expenses.setCost !== undefined && expenses.setCost !== '') ? Number(expenses.setCost) : 0);

    const install = Number(expenses.install) || 0;
    const meter = (r.NetMeterPayment != null && r.NetMeterPayment !== '')
      ? Number(r.NetMeterPayment)
      : (Number(expenses.net_meter_payment) || 0);
    const delivery = (expenses.delivery !== undefined && expenses.delivery !== '')
      ? Number(expenses.delivery)
      : (Number(expenses.transport) || 0);
    const others = Number(expenses.other) || 0;

    // Set Cost = Material + Install + Meter + Delivery + Others
    const setCost = material + install + meter + delivery + others;
    // Profit = Turnover - Set Cost
    const profit = turnover - setCost;

    let payCategory = 'Unpaid';
    if (turnover > 0 && paid >= turnover) {
      payCategory = 'Fully Paid';
    } else if (paid > 0) {
      payCategory = 'Partial Paid';
    } else {
      payCategory = 'Unpaid';
    }

    let comment = r.Comment || expenses.otherComment || '';
    if (!comment) {
      const remarks = (DB.getAll('installment_remarks') || []).filter(n => Number(n.SlNo) === Number(r.SlNo) && (n.Type === 'Customer' || !n.Type));
      if (remarks.length > 0) {
        remarks.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
        comment = remarks[0].Remark || '';
      }
    }

    return {
      expenses,
      paid,
      turnover,
      unpaid,
      material,
      install,
      meter,
      delivery,
      others,
      setCost,
      profit,
      payCategory,
      comment
    };
  }

  function fmtCurr(n) {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Summary Columns Definition (Material added before Set Cost)
  const SUMMARY_COLUMNS = [
    { key: 'customer', label: 'Customer: Status' },
    { key: 'pvmodule', label: 'PVModule Make' },
    { key: 'inverter', label: 'Inverter Make' },
    { key: 'payment', label: 'Payment (Paid)' },
    { key: 'install', label: 'Install' },
    { key: 'meter', label: 'Meter' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'others', label: 'Others' },
    { key: 'comment', label: 'Comment' },
    { key: 'material', label: 'Material' },
    { key: 'setcost', label: 'Set Cost' },
    { key: 'profit', label: 'Profit' }
  ];

  // Default active columns: Customer: Status, Payment (Paid), Install, Meter
  const DEFAULT_ACTIVE_COLS = ['customer', 'payment', 'install', 'meter'];
  const activeCols = new Set(DEFAULT_ACTIVE_COLS);

  // Filters State (Identical to Manage Work filters)
  let modalSelectedPartners = [...selectedPartners];
  let modalSelectedDistricts = [...selectedDistricts];
  let modalSelectedStatus = 'ALL';
  let modalSelectedPaymentFilters = [...selectedPaymentFilters];
  let modalSearchText = (document.getElementById('fSearch')?.value || '').toLowerCase().trim();

  // Excluded customers set (persisted during modal session)
  const excludedSlNos = new Set();
  // Currently checked row SlNos for exclude action
  const selectedSlNos = new Set();

  // 1. Populate Partner Filter Dropdown with Multiselect Checkboxes
  function populateModalPartners() {
    const partnerMenu = document.getElementById('sumPartnerMultiselectMenu');
    if (!partnerMenu) return;

    const rawPartners = baseRows.map(r => r.BrokerName ? r.BrokerName.trim() : '').filter(Boolean);
    const uniquePartners = [...new Set(rawPartners)].sort();

    partnerMenu.innerHTML = [
      `<div class="form-check mb-1">
         <input class="form-check-input sum-partner-chk" type="checkbox" value="(No Partner)" id="chk_sum_nopartner" ${modalSelectedPartners.includes('(No Partner)') ? 'checked' : ''}>
         <label class="form-check-label fs-8 cursor-pointer" for="chk_sum_nopartner">(No Partner)</label>
       </div>`
    ].concat(
      uniquePartners.map(p => `
        <div class="form-check mb-1">
          <input class="form-check-input sum-partner-chk" type="checkbox" value="${escapeHtml(p)}" id="chk_sum_partner_${p.replace(/\s+/g, '_')}" ${modalSelectedPartners.includes(p) ? 'checked' : ''}>
          <label class="form-check-label fs-8 cursor-pointer" for="chk_sum_partner_${p.replace(/\s+/g, '_')}">${escapeHtml(p)}</label>
        </div>
      `)
    ).join('');

    partnerMenu.querySelectorAll('.sum-partner-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        modalSelectedPartners = Array.from(partnerMenu.querySelectorAll('.sum-partner-chk:checked')).map(c => c.value);
        updateModalPartnerButton();
        updateAllModalFilterStats();
        renderSummaryTable();
      });
    });

    updateModalPartnerButton();
  }

  function updateModalPartnerButton() {
    const btn = document.getElementById('btnSumPartnerMultiselect');
    if (!btn) return;
    if (modalSelectedPartners.length === 0) {
      btn.textContent = 'All Partners';
    } else if (modalSelectedPartners.length === 1) {
      btn.textContent = modalSelectedPartners[0];
    } else {
      btn.textContent = `${modalSelectedPartners.length} Partners`;
    }
  }

  // 2. Update Area / District Badges Strip
  function updateModalDistrictStats() {
    const container = document.getElementById('sumDistrictStatsContainer');
    if (!container) return;

    let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

    if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
    if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
    if (modalSelectedStatus !== 'ALL') rows = rows.filter(r => getCustomerWorkStatus(r) === modalSelectedStatus);
    if (modalSelectedPaymentFilters.length > 0) rows = rows.filter(r => matchesPayment(r, modalSelectedPaymentFilters));

    const totalCount = rows.length;
    const counts = {};
    rows.forEach(r => {
      const dist = (r.District && r.District.trim()) ? r.District.trim() : 'No District';
      counts[dist] = (counts[dist] || 0) + 1;
    });

    const sortedDistricts = Object.keys(counts)
      .filter(k => counts[k] >= 1)
      .sort((a, b) => {
        if (a === 'No District') return 1;
        if (b === 'No District') return -1;
        return a.localeCompare(b);
      });

    const isTotalActive = modalSelectedDistricts.length === 0;
    const totalBadge = `<button type="button" class="erp-tag ${isTotalActive ? 'active' : ''}" data-dist="ALL" title="Show all districts">Total: ${totalCount}</button>`;

    const districtBadges = sortedDistricts.map(dist => {
      const targetDist = dist === 'No District' ? '(No District)' : dist;
      const isSelected = modalSelectedDistricts.includes(targetDist);
      return `<button type="button" class="erp-tag ${isSelected ? 'active' : ''}" data-dist="${escapeHtml(targetDist)}" title="Filter by ${escapeHtml(dist)}">${escapeHtml(dist)} (${counts[dist] || 0})</button>`;
    }).join(' ');

    container.innerHTML = totalBadge + ' ' + districtBadges;

    container.querySelectorAll('.erp-tag').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const distVal = btn.getAttribute('data-dist');
        if (distVal === 'ALL') {
          modalSelectedDistricts = [];
        } else {
          const idx = modalSelectedDistricts.indexOf(distVal);
          if (idx >= 0) modalSelectedDistricts.splice(idx, 1);
          else modalSelectedDistricts.push(distVal);
        }
        updateAllModalFilterStats();
        renderSummaryTable();
      };
    });
  }

  // 3. Update Status / Stage Badges Strip (Login, Agreement, Subsidy)
  function updateModalStageStats() {
    const container = document.getElementById('sumStageStatsContainer');
    if (!container) return;

    let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

    if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
    if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
    if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));
    if (modalSelectedPaymentFilters.length > 0) rows = rows.filter(r => matchesPayment(r, modalSelectedPaymentFilters));

    let loginCount = 0;
    let agrmtCount = 0;
    let subsidyCount = 0;

    rows.forEach(r => {
      const st = getCustomerWorkStatus(r);
      if (st === 'Subsidy') subsidyCount++;
      else if (st === 'Agreement') agrmtCount++;
      else loginCount++;
    });

    const isTotalActive = modalSelectedStatus === 'ALL';
    const totalCount = rows.length;

    container.innerHTML = `
      <button type="button" class="stage-filter-tag ${isTotalActive ? 'active' : ''}" data-status="ALL" title="Show all stages">Total (${totalCount})</button>
      <button type="button" class="stage-filter-tag stage-tag-1 ${modalSelectedStatus === 'Login' ? 'active' : ''}" data-status="Login" title="Filter by Login stage">Login (${loginCount})</button>
      <button type="button" class="stage-filter-tag stage-tag-2 ${modalSelectedStatus === 'Agreement' ? 'active' : ''}" data-status="Agreement" title="Filter by Agreement stage">Agreement (${agrmtCount})</button>
      <button type="button" class="stage-filter-tag stage-tag-8 ${modalSelectedStatus === 'Subsidy' ? 'active' : ''}" data-status="Subsidy" title="Filter by Subsidy stage">Subsidy (${subsidyCount})</button>
    `;

    container.querySelectorAll('.stage-filter-tag').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const stVal = btn.getAttribute('data-status');
        if (stVal === 'ALL' || modalSelectedStatus === stVal) {
          modalSelectedStatus = 'ALL';
        } else {
          modalSelectedStatus = stVal;
        }
        updateAllModalFilterStats();
        renderSummaryTable();
      };
    });
  }

  // 4. Update Payment Badges Strip (Unpaid, Partially Paid, Fully Paid)
  function updateModalPaymentStats() {
    const container = document.getElementById('sumPaymentStatsContainer');
    if (!container) return;

    let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

    if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
    if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
    if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));
    if (modalSelectedStatus !== 'ALL') rows = rows.filter(r => getCustomerWorkStatus(r) === modalSelectedStatus);

    let unpaidCount = 0;
    let partialCount = 0;
    let fullCount = 0;

    rows.forEach(r => {
      const fin = getCustomerSummaryFinancials(r);
      if (fin.payCategory === 'Fully Paid') fullCount++;
      else if (fin.payCategory === 'Partial Paid') partialCount++;
      else unpaidCount++;
    });

    const isTotalActive = modalSelectedPaymentFilters.length === 0;
    const totalCount = rows.length;

    container.innerHTML = `
      <button type="button" class="pay-filter-tag pay-tag-all ${isTotalActive ? 'active' : ''}" data-pay="ALL" title="Show all payment categories">Total (${totalCount})</button>
      <button type="button" class="pay-filter-tag pay-tag-unpaid ${modalSelectedPaymentFilters.includes('Unpaid') ? 'active' : ''}" data-pay="Unpaid" title="Filter by Unpaid">Unpaid (${unpaidCount})</button>
      <button type="button" class="pay-filter-tag pay-tag-partial ${modalSelectedPaymentFilters.includes('PartiallyPaid') ? 'active' : ''}" data-pay="PartiallyPaid" title="Filter by Partial Paid">Partial Paid (${partialCount})</button>
      <button type="button" class="pay-filter-tag pay-tag-full ${modalSelectedPaymentFilters.includes('FullyPaid') ? 'active' : ''}" data-pay="FullyPaid" title="Filter by Fully Paid">Fully Paid (${fullCount})</button>
    `;

    container.querySelectorAll('.pay-filter-tag').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const payVal = btn.getAttribute('data-pay');
        if (payVal === 'ALL') {
          modalSelectedPaymentFilters = [];
        } else {
          const idx = modalSelectedPaymentFilters.indexOf(payVal);
          if (idx >= 0) modalSelectedPaymentFilters.splice(idx, 1);
          else modalSelectedPaymentFilters.push(payVal);
        }
        updateAllModalFilterStats();
        renderSummaryTable();
      };
    });
  }

  function updateAllModalFilterStats() {
    updateModalDistrictStats();
    updateModalStageStats();
    updateModalPaymentStats();
  }

  // Filter Matcher Helpers
  function matchesSearch(r, text) {
    if (!text) return true;
    return (
      String(r.Name || '').toLowerCase().includes(text) ||
      String(r.ConsumerNo || '').toLowerCase().includes(text) ||
      String(r.MobileNumber || '').toLowerCase().includes(text) ||
      String(r.BrokerName || '').toLowerCase().includes(text) ||
      String(r.District || '').toLowerCase().includes(text) ||
      String(r.CommittedBrand || '').toLowerCase().includes(text)
    );
  }

  function matchesPartner(r, partners) {
    if (!partners || partners.length === 0) return true;
    const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
    const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
    return partners.includes(partnerName);
  }

  function matchesDistrict(r, districts) {
    if (!districts || districts.length === 0) return true;
    const dist = r.District ? r.District.trim() : '(No District)';
    const distName = dist === '' ? '(No District)' : dist;
    return districts.includes(distName);
  }

  function matchesPayment(r, payFilters) {
    if (!payFilters || payFilters.length === 0) return true;
    const fin = getCustomerSummaryFinancials(r);
    const cat = fin.payCategory;
    return (
      (payFilters.includes('Unpaid') && cat === 'Unpaid') ||
      (payFilters.includes('PartiallyPaid') && cat === 'Partial Paid') ||
      (payFilters.includes('FullyPaid') && cat === 'Fully Paid')
    );
  }

  // Search Input Handler
  const searchInput = document.getElementById('fSumModalSearch');
  if (searchInput) {
    searchInput.value = modalSearchText;
    searchInput.oninput = (e) => {
      modalSearchText = e.target.value.toLowerCase().trim();
      updateAllModalFilterStats();
      renderSummaryTable();
    };
  }

  // Clear Filters Button
  const btnClear = document.getElementById('btnSumClearFilters');
  if (btnClear) {
    btnClear.onclick = () => {
      modalSearchText = '';
      if (searchInput) searchInput.value = '';
      modalSelectedPartners = [];
      document.querySelectorAll('.sum-partner-chk').forEach(c => c.checked = false);
      updateModalPartnerButton();
      modalSelectedDistricts = [];
      modalSelectedStatus = 'ALL';
      modalSelectedPaymentFilters = [];
      updateAllModalFilterStats();
      renderSummaryTable();
    };
  }

  // Populate Select Columns Checklist Dropdown
  const colsContainer = document.getElementById('summaryColsChecklist');
  if (colsContainer) {
    colsContainer.innerHTML = SUMMARY_COLUMNS.map(col => `
      <div class="form-check form-check-sm mb-1 d-flex align-items-center gap-2">
        <input class="form-check-input mt-0 col-toggle-chk" type="checkbox" id="chkCol_${col.key}" data-col="${col.key}" ${activeCols.has(col.key) ? 'checked' : ''}>
        <label class="form-check-label fs-8 text-dark cursor-pointer user-select-none" for="chkCol_${col.key}">${col.label}</label>
      </div>
    `).join('');

    colsContainer.querySelectorAll('.col-toggle-chk').forEach(chk => {
      chk.onchange = () => {
        const key = chk.getAttribute('data-col');
        if (chk.checked) activeCols.add(key);
        else activeCols.delete(key);
        updateColumnVisibilityUI();
      };
    });
  }

  const btnSelectAllCols = document.getElementById('btnSelectAllCols');
  if (btnSelectAllCols) {
    btnSelectAllCols.onclick = () => {
      SUMMARY_COLUMNS.forEach(c => activeCols.add(c.key));
      colsContainer?.querySelectorAll('.col-toggle-chk').forEach(chk => { chk.checked = true; });
      updateColumnVisibilityUI();
    };
  }

  const btnResetDefaultCols = document.getElementById('btnResetDefaultCols');
  if (btnResetDefaultCols) {
    btnResetDefaultCols.onclick = () => {
      activeCols.clear();
      DEFAULT_ACTIVE_COLS.forEach(c => activeCols.add(c));
      colsContainer?.querySelectorAll('.col-toggle-chk').forEach(chk => {
        chk.checked = activeCols.has(chk.getAttribute('data-col'));
      });
      updateColumnVisibilityUI();
    };
  }

  const btnDeselectAllCols = document.getElementById('btnDeselectAllCols');
  if (btnDeselectAllCols) {
    btnDeselectAllCols.onclick = () => {
      activeCols.clear();
      colsContainer?.querySelectorAll('.col-toggle-chk').forEach(chk => { chk.checked = false; });
      updateColumnVisibilityUI();
    };
  }

  function updateColumnVisibilityUI() {
    SUMMARY_COLUMNS.forEach(col => {
      const isVisible = activeCols.has(col.key);
      document.querySelectorAll('.th-col-' + col.key + ', .td-col-' + col.key + ', .tfoot-col-' + col.key).forEach(el => {
        if (isVisible) el.classList.remove('col-hidden');
        else el.classList.add('col-hidden');
      });
    });

    // Update group header row colspan so it autoadjusts exactly to the number of visible columns
    const visibleCount = Math.max(1, activeCols.size);
    document.querySelectorAll('.sum-group-header-row td').forEach(td => {
      td.setAttribute('colspan', visibleCount);
    });
  }

  // Render & Manage Excluded Customers Dropdown List
  function renderExcludedCustomersList() {
    const container = document.getElementById('excludedCustomersList');
    const wrap = document.getElementById('excludedDropdownWrap');
    const countEl = document.getElementById('excludedCount');
    const headerCountEl = document.getElementById('excludedMenuHeaderCount');

    const excludedArray = Array.from(excludedSlNos);
    if (countEl) countEl.textContent = excludedArray.length;
    if (headerCountEl) headerCountEl.textContent = excludedArray.length;

    if (excludedArray.length === 0) {
      if (wrap) {
        wrap.classList.remove('d-inline-block');
        wrap.classList.add('d-none');
      }
      const dropdownBtn = document.getElementById('btnExcludedList');
      if (dropdownBtn && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
        const bsDrop = bootstrap.Dropdown.getInstance(dropdownBtn);
        if (bsDrop) bsDrop.hide();
      }
      return;
    }

    if (wrap) {
      wrap.classList.remove('d-none');
      wrap.classList.add('d-inline-block');
    }

    if (!container) return;

    container.innerHTML = excludedArray.map(sl => {
      const r = baseRows.find(b => Number(b.SlNo) === Number(sl));
      const name = r ? (r.Name || 'Unknown') : `Customer #${sl}`;
      const status = r ? getCustomerWorkStatus(r) : '';
      const dist = r ? (r.District || '') : '';
      const meta = [status, dist].filter(Boolean).join(' • ');

      return `
        <div class="d-flex align-items-center justify-content-between p-1.5 rounded border bg-light-subtle gap-2">
          <div class="d-flex flex-column" style="min-width: 0; flex: 1;">
            <span class="fw-bold text-dark text-truncate fs-8" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            ${meta ? `<span class="text-muted fs-9 text-truncate">${escapeHtml(meta)}</span>` : ''}
          </div>
          <button type="button" class="btn btn-xs btn-outline-danger d-inline-flex align-items-center gap-1 py-0.5 px-2 fs-9 btn-remove-from-excluded flex-shrink-0" data-slno="${sl}" title="Remove from Excluded (Return to Summary)">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Remove</span>
          </button>
        </div>
      `;
    }).join('');

    // Attach click listener to each Remove button inside the excluded list
    container.querySelectorAll('.btn-remove-from-excluded').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sl = Number(btn.getAttribute('data-slno'));
        excludedSlNos.delete(sl);
        updateActionButtonsUI();
        updateAllModalFilterStats();
        renderSummaryTable();
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('Customer returned to summary table.', 'success', 1500);
        }
      };
    });
  }

  // Restore All Excluded Customers button
  const btnRestoreAll = document.getElementById('btnRestoreAllExcluded');
  if (btnRestoreAll) {
    btnRestoreAll.onclick = (e) => {
      e.stopPropagation();
      excludedSlNos.clear();
      updateActionButtonsUI();
      updateAllModalFilterStats();
      renderSummaryTable();
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('All excluded customers returned to summary table.', 'success', 2000);
      }
    };
  }

  // Update Exclude / Excluded Buttons State
  function updateActionButtonsUI() {
    const btnExclude = document.getElementById('btnExcludeFromSummary');
    const excludeCountEl = document.getElementById('excludeCount');
    if (btnExclude && excludeCountEl) {
      if (selectedSlNos.size > 0) {
        btnExclude.classList.remove('d-none');
        btnExclude.classList.add('d-inline-flex');
        excludeCountEl.textContent = selectedSlNos.size;
      } else {
        btnExclude.classList.remove('d-inline-flex');
        btnExclude.classList.add('d-none');
      }
    }
    renderExcludedCustomersList();
  }

  // Exclude button click handler
  const btnExclude = document.getElementById('btnExcludeFromSummary');
  if (btnExclude) {
    btnExclude.onclick = () => {
      selectedSlNos.forEach(sl => excludedSlNos.add(sl));
      selectedSlNos.clear();
      updateActionButtonsUI();
      updateAllModalFilterStats();
      renderSummaryTable();
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Selected customer(s) excluded from summary.', 'info', 2000);
      }
    };
  }

  // Save comment handler
  async function saveSummaryComment(slNo, newComment, inputEl) {
    const cleanComment = (newComment || '').trim();
    const r = (DB.getAll('installments') || []).find(x => Number(x.SlNo) === Number(slNo));
    if (!r) return;
    r.Comment = cleanComment;

    let basePhone = '';
    let creatorId = '';
    let expenses = {};
    let workObj = null;
    if (r.BrokerNumber) {
      const parts = r.BrokerNumber.split('|');
      basePhone = parts[0] || '';
      parts.slice(1).forEach(p => {
        if (p.startsWith('expenses:')) {
          try { expenses = JSON.parse(p.slice('expenses:'.length)) || {}; } catch(e) {}
        } else if (p.startsWith('creator:')) {
          creatorId = p.slice('creator:'.length);
        } else if (p.startsWith('work:')) {
          try { workObj = JSON.parse(p.slice('work:'.length)) || {}; } catch(e) {}
        }
      });
    }
    expenses.otherComment = cleanComment;
    let newBroker = basePhone + '|expenses:' + JSON.stringify(expenses);
    if (creatorId) newBroker += '|creator:' + creatorId;
    if (workObj && Object.keys(workObj).length > 0) newBroker += '|work:' + JSON.stringify(workObj);
    r.BrokerNumber = newBroker;

    try {
      await DB.insert('installment_remarks', {
        RemarkID: (typeof Utils !== 'undefined' && Utils.uid) ? Utils.uid('RMK') : 'RMK-' + Date.now(),
        SlNo: Number(slNo),
        Type: 'Customer',
        Remark: cleanComment,
        CreatedAt: new Date().toISOString()
      });
      await DB.update('installments', x => Number(x.SlNo) === Number(slNo), {
        BrokerNumber: newBroker
      });
      if (inputEl) {
        inputEl.classList.add('is-saved');
        setTimeout(() => inputEl.classList.remove('is-saved'), 1200);
      }
    } catch (err) {
      console.error('Failed to save comment:', err);
    }
  }

  // Master Checkbox in table header
  const chkSelectAll = document.getElementById('chkSumSelectAll');
  if (chkSelectAll) {
    chkSelectAll.onchange = () => {
      const isChecked = chkSelectAll.checked;
      document.querySelectorAll('.sum-row-chk').forEach(chk => {
        chk.checked = isChecked;
        const sl = Number(chk.getAttribute('data-slno'));
        if (isChecked) selectedSlNos.add(sl);
        else selectedSlNos.delete(sl);
      });
      document.querySelectorAll('.group-select-chk').forEach(gChk => {
        gChk.checked = isChecked;
      });
      updateActionButtonsUI();
    };
  }

  // Render Table Core Function
  let currentDisplayedRows = [];

  function renderSummaryTable() {
    let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

    // Filter by Search Text
    if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));

    // Filter by Partner
    if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));

    // Filter by District
    if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));

    // Filter by Status (Login, Agreement, Subsidy)
    if (modalSelectedStatus !== 'ALL') rows = rows.filter(r => getCustomerWorkStatus(r) === modalSelectedStatus);

    // Map each row with its financials
    const mappedRows = rows.map(r => {
      const fin = getCustomerSummaryFinancials(r);
      return {
        row: r,
        status: getCustomerWorkStatus(r),
        moduleMake: getCustomerModuleMake(r),
        inverterMake: getCustomerInverterMake(r),
        fin
      };
    });

    // Filter by Payment status
    let filteredList = mappedRows;
    if (modalSelectedPaymentFilters.length > 0) {
      filteredList = mappedRows.filter(item => {
        const cat = item.fin.payCategory;
        return (
          (modalSelectedPaymentFilters.includes('Unpaid') && cat === 'Unpaid') ||
          (modalSelectedPaymentFilters.includes('PartiallyPaid') && cat === 'Partial Paid') ||
          (modalSelectedPaymentFilters.includes('FullyPaid') && cat === 'Fully Paid')
        );
      });
    }

    currentDisplayedRows = filteredList;

    // Update row count badge
    const countBadge = document.getElementById('sumModalRowCount');
    if (countBadge) {
      countBadge.textContent = `${filteredList.length} of ${baseRows.length} customers`;
    }

    // Grouping into Unpaid, Partial Paid, Fully Paid
    const unpaidList = filteredList.filter(item => item.fin.payCategory === 'Unpaid');
    const partialList = filteredList.filter(item => item.fin.payCategory === 'Partial Paid');
    const fullyList = filteredList.filter(item => item.fin.payCategory === 'Fully Paid');

    const groupsToRender = [];
    const hasPayFilter = modalSelectedPaymentFilters.length > 0;

    if (!hasPayFilter || modalSelectedPaymentFilters.includes('Unpaid')) {
      groupsToRender.push({ name: 'Unpaid', list: unpaidList, colorClass: 'text-danger', groupClass: 'group-unpaid', rowClass: 'sum-row-unpaid' });
    }
    if (!hasPayFilter || modalSelectedPaymentFilters.includes('PartiallyPaid')) {
      groupsToRender.push({ name: 'Partial Paid', list: partialList, colorClass: 'text-warning-emphasis', groupClass: 'group-partial', rowClass: 'sum-row-partial' });
    }
    if (!hasPayFilter || modalSelectedPaymentFilters.includes('FullyPaid')) {
      groupsToRender.push({ name: 'Fully Paid', list: fullyList, colorClass: 'text-success', groupClass: 'group-fully', rowClass: 'sum-row-fully' });
    }

    const tbody = document.querySelector('#workSummaryTable tbody');
    if (!tbody) return;

    const visibleColSpan = Math.max(1, activeCols.size);

    if (filteredList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${visibleColSpan}" class="text-center py-4 text-muted fs-8">No customers match the selected filter criteria.</td></tr>`;
      renderTableFooter(filteredList);
      updateColumnVisibilityUI();
      return;
    }

    let tbodyHtml = '';

    groupsToRender.forEach(grp => {
      const grpList = grp.list;
      if (grpList.length === 0 && hasPayFilter) return;

      const isAllGrpChecked = grpList.length > 0 && grpList.every(i => selectedSlNos.has(Number(i.row.SlNo)));

      tbodyHtml += `
        <tr class="sum-group-header-row ${grp.groupClass} border-top border-bottom">
          <td colspan="${visibleColSpan}" class="py-1.5 px-3">
            <div class="d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0 group-select-chk" data-group="${grp.name}" ${isAllGrpChecked ? 'checked' : ''} title="Select all ${grp.name}">
              <span class="fw-bold ${grp.colorClass} fs-8">${grp.name}: ${grpList.length}</span>
            </div>
          </td>
        </tr>
      `;

      if (grpList.length === 0) {
        tbodyHtml += `<tr><td colspan="${visibleColSpan}" class="text-center py-2 text-muted fs-8 fst-italic">0 customers in ${grp.name}</td></tr>`;
        return;
      }

      grpList.forEach(item => {
        const r = item.row;
        const sl = Number(r.SlNo);
        const fin = item.fin;
        const isChecked = selectedSlNos.has(sl);

        let statusBadgeClass = 'bg-info-subtle text-info-emphasis border border-info-subtle';
        if (item.status === 'Agreement') statusBadgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
        if (item.status === 'Subsidy') statusBadgeClass = 'bg-success-subtle text-success border border-success-subtle';

        tbodyHtml += `
          <tr class="sum-cust-row ${grp.rowClass || ''}">
            <td class="td-col-customer">
              <div class="d-flex align-items-center gap-2">
                <input type="checkbox" class="form-check-input mt-0 sum-row-chk flex-shrink-0" data-slno="${sl}" data-group="${grp.name}" ${isChecked ? 'checked' : ''}>
                <span class="fw-bold text-dark sum-cust-name">${escapeHtml(r.Name || '-')}</span>
                <span class="text-muted">:</span>
                <span class="badge ${statusBadgeClass} fs-9 py-0.5 px-1.5 flex-shrink-0">${item.status}</span>
              </div>
            </td>
            <td class="td-col-pvmodule text-nowrap fs-8 text-secondary" title="${escapeHtml(item.moduleMake)}">${escapeHtml(item.moduleMake)}</td>
            <td class="td-col-inverter text-nowrap fs-8 text-secondary" title="${escapeHtml(item.inverterMake)}">${escapeHtml(item.inverterMake)}</td>
            <td class="td-col-payment text-nowrap fs-8"><span class="text-muted">Paid:</span> <strong class="text-success">${fmtCurr(fin.paid)}</strong></td>
            <td class="td-col-install text-end font-monospace fs-8">${fmtCurr(fin.install)}</td>
            <td class="td-col-meter text-end font-monospace fs-8">${fmtCurr(fin.meter)}</td>
            <td class="td-col-delivery text-end font-monospace fs-8">${fmtCurr(fin.delivery)}</td>
            <td class="td-col-others text-end font-monospace fs-8">${fmtCurr(fin.others)}</td>
            <td class="td-col-comment">
              <input type="text" class="form-control form-control-sm py-0.5 px-2 fs-8 sum-comment-input bg-white" data-slno="${sl}" value="${escapeHtml(fin.comment)}" placeholder="Add comment...">
            </td>
            <td class="td-col-material text-end font-monospace fs-8">${fmtCurr(fin.material)}</td>
            <td class="td-col-setcost text-end font-monospace fs-8 fw-semibold text-dark">${fmtCurr(fin.setCost)}</td>
            <td class="td-col-profit text-end font-monospace fs-8 fw-bold ${fin.profit >= 0 ? 'text-success' : 'text-danger'}">${fmtCurr(fin.profit)}</td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = tbodyHtml;

    // Attach row checkbox event listeners
    tbody.querySelectorAll('.sum-row-chk').forEach(chk => {
      chk.onchange = () => {
        const sl = Number(chk.getAttribute('data-slno'));
        if (chk.checked) selectedSlNos.add(sl);
        else selectedSlNos.delete(sl);

        const grpName = chk.getAttribute('data-group');
        const grpRowChks = Array.from(tbody.querySelectorAll(`.sum-row-chk[data-group="${grpName}"]`));
        const allGrpChecked = grpRowChks.every(c => c.checked);
        const grpHeadChk = tbody.querySelector(`.group-select-chk[data-group="${grpName}"]`);
        if (grpHeadChk) grpHeadChk.checked = allGrpChecked;

        const allRowChks = Array.from(tbody.querySelectorAll('.sum-row-chk'));
        if (chkSelectAll) chkSelectAll.checked = allRowChks.length > 0 && allRowChks.every(c => c.checked);

        updateActionButtonsUI();
      };
    });

    // Attach group header checkbox event listeners
    tbody.querySelectorAll('.group-select-chk').forEach(gChk => {
      gChk.onchange = () => {
        const grpName = gChk.getAttribute('data-group');
        const isChecked = gChk.checked;
        tbody.querySelectorAll(`.sum-row-chk[data-group="${grpName}"]`).forEach(chk => {
          chk.checked = isChecked;
          const sl = Number(chk.getAttribute('data-slno'));
          if (isChecked) selectedSlNos.add(sl);
          else selectedSlNos.delete(sl);
        });

        const allRowChks = Array.from(tbody.querySelectorAll('.sum-row-chk'));
        if (chkSelectAll) chkSelectAll.checked = allRowChks.length > 0 && allRowChks.every(c => c.checked);

        updateActionButtonsUI();
      };
    });

    // Attach comment input listeners
    tbody.querySelectorAll('.sum-comment-input').forEach(input => {
      const handleSave = () => {
        const sl = Number(input.getAttribute('data-slno'));
        saveSummaryComment(sl, input.value, input);
      };
      input.onchange = handleSave;
      input.onblur = handleSave;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      };
    });

    renderTableFooter(filteredList);
    updateColumnVisibilityUI();
    updateActionButtonsUI();
  }

  function renderTableFooter(list) {
    const tfoot = document.getElementById('workSummaryTableFoot');
    if (!tfoot) return;

    let totalCust = list.length;
    let totPaid = 0;
    let totUnpaid = 0;
    let totTurnover = 0;
    let totMaterial = 0;
    let totInstall = 0;
    let totMeter = 0;
    let totDelivery = 0;
    let totOthers = 0;
    let totSetCost = 0;
    let totProfit = 0;

    list.forEach(item => {
      const fin = item.fin;
      totPaid += fin.paid;
      totUnpaid += fin.unpaid;
      totTurnover += fin.turnover;
      totMaterial += fin.material;
      totInstall += fin.install;
      totMeter += fin.meter;
      totDelivery += fin.delivery;
      totOthers += fin.others;
      totSetCost += fin.setCost;
      totProfit += fin.profit;
    });

    tfoot.innerHTML = `
      <tr class="table-light border-top-2 fw-bold align-top">
        <td class="tfoot-col-customer py-2">
          <div class="fs-8 text-dark">Total Customer: <span class="text-primary fw-bold fs-7">${totalCust}</span></div>
        </td>
        <td class="tfoot-col-pvmodule"></td>
        <td class="tfoot-col-inverter"></td>
        <td class="tfoot-col-payment text-nowrap py-2 fs-8">
          <div class="d-flex justify-content-between gap-2"><span class="text-muted">Paid:</span> <span class="text-success font-monospace fw-bold">${fmtCurr(totPaid)}</span></div>
          <div class="d-flex justify-content-between gap-2"><span class="text-muted">Unpaid:</span> <span class="text-danger font-monospace fw-bold">${fmtCurr(totUnpaid)}</span></div>
          <div class="d-flex justify-content-between gap-2 border-top pt-0.5"><span class="text-muted">Turnover:</span> <span class="text-dark font-monospace fw-bold">${fmtCurr(totTurnover)}</span></div>
        </td>
        <td class="tfoot-col-install text-end font-monospace py-2 fs-8 text-dark">${fmtCurr(totInstall)}</td>
        <td class="tfoot-col-meter text-end font-monospace py-2 fs-8 text-dark">${fmtCurr(totMeter)}</td>
        <td class="tfoot-col-delivery text-end font-monospace py-2 fs-8 text-dark">${fmtCurr(totDelivery)}</td>
        <td class="tfoot-col-others text-end font-monospace py-2 fs-8 text-dark">${fmtCurr(totOthers)}</td>
        <td class="tfoot-col-comment"></td>
        <td class="tfoot-col-material text-end font-monospace py-2 fs-8 text-dark">${fmtCurr(totMaterial)}</td>
        <td class="tfoot-col-setcost text-end py-2 fs-8">
          <div class="text-muted fs-9 fw-semibold text-uppercase" style="letter-spacing: 0.03em;">Total Investment</div>
          <div class="font-monospace fw-bold text-dark fs-7">${fmtCurr(totSetCost)}</div>
        </td>
        <td class="tfoot-col-profit text-end py-2 fs-8">
          <div class="text-muted fs-9 fw-semibold text-uppercase" style="letter-spacing: 0.03em;">Total Profit:</div>
          <div class="font-monospace fw-bold fs-7 ${totProfit >= 0 ? 'text-success' : 'text-danger'}">${fmtCurr(totProfit)}</div>
        </td>
      </tr>
    `;
  }

  // Copy Summary Generator: Serial numbered, Underlined customer name, column name - value below each other
  function getNotepadWhatsAppCopyText() {
    const isColActive = (key) => activeCols.has(key);
    const lines = [];
    let serialNo = 1;

    const groups = [
      { key: 'Unpaid', label: 'UNPAID' },
      { key: 'Partial Paid', label: 'PARTIAL PAID' },
      { key: 'Fully Paid', label: 'FULLY PAID' }
    ];

    groups.forEach(grp => {
      const grpItems = currentDisplayedRows.filter(i => i.fin.payCategory === grp.key);
      if (grpItems.length === 0) return;

      lines.push(`==============================`);
      lines.push(`${grp.label} (${grpItems.length})`);
      lines.push(`==============================`);
      lines.push('');

      grpItems.forEach(item => {
        const r = item.row;
        const fin = item.fin;

        // Serial numbering + Customer name (Bold) + Status
        const custHeader = `*${serialNo}. ${(r.Name || '-').toUpperCase()}* : ${item.status}`;
        lines.push(custHeader);

        // Column name - value talaku talaku (one below the other)
        if (isColActive('pvmodule')) {
          lines.push(`PVModule Make: ${item.moduleMake || '-'}`);
        }
        if (isColActive('inverter')) {
          lines.push(`Inverter Make: ${item.inverterMake || '-'}`);
        }
        if (isColActive('payment')) {
          lines.push(`Payment: Paid: ${fmtCurr(fin.paid)} (Unpaid: ${fmtCurr(fin.unpaid)})`);
        }
        if (isColActive('install')) {
          lines.push(`Install: ${fmtCurr(fin.install)}`);
        }
        if (isColActive('meter')) {
          lines.push(`Meter: ${fmtCurr(fin.meter)}`);
        }
        if (isColActive('delivery')) {
          lines.push(`Delivery: ${fmtCurr(fin.delivery)}`);
        }
        if (isColActive('others')) {
          lines.push(`Others: ${fmtCurr(fin.others)}`);
        }
        if (isColActive('comment')) {
          lines.push(`Comment: ${fin.comment || '-'}`);
        }
        if (isColActive('material')) {
          lines.push(`Material: ${fmtCurr(fin.material)}`);
        }
        if (isColActive('setcost')) {
          lines.push(`Set Cost: ${fmtCurr(fin.setCost)}`);
        }
        if (isColActive('profit')) {
          lines.push(`Profit: ${fmtCurr(fin.profit)}`);
        }

        lines.push(''); // Blank line separator
        serialNo++;
      });
    });

    // Summary Totals Block
    let totPaid = 0, totUnpaid = 0, totTurnover = 0, totMaterial = 0, totInstall = 0, totMeter = 0, totDelivery = 0, totOthers = 0, totSetCost = 0, totProfit = 0;
    currentDisplayedRows.forEach(i => {
      totPaid += i.fin.paid;
      totUnpaid += i.fin.unpaid;
      totTurnover += i.fin.turnover;
      totMaterial += i.fin.material;
      totInstall += i.fin.install;
      totMeter += i.fin.meter;
      totDelivery += i.fin.delivery;
      totOthers += i.fin.others;
      totSetCost += i.fin.setCost;
      totProfit += i.fin.profit;
    });

    lines.push(`==============================`);
    lines.push(`SUMMARY TOTALS`);
    lines.push(`==============================`);
    lines.push(`Total Customers: ${currentDisplayedRows.length}`);
    if (isColActive('payment')) {
      lines.push(`Paid: ${fmtCurr(totPaid)}`);
      lines.push(`Unpaid: ${fmtCurr(totUnpaid)}`);
      lines.push(`Turnover: ${fmtCurr(totTurnover)}`);
    }
    if (isColActive('install')) lines.push(`Total Install: ${fmtCurr(totInstall)}`);
    if (isColActive('meter')) lines.push(`Total Meter: ${fmtCurr(totMeter)}`);
    if (isColActive('delivery')) lines.push(`Total Delivery: ${fmtCurr(totDelivery)}`);
    if (isColActive('others')) lines.push(`Total Others: ${fmtCurr(totOthers)}`);
    if (isColActive('material')) lines.push(`Total Material: ${fmtCurr(totMaterial)}`);
    if (isColActive('setcost')) lines.push(`Total Investment (Set Cost): ${fmtCurr(totSetCost)}`);
    if (isColActive('profit')) lines.push(`Total Profit: ${fmtCurr(totProfit)}`);
    lines.push(`==============================`);

    return lines.join('\n');
  }

  // Standalone Copy Button Handler
  const btnCopySummary = document.getElementById('btnCopySummary');
  if (btnCopySummary) {
    btnCopySummary.onclick = async () => {
      const text = getNotepadWhatsAppCopyText();

      // Rich HTML markup with bold styling for Word / Docs / Email
      const htmlText = text
        .split('\n')
        .map(line => {
          const boldMatch = line.match(/^\*([^*]+)\*(.*)/);
          if (boldMatch) {
            return `<b>${boldMatch[1]}</b>${boldMatch[2]}<br>`;
          }
          return `${line}<br>`;
        })
        .join('');

      let copied = false;
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const textBlob = new Blob([text], { type: 'text/plain' });
          const htmlBlob = new Blob([htmlText], { type: 'text/html' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': textBlob,
              'text/html': htmlBlob
            })
          ]);
          copied = true;
        }
      } catch (e) {
        // Fallback to writeText
      }

      if (!copied) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('Summary copied to clipboard!', 'success');
          }).catch(() => fallbackCopy(text));
          return;
        } else {
          fallbackCopy(text);
          return;
        }
      }
      if (typeof UI !== 'undefined' && UI.toast) UI.toast('Summary copied to clipboard!', 'success');
    };
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('Summary copied to clipboard (readable WhatsApp/Notepad format)!', 'success');
  }

  // Window Expand / Restore
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

  const btnExpand = document.getElementById('btnToggleSummaryExpand');
  if (btnExpand) {
    btnExpand.onclick = () => {
      const dialog = document.querySelector('#workSummaryModal .modal-dialog');
      if (dialog) {
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

  // Interactive Drag Resize Handler
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

        const newWidth = Math.max(480, Math.min(maxAvailW, startWidth + deltaX * 2));
        const newHeight = Math.max(360, Math.min(maxAvailH, startHeight + deltaY));

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

  // Initialize Toolbar Filters and Table
  populateModalPartners();
  updateAllModalFilterStats();
  renderSummaryTable();

  const modalEl = document.getElementById('workSummaryModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
};
