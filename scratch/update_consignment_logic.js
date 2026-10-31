const fs = require('fs');
const path = 'c:/Users/AMAR CHAND MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarPurchaseTracker/js/inventory.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '  function openStockInModal(preselectedCode = null) {';
const endMarker = '  // --- Modal 2: Site Dispatch ---';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const replacement = `  let editingConsignmentInvoiceNo = null;

  function openStockInConsignment(invoiceNoOrId) {
    const modalEl = document.getElementById('modalStockIn');
    if (!modalEl) return;

    // Find all inward records belonging to this consignment
    let matchingInwards = inwards.filter(i => i.invoiceNo && i.invoiceNo === invoiceNoOrId);
    if (matchingInwards.length === 0) {
      const single = inwards.find(i => i.id === invoiceNoOrId);
      if (single) {
        if (single.invoiceNo) {
          matchingInwards = inwards.filter(i => i.invoiceNo === single.invoiceNo);
        } else {
          matchingInwards = [single];
        }
      }
    }

    if (matchingInwards.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Consignment record not found', 'warning');
      return;
    }

    const firstInw = matchingInwards[0];
    editingConsignmentInvoiceNo = firstInw.invoiceNo || firstInw.id;

    // Set modal title & submit button text
    const titleEl = modalEl.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = \`Stock In Consignment — \${editingConsignmentInvoiceNo}\`;
    }
    const submitBtn = document.getElementById('btnSubmitStockIn');
    if (submitBtn) {
      submitBtn.textContent = 'Update Consignment';
    }

    // Populate header inputs
    const dateInput = document.getElementById('inwDate');
    const supplierInput = document.getElementById('inwSupplier');
    const locationInput = document.getElementById('inwLocation');
    const transportInput = document.getElementById('inwTransportCost') || document.getElementById('inwImportCost');
    const remarksInput = document.getElementById('inwRemarks');

    if (dateInput) dateInput.value = firstInw.date || new Date().toISOString().slice(0, 10);
    if (supplierInput) supplierInput.value = firstInw.supplier || '';
    if (locationInput) locationInput.value = firstInw.location || 'Main Godown — Bay A';

    // Consignment Transport Cost
    const savedConsignmentTransport = Number(firstInw.consignmentTransportCost !== undefined ? firstInw.consignmentTransportCost : firstInw.ConsignmentTransportCost);
    const sumRowTransport = matchingInwards.reduce((sum, item) => sum + (Number(item.transportCost !== undefined ? item.transportCost : item.TransportCost) || 0), 0);
    const effectiveTransport = savedConsignmentTransport > 0 ? savedConsignmentTransport : sumRowTransport;
    if (transportInput) transportInput.value = effectiveTransport > 0 ? effectiveTransport : '';

    if (remarksInput) remarksInput.value = firstInw.remarks || '';

    // Load documents
    inwardDocFiles = [];
    inwardDocFile = null;
    const inwFileInput = document.getElementById('inwDocFileInput');
    if (inwFileInput) inwFileInput.value = '';

    if (Array.isArray(firstInw.documents) && firstInw.documents.length > 0) {
      inwardDocFiles = firstInw.documents.map(d => ({ name: d.name, size: d.size, url: d.url, data: d.data }));
    } else if (firstInw.docName) {
      inwardDocFiles = [{ name: firstInw.docName, size: 0, url: null, data: firstInw.docData }];
    }
    renderInwFiles();

    // Load items using strictly saved fields: ItemCode, Quantity, UnitPrice, GstRate, TransportCost, CostPerUnit
    const ledger = getCalculatedStockLedger();
    inwardRows = matchingInwards.map((rec, idx) => {
      const item = ledger.find(i => i.code === rec.itemCode) || items.find(i => i.code === rec.itemCode) || {};
      const qty = Number(rec.qty !== undefined ? rec.qty : rec.Quantity) || 1;
      const unitPrice = Number(rec.unitPrice !== undefined ? rec.unitPrice : rec.UnitPrice) || 0;
      const gstRate = Number(rec.gstRate !== undefined ? rec.gstRate : (rec.GstRate !== undefined ? rec.GstRate : 18));
      const rowTransport = Number(rec.transportCost !== undefined ? rec.transportCost : (rec.TransportCost !== undefined ? rec.TransportCost : 0));
      const costPerUnit = Number(rec.costPerUnit !== undefined ? rec.costPerUnit : (rec.CostPerUnit !== undefined ? rec.CostPerUnit : 0));

      return {
        id: 'inw_row_' + Date.now() + '_' + idx,
        inwardId: rec.id,
        itemCode: rec.itemCode,
        qty: qty,
        unit: item.unit || rec.unit || 'Set',
        rate: unitPrice,
        unitPrice: unitPrice,
        gstRate: gstRate,
        transportCost: rowTransport,
        costPerUnit: costPerUnit,
        userEditedTransport: rowTransport > 0
      };
    });

    renderInwRows();
    // Autocalculate all derived fields on opening: Cost+GST, Total Cost, Total Cost+GST, Cost per unit, Total GST, Total Material Cost
    recalcInwardTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function openStockInModal(preselectedCode = null, consignmentRef = null) {
    if (consignmentRef) {
      return openStockInConsignment(consignmentRef);
    }

    editingConsignmentInvoiceNo = null;

    const modalEl = document.getElementById('modalStockIn');
    if (!modalEl) return;

    const titleEl = modalEl.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = 'Stock In Consignment';
    }
    const submitBtn = document.getElementById('btnSubmitStockIn');
    if (submitBtn) {
      submitBtn.textContent = 'Confirm Stock In';
    }

    const dateInput = document.getElementById('inwDate');
    const supplierInput = document.getElementById('inwSupplier');
    const locationInput = document.getElementById('inwLocation');
    const transportInput = document.getElementById('inwTransportCost') || document.getElementById('inwImportCost');
    const remarksInput = document.getElementById('inwRemarks');

    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (supplierInput) supplierInput.value = '';
    if (locationInput) locationInput.value = 'Main Godown — Bay A';
    if (transportInput) transportInput.value = '';
    if (remarksInput) remarksInput.value = '';

    // Reset multiple files upload state
    inwardDocFiles = [];
    inwardDocFile = null;
    const inwFileInput = document.getElementById('inwDocFileInput');
    if (inwFileInput) inwFileInput.value = '';
    renderInwFiles();

    const ledger = getCalculatedStockLedger();

    let codes = [];
    if (preselectedCode instanceof Set) {
      codes = Array.from(preselectedCode);
    } else if (Array.isArray(preselectedCode)) {
      codes = preselectedCode;
    } else if (preselectedCode) {
      codes = [preselectedCode];
    }

    if (codes.length > 0) {
      inwardRows = codes.map((c, idx) => {
        const item = ledger.find(i => i.code === c);
        const p = item ? (Number(item.buyingPrice) || 0) : 0;
        const g = 18;
        return {
          id: 'inw_' + Date.now() + '_' + idx,
          itemCode: c,
          qty: 1,
          unit: item ? (item.unit || 'Set') : 'Set',
          rate: p,
          unitPrice: p,
          gstRate: g,
          transportCost: 0
        };
      });
    } else {
      const initialItem = ledger[0];
      const p = initialItem ? (Number(initialItem.buyingPrice) || 0) : 0;
      inwardRows = [
        {
          id: 'inw_' + Date.now(),
          itemCode: initialItem ? initialItem.code : '',
          qty: 1,
          unit: initialItem ? (initialItem.unit || 'Set') : 'Set',
          rate: p,
          unitPrice: p,
          gstRate: 18,
          transportCost: 0
        }
      ];
    }

    renderInwRows();
    recalcInwardTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveStockIn() {
    const supplier = document.getElementById('inwSupplier')?.value.trim();
    const date = document.getElementById('inwDate')?.value || new Date().toISOString().slice(0, 10);
    const location = document.getElementById('inwLocation')?.value.trim() || 'Main Godown';
    const transportCost = Number(document.getElementById('inwTransportCost')?.value || document.getElementById('inwImportCost')?.value) || 0;
    const remarks = document.getElementById('inwRemarks')?.value.trim() || '';

    if (!supplier) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Supplier / Vendor Name', 'warning');
      document.getElementById('inwSupplier')?.focus();
      return;
    }

    if (!inwardRows || inwardRows.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Please add at least one item', 'warning');
      return;
    }

    for (let i = 0; i < inwardRows.length; i++) {
      const r = inwardRows[i];
      if (!r.itemCode) {
        if (typeof UI !== 'undefined') UI.toast(\`Row #\${i + 1}: Select an equipment item\`, 'warning');
        return;
      }
      const qty = Number(r.qty);
      if (!qty || qty <= 0) {
        if (typeof UI !== 'undefined') UI.toast(\`Row #\${i + 1}: Enter a valid quantity\`, 'warning');
        return;
      }
    }

    // Refresh totals calculation
    recalcInwardTotals();

    const invoiceNoToUse = editingConsignmentInvoiceNo || \`INV-\${Date.now().toString().slice(-6)}\`;
    const isEditing = Boolean(editingConsignmentInvoiceNo);

    // If editing existing consignment, remove previous entries from memory and DB
    if (isEditing) {
      const oldRecords = inwards.filter(i => (i.invoiceNo || i.id) === editingConsignmentInvoiceNo);
      inwards = inwards.filter(i => (i.invoiceNo || i.id) !== editingConsignmentInvoiceNo);
      if (typeof DB !== 'undefined') {
        oldRecords.forEach(old => {
          DB.remove('inventory_inwards', row => (row.InwardID || row.id) === old.id).catch(() => {});
        });
      }
    }

    let totalConsignmentCost = 0;
    let totalConsignmentUnits = 0;

    const docName = inwardDocFiles.map(f => f.name).join(', ') || (inwardDocFile ? inwardDocFile.name : null);
    const docData = inwardDocFiles.length > 0 ? (inwardDocFiles[0].data || inwardDocFiles[0].url) : (inwardDocFile ? inwardDocFile.data : null);
    const documents = inwardDocFiles.map(f => ({ name: f.name, size: f.size, url: f.url, data: f.data }));

    inwardRows.forEach((r, idx) => {
      const qty = Number(r.qty);
      const unitPrice = Number(r.rate !== undefined ? r.rate : r.unitPrice) || 0;
      const gstRate = Number(r.gstRate) || 0;
      const rowTransport = Number(r.transportCost) || 0;
      const costPerUnit = Number(r.costPerUnit) || round2(unitPrice + (qty > 0 ? (rowTransport / qty) : 0));
      const totalCost = Number(r.totalWithGst) ? round2(Number(r.totalWithGst) + rowTransport) : round2((qty * unitPrice * (1 + gstRate / 100)) + rowTransport);

      totalConsignmentCost += totalCost;
      totalConsignmentUnits += qty;

      const newInward = {
        id: isEditing && r.inwardId ? r.inwardId : \`INW-\${Date.now()}-\${idx + 1}\`,
        date,
        invoiceNo: invoiceNoToUse,
        supplier,
        itemCode: r.itemCode,
        qty,
        unit: r.unit || 'Set',
        unitPrice,
        gstRate,
        costPerUnit,
        transportCost: rowTransport,
        consignmentTransportCost: transportCost,
        totalCost,
        location,
        remarks,
        docName,
        docData,
        documents
      };

      inwards.unshift(newInward);

      // Update BuyingPrice in master inventory item
      const masterItem = items.find(it => it.code === r.itemCode);
      if (masterItem && unitPrice > 0) {
        masterItem.buyingPrice = unitPrice;
      }

      // Save strictly required fields to DB: QTY, Cost (UnitPrice), GST (GstRate), Cost per unit, Transport Cost, Consignment Transport Cost
      if (typeof DB !== 'undefined') {
        DB.insert('inventory_inwards', {
          InwardID: newInward.id,
          Date: newInward.date,
          InvoiceNo: newInward.invoiceNo,
          Supplier: newInward.supplier,
          ItemCode: newInward.itemCode,
          Quantity: newInward.qty,
          UnitPrice: newInward.unitPrice,
          GstRate: newInward.gstRate,
          CostPerUnit: newInward.costPerUnit,
          TransportCost: newInward.transportCost,
          ConsignmentTransportCost: newInward.consignmentTransportCost,
          TotalCost: newInward.totalCost,
          Location: newInward.location,
          Remarks: newInward.remarks,
          DocumentName: newInward.docName,
          DocumentData: newInward.docData,
          Documents: JSON.stringify(newInward.documents),
          CreatedAt: new Date().toISOString()
        }).catch(err => console.warn('[DB] inventory_inwards insert error:', err));

        if (masterItem && unitPrice > 0) {
          DB.update('inventory_items', row => (row.ItemCode || row.code) === r.itemCode, {
            BuyingPrice: unitPrice
          }).catch(() => {});
        }
      }
    });

    saveData();
    clearSelection('ledger');

    editingConsignmentInvoiceNo = null;

    const modalEl = document.getElementById('modalStockIn');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();

    if (typeof UI !== 'undefined') {
      const msg = isEditing
        ? \`Consignment \${invoiceNoToUse} updated successfully (\${inwardRows.length} items). Total: \${fmtRupees(totalConsignmentCost)}.\`
        : \`Successfully stocked in \${inwardRows.length} items (\${fmtQty(totalConsignmentUnits)} units). Total: \${fmtRupees(totalConsignmentCost)}.\`;
      UI.toast(msg, 'success');
    }
  }

`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);

// Also update openEditInwardModal to delegate to openStockInConsignment
const editInwMarker = '  function openEditInwardModal(id) {';
const editInwStart = content.indexOf(editInwMarker);
if (editInwStart !== -1) {
  const nextFnMarker = '  function handleSaveEditInward() {';
  const editInwEnd = content.indexOf(nextFnMarker, editInwStart);
  if (editInwEnd !== -1) {
    const editReplacement = `  function openEditInwardModal(id) {
    const inw = inwards.find(i => i.id === id);
    if (!inw) {
      if (typeof UI !== 'undefined') UI.toast('Inward record not found', 'danger');
      return;
    }
    openStockInConsignment(inw.invoiceNo || inw.id);
  }

`;
    content = content.slice(0, editInwStart) + editReplacement + content.slice(editInwEnd);
  }
}

// Ensure openStockInConsignment is exposed in the module return
if (!content.includes('openStockInConsignment,')) {
  content = content.replace('openStockInModal,', 'openStockInModal,\n    openStockInConsignment,');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated inventory.js with consignment logic!');
