const db = require('../db');

(async () => {
  console.log('--- TEST 1: Database persistence across refresh ---');
  const invoiceNo = 'INV-TEST-BUCKET-01';
  const item1 = {
    InwardID: 'INW-TEST-1',
    Date: '2026-10-31',
    InvoiceNo: invoiceNo,
    Supplier: 'Adani Solar Pvt Ltd',
    ItemCode: 'PNL-001',
    Quantity: 20,
    UnitPrice: 1000,
    GstRate: 12,
    CostPerUnit: 1025,
    TransportCost: 500,
    ConsignmentTransportCost: 500,
    TotalCost: 22900,
    Location: 'Main Godown — Bay A',
    Remarks: 'First batch test'
  };
  const item2 = {
    InwardID: 'INW-TEST-2',
    Date: '2026-10-31',
    InvoiceNo: invoiceNo,
    Supplier: 'Adani Solar Pvt Ltd',
    ItemCode: 'INV-001',
    Quantity: 2,
    UnitPrice: 25000,
    GstRate: 18,
    CostPerUnit: 25000,
    TransportCost: 0,
    ConsignmentTransportCost: 500,
    TotalCost: 59000,
    Location: 'Main Godown — Bay A',
    Remarks: 'First batch test'
  };

  await db.insertRow('inventory_inwards', item1);
  await db.insertRow('inventory_inwards', item2);

  // Simulate refresh: re-fetch from database
  const fetchedInwards = await db.getTable('inventory_inwards');
  const matching = fetchedInwards.filter(i => (i.InvoiceNo || i.invoiceno) === invoiceNo);
  console.log(`Fetched ${matching.length} rows for consignment ${invoiceNo} after reload.`);

  if (matching.length !== 2) {
    console.error('FAILED: Inward items were not saved or retrieved!');
    process.exit(1);
  }
  console.log('PASSED: Data persistence verified successfully!');

  console.log('\n--- TEST 2: Consignment-wise 1 single row grouping ---');
  // Simulate grouping logic from inventory.js
  const map = new Map();
  fetchedInwards.forEach(inw => {
    const key = inw.InvoiceNo || inw.invoiceno || inw.InwardID || inw.id;
    if (!map.has(key)) {
      map.set(key, {
        key: key,
        invoiceNo: inw.InvoiceNo || inw.invoiceno || key,
        date: inw.Date || inw.date,
        supplier: inw.Supplier || inw.supplier,
        items: [],
        totalCost: 0
      });
    }
    const grp = map.get(key);
    grp.items.push({
      itemCode: inw.ItemCode || inw.itemcode,
      qty: inw.Quantity || inw.quantity,
      unitPrice: inw.UnitPrice || inw.unitprice,
      totalCost: inw.TotalCost || inw.totalcost
    });
    grp.totalCost += Number(inw.TotalCost || inw.totalcost || 0);
  });

  const consignments = Array.from(map.values());
  const thisConsignment = consignments.find(c => c.key === invoiceNo);
  console.log(`Total consignments in bucket confirmation table: ${consignments.length}`);
  console.log('Single row details:', {
    date: thisConsignment.date,
    supplier: thisConsignment.supplier,
    itemsCount: thisConsignment.items.length,
    items: thisConsignment.items,
    totalInwardCost: thisConsignment.totalCost
  });

  if (thisConsignment.items.length === 2 && thisConsignment.totalCost === 81900) {
    console.log('PASSED: Exactly 1 single row per bucket confirmation with all items side by side!');
  } else {
    console.error('FAILED: Consignment grouping unexpected result');
    process.exit(1);
  }

  // Cleanup test records
  await db.deleteRow('inventory_inwards', 'InvoiceNo', invoiceNo);
  console.log('\nCleaned up test records.');
})();
