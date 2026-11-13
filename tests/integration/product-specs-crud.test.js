/**
 * tests/integration/product-specs-crud.test.js
 * Integration tests for Technical Specifications & RTS Record popup save/update.
 * Verifies consistency across Document and Customer workflows.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { db, getNextTestSlNo, cleanupTestCustomer } = require('../helpers/test-config');
const { parseBrokerNumber } = require('../helpers/contract-helpers');

describe('Technical Specifications & RTS Record — Integration Tests', () => {
  const testSlNo = getNextTestSlNo();

  const initialExpenses = {
    material: 135000,
    partner: 12000,
    install: 22000,
    transport: 4500,
    gst_pct: 18,
    gst: 38000,
    other: 3500
  };

  const initialBrokerNumber = `9861001122|creator:admin|expenses:${JSON.stringify(initialExpenses)}|work:{"SubDivision":"SDO JAJPUR","DivisionName":"CED JAJPUR","CircleName":"JAJPUR","ApplicationNumber":"NP-OD-998877","ProposedCapacity":"3.33"}`;

  before(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  after(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  it('1. [SETUP] Should create test customer with work and expenses metadata in BrokerNumber', async () => {
    const customer = {
      SlNo: testSlNo,
      Name: 'PRADIP KUMAR DAS',
      ConsumerNo: 'CONS-SPEC-1001',
      Status: 'Active',
      District: 'Jajpur',
      Address: 'At/Po Jajpur Town, Odisha',
      MobileNumber: '9861001122',
      CommittedBrand: 'M: LUMINOUS | Inv: LUMINOUS',
      CommittedPrice: 220000,
      VendorPrice: 175000,
      BrokerName: 'Jajpur Associate',
      BrokerNumber: initialBrokerNumber,
      ProposedCapacity: '3.33',
      State: 'Odisha',
      PinCode: '755001'
    };

    await db.insertRow('installments', customer);

    const rows = await db.getTable('installments');
    const row = rows.find(r => Number(r.SlNo) === testSlNo);
    assert.ok(row, 'Inserted customer must exist.');
    assert.strictEqual(row.Name, 'PRADIP KUMAR DAS');
    assert.strictEqual(row.SubDivision, 'SDO JAJPUR');
  });

  it('2. [SPECS SAVE] Should save complete ProductSpecs without losing existing phone, creator, or expenses', async () => {
    const specs = {
      DateOfInstallation: '2026-11-15',
      DateOfCommission: '2026-11-20',
      ConnectionType: '1PH LT',
      SiteAddress: 'AT/PO JAJPUR TOWN, ODISHA',
      District: 'JAJPUR',
      PinCode: '755001',
      State: 'ODISHA',
      GridTiedInverter: {
        Name: 'GRID-TIED',
        TotalNo: '1',
        Make: 'LUMINOUS',
        SerialNo: 'INV-SN-882299',
        Capacity: '3.3 KW',
        InputVoltage: '300 V DC',
        OutputVoltage: '220 - 240 V AC'
      },
      PvModule: {
        Make: 'ADANI',
        NoOfModule: '6',
        TypeAndModel: 'BIFACIAL',
        CapacityEach: '555 Wp',
        TotalCapacity: '3.33 kWp (3330 Wp)',
        SerialNumbers: ['MOD01', 'MOD02', 'MOD03', 'MOD04', 'MOD05', 'MOD06'],
        ModuleCapacities: ['555', '555', '555', '555', '555', '555']
      },
      EarthingVerification: {
        DcEarthing: '1.7 OHM',
        AcEarthing: '2.3 OHM'
      },
      DetailsOfCablesDc: {
        Make: 'KEI',
        SizeType: '4 SQ MM'
      },
      DetailsOfDcdb: {
        Make: 'HAVELLS',
        SerialNo: 'DCDB-101',
        SpdRating: 'TYPE II',
        McbDetails: '32 AMP (1 NO)'
      },
      DetailsOfAcdb: {
        Make: 'HAVELLS',
        SerialNo: 'ACDB-202',
        SpdRating: 'TYPE II',
        McbDetails: '32 AMP (1 NO)'
      },
      DetailsOfEarthing: {
        EarthResistance: '3 OHM',
        EarthWireSize: '16 SQ MM ALUMINUM',
        LaSizeType: 'COPPER BOUNDED',
        DcEarthing: '1.7 OHM',
        AcEarthing: '2.3 OHM'
      },
      CreatedBy: 'AdminUser',
      UpdatedBy: 'AdminUser',
      UpdatedAt: new Date().toISOString()
    };

    const updatePayload = {
      CommittedBrand: 'M: ADANI | Inv: LUMINOUS',
      ProductSpecs: specs,
      Address: 'AT/PO JAJPUR TOWN, ODISHA',
      District: 'JAJPUR',
      PinCode: '755001',
      State: 'ODISHA',
      InstallationDate: '2026-11-15',
      CommissioningDate: '2026-11-20',
      SpecsUpdatedBy: 'AdminUser',
      SpecsUpdatedAt: specs.UpdatedAt
    };

    await db.updateRow('installments', 'SlNo', testSlNo, updatePayload);

    const rows = await db.getTable('installments');
    const updated = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(updated, 'Updated customer must exist.');
    assert.strictEqual(updated.CommittedBrand, 'M: ADANI | Inv: LUMINOUS');
    assert.strictEqual(updated.SpecsUpdatedBy, 'AdminUser');

    // Verify ProductSpecs structure
    const retrievedSpecs = typeof updated.ProductSpecs === 'string' ? JSON.parse(updated.ProductSpecs) : updated.ProductSpecs;
    assert.ok(retrievedSpecs, 'ProductSpecs must be present.');
    assert.strictEqual(retrievedSpecs.GridTiedInverter.Make, 'LUMINOUS');
    assert.strictEqual(retrievedSpecs.GridTiedInverter.SerialNo, 'INV-SN-882299');
    assert.strictEqual(retrievedSpecs.PvModule.Make, 'ADANI');
    assert.strictEqual(retrievedSpecs.PvModule.NoOfModule, '6');
    assert.strictEqual(retrievedSpecs.PvModule.SerialNumbers.length, 6);
    assert.strictEqual(retrievedSpecs.PvModule.SerialNumbers[0], 'MOD01');
    assert.strictEqual(retrievedSpecs.PvModule.ModuleCapacities[0], '555');

    // Verify BrokerNumber preservation
    const parsedBroker = parseBrokerNumber(updated.BrokerNumber);
    assert.strictEqual(parsedBroker.basePhone, '9861001122', 'Base phone must be preserved.');
    assert.strictEqual(parsedBroker.creatorId, 'admin', 'Creator ID must be preserved.');

    const parsedExpenses = JSON.parse(parsedBroker.expensesJson);
    assert.strictEqual(parsedExpenses.material, 135000, 'Expenses material must be preserved.');
    assert.strictEqual(parsedExpenses.install, 22000, 'Expenses install must be preserved.');

    // Verify work metadata preserved
    const workData = parsedBroker.workObj;
    assert.strictEqual(workData.SubDivision, 'SDO JAJPUR', 'SubDivision must be preserved.');
    assert.strictEqual(workData.DivisionName, 'CED JAJPUR', 'DivisionName must be preserved.');
  });

  it('3. [SPECS UPDATE & CLEAR DATE] Should allow updating module serials and clearing installation date', async () => {
    const rows = await db.getTable('installments');
    const existing = rows.find(r => Number(r.SlNo) === testSlNo);
    let specs = typeof existing.ProductSpecs === 'string' ? JSON.parse(existing.ProductSpecs) : existing.ProductSpecs;

    // Update serials to 8 modules
    specs.PvModule.NoOfModule = '8';
    specs.PvModule.SerialNumbers = ['SN01', 'SN02', 'SN03', 'SN04', 'SN05', 'SN06', 'SN07', 'SN08'];
    specs.PvModule.ModuleCapacities = ['550', '550', '550', '550', '550', '550', '550', '550'];
    specs.PvModule.TotalCapacity = '4.40 kWp (4400 Wp)';
    specs.DateOfInstallation = null;

    const updatePayload = {
      ProductSpecs: specs,
      InstallationDate: null,
      SpecsUpdatedBy: 'EditorUser',
      SpecsUpdatedAt: new Date().toISOString()
    };

    await db.updateRow('installments', 'SlNo', testSlNo, updatePayload);

    const refreshedRows = await db.getTable('installments');
    const refreshed = refreshedRows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(refreshed, 'Refreshed customer must exist.');
    assert.strictEqual(refreshed.InstallationDate, null, 'InstallationDate should be successfully cleared to null.');

    const refreshedSpecs = typeof refreshed.ProductSpecs === 'string' ? JSON.parse(refreshed.ProductSpecs) : refreshed.ProductSpecs;
    assert.strictEqual(refreshedSpecs.PvModule.NoOfModule, '8');
    assert.strictEqual(refreshedSpecs.PvModule.SerialNumbers.length, 8);
    assert.strictEqual(refreshedSpecs.PvModule.SerialNumbers[7], 'SN08');
    assert.strictEqual(refreshed.SpecsUpdatedBy, 'EditorUser');
  });
});
