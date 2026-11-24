const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

function createPdf() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182 mm

  // Color Palette
  const colors = {
    skyTop: [224, 242, 254],     // #e0f2fe
    skyBottom: [248, 250, 252],  // #f8fafc
    navyDark: [15, 23, 42],      // #0f172a
    navyPrimary: [3, 105, 161],  // #0369a1
    navySecondary: [12, 74, 110],// #0c4a6e
    textDark: [30, 41, 59],      // #1e293b
    textMuted: [100, 116, 139],  // #64748b
    tableHeaderBg: [2, 132, 199],// #0284c7
    tableSubHeaderBg: [224, 242, 254], // #e0f2fe
    tableRowAlt: [248, 250, 252],// #f8fafc
    amberAccent: [217, 119, 6],  // #d97706
    emeraldAccent: [5, 150, 105],// #059669
    borderLight: [186, 230, 253],// #bae6fd
    watermarkColor: [215, 238, 252] // Very soft sky watermark
  };

  // Helper: Draw Background and Watermark on any page
  function drawPageBackground(pageNum, totalPages = 3) {
    // Gradient sky background
    const steps = 60;
    const stepH = pageHeight / steps;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(colors.skyTop[0] + (colors.skyBottom[0] - colors.skyTop[0]) * ratio);
      const g = Math.round(colors.skyTop[1] + (colors.skyBottom[1] - colors.skyTop[1]) * ratio);
      const b = Math.round(colors.skyTop[2] + (colors.skyBottom[2] - colors.skyTop[2]) * ratio);
      doc.setFillColor(r, g, b);
      doc.rect(0, i * stepH, pageWidth, stepH + 0.5, 'F');
    }

    // Diagonal Background Watermark
    doc.saveGraphicsState();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...colors.watermarkColor);

    // Multi-line angled watermark across page
    doc.text('SHRI TRUTIYADEV', 35, 75, { angle: 35 });
    doc.text('SOLAR ENTERPRISES', 40, 95, { angle: 35 });

    doc.text('SHRI TRUTIYADEV', 45, 185, { angle: 35 });
    doc.text('SOLAR ENTERPRISES', 50, 205, { angle: 35 });

    doc.restoreGraphicsState();

    // Footer
    const footerY = 286;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.0);
    doc.setTextColor(...colors.textMuted);
    doc.text('Shri Trutiyadev Solar Enterprises — Pure Off-Grid Solar Engineering Report', marginX, footerY + 1.5);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX, footerY + 1.5, { align: 'right' });
  }

  // ==========================================
  // PAGE 1: Site Parameters & Energy Audit
  // ==========================================
  drawPageBackground(1);

  // Top Header
  let curY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('SHRI TRUTIYADEV SOLAR ENTERPRISES', marginX, curY);

  curY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16.5);
  doc.setTextColor(...colors.navySecondary);
  doc.text('Pure Off-Grid Solar Power System Configuration', marginX, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...colors.textDark);
  doc.text('System Mode: ', marginX, curY);
  const sysModeW = doc.getTextWidth('System Mode: ');
  doc.setFont('helvetica', 'normal');
  doc.text('100% Standalone Off-Grid (Zero Utility Grid / No Emergency Grid Charging)  |  ', marginX + sysModeW, curY);
  const mode2W = doc.getTextWidth('100% Standalone Off-Grid (Zero Utility Grid / No Emergency Grid Charging)  |  ');
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Load: ', marginX + sysModeW + mode2W, curY);
  const dailyW = doc.getTextWidth('Daily Load: ');
  doc.setTextColor(...colors.emeraldAccent);
  doc.text('~26.0 kWh (Units)', marginX + sysModeW + mode2W + dailyW, curY);

  curY += 4.5;
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.4);
  doc.line(marginX, curY, pageWidth - marginX, curY);

  // Section 1: Site & Design Parameters
  curY += 7.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('1. Site & Design Parameters (Zero-Grid Baseline)', marginX, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(...colors.textDark);
  const introP1 = 'This system is engineered for complete energy independence where no utility grid supply or diesel generator is available for emergency battery charging. Both daytime consumption and overnight energy storage rely exclusively on solar PV generation.';
  const p1Lines = doc.splitTextToSize(introP1, contentWidth);
  doc.text(p1Lines, marginX, curY);
  curY += (p1Lines.length * 4.2) + 2.5;

  // Bullet Points
  const bulletIndent = marginX + 3.5;
  const bulletWidth = contentWidth - 4;

  const b1 = '•  Operating Architecture: Pure Off-Grid MPPT Solar PCU with Lithium Ferro-Phosphate (LiFePO4) storage.';
  doc.text(doc.splitTextToSize(b1, bulletWidth), bulletIndent, curY);
  curY += 4.6;

  const b2 = '•  Standard Appliance Wattages: LED Bulb = 10 W; Ceiling Fan (Standard) = 75 W; Laptop = 65 W; 1 HP Surface Water Pump = 850 W continuous (~2,200 W starting surge).';
  const b2Lines = doc.splitTextToSize(b2, bulletWidth);
  doc.text(b2Lines, bulletIndent, curY);
  curY += (b2Lines.length * 4.2) + 0.5;

  const b3 = '•  Solar Generation Baseline: Calculated at 4.5 Peak Sun Hours (PSH) per day with ~18%–20% total conversion, wiring, and battery charging losses.';
  const b3Lines = doc.splitTextToSize(b3, bulletWidth);
  doc.text(b3Lines, bulletIndent, curY);
  curY += (b3Lines.length * 4.2) + 4.5;

  // Section 2: Day vs. Night Energy Audit & Peak Load Schedule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('2. Day vs. Night Energy Audit & Peak Load Schedule', marginX, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(...colors.textDark);
  const auditIntro = 'Separating direct daytime solar loads (9:00 AM – 4:00 PM) from nighttime battery loads (4:00 PM – 9:00 AM) prevents oversizing the battery bank while guaranteeing uninterrupted overnight power.';
  const auditIntroLines = doc.splitTextToSize(auditIntro, contentWidth);
  doc.text(auditIntroLines, marginX, curY);
  curY += (auditIntroLines.length * 4.2) + 3.5;

  // Energy Audit Table
  // Widths: Appliance (62) | Unit Wattage (26) | Total Load (28) | Runtime (26) | Daily Units (40) = 182
  const colW = [64, 26, 28, 26, 38];
  const colX = [
    marginX,
    marginX + colW[0],
    marginX + colW[0] + colW[1],
    marginX + colW[0] + colW[1] + colW[2],
    marginX + colW[0] + colW[1] + colW[2] + colW[3]
  ];

  function drawTableHeader(y) {
    doc.setFillColor(...colors.tableHeaderBg);
    doc.rect(marginX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(255, 255, 255);
    doc.text('Appliance & Quantity', colX[0] + 2.5, y + 4.8);
    doc.text('Unit Wattage', colX[1] + 2, y + 4.8);
    doc.text('Total Load (W)', colX[2] + 2, y + 4.8);
    doc.text('Runtime', colX[3] + 2, y + 4.8);
    doc.text('Daily Units (kWh)', colX[4] + 2, y + 4.8);
  }

  drawTableHeader(curY);
  curY += 7;

  function drawSubSectionRow(title, y) {
    doc.setFillColor(224, 242, 254);
    doc.rect(marginX, y, contentWidth, 6.2, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, 6.2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...colors.navyPrimary);
    doc.text(title, colX[0] + 3, y + 4.3);
  }

  function drawTableRow(app, watt, totalW, run, units, y, isAlt = false) {
    if (isAlt) {
      doc.setFillColor(...colors.tableRowAlt);
      doc.rect(marginX, y, contentWidth, 6.2, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX, y, contentWidth, 6.2, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, 6.2, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.9);
    doc.setTextColor(...colors.textDark);
    doc.text(app, colX[0] + 2.5, y + 4.3);
    doc.text(watt, colX[1] + 2.5, y + 4.3);
    doc.text(totalW, colX[2] + 2.5, y + 4.3);
    doc.text(run, colX[3] + 2.5, y + 4.3);
    doc.text(units, colX[4] + 2.5, y + 4.3);
  }

  function drawSubtotalRow(label, peakW, totalUnits, y) {
    doc.setFillColor(240, 249, 255);
    doc.rect(marginX, y, contentWidth, 6.5, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.3);
    doc.rect(marginX, y, contentWidth, 6.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(...colors.navyPrimary);
    doc.text(label, colX[0] + 2.5, y + 4.5);
    doc.text(peakW, colX[2] + 2.5, y + 4.5);
    doc.text('—', colX[3] + 4, y + 4.5);
    doc.text(totalUnits, colX[4] + 2.5, y + 4.5);
  }

  // Group 1: Daytime
  drawSubSectionRow('Daytime (9:00 AM – 4:00 PM) — Direct Solar Power', curY);
  curY += 6.2;

  drawTableRow('LED Bulbs (25 Nos.)', '10 W', '250 W', '7 hrs', '1.75 kWh', curY, false); curY += 6.2;
  drawTableRow('Ceiling Fans (25 Nos.)', '75 W', '1,875 W', '7 hrs', '13.13 kWh', curY, true); curY += 6.2;
  drawTableRow('Laptop (1 No.)', '65 W', '65 W', '7 hrs', '0.46 kWh', curY, false); curY += 6.2;
  drawTableRow('1 HP Water Pump (1 No.)', '850 W', '850 W', '1 hr', '0.85 kWh', curY, true); curY += 6.2;

  drawSubtotalRow('Daytime Subtotal (Direct Solar Consumption)', '3,040 W Peak', '16.19 kWh', curY);
  curY += 8.5;

  // Group 2: Nighttime
  drawSubSectionRow('Nighttime (4:00 PM – 9:00 AM) — 100% Battery Power', curY);
  curY += 6.2;

  drawTableRow('LED Bulbs (25 Nos.)', '10 W', '250 W', '14 hrs', '3.50 kWh', curY, false); curY += 6.2;
  drawTableRow('Ceiling Fans (4 Nos.)', '75 W', '300 W', '17 hrs', '5.10 kWh', curY, true); curY += 6.2;
  drawTableRow('Laptop (1 No.)', '65 W', '65 W', '5 hrs', '0.33 kWh', curY, false); curY += 6.2;
  drawTableRow('1 HP Water Pump (1 No.)', '850 W', '850 W', '1 hr', '0.85 kWh', curY, true); curY += 6.2;

  drawSubtotalRow('Nighttime Subtotal (Battery Storage Requirement)', '1,465 W Peak', '9.78 kWh', curY);
  curY += 6.5;

  // ==========================================
  // PAGE 2: Specifications & Stringing
  // ==========================================
  doc.addPage();
  drawPageBackground(2);

  curY = 16;
  // Repeat Table Header & Total 24h Summary Row
  drawTableHeader(curY);
  curY += 7;

  // 24 Hour Grand Total Row
  doc.setFillColor(224, 242, 254);
  doc.rect(marginX, curY, contentWidth, 7.5, 'F');
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.4);
  doc.rect(marginX, curY, contentWidth, 7.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...colors.navySecondary);
  doc.text('Total Daily Energy Consumption & Peak Running Load', colX[0] + 2.5, curY + 5.0);
  doc.text('3,040 W (~3.04 kW)', colX[2] + 2.0, curY + 5.0);
  doc.text('24 hrs', colX[3] + 2.5, curY + 5.0);
  doc.setTextColor(...colors.emeraldAccent);
  doc.text('25.97 kWh (~26 Units)', colX[4] + 2.0, curY + 5.0);

  curY += 13;

  // Section 3: Recommended Off-Grid System Specifications
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('3. Recommended Off-Grid System Specifications', marginX, curY);

  curY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(...colors.textDark);
  const specIntro = 'Because no utility grid exists for backup charging, the PV array and battery bank are sized with dedicated autonomous reserve to sustain morning loads and partially overcast weather.';
  doc.text(doc.splitTextToSize(specIntro, contentWidth), marginX, curY);
  curY += 9.5;

  // Specs Table: Subsystem (38mm) | Recommended Specification (48mm) | Technical Justification (96mm) = 182mm
  const sColW = [38, 48, 96];
  const sColX = [marginX, marginX + sColW[0], marginX + sColW[0] + sColW[1]];

  doc.setFillColor(...colors.tableHeaderBg);
  doc.rect(marginX, curY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(255, 255, 255);
  doc.text('Subsystem', sColX[0] + 2.5, curY + 4.8);
  doc.text('Recommended Specification', sColX[1] + 2.5, curY + 4.8);
  doc.text('Technical Justification (No-Grid Operation)', sColX[2] + 2.5, curY + 4.8);
  curY += 7;

  function drawSpecRow(subsys, spec, just, height, isAlt = false) {
    if (isAlt) {
      doc.setFillColor(...colors.tableRowAlt);
      doc.rect(marginX, curY, contentWidth, height, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX, curY, contentWidth, height, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, contentWidth, height, 'S');

    // Subsystem
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...colors.navySecondary);
    const subsysLines = doc.splitTextToSize(subsys, sColW[0] - 4);
    doc.text(subsysLines, sColX[0] + 2.5, curY + 4.5);

    // Specification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.7);
    doc.setTextColor(...colors.textDark);
    const specLines = doc.splitTextToSize(spec, sColW[1] - 4);
    doc.text(specLines, sColX[1] + 2.5, curY + 4.5);

    // Justification
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...colors.textDark);
    const justLines = doc.splitTextToSize(just, sColW[2] - 4);
    doc.text(justLines, sColX[2] + 2.5, curY + 4.5);

    curY += height;
  }

  // Row 1: Inverter
  drawSpecRow(
    '1. Off-Grid Inverter\n(MPPT PCU)',
    '7.5 kVA / 96V DC\nPure Sine Wave MPPT PCU (~6,000 W rated output)',
    'Supports 3,040 W continuous daytime load plus the ~2,200 W inductive starting surge of the 1 HP pump (~4,390 W instantaneous peak) without overload tripping.',
    16.5,
    false
  );

  // Row 2: Solar PV Array
  drawSpecRow(
    '2. Solar PV Array',
    '8.25 kW to 8.80 kW\n(15 or 16 × 550W Mono PERC / TOPCon Bifacial Modules)',
    'Generates ~30–32 kWh/day to power the 16.19 kWh daytime load while simultaneously recharging ~11.5 kWh into the battery bank every day without grid support.',
    16.5,
    true
  );

  // Row 3: Battery Standard
  drawSpecRow(
    '3. Battery Bank\n(Standard Pure Off-Grid)',
    '96V 200Ah LiFePO4\n(19.2 kWh DC | ~16.5 kWh usable AC at 90% DoD)',
    'Covers the 9.78 kWh nighttime demand and retains ~6.7 kWh (~41%) reserve at 9:00 AM for cloudy mornings, extending battery lifespan to 10+ years.',
    16.5,
    false
  );

  // Row 4: Battery Extended
  drawSpecRow(
    '4. Battery Bank\n(Extended Rainy Autonomy)',
    '96V 250Ah LiFePO4\n(24.0 kWh DC | ~20.5 kWh usable AC)',
    'Optional upgrade for 100% grid-free reliability during monsoon/cloudy spells; retains ~10.7 kWh in the morning—enough for a full extra night of backup.',
    16.5,
    true
  );

  // Row 5: Charge Controller
  drawSpecRow(
    '5. Charge Controller',
    'Built-in 80A–100A MPPT\n(PV Max Input ≥ 9.0 kW)',
    'Delivers fast daytime charging (~7.5–9.0 kW DC charging capacity) so the battery bank reaches 100% State of Charge within 4 peak sun hours.',
    15.0,
    false
  );

  curY += 7.5;

  // Section 4: Engineering Calculations & Array Stringing
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('4. Engineering Calculations & Array Stringing', marginX, curY);

  curY += 5.5;

  const eng1 = '•  Inverter Surge & Power Factor Check: Running 25 fans (1,875 W), 25 bulbs (250 W), and 1 laptop (65 W) equals 2,190 W. When the 1 HP pump starts (~2,200 W inrush surge), instantaneous demand reaches ~4,390 W (~5.49 kVA at 0.8 PF). A 7.5 kVA PCU ensures safe headroom.';
  const eng1Lines = doc.splitTextToSize(eng1, contentWidth - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(...colors.textDark);
  doc.text(eng1Lines, marginX + 1, curY);
  curY += (eng1Lines.length * 4.1) + 2.5;

  const eng2 = '•  Why Lithium (LiFePO4) Over Lead-Acid: Without grid charging, C10 Lead-Acid batteries suffer chronic undercharging during cloudy days (sulfation) and offer only 50%–60% usable capacity. LiFePO4 provides 90% Depth of Discharge, 96%+ charging efficiency, and rapid recharge during short sunny windows.';
  const eng2Lines = doc.splitTextToSize(eng2, contentWidth - 2);
  doc.text(eng2Lines, marginX + 1, curY);
  curY += (eng2Lines.length * 4.1) + 2.5;

  const eng3 = '•  PV String Configuration (16 × 550W = 8.80 kW): For high-Voc MPPT PCUs (Max Voc 450V–500V), wire in 8 Series × 2 Parallel (8S × 2P) (Vmp ≈ 336V, Voc ≈ 400V). For standard 96V MPPT PCUs (Max Voc 250V), wire in 4 Series × 4 Parallel (4S × 4P) (Vmp ≈ 168V, Voc ≈ 200V).';
  const eng3Lines = doc.splitTextToSize(eng3, contentWidth - 2);
  doc.text(eng3Lines, marginX + 1, curY);

  // ==========================================
  // PAGE 3: BOS Checklist & Operational Tips
  // ==========================================
  doc.addPage();
  drawPageBackground(3);

  curY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('5. Balance of System (BOS) & Protection Checklist', marginX, curY);

  curY += 6.5;

  // BOS Table: Component (36mm) | Recommended Rating & Standard (56mm) | Application (90mm) = 182mm
  const bColW = [36, 56, 90];
  const bColX = [marginX, marginX + bColW[0], marginX + bColW[0] + bColW[1]];

  doc.setFillColor(...colors.tableHeaderBg);
  doc.rect(marginX, curY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(255, 255, 255);
  doc.text('BOS Component', bColX[0] + 2.5, curY + 4.8);
  doc.text('Recommended Rating & Standard', bColX[1] + 2.5, curY + 4.8);
  doc.text('Application', bColX[2] + 2.5, curY + 4.8);
  curY += 7;

  function drawBosRow(comp, rating, app, height, isAlt = false) {
    if (isAlt) {
      doc.setFillColor(...colors.tableRowAlt);
      doc.rect(marginX, curY, contentWidth, height, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX, curY, contentWidth, height, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(marginX, curY, contentWidth, height, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...colors.navySecondary);
    const compLines = doc.splitTextToSize(comp, bColW[0] - 4);
    doc.text(compLines, bColX[0] + 2.5, curY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...colors.textDark);
    const ratLines = doc.splitTextToSize(rating, bColW[1] - 4);
    doc.text(ratLines, bColX[1] + 2.5, curY + 4.5);

    const appLines = doc.splitTextToSize(app, bColW[2] - 4);
    doc.text(appLines, bColX[2] + 2.5, curY + 4.5);

    curY += height;
  }

  drawBosRow(
    'DC Distribution\nBox (DCDB)',
    '600V / 1000V DC Type-2 SPD + 20A DC MCB / gPV Fuse per string',
    'Protects MPPT input against lightning surges and string overcurrent.',
    13.0,
    false
  );

  drawBosRow(
    'AC Distribution\nBox (ACDB)',
    '40A Double-Pole MCB + 275V AC Type-2 SPD',
    'Output short-circuit, overload, and surge protection for building load.',
    12.0,
    true
  );

  drawBosRow(
    'DC & Battery\nCabling',
    '6 sq. mm UV-resistant DC Solar Cable; 35 sq. mm Copper Battery Cable',
    'Minimizes voltage drop (<1.5%) between roof array, PCU, and battery.',
    13.0,
    false
  );

  drawBosRow(
    'Earthing &\nLightning',
    '3 Dedicated Chemical Earthing Pits (AC, DC, LA) + Copper Lightning Arrestor',
    'Mandatory safety grounding for high-voltage DC array and PCU chassis.',
    13.0,
    true
  );

  curY += 9.5;

  // Operational & Efficiency Recommendations Callout Box
  const recBoxH = 46;
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(marginX, curY, contentWidth, recBoxH, 2, 2, 'F');
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, curY, contentWidth, recBoxH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('Operational & Efficiency Recommendations (Shri Trutiyadev Solar Enterprises):', marginX + 3.5, curY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(...colors.textDark);
  let recY = curY + 12.0;

  const r1 = '1.  Evening Pump Timing: Operate the evening 1-hour water pump between 4:30 PM and 6:00 PM to utilize late-afternoon solar irradiance and minimize deep discharge stress on the battery.';
  const r1Lines = doc.splitTextToSize(r1, contentWidth - 7);
  doc.text(r1Lines, marginX + 3.5, recY);
  recY += (r1Lines.length * 4.2) + 2.5;

  const r2 = '2.  Optional BLDC Fan Upgrade: Replacing standard 75W ceiling fans with 30W–35W BLDC fans cuts daytime fan consumption from 13.13 kWh to ~5.6 kWh, saving ~7.5 Units/day and adding over 50% extra cloudy-day battery autonomy.';
  const r2Lines = doc.splitTextToSize(r2, contentWidth - 7);
  doc.text(r2Lines, marginX + 3.5, recY);

  curY += recBoxH + 11.0;

  // Client Approval & Signature Block
  const sigBoxW = (contentWidth - 6) / 2;
  const sigBoxH = 26;

  // Prepared By Box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...colors.navyPrimary);
  doc.text('PREPARED & CERTIFIED BY:', marginX + 3.5, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(...colors.textDark);
  doc.text('Lead Solar System Design Engineer', marginX + 3.5, curY + 10.5);
  doc.text('Shri Trutiyadev Solar Enterprises, Odisha', marginX + 3.5, curY + 15.0);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...colors.textMuted);
  doc.text('Signature & Official Seal', marginX + 3.5, curY + 22.0);

  // Client Acceptance Box
  const clientX = marginX + sigBoxW + 6;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(clientX, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(clientX, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...colors.emeraldAccent);
  doc.text('CLIENT ACCEPTANCE & CONFIRMATION:', clientX + 3.5, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(...colors.textDark);
  doc.text('Authorized Signatory / Project Head', clientX + 3.5, curY + 10.5);
  doc.text('Date: _________________________________', clientX + 3.5, curY + 15.0);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...colors.textMuted);
  doc.text('Client Signature', clientX + 3.5, curY + 22.0);

  return doc;
}

// Generate and write PDF
const doc = createPdf();
const outBuffer = Buffer.from(doc.output('arraybuffer'));

// Output paths
const targetWorkspacePath = path.resolve('..', 'Shri_Trutiyadev_Pure_OffGrid_Solar_Technical_Proposal.pdf');
const targetArtifactPath = path.resolve('C:\\Users\\AMAR CHAND MOHANTY\\.gemini\\antigravity\\brain\\bd9e5f22-8905-4f53-9d81-561d46d51fee', 'Shri_Trutiyadev_Pure_OffGrid_Solar_Technical_Proposal.pdf');

fs.writeFileSync(targetWorkspacePath, outBuffer);
console.log(`Saved workspace PDF: ${targetWorkspacePath}`);

try {
  fs.writeFileSync(targetArtifactPath, outBuffer);
  console.log(`Saved artifact PDF: ${targetArtifactPath}`);
} catch (e) {
  console.log('Artifact save warning:', e.message);
}
