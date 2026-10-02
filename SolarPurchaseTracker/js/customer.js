/* =========================================================================
   installments.js — Installment & Commission Tracker Logic (Inline Editing)
   ========================================================================= */

let editingSlNo = null;  // SlNo of row currently being edited
let isAddingNew = false; // true if we are adding a brand new row

let sortCol = 'SlNo'; // default sort column
let sortDir = 'asc';  // default sort direction

let selectedDistricts = []; // Array of currently selected districts for filtering
let selectedBrands = [];    // Array of currently selected brands for filtering
let selectedPartners = [];  // Array of currently selected partners for filtering
let selectedColorCols = []; // Array of column keys currently checked in custom coloring menu

const DISTRICTS = [
  'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
  'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
  'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Khordha',
  'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada',
  'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'
];

const DEFAULT_COLUMN_COLORS = [
  { key: 'col-sl', label: 'Sl.', default: '#ffffff' },
  { key: 'col-customer', label: 'Customer', default: '#ffffff' },
  { key: 'col-payment', label: 'Payment', default: '#ffffff' },
  { key: 'col-partner', label: 'Partner', default: '#ffffff' },
  { key: 'col-price', label: 'Total expense', default: '#ffffff' },
  { key: 'col-actions', label: 'Actions', default: '#ffffff' }
];

window.onDbReady = function () {
  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  if (!isAdmin) {
    const style = document.createElement('style');
    style.id = 'adminOnlyStyles';
    style.innerHTML = `
      .col-price, .admin-only-column {
        display: none !important;
      }
      .modal-left-column {
        width: 100% !important;
        flex: 0 0 100% !important;
        max-width: 100% !important;
        border-right: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const buttonsHtml = isAdmin ? `
    <button class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fs-8 px-2.5 py-1.5 shadow-sm text-nowrap rounded-1" id="btnAddNewCustomer" title="Add New Customer">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      <span>Add</span>
    </button>
    <button class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 fs-8 px-2.5 py-1.5 shadow-sm bg-white text-nowrap rounded-1" id="btnImportCustomer" title="Import Customers from Excel">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Import</span>
    </button>
    <button class="btn btn-outline-secondary ms-2" id="btnDownloadFormat" style="display: none;">Download format</button>
    <input type="file" id="excelFileInput" accept=".xlsx, .xls" style="display: none;">
  ` : '';

  UI.renderSidebar('customer.html');
  UI.renderTopbar('Customer', buttonsHtml);

  const btnAddNewCustomer = document.getElementById('btnAddNewCustomer');
  if (btnAddNewCustomer) {
    btnAddNewCustomer.addEventListener('click', () => {
      openCustomerModal();
    });
  }

  const modalLoginDate = document.getElementById('cLoginDate');
  if (modalLoginDate) {
    modalLoginDate.addEventListener('input', updateModalLoginDelayBadge);
    modalLoginDate.addEventListener('change', updateModalLoginDelayBadge);
  }

  // Excel Import element event listeners
  const btnImport = document.getElementById('btnImportCustomer');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      document.getElementById('excelFileInput').click();
    });
  }

  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleExcelImport);
  }

  const btnDownloadFormat = document.getElementById('btnDownloadFormat');
  if (btnDownloadFormat) {
    btnDownloadFormat.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = 'assets/sampleFiles/My_Applications_List.xlsx';
      a.download = 'My_Applications_List.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  const btnTxt = document.getElementById('btnDownloadTxt');
  if (btnTxt) {
    btnTxt.addEventListener('click', downloadTxtReport);
  }

  const btnSaveImport = document.getElementById('btnSaveImportedCustomers');
  if (btnSaveImport) {
    btnSaveImport.addEventListener('click', saveImportedCustomers);
  }

  const chkAll = document.getElementById('chkSelectAllImport');
  if (chkAll) {
    chkAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.chk-import-row').forEach(chk => {
        chk.checked = isChecked;
      });
    });
  }

  const previewTable = document.getElementById('importPreviewTable');
  if (previewTable) {
    previewTable.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-import-row')) {
        const chkAllHeader = document.getElementById('chkSelectAllImport');
        if (chkAllHeader) {
          const allChks = document.querySelectorAll('.chk-import-row');
          const allChecked = Array.from(allChks).every(c => c.checked);
          chkAllHeader.checked = allChecked;
        }
      }
    });
  }

  const btnSaveCust = document.getElementById('btnSaveCustomer');
  if (btnSaveCust) btnSaveCust.addEventListener('click', saveCustomerModal);

  // Search & Filter listeners
  ['fSearch', 'fLoginFrom', 'fLoginTo', 'fDateType', 'chkShowDeactive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', Utils.debounce(renderList, 200));
      el.addEventListener('change', renderList);
    }
  });

  // Table header sorting listeners
  document.querySelectorAll('#installmentsTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = (col === 'Delay') ? 'desc' : 'asc';
      }
      updateSortHeadersUI();
      renderList();
    });
  });

  document.getElementById('btnClearFilters').addEventListener('click', () => {
    ['fSearch', 'fLoginFrom', 'fLoginTo'].forEach(id => document.getElementById(id).value = '');
    const dateTypeSel = document.getElementById('fDateType');
    if (dateTypeSel) dateTypeSel.value = 'LoginDate';
    const chkDeactive = document.getElementById('chkShowDeactive');
    if (chkDeactive) chkDeactive.checked = false;
    selectedDistricts = [];
    selectedBrands = [];
    selectedPartners = [];
    document.querySelectorAll('.district-chk').forEach(c => c.checked = false);
    document.querySelectorAll('.brand-chk').forEach(c => c.checked = false);
    document.querySelectorAll('.partner-chk').forEach(c => c.checked = false);
    updateDistrictDropdownButton();
    updateBrandDropdownButton();
    updatePartnerDropdownButton();
    renderList();
  });

  // Color Customizer listeners
  const colorPickerEl = document.getElementById('ccColorPicker');
  if (colorPickerEl) {
    colorPickerEl.addEventListener('input', (e) => {
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
  }

  const resetColorsBtn = document.getElementById('btnResetColors');
  if (resetColorsBtn) {
    resetColorsBtn.addEventListener('click', () => {
      localStorage.removeItem('installmentColColors');
      applyCustomStyles();
      updateColorPickerValue();
    });
  }

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

  // Add Transaction button listener (if form is present)
  const btnAddTxn = document.getElementById('btnAddTxn');
  if (btnAddTxn) {
    btnAddTxn.addEventListener('click', async () => {
      const slNo = Number(document.getElementById('txnSlNo').value);
      const txnType = document.getElementById('txnType').value || 'Customer';
      const date = document.getElementById('newTxnDate').value;
      const amt = Number(document.getElementById('newTxnAmount').value) || 0;
      const remark = document.getElementById('newTxnRemark') ? document.getElementById('newTxnRemark').value.trim() : '';

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
          Remark: remark,
          TxnType: txnType
        };
        await DB.insert('installment_txns', txn);
        
        // Update customer installment Total or Vendor Paid
        await syncInstallmentTotal(slNo, txnType);
        
        // Reset inputs
        const amtInput = document.getElementById('newTxnAmount');
        if (amtInput) amtInput.value = '';
        const remInput = document.getElementById('newTxnRemark');
        if (remInput) remInput.value = '';
        const dateInput = document.getElementById('newTxnDate');
        if (dateInput) dateInput.value = UI.todayISO();

        UI.toast('Payment added successfully.', 'success');
        renderList();
        showTransactionHistory(slNo, txnType);
      } catch (err) {
        UI.toast('Error adding payment: ' + err.message, 'danger');
      } finally {
        UI.showLoading(false);
      }
    });
  }

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
      renderList();
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
  initResizableColumns();
};

function applyCustomStyles() {
  const savedColors = JSON.parse(localStorage.getItem('installmentColColors') || '{}');
  let styleText = '';
  
  DEFAULT_COLUMN_COLORS.forEach(c => {
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
  document.querySelectorAll('#installmentsTable th.sortable').forEach(th => {
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

  // 3. Partner multiselect menu (dynamically computed from database)
  const partnerMenu = document.getElementById('partnerMultiselectMenu');
  if (partnerMenu) {
    const allRows = DB.getAll('installments');
    const rawPartners = allRows.map(r => r.BrokerName ? r.BrokerName.trim() : '').filter(Boolean);
    const uniquePartners = [...new Set(rawPartners)].sort();

    partnerMenu.innerHTML = [
      `<div class="form-check mb-1">
         <input class="form-check-input partner-chk" type="checkbox" value="(No Partner)" id="chk_nopartner" ${selectedPartners.includes('(No Partner)') ? 'checked' : ''}>
         <label class="form-check-label w-100" for="chk_nopartner">(No Partner)</label>
       </div>`
    ].concat(
      uniquePartners.map(p => `
        <div class="form-check mb-1">
          <input class="form-check-input partner-chk" type="checkbox" value="${p}" id="chk_partner_${p.replace(/\s+/g, '_')}" ${selectedPartners.includes(p) ? 'checked' : ''}>
          <label class="form-check-label w-100" for="chk_partner_${p.replace(/\s+/g, '_')}">${p}</label>
        </div>
      `)
    ).join('');

    // Checkbox change listener
    document.querySelectorAll('.partner-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        selectedPartners = Array.from(document.querySelectorAll('.partner-chk:checked')).map(c => c.value);
        updatePartnerDropdownButton();
        renderList();
      });
    });
  }
  updatePartnerDropdownButton();
}

function populateColorColCheckboxes() {
  const menu = document.getElementById('ccColumnMultiselectMenu');
  if (!menu) return;
  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const cols = DEFAULT_COLUMN_COLORS.filter(c => isAdmin || c.key !== 'col-price');
  menu.innerHTML = cols.map(c => `
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
  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const cols = DEFAULT_COLUMN_COLORS.filter(c => isAdmin || c.key !== 'col-price');
  if (selectedColorCols.length === 0) {
    btn.textContent = 'Select Columns';
  } else if (selectedColorCols.length === 1) {
    const col = DEFAULT_COLUMN_COLORS.find(c => c.key === selectedColorCols[0]);
    btn.textContent = col ? col.label : '1 Column';
  } else if (selectedColorCols.length === cols.length) {
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
  const matched = DEFAULT_COLUMN_COLORS.find(c => c.key === colKey);
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

window.toggleDistrictBadgeFilter = function(dist, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (dist === 'ALL' || dist === 'Total') {
    selectedDistricts = [];
  } else {
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const idx = selectedDistricts.indexOf(targetDist);
    if (idx > -1) {
      selectedDistricts.splice(idx, 1);
    } else {
      selectedDistricts.push(targetDist);
    }
  }

  // Sync checkboxes in district dropdown
  document.querySelectorAll('.district-chk').forEach(chk => {
    chk.checked = selectedDistricts.includes(chk.value);
  });
  updateDistrictDropdownButton();
  renderList();
};

function updateDistrictStats() {
  const container = document.getElementById('districtStatsContainer');
  if (!container) return;

  const allRows = DB.getAll('installments') || [];
  const activeRows = allRows.filter(r => r.Status !== 'Deactive');
  const totalCount = activeRows.length;
  const counts = {};

  activeRows.forEach(r => {
    const dist = r.District ? r.District.trim() : '';
    const key = dist || 'No District';
    counts[key] = (counts[key] || 0) + 1;
  });

  const sortedDistricts = Object.keys(counts)
    .filter(k => counts[k] >= 1)
    .sort((a, b) => {
      if (a === 'No District') return 1;
      if (b === 'No District') return -1;
      return a.localeCompare(b);
    });

  const badgeStyles = [
    'bg-primary-subtle text-primary-emphasis border border-primary-subtle',
    'bg-success-subtle text-success-emphasis border border-success-subtle',
    'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    'bg-danger-subtle text-danger-emphasis border border-danger-subtle',
    'bg-info-subtle text-info-emphasis border border-info-subtle',
    'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle'
  ];

  const isTotalActive = selectedDistricts.length === 0;
  const totalBadge = `<button type="button" onclick="window.toggleDistrictBadgeFilter('ALL', event)" class="erp-tag ${isTotalActive ? 'active' : ''}" title="Show all districts">Total: ${totalCount}</button>`;

  const districtBadges = sortedDistricts.map((dist) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistricts.includes(targetDist);
    const safeDist = dist.replace(/'/g, "\\'");

    return `<button type="button" onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="erp-tag ${isSelected ? 'active' : ''}" title="Filter by ${dist}">${dist} (${count})</button>`;
  }).join(' ');

  container.innerHTML = totalBadge + ' ' + districtBadges;
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

function updatePartnerDropdownButton() {
  const btn = document.getElementById('btnPartnerMultiselect');
  if (!btn) return;
  if (selectedPartners.length === 0) {
    btn.textContent = 'All Partners';
  } else if (selectedPartners.length === 1) {
    btn.textContent = selectedPartners[0];
  } else {
    btn.textContent = `${selectedPartners.length} Partners`;
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

function parseExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    // Excel date serial numbers
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // Match DD-MM-YY, DD-MM-YYYY, DD/MM/YY, DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    let day = parseInt(dmy[1], 10);
    let month = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }
  }
  // Match YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    let year = parseInt(ymd[1], 10);
    let month = parseInt(ymd[2], 10);
    let day = parseInt(ymd[3], 10);
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
}

function getDelayInfo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - d.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (totalDays < 0) return { totalDays, text: '0D', colorType: 'normal' };

  let y = today.getFullYear() - d.getFullYear();
  let m = today.getMonth() - d.getMonth();
  let day = today.getDate() - d.getDate();

  if (day < 0) {
    m -= 1;
    const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    day += prevMonthDays;
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }

  const parts = [];
  if (y > 0) parts.push(`${y}Y`);
  if (m > 0) parts.push(`${m}M`);
  if (day > 0 || parts.length === 0) parts.push(`${day}D`);

  const text = parts.join(' ');
  let colorType = 'normal';
  if (totalDays > 90) {
    colorType = 'red';
  } else if (totalDays > 60) {
    colorType = 'yellow';
  } else {
    colorType = 'normal';
  }

  return { totalDays, text, colorType };
}

function getDelayBadgeHtml(dateStr) {
  const info = getDelayInfo(dateStr);
  if (!info) return '';
  return `<span class="badge erp-delay-badge delay-${info.colorType} ms-1" title="Login Date: ${fmtDateExcel(dateStr)} (${info.totalDays} days ago)">(${info.text})</span>`;
}

function getDispatchOrHigherDelayBadgeHtml(r) {
  if (!r) return '';
  // Check MaterialDispatchedDate first, then progressive higher steps, then earlier steps
  const stages = [
    { key: 'MaterialDispatchedDate', label: 'Material Dispatch' },
    { key: 'InstallationDate', label: 'Installation' },
    { key: 'NetMeterDate', label: 'Net Meter' },
    { key: 'InspectionDate', label: 'Inspection' },
    { key: 'MeterConnectedDate', label: 'Meter Connection' },
    { key: 'CommissioningDate', label: 'Commissioning' },
    { key: 'AgreementDate', label: 'Agreement' },
    { key: 'LoginDate', label: 'Login' }
  ];

  let matchedStage = null;
  let targetDate = null;
  for (const st of stages) {
    if (r[st.key] && String(r[st.key]).trim() !== '') {
      matchedStage = st;
      targetDate = r[st.key];
      break;
    }
  }

  if (!targetDate) return '';
  const info = getDelayInfo(targetDate);
  if (!info) return '';

  // Custom threshold: > 1 month (30 days) => red, > 20 days => yellow, otherwise => normal
  let colorType = 'normal';
  if (info.totalDays > 30) {
    colorType = 'red';
  } else if (info.totalDays > 20) {
    colorType = 'yellow';
  } else {
    colorType = 'normal';
  }

  return `<span class="badge erp-delay-badge delay-${colorType} font-monospace ms-auto" style="font-size: 0.65rem; padding: 2px 5px;" title="${matchedStage.label}: ${fmtDateExcel(targetDate)} (${info.totalDays} days ago)">(${info.text})</span>`;
}

function calculateDelay(loginDateStr) {
  const info = getDelayInfo(loginDateStr);
  return info ? info.text : '';
}

function updateModalLoginDelayBadge() {
  const badge = document.getElementById('cLoginDelayBadge');
  const input = document.getElementById('cLoginDate');
  if (!badge || !input) return;
  const val = input.value;
  if (!val) {
    badge.style.display = 'none';
    badge.textContent = '';
    return;
  }
  const info = getDelayInfo(val);
  if (!info) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.textContent = `(${info.text})`;
  badge.className = `badge erp-delay-badge delay-${info.colorType} font-monospace fs-8`;
  badge.title = `${info.totalDays} days delay from Login Date`;
}

function calculateInstDelay(loginDateStr, instDateStr) {
  if (!loginDateStr || !instDateStr) return '';
  const d1 = new Date(loginDateStr);
  const d2 = new Date(instDateStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + ' days';
}

function calculateCommDelay(commDateStr, instDateStr) {
  if (!commDateStr || !instDateStr) return '';
  const d1 = new Date(commDateStr);
  const d2 = new Date(instDateStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d1.getTime() - d2.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + ' days';
}

function renderList() {
  updateDistrictStats();
  const search = (document.getElementById('fSearch').value || '').toLowerCase();
  const loginFrom = document.getElementById('fLoginFrom').value;
  const loginTo = document.getElementById('fLoginTo').value;
  const dateType = document.getElementById('fDateType') ? document.getElementById('fDateType').value : 'LoginDate';
  const showDeactive = document.getElementById('chkShowDeactive') ? document.getElementById('chkShowDeactive').checked : false;

  let rows = getInstallmentRows();

  // Filter exclusively: if 'Show Deactive' is checked, show ONLY Deactive customers; otherwise show ONLY Active customers
  if (showDeactive) {
    rows = rows.filter(r => r.Status === 'Deactive');
  } else {
    rows = rows.filter(r => r.Status !== 'Deactive');
  }

  // Apply search
  if (search) {
    rows = rows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
      String(r.PinCode || '').toLowerCase().includes(search) ||
      String(r.State || '').toLowerCase().includes(search) ||
      String(r.Address || '').toLowerCase().includes(search) ||
      String(r.MobileNumber || '').toLowerCase().includes(search) ||
      String(r.CommittedBrand || '').toLowerCase().includes(search) ||
      String(r.LoginDate || '').toLowerCase().includes(search) ||
      String(r.InstallationDate || '').toLowerCase().includes(search) ||
      String(r.CommissioningDate || '').toLowerCase().includes(search)
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

  // Apply multiselect Partner Filter
  if (selectedPartners.length > 0) {
    rows = rows.filter(r => {
      const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
      const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
      return selectedPartners.includes(partnerName);
    });
  }

  // Apply Date Range filters
  if (loginFrom) {
    rows = rows.filter(r => r[dateType] && r[dateType] >= loginFrom);
  }
  if (loginTo) {
    rows = rows.filter(r => r[dateType] && r[dateType] <= loginTo);
  }

  // Apply sort
  rows.sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (sortCol === 'Delay') {
      const aCommissioned = Boolean(a.CommissioningDate && String(a.CommissioningDate).trim() !== '');
      const bCommissioned = Boolean(b.CommissioningDate && String(b.CommissioningDate).trim() !== '');
      const aDays = getRawDelayDays(a.LoginDate);
      const bDays = getRawDelayDays(b.LoginDate);
      const aValid = Boolean(!aCommissioned && a.LoginDate && aDays !== -999999);
      const bValid = Boolean(!bCommissioned && b.LoginDate && bDays !== -999999);

      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;

      if (aDays < bDays) return sortDir === 'asc' ? -1 : 1;
      if (aDays > bDays) return sortDir === 'asc' ? 1 : -1;
      return 0;
    } else if (sortCol === 'LoginDate' || sortCol === 'InstallationDate' || sortCol === 'CommissioningDate') {
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
  
  const filterParts = [];
  if (showDeactive) filterParts.push('Deactive');
  if (selectedDistricts.length > 0) filterParts.push(selectedDistricts.length === 1 ? selectedDistricts[0] : `${selectedDistricts.length} Districts`);
  if (selectedPartners.length > 0) filterParts.push(selectedPartners.length === 1 ? selectedPartners[0] : `${selectedPartners.length} Partners`);
  if (selectedBrands.length > 0) filterParts.push(selectedBrands.length === 1 ? selectedBrands[0] : `${selectedBrands.length} Brands`);
  if (search) filterParts.push(`"${search}"`);
  if (loginFrom || loginTo) filterParts.push('Date Filter');
  const filterLabel = filterParts.length > 0 ? filterParts.join(', ') : 'All';

  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');

  if (!rows.length && !isAddingNew) {
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? '6' : '5'}" class="text-center py-4 text-muted">No records found.</td></tr>`;
    const allDbRows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
    renderTopKpis({
      activeCount: 0,
      totalInDb: allDbRows.length,
      filterLabel,
      showDeactive,
      sumPrice: 0,
      sumTotal: 0,
      pendingCust: 0,
      sumPartnerPrice: 0,
      partnerPending: 0,
      sumVendorPrice: 0,
      totalProfit: 0,
      isAdmin
    });
    window._lastRenderedRows = [];
    renderSummaryModalBreakdown([], isAdmin);
    return;
  }

  // Compute Grand Totals
  let sumTotal = 0;
  let sumPrice = 0;
  let sumVendorPrice = 0;
  let sumVendorPaid = 0;
  let sumComm = 0;
  let sumCommPaid = 0;
  let sumPartnerPrice = 0;

  tbody.innerHTML = rows.map((r) => {
    const isEditing = (Number(r.SlNo) === Number(editingSlNo));
    const isDeactive = (r.Status === 'Deactive');
    
    // Parse expenses metadata
    let expenses = null;
    if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try {
        const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
        expenses = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Error parsing expenses metadata:", e);
      }
    }
    const partnerPrice = (expenses && expenses.partner) || 0;

    // We sum all transactions from local cache where SlNo matches r.SlNo and type is Customer
    const txns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(r.SlNo) && (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === ''));
    const total = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
    const price = Number(r.CommittedPrice) || 0;
    const hasPayment = total > 0;
    const sortedTxns = [...txns].sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate));
    const latestTxn = sortedTxns.length ? sortedTxns[sortedTxns.length - 1] : null;
    const latestDate = latestTxn && latestTxn.TxnDate ? latestTxn.TxnDate : UI.todayISO();

    // Vendor calculations
    const vPrice = Number(r.VendorPrice) || 0;
    const vTxns = DB.getAll('installment_txns').filter(t => Number(t.SlNo) === Number(r.SlNo) && t.TxnType === 'Vendor');
    const vPaid = vTxns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

    const comm = Number(r.Commission) || 0;
    const commPaid = Number(r.CommissionPaid) || 0;

    // Do not sum the dummy record or any deactivated records
    if (!isDeactive && (!isAddingNew || Number(r.SlNo) !== Number(editingSlNo))) {
      sumTotal += total;
      sumPrice += price;
      sumVendorPrice += vPrice;
      sumVendorPaid += vPaid;
      sumComm += comm;
      sumCommPaid += commPaid;
      sumPartnerPrice += partnerPrice;
    }

    if (isEditing) {
      // Render input fields for inline editing
      return `
        <tr class="table-warning">
          <td class="text-center fw-semibold align-middle">${r.SlNo}</td>
          <td>
            <div class="d-flex flex-column gap-1">
              <input type="text" class="form-control form-control-sm" id="editName" value="${r.Name || ''}" placeholder="Name *" required>
              <input type="text" class="form-control form-control-sm" id="editConsumerNo" value="${r.ConsumerNo || ''}" placeholder="Consumer No">
              <input type="text" class="form-control form-control-sm" id="editMobileNumber" value="${r.MobileNumber || ''}" placeholder="Mobile">
              <input type="text" class="form-control form-control-sm" id="editCommittedBrand" value="${r.CommittedBrand || ''}" placeholder="Brand">
              <select class="form-select form-select-sm" id="editDistrict">
                <option value="">-- Select District --</option>
                ${DISTRICTS.map(d => `<option value="${d}" ${r.District === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
              <input type="text" class="form-control form-control-sm" id="editAddress" value="${r.Address || ''}" placeholder="Address">
              <div class="input-group input-group-sm">
                <span class="input-group-text" style="font-size:0.7rem;">Cust Price</span>
                <input type="number" step="0.01" class="form-control" id="editCommittedPrice" value="${r.CommittedPrice || ''}" placeholder="Cust Price">
              </div>
            </div>
          </td>
          <td class="col-payment align-middle text-center text-muted fs-8">
            <span class="badge bg-light text-secondary border">Payment via Toggle</span>
          </td>
          <td class="col-Partner">
            <div class="d-flex flex-column gap-1">
              <div class="dropdown">
                <input type="text" class="form-control form-control-sm" id="editBrokerName" value="${r.BrokerName || ''}" placeholder="Partner Name" autocomplete="off">
              </div>
              <input type="text" class="form-control form-control-sm" id="editBrokerNumber" value="${(r.BrokerNumber || '').split('|')[0]}" placeholder="Partner Phone">
              <div class="input-group input-group-sm">
                <span class="input-group-text" style="font-size:0.7rem;">Comm</span>
                <input type="number" step="0.01" class="form-control" id="editCommission" value="${comm || ''}" placeholder="Comm Amt">
              </div>
              <div class="input-group input-group-sm">
                <span class="input-group-text" style="font-size:0.7rem;">Partner Price</span>
                <input type="number" step="0.01" class="form-control expense-calc-inline" id="editPartnerPrice" value="${(expenses && expenses.partner) || 0}" placeholder="Partner Price">
              </div>
            </div>
          </td>
          <td class="col-price admin-only-column">
            <div style="resize: horizontal; overflow: auto; min-width: 145px; max-width: 400px; padding: 2px;">
              <div class="d-flex flex-column gap-1">
                <div class="input-group input-group-sm">
                  <span class="input-group-text" style="font-size:0.65rem; width: 60px;">Material</span>
                  <input type="number" step="0.01" class="form-control expense-calc-inline" id="editMaterialCost" value="${(expenses && expenses.material) || 0}" placeholder="Material Price">
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text" style="font-size:0.65rem; width: 60px;">Install</span>
                  <input type="number" step="0.01" class="form-control expense-calc-inline" id="editInstallationCost" value="${(expenses && expenses.install) || 0}" placeholder="Installation">
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text text-secondary" style="font-size:0.55rem; width: 60px; line-height: 1.1;" title="GST calculated on Customer Price">GST (%)</span>
                  <input type="number" step="any" class="form-control" id="editGSTPercentage" value="${(expenses && expenses.gst_pct !== undefined && expenses.gst_pct !== null && expenses.gst_pct !== '') ? expenses.gst_pct : (typeof Utils !== 'undefined' && Utils.getDefaultGST ? Utils.getDefaultGST(18) : 18)}" placeholder="GST %">
                  <span class="input-group-text bg-light fw-bold" id="lblEditGSTAmount" style="font-size:0.65rem; width: 60px;">₹0.00</span>
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text" style="font-size:0.65rem; width: 60px;">Other</span>
                  <input type="number" step="0.01" class="form-control expense-calc-inline" id="editOtherCost" value="${(expenses && expenses.other) || 0}" placeholder="Other">
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-light fw-bold" style="font-size:0.65rem; width: 60px;">Total</span>
                  <input type="number" step="0.01" class="form-control bg-light fw-bold" id="editVendorPrice" value="${r.VendorPrice || ''}" placeholder="Total Expense" readonly>
                </div>
              </div>
            </div>
          </td>
          <td class="no-print text-center align-middle">
            <div class="d-flex gap-1 justify-content-center">
              <button class="btn btn-sm btn-success py-0.5 px-2 d-inline-flex align-items-center" onclick="saveInline(${r.SlNo})" title="Save">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </button>
              <button class="btn btn-sm btn-outline-secondary py-0.5 px-2 d-inline-flex align-items-center" onclick="cancelInline()" title="Cancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      // Render normal static row
      const isCommissioned = Boolean(r.CommissioningDate && String(r.CommissioningDate).trim() !== '');
      const hasInstDate = Boolean(r.InstallationDate && String(r.InstallationDate).trim() !== '');
      const hasLoginDate = Boolean(r.LoginDate && String(r.LoginDate).trim() !== '');

      let rowClass = '';

      if (isDeactive) {
        rowClass = 'deactive-row';
      } else if (isCommissioned) {
        rowClass = 'comm-completed-row';
      }

      const isNetMeterPaid = (r.NetMeterPaid != null) ? (r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1) : !!(expenses && expenses.net_meter_paid);
      const netMeterAmt = (r.NetMeterPayment != null && r.NetMeterPayment !== '') ? Number(r.NetMeterPayment) : (expenses && expenses.net_meter_payment ? Number(expenses.net_meter_payment) : 0);

      let netMeterBadgeHtml = '';
      if (isNetMeterPaid) {
        netMeterBadgeHtml = `
          <span class="erp-meta-tag" title="Net Meter Paid: ₹${netMeterAmt.toLocaleString('en-IN')}">Meter: ₹${netMeterAmt.toLocaleString('en-IN')}</span>
        `;
      }

      function renderDiffText(targetAmt, paidAmt) {
        const diff = targetAmt - paidAmt;
        if (Math.abs(diff) < 0.01) {
          return '';
        } else if (diff > 0) {
          return `<span class="erp-pending-text no-print" title="Pending: ₹${diff.toLocaleString('en-IN', {minimumFractionDigits:2})}">₹${diff.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>`;
        } else {
          return `<span class="erp-advance-text no-print" title="Advance: +₹${Math.abs(diff).toLocaleString('en-IN', {minimumFractionDigits:2})}">+₹${Math.abs(diff).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>`;
        }
      }

      const custPillHtml = renderDiffText(price, total);
      const vendorPillHtml = renderDiffText(price - partnerPrice, vPaid);
      const profit = partnerPrice - comm - vPrice;
      const profitColorClass = profit >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
      const isFullyPaid = (price > 0 && total >= price);

      return `
        <tr class="${rowClass}">
          <td class="text-center fw-semibold text-secondary align-middle fs-8">${r.SlNo}</td>
          <td class="align-middle">
            <div class="erp-customer-cell">
              <div class="erp-name-row">
                <a href="#" class="erp-cust-name" onclick="showTransactionHistory(${r.SlNo}, 'Customer'); return false;" title="Click to view/edit payment history">
                  ${r.Name || ''}
                </a>
                ${netMeterBadgeHtml}
              </div>
              ${!isFullyPaid ? `
                <div class="erp-meta-row">
                  <span class="erp-price-text">₹${price.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                  ${custPillHtml}
                </div>
              ` : ''}
            </div>
          </td>
          <td class="col-payment align-middle ${isFullyPaid ? 'payment-cell-disabled' : ''}">
            <div class="erp-payment-cell ${isFullyPaid ? 'opacity-85' : ''}" id="payCell_${r.SlNo}">
              <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                <div class="d-flex align-items-center gap-2">
                  <label class="mw-switch" title="${isFullyPaid ? 'Fully Paid (Payment Completed)' : (hasPayment ? 'Payment Active (Click to clear payment)' : 'No payment (Click to add payment)')}">
                    <input type="checkbox" id="chkPayToggle_${r.SlNo}" ${hasPayment ? 'checked' : ''} ${isFullyPaid ? 'disabled' : ''} onchange="handleCustomerPaymentToggle(this, ${r.SlNo})">
                    <span class="mw-slider"></span>
                  </label>
                  <span class="erp-pay-status-label ${hasPayment ? 'text-success fw-bold' : 'text-muted'} font-monospace" style="font-size: 0.75rem;">
                    ${hasPayment ? `Paid: ₹${Math.round(total).toLocaleString('en-IN')}${isFullyPaid ? ' (Full)' : ''}` : 'Unpaid'}
                  </span>
                </div>
                ${!isFullyPaid ? getDispatchOrHigherDelayBadgeHtml(r) : ''}
              </div>
              <div class="erp-pay-inputs-wrap ${(hasPayment && !isFullyPaid) ? 'd-flex' : 'd-none'} align-items-center gap-1" id="payInputs_${r.SlNo}">
                <input type="date" class="form-control form-control-sm erp-pay-date" id="payDate_${r.SlNo}" value="${UI.todayISO()}" title="Payment Date" style="font-size: 0.72rem; padding: 2px 4px; height: 26px; width: 105px;" ${isFullyPaid ? 'disabled' : ''}>
                <div class="input-group input-group-sm" style="width: 105px;">
                  <span class="input-group-text px-1 py-0 text-muted" style="font-size: 0.68rem; height: 26px;">₹</span>
                  <input type="number" step="any" class="form-control form-control-sm px-1 py-0 font-monospace erp-pay-amt" id="payAmt_${r.SlNo}" value="" placeholder="Add Amt" title="Enter new payment amount" style="font-size: 0.75rem; height: 26px;" onkeydown="if(event.key==='Enter') saveCustomerQuickPayment(${r.SlNo})" ${isFullyPaid ? 'disabled' : ''}>
                </div>
                <button type="button" class="btn btn-sm btn-outline-success p-0 d-inline-flex align-items-center justify-content-center" style="width: 26px; height: 26px; flex-shrink: 0;" onclick="saveCustomerQuickPayment(${r.SlNo})" title="Add Payment" ${isFullyPaid ? 'disabled' : ''}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>
          </td>
          <td class="col-Partner align-middle">
            <div class="erp-partner-cell">
              <div class="erp-name-row">
                <a href="#" class="erp-partner-name" onclick="showTransactionHistory(${r.SlNo}, 'Vendor'); return false;" title="Click to view/edit partner payments">
                  ${r.BrokerName || '—'}
                </a>
              </div>
              <div class="erp-meta-row">
                <span class="erp-price-text">₹${partnerPrice.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                ${vendorPillHtml}
              </div>
            </div>
          </td>
          <td class="col-price align-middle font-monospace">
            <div class="erp-expense-cell">
              <div class="d-flex justify-content-between align-items-center gap-2">
                <span class="text-secondary fs-8">Exp:</span>
                <span class="fw-semibold text-dark fs-8">₹${vPrice.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center gap-2 border-top pt-0.5 mt-0.5">
                <span class="text-secondary fs-8">Profit:</span>
                <span class="${profitColorClass} fs-8">₹${profit.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </td>
          <td class="no-print text-center align-middle">
              ${isDeactive ? `
                <button class="btn erp-btn-action text-success" onclick="restoreRow(${r.SlNo})" title="Restore Row">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button class="btn erp-btn-action text-danger ms-1" onclick="hardDeleteRow(${r.SlNo})" title="Delete Permanently">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              ` : `
                <button class="btn erp-btn-action text-primary" onclick="editRow(${r.SlNo})" title="Edit Row">${UI.icon('pencil', 14)}</button>
                <button class="btn erp-btn-action text-danger ms-1" onclick="deleteRow(${r.SlNo})" title="Deactivate Row">${UI.icon('trash', 14)}</button>
              `}
          </td>
        </tr>
      `;
    }
  }).join('');

  const displayCount = isAddingNew ? rows.length - 1 : rows.length;
  // Render Top Executive KPI Grid
  const totalProfit = sumPartnerPrice - sumComm - sumVendorPrice;
  const partnerPending = (sumPrice - sumPartnerPrice) - sumVendorPaid;
  const pendingCust = sumPrice - sumTotal;
  const allDbRows = getInstallmentRows().filter(r => r.Status !== 'Deactive');
  renderTopKpis({
    activeCount: displayCount,
    totalInDb: allDbRows.length,
    filterLabel,
    showDeactive,
    sumPrice,
    sumTotal,
    pendingCust,
    sumPartnerPrice,
    partnerPending,
    sumVendorPrice,
    totalProfit,
    isAdmin
  });

  window._lastRenderedRows = rows;
  renderSummaryModalBreakdown(rows, isAdmin);

  // Bind dynamic inputs calculation listeners for active editing row
  bindEditRowListeners();
}

function bindEditRowListeners() {
  if (editingSlNo === null) return;

  const editLoginInput = document.getElementById('editLoginDate');
  const editInstInput = document.getElementById('editInstallationDate');
  const editCommInput = document.getElementById('editCommissioningDate');

  const updateDelayLabels = () => {
    const loginVal = editLoginInput ? editLoginInput.value : '';
    const instVal = editInstInput ? editInstInput.value : '';
    const commVal = editCommInput ? editCommInput.value : '';
    
    const loginDelayEl = document.getElementById('editLoginDelay');
    if (loginDelayEl) {
      const info = getDelayInfo(loginVal);
      if (info) {
        loginDelayEl.textContent = `(${info.text})`;
        loginDelayEl.className = `badge erp-delay-badge delay-${info.colorType} font-monospace fs-8`;
      } else {
        loginDelayEl.textContent = '(—)';
        loginDelayEl.className = 'badge bg-primary-subtle text-primary-emphasis font-monospace fs-8';
      }
    }

    const instDelayEl = document.getElementById('editInstDelay');
    if (instDelayEl) instDelayEl.textContent = `(${calculateInstDelay(loginVal, instVal) || '—'})`;

    const commDelayEl = document.getElementById('editCommDelay');
    if (commDelayEl) commDelayEl.textContent = `(${calculateCommDelay(commVal, instVal) || '—'})`;
  };

  [editLoginInput, editInstInput, editCommInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('change', updateDelayLabels);
      inp.addEventListener('input', updateDelayLabels);
    }
  });

  const currentUser = Auth.getUser();
  const isPartner = (currentUser && (currentUser.role === 'partner' || currentUser.role === 'associates'));
  const editBrokerNameInput = document.getElementById('editBrokerName');
  if (editBrokerNameInput) {
    if (isPartner) {
      editBrokerNameInput.value = currentUser.username;
      editBrokerNameInput.disabled = true;
      const phoneInput = document.getElementById('editBrokerNumber');
      if (phoneInput && !phoneInput.value) {
        const vendors = DB.getAll('vendors');
        const foundVendor = vendors.find(v => v.VendorName === currentUser.username);
        if (foundVendor && foundVendor.Phone) {
          phoneInput.value = foundVendor.Phone;
        }
      }
    } else {
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

  const updateInlineCalculations = () => {
    const custPriceVal = Number(document.getElementById('editCommittedPrice').value) || 0;
    const gstPct = Number(document.getElementById('editGSTPercentage').value) || 0;
    const gstVal = custPriceVal * (gstPct / 100);

    const gstLabel = document.getElementById('lblEditGSTAmount');
    if (gstLabel) {
      gstLabel.textContent = '₹' + gstVal.toFixed(2);
    }

    const mat = Number(document.getElementById('editMaterialCost').value) || 0;
    const inst = Number(document.getElementById('editInstallationCost').value) || 0;
    const oth = Number(document.getElementById('editOtherCost').value) || 0;

    const totalField = document.getElementById('editVendorPrice');
    if (totalField) {
      totalField.value = (mat + inst + gstVal + oth).toFixed(2);
    }
  };

  const editCommittedPriceField = document.getElementById('editCommittedPrice');
  if (editCommittedPriceField) {
    editCommittedPriceField.addEventListener('input', updateInlineCalculations);
  }

  const editGSTPercentageField = document.getElementById('editGSTPercentage');
  if (editGSTPercentageField) {
    editGSTPercentageField.addEventListener('input', updateInlineCalculations);
  }

  const calcInputs = document.querySelectorAll('.expense-calc-inline');
  calcInputs.forEach(input => {
    input.addEventListener('input', updateInlineCalculations);
  });

  // Run initial calculation once
  updateInlineCalculations();
}

function renderTopKpis(metrics) {
  const container = document.getElementById('customerKpiGrid');
  if (!container) return;

  const {
    activeCount,
    totalInDb,
    filterLabel = 'All',
    showDeactive = false,
    sumPrice,
    sumTotal,
    pendingCust,
    sumPartnerPrice,
    partnerPending,
    sumVendorPrice,
    totalProfit,
    isAdmin
  } = metrics;

  const collectionRate = sumPrice > 0 ? ((sumTotal / sumPrice) * 100).toFixed(1) : '0.0';
  const pendingRate = sumPrice > 0 ? ((pendingCust / sumPrice) * 100).toFixed(1) : '0.0';
  const profitMargin = sumPrice > 0 ? ((totalProfit / sumPrice) * 100).toFixed(1) : '0.0';

  const rupeeIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3a4.5 4.5 0 0 0 0-9"/></svg>`;

  const cardsHtml = [
    // 1. Total Customers Card (With filter value badge)
    `
    <div class="customer-kpi-card kpi-customers">
      <div class="customer-kpi-header">
        <span class="customer-kpi-title">Customers</span>
        <span class="customer-kpi-icon-wrap" title="Total active records">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
      </div>
      <div class="customer-kpi-value text-indigo">${activeCount}</div>
      <div class="customer-kpi-footer d-flex justify-content-between align-items-center flex-nowrap">
        <span class="text-secondary fs-8">${showDeactive ? 'Deactive' : 'Active Records'}</span>
        <span class="badge bg-indigo-subtle text-indigo px-1.5 py-0 fs-8 text-truncate" style="max-width: 110px;" title="Filter: ${filterLabel}">${filterLabel}</span>
      </div>
    </div>
    `,

    // 2. Total Revenue Card (Includes Collected Amount (%), Pending Amount (%))
    `
    <div class="customer-kpi-card kpi-revenue">
      <div class="customer-kpi-header">
        <span class="customer-kpi-title">Total Revenue</span>
        <span class="customer-kpi-icon-wrap" title="Total committed customer amount">
          ${rupeeIconSvg}
        </span>
      </div>
      <div class="customer-kpi-value text-sky">${fmtGrandTotal(sumPrice)}</div>
      <div class="customer-kpi-footer d-flex justify-content-between align-items-center flex-nowrap font-monospace fs-8">
        <span class="text-success fw-semibold" title="Collected: ${fmtGrandTotal(sumTotal)}">Rec: ${fmtGrandTotal(sumTotal)} <span class="badge bg-success-subtle text-success px-1 py-0 fs-9">${collectionRate}%</span></span>
        <span class="text-danger fw-semibold" title="Pending: ${fmtGrandTotal(pendingCust)}">Pend: ${fmtGrandTotal(pendingCust)} <span class="badge bg-danger-subtle text-danger px-1 py-0 fs-9">${pendingRate}%</span></span>
      </div>
    </div>
    `,

    // 3. Partner Amount Card
    `
    <div class="customer-kpi-card kpi-partner">
      <div class="customer-kpi-header">
        <span class="customer-kpi-title">Partner Total</span>
        <span class="customer-kpi-icon-wrap" title="Partner share and pending">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </span>
      </div>
      <div class="customer-kpi-value text-purple">${fmtGrandTotal(sumPartnerPrice)}</div>
      <div class="customer-kpi-footer d-flex justify-content-between align-items-center flex-nowrap font-monospace fs-8">
        <span class="text-secondary">Pending Due:</span>
        <span class="badge bg-danger-subtle text-danger px-1.5 py-0 fs-8">${fmtGrandTotal(partnerPending)}</span>
      </div>
    </div>
    `
  ];

  // Net Profit Card is ONLY visible for admin and superadmin users
  const currentUser = Auth.getUser();
  const isAdminOrSuperAdmin = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin'
  );

  if (isAdminOrSuperAdmin) {
    // 4. Net Profit Card (Admin and Superadmin only)
    const profitColorClass = totalProfit >= 0 ? 'text-emerald' : 'text-danger';
    const profitBadgeClass = totalProfit >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
    cardsHtml.push(`
      <div class="customer-kpi-card kpi-profit">
        <div class="customer-kpi-header">
          <span class="customer-kpi-title">Net Profit</span>
          <span class="customer-kpi-icon-wrap" title="Net profit after expenses and commission">
            ${rupeeIconSvg}
          </span>
        </div>
        <div class="customer-kpi-value ${profitColorClass}">${fmtGrandTotal(totalProfit)}</div>
        <div class="customer-kpi-footer d-flex justify-content-between align-items-center flex-nowrap font-monospace fs-8">
          <span class="text-secondary">Exp: ${fmtGrandTotal(sumVendorPrice)}</span>
          <span class="badge ${profitBadgeClass} px-1.5 py-0 fs-8">${profitMargin}%</span>
        </div>
      </div>
    `);
  }

  container.innerHTML = cardsHtml.join('');
}

let sumModalSortCol = null;
let sumModalSortDir = 'desc';

function getSummaryRowValues(r) {
  let expenses = null;
  if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
    try {
      const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
      expenses = JSON.parse(jsonStr);
    } catch (e) {
      expenses = null;
    }
  }

  const price = Number(r.CommittedPrice) || 0;
  const total = Number(r.Total) || 0;
  const custPending = price - total;

  const partnerPrice = (expenses && expenses.partner) ? Number(expenses.partner) : (Number(r.BrokerShare) || price);
  const vPaid = Number(r.VendorPaid) || 0;
  const partnerPending = (price - partnerPrice) - vPaid;

  const netMeterAmt = (r.NetMeterPayment != null && r.NetMeterPayment !== '') 
    ? Number(r.NetMeterPayment) 
    : (expenses && expenses.net_meter_payment ? Number(expenses.net_meter_payment) : 0);

  let vPrice = 0;
  if (r.VendorPrice !== undefined && r.VendorPrice !== null && r.VendorPrice !== '') {
    vPrice = Number(r.VendorPrice) || 0;
  } else if (expenses) {
    const mat = Number(expenses.material) || 0;
    const inst = Number(expenses.install) || 0;
    const gst = (expenses.gst !== undefined) ? Number(expenses.gst) : (price * ((Number(expenses.gst_pct) || 0) / 100));
    const trans = Number(expenses.transport) || 0;
    const oth = Number(expenses.other) || 0;
    vPrice = mat + inst + gst + trans + oth;
  }

  const comm = Number(r.Commission) || 0;
  const profit = partnerPrice - comm - vPrice;

  return {
    expenses,
    price,
    total,
    custPending,
    partnerPrice,
    partnerPending,
    netMeterAmt,
    profit
  };
}

function updateSummaryModalSortHeadersUI() {
  document.querySelectorAll('#sumModalCustomerTable th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.getAttribute('data-sort') === sumModalSortCol) {
      th.classList.add(sumModalSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function initSummaryModalSortListeners() {
  const modalTable = document.getElementById('sumModalCustomerTable');
  if (!modalTable || modalTable.dataset.sortBound) return;
  modalTable.dataset.sortBound = 'true';

  modalTable.querySelectorAll('thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sumModalSortCol === col) {
        sumModalSortDir = sumModalSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sumModalSortCol = col;
        sumModalSortDir = (col === 'Name' || col === 'Partner' || col === 'SlNo') ? 'asc' : 'desc';
      }
      updateSummaryModalSortHeadersUI();
      const currentRows = (window._lastRenderedRows || getInstallmentRows());
      const currentUser = Auth.getUser();
      const isAdm = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
      renderSummaryModalBreakdown(currentRows, isAdm);
    });
  });
}

function renderSummaryModalBreakdown(rows, isAdmin) {
  const tbody = document.querySelector('#sumModalCustomerTable tbody');
  const tfoot = document.querySelector('#sumModalCustomerTable tfoot');
  const rowCountBadge = document.getElementById('sumModalRowCount');
  const searchInput = document.getElementById('fSumModalSearch');
  if (!tbody) return;

  initSummaryModalSortListeners();
  updateSummaryModalSortHeadersUI();

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => {
      const currentRows = (window._lastRenderedRows || getInstallmentRows());
      const currentUser = Auth.getUser();
      const isAdm = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
      renderSummaryModalBreakdown(currentRows, isAdm);
    });
  }

  const searchTerm = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';
  const activeRows = rows.filter(r => Number(r.SlNo) !== Number(editingSlNo));
  let filteredBreakdown = searchTerm
    ? activeRows.filter(r =>
        String(r.Name || '').toLowerCase().includes(searchTerm) ||
        String(r.BrokerName || '').toLowerCase().includes(searchTerm) ||
        String(r.District || '').toLowerCase().includes(searchTerm) ||
        String(r.SlNo || '').includes(searchTerm)
      )
    : activeRows.slice();

  if (sumModalSortCol) {
    filteredBreakdown.sort((a, b) => {
      const calcA = getSummaryRowValues(a);
      const calcB = getSummaryRowValues(b);
      let valA, valB;

      switch (sumModalSortCol) {
        case 'Collected':
          valA = calcA.total;
          valB = calcB.total;
          break;
        case 'CustPending':
          valA = calcA.custPending;
          valB = calcB.custPending;
          break;
        case 'Meter':
          valA = calcA.netMeterAmt;
          valB = calcB.netMeterAmt;
          break;
        case 'PartnerPending':
          valA = calcA.partnerPending;
          valB = calcB.partnerPending;
          break;
        case 'Revenue':
          valA = calcA.price;
          valB = calcB.price;
          break;
        case 'PartnerPrice':
          valA = calcA.partnerPrice;
          valB = calcB.partnerPrice;
          break;
        case 'NetProfit':
          valA = calcA.profit;
          valB = calcB.profit;
          break;
        case 'Name':
          valA = String(a.Name || '').toLowerCase();
          valB = String(b.Name || '').toLowerCase();
          break;
        case 'Partner':
          valA = String(a.BrokerName || '').toLowerCase();
          valB = String(b.BrokerName || '').toLowerCase();
          break;
        case 'SlNo':
          valA = Number(a.SlNo) || 0;
          valB = Number(b.SlNo) || 0;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (typeof valA === 'string' || typeof valB === 'string') {
        const cmp = String(valA).localeCompare(String(valB));
        return sumModalSortDir === 'asc' ? cmp : -cmp;
      }

      const diff = Number(valA) - Number(valB);
      return sumModalSortDir === 'asc' ? diff : -diff;
    });
  }

  if (rowCountBadge) {
    rowCountBadge.textContent = `${filteredBreakdown.length} Records`;
  }

  // Handle admin columns visibility in modal
  document.querySelectorAll('.admin-only-summary-col').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  if (filteredBreakdown.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? '10' : '9'}" class="text-center text-muted py-3">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredBreakdown.map(r => {
    const calc = getSummaryRowValues(r);
    const price = calc.price;
    const total = calc.total;
    const custPending = calc.custPending;
    const partnerPrice = calc.partnerPrice;
    const partnerPending = calc.partnerPending;
    const netMeterAmt = calc.netMeterAmt;
    const profit = calc.profit;

    const custPendingClass = Math.abs(custPending) < 0.01 ? 'text-secondary' : (custPending > 0 ? 'text-danger fw-bold' : 'text-primary fw-bold');
    const partnerPendingClass = Math.abs(partnerPending) < 0.01 ? 'text-secondary' : (partnerPending > 0 ? 'text-danger fw-bold' : 'text-primary fw-bold');
    const profitClass = profit >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
    const meterColorClass = netMeterAmt > 0 ? 'text-primary fw-semibold' : 'text-secondary';

    return `
      <tr>
        <td class="text-center text-muted font-monospace">${r.SlNo}</td>
        <td>
          <div class="fw-semibold text-dark text-truncate" style="max-width: 210px;" title="${r.Name || ''}">${r.Name || '—'}</div>
        </td>
        <td class="text-end font-monospace">₹${Math.round(price).toLocaleString('en-IN')}</td>
        <td class="text-end font-monospace text-success fw-semibold">₹${Math.round(total).toLocaleString('en-IN')}</td>
        <td class="text-end font-monospace ${custPendingClass}">₹${Math.round(custPending).toLocaleString('en-IN')}</td>
        <td class="text-end font-monospace ${meterColorClass}">₹${Math.round(netMeterAmt).toLocaleString('en-IN')}</td>
        <td>
          <div class="text-dark text-truncate" style="max-width: 160px;" title="${r.BrokerName || ''}">${r.BrokerName || '—'}</div>
        </td>
        <td class="text-end font-monospace text-purple fw-semibold">₹${Math.round(partnerPrice).toLocaleString('en-IN')}</td>
        <td class="text-end font-monospace ${partnerPendingClass}">₹${Math.round(partnerPending).toLocaleString('en-IN')}</td>
        <td class="text-end font-monospace admin-only-summary-col ${profitClass}" style="${isAdmin ? '' : 'display:none;'}">₹${Math.round(profit).toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');
}

window.openCustomerSummaryModal = function() {
  const modalEl = document.getElementById('customerSummaryModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
};

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
  openCustomerModal(slNo);
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

  const currentUser = Auth.getUser();
  let creatorSuffix = '';
  if (existing && (existing.BrokerNumber || '').includes('|creator:')) {
    creatorSuffix = '|creator:' + existing.BrokerNumber.split('|creator:')[1].split('|')[0];
  }
  if (!creatorSuffix && currentUser) {
    creatorSuffix = '|creator:' + currentUser.userid;
  }

  const custPriceVal = Number(document.getElementById('editCommittedPrice').value) || 0;
  const gstPctVal = Number(document.getElementById('editGSTPercentage').value) || 0;
  const calculatedGSTAmount = custPriceVal * (gstPctVal / 100);

  const expenses = {
    material: Number(document.getElementById('editMaterialCost').value) || 0,
    partner: Number(document.getElementById('editPartnerPrice').value) || 0,
    install: Number(document.getElementById('editInstallationCost').value) || 0,
    gst_pct: gstPctVal,
    gst: calculatedGSTAmount,
    other: Number(document.getElementById('editOtherCost').value) || 0
  };
  const calculatedVendorPrice = expenses.material + expenses.install + expenses.gst + expenses.other;
  const phoneClean = document.getElementById('editBrokerNumber').value.trim().split('|')[0];

  const row = {
    SlNo: Number(slNo),
    Name: name,
    ConsumerNo: document.getElementById('editConsumerNo') ? document.getElementById('editConsumerNo').value.trim() : (existing ? (existing.ConsumerNo || '') : ''),
    Status: isAddingNew ? 'Active' : currentStatus,
    District: document.getElementById('editDistrict').value,
    PinCode: existing ? (existing.PinCode || '') : '',
    State: existing ? (existing.State || 'Odisha') : 'Odisha',
    Address: document.getElementById('editAddress').value.trim(),
    MobileNumber: document.getElementById('editMobileNumber').value.trim(),
    CommittedBrand: document.getElementById('editCommittedBrand').value.trim(),
    FirstInstallment: fInst,
    SecondInstallment: sInst,
    ThirdInstallment: tInst,
    Total: total,
    CommittedPrice: Number(document.getElementById('editCommittedPrice').value) || 0,
    VendorPrice: calculatedVendorPrice,
    VendorPaid: existing ? (Number(existing.VendorPaid) || 0) : 0,
    LoginDate: document.getElementById('editLoginDate').value,
    InstallationDate: document.getElementById('editInstallationDate').value,
    Commission: Number(document.getElementById('editCommission').value) || 0,
    CommissionPaid: existing ? (Number(existing.CommissionPaid) || 0) : 0,
    BrokerName: document.getElementById('editBrokerName').value.trim(),
    BrokerNumber: phoneClean + creatorSuffix + '|expenses:' + JSON.stringify(expenses),
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

window.hardDeleteRow = async function (slNo) {
  if (editingSlNo !== null) {
    UI.toast('Please save or cancel your current edit first.', 'warning');
    return;
  }
  
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  const desc = r ? `${r.Name}${r.Address || r.District ? ' (' + [r.Address, r.District].filter(Boolean).join(', ') + ')' : ''}` : `Sl No. ${slNo}`;

  const ok = await UI.confirmDialog(`Are you sure you want to PERMANENTLY delete customer ${desc}? This action cannot be undone.`, 'Confirm Permanent Delete', 'Delete Permanently', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installments', x => Number(x.SlNo) === Number(slNo));
    UI.toast('Customer permanently deleted.', 'success');
  } catch (err) {
    UI.toast('Error permanently deleting customer: ' + err.message, 'danger');
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

async function syncInstallmentTotal(slNo, txnType = 'Customer') {
  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === txnType || (txnType === 'Customer' && (!t.TxnType || t.TxnType === '')))
  );
  const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  
  const existing = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (existing) {
    const updateData = {};
    if (txnType === 'Customer') {
      updateData.Total = sum;
    } else {
      updateData.VendorPaid = sum;
    }
    await DB.update('installments', r => Number(r.SlNo) === Number(slNo), {
      ...existing,
      ...updateData
    });
  }
}

window.handleCustomerPaymentToggle = async function(chkEl, slNo) {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === '')
  );
  const total = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
  const inputsWrap = document.getElementById(`payInputs_${slNo}`);

  if (chkEl.checked) {
    // Toggled from OFF to ON: Reveal inline inputs with current date ready for new value
    if (inputsWrap) {
      inputsWrap.classList.remove('d-none');
      inputsWrap.classList.add('d-flex');
    }
    const dateInput = document.getElementById(`payDate_${slNo}`);
    if (dateInput) {
      dateInput.value = UI.todayISO();
    }
    const amtInput = document.getElementById(`payAmt_${slNo}`);
    if (amtInput) {
      amtInput.value = '';
      amtInput.focus();
    }
  } else {
    // Toggled from ON to OFF:
    if (total > 0) {
      const ok = await UI.confirmDialog(
        `Clear payment of ₹${Math.round(total).toLocaleString('en-IN')} for customer ${r.Name || 'Sl No ' + slNo}? This will reset paid amount to ₹0 and recalculate the pending price.`,
        'Clear Customer Payment',
        'Clear Payment',
        'btn-danger'
      );
      if (!ok) {
        chkEl.checked = true;
        return;
      }

      UI.showLoading(true);
      try {
        await DB.remove('installment_txns', t => 
          Number(t.SlNo) === Number(slNo) && 
          (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === '')
        );
        await syncInstallmentTotal(slNo, 'Customer');
        UI.toast('Customer payments cleared and pending price updated.', 'info');
        renderList();
      } catch (err) {
        UI.toast('Error clearing payment: ' + err.message, 'danger');
        chkEl.checked = true;
      } finally {
        UI.showLoading(false);
      }
    } else {
      // No money was saved yet, simply hide inputs
      if (inputsWrap) {
        inputsWrap.classList.add('d-none');
        inputsWrap.classList.remove('d-flex');
      }
    }
  }
};

window.saveCustomerQuickPayment = async function(slNo) {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  const dateInput = document.getElementById(`payDate_${slNo}`);
  const amtInput = document.getElementById(`payAmt_${slNo}`);

  const payDate = dateInput ? (dateInput.value || UI.todayISO()) : UI.todayISO();
  const payAmt = amtInput ? (Number(amtInput.value) || 0) : 0;

  if (payAmt <= 0) {
    UI.toast('Please enter a valid payment amount greater than 0.', 'warning');
    if (amtInput) amtInput.focus();
    return;
  }

  UI.showLoading(true);
  try {
    // Insert new payment transaction
    await DB.insert('installment_txns', {
      TxnID: 'CTXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      SlNo: Number(slNo),
      TxnDate: payDate,
      Amount: payAmt,
      TxnType: 'Customer',
      Remark: 'Customer Payment'
    });

    await syncInstallmentTotal(slNo, 'Customer');
    UI.toast(`Payment of ₹${Math.round(payAmt).toLocaleString('en-IN')} added. Pending balance updated.`, 'success');
    renderList();
  } catch (err) {
    UI.toast('Error saving payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.deleteInstallmentTxn = async function(txnId) {
  const txn = DB.getAll('installment_txns').find(t => t.TxnID === txnId);
  if (!txn) return;
  const slNo = txn.SlNo;
  const txnType = txn.TxnType || 'Customer';

  const ok = await UI.confirmDialog(`Delete this payment of ₹${Number(txn.Amount).toLocaleString('en-IN')}?`, 'Delete Payment', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installment_txns', t => t.TxnID === txnId);
    await syncInstallmentTotal(slNo, txnType);
    UI.toast('Payment deleted successfully.', 'success');
    renderList();
    showTransactionHistory(slNo, txnType);
  } catch (err) {
    UI.toast('Error deleting payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

let currentEditingTxnId = null;

window.editCustomerTxnInline = function(txnId) {
  currentEditingTxnId = txnId;
  const slNo = Number(document.getElementById('txnSlNo').value);
  const txnType = document.getElementById('txnType').value || 'Customer';
  showTransactionHistory(slNo, txnType);
};

window.cancelCustomerTxnInline = function() {
  currentEditingTxnId = null;
  const slNo = Number(document.getElementById('txnSlNo').value);
  const txnType = document.getElementById('txnType').value || 'Customer';
  showTransactionHistory(slNo, txnType);
};

window.saveCustomerTxnInline = async function(txnId) {
  const dateInput = document.getElementById(`editTxnDate_${txnId}`);
  const amtInput = document.getElementById(`editTxnAmt_${txnId}`);
  const remInput = document.getElementById(`editTxnRem_${txnId}`);
  if (!dateInput || !amtInput) return;

  const newDate = dateInput.value;
  const newAmt = Number(amtInput.value) || 0;
  const newRem = remInput ? remInput.value.trim() : undefined;

  if (!newDate) {
    UI.toast('Please enter a valid payment date.', 'warning');
    dateInput.focus();
    return;
  }
  if (newAmt <= 0) {
    UI.toast('Please enter an amount greater than 0.', 'warning');
    amtInput.focus();
    return;
  }

  const txn = DB.getAll('installment_txns').find(t => t.TxnID === txnId);
  if (!txn) return;
  const slNo = txn.SlNo;
  const txnType = txn.TxnType || 'Customer';

  UI.showLoading(true);
  try {
    const updatePayload = {
      ...txn,
      TxnDate: newDate,
      Amount: newAmt
    };
    if (newRem !== undefined) {
      updatePayload.Remark = newRem;
    }
    await DB.update('installment_txns', t => t.TxnID === txnId, updatePayload);

    await syncInstallmentTotal(slNo, txnType);
    currentEditingTxnId = null;
    UI.toast(`Payment updated to ₹${Math.round(newAmt).toLocaleString('en-IN')}. Pending balance updated.`, 'success');
    renderList();
    showTransactionHistory(slNo, txnType);
  } catch (err) {
    UI.toast('Error updating payment: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.showTransactionHistory = function(slNo, txnType = 'Customer') {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  const txnSlNoEl = document.getElementById('txnSlNo');
  if (txnSlNoEl) txnSlNoEl.value = slNo;
  const txnTypeEl = document.getElementById('txnType');
  if (txnTypeEl) txnTypeEl.value = txnType;

  const newDateEl = document.getElementById('newTxnDate');
  if (newDateEl) newDateEl.value = UI.todayISO();
  const newAmtEl = document.getElementById('newTxnAmount');
  if (newAmtEl) newAmtEl.value = '';
  const newRemEl = document.getElementById('newTxnRemark');
  if (newRemEl) newRemEl.value = '';

  const isCust = (txnType === 'Customer');

  // Set the title
  const titleEl = document.getElementById('txnModalLabel');
  if (titleEl) {
    titleEl.textContent = isCust 
      ? `Customer Payment History — ${r.Name || 'Sl No ' + slNo}`
      : `Partner Payments — ${r.BrokerName || r.Name || 'Sl No ' + slNo}`;
  }

  // Toggle Add Payment form visibility: Hidden for Customer, Visible for Partner/Vendor
  const addSec = document.getElementById('divAddPaymentSection');
  if (addSec) {
    addSec.style.display = isCust ? 'none' : 'block';
  }
  const footerEl = document.getElementById('txnModalFooter');
  if (footerEl) {
    footerEl.style.display = isCust ? 'flex' : 'none';
  }

  // Fetch and display transaction history
  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === txnType || (txnType === 'Customer' && (!t.TxnType || t.TxnType === '')))
  );
  // Sort transactions by date (oldest first)
  txns.sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate));

  const feed = document.getElementById('txnHistoryFeed');
  if (feed) {
    if (isCust) {
      // Clean Date and Amount table with inline Modify and Delete for Customer
      if (txns.length === 0) {
        feed.innerHTML = `<div class="text-center text-muted py-4 fs-8">No payment transactions recorded yet.</div>`;
      } else {
        feed.innerHTML = `
          <table class="table table-sm table-hover table-bordered mb-0" style="font-size: 0.82rem;">
            <thead class="table-light">
              <tr>
                <th class="text-center" style="width: 40px;">Sl.</th>
                <th>Payment Date</th>
                <th class="text-end" style="min-width: 110px;">Amount</th>
                <th class="text-center no-print" style="width: 70px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map((t, idx) => {
                const isEditingThisTxn = (currentEditingTxnId === t.TxnID);
                if (isEditingThisTxn) {
                  return `
                    <tr class="table-warning">
                      <td class="text-center align-middle text-secondary fw-semibold">${idx + 1}</td>
                      <td class="align-middle p-1">
                        <input type="date" class="form-control form-control-sm fs-8 py-0.5 px-1" id="editTxnDate_${t.TxnID}" value="${t.TxnDate || ''}">
                      </td>
                      <td class="align-middle p-1">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text px-1 py-0 text-muted" style="font-size: 0.68rem;">₹</span>
                          <input type="number" step="any" class="form-control form-control-sm fs-8 py-0.5 px-1 text-end font-monospace fw-bold" id="editTxnAmt_${t.TxnID}" value="${Number(t.Amount) || 0}" onkeydown="if(event.key==='Enter') saveCustomerTxnInline('${t.TxnID}')">
                        </div>
                      </td>
                      <td class="text-center align-middle no-print p-1">
                        <div class="d-flex justify-content-center gap-1">
                          <button type="button" class="btn btn-sm btn-success p-0 d-inline-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="saveCustomerTxnInline('${t.TxnID}')" title="Save">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-secondary p-0 d-inline-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="cancelCustomerTxnInline()" title="Cancel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                } else {
                  return `
                    <tr>
                      <td class="text-center text-secondary align-middle">${idx + 1}</td>
                      <td class="align-middle font-monospace">${fmtDateExcel(t.TxnDate)}</td>
                      <td class="align-middle text-end font-monospace fw-bold text-dark">₹${Math.round(Number(t.Amount)).toLocaleString('en-IN')}</td>
                      <td class="text-center align-middle no-print">
                        <div class="d-flex justify-content-center gap-1">
                          <button type="button" class="btn btn-sm btn-outline-primary p-0 d-inline-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="editCustomerTxnInline('${t.TxnID}')" title="Modify Payment">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-danger p-0 d-inline-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="deleteInstallmentTxn('${t.TxnID}')" title="Delete Payment">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }
              }).join('')}
            </tbody>
          </table>
        `;
      }
    } else {
      // Partner / Vendor table with inline Modify and Delete
      if (txns.length === 0) {
        feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No partner payments recorded yet.</div>`;
      } else {
        feed.innerHTML = `
          <table class="table table-sm table-hover table-bordered mb-0" style="font-size: 0.82rem;">
            <thead class="table-light">
              <tr>
                <th class="text-center" style="width: 40px;">Sl.</th>
                <th>Payment Date</th>
                <th class="text-end" style="min-width: 100px;">Amount</th>
                <th>Remark</th>
                <th class="text-center no-print" style="width: 70px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map((t, idx) => {
                const isEditingThisTxn = (currentEditingTxnId === t.TxnID);
                if (isEditingThisTxn) {
                  return `
                    <tr class="table-warning">
                      <td class="text-center align-middle text-secondary fw-semibold">${idx + 1}</td>
                      <td class="align-middle p-1">
                        <input type="date" class="form-control form-control-sm fs-8 py-0.5 px-1" id="editTxnDate_${t.TxnID}" value="${t.TxnDate || ''}">
                      </td>
                      <td class="align-middle p-1">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text px-1 py-0 text-muted" style="font-size: 0.68rem;">₹</span>
                          <input type="number" step="any" class="form-control form-control-sm fs-8 py-0.5 px-1 text-end font-monospace fw-bold" id="editTxnAmt_${t.TxnID}" value="${Number(t.Amount) || 0}">
                        </div>
                      </td>
                      <td class="align-middle p-1">
                        <input type="text" class="form-control form-control-sm fs-8 py-0.5 px-1" id="editTxnRem_${t.TxnID}" value="${t.Remark || ''}" placeholder="Remark" onkeydown="if(event.key==='Enter') saveCustomerTxnInline('${t.TxnID}')">
                      </td>
                      <td class="text-center align-middle no-print p-1">
                        <div class="d-flex justify-content-center gap-1">
                          <button type="button" class="btn btn-sm btn-success p-0 d-inline-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="saveCustomerTxnInline('${t.TxnID}')" title="Save">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-secondary p-0 d-inline-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="cancelCustomerTxnInline()" title="Cancel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                } else {
                  return `
                    <tr>
                      <td class="text-center text-secondary align-middle">${idx + 1}</td>
                      <td class="align-middle font-monospace">${fmtDateExcel(t.TxnDate)}</td>
                      <td class="align-middle text-end font-monospace fw-bold text-dark">₹${Math.round(Number(t.Amount)).toLocaleString('en-IN')}</td>
                      <td class="align-middle text-secondary fs-8">${t.Remark || '—'}</td>
                      <td class="text-center align-middle no-print">
                        <div class="d-flex justify-content-center gap-1">
                          <button type="button" class="btn btn-sm btn-outline-primary p-0 d-inline-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="editCustomerTxnInline('${t.TxnID}')" title="Modify Payment">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                          <button type="button" class="btn btn-sm btn-outline-danger p-0 d-inline-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="deleteInstallmentTxn('${t.TxnID}')" title="Delete Payment">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }
              }).join('')}
            </tbody>
          </table>
        `;
      }
    }
  }

  // Update total label
  updateTxnModalTotal();

  // Show modal
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('transactionModal'));
  modal.show();
};

function updateTxnModalTotal() {
  const slNo = Number(document.getElementById('txnSlNo').value);
  const txnType = document.getElementById('txnType').value || 'Customer';
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));

  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === txnType || (txnType === 'Customer' && (!t.TxnType || t.TxnType === '')))
  );
  const totalPaid = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

  const lblTotal = document.getElementById('lblTxnTotal');
  if (lblTotal) lblTotal.textContent = '₹' + Math.round(totalPaid).toLocaleString('en-IN');

  const lblPending = document.getElementById('lblTxnPending');
  if (lblPending && r) {
    let targetPrice = 0;
    if (txnType === 'Customer') {
      targetPrice = Number(r.CommittedPrice) || 0;
    } else {
      let expenses = null;
      if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
        try {
          const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
          expenses = JSON.parse(jsonStr);
        } catch (e) {}
      }
      const partnerPrice = (expenses && expenses.partner) || 0;
      const custPrice = Number(r.CommittedPrice) || 0;
      targetPrice = custPrice - partnerPrice;
    }
    const pendingAmount = targetPrice - totalPaid;
    if (pendingAmount >= 0) {
      lblPending.textContent = '₹' + Math.round(pendingAmount).toLocaleString('en-IN');
      lblPending.className = 'fw-bold text-danger font-monospace fs-6';
    } else {
      lblPending.textContent = '+₹' + Math.round(Math.abs(pendingAmount)).toLocaleString('en-IN') + ' (Overpaid)';
      lblPending.className = 'fw-bold text-primary font-monospace fs-6';
    }
  }
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
    renderList();
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

let currentCustomerDetailsSlNo = null;

window.showCustomerDetailsPopup = function(slNo) {
  currentCustomerDetailsSlNo = slNo;
  const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('customerDetailsModalTitle').textContent = `${r.Name} (${r.District || 'No District'})`;
  if (document.getElementById('detConsumerNo')) document.getElementById('detConsumerNo').textContent = r.ConsumerNo || '—';
  document.getElementById('detMobile').textContent = r.MobileNumber || '—';
  document.getElementById('detBrand').textContent = r.CommittedBrand || '—';
  const addrParts = [];
  if (r.Address) addrParts.push(r.Address);
  if (r.District) addrParts.push(`District: ${r.District}`);
  addrParts.push(`State: ${r.State || 'Odisha'}`);
  if (r.PinCode) addrParts.push(`Pin: ${r.PinCode}`);
  const fullAddr = addrParts.join(', ') || '—';
  document.getElementById('detAddress').textContent = fullAddr.toUpperCase();

  // Clear new note textarea
  const noteInput = document.getElementById('detNewNoteText');
  if (noteInput) noteInput.value = '';

  renderCustomerPopupNotes(slNo);

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('customerDetailsModal'));
  modal.show();
};

function renderCustomerPopupNotes(slNo) {
  const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(slNo) && (n.Type === 'Customer' || !n.Type));
  remarks.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

  const remarksContainer = document.getElementById('detNotesList');
  if (remarksContainer) {
    if (remarks.length === 0) {
      remarksContainer.innerHTML = '<div class="text-muted text-center py-3 fs-8 bg-light rounded border border-dashed">No notes added yet. Use the box above to add one.</div>';
    } else {
      remarksContainer.innerHTML = remarks.map(t => {
        let formattedDate = '';
        try {
          const dt = new Date(t.CreatedAt || Date.now());
          const datePart = fmtDateExcel(dt);
          const timePart = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          formattedDate = `${datePart} ${timePart}`;
        } catch (e) {
          formattedDate = t.CreatedAt;
        }
        return `
          <div class="card border-0 shadow-sm p-2.5 position-relative" style="background-color: #fefce8; border-left: 3px solid #ca8a04 !important; border-radius: 4px;">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-semibold text-secondary" style="font-size: 0.7rem;">Note • ${formattedDate}</span>
              <button type="button" class="btn btn-sm btn-link text-danger p-0 text-decoration-none fw-bold" onclick="deleteCustomerPopupNote('${t.RemarkID}')" title="Delete Note" style="font-size: 0.8rem; line-height: 1;">✕</button>
            </div>
            <div class="text-dark fw-medium fs-7" style="white-space: pre-wrap; word-break: break-word;">${t.Remark}</div>
          </div>
        `;
      }).join('');
    }
  }
}

window.saveCustomerPopupNote = async function() {
  if (!currentCustomerDetailsSlNo) return;
  const noteInput = document.getElementById('detNewNoteText');
  const remarkText = noteInput ? noteInput.value.trim() : '';

  if (!remarkText) {
    UI.toast('Please enter a note before saving.', 'warning');
    if (noteInput) noteInput.focus();
    return;
  }

  UI.showLoading(true);
  try {
    const note = {
      RemarkID: Utils.uid('RMK'),
      SlNo: currentCustomerDetailsSlNo,
      Type: 'Customer',
      Remark: remarkText,
      CreatedAt: new Date().toISOString()
    };
    await DB.insert('installment_remarks', note);
    if (noteInput) noteInput.value = '';
    UI.toast('Note added successfully.', 'success');
    renderCustomerPopupNotes(currentCustomerDetailsSlNo);
    renderList();
  } catch (err) {
    UI.toast('Error adding note: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.deleteCustomerPopupNote = async function(remarkId) {
  const remark = DB.getAll('installment_remarks').find(t => t.RemarkID === remarkId);
  if (!remark) return;

  const ok = await UI.confirmDialog('Are you sure you want to delete this note?', 'Delete Note', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installment_remarks', t => t.RemarkID === remarkId);
    UI.toast('Note deleted.', 'success');
    renderCustomerPopupNotes(currentCustomerDetailsSlNo);
    renderList();
  } catch (err) {
    UI.toast('Error deleting note: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
};

window.showPartnerDetailsPopup = function(slNo) {
  const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('partnerDetailsModalTitle').textContent = r.BrokerName || 'Partner Details';
  document.getElementById('detPartnerPhone').textContent = (r.BrokerNumber || '').split('|')[0] || '—';

  const loginRow = document.getElementById('detPartnerLoginDateRow');
  if (loginRow) {
    if (r.LoginDate) {
      loginRow.style.display = 'block';
      const info = getDelayInfo(r.LoginDate);
      document.getElementById('detPartnerLoginDate').textContent = fmtDateExcel(r.LoginDate);
      const delayBadge = document.getElementById('detPartnerLoginDelayBadge');
      if (delayBadge && info) {
        delayBadge.textContent = `(${info.text})`;
        delayBadge.className = `badge erp-delay-badge delay-${info.colorType} font-monospace fs-8`;
        delayBadge.title = `${info.totalDays} days delay`;
      }
    } else {
      loginRow.style.display = 'none';
    }
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('partnerDetailsModal'));
  modal.show();
};

window.showTimestampDetailsPopup = function(slNo) {
  const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  const titleEl = document.getElementById('tsModalTitle');
  if (titleEl) {
    titleEl.textContent = `Timestamp Details — ${r.Name || ''}${r.District ? ' (' + r.District + ')' : ''}`;
  }

  const loginDateStr = fmtDateExcel(r.LoginDate) || '—';
  const loginDelayInfo = getDelayInfo(r.LoginDate);
  document.getElementById('tsModalLoginDate').textContent = loginDateStr;
  const loginDelayEl = document.getElementById('tsModalLoginDelay');
  if (loginDelayEl) {
    if (loginDelayInfo) {
      loginDelayEl.textContent = `(${loginDelayInfo.text})`;
      loginDelayEl.className = `badge erp-delay-badge delay-${loginDelayInfo.colorType} font-monospace fs-8`;
      loginDelayEl.title = `${loginDelayInfo.totalDays} days delay`;
    } else {
      loginDelayEl.textContent = '—';
      loginDelayEl.className = 'badge bg-primary-subtle text-primary-emphasis font-monospace fs-8';
    }
  }

  const instDateStr = fmtDateExcel(r.InstallationDate) || '—';
  const instDelay = calculateInstDelay(r.LoginDate, r.InstallationDate);
  document.getElementById('tsModalInstDate').textContent = instDateStr;
  document.getElementById('tsModalInstDelay').textContent = instDelay ? `(${instDelay})` : '—';

  const commDateStr = fmtDateExcel(r.CommissioningDate) || '—';
  const commDelay = calculateCommDelay(r.CommissioningDate, r.InstallationDate);
  document.getElementById('tsModalCommDate').textContent = commDateStr;
  document.getElementById('tsModalCommDelay').textContent = commDelay ? `(${commDelay})` : '—';

  const modalEl = document.getElementById('timestampDetailsModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
};

window.showInstallmentNotes = function(slNo, filterType = 'Customer') {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('noteSlNo').value = slNo;
  document.getElementById('newNoteText').value = '';
  document.getElementById('newNoteType').value = filterType;

  // Toggle type selector visibility (hide in simple notes view)
  const typeWrapper = document.getElementById('divNoteTypeWrapper');
  if (typeWrapper) {
    typeWrapper.style.display = 'none';
  }

  document.getElementById('notesModalLabel').textContent = 
    filterType === 'Customer' 
      ? `Customer Notes — ${r.Name}` 
      : `Partner Notes — ${r.BrokerName || '—'}`;

  // Filter based on filterType
  const remarks = DB.getAll('installment_remarks').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (filterType === 'Customer' ? (t.Type === 'Customer' || !t.Type) : t.Type === 'Partner')
  );
  remarks.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

  const feed = document.getElementById('notesHistoryFeed');
  if (remarks.length === 0) {
    feed.innerHTML = `<div class="text-center text-muted py-3 fs-8">No remarks recorded yet.</div>`;
  } else {
    feed.innerHTML = remarks.map(t => {
      const typeBadgeClass = t.Type === 'Customer' || !t.Type ? 'bg-primary-subtle text-primary-emphasis' : 'bg-warning-subtle text-warning-emphasis';
      const cardTypeClass = t.Type === 'Customer' || !t.Type ? 'note-card-customer' : 'note-card-Partner';
      const displayType = t.Type || 'Customer';
      
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
              <span class="note-type-badge ${typeBadgeClass}">${displayType} Specific</span>
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
  const type = remark.Type || 'Customer';

  const ok = await UI.confirmDialog(`Are you sure you want to delete this remark?`, 'Delete Note', 'Delete', 'btn-danger');
  if (!ok) return;

  UI.showLoading(true);
  try {
    await DB.remove('installment_remarks', t => t.RemarkID === remarkId);
    UI.toast('Note deleted successfully.', 'success');
    showInstallmentNotes(slNo, type);
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
      if (document.getElementById('cConsumerNo')) document.getElementById('cConsumerNo').value = r.ConsumerNo || '';
      document.getElementById('cMobile').value = r.MobileNumber || '';
      document.getElementById('cDistrict').value = r.District || '';
      if (document.getElementById('cPinCode')) document.getElementById('cPinCode').value = r.PinCode || '';
      if (document.getElementById('cState')) document.getElementById('cState').value = r.State || 'Odisha';
      document.getElementById('cAddress').value = r.Address || '';
      document.getElementById('cBrand').value = r.CommittedBrand || '';
      document.getElementById('cPrice').value = r.CommittedPrice || '';
      document.getElementById('cVendorPrice').value = r.VendorPrice || '';
      document.getElementById('cLoginDate').value = r.LoginDate ? new Date(r.LoginDate).toISOString().slice(0, 10) : '';
      if (document.getElementById('cInstallationDate')) {
        document.getElementById('cInstallationDate').value = r.InstallationDate ? new Date(r.InstallationDate).toISOString().slice(0, 10) : '';
      }
      if (document.getElementById('cCommissioningDate')) {
        document.getElementById('cCommissioningDate').value = r.CommissioningDate ? new Date(r.CommissioningDate).toISOString().slice(0, 10) : '';
      }
      document.getElementById('cBrokerName').value = r.BrokerName || '';
      if (document.getElementById('cBrokerNumber')) {
        document.getElementById('cBrokerNumber').value = (r.BrokerNumber || '').split('|')[0];
      }
      document.getElementById('cCommission').value = r.Commission || '';

      let expenses = null;
      if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
        try {
          expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]);
        } catch(e) { console.error(e); }
      }
      document.getElementById('cMaterialCost').value = (expenses && expenses.material) || 0;
      document.getElementById('cPartnerPrice').value = (expenses && expenses.partner) || 0;
      document.getElementById('cInstallationCost').value = (expenses && expenses.install) || 0;
      document.getElementById('cTransportCost').value = (expenses && expenses.transport) || 0;
      const defaultGstVal = (expenses && expenses.gst_pct !== undefined && expenses.gst_pct !== null && expenses.gst_pct !== '') ? expenses.gst_pct : ((typeof Utils !== 'undefined' && Utils.getDefaultGST) ? Utils.getDefaultGST(18) : 18);
      document.getElementById('cGSTPercentage').value = defaultGstVal;
      document.getElementById('cOtherCost').value = (expenses && expenses.other) || 0;
      if (document.getElementById('cNetMeterPayment')) {
        const netMeterVal = (r.NetMeterPayment != null && r.NetMeterPayment !== '') ? r.NetMeterPayment : ((expenses && expenses.net_meter_payment != null && expenses.net_meter_payment !== '') ? expenses.net_meter_payment : '');
        document.getElementById('cNetMeterPayment').value = netMeterVal;
      }
      if (document.getElementById('cNetMeterPaid')) {
        const isPaid = (r.NetMeterPaid != null) ? !!r.NetMeterPaid : !!(expenses && expenses.net_meter_paid);
        document.getElementById('cNetMeterPaid').checked = isPaid;
      }
    }
  } else {
    ['cName', 'cConsumerNo', 'cMobile', 'cAddress', 'cBrand', 'cPinCode', 'cPrice', 'cVendorPrice', 'cLoginDate', 'cInstallationDate', 'cCommissioningDate', 'cBrokerName', 'cBrokerNumber', 'cCommission', 'cMaterialCost', 'cPartnerPrice', 'cInstallationCost', 'cTransportCost', 'cGSTPercentage', 'cOtherCost', 'cProfit', 'cNetMeterPayment'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('cGSTPercentage')) {
      document.getElementById('cGSTPercentage').value = (typeof Utils !== 'undefined' && Utils.getDefaultGST) ? Utils.getDefaultGST(18) : 18;
    }
    if (document.getElementById('cNetMeterPaid')) {
      document.getElementById('cNetMeterPaid').checked = false;
    }
    document.getElementById('cDistrict').value = '';
    if (document.getElementById('cState')) document.getElementById('cState').value = 'Odisha';
    document.getElementById('cLoginDate').value = UI.todayISO();
  }

  updateModalLoginDelayBadge();

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

  const currentUser = Auth.getUser();
  if (currentUser && (currentUser.role === 'partner' || currentUser.role === 'associates')) {
    if (brokerInput && !slNo) {
      brokerInput.value = currentUser.username;
    }
    if (!slNo) {
      const foundVendor = vendors.find(v => v.VendorName === currentUser.username);
      if (foundVendor && foundVendor.Phone) {
        const phoneInput = document.getElementById('cBrokerNumber');
        if (phoneInput) phoneInput.value = foundVendor.Phone;
      }
    }
  }
  if (brokerInput) {
    brokerInput.disabled = false;
  }

  const updateModalCalculations = () => {
    const custPriceVal = Number(document.getElementById('cPrice').value) || 0;
    const gstPct = Number(document.getElementById('cGSTPercentage').value) || 0;
    const gstVal = custPriceVal * (gstPct / 100);

    const gstLabel = document.getElementById('lblGSTAmount');
    if (gstLabel) {
      gstLabel.textContent = '₹' + gstVal.toFixed(2);
    }

    const mat = Number(document.getElementById('cMaterialCost').value) || 0;
    const inst = Number(document.getElementById('cInstallationCost').value) || 0;
    const trans = Number(document.getElementById('cTransportCost').value) || 0;
    const oth = Number(document.getElementById('cOtherCost').value) || 0;

    const totalExpense = mat + inst + trans + gstVal + oth;

    const totalField = document.getElementById('cVendorPrice');
    if (totalField) {
      totalField.value = totalExpense.toFixed(2);
    }

    // Profit calculation: Partner Price - Commission - Total Expense
    const partnerPrice = Number(document.getElementById('cPartnerPrice').value) || 0;
    const comm = Number(document.getElementById('cCommission').value) || 0;
    const profitVal = partnerPrice - comm - totalExpense;

    const profitField = document.getElementById('cProfit');
    if (profitField) {
      profitField.value = profitVal.toFixed(2);
      if (profitVal >= 0) {
        profitField.style.color = '#198754';
      } else {
        profitField.style.color = '#dc3545';
      }
    }
  };

  const cPriceInput = document.getElementById('cPrice');
  if (cPriceInput) {
    cPriceInput.addEventListener('input', updateModalCalculations);
  }

  const cCommissionInput = document.getElementById('cCommission');
  if (cCommissionInput) {
    cCommissionInput.addEventListener('input', updateModalCalculations);
  }

  const calcInputs = document.querySelectorAll('.expense-calc-modal');
  calcInputs.forEach(input => {
    input.addEventListener('input', updateModalCalculations);
  });

  // Run initial calculation once
  updateModalCalculations();

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

  const currentUser = Auth.getUser();
  let creatorSuffix = '';
  if (slNoVal) {
    const slNo = Number(slNoVal);
    const existing = DB.getAll('installments').find(x => Number(x.SlNo) === slNo);
    if (existing && (existing.BrokerNumber || '').includes('|creator:')) {
      creatorSuffix = '|creator:' + existing.BrokerNumber.split('|creator:')[1].split('|')[0];
    }
  }
  if (!creatorSuffix && currentUser) {
    creatorSuffix = '|creator:' + currentUser.userid;
  }

  const custPriceVal = Number(document.getElementById('cPrice').value) || 0;
  const gstPctVal = Number(document.getElementById('cGSTPercentage').value) || 0;
  const calculatedGSTAmount = custPriceVal * (gstPctVal / 100);

  const existingRow = slNoVal ? (DB.getAll('installments') || []).find(x => Number(x.SlNo) === Number(slNoVal)) : null;

  const expenses = {
    material: Number(document.getElementById('cMaterialCost').value) || 0,
    partner: Number(document.getElementById('cPartnerPrice').value) || 0,
    install: Number(document.getElementById('cInstallationCost').value) || 0,
    transport: Number(document.getElementById('cTransportCost').value) || 0,
    gst_pct: gstPctVal,
    gst: calculatedGSTAmount,
    other: Number(document.getElementById('cOtherCost').value) || 0,
    net_meter_payment: document.getElementById('cNetMeterPayment') ? (Number(document.getElementById('cNetMeterPayment').value) || 0) : (existingRow ? (existingRow.NetMeterPayment || 0) : 0),
    net_meter_paid: document.getElementById('cNetMeterPaid') ? document.getElementById('cNetMeterPaid').checked : (existingRow ? !!existingRow.NetMeterPaid : false)
  };
  const calculatedVendorPrice = expenses.material + expenses.install + expenses.transport + expenses.gst + expenses.other;
  const cBrokerNumEl = document.getElementById('cBrokerNumber');
  let phoneClean = cBrokerNumEl ? cBrokerNumEl.value.trim().split('|')[0] : '';
  if (!phoneClean && slNoVal) {
    if (existingRow && existingRow.BrokerNumber) {
      phoneClean = existingRow.BrokerNumber.split('|')[0];
    }
  }
  if (!phoneClean) {
    const brokerName = document.getElementById('cBrokerName') ? document.getElementById('cBrokerName').value.trim() : '';
    if (brokerName) {
      const vendors = DB.getAll('vendors') || [];
      const foundVendor = vendors.find(v => v.VendorName === brokerName);
      if (foundVendor && foundVendor.Phone) {
        phoneClean = foundVendor.Phone;
      }
    }
  }

  const rowData = {
    Name: name,
    ConsumerNo: document.getElementById('cConsumerNo') ? document.getElementById('cConsumerNo').value.trim() : '',
    MobileNumber: document.getElementById('cMobile').value.trim(),
    District: document.getElementById('cDistrict').value,
    PinCode: document.getElementById('cPinCode') ? document.getElementById('cPinCode').value.trim() : '',
    State: document.getElementById('cState') ? document.getElementById('cState').value.trim() : 'Odisha',
    Address: document.getElementById('cAddress').value.trim(),
    CommittedBrand: document.getElementById('cBrand').value.trim(),
    CommittedPrice: Number(document.getElementById('cPrice').value) || 0,
    VendorPrice: calculatedVendorPrice,
    LoginDate: document.getElementById('cLoginDate').value || null,
    InstallationDate: document.getElementById('cInstallationDate') ? (document.getElementById('cInstallationDate').value || null) : (existingRow ? (existingRow.InstallationDate || null) : null),
    CommissioningDate: document.getElementById('cCommissioningDate') ? (document.getElementById('cCommissioningDate').value || null) : (existingRow ? (existingRow.CommissioningDate || null) : null),
    BrokerName: document.getElementById('cBrokerName').value.trim(),
    BrokerNumber: phoneClean + creatorSuffix + '|expenses:' + JSON.stringify(expenses),
    Commission: Number(document.getElementById('cCommission').value) || 0,
    NetMeterPayment: expenses.net_meter_payment,
    NetMeterPaid: expenses.net_meter_paid
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
      rowData.VendorPaid = 0;
      rowData.CommissionPaid = 0;
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

function initResizableColumns() {
  const table = document.getElementById('installmentsTable');
  if (!table) return;
  const cols = table.querySelectorAll('thead th');
  cols.forEach(col => {
    if (col.querySelector('.col-resizer')) return;

    const resizer = document.createElement('div');
    resizer.classList.add('col-resizer');
    col.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e) => {
      const w = startWidth + (e.clientX - startX);
      col.style.width = w + 'px';
      col.style.minWidth = w + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizer.classList.remove('resizing');
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = col.offsetWidth;
      resizer.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

/* ══ Excel Import, Preview, verification, TXT Export, and Database Saving Helpers ══ */
let parsedCustomers = [];
let parsedConflictingCustomers = [];
let parsedIdenticalCount = 0;
let parsedMissingCustomers = [];

async function handleExcelImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  UI.showLoading(true);

  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData || jsonData.length === 0) {
        UI.toast('The uploaded Excel file contains no data.', 'danger');
        return;
      }

      // Map columns case-insensitively
      const sampleRow = jsonData[0];
      const keys = Object.keys(sampleRow);

      const nameKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'consumer name' || lk === 'name' || lk === 'customer name' || lk === 'consumername';
      });

      const consumerNoKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'consumer no' || lk === 'consumer no.' || lk === 'consumer number' || lk === 'consumer_no' || lk === 'consumerno' || lk === 'consumer id' || lk === 'consumerid' || lk === 'account no' || lk === 'ca no' || lk === 'consumer #' || lk === 'consumer_id' || lk === 'c.a. no' || lk === 'cano';
      });

      const mobileKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'mobile no.' || lk === 'mobile no' || lk === 'mobile' || lk === 'mobile number' || lk === 'phone' || lk === 'phonenumber' || lk === 'mobileno';
      });

      const districtKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'district' || lk === 'dist';
      });

      const brokerKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'broker' || lk === 'partner' || lk === 'broker name' || lk === 'partner name' || lk === 'broker/partner name';
      });

      const addressKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'address' || lk === 'full address' || lk === 'location';
      });

      const loginDateKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'submitted on' || lk === 'submitted_on' || lk === 'submitted date' || lk === 'submission date' || lk === 'submission on' || lk === 'login date' || lk === 'logindate' || lk === 'login_date' || lk === 'application date' || lk === 'applied on' || lk === 'submission_date';
      });

      if (!nameKey) {
        UI.toast('Invalid format! Could not find "Consumer Name" or "Name" column.', 'danger');
        return;
      }

      // Get existing grid records to check duplicates, differences, and missing rows
      const existingRecords = DB.getAll('installments') || [];
      const seenNamesInExcel = new Set();
      
      parsedCustomers = [];
      parsedConflictingCustomers = [];
      parsedIdenticalCount = 0;
      parsedMissingCustomers = [];

      const excelNamesSet = new Set();
      const norm = (v) => (v ? String(v).trim().toLowerCase() : '');

      jsonData.forEach((row) => {
        const rawName = String(row[nameKey] || '').trim();
        if (!rawName) return; // skip empty name rows

        const rawConsumerNo = consumerNoKey ? String(row[consumerNoKey] || '').trim() : '';
        const rawMobile = mobileKey ? String(row[mobileKey] || '').trim() : '';
        const rawDistrict = districtKey ? String(row[districtKey] || '').trim() : '';
        const rawBroker = brokerKey ? String(row[brokerKey] || '').trim() : '';
        const rawAddress = addressKey ? String(row[addressKey] || '').trim() : '';
        const rawLoginDate = loginDateKey ? parseExcelDate(row[loginDateKey]) : '';

        const cleanNameVal = cleanName(rawName);
        excelNamesSet.add(cleanNameVal);

        // 1. Check if already in database/grid by Name
        const gridMatch = existingRecords.find(r => cleanName(r.Name) === cleanNameVal);

        if (gridMatch) {
          // Compare values between Grid and Excel
          const cNoDiff = norm(gridMatch.ConsumerNo) !== norm(rawConsumerNo) && Boolean(rawConsumerNo);
          const mobDiff = norm(gridMatch.MobileNumber) !== norm(rawMobile) && Boolean(rawMobile);
          const distDiff = norm(gridMatch.District) !== norm(rawDistrict) && Boolean(rawDistrict);
          const brokerDiff = norm(gridMatch.BrokerName) !== norm(rawBroker) && Boolean(rawBroker);
          const addrDiff = norm(gridMatch.Address) !== norm(rawAddress) && Boolean(rawAddress);
          const loginDiff = rawLoginDate && gridMatch.LoginDate && norm(gridMatch.LoginDate) !== norm(rawLoginDate);

          const hasDifferences = cNoDiff || mobDiff || distDiff || brokerDiff || addrDiff || loginDiff;

          if (!hasDifferences) {
            // BOTH ARE 100% IDENTICAL! Auto-skip (do not display 2 times or show checkbox)
            parsedIdenticalCount++;
          } else {
            // DATA HAS DIFFERENCES! Add to conflict comparison list
            parsedConflictingCustomers.push({
              SlNo: gridMatch.SlNo,
              Name: gridMatch.Name,
              GridData: {
                ConsumerNo: gridMatch.ConsumerNo || '',
                MobileNumber: gridMatch.MobileNumber || '',
                District: gridMatch.District || '',
                BrokerName: gridMatch.BrokerName || '',
                Address: gridMatch.Address || '',
                LoginDate: gridMatch.LoginDate || ''
              },
              ExcelData: {
                ConsumerNo: rawConsumerNo || gridMatch.ConsumerNo || '',
                MobileNumber: rawMobile || gridMatch.MobileNumber || '',
                District: rawDistrict || gridMatch.District || '',
                BrokerName: rawBroker || gridMatch.BrokerName || '',
                Address: rawAddress || gridMatch.Address || '',
                LoginDate: rawLoginDate || gridMatch.LoginDate || ''
              },
              Diffs: {
                ConsumerNo: cNoDiff,
                MobileNumber: mobDiff,
                District: distDiff,
                BrokerName: brokerDiff,
                Address: addrDiff,
                LoginDate: loginDiff
              },
              SelectedChoice: 'EXCEL' // Default selection
            });
          }
        } 
        // 2. Check if duplicate within the Excel itself
        else if (seenNamesInExcel.has(cleanNameVal)) {
          parsedCustomers.push({
            Name: rawName,
            ConsumerNo: rawConsumerNo,
            MobileNumber: rawMobile,
            District: rawDistrict,
            BrokerName: rawBroker,
            LoginDate: rawLoginDate || UI.todayISO(),
            Status: 'Duplicate (In Excel)',
            IsDuplicate: true
          });
        } else {
          // BRAND NEW CUSTOMER
          seenNamesInExcel.add(cleanNameVal);
          parsedCustomers.push({
            Name: rawName,
            ConsumerNo: rawConsumerNo,
            MobileNumber: rawMobile,
            District: rawDistrict,
            BrokerName: rawBroker,
            LoginDate: rawLoginDate || UI.todayISO(),
            Status: 'New Name',
            IsDuplicate: false
          });
        }
      });

      // Find grid records missing in the Excel file
      existingRecords.forEach(r => {
        const cleanGridName = cleanName(r.Name);
        if (!excelNamesSet.has(cleanGridName)) {
          parsedMissingCustomers.push({
            Name: r.Name,
            ConsumerNo: r.ConsumerNo || '',
            MobileNumber: r.MobileNumber || '',
            District: r.District || '',
            BrokerName: r.BrokerName || '',
            LoginDate: r.LoginDate || '',
            Status: 'Missing in Excel'
          });
        }
      });

      if (parsedCustomers.length === 0 && parsedConflictingCustomers.length === 0 && parsedIdenticalCount === 0) {
        UI.toast('No customer names found in the Excel file.', 'warning');
        return;
      }

      renderImportPreviewModal();

    } catch (err) {
      console.error(err);
      UI.toast('Error reading Excel file: ' + err.message, 'danger');
    } finally {
      UI.showLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  reader.onerror = function() {
    UI.toast('Error reading file as array buffer.', 'danger');
    UI.showLoading(false);
    e.target.value = '';
  };

  reader.readAsArrayBuffer(file);
}

function cleanName(n) {
  return n ? n.toLowerCase().replace(/\s+/g, ' ').trim() : '';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

window.bulkSelectConflictChoice = function(choice) {
  parsedConflictingCustomers.forEach(c => { c.SelectedChoice = choice; });
  renderImportPreviewModal();
};

window.setConflictChoice = function(index, choice) {
  if (parsedConflictingCustomers[index]) {
    parsedConflictingCustomers[index].SelectedChoice = choice;
    renderImportPreviewModal();
  }
};

function renderImportPreviewModal() {
  // Render Summary Badges
  const badgesContainer = document.getElementById('importSummaryBadges');
  if (badgesContainer) {
    const newCount = parsedCustomers.filter(c => !c.IsDuplicate).length;
    badgesContainer.innerHTML = `
      <span class="badge bg-success-subtle text-success-emphasis border border-success-subtle px-2 py-0.5 fs-8">New Customers: ${newCount}</span>
      <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-0.5 fs-8">Data Differences: ${parsedConflictingCustomers.length}</span>
      <span class="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle px-2 py-0.5 fs-8">Identical (Skipped): ${parsedIdenticalCount}</span>
      <span class="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle px-2 py-0.5 fs-8">Missing in Excel: ${parsedMissingCustomers.length}</span>
    `;
  }

  // 1. Render Conflicting Records (Grid vs Excel comparison)
  const conflictContainer = document.getElementById('conflictContainer');
  const conflictSection = document.getElementById('conflictSection');

  if (conflictContainer && conflictSection) {
    if (parsedConflictingCustomers.length === 0) {
      conflictSection.style.display = 'none';
    } else {
      conflictSection.style.display = 'block';
      conflictContainer.innerHTML = parsedConflictingCustomers.map((item, idx) => {
        const isExcel = item.SelectedChoice === 'EXCEL';
        const isGrid = item.SelectedChoice === 'GRID';

        const fmtVal = (diff, val) => diff ? `<mark class="bg-warning text-dark px-1.5 py-0.5 rounded font-monospace fw-bold">${escapeHtml(val || '—')}</mark>` : escapeHtml(val || '—');

        return `
          <div class="card border shadow-sm p-2.5 bg-white rounded-1">
            <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
              <span class="fw-bold text-dark fs-7">${escapeHtml(item.Name)} <small class="text-muted font-monospace">(Sl. #${item.SlNo})</small></span>
              <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fs-8">Difference Detected</span>
            </div>
            
            <div class="row g-2">
              <!-- Option A: Current Excel Data -->
              <div class="col-md-6">
                <div class="border rounded-1 p-2.5 h-100 ${isExcel ? 'border-primary bg-primary-subtle bg-opacity-10 shadow-sm' : 'bg-light'}" style="font-size: 0.82rem;">
                  <div class="form-check mb-1">
                    <input class="form-check-input" type="radio" name="conflictChoice_${idx}" id="choiceExcel_${idx}" value="EXCEL" ${isExcel ? 'checked' : ''} onchange="window.setConflictChoice(${idx}, 'EXCEL')">
                    <label class="form-check-label fw-bold text-primary" for="choiceExcel_${idx}">
                      Save Current Excel Data (Overwrite)
                    </label>
                  </div>
                  <div class="ps-3 d-flex flex-column gap-1 text-secondary mt-2" style="font-size:0.78rem;">
                    <div><strong>Consumer No:</strong> ${fmtVal(item.Diffs.ConsumerNo, item.ExcelData.ConsumerNo)}</div>
                    <div><strong>Mobile Number:</strong> ${fmtVal(item.Diffs.MobileNumber, item.ExcelData.MobileNumber)}</div>
                    <div><strong>Submitted On (Login Date):</strong> ${fmtVal(item.Diffs.LoginDate, item.ExcelData.LoginDate ? fmtDateExcel(item.ExcelData.LoginDate) : '—')}</div>
                    <div><strong>District:</strong> ${fmtVal(item.Diffs.District, item.ExcelData.District)}</div>
                    <div><strong>Partner Name:</strong> ${fmtVal(item.Diffs.BrokerName, item.ExcelData.BrokerName)}</div>
                  </div>
                </div>
              </div>

              <!-- Option B: Previous Grid Data -->
              <div class="col-md-6">
                <div class="border rounded-1 p-2.5 h-100 ${isGrid ? 'border-secondary bg-secondary-subtle bg-opacity-10 shadow-sm' : 'bg-light'}" style="font-size: 0.82rem;">
                  <div class="form-check mb-1">
                    <input class="form-check-input" type="radio" name="conflictChoice_${idx}" id="choiceGrid_${idx}" value="GRID" ${isGrid ? 'checked' : ''} onchange="window.setConflictChoice(${idx}, 'GRID')">
                    <label class="form-check-label fw-bold text-secondary" for="choiceGrid_${idx}">
                      💾 Keep Previously Saved Data (Grid Data)
                    </label>
                  </div>
                  <div class="ps-3 d-flex flex-column gap-1 text-secondary mt-2" style="font-size:0.78rem;">
                    <div><strong>Consumer No:</strong> ${escapeHtml(item.GridData.ConsumerNo || '—')}</div>
                    <div><strong>Mobile Number:</strong> ${escapeHtml(item.GridData.MobileNumber || '—')}</div>
                    <div><strong>Login Date:</strong> ${escapeHtml(item.GridData.LoginDate ? fmtDateExcel(item.GridData.LoginDate) : '—')}</div>
                    <div><strong>District:</strong> ${escapeHtml(item.GridData.District || '—')}</div>
                    <div><strong>Partner Name:</strong> ${escapeHtml(item.GridData.BrokerName || '—')}</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render New Customers
  const tbody = document.querySelector('#importPreviewTable tbody');
  const newCustomersSection = document.getElementById('newCustomersSection');

  if (tbody && newCustomersSection) {
    tbody.innerHTML = '';
    const newItems = parsedCustomers.filter(c => !c.IsDuplicate);

    if (newItems.length === 0) {
      newCustomersSection.style.display = 'none';
    } else {
      newCustomersSection.style.display = 'block';
      parsedCustomers.forEach((c, index) => {
        if (c.IsDuplicate) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center">
            <input type="checkbox" class="chk-import-row" data-index="${index}" checked>
          </td>
          <td class="text-center">${index + 1}</td>
          <td class="fw-semibold">${escapeHtml(c.Name)}</td>
          <td class="font-monospace">${escapeHtml(c.ConsumerNo || '—')}</td>
          <td>${escapeHtml(c.MobileNumber || '—')}</td>
          <td>${c.LoginDate ? `<span class="font-monospace">${fmtDateExcel(c.LoginDate)}</span> ${getDelayBadgeHtml(c.LoginDate)}` : '—'}</td>
          <td>
            <div class="position-relative">
              <input type="text" class="form-control form-control-sm import-district-input" id="importDistrict_${index}" placeholder="Select District" autocomplete="off" style="font-size: 0.8rem; min-width: 130px;" value="${escapeHtml(c.District || '')}">
            </div>
          </td>
          <td>
            <div class="position-relative">
              <input type="text" class="form-control form-control-sm import-broker-input" id="importBroker_${index}" placeholder="Select Partner" autocomplete="off" style="font-size: 0.8rem; min-width: 150px;" value="${escapeHtml(c.BrokerName || '')}">
            </div>
          </td>
          <td>
            <span class="badge bg-success">${c.Status}</span>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Post-render searchable dropdowns
      parsedCustomers.forEach((c, index) => {
        if (c.IsDuplicate) return;
        Utils.initSearchableDropdown(`importDistrict_${index}`, DISTRICTS, (val) => {
          parsedCustomers[index].District = val;
        });

        const distInput = document.getElementById(`importDistrict_${index}`);
        if (distInput) {
          distInput.addEventListener('input', (e) => { parsedCustomers[index].District = e.target.value.trim(); });
        }

        const vendors = DB.getAll('vendors') || [];
        const vendorNames = vendors.map(v => v.VendorName).sort((a, b) => a.localeCompare(b));
        Utils.initSearchableDropdown(`importBroker_${index}`, vendorNames, (val) => {
          parsedCustomers[index].BrokerName = val;
        });

        const brokerInput = document.getElementById(`importBroker_${index}`);
        if (brokerInput) {
          brokerInput.addEventListener('input', (e) => { parsedCustomers[index].BrokerName = e.target.value.trim(); });
        }
      });
    }
  }

  // 3. Render missing database records
  const tbodyMissing = document.querySelector('#missingPreviewTable tbody');
  const missingCustomersSection = document.getElementById('missingCustomersSection');

  if (tbodyMissing && missingCustomersSection) {
    tbodyMissing.innerHTML = '';
    if (parsedMissingCustomers.length === 0) {
      missingCustomersSection.style.display = 'none';
    } else {
      missingCustomersSection.style.display = 'block';
      parsedMissingCustomers.forEach((c, index) => {
        const tr = document.createElement('tr');
        tr.className = 'align-middle';
        tr.innerHTML = `
          <td class="text-center" style="background-color: #fff3cd !important; color: #664d03 !important;">${index + 1}</td>
          <td class="fw-semibold" style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.Name)}</td>
          <td class="font-monospace" style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.ConsumerNo || '—')}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.MobileNumber || '—')}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">${c.LoginDate ? `<span class="font-monospace">${fmtDateExcel(c.LoginDate)}</span> ${getDelayBadgeHtml(c.LoginDate)}` : '—'}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.District || '—')}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.BrokerName || '—')}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">
            <span class="badge bg-warning text-dark">${c.Status}</span>
          </td>
        `;
        tbodyMissing.appendChild(tr);
      });
    }
  }

  const modalEl = document.getElementById('importPreviewModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function downloadTxtReport() {
  let txt = 'IMPORT CUSTOMER PREVIEW REPORT\n';
  txt += `Generated on: ${new Date().toLocaleString()}\n`;
  txt += '======================================================================\n\n';
  txt += 'SECTION 1: DATA DIFFERENCES (GRID vs EXCEL)\n';
  txt += '----------------------------------------------------------------------\n';
  
  parsedConflictingCustomers.forEach((c, idx) => {
    txt += `${idx + 1}. Consumer: ${c.Name} (Sl. #${c.SlNo})\n`;
    txt += `   Selected Choice: ${c.SelectedChoice === 'EXCEL' ? 'Excel Data (Overwrite)' : 'Grid Data (Keep Previous)'}\n`;
    txt += `   Excel Values -> ConsumerNo: ${c.ExcelData.ConsumerNo || 'N/A'}, Mobile: ${c.ExcelData.MobileNumber || 'N/A'}, Submitted On: ${c.ExcelData.LoginDate || 'N/A'}, District: ${c.ExcelData.District || 'N/A'}, Partner: ${c.ExcelData.BrokerName || 'N/A'}\n`;
    txt += `   Grid Values  -> ConsumerNo: ${c.GridData.ConsumerNo || 'N/A'}, Mobile: ${c.GridData.MobileNumber || 'N/A'}, Login Date: ${c.GridData.LoginDate || 'N/A'}, District: ${c.GridData.District || 'N/A'}, Partner: ${c.GridData.BrokerName || 'N/A'}\n\n`;
  });

  txt += 'SECTION 2: NEW EXCEL RECORDS TO ADD\n';
  txt += '----------------------------------------------------------------------\n';
  parsedCustomers.filter(c => !c.IsDuplicate).forEach((c, idx) => {
    txt += `${idx + 1}. | ${c.Name} | ${c.ConsumerNo || 'N/A'} | ${c.MobileNumber || 'N/A'} | ${c.LoginDate || 'N/A'} | ${c.District || 'N/A'} | ${c.BrokerName || 'N/A'}\n`;
  });

  txt += '\n======================================================================\n';
  txt += 'SECTION 3: GRID RECORDS MISSING IN EXCEL FILE\n';
  txt += '----------------------------------------------------------------------\n';
  parsedMissingCustomers.forEach((c, idx) => {
    txt += `${idx + 1}. | ${c.Name} | ${c.MobileNumber || 'N/A'} | ${c.LoginDate || 'N/A'} | ${c.District || 'N/A'} | ${c.BrokerName || 'N/A'}\n`;
  });

  txt += '\n======================================================================\n';
  txt += `Summary Metrics:\n`;
  txt += `- New Names: ${parsedCustomers.filter(c => !c.IsDuplicate).length}\n`;
  txt += `- Conflicting Names: ${parsedConflictingCustomers.length}\n`;
  txt += `- Identical Records (Skipped): ${parsedIdenticalCount}\n`;
  txt += `- Missing Grid Records: ${parsedMissingCustomers.length}\n`;

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Import_Customer_Preview_${UI.todayISO()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function saveImportedCustomers() {
  const newCheckboxes = document.querySelectorAll('.chk-import-row:checked');
  const hasNewToSave = newCheckboxes.length > 0;
  const hasConflictsToSave = parsedConflictingCustomers.length > 0;

  if (!hasNewToSave && !hasConflictsToSave) {
    UI.toast('No customer selections to save.', 'warning');
    return;
  }

  UI.showLoading(true);
  try {
    const allRows = DB.getAll('installments') || [];
    let currentMaxSl = allRows.reduce((max, r) => Math.max(max, Number(r.SlNo) || 0), 0);

    const currentUser = Auth.getUser();
    let creatorSuffix = '';
    if (currentUser) {
      creatorSuffix = '|creator:' + currentUser.userid;
    }

    const defaultExpenses = { material: 0, partner: 0, install: 0, gst_pct: 0, gst: 0, other: 0 };
    const vendors = DB.getAll('vendors') || [];
    const promises = [];

    // 1. Insert New Customers
    newCheckboxes.forEach(chk => {
      const idx = Number(chk.getAttribute('data-index'));
      const customer = parsedCustomers[idx];
      if (customer && !customer.IsDuplicate) {
        currentMaxSl++;

        const foundVendor = vendors.find(v => v.VendorName === customer.BrokerName);
        const vendorPhone = foundVendor ? (foundVendor.Phone || '').trim() : '';
        const brokerNumberVal = vendorPhone + creatorSuffix + '|expenses:' + JSON.stringify(defaultExpenses);

        const rowData = {
          SlNo: currentMaxSl,
          Name: customer.Name,
          ConsumerNo: customer.ConsumerNo || '',
          MobileNumber: customer.MobileNumber || '',
          Status: 'Active',
          District: customer.District || '',
          Address: '',
          CommittedBrand: '',
          FirstInstallment: 0,
          SecondInstallment: 0,
          ThirdInstallment: 0,
          Total: 0,
          CommittedPrice: 0,
          VendorPrice: 0,
          VendorPaid: 0,
          LoginDate: customer.LoginDate || UI.todayISO(),
          InstallationDate: null,
          BrokerName: customer.BrokerName || '',
          BrokerNumber: brokerNumberVal,
          Commission: 0,
          CommissionPaid: 0,
          CommissioningDate: ''
        };
        promises.push(DB.insert('installments', rowData));
      }
    });

    // 2. Update Conflicting Customers where Excel Data choice was selected
    let excelUpdateCount = 0;
    parsedConflictingCustomers.forEach(c => {
      if (c.SelectedChoice === 'EXCEL') {
        excelUpdateCount++;
        const existingRow = allRows.find(r => Number(r.SlNo) === Number(c.SlNo));
        if (existingRow) {
          const updatedRow = {
            ...existingRow,
            ConsumerNo: c.ExcelData.ConsumerNo || existingRow.ConsumerNo || '',
            MobileNumber: c.ExcelData.MobileNumber || existingRow.MobileNumber || '',
            District: c.ExcelData.District || existingRow.District || '',
            BrokerName: c.ExcelData.BrokerName || existingRow.BrokerName || '',
            Address: c.ExcelData.Address || existingRow.Address || '',
            LoginDate: c.ExcelData.LoginDate || existingRow.LoginDate || null
          };
          promises.push(DB.update('installments', r => Number(r.SlNo) === Number(c.SlNo), updatedRow));
        }
      }
    });

    await Promise.all(promises);

    // Close modal
    const modalEl = document.getElementById('importPreviewModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    const newSavedCount = newCheckboxes.length;
    UI.toast(`Saved successfully: ${newSavedCount} new customer(s) added, ${excelUpdateCount} existing customer(s) updated from Excel.`, 'success');
    renderList();
  } catch (err) {
    console.error(err);
    UI.toast('Error saving imported customers: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}
