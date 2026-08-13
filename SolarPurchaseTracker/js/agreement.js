/* =========================================================================
   agreement.js — Agreement Word Document (.docx) Generator
   ========================================================================= */

let selectedCustomerSlNo = null;
let selectedDistrict = 'ALL';

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

  const badgeStyles = [
    'bg-primary-subtle text-primary-emphasis border border-primary-subtle',
    'bg-success-subtle text-success-emphasis border border-success-subtle',
    'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    'bg-danger-subtle text-danger-emphasis border border-danger-subtle',
    'bg-info-subtle text-info-emphasis border border-info-subtle',
    'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle'
  ];

  const isTotalActive = selectedDistrict === 'ALL';
  const totalBadgeClass = isTotalActive
    ? 'bg-dark text-white border border-2 border-success shadow-sm fw-bold'
    : 'bg-success-subtle text-success-emphasis border border-success-subtle';

  const totalBadge = `<span onclick="window.toggleDistrictBadgeFilter('ALL')" class="badge rounded-pill ${totalBadgeClass} px-2.5 py-1 fs-8" style="font-size: 0.74rem !important; font-weight: ${isTotalActive ? '700' : '500'}; cursor: pointer; transition: all 0.15s ease; ${isTotalActive ? 'box-shadow: 0 2px 5px rgba(0,0,0,0.25); transform: scale(1.05);' : 'opacity: 0.85;'}" title="Show all districts">${isTotalActive ? '✓ ' : ''}Total: ${totalCount}</span>`;

  const districtBadges = sortedDistricts.map((dist, index) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistrict === targetDist;
    const style = badgeStyles[index % badgeStyles.length];

    const safeDist = targetDist.replace(/'/g, "\\'");
    if (isSelected) {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}')" class="badge rounded-pill bg-primary text-white border border-2 border-dark shadow-sm px-2.5 py-1 fs-8" style="font-size: 0.76rem !important; font-weight: 700 !important; cursor: pointer; box-shadow: 0 2px 6px rgba(13, 110, 253, 0.4); transform: scale(1.05); transition: all 0.15s ease;" title="Selected filter. Click to reset.">✓ ${dist}: ${count}</span>`;
    } else {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}')" class="badge rounded-pill ${style} px-2 py-0.5 fs-8" style="font-size: 0.72rem !important; font-weight: 500; cursor: pointer; opacity: 0.85; transition: all 0.15s ease;" title="Click to filter by ${dist}">${dist}: ${count}</span>`;
    }
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
      <div class="customer-list-item p-2 mb-1 rounded d-flex justify-content-between align-items-center ${activeClass}" 
           onclick="selectCustomerForAgreement(${r.SlNo})">
        <div class="d-flex flex-column text-truncate pe-2">
          <span class="text-dark fs-7 text-truncate">${r.Name || 'Unnamed'}<span class="text-muted font-monospace fs-8">${distStr}</span></span>
          <small class="text-muted fs-8">Consumer No: ${r.ConsumerNo || '—'}</small>
        </div>
        <span class="fs-7 text-secondary">➔</span>
      </div>
    `;
  }).join('');
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

  // 1. Name
  document.getElementById('agrName').value = r.Name || '';

  // 2. Consumer Number
  document.getElementById('agrConsumerNo').value = r.ConsumerNo || '';

  // 3. Full Address in UPPERCASE
  const addrParts = [];
  if (r.Address) addrParts.push(r.Address);
  if (r.District) addrParts.push(`District: ${r.District}`);
  addrParts.push(`State: ${r.State || 'Odisha'}`);
  if (r.PinCode) addrParts.push(`Pin: ${r.PinCode}`);
  
  const fullAddressUpper = (addrParts.join(', ') || '').toUpperCase();
  document.getElementById('agrAddress').value = fullAddressUpper;

  UI.toast(`Auto-filled details for ${r.Name}`, 'info');
};

window.resetAgreementForm = function() {
  selectedCustomerSlNo = null;
  selectedDistrict = 'ALL';
  updateDistrictStats();
  document.getElementById('agreementForm').reset();
  const searchQuery = document.getElementById('custSearchInput') ? document.getElementById('custSearchInput').value : '';
  renderCustomerDirectory(searchQuery);
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
