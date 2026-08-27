/* =========================================================================
   screenshot.js — Full Application Screenshot & Export Engine
   Allows users to capture, preview, download, copy, or print screenshots
   of any page or specific section in SolarTrack.
   ========================================================================= */

const Screenshot = (() => {

  // Dynamically load html2canvas library if not already present
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (typeof window.html2canvas === 'function') {
        return resolve(window.html2canvas);
      }
      const existingScript = document.querySelector('script[src*="html2canvas"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.html2canvas));
        existingScript.addEventListener('error', () => reject(new Error('Failed to load html2canvas.')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'js/html2canvas.min.js';
      script.onload = () => {
        if (typeof window.html2canvas === 'function') {
          resolve(window.html2canvas);
        } else {
          reject(new Error('html2canvas script loaded but window.html2canvas is not defined.'));
        }
      };
      script.onerror = () => reject(new Error('Could not load js/html2canvas.min.js'));
      document.head.appendChild(script);
    });
  }

  // Camera Flash Visual Effect
  function triggerFlashEffect() {
    let flash = document.querySelector('.screenshot-flash-overlay');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'screenshot-flash-overlay';
      document.body.appendChild(flash);
    }
    flash.classList.add('active');
    setTimeout(() => {
      flash.classList.remove('active');
    }, 250);
  }

  // Main Capture Function
  async function takeScreenshot(options = {}) {
    const targetEl = options.target || document.body;
    const captureMode = options.mode || 'full'; // 'full' or 'viewport'

    try {
      if (typeof UI !== 'undefined' && UI.showTopProgress) {
        UI.showTopProgress(30);
      }

      await loadHtml2Canvas();

      if (typeof UI !== 'undefined' && UI.showTopProgress) {
        UI.showTopProgress(60);
      }

      // Temporarily hide elements marked with .no-screenshot, open modals, or toast containers
      const hiddenElements = document.querySelectorAll('.no-screenshot, .toast-container, #screenshotPreviewModal');
      const prevDisplays = [];
      hiddenElements.forEach((el, idx) => {
        prevDisplays[idx] = el.style.display;
        el.style.display = 'none';
      });

      triggerFlashEffect();

      // Configure html2canvas options
      const canvasOptions = {
        useCORS: true,
        allowTaint: true,
        scale: Math.min(window.devicePixelRatio || 1.5, 2), // crisp quality
        logging: false,
        backgroundColor: '#FFFFFF',
      };

      if (captureMode === 'viewport') {
        canvasOptions.width = window.innerWidth;
        canvasOptions.height = window.innerHeight;
        canvasOptions.x = window.scrollX;
        canvasOptions.y = window.scrollY;
      }

      const canvas = await html2canvas(targetEl, canvasOptions);

      // Restore hidden elements
      hiddenElements.forEach((el, idx) => {
        el.style.display = prevDisplays[idx] || '';
      });

      if (typeof UI !== 'undefined' && UI.showTopProgress) {
        UI.showTopProgress(100);
      }

      const dataUrl = canvas.toDataURL('image/png');
      openPreviewModal(dataUrl, canvas.width, canvas.height);

    } catch (err) {
      console.error('Screenshot error:', err);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Failed to capture screenshot: ' + err.message, 'danger');
      } else {
        alert('Failed to capture screenshot: ' + err.message);
      }
    }
  }

  // Open Interactive Preview Modal
  function openPreviewModal(dataUrl, width, height) {
    let modalEl = document.getElementById('screenshotPreviewModal');
    if (modalEl) modalEl.remove();

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB');
    
    // Clean page title for file naming
    const pageTitleClean = document.title ? document.title.split('—')[0].trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Page';
    const timestampStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const filename = `SolarTrack_${pageTitleClean}_${timestampStr}.png`;

    modalEl = document.createElement('div');
    modalEl.id = 'screenshotPreviewModal';
    modalEl.className = 'modal fade no-screenshot';
    modalEl.setAttribute('tabindex', '-1');
    modalEl.setAttribute('aria-hidden', 'true');

    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content shadow-lg border-0 rounded-3 overflow-hidden">
          <div class="modal-header bg-dark text-white py-2.5 px-3 d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-5">📸</span>
              <div>
                <h6 class="modal-title mb-0 fw-bold text-white fs-6">Screenshot Captured</h6>
                <div class="text-white-50 fs-8">${document.title || 'SolarTrack'} • ${width} × ${height} px • ${dateStr} ${timeStr}</div>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-3 text-center bg-dark-subtle position-relative" style="max-height: 72vh; overflow: auto; background-image: radial-gradient(rgba(0,0,0,0.15) 1px, transparent 1px); background-size: 16px 16px;">
            <div class="screenshot-img-container d-inline-block position-relative shadow rounded border bg-white p-1">
              <img src="${dataUrl}" id="screenshotPreviewImg" alt="Screenshot Preview" class="img-fluid rounded" style="max-width: 100%; height: auto; display: block;">
            </div>
          </div>
          <div class="modal-footer bg-light py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5" id="btnReshootModal" onclick="Screenshot.takeScreenshot()">
                🔄 Retake
              </button>
              <span class="text-muted fs-8 d-none d-md-inline ms-1">Shortcut: <kbd class="bg-white text-dark border px-1">Alt</kbd> + <kbd class="bg-white text-dark border px-1">S</kbd></span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5" id="btnPrintScreenshot">
                🖨️ Print
              </button>
              <button class="btn btn-sm btn-primary d-flex align-items-center gap-1.5" id="btnCopyScreenshot">
                📋 Copy to Clipboard
              </button>
              <a href="${dataUrl}" download="${filename}" class="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1.5" id="btnDownloadScreenshot">
                📥 Download PNG
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Event listeners
    const btnCopy = document.getElementById('btnCopyScreenshot');
    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast('Screenshot copied to clipboard!', 'success');
            } else {
              alert('Screenshot copied to clipboard!');
            }
          } else {
            throw new Error('Clipboard API write permission unavailable');
          }
        } catch (err) {
          console.warn('Copy to clipboard failed:', err);
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Direct clipboard write failed. Right click image to copy.', 'warning');
          } else {
            alert('Right click the image to copy it.');
          }
        }
      });
    }

    const btnPrint = document.getElementById('btnPrintScreenshot');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        const printWin = window.open('', '_blank');
        if (!printWin) return;
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print Screenshot - ${document.title}</title>
            <style>
              body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
              @page { size: auto; margin: 10mm; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print(); window.close();">
          </body>
          </html>
        `);
        printWin.document.close();
      });
    }

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }

  // Keyboard shortcut listener (Alt + S)
  document.addEventListener('keydown', (e) => {
    // Only capture if not typing inside an input/textarea
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditable = document.activeElement && document.activeElement.isContentEditable;
    
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      takeScreenshot();
    }
  });

  return {
    takeScreenshot,
    loadHtml2Canvas
  };
})();
