/* =========================================================================
   reports.js
   ========================================================================= */

let lastReport = { columns: [], rows: [], title: '' };

window.onDbReady = function () {
  UI.renderSidebar('reports.html');
  UI.renderTopbar('Reports', 'Generate, print and export purchase & cost reports');

  document.getElementById('btnRun').addEventListener('click', runReport);
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnExcel').addEventListener('click', () => {
    if (!lastReport.rows.length) { UI.toast('Generate a report first.', 'warning'); return; }
    const objRows = lastReport.rows.map(r => Object.fromEntries(lastReport.columns.map((c, i) => [c, r[i]])));
    Utils.exportRowsToExcel(objRows, lastReport.columns, `${lastReport.title.replace(/\s+/g, '_')}.xlsx`);
  });
  document.getElementById('btnPDF').addEventListener('click', () => {
    if (!lastReport.rows.length) { UI.toast('Generate a report first.', 'warning'); return; }
    Utils.exportTableToPDF(lastReport.title, lastReport.columns, lastReport.rows);
  });

  runReport();
};

function getEnriched() {
  const shipments = DB.getAll('shipments');
  const materials = DB.getAll('materials');
  return shipments.map(s => {
    const mats = materials.filter(m => m.ShipmentNo === s.ShipmentNo);
    const result = Calc.computeShipment(mats, s.TransportationCost, s.GSTPercentage);
    return { ...s, ...result };
  });
}

function filterByDate(rows, from, to) {
  return rows.filter(r => {
    if (!r.PurchaseDate) return true;
    const d = new Date(r.PurchaseDate);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
  });
}

function runReport() {
  const type = document.getElementById('rType').value;
  const from = document.getElementById('rFrom').value;
  const to = document.getElementById('rTo').value;
  let enriched = filterByDate(getEnriched(), from, to);

  const builders = {
    daily: () => {
      const byDay = {};
      enriched.forEach(e => {
        const key = UI.fmtDate(e.PurchaseDate);
        byDay[key] = byDay[key] || { count: 0, purchase: 0, gst: 0, transport: 0, grand: 0 };
        byDay[key].count++; byDay[key].purchase += e.purchaseTotal; byDay[key].gst += e.gstAmount;
        byDay[key].transport += e.transport; byDay[key].grand += e.grandTotal;
      });
      const columns = ['Date', 'Shipments', 'Purchase', 'GST', 'Transport', 'Grand Total'];
      const rows = Object.entries(byDay).map(([d, v]) => [d, v.count, UI.money(v.purchase), UI.money(v.gst), UI.money(v.transport), UI.money(v.grand)]);
      return { columns, rows, title: 'Daily Purchase Report' };
    },
    monthly: () => {
      const byMonth = {};
      enriched.forEach(e => {
        const d = new Date(e.PurchaseDate);
        const key = isNaN(d) ? 'Unknown' : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        byMonth[key] = byMonth[key] || { count: 0, purchase: 0, gst: 0, transport: 0, grand: 0 };
        byMonth[key].count++; byMonth[key].purchase += e.purchaseTotal; byMonth[key].gst += e.gstAmount;
        byMonth[key].transport += e.transport; byMonth[key].grand += e.grandTotal;
      });
      const columns = ['Month', 'Shipments', 'Purchase', 'GST', 'Transport', 'Grand Total'];
      const rows = Object.entries(byMonth).map(([m, v]) => [m, v.count, UI.money(v.purchase), UI.money(v.gst), UI.money(v.transport), UI.money(v.grand)]);
      return { columns, rows, title: 'Monthly Purchase Report' };
    },
    vendor: () => {
      const byVendor = {};
      enriched.forEach(e => {
        const key = e.VendorName || 'Unknown';
        byVendor[key] = byVendor[key] || { count: 0, purchase: 0, gst: 0, transport: 0, grand: 0 };
        byVendor[key].count++; byVendor[key].purchase += e.purchaseTotal; byVendor[key].gst += e.gstAmount;
        byVendor[key].transport += e.transport; byVendor[key].grand += e.grandTotal;
      });
      const columns = ['Vendor', 'Shipments', 'Purchase', 'GST', 'Transport', 'Grand Total'];
      const rows = Object.entries(byVendor).map(([v, x]) => [v, x.count, UI.money(x.purchase), UI.money(x.gst), UI.money(x.transport), UI.money(x.grand)]);
      return { columns, rows, title: 'Vendor Purchase Report' };
    },
    item: () => {
      const byItem = {};
      enriched.forEach(e => e.lines.forEach(l => {
        byItem[l.ItemName] = byItem[l.ItemName] || { qty: 0, value: 0, transport: 0, gst: 0, final: 0 };
        byItem[l.ItemName].qty += l.Quantity; byItem[l.ItemName].value += l.PurchaseValue;
        byItem[l.ItemName].transport += l.TransportShare; byItem[l.ItemName].gst += l.GSTShare; byItem[l.ItemName].final += l.FinalCost;
      }));
      const columns = ['Item', 'Total Qty', 'Purchase Value', 'Transport Share', 'GST Share', 'Final Cost'];
      const rows = Object.entries(byItem).map(([i, v]) => [i, v.qty, UI.money(v.value), UI.money(v.transport), UI.money(v.gst), UI.money(v.final)]);
      return { columns, rows, title: 'Item Purchase Report' };
    },
    shipment: () => {
      const columns = ['Shipment No', 'Date', 'Vendor', 'Materials', 'Qty', 'Purchase', 'GST', 'Transport', 'Grand Total'];
      const rows = enriched.map(e => [e.ShipmentNo, UI.fmtDate(e.PurchaseDate), e.VendorName, e.totalMaterials, e.totalQuantity, UI.money(e.purchaseTotal), UI.money(e.gstAmount), UI.money(e.transport), UI.money(e.grandTotal)]);
      return { columns, rows, title: 'Shipment Report' };
    },
    transport: () => {
      const columns = ['Shipment No', 'Date', 'Vendor', 'Purchase Total', 'Transportation Cost', 'Transport %'];
      const rows = enriched.map(e => [e.ShipmentNo, UI.fmtDate(e.PurchaseDate), e.VendorName, UI.money(e.purchaseTotal), UI.money(e.transport), e.purchaseTotal ? ((e.transport / e.purchaseTotal) * 100).toFixed(2) + '%' : '-']);
      return { columns, rows, title: 'Transportation Report' };
    },
    gst: () => {
      const columns = ['Shipment No', 'Date', 'Vendor', 'GST %', 'Purchase Total', 'GST Amount'];
      const rows = enriched.map(e => [e.ShipmentNo, UI.fmtDate(e.PurchaseDate), e.VendorName, (e.GSTPercentage || 0) + '%', UI.money(e.purchaseTotal), UI.money(e.gstAmount)]);
      return { columns, rows, title: 'GST Report' };
    },
    costperunit: () => {
      const columns = ['Shipment No', 'Item', 'Qty', 'Unit', 'Final Cost', 'Cost Per Unit'];
      const rows = [];
      enriched.forEach(e => e.lines.forEach(l => rows.push([e.ShipmentNo, l.ItemName, l.Quantity, l.Unit, UI.money(l.FinalCost), UI.money(l.CostPerUnit)])));
      return { columns, rows, title: 'Cost Per Unit Report' };
    },
    inventory: () => {
      const byItem = {};
      enriched.forEach(e => e.lines.forEach(l => {
        byItem[l.ItemName] = byItem[l.ItemName] || { qty: 0, unit: l.Unit, shipments: new Set() };
        byItem[l.ItemName].qty += l.Quantity; byItem[l.ItemName].shipments.add(e.ShipmentNo);
      }));
      const columns = ['Item', 'Total Quantity Purchased', 'Unit', 'No. of Shipments'];
      const rows = Object.entries(byItem).map(([i, v]) => [i, v.qty, v.unit || '-', v.shipments.size]);
      return { columns, rows, title: 'Inventory Purchase Report' };
    },
  };

  const { columns, rows, title } = builders[type]();
  lastReport = { columns, rows, title };

  document.getElementById('reportHead').innerHTML = columns.map(c => `<th>${c}</th>`).join('');
  document.getElementById('reportBody').innerHTML = rows.length
    ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="empty-state">No data for the selected filters.</td></tr>`;
}
