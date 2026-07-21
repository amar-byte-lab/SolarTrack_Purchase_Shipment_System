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
    window.print();
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
      document.getElementById('printSubPerKW').textContent = `For ${sub.kw} KW`;
      document.getElementById('printSubCentral').textContent = Number(sub.central).toLocaleString('en-IN');
      document.getElementById('printSubState').textContent = Number(sub.state).toLocaleString('en-IN');
      
      const totalSub = (sub.central || 0) + (sub.state || 0);
      document.getElementById('printSubTotal').textContent = `Rs ${totalSub.toLocaleString('en-IN')}`;
      
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

  // 1. Synchronize print labels first
  syncPrintLabels();

  const templateEl = document.getElementById('printQuotationTemplate');
  if (!templateEl) return;

  const clone = templateEl.cloneNode(true);
  clone.classList.remove('d-none', 'd-print-block');

  // 2. Process Seller Logo: Convert SVG to PNG for Word compatibility
  const cloneLogo = clone.querySelector('#printSellerLogo');
  let validLogoPng = '';
  if (cloneLogo) {
    const settings = DB.getAll('settings');
    const logoBase64 = (settings.find(s => s.Key === 'CompanyLogo') || {}).Value;
    const rawLogoSrc = logoBase64 || DEFAULT_SOLAR_LOGO;
    validLogoPng = await getPngLogoDataUrl(rawLogoSrc);
  }

  // 3. Replace flexbox header with Word-compatible table layout so Logo and Seller Name align side-by-side
  const flexHeader = clone.querySelector('#printSellerName')?.closest('.d-flex');
  const sellerNameText = clone.querySelector('#printSellerName')?.textContent || 'SHRI TRUTIYADEV SOLAR ENTERPRISES';
  
  if (flexHeader) {
    if (validLogoPng) {
      flexHeader.outerHTML = `
        <table style="border:none !important; border-collapse:collapse !important; width:100% !important; margin:0 0 6pt 0 !important; padding:0 !important;">
          <tr>
            <td style="border:none !important; padding:0 10pt 0 0 !important; vertical-align:middle !important; width:95pt !important;">
              <img src="${validLogoPng}" width="95" height="55" style="width:95pt; height:55pt; display:block;">
            </td>
            <td style="border:none !important; padding:0 !important; vertical-align:middle !important;">
              <div style="font-size:12.5pt !important; font-weight:bold !important; color:#000000 !important; text-align:left !important;">${sellerNameText}</div>
            </td>
          </tr>
        </table>
      `;
    } else {
      flexHeader.outerHTML = `<div style="font-size:12.5pt !important; font-weight:bold !important; color:#000000 !important; text-align:left !important; margin-bottom:6pt !important;">${sellerNameText}</div>`;
    }
  }

  // 4. Process Stamp Image: Convert to PNG if available, else remove empty img
  const cloneStamp = clone.querySelector('#printStampImage');
  if (cloneStamp) {
    if (cloneStamp.src && cloneStamp.src.startsWith('data:image')) {
      const pngStamp = await getPngLogoDataUrl(cloneStamp.src);
      if (pngStamp) {
        cloneStamp.src = pngStamp;
      } else {
        cloneStamp.remove();
      }
    } else {
      cloneStamp.remove();
    }
  }

  // 5. Remove any empty or hidden <img> tags to prevent Word invalid file reference errors
  const allImgs = clone.querySelectorAll('img');
  allImgs.forEach(img => {
    if (!img.getAttribute('src') || img.getAttribute('src') === '' || img.style.display === 'none') {
      img.remove();
    }
  });

  // 6. Ensure Subsidy & Bank/Declaration table cell widths match display state
  const subsidyCell = clone.querySelector('#printSubsidyCell');
  if (subsidyCell && (subsidyCell.style.display === 'none' || getComputedStyle(subsidyCell).display === 'none')) {
    const nextCell = subsidyCell.nextElementSibling;
    subsidyCell.remove();
    if (nextCell) {
      nextCell.style.width = '100%';
      nextCell.setAttribute('width', '100%');
    }
  }

  const quoteNo = document.getElementById('qQuoteNo').value.trim() || 'TR01';
  const cleanCustName = custName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Quotation_${quoteNo}_${cleanCustName}.doc`;

  const wordHtml = `
    <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Quotation ${quoteNo}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 595.3pt 841.9pt;
          margin: 36.0pt 36.0pt 36.0pt 36.0pt;
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        body {
          font-family: 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.4;
          color: #000000;
          background-color: #ffffff;
        }
        table {
          border-collapse: collapse !important;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          width: 100% !important;
          margin-bottom: 12pt;
        }
        td, th {
          border: 1.0pt solid #000000 !important;
          padding: 6pt 8pt !important;
          vertical-align: top !important;
          font-size: 11pt !important;
        }
        th {
          background-color: #F2F2F2 !important;
          font-weight: bold !important;
          text-align: center !important;
          font-size: 11.5pt !important;
        }
        .text-center { text-align: center !important; }
        .text-start { text-align: left !important; }
        .text-end { text-align: right !important; }
        .fw-bold { font-weight: bold !important; }
        ol { margin-top: 2pt; margin-bottom: 6pt; padding-left: 16pt; }
        li { margin-bottom: 2pt; }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${clone.innerHTML}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordHtml], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (typeof UI !== 'undefined' && UI.toast) {
    UI.toast(`Quotation Word document (.doc) generated & downloaded successfully!`, 'success');
  }
};
