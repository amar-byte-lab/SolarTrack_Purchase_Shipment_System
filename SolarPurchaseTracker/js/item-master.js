/* =========================================================================
   item-master.js — Item & Product Sets Master Controllers
   ========================================================================= */

let itemModal;
let productModal;
let activeTab = 'items'; // 'items' or 'products'

window.onDbReady = function () {
  UI.renderSidebar('item-master.html');
  
  // Initialize modals
  itemModal = new bootstrap.Modal(document.getElementById('itemModal'));
  productModal = new bootstrap.Modal(document.getElementById('productModal'));

  // Setup top bar actions dynamically based on active tab
  updateTopbarActions();

  // Tab switching event listeners
  const itemsTabBtn = document.getElementById('items-tab');
  const productsTabBtn = document.getElementById('products-tab');

  if (itemsTabBtn) {
    itemsTabBtn.addEventListener('shown.bs.tab', () => {
      activeTab = 'items';
      updateTopbarActions();
      render();
    });
  }

  if (productsTabBtn) {
    productsTabBtn.addEventListener('shown.bs.tab', () => {
      activeTab = 'products';
      updateTopbarActions();
      renderProducts();
    });
  }

  // Items save & search bindings
  document.getElementById('btnSaveItem').addEventListener('click', saveItem);
  document.getElementById('fSearch').addEventListener('input', Utils.debounce(render, 200));

  // Products save binding
  document.getElementById('btnSaveProduct').addEventListener('click', saveProduct);

  // Sticky add row bindings
  const addItemRow = document.getElementById('btnAddItemRow');
  if (addItemRow) addItemRow.addEventListener('click', () => openModal(null));

  const addProductRow = document.getElementById('btnAddProductRow');
  if (addProductRow) addProductRow.addEventListener('click', () => openProductModal(null));

  // Render initial list
  render();
};

function updateTopbarActions() {
  let actionsHtml = '';
  if (activeTab === 'items') {
    actionsHtml = `
      <button class="btn btn-outline-secondary" id="btnExport">⬇ Export Excel</button>
    `;
  } else {
    actionsHtml = `
      <button class="btn btn-success fw-semibold" id="btnGenerateOffer">📄 Generate Offer</button>
    `;
  }

  UI.renderTopbar('Products', 'Manage master lists of items, packages, and composite product sets', actionsHtml);

  // Re-bind listeners for dynamic topbar buttons
  if (activeTab === 'items') {
    const btnExp = document.getElementById('btnExport');
    if (btnExp) {
      btnExp.addEventListener('click', () => {
        Utils.exportRowsToExcel(DB.getAll('items'), DB.HEADERS.items, 'Items_export.xlsx');
      });
    }
  } else {
    const btnGen = document.getElementById('btnGenerateOffer');
    if (btnGen) btnGen.addEventListener('click', generateOfferRedirect);
  }
}

/* ── Tab 1: Item Master Controllers ──────────────────────────────────── */

function render() {
  const search = (document.getElementById('fSearch').value || '').toLowerCase();
  let items = DB.getAll('items');
  if (search) {
    items = items.filter(i => [i.ItemName, i.Category, i.HSNCode].join(' ').toLowerCase().includes(search));
  }
  const tbody = document.querySelector('#itemsTable tbody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No items found. Items are also auto-added whenever you use a new material in a shipment.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(i => `
    <tr>
      <td class="fw-semibold">${i.ItemName}</td>
      <td>${i.Category || '-'}</td>
      <td>${i.Unit || '-'}</td>
      <td>${i.HSNCode || '-'}</td>
      <td>${i.GSTPercent !== '' ? i.GSTPercent + '%' : '-'}</td>
      <td><span class="chip ${i.Status === 'Active' ? 'chip-green' : 'chip-gray'}">${i.Status || 'Active'}</span></td>
      <td class="no-print">
        <button class="btn btn-sm btn-outline-secondary" onclick='openModal(${JSON.stringify(i.ItemName)})'>✎</button>
        <button class="btn btn-sm btn-outline-danger" onclick='deleteItem(${JSON.stringify(i.ItemName)})'>🗑</button>
      </td>
    </tr>
  `).join('');

  // Update datalists in the background so inputs autocomplete correctly
  populateDatalists();
}

function populateDatalists() {
  const items = DB.getAll('items');
  const datalist = document.getElementById('itemList');
  if (datalist) {
    datalist.innerHTML = items.map(i => `<option value="${i.ItemName}">`).join('');
  }
}

window.openModal = function (itemName) {
  document.getElementById('itemModalTitle').textContent = itemName ? 'Edit Item' : 'New Item';
  document.getElementById('mOrigName').value = itemName || '';
  if (itemName) {
    const it = DB.getAll('items').find(i => i.ItemName === itemName);
    document.getElementById('mItemName').value = it.ItemName || '';
    document.getElementById('mCategory').value = it.Category || '';
    document.getElementById('mUnit').value = it.Unit || '';
    document.getElementById('mHSN').value = it.HSNCode || '';
    document.getElementById('mGST').value = it.GSTPercent || '';
    document.getElementById('mStatus').value = it.Status || 'Active';
  } else {
    document.getElementById('mItemName').value = '';
    document.getElementById('mCategory').value = '';
    document.getElementById('mUnit').value = '';
    document.getElementById('mHSN').value = '';
    document.getElementById('mGST').value = '';
    document.getElementById('mStatus').value = 'Active';
  }
  itemModal.show();
};

async function saveItem() {
  const origName = document.getElementById('mOrigName').value;
  const row = {
    ItemName: document.getElementById('mItemName').value.trim(),
    Category: document.getElementById('mCategory').value.trim(),
    Unit: document.getElementById('mUnit').value.trim(),
    HSNCode: document.getElementById('mHSN').value.trim(),
    GSTPercent: document.getElementById('mGST').value,
    Status: document.getElementById('mStatus').value,
  };
  const errors = Validate.run([[Validate.required, row.ItemName, 'Item Name']]);
  if (errors.length) { UI.toast(errors[0], 'danger'); return; }

  UI.showLoading(true);
  if (origName) {
    await DB.update('items', i => i.ItemName === origName, row);
  } else {
    const items = DB.getAll('items');
    if (items.some(i => i.ItemName === row.ItemName)) {
      UI.showLoading(false);
      UI.toast('An item with this name already exists.', 'danger');
      return;
    }
    await DB.insert('items', row);
  }
  UI.showLoading(false);
  itemModal.hide();
  UI.toast('Item saved.', 'success');
  render();
}

window.deleteItem = async function (itemName) {
  const ok = await UI.confirmDialog(`Delete item "${itemName}" from the master list? Existing shipment records are not affected.`, 'Delete Item');
  if (!ok) return;
  UI.showLoading(true);
  await DB.remove('items', i => i.ItemName === itemName);
  UI.showLoading(false);
  UI.toast('Item deleted.', 'warning');
  render();
};

/* ── Tab 2: Product Sets Controllers ─────────────────────────────────── */

function renderProducts() {
  const products = DB.getAll('products');
  const itemsMap = DB.getAll('product_items');
  const tbody = document.getElementById('productsTbody');
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No product sets defined yet. Click "+ Add a new product set..." below or at top to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const items = itemsMap.filter(i => i.ProductName === p.ProductName);
    const escapedName = JSON.stringify(p.ProductName);
    const itemsListText = items.map(it => `<span class="badge bg-light text-dark border me-1 my-0.5">${it.ItemName} ${it.Price ? '(₹' + Number(it.Price).toLocaleString('en-IN') + ')' : ''}</span>`).join('') || '<span class="text-muted italic">No components</span>';

    const costVal = Number(p.TotalCost) || 0;
    const gstVal = Number(p.GSTPercent) || 0;
    const incl = p.IncludeGST !== false;
    
    let costDisplay = '-';
    if (costVal > 0) {
      const gstTag = gstVal > 0 ? `<div class="fs-8 text-muted fw-normal">${incl ? 'Incl.' : '+'} ${gstVal}% GST</div>` : '';
      costDisplay = `
        <div class="d-flex flex-column">
          <span class="font-monospace fw-bold text-success">₹${costVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
          ${gstTag}
        </div>
      `;
    }

    return `
      <tr>
        <td class="text-center no-print">
          <input class="form-check-input product-chk" type="checkbox" value="${p.ProductName}" style="width:1.1rem; height:1.1rem; cursor:pointer;">
        </td>
        <td class="fw-bold text-dark">${p.ProductName}</td>
        <td>${costDisplay}</td>
        <td>
          <div class="d-flex flex-wrap gap-1 align-items-center">${itemsListText}</div>
        </td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-secondary" onclick='openProductModal(${escapedName})' title="Edit Product Set">✎</button>
          <button class="btn btn-sm btn-outline-danger" onclick='deleteProduct(${escapedName})' title="Delete Product Set">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  const chkSelectAll = document.getElementById('chkSelectAllProducts');
  if (chkSelectAll) {
    chkSelectAll.checked = false;
    chkSelectAll.onclick = function() {
      document.querySelectorAll('.product-chk').forEach(c => c.checked = chkSelectAll.checked);
    };
  }
}

window.toggleProductAccordion = function(collapseId) {
  const panel = document.getElementById(collapseId);
  const icon = document.getElementById('icon_' + collapseId);
  if (!panel) return;
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    if (icon) icon.textContent = '▲';
  } else {
    panel.style.display = 'none';
    if (icon) icon.textContent = '▼';
  }
};

window.recalcProductTotalCost = function() {
  const priceInputs = document.querySelectorAll('#pItemsTbody .p-item-price');
  let sum = 0;
  priceInputs.forEach(input => {
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) sum += val;
  });

  // Update hidden cost field
  const costEl = document.getElementById('pTotalCost');
  if (costEl) costEl.value = sum;

  // GST controls
  const inclEl = document.getElementById('pIncludeGST');
  const gstPctEl = document.getElementById('pGSTPercent');
  const incl = inclEl ? inclEl.checked : true;
  const gstPct = gstPctEl ? (parseFloat(gstPctEl.value) || 0) : 0;

  let baseForGST = 0;
  let gstAmt = 0;
  let grandTotal = 0;

  if (incl) {
    // GST is already included in the item prices; back-calculate base
    baseForGST = sum / (1 + gstPct / 100);
    gstAmt = sum - baseForGST;
    grandTotal = sum;
  } else {
    // GST is added on top
    baseForGST = sum;
    gstAmt = sum * gstPct / 100;
    grandTotal = sum + gstAmt;
  }

  const fmt = v => '₹' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const dispTotal = document.getElementById('pDisplayTotalCost');
  const dispGST   = document.getElementById('pDisplayGSTVal');
  const dispGrand = document.getElementById('pDisplayGrandTotal');

  if (dispTotal) dispTotal.textContent = fmt(sum);
  if (dispGST)   dispGST.textContent   = fmt(gstAmt) + (gstPct > 0 ? ` (${gstPct}%)` : '');
  if (dispGrand) dispGrand.textContent  = fmt(grandTotal);
};

window.openProductModal = function (productName) {
  document.getElementById('productModalTitle').textContent = productName ? 'Edit Product Set' : 'New Product Set';
  document.getElementById('pOrigName').value = productName || '';
  document.getElementById('pProductName').value = productName || '';

  const costEl = document.getElementById('pTotalCost');
  const gstEl = document.getElementById('pGSTPercent');
  const inclEl = document.getElementById('pIncludeGST');

  if (productName) {
    const p = DB.getAll('products').find(x => x.ProductName === productName);
    if (costEl) costEl.value = p && (p.TotalCost !== undefined && p.TotalCost !== '' && p.TotalCost !== null) ? p.TotalCost : '';
    if (gstEl) gstEl.value = p && p.GSTPercent !== undefined ? p.GSTPercent : 18;
    if (inclEl) inclEl.checked = p ? p.IncludeGST !== false : true;
  } else {
    if (costEl) costEl.value = '';
    if (gstEl) gstEl.value = 18;
    if (inclEl) inclEl.checked = true;
  }

  // Wire GST % and GST Included checkbox to live-recalc
  if (gstEl) {
    gstEl.oninput = recalcProductTotalCost;
    gstEl.onchange = recalcProductTotalCost;
  }
  if (inclEl) {
    inclEl.onchange = recalcProductTotalCost;
  }

  const tbody = document.getElementById('pItemsTbody');
  tbody.innerHTML = '';

  if (productName) {
    const items = DB.getAll('product_items').filter(it => it.ProductName === productName);
    items.forEach(it => addProductItemRow(it));
  } else {
    addProductItemRow();
  }

  // Always recalc after populating
  recalcProductTotalCost();
  
  productModal.show();
};

window.addProductItemRow = function (data) {
  const tbody = document.getElementById('pItemsTbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <input type="text" class="form-control form-control-sm p-item-name border-0 p-0 text-center fw-semibold" list="itemList" value="${data ? (data.ItemName || '') : ''}" placeholder="Item Name *">
    </td>
    <td>
      <input type="number" step="any" min="0" class="form-control form-control-sm p-item-price border-0 p-0 text-end font-monospace" value="${data ? (data.Price || '') : ''}" placeholder="0.00">
    </td>
    <td class="text-center">
      <span class="text-danger fw-bold btn-del-pitem" style="cursor:pointer; font-size:0.9rem;">✕</span>
    </td>
  `;

  const priceInput = tr.querySelector('.p-item-price');
  if (priceInput) {
    priceInput.addEventListener('input', recalcProductTotalCost);
  }

  const btnDel = tr.querySelector('.btn-del-pitem');
  if (btnDel) {
    btnDel.addEventListener('click', () => {
      tr.remove();
      recalcProductTotalCost();
    });
  }

  tbody.appendChild(tr);
};

async function saveProduct() {
  const origName = document.getElementById('pOrigName').value;
  const productName = document.getElementById('pProductName').value.trim();

  if (!productName) {
    UI.toast('Product Set Name is required.', 'danger');
    document.getElementById('pProductName').focus();
    return;
  }

  // Parse items from form
  const rows = document.querySelectorAll('#pItemsTbody tr');
  const items = Array.from(rows).map(row => {
    const name = row.querySelector('.p-item-name').value.trim();
    const price = Number(row.querySelector('.p-item-price').value) || 0;
    return { ItemName: name, Price: price };
  }).filter(it => it.ItemName);

  if (items.length === 0) {
    UI.toast('Please add at least one item with a name.', 'danger');
    return;
  }

  UI.showLoading(true);
  try {
    const totalCostVal = document.getElementById('pTotalCost') ? Number(document.getElementById('pTotalCost').value) || 0 : 0;
    const gstPercentVal = document.getElementById('pGSTPercent') ? Number(document.getElementById('pGSTPercent').value) || 0 : 0;
    const includeGSTVal = document.getElementById('pIncludeGST') ? document.getElementById('pIncludeGST').checked : true;

    const productRow = {
      ProductName: productName,
      TotalCost: totalCostVal,
      GSTPercent: gstPercentVal,
      IncludeGST: includeGSTVal,
      CreatedAt: new Date().toISOString()
    };

    if (origName) {
      // If product name changed, delete old one and update references
      if (origName !== productName) {
        // Check uniqueness of new name
        if (DB.getAll('products').some(p => p.ProductName === productName)) {
          UI.showLoading(false);
          UI.toast('A product set with this name already exists.', 'danger');
          return;
        }
        await DB.remove('products', p => p.ProductName === origName);
        await DB.remove('product_items', it => it.ProductName === origName);
      }
      await DB.update('products', p => p.ProductName === productName, productRow);
    } else {
      // Check uniqueness on create
      if (DB.getAll('products').some(p => p.ProductName === productName)) {
        UI.showLoading(false);
        UI.toast('A product set with this name already exists.', 'danger');
        return;
      }
      await DB.insert('products', productRow);
    }

    // Replace items
    if (origName) {
      await DB.remove('product_items', it => it.ProductName === productName);
    }
    for (const it of items) {
      const itRow = {
        RowID: Utils.uid('PITM'),
        ProductName: productName,
        ItemName: it.ItemName,
        Price: it.Price
      };
      await DB.insert('product_items', itRow);

      // Auto add new items to the general Item Master if they don't exist
      const generalItems = DB.getAll('items');
      if (!generalItems.some(x => x.ItemName === it.ItemName)) {
        await DB.insert('items', {
          ItemName: it.ItemName,
          Category: 'Auto-added',
          Unit: 'Pcs',
          HSNCode: '',
          GSTPercent: '',
          Status: 'Active'
        });
      }
    }

    UI.toast('Product Set saved successfully.', 'success');
    productModal.hide();
    renderProducts();
  } catch (err) {
    UI.toast('Error saving product set: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}

window.deleteProduct = async function (productName) {
  const ok = await UI.confirmDialog(`Delete Product Set "${productName}"? This will delete the package and all its composite items.`, 'Delete Product Set');
  if (!ok) return;
  
  UI.showLoading(true);
  try {
    await DB.remove('products', p => p.ProductName === productName);
    await DB.remove('product_items', it => it.ProductName === productName);
    UI.toast('Product Set deleted.', 'warning');
    renderProducts();
  } catch (err) {
    UI.toast('Error deleting product set: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

function generateOfferRedirect() {
  const checked = Array.from(document.querySelectorAll('.product-chk:checked')).map(chk => chk.value);
  if (checked.length === 0) {
    UI.toast('Please select at least one Product Set using the checkboxes.', 'warning');
    return;
  }
  // Redirect to offer generator page
  const params = encodeURIComponent(checked.join(','));
  window.location.href = `offer.html?products=${params}`;
}
