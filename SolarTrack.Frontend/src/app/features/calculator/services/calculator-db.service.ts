import { Injectable } from '@angular/core';
import { ApplianceItem, InverterProduct, BatteryProduct } from '../models/calculator.model';

@Injectable({
  providedIn: 'root'
})
export class CalculatorDbService {
  readonly COMMON_APPLIANCES: ApplianceItem[] = [
    { id: 'led', name: 'LED Light', watts: 10, defaultQty: 5, initialQty: 5, defaultHours: 14, icon: '💡', checked: true, isBackup: true },
    { id: 'fan', name: 'Fan', watts: 55, defaultQty: 3, initialQty: 3, defaultHours: 14, icon: '🌀', checked: true, isBackup: true },
    { id: 'tv', name: 'TV', watts: 65, defaultQty: 1, initialQty: 1, defaultHours: 14, icon: '📺', checked: true, isBackup: true },
    { id: 'fridge', name: 'Refrigerator', watts: 30, defaultQty: 1, initialQty: 1, defaultHours: 24, icon: '❄️', checked: true, isBackup: true },
    { id: 'comp', name: 'Computer / Laptop', watts: 28, defaultQty: 0, initialQty: 1, defaultHours: 6, icon: '💻', checked: false, isBackup: true },
    { id: 'wm', name: 'Washing Machine', watts: 240, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🧺', checked: false, isBackup: false },
    { id: 'geyser', name: 'Geyser', watts: 2000, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🚿', checked: false, isBackup: false },
    { id: 'iron', name: 'Iron', watts: 350, defaultQty: 0, initialQty: 1, defaultHours: 0.5, icon: '👔', checked: false, isBackup: false },
    { id: 'induction', name: 'Induction Cooker', watts: 1160, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🍳', checked: false, isBackup: false },
    { id: 'ac', name: 'Air Conditioner (AC)', watts: 850, defaultQty: 0, initialQty: 1, defaultHours: 8, isHeavy: true, icon: '❄️', checked: false, isBackup: false },
    { id: 'pump', name: 'Water Pump', watts: 1066, defaultQty: 0, initialQty: 1, defaultHours: 1, isHeavy: true, icon: '🚰', checked: false, isBackup: false },
    { id: 'other', name: 'Other Load', watts: 100, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🔌', checked: false, isBackup: true }
  ];

  readonly DEFAULT_PARAMS = {
    safetyMarginPct: 25,
    inverterEfficiencyPct: 90,
    lithiumDoDPct: 90,
    tubularDoDPct: 75,
    flatPlateDoDPct: 65,
    batteryChargingEffPct: 88,
    peakSunHours: 5.0,
    inverterLossPct: 4,
    dcAcCableLossPct: 2,
    tempLossPct: 7,
    soilingLossPct: 4,
    shadingOrientationLossPct: 3,
    pvSystemEfficiencyPct: 78,
    acInverterSurgeFactor: 1.5,
    acNonInverterSurgeFactor: 3.0,
    pumpSurgeFactor: 3.5,
    preferredBatteryType: 'lithium',
    selectedDiscom: 'odisha_oerc',
    energyCalculationBasis: 'backup_duration'
  };

  readonly TARIFF_SCHEDULES: Record<string, any> = {
    'odisha_oerc': {
      id: 'odisha_oerc',
      state: 'Odisha',
      name: 'Odisha OERC (TPCODL / TPNODL / TPSODL / TPWODL)',
      category: 'Residential Domestic (LT-Domestic)',
      slabs: [
        { name: '1 to 50 Units', min: 0, max: 50, rate: 2.90 },
        { name: '51 to 200 Units', min: 50, max: 200, rate: 4.70 },
        { name: '201 to 400 Units', min: 200, max: 400, rate: 5.70 },
        { name: 'Above 400 Units', min: 400, max: Infinity, rate: 6.10 }
      ],
      fixedChargePerKw: 20,
      meterRent: 10,
      electricityDutyPct: 4,
      singlePhaseMaxKw: 5.0,
      netMeteringAllowed: true
    },
    'national_standard': {
      id: 'national_standard',
      state: 'National Benchmark',
      name: 'National Standard Average Residential',
      category: 'Residential Domestic',
      slabs: [
        { name: '1 to 100 Units', min: 0, max: 100, rate: 4.50 },
        { name: '101 to 300 Units', min: 100, max: 300, rate: 6.20 },
        { name: '301 to 500 Units', min: 300, max: 500, rate: 7.50 },
        { name: 'Above 500 Units', min: 500, max: Infinity, rate: 8.50 }
      ],
      fixedChargePerKw: 50,
      meterRent: 15,
      electricityDutyPct: 5,
      singlePhaseMaxKw: 5.0,
      netMeteringAllowed: true
    },
    'commercial_standard': {
      id: 'commercial_standard',
      state: 'All India',
      name: 'Commercial & Non-Domestic General',
      category: 'Commercial (LT-General)',
      slabs: [
        { name: 'All Units (Flat Commercial Tariff)', min: 0, max: Infinity, rate: 8.50 }
      ],
      fixedChargePerKw: 150,
      meterRent: 25,
      electricityDutyPct: 6,
      singlePhaseMaxKw: 5.0,
      netMeteringAllowed: true
    }
  };

  readonly DEFAULT_INVERTERS: InverterProduct[] = [
    // Home UPS (Without Solar)
    { id: 'inv-1', brand: 'Microtek', model: 'UPS SEBz 1100', type: 'UPS', kVA: 0.9, kW: 0.72, phase: '1-Phase', batteryVoltage: 12, continuousOutput: 720, surgeOutput: 1440, active: true },
    { id: 'inv-2', brand: 'Luminous', model: 'Zelio+ 1700', type: 'UPS', kVA: 1.5, kW: 1.2, phase: '1-Phase', batteryVoltage: 24, continuousOutput: 1200, surgeOutput: 2400, active: true },
    { id: 'inv-2b', brand: 'Luminous', model: 'Cruze 2.5kVA / 36V', type: 'UPS', kVA: 2.5, kW: 2.0, phase: '1-Phase', batteryVoltage: 36, continuousOutput: 2000, surgeOutput: 4000, active: true },
    { id: 'inv-3', brand: 'Microtek', model: 'Super Power 3.5kVA', type: 'UPS', kVA: 3.5, kW: 2.8, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 2800, surgeOutput: 5600, active: true },
    { id: 'inv-3b', brand: 'Luminous', model: 'Cruze+ 5kVA / 48V', type: 'UPS', kVA: 5.0, kW: 4.0, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 4000, surgeOutput: 8000, active: true },
    { id: 'inv-3c', brand: 'Microtek', model: 'Heavy Duty 7.5kVA / 96V', type: 'UPS', kVA: 7.5, kW: 6.0, phase: '1-Phase', batteryVoltage: 96, continuousOutput: 6000, surgeOutput: 12000, active: true },
    { id: 'inv-3d', brand: 'Microtek', model: 'Max 10kVA / 120V', type: 'UPS', kVA: 10.0, kW: 8.0, phase: '3-Phase', batteryVoltage: 120, continuousOutput: 8000, surgeOutput: 16000, active: true },

    // Solar PCU (Off-Grid)
    { id: 'inv-4', brand: 'Microtek', model: 'Solar PCU 1235 (1kVA 12V)', type: 'PCU', kVA: 1.0, kW: 0.8, phase: '1-Phase', batteryVoltage: 12, continuousOutput: 800, surgeOutput: 1600, maxPvInput: 1000, active: true },
    { id: 'inv-5', brand: 'Luminous', model: 'Solarverter PRO 2kVA 24V', type: 'PCU', kVA: 2.0, kW: 1.6, phase: '1-Phase', batteryVoltage: 24, continuousOutput: 1600, surgeOutput: 3200, maxPvInput: 2000, active: true },
    { id: 'inv-6', brand: 'Livguard', model: 'Solar PCU 3.5kVA 48V MPPT', type: 'PCU', kVA: 3.5, kW: 3.0, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 3000, surgeOutput: 6000, maxPvInput: 3600, active: true },
    { id: 'inv-7', brand: 'Microtek', model: 'Solar PCU 5kVA 48V MPPT', type: 'PCU', kVA: 5.0, kW: 4.5, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 4500, surgeOutput: 9000, maxPvInput: 5000, active: true },
    { id: 'inv-7b', brand: 'Statcon Energiaa', model: 'SE-PCU 7.5kVA 96V', type: 'PCU', kVA: 7.5, kW: 6.0, phase: '1-Phase', batteryVoltage: 96, continuousOutput: 6000, surgeOutput: 12000, maxPvInput: 7500, active: true },
    { id: 'inv-8', brand: 'Statcon Energiaa', model: 'SE-PCU 10kVA 120V 3-Phase', type: 'PCU', kVA: 10.0, kW: 8.5, phase: '3-Phase', batteryVoltage: 120, continuousOutput: 8500, surgeOutput: 17000, maxPvInput: 10000, active: true },
    { id: 'inv-8b', brand: 'Statcon Energiaa', model: 'SE-PCU 15kVA 240V 3-Phase', type: 'PCU', kVA: 15.0, kW: 12.5, phase: '3-Phase', batteryVoltage: 240, continuousOutput: 12500, surgeOutput: 25000, maxPvInput: 15000, active: true },

    // On-Grid GTI
    { id: 'inv-9', brand: 'Solis', model: 'S6-GR1P1K 1kW GTI', type: 'GTI', kVA: 1.0, kW: 1.0, phase: '1-Phase', batteryVoltage: 0, continuousOutput: 1000, surgeOutput: 1000, maxPvInput: 1500, mpptVoltageRange: '50V - 500V', active: true },
    { id: 'inv-10', brand: 'Growatt', model: 'MIC 2000TL-X 2kW', type: 'GTI', kVA: 2.0, kW: 2.0, phase: '1-Phase', batteryVoltage: 0, continuousOutput: 2000, surgeOutput: 2000, maxPvInput: 2800, mpptVoltageRange: '50V - 550V', active: true },
    { id: 'inv-11', brand: 'Growatt', model: 'MIC 3000TL-X 3kW', type: 'GTI', kVA: 3.0, kW: 3.0, phase: '1-Phase', batteryVoltage: 0, continuousOutput: 3000, surgeOutput: 3000, maxPvInput: 4200, mpptVoltageRange: '65V - 550V', active: true },
    { id: 'inv-11b', brand: 'Growatt', model: 'MIC 4000TL-X 4kW', type: 'GTI', kVA: 4.0, kW: 4.0, phase: '1-Phase', batteryVoltage: 0, continuousOutput: 4000, surgeOutput: 4000, maxPvInput: 5600, mpptVoltageRange: '65V - 550V', active: true },
    { id: 'inv-12', brand: 'Growatt', model: 'MIN 5000TL-X 5kW', type: 'GTI', kVA: 5.0, kW: 5.0, phase: '1-Phase', batteryVoltage: 0, continuousOutput: 5000, surgeOutput: 5000, maxPvInput: 7000, mpptVoltageRange: '80V - 550V', active: true },
    { id: 'inv-12b', brand: 'Solis', model: 'S5-GR3P6K 6kW 3-Phase', type: 'GTI', kVA: 6.0, kW: 6.0, phase: '3-Phase', batteryVoltage: 0, continuousOutput: 6000, surgeOutput: 6000, maxPvInput: 9000, mpptVoltageRange: '160V - 1000V', active: true },
    { id: 'inv-12c', brand: 'Growatt', model: 'MOD 8000TL3-X 8kW 3-Phase', type: 'GTI', kVA: 8.0, kW: 8.0, phase: '3-Phase', batteryVoltage: 0, continuousOutput: 8000, surgeOutput: 8000, maxPvInput: 12000, mpptVoltageRange: '160V - 1000V', active: true },
    { id: 'inv-13', brand: 'Solis', model: 'S5-GR3P10K 10kW 3-Phase', type: 'GTI', kVA: 10.0, kW: 10.0, phase: '3-Phase', batteryVoltage: 0, continuousOutput: 10000, surgeOutput: 10000, maxPvInput: 15000, mpptVoltageRange: '160V - 1000V', active: true },
    { id: 'inv-14', brand: 'Solis', model: 'S5-GR3P15K 15kW 3-Phase', type: 'GTI', kVA: 15.0, kW: 15.0, phase: '3-Phase', batteryVoltage: 0, continuousOutput: 15000, surgeOutput: 15000, maxPvInput: 22500, mpptVoltageRange: '160V - 1000V', active: true },
    { id: 'inv-15', brand: 'Growatt', model: 'MID 20KTL3-X 20kW 3-Phase', type: 'GTI', kVA: 20.0, kW: 20.0, phase: '3-Phase', batteryVoltage: 0, continuousOutput: 20000, surgeOutput: 20000, maxPvInput: 30000, mpptVoltageRange: '200V - 1000V', active: true },

    // Hybrid Inverter
    { id: 'inv-16', brand: 'Growatt', model: 'SPH 3000 Hybrid 1-Phase', type: 'Hybrid', kVA: 3.0, kW: 3.0, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 3000, surgeOutput: 6000, maxPvInput: 6600, mpptVoltageRange: '120V - 550V', active: true },
    { id: 'inv-17', brand: 'Deye', model: 'SUN-5K-SG03LP1 5kW Hybrid', type: 'Hybrid', kVA: 5.0, kW: 5.0, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 5000, surgeOutput: 10000, maxPvInput: 6500, mpptVoltageRange: '100V - 500V', active: true },
    { id: 'inv-17b', brand: 'Deye', model: 'SUN-8K-SG01LP1 8kW Hybrid', type: 'Hybrid', kVA: 8.0, kW: 8.0, phase: '1-Phase', batteryVoltage: 48, continuousOutput: 8000, surgeOutput: 16000, maxPvInput: 10400, mpptVoltageRange: '125V - 500V', active: true },
    { id: 'inv-18', brand: 'Deye', model: 'SUN-10K-SG04LP3 10kW 3-Phase', type: 'Hybrid', kVA: 10.0, kW: 10.0, phase: '3-Phase', batteryVoltage: 48, continuousOutput: 10000, surgeOutput: 20000, maxPvInput: 13000, mpptVoltageRange: '160V - 800V', active: true },
    { id: 'inv-19', brand: 'Deye', model: 'SUN-15K-SG01HP3 15kW High Voltage', type: 'Hybrid', kVA: 15.0, kW: 15.0, phase: '3-Phase', batteryVoltage: 300, continuousOutput: 15000, surgeOutput: 30000, maxPvInput: 20000, mpptVoltageRange: '160V - 850V', active: true }
  ];

  readonly DEFAULT_BATTERIES: BatteryProduct[] = [
    // Tall Tubular
    { id: 'bat-1', brand: 'Exide', model: '6LMS150Ah Solar Tubular', type: 'Tall Tubular', chemistry: 'Tubular', voltage: 12, ah: 150, kWh: 1.8, active: true },
    { id: 'bat-2', brand: 'Luminous', model: 'LPT12200H 200Ah Solar Tubular', type: 'Tall Tubular', chemistry: 'Tubular', voltage: 12, ah: 200, kWh: 2.4, active: true },
    { id: 'bat-3', brand: 'Livguard', model: 'IT2260TT 220Ah Solar Tubular', type: 'Tall Tubular', chemistry: 'Tubular', voltage: 12, ah: 220, kWh: 2.64, active: true },
    
    // Flat Plate
    { id: 'bat-fp-1', brand: 'Exide', model: 'InstaBrite IB1000 100Ah Flat Plate', type: 'Flat Plate', chemistry: 'Flat Plate', voltage: 12, ah: 100, kWh: 1.2, active: true },
    { id: 'bat-fp-2', brand: 'Luminous', model: 'EcoCharge 150Ah Flat Plate', type: 'Flat Plate', chemistry: 'Flat Plate', voltage: 12, ah: 150, kWh: 1.8, active: true },

    // Lithium LiFePO4
    { id: 'bat-li-1', brand: 'Livguard / Tata', model: 'LFP-12100 12.8V 100Ah Pack', type: 'Lithium LFP', chemistry: 'LiFePO4', voltage: 12.8, ah: 100, kWh: 1.28, active: true },
    { id: 'bat-li-2', brand: 'Livguard / Tata', model: 'LFP-24100 25.6V 100Ah Pack', type: 'Lithium LFP', chemistry: 'LiFePO4', voltage: 25.6, ah: 100, kWh: 2.56, active: true },
    { id: 'bat-li-3', brand: 'Growatt / Pylontech', model: 'LFP-48100 51.2V 100Ah Wall-Mount (5.12kWh)', type: 'Lithium LFP', chemistry: 'LiFePO4', voltage: 51.2, ah: 100, kWh: 5.12, active: true },
    { id: 'bat-li-4', brand: 'Deye / Pylontech', model: 'LFP-48200 51.2V 200Ah Rack (10.24kWh)', type: 'Lithium LFP', chemistry: 'LiFePO4', voltage: 51.2, ah: 200, kWh: 10.24, active: true }
  ];

  getParams() {
    return { ...this.DEFAULT_PARAMS };
  }

  getTariffSchedule(discomId = 'odisha_oerc') {
    return this.TARIFF_SCHEDULES[discomId] || this.TARIFF_SCHEDULES['odisha_oerc'];
  }

  getInverters(): InverterProduct[] {
    return [...this.DEFAULT_INVERTERS];
  }

  getBatteries(): BatteryProduct[] {
    return [...this.DEFAULT_BATTERIES];
  }
}
