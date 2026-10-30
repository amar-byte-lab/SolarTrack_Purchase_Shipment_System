const fs = require('fs');
let code = fs.readFileSync('db/postgres.js', 'utf8');

const oldBlock = `  if (tableName === 'installments') {
    const { basePhone, expensesJson, creatorId, workObj } = parseBrokerNumber(item.BrokerNumber);
    for (const k of Object.keys(item)) {
      if (!VALID_INSTALLMENT_COLS.has(k)) {
        if (item[k] !== undefined) {
          workObj[k] = item[k];
        }
        delete item[k];
      }
    }
    item.BrokerNumber = formatBrokerNumber(basePhone, expensesJson, creatorId, workObj);
  }`;

const newBlock = `  if (tableName === 'installments') {
    const hasNonValidCols = Object.keys(item).some(k => !VALID_INSTALLMENT_COLS.has(k));
    const hasBrokerNumber = Object.prototype.hasOwnProperty.call(item, 'BrokerNumber');

    if (hasBrokerNumber || hasNonValidCols) {
      let currentBrokerNumber = item.BrokerNumber;
      if (!hasBrokerNumber) {
        try {
          const matchVal = (field === 'SlNo' || field === 'id' || field === 'BorrowerID') && !isNaN(val) ? Number(val) : val;
          const { data: existingRows } = await supabase.from('installments').select('BrokerNumber').eq(field, matchVal).limit(1);
          if (existingRows && existingRows[0]) {
            currentBrokerNumber = existingRows[0].BrokerNumber || '';
          }
        } catch (e) {
          console.warn('[Postgres] Error fetching current BrokerNumber for merge:', e.message);
        }
      }

      const { basePhone, expensesJson, creatorId, workObj } = parseBrokerNumber(currentBrokerNumber || '');
      for (const k of Object.keys(item)) {
        if (!VALID_INSTALLMENT_COLS.has(k)) {
          if (item[k] !== undefined) {
            if (item[k] === '' || item[k] === null) {
              delete workObj[k];
            } else {
              workObj[k] = item[k];
            }
          }
          delete item[k];
        }
      }
      item.BrokerNumber = formatBrokerNumber(basePhone, expensesJson, creatorId, workObj);
    }
  }`;

const isCrlf = code.includes('\r\n');
const target = isCrlf ? oldBlock.replace(/\r?\n/g, '\r\n') : oldBlock.replace(/\r\n/g, '\n');
const replacement = isCrlf ? newBlock.replace(/\r?\n/g, '\r\n') : newBlock.replace(/\r\n/g, '\n');

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('db/postgres.js', code, 'utf8');
  console.log('Successfully patched safeUpdate in db/postgres.js');
} else {
  console.log('Target block not found in db/postgres.js');
}
