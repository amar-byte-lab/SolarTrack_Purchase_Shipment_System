/* =========================================================================
   auth.js — Form Authentication & Role-Based Access Control (RBAC)
   ========================================================================= */

const Auth = (() => {
  const STORAGE_KEY = 'solar_auth_user';

  function getUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  async function clearAllCacheAndStorage() {
    // 1. Clear Web Storages
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('LocalStorage clear error:', e);
    }

    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('SessionStorage clear error:', e);
    }

    // 2. Clear Document Cookies
    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        }
      }
    } catch (e) {
      console.warn('Cookies clear error:', e);
    }

    // 3. Clear Cache Storage API (HTTP caches & Service Worker caches)
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (e) {
      console.warn('Cache Storage clear error:', e);
    }

    // 4. Unregister Service Workers
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch (e) {
      console.warn('Service Worker unregister error:', e);
    }

    // 5. Clear application in-memory cache
    try {
      if (typeof DB !== 'undefined' && DB.clearCache) {
        DB.clearCache();
      }
    } catch (e) {
      console.warn('DB clearCache error:', e);
    }
  }

  async function logout() {
    try {
      await clearAllCacheAndStorage();
    } catch (e) {
      console.warn('Storage cleanup error:', e);
    }

    try {
      // Await server logout response so browser processes Clear-Site-Data header
      await fetch('/api/logout', { method: 'POST', keepalive: true });
    } catch (e) {
      console.warn('Logout API call error:', e);
    }

    // Replace history entry to prevent back-button navigation to authenticated screen
    window.location.replace('login.html');
  }

  async function login(userid, password) {
    await clearAllCacheAndStorage();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Invalid User ID or Password' };
      }
    } catch (e) {
      return { success: false, error: 'Server connection error. Please try again.' };
    }
  }

  function checkAccess() {
    const rawPath = window.location.pathname;
    let page = rawPath.substring(rawPath.lastIndexOf('/') + 1).toLowerCase() || 'index.html';
    if (page === '' || page === '/') page = 'index.html';

    const currentUser = getUser();
    const roleLower = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase().trim();
    const isEmployee = roleLower === 'employee';

    // 1. If on login page
    if (page === 'login.html') {
      if (currentUser) {
        window.location.href = 'quotation.html';
      }
      return;
    }

    // 2. Allow reset password page without auth
    if (page === 'reset-password.html') {
      return;
    }

    // 3. If user is not logged in -> redirect to login.html
    if (!currentUser) {
      window.location.replace('login.html');
      return;
    }

    // 4. Handle index.html forwarding for logged in users
    if (page === 'index.html') {
      window.location.replace('quotation.html');
      return;
    }

    // 5. Access restrictions
    const isPowerUser = roleLower === 'admin' || roleLower === 'superadmin';
    
    if (isEmployee) {
      // Employee role has exclusive access only to Quotation, Document, and Calculator pages
      const allowed = ['quotation.html', 'document.html', 'sizing-calc.html', 'agreement.html'];
      if (!allowed.includes(page)) {
        window.location.replace('quotation.html');
        return;
      }
      return;
    }

    if (!isPowerUser) {
      if (page === 'manage-work.html' || page === 'files.html' || page === 'inventory.html') {
        window.location.replace('quotation.html');
        return;
      }
      if (roleLower === 'partner' || roleLower === 'associates') {
        const allowed = ['summary.html', 'quotation.html', 'customer.html', 'work-note.html', 'quotation.html', 'document.html', 'agreement.html', 'ledger.html', 'sizing-calc.html'];
        if (!allowed.includes(page)) {
          window.location.replace('quotation.html');
          return;
        }
      } else {
        const allowed = ['summary.html', 'quotation.html', 'quotation.html', 'document.html', 'agreement.html', 'ledger.html', 'work-note.html', 'sizing-calc.html'];
        if (!allowed.includes(page)) {
          window.location.replace('quotation.html');
          return;
        }
      }
    }
  }

  // Handle bfcache: if navigating back to a page after logout, re-verify authentication
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      checkAccess();
    }
  });

  // Execute access check immediately
  checkAccess();

  return { getUser, setUser, logout, login, checkAccess, clearAllCacheAndStorage };
})();
