/* =========================================================================
   vendor-master.js
   ========================================================================= */

let vendorModal;

window.onDbReady = function () {
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
  tbody.innerHTML = vendors.map(v => `
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
          <button class="btn btn-sm btn-outline-primary py-0.5 px-2" onclick='makePartner(${JSON.stringify(v)})' style="font-size: 0.7rem;" title="Make as Partner user">👤 Partner</button>
        </div>
      </td>
    </tr>
  `).join('');
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

window.makePartner = async function (v) {
  const userid = v.VendorName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!userid) {
    UI.toast('Invalid vendor name for creating a user account.', 'danger');
    return;
  }

  UI.showLoading(true);
  try {
    const res = await fetch('/api/auth-config');
    if (!res.ok) throw new Error('Failed to fetch auth configuration.');
    const data = await res.json();
    const users = data.users || [];
    const roles = data.roles || ['admin', 'superadmin', 'partner', 'user'];

    const existingUser = users.find(u => u.userid === userid);
    if (existingUser) {
      UI.showLoading(false);
      UI.toast(`User "${userid}" already exists as role: ${existingUser.role}.`, 'info');
      return;
    }

    UI.showLoading(false);
    const password = prompt(`Enter password for Partner user "${v.VendorName}" (UserID: ${userid}):`, 'partner123');
    if (password === null) return;
    if (!password.trim()) {
      UI.toast('Password is required.', 'danger');
      return;
    }

    if (!roles.includes('partner')) roles.push('partner');
    if (!roles.includes('superadmin')) roles.push('superadmin');

    users.push({
      userid: userid,
      username: v.VendorName,
      password: password.trim(),
      role: 'partner'
    });

    UI.showLoading(true);
    const saveRes = await fetch('/api/auth-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, roles })
    });
    if (!saveRes.ok) throw new Error('Failed to save updated auth configuration.');

    UI.toast(`Partner user "${v.VendorName}" created successfully!`, 'success');
  } catch (err) {
    UI.toast('Error creating partner user: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};
