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
  { key: 'col-partner', label: 'Partner', default: '#ffffff' },
  { key: 'col-price', label: 'Total expense', default: '#ffffff' },
  { key: 'col-actions', label: 'Actions', default: '#ffffff' }
];

window.onDbReady = function () {
  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');
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
    <button class="btn btn-outline-secondary" id="btnPrintList">🖨 Print</button>
    <button class="btn btn-primary ms-2" id="btnImportCustomer">📥 Import Customer</button>
    <button class="btn btn-outline-secondary ms-2" id="btnDownloadFormat" style="display: none;">📁 Download format</button>
    <input type="file" id="excelFileInput" accept=".xlsx, .xls" style="display: none;">
  ` : '';

  UI.renderSidebar('installments.html');
  UI.renderTopbar('Customer', 'Manage client installment payments, customer sales, and agent commissions', buttonsHtml);

  const btnPrint = document.getElementById('btnPrintList');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
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
  ['fSearch', 'fLoginFrom', 'fLoginTo', 'fDateType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', Utils.debounce(renderList, 200));
      el.addEventListener('change', renderList);
    }
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
    const dateTypeSel = document.getElementById('fDateType');
    if (dateTypeSel) dateTypeSel.value = 'LoginDate';
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
    const txnType = document.getElementById('txnType').value || 'Customer';
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
        Remark: remark,
        TxnType: txnType
      };
      await DB.insert('installment_txns', txn);
      
      // Update customer installment Total or Vendor Paid
      await syncInstallmentTotal(slNo, txnType);
      
      // Reset inputs
      document.getElementById('newTxnAmount').value = '';
      document.getElementById('newTxnRemark').value = '';
      document.getElementById('newTxnDate').value = UI.todayISO();

      UI.toast('Payment added successfully.', 'success');
      renderList();
      showTransactionHistory(slNo, txnType);
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
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');
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
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');
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
  const totalBadgeClass = isTotalActive
    ? 'bg-dark text-white border border-2 border-success shadow-sm fw-bold'
    : 'bg-success-subtle text-success-emphasis border border-success-subtle';

  const totalBadge = `<span onclick="window.toggleDistrictBadgeFilter('ALL', event)" class="badge rounded-pill ${totalBadgeClass} px-2.5 py-1 fs-8" style="font-size: 0.74rem !important; font-weight: ${isTotalActive ? '700' : '500'}; cursor: pointer; transition: all 0.15s ease; ${isTotalActive ? 'box-shadow: 0 2px 5px rgba(0,0,0,0.25); transform: scale(1.05);' : 'opacity: 0.85;'}" title="Click to clear filter and show all districts">${isTotalActive ? '✓ ' : ''}Total: ${totalCount}</span>`;

  const districtBadges = sortedDistricts.map((dist, index) => {
    const count = counts[dist];
    const targetDist = dist === 'No District' ? '(No District)' : dist;
    const isSelected = selectedDistricts.includes(targetDist);
    const style = badgeStyles[index % badgeStyles.length];

    const safeDist = dist.replace(/'/g, "\\'");
    if (isSelected) {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="badge rounded-pill bg-primary text-white border border-2 border-dark shadow-sm px-2.5 py-1 fs-8" style="font-size: 0.76rem !important; font-weight: 700 !important; cursor: pointer; box-shadow: 0 2px 6px rgba(13, 110, 253, 0.4); transform: scale(1.06); transition: all 0.15s ease;" title="Selected filter. Click to toggle off.">✓ ${dist}: ${count}</span>`;
    } else {
      return `<span onclick="window.toggleDistrictBadgeFilter('${safeDist}', event)" class="badge rounded-pill ${style} px-2 py-0.5 fs-8" style="font-size: 0.72rem !important; font-weight: 500; cursor: pointer; opacity: 0.85; transition: all 0.15s ease;" title="Click to filter by ${dist}">${dist}: ${count}</span>`;
    }
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

  let rows = getInstallmentRows();

  // Apply search
  if (search) {
    rows = rows.filter(r =>
      String(r.Name || '').toLowerCase().includes(search) ||
      String(r.ConsumerNo || '').toLowerCase().includes(search) ||
      String(r.District || '').toLowerCase().includes(search) ||
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
      aVal = getRawDelayDays(a.LoginDate);
      bVal = getRawDelayDays(b.LoginDate);
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
  
  const currentUser = Auth.getUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');

  if (!rows.length && !isAddingNew) {
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? '4' : '3'}" class="text-center py-4 text-muted">No records found. Click "+" at the bottom to add one.</td></tr>`;
    const tfoot = document.querySelector('#installmentsTable tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="add-row-sticky no-print" onclick="openCustomerModal()" style="cursor:pointer; height:37px;">
          <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
          <td colspan="${isAdmin ? '3' : '2'}" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new customer installment record...</td>
        </tr>
        <tr class="grand-total" style="height:37px;">
          <td class="text-center">0</td>
          <td colspan="2">GRAND TOTAL</td>
          ${isAdmin ? '<td colspan="1"></td>' : ''}
        </tr>
      `;
    }
    renderSalesSummary([]);
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
                  <input type="number" step="any" class="form-control" id="editGSTPercentage" value="${(expenses && expenses.gst_pct) || 18}" placeholder="GST %">
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
              <button class="btn btn-sm btn-success py-0 px-2" onclick="saveInline(${r.SlNo})" title="Save">💾</button>
              <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="cancelInline()" title="Cancel">✕</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      // Render normal static row
      const isCommissioned = Boolean(r.CommissioningDate && String(r.CommissioningDate).trim() !== '');
      const hasInstDate = Boolean(r.InstallationDate && String(r.InstallationDate).trim() !== '');
      const hasLoginDate = Boolean(r.LoginDate && String(r.LoginDate).trim() !== '');

      let delayBadgeHtml = '';
      let rowClass = '';

      if (isDeactive) {
        rowClass = 'deactive-row';
      } else if (isCommissioned) {
        rowClass = 'comm-completed-row';
      } else if (hasInstDate) {
        const commDelayVal = calculateDelay(r.InstallationDate);
        if (commDelayVal) {
          delayBadgeHtml = `
            <sup class="ms-0.5"><a href="#" class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle text-decoration-none" onclick="showTimestampDetailsPopup(${r.SlNo}); return false;" title="Click to view Timestamp details" style="font-size:0.58rem; padding:1px 3px; font-weight:500;">Comm. Delay ${commDelayVal}</a></sup>
          `;
        }
      } else if (hasLoginDate) {
        const instDelayVal = calculateDelay(r.LoginDate);
        if (instDelayVal) {
          delayBadgeHtml = `
            <sup class="ms-0.5"><a href="#" class="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle text-decoration-none" onclick="showTimestampDetailsPopup(${r.SlNo}); return false;" title="Click to view Timestamp details" style="font-size:0.58rem; padding:1px 3px; font-weight:500;">Inst. Delay ${instDelayVal}</a></sup>
          `;
        }
      }

      return `
        <tr class="${rowClass}">
          <td class="text-center fw-semibold">${r.SlNo}</td>
          <td>
            <div class="d-flex flex-column align-items-start" style="font-size: 0.85rem; gap: 2px;">
              <div class="d-flex align-items-center gap-1 flex-wrap">
                <a href="#" class="fw-bold text-primary text-decoration-none" onclick="showCustomerDetailsPopup(${r.SlNo}); return false;">
                  ${r.Name || ''} (${r.District || '—'})
                </a>${delayBadgeHtml}
                ${r.ConsumerNo ? `<span class="badge bg-light text-secondary border font-monospace ms-1" style="font-size:0.7rem; font-weight:normal;" title="Consumer No">${escapeHtml(r.ConsumerNo)}</span>` : ''}
                ${(() => {
                  const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(r.SlNo));
                  const customerRemarksCount = remarks.filter(n => n.Type === 'Customer' || !n.Type).length;
                  return `
                    <button type="button" class="btn p-0 border-0 bg-transparent btn-note position-relative" onclick="showInstallmentNotes(${r.SlNo}, 'Customer')" title="Customer Notes/Remarks (${customerRemarksCount} added)" style="font-size: 0.95rem; line-height: 1;">
                      📝
                      ${customerRemarksCount > 0 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.55rem; padding: 2px 4px; border: 1px solid #fff;">${customerRemarksCount}</span>` : ''}
                    </button>
                  `;
                })()}
              </div>
              
              <div class="d-flex align-items-center gap-2 mt-2 pt-2 border-top w-100" style="font-size: 0.8rem;">
                <span class="fw-semibold text-dark font-monospace">₹${price.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                <button class="btn btn-xs btn-outline-secondary no-print font-monospace" onclick="showTransactionHistory(${r.SlNo}, 'Customer')" style="font-size:0.65rem; padding:1px 4px; border-color: #ccc; white-space: nowrap;">
                  Pending${getTxnDiffBadge(price, total)}
                </button>
              </div>
            </div>
          </td>
          <td class="col-Partner">
            <div class="d-flex flex-column align-items-start" style="font-size: 0.8rem; gap: 1px;">
              ${(() => {
                const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(r.SlNo));
                const partnerRemarksCount = remarks.filter(n => n.Type === 'Partner').length;
                return `
                  <div class="d-flex align-items-center gap-2">
                    <a href="#" class="fw-bold text-primary text-decoration-none" onclick="showPartnerDetailsPopup(${r.SlNo}); return false;">
                      ${r.BrokerName || '—'}
                    </a>
                    <button type="button" class="btn p-0 border-0 bg-transparent btn-note position-relative" onclick="showInstallmentNotes(${r.SlNo}, 'Partner')" title="Partner Notes/Remarks (${partnerRemarksCount} added)" style="font-size: 0.95rem; line-height: 1;">
                      📝
                      ${partnerRemarksCount > 0 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.55rem; padding: 2px 4px; border: 1px solid #fff;">${partnerRemarksCount}</span>` : ''}
                    </button>
                  </div>
                `;
              })()}
              <div class="d-flex align-items-center gap-2 mt-1 pt-1 border-top w-100" style="font-size: 0.75rem;">
                <span class="fw-semibold text-dark font-monospace">₹${partnerPrice.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                <button class="btn btn-xs btn-outline-secondary no-print font-monospace" onclick="showTransactionHistory(${r.SlNo}, 'Vendor')" style="font-size:0.65rem; padding:1px 4px; border-color: #ccc; white-space: nowrap;">
                  Pending ${getTxnDiffBadge(partnerPrice, vPaid)}
                </button>
              </div>
            </div>
          </td>
          <td class="col-price font-monospace fs-8 align-middle">
            <div class="d-flex flex-column align-items-start px-1" style="gap: 2px;">
              <div>
                <span class="text-secondary fw-normal">Exp.:</span> 
                <span class="fw-semibold text-dark">₹${vPrice.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
              </div>
              ${(() => {
                const profit = partnerPrice - comm - vPrice;
                const profitColorClass = profit >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
                return `
                  <div>
                    <span class="text-secondary fw-normal">Profit:</span> 
                    <span class="${profitColorClass}">₹${profit.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                  </div>
                `;
              })()}
            </div>
          </td>
          <td class="no-print text-center admin-only-column">
            <div class="d-flex gap-1 justify-content-center">
              ${isDeactive ? `
                <button class="btn btn-sm btn-outline-success py-0 px-1" onclick="restoreRow(${r.SlNo})" title="Restore">↻</button>
                <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="hardDeleteRow(${r.SlNo})" title="Delete Permanently">❌</button>
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
          <td colspan="${isAdmin ? '4' : '2'}" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new customer installment record...</td>
        </tr>
      `;
    }
    
    tfootHTML += `
      <tr class="grand-total" style="height:37px;">
        <td class="text-center align-middle">${isAddingNew ? activeCount - 1 : activeCount}</td>
        <td>
          <div class="d-flex flex-column align-items-start">
            <span class="fw-semibold text-secondary">GRAND TOTAL <span style="font-size:0.72rem; font-weight:normal;" class="text-muted">(Pending: ${fmtGrandTotal(sumPrice - sumTotal)})</span></span>
            <div class="fw-bold font-monospace text-dark mt-1" style="font-size:0.72rem;">
              c.price: ${fmtGrandTotal(sumPrice)} <span class="text-muted fw-normal">(Paid: ${fmtGrandTotal(sumTotal)})</span>
            </div>
          </div>
        </td>
        <td class="text-end fw-bold font-monospace align-middle" style="font-size:0.72rem;">
          <div class="d-flex flex-column align-items-start">
            <div>Comm: ${fmtGrandTotal(sumComm)} <span class="text-muted fw-normal" style="font-size:0.68rem;">(Pending: ${fmtGrandTotal(sumComm - sumCommPaid)})</span></div>
            <div>Part: ${fmtGrandTotal(sumPartnerPrice)} <span class="text-muted fw-normal" style="font-size:0.68rem;">(Pending: ${fmtGrandTotal(sumPartnerPrice - sumVendorPaid)})</span></div>
          </div>
        </td>
        <td class="text-start fw-bold font-monospace align-middle admin-only-column" style="font-size:0.72rem;">
          <div class="d-flex flex-column align-items-start px-1" style="gap: 2px;">
            <div>
              <span class="text-secondary fw-normal">Exp.:</span> 
              <span class="text-dark">${fmtGrandTotal(sumVendorPrice)}</span>
            </div>
            ${(() => {
              const totalProfit = sumPartnerPrice - sumComm - sumVendorPrice;
              const profitColorClass = totalProfit >= 0 ? 'text-success' : 'text-danger';
              return `
                <div>
                  <span class="text-secondary fw-normal">Profit:</span> 
                  <span class="${profitColorClass}">${fmtGrandTotal(totalProfit)}</span>
                </div>
              `;
            })()}
          </div>
        </td>
        <td class="no-print admin-only-column"></td>
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

  const editLoginInput = document.getElementById('editLoginDate');
  const editInstInput = document.getElementById('editInstallationDate');
  const editCommInput = document.getElementById('editCommissioningDate');

  const updateDelayLabels = () => {
    const loginVal = editLoginInput ? editLoginInput.value : '';
    const instVal = editInstInput ? editInstInput.value : '';
    const commVal = editCommInput ? editCommInput.value : '';
    
    const loginDelayEl = document.getElementById('editLoginDelay');
    if (loginDelayEl) loginDelayEl.textContent = `(${calculateDelay(loginVal) || '—'})`;

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
    ConsumerNo: document.getElementById('editConsumerNo') ? document.getElementById('editConsumerNo').value.trim() : (r ? (r.ConsumerNo || '') : ''),
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

window.showTransactionHistory = function(slNo, txnType = 'Customer') {
  const r = DB.getAll('installments').find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('txnSlNo').value = slNo;
  document.getElementById('txnType').value = txnType;
  document.getElementById('newTxnDate').value = UI.todayISO();
  document.getElementById('newTxnAmount').value = '';
  document.getElementById('newTxnRemark').value = '';

  // Set the title to include customer name
  document.getElementById('txnModalLabel').textContent = `${txnType} Payments — ${r.Name}`;

  // Fetch and display transaction history
  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === txnType || (txnType === 'Customer' && (!t.TxnType || t.TxnType === '')))
  );
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
  const txnType = document.getElementById('txnType').value || 'Customer';
  const txns = DB.getAll('installment_txns').filter(t => 
    Number(t.SlNo) === Number(slNo) && 
    (t.TxnType === txnType || (txnType === 'Customer' && (!t.TxnType || t.TxnType === '')))
  );
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

window.showCustomerDetailsPopup = function(slNo) {
  const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('customerDetailsModalTitle').textContent = `${r.Name} (${r.District || 'No District'})`;
  if (document.getElementById('detConsumerNo')) document.getElementById('detConsumerNo').textContent = r.ConsumerNo || '—';
  document.getElementById('detMobile').textContent = r.MobileNumber || '—';
  document.getElementById('detBrand').textContent = r.CommittedBrand || '—';
  document.getElementById('detAddress').textContent = r.Address || '—';

  // Load remarks (Customer specific only!)
  const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(slNo) && (n.Type === 'Customer' || !n.Type));
  const remarksContainer = document.getElementById('detNotesList');
  if (remarksContainer) {
    if (remarks.length === 0) {
      remarksContainer.innerHTML = '<div class="text-muted text-center py-2 fs-7 bg-light rounded">No remarks added yet.</div>';
    } else {
      remarksContainer.innerHTML = remarks.map(t => {
        const dateObj = new Date(t.CreatedAt || Date.now());
        const formattedDate = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return `
          <div class="p-2 bg-light border-start border-primary border-3 rounded fs-7">
            <div class="d-flex justify-content-between text-muted fs-8 mb-1">
              <span>Customer Remark</span>
              <span>${formattedDate}</span>
            </div>
            <div class="text-dark">${t.Remark}</div>
          </div>
        `;
      }).join('');
    }
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('customerDetailsModal'));
  modal.show();
};

window.showPartnerDetailsPopup = function(slNo) {
  const r = getInstallmentRows().find(x => Number(x.SlNo) === Number(slNo));
  if (!r) return;

  document.getElementById('partnerDetailsModalTitle').textContent = r.BrokerName || 'Partner Details';
  document.getElementById('detPartnerPhone').textContent = (r.BrokerNumber || '').split('|')[0] || '—';

  // Load Partner remarks
  const remarks = DB.getAll('installment_remarks').filter(n => Number(n.SlNo) === Number(slNo) && n.Type === 'Partner');
  const remarksContainer = document.getElementById('detPartnerNotesList');
  if (remarksContainer) {
    if (remarks.length === 0) {
      remarksContainer.innerHTML = '<div class="text-muted text-center py-2 fs-7 bg-light rounded">No partner remarks added yet.</div>';
    } else {
      remarksContainer.innerHTML = remarks.map(t => {
        const dateObj = new Date(t.CreatedAt || Date.now());
        const formattedDate = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return `
          <div class="p-2 bg-light border-start border-warning border-3 rounded fs-7">
            <div class="d-flex justify-content-between text-muted fs-8 mb-1">
              <span>Partner Remark</span>
              <span>${formattedDate}</span>
            </div>
            <div class="text-dark">${t.Remark}</div>
          </div>
        `;
      }).join('');
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
  const loginDelay = calculateDelay(r.LoginDate);
  document.getElementById('tsModalLoginDate').textContent = loginDateStr;
  document.getElementById('tsModalLoginDelay').textContent = loginDelay ? `(${loginDelay})` : '—';

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
      document.getElementById('cAddress').value = r.Address || '';
      document.getElementById('cBrand').value = r.CommittedBrand || '';
      document.getElementById('cPrice').value = r.CommittedPrice || '';
      document.getElementById('cVendorPrice').value = r.VendorPrice || '';
      document.getElementById('cLoginDate').value = r.LoginDate ? new Date(r.LoginDate).toISOString().slice(0, 10) : '';
      document.getElementById('cInstallationDate').value = r.InstallationDate ? new Date(r.InstallationDate).toISOString().slice(0, 10) : '';
      document.getElementById('cCommissioningDate').value = r.CommissioningDate ? new Date(r.CommissioningDate).toISOString().slice(0, 10) : '';
      document.getElementById('cBrokerName').value = r.BrokerName || '';
      document.getElementById('cBrokerNumber').value = (r.BrokerNumber || '').split('|')[0];
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
      document.getElementById('cGSTPercentage').value = (expenses && expenses.gst_pct) || 18;
      document.getElementById('cOtherCost').value = (expenses && expenses.other) || 0;
    }
  } else {
    ['cName', 'cConsumerNo', 'cMobile', 'cAddress', 'cBrand', 'cPrice', 'cVendorPrice', 'cLoginDate', 'cInstallationDate', 'cCommissioningDate', 'cBrokerName', 'cBrokerNumber', 'cCommission', 'cMaterialCost', 'cPartnerPrice', 'cInstallationCost', 'cTransportCost', 'cGSTPercentage', 'cOtherCost', 'cProfit'].forEach(id => {
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

  const expenses = {
    material: Number(document.getElementById('cMaterialCost').value) || 0,
    partner: Number(document.getElementById('cPartnerPrice').value) || 0,
    install: Number(document.getElementById('cInstallationCost').value) || 0,
    transport: Number(document.getElementById('cTransportCost').value) || 0,
    gst_pct: gstPctVal,
    gst: calculatedGSTAmount,
    other: Number(document.getElementById('cOtherCost').value) || 0
  };
  const calculatedVendorPrice = expenses.material + expenses.install + expenses.transport + expenses.gst + expenses.other;
  const phoneClean = document.getElementById('cBrokerNumber').value.trim().split('|')[0];

  const rowData = {
    Name: name,
    ConsumerNo: document.getElementById('cConsumerNo') ? document.getElementById('cConsumerNo').value.trim() : '',
    MobileNumber: document.getElementById('cMobile').value.trim(),
    District: document.getElementById('cDistrict').value,
    Address: document.getElementById('cAddress').value.trim(),
    CommittedBrand: document.getElementById('cBrand').value.trim(),
    CommittedPrice: Number(document.getElementById('cPrice').value) || 0,
    VendorPrice: calculatedVendorPrice,
    LoginDate: document.getElementById('cLoginDate').value || null,
    InstallationDate: document.getElementById('cInstallationDate').value || null,
    CommissioningDate: document.getElementById('cCommissioningDate').value || null,
    BrokerName: document.getElementById('cBrokerName').value.trim(),
    BrokerNumber: phoneClean + creatorSuffix + '|expenses:' + JSON.stringify(expenses),
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

      if (!nameKey) {
        UI.toast('Invalid format! Could not find "Consumer Name" or "Name" column.', 'danger');
        return;
      }

      // Get existing grid records to check duplicates and calculate missing rows
      const existingRecords = DB.getAll('installments');
      const seenNamesInExcel = new Set();
      parsedCustomers = [];
      parsedMissingCustomers = [];

      const excelNamesSet = new Set();

      jsonData.forEach((row) => {
        const rawName = String(row[nameKey] || '').trim();
        if (!rawName) return; // skip empty name rows

        const rawConsumerNo = consumerNoKey ? String(row[consumerNoKey] || '').trim() : '';
        const rawMobile = mobileKey ? String(row[mobileKey] || '').trim() : '';
        const cleanNameVal = cleanName(rawName);

        excelNamesSet.add(cleanNameVal);

        let status = 'New Name';
        let isDuplicate = false;

        // 1. Check if already in database/grid
        const existsInGrid = existingRecords.some(r => cleanName(r.Name) === cleanNameVal);
        if (existsInGrid) {
          status = 'Duplicate (Already in Grid)';
          isDuplicate = true;
        } 
        // 2. Check if duplicate within the Excel itself
        else if (seenNamesInExcel.has(cleanNameVal)) {
          status = 'Duplicate (In Excel)';
          isDuplicate = true;
        } else {
          seenNamesInExcel.add(cleanNameVal);
        }

        parsedCustomers.push({
          Name: rawName,
          ConsumerNo: rawConsumerNo,
          MobileNumber: rawMobile,
          District: '',
          BrokerName: '',
          Status: status,
          IsDuplicate: isDuplicate
        });
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
            Status: 'Missing in Excel'
          });
        }
      });

      if (parsedCustomers.length === 0) {
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

function renderImportPreviewModal() {
  // 1. Render import candidates
  const tbody = document.querySelector('#importPreviewTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  parsedCustomers.forEach((c, index) => {
    const tr = document.createElement('tr');

    // Status Badge
    let badgeClass = 'bg-success';
    if (c.Status === 'Duplicate (Already in Grid)') {
      badgeClass = 'bg-danger';
    } else if (c.Status === 'Duplicate (In Excel)') {
      badgeClass = 'bg-warning text-dark';
    }

    // Checked status: new names are checked, duplicates are unchecked
    const isChecked = !c.IsDuplicate;
    const checkedAttr = isChecked ? 'checked' : '';

    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="chk-import-row" data-index="${index}" ${checkedAttr}>
      </td>
      <td class="text-center">${index + 1}</td>
      <td class="fw-semibold">${escapeHtml(c.Name)}</td>
      <td class="font-monospace">${escapeHtml(c.ConsumerNo || '—')}</td>
      <td>${escapeHtml(c.MobileNumber || '—')}</td>
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
        <span class="badge ${badgeClass}">${c.Status}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Post-render initialization of searchable dropdowns for each import candidate row
  parsedCustomers.forEach((c, index) => {
    // District
    Utils.initSearchableDropdown(`importDistrict_${index}`, DISTRICTS, (val) => {
      parsedCustomers[index].District = val;
    });

    const distInput = document.getElementById(`importDistrict_${index}`);
    if (distInput) {
      distInput.addEventListener('input', (e) => {
        parsedCustomers[index].District = e.target.value.trim();
      });
      distInput.addEventListener('change', (e) => {
        parsedCustomers[index].District = e.target.value.trim();
      });
    }

    // Broker / Partner Name
    const vendors = DB.getAll('vendors') || [];
    const vendorNames = vendors.map(v => v.VendorName).sort((a, b) => a.localeCompare(b));
    Utils.initSearchableDropdown(`importBroker_${index}`, vendorNames, (val) => {
      parsedCustomers[index].BrokerName = val;
    });

    const brokerInput = document.getElementById(`importBroker_${index}`);
    if (brokerInput) {
      brokerInput.addEventListener('input', (e) => {
        parsedCustomers[index].BrokerName = e.target.value.trim();
      });
      brokerInput.addEventListener('change', (e) => {
        parsedCustomers[index].BrokerName = e.target.value.trim();
      });
    }
  });

  // 2. Render missing database records
  const tbodyMissing = document.querySelector('#missingPreviewTable tbody');
  if (tbodyMissing) {
    tbodyMissing.innerHTML = '';
    if (parsedMissingCustomers.length === 0) {
      tbodyMissing.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-3">
            No grid records are missing from the uploaded Excel file. All database entries matched.
          </td>
        </tr>
      `;
    } else {
      parsedMissingCustomers.forEach((c, index) => {
        const tr = document.createElement('tr');
        tr.className = 'align-middle';

        tr.innerHTML = `
          <td class="text-center" style="background-color: #fff3cd !important; color: #664d03 !important;">${index + 1}</td>
          <td class="fw-semibold" style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.Name)}</td>
          <td class="font-monospace" style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.ConsumerNo || '—')}</td>
          <td style="background-color: #fff3cd !important; color: #664d03 !important;">${escapeHtml(c.MobileNumber || '—')}</td>
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

  // Reset select all checkbox
  const chkAll = document.getElementById('chkSelectAllImport');
  if (chkAll) {
    chkAll.checked = parsedCustomers.every(c => !c.IsDuplicate);
  }

  const modalEl = document.getElementById('importPreviewModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function downloadTxtReport() {
  let txt = 'IMPORT CUSTOMER PREVIEW REPORT\n';
  txt += `Generated on: ${new Date().toLocaleString()}\n`;
  txt += '======================================================================\n\n';
  txt += 'SECTION 1: EXCEL RECORDS TO IMPORT\n';
  txt += '----------------------------------------------------------------------\n';
  txt += 'Sl. | Consumer Name | Consumer No | Mobile Number | District | Broker / Partner Name | Status\n';
  txt += '----------------------------------------------------------------------\n';

  parsedCustomers.forEach((c, idx) => {
    const name = c.Name;
    const consumerNo = c.ConsumerNo || 'N/A';
    const mobile = c.MobileNumber || 'N/A';
    const district = c.District || 'N/A';
    const broker = c.BrokerName || 'N/A';
    const status = c.Status;
    txt += `${idx + 1}. | ${name} | ${consumerNo} | ${mobile} | ${district} | ${broker} | ${status}\n`;
  });

  txt += '\n======================================================================\n';
  txt += 'SECTION 2: GRID RECORDS MISSING IN EXCEL FILE\n';
  txt += '----------------------------------------------------------------------\n';
  txt += 'Sl. | Consumer Name | Mobile Number | District | Broker / Partner Name | Status\n';
  txt += '----------------------------------------------------------------------\n';

  if (parsedMissingCustomers.length === 0) {
    txt += '(No grid records are missing from the uploaded Excel file)\n';
  } else {
    parsedMissingCustomers.forEach((c, idx) => {
      const name = c.Name;
      const mobile = c.MobileNumber || 'N/A';
      const district = c.District || 'N/A';
      const broker = c.BrokerName || 'N/A';
      const status = c.Status;
      txt += `${idx + 1}. | ${name} | ${mobile} | ${district} | ${broker} | ${status}\n`;
    });
  }

  txt += '\n======================================================================\n';
  txt += `Summary Metrics:\n`;
  txt += `- Total Excel Records: ${parsedCustomers.length}\n`;
  txt += `  * New Names: ${parsedCustomers.filter(c => c.Status === 'New Name').length}\n`;
  txt += `  * Duplicates in Grid: ${parsedCustomers.filter(c => c.Status === 'Duplicate (Already in Grid)').length}\n`;
  txt += `  * Duplicates in Excel: ${parsedCustomers.filter(c => c.Status === 'Duplicate (In Excel)').length}\n`;
  txt += `- Total Missing Grid Records: ${parsedMissingCustomers.length}\n`;

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
  const checkboxes = document.querySelectorAll('.chk-import-row:checked');
  if (checkboxes.length === 0) {
    UI.toast('Please check at least one customer to save.', 'warning');
    return;
  }

  UI.showLoading(true);
  try {
    const allRows = DB.getAll('installments');
    let currentMaxSl = allRows.reduce((max, r) => Math.max(max, Number(r.SlNo) || 0), 0);

    const currentUser = Auth.getUser();
    let creatorSuffix = '';
    if (currentUser) {
      creatorSuffix = '|creator:' + currentUser.userid;
    }

    const defaultExpenses = {
      material: 0,
      partner: 0,
      install: 0,
      gst_pct: 0,
      gst: 0,
      other: 0
    };

    const vendors = DB.getAll('vendors') || [];
    const promises = [];

    checkboxes.forEach(chk => {
      const idx = Number(chk.getAttribute('data-index'));
      const customer = parsedCustomers[idx];
      if (customer) {
        currentMaxSl++;

        // Find selected broker's phone number
        const foundVendor = vendors.find(v => v.VendorName === customer.BrokerName);
        const vendorPhone = foundVendor ? (foundVendor.Phone || '').trim() : '';
        const brokerNumberVal = vendorPhone + creatorSuffix + '|expenses:' + JSON.stringify(defaultExpenses);

        const rowData = {
          SlNo: currentMaxSl,
          Name: customer.Name,
          ConsumerNo: customer.ConsumerNo || '',
          MobileNumber: customer.MobileNumber,
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
          LoginDate: UI.todayISO(),
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

    await Promise.all(promises);

    // Close modal
    const modalEl = document.getElementById('importPreviewModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    UI.toast(`Successfully saved ${checkboxes.length} customer(s) to the database.`, 'success');
    renderList();
  } catch (err) {
    console.error(err);
    UI.toast('Error saving imported customers: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}
