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
    const dailyKwhStr = (result.totalApplianceDailyWh ? (result.totalApplianceDailyWh / 1000).toFixed(2) : (result.dailyDemandKwh || 0).toFixed(2));
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
    const activeApps = allAppliances.filter(a => a.checked || (a.qty !== undefined ? a.qty > 0 : a.defaultQty > 0));
    const displayApps = activeApps.length > 0 ? activeApps : allAppliances;
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
      const specText = this.getApplianceSpecification(app);

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

    let ftX = leftX;
    doc.text('TOTAL', ftX + 1.2, tableY + 3.7); ftX += tColName + tColWatt;
    doc.text(`${totalQty}`, ftX + 2.2, tableY + 3.7); ftX += tColQty;
    doc.setTextColor(217, 119, 6);
    doc.text(`${totalWatts} W`, ftX + 0.8, tableY + 3.7); ftX += tColTotalW + tColHours;
    doc.setTextColor(16, 185, 129);
    doc.text(`${(totalDailyWh / 1000).toFixed(2)} kWh`, ftX + 0.5, tableY + 3.7);

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
      doc.text(`- Connected Appliances: ${clampedApps.length} categories (${totalQty} units total)`, leftX + 2.5, tableY + 8.0);
      doc.text(`- Simultaneous Peak Load: ${totalWatts} Watts (${(totalWatts / 1000).toFixed(2)} Kilowatts)`, leftX + 2.5, tableY + 11.8);
      doc.text(`- Daily Energy Consumption: ~${(totalDailyWh / 1000).toFixed(2)} kWh / Day`, leftX + 2.5, tableY + 15.6);
      doc.text(`- Estimated Monthly Consumption: ~${Math.round((totalDailyWh / 1000) * 30)} Units / Month`, leftX + 2.5, tableY + 19.4);
      doc.text(`- Standard Load Basis: BEE Star ratings, modulated duty & rated runtime`, leftX + 2.5, tableY + 23.2);
      if (result.backupLoadW > 0 && noteCardH > 27) {
        doc.text(`- Critical Backup Load: ${result.backupLoadW} Watts (~${result.backupHours} Hours runtime)`, leftX + 2.5, tableY + 27.0);
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
      let sY = curY + 24.0;
      doc.text(`- Module Technology: Tier-1 Mono PERC Half-Cut High Efficiency`, rightX + 4, sY); sY += 4.6;
      doc.text(`- Daily Expected Generation: ~${solar.estDailyGenKwh} Units (kWh) / Day`, rightX + 4, sY); sY += 4.6;
      doc.text(`- Monthly Expected Generation: ~${solar.estMonthlyGenUnits} Units / Month`, rightX + 4, sY); sY += 4.6;
      doc.text(`- Annual Expected Generation: ~${solar.estAnnualGenUnits} Units / Year`, rightX + 4, sY); sY += 4.6;
      // Full words: Square Feet (NO "sq.ft" abbreviation)
      doc.text(`- Shadow-Free Roof Area Required: ~${solar.roofAreaSqFt} Square Feet`, rightX + 4, sY); sY += 4.6;
      // Full words: Limit & Equivalent (NO "Cap" abbreviation)
      doc.text(`- Sanctioned Load Permissible Limit: ${solar.sanctionedLoadKw} kW AC Equivalent`, rightX + 4, sY); sY += 4.6;

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
    let iY = invCardY + 24.0;
    doc.text(`- Output Phase & Voltage: ${inv.phase || result.connectionPhase}`, rightX + 4, iY); iY += 4.6;
    doc.text(`- Max Continuous AC Output: ${inv.continuousOutput || (inv.kW * 1000)} Watts`, rightX + 4, iY); iY += 4.6;
    const busVoltStr = inv.batteryVoltage > 0 ? `${inv.batteryVoltage}V DC System Bus` : 'High Voltage MPPT (Grid-tied)';
    doc.text(`- DC System Bus Voltage: ${busVoltStr}`, rightX + 4, iY); iY += 4.6;
    doc.text(`- Inverter Brand / Model: ${inv.brand || 'Tier-1 Standard'} ${inv.model}`, rightX + 4, iY); iY += 4.6;
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
    doc.text(`- Autonomy: ~${bLithium?.actualBackupHours || 4} Hours`, o1X + 3, ly); ly += 4.5;

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
    doc.text(`- Autonomy: ~${bTubular?.actualBackupHours || 3.5} Hours`, o2X + 3, ty); ty += 4.5;

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
    doc.text(`- Autonomy: ~${bFlatPlate?.actualBackupHours || 2.5} Hours`, o3X + 3, fpy); fpy += 4.5;

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

    // Left Column: Quality & Compliance Notes (Width: 130mm, strictly bounded)
    const footNotesWidth = 130;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(3, 105, 161);
    doc.text('Quality Assurance & Standards Compliance:', marginX + 3.5, footY + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(71, 85, 105);
    doc.text('- Tier-1 Mono PERC Half-Cut Modules with 25-Year Warranty (MNRE & ALMM Approved).', marginX + 3.5, footY + 9.8);
    doc.text('- Grid-tie & net-metering compliant with state DISCOM & CEA regulations.', marginX + 3.5, footY + 14.0);
    doc.text('- Engineered specifically based on actual appliance operating hours & daily demand.', marginX + 3.5, footY + 18.2);
    doc.text(`- For technical assistance & installation, contact: ${companyPhone} | ${companyEmail}`, marginX + 3.5, footY + 22.4);

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

    // Save and download EXACTLY 1 PAGE PDF: File name: System_Proposal_<SystemType>.pdf
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
}
