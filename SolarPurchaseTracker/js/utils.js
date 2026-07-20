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

  return { uid, nextShipmentNo, getQueryParam, debounce, exportRowsToExcel, exportTableToPDF, csvEscape };
})();
