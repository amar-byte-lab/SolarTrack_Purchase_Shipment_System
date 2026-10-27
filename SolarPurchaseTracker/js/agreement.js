/* =========================================================================
   agreement.js — Agreement Word Document (.docx) Generator
   ========================================================================= */

let selectedCustomerSlNo = null;
let selectedDistrict = 'ALL';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

document.addEventListener('DOMContentLoaded', async () => {
  UI.renderSidebar('document.html');
  UI.renderTopbar('Documents & Forms');

  UI.showLoading(true);

  const waitForDB = () => new Promise((resolve) => {
    if (typeof DB !== 'undefined' && DB.isReady()) { resolve(); return; }
    const p = setInterval(() => {
      if (typeof DB !== 'undefined' && DB.isReady()) {
        clearInterval(p);
        resolve();
      }
    }, 50);
  });

  window.onDbReady = function() {
    updateDistrictStats();
    renderCustomerDirectory();
    UI.showLoading(false);
  };

  try {
    await waitForDB();
    updateDistrictStats();
    renderCustomerDirectory();
  } catch (err) {
    console.error('Error initializing Agreement page:', err);
    UI.toast('Error loading database: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
});

function getInstallmentRows() {
  return DB.getAll('installments') || [];
}

function updateDistrictStats() {
  const container = document.getElementById('districtStatsContainer');
  if (!container) return;

  const allRows = DB.getAll('installments') || [];
  const activeRows = allRows.filter(r => r.Status !== 'Deactive');
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

  const isTotalActive = selectedDistrict === 'ALL';
  const totalBadge = `<button type="button" onclick="window.toggleDistrictBadgeFilter('ALL')" class="erp-tag ${isTotalActive ? 'active' : ''}" title="Show all districts">Total: ${totalCount}</button>`;

  const districtBadges = sortedDistricts.map((dist) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistrict === targetDist;
    const safeDist = targetDist.replace(/'/g, "\\'");

    return `<button type="button" onclick="window.toggleDistrictBadgeFilter('${safeDist}')" class="erp-tag ${isSelected ? 'active' : ''}" title="Filter by ${dist}">${dist} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + districtBadges;
}

window.toggleDistrictBadgeFilter = function(dist) {
  if (selectedDistrict === dist || dist === 'ALL') {
    selectedDistrict = 'ALL';
  } else {
    selectedDistrict = dist;
  }
  updateDistrictStats();
  const searchQuery = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(searchQuery);
};

function renderCustomerDirectory(filter = '') {
  const container = document.getElementById('customerListContainer');
  const countBadge = document.getElementById('customerCountBadge');
  if (!container) return;

  const search = (filter || '').toLowerCase().trim();
  let rows = getInstallmentRows().filter(r => r.Status !== 'Deactive');

  // Filter by selected district badge
  if (selectedDistrict && selectedDistrict !== 'ALL') {
    rows = rows.filter(r => {
      const d = r.District ? r.District.trim() : '';
      if (selectedDistrict === '(No District)') return !d;
      return d.toLowerCase() === selectedDistrict.toLowerCase();
    });
  }

  // Filter by text search
  if (search) {
    rows = rows.filter(r => 
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search)
    );
  }

  if (countBadge) {
    countBadge.textContent = `${rows.length} Customer${rows.length === 1 ? '' : 's'}`;
  }

  if (rows.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-4 fs-8">No customers found ${search ? 'matching "' + filter + '"' : ''}.</div>`;
    return;
  }

  container.innerHTML = rows.map(r => {
    const distStr = r.District ? ` (${r.District})` : ' (No District)';
    const isActive = selectedCustomerSlNo === Number(r.SlNo);
    const activeClass = isActive ? 'active' : '';

    return `
      <div class="customer-list-item d-flex justify-content-between align-items-center ${activeClass}" 
           onclick="selectCustomerForAgreement(${r.SlNo})">
        <div class="d-flex flex-column text-truncate pe-2">
          <span class="text-dark fs-7 text-truncate">${r.Name || 'Unnamed'}<span class="text-muted font-monospace fs-8">${distStr}</span></span>
          <small class="text-muted fs-8">Consumer No: ${r.ConsumerNo || '—'}</small>
        </div>
        <span class="text-muted d-flex align-items-center">${UI.icon('chevron-right', 13)}</span>
      </div>
    `;
  }).join('');

  // Auto-select first customer if none is currently selected
  if (!selectedCustomerSlNo && rows.length > 0) {
    selectCustomerForAgreement(rows[0].SlNo);
  }
}

window.onAgreementSearchInput = function() {
  const query = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(query);
};

window.selectCustomerForAgreement = function(slNo) {
  selectedCustomerSlNo = Number(slNo);

  const rows = getInstallmentRows();
  const r = rows.find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  // Re-render directory list to highlight active item
  const searchQuery = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(searchQuery);

  // 1. Populate Agreement Tab (.docx)
  document.getElementById('agrName').value = r.Name || '';
  document.getElementById('agrConsumerNo').value = r.ConsumerNo || '';
  const agrConsumerLabel = document.getElementById('agrConsumerNameLabel');
  if (agrConsumerLabel) agrConsumerLabel.textContent = r.Name || '—';

  const addrParts = [];
  if (r.Address) addrParts.push(r.Address);
  if (r.District) addrParts.push(`District: ${r.District}`);
  addrParts.push(`State: ${r.State || 'Odisha'}`);
  if (r.PinCode) addrParts.push(`Pin: ${r.PinCode}`);
  
  const fullAddressUpper = (addrParts.join(', ') || '').toUpperCase();
  document.getElementById('agrAddress').value = fullAddressUpper;

  // 2. Populate Form 1 Tab (Application) with customer data
  if (typeof populateForm1Fields === 'function') populateForm1Fields(r);

  // 3. Populate Form 3 Tab (Inspection Report) with customer data
  if (typeof populateForm3Fields === 'function') populateForm3Fields(r);

  // 4. Populate Form 4 Tab with THIS RESPECTIVE CUSTOMER'S exact data
  populateForm4Fields(r);

  // 5. Populate Form 6 Tab (Inspection Report) with exact customer data
  populateForm6Fields(r);

  UI.toast(`Auto-filled details for ${r.Name}`, 'info');

  // Mobile UX: smoothly scroll to document tab so user doesn't have to scroll past the directory
  if (window.innerWidth < 992) {
    const tabsEl = document.getElementById('docTabs');
    if (tabsEl) {
      setTimeout(() => {
        tabsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
};

window.resetAgreementForm = function() {
  selectedCustomerSlNo = null;
  selectedDistrict = 'ALL';
  updateDistrictStats();
  document.getElementById('agreementForm').reset();
  const agrConsumerLabel = document.getElementById('agrConsumerNameLabel');
  if (agrConsumerLabel) agrConsumerLabel.textContent = '—';
  const searchQuery = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(searchQuery);
  if (typeof resetForm1Fields === 'function') resetForm1Fields();
  if (typeof resetForm3Fields === 'function') resetForm3Fields();
  resetForm4Fields();
  resetForm6Fields();
};

/* ════════════════════════════════════════════════════════════════════════════
   Form 4: Work Completion Report Logic & PDF Generator
   ════════════════════════════════════════════════════════════════════════════ */

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

function getInputVal(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? (el.value.trim() || fallback) : fallback;
}

function formatDateToMonthWord(dStr) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (_) {
    return dStr;
  }
}

function formatDateToDdMmYyyy(dStr) { return formatDateToDash(dStr); }

function formatDateToDash(dStr) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (_) {
    return dStr;
  }
}

function getDiscomName(district, circle) {
  const combined = `${district || ''} ${circle || ''}`.trim().toLowerCase();
  if (['tpnodl', 'nodl', 'balasore', 'bhadrak', 'jajpur', 'keonjhar', 'mayurbhanj', 'baripada'].some(x => combined.includes(x))) {
    return 'TPNODL';
  }
  if (['tpcodl', 'codl', 'cuttack', 'puri', 'khurda', 'bhubaneswar', 'nayagarh', 'kendrapara', 'jagatsinghpur', 'dhenkanal', 'angul'].some(x => combined.includes(x))) {
    return 'TPCODL';
  }
  if (['tpwodl', 'wodl', 'sambalpur', 'bargarh', 'jharsuguda', 'deogarh', 'sundargarh', 'rourkela', 'bolangir', 'balangir', 'sonepur', 'subarnapur'].some(x => combined.includes(x))) {
    return 'TPWODL';
  }
  if (['tpsodl', 'sodl', 'ganjam', 'berhampur', 'gajapati', 'koraput', 'rayagada', 'nabarangpur', 'malkangiri', 'kalahandi', 'nuapada', 'kandhamal', 'boudh'].some(x => combined.includes(x))) {
    return 'TPSODL';
  }
  return 'TPNODL';
}

function getDiscomFullName(shortName) {
  const s = String(shortName || '').toUpperCase();
  if (s.includes('NODL')) return 'TP NORTHERN ODISHA DISTRIBUTION LIMITED';
  if (s.includes('CODL')) return 'TP CENTRAL ODISHA DISTRIBUTION LIMITED';
  if (s.includes('WODL')) return 'TP WESTERN ODISHA DISTRIBUTION LIMITED';
  if (s.includes('SODL')) return 'TP SOUTHERN ODISHA DISTRIBUTION LIMITED';
  return 'TP NORTHERN ODISHA DISTRIBUTION LIMITED';
}

function getDiscomCircleByDistrict(district) {
  return getDiscomName(district, '');
}

function formatWithUnit(val, defaultVal, unitType) {
  let str = (val !== undefined && val !== null && String(val).trim()) ? String(val).trim() : (defaultVal || '');
  if (!str) return '';
  switch (unitType) {
    case 'moduleCap':
      if (/^\d+(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        return num > 10 ? `${num} Wp` : `${num} kWp`;
      }
      return str;
    case 'voltDc':
      if (/^\d+(\.\d+)?$/.test(str)) return `${str}V DC`;
      if (!str.toUpperCase().includes('V')) str += 'V';
      if (!str.toUpperCase().includes('DC')) str += ' DC';
      return str;
    case 'voltAc':
      if (/^\d+([-\s]\d+)?$/.test(str)) return `${str}V AC`;
      if (!str.toUpperCase().includes('V')) str += 'V';
      if (!str.toUpperCase().includes('AC')) str += ' AC';
      return str;
    case 'cableSize':
      if (/^\d+(\.\d+)?$/.test(str)) return `${str} SQ MM`;
      if (!str.toUpperCase().includes('SQ') && !str.toUpperCase().includes('MM')) return `${str} SQ MM`;
      return str;
    case 'earthWire':
      if (/^\d+(\.\d+)?$/.test(str)) return `${str} SQ MM Aluminum`;
      if (!str.toUpperCase().includes('SQ') && !str.toUpperCase().includes('MM')) return `${str} SQ MM`;
      return str;
    case 'earthRes':
      if (/^\d+(\.\d+)?$/.test(str)) return `${str} OHM`;
      if (!str.toUpperCase().includes('OHM') && !str.includes('Ω')) return `${str} OHM`;
      return str;
    default:
      return str;
  }
}

function parseBrand(committedBrand) {
  if (!committedBrand) return { moduleMake: 'LUMINOUS', inverterMake: 'LUMINOUS' };
  const str = String(committedBrand).trim();
  let moduleMake = 'LUMINOUS';
  let inverterMake = 'LUMINOUS';
  
  if (str.includes('M:') || str.includes('Inv:')) {
    const mMatch = str.match(/M:\s*([^|]+)/i);
    const invMatch = str.match(/Inv:\s*([^|]+)/i);
    if (mMatch) moduleMake = mMatch[1].trim();
    if (invMatch) inverterMake = invMatch[1].trim();
  } else {
    moduleMake = str;
    inverterMake = str;
  }
  return { moduleMake, inverterMake };
}

function calculateModulesCount(capVal) {
  if (!capVal) return '6 Nos';
  const num = parseFloat(String(capVal).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return '6 Nos';
  // Standard modules are ~550 Wp
  const count = Math.max(1, Math.round((num * 1000) / 550));
  return `${count} Nos`;
}

function getOrGenerateSerials(r, specs, moduleCountStr, moduleMake) {
  const pv = specs.PvModule || {};
  if (Array.isArray(pv.SerialNumbers) && pv.SerialNumbers.length > 0) {
    const valid = pv.SerialNumbers.filter(s => s && s.trim());
    if (valid.length > 0) return valid;
  }
  const count = parseInt(String(moduleCountStr).replace(/[^0-9]/g, ''), 10) || 6;
  const seed = String(r.ConsumerNo || r.ApplicationNumber || r.SlNo || '1001').replace(/[^0-9]/g, '').slice(-4).padStart(4, '0');
  const prefix = (moduleMake || 'LUM').slice(0, 3).toUpperCase();
  const serials = [];
  for (let i = 1; i <= count; i++) {
    const idx = String(i).padStart(2, '0');
    serials.push(`86QJ${prefix}${seed}${idx}`);
  }
  return serials;
}

function getOrGenerateInverterSerial(r, specs, inverterMake) {
  const inv = specs.GridTiedInverter || {};
  if (inv.SerialNo && inv.SerialNo.trim()) return inv.SerialNo.trim();
  const seed = String(r.ConsumerNo || r.ApplicationNumber || r.SlNo || '1001').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0');
  const prefix = (inverterMake || 'LUM').slice(0, 3).toUpperCase();
  return `G7QG${prefix}${seed}`;
}

/* ── Form 4 Dynamic Module Serials & Capacities ───────────────────────────── */

window.renderF4ModuleSerialInputs = function(initialSerials = null, initialCapacities = null, fallbackCap = null) {
  const countInput = document.getElementById('f4ModuleCount');
  const container = document.getElementById('f4ModuleSerialInputsContainer');
  const badge = document.getElementById('lblF4ModuleSerialCountBadge');
  if (!container) return;

  const count = Math.max(0, parseInt(String(countInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0);
  if (badge) badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;

  if (count === 0) {
    container.innerHTML = '<div class="col-12 text-muted fs-8 fst-italic py-2 text-center">Enter "No. of Modules" above to generate serial number and capacity textboxes.</div>';
    window.syncF4ModuleSerialsAndCaps();
    return;
  }

  // Preserve existing entered values if not provided
  let existingSerials = [];
  let existingCaps = [];
  if (initialSerials && Array.isArray(initialSerials)) {
    existingSerials = initialSerials;
  } else {
    container.querySelectorAll('.f4-module-serial-box').forEach((box, i) => {
      existingSerials[i] = box.value;
    });
  }

  if (initialCapacities && Array.isArray(initialCapacities)) {
    existingCaps = initialCapacities;
  } else {
    container.querySelectorAll('.f4-module-cap-box').forEach((box, i) => {
      existingCaps[i] = box.value;
    });
  }

  // Fallback capacity extraction from argument or hidden input
  let defaultCapVal = '';
  const capSrc = fallbackCap || document.getElementById('f4ModuleCapacityEach')?.value || '';
  const match = String(capSrc).match(/([0-9.]+)/);
  if (match) defaultCapVal = match[1];

  let html = '';
  for (let i = 1; i <= count; i++) {
    const sVal = existingSerials[i - 1] || '';
    let cVal = existingCaps[i - 1] || '';
    if (!cVal && defaultCapVal) {
      cVal = defaultCapVal;
    }

    html += `
      <div class="col-md-6 col-12">
        <div class="input-group input-group-sm f4-module-row-group">
          <span class="input-group-text bg-light text-muted fs-8 font-monospace px-2" style="min-width: 32px; justify-content: center;">#${i}</span>
          <input type="text" class="form-control form-control-sm fs-8 font-monospace f4-module-serial-box" id="f4ModuleSerial_${i}" data-index="${i}" value="${escapeHtml(sVal)}" placeholder="Serial No. ${i}" title="Module ${i} Serial Number" oninput="window.syncF4ModuleSerialsAndCaps()">
          <input type="number" min="0" step="any" class="form-control form-control-sm fs-8 f4-module-cap-box text-end fw-semibold" id="f4ModuleCap_${i}" data-index="${i}" value="${escapeHtml(cVal)}" placeholder="550" style="max-width: 82px;" oninput="window.handleF4ModuleCapChange(${i})" title="Module ${i} Capacity in Wp">
          <span class="input-group-text bg-light text-muted fs-8 px-1.5 border-start-0" style="font-size: 0.70rem; min-width: 32px; justify-content: center;">Wp</span>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  window.syncF4ModuleSerialsAndCaps();
};

window.handleF4ModuleCapChange = function(index) {
  if (index === 1) {
    const firstBox = document.getElementById('f4ModuleCap_1');
    const val = firstBox ? firstBox.value.trim() : '';
    const allBoxes = document.querySelectorAll('.f4-module-cap-box');
    let allOthersEmpty = true;
    for (let i = 1; i < allBoxes.length; i++) {
      if (allBoxes[i].value && allBoxes[i].value.trim() !== '') {
        allOthersEmpty = false;
        break;
      }
    }
    if (allOthersEmpty && val !== '') {
      for (let i = 1; i < allBoxes.length; i++) {
        allBoxes[i].value = val;
      }
    }
  }
  window.syncF4ModuleSerialsAndCaps();
};

window.applyF4ModuleCapToAll = function() {
  const firstBox = document.getElementById('f4ModuleCap_1');
  if (!firstBox) return;
  const val = firstBox.value.trim();
  if (!val) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Please enter a capacity in Module #1 first.', 'info');
    }
    return;
  }
  document.querySelectorAll('.f4-module-cap-box').forEach(box => {
    box.value = val;
  });
  window.syncF4ModuleSerialsAndCaps();
};

window.handleF4ModuleCountChange = function() {
  const countInput = document.getElementById('f4ModuleCount');
  if (!countInput) return;
  window.renderF4ModuleSerialInputs();
};

window.syncF4ModuleSerialsAndCaps = function() {
  const serialBoxes = document.querySelectorAll('.f4-module-serial-box');
  const capBoxes = document.querySelectorAll('.f4-module-cap-box');
  const serialsTextarea = document.getElementById('f4ModuleSerials');
  const capEachInput = document.getElementById('f4ModuleCapacityEach');
  const totalCapInput = document.getElementById('f4ModuleTotalCapacity');
  const badge = document.getElementById('lblF4ModuleSerialCountBadge');

  const count = serialBoxes.length;
  if (badge) {
    badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;
  }

  // 1. Sync Serials into hidden f4ModuleSerials
  const serialList = [];
  serialBoxes.forEach(box => {
    const val = (box.value || '').trim();
    if (val) serialList.push(val);
  });
  if (serialsTextarea) {
    serialsTextarea.value = serialList.join('\n');
  }

  // 2. Calculate Capacities (in Wp)
  let totalWatts = 0;
  let filledCount = 0;
  const capCounts = {};

  capBoxes.forEach(box => {
    const raw = (box.value || '').trim();
    if (!raw) return;
    const match = raw.match(/([0-9.]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num > 0) {
        filledCount++;
        totalWatts += num;
        const displayLabel = `${num} Wp`;
        capCounts[displayLabel] = (capCounts[displayLabel] || 0) + 1;
      }
    }
  });

  if (filledCount > 0 && totalWatts > 0) {
    const totalKW = (totalWatts / 1000).toFixed(2);
    if (totalCapInput) {
      totalCapInput.value = `${totalKW} KWP`;
    }
    if (capEachInput) {
      if (Object.keys(capCounts).length === 1) {
        capEachInput.value = Object.keys(capCounts)[0];
      } else {
        capEachInput.value = Object.entries(capCounts).map(([lbl, c]) => `${lbl} - ${c} Nos`).join(', ');
      }
    }
  }
};

function populateForm4Fields(r) {
  if (!r) return;

  let specs = {};
  if (r.ProductSpecs) {
    try {
      specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs;
    } catch (e) {
      specs = {};
    }
  }

  const customerName = (r.Name || '').trim().toUpperCase();
  const consumerNo = (r.ConsumerNo || '').trim();
  const district = (r.District || '').trim().toUpperCase();
  const pinCode = (r.PinCode || specs.PinCode || '').trim();
  const state = (r.State || specs.State || 'Odisha').trim();
  const siteAddress = (r.Address || specs.SiteAddress || '').trim().toUpperCase();

  // Header: Only keep Consumer Name
  const consumerLabel = document.getElementById('f4ConsumerNameLabel');
  if (consumerLabel) {
    consumerLabel.textContent = customerName || '—';
  }

  // DISCOM Utility Name & Offices
  const discomName = getDiscomName(district, r.CircleName);
  const circleName = (r.CircleName || (district ? `${district} Circle` : `${discomName} Circle`)).trim();
  const division = (r.DivisionName || (district ? `${district} Division` : 'CED Jajpur')).trim();
  const subDiv = (r.SubDivision || '').trim();
  let officeVal = `${subDiv ? subDiv + ' Subdivision, ' : ''}${division}, ${circleName}`;
  if (!officeVal.toUpperCase().includes(discomName.toUpperCase())) {
    officeVal = `${officeVal.trim().replace(/,\s*$/, '')}, ${discomName}`;
  }

  // Application & Ref No
  const regNo = (r.ApplicationNumber || (consumerNo ? `NP-OD-${consumerNo}` : '')).trim();
  const loginDateDash = formatDateToDash(r.LoginDate) || formatDateToDash(r.InstallationDate) || formatDateToDash(new Date());
  const refNoVal = regNo ? `${regNo}/${loginDateDash}` : (consumerNo ? `NP-OD-${consumerNo}/${loginDateDash}` : `REG/${loginDateDash}`);
  const appDateDash = formatDateToDash(r.InstallationDate) || formatDateToDash(r.LoginDate) || formatDateToDash(new Date());
  const appNoDateVal = regNo ? `${regNo}/${appDateDash}` : (consumerNo ? `${consumerNo}/${appDateDash}` : `APP/${appDateDash}`);

  setInputVal('f4Office', officeVal);
  setInputVal('f4RefNo', refNoVal);
  setInputVal('f4AppNoDate', appNoDateVal);
  setInputVal('f4AppFees', r.ApplicationFees || '');

  // Brand parsing
  const brandInfo = parseBrand(r.CommittedBrand);
  const pv = specs.PvModule || {};
  const moduleMake = pv.Make || brandInfo.moduleMake || 'LUMINOUS';
  const moduleModel = pv.TypeAndModel || 'BIFACIAL';

  // Capacity & Module count
  let rawCapacity = pv.TotalCapacity || r.ProposedCapacity || '3.32';
  let capNum = parseFloat(String(rawCapacity).replace(/[^0-9.]/g, '')) || 3.32;
  let totalCapStr = String(rawCapacity).toUpperCase().includes('KW') ? rawCapacity : `${capNum.toFixed(2)} KWP`;
  let moduleCount = pv.NoOfModule ? (String(pv.NoOfModule).includes('Nos') ? pv.NoOfModule : `${pv.NoOfModule} Nos`) : calculateModulesCount(capNum);
  let capEach = formatWithUnit(pv.CapacityEach, '550 Wp', 'moduleCap');

  const installDateFormatted = formatDateToMonthWord(specs.DateOfInstallation || r.InstallationDate) || formatDateToMonthWord(new Date());
  const commissionDateFormatted = formatDateToMonthWord(specs.DateOfCommission || r.CommissioningDate || specs.DateOfInstallation || r.InstallationDate) || formatDateToMonthWord(new Date());

  setInputVal('f4ModuleMake', moduleMake);
  setInputVal('f4ModuleModel', moduleModel);
  setInputVal('f4ModuleTotalCapacity', totalCapStr);
  setInputVal('f4ModuleCount', moduleCount);
  setInputVal('f4ModuleCapacityEach', capEach);
  setInputVal('f4ModuleInstallDate', installDateFormatted);
  setInputVal('f4ModuleCommissionDate', commissionDateFormatted);

  const serials = getOrGenerateSerials(r, specs, moduleCount, moduleMake);
  const capacities = Array.isArray(pv.ModuleCapacities) ? pv.ModuleCapacities : [];
  setInputVal('f4ModuleSerials', serials.join('\n'));
  window.renderF4ModuleSerialInputs(serials, capacities, capEach);

  // Inverter Details
  const inv = specs.GridTiedInverter || {};
  const invMake = inv.Make || brandInfo.inverterMake || 'LUMINOUS';
  const invCount = inv.TotalNo ? (String(inv.TotalNo).includes('Nos') ? inv.TotalNo : `${inv.TotalNo} Nos`) : '1 Nos';
  const invCapacity = inv.Capacity ? (String(inv.Capacity).toUpperCase().includes('KW') ? inv.Capacity : `${inv.Capacity} KW`) : `${Math.round(capNum)} KW`;
  const invSerialNo = getOrGenerateInverterSerial(r, specs, invMake);
  const invName = inv.Name || 'Grid-Tied Inverter';
  const invModel = inv.Model || `NXIT130 ${invCapacity.replace(/\s+/g, '')}/1P-230V,50Hz`;
  const invInputVolt = formatWithUnit(inv.InputVoltage, '300V DC', 'voltDc');
  const invOutputVolt = formatWithUnit(inv.OutputVoltage, '220-240V AC', 'voltAc');

  setInputVal('f4InverterMake', invMake);
  setInputVal('f4InverterCount', invCount);
  setInputVal('f4InverterCapacity', invCapacity);
  setInputVal('f4InverterSerialNo', invSerialNo);
  setInputVal('f4InverterName', invName);
  setInputVal('f4InverterModel', invModel);
  setInputVal('f4InverterInputVolt', invInputVolt);
  setInputVal('f4InverterOutputVolt', invOutputVolt);

  // Cables & Wiring
  const dcCable = specs.DetailsOfCablesDc || {};
  setInputVal('f4DcCableMake', dcCable.Make || 'KEI');
  setInputVal('f4DcCableSize', formatWithUnit(dcCable.SizeType, '4 SQ MM', 'cableSize'));

  setInputVal('f4AcWiringMake', 'KEI');
  setInputVal('f4AcWiringSize', formatWithUnit('4 SQ MM', '4 SQ MM', 'cableSize'));

  // DCDB & ACDB
  const dcdb = specs.DetailsOfDcdb || {};
  setInputVal('f4DcdbMake', dcdb.Make || 'HAVELLS');
  setInputVal('f4DcdbMcb', dcdb.McbDetails || '32 AMP');

  const acdb = specs.DetailsOfAcdb || {};
  setInputVal('f4AcdbMake', acdb.Make || 'HAVELLS');
  setInputVal('f4AcdbMcb', acdb.McbDetails || '32 AMP');

  // Earthing
  const earth = specs.DetailsOfEarthing || {};
  setInputVal('f4EarthResistance', formatWithUnit(earth.EarthResistance, '3 OHM', 'earthRes'));
  setInputVal('f4EarthWireSize', formatWithUnit(earth.EarthWireSize, '16 SQ MM Aluminum', 'earthWire'));
  setInputVal('f4LaSizeType', earth.LaSizeType || 'Copper Bounded');

  // Applicant Details
  setInputVal('f4ApplicantName', customerName);
  setInputVal('f4ApplicantAddress', siteAddress || (district ? `AT/PO ${district}` : 'ODISHA'));
  setInputVal('f4ApplicantDist', district || 'ODISHA');
  setInputVal('f4ApplicantPin', pinCode || '');

  // Installer Details
  setInputVal('f4InstallerFirm', 'Shri Trutiyadev Solar Enterprises');
  setInputVal('f4InstallerAddress', 'AT-Talamundali,PO- Kankadajodi, PS-Maniabandha, Dist-Cuttack PIN-754035');
  setInputVal('f4ReportDate', installDateFormatted);
  setInputVal('f4CertifiedAuthority', discomName);
}

window.resetForm4Fields = function() {
  if (selectedCustomerSlNo) {
    const rows = getInstallmentRows();
    const r = rows.find(x => Number(x.SlNo) === Number(selectedCustomerSlNo));
    if (r) {
      populateForm4Fields(r);
      UI.toast(`Form 4 fields restored from database for ${r.Name}`, 'info');
      return;
    }
  }

  // If no customer selected, clear all fields
  const ids = [
    'f4Office', 'f4RefNo', 'f4AppNoDate', 'f4AppFees',
    'f4ModuleMake', 'f4ModuleModel', 'f4ModuleTotalCapacity', 'f4ModuleCount',
    'f4ModuleCapacityEach', 'f4ModuleInstallDate', 'f4ModuleCommissionDate', 'f4ModuleSerials',
    'f4InverterMake', 'f4InverterCount', 'f4InverterCapacity', 'f4InverterSerialNo',
    'f4InverterName', 'f4InverterModel', 'f4InverterInputVolt', 'f4InverterOutputVolt',
    'f4DcCableMake', 'f4DcCableSize', 'f4AcWiringMake', 'f4AcWiringSize',
    'f4DcdbMake', 'f4DcdbMcb', 'f4AcdbMake', 'f4AcdbMcb',
    'f4EarthResistance', 'f4EarthWireSize', 'f4LaSizeType',
    'f4ApplicantName', 'f4ApplicantAddress', 'f4ApplicantDist', 'f4ApplicantPin',
    'f4InstallerFirm', 'f4InstallerAddress', 'f4ReportDate', 'f4CertifiedAuthority'
  ];
  ids.forEach(id => setInputVal(id, ''));
  const consumerLabel = document.getElementById('f4ConsumerNameLabel');
  if (consumerLabel) consumerLabel.textContent = '—';
  if (typeof window.renderF4ModuleSerialInputs === 'function') {
    window.renderF4ModuleSerialInputs([], []);
  }
  UI.toast('Form 4 inputs cleared.', 'info');
};

function getForm4CurrentData() {
  if (typeof window.syncF4ModuleSerialsAndCaps === 'function') {
    window.syncF4ModuleSerialsAndCaps();
  }
  const serialsRaw = getInputVal('f4ModuleSerials');
  const serialsList = serialsRaw.split('\n').map(s => s.trim()).filter(Boolean);

  let currentCust = null;
  if (selectedCustomerSlNo) {
    const rows = getInstallmentRows();
    currentCust = rows.find(x => Number(x.SlNo) === Number(selectedCustomerSlNo)) || null;
  }

  const custName = currentCust ? (currentCust.Name || '').toUpperCase() : '';
  const custAddr = currentCust ? (currentCust.Address || '').toUpperCase() : '';
  const custDist = currentCust ? (currentCust.District || '').toUpperCase() : '';
  const custPin = currentCust ? (currentCust.PinCode || '') : '';
  const custConsumer = currentCust ? (currentCust.ConsumerNo || '') : '';
  const custCircle = getDiscomName(custDist, currentCust ? currentCust.CircleName : '');
  const rawAuth = getInputVal('f4CertifiedAuthority', custCircle);
  const certifiedAuthority = getDiscomName(custDist, rawAuth);

  let officeVal = getInputVal('f4Office', `${custDist ? custDist + ' Division, ' : ''}${custCircle}`);
  if (certifiedAuthority && !officeVal.toUpperCase().includes(certifiedAuthority.toUpperCase())) {
    officeVal = `${officeVal.trim().replace(/,\s*$/, '')}, ${certifiedAuthority}`;
  }

  return {
    customerName: custName,
    consumerNo: custConsumer,
    office: officeVal,
    refNo: getInputVal('f4RefNo', currentCust ? (currentCust.ApplicationNumber || `NP-OD-${custConsumer || '1001'}`) : ''),
    appNoDate: getInputVal('f4AppNoDate', currentCust ? (currentCust.ApplicationNumber || custConsumer || '') : ''),
    appFees: getInputVal('f4AppFees', ''),

    moduleMake: getInputVal('f4ModuleMake', 'LUMINOUS'),
    moduleModel: getInputVal('f4ModuleModel', 'BIFACIAL'),
    moduleTotalCapacity: getInputVal('f4ModuleTotalCapacity', currentCust ? `${currentCust.ProposedCapacity || 3.32} KWP` : '3.32 KWP'),
    moduleCount: getInputVal('f4ModuleCount', '6 Nos'),
    moduleCapacityEach: formatWithUnit(getInputVal('f4ModuleCapacityEach', '550 Wp'), '550 Wp', 'moduleCap'),
    moduleInstallDate: getInputVal('f4ModuleInstallDate', formatDateToMonthWord(new Date())),
    moduleCommissionDate: getInputVal('f4ModuleCommissionDate', formatDateToMonthWord(new Date())),
    moduleSerials: serialsList,

    inverterMake: getInputVal('f4InverterMake', 'LUMINOUS'),
    inverterCount: getInputVal('f4InverterCount', '1 Nos'),
    inverterCapacity: getInputVal('f4InverterCapacity', '3 KW'),
    inverterSerialNo: getInputVal('f4InverterSerialNo', ''),
    inverterName: getInputVal('f4InverterName', 'Grid-Tied Inverter'),
    inverterModel: getInputVal('f4InverterModel', 'NXIT130 3KW/1P-230V,50Hz'),
    inverterInputVolt: formatWithUnit(getInputVal('f4InverterInputVolt', '300V DC'), '300V DC', 'voltDc'),
    inverterOutputVolt: formatWithUnit(getInputVal('f4InverterOutputVolt', '220-240V AC'), '220-240V AC', 'voltAc'),

    dcCableMake: getInputVal('f4DcCableMake', 'KEI'),
    dcCableSize: formatWithUnit(getInputVal('f4DcCableSize', '4 SQ MM'), '4 SQ MM', 'cableSize'),
    acWiringMake: getInputVal('f4AcWiringMake', 'KEI'),
    acWiringSize: formatWithUnit(getInputVal('f4AcWiringSize', '4 SQ MM'), '4 SQ MM', 'cableSize'),

    dcdbMake: getInputVal('f4DcdbMake', 'HAVELLS'),
    dcdbMcb: getInputVal('f4DcdbMcb', '32 AMP'),
    acdbMake: getInputVal('f4AcdbMake', 'HAVELLS'),
    acdbMcb: getInputVal('f4AcdbMcb', '32 AMP'),

    earthResistance: formatWithUnit(getInputVal('f4EarthResistance', '3 OHM'), '3 OHM', 'earthRes'),
    earthWireSize: formatWithUnit(getInputVal('f4EarthWireSize', '16 SQ MM Aluminum'), '16 SQ MM Aluminum', 'earthWire'),
    laSizeType: getInputVal('f4LaSizeType', 'Copper Bounded'),

    applicantName: custName,
    applicantAddress: getInputVal('f4ApplicantAddress', custAddr),
    applicantDist: getInputVal('f4ApplicantDist', custDist),
    applicantPin: getInputVal('f4ApplicantPin', custPin),

    installerFirm: getInputVal('f4InstallerFirm', 'Shri Trutiyadev Solar Enterprises'),
    installerAddress: getInputVal('f4InstallerAddress', 'AT-Talamundali,PO- Kankadajodi, PS-Maniabandha, Dist-Cuttack PIN-754035'),
    reportDate: getInputVal('f4ReportDate', formatDateToMonthWord(new Date())),
    certifiedAuthority: certifiedAuthority
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   Form 4: Modal Preview & Print
   ════════════════════════════════════════════════════════════════════════════ */

window.previewForm4Modal = function() {
  const d = getForm4CurrentData();
  const container = document.getElementById('form4PreviewBody');
  if (!container) return;

  const serialsHtml = d.moduleSerials.length > 0
    ? d.moduleSerials.map(s => escapeHtml(s)).join('<br>')
    : '<span class="text-muted fst-italic">None entered</span>';

  const html = `
    <!-- Page 1 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <div class="text-center mb-3">
        <h5 class="fw-bold mb-0 text-dark" style="font-size: 15px;">Work Completion Report (Form-4)</h5>
        <div class="text-dark fst-normal" style="font-size: 11px;">(To be submitted by the applicant)</div>
      </div>

      <div class="mb-3" style="font-size: 11px; line-height: 1.5;">
        <div><strong>To,</strong></div>
        <div>The Circle solar executive/SDO/Executive Engineer (Ele),</div>
        <div>${escapeHtml(d.office)}</div>
        <div class="mt-2"><strong>Sub: Submission of work completion report for System documentation requirements.</strong></div>
        <div><strong>Ref: Your PMSGY REG. N0.- ${escapeHtml(d.refNo)}</strong></div>
        <div class="mt-2"><strong>Sir,</strong></div>
        <div class="text-justify">
          With reference to the above, I would like to submit the following basic information of my Solar Rooftop PV System (SRTPV System) for your kind perusal and request for arranging to Inspect and Commission at the earliest:
        </div>
      </div>

      <table class="form4-preview-table">
        <tbody>
          <tr class="fw-bold bg-light">
            <td colspan="2">A. Details of the Application:</td>
            <td style="width: 45%;"></td>
          </tr>
          <tr>
            <td style="width: 35px; text-align: center;">1</td>
            <td style="width: 50%;">Application FG No/Date</td>
            <td>${escapeHtml(d.appNoDate)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Application fees in Rs.</td>
            <td>${escapeHtml(d.appFees)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">B. Details of the Solar PV Module:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Model No.</td>
            <td>${escapeHtml(d.moduleModel)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Total Capacity in kWp</td>
            <td>${escapeHtml(d.moduleTotalCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Make</td>
            <td>${escapeHtml(d.moduleMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center; vertical-align: top;">4</td>
            <td style="vertical-align: top;">Sl. NO</td>
            <td style="vertical-align: top; font-family: monospace; font-size: 10px;">${serialsHtml}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Total No. of PV Modules</td>
            <td>${escapeHtml(d.moduleCount)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Capacity of each Module in kWp</td>
            <td>${escapeHtml(d.moduleCapacityEach)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">7</td>
            <td>Date of Installation</td>
            <td>${escapeHtml(d.moduleInstallDate)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">8</td>
            <td>Date of Commission</td>
            <td>${escapeHtml(d.moduleCommissionDate)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">C. Details of the Inverter:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Total No of Inverter</td>
            <td>${escapeHtml(d.inverterCount)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Name of the inverter (Type)</td>
            <td>${escapeHtml(d.inverterName)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Make</td>
            <td>${escapeHtml(d.inverterMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Model No.</td>
            <td>${escapeHtml(d.inverterModel)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Capacity</td>
            <td>${escapeHtml(d.inverterCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Serial No.</td>
            <td style="font-family: monospace;">${escapeHtml(d.inverterSerialNo)}</td>
          </tr>
        </tbody>
      </table>
      <div class="text-end text-muted font-monospace" style="font-size: 9px;">Page 1 of 3</div>
    </div>

    <!-- Page 2 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <table class="form4-preview-table mb-1">
        <tbody>
          <tr>
            <td style="width: 35px; text-align: center;">7</td>
            <td style="width: 50%;">Input Voltage</td>
            <td style="width: 45%;">${escapeHtml(d.inverterInputVolt)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">8</td>
            <td>Output Voltage</td>
            <td>${escapeHtml(d.inverterOutputVolt)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">9</td>
            <td>Date of Installation</td>
            <td>${escapeHtml(d.moduleInstallDate)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">10</td>
            <td>Date of Commission</td>
            <td>${escapeHtml(d.moduleCommissionDate)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">D. Details of Cables: DC</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Make</td>
            <td>${escapeHtml(d.dcCableMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Size &amp; Type</td>
            <td>${escapeHtml(d.dcCableSize)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">E. Details of AC Wiring:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Make</td>
            <td>${escapeHtml(d.acWiringMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Size &amp; Type</td>
            <td>${escapeHtml(d.acWiringSize)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">F. Details of the DC distribution box:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Make</td>
            <td>${escapeHtml(d.dcdbMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Sl. No.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>DC Surge Protection Device rating</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>MCB / Isolator quantity &amp; capacity</td>
            <td>${escapeHtml(d.dcdbMcb)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">G. Details of AC distribution box:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Make</td>
            <td>${escapeHtml(d.acdbMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Sl. No.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>AC Surge Protection Device rating</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>MCB / MCCB quantity &amp; capacity</td>
            <td>${escapeHtml(d.acdbMcb)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">H. Details of Earthing:</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Earth resistance (in ohms)</td>
            <td>${escapeHtml(d.earthResistance)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Size of the Earth wire / flat*(Copper/Al)</td>
            <td>${escapeHtml(d.earthWireSize)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Two separate earthing points</td>
            <td>YES</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Lightening Arrester</td>
            <td>YES</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>LA Size &amp; Type</td>
            <td>${escapeHtml(d.laSizeType)}</td>
          </tr>
          <tr class="fw-bold">
            <td colspan="3" style="font-size: 10px; padding: 4px 6px;">Note:* Earthing shall be done in accordance IS 3043-1986</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="3">I. Details of the NET and Solar meters details (please enclose the test report of the bidirectional meter tested at MRT division, ${escapeHtml(d.certifiedAuthority)})</td>
          </tr>
          <tr>
            <td style="width: 35px; text-align: center;">1</td>
            <td style="width: 50%;">No of Net Meter</td>
            <td style="width: 45%;"></td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Make</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Serial No.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Capacity</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Type/Model</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Single ph./Three ph.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">7</td>
            <td>Line CT/ PT Ratio</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">8</td>
            <td>Date of Test by MRT, ${escapeHtml(d.certifiedAuthority)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="text-end text-muted font-monospace" style="font-size: 9px;">Page 2 of 3</div>
    </div>

    <!-- Page 3 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-2">
      <table class="form4-preview-table mb-1">
        <tbody>
          <tr>
            <td style="width: 35px; text-align: center;">1</td>
            <td style="width: 50%;">No. of Solar Meters</td>
            <td style="width: 45%;"></td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Make</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Serial No.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Capacity</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Type/Model</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Single ph./Three ph.</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">7</td>
            <td>Line CT/ PT Ratio</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">8</td>
            <td>Date of Test by MRT, ${escapeHtml(d.certifiedAuthority)}</td>
            <td></td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="3">J. Details of the Caution signs<br><span class="fw-normal fs-9">(Size of the caution label: 105 mm width X 20 mm height, with white letters on a red background)</span></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Panels</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Inverters</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>DC/ AC distribution box</td>
            <td></td>
          </tr>
          <tr class="fw-bold">
            <td colspan="3">K. Provision of manual and automatic switches: Yes / No</td>
          </tr>
          <tr class="fw-bold">
            <td colspan="3">L. Whether Operation and Maintenance information:<br>Such as Do’s and Don’ts are provided by the System Installer: Yes* / No*.</td>
          </tr>
        </tbody>
      </table>

      <div class="my-2.5 text-justify" style="font-size: 10.5px; line-height: 1.4;">
        Certified that the above said SPV system was installed by me and the equipment used, comply with the Technical and Safety standards as specified by CEA/MNRE/IEGC/OGC/OERC and ${escapeHtml(d.certifiedAuthority)}’s requirement.
      </div>

      <!-- Spacing between Certification statement and Signatures block (more 4 cm space) -->
      <div style="height: 40mm;"></div>

      <div class="row g-2 mt-2 pt-2" style="font-size: 10.5px;">
        <div class="col-6">
          <div class="fw-bold mb-1">Signature of the Applicant</div>
          <div><strong>Name:-</strong> ${escapeHtml(d.applicantName)}</div>
          <div><strong>Address:-</strong> ${escapeHtml(d.applicantAddress)}</div>
          <div><strong>Dist-</strong>${escapeHtml(d.applicantDist)}, <strong>PIN-</strong>${escapeHtml(d.applicantPin)}</div>
          <div class="mt-3"><strong>Date:</strong></div>
        </div>
        <div class="col-6">
          <div class="fw-bold mb-1">Name and Signature of the System Installer with Seal</div>
          <div><strong>Name of the firm:</strong> ${escapeHtml(d.installerFirm)}</div>
          <div><strong>Address:</strong> ${escapeHtml(d.installerAddress)}</div>
          <div class="mt-3"><strong>Date:</strong></div>
        </div>
      </div>

      <div class="mt-3 pt-2" style="font-size: 10px; line-height: 1.4;">
        <div class="fw-bold">Certified by</div>
        <div>Circle solar executive/SDO/Executive Engineer, ${escapeHtml(d.certifiedAuthority)}</div>
        <div>Date:</div>
        <div class="fw-bold mt-2">Enclosures:</div>
        <ol class="mb-0 ps-3">
          <li>Test report of bi-directional meter tested at MMG/MRT division, ${escapeHtml(d.certifiedAuthority)}.</li>
          <li>Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.</li>
          <li>Data sheets/Drawing for the array mounting System.</li>
          <li>Actual Single line wiring diagram of the SPV System.</li>
          <li>Copy of Maintenance &amp; Operation information provided by the System Installer.</li>
        </ol>
      </div>

      <div class="text-end text-muted font-monospace mt-2" style="font-size: 9px;">Page 3 of 3</div>
    </div>
  `;

  container.innerHTML = html;
  const modalEl = document.getElementById('form4PreviewModal');
  if (modalEl) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
};

window.printForm4Preview = function() {
  const container = document.getElementById('form4PreviewBody');
  if (!container) return;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    UI.toast('Please allow popups to print the Form 4 document.', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Work Completion Report (Form-4)</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
        .form4-preview-sheet { max-width: 800px; margin: 0 auto 30px auto; page-break-after: always; }
        .form4-preview-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .form4-preview-table th, .form4-preview-table td { border: 1px solid #000; padding: 3px 6px; font-size: 11px; vertical-align: top; }
        .bg-light { background-color: #f8f9fa !important; }
        .fw-bold { font-weight: bold; }
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        .row { display: flex; flex-wrap: wrap; }
        .col-6 { width: 50%; box-sizing: border-box; }
        @media print {
          body { padding: 0; }
          .form4-preview-sheet { margin: 0; page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${container.innerHTML}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

/* ════════════════════════════════════════════════════════════════════════════
   Form 4: Exact Vector PDF Generator using jsPDF
   ════════════════════════════════════════════════════════════════════════════ */

window.downloadForm4Pdf = function() {
  const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPdfClass) {
    UI.toast('jsPDF library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }

  if (!selectedCustomerSlNo) {
    const rows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
    if (rows.length > 0) {
      selectCustomerForAgreement(rows[0].SlNo);
    } else {
      UI.toast('Please select a customer first from the list.', 'warning');
      return;
    }
  }

  UI.showLoading(true);

  try {
    const d = getForm4CurrentData();
    const doc = new jsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 14;
    const tableWidth = 182; // marginX + tableWidth = 196mm
    const col1Width = 12;   // Sl No
    const col2Width = 86;   // Parameter description
    const col3Width = 84;   // Particulars / value

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // Helper: Draw single row with 3 columns
    function drawTableRow(y, slText, labelText, valText, opt = {}) {
      const fontSize = opt.fontSize || 8.5;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

      const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
      const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);

      const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
      const lineHeight = opt.lineHeight || 4.2;
      const padding = 2.4;
      const rowHeight = Math.max(opt.minHeight || 5.8, maxLines * lineHeight + padding);

      // Outer cell border
      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

      // Col 1 text (centered or left)
      if (slText) {
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
      }

      // Col 2 text
      doc.text(col2Lines, marginX + col1Width + 2, y + 4.2);

      // Col 3 text
      if (opt.valFontMono) doc.setFont('courier', opt.valBold ? 'bold' : 'normal');
      doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 4.2);
      if (opt.valFontMono) doc.setFont('helvetica', 'normal');

      return y + rowHeight;
    }

    // Helper: Draw section header (spanning col 1 & 2 or all columns)
    function drawTableHeader(y, headerTitle, headerVal = '', opt = {}) {
      const fontSize = opt.fontSize || 9;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');

      const titleLines = doc.splitTextToSize(headerTitle || '', (opt.spanAll ? tableWidth : col1Width + col2Width) - 4);
      const rowHeight = Math.max(6.2, titleLines.length * 4.2 + 2);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      if (!opt.spanAll) {
        doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);
      }

      doc.text(titleLines, marginX + 2, y + 4.2);
      if (headerVal) {
        doc.text(headerVal, marginX + col1Width + col2Width + 2, y + 4.2);
      }
      return y + rowHeight;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1
    // ══════════════════════════════════════════════════════════════════════════
    let curY = 16;

    // Document Titles
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Work Completion Report (Form-4)', pageWidth / 2, curY, { align: 'center' });
    curY += 5;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text('(To be submitted by the applicant)', pageWidth / 2, curY, { align: 'center' });
    curY += 8;

    // To, Office Header
    doc.setFontSize(8.5);
    doc.text('To,', marginX, curY); curY += 4.2;
    doc.text('The Circle solar executive/SDO/Executive Engineer (Ele),', marginX, curY); curY += 4.2;
    const officeLines = doc.splitTextToSize(d.office, tableWidth);
    doc.text(officeLines, marginX, curY);
    curY += (officeLines.length * 4.2) + 2;

    // Sub & Ref
    doc.setFont('helvetica', 'bold');
    doc.text('Sub: Submission of work completion report for System documentation requirements.', marginX, curY); curY += 4.5;
    doc.text(`Ref: Your PMSGY REG. N0.- ${d.refNo}`, marginX, curY); curY += 5.5;

    // Greeting & Intro
    doc.setFont('helvetica', 'normal');
    doc.text('Sir,', marginX, curY); curY += 4.2;
    const introLines = doc.splitTextToSize(
      'With reference to the above, I would like to submit the following basic information of my Solar Rooftop PV System (SRTPV System) for your kind perusal and request for arranging to Inspect and Commission at the earliest:',
      tableWidth
    );
    doc.text(introLines, marginX, curY);
    curY += (introLines.length * 4) + 3;

    // PART A
    curY = drawTableHeader(curY, 'A. Details of the Application:');
    curY = drawTableRow(curY, '1', 'Application FG No/Date', d.appNoDate);
    curY = drawTableRow(curY, '2', 'Application fees in Rs.', d.appFees);

    // PART B
    curY = drawTableHeader(curY, 'B. Details of the Solar PV Module:');
    curY = drawTableRow(curY, '1', 'Model No.', d.moduleModel);
    curY = drawTableRow(curY, '2', 'Total Capacity in kWp', d.moduleTotalCapacity);
    curY = drawTableRow(curY, '3', 'Make', d.moduleMake);

    // Serials: join with newlines or show 'None'
    const serialsText = d.moduleSerials.length > 0 ? d.moduleSerials.join('\n') : '';
    curY = drawTableRow(curY, '4', 'Sl. NO', serialsText, { valFontMono: true, lineHeight: 3.8, minHeight: 7 });

    curY = drawTableRow(curY, '5', 'Total No. of PV Modules', d.moduleCount);
    curY = drawTableRow(curY, '6', 'Capacity of each Module in kWp', d.moduleCapacityEach);
    curY = drawTableRow(curY, '7', 'Date of Installation', d.moduleInstallDate);
    curY = drawTableRow(curY, '8', 'Date of Commission', d.moduleCommissionDate);

    // PART C (Items 1 - 6 on Page 1)
    curY = drawTableHeader(curY, 'C. Details of the Inverter:');
    curY = drawTableRow(curY, '1', 'Total No of Inverter', d.inverterCount);
    curY = drawTableRow(curY, '2', 'Name of the inverter (Type)', d.inverterName);
    curY = drawTableRow(curY, '3', 'Make', d.inverterMake);
    curY = drawTableRow(curY, '4', 'Model No.', d.inverterModel);
    curY = drawTableRow(curY, '5', 'Capacity', d.inverterCapacity);
    curY = drawTableRow(curY, '6', 'Serial No.', d.inverterSerialNo, { valFontMono: true });

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    curY = 16;

    // Inverter continued (Items 7 - 10)
    curY = drawTableRow(curY, '7', 'Input Voltage', d.inverterInputVolt);
    curY = drawTableRow(curY, '8', 'Output Voltage', d.inverterOutputVolt);
    curY = drawTableRow(curY, '9', 'Date of Installation', d.moduleInstallDate);
    curY = drawTableRow(curY, '10', 'Date of Commission', d.moduleCommissionDate);

    // PART D: Cables DC
    curY = drawTableHeader(curY, 'D. Details of Cables: DC');
    curY = drawTableRow(curY, '1', 'Make', d.dcCableMake);
    curY = drawTableRow(curY, '2', 'Size & Type', d.dcCableSize);

    // PART E: AC Wiring
    curY = drawTableHeader(curY, 'E. Details of AC Wiring:');
    curY = drawTableRow(curY, '1', 'Make', d.acWiringMake);
    curY = drawTableRow(curY, '2', 'Size & Type', d.acWiringSize);

    // PART F: DCDB
    curY = drawTableHeader(curY, 'F. Details of the DC distribution box:');
    curY = drawTableRow(curY, '1', 'Make', d.dcdbMake);
    curY = drawTableRow(curY, '2', 'Sl. No.', '');
    curY = drawTableRow(curY, '3', 'DC Surge Protection Device rating', '');
    curY = drawTableRow(curY, '4', 'MCB / Isolator quantity & capacity', d.dcdbMcb);

    // PART G: ACDB
    curY = drawTableHeader(curY, 'G. Details of AC distribution box:');
    curY = drawTableRow(curY, '1', 'Make', d.acdbMake);
    curY = drawTableRow(curY, '2', 'Sl. No.', '');
    curY = drawTableRow(curY, '3', 'AC Surge Protection Device rating', '');
    curY = drawTableRow(curY, '4', 'MCB / MCCB quantity & capacity', d.acdbMcb);

    // PART H: Earthing
    curY = drawTableHeader(curY, 'H. Details of Earthing:');
    curY = drawTableRow(curY, '1', 'Earth resistance (in ohms)', d.earthResistance);
    curY = drawTableRow(curY, '2', 'Size of the Earth wire / flat*(Copper/Al)', d.earthWireSize);
    curY = drawTableRow(curY, '3', 'Two separate earthing points', 'YES');
    curY = drawTableRow(curY, '4', 'Lightening Arrester', 'YES');
    curY = drawTableRow(curY, '5', 'LA Size & Type', d.laSizeType);

    // Note row inside table H
    curY = drawTableHeader(curY, 'Note:* Earthing shall be done in accordance IS 3043-1986', '', { spanAll: true, fontSize: 8.5 });

    // PART I: Net Meter
    const partITitle = `I. Details of the NET and Solar meters details (please enclose the test report of the bidirectional meter tested at MRT division, ${d.certifiedAuthority})`;
    curY = drawTableHeader(curY, partITitle, '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'No of Net Meter', '');
    curY = drawTableRow(curY, '2', 'Make', '');
    curY = drawTableRow(curY, '3', 'Serial No.', '');
    curY = drawTableRow(curY, '4', 'Capacity', '');
    curY = drawTableRow(curY, '5', 'Type/Model', '');
    curY = drawTableRow(curY, '6', 'Single ph./Three ph.', '');
    curY = drawTableRow(curY, '7', 'Line CT/ PT Ratio', '');
    curY = drawTableRow(curY, '8', `Date of Test by MRT, ${d.certifiedAuthority}`, '');

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 3
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    curY = 16;

    // Solar meter details continued from Part I
    curY = drawTableRow(curY, '1', 'No. of Solar Meters', '');
    curY = drawTableRow(curY, '2', 'Make', '');
    curY = drawTableRow(curY, '3', 'Serial No.', '');
    curY = drawTableRow(curY, '4', 'Capacity', '');
    curY = drawTableRow(curY, '5', 'Type/Model', '');
    curY = drawTableRow(curY, '6', 'Single ph./Three ph.', '');
    curY = drawTableRow(curY, '7', 'Line CT/ PT Ratio', '');
    curY = drawTableRow(curY, '8', `Date of Test by MRT, ${d.certifiedAuthority}`, '');

    // PART J: Caution signs
    const partJTitle = 'J. Details of the Caution signs\n(Size of the caution label: 105 mm width X 20 mm height, with white letters on a red background)';
    curY = drawTableHeader(curY, partJTitle, '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'Panels', '');
    curY = drawTableRow(curY, '2', 'Inverters', '');
    curY = drawTableRow(curY, '3', 'DC/ AC distribution box', '');

    // K & L Declarations in table
    curY = drawTableHeader(curY, 'K. Provision of manual and automatic switches: Yes / No', '', { spanAll: true });
    curY = drawTableHeader(curY, 'L. Whether Operation and Maintenance information:\nSuch as Do’s and Don’ts are provided by the System Installer: Yes* / No*.', '', { spanAll: true });

    // Certification text below table
    curY += 4;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const certText = `Certified that the above said SPV system was installed by me and the equipment used, comply with the Technical and Safety standards as specified by CEA/MNRE/IEGC/OGC/OERC and ${d.certifiedAuthority}’s requirement.`;
    const certLines = doc.splitTextToSize(certText, tableWidth);
    doc.text(certLines, marginX, curY);
    curY += (certLines.length * 4) + 42; // Generous 40mm+ (4 cm) vertical gap before Signature row

    // Two-Column Signatures Block
    const sigY = curY;
    const colHalfWidth = tableWidth / 2;

    // Left Column: Applicant
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature of the Applicant', marginX, sigY);
    
    doc.setFontSize(8.5);
    doc.text(`Name:- ${d.applicantName}`, marginX, sigY + 5);
    
    doc.setFont('helvetica', 'normal');
    const appAddrLines = doc.splitTextToSize(`Address:- ${d.applicantAddress}`, colHalfWidth - 6);
    doc.text(appAddrLines, marginX, sigY + 9.5);
    
    const appDistLineY = sigY + 9.5 + (appAddrLines.length * 4);
    doc.text(`Dist-${d.applicantDist}, PIN-${d.applicantPin}`, marginX, appDistLineY);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', marginX, appDistLineY + 6);

    // Right Column: System Installer
    const rightColX = marginX + colHalfWidth + 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Name and Signature of the System Installer with Seal', rightColX, sigY);

    doc.setFontSize(8.5);
    doc.text(`Name of the firm: ${d.installerFirm}`, rightColX, sigY + 5);

    doc.setFont('helvetica', 'normal');
    const instAddrLines = doc.splitTextToSize(`Address: ${d.installerAddress}`, colHalfWidth - 6);
    doc.text(instAddrLines, rightColX, sigY + 9.5);

    const instDateLineY = sigY + 9.5 + (instAddrLines.length * 4);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', rightColX, instDateLineY + 6);

    curY = Math.max(appDistLineY + 14, instDateLineY + 12);

    // Certified by & Enclosures
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Certified by', marginX, curY); curY += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.text(`Circle solar executive/SDO/Executive Engineer, ${d.certifiedAuthority}`, marginX, curY); curY += 4.2;
    doc.text('Date:', marginX, curY); curY += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Enclosures:', marginX, curY); curY += 4.5;

    doc.setFont('helvetica', 'normal');
    const encList = [
      `1. Test report of bi-directional meter tested at MMG/MRT division, ${d.certifiedAuthority}.`,
      '2. Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.',
      '3. Data sheets/Drawing for the array mounting System.',
      '4. Actual Single line wiring diagram of the SPV System.',
      '5. Copy of Maintenance & Operation information provided by the System Installer.'
    ];

    encList.forEach(enc => {
      const lines = doc.splitTextToSize(enc, tableWidth);
      doc.text(lines, marginX, curY);
      curY += (lines.length * 3.8);
    });

    // Clean Filename
    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanRef = (d.consumerNo || d.refNo || 'Form4').split('/')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_4_${cleanName}_${cleanRef}.pdf`;

    doc.save(fileName);
    UI.toast(`Form 4 PDF (${fileName}) downloaded successfully!`, 'success');
  } catch (err) {
    console.error('Error generating Form 4 PDF:', err);
    UI.toast(`Error generating Form 4 PDF: ${err.message}`, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.generateAgreementDocx = async function() {
  const nameVal = document.getElementById('agrName').value.trim();
  const consumerNoVal = document.getElementById('agrConsumerNo').value.trim();
  const addressVal = document.getElementById('agrAddress').value.trim().toUpperCase();

  if (!nameVal || !addressVal) {
    UI.toast('Please select a customer and provide Full Address.', 'warning');
    return;
  }

  if (typeof JSZip === 'undefined') {
    UI.toast('JSZip library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }

  UI.showLoading(true);
  try {
    const templateUrl = 'assets/sampleFiles/Agreement_Consumer_Vendor.docx';
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to load template file (${response.status} ${response.statusText})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let docXml = await zip.file('word/document.xml').async('text');

    // Replace {{NAME}}, {{ADDRESS}}, and {{CONSUMERNO}} placeholders
    docXml = docXml
      .replaceAll('{{NAME}}', nameVal)
      .replaceAll('{{ADDRESS}}', addressVal)
      .replaceAll('{{CONSUMERNO}}', consumerNoVal || '');

    zip.file('word/document.xml', docXml);

    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // Clean filenames for download
    const cleanName = nameVal.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanConsumerNo = consumerNoVal ? consumerNoVal.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const fileName = cleanConsumerNo ? `Agreement_${cleanName}_${cleanConsumerNo}.docx` : `Agreement_${cleanName}.docx`;

    // Trigger browser file download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(docxBlob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(a.href);
    }, 1000);

    UI.toast(`Agreement document (${fileName}) generated & downloaded successfully!`, 'success');
  } catch (err) {
    console.error('Error generating agreement docx:', err);
    UI.toast('Error generating Agreement document: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   Form 6: Inspection Report for RTS Logic & Vector PDF Generator
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Form 6 Dynamic PV Module Serials & Capacities ────────────────────────── */

window.renderF6PvSerialInputs = function(initialSerials = null, initialCapacities = null, fallbackCap = null) {
  const countInput = document.getElementById('f6PvCount');
  const container = document.getElementById('f6PvSerialInputsContainer');
  const badge = document.getElementById('lblF6PvSerialCountBadge');
  if (!container) return;

  const count = Math.max(0, parseInt(String(countInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0);
  if (badge) badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;

  if (count === 0) {
    container.innerHTML = '<div class="col-12 text-muted fs-8 fst-italic py-2 text-center">Enter "No. of Module" above to generate serial number and capacity textboxes.</div>';
    window.syncF6PvSerialsAndCaps();
    return;
  }

  // Preserve existing entered values if not provided
  let existingSerials = [];
  let existingCaps = [];
  if (initialSerials && Array.isArray(initialSerials)) {
    existingSerials = initialSerials;
  } else {
    container.querySelectorAll('.f6-module-serial-box').forEach((box, i) => {
      existingSerials[i] = box.value;
    });
  }

  if (initialCapacities && Array.isArray(initialCapacities)) {
    existingCaps = initialCapacities;
  } else {
    container.querySelectorAll('.f6-module-cap-box').forEach((box, i) => {
      existingCaps[i] = box.value;
    });
  }

  // Fallback capacity extraction from argument or hidden input
  let defaultCapVal = '';
  const capSrc = fallbackCap || document.getElementById('f6PvCapacityEach')?.value || '';
  const match = String(capSrc).match(/([0-9.]+)/);
  if (match) defaultCapVal = match[1];

  let html = '';
  for (let i = 1; i <= count; i++) {
    const sVal = existingSerials[i - 1] || '';
    let cVal = existingCaps[i - 1] || '';
    if (!cVal && defaultCapVal) {
      cVal = defaultCapVal;
    }

    html += `
      <div class="col-md-6 col-12">
        <div class="input-group input-group-sm f6-module-row-group">
          <span class="input-group-text bg-light text-muted fs-8 font-monospace px-2" style="min-width: 32px; justify-content: center;">#${i}</span>
          <input type="text" class="form-control form-control-sm fs-8 font-monospace f6-module-serial-box" id="f6PvSerial_${i}" data-index="${i}" value="${escapeHtml(sVal)}" placeholder="Serial No. ${i}" title="Module ${i} Serial Number" oninput="window.syncF6PvSerialsAndCaps()">
          <input type="number" min="0" step="any" class="form-control form-control-sm fs-8 f6-module-cap-box text-end fw-semibold" id="f6PvCap_${i}" data-index="${i}" value="${escapeHtml(cVal)}" placeholder="550" style="max-width: 82px;" oninput="window.handleF6PvCapChange(${i})" title="Module ${i} Capacity in Wp">
          <span class="input-group-text bg-light text-muted fs-8 px-1.5 border-start-0" style="font-size: 0.70rem; min-width: 32px; justify-content: center;">Wp</span>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  window.syncF6PvSerialsAndCaps();
};

window.handleF6PvCapChange = function(index) {
  if (index === 1) {
    const firstBox = document.getElementById('f6PvCap_1');
    const val = firstBox ? firstBox.value.trim() : '';
    const allBoxes = document.querySelectorAll('.f6-module-cap-box');
    let allOthersEmpty = true;
    for (let i = 1; i < allBoxes.length; i++) {
      if (allBoxes[i].value && allBoxes[i].value.trim() !== '') {
        allOthersEmpty = false;
        break;
      }
    }
    if (allOthersEmpty && val !== '') {
      for (let i = 1; i < allBoxes.length; i++) {
        allBoxes[i].value = val;
      }
    }
  }
  window.syncF6PvSerialsAndCaps();
};

window.applyF6PvCapToAll = function() {
  const firstBox = document.getElementById('f6PvCap_1');
  if (!firstBox) return;
  const val = firstBox.value.trim();
  if (!val) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Please enter a capacity in Module #1 first.', 'info');
    }
    return;
  }
  document.querySelectorAll('.f6-module-cap-box').forEach(box => {
    box.value = val;
  });
  window.syncF6PvSerialsAndCaps();
};

window.handleF6PvCountChange = function() {
  const countInput = document.getElementById('f6PvCount');
  if (!countInput) return;
  window.renderF6PvSerialInputs();
};

window.syncF6PvSerialsAndCaps = function() {
  const serialBoxes = document.querySelectorAll('.f6-module-serial-box');
  const capBoxes = document.querySelectorAll('.f6-module-cap-box');
  const serialsTextarea = document.getElementById('f6PvSerials');
  const capEachInput = document.getElementById('f6PvCapacityEach');
  const totalCapInput = document.getElementById('f6PvTotalCapacity');
  const badge = document.getElementById('lblF6PvSerialCountBadge');

  const count = serialBoxes.length;
  if (badge) {
    badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;
  }

  // 1. Sync Serials into hidden f6PvSerials
  const serialList = [];
  serialBoxes.forEach(box => {
    const val = (box.value || '').trim();
    if (val) serialList.push(val);
  });
  if (serialsTextarea) {
    serialsTextarea.value = serialList.join('\n');
  }

  // 2. Calculate Capacities (in Wp)
  let totalWatts = 0;
  let filledCount = 0;
  const capCounts = {};

  capBoxes.forEach(box => {
    const raw = (box.value || '').trim();
    if (!raw) return;
    const match = raw.match(/([0-9.]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num > 0) {
        filledCount++;
        totalWatts += num;
        const displayLabel = `${num} WP`;
        capCounts[displayLabel] = (capCounts[displayLabel] || 0) + 1;
      }
    }
  });

  if (filledCount > 0 && totalWatts > 0) {
    const totalKW = (totalWatts / 1000).toFixed(2);
    if (totalCapInput) {
      totalCapInput.value = `${totalKW} KWp`;
    }
    if (capEachInput) {
      if (Object.keys(capCounts).length === 1) {
        capEachInput.value = Object.keys(capCounts)[0];
      } else {
        capEachInput.value = Object.entries(capCounts).map(([lbl, c]) => `${lbl} - ${c}pic`).join(', ');
      }
    }
  }
};

function populateForm6Fields(r) {
  if (!r) return;

  let specs = {};
  if (r.ProductSpecs) {
    try {
      specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs;
    } catch (e) {
      specs = {};
    }
  }

  const customerName = (r.Name || '').trim().toUpperCase();
  const consumerNo = (r.ConsumerNo || '').trim();
  const district = (r.District || '').trim().toUpperCase();
  const pinCode = (r.PinCode || specs.PinCode || '').trim();
  const state = (r.State || specs.State || 'Odisha').trim();
  const siteAddress = (r.Address || specs.SiteAddress || (district ? `AT/PO ${district}` : 'ODISHA')).trim().toUpperCase();

  // Header: Only keep Consumer Name
  const consumerLabel = document.getElementById('f6ConsumerNameLabel');
  if (consumerLabel) {
    consumerLabel.textContent = customerName || '—';
  }

  // DISCOM Utility Name
  const discomShort = getDiscomName(district, r.CircleName);
  const discomFull = getDiscomFullName(discomShort);

  // Capacity & Date
  const rawCapacity = (specs.PvModule && specs.PvModule.TotalCapacity) || r.ProposedCapacity || '3.32';
  const capNum = parseFloat(String(rawCapacity).replace(/[^0-9.]/g, '')) || 3.32;
  const plantCapStr = `${Math.round(capNum)} KWP`;
  let totalCapModuleStr = `${capNum.toFixed(2)} KWp`;

  const installDateFormatted = formatDateToMonthWord(specs.DateOfInstallation || r.InstallationDate) || formatDateToMonthWord(new Date());

  // Division / SubDivision / Section
  const sectionVal = (r.Section || (district ? `${district} Section` : 'JAJPUR Section')).trim();
  const subDivVal = (r.SubDivision || (district ? `RE SDO-I ${district} Sub-Division` : 'RE SDO-I JAJPUR Sub-Division')).trim();
  const divisionVal = (r.DivisionName || (district ? `CED ${district} Division` : 'CED JAJPUR Division')).trim();

  // Application / Reg No with Date
  const regNo = (r.ApplicationNumber || (consumerNo ? `NP-ODTN026-${consumerNo.slice(-8)}` : 'NP-ODTN026-10625985')).trim();
  const regDateDash = formatDateToDash(r.LoginDate) || formatDateToDash(r.InstallationDate) || '05.03.2026';
  const regNoWithDate = `${regNo}/${regDateDash}`;

  // Top Header Cert
  setInputVal('f6DiscomOffice', discomFull);
  setInputVal('f6CertCapacity', plantCapStr);
  const formattedFullAddr = `${siteAddress}${district ? `, DIST-${district}` : ''}${pinCode ? `, PIN-${pinCode}` : ''}`;
  setInputVal('f6CertAddress', formattedFullAddr);
  setInputVal('f6InspectionDate', '.....................................');
  setInputVal('f6Section', sectionVal);
  setInputVal('f6SubDivision', subDivVal);
  setInputVal('f6Division', divisionVal);

  // Part A: Applicant Details
  setInputVal('f6ApplicantName', customerName);
  setInputVal('f6RegNoDate', regNoWithDate);
  setInputVal('f6Address', formattedFullAddr);
  setInputVal('f6ConsumerNo', consumerNo || '612222120269');
  setInputVal('f6Category', (r.Tariff || r.Category || 'DOMESTIC').toUpperCase());
  setInputVal('f6ConnectionType', capNum > 5 ? '3PH LT' : '1PH LT');
  const contractDemand = r.Load || `${Math.round(capNum)} KW`;
  setInputVal('f6ContractDemand', contractDemand);
  setInputVal('f6Arrear', r.Arrear || '0');

  // Part B: Distribution Transformer Details (All empty by default as Form 6, except item 4)
  setInputVal('f6DtrCapacity', '');
  setInputVal('f6DtrLocation', '');
  setInputVal('f6DtrExistingSolar', '');
  setInputVal('f6DtrAdequate', 'Yes / No');

  // Part C: Solar Rooftop PV Power Plant Details
  setInputVal('f6PlantCapacity', plantCapStr);
  setInputVal('f6PlantSiteType', 'SINGLE SITE');
  setInputVal('f6PlantPointType', 'SINGLE POINT');
  setInputVal('f6SldStatus', 'YES / NO (if it is no, state reasons for the same and suggest alternate arrangements )');

  // Part D: Grid Tied Inverter
  const brandInfo = parseBrand(r.CommittedBrand);
  const inv = specs.GridTiedInverter || {};
  const invMake = inv.Make || brandInfo.inverterMake || 'LUMINOUS';
  const invCapacity = inv.Capacity ? (String(inv.Capacity).toUpperCase().includes('KW') ? inv.Capacity : `${inv.Capacity} KW`) : `${Math.round(capNum)} KW`;
  const invSerialNo = getOrGenerateInverterSerial(r, specs, invMake);
  const invInputVolt = formatWithUnit(inv.InputVoltage, '300 V DC', 'voltDc');
  const invOutputVolt = formatWithUnit(inv.OutputVoltage, '220-240V AC', 'voltAc');
  const invVoltCombined = `${invInputVolt} / ${invOutputVolt}`;

  setInputVal('f6InvMake', invMake);
  setInputVal('f6InvSerialNo', invSerialNo);
  setInputVal('f6InvCapacity', invCapacity);
  setInputVal('f6InvVolt', invVoltCombined);
  setInputVal('f6InvAntiIslanding', 'Need to be checked practically before charging');
  setInputVal('f6InvInstallDate', installDateFormatted);

  // Part E: P.V Module
  const pv = specs.PvModule || {};
  const moduleMake = pv.Make || brandInfo.moduleMake || 'LUMINOUS';
  const moduleModel = pv.TypeAndModel || 'Bificial';
  const moduleCount = pv.NoOfModule ? (String(pv.NoOfModule).includes('NOS') ? pv.NoOfModule : `${pv.NoOfModule} NOS`) : `${calculateModulesCount(capNum).replace(/[^0-9]/g, '')} NOS`;
  let capEach = pv.CapacityEach ? String(pv.CapacityEach).trim() : '550 WP';
  if (capEach && !/WP/i.test(capEach)) {
    capEach = `${capEach} WP`;
  }
  totalCapModuleStr = pv.TotalCapacity ? String(pv.TotalCapacity).trim() : `${capNum.toFixed(2)} KWp`;
  if (totalCapModuleStr && !/KWp/i.test(totalCapModuleStr)) {
    totalCapModuleStr = `${totalCapModuleStr} KWp`;
  }
  const serials = getOrGenerateSerials(r, specs, moduleCount, moduleMake);
  const capacities = Array.isArray(pv.ModuleCapacities) ? pv.ModuleCapacities : [];

  setInputVal('f6PvMake', moduleMake);
  setInputVal('f6PvModel', moduleModel);
  setInputVal('f6PvTotalCapacity', totalCapModuleStr);
  setInputVal('f6PvCapacityEach', capEach);
  setInputVal('f6PvCount', moduleCount);
  setInputVal('f6PvInstallDate', installDateFormatted);
  setInputVal('f6PvSerials', serials.join('\n'));
  window.renderF6PvSerialInputs(serials, capacities, capEach);

  // Part F & G & H: Earthing & Protective Systems (Values following Form 6)
  const earth = specs.DetailsOfEarthing || {};
  const ev = specs.EarthingVerification || {};
  setInputVal('f6DcEarthing', ev.DcEarthing || earth.DcEarthing || '1.7 in Ohm');
  setInputVal('f6AcEarthing', ev.AcEarthing || earth.AcEarthing || '2.3 in Ohm');
  setInputVal('f6EarthingLimit', 'Within permissible limit or Not (Values should be certified by contractor with HV Supervisory license)');
  setInputVal('f6AcdcDbStatus', 'Yes / No');
  setInputVal('f6ManualSwitch', 'Yes / No');
  setInputVal('f6RelaySwitch', 'Yes / No');
  setInputVal('f6BackfeedProtection', '');

  // Part I - L: Clearances & Statutory Standards (Exact as Form 6)
  setInputVal('f6EicApproval', 'Yes / No');
  setInputVal('f6SafetyCert', 'Yes / No');
  setInputVal('f6WorkCompletionReport', 'Yes / No');
  setInputVal('f6TestReportCea', 'Yes / No');

  // Part M: Meters (All fields empty by default as Form 6)
  setInputVal('f6NmCount', '');
  setInputVal('f6NmMake', '');
  setInputVal('f6NmSerialNo', '');
  setInputVal('f6NmPhase', '');
  setInputVal('f6NmCapacity', '');
  setInputVal('f6NmConstant', '');

  setInputVal('f6SmCount', '');
  setInputVal('f6SmMake', '');
  setInputVal('f6SmSerialNo', '');
  setInputVal('f6SmPhase', '');
  setInputVal('f6SmCapacity', '');
  setInputVal('f6SmConstant', '');

  // Part N: Remarks & Inspection Clearance (Exact as Form 6)
  setInputVal('f6Remarks', '');
  setInputVal('f6GridSatisfactory', 'Yes / No (if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)');
  setInputVal('f6Observations', '');
  setInputVal('f6InspectingAuthority', discomShort);
}

function getForm6CurrentData() {
  if (typeof window.syncF6PvSerialsAndCaps === 'function') {
    window.syncF6PvSerialsAndCaps();
  }
  const currentCust = selectedCustomerSlNo 
    ? getInstallmentRows().find(x => Number(x.SlNo) === Number(selectedCustomerSlNo))
    : null;

  const rawSerials = getInputVal('f6PvSerials', '');
  const serialsList = rawSerials ? rawSerials.split('\n').map(s => s.trim()).filter(Boolean) : [];

  const custDist = currentCust ? (currentCust.District || '').toUpperCase() : '';
  const custCircle = getDiscomName(custDist, currentCust ? currentCust.CircleName : '');

  return {
    discomOffice: getInputVal('f6DiscomOffice', getDiscomFullName(custCircle)),
    certCapacity: getInputVal('f6CertCapacity', '3 KWP'),
    certAddress: getInputVal('f6CertAddress', ''),
    inspectionDate: getInputVal('f6InspectionDate', '.....................................') || '.....................................',
    section: getInputVal('f6Section', 'JAJPUR Section'),
    subDivision: getInputVal('f6SubDivision', 'RE SDO-I JAJPUR Sub-Division'),
    division: getInputVal('f6Division', 'CED JAJPUR Division'),

    applicantName: getInputVal('f6ApplicantName', currentCust ? (currentCust.Name || '').toUpperCase() : ''),
    regNoDate: getInputVal('f6RegNoDate', ''),
    address: getInputVal('f6Address', ''),
    consumerNo: getInputVal('f6ConsumerNo', currentCust ? (currentCust.ConsumerNo || '') : ''),
    category: getInputVal('f6Category', 'DOMESTIC'),
    connectionType: getInputVal('f6ConnectionType', '1PH LT'),
    contractDemand: getInputVal('f6ContractDemand', '3 KW'),
    arrear: getInputVal('f6Arrear', '0'),

    dtrCapacity: getInputVal('f6DtrCapacity', ''),
    dtrLocation: getInputVal('f6DtrLocation', ''),
    dtrExistingSolar: getInputVal('f6DtrExistingSolar', ''),
    dtrAdequate: getInputVal('f6DtrAdequate', 'Yes / No') || 'Yes / No',

    plantCapacity: getInputVal('f6PlantCapacity', '3 KWP'),
    plantSiteType: getInputVal('f6PlantSiteType', 'SINGLE SITE'),
    plantPointType: getInputVal('f6PlantPointType', 'SINGLE POINT'),
    sldStatus: getInputVal('f6SldStatus', 'YES / NO (if it is no, state reasons for the same and suggest alternate arrangements )'),

    invMake: getInputVal('f6InvMake', 'LUMINOUS'),
    invSerialNo: getInputVal('f6InvSerialNo', ''),
    invCapacity: getInputVal('f6InvCapacity', '3 KW'),
    invVolt: getInputVal('f6InvVolt', '300 V DC / 220-240V AC'),
    invAntiIslanding: getInputVal('f6InvAntiIslanding', 'Need to be checked practically before charging'),
    invInstallDate: getInputVal('f6InvInstallDate', '12 SEP 2026'),

    pvMake: getInputVal('f6PvMake', 'LUMINOUS'),
    pvModel: getInputVal('f6PvModel', 'Bificial'),
    pvTotalCapacity: (() => {
      let v = getInputVal('f6PvTotalCapacity', '3.32 KWp').trim();
      return (v && !/KWp/i.test(v)) ? `${v} KWp` : (v || '3.32 KWp');
    })(),
    pvCapacityEach: (() => {
      let v = getInputVal('f6PvCapacityEach', '555 WP - 4pic, 550 WP - 2pic').trim();
      return (v && !/WP/i.test(v)) ? `${v} WP` : (v || '555 WP - 4pic, 550 WP - 2pic');
    })(),
    pvCount: getInputVal('f6PvCount', '6 NOS'),
    pvInstallDate: getInputVal('f6PvInstallDate', '2026'),
    pvSerials: serialsList,

    dcEarthing: getInputVal('f6DcEarthing', '1.7 in Ohm'),
    acEarthing: getInputVal('f6AcEarthing', '2.3 in Ohm'),
    earthingLimit: getInputVal('f6EarthingLimit', 'Within permissible limit or Not (Values should be certified by contractor with HV Supervisory license)'),

    acdcDbStatus: getInputVal('f6AcdcDbStatus', 'Yes / No'),
    manualSwitch: getInputVal('f6ManualSwitch', 'Yes / No'),
    relaySwitch: getInputVal('f6RelaySwitch', 'Yes / No'),
    backfeedProtection: getInputVal('f6BackfeedProtection', ''),

    eicApproval: getInputVal('f6EicApproval', 'Yes / No'),
    safetyCert: getInputVal('f6SafetyCert', 'Yes / No'),
    workCompletionReport: getInputVal('f6WorkCompletionReport', 'Yes / No'),
    testReportCea: getInputVal('f6TestReportCea', 'Yes / No'),

    nmCount: getInputVal('f6NmCount', ''),
    nmMake: getInputVal('f6NmMake', ''),
    nmSerialNo: getInputVal('f6NmSerialNo', ''),
    nmPhase: getInputVal('f6NmPhase', ''),
    nmCapacity: getInputVal('f6NmCapacity', ''),
    nmConstant: getInputVal('f6NmConstant', ''),

    smCount: getInputVal('f6SmCount', ''),
    smMake: getInputVal('f6SmMake', ''),
    smSerialNo: getInputVal('f6SmSerialNo', ''),
    smPhase: getInputVal('f6SmPhase', ''),
    smCapacity: getInputVal('f6SmCapacity', ''),
    smConstant: getInputVal('f6SmConstant', ''),

    remarks: getInputVal('f6Remarks', ''),
    gridSatisfactory: getInputVal('f6GridSatisfactory', 'Yes / No (if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)'),
    observations: getInputVal('f6Observations', ''),
    inspectingAuthority: getInputVal('f6InspectingAuthority', custCircle || 'TPNODL')
  };
}

window.resetForm6Fields = function() {
  if (selectedCustomerSlNo) {
    const rows = getInstallmentRows();
    const r = rows.find(x => Number(x.SlNo) === Number(selectedCustomerSlNo));
    if (r) {
      populateForm6Fields(r);
      UI.toast(`Form 6 fields reset to ${r.Name}'s record.`, 'info');
      return;
    }
  }
  const consumerLabel = document.getElementById('f6ConsumerNameLabel');
  if (consumerLabel) consumerLabel.textContent = '—';
  if (typeof window.renderF6PvSerialInputs === 'function') {
    window.renderF6PvSerialInputs([], []);
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   Form 6: Modal Preview & Print
   ════════════════════════════════════════════════════════════════════════════ */

window.previewForm6Modal = function() {
  const d = getForm6CurrentData();
  const container = document.getElementById('form6PreviewBody');
  if (!container) return;

  const serialsHtml = d.pvSerials.length > 0
    ? d.pvSerials.map(s => escapeHtml(s)).join('<br>')
    : '<span class="text-muted fst-italic">None entered</span>';

  const html = `
    <!-- Page 1 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <div class="text-center mb-2.5">
        <h5 class="fw-bold mb-0 text-dark" style="font-size: 14px; letter-spacing: 0.02em;">${escapeHtml(d.discomOffice)}</h5>
        <div class="fw-bold text-dark text-decoration-underline mt-0.5" style="font-size: 13px;">INSPECTION REPORT FOR RTS (FORM-06)</div>
      </div>

      <div class="mb-3 text-justify" style="font-size: 10px; line-height: 1.5;">
        Certified that the ${escapeHtml(d.certCapacity)} SPV system ${escapeHtml(d.certAddress)} under ${escapeHtml(d.section)} Section ${escapeHtml(d.subDivision)} Sub-Division &amp; ${escapeHtml(d.division)} Division has been inspected on date${escapeHtml(d.inspectionDate && !d.inspectionDate.startsWith('.') && d.inspectionDate !== '________' ? ' ' + d.inspectionDate : '.....................................')}.<br>
        <div class="text-center mt-1">
          <u class="fw-bold">The details of inspection report are as below:</u>
        </div>
        <div class="text-center fw-bold mt-0.5">
          Inspection Report for ${escapeHtml(d.certCapacity)} Solar Roof Top PV System (SRTPV) ${escapeHtml(d.certAddress)}
        </div>
      </div>

      <table class="form4-preview-table mb-1">
        <thead>
          <tr class="fw-bold bg-light">
            <th style="width: 35px; text-align: center;">Sl. No.</th>
            <th style="width: 50%;">Parameter</th>
            <th style="width: 45%;">Utility Observation</th>
          </tr>
        </thead>
        <tbody>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">A</td>
            <td>Applicant Details</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Name of the Applicant</td>
            <td>${escapeHtml(d.applicantName)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Application No./Registration No. with Date</td>
            <td>${escapeHtml(d.regNoDate)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Address</td>
            <td>${escapeHtml(d.address)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Consumer Number</td>
            <td style="font-family: monospace;">${escapeHtml(d.consumerNo)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Consumer Category</td>
            <td>${escapeHtml(d.category)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Type of Connection: 1ph LT or 3 ph LT/HT</td>
            <td>${escapeHtml(d.connectionType)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Contract demand of consumer</td>
            <td>${escapeHtml(d.contractDemand)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">7</td>
            <td>Arrear, if any</td>
            <td>${escapeHtml(d.arrear)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">B</td>
            <td>Distribution Transformer Details</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Capacity in KVA</td>
            <td>${escapeHtml(d.dtrCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Location</td>
            <td>${escapeHtml(d.dtrLocation)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp</td>
            <td>${escapeHtml(d.dtrExistingSolar)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems</td>
            <td>${escapeHtml(d.dtrAdequate)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">C</td>
            <td>Solar Rooftop PV Power Plant Details</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Details of proposed power plant<br>(a) Capacity of the SPV Power Plant (kWp)<br>(b) Plant proposed at single site/multiple sites<br>(c) Interconnection with the electricity network at single point or multiple point</td>
            <td>A. ${escapeHtml(d.plantCapacity)}<br>B. ${escapeHtml(d.plantSiteType)}<br>C. ${escapeHtml(d.plantPointType)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Whether the Single Line Diagram of the SRTPV System (Submitted by the consumer indicating all the Safety aspects of Grid Connectivity) is OK for grid Connectivity</td>
            <td>${escapeHtml(d.sldStatus)}</td>
          </tr>
        </tbody>
      </table>
      <div class="text-end text-muted font-monospace" style="font-size: 9px;">Page 1 of 3</div>
    </div>

    <!-- Page 2 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <table class="form4-preview-table mb-1">
        <tbody>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">D</td>
            <td>Grid Tied Inverter</td>
            <td></td>
          </tr>
          <tr>
            <td style="width: 35px; text-align: center;">1</td>
            <td style="width: 50%;">Make</td>
            <td style="width: 45%;">${escapeHtml(d.invMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Serial No.</td>
            <td style="font-family: monospace;">${escapeHtml(d.invSerialNo)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Capacity</td>
            <td>${escapeHtml(d.invCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Input Voltage/ Output Voltage</td>
            <td>${escapeHtml(d.invVolt)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Whether Anti-islanding feature is in working condition</td>
            <td>${escapeHtml(d.invAntiIslanding)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Date of installation</td>
            <td>${escapeHtml(d.invInstallDate)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">E</td>
            <td>P.V Module</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Make</td>
            <td>${escapeHtml(d.pvMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center; vertical-align: top;">2</td>
            <td style="vertical-align: top;">Serial No.</td>
            <td style="vertical-align: top; font-family: monospace; font-size: 10px;">${serialsHtml}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Type of Module &amp; model</td>
            <td>${escapeHtml(d.pvModel)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>Capacity of each Module</td>
            <td>${escapeHtml(d.pvCapacityEach)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>No. of Module</td>
            <td>${escapeHtml(d.pvCount)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Total capacity of Module</td>
            <td>${escapeHtml(d.pvTotalCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">7</td>
            <td>Date of installation</td>
            <td>${escapeHtml(d.pvInstallDate)}</td>
          </tr>
          <tr class="bg-light">
            <td style="text-align: center; font-weight: bold;">F</td>
            <td>
              <strong class="fw-bold">Earthing Verification</strong><br>
              (i) D.C Earthing<br>
              (ii) A.C Earthing
            </td>
            <td>
              (i) ${escapeHtml(d.dcEarthing)}&nbsp;&nbsp;&nbsp;&nbsp;(ii) ${escapeHtml(d.acEarthing)}<br>
              <div class="mt-1" style="font-size: 10px; line-height: 1.35;">
                Within permissible limit or Not (Values should be certified by contractor with HV Supervisory license)
              </div>
            </td>
          </tr>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">G</td>
            <td>Details of protective system available</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;"></td>
            <td>(i) AC &amp; DC DB: Yes/No<br>(ii) Manual Switch at Solar Side: Yes/No<br>(iii) Relay operated automatic switch at net-meter side: Yes/ No</td>
            <td>(i) ${escapeHtml(d.acdcDbStatus)}<br>(ii) ${escapeHtml(d.manualSwitch)}<br>(iii) ${escapeHtml(d.relaySwitch)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">H</td>
            <td>Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other</td>
            <td>${escapeHtml(d.backfeedProtection)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">I</td>
            <td>EIC inspection and approval letter Submitted by the consumer above 50KVA</td>
            <td>${escapeHtml(d.eicApproval)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">J</td>
            <td>Safety certificate from designated Safety officer of ${escapeHtml(d.inspectingAuthority)} below 50KVA</td>
            <td>${escapeHtml(d.safetyCert)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">K</td>
            <td>Work Completion Report of SRTPV by consumer</td>
            <td>${escapeHtml(d.workCompletionReport)}</td>
          </tr>
        </tbody>
      </table>
      <div class="text-end text-muted font-monospace" style="font-size: 9px;">Page 2 of 3</div>
    </div>

    <!-- Page 3 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-2">
      <table class="form4-preview-table mb-2">
        <tbody>
          <tr>
            <td style="width: 35px; text-align: center; font-weight: bold;">L</td>
            <td style="width: 50%;">Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards</td>
            <td style="width: 45%;">${escapeHtml(d.testReportCea || 'Yes/No')}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td style="text-align: center;">M</td>
            <td>Meter Details (If arranged before Inspection)</td>
            <td class="p-0">
              <div class="d-flex w-100 h-100" style="margin: 0;">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;" class="fw-bold">Net Meter<br>(Bi-directional Meter)</div>
                <div style="width: 50%; padding: 3px 6px;" class="fw-bold">Solar Generation Meter<br>(Details)</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">1</td>
            <td>Total Nos. of Meters</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;">${escapeHtml(d.nmCount)}</div>
                <div style="width: 50%; padding: 3px 6px;">${escapeHtml(d.smCount)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">2</td>
            <td>Meter Make</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;">${escapeHtml(d.nmMake)}</div>
                <div style="width: 50%; padding: 3px 6px;">${escapeHtml(d.smMake)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">3</td>
            <td>Meter Sl. No.</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px; font-family: monospace;">${escapeHtml(d.nmSerialNo)}</div>
                <div style="width: 50%; padding: 3px 6px; font-family: monospace;">${escapeHtml(d.smSerialNo)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">4</td>
            <td>1 Ph/ 3Ph</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;">${escapeHtml(d.nmPhase)}</div>
                <div style="width: 50%; padding: 3px 6px;">${escapeHtml(d.smPhase)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">5</td>
            <td>Capacity</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;">${escapeHtml(d.nmCapacity)}</div>
                <div style="width: 50%; padding: 3px 6px;">${escapeHtml(d.smCapacity)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">6</td>
            <td>Meter Constant</td>
            <td class="p-0">
              <div class="d-flex w-100">
                <div style="width: 50%; border-right: 1px solid #000; padding: 3px 6px;">${escapeHtml(d.nmConstant)}</div>
                <div style="width: 50%; padding: 3px 6px;">${escapeHtml(d.smConstant)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="width: 35px; text-align: center; font-weight: bold;">N</td>
            <td style="width: 50%;">Any other necessary details with Remarks</td>
            <td style="width: 45%;">${escapeHtml(d.remarks)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="2">Inspection Report</td>
            <td></td>
          </tr>
          <tr class="fw-bold">
            <td colspan="2">Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization</td>
            <td style="font-weight: normal;">
              <div class="fw-bold">Yes/No</div>
              <div style="font-size: 9.5px; line-height: 1.35; margin-top: 2px;">
                (if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures & Observations Block with ample space matching Image 1 -->
      <div style="margin-top: 55px; margin-bottom: 25px; font-size: 11px;">
        <div class="d-flex justify-content-between align-items-start">
          <div style="width: 52%;">
            <div class="fw-bold text-decoration-underline mb-2" style="font-size: 11.5px;">Observations (If any)</div>
            <div style="min-height: 80px; padding-top: 6px; font-size: 10px; color: #222;">
              ${escapeHtml(d.observations || '')}
            </div>
          </div>
          <div style="width: 45%; text-align: left; padding-left: 20px;">
            <div class="fw-bold" style="font-size: 11.5px;">Authorized signatory ${escapeHtml(d.inspectingAuthority)}</div>
            <div class="fw-bold mt-1" style="font-size: 11.5px;">Date-</div>
          </div>
        </div>
      </div>

      <div class="text-end text-muted font-monospace mt-3" style="font-size: 9px;">Page 3 of 3</div>
    </div>
  `;

  container.innerHTML = html;
  const modalEl = document.getElementById('form6PreviewModal');
  if (modalEl) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
};

window.printForm6Preview = function() {
  const container = document.getElementById('form6PreviewBody');
  if (!container) return;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    UI.toast('Please allow popups to print the Form 6 document.', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Inspection Report for RTS (Form-06)</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
        .form4-preview-sheet { max-width: 800px; margin: 0 auto 30px auto; page-break-after: always; }
        .form4-preview-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .form4-preview-table th, .form4-preview-table td { border: 1px solid #000; padding: 3px 6px; font-size: 11px; vertical-align: top; }
        .bg-light { background-color: #f8f9fa !important; }
        .fw-bold { font-weight: bold; }
        .text-center { text-align: center; }
        .text-end { text-align: right; }
        .row { display: flex; flex-wrap: wrap; }
        .col-6 { width: 50%; box-sizing: border-box; }
        .offset-6 { margin-left: 50%; }
        @media print {
          body { padding: 0; }
          .form4-preview-sheet { margin: 0; page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${container.innerHTML}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

/* ════════════════════════════════════════════════════════════════════════════
   Form 6: Exact Vector PDF Generator using jsPDF
   ════════════════════════════════════════════════════════════════════════════ */

window.downloadForm6Pdf = function() {
  const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPdfClass) {
    UI.toast('jsPDF library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }

  if (!selectedCustomerSlNo) {
    const rows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
    if (rows.length > 0) {
      selectCustomerForAgreement(rows[0].SlNo);
    } else {
      UI.toast('Please select a customer first from the list.', 'warning');
      return;
    }
  }

  UI.showLoading(true);

  try {
    const d = getForm6CurrentData();
    const doc = new jsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 14;
    const tableWidth = 182;
    const col1Width = 12;
    const col2Width = 86;
    const col3Width = 84;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // Helper: Draw standard 3-column row
    function drawTableRow(y, slText, labelText, valText, opt = {}) {
      const fontSize = opt.fontSize || 8.5;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

      const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
      const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);

      const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
      const lineHeight = opt.lineHeight || 4.2;
      const padding = 2.4;
      const rowHeight = Math.max(opt.minHeight || 5.8, maxLines * lineHeight + padding);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

      if (slText) {
        if (opt.slBold) doc.setFont('helvetica', 'bold');
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
        if (opt.slBold) doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');
      }

      doc.text(col2Lines, marginX + col1Width + 2, y + 4.2);

      if (opt.valFontMono) doc.setFont('courier', opt.valBold ? 'bold' : 'normal');
      doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 4.2);
      if (opt.valFontMono) doc.setFont('helvetica', 'normal');

      return y + rowHeight;
    }

    // Helper: Draw section header row matching Image 2
    function drawTableHeader(y, slLetter, headerTitle, opt = {}) {
      const fontSize = opt.fontSize || 9;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');

      const rowHeight = opt.minHeight || 6.2;

      // Light grey fill matching Image 2
      doc.setFillColor(240, 240, 240);
      doc.rect(marginX, y, tableWidth, rowHeight, 'F');

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

      if (slLetter) {
        doc.text(String(slLetter), marginX + (col1Width / 2), y + 4.3, { align: 'center' });
      }
      doc.text(headerTitle || '', marginX + col1Width + 2, y + 4.3);
      return y + rowHeight;
    }

    // Helper: Draw 4-column meter row matching Image 1
    function drawMeterItemRow(y, slText, paramText, netVal, solarVal, opt = {}) {
      const nmWidth = 42;
      const smWidth = 42;
      const rowHeight = opt.minHeight || 5.8;

      doc.setFontSize(8.5);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width + nmWidth, y, marginX + col1Width + col2Width + nmWidth, y + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.text(paramText || '', marginX + col1Width + 2, y + 4.2);

      if (opt.mono) doc.setFont('courier', 'normal');
      doc.text(netVal || '', marginX + col1Width + col2Width + 2, y + 4.2);
      doc.text(solarVal || '', marginX + col1Width + col2Width + nmWidth + 2, y + 4.2);
      if (opt.mono) doc.setFont('helvetica', 'normal');

      return y + rowHeight;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1
    // ══════════════════════════════════════════════════════════════════════════
    let curY = 16;

    // Header Title
    doc.setFontSize(12.5);
    doc.setFont('helvetica', 'bold');
    doc.text(d.discomOffice, pageWidth / 2, curY, { align: 'center' });
    curY += 5.5;

    doc.setFontSize(11);
    const formTitle = 'INSPECTION REPORT FOR RTS (FORM-06)';
    doc.text(formTitle, pageWidth / 2, curY, { align: 'center' });
    const formTitleW = doc.getTextWidth(formTitle);
    doc.setLineWidth(0.3);
    doc.line((pageWidth - formTitleW) / 2, curY + 1, (pageWidth + formTitleW) / 2, curY + 1);
    curY += 6.5;

    // Inspection Certification Paragraph with exact dotted line matching Image 2
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const dotDateStr = (d.inspectionDate && !d.inspectionDate.startsWith('.') && d.inspectionDate !== '________')
      ? ' ' + d.inspectionDate
      : '.....................................';
    const certText = `Certified that the ${d.certCapacity} SPV system ${d.certAddress} under ${d.section} Section ${d.subDivision} Sub-Division & ${d.division} Division has been inspected on date${dotDateStr}`;
    const certLines = doc.splitTextToSize(certText, tableWidth);
    doc.text(certLines, marginX, curY);
    curY += (certLines.length * 3.8) + 2.5;

    const subText1 = 'The details of inspection report are as below:';
    doc.setFont('helvetica', 'bold');
    doc.text(subText1, pageWidth / 2, curY, { align: 'center' });
    const subText1W = doc.getTextWidth(subText1);
    doc.setLineWidth(0.25);
    doc.line((pageWidth - subText1W) / 2, curY + 0.8, (pageWidth + subText1W) / 2, curY + 0.8);
    curY += 4.5;

    const subText2 = `Inspection Report for ${d.certCapacity} Solar Roof Top PV System (SRTPV) ${d.certAddress}`;
    const subText2Lines = doc.splitTextToSize(subText2, tableWidth);
    doc.text(subText2Lines, pageWidth / 2, curY, { align: 'center' });
    curY += (subText2Lines.length * 3.8) + 3;

    // Table Column Headers (All BOLD)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const headerHeight = 6.2;
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, headerHeight);
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + headerHeight);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + headerHeight);
    doc.text('Sl. No.', marginX + (col1Width / 2), curY + 4.2, { align: 'center' });
    doc.text('Parameter', marginX + col1Width + 2, curY + 4.2);
    doc.text('Utility Observation', marginX + col1Width + col2Width + 2, curY + 4.2);
    curY += headerHeight;

    // PART A: Applicant Details (Bold Section Header matching Image 2)
    curY = drawTableHeader(curY, 'A', 'Applicant Details');
    curY = drawTableRow(curY, '1', 'Name of the Applicant', d.applicantName);
    curY = drawTableRow(curY, '2', 'Application No./Registration No. with Date', d.regNoDate);
    curY = drawTableRow(curY, '2', 'Address', d.address);
    curY = drawTableRow(curY, '3', 'Consumer Number', d.consumerNo, { valFontMono: true });
    curY = drawTableRow(curY, '4', 'Consumer Category', d.category);
    curY = drawTableRow(curY, '5', 'Type of Connection: 1ph LT or 3 ph LT/HT', d.connectionType);
    curY = drawTableRow(curY, '6', 'Contract demand of consumer', d.contractDemand);
    curY = drawTableRow(curY, '7', 'Arrear, if any', d.arrear);

    // PART B: Distribution Transformer Details (Bold Section Header)
    curY = drawTableHeader(curY, 'B', 'Distribution Transformer Details');
    curY = drawTableRow(curY, '1', 'Capacity in KVA', d.dtrCapacity);
    curY = drawTableRow(curY, '2', 'Location', d.dtrLocation);
    curY = drawTableRow(curY, '3', 'Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp', d.dtrExistingSolar);
    curY = drawTableRow(curY, '4', 'Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems', d.dtrAdequate);

    // PART C: Solar Rooftop PV Power Plant Details (Bold Section Header)
    curY = drawTableHeader(curY, 'C', 'Solar Rooftop PV Power Plant Details');
    const partC1Label = 'Details of proposed power plant\n(a) Capacity of the SPV Power Plant (kWp)\n(b) Plant proposed at single site/multiple sites\n(c) Interconnection with the electricity network at single point or multiple point';
    const partC1Val = `A. ${d.plantCapacity}\nB. ${d.plantSiteType}\nC. ${d.plantPointType}`;
    curY = drawTableRow(curY, '1', partC1Label, partC1Val);
    curY = drawTableRow(curY, '2', 'Whether the Single Line Diagram of the SRTPV System (Submitted by the consumer indicating all the Safety aspects of Grid Connectivity) is OK for grid Connectivity', d.sldStatus);

    // Page 1 Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 1 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    curY = 16;

    // PART D: Grid Tied Inverter (Bold Section Header)
    curY = drawTableHeader(curY, 'D', 'Grid Tied Inverter');
    curY = drawTableRow(curY, '1', 'Make', d.invMake);
    curY = drawTableRow(curY, '2', 'Serial No.', d.invSerialNo, { valFontMono: true });
    curY = drawTableRow(curY, '3', 'Capacity', d.invCapacity);
    curY = drawTableRow(curY, '4', 'Input Voltage/ Output Voltage', d.invVolt);
    curY = drawTableRow(curY, '5', 'Whether Anti-islanding feature is in working condition', d.invAntiIslanding);
    curY = drawTableRow(curY, '6', 'Date of installation', d.invInstallDate);

    // PART E: P.V Module (Bold Section Header)
    curY = drawTableHeader(curY, 'E', 'P.V Module');
    curY = drawTableRow(curY, '1', 'Make', d.pvMake);
    const serialsLinesStr = d.pvSerials.length > 0 ? d.pvSerials.join('\n') : '';
    curY = drawTableRow(curY, '2', 'Serial No.', serialsLinesStr, { valFontMono: true, fontSize: 8 });
    curY = drawTableRow(curY, '3', 'Type of Module & model', d.pvModel);
    curY = drawTableRow(curY, '4', 'Capacity of each Module', d.pvCapacityEach);
    curY = drawTableRow(curY, '5', 'No. of Module', d.pvCount);
    curY = drawTableRow(curY, '6', 'Total capacity of Module', d.pvTotalCapacity);
    curY = drawTableRow(curY, '7', 'Date of installation', d.pvInstallDate);

    // PART F: Earthing Verification (Merged single row matching Original Form 6)
    const earthingLabel = 'Earthing Verification\n(i) D.C Earthing\n(ii) A.C Earthing';
    const earthingVal = `(i) ${d.dcEarthing}    (ii) ${d.acEarthing}\nWithin permissible limit or Not (Values should be certified by contractor with HV Supervisory license)`;
    curY = drawTableRow(curY, 'F', earthingLabel, earthingVal, { slBold: true });

    // PART G: Protective Systems (Bold Section Header)
    curY = drawTableHeader(curY, 'G', 'Details of protective system available');
    const protLabel = '(i) AC & DC DB: Yes/No\n(ii) Manual Switch at Solar Side: Yes/No\n(iii) Relay operated automatic switch at net-meter side: Yes/ No';
    const protVal = `(i) ${d.acdcDbStatus}\n(ii) ${d.manualSwitch}\n(iii) ${d.relaySwitch}`;
    curY = drawTableRow(curY, '', protLabel, protVal);

    // PART H, I, J, K
    curY = drawTableRow(curY, 'H', 'Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other', d.backfeedProtection, { slBold: true });
    curY = drawTableRow(curY, 'I', 'EIC inspection and approval letter Submitted by the consumer above 50KVA', d.eicApproval, { slBold: true });
    curY = drawTableRow(curY, 'J', `Safety certificate from designated Safety officer of ${d.inspectingAuthority} below 50KVA`, d.safetyCert, { slBold: true });
    curY = drawTableRow(curY, 'K', 'Work Completion Report of SRTPV by consumer', d.workCompletionReport, { slBold: true });

    // Page 2 Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 2 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 3
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    curY = 16;

    // PART L: Test Report
    curY = drawTableRow(curY, 'L', 'Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards', d.testReportCea || 'Yes/No', { slBold: true });

    // PART M: Meter Details (4-Column Subtable integrated matching Image 1)
    const nmWidth = 42;
    const smWidth = 42;
    const mHeadHeight = 9.5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX, curY, tableWidth, mHeadHeight, 'F');

    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, mHeadHeight);
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + mHeadHeight);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + mHeadHeight);
    doc.line(marginX + col1Width + col2Width + nmWidth, curY, marginX + col1Width + col2Width + nmWidth, curY + mHeadHeight);

    doc.text('M', marginX + (col1Width / 2), curY + 5.5, { align: 'center' });
    doc.text('Meter Details (If arranged before Inspection)', marginX + col1Width + 2, curY + 5.5);
    doc.text(['Net Meter', '(Bi-directional Meter)'], marginX + col1Width + col2Width + 2, curY + 4.2);
    doc.text(['Solar Generation Meter', '(Details)'], marginX + col1Width + col2Width + nmWidth + 2, curY + 4.2);
    curY += mHeadHeight;

    curY = drawMeterItemRow(curY, '1', 'Total Nos. of Meters', d.nmCount, d.smCount);
    curY = drawMeterItemRow(curY, '2', 'Meter Make', d.nmMake, d.smMake);
    curY = drawMeterItemRow(curY, '3', 'Meter Sl. No.', d.nmSerialNo, d.smSerialNo, { mono: true });
    curY = drawMeterItemRow(curY, '4', '1 Ph/ 3Ph', d.nmPhase, d.smPhase);
    curY = drawMeterItemRow(curY, '5', 'Capacity', d.nmCapacity, d.smCapacity);
    curY = drawMeterItemRow(curY, '6', 'Meter Constant', d.nmConstant, d.smConstant);

    // PART N: Any other necessary details with Remarks
    curY = drawTableRow(curY, 'N', 'Any other necessary details with Remarks', d.remarks, { slBold: true });

    // Inspection Report Header Row (Cols 1+2 on left, Col 3 on right) matching Image 1
    const leftWidth = col1Width + col2Width; // 98
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX, curY, tableWidth, 6.2, 'F');
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, 6.2);
    doc.line(marginX + leftWidth, curY, marginX + leftWidth, curY + 6.2);
    doc.text('Inspection Report', marginX + 2, curY + 4.3);
    curY += 6.2;

    // Synchronization Row matching Image 1
    const syncLeftText = 'Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization';
    const syncRightSubText = '(if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)';
    const syncLeftLines = doc.splitTextToSize(syncLeftText, leftWidth - 4);
    const syncRightLines = doc.splitTextToSize(syncRightSubText, col3Width - 4);
    const syncRowHeight = Math.max(16, (syncRightLines.length * 3.8) + 8.5);

    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, syncRowHeight);
    doc.line(marginX + leftWidth, curY, marginX + leftWidth, curY + syncRowHeight);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(syncLeftLines, marginX + 2, curY + 5);

    doc.text('Yes/No', marginX + leftWidth + 2, curY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(syncRightLines, marginX + leftWidth + 2, curY + 9.5);
    curY += syncRowHeight;

    // Substantial space before Observations & Signatures matching Image 1
    curY += 28;

    // Right Column: Authorized signatory TPNODL & Date-
    const sigX = marginX + (tableWidth / 2) + 20;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Authorized signatory ${d.inspectingAuthority}`, sigX, curY);
    curY += 5.5;
    doc.text('Date-', sigX, curY);

    // Left Column: Observations (If any) - matching Image 1
    const obsY = curY + 6;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Observations (If any)', marginX + 16, obsY);
    const obsTextW = doc.getTextWidth('Observations (If any)');
    doc.setLineWidth(0.3);
    doc.line(marginX + 16, obsY + 1.2, marginX + 16 + obsTextW, obsY + 1.2);

    if (d.observations) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const obsLines = doc.splitTextToSize(d.observations, 90);
      doc.text(obsLines, marginX + 16, obsY + 6);
    }

    // Page 3 Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 3 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    // Clean Filename
    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanConsumerNo = (d.consumerNo || 'Form6').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_6_${cleanName}_${cleanConsumerNo}.pdf`;

    doc.save(fileName);
    UI.toast(`Form 6 PDF (${fileName}) downloaded successfully!`, 'success');
  } catch (err) {
    console.error('Error generating Form 6 PDF:', err);
    UI.toast(`Error generating Form 6 PDF: ${err.message}`, 'danger');
  } finally {
    UI.showLoading(false);
  }
};


/* ════════════════════════════════════════════════════════════════════════════
   Form 1: Application for Net Metering Connection Logic & Generators
   ════════════════════════════════════════════════════════════════════════════ */

function formatDateToInputDate(dStr) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (_) {
    return '';
  }
}

window.updateF1MeterProcurementUI = function() {
  const isBen = document.getElementById('f1MeterProcBeneficiary')?.checked;
  const hiddenInput = document.getElementById('f1MeterProcurement');
  if (hiddenInput) {
    hiddenInput.value = isBen ? 'Beneficiary' : 'DISCOM';
  }
  const benBadge = document.getElementById('f1ProcBeneficiaryBadge');
  const discomBadge = document.getElementById('f1ProcDiscomBadge');
  if (benBadge && discomBadge) {
    if (isBen) {
      benBadge.textContent = '☑';
      benBadge.className = 'badge bg-success bg-opacity-10 text-success border ms-1';
      discomBadge.textContent = '□';
      discomBadge.className = 'badge bg-light text-secondary border ms-1';
    } else {
      discomBadge.textContent = '☑';
      discomBadge.className = 'badge bg-success bg-opacity-10 text-success border ms-1';
      benBadge.textContent = '□';
      benBadge.className = 'badge bg-light text-secondary border ms-1';
    }
  }
};

window.populateForm1Fields = function(r) {
  if (!r) return;
  const f1Label = document.getElementById('f1ConsumerNameLabel');
  if (f1Label) f1Label.textContent = r.Name || '—';

  let specs = {};
  if (r.ProductSpecs) {
    try {
      specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs;
    } catch (e) { specs = {}; }
  } else if (r.Specifications) {
    try {
      specs = typeof r.Specifications === 'string' ? JSON.parse(r.Specifications) : r.Specifications;
    } catch (e) { specs = {}; }
  }

  const district = (specs.District || r.District || '').trim();
  const circle = (r.CircleName || r.Circle || '').trim();
  const discomShort = getDiscomName(district, circle);
  const discomOffice = `The Designated Officer ${discomShort}`;

  const appDate = r.LoginDate || r.InstallationDate || r.CreatedDate || new Date();
  const todayInput = formatDateToInputDate(appDate);

  const applicantName = r.Name ? (r.Name.startsWith('Mr.') || r.Name.startsWith('Mrs.') || r.Name.startsWith('Ms.') ? r.Name : 'Mr. ' + r.Name) : '';

  const siteAddress = (specs.SiteAddress || r.Address || '').trim();
  const pinCode = (specs.PinCode || r.PinCode || '').trim();
  const addrParts = [];
  if (siteAddress) addrParts.push(siteAddress);
  if (district) addrParts.push(`Dist-${district}`);
  if (pinCode) addrParts.push(pinCode);
  const fullAddr = addrParts.join(', ');

  const pv = specs.PvModule || {};
  const capRaw = pv.TotalCapacity || r.ProposedCapacity || r.Capacity || '3';
  const capNum = parseFloat(String(capRaw).replace(/[^0-9.]/g, '')) || 3;
  const reTypeCapacity = `Solar – ${capNum.toFixed(1)}kwp`;
  const sanctionLoad = r.SanctionLoad || Math.round(capNum) || 3;
  const category = r.ConsumerCategory || r.Category || 'Domestic';
  const connectionType = (specs.ConnectionType || (capNum > 5 ? '3ph LT' : '1ph LT')).trim();
  const voltage = connectionType.toLowerCase().includes('3') ? '415 V' : '230 V';
  const brandInfo = parseBrand(r.CommittedBrand);
  const inv = specs.GridTiedInverter || {};
  const invMake = inv.Make || brandInfo.inverterMake || 'V-GUARD';

  setInputVal('f1DiscomOffice', discomOffice);
  setInputVal('f1Date', todayInput);
  setInputVal('f1ApplicantName', applicantName);
  setInputVal('f1ConsumerNo', r.ConsumerNo || '');
  setInputVal('f1Address', fullAddr);
  setInputVal('f1Mobile', r.MobileNumber || r.Phone || r.Mobile || '');
  setInputVal('f1Email', r.Email || '');
  setInputVal('f1ReTypeCapacity', reTypeCapacity);
  setInputVal('f1SanctionLoad', String(sanctionLoad));

  // Meter procurement default: DISCOM selected
  const discomRadio = document.getElementById('f1MeterProcDiscom');
  const benRadio = document.getElementById('f1MeterProcBeneficiary');
  if (discomRadio) discomRadio.checked = true;
  if (benRadio) benRadio.checked = false;
  setInputVal('f1MeterProcurement', 'DISCOM');
  if (typeof window.updateF1MeterProcurementUI === 'function') {
    window.updateF1MeterProcurementUI();
  }

  setInputVal('f1Location', fullAddr);
  const invTypeMake = (invMake && inv.Name) ? `${invMake} / ${inv.Name}` : (invMake || 'V-GUARD');
  setInputVal('f1InverterMakeType', invTypeMake);
  setInputVal('f1InverterAutoIso', 'Yes');
  setInputVal('f1ExistingPlants', 'No');
  setInputVal('f1ExistingCapacity', '0');
  setInputVal('f1CommissionDays', '30 Days');
  setInputVal('f1Category', category);
  setInputVal('f1VoltageLevel', voltage);
  setInputVal('f1SignApplicant', applicantName);
};

window.resetForm1Fields = function() {
  const f1Label = document.getElementById('f1ConsumerNameLabel');
  if (f1Label) f1Label.textContent = '—';
  const ids = [
    'f1DiscomOffice', 'f1Date', 'f1ApplicantName', 'f1ConsumerNo', 'f1Address',
    'f1Mobile', 'f1Email', 'f1ReTypeCapacity', 'f1SanctionLoad', 'f1MeterProcurement',
    'f1Location', 'f1InverterMakeType', 'f1InverterAutoIso', 'f1ExistingPlants',
    'f1ExistingCapacity', 'f1CommissionDays', 'f1Category', 'f1VoltageLevel', 'f1SignApplicant'
  ];
  ids.forEach(id => setInputVal(id, ''));

  setInputVal('f1Date', formatDateToInputDate(new Date()));

  const discomRadio = document.getElementById('f1MeterProcDiscom');
  const benRadio = document.getElementById('f1MeterProcBeneficiary');
  if (discomRadio) discomRadio.checked = true;
  if (benRadio) benRadio.checked = false;
  setInputVal('f1MeterProcurement', 'DISCOM');
  if (typeof window.updateF1MeterProcurementUI === 'function') {
    window.updateF1MeterProcurementUI();
  }

  setInputVal('f1InverterAutoIso', 'Yes');
  setInputVal('f1ExistingPlants', 'No');
  setInputVal('f1ExistingCapacity', '0');
  setInputVal('f1CommissionDays', '30 Days');
  setInputVal('f1Category', 'Domestic');
  setInputVal('f1VoltageLevel', '230 V');
};

function getForm1CurrentData() {
  const isBen = document.getElementById('f1MeterProcBeneficiary')?.checked || 
                getInputVal('f1MeterProcurement', 'DISCOM').toUpperCase().includes('BENEFICIARY');
  const meterProcChoice = isBen ? 'Beneficiary' : 'DISCOM';
  const meterProcText = isBen ? 'Beneficiary ☑\nDISCOM □' : 'Beneficiary □\nDISCOM ☑';

  const rawDate = getInputVal('f1Date', '');
  const displayDate = rawDate ? (formatDateToMonthWord(rawDate) || rawDate) : '';

  return {
    discomOffice: getInputVal('f1DiscomOffice', 'The Designated Officer TPCODL'),
    date: rawDate,
    displayDate: displayDate,
    applicantName: getInputVal('f1ApplicantName', ''),
    consumerNo: getInputVal('f1ConsumerNo', ''),
    address: getInputVal('f1Address', ''),
    mobile: getInputVal('f1Mobile', ''),
    email: getInputVal('f1Email', ''),
    reTypeCapacity: getInputVal('f1ReTypeCapacity', 'Solar – 3.0kwp'),
    sanctionLoad: getInputVal('f1SanctionLoad', '3'),
    meterProcChoice: meterProcChoice,
    meterProcText: meterProcText,
    meterProcurement: meterProcText,
    location: getInputVal('f1Location', ''),
    inverterMakeType: getInputVal('f1InverterMakeType', 'V-GUARD'),
    inverterAutoIso: getInputVal('f1InverterAutoIso', 'Yes'),
    existingPlants: getInputVal('f1ExistingPlants', 'No'),
    existingCapacity: getInputVal('f1ExistingCapacity', '0'),
    commissionDays: getInputVal('f1CommissionDays', '30 Days'),
    category: getInputVal('f1Category', 'Domestic'),
    voltageLevel: getInputVal('f1VoltageLevel', '230 V'),
    declarationText: getInputVal('f1DeclarationText', 'I hereby request you to provide grid connectivity to the solar Rooftop PV system installed or planning to install at premises owned/occupied by me. I do hereby declare that the information furnished above for NM/BD/GM have been checked & verified to the best of my knowledge and belief.'),
    signApplicant: getInputVal('f1SignApplicant', '')
  };
}

window.previewForm1Modal = function() {
  const d = getForm1CurrentData();
  const container = document.getElementById('form1PreviewBody');
  if (!container) return;

  const html = `
    <div class="form4-preview-sheet shadow-sm mb-4">
      <div class="text-center mb-3">
        <h5 class="fw-bold mb-1 text-dark" style="font-size: 15px; letter-spacing: 0.02em;">Form - 1</h5>
        <div class="fw-bold text-dark text-decoration-underline" style="font-size: 13px;">Application form - Net Metering/Bi-directional/Gross Metering Connection</div>
      </div>

      <div class="mb-2" style="font-size: 11px; line-height: 1.4;">
        <div><strong>To,</strong></div>
        <div>${escapeHtml(d.discomOffice)},</div>
        <div class="mt-1"><strong>Date:</strong> ${escapeHtml(d.displayDate || '')}</div>
      </div>

      <div class="mb-3 text-justify" style="font-size: 10.5px; line-height: 1.5;">
        I/we intend to connect Renewable Energy System through net-metering/ bi-directional/ Gross metering arrangement in compliance to order dated 19.08.2016 or OERC on Net Metering/bi-directional metering and their connectivity with respect to Solar PV projects as amended on 05.05.2022 and subsequent amendments from time to time. The details are given below:
      </div>

      <table class="form4-preview-table mb-3">
        <thead>
          <tr class="fw-bold bg-light">
            <th style="width: 45px; text-align: center;">Sl. No.</th>
            <th style="width: 55%;">Parameter</th>
            <th style="width: 40%;">Particulars / Observations</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="text-align: center;">1.</td><td>Name of the Registered applicant/consumer</td><td>${escapeHtml(d.applicantName)}</td></tr>
          <tr><td style="text-align: center;">2.</td><td>Address of the Registered applicant/consumer</td><td>${escapeHtml(d.address)}</td></tr>
          <tr><td style="text-align: center;">3.</td><td>Consumer No.</td><td style="font-family: monospace;">${escapeHtml(d.consumerNo)}</td></tr>
          <tr><td style="text-align: center;">4.</td><td>Telephone number(s) of Consumer/Applicant (Mobile No.)</td><td style="font-family: monospace;">${escapeHtml(d.mobile)}</td></tr>
          <tr><td style="text-align: center;">5.</td><td>Email ID of Consumer/Applicant</td><td>${escapeHtml(d.email)}</td></tr>
          <tr><td style="text-align: center;">6.</td><td>Type of RE (Solar/Wind) &amp; Capacity of RE system (Watts)</td><td class="fw-semibold text-primary">${escapeHtml(d.reTypeCapacity)}</td></tr>
          <tr><td style="text-align: center;">7.</td><td>Sanction load as per latest electricity bill (kW)</td><td>${escapeHtml(d.sanctionLoad)}</td></tr>
          <tr>
            <td style="text-align: center;">8.</td>
            <td>Meter procurement by<br><small class="text-muted">(Please Tick)</small></td>
            <td class="fw-bold" style="line-height: 1.6;">
              <div>Beneficiary ${d.meterProcChoice === 'Beneficiary' ? '☑' : '□'}</div>
              <div>DISCOM ${d.meterProcChoice === 'Beneficiary' ? '□' : '☑'}</div>
            </td>
          </tr>
          <tr><td style="text-align: center;">9.</td><td>Location of proposed RE system (RTS system/Ground mounted system)</td><td>${escapeHtml(d.location)}</td></tr>
          <tr><td style="text-align: center;">10.</td><td>Solar PV Project inverter make and type</td><td>${escapeHtml(d.inverterMakeType)}</td></tr>
          <tr><td style="text-align: center;">11.</td><td>Solar PV Project inverter has automatic isolation protection (Y/N)?</td><td>${escapeHtml(d.inverterAutoIso)}</td></tr>
          <tr><td style="text-align: center;">12.</td><td>Are there any existing Solar or Renewable Energy plants currently installed? (Y/N)</td><td>${escapeHtml(d.existingPlants)}</td></tr>
          <tr><td style="text-align: center;">13.</td><td>Capacity of existing Solar/RE plant.</td><td>${escapeHtml(d.existingCapacity)}</td></tr>
          <tr><td style="text-align: center;">14</td><td>Expected date of commissioning of solar PV Project.</td><td>${escapeHtml(d.commissionDays)}</td></tr>
          <tr><td style="text-align: center;">15</td><td>Category of consumer (Domestic/ Industrial/ Commercial/ Govt. establishment etc.)</td><td>${escapeHtml(d.category)}</td></tr>
          <tr><td style="text-align: center;">16</td><td>Supply voltage level of RE system proposed to be connected [230 V (1-phase)/ 415 V (3- phase/11 kV &amp; above (3–phase)]</td><td>${escapeHtml(d.voltageLevel)}</td></tr>
        </tbody>
      </table>

      <div class="mt-3">
        <div class="fw-bold mb-1" style="font-size: 11.5px;">DECLARATION</div>
        <div class="text-justify mb-4" style="font-size: 10.5px; line-height: 1.5;">
          ${escapeHtml(d.declarationText)}
        </div>

        <div class="d-flex justify-content-end mt-4 pt-3">
          <div class="text-end" style="font-size: 11px;">
            <div class="mb-3">_______________________________________</div>
            <div class="fw-bold">Signature with Name of the applicant /consumer:</div>
            <div>${escapeHtml(d.signApplicant || d.applicantName)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  const modalEl = document.getElementById('form1PreviewModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

window.printForm1Preview = function() {
  const container = document.getElementById('form1PreviewBody');
  if (!container || !container.innerHTML.trim()) {
    previewForm1Modal();
  }
  const content = document.getElementById('form1PreviewBody').innerHTML;
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    UI.toast('Please allow popups to print the Form 1 document.', 'warning');
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Application Form (Form-1)</title>
      <link rel="stylesheet" href="assets/css/bootstrap.min.css">
      <link rel="stylesheet" href="css/style.css">
      <link rel="stylesheet" href="css/agreement.css">
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #fff !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .form4-preview-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      ${content}
    </body>
    </html>
  `);
  printWindow.document.close();
};

window.downloadForm1Pdf = function() {
  const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPdfClass) {
    UI.toast('jsPDF library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }
  if (!selectedCustomerSlNo) {
    const rows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
    if (rows.length > 0) {
      selectCustomerForAgreement(rows[0].SlNo);
    } else {
      UI.toast('Please select a customer first from the list.', 'warning');
      return;
    }
  }

  UI.showLoading(true);
  try {
    const d = getForm1CurrentData();
    const doc = new jsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 14;
    const tableWidth = 182;
    const col1Width = 12;
    const col2Width = 100;
    const col3Width = 70;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    let curY = 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Form - 1', pageWidth / 2, curY, { align: 'center' });
    curY += 5;

    doc.setFontSize(9.5);
    doc.text('Application form - Net Metering/Bi-directional/Gross Metering Connection', pageWidth / 2, curY, { align: 'center' });
    curY += 7;

    doc.setFontSize(8.5);
    doc.text('To,', marginX, curY); curY += 4.2;
    doc.text(`${d.discomOffice},`, marginX, curY); curY += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${d.displayDate || ''}`, marginX, curY); curY += 5;

    const preamble = 'I/we intend to connect Renewable Energy System through net-metering/ bi-directional/ Gross metering arrangement in compliance to order dated 19.08.2016 or OERC on Net Metering/bi-directional metering and their connectivity with respect to Solar PV projects as amended on 05.05.2022 and subsequent amendments from time to time. The details are given below:';
    const preLines = doc.splitTextToSize(preamble, tableWidth);
    doc.setFontSize(8.2);
    doc.text(preLines, marginX, curY);
    curY += (preLines.length * 3.8) + 2.5;

    function drawTableRow(y, slText, labelText, valText, opt = {}) {
      const fontSize = opt.fontSize || 8.2;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

      const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
      const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);
      const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
      const lineHeight = opt.lineHeight || 3.9;
      const padding = 2.0;
      const rowHeight = Math.max(opt.minHeight || 5.2, maxLines * lineHeight + padding);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

      if (slText) {
        doc.text(String(slText), marginX + (col1Width / 2), y + 3.8, { align: 'center' });
      }
      doc.text(col2Lines, marginX + col1Width + 2, y + 3.8);
      doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 3.8);

      return rowHeight;
    }

    const rows = [
      ['1.', 'Name of the Registered applicant/consumer', d.applicantName],
      ['2.', 'Address of the Registered applicant/consumer', d.address],
      ['3.', 'Consumer No.', d.consumerNo],
      ['4.', 'Telephone number(s) of Consumer/Applicant (Mobile No.)', d.mobile],
      ['5.', 'Email ID of Consumer/Applicant', d.email],
      ['6.', 'Type of RE (Solar/Wind) & Capacity of RE system (Watts)', d.reTypeCapacity],
      ['7.', 'Sanction load as per latest electricity bill (kW)', d.sanctionLoad],
      ['8.', 'Meter procurement by (Please Tick)', d.meterProcurement, { isMeterProc: true }],
      ['9.', 'Location of proposed RE system (RTS system/Ground mounted system)', d.location],
      ['10.', 'Solar PV Project inverter make and type', d.inverterMakeType],
      ['11.', 'Solar PV Project inverter has automatic isolation protection (Y/N)?', d.inverterAutoIso],
      ['12.', 'Are there any existing Solar or Renewable Energy plants currently installed? (Y/N)', d.existingPlants],
      ['13.', 'Capacity of existing Solar/RE plant.', d.existingCapacity],
      ['14', 'Expected date of commissioning of solar PV Project.', d.commissionDays],
      ['15', 'Category of consumer (Domestic/ Industrial/ Commercial/ Govt. establishment etc.)', d.category],
      ['16', 'Supply voltage level of RE system proposed to be connected [230 V (1-phase)/ 415 V (3- phase/11 kV & above (3–phase)]', d.voltageLevel]
    ];

    rows.forEach(r => {
      if (r[0] === '8.' || (r[3] && r[3].isMeterProc)) {
        const rowHeight = 10.5;
        doc.setLineWidth(0.2);
        doc.rect(marginX, curY, tableWidth, rowHeight);
        doc.line(marginX + col1Width, curY, marginX + col1Width, curY + rowHeight);
        doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + rowHeight);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.text('8.', marginX + (col1Width / 2), curY + 3.8, { align: 'center' });
        doc.text('Meter procurement by', marginX + col1Width + 2, curY + 3.8);
        doc.text('(Please Tick)', marginX + col1Width + 2, curY + 7.8);

        doc.setFont('helvetica', 'bold');
        const c3x = marginX + col1Width + col2Width + 3;
        
        // Beneficiary row
        doc.text('Beneficiary', c3x, curY + 3.8);
        const box1X = c3x + 24;
        const box1Y = curY + 1.2;
        doc.rect(box1X, box1Y, 3.2, 3.2);
        if (d.meterProcChoice === 'Beneficiary') {
          doc.setLineWidth(0.4);
          doc.line(box1X + 0.6, box1Y + 1.6, box1X + 1.3, box1Y + 2.5);
          doc.line(box1X + 1.3, box1Y + 2.5, box1X + 2.6, box1Y + 0.7);
          doc.setLineWidth(0.2);
        }

        // DISCOM row
        doc.text('DISCOM', c3x, curY + 8.0);
        const box2X = c3x + 24;
        const box2Y = curY + 5.4;
        doc.rect(box2X, box2Y, 3.2, 3.2);
        if (d.meterProcChoice !== 'Beneficiary') {
          doc.setLineWidth(0.4);
          doc.line(box2X + 0.6, box2Y + 1.6, box2X + 1.3, box2Y + 2.5);
          doc.line(box2X + 1.3, box2Y + 2.5, box2X + 2.6, box2Y + 0.7);
          doc.setLineWidth(0.2);
        }

        doc.setFont('helvetica', 'normal');
        curY += rowHeight;
      } else {
        const h = drawTableRow(curY, r[0], r[1], r[2]);
        curY += h;
      }
    });

    curY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.text('DECLARATION', marginX, curY); curY += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const decLines = doc.splitTextToSize(d.declarationText, tableWidth);
    doc.text(decLines, marginX, curY);
    curY += (decLines.length * 3.6) + 14;

    const signX = marginX + tableWidth - 80;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text('Signature with Name of the applicant /consumer:', signX, curY); curY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.text(d.signApplicant || d.applicantName || '', signX, curY);

    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanConsumerNo = (d.consumerNo || 'Form1').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_1_${cleanName}_${cleanConsumerNo}.pdf`;

    doc.save(fileName);
    UI.toast(`Form 1 PDF (${fileName}) downloaded successfully!`, 'success');
  } catch (err) {
    console.error('Error generating Form 1 PDF:', err);
    UI.toast(`Error generating Form 1 PDF: ${err.message}`, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.downloadForm1Docx = async function() {
  if (typeof JSZip === 'undefined') {
    UI.toast('JSZip library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }
  UI.showLoading(true);
  try {
    const d = getForm1CurrentData();
    const templateUrl = 'assets/sampleFiles/Form 1.docx';
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to load template file (${response.status} ${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let docXml = await zip.file('word/document.xml').async('text');

    // Replace DISCOM & Date in header
    docXml = docXml.replace('The Designated Officer TPCODL,', `${d.discomOffice},`);
    if (d.displayDate) {
      docXml = docXml.replace('<w:t>Date:</w:t>', `<w:t>Date: ${d.displayDate}</w:t>`);
    }

    // Replace Customer and specs
    docXml = docXml
      .replaceAll('Mr. BASANTA KUMAR SAHU', d.applicantName || '')
      .replaceAll('At/Po-Kankadajodi, Dist-Cuttack, 754035', d.address || '')
      .replaceAll('80044799825', d.consumerNo || '')
      .replaceAll('7749881422', d.mobile || '')
      .replaceAll('aksahoo246@gmail.com', d.email || '')
      .replaceAll('Solar – 3.0kwp', d.reTypeCapacity || '')
      .replaceAll('V-GUARD', d.inverterMakeType || '')
      .replaceAll('230 V', d.voltageLevel || '')
      .replace(/<w:t xml:space="preserve">\s*3<\/w:t>/, `<w:t xml:space="preserve">  ${d.sanctionLoad}</w:t>`);

    // Meter procurement tick swap if Beneficiary selected
    if (d.meterProcChoice === 'Beneficiary') {
      docXml = docXml.replace(
        /(<w:t>Beneficiary<\/w:t>[\s\S]*?<w:t>)□(<\/w:t>[\s\S]*?<w:t>DISCOM<\/w:t>[\s\S]*?<w:t>)☑(<\/w:t>)/,
        '$1☑$2□$3'
      );
    }

    // Signature name
    const signName = d.signApplicant || d.applicantName || '';
    if (signName) {
      docXml = docXml.replace(
        '<w:t>Signature with Name of the applicant /consumer:</w:t>',
        `<w:t>Signature with Name of the applicant /consumer: ${signName}</w:t>`
      );
    }

    zip.file('word/document.xml', docXml);
    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_1_Application_${cleanName}.docx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(docxBlob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1000);
    UI.toast(`Form 1 Word Document (${fileName}) downloaded!`, 'success');
  } catch (err) {
    console.error('Error generating Form 1 docx:', err);
    UI.toast('Error generating Form 1 Word document: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};


/* ════════════════════════════════════════════════════════════════════════════
   Form 3: Work Completion & Inspection Report Logic & Vector PDF Generator
   ════════════════════════════════════════════════════════════════════════════ */

window.renderF3PvSerialInputs = function(initialSerials = null, initialCapacities = null, fallbackCap = null) {
  const countInput = document.getElementById('f3PvCount');
  const container = document.getElementById('f3PvSerialInputsContainer') || document.getElementById('f3PvSerialsContainer');
  const badge = document.getElementById('lblF3PvSerialCountBadge');
  if (!container) return;

  const count = Math.max(0, parseInt(String(countInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0);
  if (badge) badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;

  if (count === 0) {
    container.innerHTML = '<div class="col-12 text-muted fs-8 fst-italic py-2 text-center">Enter "No. of Module" above to generate serial number and capacity textboxes.</div>';
    window.syncF3PvSerialsAndCaps();
    return;
  }

  // Preserve existing entered values if not provided
  let existingSerials = [];
  let existingCaps = [];
  if (initialSerials && Array.isArray(initialSerials)) {
    existingSerials = initialSerials;
  } else {
    container.querySelectorAll('.f3-module-serial-box').forEach((box, i) => {
      existingSerials[i] = box.value;
    });
  }

  if (initialCapacities && Array.isArray(initialCapacities)) {
    existingCaps = initialCapacities;
  } else {
    container.querySelectorAll('.f3-module-cap-box').forEach((box, i) => {
      existingCaps[i] = box.value;
    });
  }

  // Fallback capacity extraction from argument or input
  let defaultCapVal = '';
  const capSrc = fallbackCap || document.getElementById('f3PvCapacityEach')?.value || '';
  const match = String(capSrc).match(/([0-9.]+)/);
  if (match) defaultCapVal = match[1];

  let html = '';
  for (let i = 1; i <= count; i++) {
    const sVal = existingSerials[i - 1] || '';
    let cVal = existingCaps[i - 1] || '';
    if (!cVal && defaultCapVal) {
      cVal = defaultCapVal;
    }

    html += `
      <div class="col-md-6 col-12">
        <div class="input-group input-group-sm f3-module-row-group">
          <span class="input-group-text bg-light text-muted fs-8 font-monospace px-2" style="min-width: 32px; justify-content: center;">#${i}</span>
          <input type="text" class="form-control form-control-sm fs-8 font-monospace f3-module-serial-box" id="f3PvSerial_${i}" data-index="${i}" value="${escapeHtml(sVal)}" placeholder="Serial No. ${i}" title="Module ${i} Serial Number" oninput="window.syncF3PvSerialsAndCaps()">
          <input type="number" min="0" step="any" class="form-control form-control-sm fs-8 f3-module-cap-box text-end fw-semibold" id="f3PvCap_${i}" data-index="${i}" value="${escapeHtml(cVal)}" placeholder="620" style="max-width: 82px;" oninput="window.handleF3PvCapChange(${i})" title="Module ${i} Capacity in Wp">
          <span class="input-group-text bg-light text-muted fs-8 px-1.5 border-start-0" style="font-size: 0.70rem; min-width: 32px; justify-content: center;">Wp</span>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  window.syncF3PvSerialsAndCaps();
};

window.handleF3PvCapChange = function(index) {
  if (index === 1) {
    const firstBox = document.getElementById('f3PvCap_1');
    const val = firstBox ? firstBox.value.trim() : '';
    const allBoxes = document.querySelectorAll('.f3-module-cap-box');
    let allOthersEmpty = true;
    for (let i = 1; i < allBoxes.length; i++) {
      if (allBoxes[i].value && allBoxes[i].value.trim() !== '') {
        allOthersEmpty = false;
        break;
      }
    }
    if (allOthersEmpty && val !== '') {
      for (let i = 1; i < allBoxes.length; i++) {
        allBoxes[i].value = val;
      }
    }
  }
  window.syncF3PvSerialsAndCaps();
};

window.applyF3PvCapToAll = function() {
  const firstBox = document.getElementById('f3PvCap_1');
  if (!firstBox) return;
  const val = firstBox.value.trim();
  if (!val) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Please enter a capacity in Module #1 first.', 'info');
    }
    return;
  }
  document.querySelectorAll('.f3-module-cap-box').forEach(box => {
    box.value = val;
  });
  window.syncF3PvSerialsAndCaps();
};

window.handleF3ModuleCountChange = function() {
  const countInput = document.getElementById('f3PvCount');
  if (!countInput) return;
  window.renderF3PvSerialInputs();
};

window.addF3PvSerial = function() {
  const countInput = document.getElementById('f3PvCount');
  const count = (parseInt(String(countInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0) + 1;
  if (countInput) countInput.value = `${count} NOS.`;
  window.renderF3PvSerialInputs();
};

window.removeF3PvSerial = function(idx) {
  const countInput = document.getElementById('f3PvCount');
  const count = Math.max(0, (parseInt(String(countInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0) - 1);
  if (countInput) countInput.value = `${count} NOS.`;
  window.renderF3PvSerialInputs();
};

window.syncF3PvSerialsAndCaps = function() {
  const serialBoxes = document.querySelectorAll('.f3-module-serial-box');
  const capBoxes = document.querySelectorAll('.f3-module-cap-box');
  const serialsTextarea = document.getElementById('f3PvSerials');
  const capEachInput = document.getElementById('f3PvCapacityEach');
  const totalCapInput = document.getElementById('f3PvTotalCapacity');
  const badge = document.getElementById('lblF3PvSerialCountBadge');

  const count = serialBoxes.length;
  if (badge) {
    badge.textContent = `${count} Module${count === 1 ? '' : 's'}`;
  }

  // 1. Sync Serials into hidden f3PvSerials
  const serialList = [];
  serialBoxes.forEach(box => {
    const val = (box.value || '').trim();
    if (val) serialList.push(val);
  });
  if (serialsTextarea) {
    serialsTextarea.value = serialList.join('\n');
  }

  // 2. Calculate Capacities (in Wp)
  let totalWatts = 0;
  let filledCount = 0;
  const capCounts = {};

  capBoxes.forEach(box => {
    const raw = (box.value || '').trim();
    if (!raw) return;
    const match = raw.match(/([0-9.]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num > 0) {
        filledCount++;
        totalWatts += num;
        const displayLabel = `${num}WP`;
        capCounts[displayLabel] = (capCounts[displayLabel] || 0) + 1;
      }
    }
  });

  if (filledCount > 0 && totalWatts > 0) {
    const totalKW = (totalWatts / 1000).toFixed(3);
    if (totalCapInput) {
      totalCapInput.value = `${totalKW}KW`;
    }
    if (capEachInput) {
      if (Object.keys(capCounts).length === 1) {
        capEachInput.value = Object.keys(capCounts)[0];
      } else {
        capEachInput.value = Object.entries(capCounts).map(([lbl, c]) => `${lbl} - ${c}pic`).join(', ');
      }
    }
  }
};

window.populateForm3Fields = function(r) {
  if (!r) return;
  const f3Label = document.getElementById('f3ConsumerNameLabel');
  if (f3Label) f3Label.textContent = r.Name || '—';

  let specs = {};
  if (r.ProductSpecs) {
    try {
      specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs;
    } catch (_) { specs = {}; }
  } else if (r.Specifications) {
    try {
      specs = typeof r.Specifications === 'string' ? JSON.parse(r.Specifications) : r.Specifications;
    } catch (_) { specs = {}; }
  }

  const customerName = r.Name ? (r.Name.startsWith('Mr.') || r.Name.startsWith('Mrs.') || r.Name.startsWith('Ms.') ? r.Name : 'Mr. ' + r.Name) : '';
  const district = (specs.District || r.District || '').trim();
  const circle = (r.CircleName || r.Circle || '').trim();
  const discomShort = getDiscomName(district, circle);
  const discomFull = getDiscomFullName(discomShort);
  const division = (r.DivisionName || circle || (district ? `${district} Division` : 'Cuttack Division')).trim();

  const siteAddress = (specs.SiteAddress || r.Address || '').trim();
  const pinCode = (specs.PinCode || r.PinCode || '').trim();
  const addrParts = [];
  if (siteAddress) addrParts.push(siteAddress);
  if (district) addrParts.push(`Dist-${district}`);
  if (pinCode) addrParts.push(pinCode);
  const fullSiteAddress = addrParts.join(', ');

  const pv = specs.PvModule || {};
  const capRaw = pv.TotalCapacity || r.ProposedCapacity || r.Capacity || '3';
  const capNum = parseFloat(String(capRaw).replace(/[^0-9.]/g, '')) || 3;
  const plantCapStr = `${capNum.toFixed(1)} KW`;
  const sanctionLoadNum = r.SanctionLoad || Math.round(capNum) || 3;
  const connectionType = (specs.ConnectionType || (capNum > 5 ? '3ph LT' : '1ph LT')).trim();

  const regDate = r.LoginDate || r.CreatedDate || r.RegistrationDate || '10-07-2026';
  const regDateFormatted = formatDateToDdMmYyyy(regDate);
  const regNo = r.ApplicationNumber || (r.ConsumerNo ? `NP-OD-${r.ConsumerNo}` : 'NP-ODTCO26-13685899');
  const regNoDate = `${regNo} / ${regDateFormatted}`;
  const installDateFormatted = r.InstallationDate ? formatDateToMonthWord(r.InstallationDate) : formatDateToMonthWord(new Date());

  // Header & Certification Info
  setInputVal('f3DiscomOffice', discomFull);
  setInputVal('f3Division', division);
  setInputVal('f3CertCapacity', `${capNum.toFixed(1)} Kwp`);
  setInputVal('f3CertAddress', fullSiteAddress);
  setInputVal('f3InspectionDate', '.....................................');

  // Part A: Applicant Details
  setInputVal('f3ApplicantName', customerName);
  setInputVal('f3RegNoDate', regNoDate);
  setInputVal('f3Address', fullSiteAddress);
  setInputVal('f3ConsumerNo', r.ConsumerNo || '');
  setInputVal('f3Category', r.ConsumerCategory || r.Category || 'DOMESTIC');
  setInputVal('f3ConnectionType', connectionType);
  setInputVal('f3ContractDemand', `${sanctionLoadNum} KW`);
  setInputVal('f3Arrear', '0');
  setInputVal('f3VendorName', 'Shri Trutiyadev Solar Enterprises');
  setInputVal('f3InstallDate', installDateFormatted);

  // Part B: Distribution Transformer Details (Empty as sample)
  setInputVal('f3DtCapacity', '');
  setInputVal('f3DtLocation', '');
  setInputVal('f3DtTotalConnected', '');
  setInputVal('f3DtAdequate', 'Yes');

  // Part C: Solar Rooftop PV Power Plant Details
  setInputVal('f3PlantCapacity', plantCapStr);
  setInputVal('f3PlantSiteType', 'SINGLE SITE');
  setInputVal('f3PlantPointType', 'SINGLE POINT');
  setInputVal('f3SldStatus', 'YES/NO\n(if it is no, state reasons for the same and suggest alternate arrangements )');

  // Part D: Grid Tied Inverter
  const brandInfo = parseBrand(r.CommittedBrand);
  const inv = specs.GridTiedInverter || {};
  const invMake = inv.Make || brandInfo.inverterMake || 'V-GUARD';
  const invCapacity = inv.Capacity ? (String(inv.Capacity).toUpperCase().includes('KW') ? inv.Capacity : `${inv.Capacity} KW`) : `${Math.round(capNum)} KW`;
  const invSerialNo = getOrGenerateInverterSerial(r, specs, invMake);
  const invVolt = (inv.InputVoltage && inv.OutputVoltage) ? `${inv.InputVoltage}/${inv.OutputVoltage}` : (inv.InputVoltage ? `${inv.InputVoltage}/220 - 240 V AC` : '300 V DC/220 - 240 V AC');

  setInputVal('f3InvMake', invMake);
  setInputVal('f3InvSerialNo', invSerialNo);
  setInputVal('f3InvCapacity', invCapacity);
  setInputVal('f3InvVolt', invVolt);
  setInputVal('f3InvAntiIslanding', 'YES/NO (Need to be checked practically  before charging)');

  // Part E: P.V Module
  const moduleMake = pv.Make || brandInfo.moduleMake || 'ADANI';
  const moduleModel = pv.TypeAndModel || 'TOPCON';
  const moduleCount = pv.NoOfModule ? (String(pv.NoOfModule).includes('NOS') ? pv.NoOfModule : `${pv.NoOfModule} NOS.`) : `${calculateModulesCount(capNum).replace(/[^0-9]/g, '')} NOS.`;
  let capEach = pv.CapacityEach ? String(pv.CapacityEach).trim() : '620WP';
  if (capEach && !/WP/i.test(capEach)) capEach = `${capEach}WP`;
  let totalCapModuleStr = pv.TotalCapacity ? String(pv.TotalCapacity).trim() : `${capNum.toFixed(3)}KW`;
  if (totalCapModuleStr && !/KW/i.test(totalCapModuleStr)) totalCapModuleStr = `${totalCapModuleStr}KW`;

  const serials = getOrGenerateSerials(r, specs, moduleCount, moduleMake);
  const capacities = Array.isArray(pv.ModuleCapacities) ? pv.ModuleCapacities : [];

  setInputVal('f3PvMake', moduleMake);
  setInputVal('f3PvModel', moduleModel);
  setInputVal('f3PvTotalCapacity', totalCapModuleStr);
  setInputVal('f3PvCapacityEach', capEach);
  setInputVal('f3PvCount', moduleCount);
  setInputVal('f3PvInstallDate', installDateFormatted);
  setInputVal('f3PvSerials', serials.join('\n'));
  window.renderF3PvSerialInputs(serials, capacities, capEach);

  // Part F & G & H: Earthing & Protective Systems
  const ev = specs.EarthingVerification || specs.DetailsOfEarthing || {};
  const dcEarth = ev.DcEarthing ? (/ohm/i.test(String(ev.DcEarthing)) ? ev.DcEarthing : `${ev.DcEarthing} in Ohm`) : '1.7 in Ohm';
  const acEarth = ev.AcEarthing ? (/ohm/i.test(String(ev.AcEarthing)) ? ev.AcEarthing : `${ev.AcEarthing} in Ohm`) : '2.3 in Ohm';
  setInputVal('f3DcEarthing', dcEarth);
  setInputVal('f3AcEarthing', acEarth);
  setInputVal('f3EarthingLimit', `Within permissible limit or Not (Values should be certified by ${discomShort} official)`);
  setInputVal('f3AcdcDbStatus', 'Yes/No');
  setInputVal('f3ManualSwitch', 'Yes/No');
  setInputVal('f3LightningArrestor', 'Yes/No');
  setInputVal('f3Spds', 'Yes/No');
  setInputVal('f3RelaySwitch', 'Yes/ No');
  setInputVal('f3BackfeedProtection', '');

  // Part I - L: Statutory Standards
  setInputVal('f3EicApproval', 'Yes/ No');
  setInputVal('f3SafetyCert', 'Yes/No');
  setInputVal('f3SldDiagram', 'Yes/ No');
  setInputVal('f3TestReportCea', 'Yes/NO');

  // Part M: Meters (All empty by default as sample)
  setInputVal('f3NmCount', '');
  setInputVal('f3NmMake', '');
  setInputVal('f3NmSerialNo', '');
  setInputVal('f3NmPhase', '');
  setInputVal('f3NmCapacity', '');
  setInputVal('f3NmConstant', '');

  setInputVal('f3SmCount', '');
  setInputVal('f3SmMake', '');
  setInputVal('f3SmSerialNo', '');
  setInputVal('f3SmPhase', '');
  setInputVal('f3SmCapacity', '');
  setInputVal('f3SmConstant', '');

  // Part N: Remarks & Clearance
  setInputVal('f3Remarks', '');
  setInputVal('f3GridSatisfactory', 'Yes/No ( if  it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)');
  setInputVal('f3ManualAutoSwitch', 'Yes / No');
  setInputVal('f3OmInfo', 'Yes*/ No*');

  // Signatures
  setInputVal('f3ApplicantSignName', customerName);
  setInputVal('f3VendorFirm', 'Shri Trutiyadev Solar Enterprises');
  setInputVal('f3VendorAddress', 'AT-TALAMUNDALI, PO-KANKADAJODI, DIST-CUTTACK, PIN-754035, Odisha');
  setInputVal('f3CertAuthority', `Designated officer ${discomShort}`);
};

window.resetForm3Fields = function() {
  const f3Label = document.getElementById('f3ConsumerNameLabel');
  if (f3Label) f3Label.textContent = '—';
  const ids = [
    'f3DiscomOffice', 'f3Division', 'f3CertCapacity', 'f3CertAddress',
    'f3ApplicantName', 'f3RegNoDate', 'f3Address', 'f3ConsumerNo', 'f3Category',
    'f3ConnectionType', 'f3ContractDemand', 'f3Arrear', 'f3VendorName', 'f3InstallDate',
    'f3DtCapacity', 'f3DtLocation', 'f3DtTotalConnected', 'f3DtAdequate',
    'f3PlantCapacity', 'f3PlantSiteType', 'f3PlantPointType', 'f3SldStatus',
    'f3InvMake', 'f3InvSerialNo', 'f3InvCapacity', 'f3InvVolt', 'f3InvAntiIslanding',
    'f3PvMake', 'f3PvModel', 'f3PvTotalCapacity', 'f3PvCapacityEach', 'f3PvCount', 'f3PvSerials',
    'f3DcEarthing', 'f3AcEarthing', 'f3EarthingLimit', 'f3AcdcDbStatus', 'f3ManualSwitch',
    'f3LightningArrestor', 'f3Spds', 'f3RelaySwitch', 'f3BackfeedProtection',
    'f3EicApproval', 'f3SafetyCert', 'f3SldDiagram', 'f3TestReportCea',
    'f3NmCount', 'f3NmMake', 'f3NmSerialNo', 'f3NmPhase', 'f3NmCapacity', 'f3NmConstant',
    'f3SmCount', 'f3SmMake', 'f3SmSerialNo', 'f3SmPhase', 'f3SmCapacity', 'f3SmConstant',
    'f3Remarks', 'f3GridSatisfactory', 'f3ManualAutoSwitch', 'f3OmInfo',
    'f3ApplicantSignName', 'f3VendorFirm', 'f3VendorAddress', 'f3CertAuthority'
  ];
  ids.forEach(id => setInputVal(id, ''));
  const container = document.getElementById('f3PvSerialInputsContainer') || document.getElementById('f3PvSerialsContainer');
  if (container) container.innerHTML = '';
  const badge = document.getElementById('lblF3PvSerialCountBadge');
  if (badge) badge.textContent = '0 Modules';
};

function getForm3CurrentData() {
  if (typeof window.syncF3PvSerialsAndCaps === 'function') {
    window.syncF3PvSerialsAndCaps();
  }
  const rawSerials = getInputVal('f3PvSerials', '');
  const pvSerials = rawSerials ? rawSerials.split('\n').map(s => s.trim()).filter(Boolean) : [];

  return {
    discomOffice: getInputVal('f3DiscomOffice', 'TP CENTRAL ODISHA DISTRIBUTION LIMITED'),
    discomShort: getDiscomName(getInputVal('f3Address', ''), ''),
    division: getInputVal('f3Division', 'Cuttack Division'),
    certCapacity: getInputVal('f3CertCapacity', '3.0 Kwp'),
    certAddress: getInputVal('f3CertAddress', ''),
    inspectionDate: getInputVal('f3InspectionDate', '.....................................'),
    applicantName: getInputVal('f3ApplicantName', ''),
    regNoDate: getInputVal('f3RegNoDate', ''),
    address: getInputVal('f3Address', ''),
    consumerNo: getInputVal('f3ConsumerNo', ''),
    category: getInputVal('f3Category', 'DOMESTIC'),
    connectionType: getInputVal('f3ConnectionType', '1ph LT'),
    contractDemand: getInputVal('f3ContractDemand', '3 KW'),
    arrear: getInputVal('f3Arrear', '0'),
    vendorName: getInputVal('f3VendorName', 'Shri Trutiyadev Solar Enterprises'),
    installDate: getInputVal('f3InstallDate', '19 October 2026'),
    dtCapacity: getInputVal('f3DtCapacity', ''),
    dtLocation: getInputVal('f3DtLocation', ''),
    dtTotalConnected: getInputVal('f3DtTotalConnected', ''),
    dtAdequate: getInputVal('f3DtAdequate', 'Yes'),
    plantCapacity: getInputVal('f3PlantCapacity', '3.0 KW'),
    plantSiteType: getInputVal('f3PlantSiteType', 'SINGLE SITE'),
    plantPointType: getInputVal('f3PlantPointType', 'SINGLE POINT'),
    sldStatus: getInputVal('f3SldStatus', 'YES/NO (if it is no, state reasons for the same and suggest alternate arrangements )'),
    invMake: getInputVal('f3InvMake', 'V-GUARD'),
    invSerialNo: getInputVal('f3InvSerialNo', ''),
    invCapacity: getInputVal('f3InvCapacity', '3 KW'),
    invVolt: getInputVal('f3InvVolt', '550 V DC/220-240V AC'),
    invAntiIslanding: getInputVal('f3InvAntiIslanding', 'YES/NO (Need to be checked practically before charging)'),
    pvMake: getInputVal('f3PvMake', 'ADANI'),
    pvModel: getInputVal('f3PvModel', 'TOPCON'),
    pvCapacityEach: getInputVal('f3PvCapacityEach', '620WP'),
    pvCount: getInputVal('f3PvCount', '5 NOS.'),
    pvTotalCapacity: getInputVal('f3PvTotalCapacity', '3.100KW'),
    pvSerials: pvSerials,
    dcEarthing: getInputVal('f3DcEarthing', '1.7 in Ohm'),
    acEarthing: getInputVal('f3AcEarthing', '2.3 in Ohm'),
    earthingLimit: getInputVal('f3EarthingLimit', 'Within permissible limit or Not (Values should be certified by TPCODL official)'),
    acdcDbStatus: getInputVal('f3AcdcDbStatus', 'Yes/No'),
    manualSwitch: getInputVal('f3ManualSwitch', 'Yes/No'),
    lightningArrestor: getInputVal('f3LightningArrestor', 'Yes/No'),
    spds: getInputVal('f3Spds', 'Yes/No'),
    relaySwitch: getInputVal('f3RelaySwitch', 'Yes/ No'),
    backfeedProtection: getInputVal('f3BackfeedProtection', ''),
    eicApproval: getInputVal('f3EicApproval', 'Yes/ No'),
    safetyCert: getInputVal('f3SafetyCert', 'Yes/No'),
    sldDiagram: getInputVal('f3SldDiagram', 'Yes/ No'),
    testReportCea: getInputVal('f3TestReportCea', 'Yes/NO'),
    nmCount: getInputVal('f3NmCount', ''),
    nmMake: getInputVal('f3NmMake', ''),
    nmSerialNo: getInputVal('f3NmSerialNo', ''),
    nmPhase: getInputVal('f3NmPhase', ''),
    nmCapacity: getInputVal('f3NmCapacity', ''),
    nmConstant: getInputVal('f3NmConstant', ''),
    smCount: getInputVal('f3SmCount', ''),
    smMake: getInputVal('f3SmMake', ''),
    smSerialNo: getInputVal('f3SmSerialNo', ''),
    smPhase: getInputVal('f3SmPhase', ''),
    smCapacity: getInputVal('f3SmCapacity', ''),
    smConstant: getInputVal('f3SmConstant', ''),
    remarks: getInputVal('f3Remarks', ''),
    gridSatisfactory: getInputVal('f3GridSatisfactory', 'Yes/No ( if  it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)'),
    manualAutoSwitch: getInputVal('f3ManualAutoSwitch', 'Yes / No'),
    omInfo: getInputVal('f3OmInfo', 'Yes*/ No*'),
    applicantSignName: getInputVal('f3ApplicantSignName', ''),
    vendorFirm: getInputVal('f3VendorFirm', 'Shri Trutiyadev Solar Enterprises'),
    vendorAddress: getInputVal('f3VendorAddress', 'AT-TALAMUNDALI, PO-KANKADAJODI, DIST-CUTTACK, PIN-754035, Odisha'),
    certAuthority: getInputVal('f3CertAuthority', 'Designated officer TPCODL')
  };
}

window.previewForm3Modal = function() {
  const d = getForm3CurrentData();
  const container = document.getElementById('form3PreviewBody');
  if (!container) return;

  const serialsHtml = d.pvSerials.length > 0
    ? d.pvSerials.map(s => escapeHtml(s)).join('<br>')
    : '<span class="text-muted fst-italic">None entered</span>';

  const html = `
    <!-- Page 1 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <div class="text-center mb-2.5">
        <h5 class="fw-bold mb-0 text-dark" style="font-size: 14px; letter-spacing: 0.02em;">FORM- 3 : Work completion and Inspection Report</h5>
        <div class="fw-bold text-dark mt-0.5" style="font-size: 13px;">${escapeHtml(d.discomOffice)}</div>
      </div>

      <div class="mb-3 text-justify" style="font-size: 10px; line-height: 1.5;">
        Certified that I Designated officer, ${escapeHtml(d.division)}, ${escapeHtml(d.discomShort)} along MRT have personally inspected the ${escapeHtml(d.certCapacity)} SRTPV system ${escapeHtml(d.certAddress)} the details of SRTPV system and inspection report are as below:<br>
        <div class="text-center fw-bold mt-1">
          Work Completion and Inspection Report for ${escapeHtml(d.certCapacity)} Solar Roof Top PV System(SRTPV) ${escapeHtml(d.certAddress)}
        </div>
      </div>

      <table class="form4-preview-table mb-1">
        <thead>
          <tr class="fw-bold bg-light">
            <th style="width: 35px; text-align: center;">Sl. No.</th>
            <th style="width: 50%;">Parameter</th>
            <th style="width: 45%;">Utility Observation</th>
          </tr>
        </thead>
        <tbody>
          <tr class="fw-bold bg-light"><td style="text-align: center;">A</td><td>Applicant Details</td><td></td></tr>
          <tr><td style="text-align: center;">1</td><td>Name of the Applicant</td><td>${escapeHtml(d.applicantName)}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Application No./Registration No. with Date</td><td>${escapeHtml(d.regNoDate)}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Address</td><td>${escapeHtml(d.address)}</td></tr>
          <tr><td style="text-align: center;">3</td><td>Consumer Number</td><td style="font-family: monospace;">${escapeHtml(d.consumerNo)}</td></tr>
          <tr><td style="text-align: center;">4</td><td>Consumer Category</td><td>${escapeHtml(d.category)}</td></tr>
          <tr><td style="text-align: center;">5</td><td>Type of Connection: 1ph LT or 3 ph LT/HT</td><td>${escapeHtml(d.connectionType)}</td></tr>
          <tr><td style="text-align: center;">6</td><td>contract demand of consumer</td><td>${escapeHtml(d.contractDemand)}</td></tr>
          <tr><td style="text-align: center;">7</td><td>Arrear, if any</td><td>${escapeHtml(d.arrear)}</td></tr>
          <tr><td style="text-align: center;">8</td><td>Name of Developer/Vendor</td><td>${escapeHtml(d.vendorName)}</td></tr>
          <tr><td style="text-align: center;">9</td><td>Date of Installation</td><td>${escapeHtml(d.installDate)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">B</td><td>Distribution Transformer Details</td><td></td></tr>
          <tr><td style="text-align: center;">1</td><td>Capacity in KVA</td><td>${escapeHtml(d.dtCapacity)}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Location</td><td>${escapeHtml(d.dtLocation)}</td></tr>
          <tr><td style="text-align: center;">3</td><td>Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp (individual capacity may be mentioned)</td><td>${escapeHtml(d.dtTotalConnected)}</td></tr>
          <tr><td style="text-align: center;">4</td><td>Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems</td><td>${escapeHtml(d.dtAdequate)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">C</td><td>Solar Rooftop PV Power Plant Details</td><td></td></tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Details of proposed power plant<br>Capacity of the SPV Power Plant (kWp)<br>Plant proposed at single site/multiple sites<br>Interconnection with the electricity network at single point or multiple point</td>
            <td>${escapeHtml(d.plantCapacity)}<br>${escapeHtml(d.plantSiteType)}<br>${escapeHtml(d.plantPointType)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Whether the Single Line Diagram of the SRTPV System (Submitted by the consumer indicating all the Safety aspects of Grid Connectivity) is OK for grid Connectivity</td>
            <td>${escapeHtml(d.sldStatus).replace(/\n/g, '<br>')}</td>
          </tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">D</td><td>Grid Tied Inverter</td><td></td></tr>
          <tr><td style="text-align: center;">1</td><td>Make</td><td>${escapeHtml(d.invMake)}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Serial No.</td><td style="font-family: monospace;">${escapeHtml(d.invSerialNo)}</td></tr>
          <tr><td style="text-align: center;">3</td><td>Capacity</td><td>${escapeHtml(d.invCapacity)}</td></tr>
          <tr><td style="text-align: center;">4</td><td>Input Voltage/ Output Voltage</td><td>${escapeHtml(d.invVolt)}</td></tr>
          <tr><td style="text-align: center;">5</td><td>Whether Anti-islanding feature is in working condition</td><td>${escapeHtml(d.invAntiIslanding)}</td></tr>
        </tbody>
      </table>
      <div class="text-end text-muted mt-2" style="font-size: 9px;">Page 1 of 3</div>
    </div>

    <!-- Page 2 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <table class="form4-preview-table mb-1">
        <thead>
          <tr class="fw-bold bg-light">
            <th style="width: 35px; text-align: center;">Sl. No.</th>
            <th style="width: 50%;">Parameter</th>
            <th style="width: 45%;">Utility Observation</th>
          </tr>
        </thead>
        <tbody>
          <tr class="fw-bold bg-light"><td style="text-align: center;">E</td><td>P.V Module</td><td></td></tr>
          <tr><td style="text-align: center;">1</td><td>Make</td><td>${escapeHtml(d.pvMake)}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Serial No.</td><td style="font-family: monospace;">${serialsHtml}</td></tr>
          <tr><td style="text-align: center;">3</td><td>Type of Module</td><td>${escapeHtml(d.pvModel)}</td></tr>
          <tr><td style="text-align: center;">4</td><td>Capacity of each Module</td><td>${escapeHtml(d.pvCapacityEach)}</td></tr>
          <tr><td style="text-align: center;">5</td><td>No. of Module</td><td>${escapeHtml(d.pvCount)}</td></tr>
          <tr><td style="text-align: center;">6</td><td>Total capacity of PV array</td><td>${escapeHtml(d.pvTotalCapacity)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">F</td><td>Earthing Verification (i)D.C Earthing (ii)A.C Earthing</td><td>${escapeHtml(d.dcEarthing)}<br>${escapeHtml(d.acEarthing)}<br>${escapeHtml(d.earthingLimit)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">G</td><td>Details of protective system available</td><td>AC &amp; DC DB: ${escapeHtml(d.acdcDbStatus)}<br>Manual Switch at Solar Side: ${escapeHtml(d.manualSwitch)}<br>lightening arrestor: ${escapeHtml(d.lightningArrestor)}<br>SPDs: ${escapeHtml(d.spds)}<br>Relay operated automatic switch at net- meter side: ${escapeHtml(d.relaySwitch)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">H</td><td>Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other</td><td>${escapeHtml(d.backfeedProtection)}</td></tr>
          <tr><td style="text-align: center;">I</td><td>EIC inspection and approval letter Submitted by the consumer above 50KVA</td><td>${escapeHtml(d.eicApproval)}</td></tr>
          <tr><td style="text-align: center;">J</td><td>Safety certificate from designated Safety officer of ${escapeHtml(d.discomShort)} below 50KVA</td><td>${escapeHtml(d.safetyCert)}</td></tr>
          <tr><td style="text-align: center;">K</td><td>Actual Single line wiring diagram of the SPV System.</td><td>${escapeHtml(d.sldDiagram)}</td></tr>
          <tr><td style="text-align: center;">L</td><td>Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards</td><td>${escapeHtml(d.testReportCea)}</td></tr>

          <tr class="fw-bold bg-light"><td style="text-align: center;">M</td><td>Meter Details</td><td>Net Meter (Bi-directional Meter) / Solar Generation Meter</td></tr>
          <tr><td style="text-align: center;">1</td><td>Total Nos. of Meters</td><td>${escapeHtml(d.nmCount || '')}</td></tr>
          <tr><td style="text-align: center;">2</td><td>Meter Make</td><td>${escapeHtml(d.nmMake || '')}</td></tr>
          <tr><td style="text-align: center;">3</td><td>Meter Sl. No.</td><td>${escapeHtml(d.nmSerialNo || '')}</td></tr>
          <tr><td style="text-align: center;">4</td><td>1 Ph/ 3Ph</td><td>${escapeHtml(d.nmPhase || '')}</td></tr>
          <tr><td style="text-align: center;">5</td><td>Capacity</td><td>${escapeHtml(d.nmCapacity || '')}</td></tr>
          <tr><td style="text-align: center;">6</td><td>Meter Constant</td><td>${escapeHtml(d.nmConstant || '')}</td></tr>
        </tbody>
      </table>
      <div class="text-end text-muted mt-2" style="font-size: 9px;">Page 2 of 3</div>
    </div>

    <!-- Page 3 Preview Sheet -->
    <div class="form4-preview-sheet shadow-sm mb-4">
      <table class="form4-preview-table mb-2">
        <tbody>
          <tr class="fw-bold bg-light"><td style="width: 35px; text-align: center;">N</td><td style="width: 50%;">Any other necessary details with Remarks</td><td style="width: 45%;">${escapeHtml(d.remarks)}</td></tr>
          <tr class="fw-bold bg-light"><td colspan="3" class="text-center">Inspection Report</td></tr>
          <tr>
            <td colspan="2">Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization</td>
            <td>${escapeHtml(d.gridSatisfactory).replace(/\n/g, '<br>')}</td>
          </tr>
        </tbody>
      </table>

      <div class="my-2" style="font-size: 10px; line-height: 1.5;">
        <div>Provision of manual and automatic switches: <strong>${escapeHtml(d.manualAutoSwitch)}</strong></div>
        <div class="mt-1">Whether Operation and Maintenance information: Such as Do’s and Don’ts are provided by the System Installer: <strong>${escapeHtml(d.omInfo)}</strong></div>
      </div>

      <!-- Spacing before Signatures row (Pen signing space) -->
      <div style="height: 35mm;"></div>

      <div class="row g-2 mt-2 pt-2" style="font-size: 10.5px;">
        <div class="col-6">
          <div class="fw-bold mb-1">Signature of the Applicant</div>
          <div><strong>Name:</strong> ${escapeHtml(d.applicantSignName || d.applicantName)}</div>
          <div class="mt-2"><strong>Date:</strong></div>
        </div>
        <div class="col-6">
          <div class="fw-bold mb-1">Name and Signature of the System Installer with Seal</div>
          <div><strong>Name of the firm and address:</strong></div>
          <div>${escapeHtml(d.vendorFirm)}</div>
          <div>${escapeHtml(d.vendorAddress)}</div>
          <div class="mt-2"><strong>Date:</strong></div>
        </div>
      </div>

      <div class="mt-3 pt-2" style="font-size: 10px; line-height: 1.4;">
        <div class="fw-bold">Certified by</div>
        <div>${escapeHtml(d.certAuthority)}</div>
        <div><strong>Date:</strong></div>
        <div class="fw-bold mt-2">Enclosures:</div>
        <ol class="mb-0 ps-3">
          <li>Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.</li>
          <li>Data sheets/Drawing for the array mounting System.</li>
          <li>Actual Single line wiring diagram of the SPV System.</li>
          <li>Copy of Maintenance &amp; Operation information provided by the System Installer.</li>
        </ol>
      </div>
      <div class="text-end text-muted mt-2" style="font-size: 9px;">Page 3 of 3</div>
    </div>
  `;

  container.innerHTML = html;
  const modalEl = document.getElementById('form3PreviewModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

window.printForm3Preview = function() {
  const container = document.getElementById('form3PreviewBody');
  if (!container || !container.innerHTML.trim()) {
    previewForm3Modal();
  }
  const content = document.getElementById('form3PreviewBody').innerHTML;
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    UI.toast('Please allow popups to print the Form 3 document.', 'warning');
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Work Completion &amp; Inspection Report (Form-3)</title>
      <link rel="stylesheet" href="assets/css/bootstrap.min.css">
      <link rel="stylesheet" href="css/style.css">
      <link rel="stylesheet" href="css/agreement.css">
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #fff !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .form4-preview-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 0 20mm 0 !important; page-break-after: always; }
        .form4-preview-sheet:last-child { page-break-after: auto; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      ${content}
    </body>
    </html>
  `);
  printWindow.document.close();
};

window.downloadForm3Pdf = function() {
  const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPdfClass) {
    UI.toast('jsPDF library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }
  if (!selectedCustomerSlNo) {
    const rows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
    if (rows.length > 0) {
      selectCustomerForAgreement(rows[0].SlNo);
    } else {
      UI.toast('Please select a customer first from the list.', 'warning');
      return;
    }
  }

  UI.showLoading(true);
  try {
    const d = getForm3CurrentData();
    const doc = new jsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 14;
    const tableWidth = 182;
    const col1Width = 12;
    const col2Width = 86;
    const col3Width = 84;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    function drawTableRow(y, slText, labelText, valText, opt = {}) {
      const fontSize = opt.fontSize || 8.5;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

      const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
      const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);
      const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
      const lineHeight = opt.lineHeight || 4.2;
      const padding = 2.4;
      const rowHeight = Math.max(opt.minHeight || 5.8, maxLines * lineHeight + padding);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

      if (slText) {
        if (opt.slBold) doc.setFont('helvetica', 'bold');
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
        if (opt.slBold) doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');
      }
      doc.text(col2Lines, marginX + col1Width + 2, y + 4.2);
      doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 4.2);

      return rowHeight;
    }

    function drawSectionHeaderRow(y, slText, headerTitle) {
      const rowHeight = 6.2;
      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.setFillColor(242, 244, 247);
      doc.rect(marginX, y, tableWidth, rowHeight, 'F');
      doc.rect(marginX, y, tableWidth, rowHeight, 'S');
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      if (slText) {
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
      }
      doc.text(headerTitle, marginX + col1Width + 2, y + 4.2);
      return rowHeight;
    }

    // ══ PAGE 1 ══
    let curY = 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('FORM- 3 : Work completion and Inspection Report', pageWidth / 2, curY, { align: 'center' });
    curY += 5;

    doc.setFontSize(9.5);
    doc.text(d.discomOffice, pageWidth / 2, curY, { align: 'center' });
    curY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const certNotice = `Certified that I Designated officer, ${d.division}, ${d.discomShort} along MRT have personally inspected the ${d.certCapacity} SRTPV system ${d.certAddress} the details of SRTPV system and inspection report are as below:`;
    const certNoticeLines = doc.splitTextToSize(certNotice, tableWidth);
    doc.text(certNoticeLines, marginX, curY);
    curY += (certNoticeLines.length * 3.8) + 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(`Work Completion and Inspection Report for ${d.certCapacity} Solar Roof Top PV System(SRTPV) ${d.certAddress}`, pageWidth / 2, curY, { align: 'center' });
    curY += 5.5;

    // Table Header
    doc.setFillColor(242, 244, 247);
    doc.rect(marginX, curY, tableWidth, 6, 'FD');
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + 6);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Sl. No.', marginX + (col1Width / 2), curY + 4.2, { align: 'center' });
    doc.text('Parameter', marginX + col1Width + 2, curY + 4.2);
    doc.text('Utility Observation', marginX + col1Width + col2Width + 2, curY + 4.2);
    curY += 6;

    // PART A
    curY += drawSectionHeaderRow(curY, 'A', 'Applicant Details');
    curY += drawTableRow(curY, '1', 'Name of the Applicant', d.applicantName);
    curY += drawTableRow(curY, '2', 'Application No./Registration No. with Date', d.regNoDate);
    curY += drawTableRow(curY, '2', 'Address', d.address);
    curY += drawTableRow(curY, '3', 'Consumer Number', d.consumerNo);
    curY += drawTableRow(curY, '4', 'Consumer Category', d.category);
    curY += drawTableRow(curY, '5', 'Type of Connection: 1ph LT or 3 ph LT/HT', d.connectionType);
    curY += drawTableRow(curY, '6', 'contract demand of consumer', d.contractDemand);
    curY += drawTableRow(curY, '7', 'Arrear, if any', d.arrear);
    curY += drawTableRow(curY, '8', 'Name of Developer/Vendor', d.vendorName);
    curY += drawTableRow(curY, '9', 'Date of Installation', d.installDate);

    // PART B
    curY += drawSectionHeaderRow(curY, 'B', 'Distribution Transformer Details');
    curY += drawTableRow(curY, '1', 'Capacity in KVA', d.dtCapacity);
    curY += drawTableRow(curY, '2', 'Location', d.dtLocation);
    curY += drawTableRow(curY, '3', 'Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp (individual capacity may be mentioned)', d.dtTotalConnected);
    curY += drawTableRow(curY, '4', 'Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems', d.dtAdequate);

    // PART C
    curY += drawSectionHeaderRow(curY, 'C', 'Solar Rooftop PV Power Plant Details');
    curY += drawTableRow(curY, '1', 'Details of proposed power plant\nCapacity of the SPV Power Plant (kWp)\nPlant proposed at single site/multiple sites\nInterconnection with the electricity network at single point or multiple point', `${d.plantCapacity}\n${d.plantSiteType}\n${d.plantPointType}`);
    curY += drawTableRow(curY, '2', 'Whether the Single Line Diagram of the SRTPV System (Submitted by the consumer indicating all the Safety aspects of Grid Connectivity) is OK for grid Connectivity', d.sldStatus);

    // PART D
    curY += drawSectionHeaderRow(curY, 'D', 'Grid Tied Inverter');
    curY += drawTableRow(curY, '1', 'Make', d.invMake);
    curY += drawTableRow(curY, '2', 'Serial No.', d.invSerialNo);
    curY += drawTableRow(curY, '3', 'Capacity', d.invCapacity);
    curY += drawTableRow(curY, '4', 'Input Voltage/ Output Voltage', d.invVolt);
    curY += drawTableRow(curY, '5', 'Whether Anti-islanding feature is in working condition', d.invAntiIslanding);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 1 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    // ══ PAGE 2 ══
    doc.addPage();
    curY = 12;

    doc.setFillColor(242, 244, 247);
    doc.rect(marginX, curY, tableWidth, 6, 'FD');
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + 6);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Sl. No.', marginX + (col1Width / 2), curY + 4.2, { align: 'center' });
    doc.text('Parameter', marginX + col1Width + 2, curY + 4.2);
    doc.text('Utility Observation', marginX + col1Width + col2Width + 2, curY + 4.2);
    curY += 6;

    // PART E: PV Module
    curY += drawSectionHeaderRow(curY, 'E', 'P.V Module');
    curY += drawTableRow(curY, '1', 'Make', d.pvMake);
    curY += drawTableRow(curY, '2', 'Serial No.', d.pvSerials.join('\n'));
    curY += drawTableRow(curY, '3', 'Type of Module', d.pvModel);
    curY += drawTableRow(curY, '4', 'Capacity of each Module', d.pvCapacityEach);
    curY += drawTableRow(curY, '5', 'No. of Module', d.pvCount);
    curY += drawTableRow(curY, '6', 'Total capacity of PV array', d.pvTotalCapacity);

    // PART F: Earthing
    const earthVal = `${d.dcEarthing}\n${d.acEarthing}\n${d.earthingLimit}`;
    curY += drawTableRow(curY, 'F', 'Earthing Verification (i)D.C Earthing (ii)A.C Earthing', earthVal, { slBold: true });

    // PART G: Protective System
    const protVal = `AC & DC DB: ${d.acdcDbStatus}\nManual Switch at Solar Side: ${d.manualSwitch}\nlightening arrestor: ${d.lightningArrestor}\nSPDs: ${d.spds}\nRelay operated automatic switch at net- meter side: ${d.relaySwitch}`;
    curY += drawTableRow(curY, 'G', 'Details of protective system available', protVal, { slBold: true });

    // PART H - L
    curY += drawTableRow(curY, 'H', 'Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other', d.backfeedProtection, { slBold: true });
    curY += drawTableRow(curY, 'I', 'EIC inspection and approval letter Submitted by the consumer above 50KVA', d.eicApproval, { slBold: true });
    curY += drawTableRow(curY, 'J', `Safety certificate from designated Safety officer of ${d.discomShort} below 50KVA`, d.safetyCert, { slBold: true });
    curY += drawTableRow(curY, 'K', 'Actual Single line wiring diagram of the SPV System.', d.sldDiagram, { slBold: true });
    curY += drawTableRow(curY, 'L', 'Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards', d.testReportCea, { slBold: true });

    // PART M: Meter Details Table
    const meterHeaderH = 10;
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, meterHeaderH);
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + meterHeaderH);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + meterHeaderH);
    const mSubColW = col3Width / 2;
    doc.line(marginX + col1Width + col2Width + mSubColW, curY, marginX + col1Width + col2Width + mSubColW, curY + meterHeaderH);

    doc.setFillColor(242, 244, 247);
    doc.rect(marginX, curY, col1Width + col2Width, meterHeaderH, 'F');
    doc.rect(marginX, curY, col1Width + col2Width, meterHeaderH, 'S');
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + meterHeaderH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('M', marginX + (col1Width / 2), curY + 6.5, { align: 'center' });
    doc.text('Meter Details', marginX + col1Width + 2, curY + 6.5);

    doc.setFontSize(7.5);
    const nmHeadLines = doc.splitTextToSize('Net Meter (Bi-directional Meter)', mSubColW - 3);
    doc.text(nmHeadLines, marginX + col1Width + col2Width + 2, curY + 4);

    const smHeadLines = doc.splitTextToSize('Solar Generation Meter (Details of all Solar meters)', mSubColW - 3);
    doc.text(smHeadLines, marginX + col1Width + col2Width + mSubColW + 2, curY + 4);
    curY += meterHeaderH;

    function drawMeterRow(y, slNum, paramName, nmVal, smVal) {
      const rowH = 5.6;
      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowH);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowH);
      doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowH);
      doc.line(marginX + col1Width + col2Width + mSubColW, y, marginX + col1Width + col2Width + mSubColW, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(String(slNum), marginX + (col1Width / 2), y + 4, { align: 'center' });
      doc.text(paramName, marginX + col1Width + 2, y + 4);
      doc.text(String(nmVal || ''), marginX + col1Width + col2Width + 2, y + 4);
      doc.text(String(smVal || ''), marginX + col1Width + col2Width + mSubColW + 2, y + 4);
      return rowH;
    }

    curY += drawMeterRow(curY, 1, 'Total Nos. of Meters', d.nmCount, d.smCount);
    curY += drawMeterRow(curY, 2, 'Meter Make', d.nmMake, d.smMake);
    curY += drawMeterRow(curY, 3, 'Meter Sl. No.', d.nmSerialNo, d.smSerialNo);
    curY += drawMeterRow(curY, 4, '1 Ph/ 3Ph', d.nmPhase, d.smPhase);
    curY += drawMeterRow(curY, 5, 'Capacity', d.nmCapacity, d.smCapacity);
    curY += drawMeterRow(curY, 6, 'Meter Constant', d.nmConstant, d.smConstant);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 2 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    // ══ PAGE 3 ══
    doc.addPage();
    curY = 14;

    // PART N
    curY += drawTableRow(curY, 'N', 'Any other necessary details with Remarks', d.remarks, { slBold: true });

    // Inspection Report Header
    const inspH = 6;
    doc.setLineWidth(0.2);
    doc.setFillColor(242, 244, 247);
    doc.rect(marginX, curY, tableWidth, inspH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Inspection Report', pageWidth / 2, curY + 4.2, { align: 'center' });
    curY += inspH;

    // Satisfactory row
    const satLines = doc.splitTextToSize('Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization', col2Width + col1Width - 4);
    const satValLines = doc.splitTextToSize(d.gridSatisfactory, col3Width - 4);
    const satRowH = Math.max(satLines.length * 4.2, satValLines.length * 4.2) + 3;

    doc.rect(marginX, curY, tableWidth, satRowH);
    doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + satRowH);
    doc.setFont('helvetica', 'normal');
    doc.text(satLines, marginX + 3, curY + 4.2);
    doc.text(satValLines, marginX + col1Width + col2Width + 2, curY + 4.2);
    curY += satRowH + 4;

    // Operating condition lines
    doc.setFontSize(8.5);
    doc.text(`Provision of manual and automatic switches: ${d.manualAutoSwitch}`, marginX, curY); curY += 4.5;
    doc.text('Whether Operation and Maintenance information:', marginX, curY); curY += 4;
    doc.text(`Such as Do’s and Don’ts are provided by the System Installer: ${d.omInfo}`, marginX, curY); curY += 40; // 4 cm gap before Signatures

    // Two-Column Signatures
    const sigY = curY;
    const colHalfWidth = tableWidth / 2;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature of the Applicant', marginX, sigY);
    doc.setFontSize(8.5);
    doc.text(`Name: ${d.applicantSignName || d.applicantName}`, marginX, sigY + 5);
    doc.text('Date:', marginX, sigY + 11);

    const rightColX = marginX + colHalfWidth + 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Name and Signature of the System Installer with Seal', rightColX, sigY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Name of the firm and address:', rightColX, sigY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(d.vendorFirm, rightColX, sigY + 9.5);
    doc.setFont('helvetica', 'normal');
    const vAddrLines = doc.splitTextToSize(d.vendorAddress, colHalfWidth - 6);
    doc.text(vAddrLines, rightColX, sigY + 14);

    const vDateLineY = sigY + 14 + (vAddrLines.length * 4);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', rightColX, vDateLineY + 2);

    curY = Math.max(sigY + 22, vDateLineY + 10);

    // Certified by
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Certified by', marginX, curY); curY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.text(d.certAuthority, marginX, curY); curY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', marginX, curY); curY += 6;

    // Enclosures
    doc.setFont('helvetica', 'bold');
    doc.text('Enclosures:', marginX, curY); curY += 4.5;
    doc.setFont('helvetica', 'normal');
    const encList = [
      'Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.',
      'Data sheets/Drawing for the array mounting System.',
      'Actual Single line wiring diagram of the SPV System.',
      'Copy of Maintenance & Operation information provided by the System Installer.'
    ];
    encList.forEach((enc) => {
      doc.text(enc, marginX + 3, curY);
      curY += 4.2;
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 3 of 3', marginX + tableWidth, pageHeight - 10, { align: 'right' });

    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanConsumerNo = (d.consumerNo || 'Form3').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_3_${cleanName}_${cleanConsumerNo}.pdf`;

    doc.save(fileName);
    UI.toast(`Form 3 PDF (${fileName}) downloaded successfully!`, 'success');
  } catch (err) {
    console.error('Error generating Form 3 PDF:', err);
    UI.toast(`Error generating Form 3 PDF: ${err.message}`, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.downloadForm3Docx = async function() {
  if (typeof JSZip === 'undefined') {
    UI.toast('JSZip library is not loaded. Please refresh the page and try again.', 'danger');
    return;
  }
  UI.showLoading(true);
  try {
    const d = getForm3CurrentData();
    const templateUrl = 'assets/sampleFiles/Form 3.docx';
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to load template file (${response.status} ${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let docXml = await zip.file('word/document.xml').async('text');

    docXml = docXml
      .replaceAll('TP CENTRAL ODISHA DISTRIBUTION LIMIT', d.discomOffice || 'TP CENTRAL ODISHA DISTRIBUTION LIMITED')
      .replaceAll('TPCODL', d.discomShort || 'TPCODL')
      .replaceAll('Mr. BASANTA KUMAR SAHU', d.applicantName || '')
      .replaceAll('NP-ODTCO26-13685899 / 10-07-2026', d.regNoDate || '')
      .replaceAll('At/Po-Kankadajodi, Dist-Cuttack, 754035', d.address || '')
      .replaceAll('80044799825', d.consumerNo || '')
      .replaceAll('3.0 Kwp', d.certCapacity || '')
      .replaceAll('3.0 KW', d.plantCapacity || '')
      .replaceAll('19 October 2026', d.installDate || '')
      .replaceAll('V-GUARD', d.invMake || '')
      .replaceAll('3TVS3020649A068', d.invSerialNo || '')
      .replaceAll('3KW', d.invCapacity || '')
      .replaceAll('ADANI', d.pvMake || '')
      .replaceAll('620WP', d.pvCapacityEach || '')
      .replaceAll('5NOS.', d.pvCount || '')
      .replaceAll('3.100KW', d.pvTotalCapacity || '')
      .replaceAll('TOPCON', d.pvModel || '');

    // Remove the large space gap after "Designated officer," and inject division + discom
    docXml = docXml.replace(
      /officer,[\s\S]*?Division[\s\S]*?, TPCODL along MRT/,
      `officer, ${d.division || ''}, ${d.discomShort || ''} along MRT`
    );

    // Replace connection type (1ph LT)
    docXml = docXml.replace(
      /(LT\/HT<\/w:t>[\s\S]*?<w:tc>[\s\S]*?<w:t>)1ph<\/w:t>[\s\S]*?<w:t>LT(<\/w:t>)/,
      `$1${d.connectionType || '1ph LT'}$2`
    );

    // Replace sample PV Module serials with dynamic ones if available
    const origSerials = [
      'AS2609251A4481',
      'AS2609251A4477',
      'AS2609261A0052',
      'AS2609251A4462',
      'AS2609251A4527'
    ];
    if (d.pvSerials && d.pvSerials.length > 0) {
      origSerials.forEach((origS, idx) => {
        if (d.pvSerials[idx]) {
          docXml = docXml.replaceAll(origS, d.pvSerials[idx]);
        }
      });
    }

    if (d.vendorFirm && d.vendorFirm !== 'Shri Trutiyadev Solar Enterprises') {
      docXml = docXml.replaceAll('Shri Trutiyadev Solar Enterprises', d.vendorFirm);
    }

    zip.file('word/document.xml', docXml);
    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Form_3_Inspection_${cleanName}.docx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(docxBlob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1000);
    UI.toast(`Form 3 Word Document (${fileName}) downloaded!`, 'success');
  } catch (err) {
    console.error('Error generating Form 3 docx:', err);
    UI.toast('Error generating Form 3 Word document: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};
