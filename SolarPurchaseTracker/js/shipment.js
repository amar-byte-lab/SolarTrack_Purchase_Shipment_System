/* =========================================================================
   shipment.js — Inline Shipment Tracker controller
   ========================================================================= */

let editingShipmentNo = null;
let isAddingNew = false;
let pendingFiles = [];
let currentDocs = [];

let sortCol = 'PurchaseDate';
let sortDir = 'desc';

let selectedColorCols = [];
const COLORABLE_COLS = [
  { key: 'col-date',    label: 'Date',        default: '#ffffff' },
  { key: 'col-type',    label: 'Type',        default: '#ffffff' },
  { key: 'col-vendor',  label: 'Vendor',      default: '#ffffff' },
  { key: 'col-qty',     label: 'Item (Qty)',  default: '#ffffff' },
  { key: 'col-total',   label: 'Grand Total', default: '#ffffff' },
];
const LS_KEY = 'shipColColors';

window.onDbReady = function () {
  UI.renderSidebar('shipment.html');
  UI.renderTopbar('Shipments', 'All purchase shipments and their cost breakdown', `
    <button class="btn btn-outline-secondary" id="btnPrintList">🖨 Print</button>
  `);

  document.getElementById('btnPrintList').addEventListener('click', () => window.print());

  // Filters
  ['fSearch', 'fFrom', 'fTo', 'fVendor'].forEach(id => {
    document.getElementById(id).addEventListener('input', Utils.debounce(renderList, 200));
    document.getElementById(id).addEventListener('change', renderList);
  });
  const chkDel = document.getElementById('chkShowDeleted');
  if (chkDel) chkDel.addEventListener('change', renderList);

  document.getElementById('btnClearFilters').addEventListener('click', () => {
    ['fSearch', 'fFrom', 'fTo', 'fVendor'].forEach(id => document.getElementById(id).value = '');
    if (chkDel) chkDel.checked = false;
    renderList();
  });

  // Sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      updateSortHeadersUI();
      renderList();
    });
  });

  // Color picker
  document.getElementById('ccColorPicker').addEventListener('input', e => {
    if (selectedColorCols.length === 0) { UI.toast('Please check at least one column first.', 'warning'); return; }
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    selectedColorCols.forEach(k => { saved[k] = e.target.value; });
    localStorage.setItem(LS_KEY, JSON.stringify(saved));
    applyCustomStyles();
  });

  document.getElementById('btnResetColors').addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    applyCustomStyles();
    updateColorPickerValue();
    UI.toast('Column colors reset', 'info');
  });

  const collapseEl = document.getElementById('searchCollapse');
  if (collapseEl) {
    collapseEl.addEventListener('shown.bs.collapse', () => {
      document.getElementById('searchCollapseIndicator').textContent = '▲ Hide';
    });
    collapseEl.addEventListener('hidden.bs.collapse', () => {
      document.getElementById('searchCollapseIndicator').textContent = '▼ Show';
    });
  }

  populateDatalists();
  populateColorCheckboxes();
  applyCustomStyles();
  updateSortHeadersUI();
  renderList();

  // Add Shipment Note button listener
  document.getElementById('btnSaveShipNote').addEventListener('click', async () => {
    const shipmentNo = document.getElementById('shipNoteNo').value;
    const remarkText = document.getElementById('newShipNoteText').value.trim();

    if (!remarkText) {
      UI.toast('Please enter note text.', 'danger');
      return;
    }

    UI.showLoading(true);
    try {
      const note = {
        RemarkID: Utils.uid('RMK'),
        ShipmentNo: shipmentNo,
        Remark: remarkText,
        CreatedAt: new Date().toISOString()
      };
      await DB.insert('shipment_remarks', note);
      
      // Reset input
      document.getElementById('newShipNoteText').value = '';

      UI.toast('Note saved successfully.', 'success');
      showShipmentNotes(shipmentNo);
      renderList();
    } catch (err) {
      UI.toast('Error saving note: ' + err.message, 'danger');
    } finally {
      UI.showLoading(false);
    }
  });

  if (Utils.getQueryParam('openNew') === '1') addInlineRow();
};

function populateDatalists() {
  const vendors = DB.getAll('vendors');
  const items = DB.getAll('items');

  document.getElementById('vendorList').innerHTML = vendors.map(v => `<option value="${v.VendorName}">`).join('');
  document.getElementById('itemList').innerHTML = items.map(i => `<option value="${i.ItemName}">`).join('');

  const vendorFilter = document.getElementById('fVendor');
  vendorFilter.innerHTML = '<option value="">All Vendors</option>' +
    vendors.map(v => `<option value="${v.VendorName}">${v.VendorName}</option>`).join('');
}

function getEnrichedShipments(includeDeleted = false) {
  let shipments = DB.getAll('shipments');
  if (!includeDeleted) {
    shipments = shipments.filter(s => s.Status !== 'Deleted' && s.IsDeleted !== '1' && s.IsDeleted !== true);
  }
  const materials = DB.getAll('materials');
  return shipments.map(s => {
    // Normalize null/undefined API fields to proper numbers
    const s2 = {
      ...s,
      VendorPaid:         Number(s.VendorPaid)         || 0,
      TransportPaid:      Number(s.TransportPaid)      || 0,
      TransportationCost: Number(s.TransportationCost) || 0,
      GSTPercentage:      Number(s.GSTPercentage)      || 0,
    };
    const mats = materials.filter(m => m.ShipmentNo === s2.ShipmentNo);
    const result = Calc.computeShipment(mats, s2.TransportationCost, s2.GSTPercentage);
    return { ...s2, ...result };
  });
}

function fmtPaymentField(total, paid) {
  // Only show the paid deduction badge when there is an actual paid amount
  if (!paid || paid <= 0) return UI.money(total);
  return `${UI.money(total)} <span class="text-danger fs-7">(-${UI.money(paid)})</span>`;
}

function renderUploadedDocsList() {
  const container = document.getElementById('editUploadedDocsList');
  if (!container) return;
  container.innerHTML = '';
  
  if (currentDocs.length === 0 && pendingFiles.length === 0) {
    container.innerHTML = '<span class="text-muted fs-7">No documents.</span>';
    return;
  }
  
  // Render saved documents
  currentDocs.forEach(name => {
    const div = document.createElement('div');
    div.className = 'badge bg-secondary d-flex align-items-center gap-2 p-1 fs-7';
    div.innerHTML = `
      <span class="text-white" style="cursor:pointer;" onclick="downloadDoc('${name}')">📄 ${name}</span>
      <span class="text-danger" style="cursor:pointer; font-weight:bold; font-size: 0.85rem;" onclick="removeSavedDoc('${name}')">✕</span>
    `;
    container.appendChild(div);
  });
  
  // Render pending documents
  pendingFiles.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'badge bg-info d-flex align-items-center gap-2 p-1 fs-7';
    div.innerHTML = `
      <span class="text-white">⏳ ${file.name}</span>
      <span class="text-danger" style="cursor:pointer; font-weight:bold; font-size: 0.85rem;" onclick="removePendingDoc(${index})">✕</span>
    `;
    container.appendChild(div);
  });
}

window.downloadDoc = function(fileName) {
  DB.downloadDocumentFile(editingShipmentNo, fileName);
};

window.removeSavedDoc = function(fileName) {
  currentDocs = currentDocs.filter(n => n !== fileName);
  renderUploadedDocsList();
};

window.removePendingDoc = function(idx) {
  pendingFiles.splice(idx, 1);
  renderUploadedDocsList();
};

function renderList() {
  const search = (document.getElementById('fSearch').value || '').toLowerCase();
  const from = document.getElementById('fFrom').value;
  const to = document.getElementById('fTo').value;
  const vendor = document.getElementById('fVendor').value;
  const chkDel = document.getElementById('chkShowDeleted');
  const showDeleted = chkDel ? chkDel.checked : false;

  let rows = getEnrichedShipments(showDeleted);

  if (search) {
    rows = rows.filter(r =>
      String(r.ShipmentNo).toLowerCase().includes(search) ||
      String(r.VendorName).toLowerCase().includes(search) ||
      String(r.InvoiceNumber).toLowerCase().includes(search) ||
      String(r.VehicleNumber).toLowerCase().includes(search) ||
      String(r.ShipmentType || '').toLowerCase().includes(search) ||
      r.lines.some(l => String(l.ItemName).toLowerCase().includes(search))
    );
  }
  if (from) rows = rows.filter(r => r.PurchaseDate && new Date(r.PurchaseDate) >= new Date(from));
  if (to) rows = rows.filter(r => r.PurchaseDate && new Date(r.PurchaseDate) <= new Date(to));
  if (vendor) rows = rows.filter(r => r.VendorName === vendor);

  // Dynamic sorting
  rows.sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (sortCol === 'PurchaseDate') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = String(bVal).toLowerCase();
    } else {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.querySelector('#shipTable tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-center text-muted py-4">No shipments match your filters.</td></tr>`;
    const tfoot = document.querySelector('#shipTable tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="add-row-sticky no-print" onclick="addInlineRow()" style="cursor:pointer; height:37px;">
          <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
          <td colspan="5" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new shipment record...</td>
        </tr>
      `;
    }
    return;
  }

  let sumVendorDue = 0;
  let sumVendorPaid = 0;
  let sumTransportCost = 0;
  let sumTransportPaid = 0;
  let sumGrandTotal = 0;

  const html = [];
  rows.forEach(r => {
    const isDeleted = r.Status === 'Deleted' || r.IsDeleted === '1' || r.IsDeleted === true;
    const shipmentType = r.ShipmentType || 'Buy';
    
    const vendorDue = r.purchaseTotal + r.gstAmount;
    const vendorPaid = Number(r.VendorPaid) || 0;
    const transportCost = r.transport;
    const transportPaid = Number(r.TransportPaid) || 0;
    const grandTotal = r.grandTotal;

    if (!isDeleted) {
      sumVendorDue += vendorDue;
      sumVendorPaid += vendorPaid;
      sumTransportCost += transportCost;
      sumTransportPaid += transportPaid;
      sumGrandTotal += grandTotal;
    }

    const isSell = shipmentType === 'Sell';
    const vendorRemaining = vendorDue - vendorPaid;
    let vendorBtnClass = 'btn-outline-success';
    let vendorBtnText = isSell ? `Received: ${UI.money(vendorPaid)}` : `Paid: ${UI.money(vendorPaid)}`;
    if (vendorRemaining > 0) {
      vendorBtnClass = vendorPaid > 0 ? 'btn-outline-warning' : 'btn-outline-danger';
    } else if (vendorRemaining < 0) {
      vendorBtnClass = 'btn-outline-primary';
    }

    const transportRemaining = transportCost - transportPaid;
    let transportBtnClass = 'btn-outline-success';
    let transportBtnText = `Paid: ${UI.money(transportPaid)}`;
    if (transportRemaining > 0) {
      transportBtnClass = transportPaid > 0 ? 'btn-outline-warning' : 'btn-outline-danger';
    } else if (transportRemaining < 0) {
      transportBtnClass = 'btn-outline-primary';
    }

    // Normal display row
    const typeBadge = shipmentType === 'Buy'
      ? `<span class="badge bg-success-subtle text-success fs-7 border border-success-subtle">Buy</span>`
      : `<span class="badge bg-primary-subtle text-primary fs-7 border border-primary-subtle">Sell</span>`;

    const statusBadge = isDeleted ? `<span class="badge bg-danger ms-1">Deleted</span>` : '';

    const docNames = r.Documents ? r.Documents.split(',').filter(Boolean) : [];
    const docsButton = docNames.length
      ? `<button class="btn btn-xs btn-outline-primary ms-2 py-0 px-2 font-monospace" onclick="showDocsModal('${r.ShipmentNo}')" style="font-size:0.68rem;">📄 Docs (${docNames.length})</button>`
      : '';

    const remarks = DB.getAll('shipment_remarks').filter(n => n.ShipmentNo === r.ShipmentNo);
    const remarksCount = remarks.length;
    const notesButton = `
      <button type="button" class="btn p-0 border-0 bg-transparent btn-note position-relative ms-2" onclick="showShipmentNotes('${r.ShipmentNo}')" title="Shipment Notes (${remarksCount} added)" style="font-size: 0.95rem; line-height: 1; vertical-align: middle;">
        📝
        ${remarksCount > 0 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.55rem; padding: 2px 4px; border: 1px solid #fff;">${remarksCount}</span>` : ''}
      </button>
    `;

    const rowStyle = isDeleted ? `style="background-color: #f8d7da !important; opacity: 0.75;"` : '';

    const actionButtons = isDeleted
      ? `<button class="btn btn-xs btn-outline-success font-monospace" onclick="restoreShipment('${r.ShipmentNo}')" title="Restore Shipment">↺ Restore</button>`
      : `
        <button class="btn btn-sm btn-outline-secondary" onclick="editRow('${r.ShipmentNo}')" title="Edit">✎</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteShipment('${r.ShipmentNo}')" title="Soft Delete">🗑</button>
      `;

    html.push(`
      <tr ${rowStyle}>
        <td class="col-date">${UI.fmtDate(r.PurchaseDate)}</td>
        <td class="col-type text-center">${typeBadge}${statusBadge}</td>
        <td class="col-vendor">
          <div class="d-flex align-items-center flex-wrap gap-1">
            <span>${r.VendorName || '-'}</span>
            ${docsButton}
            ${notesButton}
          </div>
        </td>
        <td class="col-qty" style="font-size:0.82rem; white-space:normal; min-width:180px;">
          ${r.lines.map(l => {
            const unitSuffix = l.Unit ? ' ' + l.Unit.trim() : '';
            return `<strong>${l.ItemName}</strong> (${l.Quantity}${unitSuffix})`;
          }).join(', ') || '<span class="text-muted">—</span>'}
        </td>
        <td class="col-total text-end fw-bold font-monospace">
          <div class="d-flex flex-column align-items-end" style="gap:2px;">
            <span>${UI.money(grandTotal)}</span>
            <div class="d-flex gap-1 mt-1 no-print">
              <button class="btn btn-xs ${vendorBtnClass} font-monospace" onclick="showVendorPaymentDetails('${r.ShipmentNo}')" style="font-size:0.68rem; padding:1px 4px;">${vendorBtnText}</button>
              <button class="btn btn-xs ${transportBtnClass} font-monospace" onclick="showTransportPaymentDetails('${r.ShipmentNo}')" style="font-size:0.68rem; padding:1px 4px;">${transportBtnText}</button>
            </div>
          </div>
        </td>
        <td class="no-print text-center">
          <div class="d-flex gap-1 justify-content-center">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = html.join('');

  // Set tfoot Grand Total and Sticky Add Row
  const tfoot = document.querySelector('#shipTable tfoot');
  if (tfoot) {
    let tfootHTML = '';
    
    // 1. Sticky Add Row (always visible in table!)
    tfootHTML += `
      <tr class="add-row-sticky no-print" onclick="addInlineRow()" style="cursor:pointer; height:37px;">
        <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
        <td colspan="5" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new shipment record...</td>
      </tr>
    `;
    
    const totalVendorRemaining = sumVendorDue - sumVendorPaid;
    let totalVendorBtnClass = 'btn-outline-success';
    let totalVendorBtnText = `Vendor Paid: ${UI.money(sumVendorPaid)}`;
    if (totalVendorRemaining > 0) {
      totalVendorBtnClass = sumVendorPaid > 0 ? 'btn-outline-warning' : 'btn-outline-danger';
    } else if (totalVendorRemaining < 0) {
      totalVendorBtnClass = 'btn-outline-primary';
    }

    const totalTransportRemaining = sumTransportCost - sumTransportPaid;
    let totalTransportBtnClass = 'btn-outline-success';
    let totalTransportBtnText = `Transport Paid: ${UI.money(sumTransportPaid)}`;
    if (totalTransportRemaining > 0) {
      totalTransportBtnClass = sumTransportPaid > 0 ? 'btn-outline-warning' : 'btn-outline-danger';
    } else if (totalTransportRemaining < 0) {
      totalTransportBtnClass = 'btn-outline-primary';
    }

    // 2. Grand Total Row
    tfootHTML += `
      <tr class="grand-total" style="height:37px;">
        <td colspan="4">GRAND TOTAL</td>
        <td class="text-end fw-bold font-monospace">
          <div class="d-flex flex-column align-items-end" style="gap:2px;">
            <span>${UI.money(sumGrandTotal)}</span>
            <div class="d-flex gap-1 mt-1 no-print">
              <button class="btn btn-xs ${totalVendorBtnClass} font-monospace" onclick="showVendorPaymentDetails('TOTAL')" style="font-size:0.68rem; padding:1px 4px;">${totalVendorBtnText}</button>
              <button class="btn btn-xs ${totalTransportBtnClass} font-monospace" onclick="showTransportPaymentDetails('TOTAL')" style="font-size:0.68rem; padding:1px 4px;">${totalTransportBtnText}</button>
            </div>
          </div>
        </td>
        <td class="no-print"></td>
      </tr>
    `;
    tfoot.innerHTML = tfootHTML;

    // Adjust sticky bottom of add-row-sticky row based on grand-total row height
    setTimeout(() => {
      const grandTotalRow = tfoot.querySelector('tr.grand-total');
      const addRowSticky = tfoot.querySelector('tr.add-row-sticky');
      if (grandTotalRow && addRowSticky) {
        const grandTotalHeight = grandTotalRow.offsetHeight;
        const tds = addRowSticky.querySelectorAll('td');
        tds.forEach(td => {
          td.style.bottom = grandTotalHeight + 'px';
        });
      }
    }, 50);
  }
}

function updateStickyHeaderOffsets() {
  setTimeout(() => {
    const headerRow = document.querySelector('#shipTable thead tr:first-child');
    const addRow = document.querySelector('#shipTable thead tr.add-row-top-sticky');
    if (headerRow && addRow) {
      const headerHeight = headerRow.offsetHeight || 37;
      const tds = addRow.querySelectorAll('td, th');
      tds.forEach(td => {
        td.style.top = headerHeight + 'px';
      });
    }
  }, 10);
}

function toDateInputValue(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  return dt.toISOString().slice(0, 10);
}

function createMaterialRow(data) {
  const tbody = document.getElementById('editMaterialsTbody');
  if (!tbody) return;
  
  const qty  = data ? (Number(data.Quantity)           || 0) : 0;
  const rate = data ? (Number(data.PurchaseRate)        || 0) : 0;
  const tot  = data ? (Number(data.TotalPurchaseValue)  || (qty * rate)) : 0;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text"   class="form-control form-control-sm mat-name border-0 p-0 text-center" list="itemList" value="${data ? (data.ItemName  || '') : ''}" placeholder="Item Name"></td>
    <td><input type="text"   class="form-control form-control-sm mat-category border-0 p-0 text-center" value="${data ? (data.Category || '') : ''}" placeholder="Category"></td>
    <td><input type="number" class="form-control form-control-sm mat-qty  border-0 p-0 text-end" min="0" step="any" value="${qty  || ''}"></td>
    <td><input type="text"   class="form-control form-control-sm mat-unit border-0 p-0 text-center" value="${data ? (data.Unit || '') : ''}" placeholder="Unit"></td>
    <td><input type="number" class="form-control form-control-sm mat-rate border-0 p-0 text-end" min="0" step="any" value="${rate || ''}"></td>
    <td><input type="number" class="form-control form-control-sm mat-total border-0 p-0 text-end fw-semibold" min="0" step="any" value="${tot  || ''}" placeholder="Total"></td>
    <td class="text-center"><span class="text-danger fw-bold" style="cursor:pointer; font-size:0.9rem;" onclick="removeMaterialRowInline(this)">✕</span></td>
  `;
  
  tbody.appendChild(tr);
  
  const qtyEl   = tr.querySelector('.mat-qty');
  const rateEl  = tr.querySelector('.mat-rate');
  const totalEl = tr.querySelector('.mat-total');

  // Rate or Qty changed → recompute Total
  function syncTotal() {
    const q = Number(qtyEl.value)  || 0;
    const r = Number(rateEl.value) || 0;
    if (q > 0 || r > 0) totalEl.value = q && r ? (Math.round(q * r * 100) / 100) || '' : '';
    recalcInlineForm();
  }
  // Total changed → back-calculate Rate
  function syncRate() {
    const q = Number(qtyEl.value)   || 0;
    const t = Number(totalEl.value) || 0;
    if (q > 0 && t > 0) rateEl.value = Math.round(t / q * 100) / 100;
    recalcInlineForm();
  }

  qtyEl.addEventListener('input',   syncTotal);
  rateEl.addEventListener('input',  syncTotal);
  totalEl.addEventListener('input', syncRate);

  recalcInlineForm();
}

window.removeMaterialRowInline = function(btn) {
  const tr = btn.closest('tr');
  if (tr) tr.remove();
  recalcInlineForm();
};

window.addMaterialRowInline = function() {
  createMaterialRow();
};

function recalcInlineForm() {
  const materials = readMaterialsFromInlineForm();
  const transportCost = Number(document.getElementById('editTransportationCost').value) || 0;
  
  const includeGST = document.getElementById('editIncludeGST') && document.getElementById('editIncludeGST').checked;
  const gstPct = includeGST ? (Number(document.getElementById('editGSTPercentage').value) || 0) : 0;
  
  const result = Calc.computeShipment(materials, transportCost, gstPct);
  
  // Set modal summary labels
  const lblSubtotal = document.getElementById('lblMaterialsSubtotal');
  const lblGST = document.getElementById('lblGstAmount');
  const lblTransport = document.getElementById('lblTransportCost');
  const lblGrand = document.getElementById('lblGrandTotal');
  
  if (lblSubtotal) lblSubtotal.textContent = UI.money(result.purchaseTotal);
  if (lblGST) lblGST.textContent = UI.money(result.gstAmount);
  if (lblTransport) lblTransport.textContent = UI.money(result.transport);
  if (lblGrand) lblGrand.textContent = UI.money(result.grandTotal);
}

function readMaterialsFromInlineForm() {
  const rows = document.querySelectorAll('#editMaterialsTbody tr');
  return Array.from(rows).map(row => {
    const qty   = Number(row.querySelector('.mat-qty').value)   || 0;
    const rate  = Number(row.querySelector('.mat-rate').value)  || 0;
    const total = Number(row.querySelector('.mat-total').value) || 0;
    return {
      ItemName:          row.querySelector('.mat-name').value.trim(),
      Category:          row.querySelector('.mat-category').value.trim(),
      Quantity:          qty,
      Unit:              row.querySelector('.mat-unit').value.trim(),
      PurchaseRate:      rate,
      TotalPurchaseValue: total || (qty * rate),
    };
  }).filter(m => m.ItemName);
}

let modalListenersConfigured = false;
function setupModalListenersOnce() {
  if (modalListenersConfigured) return;
  modalListenersConfigured = true;
  
  // File input listener
  const fileInput = document.getElementById('editUploadedDocs');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files.length) return;
      for (const file of files) {
        pendingFiles.push({ name: file.name, blob: file });
      }
      renderUploadedDocsList();
    });
  }
  
  // Calculation inputs recalculate form
  document.getElementById('shipmentFormModal').addEventListener('input', (e) => {
    if (e.target.classList.contains('edit-calc-input')) {
      recalcInlineForm();
    }
  });

  // Toggle GST listener
  const includeGST = document.getElementById('editIncludeGST');
  const gstInput = document.getElementById('editGSTPercentage');
  if (includeGST && gstInput) {
    includeGST.addEventListener('change', () => {
      gstInput.disabled = !includeGST.checked;
      recalcInlineForm();
    });
  }

  // Toggle Shipment Type label update
  const shipTypeSelect = document.getElementById('editShipmentType');
  const lblPaid = document.getElementById('lblEditVendorPaid');
  if (shipTypeSelect && lblPaid) {
    shipTypeSelect.addEventListener('change', () => {
      lblPaid.textContent = shipTypeSelect.value === 'Sell' ? 'Received (₹)' : 'Paid (₹)';
    });
  }
  
  // Save button bind click
  document.getElementById('btnSaveShipment').addEventListener('click', () => {
    saveInline(editingShipmentNo);
  });
}

function updateModalPaidLabel() {
  const shipTypeSelect = document.getElementById('editShipmentType');
  const lblPaid = document.getElementById('lblEditVendorPaid');
  if (shipTypeSelect && lblPaid) {
    lblPaid.textContent = shipTypeSelect.value === 'Sell' ? 'Received (₹)' : 'Paid (₹)';
  }
}

window.addInlineRow = function() {
  isAddingNew = true;
  editingShipmentNo = Utils.nextShipmentNo(DB.getAll('shipments'));
  
  const modalLabel = document.getElementById('shipFormModalLabel');
  if (modalLabel) modalLabel.textContent = `➕ Add New Shipment (${editingShipmentNo})`;

  pendingFiles = [];
  currentDocs = [];
  
  // Set defaults in inputs
  document.getElementById('editPurchaseDate').value = UI.todayISO();
  document.getElementById('editShipmentType').value = 'Buy';
  updateModalPaidLabel();
  document.getElementById('editVendorName').value = '';
  document.getElementById('editVehicleNumber').value = '';
  document.getElementById('editInvoiceNumber').value = '';
  
  const includeGST = document.getElementById('editIncludeGST');
  const gstInput = document.getElementById('editGSTPercentage');
  if (includeGST && gstInput) {
    includeGST.checked = true;
    gstInput.value = 18;
    gstInput.disabled = false;
  }
  
  document.getElementById('editVendorPaid').value = 0;
  document.getElementById('editTransportationCost').value = 0;
  document.getElementById('editTransportPaid').value = 0;
  document.getElementById('editRemarks').value = '';
  
  setupModalListenersOnce();
  renderUploadedDocsList();
  
  const matTbody = document.getElementById('editMaterialsTbody');
  if (matTbody) {
    matTbody.innerHTML = '';
    createMaterialRow();
  }
  
  recalcInlineForm();
  
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('shipmentFormModal'));
  modal.show();
};

window.editRow = function(shipmentNo) {
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!s) return;
  
  editingShipmentNo = shipmentNo;
  isAddingNew = false;
  
  const modalLabel = document.getElementById('shipFormModalLabel');
  if (modalLabel) modalLabel.textContent = `✏️ Edit Shipment (${shipmentNo})`;

  pendingFiles = [];
  currentDocs = s.Documents ? s.Documents.split(',').filter(Boolean) : [];
  
  // Set values in inputs
  document.getElementById('editPurchaseDate').value = toDateInputValue(s.PurchaseDate);
  document.getElementById('editShipmentType').value = s.ShipmentType || 'Buy';
  updateModalPaidLabel();
  document.getElementById('editVendorName').value = s.VendorName || '';
  document.getElementById('editVehicleNumber').value = s.VehicleNumber || '';
  document.getElementById('editInvoiceNumber').value = s.InvoiceNumber || '';
  
  const includeGST = document.getElementById('editIncludeGST');
  const gstInput = document.getElementById('editGSTPercentage');
  if (includeGST && gstInput) {
    includeGST.checked = s.GSTPercentage > 0;
    gstInput.value = s.GSTPercentage || 18;
    gstInput.disabled = !includeGST.checked;
  }
  
  document.getElementById('editVendorPaid').value = s.VendorPaid || 0;
  document.getElementById('editTransportationCost').value = s.TransportationCost || 0;
  document.getElementById('editTransportPaid').value = s.TransportPaid || 0;
  document.getElementById('editRemarks').value = s.Remarks || '';
  
  setupModalListenersOnce();
  renderUploadedDocsList();
  
  const editMats = DB.getAll('materials').filter(m => m.ShipmentNo === shipmentNo);
  const matTbody = document.getElementById('editMaterialsTbody');
  if (matTbody) {
    matTbody.innerHTML = '';
    if (editMats.length) {
      editMats.forEach(m => createMaterialRow(m));
    } else {
      createMaterialRow();
    }
  }
  
  recalcInlineForm();
  
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('shipmentFormModal'));
  modal.show();
};

window.cancelInline = function() {
  editingShipmentNo = null;
  isAddingNew = false;
  pendingFiles = [];
  currentDocs = [];
  
  const modalEl = document.getElementById('shipmentFormModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  
  renderList();
};

window.saveInline = async function(shipmentNo) {
  const isEdit = !isAddingNew;
  const purchaseDate = document.getElementById('editPurchaseDate').value;
  const vendorName = document.getElementById('editVendorName').value.trim();
  const shipmentType = document.getElementById('editShipmentType').value;
  
  const transportationCost = document.getElementById('editTransportationCost').value;
  
  const includeGST = document.getElementById('editIncludeGST') && document.getElementById('editIncludeGST').checked;
  const gstPercentage = includeGST ? (Number(document.getElementById('editGSTPercentage').value) || 0) : 0;
  
  const vendorPaid = document.getElementById('editVendorPaid').value;
  const transportPaid = document.getElementById('editTransportPaid').value;
  
  const vehicleNumber = document.getElementById('editVehicleNumber').value.trim();
  const invoiceNumber = document.getElementById('editInvoiceNumber').value.trim();
  const remarks = document.getElementById('editRemarks').value.trim();
  
  const materials = readMaterialsFromInlineForm();

  const rules = [
    [Validate.required, purchaseDate, 'Purchase Date'],
    [Validate.required, vendorName, 'Vendor Name'],
  ];
  if (includeGST) {
    rules.push([Validate.percent, gstPercentage, 'GST %']);
  }

  const errors = Validate.run(rules);
  if (!materials.length) errors.push('Add at least one item with a name.');
  materials.forEach((m, i) => {
    if (!(Number(m.Quantity) > 0)) errors.push(`Item #${i + 1}: Quantity must be greater than 0.`);
    const hasPrice = (Number(m.TotalPurchaseValue) > 0) || (Number(m.PurchaseRate) >= 0);
    if (!hasPrice) errors.push(`Item #${i + 1}: Enter a Rate or Total Price.`);
  });

  if (errors.length) {
    UI.toast(errors[0], 'danger');
    return;
  }

  UI.showLoading(true);
  try {
    // Upload pending files
    for (const file of pendingFiles) {
      await DB.saveDocumentFile(shipmentNo, file.name, file.blob);
    }
    
    const docNames = currentDocs.concat(pendingFiles.map(f => f.name)).join(',');
    pendingFiles = [];
    currentDocs = [];

    const shipmentRow = {
      ShipmentNo: shipmentNo,
      PurchaseDate: purchaseDate,
      VendorName: vendorName,
      ShipmentType: shipmentType,
      VehicleNumber: vehicleNumber,
      InvoiceNumber: invoiceNumber,
      TransportationCost: Number(transportationCost),
      GSTPercentage: Number(gstPercentage),
      VendorPaid: Number(vendorPaid),
      TransportPaid: Number(transportPaid),
      Documents: docNames,
      Remarks: remarks,
      CreatedAt: isEdit ? (DB.getAll('shipments').find(s => s.ShipmentNo === shipmentNo)?.CreatedAt || new Date().toISOString()) : new Date().toISOString(),
    };

    if (isEdit) {
      await DB.update('shipments', s => s.ShipmentNo === shipmentNo, shipmentRow);
    } else {
      await DB.insert('shipments', shipmentRow);
    }

    // Replace all material rows for this shipment
    const allMaterials = DB.getAll('materials').filter(m => m.ShipmentNo !== shipmentNo);
    const newRows = materials.map(m => ({
      RowID: Utils.uid('MAT'),
      ShipmentNo: shipmentNo,
      ItemName: m.ItemName,
      Category: m.Category,
      Quantity: m.Quantity,
      Unit: m.Unit,
      PurchaseRate: m.PurchaseRate,
      // Store user-entered total; fallback to Qty × Rate
      TotalPurchaseValue: m.TotalPurchaseValue || Calc.round2(m.Quantity * m.PurchaseRate),
    }));
    await DB.replaceAll('materials', [...allMaterials, ...newRows]);

    // Auto-add any new vendor/items to their masters
    await autoAddVendorIfMissing(vendorName);
    for (const m of materials) await autoAddItemIfMissing(m);

    UI.showLoading(false);
    UI.toast(`Shipment ${shipmentNo} saved successfully.`, 'success');
    populateDatalists();
    cancelInline();
  } catch (e) {
    UI.showLoading(false);
    UI.toast('Error saving shipment: ' + e.message, 'danger');
  }
};

async function autoAddVendorIfMissing(name) {
  if (!name) return;
  const vendors = DB.getAll('vendors');
  if (!vendors.some(v => v.VendorName === name)) {
    await DB.insert('vendors', { VendorName: name, Address: '', Phone: '', GSTIN: '', Email: '', Remarks: 'Auto-added from Shipment' });
  }
}

async function autoAddItemIfMissing(m) {
  if (!m.ItemName) return;
  const items = DB.getAll('items');
  if (!items.some(i => i.ItemName === m.ItemName)) {
    await DB.insert('items', { ItemName: m.ItemName, Category: m.Category || '', Unit: m.Unit || '', HSNCode: '', GSTPercent: '', Status: 'Active' });
  }
}

window.deleteShipment = async function (shipmentNo) {
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!s) return;

  const ok = await UI.confirmDialog(`Soft delete shipment ${shipmentNo}? It will be hidden from active list but preserved in database.`, 'Delete Shipment', 'Soft Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.update('shipments', x => x.ShipmentNo === shipmentNo, {
      ...s,
      Status: 'Deleted',
      DeletedAt: new Date().toISOString()
    });
    UI.toast(`Shipment ${shipmentNo} soft-deleted.`, 'warning');
    renderList();
  } catch (err) {
    UI.toast('Error deleting shipment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.restoreShipment = async function (shipmentNo) {
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!s) return;

  UI.showLoading(true);
  try {
    await DB.update('shipments', x => x.ShipmentNo === shipmentNo, {
      ...s,
      Status: 'Active',
      DeletedAt: null
    });
    UI.toast(`Shipment ${shipmentNo} restored successfully.`, 'success');
    renderList();
  } catch (err) {
    UI.toast('Error restoring shipment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.previewDocRow = function(shipmentNo, docName) {
  const url = `/docs/${encodeURIComponent(shipmentNo)}/${encodeURIComponent(docName)}`;
  window.open(url, '_blank');
};

function updateSortHeadersUI() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const col = th.getAttribute('data-sort');
    if (col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function populateColorCheckboxes() {
  const menu = document.getElementById('ccColumnMultiselectMenu');
  if (!menu) return;
  menu.innerHTML = COLORABLE_COLS.map(c => `
    <div class="form-check mb-1">
      <input class="form-check-input cc-col-chk" type="checkbox" value="${c.key}" id="ccchk_${c.key}"
             ${selectedColorCols.includes(c.key) ? 'checked' : ''}>
      <label class="form-check-label w-100" for="ccchk_${c.key}">${c.label}</label>
    </div>`).join('');

  document.querySelectorAll('.cc-col-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      selectedColorCols = Array.from(document.querySelectorAll('.cc-col-chk:checked')).map(c => c.value);
      updateColColorPickerBtn();
      updateColorPickerValue();
    });
  });
  updateColColorPickerBtn();
}

function updateColColorPickerBtn() {
  const btn = document.getElementById('btnColColorMultiselect');
  if (!btn) return;
  btn.textContent = selectedColorCols.length === 0 ? 'Select Columns'
    : selectedColorCols.length === COLORABLE_COLS.length ? 'All Columns'
    : `${selectedColorCols.length} Column${selectedColorCols.length > 1 ? 's' : ''}`;
}

function updateColorPickerValue() {
  const picker = document.getElementById('ccColorPicker');
  if (!picker || selectedColorCols.length === 0) { if (picker) picker.value = '#ffffff'; return; }
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  picker.value = saved[selectedColorCols[0]] || '#ffff00';
}

function applyCustomStyles() {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  let styleText = '';
  COLORABLE_COLS.forEach(c => {
    const color = saved[c.key];
    if (color && color !== '#ffffff') {
      styleText += `.table-installments td.${c.key} { background-color: ${color} !important; }\n`;
    } else {
      styleText += `.table-installments td.${c.key} { background-color: transparent; }\n`;
    }
  });
  let el = document.getElementById('shipDynamicStyles');
  if (!el) { el = document.createElement('style'); el.id = 'shipDynamicStyles'; document.head.appendChild(el); }
  el.textContent = styleText;
}

window.showDocsModal = function(shipmentNo) {
  const shipment = DB.getAll('shipments').find(s => s.ShipmentNo === shipmentNo);
  if (!shipment) return;
  const docNames = shipment.Documents ? shipment.Documents.split(',').filter(Boolean) : [];
  
  const container = document.getElementById('docsListModalContainer');
  if (docNames.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-3">No documents attached.</div>';
  } else {
    container.innerHTML = docNames.map(name => `
      <button class="btn btn-sm btn-secondary text-start w-100 p-2 fs-7 d-flex align-items-center justify-content-between" onclick="previewDocRow('${shipmentNo}','${name}')">
        <span>📄 ${name}</span>
        <span class="badge bg-light text-dark text-uppercase" style="font-size:0.6rem;">open</span>
      </button>
    `).join('');
  }
  const modal = new bootstrap.Modal(document.getElementById('docsModal'));
  modal.show();
};

let activePayShipmentNo = null;
let activePayType = null; // 'vendor' or 'transport'
let payModalListenersConfigured = false;

function setupPayModalListenersOnce() {
  if (payModalListenersConfigured) return;
  payModalListenersConfigured = true;

  const btnToggle = document.getElementById('btnTogglePayForm');
  const drawer = document.getElementById('payFormDrawer');

  if (btnToggle && drawer) {
    btnToggle.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      btnToggle.classList.toggle('active', isOpen);
      btnToggle.textContent = isOpen ? '✕' : '✚';
      if (isOpen) {
        document.getElementById('payInputAmount').focus();
      }
    });
  }

  const btnSave = document.getElementById('btnSavePaymentEntry');
  if (btnSave) {
    btnSave.addEventListener('click', () => savePaymentEntry());
  }

  const btnSettle = document.getElementById('btnFullSettlePay');
  if (btnSettle) {
    btnSettle.addEventListener('click', () => settleFullPayment());
  }
}

function resetPayDrawer() {
  const drawer = document.getElementById('payFormDrawer');
  const btnToggle = document.getElementById('btnTogglePayForm');
  if (drawer) drawer.classList.remove('open');
  if (btnToggle) {
    btnToggle.classList.remove('active');
    btnToggle.textContent = '✚';
  }
  const dateEl = document.getElementById('payInputDate');
  if (dateEl) dateEl.value = UI.todayISO();
  const amtEl = document.getElementById('payInputAmount');
  if (amtEl) amtEl.value = '';
  const rmkEl = document.getElementById('payInputRemarks');
  if (rmkEl) rmkEl.value = '';
}

window.showVendorPaymentDetails = function(shipmentNo) {
  setupPayModalListenersOnce();
  activePayShipmentNo = shipmentNo;
  activePayType = 'vendor';
  resetPayDrawer();

  const titleEl = document.getElementById('payModalTitleText');
  const subEl = document.getElementById('payModalSubText');
  const balEl = document.getElementById('payModalBal');
  const bodyEl = document.getElementById('payModalBodyContent');
  const composeBar = document.getElementById('payComposeBar');
  const drawerHeading = document.getElementById('payDrawerHeading');
  const header = document.getElementById('payModalHeader');

  if (header) header.style.background = 'linear-gradient(135deg, #12314f, #1e8a4c)';

  if (shipmentNo === 'TOTAL') {
    if (composeBar) composeBar.style.display = 'none';
    if (titleEl) titleEl.textContent = 'Grand Total Vendor Payments';
    if (subEl) subEl.textContent = 'All Vendors & Shipments Summary';

    const shipments = getEnrichedShipments();
    let sumVendorDue = 0;
    let sumVendorPaid = 0;
    const unpaidShipments = [];

    shipments.forEach(s => {
      const due = s.purchaseTotal + s.gstAmount;
      const paid = Number(s.VendorPaid) || 0;
      sumVendorDue += due;
      sumVendorPaid += paid;
      if (due - paid > 0.01) unpaidShipments.push({ ...s, due, paid, rem: due - paid });
    });

    const netRem = sumVendorDue - sumVendorPaid;
    if (balEl) {
      if (netRem > 0) { balEl.textContent = '−' + UI.money(netRem) + ' due'; balEl.className = 'bw-modal-bal negative'; }
      else if (netRem < 0) { balEl.textContent = '+' + UI.money(Math.abs(netRem)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
      else { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
    }

    let unpaidHTML = '';
    if (unpaidShipments.length > 0) {
      unpaidHTML = `
        <div class="mt-3">
          <div class="fw-bold text-secondary fs-8 mb-2">Pending Vendor Payments (${unpaidShipments.length} Shipments)</div>
          <div class="d-flex flex-column gap-2">
            ${unpaidShipments.map(u => `
              <div class="p-2 border rounded bg-white d-flex justify-content-between align-items-center shadow-sm">
                <div>
                  <div class="fw-bold text-dark fs-8">${u.VendorName || 'Shipment ' + u.ShipmentNo} <span class="text-muted fw-normal">(${u.ShipmentNo})</span></div>
                  <div class="fs-8 text-muted">Due: ${UI.money(u.due)} | Paid: ${UI.money(u.paid)}</div>
                </div>
                <button class="btn btn-xs btn-outline-success font-monospace" onclick="showVendorPaymentDetails('${u.ShipmentNo}')">Pay: ${UI.money(u.rem)}</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="p-3 border rounded bg-white shadow-sm mb-2" style="font-size:0.88rem;">
        <div class="d-flex justify-content-between border-bottom pb-2 text-primary fw-bold"><span>Total Invoice Due (Materials + GST):</span> <span>${UI.money(sumVendorDue)}</span></div>
        <div class="d-flex justify-content-between border-bottom py-2 text-success fw-bold"><span>Total Paid to Vendors:</span> <span>${UI.money(sumVendorPaid)}</span></div>
        <div class="d-flex justify-content-between pt-2 fw-bold text-danger"><span>Net Outstanding Vendor Due:</span> <span>${UI.money(netRem)}</span></div>
      </div>
      ${unpaidHTML}
    `;
  } else {
    if (composeBar) composeBar.style.display = 'flex';
    const shipments = getEnrichedShipments();
    const r = shipments.find(s => s.ShipmentNo === shipmentNo);
    if (!r) return;

    const vendorDue = r.purchaseTotal + r.gstAmount;
    const vendorPaid = Number(r.VendorPaid) || 0;
    const remaining = vendorDue - vendorPaid;

    const vendorName = r.VendorName || 'Vendor';

    if (titleEl) titleEl.textContent = `Vendor Payment — ${vendorName}`;
    if (subEl) subEl.textContent = `Vendor: ${vendorName} | Invoice #: ${r.InvoiceNumber || 'N/A'}`;
    if (drawerHeading) drawerHeading.textContent = `➕ Add Vendor Payment (${r.ShipmentNo})`;

    if (balEl) {
      if (remaining > 0) { balEl.textContent = '−' + UI.money(remaining) + ' due'; balEl.className = 'bw-modal-bal negative'; }
      else if (remaining < 0) { balEl.textContent = '+' + UI.money(Math.abs(remaining)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
      else { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
    }

    // 1. Left Chat Bubble (Vendor Invoice Obligation)
    const leftBubbleHTML = `
      <div class="chat-row left">
        <div class="chat-bubble credit">
          <div class="bubble-label" style="color:#c0392b;">🏬 ${vendorName} Invoice Charge</div>
          <div class="bubble-amount" style="color:#c0392b;">−${UI.money(vendorDue)}</div>
          <div class="bubble-remarks">Materials: ${UI.money(r.purchaseTotal)} + GST ${r.GSTPercentage || 0}%: ${UI.money(r.gstAmount)} ${r.InvoiceNumber ? '(Inv: ' + r.InvoiceNumber + ')' : ''}</div>
          <div class="bubble-meta">Purchase Date: ${UI.fmtDate(r.PurchaseDate)}</div>
        </div>
      </div>
    `;

    // 2. Right Chat Bubbles (Payments made to Vendor)
    const remarks = DB.getAll('shipment_remarks').filter(t => t.ShipmentNo === shipmentNo && t.Remark.toLowerCase().includes('vendor'));
    const rightBubblesHTML = remarks.map(m => {
      let dateLabel = UI.fmtDate(m.CreatedAt);
      let amountVal = 0;
      const match = m.Remark.match(/₹([0-9,.]+)/);
      if (match) amountVal = parseFloat(match[1].replace(/,/g, '')) || 0;

      return `
        <div class="chat-row right" data-remark-id="${m.RemarkID}">
          <button class="txn-del" onclick="deletePaymentLog('${m.RemarkID}')" title="Delete Payment">×</button>
          <div class="chat-bubble debit">
            <div class="bubble-label" style="color:#1e8a4c;">💳 You Paid Vendor</div>
            <div class="bubble-amount" style="color:#1e8a4c;">+${amountVal > 0 ? UI.money(amountVal) : ''}</div>
            <div class="bubble-remarks">${m.Remark}</div>
            <div class="bubble-meta">${dateLabel}</div>
          </div>
        </div>
      `;
    }).join('');

    // 3. Running Total Footer
    const footerHTML = `
      <div class="txn-running-footer">
        <span style="font-size:.78rem; color:#46586b; font-weight:600;">Net Vendor Due Balance</span>
        <strong style="font-size:.92rem; color:${remaining > 0 ? '#c0392b' : '#1e8a4c'};">
          ${remaining > 0 ? '−' + UI.money(remaining) : '✓ Fully Settled'}
        </strong>
      </div>
    `;

    bodyEl.innerHTML = leftBubbleHTML + rightBubblesHTML + footerHTML;
    setTimeout(() => {
      const scrollArea = document.getElementById('payModalScrollArea');
      if (scrollArea) scrollArea.scrollTop = 99999;
    }, 50);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentDetailModal'));
  modal.show();
};

window.showTransportPaymentDetails = function(shipmentNo) {
  setupPayModalListenersOnce();
  activePayShipmentNo = shipmentNo;
  activePayType = 'transport';
  resetPayDrawer();

  const titleEl = document.getElementById('payModalTitleText');
  const subEl = document.getElementById('payModalSubText');
  const balEl = document.getElementById('payModalBal');
  const bodyEl = document.getElementById('payModalBodyContent');
  const composeBar = document.getElementById('payComposeBar');
  const drawerHeading = document.getElementById('payDrawerHeading');
  const header = document.getElementById('payModalHeader');

  if (header) header.style.background = 'linear-gradient(135deg, #12314f, #0288d1)';

  if (shipmentNo === 'TOTAL') {
    if (composeBar) composeBar.style.display = 'none';
    if (titleEl) titleEl.textContent = 'Grand Total Transport Payments';
    if (subEl) subEl.textContent = 'All Vehicles & Freight Summary';

    const shipments = getEnrichedShipments();
    let sumTransportCost = 0;
    let sumTransportPaid = 0;
    const unpaidShipments = [];

    shipments.forEach(s => {
      const cost = s.transport;
      const paid = Number(s.TransportPaid) || 0;
      sumTransportCost += cost;
      sumTransportPaid += paid;
      if (cost - paid > 0.01) unpaidShipments.push({ ...s, cost, paid, rem: cost - paid });
    });

    const netRem = sumTransportCost - sumTransportPaid;
    if (balEl) {
      if (netRem > 0) { balEl.textContent = '−' + UI.money(netRem) + ' due'; balEl.className = 'bw-modal-bal negative'; }
      else if (netRem < 0) { balEl.textContent = '+' + UI.money(Math.abs(netRem)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
      else { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
    }

    let unpaidHTML = '';
    if (unpaidShipments.length > 0) {
      unpaidHTML = `
        <div class="mt-3">
          <div class="fw-bold text-secondary fs-8 mb-2">Pending Transport Payments (${unpaidShipments.length} Shipments)</div>
          <div class="d-flex flex-column gap-2">
            ${unpaidShipments.map(u => `
              <div class="p-2 border rounded bg-white d-flex justify-content-between align-items-center shadow-sm">
                <div>
                  <div class="fw-bold text-dark fs-8">${u.VendorName || 'Shipment ' + u.ShipmentNo} <span class="text-muted fw-normal">(${u.VehicleNumber || u.ShipmentNo})</span></div>
                  <div class="fs-8 text-muted">Cost: ${UI.money(u.cost)} | Paid: ${UI.money(u.paid)}</div>
                </div>
                <button class="btn btn-xs btn-outline-info font-monospace" onclick="showTransportPaymentDetails('${u.ShipmentNo}')">Pay: ${UI.money(u.rem)}</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="p-3 border rounded bg-white shadow-sm mb-2" style="font-size:0.88rem;">
        <div class="d-flex justify-content-between border-bottom pb-2 text-primary fw-bold"><span>Total Transport Cost (All Shipments):</span> <span>${UI.money(sumTransportCost)}</span></div>
        <div class="d-flex justify-content-between border-bottom py-2 text-success fw-bold"><span>Total Paid for Transport:</span> <span>${UI.money(sumTransportPaid)}</span></div>
        <div class="d-flex justify-content-between pt-2 fw-bold text-danger"><span>Net Outstanding Transport Due:</span> <span>${UI.money(netRem)}</span></div>
      </div>
      ${unpaidHTML}
    `;
  } else {
    if (composeBar) composeBar.style.display = 'flex';
    const shipments = getEnrichedShipments();
    const r = shipments.find(s => s.ShipmentNo === shipmentNo);
    if (!r) return;

    const transportCost = r.transport;
    const transportPaid = Number(r.TransportPaid) || 0;
    const remaining = transportCost - transportPaid;
    const driverLabel = r.VehicleNumber ? `Vehicle (${r.VehicleNumber})` : 'Driver / Transporter';

    if (titleEl) titleEl.textContent = `Transport Payment — ${driverLabel}`;
    if (subEl) subEl.textContent = `Vehicle #: ${r.VehicleNumber || 'N/A'} | Shipment: ${r.ShipmentNo}`;
    if (drawerHeading) drawerHeading.textContent = `➕ Add Transport Payment (${r.ShipmentNo})`;

    if (balEl) {
      if (remaining > 0) { balEl.textContent = '−' + UI.money(remaining) + ' due'; balEl.className = 'bw-modal-bal negative'; }
      else if (remaining < 0) { balEl.textContent = '+' + UI.money(Math.abs(remaining)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
      else { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
    }

    // 1. Left Chat Bubble (Driver / Vehicle Transport Charge)
    const leftBubbleHTML = `
      <div class="chat-row left">
        <div class="chat-bubble credit">
          <div class="bubble-label" style="color:#e65100;">🚚 ${driverLabel} Charge</div>
          <div class="bubble-amount" style="color:#d84315;">−${UI.money(transportCost)}</div>
          ${r.Remarks ? `<div class="bubble-remarks">${r.Remarks}</div>` : ''}
          <div class="bubble-meta">Purchase Date: ${UI.fmtDate(r.PurchaseDate)}</div>
        </div>
      </div>
    `;

    // 2. Right Chat Bubbles (Payments made to Driver/Transporter)
    const remarks = DB.getAll('shipment_remarks').filter(t => t.ShipmentNo === shipmentNo && t.Remark.toLowerCase().includes('transport'));
    const rightBubblesHTML = remarks.map(m => {
      let dateLabel = UI.fmtDate(m.CreatedAt);
      let amountVal = 0;
      const match = m.Remark.match(/₹([0-9,.]+)/);
      if (match) amountVal = parseFloat(match[1].replace(/,/g, '')) || 0;

      return `
        <div class="chat-row right" data-remark-id="${m.RemarkID}">
          <button class="txn-del" onclick="deletePaymentLog('${m.RemarkID}')" title="Delete Payment">×</button>
          <div class="chat-bubble debit">
            <div class="bubble-label" style="color:#1e8a4c;">💳 You Paid</div>
            <div class="bubble-amount" style="color:#1e8a4c;">+${amountVal > 0 ? UI.money(amountVal) : ''}</div>
            <div class="bubble-remarks">${m.Remark}</div>
            <div class="bubble-meta">${dateLabel}</div>
          </div>
        </div>
      `;
    }).join('');

    // 3. Running Total Footer
    const footerHTML = `
      <div class="txn-running-footer">
        <span style="font-size:.78rem; color:#46586b; font-weight:600;">Net Transport Balance Due</span>
        <strong style="font-size:.92rem; color:${remaining > 0 ? '#c0392b' : '#1e8a4c'};">
          ${remaining > 0 ? '−' + UI.money(remaining) : '✓ Fully Settled'}
        </strong>
      </div>
    `;

    bodyEl.innerHTML = leftBubbleHTML + rightBubblesHTML + footerHTML;
    setTimeout(() => {
      const scrollArea = document.getElementById('payModalScrollArea');
      if (scrollArea) scrollArea.scrollTop = 99999;
    }, 50);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentDetailModal'));
  modal.show();
};

window.deletePaymentLog = async function(remarkId) {
  const remark = DB.getAll('shipment_remarks').find(m => m.RemarkID === remarkId);
  if (!remark) return;

  const shipmentNo = remark.ShipmentNo;
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!s) return;

  const ok = await UI.confirmDialog('Delete this payment entry? Remaining balance will adjust automatically.', 'Delete Payment', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    let amountVal = 0;
    const match = remark.Remark.match(/₹([0-9,.]+)/);
    if (match) amountVal = parseFloat(match[1].replace(/,/g, '')) || 0;

    if (activePayType === 'vendor') {
      const currentPaid = Number(s.VendorPaid) || 0;
      const newPaid = Math.max(0, currentPaid - amountVal);
      await DB.update('shipments', x => x.ShipmentNo === shipmentNo, { ...s, VendorPaid: newPaid });
      await DB.remove('shipment_remarks', m => m.RemarkID === remarkId);
      UI.toast('Vendor payment log removed', 'info');
      showVendorPaymentDetails(shipmentNo);
    } else if (activePayType === 'transport') {
      const currentPaid = Number(s.TransportPaid) || 0;
      const newPaid = Math.max(0, currentPaid - amountVal);
      await DB.update('shipments', x => x.ShipmentNo === shipmentNo, { ...s, TransportPaid: newPaid });
      await DB.remove('shipment_remarks', m => m.RemarkID === remarkId);
      UI.toast('Transport payment log removed', 'info');
      showTransportPaymentDetails(shipmentNo);
    }

    renderList();
  } catch (e) {
    UI.toast('Error deleting payment: ' + e.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

async function savePaymentEntry() {
  if (!activePayShipmentNo || activePayShipmentNo === 'TOTAL') return;
  const shipmentNo = activePayShipmentNo;
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!s) return;

  const dateVal = document.getElementById('payInputDate').value;
  const amtRaw = document.getElementById('payInputAmount').value;
  const remarks = document.getElementById('payInputRemarks').value.trim();

  if (!dateVal) { UI.toast('Please select a payment date.', 'warning'); return; }
  const amount = parseFloat(amtRaw);
  if (isNaN(amount) || amount <= 0) { UI.toast('Please enter a valid payment amount > 0.', 'warning'); return; }

  UI.showLoading(true);
  try {
    if (activePayType === 'vendor') {
      const currentPaid = Number(s.VendorPaid) || 0;
      const newPaid = currentPaid + amount;
      await DB.update('shipments', x => x.ShipmentNo === shipmentNo, { ...s, VendorPaid: newPaid });

      const noteText = `Vendor Payment: ${UI.money(amount)} on ${UI.fmtDate(dateVal)}${remarks ? ' (' + remarks + ')' : ''}`;
      await DB.insert('shipment_remarks', {
        RemarkID: Utils.uid('RMK'),
        ShipmentNo: shipmentNo,
        Remark: noteText,
        CreatedAt: new Date().toISOString()
      });

      UI.toast(`✓ Vendor Payment of ${UI.money(amount)} saved!`, 'success');
      showVendorPaymentDetails(shipmentNo);
    } else if (activePayType === 'transport') {
      const currentPaid = Number(s.TransportPaid) || 0;
      const newPaid = currentPaid + amount;
      await DB.update('shipments', x => x.ShipmentNo === shipmentNo, { ...s, TransportPaid: newPaid });

      const noteText = `Transport Payment: ${UI.money(amount)} on ${UI.fmtDate(dateVal)}${remarks ? ' (' + remarks + ')' : ''}`;
      await DB.insert('shipment_remarks', {
        RemarkID: Utils.uid('RMK'),
        ShipmentNo: shipmentNo,
        Remark: noteText,
        CreatedAt: new Date().toISOString()
      });

      UI.toast(`✓ Transport Payment of ${UI.money(amount)} saved!`, 'success');
      showTransportPaymentDetails(shipmentNo);
    }

    renderList();
  } catch (err) {
    UI.toast('Error saving payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}

async function settleFullPayment() {
  if (!activePayShipmentNo || activePayShipmentNo === 'TOTAL') return;
  const s = getEnrichedShipments().find(x => x.ShipmentNo === activePayShipmentNo);
  if (!s) return;

  let remaining = 0;
  if (activePayType === 'vendor') {
    const due = s.purchaseTotal + s.gstAmount;
    remaining = due - (Number(s.VendorPaid) || 0);
  } else if (activePayType === 'transport') {
    remaining = s.transport - (Number(s.TransportPaid) || 0);
  }

  if (remaining <= 0) {
    UI.toast('Balance is already fully paid / settled.', 'info');
    return;
  }

  document.getElementById('payInputAmount').value = remaining.toFixed(2);
  if (!document.getElementById('payInputRemarks').value) {
    document.getElementById('payInputRemarks').value = 'Full settlement payment';
  }

  const drawer = document.getElementById('payFormDrawer');
  const btnToggle = document.getElementById('btnTogglePayForm');
  if (drawer && !drawer.classList.contains('open')) {
    drawer.classList.add('open');
    if (btnToggle) { btnToggle.classList.add('active'); btnToggle.textContent = '✕'; }
  }

  await savePaymentEntry();
}

window.showShipmentNotes = function(shipmentNo) {
  const r = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);
  if (!r) return;

  document.getElementById('shipNoteNo').value = shipmentNo;
  document.getElementById('newShipNoteText').value = '';

  document.getElementById('shipNotesModalLabel').textContent = `Shipment Notes — ${r.VendorName || shipmentNo}`;

  const remarks = DB.getAll('shipment_remarks').filter(t => t.ShipmentNo === shipmentNo);
  remarks.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

  const feed = document.getElementById('shipNotesHistoryFeed');
  if (remarks.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No remarks recorded yet.</div>`;
  } else {
    feed.innerHTML = remarks.map(t => {
      let formattedDate = '';
      try {
        const dt = new Date(t.CreatedAt);
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        const datePart = `${day}-${month}-${year}`;
        const timePart = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        formattedDate = `${datePart} ${timePart}`;
      } catch (e) {
        formattedDate = t.CreatedAt;
      }

      return `
        <div class="note-card d-flex justify-content-between align-items-start gap-2">
          <div class="d-flex flex-column gap-1 w-100">
            <div class="d-flex align-items-center gap-2 justify-content-between">
              <span class="note-timestamp">${formattedDate}</span>
            </div>
            <div class="note-text">${t.Remark}</div>
          </div>
          <button type="button" class="btn btn-link text-danger p-0 border-0 fs-7 line-height-1" onclick="deleteShipmentNote('${t.RemarkID}')" title="Delete Note" style="text-decoration: none; font-weight: bold; line-height: 1; margin-top: 1px;">✕</button>
        </div>
      `;
    }).join('');
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('shipmentNotesModal'));
  modal.show();
};

window.deleteShipmentNote = async function(remarkId) {
  const remark = DB.getAll('shipment_remarks').find(t => t.RemarkID === remarkId);
  if (!remark) return;
  const shipmentNo = remark.ShipmentNo;

  const ok = await UI.confirmDialog(`Are you sure you want to delete this remark?`, 'Delete Note', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('shipment_remarks', t => t.RemarkID === remarkId);
    UI.toast('Note deleted successfully.', 'success');
    showShipmentNotes(shipmentNo);
    renderList();
  } catch (err) {
    UI.toast('Error deleting note: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};
