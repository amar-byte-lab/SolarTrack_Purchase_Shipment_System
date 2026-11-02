/* =========================================================================
   inventory.js — Solar Equipment Warehouse & Site Dispatch Management
   EPC Solar Logistics & Stock Ledger (Strictly Material Cost Tracking)
   ========================================================================= */

const InventoryApp = (() => {







  // Pure Database-driven Architecture (Zero localStorage for inventory data)

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
  let activeInlineCategory = null;

  // Multi-item dynamic rows state
  let inwardRows = [];
  let dispatchRows = [];

  // Uploaded documents state
  let inwardDocFile = null;
  let inwardDocFiles = [];
  let dispatchDocFile = null;
  let dispatchDocFiles = [];
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

  // --- Pure Database Sync (No localStorage) ---
  function loadData() {
    syncWithDatabase();
  }

  function saveData() {
    // Pure Database-driven: all state is managed directly in database
  }

  async function syncWithDatabase() {
    if (typeof DB === 'undefined') return;

    try {
      // Always guarantee latest inventory tables are loaded from server DB
      await DB.tryRestoreFolder().catch(() => {});

      // 1. Fetch items
      let loadedItems = [];
      const dbItems = DB.getAll('inventory_items');
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        loadedItems = dbItems.map(row => ({
          code: row.ItemCode || row.itemcode || row.code,
          name: row.ItemName || row.itemname || row.name,
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
      }

      // 3. Fetch dispatches
      const dbDispatches = DB.getAll('inventory_dispatches');
      if (Array.isArray(dbDispatches)) {
        dispatches = dbDispatches.map(row => {
          let customerAllocations = [];
          let mapWithStock = true;
          const rem = row.Remarks || row.remarks || '';
          if (row.mapWithStock === false || rem.includes('|mapWithStock:false')) {
            mapWithStock = false;
          }
          if (Array.isArray(row.customerAllocations) && row.customerAllocations.length > 0) {
            customerAllocations = row.customerAllocations;
          } else if (rem.includes('|logistics:')) {
            try {
              const meta = JSON.parse(rem.split('|logistics:')[1]);
              if (Array.isArray(meta.customerAllocations)) {
                customerAllocations = meta.customerAllocations;
              }
              if (meta && meta.mapWithStock === false) {
                mapWithStock = false;
              }
            } catch (e) {}
          }
          return {
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
            mapWithStock,
            customerAllocations,
            docName: row.DocumentName || row.documentname || null,
            docData: row.DocumentData || row.documentdata || null
          };
        });
      }

      saveData();
      updateAllTabCounters();
      renderKpiCards();
      renderCategoryChips();
      renderLedgerTable();
      renderDispatchesTable();
      renderInwardsTable();

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
      .filter(dsp => dsp.itemCode === itemCode && dsp.mapWithStock !== false)
      .reduce((sum, dsp) => sum + (Number(dsp.qty) || 0), 0);

    const inHand = Math.max(0, inwardSum - dispatchSum);
    return { inwardSum, dispatchSum, inHand };
  }

  function getItemCostPerUnit(itemCode, fallbackPrice = 0) {
    if (!itemCode) return Number(fallbackPrice) || 0;
    const matchingInwards = inwards
      .filter(i => (i.itemCode || '').toLowerCase() === itemCode.toLowerCase());

    if (matchingInwards.length > 0) {
      const sorted = [...matchingInwards].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (b.id > a.id ? 1 : -1));
      for (const inw of sorted) {
        const cpu = Number(inw.costPerUnit !== undefined ? inw.costPerUnit : inw.CostPerUnit);
        if (cpu > 0) return cpu;
        const up = Number(inw.unitPrice !== undefined ? inw.unitPrice : inw.UnitPrice) || 0;
        const qty = Number(inw.qty !== undefined ? inw.qty : inw.Quantity) || 0;
        const tc = Number(inw.transportCost !== undefined ? inw.transportCost : inw.TransportCost) || 0;
        if (up > 0 || tc > 0) {
          return round2(up + (qty > 0 ? (tc / qty) : 0));
        }
      }
    }
    return Number(fallbackPrice) || 0;
  }

  function getItemHistoricalPrices(itemCode) {
    if (!itemCode) return [];
    const matching = inwards.filter(i => (i.itemCode || '').toLowerCase() === itemCode.toLowerCase());
    const list = [];

    // Chronological newest first
    const sorted = [...matching].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (b.id > a.id ? 1 : -1));

    sorted.forEach(inw => {
      const cpu = Number(inw.costPerUnit !== undefined ? inw.costPerUnit : inw.CostPerUnit);
      const up = Number(inw.unitPrice !== undefined ? inw.unitPrice : inw.UnitPrice) || 0;
      const qty = Number(inw.qty !== undefined ? inw.qty : inw.Quantity) || 0;
      const tc = Number(inw.transportCost !== undefined ? inw.transportCost : inw.TransportCost) || 0;
      const effectiveRate = cpu > 0 ? round2(cpu) : round2(up + (qty > 0 ? (tc / qty) : 0));

      if (effectiveRate > 0) {
        list.push({
          price: effectiveRate,
          date: inw.date || '',
          qty: qty,
          supplier: inw.supplier || ''
        });
      }
    });

    const ledger = items.map(item => ({
      code: item.code,
      buyingPrice: Number(item.buyingPrice) || 0
    }));
    const itm = ledger.find(i => (i.code || '').toLowerCase() === itemCode.toLowerCase());
    const basePrice = Number(itm?.buyingPrice || 0);
    if (basePrice > 0 && !list.some(p => Math.abs(p.price - basePrice) < 0.01)) {
      list.push({
        price: basePrice,
        date: 'Catalog',
        qty: 0,
        supplier: 'Base Price'
      });
    }

    return list;
  }

  function getCalculatedStockLedger() {
    return items.map(item => {
      const { inwardSum, dispatchSum, inHand } = getItemSummary(item.code);
      const costPerUnit = getItemCostPerUnit(item.code, item.buyingPrice);
      const totalStockValuation = round2(inHand * costPerUnit);

      let status = 'in-stock';
      if (inHand === 0) {
        status = 'out-of-stock';
      } else if (inHand <= (item.minThreshold || 5)) {
        status = 'low-stock';
      }

      return {
        ...item,
        costPerUnit,
        buyingPrice: costPerUnit,
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
    const totalTransportationCost = dispatches.reduce((sum, dsp) => sum + (Number(dsp.transportCost) || 0), 0);

    // Calculate Turnover from Customer Solar Installations/Orders in DB
    let totalTurnover = 0;
    let customerCount = 0;
    try {
      if (typeof DB !== 'undefined') {
        const installments = DB.getAll('installments') || [];
        const activeInstallments = installments.filter(r => r && r.Status !== 'Deactive');
        if (activeInstallments.length > 0) {
          totalTurnover = activeInstallments.reduce((sum, r) => sum + (Number(r.CommittedPrice) || Number(r.Price) || 0), 0);
          customerCount = activeInstallments.length;
        }
      }
    } catch (e) {
      console.warn('Error computing turnover from installments:', e);
    }

    return {
      totalTurnover,
      customerCount,
      totalWarehouseValuation,
      totalInHandStock,
      totalDispatchedMaterialCost,
      totalTransportationCost,
      totalSKUs: ledger.length
    };
  }

  // --- Category Management ---
  const DEFAULT_CATEGORIES = ['Panels', 'Inverters', 'Cables', 'Structure', 'Hardware', 'Electricals', 'Conduit', 'Earthing', 'Others'];

  function getCategoryList() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('inv_custom_categories') || 'null');
    } catch (e) { }
    let list = Array.isArray(saved) && saved.length > 0 ? [...saved] : [...DEFAULT_CATEGORIES];
    // Include any categories already on items
    items.forEach(item => {
      const c = (item.category || '').trim();
      if (c && !list.includes(c)) list.push(c);
    });
    return list;
  }

  function saveCategoryList(list) {
    try {
      localStorage.setItem('inv_custom_categories', JSON.stringify(list));
    } catch (e) { }
    populateCategorySelects();
    renderCategoryChips();
    renderLedgerTable();
  }

  function populateCategorySelects() {
    const cats = getCategoryList();
    ['newSkuCategory', 'editSkuCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const cur = el.value;
      el.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      if (cur && cats.includes(cur)) el.value = cur;
    });
  }

  function openEditCategoryModal(cat) {
    const modalEl = document.getElementById('modalEditCategory');
    if (!modalEl) return;
    const oldInput = document.getElementById('editCatOldName');
    const nameInput = document.getElementById('txtEditCategoryName');
    const subEl = document.getElementById('editCatModalSubtitle');
    if (oldInput) oldInput.value = cat;
    if (nameInput) nameInput.value = cat;
    if (subEl) subEl.textContent = `Update category name for "${cat}"`;
    const m = bootstrap.Modal.getOrCreateInstance(modalEl);
    m.show();
    setTimeout(() => {
      nameInput?.focus();
      nameInput?.select();
    }, 200);
  }

  async function saveEditCategoryModal() {
    const oldCat = document.getElementById('editCatOldName')?.value.trim();
    const newName = document.getElementById('txtEditCategoryName')?.value.trim();
    if (!newName || !oldCat) return;
    if (newName === oldCat) {
      bootstrap.Modal.getInstance(document.getElementById('modalEditCategory'))?.hide();
      return;
    }
    const cats = getCategoryList();
    if (cats.some(c => c.toLowerCase() === newName.toLowerCase() && c.toLowerCase() !== oldCat.toLowerCase())) {
      if (typeof UI !== 'undefined') UI.toast(`Category "${newName}" already exists!`, 'warning');
      return;
    }
    const updated = cats.map(c => c === oldCat ? newName : c);
    items.forEach(i => {
      if (i.category === oldCat) i.category = newName;
    });
    saveData();
    if (typeof DB !== 'undefined') {
      DB.update('inventory_items', r => r.Category === oldCat, { Category: newName }).catch(() => {});
      DB.update('items', r => r.Category === oldCat, { Category: newName }).catch(() => {});
    }
    saveCategoryList(updated);
    bootstrap.Modal.getInstance(document.getElementById('modalEditCategory'))?.hide();
    renderCategoryManagerList();
    if (typeof UI !== 'undefined') UI.toast(`Category renamed to "${newName}"!`, 'success');
  }

  function promptEditCategory(oldCat) {
    openEditCategoryModal(oldCat);
  }

  async function promptDeleteCategory(cat) {
    if (cat === 'Others') {
      if (typeof UI !== 'undefined') UI.toast(`Default category "Others" cannot be deleted.`, 'warning');
      return;
    }
    const matchingItems = items.filter(i => i.category === cat);
    let msg = `Are you sure you want to delete category "${cat}"?`;
    if (matchingItems.length > 0) {
      msg = `Category "${cat}" has ${matchingItems.length} item(s).\n\nDeleting this category will move all its items to "Others". Proceed?`;
    }
    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(msg, 'Delete Category', 'Delete', 'btn-danger');
    } else {
      ok = confirm(msg);
    }
    if (!ok) return;

    if (matchingItems.length > 0) {
      items.forEach(i => {
        if (i.category === cat) i.category = 'Others';
      });
      saveData();
      if (typeof DB !== 'undefined') {
        DB.update('inventory_items', r => r.Category === cat, { Category: 'Others' }).catch(() => {});
        DB.update('items', r => r.Category === cat, { Category: 'Others' }).catch(() => {});
      }
    }

    const cats = getCategoryList().filter(c => c !== cat);
    if (!cats.includes('Others')) cats.push('Others');
    saveCategoryList(cats);
    renderCategoryManagerList();
    if (typeof UI !== 'undefined') UI.toast(`Category "${cat}" deleted successfully!`, 'success');
  }

  function openCategoryModal() {
    renderCategoryManagerList();
    const modalEl = document.getElementById('modalCategoryManager');
    if (modalEl) {
      const m = bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
      setTimeout(() => document.getElementById('txtNewCategoryName')?.focus(), 200);
    }
  }

  function renderCategoryManagerList() {
    const listEl = document.getElementById('catManagerList');
    if (!listEl) return;
    const cats = getCategoryList();
    const badgeEl = document.getElementById('catManagerTotalBadge');
    if (badgeEl) badgeEl.textContent = `${cats.length} Categories`;

    listEl.innerHTML = cats.map(cat => {
      const count = items.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length;
      return `
        <div class="cat-manager-card">
          <div class="cat-manager-card-left">
            <div class="cat-manager-dot"></div>
            <span class="cat-manager-name">${escapeHtml(cat)}</span>
            <span class="cat-manager-count">${count} items</span>
          </div>
          <div class="cat-manager-card-actions">
            <button type="button" class="cat-btn-action" onclick="InventoryApp.openEditCategoryModal('${escapeHtml(cat)}')" title="Rename Category">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            ${cat !== 'Others' ? `
            <button type="button" class="cat-btn-action btn-del" onclick="InventoryApp.promptDeleteCategory('${escapeHtml(cat)}')" title="Delete Category">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function addCategoryFromManager() {
    const input = document.getElementById('txtNewCategoryName');
    const name = input ? input.value.trim() : '';
    if (!name) {
      if (typeof UI !== 'undefined') UI.toast('Please enter a category name', 'warning');
      input?.focus();
      return;
    }
    const cats = getCategoryList();
    if (cats.some(c => c.toLowerCase() === name.toLowerCase())) {
      if (typeof UI !== 'undefined') UI.toast(`Category "${name}" already exists!`, 'warning');
      input?.focus();
      return;
    }
    cats.push(name);
    saveCategoryList(cats);
    if (input) input.value = '';
    renderCategoryManagerList();
    if (typeof UI !== 'undefined') UI.toast(`Category "${name}" created successfully!`, 'success');
  }

  function updateAllTabCounters() {
    const tabCountLedger = document.getElementById('tabCountLedger');
    if (tabCountLedger) {
      const ledger = getCalculatedStockLedger();
      tabCountLedger.textContent = ledger.length;
    }
    const tabCountInwards = document.getElementById('tabCountInwards');
    if (tabCountInwards) {
      const consignments = getGroupedInwardConsignments(false);
      tabCountInwards.textContent = consignments.length;
    }
    const tabCountDispatches = document.getElementById('tabCountDispatches');
    if (tabCountDispatches) {
      const dispatchConsignments = getGroupedDispatchConsignments(false);
      tabCountDispatches.textContent = dispatchConsignments.length;
    }
  }

  // --- Render KPI & Chips ---
  function renderKpiCards() {
    updateAllTabCounters();
    const metrics = getKpiMetrics();

    const turnoverEl = document.getElementById('kpiTotalTurnover');
    const dispEl = document.getElementById('kpiTotalDispatchedCost');
    const transEl = document.getElementById('kpiTotalTransportationCost');

    if (turnoverEl) turnoverEl.textContent = fmtRupees(metrics.totalTurnover);
    if (dispEl) dispEl.textContent = fmtRupees(metrics.totalDispatchedMaterialCost);
    if (transEl) transEl.textContent = fmtRupees(metrics.totalTransportationCost);

    // Collapsed Mini Strip Sync (Turnover, Dispatched, Transport)
    const miniTurnover = document.getElementById('miniKpiTurnover');
    const miniDisp = document.getElementById('miniKpiDispatched');
    const miniTrans = document.getElementById('miniKpiTransport');
    if (miniTurnover) miniTurnover.textContent = fmtRupees(metrics.totalTurnover);
    if (miniDisp) miniDisp.textContent = fmtRupees(metrics.totalDispatchedMaterialCost);
    if (miniTrans) miniTrans.textContent = fmtRupees(metrics.totalTransportationCost);

    const subTurnoverEl = document.getElementById('kpiSubTurnover');
    const subDispEl = document.getElementById('kpiSubDispatched');
    const subTransEl = document.getElementById('kpiSubTransportation');

    if (subTurnoverEl) {
      if (metrics.customerCount > 0) {
        subTurnoverEl.textContent = `${metrics.customerCount} Active ${metrics.customerCount === 1 ? 'Project' : 'Projects'}`;
      } else {
        subTurnoverEl.textContent = 'Total Project Orders';
      }
    }
    if (subDispEl) subDispEl.textContent = `${dispatches.length} site consignments`;
    if (subTransEl) {
      const freightTrips = dispatches.filter(d => (Number(d.transportCost) || 0) > 0).length;
      subTransEl.textContent = freightTrips > 0 ? `${freightTrips} freight ${freightTrips === 1 ? 'trip' : 'trips'}` : 'Site Logistics & Freight';
    }

    const valuationEl = document.getElementById('modalKpiValuation');
    const inHandEl = document.getElementById('modalKpiInHand');
    const skusEl = document.getElementById('modalKpiSkus');
    if (valuationEl) valuationEl.textContent = fmtRupees(metrics.totalWarehouseValuation);
    if (inHandEl) inHandEl.textContent = fmtQty(metrics.totalInHandStock);
    if (skusEl) skusEl.textContent = metrics.totalSKUs;
  }

  function renderCategoryChips() {
    const chipsContainer = document.getElementById('invCategoryChips');
    if (!chipsContainer) return;

    const customCats = getCategoryList();
    const categories = ['All', ...customCats];

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
        (r.category && r.category.toLowerCase().includes(q))
      );
    }
    return rows;
  }

  function renderLedgerTable() {
    const treeContainer = document.getElementById('invLedgerTree');
    const tbody = document.getElementById('invLedgerTbody');
    const tfoot = document.getElementById('invLedgerTfoot');

    // Prune stale selection
    const currentCodes = new Set(items.map(i => i.code));
    for (const c of selectedLedger) {
      if (!currentCodes.has(c)) selectedLedger.delete(c);
    }

    const rows = getFilteredLedgerItems();

    const tabCount = document.getElementById('tabCountLedger');
    if (tabCount) tabCount.textContent = rows.length;

    if (!treeContainer) {
      updateHeaderCheckboxState('ledger');
      updateBulkActionBar();
      return;
    }

    if (rows.length === 0 && !activeInlineCategory) {
      treeContainer.innerHTML = `
        <div class="inv-tree-empty text-center py-5">
          <div class="fs-6 fw-semibold text-secondary mb-1">No equipment items found</div>
          <div class="small text-muted mb-3">Add equipment items to start tracking warehouse stock.</div>
          <button type="button" class="inv-btn inv-btn-primary" onclick="InventoryApp.openNewItemModal()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Item</span>
          </button>
        </div>
      `;
      if (tbody) tbody.innerHTML = '';
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('ledger');
      updateBulkActionBar();
      return;
    }

    // Group items by category for tree view
    const categoryOrder = getCategoryList();
    const groups = {};
    categoryOrder.forEach(cat => { groups[cat] = []; });
    rows.forEach(item => {
      const cat = item.category || 'Others';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    const totalValuation = rows.reduce((s, r) => s + r.totalStockValuation, 0);
    const totalInHand = rows.reduce((s, r) => s + r.inHandQty, 0);

    let html = `
      <div class="inv-tree-container">
        <div class="inv-tree-summary">
          <div class="inv-tree-summary-top">
            <span class="inv-tree-summary-label">${rows.length} Equipment Items</span>
            <span class="inv-tree-summary-sep">•</span>
            <span class="inv-tree-summary-stock">Total In-Hand: <strong>${fmtQty(totalInHand)}</strong> units</span>
            <span class="inv-tree-summary-sep">•</span>
            <span class="inv-tree-summary-val">Stock Value: <strong class="text-emerald-700 font-monospace">${fmtRupees(totalValuation)}</strong></span>
          </div>
          <div class="inv-tree-header-row">
            <div class="inv-tree-header-left col-item">
              <span class="inv-tree-header-col">Equipment Item</span>
            </div>
            <div class="inv-tree-header-right">
              <span class="inv-tree-header-col col-stock">Item Stock</span>
              <span class="inv-tree-header-col col-status">Status</span>
              <span class="inv-tree-header-col col-price">Cost / Unit (₹)</span>
              <span class="inv-tree-header-col col-val">Total Value (₹)</span>
              <span class="inv-tree-header-col col-actions">Actions</span>
            </div>
          </div>
        </div>
    `;

    // Render each category group
    const renderCategoryGroup = (cat, itemsList) => {
      const isInlineOpen = activeInlineCategory === cat;
      if ((!itemsList || itemsList.length === 0) && !isInlineOpen && activeCategory !== 'All') return '';
      
      const itemsCount = itemsList ? itemsList.length : 0;
      const catInHand = (itemsList || []).reduce((s, r) => s + r.inHandQty, 0);
      const catVal = (itemsList || []).reduce((s, r) => s + r.totalStockValuation, 0);
      const catOutCount = (itemsList || []).filter(r => r.status === 'out-of-stock').length;
      const catLowCount = (itemsList || []).filter(r => r.status === 'low-stock').length;

      const alertDot = catOutCount > 0
        ? `<span class="inv-tree-cat-dot dot-danger" title="${catOutCount} out of stock"></span>`
        : catLowCount > 0
        ? `<span class="inv-tree-cat-dot dot-warning" title="${catLowCount} low stock"></span>`
        : '';

      let gHtml = `
        <div class="inv-tree-group" id="catGroup_${cat}">
          <div class="inv-tree-group-header" 
               onclick="this.parentElement.classList.toggle('collapsed')" 
               oncontextmenu="event.preventDefault(); InventoryApp.startInlineAddItem('${cat}');"
               title="Click to collapse / expand. Right-click to Add Item"
               role="button">
            <div class="inv-tree-group-left">
              <svg class="inv-tree-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              <span class="inv-tree-cat-name">${escapeHtml(cat)}</span>
              <span class="inv-tree-cat-count" title="${itemsCount} items">${itemsCount}</span>
              ${alertDot}
              <span class="inv-tree-cat-stock">${fmtQty(catInHand)} units</span>
              <span class="inv-tree-cat-sep">•</span>
              <span class="inv-tree-cat-val font-monospace">${fmtRupees(catVal)}</span>
            </div>
            <div class="inv-tree-group-right">
              <button type="button" class="inv-cat-add-btn" onclick="event.stopPropagation(); InventoryApp.openNewItemModal('${cat}');" title="Add item to ${escapeHtml(cat)}">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add Item</span>
              </button>
              <button type="button" class="inv-cat-action-btn" onclick="event.stopPropagation(); InventoryApp.openEditCategoryModal('${cat}');" title="Rename Category '${escapeHtml(cat)}'">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              ${cat !== 'Others' ? `
              <button type="button" class="inv-cat-action-btn text-danger" onclick="event.stopPropagation(); InventoryApp.promptDeleteCategory('${cat}');" title="Delete Category '${escapeHtml(cat)}'">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>` : ''}
            </div>
          </div>
          <div class="inv-tree-group-body">
      `;

      // If inline addition is open for this category, display input row at top of list
      if (isInlineOpen) {
        gHtml += `
          <div class="inv-tree-item inv-tree-item-inline-add">
            <div class="inv-tree-item-left col-item" style="flex: 1 1 auto; gap: 8px;">
              <div class="inv-tree-item-connector"></div>
              <input type="text" class="form-control form-control-sm fw-semibold" id="inlineNewName_${cat}" placeholder="Equipment Item Name *" style="max-width: 280px; flex: 2 1 auto;" onkeydown="if(event.key==='Enter') InventoryApp.saveInlineAddItem('${cat}'); if(event.key==='Escape') InventoryApp.cancelInlineAddItem();" autocomplete="off">
              <select class="form-select form-select-sm" id="inlineNewUnit_${cat}" style="width: 110px; flex: 0 0 110px;" title="Unit of Measurement">
                <option value="Nos">Nos</option>
                <option value="Pcs">Pcs</option>
                <option value="Meters">Meters</option>
                <option value="Sets">Sets</option>
                <option value="Bag">Bag</option>
                <option value="Kgs">Kgs</option>
              </select>
              <input type="number" min="1" step="1" class="form-control form-control-sm font-monospace text-center" id="inlineNewThreshold_${cat}" value="5" placeholder="Min Alert" title="Min Threshold Alert" style="width: 90px; flex: 0 0 90px;" onkeydown="if(event.key==='Enter') InventoryApp.saveInlineAddItem('${cat}');">
            </div>
            <div class="inv-tree-item-right" style="flex: 0 0 auto;">
              <div class="inv-tree-col col-actions no-print d-flex align-items-center justify-content-center gap-1">
                <button type="button" class="btn btn-sm btn-success py-0.5 px-2.5 fs-8 fw-semibold" onclick="InventoryApp.saveInlineAddItem('${cat}')" title="Save Item">✓ Save</button>
                <button type="button" class="btn btn-sm btn-outline-secondary py-0.5 px-2 fs-8" onclick="InventoryApp.cancelInlineAddItem()" title="Cancel">✕</button>
              </div>
            </div>
          </div>
        `;
      }

      (itemsList || []).forEach(item => {
        let statusBadge = '';
        if (item.status === 'in-stock') {
          statusBadge = `<span class="inv-stock-badge in-stock"><span class="inv-badge-dot"></span> In Stock</span>`;
        } else if (item.status === 'low-stock') {
          statusBadge = `<span class="inv-stock-badge low-stock" title="Below threshold of ${item.minThreshold || 5}"><span class="inv-badge-dot"></span> Low Stock</span>`;
        } else {
          statusBadge = `<span class="inv-stock-badge out-of-stock"><span class="inv-badge-dot"></span> Out of Stock</span>`;
        }

        const isSelected = selectedLedger.has(item.code);

        gHtml += `
          <div class="inv-tree-item ${isSelected ? 'inv-tree-item-selected' : ''}" data-code="${item.code}">
            <div class="inv-tree-item-left col-item">
              <div class="inv-tree-item-connector"></div>
              <input type="checkbox" class="form-check-input inv-row-chk inv-tree-chk no-print" data-type="ledger" data-id="${item.code}" ${isSelected ? 'checked' : ''} title="Select ${escapeHtml(item.name)}">
              <span class="fw-semibold text-dark inv-tree-item-name-text">${escapeHtml(item.name)}</span>
            </div>
            <div class="inv-tree-item-right">
              <div class="inv-tree-col col-stock ${item.inHandQty === 0 ? 'text-danger' : 'text-emerald-700'}">
                ${fmtQty(item.inHandQty)} <small class="text-muted fw-normal">${escapeHtml(item.unit || 'Nos')}</small>
              </div>
              <div class="inv-tree-col col-status">
                ${statusBadge}
              </div>
              <div class="inv-tree-col col-price font-monospace text-secondary small">
                ${fmtRupees(item.costPerUnit !== undefined ? item.costPerUnit : item.buyingPrice)}
                <button type="button" class="inv-ph-btn" title="View Price History" onclick="InventoryApp.openPriceHistory('${item.code}')">📈</button>
              </div>
              <div class="inv-tree-col col-val font-monospace fw-bold text-dark small">
                ${fmtRupees(item.totalStockValuation)}
              </div>
              <div class="inv-tree-col col-actions no-print">
                <button class="inv-row-btn btn-row-dispatch" onclick="InventoryApp.openDispatchModalFor('${item.code}')" title="Dispatch to Project Site">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="inv-row-btn btn-row-stockin" onclick="InventoryApp.openStockInModalFor('${item.code}')" title="Inward Stock In">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openEditItemModal('${item.code}')" title="Edit Item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteItem('${item.code}')" title="Delete Item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      gHtml += `</div></div>`;
      return gHtml;
    };

    categoryOrder.forEach(cat => {
      if (groups[cat] !== undefined) html += renderCategoryGroup(cat, groups[cat]);
    });
    Object.keys(groups).forEach(cat => {
      if (!categoryOrder.includes(cat)) html += renderCategoryGroup(cat, groups[cat]);
    });

    html += `</div>`; // Close .inv-tree-container

    treeContainer.innerHTML = html;

    if (tbody) tbody.innerHTML = '';
    if (tfoot) tfoot.innerHTML = '';

    updateHeaderCheckboxState('ledger');
    updateBulkActionBar();

    // Auto focus inline input if open
    if (activeInlineCategory) {
      setTimeout(() => {
        document.getElementById(`inlineNewName_${activeInlineCategory}`)?.focus();
      }, 50);
    }
  }

  function startInlineAddItem(cat) {
    activeInlineCategory = cat;
    renderLedgerTable();
    const groupEl = document.getElementById(`catGroup_${cat}`);
    if (groupEl && groupEl.classList.contains('collapsed')) {
      groupEl.classList.remove('collapsed');
    }
    setTimeout(() => {
      document.getElementById(`inlineNewName_${cat}`)?.focus();
    }, 50);
  }

  function cancelInlineAddItem() {
    activeInlineCategory = null;
    renderLedgerTable();
  }

  function updateInlineTotalVal(cat) {
    const qEl = document.getElementById(`inlineNewQty_${cat}`);
    const pEl = document.getElementById(`inlineNewPrice_${cat}`);
    const vEl = document.getElementById(`inlineNewTotalVal_${cat}`);
    if (!vEl) return;
    const q = parseFloat(qEl ? qEl.value : 0) || 0;
    const p = parseFloat(pEl ? pEl.value : 0) || 0;
    vEl.textContent = fmtRupees(q * p);
  }

  function saveInlineAddItem(cat) {
    const nameInput = document.getElementById(`inlineNewName_${cat}`);
    const unitInput = document.getElementById(`inlineNewUnit_${cat}`);
    const thresholdInput = document.getElementById(`inlineNewThreshold_${cat}`);

    const name = nameInput?.value.trim();
    if (!name) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Equipment Item Name', 'warning');
      nameInput?.focus();
      return;
    }

    const unit = unitInput?.value || 'Nos';
    const minThreshold = Number(thresholdInput?.value) || 5;
    const code = generateNextSkuCode();

    const newItem = {
      code,
      name,
      brand: 'Standard Solar',
      spec: name,
      category: cat,
      unit,
      buyingPrice: 0,
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
        Brand: 'Standard Solar',
        Specification: newItem.name,
        Category: newItem.category,
        Unit: newItem.unit,
        BuyingPrice: 0,
        MinThreshold: newItem.minThreshold,
        HSNCode: '',
        GSTPercent: 12,
        Status: 'Active',
        CreatedAt: new Date().toISOString()
      }).catch(err => console.warn('[Supabase] inventory_items insert error:', err));

      DB.insert('items', {
        ItemName: newItem.name,
        Category: newItem.category,
        Unit: newItem.unit,
        HSNCode: '',
        GSTPercent: 18,
        Status: 'Active'
      }).catch(err => console.warn('[Supabase] items insert error:', err));
    }

    activeInlineCategory = null;
    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Added "${name}" to ${cat} successfully!`, 'success');
    }
  }

  function getDispatchCustomers(disp) {
    let list = [];
    if (Array.isArray(disp.customerAllocations) && disp.customerAllocations.length > 0) {
      list = disp.customerAllocations;
    } else if (disp.remarks && disp.remarks.includes('|logistics:')) {
      try {
        const meta = JSON.parse(disp.remarks.split('|logistics:')[1]);
        if (Array.isArray(meta.customerAllocations)) {
          list = meta.customerAllocations;
        }
      } catch (e) {}
    }

    const names = list
      .map(c => {
        if (!c) return '';
        if (typeof c === 'string') return c.trim();
        return (c.name || c.CustomerName || '').trim();
      })
      .filter(Boolean);

    // If customer record only had slNo, lookup in DB installments
    if (names.length === 0 && list.length > 0) {
      try {
        if (typeof DB !== 'undefined') {
          const allInst = DB.getAll('installments') || [];
          list.forEach(c => {
            if (c.slNo) {
              const matched = allInst.find(i => String(i.SlNo) === String(c.slNo));
              if (matched && matched.Name) names.push(matched.Name.trim());
            }
          });
        }
      } catch (e) {}
    }

    return [...new Set(names)];
  }

  function getFilteredDispatches() {
    let rows = [...dispatches];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => {
        const custNames = getDispatchCustomers(r);
        return (r.challanNo && r.challanNo.toLowerCase().includes(q)) ||
          (r.siteName && r.siteName.toLowerCase().includes(q)) ||
          custNames.some(c => c.toLowerCase().includes(q)) ||
          (r.itemCode && r.itemCode.toLowerCase().includes(q)) ||
          (r.vehicle && r.vehicle.toLowerCase().includes(q)) ||
          (r.remarks && r.remarks.toLowerCase().includes(q)) ||
          (r.docName && r.docName.toLowerCase().includes(q));
      });
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  }

  function getGroupedDispatchConsignments(applyFilter = true) {
    const rawDispatches = applyFilter ? getFilteredDispatches() : [...dispatches].sort((a, b) => new Date(b.date) - new Date(a.date));
    const map = new Map();

    rawDispatches.forEach(dsp => {
      const key = dsp.challanNo || dsp.id;
      if (!map.has(key)) {
        map.set(key, {
          key: key,
          challanNo: dsp.challanNo || key,
          date: dsp.date || '',
          siteName: dsp.siteName || '',
          vehicle: dsp.vehicle || '',
          remarks: dsp.remarks || '',
          isOurProject: dsp.isOurProject !== false,
          distanceKm: dsp.distanceKm || 0,
          costPerKm: dsp.costPerKm || 0,
          transportCost: dsp.transportCost || 0,
          extraDeliveryCost: dsp.extraDeliveryCost || 0,
          extraDeliveryComment: dsp.extraDeliveryComment || '',
          totalDeliveryCost: dsp.totalDeliveryCost || 0,
          customerAllocations: dsp.customerAllocations || [],
          docName: dsp.docName || null,
          docData: dsp.docData || null,
          documents: dsp.documents || [],
          items: [],
          dispatchIds: []
        });
      }

      const grp = map.get(key);
      grp.dispatchIds.push(dsp.id);
      grp.items.push({
        id: dsp.id,
        itemCode: dsp.itemCode,
        qty: dsp.qty,
        unitBuyingPrice: dsp.unitBuyingPrice,
        dispatchedCost: dsp.dispatchedCost
      });

      if ((!grp.customerAllocations || grp.customerAllocations.length === 0) && dsp.customerAllocations && dsp.customerAllocations.length > 0) {
        grp.customerAllocations = dsp.customerAllocations;
      }
      if (!grp.documents || grp.documents.length === 0) {
        if (dsp.documents && dsp.documents.length > 0) grp.documents = dsp.documents;
        else if (dsp.docName) grp.documents = [{ name: dsp.docName, data: dsp.docData }];
      }
    });

    return Array.from(map.values());
  }

  function renderDispatchesTable() {
    const tbody = document.getElementById('invDispatchesTbody');
    const tfoot = document.getElementById('invDispatchesTfoot');
    const cardsContainer = document.getElementById('invDispatchesCards');
    if (!tbody) return;

    // Prune stale selection
    const currentIds = new Set(dispatches.map(d => d.id));
    for (const id of selectedDispatches) {
      if (!currentIds.has(id)) selectedDispatches.delete(id);
    }

    const consignments = getGroupedDispatchConsignments();

    const tabCount = document.getElementById('tabCountDispatches');
    if (tabCount) tabCount.textContent = consignments.length;

    if (consignments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">
            <div class="py-4">
              <div class="fs-6 fw-semibold text-secondary mb-1">No site dispatches recorded</div>
              <div class="small text-muted mb-3">Record equipment dispatches to track site material consumption.</div>
              <button type="button" class="inv-btn inv-btn-dispatch" onclick="InventoryApp.openDispatchModal()">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="14" height="13" rx="1"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>
                <span>Dispatch Material</span>
              </button>
            </div>
          </td>
        </tr>
      `;
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="inv-cards-empty text-center py-4">
            <div class="fs-6 fw-semibold text-secondary mb-1">No site dispatches recorded</div>
            <div class="small text-muted mb-3">Record equipment dispatches to track site material consumption.</div>
            <button type="button" class="inv-btn inv-btn-dispatch" onclick="InventoryApp.openDispatchModal()">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="14" height="13" rx="1"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>
              <span>Dispatch Material</span>
            </button>
          </div>
        `;
      }
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('dispatches');
      updateBulkActionBar();
      return;
    }

    tbody.innerHTML = consignments.map((grp, idx) => {
      const custNames = getDispatchCustomers(grp);
      const cleanRemarks = grp.remarks ? grp.remarks.split('|logistics:')[0].trim() : '';

      let custHtml = `<span class="text-muted small">—</span>`;
      if (custNames.length === 1) {
        custHtml = `<div class="fw-semibold text-dark">${escapeHtml(custNames[0])}</div>`;
      } else if (custNames.length > 1) {
        custHtml = `
          <div class="d-flex flex-column gap-0.5">
            ${custNames.map(n => `<div class="fw-semibold text-dark small" style="line-height:1.25;"><span class="text-primary me-1">•</span>${escapeHtml(n)}</div>`).join('')}
          </div>
        `;
      }

      return `
        <tr>
          <td class="text-center text-muted" style="width: 40px;">${idx + 1}</td>
          <td class="font-monospace text-secondary text-nowrap" style="width: 130px;">${grp.date}</td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(grp.siteName)}</div>
            ${cleanRemarks ? `<div class="text-muted small">${escapeHtml(cleanRemarks)}</div>` : ''}
          </td>
          <td>
            ${custHtml}
          </td>
          <td class="text-center text-nowrap no-print" style="width: 85px;">
            <div class="d-inline-flex align-items-center gap-1">
              <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openEditDispatchModal('${escapeHtml(grp.key)}')" title="Edit Dispatch">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteDispatch('${escapeHtml(grp.key)}')" title="Delete Dispatch">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render Mobile Cards (Site Dispatches)
    if (cardsContainer) {
      cardsContainer.innerHTML = consignments.map((grp) => {
        const custNames = getDispatchCustomers(grp);
        const cleanRemarks = grp.remarks ? grp.remarks.split('|logistics:')[0].trim() : '';

        return `
          <article class="inv-mobile-card" data-id="${grp.key}">
            <div class="inv-card-head">
              <div class="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
                <div class="min-w-0 flex-grow-1">
                  <div class="inv-card-title text-primary">${escapeHtml(grp.siteName)}</div>
                  <div class="inv-card-meta">
                    <span class="font-monospace text-secondary small">${grp.date}</span>
                    ${cleanRemarks ? `<span class="text-muted small ms-1">• ${escapeHtml(cleanRemarks)}</span>` : ''}
                  </div>
                  ${custNames.length > 0 ? `
                    <div class="mt-1 small">
                      <span class="text-secondary fw-semibold">Customer:</span>
                      <span class="text-dark fw-medium">${escapeHtml(custNames.join(', '))}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="inv-card-actions justify-content-end">
              <button type="button" class="inv-qa-btn qa-edit" onclick="InventoryApp.openEditDispatchModal('${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Edit</span>
              </button>
              <button type="button" class="inv-qa-btn qa-delete" onclick="InventoryApp.deleteDispatch('${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete</span>
              </button>
            </div>
          </article>
        `;
      }).join('');
    }

    if (tfoot) {
      tfoot.innerHTML = '';
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

  function getGroupedInwardConsignments(applyFilter = true) {
    const rawInwards = applyFilter ? getFilteredInwards() : [...inwards].sort((a, b) => new Date(b.date) - new Date(a.date));
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
      // Total Inward Cost should strictly NOT include GST: Material Cost (Qty * Unit Price) + Transport Cost
      const rowTotal = round2((qty * unitPrice) + rowTransport);
      const costPerUnit = Number(inw.costPerUnit !== undefined ? inw.costPerUnit : inw.CostPerUnit) || round2(unitPrice + (qty > 0 ? (rowTransport / qty) : 0));

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
        costPerUnit: costPerUnit,
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
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">
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
      `;
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="inv-cards-empty text-center py-4">
            <div class="fs-6 fw-semibold text-secondary mb-1">No inward consignments recorded</div>
            <div class="small text-muted mb-3">Record equipment purchases from suppliers to increase godown stock.</div>
            <button type="button" class="inv-btn inv-btn-stockin" onclick="InventoryApp.openStockInModal()">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Stock In Delivery</span>
            </button>
          </div>
        `;
      }
      if (tfoot) tfoot.innerHTML = '';
      updateHeaderCheckboxState('inwards');
      updateBulkActionBar();
      return;
    }

    // Render Consignment-wise Desktop Table Rows (1 row per bucket confirmation)
    tbody.innerHTML = consignments.map((grp, idx) => {
      return `
        <tr>
          <td class="text-center text-muted" style="width: 40px;">${idx + 1}</td>
          <td class="font-monospace text-secondary text-nowrap" style="width: 140px;">${grp.date}</td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(grp.supplier)}</div>
            ${grp.remarks ? `<div class="text-muted small mt-0.5">${escapeHtml(grp.remarks)}</div>` : ''}
          </td>
          <td class="text-secondary small text-nowrap" style="width: 180px;">${escapeHtml(grp.location || 'Main Godown')}</td>
          <td class="text-center text-nowrap no-print" style="width: 85px;">
            <div class="d-inline-flex align-items-center gap-1">
              <button class="inv-row-btn btn-row-edit" onclick="InventoryApp.openStockInConsignment('${escapeHtml(grp.key)}')" title="Edit Consignment">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="inv-row-btn btn-row-delete" onclick="InventoryApp.deleteInward('${escapeHtml(grp.key)}')" title="Delete Consignment">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render Consignment-wise Mobile Cards
    if (cardsContainer) {
      cardsContainer.innerHTML = consignments.map((grp) => {
        return `
          <article class="inv-mobile-card" data-id="${grp.key}">
            <div class="inv-card-head">
              <div class="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
                <div class="min-w-0 flex-grow-1">
                  <div class="inv-card-title text-dark">${escapeHtml(grp.supplier || 'Inward Consignment')}</div>
                  <div class="inv-card-meta">
                    <span class="font-monospace text-secondary small">${grp.date}</span>
                    <span class="badge bg-slate-100 text-slate-700 border ms-1">${escapeHtml(grp.location || 'Main Godown')}</span>
                  </div>
                </div>
              </div>
            </div>

            ${grp.remarks ? `<div class="small text-muted px-2 py-1">💬 ${escapeHtml(grp.remarks)}</div>` : ''}

            <div class="inv-card-actions justify-content-end">
              <button type="button" class="inv-qa-btn qa-edit" onclick="InventoryApp.openStockInConsignment('${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Edit</span>
              </button>
              <button type="button" class="inv-qa-btn qa-delete" onclick="InventoryApp.deleteInward('${escapeHtml(grp.key)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete</span>
              </button>
            </div>
          </article>
        `;
      }).join('');
    }

    if (tfoot) {
      tfoot.innerHTML = '';
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

    const warning = `Are you sure you want to delete consignment "${consignmentName}" (${countItems} item(s), ${fmtQty(totalQty)} units)?\n\nThis will adjust in-hand stock calculation accordingly.\n\nThis action cannot be undone.`;
    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warning, 'Delete Consignment', 'Delete Consignment', 'btn-danger');
    } else {
      ok = confirm(warning);
    }
    if (!ok) return;

    const idsToDelete = matching.map(i => i.id);
    inwards = inwards.filter(i => !idsToDelete.includes(i.id));
    selectedInwards.delete(key);
    saveData();

    await deleteDbBatch('inventory_inwards', 'InwardID', idsToDelete);

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Consignment "${consignmentName}" deleted successfully.`, 'info');
    }
  }

  // --- Multi-Selection & Bulk Deletion Helpers ---
  function updateHeaderCheckboxState(type) {
    if (type === 'dispatches' || type === 'inwards') return;
    let chkAll = null;
    let visibleRows = [];
    let targetSet = null;

    if (type === 'ledger') {
      chkAll = document.getElementById('chkSelectAllLedger');
      visibleRows = getFilteredLedgerItems();
      targetSet = selectedLedger;
    }

    if (!chkAll) return;

    if (visibleRows.length === 0) {
      chkAll.checked = false;
      chkAll.indeterminate = false;
      return;
    }

    const selectedCount = visibleRows.filter(r => targetSet.has(type === 'ledger' ? r.code : (type === 'inwards' ? r.key : r.id))).length;
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
    const leftEl = document.getElementById('invBulkLeft');
    const btnDelete = document.getElementById('btnDeleteSelected');
    const btnClear = document.getElementById('btnClearSelection');
    const btnBulkStockIn = document.getElementById('btnBulkStockIn');
    const btnBulkDispatch = document.getElementById('btnBulkDispatch');
    const headerBtn = document.getElementById('btnHeaderDeleteSelected');
    const headerCount = document.getElementById('headerSelectedCount');

    let count = 0;
    let label = 'item';
    let labelPlural = 'items';

    if (activeTab === 'ledger') {
      count = selectedLedger.size;
      label = 'equipment SKU';
      labelPlural = 'equipment SKUs';
    } else {
      count = 0;
    }

    // Only show Action Bar on Stock Ledger tab
    if (bar) {
      bar.style.display = (activeTab === 'ledger') ? 'flex' : 'none';
    }

    if (btnAddNewSku) {
      btnAddNewSku.style.display = (activeTab === 'ledger') ? 'inline-flex' : 'none';
    }

    // Stock In Bucket and Dispatch Bucket: ONLY icon (no text)
    if (btnBulkStockIn) {
      btnBulkStockIn.style.display = (activeTab === 'ledger') ? 'inline-flex' : 'none';
      const countBadge = (count > 0 && activeTab === 'ledger') ? ` <span class="badge bg-white text-dark py-0 px-1 font-monospace" style="font-size:0.68rem; border-radius:10px;">${count}</span>` : '';
      btnBulkStockIn.title = `Stock In Bucket${count > 0 ? ` (${count} items)` : ''}`;
      btnBulkStockIn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${countBadge}`;
    }
    if (btnBulkDispatch) {
      btnBulkDispatch.style.display = (activeTab === 'ledger') ? 'inline-flex' : 'none';
      const countBadge = (count > 0 && activeTab === 'ledger') ? ` <span class="badge bg-white text-dark py-0 px-1 font-monospace" style="font-size:0.68rem; border-radius:10px;">${count}</span>` : '';
      btnBulkDispatch.title = `Dispatch Equipment to Site${count > 0 ? ` (${count} items)` : ''}`;
      btnBulkDispatch.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="1" y="3" width="14" height="13" rx="1"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>${countBadge}`;
    }

    // Delete selected and Clear buttons: ONLY SHOW if checkbox is selected!
    if (count > 0) {
      if (bar) bar.classList.add('has-selection');
      if (leftEl) leftEl.style.display = 'inline-flex';
      if (badge) badge.textContent = count;
      if (text) text.textContent = `${count} ${count === 1 ? label : labelPlural} selected`;

      const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      if (btnDelete) {
        btnDelete.style.display = 'inline-flex';
        btnDelete.innerHTML = `${trashSvg} <span>Delete Selected (${count})</span>`;
      }
      if (btnClear) {
        btnClear.style.display = 'inline-flex';
      }
      if (headerBtn) {
        headerBtn.style.display = 'inline-flex';
        headerBtn.innerHTML = `${trashSvg} <span>Delete (<span id="headerSelectedCount">${count}</span>)</span>`;
      }
    } else {
      if (bar) bar.classList.remove('has-selection');
      if (leftEl) leftEl.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'none';
      if (btnClear) btnClear.style.display = 'none';
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

    const allChks = document.querySelectorAll(`.inv-row-chk[data-type="${type}"][data-id="${id}"]`);
    allChks.forEach(chk => {
      chk.checked = isChecked;
      const tr = chk.closest('tr');
      if (tr) tr.classList.toggle('inv-row-selected', isChecked);
      const card = chk.closest('.inv-mobile-card');
      if (card) card.classList.toggle('inv-card-selected', isChecked);
    });

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
      const visible = getGroupedInwardConsignments();
      visible.forEach(r => {
        if (checked) selectedInwards.add(r.key);
        else selectedInwards.delete(r.key);
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

    let warning = `Are you sure you want to delete ${selectedCodes.length} selected equipment item(s) from the catalog?`;
    if (refInwards.length > 0 || refDispatches.length > 0) {
      warning += `\n\n⚠️ Warning: The selected items are referenced in ${refInwards.length} inward purchases and ${refDispatches.length} site dispatches. Deleting them will remove these items from the live stock catalog.`;
    }
    warning += `\n\nThis action cannot be undone.`;

    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warning, 'Delete Selected Items', 'Delete All', 'btn-danger');
    } else {
      ok = confirm(warning);
    }
    if (!ok) return;

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
    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warning, 'Delete Selected Dispatches', 'Delete All', 'btn-danger');
    } else {
      ok = confirm(warning);
    }
    if (!ok) return;

    dispatches = dispatches.filter(d => !selectedIds.includes(d.id));
    selectedDispatches.clear();
    saveData();

    await deleteDbBatch('inventory_dispatches', 'DispatchID', selectedIds);

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();
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
    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warning, 'Delete Selected Consignments', 'Delete All', 'btn-danger');
    } else {
      ok = confirm(warning);
    }
    if (!ok) return;

    inwards = inwards.filter(i => !selectedIds.includes(i.id));
    selectedInwards.clear();
    saveData();

    await deleteDbBatch('inventory_inwards', 'InwardID', selectedIds);

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();
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
    const categoryOrder = ['Panels', 'Inverters', 'Cables', 'Structure', 'Hardware', 'Electricals', 'Conduit', 'Earthing', 'Others'];

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
        if (mode === 'dispatch') {
          const stockLabel = v.inHandQty > 0 ? `Stock: ${v.inHandQty} ${v.unit || 'Nos'}` : `Stock: 0 ${v.unit || 'Nos'}`;
          html += `<option value="${v.code}" ${isSelected}>${escapeHtml(v.name || v.code)} [${stockLabel}]</option>`;
        } else {
          html += `<option value="${v.code}" ${isSelected}>${escapeHtml(v.name || v.code)}</option>`;
        }
      });
      html += `</optgroup>`;
    }
    return html;
  }

  // --- Modern Searchable Equipment Picker Generator ---
  function renderPickerListHtml(rowId, mode, selectedCode, query = '') {
    const ledger = getCalculatedStockLedger();
    const categoryOrder = ['Panels', 'Inverters', 'Cables', 'Structure', 'Hardware', 'Electricals', 'Conduit', 'Earthing', 'Others'];
    const q = (query || '').toLowerCase().trim();

    let filtered = ledger;
    if (q) {
      filtered = ledger.filter(it => 
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.code && it.code.toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      return `<div class="p-3 text-center text-muted small">No equipment matching "${escapeHtml(query)}"</div>`;
    }

    const groups = {};
    filtered.forEach(item => {
      const cat = item.category || 'Others';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    let html = '';
    const renderGroup = (cat, itemsList) => {
      if (!itemsList || itemsList.length === 0) return '';
      let gHtml = `<div class="inv-picker-group-title">${escapeHtml(cat)} <span class="badge bg-white text-secondary border font-monospace ms-auto" style="font-size:0.65rem;">${itemsList.length}</span></div>`;
      itemsList.forEach(v => {
        const isSelected = v.code === selectedCode;
        const stockVal = v.inHandQty !== undefined && v.inHandQty !== null ? v.inHandQty : 0;
        const stockUnit = v.unit ? ` ${v.unit}` : '';
        gHtml += `
          <div class="inv-picker-item ${isSelected ? 'selected' : ''}" onclick="InventoryApp.selectPickerItem('${rowId}', '${mode}', '${v.code}')" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; width: 100%; gap: 12px;">
            <span class="fw-medium text-dark text-truncate" style="font-size:0.8rem;">${escapeHtml(v.name)}</span>
            <span class="font-monospace flex-shrink-0 text-nowrap" style="font-size:0.72rem; color:#64748b;">Instock: <strong class="${stockVal > 0 ? 'text-success' : 'text-secondary'}">${stockVal}${escapeHtml(stockUnit)}</strong></span>
          </div>
        `;
      });
      return gHtml;
    };

    categoryOrder.forEach(cat => {
      if (groups[cat]) html += renderGroup(cat, groups[cat]);
    });

    Object.keys(groups).forEach(cat => {
      if (!categoryOrder.includes(cat)) html += renderGroup(cat, groups[cat]);
    });

    return html;
  }

  function toggleItemPicker(rowId, prefix = '') {
    const menuId = prefix ? `${prefix}Menu_${rowId}` : `pickerMenu_${rowId}`;
    const btnId = prefix ? `${prefix}Btn_${rowId}` : `pickerBtn_${rowId}`;
    const menu = document.getElementById(menuId);
    const btn = document.getElementById(btnId);
    if (!menu) return;
    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.inv-row-picker-menu.show').forEach(m => {
      if (m !== menu) m.classList.remove('show');
    });
    document.querySelectorAll('.inv-row-picker-btn.active').forEach(b => {
      if (b !== btn) b.classList.remove('active');
    });

    if (!isShown) {
      menu.classList.add('show');
      if (btn) btn.classList.add('active');
      const input = menu.querySelector('.inv-row-picker-search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    } else {
      menu.classList.remove('show');
      if (btn) btn.classList.remove('active');
    }
  }

  function filterPickerItems(rowId, mode, query, prefix = '') {
    const listId = prefix ? `${prefix}List_${rowId}` : `pickerList_${rowId}`;
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    const isStockIn = (mode === 'stockin' || mode === 'stockin_mob');
    const row = (isStockIn ? inwardRows : dispatchRows).find(r => r.id === rowId);
    const selectedCode = row ? row.itemCode : '';
    listEl.innerHTML = renderPickerListHtml(rowId, mode, selectedCode, query);
  }

  function selectPickerItem(rowId, mode, code) {
    const ledger = getCalculatedStockLedger();
    if (mode === 'stockin' || mode === 'stockin_mob') {
      const row = inwardRows.find(r => r.id === rowId);
      if (row && code) {
        row.itemCode = code;
        const selectedMaster = ledger.find(it => it.code === code);
        if (selectedMaster) {
          row.rate = selectedMaster.buyingPrice || 0;
          row.unitPrice = selectedMaster.buyingPrice || 0;
          row.unit = selectedMaster.unit || 'Nos';
        }
        renderInwRows();
        recalcInwardTotals();
      }
    } else if (mode === 'dispatch' || mode === 'dispatch_mob') {
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
    }
  }

  // --- Modal 1: Stock In Consignment ---
  function initStockInModal() {
    const btnAdd = document.getElementById('btnAddInwRow');
    if (btnAdd) btnAdd.addEventListener('click', () => addInwRow());

    const transportCostInput = document.getElementById('inwTransportCost') || document.getElementById('inwImportCost');
    if (transportCostInput) {
      transportCostInput.addEventListener('input', () => recalcInwardTotals());
    }

    const btnSubmit = document.getElementById('btnSubmitStockIn');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveStockIn);

    const modalInw = document.getElementById('modalStockIn');
    if (modalInw && !modalInw.dataset.hasHiddenListener) {
      modalInw.dataset.hasHiddenListener = 'true';
      modalInw.addEventListener('hidden.bs.modal', () => {
        editingConsignmentInvoiceNo = null;
        editingConsignmentInwardIds = [];
        const titleEl = modalInw.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = 'Stock In Consignment';
        const submitBtnEl = document.getElementById('btnSubmitStockIn');
        if (submitBtnEl) submitBtnEl.textContent = 'Confirm Stock In';
      });
    }

    setupFileUploads();
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function addInwRow(itemCode = null, qty = 1, unitPrice = null) {
    const ledger = getCalculatedStockLedger();
    const selectedItem = itemCode ? (ledger.find(i => i.code === itemCode) || ledger[0]) : ledger[0];
    const price = unitPrice !== null ? unitPrice : (selectedItem ? (Number(selectedItem.buyingPrice) || 0) : 0);
    const effectiveGst = 18;
    const rateWithGst = price * (1 + effectiveGst / 100);

    inwardRows.push({
      id: 'inw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      itemCode: selectedItem ? selectedItem.code : '',
      qty: qty,
      unit: selectedItem ? (selectedItem.unit || 'Set') : 'Set',
      rate: price,
      totalWithoutGst: (qty && price) ? round2(qty * price) : '',
      gstRate: effectiveGst,
      rateWithGst: price ? round2(rateWithGst) : '',
      totalWithGst: (qty && price) ? round2(qty * rateWithGst) : '',
      transportCost: '',
      transportPerUnit: '',
      mspPerUnit: ''
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
    const mobContainer = document.getElementById('inwMobileCardsContainer');
    const ledger = getCalculatedStockLedger();

    // 1. Render Desktop Table Rows
    if (tbody) {
      tbody.innerHTML = inwardRows.map((row) => {
        const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
        const q = Number(row.qty) || 0;
        const r = Number(row.rate !== undefined ? row.rate : row.unitPrice) || 0;
        const g = (row.gstRate !== undefined && row.gstRate !== null && row.gstRate !== '') ? Number(row.gstRate) : 18;
        const twg = (row.totalWithoutGst !== undefined && row.totalWithoutGst !== '') ? round2(row.totalWithoutGst) : ((q && r) ? round2(q * r) : '');
        const rg = (row.rateWithGst !== undefined && row.rateWithGst !== '') ? round2(row.rateWithGst) : (r ? round2(r * (1 + g / 100)) : '');
        const t = (row.totalWithGst !== undefined && row.totalWithGst !== '') ? round2(row.totalWithGst) : ((q && rg) ? round2(q * rg) : '');
        const tc = (row.transportCost !== undefined && row.transportCost !== null && row.transportCost !== '') ? round2(row.transportCost) : '';
        const transPerUnit = q > 0 ? ((Number(tc) || 0) / q) : 0;
        const cpu = (row.costPerUnit !== undefined && row.costPerUnit !== null && row.costPerUnit !== '')
          ? round2(row.costPerUnit)
          : ((r > 0 || transPerUnit > 0) ? round2(r + transPerUnit) : '');

        const unitName = escapeHtml(item.unit || row.unit || 'Nos');

        return `
          <tr data-row-id="${row.id}">
            <td style="min-width:180px;">
              <div class="inv-row-item-picker" id="pickerWrap_${row.id}">
                <button type="button" class="inv-row-picker-btn border-0 p-0 w-100 bg-transparent text-center d-flex align-items-center justify-content-between px-1" id="pickerBtn_${row.id}" onclick="InventoryApp.toggleItemPicker('${row.id}')" style="box-shadow:none;">
                  <span class="text-truncate flex-grow-1 text-dark text-start" id="pickerLabel_${row.id}">${escapeHtml(item.name || 'Select Item')}</span>
                  <svg class="ms-1 text-muted flex-shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="inv-row-picker-menu" id="pickerMenu_${row.id}">
                  <div class="inv-row-picker-search-wrap">
                    <input type="text" class="inv-row-picker-search-input" placeholder="Search item..." oninput="InventoryApp.filterPickerItems('${row.id}', 'stockin', this.value)" autocomplete="off">
                  </div>
                  <div class="inv-row-picker-list" id="pickerList_${row.id}">
                    ${renderPickerListHtml(row.id, 'stockin', row.itemCode, '')}
                  </div>
                </div>
              </div>
            </td>
            <td>
              <div class="d-flex align-items-center justify-content-end gap-1 px-1">
                <input type="number" class="form-control form-control-sm mat-qty inw-row-qty border-0 p-0 text-end" min="0" step="any" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="0" autocomplete="off" style="width: 50px;">
                <span class="text-secondary small fw-medium flex-shrink-0 inw-row-unit-label" style="font-size:0.75rem;">${unitName}</span>
              </div>
            </td>
            <td><input type="number" class="form-control form-control-sm mat-rate inw-row-rate border-0 p-0 text-end" min="0" step="any" data-row-id="${row.id}" value="${r || ''}" placeholder="0.00" autocomplete="off"></td>
            <td><input type="number" class="form-control form-control-sm mat-total-without-gst inw-row-total-without-gst border-0 p-0 text-end fw-semibold text-secondary" min="0" step="any" data-row-id="${row.id}" value="${twg}" placeholder="0.00" autocomplete="off"></td>
            <td><input type="number" class="form-control form-control-sm mat-gst inw-row-gst border-0 p-0 text-end" min="0" max="100" step="any" data-row-id="${row.id}" value="${g}" placeholder="18" autocomplete="off"></td>
            <td><input type="number" class="form-control form-control-sm mat-rate-with-gst inw-row-rate-with-gst border-0 p-0 text-end" min="0" step="any" data-row-id="${row.id}" value="${rg}" placeholder="0.00" autocomplete="off"></td>
            <td><input type="number" class="form-control form-control-sm mat-total inw-row-total-with-gst border-0 p-0 text-end fw-semibold text-dark" min="0" step="any" data-row-id="${row.id}" value="${t}" placeholder="0.00" autocomplete="off"></td>
            <td><input type="number" class="form-control form-control-sm mat-transport inw-row-transport border-0 p-0 text-end fw-semibold text-dark" min="0" step="any" data-row-id="${row.id}" value="${tc}" placeholder="0" autocomplete="off"></td>
            <td>
              <div class="d-flex align-items-center justify-content-end gap-1 px-1">
                <input type="number" class="form-control form-control-sm mat-cost-per-unit inw-row-cost-per-unit border-0 p-0 text-end fw-semibold text-dark" min="0" step="any" data-row-id="${row.id}" value="${cpu}" placeholder="Auto" readonly tabindex="-1" autocomplete="off" style="width: 65px;">
                <span class="text-muted small flex-shrink-0 inw-row-cost-unit-label" style="font-size:0.72rem;">/${unitName}</span>
              </div>
            </td>
            <td class="text-center"><span class="text-danger fw-bold btn-remove-inw-row" data-row-id="${row.id}" style="cursor:pointer; font-size:0.9rem;" title="Remove">✕</span></td>
          </tr>
        `;
      }).join('');
    }

    // 2. Render Mobile Touch Cards
    if (mobContainer) {
      mobContainer.innerHTML = inwardRows.map((row) => {
        const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
        const q = Number(row.qty) || 0;
        const r = Number(row.rate !== undefined ? row.rate : row.unitPrice) || 0;
        const g = (row.gstRate !== undefined && row.gstRate !== null && row.gstRate !== '') ? Number(row.gstRate) : 18;
        const twg = (row.totalWithoutGst !== undefined && row.totalWithoutGst !== '') ? round2(row.totalWithoutGst) : ((q && r) ? round2(q * r) : '');
        const rg = (row.rateWithGst !== undefined && row.rateWithGst !== '') ? round2(row.rateWithGst) : (r ? round2(r * (1 + g / 100)) : '');
        const t = (row.totalWithGst !== undefined && row.totalWithGst !== '') ? round2(row.totalWithGst) : ((q && rg) ? round2(q * rg) : '');
        const tc = (row.transportCost !== undefined && row.transportCost !== null && row.transportCost !== '') ? round2(row.transportCost) : '';
        const transPerUnit = q > 0 ? ((Number(tc) || 0) / q) : 0;
        const cpu = (row.costPerUnit !== undefined && row.costPerUnit !== null && row.costPerUnit !== '')
          ? round2(row.costPerUnit)
          : ((r > 0 || transPerUnit > 0) ? round2(r + transPerUnit) : '');

        const unitName = escapeHtml(item.unit || row.unit || 'Nos');

        return `
          <div class="inv-inw-card" data-row-id="${row.id}">
            <!-- Header: Item Picker + Delete -->
            <div class="card-header d-flex align-items-center justify-content-between gap-2">
              <div class="flex-grow-1 min-w-0">
                <div class="inv-row-item-picker" id="pickerWrap_mob_${row.id}">
                  <button type="button" class="btn btn-sm btn-light border w-100 text-start d-flex align-items-center justify-content-between px-2 py-1.5 shadow-none" id="picker_mob_Btn_${row.id}" onclick="InventoryApp.toggleItemPicker('${row.id}', 'picker_mob_')">
                    <span class="text-truncate fw-semibold text-dark fs-7" id="pickerLabel_mob_${row.id}">${escapeHtml(item.name || 'Select Item')}</span>
                    <svg class="ms-1 text-muted flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <div class="inv-row-picker-menu" id="picker_mob_Menu_${row.id}">
                    <div class="inv-row-picker-search-wrap">
                      <input type="text" class="inv-row-picker-search-input" placeholder="Search item..." oninput="InventoryApp.filterPickerItems('${row.id}', 'stockin_mob', this.value, 'picker_mob_')" autocomplete="off">
                    </div>
                    <div class="inv-row-picker-list" id="picker_mob_List_${row.id}">
                      ${renderPickerListHtml(row.id, 'stockin_mob', row.itemCode, '')}
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-danger p-0 d-flex align-items-center justify-content-center flex-shrink-0 btn-remove-inw-row" data-row-id="${row.id}" style="width: 28px; height: 28px; border-radius: 6px;" title="Remove Item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Card Body -->
            <div class="card-body">
              <div class="inv-inw-card-grid">
                <!-- Col 1: Quantity -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Quantity</label>
                  <div class="input-group input-group-sm">
                    <input type="number" class="form-control text-end fw-bold inw-mob-qty" min="0" step="any" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="0">
                    <span class="input-group-text px-2 text-muted fs-8 bg-light flex-shrink-0">${unitName}</span>
                  </div>
                </div>

                <!-- Col 2: Cost / Unit (₹) -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Cost / Unit (₹)</label>
                  <input type="number" class="form-control form-control-sm text-end fw-semibold inw-mob-rate" min="0" step="any" data-row-id="${row.id}" value="${r || ''}" placeholder="0.00">
                </div>

                <!-- Col 3: GST % -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">GST %</label>
                  <div class="input-group input-group-sm">
                    <input type="number" class="form-control text-end inw-mob-gst" min="0" max="100" step="any" data-row-id="${row.id}" value="${g}" placeholder="18">
                    <span class="input-group-text px-2 text-muted fs-8 bg-light flex-shrink-0">%</span>
                  </div>
                </div>

                <!-- Col 4: Cost+GST (₹) -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Cost+GST (₹)</label>
                  <input type="number" class="form-control form-control-sm text-end inw-mob-rate-with-gst" min="0" step="any" data-row-id="${row.id}" value="${rg}" placeholder="0.00">
                </div>

                <!-- Col 5: Total (excl. GST) -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Total (excl. GST)</label>
                  <input type="number" class="form-control form-control-sm text-end fw-semibold text-secondary inw-mob-total-without-gst" min="0" step="any" data-row-id="${row.id}" value="${twg}" placeholder="0.00">
                </div>

                <!-- Col 6: Total (incl. GST) -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Total (incl. GST)</label>
                  <input type="number" class="form-control form-control-sm text-end fw-bold text-dark inw-mob-total-with-gst" min="0" step="any" data-row-id="${row.id}" value="${t}" placeholder="0.00">
                </div>

                <!-- Col 7: Transport Cost -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Transport Cost (₹)</label>
                  <input type="number" class="form-control form-control-sm text-end inw-mob-transport-input" min="0" step="any" data-row-id="${row.id}" value="${tc}" placeholder="0.00">
                </div>

                <!-- Col 8: Landed Cost per Unit -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-primary fs-8 fw-semibold mb-1">Cost per ${unitName}</label>
                  <div class="inv-inw-card-kpi d-flex align-items-center justify-content-end px-2 border rounded text-end">
                    <span class="fw-bold text-primary fs-7 inw-mob-cpu-display" data-row-id="${row.id}">${fmtRupees(cpu || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Dynamic header text for COST PER UNIT if all items share the same unit
    const thCpu = document.querySelector('.inw-th-cost-per-unit');
    if (thCpu) {
      const units = Array.from(new Set(inwardRows.map(r => {
        const itm = ledger.find(i => i.code === r.itemCode);
        return (itm?.unit || r.unit || '').trim();
      }).filter(Boolean)));
      if (units.length === 1) {
        thCpu.textContent = `COST PER ${units[0].toUpperCase()}`;
      } else {
        thCpu.textContent = `COST PER UNIT`;
      }
    }

    attachInwRowHandlers();
  }

  function attachInwRowHandlers() {
    const modalStockIn = document.getElementById('modalStockIn');
    if (!modalStockIn) return;

    modalStockIn.querySelectorAll('.btn-remove-inw-row').forEach(btn => {
      btn.onclick = () => {
        const rowId = btn.getAttribute('data-row-id');
        removeInwRow(rowId);
      };
    });

    const bindInputs = (selector, field) => {
      modalStockIn.querySelectorAll(selector).forEach(el => {
        el.oninput = () => {
          const rowId = el.getAttribute('data-row-id');
          updateInwRowField(rowId, field, el.value);
        };
      });
    };

    // Desktop bindings
    bindInputs('.inw-row-qty', 'qty');
    bindInputs('.inw-row-rate', 'rate');
    bindInputs('.inw-row-gst', 'gst');
    bindInputs('.inw-row-rate-with-gst', 'rateWithGst');
    bindInputs('.inw-row-total-without-gst', 'totalWithoutGst');
    bindInputs('.inw-row-total-with-gst', 'totalWithGst');
    bindInputs('.inw-row-transport', 'transport');

    // Mobile bindings
    bindInputs('.inw-mob-qty', 'qty');
    bindInputs('.inw-mob-rate', 'rate');
    bindInputs('.inw-mob-gst', 'gst');
    bindInputs('.inw-mob-rate-with-gst', 'rateWithGst');
    bindInputs('.inw-mob-total-without-gst', 'totalWithoutGst');
    bindInputs('.inw-mob-total-with-gst', 'totalWithGst');
    bindInputs('.inw-mob-transport-input', 'transport');
  }

  function updateInwRowField(rowId, field, rawVal) {
    const row = inwardRows.find(r => r.id === rowId);
    if (!row) return;

    const val = Number(rawVal) || 0;
    let q = Number(row.qty) || 0;
    let r = Number(row.rate !== undefined ? row.rate : row.unitPrice) || 0;
    let g = (row.gstRate !== undefined && row.gstRate !== null && row.gstRate !== '') ? Number(row.gstRate) : 18;
    let rg = Number(row.rateWithGst) || round2(r * (1 + g / 100));
    let twg = Number(row.totalWithoutGst) || round2(q * r);
    let t = Number(row.totalWithGst) || round2(q * rg);

    if (field === 'qty') {
      row.qty = rawVal === '' ? '' : val;
      q = val;
      if (q > 0) {
        if (r > 0) {
          rg = round2(r * (1 + g / 100));
          twg = round2(q * r);
          t = round2(q * rg);
        } else if (rg > 0) {
          r = round2(rg / (1 + g / 100));
          twg = round2(q * r);
          t = round2(q * rg);
        } else if (twg > 0) {
          r = round2(twg / q);
          rg = round2(r * (1 + g / 100));
          t = round2(q * rg);
        } else if (t > 0) {
          rg = round2(t / q);
          r = round2(rg / (1 + g / 100));
          twg = round2(q * r);
        }
      } else {
        twg = 0;
        t = 0;
      }
    } else if (field === 'rate') {
      row.rate = rawVal === '' ? '' : val;
      r = val;
      rg = round2(r * (1 + g / 100));
      if (q > 0) {
        twg = round2(q * r);
        t = round2(q * rg);
      } else {
        twg = 0;
        t = 0;
      }
    } else if (field === 'gst') {
      row.gstRate = val;
      g = val;
      if (r > 0) {
        rg = round2(r * (1 + g / 100));
        if (q > 0) {
          twg = round2(q * r);
          t = round2(q * rg);
        }
      } else if (rg > 0) {
        r = round2(rg / (1 + g / 100));
        if (q > 0) {
          twg = round2(q * r);
          t = round2(q * rg);
        }
      } else if (twg > 0) {
        t = round2(twg * (1 + g / 100));
        if (q > 0) {
          rg = round2(t / q);
        }
      }
    } else if (field === 'rateWithGst') {
      row.rateWithGst = rawVal === '' ? '' : val;
      rg = val;
      r = round2(rg / (1 + g / 100));
      row.rate = r;
      if (q > 0) {
        twg = round2(q * r);
        t = round2(q * rg);
      } else {
        twg = 0;
        t = 0;
      }
    } else if (field === 'totalWithoutGst') {
      twg = val;
      row.totalWithoutGst = rawVal === '' ? '' : twg;
      t = round2(twg * (1 + g / 100));
      row.totalWithGst = rawVal === '' ? '' : t;
      if (q > 0) {
        r = round2(twg / q);
        row.rate = r;
        rg = round2(t / q);
        row.rateWithGst = rg;
      }
    } else if (field === 'totalWithGst') {
      t = val;
      row.totalWithGst = rawVal === '' ? '' : t;
      twg = round2(t / (1 + g / 100));
      row.totalWithoutGst = rawVal === '' ? '' : twg;
      if (q > 0) {
        rg = round2(t / q);
        row.rateWithGst = rg;
        r = round2(twg / q);
        row.rate = r;
      }
    } else if (field === 'transport') {
      if (rawVal.trim() === '') {
        row.userEditedTransport = false;
        row.transportCost = '';
      } else {
        row.userEditedTransport = true;
        row.transportCost = val;
      }
    }

    row.rate = r;
    row.rateWithGst = rg;
    row.totalWithoutGst = twg;
    row.totalWithGst = t;

    syncInwRowInputs(rowId);
    recalcInwardTotals();
  }

  function syncInwRowInputs(rowId) {
    const row = inwardRows.find(r => r.id === rowId);
    if (!row) return;

    // Sync Desktop elements
    const tr = document.querySelector(`#inwItemsTableBody tr[data-row-id="${rowId}"]`);
    if (tr) {
      const qEl = tr.querySelector('.inw-row-qty');
      const rEl = tr.querySelector('.inw-row-rate');
      const gEl = tr.querySelector('.inw-row-gst');
      const rgEl = tr.querySelector('.inw-row-rate-with-gst');
      const twgEl = tr.querySelector('.inw-row-total-without-gst');
      const tEl = tr.querySelector('.inw-row-total-with-gst');
      const tcEl = tr.querySelector('.inw-row-transport');
      const cpuEl = tr.querySelector('.inw-row-cost-per-unit');

      if (qEl && document.activeElement !== qEl) qEl.value = row.qty !== undefined && row.qty !== null ? row.qty : '';
      if (rEl && document.activeElement !== rEl) rEl.value = row.rate || '';
      if (gEl && document.activeElement !== gEl) gEl.value = row.gstRate !== undefined ? row.gstRate : 18;
      if (rgEl && document.activeElement !== rgEl) rgEl.value = row.rateWithGst || '';
      if (twgEl && document.activeElement !== twgEl) twgEl.value = row.totalWithoutGst || '';
      if (tEl && document.activeElement !== tEl) tEl.value = row.totalWithGst || '';
      if (tcEl && document.activeElement !== tcEl) tcEl.value = row.transportCost !== undefined && row.transportCost !== null ? row.transportCost : '';
      if (cpuEl) cpuEl.value = row.costPerUnit || '';
    }

    // Sync Mobile elements
    const card = document.querySelector(`#inwMobileCardsContainer .inv-inw-card[data-row-id="${rowId}"]`);
    if (card) {
      const qEl = card.querySelector('.inw-mob-qty');
      const rEl = card.querySelector('.inw-mob-rate');
      const gEl = card.querySelector('.inw-mob-gst');
      const rgEl = card.querySelector('.inw-mob-rate-with-gst');
      const twgEl = card.querySelector('.inw-mob-total-without-gst');
      const tEl = card.querySelector('.inw-mob-total-with-gst');
      const tcEl = card.querySelector('.inw-mob-transport-input');
      const cpuDisplay = card.querySelector('.inw-mob-cpu-display');

      if (qEl && document.activeElement !== qEl) qEl.value = row.qty !== undefined && row.qty !== null ? row.qty : '';
      if (rEl && document.activeElement !== rEl) rEl.value = row.rate || '';
      if (gEl && document.activeElement !== gEl) gEl.value = row.gstRate !== undefined ? row.gstRate : 18;
      if (rgEl && document.activeElement !== rgEl) rgEl.value = row.rateWithGst || '';
      if (twgEl && document.activeElement !== twgEl) twgEl.value = row.totalWithoutGst || '';
      if (tEl && document.activeElement !== tEl) tEl.value = row.totalWithGst || '';
      if (tcEl && document.activeElement !== tcEl) tcEl.value = row.transportCost !== undefined && row.transportCost !== null ? row.transportCost : '';
      if (cpuDisplay) cpuDisplay.textContent = fmtRupees(row.costPerUnit || 0);
    }
  }

  function recalcInwardTotals() {
    const transportCostInput = document.getElementById('inwTransportCost') || document.getElementById('inwImportCost');
    const totalTransportCost = Math.max(0, Number(transportCostInput?.value) || 0);

    let totalUnits = 0;
    let sumTotalWithoutGst = 0;
    let sumGstAmount = 0;
    let sumTotalWithGst = 0;

    // 1. Line totals calculation
    inwardRows.forEach(row => {
      const q = Number(row.qty) || 0;
      const r = Number(row.rate !== undefined ? row.rate : row.unitPrice) || 0;
      const g = (row.gstRate !== undefined && row.gstRate !== null && row.gstRate !== '') ? Number(row.gstRate) : 18;
      const rg = (row.rateWithGst !== undefined && row.rateWithGst !== '') ? Number(row.rateWithGst) : round2(r * (1 + g / 100));
      const twg = (row.totalWithoutGst !== undefined && row.totalWithoutGst !== '') ? Number(row.totalWithoutGst) : round2(q * r);
      const t = (row.totalWithGst !== undefined && row.totalWithGst !== '') ? Number(row.totalWithGst) : round2(q * rg);

      row.rate = r;
      row.rateWithGst = rg;
      row.totalWithoutGst = twg;
      row.totalWithGst = t;

      totalUnits += q;
      sumTotalWithoutGst += twg;
      sumTotalWithGst += t;
      sumGstAmount += Math.max(0, t - twg);
    });

    // 2. Proportionate Transportation Cost Allocation
    let sumUserEditedTransport = 0;
    let userEditedCount = 0;

    inwardRows.forEach(row => {
      if (row.userEditedTransport && row.transportCost !== '' && row.transportCost !== null && row.transportCost !== undefined) {
        sumUserEditedTransport += Number(row.transportCost) || 0;
        userEditedCount++;
      }
    });

    const uneditedCount = inwardRows.length - userEditedCount;
    const remainingTransport = Math.max(0, totalTransportCost - sumUserEditedTransport);
    let sumUneditedTotals = 0;

    inwardRows.forEach(row => {
      if (!row.userEditedTransport || row.transportCost === '' || row.transportCost === null || row.transportCost === undefined) {
        sumUneditedTotals += Number(row.totalWithGst) || 0;
      }
    });

    inwardRows.forEach(row => {
      let share = 0;
      if (row.userEditedTransport && row.transportCost !== '' && row.transportCost !== null && row.transportCost !== undefined) {
        share = Number(row.transportCost) || 0;
      } else {
        const tot = Number(row.totalWithGst) || 0;
        if (sumUneditedTotals > 0 && remainingTransport > 0) {
          share = round2((tot / sumUneditedTotals) * remainingTransport);
        } else if (remainingTransport > 0 && uneditedCount > 0) {
          share = round2(remainingTransport / uneditedCount);
        } else {
          share = 0;
        }
        row.transportCost = share;
      }

      const q = Number(row.qty) || 0;
      const r = Number(row.rate !== undefined ? row.rate : row.unitPrice) || 0;
      const transPerUnit = q > 0 ? round2(share / q) : 0;
      const costPerUnit = round2(r + transPerUnit);

      row.transportPerUnit = transPerUnit;
      row.costPerUnit = costPerUnit;
      row.mspPerUnit = costPerUnit;

      // Update Desktop row display
      const tr = document.querySelector(`#inwItemsTableBody tr[data-row-id="${row.id}"]`);
      if (tr) {
        const tEl = tr.querySelector('.inw-row-transport');
        const cpuEl = tr.querySelector('.inw-row-cost-per-unit');
        const twgEl = tr.querySelector('.inw-row-total-without-gst');
        const tElTot = tr.querySelector('.inw-row-total-with-gst');
        const rgEl = tr.querySelector('.inw-row-rate-with-gst');
        const rEl = tr.querySelector('.inw-row-rate');

        if (tEl && document.activeElement !== tEl) tEl.value = share > 0 ? share : '';
        if (cpuEl) cpuEl.value = costPerUnit > 0 ? costPerUnit : '';
        if (twgEl && document.activeElement !== twgEl) twgEl.value = row.totalWithoutGst || '';
        if (tElTot && document.activeElement !== tElTot) tElTot.value = row.totalWithGst || '';
        if (rgEl && document.activeElement !== rgEl) rgEl.value = row.rateWithGst || '';
        if (rEl && document.activeElement !== rEl) rEl.value = row.rate || '';
      }

      // Update Mobile card display
      const card = document.querySelector(`#inwMobileCardsContainer .inv-inw-card[data-row-id="${row.id}"]`);
      if (card) {
        const mobTwg = card.querySelector('.inw-mob-total-without-gst');
        const mobT = card.querySelector('.inw-mob-total-with-gst');
        const mobTrans = card.querySelector('.inw-mob-transport-input');
        const mobCpu = card.querySelector('.inw-mob-cpu-display');
        const mobRg = card.querySelector('.inw-mob-rate-with-gst');
        const mobR = card.querySelector('.inw-mob-rate');

        if (mobTwg && document.activeElement !== mobTwg) mobTwg.value = row.totalWithoutGst || '';
        if (mobT && document.activeElement !== mobT) mobT.value = row.totalWithGst || '';
        if (mobTrans && document.activeElement !== mobTrans) mobTrans.value = share > 0 ? share : '';
        if (mobCpu) mobCpu.textContent = fmtRupees(costPerUnit || 0);
        if (mobRg && document.activeElement !== mobRg) mobRg.value = row.rateWithGst || '';
        if (mobR && document.activeElement !== mobR) mobR.value = row.rate || '';
      }
    });

    // 3. Summary (Total Material Cost includes transport cost without GST, and Total GST)
    const totalMaterialCost = round2(sumTotalWithoutGst + totalTransportCost);

    const lblGst = document.getElementById('inwSummaryGst');
    const lblTotalMaterial = document.getElementById('inwSummaryTotalMaterialCost');
    const lblGrandLegacy = document.getElementById('inwDisplayTotalCost');

    if (lblGst) lblGst.textContent = fmtRupees(sumGstAmount);
    if (lblTotalMaterial) lblTotalMaterial.textContent = fmtRupees(totalMaterialCost);
    if (lblGrandLegacy) lblGrandLegacy.textContent = fmtRupees(totalMaterialCost);
  }

  let editingConsignmentInvoiceNo = null;
  let editingConsignmentInwardIds = [];

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
    editingConsignmentInwardIds = matchingInwards.map(rec => rec.id);

    // Set modal title & submit button text
    const titleEl = modalEl.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = `Stock In Consignment — ${editingConsignmentInvoiceNo}`;
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
        originalQty: qty,
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
    editingConsignmentInwardIds = [];

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

  let isSubmittingStockIn = false;

  async function handleSaveStockIn() {
    if (isSubmittingStockIn) return;

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
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Select an equipment item`, 'warning');
        return;
      }
      const qty = Number(r.qty);
      if (!qty || qty <= 0) {
        if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Enter a valid quantity`, 'warning');
        return;
      }
    }

    // Refresh totals calculation
    recalcInwardTotals();

    const invoiceNoToUse = editingConsignmentInvoiceNo || `INV-${Date.now().toString().slice(-6)}`;
    const isEditing = Boolean(editingConsignmentInvoiceNo || (editingConsignmentInwardIds && editingConsignmentInwardIds.length > 0));

    isSubmittingStockIn = true;
    const submitBtn = document.getElementById('btnSubmitStockIn');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      // If editing existing consignment, remove previous entries from memory and DB
      if (isEditing) {
        const oldRecords = inwards.filter(i => 
          (editingConsignmentInwardIds && editingConsignmentInwardIds.includes(i.id)) ||
          (editingConsignmentInvoiceNo && (i.invoiceNo === editingConsignmentInvoiceNo || i.id === editingConsignmentInvoiceNo))
        );
        const oldIdSet = new Set(oldRecords.map(o => o.id));
        inwards = inwards.filter(i => !oldIdSet.has(i.id));

        if (typeof DB !== 'undefined') {
          for (const old of oldRecords) {
            try {
              await DB.remove('inventory_inwards', row => (row.InwardID || row.id) === old.id);
            } catch (e) {}
          }
        }
      }

      let totalConsignmentCost = 0;
      let totalConsignmentUnits = 0;

      const docName = inwardDocFiles.map(f => f.name).join(', ') || (inwardDocFile ? inwardDocFile.name : null);
      const docData = inwardDocFiles.length > 0 ? (inwardDocFiles[0].data || inwardDocFiles[0].url) : (inwardDocFile ? inwardDocFile.data : null);
      const documents = inwardDocFiles.map(f => ({ name: f.name, size: f.size, url: f.url, data: f.data }));

      for (let idx = 0; idx < inwardRows.length; idx++) {
        const r = inwardRows[idx];
        const qty = Number(r.qty);
        const unitPrice = Number(r.rate !== undefined ? r.rate : r.unitPrice) || 0;
        const gstRate = Number(r.gstRate) || 0;
        const rowTransport = Number(r.transportCost) || 0;
        const costPerUnit = Number(r.costPerUnit) || round2(unitPrice + (qty > 0 ? (rowTransport / qty) : 0));
        const totalCost = round2((qty * unitPrice) + rowTransport);

        totalConsignmentCost += totalCost;
        totalConsignmentUnits += qty;

        const newInward = {
          id: isEditing && r.inwardId ? r.inwardId : `INW-${Date.now()}-${idx + 1}`,
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
        const effectiveCostPerUnit = costPerUnit > 0 ? costPerUnit : unitPrice;
        if (masterItem && effectiveCostPerUnit > 0) {
          masterItem.buyingPrice = effectiveCostPerUnit;
          masterItem.costPerUnit = effectiveCostPerUnit;
        }

        // Save strictly required fields to DB: QTY, Cost (UnitPrice), GST (GstRate), Cost per unit, Transport Cost, Consignment Transport Cost
        if (typeof DB !== 'undefined') {
          try {
            await DB.insert('inventory_inwards', {
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
            });
          } catch (err) {
            console.warn('[DB] inventory_inwards insert error:', err);
          }

          if (masterItem && effectiveCostPerUnit > 0) {
            try {
              await DB.update('inventory_items', row => (row.ItemCode || row.code) === r.itemCode, {
                BuyingPrice: effectiveCostPerUnit
              });
            } catch (e) {}
          }
        }
      }

      saveData();
      clearSelection('ledger');

      editingConsignmentInvoiceNo = null;
      editingConsignmentInwardIds = [];

      const modalEl = document.getElementById('modalStockIn');
      const bsModal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      if (bsModal) bsModal.hide();

      updateAllTabCounters();
      renderKpiCards();
      renderCategoryChips();
      renderLedgerTable();
      renderInwardsTable();
      renderDispatchesTable();
    } finally {
      isSubmittingStockIn = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();
    switchTab('inwards');

    if (typeof UI !== 'undefined') {
      const msg = isEditing
        ? `Consignment ${invoiceNoToUse} updated successfully (${inwardRows.length} items). Total: ${fmtRupees(totalConsignmentCost)}.`
        : `Successfully stocked in ${inwardRows.length} items (${fmtQty(totalConsignmentUnits)} units). Total: ${fmtRupees(totalConsignmentCost)}.`;
      UI.toast(msg, 'success');
    }
  }

  // --- Modal 2: Site Dispatch ---
  let dispatchCustomerRows = [];

  function initDispatchModal() {
    const btnAdd = document.getElementById('btnAddDspRow');
    if (btnAdd) btnAdd.onclick = () => addDspRow();

    const mapWithStockChk = document.getElementById('dspMapWithStock');
    if (mapWithStockChk) {
      mapWithStockChk.onchange = () => {
        renderDspModalRows();
        recalcDispatchTotals();
      };
    }

    const isOurProjectChk = document.getElementById('dspIsOurProject');
    const logisticsSection = document.getElementById('dspLogisticsSection');
    if (isOurProjectChk && logisticsSection) {
      isOurProjectChk.onchange = () => {
        logisticsSection.style.display = isOurProjectChk.checked ? 'block' : 'none';
        recalcDispatchTotals();
      };
    }

    const transportInput = document.getElementById('dspTransportCost');
    const distanceInput = document.getElementById('dspDistanceKm');
    const costPerKmInput = document.getElementById('dspCostPerKm');

    if (transportInput) {
      transportInput.oninput = () => {
        const trans = Number(transportInput.value) || 0;
        const dist = Number(distanceInput?.value) || 0;
        const cpk = Number(costPerKmInput?.value) || 0;
        if (dist > 0 && document.activeElement === transportInput) {
          if (costPerKmInput) costPerKmInput.value = (trans / dist).toFixed(2);
        } else if (cpk > 0 && document.activeElement === transportInput) {
          if (distanceInput) distanceInput.value = (trans / cpk).toFixed(1);
        }
        recalcDispatchTotals();
      };
    }

    if (distanceInput) {
      distanceInput.oninput = () => {
        const dist = Number(distanceInput.value) || 0;
        const trans = Number(transportInput?.value) || 0;
        const cpk = Number(costPerKmInput?.value) || 0;
        if (trans > 0 && document.activeElement === distanceInput) {
          if (costPerKmInput) costPerKmInput.value = dist > 0 ? (trans / dist).toFixed(2) : '';
        } else if (cpk > 0 && document.activeElement === distanceInput) {
          if (transportInput) transportInput.value = (dist * cpk).toFixed(2);
        }
        recalcDispatchTotals();
      };
    }

    if (costPerKmInput) {
      costPerKmInput.oninput = () => {
        const cpk = Number(costPerKmInput.value) || 0;
        const dist = Number(distanceInput?.value) || 0;
        const trans = Number(transportInput?.value) || 0;
        if (dist > 0 && document.activeElement === costPerKmInput) {
          if (transportInput) transportInput.value = (dist * cpk).toFixed(2);
        } else if (trans > 0 && cpk > 0 && document.activeElement === costPerKmInput) {
          if (distanceInput) distanceInput.value = (trans / cpk).toFixed(1);
        }
        recalcDispatchTotals();
      };
    }

    const extraCostInput = document.getElementById('dspExtraDeliveryCost');
    const extraCommentInput = document.getElementById('dspExtraDeliveryComment');
    if (extraCostInput) extraCostInput.oninput = () => recalcDispatchTotals();
    if (extraCommentInput) extraCommentInput.oninput = () => recalcDispatchTotals();

    const btnAddCust = document.getElementById('btnAddDspCustomer');
    if (btnAddCust) btnAddCust.onclick = () => addDspCustomerRow();

    const btnSubmit = document.getElementById('btnSubmitDispatch');
    if (btnSubmit) btnSubmit.onclick = handleSaveDispatch;

    const modalDsp = document.getElementById('modalSiteDispatch');
    if (modalDsp && !modalDsp.dataset.hasHiddenListener) {
      modalDsp.dataset.hasHiddenListener = 'true';
      modalDsp.addEventListener('hidden.bs.modal', () => {
        editingDispatchChallanNo = null;
      editingDispatchIds = [];
        editingDispatchIds = [];
        const titleEl = document.getElementById('modalSiteDispatchTitle');
        if (titleEl) titleEl.textContent = 'Dispatch Equipment to Site';
        const btnSubmitEl = document.getElementById('btnSubmitDispatch');
        if (btnSubmitEl) btnSubmitEl.textContent = 'Confirm Dispatch';
      });
    }
  }

  function addDspCustomerRow(slNo = '', name = '', setCost = '', installCost = '', otherCost = '', otherComment = '') {
    dispatchCustomerRows.push({
      id: 'dsp_c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      slNo: slNo || '',
      name: name || '',
      setCost: setCost !== '' ? setCost : '',
      installCost: installCost !== '' ? installCost : '',
      deliveryCost: '',
      otherCost: otherCost !== '' ? otherCost : '',
      otherComment: otherComment || '',
      isManualDelivery: false
    });
    renderDspCustomerRows();
    recalcDispatchTotals();
  }

  function removeDspCustomerRow(rowId) {
    if (dispatchCustomerRows.length <= 1) {
      dispatchCustomerRows = [];
      renderDspCustomerRows();
      recalcDispatchTotals();
      return;
    }
    dispatchCustomerRows = dispatchCustomerRows.filter(r => r.id !== rowId);
    renderDspCustomerRows();
    recalcDispatchTotals();
  }

  function renderCustomerPickerListHtml(rowId, selectedSlNo, query = '') {
    let customers = [];
    try {
      if (typeof DB !== 'undefined') {
        const raw = DB.getAll('installments') || [];
        customers = raw.filter(r => r && r.Status !== 'Deactive');
      }
    } catch (e) {}

    const q = (query || '').toLowerCase().trim();
    let filtered = customers;
    if (q) {
      filtered = customers.filter(c => {
        const name = (c.Name || '').toLowerCase();
        const cons = String(c.ConsumerNo || '').toLowerCase();
        const sl = String(c.SlNo || '').toLowerCase();
        const phone = String(c.Phone || c.Mobile || '').toLowerCase();
        const city = String(c.City || c.Address || '').toLowerCase();
        return name.includes(q) || cons.includes(q) || sl.includes(q) || phone.includes(q) || city.includes(q);
      });
    }

    let html = '';

    if (filtered.length === 0) {
      html += `<div class="p-3 text-center text-muted small">No customers matching "${escapeHtml(query)}"</div>`;
      return html;
    }

    filtered.forEach(c => {
      const sl = String(c.SlNo || '');
      const isSelected = (sl && sl === String(selectedSlNo));

      html += `
        <div class="inv-picker-item ${isSelected ? 'selected' : ''}" onclick="InventoryApp.selectDspCustomer('${rowId}', '${sl}')" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; width: 100%; cursor: pointer;">
          <div class="min-w-0 flex-grow-1 text-truncate me-2 text-start">
            <span class="fw-semibold text-dark d-block text-truncate" style="font-size:0.80rem;">${escapeHtml(c.Name || 'Unknown')}</span>
          </div>
          ${isSelected ? '<span class="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5 flex-shrink-0" style="font-size:0.65rem;">Selected</span>' : ''}
        </div>
      `;
    });

    return html;
  }

  function toggleCustomerPicker(rowId, prefix = '') {
    let menu = null;
    let btn = null;

    if (prefix === 'mob') {
      menu = document.getElementById(`custPickerMenu_mob_${rowId}`);
      btn = document.getElementById(`custPickerBtn_mob_${rowId}`);
    } else if (prefix) {
      menu = document.getElementById(`${prefix}Menu_${rowId}`);
      btn = document.getElementById(`${prefix}Btn_${rowId}`);
    } else {
      if (window.innerWidth < 768) {
        menu = document.getElementById(`custPickerMenu_mob_${rowId}`) || document.getElementById(`custPickerMenu_${rowId}`);
        btn = document.getElementById(`custPickerBtn_mob_${rowId}`) || document.getElementById(`custPickerBtn_${rowId}`);
      } else {
        menu = document.getElementById(`custPickerMenu_${rowId}`) || document.getElementById(`custPickerMenu_mob_${rowId}`);
        btn = document.getElementById(`custPickerBtn_${rowId}`) || document.getElementById(`custPickerBtn_mob_${rowId}`);
      }
    }

    if (!menu) return;
    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.inv-row-picker-menu.show').forEach(m => {
      if (m !== menu) m.classList.remove('show');
    });
    document.querySelectorAll('.inv-row-picker-btn.active').forEach(b => {
      if (b !== btn) b.classList.remove('active');
    });

    if (!isShown) {
      menu.classList.add('show');
      if (btn) btn.classList.add('active');
      const input = menu.querySelector('.inv-row-picker-search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    } else {
      menu.classList.remove('show');
      if (btn) btn.classList.remove('active');
    }
  }

  function filterCustomerPicker(rowId, query, prefix = '') {
    let listEl = null;
    if (prefix === 'mob') {
      listEl = document.getElementById(`custPickerList_mob_${rowId}`);
    } else if (prefix) {
      listEl = document.getElementById(`${prefix}List_${rowId}`);
    } else {
      if (window.innerWidth < 768) {
        listEl = document.getElementById(`custPickerList_mob_${rowId}`) || document.getElementById(`custPickerList_${rowId}`);
      } else {
        listEl = document.getElementById(`custPickerList_${rowId}`) || document.getElementById(`custPickerList_mob_${rowId}`);
      }
    }
    if (!listEl) return;
    const row = dispatchCustomerRows.find(r => r.id === rowId);
    const selectedSlNo = row ? row.slNo : '';
    listEl.innerHTML = renderCustomerPickerListHtml(rowId, selectedSlNo, query);
  }

  function selectDspCustomer(rowId, val) {
    const row = dispatchCustomerRows.find(r => r.id === rowId);
    if (!row) return;

    if (val === '__custom__') {
      row.slNo = '';
      row.name = (row.name && row.name !== '-- Select Customer --') ? row.name : 'Custom Site';
    } else {
      row.slNo = val;
      let matched = null;
      try {
        if (typeof DB !== 'undefined') {
          const raw = DB.getAll('installments') || [];
          matched = raw.find(c => String(c.SlNo) === String(val));
        }
      } catch (e) {}

      row.name = matched ? (matched.Name || 'Unknown') : (row.name || 'Unknown');

      // Auto-load existing expenses from customer record
      if (matched && matched.BrokerNumber && matched.BrokerNumber.includes('|expenses:')) {
        try {
          const exp = JSON.parse(matched.BrokerNumber.split('|expenses:')[1].split('|')[0]) || {};
          if (exp.setCost !== undefined || exp.material !== undefined) row.setCost = exp.setCost !== undefined ? exp.setCost : exp.material;
          if (exp.install !== undefined) row.installCost = exp.install;
          if (exp.other !== undefined) row.otherCost = exp.other;
          if (exp.otherComment) row.otherComment = exp.otherComment;
        } catch(e) {}
      }
    }

    renderDspCustomerRows();
    recalcDispatchTotals();
  }

  function renderDspCustomerRows() {
    const tbody = document.getElementById('dspCustomerAllocationBody');
    const mobContainer = document.getElementById('dspCustomerAllocationMobile');
    if (!tbody && !mobContainer) return;

    let customers = [];
    try {
      if (typeof DB !== 'undefined') {
        const raw = DB.getAll('installments') || [];
        customers = raw.filter(r => r && r.Status !== 'Deactive');
      }
    } catch (e) {}

    if (dispatchCustomerRows.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-2 text-muted" style="font-size:0.75rem;">
              No customers allocated. Click "+ Add Customer" above to allocate delivery & installation costs.
            </td>
          </tr>
        `;
      }
      if (mobContainer) {
        mobContainer.innerHTML = `
          <div class="text-center py-2 text-muted border rounded p-2" style="font-size:0.75rem;">
            No customers allocated. Click "+ Add Customer" above to allocate delivery & installation costs.
          </div>
        `;
      }
      return;
    }

    if (tbody) {
      tbody.innerHTML = dispatchCustomerRows.map(row => {
        const selectedSlNo = row.slNo ? String(row.slNo) : '';
        const setCost = Number(row.setCost) || 0;
        const insCost = Number(row.installCost) || 0;
        const delCost = Number(row.deliveryCost) || 0;
        const othCost = Number(row.otherCost) || 0;
        const totalCustCost = round2(setCost + insCost + delCost + othCost);

        const selectedCustomer = customers.find(c => String(c.SlNo) === selectedSlNo || (row.name && c.Name && c.Name.toLowerCase() === row.name.toLowerCase()));
        let currentDisplayName = '-- Select Customer --';
        if (selectedCustomer) {
          currentDisplayName = selectedCustomer.Name || 'Unknown';
        } else if (row.name) {
          currentDisplayName = row.name;
        }

        return `
          <tr data-cust-row-id="${row.id}">
            <td style="min-width: 170px; position: relative;">
              <div class="inv-row-item-picker" id="custPickerWrap_${row.id}">
                <button type="button" class="inv-row-picker-btn py-0.5 px-1.5" id="custPickerBtn_${row.id}" onclick="InventoryApp.toggleCustomerPicker('${row.id}')" style="font-size:0.76rem; height: 26px;">
                  <span class="text-truncate flex-grow-1 text-start" id="custPickerLabel_${row.id}">
                    <span class="fw-semibold text-dark">${escapeHtml(currentDisplayName)}</span>
                  </span>
                  <svg class="ms-1 text-muted flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="inv-row-picker-menu" id="custPickerMenu_${row.id}" style="min-width: 280px; max-width: 380px;">
                  <div class="inv-row-picker-search-wrap">
                    <input type="text" class="inv-row-picker-search-input" placeholder="Search customer name..." oninput="InventoryApp.filterCustomerPicker('${row.id}', this.value)" autocomplete="off">
                  </div>
                  <div class="inv-row-picker-list" id="custPickerList_${row.id}" style="max-height: 220px;">
                    ${renderCustomerPickerListHtml(row.id, row.slNo, '')}
                  </div>
                </div>
              </div>
            </td>
            <td style="width: 100px;">
              <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-set-cost py-0.5 px-1" data-cust-row-id="${row.id}" value="${row.setCost !== undefined && row.setCost !== '' ? row.setCost : ''}" placeholder="0.00" style="height: 26px; font-size:0.76rem;" title="Set Cost (₹)">
            </td>
            <td style="width: 100px;">
              <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-install-cost py-0.5 px-1" data-cust-row-id="${row.id}" value="${row.installCost !== undefined && row.installCost !== '' ? row.installCost : ''}" placeholder="0.00" style="height: 26px; font-size:0.76rem;" title="Install Cost (₹)">
            </td>
            <td style="width: 100px;">
              <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-delivery-cost py-0.5 px-1" data-cust-row-id="${row.id}" value="${row.deliveryCost !== undefined && row.deliveryCost !== '' ? row.deliveryCost : ''}" placeholder="Auto" style="height: 26px; font-size:0.76rem;">
            </td>
            <td style="width: 95px;">
              <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-other-cost py-0.5 px-1" data-cust-row-id="${row.id}" value="${row.otherCost !== undefined && row.otherCost !== '' ? row.otherCost : ''}" placeholder="0.00" style="height: 26px; font-size:0.76rem;">
            </td>
            <td>
              <input type="text" class="form-control form-control-sm dsp-cust-other-comment py-0.5 px-1.5" data-cust-row-id="${row.id}" value="${escapeHtml(row.otherComment || '')}" placeholder="Other cost remark / purpose..." style="height: 26px; font-size:0.74rem;">
            </td>
            <td class="text-end font-monospace fw-bold text-dark dsp-cust-row-total" data-cust-row-id="${row.id}" style="width: 105px; font-size:0.78rem;">
              ${fmtRupees(totalCustCost)}
            </td>
            <td class="text-center p-0" style="width: 32px;">
              <button type="button" class="btn btn-sm btn-link text-danger p-0 btn-remove-dsp-cust" data-cust-row-id="${row.id}" title="Remove Customer" style="font-size:0.9rem; text-decoration:none;">✕</button>
            </td>
          </tr>
        `;
      }).join('');
      attachDspCustomerRowHandlers(tbody);
    }

    if (mobContainer) {
      mobContainer.innerHTML = dispatchCustomerRows.map(row => {
        const selectedSlNo = row.slNo ? String(row.slNo) : '';
        const setCost = Number(row.setCost) || 0;
        const insCost = Number(row.installCost) || 0;
        const delCost = Number(row.deliveryCost) || 0;
        const othCost = Number(row.otherCost) || 0;
        const totalCustCost = round2(setCost + insCost + delCost + othCost);

        const selectedCustomer = customers.find(c => String(c.SlNo) === selectedSlNo || (row.name && c.Name && c.Name.toLowerCase() === row.name.toLowerCase()));
        let currentDisplayName = '-- Select Customer --';
        if (selectedCustomer) {
          currentDisplayName = selectedCustomer.Name || 'Unknown';
        } else if (row.name) {
          currentDisplayName = row.name;
        }

        return `
          <div class="inv-inw-card mb-2" data-cust-row-id="${row.id}">
            <div class="card-header d-flex align-items-center justify-content-between gap-2">
              <div class="flex-grow-1 min-w-0">
                <div class="inv-row-item-picker" id="custPickerWrap_mob_${row.id}">
                  <button type="button" class="btn btn-sm btn-light border w-100 text-start d-flex align-items-center justify-content-between px-2 py-1 shadow-none inv-row-picker-btn" id="custPickerBtn_mob_${row.id}" onclick="InventoryApp.toggleCustomerPicker('${row.id}', 'mob')" style="font-size:0.76rem; height:28px;">
                    <span class="text-truncate fw-semibold text-dark" id="custPickerLabel_mob_${row.id}">${escapeHtml(currentDisplayName)}</span>
                    <svg class="ms-1 text-muted flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <div class="inv-row-picker-menu" id="custPickerMenu_mob_${row.id}" style="min-width: 260px;">
                    <div class="inv-row-picker-search-wrap d-flex align-items-center gap-1.5 p-1.5">
                      <input type="text" class="inv-row-picker-search-input flex-grow-1" placeholder="Search customer name..." oninput="InventoryApp.filterCustomerPicker('${row.id}', this.value, 'mob')" autocomplete="off">
                      <button type="button" class="btn btn-sm btn-link text-muted p-0 ms-1" onclick="InventoryApp.toggleCustomerPicker('${row.id}', 'mob')" style="font-size:1.1rem; line-height:1; text-decoration:none;" title="Close">✕</button>
                    </div>
                    <div class="inv-row-picker-list" id="custPickerList_mob_${row.id}">
                      ${renderCustomerPickerListHtml(row.id, row.slNo, '')}
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-danger p-0 d-flex align-items-center justify-content-center flex-shrink-0 btn-remove-dsp-cust" data-cust-row-id="${row.id}" style="width:26px; height:26px; border-radius:4px;" title="Remove Customer">✕</button>
            </div>
            <div class="card-body">
              <div class="inv-inw-card-grid">
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Set Cost (₹)</label>
                  <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-set-cost" data-cust-row-id="${row.id}" value="${row.setCost !== undefined && row.setCost !== '' ? row.setCost : ''}" placeholder="0.00">
                </div>
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Install Cost (₹)</label>
                  <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-install-cost" data-cust-row-id="${row.id}" value="${row.installCost !== undefined && row.installCost !== '' ? row.installCost : ''}" placeholder="0.00">
                </div>
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Delivery Cost (₹)</label>
                  <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-delivery-cost" data-cust-row-id="${row.id}" value="${row.deliveryCost !== undefined && row.deliveryCost !== '' ? row.deliveryCost : ''}" placeholder="Auto">
                </div>
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Other Cost (₹)</label>
                  <input type="number" min="0" step="any" class="form-control form-control-sm text-end font-monospace dsp-cust-other-cost" data-cust-row-id="${row.id}" value="${row.otherCost !== undefined && row.otherCost !== '' ? row.otherCost : ''}" placeholder="0.00">
                </div>
                <div class="inv-inw-card-col" style="grid-column: span 2;">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Other Remark / Note</label>
                  <input type="text" class="form-control form-control-sm dsp-cust-other-comment" data-cust-row-id="${row.id}" value="${escapeHtml(row.otherComment || '')}" placeholder="Other cost remark...">
                </div>
                <div class="inv-inw-card-col" style="grid-column: span 2;">
                  <div class="d-flex justify-content-between align-items-center p-1.5">
                    <span class="text-secondary small fw-medium">Customer Total:</span>
                    <span class="fw-bold text-dark fs-7 dsp-cust-row-total" data-cust-row-id="${row.id}">${fmtRupees(totalCustCost)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      attachDspCustomerRowHandlers(mobContainer);
    }
  }

  function attachDspCustomerRowHandlers(container) {
    if (!container) return;

    container.querySelectorAll('.dsp-cust-custom-name').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) row.name = input.value.trim();
      });
    });

    container.querySelectorAll('.dsp-cust-set-cost').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) {
          row.setCost = input.value;
          document.querySelectorAll(`.dsp-cust-set-cost[data-cust-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
          updateDspCustRowTotal(rowId);
        }
      });
    });

    container.querySelectorAll('.dsp-cust-install-cost').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) {
          row.installCost = input.value;
          document.querySelectorAll(`.dsp-cust-install-cost[data-cust-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
          updateDspCustRowTotal(rowId);
        }
      });
    });

    container.querySelectorAll('.dsp-cust-delivery-cost').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) {
          row.deliveryCost = input.value;
          row.isManualDelivery = true;
          document.querySelectorAll(`.dsp-cust-delivery-cost[data-cust-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
          updateDspCustRowTotal(rowId);
        }
      });
    });

    container.querySelectorAll('.dsp-cust-other-cost').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) {
          row.otherCost = input.value;
          document.querySelectorAll(`.dsp-cust-other-cost[data-cust-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
          updateDspCustRowTotal(rowId);
        }
      });
    });

    container.querySelectorAll('.dsp-cust-other-comment').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-cust-row-id');
        const row = dispatchCustomerRows.find(r => r.id === rowId);
        if (row) {
          row.otherComment = input.value;
          document.querySelectorAll(`.dsp-cust-other-comment[data-cust-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
        }
      });
    });

    container.querySelectorAll('.btn-remove-dsp-cust').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-cust-row-id');
        removeDspCustomerRow(rowId);
      });
    });
  }

  function updateDspCustRowTotal(rowId) {
    const row = dispatchCustomerRows.find(r => r.id === rowId);
    if (!row) return;
    const set = Number(row.setCost) || 0;
    const ins = Number(row.installCost) || 0;
    const del = Number(row.deliveryCost) || 0;
    const oth = Number(row.otherCost) || 0;
    const total = fmtRupees(round2(set + ins + del + oth));
    document.querySelectorAll(`.dsp-cust-row-total[data-cust-row-id="${rowId}"]`).forEach(el => {
      el.textContent = total;
    });
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
    const mobContainer = document.getElementById('dspMobileCardsContainer');
    if (!tbody && !mobContainer) return;

    const ledger = getCalculatedStockLedger();
    const mapWithStock = document.getElementById('dspMapWithStock')?.checked ?? true;

    if (tbody) {
      tbody.innerHTML = dispatchRows.map((row) => {
        const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
        const origQty = (editingDispatchChallanNo && (!row.originalItemCode || row.originalItemCode === row.itemCode) && row.originalQty !== undefined) ? Number(row.originalQty) : 0;
        const inHand = (Number(item.inHandQty) || 0) + origQty;
        const qty = Number(row.qty) || 0;
        const histPrices = getItemHistoricalPrices(row.itemCode);

        if (row.unitPrice === undefined || row.unitPrice === null) {
          row.unitPrice = histPrices.length > 0 ? histPrices[0].price : (Number(item.buyingPrice) || 0);
        }
        const unitPrice = Number(row.unitPrice) || 0;
        const lineTotal = round2(qty * unitPrice);
        const isOverStock = mapWithStock && (qty > inHand);
        const isManual = Boolean(row.isManualPrice);

        return `
          <tr data-row-id="${row.id}" class="${isOverStock ? 'table-danger' : ''}">
            <td style="position: relative;">
              <div class="inv-row-item-picker" id="pickerWrap_${row.id}">
                <button type="button" class="inv-row-picker-btn ${isOverStock ? 'border-danger' : ''}" id="pickerBtn_${row.id}" onclick="InventoryApp.toggleItemPicker('${row.id}')">
                  <span class="text-truncate flex-grow-1 text-start" id="pickerLabel_${row.id}">
                    <span class="fw-semibold text-dark">${escapeHtml(item.name || 'Select Item')}</span>
                  </span>
                  <svg class="ms-1 text-muted flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="inv-row-picker-menu" id="pickerMenu_${row.id}">
                  <div class="inv-row-picker-search-wrap">
                    <input type="text" class="inv-row-picker-search-input" placeholder="Search item by name..." oninput="InventoryApp.filterPickerItems('${row.id}', 'dispatch', this.value)" autocomplete="off">
                  </div>
                  <div class="inv-row-picker-list" id="pickerList_${row.id}">
                    ${renderPickerListHtml(row.id, 'dispatch', row.itemCode, '')}
                  </div>
                </div>
              </div>
            </td>
            <td class="text-center font-monospace" style="width: 80px;">
              <span class="badge ${inHand > 0 ? 'bg-light text-success border' : 'bg-light text-danger border'}" style="font-size:0.75rem;">
                ${inHand}
              </span>
            </td>
            <td style="width: 110px;">
              <div class="input-group input-group-sm">
                <input type="number" min="1" ${mapWithStock ? `max="${inHand}"` : ''} step="any" class="form-control form-control-sm text-center font-monospace dsp-row-qty ${isOverStock ? 'is-invalid' : ''}" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="Qty" style="height: 28px; padding: 2px 4px;">
                <span class="input-group-text px-1.5 py-0 text-secondary font-monospace" style="font-size: 0.72rem; min-width: 32px; justify-content: center; height: 28px;">${escapeHtml(item.unit || 'Nos')}</span>
              </div>
            </td>
            <td style="width: 260px;" class="text-start">
              <div class="d-flex flex-column gap-1">
                <select class="form-select form-select-sm dsp-row-price-select font-monospace text-start py-1 px-2" data-row-id="${row.id}" style="font-size: 0.76rem; height: 28px;">
                  ${histPrices.map(hp => {
                    const isSel = (!isManual && Math.abs(hp.price - unitPrice) < 0.01);
                    const dtStr = hp.date && hp.date !== 'Catalog' ? formatShortDate(hp.date) : 'Catalog';
                    const label = `${fmtRupees(hp.price)} (${dtStr}${hp.qty ? `, Qty:${hp.qty}` : ''})`;
                    return `<option value="${hp.price}" ${isSel ? 'selected' : ''}>${label}</option>`;
                  }).join('')}
                  <option value="__manual__" ${isManual ? 'selected' : ''}>✏️ Custom / Manual Input...</option>
                </select>
                <input type="number" min="0" step="any" class="form-control form-control-sm font-monospace text-start dsp-row-custom-price py-1 px-2 ${isManual ? '' : 'd-none'}" data-row-id="${row.id}" value="${row.unitPrice !== undefined ? row.unitPrice : ''}" placeholder="Enter Rate (₹)" style="height: 26px; font-size: 0.76rem;">
              </div>
            </td>
            <td class="text-end font-monospace fw-bold text-dark dsp-row-total" data-row-id="${row.id}" style="width: 120px; font-size: 0.82rem;">
              ${fmtRupees(lineTotal)}
            </td>
            <td class="text-center p-0" style="width: 36px;">
              <button type="button" class="btn btn-sm btn-outline-danger p-0 d-inline-flex align-items-center justify-content-center btn-remove-dsp-row" data-row-id="${row.id}" style="width:26px; height:26px; border-radius: 4px;" title="Remove" ${dispatchRows.length <= 1 ? 'disabled style="width:26px; height:26px; opacity:0.25; cursor:not-allowed;"' : ''}>✕</button>
            </td>
          </tr>
        `;
      }).join('');
      attachDspRowHandlers(tbody, ledger);
    }

    if (mobContainer) {
      mobContainer.innerHTML = dispatchRows.map((row) => {
        const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
        const origQty = (editingDispatchChallanNo && (!row.originalItemCode || row.originalItemCode === row.itemCode) && row.originalQty !== undefined) ? Number(row.originalQty) : 0;
        const inHand = (Number(item.inHandQty) || 0) + origQty;
        const qty = Number(row.qty) || 0;
        const histPrices = getItemHistoricalPrices(row.itemCode);

        if (row.unitPrice === undefined || row.unitPrice === null) {
          row.unitPrice = histPrices.length > 0 ? histPrices[0].price : (Number(item.buyingPrice) || 0);
        }
        const unitPrice = Number(row.unitPrice) || 0;
        const lineTotal = round2(qty * unitPrice);
        const isOverStock = mapWithStock && (qty > inHand);
        const isManual = Boolean(row.isManualPrice);

        return `
          <div class="inv-inw-card mb-2" data-row-id="${row.id}">
            <!-- Header: Item Picker + Delete -->
            <div class="card-header d-flex align-items-center justify-content-between gap-2">
              <div class="flex-grow-1 min-w-0">
                <div class="inv-row-item-picker" id="dsp_mob_pickerWrap_${row.id}">
                  <button type="button" class="btn btn-sm btn-light border w-100 text-start d-flex align-items-center justify-content-between px-2 py-1 shadow-none ${isOverStock ? 'border-danger' : ''}" id="dsp_mob_pickerBtn_${row.id}" onclick="InventoryApp.toggleItemPicker('${row.id}', 'dsp_mob_picker')">
                    <span class="text-truncate fw-semibold text-dark fs-7" id="dsp_mob_pickerLabel_${row.id}">${escapeHtml(item.name || 'Select Item')}</span>
                    <svg class="ms-1 text-muted flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <div class="inv-row-picker-menu" id="dsp_mob_pickerMenu_${row.id}">
                    <div class="inv-row-picker-search-wrap">
                      <input type="text" class="inv-row-picker-search-input" placeholder="Search item by name..." oninput="InventoryApp.filterPickerItems('${row.id}', 'dispatch_mob', this.value, 'dsp_mob_picker')" autocomplete="off">
                    </div>
                    <div class="inv-row-picker-list" id="dsp_mob_pickerList_${row.id}">
                      ${renderPickerListHtml(row.id, 'dispatch_mob', row.itemCode, '')}
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-danger p-0 d-flex align-items-center justify-content-center flex-shrink-0 btn-remove-dsp-row" data-row-id="${row.id}" style="width: 26px; height: 26px; border-radius: 4px;" title="Remove Item" ${dispatchRows.length <= 1 ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>✕</button>
            </div>

            <!-- Card Body -->
            <div class="card-body">
              <div class="inv-inw-card-grid">
                <!-- Col 1: In Stock -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">In Stock</label>
                  <div class="inv-inw-card-kpi d-flex align-items-center justify-content-center border rounded" style="height:30px;">
                    <span class="fw-bold fs-7 ${inHand > 0 ? 'text-success' : 'text-danger'}">${inHand} ${escapeHtml(item.unit || 'Nos')}</span>
                  </div>
                </div>

                <!-- Col 2: Quantity -->
                <div class="inv-inw-card-col">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Quantity</label>
                  <div class="input-group input-group-sm" style="height:30px;">
                    <input type="number" min="1" ${mapWithStock ? `max="${inHand}"` : ''} step="any" class="form-control text-end fw-bold dsp-row-qty ${isOverStock ? 'is-invalid' : ''}" data-row-id="${row.id}" value="${row.qty !== undefined && row.qty !== null ? row.qty : ''}" placeholder="0" style="height:30px;">
                    <span class="input-group-text px-2 text-muted fs-8 bg-light flex-shrink-0" style="height:30px;">${escapeHtml(item.unit || 'Nos')}</span>
                  </div>
                </div>

                <!-- Col 3: Cost / Unit (₹) - Left Aligned -->
                <div class="inv-inw-card-col" style="grid-column: span 2;">
                  <label class="form-label text-secondary fs-8 fw-semibold mb-1">Cost / Unit (₹)</label>
                  <select class="form-select form-select-sm dsp-row-price-select font-monospace text-start py-1 px-2" data-row-id="${row.id}" style="font-size: 0.78rem; height: 30px;">
                    ${histPrices.map(hp => {
                      const isSel = (!isManual && Math.abs(hp.price - unitPrice) < 0.01);
                      const dtStr = hp.date && hp.date !== 'Catalog' ? formatShortDate(hp.date) : 'Catalog';
                      const label = `${fmtRupees(hp.price)} (${dtStr}${hp.qty ? `, Qty:${hp.qty}` : ''})`;
                      return `<option value="${hp.price}" ${isSel ? 'selected' : ''}>${label}</option>`;
                    }).join('')}
                    <option value="__manual__" ${isManual ? 'selected' : ''}>✏️ Custom / Manual Input...</option>
                  </select>
                  <input type="number" min="0" step="any" class="form-control form-control-sm font-monospace text-start dsp-row-custom-price mt-1 py-1 px-2 ${isManual ? '' : 'd-none'}" data-row-id="${row.id}" value="${row.unitPrice !== undefined ? row.unitPrice : ''}" placeholder="Enter Rate (₹)" style="height: 28px; font-size: 0.78rem;">
                </div>

                <!-- Col 4: Total Cost -->
                <div class="inv-inw-card-col" style="grid-column: span 2;">
                  <div class="d-flex justify-content-between align-items-center p-2 rounded bg-light border">
                    <span class="text-secondary small fw-medium">Line Total:</span>
                    <span class="fw-bold text-dark fs-7 dsp-row-total" data-row-id="${row.id}">${fmtRupees(lineTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      attachDspRowHandlers(mobContainer, ledger);
    }
  }

  function attachDspRowHandlers(container, ledger) {
    if (!container) return;

    // 1. Quantity inputs
    container.querySelectorAll('.dsp-row-qty').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = dispatchRows.find(r => r.id === rowId);
        if (row) {
          row.qty = input.value === '' ? '' : Number(input.value);
          const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
          const origQty = (editingDispatchChallanNo && (!row.originalItemCode || row.originalItemCode === row.itemCode) && row.originalQty !== undefined) ? Number(row.originalQty) : 0;
          const inHand = (Number(item.inHandQty) || 0) + origQty;
          const mapWithStock = document.getElementById('dspMapWithStock')?.checked ?? true;
          const isOverStock = mapWithStock && ((Number(row.qty) || 0) > inHand);

          document.querySelectorAll(`.dsp-row-qty[data-row-id="${rowId}"]`).forEach(qInp => {
            if (qInp !== input) qInp.value = input.value;
            qInp.classList.toggle('is-invalid', isOverStock);
          });
          document.querySelectorAll(`tr[data-row-id="${rowId}"]`).forEach(tr => {
            tr.classList.toggle('table-danger', isOverStock);
          });

          const total = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
          document.querySelectorAll(`.dsp-row-total[data-row-id="${rowId}"]`).forEach(totEl => {
            totEl.textContent = fmtRupees(total);
          });
          recalcDispatchTotals();
        }
      });
    });

    // 2. Historical Price Dropdown
    container.querySelectorAll('.dsp-row-price-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const rowId = sel.getAttribute('data-row-id');
        const row = dispatchRows.find(r => r.id === rowId);
        if (!row) return;

        document.querySelectorAll(`.dsp-row-price-select[data-row-id="${rowId}"]`).forEach(s => {
          if (s !== sel) s.value = sel.value;
        });

        if (sel.value === '__manual__') {
          row.isManualPrice = true;
          document.querySelectorAll(`.dsp-row-custom-price[data-row-id="${rowId}"]`).forEach(inp => {
            inp.classList.remove('d-none');
            inp.focus();
          });
        } else {
          row.isManualPrice = false;
          row.unitPrice = Number(sel.value);
          document.querySelectorAll(`.dsp-row-custom-price[data-row-id="${rowId}"]`).forEach(inp => {
            inp.classList.add('d-none');
          });
          const total = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
          document.querySelectorAll(`.dsp-row-total[data-row-id="${rowId}"]`).forEach(totEl => {
            totEl.textContent = fmtRupees(total);
          });
          recalcDispatchTotals();
        }
      });
    });

    // 3. Custom / Manual Price input
    container.querySelectorAll('.dsp-row-custom-price').forEach(input => {
      input.addEventListener('input', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = dispatchRows.find(r => r.id === rowId);
        if (row) {
          row.unitPrice = input.value === '' ? '' : Number(input.value);
          document.querySelectorAll(`.dsp-row-custom-price[data-row-id="${rowId}"]`).forEach(inp => {
            if (inp !== input) inp.value = input.value;
          });
          const total = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
          document.querySelectorAll(`.dsp-row-total[data-row-id="${rowId}"]`).forEach(totEl => {
            totEl.textContent = fmtRupees(total);
          });
          recalcDispatchTotals();
        }
      });
    });

    // 4. Remove row button
    container.querySelectorAll('.btn-remove-dsp-row').forEach(btn => {
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
    const mapWithStock = document.getElementById('dspMapWithStock')?.checked ?? true;

    dispatchRows.forEach(row => {
      const item = ledger.find(i => i.code === row.itemCode) || ledger[0] || {};
      const origQty = (editingDispatchChallanNo && (!row.originalItemCode || row.originalItemCode === row.itemCode) && row.originalQty !== undefined) ? Number(row.originalQty) : 0;
      const inHand = (Number(item.inHandQty) || 0) + origQty;
      const qty = Number(row.qty) || 0;
      if (qty <= 0) hasEmptyOrZeroQty = true;
      if (mapWithStock && qty > inHand) hasOverStock = true;

      const unitPrice = Number(row.unitPrice !== undefined ? row.unitPrice : item.buyingPrice) || 0;
      totalUnits += qty;
      totalMaterialCost += (qty * unitPrice);
    });

    const isOurProject = document.getElementById('dspIsOurProject')?.checked ?? true;
    let totalDeliveryCost = 0;

    if (isOurProject) {
      const transportCost = Number(document.getElementById('dspTransportCost')?.value) || 0;
      const distanceKm = Number(document.getElementById('dspDistanceKm')?.value) || 0;
      const extraDeliveryCost = Number(document.getElementById('dspExtraDeliveryCost')?.value) || 0;

      totalDeliveryCost = round2(transportCost + extraDeliveryCost);

      const costPerKmEl = document.getElementById('dspCostPerKm');
      if (costPerKmEl) {
        costPerKmEl.value = distanceKm > 0 ? ('₹' + (transportCost / distanceKm).toFixed(2) + ' / km') : '—';
      }

      const badgeDel = document.getElementById('dspBadgeTotalDelivery');
      if (badgeDel) badgeDel.textContent = `Total Delivery Cost: ${fmtRupees(totalDeliveryCost)}`;

      // Auto-divide delivery cost across customer rows if not manually overridden
      if (dispatchCustomerRows.length > 0) {
        const perCustDel = round2(totalDeliveryCost / dispatchCustomerRows.length);
        dispatchCustomerRows.forEach(crow => {
          if (!crow.isManualDelivery) {
            crow.deliveryCost = perCustDel > 0 ? perCustDel : '';
            const input = document.querySelector(`.dsp-cust-delivery-cost[data-cust-row-id="${crow.id}"]`);
            if (input && document.activeElement !== input) {
              input.value = perCustDel > 0 ? perCustDel : '';
            }
          }
          updateDspCustRowTotal(crow.id);
        });
      }
    }

    const unitsEl = document.getElementById('dspSummaryTotalUnits');
    const transportEl = document.getElementById('dspDisplayTransportCost');
    const totalCostEl = document.getElementById('dspCalculatedCost');
    const alertBox = document.getElementById('dspStockAlert');
    const submitBtn = document.getElementById('btnSubmitDispatch');

    if (unitsEl) unitsEl.textContent = `Total Units: ${fmtQty(totalUnits)}`;
    if (transportEl) transportEl.textContent = `Delivery: ${fmtRupees(totalDeliveryCost)}`;
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

  let editingDispatchChallanNo = null;
  let editingDispatchIds = [];

  function openDispatchModal(preselectedCode = null) {
    editingDispatchChallanNo = null;
    editingDispatchIds = [];

    const modalEl = document.getElementById('modalSiteDispatch');
    if (!modalEl) return;

    const titleEl = document.getElementById('modalSiteDispatchTitle');
    if (titleEl) {
      titleEl.textContent = 'Dispatch Equipment to Site';
    }
    const btnSubmit = document.getElementById('btnSubmitDispatch');
    if (btnSubmit) {
      btnSubmit.textContent = 'Confirm Dispatch';
    }

    const siteInput = document.getElementById('dspSiteName');
    const dateInput = document.getElementById('dspDate');
    const vehicleInput = document.getElementById('dspVehicle');
    const remarksInput = document.getElementById('dspRemarks');
    const isOurProjectChk = document.getElementById('dspIsOurProject');
    const logisticsSection = document.getElementById('dspLogisticsSection');

    if (siteInput) siteInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (vehicleInput) vehicleInput.value = '';
    if (remarksInput) remarksInput.value = '';
    if (isOurProjectChk) isOurProjectChk.checked = true;
    if (logisticsSection) logisticsSection.style.display = 'block';

    const mapWithStockChk = document.getElementById('dspMapWithStock');
    if (mapWithStockChk) mapWithStockChk.checked = true;

    const transInput = document.getElementById('dspTransportCost');
    const distInput = document.getElementById('dspDistanceKm');
    const costPerKmEl = document.getElementById('dspCostPerKm');
    const extraDeliveryCostInput = document.getElementById('dspExtraDeliveryCost');
    const extraDeliveryCommentInput = document.getElementById('dspExtraDeliveryComment');

    if (transInput) transInput.value = '';
    if (distInput) distInput.value = '';
    if (costPerKmEl) costPerKmEl.value = '—';
    if (extraDeliveryCostInput) extraDeliveryCostInput.value = '';
    if (extraDeliveryCommentInput) extraDeliveryCommentInput.value = '';

    // Initialize 1 default customer row
    dispatchCustomerRows = [];
    addDspCustomerRow();

    // Reset multiple files upload state
    dispatchDocFiles = [];
    dispatchDocFile = null;
    const dspFileInput = document.getElementById('dspDocFileInput');
    if (dspFileInput) dspFileInput.value = '';
    renderDspFiles();

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
      dispatchRows = codes.map((c, idx) => {
        const targetItem = ledger.find(i => i.code === c);
        return {
          id: 'dsp_' + Date.now() + '_' + idx,
          itemCode: c,
          qty: targetItem && targetItem.inHandQty > 0 ? 1 : ''
        };
      });
    } else {
      const availableLedger = ledger.filter(i => i.inHandQty > 0);
      let targetItem = availableLedger.length > 0 ? availableLedger[0] : ledger[0];
      dispatchRows = [
        {
          id: 'dsp_' + Date.now(),
          itemCode: targetItem ? targetItem.code : '',
          qty: targetItem && targetItem.inHandQty > 0 ? 1 : ''
        }
      ];
    }

    renderDspRows();
    recalcDispatchTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  let isSubmittingDispatch = false;

  async function handleSaveDispatch() {
    if (isSubmittingDispatch) return;

    const siteName = document.getElementById('dspSiteName')?.value.trim() || '';
    const date = document.getElementById('dspDate')?.value || new Date().toISOString().slice(0, 10);
    const vehicle = document.getElementById('dspVehicle')?.value.trim() || 'Site Vehicle';
    const remarks = document.getElementById('dspRemarks')?.value.trim() || 'Project Site Handover';
    const isOurProject = document.getElementById('dspIsOurProject')?.checked ?? true;

    const transportCost = isOurProject ? (Number(document.getElementById('dspTransportCost')?.value) || 0) : 0;
    const distanceKm = isOurProject ? (Number(document.getElementById('dspDistanceKm')?.value) || 0) : 0;
    const costPerKm = distanceKm > 0 ? round2(transportCost / distanceKm) : 0;
    const extraDeliveryCost = isOurProject ? (Number(document.getElementById('dspExtraDeliveryCost')?.value) || 0) : 0;
    const extraDeliveryComment = isOurProject ? (document.getElementById('dspExtraDeliveryComment')?.value.trim() || '') : '';

    const totalDeliveryCost = round2(transportCost + extraDeliveryCost);

    const customerAllocations = isOurProject ? dispatchCustomerRows.map(crow => ({
      slNo: crow.slNo || '',
      name: crow.name || '',
      setCost: Number(crow.setCost) || 0,
      installCost: Number(crow.installCost) || 0,
      deliveryCost: Number(crow.deliveryCost) || 0,
      otherCost: Number(crow.otherCost) || 0,
      otherComment: crow.otherComment || '',
      totalCost: round2((Number(crow.setCost) || 0) + (Number(crow.installCost) || 0) + (Number(crow.deliveryCost) || 0) + (Number(crow.otherCost) || 0))
    })).filter(c => c.name || c.slNo || c.totalCost > 0) : [];

    // Strictly validate Site Name - Never populate customer names into site name
    const effectiveSiteName = siteName;
    if (!effectiveSiteName) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Site / Project Name', 'warning');
      document.getElementById('dspSiteName')?.focus();
      return;
    }

    if (!dispatchRows || dispatchRows.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Please add at least one item to dispatch', 'warning');
      return;
    }

    const isEditing = Boolean(editingDispatchChallanNo || (editingDispatchIds && editingDispatchIds.length > 0));
    const challanNoToUse = editingDispatchChallanNo || `DC-${Date.now().toString().slice(-4)}`;

    const ledger = getCalculatedStockLedger();
    let oldRecords = [];
    if (isEditing) {
      oldRecords = dispatches.filter(d => 
        (editingDispatchIds && editingDispatchIds.includes(d.id)) ||
        (editingDispatchChallanNo && (d.challanNo === editingDispatchChallanNo || d.id === editingDispatchChallanNo))
      );
    }

    const mapWithStock = document.getElementById('dspMapWithStock')?.checked ?? true;

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

      if (mapWithStock) {
        let maxAvailable = Number(item.inHandQty) || 0;
        if (isEditing) {
          const origQty = (!r.originalItemCode || r.originalItemCode === r.itemCode) ? (Number(r.originalQty) || 0) : 0;
          if (origQty > 0) {
            maxAvailable += origQty;
          } else if (r.originalDispatchId) {
            const oldRec = oldRecords.find(o => o.id === r.originalDispatchId && o.itemCode === r.itemCode);
            if (oldRec) maxAvailable += Number(oldRec.qty) || 0;
          }
        }
        if (qty > maxAvailable) {
          if (typeof UI !== 'undefined') UI.toast(`Row #${i + 1}: Quantity exceeds available stock (${maxAvailable})`, 'danger');
          return;
        }
      }
    }

    isSubmittingDispatch = true;
    const btnSubmit = document.getElementById('btnSubmitDispatch');
    const originalBtnText = btnSubmit ? btnSubmit.textContent : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Saving...';
    }

    try {
      // If editing, remove old records from memory and DB
      if (isEditing) {
        const oldIdSet = new Set(oldRecords.map(o => o.id));
        dispatches = dispatches.filter(d => !oldIdSet.has(d.id));
        if (typeof DB !== 'undefined') {
          for (const old of oldRecords) {
            try {
              await DB.remove('inventory_dispatches', row => (row.DispatchID || row.id) === old.id);
            } catch (e) {}
          }
        }
      }

      let totalDispatchedCost = 0;
      let totalDispatchedUnits = 0;

      // Structured logistics metadata
      const logisticsMeta = {
        isOurProject,
        mapWithStock,
        distanceKm,
        costPerKm,
        transportCost,
        extraDeliveryCost,
        extraDeliveryComment,
        totalDeliveryCost,
        customerAllocations
      };
      const stockTag = mapWithStock ? '' : ' |mapWithStock:false';
      const cleanRemarks = remarks ? remarks.replace(/\s*\|mapWithStock:(true|false)/g, '').replace(/\s*\|logistics:[\s\S]*/g, '').trim() : '';
      const logisticsRemarks = cleanRemarks ? `${cleanRemarks}${stockTag} |logistics:${JSON.stringify(logisticsMeta)}` : `${stockTag} |logistics:${JSON.stringify(logisticsMeta)}`;

      for (let idx = 0; idx < dispatchRows.length; idx++) {
        const r = dispatchRows[idx];
        const item = ledger.find(it => it.code === r.itemCode);
        const qty = Number(r.qty);
        const unitPrice = Number(r.unitPrice !== undefined ? r.unitPrice : item.buyingPrice) || 0;
        const dispatchedCost = round2(qty * unitPrice);
        totalDispatchedCost += dispatchedCost;
        totalDispatchedUnits += qty;

        const newDispatch = {
          id: (isEditing && r.originalDispatchId) ? r.originalDispatchId : `DSP-${Date.now()}-${idx + 1}`,
          date,
          challanNo: challanNoToUse,
          siteName: effectiveSiteName,
          itemCode: r.itemCode,
          qty,
          unitBuyingPrice: unitPrice,
          dispatchedCost,
          transportCost: idx === 0 ? totalDeliveryCost : 0,
          vehicle,
          remarks: logisticsRemarks,
          isOurProject,
          mapWithStock,
          distanceKm,
          costPerKm,
          totalDeliveryCost,
          customerAllocations,
          docName: dispatchDocFiles.map(f => f.name).join(', ') || (dispatchDocFile ? dispatchDocFile.name : null),
          docData: dispatchDocFiles.length > 0 ? (dispatchDocFiles[0].data || dispatchDocFiles[0].url) : (dispatchDocFile ? dispatchDocFile.data : null),
          documents: dispatchDocFiles.map(f => ({ name: f.name, size: f.size, url: f.url, data: f.data }))
        };

        dispatches.unshift(newDispatch);

        if (typeof DB !== 'undefined') {
          try {
            await DB.insert('inventory_dispatches', {
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
            });
          } catch (e) {}
        }
      }

      // Sync customer allocations directly to Postgres installments table
      if (typeof DB !== 'undefined' && customerAllocations.length > 0) {
        for (const crow of customerAllocations) {
          if (!crow.slNo) continue;
          try {
            const allInst = DB.getAll('installments') || [];
            const cust = allInst.find(c => String(c.SlNo) === String(crow.slNo));
            if (!cust) continue;

            let basePhone = '';
            let expenses = {};
            let creatorId = '';
            let workObj = {};

            if (cust.BrokerNumber) {
              const parts = cust.BrokerNumber.split('|');
              basePhone = parts[0] || '';
              parts.slice(1).forEach(p => {
                if (p.startsWith('expenses:')) {
                  try { expenses = JSON.parse(p.slice('expenses:'.length)) || {}; } catch (e) {}
                } else if (p.startsWith('creator:')) {
                  creatorId = p.slice('creator:'.length);
                } else if (p.startsWith('work:')) {
                  try { workObj = JSON.parse(p.slice('work:'.length)) || {}; } catch (e) {}
                }
              });
            }

            if (crow.setCost !== undefined && crow.setCost !== '') {
              expenses.setCost = Number(crow.setCost) || 0;
              expenses.material = Number(crow.setCost) || 0;
            }
            if (crow.installCost !== undefined && crow.installCost !== '') expenses.install = Number(crow.installCost) || 0;
            if (crow.deliveryCost !== undefined && crow.deliveryCost !== '') {
              expenses.delivery = Number(crow.deliveryCost) || 0;
              expenses.transport = Number(crow.deliveryCost) || 0;
            }
            if (crow.otherCost !== undefined && crow.otherCost !== '') expenses.other = Number(crow.otherCost) || 0;
            if (crow.otherComment) expenses.otherComment = crow.otherComment;

            const calcVendor = (expenses.setCost || expenses.material || 0) + (expenses.install || 0) + (expenses.delivery || expenses.transport || 0) + (expenses.gst || 0) + (expenses.other || 0);

            let newBroker = basePhone;
            newBroker += '|expenses:' + JSON.stringify(expenses);
            if (creatorId) newBroker += '|creator:' + creatorId;
            if (workObj && Object.keys(workObj).length > 0) newBroker += '|work:' + JSON.stringify(workObj);

            cust.BrokerNumber = newBroker;
            cust.VendorPrice = calcVendor;

            await DB.update('installments', r => Number(r.SlNo) === Number(crow.slNo), {
              BrokerNumber: newBroker,
              VendorPrice: calcVendor
            });
          } catch (e) {
            console.warn('[Dispatch] Error syncing customer allocation to installments:', e);
          }
        }
      }

      saveData();
      clearSelection('ledger');

      editingDispatchChallanNo = null;
      editingDispatchIds = [];

      const modalEl = document.getElementById('modalSiteDispatch');
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();

      const titleEl = document.getElementById('modalSiteDispatchTitle');
      if (titleEl) titleEl.textContent = 'Dispatch Equipment to Site';
      if (btnSubmit) btnSubmit.textContent = 'Confirm Dispatch';

      updateAllTabCounters();
      renderKpiCards();
      renderCategoryChips();
      renderLedgerTable();
      renderInwardsTable();
      renderDispatchesTable();
      switchTab('dispatches');

      if (typeof UI !== 'undefined') {
        UI.toast(isEditing
          ? `Successfully updated dispatch to "${effectiveSiteName}". Material Cost: ${fmtRupees(totalDispatchedCost)}. Delivery: ${fmtRupees(totalDeliveryCost)}.`
          : `Successfully dispatched ${dispatchRows.length} items (${fmtQty(totalDispatchedUnits)} units) to "${effectiveSiteName}". Material Cost: ${fmtRupees(totalDispatchedCost)}. Delivery: ${fmtRupees(totalDeliveryCost)}.`,
          'success');
      }
    } finally {
      isSubmittingDispatch = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalBtnText || 'Confirm Dispatch';
      }
    }
  }

  // --- Upload helper to project's uploads/bills folder via /api/bills/upload ---
  async function uploadFileToBillsFolder(file, prefix = '', customName = '') {
    const originalName = customName || file.name;
    const cleanPrefix = prefix ? prefix.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const fileName = cleanPrefix ? `${cleanPrefix}_${originalName}` : originalName;
    const today = new Date().toISOString().slice(0, 10);
    const uploadUrl = `/api/bills/upload?fileName=${encodeURIComponent(fileName)}&originalName=${encodeURIComponent(originalName)}&fileDate=${encodeURIComponent(today)}`;

    try {
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        body: file
      });
      if (resp.ok) {
        const resData = await resp.json();
        const f = resData.file || resData.bill;
        if (f) {
          const fileUrl = f.url || `/files/${f.storedFileName}` || `/bills/${f.storedFileName}`;
          return {
            name: f.fileName || originalName,
            size: f.fileSize || fmtFileSize(file.size),
            type: file.type,
            url: fileUrl,
            data: fileUrl,
            storedFileName: f.storedFileName
          };
        }
      }
    } catch (err) {
      console.warn('Upload to /api/bills/upload failed, falling back to local data URL:', err);
    }

    // Fallback: Read as base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        resolve({
          name: file.name,
          size: fmtFileSize(file.size),
          type: file.type,
          url: loadEvt.target.result,
          data: loadEvt.target.result
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Document File Uploads Setup ---
  function renderInwFiles() {
    const container = document.getElementById('inwFilesContainer');
    if (!container) return;
    if (!inwardDocFiles || inwardDocFiles.length === 0) {
      container.innerHTML = '<span class="text-muted small fst-italic" style="font-size:0.75rem;">No files attached</span>';
      return;
    }

    container.innerHTML = inwardDocFiles.map(f => {
      const fullName = f.name || 'document';
      const dotIdx = fullName.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? fullName.slice(0, dotIdx) : fullName;
      const ext = dotIdx !== -1 ? fullName.slice(dotIdx) : '';

      if (f.isEditing) {
        return `
          <div class="inv-file-pill editing" data-file-id="${f.id}">
            <input type="text" class="inv-file-rename-input font-monospace" value="${escapeHtml(baseName)}" data-file-id="${f.id}" data-ext="${escapeHtml(ext)}" style="width: 140px;">
            <span class="text-muted small">${escapeHtml(ext)}</span>
            <button type="button" class="btn btn-xs btn-success p-0 d-inline-flex align-items-center justify-content-center btn-save-inw-rename" data-file-id="${f.id}" style="width:20px; height:20px;" title="Save (upload to bills)">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button type="button" class="btn btn-xs btn-outline-secondary p-0 d-inline-flex align-items-center justify-content-center btn-cancel-inw-rename" data-file-id="${f.id}" style="width:20px; height:20px;" title="Cancel">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }

      return `
        <div class="inv-file-pill" data-file-id="${f.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" class="text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="fw-medium text-dark text-truncate" style="max-width: 160px;" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</span>
          <span class="text-muted small">${f.size ? `(${f.size})` : ''}</span>
          <button type="button" class="inv-file-btn text-primary btn-start-inw-rename" data-file-id="${f.id}" title="Rename file">✏️</button>
          <button type="button" class="inv-file-btn text-danger btn-remove-inw-file" data-file-id="${f.id}" title="Remove file" style="font-weight:bold; font-size:12px;">✕</button>
        </div>
      `;
    }).join('');

    // Bind event listeners for inward files
    container.querySelectorAll('.btn-start-inw-rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = inwardDocFiles.find(item => item.id === fId);
        if (f) {
          f.isEditing = true;
          renderInwFiles();
          const input = container.querySelector(`.inv-file-rename-input[data-file-id="${fId}"]`);
          if (input) { input.focus(); input.select(); }
        }
      });
    });

    container.querySelectorAll('.btn-cancel-inw-rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = inwardDocFiles.find(item => item.id === fId);
        if (f) {
          f.isEditing = false;
          renderInwFiles();
        }
      });
    });

    container.querySelectorAll('.btn-save-inw-rename').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = inwardDocFiles.find(item => item.id === fId);
        const input = container.querySelector(`.inv-file-rename-input[data-file-id="${fId}"]`);
        if (!f || !input) return;

        const newBase = input.value.trim();
        const ext = input.getAttribute('data-ext') || '';
        if (!newBase) {
          if (typeof UI !== 'undefined') UI.toast('Please enter a valid file name', 'warning');
          return;
        }

        const finalName = newBase.endsWith(ext) ? newBase : (newBase + ext);
        btn.disabled = true;

        if (f.fileObj) {
          try {
            const reUploaded = await uploadFileToBillsFolder(f.fileObj, 'INW', finalName);
            f.name = reUploaded.name || finalName;
            f.url = reUploaded.url;
            f.data = reUploaded.data;
            f.storedFileName = reUploaded.storedFileName;
          } catch (err) {
            f.name = finalName;
          }
        } else {
          f.name = finalName;
        }

        f.isEditing = false;
        renderInwFiles();
        if (typeof UI !== 'undefined') UI.toast(`File renamed & saved as "${finalName}"`, 'success');
      });
    });

    container.querySelectorAll('.btn-remove-inw-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        inwardDocFiles = inwardDocFiles.filter(item => item.id !== fId);
        inwardDocFile = inwardDocFiles[0] || null;
        const inwFileInput = document.getElementById('inwDocFileInput');
        if (inwFileInput) inwFileInput.value = '';
        renderInwFiles();
        if (typeof UI !== 'undefined') UI.toast('File removed', 'info');
      });
    });
  }

  function renderDspFiles() {
    const container = document.getElementById('dspFilesContainer');
    if (!container) return;
    if (!dispatchDocFiles || dispatchDocFiles.length === 0) {
      container.innerHTML = '<span class="text-muted small fst-italic" style="font-size:0.75rem;">No files attached</span>';
      return;
    }

    container.innerHTML = dispatchDocFiles.map(f => {
      const fullName = f.name || 'challan';
      const dotIdx = fullName.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? fullName.slice(0, dotIdx) : fullName;
      const ext = dotIdx !== -1 ? fullName.slice(dotIdx) : '';

      if (f.isEditing) {
        return `
          <div class="inv-file-pill editing" data-file-id="${f.id}">
            <input type="text" class="inv-file-rename-input font-monospace" value="${escapeHtml(baseName)}" data-file-id="${f.id}" data-ext="${escapeHtml(ext)}" style="width: 140px;">
            <span class="text-muted small">${escapeHtml(ext)}</span>
            <button type="button" class="btn btn-xs btn-success p-0 d-inline-flex align-items-center justify-content-center btn-save-dsp-rename" data-file-id="${f.id}" style="width:20px; height:20px;" title="Save (upload to bills)">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button type="button" class="btn btn-xs btn-outline-secondary p-0 d-inline-flex align-items-center justify-content-center btn-cancel-dsp-rename" data-file-id="${f.id}" style="width:20px; height:20px;" title="Cancel">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }

      return `
        <div class="inv-file-pill" data-file-id="${f.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" class="text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="fw-medium text-dark text-truncate" style="max-width: 160px;" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</span>
          <span class="text-muted small">${f.size ? `(${f.size})` : ''}</span>
          <button type="button" class="inv-file-btn text-primary btn-start-dsp-rename" data-file-id="${f.id}" title="Rename file">✏️</button>
          <button type="button" class="inv-file-btn text-danger btn-remove-dsp-file" data-file-id="${f.id}" title="Remove file" style="font-weight:bold; font-size:12px;">✕</button>
        </div>
      `;
    }).join('');

    // Bind event listeners for dispatch files
    container.querySelectorAll('.btn-start-dsp-rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = dispatchDocFiles.find(item => item.id === fId);
        if (f) {
          f.isEditing = true;
          renderDspFiles();
          const input = container.querySelector(`.inv-file-rename-input[data-file-id="${fId}"]`);
          if (input) { input.focus(); input.select(); }
        }
      });
    });

    container.querySelectorAll('.btn-cancel-dsp-rename').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = dispatchDocFiles.find(item => item.id === fId);
        if (f) {
          f.isEditing = false;
          renderDspFiles();
        }
      });
    });

    container.querySelectorAll('.btn-save-dsp-rename').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        const f = dispatchDocFiles.find(item => item.id === fId);
        const input = container.querySelector(`.inv-file-rename-input[data-file-id="${fId}"]`);
        if (!f || !input) return;

        const newBase = input.value.trim();
        const ext = input.getAttribute('data-ext') || '';
        if (!newBase) {
          if (typeof UI !== 'undefined') UI.toast('Please enter a valid file name', 'warning');
          return;
        }

        const finalName = newBase.endsWith(ext) ? newBase : (newBase + ext);
        btn.disabled = true;

        if (f.fileObj) {
          try {
            const reUploaded = await uploadFileToBillsFolder(f.fileObj, 'DSP', finalName);
            f.name = reUploaded.name || finalName;
            f.url = reUploaded.url;
            f.data = reUploaded.data;
            f.storedFileName = reUploaded.storedFileName;
          } catch (err) {
            f.name = finalName;
          }
        } else {
          f.name = finalName;
        }

        f.isEditing = false;
        renderDspFiles();
        if (typeof UI !== 'undefined') UI.toast(`File renamed & saved as "${finalName}"`, 'success');
      });
    });

    container.querySelectorAll('.btn-remove-dsp-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fId = btn.getAttribute('data-file-id');
        dispatchDocFiles = dispatchDocFiles.filter(item => item.id !== fId);
        dispatchDocFile = dispatchDocFiles[0] || null;
        const dspFileInput = document.getElementById('dspDocFileInput');
        if (dspFileInput) dspFileInput.value = '';
        renderDspFiles();
        if (typeof UI !== 'undefined') UI.toast('File removed', 'info');
      });
    });
  }

  // --- Document File Uploads Setup ---
  function setupFileUploads() {
    // Inward Upload
    const btnInwUpload = document.getElementById('btnInwDocUpload');
    const inwFileInput = document.getElementById('inwDocFileInput');

    if (btnInwUpload && inwFileInput) {
      btnInwUpload.addEventListener('click', () => inwFileInput.click());
      inwFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        for (const file of files) {
          const tempId = 'inw_file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const uploaded = await uploadFileToBillsFolder(file, 'INW');
          uploaded.id = tempId;
          uploaded.fileObj = file;
          uploaded.isEditing = false;
          inwardDocFiles.push(uploaded);
        }

        inwardDocFile = inwardDocFiles[0] || null;
        inwFileInput.value = '';
        renderInwFiles();
        if (typeof UI !== 'undefined') UI.toast(`Uploaded ${files.length} invoice file(s)`, 'success');
      });
    }

    // Dispatch Upload
    const btnDspUpload = document.getElementById('btnDspDocUpload');
    const dspFileInput = document.getElementById('dspDocFileInput');

    if (btnDspUpload && dspFileInput) {
      btnDspUpload.addEventListener('click', () => dspFileInput.click());
      dspFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        for (const file of files) {
          const tempId = 'dsp_file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const uploaded = await uploadFileToBillsFolder(file, 'DSP');
          uploaded.id = tempId;
          uploaded.fileObj = file;
          uploaded.isEditing = false;
          dispatchDocFiles.push(uploaded);
        }

        dispatchDocFile = dispatchDocFiles[0] || null;
        dspFileInput.value = '';
        renderDspFiles();
        if (typeof UI !== 'undefined') UI.toast(`Uploaded ${files.length} challan file(s)`, 'success');
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

    if (record.documents && Array.isArray(record.documents) && record.documents.length > 0) {
      record.documents.forEach((doc) => {
        const target = doc.url || doc.data;
        if (target) {
          if (target.startsWith('/bills/') || target.startsWith('/files/') || target.startsWith('http://') || target.startsWith('https://')) {
            window.open(target, '_blank');
          } else {
            const link = document.createElement('a');
            link.href = target;
            link.download = doc.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      });
      if (typeof UI !== 'undefined') UI.toast(`Opened ${record.documents.length} attached document(s)`, 'success');
      return;
    }

    const docTarget = record.docData || record.docUrl;
    if (docTarget) {
      if (docTarget.startsWith('/bills/') || docTarget.startsWith('/files/') || docTarget.startsWith('http://') || docTarget.startsWith('https://')) {
        window.open(docTarget, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = docTarget;
        link.download = record.docName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
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
      editInwDocInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (editInwFileName) editInwFileName.textContent = 'Saving to bills folder...';
        if (editInwBadge) editInwBadge.style.display = 'inline-flex';

        const uploaded = await uploadFileToBillsFolder(file, 'INW_EDIT');
        editInwardDocFile = uploaded;

        if (editInwFileName) editInwFileName.textContent = uploaded.name;
        if (typeof UI !== 'undefined') UI.toast(`File "${uploaded.name}" saved to bills folder`, 'success');
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
      editDspDocInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (editDspFileName) editDspFileName.textContent = 'Saving to bills folder...';
        if (editDspBadge) editDspBadge.style.display = 'inline-flex';

        const uploaded = await uploadFileToBillsFolder(file, 'DSP_EDIT');
        editDispatchDocFile = uploaded;

        if (editDspFileName) editDspFileName.textContent = uploaded.name;
        if (typeof UI !== 'undefined') UI.toast(`File "${uploaded.name}" saved to bills folder`, 'success');
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

  function generateNextSkuCode() {
    const prefix = 'SKU';
    let maxNum = 0;
    items.forEach(item => {
      const code = (item.code || '');
      const match = code.match(/^SKU-?(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  function openNewItemModal(preselectedCat = null) {
    populateCategorySelects();
    const modalEl = document.getElementById('modalNewItem');
    if (!modalEl) return;

    const titleEl = document.getElementById('modalNewItemTitle');
    const wrapCat = document.getElementById('wrapNewSkuCategory');
    const wrapName = document.getElementById('wrapNewSkuName');
    const codeInput = document.getElementById('newSkuCode');
    const nameInput = document.getElementById('newSkuName');
    const catInput = document.getElementById('newSkuCategory');
    const unitInput = document.getElementById('newSkuUnit');
    const thresholdInput = document.getElementById('newSkuMinThreshold');

    if (codeInput) codeInput.value = generateNextSkuCode();
    if (nameInput) nameInput.value = '';

    if (preselectedCat && typeof preselectedCat === 'string') {
      if (catInput) catInput.value = preselectedCat;
      if (wrapCat) wrapCat.style.display = 'none';
      if (wrapName) wrapName.className = 'col-12';
      if (titleEl) titleEl.textContent = `Add New Item — ${preselectedCat}`;
    } else {
      const cats = getCategoryList();
      if (catInput) catInput.value = cats[0] || 'Panels';
      if (wrapCat) wrapCat.style.display = '';
      if (wrapName) wrapName.className = 'col-md-6 col-12';
      if (titleEl) titleEl.textContent = 'Add New Equipment Item';
    }

    if (unitInput) unitInput.value = 'Nos';
    if (thresholdInput) thresholdInput.value = '5';

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
    setTimeout(() => nameInput?.focus(), 200);
  }

  function handleSaveNewItem() {
    const code = document.getElementById('newSkuCode')?.value.trim().toUpperCase() || generateNextSkuCode();
    const name = document.getElementById('newSkuName')?.value.trim();
    const category = document.getElementById('newSkuCategory')?.value || 'Panels';
    const unit = document.getElementById('newSkuUnit')?.value || 'Nos';
    const buyingPrice = 0;
    const minThreshold = Number(document.getElementById('newSkuMinThreshold')?.value) || 5;

    if (!code) {
      if (typeof UI !== 'undefined') UI.toast('Unable to generate SKU code. Please refresh and try again.', 'warning');
      return;
    }
    if (items.some(i => (i.code || '').toLowerCase() === code.toLowerCase())) {
      const newCode = generateNextSkuCode();
      const codeInput = document.getElementById('newSkuCode');
      if (codeInput) codeInput.value = newCode;
      if (typeof UI !== 'undefined') UI.toast(`SKU code updated to ${newCode}. Please try saving again.`, 'info');
      return;
    }
    if (!name) {
      if (typeof UI !== 'undefined') UI.toast('Please enter the Equipment Name', 'warning');
      document.getElementById('newSkuName')?.focus();
      return;
    }

    const newItem = {
      code,
      name,
      brand: 'Standard Solar',
      spec: name,
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
        Brand: 'Standard Solar',
        Specification: newItem.name,
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

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    if (activeTab === 'ledger') renderLedgerTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Registered new SKU "${code}" — ${name} successfully!`, 'success');
    }
  }

  function initEditItemModal() {
    const btnSubmit = document.getElementById('btnSubmitEditSku');
    if (btnSubmit) btnSubmit.addEventListener('click', handleSaveEditItem);
  }

  function openEditItemModal(code) {
    populateCategorySelects();
    const item = items.find(i => (i.code || '').toLowerCase() === (code || '').toLowerCase());
    if (!item) {
      if (typeof UI !== 'undefined') UI.toast('Equipment item not found', 'danger');
      return;
    }

    const modalEl = document.getElementById('modalEditItem');
    if (!modalEl) return;

    const codeInput = document.getElementById('editSkuCode');
    const nameInput = document.getElementById('editSkuName');
    const catInput = document.getElementById('editSkuCategory');
    const unitInput = document.getElementById('editSkuUnit');
    const thresholdInput = document.getElementById('editSkuMinThreshold');

    if (codeInput) codeInput.value = item.code;
    if (nameInput) nameInput.value = item.name || '';
    if (catInput) catInput.value = item.category || 'Panels';
    if (unitInput) unitInput.value = item.unit || 'Nos';
    if (thresholdInput) thresholdInput.value = item.minThreshold || 5;

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
    setTimeout(() => nameInput?.focus(), 200);
  }

  function handleSaveEditItem() {
    const code = document.getElementById('editSkuCode')?.value.trim();
    const name = document.getElementById('editSkuName')?.value.trim();
    const category = document.getElementById('editSkuCategory')?.value || 'Panels';
    const unit = document.getElementById('editSkuUnit')?.value || 'Nos';
    const minThreshold = Number(document.getElementById('editSkuMinThreshold')?.value) || 5;

    if (!code) return;
    if (!name) {
      if (typeof UI !== 'undefined') UI.toast('Please fill the Equipment Name', 'warning');
      document.getElementById('editSkuName')?.focus();
      return;
    }

    const item = items.find(i => (i.code || '').toLowerCase() === code.toLowerCase());
    if (!item) return;

    const oldName = item.name;
    const buyingPrice = item.buyingPrice || 0;
    item.name = name;
    item.brand = '';
    item.Brand = '';
    item.spec = '';
    item.Specification = '';
    item.category = category;
    item.unit = unit;
    item.buyingPrice = buyingPrice;
    item.minThreshold = minThreshold;

    saveData();

    if (typeof DB !== 'undefined') {
      DB.update('inventory_items', r => ((r.ItemCode || r.itemcode || r.code || '').toLowerCase() === code.toLowerCase()), {
        ItemName: name,
        itemname: name,
        Category: category,
        Unit: unit,
        MinThreshold: minThreshold,
        UpdatedAt: new Date().toISOString()
      }).catch(err => console.warn('[Supabase] inventory_items update error:', err));

      DB.update('items', r => ((r.ItemName || r.itemname || r.name || '').toLowerCase() === (oldName || '').toLowerCase() || (r.ItemCode || r.itemcode || r.code || '').toLowerCase() === code.toLowerCase()), {
        ItemName: name,
        Category: category,
        Unit: unit
      }).catch(err => console.warn('[Supabase] items update error:', err));
    }

    const modalEl = document.getElementById('modalEditItem');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Updated item "${name}" successfully!`, 'success');
    }
  }

  async function deleteItem(code) {
    const item = items.find(i => i.code === code);
    if (!item) return;

    const inwCount = inwards.filter(i => i.itemCode === code).length;
    const dspCount = dispatches.filter(d => d.itemCode === code).length;

    let warningText = `Are you sure you want to delete equipment item "${item.name}"?`;
    if (inwCount > 0 || dspCount > 0) {
      warningText += `\n\n⚠️ Note: This item is referenced in ${inwCount} inward purchases and ${dspCount} site dispatches. Deleting it will remove the item from the live stock catalog.`;
    }

    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warningText, 'Delete Equipment Item', 'Delete', 'btn-danger');
    } else {
      ok = confirm(warningText);
    }
    if (!ok) return;

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
      UI.toast(`Item "${item.name}" deleted from catalog.`, 'info');
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
    openStockInConsignment(inw.invoiceNo || inw.id);
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

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();

    if (typeof UI !== 'undefined') {
      UI.toast(`Updated inward record "${id}" successfully!`, 'success');
    }
  }



  // --- Site Dispatch History CRUD Operations ---
  async function handleSaveEditDispatch() {
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
      if (typeof UI !== 'undefined') UI.toast('Please enter a valid quantity', 'warning');
      return;
    }

    const idx = dispatches.findIndex(d => d.id === id);
    if (idx === -1) return;

    const old = dispatches[idx];
    const dispatchedCost = round2(qty * unitBuyingPrice);

    const updated = {
      ...old,
      date,
      siteName,
      itemCode,
      qty,
      unitBuyingPrice,
      dispatchedCost,
      transportCost,
      vehicle,
      remarks
    };

    dispatches[idx] = updated;

    if (typeof DB !== 'undefined') {
      await DB.update('inventory_dispatches', r => (r.DispatchID || r.id) === id, {
        Date: date,
        SiteName: siteName,
        ItemCode: itemCode,
        Quantity: qty,
        UnitBuyingPrice: unitBuyingPrice,
        DispatchedCost: dispatchedCost,
        TransportCost: transportCost,
        Vehicle: vehicle,
        Remarks: remarks
      }).catch(() => {});
    }

    saveData();
    const modalEl = document.getElementById('modalEditDispatch');
    const bsModal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (bsModal) bsModal.hide();

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();

    if (typeof UI !== 'undefined') UI.toast(`Updated dispatch for "${siteName}"`, 'success');
  }

  function recalcDspDeliveryCost() {
    recalcDispatchTotals();
  }

  function recalcDspCustomerTotals() {
    recalcDispatchTotals();
  }

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

  function openEditDispatchModal(keyOrId) {
    const modalEl = document.getElementById('modalSiteDispatch');
    if (!modalEl) return;

    // Find all dispatch records belonging to this batch / challan
    let matchingDispatches = dispatches.filter(d => (d.challanNo && d.challanNo === keyOrId) || d.id === keyOrId);
    if (matchingDispatches.length === 0) {
      const single = dispatches.find(d => d.id === keyOrId || d.challanNo === keyOrId);
      if (single) {
        matchingDispatches = (single.challanNo ? dispatches.filter(d => d.challanNo === single.challanNo) : [single]);
      }
    }

    if (matchingDispatches.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('Dispatch record not found', 'danger');
      return;
    }

    const first = matchingDispatches[0];
    const challanToUse = first.challanNo || first.id;
    editingDispatchChallanNo = challanToUse;
    editingDispatchIds = matchingDispatches.map(d => d.id);

    // Update modal title and button text
    const titleEl = document.getElementById('modalSiteDispatchTitle');
    if (titleEl) {
      titleEl.textContent = `Edit Site Dispatch — ${first.siteName || challanToUse}`;
    }
    const btnSubmit = document.getElementById('btnSubmitDispatch');
    if (btnSubmit) {
      btnSubmit.textContent = 'Update Dispatch';
    }

    // Populate header inputs
    const siteInput = document.getElementById('dspSiteName');
    const dateInput = document.getElementById('dspDate');
    const vehicleInput = document.getElementById('dspVehicle');
    const remarksInput = document.getElementById('dspRemarks');
    const isOurProjectChk = document.getElementById('dspIsOurProject');
    const logisticsSection = document.getElementById('dspLogisticsSection');

    if (siteInput) siteInput.value = first.siteName || '';
    if (dateInput) dateInput.value = first.date || new Date().toISOString().slice(0, 10);
    if (vehicleInput) vehicleInput.value = first.vehicle || '';
    
    // Remarks: clean logistics JSON tag
    const cleanRemarks = first.remarks ? first.remarks.split('|logistics:')[0].trim() : '';
    if (remarksInput) remarksInput.value = cleanRemarks;

    // Project Dispatch Checkbox
    const isOurProject = first.isOurProject !== false;
    if (isOurProjectChk) isOurProjectChk.checked = isOurProject;
    if (logisticsSection) logisticsSection.style.display = isOurProject ? 'block' : 'none';

    // Parse logistics metadata from remarks if fields are not directly on the record
    let logistics = null;
    if (first.remarks && first.remarks.includes('|logistics:')) {
      try {
        logistics = JSON.parse(first.remarks.split('|logistics:')[1]);
      } catch (e) {}
    }

    // Map with Stock Checkbox
    const mapWithStockChk = document.getElementById('dspMapWithStock');
    let mapWithStock = first.mapWithStock !== false;
    if (first.remarks && first.remarks.includes('|mapWithStock:false')) {
      mapWithStock = false;
    } else if (logistics && logistics.mapWithStock === false) {
      mapWithStock = false;
    }
    if (mapWithStockChk) mapWithStockChk.checked = mapWithStock;

    // Populate Delivery Cost
    const transInput = document.getElementById('dspTransportCost');
    const distInput = document.getElementById('dspDistanceKm');
    const extraDeliveryCostInput = document.getElementById('dspExtraDeliveryCost');
    const extraDeliveryCommentInput = document.getElementById('dspExtraDeliveryComment');

    const transportCostVal = first.transportCost !== undefined && first.transportCost !== null ? first.transportCost : (logistics?.transportCost || 0);
    const distanceKmVal = first.distanceKm !== undefined && first.distanceKm !== null ? first.distanceKm : (logistics?.distanceKm || '');
    const costPerKmVal = first.costPerKm !== undefined && first.costPerKm !== null ? first.costPerKm : (logistics?.costPerKm || (distanceKmVal > 0 && transportCostVal > 0 ? (transportCostVal / distanceKmVal).toFixed(2) : ''));
    const extraDeliveryCostVal = first.extraDeliveryCost !== undefined && first.extraDeliveryCost !== null ? first.extraDeliveryCost : (logistics?.extraDeliveryCost || '');
    const extraDeliveryCommentVal = first.extraDeliveryComment !== undefined && first.extraDeliveryComment !== null ? first.extraDeliveryComment : (logistics?.extraDeliveryComment || '');

    const costPerKmEl = document.getElementById('dspCostPerKm');
    if (transInput) transInput.value = transportCostVal || '';
    if (distInput) distInput.value = distanceKmVal || '';
    if (costPerKmEl) costPerKmEl.value = costPerKmVal || '';
    if (extraDeliveryCostInput) extraDeliveryCostInput.value = extraDeliveryCostVal || '';
    if (extraDeliveryCommentInput) extraDeliveryCommentInput.value = extraDeliveryCommentVal || '';
    recalcDspDeliveryCost();

    // Populate Documents
    dispatchDocFiles = [];
    if (first.documents && Array.isArray(first.documents) && first.documents.length > 0) {
      dispatchDocFiles = [...first.documents];
    } else if (first.docName) {
      dispatchDocFiles = [{ name: first.docName, data: first.docData, size: first.docData ? first.docData.length : 0 }];
    }
    dispatchDocFile = dispatchDocFiles[0] || null;
    const dspFileInput = document.getElementById('dspDocFileInput');
    if (dspFileInput) dspFileInput.value = '';
    renderDspFiles();

    // Populate Customer Allocations
    let custAlloc = first.customerAllocations;
    if ((!custAlloc || custAlloc.length === 0) && logistics?.customerAllocations) {
      custAlloc = logistics.customerAllocations;
    }

    dispatchCustomerRows = [];
    if (Array.isArray(custAlloc) && custAlloc.length > 0) {
      custAlloc.forEach(c => {
        dispatchCustomerRows.push({
          id: 'crow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          slNo: c.slNo || '',
          name: c.name || '',
          setCost: c.setCost !== undefined ? c.setCost : '',
          installCost: c.installCost !== undefined ? c.installCost : '',
          deliveryCost: c.deliveryCost !== undefined ? c.deliveryCost : '',
          otherCost: c.otherCost !== undefined ? c.otherCost : '',
          otherComment: c.otherComment || ''
        });
      });
    } else {
      addDspCustomerRow();
    }
    renderDspCustomerRows();
    recalcDspCustomerTotals();

    // Populate Dispatched Items
    dispatchRows = [];
    matchingDispatches.forEach(d => {
      dispatchRows.push({
        id: 'dsprow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        itemCode: d.itemCode,
        originalItemCode: d.itemCode,
        qty: d.qty,
        originalQty: Number(d.qty) || 0,
        unitPrice: d.unitBuyingPrice !== undefined ? d.unitBuyingPrice : null,
        originalDispatchId: d.id
      });
    });

    if (dispatchRows.length === 0) {
      addDspRow();
    }

    renderDspRows();
    recalcDispatchTotals();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  async function deleteDispatch(keyOrId) {
    const matching = dispatches.filter(d => (d.challanNo && d.challanNo === keyOrId) || d.id === keyOrId);
    if (matching.length === 0) return;

    const first = matching[0];
    const totalQty = matching.reduce((sum, d) => sum + (Number(d.qty) || 0), 0);

    const warning = `Are you sure you want to delete site dispatch to "${first.siteName}"?\n\nThis will restore ${fmtQty(totalQty)} units back to physical warehouse stock.\n\nThis action cannot be undone.`;
    let ok = false;
    if (typeof UI !== 'undefined' && UI.confirmDialog) {
      ok = await UI.confirmDialog(warning, 'Delete Site Dispatch', 'Delete Dispatch', 'btn-danger');
    } else {
      ok = confirm(warning);
    }
    if (!ok) return;

    dispatches = dispatches.filter(d => !matching.some(m => m.id === d.id));
    matching.forEach(m => selectedDispatches.delete(m.id));
    saveData();

    if (typeof DB !== 'undefined') {
      for (const m of matching) {
        await DB.remove('inventory_dispatches', r => (r.DispatchID || r.id) === m.id).catch(err => console.warn('[Supabase] inventory_dispatches delete error:', err));
      }
    }

    updateAllTabCounters();
    renderKpiCards();
    renderCategoryChips();
    renderLedgerTable();
    renderInwardsTable();
    renderDispatchesTable();
    updateBulkActionBar();

    if (typeof UI !== 'undefined') {
      UI.toast(`Deleted site dispatch to "${first.siteName}". Stock restored to warehouse inventory.`, 'info');
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
      const headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Buying Price (INR)', 'Inward Qty', 'Dispatched Qty', 'In-Hand Stock', 'Total Stock Valuation (INR)', 'Status'];
      
      const rows = ledger.map(item => [
        `"${item.code}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
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
      const headers = ['Date', 'Challan No', 'Project / Site Name', 'Item Code', 'Item Name', 'Quantity Dispatched', 'Unit Buying Price (INR)', 'Total Material Cost (INR)', 'Transport Cost (INR)', 'Document', 'Vehicle / Transporter'];
      
      const rows = dispatches.map(dsp => {
        const itm = items.find(i => i.code === dsp.itemCode) || {};
        return [
          `"${dsp.date}"`,
          `"${dsp.challanNo || ''}"`,
          `"${(dsp.siteName || '').replace(/"/g, '""')}"`,
          `"${dsp.itemCode}"`,
          `"${(itm.name || '').replace(/"/g, '""')}"`,
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
      const headers = ['Date', 'Invoice No', 'Supplier / Vendor', 'Items Received (Qty & Unit Price)', 'Total Units', 'Total Inward Cost (INR)', 'Transport Cost (INR)', 'Document', 'Storage Location', 'Remarks'];
      const consignments = getGroupedInwardConsignments();
      const rows = consignments.map(c => {
        const itemsSummary = c.items.map(it => `${it.itemName} (${it.qty} ${it.unit} @ ₹${it.unitPrice})`).join('; ');
        return [
          `"${c.date}"`,
          `"${c.invoiceNo || ''}"`,
          `"${(c.supplier || '').replace(/"/g, '""')}"`,
          `"${itemsSummary.replace(/"/g, '""')}"`,
          c.totalQty,
          c.totalCost,
          c.transportCost || 0,
          `"${c.docName || ''}"`,
          `"${(c.location || '').replace(/"/g, '""')}"`,
          `"${(c.remarks || '').replace(/"/g, '""')}"`
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
  function switchTab(tabKey) {
    activeTab = tabKey;
    const tabBtns = document.querySelectorAll('.inv-tab-btn');
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === tabKey) b.classList.add('active');
      else b.classList.remove('active');
    });

    document.querySelectorAll('.inv-tab-pane').forEach(p => p.style.display = 'none');
    const activePane = document.getElementById(`pane-${tabKey}`);
    if (activePane) activePane.style.display = 'block';

    // Hide Search textbox on Site Dispatches and Inward Purchases tabs
    const searchWrap = document.querySelector('.inv-search-wrap');
    if (searchWrap) searchWrap.style.display = (tabKey === 'ledger') ? '' : 'none';

    // Hide Summary button on Site Dispatches and Inward Purchases tabs
    const btnDesktopSummary = document.getElementById('btnDesktopSummary');
    if (btnDesktopSummary) btnDesktopSummary.style.display = (tabKey === 'ledger') ? '' : 'none';

    const btnMobileSummary = document.getElementById('btnMobileSummary');
    if (btnMobileSummary) btnMobileSummary.style.display = (tabKey === 'ledger') ? '' : 'none';

    const chipsWrap = document.getElementById('invCategoryChipsRow');
    const statusWrap = document.getElementById('invStatusPills') || document.getElementById('invStatusFilterWrap');
    const manageCatBtn = document.getElementById('btnManageCategories');
    if (chipsWrap) chipsWrap.style.display = (tabKey === 'ledger') ? 'flex' : 'none';
    if (statusWrap) statusWrap.style.display = (tabKey === 'ledger') ? '' : 'none';
    if (manageCatBtn) manageCatBtn.style.display = (tabKey === 'ledger') ? '' : 'none';

    const toolbar = document.querySelector('.inv-toolbar');
    if (toolbar) {
      toolbar.style.display = (tabKey === 'ledger') ? '' : 'none';
      toolbar.classList.toggle('tab-non-ledger', tabKey !== 'ledger');
    }

    updateAllTabCounters();
    if (tabKey === 'ledger') renderLedgerTable();
    else if (tabKey === 'dispatches') renderDispatchesTable();
    else if (tabKey === 'inwards') renderInwardsTable();

    updateBulkActionBar();
  }

  function setupTabs() {
    const tabBtns = document.querySelectorAll('.inv-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const tabKey = target.getAttribute('data-tab');
        switchTab(tabKey);
      });
    });
  }

  // --- Sticky Offsets & Layout Helpers ---
  function updateStickyOffsets() {
    const topbar = document.getElementById('topbar');
    if (topbar) {
      const height = topbar.offsetHeight || 46;
      document.documentElement.style.setProperty('--topbar-height', `${height}px`);
    }
  }

  // --- Inventory Summary Popup Modal ---
  function openSummaryModal() {
    renderKpiCards();
    const modalEl = document.getElementById('modalInventorySummary');
    if (modalEl) {
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      } else {
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
      }
    }
  }

  // --- Collapsible KPI Metrics Section ---
  function toggleKpiCollapse(forceState) {
    const section = document.getElementById('invKpiSection');
    const label = document.getElementById('invKpiToggleLabel');
    const miniStrip = document.getElementById('invKpiMiniStrip');
    const toggleBar = document.getElementById('btnToggleKpi');
    if (!section) return;

    const isCollapsed = forceState !== undefined ? forceState : !section.classList.contains('is-collapsed');
    section.classList.toggle('is-collapsed', isCollapsed);
    if (label) label.textContent = isCollapsed ? 'Expand' : 'Collapse';
    if (miniStrip) miniStrip.style.display = isCollapsed ? 'inline-flex' : 'none';
    if (toggleBar) toggleBar.setAttribute('aria-expanded', !isCollapsed);

    try {
      localStorage.setItem('inv_kpi_collapsed', isCollapsed ? 'true' : 'false');
    } catch (e) { }

    updateStickyOffsets();
  }

  // --- View Mode State (Always Table Format) ---
  let currentViewMode = 'table';

  function setViewMode(mode) {
    currentViewMode = 'table';
    try { localStorage.removeItem('inv_view_mode'); } catch (e) { }
    const mainCard = document.querySelector('.inv-main-card');
    if (mainCard) {
      mainCard.classList.remove('inv-pane-view-cards');
      mainCard.classList.add('inv-pane-view-table');
    }
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
    const btnClear = document.getElementById('btnSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        if (btnClear) btnClear.style.display = searchTerm.length > 0 ? 'flex' : 'none';
        if (activeTab === 'ledger') renderLedgerTable();
        else if (activeTab === 'dispatches') renderDispatchesTable();
        else if (activeTab === 'inwards') renderInwardsTable();
      });
    }
    if (btnClear && searchInput) {
      btnClear.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        btnClear.style.display = 'none';
        searchInput.focus();
        if (activeTab === 'ledger') renderLedgerTable();
        else if (activeTab === 'dispatches') renderDispatchesTable();
        else if (activeTab === 'inwards') renderInwardsTable();
      });
    }

    const statusSelect = document.getElementById('invStatusSelect');
    const statusPillsWrap = document.getElementById('invStatusPills');
    if (statusPillsWrap) {
      statusPillsWrap.querySelectorAll('.inv-status-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const st = pill.getAttribute('data-status');
          statusFilter = st;
          statusPillsWrap.querySelectorAll('.inv-status-pill').forEach(p => p.classList.toggle('active', p === pill));
          if (statusSelect) statusSelect.value = st;
          renderLedgerTable();
        });
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        if (statusPillsWrap) {
          statusPillsWrap.querySelectorAll('.inv-status-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === statusFilter));
        }
        renderLedgerTable();
      });
    }

    // Summary Popup Modal Triggers (Desktop & Mobile)
    const btnDesktopSummary = document.getElementById('btnDesktopSummary');
    if (btnDesktopSummary) {
      btnDesktopSummary.addEventListener('click', openSummaryModal);
    }
    const btnMobileSummary = document.getElementById('btnMobileSummary');
    if (btnMobileSummary) {
      btnMobileSummary.addEventListener('click', openSummaryModal);
    }

    // KPI Summary Collapsible Toggle
    const btnToggleKpi = document.getElementById('btnToggleKpi');
    if (btnToggleKpi) {
      btnToggleKpi.addEventListener('click', () => toggleKpiCollapse());
      btnToggleKpi.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleKpiCollapse();
        }
      });
    }

    // Keep sticky header offsets aligned on viewport resize
    window.addEventListener('resize', updateStickyOffsets);

    // Bulk action buttons
    const btnBulkStockIn = document.getElementById('btnBulkStockIn');
    if (btnBulkStockIn) {
      btnBulkStockIn.addEventListener('click', () => {
        if (selectedLedger.size > 0) {
          openStockInModal(selectedLedger);
        } else {
          openStockInModal();
        }
      });
    }

    const btnBulkDispatch = document.getElementById('btnBulkDispatch');
    if (btnBulkDispatch) {
      btnBulkDispatch.addEventListener('click', () => {
        if (selectedLedger.size > 0) {
          openDispatchModal(selectedLedger);
        } else {
          openDispatchModal();
        }
      });
    }

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

  // --- Price History & Trend Graph Renderer ---
  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
    } catch (e) {
      return dateStr;
    }
  }

  function openPriceHistory(itemCode) {
    if (!itemCode) return;
    const ledger = getCalculatedStockLedger();
    const item = ledger.find(it => (it.code || '').toLowerCase() === itemCode.toLowerCase()) || 
                 items.find(it => (it.code || '').toLowerCase() === itemCode.toLowerCase()) || 
                 { code: itemCode, name: itemCode, brand: '', spec: '', buyingPrice: 0 };

    const modalEl = document.getElementById('modalPriceHistory');
    if (!modalEl) return;

    // Title and Subtitle
    const titleEl = document.getElementById('modalPriceHistoryTitle');
    const subtitleEl = document.getElementById('modalPriceHistorySubtitle');
    if (titleEl) {
      titleEl.innerHTML = `Equipment Rate History: <span class="text-primary">${escapeHtml(item.name || itemCode)}</span>`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `SKU: ${item.code || itemCode} • Unit: ${item.unit || 'Nos'}`;
    }

    // Find all inward records for this itemCode
    const itemInwards = inwards
      .filter(inw => (inw.itemCode || '').toLowerCase() === itemCode.toLowerCase())
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological (oldest to newest)

    // Build price points list
    let pricePoints = [];
    if (itemInwards.length > 0) {
      pricePoints = itemInwards.map((inw) => {
        const rate = Number(inw.costPerUnit) || Number(inw.unitPrice) || Number(item.buyingPrice) || 0;
        const qty = Number(inw.qty) || 0;
        const total = Number(inw.totalCost) || (rate * qty);
        return {
          id: inw.id,
          date: inw.date,
          supplier: inw.supplier || inw.remarks || 'Consignment Inward',
          rate: rate,
          qty: qty,
          totalCost: total,
          invoiceNo: inw.invoiceNo || inw.id
        };
      });
    } else {
      // If no inwards recorded yet, display current catalog baseline price
      pricePoints = [{
        id: 'BASE',
        date: new Date().toISOString().slice(0, 10),
        supplier: 'Catalog Base Rate (Initial)',
        rate: Number(item.costPerUnit) || Number(item.buyingPrice) || 0,
        qty: 0,
        totalCost: 0,
        invoiceNo: 'CATALOG-INIT'
      }];
    }

    // Render SVG Trend Graph with increase/decrease metrics and purchased quantities
    renderPriceTrendGraph(pricePoints, item);

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function renderPriceTrendGraph(pricePoints, item) {
    const wrap = document.getElementById('phGraphCanvasWrap');
    if (!wrap) return;

    if (!pricePoints || pricePoints.length === 0) {
      wrap.innerHTML = `<div class="p-4 text-center text-muted small">No price data available</div>`;
      return;
    }

    const rates = pricePoints.map(p => p.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);

    const width = 760;
    const height = 250;
    const paddingLeft = 70;
    const paddingRight = 60;
    const paddingTop = 45;
    const paddingBottom = 40;

    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    // Calculate Y range
    let yMin = minRate;
    let yMax = maxRate;
    if (yMin === yMax) {
      yMin = Math.max(0, Math.floor(yMin * 0.85));
      yMax = Math.ceil((yMax * 1.15) || 100);
    } else {
      const diff = yMax - yMin;
      yMin = Math.max(0, Math.floor(yMin - diff * 0.20));
      yMax = Math.ceil(yMax + diff * 0.25);
    }

    const getY = (val) => {
      const pct = (val - yMin) / (yMax - yMin || 1);
      return paddingTop + plotH - (pct * plotH);
    };

    const getX = (idx) => {
      if (pricePoints.length === 1) return paddingLeft + plotW / 2;
      return paddingLeft + (idx / (pricePoints.length - 1)) * plotW;
    };

    // Build SVG coordinate points
    const coords = pricePoints.map((p, idx) => ({
      x: getX(idx),
      y: getY(p.rate),
      p,
      idx
    }));

    // Grid lines (3 horizontal lines)
    const gridLevels = [yMin, yMin + (yMax - yMin) * 0.5, yMax];
    let gridSvg = '';
    gridLevels.forEach(val => {
      const gy = getY(val);
      gridSvg += `
        <line x1="${paddingLeft}" y1="${gy}" x2="${width - paddingRight}" y2="${gy}" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1"/>
        <text x="${paddingLeft - 8}" y="${gy + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="monospace">₹${Math.round(val).toLocaleString('en-IN')}</text>
      `;
    });

    // Path points
    const pointsStr = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaStr = `${coords[0].x.toFixed(1)},${(paddingTop + plotH).toFixed(1)} ` + pointsStr + ` ${coords[coords.length - 1].x.toFixed(1)},${(paddingTop + plotH).toFixed(1)}`;

    // Dots and text labels
    let dotsSvg = '';
    coords.forEach((c) => {
      const prev = c.idx > 0 ? pricePoints[c.idx - 1] : null;
      const diff = prev ? round2(c.p.rate - prev.rate) : null;
      let diffSvg = '';
      let dotColor = '#2563eb';

      if (diff !== null) {
        if (diff > 0) {
          diffSvg = `<text x="${c.x.toFixed(1)}" y="${(c.y - 25).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#16a34a" font-family="monospace">▲ +₹${diff.toFixed(2)}</text>`;
          dotColor = '#16a34a';
        } else if (diff < 0) {
          diffSvg = `<text x="${c.x.toFixed(1)}" y="${(c.y - 25).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#dc2626" font-family="monospace">▼ -₹${Math.abs(diff).toFixed(2)}</text>`;
          dotColor = '#dc2626';
        } else {
          diffSvg = `<text x="${c.x.toFixed(1)}" y="${(c.y - 25).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#64748b" font-family="monospace">= Same</text>`;
        }
      } else {
        diffSvg = `<text x="${c.x.toFixed(1)}" y="${(c.y - 25).toFixed(1)}" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="sans-serif">(Initial)</text>`;
      }

      const qtyLabel = c.p.qty > 0 ? `Qty: ${fmtQty(c.p.qty)} ${escapeHtml(item.unit || 'units')}` : 'Catalog Rate';

      dotsSvg += `
        <g class="ph-graph-dot" style="cursor: pointer;">
          <title>${c.p.supplier}: ₹${c.p.rate.toLocaleString('en-IN')}/unit on ${c.p.date}${diff !== null ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(2)})` : ''}\n${qtyLabel}</title>
          ${diffSvg}
          <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="${dotColor}" stroke="#ffffff" stroke-width="2"/>
          <text x="${c.x.toFixed(1)}" y="${(c.y - 10).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a" font-family="monospace">${fmtRupees(c.p.rate)}</text>
          <text x="${c.x.toFixed(1)}" y="${(c.y + 16).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#475569" font-family="sans-serif">${qtyLabel}</text>
          <text x="${c.x.toFixed(1)}" y="${(height - 12).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#64748b" font-family="sans-serif">${c.p.date && c.p.date !== 'CATALOG-INIT' ? formatShortDate(c.p.date) : 'Catalog'}</text>
        </g>
      `;
    });

    wrap.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-height: 260px; display: block; overflow: visible;">
        <defs>
          <linearGradient id="phAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${gridSvg}
        <polygon points="${areaStr}" fill="url(#phAreaGradient)"/>
        <polyline points="${pointsStr}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dotsSvg}
      </svg>
    `;
  }

  // --- Initializer ---
  let isInitialized = false;
  let isInitializing = false;

  async function init() {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const roleLower = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase().trim();
    const isPowerUser = roleLower === 'admin' || roleLower === 'superadmin';
    if (!isPowerUser) {
      window.location.href = 'quotation.html';
      return;
    }

    if (isInitializing) return;
    if (isInitialized) {
      await syncWithDatabase();
      return;
    }
    isInitializing = true;

    // Completely purge any legacy inventory data from browser localStorage
    try {
      localStorage.removeItem('solartrack_inventory_items_v2');
      localStorage.removeItem('solartrack_inventory_inwards_v2');
      localStorage.removeItem('solartrack_inventory_dispatches_v2');
      localStorage.removeItem('solartrack_inventory_items');
      localStorage.removeItem('solartrack_inventory_inwards');
      localStorage.removeItem('solartrack_inventory_dispatches');
    } catch (e) {}

    if (typeof UI !== 'undefined') {
      UI.renderSidebar('inventory.html');
      const mobileSummaryBtn = `
        <button type="button" class="btn btn-sm btn-outline-primary d-md-none d-inline-flex align-items-center gap-1.5 py-1 px-2.5 fs-8 shadow-xs rounded-1" id="btnMobileSummary" onclick="InventoryApp.openSummaryModal()" title="View Inventory Summary">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
          <span>Summary</span>
        </button>
      `;
      UI.renderTopbar('Inventory', mobileSummaryBtn);
    }

    // Await direct load from Database
    await syncWithDatabase();

    renderKpiCards();
    setViewMode('table');
    updateStickyOffsets();
    try {
      const savedCollapsed = localStorage.getItem('inv_kpi_collapsed');
      if (savedCollapsed !== 'false') {
        toggleKpiCollapse(true);
      } else {
        toggleKpiCollapse(false);
      }
    } catch (e) {
      toggleKpiCollapse(true);
    }
    populateCategorySelects();
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
    isInitialized = true;
    isInitializing = false;
  }

  return {
    init,
    syncWithDatabase,
    openSummaryModal,
    setViewMode,
    toggleKpiCollapse,
    openStockInModal,
    openStockInConsignment,
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
    openPriceHistory,
    toggleItemPicker,
    filterPickerItems,
    selectPickerItem,
    toggleCustomerPicker,
    filterCustomerPicker,
    selectDspCustomer,
    startInlineAddItem,
    saveInlineAddItem,
    cancelInlineAddItem,
    updateInlineTotalVal,
    openCategoryModal,
    addCategoryFromManager,
    openEditCategoryModal,
    saveEditCategoryModal,
    promptEditCategory,
    promptDeleteCategory,
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
