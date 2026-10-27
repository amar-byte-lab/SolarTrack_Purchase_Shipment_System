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

  function clearAllCacheAndStorage() {
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

    try {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
    } catch (e) {
      console.warn('Cache Storage clear error:', e);
    }

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(r => r.unregister());
        });
      }
    } catch (e) {
      console.warn('Service Worker unregister error:', e);
    }

    try {
      if (typeof DB !== 'undefined' && DB.clearCache) {
        DB.clearCache();
      }
    } catch (e) {
      console.warn('DB clearCache error:', e);
    }
  }

  async function logout() {
    clearAllCacheAndStorage();
    try {
      fetch('/api/logout', { method: 'POST', keepalive: true }).catch(() => {});
    } catch (e) {}
    window.location.href = 'login.html';
  }

  async function login(userid, password) {
    clearAllCacheAndStorage();
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
        window.location.href = isEmployee ? 'quotation.html' : 'dashboard.html';
      }
      return;
    }

    // 2. Allow reset password page without auth
    if (page === 'reset-password.html') {
      return;
    }

    // 3. If user is not logged in -> redirect to login.html
    if (!currentUser) {
      window.location.href = 'login.html';
      return;
    }

    // 4. Handle index.html forwarding for logged in users
    if (page === 'index.html') {
      window.location.href = isEmployee ? 'quotation.html' : 'dashboard.html';
      return;
    }

    // 5. Access restrictions
    const isPowerUser = roleLower === 'admin' || roleLower === 'superadmin';
    
    if (isEmployee) {
      // Employee role has exclusive access only to Quotation, Document, and Calculator pages
      const allowed = ['quotation.html', 'document.html', 'sizing-calc.html', 'agreement.html'];
      if (!allowed.includes(page)) {
        window.location.href = 'quotation.html';
        return;
      }
      return;
    }

    if (!isPowerUser) {
      if (page === 'manage-work.html' || page === 'files.html') {
        window.location.href = 'dashboard.html';
        return;
      }
      if (roleLower === 'partner' || roleLower === 'associates') {
        const allowed = ['dashboard.html', 'customer.html', 'inventory.html', 'work-note.html', 'quotation.html', 'document.html', 'agreement.html', 'ledger.html', 'sizing-calc.html'];
        if (!allowed.includes(page)) {
          window.location.href = 'dashboard.html';
          return;
        }
      } else {
        const allowed = ['dashboard.html', 'inventory.html', 'quotation.html', 'document.html', 'agreement.html', 'ledger.html', 'work-note.html', 'sizing-calc.html'];
        if (!allowed.includes(page)) {
          window.location.href = 'dashboard.html';
          return;
        }
      }
    }
  }

  // Execute access check immediately
  checkAccess();

  return { getUser, setUser, logout, login, checkAccess };
})();
