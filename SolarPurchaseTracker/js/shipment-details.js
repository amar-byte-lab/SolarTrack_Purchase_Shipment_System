/* =========================================================================
   shipment-details.js
   Renders: Shipment Information -> Material List -> Purchase Cost ->
            Transportation Distribution -> GST Distribution -> Final Cost ->
            Cost Per Unit -> Totals
   ========================================================================= */

window.onDbReady = function () {
  UI.renderSidebar('shipment.html'); // Shipments stays highlighted, this is a sub-page
  const shipmentNo = Utils.getQueryParam('no');
  const s = DB.getAll('shipments').find(x => x.ShipmentNo === shipmentNo);

  if (!s) {
    UI.renderTopbar('Shipment Not Found', '');
    document.getElementById('detailsBody').innerHTML = `
      <div class="empty-state">Shipment "${shipmentNo || ''}" was not found.
        <br><a href="shipment.html">← Back to Shipments</a></div>`;
    return;
  }

  UI.renderTopbar(`Shipment ${s.ShipmentNo}`, `Full purchase, transportation & GST cost breakdown`, `
    <button class="btn btn-outline-secondary" id="btnPrint">🖨 Print</button>
    <button class="btn btn-outline-secondary" id="btnExportExcel">⬇ Export Excel</button>
    <button class="btn btn-outline-secondary" id="btnExportPDF">⬇ Export PDF</button>
    <a class="btn btn-primary" href="shipment.html">← Back</a>
  `);

  const materials = DB.getAll('materials').filter(m => m.ShipmentNo === shipmentNo);
  const result = Calc.computeShipment(materials, s.TransportationCost, s.GSTPercentage);

  document.getElementById('detailsBody').innerHTML = `
    <div class="section-title mt-0">Shipment Information</div>
    <div class="st-card">
      <div class="row g-3">
        ${infoField('Shipment Number', s.ShipmentNo)}
        ${infoField('Purchase Date', UI.fmtDate(s.PurchaseDate))}
        ${infoField('Vendor Name', s.VendorName)}
        ${infoField('Vehicle Number', s.VehicleNumber || '-')}
        ${infoField('Invoice Number', s.InvoiceNumber || '-')}
        ${infoField('GST Percentage', (s.GSTPercentage || 0) + '%')}
        ${infoField('Remarks', s.Remarks || '-', 12)}
      </div>
    </div>

    <div class="section-title">Material List &amp; Final Cost Breakdown</div>
    <div class="st-card p-0">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr>
            <th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Rate</th>
            <th>Purchase Value</th><th>Transport Share</th><th>GST Share</th><th>Final Cost</th><th>Cost/Unit</th>
          </tr></thead>
          <tbody>
            ${result.lines.map(l => `
              <tr>
                <td class="fw-semibold">${l.ItemName}</td>
                <td>${l.Category || '-'}</td>
                <td>${l.Quantity}</td>
                <td>${l.Unit || '-'}</td>
                <td>${UI.money(l.PurchaseRate)}</td>
                <td>${UI.money(l.PurchaseValue)}</td>
                <td>${UI.money(l.TransportShare)}</td>
                <td>${UI.money(l.GSTShare)}</td>
                <td class="fw-bold">${UI.money(l.FinalCost)}</td>
                <td>${UI.money(l.CostPerUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="fw-bold" style="background:var(--st-blue-100)">
              <td colspan="5" class="text-end">Totals</td>
              <td>${UI.money(result.purchaseTotal)}</td>
              <td>${UI.money(result.transport)}</td>
              <td>${UI.money(result.gstAmount)}</td>
              <td>${UI.money(result.grandTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="row g-3 mt-1">
      <div class="col-md-3">${kpi('Purchase Cost', UI.money(result.purchaseTotal))}</div>
      <div class="col-md-3">${kpi('Transportation', UI.money(result.transport))}</div>
      <div class="col-md-3">${kpi('GST Amount', UI.money(result.gstAmount))}</div>
      <div class="col-md-3">${kpi('Grand Total', UI.money(result.grandTotal))}</div>
    </div>
  `;

  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnExportExcel').addEventListener('click', () => {
    const rows = result.lines.map(l => ({
      Item: l.ItemName, Category: l.Category, Qty: l.Quantity, Unit: l.Unit, Rate: l.PurchaseRate,
      PurchaseValue: l.PurchaseValue, TransportShare: l.TransportShare, GSTShare: l.GSTShare,
      FinalCost: l.FinalCost, CostPerUnit: l.CostPerUnit,
    }));
    Utils.exportRowsToExcel(rows, Object.keys(rows[0] || {}), `${s.ShipmentNo}_breakdown.xlsx`);
  });
  document.getElementById('btnExportPDF').addEventListener('click', () => {
    const cols = ['Item', 'Category', 'Qty', 'Unit', 'Rate', 'Purchase Value', 'Transport Share', 'GST Share', 'Final Cost', 'Cost/Unit'];
    const rows = result.lines.map(l => [l.ItemName, l.Category, l.Quantity, l.Unit, UI.money(l.PurchaseRate), UI.money(l.PurchaseValue), UI.money(l.TransportShare), UI.money(l.GSTShare), UI.money(l.FinalCost), UI.money(l.CostPerUnit)]);
    Utils.exportTableToPDF(`Shipment ${s.ShipmentNo} — Cost Breakdown`, cols, rows);
  });
};

function infoField(label, value, colWidth = 3) {
  return `<div class="col-md-${colWidth}">
    <div class="kpi-label">${label}</div>
    <div class="fw-semibold">${value}</div>
  </div>`;
}

function kpi(label, value) {
  return `<div class="st-card kpi-card"><div><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div></div>`;
}
