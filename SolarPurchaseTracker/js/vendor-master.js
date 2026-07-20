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
        <button class="btn btn-sm btn-outline-secondary" onclick='openModal(${JSON.stringify(v.VendorName)})'>✎</button>
        <button class="btn btn-sm btn-outline-danger" onclick='deleteVendor(${JSON.stringify(v.VendorName)})'>🗑</button>
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
