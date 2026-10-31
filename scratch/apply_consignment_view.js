const fs = require('fs');
const path = 'c:/Users/AMAR CHAND MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarPurchaseTracker/js/inventory.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update syncWithDatabase to safeguard local data and persist inwards
const oldSyncInwards = `      // 2. Fetch inwards
      const dbInwards = DB.getAll('inventory_inwards');
      if (Array.isArray(dbInwards)) {
        inwards = dbInwards.map(row => {
          let docs = [];
          if (row.Documents) {
            try {
              docs = typeof row.Documents === 'string' ? JSON.parse(row.Documents) : row.Documents;
            } catch (e) {
              docs = [];
            }
          }
          return {
            id: row.InwardID || row.inwardid || row.id,
            date: row.Date || row.date,
            invoiceNo: row.InvoiceNo || row.invoiceno || '',
            supplier: row.Supplier || row.supplier || '',
            itemCode: row.ItemCode || row.itemcode || '',
            qty: Number(row.Quantity !== undefined ? row.Quantity : row.quantity) || 0,
            unitPrice: Number(row.UnitPrice !== undefined ? row.UnitPrice : row.unitprice) || 0,
            gstRate: Number(row.GstRate !== undefined ? row.GstRate : (row.gstrate !== undefined ? row.gstrate : 18)),
            transportCost: Number(row.TransportCost !== undefined ? row.TransportCost : (row.transportcost !== undefined ? row.transportcost : 0)),
            consignmentTransportCost: Number(row.ConsignmentTransportCost !== undefined ? row.ConsignmentTransportCost : (row.consignmenttransportcost !== undefined ? row.consignmenttransportcost : 0)),
            costPerUnit: Number(row.CostPerUnit !== undefined ? row.CostPerUnit : (row.costperunit !== undefined ? row.costperunit : 0)),
            totalCost: Number(row.TotalCost !== undefined ? row.TotalCost : row.totalcost) || 0,
            location: row.Location || row.location || 'Main Godown',
            remarks: row.Remarks || row.remarks || '',
            docName: row.DocumentName || row.documentname || null,
            docData: row.DocumentData || row.documentdata || null,
            documents: docs
          };
        });
      }`;

const newSyncInwards = `      // 2. Fetch inwards
      const dbInwards = DB.getAll('inventory_inwards');
      if (Array.isArray(dbInwards) && dbInwards.length > 0) {
        inwards = dbInwards.map(row => {
          let docs = [];
          if (row.Documents) {
            try {
              docs = typeof row.Documents === 'string' ? JSON.parse(row.Documents) : row.Documents;
            } catch (e) {
              docs = [];
            }
          }
          return {
            id: row.InwardID || row.inwardid || row.id,
            date: row.Date || row.date,
            invoiceNo: row.InvoiceNo || row.invoiceno || '',
            supplier: row.Supplier || row.supplier || '',
            itemCode: row.ItemCode || row.itemcode || '',
            qty: Number(row.Quantity !== undefined ? row.Quantity : row.quantity) || 0,
            unitPrice: Number(row.UnitPrice !== undefined ? row.UnitPrice : row.unitprice) || 0,
            gstRate: Number(row.GstRate !== undefined ? row.GstRate : (row.gstrate !== undefined ? row.gstrate : 18)),
            transportCost: Number(row.TransportCost !== undefined ? row.TransportCost : (row.transportcost !== undefined ? row.transportcost : 0)),
            consignmentTransportCost: Number(row.ConsignmentTransportCost !== undefined ? row.ConsignmentTransportCost : (row.consignmenttransportcost !== undefined ? row.consignmenttransportcost : 0)),
            costPerUnit: Number(row.CostPerUnit !== undefined ? row.CostPerUnit : (row.costperunit !== undefined ? row.costperunit : 0)),
            totalCost: Number(row.TotalCost !== undefined ? row.TotalCost : row.totalcost) || 0,
            location: row.Location || row.location || 'Main Godown',
            remarks: row.Remarks || row.remarks || '',
            docName: row.DocumentName || row.documentname || null,
            docData: row.DocumentData || row.documentdata || null,
            documents: docs
          };
        });
      } else if (inwards.length > 0) {
        // Local storage has inwards, upload to server DB so persistence is guaranteed
        inwards.forEach(newInward => {
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
            Documents: JSON.stringify(newInward.documents || []),
            CreatedAt: newInward.createdAt || new Date().toISOString()
          }).catch(() => {});
        });
      }`;

if (content.includes(oldSyncInwards.replace(/\r\n/g, '\n'))) {
  content = content.replace(oldSyncInwards.replace(/\r\n/g, '\n'), newSyncInwards.replace(/\r\n/g, '\n'));
} else if (content.includes(oldSyncInwards.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldSyncInwards.replace(/\n/g, '\r\n'), newSyncInwards.replace(/\n/g, '\r\n'));
}

// 2. Add getGroupedInwardConsignments helper and replace renderInwardsTable
const startInwardsMarker = '  function renderInwardsTable() {';
const endInwardsMarker = '  // --- Multi-Selection & Bulk Deletion Helpers ---';

const idxStartInw = content.indexOf(startInwardsMarker);
const idxEndInw = content.indexOf(endInwardsMarker);

if (idxStartInw === -1 || idxEndInw === -1) {
  console.error('Inwards table markers not found!');
  process.exit(1);
}

const newInwardsSection = `  function getGroupedInwardConsignments() {
    const rawInwards = getFilteredInwards();
    const map = new Map();

    rawInwards.forEach(inw => {
      const key = inw.invoiceNo || inw.id;
      if (!map.has(key)) {
        map.set(key, {
          key: key,
          invoiceNo: inw.invoiceNo || key,
          date: inw.date || '',
          supplier: inw.supplier || '',
          location: inw.location || 'Main Godown',
          remarks: inw.remarks || '',
          docName: inw.docName || null,
          docData: inw.docData || null,
          documents: inw.documents || [],
          transportCost: Number(inw.consignmentTransportCost || 0),
          items: [],
          totalCost: 0,
          totalQty: 0,
          inwardIds: []
        });
      }

      const grp = map.get(key);
      grp.inwardIds.push(inw.id);

      const itm = items.find(i => i.code === inw.itemCode) || {};
      const unitPrice = Number(inw.unitPrice !== undefined ? inw.unitPrice : inw.UnitPrice) || itm.buyingPrice || 0;
      const qty = Number(inw.qty !== undefined ? inw.qty : inw.Quantity) || 0;
      const gstRate = Number(inw.gstRate !== undefined ? inw.gstRate : 18);
      const rowTransport = Number(inw.transportCost !== undefined ? inw.transportCost : 0);
      const rowTotal = Number(inw.totalCost) || round2((qty * unitPrice * (1 + gstRate / 100)) + rowTransport);

      grp.items.push({
        inwardId: inw.id,
        itemCode: inw.itemCode,
        itemName: itm.name || inw.itemCode,
        category: itm.category || 'Others',
        qty: qty,
        unit: inw.unit || itm.unit || 'Nos',
        unitPrice: unitPrice,
        gstRate: gstRate,
        transportCost: rowTransport,
        totalCost: rowTotal
      });

      grp.totalCost += rowTotal;
      grp.totalQty += qty;

      const ctc = Number(inw.consignmentTransportCost || 0);
      if (ctc > grp.transportCost) {
        grp.transportCost = ctc;
      }
      if (!grp.docName && inw.docName) {
        grp.docName = inw.docName;
        grp.docData = inw.docData;
      }
      if ((!grp.documents || grp.documents.length === 0) && inw.documents && inw.documents.length > 0) {
        grp.documents = inw.documents;
      }
    });

    const consignments = Array.from(map.values());
    consignments.sort((a, b) => new Date(b.date) - new Date(a.date));
    return consignments;
  }

  function renderInwardsTable() {
    const tbody = document.getElementById('invInwardsTbody');
    const tfoot = document.getElementById('invInwardsTfoot');
    const cardsContainer = document.getElementById('invInwardsCards');
    if (!tbody) return;

    const consignments = getGroupedInwardConsignments();

    // Prune stale selection based on consignment keys
    const currentKeys = new Set(consignments.map(c => c.key));
    for (const id of selectedInwards) {
      if (!currentKeys.has(id)) selectedInwards.delete(id);
    }

    const tabCount = document.getElementById('tabCountInwards');
    if (tabCount) tabCount.textContent = consignments.length;

    if (consignments.length === 0) {
      tbody.innerHTML = \`
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <div class="py-4">
              <div class="fs-6 fw-semibold text-secondary mb-1">No inward purchases recorded</div>
              <div class="small text-muted mb-3">Record inward deliveries from suppliers to increase godown stock.</div>
              <button type="button" class="inv-btn inv-btn-stockin" onclick="InventoryApp.openStockInModal()">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Stock In Delivery</span>
              </button>
            </div>
          </td>
        </tr>
      \`;
      if (cardsContainer) {
        cardsContainer.innerHTML = \`
          <div class="inv-cards-empty text-center py-4">
            <div class="fs-6 fw-semibold text-secondary mb-1">No inward consignments recorded</div>
            <div class="small text-muted mb-3">Record equipment purchases from suppliers to increase godown stock.</div>
            <button type="button" class="inv-btn inv-btn-stockin" onclick="InventoryApp.openStockInModal()">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Stock In Delivery</span>
            </button>
          </div>
        \`;
      }
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('inwards');
      updateBulkActionBar();
      return;
    }

    // Render Consignment-wise Desktop Table Rows (1 row per bucket confirmation)
    tbody.innerHTML = consignments.map((grp, idx) => {
      let docBadge = \`<span class="text-muted small" style="font-size:0.75rem;">—</span>\`;
      const primaryDoc = (grp.documents && grp.documents[0]) || (grp.docName ? { name: grp.docName } : null);
      if (primaryDoc) {
        const docCount = grp.documents && grp.documents.length > 1 ? \` (\${grp.documents.length})\` : '';
        docBadge = \`
          <button type="button" class="inv-row-btn inv-doc-btn" onclick="InventoryApp.viewDoc('\${grp.inwardIds[0]}', 'inward')" title="Download / View \${escapeHtml(primaryDoc.name)}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span style="max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${escapeHtml(primaryDoc.name)}\${docCount}</span>
          </button>
        \`;
      }

      const isSelected = selectedInwards.has(grp.key);

      return \`
        <tr class="\${isSelected ? 'inv-row-selected' : ''}">
          <td class="text-center no-print inv-chk-cell" style="width: 38px;">
            <input type="checkbox" class="form-check-input inv-row-chk" data-type="inwards" data-id="\${grp.key}" \${isSelected ? 'checked' : ''} title="Select Consignment \${grp.key}">
          </td>
          <td class="text-center text-muted" style="width: 40px;">\${idx + 1}</td>
          <td class="font-monospace text-secondary text-nowrap">\${grp.date}</td>
          <td>
            <div class="fw-semibold text-dark">\${escapeHtml(grp.supplier)}</div>
            \${grp.invoiceNo ? \`<div class="font-monospace text-muted small mt-0.5"><span class="badge bg-secondary-subtle text-secondary border font-monospace py-0.5 cursor-pointer" onclick="InventoryApp.openStockInConsignment('\${escapeHtml(grp.key)}')" title="Open Consignment \${escapeHtml(grp.invoiceNo)}">Inv: \${escapeHtml(grp.invoiceNo)}</span></div>\` : ''}
            \${grp.remarks ? \`<div class="text-muted small mt-0.5">\${escapeHtml(grp.remarks)}</div>\` : ''}
          </td>
          <td>
            <div class="d-flex flex-column gap-1">
              \${grp.items.map((it, itIdx) => \`
                <div class="d-flex align-items-center justify-content-between gap-2 py-0.5 \${itIdx > 0 ? 'border-top border-light-subtle' : ''}">
                  <div class="min-w-0 flex-grow-1">
                    <span class="fw-medium text-dark">\${escapeHtml(it.itemName)}</span>
                    <span class="text-muted small font-monospace ms-1" style="font-size:0.75rem;">\${escapeHtml(it.itemCode)}</span>
                  </div>
                  <div class="d-flex align-items-center gap-2 flex-shrink-0 text-nowrap">
                    <span class="badge bg-slate-100 text-slate-800 border font-monospace px-1.5 py-0.5">\${fmtQty(it.qty)} <span class="fw-normal text-muted">\${escapeHtml(it.unit)}</span></span>
                    <span class="font-monospace text-secondary small">× \${fmtRupees(it.unitPrice)}</span>
                  </div>
                </div>
              \`).join('')}
            </div>
          </td>
          <td class="text-end font-monospace fw-bold text-emerald-700" style="font-size:0.88rem;">
            \${fmtRupees(grp.totalCost)}
            \${grp.transportCost > 0 ? \`<div class="text-muted small fw-normal" style="font-size:0.72rem;">Incl. Trans: \${fmtRupees(grp.transportCost)}</div>\` : ''}
          </td>
          <td>\${docBadge}</td>
          <td class="text-secondary small text-nowrap">\${escapeHtml(grp.location || 'Main Godown')}</td>
          <td class="text-center text-nowrap no-print" style="width: 85px;">
            <div class="d-inline-flex align-items-center gap-1">
              <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openStockInConsignment('\${escapeHtml(grp.key)}')" title="Edit Consignment">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteInward('\${escapeHtml(grp.key)}')" title="Delete Consignment">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      \`;
    }).join('');

    // Render Consignment-wise Mobile Cards
    if (cardsContainer) {
      cardsContainer.innerHTML = consignments.map((grp) => {
        const isSelected = selectedInwards.has(grp.key);
        const primaryDoc = (grp.documents && grp.documents[0]) || (grp.docName ? { name: grp.docName } : null);

        return \`
          <article class="inv-mobile-card \${isSelected ? 'inv-card-selected' : ''}" data-id="\${grp.key}">
            <div class="inv-card-head">
              <div class="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
                <div class="inv-chk-cell pt-0.5">
                  <input type="checkbox" class="form-check-input inv-row-chk m-0" data-type="inwards" data-id="\${grp.key}" \${isSelected ? 'checked' : ''} title="Select Consignment \${grp.key}">
                </div>
                <div class="min-w-0 flex-grow-1">
                  <div class="inv-card-title text-dark">\${escapeHtml(grp.supplier || 'Inward Consignment')}</div>
                  <div class="inv-card-meta">
                    <span class="font-monospace text-secondary small">\${grp.date}</span>
                    \${grp.invoiceNo ? \`<span class="badge bg-secondary-subtle text-secondary border font-monospace py-0.5 cursor-pointer" onclick="InventoryApp.openStockInConsignment('\${escapeHtml(grp.key)}')">Inv: \${escapeHtml(grp.invoiceNo)}</span>\` : ''}
                  </div>
                </div>
              </div>
              \${primaryDoc ? \`
                <button type="button" class="inv-doc-pill-btn flex-shrink-0" onclick="InventoryApp.viewDoc('\${grp.inwardIds[0]}', 'inward')" title="Invoice">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Invoice</span>
                </button>
              \` : ''}
            </div>

            <div class="p-2 border-top border-bottom bg-light-subtle">
              <div class="small fw-semibold text-secondary mb-1">Items Received (\${grp.items.length})</div>
              <div class="d-flex flex-column gap-1">
                \${grp.items.map(it => \`
                  <div class="d-flex align-items-center justify-content-between small">
                    <span class="text-dark fw-medium text-truncate me-2">\${escapeHtml(it.itemName)}</span>
                    <span class="font-monospace text-secondary flex-shrink-0">\${fmtQty(it.qty)} \${escapeHtml(it.unit)} × \${fmtRupees(it.unitPrice)}</span>
                  </div>
                \`).join('')}
              </div>
            </div>

            <div class="inv-card-kpi-grid">
              <div class="inv-card-kpi">
                <span class="lbl">Total Units</span>
                <span class="val font-monospace">\${fmtQty(grp.totalQty)}</span>
              </div>
              <div class="inv-card-kpi">
                <span class="lbl">Total Inward Cost</span>
                <span class="val font-monospace fw-bold text-emerald-700">\${fmtRupees(grp.totalCost)}</span>
              </div>
              <div class="inv-card-kpi">
                <span class="lbl">Storage Bay</span>
                <span class="val text-truncate">\${escapeHtml(grp.location || 'Main Godown')}</span>
              </div>
            </div>

            \${grp.remarks ? \`<div class="small text-muted px-2 py-1">💬 \${escapeHtml(grp.remarks)}</div>\` : ''}

            <div class="inv-card-actions justify-content-end">
              <button type="button" class="inv-qa-btn qa-edit" onclick="InventoryApp.openStockInConsignment('\${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Edit</span>
              </button>
              <button type="button" class="inv-qa-btn qa-delete" onclick="InventoryApp.deleteInward('\${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete</span>
              </button>
            </div>
          </article>
        \`;
      }).join('');
    }

    const grandInwCost = consignments.reduce((s, c) => s + c.totalCost, 0);
    const totalQtyInw = consignments.reduce((s, c) => s + c.totalQty, 0);
    const totalDistinctItems = consignments.reduce((s, c) => s + c.items.length, 0);

    if (tfoot) {
      tfoot.innerHTML = \`
        <tr>
          <td colspan="4" class="text-uppercase text-secondary fs-8">Total Inward Procurement (\${consignments.length} Consignments, \${totalDistinctItems} Items)</td>
          <td class="font-monospace fw-bold text-dark">\${fmtQty(totalQtyInw)} total units</td>
          <td class="text-end font-monospace fw-bold text-emerald-700">\${fmtRupees(grandInwCost)}</td>
          <td colspan="3"></td>
        </tr>
      \`;
    }

    updateHeaderCheckboxState('inwards');
    updateBulkActionBar();
  }

  async function deleteInward(key) {
    const matching = inwards.filter(i => (i.invoiceNo && i.invoiceNo === key) || i.id === key);
    if (matching.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Consignment record not found', 'warning');
      return;
    }

    const consignmentName = matching[0].invoiceNo || matching[0].id;
    const totalQty = matching.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const countItems = matching.length;

    const warning = \`Are you sure you want to delete consignment "\${consignmentName}" (\${countItems} item(s), \${fmtQty(totalQty)} units)?\\n\\nThis will adjust in-hand stock calculation accordingly.\\n\\nThis action cannot be undone.\`;
    if (!confirm(warning)) return;

    const idsToDelete = matching.map(i => i.id);
    inwards = inwards.filter(i => !idsToDelete.includes(i.id));
    selectedInwards.delete(key);
    saveData();

    await deleteDbBatch('inventory_inwards', 'InwardID', idsToDelete);

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(\`Consignment "\${consignmentName}" deleted successfully.\`, 'info');
    }
  }

`;

content = content.slice(0, idxStartInw) + newInwardsSection + content.slice(idxEndInw);

// 3. Update deleteSelectedInwards to handle consignment keys
const oldDeleteSelectedInw = '  async function deleteSelectedInwards() {';
const idxDelStart = content.indexOf(oldDeleteSelectedInw);
if (idxDelStart !== -1) {
  const nextFn = '  async function deleteSelectedItems() {';
  const idxDelEnd = content.indexOf(nextFn, idxDelStart);
  if (idxDelEnd !== -1) {
    const newDeleteSelectedInw = `  async function deleteSelectedInwards() {
    const selectedKeys = Array.from(selectedInwards);
    if (selectedKeys.length === 0) return;

    const targetInwards = inwards.filter(i => selectedKeys.includes(i.invoiceNo) || selectedKeys.includes(i.id));
    const totalQty = targetInwards.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const idsToDelete = targetInwards.map(i => i.id);

    const warning = \`Are you sure you want to delete \${selectedKeys.length} selected inward consignment(s) (\${idsToDelete.length} item records, \${fmtQty(totalQty)} units)?\\n\\nThis will adjust warehouse in-hand stock calculation.\\n\\nThis action cannot be undone.\`;
    if (!confirm(warning)) return;

    inwards = inwards.filter(i => !idsToDelete.includes(i.id));
    selectedInwards.clear();
    saveData();

    await deleteDbBatch('inventory_inwards', 'InwardID', idsToDelete);

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(\`Successfully deleted \${selectedKeys.length} inward consignment(s).\`, 'info');
    }
  }

`;
    content = content.slice(0, idxDelStart) + newDeleteSelectedInw + content.slice(idxDelEnd);
  }
}

// 4. Update exportCsv for inwards to export consignment-wise
const oldExportInw = `    } else if (activeTab === 'inwards') {
      filename = \`Solar_Inward_Procurement_\${today}.csv\`;
      const headers = ['Date', 'Invoice No', 'Supplier / Vendor', 'Item Code', 'Item Name', 'Quantity Received', 'Unit Price (INR)', 'Total Inward Cost (INR)', 'Document', 'Storage Location'];
      
      const rows = inwards.map(inw => {
        const itm = items.find(i => i.code === inw.itemCode) || {};
        return [
          \`"\${inw.date}"\`,
          \`"\${inw.invoiceNo || ''}"\`,
          \`"\${(inw.supplier || '').replace(/"/g, '""')}"\`,
          \`"\${inw.itemCode}"\`,
          \`"\${(itm.name || '').replace(/"/g, '""')}"\`,
          inw.qty,
          inw.unitPrice,
          inw.totalCost,
          \`"\${inw.docName || ''}"\`,
          \`"\${(inw.location || '').replace(/"/g, '""')}"\`
        ];
      });

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\r\\n');
    }`;

const newExportInw = `    } else if (activeTab === 'inwards') {
      filename = \`Solar_Inward_Procurement_\${today}.csv\`;
      const headers = ['Date', 'Invoice No', 'Supplier / Vendor', 'Items Received (Qty & Unit Price)', 'Total Units', 'Total Inward Cost (INR)', 'Transport Cost (INR)', 'Document', 'Storage Location', 'Remarks'];
      const consignments = getGroupedInwardConsignments();
      const rows = consignments.map(c => {
        const itemsSummary = c.items.map(it => \`\${it.itemName} (\${it.qty} \${it.unit} @ ₹\${it.unitPrice})\`).join('; ');
        return [
          \`"\${c.date}"\`,
          \`"\${c.invoiceNo || ''}"\`,
          \`"\${(c.supplier || '').replace(/"/g, '""')}"\`,
          \`"\${itemsSummary.replace(/"/g, '""')}"\`,
          c.totalQty,
          c.totalCost,
          c.transportCost || 0,
          \`"\${c.docName || ''}"\`,
          \`"\${(c.location || '').replace(/"/g, '""')}"\`,
          \`"\${(c.remarks || '').replace(/"/g, '""')}"\`
        ];
      });

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\r\\n');
    }`;

if (content.includes(oldExportInw.replace(/\r\n/g, '\n'))) {
  content = content.replace(oldExportInw.replace(/\r\n/g, '\n'), newExportInw.replace(/\r\n/g, '\n'));
} else if (content.includes(oldExportInw.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldExportInw.replace(/\n/g, '\r\n'), newExportInw.replace(/\n/g, '\r\n'));
}

// Ensure deleteInward is exported in the module return
if (!content.includes('deleteInward,')) {
  content = content.replace('deleteSelectedInwards,', 'deleteSelectedInwards,\n    deleteInward,');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated inventory.js with Consignment-wise Inwards Table view!');
