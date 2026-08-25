/* =========================================================================
   shipment.js — Inline Shipment Tracker controller
   ========================================================================= */

let editingShipmentNo = null;
let isAddingNew = false;
let pendingFiles = [];
let currentDocs = [];

let sortCol = 'PurchaseDate';
let sortDir = 'desc';
let activeTab = 'Buy';

let selectedColorCols = [];
const COLORABLE_COLS = [
    { key: 'col-date', label: 'Date', default: '#ffffff' },
    { key: 'col-qty', label: 'Item (Qty)', default: '#ffffff' },
    { key: 'col-total', label: 'Grand Total', default: '#ffffff' },
];
const LS_KEY = 'shipColColors';

window.onDbReady = function () {
    UI.renderSidebar('shipment.html');
    UI.renderTopbar('Shipments', 'All purchase shipments and their cost breakdown', `
    <button class="btn btn-outline-secondary" id="btnPrintList">🖨 Print</button>
  `);

    document.getElementById('btnPrintList').addEventListener('click', () => window.print());

    // Tabs for Buy / Sell / PriceHistory
    const tabBuy = document.getElementById('tabBuy');
    const tabSell = document.getElementById('tabSell');
    const tabPriceHistory = document.getElementById('tabPriceHistory');
    const mainShipmentView = document.getElementById('mainShipmentView');
    const mainPriceHistoryView = document.getElementById('mainPriceHistoryView');

    window.switchMainTab = function (type) {
        activeTab = type;
        [tabBuy, tabSell, tabPriceHistory].forEach(t => t && t.classList.remove('active'));

        if (type === 'Buy' && tabBuy) tabBuy.classList.add('active');
        if (type === 'Sell' && tabSell) tabSell.classList.add('active');
        if (type === 'PriceHistory' && tabPriceHistory) tabPriceHistory.classList.add('active');

        if (type === 'PriceHistory') {
            if (mainShipmentView) mainShipmentView.style.display = 'none';
            if (mainPriceHistoryView) mainPriceHistoryView.style.display = 'block';
            renderPriceHistoryList();
        } else {
            if (mainPriceHistoryView) mainPriceHistoryView.style.display = 'none';
            if (mainShipmentView) mainShipmentView.style.display = 'block';
            renderList();
        }
    };

    if (tabBuy) tabBuy.addEventListener('click', () => switchMainTab('Buy'));
    if (tabSell) tabSell.addEventListener('click', () => switchMainTab('Sell'));
    if (tabPriceHistory) tabPriceHistory.addEventListener('click', () => switchMainTab('PriceHistory'));

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
    const ccColorPicker = document.getElementById('ccColorPicker');
    if (ccColorPicker) {
        ccColorPicker.addEventListener('input', e => {
            if (selectedColorCols.length === 0) { UI.toast('Please check at least one column first.', 'warning'); return; }
            const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
            selectedColorCols.forEach(k => { saved[k] = e.target.value; });
            localStorage.setItem(LS_KEY, JSON.stringify(saved));
            applyCustomStyles();
        });
    }

    const btnResetColors = document.getElementById('btnResetColors');
    if (btnResetColors) {
        btnResetColors.addEventListener('click', () => {
            localStorage.removeItem(LS_KEY);
            applyCustomStyles();
            updateColorPickerValue();
            UI.toast('Column colors reset', 'info');
        });
    }

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

    const vendorListEl = document.getElementById('vendorList');
    if (vendorListEl) {
        vendorListEl.innerHTML = vendors.map(v => `<option value="${v.VendorName}">`).join('');
    }
    const itemListEl = document.getElementById('itemList');
    if (itemListEl) {
        itemListEl.innerHTML = items.map(i => `<option value="${i.ItemName}">`).join('');
    }

    const vendorFilter = document.getElementById('fVendor');
    if (vendorFilter) {
        vendorFilter.innerHTML = '<option value="">All Vendors</option>' +
            vendors.map(v => `<option value="${v.VendorName}">${v.VendorName}</option>`).join('');
    }

    Utils.initSearchableDropdown('editVendorName', vendors.map(v => v.VendorName));
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
            VendorPaid: Number(s.VendorPaid) || 0,
            TransportPaid: Number(s.TransportPaid) || 0,
            TransportationCost: Number(s.TransportationCost) || 0,
            GSTPercentage: Number(s.GSTPercentage) || 0,
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

window.downloadDoc = function (fileName) {
    DB.downloadDocumentFile(editingShipmentNo, fileName);
};

window.removeSavedDoc = function (fileName) {
    currentDocs = currentDocs.filter(n => n !== fileName);
    renderUploadedDocsList();
};

window.removePendingDoc = function (idx) {
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

    // Filter by active tab type (Buy / Sell)
    rows = rows.filter(r => (r.ShipmentType || 'Buy') === activeTab);

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
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state text-center text-muted py-4">No shipments match your filters.</td></tr>`;
        const tfoot = document.querySelector('#shipTable tfoot');
        if (tfoot) {
            tfoot.innerHTML = `
        <tr class="add-row-sticky no-print" onclick="addInlineRow()" style="cursor:pointer; height:37px;">
          <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
          <td colspan="3" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new shipment record...</td>
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

        const vendorDue = r.purchaseTotal;
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
        <td class="col-qty" style="font-size:0.82rem; white-space:normal; min-width:280px;">
          ${r.lines.map((l, idx) => {
            const unitSuffix = l.Unit ? ' ' + l.Unit.trim() : '';

            const tUnit = l.Quantity > 0 ? (l.TransportShare / l.Quantity) : 0;
            const mspNum = Calc.round2((Number(l.PurchaseRate) || 0) + tUnit);
            const mspText = mspNum > 0 ? ` <span class="text-success font-monospace ms-1" style="font-size:0.78rem; font-weight:600;">{MSP/Unit:${UI.money(mspNum)}}</span>` : '';

            return `<div class="mb-2"><a href="#" class="fw-bold text-primary text-decoration-none" onclick="showItemPriceBreakup('${r.ShipmentNo}', ${idx}); return false;">${l.ItemName}</a> (${l.Quantity}${unitSuffix})${mspText}</div>`;
        }).join('') || '<span class="text-muted">—</span>'}
        </td>
        <td class="col-total text-end fw-bold font-monospace">
          <div class="d-flex flex-column align-items-end" style="gap:2px;">
            <span>${UI.money(grandTotal)}</span>
            <div class="d-flex align-items-center justify-content-end flex-wrap gap-1 mt-1 font-sans" style="font-size:0.8rem; font-weight:normal;">
              <span class="fw-semibold text-dark me-1">${r.VendorName || '-'}</span>
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
        <td colspan="3" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new shipment record...</td>
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
        <td colspan="2">GRAND TOTAL</td>
        <td class="text-end fw-bold font-monospace">
          <div class="d-flex flex-column align-items-end" style="gap:2px;">
            <span>${UI.money(sumGrandTotal)}</span>
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

function createMaterialRow(data, defaultGstPercent = 18) {
    const tbody = document.getElementById('editMaterialsTbody');
    if (!tbody) return;

    function round2(n) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    const qty = data ? (Number(data.Quantity) || 0) : 0;
    const rate = data ? (Number(data.PurchaseRate) || 0) : 0;
    const gst = data ? (data.GSTPercentage !== undefined && data.GSTPercentage !== null ? Number(data.GSTPercentage) : defaultGstPercent) : defaultGstPercent;
    const rateWithGst = rate * (1 + gst / 100);
    const tot = data ? (Number(data.TotalPurchaseValue) || (qty * rate * (1 + gst / 100))) : 0;
    const savedTransport = data ? (data.TransportationCost !== undefined && data.TransportationCost !== null && data.TransportationCost !== '' ? Number(data.TransportationCost) : '') : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
    <td><input type="text"   class="form-control form-control-sm mat-name border-0 p-0 text-center" value="${data ? (data.ItemName || '') : ''}" placeholder="Item Name" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-qty  border-0 p-0 text-end" min="0" step="any" value="${qty || ''}" autocomplete="off"></td>
    <td><input type="text"   class="form-control form-control-sm mat-unit border-0 p-0 text-center" value="${data ? (data.Unit || '') : ''}" placeholder="Unit" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-rate border-0 p-0 text-end" min="0" step="any" value="${rate || ''}" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-total-without-gst border-0 p-0 text-end fw-semibold" min="0" step="any" value="${(qty && rate) ? round2(qty * rate) : ''}" placeholder="Total Price" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-gst border-0 p-0 text-end" min="0" max="100" step="any" value="${gst}" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-rate-with-gst border-0 p-0 text-end" min="0" step="any" value="${rateWithGst ? round2(rateWithGst) : ''}" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-total border-0 p-0 text-end fw-semibold" min="0" step="any" value="${tot ? round2(tot) : ''}" placeholder="Total" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-transport border-0 p-0 text-end fw-semibold" min="0" step="any" value="${savedTransport !== '' ? round2(savedTransport) : ''}" placeholder="0" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-transport-unit border-0 p-0 text-end fw-semibold" min="0" step="any" placeholder="0" readonly tabindex="-1" autocomplete="off"></td>
    <td><input type="number" class="form-control form-control-sm mat-msp border-0 p-0 text-end fw-semibold" min="0" step="any" placeholder="Auto" readonly tabindex="-1" autocomplete="off"></td>
    <td class="text-center"><span class="text-danger fw-bold" style="cursor:pointer; font-size:0.9rem;" onclick="removeMaterialRowInline(this)">✕</span></td>
  `;

    tbody.appendChild(tr);

    const qtyEl = tr.querySelector('.mat-qty');
    const rateEl = tr.querySelector('.mat-rate');
    const gstEl = tr.querySelector('.mat-gst');
    const rateWithGstEl = tr.querySelector('.mat-rate-with-gst');
    const totalEl = tr.querySelector('.mat-total');
    const nameEl = tr.querySelector('.mat-name');
    const totalWithoutGstEl = tr.querySelector('.mat-total-without-gst');
    const unitEl = tr.querySelector('.mat-unit');

    const matTransportEl = tr.querySelector('.mat-transport');
    if (matTransportEl) {
        if (data && data.TransportationCost !== undefined && data.TransportationCost !== null && data.TransportationCost !== '') {
            matTransportEl.dataset.loadedFromDb = 'true';
        }
        matTransportEl.addEventListener('input', () => {
            delete matTransportEl.dataset.lastVal;
            delete matTransportEl.dataset.loadedFromDb;
            if (matTransportEl.value.trim() === '') {
                delete matTransportEl.dataset.userEdited;
                delete matTransportEl.dataset.lastEditedTime;
            } else {
                matTransportEl.dataset.userEdited = 'true';
                matTransportEl.dataset.lastEditedTime = String(Date.now());

                const allTransportEls = Array.from(document.querySelectorAll('#editMaterialsTbody .mat-transport'));
                const editedEls = allTransportEls.filter(el => el.dataset.userEdited === 'true');
                if (editedEls.length === allTransportEls.length && allTransportEls.length > 1) {
                    editedEls.sort((a, b) => Number(a.dataset.lastEditedTime || 0) - Number(b.dataset.lastEditedTime || 0));
                    delete editedEls[0].dataset.userEdited;
                    delete editedEls[0].dataset.lastEditedTime;
                }
            }
            recalcInlineForm();
        });
    }

    function onQtyInput() {
        const q = Number(qtyEl.value) || 0;
        const r = Number(rateEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const rg = Number(rateWithGstEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;
        const t = Number(totalEl.value) || 0;

        if (q > 0) {
            if (r > 0) {
                totalWithoutGstEl.value = round2(q * r);
                const computedRg = r * (1 + g / 100);
                rateWithGstEl.value = round2(computedRg);
                totalEl.value = round2(q * computedRg);
            } else if (twg > 0) {
                const computedR = twg / q;
                rateEl.value = round2(computedR);
                const computedRg = computedR * (1 + g / 100);
                rateWithGstEl.value = round2(computedRg);
                totalEl.value = round2(q * computedRg);
            } else if (t > 0) {
                const computedRg = t / q;
                rateWithGstEl.value = round2(computedRg);
                const computedR = computedRg / (1 + g / 100);
                rateEl.value = round2(computedR);
                totalWithoutGstEl.value = round2(q * computedR);
            } else if (rg > 0) {
                totalEl.value = round2(q * rg);
                const computedR = rg / (1 + g / 100);
                rateEl.value = round2(computedR);
                totalWithoutGstEl.value = round2(q * computedR);
            }
        }
        recalcInlineForm();
    }

    function onRateInput() {
        const q = Number(qtyEl.value) || 0;
        const r = Number(rateEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;
        const t = Number(totalEl.value) || 0;

        if (r > 0) {
            const rg = r * (1 + g / 100);
            rateWithGstEl.value = round2(rg);
            if (q > 0) {
                totalWithoutGstEl.value = round2(q * r);
                totalEl.value = round2(q * rg);
            } else if (twg > 0) {
                const computedQ = twg / r;
                qtyEl.value = round2(computedQ);
                totalEl.value = round2(computedQ * rg);
            } else if (t > 0) {
                const computedQ = t / rg;
                qtyEl.value = round2(computedQ);
                totalWithoutGstEl.value = round2(computedQ * r);
            }
        }
        recalcInlineForm();
    }

    function onGstInput() {
        const q = Number(qtyEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const r = Number(rateEl.value) || 0;
        const rg = Number(rateWithGstEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;

        if (r > 0) {
            const computedRg = r * (1 + g / 100);
            rateWithGstEl.value = round2(computedRg);
            if (q > 0) {
                totalEl.value = round2(q * computedRg);
            } else if (twg > 0) {
                totalEl.value = round2(twg * (1 + g / 100));
            }
        } else if (rg > 0) {
            const computedR = rg / (1 + g / 100);
            rateEl.value = round2(computedR);
            if (q > 0) {
                totalWithoutGstEl.value = round2(q * computedR);
                totalEl.value = round2(q * rg);
            }
        }
        recalcInlineForm();
    }

    function onRateWithGstInput() {
        const q = Number(qtyEl.value) || 0;
        const rg = Number(rateWithGstEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;
        const t = Number(totalEl.value) || 0;

        if (rg > 0) {
            const computedR = rg / (1 + g / 100);
            rateEl.value = round2(computedR);
            if (q > 0) {
                totalWithoutGstEl.value = round2(q * computedR);
                totalEl.value = round2(q * rg);
            } else if (twg > 0) {
                const computedQ = twg / computedR;
                qtyEl.value = round2(computedQ);
                totalEl.value = round2(computedQ * rg);
            } else if (t > 0) {
                const computedQ = t / rg;
                qtyEl.value = round2(computedQ);
                totalWithoutGstEl.value = round2(computedQ * computedR);
            }
        }
        recalcInlineForm();
    }

    function onTotalInput() {
        const q = Number(qtyEl.value) || 0;
        const t = Number(totalEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const rg = Number(rateWithGstEl.value) || 0;
        const r = Number(rateEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;

        if (t > 0) {
            const computedTwg = t / (1 + g / 100);
            totalWithoutGstEl.value = round2(computedTwg);

            if (q > 0) {
                const computedRg = t / q;
                rateWithGstEl.value = round2(computedRg);
                const computedR = computedRg / (1 + g / 100);
                rateEl.value = round2(computedR);
            } else if (twg > 0) {
                const computedQ = t / (twg * (1 + g / 100));
                qtyEl.value = round2(computedQ);
                const computedR = twg / computedQ;
                rateEl.value = round2(computedR);
            } else if (r > 0) {
                const computedQ = computedTwg / r;
                qtyEl.value = round2(computedQ);
                const computedRg = r * (1 + g / 100);
                rateWithGstEl.value = round2(computedRg);
            }
        }
        recalcInlineForm();
    }

    function onTotalWithoutGstInput() {
        const q = Number(qtyEl.value) || 0;
        const twg = Number(totalWithoutGstEl.value) || 0;
        const g = Number(gstEl.value) || 0;
        const r = Number(rateEl.value) || 0;

        if (twg > 0) {
            const computedT = twg * (1 + g / 100);
            totalEl.value = round2(computedT);

            if (q > 0) {
                const computedR = twg / q;
                rateEl.value = round2(computedR);
                rateWithGstEl.value = round2(computedR * (1 + g / 100));
            } else if (r > 0) {
                const computedQ = twg / r;
                qtyEl.value = round2(computedQ);
                rateWithGstEl.value = round2(r * (1 + g / 100));
            }
        }
        recalcInlineForm();
    }

    qtyEl.addEventListener('input', onQtyInput);
    rateEl.addEventListener('input', onRateInput);
    gstEl.addEventListener('input', onGstInput);
    rateWithGstEl.addEventListener('input', onRateWithGstInput);
    totalEl.addEventListener('input', onTotalInput);
    totalWithoutGstEl.addEventListener('input', onTotalWithoutGstInput);

    nameEl.addEventListener('input', () => {
        const val = nameEl.value.trim();
        if (!val) return;
        const items = DB.getAll('items');
        const matched = items.find(i => i.ItemName.toLowerCase() === val.toLowerCase());
        if (matched) {
            if (matched.Unit) unitEl.value = matched.Unit;
            if (matched.GSTPercent !== undefined && matched.GSTPercent !== null && matched.GSTPercent !== '') {
                gstEl.value = matched.GSTPercent;
            }
            onGstInput();
        }
    });

    recalcInlineForm();
}

window.removeMaterialRowInline = function (btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
    recalcInlineForm();
};

window.addMaterialRowInline = function () {
    createMaterialRow(null, 18);
};

function recalcInlineForm() {
    let transportCost = Number(document.getElementById('editTransportationCost').value) || 0;
    const addToMaterialCostChk = document.getElementById('editAddToMaterialCost');
    const isAddToMaterialCost = addToMaterialCostChk ? addToMaterialCostChk.checked : true;
    const rows = document.querySelectorAll('#editMaterialsTbody tr');

    if (!isAddToMaterialCost) {
        rows.forEach(row => {
            const transportEl = row.querySelector('.mat-transport');
            const transportUnitEl = row.querySelector('.mat-transport-unit');
            const mspEl = row.querySelector('.mat-msp');
            const rate = Number(row.querySelector('.mat-rate')?.value) || 0;

            if (transportEl) {
                if (Number(transportEl.value) > 0) {
                    transportEl.dataset.lastVal = transportEl.value;
                }
                transportEl.value = 0;
                transportEl.disabled = true;
            }
            if (transportUnitEl) transportUnitEl.value = 0;
            if (mspEl) {
                const autoMsp = Calc.round2(rate);
                mspEl.value = autoMsp > 0 ? autoMsp : '';
            }
        });

        const rawMaterials = readMaterialsFromInlineForm();
        const materialsNoTransport = rawMaterials.map(m => ({ ...m, TransportationCost: 0 }));
        const result = Calc.computeShipment(materialsNoTransport, transportCost, 0);

        const lblSubtotal = document.getElementById('lblMaterialsSubtotal');
        const lblGST = document.getElementById('lblGstAmount');
        const lblTransport = document.getElementById('lblTransportCost');
        const lblGrand = document.getElementById('lblGrandTotal');

        if (lblSubtotal) lblSubtotal.textContent = UI.money(result.purchaseTotal);
        if (lblGST) lblGST.textContent = UI.money(result.gstAmount);
        if (lblTransport) lblTransport.textContent = UI.money(result.transport);
        if (lblGrand) lblGrand.textContent = UI.money(result.grandTotal);
        return;
    }

    // 1. Enable transportEl fields when checked & restore lastVal if present
    rows.forEach(row => {
        const transportEl = row.querySelector('.mat-transport');
        if (transportEl) {
            transportEl.disabled = false;
            if (transportEl.dataset.lastVal) {
                transportEl.value = transportEl.dataset.lastVal;
                delete transportEl.dataset.lastVal;
            }
        }
    });

    // 2. Calculate sum of user-edited transport costs on material rows
    let sumUserEditedTransport = 0;
    let hasUserEditedTransport = false;

    rows.forEach(row => {
        const tEl = row.querySelector('.mat-transport');
        if (tEl && tEl.dataset.userEdited === 'true' && tEl.value.trim() !== '') {
            sumUserEditedTransport += Number(tEl.value) || 0;
            hasUserEditedTransport = true;
        }
    });

    if (!hasUserEditedTransport) {
        let sumLoadedTransport = 0;
        let loadedCount = 0;

        rows.forEach(row => {
            const tEl = row.querySelector('.mat-transport');
            if (tEl && tEl.dataset.loadedFromDb === 'true') {
                sumLoadedTransport += Number(tEl.value) || 0;
                loadedCount++;
            }
        });

        // Consider DB loaded values valid only if all rows were loaded, sum > 0, and sum matches shipment transportCost
        const hasValidDbLoaded = (loadedCount === rows.length) && (sumLoadedTransport > 0) && (Calc.round2(sumLoadedTransport) === Calc.round2(transportCost));

        if (!hasValidDbLoaded) {
            let sumAllTotals = 0;
            rows.forEach(row => {
                sumAllTotals += Number(row.querySelector('.mat-total')?.value) || 0;
            });

            rows.forEach(row => {
                const tEl = row.querySelector('.mat-transport');
                const totWithGst = Number(row.querySelector('.mat-total')?.value) || 0;
                let share = 0;
                if (sumAllTotals > 0 && transportCost > 0) {
                    share = Calc.round2((totWithGst / sumAllTotals) * transportCost);
                } else if (transportCost > 0 && rows.length > 0) {
                    share = Calc.round2(transportCost / rows.length);
                }
                if (tEl) tEl.value = share;
            });
        }
    } else {
        let remTransportCost = Math.max(0, transportCost - sumUserEditedTransport);
        let sumUneditedTotals = 0;
        let uneditedCount = 0;

        rows.forEach(row => {
            const tEl = row.querySelector('.mat-transport');
            if (!tEl || tEl.dataset.userEdited !== 'true' || tEl.value.trim() === '') {
                sumUneditedTotals += Number(row.querySelector('.mat-total')?.value) || 0;
                uneditedCount++;
            }
        });

        rows.forEach(row => {
            const tEl = row.querySelector('.mat-transport');
            if (!tEl || tEl.dataset.userEdited !== 'true' || tEl.value.trim() === '') {
                const totWithGst = Number(row.querySelector('.mat-total')?.value) || 0;
                let share = 0;
                if (sumUneditedTotals > 0 && remTransportCost > 0) {
                    share = Calc.round2((totWithGst / sumUneditedTotals) * remTransportCost);
                } else if (remTransportCost > 0 && uneditedCount > 0) {
                    share = Calc.round2(remTransportCost / uneditedCount);
                } else {
                    share = 0;
                }
                if (tEl) tEl.value = share;
            }
        });
    }

    // 4. Process each row to update TRANS./UNIT, MSP/UNIT, and summary labels
    rows.forEach(row => {
        const transportEl = row.querySelector('.mat-transport');
        const transportUnitEl = row.querySelector('.mat-transport-unit');
        const mspEl = row.querySelector('.mat-msp');

        const q = Number(row.querySelector('.mat-qty')?.value) || 0;
        const rate = Number(row.querySelector('.mat-rate')?.value) || 0;
        const transportShare = transportEl ? (Number(transportEl.value) || 0) : 0;

        let transportPerUnit = 0;
        if (q > 0) {
            transportPerUnit = Calc.round2(transportShare / q);
        }
        if (transportUnitEl) transportUnitEl.value = transportPerUnit ? transportPerUnit : 0;

        if (mspEl) {
            const autoMsp = Calc.round2(rate + transportPerUnit);
            mspEl.value = autoMsp > 0 ? autoMsp : '';
        }
    });

    // 5. Read updated materials AFTER fields are populated
    const materials = readMaterialsFromInlineForm();
    const result = Calc.computeShipment(materials, transportCost, 0);

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
    const items = DB.getAll('items');
    return Array.from(rows).map(row => {
        const itemName = row.querySelector('.mat-name')?.value?.trim() || '';
        const matched = items.find(i => i.ItemName && i.ItemName.toLowerCase() === itemName.toLowerCase());
        const category = matched ? (matched.Category || '') : '';

        const qty = Number(row.querySelector('.mat-qty')?.value) || 0;
        const rate = Number(row.querySelector('.mat-rate')?.value) || 0;
        const gst = Number(row.querySelector('.mat-gst')?.value) || 0;
        const total = Number(row.querySelector('.mat-total')?.value) || 0;
        const transport = Number(row.querySelector('.mat-transport')?.value) || 0;
        const unit = row.querySelector('.mat-unit')?.value?.trim() || '';
        return {
            ItemName: itemName,
            Category: category,
            Quantity: qty,
            Unit: unit,
            PurchaseRate: rate,
            GSTPercentage: gst,
            TotalPurchaseValue: total,
            TransportationCost: transport
        };
    }).filter(m => m.ItemName);
}

function makeTableResizable(table) {
    if (!table) return;
    const cols = table.querySelectorAll('thead th');
    cols.forEach(col => {
        if (col.querySelector('.resizer')) return;

        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        col.appendChild(resizer);

        let x = 0;
        let w = 0;

        const mouseMoveHandler = function (e) {
            const dx = e.clientX - x;
            const newWidth = Math.max(35, w + dx);
            col.style.width = `${newWidth}px`;
            col.style.minWidth = `${newWidth}px`;
        };

        const mouseUpHandler = function () {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', function (e) {
            x = e.clientX;
            w = col.offsetWidth || parseInt(window.getComputedStyle(col).width, 10) || 80;

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });
}

let modalListenersConfigured = false;
function setupModalListenersOnce() {
    if (modalListenersConfigured) return;
    modalListenersConfigured = true;

    const shipModalEl = document.getElementById('shipmentFormModal');
    if (shipModalEl) {
        shipModalEl.addEventListener('shown.bs.modal', () => {
            makeTableResizable(document.getElementById('editMaterialsTable'));
        });
    }

    // Make materials table columns resizable
    makeTableResizable(document.getElementById('editMaterialsTable'));

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

    const chkAddMat = document.getElementById('editAddToMaterialCost');
    if (chkAddMat) {
        chkAddMat.addEventListener('change', () => {
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

window.addInlineRow = function () {
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

    if (document.getElementById('editVendorPaid')) document.getElementById('editVendorPaid').value = 0;
    document.getElementById('editTransportationCost').value = 0;
    if (document.getElementById('editAddToMaterialCost')) document.getElementById('editAddToMaterialCost').checked = true;
    if (document.getElementById('editTransportPaid')) document.getElementById('editTransportPaid').value = 0;
    document.getElementById('editRemarks').value = '';

    setupModalListenersOnce();
    renderUploadedDocsList();

    const matTbody = document.getElementById('editMaterialsTbody');
    if (matTbody) {
        matTbody.innerHTML = '';
        createMaterialRow(null, 18);
    }

    recalcInlineForm();

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('shipmentFormModal'));
    modal.show();
};

window.editRow = function (shipmentNo) {
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

    if (document.getElementById('editVendorPaid')) document.getElementById('editVendorPaid').value = s.VendorPaid || 0;
    document.getElementById('editTransportationCost').value = s.TransportationCost || 0;
    if (document.getElementById('editAddToMaterialCost')) {
        document.getElementById('editAddToMaterialCost').checked = s.AddToMaterialCost !== undefined && s.AddToMaterialCost !== null ? (s.AddToMaterialCost == 1 || s.AddToMaterialCost === true) : true;
    }
    if (document.getElementById('editTransportPaid')) document.getElementById('editTransportPaid').value = s.TransportPaid || 0;
    document.getElementById('editRemarks').value = s.Remarks || '';

    setupModalListenersOnce();
    renderUploadedDocsList();

    const editMats = DB.getAll('materials').filter(m => m.ShipmentNo === shipmentNo);
    const matTbody = document.getElementById('editMaterialsTbody');
    if (matTbody) {
        matTbody.innerHTML = '';
        if (editMats.length) {
            editMats.forEach(m => createMaterialRow(m, s.GSTPercentage || 18));
        } else {
            createMaterialRow(null, s.GSTPercentage || 18);
        }
    }

    recalcInlineForm();

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('shipmentFormModal'));
    modal.show();
};

window.cancelInline = function () {
    editingShipmentNo = null;
    isAddingNew = false;
    pendingFiles = [];
    currentDocs = [];

    const modalEl = document.getElementById('shipmentFormModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    renderList();
};

window.saveInline = async function (shipmentNo) {
    if (!shipmentNo) shipmentNo = editingShipmentNo;
    if (!shipmentNo) {
        UI.toast('Error: Missing shipment number.', 'danger');
        return;
    }

    const existingShipment = DB.getAll('shipments').find(s => s.ShipmentNo === shipmentNo);
    const isEdit = !isAddingNew || !!existingShipment;
    const purchaseDate = document.getElementById('editPurchaseDate').value;
    const vendorName = document.getElementById('editVendorName').value.trim();
    const shipmentType = document.getElementById('editShipmentType').value;

    const transportationCost = document.getElementById('editTransportationCost').value;
    const elVendorPaid = document.getElementById('editVendorPaid');
    const elTransportPaid = document.getElementById('editTransportPaid');
    const vendorPaid = elVendorPaid ? elVendorPaid.value : (existingShipment?.VendorPaid || 0);
    const transportPaid = elTransportPaid ? elTransportPaid.value : (existingShipment?.TransportPaid || 0);

    const vehicleNumber = document.getElementById('editVehicleNumber').value.trim();
    const invoiceNumber = document.getElementById('editInvoiceNumber').value.trim();
    const remarks = document.getElementById('editRemarks').value.trim();

    // Ensure inline calculations are fresh before reading form data
    recalcInlineForm();

    const materials = readMaterialsFromInlineForm();

    const rules = [
        [Validate.required, purchaseDate, 'Purchase Date'],
        [Validate.required, vendorName, 'Vendor Name'],
    ];

    const errors = Validate.run(rules);
    if (!materials.length) errors.push('Add at least one item with a name.');
    materials.forEach((m, i) => {
        if (!(Number(m.Quantity) > 0)) errors.push(`Item #${i + 1}: Quantity must be greater than 0.`);
        const hasPrice = (Number(m.TotalPurchaseValue) > 0) || (Number(m.PurchaseRate) >= 0);
        if (!hasPrice) errors.push(`Item #${i + 1}: Enter a Rate or Total Price.`);
        if (m.GSTPercentage < 0 || m.GSTPercentage > 100) errors.push(`Item #${i + 1}: GST % must be between 0 and 100.`);
    });

    if (errors.length) {
        UI.toast(errors[0], 'danger');
        return;
    }

    // Compute effective/average GST percentage for the shipment record
    const subtotal = materials.reduce((sum, m) => sum + (Number(m.Quantity) * Number(m.PurchaseRate)), 0);
    const gstTotal = materials.reduce((sum, m) => sum + ((Number(m.Quantity) * Number(m.PurchaseRate)) * (Number(m.GSTPercentage) || 0) / 100), 0);
    const effectiveGstPct = subtotal > 0 ? Calc.round2((gstTotal / subtotal) * 100) : 0;

    UI.showLoading(true);
    try {
        // Upload pending files
        for (const file of pendingFiles) {
            await DB.saveDocumentFile(shipmentNo, file.name, file.blob);
        }

        const docNames = currentDocs.concat(pendingFiles.map(f => f.name)).join(',');
        pendingFiles = [];
        currentDocs = [];

        const elAddToMaterialCost = document.getElementById('editAddToMaterialCost');
        const addToMaterialCostVal = elAddToMaterialCost ? (elAddToMaterialCost.checked ? 1 : 0) : 1;

        const shipmentRow = {
            ShipmentNo: shipmentNo,
            PurchaseDate: purchaseDate,
            VendorName: vendorName,
            ShipmentType: shipmentType,
            VehicleNumber: vehicleNumber,
            InvoiceNumber: invoiceNumber,
            TransportationCost: Number(transportationCost),
            GSTPercentage: Number(effectiveGstPct),
            VendorPaid: Number(vendorPaid),
            TransportPaid: Number(transportPaid),
            Documents: docNames,
            Remarks: remarks,
            AddToMaterialCost: addToMaterialCostVal,
            CreatedAt: isEdit ? (existingShipment?.CreatedAt || new Date().toISOString()) : new Date().toISOString(),
        };

        const exists = DB.getAll('shipments').some(s => s.ShipmentNo === shipmentNo);
        if (exists) {
            await DB.update('shipments', s => s.ShipmentNo === shipmentNo, shipmentRow);
        } else {
            await DB.insert('shipments', shipmentRow);
        }

        // Replace all material rows for this shipment
        const allMaterials = DB.getAll('materials').filter(m => m.ShipmentNo !== shipmentNo);
        const newRows = materials.map(m => {
            const transportShareVal = addToMaterialCostVal === 1
                ? (m.TransportationCost !== undefined && m.TransportationCost !== null && m.TransportationCost !== '' ? Number(m.TransportationCost) : 0)
                : 0;

            return {
                RowID: Utils.uid('MAT'),
                ShipmentNo: shipmentNo,
                ItemName: m.ItemName,
                Category: m.Category,
                Quantity: m.Quantity,
                Unit: m.Unit,
                PurchaseRate: m.PurchaseRate,
                TotalPurchaseValue: m.TotalPurchaseValue || Calc.round2(m.Quantity * m.PurchaseRate * (1 + (m.GSTPercentage || 0) / 100)),
                GSTPercentage: m.GSTPercentage,
                TransportationCost: transportShareVal,
            };
        });
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

window.previewDocRow = function (shipmentNo, docName) {
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

window.showDocsModal = function (shipmentNo) {
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

window.showVendorPaymentDetails = function (shipmentNo) {
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

    if (header) header.style.background = 'linear-gradient(135deg, #10b981, #059669)';

    if (shipmentNo === 'TOTAL') {
        if (composeBar) composeBar.style.display = 'none';
        if (titleEl) titleEl.textContent = 'Grand Total Vendor Payments';
        if (subEl) subEl.textContent = 'All Vendors & Shipments Summary';

        const shipments = getEnrichedShipments();
        let sumVendorDue = 0;
        let sumVendorPaid = 0;
        const unpaidShipments = [];

        shipments.forEach(s => {
            const due = s.purchaseTotal;
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
        <div class="d-flex justify-content-between border-bottom pb-2 text-primary fw-bold"><span>Total Invoice Due (incl. GST):</span> <span>${UI.money(sumVendorDue)}</span></div>
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

        const vendorDue = r.purchaseTotal;
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
          <div class="bubble-remarks">Materials (incl. GST): ${UI.money(r.purchaseTotal)} (GST component: ${UI.money(r.gstAmount)}) ${r.InvoiceNumber ? '(Inv: ' + r.InvoiceNumber + ')' : ''}</div>
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

window.showTransportPaymentDetails = function (shipmentNo) {
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

    if (header) header.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';

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

window.deletePaymentLog = async function (remarkId) {
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
        const due = s.purchaseTotal;
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

window.showShipmentNotes = function (shipmentNo) {
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

window.deleteShipmentNote = async function (remarkId) {
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

window.showItemPriceBreakup = function (shipmentNo, lineIndex) {
    const shipments = getEnrichedShipments(true);
    const r = shipments.find(s => s.ShipmentNo === shipmentNo);
    if (!r || !r.lines || !r.lines[lineIndex]) return;

    const l = r.lines[lineIndex];
    const unitSuffix = l.Unit ? ' ' + l.Unit.trim() : '';

    document.getElementById('itemBreakupModalLabel').textContent = `Cost Breakdown — ${l.ItemName}`;

    const gstPerUnit = Calc.round2(l.PurchaseRate * ((l.GSTPercentage || 0) / 100));
    const totalPricePerUnit = Calc.round2(l.PurchaseRate * (1 + (l.GSTPercentage || 0) / 100));
    const transportPerUnit = l.Quantity > 0 ? Calc.round2(l.TransportShare / l.Quantity) : 0;
    const effectiveCostPerUnit = l.CostPerUnit || Calc.round2(totalPricePerUnit + transportPerUnit);

    const mspVal = UI.money(Calc.round2((Number(l.PurchaseRate) || 0) + transportPerUnit));

    const bodyEl = document.getElementById('itemBreakupModalBody');
    if (bodyEl) {
        bodyEl.innerHTML = `
      <div class="card border-0 shadow-sm rounded-3 p-3 bg-white">
        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
          <span class="fw-bold text-dark fs-6">${l.ItemName}</span>
          <span class="badge bg-primary-subtle text-primary-emphasis font-monospace fs-7">Qty: ${l.Quantity}${unitSuffix}</span>
        </div>
        <div class="d-flex flex-column gap-2 fs-7 font-monospace">
          <div class="d-flex justify-content-between">
            <span class="text-secondary">Base Rate / Unit:</span>
            <span class="fw-semibold text-dark">${UI.money(l.PurchaseRate)}</span>
          </div>
          <div class="d-flex justify-content-between">
            <span class="text-secondary">GST (${l.GSTPercentage}% / Unit):</span>
            <span class="fw-semibold text-dark">${UI.money(gstPerUnit)}</span>
          </div>
          <div class="d-flex justify-content-between border-top pt-1">
            <span class="text-secondary">Total Price per Unit:</span>
            <span class="fw-semibold text-dark">${UI.money(totalPricePerUnit)}</span>
          </div>
          <div class="d-flex justify-content-between">
            <span class="text-secondary">Transportation Share / Unit:</span>
            <span class="fw-semibold text-dark">${UI.money(transportPerUnit)}</span>
          </div>
          <div class="d-flex justify-content-between border-top pt-1 text-success fw-bold fs-6">
            <span>Effective Cost / Unit:</span>
            <span>${UI.money(effectiveCostPerUnit)}</span>
          </div>
          ${mspVal !== '—' ? `
          <div class="d-flex justify-content-between border-top pt-1 text-secondary">
            <span>Min Selling Price (MSP/Unit):</span>
            <span class="fw-bold text-success">${mspVal}</span>
          </div>` : ''}
        </div>
      </div>
    `;
    }

    const modalEl = document.getElementById('itemBreakupModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
};

/* =========================================================================
   Price History & Tracker Floating Draggable Popup Module
   ========================================================================= */

/* =========================================================================
   Price History & Tracker Floating Draggable Popup Module
   ========================================================================= */

const SECTION_PRICE_ITEMS = {
    sec1: [
        { name: 'Panel', defaultUnit: 'Pc' },
        { name: 'Inverter', defaultUnit: 'Pc' },
        { name: 'Mounting Structure', defaultUnit: 'Set' },
        { name: 'ACDB', defaultUnit: 'Pc' },
        { name: 'DCDB', defaultUnit: 'Pc' },
        { name: 'Earthing System', defaultUnit: 'Set' },
    ],
    sec2: [
        { name: 'AC Cable', defaultUnit: 'Meter' },
        { name: 'DC Cable', defaultUnit: 'Meter' },
        { name: 'Earthing Cable', defaultUnit: 'Meter' },
    ],
    sec3: [
        { name: 'Anchor bolt', defaultUnit: 'Pc' },
        { name: 'MC4 Connector', defaultUnit: 'Pair' },
        { name: 'Mid, End Clamp with SS U bolt', defaultUnit: 'Set' },
    ],
    sec4: [
        { name: 'Cable Tray', defaultUnit: 'Meter' },
        { name: 'Cable Tie', defaultUnit: 'Pkt' },
        { name: 'Conduct Pipe', defaultUnit: 'Meter' },
        { name: 'Tee', defaultUnit: 'Pc' },
        { name: 'Bend', defaultUnit: 'Pc' },
        { name: 'Flexible', defaultUnit: 'Meter' },
        { name: 'C-Clip & Gripping', defaultUnit: 'Pc' },
        { name: 'Insulation tape', defaultUnit: 'Pc' },
    ]
};

let isPhDraggableInitialized = false;

window.togglePriceHistoryPopup = function (show) {
    const popup = document.getElementById('priceHistoryPopup');
    if (!popup) return;

    if (show === undefined) {
        show = popup.style.display === 'none' || popup.style.display === '' || window.getComputedStyle(popup).display === 'none';
    }

    if (show) {
        popup.style.display = 'block';
        popup.style.zIndex = '1060';
        const phDate = document.getElementById('phDate');
        if (phDate && !phDate.value) phDate.value = UI.todayISO();

        if (!isPhDraggableInitialized) {
            isPhDraggableInitialized = true;
            makeElementDraggable(popup, document.getElementById('priceHistoryHeader'));
        }
        renderPhAllItemsTable();
        renderPriceHistoryList();
    } else {
        popup.style.display = 'none';
    }
};

window.togglePhSection = function (secKey) {
    const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
    const body = document.getElementById(`secBody${secSuffix}`);
    const icon = document.getElementById(`phIcon${secSuffix}`);
    if (!body) return;
    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        body.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
};

window.renderPhSecRows = function (secKey, addNewRow = false) {
    const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
    const tbody = document.getElementById(`tbodyPh${secSuffix}`);
    const chk = document.getElementById(`chkMerge${secSuffix}`);

    if (!tbody) return;

    const isMerged = chk && chk.checked;

    // Read current state from existing DOM rows
    const existingRows = Array.from(tbody.querySelectorAll('tr[data-item-name]'));
    const rowsData = [];
    let prevMergedVal = 0;

    if (existingRows.length > 0) {
        existingRows.forEach((tr) => {
            const nameInput = tr.querySelector('.ph-row-name');
            const itemName = nameInput ? nameInput.value : tr.getAttribute('data-item-name');
            const defaultUnit = tr.getAttribute('data-default-unit') || 'Pc';
            const qty = tr.querySelector('.ph-row-qty')?.value || 1;
            const price = tr.querySelector('.ph-row-price')?.value || '';
            const mergedInput = tr.querySelector('.ph-sec-merged-price');
            if (mergedInput) prevMergedVal = Number(mergedInput.value) || 0;

            rowsData.push({ name: itemName, defaultUnit, qty, price });
        });
    } else {
        const items = SECTION_PRICE_ITEMS[secKey] || [];
        items.forEach(it => {
            rowsData.push({ name: it.name, defaultUnit: it.defaultUnit || 'Pc', qty: 1, price: '' });
        });
    }

    if (addNewRow) {
        rowsData.push({ name: '', defaultUnit: 'Pc', qty: 1, price: '' });
    }

    if (!rowsData.length) {
        tbody.innerHTML = '';
        return;
    }

    // Calculate initial merged price value if turning on merge
    let displayMergedPrice = prevMergedVal;
    if (isMerged && displayMergedPrice === 0) {
        let sum = 0;
        rowsData.forEach(r => { sum += Number(r.price) || 0; });
        displayMergedPrice = sum > 0 ? sum : '';
    }

    tbody.innerHTML = rowsData.map((r, idx) => {
        let priceColHtml = '';
        if (!isMerged) {
            priceColHtml = `
              <td class="p-1 align-middle" style="width:125px;">
                <input type="number" min="0" step="any" class="form-control form-control-sm ph-row-price text-end font-monospace p-1" value="${r.price}" placeholder="0.00" style="font-size:0.75rem;" oninput="recalcPhSummary()">
              </td>
            `;
        } else if (idx === 0) {
            priceColHtml = `
              <td rowspan="${rowsData.length}" class="p-1 align-middle text-end" style="width:125px; background:#fffdf5; border:1px solid #fde68a;">
                <input type="number" min="0" step="any" class="form-control form-control-sm ph-sec-merged-price text-end font-monospace p-1 fw-bold text-success" value="${displayMergedPrice}" placeholder="Section Total ₹" style="font-size:0.75rem;" oninput="recalcPhSummary()">
              </td>
            `;
        } else {
            priceColHtml = '';
        }

        return `
          <tr data-item-name="${r.name}" data-default-unit="${r.defaultUnit}">
            <td class="p-1 align-middle">
              <input type="text" class="form-control form-control-sm ph-row-name fw-bold text-dark p-1" value="${r.name}" placeholder="Item Name..." style="font-size:0.75rem;" oninput="this.closest('tr').setAttribute('data-item-name', this.value.trim())">
            </td>
            <td class="p-1 text-center align-middle" style="width:65px;">
              <input type="number" min="0.01" step="any" class="form-control form-control-sm ph-row-qty text-center p-1" value="${r.qty}" style="font-size:0.75rem;" oninput="recalcPhSummary()">
            </td>
            ${priceColHtml}
            <td class="p-1 text-center align-middle" style="width:28px;">
              <button type="button" class="btn btn-xs text-danger p-0 border-0 fs-7 lh-1" onclick="removePhSectionRow(this, '${secKey}')" title="Remove item">✕</button>
            </td>
          </tr>
        `;
    }).join('');

    recalcPhSummary();
};

window.addPhSectionItem = function (secKey) {
    const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
    const tbody = document.getElementById(`tbodyPh${secSuffix}`);
    if (!tbody) return;

    const secBody = document.getElementById(`secBody${secSuffix}`);
    const secIcon = document.getElementById(`phIcon${secSuffix}`);
    if (secBody && secBody.style.display === 'none') {
        secBody.style.display = 'block';
        if (secIcon) secIcon.style.transform = 'rotate(0deg)';
    }

    renderPhSecRows(secKey, true);

    const newRowInput = tbody.querySelector('tr:last-child .ph-row-name');
    if (newRowInput) newRowInput.focus();
};

window.removePhSectionRow = function (btn, secKey) {
    const tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        renderPhSecRows(secKey, false);
    }
};

function renderPhAllItemsTable() {
    ['sec1', 'sec2', 'sec3', 'sec4'].forEach(secKey => {
        const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
        const tbody = document.getElementById(`tbodyPh${secSuffix}`);
        const chk = document.getElementById(`chkMerge${secSuffix}`);

        if (chk) chk.checked = false;
        if (!tbody) return;

        tbody.innerHTML = '';
        renderPhSecRows(secKey);
    });
}

window.togglePhSecMerge = function (secKey) {
    renderPhSecRows(secKey);
};

window.recalcPhSummary = function () {
    let subtotal = 0;

    ['sec1', 'sec2', 'sec3', 'sec4'].forEach(secKey => {
        const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
        const tbody = document.getElementById(`tbodyPh${secSuffix}`);
        const chk = document.getElementById(`chkMerge${secSuffix}`);

        if (!tbody) return;

        if (chk && chk.checked) {
            const mergedInput = tbody.querySelector('.ph-sec-merged-price');
            const mergedVal = Number(mergedInput?.value) || 0;
            subtotal += mergedVal;
        } else {
            const priceInputs = tbody.querySelectorAll('.ph-row-price');
            priceInputs.forEach(input => {
                subtotal += Number(input.value) || 0;
            });
        }
    });

    const gstPct = Number(document.getElementById('phGstPct')?.value) || 0;
    const grandTotal = Calc.round2(subtotal * (1 + gstPct / 100));

    const lblSubtotal = document.getElementById('lblPhSubtotal');
    const lblGrandTotal = document.getElementById('lblPhGrandTotal');

    if (lblSubtotal) lblSubtotal.textContent = UI.money(Calc.round2(subtotal));
    if (lblGrandTotal) lblGrandTotal.textContent = UI.money(grandTotal);
};

window.toggleEditPhMerge = function () {
    const chk = document.getElementById('chkEditPhMerge');
    const lumpInput = document.getElementById('editPhLumpInput');
    const tbody = document.getElementById('tbodyEditPhItems');

    if (!chk || !tbody) return;

    if (chk.checked) {
        if (lumpInput) {
            if (!lumpInput.value || Number(lumpInput.value) === 0) {
                let currentSum = 0;
                tbody.querySelectorAll('.edit-item-price').forEach(el => {
                    currentSum += Number(el.value) || 0;
                });
                if (currentSum > 0) lumpInput.value = Calc.round2(currentSum);
            }
            lumpInput.style.display = 'block';
            lumpInput.focus();
        }
        onEditPhLumpInput();
    } else {
        if (lumpInput) {
            lumpInput.style.display = 'none';
            lumpInput.value = '';
        }
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            const priceEl = tr.querySelector('.edit-item-price');
            if (priceEl) {
                priceEl.readOnly = false;
                priceEl.style.backgroundColor = '';
                priceEl.style.fontWeight = '';
            }
        });
        recalcEditPhSummary();
    }
};

window.onEditPhLumpInput = function () {
    const lumpInput = document.getElementById('editPhLumpInput');
    const tbody = document.getElementById('tbodyEditPhItems');

    if (!tbody || !lumpInput) return;

    const lumpVal = Number(lumpInput.value) || 0;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    if (!rows.length) return;

    const count = rows.length;
    const baseShare = Math.floor((lumpVal / count) * 100) / 100;
    const remainder = Calc.round2(lumpVal - (baseShare * count));

    rows.forEach((tr, i) => {
        const priceEl = tr.querySelector('.edit-item-price');
        if (priceEl) {
            const itemShare = (i === count - 1) ? Calc.round2(baseShare + remainder) : baseShare;
            priceEl.value = (lumpVal > 0 && itemShare > 0) ? itemShare : '';
            priceEl.readOnly = true;
            priceEl.style.backgroundColor = '#e0f2fe';
            priceEl.style.fontWeight = 'bold';
        }
    });

    recalcEditPhSummary();
};

function makeElementDraggable(elmnt, handleEl) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = handleEl || elmnt;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        if (e.target.classList.contains('btn-close')) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = Math.max(10, (elmnt.offsetTop - pos2)) + "px";
        elmnt.style.left = Math.max(10, (elmnt.offsetLeft - pos1)) + "px";
        elmnt.style.right = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

window.switchPriceHistoryTab = function (tab) {
    const tabAdd = document.getElementById('tabAddPrice');
    const tabHistory = document.getElementById('tabViewPriceHistory');
    const contentAdd = document.getElementById('priceTabContentAdd');
    const contentHistory = document.getElementById('priceTabContentHistory');

    if (tab === 'add') {
        if (tabAdd) tabAdd.classList.add('active');
        if (tabHistory) tabHistory.classList.remove('active');
        if (contentAdd) contentAdd.style.display = 'block';
        if (contentHistory) contentHistory.style.display = 'none';
    } else {
        if (tabHistory) tabHistory.classList.add('active');
        if (tabAdd) tabAdd.classList.remove('active');
        if (contentHistory) contentHistory.style.display = 'block';
        if (contentAdd) contentAdd.style.display = 'none';
        renderPriceHistoryList();
    }
};

window.savePriceRecord = async function () {
    const phDate = document.getElementById('phDate')?.value || UI.todayISO();
    const phNoteName = document.getElementById('phNoteName')?.value?.trim() || '';
    const phRemarks = document.getElementById('phRemarks')?.value?.trim() || '';
    const gstPct = Number(document.getElementById('phGstPct')?.value) || 0;

    const recordsToInsert = [];
    const batchId = Utils.uid('PHB');

    ['sec1', 'sec2', 'sec3', 'sec4'].forEach(secKey => {
        const secSuffix = secKey.charAt(0).toUpperCase() + secKey.slice(1);
        const tbody = document.getElementById(`tbodyPh${secSuffix}`);
        const chk = document.getElementById(`chkMerge${secSuffix}`);

        if (!tbody) return;

        const isMerged = chk && chk.checked;
        const trs = Array.from(tbody.querySelectorAll('tr[data-item-name]'));
        if (!trs.length) return;

        if (isMerged) {
            const mergedInput = tbody.querySelector('.ph-sec-merged-price');
            const mergedVal = Number(mergedInput?.value) || 0;

            if (mergedVal > 0) {
                const count = trs.length;
                const baseShare = Math.floor((mergedVal / count) * 100) / 100;
                const remainder = Calc.round2(mergedVal - (baseShare * count));

                trs.forEach((tr, i) => {
                    const nameInput = tr.querySelector('.ph-row-name');
                    const itemName = nameInput ? nameInput.value.trim() : tr.getAttribute('data-item-name');
                    if (!itemName) return;
                    const defaultUnit = tr.getAttribute('data-default-unit') || 'Pc';
                    const qty = Number(tr.querySelector('.ph-row-qty')?.value) || 1;
                    const priceNoGst = (i === count - 1) ? Calc.round2(baseShare + remainder) : baseShare;

                    const priceWithGst = Calc.round2(priceNoGst * (1 + gstPct / 100));
                    const rateNoGst = qty > 0 ? Calc.round2(priceNoGst / qty) : 0;
                    const rateWithGst = qty > 0 ? Calc.round2(priceWithGst / qty) : 0;

                    recordsToInsert.push({
                        RecordID: Utils.uid('PH'),
                        BatchID: batchId,
                        Date: phDate,
                        NoteName: phNoteName,
                        VendorName: phNoteName,
                        ItemName: itemName,
                        Quantity: qty,
                        Unit: defaultUnit,
                        TotalWithoutGst: priceNoGst,
                        TotalWithGst: priceWithGst,
                        RateWithoutGst: rateNoGst,
                        RateWithGst: rateWithGst,
                        Remarks: phRemarks ? `${phRemarks} (GST: ${gstPct}%)` : `GST: ${gstPct}%`,
                        CreatedAt: new Date().toISOString()
                    });
                });
            }
        } else {
            trs.forEach(tr => {
                const nameInput = tr.querySelector('.ph-row-name');
                const itemName = nameInput ? nameInput.value.trim() : tr.getAttribute('data-item-name');
                if (!itemName) return;
                const defaultUnit = tr.getAttribute('data-default-unit') || 'Pc';
                const qty = Number(tr.querySelector('.ph-row-qty')?.value) || 1;
                const priceNoGst = Number(tr.querySelector('.ph-row-price')?.value) || 0;

                if (priceNoGst > 0) {
                    const priceWithGst = Calc.round2(priceNoGst * (1 + gstPct / 100));
                    const rateNoGst = qty > 0 ? Calc.round2(priceNoGst / qty) : 0;
                    const rateWithGst = qty > 0 ? Calc.round2(priceWithGst / qty) : 0;

                    recordsToInsert.push({
                        RecordID: Utils.uid('PH'),
                        BatchID: batchId,
                        Date: phDate,
                        NoteName: phNoteName,
                        VendorName: phNoteName,
                        ItemName: itemName,
                        Quantity: qty,
                        Unit: defaultUnit,
                        TotalWithoutGst: priceNoGst,
                        TotalWithGst: priceWithGst,
                        RateWithoutGst: rateNoGst,
                        RateWithGst: rateWithGst,
                        Remarks: phRemarks ? `${phRemarks} (GST: ${gstPct}%)` : `GST: ${gstPct}%`,
                        CreatedAt: new Date().toISOString()
                    });
                }
            });
        }
    });

    if (!recordsToInsert.length) {
        UI.toast('Please enter a price for at least one item.', 'danger');
        return;
    }

    UI.showLoading(true);
    try {
        for (const rec of recordsToInsert) {
            await DB.insert('price_history', rec);
        }
        UI.toast(`Saved ${recordsToInsert.length} price record(s) successfully.`, 'success');

        const form = document.getElementById('formAddPriceRecord');
        if (form) form.reset();
        const noteNameEl = document.getElementById('phNoteName');
        if (noteNameEl) noteNameEl.value = '';
        const remEl = document.getElementById('phRemarks');
        if (remEl) remEl.value = '';
        const dateEl = document.getElementById('phDate');
        if (dateEl) dateEl.value = UI.todayISO();
        const gstEl = document.getElementById('phGstPct');
        if (gstEl) gstEl.value = 18;
        renderPhAllItemsTable();

        // Close popup if open
        const popupEl = document.getElementById('priceHistoryPopup');
        if (popupEl) {
            let bsModal = bootstrap.Modal.getInstance(popupEl);
            if (bsModal) bsModal.hide();
        }
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');

        renderPriceHistoryList();
        if (typeof switchMainTab === 'function') switchMainTab('PriceHistory');
    } catch (err) {
        UI.toast('Error saving price records: ' + err.message, 'danger');
    } finally {
        UI.showLoading(false);
    }
};

window.renderPriceHistoryList = function () {
    const container = document.getElementById('priceHistoryCardsContainer');
    const mainContainer = document.getElementById('mainPriceHistoryCardsContainer');
    if (!container && !mainContainer) return;

    const records = DB.getAll('price_history') || [];
    const popupSearch = (document.getElementById('phSearchInput')?.value || '').toLowerCase().trim();
    const mainSearch = (document.getElementById('mainPhSearchInput')?.value || '').toLowerCase().trim();
    const search = mainSearch || popupSearch;

    let filtered = records;
    if (search) {
        filtered = records.filter(r =>
            String(r.ItemName || '').toLowerCase().includes(search) ||
            String(r.NoteName || r.VendorName || '').toLowerCase().includes(search) ||
            String(r.Remarks || '').toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => new Date(b.Date || b.CreatedAt || 0) - new Date(a.Date || a.CreatedAt || 0));

    const emptyHtml = `<div class="text-center text-muted py-4 border rounded bg-light col-12">No price history records found.</div>`;

    if (!filtered.length) {
        if (container) container.innerHTML = emptyHtml;
        if (mainContainer) mainContainer.innerHTML = emptyHtml;
        return;
    }

    // Group items into batches
    const batchesMap = new Map();
    filtered.forEach(r => {
        const batchKey = r.BatchID || (r.Date + '_' + (r.NoteName || '') + '_' + (r.CreatedAt ? r.CreatedAt.slice(0, 19) : r.RecordID));
        if (!batchesMap.has(batchKey)) {
            let noteText = r.Remarks || '';
            let gstMatch = noteText.match(/\(GST:\s*([\d.]+)%\)/i);
            let cleanRemarks = noteText.replace(/\(GST:\s*[\d.]+%\)/gi, '').replace(/^GST:\s*[\d.]+\s*%/gi, '').trim();

            batchesMap.set(batchKey, {
                batchKey: batchKey,
                date: r.Date,
                noteName: r.NoteName || r.VendorName || '',
                remarks: noteText,
                cleanRemarks: cleanRemarks,
                gstPct: gstMatch ? Number(gstMatch[1]) : 18,
                items: []
            });
        }
        batchesMap.get(batchKey).items.push(r);
    });

    const cardListHtml = Array.from(batchesMap.values()).map(b => {
        const totalWithGst = b.items.reduce((sum, i) => sum + (Number(i.TotalWithGst) || 0), 0);

        return `
      <div class="card border-0 shadow-sm transition-all hover-shadow h-100 d-flex flex-column justify-content-between p-2.5 position-relative" 
           style="border-radius:12px; background:#fffdf5; border:1px solid #fde68a !important; cursor:pointer; min-height:165px;" 
           onclick="openEditPriceRecordModal('${b.batchKey}')">
        <div>
          <!-- Header: Date, Title & Action buttons -->
          <div class="d-flex justify-content-between align-items-start mb-2 pb-1.5 border-bottom" style="border-color:#fef08a !important;">
            <div style="max-width: 70%;">
              <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fs-8 font-monospace mb-1 d-inline-block">📅 ${UI.fmtDate(b.date)}</span>
              <h6 class="fw-bold text-dark fs-7 mb-0 text-truncate" title="${b.noteName || 'Price Record Note'}">📌 ${b.noteName || 'Price Record Note'}</h6>
            </div>
            <div class="d-flex align-items-center gap-1" onclick="event.stopPropagation()">
              <button type="button" class="btn btn-xs btn-outline-primary p-1 lh-1 rounded-circle" onclick="openEditPriceRecordModal('${b.batchKey}')" title="Edit this record" style="width:24px; height:24px;">✏️</button>
              <button type="button" class="btn btn-xs btn-outline-danger p-1 lh-1 rounded-circle" onclick="deletePriceRecordBatch('${b.batchKey}')" title="Delete this record" style="width:24px; height:24px;">🗑️</button>
            </div>
          </div>

          <!-- Items Preview -->
          <div class="mb-2">
            <span class="badge bg-white text-secondary border fs-8 font-monospace fw-semibold mb-1">📦 ${b.items.length} item(s)</span>
            <div class="fs-8 text-secondary lh-sm text-truncate" title="${b.items.map(i => i.ItemName).join(', ')}">
              ${b.items.slice(0, 3).map(i => `<span class="fw-semibold text-dark">${i.ItemName}</span>`).join(', ')}${b.items.length > 3 ? '...' : ''}
            </div>
          </div>

          <!-- Keep Note Remarks Box -->
          ${b.cleanRemarks ? `
            <div class="p-1.5 rounded mb-2 text-dark fs-8" style="background:#fff7ed; border:1px solid #fed7aa; max-height:48px; overflow:hidden; text-overflow:ellipsis;">
              <span class="fw-bold text-amber-700">📝 Remarks:</span> ${b.cleanRemarks}
            </div>
          ` : ''}
        </div>

        <!-- Footer: Total Price -->
        <div class="pt-2 border-top d-flex justify-content-between align-items-center" style="border-color:#fef08a !important;">
          <span class="fs-8 text-muted font-monospace fw-semibold">Total Price:</span>
          <span class="fw-bold text-success font-monospace fs-7">₹${totalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;
    }).join('');

    if (container) container.innerHTML = cardListHtml;
    if (mainContainer) mainContainer.innerHTML = cardListHtml;
};

window.openEditPriceRecordModal = function (batchKey) {
    const records = DB.getAll('price_history') || [];
    const batchItems = records.filter(r => {
        const key = r.BatchID || (r.Date + '_' + (r.NoteName || '') + '_' + (r.CreatedAt ? r.CreatedAt.slice(0, 19) : r.RecordID));
        return key === batchKey;
    });

    if (!batchItems.length) {
        UI.toast('Price record details not found.', 'warning');
        return;
    }

    const first = batchItems[0];
    let noteText = first.Remarks || '';
    let gstMatch = noteText.match(/\(GST:\s*([\d.]+)%\)/i);
    let cleanRemarks = noteText.replace(/\(GST:\s*[\d.]+%\)/gi, '').replace(/^GST:\s*[\d.]+\s*%/gi, '').trim();

    document.getElementById('editPhBatchKey').value = batchKey;
    document.getElementById('editPhDate').value = first.Date || UI.todayISO();
    document.getElementById('editPhNoteName').value = first.NoteName || first.VendorName || '';
    document.getElementById('editPhRemarks').value = cleanRemarks;
    const chkMerge = document.getElementById('chkEditPhMerge');
    const lumpInput = document.getElementById('editPhLumpInput');
    if (chkMerge) chkMerge.checked = false;
    if (lumpInput) {
        lumpInput.value = '';
        lumpInput.style.display = 'none';
    }

    const tbody = document.getElementById('tbodyEditPhItems');
    if (tbody) {
        tbody.innerHTML = '';
        batchItems.forEach(item => {
            addEditPhItemRow(item.ItemName, item.Quantity, item.TotalWithoutGst, item.Unit);
        });
    }

    recalcEditPhSummary();

    const modalEl = document.getElementById('editPriceRecordModal');
    if (modalEl) {
        let bsModal = bootstrap.Modal.getInstance(modalEl);
        if (!bsModal) bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
};

window.addEditPhItemRow = function (name = '', qty = 1, price = '', unit = 'Pc') {
    const tbody = document.getElementById('tbodyEditPhItems');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="p-1 align-middle"><input type="text" class="form-control form-control-sm edit-item-name fw-bold" value="${name}" placeholder="Item Name" required style="font-size:0.75rem;"></td>
        <td class="p-1 text-center align-middle" style="width:75px;"><input type="number" min="0.01" step="any" class="form-control form-control-sm edit-item-qty text-center p-1" value="${qty}" style="font-size:0.75rem;" oninput="recalcEditPhSummary()"></td>
        <td class="p-1 align-middle" style="width:125px;"><input type="number" min="0" step="any" class="form-control form-control-sm edit-item-price text-end font-monospace p-1" value="${price}" placeholder="0.00" style="font-size:0.75rem;" oninput="recalcEditPhSummary()"></td>
        <td class="p-1 text-center align-middle" style="width:35px;"><button type="button" class="btn btn-xs btn-outline-danger p-0 px-1" onclick="removeEditPhItemRow(this)" title="Remove item">✕</button></td>
    `;
    tbody.appendChild(tr);
    recalcEditPhSummary();
};

window.removeEditPhItemRow = function (btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
    recalcEditPhSummary();
};

window.recalcEditPhSummary = function () {
    const allRows = document.querySelectorAll('#tbodyEditPhItems tr');
    let subtotal = 0;

    allRows.forEach(tr => {
        const price = Number(tr.querySelector('.edit-item-price')?.value) || 0;
        subtotal += price;
    });

    const gstPct = Number(document.getElementById('editPhGstPct')?.value) || 0;
    const grandTotal = Calc.round2(subtotal * (1 + gstPct / 100));

    const lblSubtotal = document.getElementById('lblEditPhSubtotal');
    const lblGrandTotal = document.getElementById('lblEditPhGrandTotal');

    if (lblSubtotal) lblSubtotal.textContent = UI.money(Calc.round2(subtotal));
    if (lblGrandTotal) lblGrandTotal.textContent = UI.money(grandTotal);
};

window.updatePriceRecordBatch = async function () {
    const batchKey = document.getElementById('editPhBatchKey')?.value;
    if (!batchKey) return;

    const phDate = document.getElementById('editPhDate')?.value || UI.todayISO();
    const phNoteName = document.getElementById('editPhNoteName')?.value?.trim() || '';
    const phRemarks = document.getElementById('editPhRemarks')?.value?.trim() || '';
    const gstPct = Number(document.getElementById('editPhGstPct')?.value) || 0;

    const itemRows = document.querySelectorAll('#tbodyEditPhItems tr');
    const updatedRecords = [];

    itemRows.forEach(tr => {
        const itemName = tr.querySelector('.edit-item-name')?.value?.trim();
        const qty = Number(tr.querySelector('.edit-item-qty')?.value) || 1;
        const priceVal = tr.querySelector('.edit-item-price')?.value;
        const priceNoGst = priceVal !== '' && priceVal !== null && priceVal !== undefined ? Number(priceVal) : 0;

        if (itemName && !isNaN(priceNoGst) && priceNoGst >= 0) {
            const priceWithGst = Calc.round2(priceNoGst * (1 + gstPct / 100));
            const rateNoGst = qty > 0 ? Calc.round2(priceNoGst / qty) : 0;
            const rateWithGst = qty > 0 ? Calc.round2(priceWithGst / qty) : 0;

            updatedRecords.push({
                RecordID: Utils.uid('PH'),
                BatchID: batchKey,
                Date: phDate,
                NoteName: phNoteName,
                VendorName: phNoteName,
                ItemName: itemName,
                Quantity: qty,
                Unit: 'Pc',
                TotalWithoutGst: priceNoGst,
                TotalWithGst: priceWithGst,
                RateWithoutGst: rateNoGst,
                RateWithGst: rateWithGst,
                Remarks: phRemarks ? `${phRemarks} (GST: ${gstPct}%)` : `GST: ${gstPct}%`,
                CreatedAt: new Date().toISOString()
            });
        }
    });

    if (!updatedRecords.length) {
        UI.toast('Please add at least one item with a valid name.', 'danger');
        return;
    }

    UI.showLoading(true);
    try {
        // Delete previous batch items from DB
        await DB.delete('price_history', r => {
            const key = r.BatchID || (r.Date + '_' + (r.NoteName || '') + '_' + (r.CreatedAt ? r.CreatedAt.slice(0, 19) : r.RecordID));
            return key === batchKey;
        });

        // Insert updated batch items
        for (const rec of updatedRecords) {
            await DB.insert('price_history', rec);
        }

        UI.toast('Price record updated successfully!', 'success');

        const modalEl = document.getElementById('editPriceRecordModal');
        if (modalEl) {
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            } else if (window.$ && $('#editPriceRecordModal').modal) {
                $('#editPriceRecordModal').modal('hide');
            }
        }
        // Cleanup leftover backdrop if any
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');

        renderPriceHistoryList();
    } catch (err) {
        UI.toast('Error updating price record: ' + err.message, 'danger');
    } finally {
        UI.showLoading(false);
    }
};

window.deletePriceRecordBatch = async function (batchKey) {
    const ok = await UI.confirmDialog('Delete this price record card and all its items?', 'Delete Price Record', 'Delete', 'btn-danger');
    if (!ok) return;

    UI.showLoading(true);
    try {
        await DB.delete('price_history', r => {
            const key = r.BatchID || (r.Date + '_' + (r.NoteName || '') + '_' + (r.CreatedAt ? r.CreatedAt.slice(0, 19) : r.RecordID));
            return key === batchKey;
        });
        UI.toast('Price record card deleted.', 'warning');
        renderPriceHistoryList();
    } catch (err) {
        UI.toast('Error deleting price record: ' + err.message, 'danger');
    } finally {
        UI.showLoading(false);
    }
};

window.deletePriceRecord = async function (recordId) {
    const ok = await UI.confirmDialog('Delete this price history record?', 'Delete Record', 'Delete', 'btn-danger');
    if (!ok) return;

    UI.showLoading(true);
    try {
        await DB.delete('price_history', r => r.RecordID === recordId);
        UI.toast('Price record deleted.', 'warning');
        renderPriceHistoryList();
    } catch (err) {
        UI.toast('Error deleting record: ' + err.message, 'danger');
    } finally {
        UI.showLoading(false);
    }
};
