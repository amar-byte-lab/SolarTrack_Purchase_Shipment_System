/* =========================================================================
   ui.js — Shared UI helpers: sidebar injection, toasts, formatting,
   confirmation dialogs, loading indicator, DB connect banner.
   ========================================================================= */

const UI = (() => {

  const NAV_ITEMS = [
    { href: 'shipment.html',        icon: 'truck',      label: 'Shipments' },
    { href: 'installments.html',    icon: 'customer',   label: 'Customer' },
    { href: 'work-note.html',       icon: 'worknote',   label: 'Note' },
    { href: 'offer.html',           icon: 'offer',      label: 'Offer' },
    { href: 'agreement.html',       icon: 'agreement',  label: 'Agreement' },
    { href: 'demand-note.html',     icon: 'demand',     label: 'NetMeter' },
    { href: 'sizing-calc.html',     icon: 'calculator', label: 'Calculator' },
    { href: 'borrower.html',        icon: 'wallet',     label: 'Borrower' },
    { href: 'settings.html',        icon: 'gear',       label: 'Settings' },
  ];

  const ICONS = {
    calculator: `<rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.75"/><line x1="16" y1="14" x2="16" y2="18" stroke="currentColor" stroke-width="1.75"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    grid: `<rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.75" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.75" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.75" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    truck: `<rect x="1" y="3" width="14" height="13" rx="1" stroke="currentColor" stroke-width="1.75" fill="none"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8" stroke="currentColor" stroke-width="1.75" fill="none"/><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/><circle cx="17.5" cy="18.5" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    customer: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" fill="none"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    worknote: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.75" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.75"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.75"/><line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" stroke-width="1.75"/>`,
    offer: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    agreement: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.75" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M9 15l2 2 4-4" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    demand: `<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    gear: `<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    wallet: `<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    file: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.75" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.75" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.75"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.75"/>`,
    logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.75" fill="none"/><polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.75"/>`,
    search: `<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="1.75"/>`,
    filter: `<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    edit: `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.75" fill="none"/>`,
    trash: `<polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.75" fill="none"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.75" fill="none"/>`
  };

  function icon(name, size = 18) {
    const raw = ICONS[name] || '';
    if (raw.startsWith('<svg')) return raw;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${raw}</svg>`;
  }

  function toggleMobileSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => toggleMobileSidebar(false));
    }

    const shouldOpen = open !== undefined ? open : !sidebar.classList.contains('open');

    if (shouldOpen) {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
    } else {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    }
  }

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') toggleMobileSidebar(false);
  });

  function renderSidebar(activeHref) {
    const el = document.getElementById('sidebar');
    if (!el) return;

    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const visibleNavItems = user 
      ? NAV_ITEMS.filter(item => {
          if (user.role === 'admin' || user.role === 'superadmin' || user.userid === 'amar') return true;
          if (user.role === 'partner' || user.role === 'associates') {
            return ['installments.html', 'work-note.html', 'offer.html', 'agreement.html', 'borrower.html', 'sizing-calc.html'].includes(item.href);
          }
          return ['offer.html', 'agreement.html', 'borrower.html', 'work-note.html', 'sizing-calc.html'].includes(item.href);
        })
      : [];

    const userControlsMobile = user ? `
      <div class="sidebar-user-controls d-md-none pt-3 mt-3 border-top px-1 d-flex flex-column gap-2">
        <div class="user-badge-mobile">
          <span class="badge ${user.role === 'admin' ? 'bg-primary' : 'bg-success'} fs-7 py-2 px-3 w-100 d-flex align-items-center justify-content-center gap-2 text-truncate">
            👤 ${user.username || user.userid} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})
          </span>
        </div>
        <button class="btn btn-logout-mobile w-100 py-1.5 fs-7 d-flex align-items-center justify-content-center gap-2" onclick="Auth.logout()" title="Logout">
          ${icon('logout', 16)} <span>Logout</span>
        </button>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="brand d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2 overflow-hidden" title="Shri Trutiyadev Solar Enterprises">
          <img src="assets/sampleFiles/LogoWithoutLetter.png" alt="Logo" class="sidebar-brand-icon">
          <div class="brand-text-wrapper">
            <span class="brand-title-line1">Shri Trutiyadev</span>
            <span class="brand-title-line2">Solar Enterprises</span>
          </div>
        </div>
        <button class="btn text-secondary p-0 d-md-none border-0 fs-5 flex-shrink-0" id="btnSidebarClose" title="Close Menu" style="line-height: 1; opacity: 0.9; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
      <nav class="nav flex-column sidebar-nav">
        ${visibleNavItems.map(item => `
          <a class="nav-link ${item.href === activeHref ? 'active' : ''}" href="${item.href}">
            ${icon(item.icon)} <span>${item.label}</span>
          </a>`).join('')}
        ${userControlsMobile}
      </nav>
    `;
    refreshDbStatusBadge();

    const closeBtn = document.getElementById('btnSidebarClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar(false);
      });
    }

    const links = el.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          showTopProgress(70);
        }
        if (window.innerWidth <= 900) {
          toggleMobileSidebar(false);
        }
      });
    });
  }

  function refreshDbStatusBadge() {
    const badge = document.getElementById('dbStatusBadge');
    if (!badge) return;
    if (DB.isReady()) {
      let modeText = 'Live Folder';
      if (DB.getMode() === 'cache') modeText = 'Offline Cache';
      else if (DB.getMode() === 'upload') modeText = 'Upload Mode';
      else if (DB.getMode() === 'postgres') modeText = 'PostgreSQL Database';
      
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

  function showTopProgress(percent) {
    let bar = document.getElementById('stTopProgress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'stTopProgress';
      document.documentElement.appendChild(bar);
    }
    bar.style.opacity = '1';
    bar.style.width = percent + '%';
    if (percent >= 100) {
      setTimeout(() => {
        if (bar) bar.style.opacity = '0';
        setTimeout(() => { if (bar) bar.style.width = '0%'; }, 250);
      }, 150);
    }
  }

  function showLoading(show = true) {
    showTopProgress(show ? 40 : 100);
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

    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const userRole = user ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : '';
    const userAccountHtml = user ? `
      <div class="d-none d-md-flex align-items-center gap-2 text-secondary">
        <span class="fs-8 text-secondary" style="font-size:0.8rem;">
          <strong class="text-dark fw-semibold">${user.username || user.userid}</strong>
          <span class="text-muted">(${userRole})</span>
        </span>
        <button class="btn btn-sm btn-outline-secondary btn-logout-subtle d-inline-flex align-items-center gap-1 fs-8 py-1 px-2.5 bg-white shadow-none" onclick="Auth.logout()" title="Logout">
          ${icon('logout', 13)} <span>Logout</span>
        </button>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="w-100 d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary px-2 py-1 flex-shrink-0 d-lg-none" id="btnMenuToggle" title="Toggle Menu">
            ☰ <span class="d-none d-sm-inline ms-1 fw-semibold">Menu</span>
          </button>
          <div class="d-flex flex-column">
            ${title ? `<h1 class="topbar-title m-0" style="font-size:1.15rem; font-weight:600; color:var(--st-text-main); line-height:1.2;">${title}</h1>` : ''}
            ${subtitle ? `<div class="topbar-subtitle text-muted mt-0.5 fs-8" style="font-size:0.78rem;">${subtitle}</div>` : ''}
          </div>
        </div>

        <div class="topbar-actions d-flex align-items-center gap-2 flex-wrap justify-content-end no-print flex-shrink-0 ms-auto">
          ${userAccountHtml}
          ${user && actionsHtml ? '<span class="vr d-none d-md-inline my-1 text-muted" style="opacity:0.25; height: 18px;"></span>' : ''}
          ${actionsHtml || ''}
        </div>
      </div>
    `;
    const toggle = document.getElementById('btnMenuToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar();
      });
    }
  }

  return { icon, renderSidebar, refreshDbStatusBadge, renderTopbar, toast, confirmDialog, showLoading, showTopProgress, money, fmtDate, todayISO };
})();
