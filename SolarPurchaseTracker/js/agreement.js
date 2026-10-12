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
  UI.renderSidebar('agreement.html');
  UI.renderTopbar('Agreement Generator');

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

  const addrParts = [];
  if (r.Address) addrParts.push(r.Address);
  if (r.District) addrParts.push(`District: ${r.District}`);
  addrParts.push(`State: ${r.State || 'Odisha'}`);
  if (r.PinCode) addrParts.push(`Pin: ${r.PinCode}`);
  
  const fullAddressUpper = (addrParts.join(', ') || '').toUpperCase();
  document.getElementById('agrAddress').value = fullAddressUpper;

  // 2. Populate Form 4 Tab with THIS RESPECTIVE CUSTOMER'S exact data
  populateForm4Fields(r);

  // 3. Populate Form 6 Tab (Inspection Report) with exact customer data
  populateForm6Fields(r);

  UI.toast(`Auto-filled details for ${r.Name}`, 'info');
};

window.resetAgreementForm = function() {
  selectedCustomerSlNo = null;
  selectedDistrict = 'ALL';
  updateDistrictStats();
  document.getElementById('agreementForm').reset();
  const searchQuery = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(searchQuery);
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

  // Header Subtitle
  const headerSub = document.getElementById('f4HeaderSub');
  if (headerSub) {
    headerSub.innerHTML = `Auto-filled for <strong class="text-dark">${escapeHtml(customerName || 'Selected Customer')}</strong> (Consumer: ${escapeHtml(consumerNo || '—')}, District: ${escapeHtml(district || '—')})`;
  }

  // DISCOM Utility Name & Offices
  const discomName = getDiscomName(district, r.CircleName);
  const circleName = (r.CircleName || (district ? `${district} Circle` : `${discomName} Circle`)).trim();
  const division = (r.DivisionName || (district ? `${district} Division` : 'CED Jajpur')).trim();
  const subDiv = (r.SubDivision || '').trim();
  const officeVal = `${subDiv ? subDiv + ' Subdivision, ' : ''}${division}, ${circleName}`;

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
  setInputVal('f4ModuleSerials', serials.join('\n'));

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
  setInputVal('f4LaSizeType', earth.LaSizeType || 'Copper Bonded');

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
  const headerSub = document.getElementById('f4HeaderSub');
  if (headerSub) headerSub.textContent = 'Pre-populated from customer database & product specifications';
  UI.toast('Form 4 inputs cleared.', 'info');
};

function getForm4CurrentData() {
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

  return {
    customerName: custName,
    consumerNo: custConsumer,
    office: getInputVal('f4Office', `${custDist ? custDist + ' Division, ' : ''}${custCircle}`),
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
    laSizeType: getInputVal('f4LaSizeType', 'Copper Bonded'),

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

      <!-- Spacing between Certification statement and Signatures block -->
      <div style="height: 40px;"></div>

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
          <div class="mt-3"><strong>Date:</strong> ${escapeHtml(d.reportDate)}</div>
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
    doc.text(d.office, marginX, curY); curY += 6;

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
    curY += (certLines.length * 4) + 18; // Generous 18mm vertical gap before Signature row

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
    doc.text(`Date: ${d.reportDate}`, rightColX, instDateLineY + 6);

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

  if (!nameVal || !consumerNoVal || !addressVal) {
    UI.toast('Please fill in Customer Name, Consumer Number, and Full Address.', 'warning');
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
      .replaceAll('{{CONSUMERNO}}', consumerNoVal);

    zip.file('word/document.xml', docXml);

    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // Clean filenames for download
    const cleanName = nameVal.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanConsumerNo = consumerNoVal.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Agreement_${cleanName}_${cleanConsumerNo}.docx`;

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

  // Header Subtitle
  const headerSub = document.getElementById('f6HeaderSub');
  if (headerSub) {
    headerSub.innerHTML = `Auto-filled for <strong class="text-dark">${escapeHtml(customerName || 'Selected Customer')}</strong> (Consumer: ${escapeHtml(consumerNo || '—')}, District: ${escapeHtml(district || '—')})`;
  }

  // DISCOM Utility Name
  const discomShort = getDiscomName(district, r.CircleName);
  const discomFull = getDiscomFullName(discomShort);

  // Capacity & Date
  const rawCapacity = (specs.PvModule && specs.PvModule.TotalCapacity) || r.ProposedCapacity || '3.32';
  const capNum = parseFloat(String(rawCapacity).replace(/[^0-9.]/g, '')) || 3.32;
  const plantCapStr = `${Math.round(capNum)} KWP`;
  const totalCapModuleStr = `${capNum.toFixed(2)} KWP`;

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
  setInputVal('f6InspectionDate', installDateFormatted);
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

  // Part B: Distribution Transformer Details (All empty by default as Form 6)
  setInputVal('f6DtrCapacity', '');
  setInputVal('f6DtrLocation', '');
  setInputVal('f6DtrExistingSolar', '');
  setInputVal('f6DtrAdequate', '');

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
  const capEach = pv.CapacityEach || '555 WP - 4pic, 550 WP - 2pic';
  const serials = getOrGenerateSerials(r, specs, moduleCount, moduleMake);

  setInputVal('f6PvMake', moduleMake);
  setInputVal('f6PvModel', moduleModel);
  setInputVal('f6PvTotalCapacity', totalCapModuleStr);
  setInputVal('f6PvCapacityEach', capEach);
  setInputVal('f6PvCount', moduleCount);
  setInputVal('f6PvInstallDate', installDateFormatted);
  setInputVal('f6PvSerials', serials.join('\n'));

  // Part F & G & H: Earthing & Protective Systems (Values following Form 6)
  const earth = specs.DetailsOfEarthing || {};
  setInputVal('f6DcEarthing', earth.DcEarthing || '1.7 in Ohm');
  setInputVal('f6AcEarthing', earth.AcEarthing || '2.3 in Ohm');
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
    inspectionDate: getInputVal('f6InspectionDate', ''),
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
    dtrAdequate: getInputVal('f6DtrAdequate', ''),

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
    pvTotalCapacity: getInputVal('f6PvTotalCapacity', '3.32 KWp'),
    pvCapacityEach: getInputVal('f6PvCapacityEach', '555 WP - 4pic, 550 WP - 2pic'),
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
    }
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
        <div class="fw-bold text-dark mt-0.5" style="font-size: 13px;">INSPECTION REPORT FOR RTS (FORM-06)</div>
      </div>

      <div class="mb-3 text-justify" style="font-size: 10px; line-height: 1.45;">
        Certified that the ${escapeHtml(d.certCapacity)} SPV system ${escapeHtml(d.certAddress)} under ${escapeHtml(d.section)} Section, ${escapeHtml(d.subDivision)} Sub-Division &amp; ${escapeHtml(d.division)} Division has been inspected on ${escapeHtml(d.inspectionDate)}.<br>
        The details of inspection report are as below:<br>
        <strong>Inspection Report for ${escapeHtml(d.certCapacity)} Solar Roof Top PV System (SRTPV) ${escapeHtml(d.certAddress)}</strong>
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
            <td colspan="3">A. Applicant Details</td>
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
            <td style="text-align: center;"></td>
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
            <td colspan="3">B. Distribution Transformer Details</td>
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
            <td colspan="3">C. Solar Rooftop PV Power Plant Details</td>
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
            <td colspan="3">D. Grid Tied Inverter</td>
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
            <td colspan="3">E. P.V Module</td>
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
          <tr class="fw-bold bg-light">
            <td colspan="3">F. Earthing Verification</td>
          </tr>
          <tr>
            <td style="text-align: center;"></td>
            <td>(i) D.C Earthing<br>(ii) A.C Earthing</td>
            <td>(i) ${escapeHtml(d.dcEarthing)}<br>(ii) ${escapeHtml(d.acEarthing)}</td>
          </tr>
          <tr>
            <td style="text-align: center;"></td>
            <td>Within permissible limit or Not (Values should be certified by contractor with HV Supervisory license)</td>
            <td>${escapeHtml(d.earthingLimit)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="3">G. Details of protective system available</td>
          </tr>
          <tr>
            <td style="text-align: center;"></td>
            <td>(i) AC &amp; DC DB: Yes/No<br>(ii) Manual Switch at Solar Side: Yes/No<br>(iii) Relay operated automatic switch at net-meter side: Yes/ No</td>
            <td>(i) ${escapeHtml(d.acdcDbStatus)}<br>(ii) ${escapeHtml(d.manualSwitch)}<br>(iii) ${escapeHtml(d.relaySwitch)}</td>
          </tr>
          <tr class="fw-bold">
            <td style="text-align: center;">H</td>
            <td>Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other</td>
            <td>${escapeHtml(d.backfeedProtection)}</td>
          </tr>
          <tr class="fw-bold">
            <td style="text-align: center;">I</td>
            <td>EIC inspection and approval letter Submitted by the consumer above 50KVA</td>
            <td>${escapeHtml(d.eicApproval)}</td>
          </tr>
          <tr class="fw-bold">
            <td style="text-align: center;">J</td>
            <td>Safety certificate from designated Safety officer of ${escapeHtml(d.inspectingAuthority)} below 50KVA</td>
            <td>${escapeHtml(d.safetyCert)}</td>
          </tr>
          <tr class="fw-bold">
            <td style="text-align: center;">K</td>
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
          <tr class="fw-bold">
            <td style="width: 35px; text-align: center;">L</td>
            <td style="width: 50%;">Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards</td>
            <td style="width: 45%;">${escapeHtml(d.testReportCea)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="3">M. Meter Details (If arranged before Inspection)</td>
          </tr>
        </tbody>
      </table>

      <!-- Meter Sub-Table -->
      <table class="form4-preview-table mb-2">
        <thead>
          <tr class="fw-bold bg-light text-center">
            <th style="width: 35px;">Sl.</th>
            <th style="width: 35%;">Parameter</th>
            <th style="width: 30%;">Net Meter (Bi-directional)</th>
            <th style="width: 30%;">Solar Generation Meter</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Total Nos. of Meters</td>
            <td>${escapeHtml(d.nmCount)}</td>
            <td>${escapeHtml(d.smCount)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Meter Make</td>
            <td>${escapeHtml(d.nmMake)}</td>
            <td>${escapeHtml(d.smMake)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Meter Sl. No.</td>
            <td style="font-family: monospace;">${escapeHtml(d.nmSerialNo)}</td>
            <td style="font-family: monospace;">${escapeHtml(d.smSerialNo)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">4</td>
            <td>1 Ph/ 3Ph</td>
            <td>${escapeHtml(d.nmPhase)}</td>
            <td>${escapeHtml(d.smPhase)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Capacity</td>
            <td>${escapeHtml(d.nmCapacity)}</td>
            <td>${escapeHtml(d.smCapacity)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Meter Constant</td>
            <td>${escapeHtml(d.nmConstant)}</td>
            <td>${escapeHtml(d.smConstant)}</td>
          </tr>
        </tbody>
      </table>

      <table class="form4-preview-table mb-3">
        <tbody>
          <tr>
            <td style="width: 35px; text-align: center; font-weight: bold;">N</td>
            <td style="width: 50%; font-weight: bold;">Any other necessary details with Remarks</td>
            <td style="width: 45%;">${escapeHtml(d.remarks)}</td>
          </tr>
          <tr class="fw-bold bg-light">
            <td colspan="3">Inspection Report</td>
          </tr>
          <tr>
            <td style="text-align: center;"></td>
            <td>Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization</td>
            <td>${escapeHtml(d.gridSatisfactory)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Observations and Signatures Block -->
      <div class="row g-2 mt-4" style="font-size: 11px;">
        <div class="col-7">
          <div class="fw-bold text-decoration-underline mb-1">Observations (If any)</div>
          <div style="min-height: 45px; font-size: 10px; padding: 4px; border: 1px dashed #cbd5e1; border-radius: 4px;" class="text-dark">
            ${escapeHtml(d.observations) || '<span class="text-muted fst-italic">None</span>'}
          </div>
        </div>
        <div class="col-5 text-end">
          <div class="fw-bold">Authorized signatory</div>
          <div class="fw-semibold">${escapeHtml(d.inspectingAuthority)}</div>
          <div class="mt-4"><strong>Date - </strong></div>
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
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
      }

      doc.text(col2Lines, marginX + col1Width + 2, y + 4.2);

      if (opt.valFontMono) doc.setFont('courier', opt.valBold ? 'bold' : 'normal');
      doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 4.2);
      if (opt.valFontMono) doc.setFont('helvetica', 'normal');

      return y + rowHeight;
    }

    // Helper: Draw section header row
    function drawTableHeader(y, headerTitle, headerVal = '', opt = {}) {
      const fontSize = opt.fontSize || 9;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');

      const titleLines = doc.splitTextToSize(headerTitle || '', (opt.spanAll ? tableWidth : col1Width + col2Width) - 4);
      const rowHeight = Math.max(opt.minHeight || 6.2, titleLines.length * 4.2 + 2);

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

    // Helper: Draw 4-column row for Meter details (Section M)
    function drawTable4ColRow(y, slText, paramText, netVal, solarVal, opt = {}) {
      const fontSize = opt.fontSize || 8.5;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

      const pWidth = 50;
      const nmWidth = 60;
      const smWidth = 60;

      const pLines = doc.splitTextToSize(paramText || '', pWidth - 4);
      const nmLines = doc.splitTextToSize(netVal || '', nmWidth - 4);
      const smLines = doc.splitTextToSize(solarVal || '', smWidth - 4);

      const maxLines = Math.max(pLines.length, nmLines.length, smLines.length, 1);
      const rowHeight = Math.max(opt.minHeight || 5.8, maxLines * 4.2 + 2.4);

      doc.setLineWidth(0.2);
      doc.rect(marginX, y, tableWidth, rowHeight);
      doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
      doc.line(marginX + col1Width + pWidth, y, marginX + col1Width + pWidth, y + rowHeight);
      doc.line(marginX + col1Width + pWidth + nmWidth, y, marginX + col1Width + pWidth + nmWidth, y + rowHeight);

      if (slText) {
        doc.text(String(slText), marginX + (col1Width / 2), y + 4.2, { align: 'center' });
      }

      doc.text(pLines, marginX + col1Width + 2, y + 4.2);

      if (opt.mono) doc.setFont('courier', 'normal');
      doc.text(nmLines, marginX + col1Width + pWidth + 2, y + 4.2);
      doc.text(smLines, marginX + col1Width + pWidth + nmWidth + 2, y + 4.2);
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
    doc.text('INSPECTION REPORT FOR RTS (FORM-06)', pageWidth / 2, curY, { align: 'center' });
    curY += 6;

    // Inspection Certification Paragraph
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const certText = `Certified that the ${d.certCapacity} SPV system ${d.certAddress} under ${d.section} Section, ${d.subDivision} Sub-Division & ${d.division} Division has been inspected on ${d.inspectionDate ? d.inspectionDate + '.' : '.'}`;
    const certLines = doc.splitTextToSize(certText, tableWidth);
    doc.text(certLines, marginX, curY);
    curY += (certLines.length * 3.8) + 1.5;

    const subText = `The details of inspection report are as below:\nInspection Report for ${d.certCapacity} Solar Roof Top PV System (SRTPV) ${d.certAddress}`;
    const subLines = doc.splitTextToSize(subText, tableWidth);
    doc.setFont('helvetica', 'bold');
    doc.text(subLines, marginX, curY);
    curY += (subLines.length * 3.8) + 3;

    // Table Column Headers
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

    // PART A: Applicant Details
    curY = drawTableHeader(curY, 'A. Applicant Details', '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'Name of the Applicant', d.applicantName);
    curY = drawTableRow(curY, '2', 'Application No./Registration No. with Date', d.regNoDate);
    curY = drawTableRow(curY, '', 'Address', d.address);
    curY = drawTableRow(curY, '3', 'Consumer Number', d.consumerNo, { valFontMono: true });
    curY = drawTableRow(curY, '4', 'Consumer Category', d.category);
    curY = drawTableRow(curY, '5', 'Type of Connection: 1ph LT or 3 ph LT/HT', d.connectionType);
    curY = drawTableRow(curY, '6', 'Contract demand of consumer', d.contractDemand);
    curY = drawTableRow(curY, '7', 'Arrear, if any', d.arrear);

    // PART B: Distribution Transformer Details
    curY = drawTableHeader(curY, 'B. Distribution Transformer Details', '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'Capacity in KVA', d.dtrCapacity);
    curY = drawTableRow(curY, '2', 'Location', d.dtrLocation);
    curY = drawTableRow(curY, '3', 'Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp (individual capacity may be mentioned)', d.dtrExistingSolar);
    curY = drawTableRow(curY, '4', 'Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems', d.dtrAdequate);

    // PART C: Solar Rooftop PV Power Plant Details
    curY = drawTableHeader(curY, 'C. Solar Rooftop PV Power Plant Details', '', { spanAll: true });
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

    // PART D: Grid Tied Inverter
    curY = drawTableHeader(curY, 'D. Grid Tied Inverter', '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'Make', d.invMake);
    curY = drawTableRow(curY, '2', 'Serial No.', d.invSerialNo, { valFontMono: true });
    curY = drawTableRow(curY, '3', 'Capacity', d.invCapacity);
    curY = drawTableRow(curY, '4', 'Input Voltage/ Output Voltage', d.invVolt);
    curY = drawTableRow(curY, '5', 'Whether Anti-islanding feature is in working condition', d.invAntiIslanding);
    curY = drawTableRow(curY, '6', 'Date of installation', d.invInstallDate);

    // PART E: P.V Module
    curY = drawTableHeader(curY, 'E. P.V Module', '', { spanAll: true });
    curY = drawTableRow(curY, '1', 'Make', d.pvMake);
    const serialsLinesStr = d.pvSerials.length > 0 ? d.pvSerials.join('\n') : '';
    curY = drawTableRow(curY, '2', 'Serial No.', serialsLinesStr, { valFontMono: true, fontSize: 8 });
    curY = drawTableRow(curY, '3', 'Type of Module & model', d.pvModel);
    curY = drawTableRow(curY, '4', 'Capacity of each Module', d.pvCapacityEach);
    curY = drawTableRow(curY, '5', 'No. of Module', d.pvCount);
    curY = drawTableRow(curY, '6', 'Total capacity of Module', d.pvTotalCapacity);
    curY = drawTableRow(curY, '7', 'Date of installation', d.pvInstallDate);

    // PART F: Earthing Verification
    curY = drawTableHeader(curY, 'F. Earthing Verification', '', { spanAll: true });
    const earthingLabel = '(i) D.C Earthing\n(ii) A.C Earthing';
    const earthingVal = `(i) ${d.dcEarthing}\n(ii) ${d.acEarthing}`;
    curY = drawTableRow(curY, '', earthingLabel, earthingVal);
    curY = drawTableRow(curY, '', 'Within permissible limit or Not (Values should be certified by contractor with HV Supervisory license)', d.earthingLimit);

    // PART G: Protective Systems
    curY = drawTableHeader(curY, 'G. Details of protective system available', '', { spanAll: true });
    const protLabel = '(i) AC & DC DB: Yes/No\n(ii) Manual Switch at Solar Side: Yes/No\n(iii) Relay operated automatic switch at net-meter side: Yes/ No';
    const protVal = `(i) ${d.acdcDbStatus}\n(ii) ${d.manualSwitch}\n(iii) ${d.relaySwitch}`;
    curY = drawTableRow(curY, '', protLabel, protVal);

    // PART H, I, J, K
    curY = drawTableRow(curY, 'H', 'Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other', d.backfeedProtection, { isBold: true });
    curY = drawTableRow(curY, 'I', 'EIC inspection and approval letter Submitted by the consumer above 50KVA', d.eicApproval, { isBold: true });
    curY = drawTableRow(curY, 'J', `Safety certificate from designated Safety officer of ${d.inspectingAuthority} below 50KVA`, d.safetyCert, { isBold: true });
    curY = drawTableRow(curY, 'K', 'Work Completion Report of SRTPV by consumer', d.workCompletionReport, { isBold: true });

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
    curY = drawTableRow(curY, 'L', 'Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards', d.testReportCea, { isBold: true });

    // PART M: Meter Details (4-Column Subtable)
    curY = drawTableHeader(curY, 'M. Meter Details (If arranged before Inspection)', '', { spanAll: true });

    // Meter Subtable Header
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    const pWidth = 50;
    const nmWidth = 60;
    const smWidth = 60;
    const mHeadHeight = 6.2;
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, tableWidth, mHeadHeight);
    doc.line(marginX + col1Width, curY, marginX + col1Width, curY + mHeadHeight);
    doc.line(marginX + col1Width + pWidth, curY, marginX + col1Width + pWidth, curY + mHeadHeight);
    doc.line(marginX + col1Width + pWidth + nmWidth, curY, marginX + col1Width + pWidth + nmWidth, curY + mHeadHeight);
    doc.text('Sl. No.', marginX + (col1Width / 2), curY + 4.2, { align: 'center' });
    doc.text('Parameter', marginX + col1Width + 2, curY + 4.2);
    doc.text('Net Meter (Bi-directional Meter)', marginX + col1Width + pWidth + 2, curY + 4.2);
    doc.text('Solar Generation Meter (Details)', marginX + col1Width + pWidth + nmWidth + 2, curY + 4.2);
    curY += mHeadHeight;

    curY = drawTable4ColRow(curY, '1', 'Total Nos. of Meters', d.nmCount, d.smCount);
    curY = drawTable4ColRow(curY, '2', 'Meter Make', d.nmMake, d.smMake);
    curY = drawTable4ColRow(curY, '3', 'Meter Sl. No.', d.nmSerialNo, d.smSerialNo, { mono: true });
    curY = drawTable4ColRow(curY, '4', '1 Ph/ 3Ph', d.nmPhase, d.smPhase);
    curY = drawTable4ColRow(curY, '5', 'Capacity', d.nmCapacity, d.smCapacity);
    curY = drawTable4ColRow(curY, '6', 'Meter Constant', d.nmConstant, d.smConstant);

    // PART N: Any other necessary details with Remarks (Row N as in Form 6)
    curY = drawTableRow(curY, 'N', 'Any other necessary details with Remarks', d.remarks, { isBold: true });

    // Inspection Report Section
    curY = drawTableHeader(curY, 'Inspection Report', '', { spanAll: true });
    curY = drawTableRow(curY, '', 'Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization', d.gridSatisfactory);

    // Observations (Left) & Authorized signatory (Right)
    curY += 14;

    // Left Column: Observations (If any)
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Observations (If any)', marginX + 2, curY);
    doc.setLineWidth(0.3);
    doc.line(marginX + 2, curY + 1.2, marginX + 38, curY + 1.2);

    if (d.observations) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const obsLines = doc.splitTextToSize(d.observations, 95);
      doc.text(obsLines, marginX + 2, curY + 6);
    }

    // Right Column: Authorized signatory
    const sigX = marginX + (tableWidth / 2) + 15;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized signatory', sigX, curY);
    curY += 5.5;
    doc.text(d.inspectingAuthority, sigX, curY);
    curY += 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Date - ', sigX, curY);

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
