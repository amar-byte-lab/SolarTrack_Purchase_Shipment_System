import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorService } from '../../services/calculator.service';
import { ApplianceItem } from '../../models/calculator.model';
import { StandardLoadCalc, CalcParams, CalcResult } from '../../services/standard-load-calc.helper';

@Component({
  selector: 'app-appliance-load-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appliance-load-manager.component.html',
  styleUrls: ['./appliance-load-manager.component.scss']
})
export class ApplianceLoadManagerComponent {
  readonly calc = inject(CalculatorService);

  // Modals state
  readonly showApplianceModal = signal<boolean>(false);
  readonly showBackupModal = signal<boolean>(false);
  readonly showStandardMasterModal = signal<boolean>(false);
  readonly showSpecsChildModal = signal<boolean>(false);

  // Technical specs accordion state (at a time only one section open)
  readonly expandedAppId = signal<string | null>(null);

  // Local working copy for editing
  readonly localAppliances = signal<ApplianceItem[]>([]);

  // Selected appliance for technical specs modal
  readonly currentSpecsApp = signal<ApplianceItem | null>(null);
  readonly childSpecsResult = signal<CalcResult | null>(null);

  readonly currentCategory = computed(() => {
    const app = this.currentSpecsApp();
    return this.getAppTypeCategory(app?.id || '', app?.name || '');
  });

  // Custom appliance adder form
  newAppName = '';
  newAppQty = 1;
  newAppWatts = 100;
  newAppHours = 4;

  // Technical specs calculation parameters
  specParams: CalcParams = {};

  readonly checkedAppliances = computed(() => {
    return this.calc.appliances().filter(a => a.checked && Number(a.defaultQty) > 0);
  });

  readonly backupAppliances = computed(() => {
    return this.calc.appliances().filter(a => a.checked && Number(a.defaultQty) > 0 && a.isBackup !== false);
  });

  readonly isBackupOnlyBasis = computed(() => {
    const sys = this.calc.systemType();
    return sys === 'off-grid' || sys === 'without-solar';
  });

  readonly sizingBasisTitle = computed(() => {
    const sys = this.calc.systemType();
    if (sys === 'off-grid') return 'Backup Duration (Off-Grid Solar & Battery)';
    if (sys === 'without-solar') return 'Backup Duration (Home UPS Inverter & Battery)';
    if (sys === 'hybrid') return 'Solar Sizing Basis (Monthly Units / Load)';
    return 'Sizing Calculation Basis';
  });

  getAppTypeCategory(appId: string, appName: string = ''): string {
    const id = String(appId || '').toLowerCase();
    const name = String(appName || '').toLowerCase();
    if (id === 'tv' || name.includes('tv') || name.includes('television')) return 'tv';
    if (id === 'fridge' || name.includes('fridge') || name.includes('refrigerator')) return 'fridge';
    if (id === 'comp' || name.includes('computer') || name.includes('laptop') || name.includes('pc')) return 'comp';
    if (id === 'wm' || name.includes('washing') || name.includes('washer')) return 'wm';
    if (id === 'geyser' || name.includes('geyser') || name.includes('water heater')) return 'geyser';
    if (id === 'iron' || name.includes('iron')) return 'iron';
    if (id === 'induction' || name.includes('induction') || name.includes('cooker')) return 'induction';
    if (id === 'ac' || name.includes('ac') || name.includes('air conditioner') || name.includes('cooler')) return 'ac';
    if (id === 'pump' || name.includes('pump') || name.includes('motor')) return 'pump';
    if (id === 'led' || name.includes('light') || name.includes('led') || name.includes('tube')) return 'led';
    if (id === 'fan' || name.includes('fan')) return 'fan';
    return 'other';
  }

  getCategoryBadgeTitle(cat: string): string {
    return `${cat.toUpperCase()} Technical Specs`;
  }

  getBadgeTextForApp(cat: string): string {
    const map: Record<string, string> = {
      tv: 'Display Matrix & Luminance Model',
      fridge: 'BEE 24-hr Cyclic Average Model',
      comp: 'TDP & Duty Scaled Model',
      wm: 'Per-Cycle Mechanical Energy Model',
      geyser: 'Specific Heat ΔT × Litres Model',
      iron: 'Thermostat Duty-Cycle Model',
      induction: 'Power Modulation Model',
      ac: 'BEE ISEER Inverter Model',
      pump: 'Hydraulic HP × 746 / η Formula',
      led: 'Solid State Lighting Rating',
      fan: 'Induction / BLDC Model',
      other: 'Configurable Standard'
    };
    return map[cat] || 'Standard Electrical Model';
  }

  getDefaultCalcParams(app: ApplianceItem, forcePristine: boolean = false): CalcParams {
    if (!forcePristine && app.calcParams) {
      return JSON.parse(JSON.stringify(app.calcParams));
    }

    const cat = this.getAppTypeCategory(app.id, app.name);
    const defHours = Number(app.defaultHours) || 4;

    switch (cat) {
      case 'tv':
        return {
          screenSize: '43',
          displayType: 'led',
          resolution: '4k',
          brightness: 'standard',
          hdr: 'off',
          dailyHours: defHours || 4,
          manualWatts: ''
        };
      case 'fridge':
        return {
          capacityL: 240,
          doorType: 'double',
          starRating: 3,
          compressorType: 'inverter',
          ambientTemp: 'normal',
          usageCondition: 'normal',
          manufacturerKwhDay: '',
          dailyHours: 24
        };
      case 'comp':
        return {
          deviceType: 'laptop',
          gpuType: 'integrated',
          monitorCount: 0,
          intensity: 'moderate',
          dailyHours: defHours || 6,
          manualWatts: ''
        };
      case 'wm':
        return {
          wmType: 'topLoad',
          capacityKg: 7,
          waterHeater: 'disabled',
          program: 'normal',
          cyclesPerDay: 1,
          cycleDurationMin: 45,
          manufacturerKwhCycle: '',
          dailyHours: defHours || 1
        };
      case 'geyser':
        return {
          ratedWatts: Number(app.watts) || 2000,
          capacityL: 15,
          sessionsPerDay: 1,
          sessionDurationMin: 20,
          standbyLoss: 'switchedOff',
          dailyHours: defHours || 1
        };
      case 'iron':
        return {
          ironType: 'dry',
          ratedWatts: Number(app.watts) || 1000,
          thermostatDuty: 'medium',
          sessionDurationMin: 30,
          daysPerWeek: 7,
          dailyHours: defHours || 0.5
        };
      case 'induction':
        return {
          ratedWatts: Number(app.watts) || 2000,
          powerLevel: 'mixed',
          sessionsPerDay: 2,
          durationPerSessionMin: 30,
          dailyHours: defHours || 2
        };
      case 'ac':
        return {
          ton: this.calc.acConfig().ton || '1.5',
          starRating: '3',
          technology: this.calc.acConfig().acType || 'inverter',
          ambientTemp: 'normal',
          setpoint: '24',
          roomSize: 'medium',
          insulation: 'average',
          dailyHours: defHours || 8,
          manualWatts: this.calc.acConfig().actualWatts || ''
        };
      case 'pump':
        return {
          motorHp: this.calc.pumpConfig().pumpHp || '1',
          pumpType: 'monoblock',
          motorEfficiency: 70,
          totalHeadM: 25,
          dailyHours: defHours || 1,
          manualWatts: ''
        };
      case 'led':
        return {
          bulbWatts: Number(app.watts) || 10,
          dailyHours: defHours || 14
        };
      case 'fan':
        return {
          fanType: 'induction',
          speed: 'medium',
          dailyHours: defHours || 14
        };
      default:
        return {
          appName: app.name || 'Other Load',
          ratedWatts: Number(app.watts) || 100,
          operatingWatts: Number(app.watts) || 100,
          dailyHours: defHours || 4,
          daysPerWeek: 7
        };
    }
  }

  // Open / Close Appliance Config Modal
  openApplianceModal(targetAppId?: string) {
    this.localAppliances.set(JSON.parse(JSON.stringify(this.calc.appliances())));
    this.showApplianceModal.set(true);
  }

  closeApplianceModal() {
    this.calc.appliances.set(JSON.parse(JSON.stringify(this.localAppliances())));
    this.showApplianceModal.set(false);
  }

  // Open / Close Backup Modal
  openBackupModal(targetAppId?: string) {
    this.localAppliances.set(JSON.parse(JSON.stringify(this.calc.appliances())));
    this.showBackupModal.set(true);
  }

  closeBackupModal() {
    this.calc.appliances.set(JSON.parse(JSON.stringify(this.localAppliances())));
    this.showBackupModal.set(false);
  }

  // Open / Close Standard Load Master Modal (Screenshot 1)
  openStandardLoadModal() {
    this.localAppliances.set(JSON.parse(JSON.stringify(this.calc.appliances())));
    this.expandedAppId.set(null);
    this.currentSpecsApp.set(null);
    this.showStandardMasterModal.set(true);
  }

  closeStandardMasterModal() {
    this.calc.appliances.set(JSON.parse(JSON.stringify(this.localAppliances())));
    this.expandedAppId.set(null);
    this.currentSpecsApp.set(null);
    this.showStandardMasterModal.set(false);
  }

  // Toggle specs accordion (only one section can be open at a time)
  toggleAccordion(app: ApplianceItem) {
    if (this.expandedAppId() === app.id) {
      this.closeSpecsAccordion();
    } else {
      this.openSpecsForApp(app);
    }
  }

  // Open Child Specs in Accordion (only one section open at a time)
  openSpecsForApp(app: ApplianceItem) {
    if (this.expandedAppId() === app.id) {
      this.closeSpecsAccordion();
      return;
    }
    this.currentSpecsApp.set(app);
    this.specParams = this.getDefaultCalcParams(app);
    this.recalcChildSpecs();
    this.expandedAppId.set(app.id);
    this.showSpecsChildModal.set(false);
  }

  closeSpecsAccordion() {
    this.expandedAppId.set(null);
    this.currentSpecsApp.set(null);
    this.showSpecsChildModal.set(false);
  }

  closeSpecsChildModal() {
    this.closeSpecsAccordion();
  }

  onCalcParamChange(key: string, value: any) {
    this.specParams[key] = value;
    if (key === 'ironType') {
      this.specParams['ratedWatts'] = value === 'steam' ? 1600 : 1000;
    } else if (key === 'wmType') {
      this.specParams['cycleDurationMin'] = value === 'frontLoad' ? 60 : 45;
    }
    this.recalcChildSpecs();
  }

  recalcChildSpecs() {
    const app = this.currentSpecsApp();
    if (!app) return;
    const res = StandardLoadCalc.calculate(app.id, app.name, this.specParams);
    this.childSpecsResult.set(res);
  }

  applyChildSpecsCalculation() {
    const res = this.childSpecsResult();
    const app = this.currentSpecsApp();
    if (!res || !app) return;

    this.localAppliances.update(list => list.map(a => {
      if (a.id === app.id) {
        return {
          ...a,
          watts: res.averageWatts,
          ratedWatts: res.ratedWatts,
          defaultHours: res.dailyHours,
          isCalculated: true,
          calcParams: JSON.parse(JSON.stringify(this.specParams)),
          calcResult: JSON.parse(JSON.stringify(res))
        };
      }
      return a;
    }));

    // If AC or Pump, update heavy load configs too
    if (app.id === 'ac') {
      const tonVal = String(this.specParams['ton'] || '1.5');
      const acTypeVal = this.specParams['technology'] === 'nonInverter' ? 'non-inverter' : 'inverter';
      this.calc.acConfig.update(c => ({
        ...c,
        ton: tonVal,
        acType: acTypeVal,
        actualWatts: res.averageWatts
      }));
    } else if (app.id === 'pump') {
      const hpVal = String(this.specParams['motorHp'] || '1');
      this.calc.pumpConfig.update(c => ({
        ...c,
        pumpHp: hpVal
      }));
    }

    this.closeSpecsAccordion();
  }

  getAppPresetSummary(app: ApplianceItem): string {
    const cat = this.getAppTypeCategory(app.id, app.name);
    const p = app.calcParams;

    if (app.isCalculated && p) {
      switch (cat) {
        case 'tv':
          return `${p['screenSize']}" ${String(p['displayType'] || 'LED').toUpperCase()} TV`;
        case 'fan':
          return p['fanType'] === 'bldc' ? 'BLDC Energy Saver (28-35W)' : 'Standard Induction (70-75W)';
        case 'fridge':
          return `${p['capacityL'] || 240}L ${p['starRating'] || 3}-Star Refrigerator`;
        case 'comp':
          return p['deviceType'] === 'laptop' ? 'Laptop Notebook (~65W)' : 'Desktop Workstation';
        case 'wm':
          return `${p['wmType'] === 'frontLoad' ? 'Front Load' : (p['wmType'] === 'semi' ? 'Semi-Automatic' : 'Top Load Automatic')} (${p['capacityKg'] || 7}kg)`;
        case 'geyser':
          return `${p['ratedWatts'] || app.watts}W Storage Geyser`;
        case 'iron':
          return `${p['ironType'] === 'steam' ? 'Steam' : 'Dry'} Iron (${p['ratedWatts'] || 1000}W)`;
        case 'induction':
          return `${p['ratedWatts'] || 2000}W Induction Cooktop`;
        case 'ac':
          return `${p['ton'] || '1.5'} Ton ${p['technology'] === 'nonInverter' ? 'Fixed Speed' : 'Inverter'}`;
        case 'pump':
          return `${p['motorHp'] || '1.0'} HP ${p['pumpType'] === 'submersible' ? 'Submersible' : 'Monoblock'} (${Math.round((Number(p['motorHp']) || 1) * 746)}W shaft)`;
        case 'led':
          return `${p['bulbWatts'] || app.watts}W Standard LED Bulb`;
        default:
          return `${app.watts}W Standard Load`;
      }
    }

    // Default summaries matching exact screenshot
    switch (cat) {
      case 'led':
        return `${app.watts}W Standard LED Bulb`;
      case 'fan':
        return app.watts <= 35 ? 'BLDC Energy Saver (28-35W)' : 'Standard Induction (70-75W)';
      case 'tv':
        return '43" LED TV';
      case 'fridge':
        return '240L 3-Star Refrigerator';
      case 'comp':
        return 'Laptop Notebook (~65W)';
      case 'wm':
        return 'Top Load Automatic (7kg)';
      case 'geyser':
        return `${app.watts}W Storage Geyser`;
      case 'iron':
        return 'Dry Iron (1000W)';
      case 'induction':
        return '1160W Induction Cooktop';
      case 'ac':
        const ton = app.acTon || this.calc.acConfig().ton || '1.5';
        const type = app.acType || this.calc.acConfig().acType || 'inverter';
        return `${ton} Ton ${type === 'inverter' ? 'Inverter' : 'Fixed Speed'}`;
      case 'pump':
        const hp = app.pumpHp || this.calc.pumpConfig().pumpHp || '1';
        return `${hp} HP Monoblock (746W shaft)`;
      default:
        return `${app.watts}W Standard Load`;
    }
  }

  updateStdWatt(app: ApplianceItem, w: any) {
    const val = Math.max(1, Number(w) || 1);
    app.watts = val;
    app.ratedWatts = val;
    this.localAppliances.update(list => [...list]);
  }

  resetStandardDefaults() {
    this.calc.resetAppliances();
    this.localAppliances.set(JSON.parse(JSON.stringify(this.calc.appliances())));
    this.expandedAppId.set(null);
    this.currentSpecsApp.set(null);
  }

  resetAppliances() {
    this.calc.resetAppliances();
    this.localAppliances.set(JSON.parse(JSON.stringify(this.calc.appliances())));
  }

  resetBackupDefaults() {
    const current = this.localAppliances();
    current.forEach(app => {
      app.isBackup = ['led', 'fan', 'tv', 'fridge', 'comp', 'other'].includes(app.id);
      app.backupQty = app.defaultQty;
      app.backupHours = this.calc.backupHours();
    });
    this.localAppliances.set([...current]);
  }

  toggleAppCheck(app: ApplianceItem) {
    app.checked = !app.checked;
    this.localAppliances.update(list => [...list]);
  }

  updateAppQty(app: ApplianceItem, qty: any) {
    app.defaultQty = Math.max(0, Number(qty) || 0);
    this.localAppliances.update(list => [...list]);
  }

  updateAppWatt(app: ApplianceItem, w: any) {
    app.watts = Math.max(1, Number(w) || 1);
    this.localAppliances.update(list => [...list]);
  }

  updateAppHours(app: ApplianceItem, h: any) {
    app.defaultHours = Math.max(0.1, Number(h) || 1);
    this.localAppliances.update(list => [...list]);
  }

  toggleBackupAppCheck(app: ApplianceItem) {
    app.isBackup = app.isBackup === false ? true : false;
    this.localAppliances.update(list => [...list]);
  }

  updateBackupQty(app: ApplianceItem, qty: any) {
    const q = Math.max(0, Math.min(app.defaultQty, Number(qty) || 0));
    app.backupQty = q;
    this.localAppliances.update(list => [...list]);
  }

  updateAppBackupHours(app: ApplianceItem, h: any) {
    app.backupHours = Math.max(0.1, Number(h) || 1);
    this.localAppliances.update(list => [...list]);
  }

  addCustomAppliance() {
    if (!this.newAppName.trim()) return;
    const newId = 'custom_' + Date.now();
    const newApp: ApplianceItem = {
      id: newId,
      name: this.newAppName.trim(),
      watts: Number(this.newAppWatts) || 100,
      defaultQty: Number(this.newAppQty) || 1,
      defaultHours: Number(this.newAppHours) || 4,
      checked: true,
      isBackup: true,
      backupQty: Number(this.newAppQty) || 1,
      backupHours: this.calc.backupHours(),
      icon: '⚡'
    };
    this.localAppliances.update(list => [...list, newApp]);
    this.newAppName = '';
    this.newAppQty = 1;
    this.newAppWatts = 100;
    this.newAppHours = 4;
  }

  onAcTonChange(ton: string) {
    const tonWattsMap: Record<string, number> = { '0.5': 600, '1': 1200, '1.5': 1800, '2': 2400 };
    this.calc.acConfig.update(c => ({ ...c, ton, actualWatts: tonWattsMap[ton] || 1800 }));
    this.calc.appliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acTon: ton, watts: tonWattsMap[ton] || 1800 } : a));
    this.localAppliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acTon: ton, watts: tonWattsMap[ton] || 1800 } : a));
  }

  onAcTypeChange(acType: 'inverter' | 'non-inverter') {
    this.calc.acConfig.update(c => ({ ...c, acType }));
    this.calc.appliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acType } : a));
    this.localAppliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acType } : a));
  }

  onAcWattsChange(w: any) {
    const actualWatts = Number(w) || 0;
    this.calc.acConfig.update(c => ({ ...c, actualWatts }));
    if (actualWatts > 0) {
      this.calc.appliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acActualWatts: actualWatts, watts: actualWatts } : a));
      this.localAppliances.update(list => list.map(a => a.id === 'ac' ? { ...a, acActualWatts: actualWatts, watts: actualWatts } : a));
    }
  }

  onPumpHpChange(hp: string) {
    const hpWattsMap: Record<string, number> = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 };
    this.calc.pumpConfig.update(c => ({ ...c, pumpHp: hp }));
    this.calc.appliances.update(list => list.map(a => a.id === 'pump' ? { ...a, pumpHp: hp, watts: hpWattsMap[hp] || 746 } : a));
    this.localAppliances.update(list => list.map(a => a.id === 'pump' ? { ...a, pumpHp: hp, watts: hpWattsMap[hp] || 746 } : a));
  }
}
