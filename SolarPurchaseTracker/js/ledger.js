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
let _addBorrowerModal = null;
let _waShareModal   = null;
let _searchQuery    = '';
let _filterStatus   = 'all';
let _isMasked       = false;
let isAddingNew     = false;

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
  '#3b82f6', '#10b981', '#f43f5e', '#06b6d4', '#84cc16'
];

document.addEventListener('DOMContentLoaded', async () => {
  UI.renderSidebar('ledger.html');
  UI.renderTopbar('Ledger', '');

  _txnModal = new bootstrap.Modal(document.getElementById('txnModal'), { keyboard: true });
  _addBorrowerModal = new bootstrap.Modal(document.getElementById('addBorrowerModal'), { keyboard: true });

  // Search
  document.getElementById('bwSearchInput')?.addEventListener('input', e => {
    _searchQuery = e.target.value.trim().toLowerCase();
    renderGrid();
  });

  // Txn form buttons
  document.getElementById('btnSaveReceived')?.addEventListener('click', () => saveTxn('Debit'));
  document.getElementById('btnSaveGiven')?.addEventListener('click', () => saveTxn('Credit'));
  document.getElementById('btnModalDeact')?.addEventListener('click', toggleBorrowerStatus);
  document.getElementById('btnModalRemove')?.addEventListener('click', removeActiveBorrower);
  document.getElementById('btnPrintTxn')?.addEventListener('click', printActiveBorrowerTxns);
  const btnShareWhatsapp = document.getElementById('btnShareWhatsapp');
  if (btnShareWhatsapp) {
    btnShareWhatsapp.addEventListener('click', shareActiveBorrowerWhatsapp);
  }
  const btnSendWhatsappConfirm = document.getElementById('btnSendWhatsappConfirm');
  if (btnSendWhatsappConfirm) {
    btnSendWhatsappConfirm.addEventListener('click', sendWhatsappConfirmed);
  }

  // Enter on amount/remarks saves default Credit
  document.getElementById('txnInputAmount')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveTxn('Credit'); });
  document.getElementById('txnInputRemarks')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveTxn('Credit'); });

  const dateInput = document.getElementById('txnInputDate');
  if (dateInput) dateInput.value = todayISO();

  // 1. Instant paint from session cache (0ms)
  loadFromLocalCache();

  // 2. Fetch fresh data in parallel in background
  loadBorrowers();
});

// ── Cache Keys ─────────────────────────────────────────────────────────────
const CACHE_KEY_BORROWERS = 'st_borrowers_cache';
const CACHE_KEY_TXNS      = 'st_borrower_txns_cache';

function loadFromLocalCache() {
  try {
    const bRaw = sessionStorage.getItem(CACHE_KEY_BORROWERS);
    const tRaw = sessionStorage.getItem(CACHE_KEY_TXNS);
    if (bRaw) _borrowers = JSON.parse(bRaw) || [];
    if (tRaw) _txnCache  = JSON.parse(tRaw) || {};
    if (_borrowers.length > 0) {
      renderKPIs();
      renderGrid();
      return true;
    }
  } catch (e) {}
  return false;
}

function saveToLocalCache() {
  try {
    sessionStorage.setItem(CACHE_KEY_BORROWERS, JSON.stringify(_borrowers));
    sessionStorage.setItem(CACHE_KEY_TXNS, JSON.stringify(_txnCache));
  } catch (e) {}
}

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

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Synchronous In-Memory Transaction Lookup (0ms) ──────────────────────────
function getBorrowerTxns(bid) {
  if (bid == null) return [];
  const raw = _txnCache[bid];
  if (raw && Array.isArray(raw)) return raw;
  const str = _txnCache[String(bid)];
  if (str && Array.isArray(str)) return str;
  const num = _txnCache[Number(bid)];
  if (num && Array.isArray(num)) return num;
  return [];
}

// ── Net balance ─────────────────────────────────────────────────────────
function netBalance(bid) {
  const txns = getBorrowerTxns(bid);
  let credit = 0, debit = 0;
  txns.forEach(t => {
    if (t.Type === 'Credit') credit += Number(t.Amount) || 0;
    else                     debit  += Number(t.Amount) || 0;
  });
  return { credit, debit, net: credit - debit };
}

// ── Load borrowers ─────────────────────────────────────────────────────
async function loadBorrowers() {
  const hasCache = _borrowers.length > 0;
  if (!hasCache) UI.showLoading(true);
  try {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userId = currentUser ? (currentUser.userid || currentUser.username) : '';

    // Fetch borrowers & all transactions in parallel with strict user scoping (only 2 network requests total)
    const [rB, rT] = await Promise.all([
      fetch(`/api/borrower-list?userId=${encodeURIComponent(userId)}`),
      fetch(`/api/borrower-txns?userId=${encodeURIComponent(userId)}`)
    ]);

    _borrowers = rB.ok ? await rB.json() : [];
    const allTxns = rT.ok ? await rT.json() : [];

    _txnCache = {};
    if (Array.isArray(allTxns)) {
      allTxns.forEach(t => {
        const rawBid = t.BorrowerID;
        const strBid = String(rawBid);
        const numBid = Number(rawBid);
        if (!_txnCache[rawBid]) _txnCache[rawBid] = [];
        _txnCache[rawBid].push(t);
        if (!_txnCache[strBid]) _txnCache[strBid] = _txnCache[rawBid];
        if (!isNaN(numBid) && !_txnCache[numBid]) _txnCache[numBid] = _txnCache[rawBid];
      });

      // Sort transactions chronologically
      Object.keys(_txnCache).forEach(k => {
        _txnCache[k].sort((a, b) => (a.TxnDate || '').localeCompare(b.TxnDate || '') || (a.TxnID || 0) - (b.TxnID || 0));
      });
    }

    saveToLocalCache();
    renderKPIs();
    renderGrid();
  } catch (e) {
    if (!hasCache) UI.toast('Failed to load: ' + e.message, 'danger');
  } finally {
    if (!hasCache) UI.showLoading(false);
  }
}

async function loadTxnsFor(bid) {
  try {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userId = currentUser ? (currentUser.userid || currentUser.username) : '';
    const r = await fetch(`/api/borrower-txns?borrowerID=${bid}&userId=${encodeURIComponent(userId)}`);
    const txns = r.ok ? await r.json() : [];
    const strBid = String(bid);
    const numBid = Number(bid);
    _txnCache[bid] = txns;
    _txnCache[strBid] = txns;
    if (!isNaN(numBid)) _txnCache[numBid] = txns;
    saveToLocalCache();
    return txns;
  } catch {
    return getBorrowerTxns(bid);
  }
}

// ── Khatabook Banner KPI Strip ─────────────────────────────────────────
function renderKPIs() {
  let totalCredit = 0, totalDebit = 0, activeCount = 0;
  _borrowers.forEach(b => {
    const { credit, debit } = netBalance(b.BorrowerID);
    totalCredit += credit; totalDebit += debit;
    if (b.Status === 'Active') activeCount++;
  });
  const net = totalCredit - totalDebit;

  const countEl = document.getElementById('kpiActiveAccounts');
  if (countEl) countEl.textContent = activeCount;

  const netEl = document.getElementById('kpiNetOutstanding');
  const dirEl = document.getElementById('kpiNetDirection');

  if (_isMasked) {
    if (netEl) { netEl.textContent = '••••••'; netEl.className = 'kb-net-amount settled'; }
    if (dirEl) { dirEl.textContent = 'Net Balance'; dirEl.style.color = 'rgba(255,255,255,0.7)'; }
    return;
  }

  if (net > 0.01) {
    if (netEl) { netEl.textContent = '₹' + Math.round(net).toLocaleString('en-IN'); netEl.className = 'kb-net-amount due'; }
    if (dirEl) { dirEl.textContent = 'You Get'; dirEl.style.color = '#ff5722'; }
  } else if (net < -0.01) {
    const absNet = Math.abs(net);
    if (netEl) { netEl.textContent = '₹' + Math.round(absNet).toLocaleString('en-IN'); netEl.className = 'kb-net-amount advance'; }
    if (dirEl) { dirEl.textContent = 'You Give'; dirEl.style.color = '#22c55e'; }
  } else {
    if (netEl) { netEl.textContent = '₹0'; netEl.className = 'kb-net-amount settled'; }
    if (dirEl) { dirEl.textContent = 'Settled'; dirEl.style.color = '#94a3b8'; }
  }
}

window.toggleBalanceMask = function() {
  _isMasked = !_isMasked;
  const eye = document.getElementById('svgEyeIcon');
  if (eye) {
    eye.innerHTML = _isMasked
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
  renderKPIs();
};

window.setFilterStatus = function(status) {
  _filterStatus = status;
  const labelMap = { all: 'All', due: 'Due', advance: 'Advance', settled: 'Settled' };
  const lbl = document.getElementById('lblFilterStatus');
  if (lbl) lbl.textContent = labelMap[status] || 'All';
  document.querySelectorAll('#btnFilterDropdown + .dropdown-menu .dropdown-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${status}'`));
  });
  renderGrid();
};

function getLastTxnSummary(b) {
  const bId = b.BorrowerID != null ? b.BorrowerID : b.borrowerid;
  const txns = getBorrowerTxns(bId);
  if (txns.length === 0) {
    const dateVal = b.CreatedAt || b.createdat;
    const dateStr = dateVal ? fmtDate(dateVal) : '';
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Added ${dateStr ? 'on ' + dateStr : 'recently'}`;
  }
  const lastTxn = txns[txns.length - 1];
  const typeLabel = (lastTxn.Type || lastTxn.type) === 'Credit' ? 'Given' : 'Received';
  const amtFormatted = money(lastTxn.Amount || lastTxn.amount);
  const dateFormatted = fmtDate(lastTxn.TxnDate || lastTxn.txndate);
  const isToday = (lastTxn.TxnDate || lastTxn.txndate) === todayISO();
  const timeLabel = isToday ? 'Today' : dateFormatted;

  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" class="me-1"><polyline points="20 6 9 17 4 12"/></svg>${amtFormatted} ${typeLabel} on ${timeLabel}`;
}

// ── Render Khatabook Account List ──────────────────────────────────────
function renderGrid() {
  const container = document.getElementById('bwAccountList');
  if (!container) return;

  const q = _searchQuery;
  const filtered = _borrowers.filter(b => {
    const name = (b.Name || b.name || '').trim();
    const mobile = (b.Mobile || b.mobile || '').trim();
    const address = (b.Address || b.address || '').trim();
    const matchSearch = !q ||
      name.toLowerCase().includes(q) ||
      mobile.toLowerCase().includes(q) ||
      address.toLowerCase().includes(q);
    if (!matchSearch) return false;

    const bId = b.BorrowerID != null ? b.BorrowerID : b.borrowerid;
    if (_filterStatus === 'all') return true;
    const { net } = netBalance(bId);
    if (_filterStatus === 'due') return net > 0.01;
    if (_filterStatus === 'advance') return net < -0.01;
    if (_filterStatus === 'settled') return Math.abs(net) <= 0.01;
    return true;
  });

  let html = '';

  // Inline add new customer row if triggered
  if (isAddingNew) {
    html += `
    <div class="kb-inline-add-row">
      <div class="d-flex align-items-center gap-2 mb-2">
        <strong class="fs-7 text-dark">Add New Customer</strong>
      </div>
      <div class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
          <input type="text" class="form-control form-control-sm" id="addName" placeholder="Customer Name *" autocomplete="off" maxlength="100" onkeydown="handleAddRowKey(event,'addName')">
        </div>
        <div class="col-6 col-md-3">
          <input type="tel" class="form-control form-control-sm" id="addMobile" placeholder="Mobile (optional)" autocomplete="off" maxlength="20" onkeydown="handleAddRowKey(event,'addMobile')">
        </div>
        <div class="col-6 col-md-3">
          <input type="text" class="form-control form-control-sm" id="addAddress" placeholder="Address (optional)" autocomplete="off" maxlength="200" onkeydown="handleAddRowKey(event,'addAddress')">
        </div>
        <div class="col-12 col-md-2 d-flex gap-2">
          <button class="btn btn-sm btn-primary flex-fill" onclick="saveBorrower()">Save</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="cancelInlineBorrower()">Cancel</button>
        </div>
      </div>
    </div>`;
  }

  if (filtered.length === 0 && !isAddingNew) {
    html += `
      <div class="text-center py-5 text-muted" id="bwEmptyState">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mb-2 opacity-50"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <div class="fs-7">No customers or borrowers found</div>
      </div>`;
    container.innerHTML = html;
    return;
  }

  filtered.forEach(b => {
    const bId = b.BorrowerID != null ? b.BorrowerID : b.borrowerid;
    const bName = b.Name || b.name || 'Unnamed';
    const bStatus = b.Status || b.status || 'Active';
    const { net } = netBalance(bId);
    const isActive = bStatus === 'Active';
    const initial = (bName || '?').trim().charAt(0).toUpperCase();
    const avatarBg = getAvatarColor(bName);

    let amountClass = 'settled';
    let statusLabel = 'Settled';
    let amountText = '₹0';

    if (net > 0.01) {
      amountClass = 'due';
      statusLabel = 'Due';
      amountText = '₹' + Math.round(net).toLocaleString('en-IN');
    } else if (net < -0.01) {
      amountClass = 'advance';
      statusLabel = 'Advance';
      amountText = '₹' + Math.round(Math.abs(net)).toLocaleString('en-IN');
    }

    html += `
    <div class="kb-account-item ${isActive ? '' : 'bw-closed'}" onclick="openTxnModal(${bId})">
      <div class="kb-avatar" style="background-color: ${avatarBg}">${initial}</div>
      <div class="kb-info">
        <div class="kb-name">
          ${esc(bName)}
          ${isActive ? '' : '<span class="badge bg-secondary ms-1" style="font-size:0.65rem;">Closed</span>'}
        </div>
        <div class="kb-sub">${getLastTxnSummary(b)}</div>
      </div>
      <div class="kb-bal">
        <div class="kb-amount ${amountClass}">${amountText}</div>
        <div class="kb-status-label ${amountClass}">${statusLabel}</div>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

// ── Add Customer Modal ──────────────────────────────────────────────────
window.openAddBorrowerModal = function() {
  const nameEl = document.getElementById('modalAddName');
  const mobEl = document.getElementById('modalAddMobile');
  const addrEl = document.getElementById('modalAddAddress');
  if (nameEl) nameEl.value = '';
  if (mobEl) mobEl.value = '';
  if (addrEl) addrEl.value = '';
  if (_addBorrowerModal) _addBorrowerModal.show();
  setTimeout(() => {
    nameEl?.focus();
  }, 100);
};

window.saveBorrowerModal = async function() {
  const name = (document.getElementById('modalAddName')?.value || '').trim();
  const mobile = (document.getElementById('modalAddMobile')?.value || '').trim();
  const address = (document.getElementById('modalAddAddress')?.value || '').trim();

  if (!name) {
    UI.toast('Customer name is required', 'warning');
    document.getElementById('modalAddName')?.focus();
    return;
  }
  if (_borrowers.some(b => (b.Name || b.name || '').toLowerCase() === name.toLowerCase())) {
    UI.toast(`"${name}" already exists`, 'warning');
    document.getElementById('modalAddName')?.focus();
    return;
  }

  const btn = document.getElementById('btnSaveBorrowerModal');
  if (btn) btn.disabled = true;

  try {
    const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userId = currentUser ? (currentUser.userid || currentUser.username || '').toLowerCase() : '';
    const resp = await fetch('/api/borrower-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: name, Mobile: mobile, Address: address, CreatedBy: userId })
    });
    const data = await resp.json();
    if (!data.BorrowerID) throw new Error(data.error || 'Failed to save customer');

    const newBorrower = {
      BorrowerID: data.BorrowerID,
      Name: name,
      Mobile: mobile,
      Address: address,
      Status: 'Active',
      CreatedBy: userId,
      CreatedAt: new Date().toISOString()
    };

    _borrowers.push(newBorrower);
    _txnCache[data.BorrowerID] = [];
    _txnCache[String(data.BorrowerID)] = [];
    saveToLocalCache();
    if (_addBorrowerModal) _addBorrowerModal.hide();
    renderKPIs();
    renderGrid();
    UI.toast(`✓ "${name}" added successfully`, 'success');
  } catch (e) {
    UI.toast('Error: ' + e.message, 'danger');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── Transaction Modal (Instant 0ms synchronous render) ──────────────────
window.openTxnModal = function(bid) {
  const borrower = _borrowers.find(b => String(b.BorrowerID) === String(bid) || b.BorrowerID == bid);
  if (!borrower) return;
  _activeBid = borrower.BorrowerID;

  document.getElementById('txnBorrowerName').textContent = borrower.Name;
  const subEl = document.getElementById('txnBorrowerSub');
  if (subEl) {
    subEl.textContent = [borrower.Mobile, borrower.Address].filter(Boolean).join(' · ') || '';
  }

  const isActive = borrower.Status === 'Active';

  // Update deactivate button text
  const deactBtn = document.getElementById('btnModalDeact');
  if (deactBtn) {
    deactBtn.textContent = isActive ? '🔒 Deactivate' : '🔓 Reactivate';
  }

  // Show/hide remove button: Can remove closed borrowers
  const removeBtn = document.getElementById('btnModalRemove');
  if (removeBtn) {
    removeBtn.style.display = !isActive ? 'inline-block' : 'none';
  }

  // Disable form fields for closed borrowers
  ['txnInputDate', 'txnInputAmount', 'txnInputRemarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isActive;
  });
  const btnReceived = document.getElementById('btnSaveReceived');
  const btnGiven    = document.getElementById('btnSaveGiven');
  if (btnReceived) btnReceived.disabled = !isActive;
  if (btnGiven)    btnGiven.disabled    = !isActive;

  // Reset form
  document.getElementById('txnInputDate').value    = todayISO();
  document.getElementById('txnInputAmount').value  = '';
  document.getElementById('txnInputRemarks').value = '';

  // Render IMMEDIATELY from memory cache (0ms instant!)
  renderTxnHistory(_activeBid);
  updateModalBalance(_activeBid);
  _txnModal.show();
  setTimeout(() => {
    const pane = document.getElementById('txnHistoryPane');
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, 60);
};

function updateModalBalance(bid) {
  const { net } = netBalance(bid);
  const balEl = document.getElementById('txnModalBal');
  if (!balEl) return;
  if (net > 0.01)      { balEl.textContent = '−' + money(net) + ' outstanding'; balEl.className = 'bw-modal-bal negative'; }
  else if (net < -0.01) { balEl.textContent = '+' + money(Math.abs(net)) + ' surplus'; balEl.className = 'bw-modal-bal positive'; }
  else                  { balEl.textContent = '✓ Settled'; balEl.className = 'bw-modal-bal zero'; }
}

function renderTxnHistory(bid) {
  const txns    = getBorrowerTxns(bid);
  const listEl  = document.getElementById('txnList');
  const emptyEl = document.getElementById('txnEmptyState');
  if (!listEl) return;

  if (txns.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    listEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

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
}

// ── Save transaction ────────────────────────────────────────────────────
async function saveTxn(forcedType) {
  if (!_activeBid) return;
  const dateVal  = document.getElementById('txnInputDate').value;
  const amtRaw   = document.getElementById('txnInputAmount').value;
  const remarks  = document.getElementById('txnInputRemarks').value.trim();
  const typeVal  = forcedType || 'Credit';

  if (!dateVal) { UI.toast('Select a date', 'warning'); document.getElementById('txnInputDate').focus(); return; }
  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) { UI.toast('Enter a valid amount > 0', 'warning'); document.getElementById('txnInputAmount').focus(); return; }

  try {
    const resp = await fetch('/api/borrower-txn-add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BorrowerID: _activeBid, TxnDate: dateVal, Amount: amount, Type: typeVal, Remarks: remarks })
    });
    const data = await resp.json();
    if (!resp.ok || !data.TxnID) throw new Error(data.error || 'Failed to save transaction');

    if (!_txnCache[_activeBid]) _txnCache[_activeBid] = [];
    _txnCache[_activeBid].push({ TxnID: data.TxnID, BorrowerID: _activeBid, TxnDate: dateVal, Amount: amount, Type: typeVal, Remarks: remarks, CreatedAt: new Date().toISOString() });
    _txnCache[_activeBid].sort((a, b) => a.TxnDate.localeCompare(b.TxnDate) || a.TxnID - b.TxnID);

    document.getElementById('txnInputAmount').value  = '';
    document.getElementById('txnInputRemarks').value = '';
    document.getElementById('txnInputDate').value    = todayISO();

    saveToLocalCache();
    renderTxnHistory(_activeBid); updateModalBalance(_activeBid);
    renderGrid(); renderKPIs();
    document.getElementById('txnHistoryPane').scrollTop = 99999;
    document.getElementById('txnInputAmount').focus();
    UI.toast(`✓ ${typeVal === 'Credit' ? 'Given' : 'Received'} ${money(amount)} saved`, 'success');
  } catch (e) { UI.toast('Error: ' + e.message, 'danger'); }
}

// ── Delete single transaction ───────────────────────────────────────────
window.deleteTxn = async function(txnId, bid) {
  const ok = await UI.confirmDialog('Delete this transaction? Cannot be undone.', 'Delete Transaction', 'Delete', 'btn-danger');
  if (!ok) return;
  try {
    const resp = await fetch('/api/borrower-txn-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TxnID: txnId })
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to delete transaction');
    }
    _txnCache[bid] = (_txnCache[bid] || []).filter(t => t.TxnID !== txnId);
    saveToLocalCache();
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
    saveToLocalCache();
    renderTxnHistory(_activeBid);
    updateModalBalance(_activeBid);
    renderGrid();
    renderKPIs();

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
    saveToLocalCache();
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
    saveToLocalCache();
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
    saveToLocalCache();
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

// ── Send to WhatsApp Mobile Compacted PDF ──────────────────────────────────
async function shareActiveBorrowerWhatsapp() {
  if (!_activeBid) return;
  const borrower = _borrowers.find(b => b.BorrowerID === _activeBid);
  if (!borrower) return;

  const { net } = netBalance(_activeBid);
  let balText = '';
  if (net > 0) balText = `₹${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Outstanding)`;
  else if (net < 0) balText = `₹${Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Surplus)`;
  else balText = 'Settled';

  // Format message
  let message = `Hello ${borrower.Name},\n\n`;
  message += `Here is your transaction ledger summary from SolarTrack.\n`;
  message += `Current Balance: *${balText}*.\n\n`;
  message += `Please check the attached PDF statement for details.\n\n`;
  message += `Thank you!`;

  // Pre-populate WhatsApp share modal with logged in user's number
  const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
  let defaultFromMobile = (currentUser && currentUser.mobile) ? currentUser.mobile : '';
  
  document.getElementById('waFromMobile').value = localStorage.getItem('whatsapp_from_mobile') || defaultFromMobile;
  document.getElementById('waToMobile').value = borrower.Mobile || '';
  document.getElementById('waMessageText').value = message;

  // Initialize and show the modal if not already done
  if (!_waShareModal) {
    _waShareModal = new bootstrap.Modal(document.getElementById('whatsappShareModal'), { keyboard: true });
  }
  _waShareModal.show();
}

// ── Confirm Send to WhatsApp ───────────────────────────────────────────────
async function sendWhatsappConfirmed() {
  const fromMobile = document.getElementById('waFromMobile').value.trim();
  const toMobile = document.getElementById('waToMobile').value.trim();
  const message = document.getElementById('waMessageText').value;

  if (!toMobile) {
    UI.toast('Recipient mobile number is required.', 'warning');
    document.getElementById('waToMobile').focus();
    return;
  }

  // Save the "From" number
  localStorage.setItem('whatsapp_from_mobile', fromMobile);

  const borrower = _borrowers.find(b => b.BorrowerID === _activeBid);
  if (!borrower) return;

  const txns = _txnCache[_activeBid] || [];

  const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPDF) {
    UI.toast('PDF library is not loaded properly.', 'danger');
    return;
  }

  UI.showLoading(true);

  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Calculate stats
    const creditTxns = txns.filter(t => t.Type === 'Credit');
    const debitTxns = txns.filter(t => t.Type === 'Debit');
    const creditTotal = creditTxns.reduce((sum, t) => sum + Number(t.Amount), 0);
    const debitTotal = debitTxns.reduce((sum, t) => sum + Number(t.Amount), 0);
    const creditCount = creditTxns.length;
    const debitCount = debitTxns.length;

    const { net } = netBalance(_activeBid);

    // Date range string
    let dateRangeStr = '—';
    if (txns.length > 0) {
      const sortedTxns = [...txns].sort((a, b) => a.TxnDate.localeCompare(b.TxnDate));
      const firstDate = fmtDate(sortedTxns[0].TxnDate);
      const lastDate = fmtDate(sortedTxns[sortedTxns.length - 1].TxnDate);
      dateRangeStr = `${firstDate} - ${lastDate}`;
    }

    // Helper functions to draw page elements
    function drawPageHeader() {
      // Header block background (light grey #f1f5f9)
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 15, 180, 22, 'F');

      // Owner details (left side)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const ownerName = (typeof Auth !== 'undefined' ? Auth.getUser()?.username : '') || 'Ledger Statement';
      doc.text(ownerName, 20, 21);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Mobile: ${fromMobile || '—'}`, 20, 26);

      // Borrower/Customer details (right side)
      doc.text(`Created on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 190, 21, { align: 'right' });
      doc.text(`Customer: ${borrower.Name}`, 190, 26, { align: 'right' });
      if (borrower.Mobile) {
        doc.text(`Mobile: ${borrower.Mobile}`, 190, 31, { align: 'right' });
      }
    }

    function drawTableHeader(yVal) {
      doc.setFillColor(18, 49, 79); // Highlighted dark background
      doc.rect(15, yVal, 180, 14, 'F');
      doc.setDrawColor(18, 49, 79);
      doc.line(15, yVal, 195, yVal);
      doc.line(15, yVal + 14, 195, yVal + 14);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255); // White text
      doc.text('Date', 20, yVal + 5.5);
      doc.text('Notes', 50, yVal + 5.5);

      doc.setTextColor(190, 255, 210); // Light pastel green for Payment
      doc.text(`Payment(${debitCount})`, 145, yVal + 5.5, { align: 'right' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Rs. ${debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 145, yVal + 10.5, { align: 'right' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 210, 210); // Light pastel red for Credit
      doc.text(`Credit(${creditCount})`, 190, yVal + 5.5, { align: 'right' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Rs. ${creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, yVal + 10.5, { align: 'right' });
    }

    // Draw first page header elements
    drawPageHeader();

    // Large Balance in center
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 138, 76); // Green
    doc.text('Rs. ' + Math.abs(net).toLocaleString('en-IN'), 105, 46, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Balance | ${dateRangeStr}`, 105, 51, { align: 'center' });

    // Table rows
    let y = 57;
    drawTableHeader(y);
    y += 14;

    txns.forEach((t, index) => {
      // Check page overflow
      if (y > 270) {
        doc.addPage();
        drawPageHeader();
        y = 45;
        drawTableHeader(y);
        y += 14;
      }

      const dateStr = fmtDate(t.TxnDate);
      const isCredit = t.Type === 'Credit';
      const amountStr = `Rs. ${Number(t.Amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // Notes wrapping
      const notesWidth = 70;
      const splitNotes = doc.splitTextToSize(t.Remarks || '—', notesWidth);
      const rowHeight = Math.max(8, splitNotes.length * 4.5 + 4);

      // Alternating row background shading
      if (index % 2 === 0) {
        doc.setFillColor(245, 247, 250); // light gray-blue tint shading
        doc.rect(15, y, 180, rowHeight, 'F');
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(dateStr, 20, y + 5);

      doc.text(splitNotes, 50, y + 5);

      if (isCredit) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(192, 57, 43); // Red
        doc.text(amountStr, 190, y + 5, { align: 'right' });
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(30, 138, 76); // Green
        doc.text(amountStr, 145, y + 5, { align: 'right' });
      }

      y += rowHeight;

      // separator line
      doc.setDrawColor(226, 232, 240); // slightly darker line for better row separation
      doc.setLineWidth(0.25);
      doc.line(15, y, 195, y);
    });

    // Summary footer on last page
    if (y > 250) {
      doc.addPage();
      drawPageHeader();
      y = 45;
    }

    // Draw final total line
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.4);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    // Final summary text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    
    // In sample: Current Balance: Rs. 8,72,491 (Total Balance Advance)
    const finalBalText = `Current Balance: Rs. ${Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${net >= 0 ? 'Outstanding' : 'Advance'})`;
    doc.text(finalBalText, 190, y, { align: 'right' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`( As of ${new Date().toLocaleDateString('en-GB')} )`, 190, y + 4.5, { align: 'right' });
    
    doc.setFont('Helvetica', 'oblique');
    doc.text('Powered by SolarTrack Ledger', 190, y + 9, { align: 'right' });

    // Output PDF blob
    const pdfBlob = doc.output('blob');
    const filename = `${borrower.Name.replace(/\s+/g, '_')}_ledger.pdf`;

    // Upload to server so it has a reference
    try {
      const arrayBuf = await pdfBlob.arrayBuffer();
      await fetch(
        `/api/upload-doc?shipmentNo=Borrower_${borrower.BorrowerID}&fileName=${encodeURIComponent(filename)}`,
        { method: 'POST', body: arrayBuf }
      );
    } catch (e) {
      console.error('Failed to upload PDF reference:', e);
    }

    // Sanitize receiver number
    let phone = toMobile.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    let sharedSuccessfully = false;
    const fileObj = new File([pdfBlob], filename, { type: 'application/pdf' });

    // Try Web Share API for direct file attachment
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
      try {
        await navigator.share({
          files: [fileObj],
          title: 'SolarTrack Ledger Statement',
          text: message
        });
        sharedSuccessfully = true;
      } catch (err) {
        console.warn('Native Web Share failed, falling back to desktop download & message:', err);
      }
    }

    if (!sharedSuccessfully) {
      // Fallback: download PDF locally (only since web browser has no other way to attach local file on desktop)
      const waUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      doc.save(filename);
      UI.toast('PDF statement downloaded. Please attach it manually in WhatsApp.', 'success');
    } else {
      UI.toast('PDF statement shared successfully!', 'success');
    }

  } catch (err) {
    console.error(err);
    UI.toast('Failed to generate PDF: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
    if (_waShareModal) {
      _waShareModal.hide();
    }
  }
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
    saveToLocalCache();

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
