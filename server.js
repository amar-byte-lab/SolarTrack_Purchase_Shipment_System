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

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Setup SMTP transporter for password reset emails
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  }
});

async function sendResetEmail(toEmail, username, resetLink) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"SolarTrack" <no-reply@example.com>',
    to: toEmail,
    subject: 'SolarTrack Password Reset Request',
    text: `Hi ${username},\n\nYou requested a password reset for your SolarTrack account.\n\nPlease click the link below to reset your password. This link is valid for 1 hour:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
    html: `<p>Hi ${username},</p><p>You requested a password reset for your SolarTrack account.</p><p>Please click the link below to reset your password. This link is valid for 1 hour:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, please ignore this email.</p>`
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n======================================================');
    console.log('📬 [EMAIL FALLBACK] Password reset email log:');
    console.log(`User: ${username} (${toEmail})`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('======================================================\n');
    return;
  }

  await smtpTransporter.sendMail(mailOptions);
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

        const users = await db.getTable('users');
        const foundUser = users.find(u =>
          (u.userid.toLowerCase() === inputId || (u.email && u.email.toLowerCase() === inputId) || (u.username && u.username.toLowerCase() === inputId)) &&
          u.password === inputPass
        );

        if (foundUser) {
          if (foundUser.status === 'Pending') {
            sendResponse(req, res, 403, 'application/json', Buffer.from(JSON.stringify({ success: false, error: 'Your account is pending Admin approval.' })), 'no-cache, no-store');
          } else if (foundUser.status === 'Rejected') {
            sendResponse(req, res, 403, 'application/json', Buffer.from(JSON.stringify({ success: false, error: 'Your account registration was rejected by Admin.' })), 'no-cache, no-store');
          } else {
            const body = JSON.stringify({
              success: true,
              user: { userid: foundUser.userid, username: foundUser.username, role: foundUser.role, email: foundUser.email }
            });
            sendResponse(req, res, 200, 'application/json', Buffer.from(body), 'no-cache, no-store');
          }
        } else {
          sendResponse(req, res, 401, 'application/json', Buffer.from(JSON.stringify({ success: false, error: 'Invalid User ID/Email or Password' })), 'no-cache, no-store');
        }
        return;
      }

      if (pathname === '/api/auth-config') {
        if (req.method === 'GET') {
          try {
            const users = await db.getTable('users');
            const rolesList = await db.getTable('roles');
            const roles = rolesList.map(r => r.role);
            sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ users, roles })), 'no-cache, no-store');
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.method === 'POST') {
          try {
            const payload = await getRequestBody(req);
            if (!payload || !payload.users || !payload.roles) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid payload' }));
              return;
            }

            // 1. Sync Roles
            const currentRolesList = await db.getTable('roles');
            const currentRoles = currentRolesList.map(r => r.role);

            for (const r of payload.roles) {
              if (!currentRoles.includes(r)) {
                await db.insertRow('roles', { role: r });
              }
            }
            for (const r of currentRoles) {
              if (!payload.roles.includes(r) && r !== 'admin' && r !== 'user') {
                await db.deleteRow('roles', 'role', r);
              }
            }

            // 2. Sync Users
            const currentUsers = await db.getTable('users');
            const newUserids = payload.users.map(u => u.userid.toLowerCase());

            // Delete users removed from the list (protecting 'admin')
            for (const cu of currentUsers) {
              if (!newUserids.includes(cu.userid.toLowerCase()) && cu.userid !== 'admin') {
                await db.deleteRow('users', 'userid', cu.userid);
              }
            }

            // Insert or Update users
            for (const u of payload.users) {
              const userid = u.userid.toLowerCase();
              const existing = currentUsers.find(cu => cu.userid.toLowerCase() === userid);
              
              const userData = {
                userid: userid,
                username: u.username,
                email: u.email || (existing ? existing.email : `${userid}@example.com`),
                password: u.password,
                role: u.role,
                status: u.status || (existing ? existing.status : 'Approved'),
                created_at: existing ? existing.created_at : new Date().toISOString()
              };

              await db.insertRow('users', userData);
            }

            sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        }
        return;
      }

      if (pathname === '/api/register') {
        try {
          const payload = await getRequestBody(req);
          const userid = (payload?.userid || '').trim().toLowerCase();
          const username = (payload?.username || '').trim();
          const email = (payload?.email || '').trim().toLowerCase();
          const password = payload?.password || '';
          const role = payload?.role || 'user';

          if (!userid || !username || !email || !password) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Please provide userid, username, email, and password.' }));
            return;
          }

          if (!/^[a-z0-9_-]+$/.test(userid)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'User ID must be lowercase alphanumeric, underscore, or hyphen only.' }));
            return;
          }

          const users = await db.getTable('users');
          if (users.some(u => u.userid.toLowerCase() === userid)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `User ID "${userid}" is already in use.` }));
            return;
          }
          if (users.some(u => u.email && u.email.toLowerCase() === email)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Email "${email}" is already in use.` }));
            return;
          }

          // Register as pending
          const newUser = {
            userid,
            username,
            email,
            password,
            role,
            status: 'Pending',
            created_at: new Date().toISOString()
          };
          await db.insertRow('users', newUser);

          // Create notification for admin
          const newNotification = {
            type: 'new_user_registration',
            user_id: userid,
            message: `New user registration request: ${username} (${userid}, role: ${role})`,
            status: 'unread',
            created_at: new Date().toISOString()
          };
          await db.insertRow('notifications', newNotification);

          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, message: 'Registration submitted. Please wait for admin approval.' })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (pathname === '/api/forgot-password') {
        try {
          const payload = await getRequestBody(req);
          const email = (payload?.email || '').trim().toLowerCase();
          
          if (!email) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Please provide an email address.' }));
            return;
          }

          const users = await db.getTable('users');
          const user = users.find(u => u.email && u.email.toLowerCase() === email);

          if (user) {
            const token = crypto.randomBytes(20).toString('hex');
            const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

            user.reset_token = token;
            user.reset_expires = expires;
            await db.insertRow('users', user);

            const resetLink = `http://${req.headers.host}/reset-password.html?token=${token}`;
            await sendResetEmail(user.email, user.username, resetLink);
          }

          // Return generic success to prevent email enumeration
          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, message: 'If the email exists in our system, a password reset link has been sent.' })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (pathname === '/api/reset-password') {
        try {
          const payload = await getRequestBody(req);
          const token = payload?.token || '';
          const newPassword = payload?.password || '';

          if (!token || !newPassword) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing token or new password.' }));
            return;
          }

          const users = await db.getTable('users');
          const user = users.find(u => u.reset_token === token);

          if (!user) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Password reset token is invalid.' }));
            return;
          }

          const expiryDate = new Date(user.reset_expires);
          if (expiryDate < new Date()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Password reset token has expired.' }));
            return;
          }

          user.password = newPassword;
          user.reset_token = null;
          user.reset_expires = null;
          await db.insertRow('users', user);

          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, message: 'Password has been reset successfully.' })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (pathname === '/api/notifications') {
        try {
          const allNotifications = await db.getTable('notifications');
          // Sort unread notifications first, then descending by created_at
          const sorted = allNotifications.sort((a, b) => {
            if (a.status === 'unread' && b.status !== 'unread') return -1;
            if (a.status !== 'unread' && b.status === 'unread') return 1;
            return new Date(b.created_at) - new Date(a.created_at);
          });
          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, notifications: sorted })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (pathname === '/api/notifications/resolve') {
        try {
          const payload = await getRequestBody(req);
          const id = payload?.id;
          const action = payload?.action; // 'approve' or 'reject'

          if (!id || !action) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing notification ID or action.' }));
            return;
          }

          const notifications = await db.getTable('notifications');
          // Match by id (number or string representation)
          const notif = notifications.find(n => String(n.id) === String(id));

          if (!notif) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Notification not found.' }));
            return;
          }

          const targetUserid = notif.user_id;
          const users = await db.getTable('users');
          const user = users.find(u => u.userid.toLowerCase() === targetUserid.toLowerCase());

          if (user) {
            if (action === 'approve') {
              user.status = 'Approved';
              await db.insertRow('users', user);
            } else if (action === 'reject') {
              user.status = 'Rejected';
              await db.insertRow('users', user);
            }
          }

          // Mark notification as resolved/read
          notif.status = 'resolved';
          await db.insertRow('notifications', notif);

          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (pathname === '/api/roles') {
        try {
          const rolesList = await db.getTable('roles');
          const roles = rolesList.map(r => r.role);
          sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true, roles })), 'no-cache, no-store');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
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
        const userId = parsedUrl.searchParams.get('userId') || '';
        const data = await db.getBorrowerList(userId);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify(data)), 'no-cache, no-store');
        console.log(`[API] GET /api/borrower-list?userId=${userId} | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
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

      if (pathname === '/api/borrower-delete') {
        const body = await getRequestBody(req);
        await db.deleteBorrower(body.BorrowerID);
        const dbDuration = (performance.now() - dbStartTime).toFixed(2);
        sendResponse(req, res, 200, 'application/json', Buffer.from(JSON.stringify({ success: true })), 'no-cache, no-store');
        console.log(`[API] POST /api/borrower-delete | 200 OK | Total: ${(performance.now() - reqStartTime).toFixed(2)}ms | DB: ${dbDuration}ms`);
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