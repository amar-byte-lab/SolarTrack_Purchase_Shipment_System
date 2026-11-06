/**
 * sld-page.js — Controller for dedicated full-page Single Line Diagram (SLD)
 * & Electrical Schematic.
 */

(function () {
  'use strict';

  function initPage() {
    // 1. Render Sidebar & Topbar
    if (typeof UI !== 'undefined') {
      UI.renderSidebar('sld.html');
      UI.renderTopbar('SLD Diagram');
    }

    // 2. Read query params or default
    const urlParams = new URLSearchParams(window.location.search);
    const initialType = urlParams.get('type') || urlParams.get('system') || 'off-grid';

    // 3. Render Schematic on page
    if (window.SizingSchematic) {
      window.SizingSchematic.render(initialType);

      // Sync dropdown
      const sel = document.getElementById('sldSystemSelect');
      if (sel) sel.value = initialType;
    }
  }

  // Hook up into window.onDbReady or DOMContentLoaded
  window.onDbReady = function () {
    initPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    setTimeout(initPage, 50);
  }
})();
