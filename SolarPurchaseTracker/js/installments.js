/* =========================================================================
   installments.js — Installment & Commission Tracker Logic (Inline Editing)
   ========================================================================= */

let editingSlNo = null;  // SlNo of row currently being edited
let isAddingNew = false; // true if we are adding a brand new row

let sortCol = 'SlNo'; // default sort column
let sortDir = 'asc';  // default sort direction

let selectedDistricts = []; // Array of currently selected districts for filtering
let selectedBrands = [];    // Array of currently selected brands for filtering
let selectedColorCols = []; // Array of column keys currently checked in custom coloring menu

const DISTRICTS = [
  'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
  'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
  'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Khordha',
  'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada',
  'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'
];

const COLORABLE_COLS = [
  { key: 'col-Partner', label: 'Partner Details', default: '#ffffff' },
  { key: 'col-price', label: 'Committed Price', default: '#ffffff' },
  { key: 'col-login', label: 'Login Date', default: '#ffff00' },
  { key: 'col-delay', label: 'Delay from Today', default: '#ffff00' },
  { key: 'col-install', label: 'Installation Date', default: '#ffff00' },
  { key: 'col-comm', label: 'Commission', default: '#ffff00' }
];

window.onDbReady = function () {
  UI.renderSidebar('installments.html');
  UI.renderTopbar('Client Tracker', 'Manage client installment payments, customer sales, and agent commissions', `
    <button class="btn btn-outline-secondary" id="btnPrintList">🖨 Print</button>
  `);

  document.getElementById('btnPrintList').addEventListener('click', () => window.print());

  const btnSaveCust = document.getElementById('btnSaveCustomer');
  if (btnSaveCust) btnSaveCust.addEventListener('click', saveCustomerModal);

  // Search & Filter listeners
  ['fSearch', 'fLoginFrom', 'fLoginTo'].forEach(id => {
    document.getElementById(id).addEventListener('input', Utils.debounce(renderList, 200));
    document.getElementById(id).addEventListener('change', renderList);
  });

  // Table header sorting listeners
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

  document.getElementById('btnClearFilters').addEventListener('click', () => {
    ['fSearch', 'fLoginFrom', 'fLoginTo'].forEach(id => document.getElementById(id).value = '');
    selectedDistricts = [];
    selectedBrands = [];
    document.querySelectorAll('.district-chk').forEach(c => c.checked = false);
    document.querySelectorAll('.brand-chk').forEach(c => c.checked = false);
    updateDistrictDropdownButton();
    updateBrandDropdownButton();
    renderList();
  });

  // Color Customizer listeners
  document.getElementById('ccColorPicker').addEventListener('input', (e) => {
    if (selectedColorCols.length === 0) {
      UI.toast('Please check at least one column from the dropdown first.', 'warning');
      return;
    }
    const color = e.target.value;
    const savedColors = JSON.parse(localStorage.getItem('installmentColColors') || '{}');
    selectedColorCols.forEach(col => {
      savedColors[col] = color;
    });
    localStorage.setItem('installmentColColors', JSON.stringify(savedColors));
    applyCustomStyles();
  });

  document.getElementById('btnResetColors').addEventListener('click', () => {
    localStorage.removeItem('installmentColColors');
    applyCustomStyles();
    updateColorPickerValue();
  });

  // Bi-directional click handlers on Sales Summary table rows
  const brandSummaryTbody = document.querySelector('#brandSummaryTable tbody');
  if (brandSummaryTbody) {
    brandSummaryTbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const brandVal = tr.getAttribute('data-brand');
      if (!brandVal) return;
      
      // If direct checkbox click, prevent browser default toggle to avoid double-triggering
      if (e.target.classList.contains('summary-brand-chk')) {
        e.preventDefault();
      }
      
      const idx = selectedBrands.indexOf(brandVal);
      if (idx > -1) {
        selectedBrands.splice(idx, 1);
      } else {
        selectedBrands.push(brandVal);
      }

      // Sync checkbox triggers at the top
      document.querySelectorAll('.brand-chk').forEach(chk => {
        chk.checked = selectedBrands.includes(chk.value);
      });
      updateBrandDropdownButton();
      renderList();
    });
  }

  const districtSummaryTbody = document.querySelector('#districtSummaryTable tbody');
  if (districtSummaryTbody) {
    districtSummaryTbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const distVal = tr.getAttribute('data-district');
      if (!distVal) return;

      // If direct checkbox click, prevent browser default toggle to avoid double-triggering
      if (e.target.classList.contains('summary-dist-chk')) {
        e.preventDefault();
      }

      const idx = selectedDistricts.indexOf(distVal);
      if (idx > -1) {
        selectedDistricts.splice(idx, 1);
      } else {
        selectedDistricts.push(distVal);
      }

      // Sync checkbox triggers at the top
      document.querySelectorAll('.district-chk').forEach(chk => {
        chk.checked = selectedDistricts.includes(chk.value);
      });
      updateDistrictDropdownButton();
      renderList();
    });
  }

  // Row selection click listener with Ctrl/Cmd key multi-select support
  document.querySelector('#installmentsTable tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || tr.classList.contains('no-print') || tr.classList.contains('grand-total')) return;
    
    // Ignore clicks inside input, select, button controls or actions td
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button') || e.target.closest('td.no-print') || e.target.closest('.no-print')) {
      return;
    }
    
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
      tr.classList.toggle('selected-row');
    } else {
      // Clear selections from all other rows
      document.querySelectorAll('#installmentsTable tbody tr').forEach(r => {
        if (r !== tr) r.classList.remove('selected-row');
      });
      tr.classList.toggle('selected-row');
    }
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

  const brandCollapseEl = document.getElementById('brandSummaryCollapse');
  if (brandCollapseEl) {
    brandCollapseEl.addEventListener('shown.bs.collapse', () => {
      document.getElementById('brandSummaryCollapseIndicator').textContent = '▲ Hide';
    });
    brandCollapseEl.addEventListener('hidden.bs.collapse', () => {
      document.getElementById('brandSummaryCollapseIndicator').textContent = '▼ Show';
    });
  }

  const distCollapseEl = document.getElementById('districtSummaryCollapse');
  if (distCollapseEl) {
    distCollapseEl.addEventListener('shown.bs.collapse', () => {
      document.getElementById('districtSummaryCollapseIndicator').textContent = '▲ Hide';
    });
    distCollapseEl.addEventListener('hidden.bs.collapse', () => {
      document.getElementById('districtSummaryCollapseIndicator').textContent = '▼ Show';
    });
  }

  // Apply column colors on boot
  applyCustomStyles();

  // Add Transaction button listener
  document.getElementById('btnAddTxn').addEventListener('click', async () => {
    const slNo = Number(document.getElementById('txnSlNo').value);
    const date = document.getElementById('newTxnDate').value;
    const amt = Number(document.getElementById('newTxnAmount').value) || 0;
    const remark = document.getElementById('newTxnRemark').value.trim();

    if (!date) {
      UI.toast('Please select a payment date.', 'danger');
      return;
    }
    if (amt <= 0) {
      UI.toast('Please enter an amount greater than 0.', 'danger');
      return;
    }

    UI.showLoading(true);
    try {
      const txn = {
        TxnID: Utils.uid('TXN'),
        SlNo: slNo,
        TxnDate: date,
        Amount: amt,
        Remark: remark
      };
      await DB.insert('installment_txns', txn);
      
      // Update customer installment Total
      await syncInstallmentTotal(slNo);
      
      // Reset inputs
      document.getElementById('newTxnAmount').value = '';
      document.getElementById('newTxnRemark').value = '';
      document.getElementById('newTxnDate').value = UI.todayISO();

      UI.toast('Payment added successfully.', 'success');
      showTransactionHistory(slNo);
    } catch (err) {
      UI.toast('Error adding payment: ' + err.message, 'danger');
    } finally {
      UI.showLoading(false);
    }
  });

  // Add Commission Transaction button listener
  document.getElementById('btnAddCommTxn').addEventListener('click', async () => {
    const slNo = Number(document.getElementById('commTxnSlNo').value);
    const date = document.getElementById('newCommTxnDate').value;
    const amt = Number(document.getElementById('newCommTxnAmount').value) || 0;
    const remark = document.getElementById('newCommTxnRemark').value.trim();

    if (!date) {
      UI.toast('Please select a payment date.', 'danger');
      return;
    }
    if (amt <= 0) {
      UI.toast('Please enter an amount greater than 0.', 'danger');
      return;
    }

    UI.showLoading(true);
    try {
      const txn = {
        TxnID: Utils.uid('TXN'),
        SlNo: slNo,
        TxnDate: date,
        Amount: amt,
        Remark: remark
      };
      await DB.insert('commission_txns', txn);
      
      // Update customer CommissionPaid Total
      await syncCommissionTotal(slNo);
      
      // Reset inputs
      document.getElementById('newCommTxnAmount').value = '';
      document.getElementById('newCommTxnRemark').value = '';
      document.getElementById('newCommTxnDate').value = UI.todayISO();

      UI.toast('Commission payment added successfully.', 'success');
      showCommissionHistory(slNo);
    } catch (err) {
      UI.toast('Error adding commission payment: ' + err.message, 'danger');
    } finally {
      UI.showLoading(false);
    }
  });

  // Add Note button listener
  document.getElementById('btnAddNote').addEventListener('click', async () => {
    const slNo = Number(document.getElementById('noteSlNo').value);
    const type = document.getElementById('newNoteType').value;
    const remark = document.getElementById('newNoteText').value.trim();

    if (!remark) {
      UI.toast('Please enter note text.', 'danger');
      return;
    }

    UI.showLoading(true);
    try {
      const note = {
        RemarkID: Utils.uid('RMK'),
        SlNo: slNo,
        Type: type,
        Remark: remark,
        CreatedAt: new Date().toISOString()
      };
      await DB.insert('installment_remarks', note);
      
      // Reset input
      document.getElementById('newNoteText').value = '';

      UI.toast('Note saved successfully.', 'success');
      showInstallmentNotes(slNo);
      renderList();
    } catch (err) {
      UI.toast('Error saving note: ' + err.message, 'danger');
    } finally {
      UI.showLoading(false);
    }
  });

  populateDatalists();
  populateColorColCheckboxes();
  updateSortHeadersUI();
  renderList();
};

function applyCustomStyles() {
  const savedColors = JSON.parse(localStorage.getItem('installmentColColors') || '{}');
  let styleText = '';
  
  COLORABLE_COLS.forEach(c => {
    const color = savedColors[c.key] !== undefined ? savedColors[c.key] : c.default;
    if (color && color !== '#ffffff') {
      styleText += `
        .table-installments td.${c.key} { background-color: ${color} !important; }
        @media print {
          .table-installments td.${c.key} { 
            background-color: ${color} !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `;
    } else {
      styleText += `
        .table-installments td.${c.key} { background-color: transparent !important; }
      `;
    }
  });

  let styleEl = document.getElementById('ccDynamicStyles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'ccDynamicStyles';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = styleText;
}

function updateSortHeadersUI() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.getAttribute('data-sort') === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function populateDatalists() {
  // 1. District multiselect menu
  const districtMenu = document.getElementById('districtMultiselectMenu');
  if (districtMenu) {
    districtMenu.innerHTML = [
      `<div class="form-check mb-1">
         <input class="form-check-input district-chk" type="checkbox" value="(No District)" id="chk_nodist" ${selectedDistricts.includes('(No District)') ? 'checked' : ''}>
         <label class="form-check-label w-100" for="chk_nodist">(No District)</label>
       </div>`
    ].concat(
      DISTRICTS.map(d => `
        <div class="form-check mb-1">
          <input class="form-check-input district-chk" type="checkbox" value="${d}" id="chk_${d}" ${selectedDistricts.includes(d) ? 'checked' : ''}>
          <label class="form-check-label w-100" for="chk_${d}">${d}</label>
        </div>
      `)
    ).join('');
    
    // Checkbox change listener
    document.querySelectorAll('.district-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        selectedDistricts = Array.from(document.querySelectorAll('.district-chk:checked')).map(c => c.value);
        updateDistrictDropdownButton();
        renderList();
      });
    });
  }
  updateDistrictDropdownButton();

  // 2. Brand multiselect menu (dynamically computed from database)
  const brandMenu = document.getElementById('brandMultiselectMenu');
  if (brandMenu) {
    const allRows = DB.getAll('installments');
    const rawBrands = allRows.map(r => r.CommittedBrand ? r.CommittedBrand.trim() : '').filter(Boolean);
    const uniqueBrands = [...new Set(rawBrands)].sort();
    
    brandMenu.innerHTML = [
      `<div class="form-check mb-1">
         <input class="form-check-input brand-chk" type="checkbox" value="(No Brand)" id="chk_nobrand" ${selectedBrands.includes('(No Brand)') ? 'checked' : ''}>
         <label class="form-check-label w-100" for="chk_nobrand">(No Brand)</label>
       </div>`
    ].concat(
      uniqueBrands.map(b => `
        <div class="form-check mb-1">
          <input class="form-check-input brand-chk" type="checkbox" value="${b}" id="chk_brand_${b.replace(/\s+/g, '_')}" ${selectedBrands.includes(b) ? 'checked' : ''}>
          <label class="form-check-label w-100" for="chk_brand_${b.replace(/\s+/g, '_')}">${b}</label>
        </div>
      `)
    ).join('');

    // Checkbox change listener
    document.querySelectorAll('.brand-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        selectedBrands = Array.from(document.querySelectorAll('.brand-chk:checked')).map(c => c.value);
        updateBrandDropdownButton();
        renderList();
      });
    });
  }
  updateBrandDropdownButton();
}

function populateColorColCheckboxes() {
  const menu = document.getElementById('ccColumnMultiselectMenu');
  if (!menu) return;
  menu.innerHTML = COLORABLE_COLS.map(c => `
    <div class="form-check mb-1">
      <input class="form-check-input color-col-chk" type="checkbox" value="${c.key}" id="col_chk_${c.key}" ${selectedColorCols.includes(c.key) ? 'checked' : ''}>
      <label class="form-check-label w-100" for="col_chk_${c.key}">${c.label}</label>
    </div>
  `).join('');
  
  // Add change listener
  document.querySelectorAll('.color-col-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      selectedColorCols = Array.from(document.querySelectorAll('.color-col-chk:checked')).map(c => c.value);
      updateColorColDropdownButton();
      updateColorPickerValue();
    });
  });
  updateColorColDropdownButton();
  updateColorPickerValue();
}

function updateColorColDropdownButton() {
  const btn = document.getElementById('btnColColorMultiselect');
  if (!btn) return;
  if (selectedColorCols.length === 0) {
    btn.textContent = 'Select Columns';
  } else if (selectedColorCols.length === 1) {
    const col = COLORABLE_COLS.find(c => c.key === selectedColorCols[0]);
    btn.textContent = col ? col.label : '1 Column';
  } else if (selectedColorCols.length === COLORABLE_COLS.length) {
    btn.textContent = 'All Columns';
  } else {
    btn.textContent = `${selectedColorCols.length} Columns`;
  }
}

function updateColorPickerValue() {
  const picker = document.getElementById('ccColorPicker');
  if (!picker) return;
  if (selectedColorCols.length === 0) {
    picker.value = '#ffffff';
    return;
  }
  // Show the color of the first checked column
  const colKey = selectedColorCols[0];
  const savedColors = JSON.parse(localStorage.getItem('installmentColColors') || '{}');
  const matched = COLORABLE_COLS.find(c => c.key === colKey);
  const defaultColor = matched ? matched.default : '#ffffff';
  const color = savedColors[colKey] !== undefined ? savedColors[colKey] : defaultColor;
  picker.value = color || '#ffffff';
}

function updateDistrictDropdownButton() {
  const btn = document.getElementById('btnDistrictMultiselect');
  if (!btn) return;
  if (selectedDistricts.length === 0) {
    btn.textContent = 'All Districts';
  } else if (selectedDistricts.length === 1) {
    btn.textContent = selectedDistricts[0];
  } else if (selectedDistricts.length === DISTRICTS.length) {
    btn.textContent = 'All Districts';
  } else {
    btn.textContent = `${selectedDistricts.length} Districts`;
  }
}

function updateBrandDropdownButton() {
  const btn = document.getElementById('btnBrandMultiselect');
  if (!btn) return;
  if (selectedBrands.length === 0) {
    btn.textContent = 'All Brands';
  } else if (selectedBrands.length === 1) {
    btn.textContent = selectedBrands[0];
  } else {
    btn.textContent = `${selectedBrands.length} Brands`;
  }
}

function fmtCurrency(val) {
  if (val === undefined || val === null || val === '' || Number(val) === 0) return '';
  return '₹' + Math.round(Number(val)).toLocaleString('en-IN');
}

function fmtGrandTotal(val) {
  return '₹' + Math.round(Number(val) || 0).toLocaleString('en-IN');
}

function fmtDateExcel(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function calculateDelay(loginDateStr) {
  if (!loginDateStr) return '';
  const loginDate = new Date(loginDateStr);
  if (isNaN(loginDate.getTime())) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  loginDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - loginDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + ' days';
}

function getRawDelayDays(dateStr) {
  if (!dateStr) return -999999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -999999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getInstallmentRows() {
  return DB.getAll('installments');
}

function fmtCommissionField(comm, commPaid) {
  if (!comm && !commPaid) return '';
  const cStr = fmtCurrency(comm) || '₹0';
  if (commPaid) {
    return `${cStr} (-${fmtCurrency(commPaid)})`;
  }
  return cStr;
}

function fmtPriceField(price, totalPaid) {
  if (!price && !totalPaid) return '';
  const pStr = fmtCurrency(price) || '₹0';
  if (totalPaid) {
    return `${pStr} (-${fmtCurrency(totalPaid)})`;
  }
  return pStr;
}

function getTxnDiffBadge(price, totalPaid) {
  const diff = totalPaid - price; // totalPaid - price. negative means paid less
  if (diff < 0) {
    return `<span class="text-danger fw-bold" style="font-size: 0.65rem;">(-₹${Math.abs(diff).toLocaleString('en-IN')})</span>`;
  } else if (diff > 0) {
    return `<span class="text-primary fw-bold" style="font-size: 0.65rem;">(+₹${Math.abs(diff).toLocaleString('en-IN')})</span>`;
  } else {
    return `<span class="text-success fw-bold" style="font-size: 0.65rem;">(₹0)</span>`;
  }
}

function getCommDiffBadge(comm, commPaid) {
  const diff = commPaid - comm; // commPaid - comm. negative means paid less
  if (diff < 0) {
    return `<span class="text-danger fw-bold" style="font-size: 0.65rem;">(-₹${Math.abs(diff).toLocaleString('en-IN')})</span>`;
  } else if (diff > 0) {
    return `<span class="text-primary fw-bold" style="font-size: 0.65rem;">(+₹${Math.abs(diff).toLocaleString('en-IN')})</span>`;
  } else {
    return `<span class="text-success fw-bold" style="font-size: 0.65rem;">(₹0)</span>`;
  }
}

function renderList() {
  const search = (document.getElementById('fSearch').value || '').toLowerCase();
  const loginFrom = document.getElementById('fLoginFrom').value;
  const loginTo = document.getElementById('fLoginTo').value;

  let rows = getInstallmentRows();

  // Apply search
  if (search) {
    rows = rows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search)
    );
  }
  // Apply multiselect District Filter
  if (selectedDistricts.length > 0) {
    rows = rows.filter(r => {
      const distVal = r.District ? r.District.trim() : '(No District)';
      const distName = distVal === '' ? '(No District)' : distVal;
      return selectedDistricts.includes(distName);
    });
  }
  // Apply multiselect Brand Filter
  if (selectedBrands.length > 0) {
    rows = rows.filter(r => {
      const brandVal = r.CommittedBrand ? r.CommittedBrand.trim() : '(No Brand)';
      const brandName = brandVal === '' ? '(No Brand)' : brandVal;
      return selectedBrands.includes(brandName);
    });
  }

  // Apply Date Range filters
  if (loginFrom) {
    rows = rows.filter(r => r.LoginDate && r.LoginDate >= loginFrom);
  }
  if (loginTo) {
    rows = rows.filter(r => r.LoginDate && r.LoginDate <= loginTo);
  }

  // Apply sort
  rows.sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (sortCol === 'Delay') {
      aVal = getRawDelayDays(a.LoginDate);
      bVal = getRawDelayDays(b.LoginDate);
    } else if (sortCol === 'LoginDate' || sortCol === 'InstallationDate') {
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

  // If adding a new row, append a blank record structure to the end of rows array
  if (isAddingNew) {
    rows.push({
      SlNo: editingSlNo,
      Name: '',
      Status: 'Active',
      District: '',
      Address: '',
      MobileNumber: '',
      CommittedBrand: '',
      FirstInstallment: 0,
      SecondInstallment: 0,
      ThirdInstallment: 0,
      Total: 0,
      CommittedPrice: 0,
      LoginDate: UI.todayISO(),
      InstallationDate: '',
      Commission: 0,
      CommissionPaid: 0,
      BrokerName: '',
      BrokerNumber: '',
      CommissioningDate: ''
    });
  }

  const tbody = document.querySelector('#installmentsTable tbody');
  
  if (!rows.length && !isAddingNew) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No records found. Click "+" at the bottom to add one.</td></tr>`;
    const tfoot = document.querySelector('#installmentsTable tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="add-row-sticky no-print" onclick="openCustomerModal()" style="cursor:pointer; height:37px;">
          <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
          <td colspan="7" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new customer installment record...</td>
        </tr>
        <tr class="grand-total" style="height:37px;">
          <td class="text-center">0</td>
          <td colspan="2">GRAND TOTAL</td>
          <td colspan="5"></td>
        </tr>
      `;
    }
    renderSalesSummary([]);
    return;
  }

  // Compute Grand Totals
  let sumTotal = 0;
  let sumPrice = 0;
  let sumComm = 0;
  let sumCommPaid = 0;

  tbody.innerHTML = rows.map((r) => {
    const isEditing = (Number(r.SlNo) === Number(editingSlNo));
    const isDeactive = (r.Status === 'Deactive');
    
    // We sum all transactions from local cache where SlNo matches r.SlNo
    const txns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(r.SlNo));
    const total = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
    const price = Number(r.CommittedPrice) || 0;
    const comm = Number(r.Commission) || 0;
    const commPaid = Number(r.CommissionPaid) || 0;

    // Do not sum the dummy record or any deactivated records
    if (!isDeactive && (!isAddingNew || Number(r.SlNo) !== Number(editingSlNo))) {
      sumTotal += total;
      sumPrice += price;
      sumComm += comm;
      sumCommPaid += commPaid;
    }

    const delayStr = calculateDelay(r.LoginDate);

    if (isEditing) {
      // Render input fields for inline editing
      return `
        <tr class="table-warning">
          <td class="text-center fw-semibold align-middle">${r.SlNo}</td>
          <td>
            <div class="d-flex flex-column gap-1">
              <input type="text" class="form-control form-control-sm" id="editName" value="${r.Name || ''}" placeholder="Name *" required>
              <input type="text" class="form-control form-control-sm" id="editMobileNumber" value="${r.MobileNumber || ''}" placeholder="Mobile">
              <input type="text" class="form-control form-control-sm" id="editCommittedBrand" value="${r.CommittedBrand || ''}" placeholder="Brand">
            </div>
          </td>
          <td>
            <div class="d-flex flex-column gap-1">
              <select class="form-select form-select-sm" id="editDistrict">
                <option value="">-- Select --</option>
                ${DISTRICTS.map(d => `<option value="${d}" ${r.District === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
              <input type="text" class="form-control form-control-sm" id="editAddress" value="${r.Address || ''}" placeholder="Address">
            </div>
          </td>
          <td class="col-Partner">
            <div class="d-flex flex-column gap-1">
              <div class="dropdown">
                <input type="text" class="form-control form-control-sm" id="editBrokerName" value="${r.BrokerName || ''}" placeholder="Partner Name" autocomplete="off">
              </div>
              <input type="text" class="form-control form-control-sm" id="editBrokerNumber" value="${r.BrokerNumber || ''}" placeholder="Partner Phone">
              <input type="number" step="0.01" class="form-control form-control-sm" id="editCommission" value="${comm || ''}" placeholder="Comm Amt">
            </div>
          </td>
          <td class="col-price"><input type="number" step="0.01" class="form-control form-control-sm" id="editCommittedPrice" value="${price || ''}" placeholder="Price"></td>
          <td class="col-login">
            <div class="d-flex flex-column gap-1">
              <input type="date" class="form-control form-control-sm" id="editLoginDate" value="${r.LoginDate ? new Date(r.LoginDate).toISOString().split('T')[0] : ''}">
              <div class="text-center fw-medium text-muted" id="editDelay" style="font-size:0.72rem;">${delayStr}</div>
            </div>
          </td>
          <td class="col-install">
            <div class="d-flex flex-column gap-1">
              <input type="date" class="form-control form-control-sm" id="editInstallationDate" value="${r.InstallationDate ? new Date(r.InstallationDate).toISOString().split('T')[0] : ''}" placeholder="Install Date">
              <input type="date" class="form-control form-control-sm" id="editCommissioningDate" value="${r.CommissioningDate ? new Date(r.CommissioningDate).toISOString().split('T')[0] : ''}" placeholder="Commission Date">
            </div>
          </td>
          <td class="no-print text-center align-middle">
            <div class="d-flex gap-1 justify-content-center">
              <button class="btn btn-sm btn-success py-0 px-2" onclick="saveInline(${r.SlNo})" title="Save">💾</button>
              <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="cancelInline()" title="Cancel">✕</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      // Render normal static row
      return `
        <tr class="${isDeactive ? 'deactive-row' : ''}">
          <td class="text-center fw-semibold">${r.SlNo}</td>
          <td>
            <div class="d-flex flex-column align-items-start" style="font-size: 0.85rem; gap: 2px;">
              <span class="fw-semibold text-dark">${r.Name || ''}</span>
              <span class="text-muted" style="font-size: 0.75rem;">${r.MobileNumber || ''}</span>
              ${(() => {
                const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(r.SlNo));
                const remarksCount = remarks.length;
                return `
                  <div class="d-flex align-items-center gap-2 mt-1">
                    ${r.CommittedBrand ? `<span class="badge bg-primary-subtle text-primary-emphasis fw-medium font-sans" style="font-size: 0.65rem; padding: 2px 4px; border-radius: 4px;">${r.CommittedBrand}</span>` : ''}
                    <button type="button" class="btn p-0 border-0 bg-transparent btn-note position-relative" onclick="showInstallmentNotes(${r.SlNo})" title="Notes/Remarks (${remarksCount} added)" style="font-size: 0.95rem; line-height: 1;">
                      📝
                      ${remarksCount > 0 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.55rem; padding: 2px 4px; border: 1px solid #fff;">${remarksCount}</span>` : ''}
                    </button>
                  </div>
                `;
              })()}
            </div>
          </td>
          <td>
            <div class="d-flex flex-column" style="font-size: 0.82rem; gap: 1px;">
              <span class="fw-semibold text-dark">${r.District || '—'}</span>
              <span class="text-muted" style="font-size: 0.72rem;">${r.Address || ''}</span>
            </div>
          </td>
          <td class="col-Partner text-end">
            <div class="d-flex flex-column align-items-start" style="font-size: 0.8rem; gap: 1px;">
              <span class="fw-semibold text-dark">${r.BrokerName || '—'}</span>
              <span class="text-muted" style="font-size: 0.72rem;">${r.BrokerNumber || ''}</span>
              <button class="btn btn-xs btn-outline-secondary mt-1 no-print font-monospace" onclick="showCommissionHistory(${r.SlNo})" style="font-size:0.68rem; padding:2px 6px; border-color: #ccc; white-space: nowrap;">
                Commission ${getCommDiffBadge(comm, commPaid)}
              </button>
            </div>
          </td>
          <td class="col-price text-end">
            <div class="d-flex flex-column align-items-end" style="gap:2px;">
              <span class="fw-semibold text-dark font-monospace">${fmtPriceField(price, total)}</span>
              <button class="btn btn-xs btn-outline-secondary mt-1 no-print font-monospace" onclick="showTransactionHistory(${r.SlNo})" style="font-size:0.68rem; padding:2px 6px; border-color: #ccc; white-space: nowrap;">
                Transaction ${getTxnDiffBadge(price, total)}
              </button>
            </div>
          </td>
          <td class="col-login text-center">
            <div class="d-flex flex-column align-items-center" style="font-size: 0.82rem; gap: 1px;">
              <span>${fmtDateExcel(r.LoginDate)}</span>
              <span class="text-muted fw-semibold" style="font-size: 0.72rem;">${delayStr}</span>
            </div>
          </td>
          <td class="col-install text-center">
            <div class="d-flex flex-column align-items-center" style="font-size: 0.82rem; gap: 1px;">
              <span class="fw-semibold text-dark" title="Installation Date">${fmtDateExcel(r.InstallationDate) || '—'}</span>
              <span class="text-muted" style="font-size: 0.72rem;" title="Commissioning Date">${fmtDateExcel(r.CommissioningDate) || '—'}</span>
            </div>
          </td>
          <td class="no-print text-center">
            <div class="d-flex gap-1 justify-content-center">
              ${isDeactive ? `
                <button class="btn btn-sm btn-outline-success py-0 px-1" onclick="restoreRow(${r.SlNo})" title="Restore">↻</button>
              ` : `
                <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="editRow(${r.SlNo})" title="Edit">✎</button>
                <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="deleteRow(${r.SlNo})" title="Deactivate">🗑</button>
              `}
            </div>
          </td>
        </tr>
      `;
    }
  }).join('');

  // Set GRAND TOTAL and sticky add row in tfoot
  const activeCount = rows.filter(r => r.Status !== 'Deactive').length;
  const tfoot = document.querySelector('#installmentsTable tfoot');
  if (tfoot) {
    let tfootHTML = '';
    
    // Add row is rendered inside tfoot sitting on top of grand total (using bottom: 37px offset)
    if (!isAddingNew) {
      tfootHTML += `
        <tr class="add-row-sticky no-print" onclick="openCustomerModal()" style="cursor:pointer; height:37px;">
          <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
          <td colspan="7" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new customer installment record...</td>
        </tr>
      `;
    }
    
    tfootHTML += `
      <tr class="grand-total" style="height:37px;">
        <td class="text-center">${isAddingNew ? activeCount - 1 : activeCount}</td>
        <td colspan="2">GRAND TOTAL</td>
        <td class="text-end fw-bold font-monospace" style="font-size:0.8rem;">
          ${fmtGrandTotal(sumComm)} <span class="text-danger fs-7">(-${fmtGrandTotal(sumCommPaid)})</span>
        </td>
        <td class="text-end fw-bold font-monospace" style="font-size:0.8rem;">
          ${fmtGrandTotal(sumPrice)} <span class="text-danger fs-7">(-${fmtGrandTotal(sumTotal)})</span>
        </td>
        <td></td>
        <td></td>
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

  // Bind dynamic inputs calculation listeners for active editing row
  bindEditRowListeners();

  // Render Brand-wise and District-wise aggregate reports dynamically
  renderSalesSummary(rows);
}

function bindEditRowListeners() {
  if (editingSlNo === null) return;

  const dateInput = document.getElementById('editLoginDate');
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      document.getElementById('editDelay').textContent = calculateDelay(dateInput.value);
    });
  }

  const editBrokerNameInput = document.getElementById('editBrokerName');
  if (editBrokerNameInput) {
    const vendors = DB.getAll('vendors');
    Utils.initSearchableDropdown('editBrokerName', vendors.map(v => v.VendorName), (selectedBrokerName) => {
      const found = vendors.find(v => v.VendorName === selectedBrokerName);
      if (found && found.Phone) {
        const editBrokerPhoneInput = document.getElementById('editBrokerNumber');
        if (editBrokerPhoneInput) {
          editBrokerPhoneInput.value = found.Phone;
          // Dispatch change event to trigger any validation/listeners
          editBrokerPhoneInput.dispatchEvent(new Event('input', { bubbles: true }));
          editBrokerPhoneInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }
}

function renderSalesSummary(filteredRows) {
  const activeRows = DB.getAll('installments').filter(r => r.Status !== 'Deactive' && Number(r.SlNo) !== Number(editingSlNo));

  // 1. Brand-wise Sale
  const brandMap = {};
  activeRows.forEach(r => {
    const brand = r.CommittedBrand ? r.CommittedBrand.trim() : '(No Brand)';
    const brandName = brand === '' ? '(No Brand)' : brand;
    if (!brandMap[brandName]) {
      brandMap[brandName] = 0;
    }
    brandMap[brandName]++;
  });

  const brandTbody = document.querySelector('#brandSummaryTable tbody');
  if (brandTbody) {
    const brands = Object.keys(brandMap).sort();
    if (brands.length === 0) {
      brandTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-3">No active brand sales.</td></tr>`;
    } else {
      brandTbody.innerHTML = brands.map(b => {
        const isSelected = selectedBrands.includes(b);
        return `
          <tr class="${isSelected ? 'table-primary fw-bold' : ''}" data-brand="${b}" style="cursor:pointer;">
            <td>
              <div class="form-check mb-0">
                <input class="form-check-input summary-brand-chk" type="checkbox" value="${b}" id="sum_chk_brand_${b.replace(/\s+/g, '_')}" ${isSelected ? 'checked' : ''}>
                <label class="form-check-label w-100" for="sum_chk_brand_${b.replace(/\s+/g, '_')}">${b}</label>
              </div>
            </td>
            <td class="text-center">${brandMap[b]}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2. District-wise Sale (only for districts with customers)
  const distMap = {};
  activeRows.forEach(r => {
    const dist = r.District ? r.District.trim() : '(No District)';
    const distName = dist === '' ? '(No District)' : dist;
    if (!distMap[distName]) {
      distMap[distName] = 0;
    }
    distMap[distName]++;
  });

  const distTbody = document.querySelector('#districtSummaryTable tbody');
  if (distTbody) {
    const districts = Object.keys(distMap).sort();
    if (districts.length === 0) {
      distTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-3">No active district sales.</td></tr>`;
    } else {
      distTbody.innerHTML = districts.map(d => {
        const isSelected = selectedDistricts.includes(d);
        return `
          <tr class="${isSelected ? 'table-primary fw-bold' : ''}" data-district="${d}" style="cursor:pointer;">
            <td>
              <div class="form-check mb-0">
                <input class="form-check-input summary-dist-chk" type="checkbox" value="${d}" id="sum_chk_dist_${d.replace(/\s+/g, '_')}" ${isSelected ? 'checked' : ''}>
                <label class="form-check-label w-100" for="sum_chk_dist_${d.replace(/\s+/g, '_')}">${d}</label>
              </div>
            </td>
            <td class="text-center">${distMap[d]}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

window.addInlineRow = function () {
  if (editingSlNo !== null) {
    UI.toast('Please save or cancel your current edit first.', 'warning');
    return;
  }
  isAddingNew = true;
  editingSlNo = nextSlNo();
  renderList();
  
  const nameInput = document.getElementById('editName');
  if (nameInput) nameInput.focus();
};

window.editRow = function (slNo) {
  if (editingSlNo !== null) {
    UI.toast('Please save or cancel your current edit first.', 'warning');
    return;
  }
  editingSlNo = slNo;
  isAddingNew = false;
  renderList();
  
  const nameInput = document.getElementById('editName');
  if (nameInput) nameInput.focus();
};

window.cancelInline = function () {
  editingSlNo = null;
  isAddingNew = false;
  renderList();
};

window.saveInline = async function (slNo) {
  const nameInput = document.getElementById('editName');
  const name = nameInput.value.trim();
  if (!name) {
    UI.toast('Customer Name is required.', 'danger');
    nameInput.focus();
    return;
  }

  const currentRecords = DB.getAll('installments');
  const existing = currentRecords.find(x => Number(x.SlNo) === Number(slNo));
  const currentStatus = existing ? existing.Status : 'Active';

  const fInst = existing ? (Number(existing.FirstInstallment) || 0) : 0;
  const sInst = existing ? (Number(existing.SecondInstallment) || 0) : 0;
  const tInst = existing ? (Number(existing.ThirdInstallment) || 0) : 0;
  const total = fInst + sInst + tInst;

  const row = {
    SlNo: Number(slNo),
    Name: name,
    Status: isAddingNew ? 'Active' : currentStatus,
    District: document.getElementById('editDistrict').value,
    Address: document.getElementById('editAddress').value.trim(),
    MobileNumber: document.getElementById('editMobileNumber').value.trim(),
    CommittedBrand: document.getElementById('editCommittedBrand').value.trim(),
    FirstInstallment: fInst,
    SecondInstallment: sInst,
    ThirdInstallment: tInst,
    Total: total,
    CommittedPrice: Number(document.getElementById('editCommittedPrice').value) || 0,
    LoginDate: document.getElementById('editLoginDate').value,
    InstallationDate: document.getElementById('editInstallationDate').value,
    Commission: Number(document.getElementById('editCommission').value) || 0,
    CommissionPaid: existing ? (Number(existing.CommissionPaid) || 0) : 0,
    BrokerName: document.getElementById('editBrokerName').value.trim(),
    BrokerNumber: document.getElementById('editBrokerNumber').value.trim(),
    CommissioningDate: document.getElementById('editCommissioningDate').value
  };

  UI.showLoading(true);
  try {
    if (isAddingNew) {
      await DB.insert('installments', row);
      UI.toast('Record added successfully.', 'success');
    } else {
      await DB.update('installments', r => Number(r.SlNo) === Number(slNo), row);
      UI.toast('Record updated successfully.', 'success');
    }
    editingSlNo = null;
    isAddingNew = false;
  } catch (err) {
    UI.toast('Error saving record: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }

  populateDatalists();
  renderList();
};

window.deleteRow = async function (slNo) {
  if (editingSlNo !== null) {
    UI.toast('Please save or cancel your current edit first.', 'warning');
    return;
  }
  
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  const desc = r ? `${r.Name}${r.Address || r.District ? ' (' + [r.Address, r.District].filter(Boolean).join(', ') + ')' : ''}` : `Sl No. ${slNo}`;

  const ok = await UI.confirmDialog(`Are you sure you want to deactivate customer ${desc}?`, 'Confirm Deactivation', 'Deactivate', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), { Status: 'Deactive' });
    UI.toast('Customer deactivated successfully.', 'success');
  } catch (err) {
    UI.toast('Error deactivating: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
  populateDatalists();
  renderList();
};

window.restoreRow = async function (slNo) {
  if (editingSlNo !== null) {
    UI.toast('Please save or cancel your current edit first.', 'warning');
    return;
  }
  
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  const desc = r ? `${r.Name}${r.Address || r.District ? ' (' + [r.Address, r.District].filter(Boolean).join(', ') + ')' : ''}` : `Sl No. ${slNo}`;

  const ok = await UI.confirmDialog(`Are you sure you want to reactivate customer ${desc}?`, 'Confirm Activation', 'Restore', 'btn-success');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), { Status: 'Active' });
    UI.toast('Customer reactivated successfully.', 'success');
  } catch (err) {
    UI.toast('Error reactivating: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
  populateDatalists();
  renderList();
};

function nextSlNo() {
  const rows = DB.getAll('installments');
  let max = 0;
  rows.forEach(r => {
    const val = parseInt(r.SlNo, 10);
    if (!isNaN(val)) max = Math.max(max, val);
  });
  return max + 1;
}

async function syncInstallmentTotal(slNo) {
  const txns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(slNo));
  const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  
  const existing = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (existing) {
    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), {
      ...existing,
      Total: sum
    });
  }
}

window.deleteInstallmentTxn = async function(txnId) {
  const txn = DB.getAll('installment_txns').find(t => t.TxnID === txnId);
  if (!txn) return;
  const slNo = txn.SlNo;

  const ok = await UI.confirmDialog(`Delete this payment of ₹${Number(txn.Amount).toLocaleString('en-IN')}?`, 'Delete Payment', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installment_txns', t => t.TxnID === txnId);
    await syncInstallmentTotal(slNo);
    UI.toast('Payment deleted successfully.', 'success');
    showTransactionHistory(slNo);
  } catch (err) {
    UI.toast('Error deleting payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.showTransactionHistory = function(slNo) {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('txnSlNo').value = slNo;
  document.getElementById('newTxnDate').value = UI.todayISO();
  document.getElementById('newTxnAmount').value = '';
  document.getElementById('newTxnRemark').value = '';

  // Set the title to include customer name
  document.getElementById('txnModalLabel').textContent = `Installments — ${r.Name}`;

  // Fetch and display transaction history
  const txns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(slNo));
  // Sort transactions by date (oldest first for chat feed feel)
  txns.sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate));

  const feed = document.getElementById('txnHistoryFeed');
  if (txns.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No payments recorded yet.</div>`;
  } else {
    feed.innerHTML = txns.map(t => `
      <div class="p-2 rounded border bg-white shadow-sm d-flex justify-content-between align-items-start" style="font-size: 0.8rem;">
        <div class="d-flex flex-column gap-1">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-bold text-dark font-monospace">₹${Math.round(Number(t.Amount)).toLocaleString('en-IN')}</span>
            <span class="badge bg-secondary-subtle text-secondary-emphasis font-monospace" style="font-size: 0.65rem;">${fmtDateExcel(t.TxnDate)}</span>
          </div>
          ${t.Remark ? `<div class="text-secondary fs-8 italic-style" style="font-style: italic;">Remark: ${t.Remark}</div>` : ''}
        </div>
        <button type="button" class="btn btn-link text-danger p-0 border-0 fs-7 line-height-1" onclick="deleteInstallmentTxn('${t.TxnID}')" title="Delete Payment" style="text-decoration: none; font-weight: bold; line-height: 1;">✕</button>
      </div>
    `).join('');
  }

  // Update total label
  updateTxnModalTotal();

  // Show modal
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('transactionModal'));
  modal.show();
};

function updateTxnModalTotal() {
  const slNo = Number(document.getElementById('txnSlNo').value);
  const txns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(slNo));
  const total = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  document.getElementById('lblTxnTotal').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
}

async function syncCommissionTotal(slNo) {
  const txns = DB.getAll('commission_txns').filter(t => Number(t.SlNo) === Number(slNo));
  const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  
  const existing = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (existing) {
    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), {
      ...existing,
      CommissionPaid: sum
    });
  }
}

window.deleteCommissionTxn = async function(txnId) {
  const txn = DB.getAll('commission_txns').find(t => t.TxnID === txnId);
  if (!txn) return;
  const slNo = txn.SlNo;

  const ok = await UI.confirmDialog(`Delete this payment of ₹${Number(txn.Amount).toLocaleString('en-IN')}?`, 'Delete Commission Payment', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('commission_txns', t => t.TxnID === txnId);
    await syncCommissionTotal(slNo);
    UI.toast('Commission payment deleted successfully.', 'success');
    showCommissionHistory(slNo);
  } catch (err) {
    UI.toast('Error deleting commission payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.showCommissionHistory = function(slNo) {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('commTxnSlNo').value = slNo;
  document.getElementById('newCommTxnDate').value = UI.todayISO();
  document.getElementById('newCommTxnAmount').value = '';
  document.getElementById('newCommTxnRemark').value = '';

  // Set the title to include Partner name
  const brokerName = r.BrokerName || r.Name || 'Partner';
  document.getElementById('commModalLabel').textContent = `Commission Payments — ${brokerName}`;

  // Fetch and display transaction history
  const txns = DB.getAll('commission_txns').filter(t => Number(t.SlNo) === Number(slNo));
  // Sort transactions by date (oldest first for chat feed feel)
  txns.sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate));

  const feed = document.getElementById('commHistoryFeed');
  if (txns.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No payments recorded yet.</div>`;
  } else {
    feed.innerHTML = txns.map(t => `
      <div class="p-2 rounded border bg-white shadow-sm d-flex justify-content-between align-items-start" style="font-size: 0.8rem;">
        <div class="d-flex flex-column gap-1">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-bold text-success font-monospace">₹${Math.round(Number(t.Amount)).toLocaleString('en-IN')}</span>
            <span class="badge bg-secondary-subtle text-secondary-emphasis font-monospace" style="font-size: 0.65rem;">${fmtDateExcel(t.TxnDate)}</span>
          </div>
          ${t.Remark ? `<div class="text-secondary fs-8 italic-style" style="font-style: italic;">Remark: ${t.Remark}</div>` : ''}
        </div>
        <button type="button" class="btn btn-link text-danger p-0 border-0 fs-7 line-height-1" onclick="deleteCommissionTxn('${t.TxnID}')" title="Delete Payment" style="text-decoration: none; font-weight: bold; line-height: 1;">✕</button>
      </div>
    `).join('');
  }

  // Update total label
  updateCommModalTotal();

  // Show modal
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commissionModal'));
  modal.show();
};

function updateCommModalTotal() {
  const slNo = Number(document.getElementById('commTxnSlNo').value);
  const txns = DB.getAll('commission_txns').filter(t => Number(t.SlNo) === Number(slNo));
  const total = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  document.getElementById('lblCommTxnTotal').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
}

window.showInstallmentNotes = function(slNo) {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('noteSlNo').value = slNo;
  document.getElementById('newNoteText').value = '';
  document.getElementById('newNoteType').value = 'Customer';

  document.getElementById('notesModalLabel').textContent = `Notes & Remarks — ${r.Name}`;

  const remarks = DB.getAll('installment_remarks').filter(t => Number(t.SlNo) === Number(slNo));
  remarks.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

  const feed = document.getElementById('notesHistoryFeed');
  if (remarks.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No remarks recorded yet.</div>`;
  } else {
    feed.innerHTML = remarks.map(t => {
      const typeBadgeClass = t.Type === 'Customer' ? 'bg-primary-subtle text-primary-emphasis' : 'bg-warning-subtle text-warning-emphasis';
      const cardTypeClass = t.Type === 'Customer' ? 'note-card-customer' : 'note-card-Partner';
      
      let formattedDate = '';
      try {
        const dt = new Date(t.CreatedAt);
        const datePart = fmtDateExcel(dt);
        const timePart = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        formattedDate = `${datePart} ${timePart}`;
      } catch (e) {
        formattedDate = t.CreatedAt;
      }

      return `
        <div class="note-card ${cardTypeClass} d-flex justify-content-between align-items-start gap-2">
          <div class="d-flex flex-column gap-1 w-100">
            <div class="d-flex align-items-center gap-2 justify-content-between">
              <span class="note-type-badge ${typeBadgeClass}">${t.Type} Specific</span>
              <span class="note-timestamp">${formattedDate}</span>
            </div>
            <div class="note-text">${t.Remark}</div>
          </div>
          <button type="button" class="btn btn-link text-danger p-0 border-0 fs-7 line-height-1" onclick="deleteInstallmentNote('${t.RemarkID}')" title="Delete Note" style="text-decoration: none; font-weight: bold; line-height: 1; margin-top: 1px;">✕</button>
        </div>
      `;
    }).join('');
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('notesModal'));
  modal.show();
};

window.deleteInstallmentNote = async function(remarkId) {
  const remark = DB.getAll('installment_remarks').find(t => t.RemarkID === remarkId);
  if (!remark) return;
  const slNo = remark.SlNo;

  const ok = await UI.confirmDialog(`Are you sure you want to delete this remark?`, 'Delete Note', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installment_remarks', t => t.RemarkID === remarkId);
    UI.toast('Note deleted successfully.', 'success');
    showInstallmentNotes(slNo);
    renderList();
  } catch (err) {
    UI.toast('Error deleting note: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.openCustomerModal = function(slNo) {
  const modalEl = document.getElementById('customerModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  document.getElementById('customerModalTitle').textContent = slNo ? 'Edit Customer Record' : 'Add New Customer Record';
  document.getElementById('cSlNo').value = slNo || '';

  const distSelect = document.getElementById('cDistrict');
  if (distSelect) {
    distSelect.innerHTML = '<option value="">-- Select District --</option>' + DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  if (slNo) {
    const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
    if (r) {
      document.getElementById('cName').value = r.Name || '';
      document.getElementById('cMobile').value = r.MobileNumber || '';
      document.getElementById('cDistrict').value = r.District || '';
      document.getElementById('cAddress').value = r.Address || '';
      document.getElementById('cBrand').value = r.CommittedBrand || '';
      document.getElementById('cPrice').value = r.CommittedPrice || '';
      document.getElementById('cLoginDate').value = r.LoginDate ? new Date(r.LoginDate).toISOString().slice(0, 10) : '';
      document.getElementById('cInstallationDate').value = r.InstallationDate ? new Date(r.InstallationDate).toISOString().slice(0, 10) : '';
      document.getElementById('cBrokerName').value = r.BrokerName || '';
      document.getElementById('cBrokerNumber').value = r.BrokerNumber || '';
      document.getElementById('cCommission').value = r.Commission || '';
    }
  } else {
    ['cName', 'cMobile', 'cAddress', 'cBrand', 'cPrice', 'cLoginDate', 'cInstallationDate', 'cBrokerName', 'cBrokerNumber', 'cCommission'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('cDistrict').value = '';
    document.getElementById('cLoginDate').value = UI.todayISO();
  }

  const vendors = DB.getAll('vendors');
  Utils.initSearchableDropdown('cBrokerName', vendors.map(v => v.VendorName), (selectedBrokerName) => {
    const found = vendors.find(v => v.VendorName === selectedBrokerName);
    if (found && found.Phone) {
      const cBrokerNumberInput = document.getElementById('cBrokerNumber');
      if (cBrokerNumberInput) {
        cBrokerNumberInput.value = found.Phone;
      }
    }
  });
  const brokerInput = document.getElementById('cBrokerName');
  if (brokerInput && brokerInput.updateOptionsList) {
    brokerInput.updateOptionsList(vendors.map(v => v.VendorName));
  }

  modal.show();
};

async function saveCustomerModal() {
  const slNoVal = document.getElementById('cSlNo').value;
  const name = document.getElementById('cName').value.trim();

  if (!name) {
    UI.toast('Customer Name is required.', 'danger');
    document.getElementById('cName').focus();
    return;
  }

  const rowData = {
    Name: name,
    MobileNumber: document.getElementById('cMobile').value.trim(),
    District: document.getElementById('cDistrict').value,
    Address: document.getElementById('cAddress').value.trim(),
    CommittedBrand: document.getElementById('cBrand').value.trim(),
    CommittedPrice: Number(document.getElementById('cPrice').value) || 0,
    LoginDate: document.getElementById('cLoginDate').value || null,
    InstallationDate: document.getElementById('cInstallationDate').value || null,
    BrokerName: document.getElementById('cBrokerName').value.trim(),
    BrokerNumber: document.getElementById('cBrokerNumber').value.trim(),
    Commission: Number(document.getElementById('cCommission').value) || 0
  };

  UI.showLoading(true);
  try {
    if (slNoVal) {
      const slNo = Number(slNoVal);
      await DB.update('installments', r => Number(r.SlNo) === slNo, rowData);
      UI.toast('Customer record updated.', 'success');
    } else {
      const allRows = DB.getAll('installments');
      const maxSl = allRows.reduce((max, r) => Math.max(max, Number(r.SlNo) || 0), 0);
      rowData.SlNo = maxSl + 1;
      rowData.Status = 'Active';
      rowData.FirstInstallment = 0;
      rowData.SecondInstallment = 0;
      rowData.ThirdInstallment = 0;
      rowData.Total = 0;
      rowData.CommissionPaid = 0;
      rowData.CommissioningDate = '';
      await DB.insert('installments', rowData);
      UI.toast('New Customer record added.', 'success');
    }

    const modalEl = document.getElementById('customerModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    renderList();
  } catch (err) {
    UI.toast('Error saving customer: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}
