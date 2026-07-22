const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'solartrack.db');

let db = null;

function init() {
  if (db) return;
  db = new DatabaseSync(DB_PATH);

  // Setup schema tables
  db.exec(`CREATE TABLE IF NOT EXISTS settings ("Key" TEXT PRIMARY KEY, "Value" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS vendors ("VendorName" TEXT PRIMARY KEY, "Address" TEXT, "Phone" TEXT, "GSTIN" TEXT, "Email" TEXT, "Remarks" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS items ("ItemName" TEXT PRIMARY KEY, "Category" TEXT, "Unit" TEXT, "HSNCode" TEXT, "GSTPercent" TEXT, "Status" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS installments ("SlNo" INTEGER PRIMARY KEY, "Name" TEXT, "Status" TEXT, "District" TEXT, "Address" TEXT, "MobileNumber" TEXT, "CommittedBrand" TEXT, "FirstInstallment" REAL, "SecondInstallment" REAL, "ThirdInstallment" REAL, "Total" REAL, "CommittedPrice" REAL, "LoginDate" TEXT, "InstallationDate" TEXT, "Commission" REAL, "CommissionPaid" REAL, "BrokerName" TEXT, "BrokerNumber" TEXT, "CommissioningDate" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS installment_txns ("TxnID" TEXT PRIMARY KEY, "SlNo" INTEGER, "TxnDate" TEXT, "Amount" REAL, "Remark" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS commission_txns ("TxnID" TEXT PRIMARY KEY, "SlNo" INTEGER, "TxnDate" TEXT, "Amount" REAL, "Remark" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS installment_remarks ("RemarkID" TEXT PRIMARY KEY, "SlNo" INTEGER, "Type" TEXT, "Remark" TEXT, "CreatedAt" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS shipment_remarks ("RemarkID" TEXT PRIMARY KEY, "ShipmentNo" TEXT, "Remark" TEXT, "CreatedAt" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS products ("ProductName" TEXT PRIMARY KEY, "CreatedAt" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS product_items ("RowID" TEXT PRIMARY KEY, "ProductName" TEXT, "ItemName" TEXT, "Price" REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS shipments ("ShipmentNo" TEXT PRIMARY KEY, "PurchaseDate" TEXT, "VendorName" TEXT, "ShipmentType" TEXT, "VehicleNumber" TEXT, "InvoiceNumber" TEXT, "TransportationCost" REAL, "GSTPercentage" REAL, "VendorPaid" REAL, "TransportPaid" REAL, "Documents" TEXT, "Remarks" TEXT, "CreatedAt" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS materials ("RowID" TEXT PRIMARY KEY, "ShipmentNo" TEXT, "ItemName" TEXT, "Category" TEXT, "Quantity" REAL, "Unit" TEXT, "PurchaseRate" REAL, "TotalPurchaseValue" REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS borrowers ("BorrowerID" INTEGER PRIMARY KEY AUTOINCREMENT, "Name" TEXT NOT NULL, "Mobile" TEXT, "Address" TEXT, "Status" TEXT DEFAULT 'Active', "CreatedAt" TEXT, "CreatedBy" TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS borrower_txns ("TxnID" INTEGER PRIMARY KEY AUTOINCREMENT, "BorrowerID" INTEGER NOT NULL, "TxnDate" TEXT NOT NULL, "Amount" REAL NOT NULL, "Type" TEXT NOT NULL, "Remarks" TEXT, "CreatedAt" TEXT)`);

  // Migrate existing database to add CreatedBy column if it doesn't exist
  try {
    db.exec(`ALTER TABLE borrowers ADD COLUMN "CreatedBy" TEXT`);
  } catch (e) {
    // Ignore error if column already exists
  }

  console.log(`[SQLite Driver] Database initialized at: ${DB_PATH}`);
}

async function getStatus() {
  init();
  return { isMigrated: true };
}

async function getTable(tableName) {
  init();
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  return rows;
}

async function importTable(tableName, rows) {
  init();
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec(`DELETE FROM ${tableName}`);
    if (rows && rows.length) {
      const cols = Object.keys(rows[0]);
      const sql = `INSERT INTO ${tableName} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      const stmt = db.prepare(sql);
      for (const r of rows) {
        stmt.run(...cols.map(c => r[c]));
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

async function insertRow(tableName, row) {
  init();
  const cols = Object.keys(row);
  const sql = `INSERT OR REPLACE INTO ${tableName} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
  db.prepare(sql).run(...cols.map(c => row[c]));
}

async function updateRow(tableName, matchField, matchValue, newData) {
  init();
  const setClause = Object.keys(newData).map(col => `"${col}" = ?`).join(', ');
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE "${matchField}" = ?`;
  db.prepare(sql).run(...Object.values(newData), matchValue);
}

async function deleteRow(tableName, matchField, matchValue) {
  init();
  const sql = `DELETE FROM ${tableName} WHERE "${matchField}" = ?`;
  db.prepare(sql).run(matchValue);
}

async function replaceTable(tableName, rows) {
  return importTable(tableName, rows);
}

async function getBorrowerList(userId) {
  init();
  if (userId) {
    if (userId === 'admin') {
      return db.prepare('SELECT * FROM borrowers WHERE "CreatedBy" = ? OR "CreatedBy" IS NULL OR "CreatedBy" = \'\' ORDER BY BorrowerID ASC').all(userId);
    } else {
      return db.prepare('SELECT * FROM borrowers WHERE "CreatedBy" = ? ORDER BY BorrowerID ASC').all(userId);
    }
  }
  return db.prepare('SELECT * FROM borrowers ORDER BY BorrowerID ASC').all();
}

async function getBorrowerTxns(borrowerID) {
  init();
  return db.prepare('SELECT * FROM borrower_txns WHERE BorrowerID=? ORDER BY TxnDate ASC, TxnID ASC').all(borrowerID);
}

async function addBorrower(body) {
  init();
  const stmt = db.prepare('INSERT INTO borrowers (Name,Mobile,Address,Status,CreatedAt,CreatedBy) VALUES (?,?,?,?,?,?)');
  const info = stmt.run(body.Name, body.Mobile||'', body.Address||'', 'Active', new Date().toISOString(), body.CreatedBy || null);
  return { BorrowerID: Number(info.lastInsertRowid) };
}

async function updateBorrower(body) {
  init();
  db.prepare('UPDATE borrowers SET Name=?,Mobile=?,Address=? WHERE BorrowerID=?')
    .run(body.Name, body.Mobile||'', body.Address||'', body.BorrowerID);
}

async function closeBorrower(body) {
  init();
  db.prepare('UPDATE borrowers SET Status=? WHERE BorrowerID=?').run(body.Status, body.BorrowerID);
}

async function addBorrowerTxn(body) {
  init();
  const stmt = db.prepare('INSERT INTO borrower_txns (BorrowerID,TxnDate,Amount,Type,Remarks,CreatedAt) VALUES (?,?,?,?,?,?)');
  const info = stmt.run(body.BorrowerID, body.TxnDate, body.Amount, body.Type, body.Remarks||'', new Date().toISOString());
  return { TxnID: Number(info.lastInsertRowid) };
}

async function deleteBorrowerTxn(txnID) {
  init();
  db.prepare('DELETE FROM borrower_txns WHERE TxnID=?').run(txnID);
}

async function deleteBorrower(borrowerID) {
  init();
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM borrower_txns WHERE BorrowerID = ?').run(borrowerID);
    db.prepare('DELETE FROM borrowers WHERE BorrowerID = ?').run(borrowerID);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  driverName: 'SQLite',
  init,
  getStatus,
  getTable,
  importTable,
  insertRow,
  updateRow,
  deleteRow,
  replaceTable,
  getBorrowerList,
  getBorrowerTxns,
  addBorrower,
  updateBorrower,
  closeBorrower,
  addBorrowerTxn,
  deleteBorrowerTxn,
  deleteBorrower,
};
