/* =========================================================================
   inventory.js — Solar Equipment Warehouse & Site Dispatch Management
   EPC Solar Logistics & Stock Ledger (Strictly Material Cost Tracking)
   ========================================================================= */

const InventoryApp = (() => {







  // Storage Keys
  const STORAGE_KEY_ITEMS = 'solartrack_inventory_items_v2';
  const STORAGE_KEY_INWARDS = 'solartrack_inventory_inwards_v2';
  const STORAGE_KEY_DISPATCHES = 'solartrack_inventory_dispatches_v2';

  // State
  let items = [];
  let inwards = [];
  let dispatches = [];

  // Multi-selection state for deletion
  const selectedLedger = new Set();
  const selectedDispatches = new Set();
  const selectedInwards = new Set();

  let activeTab = 'ledger';
  let activeCategory = 'All';
  let searchTerm = '';
  let statusFilter = 'All';

  // Multi-item dynamic rows state
  let inwardRows = [];
  let dispatchRows = [];

  // Uploaded documents state
  let inwardDocFile = null;
  let dispatchDocFile = null;
  let editInwardDocFile = null;
  let editDispatchDocFile = null;

  // --- Helpers ---
  function fmtRupees(num) {
    const n = Number(num) || 0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  function fmtQty(num) {
    const n = Number(num) || 0;
    return n.toLocaleString('en-IN');
  }

  function fmtFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Storage & Supabase Sync ---
  function loadData() {
    try {
      const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      items = storedItems ? JSON.parse(storedItems) : [];

      const storedInwards = localStorage.getItem(STORAGE_KEY_INWARDS);
      inwards = storedInwards ? JSON.parse(storedInwards) : [];

      const storedDispatches = localStorage.getItem(STORAGE_KEY_DISPATCHES);
      dispatches = storedDispatches ? JSON.parse(storedDispatches) : [];
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
      items = [];
      inwards = [];
      dispatches = [];
    }

    syncWithDatabase();
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
      localStorage.setItem(STORAGE_KEY_INWARDS, JSON.stringify(inwards));
      localStorage.setItem(STORAGE_KEY_DISPATCHES, JSON.stringify(dispatches));
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }
  }

  async function syncWithDatabase() {
    if (typeof DB === 'undefined') return;

    try {
      if (!DB.isReady()) {
        await DB.tryRestoreFolder().catch(() => {});
      }

      // 1. Fetch items
      let loadedItems = [];
      const dbItems = DB.getAll('inventory_items');
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        loadedItems = dbItems.map(row => ({
          code: row.ItemCode || row.itemcode || row.code,
          name: row.ItemName || row.itemname || row.name,
          brand: row.Brand || row.brand || '',
          spec: row.Specification || row.specification || row.spec || '',
          category: row.Category || row.category || 'Others',
          unit: row.Unit || row.unit || 'Nos',
          buyingPrice: Number(row.BuyingPrice !== undefined ? row.BuyingPrice : row.buyingprice) || 0,
          minThreshold: Number(row.MinThreshold !== undefined ? row.MinThreshold : row.minthreshold) || 5,
          hsn: row.HSNCode || row.hsncode || '',
          gst: Number(row.GSTPercent !== undefined ? row.GSTPercent : row.gstpercent) || 12,
          status: row.Status || row.status || 'Active'
        }));
      } else {
        const masterItems = DB.getAll('items');
        if (Array.isArray(masterItems) && masterItems.length > 0) {
          loadedItems = masterItems.map((row, idx) => ({
            code: row.ItemCode || row.code || `SKU-${String(idx + 1).padStart(3, '0')}`,
            name: row.ItemName || row.itemname || row.name,
            brand: row.Brand || row.brand || 'Standard',
            spec: row.Specification || row.specification || row.spec || (row.ItemName || ''),
            category: row.Category || row.category || 'Others',
            unit: row.Unit || row.unit || 'Nos',
            buyingPrice: Number(row.BuyingPrice || row.Price || 0),
            minThreshold: Number(row.MinThreshold || 5),
            hsn: row.HSNCode || row.hsncode || '',
            gst: Number(row.GSTPercent || 18),
            status: row.Status || 'Active'
          }));
        }
      }
      if (loadedItems.length > 0) {
        items = loadedItems;
      }

      // 2. Fetch inwards
      const dbInwards = DB.getAll('inventory_inwards');
      if (Array.isArray(dbInwards)) {
        inwards = dbInwards.map(row => ({
          id: row.InwardID || row.inwardid || row.id,
          date: row.Date || row.date,
          invoiceNo: row.InvoiceNo || row.invoiceno || '',
          supplier: row.Supplier || row.supplier || '',
          itemCode: row.ItemCode || row.itemcode || '',
          qty: Number(row.Quantity !== undefined ? row.Quantity : row.quantity) || 0,
          unitPrice: Number(row.UnitPrice !== undefined ? row.UnitPrice : row.unitprice) || 0,
          totalCost: Number(row.TotalCost !== undefined ? row.TotalCost : row.totalcost) || 0,
          location: row.Location || row.location || 'Main Godown',
          remarks: row.Remarks || row.remarks || '',
          docName: row.DocumentName || row.documentname || null,
          docData: row.DocumentData || row.documentdata || null
        }));
      }

      // 3. Fetch dispatches
      const dbDispatches = DB.getAll('inventory_dispatches');
      if (Array.isArray(dbDispatches)) {
        dispatches = dbDispatches.map(row => ({
          id: row.DispatchID || row.dispatchid || row.id,
          date: row.Date || row.date,
          challanNo: row.ChallanNo || row.challanno || '',
          siteName: row.SiteName || row.sitename || '',
          itemCode: row.ItemCode || row.itemcode || '',
          qty: Number(row.Quantity !== undefined ? row.Quantity : row.quantity) || 0,
          unitBuyingPrice: Number(row.UnitBuyingPrice !== undefined ? row.UnitBuyingPrice : row.unitbuyingprice) || 0,
          dispatchedCost: Number(row.DispatchedCost !== undefined ? row.DispatchedCost : row.dispatchedcost) || 0,
          transportCost: Number(row.TransportCost !== undefined ? row.TransportCost : row.transportcost) || 0,
          vehicle: row.Vehicle || row.vehicle || '',
          remarks: row.Remarks || row.remarks || '',
          docName: row.DocumentName || row.documentname || null,
          docData: row.DocumentData || row.documentdata || null
        }));
      }

      saveData();
      renderKpiCards();
      renderCategoryChips();
      if (activeTab === 'ledger') renderLedgerTable();
      else if (activeTab === 'dispatches') renderDispatchesTable();
      else if (activeTab === 'inwards') renderInwardsTable();

    } catch (err) {
      console.warn('[Postgres Supabase] Sync note:', err.message);
    }
  }

  // --- Calculations ---
  function getItemSummary(itemCode) {
    const inwardSum = inwards
      .filter(inw => inw.itemCode === itemCode)
      .reduce((sum, inw) => sum + (Number(inw.qty) || 0), 0);

    const dispatchSum = dispatches
      .filter(dsp => dsp.itemCode === itemCode)
      .reduce((sum, dsp) => sum + (Number(dsp.qty) || 0), 0);

    const inHand = Math.max(0, inwardSum - dispatchSum);
    return { inwardSum, dispatchSum, inHand };
  }

  function getCalculatedStockLedger() {
    return items.map(item => {
      const { inwardSum, dispatchSum, inHand } = getItemSummary(item.code);
      const buyingPrice = Number(item.buyingPrice) || 0;
      const totalStockValuation = inHand * buyingPrice;

      let status = 'in-stock';
      if (inHand === 0) {
        status = 'out-of-stock';
      } else if (inHand <= (item.minThreshold || 5)) {
        status = 'low-stock';
      }

      return {
        ...item,
        inwardQty: inwardSum,
        dispatchedQty: dispatchSum,
        inHandQty: inHand,
        totalStockValuation,
        status
      };
    });
  }

  function getKpiMetrics() {
    const ledger = getCalculatedStockLedger();

    const totalWarehouseValuation = ledger.reduce((sum, itm) => sum + itm.totalStockValuation, 0);
    const totalInHandStock = ledger.reduce((sum, itm) => sum + itm.inHandQty, 0);
    const totalDispatchedMaterialCost = dispatches.reduce((sum, dsp) => sum + (Number(dsp.dispatchedCost) || 0), 0);

    return {
      totalWarehouseValuation,
      totalInHandStock,
      totalDispatchedMaterialCost,
      totalSKUs: ledger.length
    };
  }

  // --- Render KPI & Chips ---
  function renderKpiCards() {
    const metrics = getKpiMetrics();

    const valEl = document.getElementById('kpiTotalValuation');
    const inHandEl = document.getElementById('kpiTotalInHand');
    const dispEl = document.getElementById('kpiTotalDispatchedCost');

    if (valEl) valEl.textContent = fmtRupees(metrics.totalWarehouseValuation);
    if (inHandEl) inHandEl.textContent = `${fmtQty(metrics.totalInHandStock)} Units`;
    if (dispEl) dispEl.textContent = fmtRupees(metrics.totalDispatchedMaterialCost);

    const subValEl = document.getElementById('kpiSubValuation');
    const subInHandEl = document.getElementById('kpiSubInHand');
    const subDispEl = document.getElementById('kpiSubDispatched');

    if (subValEl) subValEl.textContent = `${metrics.totalSKUs} catalog items`;
    if (subInHandEl) subInHandEl.textContent = 'Available Godown Inventory';
    if (subDispEl) subDispEl.textContent = `${dispatches.length} site consignments`;
  }

  function renderCategoryChips() {
    const chipsContainer = document.getElementById('invCategoryChips');
    if (!chipsContainer) return;

    const PREFERRED_CATEGORIES = [
      'All',
      'Panels',
      'Inverters',
      'Cables',
      'Hardware',
      'Electricals',
      'Conduit',
      'Earthing',
      'Others'
    ];

    const itemCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));
    const categories = ['All'];

    PREFERRED_CATEGORIES.slice(1).forEach(cat => {
      if (!categories.map(c => c.toLowerCase()).includes(cat.toLowerCase())) {
        categories.push(cat);
      }
    });

    itemCategories.forEach(cat => {
      if (!categories.map(c => c.toLowerCase()).includes(cat.toLowerCase())) {
        categories.push(cat);
      }
    });

    if (!categories.map(c => c.toLowerCase()).includes(activeCategory.toLowerCase())) {
      activeCategory = 'All';
    }

    const ledger = getCalculatedStockLedger();

    chipsContainer.innerHTML = categories.map(cat => {
      let count = 0;
      if (cat === 'All') count = ledger.length;
      else count = ledger.filter(item => (item.category || '').toLowerCase() === cat.toLowerCase()).length;
      const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
      return `
        <button type="button" class="inv-chip ${isActive ? 'active' : ''}" data-category="${cat}">
          <span>${cat}</span>
          <span class="chip-badge">${count}</span>
        </button>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.inv-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        activeCategory = target.getAttribute('data-category');
        renderCategoryChips();
        renderLedgerTable();
      });
    });
  }

  // --- Render Tables & Filter Helpers ---
  function getFilteredLedgerItems() {
    let rows = getCalculatedStockLedger();

    if (activeCategory !== 'All') {
      rows = rows.filter(r => (r.category || '').toLowerCase() === activeCategory.toLowerCase());
    }

    if (statusFilter !== 'All') {
      if (statusFilter === 'in-stock') rows = rows.filter(r => r.status === 'in-stock');
      else if (statusFilter === 'low-stock') rows = rows.filter(r => r.status === 'low-stock');
      else if (statusFilter === 'out-of-stock') rows = rows.filter(r => r.status === 'out-of-stock');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => 
        (r.code && r.code.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.brand && r.brand.toLowerCase().includes(q)) ||
        (r.spec && r.spec.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q))
      );
    }
    return rows;
  }

  function renderLedgerTable() {
    const tbody = document.getElementById('invLedgerTbody');
    const tfoot = document.getElementById('invLedgerTfoot');
    if (!tbody) return;

    // Prune stale selection
    const currentCodes = new Set(items.map(i => i.code));
    for (const c of selectedLedger) {
      if (!currentCodes.has(c)) selectedLedger.delete(c);
    }

    const rows = getFilteredLedgerItems();

    const tabCount = document.getElementById('tabCountLedger');
    if (tabCount) tabCount.textContent = rows.length;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5 text-muted">
            <div class="py-4">
              <div class="fs-6 fw-semibold text-secondary mb-1">No equipment items found</div>
              <div class="small text-muted mb-3">Add equipment SKUs to start tracking warehouse stock.</div>
              <button type="button" class="inv-btn inv-btn-export" onclick="InventoryApp.openNewItemModal()">+ Add SKU</button>
            </div>
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('ledger');
      updateBulkActionBar();
      return;
    }

    tbody.innerHTML = rows.map((item, idx) => {
      let statusBadge = '';
      if (item.status === 'in-stock') {
        statusBadge = `<span class="inv-stock-badge in-stock"><span class="inv-badge-dot"></span> In Stock</span>`;
      } else if (item.status === 'low-stock') {
        statusBadge = `<span class="inv-stock-badge low-stock" title="Below threshold of ${item.minThreshold || 5}"><span class="inv-badge-dot"></span> Low Stock</span>`;
      } else {
        statusBadge = `<span class="inv-stock-badge out-of-stock"><span class="inv-badge-dot"></span> Out of Stock</span>`;
      }

      const isSelected = selectedLedger.has(item.code);

      return `
        <tr class="${isSelected ? 'inv-row-selected' : ''}">
          <td class="text-center no-print inv-chk-cell" style="width: 38px;">
            <input type="checkbox" class="form-check-input inv-row-chk" data-type="ledger" data-id="${item.code}" ${isSelected ? 'checked' : ''} title="Select SKU ${item.code}">
          </td>
          <td class="text-center text-muted" style="width: 40px;">${idx + 1}</td>
          <td><div class="fw-semibold text-dark">${escapeHtml(item.name)}</div></td>
          <td><span class="inv-brand-badge">${escapeHtml(item.brand)}</span></td>
          <td style="max-width: 220px;" class="text-secondary small">${escapeHtml(item.spec)}</td>
          <td class="text-end font-monospace">${fmtRupees(item.buyingPrice)}</td>
          <td class="text-center font-monospace fw-bold ${item.inHandQty === 0 ? 'text-danger' : 'text-emerald-700'}" style="font-size:0.88rem;">
            ${fmtQty(item.inHandQty)} <span class="text-muted small fw-normal">${escapeHtml(item.unit || 'Nos')}</span>
          </td>
          <td class="text-end font-monospace fw-bold text-dark" style="font-size:0.85rem;">
            ${fmtRupees(item.totalStockValuation)}
          </td>
          <td>${statusBadge}</td>
          <td class="text-center text-nowrap no-print" style="width: 140px;">
            <button class="inv-row-btn btn-row-dispatch" onclick="InventoryApp.openDispatchModalFor('${item.code}')" title="Dispatch to Project Site">
              🚚
            </button>
            <button class="inv-row-btn btn-row-stockin" onclick="InventoryApp.openStockInModalFor('${item.code}')" title="Inward Stock In">
              + In
            </button>
            <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openEditItemModal('${item.code}')" title="Edit SKU">
              ✏️
            </button>
            <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteItem('${item.code}')" title="Delete SKU">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const totalInHand = rows.reduce((s, r) => s + r.inHandQty, 0);
    const totalValuation = rows.reduce((s, r) => s + r.totalStockValuation, 0);

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="5" class="text-uppercase text-secondary fs-8">Total (${rows.length} Catalog SKUs)</td>
          <td class="text-end font-monospace text-muted">—</td>
          <td class="text-center font-monospace text-primary fs-7">${fmtQty(totalInHand)}</td>
          <td class="text-end font-monospace text-emerald-700 fs-7">${fmtRupees(totalValuation)}</td>
          <td colspan="2"></td>
        </tr>
      `;
    }

    updateHeaderCheckboxState('ledger');
    updateBulkActionBar();
  }

  function getFilteredDispatches() {
    let rows = [...dispatches];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => 
        (r.challanNo && r.challanNo.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q)) ||
        (r.itemCode && r.itemCode.toLowerCase().includes(q)) ||
        (r.vehicle && r.vehicle.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q)) ||
        (r.docName && r.docName.toLowerCase().includes(q))
      );
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  }

  function renderDispatchesTable() {
    const tbody = document.getElementById('invDispatchesTbody');
    const tfoot = document.getElementById('invDispatchesTfoot');
    if (!tbody) return;

    // Prune stale selection
    const currentIds = new Set(dispatches.map(d => d.id));
    for (const id of selectedDispatches) {
      if (!currentIds.has(id)) selectedDispatches.delete(id);
    }

    const rows = getFilteredDispatches();

    const tabCount = document.getElementById('tabCountDispatches');
    if (tabCount) tabCount.textContent = rows.length;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" class="text-center py-5 text-muted">
            <div class="py-4">
              <div class="fs-6 fw-semibold text-secondary mb-1">No site dispatches recorded</div>
              <div class="small text-muted mb-3">Record equipment dispatches to track site material consumption.</div>
              <button type="button" class="inv-btn inv-btn-dispatch" onclick="InventoryApp.openDispatchModal()">🚚 Dispatch Material</button>
            </div>
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('dispatches');
      updateBulkActionBar();
      return;
    }

    tbody.innerHTML = rows.map((disp, idx) => {
      const itm = items.find(i => i.code === disp.itemCode) || {};
      const unitBuyingCost = Number(disp.unitBuyingPrice) || itm.buyingPrice || 0;
      const totalCost = Number(disp.dispatchedCost) || (Number(disp.qty) * unitBuyingCost);
      const transportCost = Number(disp.transportCost) || 0;

      let docBadge = `<span class="text-muted small" style="font-size:0.75rem;">—</span>`;
      if (disp.docName) {
        docBadge = `
          <button type="button" class="inv-row-btn" onclick="InventoryApp.viewDoc('${disp.id}', 'dispatch')" title="Download / View ${escapeHtml(disp.docName)}">
            📄 <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(disp.docName)}</span>
          </button>
        `;
      }

      const isSelected = selectedDispatches.has(disp.id);

      return `
        <tr class="${isSelected ? 'inv-row-selected' : ''}">
          <td class="text-center no-print inv-chk-cell" style="width: 38px;">
            <input type="checkbox" class="form-check-input inv-row-chk" data-type="dispatches" data-id="${disp.id}" ${isSelected ? 'checked' : ''} title="Select Dispatch ${disp.id}">
          </td>
          <td class="text-center text-muted" style="width: 40px;">${idx + 1}</td>
          <td class="font-monospace text-secondary text-nowrap">${disp.date}</td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(disp.siteName)}</div>
            <div class="text-muted small">${escapeHtml(disp.remarks || '')}</div>
          </td>
          <td>
            <div class="fw-medium text-dark">${escapeHtml(itm.name || disp.itemCode)}</div>
            <div class="inv-sku-code mt-0.5">${disp.itemCode}</div>
          </td>
          <td>
            <div class="inv-brand-badge mb-0.5">${escapeHtml(itm.brand || '—')}</div>
            <div class="text-muted small" style="max-width:180px;">${escapeHtml(itm.spec || '')}</div>
          </td>
          <td class="text-center font-monospace fw-bold text-dark">${fmtQty(disp.qty)} <span class="text-muted small fw-normal">${itm.unit || 'Nos'}</span></td>
          <td class="text-end font-monospace text-secondary">${fmtRupees(unitBuyingCost)}</td>
          <td class="text-end font-monospace fw-bold text-amber-700" style="font-size:0.86rem;">
            ${fmtRupees(totalCost)}
          </td>
          <td class="text-end font-monospace text-slate-700">
            ${transportCost > 0 ? fmtRupees(transportCost) : '—'}
          </td>
          <td>${docBadge}</td>
          <td class="text-secondary small text-nowrap">${escapeHtml(disp.vehicle || 'Direct Delivery')}</td>
          <td class="text-center text-nowrap no-print" style="width: 95px;">
            <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openEditDispatchModal('${disp.id}')" title="Edit Dispatch">✏️</button>
            <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteDispatch('${disp.id}')" title="Delete Dispatch">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    const grandMaterialCost = rows.reduce((s, r) => s + (Number(r.dispatchedCost) || (Number(r.qty) * (Number(r.unitBuyingPrice) || 0))), 0);
    const grandTransportCost = rows.reduce((s, r) => s + (Number(r.transportCost) || 0), 0);
    const totalQtyDisp = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="6" class="text-uppercase text-secondary fs-8">Total Dispatched Site Material Cost (${rows.length} Dispatches)</td>
          <td class="text-center font-monospace fw-bold">${fmtQty(totalQtyDisp)}</td>
          <td class="text-end font-monospace text-muted">—</td>
          <td class="text-end font-monospace text-amber-700 fs-7 fw-bold">${fmtRupees(grandMaterialCost)}</td>
          <td class="text-end font-monospace text-slate-800 fs-8 fw-bold">${fmtRupees(grandTransportCost)}</td>
          <td colspan="3"></td>
        </tr>
      `;
    }

    updateHeaderCheckboxState('dispatches');
    updateBulkActionBar();
  }

  function getFilteredInwards() {
    let rows = [...inwards];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => 
        (r.invoiceNo && r.invoiceNo.toLowerCase().includes(q)) ||
        (r.supplier && r.supplier.toLowerCase().includes(q)) ||
        (r.itemCode && r.itemCode.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q)) ||
        (r.docName && r.docName.toLowerCase().includes(q))
      );
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  }

  function renderInwardsTable() {
    const tbody = document.getElementById('invInwardsTbody');
    const tfoot = document.getElementById('invInwardsTfoot');
    if (!tbody) return;

    // Prune stale selection
    const currentIds = new Set(inwards.map(i => i.id));
    for (const id of selectedInwards) {
      if (!currentIds.has(id)) selectedInwards.delete(id);
    }

    const rows = getFilteredInwards();

    const tabCount = document.getElementById('tabCountInwards');
    if (tabCount) tabCount.textContent = rows.length;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center py-5 text-muted">
            <div class="py-4">
              <div class="fs-6 fw-semibold text-secondary mb-1">No inward purchases recorded</div>
              <div class="small text-muted mb-3">Record inward deliveries from suppliers to increase godown stock.</div>
              <button type="button" class="inv-btn inv-btn-stockin" onclick="InventoryApp.openStockInModal()">+ Stock In</button>
            </div>
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('inwards');
      updateBulkActionBar();
      return;
    }

    tbody.innerHTML = rows.map((inw, idx) => {
      const itm = items.find(i => i.code === inw.itemCode) || {};
      const unitPrice = Number(inw.unitPrice) || itm.buyingPrice || 0;
      const totalCost = Number(inw.totalCost) || (Number(inw.qty) * unitPrice);

      let docBadge = `<span class="text-muted small" style="font-size:0.75rem;">—</span>`;
      if (inw.docName) {
        docBadge = `
          <button type="button" class="inv-row-btn" onclick="InventoryApp.viewDoc('${inw.id}', 'inward')" title="Download / View ${escapeHtml(inw.docName)}">
            📄 <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(inw.docName)}</span>
          </button>
        `;
      }

      const isSelected = selectedInwards.has(inw.id);

      return `
        <tr class="${isSelected ? 'inv-row-selected' : ''}">
          <td class="text-center no-print inv-chk-cell" style="width: 38px;">
            <input type="checkbox" class="form-check-input inv-row-chk" data-type="inwards" data-id="${inw.id}" ${isSelected ? 'checked' : ''} title="Select Inward ${inw.id}">
          </td>
          <td class="text-center text-muted" style="width: 40px;">${idx + 1}</td>
          <td class="font-monospace text-secondary text-nowrap">${inw.date}</td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(inw.supplier)}</div>
            <div class="text-muted small">${escapeHtml(inw.remarks || '')}</div>
          </td>
          <td>
            <div class="fw-medium text-dark">${escapeHtml(itm.name || inw.itemCode)}</div>
            <div class="inv-sku-code mt-0.5">${inw.itemCode}</div>
          </td>
          <td>
            <div class="inv-brand-badge mb-0.5">${escapeHtml(itm.brand || '—')}</div>
            <div class="text-muted small" style="max-width:180px;">${escapeHtml(itm.spec || '')}</div>
          </td>
          <td class="text-center font-monospace fw-bold text-dark">${fmtQty(inw.qty)} <span class="text-muted small fw-normal">${itm.unit || 'Nos'}</span></td>
          <td class="text-end font-monospace text-secondary">${fmtRupees(unitPrice)}</td>
          <td class="text-end font-monospace fw-bold text-emerald-700" style="font-size:0.86rem;">
            ${fmtRupees(totalCost)}
          </td>
          <td>${docBadge}</td>
          <td class="text-secondary small text-nowrap">${escapeHtml(inw.location || 'Main Godown')}</td>
          <td class="text-center text-nowrap no-print" style="width: 95px;">
            <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openEditInwardModal('${inw.id}')" title="Edit Inward">✏️</button>
            <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteInward('${inw.id}')" title="Delete Inward">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    const grandInwCost = rows.reduce((s, r) => s + (Number(r.totalCost) || (Number(r.qty) * (Number(r.unitPrice) || 0))), 0);
    const totalQtyInw = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="6" class="text-uppercase text-secondary fs-8">Total Inward Purchase Cost (${rows.length} Consignments)</td>
          <td class="text-center font-monospace fw-bold">${fmtQty(totalQtyInw)}</td>
          <td class="text-end font-monospace text-muted">—</td>
          <td class="text-end font-monospace text-emerald-700 fs-7 fw-bold">${fmtRupees(grandInwCost)}</td>
          <td colspan="3"></td>
        </tr>
      `;
    }

    updateHeaderCheckboxState('inwards');
    updateBulkActionBar();
  }

  // --- Multi-Selection & Bulk Deletion Helpers ---
  function updateHeaderCheckboxState(type) {
    let chkAll = null;
    let visibleRows = [];
    let targetSet = null;

    if (type === 'ledger') {
      chkAll = document.getElementById('chkSelectAllLedger');
      visibleRows = getFilteredLedgerItems();
      targetSet = selectedLedger;
    } else if (type === 'dispatches') {
      chkAll = document.getElementById('chkSelectAllDispatches');
      visibleRows = getFilteredDispatches();
      targetSet = selectedDispatches;
    } else if (type === 'inwards') {
      chkAll = document.getElementById('chkSelectAllInwards');
      visibleRows = getFilteredInwards();
      targetSet = selectedInwards;
    }

    if (!chkAll) return;

    if (visibleRows.length === 0) {
      chkAll.checked = false;
      chkAll.indeterminate = false;
      return;
    }

    const selectedCount = visibleRows.filter(r => targetSet.has(type === 'ledger' ? r.code : r.id)).length;
    if (selectedCount === visibleRows.length) {
      chkAll.checked = true;
      chkAll.indeterminate = false;
    } else if (selectedCount > 0) {
      chkAll.checked = false;
      chkAll.indeterminate = true;
    } else {
      chkAll.checked = false;
      chkAll.indeterminate = false;
    }
  }

  function updateBulkActionBar() {
    const bar = document.getElementById('invBulkActionBar');
    const badge = document.getElementById('invBulkBadge');
    const text = document.getElementById('invBulkText');
    const btnDelete = document.getElementById('btnDeleteSelected');
    const headerBtn = document.getElementById('btnHeaderDeleteSelected');
    const headerCount = document.getElementById('headerSelectedCount');

    let count = 0;
    let label = 'item';
    let labelPlural = 'items';

    if (activeTab === 'ledger') {
      count = selectedLedger.size;
      label = 'equipment SKU';
      labelPlural = 'equipment SKUs';
    } else if (activeTab === 'dispatches') {
      count = selectedDispatches.size;
      label = 'site dispatch';
      labelPlural = 'site dispatches';
    } else if (activeTab === 'inwards') {
      count = selectedInwards.size;
      label = 'inward purchase';
      labelPlural = 'inward purchases';
    }

    if (count > 0) {
      if (bar) bar.style.display = 'flex';
      if (badge) badge.textContent = count;
      if (text) text.textContent = `${count} ${count === 1 ? label : labelPlural} selected for deletion`;
      if (btnDelete) btnDelete.innerHTML = `🗑️ Delete Selected (${count})`;
      if (headerBtn) {
        headerBtn.style.display = 'inline-flex';
        if (headerCount) headerCount.textContent = count;
      }
    } else {
      if (bar) bar.style.display = 'none';
      if (headerBtn) headerBtn.style.display = 'none';
    }
  }

  function toggleSelectRow(type, id, isChecked) {
    const targetSet = type === 'ledger' ? selectedLedger 
                    : type === 'dispatches' ? selectedDispatches 
                    : selectedInwards;

    if (isChecked) {
      targetSet.add(id);
    } else {
      targetSet.delete(id);
    }

    const chk = document.querySelector(`.inv-row-chk[data-type="${type}"][data-id="${id}"]`);
    if (chk) {
      chk.checked = isChecked;
      const tr = chk.closest('tr');
      if (tr) tr.classList.toggle('inv-row-selected', isChecked);
    }

    updateHeaderCheckboxState(type);
    updateBulkActionBar();
  }

  function handleSelectAll(type, checked) {
    if (type === 'ledger') {
      const visible = getFilteredLedgerItems();
      visible.forEach(r => {
        if (checked) selectedLedger.add(r.code);
        else selectedLedger.delete(r.code);
      });
      renderLedgerTable();
    } else if (type === 'dispatches') {
      const visible = getFilteredDispatches();
      visible.forEach(r => {
        if (checked) selectedDispatches.add(r.id);
        else selectedDispatches.delete(r.id);
      });
      renderDispatchesTable();
    } else if (type === 'inwards') {
      const visible = getFilteredInwards();
      visible.forEach(r => {
        if (checked) selectedInwards.add(r.id);
        else selectedInwards.delete(r.id);
      });
      renderInwardsTable();
    }
    updateBulkActionBar();
  }

  function clearSelection(tab = activeTab) {
    if (tab === 'ledger') {
      selectedLedger.clear();
      renderLedgerTable();
    } else if (tab === 'dispatches') {
      selectedDispatches.clear();
      renderDispatchesTable();
    } else if (tab === 'inwards') {
      selectedInwards.clear();
      renderInwardsTable();
    }
    updateBulkActionBar();
  }

  async function deleteDbBatch(table, pkField, ids) {
    if (typeof DB === 'undefined' || !ids || ids.length === 0) return;
    try {
      if (typeof DB.deleteBatch === 'function') {
        await DB.deleteBatch(table, r => {
          const val = String(r[pkField] || r[pkField.toLowerCase()] || r.id || r.code || '');
          return ids.includes(val);
        }).catch(err => console.warn(`[DB] ${table} deleteBatch error:`, err));
      }
      if (DB.getMode && DB.getMode() === 'postgres') {
        await fetch(`/api/delete-batch?table=${table}&matchField=${pkField}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchValues: ids })
        }).catch(async () => {
          await Promise.all(ids.map(id =>
            fetch(`/api/delete?table=${table}&matchField=${pkField}&matchValue=${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {})
          ));
        });
      }
    } catch (e) {
      console.warn(`[DB] Error during deleteDbBatch for ${table}:`, e);
    }
  }

  async function deleteSelectedLedger() {
    const selectedCodes = Array.from(selectedLedger);
    if (selectedCodes.length === 0) return;

    const targetItems = items.filter(i => selectedCodes.includes(i.code));
    const refInwards = inwards.filter(i => selectedCodes.includes(i.itemCode));
    const refDispatches = dispatches.filter(d => selectedCodes.includes(d.itemCode));

    let warning = `Are you sure you want to delete ${selectedCodes.length} selected equipment SKU(s) from the catalog?`;
    if (refInwards.length > 0 || refDispatches.length > 0) {
      warning += `\n\n⚠️ Warning: The selected items are referenced in ${refInwards.length} inward purchases and ${refDispatches.length} site dispatches. Deleting them will remove these SKUs from the live stock catalog.`;
    }
    warning += `\n\nThis action cannot be undone.`;

    if (!confirm(warning)) return;

    items = items.filter(i => !selectedCodes.includes(i.code));
    selectedLedger.clear();
    saveData();

    await deleteDbBatch('inventory_items', 'ItemCode', selectedCodes);

    const itemNames = targetItems.map(i => i.name).filter(Boolean);
    if (itemNames.length > 0) {
      await deleteDbBatch('items', 'ItemName', itemNames);
    }

    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Successfully deleted ${selectedCodes.length} equipment SKU(s).`, 'info');
    }
  }

  async function deleteSelectedDispatches() {
    const selectedIds = Array.from(selectedDispatches);
    if (selectedIds.length === 0) return;

    const targetDispatches = dispatches.filter(d => selectedIds.includes(d.id));
    const totalQty = targetDispatches.reduce((s, d) => s + (Number(d.qty) || 0), 0);

    const warning = `Are you sure you want to delete ${selectedIds.length} selected site dispatch record(s)?\n\nThis will restore ${fmtQty(totalQty)} units back to physical warehouse stock.\n\nThis action cannot be undone.`;
    if (!confirm(warning)) return;

    dispatches = dispatches.filter(d => !selectedIds.includes(d.id));
    selectedDispatches.clear();
    saveData();

    await deleteDbBatch('inventory_dispatches', 'DispatchID', selectedIds);

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'dispatches') renderDispatchesTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Successfully deleted ${selectedIds.length} site dispatch record(s). Stock restored to warehouse inventory.`, 'info');
    }
  }

  async function deleteSelectedInwards() {
    const selectedIds = Array.from(selectedInwards);
    if (selectedIds.length === 0) return;

    const targetInwards = inwards.filter(i => selectedIds.includes(i.id));
    const totalQty = targetInwards.reduce((s, i) => s + (Number(i.qty) || 0), 0);

    const warning = `Are you sure you want to delete ${selectedIds.length} selected inward consignment record(s)?\n\nThis will deduct ${fmtQty(totalQty)} units from warehouse stock calculation.\n\nThis action cannot be undone.`;
    if (!confirm(warning)) return;

    inwards = inwards.filter(i => !selectedIds.includes(i.id));
    selectedInwards.clear();
    saveData();

    await deleteDbBatch('inventory_inwards', 'InwardID', selectedIds);

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Successfully deleted ${selectedIds.length} inward record(s). Warehouse stock updated.`, 'info');
    }
  }

  async function deleteSelected() {
    if (activeTab === 'ledger') {
      await deleteSelectedLedger();
    } else if (activeTab === 'dispatches') {
      await deleteSelectedDispatches();
    } else if (activeTab === 'inwards') {
      await deleteSelectedInwards();
    }
  }

  // --- Dynamic Grouped Dropdown Generators ---
  function buildGroupedItemOptions(selectedCode, mode = 'stockin') {
    const ledger = getCalculatedStockLedger();
    const categoryOrder = ['Panels', 'Inverters', 'Cables', 'Hardware', 'Electricals', 'Conduit', 'Earthing', 'Others'];

    const sortedLedger = [...ledger].sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      const orderA = catA !== -1 ? catA : 999;
      const orderB = catB !== -1 ? catB : 999;
      if (orderA !== orderB) return orderA - orderB;
      const nameCompare = (a.name || '').localeCompare(b.name || '');
      if (nameCompare !== 0) return nameCompare;
      return (a.brand || '').localeCompare(b.brand || '');
    });

    const groupsMap = new Map();

    sortedLedger.forEach(item => {
      const groupKey = `${item.name || 'Equipment'} (${item.category || 'General'})`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey).push(item);
    });

    let html = '';
    for (const [groupName, variants] of groupsMap.entries()) {
      html += `<optgroup label="${escapeHtml(groupName)}">`;
      variants.forEach(v => {
        const isSelected = v.code === selectedCode ? 'selected' : '';
        const brandSpec = `${escapeHtml(v.brand || '')}${v.spec ? ' — ' + escapeHtml(v.spec) : ''}`;
        if (mode === 'dispatch') {
          const stockLabel = v.inHandQty > 0 ? `Stock: ${v.inHandQty} ${v.unit || 'Nos'}` : `Stock: 0 ${v.unit || 'Nos'}`;
          html += `<option value="${v.code}" ${isSelected}>${brandSpec} [${stockLabel}] — ${fmtRupees(v.buyingPrice)}</option>`;
        } else {
          html += `<option value="${v.code}" ${isSelected}>${brandSpec} — ${fmtRupees(v.buyingPrice)}</option>`;
        }
      });
      html += `</optgroup>`;
    }
    return html;
  }

  // --- Modal 1: Stock In Consignment ---
  function initStockInModal() {
    const btnAdd = document.getElementById('btnAddInwRow');
    if (btnAdd) btnAdd.addEventListener('click', () => addInwRow());

    const btnSubmit = document.getElementById('btnSubmitStockIn');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveStockIn);

    setupFileUploads();
  }

  function addInwRow(itemCode = null, qty = 1, unitPrice = null) {
    const ledger = getCalculatedStockLedger();
    const selectedItem = itemCode ? (ledger.find(i => i.code === itemCode) || ledger[0]) : ledger[0];

    inwardRows.push({
      id: 'inw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      itemCode: selectedItem ? selectedItem.code : '',
      qty: qty,
      unitPrice: unitPrice !== null ? unitPrice : (selectedItem ? selectedItem.buyingPrice : 0)
    });

    renderInwRows();
    recalcInwardTotals();
  }

  function removeInwRow(rowId) {
    if (inwardRows.length <= 1) return;
    inwardRows = inwardRows.filter(r => r.id !== rowId);
    renderInwRows();
    recalcInwardTotals();
  }

  function renderInwRows() {
    const tbody = document.getElementById('inwItemsTableBody');
    if (!tbody) return;

    const ledger = getCalculatedStockLedger();

    tbody.innerHTML = inwardRows.map((row) => {
      const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
      const lineTotal = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);

      return `
        <tr data-row-id="${row.id}">
          <td style="min-width: 280px;">
            <select class="form-select form-select-sm inw-row-item-select" data-row-id="${row.id}">
              ${buildGroupedItemOptions(row.itemCode, 'stockin')}
            </select>
          </td>
          <td class="text-center font-monospace text-secondary">${item.unit || 'Nos'}</td>
          <td>
            <input type="number" min="1" step="any" class="form-control form-control-sm text-center font-monospace inw-row-qty" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="Qty">
          </td>
          <td>
            <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace inw-row-price" data-row-id="${row.id}" value="${row.unitPrice !== undefined ? row.unitPrice : (item.buyingPrice || 0)}">
          </td>
          <td class="text-end font-monospace fw-bold text-success inw-row-total" data-row-id="${row.id}">
            ${fmtRupees(lineTotal)}
          </td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger p-0 d-flex align-items-center justify-content-center btn-remove-inw-row" data-row-id="${row.id}" style="width:24px; height:24px;" title="Remove" ${inwardRows.length <= 1 ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>✕</button>
          </td>
        </tr>
      `;
    }).join('');

    attachInwRowHandlers(tbody, ledger);
  }

  function attachInwRowHandlers(tbody, ledger) {
    // 1. Equipment select change
    tbody.querySelectorAll('.inw-row-item-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const rowId = sel.getAttribute('data-row-id');
        const code = sel.value;
        const row = inwardRows.find(r => r.id === rowId);
        if (row && code) {
          row.itemCode = code;
          const selectedMaster = ledger.find(it => it.code === code);
          if (selectedMaster) {
            row.unitPrice = selectedMaster.buyingPrice;
          }
          renderInwRows();
          recalcInwardTotals();
        }
      });
    });

    // 2. Quantity & price inputs
    tbody.querySelectorAll('.inw-row-qty').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = inwardRows.find(r => r.id === rowId);
        if (row) {
          row.qty = input.value === '' ? '' : Number(input.value);
          const totalCell = tbody.querySelector(`.inw-row-total[data-row-id="${rowId}"]`);
          const total = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
          if (totalCell) totalCell.textContent = fmtRupees(total);
          recalcInwardTotals();
        }
      });
    });

    tbody.querySelectorAll('.inw-row-price').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = inwardRows.find(r => r.id === rowId);
        if (row) {
          row.unitPrice = Number(input.value) || 0;
          const totalCell = tbody.querySelector(`.inw-row-total[data-row-id="${rowId}"]`);
          const total = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
          if (totalCell) totalCell.textContent = fmtRupees(total);
          recalcInwardTotals();
        }
      });
    });

    // 3. Remove row button
    tbody.querySelectorAll('.btn-remove-inw-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-row-id');
        removeInwRow(rowId);
      });
    });
  }

  function recalcInwardTotals() {
    let totalUnits = 0;
    let totalValuation = 0;

    inwardRows.forEach(r => {
      const q = Number(r.qty) || 0;
      const p = Number(r.unitPrice) || 0;
      totalUnits += q;
      totalValuation += (q * p);
    });

    const unitsEl = document.getElementById('inwSummaryTotalUnits');
    const costEl = document.getElementById('inwDisplayTotalCost');

    if (unitsEl) unitsEl.textContent = `Total Units: ${fmtQty(totalUnits)}`;
    if (costEl) costEl.textContent = fmtRupees(totalValuation);
  }

  function openStockInModal(preselectedCode = null) {
    const modalEl = document.getElementById('modalStockIn');
    if (!modalEl) return;

    const dateInput = document.getElementById('inwDate');
    const supplierInput = document.getElementById('inwSupplier');
    const locationInput = document.getElementById('inwLocation');
    const remarksInput = document.getElementById('inwRemarks');

    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (supplierInput) supplierInput.value = '';
    if (locationInput) locationInput.value = 'Main Godown — Bay A';
    if (remarksInput) remarksInput.value = '';

    // Reset file upload
    inwardDocFile = null;
    const inwFileInput = document.getElementById('inwDocFileInput');
    if (inwFileInput) inwFileInput.value = '';
    const inwBadge = document.getElementById('inwFileBadge');
    if (inwBadge) inwBadge.style.display = 'none';
    const btnInwUpload = document.getElementById('btnInwDocUpload');
    if (btnInwUpload) btnInwUpload.style.display = 'inline-flex';

    const ledger = getCalculatedStockLedger();
    const initialItem = preselectedCode ? (ledger.find(i => i.code === preselectedCode) || ledger[0]) : ledger[0];

    inwardRows = [
      {
        id: 'inw_' + Date.now(),
        itemCode: initialItem ? initialItem.code : '',
        qty: 1,
        unitPrice: initialItem ? initialItem.buyingPrice : 0
      }
    ];

    renderInwRows();
    recalcInwardTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveStockIn() {
    const supplier = document.getElementById('inwSupplier')?.value.trim();
    const date = document.getElementById('inwDate')?.value || new Date().toISOString().slice(0, 10);
    const location = document.getElementById('inwLocation')?.value.trim() || 'Main Godown';
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
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Select an equipment item`, 'warning');
        return;
      }
      const qty = Number(r.qty);
      if (!qty || qty <= 0) {
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Enter a valid quantity`, 'warning');
        return;
      }
    }

    const batchInvoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    let totalConsignmentCost = 0;
    let totalConsignmentUnits = 0;

    inwardRows.forEach((r, idx) => {
      const qty = Number(r.qty);
      const unitPrice = Number(r.unitPrice) || 0;
      const totalCost = qty * unitPrice;
      totalConsignmentCost += totalCost;
      totalConsignmentUnits += qty;

      const newInward = {
        id: `INW-${Date.now()}-${idx + 1}`,
        date,
        invoiceNo: batchInvoiceNo,
        supplier,
        itemCode: r.itemCode,
        qty,
        unitPrice,
        totalCost,
        location,
        remarks,
        docName: inwardDocFile ? inwardDocFile.name : null,
        docData: inwardDocFile ? inwardDocFile.data : null
      };

      inwards.unshift(newInward);

      const masterItem = items.find(it => it.code === r.itemCode);
      if (masterItem && unitPrice > 0) {
        masterItem.buyingPrice = unitPrice;
      }

      if (typeof DB !== 'undefined') {
        DB.insert('inventory_inwards', {
          InwardID: newInward.id,
          Date: newInward.date,
          InvoiceNo: newInward.invoiceNo,
          Supplier: newInward.supplier,
          ItemCode: newInward.itemCode,
          Quantity: newInward.qty,
          UnitPrice: newInward.unitPrice,
          TotalCost: newInward.totalCost,
          Location: newInward.location,
          Remarks: newInward.remarks,
          DocumentName: newInward.docName,
          DocumentData: newInward.docData,
          CreatedAt: new Date().toISOString()
        }).catch(() => {});

        if (masterItem && unitPrice > 0) {
          DB.update('inventory_items', row => (row.ItemCode || row.code) === r.itemCode, {
            BuyingPrice: unitPrice
          }).catch(() => {});
        }
      }
    });

    saveData();

    const modalEl = document.getElementById('modalStockIn');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Successfully stocked in ${inwardRows.length} items (${fmtQty(totalConsignmentUnits)} units). Total: ${fmtRupees(totalConsignmentCost)}.`, 'success');
    }
  }

  // --- Modal 2: Site Dispatch ---
  function initDispatchModal() {
    const btnAdd = document.getElementById('btnAddDspRow');
    if (btnAdd) btnAdd.addEventListener('click', () => addDspRow());

    const transportInput = document.getElementById('dspTransportCost');
    if (transportInput) {
      transportInput.addEventListener('input', () => recalcDispatchTotals());
    }

    const btnSubmit = document.getElementById('btnSubmitDispatch');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveDispatch);
  }

  function addDspRow(itemCode = null, qty = 1) {
    const ledger = getCalculatedStockLedger();
    const availableItems = ledger.filter(i => i.inHandQty > 0);
    const selectedItem = itemCode ? (ledger.find(i => i.code === itemCode) || ledger[0]) : (availableItems[0] || ledger[0]);

    dispatchRows.push({
      id: 'dsp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      itemCode: selectedItem ? selectedItem.code : '',
      qty: selectedItem && selectedItem.inHandQty > 0 ? qty : ''
    });

    renderDspRows();
    recalcDispatchTotals();
  }

  function removeDspRow(rowId) {
    if (dispatchRows.length <= 1) return;
    dispatchRows = dispatchRows.filter(r => r.id !== rowId);
    renderDspRows();
    recalcDispatchTotals();
  }

  function renderDspRows() {
    const tbody = document.getElementById('dspItemsTableBody');
    if (!tbody) return;

    const ledger = getCalculatedStockLedger();

    tbody.innerHTML = dispatchRows.map((row) => {
      const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
      const inHand = Number(item.inHandQty) || 0;
      const qty = Number(row.qty) || 0;
      const unitPrice = Number(item.buyingPrice) || 0;
      const lineTotal = qty * unitPrice;
      const isOverStock = qty > inHand;

      return `
        <tr data-row-id="${row.id}" class="${isOverStock ? 'table-danger' : ''}">
          <td style="min-width: 280px;">
            <select class="form-select form-select-sm dsp-row-item-select ${isOverStock ? 'is-invalid border-danger' : ''}" data-row-id="${row.id}">
              ${buildGroupedItemOptions(row.itemCode, 'dispatch')}
            </select>
          </td>
          <td class="text-center font-monospace">
            <span class="badge ${inHand > 0 ? 'bg-light text-success border' : 'bg-light text-danger border'}">
              ${inHand} ${item.unit || 'Nos'}
            </span>
          </td>
          <td>
            <input type="number" min="1" max="${inHand}" step="any" class="form-control form-control-sm text-center font-monospace dsp-row-qty ${isOverStock ? 'is-invalid' : ''}" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="Qty">
          </td>
          <td class="text-end font-monospace text-secondary">
            ${fmtRupees(unitPrice)}
          </td>
          <td class="text-end font-monospace fw-bold text-dark dsp-row-total" data-row-id="${row.id}">
            ${fmtRupees(lineTotal)}
          </td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger p-0 d-flex align-items-center justify-content-center btn-remove-dsp-row" data-row-id="${row.id}" style="width:24px; height:24px;" title="Remove" ${dispatchRows.length <= 1 ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>✕</button>
          </td>
        </tr>
      `;
    }).join('');

    attachDspRowHandlers(tbody, ledger);
  }

  function attachDspRowHandlers(tbody, ledger) {
    // 1. Equipment select change
    tbody.querySelectorAll('.dsp-row-item-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const rowId = sel.getAttribute('data-row-id');
        const code = sel.value;
        const row = dispatchRows.find(r => r.id === rowId);
        if (row && code) {
          row.itemCode = code;
          const targetItem = ledger.find(i => i.code === code);
          if (targetItem && targetItem.inHandQty > 0 && (!row.qty || Number(row.qty) === 0)) {
            row.qty = 1;
          }
          renderDspRows();
          recalcDispatchTotals();
        }
      });
    });

    // 2. Quantity inputs
    tbody.querySelectorAll('.dsp-row-qty').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = dispatchRows.find(r => r.id === rowId);
        if (row) {
          row.qty = input.value === '' ? '' : Number(input.value);
          const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
          const inHand = Number(item.inHandQty) || 0;
          const tr = tbody.querySelector(`tr[data-row-id="${rowId}"]`);
          const totalCell = tbody.querySelector(`.dsp-row-total[data-row-id="${rowId}"]`);
          const isOverStock = (Number(row.qty) || 0) > inHand;

          if (tr) tr.classList.toggle('table-danger', isOverStock);
          input.classList.toggle('is-invalid', isOverStock);

          const total = (Number(row.qty) || 0) * (Number(item.buyingPrice) || 0);
          if (totalCell) totalCell.textContent = fmtRupees(total);
          recalcDispatchTotals();
        }
      });
    });

    // 3. Remove row button
    tbody.querySelectorAll('.btn-remove-dsp-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-row-id');
        removeDspRow(rowId);
      });
    });
  }

  function recalcDispatchTotals() {
    const ledger = getCalculatedStockLedger();
    let totalMaterialCost = 0;
    let totalUnits = 0;
    let hasOverStock = false;
    let hasEmptyOrZeroQty = false;

    dispatchRows.forEach(row => {
      const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
      const inHand = Number(item.inHandQty) || 0;
      const qty = Number(row.qty) || 0;
      if (qty <= 0) hasEmptyOrZeroQty = true;
      if (qty > inHand) hasOverStock = true;

      totalUnits += qty;
      totalMaterialCost += (qty * (Number(item.buyingPrice) || 0));
    });

    const transportCost = Number(document.getElementById('dspTransportCost')?.value) || 0;

    const unitsEl = document.getElementById('dspSummaryTotalUnits');
    const transportEl = document.getElementById('dspDisplayTransportCost');
    const totalCostEl = document.getElementById('dspCalculatedCost');
    const alertBox = document.getElementById('dspStockAlert');
    const submitBtn = document.getElementById('btnSubmitDispatch');

    if (unitsEl) unitsEl.textContent = `Total Units: ${fmtQty(totalUnits)}`;
    if (transportEl) transportEl.textContent = `Transport: ${fmtRupees(transportCost)}`;
    if (totalCostEl) totalCostEl.textContent = fmtRupees(totalMaterialCost);

    if (alertBox) {
      if (hasOverStock) {
        alertBox.style.display = 'block';
        alertBox.textContent = 'Requested quantity exceeds warehouse stock. Please adjust quantities.';
        if (submitBtn) submitBtn.disabled = true;
      } else if (hasEmptyOrZeroQty) {
        alertBox.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;
      } else {
        alertBox.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
      }
    }
  }

  function openDispatchModal(preselectedCode = null) {
    const modalEl = document.getElementById('modalSiteDispatch');
    if (!modalEl) return;

    const siteInput = document.getElementById('dspSiteName');
    const dateInput = document.getElementById('dspDate');
    const transportInput = document.getElementById('dspTransportCost');
    const vehicleInput = document.getElementById('dspVehicle');

    if (siteInput) siteInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (transportInput) transportInput.value = '';
    if (vehicleInput) vehicleInput.value = '';

    // Reset file upload
    dispatchDocFile = null;
    const dspFileInput = document.getElementById('dspDocFileInput');
    if (dspFileInput) dspFileInput.value = '';
    const dspBadge = document.getElementById('dspFileBadge');
    if (dspBadge) dspBadge.style.display = 'none';
    const btnDspUpload = document.getElementById('btnDspDocUpload');
    if (btnDspUpload) btnDspUpload.style.display = 'inline-flex';

    const ledger = getCalculatedStockLedger();
    const availableLedger = ledger.filter(i => i.inHandQty > 0);
    let targetItem = null;

    if (preselectedCode) {
      targetItem = ledger.find(i => i.code === preselectedCode);
    } else if (availableLedger.length > 0) {
      targetItem = availableLedger[0];
    } else {
      targetItem = ledger[0];
    }

    dispatchRows = [
      {
        id: 'dsp_' + Date.now(),
        itemCode: targetItem ? targetItem.code : '',
        qty: targetItem && targetItem.inHandQty > 0 ? 1 : ''
      }
    ];

    renderDspRows();
    recalcDispatchTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveDispatch() {
    const siteName = document.getElementById('dspSiteName')?.value.trim();
    const date = document.getElementById('dspDate')?.value || new Date().toISOString().slice(0, 10);
    const vehicle = document.getElementById('dspVehicle')?.value.trim() || 'Site Vehicle';
    const transportCost = Number(document.getElementById('dspTransportCost')?.value) || 0;

    if (!siteName) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Site / Project Name', 'warning');
      document.getElementById('dspSiteName')?.focus();
      return;
    }

    if (!dispatchRows || dispatchRows.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Please add at least one item to dispatch', 'warning');
      return;
    }

    const ledger = getCalculatedStockLedger();

    for (let i = 0; i < dispatchRows.length; i++) {
      const r = dispatchRows[i];
      const item = ledger.find(it => it.code === r.itemCode);
      if (!item) {
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Item not found in catalog`, 'warning');
        return;
      }
      const qty = Number(r.qty);
      if (!qty || qty <= 0) {
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Enter a valid quantity to dispatch`, 'warning');
        return;
      }
      if (qty > item.inHandQty) {
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Quantity exceeds available stock (${item.inHandQty})`, 'danger');
        return;
      }
    }

    const batchChallanNo = `DC-${Date.now().toString().slice(-4)}`;
    let totalDispatchedCost = 0;
    let totalDispatchedUnits = 0;

    dispatchRows.forEach((r, idx) => {
      const item = ledger.find(it => it.code === r.itemCode);
      const qty = Number(r.qty);
      const unitPrice = Number(item.buyingPrice) || 0;
      const dispatchedCost = qty * unitPrice;
      totalDispatchedCost += dispatchedCost;
      totalDispatchedUnits += qty;

      const newDispatch = {
        id: `DSP-${Date.now()}-${idx + 1}`,
        date,
        challanNo: batchChallanNo,
        siteName,
        itemCode: r.itemCode,
        qty,
        unitBuyingPrice: unitPrice,
        dispatchedCost,
        transportCost: idx === 0 ? transportCost : 0,
        vehicle,
        remarks: 'Project Site Handover',
        docName: dispatchDocFile ? dispatchDocFile.name : null,
        docData: dispatchDocFile ? dispatchDocFile.data : null
      };

      dispatches.unshift(newDispatch);

      if (typeof DB !== 'undefined') {
        DB.insert('inventory_dispatches', {
          DispatchID: newDispatch.id,
          Date: newDispatch.date,
          ChallanNo: newDispatch.challanNo,
          SiteName: newDispatch.siteName,
          ItemCode: newDispatch.itemCode,
          Quantity: newDispatch.qty,
          UnitBuyingPrice: newDispatch.unitBuyingPrice,
          DispatchedCost: newDispatch.dispatchedCost,
          TransportCost: newDispatch.transportCost,
          Vehicle: newDispatch.vehicle,
          Remarks: newDispatch.remarks,
          DocumentName: newDispatch.docName,
          DocumentData: newDispatch.docData,
          CreatedAt: new Date().toISOString()
        }).catch(() => {});
      }
    });

    saveData();

    const modalEl = document.getElementById('modalSiteDispatch');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'dispatches') renderDispatchesTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Dispatched ${dispatchRows.length} items (${fmtQty(totalDispatchedUnits)} units) to "${siteName}". Total Material Cost: ${fmtRupees(totalDispatchedCost)}.`, 'success');
    }
  }

  // --- Document File Uploads Setup ---
  function setupFileUploads() {
    // Inward Upload
    const btnInwUpload = document.getElementById('btnInwDocUpload');
    const inwFileInput = document.getElementById('inwDocFileInput');
    const inwBadge = document.getElementById('inwFileBadge');
    const inwFileName = document.getElementById('inwFileName');
    const inwFileSize = document.getElementById('inwFileSize');
    const btnRemoveInwFile = document.getElementById('btnRemoveInwFile');

    if (btnInwUpload && inwFileInput) {
      btnInwUpload.addEventListener('click', () => inwFileInput.click());
      inwFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          inwardDocFile = {
            name: file.name,
            size: fmtFileSize(file.size),
            type: file.type,
            data: loadEvent.target.result
          };
          if (inwFileName) inwFileName.textContent = file.name;
          if (inwFileSize) inwFileSize.textContent = `(${inwardDocFile.size})`;
          if (inwBadge) inwBadge.style.display = 'inline-flex';
          btnInwUpload.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnRemoveInwFile && inwFileInput) {
      btnRemoveInwFile.addEventListener('click', () => {
        inwardDocFile = null;
        inwFileInput.value = '';
        if (inwBadge) inwBadge.style.display = 'none';
        if (btnInwUpload) btnInwUpload.style.display = 'inline-flex';
      });
    }

    // Dispatch Upload
    const btnDspUpload = document.getElementById('btnDspDocUpload');
    const dspFileInput = document.getElementById('dspDocFileInput');
    const dspBadge = document.getElementById('dspFileBadge');
    const dspFileName = document.getElementById('dspFileName');
    const dspFileSize = document.getElementById('dspFileSize');
    const btnRemoveDspFile = document.getElementById('btnRemoveDspFile');

    if (btnDspUpload && dspFileInput) {
      btnDspUpload.addEventListener('click', () => dspFileInput.click());
      dspFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          dispatchDocFile = {
            name: file.name,
            size: fmtFileSize(file.size),
            type: file.type,
            data: loadEvent.target.result
          };
          if (dspFileName) dspFileName.textContent = file.name;
          if (dspFileSize) dspFileSize.textContent = `(${dispatchDocFile.size})`;
          if (dspBadge) dspBadge.style.display = 'inline-flex';
          btnDspUpload.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnRemoveDspFile && dspFileInput) {
      btnRemoveDspFile.addEventListener('click', () => {
        dispatchDocFile = null;
        dspFileInput.value = '';
        if (dspBadge) dspBadge.style.display = 'none';
        if (btnDspUpload) btnDspUpload.style.display = 'inline-flex';
      });
    }
  }

  // --- Document Viewer / Download ---
  function viewDoc(id, type) {
    const record = (type === 'dispatch') ? dispatches.find(d => d.id === id) : inwards.find(i => i.id === id);
    if (!record || !record.docName) {
      if (typeof UI !== 'undefined') UI.toast('No document attached', 'info');
      return;
    }

    if (record.docData) {
      const link = document.createElement('a');
      link.href = record.docData;
      link.download = record.docName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (typeof UI !== 'undefined') UI.toast(`Opened document: ${record.docName}`, 'success');
    } else {
      if (typeof UI !== 'undefined') UI.toast(`Document file: ${record.docName}`, 'info');
    }
  }

  // --- Setup File Uploads for Edit Modals ---
  function setupEditFileUploads() {
    // Inward Edit Upload
    const btnEditInwUpload = document.getElementById('btnEditInwUpload');
    const editInwDocInput = document.getElementById('editInwDocInput');
    const editInwBadge = document.getElementById('editInwFileBadge');
    const editInwFileName = document.getElementById('editInwFileName');
    const btnRemoveEditInwFile = document.getElementById('btnRemoveEditInwFile');

    if (btnEditInwUpload && editInwDocInput) {
      btnEditInwUpload.addEventListener('click', () => editInwDocInput.click());
      editInwDocInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          editInwardDocFile = {
            name: file.name,
            size: fmtFileSize(file.size),
            type: file.type,
            data: loadEvent.target.result
          };
          if (editInwFileName) editInwFileName.textContent = file.name;
          if (editInwBadge) editInwBadge.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnRemoveEditInwFile && editInwDocInput) {
      btnRemoveEditInwFile.addEventListener('click', () => {
        editInwardDocFile = null;
        editInwDocInput.value = '';
        if (editInwBadge) editInwBadge.style.display = 'none';
      });
    }

    // Dispatch Edit Upload
    const btnEditDspUpload = document.getElementById('btnEditDspUpload');
    const editDspDocInput = document.getElementById('editDspDocInput');
    const editDspBadge = document.getElementById('editDspFileBadge');
    const editDspFileName = document.getElementById('editDspFileName');
    const btnRemoveEditDspFile = document.getElementById('btnRemoveEditDspFile');

    if (btnEditDspUpload && editDspDocInput) {
      btnEditDspUpload.addEventListener('click', () => editDspDocInput.click());
      editDspDocInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          editDispatchDocFile = {
            name: file.name,
            size: fmtFileSize(file.size),
            type: file.type,
            data: loadEvent.target.result
          };
          if (editDspFileName) editDspFileName.textContent = file.name;
          if (editDspBadge) editDspBadge.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnRemoveEditDspFile && editDspDocInput) {
      btnRemoveEditDspFile.addEventListener('click', () => {
        editDispatchDocFile = null;
        editDspDocInput.value = '';
        if (editDspBadge) editDspBadge.style.display = 'none';
      });
    }
  }

  // --- SKU Catalog CRUD Operations ---
  function initNewItemModal() {
    const btnNewSku = document.getElementById('btnAddNewSku');
    if (btnNewSku) btnNewSku.addEventListener('click', () => openNewItemModal());

    const btnSubmit = document.getElementById('btnSubmitNewSku');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveNewItem);
  }

  function openNewItemModal() {
    const modalEl = document.getElementById('modalNewItem');
    if (!modalEl) return;

    const codeInput = document.getElementById('newSkuCode');
    const nameInput = document.getElementById('newSkuName');
    const brandInput = document.getElementById('newSkuBrand');
    const specInput = document.getElementById('newSkuSpec');
    const catInput = document.getElementById('newSkuCategory');
    const unitInput = document.getElementById('newSkuUnit');
    const priceInput = document.getElementById('newSkuPrice');
    const thresholdInput = document.getElementById('newSkuMinThreshold');

    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';
    if (brandInput) brandInput.value = '';
    if (specInput) specInput.value = '';
    if (catInput) catInput.value = 'Panels';
    if (unitInput) unitInput.value = 'Nos';
    if (priceInput) priceInput.value = '';
    if (thresholdInput) thresholdInput.value = '5';

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveNewItem() {
    const code = document.getElementById('newSkuCode')?.value.trim().toUpperCase();
    const name = document.getElementById('newSkuName')?.value.trim();
    const brand = document.getElementById('newSkuBrand')?.value.trim();
    const spec = document.getElementById('newSkuSpec')?.value.trim();
    const category = document.getElementById('newSkuCategory')?.value || 'Panels';
    const unit = document.getElementById('newSkuUnit')?.value || 'Nos';
    const buyingPrice = Number(document.getElementById('newSkuPrice')?.value) || 0;
    const minThreshold = Number(document.getElementById('newSkuMinThreshold')?.value) || 5;

    if (!code) {
      if (typeof UI !== 'undefined') UI.toast('Please enter a unique Item Code (SKU)', 'warning');
      document.getElementById('newSkuCode')?.focus();
      return;
    }
    if (items.some(i => (i.code || '').toLowerCase() === code.toLowerCase())) {
      if (typeof UI !== 'undefined') UI.toast(`Item Code "${code}" already exists in catalog`, 'danger');
      document.getElementById('newSkuCode')?.focus();
      return;
    }
    if (!name) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Equipment Name', 'warning');
      document.getElementById('newSkuName')?.focus();
      return;
    }
    if (!brand) {
      if (typeof UI !== 'undefined') UI.toast('Please enter Brand / Make', 'warning');
      document.getElementById('newSkuBrand')?.focus();
      return;
    }
    if (!spec) {
      if (typeof UI !== 'undefined') UI.toast('Please enter Specification / Model details', 'warning');
      document.getElementById('newSkuSpec')?.focus();
      return;
    }

    const newItem = {
      code,
      name,
      brand,
      spec,
      category,
      unit,
      buyingPrice,
      minThreshold,
      hsn: '',
      gst: 12,
      status: 'Active'
    };

    items.push(newItem);
    saveData();

    if (typeof DB !== 'undefined') {
      DB.insert('inventory_items', {
        ItemCode: newItem.code,
        ItemName: newItem.name,
        Brand: newItem.brand,
        Specification: newItem.spec,
        Category: newItem.category,
        Unit: newItem.unit,
        BuyingPrice: newItem.buyingPrice,
        MinThreshold: newItem.minThreshold,
        HSNCode: newItem.hsn,
        GSTPercent: newItem.gst,
        Status: 'Active',
        CreatedAt: new Date().toISOString()
      }).catch(err => console.warn('[Supabase] inventory_items insert error:', err));

      DB.insert('items', {
        ItemName: newItem.name,
        Category: newItem.category,
        Unit: newItem.unit,
        HSNCode: newItem.hsn || '',
        GSTPercent: newItem.gst || 18,
        Status: 'Active'
      }).catch(err => console.warn('[Supabase] items insert error:', err));
    }

    const modalEl = document.getElementById('modalNewItem');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Registered new SKU "${code}" (${name} - ${brand}) successfully!`, 'success');
    }
  }

  function initEditItemModal() {
    const btnSubmit = document.getElementById('btnSubmitEditSku');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveEditItem);
  }

  function openEditItemModal(code) {
    const item = items.find(i => i.code === code);
    if (!item) {
      if (typeof UI !== 'undefined') UI.toast('SKU item not found', 'danger');
      return;
    }

    const modalEl = document.getElementById('modalEditItem');
    if (!modalEl) return;

    const codeInput = document.getElementById('editSkuCode');
    const nameInput = document.getElementById('editSkuName');
    const brandInput = document.getElementById('editSkuBrand');
    const specInput = document.getElementById('editSkuSpec');
    const catInput = document.getElementById('editSkuCategory');
    const unitInput = document.getElementById('editSkuUnit');
    const priceInput = document.getElementById('editSkuPrice');
    const thresholdInput = document.getElementById('editSkuMinThreshold');

    if (codeInput) codeInput.value = item.code;
    if (nameInput) nameInput.value = item.name;
    if (brandInput) brandInput.value = item.brand;
    if (specInput) specInput.value = item.spec || '';
    if (catInput) catInput.value = item.category || 'Panels';
    if (unitInput) unitInput.value = item.unit || 'Nos';
    if (priceInput) priceInput.value = item.buyingPrice;
    if (thresholdInput) thresholdInput.value = item.minThreshold || 5;

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveEditItem() {
    const code = document.getElementById('editSkuCode')?.value.trim();
    const name = document.getElementById('editSkuName')?.value.trim();
    const brand = document.getElementById('editSkuBrand')?.value.trim();
    const spec = document.getElementById('editSkuSpec')?.value.trim();
    const category = document.getElementById('editSkuCategory')?.value || 'Panels';
    const unit = document.getElementById('editSkuUnit')?.value || 'Nos';
    const buyingPrice = Number(document.getElementById('editSkuPrice')?.value) || 0;
    const minThreshold = Number(document.getElementById('editSkuMinThreshold')?.value) || 5;

    if (!code) return;
    if (!name || !brand || !spec) {
      if (typeof UI !== 'undefined') UI.toast('Please fill all required SKU attributes', 'warning');
      return;
    }

    const item = items.find(i => i.code === code);
    if (!item) return;

    const oldName = item.name;
    item.name = name;
    item.brand = brand;
    item.spec = spec;
    item.category = category;
    item.unit = unit;
    item.buyingPrice = buyingPrice;
    item.minThreshold = minThreshold;

    saveData();

    if (typeof DB !== 'undefined') {
      DB.update('inventory_items', r => (r.ItemCode || r.code) === code, {
        ItemName: name,
        Brand: brand,
        Specification: spec,
        Category: category,
        Unit: unit,
        BuyingPrice: buyingPrice,
        MinThreshold: minThreshold,
        UpdatedAt: new Date().toISOString()
      }).catch(err => console.warn('[Supabase] inventory_items update error:', err));

      DB.update('items', r => (r.ItemName || r.name) === oldName, {
        ItemName: name,
        Category: category,
        Unit: unit
      }).catch(err => console.warn('[Supabase] items update error:', err));
    }

    const modalEl = document.getElementById('modalEditItem');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Updated SKU "${code}" successfully!`, 'success');
    }
  }

  async function deleteItem(code) {
    const item = items.find(i => i.code === code);
    if (!item) return;

    const inwCount = inwards.filter(i => i.itemCode === code).length;
    const dspCount = dispatches.filter(d => d.itemCode === code).length;

    let warningText = `Are you sure you want to delete equipment SKU "${code}" (${item.name} - ${item.brand})?`;
    if (inwCount > 0 || dspCount > 0) {
      warningText += `\n\n⚠️ Note: This item is referenced in ${inwCount} inward purchases and ${dspCount} site dispatches. Deleting it will remove the SKU from the live stock catalog.`;
    }

    if (!confirm(warningText)) return;

    items = items.filter(i => i.code !== code);
    selectedLedger.delete(code);
    saveData();

    if (typeof DB !== 'undefined') {
      await DB.remove('inventory_items', r => (r.ItemCode || r.code) === code).catch(err => console.warn('[Supabase] inventory_items delete error:', err));
      await DB.remove('items', r => (r.ItemName || r.name) === item.name).catch(() => {});
    }

    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`SKU "${code}" deleted from catalog.`, 'info');
    }
  }

  // --- Inward Purchase History CRUD Operations ---
  function initEditInwardModal() {
    const btnSubmit = document.getElementById('btnSubmitEditInward');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveEditInward);

    const qtyInput = document.getElementById('editInwQty');
    const priceInput = document.getElementById('editInwUnitPrice');
    const itemSelect = document.getElementById('editInwItemSelect');

    const updateCalc = () => {
      const q = Number(qtyInput?.value) || 0;
      const p = Number(priceInput?.value) || 0;
      const totalEl = document.getElementById('editInwDisplayTotal');
      if (totalEl) totalEl.textContent = fmtRupees(q * p);
    };

    if (qtyInput) qtyInput.addEventListener('input', updateCalc);
    if (priceInput) priceInput.addEventListener('input', updateCalc);

    if (itemSelect) {
      itemSelect.addEventListener('change', () => {
        const itm = items.find(i => i.code === itemSelect.value);
        if (itm && priceInput && (!priceInput.value || Number(priceInput.value) === 0)) {
          priceInput.value = itm.buyingPrice;
          updateCalc();
        }
      });
    }
  }

  function openEditInwardModal(id) {
    const inw = inwards.find(i => i.id === id);
    if (!inw) {
      if (typeof UI !== 'undefined') UI.toast('Inward record not found', 'danger');
      return;
    }

    const modalEl = document.getElementById('modalEditInward');
    if (!modalEl) return;

    const idInput = document.getElementById('editInwId');
    const dateInput = document.getElementById('editInwDate');
    const supplierInput = document.getElementById('editInwSupplier');
    const itemSelect = document.getElementById('editInwItemSelect');
    const qtyInput = document.getElementById('editInwQty');
    const priceInput = document.getElementById('editInwUnitPrice');
    const totalEl = document.getElementById('editInwDisplayTotal');
    const locationInput = document.getElementById('editInwLocation');
    const remarksInput = document.getElementById('editInwRemarks');

    if (idInput) idInput.value = inw.id;
    if (dateInput) dateInput.value = inw.date || new Date().toISOString().slice(0, 10);
    if (supplierInput) supplierInput.value = inw.supplier || '';

    if (itemSelect) {
      itemSelect.innerHTML = buildGroupedItemOptions(inw.itemCode, 'stockin');
      itemSelect.value = inw.itemCode;
    }

    if (qtyInput) qtyInput.value = inw.qty;
    if (priceInput) priceInput.value = inw.unitPrice;
    if (totalEl) totalEl.textContent = fmtRupees(inw.totalCost || (inw.qty * inw.unitPrice));
    if (locationInput) locationInput.value = inw.location || '';
    if (remarksInput) remarksInput.value = inw.remarks || '';

    // Document state
    editInwardDocFile = inw.docName ? { name: inw.docName, data: inw.docData } : null;
    const badge = document.getElementById('editInwFileBadge');
    const fileNameEl = document.getElementById('editInwFileName');
    const fileInput = document.getElementById('editInwDocInput');
    if (fileInput) fileInput.value = '';

    if (inw.docName && badge && fileNameEl) {
      fileNameEl.textContent = inw.docName;
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.style.display = 'none';
    }

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveEditInward() {
    const id = document.getElementById('editInwId')?.value;
    const date = document.getElementById('editInwDate')?.value || new Date().toISOString().slice(0, 10);
    const supplier = document.getElementById('editInwSupplier')?.value.trim();
    const itemCode = document.getElementById('editInwItemSelect')?.value;
    const qty = Number(document.getElementById('editInwQty')?.value);
    const unitPrice = Number(document.getElementById('editInwUnitPrice')?.value) || 0;
    const location = document.getElementById('editInwLocation')?.value.trim() || 'Main Godown';
    const remarks = document.getElementById('editInwRemarks')?.value.trim() || '';

    if (!id) return;
    if (!supplier) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Supplier / Vendor Name', 'warning');
      return;
    }
    if (!itemCode) {
      if (typeof UI !== 'undefined') UI.toast('Please select an equipment item', 'warning');
      return;
    }
    if (!qty || qty <= 0) {
      if (typeof UI !== 'undefined') UI.toast('Please enter a valid received quantity (> 0)', 'warning');
      return;
    }

    const inw = inwards.find(i => i.id === id);
    if (!inw) return;

    const totalCost = qty * unitPrice;

    inw.date = date;
    inw.supplier = supplier;
    inw.itemCode = itemCode;
    inw.qty = qty;
    inw.unitPrice = unitPrice;
    inw.totalCost = totalCost;
    inw.location = location;
    inw.remarks = remarks;
    if (editInwardDocFile) {
      inw.docName = editInwardDocFile.name;
      inw.docData = editInwardDocFile.data;
    } else if (editInwardDocFile === null) {
      inw.docName = null;
      inw.docData = null;
    }

    saveData();

    if (typeof DB !== 'undefined') {
      DB.update('inventory_inwards', r => (r.InwardID || r.id) === id, {
        Date: date,
        Supplier: supplier,
        ItemCode: itemCode,
        Quantity: qty,
        UnitPrice: unitPrice,
        TotalCost: totalCost,
        Location: location,
        Remarks: remarks,
        DocumentName: inw.docName,
        DocumentData: inw.docData
      }).catch(err => console.warn('[Supabase] inventory_inwards update error:', err));
    }

    const modalEl = document.getElementById('modalEditInward');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Updated inward record "${id}" successfully!`, 'success');
    }
  }

  async function deleteInward(id) {
    const inw = inwards.find(i => i.id === id);
    if (!inw) return;

    if (!confirm(`Are you sure you want to delete inward consignment "${inw.id}" from "${inw.supplier}"?\n\nThis will deduct ${inw.qty} units from warehouse stock calculation.`)) {
      return;
    }

    inwards = inwards.filter(i => i.id !== id);
    selectedInwards.delete(id);
    saveData();

    if (typeof DB !== 'undefined') {
      await DB.remove('inventory_inwards', r => (r.InwardID || r.id) === id).catch(err => console.warn('[Supabase] inventory_inwards delete error:', err));
    }

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'inwards') renderInwardsTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Deleted inward record "${id}". Warehouse stock updated.`, 'info');
    }
  }

  // --- Site Dispatch History CRUD Operations ---
  function initEditDispatchModal() {
    const btnSubmit = document.getElementById('btnSubmitEditDispatch');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveEditDispatch);

    const qtyInput = document.getElementById('editDspQty');
    const priceInput = document.getElementById('editDspUnitPrice');
    const itemSelect = document.getElementById('editDspItemSelect');

    const updateCalc = () => {
      const q = Number(qtyInput?.value) || 0;
      const p = Number(priceInput?.value) || 0;
      const totalEl = document.getElementById('editDspDisplayTotal');
      if (totalEl) totalEl.textContent = fmtRupees(q * p);
    };

    if (qtyInput) qtyInput.addEventListener('input', updateCalc);
    if (priceInput) priceInput.addEventListener('input', updateCalc);

    if (itemSelect) {
      itemSelect.addEventListener('change', () => {
        const itm = items.find(i => i.code === itemSelect.value);
        if (itm && priceInput) {
          priceInput.value = itm.buyingPrice;
          updateCalc();
        }
      });
    }
  }

  function openEditDispatchModal(id) {
    const dsp = dispatches.find(d => d.id === id);
    if (!dsp) {
      if (typeof UI !== 'undefined') UI.toast('Dispatch record not found', 'danger');
      return;
    }

    const modalEl = document.getElementById('modalEditDispatch');
    if (!modalEl) return;

    const idInput = document.getElementById('editDspId');
    const dateInput = document.getElementById('editDspDate');
    const siteInput = document.getElementById('editDspSiteName');
    const itemSelect = document.getElementById('editDspItemSelect');
    const qtyInput = document.getElementById('editDspQty');
    const priceInput = document.getElementById('editDspUnitPrice');
    const transportInput = document.getElementById('editDspTransportCost');
    const vehicleInput = document.getElementById('editDspVehicle');
    const remarksInput = document.getElementById('editDspRemarks');
    const totalEl = document.getElementById('editDspDisplayTotal');
    const stockHelp = document.getElementById('editDspStockHelp');

    if (idInput) idInput.value = dsp.id;
    if (dateInput) dateInput.value = dsp.date || new Date().toISOString().slice(0, 10);
    if (siteInput) siteInput.value = dsp.siteName || '';

    if (itemSelect) {
      itemSelect.innerHTML = buildGroupedItemOptions(dsp.itemCode, 'dispatch');
      itemSelect.value = dsp.itemCode;
    }

    if (qtyInput) qtyInput.value = dsp.qty;
    if (priceInput) priceInput.value = dsp.unitBuyingPrice;
    if (transportInput) transportInput.value = dsp.transportCost || 0;
    if (vehicleInput) vehicleInput.value = dsp.vehicle || '';
    if (remarksInput) remarksInput.value = dsp.remarks || '';
    if (totalEl) totalEl.textContent = fmtRupees(dsp.dispatchedCost || (dsp.qty * dsp.unitBuyingPrice));

    const itmSummary = getItemSummary(dsp.itemCode);
    const maxAvailable = itmSummary.inHand + Number(dsp.qty);
    if (stockHelp) {
      stockHelp.textContent = `Warehouse currently in-hand: ${itmSummary.inHand}. Max dispatchable: ${maxAvailable}.`;
    }

    // Document state
    editDispatchDocFile = dsp.docName ? { name: dsp.docName, data: dsp.docData } : null;
    const badge = document.getElementById('editDspFileBadge');
    const fileNameEl = document.getElementById('editDspFileName');
    const fileInput = document.getElementById('editDspDocInput');
    if (fileInput) fileInput.value = '';

    if (dsp.docName && badge && fileNameEl) {
      fileNameEl.textContent = dsp.docName;
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.style.display = 'none';
    }

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function handleSaveEditDispatch() {
    const id = document.getElementById('editDspId')?.value;
    const date = document.getElementById('editDspDate')?.value || new Date().toISOString().slice(0, 10);
    const siteName = document.getElementById('editDspSiteName')?.value.trim();
    const itemCode = document.getElementById('editDspItemSelect')?.value;
    const qty = Number(document.getElementById('editDspQty')?.value);
    const unitBuyingPrice = Number(document.getElementById('editDspUnitPrice')?.value) || 0;
    const transportCost = Number(document.getElementById('editDspTransportCost')?.value) || 0;
    const vehicle = document.getElementById('editDspVehicle')?.value.trim() || 'Site Vehicle';
    const remarks = document.getElementById('editDspRemarks')?.value.trim() || '';

    if (!id) return;
    if (!siteName) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Site / Project Name', 'warning');
      return;
    }
    if (!itemCode) {
      if (typeof UI !== 'undefined') UI.toast('Please select an equipment item', 'warning');
      return;
    }
    if (!qty || qty <= 0) {
      if (typeof UI !== 'undefined') UI.toast('Please enter a valid dispatch quantity (> 0)', 'warning');
      return;
    }

    const dsp = dispatches.find(d => d.id === id);
    if (!dsp) return;

    // Check stock availability
    const itmSummary = getItemSummary(itemCode);
    const maxAvailable = (dsp.itemCode === itemCode) ? (itmSummary.inHand + Number(dsp.qty)) : itmSummary.inHand;
    if (qty > maxAvailable) {
      if (typeof UI !== 'undefined') UI.toast(`Quantity (${qty}) exceeds maximum warehouse stock available (${maxAvailable})`, 'danger');
      return;
    }

    const dispatchedCost = qty * unitBuyingPrice;

    dsp.date = date;
    dsp.siteName = siteName;
    dsp.itemCode = itemCode;
    dsp.qty = qty;
    dsp.unitBuyingPrice = unitBuyingPrice;
    dsp.dispatchedCost = dispatchedCost;
    dsp.transportCost = transportCost;
    dsp.vehicle = vehicle;
    dsp.remarks = remarks;

    if (editDispatchDocFile) {
      dsp.docName = editDispatchDocFile.name;
      dsp.docData = editDispatchDocFile.data;
    } else if (editDispatchDocFile === null) {
      dsp.docName = null;
      dsp.docData = null;
    }

    saveData();

    if (typeof DB !== 'undefined') {
      DB.update('inventory_dispatches', r => (r.DispatchID || r.id) === id, {
        Date: date,
        SiteName: siteName,
        ItemCode: itemCode,
        Quantity: qty,
        UnitBuyingPrice: unitBuyingPrice,
        DispatchedCost: dispatchedCost,
        TransportCost: transportCost,
        Vehicle: vehicle,
        Remarks: remarks,
        DocumentName: dsp.docName,
        DocumentData: dsp.docData
      }).catch(err => console.warn('[Supabase] inventory_dispatches update error:', err));
    }

    const modalEl = document.getElementById('modalEditDispatch');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'dispatches') renderDispatchesTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Updated dispatch record "${id}" successfully!`, 'success');
    }
  }

  async function deleteDispatch(id) {
    const dsp = dispatches.find(d => d.id === id);
    if (!dsp) return;

    if (!confirm(`Are you sure you want to delete site dispatch "${dsp.id}" to "${dsp.siteName}"?\n\nThis will restore ${dsp.qty} units back to physical warehouse stock.`)) {
      return;
    }

    dispatches = dispatches.filter(d => d.id !== id);
    selectedDispatches.delete(id);
    saveData();

    if (typeof DB !== 'undefined') {
      await DB.remove('inventory_dispatches', r => (r.DispatchID || r.id) === id).catch(err => console.warn('[Supabase] inventory_dispatches delete error:', err));
    }

    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();
    else if (activeTab === 'dispatches') renderDispatchesTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Deleted site dispatch "${id}". Stock restored to warehouse physical inventory.`, 'info');
    }
  }

  // --- Export CSV Engine ---
  function exportCsv() {
    let csvContent = '';
    let filename = '';
    const today = new Date().toISOString().slice(0, 10);

    if (activeTab === 'ledger') {
      filename = `Solar_Stock_Ledger_${today}.csv`;
      const ledger = getCalculatedStockLedger();
      const headers = ['Item Code', 'Item Name', 'Brand', 'Specification', 'Category', 'Unit', 'Buying Price (INR)', 'Inward Qty', 'Dispatched Qty', 'In-Hand Stock', 'Total Stock Valuation (INR)', 'Status'];
      
      const rows = ledger.map(item => [
        `"${item.code}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.brand || '').replace(/"/g, '""')}"`,
        `"${(item.spec || '').replace(/"/g, '""')}"`,
        `"${item.category}"`,
        `"${item.unit}"`,
        item.buyingPrice,
        item.inwardQty,
        item.dispatchedQty,
        item.inHandQty,
        item.totalStockValuation,
        `"${item.status}"`
      ]);

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    } else if (activeTab === 'dispatches') {
      filename = `Solar_Site_Dispatches_${today}.csv`;
      const headers = ['Date', 'Challan No', 'Project / Site Name', 'Item Code', 'Item Name', 'Brand', 'Specification', 'Quantity Dispatched', 'Unit Buying Price (INR)', 'Total Material Cost (INR)', 'Transport Cost (INR)', 'Document', 'Vehicle / Transporter'];
      
      const rows = dispatches.map(dsp => {
        const itm = items.find(i => i.code === dsp.itemCode) || {};
        return [
          `"${dsp.date}"`,
          `"${dsp.challanNo || ''}"`,
          `"${(dsp.siteName || '').replace(/"/g, '""')}"`,
          `"${dsp.itemCode}"`,
          `"${(itm.name || '').replace(/"/g, '""')}"`,
          `"${(itm.brand || '').replace(/"/g, '""')}"`,
          `"${(itm.spec || '').replace(/"/g, '""')}"`,
          dsp.qty,
          dsp.unitBuyingPrice,
          dsp.dispatchedCost,
          dsp.transportCost || 0,
          `"${dsp.docName || ''}"`,
          `"${(dsp.vehicle || '').replace(/"/g, '""')}"`
        ];
      });

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    } else if (activeTab === 'inwards') {
      filename = `Solar_Inward_Procurement_${today}.csv`;
      const headers = ['Date', 'Invoice No', 'Supplier / Vendor', 'Item Code', 'Item Name', 'Brand', 'Specification', 'Quantity Received', 'Unit Price (INR)', 'Total Inward Cost (INR)', 'Document', 'Storage Location'];
      
      const rows = inwards.map(inw => {
        const itm = items.find(i => i.code === inw.itemCode) || {};
        return [
          `"${inw.date}"`,
          `"${inw.invoiceNo || ''}"`,
          `"${(inw.supplier || '').replace(/"/g, '""')}"`,
          `"${inw.itemCode}"`,
          `"${(itm.name || '').replace(/"/g, '""')}"`,
          `"${(itm.brand || '').replace(/"/g, '""')}"`,
          `"${(itm.spec || '').replace(/"/g, '""')}"`,
          inw.qty,
          inw.unitPrice,
          inw.totalCost,
          `"${inw.docName || ''}"`,
          `"${(inw.location || '').replace(/"/g, '""')}"`
        ];
      });

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof UI !== 'undefined') {
      UI.toast(`Downloaded ${filename}`, 'success');
    }
  }

  // --- Reset Filters ---
  function resetFilters() {
    activeCategory = 'All';
    searchTerm = '';
    statusFilter = 'All';

    const searchInput = document.getElementById('invTableSearch');
    if (searchInput) searchInput.value = '';

    const statusSelect = document.getElementById('invStatusSelect');
    if (statusSelect) statusSelect.value = 'All';

    renderCategoryChips();
    renderLedgerTable();
  }

  // --- Tabs Switching ---
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.inv-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const tabKey = target.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        activeTab = tabKey;

        document.querySelectorAll('.inv-tab-pane').forEach(p => p.style.display = 'none');
        const activePane = document.getElementById(`pane-${tabKey}`);
        if (activePane) activePane.style.display = 'block';

        const chipsWrap = document.getElementById('invCategoryChipsRow');
        const statusWrap = document.getElementById('invStatusFilterWrap');
        if (chipsWrap) chipsWrap.style.display = (tabKey === 'ledger') ? 'flex' : 'none';
        if (statusWrap) statusWrap.style.display = (tabKey === 'ledger') ? 'block' : 'none';

        if (tabKey === 'ledger') renderLedgerTable();
        else if (tabKey === 'dispatches') renderDispatchesTable();
        else if (tabKey === 'inwards') renderInwardsTable();

        updateBulkActionBar();
      });
    });
  }

  // --- Global Event Bindings ---
  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    const btnStockIn = document.getElementById('btnQuickStockIn');
    if (btnStockIn) btnStockIn.addEventListener('click', () => openStockInModal());

    const btnDispatch = document.getElementById('btnQuickDispatch');
    if (btnDispatch) btnDispatch.addEventListener('click', () => openDispatchModal());

    const btnExport = document.getElementById('btnExportCsv');
    if (btnExport) btnExport.addEventListener('click', () => exportCsv());

    const searchInput = document.getElementById('invTableSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        if (activeTab === 'ledger') renderLedgerTable();
        else if (activeTab === 'dispatches') renderDispatchesTable();
        else if (activeTab === 'inwards') renderInwardsTable();
      });
    }

    const statusSelect = document.getElementById('invStatusSelect');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        renderLedgerTable();
      });
    }

    // Bulk action buttons
    const btnDeleteSelected = document.getElementById('btnDeleteSelected');
    if (btnDeleteSelected) {
      btnDeleteSelected.addEventListener('click', () => deleteSelected());
    }

    const btnHeaderDeleteSelected = document.getElementById('btnHeaderDeleteSelected');
    if (btnHeaderDeleteSelected) {
      btnHeaderDeleteSelected.addEventListener('click', () => deleteSelected());
    }

    const btnClearSelection = document.getElementById('btnClearSelection');
    if (btnClearSelection) {
      btnClearSelection.addEventListener('click', () => clearSelection());
    }

    // Header "Select All" checkboxes
    const chkAllLedger = document.getElementById('chkSelectAllLedger');
    if (chkAllLedger) {
      chkAllLedger.addEventListener('change', (e) => handleSelectAll('ledger', e.target.checked));
    }

    const chkAllDispatches = document.getElementById('chkSelectAllDispatches');
    if (chkAllDispatches) {
      chkAllDispatches.addEventListener('change', (e) => handleSelectAll('dispatches', e.target.checked));
    }

    const chkAllInwards = document.getElementById('chkSelectAllInwards');
    if (chkAllInwards) {
      chkAllInwards.addEventListener('change', (e) => handleSelectAll('inwards', e.target.checked));
    }

    // Delegated event for row checkboxes
    document.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('inv-row-chk')) {
        const type = e.target.getAttribute('data-type');
        const id = e.target.getAttribute('data-id');
        toggleSelectRow(type, id, e.target.checked);
      }
    });

    // Delegated click for checkbox cell (clicking near checkbox toggles it)
    document.addEventListener('click', (e) => {
      const chkCell = e.target.closest('.inv-chk-cell');
      if (chkCell && e.target.tagName !== 'INPUT') {
        const chk = chkCell.querySelector('.inv-row-chk');
        if (chk) {
          chk.checked = !chk.checked;
          const type = chk.getAttribute('data-type');
          const id = chk.getAttribute('data-id');
          toggleSelectRow(type, id, chk.checked);
        }
      }
    });
  }

  // --- Initializer ---
  let isInitialized = false;

  async function init() {
    if (isInitialized) {
      await syncWithDatabase();
      return;
    }
    isInitialized = true;

    loadData();

    if (typeof UI !== 'undefined') {
      UI.renderSidebar('inventory.html');
      UI.renderTopbar('Solar Inventory & Site Logistics');
    }

    renderKpiCards();
    renderCategoryChips();
    setupTabs();
    bindEvents();
    initStockInModal();
    initDispatchModal();
    initNewItemModal();
    initEditItemModal();
    initEditInwardModal();
    initEditDispatchModal();
    setupEditFileUploads();

    // Document click to close picker dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.inv-row-item-picker')) {
        document.querySelectorAll('.inv-row-picker-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.inv-row-picker-btn.active').forEach(b => b.classList.remove('active'));
      }
    });

    renderLedgerTable();
    renderDispatchesTable();
    renderInwardsTable();

    await syncWithDatabase();
  }

  return {
    init,
    syncWithDatabase,
    openStockInModal,
    openDispatchModal,
    openStockInModalFor: openStockInModal,
    openDispatchModalFor: openDispatchModal,
    openNewItemModal,
    openEditItemModal,
    deleteItem,
    openEditInwardModal,
    deleteInward,
    openEditDispatchModal,
    deleteDispatch,
    deleteSelected,
    clearSelection,
    handleSelectAll,
    toggleSelectRow,
    deleteSelectedLedger,
    deleteSelectedDispatches,
    deleteSelectedInwards,
    viewDoc,
    exportCsv,
    resetFilters,
    getItems: () => items,
    getDispatches: () => dispatches,
    getInwards: () => inwards
  };

})();

// Supabase DB connection gate callback
window.onDbReady = function () {
  if (document.getElementById('inventoryAppRoot') || document.querySelector('.inventory-body')) {
    InventoryApp.init();
  }
};

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inventoryAppRoot') || document.querySelector('.inventory-body')) {
      InventoryApp.init();
    }
  });
}
