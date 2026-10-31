// Test calculation logic matches user requirements
function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// 1. Simulate user adding 2 items with transport cost
const consignmentTransportCost = 500;
const items = [
  { itemCode: 'PNL-001', qty: 10, unitPrice: 1000, gstRate: 12 },
  { itemCode: 'INV-001', qty: 2, unitPrice: 20000, gstRate: 18 }
];

// Calculation of line totals
let sumTotalWithGst = 0;
let sumGstAmount = 0;
items.forEach(r => {
  const rateWithGst = round2(r.unitPrice * (1 + r.gstRate / 100));
  const totalWithoutGst = round2(r.qty * r.unitPrice);
  const totalWithGst = round2(r.qty * rateWithGst);
  r.rateWithGst = rateWithGst;
  r.totalWithoutGst = totalWithoutGst;
  r.totalWithGst = totalWithGst;
  sumTotalWithGst += totalWithGst;
  sumGstAmount += (totalWithGst - totalWithoutGst);
});

// Apportion transport cost
items.forEach(r => {
  const share = round2((r.totalWithGst / sumTotalWithGst) * consignmentTransportCost);
  r.transportCost = share;
  r.costPerUnit = round2(r.unitPrice + (share / r.qty));
});

const totalMaterialCost = round2(sumTotalWithGst + consignmentTransportCost);

console.log('--- Initial Saved Data ---');
items.forEach(r => {
  console.log(`Item: ${r.itemCode}, QTY: ${r.qty}, Cost: ${r.unitPrice}, GST%: ${r.gstRate}, CostPerUnit: ${r.costPerUnit}, TransportCost: ${r.transportCost}`);
});
console.log('Consignment Transport Cost:', consignmentTransportCost);
console.log('Total GST:', sumGstAmount);
console.log('Total Material Cost:', totalMaterialCost);

// 2. Simulate opening the consignment with ONLY the saved base fields:
const reopenedItems = items.map(r => ({
  itemCode: r.itemCode,
  qty: r.qty,
  unitPrice: r.unitPrice,
  gstRate: r.gstRate,
  transportCost: r.transportCost,
  costPerUnit: r.costPerUnit
}));

// Autocalculate dynamically
let recalcSumWithGst = 0;
let recalcGstAmount = 0;
reopenedItems.forEach(r => {
  const rg = round2(r.unitPrice * (1 + r.gstRate / 100));
  const twg = round2(r.qty * r.unitPrice);
  const t = round2(r.qty * rg);
  recalcSumWithGst += t;
  recalcGstAmount += (t - twg);
  const cpu = round2(r.unitPrice + (r.transportCost / r.qty));
  console.log(`Reopened ${r.itemCode}: Cost+GST=${rg}, TotalCost=${twg}, TotalWithGST=${t}, CostPerUnit=${cpu}`);
});

const recalcTotalMaterialCost = round2(recalcSumWithGst + consignmentTransportCost);
console.log('Reopened Total GST:', recalcGstAmount);
console.log('Reopened Total Material Cost:', recalcTotalMaterialCost);

if (recalcTotalMaterialCost === totalMaterialCost && recalcGstAmount === sumGstAmount) {
  console.log('TEST PASSED: Dynamic calculation reproduces exact figures from base fields!');
} else {
  console.error('TEST FAILED');
  process.exit(1);
}
