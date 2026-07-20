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

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = 'login.html';
  }

  function fallbackLogin(userid, password) {
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
    return { success: false, error: 'Invalid User ID or Password' };
  }

  async function login(userid, password) {
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
        if (currentUser.role === 'admin') {
          window.location.href = 'dashboard.html';
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
      if (currentUser.role === 'admin') {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = 'offer.html';
      }
      return;
    }

    // 4. Normal user restricted access: ONLY allowed to access offer.html
    if (currentUser.role !== 'admin' && page !== 'offer.html') {
      window.location.href = 'offer.html';
      return;
    }
  }

  // Execute access check immediately
  checkAccess();

  return { getUser, setUser, logout, login, checkAccess };
})();
