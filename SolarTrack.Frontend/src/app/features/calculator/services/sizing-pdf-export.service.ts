import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { CalculatorService } from './calculator.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ApplianceItem, FullSizingResult, BatterySelectionResult } from '../models/calculator.model';

export interface CustomerProposalInfo {
  customerName?: string;
  customerPhone?: string;
  consumerNo?: string;
  location?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SizingPdfExportService {
  private calc = inject(CalculatorService);
  private settingsService = inject(SettingsService);

  /**
   * Helper to load an image from URL into HTMLImageElement
   */
  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /**
   * Returns a comprehensive technical specification for an appliance written in full words,
   * incorporating Rating (e.g. BEE Star Rating), Technology, and Capacity as considered
   * in the Standard Load calculation model.
   */
  private getApplianceSpecification(app: ApplianceItem): string {
    const id = app.id?.toLowerCase() || '';
    const name = app.name?.toLowerCase() || '';
    const p = app.calcParams || {};
    const acConf = this.calc.acConfig();
    const pumpConf = this.calc.pumpConfig();

    // 1. Air Conditioner (AC)
    if (id === 'ac' || name.includes('ac') || name.includes('conditioner')) {
      const ton = app.acTon || acConf?.ton || p['ton'] || '1.5';
      const star = p['starRating'] || '3';
      const rawTech = app.acType || acConf?.acType || p['technology'] || 'inverter';
      const techStr = rawTech === 'inverter' ? 'Dual Inverter' : 'Fixed Speed';
      return `${ton} Ton | ${star}-Star BEE | ${techStr}`;
    }

    // 2. Refrigerator
    if (id === 'fridge' || name.includes('fridge') || name.includes('refrigerator')) {
      const cap = p['capacityL'] || '240';
      const star = p['starRating'] || '3';
      const comp = (p['compressorType'] || 'inverter') === 'inverter' ? 'Inverter' : 'Standard';
      return `${cap}L | ${star}-Star BEE | Frost-Free ${comp}`;
    }

    // 3. Water Pump
    if (id === 'pump' || name.includes('pump') || name.includes('water pump')) {
      const hp = app.pumpHp || pumpConf?.pumpHp || p['motorHp'] || '1.0';
      const pumpType = p['pumpType'] === 'submersible' ? 'Submersible' : 'Monoblock';
      const eff = p['motorEfficiency'] || 70;
      return `${hp} HP | ${pumpType} (${eff}% Eff, 25m Head)`;
    }

    // 4. Ceiling Fan
    if (id === 'fan' || name.includes('fan')) {
      const isBldc = p['fanType'] === 'bldc';
      if (isBldc) {
        return '1200 mm | 5-Star BLDC Motor (32W)';
      }
      return '1200 mm Sweep | Standard Induction (55W)';
    }

    // 5. Television (TV)
    if (id === 'tv' || name.includes('tv') || name.includes('television')) {
      const size = p['screenSize'] || '43';
      const disp = (p['displayType'] || 'led').toUpperCase();
      const res = (p['resolution'] || '4k').toUpperCase();
      return `${size} Inch | ${res} UHD | Smart ${disp} Display`;
    }

    // 6. Washing Machine
    if (id === 'wm' || name.includes('washing')) {
      const kg = p['capacityKg'] || '7.0';
      const wmType = p['wmType'] === 'frontLoad' ? 'Front Load' : (p['wmType'] === 'semi' ? 'Semi-Auto' : 'Top Load');
      return `${kg} Kg | Fully-Automatic ${wmType}`;
    }

    // 7. Geyser / Water Heater
    if (id === 'geyser' || name.includes('geyser') || name.includes('heater')) {
      const cap = p['capacityL'] || '15';
      const w = p['ratedWatts'] || app.watts || 2000;
      return `${cap} Liters Storage | ${w}W Element (BEE)`;
    }

    // 8. Computer / Laptop
    if (id === 'comp' || name.includes('computer') || name.includes('laptop')) {
      const dev = p['deviceType'] === 'desktop' ? 'Desktop PC' : 'Laptop Notebook';
      const gpu = p['gpuType'] === 'dedicatedHigh' ? 'Dedicated GPU' : (p['gpuType'] === 'dedicatedMid' ? 'Mid GPU' : 'Integrated Graphics');
      return `${dev} | ${gpu} (Standard Core)`;
    }

    // 9. Induction Cooker
    if (id === 'induction' || name.includes('induction')) {
      const w = p['ratedWatts'] || app.watts || 2000;
      return `${w} Watts | Smart Induction (IGBT Tech)`;
    }

    // 10. Electric Iron
    if (id === 'iron' || name.includes('iron')) {
      const type = p['ironType'] === 'steam' ? 'Steam Press' : 'Heavy Dry Press';
      const w = p['ratedWatts'] || app.watts || 1000;
      return `${type} | ${w}W with Thermostat Auto-Cut`;
    }

    // 11. LED Lighting
    if (id === 'led' || name.includes('led') || name.includes('light')) {
      const w = p['bulbWatts'] || app.watts || 10;
      return `${w} Watts | High-Lumen B22 Solid-State LED`;
    }

    // 12. Cooler / Microwave / RO / Other Custom
    if (name.includes('cooler')) {
      return 'Desert Air Cooler | Honeycomb Pads (150W)';
    }
    if (name.includes('microwave') || name.includes('oven')) {
      return '20-28 Liters | Convection Microwave (1200W)';
    }
    if (name.includes('ro') || name.includes('purifier')) {
      return 'Multi-Stage RO + UV Water Purifier (50W)';
    }
    if (app.ratedWatts && app.ratedWatts > app.watts) {
      return `${app.ratedWatts}W Rated | ${app.watts}W Operating Load`;
    }

    return `${app.watts} Watts | Standard Continuous Duty Load`;
  }

  /**
   * Generates a 1-Page Customer Solar Proposal Pamphlet with:
   * - Beautiful Sky with Clouds full-page background
   * - Bright, clean, premium header with Company Logo
   * - Full words throughout with NO abbreviations (Bank Specification, Maintenance, Water Top-Up Required, etc.)
   * - Vector Mobile & Email icons (No GST, No unreadable special chars)
   * - Appliances & Specifications with individual rated power & daily hours
   * - Solar & Inverter Specs, and 3 Battery Options
   */
  async generateCustomerSummaryPdf(custInfo?: CustomerProposalInfo): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const settings = this.settingsService.settings();
    const result: FullSizingResult = this.calc.result();

    const companyName = (settings.companyName || 'Shri Trutiyadev Solar Enterprises').trim();
    const companyPhone = (settings.companyPhone || '8763443172').trim();
    const companyEmail = (settings.companyEmail || 'shritrutiyadevsolar@gmail.com').trim();
    const customerName = custInfo?.customerName?.trim() || 'Valued Solar Customer';

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 8;
    const contentWidth = pageWidth - (marginX * 2); // 194mm

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    // Try to load company logo
    const logoImg = await this.loadImage('assets/sampleFiles/CompanyLogo.jpeg') ||
                    await this.loadImage('assets/sampleFiles/LogoWithoutLetter.png');

    // ==========================================
    // 1. SKY WITH CLOUDS FULL PAGE BACKGROUND
    // ==========================================
    const stepH = 2.5;
    for (let y = 0; y < pageHeight; y += stepH) {
      const t = y / pageHeight; // 0 (top) to 1 (bottom)
      let r = 172 + (248 - 172) * Math.pow(t, 0.7);
      let g = 218 + (252 - 218) * Math.pow(t, 0.7);
      let b = 251 + (255 - 251) * Math.pow(t, 0.7);
      doc.setFillColor(Math.round(r), Math.round(g), Math.round(b));
      doc.rect(0, y, pageWidth, stepH + 0.2, 'F');
    }

    // Draw soft, fluffy clouds in the background
    this.drawFluffyCloud(doc, 45, 18, 1.4);
    this.drawFluffyCloud(doc, 175, 25, 1.2);
    this.drawFluffyCloud(doc, 20, 115, 1.1);
    this.drawFluffyCloud(doc, 190, 135, 1.3);
    this.drawFluffyCloud(doc, 50, 220, 1.5);
    this.drawFluffyCloud(doc, 165, 240, 1.2);

    // Subtle Company Name Watermark
    doc.saveGraphicsState();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(195, 224, 248);

    doc.text(companyName.toUpperCase(), pageWidth / 2, 98, {
      align: 'center',
      angle: 30
    });
    doc.text(companyName.toUpperCase(), pageWidth / 2, 202, {
      align: 'center',
      angle: 30
    });
    doc.restoreGraphicsState();

    // ==========================================
    // 2. BRIGHT & ELEGANT PAMPHLET HEADER (Y: 6 to 30 mm, Height: 24 mm)
    // Clean White Floating Card with Solar Amber Top Accent
    // ==========================================
    const headerY = 6;
    const headerH = 24;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginX, headerY, contentWidth, headerH, 2, 2, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, headerY, contentWidth, headerH, 2, 2, 'S');

    // Amber-Gold Solar top stripe
    doc.setFillColor(245, 158, 11);
    doc.rect(marginX, headerY, contentWidth, 2.4, 'F');

    // Company Logo Container (Left)
    const logoBoxX = marginX + 3.5;
    const logoBoxY = headerY + 4.0;
    const logoBoxSize = 17;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 1.5, 1.5, 'S');

    if (logoImg) {
      try {
        doc.addImage(logoImg, 'JPEG', logoBoxX + 0.8, logoBoxY + 0.8, logoBoxSize - 1.6, logoBoxSize - 1.6);
      } catch {
        this.drawSolarEmblem(doc, logoBoxX + (logoBoxSize / 2), logoBoxY + (logoBoxSize / 2), 5.5);
      }
    } else {
      this.drawSolarEmblem(doc, logoBoxX + (logoBoxSize / 2), logoBoxY + (logoBoxSize / 2), 5.5);
    }

    // Company Name & Subtitle
    const textStartX = logoBoxX + logoBoxSize + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(3, 105, 161);
    doc.text(companyName, textStartX, headerY + 10.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(217, 119, 6);
    doc.text('SOLAR EPC & RENEWABLE ENERGY SOLUTIONS', textStartX, headerY + 15.5);

    // Contact line with VECTOR ICONS (Mobile & Email icons - No GST, No Helpline text)
    let contactX = textStartX;
    const iconY = headerY + 17.8;

    // Vector Mobile Phone Icon
    this.drawMobileIcon(doc, contactX, iconY, 3.2, 4.6);
    contactX += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(companyPhone, contactX, headerY + 21.2);
    contactX += (companyPhone.length * 1.85) + 4;

    // Separator
    doc.setTextColor(148, 163, 184);
    doc.text('|', contactX, headerY + 21.2);
    contactX += 3.5;

    // Vector Email Icon
    this.drawEmailIcon(doc, contactX, iconY + 0.5, 5.0, 3.6);
    contactX += 6.2;

    doc.setTextColor(15, 23, 42);
    doc.text(companyEmail, contactX, headerY + 21.2);

    // Top Right: Clean Date Pill
    const datePillW = 34;
    const datePillX = pageWidth - marginX - datePillW - 3.5;
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(datePillX, headerY + 5.5, datePillW, 13, 1.5, 1.5, 'F');
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.3);
    doc.roundedRect(datePillX, headerY + 5.5, datePillW, 13, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(2, 132, 199);
    doc.text('DATE', datePillX + (datePillW / 2), headerY + 10.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(todayStr, datePillX + (datePillW / 2), headerY + 15.2, { align: 'center' });

    // ==========================================
    // 3. KEY SYSTEM PARAMETERS STRIP (Y: 32 to 44 mm, Height: 12 mm)
    // 3 Clean Segments: System Type | Sanctioned Load | Connected Demand
    // ==========================================
    let curY = 32;
    const stripH = 12;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginX, curY, contentWidth, stripH, 1.5, 1.5, 'FD');

    const segW = contentWidth / 3; // 64.67mm each (3 spacious segments)

    // Segment 1: System Type
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('SYSTEM TYPE', marginX + 4, curY + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(217, 119, 6);
    const sysLabel = this.calc.SYSTEM_TYPE_MAP[this.calc.systemType()]?.label || result.systemLabel;
    doc.text(sysLabel, marginX + 4, curY + 9.2);

    // Segment 2: Grid Phase & Sanctioned Load
    const s2X = marginX + segW;
    doc.setDrawColor(226, 232, 240);
    doc.line(s2X, curY + 2, s2X, curY + stripH - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('SANCTIONED LOAD & GRID', s2X + 4, curY + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(2, 132, 199);
    doc.text(`${result.sanctionedLoadKw} kW (${result.connectionPhase})`, s2X + 4, curY + 9.2);

    // Segment 3: Connected Load & Daily Energy Demand (Full words: Watts, kWh / Day)
    const s3X = s2X + segW;
    doc.line(s3X, curY + 2, s3X, curY + stripH - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('CONNECTED LOAD & DEMAND', s3X + 4, curY + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(16, 185, 129);
    const dailyKwhStr = (result.dailyDemandKwh || 0).toFixed(3);
    doc.text(`${result.connectedLoadW} Watts | ~${dailyKwhStr} kWh / Day`, s3X + 4, curY + 9.2);

    // ==========================================
    // 4. MIDDLE SECTION: 2 COLUMNS (Y: 46 to 174 mm, Height: 128 mm)
    // Left: Appliances & Operating Hours | Right: Solar & Inverter Specs
    // ==========================================
    curY = 46;
    const colGap = 3.5;
    const leftColW = 99; // 99mm for rich Appliance Specs
    const rightColW = contentWidth - leftColW - colGap; // 91.5mm for Solar & Inverter Specs

    // --- LEFT COLUMN: APPLIANCES & LOAD SCHEDULE TABLE ---
    const leftX = marginX;

    // Header Bar
    doc.setFillColor(2, 132, 199);
    doc.roundedRect(leftX, curY, leftColW, 6.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text('APPLIANCES & OPERATING HOURS SCHEDULE', leftX + 3, curY + 4.4);

    let tableY = curY + 7.2;

    // Column widths for left table (Sum = 99mm)
    // Full words in headers: Appliance & Specification, Power, Quantity, Total, Daily Run-Time, Daily Energy
    const tColName = 43;
    const tColWatt = 10.5;
    const tColQty = 7.5;
    const tColTotalW = 11.5;
    const tColHours = 13;
    const tColDailyWh = 13.5;

    // Table Header Row
    doc.setFillColor(240, 249, 255);
    doc.rect(leftX, tableY, leftColW, 5.0, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.25);
    doc.rect(leftX, tableY, leftColW, 5.0, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(3, 105, 161);

    let thX = leftX;
    doc.text('Appliance & Specification', thX + 1.2, tableY + 3.5); thX += tColName;
    doc.text('Power', thX + 0.8, tableY + 3.5); thX += tColWatt;
    doc.text('Qty', thX + 1.2, tableY + 3.5); thX += tColQty;
    doc.text('Total', thX + 0.8, tableY + 3.5); thX += tColTotalW;
    doc.text('Run-Time', thX + 0.5, tableY + 3.5); thX += tColHours;
    doc.text('Daily Energy', thX + 0.5, tableY + 3.5);

    tableY += 5.0;

    // Appliance Rows
    const allAppliances = this.calc.appliances();
    const activeApps = allAppliances.filter(a => a.checked && (a.qty !== undefined ? a.qty > 0 : a.defaultQty > 0));
    const displayApps = activeApps.length > 0 ? activeApps : allAppliances.filter(a => a.checked);
    const clampedApps = displayApps.slice(0, 10);

    let totalWatts = 0;
    let totalDailyWh = 0;
    let totalQty = 0;

    const rowH = 6.6;
    clampedApps.forEach((app, idx) => {
      const qty = app.qty !== undefined ? app.qty : app.defaultQty;
      const hours = app.hours !== undefined ? app.hours : app.defaultHours;
      const unitW = app.watts || 0;
      const rowWatts = unitW * qty;
      const rowDailyWh = rowWatts * hours;

      totalWatts += rowWatts;
      totalDailyWh += rowDailyWh;
      totalQty += qty;

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(leftX, tableY, leftColW, rowH, 'F');

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.12);
      doc.line(leftX, tableY + rowH, leftX + leftColW, tableY + rowH);

      const cleanName = app.name.replace(/[^\x20-\x7E]/g, '').trim();
      let specText = this.getApplianceSpecification(app);
      const connectedQty = Math.max(0, Number(app.qty !== undefined ? app.qty : app.defaultQty) || 0);
      const bQty = Math.min(connectedQty, Math.max(0, app.backupQty !== undefined ? Number(app.backupQty) || 0 : (app.isBackup !== false ? Number(app.defaultQty) || 0 : 0)));
      if (app.checked && app.isBackup !== false && bQty > 0) {
        const bHr = app.backupHours !== undefined ? app.backupHours : result.backupHours;
        specText = `[Backup: ${bQty}x, ${bHr}h] ${specText}`;
      }

      let rX = leftX;

      // Col 1: Line 1 = Appliance Name; Line 2 = Technical Specification (Rating | Tech | Capacity)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.7);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanName.length > 25 ? cleanName.substring(0, 24) + '..' : cleanName, rX + 1.2, tableY + 2.7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(2, 132, 199);
      doc.text(specText.length > 44 ? specText.substring(0, 43) + '..' : specText, rX + 1.2, tableY + 5.5);
      rX += tColName;

      // Col 2: Unit Power (Watts)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(15, 23, 42);
      doc.text(`${unitW} W`, rX + 0.8, tableY + 4.0); rX += tColWatt;

      // Col 3: Quantity
      doc.setFont('helvetica', 'normal');
      doc.text(`${qty}`, rX + 2.2, tableY + 4.0); rX += tColQty;

      // Col 4: Total Power (Watts)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text(`${rowWatts} W`, rX + 0.8, tableY + 4.0); rX += tColTotalW;

      // Col 5: Daily Run-Time (Full words: Hours)
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 118, 110);
      doc.text(`${hours} Hours`, rX + 0.5, tableY + 4.0); rX += tColHours;

      // Col 6: Daily Energy (Full units: kWh)
      doc.setTextColor(30, 41, 59);
      const kwhVal = (rowDailyWh / 1000).toFixed(2) + ' kWh';
      doc.text(kwhVal, rX + 0.5, tableY + 4.0);

      tableY += rowH;
    });

    // Table Total Footer Row (Full words: TOTAL, Quantity, Watts, kWh / Day)
    doc.setFillColor(240, 249, 255);
    doc.rect(leftX, tableY, leftColW, 5.4, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.25);
    doc.rect(leftX, tableY, leftColW, 5.4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.7);
    doc.setTextColor(15, 23, 42);

    // Use full accurate totals from result or active apps
    const displayTotalWatts = result.connectedLoadW || totalWatts;
    const displayTotalDailyWh = result.totalApplianceDailyWh || totalDailyWh;

    let ftX = leftX;
    doc.text('TOTAL', ftX + 1.2, tableY + 3.7); ftX += tColName + tColWatt;
    doc.text(`${totalQty}`, ftX + 2.2, tableY + 3.7); ftX += tColQty;
    doc.setTextColor(217, 119, 6);
    doc.text(`${displayTotalWatts} W`, ftX + 0.8, tableY + 3.7); ftX += tColTotalW + tColHours;
    doc.setTextColor(16, 185, 129);
    doc.text(`${(displayTotalDailyWh / 1000).toFixed(2)} kWh`, ftX + 0.5, tableY + 3.7);

    tableY += 6.5;

    // Load Demand Summary Card below Table
    const noteCardH = curY + 126 - tableY;
    if (noteCardH > 15) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.3);
      doc.roundedRect(leftX, tableY, leftColW, noteCardH, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(180, 83, 9);
      doc.text('Connected Load & Daily Energy Demand', leftX + 2.5, tableY + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(71, 85, 105);
      let noteY = tableY + 8.0;
      doc.text(`- Connected Appliances: ${displayApps.length} categories (${totalQty} units total)`, leftX + 2.5, noteY); noteY += 3.8;
      doc.text(`- Simultaneous Connected Load: ${displayTotalWatts} Watts (${(displayTotalWatts / 1000).toFixed(2)} kW)`, leftX + 2.5, noteY); noteY += 3.8;
      if (result.backupLoadW > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(`- Critical Backup Load: ${result.backupLoadW} Watts (~${result.backupHours} Hours runtime)`, leftX + 2.5, noteY); noteY += 3.8;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
      }
      doc.text(`- Daily Energy Consumption: ~${(displayTotalDailyWh / 1000).toFixed(2)} kWh / Day`, leftX + 2.5, noteY); noteY += 3.8;
      if (noteCardH >= (noteY - tableY + 3.0)) {
        doc.text(`- Estimated Monthly Demand: ~${Math.round((displayTotalDailyWh / 1000) * 30)} Units / Month`, leftX + 2.5, noteY); noteY += 3.8;
      }
      if (result.backupEnergyWh > 0 && noteCardH >= (noteY - tableY + 3.0)) {
        doc.text(`- Required Battery Energy: ~${(result.backupEnergyWh / 1000).toFixed(2)} kWh`, leftX + 2.5, noteY);
      }
    }

    // --- RIGHT COLUMN: TECHNICAL SPECIFICATION HERO CARDS ---
    const rightX = marginX + leftColW + colGap;

    // Card 1: SOLAR PV ARRAY SPECIFICATION (Height: 60 mm)
    const solarH = 60;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.35);
    doc.roundedRect(rightX, curY, rightColW, solarH, 1.5, 1.5, 'FD');

    // Header badge
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(rightX + 2, curY + 2, rightColW - 4, 5.8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR PV ARRAY SPECIFICATION', rightX + (rightColW / 2), curY + 6.0, { align: 'center' });

    const solar = result.solar;
    if (solar) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(180, 83, 9);
      doc.text(`${solar.actualArrayKwp} kWp Recommended Capacity`, rightX + 4, curY + 14.0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(30, 41, 59);
      doc.text(`${solar.panelCount} Modules × ${solar.panelWatts}Wp Mono PERC Half-Cut`, rightX + 4, curY + 19.0);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      let sY = curY + 23.5;
      doc.text(`- Module Technology: Tier-1 Mono PERC / TOPCon Half-Cut High Efficiency`, rightX + 4, sY); sY += 4.3;
      if (solar.stringConfigText) {
        doc.text(`- String Configuration: ${solar.stringConfigText} (Vmp ~${solar.stringVmp || 166}V)`, rightX + 4, sY); sY += 4.3;
      }
      doc.text(`- Daily Expected Generation: ~${solar.estDailyGenKwh} Units (kWh) / Day`, rightX + 4, sY); sY += 4.3;
      doc.text(`- Monthly Expected Generation: ~${solar.estMonthlyGenUnits} Units / Month`, rightX + 4, sY); sY += 4.3;
      doc.text(`- Shadow-Free Roof Area Required: ~${solar.roofAreaSqFt} Square Feet`, rightX + 4, sY); sY += 4.3;
      doc.text(`- Sanctioned Load Permissible Limit: ${solar.sanctionedLoadKw} kW AC Equivalent`, rightX + 4, sY); sY += 4.3;

      doc.setFillColor(254, 243, 199);
      doc.roundedRect(rightX + 3.5, sY - 1.5, rightColW - 7, 5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor(180, 83, 9);
      doc.text('25-Year Linear Performance Warranty on Solar PV Modules', rightX + (rightColW / 2), sY + 2, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.0);
      doc.setTextColor(100, 116, 139);
      doc.text('Non-Solar System (Home UPS Inverter)', rightX + 4, curY + 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.text('Solar PV modules are not applicable for this configuration.', rightX + 4, curY + 22);
    }

    // Card 2: INVERTER / PCU SPECIFICATION (Height: 64 mm)
    const invCardY = curY + solarH + 3;
    const invH = 63;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.35);
    doc.roundedRect(rightX, invCardY, rightColW, invH, 1.5, 1.5, 'FD');

    // Header badge
    doc.setFillColor(2, 132, 199);
    doc.roundedRect(rightX + 2, invCardY + 2, rightColW - 4, 5.8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR INVERTER / PCU SPECIFICATION', rightX + (rightColW / 2), invCardY + 6.0, { align: 'center' });

    const inv = result.inverter;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(2, 132, 199);
    doc.text(`${inv.kVA} kVA / ${inv.kW} kW Rating`, rightX + 4, invCardY + 14.0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    const invTypeStr = this.calc.SYSTEM_TYPE_MAP[this.calc.systemType()]?.inverterType || 'Standard Inverter';
    doc.text(`${invTypeStr}`, rightX + 4, invCardY + 19.0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    let iY = invCardY + 23.5;
    doc.text(`- Output Phase & Power Factor: ${inv.phase || result.connectionPhase} (0.8 PF True Sine Wave)`, rightX + 4, iY); iY += 4.3;
    doc.text(`- Max Continuous AC Output: ${inv.continuousOutput || (inv.kW * 1000)} Watts`, rightX + 4, iY); iY += 4.3;
    if (inv.inductiveSurgeW) {
      doc.text(`- Inrush Surge Handled: ~${(inv.continuousRunningW || 0) + (inv.inductiveSurgeW || 0)}W (Motor Safe)`, rightX + 4, iY); iY += 4.3;
    }
    const busVoltStr = inv.batteryVoltage > 0 ? `${inv.batteryVoltage}V DC System Bus` : 'High Voltage MPPT (Grid-tied)';
    doc.text(`- DC System Bus Voltage: ${busVoltStr}`, rightX + 4, iY); iY += 4.3;
    doc.text(`- Inverter Model: ${inv.brand || 'Tier-1 Standard'} ${inv.model}`, rightX + 4, iY); iY += 4.3;
    const mpptStr = inv.mpptVoltageRange ? `MPPT Range: ${inv.mpptVoltageRange}` : 'Pure Sine Wave Output (50 Hz)';
    doc.text(`- AC Output Waveform: ${mpptStr}`, rightX + 4, iY); iY += 4.6;

    doc.setFillColor(240, 249, 255);
    doc.roundedRect(rightX + 3.5, iY - 1.5, rightColW - 7, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(2, 132, 199);
    doc.text('Smart Anti-Islanding Protection & Digital Generation Display', rightX + (rightColW / 2), iY + 2, { align: 'center' });

    // ==========================================
    // 5. BOTTOM SECTION: 3 BATTERY OPTIONS (Y: 176 to 258 mm, Height: 82 mm)
    // Full words: Bank Specification, Maintenance, Water Top-Up Required, Years, etc.
    // ==========================================
    curY = 176;

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, curY, contentWidth, 6.2, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text('BATTERY STORAGE SPECIFICATION - 3 COMPREHENSIVE TECHNOLOGY OPTIONS', marginX + 4, curY + 4.4);

    curY += 7.8;

    const bCardGap = 3.5;
    const bCardW = (contentWidth - (bCardGap * 2)) / 3; // 62.3mm each
    const bCardH = 74;

    const bLithium: BatterySelectionResult | null = result.batteryLithium || result.battery;
    const bTubular: BatterySelectionResult | null = result.batteryTubular;
    const bFlatPlate: BatterySelectionResult | null = result.batteryFlatPlate;

    // === OPTION 1: LITHIUM LFP (RECOMMENDED) ===
    const o1X = marginX;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.roundedRect(o1X, curY, bCardW, bCardH, 1.5, 1.5, 'FD');

    // Header Badge
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(o1X + 2, curY + 2, bCardW - 4, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(255, 255, 255);
    doc.text('OPTION 1: LITHIUM (LFP)', o1X + (bCardW / 2), curY + 5.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(6, 95, 70);
    const litTitle = bLithium ? `${bLithium.totalUnits} × ${bLithium.singleBatteryVolt}V ${bLithium.singleBatteryAh}Ah` : 'Lithium LFP Pack';
    doc.text(litTitle, o1X + 3, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(4, 120, 87);
    doc.text('LiFePO4 with Smart BMS Protection', o1X + 3, curY + 15.5);

    // Specs lines (Full words: Bank Specification, Years, Maintenance)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(30, 41, 59);
    let ly = curY + 20.5;
    doc.text(`- Bank Specification: ${bLithium?.systemVoltage || 48}V ${bLithium?.systemBankAh || 100}Ah`, o1X + 3, ly); ly += 4.5;
    doc.text(`- Total Storage: ${bLithium?.totalInstalledKwh || 4.8} kWh`, o1X + 3, ly); ly += 4.5;
    doc.text(`- Usable (90% DoD): ${bLithium?.usableKwh || 4.3} kWh`, o1X + 3, ly); ly += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    const litAutonomy = result.isSolarWithBattery
      ? `Autonomy: Day ~${result.dayBackupHours || 3}h | Night ~${result.nightBackupHours || 8}h`
      : `Autonomy: ~${bLithium?.actualBackupHours || 4} Hours Backup`;
    doc.text(`- ${litAutonomy}`, o1X + 3, ly); ly += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('- Lifespan: 10 - 12+ Years (4,000+ Cycles)', o1X + 3, ly); ly += 4.5;
    doc.text('- Charging: 2 - 3 Hours Fast Charging', o1X + 3, ly); ly += 4.5;
    doc.text('- Maintenance: 100% Zero Maintenance', o1X + 3, ly); ly += 4.5;
    doc.text('- Mounting: Wall-Mount Compact Design', o1X + 3, ly); ly += 4.5;

    // Bottom pill
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(o1X + 2.5, ly, bCardW - 5, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(6, 95, 70);
    doc.text('Highest Efficiency & Zero Maintenance', o1X + (bCardW / 2), ly + 3.5, { align: 'center' });

    // === OPTION 2: TALL TUBULAR LEAD-ACID (STANDARD) ===
    const o2X = o1X + bCardW + bCardGap;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.3);
    doc.roundedRect(o2X, curY, bCardW, bCardH, 1.5, 1.5, 'FD');

    // Header Badge
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(o2X + 2, curY + 2, bCardW - 4, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(255, 255, 255);
    doc.text('OPTION 2: TALL TUBULAR (C10)', o2X + (bCardW / 2), curY + 5.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(55, 48, 163);
    const tubTitle = bTubular ? `${bTubular.totalUnits} × 12V ${bTubular.singleBatteryAh}Ah` : 'Tall Tubular Bank';
    doc.text(tubTitle, o2X + 3, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(79, 70, 229);
    doc.text('Heavy-Duty Deep Cycle Solar C10', o2X + 3, curY + 15.5);

    // Specs lines (Full words: Bank Specification, Years, Distilled Water Top-Up Required)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(30, 41, 59);
    let ty = curY + 20.5;
    const tubConf = bTubular ? `${bTubular.systemVoltage}V (${bTubular.series}S × ${bTubular.parallel}P)` : 'Standard Bank';
    doc.text(`- Bank Specification: ${tubConf}`, o2X + 3, ty); ty += 4.5;
    doc.text(`- Total Storage: ${bTubular?.totalInstalledKwh || 4.8} kWh`, o2X + 3, ty); ty += 4.5;
    doc.text(`- Usable (75% DoD): ${bTubular?.usableKwh || 3.6} kWh`, o2X + 3, ty); ty += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 48, 163);
    const tubAutonomy = result.isSolarWithBattery
      ? `Autonomy: Day ~${result.dayBackupHours || 3}h | Night ~${result.nightBackupHours || 8}h`
      : `Autonomy: ~${bTubular?.actualBackupHours || 3.5} Hours Backup`;
    doc.text(`- ${tubAutonomy}`, o2X + 3, ty); ty += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('- Lifespan: 4 - 5 Years (~1,500 Cycles)', o2X + 3, ty); ty += 4.5;
    doc.text('- Charging: 8 - 10 Hours Standard', o2X + 3, ty); ty += 4.5;
    doc.text('- Maintenance: Water Top-Up Required', o2X + 3, ty); ty += 4.5;
    doc.text('- Mounting: Floor Trolley / Rack', o2X + 3, ty); ty += 4.5;

    // Bottom pill
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(o2X + 2.5, ty, bCardW - 5, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(67, 56, 202);
    doc.text('Proven Heavy-Duty Standard Choice', o2X + (bCardW / 2), ty + 3.5, { align: 'center' });

    // === OPTION 3: FLAT PLATE LEAD-ACID (BUDGET) ===
    const o3X = o2X + bCardW + bCardGap;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.roundedRect(o3X, curY, bCardW, bCardH, 1.5, 1.5, 'FD');

    // Header Badge
    doc.setFillColor(100, 116, 139);
    doc.roundedRect(o3X + 2, curY + 2, bCardW - 4, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(255, 255, 255);
    doc.text('OPTION 3: FLAT PLATE', o3X + (bCardW / 2), curY + 5.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(30, 41, 59);
    const flatTitle = bFlatPlate ? `${bFlatPlate.totalUnits} × 12V ${bFlatPlate.singleBatteryAh}Ah` : 'Flat Plate Bank';
    doc.text(flatTitle, o3X + 3, curY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(100, 116, 139);
    doc.text('Economy Budget Lead-Acid Batteries', o3X + 3, curY + 15.5);

    // Specs lines (Full words: Bank Specification, Years, Periodic Water Top-Up Required)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(30, 41, 59);
    let fpy = curY + 20.5;
    const flatConf = bFlatPlate ? `${bFlatPlate.systemVoltage}V (${bFlatPlate.series}S × ${bFlatPlate.parallel}P)` : 'Standard Bank';
    doc.text(`- Bank Specification: ${flatConf}`, o3X + 3, fpy); fpy += 4.5;
    doc.text(`- Total Storage: ${bFlatPlate?.totalInstalledKwh || 3.6} kWh`, o3X + 3, fpy); fpy += 4.5;
    doc.text(`- Usable (65% DoD): ${bFlatPlate?.usableKwh || 2.4} kWh`, o3X + 3, fpy); fpy += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const fpAutonomy = result.isSolarWithBattery
      ? `Autonomy: Day ~${result.dayBackupHours || 3}h | Night ~${result.nightBackupHours || 8}h`
      : `Autonomy: ~${bFlatPlate?.actualBackupHours || 2.5} Hours Backup`;
    doc.text(`- ${fpAutonomy}`, o3X + 3, fpy); fpy += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('- Lifespan: 2 - 3 Years (~800 Cycles)', o3X + 3, fpy); fpy += 4.5;
    doc.text('- Charging: 10 - 12 Hours Standard', o3X + 3, fpy); fpy += 4.5;
    doc.text('- Maintenance: Water Top-Up Required', o3X + 3, fpy); fpy += 4.5;
    doc.text('- Mounting: Floor Trolley / Rack', o3X + 3, fpy); fpy += 4.5;

    // Bottom pill
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(o3X + 2.5, fpy, bCardW - 5, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text('Entry-Level Budget Economical Choice', o3X + (bCardW / 2), fpy + 3.5, { align: 'center' });

    // ==========================================
    // 6. PAMPHLET FOOTER & SIGN-OFF (Y: 260 to 289 mm, Height: 28 mm)
    // Completely separated into two dedicated, non-overlapping columns!
    // ==========================================
    const footY = 260;
    const footH = 28;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginX, footY, contentWidth, footH, 1.5, 1.5, 'FD');

    // Left Column: Odia Summary for Non-Technical Customers (Width: 130mm, strictly bounded)
    const footNotesWidth = 130;
    this.renderOdiaSummary(
      doc,
      marginX + 0.5,
      footY + 0.5,
      footNotesWidth,
      footH - 1,
      result,
      companyPhone
    );

    // Vertical Divider Line between Left Notes and Right Signature Box
    const footDividerX = marginX + footNotesWidth + 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(footDividerX, footY + 3, footDividerX, footY + footH - 3);

    // Right Column: Dedicated Signature Box (Width: 54mm, from footDividerX + 3)
    const sigBoxX = footDividerX + 3;
    const sigBoxW = contentWidth - footNotesWidth - 5; // ~59mm

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(sigBoxX + 4, footY + 18.5, sigBoxX + sigBoxW - 4, footY + 18.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text('Authorized Technical Consultant', sigBoxX + (sigBoxW / 2), footY + 22.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(100, 116, 139);
    doc.text(companyName, sigBoxX + (sigBoxW / 2), footY + 25.8, { align: 'center' });

    // Page 2: Dedicated Comprehensive Odia Customer Proposal & Advisory Guide
    this.renderCustomerOdiaAdvisoryPage(doc, result, custInfo, companyName, companyPhone, companyEmail, logoImg);

    const rawSysLabel = this.calc.SYSTEM_TYPE_MAP[this.calc.systemType()]?.label || result.systemLabel || 'Solar';
    const cleanSysType = rawSysLabel.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const fileName = `System_Proposal_${cleanSysType}.pdf`;
    doc.save(fileName);
  }

  /**
   * Helper to draw a soft fluffy cloud shape using overlapping white circles
   */
  private drawFluffyCloud(doc: jsPDF, cx: number, cy: number, scale: number = 1): void {
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, 12 * scale, 'F');
    doc.circle(cx - 10 * scale, cy + 2 * scale, 9 * scale, 'F');
    doc.circle(cx + 11 * scale, cy + 1 * scale, 10 * scale, 'F');
    doc.circle(cx - 18 * scale, cy + 4 * scale, 6 * scale, 'F');
    doc.circle(cx + 19 * scale, cy + 3 * scale, 7 * scale, 'F');
    doc.roundedRect(cx - 22 * scale, cy + 3 * scale, 44 * scale, 8 * scale, 4 * scale, 4 * scale, 'F');
  }

  /**
   * Helper to draw a clean vector solar emblem icon
   */
  private drawSolarEmblem(doc: jsPDF, cx: number, cy: number, r: number): void {
    doc.setFillColor(245, 158, 11);
    doc.circle(cx, cy, r, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.45, 'F');
  }

  /**
   * Helper to draw a clean vector mobile phone icon
   */
  private drawMobileIcon(doc: jsPDF, x: number, y: number, w: number, h: number): void {
    // Outer phone body (Amber-Gold #d97706)
    doc.setFillColor(217, 119, 6);
    doc.roundedRect(x, y, w, h, 0.5, 0.5, 'F');

    // Inner phone screen (White)
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 0.35, y + 0.7, w - 0.7, h - 1.6, 'F');

    // Home button dot (Amber)
    doc.setFillColor(217, 119, 6);
    doc.circle(x + (w / 2), y + h - 0.45, 0.25, 'F');
  }

  /**
   * Helper to draw a clean vector email envelope icon
   */
  private drawEmailIcon(doc: jsPDF, x: number, y: number, w: number, h: number): void {
    // Envelope background (Amber-Gold #d97706)
    doc.setFillColor(217, 119, 6);
    doc.roundedRect(x, y, w, h, 0.4, 0.4, 'F');

    // Envelope flap lines (White)
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.line(x + 0.4, y + 0.5, x + (w / 2), y + (h * 0.58));
    doc.line(x + w - 0.4, y + 0.5, x + (w / 2), y + (h * 0.58));
  }

  /**
   * Renders the customer-friendly Odia summary onto an HTML5 canvas and adds it to the PDF.
   * Dynamically adapts to systemType:
   * 1. Solar Panel & Roof Area
   * 2. Daily Electricity Requirement / Generation
   * 3. Inverter Type & Rating
   * 4. Battery Option (Only summary)
   */
  private renderOdiaSummary(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    result: FullSizingResult,
    companyPhone: string
  ): void {
    try {
      const canvas = document.createElement('canvas');
      const scale = 8;
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sysTypeKey = this.calc.systemType();
      const solar = result.solar;
      const solarKwp = solar ? `${solar.actualArrayKwp}` : '0';
      const roofArea = solar ? `${solar.roofAreaSqFt}` : '0';
      const dailyGen = solar ? `${solar.estDailyGenKwh}` : '0';
      const dailyDemandKwh = (result.dailyDemandKwh || 0).toFixed(3);
      const backupEnergyKwh = (result.backupEnergyWh ? (result.backupEnergyWh / 1000).toFixed(2) : '0.00');

      const inv = result.inverter;
      const invKva = inv ? `${inv.kVA}` : '1.0';
      const invKw = inv ? `${inv.kW}` : '1.0';

      let headerTitle = 'ସିଷ୍ଟମ୍ ମୁଖ୍ୟ ଆବଶ୍ୟକତା ଓ ସାରାଂଶ:';
      let p1 = ''; // Panel & Roof Area
      let p2 = ''; // Daily electricity requirement
      let p3 = ''; // Inverter type & rating
      let p4 = ''; // Battery option (for on-grid)

      const bLithium = result.batteryLithium || result.battery;
      const bTubular = result.batteryTubular;
      const bFlatPlate = result.batteryFlatPlate;

      const litAh = bLithium?.systemBankAh || 100;
      const litV = bLithium?.systemVoltage || 48;
      const litKwh = bLithium?.totalInstalledKwh || 4.8;
      const litUnits = bLithium?.totalUnits || 1;
      const litHours = bLithium?.actualBackupHours || 4;

      const tubAh = bTubular?.systemBankAh || 150;
      const tubV = bTubular?.systemVoltage || 48;
      const tubUnits = bTubular?.totalUnits || 4;
      const tubKwh = bTubular?.totalInstalledKwh || 7.2;
      const tubHours = bTubular?.actualBackupHours || 4;

      const fpAh = bFlatPlate?.systemBankAh || 150;
      const fpV = bFlatPlate?.systemVoltage || 48;
      const fpUnits = bFlatPlate?.totalUnits || 4;
      const fpKwh = bFlatPlate?.totalInstalledKwh || 3.6;
      const fpHours = bFlatPlate?.actualBackupHours || 3;

      const batTitle = '• ବ୍ୟାଟେରୀ ବ୍ୟାଙ୍କ ବିକଳ୍ପ (Day 9am–4pm Solar & Night 4pm–9am Backup):';
      const batLithiumText = `  1. ଲିଥିୟମ୍ (LiFePO4): ${litUnits} ୟୁନିଟ୍ (${litV}V ${litAh}Ah, ${litKwh} kWh) — ଦିନ (9AM–4PM) ସୋଲାର୍, ରାତି (4PM–9AM) ~${litHours}h ବ୍ୟାକଅପ୍, ୧୦-୧୨ ବର୍ଷ life`;
      const batTubularText = `  2. ଟଲ୍ ଟ୍ୟୁବୁଲାର୍ (C10): ${tubUnits} ଟି ୧୨V ${tubAh}Ah (${tubV}V ବ୍ୟାଙ୍କ, ${tubKwh} kWh) — ଦିନ ସୋଲାର୍, ରାତି (4PM–9AM) ~${tubHours}h ବ୍ୟାକଅପ୍, ୪-୫ ବର୍ଷ life`;
      const batFlatPlateText = `  3. ଫ୍ଲାଟ୍ ପ୍ଲେଟ୍: ${fpUnits} ଟି ୧୨V (${fpV}V ${fpAh}Ah ବ୍ୟାଙ୍କ, ${fpKwh} kWh) — ଦିନ ସୋଲାର୍, ରାତି (4PM–9AM) ~${fpHours}h ବ୍ୟାକଅପ୍, ବଜେଟ୍ ପସନ୍ଦ`;

      if (sysTypeKey === 'on-grid') {
        headerTitle = 'ସିଷ୍ଟମ୍ ମୁଖ୍ୟ ଆବଶ୍ୟକତା ଓ ସାରାଂଶ (On-Grid Solar):';
        p1 = `• ସୋଲାର ପ୍ୟାନେଲ ଓ ଛାତ: ~${solarKwp} kWp ପ୍ୟାନେଲ ପାଇଁ ପ୍ରାୟ ${roofArea} ବର୍ଗଫୁଟ ଛାଇମୁକ୍ତ ଛାତ ଜାଗା ଆବଶ୍ୟକ।`;
        p2 = `• ଦୈନିକ ବିଜୁଳି ଆବଶ୍ୟକତା: ଦୈନିକ ଚାହିଦା ~${dailyDemandKwh} kWh ତୁଳନାରେ ପ୍ରତିଦିନ ~${dailyGen} ୟୁନିଟ୍ ସୋଲାର ବିଜୁଳି ତିଆରି ହେବ।`;
        p3 = `• ଇନଭର୍ଟର ଆବଶ୍ୟକତା: ${invKva} kVA (${invKw} kW) ଅନ୍-ଗ୍ରୀଡ୍ GTI (Grid-Tied) ଇନଭର୍ଟର ଆବଶ୍ୟକ।`;
        p4 = `• ବ୍ୟାଟେରୀ ବିକଳ୍ପ: ଅନ୍-ଗ୍ରୀଡ୍ ସିଷ୍ଟମ୍ ରେ ବ୍ୟାଟେରୀ ଆବଶ୍ୟକ ନାହିଁ (ନେଟ୍-ମିଟରିଂ ଦ୍ୱାରା ସିଧାସଳଖ ଗ୍ରୀଡ୍ ସଞ୍ଚୟ)।`;
      } else if (sysTypeKey === 'hybrid') {
        const dHrs = result.dayBackupHours || 3;
        const nHrs = result.nightBackupHours || 8;
        const dKwh = ((result.dayBackupEnergyWh || 0) / 1000).toFixed(1);
        const nKwh = ((result.nightBackupEnergyWh || 0) / 1000).toFixed(1);
        headerTitle = 'ସିଷ୍ଟମ୍ ମୁଖ୍ୟ ଆବଶ୍ୟକତା ଓ ସାରାଂଶ (Hybrid Solar):';
        p1 = `• ସୋଲାର ପ୍ୟାନେଲ ଓ ଛାତ: ~${solarKwp} kWp ପ୍ୟାନେଲ ପାଇଁ ପ୍ରାୟ ${roofArea} ବର୍ଗଫୁଟ ଛାଇମୁକ୍ତ ଛାତ ଜାଗା ଆବଶ୍ୟକ।`;
        p2 = `• ଦୈନିକ ବିଜୁଳି ଓ ବ୍ୟାକଅପ୍: ଦିନ (9AM–4PM) ସୋଲାର୍ + ~${dHrs}h (${dKwh}U) | ରାତି (4PM–9AM) ବ୍ୟାଟେରୀ ~${nHrs}h (${nKwh}U)`;
        p3 = `• ଇନଭର୍ଟର ଆବଶ୍ୟକତା: ${invKva} kVA (${invKw} kW) ହାଇବ୍ରିଡ୍ ବାଇ-ଡାଇରେକ୍ସନାଲ୍ ଇନଭର୍ଟର (Hybrid Inverter) ଆବଶ୍ୟକ।`;
      } else if (sysTypeKey === 'off-grid') {
        const dHrs = result.dayBackupHours || 3;
        const nHrs = result.nightBackupHours || 8;
        const dKwh = ((result.dayBackupEnergyWh || 0) / 1000).toFixed(1);
        const nKwh = ((result.nightBackupEnergyWh || 0) / 1000).toFixed(1);
        headerTitle = 'ସିଷ୍ଟମ୍ ମୁଖ୍ୟ ଆବଶ୍ୟକତା ଓ ସାରାଂଶ (Off-Grid Solar):';
        p1 = `• ସୋଲାର ପ୍ୟାନେଲ ଓ ଛାତ: ~${solarKwp} kWp ପ୍ୟାନେଲ ପାଇଁ ପ୍ରାୟ ${roofArea} ବର୍ଗଫୁଟ ଛାଇମୁକ୍ତ ଛାତ ଜାଗା ଆବଶ୍ୟକ।`;
        p2 = `• ଦୈନିକ ବିଜୁଳି ଓ ବ୍ୟାକଅପ୍: ଦିନ (9AM–4PM) ସୋଲାର୍ + ~${dHrs}h (${dKwh}U) | ରାତି (4PM–9AM) ବ୍ୟାଟେରୀ ~${nHrs}h (${nKwh}U)`;
        p3 = `• ଇନଭର୍ଟର ଆବଶ୍ୟକତା: ${invKva} kVA (${invKw} kW) ସୋଲାର ପିସିୟୁ ଇନଭର୍ଟର (Solar PCU Inverter) ଆବଶ୍ୟକ।`;
      } else {
        // without-solar
        headerTitle = 'ସିଷ୍ଟମ୍ ମୁଖ୍ୟ ଆବଶ୍ୟକତା ଓ ସାରାଂଶ (Home UPS Inverter):';
        p1 = `• ସୋଲାର ପ୍ୟାନେଲ ଓ ଛାତ: ସୋଲାର ପ୍ୟାନେଲ କିମ୍ବା ଛାତ ଜାଗା ଆବଶ୍ୟକ ନାହିଁ (ଘରୋଇ ବିଦ୍ୟୁତ ଗ୍ରୀଡ୍ ରୁ ଚାର୍ଜିଂ ହେବ)।`;
        p2 = `• ଦୈନିକ ବିଜୁଳି ଆବଶ୍ୟକତା: ଜରୁରୀ ବିଦ୍ୟୁତ କଟିବା ସମୟରେ ବ୍ୟାକଅପ୍ ପାଇଁ ଦୈନିକ ~${backupEnergyKwh} kWh ବିଦ୍ୟୁତ ସଞ୍ଚୟ ଆବଶ୍ୟକ।`;
        p3 = `• ଇନଭର୍ଟର ଆବଶ୍ୟକତା: ${invKva} kVA (${invKw} kW) ହୋମ୍ ୟୁପିଏସ୍ / ପ୍ୟୋର୍ ସାଇନ୍ ୱେଭ୍ ଇନଭର୍ଟର ଆବଶ୍ୟକ।`;
      }

      // Header Title (Odia)
      ctx.font = 'bold 20px "Nirmala UI", "Kalinga", "Noto Sans Oriya", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.textBaseline = 'top';
      ctx.fillText(headerTitle, 10, 8);

      // Bullet points
      ctx.font = '500 14px "Nirmala UI", "Kalinga", "Noto Sans Oriya", sans-serif';
      ctx.fillStyle = '#334155';

      ctx.fillText(p1, 10, 36);
      ctx.fillText(p2, 10, 62);
      ctx.fillText(p3, 10, 88);

      if (sysTypeKey === 'on-grid') {
        ctx.fillStyle = '#0f766e';
        ctx.fillText(p4, 10, 116);
      } else {
        ctx.font = 'bold 14px "Nirmala UI", "Kalinga", "Noto Sans Oriya", sans-serif';
        ctx.fillStyle = '#0f766e';
        ctx.fillText(batTitle, 10, 114);

        ctx.font = '500 13px "Nirmala UI", "Kalinga", "Noto Sans Oriya", sans-serif';
        ctx.fillStyle = '#065f46';
        ctx.fillText(batLithiumText, 10, 138);

        ctx.fillStyle = '#3730a3';
        ctx.fillText(batTubularText, 10, 162);

        ctx.fillStyle = '#475569';
        ctx.fillText(batFlatPlateText, 10, 186);
      }

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', x, y, w, h);
    } catch {
      // Fallback in case of canvas issues
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(3, 105, 161);
      doc.text('Key System Requirements & Summary:', x + 3, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(71, 85, 105);
      doc.text('- Solar PV array & shadow-free roof area calculated for daily generation.', x + 3, y + 10);
      doc.text('- Daily electricity requirement and consumption covered reliably.', x + 3, y + 14.5);
      doc.text('- Inverter rating and topology selected for continuous load duty.', x + 3, y + 19);
      doc.text('- Battery storage technology option provided based on backup autonomy.', x + 3, y + 23.5);
    }
  }

  /**
   * Page 2: Dedicated Comprehensive Odia Customer Proposal & Advisory Guide
   * Aligned for non-technical customers with exact breakdown:
   * 1. Daily Load & Unit Calculation (Standard Indian wattage)
   * 2. Recommended Configuration (Inverter surge proofing, Solar Panels Kana Pain?, Battery Option A & B)
   * 3. Important Cost-Saving Tip (BLDC Fans / Smart Advice)
   */
  private renderCustomerOdiaAdvisoryPage(
    doc: jsPDF,
    result: FullSizingResult,
    custInfo?: CustomerProposalInfo,
    companyName: string = 'SolarTrack Technologies',
    companyPhone: string = '+91 94370 00000',
    companyEmail: string = 'support@solartrack.in',
    logoImg?: HTMLImageElement | null
  ): void {
    try {
      doc.addPage();

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 8;
      const contentWidth = 194;
      const contentHeight = 285;
      const headerY = 6;

      // ==========================================
      // PAGE 2: SKY WITH CLOUDS BACKGROUND (Identical to Page 1)
      // ==========================================
      const stepH = 2.5;
      for (let y = 0; y < pageHeight; y += stepH) {
        const t = y / pageHeight; // 0 (top) to 1 (bottom)
        let r = 172 + (248 - 172) * Math.pow(t, 0.7);
        let g = 218 + (252 - 218) * Math.pow(t, 0.7);
        let b = 251 + (255 - 251) * Math.pow(t, 0.7);
        doc.setFillColor(Math.round(r), Math.round(g), Math.round(b));
        doc.rect(0, y, pageWidth, stepH + 0.2, 'F');
      }

      // Draw soft, fluffy clouds in the background (Identical positions to Page 1)
      this.drawFluffyCloud(doc, 45, 18, 1.4);
      this.drawFluffyCloud(doc, 175, 25, 1.2);
      this.drawFluffyCloud(doc, 20, 115, 1.1);
      this.drawFluffyCloud(doc, 190, 135, 1.3);
      this.drawFluffyCloud(doc, 50, 220, 1.5);
      this.drawFluffyCloud(doc, 165, 240, 1.2);

      // Subtle Company Name Watermark
      doc.saveGraphicsState();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(195, 224, 248);
      doc.text(companyName.toUpperCase(), pageWidth / 2, 98, {
        align: 'center',
        angle: 30
      });
      doc.text(companyName.toUpperCase(), pageWidth / 2, 202, {
        align: 'center',
        angle: 30
      });
      doc.restoreGraphicsState();

      // ==========================================
      // HIGH-RESOLUTION CANVAS FOR CRISP VECTOR-LIKE ODIA TEXT
      // 305 DPI Print Quality (776 x 1140 logical units @ 3x scale)
      // ==========================================
      const canvas = document.createElement('canvas');
      const logicalW = 776; // 194mm * 4
      const logicalH = 1140; // 285mm * 4
      const dpr = 3; // 305 DPI high resolution
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textBaseline = 'top';

      // Keep canvas transparent so the underlying sky gradient and clouds show through!
      ctx.clearRect(0, 0, logicalW, logicalH);

      const sysTypeKey = this.calc.systemType();
      const allAppliances = this.calc.appliances();
      const activeApps = allAppliances.filter(a => a.checked && (a.qty !== undefined ? a.qty > 0 : a.defaultQty > 0));
      const displayApps = activeApps.length > 0 ? activeApps : allAppliances.filter(a => a.checked);

      let totalWatts = 0;
      let totalDailyWh = 0;
      displayApps.forEach(a => {
        const q = a.qty !== undefined ? a.qty : a.defaultQty;
        const h = a.hours !== undefined ? a.hours : a.defaultHours;
        const w = a.watts || 0;
        totalWatts += w * q;
        totalDailyWh += w * q * h;
      });

      const displayTotalWatts = result.connectedLoadW > 0 ? result.connectedLoadW : totalWatts;
      const displayTotalDailyWh = result.totalApplianceDailyWh > 0 ? result.totalApplianceDailyWh : totalDailyWh;
      const displayTotalKw = (displayTotalWatts / 1000).toFixed(1);
      const displayDailyUnits = (displayTotalDailyWh / 1000).toFixed(1);

      // Motor Surge Detection
      let motorOrPump = displayApps.find(a => {
        const id = (a.id || '').toLowerCase();
        const n = (a.name || '').toLowerCase();
        return id.includes('pump') || id.includes('motor') || n.includes('pump') || n.includes('motor');
      });
      if (!motorOrPump) {
        motorOrPump = displayApps.find(a => {
          const id = (a.id || '').toLowerCase();
          const n = (a.name || '').toLowerCase();
          return id.includes('ac') || n.includes('air conditioner');
        });
      }

      const surgeDeltaW = (result.requiredPeakSurgeW && result.requiredPeakSurgeW > displayTotalWatts)
        ? (result.requiredPeakSurgeW - displayTotalWatts)
        : (motorOrPump ? (motorOrPump.watts * 2.5) : 0);
      const peakSurgeW = result.requiredPeakSurgeW || (displayTotalWatts + surgeDeltaW);
      const peakSurgeMinKw = (peakSurgeW / 1000).toFixed(1);
      const peakSurgeMaxKw = ((peakSurgeW * 1.08) / 1000).toFixed(1);

      // Inverter Details
      const inv = result.inverter;
      const invKva = inv?.kVA || 7.5;
      const invKw = inv?.kW || 6.0;
      const invVolt = inv?.batteryVoltage || 96;
      const invOutputW = inv?.continuousOutput || (invKw * 1000);

      // Solar Details
      const solar = result.solar;
      const actualKwp = solar?.actualArrayKwp || 8.8;
      const panelCount = solar?.panelCount || 16;
      const panelWatts = solar?.panelWatts || 550;
      const solarMinKw = (actualKwp * 0.95).toFixed(1);
      const solarMaxKw = (actualKwp * 1.08).toFixed(1);
      const targetGenNeeded = (Number(displayDailyUnits) / 0.82).toFixed(1);

      // Battery Details
      const bLithium = result.batteryLithium || result.battery;
      const bTubular = result.batteryTubular;
      const bFlatPlate = result.batteryFlatPlate;

      const tubUnits = bTubular?.totalUnits || 8;
      const tubAh = bTubular?.singleBatteryAh || 200;
      const tubVolt = bTubular?.systemVoltage || invVolt;
      const tubKwh = bTubular?.totalInstalledKwh || 19.2;
      const tubUsable = bTubular?.usableKwh || 14.4;

      const litUnits = bLithium?.totalUnits || 1;
      const litVolt = bLithium?.systemVoltage || invVolt;
      const litAh = bLithium?.systemBankAh || 200;
      const litKwh = bLithium?.totalInstalledKwh || 19.2;
      const litUsable = bLithium?.usableKwh || 17.3;

      const fpUnits = bFlatPlate?.totalUnits || 8;
      const fpVolt = bFlatPlate?.systemVoltage || invVolt;
      const fpAh = bFlatPlate?.singleBatteryAh || 150;
      const fpKwh = bFlatPlate?.totalInstalledKwh || 14.4;
      const fpUsable = bFlatPlate?.usableKwh || 9.4;

      // Day load (full simultaneous) and Night load (lights & fans)
      const dayLoadWatts = Math.max(100, displayTotalWatts);
      const nightLoadWatts = Math.max(100, Math.round(displayTotalWatts * 0.65));

      const tubDayHours = Math.round(((tubUsable * 1000 * 0.9) / dayLoadWatts) * 10) / 10;
      const tubNightHours = Math.round(((tubUsable * 1000 * 0.9) / nightLoadWatts) * 10) / 10;

      const litDayHours = Math.round(((litUsable * 1000 * 0.9) / dayLoadWatts) * 10) / 10;
      const litNightHours = Math.round(((litUsable * 1000 * 0.9) / nightLoadWatts) * 10) / 10;

      const fpDayHours = Math.round(((fpUsable * 1000 * 0.9) / dayLoadWatts) * 10) / 10;
      const fpNightHours = Math.round(((fpUsable * 1000 * 0.9) / nightLoadWatts) * 10) / 10;

      // BLDC Fan Smart Tip
      const fanApp = displayApps.find(a => {
        const id = (a.id || '').toLowerCase();
        const n = (a.name || '').toLowerCase();
        return id.includes('fan') || n.includes('fan');
      });

      let fanQty = 0;
      let fanWatts = 75;
      let fanHours = 12;
      let fanDailyKwh = 0;
      let fanPct = 0;
      let bldcTotalWatts = 0;
      let bldcDailyKwh = 0;
      let newDailyUnits = Number(displayDailyUnits);

      if (fanApp) {
        fanQty = fanApp.qty !== undefined ? fanApp.qty : fanApp.defaultQty;
        fanWatts = fanApp.watts || 75;
        fanHours = fanApp.hours !== undefined ? fanApp.hours : fanApp.defaultHours || 12;
        const fanTotalW = fanWatts * fanQty;
        fanDailyKwh = (fanTotalW * fanHours) / 1000;
        fanPct = Number(displayDailyUnits) > 0 ? Math.round((fanDailyKwh / Number(displayDailyUnits)) * 100) : 0;
        bldcTotalWatts = 32 * fanQty;
        bldcDailyKwh = (bldcTotalWatts * fanHours) / 1000;
        newDailyUnits = Math.max(1, Math.round((Number(displayDailyUnits) - (fanDailyKwh - bldcDailyKwh)) * 10) / 10);
      }

      const tableX = 0;
      const tableW = logicalW;

      // ==========================================
      // 1. FLOATING HEADER CARD (Matches Page 1 Header Style)
      // ==========================================
      const headH = 76;
      this.drawCanvasRoundedRect(ctx, tableX, 0, tableW, headH, 6, '#ffffff', '#bae6fd', 1.2);
      this.drawCanvasRoundedTopStripe(ctx, tableX, 0, tableW, 6, 6, '#f59e0b');

      // Logo container
      const logoBoxX = tableX + 12;
      const logoBoxY = 12;
      const logoBoxSize = 52;
      this.drawCanvasRoundedRect(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 4, '#f8fafc', '#e2e8f0', 1);

      if (logoImg) {
        try {
          ctx.drawImage(logoImg, logoBoxX + 2, logoBoxY + 2, logoBoxSize - 4, logoBoxSize - 4);
        } catch {
          ctx.font = 'bold 22px sans-serif';
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('☀️', logoBoxX + 12, logoBoxY + 14);
        }
      } else {
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('☀️', logoBoxX + 12, logoBoxY + 14);
      }

      // Title & Subtitle in Deep Navy / Sky Blue
      const titleX = logoBoxX + logoBoxSize + 14;
      ctx.font = 'bold 17px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('SolarTrack • ଗ୍ରାହକ ସହାୟକ ପରାମର୍ଶ ଓ ସରଳ ସାରାଂଶ', titleX, 16);

      ctx.font = '11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`ସିଷ୍ଟମ୍ ପ୍ରକାର: ${result.systemLabel}   •   ପ୍ରସ୍ତୁତ ତାରିଖ: ${new Date().toLocaleDateString('en-IN')}`, titleX, 42);

      // Customer Info Pill on Right
      const pillW = 246;
      const pillH = 48;
      const pillX = tableW - pillW - 12;
      const pillY = 14;
      this.drawCanvasRoundedRect(ctx, pillX, pillY, pillW, pillH, 5, '#f0f9ff', '#38bdf8', 1);

      ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0284c7';
      ctx.fillText(`ଗ୍ରାହକ: ${custInfo?.customerName || 'ସମ୍ମାନିତ ଗ୍ରାହକ'}`, pillX + 10, pillY + 8);

      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`ଯୋଗାଯୋଗ: ${custInfo?.customerPhone || companyPhone}`, pillX + 10, pillY + 26);

      // ==========================================
      // 2. SECTION 1: APPLIANCE LOAD BREAKDOWN
      // ==========================================
      let curY = headH + 16;
      ctx.font = 'bold 14px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('୧. ଦୈନିକ ଲୋଡ୍ ଓ ୟୁନିଟ୍ (kWh) ହିସାବ (Standard Indian Appliance Wattage):', tableX + 4, curY);
      curY += 22;

      // Table Header Card
      const headBarH = 26;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, headBarH, 4, '#f0f9ff', '#bae6fd', 1);

      ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('ଉପକରଣ (Appliance)', tableX + 12, curY + 6);
      ctx.fillText('ପରିମାଣ', tableX + 240, curY + 6);
      ctx.fillText('ୱାଟେଜ୍ (Approx.)', tableX + 310, curY + 6);
      ctx.fillText('ମୋଟ ଲୋଡ୍ (W)', tableX + 440, curY + 6);
      ctx.fillText('ସମୟ', tableX + 560, curY + 6);
      ctx.fillText('ଦୈନିକ ୟୁନିଟ୍ (kWh)', tableX + 645, curY + 6);
      curY += headBarH;

      // Table Rows
      const rowH = 22;
      const clampedApps = displayApps.slice(0, 7);
      clampedApps.forEach((app, idx) => {
        const q = app.qty !== undefined ? app.qty : app.defaultQty;
        const h = app.hours !== undefined ? app.hours : app.defaultHours;
        const w = app.watts || 0;
        const rW = w * q;
        const rKwh = (rW * h) / 1000;
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        ctx.fillStyle = bg;
        ctx.fillRect(tableX, curY, tableW, rowH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tableX, curY, tableW, rowH);

        ctx.font = '500 11px "Nirmala UI", "Kalinga", sans-serif';
        ctx.fillStyle = '#0f172a';
        const odiaName = this.getOdiaApplianceName(app.name, app.id);
        ctx.fillText(odiaName, tableX + 12, curY + 4);

        ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`${q}`, tableX + 252, curY + 4);

        const isPumpOrAc = (app.id || '').toLowerCase().includes('pump') || (app.name || '').toLowerCase().includes('pump');
        const wText = isPumpOrAc ? `${w} W (Surge: ~${w * 2.5}W)` : `${w} W`;
        ctx.fillText(wText, tableX + 310, curY + 4);

        ctx.font = 'bold 10.5px "Nirmala UI", "Kalinga", sans-serif';
        ctx.fillStyle = '#b45309';
        ctx.fillText(`${rW} W`, tableX + 445, curY + 4);

        ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
        ctx.fillStyle = '#0f766e';
        ctx.fillText(`${h} hrs`, tableX + 565, curY + 4);

        ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
        ctx.fillStyle = '#0369a1';
        ctx.fillText(`${rKwh.toFixed(1)} Units`, tableX + 655, curY + 4);

        curY += rowH;
      });

      // Total Row
      const totRowH = 26;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, totRowH, 4, '#e0f2fe', '#7dd3fc', 1);
      ctx.font = 'bold 11.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0c4a6e';
      ctx.fillText('TOTAL (ମୋଟ)', tableX + 12, curY + 6);
      ctx.fillText('——', tableX + 252, curY + 6);
      ctx.fillText('——', tableX + 335, curY + 6);
      ctx.fillText(`${displayTotalWatts} W (~${displayTotalKw} kW)`, tableX + 435, curY + 6);
      ctx.fillText('—', tableX + 570, curY + 6);
      ctx.fillText(`${displayDailyUnits} Units / day`, tableX + 645, curY + 6);
      curY += totRowH + 10;

      // Peak Surge & Day/Night Sizing Callout Box
      const reqDayHrs = result.dayBackupHours || 3;
      const reqNightHrs = result.nightBackupHours || 8;
      const dLoadW = result.dayBackupLoadW || displayTotalWatts;
      const nLoadW = result.nightBackupLoadW || Math.round(displayTotalWatts * 0.65);
      const dEnergyKwh = ((result.dayBackupEnergyWh || (dLoadW * reqDayHrs)) / 1000).toFixed(1);
      const nEnergyKwh = ((result.nightBackupEnergyWh || (nLoadW * reqNightHrs)) / 1000).toFixed(1);
      const totBatKwh = (result.backupEnergyWh / 1000).toFixed(1);

      const surgeBoxH = 58;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, surgeBoxH, 5, '#fffbeb', '#fcd34d', 1);
      ctx.font = 'bold 11.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText('⚡ ଲୋଡ୍ ଓ ସୋଲାର୍ ବ୍ୟାକଅପ୍ ଆବଶ୍ୟକତା (Day: 9am–4pm & Night: 4pm–9am Sizing):', tableX + 12, curY + 6);

      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#78350f';
      const surgeL1 = `• ଦିନ ବେଳେ (9 AM - 4 PM): ପମ୍ପ ଓ ସବୁ ଲୋଡ୍ (${dLoadW}W) ଖରା ଥିଲେ ସୋଲାର୍ ରୁ ଚାଲିବ; ମେଘୁଆ ପାଇଁ ${reqDayHrs}h ବ୍ୟାକଅପ୍ (${dEnergyKwh} kWh) ସଂରକ୍ଷିତ।`;
      const surgeL2 = `• ରାତି ବେଳେ (4 PM - 9 AM): ପମ୍ପ ବନ୍ଦ, ଲାଇଟ୍ ଓ ଫ୍ୟାନ୍ (${nLoadW}W) ପାଇଁ ${reqNightHrs}h ବ୍ୟାକଅପ୍ (${nEnergyKwh} kWh) ସମ୍ପୂର୍ଣ୍ଣ ବ୍ୟାଟେରୀରୁ ମିଳିବ।`;
      const surgeL3 = `• ମୋଟ ବ୍ୟାଟେରୀ ଆବଶ୍ୟକତା: ~${totBatKwh} Units / day (ଦିନ ${dEnergyKwh} U + ରାତି ${nEnergyKwh} U) । ୧ HP ପମ୍ପ starting surge ~${peakSurgeMinKw}-${peakSurgeMaxKw} kW।`;
      ctx.fillText(surgeL1, tableX + 12, curY + 23);
      ctx.fillText(surgeL2, tableX + 12, curY + 39);
      ctx.fillText(surgeL3, tableX + 12, curY + 55);
      curY += surgeBoxH + 16;

      // ==========================================
      // 3. SECTION 2: RECOMMENDED CONFIGURATION
      // ==========================================
      ctx.font = 'bold 14px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('୨. ସୁପାରିଶିତ ଅଫ୍-ଗ୍ରୀଡ୍ ସୋଲାର କନଫିଗରେସନ୍ (Recommended Configuration):', tableX + 4, curY);
      curY += 22;

      // 1. Inverter Box
      const invBoxH = 68;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, invBoxH, 5, '#ffffff', '#bae6fd', 1);
      ctx.font = 'bold 12px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0284c7';
      ctx.fillText(`1. Off-Grid Solar Inverter (MPPT PCU): ${invKva} kVA / ${invVolt}V Pure Sine Wave MPPT PCU`, tableX + 12, curY + 8);

      ctx.font = '11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#334155';
      const invLine1 = `— ଏହା ~${invOutputW} W ପର୍ଯ୍ୟନ୍ତ continuous load ସମ୍ଭାଳି ପାରିବ ଓ ୧ HP ପମ୍ପ ର starting surge ରେ trip ହେବ ନାହିଁ।`;
      const invLine2 = `(Note: ଯଦି ସବୁ load ଏକାଠି ଚଳାଇ future expansion ଚାହୁଁଛନ୍ତି, ତେବେ ପରବର୍ତ୍ତୀ ଉଚ୍ଚ କ୍ଷମତାର PCU ସବୁଠୁ safe option)।`;
      ctx.fillText(invLine1, tableX + 12, curY + 27);
      ctx.fillText(invLine2, tableX + 12, curY + 45);
      curY += invBoxH + 10;

      // 2. Solar Panels Box
      const solBoxH = 82;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, solBoxH, 5, '#fffbeb', '#fcd34d', 1);
      ctx.font = 'bold 12px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText(`2. Solar Panels: ${solarMinKw} kW ରୁ ${solarMaxKw} kW (${panelCount} ଟି ${panelWatts}W Mono PERC / TOPCon Half-Cut = ${actualKwp} kWp)`, tableX + 12, curY + 8);

      ctx.font = '11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#78350f';
      const solLine1 = `କାହିଁକି ଏତିକି ଦରକାର: ଦିନ ଲୋଡ୍ + ରାତି ବ୍ୟାକଅପ୍ (${nEnergyKwh} U) ପାଇଁ ବ୍ୟାଟେରୀ ଫୁଲ୍ ଚାର୍ଜିଂ ଲସ୍ (~20%) ମିଶି ଦିନକୁ ~${targetGenNeeded} units solar generation ଦରକାର।`;
      const solLine2 = `ହାରାହାରି ୧ kW panel ଦିନକୁ ୪–୪.୫ units generate କରୁଥିବାରୁ ~${actualKwp} kW panel ଦରକାର ହେବ।`;
      const solLine3 = `(${invKva} kVA / ${invVolt}V inverter କିଣିବା ବେଳକୁ ତାର Max PV Input capacity ଯାଞ୍ଚ କରିବେ — ସାଧାରଣତଃ ଏହି PCU ଉପଯୁକ୍ତ PV panel support କରେ)।`;
      ctx.fillText(solLine1, tableX + 12, curY + 27);
      ctx.fillText(solLine2, tableX + 12, curY + 44);
      ctx.fillText(solLine3, tableX + 12, curY + 61);
      curY += solBoxH + 10;

      // 3. Battery Storage Box
      const batBoxH = 224;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, batBoxH, 5, '#ffffff', '#bae6fd', 1);
      ctx.font = 'bold 12px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.fillText('3. Battery Bank (Storage) — ସମସ୍ତ ୩ ଟି ଟେକ୍ନୋଲୋଜି ବିକଳ୍ପ ଓ Day/Night ବ୍ୟାକଅପ୍ ସମୟ:', tableX + 12, curY + 8);

      // Option A: Tall Tubular
      ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText(`Option A (Lead-Acid C10 Solar Tubular): ${tubUnits} × 12V ${tubAh}Ah (${tubVolt}V ସିରିଜ୍, ${tubKwh} kWh)`, tableX + 12, curY + 28);
      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#334155';
      const tubDesc1 = `• ଦିନ ବେଳେ (9 AM - 4 PM): ଖରା ଥିଲେ ସୋଲାର୍ ରୁ ୭ ଘଣ୍ଟା ଚାଲିବ + ମେଘୁଆ ପାଗରେ ବ୍ୟାଟେରୀରୁ ~${tubDayHours} ଘଣ୍ଟା ବ୍ୟାକଅପ୍।`;
      const tubDesc2 = `• ରାତି ବେଳେ (4 PM - 9 AM): ରାତି ୪ ରୁ ସକାଳ ୯ ଭିତରେ ବ୍ୟାଟେରୀରୁ ~${tubNightHours} ଘଣ୍ଟା (ସକାଳ ଯାଏଁ) ନିରବଚ୍ଛିନ୍ନ ବ୍ୟାକଅପ୍।`;
      ctx.fillText(tubDesc1, tableX + 12, curY + 44);
      ctx.fillText(tubDesc2, tableX + 12, curY + 59);

      // Divider Line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(tableX + 12, curY + 76);
      ctx.lineTo(tableX + tableW - 12, curY + 76);
      ctx.stroke();

      // Option B: Lithium
      ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#065f46';
      ctx.fillText(`Option B (Lithium / LiFePO4 Battery): ${litUnits} ୟୁନିଟ୍ ${litVolt}V ${litAh}Ah LiFePO4 (~${litKwh} kWh, ~${litUsable} kWh usable)`, tableX + 12, curY + 84);
      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#065f46';
      const litDesc1 = `• ଦିନ ବେଳେ (9 AM - 4 PM): ଡାଇରେକ୍ଟ ସୋଲାର୍ + ମେଘୁଆ ପାଗରେ ~${litDayHours} ଘଣ୍ଟା (୨-୩ ଘଣ୍ଟାରେ ଫାଷ୍ଟ ଚାର୍ଜିଂ, ୧୦-୧୨ ବର୍ଷ life)।`;
      const litDesc2 = `• ରାତି ବେଳେ (4 PM - 9 AM): ରାତି ୪ ରୁ ସକାଳ ୯ ପର୍ଯ୍ୟନ୍ତ ~${litNightHours} ଘଣ୍ଟା ବ୍ୟାକଅପ୍ (୯୦% DoD, ୦% ମେଣ୍ଟେନାନ୍ସ)।`;
      ctx.fillText(litDesc1, tableX + 12, curY + 100);
      ctx.fillText(litDesc2, tableX + 12, curY + 115);

      // Divider Line
      ctx.beginPath();
      ctx.moveTo(tableX + 12, curY + 132);
      ctx.lineTo(tableX + tableW - 12, curY + 132);
      ctx.stroke();

      // Option C: Flat Plate
      ctx.font = 'bold 11px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Option C (Flat Plate Lead-Acid Battery): ${fpUnits} × 12V ${fpAh}Ah Flat Plate (${fpVolt}V ବ୍ୟାଙ୍କ, ${fpKwh} kWh, ~${fpUsable} kWh usable)`, tableX + 12, curY + 140);
      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#475569';
      const fpDesc1 = `• ଦିନ ବେଳେ (9 AM - 4 PM): ଡାଇରେକ୍ଟ ସୋଲାର୍ + ମେଘୁଆ ପାଗରେ ~${fpDayHours} ଘଣ୍ଟା ବ୍ୟାକଅପ୍।`;
      const fpDesc2 = `• ରାତି ବେଳେ (4 PM - 9 AM): ରାତି ୪ ରୁ ସକାଳ ୯ ଭିତରେ ~${fpNightHours} ଘଣ୍ଟା ବ୍ୟାକଅପ୍ (ବଜେଟ୍ ଫ୍ରେଣ୍ଡଲି ପସନ୍ଦ)।`;
      ctx.fillText(fpDesc1, tableX + 12, curY + 156);
      ctx.fillText(fpDesc2, tableX + 12, curY + 171);

      curY += batBoxH + 12;

      // ==========================================
      // 4. SECTION 3: COST-SAVING TIP (BLDC FANS)
      // ==========================================
      const tipBoxH = 106;
      this.drawCanvasRoundedRect(ctx, tableX, curY, tableW, tipBoxH, 6, '#ecfdf5', '#059669', 1.5);
      ctx.font = 'bold 12px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#065f46';
      ctx.fillText('💡 Important Cost-Saving Tip (BLDC Fans / ମୂଲ୍ୟବାନ ବିଜୁଳି ଓ ଖର୍ଚ୍ଚ ସଞ୍ଚୟ ପରାମର୍ଶ):', tableX + 12, curY + 8);

      ctx.font = '10.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#047857';
      if (fanApp && fanQty > 0) {
        const fanTotalW = fanWatts * fanQty;
        const tipL1 = `• ଆପଣଙ୍କ total daily unit (${displayDailyUnits} units) ଭିତରେ କେବଳ ${fanQty} ଟି ceiling fan (${fanWatts}W) ପ୍ରାୟ ${fanDailyKwh.toFixed(1)} units (${fanPct}%) ଖର୍ଚ୍ଚ କରୁଛି।`;
        const tipL2 = `• ଯଦି normal fan ବଦଳରେ 30W–35W BLDC Fans use କରିବେ, fan load ${fanTotalW}W ରୁ ~${bldcTotalWatts}W କୁ କମିଯିବ ଓ consumption ${displayDailyUnits} units ରୁ ~${newDailyUnits} units କୁ ଖସି ଆସିବ।`;
        const tipL3 = `• ସେଥିରେ କେବଳ ଛୋଟ Inverter + କମ୍ Solar Panel + କମ୍ Battery ରେ ପୂରା system ଚାଲିଯିବ, ଯାହା ଆପଣଙ୍କ system cost କୁ ୩୫%–୪୦% କମାଇ ଦେବ।`;
        ctx.fillText(tipL1, tableX + 12, curY + 28);
        ctx.fillText(tipL2, tableX + 12, curY + 47);
        ctx.fillText(tipL3, tableX + 12, curY + 66);
      } else {
        const tipL1 = `• ଉଚ୍ଚ ବିଦ୍ୟୁତ ଖର୍ଚ୍ଚ କରୁଥିବା ଉପକରଣ (ଯଥା: ମୋଟର/ପମ୍ପ ଓ ଏସି) ରେ 5-Star Inverter ଟେକ୍ନୋଲୋଜି ବ୍ୟବହାର କରିବା ଉଚିତ୍।`;
        const tipL2 = `• ଏହାଦ୍ୱାରା ଦୈନିକ ବିଦ୍ୟୁତ ଚାହିଦା ୩୦% ରୁ ୪୦% କମିଯିବ ଏବଂ କମ୍ କ୍ଷମତାର ସୋଲାର ପ୍ୟାନେଲ ଓ ବ୍ୟାଟେରୀରେ ପୂରା ଘର ଚାଲିପାରିବ।`;
        ctx.fillText(tipL1, tableX + 12, curY + 30);
        ctx.fillText(tipL2, tableX + 12, curY + 52);
      }

      // ==========================================
      // 5. FOOTER CARD (Matches Page 1 Footer Style)
      // ==========================================
      const footY = 1070;
      const footH = 62;
      this.drawCanvasRoundedRect(ctx, tableX, footY, tableW, footH, 6, '#ffffff', '#bae6fd', 1.2);

      ctx.font = 'bold 11.5px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#0369a1';
      ctx.textAlign = 'center';
      ctx.fillText(`SolarTrack Odisha Renewable Energy Solutions   •   ସହାୟତା ଫୋନ୍: ${companyPhone}   •   Email: ${companyEmail}`, tableW / 2, footY + 14);

      ctx.font = '10px "Nirmala UI", "Kalinga", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('MNRE / OERC ଷ୍ଟାଣ୍ଡାର୍ଡ ଅନୁଯାୟୀ ଏହି ବୈଷୟିକ ରିପୋର୍ଟ ପ୍ରସ୍ତୁତ କରାଯାଇଛି। କୌଣସି ପ୍ରଶ୍ନ ପାଇଁ ଆମ ଟେକ୍ନିକାଲ୍ ଟିମ୍ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।', tableW / 2, footY + 36);
      ctx.textAlign = 'left';

      // Attach high-definition canvas onto the page
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', marginX, headerY, contentWidth, contentHeight);
    } catch (err) {
      console.warn('Could not generate Page 2 Odia Customer Advisory Report:', err);
    }
  }

  /**
   * Helper to map standard appliance names to friendly Odia titles
   */
  private getOdiaApplianceName(name: string, id: string = ''): string {
    const n = (name || '').toLowerCase();
    const i = (id || '').toLowerCase();
    if (i.includes('light') || i.includes('bulb') || i.includes('led') || n.includes('bulb') || n.includes('led') || n.includes('light')) {
      return 'LED ବଲ୍ବ (LED Bulb)';
    }
    if (i.includes('fan') || n.includes('fan')) {
      return 'ସିଲିଂ ଫ୍ୟାନ୍ (Ceiling Fan)';
    }
    if (i.includes('pump') || i.includes('motor') || n.includes('pump') || n.includes('motor')) {
      return '୧ HP ୱାଟର ପମ୍ପ (Water Pump)';
    }
    if (i.includes('comp') || i.includes('laptop') || i.includes('pc') || n.includes('computer') || n.includes('laptop')) {
      return 'କମ୍ପ୍ୟୁଟର (Computer / Laptop)';
    }
    if (i.includes('fridge') || n.includes('fridge') || n.includes('refrigerator')) {
      return 'ରେଫ୍ରିଜରେଟର (Refrigerator)';
    }
    if (i.includes('tv') || n.includes('tv') || n.includes('television')) {
      return 'ଟିଭି (LED TV)';
    }
    if (i.includes('wm') || n.includes('washing')) {
      return 'ୱାଶିଂ ମେସିନ୍ (Washing Machine)';
    }
    if (i.includes('ac') || n.includes('air conditioner') || n.includes('cooler')) {
      return 'ଏସି (Air Conditioner AC)';
    }
    if (i.includes('geyser') || n.includes('geyser') || n.includes('heater')) {
      return 'ଗିଜର / ହିଟର (Geyser)';
    }
    if (i.includes('iron') || n.includes('iron')) {
      return 'ଇସ୍ତ୍ରୀ (Electric Iron)';
    }
    if (i.includes('induction') || n.includes('cooker')) {
      return 'ଇଣ୍ଡକସନ୍ ଚୁଲା (Induction Cooker)';
    }
    return name;
  }

  /**
   * Helper to draw rounded rectangles on HTML5 canvas
   */
  private drawCanvasRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor?: string,
    strokeColor?: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Helper to draw a top accent stripe with rounded top corners on HTML5 canvas
   */
  private drawCanvasRoundedTopStripe(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor: string
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Helper to wrap text cleanly inside canvas cards
   */
  private drawCanvasWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, curY);
    return curY + lineHeight;
  }
}
