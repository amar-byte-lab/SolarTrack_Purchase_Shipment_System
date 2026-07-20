/* =========================================================================
   ui.js — Shared UI helpers: sidebar injection, toasts, formatting,
   confirmation dialogs, loading indicator, DB connect banner.
   ========================================================================= */

const UI = (() => {

  const NAV_ITEMS = [
    { href: 'dashboard.html',       icon: 'grid',       label: 'Dashboard' },
    { href: 'shipment.html',        icon: 'truck',      label: 'Shipments' },
    { href: 'installments.html',    icon: 'coin',       label: 'Installments' },
    { href: 'item-master.html',     icon: 'box',        label: 'Item Master' },
    { href: 'offer.html',           icon: 'file',       label: 'Offer Generator' },
    { href: 'vendor-master.html',   icon: 'people',     label: 'Vendor Master' },
    { href: 'borrower.html',        icon: 'wallet',     label: 'Borrower' },
    { href: 'reports.html',         icon: 'bar-chart',  label: 'Reports' },
    { href: 'settings.html',        icon: 'gear',       label: 'Settings' },
  ];

  const ICONS = {
    grid: '<path d="M1 2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm8 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V2zM1 9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V9zm8 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9z"/>',
    truck: '<path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h9A1.5 1.5 0 0 1 12 3.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5v-7zM12 10a2 2 0 0 1 1.732 1h.768a.5.5 0 0 0 .5-.5V8.35a.5.5 0 0 0-.11-.312l-1.48-1.85A.5.5 0 0 0 13.02 6H12v4zm-9 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
    coin: '<path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.077 2.184-.855 2.184-1.774 0-1.155-.755-1.636-1.899-1.934L7.386 7.3c-.69-.172-1.046-.489-1.046-.978 0-.525.447-.9 1.175-.9.79 0 1.185.35 1.218.887h.858c-.03-.791-.564-1.397-1.428-1.517V4h-.6v.714c-1.242.065-2.007.694-2.007 1.694 0 1.042.72 1.514 1.76 1.78l1.17.292c.757.189 1.082.5 1.082 1.01 0 .633-.508 1.02-1.3 1.02-.947 0-1.364-.407-1.41-1.02H5.5z"/> <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>',
    box: '<path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z"/>',
    people: '<path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8Zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022ZM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816ZM4.92 10c.113 0 .223.005.33.014A4.987 4.987 0 0 0 4 13H1c0-.26.164-1.03.76-1.72C2.312 10.63 3.282 10 4.92 10ZM5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 1a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>',
    'bar-chart': '<path d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5v12h-2V2h2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-2zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm-5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3z"/>',
    gear: '<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.29a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.29-.159a1.873 1.873 0 0 0-2.692 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.693-1.115l-.291.16c-.764.415-1.6-.42-1.184-1.185l.159-.29A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.291c-.415-.764.42-1.6 1.185-1.184l.29.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>',
    wallet: '<path d="M0 3a2 2 0 0 1 2-2h13.5a.5.5 0 0 1 0 1H15v2a1 1 0 0 1 1 1v8.5a1.5 1.5 0 0 1-1.5 1.5h-12A2.5 2.5 0 0 1 0 12.5V3zm1 1.732V12.5A1.5 1.5 0 0 0 2.5 14h12a.5.5 0 0 0 .5-.5V5H2a1.993 1.993 0 0 1-1-.268zM1 3a1 1 0 0 0 1 1h12V2H2a1 1 0 0 0-1 1z"/>',
    file: '<path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/> <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.793 4L10 .207A1 1 0 0 0 9.293 0H4zm5.5 1.5v2a1 1 0 0 0 1 1h2l-3-3z"/>',
  };

  function icon(name, size = 18) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="0 0 16 16">${ICONS[name] || ''}</svg>`;
  }

  function renderSidebar(activeHref) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    el.innerHTML = `
      <div class="brand">
        <span class="brand-mark">${icon('grid', 22)}</span>
        <span class="brand-text">Solar<b>Track</b></span>
      </div>
      <nav class="nav flex-column sidebar-nav">
        ${NAV_ITEMS.map(item => `
          <a class="nav-link ${item.href === activeHref ? 'active' : ''}" href="${item.href}">
            ${icon(item.icon)} <span>${item.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div id="dbStatusBadge" class="db-status">● checking…</div>
      </div>
    `;
    refreshDbStatusBadge();
  }

  function refreshDbStatusBadge() {
    const badge = document.getElementById('dbStatusBadge');
    if (!badge) return;
    if (DB.isReady()) {
      let modeText = 'Live Folder';
      if (DB.getMode() === 'cache') modeText = 'Offline Cache';
      else if (DB.getMode() === 'upload') modeText = 'Upload Mode';
      else if (DB.getMode() === 'sqlite') modeText = 'SQLite Database';
      
      badge.innerHTML = `● Database connected <span class="mode-tag">${modeText}</span>`;
      badge.classList.add('ok');
    } else {
      badge.innerHTML = `● Database not connected`;
      badge.classList.remove('ok');
    }
  }

  function toast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = 2000;
      document.body.appendChild(container);
    }
    const id = 't' + Date.now();
    const bg = { success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning', info: 'text-bg-primary' }[type] || 'text-bg-primary';
    const el = document.createElement('div');
    el.className = `toast align-items-center ${bg} border-0`;
    el.id = id;
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3200 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  function confirmDialog(message, title = 'Please confirm', confirmBtnText = 'Delete', confirmBtnClass = 'btn-danger') {
    return new Promise(resolve => {
      let modalEl = document.getElementById('confirmModal');
      if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'confirmModal';
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title" id="confirmModalTitle"></h5>
                <button class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body" id="confirmModalBody"></div>
              <div class="modal-footer">
                <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button class="btn" id="confirmModalOk"></button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modalEl);
      }
      document.getElementById('confirmModalTitle').textContent = title;
      document.getElementById('confirmModalBody').textContent = message;
      
      const okBtn = document.getElementById('confirmModalOk');
      okBtn.textContent = confirmBtnText;
      okBtn.className = `btn ${confirmBtnClass}`;
      
      const modal = new bootstrap.Modal(modalEl);
      const handler = () => { modal.hide(); okBtn.removeEventListener('click', handler); resolve(true); };
      okBtn.addEventListener('click', handler);
      modalEl.addEventListener('hidden.bs.modal', () => resolve(false), { once: true });
      modal.show();
    });
  }

  function showLoading(show = true) {
    let el = document.getElementById('loadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loadingOverlay';
      el.className = 'loading-overlay';
      el.innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  }

  function money(n) {
    n = Number(n) || 0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderTopbar(title, subtitle, actionsHtml) {
    const el = document.getElementById('topbar');
    if (!el) return;
    el.innerHTML = `
      <div>
        <button class="btn btn-sm btn-outline-secondary d-md-none me-2" id="btnMenuToggle">☰</button>
        <h1 class="d-inline-block">${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      </div>
      <div class="d-flex gap-2 no-print">${actionsHtml || ''}</div>
    `;
    const toggle = document.getElementById('btnMenuToggle');
    if (toggle) toggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  }

  return { icon, renderSidebar, refreshDbStatusBadge, renderTopbar, toast, confirmDialog, showLoading, money, fmtDate, todayISO };
})();
