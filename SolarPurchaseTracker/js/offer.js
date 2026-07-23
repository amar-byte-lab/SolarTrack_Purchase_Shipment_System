/* =========================================================================
   offer.js — Offer/Quotation Generator Page Controller
   ========================================================================= */

let companyUpiId = '';
let offerSubsidiesList = [];

const DEFAULT_SOLAR_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="85" viewBox="0 0 240 85"><rect width="240" height="85" fill="white" rx="6"/><g transform="translate(10, 10)"><circle cx="28" cy="24" r="14" fill="%23FF9F43"/><path d="M 12,36 L 44,36 L 50,58 L 6,58 Z" fill="%232470A0"/><line x1="28" y1="36" x2="28" y2="58" stroke="white" stroke-width="2"/><line x1="12" y1="46" x2="44" y2="46" stroke="white" stroke-width="2"/><text x="58" y="26" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="%230F2027" letter-spacing="0.5">SHRI TRUTIYADEV</text><text x="58" y="44" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="12" fill="%23FF9F43" letter-spacing="0.5">SOLAR ENTERPRISES</text></g></svg>`;

const activeAdjustments = {
  discount: { active: false, label: 'Discount (₹)', type: 'subtraction', value: 0, sign: '-' },
  cgst: { active: false, label: 'CGST (%)', type: 'tax', value: 0, sign: '+' },
  sgst: { active: false, label: 'SGST (%)', type: 'tax', value: 0, sign: '+' },
  transport: { active: false, label: 'Transportation (₹)', type: 'addition', value: 0, sign: '+' },
  labour: { active: false, label: 'Labour Charges (₹)', type: 'addition', value: 0, sign: '+' },
  other: { active: false, label: 'Other Charges (₹)', type: 'addition', value: 0, sign: '+' }
};

window.onDbReady = function () {
  UI.renderSidebar('offer.html');
  UI.renderTopbar('Offer Generator', 'Create customized solar quotation offers for clients', '');

  const allProducts = DB.getAll('products');
  const emptyState = document.getElementById('emptyState');
  const offerContainer = document.getElementById('offerContainer');

  if (allProducts.length === 0) {
    if (emptyState) {
      emptyState.innerHTML = `
        <div class="fs-5 fw-bold text-secondary mb-2">Create Product set in the "Products" page.</div>
        <a href="item-master.html" class="btn btn-sm btn-accent fw-semibold mt-2">📦 Go to Products Page</a>
      `;
      emptyState.style.display = 'block';
    }
    if (offerContainer) offerContainer.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (offerContainer) offerContainer.style.display = 'block';

  // Set default date
  document.getElementById('qDate').value = UI.todayISO();

  // Set default Quote Number TR{Year}{Month}{Day}{Hr}{Min} (e.g. TR2607201357)
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('qQuoteNo').value = `TR${yy}${mm}${dd}${hh}${mi}`;

  // Load and apply Company Profile Settings
  loadCompanyProfileSettings();

  // Extract products from URL
  const rawParam = Utils.getQueryParam('products');
  const preCheckedProducts = rawParam ? decodeURIComponent(rawParam).split(',').map(s => s.trim()).filter(Boolean) : [];

  // Render product selection checklist (collapsed by default)
  renderProductSelectionList(preCheckedProducts);

  // Load pre-checked product items into quotation grid
  preCheckedProducts.forEach(pName => {
    addProductSetRowsToGrid(pName);
  });

  // Render initial dynamic adjustments layout
  renderAdjustmentLines();
  updateAdjustmentButtonsUI();

  // Setup initial workspace visibility
  updateWorkspaceVisibility();

  // Print bind
  document.getElementById('btnPrintOffer').addEventListener('click', () => {
    const custName = document.getElementById('qCustName').value.trim();
    if (!custName) {
      UI.toast('Please enter the customer name before printing.', 'warning');
      
      // Auto-expand address section so they can see and edit customer details easily
      const collapseAddr = document.getElementById('collapseAddresses');
      const iconAddr = document.getElementById('iconAddresses');
      if (collapseAddr && collapseAddr.style.display === 'none') {
        collapseAddr.style.display = 'block';
        if (iconAddr) iconAddr.textContent = '▲';
      }
      
      document.getElementById('qCustName').focus();
      return;
    }
    syncPrintLabels();
    renderPaginatedPrintView();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  });
};

window.toggleOfferSection = function(collapseId, iconId) {
  const panel = document.getElementById(collapseId);
  const icon = document.getElementById(iconId);
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    if (icon) icon.textContent = '▲';
  } else {
    panel.style.display = 'none';
    if (icon) icon.textContent = '▼';
  }
};

function formatQuoteDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear().toString().slice(-2);
  return `${d}-${m}-${y}`;
}

function convertNumberToWords(amount) {
  const words = {
    0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
    10: 'Ten', 11: 'Eleven', 12: 'Twelve', 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen',
    20: 'Twenty', 30: 'Thirty', 40: 'Forty', 50: 'Fifty', 60: 'Sixty', 70: 'Seventy', 80: 'Eighty', 90: 'Ninety'
  };

  if (amount === 0) return 'Rupees Zero Only';

  let n = Math.floor(amount);
  let str = '';

  function getTensAndOnes(val) {
    if (val < 20) return words[val] || '';
    const tens = Math.floor(val / 10) * 10;
    const ones = val % 10;
    return words[tens] + (ones > 0 ? ' ' + words[ones] : '');
  }

  function getHundreds(val) {
    const h = Math.floor(val / 100);
    const rem = val % 100;
    let res = '';
    if (h > 0) res += words[h] + ' Hundred';
    if (rem > 0) res += (res ? ' and ' : '') + getTensAndOnes(rem);
    return res;
  }

  // Crores
  const crores = Math.floor(n / 10000000);
  n = n % 10000000;
  if (crores > 0) {
    str += (str ? ' ' : '') + getHundreds(crores) + ' Crore';
  }

  // Lakhs
  const lakhs = Math.floor(n / 100000);
  n = n % 100000;
  if (lakhs > 0) {
    str += (str ? ' ' : '') + getHundreds(lakhs) + ' Lakh';
  }

  // Thousands
  const thousands = Math.floor(n / 1000);
  n = n % 1000;
  if (thousands > 0) {
    str += (str ? ' ' : '') + getHundreds(thousands) + ' Thousand';
  }

  // Hundreds & Remaining
  if (n > 0) {
    str += (str ? ' ' : '') + getHundreds(n);
  }

  return 'Rupees ' + str.trim() + ' Only';
}

function syncPrintLabels() {
  const settings = DB.getAll('settings');
  const getSetting = (key, def = '') => (settings.find(s => s.Key === key) || {}).Value ?? def;

  // 1. Heading Title based on checked product sets
  const checkedProds = Array.from(document.querySelectorAll('.offer-product-chk:checked')).map(chk => chk.value);
  const titleText = checkedProds.length > 0 ? `FOR ${checkedProds.join(' & ')} SYSTEM` : `FOR SOLAR POWER SYSTEM`;
  document.getElementById('printHeadingTitle').textContent = titleText;

  // 2. Seller Details
  const companyName = getSetting('CompanyName', 'SolarTrack');
  const gstNum = getSetting('CompanyGST', '');
  const sellerAddr = document.getElementById('qOfficeAddress').value;
  const sellerPhone = document.getElementById('qCompanyPhone').value;
  const sellerEmail = document.getElementById('qCompanyEmail').value;
  const logoBase64 = getSetting('CompanyLogo', '');

  document.getElementById('printSellerName').textContent = companyName;
  document.getElementById('printSignCompanyName').textContent = companyName.toUpperCase();
  document.getElementById('printSellerAddress').innerHTML = sellerAddr.replace(/\n/g, '<br>');
  document.getElementById('printSellerContacts').innerHTML = `Email: ${sellerEmail || '-'}<br>Mobile: ${sellerPhone || '-'}`;
  document.getElementById('printSellerGSTIN').textContent = gstNum ? `GSTIN: ${gstNum}` : '';

  const printLogo = document.getElementById('printSellerLogo');
  if (printLogo) {
    printLogo.src = logoBase64 || DEFAULT_SOLAR_LOGO;
    printLogo.style.display = 'inline-block';
  }

  // 4. Quote Metadata Box
  document.getElementById('printQuoteNo').textContent = document.getElementById('qQuoteNo').value.trim() || '-';
  document.getElementById('printQuoteDate').textContent = formatQuoteDate(document.getElementById('qDate').value);
  document.getElementById('printDeliveryDate').textContent = document.getElementById('qDeliveryDate').value.trim() || '-';
  document.getElementById('printPaymentTerms').textContent = document.getElementById('qPaymentTerms').value.trim() || '-';

  // 5. Buyer Details
  const buyerName = document.getElementById('qCustName')?.value.trim() || '-';
  const buyerMobile = document.getElementById('qCustMobile')?.value.trim() || '';
  const buyerAddr = document.getElementById('qCustAddress')?.value || '-';

  document.getElementById('printBuyerName').textContent = buyerName;
  document.getElementById('printBuyerAddress').innerHTML = buyerAddr.replace(/\n/g, '<br>');

  const printBuyerMob = document.getElementById('printBuyerMobile');
  const printBuyerMobWrap = document.getElementById('printBuyerMobileWrapper');
  if (printBuyerMob) {
    printBuyerMob.textContent = buyerMobile || '-';
  }
  if (printBuyerMobWrap) {
    printBuyerMobWrap.style.display = buyerMobile ? 'block' : 'none';
  }

  const lblName = document.getElementById('lblPrintBuyerName');
  const lblMob = document.getElementById('lblPrintBuyerMobile');
  const lblAddr = document.getElementById('lblPrintBuyerAddress');
  if (lblName) lblName.textContent = buyerName;
  if (lblMob) lblMob.textContent = buyerMobile ? `Mob: ${buyerMobile}` : '';
  if (lblAddr) lblAddr.innerHTML = buyerAddr.replace(/\n/g, '<br>');

  // 6. Bank details
  const holderVal = getSetting('BankAcHolder', 'Company Name');
  const bankVal = getSetting('BankName', 'ICICI BANK LTD');
  const acNoVal = getSetting('BankAcNo', '123456789123');
  const ifsVal = getSetting('BankBranchIFS', 'Branch & IFS Code');

  document.getElementById('printBankName').textContent = bankVal;
  document.getElementById('printBankAcHolder').textContent = holderVal;
  document.getElementById('printBankAcNo').textContent = acNoVal;
  document.getElementById('printBankBranchIFS').textContent = ifsVal;

  // 7. Terms and Conditions
  const termsText = getSetting('CompanyTerms', '');
  const printTermsLbl = document.getElementById('lblCompanyTermsPrint');
  if (printTermsLbl) {
    if (termsText) {
      const lines = termsText.split('\n').map(l => l.trim()).filter(Boolean);
      printTermsLbl.innerHTML = lines.map(line => {
        let content = line;
        const hasPoint = /^(?:\d+\.|\*|\-|\u2022)/.test(line);
        if (!hasPoint) {
          content = `• ${line}`;
        }
        return `<div class="mb-1" style="padding-left: 18px; text-indent: -18px; line-height: 1.35; text-align: left;">${content}</div>`;
      }).join('');
    } else {
      printTermsLbl.innerHTML = '';
    }
  }

  // 8. Subsidy Scheme Table Cell
  const subSelect = document.getElementById('qSubsidySelect');
  const printSubsidyCell = document.getElementById('printSubsidyCell');
  
  if (subSelect && subSelect.value !== '') {
    const selectedIndex = Number(subSelect.value);
    const sub = offerSubsidiesList[selectedIndex];
    if (sub) {
      document.getElementById('printSubPerKW').textContent = `${sub.kw} KW`;
      document.getElementById('printSubCentral').textContent = Number(sub.central).toLocaleString('en-IN');
      document.getElementById('printSubState').textContent = Number(sub.state).toLocaleString('en-IN');
      
      const totalSub = (sub.central || 0) + (sub.state || 0);
      document.getElementById('printSubTotal').textContent = `${totalSub.toLocaleString('en-IN')}`;
      
      if (printSubsidyCell) {
        printSubsidyCell.style.display = 'table-cell';
        printSubsidyCell.style.width = '48%';
      }
    }
  } else {
    if (printSubsidyCell) {
      printSubsidyCell.style.display = 'none';
      printSubsidyCell.style.width = '0%';
    }
  }

  // 9. Generate Printable Items Table
  generatePrintItemsGrid();
}

function generatePrintItemsGrid() {
  const rows = document.querySelectorAll('.quote-item-row');
  const tbody = document.getElementById('printItemsTbody');
  if (!tbody) return;

  // Recalculate totals
  let subtotal = 0;
  rows.forEach(row => {
    const qty = Number(row.querySelector('.q-qty').value) || 0;
    const price = Number(row.querySelector('.q-price').value) || 0;
    subtotal += (qty * price);
  });

  let discountVal = 0;
  let taxableValue = subtotal;
  if (activeAdjustments.discount.active) {
    discountVal = activeAdjustments.discount.value || 0;
    taxableValue = Math.max(0, subtotal - discountVal);
  }

  // Tax rates
  const cgstActive = activeAdjustments.cgst.active;
  const cgstRate = cgstActive ? activeAdjustments.cgst.value : 0;
  const sgstActive = activeAdjustments.sgst.active;
  const sgstRate = sgstActive ? activeAdjustments.sgst.value : 0;

  let cgstAmount = 0;
  if (cgstActive) cgstAmount = (taxableValue * cgstRate) / 100;
  let sgstAmount = 0;
  if (sgstActive) sgstAmount = (taxableValue * sgstRate) / 100;

  // Extra charges
  let otherCharges = 0;
  if (activeAdjustments.transport.active) otherCharges += activeAdjustments.transport.value || 0;
  if (activeAdjustments.labour.active) otherCharges += activeAdjustments.labour.value || 0;
  if (activeAdjustments.other.active) otherCharges += activeAdjustments.other.value || 0;

  const grandTotal = Math.max(0, taxableValue + cgstAmount + sgstAmount + otherCharges);

  // Update table headers with dynamic rates
  const cgstHeader = document.getElementById('printCgstHeader');
  const sgstHeader = document.getElementById('printSgstHeader');
  if (cgstHeader) cgstHeader.textContent = cgstActive ? `CGST Rate ${cgstRate}%` : 'CGST Rate';
  if (sgstHeader) sgstHeader.textContent = sgstActive ? `SGST Rate ${sgstRate}%` : 'SGST Rate';

  // Build grid row array
  let printRows = [];

  // Group 1: Normal Items
  rows.forEach(row => {
    const itemName = row.querySelector('.q-item-name').value.trim();
    const qty = Number(row.querySelector('.q-qty').value) || 1;
    const price = Number(row.querySelector('.q-price').value) || 0;
    printRows.push({ type: 'item', desc: itemName, qty: `${qty} SET`, price: price });
  });

  // Group 2: Add dynamic adjustment lines as standalone transparent item rows inside basic price column
  if (activeAdjustments.discount.active && discountVal > 0) {
    printRows.push({ type: 'adj', desc: 'Less: Discount', qty: '-', price: -discountVal });
  }
  if (activeAdjustments.transport.active && activeAdjustments.transport.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Transportation Charges', qty: '-', price: activeAdjustments.transport.value });
  }
  if (activeAdjustments.labour.active && activeAdjustments.labour.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Labour Charges', qty: '-', price: activeAdjustments.labour.value });
  }
  if (activeAdjustments.other.active && activeAdjustments.other.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Other Charges', qty: '-', price: activeAdjustments.other.value });
  }

  // Count rows to merge
  const totalMergeRows = printRows.length;
  let html = [];

  printRows.forEach((r, idx) => {
    let slNo = r.type === 'item' ? (idx + 1).toString() : '';
    let priceText = r.price < 0 ? `-₹${Math.abs(r.price).toLocaleString('en-IN', {minimumFractionDigits:2})}` : `₹${r.price.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    
    // Rowspan columns (CGST, SGST, Amount) - only output on the first row of merge
    let rowspanHtml = '';
    if (idx === 0) {
      rowspanHtml = `
        <td rowspan="${totalMergeRows}" style="border: 1px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
          ${cgstActive ? '₹' + cgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}
        </td>
        <td rowspan="${totalMergeRows}" style="border: 1px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
          ${sgstActive ? '₹' + sgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}
        </td>
        <td rowspan="${totalMergeRows}" style="border: 1px solid #000; text-align: right; vertical-align: middle; font-weight: bold;">
          ₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
      `;
    }

    html.push(`
      <tr>
        <td style="border: 1px solid #000; text-align: center; padding: 4px;">${slNo}</td>
        <td style="border: 1px solid #000; text-align: left; padding: 4px; ${r.type === 'adj' ? 'font-style: italic; font-weight: 500;' : ''}">${r.desc}</td>
        <td style="border: 1px solid #000; text-align: center; padding: 4px;">${r.qty}</td>
        <td style="border: 1px solid #000; text-align: right; padding: 4px; font-family: monospace;">${priceText}</td>
        ${rowspanHtml}
      </tr>
    `);
  });

  // Calculate sum of basic prices column for the total row
  let sumBasicPrices = subtotal;
  if (activeAdjustments.discount.active) sumBasicPrices -= discountVal;
  if (activeAdjustments.transport.active) sumBasicPrices += activeAdjustments.transport.value || 0;
  if (activeAdjustments.labour.active) sumBasicPrices += activeAdjustments.labour.value || 0;
  if (activeAdjustments.other.active) sumBasicPrices += activeAdjustments.other.value || 0;

  // Add Total row
  html.push(`
    <tr style="font-weight: bold; background-color: #fafafa;">
      <td style="border: 1px solid #000; padding: 4px;"></td>
      <td style="border: 1px solid #000; text-align: left; padding: 4px;">Grand Total</td>
      <td style="border: 1px solid #000; padding: 4px;"></td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-family: monospace;">₹${sumBasicPrices.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td style="border: 1px solid #000; text-align: center; padding: 4px; font-family: monospace;">${cgstActive ? '₹' + cgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
      <td style="border: 1px solid #000; text-align: center; padding: 4px; font-family: monospace;">${sgstActive ? '₹' + sgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-family: monospace; font-size: 9.5pt;">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
    </tr>
  `);

  tbody.innerHTML = html.join('');

  // Update Amount in Words
  document.getElementById('printAmountInWords').textContent = `Amount Chargeable (in words): ${convertNumberToWords(grandTotal)}`;
}

function createPrintPageShell() {
  const shell = document.createElement('div');
  shell.className = 'print-page-shell';

  const page = document.createElement('div');
  page.className = 'print-page';

  const header = document.createElement('div');
  header.className = 'print-page-header';
  header.innerHTML = `
    <div class="text-center mb-3">
      <h3 class="fw-bold mb-1 text-dark" style="font-size: 18pt; letter-spacing: 0.5px;">QUOTATION</h3>
      <h5 class="fw-bold mb-1 text-dark" style="font-size: 12pt; text-transform: uppercase;" id="printHeadingTitle">FOR 3 KW PM SURYAGHAR YOJANA ON-GRID SYSTEM</h5>
      <span style="font-size: 9pt; font-style: italic; color: #333;">(ORIGINAL FOR RECIPIENT)</span>
    </div>
  `;

  const content = document.createElement('div');
  content.className = 'print-page-content';

  const footer = document.createElement('div');
  footer.className = 'print-page-footer text-center mt-3 fw-bold text-dark';
  footer.style.cssText = 'font-size: 11pt; color: #000 !important; font-style: italic; border-top: 1px solid #000; padding-top: 6px;';
  footer.textContent = 'This is a Computer-Generated Copy';

  page.appendChild(header);
  page.appendChild(content);
  page.appendChild(footer);
  shell.appendChild(page);
  return { shell, page, content };
}

function renderPaginatedPrintView() {
  const root = document.getElementById('printPaginationRoot');
  const template = document.getElementById('printQuotationTemplate');
  if (!root || !template) return;

  root.innerHTML = '';

  const measureHost = document.createElement('div');
  measureHost.style.cssText = [
    'position: fixed',
    'left: -10000px',
    'top: 0',
    'width: 180mm',
    'visibility: hidden',
    'pointer-events: none',
    'z-index: -1',
    'box-sizing: border-box'
  ].join(';');
  document.body.appendChild(measureHost);

  const pageContentHeight = 273 * 3.7795275591;
  const gapAllowance = 8;
  const usableHeight = pageContentHeight - gapAllowance;

  const templateBlocks = {
    sellerQuote: template.querySelector('#printSellerQuoteBlock'),
    buyer: template.querySelector('#printBuyerBlock'),
    items: template.querySelector('#printItemsTable'),
    notes: template.querySelector('#printSpecialNotesBox'),
    amount: template.querySelector('#printAmountInWords'),
    terms: template.querySelector('#printTermsBlock'),
    subsidyBank: template.querySelector('#printSubsidyBankBlock'),
    signature: template.querySelector('#printSignatureBlock')
  };

  const makeMeasuredClone = (node) => {
    const clone = node.cloneNode(true);
    clone.style.display = 'block';
    clone.style.breakInside = 'avoid';
    clone.style.pageBreakInside = 'avoid';
    clone.style.boxSizing = 'border-box';
    clone.classList.add('print-block');
    return clone;
  };

  const measureHeight = (node) => {
    measureHost.innerHTML = '';
    const probe = makeMeasuredClone(node);
    measureHost.appendChild(probe);
    return probe.getBoundingClientRect().height;
  };

  const finalizePage = (pageData) => {
    if (!pageData || !pageData.content.children.length) return;
    root.appendChild(pageData.shell);
  };

  const pages = [];
  let currentPage = createPrintPageShell();
  pages.push(currentPage);
  measureHost.appendChild(currentPage.shell);
  let remaining = usableHeight;

  const addSection = (node) => {
    if (!node) return;
    const block = makeMeasuredClone(node);
    const height = measureHeight(node);
    if (height > remaining && currentPage.content.children.length) {
      finalizePage(currentPage);
      currentPage = createPrintPageShell();
      pages.push(currentPage);
      measureHost.appendChild(currentPage.shell);
      remaining = usableHeight;
    }
    currentPage.content.appendChild(block);
    remaining -= height;
  };

  addSection(templateBlocks.sellerQuote);
  addSection(templateBlocks.buyer);

  // Items table is split only between rows, never inside a row.
  const itemsTable = templateBlocks.items;
  if (itemsTable) {
    const sourceHeader = itemsTable.querySelector('thead')?.cloneNode(true);
    const sourceRows = Array.from(itemsTable.querySelectorAll('tbody tr'));
    const tableBase = document.createElement('table');
    tableBase.className = itemsTable.className;
    tableBase.id = itemsTable.id;
    tableBase.style.cssText = itemsTable.style.cssText;
    tableBase.setAttribute('data-print-block', 'table');

    const startTableOnPage = () => {
      const table = tableBase.cloneNode(false);
      if (sourceHeader) table.appendChild(sourceHeader.cloneNode(true));
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      currentPage.content.appendChild(table);
      const headerHeight = table.getBoundingClientRect().height;
      remaining -= headerHeight;
      return { table, tbody };
    };

    let tablePage = null;
    const ensureTablePage = () => {
      if (!tablePage) {
        if (measureHeight(itemsTable) > remaining && currentPage.content.children.length) {
          finalizePage(currentPage);
          currentPage = createPrintPageShell();
          pages.push(currentPage);
          measureHost.appendChild(currentPage.shell);
          remaining = usableHeight;
        }
        tablePage = startTableOnPage();
      }
    };

    sourceRows.forEach(row => {
      const rowClone = row.cloneNode(true);
      measureHost.innerHTML = '';
      const probeTable = tableBase.cloneNode(false);
      if (sourceHeader) probeTable.appendChild(sourceHeader.cloneNode(true));
      const probeBody = document.createElement('tbody');
      probeTable.appendChild(probeBody);
      probeBody.appendChild(rowClone.cloneNode(true));
      measureHost.appendChild(probeTable);
      const probeHeader = probeTable.querySelector('thead');
      const rowHeight = probeTable.getBoundingClientRect().height - (probeHeader ? probeHeader.getBoundingClientRect().height : 0);

      ensureTablePage();
      if (tablePage.tbody.children.length > 0 && rowHeight > remaining) {
        finalizePage(currentPage);
        currentPage = createPrintPageShell();
        pages.push(currentPage);
        measureHost.appendChild(currentPage.shell);
        remaining = usableHeight;
        tablePage = startTableOnPage();
      }

      tablePage.tbody.appendChild(rowClone);
      remaining -= rowHeight;
    });
  }

  addSection(templateBlocks.notes);
  addSection(templateBlocks.amount);
  addSection(templateBlocks.terms);
  addSection(templateBlocks.subsidyBank);
  addSection(templateBlocks.signature);

  finalizePage(currentPage);
  measureHost.remove();

  root.innerHTML = '';
  pages.forEach(pageData => {
    const shell = pageData.shell;
    shell.querySelectorAll('#printHeadingTitle').forEach(el => {
      el.textContent = document.getElementById('printHeadingTitle')?.textContent || el.textContent;
    });
    root.appendChild(shell);
  });
}

window.addEventListener('beforeprint', () => {
  renderPaginatedPrintView();
});

window.addEventListener('afterprint', () => {
  const root = document.getElementById('printPaginationRoot');
  if (root) root.innerHTML = '';
});

function loadCompanyProfileSettings() {
  const settings = DB.getAll('settings');
  const getSetting = (key, def = '') => (settings.find(s => s.Key === key) || {}).Value ?? def;

  // 1. Populate Company Header Info
  const compName = getSetting('CompanyName', 'SolarTrack');
  const gstNum = getSetting('CompanyGST', '');
  const email = getSetting('CompanyEmail', '');
  const phone = getSetting('CompanyPhone', '');

  const headerTitle = document.getElementById('qHeaderCompanyTitle');
  if (headerTitle) headerTitle.textContent = compName;

  const headerGst = document.getElementById('lblCompanyGST');
  if (headerGst) {
    headerGst.textContent = gstNum ? 'GSTIN: ' + gstNum : '';
  }

  // 2. Populate Logo Image
  const logoBase64 = getSetting('CompanyLogo', '');
  const logoImg = document.getElementById('qCompanyLogo');
  if (logoImg) {
    logoImg.src = logoBase64 || DEFAULT_SOLAR_LOGO;
    logoImg.style.display = 'inline-block';
  }

  // 3. Populate Stamp Image
  const stampBase64 = getSetting('CompanyStamp', '');
  const stampImg = document.getElementById('qCompanyStamp');
  if (stampImg) {
    if (stampBase64) {
      stampImg.src = stampBase64;
      stampImg.style.display = 'block';
    } else {
      stampImg.style.display = 'none';
    }
  }

  // 4. Populate Editable Contact Fields under Seller details
  const pInput = document.getElementById('qCompanyPhone');
  const eInput = document.getElementById('qCompanyEmail');
  if (pInput) pInput.value = phone;
  if (eInput) eInput.value = email;

  // Sync contacts with header printed metadata on input change
  const syncHeaderContacts = () => {
    const currEmail = eInput ? eInput.value.trim() : '';
    const currPhone = pInput ? pInput.value.trim() : '';
    
    const lblEmail = document.getElementById('lblCompanyEmail');
    const lblPhone = document.getElementById('lblCompanyPhone');
    
    if (lblEmail) lblEmail.textContent = `Email: ${currEmail || '-'}`;
    if (lblPhone) lblPhone.textContent = `Mob: ${currPhone || '-'}`;
  };

  if (pInput) pInput.addEventListener('input', syncHeaderContacts);
  if (eInput) eInput.addEventListener('input', syncHeaderContacts);
  syncHeaderContacts();

  // 5. Populate Office Addresses Dropdown
  let addresses = [];
  try {
    addresses = JSON.parse(getSetting('CompanyAddresses', '[]'));
  } catch (e) {
    addresses = [];
  }

  const select = document.getElementById('qOfficeAddressSelect');
  const textarea = document.getElementById('qOfficeAddress');

  if (select && textarea) {
    if (addresses.length === 0) {
      select.innerHTML = `<option value="">-- No addresses configured --</option>`;
      textarea.value = '';
    } else {
      select.innerHTML = addresses.map((addr, idx) => `
        <option value="${idx}">${addr.length > 50 ? addr.slice(0, 50) + '...' : addr}</option>
      `).join('');
      
      // Default to first address
      textarea.value = addresses[0] || '';
    }

    select.addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx !== '' && addresses[idx]) {
        textarea.value = addresses[idx];
      }
    });
  }

  // 6. Populate Bank Details (Visible in left side print block)
  const lblHolder = document.getElementById('lblBankAcHolder');
  const lblBank = document.getElementById('lblBankName');
  const lblAcNo = document.getElementById('lblBankAcNo');
  const lblIFS = document.getElementById('lblBankBranchIFS');

  const holderVal = getSetting('BankAcHolder', 'Company Name');
  const bankVal = getSetting('BankName', 'ICICI BANK LTD');
  const acNoVal = getSetting('BankAcNo', '123456789123');
  const ifsVal = getSetting('BankBranchIFS', 'Branch & IFS Code');

  if (lblHolder) lblHolder.textContent = holderVal;
  if (lblBank) lblBank.textContent = bankVal;
  if (lblAcNo) lblAcNo.textContent = acNoVal;
  if (lblIFS) lblIFS.textContent = ifsVal;

  // Print Copy Bank Details
  const printHolder = document.getElementById('lblPrintBankAcHolder');
  const printBank = document.getElementById('lblPrintBankName');
  const printAcNo = document.getElementById('lblPrintBankAcNo');
  const printIFS = document.getElementById('lblPrintBankBranchIFS');

  if (printHolder) printHolder.textContent = holderVal;
  if (printBank) printBank.textContent = bankVal;
  if (printAcNo) printAcNo.textContent = acNoVal;
  if (printIFS) printIFS.textContent = ifsVal;

  // 7. Load UPI ID into memory
  companyUpiId = getSetting('CompanyUPI', '');

  // 8. Populate Terms and Conditions Section
  const defaultTerms = '1. Warranty as per manufacturer terms.\n2. 50% advance on login.';
  const termsText = getSetting('CompanyTerms', defaultTerms);
  const termsSection = document.getElementById('termsSection');
  const termsLbl = document.getElementById('lblCompanyTerms');
  const termsLblPrint = document.getElementById('lblCompanyTermsPrint');
  if (termsSection && termsLbl) {
    if (termsText) {
      const lines = termsText.split('\n').map(l => l.trim()).filter(Boolean);
      const formattedHtml = lines.map(line => {
        let content = line;
        const hasPoint = /^(?:\d+\.|\*|\-|\u2022)/.test(line);
        if (!hasPoint) {
          content = `• ${line}`;
        }
        return `<div class="mb-1" style="padding-left: 18px; text-indent: -18px; line-height: 1.4; text-align: left;">${content}</div>`;
      }).join('');
      
      termsLbl.innerHTML = formattedHtml;
      if (termsLblPrint) termsLblPrint.innerHTML = formattedHtml;
      termsSection.style.display = 'block';
    } else {
      termsSection.style.display = 'none';
    }
  }

  // 9. Populate Government Subsidy dropdown
  try {
    offerSubsidiesList = JSON.parse(getSetting('GovtSubsidies', '[]'));
  } catch (e) {
    offerSubsidiesList = [];
  }

  const subSelect = document.getElementById('qSubsidySelect');
  if (subSelect) {
    if (offerSubsidiesList.length === 0) {
      subSelect.innerHTML = `<option value="">-- No Subsidies Defined inside Settings --</option>`;
    } else {
      subSelect.innerHTML = `
        <option value="">-- No Subsidy Selected --</option>
        ${offerSubsidiesList.map((sub, idx) => `
          <option value="${idx}">${sub.kw} KW (State: ₹${Number(sub.state).toLocaleString('en-IN')}, Central: ₹${Number(sub.central).toLocaleString('en-IN')})</option>
        `).join('')}
      `;
    }
    subSelect.addEventListener('change', recalculateOffer);
  }
}

function renderProductSelectionList(preCheckedProducts) {
  const container = document.getElementById('productSetsSelectContainer');
  if (!container) return;

  const products = DB.getAll('products');
  const itemsMap = DB.getAll('product_items');

  container.innerHTML = products.map((p, index) => {
    const isChecked = preCheckedProducts.includes(p.ProductName);
    const items = itemsMap.filter(it => it.ProductName === p.ProductName);
    const collapseId = `offerCollapseProduct_${index}`;

    return `
      <div class="border rounded bg-white shadow-sm" style="overflow:hidden;">
        <!-- Header -->
        <div class="d-flex align-items-center gap-2 p-2" style="background-color: #f8f9fa; border-bottom: 1px solid #e9ecef;">
          <!-- Checkbox -->
          <input class="form-check-input offer-product-chk" type="checkbox" value="${p.ProductName}" id="chk_${collapseId}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:1.05rem; height:1.05rem;">
          <!-- Label & Toggle -->
          <label class="form-check-label fw-bold text-dark flex-grow-1 mb-0 text-start" style="font-size:0.8rem; cursor:pointer;" onclick="toggleOfferProductAccordion('${collapseId}')">
            ${p.ProductName}
          </label>
          <span class="text-muted fs-8" id="icon_${collapseId}" onclick="toggleOfferProductAccordion('${collapseId}')" style="cursor:pointer;">▼</span>
        </div>
        <!-- Collapsible Content -->
        <div id="${collapseId}" class="p-2" style="display: none; background-color: #ffffff; border-top: 1px solid #e9ecef; font-size:0.75rem;">
          <ul class="list-unstyled mb-0 text-start ps-2 text-secondary">
            ${items.map(it => `<li>• ${it.ItemName} (Default: ₹${Number(it.Price).toLocaleString('en-IN')})</li>`).join('')}
            ${items.length === 0 ? `<li>No items inside this set</li>` : ''}
          </ul>
        </div>
      </div>
    `;
  }).join('');

  // Accordion toggle
  window.toggleOfferProductAccordion = function(collapseId) {
    const panel = document.getElementById(collapseId);
    const icon = document.getElementById('icon_' + collapseId);
    if (!panel) return;
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      if (icon) icon.textContent = '▲';
    } else {
      panel.style.display = 'none';
      if (icon) icon.textContent = '▼';
    }
  };

  // Bind change listeners to checkboxes
  document.querySelectorAll('.offer-product-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const pName = e.target.value;
      if (e.target.checked) {
        addProductSetRowsToGrid(pName);
      } else {
        removeProductSetRowsFromGrid(pName);
      }
    });
  });
}

function updateWorkspaceVisibility() {
  const workspace = document.getElementById('offerWorkspace');
  const placeholder = document.getElementById('selectProductSetPlaceholder');
  if (!workspace || !placeholder) return;

  const checkedCount = document.querySelectorAll('.offer-product-chk:checked').length;
  const customRowsCount = document.querySelectorAll('.quote-item-row[data-product=""]').length;

  if (checkedCount > 0 || customRowsCount > 0) {
    workspace.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    workspace.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

function addProductSetRowsToGrid(productName) {
  const tbody = document.getElementById('quoteTbody');
  if (!tbody) return;

  const items = DB.getAll('product_items').filter(it => it.ProductName === productName);
  if (items.length === 0) return;

  // 1. Add Group Header Row (Visible in print as well to show product packaging)
  const headerTr = document.createElement('tr');
  headerTr.className = 'quote-header-row table-secondary align-middle';
  headerTr.setAttribute('data-product', productName);
  headerTr.innerHTML = `
    <td colspan="4" class="py-2 text-start fw-bold text-dark bg-secondary-subtle">
      📦 Product Set: ${productName}
    </td>
    <td class="no-print text-center bg-secondary-subtle py-2">
      <button type="button" class="btn btn-xs btn-outline-danger py-0 px-2 fw-bold" onclick="removeProductSetFromHeader('${productName}')" title="Remove entire product set">✕</button>
    </td>
  `;
  tbody.appendChild(headerTr);

  // 2. Add Component Item Rows
  items.forEach(it => {
    const tr = document.createElement('tr');
    tr.className = 'quote-item-row';
    tr.setAttribute('data-product', productName);

    tr.innerHTML = `
      <td>
        <input type="text" class="form-control form-control-sm q-item-name fw-semibold border-0 p-0 text-start" value="${it.ItemName}">
      </td>
      <td>
        <input type="number" min="0" class="form-control form-control-sm q-qty text-center" value="1" style="width: 70px;">
      </td>
      <td>
        <input type="number" step="any" min="0" class="form-control form-control-sm q-price text-end font-monospace" value="${it.Price || 0}">
      </td>
      <td class="text-end fw-bold font-monospace align-middle q-total-val" style="font-size: 0.85rem;">
        ₹0.00
      </td>
      <td class="no-print text-center align-middle">
        <span class="text-danger fw-bold" style="cursor:pointer; font-size:0.9rem;" onclick="removeQuoteRow(this)">✕</span>
      </td>
    `;

    tbody.appendChild(tr);

    // Setup input change event listeners
    tr.querySelector('.q-qty').addEventListener('input', recalculateOffer);
    tr.querySelector('.q-price').addEventListener('input', recalculateOffer);
  });

  recalculateOffer();
  updateWorkspaceVisibility();
}

function removeProductSetRowsFromGrid(productName) {
  const rows = document.querySelectorAll(`[data-product="${productName}"]`);
  rows.forEach(row => row.remove());
  recalculateOffer();
  updateWorkspaceVisibility();
}

window.removeProductSetFromHeader = function(productName) {
  const chks = document.querySelectorAll('.offer-product-chk');
  chks.forEach(chk => {
    if (chk.value === productName) {
      chk.checked = false;
    }
  });
  removeProductSetRowsFromGrid(productName);
};

window.addQuoteRowDirect = function() {
  const tbody = document.getElementById('quoteTbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'quote-item-row';
  tr.setAttribute('data-product', ''); // blank for manual entries

  tr.innerHTML = `
    <td>
      <input type="text" class="form-control form-control-sm q-item-name fw-semibold border-0 p-0 text-start" placeholder="Custom Item Description *">
    </td>
    <td>
      <input type="number" min="0" class="form-control form-control-sm q-qty text-center" value="1" style="width: 70px;">
    </td>
    <td>
      <input type="number" step="any" min="0" class="form-control form-control-sm q-price text-end font-monospace" placeholder="0.00">
    </td>
    <td class="text-end fw-bold font-monospace align-middle q-total-val" style="font-size: 0.85rem;">
      ₹0.00
    </td>
    <td class="no-print text-center align-middle">
      <span class="text-danger fw-bold" style="cursor:pointer; font-size:0.9rem;" onclick="removeQuoteRow(this)">✕</span>
    </td>
  `;

  tbody.appendChild(tr);

  // Setup change listeners
  tr.querySelector('.q-qty').addEventListener('input', recalculateOffer);
  tr.querySelector('.q-price').addEventListener('input', recalculateOffer);
  tr.querySelector('.q-item-name').focus();

  recalculateOffer();
  updateWorkspaceVisibility();
};

window.removeQuoteRow = function (btn) {
  const tr = btn.closest('tr');
  if (tr) tr.remove();
  recalculateOffer();
  updateWorkspaceVisibility();
};

/* ── Dynamic Totals Adjustment Lines ──────────────────────────────────── */

function renderAdjustmentLines() {
  const container = document.getElementById('totalsDynamicLines');
  if (!container) return;

  let html = [];

  for (const [key, adj] of Object.entries(activeAdjustments)) {
    if (!adj.active) continue;

    const inputId = `adj_${key}`;
    const symbol = adj.sign;
    const isTax = adj.type === 'tax';
    const placeholder = isTax ? '0%' : '0.00';

    html.push(`
      <div class="col-6 text-start text-muted align-middle d-flex align-items-center gap-1 justify-content-between p-0">
        <div>
          <span class="no-print text-danger fw-bold me-1" style="cursor:pointer; font-size:0.85rem;" onclick="removeAdjustmentLine('${key}')" title="Remove row">✕</span>
          <span>${adj.label}</span>
        </div>
      </div>
      <div class="col-6 p-0 d-flex align-items-center gap-1 justify-content-end">
        <span class="fs-8 text-secondary fw-semibold font-monospace">${symbol}</span>
        <input type="number" step="any" min="0" class="form-control form-control-sm text-end font-monospace py-0 px-2 fw-semibold" id="${inputId}" value="${adj.value || ''}" placeholder="${placeholder}" style="height:26px; font-size:0.75rem; width: 100px;" oninput="updateAdjValue('${key}', this.value)">
      </div>
    `);
  }

  container.innerHTML = html.join('');
}

function updateAdjustmentButtonsUI() {
  for (const [key, adj] of Object.entries(activeAdjustments)) {
    const btn = document.getElementById('btnAdd_' + key);
    if (btn) {
      btn.style.display = adj.active ? 'none' : 'inline-block';
    }
  }
}

window.addAdjustmentLine = function(key) {
  if (activeAdjustments[key]) {
    activeAdjustments[key].active = true;
    renderAdjustmentLines();
    updateAdjustmentButtonsUI();
    recalculateOffer();
    
    // Focus the newly added input
    const input = document.getElementById(`adj_${key}`);
    if (input) input.focus();
  }
};

window.removeAdjustmentLine = function(key) {
  if (activeAdjustments[key]) {
    activeAdjustments[key].active = false;
    activeAdjustments[key].value = 0;
    renderAdjustmentLines();
    updateAdjustmentButtonsUI();
    recalculateOffer();
  }
};

window.updateAdjValue = function(key, val) {
  if (activeAdjustments[key]) {
    activeAdjustments[key].value = Number(val) || 0;
    recalculateOffer();
  }
};

/* ── Recalculation Engine ─────────────────────────────────────────────── */

function recalculateOffer() {
  const rows = document.querySelectorAll('.quote-item-row');
  let subtotal = 0;

  rows.forEach(row => {
    const qty = Number(row.querySelector('.q-qty').value) || 0;
    const price = Number(row.querySelector('.q-price').value) || 0;
    const itemTotal = qty * price;
    
    subtotal += itemTotal;

    row.querySelector('.q-total-val').textContent = '₹' + itemTotal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  });

  // Calculate dynamic adjustments sequentially
  let runningTotal = subtotal;
  let discountVal = 0;
  let taxableValue = subtotal;

  // 1. Calculate discount first to compute taxable value for tax calculation (CGST/SGST)
  if (activeAdjustments.discount.active) {
    discountVal = activeAdjustments.discount.value || 0;
    taxableValue = Math.max(0, subtotal - discountVal);
    runningTotal = taxableValue;
  }

  // 2. Calculate CGST/SGST based on taxable value
  let cgstAmount = 0;
  if (activeAdjustments.cgst.active) {
    const cgstPercent = activeAdjustments.cgst.value || 0;
    cgstAmount = (taxableValue * cgstPercent) / 100;
    runningTotal += cgstAmount;
  }

  let sgstAmount = 0;
  if (activeAdjustments.sgst.active) {
    const sgstPercent = activeAdjustments.sgst.value || 0;
    sgstAmount = (taxableValue * sgstPercent) / 100;
    runningTotal += sgstAmount;
  }

  // 3. Add other charges (rupee values)
  if (activeAdjustments.transport.active) {
    runningTotal += (activeAdjustments.transport.value || 0);
  }
  if (activeAdjustments.labour.active) {
    runningTotal += (activeAdjustments.labour.value || 0);
  }
  if (activeAdjustments.other.active) {
    runningTotal += (activeAdjustments.other.value || 0);
  }

  const grandTotal = Math.max(0, runningTotal);

  document.getElementById('lblOfferSubtotal').textContent = UI.money(subtotal);
  document.getElementById('lblOfferGrandTotal').textContent = UI.money(grandTotal);

  // Update screen table tfoot values
  const tblSub = document.getElementById('tblSubtotalVal');
  const tblGrand = document.getElementById('tblGrandTotalVal');
  const tblNetRow = document.getElementById('tblNetPayableRow');
  const tblNetVal = document.getElementById('tblNetPayableVal');

  if (tblSub) tblSub.textContent = UI.money(subtotal);
  if (tblGrand) tblGrand.textContent = UI.money(grandTotal);

  // Apply Government Subsidy - Display Info & Net Payable Calculation
  const subSelect = document.getElementById('qSubsidySelect');
  const subsidySummary = document.getElementById('subsidySummaryLines');
  
  let stateAmt = 0;
  let centralAmt = 0;
  
  if (subSelect && subSelect.value !== '') {
    const selectedIndex = Number(subSelect.value);
    const sub = offerSubsidiesList[selectedIndex];
    if (sub) {
      stateAmt = sub.state || 0;
      centralAmt = sub.central || 0;
      const totalSubsidy = stateAmt + centralAmt;
      const netPayable = Math.max(0, grandTotal - totalSubsidy);
      
      document.getElementById('lblStateSubsidy').textContent = `₹` + stateAmt.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      });
      document.getElementById('lblCentralSubsidy').textContent = `₹` + centralAmt.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      });
      const lblTotalSub = document.getElementById('lblTotalSubsidy');
      if (lblTotalSub) lblTotalSub.textContent = UI.money(totalSubsidy);

      const lblNet = document.getElementById('lblNetPayable');
      if (lblNet) lblNet.textContent = UI.money(netPayable);
      
      if (subsidySummary) subsidySummary.style.display = 'block';

      if (tblNetRow) tblNetRow.style.display = 'table-row';
      if (tblNetVal) tblNetVal.textContent = UI.money(netPayable);
    }
  } else {
    if (subsidySummary) subsidySummary.style.display = 'none';
    if (tblNetRow) tblNetRow.style.display = 'none';
  }



}

function getPngLogoDataUrl(src) {
  return new Promise(resolve => {
    if (!src || src === window.location.href) return resolve('');
    if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) {
      return resolve(src);
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 320;
        canvas.height = img.naturalHeight || img.height || 130;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

window.exportQuotationToDocx = async function() {
  const custNameInput = document.getElementById('qCustName');
  const custName = custNameInput ? custNameInput.value.trim() : '';

  if (!custName) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Please enter the customer name before generating Word Document.', 'warning');
    }
    const collapseAddr = document.getElementById('collapseAddresses');
    const iconAddr = document.getElementById('iconAddresses');
    if (collapseAddr && collapseAddr.style.display === 'none') {
      collapseAddr.style.display = 'block';
      if (iconAddr) iconAddr.textContent = '▲';
    }
    if (custNameInput) custNameInput.focus();
    return;
  }

  if (!window.docx) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Word Document generation library (docx.js) is not loaded yet. Please check your internet connection or try again.', 'error');
    }
    return;
  }

  // 1. Synchronize print labels first
  syncPrintLabels();

  // Helper to convert base64 image data URLs to Uint8Array for docx.js
  function base64ToArrayBuffer(base64WithHeader) {
    let base64 = base64WithHeader;
    const commaIdx = base64.indexOf(',');
    if (commaIdx !== -1) {
      base64 = base64.substring(commaIdx + 1);
    }
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Extract classes from global docx namespace
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    ImageRun,
    VerticalAlign
  } = window.docx;

  // Process Seller Logo: Convert SVG/other formats to PNG base64
  let validLogoPng = '';
  const settings = DB.getAll('settings');
  const logoBase64 = (settings.find(s => s.Key === 'CompanyLogo') || {}).Value;
  const rawLogoSrc = logoBase64 || DEFAULT_SOLAR_LOGO;
  try {
    validLogoPng = await getPngLogoDataUrl(rawLogoSrc);
  } catch (err) {
    console.error("Error generating PNG logo url:", err);
  }

  // Define total table printable width in DXA (1 twip = 1/20 pt. Total ~ 10400 DXA for A4 print area)
  const TOTAL_TABLE_WIDTH = 10400;

  // --- 1. SELLER & QUOTATION METADATA TABLE ---
  const sellerParagraphs = [];
  if (validLogoPng) {
    try {
      const logoBuffer = base64ToArrayBuffer(validLogoPng);
      sellerParagraphs.push(new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: {
              width: 130,
              height: 50
            }
          })
        ],
        spacing: { after: 120 }
      }));
    } catch (err) {
      console.error("Error decoding logo for Word document:", err);
    }
  }

  sellerParagraphs.push(new Paragraph({
    children: [new TextRun({ text: document.getElementById('printSellerName').textContent || 'SHRI TRUTIYADEV SOLAR ENTERPRISES', bold: true, size: 24, font: "Times New Roman" })],
    spacing: { after: 80 }
  }));

  // Add Seller Address
  const sellerAddrText = document.getElementById('qOfficeAddress').value || '';
  sellerAddrText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    sellerParagraphs.push(new Paragraph({
      children: [new TextRun({ text: line, size: 20, font: "Times New Roman" })],
      spacing: { after: 30 }
    }));
  });

  // Add Seller Contacts
  const sellerContactsText = document.getElementById('printSellerContacts').innerText || '';
  sellerContactsText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    sellerParagraphs.push(new Paragraph({
      children: [new TextRun({ text: line, size: 20, font: "Times New Roman" })],
      spacing: { after: 30 }
    }));
  });

  // GSTIN
  const gstinText = document.getElementById('printSellerGSTIN').textContent || '';
  if (gstinText.trim()) {
    sellerParagraphs.push(new Paragraph({
      children: [new TextRun({ text: gstinText.trim(), bold: true, size: 20, font: "Times New Roman" })],
      spacing: { before: 80 }
    }));
  }

  // Nested Quotation Metadata Table (Right Column)
  const metaRows = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Quotation No.", bold: true, size: 20, font: "Times New Roman" })] })],
          width: { size: 1965, type: WidthType.DXA }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printQuoteNo').textContent || '-', size: 20, font: "Times New Roman" })] })],
          width: { size: 2403, type: WidthType.DXA }
        })
      ]
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Dated", bold: true, size: 20, font: "Times New Roman" })] })],
          width: { size: 1965, type: WidthType.DXA }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printQuoteDate').textContent || '-', size: 20, font: "Times New Roman" })] })],
          width: { size: 2403, type: WidthType.DXA }
        })
      ]
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Validity", bold: true, size: 20, font: "Times New Roman" })] })],
          width: { size: 1965, type: WidthType.DXA }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "10 Days", size: 20, font: "Times New Roman" })] })],
          width: { size: 2403, type: WidthType.DXA }
        })
      ]
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Delivery Date", bold: true, size: 20, font: "Times New Roman" })] })],
          width: { size: 1965, type: WidthType.DXA }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printDeliveryDate').textContent || '-', size: 20, font: "Times New Roman" })] })],
          width: { size: 2403, type: WidthType.DXA }
        })
      ]
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Payment Terms", bold: true, size: 20, font: "Times New Roman" })] })],
          width: { size: 1965, type: WidthType.DXA }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printPaymentTerms').textContent || '-', size: 20, font: "Times New Roman" })] })],
          width: { size: 2403, type: WidthType.DXA }
        })
      ]
    })
  ];

  const metaTable = new Table({
    width: { size: 4368, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: metaRows,
    margins: { top: 60, bottom: 60, left: 0, right: 0 }
  });

  const mainSellerQuoteTable = new Table({
    width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: sellerParagraphs,
            width: { size: 6032, type: WidthType.DXA }
          }),
          new TableCell({
            children: [metaTable],
            width: { size: 4368, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP
          })
        ]
      })
    ],
    margins: { top: 120, bottom: 120, left: 160, right: 160 }
  });


  // --- 2. BUYER INFORMATION BLOCK ---
  const buyerParagraphs = [];
  const buyerNameVal = document.getElementById('printBuyerName').textContent || '-';
  buyerParagraphs.push(new Paragraph({
    children: [
      new TextRun({ text: "Buyer: ", bold: true, size: 21, font: "Times New Roman" }),
      new TextRun({ text: buyerNameVal, bold: true, size: 23, font: "Times New Roman" })
    ],
    spacing: { before: 180, after: 40 }
  }));

  const buyerMobileVal = document.getElementById('printBuyerMobile').textContent || '';
  const isBuyerMobileVisible = document.getElementById('printBuyerMobileWrapper')?.style.display !== 'none';
  if (buyerMobileVal && isBuyerMobileVisible) {
    buyerParagraphs.push(new Paragraph({
      children: [
        new TextRun({ text: "Mobile: ", bold: true, size: 21, font: "Times New Roman" }),
        new TextRun({ text: buyerMobileVal, bold: true, size: 21, font: "Times New Roman" })
      ],
      spacing: { after: 40 }
    }));
  }

  const buyerAddrVal = document.getElementById('qCustAddress').value || '-';
  const buyerAddrLines = buyerAddrVal.split('\n').map(l => l.trim()).filter(Boolean);
  buyerParagraphs.push(new Paragraph({
    children: [
      new TextRun({ text: "Address: ", bold: true, size: 21, font: "Times New Roman" }),
      new TextRun({ text: buyerAddrLines.join(', '), size: 21, font: "Times New Roman" })
    ],
    spacing: { after: 180 }
  }));


  // --- 3. DYNAMIC ITEMS TABLE GENERATION ---
  const quoteRows = document.querySelectorAll('.quote-item-row');
  let subtotal = 0;
  quoteRows.forEach(row => {
    const qty = Number(row.querySelector('.q-qty').value) || 0;
    const price = Number(row.querySelector('.q-price').value) || 0;
    subtotal += (qty * price);
  });

  let discountVal = 0;
  let taxableValue = subtotal;
  if (activeAdjustments.discount.active) {
    discountVal = activeAdjustments.discount.value || 0;
    taxableValue = Math.max(0, subtotal - discountVal);
  }

  const cgstActive = activeAdjustments.cgst.active;
  const cgstRate = cgstActive ? activeAdjustments.cgst.value : 0;
  const sgstActive = activeAdjustments.sgst.active;
  const sgstRate = sgstActive ? activeAdjustments.sgst.value : 0;

  let cgstAmount = 0;
  if (cgstActive) cgstAmount = (taxableValue * cgstRate) / 100;
  let sgstAmount = 0;
  if (sgstActive) sgstAmount = (taxableValue * sgstRate) / 100;

  let otherCharges = 0;
  if (activeAdjustments.transport.active) otherCharges += activeAdjustments.transport.value || 0;
  if (activeAdjustments.labour.active) otherCharges += activeAdjustments.labour.value || 0;
  if (activeAdjustments.other.active) otherCharges += activeAdjustments.other.value || 0;

  const grandTotal = Math.max(0, taxableValue + cgstAmount + sgstAmount + otherCharges);

  let printRows = [];
  quoteRows.forEach(row => {
    const itemName = row.querySelector('.q-item-name').value.trim();
    const qty = Number(row.querySelector('.q-qty').value) || 1;
    const price = Number(row.querySelector('.q-price').value) || 0;
    printRows.push({ type: 'item', desc: itemName, qty: `${qty} SET`, price: price });
  });

  if (activeAdjustments.discount.active && discountVal > 0) {
    printRows.push({ type: 'adj', desc: 'Less: Discount', qty: '-', price: -discountVal });
  }
  if (activeAdjustments.transport.active && activeAdjustments.transport.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Transportation Charges', qty: '-', price: activeAdjustments.transport.value });
  }
  if (activeAdjustments.labour.active && activeAdjustments.labour.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Labour Charges', qty: '-', price: activeAdjustments.labour.value });
  }
  if (activeAdjustments.other.active && activeAdjustments.other.value > 0) {
    printRows.push({ type: 'adj', desc: 'Add: Other Charges', qty: '-', price: activeAdjustments.other.value });
  }
  if (cgstActive && cgstAmount > 0) {
    printRows.push({ type: 'adj', desc: `Add: CGST (${cgstRate}%)`, qty: '-', price: cgstAmount });
  }
  if (sgstActive && sgstAmount > 0) {
    printRows.push({ type: 'adj', desc: `Add: SGST (${sgstRate}%)`, qty: '-', price: sgstAmount });
  }

  // Header Row (5 Columns)
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Sl No", bold: true, size: 21, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 624, type: WidthType.DXA },
        shading: { fill: "F2F2F2" },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Description of Goods", bold: true, size: 21, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 5616, type: WidthType.DXA },
        shading: { fill: "F2F2F2" },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Qty.", bold: true, size: 21, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 1040, type: WidthType.DXA },
        shading: { fill: "F2F2F2" },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Unit Price (₹)", bold: true, size: 21, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 1560, type: WidthType.DXA },
        shading: { fill: "F2F2F2" },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Total Value (₹)", bold: true, size: 21, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 1560, type: WidthType.DXA },
        shading: { fill: "F2F2F2" },
        verticalAlign: VerticalAlign.CENTER
      })
    ]
  });

  const docTableRows = [headerRow];

  printRows.forEach((r, idx) => {
    const slNo = r.type === 'item' ? (idx + 1).toString() : '';
    
    let unitPriceText = '-';
    let totalValueText = '';
    
    if (r.type === 'item') {
      unitPriceText = `₹${r.price.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
      const numericQty = Number(r.qty.replace(/[^0-9]/g, '')) || 1;
      totalValueText = `₹${(numericQty * r.price).toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    } else {
      totalValueText = r.price < 0 ? `-₹${Math.abs(r.price).toLocaleString('en-IN', {minimumFractionDigits:2})}` : `₹${r.price.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    }
    
    const cells = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: slNo, size: 20, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 624, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: r.desc, size: 20, font: "Times New Roman", italic: r.type === 'adj', bold: r.type === 'adj' })], alignment: AlignmentType.LEFT })],
        width: { size: 5616, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: r.qty, size: 20, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        width: { size: 1040, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: unitPriceText, size: 20, font: "Times New Roman" })], alignment: AlignmentType.RIGHT })],
        width: { size: 1560, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: totalValueText, size: 20, font: "Times New Roman", bold: r.type === 'adj' })], alignment: AlignmentType.RIGHT })],
        width: { size: 1560, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER
      })
    ];
    
    docTableRows.push(new TableRow({ children: cells }));
  });

  // Grand Total Row
  const totalRowCells = [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: "", size: 20, font: "Times New Roman" })] })],
      width: { size: 624, type: WidthType.DXA },
      shading: { fill: "FAFAFA" }
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: "Grand Total", bold: true, size: 20, font: "Times New Roman" })], alignment: AlignmentType.LEFT })],
      width: { size: 5616, type: WidthType.DXA },
      shading: { fill: "FAFAFA" }
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: "", size: 20, font: "Times New Roman" })] })],
      width: { size: 1040, type: WidthType.DXA },
      shading: { fill: "FAFAFA" }
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: "", size: 20, font: "Times New Roman" })] })],
      width: { size: 1560, type: WidthType.DXA },
      shading: { fill: "FAFAFA" }
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, bold: true, size: 20, font: "Times New Roman" })], alignment: AlignmentType.RIGHT })],
      width: { size: 1560, type: WidthType.DXA },
      shading: { fill: "FAFAFA" }
    })
  ];

  docTableRows.push(new TableRow({ children: totalRowCells }));

  const itemsTable = new Table({
    width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
    },
    rows: docTableRows,
    margins: { top: 80, bottom: 80, left: 100, right: 100 }
  });


  // --- 4. SPECIAL NOTES BOX ---
  const notesParagraphs = [];
  const specialNotesBox = document.getElementById('printSpecialNotesBox');
  if (specialNotesBox) {
    const noteDivs = specialNotesBox.querySelectorAll('div');
    noteDivs.forEach(div => {
      const txt = div.textContent.trim();
      if (txt) {
        notesParagraphs.push(new Paragraph({
          children: [new TextRun({ text: txt, size: 19, font: "Times New Roman", color: "111111" })],
          spacing: { after: 30 }
        }));
      }
    });
  }


  // --- 5. AMOUNT IN WORDS ---
  const amtInWordsText = document.getElementById('printAmountInWords').textContent || '';
  const amountParagraph = new Paragraph({
    children: [new TextRun({ text: amtInWordsText.trim(), bold: true, size: 21, font: "Times New Roman" })],
    spacing: { before: 120, after: 120 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
    }
  });


  // --- 6. SUBSIDY DETAILS & COMPANY BANK DETAILS TABLE ---
  const printSubsidyCell = document.getElementById('printSubsidyCell');
  const isSubsidyVisible = printSubsidyCell && printSubsidyCell.style.display !== 'none';

  let bottomBlockTable;

  // Reusable Bank & Declaration list
  const declBankParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: "Declaration:", bold: true, size: 21, font: "Times New Roman" })],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "1. This quotation shows the actual price of goods described; all particulars are true and correct.", size: 18, font: "Times New Roman" })],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "2. Advance to be paid within 7 days of quotation date, else price may vary as per company revision.", size: 18, font: "Times New Roman" })],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "3. All disputes subject to Bhubaneswar jurisdiction only.", size: 18, font: "Times New Roman" })],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "4. Products once sold cannot be returned.", size: 18, font: "Times New Roman" })],
      spacing: { after: 80 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "Company's Bank Details", bold: true, size: 21, font: "Times New Roman" })],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Bank Name: ", bold: true, size: 19, font: "Times New Roman" }),
        new TextRun({ text: document.getElementById('printBankName').textContent || '-', size: 19, font: "Times New Roman" })
      ],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "A/C Holder: ", bold: true, size: 19, font: "Times New Roman" }),
        new TextRun({ text: document.getElementById('printBankAcHolder').textContent || '-', size: 19, font: "Times New Roman" })
      ],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "A/C No.: ", bold: true, size: 19, font: "Times New Roman" }),
        new TextRun({ text: document.getElementById('printBankAcNo').textContent || '-', size: 19, font: "Times New Roman" })
      ],
      spacing: { after: 20 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Branch & IFSC: ", bold: true, size: 19, font: "Times New Roman" }),
        new TextRun({ text: document.getElementById('printBankBranchIFS').textContent || '-', size: 19, font: "Times New Roman" })
      ],
      spacing: { after: 20 }
    })
  ];

  if (isSubsidyVisible) {
    const subsidyRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Per KW", bold: true, size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Central Subsidy", bold: true, size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "State Subsidy", bold: true, size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Total Subsidy", bold: true, size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            shading: { fill: "f2f2f2" },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printSubPerKW').textContent || '-', size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printSubCentral').textContent || '-', size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printSubState').textContent || '-', size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: document.getElementById('printSubTotal').textContent || '-', bold: true, size: 18, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            width: { size: 1248, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      })
    ];

    const innerSubsidyTable = new Table({
      width: { size: 4992, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
      },
      rows: subsidyRows,
      margins: { top: 60, bottom: 60, left: 60, right: 60 }
    });

    const subsidyCellParagraphs = [
      new Paragraph({
        children: [new TextRun({ text: "Subsidy Scheme as per MNRE", bold: true, size: 21, font: "Times New Roman" })],
        spacing: { after: 100 }
      }),
      innerSubsidyTable
    ];

    bottomBlockTable = new Table({
      width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: subsidyCellParagraphs,
              width: { size: 4992, type: WidthType.DXA }
            }),
            new TableCell({
              children: declBankParagraphs,
              width: { size: 5408, type: WidthType.DXA }
            })
          ]
        })
      ],
      margins: { top: 120, bottom: 120, left: 160, right: 160 }
    });
  } else {
    bottomBlockTable = new Table({
      width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: declBankParagraphs,
              width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA }
            })
          ]
        })
      ],
      margins: { top: 120, bottom: 120, left: 160, right: 160 }
    });
  }


  // --- 7. SIGNATURE BLOCK ---
  const signCompName = document.getElementById('printSignCompanyName').textContent || 'SHRI TRUTIYADEV SOLAR ENTERPRISES';
  const sigParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: `for ${signCompName.toUpperCase()}`, bold: true, size: 21, font: "Times New Roman" })],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240, after: 120 }
    }),
    new Paragraph({ children: [], spacing: { before: 480 } }), // space for signature
    new Paragraph({
      children: [new TextRun({ text: "/Authorized Signatory", bold: true, size: 21, font: "Times New Roman" })],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 120 }
    })
  ];


  // --- 8. COMPUTER-GENERATED COPY FOOTER ---
  const footerParagraph = new Paragraph({
    children: [new TextRun({ text: "This is a Computer-Generated Copy", italic: true, size: 21, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "000000" }
    }
  });


  // --- 9. CONSTRUCT COMPLETE DOCUMENT ---
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            bottom: 720,
            left: 720,
            right: 720
          }
        }
      },
      children: [
        // Title block
        new Paragraph({
          children: [new TextRun({ text: "QUOTATION", bold: true, size: 36, font: "Times New Roman" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: document.getElementById('printHeadingTitle').textContent || '', bold: true, size: 24, font: "Times New Roman" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "(ORIGINAL FOR RECIPIENT)", italic: true, size: 19, font: "Times New Roman" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 }
        }),

        // Main Metadata & Company Details Table
        mainSellerQuoteTable,

        // Spacer
        new Paragraph({ children: [], spacing: { before: 120 } }),

        // Buyer Information
        ...buyerParagraphs,

        // Items Grid Table
        itemsTable,

        // Spacer & Special Notes
        ...notesParagraphs,

        // Amount in Words line
        amountParagraph,

        // Spacer
        new Paragraph({ children: [], spacing: { before: 120 } }),

        // Subsidy / Bank & Declaration Table
        bottomBlockTable,

        // Sign Box
        ...sigParagraphs,

        // Computer-Generated Footer
        footerParagraph
      ]
    }]
  });

  // Save the modern A4 .docx file
  const quoteNo = document.getElementById('qQuoteNo').value.trim() || 'TR01';
  const cleanCustName = custName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Quotation_${quoteNo}_${cleanCustName}.docx`;

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(`Quotation Word document (.docx) generated & downloaded successfully!`, 'success');
    }
  }).catch(err => {
    console.error("docx packing error:", err);
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Failed to package Word Document. Please check console logs.', 'error');
    }
  });
};

