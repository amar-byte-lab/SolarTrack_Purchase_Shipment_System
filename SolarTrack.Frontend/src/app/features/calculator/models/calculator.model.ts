export type SystemType = 'on-grid' | 'off-grid' | 'hybrid' | 'without-solar';

export type SupplyPhase = '1-Phase' | '3-Phase';

export type BatteryChemistry = 'lithium' | 'tubular' | 'flat-plate';

export type SizingBasis = 'monthly_units' | 'appliance_load' | 'backup_duration';

export interface ApplianceItem {
  id: string;
  name: string;
  watts: number;
  defaultQty: number;
  initialQty?: number;
  qty?: number;
  defaultHours: number;
  hours?: number;
  icon?: string;
  checked: boolean;
  isBackup?: boolean;
  backupQty?: number;
  backupHours?: number;
  isHeavy?: boolean;
  ratedWatts?: number;
  acTon?: string;
  acType?: 'inverter' | 'non-inverter';
  acActualWatts?: number;
  pumpHp?: string;
  isCalculated?: boolean;
  calcParams?: Record<string, any>;
  calcResult?: Record<string, any>;
}

export interface InverterProduct {
  id: string;
  brand: string;
  model: string;
  type: string;
  kVA: number;
  kW: number;
  phase: string;
  batteryVoltage: number;
  continuousOutput: number;
  surgeOutput?: number;
  surgeDuration?: number;
  maxPvInput?: number;
  mpptVoltageRange?: string;
  maxPvCurrent?: number;
  maxBatteryDischargeCurrent?: number;
  approxPrice?: number;
  active?: boolean;
  ipRating?: string;
  warranty?: number;
  notes?: string;
}

export interface BatteryProduct {
  id: string;
  brand: string;
  model: string;
  type: string;
  chemistry?: string;
  voltage: number;
  ah: number;
  kWh?: number;
  active?: boolean;
  approxPrice?: number;
  cRating?: string;
  maxContinuousDischargeA?: number;
  peakDischargeA?: number;
  cycleLife?: number;
  dodPct?: number;
}

export interface SystemValidation {
  connectionPhase: SupplyPhase;
  isSinglePhase: boolean;
  sanctionedLoadKw: number;
  requiredKw: number;
  effectiveSolarKw: number;
  maxAllowedSinglePhaseKw: number;
  exceedsSinglePhase: boolean;
  exceedsSanctionedLoad: boolean;
  status: 'OK' | 'ERROR_SINGLE_PHASE_EXCEEDED' | 'WARN_SANCTIONED_LOAD_EXCEEDED';
  title: string;
  message: string;
  suggestion: string;
  actionType: 'NONE' | 'SWITCH_TO_3PHASE_OR_REDUCE' | 'ENHANCE_SANCTIONED_LOAD';
}

export interface InverterSelectionResult {
  matched: boolean;
  cappedSinglePhase: boolean;
  requestedKw?: number;
  brand: string;
  model: string;
  kVA: number;
  kW: number;
  phase: string;
  batteryVoltage: number;
  continuousOutput: number;
  surgeOutput?: number;
  surgeDuration?: number;
  maxPvInput?: number;
  mpptVoltageRange?: string;
  maxPvCurrent?: number;
  maxBatteryDischargeCurrent?: number;
  ipRating?: string;
  warranty?: number;
  notes?: string;
}

export interface BatterySelectionResult {
  energyCalculationBasis: string;
  backupLoadW: number;
  backupEnergyWh: number;
  backupEnergyKwh: number;
  requiredBatteryWh: number;
  requiredBatteryKwh: number;
  systemVoltage: number;
  systemBankAh: number;
  requiredAh: number;
  maxDischargeCurrentA: number;
  peakDischargeCurrentA: number;
  batteryType: string;
  selectedBrand: string;
  selectedModel: string;
  singleBatteryVolt: number;
  singleBatteryAh: number;
  singleBatteryKwh: number;
  capacityRating: string;
  dodPct: number;
  inverterEffPct: number;
  series: number;
  parallel: number;
  totalUnits: number;
  totalInstalledKwh: number;
  usableKwh: number;
  actualBackupHours: number;
  configurationText: string;
  dischargeCheckOk: boolean;
  maxDischargeCurrentCapacityA: number;
  isZeroLoad?: boolean;
  lithiumBmsWarning?: string;
}

export interface SolarCalculationResult {
  dailyDemandKwh: number;
  monthlyUnits: number;
  requiredSolarKwp: number;
  actualArrayKwp: number;
  recommendedKwp: number;
  permissibleArrayKwp: number;
  exceedsSanctionedLoad: boolean;
  sanctionedLoadKw: number;
  peakSunHours: number;
  effectivePrPct: number;
  totalLossPct: number;
  panelWatts: number;
  panelCount: number;
  estDailyGenKwh: number;
  estMonthlyGenUnits: number;
  estAnnualGenUnits: number;
  roofAreaSqFt: number;
  lossBreakdown: {
    inverterLossPct: number;
    dcAcCableLossPct: number;
    tempLossPct: number;
    soilingLossPct: number;
    shadingOrientationLossPct: number;
  };
}

export interface TariffSlabBreakdown {
  name: string;
  units: number;
  rate: number;
  amount: number;
}

export interface TariffAndPaybackResult {
  isRecoverable: boolean;
  recoveryError?: string;
  recoveryPeriodText: string;
  totalMonths: number;
  monthlySavings: number;
  annualSavings: number;
  totalMonthlyBill: number;
  baseEnergyCharge: number;
  fixedCharge: number;
  meterRent: number;
  electricityDuty: number;
  annualRoiPercent: number;
  sanctionedLoadKw: number;
  slabs: TariffSlabBreakdown[];
}

export interface FullSizingResult {
  systemType: SystemType;
  systemLabel: string;
  inverterCategory: string;
  connectionPhase: SupplyPhase;
  sanctionedLoadKw: number;
  connectedLoadW: number;
  backupLoadW: number;
  backupHours: number;
  requestedBackupHours: number;
  energyCalculationBasis: SizingBasis;
  dailyEnergyWh: number;
  dailyEnergyKwh: number;
  dailyDemandKwh: number;
  backupEnergyWh: number;
  backupEnergyKwh: number;
  totalApplianceDailyWh: number;
  backupApplianceDailyWh: number;
  targetBackupEnergyWh: number;
  safetyMarginPct: number;
  requiredContinuousW: number;
  requiredPeakSurgeW: number;
  validation: SystemValidation;
  inverter: InverterSelectionResult;
  battery: BatterySelectionResult | null;
  batteryLithium: BatterySelectionResult | null;
  batteryTubular: BatterySelectionResult | null;
  batteryFlatPlate: BatterySelectionResult | null;
  solar: SolarCalculationResult | null;
  warnings: string[];
  estimatedDailyKwh: number;
}
