/* =========================================================================
   sizing-db.js — Inverter & Battery Master Database & Calculation Parameters
   Stores active product catalogues (GTI, PCU, Hybrid, UPS & Lead-Acid/Lithium batteries)
   and configurable sizing parameters.
   ========================================================================= */

const SizingDB = (() => {

  const DEFAULT_PARAMS = {
    safetyMarginPct: 25,         // 20-30% default safety margin
    inverterEfficiencyPct: 90,   // 90% default efficiency
    lithiumDoDPct: 90,           // 90% DoD for Lithium LFP
    leadAcidDoDPct: 50,          // 50% DoD for Lead-Acid
    peakSunHours: 5.0,           // 5.0 kWh/m2/day
    pvSystemEfficiencyPct: 78,   // 78% overall PV system yield efficiency
    acNonInverterSurgeFactor: 3.0,
    acInverterSurgeFactor: 1.5,
    pumpSurgeFactor: 3.5,
    preferredBatteryType: 'lithium' // 'lithium' or 'lead-acid'
  };

  const DEFAULT_INVERTERS = [
    {
      id: 'inv-1',
      brand: 'Microtek',
      model: 'UPS SEBz 1100',
      type: 'UPS',
      kVA: 0.9,
      kW: 0.72,
      phase: '1-Phase',
      batteryVoltage: 12,
      continuousOutput: 720,
      surgeOutput: 1440,
      surgeDuration: 5,
      maxPvInput: 0,
      mpptVoltageRange: 'N/A',
      maxPvCurrent: 0,
      maxChargingCurrent: 15,
      maxBatteryDischargeCurrent: 75,
      ipRating: 'Not specified by manufacturer',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-2',
      brand: 'Luminous',
      model: 'Zelio+ 1700',
      type: 'UPS',
      kVA: 1.5,
      kW: 1.2,
      phase: '1-Phase',
      batteryVoltage: 24,
      continuousOutput: 1200,
      surgeOutput: 2400,
      surgeDuration: 5,
      maxPvInput: 0,
      mpptVoltageRange: 'N/A',
      maxPvCurrent: 0,
      maxChargingCurrent: 15,
      maxBatteryDischargeCurrent: 60,
      ipRating: 'Not specified by manufacturer',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-3',
      brand: 'Microtek',
      model: 'Super Power 3.5kVA',
      type: 'UPS',
      kVA: 3.5,
      kW: 2.8,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 2800,
      surgeOutput: 5600,
      surgeDuration: 5,
      maxPvInput: 0,
      mpptVoltageRange: 'N/A',
      maxPvCurrent: 0,
      maxChargingCurrent: 20,
      maxBatteryDischargeCurrent: 70,
      ipRating: 'Not specified by manufacturer',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-4',
      brand: 'Luminous Solar',
      model: 'Solar PCU 2kVA / 24V',
      type: 'PCU',
      kVA: 2.0,
      kW: 1.6,
      phase: '1-Phase',
      batteryVoltage: 24,
      continuousOutput: 1600,
      surgeOutput: 3200,
      surgeDuration: 10,
      maxPvInput: 2000,
      mpptVoltageRange: '30V - 90V',
      maxPvCurrent: 50,
      maxChargingCurrent: 30,
      maxBatteryDischargeCurrent: 80,
      ipRating: 'IP21',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-5',
      brand: 'Havells Solar',
      model: 'Solar PCU 3.75kVA / 48V',
      type: 'PCU',
      kVA: 3.75,
      kW: 3.0,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 3000,
      surgeOutput: 6000,
      surgeDuration: 10,
      maxPvInput: 3500,
      mpptVoltageRange: '60V - 140V',
      maxPvCurrent: 60,
      maxChargingCurrent: 40,
      maxBatteryDischargeCurrent: 75,
      ipRating: 'IP21',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-6',
      brand: 'Luminous Solar',
      model: 'PCU NXT 5kVA / 48V',
      type: 'PCU',
      kVA: 5.0,
      kW: 4.0,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 4000,
      surgeOutput: 8000,
      surgeDuration: 10,
      maxPvInput: 5000,
      mpptVoltageRange: '80V - 160V',
      maxPvCurrent: 80,
      maxChargingCurrent: 50,
      maxBatteryDischargeCurrent: 100,
      ipRating: 'IP21',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-7',
      brand: 'Eastman Solar',
      model: 'Solar PCU 7.5kVA / 96V',
      type: 'PCU',
      kVA: 7.5,
      kW: 6.0,
      phase: '1-Phase',
      batteryVoltage: 96,
      continuousOutput: 6000,
      surgeOutput: 12000,
      surgeDuration: 10,
      maxPvInput: 7500,
      mpptVoltageRange: '120V - 240V',
      maxPvCurrent: 80,
      maxChargingCurrent: 60,
      maxBatteryDischargeCurrent: 75,
      ipRating: 'IP21',
      warranty: 2,
      active: true
    },
    {
      id: 'inv-8',
      brand: 'Growatt',
      model: 'SPH 3000 Hybrid 1-Phase',
      type: 'Hybrid',
      kVA: 3.0,
      kW: 3.0,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 3000,
      surgeOutput: 6000,
      surgeDuration: 10,
      maxPvInput: 4500,
      mpptVoltageRange: '120V - 550V',
      maxPvCurrent: 13.5,
      maxChargingCurrent: 66,
      maxBatteryDischargeCurrent: 66,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-9',
      brand: 'Growatt',
      model: 'SPH 5000 Hybrid 1-Phase',
      type: 'Hybrid',
      kVA: 5.0,
      kW: 5.0,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 5000,
      surgeOutput: 10000,
      surgeDuration: 10,
      maxPvInput: 7500,
      mpptVoltageRange: '120V - 550V',
      maxPvCurrent: 13.5,
      maxChargingCurrent: 100,
      maxBatteryDischargeCurrent: 100,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-10',
      brand: 'Deye',
      model: 'SUN-8K-SG04LP1 8kW Hybrid',
      type: 'Hybrid',
      kVA: 8.0,
      kW: 8.0,
      phase: '1-Phase',
      batteryVoltage: 48,
      continuousOutput: 8000,
      surgeOutput: 16000,
      surgeDuration: 10,
      maxPvInput: 10400,
      mpptVoltageRange: '160V - 500V',
      maxPvCurrent: 26,
      maxChargingCurrent: 190,
      maxBatteryDischargeCurrent: 190,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-11',
      brand: 'Deye',
      model: 'SUN-12K-SG04LP3 12kW Hybrid 3-Phase',
      type: 'Hybrid',
      kVA: 12.0,
      kW: 12.0,
      phase: '3-Phase',
      batteryVoltage: 48,
      continuousOutput: 12000,
      surgeOutput: 24000,
      surgeDuration: 10,
      maxPvInput: 15600,
      mpptVoltageRange: '160V - 800V',
      maxPvCurrent: 26,
      maxChargingCurrent: 240,
      maxBatteryDischargeCurrent: 240,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-12',
      brand: 'Solis',
      model: 'S6-GR1P3K 3kW GTI',
      type: 'GTI',
      kVA: 3.0,
      kW: 3.0,
      phase: '1-Phase',
      batteryVoltage: 0,
      continuousOutput: 3000,
      surgeOutput: 3300,
      surgeDuration: 5,
      maxPvInput: 4500,
      mpptVoltageRange: '90V - 520V',
      maxPvCurrent: 14,
      maxChargingCurrent: 0,
      maxBatteryDischargeCurrent: 0,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-13',
      brand: 'Growatt',
      model: 'MIC 5000TL-X 5kW GTI',
      type: 'GTI',
      kVA: 5.0,
      kW: 5.0,
      phase: '1-Phase',
      batteryVoltage: 0,
      continuousOutput: 5000,
      surgeOutput: 5500,
      surgeDuration: 5,
      maxPvInput: 7500,
      mpptVoltageRange: '80V - 550V',
      maxPvCurrent: 13,
      maxChargingCurrent: 0,
      maxBatteryDischargeCurrent: 0,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-14',
      brand: 'Solis',
      model: 'S5-GC10K 10kW 3-Phase GTI',
      type: 'GTI',
      kVA: 10.0,
      kW: 10.0,
      phase: '3-Phase',
      batteryVoltage: 0,
      continuousOutput: 10000,
      surgeOutput: 11000,
      surgeDuration: 5,
      maxPvInput: 15000,
      mpptVoltageRange: '160V - 850V',
      maxPvCurrent: 32,
      maxChargingCurrent: 0,
      maxBatteryDischargeCurrent: 0,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    },
    {
      id: 'inv-15',
      brand: 'Havells Enviro',
      model: '15kW 3-Phase GTI',
      type: 'GTI',
      kVA: 15.0,
      kW: 15.0,
      phase: '3-Phase',
      batteryVoltage: 0,
      continuousOutput: 15000,
      surgeOutput: 16500,
      surgeDuration: 5,
      maxPvInput: 22500,
      mpptVoltageRange: '200V - 950V',
      maxPvCurrent: 40,
      maxChargingCurrent: 0,
      maxBatteryDischargeCurrent: 0,
      ipRating: 'IP65',
      warranty: 5,
      active: true
    }
  ];

  const DEFAULT_BATTERIES = [
    {
      id: 'bat-1',
      brand: 'Exide',
      model: '6LMS150Ah Solar Tubular',
      type: 'Tubular',
      chemistry: 'Lead Acid',
      voltage: 12,
      ah: 150,
      kWh: 1.8,
      capacityRating: 'C10',
      maxContinuousDischarge: 45,
      peakDischarge: 90,
      dod: 0.50,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-2',
      brand: 'Luminous',
      model: 'LPTT12200H Solar Tubular',
      type: 'Tubular',
      chemistry: 'Lead Acid',
      voltage: 12,
      ah: 200,
      kWh: 2.4,
      capacityRating: 'C10',
      maxContinuousDischarge: 60,
      peakDischarge: 120,
      dod: 0.50,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-3',
      brand: 'Eastman',
      model: 'EM220Ah Solar Tubular',
      type: 'Tubular',
      chemistry: 'Lead Acid',
      voltage: 12,
      ah: 220,
      kWh: 2.64,
      capacityRating: 'C10',
      maxContinuousDischarge: 65,
      peakDischarge: 130,
      dod: 0.50,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-4',
      brand: 'Amaron',
      model: 'AR150TT Tall Tubular',
      type: 'Tubular',
      chemistry: 'Lead Acid',
      voltage: 12,
      ah: 150,
      kWh: 1.8,
      capacityRating: 'C20',
      maxContinuousDischarge: 40,
      peakDischarge: 80,
      dod: 0.50,
      warranty: 3,
      active: true
    },
    {
      id: 'bat-5',
      brand: 'Okaya',
      model: 'OPJT20036 Tall Tubular',
      type: 'Tubular',
      chemistry: 'Lead Acid',
      voltage: 12,
      ah: 200,
      kWh: 2.4,
      capacityRating: 'C10',
      maxContinuousDischarge: 60,
      peakDischarge: 120,
      dod: 0.50,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-6',
      brand: 'Tata Power',
      model: 'TPL-48100 48V 100Ah Lithium',
      type: 'Lithium LFP',
      chemistry: 'LiFePO4',
      voltage: 48,
      ah: 100,
      kWh: 4.8,
      capacityRating: 'Manufacturer Specified',
      maxContinuousDischarge: 100,
      peakDischarge: 150,
      dod: 0.90,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-7',
      brand: 'Growatt',
      model: 'HOPE 4.8L-C1 48V 100Ah Lithium',
      type: 'Lithium LFP',
      chemistry: 'LiFePO4',
      voltage: 48,
      ah: 100,
      kWh: 4.8,
      capacityRating: 'Manufacturer Specified',
      maxContinuousDischarge: 100,
      peakDischarge: 150,
      dod: 0.90,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-8',
      brand: 'Felicity Solar',
      model: 'LPBF48200 48V 200Ah Lithium',
      type: 'Lithium LFP',
      chemistry: 'LiFePO4',
      voltage: 48,
      ah: 200,
      kWh: 9.6,
      capacityRating: 'Manufacturer Specified',
      maxContinuousDischarge: 120,
      peakDischarge: 200,
      dod: 0.90,
      warranty: 5,
      active: true
    },
    {
      id: 'bat-9',
      brand: 'Deye',
      model: 'RW-M6.1 51.2V 120Ah Lithium Pack',
      type: 'Lithium LFP',
      chemistry: 'LiFePO4',
      voltage: 51.2,
      ah: 120,
      kWh: 6.14,
      capacityRating: 'Manufacturer Specified',
      maxContinuousDischarge: 100,
      peakDischarge: 150,
      dod: 0.90,
      warranty: 10,
      active: true
    },
    {
      id: 'bat-10',
      brand: 'Luminous',
      model: 'LFP-48300 48V 300Ah Lithium Bank',
      type: 'Lithium LFP',
      chemistry: 'LiFePO4',
      voltage: 48,
      ah: 300,
      kWh: 14.4,
      capacityRating: 'Manufacturer Specified',
      maxContinuousDischarge: 150,
      peakDischarge: 250,
      dod: 0.90,
      warranty: 5,
      active: true
    }
  ];

  function getParams() {
    try {
      const stored = localStorage.getItem('sizing_params');
      if (stored) return { ...DEFAULT_PARAMS, ...JSON.parse(stored) };
    } catch (e) { }
    return { ...DEFAULT_PARAMS };
  }

  function saveParams(params) {
    localStorage.setItem('sizing_params', JSON.stringify(params));
  }

  function getInverters() {
    try {
      const stored = localStorage.getItem('sizing_inverters');
      if (stored) return JSON.parse(stored);
    } catch (e) { }
    return [...DEFAULT_INVERTERS];
  }

  function saveInverters(list) {
    localStorage.setItem('sizing_inverters', JSON.stringify(list));
  }

  function getBatteries() {
    try {
      const stored = localStorage.getItem('sizing_batteries');
      if (stored) return JSON.parse(stored);
    } catch (e) { }
    return [...DEFAULT_BATTERIES];
  }

  function saveBatteries(list) {
    localStorage.setItem('sizing_batteries', JSON.stringify(list));
  }

  function resetToDefaults() {
    localStorage.removeItem('sizing_params');
    localStorage.removeItem('sizing_inverters');
    localStorage.removeItem('sizing_batteries');
  }

  return {
    DEFAULT_PARAMS,
    DEFAULT_INVERTERS,
    DEFAULT_BATTERIES,
    getParams,
    saveParams,
    getInverters,
    saveInverters,
    getBatteries,
    saveBatteries,
    resetToDefaults
  };

})();
