/* =========================================================================
   calc.js — Calculation Engine
   -------------------------------------------------------------------------
   Pure functions only (no DOM, no Excel). Implements the exact formulas
   from the spec:

     Material Purchase Value   = Quantity x Purchase Rate
     Shipment Purchase Total   = SUM(Material Purchase Values)
     GST Amount                = Shipment Purchase Total x GST%
     Transportation             = entered manually
     Grand Total                = Shipment Purchase Total + GST + Transportation

     Transportation Share (per material) = (Material Value / Shipment Total) x Transportation
     GST Share (per material)            = (Material Value / Shipment Total) x GST Amount

     Final Cost   = Purchase Value + Transportation Share + GST Share
     Cost Per Unit = Final Cost / Quantity
   ========================================================================= */

const Calc = (() => {

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * @param {Array} materials  [{ItemName, Quantity, PurchaseRate, ...}, ...]
   * @param {Number} transportationCost
   * @param {Number} gstPercent
   * @returns {Object} full breakdown
   */
  function computeShipment(materials, transportationCost, gstPercent) {
    const withValue = materials.map(m => ({
      ...m,
      Quantity: Number(m.Quantity) || 0,
      PurchaseRate: Number(m.PurchaseRate) || 0,
      // Use user-entered TotalPurchaseValue if provided, else compute from Qty × Rate
      PurchaseValue: (Number(m.TotalPurchaseValue) > 0)
        ? round2(Number(m.TotalPurchaseValue))
        : round2((Number(m.Quantity) || 0) * (Number(m.PurchaseRate) || 0)),
    }));

    const purchaseTotal = round2(withValue.reduce((s, m) => s + m.PurchaseValue, 0));
    const gstAmount = round2(purchaseTotal * (Number(gstPercent) || 0) / 100);
    const transport = Number(transportationCost) || 0;
    const grandTotal = round2(purchaseTotal + gstAmount + transport);

    const lines = withValue.map(m => {
      const shareRatio = purchaseTotal > 0 ? (m.PurchaseValue / purchaseTotal) : 0;
      const transportShare = round2(shareRatio * transport);
      const gstShare = round2(shareRatio * gstAmount);
      const finalCost = round2(m.PurchaseValue + transportShare + gstShare);
      const costPerUnit = m.Quantity > 0 ? round2(finalCost / m.Quantity) : 0;
      return {
        ...m,
        TransportShare: transportShare,
        GSTShare: gstShare,
        FinalCost: finalCost,
        CostPerUnit: costPerUnit,
      };
    });

    return {
      lines,
      purchaseTotal,
      gstAmount,
      transport,
      grandTotal,
      totalQuantity: withValue.reduce((s, m) => s + m.Quantity, 0),
      totalMaterials: withValue.length,
    };
  }

  return { computeShipment, round2 };
})();
