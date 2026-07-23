/* =========================================================================
   vendor-master.js
   ========================================================================= */

let vendorModal;
let authUsers = [];
let authRoles = [];

window.onDbReady = async function () {
  UI.renderSidebar('vendor-master.html');
  UI.renderTopbar('Vendor Master', 'Master list of all suppliers/vendors', `
    <button class="btn btn-outline-secondary" id="btnExport">⬇ Export Excel</button>
  `);
  vendorModal = new bootstrap.Modal(document.getElementById('vendorModal'));

  const addVendorRow = document.getElementById('btnAddVendorRow');
  if (addVendorRow) addVendorRow.addEventListener('click', () => openModal(null));

  document.getElementById('btnSaveVendor').addEventListener('click', saveVendor);
  document.getElementById('btnExport').addEventListener('click', () => {
    Utils.exportRowsToExcel(DB.getAll('vendors'), DB.HEADERS.vendors, 'Vendors_export.xlsx');
  });
  document.getElementById('fSearch').addEventListener('input', Utils.debounce(render, 200));

  // Load auth configuration (users and roles)
  try {
    const res = await fetch('/api/auth-config');
    if (res.ok) {
      const data = await res.json();
      authUsers = data.users || [];
      authRoles = data.roles || ['admin', 'superadmin', 'partner', 'associates', 'user'];
    }
  } catch (err) {
    console.error('Failed to load auth config:', err);
  }

  render();
};

function render() {
  const search = (document.getElementById('fSearch').value || '').toLowerCase();
  let vendors = DB.getAll('vendors');
  if (search) {
    vendors = vendors.filter(v => [v.VendorName, v.Phone, v.GSTIN].join(' ').toLowerCase().includes(search));
  }
  const tbody = document.querySelector('#vendorsTable tbody');
  if (!vendors.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No vendors found. Vendors are also auto-added whenever you use a new vendor name in a shipment.</td></tr>`;
    return;
  }

  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  const isPowerUser = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');

  tbody.innerHTML = vendors.map(v => {
    const userid = v.VendorName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const userAccount = authUsers.find(u => u.userid === userid || u.username.toLowerCase() === v.VendorName.toLowerCase());
    const selectedRole = userAccount ? userAccount.role : '';

    // Create dropdown select HTML
    let dropdownHtml = '';
    if (isPowerUser) {
      dropdownHtml = `
        <select class="form-select form-select-sm" style="font-size: 0.75rem; width: 130px; display: inline-block;" onchange='changeVendorRole(this, ${JSON.stringify(v)})'>
          <option value="">(No User)</option>
          ${authRoles.map(r => `<option value="${r}" ${r === selectedRole ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      `;
    } else {
      dropdownHtml = `
        <select class="form-select form-select-sm" style="font-size: 0.75rem; width: 130px; display: inline-block;" disabled>
          <option value="">(No User)</option>
          ${authRoles.map(r => `<option value="${r}" ${r === selectedRole ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      `;
    }

    return `
      <tr>
        <td class="fw-semibold">${v.VendorName}</td>
        <td>${v.Phone || '-'}</td>
        <td>${v.Email || '-'}</td>
        <td>${v.GSTIN || '-'}</td>
        <td>${v.Address || '-'}</td>
        <td class="no-print">
          <div class="d-flex gap-1 align-items-center">
            <button class="btn btn-sm btn-outline-secondary" onclick='openModal(${JSON.stringify(v.VendorName)})' title="Edit">✎</button>
            <button class="btn btn-sm btn-outline-danger" onclick='deleteVendor(${JSON.stringify(v.VendorName)})' title="Delete">🗑</button>
            ${dropdownHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openModal = function (vendorName) {
  document.getElementById('vendorModalTitle').textContent = vendorName ? 'Edit Vendor' : 'New Vendor';
  document.getElementById('mOrigName').value = vendorName || '';
  if (vendorName) {
    const v = DB.getAll('vendors').find(x => x.VendorName === vendorName);
    document.getElementById('mVendorName').value = v.VendorName || '';
    document.getElementById('mAddress').value = v.Address || '';
    document.getElementById('mPhone').value = v.Phone || '';
    document.getElementById('mGSTIN').value = v.GSTIN || '';
    document.getElementById('mEmail').value = v.Email || '';
    document.getElementById('mRemarks').value = v.Remarks || '';
  } else {
    ['mVendorName', 'mAddress', 'mPhone', 'mGSTIN', 'mEmail', 'mRemarks'].forEach(id => document.getElementById(id).value = '');
  }
  vendorModal.show();
};

async function saveVendor() {
  const origName = document.getElementById('mOrigName').value;
  const row = {
    VendorName: document.getElementById('mVendorName').value.trim(),
    Address: document.getElementById('mAddress').value.trim(),
    Phone: document.getElementById('mPhone').value.trim(),
    GSTIN: document.getElementById('mGSTIN').value.trim(),
    Email: document.getElementById('mEmail').value.trim(),
    Remarks: document.getElementById('mRemarks').value.trim(),
  };
  const errors = Validate.run([
    [Validate.required, row.VendorName, 'Vendor Name'],
    [Validate.mobile, row.Phone, 'Phone'],
    [Validate.email, row.Email, 'Email'],
  ]);
  if (errors.length) { UI.toast(errors[0], 'danger'); return; }

  UI.showLoading(true);
  if (origName) {
    await DB.update('vendors', v => v.VendorName === origName, row);
  } else {
    const vendors = DB.getAll('vendors');
    if (vendors.some(v => v.VendorName === row.VendorName)) {
      UI.showLoading(false);
      UI.toast('A vendor with this name already exists.', 'danger');
      return;
    }
    await DB.insert('vendors', row);
  }
  UI.showLoading(false);
  vendorModal.hide();
  UI.toast('Vendor saved.', 'success');
  render();
}

window.deleteVendor = async function (vendorName) {
  const ok = await UI.confirmDialog(`Delete vendor "${vendorName}" from the master list? Existing shipment records are not affected.`, 'Delete Vendor');
  if (!ok) return;
  UI.showLoading(true);
  await DB.remove('vendors', v => v.VendorName === vendorName);
  UI.showLoading(false);
  UI.toast('Vendor deleted.', 'warning');
  render();
};

window.changeVendorRole = async function (selectEl, v) {
  const newRole = selectEl.value;
  const userid = v.VendorName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!userid) {
    UI.toast('Invalid vendor name for creating a user account.', 'danger');
    selectEl.value = '';
    return;
  }

  const existingIndex = authUsers.findIndex(u => u.userid === userid || u.username.toLowerCase() === v.VendorName.toLowerCase());

  if (!newRole) {
    // Delete user account
    if (existingIndex === -1) return;
    const ok = await UI.confirmDialog(`Are you sure you want to delete the user account for "${v.VendorName}"?`, 'Delete User Account', 'Delete', 'btn-danger');
    if (!ok) {
      // Revert selection
      const userAccount = authUsers[existingIndex];
      selectEl.value = userAccount.role;
      return;
    }

    UI.showLoading(true);
    try {
      authUsers.splice(existingIndex, 1);
      const res = await fetch('/api/auth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: authUsers, roles: authRoles })
      });
      if (!res.ok) throw new Error('Failed to save updated auth config.');
      UI.toast(`User account for "${v.VendorName}" deleted.`, 'warning');
    } catch (err) {
      UI.toast('Error deleting user: ' + err.message, 'danger');
      const resLoad = await fetch('/api/auth-config');
      if (resLoad.ok) {
        const data = await resLoad.json();
        authUsers = data.users || [];
      }
      render();
    } finally {
      UI.showLoading(false);
    }
  } else {
    // Create or update role
    if (existingIndex > -1) {
      // Update role
      UI.showLoading(true);
      try {
        authUsers[existingIndex].role = newRole;
        const res = await fetch('/api/auth-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: authUsers, roles: authRoles })
        });
        if (!res.ok) throw new Error('Failed to save updated auth config.');
        UI.toast(`User role updated to "${newRole}".`, 'success');
      } catch (err) {
        UI.toast('Error updating role: ' + err.message, 'danger');
        const resLoad = await fetch('/api/auth-config');
        if (resLoad.ok) {
          const data = await resLoad.json();
          authUsers = data.users || [];
        }
        render();
      } finally {
        UI.showLoading(false);
      }
    } else {
      // Create new user account
      const password = prompt(`Enter password to create a user account for "${v.VendorName}" (UserID: ${userid}):`, 'vendor123');
      if (password === null) {
        selectEl.value = '';
        return;
      }
      if (!password.trim()) {
        UI.toast('Password is required.', 'danger');
        selectEl.value = '';
        return;
      }

      UI.showLoading(true);
      try {
        authUsers.push({
          userid: userid,
          username: v.VendorName,
          email: v.Email || `${userid}@example.com`,
          password: password.trim(),
          role: newRole,
          status: 'Approved' // auto-approved since admin created it
        });

        const res = await fetch('/api/auth-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: authUsers, roles: authRoles })
        });
        if (!res.ok) throw new Error('Failed to save updated auth config.');
        UI.toast(`User account created successfully with role "${newRole}"!`, 'success');
      } catch (err) {
        UI.toast('Error creating user account: ' + err.message, 'danger');
        authUsers.pop();
        selectEl.value = '';
      } finally {
        UI.showLoading(false);
      }
    }
  }
};
