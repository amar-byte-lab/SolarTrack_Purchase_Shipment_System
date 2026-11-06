/**
 * sizing-schematic.js — Single Line & Schematic Circuit Diagram Component
 * Interactive, draggable, high-detail electrical Single Line Diagram (SLD)
 * for Solar PV and Inverter-Battery systems (On-Grid, Off-Grid, Hybrid, Without Solar).
 *
 * Adheres to Indian & International Electrical Standards:
 * - IS/IEC 60364, IEC 62548 (PV Array Design), IS 3043:2018 (Earthing Practice), CEA Regulations 2021
 * - Mandatory Minimum 3.0m - 5.0m Separation between Earth Pits (d >= 2 x Electrode Length)
 * - Enlarged block dimensions with high-legibility bold typography and contrast halos
 * - Non-overlapping wiring corridors with CAD standard Jumper Bridge Arcs
 * - Detailed Solar PV Array series daisy-chain stringing topology & MC4 terminations
 * - Real-time Drag-and-Drop blocks with dynamically adjusting connection wires
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
    positions: {
      'on-grid': {},
      'off-grid': {},
      'hybrid': {},
      'without-solar': {}
    },
    activeDragBlock: null,
    dragStartSvg: { x: 0, y: 0 },
    blockStartPos: { dx: 0, dy: 0 },
    dragMoved: false
  };

  // Comprehensive Engineering Specifications Database
  const COMPONENT_DETAILS = {
    // ON-GRID COMPONENTS
    'la-ongrid': {
      title: '⚡ Lightning Arrester (LA)',
      type: 'Early Streamer Emission (ESE) / Franklin Rod Terminal',
      location: 'Highest Point on Rooftop / Parapet Structure',
      specs: 'Class I/II Protection, 10/350µs Impulse Current: 25kA | Protection Radius: 48m',
      connections: 'Dedicated 25x3 mm Copper / GI Down-Conductor routed externally',
      grounding: 'Direct low-impedance route to Pit 1 (LA Earth Pit) < 5Ω; strictly isolated from DC/AC pits',
      standards: 'IEC 62305 / IS/IEC 62305 / IS 2309 Standards'
    },
    'pv-ongrid': {
      title: '☀️ Solar PV Array (Series String Daisy-Chain)',
      type: 'Mono PERC / TOPCon Bifacial Modules (Series Stringing Topology)',
      location: 'Elevated Rooftop Anodized Aluminium Mounting Structure',
      specs: 'Module Voc: ~48.5V | String Configuration: 12-16 Panels in Series | String Voc: ~582V-776V DC | Imp: 13.5A | STC Power: 550Wp/module',
      protection: 'Module frame anodized bonding, Bypass Diodes in IP68 Junction Box, UV-resistant dual-insulated solar DC cables',
      connections: 'Series Daisy-Chain: (+) of module n connected to (-) of module n+1. String output terminated into DCDB via weatherproof locking MC4 connectors.',
      grounding: 'Module Aluminium Frames & Structure bonded via 10 sq.mm Green Conductor directly to Pit 2 (DC Earth Pit)',
      standards: 'IEC 61215 / IEC 61730 / IS 14286 / IEC 62548'
    },
    'dcdb-ongrid': {
      title: '🛡️ DC Distribution Box (DCDB)',
      type: '1-In / 1-Out or 2-In / 2-Out Solar DC Protection Enclosure',
      location: 'Near Inverter / Inbound DC Array Entry Point',
      specs: '1000V DC Rotary Isolator (32A) + 15A/20A gPV Cylindrical Cartridge Fuses (+ & - legs)',
      protection: 'Type II DC Surge Protection Device (SPD): Uc 1000V DC, In 20kA, Imax 40kA, Up < 3.8kV',
      connections: 'DC (+) Bright Red, DC (-) Black 4/6 sq.mm Cables from PV Array -> Output to Inverter DC Inputs',
      grounding: 'SPD Ground Terminal routed directly to Pit 2 (DC Earth Pit) via 6 sq.mm Green Conductor',
      standards: 'IEC 61643-31 / IEC 60269-6 / IS 60947-3'
    },
    'gti-ongrid': {
      title: '⚡ Grid-Tied Inverter (GTI / On-Grid)',
      type: 'Transformerless Pure Sine Wave Grid-Interactive Inverter',
      location: 'Well-Ventilated Indoor / Shaded Outdoor Wall',
      specs: 'Efficiency: 98.4% | Dual MPPT Operating Window: 150V-850V DC | AC Output: 230V 1-Phase / 415V 3-Phase 50Hz',
      protection: 'Anti-Islanding Protection (IEEE 1547 / UL 1741), Ground Fault GFCI, AC/DC Overvoltage, Short Circuit',
      connections: 'DC Input: MC4 (+/-) Terminals | AC Output: L (Phase), N (Neutral), PE (Ground) Terminals to ACDB',
      grounding: 'Double Chassis / Enclosure Grounding to Pit 3 (AC Earth Pit) via 10 sq.mm Copper Conductor',
      standards: 'IEC 62109-1/-2, IEC 61727, VDE-AR-N 4105, CEA 2021'
    },
    'acdb-ongrid': {
      title: '⚡ AC Distribution Box (ACDB)',
      type: 'Industrial AC Protection Sub-Assembly',
      location: 'Adjacent to Grid-Tied Inverter',
      specs: '2-Pole / 4-Pole Class C MCB (32A/63A, 10kA breaking capacity)',
      protection: 'Type II AC SPD: Uc 320V/440V, In 20kA, Imax 40kA with fast MOV varistors',
      connections: 'Inverter AC Feed in -> Output to Bi-Directional Net Meter',
      grounding: 'ACDB Enclosure & SPD Ground bonded to Pit 3 (AC Earth Pit)',
      standards: 'IEC 60947-2 / IS/IEC 60898-1'
    },
    'netmeter-ongrid': {
      title: '🔄 Bi-Directional Net Meter',
      type: '4-Quadrant Smart Electronic Utility Net Meter',
      location: 'Main Consumer Incomer / Boundary EB Meter Board',
      specs: 'Registers Import kWh (Grid to Consumer) and Export kWh (Solar Surplus to Grid)',
      connections: 'Bi-directional Phase (L), Neutral (N), Utility Ground (PE)',
      grounding: 'Meter casing earthing via Distribution Board busbar to AC Pit',
      standards: 'IS 13779 / CEA Net-Metering Regulations 2021'
    },
    'grid-ongrid': {
      title: '🏭 Utility Grid / Electricity Board (EB)',
      type: 'State DISCOM 1-Phase 230V / 3-Phase 415V LT Distribution',
      location: 'Local Distribution Substation / Transformer Pole',
      specs: '50 Hz ± 1%, Grid Impedance: Low, Fault Current Source',
      connections: 'Service cable drop to Consumer Net Meter',
      grounding: 'DISCOM Distribution Neutral Ground at Distribution Transformer'
    },
    'loads-ongrid': {
      title: '🏠 Home LT Distribution & Appliances',
      type: 'Connected Consumer Single/Three Phase Loads',
      location: 'Internal Household Distribution',
      specs: '230V AC 50Hz Standard Household Loads (Lighting, AC, Appliances)',
      connections: 'Phase (L) and Neutral (N) from Main LT Panel',
      grounding: 'Bonded to AC Consumer Earth'
    },

    // OFF-GRID COMPONENTS
    'la-offgrid': {
      title: '⚡ Lightning Arrester (LA)',
      type: 'Early Streamer Emission (ESE) / Franklin Rod Terminal',
      location: 'Highest Point on Rooftop / Parapet Structure',
      specs: 'Class I/II Protection, 10/350µs Impulse Current: 25kA',
      connections: 'Dedicated 25x3 mm Solid Cu / GI Down Conductor',
      grounding: 'Direct low-impedance route to Pit 1 (LA Earth Pit) < 5Ω',
      standards: 'IEC 62305 / IS 2309 Standards'
    },
    'pv-offgrid': {
      title: '☀️ Off-Grid Solar PV Array (Series-Parallel Strings)',
      type: 'Mono PERC Half-Cut High Efficiency Modules',
      location: 'Rooftop Mount / Ground Mount Structure',
      specs: 'String Voc: 140V-250V DC (sized to match MPPT charger max input) | Total Power: Sized for daily kWh load',
      protection: 'Series fuse protection, MC4 Y-connectors for parallel strings, bypass diodes',
      connections: 'Series string daisy-chain with MC4 connectors into DCDB',
      grounding: 'Structure Ground (10 sq.mm Cu) to Pit 2 (DC Earth Pit)',
      standards: 'IEC 61215 / IEC 62548'
    },
    'dcdb-offgrid': {
      title: '🛡️ Off-Grid DCDB Box',
      type: 'Solar DC Protection & Disconnect',
      location: 'Adjacent to Solar PCU',
      specs: '600V/1000V DC Isolator switch + gPV cartridge fuses (positive & negative)',
      protection: 'Type II DC Surge Protection Device (SPD 600V/1000V DC)',
      connections: 'PV Array Input -> PCU Solar Charger Input',
      grounding: 'SPD Ground to Pit 2 (DC Earth Pit)',
      standards: 'IEC 61643-31'
    },
    'pcu-offgrid': {
      title: '⚡ Off-Grid Solar PCU (Power Conditioning Unit)',
      type: 'Integrated Pure Sine Wave Inverter + High Efficiency MPPT Charge Controller',
      location: 'Cool, Ventilated Utility Room near Battery Bank',
      specs: 'MPPT Efficiency >98% | Inverter Efficiency >93% | Pure Sine Wave Output 230V 50Hz',
      protection: 'Battery overcharge, deep discharge, overload, short circuit, reverse polarity, isolated neutral',
      connections: 'DC Inputs from DCDB + Heavy DC Cables to Battery Bank + AC Input from Grid/Gen + AC Output to ACDB',
      grounding: 'Double Chassis Earthing to Pit 3 (AC Earth Pit)',
      standards: 'IEC 62109, IS 16221, IS 16169'
    },
    'batt-offgrid': {
      title: '🔋 Deep-Cycle Solar Battery Bank',
      type: 'C10 Rated Solar Tubular Lead-Acid or LiFePO4 Lithium Battery Bank',
      location: 'Dedicated Acid-Resistant Battery Rack / Lithium Enclosure',
      specs: 'System Voltage: 24V / 48V / 96V DC | Capacity: Sized for autonomy (1-2 days backup)',
      protection: 'High-current DC HRC Fuse / DC MCB Disconnect on positive rail',
      connections: 'Heavy 25 sq.mm - 50 sq.mm Flexible Copper Battery Interlinks',
      grounding: 'Enclosure / Rack Earthing to Pit 3 (AC Earth Pit)',
      standards: 'IS 13369 / IS 1651 / IEC 62619 (Lithium)'
    },
    'acdb-offgrid': {
      title: '⚡ Off-Grid AC Distribution Box',
      type: 'Consumer Load Disconnect & MCB Sub-Panel',
      location: 'Next to Solar PCU',
      specs: 'Double Pole (DP) MCB + High Sensitivity 30mA RCCB / RCBO (Human Shock Protection)',
      protection: 'Class C MCB for inductive motor loads + Type II AC SPD',
      connections: 'PCU AC Output In -> Sub-Circuits Out',
      grounding: 'Bonded to Pit 3 (AC Earth Pit)',
      standards: 'IS 12640 / IEC 61008'
    },
    'gen-offgrid': {
      title: '⚙️ Auxiliary Backup Generator / Grid Feed',
      type: 'Manual/Auto-Start DG Set or Single-Phase Grid Service Cable',
      location: 'Outdoor Generator Shed / Service Boundary',
      specs: '230V AC 50Hz Auxiliary Alternator Output to PCU AC Incomer',
      connections: 'L, N, PE routed to PCU auxiliary charging terminal',
      grounding: 'Generator Frame bonded to Earth Pit'
    },
    'loads-offgrid': {
      title: '💡 Essential Backup Load Circuits',
      type: 'Off-Grid Dedicated Household / Commercial Circuits',
      location: 'Consumer Distribution Board',
      specs: 'Lighting, Fans, Refrigerator, Computer, Communication Gear',
      connections: 'Phase (L) and Neutral (N) from Off-Grid ACDB',
      grounding: 'Consumer Protective Earth (PE)'
    },

    // HYBRID COMPONENTS
    'la-hybrid': {
      title: '⚡ Lightning Arrester (LA)',
      type: 'Early Streamer Emission (ESE) / Franklin Rod Terminal',
      location: 'Highest Point on Rooftop / Parapet',
      specs: 'Class I/II Protection, 10/350µs Impulse Current: 25kA',
      connections: 'Dedicated 25x3 mm Solid Cu / GI Down Conductor',
      grounding: 'Direct low-impedance route to Pit 1 (LA Earth Pit) < 5Ω',
      standards: 'IEC 62305'
    },
    'pv-hybrid': {
      title: '☀️ Hybrid Solar PV Array (Series Daisy-Chain)',
      type: 'Bifacial Mono PERC / TOPCon Modules with Series Stringing',
      location: 'Rooftop Mounting Structure',
      specs: 'Dual MPPT String Architecture | Voc per String: ~600V DC | Imp: 13.5A',
      connections: 'Series Daisy-Chain (+/-) to DCDB with MC4 Connectors',
      grounding: 'Structure Ground (10 sq.mm) to Pit 2 (DC Earth Pit)',
      standards: 'IEC 62548 / IEC 61215'
    },
    'dcdb-hybrid': {
      title: '🛡️ Hybrid DCDB Box',
      type: 'Dual-MPPT Solar DC Protection Enclosure',
      location: 'Near Hybrid Inverter',
      specs: 'Dual 1000V DC Isolators + gPV Fuses + Type II DC SPD',
      protection: 'Surge Suppression 1000V DC, Up < 3.8kV',
      connections: 'PV Strings In -> Hybrid Inverter MPPT 1 & 2',
      grounding: 'SPD Ground to Pit 2 (DC Earth Pit)',
      standards: 'IEC 61643-31'
    },
    'hybrid-inv': {
      title: '🔄 Bi-Directional Hybrid Inverter',
      type: 'Grid-Interactive + Energy Storage System (ESS) Inverter',
      location: 'Dedicated Power Room / Shaded Wall',
      specs: 'Smart Energy Management: Solar -> Battery -> Load -> Grid Export | Dual Output (Grid Port + EPS Backup Port)',
      protection: 'Transfer switch < 10ms (seamless UPS mode), Anti-islanding, DC/AC SPD, Battery BMS CAN bus',
      connections: 'DC PV In + Battery DC + AC Grid Bi-Dir + AC Critical Load Dedicated Port',
      grounding: 'Chassis Earth to Pit 3 (AC Earth Pit)',
      standards: 'IEC 62109, IEEE 1547, VDE-AR-N 4105'
    },
    'batt-hybrid': {
      title: '🔋 High-Voltage / 48V LiFePO4 Energy Storage (ESS)',
      type: 'Lithium Iron Phosphate (LFP) Smart Battery with Active BMS',
      location: 'Indoor Climate-Controlled Environment',
      specs: '6000+ Cycles @ 90% DoD | Active Cell Balancing | CAN / RS485 Communication with Inverter',
      protection: 'Built-in Electronic BMS (Overcurrent, Overvoltage, Short Circuit, Thermal Runaway Protection)',
      connections: 'Heavy DC Power Connectors + Cat6 CAN Communication Cable to Hybrid Inverter',
      grounding: 'Battery Metal Rack Grounded to AC Earth Pit',
      standards: 'IEC 62619 / UL 1973 / UN 38.3'
    },
    'crit-loads': {
      title: '⚡ Essential / Critical Loads Sub-Panel',
      type: 'Dedicated Uninterruptible Power Supply (UPS / EPS) Sub-Panel',
      location: 'Protected Sub-Distribution',
      specs: 'Continuous 230V AC Power during Grid Outages (<10ms switchover)',
      connections: 'Fed strictly from Hybrid Inverter EPS / Critical Output Port',
      grounding: 'Protective Earth (PE)'
    },
    'acdb-hybrid': {
      title: '⚡ Main Hybrid ACDB Panel',
      type: 'Bi-Directional AC Combiner & Grid Intertie Board',
      location: 'Adjacent to Hybrid Inverter & Meter Board',
      specs: 'Class C AC MCB + Type II AC SPD + Manual Bypass Switch',
      connections: 'Interconnects Inverter Grid Port, Utility Net Meter & Normal Loads',
      grounding: 'Enclosure and SPD bonded to Pit 3 (AC Earth Pit)',
      standards: 'IS/IEC 60898 / IEC 60947'
    },
    'netmeter-hybrid': {
      title: '🔄 Hybrid Bi-Directional Net Meter',
      type: 'Smart Bi-Directional Utility Billing Meter',
      location: 'Boundary Meter Board',
      specs: 'Measures net solar export after battery is fully charged & home loads are fulfilled',
      connections: 'Utility Grid Incomer <-> Main ACDB',
      grounding: 'Consumer Earth Busbar'
    },
    'grid-hybrid': {
      title: '🏭 DISCOM Utility Grid',
      type: 'LT Single/Three Phase Grid Service',
      location: 'Local Transformer Drop',
      specs: '230V/415V 50Hz Infinite Bus',
      connections: 'Service cable to Net Meter',
      grounding: 'Substation Transformer Ground'
    },
    'main-loads': {
      title: '🏠 Normal Non-Critical Loads',
      type: 'Standard LT Household / Commercial Appliances',
      location: 'Main Distribution Board',
      specs: 'High power non-backup loads (EV Charger, Water Heater, Heavy HVAC)',
      connections: 'Fed from Grid / Main ACDB; shed during grid outage to conserve battery',
      grounding: 'Consumer Earth PE'
    },

    // WITHOUT SOLAR (HOME UPS) COMPONENTS
    'grid-nosolar': {
      title: '🏭 Utility Grid / Electricity Board (EB)',
      type: 'Standard 230V 1-Phase LT Consumer Service',
      location: 'Main Electric Meter Board',
      specs: '230V AC ± 10%, 50 Hz LT Supply',
      connections: 'Incomer Service Cable to Main Distribution Board',
      grounding: 'Neutral Ground at Distribution Transformer'
    },
    'maindb-nosolar': {
      title: '⚡ Main Distribution Board (MDB)',
      type: 'Consumer Incomer & Protection Board',
      location: 'Entry Foyer / Electrical Nook',
      specs: 'Double Pole (DP) MCB + 30mA RCCB + Type II AC SPD',
      protection: 'Overcurrent, Short-circuit, Earth Leakage Human Shock Protection',
      connections: 'Grid In -> Feed to Home UPS Incomer and High-Power Bypass Circuits',
      grounding: 'Direct heavy copper conductor to Pit 3 (Consumer AC Earth Pit)',
      standards: 'IS 12640 / IS/IEC 60898'
    },
    'ups-nosolar': {
      title: '⚡ Pure Sine Wave Home UPS / Inverter',
      type: 'Static Standby / Line-Interactive Pure Sine Wave UPS',
      location: 'Ventilated Utility Shelf or Battery Trolley',
      specs: 'Efficiency: 88-92% | Microcontroller PWM/DSP pure sine wave output | Fast Transfer Time < 15ms',
      protection: 'Overload with auto-reset, battery low alarm/cutoff, short-circuit, reverse polarity protection',
      connections: 'AC Input from Main DB + Heavy DC Cables to Battery Bank + AC Output to Dedicated Backup Sub-Board',
      grounding: 'Chassis Earth Pin to Consumer AC Earth Pit',
      standards: 'IS 16221 / IEC 62040'
    },
    'batt-nosolar': {
      title: '🔋 Heavy Duty Inverter Battery Bank',
      type: 'Tall Tubular Lead-Acid (C20) or LiFePO4 Battery',
      location: 'Sturdy Insulated Battery Trolley',
      specs: '12V / 24V DC System | 150Ah - 220Ah Tubular Deep Cycle (High Acid Volume)',
      protection: 'Inline Fast-Acting DC Fuse / MCB on positive battery cable',
      connections: 'Heavy 16-25 sq.mm Flexible Multistrand Copper Cables with crimped brass lugs',
      grounding: 'Isolated Enclosure Rack',
      standards: 'IS 13369 / IS 1651'
    },
    'loads-nosolar': {
      title: '💡 Dedicated Home Inverter Loads',
      type: 'Essential Domestic Circuits',
      location: 'Household Rooms',
      specs: 'LED Lights, Ceiling Fans, Wi-Fi Router, Television, Laptop charging',
      connections: 'Phase (L) and Neutral (N) from UPS AC Output Socket',
      grounding: 'Protected Consumer Earth (PE)'
    },

    // EARTH PITS (ALL SYSTEMS)
    'pit-la': {
      title: '⏚ Pit 1: Dedicated Lightning Arrester Earth Pit',
      type: 'Chemical Maintenance-Free Copper-Bonded Electrode Pit',
      location: 'Outdoor Terrestrial Soil Horizon (Outside Building Footprint)',
      specs: 'Electrode: 3.0m length x 17.2mm dia (250 micron copper) + Carbon/Bentonite Earth Enhancing Compound',
      protection: 'Surge Impulse Dissipation: <= 5 Ohms',
      connections: 'Dedicated 25x3 mm Copper / GI Down Conductor from Rooftop LA Terminal only',
      grounding: 'STRICTLY ISOLATED: Must maintain >= 3.0m to 5.0m separation distance from DC & AC earth pits to prevent sphere of influence overlap (IS 3043:2018 & IEC 62305)',
      standards: 'IS 3043:2018 / IEC 62305 / IEEE 80'
    },
    'pit-dc': {
      title: '⏚ Pit 2: Dedicated Solar DC Earth Pit',
      type: 'Chemical Copper-Bonded Grounding Electrode with Inspection Chamber',
      location: 'Outdoor Terrestrial Ground, Min 3m distance from LA Pit',
      specs: 'Electrode: 3.0m length x 17.2mm dia | Earth Resistance <= 5 Ohms',
      connections: 'Solar PV Module Structure Grounding (10 sq.mm) + DCDB Surge Protective Device (SPD) Ground (6 sq.mm)',
      grounding: 'Strictly isolated from LA Pit. Maintains >= 3m separation from AC Pit according to IS 3043 / IEC 62548.',
      standards: 'IS 3043:2018 / IEC 62548 / CEA Regulations'
    },
    'pit-ac': {
      title: '⏚ Pit 3: Dedicated AC Power Earth Pit',
      type: 'Chemical Copper-Bonded Low Impedance Earth Pit',
      location: 'Outdoor Terrestrial Ground, Min 3m distance from DC Pit',
      specs: 'Electrode: 3.0m length x 17.2mm dia | Earth Resistance <= 5 Ohms (Combined System <= 2 Ohms)',
      connections: 'Inverter Chassis Body Ground + ACDB SPD Ground + Main AC Distribution Board Earth Busbar',
      grounding: 'IS 3043:2018 Mandate: Minimum 3.0m physical separation ensures independent dissipation of AC fault current without transient voltage migration to DC solar array.',
      standards: 'IS 3043:2018 / IS/IEC 60364 / CEA 2021'
    }
  };

  /* =========================================================================
     ENLARGED & HIGH-LEGIBILITY SYSTEM ARCHITECTURAL CONFIGURATIONS
     (Generous viewBox: 1260 x 650 with bold, crystal-clear typography)
     ========================================================================= */
  const SYSTEM_CONFIGS = {
    // 1. ON-GRID
    'on-grid': {
      viewBox: '0 0 1260 650',
      title: 'ON-GRID SOLAR PV SYSTEM SCHEMATIC (SINGLE LINE DIAGRAM)',
      subtitle: 'Standard: IEC 62548 / IS 3043:2018 | Dedicated Tri-Earth Pits | Bi-Directional Net-Metered Injection',
      blocks: {
        'la-ongrid': {
          type: 'la',
          x: 60, y: 45, w: 90, h: 75,
          title: '⚡ Rooftop LA',
          subtitle: 'ESE / Franklin',
          badge: 'Class I/II 25kA',
          badgeColor: '#f59e0b',
          ports: {
            down_cond: { x: 45, y: 75 }
          }
        },
        'pv-ongrid': {
          type: 'pv-array',
          x: 45, y: 145, w: 200, h: 145,
          title: 'Solar PV Array',
          subtitle: 'Series String Daisy-Chain',
          badge: 'Voc: ~580V DC | 13.5A',
          badgeColor: '#0284c7',
          icon: '☀️',
          ports: {
            out_pos: { x: 200, y: 40 },
            out_neg: { x: 200, y: 65 },
            frame_gnd: { x: 100, y: 145 }
          }
        },
        'dcdb-ongrid': {
          type: 'box',
          x: 300, y: 145, w: 155, h: 145,
          title: 'DCDB Box',
          subtitle: 'Isolator + gPV + SPD',
          badge: 'Type II DC SPD 1000V',
          badgeColor: '#ef4444',
          icon: '🛡️',
          ports: {
            in_pos: { x: 0, y: 40 },
            in_neg: { x: 0, y: 65 },
            out_pos: { x: 155, y: 40 },
            out_neg: { x: 155, y: 65 },
            spd_gnd: { x: 77, y: 145 }
          }
        },
        'gti-ongrid': {
          type: 'box',
          x: 515, y: 135, w: 185, h: 165,
          title: 'Grid-Tied Inverter',
          subtitle: 'Pure Sine Wave GTI',
          badge: '230V/415V 50Hz | η>98%',
          badgeColor: '#3b82f6',
          icon: '⚡',
          hasInverterSymbol: true,
          ports: {
            in_pos: { x: 0, y: 50 },
            in_neg: { x: 0, y: 75 },
            out_L: { x: 185, y: 40 },
            out_N: { x: 185, y: 65 },
            out_PE: { x: 185, y: 90 },
            chassis_gnd: { x: 92, y: 165 }
          }
        },
        'acdb-ongrid': {
          type: 'box',
          x: 760, y: 135, w: 155, h: 165,
          title: 'ACDB Box',
          subtitle: 'AC MCB + AC SPD',
          badge: 'Class C MCB | 320V SPD',
          badgeColor: '#dc2626',
          icon: '⚡',
          ports: {
            in_L: { x: 0, y: 40 },
            in_N: { x: 0, y: 65 },
            in_PE: { x: 0, y: 90 },
            out_L: { x: 155, y: 40 },
            out_N: { x: 155, y: 65 },
            spd_gnd: { x: 77, y: 165 }
          }
        },
        'netmeter-ongrid': {
          type: 'box',
          x: 975, y: 135, w: 140, h: 165,
          title: 'Net Meter',
          subtitle: 'Dual / Bi-Directional',
          badge: 'Import / Export kWh',
          badgeColor: '#0284c7',
          icon: '🔄',
          hasNetMeterLcd: true,
          ports: {
            in_L: { x: 0, y: 40 },
            in_N: { x: 0, y: 65 },
            out_L: { x: 140, y: 40 },
            out_N: { x: 140, y: 65 }
          }
        },
        'grid-ongrid': {
          type: 'box',
          x: 1150, y: 55, w: 100, h: 90,
          title: 'EB Grid',
          subtitle: 'DISCOM LT Line',
          badge: '230V/415V',
          badgeColor: '#6366f1',
          icon: '🏭',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 }
          }
        },
        'loads-ongrid': {
          type: 'box',
          x: 1150, y: 260, w: 100, h: 100,
          title: 'Home Load',
          subtitle: 'LT Sub-Board',
          badge: 'Lights, AC, TV',
          badgeColor: '#10b981',
          icon: '🏠',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 }
          }
        },
        'pit-la': {
          type: 'earth-pit',
          x: 105, y: 540, w: 90, h: 60,
          name: 'LA Earth Pit',
          tag: 'Pit 1 (LA Only)',
          code: 'R ≤ 5Ω | IEC 62305',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-dc': {
          type: 'earth-pit',
          x: 400, y: 540, w: 90, h: 60,
          name: 'DC Earth Pit',
          tag: 'Pit 2 (DC Array & SPD)',
          code: 'R ≤ 5Ω | IEC 62548',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-ac': {
          type: 'earth-pit',
          x: 835, y: 540, w: 90, h: 60,
          name: 'AC Earth Pit',
          tag: 'Pit 3 (Inverter & ACDB)',
          code: 'R ≤ 5Ω | IS 3043',
          ports: {
            top: { x: 0, y: -15 }
          }
        }
      },
      wires: [
        {
          id: 'wire-la-pit',
          from: { blockId: 'la-ongrid', port: 'down_cond' },
          to: { blockId: 'pit-la', port: 'top' },
          type: 'la-down',
          routing: 'direct',
          label: '25x3 mm Cu Down Conductor',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-pv-dcdb-pos',
          from: { blockId: 'pv-ongrid', port: 'out_pos' },
          to: { blockId: 'dcdb-ongrid', port: 'in_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'DC (+) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-pv-dcdb-neg',
          from: { blockId: 'pv-ongrid', port: 'out_neg' },
          to: { blockId: 'dcdb-ongrid', port: 'in_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'DC (-) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-pv-gnd',
          from: { blockId: 'pv-ongrid', port: 'frame_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'PV Structure Ground (10 sq.mm Cu)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-dcdb-gti-pos',
          from: { blockId: 'dcdb-ongrid', port: 'out_pos' },
          to: { blockId: 'gti-ongrid', port: 'in_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'DC (+) To GTI',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-dcdb-gti-neg',
          from: { blockId: 'dcdb-ongrid', port: 'out_neg' },
          to: { blockId: 'gti-ongrid', port: 'in_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'DC (-) To GTI',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-dcdb-spd-gnd',
          from: { blockId: 'dcdb-ongrid', port: 'spd_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'DC SPD Earth (6 sq.mm)',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-gti-acdb-L',
          from: { blockId: 'gti-ongrid', port: 'out_L' },
          to: { blockId: 'acdb-ongrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'L (Phase Red)',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-gti-acdb-N',
          from: { blockId: 'gti-ongrid', port: 'out_N' },
          to: { blockId: 'acdb-ongrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct',
          label: 'N (Cyan Dashed)',
          labelOffset: { dx: 0, dy: -9 }
        },
        {
          id: 'wire-gti-acdb-PE',
          from: { blockId: 'gti-ongrid', port: 'out_PE' },
          to: { blockId: 'acdb-ongrid', port: 'in_PE' },
          type: 'earth',
          routing: 'direct',
          label: 'PE (Striped Green)',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-gti-chassis-gnd',
          from: { blockId: 'gti-ongrid', port: 'chassis_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'Inverter Body Ground (10 sq.mm)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-acdb-spd-gnd',
          from: { blockId: 'acdb-ongrid', port: 'spd_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'ACDB SPD Ground (6 sq.mm)',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-acdb-netmeter-L',
          from: { blockId: 'acdb-ongrid', port: 'out_L' },
          to: { blockId: 'netmeter-ongrid', port: 'in_L' },
          type: 'bidi-phase',
          routing: 'direct',
          label: 'Bi-Dir Flow ⮂',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-acdb-netmeter-N',
          from: { blockId: 'acdb-ongrid', port: 'out_N' },
          to: { blockId: 'netmeter-ongrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-netmeter-grid-L',
          from: { blockId: 'netmeter-ongrid', port: 'out_L' },
          to: { blockId: 'grid-ongrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'step-hv',
          label: 'Grid Export/Import',
          labelOffset: { dx: 12, dy: -8 }
        },
        {
          id: 'wire-netmeter-grid-N',
          from: { blockId: 'netmeter-ongrid', port: 'out_N' },
          to: { blockId: 'grid-ongrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'step-hv'
        },
        {
          id: 'wire-netmeter-loads-L',
          from: { blockId: 'netmeter-ongrid', port: 'out_L' },
          to: { blockId: 'loads-ongrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'step-hv',
          label: 'To Consumer Loads',
          labelOffset: { dx: 12, dy: 16 }
        },
        {
          id: 'wire-netmeter-loads-N',
          from: { blockId: 'netmeter-ongrid', port: 'out_N' },
          to: { blockId: 'loads-ongrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'step-hv'
        }
      ],
      earthDimensions: [
        {
          fromId: 'pit-la',
          toId: 'pit-dc',
          y: 566,
          label: 'Min 3.0m - 5.0m Separation (IS 3043:2018 / IEC 62305: d ≥ 2×L)'
        },
        {
          fromId: 'pit-dc',
          toId: 'pit-ac',
          y: 566,
          label: 'Min 3.0m Separation (Sphere of Influence Isolation)'
        }
      ]
    },

    // 2. OFF-GRID
    'off-grid': {
      viewBox: '0 0 1260 650',
      title: 'OFF-GRID SOLAR PV SYSTEM SCHEMATIC (STANDALONE PCU & BATTERY)',
      subtitle: 'Integrated MPPT Charger + Pure Sine Wave Inverter + Deep Cycle Battery Bank + Dedicated Isolated Earth Pits',
      blocks: {
        'la-offgrid': {
          type: 'la',
          x: 60, y: 40, w: 90, h: 75,
          title: '⚡ Rooftop LA',
          subtitle: 'ESE / Franklin',
          badge: 'Class I/II 25kA',
          badgeColor: '#f59e0b',
          ports: {
            down_cond: { x: 45, y: 75 }
          }
        },
        'pv-offgrid': {
          type: 'pv-array',
          x: 45, y: 135, w: 200, h: 145,
          title: 'Solar PV Array',
          subtitle: 'Series String Daisy-Chain',
          badge: 'String Voc: 140V-250V DC',
          badgeColor: '#0284c7',
          icon: '☀️',
          ports: {
            out_pos: { x: 200, y: 40 },
            out_neg: { x: 200, y: 65 },
            frame_gnd: { x: 100, y: 145 }
          }
        },
        'dcdb-offgrid': {
          type: 'box',
          x: 300, y: 135, w: 155, h: 145,
          title: 'DCDB Box',
          subtitle: 'Fuse + DC SPD',
          badge: 'gPV Fuse + DC SPD',
          badgeColor: '#ef4444',
          icon: '🛡️',
          ports: {
            in_pos: { x: 0, y: 40 },
            in_neg: { x: 0, y: 65 },
            out_pos: { x: 155, y: 40 },
            out_neg: { x: 155, y: 65 },
            spd_gnd: { x: 77, y: 145 }
          }
        },
        'pcu-offgrid': {
          type: 'box',
          x: 510, y: 105, w: 205, h: 180,
          title: 'Off-Grid Solar PCU',
          subtitle: 'MPPT CC + Inverter',
          badge: 'Solar > Battery > Grid',
          badgeColor: '#3b82f6',
          icon: '⚡',
          hasPcuDiagram: true,
          ports: {
            in_pv_pos: { x: 0, y: 40 },
            in_pv_neg: { x: 0, y: 65 },
            aux_in_L: { x: 205, y: 35 },
            aux_in_N: { x: 205, y: 55 },
            out_ac_L: { x: 205, y: 80 },
            out_ac_N: { x: 205, y: 100 },
            out_ac_PE: { x: 205, y: 120 },
            batt_pos: { x: 65, y: 180 },
            batt_neg: { x: 135, y: 180 },
            chassis_gnd: { x: 100, y: 180 }
          }
        },
        'batt-offgrid': {
          type: 'box',
          x: 510, y: 340, w: 205, h: 120,
          title: 'Battery Bank',
          subtitle: 'C10 Tubular / LiFePO4',
          badge: '24V/48V High Autonomy',
          badgeColor: '#0d9488',
          icon: '🔋',
          hasBatteryCells: true,
          ports: {
            in_batt_pos: { x: 65, y: 0 },
            in_batt_neg: { x: 135, y: 0 },
            rack_gnd: { x: 170, y: 120 }
          }
        },
        'acdb-offgrid': {
          type: 'box',
          x: 775, y: 115, w: 155, h: 165,
          title: 'Off-Grid ACDB',
          subtitle: 'DP MCB + 30mA RCCB',
          badge: 'Isolated Neutral System',
          badgeColor: '#dc2626',
          icon: '⚡',
          ports: {
            in_L: { x: 0, y: 40 },
            in_N: { x: 0, y: 65 },
            in_PE: { x: 0, y: 90 },
            out_L: { x: 155, y: 40 },
            out_N: { x: 155, y: 65 },
            out_PE: { x: 155, y: 90 },
            spd_gnd: { x: 77, y: 165 }
          }
        },
        'gen-offgrid': {
          type: 'box',
          x: 995, y: 45, w: 130, h: 95,
          title: 'Backup Gen / Grid',
          subtitle: 'Auxiliary AC Feed',
          badge: '230V 50Hz Incomer',
          badgeColor: '#6366f1',
          icon: '⚙️',
          ports: {
            out_L: { x: 0, y: 30 },
            out_N: { x: 0, y: 55 }
          }
        },
        'loads-offgrid': {
          type: 'box',
          x: 995, y: 190, w: 130, h: 110,
          title: 'Home Priority Loads',
          subtitle: 'Continuous Supply',
          badge: 'Lights, Fans, Fridge',
          badgeColor: '#10b981',
          icon: '💡',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 },
            in_PE: { x: 0, y: 80 }
          }
        },
        'pit-la': {
          type: 'earth-pit',
          x: 105, y: 540, w: 90, h: 60,
          name: 'LA Earth Pit',
          tag: 'Pit 1 (LA Only)',
          code: 'R ≤ 5Ω | IEC 62305',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-dc': {
          type: 'earth-pit',
          x: 400, y: 540, w: 90, h: 60,
          name: 'DC Earth Pit',
          tag: 'Pit 2 (DC Array & SPD)',
          code: 'R ≤ 5Ω | IEC 62548',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-ac': {
          type: 'earth-pit',
          x: 850, y: 540, w: 90, h: 60,
          name: 'AC Earth Pit',
          tag: 'Pit 3 (PCU & ACDB)',
          code: 'R ≤ 5Ω | IS 3043',
          ports: {
            top: { x: 0, y: -15 }
          }
        }
      },
      wires: [
        {
          id: 'wire-la-pit',
          from: { blockId: 'la-offgrid', port: 'down_cond' },
          to: { blockId: 'pit-la', port: 'top' },
          type: 'la-down',
          routing: 'direct',
          label: '25x3 mm Cu Down Conductor',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-pv-dcdb-pos',
          from: { blockId: 'pv-offgrid', port: 'out_pos' },
          to: { blockId: 'dcdb-offgrid', port: 'in_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'DC (+) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-pv-dcdb-neg',
          from: { blockId: 'pv-offgrid', port: 'out_neg' },
          to: { blockId: 'dcdb-offgrid', port: 'in_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'DC (-) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-pv-gnd',
          from: { blockId: 'pv-offgrid', port: 'frame_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'PV Frame Ground (10 sq.mm Cu)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-dcdb-pcu-pos',
          from: { blockId: 'dcdb-offgrid', port: 'out_pos' },
          to: { blockId: 'pcu-offgrid', port: 'in_pv_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'PV Input (+)',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-dcdb-pcu-neg',
          from: { blockId: 'dcdb-offgrid', port: 'out_neg' },
          to: { blockId: 'pcu-offgrid', port: 'in_pv_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'PV Input (-)',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-dcdb-spd-gnd',
          from: { blockId: 'dcdb-offgrid', port: 'spd_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'DC SPD Earth (6 sq.mm)',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-pcu-batt-pos',
          from: { blockId: 'pcu-offgrid', port: 'batt_pos' },
          to: { blockId: 'batt-offgrid', port: 'in_batt_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: '25 sq.mm DC (+) with Fuse',
          labelOffset: { dx: -14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-pcu-batt-neg',
          from: { blockId: 'pcu-offgrid', port: 'batt_neg' },
          to: { blockId: 'batt-offgrid', port: 'in_batt_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: '25 sq.mm DC (-)',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-gen-pcu-L',
          from: { blockId: 'gen-offgrid', port: 'out_L' },
          to: { blockId: 'pcu-offgrid', port: 'aux_in_L' },
          type: 'ac-phase',
          routing: 'step-hv',
          label: 'Aux Grid/Gen Incomer',
          labelOffset: { dx: -14, dy: -8 }
        },
        {
          id: 'wire-gen-pcu-N',
          from: { blockId: 'gen-offgrid', port: 'out_N' },
          to: { blockId: 'pcu-offgrid', port: 'aux_in_N' },
          type: 'ac-neutral',
          routing: 'step-hv'
        },
        {
          id: 'wire-pcu-acdb-L',
          from: { blockId: 'pcu-offgrid', port: 'out_ac_L' },
          to: { blockId: 'acdb-offgrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'PCU Inverter Output',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-pcu-acdb-N',
          from: { blockId: 'pcu-offgrid', port: 'out_ac_N' },
          to: { blockId: 'acdb-offgrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-pcu-acdb-PE',
          from: { blockId: 'pcu-offgrid', port: 'out_ac_PE' },
          to: { blockId: 'acdb-offgrid', port: 'in_PE' },
          type: 'earth',
          routing: 'direct'
        },
        {
          id: 'wire-pcu-chassis-gnd',
          from: { blockId: 'pcu-offgrid', port: 'chassis_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'PCU Double Body Ground (10 sq.mm)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-batt-gnd',
          from: { blockId: 'batt-offgrid', port: 'rack_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'Battery Enclosure Ground',
          labelOffset: { dx: 14, dy: -24 }
        },
        {
          id: 'wire-acdb-spd-gnd',
          from: { blockId: 'acdb-offgrid', port: 'spd_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'ACDB SPD Earth',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-acdb-loads-L',
          from: { blockId: 'acdb-offgrid', port: 'out_L' },
          to: { blockId: 'loads-offgrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'To Loads',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-acdb-loads-N',
          from: { blockId: 'acdb-offgrid', port: 'out_N' },
          to: { blockId: 'loads-offgrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-acdb-loads-PE',
          from: { blockId: 'acdb-offgrid', port: 'out_PE' },
          to: { blockId: 'loads-offgrid', port: 'in_PE' },
          type: 'earth',
          routing: 'direct'
        }
      ],
      earthDimensions: [
        {
          fromId: 'pit-la',
          toId: 'pit-dc',
          y: 566,
          label: 'Min 3.0m - 5.0m Separation (IS 3043:2018 / IEC 62305: d ≥ 2×L)'
        },
        {
          fromId: 'pit-dc',
          toId: 'pit-ac',
          y: 566,
          label: 'Min 3.0m Separation (Sphere of Influence Isolation)'
        }
      ]
    },

    // 3. HYBRID
    'hybrid': {
      viewBox: '0 0 1260 650',
      title: 'HYBRID SOLAR PV SYSTEM SCHEMATIC (BI-DIRECTIONAL ESS + NET METER)',
      subtitle: 'Integrated Grid-Interactive Inverter + High/Low-Volt LiFePO4 ESS + Critical EPS Output + Dedicated Earth Pits',
      blocks: {
        'la-hybrid': {
          type: 'la',
          x: 55, y: 35, w: 90, h: 75,
          title: '⚡ Rooftop LA',
          subtitle: 'ESE / Franklin',
          badge: 'Class I/II 25kA',
          badgeColor: '#f59e0b',
          ports: {
            down_cond: { x: 45, y: 75 }
          }
        },
        'pv-hybrid': {
          type: 'pv-array',
          x: 40, y: 130, w: 200, h: 145,
          title: 'Hybrid PV Array',
          subtitle: 'Series String Daisy-Chain',
          badge: 'Dual MPPT | ~600V DC',
          badgeColor: '#0284c7',
          icon: '☀️',
          ports: {
            out_pos: { x: 200, y: 40 },
            out_neg: { x: 200, y: 65 },
            frame_gnd: { x: 100, y: 145 }
          }
        },
        'dcdb-hybrid': {
          type: 'box',
          x: 290, y: 130, w: 155, h: 145,
          title: 'Hybrid DCDB',
          subtitle: 'Dual-MPPT DCDB',
          badge: '1000V DC SPD + Fuses',
          badgeColor: '#ef4444',
          icon: '🛡️',
          ports: {
            in_pos: { x: 0, y: 40 },
            in_neg: { x: 0, y: 65 },
            out_pos: { x: 155, y: 40 },
            out_neg: { x: 155, y: 65 },
            spd_gnd: { x: 77, y: 145 }
          }
        },
        'hybrid-inv': {
          type: 'box',
          x: 495, y: 105, w: 205, h: 185,
          title: 'Hybrid Inverter',
          subtitle: 'Bi-Directional Multi-Port',
          badge: 'Solar+Batt+Grid+EPS',
          badgeColor: '#3b82f6',
          icon: '🔄',
          hasInverterSymbol: true,
          ports: {
            in_pv_pos: { x: 0, y: 40 },
            in_pv_neg: { x: 0, y: 65 },
            eps_L: { x: 205, y: 35 },
            eps_N: { x: 205, y: 55 },
            grid_L: { x: 205, y: 95 },
            grid_N: { x: 205, y: 115 },
            grid_PE: { x: 205, y: 135 },
            batt_pos: { x: 65, y: 185 },
            batt_neg: { x: 135, y: 185 },
            chassis_gnd: { x: 100, y: 185 }
          }
        },
        'batt-hybrid': {
          type: 'box',
          x: 495, y: 345, w: 205, h: 120,
          title: 'LiFePO4 ESS Battery',
          subtitle: 'Lithium Battery + BMS',
          badge: 'CAN/RS485 Active BMS',
          badgeColor: '#0d9488',
          icon: '🔋',
          hasBatteryCells: true,
          ports: {
            in_batt_pos: { x: 65, y: 0 },
            in_batt_neg: { x: 135, y: 0 },
            rack_gnd: { x: 170, y: 120 }
          }
        },
        'crit-loads': {
          type: 'box',
          x: 760, y: 65, w: 145, h: 95,
          title: 'Critical Loads Panel',
          subtitle: 'UPS EPS Port (<10ms)',
          badge: 'Zero Blackout Power',
          badgeColor: '#10b981',
          icon: '⚡',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 }
          }
        },
        'acdb-hybrid': {
          type: 'box',
          x: 760, y: 195, w: 145, h: 140,
          title: 'Main ACDB Panel',
          subtitle: 'Bi-Directional Combiner',
          badge: 'Class C MCB + AC SPD',
          badgeColor: '#dc2626',
          icon: '⚡',
          ports: {
            in_L: { x: 0, y: 35 },
            in_N: { x: 0, y: 55 },
            in_PE: { x: 0, y: 75 },
            out_L: { x: 145, y: 35 },
            out_N: { x: 145, y: 55 },
            out_loads_L: { x: 145, y: 90 },
            out_loads_N: { x: 145, y: 110 },
            spd_gnd: { x: 72, y: 140 }
          }
        },
        'netmeter-hybrid': {
          type: 'box',
          x: 960, y: 195, w: 130, h: 140,
          title: 'Net Meter',
          subtitle: 'Bi-Directional Smart',
          badge: 'Import / Export kWh',
          badgeColor: '#0284c7',
          icon: '🔄',
          hasNetMeterLcd: true,
          ports: {
            in_L: { x: 0, y: 35 },
            in_N: { x: 0, y: 55 },
            out_L: { x: 130, y: 35 },
            out_N: { x: 130, y: 55 }
          }
        },
        'grid-hybrid': {
          type: 'box',
          x: 1140, y: 110, w: 105, h: 90,
          title: 'EB Grid',
          subtitle: 'DISCOM LT Line',
          badge: '230V/415V',
          badgeColor: '#6366f1',
          icon: '🏭',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 }
          }
        },
        'main-loads': {
          type: 'box',
          x: 1140, y: 250, w: 105, h: 100,
          title: 'Normal Loads',
          subtitle: 'Non-Backup LT Board',
          badge: 'High Power Loads',
          badgeColor: '#64748b',
          icon: '🏠',
          ports: {
            in_L: { x: 0, y: 30 },
            in_N: { x: 0, y: 55 }
          }
        },
        'pit-la': {
          type: 'earth-pit',
          x: 100, y: 540, w: 90, h: 60,
          name: 'LA Earth Pit',
          tag: 'Pit 1 (LA Only)',
          code: 'R ≤ 5Ω | IEC 62305',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-dc': {
          type: 'earth-pit',
          x: 370, y: 540, w: 90, h: 60,
          name: 'DC Earth Pit',
          tag: 'Pit 2 (DC Array & SPD)',
          code: 'R ≤ 5Ω | IEC 62548',
          ports: {
            top: { x: 0, y: -15 }
          }
        },
        'pit-ac': {
          type: 'earth-pit',
          x: 850, y: 540, w: 90, h: 60,
          name: 'AC Earth Pit',
          tag: 'Pit 3 (Inverter & ACDB)',
          code: 'R ≤ 5Ω | IS 3043',
          ports: {
            top: { x: 0, y: -15 }
          }
        }
      },
      wires: [
        {
          id: 'wire-la-pit',
          from: { blockId: 'la-hybrid', port: 'down_cond' },
          to: { blockId: 'pit-la', port: 'top' },
          type: 'la-down',
          routing: 'direct',
          label: '25x3 mm Cu Down Conductor',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-pv-dcdb-pos',
          from: { blockId: 'pv-hybrid', port: 'out_pos' },
          to: { blockId: 'dcdb-hybrid', port: 'in_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'DC (+) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-pv-dcdb-neg',
          from: { blockId: 'pv-hybrid', port: 'out_neg' },
          to: { blockId: 'dcdb-hybrid', port: 'in_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'DC (-) 4/6 sq.mm',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-pv-gnd',
          from: { blockId: 'pv-hybrid', port: 'frame_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'PV Structure Ground',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-dcdb-inv-pos',
          from: { blockId: 'dcdb-hybrid', port: 'out_pos' },
          to: { blockId: 'hybrid-inv', port: 'in_pv_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'PV Input (+)',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-dcdb-inv-neg',
          from: { blockId: 'dcdb-hybrid', port: 'out_neg' },
          to: { blockId: 'hybrid-inv', port: 'in_pv_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'PV Input (-)',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-dcdb-spd-gnd',
          from: { blockId: 'dcdb-hybrid', port: 'spd_gnd' },
          to: { blockId: 'pit-dc', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'DC SPD Earth',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-inv-batt-pos',
          from: { blockId: 'hybrid-inv', port: 'batt_pos' },
          to: { blockId: 'batt-hybrid', port: 'in_batt_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'Heavy DC (+) + CAN BMS',
          labelOffset: { dx: -14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-inv-batt-neg',
          from: { blockId: 'hybrid-inv', port: 'batt_neg' },
          to: { blockId: 'batt-hybrid', port: 'in_batt_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'Heavy DC (-)',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-inv-crit-L',
          from: { blockId: 'hybrid-inv', port: 'eps_L' },
          to: { blockId: 'crit-loads', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'EPS Port (<10ms UPS)',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-inv-crit-N',
          from: { blockId: 'hybrid-inv', port: 'eps_N' },
          to: { blockId: 'crit-loads', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-inv-acdb-L',
          from: { blockId: 'hybrid-inv', port: 'grid_L' },
          to: { blockId: 'acdb-hybrid', port: 'in_L' },
          type: 'bidi-phase',
          routing: 'direct',
          label: 'Bi-Dir Intertie ⮂',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-inv-acdb-N',
          from: { blockId: 'hybrid-inv', port: 'grid_N' },
          to: { blockId: 'acdb-hybrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-inv-acdb-PE',
          from: { blockId: 'hybrid-inv', port: 'grid_PE' },
          to: { blockId: 'acdb-hybrid', port: 'in_PE' },
          type: 'earth',
          routing: 'direct'
        },
        {
          id: 'wire-inv-chassis-gnd',
          from: { blockId: 'hybrid-inv', port: 'chassis_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'Inverter Body Ground (10 sq.mm)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-batt-gnd',
          from: { blockId: 'batt-hybrid', port: 'rack_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'Battery Enclosure Ground',
          labelOffset: { dx: 14, dy: -24 }
        },
        {
          id: 'wire-acdb-spd-gnd',
          from: { blockId: 'acdb-hybrid', port: 'spd_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'ACDB SPD Earth',
          labelOffset: { dx: 10, dy: -40 }
        },
        {
          id: 'wire-acdb-netmeter-L',
          from: { blockId: 'acdb-hybrid', port: 'out_L' },
          to: { blockId: 'netmeter-hybrid', port: 'in_L' },
          type: 'bidi-phase',
          routing: 'direct',
          label: 'Net Meter ⮂',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-acdb-netmeter-N',
          from: { blockId: 'acdb-hybrid', port: 'out_N' },
          to: { blockId: 'netmeter-hybrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-netmeter-grid-L',
          from: { blockId: 'netmeter-hybrid', port: 'out_L' },
          to: { blockId: 'grid-hybrid', port: 'in_L' },
          type: 'ac-phase',
          routing: 'step-hv',
          label: 'To Grid',
          labelOffset: { dx: 12, dy: -8 }
        },
        {
          id: 'wire-netmeter-grid-N',
          from: { blockId: 'netmeter-hybrid', port: 'out_N' },
          to: { blockId: 'grid-hybrid', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'step-hv'
        },
        {
          id: 'wire-acdb-loads-L',
          from: { blockId: 'acdb-hybrid', port: 'out_loads_L' },
          to: { blockId: 'main-loads', port: 'in_L' },
          type: 'ac-phase',
          routing: 'step-hv',
          label: 'To Normal Loads',
          labelOffset: { dx: 12, dy: 16 }
        },
        {
          id: 'wire-acdb-loads-N',
          from: { blockId: 'acdb-hybrid', port: 'out_loads_N' },
          to: { blockId: 'main-loads', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'step-hv'
        }
      ],
      earthDimensions: [
        {
          fromId: 'pit-la',
          toId: 'pit-dc',
          y: 566,
          label: 'Min 3.0m - 5.0m Separation (IS 3043:2018 / IEC 62305: d ≥ 2×L)'
        },
        {
          fromId: 'pit-dc',
          toId: 'pit-ac',
          y: 566,
          label: 'Min 3.0m Separation (Sphere of Influence Isolation)'
        }
      ]
    },

    // 4. WITHOUT SOLAR (HOME UPS)
    'without-solar': {
      viewBox: '0 0 1260 650',
      title: 'WITHOUT SOLAR HOME UPS / INVERTER SYSTEM SCHEMATIC',
      subtitle: 'Utility Grid Incomer + Main DB (MCB/RCCB) + Pure Sine Wave Inverter + Battery Bank + Isolated Consumer Earthing',
      blocks: {
        'grid-nosolar': {
          type: 'box',
          x: 60, y: 165, w: 130, h: 120,
          title: 'EB Utility Grid',
          subtitle: 'DISCOM 1-Phase LT',
          badge: '230V AC 50Hz Supply',
          badgeColor: '#6366f1',
          icon: '🏭',
          ports: {
            out_L: { x: 130, y: 40 },
            out_N: { x: 130, y: 65 }
          }
        },
        'maindb-nosolar': {
          type: 'box',
          x: 255, y: 155, w: 165, h: 150,
          title: 'Main Dist. Board',
          subtitle: 'DP MCB + 30mA RCCB',
          badge: 'Class C MCB + AC SPD',
          badgeColor: '#dc2626',
          icon: '⚡',
          ports: {
            in_L: { x: 0, y: 50 },
            in_N: { x: 0, y: 75 },
            out_L: { x: 165, y: 45 },
            out_N: { x: 165, y: 70 },
            out_PE: { x: 165, y: 95 },
            earth_bus: { x: 82, y: 150 }
          }
        },
        'ups-nosolar': {
          type: 'box',
          x: 485, y: 135, w: 205, h: 175,
          title: 'Home UPS / Inverter',
          subtitle: 'Pure Sine Wave Inverter',
          badge: 'DSP Microcontroller Inverter',
          badgeColor: '#3b82f6',
          icon: '⚡',
          hasInverterSymbol: true,
          ports: {
            in_ac_L: { x: 0, y: 45 },
            in_ac_N: { x: 0, y: 70 },
            in_ac_PE: { x: 0, y: 95 },
            out_ac_L: { x: 205, y: 50 },
            out_ac_N: { x: 205, y: 75 },
            out_ac_PE: { x: 205, y: 100 },
            batt_pos: { x: 65, y: 175 },
            batt_neg: { x: 135, y: 175 },
            chassis_gnd: { x: 100, y: 175 }
          }
        },
        'batt-nosolar': {
          type: 'box',
          x: 485, y: 365, w: 205, h: 120,
          title: 'Inverter Battery',
          subtitle: 'Tall Tubular / LiFePO4',
          badge: '12V/24V 150Ah-220Ah',
          badgeColor: '#0d9488',
          icon: '🔋',
          hasBatteryCells: true,
          ports: {
            in_batt_pos: { x: 65, y: 0 },
            in_batt_neg: { x: 135, y: 0 }
          }
        },
        'loads-nosolar': {
          type: 'box',
          x: 760, y: 155, w: 165, h: 150,
          title: 'Dedicated Loads',
          subtitle: 'Essential Backup DB',
          badge: 'LED, Fans, TV, Wi-Fi',
          badgeColor: '#10b981',
          icon: '💡',
          ports: {
            in_L: { x: 0, y: 45 },
            in_N: { x: 0, y: 70 },
            in_PE: { x: 0, y: 95 }
          }
        },
        'pit-ac': {
          type: 'earth-pit',
          x: 585, y: 540, w: 105, h: 65,
          name: 'AC Earth Pit',
          tag: 'Pit 1 (Consumer Ground)',
          code: 'R ≤ 5Ω | IS 3043:2018',
          ports: {
            top: { x: 0, y: -15 }
          }
        }
      },
      wires: [
        {
          id: 'wire-grid-maindb-L',
          from: { blockId: 'grid-nosolar', port: 'out_L' },
          to: { blockId: 'maindb-nosolar', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'Grid Phase (L)',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-grid-maindb-N',
          from: { blockId: 'grid-nosolar', port: 'out_N' },
          to: { blockId: 'maindb-nosolar', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct',
          label: 'Grid Neutral (N)',
          labelOffset: { dx: 0, dy: 16 }
        },
        {
          id: 'wire-maindb-earth',
          from: { blockId: 'maindb-nosolar', port: 'earth_bus' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'step-vh',
          label: 'Main DB Earth Bus (10 sq.mm Cu)',
          labelOffset: { dx: 20, dy: -8 }
        },
        {
          id: 'wire-maindb-ups-L',
          from: { blockId: 'maindb-nosolar', port: 'out_L' },
          to: { blockId: 'ups-nosolar', port: 'in_ac_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'UPS Incomer Phase',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-maindb-ups-N',
          from: { blockId: 'maindb-nosolar', port: 'out_N' },
          to: { blockId: 'ups-nosolar', port: 'in_ac_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-maindb-ups-PE',
          from: { blockId: 'maindb-nosolar', port: 'out_PE' },
          to: { blockId: 'ups-nosolar', port: 'in_ac_PE' },
          type: 'earth',
          routing: 'direct'
        },
        {
          id: 'wire-ups-batt-pos',
          from: { blockId: 'ups-nosolar', port: 'batt_pos' },
          to: { blockId: 'batt-nosolar', port: 'in_batt_pos' },
          type: 'dc-pos',
          routing: 'direct',
          label: 'Heavy DC (+) with Fuse',
          labelOffset: { dx: -14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-ups-batt-neg',
          from: { blockId: 'ups-nosolar', port: 'batt_neg' },
          to: { blockId: 'batt-nosolar', port: 'in_batt_neg' },
          type: 'dc-neg',
          routing: 'direct',
          label: 'Heavy DC (-)',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-ups-chassis-gnd',
          from: { blockId: 'ups-nosolar', port: 'chassis_gnd' },
          to: { blockId: 'pit-ac', port: 'top' },
          type: 'earth',
          routing: 'direct',
          label: 'Chassis Earth Pin',
          labelOffset: { dx: 14, dy: 0 },
          verticalLabel: true
        },
        {
          id: 'wire-ups-loads-L',
          from: { blockId: 'ups-nosolar', port: 'out_ac_L' },
          to: { blockId: 'loads-nosolar', port: 'in_L' },
          type: 'ac-phase',
          routing: 'direct',
          label: 'Inverter Output Phase',
          labelOffset: { dx: 0, dy: -10 }
        },
        {
          id: 'wire-ups-loads-N',
          from: { blockId: 'ups-nosolar', port: 'out_ac_N' },
          to: { blockId: 'loads-nosolar', port: 'in_N' },
          type: 'ac-neutral',
          routing: 'direct'
        },
        {
          id: 'wire-ups-loads-PE',
          from: { blockId: 'ups-nosolar', port: 'out_ac_PE' },
          to: { blockId: 'loads-nosolar', port: 'in_PE' },
          type: 'earth',
          routing: 'direct'
        }
      ],
      earthDimensions: []
    }
  };

  /* =========================================================================
     SVG SHARED DEFS (MARKERS, FILTERS, PATTERNS, GRADIENTS)
     ========================================================================= */
  function getSharedDefs() {
    return `
      <defs>
        <!-- Arrowhead Markers -->
        <marker id="arr-dc-pos" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
        </marker>
        <marker id="arr-dc-neg" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
        </marker>
        <marker id="arr-ac-phase" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
        </marker>
        <marker id="arr-ac-neutral" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>
        <marker id="arr-earth" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16a34a" />
        </marker>
        <marker id="arr-bidi-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#0284c7" />
        </marker>
        <marker id="arr-bidi-end" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>

        <!-- Dimension Line Markers (Earthing Distance) -->
        <marker id="arr-dim-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
          <path d="M 8 2 L 2 5 L 8 8 z" fill="#10b981" />
        </marker>
        <marker id="arr-dim-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
          <path d="M 2 2 L 8 5 L 2 8 z" fill="#10b981" />
        </marker>

        <!-- Drop Shadows & Glow Filters -->
        <filter id="box-shadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-opacity="0.14" />
        </filter>
        <filter id="box-shadow-dark" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="4.5" flood-color="#000000" flood-opacity="0.55" />
        </filter>

        <!-- Striped Ground Wire Pattern (Green & Yellow) -->
        <pattern id="pe-stripe" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#16a34a" stroke-width="4" />
          <line x1="4" y1="0" x2="4" y2="8" stroke="#eab308" stroke-width="4" />
        </pattern>

        <!-- Solar Cells Mesh Pattern (Higher Definition) -->
        <pattern id="pv-cell-grid" width="14" height="20" patternUnits="userSpaceOnUse">
          <rect width="14" height="20" fill="#0f172a" stroke="#38bdf8" stroke-width="0.75" />
          <line x1="7" y1="0" x2="7" y2="20" stroke="#94a3b8" stroke-width="0.35" stroke-dasharray="1.5,1.5" />
        </pattern>
      </defs>
    `;
  }

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /* =========================================================================
     BLOCK RENDERERS (LARGE, CRISP, HIGH-LEGIBILITY)
     ========================================================================= */
  function renderTerminalBadge(x, y, label, type) {
    let fill = '#ef4444';
    if (type === 'dc-neg') fill = '#1e293b';
    if (type === 'ac-phase') fill = '#dc2626';
    if (type === 'ac-neutral') fill = '#0284c7';
    if (type === 'earth') fill = '#16a34a';

    return `
      <g transform="translate(${x}, ${y})" class="sld-terminal-node">
        <circle cx="0" cy="0" r="6" fill="${fill}" stroke="#ffffff" stroke-width="1.3" />
        <text x="0" y="3" font-family="system-ui, sans-serif" font-size="7.5" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(label)}</text>
      </g>
    `;
  }

  function renderBlockGraphic(blockId, block, isDark) {
    const bgFill = isDark ? '#111e38' : '#ffffff';
    const borderStroke = isDark ? '#2b4474' : '#cbd5e1';
    const titleFill = isDark ? '#f8fafc' : '#0f172a';
    const subFill = isDark ? '#94a3b8' : '#64748b';
    const shadowFilter = isDark ? 'url(#box-shadow-dark)' : 'url(#box-shadow)';

    // 1. Lightning Arrester
    if (block.type === 'la') {
      return `
        <g class="sld-draggable-block sld-interactive-item" data-comp-id="${blockId}" cursor="grab">
          <g transform="translate(${block.w / 2}, 0)">
            <path d="M 0 0 L 0 38 M -10 38 L 10 38 M 0 0 L -8 14 M 0 0 L 8 14" stroke="#f59e0b" stroke-width="2.8" fill="none" />
          </g>
          <rect x="0" y="40" width="${block.w}" height="35" rx="5" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="#f59e0b" stroke-width="1.5" class="sld-box-rect" />
          <text x="${block.w / 2}" y="54" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}" text-anchor="middle">${escapeXml(block.title)}</text>
          <text x="${block.w / 2}" y="66" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#f59e0b" text-anchor="middle">${escapeXml(block.subtitle)}</text>
          ${renderTerminalBadge(block.ports.down_cond.x, block.ports.down_cond.y, '⏚', 'earth')}
        </g>
      `;
    }

    // 2. Earth Pit
    if (block.type === 'earth-pit') {
      const textFill = isDark ? '#f8fafc' : '#0f172a';
      const subFill = isDark ? '#4ade80' : '#15803d';
      const pitBg = isDark ? '#1a2234' : '#f1f5f9';
      const border = isDark ? '#22c55e' : '#16a34a';

      return `
        <g class="sld-draggable-block sld-interactive-item sld-earth-pit-item" data-comp-id="${blockId}" cursor="grab">
          <!-- Earth Pit Enclosure Chamber -->
          <rect x="-45" y="-15" width="90" height="60" rx="8" fill="${pitBg}" stroke="${border}" stroke-width="1.6" class="sld-box-rect" />
          
          <!-- Ground Earthing Symbol (⏚) -->
          <line x1="0" y1="-4" x2="0" y2="14" stroke="#16a34a" stroke-width="2.8" />
          <line x1="-14" y1="14" x2="14" y2="14" stroke="#16a34a" stroke-width="2.8" />
          <line x1="-9" y1="19" x2="9" y2="19" stroke="#16a34a" stroke-width="2.2" />
          <line x1="-4" y1="24" x2="4" y2="24" stroke="#16a34a" stroke-width="1.8" />
          
          <!-- Labels (Large, bold, high-contrast) -->
          <text x="0" y="37" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="${textFill}" text-anchor="middle">${escapeXml(block.name)}</text>
          <text x="0" y="50" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="${subFill}" text-anchor="middle">${escapeXml(block.tag)}</text>
          <text x="0" y="63" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${isDark ? '#cbd5e1' : '#64748b'}" text-anchor="middle">${escapeXml(block.code)}</text>
          ${renderTerminalBadge(0, -15, '⏚', 'earth')}
        </g>
      `;
    }

    // 3. Solar PV Array with Series String Daisy-Chain Graphic
    if (block.type === 'pv-array') {
      return `
        <g class="sld-draggable-block sld-interactive-item" data-comp-id="${blockId}" cursor="grab">
          <rect x="0" y="0" width="${block.w}" height="${block.h}" rx="9" ry="9" 
            fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.8" filter="${shadowFilter}" class="sld-box-rect" />
          
          <!-- Header -->
          <text x="12" y="19" font-family="system-ui, sans-serif" font-size="12.5" font-weight="800" fill="${titleFill}">
            ${block.icon} ${escapeXml(block.title)}
          </text>
          <text x="12" y="33" font-family="system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${subFill}">
            ${escapeXml(block.subtitle)}
          </text>

          <!-- Series Daisy-Chain Internal Solar Modules Diagram -->
          <g transform="translate(12, 42)">
            <!-- Module 1 -->
            <rect x="0" y="0" width="48" height="32" rx="3" fill="url(#pv-cell-grid)" stroke="#38bdf8" stroke-width="1" />
            <text x="24" y="20" font-family="sans-serif" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">Mod 1</text>
            <circle cx="4" cy="16" r="3" fill="#ef4444" />
            <circle cx="44" cy="16" r="3" fill="#334155" />

            <!-- Series Daisy Chain Loop 1->2 -->
            <path d="M 44 16 C 56 16, 56 16, 64 16" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3,1.5" fill="none" />

            <!-- Module 2 -->
            <rect x="64" y="0" width="48" height="32" rx="3" fill="url(#pv-cell-grid)" stroke="#38bdf8" stroke-width="1" />
            <text x="88" y="20" font-family="sans-serif" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">Mod 2</text>
            <circle cx="68" cy="16" r="3" fill="#ef4444" />
            <circle cx="108" cy="16" r="3" fill="#334155" />

            <!-- Series Daisy Chain Loop 2->3 -->
            <path d="M 108 16 C 120 16, 120 16, 128 16" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3,1.5" fill="none" />

            <!-- Module 3 -->
            <rect x="128" y="0" width="48" height="32" rx="3" fill="url(#pv-cell-grid)" stroke="#38bdf8" stroke-width="1" />
            <text x="152" y="20" font-family="sans-serif" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">Mod 3</text>
            <circle cx="132" cy="16" r="3" fill="#ef4444" />
            <circle cx="172" cy="16" r="3" fill="#334155" />
          </g>

          <!-- String Interconnection Explanation -->
          <text x="${block.w / 2}" y="92" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="#38bdf8" text-anchor="middle">
            Series String: (+) to (-) Daisy-Chain (Sum Voc)
          </text>
          <text x="${block.w / 2}" y="105" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="${isDark ? '#cbd5e1' : '#475569'}" text-anchor="middle">
            Weatherproof MC4 Locking Terminations
          </text>

          <!-- Technical Badge -->
          <rect x="12" y="${block.h - 26}" width="${block.w - 24}" height="18" rx="4" fill="${block.badgeColor}" fill-opacity="0.18" stroke="${block.badgeColor}" stroke-width="1" />
          <text x="${block.w / 2}" y="${block.h - 13}" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${block.badgeColor}" text-anchor="middle">
            ${escapeXml(block.badge)}
          </text>

          <!-- Terminals -->
          ${renderTerminalBadge(block.ports.out_pos.x, block.ports.out_pos.y, '+', 'dc-pos')}
          ${renderTerminalBadge(block.ports.out_neg.x, block.ports.out_neg.y, '-', 'dc-neg')}
          ${renderTerminalBadge(block.ports.frame_gnd.x, block.ports.frame_gnd.y, '⏚', 'earth')}
        </g>
      `;
    }

    // 4. Standard Component Box with Terminals and Custom Internal Graphics
    let internalGraphics = '';

    if (block.hasInverterSymbol) {
      internalGraphics = `
        <g transform="translate(${block.w / 2}, 78)">
          <circle cx="0" cy="0" r="16" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1.5" />
          <text x="-9" y="-2" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#ef4444">=</text>
          <text x="2" y="5" font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="#3b82f6">∿</text>
        </g>
      `;
    } else if (block.hasNetMeterLcd) {
      internalGraphics = `
        <g transform="translate(16, 75)">
          <rect x="0" y="0" width="${block.w - 32}" height="24" rx="4" fill="${isDark ? '#022c22' : '#dcfce7'}" stroke="#10b981" stroke-width="1" />
          <text x="${(block.w - 32) / 2}" y="16" font-family="monospace" font-size="10" font-weight="800" fill="#10b981" text-anchor="middle">
            ⮂ 004820 kWh
          </text>
        </g>
      `;
    } else if (block.hasBatteryCells) {
      internalGraphics = `
        <g transform="translate(18, 52)">
          <rect x="0" y="0" width="36" height="24" rx="3" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="#0d9488" stroke-width="1" />
          <rect x="44" y="0" width="36" height="24" rx="3" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="#0d9488" stroke-width="1" />
          <rect x="88" y="0" width="36" height="24" rx="3" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="#0d9488" stroke-width="1" />
          <rect x="132" y="0" width="36" height="24" rx="3" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="#0d9488" stroke-width="1" />
          <text x="84" y="16" font-family="sans-serif" font-size="8.5" font-weight="800" fill="#0d9488" text-anchor="middle">CELL STACK</text>
        </g>
      `;
    } else if (block.hasPcuDiagram) {
      internalGraphics = `
        <g transform="translate(18, 56)">
          <rect x="0" y="0" width="78" height="28" rx="4" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#38bdf8" stroke-width="1.2" />
          <text x="39" y="18" font-family="system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#38bdf8" text-anchor="middle">MPPT CC</text>

          <rect x="91" y="0" width="78" height="28" rx="4" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#3b82f6" stroke-width="1.2" />
          <text x="130" y="18" font-family="system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#3b82f6" text-anchor="middle">INVERTER</text>
        </g>
      `;
    }

    // Terminals markup
    let terminalsMarkup = '';
    if (block.ports) {
      Object.entries(block.ports).forEach(([portName, port]) => {
        let label = '+';
        let type = 'dc-pos';
        if (portName.includes('neg')) { label = '-'; type = 'dc-neg'; }
        else if (portName.includes('_L')) { label = 'L'; type = 'ac-phase'; }
        else if (portName.includes('_N')) { label = 'N'; type = 'ac-neutral'; }
        else if (portName.includes('_PE') || portName.includes('gnd') || portName.includes('earth')) { label = '⏚'; type = 'earth'; }
        terminalsMarkup += renderTerminalBadge(port.x, port.y, label, type);
      });
    }

    return `
      <g class="sld-draggable-block sld-interactive-item" data-comp-id="${blockId}" cursor="grab">
        <rect x="0" y="0" width="${block.w}" height="${block.h}" rx="9" ry="9" 
          fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.8" filter="${shadowFilter}" class="sld-box-rect" />
        
        <text x="12" y="19" font-family="system-ui, sans-serif" font-size="12.5" font-weight="800" fill="${titleFill}">
          ${block.icon || ''} ${escapeXml(block.title)}
        </text>
        
        <text x="12" y="33" font-family="system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${subFill}">
          ${escapeXml(block.subtitle)}
        </text>

        ${internalGraphics}

        ${block.badge ? `
          <rect x="12" y="${block.h - 26}" width="${block.w - 24}" height="18" rx="4" fill="${block.badgeColor || '#3b82f6'}" fill-opacity="0.18" stroke="${block.badgeColor || '#3b82f6'}" stroke-width="1" />
          <text x="${block.w / 2}" y="${block.h - 13}" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${block.badgeColor || '#3b82f6'}" text-anchor="middle">
            ${escapeXml(block.badge)}
          </text>
        ` : ''}

        ${terminalsMarkup}
      </g>
    `;
  }

  /* =========================================================================
     DYNAMIC WIRE COMPUTATION (WITH CAD JUMPER BRIDGE ARCS)
     ========================================================================= */
  function computeWireData(wire, sysConfig, positions) {
    const fromBlock = sysConfig.blocks[wire.from.blockId];
    const toBlock = sysConfig.blocks[wire.to.blockId];
    if (!fromBlock || !toBlock) return null;

    const fromPos = positions[wire.from.blockId] || { dx: 0, dy: 0 };
    const toPos = positions[wire.to.blockId] || { dx: 0, dy: 0 };

    const fromPort = fromBlock.ports[wire.from.port] || { x: 0, y: 0 };
    const toPort = toBlock.ports[wire.to.port] || { x: 0, y: 0 };

    const x1 = fromBlock.x + fromPos.dx + fromPort.x;
    const y1 = fromBlock.y + fromPos.dy + fromPort.y;
    const x2 = toBlock.x + toPos.dx + toPort.x;
    const y2 = toBlock.y + toPos.dy + toPort.y;

    let pathD = '';
    let lblX = (x1 + x2) / 2;
    let lblY = (y1 + y2) / 2;

    if (wire.routing === 'direct') {
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (wire.routing === 'step-vh') {
      pathD = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
      lblX = x1;
      lblY = (y1 + y2) / 2;
    } else if (wire.routing === 'step-hv') {
      pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
      lblX = (x1 + x2) / 2;
      lblY = y1;
    } else if (wire.routing === 'step-hvh') {
      const midX = (x1 + x2) / 2;
      pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
      lblX = midX;
      lblY = (y1 + y2) / 2;
    }

    if (wire.labelOffset) {
      lblX += wire.labelOffset.dx;
      lblY += wire.labelOffset.dy;
    }

    return { pathD, lblX, lblY };
  }

  function getWireStyleAttributes(type, isDark) {
    if (type === 'dc-pos') {
      return 'stroke="#ef4444" stroke-width="3" fill="none" marker-end="url(#arr-dc-pos)"';
    } else if (type === 'dc-neg') {
      const col = isDark ? '#475569' : '#1e293b';
      return `stroke="${col}" stroke-width="3" fill="none" marker-end="url(#arr-dc-neg)"`;
    } else if (type === 'ac-phase') {
      return 'stroke="#dc2626" stroke-width="3" fill="none" marker-end="url(#arr-ac-phase)"';
    } else if (type === 'ac-neutral') {
      return 'stroke="#0284c7" stroke-width="2.5" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-ac-neutral)"';
    } else if (type === 'earth') {
      return 'stroke="#16a34a" stroke-width="2.5" fill="none" marker-end="url(#arr-earth)"';
    } else if (type === 'la-down') {
      return 'stroke="#f59e0b" stroke-width="2.6" stroke-dasharray="6,3" fill="none" marker-end="url(#arr-earth)"';
    } else if (type === 'bidi-phase') {
      return 'stroke="#0284c7" stroke-width="3.2" fill="none" marker-start="url(#arr-bidi-start)" marker-end="url(#arr-bidi-end)"';
    }
    return 'stroke="#38bdf8" stroke-width="2.2" fill="none"';
  }

  function getWireLabelColor(type, isDark) {
    if (type === 'dc-pos') return '#ef4444';
    if (type === 'dc-neg') return isDark ? '#94a3b8' : '#334155';
    if (type === 'ac-phase') return '#dc2626';
    if (type === 'ac-neutral') return '#0284c7';
    if (type === 'earth') return '#16a34a';
    if (type === 'la-down') return '#f59e0b';
    if (type === 'bidi-phase') return '#0284c7';
    return isDark ? '#94a3b8' : '#475569';
  }

  /* =========================================================================
     SVG DIAGRAM GENERATION
     ========================================================================= */
  function generateSvgContent(systemType, isDark) {
    const config = SYSTEM_CONFIGS[systemType] || SYSTEM_CONFIGS['on-grid'];
    const positions = sldState.positions[systemType] || {};
    const bgFill = isDark ? '#0b1329' : '#f8fafc';
    const textHaloStroke = isDark ? '#0b1329' : '#f8fafc';

    // 1. Render Wires Layer
    let wiresMarkup = '<g class="sld-wires-layer">';
    config.wires.forEach(wire => {
      const data = computeWireData(wire, config, positions);
      if (!data) return;

      const styleAttrs = getWireStyleAttributes(wire.type, isDark);
      const labelCol = getWireLabelColor(wire.type, isDark);

      wiresMarkup += `
        <path id="wire-${wire.id}" d="${data.pathD}" ${styleAttrs} />
      `;

      if (wire.label) {
        if (wire.verticalLabel) {
          wiresMarkup += `
            <text id="wire-lbl-${wire.id}" x="${data.lblX}" y="${data.lblY}" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${labelCol}" stroke="${textHaloStroke}" stroke-width="3" paint-order="stroke fill" stroke-linejoin="round" transform="rotate(-90 ${data.lblX} ${data.lblY})">
              ${escapeXml(wire.label)}
            </text>
          `;
        } else {
          wiresMarkup += `
            <text id="wire-lbl-${wire.id}" x="${data.lblX}" y="${data.lblY}" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${labelCol}" stroke="${textHaloStroke}" stroke-width="3" paint-order="stroke fill" stroke-linejoin="round" text-anchor="middle">
              ${escapeXml(wire.label)}
            </text>
          `;
        }
      }
    });
    wiresMarkup += '</g>';

    // 2. Render Earth Pit Separation Dimension Lines (IS 3043:2018 / IEC 62305)
    let earthDimMarkup = '<g class="sld-earth-dimensions-layer">';
    if (config.earthDimensions && config.earthDimensions.length > 0) {
      config.earthDimensions.forEach((dim, idx) => {
        const fromB = config.blocks[dim.fromId];
        const toB = config.blocks[dim.toId];
        if (fromB && toB) {
          const p1 = positions[dim.fromId] || { dx: 0, dy: 0 };
          const p2 = positions[dim.toId] || { dx: 0, dy: 0 };
          const x1 = fromB.x + p1.dx + 48;
          const x2 = toB.x + p2.dx - 48;
          const y = dim.y;
          const midX = (x1 + x2) / 2;

          earthDimMarkup += `
            <path id="earth-dim-${idx}" d="M ${x1} ${y} L ${x2} ${y}" stroke="#10b981" stroke-width="1.8" stroke-dasharray="5,2.5" marker-start="url(#arr-dim-start)" marker-end="url(#arr-dim-end)" />
            <text id="earth-dim-lbl-${idx}" x="${midX}" y="${y - 8}" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#10b981" stroke="${textHaloStroke}" stroke-width="3" paint-order="stroke fill" stroke-linejoin="round" text-anchor="middle">
              ${escapeXml(dim.label)}
            </text>
          `;
        }
      });
    }
    earthDimMarkup += '</g>';

    // 3. Render Blocks Layer
    let blocksMarkup = '<g class="sld-blocks-layer">';
    Object.entries(config.blocks).forEach(([blockId, block]) => {
      const pos = positions[blockId] || { dx: 0, dy: 0 };
      const curX = block.x + pos.dx;
      const curY = block.y + pos.dy;

      blocksMarkup += `
        <g id="block-wrapper-${blockId}" transform="translate(${curX}, ${curY})">
          ${renderBlockGraphic(blockId, block, isDark)}
        </g>
      `;
    });
    blocksMarkup += '</g>';

    return `
      <svg viewBox="${config.viewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        ${getSharedDefs()}
        <rect width="1260" height="650" fill="${bgFill}" class="sld-bg-canvas" />

        <!-- Engineering Grid Watermark -->
        <g opacity="${isDark ? '0.06' : '0.03'}" stroke="#38bdf8" stroke-width="1">
          <line x1="0" y1="130" x2="1260" y2="130" stroke-dasharray="4,4" />
          <line x1="0" y1="290" x2="1260" y2="290" stroke-dasharray="4,4" />
          <line x1="0" y1="460" x2="1260" y2="460" stroke-dasharray="4,4" />
          <line x1="250" y1="0" x2="250" y2="650" stroke-dasharray="4,4" />
          <line x1="480" y1="0" x2="480" y2="650" stroke-dasharray="4,4" />
          <line x1="720" y1="0" x2="720" y2="650" stroke-dasharray="4,4" />
          <line x1="950" y1="0" x2="950" y2="650" stroke-dasharray="4,4" />
        </g>

        <!-- Title Banner -->
        <g transform="translate(35, 30)">
          <text font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="${isDark ? '#38bdf8' : '#0284c7'}">
            ${config.title}
          </text>
          <text y="17" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${isDark ? '#94a3b8' : '#64748b'}">
            ${config.subtitle}
          </text>
        </g>

        <!-- Ground Horizon Guideline -->
        <line x1="30" y1="515" x2="1230" y2="515" stroke="${isDark ? '#334155' : '#cbd5e1'}" stroke-width="1.8" stroke-dasharray="5,4" />
        <text x="35" y="508" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="${isDark ? '#94a3b8' : '#475569'}">
          TERRESTRIAL SOIL LEVEL (IS 3043:2018 &amp; IEC 62305 MANDATORY GROUND HORIZON) ──────────────────────────────────────────────────────────────────────────
        </text>

        <!-- Dynamic Wires -->
        ${wiresMarkup}

        <!-- Earth Separation Dimension Lines -->
        ${earthDimMarkup}

        <!-- Draggable Blocks -->
        ${blocksMarkup}

        <!-- Earthing Standard Code Annotation Box -->
        <g transform="translate(930, 530)">
          <rect width="300" height="85" rx="7" fill="${isDark ? '#111e38' : '#ffffff'}" stroke="${isDark ? '#263b63' : '#e2e8f0'}" stroke-width="1.4" />
          <text x="14" y="20" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="${isDark ? '#f8fafc' : '#0f172a'}">
            MANDATORY EARTHING DISTANCE (IS 3043 / IEC 62305):
          </text>
          <circle cx="20" cy="35" r="4" fill="#f59e0b" />
          <text x="32" y="38" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${isDark ? '#cbd5e1' : '#475569'}">
            Min 3.0m - 5.0m Isolation: Eliminates Sphere of Influence Overlap
          </text>
          <circle cx="20" cy="53" r="4" fill="#16a34a" />
          <text x="32" y="56" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${isDark ? '#cbd5e1' : '#475569'}">
            Pit 1 (LA): Dedicated Rooftop Down Conductor only
          </text>
          <circle cx="20" cy="71" r="4" fill="#3b82f6" />
          <text x="32" y="74" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${isDark ? '#cbd5e1' : '#475569'}">
            Pit 2 (DC) &amp; Pit 3 (AC): Strictly Independent Dispersal
          </text>
        </g>
      </svg>
    `;
  }

  /* =========================================================================
     INTERACTION ENGINE (DRAGGING, WIRES SYNC, PAN, ZOOM, TOOLTIPS)
     ========================================================================= */
  function getSvgPoint(e, svgEl) {
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (ctm) {
      return pt.matrixTransform(ctm.inverse());
    }
    return { x: e.clientX, y: e.clientY };
  }

  function updateConnectedWires(svgEl, sysType, blockId) {
    const config = SYSTEM_CONFIGS[sysType];
    if (!config) return;

    const positions = sldState.positions[sysType] || {};

    // 1. Update wires
    config.wires.forEach(wire => {
      if (wire.from.blockId === blockId || wire.to.blockId === blockId) {
        const wireEl = svgEl.querySelector(`#wire-${wire.id}`);
        const lblEl = svgEl.querySelector(`#wire-lbl-${wire.id}`);

        const data = computeWireData(wire, config, positions);
        if (data) {
          if (wireEl) wireEl.setAttribute('d', data.pathD);
          if (lblEl) {
            lblEl.setAttribute('x', data.lblX);
            lblEl.setAttribute('y', data.lblY);
            if (wire.verticalLabel) {
              lblEl.setAttribute('transform', `rotate(-90 ${data.lblX} ${data.lblY})`);
            }
          }
        }
      }
    });

    // 2. Update Earth dimensions if earth pit moved
    if (config.earthDimensions) {
      config.earthDimensions.forEach((dim, idx) => {
        if (dim.fromId === blockId || dim.toId === blockId) {
          const dimEl = svgEl.querySelector(`#earth-dim-${idx}`);
          const dimLbl = svgEl.querySelector(`#earth-dim-lbl-${idx}`);

          const fromB = config.blocks[dim.fromId];
          const toB = config.blocks[dim.toId];
          if (fromB && toB) {
            const p1 = positions[dim.fromId] || { dx: 0, dy: 0 };
            const p2 = positions[dim.toId] || { dx: 0, dy: 0 };
            const x1 = fromB.x + p1.dx + 48;
            const x2 = toB.x + p2.dx - 48;
            const y = dim.y;
            const midX = (x1 + x2) / 2;

            if (dimEl) dimEl.setAttribute('d', `M ${x1} ${y} L ${x2} ${y}`);
            if (dimLbl) {
              dimLbl.setAttribute('x', midX);
              dimLbl.setAttribute('y', y - 8);
            }
          }
        }
      });
    }
  }

  function attachSvgEvents(container, scope = 'modal') {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const sysType = sldState.currentSystem;
    const config = SYSTEM_CONFIGS[sysType];
    if (!config) return;

    // A. Attach block dragging and clicking
    const draggableBlocks = svgEl.querySelectorAll('.sld-draggable-block');
    draggableBlocks.forEach(blockEl => {
      const compId = blockEl.getAttribute('data-comp-id');
      const spec = COMPONENT_DETAILS[compId];

      // Mouse Hover for Tooltip
      blockEl.addEventListener('mouseenter', e => {
        if (!sldState.activeDragBlock && spec) {
          showTooltip(e, spec);
        }
      });

      blockEl.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      // Mouse Down to Start Dragging Block
      blockEl.addEventListener('mousedown', e => {
        if (e.button !== 0) return; // Only left click
        e.stopPropagation(); // Do not pan canvas!
        hideTooltip();

        sldState.activeDragBlock = compId;
        sldState.dragStartSvg = getSvgPoint(e, svgEl);

        const currentPos = sldState.positions[sysType][compId] || { dx: 0, dy: 0 };
        sldState.blockStartPos = { ...currentPos };
        sldState.dragMoved = false;

        blockEl.classList.add('is-dragging');
      });
    });

    // B. Canvas Panning via Mouse Dragging on Background
    let isCanvasPanning = false;
    let panStart = { x: 0, y: 0 };
    let panOffset = scope === 'modal' ? { ...sldState.modalPan } : { ...sldState.inlinePan };

    svgEl.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (sldState.activeDragBlock) return; // Don't pan if dragging a block
      isCanvasPanning = true;
      panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      svgEl.style.cursor = 'grabbing';
    });

    // Global Window MouseMove for Both Block Dragging and Canvas Panning
    const onMouseMove = e => {
      // 1. Block Dragging Active
      if (sldState.activeDragBlock) {
        const curSvgPt = getSvgPoint(e, svgEl);
        const deltaX = curSvgPt.x - sldState.dragStartSvg.x;
        const deltaY = curSvgPt.y - sldState.dragStartSvg.y;

        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          sldState.dragMoved = true;
        }

        const newDx = sldState.blockStartPos.dx + deltaX;
        const newDy = sldState.blockStartPos.dy + deltaY;

        sldState.positions[sysType][sldState.activeDragBlock] = { dx: newDx, dy: newDy };

        const blockCfg = config.blocks[sldState.activeDragBlock];
        if (blockCfg) {
          const wrapperEl = svgEl.querySelector(`#block-wrapper-${sldState.activeDragBlock}`);
          if (wrapperEl) {
            wrapperEl.setAttribute('transform', `translate(${blockCfg.x + newDx}, ${blockCfg.y + newDy})`);
          }
        }

        updateConnectedWires(svgEl, sysType, sldState.activeDragBlock);
        return;
      }

      // 2. Canvas Panning Active
      if (isCanvasPanning) {
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        applyTransform(svgEl, scope, panOffset);
      }
    };

    const onMouseUp = () => {
      // End Block Dragging
      if (sldState.activeDragBlock) {
        const compId = sldState.activeDragBlock;
        const blockEl = svgEl.querySelector(`[data-comp-id="${compId}"]`);
        if (blockEl) blockEl.classList.remove('is-dragging');

        // If it was just a quick click (<4px movement), show inspector drawer
        if (!sldState.dragMoved) {
          const spec = COMPONENT_DETAILS[compId];
          if (spec) showDetailDrawer(spec);
        }

        sldState.activeDragBlock = null;
        sldState.dragMoved = false;
      }

      // End Canvas Panning
      if (isCanvasPanning) {
        isCanvasPanning = false;
        svgEl.style.cursor = 'grab';
        if (scope === 'modal') {
          sldState.modalPan = { ...panOffset };
        } else {
          sldState.inlinePan = { ...panOffset };
        }
      }
    };

    window.removeEventListener('mousemove', container._activeMouseMove);
    window.removeEventListener('mouseup', container._activeMouseUp);
    container._activeMouseMove = onMouseMove;
    container._activeMouseUp = onMouseUp;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Mouse Wheel Zoom
    svgEl.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      zoom(delta, scope);
    }, { passive: false });
  }

  function applyTransform(svgEl, scope, pan) {
    const zoomLevel = scope === 'modal' ? sldState.modalZoom : sldState.inlineZoom;
    svgEl.style.transformOrigin = 'center center';
    svgEl.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`;
    svgEl.style.transition = 'transform 0.05s ease-out';
  }

  function zoom(delta, scope = 'modal') {
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

  function resetZoom(scope = 'modal') {
    if (scope === 'modal') {
      sldState.modalZoom = 1;
      sldState.modalPan = { x: 0, y: 0 };
      const modalSvg = document.querySelector('#sldModalSvgWrapper svg');
      if (modalSvg) applyTransform(modalSvg, 'modal', { x: 0, y: 0 });
      const zoomText = document.getElementById('sldModalZoomText');
      if (zoomText) zoomText.textContent = '100%';
    } else {
      sldState.inlineZoom = 1;
      sldState.inlinePan = { x: 0, y: 0 };
      const inlineSvg = document.querySelector('#sldInlineSvgWrapper svg');
      if (inlineSvg) applyTransform(inlineSvg, 'inline', { x: 0, y: 0 });
    }
  }

  function resetLayout(scope = 'modal') {
    const sysType = sldState.currentSystem;
    sldState.positions[sysType] = {};
    render(sysType);
  }

  function toggleTheme() {
    sldState.theme = sldState.theme === 'dark' ? 'light' : 'dark';
    const isDark = sldState.theme === 'dark';

    const modalCanvas = document.getElementById('sldModalSvgWrapper');
    if (modalCanvas) {
      modalCanvas.classList.toggle('sld-theme-dark', isDark);
      modalCanvas.classList.toggle('sld-theme-light', !isDark);
    }

    const themeIcons = document.querySelectorAll('.sld-theme-icon');
    themeIcons.forEach(icon => {
      icon.textContent = isDark ? '🌙 Dark' : '☀️ Light';
    });

    render();
  }

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
      <div class="sld-tooltip-footer">Click component for detailed engineering sheet • Drag to move with wires</div>
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
              <span class="text-secondary fw-semibold">Earthing / Isolation:</span> <span class="text-success fw-bold">${spec.grounding}</span>
            </div>
          ` : ''}
          ${spec.connections ? `
            <div class="col-12">
              <span class="text-secondary fw-semibold">Wiring Topology:</span> <span class="text-dark">${spec.connections}</span>
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

  function updateActiveBadges(current) {
    const buttons = document.querySelectorAll('.sld-system-tab-btn');
    buttons.forEach(btn => {
      const type = btn.getAttribute('data-sys-type');
      if (type === current) {
        btn.classList.remove('btn-light', 'text-dark');
        btn.classList.add('btn-primary', 'text-white');
      } else {
        btn.classList.remove('btn-primary', 'text-white');
        btn.classList.add('btn-light', 'text-dark');
      }
    });
  }

  function render(systemType) {
    if (systemType) sldState.currentSystem = systemType;
    const current = sldState.currentSystem;
    const isDark = sldState.theme === 'dark';

    const svgContent = generateSvgContent(current, isDark);

    const modalContainer = document.getElementById('sldModalSvgWrapper');
    if (modalContainer) {
      modalContainer.innerHTML = svgContent;
      attachSvgEvents(modalContainer, 'modal');
      const modalSvg = modalContainer.querySelector('svg');
      if (modalSvg) applyTransform(modalSvg, 'modal', sldState.modalPan);
    }

    const inlineContainer = document.getElementById('sldInlineSvgWrapper');
    if (inlineContainer) {
      inlineContainer.innerHTML = svgContent;
      attachSvgEvents(inlineContainer, 'inline');
      const inlineSvg = inlineContainer.querySelector('svg');
      if (inlineSvg) applyTransform(inlineSvg, 'inline', sldState.inlinePan);
    }

    updateActiveBadges(current);
  }

  function openModal(systemType) {
    if (!systemType && window.SizingUI && typeof window.SizingUI.getCurrentSystemType === 'function') {
      systemType = window.SizingUI.getCurrentSystemType();
    }
    if (!systemType) {
      const activeDropdownItem = document.querySelector('.system-dropdown-item.active');
      if (activeDropdownItem && activeDropdownItem.dataset.systemType) {
        systemType = activeDropdownItem.dataset.systemType;
      }
    }
    if (systemType) {
      sldState.currentSystem = systemType;
    }
    render(sldState.currentSystem);
    resetZoom('modal');

    const modalEl = document.getElementById('sldSchematicModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  }

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

  function init() {
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
    resetLayout,
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

})();
