/* =========================================================================
   settings.js — Company Settings & Profiles
   ========================================================================= */

let base64Logo = '';
let base64Stamp = '';
let officeAddresses = [];
let editingAddressIndex = -1;
let editingAddressValue = '';

// Government Subsidy settings variables
let subsidiesList = [];
let editingSubsidyIndex = -1;
let editingSubsidyKW = '';
let editingSubsidyState = '';
let editingSubsidyCentral = '';

window.onDbReady = function () {
  UI.renderSidebar('settings.html');
  UI.renderTopbar('Settings', 'Company preferences and database connection', '');

  // Form load
  loadSettingsForm();

  // Button binds
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettingsForm);
  document.getElementById('btnAddAddress').addEventListener('click', addAddress);
  document.getElementById('btnAddingSubsidy').addEventListener('click', addSubsidy);

  // File Picker Binds
  document.getElementById('sLogoFile').addEventListener('change', (e) => handleFileSelect(e, 'logo'));
  document.getElementById('sStampFile').addEventListener('change', (e) => handleFileSelect(e, 'stamp'));

  // Clear Binds
  document.getElementById('btnClearLogo').addEventListener('click', () => clearImage('logo'));
  document.getElementById('btnClearStamp').addEventListener('click', () => clearImage('stamp'));

  // UPI Input dynamic binding
  document.getElementById('sUPIId').addEventListener('input', (e) => {
    updateUPIQRPreview(e.target.value.trim());
  });

  // Connect & backup buttons mapping
  const mode = DB.getMode();
  document.getElementById('dbModeText').textContent = 
    mode === 'fs' ? 'Live local folder (auto-save)' : 
    (mode === 'sqlite' ? 'SQLite Server Database (solartrack.db)' : 'Offline Browser Storage (Local Cache)');

  if (mode === 'fs') {
    document.getElementById('fsModeBox').classList.remove('d-none');
    document.getElementById('btnSwitchFolder').addEventListener('click', async () => {
      try { await DB.pickFolder(); UI.toast('Database folder switched.', 'success'); loadSettingsForm(); }
      catch (e) { if (e.name !== 'AbortError') UI.toast(e.message, 'danger'); }
    });
  } else if (mode === 'sqlite') {
    document.getElementById('sqliteModeBox').classList.remove('d-none');
    document.getElementById('btnDownloadAllSqlite').addEventListener('click', () => {
      DB.downloadAllWorkbooks();
      UI.toast('SQLite tables exported to Excel.', 'success');
    });
  } else {
    document.getElementById('uploadModeBox').classList.remove('d-none');
    document.getElementById('btnDownloadAll').addEventListener('click', () => {
      DB.downloadAllWorkbooks();
      UI.toast('Excel database files downloaded.', 'success');
    });

    const connectBtn = document.getElementById('btnConnectFolderFromSettings');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        try {
          UI.showLoading(true);
          await DB.pickFolder();
          UI.showLoading(false);
          UI.toast('Database folder connected successfully.', 'success');
          location.reload();
        } catch (e) {
          UI.showLoading(false);
          if (e.name !== 'AbortError') UI.toast('Could not open folder: ' + e.message, 'danger');
        }
      });
    }
  }

  document.getElementById('btnBackupAll').addEventListener('click', () => {
    ['shipments', 'materials', 'vendors', 'items', 'settings', 'installments'].forEach(key => {
      const rows = DB.getAll(key);
      Utils.exportRowsToExcel(rows, DB.HEADERS[key], `Backup_${key}_${UI.todayISO()}.xlsx`);
    });
    UI.toast('Backup files downloaded.', 'success');
  });
};

function handleFileSelect(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const base64 = evt.target.result;
    if (type === 'logo') {
      base64Logo = base64;
      showPreview('logo', base64);
    } else {
      base64Stamp = base64;
      showPreview('stamp', base64);
    }
  };
  reader.readAsDataURL(file);
}

function showPreview(type, base64) {
  const img = document.getElementById(type === 'logo' ? 'imgLogoPreview' : 'imgStampPreview');
  const btn = document.getElementById(type === 'logo' ? 'btnClearLogo' : 'btnClearStamp');
  if (img && btn) {
    img.src = base64;
    img.style.display = 'block';
    btn.style.display = 'inline-block';
  }
}

function clearImage(type) {
  const input = document.getElementById(type === 'logo' ? 'sLogoFile' : 'sStampFile');
  const img = document.getElementById(type === 'logo' ? 'imgLogoPreview' : 'imgStampPreview');
  const btn = document.getElementById(type === 'logo' ? 'btnClearLogo' : 'btnClearStamp');
  if (input) input.value = '';
  if (img) { img.src = ''; img.style.display = 'none'; }
  if (btn) btn.style.display = 'none';

  if (type === 'logo') {
    base64Logo = '';
  } else {
    base64Stamp = '';
  }
}

function updateUPIQRPreview(upiId) {
  const box = document.getElementById('upiQrPreviewBox');
  const img = document.getElementById('imgUPIQRPreview');
  if (!box || !img) return;

  if (upiId) {
    const upiUri = `upi://pay?pa=${upiId}&pn=Company&am=1.00&cu=INR`;
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

function loadSettingsForm() {
  const settings = DB.getAll('settings');
  const get = (key, def = '') => (settings.find(s => s.Key === key) || {}).Value ?? def;

  document.getElementById('sCompanyName').value = get('CompanyName', '');
  document.getElementById('sCompanyEmail').value = get('CompanyEmail', '');
  document.getElementById('sCompanyPhone').value = get('CompanyPhone', '');
  document.getElementById('sCompanyGST').value = get('CompanyGST', '');
  document.getElementById('sDefaultGST').value = get('DefaultGST', 18);

  // Load images
  base64Logo = get('CompanyLogo', '');
  if (base64Logo) {
    showPreview('logo', base64Logo);
  } else {
    clearImage('logo');
  }

  base64Stamp = get('CompanyStamp', '');
  if (base64Stamp) {
    showPreview('stamp', base64Stamp);
  } else {
    clearImage('stamp');
  }

  // Load addresses
  try {
    officeAddresses = JSON.parse(get('CompanyAddresses', '[]'));
  } catch (e) {
    officeAddresses = [];
  }
  renderAddressesList();

  // Load Subsidies
  try {
    subsidiesList = JSON.parse(get('GovtSubsidies', '[]'));
  } catch (e) {
    subsidiesList = [];
  }
  renderSubsidiesList();

  // Load Bank Details (Prefill default values)
  document.getElementById('sBankAcHolder').value = get('BankAcHolder', 'URJJA ONE POWERTECH LLP');
  document.getElementById('sBankName').value = get('BankName', 'ICICI BANK LTD');
  document.getElementById('sBankAcNo').value = get('BankAcNo', '634305015260');
  document.getElementById('sBankBranchIFS').value = get('BankBranchIFS', 'BHANGAGARH & ICIC0006343');

  // Load UPI
  const upiId = get('CompanyUPI', '');
  document.getElementById('sUPIId').value = upiId;
  updateUPIQRPreview(upiId);

  // Load Terms (Prefill defaults)
  const defaultTerms = '1. Warranty as per manufacturer terms.\n2. 50% advance on login.';
  document.getElementById('sTerms').value = get('CompanyTerms', defaultTerms);
}

/* ── Manage Addresses ────────────────────────────────────────────────── */

function renderAddressesList() {
  const container = document.getElementById('sAddressesList');
  if (!container) return;

  if (officeAddresses.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-2 fs-8">No office addresses added.</div>`;
    return;
  }

  container.innerHTML = officeAddresses.map((addr, index) => {
    const isEditing = (editingAddressIndex === index);

    if (isEditing) {
      return `
        <div class="d-flex align-items-center gap-2 bg-light border border-primary rounded p-1 mb-1" style="font-size:0.78rem;">
          <input type="text" class="form-control form-control-sm border-0 p-1 text-dark fw-bold flex-grow-1 bg-white" id="editAddressInput_${index}" value="${editingAddressValue}" placeholder="Enter office address" onkeydown="if(event.key === 'Enter') saveAddressRow(${index}); else if(event.key === 'Escape') cancelAddressRow();">
          <button type="button" class="btn btn-xs btn-outline-success border-0 text-success p-1 ms-1" onclick="saveAddressRow(${index})" style="flex-shrink:0;" title="Save Address">✔️</button>
          <button type="button" class="btn btn-xs btn-outline-secondary border-0 text-secondary p-1" onclick="cancelAddressRow()" style="flex-shrink:0;" title="Cancel">❌</button>
        </div>
      `;
    } else {
      return `
        <div class="d-flex align-items-center gap-2 bg-white border rounded p-1 mb-1" style="font-size:0.78rem;">
          <span class="text-dark fw-semibold text-start flex-grow-1 ps-2 truncate-addr" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">${addr}</span>
          <button type="button" class="btn btn-xs btn-outline-primary border-0 text-primary p-1 ms-1" onclick="editAddressRow(${index})" style="flex-shrink:0;" title="Edit Address">✏️</button>
          <button type="button" class="btn btn-xs btn-outline-danger border-0 text-danger p-1" onclick="deleteAddress(${index})" style="flex-shrink:0;" title="Delete Address">🗑️</button>
        </div>
      `;
    }
  }).join('');
}

window.editAddressRow = function (index) {
  editingAddressIndex = index;
  editingAddressValue = officeAddresses[index];
  renderAddressesList();
  setTimeout(() => {
    const input = document.getElementById(`editAddressInput_${index}`);
    if (input) {
      input.focus();
      input.select();
    }
  }, 10);
};

window.saveAddressRow = function (index) {
  const input = document.getElementById(`editAddressInput_${index}`);
  if (input) {
    const val = input.value.trim();
    if (val) {
      officeAddresses[index] = val;
    }
  }
  editingAddressIndex = -1;
  editingAddressValue = '';
  renderAddressesList();
};

window.cancelAddressRow = function () {
  editingAddressIndex = -1;
  editingAddressValue = '';
  renderAddressesList();
};

function addAddress() {
  const input = document.getElementById('sNewAddress');
  const addr = input.value.trim();
  if (!addr) return;

  officeAddresses.push(addr);
  input.value = '';
  renderAddressesList();
}

window.deleteAddress = async function (index) {
  const addr = officeAddresses[index];
  const confirmed = await UI.confirmDialog(
    `Are you sure you want to delete this office address?\n\n"${addr || ''}"`,
    'Confirm Deletion',
    'Delete',
    'btn-danger'
  );
  if (confirmed) {
    editingAddressIndex = -1;
    editingAddressValue = '';
    officeAddresses.splice(index, 1);
    renderAddressesList();
  }
};

/* ── Manage Subsidies ────────────────────────────────────────────────── */

function renderSubsidiesList() {
  const container = document.getElementById('sSubsidiesList');
  if (!container) return;

  if (subsidiesList.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-2 fs-8">No government subsidies defined.</div>`;
    return;
  }

  container.innerHTML = subsidiesList.map((sub, index) => {
    const isEditing = (editingSubsidyIndex === index);

    if (isEditing) {
      return `
        <div class="d-flex align-items-center gap-1 bg-light border border-primary rounded p-1 mb-1" style="font-size:0.75rem;">
          <input type="number" step="any" class="form-control form-control-sm p-1 text-center bg-white" id="editSubKW_${index}" value="${editingSubsidyKW}" placeholder="KW" style="width: 60px;">
          <input type="number" class="form-control form-control-sm p-1 text-end bg-white" id="editSubState_${index}" value="${editingSubsidyState}" placeholder="State ₹" style="width: 90px;">
          <input type="number" class="form-control form-control-sm p-1 text-end bg-white" id="editSubCentral_${index}" value="${editingSubsidyCentral}" placeholder="Central ₹" style="width: 90px;">
          <button type="button" class="btn btn-xs btn-outline-success border-0 text-success p-1 ms-1" onclick="saveSubsidyRow(${index})" style="flex-shrink:0;">✔️</button>
          <button type="button" class="btn btn-xs btn-outline-secondary border-0 text-secondary p-1" onclick="cancelSubsidyRow()" style="flex-shrink:0;">❌</button>
        </div>
      `;
    } else {
      return `
        <div class="d-flex align-items-center justify-content-between bg-white border rounded p-1 mb-1" style="font-size:0.78rem;">
          <div class="text-start ps-2">
            <span class="badge bg-primary me-1">${sub.kw} KW</span>
            <span class="text-secondary small font-monospace">State: ₹${Number(sub.state).toLocaleString('en-IN')} | Central: ₹${Number(sub.central).toLocaleString('en-IN')}</span>
          </div>
          <div class="d-flex gap-1 align-items-center">
            <button type="button" class="btn btn-xs btn-outline-primary border-0 text-primary p-1" onclick="editSubsidyRow(${index})" title="Edit Subsidy">✏️</button>
            <button type="button" class="btn btn-xs btn-outline-danger border-0 text-danger p-1" onclick="deleteSubsidyRow(${index})" title="Delete Subsidy">🗑️</button>
          </div>
        </div>
      `;
    }
  }).join('');
}

window.editSubsidyRow = function(index) {
  editingSubsidyIndex = index;
  editingSubsidyKW = subsidiesList[index].kw;
  editingSubsidyState = subsidiesList[index].state;
  editingSubsidyCentral = subsidiesList[index].central;
  renderSubsidiesList();
};

window.saveSubsidyRow = function(index) {
  const inputKW = document.getElementById(`editSubKW_${index}`);
  const inputState = document.getElementById(`editSubState_${index}`);
  const inputCentral = document.getElementById(`editSubCentral_${index}`);

  if (inputKW && inputState && inputCentral) {
    const kw = inputKW.value.trim();
    const state = inputState.value.trim();
    const central = inputCentral.value.trim();

    if (kw && state && central) {
      subsidiesList[index] = {
        kw: Number(kw),
        state: Number(state),
        central: Number(central)
      };
    }
  }

  editingSubsidyIndex = -1;
  renderSubsidiesList();
};

window.cancelSubsidyRow = function() {
  editingSubsidyIndex = -1;
  renderSubsidiesList();
};

function addSubsidy() {
  const inputKW = document.getElementById('sSubsidyKW');
  const inputState = document.getElementById('sSubsidyState');
  const inputCentral = document.getElementById('sSubsidyCentral');

  const kw = inputKW.value.trim();
  const state = inputState.value.trim();
  const central = inputCentral.value.trim();

  if (!kw || !state || !central) {
    UI.toast('Please fill all subsidy fields.', 'warning');
    return;
  }

  subsidiesList.push({
    kw: Number(kw),
    state: Number(state),
    central: Number(central)
  });

  inputKW.value = '';
  inputState.value = '';
  inputCentral.value = '';

  renderSubsidiesList();
}

window.deleteSubsidyRow = async function(index) {
  const sub = subsidiesList[index];
  const msg = `Are you sure you want to delete the subsidy configuration for ${sub.kw} KW?`;
  const confirmed = await UI.confirmDialog(msg, 'Confirm Deletion', 'Delete', 'btn-danger');
  if (confirmed) {
    editingSubsidyIndex = -1;
    subsidiesList.splice(index, 1);
    renderSubsidiesList();
  }
};

/* ── Save / Save Settings form ───────────────────────────────────────── */

async function saveSettingsForm() {
  const companyName = document.getElementById('sCompanyName').value.trim();
  const companyEmail = document.getElementById('sCompanyEmail').value.trim();
  const companyPhone = document.getElementById('sCompanyPhone').value.trim();
  const companyGST = document.getElementById('sCompanyGST').value.trim();
  const defaultGST = document.getElementById('sDefaultGST').value;

  // New Profile values
  const bankAcHolder = document.getElementById('sBankAcHolder').value.trim();
  const bankName = document.getElementById('sBankName').value.trim();
  const bankAcNo = document.getElementById('sBankAcNo').value.trim();
  const bankBranchIFS = document.getElementById('sBankBranchIFS').value.trim();
  const upiId = document.getElementById('sUPIId').value.trim();
  const termsText = document.getElementById('sTerms').value.trim();

  UI.showLoading(true);
  try {
    const settings = DB.getAll('settings');
    const upsert = async (key, value) => {
      if (settings.some(s => s.Key === key)) {
        await DB.update('settings', s => s.Key === key, { Key: key, Value: value });
      } else {
        await DB.insert('settings', { Key: key, Value: value });
      }
    };

    await upsert('CompanyName', companyName);
    await upsert('CompanyEmail', companyEmail);
    await upsert('CompanyPhone', companyPhone);
    await upsert('CompanyGST', companyGST);
    await upsert('DefaultGST', defaultGST);

    // Save image base64
    await upsert('CompanyLogo', base64Logo);
    await upsert('CompanyStamp', base64Stamp);

    // Save addresses serialized as JSON
    await upsert('CompanyAddresses', JSON.stringify(officeAddresses));

    // Save bank details
    await upsert('BankAcHolder', bankAcHolder);
    await upsert('BankName', bankName);
    await upsert('BankAcNo', bankAcNo);
    await upsert('BankBranchIFS', bankBranchIFS);

    // Save UPI & Terms
    await upsert('CompanyUPI', upiId);
    await upsert('CompanyTerms', termsText);

    // Save Govt Subsidies list
    await upsert('GovtSubsidies', JSON.stringify(subsidiesList));

    UI.toast('Profile and settings saved successfully.', 'success');
  } catch (err) {
    UI.toast('Error saving settings: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}
