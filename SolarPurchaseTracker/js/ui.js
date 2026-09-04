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
    calculator: `<rect x="4" y="2" width="16" height="20" rx="2.5" fill="#F59E0B"/>
<rect x="6" y="5" width="12" height="4" rx="1" fill="#FFFFFF"/>
<rect x="7" y="11" width="3" height="3" rx="0.5" fill="#FFFFFF"/>
<rect x="11" y="11" width="3" height="3" rx="0.5" fill="#FFFFFF"/>
<rect x="15" y="11" width="2" height="3" rx="0.5" fill="#FFFFFF"/>
<rect x="7" y="15" width="3" height="3" rx="0.5" fill="#FFFFFF"/>
<rect x="11" y="15" width="3" height="3" rx="0.5" fill="#FFFFFF"/>
<rect x="15" y="15" width="2" height="5" rx="0.5" fill="#10B981"/>`,
    grid: `<rect x="2" y="2" width="9" height="9" rx="2.5" fill="#4F46E5"/>
<rect x="13" y="2" width="9" height="9" rx="2.5" fill="#8B5CF6"/>
<rect x="2" y="13" width="9" height="9" rx="2.5" fill="#0EA5E9"/>
<rect x="13" y="13" width="9" height="9" rx="2.5" fill="#EC4899"/>`,
    truck: `<path d="M1 5C1 3.89543 1.89543 3 3 3H13C14.1046 3 15 3.89543 15 5V13C15 14.1046 14.1046 15 13 15H3C1.89543 15 1 14.1046 1 13V5Z" fill="#10B981"/>
<path d="M15 7H18.5858C19.1162 7 19.6249 7.21071 20 7.58579L22.4142 10C22.7893 10.3751 23 10.8838 23 11.4142V13C23 14.1046 22.1046 15 21 15H15V7Z" fill="#06B6D4"/>
<rect x="3" y="8" width="9" height="2.2" rx="1" fill="#F59E0B"/>
<circle cx="6" cy="15.5" r="2.5" fill="#1E293B" stroke="#F8FAFC" stroke-width="1.5"/>
<circle cx="18" cy="15.5" r="2.5" fill="#1E293B" stroke="#F8FAFC" stroke-width="1.5"/>`,
    customer: `<circle cx="12" cy="7.5" r="4" fill="#3B82F6"/>
<path d="M4 19C4 15 7.5 13 12 13C16.5 13 20 15 20 19V20H4V19Z" fill="#1D4ED8"/>`,
    worknote: `<rect x="4" y="2" width="16" height="20" rx="2.5" fill="#F59E0B"/>
<path d="M7 6H17M7 10H14M7 14H11" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
<circle cx="16.5" cy="15.5" r="3.5" fill="#0284C7"/>
<path d="M15 15.5L16 16.5L18 14.5" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    offer: `<path d="M12.8 2.3L20.7 10.2C21.1 10.6 21.1 11.2 20.7 11.6L12.6 19.7C12.2 20.1 11.6 20.1 11.2 19.7L3.3 11.8C3.1 11.6 3 11.3 3 11V3.5C3 2.7 3.7 2 4.5 2H12C12.3 2 12.6 2.1 12.8 2.3Z" fill="#E11D48"/>
<circle cx="7.5" cy="6.5" r="2" fill="#FFFFFF"/>
<path d="M9.5 14.5L14.5 9.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="11" cy="10.5" r="1" fill="#FFFFFF"/>
<circle cx="13" cy="13.5" r="1" fill="#FFFFFF"/>`,
    agreement: `<rect x="4" y="2" width="16" height="20" rx="2" fill="#0D9488"/>
<path d="M7 6H17M7 10H14M7 14H12" stroke="#CCFBF1" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="15.5" cy="15.5" r="3.5" fill="#F43F5E"/>
<path d="M14.5 15.5L15.5 16.5L17 14.5" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    demand: `<rect x="3" y="2" width="18" height="20" rx="2" fill="#7C3AED"/>
<path d="M6 6H18M6 10H14" stroke="#EDE9FE" stroke-width="1.8" stroke-linecap="round"/>
<rect x="6" y="13.5" width="12" height="5.5" rx="1.5" fill="#A78BFA"/>
<circle cx="12" cy="16.2" r="1.5" fill="#FFFFFF"/>`,
    gear: `<path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#06B6D4"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M10.707 2.228C11.161 1.706 12.839 1.706 13.293 2.228L13.821 2.834C14.331 3.42 15.228 3.565 15.899 3.167L16.594 2.756C17.194 2.401 18.381 3.087 18.472 3.774L18.551 4.372C18.647 5.099 19.261 5.642 19.992 5.642H20.598C21.298 5.642 22.001 6.643 21.782 7.307L21.574 7.935C21.32 8.704 21.688 9.537 22.428 9.878L22.99 10.137C23.6 10.418 23.6 11.982 22.99 12.263L22.428 12.522C21.688 12.863 21.32 13.696 21.574 14.465L21.782 15.093C22.001 15.757 21.298 16.758 20.598 16.758H19.992C19.261 16.758 18.647 17.301 18.551 18.028L18.472 18.626C18.381 19.313 17.194 19.999 16.594 19.644L15.899 19.233C15.228 18.835 14.331 18.98 13.821 19.566L13.293 20.172C12.839 20.694 11.161 20.694 10.707 20.172L10.179 19.566C9.669 18.98 8.772 18.835 8.101 19.233L7.406 19.644C6.806 19.999 5.619 19.313 5.528 18.626L5.449 18.028C5.353 17.301 4.739 16.758 4.008 16.758H3.402C2.702 16.758 1.999 15.757 2.218 15.093L2.426 14.465C2.68 13.696 2.312 12.863 2.312 12.522L1.572 12.263C0.4 11.982 0.4 10.418 1.01 10.137L1.572 9.878C2.312 9.537 2.68 8.704 2.426 7.935L2.218 7.307C1.999 6.643 2.702 5.642 3.402 5.642H4.008C4.739 5.642 5.353 5.099 5.449 4.372L5.528 3.774C5.619 3.087 6.806 2.401 7.406 2.756L8.101 3.167C8.772 3.565 9.669 3.42 10.179 2.834L10.707 2.228ZM12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" fill="#6366F1"/>`,
    wallet: `<path d="M3 5C3 3.89543 3.89543 3 5 3H18C19.1046 3 20 3.89543 20 5V7H5C3.89543 7 3 6.10457 3 5Z" fill="#34D399"/>
<path d="M2 8C2 6.89543 2.89543 6 4 6H20C21.1046 6 22 6.89543 22 8V19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V8Z" fill="#059669"/>
<path d="M15 11C15 9.89543 15.8954 9 17 9H22V16H17C15.8954 16 15 15.1046 15 14V11Z" fill="#10B981"/>
<circle cx="18.5" cy="12.5" r="1.5" fill="#F59E0B"/>`,
    file: `<path d="M4 4C4 2.89543 4.89543 2 6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z" fill="#F43F5E"/>
<path d="M14 2V8H20" fill="#FDA4AF"/>
<rect x="7" y="12" width="6" height="2" rx="1" fill="#FFFFFF"/>
<rect x="7" y="16" width="10" height="2" rx="1" fill="#FFFFFF"/>
<circle cx="16" cy="11" r="3.5" fill="#F59E0B"/>
<path d="M16 9.2L16.7 10.6L18.2 10.8L17.1 11.9L17.4 13.4L16 12.6L14.6 13.4L14.9 11.9L13.8 10.8L15.3 10.6L16 9.2Z" fill="#FFFFFF"/>`,
    doc: `<path d="M4 4C4 2.89543 4.89543 2 6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z" fill="#10B981"/>
<path d="M14 2V8H20" fill="#6EE7B7"/>
<rect x="7" y="12" width="10" height="2" rx="1" fill="#FFFFFF"/>
<rect x="7" y="16" width="7" height="2" rx="1" fill="#FFFFFF"/>`,
    logout: `<path d="M16 17L21 12L16 7M21 12H9" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H9" stroke="#F87171" stroke-width="2" stroke-linecap="round"/>`,
  };

  function icon(name, size = 20) {
    const raw = ICONS[name] || '';
    if (raw.startsWith('<svg')) return raw;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${raw}</svg>`;
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
    const userBadge = user ? `
      <div class="d-none d-md-flex align-items-center gap-1">
        <span class="badge ${user.role === 'admin' ? 'bg-primary' : 'bg-success'} fs-8 py-1.5 px-2 text-nowrap">
          👤 ${user.username || user.userid} <span class="d-none d-sm-inline">(${user.role.charAt(0).toUpperCase() + user.role.slice(1)})</span>
        </span>
        <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5 fs-8 px-2.5 py-1 text-nowrap rounded-2 shadow-sm" onclick="Auth.logout()" title="Logout">
          ${icon('logout', 14)} <span class="d-none d-sm-inline fw-semibold">Logout</span>
        </button>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="w-100 d-flex flex-column gap-1">
        <!-- Row 1: Top Bar Controls (Menu Toggle, User Login/Logout, Print & Actions) -->
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary px-2 py-1 flex-shrink-0 d-lg-none" id="btnMenuToggle" title="Toggle Menu">
              ☰ <span class="d-none d-sm-inline ms-1 fw-semibold">Menu</span>
            </button>
          </div>
          <div class="topbar-actions d-flex align-items-center gap-1 flex-wrap justify-content-end no-print flex-shrink-0">
            ${userBadge}
            ${actionsHtml || ''}
          </div>
        </div>

        <!-- Row 2 (Shifted One Line Below): Page Title (h1) -->
        ${title ? `
          <div class="mt-2 pt-1 border-top">
            <h1 class="topbar-title text-truncate m-0" style="font-size:1.25rem; font-weight:700; color:var(--st-text-main);">${title}</h1>
          </div>
        ` : ''}

        <!-- Row 3 (Shifted One Line Below Title): Subtitle -->
        ${subtitle ? `
          <div class="topbar-subtitle text-muted mt-0 fs-8">${subtitle}</div>
        ` : ''}
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
