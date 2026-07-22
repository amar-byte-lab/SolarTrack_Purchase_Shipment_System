/* =========================================================================
   borrower.js — Personal Credit/Debit Ledger
   Features: Excel-like grid, WhatsApp popup, row selection, column colors,
             reset transactions, inline Add-Txn button, installments-style add row
   ========================================================================= */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────
let _borrowers      = [];
let _txnCache       = {};
let _activeBid      = null;
let _txnModal       = null;
let _searchQuery    = '';
let _selectedCols   = [];   // columns checked for color coding
let isAddingNew     = false; // whether we are inline adding a borrower

// Colorable columns definition (matches bw-table thead class names)
const BW_COLORABLE_COLS = [
  { key: 'bw-col-name',    label: 'Name' },
  { key: 'bw-col-mobile',  label: 'Mobile' },
  { key: 'bw-col-address', label: 'Address' },
];

const LS_KEY = 'borrowerColColors';

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  UI.renderSidebar('borrower.html');
  UI.renderTopbar(
    'Borrower Ledger',
    'Personal credit & debit tracker',
    `<button class="btn btn-sm btn-accent" id="btnScrollToAdd">
       <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16" class="me-1">
         <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
       </svg>Add Borrower
     </button>`
  );

  _txnModal = new bootstrap.Modal(document.getElementById('txnModal'), { keyboard: true });

  // Search
  document.getElementById('bwSearchInput').addEventListener('input', e => {
    _searchQuery = e.target.value.trim().toLowerCase();
    renderGrid();
  });

  // Txn form buttons
  document.getElementById('btnSaveTxn').addEventListener('click', saveTxn);
  document.getElementById('btnResetTxns').addEventListener('click', resetAllTxns);
  document.getElementById('btnModalDeact').addEventListener('click', toggleBorrowerStatus);
  document.getElementById('btnModalRemove').addEventListener('click', removeActiveBorrower);
  document.getElementById('btnPrintTxn').addEventListener('click', printActiveBorrowerTxns);

  // Toggle form drawer (WhatsApp-style slide up)
  document.getElementById('btnToggleForm').addEventListener('click', () => {
    const drawer  = document.getElementById('txnFormDrawer');
    const btn     = document.getElementById('btnToggleForm');
    const hint    = document.getElementById('composeHint');
    const isOpen  = drawer.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    btn.textContent = isOpen ? '✕' : '✚';
    hint.textContent = isOpen ? 'Fill the form and tap 💾 Save…' : 'Tap ✚ to add a transaction…';
    if (isOpen) {
      setTimeout(() => document.getElementById('txnInputAmount')?.focus(), 350);
    }
  });

  // Enter on amount saves
  document.getElementById('txnInputAmount').addEventListener('keydown', e => { if (e.key === 'Enter') saveTxn(); });
  document.getElementById('txnInputRemarks').addEventListener('keydown', e => { if (e.key === 'Enter') saveTxn(); });

  document.getElementById('txnInputDate').value = todayISO();

  // ── Add Txn button topbar shortcut ─────────────────────────────────────
  document.getElementById('btnScrollToAdd').addEventListener('click', () => {
    addInlineBorrowerRow();
  });

  // ── Row selection (like installments: click / Ctrl+click) ──────────────
  document.getElementById('bwTable').addEventListener('click', e => {
    const tr = e.target.closest('tbody tr');
    if (!tr) return;
    // Skip clicks on buttons or inputs
    if (e.target.closest('button') || e.target.closest('input')) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const tbody  = document.querySelector('#bwTbody');
    if (isCtrl) {
      tr.classList.toggle('selected-row');
    } else {
      tbody.querySelectorAll('tr').forEach(r => { if (r !== tr) r.classList.remove('selected-row'); });
      tr.classList.toggle('selected-row');
    }
  });

  // ── Column Color Customizer ─────────────────────────────────────────────
  populateColorCheckboxes();
  applyColumnColors();

  document.getElementById('ccColorPicker').addEventListener('input', e => {
    if (_selectedCols.length === 0) { UI.toast('Select at least one column first', 'warning'); return; }
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    _selectedCols.forEach(k => { saved[k] = e.target.value; });
    localStorage.setItem(LS_KEY, JSON.stringify(saved));
    applyColumnColors();
  });

  document.getElementById('btnResetColors').addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    applyColumnColors();
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

  // Wait for DB → load
  await waitForDB();
  await loadBorrowers();
});

// ── Helpers ────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }

function money(n) {
  n = Number(n) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function waitForDB() {
  return new Promise(resolve => {
    if (DB.isReady()) { resolve(); return; }
    const p = setInterval(() => { if (DB.isReady()) { clearInterval(p); resolve(); } }, 80);
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Net balance ─────────────────────────────────────────────────────────
function netBalance(bid) {
  const txns = _txnCache[bid] || [];
  let credit = 0, debit = 0;
  txns.forEach(t => {
    if (t.Type === 'Credit') credit += Number(t.Amount) || 0;
    else                     debit  += Number(t.Amount) || 0;
  });
  return { credit, debit, net: credit - debit };
}

// ── Load borrowers ─────────────────────────────────────────────────────
async function loadBorrowers() {
  UI.showLoading(true);
  try {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userId = currentUser ? currentUser.userid : '';
    const r = await fetch(`/api/borrower-list?userId=${userId}`);
    _borrowers = r.ok ? await r.json() : [];
    await Promise.all(_borrowers.map(b => loadTxnsFor(b.BorrowerID)));
    renderKPIs();
    renderGrid();
  } catch (e) {
    UI.toast('Failed to load: ' + e.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}

async function loadTxnsFor(bid) {
  try {
    const r = await fetch(`/api/borrower-txns?borrowerID=${bid}`);
    _txnCache[bid] = r.ok ? await r.json() : [];
  } catch { _txnCache[bid] = []; }
}

// ── KPI Strip ──────────────────────────────────────────────────────────
function renderKPIs() {
  let totalCredit = 0, totalDebit = 0, active = 0;
  _borrowers.forEach(b => {
    const { credit, debit } = netBalance(b.BorrowerID);
    totalCredit += credit; totalDebit += debit;
    if (b.Status === 'Active') active++;
  });
  const net = totalCredit - totalDebit;
  document.getElementById('kpiTotalLent').textContent     = money(totalCredit);
  document.getElementById('kpiTotalReceived').textContent = money(totalDebit);
  document.getElementById('kpiActiveBorrowers').textContent = active;
  const netEl = document.getElementById('kpiNetOutstanding');
  if (net > 0)       { netEl.textContent = '−' + money(net);          netEl.style.color = '#c0392b'; }
  else if (net < 0)  { netEl.textContent = '+' + money(Math.abs(net)); netEl.style.color = '#1e8a4c'; }
  else               { netEl.textContent = money(0);                   netEl.style.color = ''; }
}

// ── Render Grid ────────────────────────────────────────────────────────
function renderGrid() {
  const tbody = document.getElementById('bwTbody');
  const tfoot = document.getElementById('bwTfoot');
  const q = _searchQuery;

  const filtered = _borrowers.filter(b =>
    !q || b.Name.toLowerCase().includes(q) ||
    (b.Mobile || '').toLowerCase().includes(q) ||
    (b.Address || '').toLowerCase().includes(q)
  );

  // If currently adding, append a dummy input row object
  if (isAddingNew) {
    filtered.push({
      BorrowerID: 'TEMP_NEW',
      Name: '',
      Mobile: '',
      Address: '',
      Status: 'Active',
      _isTemp: true
    });
  }

  document.getElementById('bwRowCount').textContent =
    `${_borrowers.length} borrower${_borrowers.length !== 1 ? 's' : ''}`;

  let html = '';
  filtered.forEach((b, idx) => {
    if (b._isTemp) {
      // Renders edit row matching installments edit style
      html += `
      <tr class="table-warning">
        <td style="text-align:center;color:#8592a0;font-size:.78rem;font-weight:600;vertical-align:middle;">*</td>
        <td class="bw-col-name">
          <input type="text" id="addName" placeholder="Name *"
                 autocomplete="off" maxlength="100"
                 onkeydown="handleAddRowKey(event,'addName')">
        </td>
        <td class="bw-col-mobile">
          <input type="text" id="addMobile" placeholder="Mobile"
                 autocomplete="off" maxlength="20"
                 onkeydown="handleAddRowKey(event,'addMobile')">
        </td>
        <td class="bw-col-address">
          <input type="text" id="addAddress" placeholder="Address (optional)"
                 autocomplete="off" maxlength="200"
                 onkeydown="handleAddRowKey(event,'addAddress')">
        </td>
        <td class="no-print text-center" style="vertical-align:middle;">
          <div class="d-flex gap-1 justify-content-center">
            <button class="btn btn-sm btn-success py-0 px-2" onclick="saveBorrower()" title="Save">💾</button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="cancelInlineBorrower()" title="Cancel">✕</button>
          </div>
        </td>
      </tr>`;
      return;
    }

    const { net } = netBalance(b.BorrowerID);
    const isActive = b.Status === 'Active';
    const txnCount = (_txnCache[b.BorrowerID] || []).length;

    let outBadge;
    if (net > 0)      outBadge = `<span class="bw-out neg" style="margin-left:5px;font-size:.7rem;padding:1px 7px;">−${money(net)}</span>`;
    else if (net < 0) outBadge = `<span class="bw-out pos" style="margin-left:5px;font-size:.7rem;padding:1px 7px;">+${money(Math.abs(net))}</span>`;
    else if (txnCount > 0) outBadge = `<span class="bw-out zero" style="margin-left:5px;font-size:.7rem;padding:1px 7px;">Settled</span>`;
    else outBadge = '';

    html += `
    <tr class="${isActive ? '' : 'bw-closed'}" data-bid="${b.BorrowerID}">
      <td style="text-align:center;color:#8592a0;font-size:.78rem;">${idx + 1}</td>
      <td class="bw-col-name">
        <span style="cursor:pointer;color:var(--st-blue-700);font-weight:600;"
              onclick="openTxnModal(${b.BorrowerID})" title="View transactions">
          ${esc(b.Name)}
        </span>
        ${isActive
          ? `<button class="btn-txn-inline" onclick="openTxnModal(${b.BorrowerID})" title="Add Transaction">
               +Txn${txnCount > 0 ? ` <sup style="opacity:.7;">${txnCount}</sup>` : ''}
             </button>${outBadge}`
          : `<span style="font-size:.68rem;color:#6b7885;margin-left:6px;">[Closed]</span>${outBadge}`
        }
      </td>
      <td class="bw-col-mobile" style="color:#46586b;">${esc(b.Mobile || '—')}</td>
      <td class="bw-col-address" style="color:#46586b;max-width:200px;overflow:hidden;text-overflow:ellipsis;"
          title="${esc(b.Address || '')}">${esc(b.Address || '—')}</td>
      <td style="text-align:center;white-space:nowrap;">
        ${isActive
          ? `<button class="btn-deact" onclick="confirmDeactivate(${b.BorrowerID})">Deactivate</button>`
          : `<button class="btn-reactivate" onclick="reactivateBorrower(${b.BorrowerID})">Reactivate</button>
             <button class="btn-deact ms-1" style="background:#c0392b; border-color:#c0392b; color:#fff;" onclick="removeBorrower(${b.BorrowerID})">Remove</button>`
        }
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;

  // ── Sticky green add-row in tfoot (installments style) ──────────────
  if (!isAddingNew) {
    tfoot.innerHTML = `
    <tr class="add-row-sticky no-print" onclick="addInlineBorrowerRow()" style="cursor:pointer; height:37px;">
      <td class="text-center text-success fw-bold fs-5" style="background:#e8f5e9;">+</td>
      <td colspan="4" class="text-success fw-semibold" style="background:#e8f5e9;">Add a new borrower...</td>
    </tr>`;
  } else {
    tfoot.innerHTML = '';
  }

  // Re-apply column colors after re-render
  applyColumnColors();
}

// ── Add Row keyboard nav ────────────────────────────────────────────────
function addInlineBorrowerRow() {
  isAddingNew = true;
  renderGrid();
  // Scroll to bottom of table if necessary, then focus name
  const tblScroll = document.getElementById('bwTableScroll');
  if (tblScroll) {
    tblScroll.scrollTop = tblScroll.scrollHeight;
  }
  setTimeout(() => {
    document.getElementById('addName')?.focus();
  }, 100);
}

function cancelInlineBorrower() {
  isAddingNew = false;
  renderGrid();
}

function handleAddRowKey(e, field) {
  if (e.key === 'Escape') { cancelInlineBorrower(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (field === 'addName')   { document.getElementById('addMobile').focus(); }
    else if (field === 'addMobile') { document.getElementById('addAddress').focus(); }
    else { saveBorrower(); }
  }
}

async function saveBorrower() {
  const name    = (document.getElementById('addName')?.value || '').trim();
  const mobile  = (document.getElementById('addMobile')?.value || '').trim();
  const address = (document.getElementById('addAddress')?.value || '').trim();

  if (!name) {
    UI.toast('Borrower name is required', 'warning');
    document.getElementById('addName')?.focus();
    return;
  }
  if (_borrowers.some(b => b.Name.toLowerCase() === name.toLowerCase())) {
    UI.toast(`"${name}" already exists`, 'warning');
    document.getElementById('addName')?.focus();
    return;
  }
  try {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userId = currentUser ? currentUser.userid : '';
    const resp = await fetch('/api/borrower-add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: name, Mobile: mobile, Address: address, CreatedBy: userId })
    });
    const data = await resp.json();
    if (!data.BorrowerID) throw new Error('No BorrowerID');

    _borrowers.push({ BorrowerID: data.BorrowerID, Name: name, Mobile: mobile, Address: address, Status: 'Active', CreatedBy: userId, CreatedAt: new Date().toISOString() });
    _txnCache[data.BorrowerID] = [];
    isAddingNew = false;
    renderKPIs(); renderGrid();
    UI.toast(`✓ "${name}" added`, 'success');
  } catch (e) { UI.toast('Error: ' + e.message, 'danger'); }
}

// ── Transaction Modal ───────────────────────────────────────────────────
window.openTxnModal = async function(bid) {
  const borrower = _borrowers.find(b => b.BorrowerID === bid);
  if (!borrower) return;
  _activeBid = bid;

  document.getElementById('txnBorrowerName').textContent = borrower.Name;
  document.getElementById('txnBorrowerSub').textContent =
    [borrower.Mobile, borrower.Address].filter(Boolean).join(' · ') || '';

  const isActive = borrower.Status === 'Active';

  // Update deactivate button text
  const deactBtn = document.getElementById('btnModalDeact');
  deactBtn.textContent = isActive ? '🔒 Deactivate' : '🔓 Reactivate';

  // Show/hide remove button
  const removeBtn = document.getElementById('btnModalRemove');
  if (removeBtn) {
    removeBtn.style.display = isActive ? 'none' : 'inline-block';
  }

  // Disable form fields for closed borrowers
  ['txnInputDate', 'txnInputAmount', 'txnInputRemarks', 'typCredit', 'typDebit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isActive;
  });
  document.getElementById('btnSaveTxn').disabled   = !isActive;
  document.getElementById('btnResetTxns').disabled  = !isActive;
  document.getElementById('btnToggleForm').disabled = !isActive;
  document.getElementById('btnToggleForm').style.opacity = isActive ? '1' : '0.4';

  // Reset form and close drawer
  document.getElementById('txnInputDate').value    = todayISO();
  document.getElementById('txnInputAmount').value  = '';
  document.getElementById('txnInputRemarks').value = '';
  document.getElementById('typCredit').checked     = true;
  
  const drawer = document.getElementById('txnFormDrawer');
  const btn    = document.getElementById('btnToggleForm');
  const hint   = document.getElementById('composeHint');
  drawer.classList.remove('open');
  btn.classList.remove('active');
  btn.textContent  = '✚';
  hint.textContent = isActive ? 'Tap ✚ to add a transaction…' : `"${borrower.Name}" is closed`;

  await loadTxnsFor(bid);
  renderTxnHistory(bid);
  updateModalBalance(bid);
  _txnModal.show();
};

function updateModalBalance(bid) {
  const { net } = netBalance(bid);
  const balEl = document.getElementById('txnModalBal');
  if (net > 0)      { balEl.textContent = '−' + money(net) + ' outstanding'; balEl.className = 'bw-modal-bal negative'; }
  else if (net < 0) { balEl.textContent = '+' + money(Math.abs(net)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
  else              { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
}

function renderTxnHistory(bid) {
  const txns    = _txnCache[bid] || [];
  const listEl  = document.getElementById('txnList');
  const emptyEl = document.getElementById('txnEmptyState');
  const footerEl = document.getElementById('txnRunningFooter');
  const runAmtEl = document.getElementById('txnRunningAmt');

  if (txns.length === 0) {
    emptyEl.style.display = 'flex'; listEl.innerHTML = ''; footerEl.style.display = 'none'; return;
  }
  emptyEl.style.display = 'none'; footerEl.style.display = 'flex';

  let lastDate = null, html = '';
  txns.forEach(t => {
    const isCredit = t.Type === 'Credit';
    const dayLabel = fmtDate(t.TxnDate);
    if (dayLabel !== lastDate) { html += `<div class="chat-date-sep"><span>${dayLabel}</span></div>`; lastDate = dayLabel; }
    if (isCredit) {
      html += `
      <div class="chat-row right" data-txn-id="${t.TxnID}">
        <button class="txn-del" onclick="deleteTxn(${t.TxnID},${bid})">×</button>
        <div class="chat-bubble credit">
          <div class="bubble-label">You gave</div>
          <div class="bubble-amount">−${money(t.Amount)}</div>
          ${t.Remarks ? `<div class="bubble-remarks">${esc(t.Remarks)}</div>` : ''}
          <div class="bubble-meta">${dayLabel}</div>
        </div>
      </div>`;
    } else {
      html += `
      <div class="chat-row left" data-txn-id="${t.TxnID}">
        <div class="chat-bubble debit">
          <div class="bubble-label">Received back</div>
          <div class="bubble-amount">+${money(t.Amount)}</div>
          ${t.Remarks ? `<div class="bubble-remarks">${esc(t.Remarks)}</div>` : ''}
          <div class="bubble-meta">${dayLabel}</div>
        </div>
        <button class="txn-del" onclick="deleteTxn(${t.TxnID},${bid})">×</button>
      </div>`;
    }
  });
  listEl.innerHTML = html;

  const { net } = netBalance(bid);
  if (net > 0)      { runAmtEl.textContent = '−' + money(net); runAmtEl.style.color = '#c0392b'; }
  else if (net < 0) { runAmtEl.textContent = '+' + money(Math.abs(net)); runAmtEl.style.color = '#1e8a4c'; }
  else              { runAmtEl.textContent = 'Settled ✓'; runAmtEl.style.color = '#6b7885'; }
}

// ── Save transaction ────────────────────────────────────────────────────
async function saveTxn() {
  if (!_activeBid) return;
  const dateVal  = document.getElementById('txnInputDate').value;
  const amtRaw   = document.getElementById('txnInputAmount').value;
  const remarks  = document.getElementById('txnInputRemarks').value.trim();
  const typeVal  = document.querySelector('input[name="txnType"]:checked')?.value || 'Credit';

  if (!dateVal) { UI.toast('Select a date', 'warning'); document.getElementById('txnInputDate').focus(); return; }
  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) { UI.toast('Enter a valid amount > 0', 'warning'); document.getElementById('txnInputAmount').focus(); return; }

  try {
    const resp = await fetch('/api/borrower-txn-add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BorrowerID: _activeBid, TxnDate: dateVal, Amount: amount, Type: typeVal, Remarks: remarks })
    });
    const data = await resp.json();
    if (!data.TxnID) throw new Error('No TxnID');

    _txnCache[_activeBid].push({ TxnID: data.TxnID, BorrowerID: _activeBid, TxnDate: dateVal, Amount: amount, Type: typeVal, Remarks: remarks, CreatedAt: new Date().toISOString() });
    _txnCache[_activeBid].sort((a, b) => a.TxnDate.localeCompare(b.TxnDate) || a.TxnID - b.TxnID);

    document.getElementById('txnInputAmount').value  = '';
    document.getElementById('txnInputRemarks').value = '';
    document.getElementById('txnInputDate').value    = todayISO();
    document.getElementById('typCredit').checked     = true;

    renderTxnHistory(_activeBid); updateModalBalance(_activeBid);
    renderGrid(); renderKPIs();
    document.getElementById('txnHistoryPane').scrollTop = 99999;
    document.getElementById('txnInputAmount').focus();
    UI.toast(`✓ ${typeVal} ${money(amount)} saved`, 'success');
  } catch (e) { UI.toast('Error: ' + e.message, 'danger'); }
}

// ── Delete single transaction ───────────────────────────────────────────
window.deleteTxn = async function(txnId, bid) {
  const ok = await UI.confirmDialog('Delete this transaction? Cannot be undone.', 'Delete Transaction', 'Delete', 'btn-danger');
  if (!ok) return;
  try {
    await fetch('/api/borrower-txn-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TxnID: txnId })
    });
    _txnCache[bid] = (_txnCache[bid] || []).filter(t => t.TxnID !== txnId);
    renderTxnHistory(bid); updateModalBalance(bid); renderGrid(); renderKPIs();
    UI.toast('Transaction deleted', 'info');
  } catch (e) { UI.toast('Error: ' + e.message, 'danger'); }
};

// ── Reset balance for active borrower (adds offsetting transaction) ──
async function resetAllTxns() {
  if (!_activeBid) return;
  const borrower = _borrowers.find(b => b.BorrowerID === _activeBid);
  if (!borrower) return;

  const { net } = netBalance(_activeBid);
  if (Math.abs(net) < 0.01) {
    UI.toast('Balance is already settled / 0.', 'info');
    return;
  }

  // If net > 0 (borrower owes us), we need to add a Debit (money received back)
  // If net < 0 (we owe borrower), we need to add a Credit (money given)
  const isOwed = net > 0;
  const resetType = isOwed ? 'Debit' : 'Credit';
  const resetAmount = Math.abs(net);
  const remarks = '(Reset balance)';
  const dateVal = todayISO();

  const ok = await UI.confirmDialog(
    `This will add a ${resetType} transaction of ${money(resetAmount)} to settle "${borrower.Name}" outstanding balance to 0. Previous transactions will NOT be deleted. Proceed?`,
    'Reset Balance',
    'Reset Balance',
    'btn-warning'
  );
  if (!ok) return;

  try {
    const resp = await fetch('/api/borrower-txn-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BorrowerID: _activeBid,
        TxnDate: dateVal,
        Amount: resetAmount,
        Type: resetType,
        Remarks: remarks
      })
    });
    const data = await resp.json();
    if (!data.TxnID) throw new Error('Failed to create resetting transaction');

    // Add to cache
    _txnCache[_activeBid].push({
      TxnID: data.TxnID,
      BorrowerID: _activeBid,
      TxnDate: dateVal,
      Amount: resetAmount,
      Type: resetType,
      Remarks: remarks,
      CreatedAt: new Date().toISOString()
    });
    _txnCache[_activeBid].sort((a, b) => a.TxnDate.localeCompare(b.TxnDate) || a.TxnID - b.TxnID);

    // Refresh UI
    renderTxnHistory(_activeBid);
    updateModalBalance(_activeBid);
    renderGrid();
    renderKPIs();

    // Close the form drawer after reset
    const drawer = document.getElementById('txnFormDrawer');
    const btn    = document.getElementById('btnToggleForm');
    const hint   = document.getElementById('composeHint');
    if (drawer) drawer.classList.remove('open');
    if (btn) btn.classList.remove('active');
    if (btn) btn.textContent = '✚';
    if (hint) hint.textContent = 'Tap ✚ to add a transaction…';

    UI.toast(`✓ Settle transaction added for "${borrower.Name}"`, 'success');
  } catch (e) {
    UI.toast('Error: ' + e.message, 'danger');
  }
}

// ── Toggle borrower status (modal button) ──────────────────────────────
async function toggleBorrowerStatus() {
  if (!_activeBid) return;
  const borrower = _borrowers.find(b => b.BorrowerID === _activeBid);
  if (!borrower) return;
  const isActive = borrower.Status === 'Active';

  if (isActive) {
    const { net } = netBalance(_activeBid);
    const msg = Math.abs(net) > 0.01
      ? `"${borrower.Name}" has outstanding balance of ${money(Math.abs(net))}. Deactivate anyway?`
      : `Deactivate "${borrower.Name}"?`;
    const ok = await UI.confirmDialog(msg, 'Deactivate Borrower', 'Deactivate', 'btn-danger');
    if (!ok) return;
  }

  const newStatus = isActive ? 'Closed' : 'Active';
  try {
    await fetch('/api/borrower-close', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BorrowerID: _activeBid, Status: newStatus })
    });
    borrower.Status = newStatus;
    _txnModal.hide();
    renderGrid(); renderKPIs();
    UI.toast(`"${borrower.Name}" → ${newStatus}`, 'info');
  } catch (e) { UI.toast('Error: ' + e.message, 'danger'); }
}

// ── Deactivate / Reactivate from grid ──────────────────────────────────
window.confirmDeactivate = async function(bid) {
  const borrower = _borrowers.find(b => b.BorrowerID === bid);
  if (!borrower) return;
  const { net } = netBalance(bid);
  const msg = Math.abs(net) > 0.01
    ? `"${borrower.Name}" — outstanding ${money(Math.abs(net))}. Deactivate anyway?`
    : `Deactivate "${borrower.Name}"?`;
  const ok = await UI.confirmDialog(msg, 'Deactivate', 'Deactivate', 'btn-danger');
  if (!ok) return;
  try {
    await fetch('/api/borrower-close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ BorrowerID: bid, Status: 'Closed' }) });
    borrower.Status = 'Closed';
    renderGrid(); renderKPIs();
    UI.toast(`"${borrower.Name}" deactivated`, 'info');
  } catch (e) { UI.toast(e.message, 'danger'); }
};

window.reactivateBorrower = async function(bid) {
  const borrower = _borrowers.find(b => b.BorrowerID === bid);
  if (!borrower) return;
  const ok = await UI.confirmDialog(`Reactivate "${borrower.Name}"?`, 'Reactivate', 'Reactivate', 'btn-primary');
  if (!ok) return;
  try {
    await fetch('/api/borrower-close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ BorrowerID: bid, Status: 'Active' }) });
    borrower.Status = 'Active';
    renderGrid(); renderKPIs();
    UI.toast(`"${borrower.Name}" reactivated`, 'success');
  } catch (e) { UI.toast(e.message, 'danger'); }
};

// ── Column Color Customizer ─────────────────────────────────────────────
function populateColorCheckboxes() {
  const menu = document.getElementById('ccColMenu');
  if (!menu) return;
  menu.innerHTML = BW_COLORABLE_COLS.map(c => `
    <div class="form-check mb-1">
      <input class="form-check-input bw-col-chk" type="checkbox" value="${c.key}" id="bwcc_${c.key}"
             ${_selectedCols.includes(c.key) ? 'checked' : ''}>
      <label class="form-check-label w-100" for="bwcc_${c.key}">${c.label}</label>
    </div>`).join('');

  document.querySelectorAll('.bw-col-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      _selectedCols = Array.from(document.querySelectorAll('.bw-col-chk:checked')).map(c => c.value);
      updateColPickerBtn();
      updateColorPickerValue();
    });
  });
  updateColPickerBtn();
}

function updateColPickerBtn() {
  const btn = document.getElementById('btnColPicker');
  if (!btn) return;
  btn.textContent = _selectedCols.length === 0 ? 'Select Columns'
    : _selectedCols.length === BW_COLORABLE_COLS.length ? 'All Columns'
    : `${_selectedCols.length} Column${_selectedCols.length > 1 ? 's' : ''}`;
}

function updateColorPickerValue() {
  const picker = document.getElementById('ccColorPicker');
  if (!picker || _selectedCols.length === 0) { if (picker) picker.value = '#ffffff'; return; }
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  picker.value = saved[_selectedCols[0]] || '#ffff00';
}

function applyColumnColors() {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  let styleText = '';
  BW_COLORABLE_COLS.forEach(c => {
    const color = saved[c.key];
    if (color && color !== '#ffffff') {
      styleText += `.bw-table td.${c.key}, .bw-table tfoot td.${c.key} { background-color: ${color} !important; }\n`;
      // Don't override deactivated / selected rows
      styleText += `.bw-table tr.bw-closed td.${c.key} { background-color: #f8d7da !important; }\n`;
      styleText += `.bw-table tr.selected-row td.${c.key} { background-color: #e3f2fd !important; }\n`;
    } else {
      styleText += `.bw-table td.${c.key} { background-color: transparent; }\n`;
    }
  });
  let el = document.getElementById('bwDynamicStyles');
  if (!el) { el = document.createElement('style'); el.id = 'bwDynamicStyles'; document.head.appendChild(el); }
  el.textContent = styleText;
}

// ── Print Active Borrower Transactions ──────────────────────────────────
function printActiveBorrowerTxns() {
  if (!_activeBid) return;
  const borrower = _borrowers.find(b => b.BorrowerID === _activeBid);
  if (!borrower) return;

  const txns = _txnCache[_activeBid] || [];
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const filename = `${borrower.Name.replace(/\s+/g, '_')}_Transactions_${todayStr}`;

  // Temporarily set document title for printing save filename
  const originalTitle = document.title;
  document.title = filename;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    UI.toast('Please allow popups to print.', 'danger');
    return;
  }

  const { credit, debit, net } = netBalance(_activeBid);
  let balText = '';
  if (net > 0) balText = `₹${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Outstanding)`;
  else if (net < 0) balText = `₹${Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Surplus)`;
  else balText = 'Settled';

  let rowsHtml = '';
  if (txns.length === 0) {
    rowsHtml = '<tr><td colspan="5" style="text-align: center; padding: 10px; color: #777;">No transactions recorded.</td></tr>';
  } else {
    txns.forEach((t, i) => {
      const dateStr = fmtDate(t.TxnDate);
      const isCredit = t.Type === 'Credit';
      const given = isCredit ? `₹${Number(t.Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
      const received = !isCredit ? `₹${Number(t.Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
      rowsHtml += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; text-align: center;">${i + 1}</td>
          <td style="padding: 8px; text-align: center;">${dateStr}</td>
          <td style="padding: 8px; text-align: right; color: #c0392b; font-family: monospace;">${given}</td>
          <td style="padding: 8px; text-align: right; color: #1e8a4c; font-family: monospace;">${received}</td>
          <td style="padding: 8px; text-align: left;">${esc(t.Remarks || '—')}</td>
        </tr>
      `;
    });
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
        .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
        .header h2 { margin: 0 0 5px 0; color: #111; }
        .header p { margin: 0; font-size: 14px; color: #555; }
        .kpis { display: flex; gap: 20px; margin-bottom: 25px; }
        .kpi-box { flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: #fdfdfd; }
        .kpi-title { font-size: 11px; text-transform: uppercase; color: #777; font-weight: bold; margin-bottom: 4px; }
        .kpi-val { font-size: 18px; font-weight: bold; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #f5f5f5; border-bottom: 2px solid #ddd; padding: 10px 8px; font-size: 13px; text-transform: uppercase; color: #555; }
        td { font-size: 13px; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px dashed #ddd; padding-top: 10px; }
        @media print {
          body { margin: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Transaction Ledger</h2>
        <p><strong>Borrower:</strong> ${borrower.Name} ${borrower.Mobile ? `(${borrower.Mobile})` : ''}</p>
        ${borrower.Address ? `<p><strong>Address:</strong> ${borrower.Address}</p>` : ''}
        <p style="margin-top: 5px;"><strong>Statement Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      <div class="kpis">
        <div class="kpi-box">
          <div class="kpi-title">Total Money Given</div>
          <div class="kpi-val" style="color: #c0392b;">₹${credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-title">Total Received Back</div>
          <div class="kpi-val" style="color: #1e8a4c;">₹${debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="kpi-box" style="background: #f7fafc;">
          <div class="kpi-title">Net Outstanding Balance</div>
          <div class="kpi-val" style="color: ${net > 0 ? '#c0392b' : net < 0 ? '#1e8a4c' : '#333'};">${balText}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 120px;">Date</th>
            <th style="width: 130px; text-align: right;">Money Given</th>
            <th style="width: 130px; text-align: right;">Received Back</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        Generated by SolarTrack Ledger System
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();

  // Restore original document title
  document.title = originalTitle;
}

async function removeActiveBorrower() {
  if (!_activeBid) return;
  const ok = await removeBorrower(_activeBid);
  if (ok) {
    _txnModal.hide();
  }
}

window.removeBorrower = async function(bid) {
  const borrower = _borrowers.find(b => b.BorrowerID === bid);
  if (!borrower) return false;

  const { net } = netBalance(bid);
  const msg = Math.abs(net) > 0.01
    ? `⚠️ WARNING: "${borrower.Name}" has an outstanding balance of ${money(Math.abs(net))}.\n\nThis will HARD delete the borrower and ALL their transactions permanently from the database. This action CANNOT be undone.\n\nType the borrower name "${borrower.Name}" to confirm:`
    : `This will HARD delete "${borrower.Name}" and all their transaction history permanently. This action CANNOT be undone.\n\nAre you sure you want to proceed?`;

  if (Math.abs(net) > 0.01) {
    const input = prompt(msg);
    if (input !== borrower.Name) {
      if (input !== null) UI.toast('Confirmation failed. Name did not match.', 'warning');
      return false;
    }
  } else {
    const ok = await UI.confirmDialog(msg, 'HARD Delete Borrower', 'Delete permanently', 'btn-danger');
    if (!ok) return false;
  }

  UI.showLoading(true);
  try {
    const resp = await fetch('/api/borrower-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BorrowerID: bid })
    });
    if (!resp.ok) throw new Error('Failed to delete borrower');

    _borrowers = _borrowers.filter(b => b.BorrowerID !== bid);
    delete _txnCache[bid];

    renderGrid(); renderKPIs();
    UI.toast(`🗑️ "${borrower.Name}" deleted permanently`, 'danger');
    return true;
  } catch (e) {
    UI.toast('Error: ' + e.message, 'danger');
    return false;
  } finally {
    UI.showLoading(false);
  }
};

// ── Global expose ──────────────────────────────────────────────────────
window.openTxnModal       = window.openTxnModal;
window.deleteTxn          = window.deleteTxn;
window.confirmDeactivate  = window.confirmDeactivate;
window.reactivateBorrower = window.reactivateBorrower;
window.handleAddRowKey    = handleAddRowKey;
window.saveBorrower       = saveBorrower;
window.addInlineBorrowerRow = addInlineBorrowerRow;
window.cancelInlineBorrower = cancelInlineBorrower;
window.removeBorrower     = window.removeBorrower;
