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

// User & Role Management variables
let _userModal = null;
let _rolesModal = null;
let _usersList = [];
let _rolesList = [];

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

  // User & Role Management setup
  _userModal = new bootstrap.Modal(document.getElementById('userModal'), { keyboard: true });
  _rolesModal = new bootstrap.Modal(document.getElementById('rolesModal'), { keyboard: true });

  document.getElementById('btnAddNewUser').addEventListener('click', openAddUserModal);
  document.getElementById('btnManageRolesModal').addEventListener('click', () => _rolesModal.show());
  document.getElementById('btnSaveUserModal').addEventListener('click', saveUserFromModal);
  document.getElementById('btnAddRole').addEventListener('click', addNewRole);

  // Bind role list modal shown event to render the roles list
  document.getElementById('rolesModal').addEventListener('shown.bs.modal', renderRolesList);

  loadAuthSettings();
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
  document.getElementById('sBankAcHolder').value = get('BankAcHolder', 'Company Name');
  document.getElementById('sBankName').value = get('BankName', 'ICICI BANK LTD');
  document.getElementById('sBankAcNo').value = get('BankAcNo', '123456789123');
  document.getElementById('sBankBranchIFS').value = get('BankBranchIFS', 'Branch & IFS Code');

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

/* ── User & Role Management Helpers ──────────────────────────────────── */

async function loadAuthSettings() {
  try {
    const res = await fetch('/api/auth-config');
    if (!res.ok) throw new Error('Failed to load user and role configurations.');
    const data = await res.json();
    _usersList = data.users || [];
    _rolesList = data.roles || ['admin', 'user'];
    
    renderUsersList();
    populateRoleSelect();
  } catch (e) {
    UI.toast(e.message, 'danger');
  }
}

function renderUsersList() {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;
  
  if (_usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No users found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = _usersList.map(u => {
    const isCurrentAdmin = (u.userid === 'admin');
    const emailStr = u.email || '';
    const statusVal = u.status || 'Approved';
    
    let statusBadge = '';
    if (statusVal === 'Approved') {
      statusBadge = `<span class="badge bg-success">Approved</span>`;
    } else if (statusVal === 'Pending') {
      statusBadge = `<span class="badge bg-warning text-dark">Pending</span>`;
    } else {
      statusBadge = `<span class="badge bg-danger">Rejected</span>`;
    }

    const quickActions = (statusVal === 'Pending') ? `
      <button type="button" class="btn btn-xs btn-success text-white px-2 py-0.5" onclick="quickResolveUser('${u.userid}', 'approve')" title="Approve User">Approve</button>
      <button type="button" class="btn btn-xs btn-danger text-white px-2 py-0.5 ms-1" onclick="quickResolveUser('${u.userid}', 'reject')" title="Reject User">Reject</button>
    ` : '';
    
    return `
      <tr>
        <td class="font-monospace">${u.userid}</td>
        <td>${u.username}</td>
        <td>${emailStr}</td>
        <td class="font-monospace">${u.password}</td>
        <td><span class="badge ${u.role === 'admin' ? 'bg-primary' : 'bg-success'}">${u.role}</span></td>
        <td>${statusBadge}</td>
        <td class="text-center">
          ${quickActions}
          <button type="button" class="btn btn-xs btn-outline-primary px-2 py-0.5 ${statusVal === 'Pending' ? 'ms-1' : ''}" onclick="openEditUserModal('${u.userid}')">✏️ Edit</button>
          ${isCurrentAdmin ? '' : `<button type="button" class="btn btn-xs btn-outline-danger px-2 py-0.5 ms-1" onclick="deleteUser('${u.userid}')">🗑️ Delete</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

window.quickResolveUser = async function(userid, action) {
  const confirmed = await UI.confirmDialog(
    `Are you sure you want to ${action} user "${userid}"?`,
    'Confirm Action',
    action === 'approve' ? 'Approve' : 'Reject',
    action === 'approve' ? 'btn-success' : 'btn-danger'
  );
  if (!confirmed) return;

  UI.showLoading(true);
  try {
    const resNotif = await fetch('/api/notifications');
    if (resNotif.ok) {
      const notifData = await resNotif.json();
      const notif = (notifData.notifications || []).find(n => n.user_id.toLowerCase() === userid.toLowerCase() && n.status === 'unread');
      if (notif) {
        await fetch('/api/notifications/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id, action })
        });
      } else {
        const u = _usersList.find(user => user.userid.toLowerCase() === userid.toLowerCase());
        if (u) {
          u.status = action === 'approve' ? 'Approved' : 'Rejected';
          await saveAuthSettings();
        }
      }
    }
    UI.toast(`User "${userid}" has been ${action}d.`, 'success');
    loadAuthSettings();
  } catch (e) {
    UI.toast(e.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

function renderRolesList() {
  const container = document.getElementById('rolesListGroup');
  if (!container) return;
  
  container.innerHTML = _rolesList.map(r => {
    const isDefault = (r === 'admin' || r === 'user');
    return `
      <div class="list-group-item d-flex align-items-center justify-content-between p-2">
        <span class="font-monospace fw-semibold">${r}</span>
        ${isDefault ? '<span class="badge bg-secondary">System Default</span>' : `
          <button type="button" class="btn btn-xs btn-outline-danger border-0 p-1" onclick="deleteRole('${r}')" title="Delete Role">🗑️</button>
        `}
      </div>
    `;
  }).join('');
}

function populateRoleSelect() {
  const select = document.getElementById('userModalRole');
  if (!select) return;
  select.innerHTML = _rolesList.map(r => `<option value="${r}">${r}</option>`).join('');
}

function openAddUserModal() {
  document.getElementById('userForm').reset();
  document.getElementById('userModalTitle').textContent = 'Add New User';
  document.getElementById('userModalMode').value = 'add';
  document.getElementById('userModalOrigId').value = '';
  document.getElementById('userModalId').disabled = false;
  document.getElementById('userModalStatus').value = 'Approved';
  populateRoleSelect();
  _userModal.show();
}

window.openEditUserModal = function(userid) {
  const user = _usersList.find(u => u.userid === userid);
  if (!user) return;
  
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userModalMode').value = 'edit';
  document.getElementById('userModalOrigId').value = userid;
  
  const idInput = document.getElementById('userModalId');
  idInput.value = user.userid;
  idInput.disabled = (userid === 'admin');
  
  document.getElementById('userModalName').value = user.username;
  document.getElementById('userModalEmail').value = user.email || '';
  document.getElementById('userModalPassword').value = user.password;
  
  populateRoleSelect();
  document.getElementById('userModalRole').value = user.role;
  document.getElementById('userModalStatus').value = user.status || 'Approved';
  
  _userModal.show();
};

window.deleteUser = async function(userid) {
  if (userid === 'admin') {
    UI.toast('Cannot delete default admin user.', 'warning');
    return;
  }
  
  const confirmed = await UI.confirmDialog(
    `Are you sure you want to delete user "${userid}"?`,
    'Confirm Deletion',
    'Delete',
    'btn-danger'
  );
  if (!confirmed) return;
  
  _usersList = _usersList.filter(u => u.userid !== userid);
  await saveAuthSettings();
};

async function saveUserFromModal() {
  const mode = document.getElementById('userModalMode').value;
  const origId = document.getElementById('userModalOrigId').value;
  const id = document.getElementById('userModalId').value.trim().toLowerCase();
  const name = document.getElementById('userModalName').value.trim();
  const email = document.getElementById('userModalEmail').value.trim().toLowerCase();
  const password = document.getElementById('userModalPassword').value;
  const role = document.getElementById('userModalRole').value;
  const status = document.getElementById('userModalStatus').value || 'Approved';
  
  if (!id || !name || !email || !password || !role) {
    UI.toast('Please fill all user fields.', 'warning');
    return;
  }
  
  if (!/^[a-z0-9_-]+$/.test(id)) {
    UI.toast('User ID must be lowercase alphanumeric, underscore, or hyphen only.', 'warning');
    return;
  }
  
  if (mode === 'add') {
    if (_usersList.some(u => u.userid === id)) {
      UI.toast(`User ID "${id}" is already in use.`, 'warning');
      return;
    }
    if (_usersList.some(u => u.email && u.email.toLowerCase() === email)) {
      UI.toast(`Email "${email}" is already in use.`, 'warning');
      return;
    }
    _usersList.push({ userid: id, username: name, email, password, role, status });
  } else {
    const userIndex = _usersList.findIndex(u => u.userid === origId);
    if (userIndex === -1) {
      UI.toast('User not found.', 'danger');
      return;
    }
    if (origId !== id && _usersList.some(u => u.userid === id)) {
      UI.toast(`User ID "${id}" is already in use.`, 'warning');
      return;
    }
    if (_usersList.some(u => u.userid !== origId && u.email && u.email.toLowerCase() === email)) {
      UI.toast(`Email "${email}" is already in use.`, 'warning');
      return;
    }
    _usersList[userIndex] = { userid: id, username: name, email, password, role, status };
  }
  
  await saveAuthSettings();
  _userModal.hide();
}

async function addNewRole() {
  const input = document.getElementById('newRoleInput');
  const roleName = input.value.trim().toLowerCase();
  
  if (!roleName) return;
  
  if (!/^[a-z0-9_-]+$/.test(roleName)) {
    UI.toast('Role name must be lowercase alphanumeric, underscore, or hyphen only.', 'warning');
    return;
  }
  
  if (_rolesList.includes(roleName)) {
    UI.toast(`Role "${roleName}" already exists.`, 'warning');
    return;
  }
  
  _rolesList.push(roleName);
  input.value = '';
  
  await saveAuthSettings();
  renderRolesList();
  populateRoleSelect();
}

window.deleteRole = async function(roleName) {
  if (roleName === 'admin' || roleName === 'user') {
    UI.toast('Cannot delete default system roles.', 'warning');
    return;
  }
  
  // Check if any user is currently assigned this role
  const isUsed = _usersList.some(u => u.role === roleName);
  if (isUsed) {
    UI.toast(`Cannot delete role "${roleName}". It is assigned to one or more users.`, 'warning');
    return;
  }
  
  const confirmed = await UI.confirmDialog(
    `Are you sure you want to delete the role "${roleName}"?`,
    'Confirm Deletion',
    'Delete',
    'btn-danger'
  );
  if (!confirmed) return;
  
  _rolesList = _rolesList.filter(r => r !== roleName);
  await saveAuthSettings();
  renderRolesList();
  populateRoleSelect();
};

async function saveAuthSettings() {
  UI.showLoading(true);
  try {
    const res = await fetch('/api/auth-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: _usersList, roles: _rolesList })
    });
    if (!res.ok) throw new Error('Failed to save authentication configuration.');
    
    UI.toast('User configurations saved.', 'success');
    renderUsersList();
  } catch (e) {
    UI.toast(e.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}
