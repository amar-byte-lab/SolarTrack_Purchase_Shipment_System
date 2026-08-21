const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';


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
};

async function getStatus() {
  return { isMigrated: true };
}

async function getTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) throw error;
  return data || [];
}

async function safeUpsert(tableName, row) {
  let item = { ...row };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from(tableName).upsert([item]);
    if (!error) return;

    const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && item.hasOwnProperty(match[1])) {
      console.warn(`\n⚠️ [PostgreSQL MIGRATION REQUIRED] Column '${match[1]}' does not exist in table '${tableName}'.`);
      console.warn(`Please run: ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${match[1]}" NUMERIC;\n`);
      delete item[match[1]];
      continue;
    }
    throw error;
  }
}

async function safeUpdate(tableName, matchField, val, newData) {
  let item = { ...newData };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from(tableName).update(item).eq(matchField, val);
    if (!error) return;

    const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && item.hasOwnProperty(match[1])) {
      console.warn(`\n⚠️ [PostgreSQL MIGRATION REQUIRED] Column '${match[1]}' does not exist in table '${tableName}'.`);
      console.warn(`Please run: ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${match[1]}" NUMERIC;\n`);
      delete item[match[1]];
      continue;
    }
    throw error;
  }
}

async function importTable(tableName, rows) {
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
}

async function insertRow(tableName, row) {
  await safeUpsert(tableName, row);
}

async function updateRow(tableName, matchField, matchValue, newData) {
  const isInt = ['SlNo', 'BorrowerID', 'id'].includes(matchField);
  const val = isInt ? Number(matchValue) : matchValue;
  await safeUpdate(tableName, matchField, val, newData);
}

async function deleteRow(tableName, matchField, matchValue) {
  const isInt = ['SlNo', 'BorrowerID', 'id'].includes(matchField);
  const val = isInt ? Number(matchValue) : matchValue;
  const { error } = await supabase.from(tableName).delete().eq(matchField, val);
  if (error) throw error;
}

async function replaceTable(tableName, rows) {
  return importTable(tableName, rows);
}

async function getBorrowerList(userId) {
  let query = supabase.from('borrowers').select('*');
  if (userId) {
    if (userId === 'admin') {
      query = query.or(`CreatedBy.eq.${userId},CreatedBy.is.null`);
    } else {
      query = query.eq('CreatedBy', userId);
    }
  }
  const { data, error } = await query.order('BorrowerID', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getBorrowerTxns(borrowerID) {
  const { data, error } = await supabase
    .from('borrower_txns')
    .select('*')
    .eq('BorrowerID', borrowerID)
    .order('TxnDate', { ascending: true })
    .order('TxnID', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function addBorrower(body) {
  const { data, error } = await supabase
    .from('borrowers')
    .insert([{
      Name: body.Name,
      Mobile: body.Mobile || '',
      Address: body.Address || '',
      Status: 'Active',
      CreatedBy: body.CreatedBy || null,
      CreatedAt: new Date().toISOString()
    }])
    .select();
  if (error) throw error;
  return { BorrowerID: data[0].BorrowerID };
}

async function updateBorrower(body) {
  const { error } = await supabase
    .from('borrowers')
    .update({
      Name: body.Name,
      Mobile: body.Mobile || '',
      Address: body.Address || ''
    })
    .eq('BorrowerID', body.BorrowerID);
  if (error) throw error;
}

async function closeBorrower(body) {
  const { error } = await supabase
    .from('borrowers')
    .update({ Status: body.Status })
    .eq('BorrowerID', body.BorrowerID);
  if (error) throw error;
}

async function addBorrowerTxn(body) {
  const { data, error } = await supabase
    .from('borrower_txns')
    .insert([{
      BorrowerID: body.BorrowerID,
      TxnDate: body.TxnDate,
      Amount: body.Amount,
      Type: body.Type,
      Remarks: body.Remarks || '',
      CreatedAt: new Date().toISOString()
    }])
    .select();
  if (error) throw error;
  return { TxnID: data[0].TxnID };
}

async function deleteBorrowerTxn(txnID) {
  const { error } = await supabase
    .from('borrower_txns')
    .delete()
    .eq('TxnID', txnID);
  if (error) throw error;
}

async function deleteBorrower(borrowerID) {
  const bid = Number(borrowerID);
  const { error: txnErr } = await supabase
    .from('borrower_txns')
    .delete()
    .eq('BorrowerID', bid);
  if (txnErr) throw txnErr;

  const { error: bErr } = await supabase
    .from('borrowers')
    .delete()
    .eq('BorrowerID', bid);
  if (bErr) throw bErr;
}

module.exports = {
  dbType: 'postgresql',
  driverName: 'PostgreSQL (Supabase)',
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
