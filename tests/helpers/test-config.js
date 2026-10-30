/**
 * tests/helpers/test-config.js
 * Test configuration, environment setup, and helper utilities.
 */
process.env.RENDER = 'true';
process.env.NODE_ENV = 'test';
require('dotenv').config();

const db = require('../../db');
const http = require('http');

let baseSlNo = 999000;
function getNextTestSlNo() {
  baseSlNo += 1;
  return baseSlNo;
}

/**
 * Clean up all test rows associated with a test customer SlNo
 * across installments, installment_txns, commission_txns, and installment_remarks.
 */
async function cleanupTestCustomer(slNo) {
  if (!slNo) return;
  try {
    // 1. Delete transactions
    const txns = await db.getTable('installment_txns').catch(() => []);
    const matchingTxns = txns.filter(t => Number(t.SlNo) === Number(slNo));
    for (const t of matchingTxns) {
      if (t.TxnID) await db.deleteRow('installment_txns', 'TxnID', t.TxnID).catch(() => {});
    }

    // 2. Delete commissions
    const comms = await db.getTable('commission_txns').catch(() => []);
    const matchingComms = comms.filter(c => Number(c.SlNo) === Number(slNo));
    for (const c of matchingComms) {
      if (c.TxnID) await db.deleteRow('commission_txns', 'TxnID', c.TxnID).catch(() => {});
    }

    // 3. Delete remarks
    const remarks = await db.getTable('installment_remarks').catch(() => []);
    const matchingRem = remarks.filter(r => Number(r.SlNo) === Number(slNo));
    for (const r of matchingRem) {
      if (r.RemarkID) await db.deleteRow('installment_remarks', 'RemarkID', r.RemarkID).catch(() => {});
    }

    // 4. Delete customer from installments
    await db.deleteRow('installments', 'SlNo', slNo).catch(() => {});
  } catch (err) {
    console.warn(`[Cleanup Warning] Cleanup failed for SlNo ${slNo}:`, err.message);
  }
}

/**
 * Make an HTTP request to the running server.
 */
function makeApiRequest(port, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

module.exports = {
  db,
  getNextTestSlNo,
  cleanupTestCustomer,
  makeApiRequest
};
