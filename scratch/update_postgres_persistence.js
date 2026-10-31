const fs = require('fs');
const path = 'c:/Users/AMAR CHAND MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/db/postgres.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add fs, path and readLocalTable/writeLocalTable at top
const topMarker = "const dns = require('dns');";
const topCode = `const dns = require('dns');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

function readLocalTable(tableName) {
  const filePath = path.join(DATA_DIR, \`\${tableName}.json\`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function writeLocalTable(tableName, rows) {
  const filePath = path.join(DATA_DIR, \`\${tableName}.json\`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
  } catch (e) {
    console.error(\`[FileDB] Failed to save \${tableName}.json:\`, e.message);
  }
}
`;

content = content.replace(topMarker, topCode);

// 2. Update getTable to fallback to local files
const oldGetTableStart = 'async function getTable(tableName) {';
const oldGetTableEnd = 'async function safeUpsert(tableName, row) {';

const idxGetStart = content.indexOf(oldGetTableStart);
const idxGetEnd = content.indexOf(oldGetTableEnd);

if (idxGetStart === -1 || idxGetEnd === -1) {
  console.error('getTable markers not found!');
  process.exit(1);
}

const newGetTable = `async function getTable(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      if (error.message && error.message.includes('Could not find the table')) {
        return readLocalTable(tableName);
      }
      console.error(\`[Postgres] getTable('\${tableName}') error:\`, error.message);
      const local = readLocalTable(tableName);
      if (local && local.length > 0) return local;
      return [];
    }
    if (data && Array.isArray(data)) {
      if (['inventory_items', 'inventory_inwards', 'inventory_dispatches'].includes(tableName)) {
        writeLocalTable(tableName, data);
      }
      return data.map(row => {
        const normalized = { ...row };
        Object.keys(row).forEach(k => {
          const lower = k.toLowerCase();
          if (lower === 'noteid') normalized.NoteID = row[k];
          if (lower === 'notetitle') normalized.NoteTitle = row[k];
          if (lower === 'commonnote') normalized.CommonNote = row[k];
          if (lower === 'selectedbadges') normalized.SelectedBadges = row[k];
          if (lower === 'customerdata') normalized.CustomerData = row[k];
          if (lower === 'createdat') normalized.CreatedAt = row[k];
          if (lower === 'updatedat') normalized.UpdatedAt = row[k];
        });
        if (tableName === 'installments' && normalized.BrokerNumber && normalized.BrokerNumber.includes('|work:')) {
          try {
            const { workObj } = parseBrokerNumber(normalized.BrokerNumber);
            Object.assign(normalized, workObj);
          } catch (e) {
            console.error('[Postgres] Error parsing work metadata:', e);
          }
        }
        return normalized;
      });
    }
    return data || [];
  } catch (err) {
    console.error(\`[Postgres] getTable('\${tableName}') exception:\`, err.message);
    return readLocalTable(tableName);
  }
}

`;

content = content.slice(0, idxGetStart) + newGetTable + content.slice(idxGetEnd);

// 3. Update safeUpsert to fallback to local file on missing table
const upsertAttemptErr = "      console.error(`[Postgres] safeUpsert('${tableName}') error:`, error.message);\n      throw new Error(`[Postgres] safeUpsert('${tableName}') failed: ${error.message}`);";
const upsertAttemptErrCRLF = "      console.error(`[Postgres] safeUpsert('${tableName}') error:`, error.message);\r\n      throw new Error(`[Postgres] safeUpsert('${tableName}') failed: ${error.message}`);";

const upsertReplacement = `      if (error && error.message && error.message.includes('Could not find the table')) {
        const pk = PRIMARY_KEYS[tableName] || 'id';
        const rows = readLocalTable(tableName);
        const pkVal = item[pk] !== undefined ? item[pk] : item[pk.toLowerCase()];
        const idx = rows.findIndex(r => String(r[pk] !== undefined ? r[pk] : r[pk.toLowerCase()]) === String(pkVal));
        if (idx >= 0) rows[idx] = { ...rows[idx], ...item };
        else rows.push(item);
        writeLocalTable(tableName, rows);
        return;
      }
      console.error(\`[Postgres] safeUpsert('\${tableName}') error:\`, error.message);
      throw new Error(\`[Postgres] safeUpsert('\${tableName}') failed: \${error.message}\`);`;

if (content.includes(upsertAttemptErrCRLF)) {
  content = content.replace(upsertAttemptErrCRLF, upsertReplacement);
} else if (content.includes(upsertAttemptErr)) {
  content = content.replace(upsertAttemptErr, upsertReplacement);
}

// 4. Update insertRows, updateRow, deleteRow to also sync local tables
const oldInsertRows = 'async function insertRows(tableName, rows) {';
const newInsertRows = `async function insertRows(tableName, rows) {
  if (!rows || !rows.length) return;
  try {
    const { error } = await supabase.from(tableName).upsert(rows);
    if (error) {
      if (error.message && error.message.includes('Could not find the table')) {
        const pk = PRIMARY_KEYS[tableName] || 'id';
        const localRows = readLocalTable(tableName);
        rows.forEach(item => {
          const pkVal = item[pk] !== undefined ? item[pk] : item[pk.toLowerCase()];
          const idx = localRows.findIndex(r => String(r[pk] !== undefined ? r[pk] : r[pk.toLowerCase()]) === String(pkVal));
          if (idx >= 0) localRows[idx] = { ...localRows[idx], ...item };
          else localRows.push(item);
        });
        writeLocalTable(tableName, localRows);
        return;
      }
      for (const r of rows) {
        await safeUpsert(tableName, r);
      }
    }
  } catch (err) {
    console.warn(\`[Postgres] insertRows('\${tableName}') exception:\`, err.message);
    const pk = PRIMARY_KEYS[tableName] || 'id';
    const localRows = readLocalTable(tableName);
    rows.forEach(item => {
      const pkVal = item[pk] !== undefined ? item[pk] : item[pk.toLowerCase()];
      const idx = localRows.findIndex(r => String(r[pk] !== undefined ? r[pk] : r[pk.toLowerCase()]) === String(pkVal));
      if (idx >= 0) localRows[idx] = { ...localRows[idx], ...item };
      else localRows.push(item);
    });
    writeLocalTable(tableName, localRows);
  }
}
`;

const idxInsertRows = content.indexOf(oldInsertRows);
if (idxInsertRows !== -1) {
  const nextFn = 'async function deleteRows(tableName, matchField, matchValues) {';
  const idxNext = content.indexOf(nextFn, idxInsertRows);
  if (idxNext !== -1) {
    content = content.slice(0, idxInsertRows) + newInsertRows + '\n' + content.slice(idxNext);
  }
}

// 5. Update deleteRow & deleteRows
const oldDeleteRow = `async function deleteRow(tableName, matchField, matchValue) {
  try {
    let field = matchField;
    if (tableName === 'work_notes' && field && field.toLowerCase() === 'noteid') {
      field = 'NoteID';
    }
    const isInt = ['SlNo', 'BorrowerID', 'id'].includes(field);
    const val = isInt ? (parseInt(matchValue, 10) || matchValue) : matchValue;
    const { error } = await supabase.from(tableName).delete().eq(field, val);
    if (error) console.warn(\`[Postgres] deleteRow('\${tableName}') warning:\`, error.message);
  } catch (err) {
    console.warn(\`[Postgres] deleteRow('\${tableName}') exception:\`, err.message);
  }
}`;

const newDeleteRow = `async function deleteRow(tableName, matchField, matchValue) {
  try {
    let field = matchField;
    if (tableName === 'work_notes' && field && field.toLowerCase() === 'noteid') {
      field = 'NoteID';
    }
    const isInt = ['SlNo', 'BorrowerID', 'id'].includes(field);
    const val = isInt ? (parseInt(matchValue, 10) || matchValue) : matchValue;
    const { error } = await supabase.from(tableName).delete().eq(field, val);
    if (error) console.warn(\`[Postgres] deleteRow('\${tableName}') warning:\`, error.message);
  } catch (err) {
    console.warn(\`[Postgres] deleteRow('\${tableName}') exception:\`, err.message);
  }
  try {
    const localRows = readLocalTable(tableName);
    const filtered = localRows.filter(r => String(r[matchField] !== undefined ? r[matchField] : r[matchField.toLowerCase()]) !== String(matchValue));
    if (filtered.length !== localRows.length) {
      writeLocalTable(tableName, filtered);
    }
  } catch (e) {}
}`;

content = content.replace(oldDeleteRow.replace(/\r\n/g, '\n'), newDeleteRow);
content = content.replace(oldDeleteRow.replace(/\n/g, '\r\n'), newDeleteRow.replace(/\n/g, '\r\n'));

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated db/postgres.js with local persistence fallback!');
