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
    const withValue = materials.map(m => {
      const qty = Number(m.Quantity) || 0;
      const rate = Number(m.PurchaseRate) || 0;

      // Fallback to global/passed GST % if individual material has no GSTPercentage
      const itemGstPct = (m.GSTPercentage !== undefined && m.GSTPercentage !== null)
        ? Number(m.GSTPercentage)
        : (Number(gstPercent) || 0);

      // m.TotalPurchaseValue in DB / form is inclusive of GST.
      // If it is not present or 0, calculate it as Qty * Rate * (1 + GST% / 100)
      const totalInclusive = (Number(m.TotalPurchaseValue) > 0)
        ? round2(Number(m.TotalPurchaseValue))
        : round2(qty * rate * (1 + itemGstPct / 100));

      // Calculate base purchase value without GST
      const purchaseValue = round2(totalInclusive / (1 + itemGstPct / 100));
      const itemGstAmount = round2(totalInclusive - purchaseValue);

      return {
        ...m,
        Quantity: qty,
        PurchaseRate: rate,
        GSTPercentage: itemGstPct,
        PurchaseValue: purchaseValue,
        TotalPurchaseValue: totalInclusive,
        ItemGstAmount: itemGstAmount
      };
    });

    const purchaseTotal = round2(withValue.reduce((s, m) => s + m.PurchaseValue, 0));
    const gstAmount = round2(withValue.reduce((s, m) => s + m.ItemGstAmount, 0));
    const transport = Number(transportationCost) || 0;
    const grandTotal = round2(purchaseTotal + gstAmount + transport);

    const lines = withValue.map(m => {
      const shareRatio = purchaseTotal > 0 ? (m.PurchaseValue / purchaseTotal) : 0;
      const transportShare = round2(shareRatio * transport);
      // Individual GST amount is exactly the item's GST amount
      const gstShare = m.ItemGstAmount;
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

    const effectiveGstPercent = purchaseTotal > 0 ? round2((gstAmount / purchaseTotal) * 100) : 0;

    return {
      lines,
      purchaseTotal,
      gstAmount,
      GSTPercentage: effectiveGstPercent,
      transport,
      grandTotal,
      totalQuantity: withValue.reduce((s, m) => s + m.Quantity, 0),
      totalMaterials: withValue.length,
    };
  }

  return { computeShipment, round2 };
})();
