/* =========================================================================
   summary.js — Work Financial & Delivery Summary and Activity Tracker
   ========================================================================= */

// Districts list
const DISTRICTS = [
  'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
  'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
  'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Khordha',
  'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada',
  'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'
];

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

// Filters State
let modalSelectedPartners = [];
let modalSelectedDistricts = [];
let modalSelectedStage = 'ALL';
let modalSelectedPaymentFilters = [];
let modalSearchText = '';

// Excluded customers set
const excludedSlNos = new Set();
// Currently checked row SlNos for exclude action
const selectedSlNos = new Set();

let currentDisplayedRows = [];

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurr(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getWorkRows() {
  const allRows = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installments') || []) : [];
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

function getCustomerPaymentsMap() {
  const txns = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installment_txns') || []) : [];
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

// 8 Workflow Stages (Matching Manage Work exactly)
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

function getCustomerWorkStatus(r) {
  const idx = getRowHighestStageIdx(r);
  return WORKFLOW_STAGES[idx] ? WORKFLOW_STAGES[idx].name : 'Login';
}

// Financials and Set Cost formula: Set Cost = Material + Install + Meter + Delivery + Others
function getCustomerSummaryFinancials(r, payMap) {
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

// 1. Populate Partner Filter Dropdown with Multiselect Checkboxes
function populateModalPartners() {
  const partnerMenu = document.getElementById('sumPartnerMultiselectMenu');
  if (!partnerMenu) return;

  const baseRows = getWorkRows().filter(r => r.Status !== 'Deactive');
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

  const baseRows = getWorkRows().filter(r => r.Status !== 'Deactive');
  let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

  if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
  if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
  if (modalSelectedStage && modalSelectedStage !== 'ALL') {
    const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === modalSelectedStage);
    if (targetIdx >= 0) rows = rows.filter(r => getRowHighestStageIdx(r) === targetIdx);
  }
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

// 3. Update Workflow Stage Filters (All 8 Stages: Login, Agreement, Dispatched, Installation, NetMeter, Inspection, Connection, Subsidy)
function updateModalStageStats() {
  const container = document.getElementById('sumStageStatsContainer');
  if (!container) return;

  const baseRows = getWorkRows().filter(r => r.Status !== 'Deactive');
  let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

  if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
  if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
  if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));
  if (modalSelectedPaymentFilters.length > 0) rows = rows.filter(r => matchesPayment(r, modalSelectedPaymentFilters));

  const stageCounts = [0, 0, 0, 0, 0, 0, 0, 0];
  rows.forEach(r => {
    const idx = getRowHighestStageIdx(r);
    if (idx >= 0 && idx < 8) {
      stageCounts[idx]++;
    }
  });

  const totalCount = rows.length;
  const isTotalActive = (modalSelectedStage === 'ALL');

  const totalBadge = `<button type="button" class="stage-filter-tag ${isTotalActive ? 'active' : ''}" data-stage="ALL" title="Show all stages">Total (${totalCount})</button>`;

  const stageBadges = WORKFLOW_STAGES.map((st, idx) => {
    const count = stageCounts[idx] || 0;
    const isSelected = (modalSelectedStage === st.key);
    return `<button type="button" class="stage-filter-tag stage-tag-${st.num} ${isSelected ? 'active' : ''}" data-stage="${st.key}" title="Filter by Stage ${st.num}: ${st.name}">${st.num}. ${st.name} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + stageBadges;

  container.querySelectorAll('.stage-filter-tag').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const stVal = btn.getAttribute('data-stage');
      if (stVal === 'ALL' || modalSelectedStage === stVal) {
        modalSelectedStage = 'ALL';
      } else {
        modalSelectedStage = stVal;
      }
      updateAllModalFilterStats();
      renderSummaryTable();
    };
  });
}

// 4. Update Payment Badges Strip (Total, Fully Paid, Partially Paid, Unpaid, NetMeter Paid)
function updateModalPaymentStats() {
  const container = document.getElementById('sumPaymentStatsContainer');
  if (!container) return;

  const baseRows = getWorkRows().filter(r => r.Status !== 'Deactive');
  const payMap = getCustomerPaymentsMap();
  let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

  if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));
  if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));
  if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));
  if (modalSelectedStage && modalSelectedStage !== 'ALL') {
    const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === modalSelectedStage);
    if (targetIdx >= 0) rows = rows.filter(r => getRowHighestStageIdx(r) === targetIdx);
  }

  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;
  let netMeterPaidCount = 0;

  rows.forEach(r => {
    const total = payMap ? (payMap[Number(r.SlNo)] || 0) : 0;
    const price = Number(r.CommittedPrice) || 0;
    if (price > 0 && total >= price) fullyPaidCount++;
    else if (total > 0) partiallyPaidCount++;
    else unpaidCount++;

    let isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate);
    if (!isNm && r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try {
        const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
        const expenses = JSON.parse(jsonStr);
        if (expenses && expenses.net_meter_paid) isNm = true;
      } catch (e) {}
    }
    if (isNm) netMeterPaidCount++;
  });

  const isTotalActive = modalSelectedPaymentFilters.length === 0;
  const totalCount = rows.length;

  container.innerHTML = `
    <button type="button" class="pay-filter-tag pay-tag-all ${isTotalActive ? 'active' : ''}" data-pay="ALL" title="Show all payment statuses">Total (${totalCount})</button>
    <button type="button" class="pay-filter-tag pay-tag-full ${modalSelectedPaymentFilters.includes('FullyPaid') ? 'active' : ''}" data-pay="FullyPaid" title="Filter by Fully Paid">Fully Paid (${fullyPaidCount})</button>
    <button type="button" class="pay-filter-tag pay-tag-partial ${modalSelectedPaymentFilters.includes('PartiallyPaid') ? 'active' : ''}" data-pay="PartiallyPaid" title="Filter by Partially Paid">Partially Paid (${partiallyPaidCount})</button>
    <button type="button" class="pay-filter-tag pay-tag-unpaid ${modalSelectedPaymentFilters.includes('Unpaid') ? 'active' : ''}" data-pay="Unpaid" title="Filter by Unpaid">Unpaid (${unpaidCount})</button>
    <button type="button" class="pay-filter-tag pay-tag-netmeter ${modalSelectedPaymentFilters.includes('NetMeterPaid') ? 'active' : ''}" data-pay="NetMeterPaid" title="Filter by Net Meter Paid">NetMeter Paid (${netMeterPaidCount})</button>
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
  const distVal = (r.District && r.District.trim()) ? r.District.trim() : '(No District)';
  return districts.includes(distVal);
}

function matchesPayment(r, payFilters) {
  if (!payFilters || payFilters.length === 0) return true;
  const payMap = getCustomerPaymentsMap();
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

  const hasMainFilters = payFilters.some(f => f === 'FullyPaid' || f === 'PartiallyPaid' || f === 'Unpaid');
  const hasNetMeterFilter = payFilters.includes('NetMeterPaid');

  let mainMatch = true;
  if (hasMainFilters) {
    mainMatch = (
      (payFilters.includes('FullyPaid') && isFullyPaid) ||
      (payFilters.includes('PartiallyPaid') && isPartiallyPaid) ||
      (payFilters.includes('Unpaid') && isUnpaid)
    );
  }

  let nmMatch = true;
  if (hasNetMeterFilter) {
    nmMatch = isNetMeterPaid;
  }

  return mainMatch && nmMatch;
}

// Render & Manage Excluded Customers Dropdown List
function renderExcludedCustomersList() {
  const container = document.getElementById('excludedCustomersList');
  const wrap = document.getElementById('excludedDropdownWrap');
  const countEl = document.getElementById('excludeCount');
  const exCountEl = document.getElementById('excludedCount');
  const headerCountEl = document.getElementById('excludedMenuHeaderCount');

  const excludedArray = Array.from(excludedSlNos);
  if (exCountEl) exCountEl.textContent = excludedArray.length;
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

  const baseRows = getWorkRows();
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
        try { workObj = JSON.parse(p.slice('work:'.length)); } catch(e) {}
      }
    });
  }

  expenses.otherComment = cleanComment;
  let newBroker = basePhone;
  if (creatorId) newBroker += '|creator:' + creatorId;
  newBroker += '|expenses:' + JSON.stringify(expenses);
  if (workObj) newBroker += '|work:' + JSON.stringify(workObj);

  try {
    await DB.update('installments', x => Number(x.SlNo) === Number(slNo), {
      Comment: cleanComment,
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

function renderSummaryTable() {
  const baseRows = getWorkRows().filter(r => r.Status !== 'Deactive');
  const payMap = getCustomerPaymentsMap();
  let rows = baseRows.filter(r => !excludedSlNos.has(Number(r.SlNo)));

  // Filter by Search Text
  if (modalSearchText) rows = rows.filter(r => matchesSearch(r, modalSearchText));

  // Filter by Partner
  if (modalSelectedPartners.length > 0) rows = rows.filter(r => matchesPartner(r, modalSelectedPartners));

  // Filter by District
  if (modalSelectedDistricts.length > 0) rows = rows.filter(r => matchesDistrict(r, modalSelectedDistricts));

  // Filter by Workflow Stage (All 8 Stages)
  if (modalSelectedStage && modalSelectedStage !== 'ALL') {
    const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === modalSelectedStage);
    if (targetIdx >= 0) rows = rows.filter(r => getRowHighestStageIdx(r) === targetIdx);
  }

  // Filter by Payment status
  if (modalSelectedPaymentFilters.length > 0) {
    rows = rows.filter(r => matchesPayment(r, modalSelectedPaymentFilters));
  }

  // Map each row with its financials
  const mappedRows = rows.map(r => {
    const fin = getCustomerSummaryFinancials(r, payMap);
    return {
      row: r,
      status: getCustomerWorkStatus(r),
      moduleMake: getCustomerModuleMake(r),
      inverterMake: getCustomerInverterMake(r),
      fin
    };
  });

  let filteredList = mappedRows;

  currentDisplayedRows = filteredList;

  // Update row count badge
  const countBadge = document.getElementById('sumModalRowCount');
  if (countBadge) {
    countBadge.textContent = `${filteredList.length} of ${baseRows.length} customers`;
  }

  // Group into Unpaid, Partially Paid, Fully Paid
  const unpaidList = filteredList.filter(i => i.fin.payCategory === 'Unpaid');
  const partialList = filteredList.filter(i => i.fin.payCategory === 'Partial Paid');
  const fullyList = filteredList.filter(i => i.fin.payCategory === 'Fully Paid');

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
    if (grp.list.length === 0) return;

    // Sort customers by Workflow Status serial number (1. Login to 8. Subsidy) under each payment status section
    grp.list.sort((a, b) => {
      const stageA = getRowHighestStageIdx(a.row);
      const stageB = getRowHighestStageIdx(b.row);
      if (stageA !== stageB) {
        return stageA - stageB; // Status serial number: 1 -> 8 ascending
      }
      return (Number(a.row.SlNo) || 0) - (Number(b.row.SlNo) || 0);
    });

    const allInGrpSelected = grp.list.length > 0 && grp.list.every(i => selectedSlNos.has(Number(i.row.SlNo)));

    tbodyHtml += `
      <tr class="sum-group-header-row ${grp.groupClass}">
        <td colspan="${visibleColSpan}" class="py-1 px-2.5">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0 group-select-chk flex-shrink-0" data-group="${grp.name}" ${allInGrpSelected ? 'checked' : ''} title="Select/Deselect all ${grp.name}">
              <span class="fw-bold ${grp.colorClass} fs-8">${grp.name} (${grp.list.length})</span>
            </div>
          </div>
        </td>
      </tr>
    `;

    grp.list.forEach(item => {
      const r = item.row;
      const fin = item.fin;
      const sl = Number(r.SlNo);
      const isChecked = selectedSlNos.has(sl);

      let statusBadgeClass = 'bg-secondary-subtle text-secondary border border-secondary-subtle';
      if (item.status === 'Login') statusBadgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
      else if (item.status === 'Agreement') statusBadgeClass = 'bg-purple-subtle text-purple border border-purple-subtle';
      else if (item.status === 'Dispatched') statusBadgeClass = 'bg-info-subtle text-info border border-info-subtle';
      else if (item.status === 'Installation') statusBadgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      else if (item.status === 'NetMeter') statusBadgeClass = 'bg-indigo-subtle text-indigo-emphasis border border-indigo-subtle';
      else if (item.status === 'Inspection') statusBadgeClass = 'bg-dark-subtle text-dark border border-dark-subtle';
      else if (item.status === 'Connection') statusBadgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
      else if (item.status === 'Subsidy') statusBadgeClass = 'bg-success-subtle text-success border border-success-subtle';

      tbodyHtml += `
        <tr class="sum-cust-row ${grp.rowClass || ''}">
          <td class="td-col-customer text-nowrap">
            <div class="d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0 sum-row-chk flex-shrink-0" data-slno="${sl}" data-group="${grp.name}" ${isChecked ? 'checked' : ''}>
              <span class="fw-bold text-dark fs-8" title="${escapeHtml(r.Name || '-')}">${escapeHtml(r.Name || '-')}</span>
              <span class="badge ${statusBadgeClass} fs-9 px-1.5 py-0.5">${item.status}</span>
            </div>
          </td>
          <td class="td-col-pvmodule text-nowrap"><span class="badge bg-light text-dark border fs-9 fw-normal">${escapeHtml(item.moduleMake)}</span></td>
          <td class="td-col-inverter text-nowrap"><span class="badge bg-light text-dark border fs-9 fw-normal">${escapeHtml(item.inverterMake)}</span></td>
          <td class="td-col-payment text-nowrap">
            <div class="d-flex flex-column">
              <span class="fw-semibold text-success fs-8">${fmtCurr(fin.paid)}</span>
              ${fin.unpaid > 0 ? `<span class="text-danger fs-9">Unpaid: ${fmtCurr(fin.unpaid)}</span>` : ''}
            </div>
          </td>
          <td class="td-col-install text-end text-nowrap">${fmtCurr(fin.install)}</td>
          <td class="td-col-meter text-end text-nowrap">${fmtCurr(fin.meter)}</td>
          <td class="td-col-delivery text-end text-nowrap">${fmtCurr(fin.delivery)}</td>
          <td class="td-col-others text-end text-nowrap">${fmtCurr(fin.others)}</td>
          <td class="td-col-comment">
            <input type="text" class="form-control form-control-sm sum-comment-input" data-slno="${sl}" value="${escapeHtml(fin.comment)}" placeholder="Add comment...">
          </td>
          <td class="td-col-material text-end text-nowrap">${fmtCurr(fin.material)}</td>
          <td class="td-col-setcost text-end text-nowrap fw-semibold bg-light-subtle">${fmtCurr(fin.setCost)}</td>
          <td class="td-col-profit text-end text-nowrap fw-bold ${fin.profit >= 0 ? 'text-success' : 'text-danger'} bg-light-subtle">${fmtCurr(fin.profit)}</td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = tbodyHtml;

  // Row selection checkboxes listeners
  tbody.querySelectorAll('.sum-row-chk').forEach(chk => {
    chk.onchange = () => {
      const sl = Number(chk.getAttribute('data-slno'));
      if (chk.checked) selectedSlNos.add(sl);
      else selectedSlNos.delete(sl);

      const grpName = chk.getAttribute('data-group');
      const grpChks = Array.from(tbody.querySelectorAll(`.sum-row-chk[data-group="${grpName}"]`));
      const allChecked = grpChks.every(c => c.checked);
      const grpHeaderChk = tbody.querySelector(`.group-select-chk[data-group="${grpName}"]`);
      if (grpHeaderChk) grpHeaderChk.checked = allChecked;

      updateActionButtonsUI();
    };
  });

  // Group select all listeners
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
      updateActionButtonsUI();
    };
  });

  // Comment input auto-save listeners
  tbody.querySelectorAll('.sum-comment-input').forEach(input => {
    input.addEventListener('change', () => {
      const sl = Number(input.getAttribute('data-slno'));
      saveSummaryComment(sl, input.value, input);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });
  });

  renderTableFooter(filteredList);
  updateColumnVisibilityUI();
  updateActionButtonsUI();
}

function renderTableFooter(list) {
  const tfoot = document.getElementById('workSummaryTableFoot');
  if (!tfoot) return;

  let totPaid = 0;
  let totUnpaid = 0;
  let totTurnover = 0;
  let totInstall = 0;
  let totMeter = 0;
  let totDelivery = 0;
  let totOthers = 0;
  let totMaterial = 0;
  let totSetCost = 0;
  let totProfit = 0;

  list.forEach(i => {
    totPaid += i.fin.paid;
    totUnpaid += i.fin.unpaid;
    totTurnover += i.fin.turnover;
    totInstall += i.fin.install;
    totMeter += i.fin.meter;
    totDelivery += i.fin.delivery;
    totOthers += i.fin.others;
    totMaterial += i.fin.material;
    totSetCost += i.fin.setCost;
    totProfit += i.fin.profit;
  });

  tfoot.innerHTML = `
    <tr>
      <td class="tfoot-col-customer fw-bold">
        <div class="d-flex flex-column">
          <span>Total Customers: ${list.length}</span>
          <span class="text-muted fs-9 fw-normal">Turnover: ${fmtCurr(totTurnover)}</span>
        </div>
      </td>
      <td class="tfoot-col-pvmodule">-</td>
      <td class="tfoot-col-inverter">-</td>
      <td class="tfoot-col-payment">
        <div class="d-flex flex-column">
          <span class="text-success fw-bold">${fmtCurr(totPaid)}</span>
          <span class="text-danger fs-9 fw-normal">Unpaid: ${fmtCurr(totUnpaid)}</span>
        </div>
      </td>
      <td class="tfoot-col-install text-end fw-bold text-nowrap">${fmtCurr(totInstall)}</td>
      <td class="tfoot-col-meter text-end fw-bold text-nowrap">${fmtCurr(totMeter)}</td>
      <td class="tfoot-col-delivery text-end fw-bold text-nowrap">${fmtCurr(totDelivery)}</td>
      <td class="tfoot-col-others text-end fw-bold text-nowrap">${fmtCurr(totOthers)}</td>
      <td class="tfoot-col-comment">-</td>
      <td class="tfoot-col-material text-end fw-bold text-nowrap">${fmtCurr(totMaterial)}</td>
      <td class="tfoot-col-setcost text-end fw-bold text-nowrap bg-light-subtle">${fmtCurr(totSetCost)}</td>
      <td class="tfoot-col-profit text-end fw-bold text-nowrap ${totProfit >= 0 ? 'text-success' : 'text-danger'} bg-light-subtle">${fmtCurr(totProfit)}</td>
    </tr>
  `;
}

function isCurrentUserAdmin() {
  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  const role = currentUser && currentUser.role ? currentUser.role.toLowerCase().trim() : '';
  return role === 'admin' || role === 'superadmin';
}

function updateColumnVisibilityUI() {
  const isAdmin = isCurrentUserAdmin();
  if (!isAdmin) {
    activeCols.clear();
    DEFAULT_ACTIVE_COLS.forEach(c => activeCols.add(c));
  }

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

function isColActive(key) {
  return activeCols.has(key);
}

function getNotepadWhatsAppCopyText() {
  if (currentDisplayedRows.length === 0) {
    return 'Work Financial & Delivery Summary - No records found.';
  }

  const lines = [];
  lines.push(`WORK FINANCIAL & DELIVERY SUMMARY`);
  lines.push(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);
  lines.push(`==============================`);
  lines.push('');

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

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  if (typeof UI !== 'undefined' && UI.toast) UI.toast('Summary copied to clipboard (readable WhatsApp/Notepad format)!', 'success');
}

// ══ ACTIVITY TAB LOGIC ══════════════════════════════════════════════════════
let actFromDate = new Date().toISOString().split('T')[0]; // Default to current date only
let actToDate = new Date().toISOString().split('T')[0];   // Default to current date only
let actPageFilter = 'ALL';                               // 'ALL' | 'Manage Work' | 'Customer'
let activitySearchText = '';

function formatActTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return String(iso);
  }
}

function getCombinedActivities() {
  const logged = (typeof DB !== 'undefined' && DB.getActivityLogs) ? DB.getActivityLogs() : [];

  const installments = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installments') || []) : [];
  const txns = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installment_txns') || []) : [];
  const remarks = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('installment_remarks') || []) : [];

  const existingIds = new Set(logged.map(l => l.recordId + '_' + l.date + '_' + l.table));
  const synthesized = [];

  // Synthesize txns
  txns.forEach(t => {
    const date = t.TxnDate || (t.CreatedAt ? t.CreatedAt.split('T')[0] : '');
    const cust = installments.find(x => Number(x.SlNo) === Number(t.SlNo));
    const custName = cust ? cust.Name : `Customer #${t.SlNo}`;
    const idKey = (t.TxnId || t.SlNo) + '_' + date + '_installment_txns';
    if (!existingIds.has(idKey) && date) {
      synthesized.push({
        id: 'synth_txn_' + (t.TxnId || t.SlNo || Math.random()),
        timestamp: t.CreatedAt || (date + 'T12:00:00Z'),
        date: date,
        time: '',
        page: 'Customer',
        table: 'installment_txns',
        action: 'INSERT',
        user: t.CreatedBy || 'Admin',
        userRole: 'Staff',
        recordId: t.SlNo,
        customerName: custName,
        changes: [
          { field: 'Payment Received (' + (t.TxnType || 'Customer') + ')', oldVal: null, newVal: '₹' + (Number(t.Amount) || 0).toLocaleString('en-IN') + (t.Mode ? ' via ' + t.Mode : '') + (t.Note ? ' - ' + t.Note : '') }
        ],
        isSynthesized: true,
        undone: false
      });
    }
  });

  // Synthesize remarks
  remarks.forEach(r => {
    const date = r.CreatedAt ? r.CreatedAt.split('T')[0] : '';
    const cust = installments.find(x => Number(x.SlNo) === Number(r.SlNo));
    const custName = cust ? cust.Name : `Customer #${r.SlNo}`;
    const idKey = (r.RemarkId || r.SlNo) + '_' + date + '_installment_remarks';
    if (!existingIds.has(idKey) && date) {
      synthesized.push({
        id: 'synth_rem_' + (r.RemarkId || r.SlNo || Math.random()),
        timestamp: r.CreatedAt || (date + 'T12:00:00Z'),
        date: date,
        time: '',
        page: 'Manage Work',
        table: 'installment_remarks',
        action: 'INSERT',
        user: r.Author || r.CreatedBy || 'Staff',
        userRole: 'Staff',
        recordId: r.SlNo,
        customerName: custName,
        changes: [
          { field: 'Remark / Comment Added', oldVal: null, newVal: r.RemarkText || r.Note || '' }
        ],
        isSynthesized: true,
        undone: false
      });
    }
  });

  return [...logged, ...synthesized];
}

function renderActivityTab() {
  const container = document.getElementById('activityTimelineContainer');
  const countBadge = document.getElementById('activityCountBadge');
  if (!container) return;

  const allActivities = getCombinedActivities();

  // 1. Filter by Date Range (Defaults strictly to current date)
  let filtered = allActivities.filter(act => {
    if (!act.date) return false;
    if (actFromDate && act.date < actFromDate) return false;
    if (actToDate && act.date > actToDate) return false;
    return true;
  });

  // 2. Filter by Page Source ('ALL', 'Manage Work', 'Customer')
  if (actPageFilter && actPageFilter !== 'ALL') {
    filtered = filtered.filter(act => act.page === actPageFilter);
  }

  // 3. Filter by Search Query
  if (activitySearchText) {
    const q = activitySearchText.toLowerCase();
    filtered = filtered.filter(act => {
      const matchCust = (act.customerName || '').toLowerCase().includes(q);
      const matchUser = (act.user || '').toLowerCase().includes(q) || (act.userRole || '').toLowerCase().includes(q);
      const matchPage = (act.page || '').toLowerCase().includes(q);
      const matchAction = (act.action || '').toLowerCase().includes(q);
      const matchChanges = (act.changes || []).some(c => 
        (c.field || '').toLowerCase().includes(q) ||
        String(c.oldVal || '').toLowerCase().includes(q) ||
        String(c.newVal || '').toLowerCase().includes(q)
      );
      return matchCust || matchUser || matchPage || matchAction || matchChanges;
    });
  }

  // Sort descending by timestamp / date
  filtered.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

  if (countBadge) {
    countBadge.textContent = `${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const rangeText = (actFromDate === actToDate && actFromDate === todayStr)
      ? "today (" + actFromDate + ")"
      : "selected range (" + (actFromDate || 'Start') + " to " + (actToDate || 'End') + ")";
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-secondary opacity-50 mb-2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="fw-semibold fs-7 text-dark mb-1">No database transactions found for ${rangeText}</div>
        <div class="fs-8 text-muted">Any updates, payments, or changes on Manage Work and Customer pages will appear here with instant Undo capability.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(act => {
    const isUndone = !!act.undone;
    const actionBadge = act.action === 'UPDATE' 
      ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle fs-9 px-2 py-0.5">UPDATE</span>'
      : act.action === 'INSERT'
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle fs-9 px-2 py-0.5">INSERT</span>'
      : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle fs-9 px-2 py-0.5">DELETE</span>';

    const pageBadge = act.page === 'Manage Work'
      ? '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle fs-9 px-2 py-0.5">Manage Work</span>'
      : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle fs-9 px-2 py-0.5">Customer</span>';

    const changesHtml = (act.changes || []).map(chg => {
      const fieldName = escapeHtml(chg.field);
      const oldValStr = chg.oldVal != null && chg.oldVal !== '' ? escapeHtml(String(chg.oldVal)) : '<em class="text-muted">(none)</em>';
      const newValStr = chg.newVal != null && chg.newVal !== '' ? escapeHtml(String(chg.newVal)) : '<em class="text-muted">(cleared)</em>';
      return `
        <div class="d-flex align-items-center flex-wrap gap-1.5 fs-8 py-0.5">
          <span class="fw-semibold text-secondary" style="min-width: 140px;">${fieldName}:</span>
          <span class="text-danger text-decoration-line-through bg-danger-subtle px-1.5 py-0.5 rounded">${oldValStr}</span>
          <span class="text-muted fs-9">➔</span>
          <span class="text-success fw-bold bg-success-subtle px-1.5 py-0.5 rounded">${newValStr}</span>
        </div>
      `;
    }).join('');

    const undoButtonHtml = act.isSynthesized 
      ? `<span class="badge bg-light text-muted border fs-9" title="Synthesized transaction before real-time logging">System Log</span>`
      : isUndone
      ? `<span class="badge bg-secondary-subtle text-secondary border fs-9 d-inline-flex align-items-center gap-1">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
           <span>Undone by ${escapeHtml(act.undoneBy || 'Admin')}</span>
         </span>`
      : `<button type="button" class="btn btn-sm btn-outline-danger btn-undo-activity py-0.5 px-2.5 fs-8 d-inline-flex align-items-center gap-1 shadow-none" data-act-id="${act.id}" title="Revert this database change directly">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
           <span>Undo</span>
         </button>`;

    return `
      <div class="card mb-2.5 border rounded-2 shadow-none ${isUndone ? 'opacity-75 bg-light-subtle' : 'bg-white'}" style="transition: all 0.15s ease;">
        <div class="card-body p-2.5">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1.5 pb-1.5 border-bottom">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              ${pageBadge}
              ${actionBadge}
              <span class="fw-bold text-dark fs-8">${escapeHtml(act.customerName || 'Customer')}</span>
              ${act.recordId ? `<span class="text-muted fs-9">#${escapeHtml(String(act.recordId))}</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-light text-secondary border fs-9 d-inline-flex align-items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>${escapeHtml(act.user || 'Admin')}</span>
                <small class="text-muted">(${escapeHtml(act.userRole || 'Admin')})</small>
              </span>
              <span class="text-muted fs-9">${formatActTimestamp(act.timestamp)}</span>
              ${undoButtonHtml}
            </div>
          </div>
          <div class="activity-changes-box ps-1">
            <div class="text-muted fs-9 fw-semibold mb-1 text-uppercase" style="letter-spacing: 0.03em;">Changes:</div>
            ${changesHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ══ MAIN INITIALIZATION ══════════════════════════════════════════════════════
window.onDbReady = function () {
  if (typeof UI !== 'undefined') {
    UI.renderSidebar('summary.html');
    UI.renderTopbar('Summary');
  }

  // Role-based Column Selection Control: Only Admin can customize columns; others see default columns only
  const isAdmin = isCurrentUserAdmin();
  const selectColsWrap = document.getElementById('selectColumnsDropdownWrap');
  if (selectColsWrap) {
    if (!isAdmin) {
      selectColsWrap.classList.add('d-none');
      selectColsWrap.style.display = 'none';
    } else {
      selectColsWrap.classList.remove('d-none');
      selectColsWrap.style.display = '';
    }
  }

  // Non-admin users strictly see only default columns
  if (!isAdmin) {
    activeCols.clear();
    DEFAULT_ACTIVE_COLS.forEach(c => activeCols.add(c));
  }

  // 1. Search Input Listener
  const fSearch = document.getElementById('fSumModalSearch');
  if (fSearch) {
    fSearch.addEventListener('input', () => {
      modalSearchText = (fSearch.value || '').toLowerCase().trim();
      updateAllModalFilterStats();
      renderSummaryTable();
    });
  }

  // 2. Clear Filters Button
  const btnClear = document.getElementById('btnSumClearFilters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (fSearch) fSearch.value = '';
      modalSearchText = '';
      modalSelectedPartners = [];
      modalSelectedDistricts = [];
      modalSelectedStage = 'ALL';
      modalSelectedPaymentFilters = [];
      document.querySelectorAll('.sum-partner-chk').forEach(c => c.checked = false);
      updateModalPartnerButton();
      updateAllModalFilterStats();
      renderSummaryTable();
    });
  }

  // 3. Columns Checklist Setup
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

  // 4. Restore All Excluded Customers Button
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

  // 5. Exclude Button Handler
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

  // 6. Master Table Checkbox
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

  // 7. Standalone Copy Button Handler
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

  // 8. Activity Tab Filters, Date Range & Real-time Undo Wireup
  const todayISO = new Date().toISOString().split('T')[0];
  const inActFrom = document.getElementById('actFromDate');
  const inActTo = document.getElementById('actToDate');

  if (inActFrom) {
    inActFrom.value = actFromDate || todayISO;
    inActFrom.addEventListener('change', () => {
      actFromDate = inActFrom.value;
      clearPresetActive();
      renderActivityTab();
    });
  }

  if (inActTo) {
    inActTo.value = actToDate || todayISO;
    inActTo.addEventListener('change', () => {
      actToDate = inActTo.value;
      clearPresetActive();
      renderActivityTab();
    });
  }

  function clearPresetActive() {
    document.querySelectorAll('#actDatePresets button').forEach(b => b.classList.remove('active'));
  }

  // Quick Date Range Presets
  const btnToday = document.getElementById('btnActPresetToday');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      clearPresetActive();
      btnToday.classList.add('active');
      const t = new Date().toISOString().split('T')[0];
      actFromDate = t;
      actToDate = t;
      if (inActFrom) inActFrom.value = t;
      if (inActTo) inActTo.value = t;
      renderActivityTab();
    });
  }

  const btnYesterday = document.getElementById('btnActPresetYesterday');
  if (btnYesterday) {
    btnYesterday.addEventListener('click', () => {
      clearPresetActive();
      btnYesterday.classList.add('active');
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      actFromDate = y;
      actToDate = y;
      if (inActFrom) inActFrom.value = y;
      if (inActTo) inActTo.value = y;
      renderActivityTab();
    });
  }

  const btn7Days = document.getElementById('btnActPreset7Days');
  if (btn7Days) {
    btn7Days.addEventListener('click', () => {
      clearPresetActive();
      btn7Days.classList.add('active');
      const t = new Date().toISOString().split('T')[0];
      const past7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      actFromDate = past7;
      actToDate = t;
      if (inActFrom) inActFrom.value = past7;
      if (inActTo) inActTo.value = t;
      renderActivityTab();
    });
  }

  const btnAll = document.getElementById('btnActPresetAll');
  if (btnAll) {
    btnAll.addEventListener('click', () => {
      clearPresetActive();
      btnAll.classList.add('active');
      actFromDate = '';
      actToDate = '';
      if (inActFrom) inActFrom.value = '';
      if (inActTo) inActTo.value = '';
      renderActivityTab();
    });
  }

  // Page Source Filter Buttons (All Pages / Manage Work / Customer)
  const actPageGroup = document.getElementById('activityPageFilter');
  if (actPageGroup) {
    actPageGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        actPageGroup.querySelectorAll('button').forEach(b => {
          b.classList.remove('active');
          if (b.classList.contains('btn-outline-primary')) b.className = 'btn btn-xs btn-outline-primary';
          else if (b.classList.contains('btn-outline-success')) b.className = 'btn btn-xs btn-outline-success';
          else b.className = 'btn btn-xs btn-outline-secondary';
        });
        btn.classList.add('active');
        actPageFilter = btn.getAttribute('data-act-page') || 'ALL';
        renderActivityTab();
      });
    });
  }

  // Search Input Filter
  const fActSearch = document.getElementById('fActivitySearch');
  if (fActSearch) {
    fActSearch.addEventListener('input', () => {
      activitySearchText = fActSearch.value.trim();
      renderActivityTab();
    });
  }

  // Direct Undo Event Delegation
  const timelineCont = document.getElementById('activityTimelineContainer');
  if (timelineCont) {
    timelineCont.addEventListener('click', async (e) => {
      const undoBtn = e.target.closest('.btn-undo-activity');
      if (!undoBtn) return;
      const actId = undoBtn.getAttribute('data-act-id');
      if (!actId) return;

      const confirmed = (typeof UI !== 'undefined' && UI.confirmDialog)
        ? await UI.confirmDialog({
            title: 'Revert Database Transaction',
            message: 'Are you sure you want to revert this database change? The previous values will be directly restored into the database.',
            okText: 'Yes, Undo Change',
            cancelText: 'Cancel'
          })
        : window.confirm('Are you sure you want to undo this transaction and revert the database?');

      if (!confirmed) return;

      try {
        undoBtn.disabled = true;
        undoBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        if (typeof DB !== 'undefined' && DB.undoActivity) {
          await DB.undoActivity(actId);
        }
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('Transaction successfully reverted and database restored!', 'success');
        }
        renderActivityTab();
        renderSummaryTable();
      } catch (err) {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast(err.message || 'Failed to undo transaction', 'danger');
        } else {
          alert('Failed to undo: ' + err.message);
        }
        renderActivityTab();
      }
    });
  }

  // Initialize both tabs
  populateModalPartners();
  updateAllModalFilterStats();
  renderSummaryTable();
  renderActivityTab();
};
