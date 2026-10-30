/**
 * tests/integration/customer-crud.test.js
 * Integration tests for Customer Page CRUD operations.
 * Verifies that changes to database logic/schema do not break Customer operations.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { db, getNextTestSlNo, cleanupTestCustomer } = require('../helpers/test-config');
const { parseBrokerNumber } = require('../helpers/contract-helpers');

describe('Customer Page — Database CRUD Integration Tests', () => {
  const testSlNo = getNextTestSlNo();
  const testTxnCustId = `TXN_TEST_CUST_${testSlNo}_1`;
  const testTxnVendId = `TXN_TEST_VEND_${testSlNo}_1`;
  const testCommId = `COMM_TEST_${testSlNo}_1`;
  const testRemarkId = `REM_TEST_${testSlNo}_1`;

  const initialExpenses = {
    material: 120000,
    partner: 10000,
    install: 25000,
    transport: 5000,
    gst_pct: 18,
    gst: 36000,
    other: 4000
  };

  const initialBrokerNumber = `9876543210|creator:test_admin|expenses:${JSON.stringify(initialExpenses)}`;

  before(async () => {
    // Clean up any stray test data before starting
    await cleanupTestCustomer(testSlNo);
  });

  after(async () => {
    // Teardown: ensure DB is pristine after test run
    await cleanupTestCustomer(testSlNo);
  });

  it('1. [CREATE] Should successfully insert a new customer into installments', async () => {
    const customerPayload = {
      SlNo: testSlNo,
      Name: 'TEST AUTOMATION CUSTOMER',
      ConsumerNo: 'CONS-999888777',
      Status: 'Active',
      District: 'Khurda',
      Address: 'Plot 42, Infocity, Bhubaneswar',
      MobileNumber: '9876543210',
      CommittedBrand: 'TATA POWER',
      FirstInstallment: 0,
      SecondInstallment: 0,
      ThirdInstallment: 0,
      Total: 0,
      CommittedPrice: 200000,
      VendorPrice: 160000,
      VendorPaid: 0,
      LoginDate: '2026-10-01',
      InstallationDate: '2026-10-15',
      Commission: 5000,
      CommissionPaid: 0,
      BrokerName: 'Bhubaneswar Partner',
      BrokerNumber: initialBrokerNumber,
      CommissioningDate: '2026-10-25',
      PinCode: '751024',
      State: 'Odisha'
    };

    await db.insertRow('installments', customerPayload);

    // Verify insertion
    const allRows = await db.getTable('installments');
    const created = allRows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(created, `Customer with SlNo ${testSlNo} must exist in installments table.`);
    assert.strictEqual(created.Name, 'TEST AUTOMATION CUSTOMER');
    assert.strictEqual(created.Status, 'Active');
    assert.strictEqual(created.District, 'Khurda');
    assert.strictEqual(Number(created.CommittedPrice), 200000);
    assert.strictEqual(Number(created.VendorPrice), 160000);
    assert.strictEqual(created.BrokerName, 'Bhubaneswar Partner');
  });

  it('2. [READ] Should accurately parse BrokerNumber metadata (phone, creator, expenses)', async () => {
    const allRows = await db.getTable('installments');
    const record = allRows.find(r => Number(r.SlNo) === testSlNo);
    assert.ok(record, 'Record must exist for metadata check.');

    const parsed = parseBrokerNumber(record.BrokerNumber);
    assert.strictEqual(parsed.basePhone, '9876543210');
    assert.strictEqual(parsed.creatorId, 'test_admin');

    const expenses = JSON.parse(parsed.expensesJson);
    assert.strictEqual(expenses.material, 120000);
    assert.strictEqual(expenses.install, 25000);
    assert.strictEqual(expenses.gst_pct, 18);
  });

  it('3. [UPDATE] Should update customer details without corrupting other fields', async () => {
    const updatePayload = {
      CommittedPrice: 215000,
      VendorPrice: 170000,
      Address: 'Plot 99, Chandrasekharpur, Bhubaneswar',
      CommittedBrand: 'ADANI SOLAR'
    };

    await db.updateRow('installments', 'SlNo', testSlNo, updatePayload);

    const allRows = await db.getTable('installments');
    const updated = allRows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(updated, 'Record must exist after update.');
    assert.strictEqual(Number(updated.CommittedPrice), 215000);
    assert.strictEqual(Number(updated.VendorPrice), 170000);
    assert.strictEqual(updated.Address, 'Plot 99, Chandrasekharpur, Bhubaneswar');
    assert.strictEqual(updated.CommittedBrand, 'ADANI SOLAR');
    // Ensure untouched fields remain intact
    assert.strictEqual(updated.Name, 'TEST AUTOMATION CUSTOMER');
    assert.strictEqual(updated.District, 'Khurda');
  });

  it('4. [SOFT DELETE] Should deactivate customer (Status: Deactive)', async () => {
    await db.updateRow('installments', 'SlNo', testSlNo, { Status: 'Deactive' });

    const allRows = await db.getTable('installments');
    const record = allRows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.Status, 'Deactive', 'Status must be updated to Deactive.');
  });

  it('5. [RESTORE] Should reactivate customer (Status: Active)', async () => {
    await db.updateRow('installments', 'SlNo', testSlNo, { Status: 'Active' });

    const allRows = await db.getTable('installments');
    const record = allRows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(record, 'Record must exist.');
    assert.strictEqual(record.Status, 'Active', 'Status must be restored to Active.');
  });

  it('6. [RELATED / TXN] Should insert and retrieve customer payment in installment_txns', async () => {
    const txnPayload = {
      TxnID: testTxnCustId,
      SlNo: testSlNo,
      TxnDate: '2026-10-30',
      Amount: 50000,
      Remark: 'Advance Token Payment',
      TxnType: 'Customer'
    };

    await db.insertRow('installment_txns', txnPayload);

    const allTxns = await db.getTable('installment_txns');
    const foundTxn = allTxns.find(t => t.TxnID === testTxnCustId);

    assert.ok(foundTxn, 'Transaction must exist in installment_txns.');
    assert.strictEqual(Number(foundTxn.SlNo), testSlNo);
    assert.strictEqual(Number(foundTxn.Amount), 50000);
    assert.strictEqual(foundTxn.TxnType, 'Customer');
    assert.strictEqual(foundTxn.Remark, 'Advance Token Payment');
  });

  it('7. [RELATED / TXN] Should insert and retrieve vendor payment in installment_txns', async () => {
    const txnPayload = {
      TxnID: testTxnVendId,
      SlNo: testSlNo,
      TxnDate: '2026-10-30',
      Amount: 40000,
      Remark: 'Vendor Material Advance',
      TxnType: 'Vendor'
    };

    await db.insertRow('installment_txns', txnPayload);

    const allTxns = await db.getTable('installment_txns');
    const foundTxn = allTxns.find(t => t.TxnID === testTxnVendId);

    assert.ok(foundTxn, 'Vendor transaction must exist in installment_txns.');
    assert.strictEqual(Number(foundTxn.SlNo), testSlNo);
    assert.strictEqual(Number(foundTxn.Amount), 40000);
    assert.strictEqual(foundTxn.TxnType, 'Vendor');
  });

  it('8. [RELATED / TXN UPDATE & DELETE] Should update transaction and delete by TxnID', async () => {
    // Update amount
    await db.updateRow('installment_txns', 'TxnID', testTxnCustId, { Amount: 60000, Remark: 'Updated Token Payment' });

    let allTxns = await db.getTable('installment_txns');
    let txn = allTxns.find(t => t.TxnID === testTxnCustId);
    assert.ok(txn, 'Txn must still exist.');
    assert.strictEqual(Number(txn.Amount), 60000);
    assert.strictEqual(txn.Remark, 'Updated Token Payment');

    // Delete both transactions
    await db.deleteRow('installment_txns', 'TxnID', testTxnCustId);
    await db.deleteRow('installment_txns', 'TxnID', testTxnVendId);

    allTxns = await db.getTable('installment_txns');
    assert.strictEqual(allTxns.some(t => t.TxnID === testTxnCustId), false, 'Customer txn must be deleted.');
    assert.strictEqual(allTxns.some(t => t.TxnID === testTxnVendId), false, 'Vendor txn must be deleted.');
  });

  it('9. [RELATED / COMMISSION] Should insert, read, and delete commission transaction', async () => {
    const commPayload = {
      TxnID: testCommId,
      SlNo: testSlNo,
      TxnDate: '2026-10-30',
      Amount: 2500,
      Remark: 'Partner Commission Payout'
    };

    await db.insertRow('commission_txns', commPayload);

    let allComms = await db.getTable('commission_txns');
    let comm = allComms.find(c => c.TxnID === testCommId);
    assert.ok(comm, 'Commission transaction must exist in commission_txns.');
    assert.strictEqual(Number(comm.Amount), 2500);

    // Delete commission transaction
    await db.deleteRow('commission_txns', 'TxnID', testCommId);
    allComms = await db.getTable('commission_txns');
    assert.strictEqual(allComms.some(c => c.TxnID === testCommId), false, 'Commission txn must be deleted.');
  });

  it('10. [RELATED / REMARKS] Should insert, read, and delete customer remarks', async () => {
    const remarkPayload = {
      RemarkID: testRemarkId,
      SlNo: testSlNo,
      Type: 'Customer',
      Remark: 'Customer requested meter connection before Diwali',
      CreatedAt: new Date().toISOString()
    };

    await db.insertRow('installment_remarks', remarkPayload);

    let allRemarks = await db.getTable('installment_remarks');
    let remark = allRemarks.find(r => r.RemarkID === testRemarkId);
    assert.ok(remark, 'Remark must exist in installment_remarks.');
    assert.strictEqual(remark.Remark, 'Customer requested meter connection before Diwali');

    // Delete remark
    await db.deleteRow('installment_remarks', 'RemarkID', testRemarkId);
    allRemarks = await db.getTable('installment_remarks');
    assert.strictEqual(allRemarks.some(r => r.RemarkID === testRemarkId), false, 'Remark must be deleted.');
  });

  it('11. [BATCH CRUD] Should insert and delete batch rows in installments', async () => {
    const batchSlNo1 = getNextTestSlNo();
    const batchSlNo2 = getNextTestSlNo();

    const batchRows = [
      { SlNo: batchSlNo1, Name: 'BATCH CUSTOMER 1', Status: 'Active', District: 'Cuttack' },
      { SlNo: batchSlNo2, Name: 'BATCH CUSTOMER 2', Status: 'Active', District: 'Puri' }
    ];

    try {
      await db.insertRows('installments', batchRows);

      let rows = await db.getTable('installments');
      assert.ok(rows.some(r => Number(r.SlNo) === batchSlNo1), 'Batch customer 1 must exist.');
      assert.ok(rows.some(r => Number(r.SlNo) === batchSlNo2), 'Batch customer 2 must exist.');

      // Batch delete
      await db.deleteRows('installments', 'SlNo', [batchSlNo1, batchSlNo2]);

      rows = await db.getTable('installments');
      assert.strictEqual(rows.some(r => Number(r.SlNo) === batchSlNo1), false, 'Batch customer 1 must be deleted.');
      assert.strictEqual(rows.some(r => Number(r.SlNo) === batchSlNo2), false, 'Batch customer 2 must be deleted.');
    } finally {
      await db.deleteRow('installments', 'SlNo', batchSlNo1).catch(() => {});
      await db.deleteRow('installments', 'SlNo', batchSlNo2).catch(() => {});
    }
  });

  it('12. [HARD DELETE] Should permanently delete customer from installments', async () => {
    await db.deleteRow('installments', 'SlNo', testSlNo);

    const allRows = await db.getTable('installments');
    const exists = allRows.some(r => Number(r.SlNo) === testSlNo);

    assert.strictEqual(exists, false, `Customer SlNo ${testSlNo} must be permanently deleted.`);
  });
});
