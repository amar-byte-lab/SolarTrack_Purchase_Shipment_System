/**
 * tests/helpers/contract-helpers.js
 * BrokerNumber metadata parser & serializer contracts.
 * Matches logic used in customer.js, manage-work.js, and db/postgres.js.
 */

function parseBrokerNumber(brokerStr) {
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
      console.warn('[Helper] Error parsing |work: JSON:', e.message);
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
}

function formatBrokerNumber(basePhone, expensesJson, creatorId, workObj) {
  let res = basePhone || '';
  if (expensesJson) res += '|expenses:' + expensesJson;
  if (creatorId) res += '|creator:' + creatorId;
  if (workObj && Object.keys(workObj).length > 0) res += '|work:' + JSON.stringify(workObj);
  return res;
}

function formatBrokerNumberWithWorkMeta(existingBrokerNumber, workUpdates) {
  const { basePhone, expensesJson: expRaw, creatorId, workObj } = parseBrokerNumber(existingBrokerNumber);
  let expensesJson = expRaw;

  Object.assign(workObj, workUpdates);

  if (expensesJson && (workUpdates.NetMeterPayment !== undefined || workUpdates.NetMeterPaid !== undefined)) {
    try {
      const exp = JSON.parse(expensesJson);
      if (workUpdates.NetMeterPayment !== undefined) {
        exp.net_meter_payment = workUpdates.NetMeterPayment;
      }
      if (workUpdates.NetMeterPaid !== undefined) {
        exp.net_meter_paid = workUpdates.NetMeterPaid;
      }
      expensesJson = JSON.stringify(exp);
    } catch (e) {}
  }

  return formatBrokerNumber(basePhone, expensesJson, creatorId, workObj);
}

module.exports = {
  parseBrokerNumber,
  formatBrokerNumber,
  formatBrokerNumberWithWorkMeta
};
