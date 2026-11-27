import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavService } from '../../core/services/nav.service';
import { StandardLoadCalc, CalcParams } from '../calculator/services/standard-load-calc.helper';

export interface ApplianceItem {
  id: string;
  slot: 'day' | 'night';
  name: string;
  category: string;
  specLabel?: string;
  qty: number;
  watt: number;
  surgeMult: number;
  simultaneous: boolean;
  hours: number;
  is3Phase?: boolean;
  calcParams?: CalcParams;
}

export interface PresetItem {
  key: string;
  category: string;
  name: string;
  shortLabel: string;
  specLabel: string;
  icon: string;
  qty: number;
  watt: number;
  surgeMult: number;
  simultaneous: boolean;
  defaultDayHrs: number;
  defaultNightHrs: number;
  is3Phase?: boolean;
  params: CalcParams;
}

export interface ModalAdjustState {
  isOpen: boolean;
  isEditingRow: boolean;
  editingItemId: string | null;
  editingPresetKey: string | null;
  slot: 'day' | 'night';
  category: string;
  name: string;
  specLabel: string;
  qty: number;
  watt: number;
  surgeMult: number;
  peakSurgeW: number;
  totalRunningW: number;
  totalSurgeW: number;
  simultaneous: boolean;
  is3Phase: boolean;
  params: CalcParams;
}

declare const html2pdf: any;

@Component({
  selector: 'app-sizing-calculation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sizing-calculation.component.html',
  styleUrls: ['./sizing-calculation.component.scss']
})
export class SizingCalculationComponent implements OnInit {
  private navService = inject(NavService);
  private sanitizer = inject(DomSanitizer);
  readonly Math = Math;
  readonly Date = Date;

  // AI Solar Advisor Signals
  readonly isAiLoading = signal<boolean>(false);
  readonly aiResponse = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);
  readonly aiCopied = signal<boolean>(false);
  readonly isAiExpanded = signal<boolean>(true);

  // System Architecture
  readonly architecture = signal<'offgrid' | 'hybrid' | 'ongrid' | 'nobattery'>('offgrid');
  readonly zeroGrid = signal<boolean>(true);
  readonly chargingWindow = signal<number>(6.0);
  readonly psh = signal<number>(4.75);
  readonly monthlyBill = signal<number>(6000);
  readonly monthlyUnits = signal<number>(1000);
  readonly panelWattage = signal<number>(550); // Always fixed to 550Wp
  readonly expansionMargin = signal<number>(15);
  readonly backupHours = signal<number>(4.0);

  // Brand and Site defaults (Client Name / Location kept in state for proposal branding)
  readonly clientName = signal<string>('M/s Maa Sarada Enterprises');
  readonly siteLocation = signal<string>('Cuttack, Odisha');

  // Proposal Modals
  readonly showOdiaModal = signal<boolean>(false);
  readonly showEngModal = signal<boolean>(false);
  readonly isGeneratingPdf = signal<boolean>(false);
  readonly mobileSlotTab = signal<'day' | 'night'>('day');
  readonly mobileBatteryOption = signal<'opt1' | 'opt2' | 'opt3'>('opt1');

  // Appliance List Signal
  readonly appliances = signal<ApplianceItem[]>([]);

  // Quick-Add Presets Signal (values update when edited in popup)
  readonly presets = signal<Record<string, PresetItem>>({
    led: {
      key: 'led',
      category: 'led',
      name: 'LED Bulb (10W)',
      shortLabel: 'LED 10W',
      specLabel: '10W Warm/Cool White LED',
      icon: '💡',
      qty: 10,
      watt: 10,
      surgeMult: 1.0,
      simultaneous: true,
      defaultDayHrs: 3,
      defaultNightHrs: 6,
      is3Phase: false,
      params: { bulbWatts: 10 }
    },
    fan_normal: {
      key: 'fan_normal',
      category: 'fan',
      name: 'Normal Ceiling Fan (75W)',
      shortLabel: 'Normal Fan 75W',
      specLabel: 'Induction Motor Fan (75W)',
      icon: '🌀',
      qty: 4,
      watt: 75,
      surgeMult: 1.2,
      simultaneous: true,
      defaultDayHrs: 5,
      defaultNightHrs: 8,
      is3Phase: false,
      params: { fanType: 'induction', speed: 'medium' }
    },
    fan_bldc: {
      key: 'fan_bldc',
      category: 'fan',
      name: 'BLDC Ceiling Fan (30W)',
      shortLabel: 'BLDC Fan 30W',
      specLabel: 'BLDC Energy Saver Fan (30W)',
      icon: '⚡',
      qty: 4,
      watt: 30,
      surgeMult: 1.0,
      simultaneous: true,
      defaultDayHrs: 5,
      defaultNightHrs: 8,
      is3Phase: false,
      params: { fanType: 'bldc', speed: 'medium' }
    },
    desktop: {
      key: 'desktop',
      category: 'comp',
      name: 'Desktop Computer (200W)',
      shortLabel: 'Desktop 200W',
      specLabel: 'Desktop Workstation + Monitor',
      icon: '🖥️',
      qty: 1,
      watt: 200,
      surgeMult: 1.2,
      simultaneous: true,
      defaultDayHrs: 6,
      defaultNightHrs: 1,
      is3Phase: false,
      params: { deviceType: 'desktop', gpuType: 'integrated', monitorCount: 1, intensity: 'moderate' }
    },
    laptop: {
      key: 'laptop',
      category: 'comp',
      name: 'Laptop (65W)',
      shortLabel: 'Laptop 65W',
      specLabel: 'Business Laptop (65W)',
      icon: '💻',
      qty: 2,
      watt: 65,
      surgeMult: 1.0,
      simultaneous: true,
      defaultDayHrs: 6,
      defaultNightHrs: 2,
      is3Phase: false,
      params: { deviceType: 'laptop', gpuType: 'integrated', intensity: 'light' }
    },
    tv: {
      key: 'tv',
      category: 'tv',
      name: 'TV / Wi-Fi (80W)',
      shortLabel: 'TV/Wi-Fi 80W',
      specLabel: '43" 4K Smart TV',
      icon: '📺',
      qty: 1,
      watt: 80,
      surgeMult: 1.0,
      simultaneous: true,
      defaultDayHrs: 4,
      defaultNightHrs: 5,
      is3Phase: false,
      params: { screenSize: '43', displayType: 'led', resolution: '4k', brightness: 'standard' }
    },
    fridge: {
      key: 'fridge',
      category: 'fridge',
      name: 'Refrigerator (150W, 450W surge)',
      shortLabel: 'Fridge 150W',
      specLabel: '240L 3-Star Double Door Refrigerator',
      icon: '🧊',
      qty: 1,
      watt: 150,
      surgeMult: 3.0,
      simultaneous: true,
      defaultDayHrs: 7,
      defaultNightHrs: 15,
      is3Phase: false,
      params: { capacityL: 240, doorType: 'double', starRating: 3, compressorType: 'nonInverter' }
    },
    pump_1hp: {
      key: 'pump_1hp',
      category: 'pump',
      name: '1 HP Water Pump (850W)',
      shortLabel: '1 HP Pump',
      specLabel: '1.0 HP Single-Phase Monoblock Pump',
      icon: '💧',
      qty: 1,
      watt: 850,
      surgeMult: 2.59,
      simultaneous: true,
      defaultDayHrs: 1.5,
      defaultNightHrs: 0,
      is3Phase: false,
      params: { motorHp: '1', pumpType: 'monoblock' }
    },
    pump_2hp: {
      key: 'pump_2hp',
      category: 'pump',
      name: '2 HP Pump (1600W)',
      shortLabel: '2 HP Pump',
      specLabel: '2.0 HP Single-Phase Submersible Pump',
      icon: '🌊',
      qty: 1,
      watt: 1600,
      surgeMult: 2.625,
      simultaneous: false,
      defaultDayHrs: 2,
      defaultNightHrs: 0,
      is3Phase: false,
      params: { motorHp: '2', pumpType: 'submersible' }
    },
    pump_3hp_3p: {
      key: 'pump_3hp_3p',
      category: 'pump',
      name: '3 HP 3-Phase Pump (2400W)',
      shortLabel: '3 HP 3P Pump',
      specLabel: '3.0 HP Three-Phase 415V Agricultural Pump',
      icon: '⚡',
      qty: 1,
      watt: 2400,
      surgeMult: 2.5,
      simultaneous: false,
      defaultDayHrs: 3,
      defaultNightHrs: 0,
      is3Phase: true,
      params: { motorHp: '3', pumpType: '3phase' }
    },
    pump_5hp_3p: {
      key: 'pump_5hp_3p',
      category: 'pump',
      name: '5 HP 3-Phase Pump (3800W)',
      shortLabel: '5 HP 3P Pump',
      specLabel: '5.0 HP Three-Phase 415V Industrial Motor',
      icon: '⚙️',
      qty: 1,
      watt: 3800,
      surgeMult: 2.5,
      simultaneous: false,
      defaultDayHrs: 4,
      defaultNightHrs: 0,
      is3Phase: true,
      params: { motorHp: '5', pumpType: '3phase' }
    },
    ac_1_5t: {
      key: 'ac_1_5t',
      category: 'ac',
      name: '1.5 Ton Inverter AC (1500W)',
      shortLabel: '1.5T Inverter AC',
      specLabel: '1.5 Ton 3-Star Inverter AC',
      icon: '❄️',
      qty: 1,
      watt: 1500,
      surgeMult: 1.6,
      simultaneous: true,
      defaultDayHrs: 3,
      defaultNightHrs: 5,
      is3Phase: false,
      params: { ton: '1.5', technology: 'inverter', starRating: '3' }
    },
    ac_2t: {
      key: 'ac_2t',
      category: 'ac',
      name: '2 Ton Inverter AC (2000W)',
      shortLabel: '2T Inverter AC',
      specLabel: '2.0 Ton 3-Star Inverter AC',
      icon: '❄️',
      qty: 1,
      watt: 2000,
      surgeMult: 1.6,
      simultaneous: false,
      defaultDayHrs: 4,
      defaultNightHrs: 6,
      is3Phase: false,
      params: { ton: '2', technology: 'inverter', starRating: '3' }
    }
  });

  // Array of presets for template iteration
  readonly presetList = computed(() => Object.values(this.presets()));

  // ADJUST SPECIFICATIONS MODAL STATE
  // Follows sizing-calc adjust section: calculates ONLY power (Watts, surge, surge W).
  // Time and kWh load calculation are kept exclusively in the table.
  readonly modalState = signal<ModalAdjustState>({
    isOpen: false,
    isEditingRow: false,
    editingItemId: null,
    editingPresetKey: null,
    slot: 'day',
    category: 'custom',
    name: 'Custom Load',
    specLabel: 'Custom Power Load',
    qty: 1,
    watt: 200,
    surgeMult: 1.0,
    peakSurgeW: 200,
    totalRunningW: 200,
    totalSurgeW: 200,
    simultaneous: true,
    is3Phase: false,
    params: {}
  });

  readonly standardKvaRatings = [1, 2, 3, 3.5, 5, 6, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

  ngOnInit(): void {
    this.navService.setPageTitle('Sizing Calculation');
    this.loadTemplate('residential_3bhk');
    // Auto-load AI engineering sizing analysis on page load
    setTimeout(() => {
      this.askAiAdvisor();
    }, 400);
  }

  // Filtered views of appliances
  readonly daytimeAppliances = computed(() => this.appliances().filter(a => a.slot === 'day'));
  readonly nighttimeAppliances = computed(() => this.appliances().filter(a => a.slot === 'night'));

  // Energy & Load Computations
  readonly audit = computed(() => {
    let dayKwh = 0;
    let nightKwh = 0;
    let continuousW = 0;
    let maxSurgeIncrementalW = 0;
    let has3PhaseAppliance = false;
    let countNormalFans = 0;
    let normalFanDailyKwh = 0;

    const list = this.appliances();
    for (const app of list) {
      const runningW = app.qty * app.watt;
      const peakSurgeW = runningW * app.surgeMult;
      const incSurge = peakSurgeW - runningW;

      if (app.is3Phase) has3PhaseAppliance = true;

      if (app.simultaneous) {
        continuousW += runningW;
        if (incSurge > maxSurgeIncrementalW) {
          maxSurgeIncrementalW = incSurge;
        }
      }

      const itemKwh = (runningW * app.hours) / 1000;
      if (app.slot === 'day') {
        dayKwh += itemKwh;
      } else {
        nightKwh += itemKwh;
      }

      if (app.name.toLowerCase().includes('normal') && app.name.toLowerCase().includes('fan')) {
        countNormalFans += app.qty;
        normalFanDailyKwh += (app.qty * (app.watt - 30) * app.hours) / 1000;
      }
    }

    const peakStartingSurgeW = continuousW + maxSurgeIncrementalW;
    let totalDailyKwh = dayKwh + nightKwh;

    if (this.architecture() === 'ongrid') {
      const derived = this.monthlyUnits() / 30;
      if (derived > 0) {
        totalDailyKwh = derived;
        dayKwh = derived * 0.60;
        nightKwh = derived * 0.40;
      }
    }

    return {
      dayKwh,
      nightKwh,
      totalDailyKwh,
      continuousW,
      peakStartingSurgeW,
      has3PhaseAppliance,
      countNormalFans,
      normalFanDailyKwh,
      isHighCapacity: totalDailyKwh > 200
    };
  });

  // Inverter & MPPT PCU Sizing
  readonly inverter = computed(() => {
    const a = this.audit();
    const marginFactor = 1 + (this.expansionMargin() / 100);
    const kvaFromContinuous = (a.continuousW * marginFactor) / 800;
    const kvaFromSurge = a.peakStartingSurgeW / 1600;
    const rawKva = Math.max(kvaFromContinuous, kvaFromSurge, 1.0);

    const sizedKva = this.standardKvaRatings.find(r => r >= rawKva) || 100;

    // Auto-calculated Supply Phase: 3-Phase if 3P appliance, continuous load >5kW, inverter >= 10kVA, or solar demand >5kW
    const isThreePhase = a.has3PhaseAppliance || 
                         a.continuousW > 5000 || 
                         sizedKva >= 10 || 
                         (this.monthlyUnits() > 500 && (this.architecture() === 'ongrid' || this.architecture() === 'hybrid'));

    let dcVoltage = 48;
    let busArchitecture = "Low Voltage Rack";

    if (sizedKva <= 1) {
      dcVoltage = 12;
      busArchitecture = "12V Mono Pack";
    } else if (sizedKva === 2) {
      dcVoltage = 24;
      busArchitecture = "24V Dual Pack";
    } else if (sizedKva <= 5) {
      dcVoltage = 48;
      busArchitecture = "48V Telecom/Solar Standard";
    } else if (sizedKva <= 7.5) {
      dcVoltage = 96;
      busArchitecture = "96V Multi-String Pack";
    } else if (sizedKva <= 10) {
      dcVoltage = 120;
      busArchitecture = "120V DC Bus";
    } else if (sizedKva <= 30) {
      dcVoltage = 240;
      busArchitecture = "240V Commercial High-Bus";
    } else {
      dcVoltage = 384;
      busArchitecture = "384V–480V Industrial HV Rack ESS";
    }

    const ratedWatts = sizedKva * 1000 * 0.8;
    const surgeCapacityWatts = ratedWatts * 2;
    const acOutputCurrent = isThreePhase
      ? (sizedKva * 1000) / (Math.sqrt(3) * 415)
      : (sizedKva * 1000) / 230;

    let mpptRangeText = "65V – 140V DC";
    if (isThreePhase || sizedKva >= 15) {
      mpptRangeText = "350V – 850V DC (1000V Max Voc)";
    } else if (sizedKva >= 6) {
      mpptRangeText = "150V – 450V DC (500V Max Voc)";
    } else {
      mpptRangeText = "65V – 150V DC (200V Max Voc)";
    }

    return {
      rawKva,
      sizedKva,
      isThreePhase,
      dcVoltage,
      busArchitecture,
      ratedWatts,
      surgeCapacityWatts,
      acOutputCurrent,
      mpptRangeText
    };
  });

  // Auto-calculated Supply Phase ('single' | 'three') set from electrical load & grid standards
  readonly supplyPhase = computed<'single' | 'three'>(() => {
    return this.inverter().isThreePhase ? 'three' : 'single';
  });

  // Solar PV Array Sizing
  readonly solar = computed(() => {
    const a = this.audit();
    const inv = this.inverter();
    const marginFactor = 1 + (this.expansionMargin() / 100);
    const arch = this.architecture();

    let requiredKwp = 0;
    if (arch === 'offgrid' || arch === 'hybrid') {
      requiredKwp = ((a.dayKwh + (a.nightKwh / 0.80)) / this.psh()) * marginFactor;
    } else if (arch === 'ongrid') {
      requiredKwp = a.totalDailyKwh / (this.psh() * 0.82);
    } else {
      requiredKwp = 0;
    }

    const panelW = this.panelWattage();
    let totalPanels = requiredKwp > 0 ? Math.ceil((requiredKwp * 1000) / panelW) : 0;

    let seriesPanels = 1;
    let parallelStrings = 1;

    if (totalPanels > 0) {
      if (inv.isThreePhase) {
        seriesPanels = Math.min(16, totalPanels);
        if (seriesPanels < 10 && totalPanels >= 10) seriesPanels = 10;
        parallelStrings = Math.ceil(totalPanels / seriesPanels);
        totalPanels = seriesPanels * parallelStrings;
      } else {
        const maxSeries = inv.dcVoltage <= 48 ? 3 : 7;
        seriesPanels = Math.min(maxSeries, totalPanels);
        parallelStrings = Math.ceil(totalPanels / seriesPanels);
        totalPanels = seriesPanels * parallelStrings;
      }
    }

    const actualInstalledKwp = (totalPanels * panelW) / 1000;
    const estVoc = seriesPanels * 50.5;
    const estIsc = parallelStrings * 14.5;
    const roofAreaSqFt = Math.round(totalPanels * 27.5);

    return {
      requiredKwp,
      panelW,
      totalPanels,
      seriesPanels,
      parallelStrings,
      actualInstalledKwp,
      estVoc,
      estIsc,
      roofAreaSqFt
    };
  });

  // Auto-calculated Sanctioned Load (kW) based on DISCOM net-metering & system sizing rules
  readonly sanctionedLoad = computed<number>(() => {
    const units = this.monthlyUnits();
    const solarKwp = this.solar().actualInstalledKwp;
    const continuousKw = this.audit().continuousW / 1000;
    const arch = this.architecture();

    if (arch === 'ongrid') {
      // In On-Grid: Rule-of-thumb is ~100 units/month per kW sanction.
      // Additionally, under DISCOM net-metering regulations, solar capacity cannot exceed sanctioned load.
      const fromUnits = Math.round((units / 100) * 10) / 10;
      const fromSolar = Math.ceil(solarKwp);
      return Math.max(fromUnits, fromSolar, 1.0);
    } else if (arch === 'hybrid') {
      // In Hybrid: Must cover continuous appliance running load, solar array export, inverter rating, or monthly units
      const fromUnits = units > 0 ? Math.round((units / 100) * 10) / 10 : 0;
      const fromLoad = Math.ceil(continuousKw * 1.15);
      const fromSolar = Math.ceil(solarKwp);
      const fromInverter = Math.ceil(this.inverter().sizedKva);
      return Math.max(fromUnits, fromLoad, fromSolar, fromInverter, 1.0);
    } else {
      const fromLoad = Math.ceil(continuousKw * 1.15);
      return Math.max(fromLoad, 1.0);
    }
  });

  // 3 Battery Bank Options (Accounting for DoD & 90% Inverter Efficiency)
  readonly batteryOptions = computed(() => {
    const a = this.audit();
    const inv = this.inverter();
    const arch = this.architecture();

    let backupKwh = 0;
    if (arch === 'offgrid') {
      backupKwh = a.nightKwh;
    } else if (arch === 'hybrid' || arch === 'nobattery') {
      const activeHrs = Math.max(1, Math.min(14, this.backupHours()));
      backupKwh = (a.continuousW * activeHrs) / 1000;
    } else {
      return null;
    }

    if (backupKwh <= 0.1) backupKwh = 1.0;

    // OPTION 1: Premium LiFePO4 (45% Morning Reserve)
    const targetUsableOpt1 = backupKwh * 1.45;
    const dcStorageOpt1 = targetUsableOpt1 / (0.90 * 0.90);
    const totalAhOpt1 = (dcStorageOpt1 * 1000) / inv.dcVoltage;
    let roundedAhOpt1 = 100;
    if (totalAhOpt1 <= 100) roundedAhOpt1 = 100;
    else if (totalAhOpt1 <= 150) roundedAhOpt1 = 150;
    else if (totalAhOpt1 <= 200) roundedAhOpt1 = 200;
    else if (totalAhOpt1 <= 300) roundedAhOpt1 = 300;
    else roundedAhOpt1 = Math.ceil(totalAhOpt1 / 100) * 100;
    const actualDcOpt1 = (roundedAhOpt1 * inv.dcVoltage) / 1000;

    // OPTION 2: Standard LiFePO4 (15% Safety Buffer)
    const targetUsableOpt2 = backupKwh * 1.15;
    const dcStorageOpt2 = targetUsableOpt2 / (0.90 * 0.90);
    const totalAhOpt2 = (dcStorageOpt2 * 1000) / inv.dcVoltage;
    let roundedAhOpt2 = 100;
    if (totalAhOpt2 <= 100) roundedAhOpt2 = 100;
    else if (totalAhOpt2 <= 150) roundedAhOpt2 = 150;
    else if (totalAhOpt2 <= 200) roundedAhOpt2 = 200;
    else roundedAhOpt2 = Math.ceil(totalAhOpt2 / 100) * 100;
    const actualDcOpt2 = (roundedAhOpt2 * inv.dcVoltage) / 1000;

    // OPTION 3: C10 Solar Tall Tubular (70% DoD)
    const targetUsableOpt3 = backupKwh * 1.25;
    const dcStorageOpt3 = targetUsableOpt3 / (0.70 * 0.90);
    const totalAhOpt3 = (dcStorageOpt3 * 1000) / inv.dcVoltage;
    const series12VCount = inv.dcVoltage / 12;
    let unitAh3 = 150;
    if (totalAhOpt3 > 200) unitAh3 = 200;
    if (totalAhOpt3 > 260) unitAh3 = 250;
    const parallelStrings3 = Math.max(1, Math.ceil(totalAhOpt3 / unitAh3));
    const totalTubularUnits = series12VCount * parallelStrings3;
    const actualDcOpt3 = (totalTubularUnits * 12 * unitAh3) / 1000;

    return {
      backupKwh,
      opt1: {
        title: 'Premium LiFePO4 (High Autonomy & Morning Reserve)',
        dcStorageKwh: actualDcOpt1,
        usableKwh: actualDcOpt1 * 0.90 * 0.90,
        ahRating: roundedAhOpt1,
        voltage: inv.dcVoltage,
        morningReservePct: Math.round(((actualDcOpt1 * 0.90 * 0.90 - backupKwh) / (actualDcOpt1 * 0.90 * 0.90)) * 100),
        lifespan: '8 – 10+ Years (3,500 – 6,000 Cycles)',
        warranty: '5 Years Replacement Warranty',
        configuration: `${roundedAhOpt1}Ah @ ${inv.dcVoltage}V (${inv.busArchitecture})`,
        isRecommended: true
      },
      opt2: {
        title: 'Standard LiFePO4 (Economy Lithium Battery)',
        dcStorageKwh: actualDcOpt2,
        usableKwh: actualDcOpt2 * 0.90 * 0.90,
        ahRating: roundedAhOpt2,
        voltage: inv.dcVoltage,
        bufferPct: 15,
        lifespan: '8 – 10 Years (3,000 Cycles)',
        warranty: '5 Years Standard Warranty',
        configuration: `${roundedAhOpt2}Ah @ ${inv.dcVoltage}V Pack`,
        isRecommended: false
      },
      opt3: {
        title: 'C10 Solar Tall Tubular Lead-Acid Bank',
        dcStorageKwh: actualDcOpt3,
        usableKwh: actualDcOpt3 * 0.70 * 0.90,
        totalUnits: totalTubularUnits,
        batteryModel: `12V ${unitAh3}Ah C10`,
        seriesCount: series12VCount,
        parallelCount: parallelStrings3,
        lifespan: '3 – 5 Years (1,200 – 1,500 Cycles)',
        warranty: '3 – 5 Years Warranty (Pro-rata)',
        configuration: `${totalTubularUnits} Nos × 12V ${unitAh3}Ah (${series12VCount} in series × ${parallelStrings3} strings)`,
        isRecommended: false
      }
    };
  });

  // Dynamic BOS & Electrical Protection Schedule
  readonly bos = computed(() => {
    const inv = this.inverter();
    const sol = this.solar();
    const is3P = inv.isThreePhase;

    const dcdbSpd = sol.estVoc > 500 ? '1000V DC Type-2 SPD' : '600V DC Type-2 SPD';
    const stringFuse = '15A / 20A 1000V DC Cylindrical Fuses';
    const acdbSpd = is3P ? '415V 4-Pole Type-2 AC SPD' : '230V 2-Pole Type-2 AC SPD';
    const acMcbRating = Math.ceil(inv.acOutputCurrent * 1.25);
    const acBreaker = is3P ? `${acMcbRating}A 4-Pole 415V C-Curve MCB/MCCB` : `${acMcbRating}A 2-Pole 230V C-Curve MCB`;
    const dcPvCable = sol.parallelStrings > 2 ? '6 sq.mm Cu Solar DC Cable' : '4 sq.mm Cu Solar DC Cable';

    let battCable = '25 sq.mm Flexible Copper';
    if (inv.dcVoltage <= 24) battCable = '70 sq.mm – 95 sq.mm Super-Flex Copper';
    else if (inv.dcVoltage <= 48) battCable = '35 sq.mm – 50 sq.mm Flexible Copper';
    else battCable = '25 sq.mm Flexible Double-Insulated Copper';

    let acCable = '4 sq.mm 3-Core Cu Cable';
    if (is3P) {
      if (inv.sizedKva >= 40) acCable = '35–50 sq.mm 4-Core XLPE Al/Cu Armoured Cable';
      else if (inv.sizedKva >= 20) acCable = '16 sq.mm 4-Core Cu Flexible/Armoured Cable';
      else acCable = '6 sq.mm 4-Core Cu Cable';
    } else {
      if (inv.sizedKva >= 7.5) acCable = '10 sq.mm 3-Core Cu Armoured/Flexible Cable';
      else if (inv.sizedKva >= 5) acCable = '6 sq.mm 3-Core Cu Cable';
      else acCable = '4 sq.mm 3-Core Cu Cable';
    }

    let earthingCable = '10 sq.mm Green Multistrand Cu Cable';
    if (is3P || inv.sizedKva >= 15) {
      earthingCable = '16 sq.mm Green Cu Cable & 25×3 mm GI/Copper Earthing Flat Strip';
    } else if (inv.sizedKva >= 5) {
      earthingCable = '10–16 sq.mm Green Multistrand Cu Earthing Cable';
    } else {
      earthingCable = '6–10 sq.mm Green Multistrand Cu Earthing Cable';
    }

    return {
      dcdbSpd,
      stringFuse,
      acdbSpd,
      acBreaker,
      dcPvCable,
      battCable,
      acCable,
      earthingCable,
      earthing: '3-Pit Chemical Earthing (DC Array Structure, AC Inverter Neutral/Body, Lightning Arrester)'
    };
  });

  // ==========================================
  // ADJUST SPECIFICATIONS MODAL CONTROLS
  // (Follows sizing-calc adjust section)
  // ==========================================

  /**
   * Open the Adjust Modal for a Quick-Add preset
   */
  openAdjustModalForPreset(presetKey: string, targetSlot?: 'day' | 'night'): void {
    const p = this.presets()[presetKey];
    if (!p) return;

    const slot = targetSlot || (p.defaultDayHrs > 0 ? 'day' : 'night');
    const params: CalcParams = { ...p.params };

    this.modalState.set({
      isOpen: true,
      isEditingRow: false,
      editingItemId: null,
      editingPresetKey: presetKey,
      slot: slot,
      category: p.category,
      name: p.name,
      specLabel: p.specLabel,
      qty: p.qty,
      watt: p.watt,
      surgeMult: p.surgeMult,
      peakSurgeW: Math.round(p.watt * p.surgeMult),
      totalRunningW: p.qty * p.watt,
      totalSurgeW: Math.round(p.qty * p.watt * p.surgeMult),
      simultaneous: p.simultaneous,
      is3Phase: p.is3Phase || false,
      params: params
    });

    this.recalcModalPower();
  }

  /**
   * Open the Adjust Modal to edit an existing table row
   */
  openAdjustModalForRow(item: ApplianceItem): void {
    const params: CalcParams = item.calcParams ? { ...item.calcParams } : {};

    this.modalState.set({
      isOpen: true,
      isEditingRow: true,
      editingItemId: item.id,
      editingPresetKey: null,
      slot: item.slot,
      category: item.category || 'custom',
      name: item.name,
      specLabel: item.specLabel || item.name,
      qty: item.qty,
      watt: item.watt,
      surgeMult: item.surgeMult,
      peakSurgeW: Math.round(item.watt * item.surgeMult),
      totalRunningW: item.qty * item.watt,
      totalSurgeW: Math.round(item.qty * item.watt * item.surgeMult),
      simultaneous: item.simultaneous,
      is3Phase: item.is3Phase || false,
      params: params
    });

    this.recalcModalPower();
  }

  /**
   * Open modal to add a new appliance to a specific slot
   * (Replaces prompt() for Daytime and Nighttime addition)
   */
  openModalForSlot(slot: 'day' | 'night', category: string = 'custom'): void {
    const isNight = slot === 'night';
    const defaultName = isNight ? 'Security Light / Night Fan' : 'Daytime Load / Machine';

    this.modalState.set({
      isOpen: true,
      isEditingRow: false,
      editingItemId: null,
      editingPresetKey: null,
      slot: slot,
      category: category,
      name: defaultName,
      specLabel: defaultName,
      qty: 1,
      watt: isNight ? 100 : 500,
      surgeMult: 1.0,
      peakSurgeW: isNight ? 100 : 500,
      totalRunningW: isNight ? 100 : 500,
      totalSurgeW: isNight ? 100 : 500,
      simultaneous: true,
      is3Phase: false,
      params: {}
    });

    this.recalcModalPower();
  }

  closeAdjustModal(): void {
    this.modalState.update(s => ({ ...s, isOpen: false }));
  }

  onModalCategoryChange(category: string): void {
    this.modalState.update(s => ({ ...s, category: category }));
    // Reset category default params
    if (category === 'fan') {
      this.modalState.update(s => ({ ...s, name: 'Ceiling Fan', params: { fanType: 'induction', speed: 'medium' } }));
    } else if (category === 'ac') {
      this.modalState.update(s => ({ ...s, name: 'Air Conditioner', params: { ton: '1.5', technology: 'inverter', starRating: '3' } }));
    } else if (category === 'pump') {
      this.modalState.update(s => ({ ...s, name: 'Water Pump', params: { motorHp: '1', pumpType: 'monoblock' } }));
    } else if (category === 'fridge') {
      this.modalState.update(s => ({ ...s, name: 'Refrigerator', params: { capacityL: 240, doorType: 'double', starRating: 3, compressorType: 'inverter' } }));
    } else if (category === 'tv') {
      this.modalState.update(s => ({ ...s, name: 'Smart TV', params: { screenSize: '43', displayType: 'led', resolution: '4k', brightness: 'standard' } }));
    } else if (category === 'comp') {
      this.modalState.update(s => ({ ...s, name: 'Computer / Laptop', params: { deviceType: 'desktop', gpuType: 'integrated', intensity: 'moderate' } }));
    } else if (category === 'led') {
      this.modalState.update(s => ({ ...s, name: 'LED Bulb', params: { bulbWatts: 10 } }));
    } else {
      this.modalState.update(s => ({ ...s, name: 'Custom Equipment', params: {} }));
    }
    this.recalcModalPower();
  }

  onModalParamChange(paramKey: string, val: any): void {
    this.modalState.update(s => {
      const p = { ...s.params, [paramKey]: val };
      return { ...s, params: p };
    });
    this.recalcModalPower();
  }

  /**
   * Recalculates power specifications using StandardLoadCalc
   * Follows sizing-calc adjust section: calculates ONLY power (Watts, surge, surge W).
   * NO hours or daily kWh calculation is done here.
   */
  recalcModalPower(): void {
    const m = this.modalState();
    const cat = m.category;
    const p = { ...m.params };

    let calculatedWatt = m.watt;
    let calculatedSurge = m.surgeMult;
    let is3Phase = m.is3Phase;
    let specDesc = '';

    if (cat === 'fan') {
      const isBldc = p['fanType'] === 'bldc';
      calculatedWatt = isBldc ? 30 : 75;
      if (p['speed'] === 'low') calculatedWatt = Math.round(calculatedWatt * 0.75);
      if (p['speed'] === 'high') calculatedWatt = Math.round(calculatedWatt * 1.15);
      calculatedSurge = isBldc ? 1.0 : 1.2;
      specDesc = isBldc ? 'BLDC Energy Saver (30W)' : 'Standard Induction Fan (75W)';
    } else if (cat === 'ac') {
      const res = StandardLoadCalc.calculateAc(p);
      calculatedWatt = res.averageWatts;
      const isInverter = p['technology'] !== 'nonInverter';
      calculatedSurge = isInverter ? 1.6 : 2.5;
      specDesc = `${p['ton'] || '1.5'} Ton ${isInverter ? 'Inverter' : 'Non-Inverter'} AC (${p['starRating'] || '3'} Star)`;
    } else if (cat === 'pump') {
      const res = StandardLoadCalc.calculatePump(p);
      calculatedWatt = res.averageWatts;
      const hp = parseFloat(String(p['motorHp'] || '1.0'));
      is3Phase = hp >= 3.0 || p['pumpType'] === '3phase';
      calculatedSurge = is3Phase ? 2.5 : 2.625;
      specDesc = `${hp} HP ${is3Phase ? '3-Phase' : 'Single-Phase'} ${p['pumpType'] || 'Pump'}`;
    } else if (cat === 'fridge') {
      const res = StandardLoadCalc.calculateFridge(p);
      calculatedWatt = res.averageWatts;
      const isInverter = p['compressorType'] === 'inverter';
      calculatedSurge = isInverter ? 1.6 : 3.0;
      specDesc = `${p['capacityL'] || 240}L ${isInverter ? 'Inverter' : 'Fixed'} Refrigerator (${p['starRating'] || 3}-Star)`;
    } else if (cat === 'tv') {
      const res = StandardLoadCalc.calculateTv(p);
      calculatedWatt = res.averageWatts;
      calculatedSurge = 1.0;
      specDesc = `${p['screenSize'] || '43'}" ${String(p['displayType'] || 'LED').toUpperCase()} TV`;
    } else if (cat === 'comp') {
      const res = StandardLoadCalc.calculateComputer(p);
      calculatedWatt = res.averageWatts;
      calculatedSurge = p['deviceType'] === 'laptop' ? 1.0 : 1.2;
      specDesc = p['deviceType'] === 'laptop' ? 'Laptop Computer (~65W)' : 'Desktop Workstation (~200W)';
    } else if (cat === 'led') {
      const res = StandardLoadCalc.calculateLed(p);
      calculatedWatt = res.averageWatts;
      calculatedSurge = 1.0;
      specDesc = `LED Bulb (${calculatedWatt}W)`;
    } else {
      specDesc = m.name || 'Custom Load';
      calculatedWatt = m.watt > 0 ? m.watt : 100;
      calculatedSurge = m.surgeMult >= 1.0 ? m.surgeMult : 1.0;
    }

    const peakSurgeW = Math.round(calculatedWatt * calculatedSurge);
    const qty = m.qty > 0 ? m.qty : 1;
    const totalRunningW = qty * calculatedWatt;
    const totalSurgeW = qty * peakSurgeW;

    this.modalState.update(s => ({
      ...s,
      watt: calculatedWatt,
      surgeMult: calculatedSurge,
      peakSurgeW: peakSurgeW,
      totalRunningW: totalRunningW,
      totalSurgeW: totalSurgeW,
      is3Phase: is3Phase,
      specLabel: specDesc
    }));
  }

  /**
   * Applies the adjusted specifications:
   * 1. Updates Quick-Add preset badge/selection if preset was edited.
   * 2. Reflects in table (either updates existing row or creates new item with selected slot).
   */
  saveAdjustModal(): void {
    const m = this.modalState();
    const qty = m.qty > 0 ? m.qty : 1;
    const watt = m.watt > 0 ? m.watt : 100;
    const surge = m.surgeMult >= 1.0 ? m.surgeMult : 1.0;

    // 1. Reflect in Quick-Add Presets selection if a preset was modified
    if (m.editingPresetKey && this.presets()[m.editingPresetKey]) {
      this.presets.update(map => ({
        ...map,
        [m.editingPresetKey!]: {
          ...map[m.editingPresetKey!],
          name: m.name || m.specLabel,
          specLabel: m.specLabel,
          watt: watt,
          surgeMult: surge,
          is3Phase: m.is3Phase,
          params: { ...m.params }
        }
      }));
    }

    // 2. Reflect in Table
    if (m.isEditingRow && m.editingItemId) {
      // Update existing row
      this.appliances.update(arr => arr.map(a => {
        if (a.id === m.editingItemId) {
          return {
            ...a,
            name: m.name || m.specLabel,
            category: m.category,
            specLabel: m.specLabel,
            slot: m.slot,
            qty: qty,
            watt: watt,
            surgeMult: surge,
            simultaneous: m.simultaneous,
            is3Phase: m.is3Phase,
            calcParams: { ...m.params }
          };
        }
        return a;
      }));
    } else {
      // Add new appliance to chosen slot (Daytime or Nighttime)
      const defaultHrs = m.slot === 'day' ? 4.0 : 6.0;
      const newItem: ApplianceItem = {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        slot: m.slot,
        name: m.name || m.specLabel,
        category: m.category,
        specLabel: m.specLabel,
        qty: qty,
        watt: watt,
        surgeMult: surge,
        simultaneous: m.simultaneous,
        hours: defaultHrs,
        is3Phase: m.is3Phase,
        calcParams: { ...m.params }
      };

      this.appliances.update(arr => [...arr, newItem]);
    }

    this.closeAdjustModal();
  }

  // Quick Direct Add Preset (adds into daytime and/or nighttime)
  quickAddPreset(key: string, targetSlot?: 'day' | 'night'): void {
    const preset = this.presets()[key];
    if (!preset) return;

    if (targetSlot) {
      this.appliances.update(arr => [
        ...arr,
        {
          id: Date.now() + Math.random().toString(36).substring(2, 6),
          slot: targetSlot,
          name: preset.name,
          category: preset.category,
          specLabel: preset.specLabel,
          qty: preset.qty,
          watt: preset.watt,
          surgeMult: preset.surgeMult,
          simultaneous: preset.simultaneous,
          hours: targetSlot === 'day' ? preset.defaultDayHrs : preset.defaultNightHrs,
          is3Phase: preset.is3Phase || false,
          calcParams: { ...preset.params }
        }
      ]);
      return;
    }

    const toAdd: ApplianceItem[] = [];
    if (preset.defaultDayHrs > 0) {
      toAdd.push({
        id: Date.now() + Math.random().toString(36).substring(2, 6) + 'd',
        slot: 'day',
        name: preset.name,
        category: preset.category,
        specLabel: preset.specLabel,
        qty: preset.qty,
        watt: preset.watt,
        surgeMult: preset.surgeMult,
        simultaneous: preset.simultaneous,
        hours: preset.defaultDayHrs,
        is3Phase: preset.is3Phase || false,
        calcParams: { ...preset.params }
      });
    }

    if (preset.defaultNightHrs > 0) {
      toAdd.push({
        id: Date.now() + Math.random().toString(36).substring(2, 6) + 'n',
        slot: 'night',
        name: preset.name,
        category: preset.category,
        specLabel: preset.specLabel,
        qty: preset.qty,
        watt: preset.watt,
        surgeMult: preset.surgeMult,
        simultaneous: preset.simultaneous,
        hours: preset.defaultNightHrs,
        is3Phase: preset.is3Phase || false,
        calcParams: { ...preset.params }
      });
    }

    this.appliances.update(arr => [...arr, ...toAdd]);
  }

  removeAppliance(id: string): void {
    this.appliances.update(arr => arr.filter(a => a.id !== id));
  }

  updateApplianceField(id: string, field: keyof ApplianceItem, value: any): void {
    this.appliances.update(arr => arr.map(a => {
      if (a.id === id) {
        if (field === 'simultaneous') {
          return { ...a, simultaneous: !!value };
        }
        return { ...a, [field]: parseFloat(value) || (typeof a[field] === 'string' ? value : 0) };
      }
      return a;
    }));
  }

  clearApplianceList(): void {
    this.appliances.set([]);
  }

  // Pre-configured Templates
  loadTemplate(tpl: string): void {
    if (tpl === 'residential_3bhk') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: 'Ceiling Fan (75W)', category: 'fan', specLabel: 'Induction 75W', qty: 15, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 7 },
        { id: 'd2', slot: 'day', name: 'LED Bulb (10W)', category: 'led', specLabel: '10W LED', qty: 20, watt: 10, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'd3', slot: 'day', name: 'Desktop PC (200W)', category: 'comp', specLabel: 'Desktop Computer', qty: 2, watt: 200, surgeMult: 1.2, simultaneous: true, hours: 7 },
        { id: 'd4', slot: 'day', name: '1 HP Water Pump (850W)', category: 'pump', specLabel: '1 HP Monoblock Pump', qty: 1, watt: 850, surgeMult: 2.59, simultaneous: true, hours: 1.5 },
        { id: 'n1', slot: 'night', name: 'Ceiling Fan (75W)', category: 'fan', specLabel: 'Induction 75W', qty: 6, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 17 },
        { id: 'n2', slot: 'night', name: 'LED Bulb (10W)', category: 'led', specLabel: '10W LED', qty: 20, watt: 10, surgeMult: 1.0, simultaneous: true, hours: 12 },
        { id: 'n3', slot: 'night', name: '1 HP Water Pump (850W)', category: 'pump', specLabel: '1 HP Monoblock Pump', qty: 1, watt: 850, surgeMult: 2.59, simultaneous: true, hours: 0.5 }
      ]);
    } else if (tpl === 'office_clinic') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: 'LED Tube Lights (20W)', category: 'led', specLabel: '20W LED Tube', qty: 15, watt: 20, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'd2', slot: 'day', name: 'Desktop Computers (200W)', category: 'comp', specLabel: 'Desktop Workstation', qty: 6, watt: 200, surgeMult: 1.2, simultaneous: true, hours: 7 },
        { id: 'd3', slot: 'day', name: 'BLDC Ceiling Fans (30W)', category: 'fan', specLabel: 'BLDC 30W', qty: 6, watt: 30, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'd4', slot: 'day', name: '1.5 Ton Inverter AC', category: 'ac', specLabel: '1.5T Inverter', qty: 2, watt: 1500, surgeMult: 1.6, simultaneous: true, hours: 6 },
        { id: 'd5', slot: 'day', name: 'Water Dispenser & Refrigerator', category: 'fridge', specLabel: 'Commercial Dispenser', qty: 1, watt: 250, surgeMult: 2.5, simultaneous: true, hours: 7 },
        { id: 'n1', slot: 'night', name: 'Security Lights (15W)', category: 'led', specLabel: '15W Security LED', qty: 4, watt: 15, surgeMult: 1.0, simultaneous: true, hours: 12 },
        { id: 'n2', slot: 'night', name: 'CCTV Server & Router', category: 'comp', specLabel: 'CCTV Server', qty: 1, watt: 120, surgeMult: 1.0, simultaneous: true, hours: 17 }
      ]);
    } else if (tpl === 'solar_pump') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: '3 HP 3-Phase Solar Agri Pump', category: 'pump', specLabel: '3 HP 3-Phase Pump', qty: 1, watt: 2400, surgeMult: 2.5, simultaneous: true, hours: 6, is3Phase: true },
        { id: 'd2', slot: 'day', name: 'Farmhouse Fans & Lights', category: 'fan', specLabel: 'Farmhouse Loads', qty: 4, watt: 40, surgeMult: 1.0, simultaneous: true, hours: 5 },
        { id: 'n1', slot: 'night', name: 'Security LED Floodlights (50W)', category: 'led', specLabel: '50W Floodlight', qty: 2, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 10 },
        { id: 'n2', slot: 'night', name: 'Farmhouse Fan (75W)', category: 'fan', specLabel: 'Normal Fan', qty: 2, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 8 }
      ]);
    } else if (tpl === 'commercial_mill') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: '5 HP 3-Phase Flour Mill / Grinder', category: 'pump', specLabel: '5 HP 3-Phase Motor', qty: 2, watt: 3800, surgeMult: 2.5, simultaneous: true, hours: 6, is3Phase: true },
        { id: 'd2', slot: 'day', name: '2 HP Single-Phase Oil Expeller', category: 'pump', specLabel: '2 HP Expeller', qty: 1, watt: 1600, surgeMult: 2.6, simultaneous: true, hours: 5 },
        { id: 'd3', slot: 'day', name: 'High-Bay Commercial LED (50W)', category: 'led', specLabel: '50W High-Bay', qty: 8, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'n1', slot: 'night', name: 'Perimeter Security Lights (50W)', category: 'led', specLabel: '50W Perimeter', qty: 6, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 12 },
        { id: 'n2', slot: 'night', name: 'Office CCTV & Night Guard Fans', category: 'comp', specLabel: 'Guard Room Load', qty: 2, watt: 120, surgeMult: 1.0, simultaneous: true, hours: 12 }
      ]);
    }
  }

  // Direct PDF proposals (Direct download, zero modal popup)
  readonly dayAppliances = computed(() => this.appliances().filter(a => a.slot === 'day'));
  readonly nightAppliances = computed(() => this.appliances().filter(a => a.slot === 'night'));

  toOdiaNum(val: number | string | undefined | null): string {
    if (val === undefined || val === null) return '';
    const odiaDigits = ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'];
    return val.toString().replace(/\d/g, d => odiaDigits[parseInt(d, 10)]);
  }

  getApplianceOdiaName(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('bldc')) return 'BLDC ସିଲିଂ ପଙ୍ଖା (BLDC Ceiling Fan)';
    if (n.includes('fan') || n.includes('ପଙ୍ଖା')) return 'ସିଲିଂ ପଙ୍ଖା (Ceiling Fan)';
    if (n.includes('led') || n.includes('bulb') || n.includes('ବଲବ୍')) return 'ଏଲ.ଇ.ଡି. ବଲବ୍ (LED Bulb)';
    if (n.includes('desktop') || n.includes('computer')) return 'ଡେସ୍କଟପ୍ କମ୍ପ୍ୟୁଟର (Desktop PC)';
    if (n.includes('laptop')) return 'ଲାପଟପ୍ (Laptop)';
    if (n.includes('tv') || n.includes('wi-fi') || n.includes('wifi')) return 'ଟିଭି / ୱାଇ-ଫାଇ (TV / Wi-Fi)';
    if (n.includes('refrigerator') || n.includes('fridge')) return 'ରେଫ୍ରିଜରେଟର (Refrigerator)';
    if (n.includes('pump') || n.includes('ପମ୍ପ') || n.includes('motor')) {
      if (n.includes('1 hp') || n.includes('1hp')) return '୧ HP ପାଣି ପମ୍ପ (Water Pump)';
      if (n.includes('2 hp') || n.includes('2hp')) return '୨ HP ପାଣି ପମ୍ପ (Water Pump)';
      if (n.includes('3 hp') || n.includes('3hp')) return '୩ HP ୩-ଫେଜ୍ ପମ୍ପ (Water Pump)';
      if (n.includes('5 hp') || n.includes('5hp')) return '୫ HP ୩-ଫେଜ୍ ପମ୍ପ (Water Pump)';
      return 'ପାଣି ପମ୍ପ (Water Pump)';
    }
    if (n.includes('ac') || n.includes('air conditioner')) {
      if (n.includes('1.5')) return '୧.୫ ଟନ୍ ଏସି (1.5 Ton AC)';
      if (n.includes('2')) return '୨.୦ ଟନ୍ ଏସି (2 Ton AC)';
      return 'ଏୟାର କଣ୍ଡିସନର (Inverter AC)';
    }
    return name;
  }

  architectureHeadingOdia(): string {
    switch (this.architecture()) {
      case 'offgrid': return 'ସମ୍ପୂର୍ଣ୍ଣ ଅଫ୍-ଗ୍ରିଡ୍ ସୋଲାର ପାୱାର ସିଷ୍ଟମ୍ ପ୍ରସ୍ତାବନା';
      case 'hybrid': return 'ହାଇବ୍ରିଡ୍ ସୋଲାର ପାୱାର ସିଷ୍ଟମ୍ ପ୍ରସ୍ତାବନା';
      case 'ongrid': return 'ଅନ୍-ଗ୍ରିଡ୍ ନେଟ୍-ମିଟରିଂ ସୋଲାର ସିଷ୍ଟମ୍ ପ୍ରସ୍ତାବନା';
      case 'nobattery': return 'ଇନଭର୍ଟର ଓ ବ୍ୟାଟେରୀ ବ୍ୟାକଅପ୍ ସିଷ୍ଟମ୍ ପ୍ରସ୍ତାବନା';
    }
  }

  architectureDescOdia(): string {
    switch (this.architecture()) {
      case 'offgrid': return 'ବିନା କରେଣ୍ଟ (Zero-Grid) ୧୦୦% ସୋଲାର ଓ ବ୍ୟାଟେରୀ ଚାଳିତ';
      case 'hybrid': return 'ଗ୍ରିଡ୍ ସଂଯୁକ୍ତ + ବ୍ୟାଟେରୀ ବ୍ୟାକଅପ୍ ହାଇବ୍ରିଡ୍ ସିଷ୍ଟମ୍';
      case 'ongrid': return 'ପ୍ୟୁଅର୍ ଅନ୍-ଗ୍ରିଡ୍ ନେଟ୍-ମିଟରିଂ (ବିଲ୍ ଶୂନ୍ୟ ସିଷ୍ଟମ୍)';
      case 'nobattery': return 'ଗ୍ରିଡ୍ ଚାର୍ଜିଂ ଇନଭର୍ଟର ଓ ବ୍ୟାଟେରୀ ବ୍ୟାକଅପ୍';
    }
  }

  inverterHelpTextOdia(): string {
    const dayApps = this.dayAppliances();
    const fans = dayApps.find(a => a.category === 'fan');
    const leds = dayApps.find(a => a.category === 'led');
    const comps = dayApps.find(a => a.category === 'comp');
    const pump = dayApps.find(a => a.category === 'pump');

    const parts: string[] = [];
    if (fans) parts.push(`${this.toOdiaNum(fans.qty)}ଟି ପଙ୍ଖା`);
    if (leds) parts.push(`${this.toOdiaNum(leds.qty)}ଟି ବଲବ୍`);
    if (comps) parts.push(`${this.toOdiaNum(comps.qty)}ଟି ଡେସ୍କଟପ୍`);

    const loadsStr = parts.length > 0 ? parts.join(', ') : 'ସମସ୍ତ ଲୋଡ୍';
    if (pump) {
      const pName = (pump.name.includes('1') || pump.watt <= 1000) ? '୧ HP ପାଣି ପମ୍ପ' : (pump.name.includes('2') ? '୨ HP ପାଣି ପମ୍ପ' : 'ପାଣି ପମ୍ପ');
      return `ଦିନ ବେଳା ${loadsStr} ଚାଲୁଥିବା ସମୟରେ ${pName} ଅନ୍ ହେଲେ ମଧ୍ୟ ଇନଭର୍ଟର ବିନା କୌଣସି ଟ୍ରିପ୍‌ରେ ଆରାମରେ ଚଲାଇବ ।`;
    }
    return `ଦିନ ବେଳା ${loadsStr} ଏକାସାଙ୍ଗରେ ଚାଲୁଥିବା ସମୟରେ ମଧ୍ୟ ଇନଭର୍ଟର ବିନା କୌଣସି ଟ୍ରିପ୍‌ରେ ଆରାମରେ ଚଲାଇବ ।`;
  }

  batteryHelpTextOdia(): string {
    const nightUnits = this.audit().nightKwh;
    const opt1 = this.batteryOptions()?.opt1;
    const usable = opt1?.usableKwh || 16.5;
    const reserveMin = (usable * 0.35).toFixed(1);
    const reserveMax = (usable * 0.40).toFixed(1);
    const dcVolt = this.inverter().dcVoltage;
    const ah = opt1?.ahRating || 200;
    const upgradeAh = ah + 50;

    return `ରାତିର ${this.toOdiaNum(nightUnits.toFixed(2))} ୟୁନିଟ୍ ଖର୍ଚ୍ଚ ପରେ ବି ସକାଳକୁ ପ୍ରାୟ ୩୫–୪୦% (${this.toOdiaNum(reserveMin)} ରୁ ${this.toOdiaNum(reserveMax)} ୟୁନିଟ୍) ଚାର୍ଜ ବଞ୍ଚିକି ରହିବ, ଯାହା ବାଦଲିଆ ପାଗରେ ବ୍ୟାକଅପ୍ ଦେବ ଓ ବ୍ୟାଟେରୀ ୧୦+ ବର୍ଷ ଚାଲିବ । (ବର୍ଷା ଦିନେ ଅଧିକ ବ୍ୟାକଅପ୍ ପାଇଁ ${dcVolt}V ${upgradeAh}Ah ବ୍ୟାଟେରୀ ନେଇପାରିବେ) ।`;
  }

  downloadProposalPdf(): void {
    this.isGeneratingPdf.set(true);
    const element = document.getElementById('proposalPdfDoc');
    const host = document.getElementById('pdfOffscreenHost');

    if (!element || typeof html2pdf === 'undefined') {
      this.printProposalPdf();
      this.isGeneratingPdf.set(false);
      return;
    }

    if (host) {
      host.style.left = '0px';
      host.style.top = '0px';
    }

    const opt = {
      margin: 0,
      filename: `Shri_Trutiyadev_Solar_Proposal_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      this.isGeneratingPdf.set(false);
      if (host) host.style.left = '-9999px';
    }).catch((err: any) => {
      console.error(err);
      this.isGeneratingPdf.set(false);
      if (host) host.style.left = '-9999px';
      this.printProposalPdf();
    });
  }

  printProposalPdf(): void {
    const sheet = document.getElementById('proposalPdfDoc');
    const container = document.getElementById('printContainerAng');
    if (sheet && container) {
      container.innerHTML = sheet.outerHTML;
      window.print();
    }
  }

  openOdiaModal(): void {
    this.downloadProposalPdf();
  }

  closeOdiaModal(): void {
    this.showOdiaModal.set(false);
  }

  openEngModal(): void {
    this.downloadProposalPdf();
  }

  closeEngModal(): void {
    this.showEngModal.set(false);
  }

  downloadOdiaPdf(): void {
    this.downloadProposalPdf();
  }

  printOdiaPdf(): void {
    this.printProposalPdf();
  }

  downloadEngPdf(): void {
    this.downloadProposalPdf();
  }

  printEngPdf(): void {
    this.printProposalPdf();
  }

  // ==============================================================
  // FREE AI LLM SOLAR ADVISOR (Step 1 & Step 2 Prompt Engine)
  // ==============================================================
  buildAiPrompt(): string {
    const arch = this.architecture();
    const archName = arch === 'ongrid' ? 'On-Grid Net-Metered Solar System' :
                     arch === 'nobattery' ? 'Inverter & Battery Backup System (No Solar Panels)' :
                     arch === 'hybrid' ? 'Hybrid Solar System (Solar + Battery + Grid Sync)' :
                     'Off-Grid Autonomous Solar System (100% Solar + Battery)';

    const audit = this.audit();
    const inv = this.inverter();
    const solar = this.solar();
    const batt = this.batteryOptions();
    const psh = this.psh();

    let prompt = `ଆପଣ ଜଣେ ଅଭିଜ୍ଞ ବରିଷ୍ଠ ସୋଲାର ଓ ଇଲେକ୍ଟ୍ରିକାଲ୍ ଇଞ୍ଜିନିୟରିଂ କନସଲଟାଣ୍ଟ (Senior Solar & Electrical Engineer)।
ନିମ୍ନରେ ଜଣେ ଗ୍ରାହକଙ୍କ ସୋଲାର ସାଇଜିଂ କାଲକୁଲେଟରର Step 1 (ସିଷ୍ଟମ୍ ଆର୍କିଟେକ୍ଚର) ଏବଂ Step 2 (ବିଦ୍ୟୁତ୍ ଉପକରଣ ଓ ଲୋଡ୍ ସିଡ୍ୟୁଲ୍) ତଥ୍ୟ ଦିଆଯାଇଛି:

### ୧. Step 1: ସିଷ୍ଟମ୍ ମୌଳିକ ତଥ୍ୟ:
- ସିଷ୍ଟମ୍ ପ୍ରକାର: ${archName}
- ଦୈନିକ ପିକ୍ ସନ୍ ଆୱାର୍ (PSH): ${psh} ଘଣ୍ଟା (ଓଡ଼ିଶା ମାନକ)
- ଭବିଷ୍ୟତ ବିସ୍ତାର ମାର୍ଜିନ୍ (Expansion Margin): ${this.expansionMargin()}%
${arch === 'ongrid' ? `- ମାସିକ ବିଜୁଳି ଖର୍ଚ୍ଚ (Monthly Units): ${this.monthlyUnits()} ୟୁନିଟ୍ (kWh)\n- ଦୈନିକ ହାରାହାରି ଖର୍ଚ୍ଚ: ${(this.monthlyUnits() / 30).toFixed(2)} ୟୁନିଟ୍/ଦିନ` : ''}

### ୨. Step 2: ଲୋଡ୍ ଓ ବିଦ୍ୟୁତ୍ ସିଡ୍ୟୁଲ୍ ତଥ୍ୟ:
- ଦୈନିକ ମୋଟ ବିଦ୍ୟୁତ୍ ଖର୍ଚ୍ଚ (Total Daily Load): ${audit.totalDailyKwh.toFixed(2)} kWh/ଦିନ (~${Math.round(audit.totalDailyKwh)} ୟୁନିଟ୍)
- ଦିନ ବେଳାର ଖର୍ଚ୍ଚ (Daytime Load 9am-5pm): ${audit.dayKwh.toFixed(2)} kWh
- ରାତ୍ରି କାଳୀନ ଖର୍ଚ୍ଚ (Nighttime Load 5pm-9am): ${audit.nightKwh.toFixed(2)} kWh
- ସର୍ବୋଚ୍ଚ କଣ୍ଟିନ୍ୟୁଅସ୍ ଲୋଡ୍ (Peak Continuous Load): ${audit.continuousW} Watts
- ଷ୍ଟାର୍ଟିଂ ସର୍ଜ୍ ପାୱାର୍ (Peak Starting Surge): ${audit.peakStartingSurgeW} Watts
- ସିଷ୍ଟମ୍ ସପ୍ଲାଇ ଫେଜ୍: ${this.supplyPhase() === 'three' ? 'Three-Phase (3-Phase 415V)' : 'Single-Phase (1-Phase 230V)'}
- ସଂଯୁକ୍ତ ପ୍ରମୁଖ ଉପକରଣ ସଂଖ୍ୟା: ${this.appliances().length} ଟି

### ୩. ଗଣନା ହୋଇଥିବା ଇଞ୍ଜିନିୟରିଂ ସାଇଜିଂ:
- ଇନଭର୍ଟର କ୍ଷମତା: ${inv.sizedKva} kVA (${inv.ratedWatts}W, ${inv.dcVoltage}V DC Bus)
${arch !== 'nobattery' ? `- ସୋଲାର ପ୍ୟାନେଲ୍: ${solar.actualInstalledKwp.toFixed(2)} kWp (${solar.totalPanels} ଟି 550W Mono-PERC ପ୍ୟାନେଲ୍)` : '- ସୋଲାର ପ୍ୟାନେଲ୍: ଆବଶ୍ୟକ ନାହିଁ (No-Solar Inverter System)'}
${batt ? `- ସୁପାରିଶକୃତ ବ୍ୟାଟେରୀ ବ୍ୟାଙ୍କ: ${batt.opt1.ahRating}Ah @ ${inv.dcVoltage}V LiFePO4 (~${batt.opt1.usableKwh.toFixed(1)} kWh ଉପଯୋଗୀ)` : ''}

ଗୁରୁତ୍ତ୍ୱପୂର୍ଣ୍ଣ ନିର୍ଦ୍ଦେଶ:
- କୌଣସି Markdown Table ବ୍ୟବହାର କରନ୍ତୁ ନାହିଁ। କେବଳ ସ୍ପଷ୍ଟ ବୁଲେଟ୍ ପଏଣ୍ଟ (Bullet Points) ବ୍ୟବହାର କରନ୍ତୁ।
- ଉତ୍ତରଟି ଅଧାରୁ ନକାଟି ସମସ୍ତ ୫ଟି ଯାକ ବିଭାଗ ଶେଷ ପର୍ଯ୍ୟନ୍ତ ସମ୍ପୂର୍ଣ୍ଣ ଲେଖନ୍ତୁ (Never truncate or stop midway)।
- ସମ୍ପୂର୍ଣ୍ଣ ଶୁଦ୍ଧ ଓ ପ୍ରାକୃତିକ ଓଡ଼ିଆ ଭାଷାରେ (Pure Odia Script) ବୁଲେଟ୍ ପଏଣ୍ଟ ସହିତ ଉପସ୍ଥାପନ କରନ୍ତୁ:
  ୧. ସାଇଜିଂ ଓ ସଠିକତା ମୂଲ୍ୟାଙ୍କନ (Sizing Validation)
  ୨. ସମସ୍ତ ପ୍ରକାର ବ୍ୟାଟେରୀ ବିକଳ୍ପ ସୁପାରିଶ (Battery Type Comparison & Recommendations)
  ୩. ବାଲାନ୍ସ ଅଫ୍ ସିଷ୍ଟମ୍ (BOS) ଓ ବୈଦ୍ୟୁତିକ ସୁରକ୍ଷା (Balance of System & Protection)
  ୪. ଲୋଡ୍ ପରିଚାଳନା ଓ ବିଜୁଳି ସଞ୍ଚୟ ଟିପ୍ସ (Load Management & Energy Saving Tips)
  ୫. ମୁଖ୍ୟ ଇଞ୍ଜିନିୟରିଂ ସାରାଂଶ (Summary Advice)`;

    return prompt;
  }

  async askAiAdvisor(): Promise<void> {
    this.isAiLoading.set(true);
    this.aiError.set(null);
    this.aiCopied.set(false);

    try {
      const prompt = this.buildAiPrompt();
      const inv = this.inverter();
      const solar = this.solar();
      const batt = this.batteryOptions();
      const audit = this.audit();

      const requestBody = {
        prompt: prompt,
        architecture: this.architecture(),
        inverterKva: inv.sizedKva,
        solarKwp: solar.actualInstalledKwp,
        batteryAh: batt?.opt1?.ahRating || 200,
        batteryVolts: inv.dcVoltage,
        usableKwh: batt?.opt1?.usableKwh || 15.6,
        dailyKwh: audit.totalDailyKwh,
        continuousW: audit.continuousW,
        surgeW: audit.peakStartingSurgeW
      };

      const response = await fetch('/api/solar/ai-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const result = await response.json();
      if (result && result.success && result.response) {
        this.aiResponse.set(result.response);
      } else {
        this.aiResponse.set(this.generateCompleteOdiaAnalysis());
      }
    } catch (err: any) {
      console.warn('[AI Advisor] Server error, falling back to complete Odia analysis:', err);
      this.aiResponse.set(this.generateCompleteOdiaAnalysis());
    } finally {
      this.isAiLoading.set(false);
    }
  }

  copyAiResponse(): void {
    const text = this.aiResponse();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.aiCopied.set(true);
      setTimeout(() => this.aiCopied.set(false), 2500);
    });
  }

  generateCompleteOdiaAnalysis(): string {
    const inv = this.inverter();
    const solar = this.solar();
    const batt = this.batteryOptions();
    const audit = this.audit();
    const arch = this.architecture();

    const inverterStr = `${inv.sizedKva} kVA`;
    const solarStr = `${solar.actualInstalledKwp.toFixed(2)} kWp`;
    const batteryStr = batt ? `${batt.opt1.ahRating}Ah @ ${inv.dcVoltage}V` : 'N/A';
    const continuousStr = `${audit.continuousW} W`;
    const surgeStr = `${audit.peakStartingSurgeW} W`;
    const dailyKwhStr = `${audit.totalDailyKwh.toFixed(2)} kWh`;

    return `### ୧. ସାଇଜିଂ ଓ ସଠିକତା ମୂଲ୍ୟାଙ୍କନ (Sizing Validation)
- **ଇନଭର୍ଟର (${inverterStr})**: ଆପଣଙ୍କ ସର୍ବୋଚ୍ଚ କଣ୍ଟିନ୍ୟୁଅସ୍ ଲୋଡ୍ ${continuousStr} ଏବଂ ମୋଟର ଷ୍ଟାର୍ଟିଂ ସର୍ଜ୍ ${surgeStr} କୁ ସମ୍ଭାଳିବା ପାଇଁ ${inverterStr} ଏକ ଉପଯୁକ୍ତ ଓ ସନ୍ତୁଳିତ କ୍ଷମତା। ଏଥିରେ ୧୦୦% ରୁ ଅଧିକ ସର୍ଜ୍ ମାର୍ଜିନ୍ ରହିଛି, ଯାହା ଓଭର-ଲୋଡ୍ ଟ୍ରିପ୍ ହେବାକୁ ରୋକିବ।
${arch !== 'nobattery' ? `- **ସୋଲାର ପ୍ୟାନେଲ୍ (${solarStr})**: ଓଡ଼ିଶାର ବାର୍ଷିକ ହାରାହାରି ୪.୭୫ PSH (Peak Sun Hours) ଏବଂ ୧୫% ସେଫ୍ଟି ମାର୍ଜିନ୍ ଆଧାରରେ ${solarStr} (${solar.totalPanels} ଟି 550W Mono-PERC) କ୍ଷମତାର ପ୍ୟାନେଲ୍ ଦୈନିକ ${dailyKwhStr} ବିଜୁଳି ଉତ୍ପାଦନ କରିବା ସହିତ ଦିନର ଲୋଡ୍ ଚଳାଇ ବ୍ୟାଟେରୀକୁ ସମ୍ପୂର୍ଣ୍ଣ ଚାର୍ଜ୍ କରିବା ପାଇଁ ପର୍ଯ୍ୟାପ୍ତ।` : '- **ସୋଲାର ପ୍ୟାନେଲ୍**: ଆବଶ୍ୟକ ନାହିଁ (No-Solar Inverter System)।'}
${batt ? `- **ବ୍ୟାଟେରୀ ସାଇଜିଂ (${batteryStr})**: ରାତ୍ରି କାଳୀନ ବିଜୁଳି ଆବଶ୍ୟକତା ପାଇଁ ଏହି ଷ୍ଟୋରେଜ୍ ବ୍ୟାଙ୍କ ଉତ୍କୃଷ୍ଟ। ଏହା ବ୍ୟାଟେରୀର ଆୟୁଷ ରକ୍ଷା କରିବା ସହ ଖରାପ ପାଗ ପାଇଁ ସକାଳେ ମଧ୍ୟ ରିଜର୍ଭ ଚାର୍ଜ୍ ରଖିବ।` : ''}

### ୨. ସମସ୍ତ ପ୍ରକାର ବ୍ୟାଟେରୀ ବିକଳ୍ପ ସୁପାରିଶ (Battery Type Comparison & Recommendations)
- **ବିକଳ୍ପ ୧: Premium LiFePO4 (ଲିଥିୟମ୍ ଫେରୋ-ଫସଫେଟ୍ - ସର୍ବୋତ୍ତମ ସୁପାରିଶ)**:
  - **ବର୍ଣ୍ଣନା ଓ କ୍ଷମତା**: ୯୦% ଡେପ୍ଥ ଅଫ୍ ଡିସଚାର୍ଜ (DoD), ୪୦୦୦+ ଚାର୍ଜ୍ ସାଇକଲ୍, କମ୍ପାକ୍ଟ ୱାଲ୍-ମାଉଣ୍ଟ ଡିଜାଇନ୍।
  - **ଆୟୁଷ ଓ ରକ୍ଷଣାବେକ୍ଷଣ**: ୧୦ ରୁ ୧୨ ବର୍ଷର ଦୀର୍ଘ ଆୟୁଷ, ୧୦୦% ଶୂନ୍ୟ ରକ୍ଷଣାବେକ୍ଷଣ (Zero Maintenance), ବିପଦମୁକ୍ତ ଓ ସୁରକ୍ଷିତ।
  - **ଉପଯୁକ୍ତତା**: ଯେଉଁମାନେ ଦୀର୍ଘକାଳୀନ ନିର୍ଭରଯୋଗ୍ୟତା ଓ ଦ୍ରୁତ ଚାର୍ଜିଂ ଚାହାଁନ୍ତି ସେମାନଙ୍କ ପାଇଁ ଏହା ଏକ ନମ୍ବର ପସନ୍ଦ।
- **ବିକଳ୍ପ ୨: Maintenance-Free Solar Gel (ଜେଲ୍ ବ୍ୟାଟେରୀ - ମଧ୍ୟମ ବଜେଟ୍)**:
  - **ବର୍ଣ୍ଣନା ଓ କ୍ଷମତା**: ୭୫% DoD, ୧୮୦୦+ ସାଇକଲ୍, ସିଲ୍ଡ ଭଲ୍ଭ-ରେଗୁଲେଟେଡ୍ ଟେକ୍ନୋଲୋଜି।
  - **ଆୟୁଷ ଓ ରକ୍ଷଣାବେକ୍ଷଣ**: ୪ ରୁ ୫ ବର୍ଷ ଆୟୁଷ, ପାଣି ଦେବା ଆବଶ୍ୟକ ନାହିଁ, ଏସିଡ୍ ଧୂଆଁ ବାହାରେ ନାହିଁ।
  - **ଉପଯୁକ୍ତତା**: ଘର ଭିତରେ ବ୍ୟାଟେରୀ ରଖିବା ପାଇଁ ଏବଂ ପାଣି ଟପ୍-ଅପ୍ ରୁ ମୁକ୍ତି ଚାହୁଁଥିବା ଗ୍ରାହକଙ୍କ ପାଇଁ ଉତ୍ତମ।
- **ବିକଳ୍ପ ୩: C10 Tall Tubular Lead-Acid (ଟଲ୍ ଟ୍ୟୁବୁଲାର୍ - ସ୍ୱଳ୍ପ ପ୍ରାରମ୍ଭିକ ଖର୍ଚ୍ଚ)**:
  - **ବର୍ଣ୍ଣନା ଓ କ୍ଷମତା**: ୭୦% DoD ସୀମା, ୧୨୦୦–୧୫୦୦ ସାଇକଲ୍, ସବୁଠାରୁ କମ୍ ପ୍ରାରମ୍ଭିକ ଖର୍ଚ୍ଚ।
  - **ଆୟୁଷ ଓ ରକ୍ଷଣାବେକ୍ଷଣ**: ୩ ରୁ ୪ ବର୍ଷ ଆୟୁଷ, ପ୍ରତି ୨-୩ ମାସରେ ଡିଷ୍ଟିଲ୍ଡ ୱାଟର ଟପ୍-ଅପ୍ କରିବା ବାଧ୍ୟତାମୂଳକ।
  - **ଉପଯୁକ୍ତତା**: କମ୍ ବଜେଟ୍ ରେ ସୋଲାର ସିଷ୍ଟମ୍ ଆରମ୍ଭ କରିବା ପାଇଁ ଉପଯୋଗୀ।

### ୩. ବାଲାନ୍ସ ଅଫ୍ ସିଷ୍ଟମ୍ (BOS) ଓ ବୈଦ୍ୟୁତିକ ସୁରକ୍ଷା (Balance of System & Protection)
- **DCDB ସୁରକ୍ଷା**: ସୋଲାର ପ୍ୟାନେଲ୍ ଆରେ ପାଇଁ ୧୦୦୦V DC Type-2 SPD (Surge Protection Device), ୧୫A/୨୦A DC gPV ଫ୍ୟୁଜ୍ ଏବଂ ୨-ପୋଲ୍ DC MCB ସଂଯୋଗ କରନ୍ତୁ।
- **ACDB ସୁରକ୍ଷା**: ଗ୍ରିଡ୍ ଓ ଲୋଡ୍ ସାଇଡ୍ ପାଇଁ ଟାଇପ୍-୨ AC SPD, C-କର୍ଭ MCB/MCCB ଏବଂ ମାନବ ସୁରକ୍ଷା ପାଇଁ ୩୦mA RCCB (Residual Current Circuit Breaker) ବ୍ୟବହାର କରନ୍ତୁ।
- **କେବୁଲ୍ ମାନକ**: ସୋଲାର ପ୍ୟାନେଲ୍ ପାଇଁ ୪/୬ sq.mm UV-ରେଜିଷ୍ଟାଣ୍ଟ ତ୍ରିପୁଲ୍-କୋଟେଡ୍ କପର୍ DC କେବୁଲ୍, ବ୍ୟାଟେରୀ ପାଇଁ ୩୫–୭୦ sq.mm ସୁପର-ଫ୍ଲେକ୍ସିବଲ୍ କପର୍ କେବୁଲ୍ (କ୍ରିମ୍ପ୍ଡ ଲଗ୍ସ ସହିତ) ବ୍ୟବହାର କରନ୍ତୁ।
- **୩-ପିଟ୍ କେମିକାଲ୍ ଆର୍ଥିଂ ଓ ଲାଇଟନିଂ ଆରେଷ୍ଟର**: ଓଡ଼ିଶାର ବଜ୍ରପାତ ପ୍ରବଣତାକୁ ଦୃଷ୍ଟିରେ ରଖି ୩ଟି ସ୍ୱତନ୍ତ୍ର କେମିକାଲ୍ ଆର୍ଥିଂ ପିଟ୍ କରନ୍ତୁ (ପିଟ୍ ୧: ସୋଲାର ଷ୍ଟ୍ରକଚର, ପିଟ୍ ୨: ଇନଭର୍ଟର AC ନ୍ୟୁଟ୍ରାଲ୍ ଓ ବଡି, ପିଟ୍ ୩: କପର୍/ESE ଲାଇଟନିଂ ଆରେଷ୍ଟର)। ପ୍ରତ୍ୟେକ ପିଟ୍ ର ଆର୍ଥ ରେଜିଷ୍ଟାନ୍ସ ୨ ଓମ୍ ରୁ କମ୍ ରହିବା ବାଧ୍ୟତାମୂଳକ।

### ୪. ଲୋଡ୍ ପରିଚାଳନା ଓ ବିଜୁଳି ସଞ୍ଚୟ ଟିପ୍ସ (Load Management & Energy Saving Tips)
- **ଦିନ ବେଳା ସୂର୍ଯ୍ୟ କିରଣର ସଦୁପଯୋଗ (Daytime Shifting)**: ପାଣି ପମ୍ପ (Water Pump), ଇଣ୍ଡକ୍ସନ୍ କୁକର୍ (Induction Cooker), ରାଇସ୍ କୁକର୍ (Rice Cooker), ଏୟାର ଫ୍ରାୟର୍ (Air Fryer) ଏବଂ ୱାସିଂ ମେସିନ୍ କୁ ଦିନ ୧୦:୦୦ AM ରୁ ୩:୦୦ PM ମଧ୍ୟରେ ଚଲାନ୍ତୁ। ଏହାଦ୍ୱାରା ବ୍ୟାଟେରୀ ସାଇକଲ୍ ବଞ୍ଚିବ ଓ ୧୦୦% ମାଗଣା ସୌର ବିଦ୍ୟୁତ୍ ବ୍ୟବହାର ହେବ।
- **BLDC ପଙ୍ଖା ରୂପାନ୍ତରଣ (୬୦% ସଞ୍ଚୟ)**: ସାଧାରଣ ୭୫ ୱାଟ୍ ପଙ୍ଖା ବଦଳରେ ୨୮–୩୦ ୱାଟ୍ BLDC ଫ୍ୟାନ୍ ବ୍ୟବହାର କଲେ ୬୦% ବିଦ୍ୟୁତ୍ ବଞ୍ଚିବ ଏବଂ ରାତିରେ ବ୍ୟାଟେରୀ ବ୍ୟାକଅପ୍ ଅତିରିକ୍ତ ୨ ରୁ ୩ ଘଣ୍ଟା ବୃଦ୍ଧି ପାଇବ।
- **ଇନଭର୍ଟର ଏସି ତାପମାତ୍ରା ନିୟନ୍ତ୍ରଣ**: ଏୟାର କଣ୍ଡିସନର୍ କୁ ୨୪°C ରୁ ୨୬°C ରେ ଚଲାନ୍ତୁ। ପ୍ରତ୍ୟେକ ୧°C ବୃଦ୍ଧିରେ ପ୍ରାୟ ୬% ପାୱାର ସଞ୍ଚୟ ହୁଏ।
- **ମୋଟର ସର୍ଜ୍ ନିୟନ୍ତ୍ରଣ**: ପାଣି ପମ୍ପ ଚାଲିବା ସମୟରେ ଏକାସଙ୍ଗରେ ଇଣ୍ଡକ୍ସନ୍ କୁକର୍ କୁ ବ୍ୟାଟେରୀ ମୋଡ୍‌ରେ ଅନ୍ କରନ୍ତୁ ନାହିଁ।
- **ସକାଳ ରିଜର୍ଭ ଚାର୍ଜ୍ ସଂରକ୍ଷଣ**: ରାତି ବ୍ୟବହାର ପରେ ବ୍ୟାଟେରୀରେ ୩୫%–୪୫% ଚାର୍ଜ୍ ସଂରକ୍ଷିତ ରଖନ୍ତୁ, ଯାହା ବର୍ଷା ଓ ବାଦଲିଆ ପାଗରେ ନିରବଚ୍ଛିନ୍ନ ବିଜୁଳି ଯୋଗାଇବ।

### ୫. ମୁଖ୍ୟ ଇଞ୍ଜିନିୟରିଂ ସାରାଂଶ (Summary Advice)
- ପ୍ରସ୍ତାବିତ ସୋଲାର ସିଷ୍ଟମ୍ ଆପଣଙ୍କୁ ଆଗାମୀ ୨୫ ବର୍ଷ ପର୍ଯ୍ୟନ୍ତ ନିରବଚ୍ଛିନ୍ନ, ସ୍ୱଚ୍ଛ ଓ ମାଗଣା ବିଜୁଳି ପ୍ରଦାନ କରିବ। ସଠିକ୍ BOS ସୁରକ୍ଷା ଓ ଲୋଡ୍ ପରିଚାଳନା ଦ୍ୱାରା ବ୍ୟାଟେରୀ ଓ ଇନଭର୍ଟରର କାର୍ଯ୍ୟଦକ୍ଷତା ସର୍ବାଧିକ ରହିବ ଏବଂ ଏହା ଶକ୍ତି ସ୍ୱାଧୀନତା ସୁନିଶ୍ଚିତ କରିବ।`;
  }

  formatMarkdown(text: string): SafeHtml {
    if (!text) return '';

    // First, strip any dangling incomplete table row (e.g. "| LiFePO" or "|")
    let cleaned = text.replace(/\|\s*[A-Za-z0-9_\u0B00-\u0B7F\s]*$/g, '').trimEnd();

    // Check for markdown tables and format them
    const lines = cleaned.split('\n');
    const processedLines: string[] = [];
    let inTable = false;
    let tableHtml = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        // Check if separator line
        if (cells.every(c => /^[-:]+$/.test(c))) {
          continue; // skip separator line
        }

        if (!inTable) {
          inTable = true;
          tableHtml = '<div class="overflow-x-auto my-2 rounded-xl border border-sky-200 shadow-2xs"><table class="w-full text-xs text-left border-collapse bg-white"><thead class="bg-sky-50 text-sky-950 font-bold border-b border-sky-200"><tr>';
          cells.forEach(c => {
            tableHtml += `<th class="py-2 px-3">${c}</th>`;
          });
          tableHtml += '</tr></thead><tbody class="divide-y divide-slate-100">';
        } else {
          tableHtml += '<tr class="hover:bg-sky-50/50 transition">';
          cells.forEach(c => {
            tableHtml += `<td class="py-2 px-3 text-slate-700 font-medium">${c}</td>`;
          });
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          tableHtml += '</tbody></table></div>';
          processedLines.push(tableHtml);
          inTable = false;
          tableHtml = '';
        }
        processedLines.push(lines[i]);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table></div>';
      processedLines.push(tableHtml);
    }

    let html = processedLines.join('\n');

    html = html
      .replace(/^### (.*$)/gim, '<h4 class="text-sm font-black text-sky-950 mt-3.5 mb-1.5 flex items-center gap-1.5"><span class="w-1.5 h-3.5 bg-sky-600 rounded-full inline-block"></span>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="text-base font-black text-slate-900 mt-4 mb-2 flex items-center gap-2"><span class="w-2 h-4 bg-amber-500 rounded-full inline-block"></span>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="text-lg font-black text-slate-900 mt-4 mb-2">$1</h2>');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-slate-900">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="text-slate-700 italic">$1</em>');

    html = html.replace(/^\s{2,}[-*]\s+(.*$)/gim, '<li class="ml-8 list-circle text-xs text-slate-600 my-0.5 leading-relaxed">$1</li>');
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-xs text-slate-700 my-0.5 leading-relaxed">$1</li>');
    html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-xs text-slate-800 my-1 leading-relaxed font-bold"><span class="font-normal text-slate-800">$2</span></li>');

    html = html.replace(/\n\n/g, '<div class="h-2"></div>');
    html = html.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
