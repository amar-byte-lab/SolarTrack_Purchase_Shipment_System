/* =========================================================================
   utils.js — General-purpose helpers shared across pages
   ========================================================================= */

const Utils = (() => {

  function uid(prefix = 'ID') {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  /** Generates the next Shipment Number, e.g. SHIP-0001, based on existing rows. */
  function nextShipmentNo(existingShipments) {
    let max = 0;
    existingShipments.forEach(s => {
      const m = String(s.ShipmentNo || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const next = String(max + 1).padStart(4, '0');
    return `SHIP-${next}`;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function exportRowsToExcel(rows, headers, fileName) {
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    XLSX.writeFile(wb, fileName);
  }

  function exportTableToPDF(title, columns, rows) {
    // Lightweight PDF export via the browser's native print-to-PDF, using
    // a dedicated print-friendly window — keeps the project 100% offline
    // (no external PDF library required).
    const win = window.open('', '_blank');
    const style = `
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#222}
        h2{color:#1B4F72;margin-bottom:4px}
        .meta{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#1B4F72;color:#fff}
        tr:nth-child(even){background:#f5f7fa}
      </style>`;
    const head = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
    const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    win.document.write(`<html><head><title>${title}</title>${style}</head><body>
      <h2>${title}</h2>
      <div class="meta">Generated on ${new Date().toLocaleString('en-IN')}</div>
      <table>${head}${body}</table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function initSearchableDropdown(inputId, optionsList, onSelectCallback) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let menuId = inputId + 'DropdownMenu';
    let menu = document.getElementById(menuId);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = menuId;
      menu.className = 'dropdown-menu shadow-lg searchable-dropdown-menu';
      document.body.appendChild(menu);
    } else if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }

    let currentOptions = optionsList || [];

    function escapeAttr(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function renderOptions(filterText = '') {
      const q = String(filterText || '').toLowerCase().trim();
      const filtered = currentOptions.filter(opt => 
        String(opt).toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        menu.innerHTML = `<div class="dropdown-item text-muted" style="cursor: default; font-size: 0.82rem; padding: 6px 12px;">No matches found</div>`;
      } else {
        menu.innerHTML = filtered.map(opt => 
          `<button type="button" class="dropdown-item text-start text-truncate" data-value="${escapeAttr(opt)}" style="font-size: 0.82rem; border: none; background: none; width: 100%; padding: 6px 12px; cursor: pointer;">${escapeAttr(opt)}</button>`
        ).join('');
      }
    }

    function positionMenu() {
      if (!menu.classList.contains('show')) return;
      const rect = input.getBoundingClientRect();

      // If input is detached or not visible, hide menu
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        hideMenu();
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const menuMaxHeight = 220;

      menu.style.position = 'fixed';
      menu.style.zIndex = '10800';
      menu.style.minWidth = `${Math.max(rect.width, 160)}px`;
      menu.style.width = `${rect.width}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.maxHeight = `${menuMaxHeight}px`;
      menu.style.overflowY = 'auto';
      menu.style.margin = '0';

      // Dropup if space below is too small (< 180px) and above has more space
      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        menu.style.top = 'auto';
        menu.style.bottom = `${Math.max(0, window.innerHeight - rect.top + 3)}px`;
      } else {
        menu.style.top = `${rect.bottom + 3}px`;
        menu.style.bottom = 'auto';
      }
    }

    const showMenu = () => {
      renderOptions(input.value);
      menu.classList.add('show');
      positionMenu();
    };

    const hideMenu = () => {
      menu.classList.remove('show');
    };

    input.addEventListener('focus', showMenu);
    input.addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu();
    });

    input.addEventListener('input', () => {
      renderOptions(input.value);
      menu.classList.add('show');
      positionMenu();
    });

    menu.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item && item.hasAttribute('data-value')) {
        e.preventDefault();
        const val = item.getAttribute('data-value');
        input.value = val;
        hideMenu();
        if (onSelectCallback) {
          onSelectCallback(val);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !menu.contains(e.target)) {
        hideMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideMenu();
      }
    });

    window.addEventListener('scroll', positionMenu, { capture: true, passive: true });
    window.addEventListener('resize', positionMenu, { passive: true });

    // Clean up if modal closes
    const parentModal = input.closest('.modal');
    if (parentModal && !parentModal.dataset.hasDropdownCleanup) {
      parentModal.dataset.hasDropdownCleanup = 'true';
      parentModal.addEventListener('hidden.bs.modal', () => {
        document.querySelectorAll('.searchable-dropdown-menu.show').forEach(m => m.classList.remove('show'));
      });
    }

    input.updateOptionsList = function(newOptions) {
      currentOptions = newOptions || [];
    };
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return String(dateStr);
    }
  }

  function formatDate(dateStr) {
    return fmtDate(dateStr);
  }

  function getDefaultGST(fallback = 18) {
    try {
      if (typeof DB !== 'undefined' && DB.isReady()) {
        const settings = DB.getAll('settings');
        const s = settings.find(st => st.Key === 'DefaultGST');
        if (s && s.Value !== undefined && s.Value !== null && s.Value !== '' && !isNaN(Number(s.Value))) {
          return Number(s.Value);
        }
      }
    } catch (e) {}
    return fallback;
  }

  return { uid, nextShipmentNo, getQueryParam, debounce, exportRowsToExcel, exportTableToPDF, csvEscape, initSearchableDropdown, fmtDate, formatDate, getDefaultGST };
})();
