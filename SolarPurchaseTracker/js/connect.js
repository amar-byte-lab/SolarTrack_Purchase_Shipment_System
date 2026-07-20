/* =========================================================================
   connect.js — Database connection gate
   -------------------------------------------------------------------------
   Every page includes this. On load it silently restores the database 
   from the previously chosen folder, or falls back transparently to
   IndexedDB offline browser storage. The connection card is completely
   bypassed for a seamless, popup-free experience.
   ========================================================================= */

(function () {
  async function boot() {
    UI.showLoading(true);
    try {
      await DB.tryRestoreFolder();
    } catch (e) {
      console.error('Database restoration error:', e);
    }
    UI.showLoading(false);
    afterReady();
  }

  function afterReady() {
    UI.refreshDbStatusBadge();
    if (typeof window.onDbReady === 'function') {
      window.onDbReady();
    }
  }

  window.DBConnect = { boot };
  document.addEventListener('DOMContentLoaded', boot);
})();
