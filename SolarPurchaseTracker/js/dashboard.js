/* =========================================================================
   dashboard.js — Full Dashboard with Work Progress & Stage Tracking & Dynamic Filters
   ========================================================================= */

let dashSelectedDistricts = [];
let dashSelectedPartners = [];
let dashSelectedSummaryStage = 'ALL';
let dashSumSortCol = null;
let dashSumSortDir = 'desc';

window.onDbReady = function () {
  UI.renderSidebar('dashboard.html');
  UI.renderTopbar('Dashboard');

  // Search & Filter event listeners
  ['fDashSearch', 'chkDashShowDeactive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', Utils.debounce(renderDashboard, 200));
      el.addEventListener('change', renderDashboard);
    }
  });

  // Clear filters button
  const btnClear = document.getElementById('btnClearDashFilters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const searchEl = document.getElementById('fDashSearch');
      if (searchEl) searchEl.value = '';
      const chkDeactive = document.getElementById('chkDashShowDeactive');
      if (chkDeactive) chkDeactive.checked = false;

      dashSelectedDistricts = [];
      dashSelectedPartners = [];
      dashSelectedSummaryStage = 'ALL';
      populatePartnerDropdown();
      renderDashboard();
    });
  }

  // Reset Stage KPI filter button
  const btnResetKpi = document.getElementById('btnResetDashKpiFilter');
  if (btnResetKpi) {
    btnResetKpi.addEventListener('click', () => {
      dashSelectedSummaryStage = 'ALL';
      renderDashboard();
    });
  }

  // Attach sort listeners to table headers
  const thLogin = document.getElementById('thDashLogin');
  if (thLogin) {
    thLogin.onclick = () => {
      if (dashSumSortCol === 'Login') {
        dashSumSortDir = dashSumSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        dashSumSortCol = 'Login';
        dashSumSortDir = 'desc';
      }
      updateDashSortIcons();
      renderDashboard();
    };
  }

  const thAgreement = document.getElementById('thDashAgreement');
  if (thAgreement) {
    thAgreement.onclick = () => {
      if (dashSumSortCol === 'Agreement') {
        dashSumSortDir = dashSumSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        dashSumSortCol = 'Agreement';
        dashSumSortDir = 'desc';
      }
      updateDashSortIcons();
      renderDashboard();
    };
  }

  const thPartner = document.getElementById('thDashPartner');
  if (thPartner) {
    thPartner.onclick = () => {
      if (dashSumSortCol === 'Partner') {
        dashSumSortDir = dashSumSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        dashSumSortCol = 'Partner';
        dashSumSortDir = 'asc';
      }
      updateDashSortIcons();
      renderDashboard();
    };
  }

  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  const isPowerUser = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin'
  );

  const manageWorkWrap = document.getElementById('dashManageWorkBtnWrap');
  if (manageWorkWrap) {
    if (isPowerUser) {
      manageWorkWrap.style.removeProperty('display');
      manageWorkWrap.style.display = 'flex';
    } else {
      manageWorkWrap.style.display = 'none';
    }
  }

  populatePartnerDropdown();
  renderDashboard();
};

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

function populatePartnerDropdown() {
  const partnerMenu = document.getElementById('dashPartnerMultiselectMenu');
  if (!partnerMenu) return;

  const allRows = getWorkRows();
  const rawPartners = allRows
    .map(r => (r.BrokerName || '').trim())
    .filter(p => p !== '' && p !== 'null' && p !== 'undefined');
  const uniquePartners = [...new Set(rawPartners)].sort();

  partnerMenu.innerHTML = [
    `<div class="form-check mb-1">
       <input class="form-check-input dash-partner-chk" type="checkbox" value="(No Partner)" id="chk_dash_nopartner" ${dashSelectedPartners.includes('(No Partner)') ? 'checked' : ''}>
       <label class="form-check-label w-100 fs-8" for="chk_dash_nopartner">(No Partner)</label>
     </div>`
  ].concat(
    uniquePartners.map(p => `
      <div class="form-check mb-1">
        <input class="form-check-input dash-partner-chk" type="checkbox" value="${p}" id="chk_dash_partner_${p.replace(/\s+/g, '_')}" ${dashSelectedPartners.includes(p) ? 'checked' : ''}>
        <label class="form-check-label w-100 fs-8" for="chk_dash_partner_${p.replace(/\s+/g, '_')}">${p}</label>
      </div>
    `)
  ).join('');

  document.querySelectorAll('.dash-partner-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      dashSelectedPartners = Array.from(document.querySelectorAll('.dash-partner-chk:checked')).map(c => c.value);
      updatePartnerDropdownButton();
      renderDashboard();
    });
  });

  updatePartnerDropdownButton();
}

function updatePartnerDropdownButton() {
  const lbl = document.getElementById('txtDashPartnerLabel');
  if (!lbl) return;
  if (dashSelectedPartners.length === 0) {
    lbl.textContent = 'All Partners';
  } else if (dashSelectedPartners.length === 1) {
    lbl.textContent = dashSelectedPartners[0];
  } else {
    lbl.textContent = `${dashSelectedPartners.length} Partners`;
  }
}

window.toggleDistrictBadgeFilter = function (dist, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (dist === 'ALL' || dist === 'Total') {
    dashSelectedDistricts = [];
  } else {
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const idx = dashSelectedDistricts.indexOf(targetDist);
    if (idx > -1) {
      dashSelectedDistricts.splice(idx, 1);
    } else {
      dashSelectedDistricts.push(targetDist);
    }
  }
  renderDashboard();
};

function updateDistrictStats() {
  const container = document.getElementById('dashDistrictStatsContainer');
  if (!container) return;

  const allRows = getWorkRows();
  const showDeactive = document.getElementById('chkDashShowDeactive') ? document.getElementById('chkDashShowDeactive').checked : false;
  let activeRows = allRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');

  // Filter by search text
  const search = (document.getElementById('fDashSearch') ? document.getElementById('fDashSearch').value : '').toLowerCase().trim();
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
  if (dashSelectedPartners.length > 0) {
    activeRows = activeRows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return dashSelectedPartners.includes(partnerName);
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

  const isTotalActive = dashSelectedDistricts.length === 0;
  const totalBadge = `<button type="button" onclick="window.toggleDistrictBadgeFilter('ALL', event)" class="erp-tag ${isTotalActive ? 'active' : ''}" title="Show all districts">Total: ${totalCount}</button>`;

  const districtBadges = sortedDistricts.map((dist) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = dashSelectedDistricts.includes(targetDist);
    const safeDist = dist.replace(/'/g, "\\'");

    return `<button type="button" onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="erp-tag ${isSelected ? 'active' : ''}" title="Filter by ${dist}">${dist} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + districtBadges;
}

function getDelayInfo(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(/[-/]/);
  if (parts.length < 3) return null;
  let d, m, y;
  if (parts[0].length === 4) {
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  const dateObj = new Date(y, m, d);
  if (isNaN(dateObj.getTime())) return null;

  const now = new Date();
  const diffTime = now.getTime() - dateObj.getTime();
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (totalDays < 0) return { months: 0, days: 0, text: 'Today', totalDays: 0 };

  const months = Math.floor(totalDays / 30.4375);
  const remainingDays = Math.floor(totalDays % 30.4375);

  let text = '';
  if (months > 0 && remainingDays > 0) {
    text = `${months}m ${remainingDays}d ago`;
  } else if (months > 0) {
    text = `${months}m ago`;
  } else {
    text = `${totalDays}d ago`;
  }
  return { months, days: remainingDays, text, totalDays };
}

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
  let alertScore = 0;
  let delayDays = loginDelay ? loginDelay.totalDays : -999;

  if (highestIdx === 0 && loginDelay) {
    if (loginDelay.totalDays >= 90) {
      alertScore = 3; // RED (>= 3 months)
    } else if (loginDelay.totalDays >= 60) {
      alertScore = 2; // YELLOW (>= 2 months)
    } else {
      alertScore = 1; // BLUE
    }
  } else if (highestIdx > 0) {
    alertScore = 0.5;
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

  let alertScore = 0;
  let delayDays = agrmtDelay ? agrmtDelay.totalDays : -999;

  if (highestIdx >= 1) {
    if (isEligibleForAlert && agrmtDelay && agrmtDelay.totalDays >= 90) {
      alertScore = 3; // RED (>= 3 months)
    } else if (isEligibleForAlert && agrmtDelay && agrmtDelay.totalDays >= 60) {
      alertScore = 2; // YELLOW (>= 2 months)
    } else {
      alertScore = 1; // BLUE
    }
  }

  return { alertScore, delayDays };
}

function renderDashboard() {
  updateDistrictStats();

  const search = (document.getElementById('fDashSearch')?.value || '').toLowerCase().trim();
  const showDeactive = document.getElementById('chkDashShowDeactive')?.checked || false;

  let allWorkRows = getWorkRows();

  // Active / Deactive filter
  let baseRows = allWorkRows.filter(r => showDeactive ? r.Status === 'Deactive' : r.Status !== 'Deactive');

  // Apply search
  if (search) {
    baseRows = baseRows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || r.MobileNo || '').toLowerCase().includes(search) ||
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

  // Apply district filter
  if (dashSelectedDistricts.length > 0) {
    baseRows = baseRows.filter(r => {
      const distVal = r.District ? r.District.trim() : '(No District)';
      const distName = distVal === '' ? '(No District)' : distVal;
      return dashSelectedDistricts.includes(distName);
    });
  }

  // Apply partner filter
  if (dashSelectedPartners.length > 0) {
    baseRows = baseRows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return dashSelectedPartners.includes(partnerName);
    });
  }

  // Calculate Stage Counts on the filtered baseRows
  const total = baseRows.length;
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

  baseRows.forEach(r => {
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

  // Render 9 KPI Grid Cards
  const kpiGrid = document.getElementById('dashWorkKpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <!-- Total -->
      <div class="mw-kpi-card border-start border-3 border-dark ${dashSelectedSummaryStage === 'ALL' ? 'kpi-card-selected' : ''}" data-stage="ALL" title="Click to show all customers">
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
      <div class="mw-kpi-card border-start border-3 ${dashSelectedSummaryStage === 'LoginDate' ? 'kpi-card-selected' : ''}" style="border-color: #0284c7 !important;" data-stage="LoginDate" title="Click to filter by Login stage">
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
      <div class="mw-kpi-card border-start border-3 border-primary ${dashSelectedSummaryStage === 'AgreementDate' ? 'kpi-card-selected' : ''}" data-stage="AgreementDate" title="Click to filter by Agreement stage">
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
      <div class="mw-kpi-card border-start border-3 border-info ${dashSelectedSummaryStage === 'MaterialDispatchedDate' ? 'kpi-card-selected' : ''}" data-stage="MaterialDispatchedDate" title="Click to filter by Dispatched stage">
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
      <div class="mw-kpi-card border-start border-3 border-warning ${dashSelectedSummaryStage === 'InstallationDate' ? 'kpi-card-selected' : ''}" data-stage="InstallationDate" title="Click to filter by Installation stage">
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
      <div class="mw-kpi-card border-start border-3 ${dashSelectedSummaryStage === 'NetMeter' ? 'kpi-card-selected' : ''}" style="border-color: #8b5cf6 !important;" data-stage="NetMeter" title="Click to filter by NetMeter stage">
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
      <div class="mw-kpi-card border-start border-3 border-secondary ${dashSelectedSummaryStage === 'InspectionDate' ? 'kpi-card-selected' : ''}" data-stage="InspectionDate" title="Click to filter by Inspection stage">
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
      <div class="mw-kpi-card border-start border-3 border-primary ${dashSelectedSummaryStage === 'MeterConnectedDate' ? 'kpi-card-selected' : ''}" data-stage="MeterConnectedDate" title="Click to filter by Connection stage">
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

      <!-- Subsidy -->
      <div class="mw-kpi-card border-start border-3 border-success ${dashSelectedSummaryStage === 'CommissioningDate' ? 'kpi-card-selected' : ''}" data-stage="CommissioningDate" title="Click to filter by Subsidy stage">
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

    kpiGrid.querySelectorAll('.mw-kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const stage = card.getAttribute('data-stage') || 'ALL';
        if (dashSelectedSummaryStage === stage && stage !== 'ALL') {
          dashSelectedSummaryStage = 'ALL';
        } else {
          dashSelectedSummaryStage = stage;
        }

        kpiGrid.querySelectorAll('.mw-kpi-card').forEach(c => {
          c.classList.remove('kpi-card-selected');
          if (c.getAttribute('data-stage') === dashSelectedSummaryStage) {
            c.classList.add('kpi-card-selected');
          }
        });

        renderDashboard();
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

  let displayRows = [...baseRows];

  // Filter strictly by selected stage (if clicked on a KPI card)
  if (dashSelectedSummaryStage && dashSelectedSummaryStage !== 'ALL') {
    const targetStageIdx = stageKeys.indexOf(dashSelectedSummaryStage);
    displayRows = displayRows.filter(r => {
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

  const resetBtn = document.getElementById('btnResetDashKpiFilter');
  if (resetBtn) {
    resetBtn.style.display = (dashSelectedSummaryStage !== 'ALL') ? 'inline-block' : 'none';
  }

  // Sorting
  if (dashSumSortCol === 'Login') {
    displayRows.sort((a, b) => {
      const scoreA = getLoginSortScore(a);
      const scoreB = getLoginSortScore(b);
      if (scoreA.alertScore !== scoreB.alertScore) {
        return dashSumSortDir === 'desc'
          ? scoreB.alertScore - scoreA.alertScore
          : scoreA.alertScore - scoreB.alertScore;
      }
      return dashSumSortDir === 'desc'
        ? scoreB.delayDays - scoreA.delayDays
        : scoreA.delayDays - scoreB.delayDays;
    });
  } else if (dashSumSortCol === 'Agreement') {
    displayRows.sort((a, b) => {
      const scoreA = getAgreementSortScore(a);
      const scoreB = getAgreementSortScore(b);
      if (scoreA.alertScore !== scoreB.alertScore) {
        return dashSumSortDir === 'desc'
          ? scoreB.alertScore - scoreA.alertScore
          : scoreA.alertScore - scoreB.alertScore;
      }
      return dashSumSortDir === 'desc'
        ? scoreB.delayDays - scoreA.delayDays
        : scoreA.delayDays - scoreB.delayDays;
    });
  } else if (dashSumSortCol === 'Partner') {
    displayRows.sort((a, b) => {
      const pA = String(a.BrokerName || 'Direct').toLowerCase().trim();
      const pB = String(b.BrokerName || 'Direct').toLowerCase().trim();
      return dashSumSortDir === 'asc' ? pA.localeCompare(pB) : pB.localeCompare(pA);
    });
  } else {
    // Default sorting: Subsidy ON at bottom, then by SlNo
    displayRows.sort((a, b) => {
      const aSubsidy = Boolean(a.CommissioningDate);
      const bSubsidy = Boolean(b.CommissioningDate);
      if (aSubsidy !== bSubsidy) {
        return aSubsidy ? 1 : -1;
      }
      return (Number(a.SlNo) || 0) - (Number(b.SlNo) || 0);
    });
  }

  const countBadge = document.getElementById('dashSumRowCount');
  if (countBadge) {
    countBadge.textContent = `${displayRows.length} of ${allWorkRows.length} customers`;
  }

  // Render Table Rows
  const tbody = document.querySelector('#dashWorkSummaryTable tbody');
  if (tbody) {
    if (!displayRows.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-5 text-muted fs-7">No records matching filter.</td></tr>`;
      return;
    }
    tbody.innerHTML = displayRows.map((r, i) => {
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

      const safeId = encodeURIComponent(r.ConsumerNo || r.SlNo || i);

      return `
        <tr onclick="openCustomerDetailsFromDash('${safeId}')" title="Click to view Customer Details">
          <td class="td-col-sl text-center text-muted">${r.SlNo || (i + 1)}</td>
          <td class="td-col-cust">
            <span class="mw-sum-cust-name text-primary fw-bold" title="${r.Name || '-'}">${r.Name || '-'}</span>
            ${r.ConsumerNo ? `<small class="text-muted d-block fs-9">${r.ConsumerNo}</small>` : ''}
          </td>
          <td class="td-col-partner">
            <span class="badge bg-light text-secondary border fw-normal mw-sum-partner-badge" title="${r.BrokerName || 'Direct'}">${r.BrokerName || 'Direct'}</span>
          </td>
          ${stageCellsHtml}
        </tr>
      `;
    }).join('');
  }
}

function updateDashSortIcons() {
  const thLogin = document.getElementById('thDashLogin');
  const thAgreement = document.getElementById('thDashAgreement');
  const thPartner = document.getElementById('thDashPartner');
  const sortIconLogin = document.getElementById('sortIconDashLogin');
  const sortIconAgreement = document.getElementById('sortIconDashAgreement');
  const sortIconPartner = document.getElementById('sortIconDashPartner');

  if (thLogin && sortIconLogin) {
    if (dashSumSortCol === 'Login') {
      thLogin.classList.add('sort-active');
      sortIconLogin.className = dashSumSortDir === 'desc'
        ? 'bi bi-sort-down fs-9 ms-0.5 text-primary'
        : 'bi bi-sort-up fs-9 ms-0.5 text-primary';
    } else {
      thLogin.classList.remove('sort-active');
      sortIconLogin.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
    }
  }

  if (thAgreement && sortIconAgreement) {
    if (dashSumSortCol === 'Agreement') {
      thAgreement.classList.add('sort-active');
      sortIconAgreement.className = dashSumSortDir === 'desc'
        ? 'bi bi-sort-down fs-9 ms-0.5 text-primary'
        : 'bi bi-sort-up fs-9 ms-0.5 text-primary';
    } else {
      thAgreement.classList.remove('sort-active');
      sortIconAgreement.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
    }
  }

  if (thPartner && sortIconPartner) {
    if (dashSumSortCol === 'Partner') {
      thPartner.classList.add('sort-active');
      sortIconPartner.className = dashSumSortDir === 'asc'
        ? 'bi bi-sort-alpha-down fs-9 ms-0.5 text-primary'
        : 'bi bi-sort-alpha-up-alt fs-9 ms-0.5 text-primary';
    } else {
      thPartner.classList.remove('sort-active');
      sortIconPartner.className = 'bi bi-arrow-down-up fs-9 ms-0.5 opacity-50';
    }
  }
}

window.openCustomerDetailsFromDash = function (safeId) {
  const targetId = decodeURIComponent(safeId);
  const customers = getWorkRows();
  const r = customers.find(c => String(c.ConsumerNo) === targetId || String(c.SlNo) === targetId);
  if (!r) return;

  const slEl = document.getElementById('cdModalSlNo');
  const titleEl = document.getElementById('cdModalTitle');
  const statusEl = document.getElementById('cdModalStatus');
  const bodyEl = document.getElementById('cdModalBody');

  if (slEl) slEl.textContent = `#${r.SlNo || '-'}`;
  if (titleEl) titleEl.textContent = r.Name || 'Customer Details';
  if (statusEl) {
    const isDeactive = r.Status === 'Deactive';
    statusEl.textContent = isDeactive ? 'Deactive' : 'Active';
    statusEl.className = `badge ${isDeactive ? 'bg-danger' : 'bg-success'} ms-1`;
  }

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="row g-2">
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">Consumer No</span>
            <span class="fw-bold fs-7">${r.ConsumerNo || '-'}</span>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">Mobile No</span>
            <span class="fw-bold fs-7">${r.MobileNumber || r.MobileNo || '-'}</span>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">District / City</span>
            <span class="fw-bold fs-7">${r.District || '-'}</span>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">Partner (Broker)</span>
            <span class="fw-bold fs-7">${r.BrokerName || 'Direct'}</span>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">Plant Capacity</span>
            <span class="fw-bold fs-7 text-primary">${r.PlantCapacity ? r.PlantCapacity + ' kW' : '-'}</span>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-2 border rounded bg-light">
            <span class="text-muted fs-8 d-block">Total Project Price</span>
            <span class="fw-bold fs-7 text-success">${r.TotalPrice ? '₹' + Number(r.TotalPrice).toLocaleString('en-IN') : (r.Total ? '₹' + Number(r.Total).toLocaleString('en-IN') : '-')}</span>
          </div>
        </div>
      </div>

      <div class="mt-2">
        <h6 class="fw-bold fs-8 text-secondary text-uppercase mb-2">Stage Progression Dates</h6>
        <div class="table-responsive border rounded">
          <table class="table table-sm table-striped mb-0 fs-8">
            <tbody>
              <tr><td class="text-muted">1. Login Date</td><td class="fw-semibold">${r.LoginDate || '-'}</td></tr>
              <tr><td class="text-muted">2. Agreement Date</td><td class="fw-semibold">${r.AgreementDate || '-'}</td></tr>
              <tr><td class="text-muted">3. Dispatch Date</td><td class="fw-semibold">${r.MaterialDispatchedDate || '-'}</td></tr>
              <tr><td class="text-muted">4. Installation Date</td><td class="fw-semibold">${r.InstallationDate || '-'}</td></tr>
              <tr><td class="text-muted">5. Net Meter Status</td><td class="fw-semibold">${r.NetMeterDate || (r.NetMeterPaid ? 'Paid' : '-')}</td></tr>
              <tr><td class="text-muted">6. Inspection Date</td><td class="fw-semibold">${r.InspectionDate || '-'}</td></tr>
              <tr><td class="text-muted">7. Connection Date</td><td class="fw-semibold">${r.MeterConnectedDate || '-'}</td></tr>
              <tr><td class="text-muted">8. Subsidy / Comm. Date</td><td class="fw-semibold">${r.CommissioningDate || '-'}</td></tr>
            </tbody>
          </table>
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
