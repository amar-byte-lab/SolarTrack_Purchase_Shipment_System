const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const WORK_NOTES_FILE = path.join(__dirname, '..', 'data', 'work_notes.json');

function ensureDataDir() {
  const dir = path.dirname(WORK_NOTES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalWorkNotes() {
  try {
    ensureDataDir();
    if (fs.existsSync(WORK_NOTES_FILE)) {
      const content = fs.readFileSync(WORK_NOTES_FILE, 'utf8');
      return JSON.parse(content || '[]');
    }
  } catch (e) {
    console.warn('[LocalWorkNotes] Read error:', e.message);
  }
  return [];
}

function saveLocalWorkNotes(notes) {
  try {
    ensureDataDir();
    fs.writeFileSync(WORK_NOTES_FILE, JSON.stringify(notes, null, 2), 'utf8');
  } catch (e) {
    console.warn('[LocalWorkNotes] Write error:', e.message);
  }
}

const PRIMARY_KEYS = {
  shipments:           'ShipmentNo',
  materials:           'RowID',
  vendors:             'VendorName',
  items:               'ItemName',
  settings:            'Key',
  installments:        'SlNo',
  borrowers:           'BorrowerID',
  borrower_txns:       'TxnID',
  installment_txns:    'TxnID',
  commission_txns:     'TxnID',
  installment_remarks: 'RemarkID',
  shipment_remarks:    'RemarkID',
  products:            'ProductName',
  product_items:       'RowID',
  users:               'userid',
  roles:               'role',
  notifications:       'id',
  work_notes:          'NoteID',
};

async function getStatus() {
  return { isMigrated: true };
}

async function getTable(tableName) {
  if (tableName === 'work_notes') {
    let localNotes = readLocalWorkNotes();
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (!error && Array.isArray(data)) {
        const map = new Map();
        localNotes.forEach(n => map.set(n.NoteID, n));
        data.forEach(n => map.set(n.NoteID, n));
        const merged = Array.from(map.values());
        if (merged.length > localNotes.length) {
          saveLocalWorkNotes(merged);
        }
        return merged;
      }
    } catch (err) {
      console.warn(`[Postgres] getTable('${tableName}') exception:`, err.message);
    }
    return localNotes;
  }

  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.warn(`[Postgres] getTable('${tableName}') error:`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[Postgres] getTable('${tableName}') exception:`, err.message);
    return [];
  }
}

async function safeUpsert(tableName, row) {
  if (tableName === 'work_notes') {
    let localNotes = readLocalWorkNotes();
    const idx = localNotes.findIndex(n => n.NoteID === row.NoteID);
    if (idx > -1) {
      localNotes[idx] = { ...localNotes[idx], ...row };
    } else {
      localNotes.push(row);
    }
    saveLocalWorkNotes(localNotes);
  }

  let item = { ...row };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { error } = await supabase.from(tableName).upsert([item]);
      if (!error) return;

      const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && item.hasOwnProperty(match[1])) {
        delete item[match[1]];
        continue;
      }
      return;
    } catch (err) {
      return;
    }
  }
}

async function safeUpdate(tableName, matchField, val, newData) {
  if (tableName === 'work_notes') {
    let localNotes = readLocalWorkNotes();
    const idx = localNotes.findIndex(n => n[matchField] == val);
    if (idx > -1) {
      localNotes[idx] = { ...localNotes[idx], ...newData };
      saveLocalWorkNotes(localNotes);
    }
  }

  let item = { ...newData };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { error } = await supabase.from(tableName).update(item).eq(matchField, val);
      if (!error) return;

      const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && item.hasOwnProperty(match[1])) {
        delete item[match[1]];
        continue;
      }
      return;
    } catch (err) {
      return;
    }
  }
}

async function importTable(tableName, rows) {
  if (tableName === 'work_notes') {
    saveLocalWorkNotes(rows || []);
  }
  try {
    const pk = PRIMARY_KEYS[tableName] || 'id';
    const isInt = ['SlNo', 'BorrowerID', 'id'].includes(pk);
    if (isInt) {
      await supabase.from(tableName).delete().neq(pk, -999999);
    } else {
      await supabase.from(tableName).delete().neq(pk, '___DUMMY_DELETE_ALL___');
    }
    if (rows && rows.length > 0) {
      const { error } = await supabase.from(tableName).upsert(rows);
      if (error) {
        for (const r of rows) {
          await safeUpsert(tableName, r);
        }
      }
    }
  } catch (err) {
    console.warn(`[Postgres] importTable('${tableName}') exception:`, err.message);
  }
}

async function insertRow(tableName, row) {
  await safeUpsert(tableName, row);
}

async function updateRow(tableName, matchField, matchValue, newData) {
  const isInt = ['SlNo', 'BorrowerID', 'id'].includes(matchField);
  const val = isInt ? (parseInt(matchValue, 10) || matchValue) : matchValue;
  await safeUpdate(tableName, matchField, val, newData);
}

async function deleteRow(tableName, matchField, matchValue) {
  if (tableName === 'work_notes') {
    let localNotes = readLocalWorkNotes();
    localNotes = localNotes.filter(n => n[matchField] != matchValue);
    saveLocalWorkNotes(localNotes);
  }
  try {
    const isInt = ['SlNo', 'BorrowerID', 'id'].includes(matchField);
    const val = isInt ? (parseInt(matchValue, 10) || matchValue) : matchValue;
    await supabase.from(tableName).delete().eq(matchField, val);
  } catch (err) {}
}

async function replaceTable(tableName, rows) {
  await importTable(tableName, rows);
}

module.exports = {
  getStatus,
  getTable,
  importTable,
  insertRow,
  updateRow,
  deleteRow,
  replaceTable,
};
