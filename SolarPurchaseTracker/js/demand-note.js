/* =========================================================================
   demand-note.js — Demand Note Excel Generator Controller
   ========================================================================= */

let selectedPdfFiles = [];
let parsedDataRows = [];

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
  initFileUploadEvents();
});

window.onDbReady = function () {
  UI.renderSidebar('demand-note.html');
  UI.renderTopbar('Demand Note Generate', 'Batch generate demand note Excel sheet from NetMeter PDF documents', '');

  initFileUploadEvents();
};

function initFileUploadEvents() {
  const dropZone = document.getElementById('pdfDropZone');
  const fileInput = document.getElementById('pdfFileInput');
  const btnBrowse = document.getElementById('btnBrowseFiles');
  const btnProcess = document.getElementById('btnProcessPdfs');
  const btnClear = document.getElementById('btnClearFiles');
  const btnExport = document.getElementById('btnExportExcel');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      fileInput.click();
    });
  }

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        addFilesToList(files);
      } else {
        UI.toast('Please drop PDF files only.', 'warning');
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        addFilesToList(files);
      }
      fileInput.value = '';
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      selectedPdfFiles = [];
      parsedDataRows = [];
      updateFileListUI();
      document.getElementById('previewCard').style.display = 'none';
      UI.toast('File list cleared.', 'info');
    });
  }

  if (btnProcess) {
    btnProcess.addEventListener('click', processPdfFiles);
  }

  if (btnExport) {
    btnExport.addEventListener('click', exportToExcel);
  }
}

function addFilesToList(files) {
  let addedCount = 0;
  files.forEach(file => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') || !file.type;
    if (isPdf) {
      if (!selectedPdfFiles.some(f => f.name === file.name && f.size === file.size)) {
        selectedPdfFiles.push(file);
        addedCount++;
      }
    }
  });
  updateFileListUI();
  if (addedCount > 0) {
    UI.toast(`Added ${addedCount} file(s) to selection.`, 'success');
  }
}

function removeFileFromList(index) {
  selectedPdfFiles.splice(index, 1);
  updateFileListUI();
}

function updateFileListUI() {
  const container = document.getElementById('fileListContainer');
  const countBadge = document.getElementById('fileCountBadge');
  const btnProcess = document.getElementById('btnProcessPdfs');

  if (countBadge) countBadge.textContent = selectedPdfFiles.length;
  if (btnProcess) btnProcess.disabled = selectedPdfFiles.length === 0;

  if (!container) return;

  if (selectedPdfFiles.length === 0) {
    container.innerHTML = `<div class="text-center text-muted fs-8 py-4">No PDF files selected yet.</div>`;
    return;
  }

  let html = selectedPdfFiles.map((file, idx) => `
    <div class="d-flex justify-content-between align-items-center bg-light border rounded p-2 mb-2 fs-8">
      <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
        <span class="text-danger fw-bold">📄</span>
        <span class="text-truncate fw-semibold" title="${file.name}">${file.name}</span>
        <span class="text-muted font-monospace" style="font-size:0.75rem;">(${formatFileSize(file.size)})</span>
      </div>
      <button type="button" class="btn btn-xs btn-link text-danger p-0 border-0 fw-bold" onclick="removeFileFromList(${idx})" title="Remove file">✕</button>
    </div>
  `).join('');

  container.innerHTML = html;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function cleanStr(val) {
  if (!val) return '';
  return val.replace(/\s+/g, ' ').replace(/^[:\-\s]+|[:\-\s]+$/g, '').trim();
}

async function processPdfFiles() {
  if (selectedPdfFiles.length === 0) return;

  UI.showLoading(true);
  parsedDataRows = [];

  try {
    for (let i = 0; i < selectedPdfFiles.length; i++) {
      const file = selectedPdfFiles[i];
      const parsedRow = await parseSinglePdf(file, i + 1);
      parsedDataRows.push(parsedRow);
    }

    renderPreviewTable();
    UI.toast(`Successfully processed ${parsedDataRows.length} PDF file(s).`, 'success');
  } catch (err) {
    console.error('PDF Processing error:', err);
    UI.toast('Error parsing PDF files: ' + err.message, 'danger');
  } finally {
    UI.showLoading(false);
  }
}

function parseSinglePdf(file, slNo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const data = new Uint8Array(buffer);
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        let fullText = '';
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          fullText += ' ' + textContent.items.map(it => it.str).join(' ');
        }

        const refNo = cleanStr((fullText.match(/Reference\s*No\s*[:\-]?\s*(\d+)/i) || [])[1]);
        const consumerId = cleanStr((fullText.match(/(?:Consumer\s*ID|Service\s*No)\s*[:\-]?\s*(\d+)/i) || [])[1]);

        let nameMatch = fullText.match(/Consumer\s*Name\s*[:\-]?\s*([\s\S]+?)(?=Division\s*:|Sub-Division\s*:|Section\s*:|Residential|Mobile|e-Mail|$)/i);
        const applicantName = nameMatch ? cleanStr(nameMatch[1]) : '';

        let divMatch = fullText.match(/Division\s*[:\-]?\s*([\s\S]+?)(?=Sub-Division\s*:|Section\s*:|Residential|Mobile|$)/i);
        const division = divMatch ? cleanStr(divMatch[1]) : '';

        let circle = '';
        if (division) {
          const parts = division.split(/\s+/);
          circle = parts[parts.length - 1];
        }

        let subDivMatch = fullText.match(/Sub-Division\s*[:\-]?\s*([\s\S]+?)(?=Section\s*:|Residential|Mobile|$)/i);
        const subDivision = subDivMatch ? cleanStr(subDivMatch[1]) : '';

        let secMatch = fullText.match(/Section\s*[:\-]?\s*([\s\S]+?)(?=Residential\s*Address\s*:|Mobile|e-Mail|$)/i);
        const section = secMatch ? cleanStr(secMatch[1]) : '';

        let loadMatch = fullText.match(/(?:Solar\s*Capacity\s*applied\s*for|Requested\s*Load)\s*[:\-]?\s*([\d\.]+)/i);
        const requestedLoad = loadMatch ? cleanStr(loadMatch[1]) : '';

        resolve({
          slNo: slNo,
          refNo: refNo || '',
          applicantName: applicantName || '',
          serviceNo: consumerId || '',
          requestedLoad: requestedLoad || '',
          circle: circle || '',
          division: division || '',
          subDivision: subDivision || '',
          section: section || '',
          vendorName: 'SHRI TRUTIYADEV SOLAR ENTERPRISES',
          meterPayment: 'YES'
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function renderPreviewTable() {
  const container = document.getElementById('previewCard');
  const tbody = document.getElementById('demandNoteTbody');
  const rowCountBadge = document.getElementById('parsedRowCount');

  if (!container || !tbody) return;

  if (rowCountBadge) rowCountBadge.textContent = parsedDataRows.length;
  container.style.display = 'block';

  let html = parsedDataRows.map((row, idx) => `
    <tr data-index="${idx}">
      <td class="text-center font-monospace fw-bold">${idx + 1}</td>
      <td><input type="text" class="dn-ref font-monospace" value="${row.refNo}"></td>
      <td><input type="text" class="dn-name fw-bold" value="${row.applicantName}"></td>
      <td><input type="text" class="dn-service font-monospace" value="${row.serviceNo}"></td>
      <td class="text-center"><input type="text" class="dn-load text-center font-monospace" value="${row.requestedLoad}"></td>
      <td><input type="text" class="dn-circle" value="${row.circle}"></td>
      <td><input type="text" class="dn-division" value="${row.division}"></td>
      <td><input type="text" class="dn-subdivision" value="${row.subDivision}"></td>
      <td><input type="text" class="dn-section" value="${row.section}"></td>
      <td><input type="text" class="dn-vendor fw-semibold" value="${row.vendorName}"></td>
      <td class="text-center"><input type="text" class="dn-meter text-center fw-bold text-success" value="${row.meterPayment}"></td>
      <td class="text-center no-print">
        <button type="button" class="btn btn-xs btn-link text-danger p-0 border-0 fw-bold" onclick="deleteTableRow(${idx})" title="Remove row">✕</button>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = html;
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteTableRow(index) {
  parsedDataRows.splice(index, 1);
  renderPreviewTable();
}

function getTableDataFromDOM() {
  const tbody = document.getElementById('demandNoteTbody');
  if (!tbody) return parsedDataRows;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  return rows.map((tr, idx) => {
    return {
      slNo: idx + 1,
      refNo: (tr.querySelector('.dn-ref') || {}).value || '',
      applicantName: (tr.querySelector('.dn-name') || {}).value || '',
      serviceNo: (tr.querySelector('.dn-service') || {}).value || '',
      requestedLoad: (tr.querySelector('.dn-load') || {}).value || '',
      circle: (tr.querySelector('.dn-circle') || {}).value || '',
      division: (tr.querySelector('.dn-division') || {}).value || '',
      subDivision: (tr.querySelector('.dn-subdivision') || {}).value || '',
      section: (tr.querySelector('.dn-section') || {}).value || '',
      vendorName: (tr.querySelector('.dn-vendor') || {}).value || 'SHRI TRUTIYADEV SOLAR ENTERPRISES',
      meterPayment: (tr.querySelector('.dn-meter') || {}).value || 'YES'
    };
  });
}

function exportToExcel() {
  const currentData = getTableDataFromDOM();

  if (currentData.length === 0) {
    UI.toast('No data available to export.', 'warning');
    return;
  }

  // Create Excel headers matching the exact photo structure
  const headers = [
    'SL NO',
    'REFERENCE NO',
    'APPLICANT NAME',
    'SERVICE NO',
    'REQUESTED LOAD',
    'CIRCLE',
    'DIVISION',
    'SUB-DIVISION',
    'SECTION',
    'VENDOR NAME',
    'METER PAYMENT'
  ];

  const excelRows = [headers];

  currentData.forEach((row, idx) => {
    excelRows.push([
      idx + 1,
      row.refNo,
      row.applicantName,
      row.serviceNo,
      isNaN(Number(row.requestedLoad)) ? row.requestedLoad : Number(row.requestedLoad),
      row.circle,
      row.division,
      row.subDivision,
      row.section,
      row.vendorName,
      row.meterPayment
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(excelRows);

  // Exact Column Widths matching photo design
  ws['!cols'] = [
    { wch: 8 },  // SL NO
    { wch: 18 }, // REFERENCE NO
    { wch: 24 }, // APPLICANT NAME
    { wch: 18 }, // SERVICE NO
    { wch: 16 }, // REQUESTED LOAD
    { wch: 14 }, // CIRCLE
    { wch: 18 }, // DIVISION
    { wch: 22 }, // SUB-DIVISION
    { wch: 18 }, // SECTION
    { wch: 28 }, // VENDOR NAME
    { wch: 16 }  // METER PAYMENT
  ];

  // Exact Row Heights matching photo design
  const rowHeights = [{ hpt: 36 }]; // Header row height
  currentData.forEach(() => rowHeights.push({ hpt: 32 })); // Data row height
  ws['!rows'] = rowHeights;

  // Thin black border formatting
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  // Apply cell formatting (Header Light Blue Fill #BDD7EE, Bold, Centered, Thin Borders)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;

      const isHeader = R === 0;
      ws[cellRef].s = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: isHeader || C === 2 || C === 4 || C === 9 || C === 10,
          color: { rgb: '000000' }
        },
        fill: isHeader ? { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } } : { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true
        },
        border: thinBorder
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Demand Note');

  const todayStr = UI.todayISO ? UI.todayISO().replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `Demand_Note_Generate_${todayStr}.xlsx`;

  XLSX.writeFile(wb, fileName, { cellStyles: true });
  UI.toast('Demand Note Excel exported with exact styling!', 'success');
}
