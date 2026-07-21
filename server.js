const SERVER_START_TIME = performance.now();
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'SolarPurchaseTracker');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Cache package.json in memory to avoid blocking I/O on login
let cachedPkgUsers = null;
function getAuthUsers() {
  if (cachedPkgUsers) return cachedPkgUsers;
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.auth?.users) cachedPkgUsers = pkg.auth.users;
    }
  } catch (e) {
    console.error('Error loading package.json auth:', e.message);
  }
  if (!cachedPkgUsers) {
    cachedPkgUsers = [
      { userid: 'admin', username: 'Admin', password: 'adminpassword', role: 'admin' },
      { userid: 'user', username: 'Normal User', password: 'userpassword', role: 'user' }
    ];
  }
  return cachedPkgUsers;
}

const MIME_TYPES = {
  // Web
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
};

// Helper to send Gzip-compressed / uncompressed response stream
function sendResponse(req, res, statusCode, contentType, bodyBuffer, cacheControl) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isCompressible = /json|text|javascript|css|xml/.test(contentType);

  if (isCompressible && acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    const gzip = zlib.createGzip();
    gzip.pipe(res);
    gzip.end(bodyBuffer);
  } else {
    res.setHeader('Content-Length', Buffer.byteLength(bodyBuffer));
    res.end(bodyBuffer);
  }
}

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

const server = http.createServer(async (req, res) => {
  const reqStartTime = performance.now();
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // CORS headers
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
        const inlineExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.txt'];
        const disposition = inlineExts.includes(ext) ? 'inline' : `attachment; filename="${fileName}"`;
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Cache-Control', 'public, max-age=86400');
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

      sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, path: `/docs/${shipmentNo}/${fileName}` })), 'no-cache, no-store');
    } catch (e) {
      console.error('Upload error:', e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }



  // 2. REST API endpoints
  if (pathname.startsWith('/api/')) {
    const dbStartTime = performance.now();
    try {
      if (pathname === '/api/login') {
        const payload = await getRequestBody(req);
        const inputId = (payload?.userid || payload?.username || '').trim().toLowerCase();
        const inputPass = payload?.password || '';

        const users = getAuthUsers();
        const foundUser = users.find(u =>
          (u.userid.toLowerCase() === inputId || u.username.toLowerCase() === inputId) &&
          u.password === inputPass
        );

        if (foundUser) {
          const body = JSON.stringify({
            success: true,
            user: { userid: foundUser.userid, username: foundUser.username, role: foundUser.role }
          });
          sendResponse(req, res, 200, 'application/json', Buffer.from(body), 'no-cache, no-store');
        } else {
          sendResponse(req, res, 401, 'application/json', Buffer.from(JSON.stringify({ success: false, error: 'Invalid User ID or Password' })), 'no-cache, no-store');
        }
        return;
      }

      if (pathname === '/api/logout') {
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
        res.setHeader('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        return;
      }

      if (pathname === '/api/status') {
        const status = await db.getStatus();
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(status)), 'no-cache, no-store');
        console.log(`[API] GET /api/status | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/get') {
        const table = parsedUrl.searchParams.get('table');
        const data = await db.getTable(table);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(data)), 'no-cache, no-store');
        console.log(`[API] GET /api/get?table=${table} | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/import') {
        const payload = await getRequestBody(req);
        const { table, rows } = payload;
        await db.importTable(table, rows);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/import (${table}) | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/insert') {
        const table = parsedUrl.searchParams.get('table');
        const row = await getRequestBody(req);
        await db.insertRow(table, row);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/insert (${table}) | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/update') {
        const table = parsedUrl.searchParams.get('table');
        const matchField = parsedUrl.searchParams.get('matchField');
        const matchValue = parsedUrl.searchParams.get('matchValue');
        const newData = await getRequestBody(req);

        await db.updateRow(table, matchField, matchValue, newData);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/update (${table}) | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/delete') {
        const table = parsedUrl.searchParams.get('table');
        const matchField = parsedUrl.searchParams.get('matchField');
        const matchValue = parsedUrl.searchParams.get('matchValue');

        await db.deleteRow(table, matchField, matchValue);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/delete (${table}) | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/replace') {
        const table = parsedUrl.searchParams.get('table');
        const rows = await getRequestBody(req);
        await db.replaceTable(table, rows);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/replace (${table}) | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      // ── Borrower API ────────────────────────────────────────────────────
      if (pathname === '/api/borrower-list') {
        const data = await db.getBorrowerList();
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(data)), 'no-cache, no-store');
        console.log(`[API] GET /api/borrower-list | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-txns') {
        const bid = parsedUrl.searchParams.get('borrowerID');
        const data = await db.getBorrowerTxns(bid);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(data)), 'no-cache, no-store');
        console.log(`[API] GET /api/borrower-txns | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-add') {
        const body = await getRequestBody(req);
        const result = await db.addBorrower(body);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(result)), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-add | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-update') {
        const body = await getRequestBody(req);
        await db.updateBorrower(body);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-update | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-close') {
        const body = await getRequestBody(req);
        await db.closeBorrower(body);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-close | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-txn-add') {
        const body = await getRequestBody(req);
        const result = await db.addBorrowerTxn(body);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(result)), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-txn-add | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }

      if (pathname === '/api/borrower-txn-delete') {
        const body = await getRequestBody(req);
        await db.deleteBorrowerTxn(body.TxnID);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-txn-delete | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
        return;
      }
      // ── End Borrower API ────────────────────────────────────────────────

      sendResponse(req, res, 404, 'application/json', Buffer.from(JSON.stringify({ error: 'Endpoint not found' })), 'no-cache, no-store');
    } catch (e) {
      console.error('API Error:', e);
      sendResponse(req, res, 500, 'application/json', Buffer.from(JSON.stringify({ error: e.message })), 'no-cache, no-store');
    }
    return;
  }

  // 3. Static files router with Gzip & Cache-Control
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
  const cacheControl = ext === '.html'
    ? 'no-cache'
    : 'public, max-age=86400, stale-while-revalidate=3600';

  try {
    const content = fs.readFileSync(filePath);
    sendResponse(req, res, 200, contentType, content, cacheControl);
  } catch (e) {
    res.statusCode = 500;
    res.end('Server Error');
  }
});

server.listen(PORT, () => {
  const startupDuration = (performance.now() - SERVER_START_TIME).toFixed(2);
  console.log("======================================================");
  console.log("SolarTrack Server Started");
  console.log(`Listening on Port: ${PORT}`);
  console.log(`Server Startup Duration: ${startupDuration} ms`);
  console.log(`Active Database Driver: ${db.driverName} (DB_TYPE: ${db.dbType})`);
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