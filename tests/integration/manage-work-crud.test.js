/**
 * tests/integration/manage-work-crud.test.js
 * Integration tests for Manage Work Page CRUD operations.
 * Verifies stage transitions, net metering, discom hierarchy, product specs,
 * and metadata preservation.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { db, getNextTestSlNo, cleanupTestCustomer } = require('../helpers/test-config');
const { parseBrokerNumber, formatBrokerNumberWithWorkMeta } = require('../helpers/contract-helpers');

describe('Manage Work Page — Database CRUD Integration Tests', () => {
  const testSlNo = getNextTestSlNo();

  const initialExpenses = {
    material: 110000,
    partner: 12000,
    install: 20000,
    transport: 4000,
    gst_pct: 18,
    gst: 32400,
    other: 3600
  };

  const initialBrokerNumber = `9123456789|creator:admin_work|expenses:${JSON.stringify(initialExpenses)}`;

  before(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  after(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  it('1. [BASELINE CREATE] Should insert baseline customer for work tracking', async () => {
    const customer = {
      SlNo: testSlNo,
      Name: 'TEST WORK TRACKING CUSTOMER',
      ConsumerNo: 'CN-12345678',
      Status: 'Active',
      District: 'Cuttack',
      Address: 'Badambadi, Cuttack',
      MobileNumber: '9123456789',
      CommittedBrand: 'WAAREE',
      CommittedPrice: 195000,
      VendorPrice: 150000,
      BrokerName: 'Cuttack Solar Partner',
      BrokerNumber: initialBrokerNumber,
      LoginDate: '2026-10-01'
    };

    await db.insertRow('installments', customer);

    const rows = await db.getTable('installments');
    const created = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(created, `Customer SlNo ${testSlNo} must exist in installments.`);
    assert.strictEqual(created.Name, 'TEST WORK TRACKING CUSTOMER');
    assert.strictEqual(created.LoginDate, '2026-10-01');
  });

  it('2. [WORK STAGES / UPDATE] Should sequentially record all 8 work milestone stages', async () => {
    const stageUpdates = {
      LoginDate: '2026-10-01',
      AgreementDate: '2026-10-05',
      MaterialDispatchedDate: '2026-10-10',
      InstallationDate: '2026-10-14',
      NetMeterDate: '2026-10-18',
      InspectionDate: '2026-10-21',
      MeterConnectedDate: '2026-10-24',
      CommissioningDate: '2026-10-28'
    };

    // Simulate Manage Work's saveWorkProgress:
    // In db/postgres.js, columns outside VALID_INSTALLMENT_COLS get packed into BrokerNumber |work:{...}
    // and unpacked during getTable('installments').
    await db.updateRow('installments', 'SlNo', testSlNo, stageUpdates);

    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.LoginDate, '2026-10-01', 'LoginDate must match.');
    assert.strictEqual(record.AgreementDate, '2026-10-05', 'AgreementDate must match.');
    assert.strictEqual(record.MaterialDispatchedDate, '2026-10-10', 'MaterialDispatchedDate must match.');
    assert.strictEqual(record.InstallationDate, '2026-10-14', 'InstallationDate must match.');
    assert.strictEqual(record.NetMeterDate, '2026-10-18', 'NetMeterDate must match.');
    assert.strictEqual(record.InspectionDate, '2026-10-21', 'InspectionDate must match.');
    assert.strictEqual(record.MeterConnectedDate, '2026-10-24', 'MeterConnectedDate must match.');
    assert.strictEqual(record.CommissioningDate, '2026-10-28', 'CommissioningDate must match.');
  });

  it('3. [STAGE REVERSAL / TOGGLE OFF] Should clear dates when a stage is turned OFF', async () => {
    // Turning off Inspection and Meter Connection
    const revertUpdates = {
      InspectionDate: '',
      MeterConnectedDate: ''
    };

    await db.updateRow('installments', 'SlNo', testSlNo, revertUpdates);

    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.InspectionDate || '', '', 'InspectionDate must be cleared.');
    assert.strictEqual(record.MeterConnectedDate || '', '', 'MeterConnectedDate must be cleared.');
    // Previous stages must remain untouched
    assert.strictEqual(record.AgreementDate, '2026-10-05', 'AgreementDate must remain intact.');
    assert.strictEqual(record.InstallationDate, '2026-10-14', 'InstallationDate must remain intact.');
  });

  it('4. [NET METERING] Should update NetMeterPayment, NetMeterPaid, and preserve expense sync', async () => {
    const netMeterPayload = {
      NetMeterPayment: 5051,
      NetMeterPaid: true,
      NetMeterDate: '2026-10-19'
    };

    await db.updateRow('installments', 'SlNo', testSlNo, netMeterPayload);

    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(Number(record.NetMeterPayment), 5051, 'NetMeterPayment must be 5051.');
    assert.strictEqual(Boolean(record.NetMeterPaid), true, 'NetMeterPaid must be true.');
    assert.strictEqual(record.NetMeterDate, '2026-10-19', 'NetMeterDate must match.');
  });

  it('5. [DISCOM HIERARCHY] Should update and retrieve electrical grid hierarchy fields', async () => {
    const discomPayload = {
      CircleName: 'TPCODL-ELEC. CIRCLE I,BBSR',
      DivisionName: 'BED,BHUBANESWAR',
      SubDivision: 'Rasulgarh SubDiv',
      ApplicationNumber: 'NP-ODTCO26-999999',
      ProposedCapacity: '4.500'
    };

    await db.updateRow('installments', 'SlNo', testSlNo, discomPayload);

    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.CircleName, 'TPCODL-ELEC. CIRCLE I,BBSR');
    assert.strictEqual(record.DivisionName, 'BED,BHUBANESWAR');
    assert.strictEqual(record.SubDivision, 'Rasulgarh SubDiv');
    assert.strictEqual(record.ApplicationNumber, 'NP-ODTCO26-999999');
    assert.strictEqual(record.ProposedCapacity, '4.500');
  });

  it('6. [PRODUCT SPECS] Should store and retrieve equipment specifications (JSONB)', async () => {
    const specsData = {
      panelBrand: 'Waaree Bifacial',
      panelWatt: 540,
      panelQty: 8,
      inverterBrand: 'Growatt 5kW',
      structureType: 'Elevated HDGI'
    };

    const specsPayload = {
      ProductSpecs: specsData,
      SpecsUpdatedBy: 'site_engineer_01',
      SpecsUpdatedAt: '2026-10-30T12:00:00Z'
    };

    await db.updateRow('installments', 'SlNo', testSlNo, specsPayload);

    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.SpecsUpdatedBy, 'site_engineer_01');

    // Parse if returned as string or use directly if returned as object
    const returnedSpecs = typeof record.ProductSpecs === 'string'
      ? JSON.parse(record.ProductSpecs)
      : record.ProductSpecs;

    assert.ok(returnedSpecs, 'ProductSpecs must be present.');
    assert.strictEqual(returnedSpecs.panelBrand, 'Waaree Bifacial');
    assert.strictEqual(Number(returnedSpecs.panelWatt), 540);
    assert.strictEqual(returnedSpecs.inverterBrand, 'Growatt 5kW');
  });

  it('7. [METADATA INTEGRITY] Work updates must not corrupt base phone, creatorId, or expenses', async () => {
    const rows = await db.getTable('installments');
    const record = rows.find(r => Number(r.SlNo) === testSlNo);

    const { basePhone, creatorId, expensesJson, workObj } = parseBrokerNumber(record.BrokerNumber);

    assert.strictEqual(basePhone, '9123456789', 'Base phone number must be preserved.');
    assert.strictEqual(creatorId, 'admin_work', 'Creator ID must be preserved.');
    assert.ok(expensesJson, 'Expenses JSON must exist.');

    const exp = JSON.parse(expensesJson);
    assert.strictEqual(exp.material, 110000, 'Material expense must not be corrupted.');
    assert.strictEqual(exp.install, 20000, 'Install expense must not be corrupted.');

    // Work object should contain active work stages
    assert.strictEqual(workObj.AgreementDate, '2026-10-05');
    assert.strictEqual(workObj.SubDivision, 'Rasulgarh SubDiv');
  });

  it('8. [TEARDOWN] Should clean up test work record', async () => {
    await db.deleteRow('installments', 'SlNo', testSlNo);

    const rows = await db.getTable('installments');
    const exists = rows.some(r => Number(r.SlNo) === testSlNo);

    assert.strictEqual(exists, false, `Test customer ${testSlNo} must be deleted.`);
  });
});
