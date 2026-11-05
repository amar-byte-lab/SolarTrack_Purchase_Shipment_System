/**
 * sizing-schematic.js — Single Line & Schematic Circuit Diagram Component
 * Interactive, responsive, high-detail electrical Single Line Diagram (SLD)
 * for Solar PV and Inverter-Battery systems (On-Grid, Off-Grid, Hybrid, Without Solar).
 *
 * Adheres to Indian & International Electrical Standards:
 * - IS/IEC 60364, IEC 62548, IS 3043 (Earthing Practice), CEA Regulations
 * - DC Wiring: Positive (+) Bright Red, Negative (-) Black
 * - AC Single/Three Phase: Phase (L/R) Red/Orange, Neutral (N) Cyan Dashed, PE Striped Green
 * - Dedicated Separate Earth Pits: LA Earth Pit, DC Earth Pit, AC Earth Pit
 */

(function () {
  'use strict';

  // State Management
  const sldState = {
    currentSystem: 'off-grid',
    theme: 'dark', // 'dark' (blueprint) or 'light' (engineering white)
    inlineZoom: 1,
    inlinePan: { x: 0, y: 0 },
    modalZoom: 1,
    modalPan: { x: 0, y: 0 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    activeTarget: null,
    selectedComponentId: null
  };

  // Comprehensive Engineering Specifications Database for Interactive Tooltips
  const COMPONENT_DETAILS = {
    // ON-GRID COMPONENTS
    'la-ongrid': {
      title: '⚡ Lightning Arrester (LA)',
      type: 'Early Streamer Emission (ESE) / Franklin Rod Terminal',
      location: 'Highest Point on Rooftop / Parapet',
      specs: 'Class I/II Protection, 10/350µs Impulse Current: 25kA',
      connections: 'Dedicated 25x3 mm Copper / GI Down-Conductor',
      grounding: 'Direct low-impedance route to Dedicated LA Earth Pit (< 5Ω)',
      standards: 'IEC 62305 / IS 2309 Standards'
    },
    'pv-ongrid': {
      title: '☀️ Solar PV Array (Grid-Tied Strings)',
      type: 'Mono PERC / TOPCon Bifacial Modules (16-24 Panels/String)',
      location: 'Elevated Rooftop Anodized Aluminium Mounting Structure',
      specs: 'Voc: 48.5V per module | String Voc: ~580V DC | Imp: 13.5A | STC Power: 550Wp/module',
      connections: '4 sq.mm UV-Resistant Dual-Insulated Solar DC Cables with MC4 Connectors',
      grounding: 'Module Frames & Structure Bonded to DC Earth Pit via 10 sq.mm Green Conductor',
      standards: 'IEC 61215 / IEC 61730 / IS 14286'
    },
    'dcdb-ongrid': {
      title: '🛡️ DC Distribution Box (DCDB)',
      type: '1-In / 1-Out or 2-In / 2-Out Solar DC Protection Enclosure',
      location: 'Near Inverter / Inbound DC Array Entry',
      specs: '1000V DC Rotary Isolator (32A) + 15A/20A gPV Cylindrical Cartridge Fuses (+ & -)',
      protection: 'Type II DC Surge Protection Device (SPD): Uc 1000V DC, In 20kA, Imax 40kA, Up < 3.8kV',
      connections: 'DC (+) Bright Red, DC (-) Black 4/6 sq.mm Cables',
      grounding: 'SPD Ground Terminal routed directly to DC Earth Pit',
      standards: 'IEC 61643-31 / IEC 60269-6'
    },
    'gti-ongrid': {
      title: '⚡ Grid-Tied Inverter (GTI / On-Grid)',
      type: 'Transformerless Pure Sine Wave Grid-Interactive Inverter',
      location: 'Well-Ventilated Indoor / Shaded Outdoor Wall',
      specs: 'Efficiency: 98.4% | Dual MPPT (150V-550V DC) | AC Output: 230V 1-Phase / 415V 3-Phase 50Hz',
      protection: 'Anti-Islanding Protection (IEEE 1547 / UL 1741), Overvoltage, Ground Fault (GFCI)',
      connections: 'DC Input: (+/-) Terminals | AC Output: L, N, PE Terminals',
      grounding: 'Double Chassis / Enclosure Grounding to AC Earth Pit',
      standards: 'IEC 62109-1/-2, IEC 61727, VDE-AR-N 4105'
    },
    'acdb-ongrid': {
      title: '⚡ AC Distribution Box (ACDB)',
      type: 'Industrial AC Protection Sub-Assembly',
      location: 'Adjacent to Grid-Tied Inverter',
      specs: '2-Pole / 4-Pole Class C MCB (32A/63A, 10kA breaking capacity)',
      protection: 'Type II AC SPD: Uc 320V/440V, In 20kA, Imax 40kA with fast MOV varistors',
      connections: 'Inverter AC Feed in -> Output to Bi-Directional Net Meter',
      grounding: 'ACDB Enclosure & SPD Ground bonded to AC Earth Pit',
      standards: 'IEC 60947-2 / IS/IEC 60898-1'
    },
    'netmeter-ongrid': {
      title: '🔄 Bi-Directional Net Meter',
      type: '4-Quadrant Smart Electronic Utility Net Meter',
      location: 'Main Consumer Incomer / Boundary EB Meter Board',
      specs: 'Registers Import kWh (Grid to Consumer) and Export kWh (Solar Surplus to Grid)',
      connections: 'Bi-directional Phase (L), Neutral (N), Utility Ground (PE)',
      grounding: 'Meter casing earthing via Distribution Board busbar',
      standards: 'IS 13779 / CEA Net-Metering Regulations 2021'
    },
    'grid-ongrid': {
      title: '🏭 Utility Grid / Electricity Board (EB)',
      type: 'State DISCOM 1-Phase 230V / 3-Phase 415V LT Distribution',
      location: 'Local Distribution Substation / Transformer Pole',
      specs: '50 Hz ± 1%, Grid Impedance: Low, Unlimited Fault Current Source',
      connections: 'Service cable drop to Consumer Net Meter',
      grounding: 'DISCOM Distribution Neutral Ground at Distribution Transformer'
    },
    'loads-ongrid': {
      title: '🏠 Home LT Distribution & Appliances',
      type: 'Connected Consumer Single/Three Phase Loads',
      location: 'Residential / Commercial Premises',
      specs: '230V 50Hz, Total load fed dynamically from Solar + Grid Import',
      connections: 'Phase (L) and Neutral (N) with dedicated 2.5 sq.mm PE earth loops',
      grounding: 'Appliance 3-pin earth lugs bonded to AC/Home Earth Busbar'
    },

    // OFF-GRID COMPONENTS
    'pv-offgrid': {
      title: '☀️ Solar PV Array (Off-Grid Strings)',
      type: 'High-Efficiency Crystalline Solar Panels',
      location: 'Rooftop Anodized Aluminium Mounting Structure',
      specs: 'Voc: ~48V per panel | Series/Parallel String Voc: ~140V-200V DC | Imp: 18A-26A',
      connections: 'DC Positive (+) Bright Red, DC Negative (-) Black 6 sq.mm Cable',
      grounding: 'Module Frames bonded to DC Earth Pit via copper earthing lead',
      standards: 'IEC 61215 / MNRE Off-Grid Standards'
    },
    'dcdb-offgrid': {
      title: '🛡️ DCDB (DC Fuse & SPD Box)',
      type: 'DC Protection Enclosure for Off-Grid Array',
      location: 'Between Solar Array and PCU',
      specs: '1000V DC 25A gPV Cartridge Fuses (+ & -) + Type II DC SPD',
      protection: 'Clamps high-voltage lightning surges to safe potential',
      connections: 'DC Array (+/-) In -> DC Out to PCU MPPT Terminals',
      grounding: 'SPD Ground Lug wired directly to DC Earth Pit',
      standards: 'IEC 61643-31'
    },
    'pcu-offgrid': {
      title: '⚡ Off-Grid Solar PCU (Power Conditioning Unit)',
      type: 'Integrated MPPT Solar Charger + Pure Sine Wave Inverter',
      location: 'Indoor Equipment Room / Utility Area',
      specs: 'Internal 50A-80A MPPT | Pure Sine Wave 230V 50Hz Inverter | Efficiency: 93%',
      logic: 'Intelligent Priority Controller: 1st Solar -> 2nd Battery -> 3rd Grid Bypass',
      connections: 'PV DC (+/-), Battery DC (+/-), Aux Grid AC IN, Inverter AC OUT (L, N, PE)',
      grounding: 'Metal Enclosure double-grounded to AC/Equipment Earth Pit',
      standards: 'IEC 62109, IS 16221'
    },
    'battery-offgrid': {
      title: '🔋 Deep Cycle Battery Bank',
      type: 'Tubular Deep-Cycle Lead-Acid (C10) or Lithium LiFePO4 (0.5C/1C)',
      location: 'Heavy-Duty Acid-Resistant Battery Rack',
      specs: 'System Voltage: 12V / 24V / 48V / 96V DC | Capacity: 150Ah - 300Ah',
      protection: 'Heavy-Duty DC Breaker / HRC Fuse on Battery Positive Cable',
      connections: '25-35 sq.mm Flexible Copper Battery Cables with Pressed Lug Boots',
      grounding: 'Battery Metal Rack & Safety Ground bonded to AC/Equipment Earth',
      standards: 'IS 13369 / IS 16046 (Lithium)'
    },
    'aux-grid-offgrid': {
      title: '🔌 Auxiliary EB / DG Bypass Input',
      type: 'Grid / Diesel Generator Auxiliary Feed',
      location: 'Service Input to PCU AC In Port',
      specs: 'Single Phase 230V AC 50Hz for Emergency Rainy Season Charging',
      connections: 'Phase (L), Neutral (N), Utility Earth (PE)',
      grounding: 'Ground linked to main electrical service earth'
    },
    'acdb-offgrid': {
      title: '⚡ ACDB / Output Distribution Sub-Panel',
      type: 'Inverter Output Protection & Distribution Board',
      location: 'Output side of Off-Grid PCU',
      specs: 'Double-Pole Inverter Output MCB (16A/25A) + Isolated Neutral Busbar',
      connections: 'Inverter Phase (L) and Isolated Inverter Neutral (N)',
      grounding: 'Ground Busbar connected to AC Earth Pit'
    },
    'loads-offgrid': {
      title: '💡 Dedicated Backup / Inverter Loads',
      type: 'Critical Protected Household / Commercial Appliances',
      location: 'Interior Distribution Circuits',
      specs: 'Ceiling Fans, LED Lights, Refrigerators, Wi-Fi Routers, Computers & Televisions',
      connections: 'Fed strictly from PCU Inverter Output (Isolated from Grid Outages)',
      grounding: 'All appliance chassis bonded to Equipment Earth'
    },

    // HYBRID COMPONENTS
    'pv-hybrid': {
      title: '☀️ Solar PV Array (Dual Strings PV1 & PV2)',
      type: 'High-Efficiency Bifacial Mono PERC / N-Type Cells',
      location: 'Dual-Oriented Rooftop Structure',
      specs: 'String 1 & String 2 Voc: ~450V DC each | Dual MPPT Tracking',
      connections: 'Two pairs of 4 sq.mm DC Solar Cables (+ & -)',
      grounding: 'Structure bonded with solid copper wire to DC Earth Pit'
    },
    'dcdb-hybrid': {
      title: '🛡️ Dual-String DCDB',
      type: 'Multi-Channel DC Protection Panel',
      location: 'Inverter DC Input Entry',
      specs: 'Dual 1000V DC Isolators, 4x 15A gPV Fuses, Dual Type II DC SPDs',
      connections: 'PV1 (+/-) & PV2 (+/-) Inputs -> Hybrid Inverter MPPT1 & MPPT2',
      grounding: 'Both SPD ground lugs tied to DC Earth Pit'
    },
    'inverter-hybrid': {
      title: '🔄 Hybrid Bi-Directional Inverter',
      type: 'Grid-Tied + Battery Energy Storage Bi-Directional Converter',
      location: 'Utility Room / Plant Wall',
      specs: 'Dual MPPT + 48V/HV DC Battery Bi-Directional Port + Dual AC Ports (Grid + EPS)',
      features: '< 10ms Automatic Transfer Switch (ATS) for Zero-Downtime UPS capability',
      connections: 'PV Inputs, Battery Bus, Grid Port (L, N, PE), EPS Backup Port (L, N, PE)',
      grounding: 'Dual Chassis Ground terminals wired to AC/ESS Earth Pit'
    },
    'battery-hybrid': {
      title: '🔋 Energy Storage System (LiFePO4 ESS)',
      type: 'Smart Lithium Iron Phosphate Battery with Integrated BMS',
      location: 'Floor-Mounted Battery Cabinet',
      specs: 'Nominal Voltage: 48V / 51.2V | DOD: 90% | CAN / RS485 Communication with Inverter',
      protection: 'Built-in 100A/125A DC Isolator Breaker + BMS Over-current/Thermal Cutoff',
      connections: 'Bi-Directional Heavy DC Copper Bus (+ Red, - Black) + RJ45 Data Cable',
      grounding: 'Cabinet Frame bonded to AC/ESS Earth Pit'
    },
    'acdb-grid-hybrid': {
      title: '⚡ Grid-Side ACDB',
      type: 'Grid-Interactive Protection Board',
      location: 'Between Inverter Grid Port and Net Meter',
      specs: '4-Pole/2-Pole AC MCB + Type II AC SPD',
      connections: 'Bi-directional AC Feed to Utility Net Meter and Non-Essential Home Loads',
      grounding: 'Grounded to AC Earth Pit'
    },
    'netmeter-hybrid': {
      title: '🔄 Bi-Directional Net Meter',
      type: '4-Quadrant Smart Metering Terminal',
      location: 'Utility Supply Boundary',
      specs: 'Imports from EB when solar+battery depleted; Exports surplus green solar energy to EB',
      connections: 'Utility Grid <-> Consumer Distribution'
    },
    'grid-hybrid': {
      title: '🏭 Utility Grid / Electricity Board',
      type: 'DISCOM LT Grid Feed (230V 1-Ph / 415V 3-Ph)',
      location: 'External Utility Supply',
      specs: 'Provides grid backup and receives exported clean solar electricity'
    },
    'subdb-eps-hybrid': {
      title: '🛡️ EPS / Backup Sub-Panel',
      type: 'Critical Load Sub-Distribution Board',
      location: 'Downstream of Inverter EPS / UPS Port',
      specs: 'Fed through <10ms ATS; powers critical loads uninterrupted during grid blackouts',
      connections: 'EPS Line (L), Isolated Backup Neutral (N), Ground (PE)',
      grounding: 'Dedicated sub-panel earth linked to AC Earth Pit'
    },
    'loads-critical-hybrid': {
      title: '💡 Essential Backup Loads (EPS)',
      type: 'Protected Priority Circuits',
      location: 'Interior Circuits',
      specs: 'Lighting, Fans, Refrigerator, Wi-Fi, Security Cameras & Sensitive Electronics (Never loses power)'
    },
    'loads-noncritical-hybrid': {
      title: '❄️ Non-Essential / Heavy Loads',
      type: 'High-Wattage Grid-Dependent Appliances',
      location: 'Direct Grid / Main DB Circuits',
      specs: 'Air Conditioners, Heat Pumps, Water Heaters, EV Car Charger (Shed during grid outage)'
    },

    // WITHOUT SOLAR COMPONENTS
    'grid-withoutsolar': {
      title: '🏭 Utility EB Grid Service Feed',
      type: 'Incoming DISCOM LT Overhead / Underground Service Line',
      location: 'Consumer Property Incomer',
      specs: 'Single Phase 230V / Three Phase 415V 50Hz Standard Utility Feed',
      connections: 'Phase (L), Neutral (N), Utility Earth Wire (PE)',
      grounding: 'Supplier Grounding System'
    },
    'meter-withoutsolar': {
      title: '⚡ Energy Meter (EB Billing Meter)',
      type: 'Single / Three Phase Electronic Revenue Meter',
      location: 'Meter Board at Property Entrance',
      specs: 'Records Total Active Energy (kWh) consumed from DISCOM',
      connections: 'Incomer Service Cable -> Outgoing to Main Distribution Board'
    },
    'mdb-withoutsolar': {
      title: '🏢 Main Distribution Board (MDB)',
      type: 'Main Service Panel with Earth Leakage Protection',
      location: 'Main Electrical Panel Room / Hallway',
      specs: 'Main DP MCB (32A/40A) + 30mA ELCB / RCCB (Residual Current Circuit Breaker)',
      protection: 'Protects entire premises against short circuits, overloads, and human touch leakage',
      connections: 'Phase busbar, Neutral busbar, Earthing busbar',
      grounding: 'Direct heavy link to Consumer / EB Earth Pit (< 5Ω)'
    },
    'heavyloads-withoutsolar': {
      title: '❄️ Non-Backup Heavy Appliances',
      type: 'High Consumption Utility-Only Loads',
      location: 'Direct Circuits from Main MDB',
      specs: 'Air Conditioners (1.5 - 2 Ton), Geyser / Water Heaters (2-3 kW), Water Pumping Motor (1-2 HP)',
      operation: 'Directly powered by EB Grid; automatically cut off during power outages to protect UPS'
    },
    'ups-withoutsolar': {
      title: '⚡ Home UPS / Inverter Unit',
      type: 'Microcontroller Pure Sine Wave Home UPS Inverter-Charger',
      location: 'Utility Area / Inverter Trolley',
      specs: 'Rating: 900VA - 2500VA | Transfer Time: < 15ms | Automatic Multi-Stage Battery Charger',
      operation: 'Grid Healthy: Charges battery and bypasses grid to loads | Grid Down: Instantly inverts DC to 230V AC',
      connections: 'Input 3-Pin Wall Plug (L, N, PE) -> Battery DC Terminals (+/-) -> Output 3-Pin / Sub-DB',
      grounding: 'Chassis ground via 3-pin plug earth pin to MDB Earth Busbar'
    },
    'battery-withoutsolar': {
      title: '🔋 Inverter Battery Bank',
      type: 'Tall Tubular Lead-Acid (12V / 24V) or Inverter Lithium Battery',
      location: 'Heavy-Duty Inverter Trolley / Battery Stand',
      specs: 'Voltage: 12V (Single) or 24V (Twin Series) | Capacity: 150Ah - 220Ah (C20 Rating)',
      connections: 'Heavy-duty copper battery cables with insulated safety terminal boots',
      protection: 'Terminals covered with anti-corrosion petroleum jelly and shroud covers'
    },
    'subdb-withoutsolar': {
      title: '🛡️ Backup Sub-Distribution Board',
      type: 'Inverter Output Distribution Panel',
      location: 'Downstream of Home UPS Output',
      specs: 'Single-Pole MCBs (6A/10A) feeding individual inverter backup circuits',
      connections: 'Inverter Phase (L), Inverter Neutral (N), Equipment Earth (PE)'
    },
    'criticalloads-withoutsolar': {
      title: '💡 Critical Backup Household Loads',
      type: 'Essential Home Lighting & Communication Loads',
      location: 'Living Rooms, Bedrooms & Kitchen',
      specs: 'Ceiling Fans, LED Bulbs & Tubes, Wi-Fi Router, Television, Phone / Laptop Chargers'
    },

    // EARTH PITS
    'pit-la': {
      title: '⏚ LA Earth Pit (Lightning Arrester)',
      type: 'Dedicated Chemical Compound Lightning Earth Pit',
      location: 'External Ground / Outdoor Earth Yard (Minimum 3m away from other pits)',
      specs: 'Heavy Copper-Bonded Steel Rod (3m long, 17.2mm dia) encased in Carbon / Bentonite Compound',
      resistance: 'Earth Resistance strictly < 5 Ohms (Ideally < 3 Ohms)',
      function: 'Safely dissipates direct lightning surge strokes without back-feeding into building wiring',
      standards: 'IS 3043:2018 / IEC 62305'
    },
    'pit-dc': {
      title: '⏚ DC Earth Pit (Solar Array & DCDB)',
      type: 'Dedicated Solar DC Grounding Pit',
      location: 'Near Inbound Solar Cable Riser in Outdoor Earth Yard',
      specs: 'Copper-Bonded Rod with Earth Chamber & Testing Link',
      connectedTo: '1. Rooftop Solar Module Aluminium Mounting Structure\n2. DCDB Type II SPD Earth Terminal',
      resistance: '< 5 Ohms per MNRE / CEA Guidelines',
      standards: 'IEC 62548 / IS 3043'
    },
    'pit-ac': {
      title: '⏚ AC Earth Pit (Inverter & ACDB)',
      type: 'Equipment Protective Earth (PE) Grounding Pit',
      location: 'External Earth Yard near Main Incomer',
      specs: 'Copper Bonded Electrode in Low-Resistivity Conductive Backfill Compound',
      connectedTo: '1. Inverter Metal Enclosure (Body)\n2. ACDB Enclosure & AC SPD Earth\n3. Neutral Ground where specified',
      resistance: '< 5 Ohms',
      standards: 'IS 3043 / IS/IEC 60364'
    },
    'pit-consumer': {
      title: '⏚ Consumer / EB Utility Earth Pit',
      type: 'Main Low-Voltage Consumer Earth Pit',
      location: 'Property Boundary / Meter Room',
      specs: 'GI / Copper Plate or Chemical Rod Pit with inspection test well',
      connectedTo: 'Main Distribution Board Earthing Busbar, extending to UPS plug and appliance sockets',
      resistance: '< 5 Ohms per Indian Electricity Rules',
      standards: 'IS 3043:2018'
    }
  };

  /**
   * Generates shared SVG definitions (gradients, filters, marker arrowheads, patterns).
   */
  function getSharedDefs() {
    return `
      <defs>
        <!-- Arrowhead Markers -->
        <marker id="arr-dc-pos" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
        </marker>
        <marker id="arr-dc-neg" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
        </marker>
        <marker id="arr-ac-phase" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
        </marker>
        <marker id="arr-ac-neutral" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>
        <marker id="arr-earth" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16a34a" />
        </marker>
        <marker id="arr-bidi-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#0284c7" />
        </marker>
        <marker id="arr-bidi-end" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>

        <!-- Drop Shadows & Glow Filters -->
        <filter id="box-shadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.12" />
        </filter>
        <filter id="box-shadow-dark" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.45" />
        </filter>
        <filter id="glow-line" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <!-- Striped Ground Wire Pattern (Green & Yellow) -->
        <pattern id="pe-stripe" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#16a34a" stroke-width="4" />
          <line x1="4" y1="0" x2="4" y2="8" stroke="#eab308" stroke-width="4" />
        </pattern>

        <!-- Solar Cells Mesh Pattern -->
        <pattern id="pv-cell-grid" width="16" height="24" patternUnits="userSpaceOnUse">
          <rect width="16" height="24" fill="#0f172a" stroke="#38bdf8" stroke-width="0.75" />
          <line x1="8" y1="0" x2="8" y2="24" stroke="#94a3b8" stroke-width="0.3" stroke-dasharray="2,2" />
        </pattern>

        <!-- Component Box Gradients -->
        <linearGradient id="grad-pv" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0369a1" />
        </linearGradient>
        <linearGradient id="grad-box-dark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="grad-box-light" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
        <linearGradient id="grad-inverter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
        <linearGradient id="grad-battery" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0d9488" />
          <stop offset="100%" stop-color="#0f766e" />
        </linearGradient>
        <linearGradient id="grad-pit" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#78350f" />
          <stop offset="100%" stop-color="#451a03" />
        </linearGradient>
      </defs>
    `;
  }

  /**
   * Helper to format an interactive SVG component box.
   */
  function makeBox({ id, x, y, w, h, title, subtitle, badge, badgeColor = '#3b82f6', isDark = true, icon = '' }) {
    const bgFill = isDark ? '#111e38' : '#ffffff';
    const borderStroke = isDark ? '#263b63' : '#cbd5e1';
    const titleFill = isDark ? '#f8fafc' : '#0f172a';
    const subFill = isDark ? '#94a3b8' : '#64748b';
    const shadowFilter = isDark ? 'url(#box-shadow-dark)' : 'url(#box-shadow)';

    return `
      <g class="sld-interactive-item" data-comp-id="${id}" cursor="pointer">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8" 
          fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.6" filter="${shadowFilter}" 
          class="sld-box-rect" />
        
        <!-- Header Ribbon / Icon -->
        <g transform="translate(${x + 10}, ${y + 14})">
          <text x="0" y="0" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${titleFill}">
            ${icon} ${title}
          </text>
        </g>
        
        <!-- Subtitle / Type -->
        <g transform="translate(${x + 10}, ${y + 30})">
          <text x="0" y="0" font-family="system-ui, sans-serif" font-size="9" font-weight="500" fill="${subFill}">
            ${subtitle}
          </text>
        </g>
        
        <!-- Technical Badge -->
        ${badge ? `
          <rect x="${x + 10}" y="${y + h - 22}" width="${w - 20}" height="15" rx="3" fill="${badgeColor}" fill-opacity="0.15" stroke="${badgeColor}" stroke-width="0.8" />
          <text x="${x + w / 2}" y="${y + h - 11}" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${badgeColor}" text-anchor="middle">
            ${badge}
          </text>
        ` : ''}
      </g>
    `;
  }

  /**
   * Helper to format an Earth Pit Symbol & Rod in the SVG.
   */
  function makeEarthPit({ id, x, y, name, tag, code, isDark = true }) {
    const textFill = isDark ? '#f8fafc' : '#0f172a';
    const subFill = isDark ? '#4ade80' : '#15803d';
    const pitBg = isDark ? '#1a2234' : '#f1f5f9';
    const border = isDark ? '#22c55e' : '#16a34a';

    return `
      <g class="sld-interactive-item sld-earth-pit-item" data-comp-id="${id}" cursor="pointer" transform="translate(${x}, ${y})">
        <!-- Earth Pit Enclosure Chamber -->
        <rect x="-38" y="-12" width="76" height="52" rx="6" fill="${pitBg}" stroke="${border}" stroke-width="1.4" />
        
        <!-- Ground / Earthing Symbol (⏚) -->
        <line x1="0" y1="-2" x2="0" y2="12" stroke="#16a34a" stroke-width="2.5" />
        <line x1="-12" y1="12" x2="12" y2="12" stroke="#16a34a" stroke-width="2.5" />
        <line x1="-8" y1="17" x2="8" y2="17" stroke="#16a34a" stroke-width="2" />
        <line x1="-4" y1="22" x2="4" y2="22" stroke="#16a34a" stroke-width="1.5" />
        
        <!-- Earth Pit Labels -->
        <text x="0" y="32" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="${textFill}" text-anchor="middle">${name}</text>
        <text x="0" y="47" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="${subFill}" text-anchor="middle">${tag}</text>
        <text x="0" y="58" font-family="system-ui, sans-serif" font-size="6.5" font-weight="500" fill="${isDark ? '#94a3b8' : '#64748b'}" text-anchor="middle">${code}</text>
      </g>
    `;
  }

  /**
   * Helper to format terminal connection pin dots (+, -, L, N, PE).
   */
  function makeTerminal(x, y, label, type = 'dc-pos') {
    let fill = '#ef4444';
    let text = label;
    if (type === 'dc-neg') fill = '#1e293b';
    if (type === 'ac-phase') fill = '#dc2626';
    if (type === 'ac-neutral') fill = '#0284c7';
    if (type === 'earth') fill = '#16a34a';

    return `
      <g transform="translate(${x}, ${y})">
        <circle cx="0" cy="0" r="6" fill="${fill}" stroke="#ffffff" stroke-width="1.2" />
        <text x="0" y="2.5" font-family="system-ui, sans-serif" font-size="6.5" font-weight="800" fill="#ffffff" text-anchor="middle">${text}</text>
      </g>
    `;
  }

  /* =========================================================================
     1. ON-GRID SOLAR SYSTEM (Grid-Tied / GTI)
     ========================================================================= */
  function getOnGridSvg(isDark) {
    const bgFill = isDark ? '#0b1329' : '#f8fafc';
    const conductorText = isDark ? '#94a3b8' : '#475569';

    return `
      <svg viewBox="0 0 1020 540" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        ${getSharedDefs()}
        <rect width="1020" height="540" fill="${bgFill}" />

        <!-- Engineering Grid Watermark (Light dashed grid) -->
        <g opacity="${isDark ? '0.07' : '0.04'}" stroke="#38bdf8" stroke-width="1">
          <line x1="0" y1="130" x2="1020" y2="130" stroke-dasharray="4,4" />
          <line x1="0" y1="230" x2="1020" y2="230" stroke-dasharray="4,4" />
          <line x1="0" y1="360" x2="1020" y2="360" stroke-dasharray="4,4" />
          <line x1="220" y1="0" x2="220" y2="540" stroke-dasharray="4,4" />
          <line x1="420" y1="0" x2="420" y2="540" stroke-dasharray="4,4" />
          <line x1="620" y1="0" x2="620" y2="540" stroke-dasharray="4,4" />
          <line x1="820" y1="0" x2="820" y2="540" stroke-dasharray="4,4" />
        </g>

        <!-- Title Banner -->
        <g transform="translate(30, 28)">
          <text font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="${isDark ? '#38bdf8' : '#0284c7'}">
            ON-GRID SOLAR PV SYSTEM SCHEMATIC (SINGLE LINE DIAGRAM)
          </text>
          <text y="14" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="${isDark ? '#64748b' : '#94a3b8'}">
            Standard: IEC 62548 / IS 3043 | Tri-Earth Pit System | Bi-Directional Net-Metered Injection
          </text>
        </g>

        <!-- 1. LIGHTNING ARRESTER (ROOFTOP) -->
        <g class="sld-interactive-item" data-comp-id="la-ongrid" cursor="pointer" transform="translate(70, 55)">
          <path d="M 0 0 L 0 35 M -8 35 L 8 35 M 0 0 L -6 12 M 0 0 L 6 12" stroke="#f59e0b" stroke-width="2.5" fill="none" />
          <rect x="-35" y="38" width="70" height="28" rx="4" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="#f59e0b" stroke-width="1.2" />
          <text x="0" y="49" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="${isDark ? '#f8fafc' : '#0f172a'}" text-anchor="middle">⚡ Rooftop LA</text>
          <text x="0" y="60" font-family="system-ui, sans-serif" font-size="6.5" font-weight="600" fill="#f59e0b" text-anchor="middle">ESE / Franklin</text>
        </g>

        <!-- Conductor: LA down to Pit 1 (Striped Yellow/Green copper tape) -->
        <path d="M 70 120 L 70 425" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-earth)" />
        <text x="75" y="270" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#f59e0b" transform="rotate(-90 75 270)">
          25x3 mm Solid Cu / GI Down Conductor
        </text>

        <!-- 2. SOLAR PV ARRAY -->
        ${makeBox({
          id: 'pv-ongrid',
          x: 40,
          y: 130,
          w: 135,
          h: 110,
          title: 'Solar PV Array',
          subtitle: 'Mono PERC / TOPCon',
          badge: 'Voc: ~580V DC | 13.5A',
          badgeColor: '#0284c7',
          isDark,
          icon: '☀️'
        })}
        <!-- Internal Panel Cell Graphic -->
        <g transform="translate(50, 172)">
          <rect x="0" y="0" width="115" height="18" fill="url(#pv-cell-grid)" rx="2" />
        </g>

        <!-- Terminals on PV Array -->
        ${makeTerminal(175, 155, '+', 'dc-pos')}
        ${makeTerminal(175, 175, '-', 'dc-neg')}

        <!-- Structure Earthing Line from PV Frame to DC Earth Pit -->
        <path d="M 105 240 L 105 380 L 255 380 L 255 425" stroke="#16a34a" stroke-width="2" fill="none" marker-end="url(#arr-earth)" />
        <text x="145" y="374" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          Structure Ground (10 sq.mm Cu)
        </text>

        <!-- DC Cables from PV Array to DCDB -->
        <!-- DC Positive (+) -->
        <path d="M 175 155 L 225 155" stroke="#ef4444" stroke-width="3" fill="none" marker-end="url(#arr-dc-pos)" />
        <!-- DC Negative (-) -->
        <path d="M 175 175 L 225 175" stroke="#1e293b" stroke-width="3" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="180" y="148" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">DC (+)</text>
        <text x="180" y="190" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="${isDark ? '#94a3b8' : '#334155'}">DC (-)</text>

        <!-- 3. DC DISTRIBUTION BOX (DCDB) -->
        ${makeBox({
          id: 'dcdb-ongrid',
          x: 225,
          y: 130,
          w: 125,
          h: 110,
          title: 'DCDB Box',
          subtitle: 'Isolator + gPV + SPD',
          badge: 'Type II DC SPD 1000V',
          badgeColor: '#ef4444',
          isDark,
          icon: '🛡️'
        })}
        <!-- Terminals on DCDB -->
        ${makeTerminal(225, 155, '+', 'dc-pos')}
        ${makeTerminal(225, 175, '-', 'dc-neg')}
        ${makeTerminal(350, 155, '+', 'dc-pos')}
        ${makeTerminal(350, 175, '-', 'dc-neg')}

        <!-- SPD Ground Conductor from DCDB to DC Earth Pit -->
        <path d="M 285 240 L 285 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="290" y="320" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 290 320)">
          DC SPD Earth (6 sq.mm)
        </text>

        <!-- DC Cables from DCDB to GTI Inverter -->
        <path d="M 350 155 L 415 155" stroke="#ef4444" stroke-width="3" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 350 175 L 415 175" stroke="#1e293b" stroke-width="3" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="362" y="148" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">4/6 sq.mm</text>

        <!-- 4. GRID-TIED INVERTER (GTI) -->
        ${makeBox({
          id: 'gti-ongrid',
          x: 415,
          y: 120,
          w: 145,
          h: 130,
          title: 'Grid-Tied Inverter',
          subtitle: 'Pure Sine Wave GTI',
          badge: '230V / 415V 50Hz | η>98%',
          badgeColor: '#3b82f6',
          isDark,
          icon: '⚡'
        })}
        <!-- Inverter Conversion Symbol: DC = -> AC ~ -->
        <g transform="translate(487, 168)">
          <circle cx="0" cy="0" r="14" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1.2" />
          <text x="-8" y="-2" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#ef4444">=</text>
          <text x="2" y="4" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#3b82f6">∿</text>
        </g>
        <!-- Inverter Terminals -->
        ${makeTerminal(415, 155, '+', 'dc-pos')}
        ${makeTerminal(415, 175, '-', 'dc-neg')}
        ${makeTerminal(560, 150, 'L', 'ac-phase')}
        ${makeTerminal(560, 170, 'N', 'ac-neutral')}
        ${makeTerminal(560, 190, '⏚', 'earth')}

        <!-- Inverter Dual Chassis Ground to AC Earth Pit -->
        <path d="M 487 250 L 487 390 L 590 390 L 590 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="500" y="384" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          Double Inverter Body Ground (10 sq.mm)
        </text>

        <!-- AC Output from GTI to ACDB -->
        <!-- AC Phase (L) -->
        <path d="M 560 150 L 620 150" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <!-- AC Neutral (N) -->
        <path d="M 560 170 L 620 170" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <!-- AC Earth (PE) -->
        <path d="M 560 190 L 620 190" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="568" y="142" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#dc2626">L (Phase)</text>
        <text x="568" y="165" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#0284c7">N (Neutral)</text>

        <!-- 5. AC DISTRIBUTION BOX (ACDB) -->
        ${makeBox({
          id: 'acdb-ongrid',
          x: 620,
          y: 125,
          w: 120,
          h: 120,
          title: 'ACDB Box',
          subtitle: 'AC MCB + AC SPD',
          badge: 'Class C MCB | 320V SPD',
          badgeColor: '#dc2626',
          isDark,
          icon: '⚡'
        })}
        <!-- Terminals on ACDB -->
        ${makeTerminal(620, 150, 'L', 'ac-phase')}
        ${makeTerminal(620, 170, 'N', 'ac-neutral')}
        ${makeTerminal(620, 190, '⏚', 'earth')}
        ${makeTerminal(740, 150, 'L', 'ac-phase')}
        ${makeTerminal(740, 170, 'N', 'ac-neutral')}

        <!-- ACDB SPD Earth to AC Earth Pit -->
        <path d="M 680 245 L 680 390 L 615 390 L 615 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="685" y="320" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 685 320)">
          ACDB SPD Earth (6 sq.mm)
        </text>

        <!-- Bi-Directional Line between ACDB and Net Meter -->
        <path d="M 740 150 L 795 150" stroke="#0284c7" stroke-width="3" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)" />
        <path d="M 740 170 L 795 170" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" />
        <text x="745" y="142" font-family="system-ui, sans-serif" font-size="7" font-weight="800" fill="#0284c7">
          Bi-Dir Flow ⮂
        </text>

        <!-- 6. BI-DIRECTIONAL NET METER -->
        ${makeBox({
          id: 'netmeter-ongrid',
          x: 795,
          y: 125,
          w: 110,
          h: 120,
          title: 'Net Meter',
          subtitle: 'Dual / Bi-Directional',
          badge: 'Import / Export kWh',
          badgeColor: '#0284c7',
          isDark,
          icon: '🔄'
        })}
        <!-- LCD Display Graphic -->
        <rect x="815" y="165" width="70" height="20" rx="3" fill="${isDark ? '#022c22' : '#dcfce7'}" stroke="#10b981" stroke-width="0.8" />
        <text x="850" y="178" font-family="monospace" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">
          ⮂ 004820 kWh
        </text>
        ${makeTerminal(795, 150, 'L', 'ac-phase')}
        ${makeTerminal(795, 170, 'N', 'ac-neutral')}
        ${makeTerminal(905, 150, 'L', 'ac-phase')}
        ${makeTerminal(905, 170, 'N', 'ac-neutral')}

        <!-- Junction Split between Utility Grid and Home Loads -->
        <circle cx="940" cy="150" r="4" fill="#dc2626" />
        <circle cx="940" cy="170" r="3.5" fill="#0284c7" />
        <path d="M 905 150 L 940 150" stroke="#dc2626" stroke-width="2.8" fill="none" />
        <path d="M 905 170 L 940 170" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" fill="none" />

        <!-- Line Upwards to Utility Grid -->
        <path d="M 940 150 L 940 70 L 950 70" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 945 170 L 945 85 L 950 85" stroke="#0284c7" stroke-width="2" stroke-dasharray="6,3" fill="none" />

        <!-- Line Downwards to Home Loads -->
        <path d="M 940 150 L 940 240 L 950 240" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 945 170 L 945 255 L 950 255" stroke="#0284c7" stroke-width="2" stroke-dasharray="6,3" fill="none" />

        <!-- 7. UTILITY EB GRID -->
        ${makeBox({
          id: 'grid-ongrid',
          x: 935,
          y: 40,
          w: 75,
          h: 75,
          title: 'EB Grid',
          subtitle: 'DISCOM LT Line',
          badge: '230V/415V',
          badgeColor: '#6366f1',
          isDark,
          icon: '🏭'
        })}

        <!-- 8. HOME LT DISTRIBUTION & LOADS -->
        ${makeBox({
          id: 'loads-ongrid',
          x: 935,
          y: 215,
          w: 75,
          h: 85,
          title: 'Home Load',
          subtitle: 'LT Sub-Board',
          badge: 'Lights, AC, TV',
          badgeColor: '#10b981',
          isDark,
          icon: '🏠'
        })}

        <!-- =========================================================================
             EARTHING & GROUNDING PITS SECTION (STRICTLY ISOLATED TRIPLE PITS)
             ========================================================================= -->
        <!-- Ground Line Reference Banner -->
        <line x1="30" y1="425" x2="990" y2="425" stroke="${isDark ? '#334155' : '#cbd5e1'}" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="35" y="420" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="${isDark ? '#64748b' : '#94a3b8'}">
          GROUND LEVEL (TERRESTRIAL SOIL HORIZON) ─────────────────────────────────────────────────────────────────
        </text>

        <!-- PIT 1: Dedicated LA Earth Pit -->
        ${makeEarthPit({
          id: 'pit-la',
          x: 70,
          y: 440,
          name: 'LA Earth Pit',
          tag: 'Pit 1 (LA Only)',
          code: 'R < 5Ω | IEC 62305',
          isDark
        })}

        <!-- PIT 2: Dedicated DC Earth Pit -->
        ${makeEarthPit({
          id: 'pit-dc',
          x: 270,
          y: 440,
          name: 'DC Earth Pit',
          tag: 'Pit 2 (DC Array & SPD)',
          code: 'R < 5Ω | IEC 62548',
          isDark
        })}

        <!-- PIT 3: Dedicated AC Earth Pit -->
        ${makeEarthPit({
          id: 'pit-ac',
          x: 600,
          y: 440,
          name: 'AC Earth Pit',
          tag: 'Pit 3 (Inverter & ACDB)',
          code: 'R < 5Ω | IS 3043',
          isDark
        })}

        <!-- Earthing Legend Annotation Box -->
        <g transform="translate(730, 435)">
          <rect width="260" height="75" rx="6" fill="${isDark ? '#111e38' : '#ffffff'}" stroke="${isDark ? '#263b63' : '#e2e8f0'}" stroke-width="1.2" />
          <text x="12" y="18" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}">
            EARTHING CODING STANDARDS:
          </text>
          <circle cx="18" cy="32" r="4" fill="#f59e0b" />
          <text x="28" y="35" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            LA Pit: Dedicated to Rooftop Lightning Protection
          </text>
          <circle cx="18" cy="48" r="4" fill="#16a34a" />
          <text x="28" y="51" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            DC Pit: Module Structure + DCDB SPD Ground
          </text>
          <circle cx="18" cy="64" r="4" fill="#3b82f6" />
          <text x="28" y="67" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            AC Pit: Inverter Chassis + ACDB SPD + Grid Ground
          </text>
        </g>
      </svg>
    `;
  }

  /* =========================================================================
     2. OFF-GRID SOLAR SYSTEM (Standalone PCU)
     ========================================================================= */
  function getOffGridSvg(isDark) {
    const bgFill = isDark ? '#0b1329' : '#f8fafc';

    return `
      <svg viewBox="0 0 1020 540" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        ${getSharedDefs()}
        <rect width="1020" height="540" fill="${bgFill}" />

        <!-- Title Banner -->
        <g transform="translate(30, 28)">
          <text font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="${isDark ? '#38bdf8' : '#0284c7'}">
            OFF-GRID SOLAR PV SYSTEM SCHEMATIC (STANDALONE PCU & BATTERY)
          </text>
          <text y="14" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="${isDark ? '#64748b' : '#94a3b8'}">
            Integrated MPPT Charger + Pure Sine Wave Inverter + Deep Cycle Battery Bank + Isolated Neutral
          </text>
        </g>

        <!-- 1. SOLAR PV ARRAY -->
        ${makeBox({
          id: 'pv-offgrid',
          x: 40,
          y: 90,
          w: 135,
          h: 110,
          title: 'Solar PV Array',
          subtitle: 'Series / Parallel Strings',
          badge: 'String Voc: 140V-200V DC',
          badgeColor: '#0284c7',
          isDark,
          icon: '☀️'
        })}
        <!-- Internal Panel Cell Graphic -->
        <g transform="translate(50, 132)">
          <rect x="0" y="0" width="115" height="18" fill="url(#pv-cell-grid)" rx="2" />
        </g>
        ${makeTerminal(175, 115, '+', 'dc-pos')}
        ${makeTerminal(175, 135, '-', 'dc-neg')}

        <!-- Module Structure Earthing to DC Pit -->
        <path d="M 105 200 L 105 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="110" y="320" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 110 320)">
          PV Frame Ground (10 sq.mm Cu)
        </text>

        <!-- DC Cables from Array to DCDB -->
        <path d="M 175 115 L 225 115" stroke="#ef4444" stroke-width="3" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 175 135 L 225 135" stroke="#1e293b" stroke-width="3" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="182" y="108" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">DC (+)</text>
        <text x="182" y="150" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="${isDark ? '#94a3b8' : '#334155'}">DC (-)</text>

        <!-- 2. DCDB BOX -->
        ${makeBox({
          id: 'dcdb-offgrid',
          x: 225,
          y: 90,
          w: 120,
          h: 110,
          title: 'DCDB Box',
          subtitle: 'Fuse + DC SPD',
          badge: 'gPV Fuse + DC SPD',
          badgeColor: '#ef4444',
          isDark,
          icon: '🛡️'
        })}
        ${makeTerminal(225, 115, '+', 'dc-pos')}
        ${makeTerminal(225, 135, '-', 'dc-neg')}
        ${makeTerminal(345, 115, '+', 'dc-pos')}
        ${makeTerminal(345, 135, '-', 'dc-neg')}

        <!-- DCDB SPD Earth to DC Earth Pit -->
        <path d="M 285 200 L 285 360 L 115 360 L 115 425" stroke="#16a34a" stroke-width="2" fill="none" />
        <text x="290" y="270" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 290 270)">
          DC SPD Earth (6 sq.mm)
        </text>

        <!-- DC Cables from DCDB to Solar PCU -->
        <path d="M 345 115 L 420 115" stroke="#ef4444" stroke-width="3" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 345 135 L 420 135" stroke="#1e293b" stroke-width="3" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="358" y="108" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">PV Input</text>

        <!-- 3. OFF-GRID SOLAR PCU (Central Unit) -->
        ${makeBox({
          id: 'pcu-offgrid',
          x: 420,
          y: 75,
          w: 175,
          h: 170,
          title: 'Off-Grid Solar PCU',
          subtitle: 'MPPT Charger + Inverter',
          badge: 'Solar > Battery > Grid',
          badgeColor: '#3b82f6',
          isDark,
          icon: '⚡'
        })}
        <!-- Internal Architecture Diagram inside PCU -->
        <g transform="translate(435, 125)">
          <rect x="0" y="0" width="60" height="26" rx="3" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#38bdf8" stroke-width="1" />
          <text x="30" y="16" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#38bdf8" text-anchor="middle">MPPT CC</text>

          <rect x="85" y="0" width="60" height="26" rx="3" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1" />
          <text x="115" y="16" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#3b82f6" text-anchor="middle">Inverter ∿</text>

          <path d="M 60 13 L 85 13" stroke="#eab308" stroke-width="1.8" marker-end="url(#arr-ac-phase)" />
        </g>

        <!-- PCU Terminals -->
        ${makeTerminal(420, 115, '+', 'dc-pos')}
        ${makeTerminal(420, 135, '-', 'dc-neg')}
        ${makeTerminal(470, 245, '+', 'dc-pos')}
        ${makeTerminal(530, 245, '-', 'dc-neg')}
        ${makeTerminal(595, 115, 'L', 'ac-phase')}
        ${makeTerminal(595, 135, 'N', 'ac-neutral')}
        ${makeTerminal(595, 155, '⏚', 'earth')}

        <!-- PCU Metal Chassis Double Earth to AC Earth Pit -->
        <path d="M 505 245 L 505 380 L 630 380 L 630 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="515" y="374" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          PCU Body Ground (10 sq.mm)
        </text>

        <!-- 4. DEEP CYCLE BATTERY BANK (Under PCU) -->
        ${makeBox({
          id: 'battery-offgrid',
          x: 420,
          y: 295,
          w: 175,
          h: 110,
          title: 'Battery Bank',
          subtitle: 'Tubular / Lithium LiFePO4',
          badge: '12V / 24V / 48V / 96V DC',
          badgeColor: '#0d9488',
          isDark,
          icon: '🔋'
        })}
        <!-- Internal Battery Cell Stacks Graphic -->
        <g transform="translate(445, 335)">
          <rect x="0" y="0" width="30" height="22" rx="2" fill="${isDark ? '#134e4a' : '#ccfbf1'}" stroke="#0d9488" stroke-width="1" />
          <rect x="45" y="0" width="30" height="22" rx="2" fill="${isDark ? '#134e4a' : '#ccfbf1'}" stroke="#0d9488" stroke-width="1" />
          <rect x="90" y="0" width="30" height="22" rx="2" fill="${isDark ? '#134e4a' : '#ccfbf1'}" stroke="#0d9488" stroke-width="1" />
          <text x="15" y="14" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#0d9488" text-anchor="middle">Cell 1</text>
          <text x="60" y="14" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#0d9488" text-anchor="middle">Cell 2</text>
          <text x="105" y="14" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#0d9488" text-anchor="middle">Cell 3</text>
        </g>
        ${makeTerminal(470, 295, '+', 'dc-pos')}
        ${makeTerminal(530, 295, '-', 'dc-neg')}

        <!-- Battery DC Cables to PCU with Breaker Symbol -->
        <path d="M 470 245 L 470 295" stroke="#ef4444" stroke-width="3.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 530 245 L 530 295" stroke="#1e293b" stroke-width="3.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <!-- Battery In-line DC Fuse / Breaker Pill -->
        <rect x="458" y="260" width="24" height="12" rx="2" fill="#ef4444" />
        <text x="470" y="269" font-family="system-ui, sans-serif" font-size="6.5" font-weight="800" fill="#ffffff" text-anchor="middle">FUSE</text>
        <text x="440" y="278" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">25 sq.mm</text>

        <!-- Battery Rack Frame Ground to Equipment Earth Pit -->
        <path d="M 595 350 L 645 350 L 645 425" stroke="#16a34a" stroke-width="2" fill="none" marker-end="url(#arr-earth)" />
        <text x="650" y="380" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          Rack Earth
        </text>

        <!-- 5. AUXILIARY GRID / DG BYPASS FEED (Left side of PCU) -->
        ${makeBox({
          id: 'aux-grid-offgrid',
          x: 235,
          y: 250,
          w: 110,
          h: 80,
          title: 'Aux Grid / DG',
          subtitle: 'Emergency Bypass In',
          badge: '230V AC Charger',
          badgeColor: '#6366f1',
          isDark,
          icon: '🔌'
        })}
        <!-- Aux Feed into PCU -->
        <path d="M 345 285 L 420 210" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="5,3" fill="none" marker-end="url(#arr-ac-phase)" />
        <text x="350" y="240" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#f59e0b">
          Aux Grid / DG In
        </text>

        <!-- 6. ACDB / OUTPUT SUB-PANEL -->
        ${makeBox({
          id: 'acdb-offgrid',
          x: 645,
          y: 90,
          w: 125,
          h: 110,
          title: 'Output ACDB',
          subtitle: 'Distribution Sub-Panel',
          badge: 'Isolated Inverter N',
          badgeColor: '#dc2626',
          isDark,
          icon: '⚡'
        })}
        ${makeTerminal(645, 115, 'L', 'ac-phase')}
        ${makeTerminal(645, 135, 'N', 'ac-neutral')}
        ${makeTerminal(645, 155, '⏚', 'earth')}
        ${makeTerminal(770, 115, 'L', 'ac-phase')}
        ${makeTerminal(770, 135, 'N', 'ac-neutral')}

        <!-- Inverter Output Lines to ACDB -->
        <path d="M 595 115 L 645 115" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 595 135 L 645 135" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <path d="M 595 155 L 645 155" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />

        <!-- ACDB Earth to AC Earth Pit -->
        <path d="M 705 200 L 705 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="710" y="320" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 710 320)">
          ACDB Earth (6 sq.mm)
        </text>

        <!-- AC Lines to Dedicated Backup Loads -->
        <path d="M 770 115 L 825 115" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 770 135 L 825 135" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <text x="775" y="108" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#dc2626">L (Phase)</text>
        <text x="775" y="148" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#0284c7">N (Isolated)</text>

        <!-- 7. DEDICATED BACKUP LOADS -->
        ${makeBox({
          id: 'loads-offgrid',
          x: 825,
          y: 75,
          w: 165,
          h: 155,
          title: 'Dedicated Backup Loads',
          subtitle: 'Protected Critical Circuits',
          badge: '100% Off-Grid Reliability',
          badgeColor: '#10b981',
          isDark,
          icon: '💡'
        })}
        <!-- Load Icons Grid -->
        <g transform="translate(840, 120)">
          <rect x="0" y="0" width="65" height="30" rx="3" fill="${isDark ? '#064e3b' : '#d1fae5'}" />
          <text x="32" y="19" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">💡 Lights & Fans</text>

          <rect x="75" y="0" width="65" height="30" rx="3" fill="${isDark ? '#064e3b' : '#d1fae5'}" />
          <text x="107" y="19" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">❄️ Refrigerator</text>

          <rect x="0" y="38" width="65" height="30" rx="3" fill="${isDark ? '#064e3b' : '#d1fae5'}" />
          <text x="32" y="57" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">📺 TV / WiFi</text>

          <rect x="75" y="38" width="65" height="30" rx="3" fill="${isDark ? '#064e3b' : '#d1fae5'}" />
          <text x="107" y="57" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">💻 Computers</text>
        </g>

        <!-- =========================================================================
             EARTHING PITS (DC Pit & AC/Equipment Pit)
             ========================================================================= -->
        <line x1="30" y1="425" x2="990" y2="425" stroke="${isDark ? '#334155' : '#cbd5e1'}" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="35" y="420" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="${isDark ? '#64748b' : '#94a3b8'}">
          GROUND LEVEL (TERRESTRIAL SOIL HORIZON) ─────────────────────────────────────────────────────────────────
        </text>

        <!-- PIT 1: DC Earth Pit -->
        ${makeEarthPit({
          id: 'pit-dc',
          x: 110,
          y: 440,
          name: 'DC Earth Pit',
          tag: 'Pit 1 (Structure & DCDB)',
          code: 'R < 5Ω | IEC 62548',
          isDark
        })}

        <!-- PIT 2: AC & Equipment Earth Pit -->
        ${makeEarthPit({
          id: 'pit-ac',
          x: 670,
          y: 440,
          name: 'AC & Equipment Pit',
          tag: 'Pit 2 (PCU, Batt & ACDB)',
          code: 'R < 5Ω | IS 3043',
          isDark
        })}

        <!-- Note Annotation Card -->
        <g transform="translate(760, 435)">
          <rect width="230" height="75" rx="6" fill="${isDark ? '#111e38' : '#ffffff'}" stroke="${isDark ? '#263b63' : '#e2e8f0'}" stroke-width="1.2" />
          <text x="12" y="18" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}">
            OFF-GRID SAFETY ARCHITECTURE:
          </text>
          <text x="12" y="35" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            • Isolated Inverter Output Neutral
          </text>
          <text x="12" y="50" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            • Safe separation between Utility & Inverter
          </text>
          <text x="12" y="65" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#16a34a">
            • Dedicated DC and Equipment Earth Pits
          </text>
        </g>
      </svg>
    `;
  }

  /* =========================================================================
     3. HYBRID SOLAR SYSTEM (Bi-Directional Solar + ESS + Net Metered Grid)
     ========================================================================= */
  function getHybridSvg(isDark) {
    const bgFill = isDark ? '#0b1329' : '#f8fafc';

    return `
      <svg viewBox="0 0 1020 540" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        ${getSharedDefs()}
        <rect width="1020" height="540" fill="${bgFill}" />

        <!-- Title Banner -->
        <g transform="translate(30, 28)">
          <text font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="${isDark ? '#38bdf8' : '#0284c7'}">
            HYBRID SOLAR PV SYSTEM SCHEMATIC (BI-DIRECTIONAL + ESS + NET-METERED GRID)
          </text>
          <text y="14" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="${isDark ? '#64748b' : '#94a3b8'}">
            Bi-Directional Inverter + LiFePO4 ESS + Dual Port (Grid Export & &lt;10ms EPS Backup) + Tri-Grounding
          </text>
        </g>

        <!-- 1. ROOFTOP LIGHTNING ARRESTER -->
        <g class="sld-interactive-item" data-comp-id="la-ongrid" cursor="pointer" transform="translate(60, 50)">
          <path d="M 0 0 L 0 35 M -8 35 L 8 35 M 0 0 L -6 12 M 0 0 L 6 12" stroke="#f59e0b" stroke-width="2.5" fill="none" />
          <rect x="-30" y="38" width="60" height="24" rx="4" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="#f59e0b" stroke-width="1.2" />
          <text x="0" y="52" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#f59e0b" text-anchor="middle">⚡ Rooftop LA</text>
        </g>
        <path d="M 60 110 L 60 425" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-earth)" />
        <text x="65" y="270" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#f59e0b" transform="rotate(-90 65 270)">
          LA Down Conductor to Pit 1
        </text>

        <!-- 2. SOLAR PV ARRAY (DUAL STRINGS PV1 & PV2) -->
        ${makeBox({
          id: 'pv-hybrid',
          x: 40,
          y: 120,
          w: 135,
          h: 125,
          title: 'Solar PV Array',
          subtitle: 'Dual Strings (PV1 & PV2)',
          badge: 'Dual MPPT Strings',
          badgeColor: '#0284c7',
          isDark,
          icon: '☀️'
        })}
        <!-- Internal Panel Cell Graphic -->
        <g transform="translate(50, 160)">
          <rect x="0" y="0" width="115" height="15" fill="url(#pv-cell-grid)" rx="2" />
          <rect x="0" y="20" width="115" height="15" fill="url(#pv-cell-grid)" rx="2" />
        </g>
        ${makeTerminal(175, 140, '1+', 'dc-pos')}
        ${makeTerminal(175, 160, '1-', 'dc-neg')}
        ${makeTerminal(175, 190, '2+', 'dc-pos')}
        ${makeTerminal(175, 210, '2-', 'dc-neg')}

        <!-- Module Structure Earthing to DC Pit -->
        <path d="M 105 245 L 105 380 L 250 380 L 250 425" stroke="#16a34a" stroke-width="2" fill="none" marker-end="url(#arr-earth)" />
        <text x="145" y="374" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          Structure Ground (10 sq.mm Cu)
        </text>

        <!-- 3. DUAL STRING DCDB -->
        ${makeBox({
          id: 'dcdb-hybrid',
          x: 220,
          y: 120,
          w: 120,
          h: 125,
          title: 'Dual DCDB',
          subtitle: '2-In / 2-Out Protection',
          badge: 'Dual SPD + gPV',
          badgeColor: '#ef4444',
          isDark,
          icon: '🛡️'
        })}
        <!-- DCDB Connections -->
        <path d="M 175 140 L 220 140" stroke="#ef4444" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 175 160 L 220 160" stroke="#1e293b" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <path d="M 175 190 L 220 190" stroke="#ef4444" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 175 210 L 220 210" stroke="#1e293b" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="180" y="134" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#ef4444">PV1 DC (+)</text>
        <text x="180" y="184" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#ef4444">PV2 DC (+)</text>
        <text x="180" y="222" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="${isDark ? '#94a3b8' : '#334155'}">DC (-)</text>

        ${makeTerminal(340, 140, '1+', 'dc-pos')}
        ${makeTerminal(340, 160, '1-', 'dc-neg')}
        ${makeTerminal(340, 190, '2+', 'dc-pos')}
        ${makeTerminal(340, 210, '2-', 'dc-neg')}

        <!-- DCDB SPD Earth to DC Pit -->
        <path d="M 280 245 L 280 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="285" y="330" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 285 330)">
          Dual DC SPD Earth (6 sq.mm)
        </text>

        <!-- DC Cables from DCDB to Hybrid Inverter -->
        <path d="M 340 140 L 405 140" stroke="#ef4444" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 340 160 L 405 160" stroke="#1e293b" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <path d="M 340 190 L 405 190" stroke="#ef4444" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 340 210 L 405 210" stroke="#1e293b" stroke-width="2.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="350" y="134" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#ef4444">MPPT1</text>
        <text x="350" y="184" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#ef4444">MPPT2</text>

        <!-- 4. HYBRID BI-DIRECTIONAL INVERTER -->
        ${makeBox({
          id: 'inverter-hybrid',
          x: 405,
          y: 95,
          w: 165,
          h: 175,
          title: 'Hybrid Inverter',
          subtitle: 'Bi-Directional + ATS',
          badge: 'Grid + &lt;10ms EPS Backup',
          badgeColor: '#3b82f6',
          isDark,
          icon: '🔄'
        })}
        <!-- Internal Multi-Port Graphic -->
        <g transform="translate(425, 145)">
          <rect x="0" y="0" width="125" height="42" rx="4" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1" />
          <text x="62" y="16" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#38bdf8" text-anchor="middle">
            Bi-Directional Converter
          </text>
          <text x="62" y="32" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#10b981" text-anchor="middle">
            ⚡ &lt;10ms Seamless ATS
          </text>
        </g>
        <!-- Inverter Terminals -->
        ${makeTerminal(405, 140, '1+', 'dc-pos')}
        ${makeTerminal(405, 160, '1-', 'dc-neg')}
        ${makeTerminal(405, 190, '2+', 'dc-pos')}
        ${makeTerminal(405, 210, '2-', 'dc-neg')}
        <!-- Battery Port Terminals -->
        ${makeTerminal(455, 270, 'B+', 'dc-pos')}
        ${makeTerminal(515, 270, 'B-', 'dc-neg')}
        <!-- Grid Port (Top Right) -->
        ${makeTerminal(570, 125, 'GL', 'ac-phase')}
        ${makeTerminal(570, 145, 'GN', 'ac-neutral')}
        <!-- EPS Backup Port (Bottom Right) -->
        ${makeTerminal(570, 205, 'EL', 'ac-phase')}
        ${makeTerminal(570, 225, 'EN', 'ac-neutral')}

        <!-- Inverter Double Ground to AC/ESS Pit -->
        <path d="M 485 270 L 485 390 L 590 390 L 590 425" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="495" y="384" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          Inverter Body Ground (10 sq.mm)
        </text>

        <!-- 5. ENERGY STORAGE SYSTEM (LiFePO4 ESS) -->
        ${makeBox({
          id: 'battery-hybrid',
          x: 405,
          y: 315,
          w: 165,
          h: 100,
          title: 'LiFePO4 ESS Bank',
          subtitle: 'Smart BMS Battery',
          badge: '48V / HV DC | CAN Bus',
          badgeColor: '#0d9488',
          isDark,
          icon: '🔋'
        })}
        ${makeTerminal(455, 315, 'B+', 'dc-pos')}
        ${makeTerminal(515, 315, 'B-', 'dc-neg')}

        <!-- Bi-Directional Heavy DC Cables to ESS -->
        <path d="M 455 270 L 455 315" stroke="#ef4444" stroke-width="3.5" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)" />
        <path d="M 515 270 L 515 315" stroke="#1e293b" stroke-width="3.5" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)" />
        <!-- BMS Communication Cable (Cyan dashed) -->
        <path d="M 485 270 L 485 315" stroke="#06b6d4" stroke-width="1.8" stroke-dasharray="3,2" fill="none" />
        <text x="490" y="295" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#06b6d4">BMS CAN</text>

        <!-- ESS Cabinet Safety Earth -->
        <path d="M 570 365 L 610 365 L 610 425" stroke="#16a34a" stroke-width="2" fill="none" marker-end="url(#arr-earth)" />
        <text x="615" y="380" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a">
          ESS Cabinet Earth
        </text>

        <!-- =========================================================================
             UPPER BRANCH: GRID PORT -> GRID ACDB -> NET METER -> EB GRID & HEAVY LOADS
             ========================================================================= -->
        <!-- 6. GRID-SIDE ACDB -->
        ${makeBox({
          id: 'acdb-grid-hybrid',
          x: 620,
          y: 85,
          w: 110,
          h: 90,
          title: 'Grid ACDB',
          subtitle: 'Bi-Dir Incomer',
          badge: 'AC MCB + SPD',
          badgeColor: '#dc2626',
          isDark,
          icon: '⚡'
        })}
        <!-- Lines from Hybrid Grid Port to Grid ACDB -->
        <path d="M 570 125 L 620 125" stroke="#dc2626" stroke-width="2.8" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)" />
        <path d="M 570 145 L 620 145" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" fill="none" />
        <text x="575" y="118" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#dc2626">Grid L</text>

        <!-- 7. BI-DIRECTIONAL NET METER -->
        ${makeBox({
          id: 'netmeter-hybrid',
          x: 760,
          y: 85,
          w: 105,
          h: 90,
          title: 'Net Meter',
          subtitle: 'Import / Export',
          badge: '4-Quadrant',
          badgeColor: '#0284c7',
          isDark,
          icon: '🔄'
        })}
        <!-- Lines from Grid ACDB to Net Meter -->
        <path d="M 730 125 L 760 125" stroke="#0284c7" stroke-width="2.8" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)" />
        <path d="M 730 145 L 760 145" stroke="#0284c7" stroke-width="2" stroke-dasharray="6,3" fill="none" />

        <!-- Split after Net Meter to Utility Grid & Non-Essential Heavy Loads -->
        <circle cx="895" cy="125" r="3.5" fill="#dc2626" />
        <path d="M 865 125 L 895 125" stroke="#dc2626" stroke-width="2.8" fill="none" />
        <path d="M 895 125 L 895 65 L 925 65" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 895 125 L 895 155 L 925 155" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />

        <!-- 8. UTILITY EB GRID -->
        ${makeBox({
          id: 'grid-hybrid',
          x: 925,
          y: 40,
          w: 80,
          h: 65,
          title: 'EB Grid',
          subtitle: 'DISCOM Feed',
          badge: '230V/415V',
          badgeColor: '#6366f1',
          isDark,
          icon: '🏭'
        })}

        <!-- 9. NON-ESSENTIAL HEAVY LOADS -->
        ${makeBox({
          id: 'loads-noncritical-hybrid',
          x: 925,
          y: 125,
          w: 80,
          h: 75,
          title: 'Heavy Loads',
          subtitle: 'Grid-Fed Only',
          badge: 'AC, Geyser, EV',
          badgeColor: '#f97316',
          isDark,
          icon: '❄️'
        })}

        <!-- =========================================================================
             LOWER BRANCH: EPS PORT -> EPS SUB-PANEL -> CRITICAL BACKUP LOADS
             ========================================================================= -->
        <!-- 10. EPS BACKUP SUB-PANEL -->
        ${makeBox({
          id: 'subdb-eps-hybrid',
          x: 620,
          y: 200,
          w: 110,
          h: 90,
          title: 'EPS Sub-Panel',
          subtitle: 'UPS Backup Port',
          badge: '&lt;10ms ATS Sub-DB',
          badgeColor: '#10b981',
          isDark,
          icon: '🛡️'
        })}
        <!-- Lines from Hybrid EPS Port to EPS Sub-Panel -->
        <path d="M 570 205 L 620 205" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 570 225 L 620 225" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <text x="575" y="198" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="#10b981">EPS L</text>

        <!-- 11. CRITICAL BACKUP APPLIANCES -->
        ${makeBox({
          id: 'loads-critical-hybrid',
          x: 760,
          y: 200,
          w: 155,
          h: 90,
          title: 'Critical Backup Loads',
          subtitle: 'Essential Uninterrupted',
          badge: 'Lights, WiFi, Fridge, Med',
          badgeColor: '#10b981',
          isDark,
          icon: '💡'
        })}
        <!-- Lines from EPS Panel to Critical Loads -->
        <path d="M 730 225 L 760 225" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 730 245 L 760 245" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />

        <!-- =========================================================================
             EARTHING PITS (LA Pit, DC Pit, AC & ESS Pit)
             ========================================================================= -->
        <line x1="30" y1="425" x2="990" y2="425" stroke="${isDark ? '#334155' : '#cbd5e1'}" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="35" y="420" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="${isDark ? '#64748b' : '#94a3b8'}">
          GROUND LEVEL (TERRESTRIAL SOIL HORIZON) ─────────────────────────────────────────────────────────────────
        </text>

        <!-- PIT 1: Dedicated LA Earth Pit -->
        ${makeEarthPit({
          id: 'pit-la',
          x: 60,
          y: 440,
          name: 'LA Earth Pit',
          tag: 'Pit 1 (LA Only)',
          code: 'R < 5Ω | IEC 62305',
          isDark
        })}

        <!-- PIT 2: Dedicated DC Earth Pit -->
        ${makeEarthPit({
          id: 'pit-dc',
          x: 270,
          y: 440,
          name: 'DC Earth Pit',
          tag: 'Pit 2 (PV & Dual SPD)',
          code: 'R < 5Ω | IEC 62548',
          isDark
        })}

        <!-- PIT 3: Dedicated AC & ESS Earth Pit -->
        ${makeEarthPit({
          id: 'pit-ac',
          x: 600,
          y: 440,
          name: 'AC & ESS Pit',
          tag: 'Pit 3 (Inverter, Batt & DB)',
          code: 'R < 5Ω | IS 3043',
          isDark
        })}

        <!-- Hybrid Annotation Card -->
        <g transform="translate(730, 435)">
          <rect width="260" height="75" rx="6" fill="${isDark ? '#111e38' : '#ffffff'}" stroke="${isDark ? '#263b63' : '#e2e8f0'}" stroke-width="1.2" />
          <text x="12" y="18" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}">
            HYBRID SMART DUAL-PORT LOGIC:
          </text>
          <text x="12" y="35" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#38bdf8">
            • Grid Port: Bi-directional energy export & import
          </text>
          <text x="12" y="50" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#10b981">
            • EPS Port: Zero interruption during blackout (&lt;10ms)
          </text>
          <text x="12" y="65" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#0d9488">
            • Smart BMS: Automatic LiFePO4 battery protection
          </text>
        </g>
      </svg>
    `;
  }

  /* =========================================================================
     4. WITHOUT SOLAR (Home UPS / Inverter-Battery Backup)
     ========================================================================= */
  function getWithoutSolarSvg(isDark) {
    const bgFill = isDark ? '#0b1329' : '#f8fafc';

    return `
      <svg viewBox="0 0 1020 540" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        ${getSharedDefs()}
        <rect width="1020" height="540" fill="${bgFill}" />

        <!-- Title Banner -->
        <g transform="translate(30, 28)">
          <text font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="${isDark ? '#38bdf8' : '#0284c7'}">
            WITHOUT SOLAR (HOME UPS / INVERTER-BATTERY BACKUP SCHEMATIC)
          </text>
          <text y="14" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="${isDark ? '#64748b' : '#94a3b8'}">
            Utility Grid Supply + Energy Meter + Main DB (ELCB) + Home UPS + Tubular/Lithium Battery + Sub-DB
          </text>
        </g>

        <!-- 1. UTILITY EB GRID INCOMER -->
        ${makeBox({
          id: 'grid-withoutsolar',
          x: 40,
          y: 110,
          w: 120,
          h: 115,
          title: 'EB Service Feed',
          subtitle: 'Utility Grid Incomer',
          badge: '1-Ph 230V / 3-Ph 415V',
          badgeColor: '#6366f1',
          isDark,
          icon: '🏭'
        })}
        <!-- Terminals on Grid Incomer -->
        ${makeTerminal(160, 135, 'L', 'ac-phase')}
        ${makeTerminal(160, 155, 'N', 'ac-neutral')}
        ${makeTerminal(160, 175, '⏚', 'earth')}

        <!-- Incomer Service Cable to Energy Meter -->
        <path d="M 160 135 L 210 135" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 160 155 L 210 155" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <path d="M 160 175 L 210 175" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="165" y="128" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#dc2626">L</text>
        <text x="165" y="150" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#0284c7">N</text>
        <text x="165" y="170" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#16a34a">PE</text>

        <!-- 2. ENERGY METER (EB Revenue Meter) -->
        ${makeBox({
          id: 'meter-withoutsolar',
          x: 210,
          y: 110,
          w: 110,
          h: 115,
          title: 'Energy Meter',
          subtitle: 'EB Billing Meter',
          badge: 'Active kWh Meter',
          badgeColor: '#0284c7',
          isDark,
          icon: '⚡'
        })}
        <rect x="225" y="150" width="80" height="18" rx="2" fill="${isDark ? '#022c22' : '#dcfce7'}" stroke="#10b981" stroke-width="0.8" />
        <text x="265" y="162" font-family="monospace" font-size="8" font-weight="700" fill="#10b981" text-anchor="middle">
          01294.5 kWh
        </text>
        ${makeTerminal(210, 135, 'L', 'ac-phase')}
        ${makeTerminal(210, 155, 'N', 'ac-neutral')}
        ${makeTerminal(320, 135, 'L', 'ac-phase')}
        ${makeTerminal(320, 155, 'N', 'ac-neutral')}

        <!-- Cable from Meter to Main DB -->
        <path d="M 320 135 L 375 135" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 320 155 L 375 155" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />

        <!-- 3. MAIN DISTRIBUTION BOARD (MDB) -->
        ${makeBox({
          id: 'mdb-withoutsolar',
          x: 375,
          y: 95,
          w: 145,
          h: 145,
          title: 'Main DB (MDB)',
          subtitle: 'Main DP MCB + ELCB',
          badge: '30mA RCCB Safety',
          badgeColor: '#dc2626',
          isDark,
          icon: '🏢'
        })}
        <!-- Internal Busbars Graphic -->
        <g transform="translate(390, 140)">
          <rect x="0" y="0" width="115" height="40" rx="3" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#ef4444" stroke-width="1" />
          <text x="57" y="16" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#ef4444" text-anchor="middle">DP MCB + ELCB</text>
          <text x="57" y="32" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#10b981" text-anchor="middle">Earth Busbar (PE)</text>
        </g>
        ${makeTerminal(375, 135, 'L', 'ac-phase')}
        ${makeTerminal(375, 155, 'N', 'ac-neutral')}
        ${makeTerminal(520, 135, 'L', 'ac-phase')}
        ${makeTerminal(520, 155, 'N', 'ac-neutral')}
        ${makeTerminal(520, 175, '⏚', 'earth')}

        <!-- MDB Earth Busbar connected to Consumer Earth Pit -->
        <path d="M 445 240 L 445 425" stroke="#16a34a" stroke-width="2.5" fill="none" marker-end="url(#arr-earth)" />
        <text x="450" y="330" font-family="system-ui, sans-serif" font-size="7" font-weight="600" fill="#16a34a" transform="rotate(-90 450 330)">
          Main Earth Lead to Pit (16 sq.mm Cu)
        </text>

        <!-- SPLIT FROM MDB: BRANCH A -> NON-BACKUP HEAVY LOADS -->
        <path d="M 445 195 L 445 290 L 265 290" stroke="#dc2626" stroke-width="2.5" fill="none" marker-end="url(#arr-ac-phase)" />
        <text x="330" y="284" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#f97316">
          Direct Raw AC Feed
        </text>

        <!-- 4. NON-BACKUP HEAVY APPLIANCES -->
        ${makeBox({
          id: 'heavyloads-withoutsolar',
          x: 140,
          y: 260,
          w: 125,
          h: 110,
          title: 'Heavy Loads',
          subtitle: 'Non-Backup Grid-Only',
          badge: 'AC, Geyser, Motor',
          badgeColor: '#f97316',
          isDark,
          icon: '❄️'
        })}
        <g transform="translate(150, 305)">
          <text x="0" y="0" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Air Conditioner 1.5 Ton</text>
          <text x="0" y="14" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Water Geyser (2kW)</text>
          <text x="0" y="28" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Pumping Motor (1.5HP)</text>
        </g>

        <!-- SPLIT FROM MDB: BRANCH B -> RAW AC FEED TO HOME UPS -->
        <path d="M 520 135 L 585 135" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 520 155 L 585 155" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <path d="M 520 175 L 585 175" stroke="#16a34a" stroke-width="2.2" fill="none" marker-end="url(#arr-earth)" />
        <text x="526" y="128" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#dc2626">Raw In</text>

        <!-- 5. HOME UPS / INVERTER UNIT -->
        ${makeBox({
          id: 'ups-withoutsolar',
          x: 585,
          y: 95,
          w: 155,
          h: 155,
          title: 'Home UPS / Inverter',
          subtitle: 'Bi-Directional Charger',
          badge: '&lt;15ms Fast Transfer',
          badgeColor: '#3b82f6',
          isDark,
          icon: '⚡'
        })}
        <g transform="translate(605, 140)">
          <rect x="0" y="0" width="115" height="36" rx="3" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1" />
          <text x="57" y="15" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#38bdf8" text-anchor="middle">AC-DC Charger</text>
          <text x="57" y="29" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#3b82f6" text-anchor="middle">DC-AC Inverter ∿</text>
        </g>
        ${makeTerminal(585, 135, 'L', 'ac-phase')}
        ${makeTerminal(585, 155, 'N', 'ac-neutral')}
        ${makeTerminal(585, 175, '⏚', 'earth')}
        <!-- Battery Terminals at bottom -->
        ${makeTerminal(630, 250, '+', 'dc-pos')}
        ${makeTerminal(690, 250, '-', 'dc-neg')}
        <!-- Output Terminals -->
        ${makeTerminal(740, 135, 'L', 'ac-phase')}
        ${makeTerminal(740, 155, 'N', 'ac-neutral')}

        <!-- 6. INVERTER BATTERY BANK -->
        ${makeBox({
          id: 'battery-withoutsolar',
          x: 585,
          y: 300,
          w: 155,
          h: 105,
          title: 'Inverter Battery',
          subtitle: 'Tubular / Lithium Bank',
          badge: '12V / 24V / 48V DC',
          badgeColor: '#0d9488',
          isDark,
          icon: '🔋'
        })}
        <!-- Terminals on Battery -->
        ${makeTerminal(630, 300, '+', 'dc-pos')}
        ${makeTerminal(690, 300, '-', 'dc-neg')}

        <!-- Heavy DC Battery Cables with Lug Shrouds -->
        <path d="M 630 250 L 630 300" stroke="#ef4444" stroke-width="3.5" fill="none" marker-end="url(#arr-dc-pos)" />
        <path d="M 690 250 L 690 300" stroke="#1e293b" stroke-width="3.5" fill="none" marker-end="url(#arr-dc-neg)" />
        <text x="602" y="278" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#ef4444">16/25 sq.mm</text>

        <!-- 7. BACKUP SUB-DISTRIBUTION BOARD -->
        ${makeBox({
          id: 'subdb-withoutsolar',
          x: 775,
          y: 105,
          w: 110,
          h: 125,
          title: 'Backup Sub-DB',
          subtitle: 'Circuit MCBs',
          badge: 'Inverter Phase',
          badgeColor: '#dc2626',
          isDark,
          icon: '🛡️'
        })}
        <!-- Lines from UPS Output to Backup Sub-DB -->
        <path d="M 740 135 L 775 135" stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 740 155 L 775 155" stroke="#0284c7" stroke-width="2.4" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />
        <text x="745" y="128" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#dc2626">Inv L</text>

        <!-- Earth path extending from MDB to Sub-DB -->
        <path d="M 520 175 L 585 175 M 740 175 L 775 175" stroke="#16a34a" stroke-width="2" fill="none" />

        <!-- 8. CRITICAL BACKUP LOADS -->
        ${makeBox({
          id: 'criticalloads-withoutsolar',
          x: 915,
          y: 95,
          w: 95,
          h: 145,
          title: 'Backup Loads',
          subtitle: 'Continuous Power',
          badge: 'Fans, Lights, TV',
          badgeColor: '#10b981',
          isDark,
          icon: '💡'
        })}
        <g transform="translate(923, 140)">
          <text x="0" y="0" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Ceiling Fans</text>
          <text x="0" y="16" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• LED Lights</text>
          <text x="0" y="32" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Wi-Fi Router</text>
          <text x="0" y="48" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Television</text>
          <text x="0" y="64" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">• Laptop Charging</text>
        </g>
        <!-- Lines from Sub-DB to Critical Loads -->
        <path d="M 885 135 L 915 135" stroke="#dc2626" stroke-width="2.8" fill="none" marker-end="url(#arr-ac-phase)" />
        <path d="M 885 155 L 915 155" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)" />

        <!-- =========================================================================
             EARTHING PIT (CONSUMER / EB EARTH PIT)
             ========================================================================= -->
        <line x1="30" y1="425" x2="990" y2="425" stroke="${isDark ? '#334155' : '#cbd5e1'}" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="35" y="420" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="${isDark ? '#64748b' : '#94a3b8'}">
          GROUND LEVEL (TERRESTRIAL SOIL HORIZON) ─────────────────────────────────────────────────────────────────
        </text>

        <!-- Single Consumer Earth Pit -->
        ${makeEarthPit({
          id: 'pit-consumer',
          x: 445,
          y: 440,
          name: 'Consumer Earth Pit',
          tag: 'Main Premises Earth',
          code: 'R < 5Ω | IS 3043',
          isDark
        })}

        <!-- Without Solar Safety Annotation Box -->
        <g transform="translate(620, 435)">
          <rect width="370" height="75" rx="6" fill="${isDark ? '#111e38' : '#ffffff'}" stroke="${isDark ? '#263b63' : '#e2e8f0'}" stroke-width="1.2" />
          <text x="12" y="18" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}">
            STANDALONE HOME UPS EARTHING & PROTECTION:
          </text>
          <text x="12" y="35" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            • Main DB ELCB / RCCB (30mA) provides human touch shock protection
          </text>
          <text x="12" y="50" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#475569'}">
            • Solid equipment earthing via 3-pin plug extends to UPS chassis and battery trolley
          </text>
          <text x="12" y="65" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#f97316">
            • Heavy loads (AC, Geyser, Motor) bypass UPS to prevent inverter overloading
          </text>
        </g>
      </svg>
    `;
  }

  /**
   * Main Render Router based on system type.
   */
  function generateSvgContent(systemType, isDark) {
    switch (systemType) {
      case 'on-grid':
        return getOnGridSvg(isDark);
      case 'off-grid':
        return getOffGridSvg(isDark);
      case 'hybrid':
        return getHybridSvg(isDark);
      case 'without-solar':
        return getWithoutSolarSvg(isDark);
      default:
        return getOffGridSvg(isDark);
    }
  }

  /**
   * Render or re-render schematic in both inline and modal containers.
   */
  function render(systemType) {
    if (systemType) {
      sldState.currentSystem = systemType;
    }
    const current = sldState.currentSystem;
    const isDark = sldState.theme === 'dark';

    // 1. Inline Container
    const inlineContainer = document.getElementById('sldInlineSvgWrapper');
    if (inlineContainer) {
      inlineContainer.innerHTML = generateSvgContent(current, isDark);
      inlineContainer.className = `sld-svg-canvas ${isDark ? 'sld-theme-dark' : 'sld-theme-light'}`;
      attachSvgEvents(inlineContainer, 'inline');
    }

    // 2. Modal Container
    const modalContainer = document.getElementById('sldModalSvgWrapper');
    if (modalContainer) {
      modalContainer.innerHTML = generateSvgContent(current, isDark);
      modalContainer.className = `sld-svg-canvas ${isDark ? 'sld-theme-dark' : 'sld-theme-light'}`;
      attachSvgEvents(modalContainer, 'modal');
    }

    // Update active badges & buttons
    updateActiveBadges(current);
  }

  /**
   * Updates title, badges and active buttons.
   */
  function updateActiveBadges(current) {
    const names = {
      'off-grid': 'Off-Grid Solar (Standalone PCU + Battery)',
      'on-grid': 'On-Grid Solar (Grid-Tied GTI + Net Meter)',
      'hybrid': 'Hybrid Solar (Bi-Directional + ESS + Net Meter)',
      'without-solar': 'Without Solar (Home UPS Inverter-Battery)'
    };

    const inlineTitle = document.getElementById('sldInlineSystemTitle');
    if (inlineTitle) {
      inlineTitle.textContent = names[current] || current;
    }

    const modalTitle = document.getElementById('sldModalSystemTitle');
    if (modalTitle) {
      modalTitle.textContent = names[current] || current;
    }

    // Modal quick-selector buttons
    const selectorBtns = document.querySelectorAll('.sld-system-tab-btn');
    selectorBtns.forEach(btn => {
      const type = btn.getAttribute('data-sys-type');
      if (type === current) {
        btn.classList.add('btn-primary', 'active');
        btn.classList.remove('btn-outline-secondary', 'btn-light');
      } else {
        btn.classList.remove('btn-primary', 'active');
        btn.classList.add('btn-light', 'text-dark');
      }
    });
  }

  /**
   * Attaches pan, zoom, hover and click events to interactive SVG elements.
   */
  function attachSvgEvents(container, scope = 'inline') {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Component hover & click tooltips
    const items = svgEl.querySelectorAll('.sld-interactive-item');
    items.forEach(item => {
      const compId = item.getAttribute('data-comp-id');
      const spec = COMPONENT_DETAILS[compId];

      if (!spec) return;

      // Mouse enter / touch hover
      item.addEventListener('mouseenter', e => {
        showTooltip(e, spec);
        item.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.75))';
      });

      item.addEventListener('mouseleave', () => {
        hideTooltip();
        item.style.filter = '';
      });

      // Click to pin / show detail panel in modal
      item.addEventListener('click', e => {
        e.stopPropagation();
        showDetailDrawer(spec);
      });
    });

    // Zoom & Pan via Mouse Dragging
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let panOffset = scope === 'modal' ? { ...sldState.modalPan } : { ...sldState.inlinePan };

    svgEl.addEventListener('mousedown', e => {
      // Only left mouse button
      if (e.button !== 0) return;
      isPanning = true;
      startPoint = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      svgEl.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!isPanning) return;
      panOffset.x = e.clientX - startPoint.x;
      panOffset.y = e.clientY - startPoint.y;
      applyTransform(svgEl, scope, panOffset);
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        svgEl.style.cursor = 'grab';
        if (scope === 'modal') {
          sldState.modalPan = { ...panOffset };
        } else {
          sldState.inlinePan = { ...panOffset };
        }
      }
    });

    // Mouse Wheel Zoom
    svgEl.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      zoom(delta, scope);
    }, { passive: false });
  }

  /**
   * Applies CSS zoom and pan transform to SVG element.
   */
  function applyTransform(svgEl, scope, pan) {
    const zoomLevel = scope === 'modal' ? sldState.modalZoom : sldState.inlineZoom;
    svgEl.style.transformOrigin = 'center center';
    svgEl.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`;
    svgEl.style.transition = 'transform 0.05s ease-out';
  }

  /**
   * Zoom In / Out / Reset Controls.
   */
  function zoom(delta, scope = 'inline') {
    let currentZoom = scope === 'modal' ? sldState.modalZoom : sldState.inlineZoom;
    let newZoom = Math.max(0.6, Math.min(2.8, currentZoom + delta));

    if (scope === 'modal') {
      sldState.modalZoom = newZoom;
      const modalSvg = document.querySelector('#sldModalSvgWrapper svg');
      if (modalSvg) applyTransform(modalSvg, 'modal', sldState.modalPan);
      const zoomText = document.getElementById('sldModalZoomText');
      if (zoomText) zoomText.textContent = `${Math.round(newZoom * 100)}%`;
    } else {
      sldState.inlineZoom = newZoom;
      const inlineSvg = document.querySelector('#sldInlineSvgWrapper svg');
      if (inlineSvg) applyTransform(inlineSvg, 'inline', sldState.inlinePan);
    }
  }

  function resetZoom(scope = 'inline') {
    if (scope === 'modal') {
      sldState.modalZoom = 1;
      sldState.modalPan = { x: 0, y: 0 };
      const modalSvg = document.querySelector('#sldModalSvgWrapper svg');
      if (modalSvg) applyTransform(modalSvg, 'modal', { x: 0, y: 0 });
      const zoomText = document.getElementById('sldModalZoomText');
      if (zoomText) zoomText.textContent = `100%`;
    } else {
      sldState.inlineZoom = 1;
      sldState.inlinePan = { x: 0, y: 0 };
      const inlineSvg = document.querySelector('#sldInlineSvgWrapper svg');
      if (inlineSvg) applyTransform(inlineSvg, 'inline', { x: 0, y: 0 });
    }
  }

  /**
   * Theme Switcher (Dark Blueprint vs Engineering Light).
   */
  function toggleTheme() {
    sldState.theme = sldState.theme === 'dark' ? 'light' : 'dark';
    const isDark = sldState.theme === 'dark';

    // Update toggle icons
    const themeBtnIcons = document.querySelectorAll('.sld-theme-icon');
    themeBtnIcons.forEach(icon => {
      icon.textContent = isDark ? '🌙 Dark Blueprint' : '☀️ Light Drawing';
    });

    render();
  }

  /**
   * Hover Tooltip Logic.
   */
  function showTooltip(e, spec) {
    let tip = document.getElementById('sldFloatingTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'sldFloatingTooltip';
      tip.className = 'sld-spec-tooltip';
      document.body.appendChild(tip);
    }

    tip.innerHTML = `
      <div class="sld-tooltip-header">
        <strong>${spec.title}</strong>
      </div>
      <div class="sld-tooltip-body">
        <div class="sld-tip-row"><span class="sld-tip-lbl">Type:</span> <span>${spec.type}</span></div>
        ${spec.specs ? `<div class="sld-tip-row"><span class="sld-tip-lbl">Rating:</span> <span class="text-primary fw-bold">${spec.specs}</span></div>` : ''}
        ${spec.protection ? `<div class="sld-tip-row"><span class="sld-tip-lbl">Protection:</span> <span>${spec.protection}</span></div>` : ''}
        ${spec.connections ? `<div class="sld-tip-row"><span class="sld-tip-lbl">Terminals:</span> <span>${spec.connections}</span></div>` : ''}
        ${spec.grounding ? `<div class="sld-tip-row"><span class="sld-tip-lbl">Earthing:</span> <span class="text-success fw-bold">${spec.grounding}</span></div>` : ''}
      </div>
      <div class="sld-tooltip-footer">Click component for detailed engineering sheet</div>
    `;

    tip.style.display = 'block';

    const tipW = 320;
    let posX = e.pageX + 16;
    let posY = e.pageY - 20;

    if (posX + tipW > window.innerWidth) {
      posX = e.pageX - tipW - 16;
    }

    tip.style.left = `${Math.max(10, posX)}px`;
    tip.style.top = `${Math.max(10, posY)}px`;
  }

  function hideTooltip() {
    const tip = document.getElementById('sldFloatingTooltip');
    if (tip) {
      tip.style.display = 'none';
    }
  }

  /**
   * Bottom Detail Drawer in Modal for in-depth inspection.
   */
  function showDetailDrawer(spec) {
    const drawer = document.getElementById('sldDetailDrawer');
    if (!drawer) return;

    drawer.innerHTML = `
      <div class="p-3 bg-white border rounded-3 shadow-sm">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="fw-bold text-dark mb-0 fs-7">${spec.title}</h6>
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 fs-9">Electrical Specification</span>
        </div>
        <div class="row g-2 fs-8">
          <div class="col-md-6">
            <span class="text-secondary fw-semibold">Classification:</span> <span class="text-dark">${spec.type}</span>
          </div>
          <div class="col-md-6">
            <span class="text-secondary fw-semibold">Operating Specs:</span> <span class="text-primary fw-bold">${spec.specs || 'Standard Industrial Rating'}</span>
          </div>
          ${spec.protection ? `
            <div class="col-md-6">
              <span class="text-secondary fw-semibold">Protection:</span> <span class="text-danger fw-semibold">${spec.protection}</span>
            </div>
          ` : ''}
          ${spec.grounding ? `
            <div class="col-md-6">
              <span class="text-secondary fw-semibold">Earthing / Pit:</span> <span class="text-success fw-bold">${spec.grounding}</span>
            </div>
          ` : ''}
          ${spec.standards ? `
            <div class="col-12">
              <span class="text-secondary fw-semibold">Compliance Standards:</span> <span class="badge bg-light text-dark border">${spec.standards}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Opens the full-screen SLD Modal.
   */
  function openModal(systemType) {
    if (systemType) {
      sldState.currentSystem = systemType;
    }
    render(sldState.currentSystem);
    resetZoom('modal');

    const modalEl = document.getElementById('sldSchematicModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  }

  /**
   * Exports the currently active SVG as a standalone .svg file.
   */
  function exportSvg() {
    const current = sldState.currentSystem;
    const isDark = sldState.theme === 'dark';
    const svgData = generateSvgContent(current, isDark);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `SolarTrack_SLD_${current}_${isDark ? 'dark' : 'light'}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }

  /**
   * Initializes the Schematic component on DOM load.
   */
  function init() {
    // Detect system from SizingUI state if available
    let initialType = 'off-grid';
    if (window.SizingUI && typeof window.SizingUI.getCurrentSystemType === 'function') {
      initialType = window.SizingUI.getCurrentSystemType() || 'off-grid';
    } else {
      const activeDropdownItem = document.querySelector('.system-dropdown-item.active');
      if (activeDropdownItem && activeDropdownItem.dataset.systemType) {
        initialType = activeDropdownItem.dataset.systemType;
      }
    }

    sldState.currentSystem = initialType;
    render(initialType);
  }

  // Export public API
  window.SizingSchematic = {
    init,
    render,
    openModal,
    zoom,
    resetZoom,
    toggleTheme,
    exportSvg,
    switchSystemFromModal: function (type) {
      if (window.SizingUI && typeof window.SizingUI.selectSystemTypeOption === 'function') {
        window.SizingUI.selectSystemTypeOption(type);
      } else {
        render(type);
      }
    }
  };

  // Auto-init on DOMContentLoaded or immediate if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

})();
