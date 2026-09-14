/* =========================================================================
   dashboard.js
   ========================================================================= */

window.onDbReady = function () {
  UI.renderSidebar('dashboard.html');
  UI.renderTopbar('Dashboard');
  render();
};

function render() {
  const shipments = DB.getAll('shipments');
  const materials = DB.getAll('materials');

  const enriched = shipments.map(s => {
    const mats = materials.filter(m => m.ShipmentNo === s.ShipmentNo);
    const result = Calc.computeShipment(mats, s.TransportationCost, s.GSTPercentage);
    return { ...s, ...result };
  });

  renderKPIs(enriched, materials);
  renderCharts(enriched);
  renderRecentTable(enriched.slice().sort((a, b) => new Date(b.PurchaseDate) - new Date(a.PurchaseDate)).slice(0, 8));
}

function renderKPIs(enriched, materials) {
  const totalShipments = enriched.length;
  const totalPurchase = enriched.reduce((s, e) => s + e.purchaseTotal, 0);
  const totalTransport = enriched.reduce((s, e) => s + e.transport, 0);
  const totalGST = enriched.reduce((s, e) => s + e.gstAmount, 0);
  const totalMaterials = materials.length;
  const avgShipmentCost = totalShipments ? enriched.reduce((s, e) => s + e.grandTotal, 0) / totalShipments : 0;
  const avgTransportPct = totalPurchase ? (totalTransport / totalPurchase) * 100 : 0;

  const kpis = [
    { label: 'Total Shipments', value: totalShipments, icon: 'truck', colorClass: 'blue' },
    { label: 'Total Purchase Amount', value: UI.money(totalPurchase), icon: 'bar-chart', colorClass: 'blue' },
    { label: 'Total Transportation', value: UI.money(totalTransport), icon: 'truck', colorClass: 'orange' },
    { label: 'Total GST', value: UI.money(totalGST), icon: 'gear', colorClass: '' },
    { label: 'Total Materials Purchased', value: totalMaterials, icon: 'box', colorClass: 'orange' },
    { label: 'Average Shipment Cost', value: UI.money(avgShipmentCost), icon: 'bar-chart', colorClass: '' },
    { label: 'Average Transportation %', value: avgTransportPct.toFixed(2) + '%', icon: 'truck', colorClass: 'orange' },
  ];

  document.getElementById('kpiRow').innerHTML = kpis.map(k => `
    <div class="col-md-3 col-sm-6">
      <div class="kpi-card">
        <div class="kpi-icon ${k.colorClass}">${UI.icon(k.icon, 20)}</div>
        <div>
          <div class="kpi-value">${k.value}</div>
          <div class="kpi-label">${k.label}</div>
        </div>
      </div>
    </div>
  `).join('');
}

let chartMonthly, chartVendor, chartMaterial;

function renderCharts(enriched) {
  // Monthly purchase totals
  const byMonth = {};
  enriched.forEach(e => {
    const d = new Date(e.PurchaseDate);
    const key = isNaN(d) ? 'Unknown' : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    byMonth[key] = (byMonth[key] || 0) + e.grandTotal;
  });

  // Vendor wise
  const byVendor = {};
  enriched.forEach(e => { byVendor[e.VendorName || 'Unknown'] = (byVendor[e.VendorName || 'Unknown'] || 0) + e.grandTotal; });

  // Material wise
  const byMaterial = {};
  enriched.forEach(e => e.lines.forEach(l => {
    byMaterial[l.ItemName || 'Unknown'] = (byMaterial[l.ItemName || 'Unknown'] || 0) + l.FinalCost;
  }));

  const palette = ['#4338ca', '#0284c7', '#059669', '#d97706', '#64748b', '#7c3aed', '#0891b2', '#475569'];

  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(document.getElementById('chartMonthly'), {
    type: 'bar',
    data: { labels: Object.keys(byMonth), datasets: [{ label: 'Purchase (₹)', data: Object.values(byMonth), backgroundColor: '#4338ca', borderRadius: 2 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
  });

  if (chartVendor) chartVendor.destroy();
  chartVendor = new Chart(document.getElementById('chartVendor'), {
    type: 'doughnut',
    data: { labels: Object.keys(byVendor), datasets: [{ data: Object.values(byVendor), backgroundColor: palette, borderWidth: 1, borderColor: '#ffffff' }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, family: 'Inter' }, padding: 12 } } } }
  });

  if (chartMaterial) chartMaterial.destroy();
  chartMaterial = new Chart(document.getElementById('chartMaterial'), {
    type: 'bar',
    data: { labels: Object.keys(byMaterial), datasets: [{ label: 'Final Cost (₹)', data: Object.values(byMaterial), backgroundColor: '#0284c7', borderRadius: 2 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } } }
  });
}

function renderRecentTable(rows) {
  const tbody = document.querySelector('#recentTable tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No shipments yet. <a href="shipment.html">Add your first shipment →</a></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="font-monospace fw-semibold text-primary">${r.ShipmentNo}</span></td>
      <td class="text-secondary">${UI.fmtDate(r.PurchaseDate)}</td>
      <td class="fw-medium">${r.VendorName || '-'}</td>
      <td>${r.totalMaterials}</td>
      <td class="text-end font-monospace">${UI.money(r.purchaseTotal)}</td>
      <td class="text-end font-monospace">${UI.money(r.gstAmount)}</td>
      <td class="text-end font-monospace">${UI.money(r.transport)}</td>
      <td class="text-end font-monospace fw-bold">${UI.money(r.grandTotal)}</td>
      <td class="text-center"><a class="btn btn-sm btn-outline-secondary py-0 px-2" href="shipment-details.html?no=${encodeURIComponent(r.ShipmentNo)}">View</a></td>
    </tr>
  `).join('');
}
