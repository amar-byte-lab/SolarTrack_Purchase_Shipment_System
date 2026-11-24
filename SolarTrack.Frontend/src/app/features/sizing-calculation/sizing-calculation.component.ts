import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavService } from '../../core/services/nav.service';

export interface ApplianceItem {
  id: string;
  slot: 'day' | 'night';
  name: string;
  qty: number;
  watt: number;
  surgeMult: number;
  simultaneous: boolean;
  hours: number;
  is3Phase?: boolean;
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

  // Sizing State Signals
  readonly architecture = signal<'offgrid' | 'hybrid' | 'ongrid' | 'nobattery'>('offgrid');
  readonly zeroGrid = signal<boolean>(true);
  readonly chargingWindow = signal<number>(6.0);
  readonly psh = signal<number>(4.75);
  readonly supplyPhase = signal<'auto' | 'single' | 'three'>('auto');
  readonly sanctionedLoad = signal<number>(10.0);
  readonly monthlyBill = signal<number>(6000);
  readonly monthlyUnits = signal<number>(1000);
  readonly panelWattage = signal<number>(580);
  readonly expansionMargin = signal<number>(15);
  readonly backupHours = signal<number>(4.0);

  readonly clientName = signal<string>('M/s Maa Sarada Enterprises');
  readonly siteLocation = signal<string>('Cuttack, Odisha');

  readonly showOdiaModal = signal<boolean>(false);
  readonly showEngModal = signal<boolean>(false);
  readonly isGeneratingPdf = signal<boolean>(false);

  readonly appliances = signal<ApplianceItem[]>([]);

  // Preset definitions
  readonly appliancePresets: Record<string, { name: string; qty: number; watt: number; surgeMult: number; simultaneous: boolean; dayHrs: number; nightHrs: number; is3Phase?: boolean }> = {
    led: { name: 'LED Bulb (10W)', qty: 10, watt: 10, surgeMult: 1.0, simultaneous: true, dayHrs: 3, nightHrs: 6 },
    fan_normal: { name: 'Normal Ceiling Fan (75W)', qty: 4, watt: 75, surgeMult: 1.2, simultaneous: true, dayHrs: 5, nightHrs: 8 },
    fan_bldc: { name: 'BLDC Ceiling Fan (30W)', qty: 4, watt: 30, surgeMult: 1.0, simultaneous: true, dayHrs: 5, nightHrs: 8 },
    desktop: { name: 'Desktop Computer (200W)', qty: 1, watt: 200, surgeMult: 1.2, simultaneous: true, dayHrs: 6, nightHrs: 1 },
    laptop: { name: 'Laptop (65W)', qty: 2, watt: 65, surgeMult: 1.0, simultaneous: true, dayHrs: 6, nightHrs: 2 },
    tv: { name: 'TV / Wi-Fi (80W)', qty: 1, watt: 80, surgeMult: 1.0, simultaneous: true, dayHrs: 4, nightHrs: 5 },
    fridge: { name: 'Refrigerator (150W, 450W surge)', qty: 1, watt: 150, surgeMult: 3.0, simultaneous: true, dayHrs: 7, nightHrs: 15 },
    pump_1hp: { name: '1 HP Water Pump (850W, 2,200W surge)', qty: 1, watt: 850, surgeMult: 2.59, simultaneous: true, dayHrs: 1.5, nightHrs: 0 },
    pump_2hp: { name: '2 HP Pump (1,600W, 4,200W surge)', qty: 1, watt: 1600, surgeMult: 2.625, simultaneous: false, dayHrs: 2, nightHrs: 0 },
    pump_3hp_3p: { name: '3 HP 3-Phase Pump (2,400W, 6,000W surge)', qty: 1, watt: 2400, surgeMult: 2.5, simultaneous: false, dayHrs: 3, nightHrs: 0, is3Phase: true },
    pump_5hp_3p: { name: '5 HP 3-Phase Pump (3,800W, 9,500W surge)', qty: 1, watt: 3800, surgeMult: 2.5, simultaneous: false, dayHrs: 4, nightHrs: 0, is3Phase: true },
    ac_1_5t: { name: '1.5 Ton Inverter AC (1,500W, 2,400W surge)', qty: 1, watt: 1500, surgeMult: 1.6, simultaneous: true, dayHrs: 3, nightHrs: 5 },
    ac_2t: { name: '2 Ton Inverter AC (2,000W, 3,200W surge)', qty: 1, watt: 2000, surgeMult: 1.6, simultaneous: false, dayHrs: 4, nightHrs: 6 }
  };

  readonly standardKvaRatings = [1, 2, 3, 3.5, 5, 6, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

  ngOnInit(): void {
    this.navService.setPageTitle('Sizing Calculation');
    this.loadTemplate('residential_3bhk');
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

    let isThreePhase = false;
    const sp = this.supplyPhase();
    if (sp === 'three') {
      isThreePhase = true;
    } else if (sp === 'single') {
      isThreePhase = false;
    } else {
      isThreePhase = a.has3PhaseAppliance || sizedKva >= 15;
    }

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

    const installedKwp = (totalPanels * panelW) / 1000;
    const dcAcRatio = inv.sizedKva > 0 ? (installedKwp / (inv.sizedKva * 0.8)) : 1.0;
    const stringVoc = seriesPanels * 51.0;
    const stringVmp = seriesPanels * 42.5;
    const solarAreaSqFt = Math.round(totalPanels * 27.5);

    const exceedsSanctioned = installedKwp > this.sanctionedLoad();

    return {
      requiredKwp,
      installedKwp,
      totalPanels,
      panelW,
      seriesPanels,
      parallelStrings,
      dcAcRatio,
      stringVoc,
      stringVmp,
      solarAreaSqFt,
      exceedsSanctioned
    };
  });

  // Battery Bank Options
  readonly battery = computed(() => {
    const a = this.audit();
    const inv = this.inverter();
    const requiredAcBackupKwh = a.nightKwh;
    const invEff = 0.90;

    // Option 1: Premium LiFePO4
    const opt1TargetAc = requiredAcBackupKwh * 1.45;
    const opt1DcKwh = opt1TargetAc / (0.90 * invEff);
    const opt1Ah = (opt1DcKwh * 1000) / inv.dcVoltage;
    let opt1ConfigText = "";
    if (inv.dcVoltage >= 240) {
      const racksCount = Math.max(1, Math.ceil(opt1DcKwh / 15));
      opt1ConfigText = `${racksCount} × 15 kWh High-Voltage LiFePO4 Rack ESS (${(racksCount * 15).toFixed(0)} kWh Total)`;
    } else {
      const roundedAh = Math.ceil(opt1Ah / 50) * 50;
      opt1ConfigText = `${inv.dcVoltage}V ${roundedAh}Ah Lithium Pack`;
    }

    // Option 2: Standard LiFePO4
    const opt2TargetAc = requiredAcBackupKwh * 1.15;
    const opt2DcKwh = opt2TargetAc / (0.90 * invEff);
    const opt2Ah = (opt2DcKwh * 1000) / inv.dcVoltage;
    let opt2ConfigText = "";
    if (inv.dcVoltage >= 240) {
      const racksCount = Math.max(1, Math.ceil(opt2DcKwh / 10));
      opt2ConfigText = `${racksCount} × 10 kWh High-Voltage LiFePO4 Rack ESS`;
    } else {
      const roundedAh = Math.ceil(opt2Ah / 50) * 50;
      opt2ConfigText = `${inv.dcVoltage}V ${roundedAh}Ah Economy Pack`;
    }

    // Option 3: C10 Tall Tubular Lead-Acid
    const opt3TargetAc = requiredAcBackupKwh * 1.25;
    const opt3DcKwh = opt3TargetAc / (0.70 * invEff);
    const opt3AhReq = (opt3DcKwh * 1000) / inv.dcVoltage;
    const seriesLeadAcidCount = Math.round(inv.dcVoltage / 12);
    let batAhRating = 200;
    if (opt3AhReq <= 160) batAhRating = 150;
    else if (opt3AhReq <= 220) batAhRating = 200;
    else batAhRating = 250;

    const parallelLeadAcidCount = Math.max(1, Math.ceil(opt3AhReq / batAhRating));
    const totalLeadAcidCount = seriesLeadAcidCount * parallelLeadAcidCount;
    const opt3ConfigText = `${seriesLeadAcidCount}S × ${parallelLeadAcidCount}P (${totalLeadAcidCount} × 12V ${batAhRating}Ah C10)`;

    // Charger Amps
    const reqChargerAmps = Math.round(opt1Ah / this.chargingWindow());

    return {
      requiredAcBackupKwh,
      opt1DcKwh,
      opt1TargetAc,
      opt1ConfigText,
      opt2DcKwh,
      opt2TargetAc,
      opt2ConfigText,
      opt3DcKwh,
      opt3TargetAc,
      opt3ConfigText,
      totalLeadAcidCount,
      batAhRating,
      reqChargerAmps
    };
  });

  // Balance of System (BOS) Checklist
  readonly bos = computed(() => {
    const s = this.solar();
    const inv = this.inverter();
    const a = this.audit();

    const isStringVocHigh = s.stringVoc > 550;
    const bosDcSpd = isStringVocHigh ? "1000V Type-2 DC SPD" : "600V Type-2 DC SPD";
    const bosDcFuse = (s.parallelStrings > 1) ? "20A 1000V gPV Fuse" : "15A 1000V gPV Fuse";
    const bosAcSpd = inv.isThreePhase ? "Type-2 440V (4P) AC SPD" : "Type-2 275V (2P) AC SPD";

    const breakerRating = Math.ceil(inv.acOutputCurrent * 1.25);
    const standardBreakers = [16, 25, 32, 40, 63, 80, 100, 125, 160, 200, 250];
    const snappedMcb = standardBreakers.find(b => b >= breakerRating) || 250;
    const bosAcMcb = `${snappedMcb}A ${inv.isThreePhase ? '4-Pole' : '2-Pole'} ${snappedMcb > 63 ? 'MCCB' : 'MCB'}`;

    const bosPvCable = (s.parallelStrings >= 3 || s.installedKwp >= 15) ? "6 sq.mm Solar DC Cable" : "4 sq.mm Solar DC Cable";

    const maxDcDischargeCurrent = a.continuousW / (inv.dcVoltage * 0.90);
    let bosBatCable = "25 sq.mm Cu";
    if (maxDcDischargeCurrent > 250) bosBatCable = "95 sq.mm Cu (or 2×50)";
    else if (maxDcDischargeCurrent > 180) bosBatCable = "70 sq.mm Cu";
    else if (maxDcDischargeCurrent > 120) bosBatCable = "50 sq.mm Cu";
    else if (maxDcDischargeCurrent > 60) bosBatCable = "35 sq.mm Cu";
    else bosBatCable = "25 sq.mm Cu";

    let bosAcCable = "6 sq.mm 3-Core";
    if (inv.acOutputCurrent > 120) bosAcCable = "50 sq.mm 4-Core XLPE";
    else if (inv.acOutputCurrent > 80) bosAcCable = "35 sq.mm 4-Core";
    else if (inv.acOutputCurrent > 50) bosAcCable = "25 sq.mm 4-Core";
    else if (inv.acOutputCurrent > 32) bosAcCable = "16 sq.mm Copper";
    else if (inv.acOutputCurrent > 20) bosAcCable = "10 sq.mm Copper";
    else bosAcCable = inv.isThreePhase ? "6 sq.mm 4-Core" : "6 sq.mm 3-Core";

    return {
      bosDcSpd,
      bosDcFuse,
      bosAcSpd,
      bosAcMcb,
      bosPvCable,
      bosBatCable,
      bosAcCable
    };
  });

  // BLDC Fan Smart Insights
  readonly bldcInsight = computed(() => {
    const a = this.audit();
    if (a.countNormalFans > 0) {
      const annualUnits = Math.round(a.normalFanDailyKwh * 365);
      const savedBatteryKwh = (a.normalFanDailyKwh * 1.45 / 0.81).toFixed(1);
      const savedBatteryInr = Math.round(parseFloat(savedBatteryKwh) * 14000);
      return {
        hasFans: true,
        count: a.countNormalFans,
        dailyKwh: a.normalFanDailyKwh.toFixed(2),
        annualUnits,
        savedBatteryKwh,
        savedBatteryInr: savedBatteryInr.toLocaleString()
      };
    }
    return { hasFans: false };
  });

  // Architecture Names Helper
  get archName(): string {
    const a = this.architecture();
    if (a === 'offgrid') return 'Off-Grid Solar';
    if (a === 'hybrid') return 'Hybrid Solar';
    if (a === 'ongrid') return 'On-Grid Solar';
    return 'Inverter-Battery Only';
  }

  get archNameOdia(): string {
    const a = this.architecture();
    if (a === 'offgrid') return 'ଅଫ୍-ଗ୍ରୀଡ୍ ସୋଲାର୍ (Off-Grid)';
    if (a === 'hybrid') return 'ହାଇବ୍ରିଡ୍ ସୋଲାର୍ (Hybrid Net-Meter)';
    if (a === 'ongrid') return 'ଅନ୍-ଗ୍ରୀଡ୍ ସୋଲାର୍ (On-Grid)';
    return 'ଇନଭର୍ଟର-ବ୍ୟାଟେରୀ (Without Solar)';
  }

  get todayFormatted(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  // Mutator Actions
  setArchitecture(arch: 'offgrid' | 'hybrid' | 'ongrid' | 'nobattery'): void {
    this.architecture.set(arch);
  }

  setZeroGrid(val: boolean): void {
    this.zeroGrid.set(val);
  }

  updateChargingWindow(val: any): void {
    this.chargingWindow.set(parseFloat(val));
  }

  updatePSH(val: any): void {
    this.psh.set(parseFloat(val));
  }

  updateBackupHours(val: any): void {
    this.backupHours.set(parseFloat(val));
  }

  setMargin(val: number): void {
    this.expansionMargin.set(val);
  }

  syncUnitsFromBill(bill: any): void {
    const b = parseFloat(bill) || 0;
    this.monthlyBill.set(b);
    this.monthlyUnits.set(Math.round(b / 6.0));
  }

  syncBillFromUnits(units: any): void {
    const u = parseFloat(units) || 0;
    this.monthlyUnits.set(u);
    this.monthlyBill.set(Math.round(u * 6.0));
  }

  quickAddAppliance(key: string): void {
    const preset = this.appliancePresets[key];
    if (!preset) return;

    this.appliances.update(arr => {
      const next = [...arr];
      if (preset.dayHrs > 0) {
        next.push({
          id: Date.now() + Math.random().toString(36).substr(2, 4),
          slot: 'day',
          name: preset.name,
          qty: preset.qty,
          watt: preset.watt,
          surgeMult: preset.surgeMult,
          simultaneous: preset.simultaneous,
          hours: preset.dayHrs,
          is3Phase: preset.is3Phase
        });
      }
      if (preset.nightHrs > 0) {
        next.push({
          id: Date.now() + Math.random().toString(36).substr(2, 4) + 'n',
          slot: 'night',
          name: preset.name,
          qty: preset.qty,
          watt: preset.watt,
          surgeMult: preset.surgeMult,
          simultaneous: preset.simultaneous,
          hours: preset.nightHrs,
          is3Phase: preset.is3Phase
        });
      }
      return next;
    });
  }

  addApplianceToSlot(slot: 'day' | 'night'): void {
    const name = prompt(`Enter ${slot === 'day' ? 'Daytime' : 'Nighttime'} Appliance Name:`, slot === 'day' ? 'Workshop Motor / Tool' : 'Security Light / Fan');
    if (!name) return;
    const watt = parseFloat(prompt("Enter Running Wattage (W):", "500") || '500') || 500;
    const surge = parseFloat(prompt("Enter Starting Surge Multiplier (1.0 for electronic, 2.5 for inductive motor):", "1.0") || '1.0') || 1.0;
    const defaultHrs = slot === 'day' ? 4 : 6;

    this.appliances.update(arr => [
      ...arr,
      {
        id: Date.now() + Math.random().toString(36).substr(2, 4),
        slot: slot,
        name: name,
        qty: 1,
        watt: watt,
        surgeMult: surge,
        simultaneous: true,
        hours: defaultHrs,
        is3Phase: false
      }
    ]);
  }

  promptCustomAppliance(): void {
    const slot = confirm("Click OK to add to Daytime (Direct Solar), or CANCEL to add to Nighttime (Battery Backup)") ? 'day' : 'night';
    this.addApplianceToSlot(slot);
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

  loadTemplate(tpl: string): void {
    if (tpl === 'residential_3bhk') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: 'LED Bulbs (10W)', qty: 6, watt: 10, surgeMult: 1.0, simultaneous: true, hours: 4 },
        { id: 'd2', slot: 'day', name: 'Normal Ceiling Fan (75W)', qty: 3, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 6 },
        { id: 'd3', slot: 'day', name: '1 HP Water Pump (850W, 2,200W surge)', qty: 1, watt: 850, surgeMult: 2.59, simultaneous: true, hours: 1.5 },
        { id: 'd4', slot: 'day', name: 'Refrigerator (150W, 450W surge)', qty: 1, watt: 150, surgeMult: 3.0, simultaneous: true, hours: 7 },
        { id: 'd5', slot: 'day', name: 'TV / Wi-Fi (80W)', qty: 1, watt: 80, surgeMult: 1.0, simultaneous: true, hours: 4 },
        { id: 'n1', slot: 'night', name: 'LED Bulbs (10W)', qty: 10, watt: 10, surgeMult: 1.0, simultaneous: true, hours: 6 },
        { id: 'n2', slot: 'night', name: 'Normal Ceiling Fan (75W)', qty: 4, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 8 },
        { id: 'n3', slot: 'night', name: 'Refrigerator (150W, 450W surge)', qty: 1, watt: 150, surgeMult: 3.0, simultaneous: true, hours: 15 },
        { id: 'n4', slot: 'night', name: '1.5 Ton Inverter AC', qty: 1, watt: 1500, surgeMult: 1.6, simultaneous: true, hours: 5 }
      ]);
    } else if (tpl === 'office_clinic') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: 'LED Tube Lights (20W)', qty: 15, watt: 20, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'd2', slot: 'day', name: 'Desktop Computers (200W)', qty: 6, watt: 200, surgeMult: 1.2, simultaneous: true, hours: 7 },
        { id: 'd3', slot: 'day', name: 'BLDC Ceiling Fans (30W)', qty: 6, watt: 30, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'd4', slot: 'day', name: '1.5 Ton Inverter AC', qty: 2, watt: 1500, surgeMult: 1.6, simultaneous: true, hours: 6 },
        { id: 'd5', slot: 'day', name: 'Water Dispenser & Refrigerator', qty: 1, watt: 250, surgeMult: 2.5, simultaneous: true, hours: 7 },
        { id: 'n1', slot: 'night', name: 'Security Lights (15W)', qty: 4, watt: 15, surgeMult: 1.0, simultaneous: true, hours: 12 },
        { id: 'n2', slot: 'night', name: 'CCTV Server & Router', qty: 1, watt: 120, surgeMult: 1.0, simultaneous: true, hours: 17 }
      ]);
    } else if (tpl === 'solar_pump') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: '3 HP 3-Phase Solar Agri Pump', qty: 1, watt: 2400, surgeMult: 2.5, simultaneous: true, hours: 6, is3Phase: true },
        { id: 'd2', slot: 'day', name: 'Farmhouse Fans & Lights', qty: 4, watt: 40, surgeMult: 1.0, simultaneous: true, hours: 5 },
        { id: 'n1', slot: 'night', name: 'Security LED Floodlights (50W)', qty: 2, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 10 },
        { id: 'n2', slot: 'night', name: 'Farmhouse Fan (75W)', qty: 2, watt: 75, surgeMult: 1.2, simultaneous: true, hours: 8 }
      ]);
    } else if (tpl === 'commercial_mill') {
      this.appliances.set([
        { id: 'd1', slot: 'day', name: '5 HP 3-Phase Flour Mill / Grinder', qty: 2, watt: 3800, surgeMult: 2.5, simultaneous: true, hours: 6, is3Phase: true },
        { id: 'd2', slot: 'day', name: '2 HP Single-Phase Oil Expeller', qty: 1, watt: 1600, surgeMult: 2.6, simultaneous: true, hours: 5 },
        { id: 'd3', slot: 'day', name: 'High-Bay Commercial LED (50W)', qty: 8, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 7 },
        { id: 'n1', slot: 'night', name: 'Perimeter Security Lights (50W)', qty: 6, watt: 50, surgeMult: 1.0, simultaneous: true, hours: 12 },
        { id: 'n2', slot: 'night', name: 'Office CCTV & Night Guard Fans', qty: 2, watt: 120, surgeMult: 1.0, simultaneous: true, hours: 12 }
      ]);
    }
  }

  resetDefaults(): void {
    this.architecture.set('offgrid');
    this.zeroGrid.set(true);
    this.chargingWindow.set(6.0);
    this.psh.set(4.75);
    this.supplyPhase.set('auto');
    this.sanctionedLoad.set(10.0);
    this.monthlyBill.set(6000);
    this.monthlyUnits.set(1000);
    this.panelWattage.set(580);
    this.expansionMargin.set(15);
    this.loadTemplate('residential_3bhk');
  }

  // Modals
  openOdiaModal(): void {
    this.showOdiaModal.set(true);
  }

  closeOdiaModal(): void {
    this.showOdiaModal.set(false);
  }

  openEngModal(): void {
    this.showEngModal.set(true);
  }

  closeEngModal(): void {
    this.showEngModal.set(false);
  }

  downloadOdiaPdf(): void {
    this.isGeneratingPdf.set(true);
    const element = document.getElementById('odiaSheetModal');
    if (!element || typeof html2pdf === 'undefined') {
      this.printOdiaPdf();
      this.isGeneratingPdf.set(false);
      return;
    }

    const opt = {
      margin: [0, 0, 0, 0],
      filename: `Shri_Trutiyadev_Solar_1Page_Odia_Proposal_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      this.isGeneratingPdf.set(false);
    }).catch((err: any) => {
      console.error(err);
      this.isGeneratingPdf.set(false);
      this.printOdiaPdf();
    });
  }

  printOdiaPdf(): void {
    const sheet = document.getElementById('odiaSheetModal');
    const container = document.getElementById('printContainerAng');
    if (sheet && container) {
      container.innerHTML = sheet.outerHTML;
      window.print();
    }
  }

  downloadEngPdf(): void {
    this.isGeneratingPdf.set(true);
    const element = document.getElementById('engSheetModal');
    if (!element || typeof html2pdf === 'undefined') {
      this.printEngPdf();
      this.isGeneratingPdf.set(false);
      return;
    }

    const opt = {
      margin: [0, 0, 0, 0],
      filename: `Shri_Trutiyadev_Solar_Technical_Engineering_Proposal_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      this.isGeneratingPdf.set(false);
    }).catch((err: any) => {
      console.error(err);
      this.isGeneratingPdf.set(false);
      this.printEngPdf();
    });
  }

  printEngPdf(): void {
    const sheet = document.getElementById('engSheetModal');
    const container = document.getElementById('printContainerAng');
    if (sheet && container) {
      container.innerHTML = sheet.outerHTML;
      window.print();
    }
  }
}
