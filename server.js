const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'SolarPurchaseTracker');
const DB_PATH = path.join(__dirname, 'solartrack.db');

// Initialize SQLite database connection
const db = new DatabaseSync(DB_PATH);

// Setup schema tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    Key TEXT PRIMARY KEY,
    Value TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS vendors (
    VendorName TEXT PRIMARY KEY,
    Address TEXT,
    Phone TEXT,
    GSTIN TEXT,
    Email TEXT,
    Remarks TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    ItemName TEXT PRIMARY KEY,
    Category TEXT,
    Unit TEXT,
    HSNCode TEXT,
    GSTPercent TEXT,
    Status TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS installments (
    SlNo INTEGER PRIMARY KEY,
    Name TEXT,
    Status TEXT,
    District TEXT,
    Address TEXT,
    MobileNumber TEXT,
    CommittedBrand TEXT,
    FirstInstallment REAL,
    SecondInstallment REAL,
    ThirdInstallment REAL,
    Total REAL,
    CommittedPrice REAL,
    LoginDate TEXT,
    InstallationDate TEXT,
    Commission REAL,
    CommissionPaid REAL
  )
`);

try {
  db.exec(`ALTER TABLE installments ADD COLUMN BrokerName TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE installments ADD COLUMN BrokerNumber TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE installments ADD COLUMN CommissioningDate TEXT`);
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS installment_txns (
    TxnID TEXT PRIMARY KEY,
    SlNo INTEGER,
    TxnDate TEXT,
    Amount REAL,
    Remark TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS commission_txns (
    TxnID TEXT PRIMARY KEY,
    SlNo INTEGER,
    TxnDate TEXT,
    Amount REAL,
    Remark TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS installment_remarks (
    RemarkID TEXT PRIMARY KEY,
    SlNo INTEGER,
    Type TEXT,
    Remark TEXT,
    CreatedAt TEXT
  )
`);



db.exec(`
  CREATE TABLE IF NOT EXISTS shipment_remarks (
    RemarkID TEXT PRIMARY KEY,
    ShipmentNo TEXT,
    Remark TEXT,
    CreatedAt TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    ProductName TEXT PRIMARY KEY,
    CreatedAt TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS product_items (
    RowID TEXT PRIMARY KEY,
    ProductName TEXT,
    ItemName TEXT,
    Price REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shipments (
    ShipmentNo TEXT PRIMARY KEY,
    PurchaseDate TEXT,
    VendorName TEXT,
    ShipmentType TEXT,
    VehicleNumber TEXT,
    InvoiceNumber TEXT,
    TransportationCost REAL,
    GSTPercentage REAL,
    VendorPaid REAL,
    TransportPaid REAL,
    Documents TEXT,
    Remarks TEXT,
    CreatedAt TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    RowID TEXT PRIMARY KEY,
    ShipmentNo TEXT,
    ItemName TEXT,
    Category TEXT,
    Quantity REAL,
    Unit TEXT,
    PurchaseRate REAL,
    TotalPurchaseValue REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS borrowers (
    BorrowerID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name       TEXT NOT NULL,
    Mobile     TEXT,
    Address    TEXT,
    Status     TEXT DEFAULT 'Active',
    CreatedAt  TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS borrower_txns (
    TxnID      INTEGER PRIMARY KEY AUTOINCREMENT,
    BorrowerID INTEGER NOT NULL,
    TxnDate    TEXT NOT NULL,
    Amount     REAL NOT NULL,
    Type       TEXT NOT NULL,
    Remarks    TEXT,
    CreatedAt  TEXT
  )
`);

const MIME_TYPES = {
  // Web
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  // Images
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  // Documents
  '.pdf':  'application/pdf',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  // Microsoft Office
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt':  'application/vnd.ms-powerpoint',
  // Archives
  '.zip':  'application/zip',
  '.rar':  'application/x-rar-compressed',
  // Fallback (handled by server as octet-stream)
};

// Helper to read request body JSON
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Helper to parse raw multipart binary body (for file uploads)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Uploads directory (stored next to server.js)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // CORS headers (allow browser fetch from same host)
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 1a. Serve uploaded documents: GET /docs/<shipmentNo>/<filename>
  if (req.method === 'GET' && pathname.startsWith('/docs/')) {
    const parts = pathname.slice('/docs/'.length).split('/');
    if (parts.length >= 2) {
      const shipmentNo = parts[0];
      const fileName   = parts.slice(1).join('/');
      const safePath   = path.join(UPLOADS_DIR, shipmentNo, fileName);
      if (fs.existsSync(safePath)) {
        const ext = path.extname(safePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        // Inline display for images/PDF, download for everything else
        const inlineExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.txt'];
        const disposition = inlineExts.includes(ext) ? 'inline' : `attachment; filename="${fileName}"`;
        res.setHeader('Content-Disposition', disposition);
        res.statusCode = 200;
        fs.createReadStream(safePath).pipe(res);
      } else {
        res.statusCode = 404;
        res.end('Document not found');
      }
    } else {
      res.statusCode = 400;
      res.end('Bad request');
    }
    return;
  }

  // 1b. Upload a document: POST /api/upload-doc?shipmentNo=SHIP-0001&fileName=invoice.pdf
  if (req.method === 'POST' && pathname === '/api/upload-doc') {
    try {
      const shipmentNo = parsedUrl.searchParams.get('shipmentNo');
      const fileName   = parsedUrl.searchParams.get('fileName');
      if (!shipmentNo || !fileName) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing shipmentNo or fileName' }));
        return;
      }
      const fileBody = await getRawBody(req);
      const shipDir  = path.join(UPLOADS_DIR, shipmentNo);
      if (!fs.existsSync(shipDir)) fs.mkdirSync(shipDir, { recursive: true });
      const destPath = path.join(shipDir, fileName);
      fs.writeFileSync(destPath, fileBody);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, path: `/docs/${shipmentNo}/${fileName}` }));
    } catch (e) {
      console.error('Upload error:', e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1c. Excel files download route for migration
  if (pathname.startsWith('/excel/')) {
    const filename = path.basename(pathname);
    const excelPath = path.join(__dirname, filename);
    if (fs.existsSync(excelPath)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES['.xlsx']);
      fs.createReadStream(excelPath).pipe(res);
      return;
    } else {
      res.statusCode = 404;
      res.end('Excel file not found');
      return;
    }
  }

  // 2. REST API endpoints
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (pathname === '/api/login') {
        const payload = await getRequestBody(req);
        const inputId = (payload?.userid || payload?.username || '').trim().toLowerCase();
        const inputPass = payload?.password || '';

        const pkgPath = path.join(__dirname, 'package.json');
        let pkg = {};
        if (fs.existsSync(pkgPath)) {
          try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          } catch (e) {}
        }

        const users = pkg.auth?.users || [
          { userid: 'admin', username: 'Admin', password: 'adminpassword', role: 'admin' },
          { userid: 'user', username: 'Normal User', password: 'userpassword', role: 'user' }
        ];

        const foundUser = users.find(u =>
          (u.userid.toLowerCase() === inputId || u.username.toLowerCase() === inputId) &&
          u.password === inputPass
        );

        if (foundUser) {
          res.end(JSON.stringify({
            success: true,
            user: {
              userid: foundUser.userid,
              username: foundUser.username,
              role: foundUser.role
            }
          }));
        } else {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Invalid User ID or Password' }));
        }
        return;
      }

      if (pathname === '/api/status') {
        const stmt = db.prepare("SELECT COUNT(*) as count FROM shipments");
        const count = stmt.all()[0].count;
        res.end(JSON.stringify({ isMigrated: count > 0 }));
        return;
      }

      if (pathname === '/api/get') {
        const table = parsedUrl.searchParams.get('table');
        const stmt = db.prepare(`SELECT * FROM ${table}`);
        res.end(JSON.stringify(stmt.all()));
        return;
      }

      if (pathname === '/api/import') {
        const payload = await getRequestBody(req);
        const { table, rows } = payload;
        
        db.exec('BEGIN TRANSACTION');
        try {
          db.exec(`DELETE FROM ${table}`);
          if (rows && rows.length) {
            const cols = Object.keys(rows[0]);
            const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
            const stmt = db.prepare(sql);
            for (const r of rows) {
              stmt.run(...cols.map(c => r[c]));
            }
          }
          db.exec('COMMIT');
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        return;
      }

      if (pathname === '/api/insert') {
        const table = parsedUrl.searchParams.get('table');
        const row = await getRequestBody(req);
        const cols = Object.keys(row);
        const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
        db.prepare(sql).run(...cols.map(c => row[c]));
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathname === '/api/update') {
        const table = parsedUrl.searchParams.get('table');
        const matchField = parsedUrl.searchParams.get('matchField');
        const matchValue = parsedUrl.searchParams.get('matchValue');
        const newData = await getRequestBody(req);
        
        const setClause = Object.keys(newData).map(col => `${col} = ?`).join(', ');
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${matchField} = ?`;
        db.prepare(sql).run(...Object.values(newData), matchValue);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathname === '/api/delete') {
        const table = parsedUrl.searchParams.get('table');
        const matchField = parsedUrl.searchParams.get('matchField');
        const matchValue = parsedUrl.searchParams.get('matchValue');
        
        const sql = `DELETE FROM ${table} WHERE ${matchField} = ?`;
        db.prepare(sql).run(matchValue);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathname === '/api/replace') {
        const table = parsedUrl.searchParams.get('table');
        const rows = await getRequestBody(req);
        
        db.exec('BEGIN TRANSACTION');
        try {
          db.exec(`DELETE FROM ${table}`);
          if (rows && rows.length) {
            const cols = Object.keys(rows[0]);
            const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
            const stmt = db.prepare(sql);
            for (const r of rows) {
              stmt.run(...cols.map(c => r[c]));
            }
          }
          db.exec('COMMIT');
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        return;
      }

      // ── Borrower API ────────────────────────────────────────────────────
      if (pathname === '/api/borrower-list') {
        const rows = db.prepare('SELECT * FROM borrowers ORDER BY BorrowerID ASC').all();
        res.end(JSON.stringify(rows));
        return;
      }

      if (pathname === '/api/borrower-txns') {
        const bid = parsedUrl.searchParams.get('borrowerID');
        const rows = db.prepare('SELECT * FROM borrower_txns WHERE BorrowerID=? ORDER BY TxnDate ASC, TxnID ASC').all(bid);
        res.end(JSON.stringify(rows));
        return;
      }

      if (pathname === '/api/borrower-add') {
        const body = await getRequestBody(req);
        const stmt = db.prepare('INSERT INTO borrowers (Name,Mobile,Address,Status,CreatedAt) VALUES (?,?,?,?,?)');
        const info = stmt.run(body.Name, body.Mobile||'', body.Address||'', 'Active', new Date().toISOString());
        res.end(JSON.stringify({ BorrowerID: Number(info.lastInsertRowid) }));
        return;
      }

      if (pathname === '/api/borrower-update') {
        const body = await getRequestBody(req);
        db.prepare('UPDATE borrowers SET Name=?,Mobile=?,Address=? WHERE BorrowerID=?')
          .run(body.Name, body.Mobile||'', body.Address||'', body.BorrowerID);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathname === '/api/borrower-close') {
        const body = await getRequestBody(req);
        db.prepare('UPDATE borrowers SET Status=? WHERE BorrowerID=?').run(body.Status, body.BorrowerID);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (pathname === '/api/borrower-txn-add') {
        const body = await getRequestBody(req);
        const stmt = db.prepare('INSERT INTO borrower_txns (BorrowerID,TxnDate,Amount,Type,Remarks,CreatedAt) VALUES (?,?,?,?,?,?)');
        const info = stmt.run(body.BorrowerID, body.TxnDate, body.Amount, body.Type, body.Remarks||'', new Date().toISOString());
        res.end(JSON.stringify({ TxnID: Number(info.lastInsertRowid) }));
        return;
      }

      if (pathname === '/api/borrower-txn-delete') {
        const body = await getRequestBody(req);
        db.prepare('DELETE FROM borrower_txns WHERE TxnID=?').run(body.TxnID);
        res.end(JSON.stringify({ success: true }));
        return;
      }
      // ── End Borrower API ────────────────────────────────────────────────

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (e) {
      console.error('API Error:', e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 3. Static files router
  let filePath = path.join(PUBLIC_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Server Error');
  });
  stream.pipe(res);
});

server.listen(PORT, () => {
  console.log("======================================================");
  console.log("SolarTrack Server Started");
  console.log(`Listening on Port: ${PORT}`);
  console.log("SQLite Database Connected");
  console.log("======================================================");

  // Open browser only on local Windows machine
  if (process.env.RENDER !== "true") {
    const url = `http://localhost:${PORT}/`;
    const startCmd =
      process.platform === "win32"
        ? `start ${url}`
        : process.platform === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;

    exec(startCmd, () => {});
  }
});