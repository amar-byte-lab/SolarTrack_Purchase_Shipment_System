require('dotenv').config();

const dbType = (process.env.DB_TYPE || 'postgresql').trim().toLowerCase();

let activeDriver;
if (dbType === 'sqlite') {
  activeDriver = require('./sqlite');
} else {
  activeDriver = require('./postgres');
}

module.exports = {
  dbType,
  driverName: activeDriver.driverName,
  getStatus: (...args) => activeDriver.getStatus(...args),
  getTable: (...args) => activeDriver.getTable(...args),
  importTable: (...args) => activeDriver.importTable(...args),
  insertRow: (...args) => activeDriver.insertRow(...args),
  updateRow: (...args) => activeDriver.updateRow(...args),
  deleteRow: (...args) => activeDriver.deleteRow(...args),
  replaceTable: (...args) => activeDriver.replaceTable(...args),
  getBorrowerList: (...args) => activeDriver.getBorrowerList(...args),
  getBorrowerTxns: (...args) => activeDriver.getBorrowerTxns(...args),
  addBorrower: (...args) => activeDriver.addBorrower(...args),
  updateBorrower: (...args) => activeDriver.updateBorrower(...args),
  closeBorrower: (...args) => activeDriver.closeBorrower(...args),
  addBorrowerTxn: (...args) => activeDriver.addBorrowerTxn(...args),
  deleteBorrowerTxn: (...args) => activeDriver.deleteBorrowerTxn(...args),
};
