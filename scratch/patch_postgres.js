const fs = require('fs');
let code = fs.readFileSync('db/postgres.js', 'utf8');

const oldFunc = `function parseBrokerNumber(brokerStr) {
  if (!brokerStr || typeof brokerStr !== 'string') {
    return { basePhone: '', expensesJson: '', creatorId: '', workObj: {} };
  }
  let workObj = {};
  let rest = brokerStr;
  const workIdx = brokerStr.indexOf('|work:');
  if (workIdx !== -1) {
    const workStr = brokerStr.slice(workIdx + 6);
    rest = brokerStr.slice(0, workIdx);
    try {
      workObj = JSON.parse(workStr) || {};
    } catch (e) {
      console.warn('[Postgres] Error parsing |work: JSON:', e.message);
    }
  }
  let creatorId = '';
  const creatorIdx = rest.indexOf('|creator:');
  if (creatorIdx !== -1) {
    creatorId = rest.slice(creatorIdx + 9).split('|')[0];
    rest = rest.slice(0, creatorIdx);
  }
  let expensesJson = '';
  const expensesIdx = rest.indexOf('|expenses:');
  if (expensesIdx !== -1) {
    expensesJson = rest.slice(expensesIdx + 10).split('|')[0];
    rest = rest.slice(0, expensesIdx);
  }
  const basePhone = rest.split('|')[0] || '';
  return { basePhone, expensesJson, creatorId, workObj };
}`;

const newFunc = `function parseBrokerNumber(brokerStr) {
  if (!brokerStr || typeof brokerStr !== 'string') {
    return { basePhone: '', expensesJson: '', creatorId: '', workObj: {} };
  }
  let workObj = {};
  let rest = brokerStr;
  const workIdx = brokerStr.indexOf('|work:');
  if (workIdx !== -1) {
    const workStr = brokerStr.slice(workIdx + 6);
    rest = brokerStr.slice(0, workIdx);
    try {
      workObj = JSON.parse(workStr) || {};
    } catch (e) {
      console.warn('[Postgres] Error parsing |work: JSON:', e.message);
    }
  }

  let creatorId = '';
  const creatorIdx = rest.indexOf('|creator:');
  if (creatorIdx !== -1) {
    const afterCreator = rest.slice(creatorIdx + 9);
    const nextPipe = afterCreator.indexOf('|');
    creatorId = nextPipe !== -1 ? afterCreator.slice(0, nextPipe) : afterCreator;
    rest = rest.slice(0, creatorIdx) + (nextPipe !== -1 ? afterCreator.slice(nextPipe) : '');
  }

  let expensesJson = '';
  const expensesIdx = rest.indexOf('|expenses:');
  if (expensesIdx !== -1) {
    const afterExpenses = rest.slice(expensesIdx + 10);
    const nextPipe = afterExpenses.indexOf('|');
    expensesJson = nextPipe !== -1 ? afterExpenses.slice(0, nextPipe) : afterExpenses;
    rest = rest.slice(0, expensesIdx) + (nextPipe !== -1 ? afterExpenses.slice(nextPipe) : '');
  }

  const basePhone = rest.split('|')[0] || '';
  return { basePhone, expensesJson, creatorId, workObj };
}`;

const isCrlf = code.includes('\r\n');
const target = isCrlf ? oldFunc.replace(/\r?\n/g, '\r\n') : oldFunc.replace(/\r\n/g, '\n');
const replacement = isCrlf ? newFunc.replace(/\r?\n/g, '\r\n') : newFunc.replace(/\r\n/g, '\n');

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('db/postgres.js', code, 'utf8');
  console.log('Successfully patched db/postgres.js');
} else {
  console.log('Target function not found for replacement');
}
