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

  let activeSearchable = null;
  let globalDropdownListenersAttached = false;

  function initSearchableDropdown(inputRef, optionsList, onSelectCallback) {
    const input = (typeof inputRef === 'string') ? document.getElementById(inputRef) : inputRef;
    if (!input) return;

    const actualId = input.id || (typeof inputRef === 'string' ? inputRef : Utils.uid('drop'));
    if (!input.id) input.id = actualId;
    let menuId = actualId + 'DropdownMenu';
    
    // Clean up any previous menu instance from document.body
    let existingMenu = document.getElementById(menuId);
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = menuId;
    menu.className = 'dropdown-menu shadow-lg searchable-dropdown-menu';
    document.body.appendChild(menu);

    let currentOptions = optionsList || [];

    function escapeAttr(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function renderOptions(filterText = '', showAll = false) {
      const q = showAll ? '' : String(filterText || '').toLowerCase().trim();
      let filtered = currentOptions;
      if (q) {
        filtered = currentOptions.filter(opt => {
          const val = typeof opt === 'object' && opt !== null ? (opt.label || opt.value || '') : String(opt);
          return val.toLowerCase().includes(q);
        });
      }

      if (filtered.length === 0) {
        menu.innerHTML = `<div class="dropdown-item text-muted" style="cursor: default; font-size: 0.82rem; padding: 6px 12px;">No matches found</div>`;
      } else {
        menu.innerHTML = filtered.map(opt => {
          const val = typeof opt === 'object' && opt !== null ? opt.value : String(opt);
          const label = typeof opt === 'object' && opt !== null ? (opt.label || opt.value) : String(opt);
          const isSelected = (input.value && input.value.trim().toLowerCase() === String(val).trim().toLowerCase());
          return `<button type="button" class="dropdown-item text-start text-truncate ${isSelected ? 'active fw-semibold' : ''}" data-value="${escapeAttr(val)}" style="font-size: 0.82rem; border: none; width: 100%; padding: 6px 12px; cursor: pointer;">${escapeAttr(label)}</button>`;
        }).join('');
      }
    }

    function positionMenu() {
      if (!menu.classList.contains('show')) return;
      const rect = input.getBoundingClientRect();

      // If input is detached or scrolled out of visible view, hide menu
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 30 || rect.top > window.innerHeight - 30) {
        hideMenu();
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const menuMaxHeight = 220;

      menu.style.position = 'fixed';
      menu.style.zIndex = '10800';
      menu.style.minWidth = `${Math.max(rect.width, 160)}px`;
      menu.style.width = `${Math.max(rect.width, 160)}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 12))}px`;
      menu.style.maxHeight = `${menuMaxHeight}px`;
      menu.style.overflowY = 'auto';
      menu.style.margin = '0';

      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        menu.style.top = 'auto';
        menu.style.bottom = `${Math.max(0, window.innerHeight - rect.top + 3)}px`;
      } else {
        menu.style.top = `${rect.bottom + 3}px`;
        menu.style.bottom = 'auto';
      }
    }

    function showMenu(showAll = false) {
      if (activeSearchable && activeSearchable !== selfObj && activeSearchable.hideMenu) {
        activeSearchable.hideMenu();
      }
      renderOptions(input.value, showAll);
      menu.classList.add('show');
      positionMenu();
      activeSearchable = selfObj;
    }

    function hideMenu() {
      menu.classList.remove('show');
      if (activeSearchable === selfObj) {
        activeSearchable = null;
      }
    }

    function selectValue(val) {
      input.value = val;
      hideMenu();
      if (onSelectCallback) {
        onSelectCallback(val);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function navigateItems(dir) {
      const items = Array.from(menu.querySelectorAll('.dropdown-item[data-value]'));
      if (!items.length) return;
      let currentIndex = items.findIndex(item => item.classList.contains('keyboard-focused'));
      if (currentIndex === -1) {
        currentIndex = items.findIndex(item => item.classList.contains('active'));
      }
      let nextIndex = currentIndex + dir;
      if (nextIndex < 0) nextIndex = items.length - 1;
      if (nextIndex >= items.length) nextIndex = 0;

      items.forEach(item => item.classList.remove('keyboard-focused'));
      const targetItem = items[nextIndex];
      if (targetItem) {
        targetItem.classList.add('keyboard-focused');
        targetItem.scrollIntoView({ block: 'nearest' });
      }
    }

    const selfObj = { input, menu, positionMenu, hideMenu };

    input.addEventListener('focus', () => {
      showMenu(true);
    });

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu(true);
    });

    input.addEventListener('input', () => {
      renderOptions(input.value, false);
      menu.classList.add('show');
      positionMenu();
    });

    menu.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item && item.hasAttribute('data-value')) {
        e.preventDefault();
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        selectValue(val);
      } else {
        e.preventDefault();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideMenu();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!menu.classList.contains('show')) {
          showMenu(true);
        } else {
          navigateItems(1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (menu.classList.contains('show')) {
          navigateItems(-1);
        }
      } else if (e.key === 'Enter') {
        if (menu.classList.contains('show')) {
          const highlighted = menu.querySelector('.dropdown-item.keyboard-focused, .dropdown-item.active');
          if (highlighted && highlighted.hasAttribute('data-value')) {
            e.preventDefault();
            const val = highlighted.getAttribute('data-value');
            selectValue(val);
          }
        }
      }
    });

    // Attach global window/document listeners once only
    if (!globalDropdownListenersAttached) {
      globalDropdownListenersAttached = true;
      document.addEventListener('click', (e) => {
        if (activeSearchable) {
          if (!activeSearchable.input.contains(e.target) && !activeSearchable.menu.contains(e.target)) {
            activeSearchable.hideMenu();
          }
        }
      });
      window.addEventListener('scroll', (e) => {
        if (activeSearchable) {
          if (e && e.target && (e.target === activeSearchable.menu || activeSearchable.menu.contains(e.target))) {
            return;
          }
          activeSearchable.positionMenu();
        }
      }, { capture: true, passive: true });
      window.addEventListener('resize', () => {
        if (activeSearchable) {
          activeSearchable.positionMenu();
        }
      }, { passive: true });
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
