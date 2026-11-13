/**
 * tests/integration/manage-work-payment.test.js
 * Integration tests for Manage Work Card Payment & Extra Customer Price features.
 * Verifies inline customer price updates, extra customer price additions,
 * payment transactions sync, and payment clearing.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { db, getNextTestSlNo, cleanupTestCustomer } = require('../helpers/test-config');

describe('Manage Work Card — Payment & Extra Customer Price Integration Tests', () => {
  const testSlNo = getNextTestSlNo();
  const testTxnId1 = `CTXN_TEST_${testSlNo}_1`;
  const testTxnId2 = `CTXN_TEST_${testSlNo}_2`;

  before(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  after(async () => {
    await cleanupTestCustomer(testSlNo);
  });

  it('1. [BASELINE CREATE] Should insert customer with initial committed price', async () => {
    const customer = {
      SlNo: testSlNo,
      Name: 'TEST WORK PAYMENT CUSTOMER',
      ConsumerNo: 'CN-PAY-9999',
      Status: 'Active',
      District: 'Khordha',
      Address: 'Saheed Nagar, Bhubaneswar',
      MobileNumber: '9876543210',
      CommittedBrand: 'TATA POWER',
      CommittedPrice: 150000,
      Total: 0,
      BrokerName: 'Bhubaneswar Partner',
      LoginDate: '2026-11-01'
    };

    await db.insertRow('installments', customer);

    const rows = await db.getTable('installments');
    const created = rows.find(r => Number(r.SlNo) === testSlNo);

    assert.ok(created, `Customer SlNo ${testSlNo} must exist in installments.`);
    assert.strictEqual(Number(created.CommittedPrice), 150000);
    assert.strictEqual(Number(created.Total || 0), 0);
  });

  it('2. [EXTRA CUSTOMER PRICE] Should update customer price when extra price is added', async () => {
    const rows = await db.getTable('installments');
    const existing = rows.find(r => Number(r.SlNo) === testSlNo);
    assert.ok(existing);

    const basePrice = Number(existing.CommittedPrice) || 0;
    const extraPrice = 15000;
    const newPrice = basePrice + extraPrice;

    await db.updateRow('installments', 'SlNo', testSlNo, {
      CommittedPrice: newPrice
    });

    const updatedRows = await db.getTable('installments');
    const updated = updatedRows.find(r => Number(r.SlNo) === testSlNo);
    assert.strictEqual(Number(updated.CommittedPrice), 165000, 'Customer price should reflect base + extra price');
  });

  it('3. [INLINE PAYMENT INSERT] Should record quick payment in installment_txns and sync total', async () => {
    const payAmt = 65000;
    const payDate = '2026-11-13';

    await db.insertRow('installment_txns', {
      TxnID: testTxnId1,
      SlNo: testSlNo,
      TxnDate: payDate,
      Amount: payAmt,
      TxnType: 'Customer',
      Remark: 'Customer Payment (Manage Work)'
    });

    // Sum all customer txns
    const txns = (await db.getTable('installment_txns')).filter(t => 
      Number(t.SlNo) === testSlNo && (t.TxnType === 'Customer' || !t.TxnType)
    );
    const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

    await db.updateRow('installments', 'SlNo', testSlNo, {
      Total: sum
    });

    const updatedRows = await db.getTable('installments');
    const updated = updatedRows.find(r => Number(r.SlNo) === testSlNo);
    assert.strictEqual(Number(updated.Total), 65000, 'Total collected should match payment transaction amount');
    
    const pending = Number(updated.CommittedPrice) - Number(updated.Total);
    assert.strictEqual(pending, 100000, 'Pending balance should accurately be 165000 - 65000 = 100000');
  });

  it('4. [FULL PAYMENT] Should support full payment and update pending to 0', async () => {
    const remainingAmt = 100000;
    const payDate = '2026-11-14';

    await db.insertRow('installment_txns', {
      TxnID: testTxnId2,
      SlNo: testSlNo,
      TxnDate: payDate,
      Amount: remainingAmt,
      TxnType: 'Customer',
      Remark: 'Final Customer Payment (Manage Work)'
    });

    const txns = (await db.getTable('installment_txns')).filter(t => 
      Number(t.SlNo) === testSlNo && (t.TxnType === 'Customer' || !t.TxnType)
    );
    const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

    await db.updateRow('installments', 'SlNo', testSlNo, {
      Total: sum
    });

    const updatedRows = await db.getTable('installments');
    const updated = updatedRows.find(r => Number(r.SlNo) === testSlNo);
    assert.strictEqual(Number(updated.Total), 165000);
    assert.strictEqual(Number(updated.CommittedPrice) - Number(updated.Total), 0, 'Customer should now be fully paid');
  });

  it('5. [DIRECT PAID UPDATE] Should support directly setting Paid amount and recalculate pending balance', async () => {
    const directPaid = 80000;
    const testTxnId3 = `CTXN_TEST_${testSlNo}_DIRECT`;

    // Clear previous and set direct paid
    await db.deleteRow('installment_txns', 'SlNo', testSlNo);
    await db.insertRow('installment_txns', {
      TxnID: testTxnId3,
      SlNo: testSlNo,
      TxnDate: '2026-11-13',
      Amount: directPaid,
      TxnType: 'Customer',
      Remark: 'Direct Paid Update (Manage Work)'
    });

    const txns = (await db.getTable('installment_txns')).filter(t => 
      Number(t.SlNo) === testSlNo && (t.TxnType === 'Customer' || !t.TxnType)
    );
    const sum = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

    await db.updateRow('installments', 'SlNo', testSlNo, {
      Total: sum
    });

    const updatedRows = await db.getTable('installments');
    const updated = updatedRows.find(r => Number(r.SlNo) === testSlNo);
    assert.strictEqual(Number(updated.Total), 80000);
    assert.strictEqual(Number(updated.CommittedPrice) - Number(updated.Total), 85000, 'Pending should be 165000 - 80000 = 85000');
  });

  it('6. [PAYMENT CLEAR / RESET] Should delete transactions and reset paid total on toggle OFF', async () => {
    await db.deleteRow('installment_txns', 'SlNo', testSlNo);

    await db.updateRow('installments', 'SlNo', testSlNo, {
      Total: 0
    });

    const txnsAfter = (await db.getTable('installment_txns')).filter(t => Number(t.SlNo) === testSlNo);
    assert.strictEqual(txnsAfter.length, 0, 'All transactions for customer should be deleted');

    const updatedRows = await db.getTable('installments');
    const updated = updatedRows.find(r => Number(r.SlNo) === testSlNo);
    assert.strictEqual(Number(updated.Total), 0, 'Total should be reset to 0');
    assert.strictEqual(Number(updated.CommittedPrice), 165000, 'Customer committed price remains intact');
  });
});
