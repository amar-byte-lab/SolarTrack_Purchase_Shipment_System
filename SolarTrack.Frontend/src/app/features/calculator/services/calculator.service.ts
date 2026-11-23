import { Injectable, computed, signal, inject } from '@angular/core';
import { CalculatorDbService } from './calculator-db.service';
import {
  SystemType,
  SupplyPhase,
  BatteryChemistry,
  SizingBasis,
  ApplianceItem,
  FullSizingResult,
  InverterSelectionResult,
  BatterySelectionResult,
  SolarCalculationResult,
  TariffAndPaybackResult,
  SystemValidation
} from '../models/calculator.model';

@Injectable({
  providedIn: 'root'
})
export class CalculatorService {
  private db = inject(CalculatorDbService);

  // User input signals
  readonly systemType = signal<SystemType>('on-grid');
  readonly connectionPhase = signal<SupplyPhase>('1-Phase');
  readonly sanctionedLoadKw = signal<number>(3);
  readonly selectedBatteryType = signal<BatteryChemistry>('lithium');
  readonly backupHours = signal<number>(4);
  readonly energyCalculationBasis = signal<SizingBasis>('monthly_units');
  readonly monthlyUnits = signal<number>(300);
  readonly appliances = signal<ApplianceItem[]>(JSON.parse(JSON.stringify(this.db.COMMON_APPLIANCES)));

  // Heavy load configs
  readonly acConfig = signal({
    ton: '1.5',
    acType: 'inverter' as 'inverter' | 'non-inverter',
    actualWatts: 0
  });
  readonly pumpConfig = signal({
    pumpHp: '1'
  });

  // Cost recovery inputs
  readonly enableCostRecovery = signal<boolean>(false);
  readonly discomId = signal<string>('odisha_oerc');
  readonly recoverySpend = signal<number>(150000);
  readonly financingType = signal<string>('0');
  readonly customInterest = signal<number>(0);

  // Main computed sizing result
  readonly result = computed<FullSizingResult>(() => {
    return this.calculateSystem({
      systemType: this.systemType(),
      connectionPhase: this.connectionPhase(),
      sanctionedLoadKw: this.sanctionedLoadKw(),
      selectedBatteryType: this.selectedBatteryType(),
      backupHours: this.backupHours(),
      energyCalculationBasis: this.energyCalculationBasis(),
      monthlyUnits: this.monthlyUnits(),
      appliances: this.appliances()
    });
  });

  // Computed tariff & payback result
  readonly costRecoveryResult = computed<TariffAndPaybackResult>(() => {
    const units = this.monthlyUnits() || 300;
    const spend = this.recoverySpend() || 150000;
    const loadKw = this.sanctionedLoadKw() || 3;
    const fin = this.financingType();
    const rate = fin === 'custom' ? (this.customInterest() || 0) : Number(fin) || 0;

    return this.calculateTariffAndPayback({
      monthlyUnits: units,
      capitalSpend: spend,
      sanctionedLoadKw: loadKw,
      annualInterestRate: rate,
      discomId: this.discomId()
    });
  });

  // System type metadata
  readonly SYSTEM_TYPE_MAP: Record<SystemType, { label: string; inverterType: string; dbType: string; requiresBattery: boolean; requiresSolar: boolean }> = {
    'on-grid': {
      label: 'On-Grid Solar',
      inverterType: 'GTI / Grid-Tied Inverter',
      dbType: 'GTI',
      requiresBattery: false,
      requiresSolar: true
    },
    'off-grid': {
      label: 'Off-Grid Solar',
      inverterType: 'PCU / Solar PCU',
      dbType: 'PCU',
      requiresBattery: true,
      requiresSolar: true
    },
    'hybrid': {
      label: 'Hybrid Solar',
      inverterType: 'Bi-Directional / Hybrid Inverter',
      dbType: 'Hybrid',
      requiresBattery: true,
      requiresSolar: true
    },
    'without-solar': {
      label: 'Without Solar / Battery Backup',
      inverterType: 'Home UPS / Digital UPS / Pure Sine Wave UPS',
      dbType: 'UPS',
      requiresBattery: true,
      requiresSolar: false
    }
  };

  /**
   * Main calculation engine matching sizing-calc.js
   */
  calculateSystem(input: {
    systemType: SystemType;
    connectionPhase: SupplyPhase;
    sanctionedLoadKw: number;
    selectedBatteryType: BatteryChemistry;
    backupHours: number;
    energyCalculationBasis: SizingBasis;
    monthlyUnits: number;
    appliances: ApplianceItem[];
  }): FullSizingResult {
    const params = this.db.getParams();
    const sysTypeKey = input.systemType || 'on-grid';
    const sysMeta = this.SYSTEM_TYPE_MAP[sysTypeKey] || this.SYSTEM_TYPE_MAP['on-grid'];

    const rawAppliances = input.appliances || [];
    const backupHours = Math.max(0.5, Number(input.backupHours) || 4);
    const defaultBasis = sysTypeKey === 'on-grid' ? 'monthly_units' : 'backup_duration';
    const energyCalculationBasis = input.energyCalculationBasis || defaultBasis;
    const isMonthlyUnitsBasis = energyCalculationBasis === 'monthly_units';

    // 1. Audit & Sanitize Appliance Inputs
    let connectedLoadW = 0;
    let backupLoadW = 0;
    let estimatedDailyKwh = 0;
    let totalApplianceDailyWh = 0;
    let backupApplianceDailyWh = 0;
    const motorSurgeDeltas: number[] = [];

    const acWarnings: string[] = [];
    const pumpWarnings: string[] = [];

    rawAppliances.forEach(app => {
      if (app.checked === false) return;
      const qty = Math.max(0, Math.floor(Number(app.qty !== undefined ? app.qty : app.defaultQty) || 0));
      if (qty <= 0) return;

      let watts = Math.max(0, Number(app.watts) || 0);

      // Handle Heavy Load Overrides & Surge (AC)
      if (app.id === 'ac' || (app.isHeavy && app.name && app.name.toLowerCase().includes('ac'))) {
        const acTon = app.acTon || this.acConfig().ton || '1.5';
        if (app.acActualWatts && Number(app.acActualWatts) > 0) {
          watts = Math.max(1, Number(app.acActualWatts));
        } else if (!watts || watts === 0) {
          const tonWattsMap: Record<string, number> = { '0.5': 600, '1': 1200, '1.5': 1800, '2': 2400 };
          watts = tonWattsMap[acTon] || 1800;
        }
        const acType = app.acType || this.acConfig().acType || 'inverter';
        const surgeMultiplier = acType === 'inverter'
          ? (Number(params.acInverterSurgeFactor) || 1.5)
          : (Number(params.acNonInverterSurgeFactor) || 3.0);

        const singleMotorSurgeDelta = Math.round(watts * (surgeMultiplier - 1));
        const isBackupApp = app.isBackup !== undefined ? !!app.isBackup : true;
        const affectsInverterSurge = (sysTypeKey !== 'on-grid') && (sysTypeKey === 'off-grid' ? true : isBackupApp);
        if (affectsInverterSurge) {
          motorSurgeDeltas.push(singleMotorSurgeDelta);
          acWarnings.push(`AC motor inrush surge (${acType === 'inverter' ? 'Inverter AC' : 'Non-Inverter AC'}, ${surgeMultiplier}x) factored into inverter peak rating.`);
        }
      }

      // Handle Heavy Load Overrides & Surge (Water Pump)
      if (app.id === 'pump' || (app.isHeavy && app.name && app.name.toLowerCase().includes('pump'))) {
        const pumpHp = app.pumpHp || this.pumpConfig().pumpHp || '1';
        if (!watts || watts === 0) {
          const hpWattsMap: Record<string, number> = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 };
          watts = hpWattsMap[pumpHp] || 746;
        }
        const surgeMultiplier = Number(params.pumpSurgeFactor) || 3.5;
        const singleMotorSurgeDelta = Math.round(watts * (surgeMultiplier - 1));
        const isBackupApp = app.isBackup !== undefined ? !!app.isBackup : true;
        const affectsInverterSurge = (sysTypeKey !== 'on-grid') && (sysTypeKey === 'off-grid' ? true : isBackupApp);
        if (affectsInverterSurge) {
          motorSurgeDeltas.push(singleMotorSurgeDelta);
          pumpWarnings.push(`Pump motor starting surge (${surgeMultiplier}x) factored into inverter peak rating.`);
        }
      }

      const runningWatts = watts;
      const ratedWatts = (app.ratedWatts !== undefined && Number(app.ratedWatts) > 0)
        ? Number(app.ratedWatts)
        : runningWatts;

      const totalConnectedAppWatts = ratedWatts * qty;
      connectedLoadW += totalConnectedAppWatts;

      const isBackup = app.isBackup !== undefined ? !!app.isBackup : true;
      const backupQty = app.backupQty !== undefined
        ? Math.max(0, Math.min(qty, Number(app.backupQty)))
        : (isBackup ? qty : 0);
      const totalBackupAppWatts = runningWatts * backupQty;

      if (isBackup && backupQty > 0) {
        backupLoadW += totalBackupAppWatts;
      }

      const hours = Math.max(0.1, Number(app.hours !== undefined ? app.hours : app.defaultHours) || 4);
      const appDailyWh = (runningWatts * qty) * hours;
      totalApplianceDailyWh += appDailyWh;

      const appBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : backupHours) || 4);
      const appBackupWh = totalBackupAppWatts * appBackupHours;
      if (isBackup && backupQty > 0) {
        backupApplianceDailyWh += appBackupWh;
      }
      estimatedDailyKwh += appDailyWh / 1000;
    });

    const maxMotorSurgeDeltaW = motorSurgeDeltas.length > 0 ? Math.max(...motorSurgeDeltas) : 0;

    // 2. Solar PV Sizing
    const sanctionedLoadKw = Math.max(0.5, Number(input.sanctionedLoadKw) || 3);
    const connectionPhase = input.connectionPhase || '1-Phase';
    const isSinglePhase = connectionPhase === '1-Phase';
    const SINGLE_PHASE_MAX_LIMIT_KW = 5.0;

    const activeBackupW = backupLoadW > 0 ? backupLoadW : (connectedLoadW > 0 ? connectedLoadW : 0);
    let targetBackupEnergyWh = 0;
    let effectiveBackupHours = backupHours;

    const monthlyUnitsVal = Number(input.monthlyUnits) || 0;
    const dailyDemandFromMonthlyUnits = monthlyUnitsVal > 0 ? (monthlyUnitsVal / 30) : 0;

    let dailyDemandKwh = 0;
    if (isMonthlyUnitsBasis) {
      dailyDemandKwh = dailyDemandFromMonthlyUnits > 0 ? dailyDemandFromMonthlyUnits : (estimatedDailyKwh || 10);
    } else {
      dailyDemandKwh = estimatedDailyKwh > 0 ? estimatedDailyKwh : (dailyDemandFromMonthlyUnits || 10);
    }

    if (backupApplianceDailyWh > 0) {
      targetBackupEnergyWh = backupApplianceDailyWh;
      effectiveBackupHours = backupLoadW > 0 ? Math.round((targetBackupEnergyWh / backupLoadW) * 10) / 10 : backupHours;
    } else if (activeBackupW > 0) {
      targetBackupEnergyWh = Math.round(activeBackupW * backupHours);
      effectiveBackupHours = backupHours;
    } else {
      targetBackupEnergyWh = 0;
      effectiveBackupHours = backupHours;
    }

    if (isMonthlyUnitsBasis && sysTypeKey === 'off-grid' && backupApplianceDailyWh <= 0) {
      targetBackupEnergyWh = Math.round(dailyDemandKwh * 1000 * (17 / 24));
      effectiveBackupHours = 17;
    }

    const backupEnergyKwh = Math.round((targetBackupEnergyWh / 1000) * 100) / 100;
    const estBatteryRechargeKwh = targetBackupEnergyWh / (0.88 * 1000);

    let solarResult: SolarCalculationResult | null = null;
    if (sysMeta.requiresSolar && sysTypeKey !== 'without-solar') {
      solarResult = this.calculateSolar({
        systemType: sysTypeKey,
        energyCalculationBasis,
        dailyDemandKwh,
        monthlyUnits: monthlyUnitsVal,
        dailyUsageKwh: dailyDemandKwh,
        batteryRechargeKwh: estBatteryRechargeKwh,
        peakSunHours: Number(params.peakSunHours) || 5.0,
        pvSystemEfficiencyPct: Number(params.pvSystemEfficiencyPct) || 78,
        inverterLossPct: Number(params.inverterLossPct) || 4,
        dcAcCableLossPct: Number(params.dcAcCableLossPct) || 2,
        tempLossPct: Number(params.tempLossPct) || 7,
        soilingLossPct: Number(params.soilingLossPct) || 4,
        shadingOrientationLossPct: Number(params.shadingOrientationLossPct) || 3,
        sanctionedLoadKw
      });
    }

    // 3. Base Load & Continuous/Peak Requirements (System Specific Engineering Rules)
    const safetyMarginPct = Math.max(0, Number(params.safetyMarginPct) || 25);
    let requiredContinuousW = 0;

    if (sysTypeKey === 'on-grid') {
      // On-Grid GTI: Inverter sizes strictly to match Solar PV Array (DC/AC ~1.15)
      // Home appliances run in parallel from solar + grid.
      if (solarResult && solarResult.actualArrayKwp > 0) {
        requiredContinuousW = Math.max(1000, Math.round((solarResult.actualArrayKwp / 1.2) * 1000));
      } else {
        requiredContinuousW = Math.max(1000, Math.round(sanctionedLoadKw * 1000));
      }
    } else if (sysTypeKey === 'off-grid') {
      // Off-Grid Solar PCU: Must supply running loads (+ safety margin) AND MPPT solar charger must support PV array
      const offGridRunningW = backupLoadW > 0 ? backupLoadW : (connectedLoadW > 0 ? connectedLoadW : 1000);
      const loadDrivenW = Math.round(offGridRunningW * 1.25);
      const solarDrivenW = solarResult && solarResult.actualArrayKwp > 0
        ? Math.round((solarResult.actualArrayKwp / 1.25) * 1000)
        : 0;
      requiredContinuousW = Math.max(loadDrivenW, solarDrivenW);
    } else if (sysTypeKey === 'hybrid') {
      // Hybrid Inverter: Must support grid-tied solar export AND emergency backup load during power outage
      const backupRunningW = backupLoadW > 0 ? backupLoadW : (connectedLoadW > 0 ? connectedLoadW : 1000);
      const backupDrivenW = Math.round(backupRunningW * 1.25);
      const solarDrivenW = solarResult && solarResult.actualArrayKwp > 0
        ? Math.round((solarResult.actualArrayKwp / 1.15) * 1000)
        : 0;
      requiredContinuousW = Math.max(backupDrivenW, solarDrivenW);
    } else {
      // Without-solar (Home UPS): Sized strictly on backup appliances load with safety margin
      const upsLoadW = backupLoadW > 0 ? backupLoadW : (connectedLoadW > 0 ? connectedLoadW : 500);
      requiredContinuousW = Math.round(upsLoadW * 1.25);
    }

    const requiredPeakSurgeW = (sysTypeKey === 'on-grid')
      ? requiredContinuousW // GTI does not handle motor starting inrush; grid absorbs it
      : Math.max(Math.round(requiredContinuousW * 1.5), Math.round((sysTypeKey === 'off-grid' ? (backupLoadW || connectedLoadW) : backupLoadW) + maxMotorSurgeDeltaW));

    // 4. Validate Single-Phase Limit & Sanctioned Load
    const rawRequiredKw = Math.round((requiredContinuousW / 1000) * 10) / 10;
    const effectiveSolarKw = solarResult ? solarResult.actualArrayKwp : rawRequiredKw;

    let exceedsSinglePhase = false;
    let exceedsSanctionedLoad = false;

    if (sysTypeKey === 'on-grid' || sysTypeKey === 'hybrid') {
      exceedsSinglePhase = isSinglePhase && solarResult !== null && solarResult.actualArrayKwp > SINGLE_PHASE_MAX_LIMIT_KW;
      exceedsSanctionedLoad = solarResult !== null && solarResult.actualArrayKwp > sanctionedLoadKw;
    } else if (sysTypeKey === 'off-grid') {
      exceedsSinglePhase = isSinglePhase && rawRequiredKw > SINGLE_PHASE_MAX_LIMIT_KW;
      exceedsSanctionedLoad = rawRequiredKw > sanctionedLoadKw;
    } else {
      exceedsSinglePhase = isSinglePhase && rawRequiredKw > SINGLE_PHASE_MAX_LIMIT_KW;
      exceedsSanctionedLoad = rawRequiredKw > sanctionedLoadKw;
    }

    let valTitle = '';
    let valMessage = '';
    let valSuggestion = '';
    let valAction: 'NONE' | 'SWITCH_TO_3PHASE_OR_REDUCE' | 'ENHANCE_SANCTIONED_LOAD' = 'NONE';
    const plantDisplayKw = solarResult ? solarResult.actualArrayKwp : rawRequiredKw;

    if (exceedsSinglePhase) {
      valAction = 'SWITCH_TO_3PHASE_OR_REDUCE';
      if (sysTypeKey === 'without-solar') {
        valTitle = 'Single-Phase Supply Limit Exceeded (5.0 kW)';
        valMessage = `Required UPS continuous rating (${rawRequiredKw} kW) exceeds the permissible Single-Phase (230V) limit of 5.0 kW.`;
        valSuggestion = 'Switch your connection supply to Three-Phase (415V) or reduce simultaneous backup appliances to ≤ 5.0 kW.';
      } else if (sysTypeKey === 'off-grid') {
        valTitle = 'Single-Phase PCU Limit Exceeded (5.0 kW)';
        valMessage = `Calculated off-grid capacity (${rawRequiredKw} kW) exceeds the standard Single-Phase (230V) rating of 5.0 kW.`;
        valSuggestion = 'Switch to a Three-Phase (415V) Solar PCU configuration or optimize connected loads to ≤ 5.0 kW.';
      } else {
        valTitle = 'Single-Phase Statutory Net-Metering Limit Exceeded';
        valMessage = `Calculated solar array (${plantDisplayKw} kWp) exceeds the 5.0 kWp Single-Phase (230V) DISCOM export cap.`;
        valSuggestion = 'Switch your utility connection to Three-Phase (415V), or cap your solar system to ≤ 5.0 kWp.';
      }
    } else if (exceedsSanctionedLoad) {
      valAction = 'ENHANCE_SANCTIONED_LOAD';
      if (sysTypeKey === 'without-solar') {
        valTitle = 'Sanctioned Meter Load Warning';
        valMessage = `Required UPS load (${rawRequiredKw} kW) exceeds your current sanctioned meter load (${sanctionedLoadKw} kW).`;
        valSuggestion = 'Apply to your DISCOM for a sanctioned load enhancement to avoid tripping the service connection breaker.';
      } else if (sysTypeKey === 'off-grid') {
        valTitle = 'Sanctioned Load Warning';
        valMessage = `System capacity (${rawRequiredKw} kW) exceeds your meter sanctioned load (${sanctionedLoadKw} kW).`;
        valSuggestion = 'If grid bypass charging is used, consider enhancing sanctioned load to avoid utility overload penalties.';
      } else {
        valTitle = 'Sanctioned Meter Load Enhancement Advised';
        valMessage = `Solar array (${plantDisplayKw} kWp) exceeds your current sanctioned meter load (${sanctionedLoadKw} kW).`;
        valSuggestion = 'DISCOM net-metering regulations mandate that installed solar PV capacity cannot exceed 100% of sanctioned load. Apply for load enhancement before net-metering application.';
      }
    }

    const validation: SystemValidation = {
      connectionPhase,
      isSinglePhase,
      sanctionedLoadKw,
      requiredKw: (sysTypeKey === 'on-grid' || sysTypeKey === 'hybrid')
        ? Math.max(rawRequiredKw, Math.ceil(effectiveSolarKw))
        : rawRequiredKw,
      effectiveSolarKw,
      maxAllowedSinglePhaseKw: SINGLE_PHASE_MAX_LIMIT_KW,
      exceedsSinglePhase,
      exceedsSanctionedLoad,
      status: exceedsSinglePhase ? 'ERROR_SINGLE_PHASE_EXCEEDED' : (exceedsSanctionedLoad ? 'WARN_SANCTIONED_LOAD_EXCEEDED' : 'OK'),
      title: valTitle,
      message: valMessage,
      suggestion: valSuggestion,
      actionType: valAction
    };

    // 5. Select Inverter
    const reqPvInputW = solarResult ? Math.round(solarResult.actualArrayKwp * 1000) : 0;
    const inverterMatch = this.selectInverter({
      targetType: sysMeta.dbType,
      requiredContinuousW,
      requiredPeakSurgeW,
      reqPvInputW,
      inverterList: this.db.getInverters(),
      connectionPhase,
      isSinglePhase,
      exceedsSinglePhase,
      sanctionedLoadKw
    });

    // 6. Battery Selection (Compute all 3 chemistry options for comprehensive customer summary & sizing)
    let batteryResult: BatterySelectionResult | null = null;
    let batteryLithium: BatterySelectionResult | null = null;
    let batteryTubular: BatterySelectionResult | null = null;
    let batteryFlatPlate: BatterySelectionResult | null = null;

    const activeBackW = backupLoadW > 0 ? backupLoadW : (connectedLoadW > 0 ? connectedLoadW : 1000);
    const chosenBatteryType = input.selectedBatteryType || 'lithium';
    const effBatteryVoltage = inverterMatch.batteryVoltage > 0 ? inverterMatch.batteryVoltage : (activeBackW > 2000 ? 48 : (activeBackW > 1000 ? 24 : 12));

    batteryLithium = this.selectBattery({
      backupLoadW: activeBackW,
      backupHours: effectiveBackupHours,
      targetBackupEnergyWh,
      energyCalculationBasis,
      inverterBatteryVoltage: effBatteryVoltage,
      inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
      batteryType: 'lithium',
      lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
      tubularDoDPct: Number(params.tubularDoDPct) || 75,
      flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
      batteryList: this.db.getBatteries(),
      peakSurgeW: requiredPeakSurgeW
    });

    batteryTubular = this.selectBattery({
      backupLoadW: activeBackW,
      backupHours: effectiveBackupHours,
      targetBackupEnergyWh,
      energyCalculationBasis,
      inverterBatteryVoltage: effBatteryVoltage,
      inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
      batteryType: 'tubular',
      lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
      tubularDoDPct: Number(params.tubularDoDPct) || 75,
      flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
      batteryList: this.db.getBatteries(),
      peakSurgeW: requiredPeakSurgeW
    });

    batteryFlatPlate = this.selectBattery({
      backupLoadW: activeBackW,
      backupHours: effectiveBackupHours,
      targetBackupEnergyWh,
      energyCalculationBasis,
      inverterBatteryVoltage: effBatteryVoltage,
      inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
      batteryType: 'flat-plate',
      lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
      tubularDoDPct: Number(params.tubularDoDPct) || 75,
      flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
      batteryList: this.db.getBatteries(),
      peakSurgeW: requiredPeakSurgeW
    });

    if (sysMeta.requiresBattery) {
      if (chosenBatteryType === 'tubular') {
        batteryResult = batteryTubular;
      } else if (chosenBatteryType === 'flat-plate') {
        batteryResult = batteryFlatPlate;
      } else {
        batteryResult = batteryLithium;
      }
    }

    // Warnings list
    const warnings: string[] = [];
    if (exceedsSinglePhase) {
      warnings.push(`1-Phase limit exceeded: Required ${validation.requiredKw} kW exceeds 5.0 kW single phase statutory cap.`);
    }
    if (exceedsSanctionedLoad) {
      warnings.push(`Sanctioned load exceeded: Required ${validation.requiredKw} kW exceeds sanctioned load (${sanctionedLoadKw} kW).`);
    }
    warnings.push(...acWarnings);
    warnings.push(...pumpWarnings);

    return {
      systemType: sysTypeKey,
      systemLabel: sysMeta.label,
      inverterCategory: sysMeta.inverterType,
      connectionPhase,
      sanctionedLoadKw,
      connectedLoadW,
      backupLoadW,
      backupHours: effectiveBackupHours,
      requestedBackupHours: backupHours,
      energyCalculationBasis,
      dailyEnergyWh: Math.round(dailyDemandKwh * 1000),
      dailyEnergyKwh: Math.round(dailyDemandKwh * 100) / 100,
      dailyDemandKwh: Math.round(dailyDemandKwh * 100) / 100,
      backupEnergyWh: Math.round(targetBackupEnergyWh),
      backupEnergyKwh: backupEnergyKwh,
      totalApplianceDailyWh: Math.round(totalApplianceDailyWh),
      backupApplianceDailyWh: Math.round(backupApplianceDailyWh),
      targetBackupEnergyWh: Math.round(targetBackupEnergyWh),
      safetyMarginPct,
      requiredContinuousW,
      requiredPeakSurgeW,
      validation,
      inverter: inverterMatch,
      battery: batteryResult,
      batteryLithium,
      batteryTubular,
      batteryFlatPlate,
      solar: solarResult,
      warnings,
      estimatedDailyKwh: Math.round(estimatedDailyKwh * 100) / 100
    };
  }

  /**
   * Select Inverter with Single-Phase 5kW Capping Safeguards
   */
  private selectInverter(opts: {
    targetType: string;
    requiredContinuousW: number;
    requiredPeakSurgeW: number;
    reqPvInputW: number;
    inverterList: any[];
    connectionPhase: SupplyPhase;
    isSinglePhase: boolean;
    exceedsSinglePhase: boolean;
    sanctionedLoadKw: number;
  }): InverterSelectionResult {
    const { targetType, requiredContinuousW, requiredPeakSurgeW, reqPvInputW, inverterList, isSinglePhase, exceedsSinglePhase } = opts;
    const activeInverters = (inverterList || []).filter(inv => inv.active && inv.type === targetType);

    if (isSinglePhase && exceedsSinglePhase) {
      const targetReqKw = Math.round((requiredContinuousW / 1000) * 10) / 10;
      const singlePhase5kWCandidates = activeInverters.filter(inv =>
        (inv.phase === '1-Phase' || !inv.phase) &&
        (inv.kW === 5 || inv.continuousOutput === 5000)
      );

      if (singlePhase5kWCandidates.length > 0) {
        const selected = singlePhase5kWCandidates[0];
        return {
          matched: true,
          cappedSinglePhase: true,
          requestedKw: targetReqKw,
          brand: selected.brand || 'Tier 1 Standard',
          model: selected.model || `${selected.kVA}kVA ${targetType}`,
          kVA: selected.kVA,
          kW: selected.kW,
          phase: '1-Phase (230V) [Capped at 5kW Max]',
          batteryVoltage: selected.batteryVoltage || 0,
          continuousOutput: selected.continuousOutput || 5000,
          surgeOutput: selected.surgeOutput || 10000,
          notes: `⚠️ CAPPED at DISCOM statutory 1-Phase limit (5.0 kW). System requires ${targetReqKw} kW — upgrade to Three-Phase (415V) to install full capacity.`
        };
      }

      return {
        matched: false,
        cappedSinglePhase: true,
        requestedKw: targetReqKw,
        brand: 'Standard Tier 1 (Capped)',
        model: `5.0 kW 1-Phase ${targetType} [Capped]`,
        kVA: 5.0,
        kW: 5.0,
        phase: '1-Phase (230V) [Capped at 5kW Max]',
        batteryVoltage: targetType === 'GTI' ? 0 : 48,
        continuousOutput: 5000,
        surgeOutput: 10000,
        notes: `⚠️ CAPPED at DISCOM statutory 1-Phase limit (5.0 kW). System requires ${targetReqKw} kW — upgrade to Three-Phase (415V) to install full capacity.`
      };
    }

    let candidates = activeInverters.filter(inv => {
      const contCap = inv.continuousOutput || Math.round(inv.kW * 1000);
      const surgeCap = inv.surgeOutput || (contCap * 2);
      return contCap >= requiredContinuousW && surgeCap >= requiredPeakSurgeW;
    });

    if (isSinglePhase) {
      candidates = candidates.filter(c => c.phase === '1-Phase' || !c.phase);
    } else {
      candidates = candidates.filter(c => c.phase === '3-Phase');
    }

    if (reqPvInputW > 0 && candidates.length > 0) {
      const pvCompliant = candidates.filter(inv => (inv.maxPvInput || 0) >= reqPvInputW);
      if (pvCompliant.length > 0) candidates = pvCompliant;
    }

    candidates.sort((a, b) => {
      const aKw = a.continuousOutput || (a.kW * 1000);
      const bKw = b.continuousOutput || (b.kW * 1000);
      if (aKw !== bKw) return aKw - bKw;
      return a.kVA - b.kVA;
    });

    if (candidates.length > 0) {
      const selected = candidates[0];
      const phaseLabel = selected.phase || (isSinglePhase ? '1-Phase (230V)' : '3-Phase (415V)');
      return {
        matched: true,
        cappedSinglePhase: false,
        brand: selected.brand || 'Tier 1 Standard',
        model: selected.model || `${selected.kVA}kVA ${targetType}`,
        kVA: selected.kVA,
        kW: selected.kW,
        phase: phaseLabel,
        batteryVoltage: selected.batteryVoltage || 0,
        continuousOutput: selected.continuousOutput || Math.round(selected.kW * 1000),
        surgeOutput: selected.surgeOutput || (selected.kW * 2000),
        mpptVoltageRange: selected.mpptVoltageRange || 'N/A'
      };
    }

    const approxKw = Math.max(1, Math.ceil(requiredContinuousW / 1000));
    let fallbackVolt = 0;
    if (targetType !== 'GTI') {
      if (approxKw <= 1) fallbackVolt = 12;
      else if (approxKw <= 2) fallbackVolt = 24;
      else if (approxKw <= 5) fallbackVolt = 48;
      else if (approxKw <= 8) fallbackVolt = 96;
      else if (approxKw <= 12) fallbackVolt = 120;
      else fallbackVolt = 240;
    }

    return {
      matched: false,
      cappedSinglePhase: false,
      brand: 'Tier 1 Standard Model',
      model: `${approxKw} kW ${isSinglePhase ? '1-Phase' : '3-Phase'} ${targetType}`,
      kVA: targetType === 'GTI' ? approxKw : Math.round((approxKw / 0.8) * 10) / 10,
      kW: approxKw,
      phase: isSinglePhase ? '1-Phase (230V)' : '3-Phase (415V)',
      batteryVoltage: fallbackVolt,
      continuousOutput: approxKw * 1000,
      surgeOutput: targetType === 'GTI' ? (approxKw * 1000) : (approxKw * 2000),
      mpptVoltageRange: targetType === 'GTI' ? (isSinglePhase ? '80V - 550V' : '160V - 1000V') : 'N/A'
    };
  }

  /**
   * Select Battery with Lithium / Tubular / Flat Plate Chemistries
   */
  private selectBattery(opts: {
    backupLoadW: number;
    backupHours: number;
    targetBackupEnergyWh: number;
    energyCalculationBasis: string;
    inverterBatteryVoltage: number;
    inverterEfficiencyPct: number;
    batteryType: string;
    lithiumDoDPct: number;
    tubularDoDPct: number;
    flatPlateDoDPct: number;
    batteryList: any[];
    peakSurgeW: number;
  }): BatterySelectionResult {
    const { backupLoadW, backupHours, targetBackupEnergyWh, energyCalculationBasis, inverterBatteryVoltage, inverterEfficiencyPct, batteryType, peakSurgeW } = opts;
    const isLithium = batteryType === 'lithium';
    const isTubular = batteryType === 'tubular';
    const isFlatPlate = batteryType === 'flat-plate';

    const eff = (inverterEfficiencyPct || 90) / 100;
    const dod = isLithium ? ((opts.lithiumDoDPct || 90) / 100) : (isTubular ? ((opts.tubularDoDPct || 75) / 100) : ((opts.flatPlateDoDPct || 65) / 100));

    if ((!backupLoadW || backupLoadW <= 0) && (!targetBackupEnergyWh || targetBackupEnergyWh <= 0)) {
      const defaultSysV = inverterBatteryVoltage || 12;
      return {
        energyCalculationBasis,
        backupLoadW: 0,
        backupEnergyWh: 0,
        backupEnergyKwh: 0,
        requiredBatteryWh: 0,
        requiredBatteryKwh: 0,
        systemVoltage: defaultSysV,
        systemBankAh: 0,
        requiredAh: 0,
        maxDischargeCurrentA: 0,
        peakDischargeCurrentA: 0,
        batteryType: isLithium ? 'Lithium LFP' : (isTubular ? 'Tall Tubular Lead-Acid' : 'Flat Plate Lead-Acid'),
        selectedBrand: 'N/A',
        selectedModel: 'No Backup Load Selected',
        singleBatteryVolt: 12,
        singleBatteryAh: 0,
        singleBatteryKwh: 0,
        capacityRating: 'N/A',
        dodPct: Math.round(dod * 100),
        inverterEffPct: Math.round(eff * 100),
        series: 0,
        parallel: 0,
        totalUnits: 0,
        totalInstalledKwh: 0,
        usableKwh: 0,
        actualBackupHours: 0,
        configurationText: 'Please select appliances to calculate battery bank',
        dischargeCheckOk: true,
        maxDischargeCurrentCapacityA: 0,
        isZeroLoad: true
      };
    }

    const loadKw = (Math.max(10, backupLoadW || 500)) / 1000;
    let backupEnergyWh = 0;
    let backupEnergyKwh = 0;
    let targetHours = Math.max(0.5, Number(backupHours) || 4);

    if (targetBackupEnergyWh && targetBackupEnergyWh > 0) {
      backupEnergyWh = Math.round(targetBackupEnergyWh);
      backupEnergyKwh = Math.round((backupEnergyWh / 1000) * 100) / 100;
      targetHours = Math.round((backupEnergyWh / (loadKw * 1000)) * 10) / 10;
    } else {
      backupEnergyKwh = Math.round((loadKw * targetHours) * 100) / 100;
      backupEnergyWh = Math.round(backupEnergyKwh * 1000);
    }

    const requiredBatteryKwh = Math.round((backupEnergyKwh / (eff * dod)) * 100) / 100;
    const requiredBatteryWh = Math.round(requiredBatteryKwh * 1000);

    let systemVoltage = inverterBatteryVoltage;
    if (!systemVoltage || systemVoltage === 0) {
      if (backupLoadW <= 1000) systemVoltage = 12;
      else if (backupLoadW <= 2000) systemVoltage = 24;
      else if (backupLoadW <= 5000) systemVoltage = 48;
      else if (backupLoadW <= 8000) systemVoltage = 96;
      else if (backupLoadW <= 12000) systemVoltage = 120;
      else systemVoltage = 240;
    }

    const requiredAh = Math.ceil(requiredBatteryWh / systemVoltage);
    const contDischargeCurrentA = Math.round((loadKw * 1000) / (systemVoltage * eff));
    const peakDischargeCurrentA = Math.round((peakSurgeW || backupLoadW * 2) / (systemVoltage * eff));

    const activeBatteries = (opts.batteryList || []).filter(b => {
      if (!b.active) return false;
      if (isLithium) return b.type.toLowerCase().includes('lithium');
      if (isTubular) return b.type.toLowerCase().includes('tubular');
      if (isFlatPlate) return b.type.toLowerCase().includes('flat plate');
      return true;
    });

    let selectedBat: any = null;
    if (activeBatteries.length > 0) {
      if (isLithium) {
        const voltMatch = activeBatteries.filter(b => {
          if (systemVoltage === 12) return b.voltage <= 14;
          if (systemVoltage === 24) return b.voltage >= 20 && b.voltage <= 28;
          if (systemVoltage === 48) return b.voltage >= 40 && b.voltage <= 55;
          return b.voltage === systemVoltage;
        });
        const pool = voltMatch.length > 0 ? voltMatch : activeBatteries.filter(b => b.voltage <= systemVoltage);
        const sorted = [...pool].sort((a, b) => Math.abs(a.ah - requiredAh) - Math.abs(b.ah - requiredAh));
        selectedBat = sorted[0];
      } else {
        const prefAh = requiredAh > 180 ? 200 : 150;
        selectedBat = activeBatteries.find(b => b.ah === prefAh) || activeBatteries[0];
      }
    }

    const singleVolt = selectedBat ? selectedBat.voltage : (isLithium && systemVoltage >= 48 ? systemVoltage : 12);
    const singleAh = selectedBat ? selectedBat.ah : (isLithium ? (requiredAh >= 150 ? 200 : 100) : 150);
    const singleKwh = Math.round(((singleVolt * singleAh) / 1000) * 100) / 100;

    let series = 1;
    let parallel = 1;
    let totalUnits = 1;
    let systemBankAh = singleAh;

    if (isLithium) {
      if (singleVolt >= (systemVoltage - 4)) {
        series = 1;
        parallel = Math.max(1, Math.ceil(requiredAh / singleAh));
      } else {
        series = Math.max(1, Math.round(systemVoltage / singleVolt));
        parallel = Math.max(1, Math.ceil(requiredAh / singleAh));
      }
      totalUnits = series * parallel;
      systemBankAh = singleAh * parallel;
    } else {
      series = Math.max(1, Math.round(systemVoltage / 12));
      parallel = Math.max(1, Math.ceil(requiredAh / singleAh));
      totalUnits = series * parallel;
      systemBankAh = singleAh * parallel;
    }

    const totalInstalledKwh = Math.round(((systemVoltage * systemBankAh) / 1000) * 100) / 100;
    const usableKwh = Math.round((totalInstalledKwh * dod) * 100) / 100;
    const actualBackupHours = Math.round(((usableKwh * 1000 * eff) / Math.max(10, backupLoadW)) * 10) / 10;

    let configText = '';
    if (isLithium) {
      if (series === 1) {
        configText = `${parallel} × ${singleVolt}V ${singleAh}Ah Lithium LFP Pack${parallel > 1 ? 's in Parallel' : ''} (${totalInstalledKwh} kWh Bank)`;
      } else {
        configText = `${totalUnits} × ${singleVolt}V ${singleAh}Ah Lithium Modules (${series}S × ${parallel}P = ${systemVoltage}V, ${totalInstalledKwh} kWh Bank)`;
      }
    } else {
      if (series === 1 && parallel === 1) {
        configText = `1 × 12V ${singleAh}Ah ${isTubular ? 'Tall Tubular' : 'Flat Plate'} Battery (12V System)`;
      } else if (parallel === 1) {
        configText = `${series} × 12V ${singleAh}Ah Batteries in Series (${systemVoltage}V System)`;
      } else {
        configText = `${totalUnits} × 12V ${singleAh}Ah Batteries (${series}S × ${parallel}P Bank, ${systemVoltage}V System)`;
      }
    }

    const maxDischargeCurrentCapacityA = isLithium ? systemBankAh * 1.0 : Math.round(systemBankAh * 0.25);
    const dischargeCheckOk = contDischargeCurrentA <= maxDischargeCurrentCapacityA;

    return {
      energyCalculationBasis,
      backupLoadW,
      backupEnergyWh,
      backupEnergyKwh,
      requiredBatteryWh,
      requiredBatteryKwh,
      systemVoltage,
      systemBankAh,
      requiredAh,
      maxDischargeCurrentA: contDischargeCurrentA,
      peakDischargeCurrentA,
      batteryType: isLithium ? 'Lithium LFP' : (isTubular ? 'Tall Tubular Lead-Acid' : 'Flat Plate Lead-Acid'),
      selectedBrand: selectedBat ? selectedBat.brand : (isLithium ? 'Lithium LiFePO4' : 'Lead-Acid'),
      selectedModel: selectedBat ? selectedBat.model : `${singleAh}Ah Pack`,
      singleBatteryVolt: singleVolt,
      singleBatteryAh: singleAh,
      singleBatteryKwh: singleKwh,
      capacityRating: isLithium ? '0.5C Continuous / 1.0C Peak' : (isTubular ? 'C10 Solar Rated' : 'C20 Rated'),
      dodPct: Math.round(dod * 100),
      inverterEffPct: Math.round(eff * 100),
      series,
      parallel,
      totalUnits,
      totalInstalledKwh,
      usableKwh,
      actualBackupHours,
      configurationText: configText,
      dischargeCheckOk,
      maxDischargeCurrentCapacityA
    };
  }

  /**
   * Calculate Solar PV Array
   */
  private calculateSolar(opts: {
    systemType: string;
    energyCalculationBasis: string;
    dailyDemandKwh: number;
    monthlyUnits: number;
    dailyUsageKwh: number;
    batteryRechargeKwh?: number;
    peakSunHours: number;
    pvSystemEfficiencyPct: number;
    inverterLossPct: number;
    dcAcCableLossPct: number;
    tempLossPct: number;
    soilingLossPct: number;
    shadingOrientationLossPct: number;
    sanctionedLoadKw: number;
  }): SolarCalculationResult {
    let dailyDemand = Number(opts.dailyDemandKwh);
    if (!dailyDemand || dailyDemand <= 0) {
      if (opts.energyCalculationBasis === 'monthly_units') {
        const units = Number(opts.monthlyUnits) || 300;
        dailyDemand = units / 30;
      } else {
        dailyDemand = Math.max(0.1, Number(opts.dailyUsageKwh) || 10);
      }
    }

    let totalSolarDailyTargetKwh = dailyDemand;
    if (opts.systemType === 'off-grid') {
      const daytimeDirectKwh = dailyDemand * 0.35;
      const bRechargeKwh = dailyDemand * 0.65 / 0.88;
      totalSolarDailyTargetKwh = daytimeDirectKwh + bRechargeKwh;
    } else if (opts.systemType === 'hybrid') {
      const daytimeDirectKwh = dailyDemand * 0.35;
      const bRechargeKwh = dailyDemand * 0.65 / 0.88;
      totalSolarDailyTargetKwh = daytimeDirectKwh + bRechargeKwh;
    }

    const sunHours = Math.max(1, Number(opts.peakSunHours) || 5.0);
    const prEff = (opts.pvSystemEfficiencyPct || 78) / 100;
    const effectivePrPct = Math.round(prEff * 100);
    const totalLossPct = Math.round((1 - prEff) * 100);

    const requiredSolarKwp = totalSolarDailyTargetKwh / (sunHours * prEff);
    const panelWatts = 550;
    const sanctionedCapKwp = Number(opts.sanctionedLoadKw) > 0 ? Number(opts.sanctionedLoadKw) : requiredSolarKwp;
    const panelCount = Math.max(1, Math.ceil((Math.min(requiredSolarKwp, sanctionedCapKwp) * 1000) / panelWatts));
    const actualArrayKwp = Math.round(((panelCount * panelWatts) / 1000) * 100) / 100;

    const estDailyGenKwh = Math.round((actualArrayKwp * sunHours * prEff) * 100) / 100;
    const estMonthlyGenUnits = Math.round(estDailyGenKwh * 30);
    const estAnnualGenUnits = Math.round(estDailyGenKwh * 365);
    const roofAreaSqFt = Math.round(actualArrayKwp * 100);

    const sLoadKw = Number(opts.sanctionedLoadKw) || 3;
    const maxPermissibleDcKwp = sLoadKw;
    const exceedsSanctioned = requiredSolarKwp > maxPermissibleDcKwp;
    const permissibleSolarKwp = Math.min(actualArrayKwp, maxPermissibleDcKwp);
    const permissiblePanelCount = Math.floor((permissibleSolarKwp * 1000) / panelWatts);
    const permissibleArrayKwp = Math.round(((permissiblePanelCount * panelWatts) / 1000) * 100) / 100;

    return {
      dailyDemandKwh: Math.round(dailyDemand * 100) / 100,
      monthlyUnits: Math.round(dailyDemand * 30),
      requiredSolarKwp: Math.round(requiredSolarKwp * 100) / 100,
      actualArrayKwp,
      recommendedKwp: actualArrayKwp,
      permissibleArrayKwp,
      exceedsSanctionedLoad: exceedsSanctioned,
      sanctionedLoadKw: sLoadKw,
      peakSunHours: sunHours,
      effectivePrPct,
      totalLossPct,
      panelWatts,
      panelCount,
      estDailyGenKwh,
      estMonthlyGenUnits,
      estAnnualGenUnits,
      roofAreaSqFt,
      lossBreakdown: {
        inverterLossPct: opts.inverterLossPct || 4,
        dcAcCableLossPct: opts.dcAcCableLossPct || 2,
        tempLossPct: opts.tempLossPct || 7,
        soilingLossPct: opts.soilingLossPct || 4,
        shadingOrientationLossPct: opts.shadingOrientationLossPct || 3
      }
    };
  }

  /**
   * Multi-DISCOM Tariff & Solar Investment Payback
   */
  calculateTariffAndPayback(opts: {
    monthlyUnits: number;
    capitalSpend: number;
    sanctionedLoadKw: number;
    annualInterestRate: number;
    discomId: string;
  }): TariffAndPaybackResult {
    const u = Math.max(0, Number(opts.monthlyUnits) || 0);
    const spend = Math.max(0, Number(opts.capitalSpend) || 0);
    const loadKw = Math.max(0.5, Number(opts.sanctionedLoadKw) || 1);
    const interestRate = Math.max(0, Number(opts.annualInterestRate) || 0);

    const tariff = this.db.getTariffSchedule(opts.discomId || 'odisha_oerc');

    let remainingUnits = u;
    let baseEnergyCharge = 0;
    const slabsBreakdown: any[] = [];

    for (const slab of tariff.slabs) {
      if (remainingUnits <= 0) break;
      const slabCapacity = slab.max === Infinity ? remainingUnits : Math.max(0, slab.max - slab.min);
      const billableInSlab = Math.min(remainingUnits, slabCapacity);
      const amount = billableInSlab * slab.rate;
      baseEnergyCharge += amount;
      remainingUnits -= billableInSlab;
      slabsBreakdown.push({
        name: slab.name,
        units: Math.round(billableInSlab * 10) / 10,
        rate: slab.rate,
        amount: Math.round(amount * 100) / 100
      });
    }

    const fixedCharge = loadKw * (tariff.fixedChargePerKw || 20);
    const meterRent = tariff.meterRent || 10;
    const dutyRate = (tariff.electricityDutyPct || 4) / 100;
    const electricityDuty = baseEnergyCharge * dutyRate;
    const totalMonthlyBill = baseEnergyCharge + fixedCharge + meterRent + electricityDuty;

    const monthlySavings = baseEnergyCharge + electricityDuty;
    const annualSavings = monthlySavings * 12;

    let totalMonths = 0;
    let isRecoverable = true;
    let recoveryError = '';

    if (spend <= 0) {
      totalMonths = 0;
    } else if (monthlySavings <= 0) {
      isRecoverable = false;
      recoveryError = 'Monthly energy savings is ₹0. Cannot calculate recovery timeline.';
    } else if (interestRate === 0) {
      totalMonths = spend / monthlySavings;
    } else {
      const monthlyInterestRate = (interestRate / 100) / 12;
      const initialMonthlyInterest = spend * monthlyInterestRate;

      if (monthlySavings <= initialMonthlyInterest) {
        isRecoverable = false;
        recoveryError = `Investment cannot be recovered with this savings rate. Initial monthly interest (₹${Math.round(initialMonthlyInterest).toLocaleString('en-IN')}) exceeds monthly energy savings.`;
      } else {
        let remainingBalance = spend;
        let monthsCount = 0;
        const MAX_MONTHS = 600;

        while (remainingBalance > 0 && monthsCount < MAX_MONTHS) {
          const interest = remainingBalance * monthlyInterestRate;
          remainingBalance = remainingBalance + interest - monthlySavings;
          monthsCount++;
          if (remainingBalance < 0) remainingBalance = 0;
        }

        if (monthsCount >= MAX_MONTHS) {
          isRecoverable = false;
          recoveryError = 'Payback timeline exceeds 50 years.';
        } else {
          totalMonths = monthsCount;
        }
      }
    }

    const yrs = Math.floor(totalMonths / 12);
    const mos = Math.round(totalMonths % 12);
    let recoveryPeriodText = '';
    if (yrs === 0) recoveryPeriodText = `${mos} Months`;
    else if (mos === 0) recoveryPeriodText = `${yrs} Years`;
    else recoveryPeriodText = `${yrs} Yrs ${mos} Mo`;

    const annualRoiPercent = spend > 0 ? Math.round(((annualSavings / spend) * 100) * 10) / 10 : 0;

    return {
      isRecoverable,
      recoveryError,
      recoveryPeriodText,
      totalMonths,
      monthlySavings,
      annualSavings,
      totalMonthlyBill,
      baseEnergyCharge,
      fixedCharge,
      meterRent,
      electricityDuty,
      annualRoiPercent,
      sanctionedLoadKw: loadKw,
      slabs: slabsBreakdown
    };
  }

  // Mutator actions
  setSystemType(type: SystemType) {
    this.systemType.set(type);
    if (type === 'off-grid' || type === 'without-solar') {
      this.energyCalculationBasis.set('backup_duration');
    } else if (this.energyCalculationBasis() === 'backup_duration') {
      this.energyCalculationBasis.set('monthly_units');
    }
  }

  setPhase(phase: SupplyPhase) {
    this.connectionPhase.set(phase);
  }

  setSanctionedLoad(kw: number) {
    this.sanctionedLoadKw.set(Number(kw) || 3);
  }

  setBatteryType(chem: BatteryChemistry) {
    this.selectedBatteryType.set(chem);
  }

  setBackupHours(hrs: number) {
    this.backupHours.set(Number(hrs) || 4);
  }

  setEnergyBasis(basis: SizingBasis) {
    this.energyCalculationBasis.set(basis);
  }

  setMonthlyUnits(units: number) {
    this.monthlyUnits.set(Number(units) || 300);
  }

  setDiscom(discomId: string) {
    this.discomId.set(discomId);
  }

  setRecoverySpend(spend: number) {
    this.recoverySpend.set(Number(spend) || 150000);
  }

  setFinancingType(finType: string) {
    this.financingType.set(finType);
  }

  setCustomInterest(interest: number) {
    this.customInterest.set(Number(interest) || 0);
  }

  toggleCostRecovery(enabled: boolean) {
    this.enableCostRecovery.set(enabled);
  }

  // Actions for single-phase & load validation buttons
  switchToThreePhase() {
    this.connectionPhase.set('3-Phase');
  }

  capToSinglePhaseLimit() {
    this.sanctionedLoadKw.set(5);
  }

  enhanceSanctionedLoad(targetKw: number) {
    const kw = Math.max(1, Number(targetKw) || 5);
    this.sanctionedLoadKw.set(kw);
    if (kw > 5) {
      this.connectionPhase.set('3-Phase');
    }
  }

  updateAppliance(app: ApplianceItem) {
    this.appliances.update(list => list.map(a => a.id === app.id ? { ...app } : a));
  }

  addAppliance(app: ApplianceItem) {
    this.appliances.update(list => [...list, app]);
  }

  resetAppliances() {
    this.appliances.set(JSON.parse(JSON.stringify(this.db.COMMON_APPLIANCES)));
    this.acConfig.set({ ton: '1.5', acType: 'inverter', actualWatts: 0 });
    this.pumpConfig.set({ pumpHp: '1' });
  }

  resetAll() {
    this.systemType.set('on-grid');
    this.connectionPhase.set('1-Phase');
    this.sanctionedLoadKw.set(3);
    this.selectedBatteryType.set('lithium');
    this.backupHours.set(4);
    this.energyCalculationBasis.set('monthly_units');
    this.monthlyUnits.set(300);
    this.enableCostRecovery.set(false);
    this.discomId.set('odisha_oerc');
    this.recoverySpend.set(150000);
    this.financingType.set('0');
    this.customInterest.set(0);
    this.resetAppliances();
  }
}
