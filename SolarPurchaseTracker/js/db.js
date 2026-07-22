/* =========================================================================
   db.js — Client-side SQLite & persistent cache API wrapper
   ========================================================================= */

const DB = (() => {

  const FILE_MAP = {
    shipments:     { file: 'Shipments.xlsx',    sheet: 'Shipments' },
    materials:     { file: 'Materials.xlsx',    sheet: 'Materials' },
    vendors:       { file: 'Vendors.xlsx',      sheet: 'Vendors' },
    items:         { file: 'Items.xlsx',        sheet: 'Items' },
    settings:      { file: 'Settings.xlsx',     sheet: 'Settings' },
    installments:  { file: 'Installments.xlsx', sheet: 'Installments' },
    borrowers:        { file: null, sheet: null },
    borrower_txns:    { file: null, sheet: null },
    installment_txns: { file: null, sheet: null },
    commission_txns:  { file: null, sheet: null },
    installment_remarks: { file: null, sheet: null },
    shipment_remarks: { file: null, sheet: null },
    products: { file: null, sheet: null },
    product_items: { file: null, sheet: null },
  };

  const HEADERS = {
    shipments:        ['ShipmentNo', 'PurchaseDate', 'VendorName', 'ShipmentType', 'VehicleNumber', 'InvoiceNumber', 'TransportationCost', 'GSTPercentage', 'VendorPaid', 'TransportPaid', 'Documents', 'Remarks', 'CreatedAt'],
    materials:        ['RowID', 'ShipmentNo', 'ItemName', 'Category', 'Quantity', 'Unit', 'PurchaseRate', 'TotalPurchaseValue'],
    vendors:          ['VendorName', 'Address', 'Phone', 'GSTIN', 'Email', 'Remarks'],
    items:            ['ItemName', 'Category', 'Unit', 'HSNCode', 'GSTPercent', 'Status'],
    settings:         ['Key', 'Value'],
    installments:     ['SlNo', 'Name', 'Status', 'District', 'Address', 'MobileNumber', 'CommittedBrand', 'FirstInstallment', 'SecondInstallment', 'ThirdInstallment', 'Total', 'CommittedPrice', 'LoginDate', 'InstallationDate', 'Commission', 'CommissionPaid', 'BrokerName', 'BrokerNumber', 'CommissioningDate'],
    borrowers:        ['BorrowerID', 'Name', 'Mobile', 'Address', 'Status', 'CreatedAt'],
    borrower_txns:    ['TxnID', 'BorrowerID', 'TxnDate', 'Amount', 'Type', 'Remarks', 'CreatedAt'],
    installment_txns: ['TxnID', 'SlNo', 'TxnDate', 'Amount', 'Remark'],
    commission_txns:  ['TxnID', 'SlNo', 'TxnDate', 'Amount', 'Remark'],
    installment_remarks: ['RemarkID', 'SlNo', 'Type', 'Remark', 'CreatedAt'],
    shipment_remarks: ['RemarkID', 'ShipmentNo', 'Remark', 'CreatedAt'],
    products: ['ProductName', 'CreatedAt'],
    product_items: ['RowID', 'ProductName', 'ItemName', 'Price'],
  };

  let mode = 'sqlite';
  let cache = {};

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('SolarTrackerDB', 2);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        // DOMStringList uses .contains(), not .includes()
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked — close other tabs and retry.'));
    });
  }

  function getPrimaryKey(key) {
    if (key === 'shipments') return 'ShipmentNo';
    if (key === 'vendors') return 'VendorName';
    if (key === 'items') return 'ItemName';
    if (key === 'settings') return 'Key';
    if (key === 'installments') return 'SlNo';
    if (key === 'materials') return 'RowID';
    if (key === 'borrowers') return 'BorrowerID';
    if (key === 'borrower_txns') return 'TxnID';
    if (key === 'installment_txns') return 'TxnID';
    if (key === 'commission_txns') return 'TxnID';
    if (key === 'installment_remarks') return 'RemarkID';
    if (key === 'shipment_remarks') return 'RemarkID';
    if (key === 'products') return 'ProductName';
    if (key === 'product_items') return 'RowID';
    return null;
  }

  async function tryRestoreFolder() {
    try {
      // 1. Check backend status
      const resp = await fetch('/api/status');
      if (!resp.ok) throw new Error('API server unreachable');

      // 2. Load all tables concurrently from PostgreSQL / Database via REST API
      mode = 'sqlite';
      const tableKeys = Object.keys(FILE_MAP).filter(k => k !== 'borrowers' && k !== 'borrower_txns');
      cache.borrowers = [];
      cache.borrower_txns = [];

      const fetchPromises = tableKeys.map(async key => {
        try {
          const r = await fetch(`/api/get?table=${key}`);
          cache[key] = r.ok ? await r.json() : [];
        } catch {
          cache[key] = [];
        }
      });

      const borrowerListPromise = (async () => {
        try {
          const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;
          const userId = currentUser ? currentUser.userid : '';
          const rb = await fetch(`/api/borrower-list?userId=${userId}`);
          cache.borrowers = rb.ok ? await rb.json() : [];
        } catch {
          cache.borrowers = [];
        }
      })();

      await Promise.all([...fetchPromises, borrowerListPromise]);
      return true;
    } catch (e) {
      console.warn('Backend server unavailable, falling back to offline browser cache:', e);
      // Fallback to local browser cache
      mode = 'cache';
      for (const key of Object.keys(FILE_MAP)) {
        cache[key] = [];
      }
      return true;
    }
  }

  function isReady() {
    return !!cache.shipments;
  }

  function getAll(key) {
    return cache[key] ? [...cache[key]] : [];
  }

  async function insert(key, row) {
    if (!cache[key]) cache[key] = [];
    cache[key].push(row);

    if (mode === 'sqlite') {
      await fetch(`/api/insert?table=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row)
      });
    }
    return row;
  }

  async function update(key, matchFn, newData) {
    const pkName = getPrimaryKey(key);
    const originalRow = cache[key].find(r => matchFn(r));
    const pkValue = originalRow ? originalRow[pkName] : null;

    // Update local cache
    cache[key] = cache[key].map(r => matchFn(r) ? { ...r, ...newData } : r);

    if (mode === 'sqlite' && pkValue !== null) {
      await fetch(`/api/update?table=${key}&matchField=${pkName}&matchValue=${encodeURIComponent(pkValue)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
    }
  }

  async function remove(key, matchFn) {
    const pkName = getPrimaryKey(key);
    const originalRow = cache[key].find(r => matchFn(r));
    const pkValue = originalRow ? originalRow[pkName] : null;

    // Update local cache
    cache[key] = cache[key].filter(r => !matchFn(r));

    if (mode === 'sqlite' && pkValue !== null) {
      await fetch(`/api/delete?table=${key}&matchField=${pkName}&matchValue=${encodeURIComponent(pkValue)}`, {
        method: 'POST'
      });
    }
  }

  async function replaceAll(key, rows) {
    cache[key] = rows;

    if (mode === 'sqlite') {
      await fetch(`/api/replace?table=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows)
      });
    }
  }

  // Fallback downloads (downloads all SQL rows as individual excels from Settings page)
  function downloadAllWorkbooks() {
    for (const key of Object.keys(FILE_MAP)) {
      const { file, sheet } = FILE_MAP[key];
      const rows = cache[key] || [];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS[key] });
      XLSX.utils.book_append_sheet(wb, ws, sheet);
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([out], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function idbSaveDoc(shipmentNo, fileName, fileBlob) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const key = `${shipmentNo}_${fileName}`;
      store.put({ shipmentNo, fileName, fileBlob }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGetDoc(shipmentNo, fileName) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const key = `${shipmentNo}_${fileName}`;
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDocumentFile(shipmentNo, fileName, fileBlob) {
    // 1. Save to disk via server API (primary storage)
    try {
      const arrayBuf = await fileBlob.arrayBuffer();
      const resp = await fetch(
        `/api/upload-doc?shipmentNo=${encodeURIComponent(shipmentNo)}&fileName=${encodeURIComponent(fileName)}`,
        { method: 'POST', body: arrayBuf }
      );
      if (!resp.ok) throw new Error(`Server upload failed: ${resp.status}`);
    } catch (e) {
      console.warn('Server upload failed, storing in IndexedDB only:', e);
    }
    // 2. Also cache in IndexedDB for offline preview
    await idbSaveDoc(shipmentNo, fileName, fileBlob);
    return true;
  }

  async function downloadDocumentFile(shipmentNo, fileName) {
    const res = await idbGetDoc(shipmentNo, fileName);
    if (res && res.fileBlob) {
      const url = URL.createObjectURL(res.fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function clearCache() {
    cache = {};
  }

  return {
    supportsFileSystemAPI: () => false, // Bypassed for SQLite mode
    pickFolder: () => Promise.resolve(true), // Bypassed for SQLite mode
    tryRestoreFolder,
    reconnect: () => Promise.resolve(true), // Bypassed for SQLite mode
    isReady,
    getMode: () => mode,
    getAll,
    insert,
    update,
    remove,
    replaceAll,
    HEADERS,
    downloadAllWorkbooks,
    saveDocumentFile,
    downloadDocumentFile,
    clearCache,
  };

})();
