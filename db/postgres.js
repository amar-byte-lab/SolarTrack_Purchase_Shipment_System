const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Determine execution environment (Local vs Production)
const envPath = path.join(__dirname, '../.env');
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (isProduction) {
  console.log('🌐 [Config] Production Environment detected: Using hosting server Environment Variables.');
} else {
  console.log('💻 [Config] Local Environment detected: Loaded variables from local .env file.');
}

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ [Postgres Warning] SUPABASE_URL or SUPABASE_SECRET_KEY is missing in environment variables!');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

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
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`[Postgres] getTable('${tableName}') error:`, error.message);
      return [];
    }
    if (data && Array.isArray(data)) {
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
        return normalized;
      });
    }
    return data || [];
  } catch (err) {
    console.error(`[Postgres] getTable('${tableName}') exception:`, err.message);
    return [];
  }
}

async function safeUpsert(tableName, row) {
  let item = { ...row };
  if (tableName === 'work_notes') {
    item = {
      NoteID: row.NoteID || row.noteid,
      NoteTitle: row.NoteTitle || row.notetitle,
      CommonNote: row.CommonNote || row.commonnote,
      SelectedBadges: row.SelectedBadges || row.selectedbadges,
      CustomerData: row.CustomerData || row.customerdata,
      CreatedAt: row.CreatedAt || row.createdat,
      UpdatedAt: row.UpdatedAt || row.updatedat,
    };
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const { error } = await supabase.from(tableName).upsert([item]);
      if (!error) return;

      const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && item.hasOwnProperty(match[1])) {
        delete item[match[1]];
        continue;
      }
      console.error(`[Postgres] safeUpsert('${tableName}') error:`, error.message);
      return;
    } catch (err) {
      console.error(`[Postgres] safeUpsert('${tableName}') exception:`, err.message);
      return;
    }
  }
}

async function safeUpdate(tableName, matchField, val, newData) {
  let item = { ...newData };
  let field = matchField;
  if (tableName === 'work_notes') {
    if (field && field.toLowerCase() === 'noteid') field = 'NoteID';
    item = {
      NoteID: newData.NoteID || newData.noteid || val,
      NoteTitle: newData.NoteTitle || newData.notetitle,
      CommonNote: newData.CommonNote || newData.commonnote,
      SelectedBadges: newData.SelectedBadges || newData.selectedbadges,
      CustomerData: newData.CustomerData || newData.customerdata,
      CreatedAt: newData.CreatedAt || newData.createdat,
      UpdatedAt: newData.UpdatedAt || newData.updatedat,
    };
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const { error } = await supabase.from(tableName).update(item).eq(field, val);
      if (!error) return;

      const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && item.hasOwnProperty(match[1])) {
        delete item[match[1]];
        continue;
      }
      console.error(`[Postgres] safeUpdate('${tableName}') error:`, error.message);
      return;
    } catch (err) {
      console.error(`[Postgres] safeUpdate('${tableName}') exception:`, err.message);
      return;
    }
  }
}

async function importTable(tableName, rows) {
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
  try {
    let field = matchField;
    if (tableName === 'work_notes' && field && field.toLowerCase() === 'noteid') {
      field = 'NoteID';
    }
    const isInt = ['SlNo', 'BorrowerID', 'id'].includes(field);
    const val = isInt ? (parseInt(matchValue, 10) || matchValue) : matchValue;
    const { error } = await supabase.from(tableName).delete().eq(field, val);
    if (error) console.warn(`[Postgres] deleteRow('${tableName}') warning:`, error.message);
  } catch (err) {
    console.warn(`[Postgres] deleteRow('${tableName}') exception:`, err.message);
  }
}

async function replaceTable(tableName, rows) {
  await importTable(tableName, rows);
}

async function getBorrowerList(userId) {
  try {
    const uid = (userId || '').trim().toLowerCase();
    const { data, error } = await supabase.from('borrowers').select('*');
    if (error) {
      console.error('[Postgres] getBorrowerList error:', error.message);
      return [];
    }
    if (!data || !Array.isArray(data)) return [];

    if (!uid) return data;

    // Return user-specific borrowers (or legacy rows with no CreatedBy)
    return data.filter(b => {
      const creator = (b.CreatedBy || b.createdby || '').trim().toLowerCase();
      return !creator || creator === uid;
    });
  } catch (err) {
    console.error('[Postgres] getBorrowerList exception:', err.message);
    return [];
  }
}

async function getBorrowerTxns(borrowerID) {
  try {
    const id = parseInt(borrowerID, 10) || borrowerID;
    const { data, error } = await supabase.from('borrower_txns').select('*').eq('BorrowerID', id);
    if (error) {
      console.error('[Postgres] getBorrowerTxns error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Postgres] getBorrowerTxns exception:', err.message);
    return [];
  }
}

async function addBorrower(body) {
  try {
    const item = {
      Name: body.Name,
      Mobile: body.Mobile || '',
      Address: body.Address || '',
      Status: body.Status || 'Active',
      CreatedAt: new Date().toISOString(),
      CreatedBy: (body.CreatedBy || '').trim()
    };
    const { data, error } = await supabase.from('borrowers').insert([item]).select();
    if (error) {
      console.error('[Postgres] addBorrower error:', error.message);
      return { success: false, error: error.message };
    }
    if (data && data[0]) {
      return { success: true, BorrowerID: data[0].BorrowerID, ...data[0] };
    }
    return { success: true };
  } catch (err) {
    console.error('[Postgres] addBorrower exception:', err.message);
    return { success: false, error: err.message };
  }
}

async function updateBorrower(body) {
  try {
    await safeUpdate('borrowers', 'BorrowerID', body.BorrowerID, body);
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function closeBorrower(body) {
  try {
    const status = body.Status || 'Closed';
    await safeUpdate('borrowers', 'BorrowerID', body.BorrowerID, { Status: status });
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function addBorrowerTxn(body) {
  try {
    const item = {
      BorrowerID: parseInt(body.BorrowerID, 10) || body.BorrowerID,
      TxnDate: body.TxnDate,
      Amount: parseFloat(body.Amount) || 0,
      Type: body.Type,
      Remarks: body.Remarks || '',
      CreatedAt: new Date().toISOString()
    };
    const { data, error } = await supabase.from('borrower_txns').insert([item]).select();
    if (error) {
      console.error('[Postgres] addBorrowerTxn error:', error.message);
      return { success: false, error: error.message };
    }
    if (data && data[0]) {
      return { success: true, TxnID: data[0].TxnID, ...data[0] };
    }
    return { success: true };
  } catch (err) {
    console.error('[Postgres] addBorrowerTxn exception:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteBorrowerTxn(txnID) {
  try {
    const id = parseInt(txnID, 10) || txnID;
    const { error } = await supabase.from('borrower_txns').delete().eq('TxnID', id);
    if (error) {
      console.error('[Postgres] deleteBorrowerTxn error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[Postgres] deleteBorrowerTxn exception:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteBorrower(borrowerID) {
  try {
    const id = parseInt(borrowerID, 10) || borrowerID;
    await supabase.from('borrower_txns').delete().eq('BorrowerID', id);
    const { error } = await supabase.from('borrowers').delete().eq('BorrowerID', id);
    if (error) {
      console.error('[Postgres] deleteBorrower error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[Postgres] deleteBorrower exception:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
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
