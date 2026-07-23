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
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = 'login.html';
  }

  function fallbackLogin(userid, password) {
    clearAllCacheAndStorage();
    const id = (userid || '').trim().toLowerCase();
    if (id === 'admin' && password === 'adminpassword') {
      const u = { userid: 'admin', username: 'Admin', role: 'admin' };
      setUser(u);
      return { success: true, user: u };
    }
    if (id === 'user' && password === 'userpassword') {
      const u = { userid: 'user', username: 'Normal User', role: 'user' };
      setUser(u);
      return { success: true, user: u };
    }
    if (id === 'amar' && password === 'amar') {
      const u = { userid: 'amar', username: 'amar', role: 'user' };
      setUser(u);
      return { success: true, user: u };
    }
    return { success: false, error: 'Invalid User ID or Password' };
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
      } else if (res.status === 404 || data.error === 'Endpoint not found') {
        // Fallback for when server process is running older code before restart
        return fallbackLogin(userid, password);
      } else {
        return { success: false, error: data.error || 'Invalid User ID or Password' };
      }
    } catch (e) {
      return fallbackLogin(userid, password);
    }
  }

  function checkAccess() {
    const rawPath = window.location.pathname;
    let page = rawPath.substring(rawPath.lastIndexOf('/') + 1).toLowerCase() || 'index.html';
    if (page === '' || page === '/') page = 'index.html';

    const currentUser = getUser();

    // 1. If on login page
    if (page === 'login.html') {
      if (currentUser) {
        if (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar') {
          window.location.href = 'dashboard.html';
        } else if (currentUser.role === 'partner' || currentUser.role === 'associates') {
          window.location.href = 'installments.html';
        } else {
          window.location.href = 'offer.html';
        }
      }
      return;
    }

    // 2. If user is not logged in -> redirect to login.html
    if (!currentUser) {
      window.location.href = 'login.html';
      return;
    }

    // 3. Handle index.html forwarding for logged in users
    if (page === 'index.html') {
      if (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar') {
        window.location.href = 'dashboard.html';
      } else if (currentUser.role === 'partner' || currentUser.role === 'associates') {
        window.location.href = 'installments.html';
      } else {
        window.location.href = 'offer.html';
      }
      return;
    }

    // 4. Access restrictions
    const isPowerUser = (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.userid === 'amar');
    
    if (!isPowerUser) {
      if (currentUser.role === 'partner' || currentUser.role === 'associates') {
        const allowed = ['installments.html', 'offer.html', 'borrower.html'];
        if (!allowed.includes(page)) {
          window.location.href = 'installments.html';
          return;
        }
      } else {
        const allowed = ['offer.html', 'borrower.html'];
        if (!allowed.includes(page)) {
          window.location.href = 'offer.html';
          return;
        }
      }
    }
  }

  // Execute access check immediately
  checkAccess();

  return { getUser, setUser, logout, login, checkAccess };
})();
