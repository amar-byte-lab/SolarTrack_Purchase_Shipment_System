// Standard Load Calculator ported 1:1 from legacy sizing-calc.js
export interface CalcParams {
  screenSize?: string;
  displayType?: string;
  resolution?: string;
  brightness?: string;
  hdr?: string | boolean;
  manualWatts?: number | string;
  dailyHours?: number;
  capacityL?: number;
  doorType?: string;
  starRating?: number | string;
  compressorType?: string;
  ambientTemp?: string;
  usageCondition?: string;
  manufacturerKwhDay?: number | string;
  deviceType?: string;
  gpuType?: string;
  monitorCount?: number | string;
  intensity?: string;
  wmType?: string;
  capacityKg?: number | string;
  waterHeater?: string | boolean;
  program?: string;
  cyclesPerDay?: number;
  cycleDurationMin?: number;
  manufacturerKwhCycle?: number | string;
  ratedWatts?: number | string;
  standbyLoss?: string;
  sessionsPerDay?: number;
  sessionDurationMin?: number;
  ironType?: string;
  thermostatDuty?: string;
  daysPerWeek?: number;
  powerLevel?: string;
  durationPerSessionMin?: number;
  ton?: string;
  technology?: string;
  setpoint?: string;
  roomSize?: string;
  insulation?: string;
  motorHp?: string;
  pumpType?: string;
  motorEfficiency?: number;
  totalHeadM?: number;
  bulbWatts?: number;
  fanType?: string;
  speed?: string;
  appName?: string;
  operatingWatts?: number;
  [key: string]: any;
}

export interface CalcResult {
  appId: string;
  appName: string;
  ratedWatts: number;
  averageWatts: number;
  dailyHours: number;
  dailyWh: number;
  dailyKwh: number;
  explanation: string;
  params: CalcParams;
}

export const StandardLoadCalc = {

  /**
   * TV Load Calculator
   */
  calculateTv(p: CalcParams = {}): CalcResult {
    const screenSize = String(p.screenSize || '43');
    const displayType = p.displayType || 'led';
    const resolution = p.resolution || '4k';
    const brightness = p.brightness || 'standard';
    const hdr = p.hdr === 'on' || p.hdr === true;
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 4) || 4);
    const manualWatts = Number(p.manualWatts) || 0;

    const baseWattsMap: Record<string, number> = { '32': 40, '43': 65, '50': 85, '55': 100, '65': 140, '75': 190 };
    const baseWatts = baseWattsMap[screenSize] || 65;

    const displayMult = ({ led: 1.0, qled: 1.15, oled: 1.25 } as Record<string, number>)[displayType] || 1.0;
    const resMult = ({ hd: 0.85, fhd: 0.95, '4k': 1.0, '8k': 1.30 } as Record<string, number>)[resolution] || 1.0;
    const brightMult = ({ low: 0.85, standard: 1.0, high: 1.20 } as Record<string, number>)[brightness] || 1.0;
    const hdrMult = hdr ? 1.20 : 1.0;

    let averageWatts = 0;
    let ratedWatts = 0;

    if (manualWatts > 0) {
      averageWatts = manualWatts;
      ratedWatts = Math.round(manualWatts * 1.25);
    } else {
      averageWatts = Math.round(baseWatts * displayMult * resMult * brightMult * hdrMult);
      ratedWatts = Math.round(baseWatts * displayMult * resMult * 1.25);
    }

    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'tv',
      appName: 'TV',
      ratedWatts,
      averageWatts,
      dailyHours: Number(dailyHours.toFixed(1)),
      dailyWh,
      dailyKwh,
      explanation: `${screenSize}" ${displayType.toUpperCase()} (${resolution.toUpperCase()}) TV at ${brightness} brightness${hdr ? ' + HDR' : ''}. Estimated average power: ${averageWatts}W.`,
      params: { screenSize, displayType, resolution, brightness, hdr: hdr ? 'on' : 'off', dailyHours, manualWatts: manualWatts || '' }
    };
  },

  /**
   * Refrigerator Load Calculator (BEE 24-hr Standard Model)
   */
  calculateFridge(p: CalcParams = {}): CalcResult {
    const capacityL = Math.max(50, Number(p.capacityL) || 240);
    const doorType = p.doorType || 'double'; // 'single', 'double', 'sideBySide'
    const starRating = Math.max(1, Math.min(5, Number(p.starRating) || 3));
    const compressorType = p.compressorType || 'inverter'; // 'inverter', 'nonInverter'
    const ambientTemp = p.ambientTemp || 'normal'; // 'mild', 'normal', 'hot'
    const usageCondition = p.usageCondition || 'normal'; // 'low', 'normal', 'heavy'
    const manufacturerKwhDay = Number(p.manufacturerKwhDay) || 0;

    const ambientMult = ({ mild: 0.85, normal: 1.0, hot: 1.20 } as Record<string, number>)[ambientTemp] || 1.0;
    const usageMult = ({ low: 0.90, normal: 1.0, heavy: 1.15 } as Record<string, number>)[usageCondition] || 1.0;

    let dailyKwh = 0;

    if (manufacturerKwhDay > 0) {
      dailyKwh = manufacturerKwhDay * ambientMult * usageMult;
    } else {
      let baseDailyKwh = 0.75;
      let baseCap = 260;

      if (doorType === 'single') {
        baseDailyKwh = 0.55;
        baseCap = 200;
      } else if (doorType === 'sideBySide') {
        baseDailyKwh = 1.35;
        baseCap = 550;
      }

      const capScale = Math.pow(capacityL / baseCap, 0.6);
      const starFactor = ({ 5: 0.72, 4: 0.84, 3: 1.00, 2: 1.20, 1: 1.45 } as Record<number, number>)[starRating] || 1.0;
      const compFactor = compressorType === 'nonInverter' ? 1.25 : 1.0;

      dailyKwh = baseDailyKwh * capScale * starFactor * compFactor * ambientMult * usageMult;
    }

    const dailyWh = Math.round(dailyKwh * 1000);
    const dailyHours = 24.0;
    const averageWatts = Math.max(15, Math.round(dailyWh / 24));

    let ratedWatts = 160;
    if (doorType === 'single') ratedWatts = 110;
    else if (doorType === 'sideBySide') ratedWatts = 240;
    if (compressorType === 'nonInverter') ratedWatts = Math.round(ratedWatts * 1.2);
    if (capacityL > 350) ratedWatts = Math.round(ratedWatts * 1.15);

    return {
      appId: 'fridge',
      appName: 'Refrigerator',
      ratedWatts,
      averageWatts,
      dailyHours: 24.0,
      dailyWh,
      dailyKwh: Number((dailyWh / 1000).toFixed(3)),
      explanation: `${capacityL}L ${doorType === 'single' ? 'Single Door' : (doorType === 'sideBySide' ? 'Side-by-Side' : 'Double Door')} ${starRating}-Star (${compressorType === 'inverter' ? 'Inverter' : 'Non-Inverter'}). Refrigerator runs 24h with intermittent compressor cycling (avg: ${averageWatts}W, rated: ${ratedWatts}W).`,
      params: { capacityL, doorType, starRating, compressorType, ambientTemp, usageCondition, manufacturerKwhDay: manufacturerKwhDay || '', dailyHours: 24 }
    };
  },

  /**
   * Computer / Laptop Load Calculator
   */
  calculateComputer(p: CalcParams = {}): CalcResult {
    const deviceType = p.deviceType || 'laptop';
    const gpuType = p.gpuType || 'integrated'; // 'integrated', 'dedicatedMid', 'dedicatedHigh'
    const monitorCount = Math.max(0, Number(p.monitorCount) || (deviceType === 'laptop' ? 0 : 1));
    const intensity = p.intensity || 'moderate'; // 'light', 'moderate', 'heavy'
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 6) || 6);
    const manualWatts = Number(p.manualWatts) || 0;

    let baseWatts = deviceType === 'laptop' ? 45 : 150;
    let baseRated = deviceType === 'laptop' ? 65 : 300;

    const gpuWatts = ({ integrated: 0, dedicatedMid: 45, dedicatedHigh: 110 } as Record<string, number>)[gpuType] || 0;
    const gpuRated = ({ integrated: 0, dedicatedMid: 75, dedicatedHigh: 180 } as Record<string, number>)[gpuType] || 0;
    const monitorWatts = monitorCount * 25;
    const intensityMult = ({ light: 0.70, moderate: 1.0, heavy: 1.45 } as Record<string, number>)[intensity] || 1.0;

    let averageWatts = 0;
    let ratedWatts = 0;

    if (manualWatts > 0) {
      averageWatts = manualWatts;
      ratedWatts = Math.round(manualWatts * 1.35);
    } else {
      if (deviceType === 'laptop') {
        const laptopBase = (gpuType === 'integrated') ? 28 : (gpuType === 'dedicatedMid' ? 75 : 130);
        averageWatts = Math.round(laptopBase * intensityMult + monitorWatts);
        ratedWatts = baseRated + gpuRated + monitorWatts;
      } else {
        averageWatts = Math.round((baseWatts + gpuWatts) * intensityMult + monitorWatts);
        ratedWatts = baseRated + gpuRated + monitorWatts;
      }
    }

    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'comp',
      appName: 'Computer / Laptop',
      ratedWatts,
      averageWatts,
      dailyHours: Number(dailyHours.toFixed(1)),
      dailyWh,
      dailyKwh,
      explanation: `${deviceType === 'laptop' ? 'Laptop Notebook' : 'Desktop Workstation'} (${gpuType === 'integrated' ? 'Integrated GPU' : (gpuType === 'dedicatedMid' ? 'Mid GPU' : 'High-End GPU')}${monitorCount > 0 ? ` + ${monitorCount} ext monitor(s)` : ''}) at ${intensity} workload. Average: ${averageWatts}W, Rated PSU: ${ratedWatts}W.`,
      params: { deviceType, gpuType, monitorCount, intensity, dailyHours, manualWatts: manualWatts || '' }
    };
  },

  /**
   * Washing Machine Load Calculator
   */
  calculateWashingMachine(p: CalcParams = {}): CalcResult {
    const wmType = p.wmType || 'topLoad'; // 'topLoad', 'semi', 'frontLoad'
    const capacityKg = Number(p.capacityKg) || 7;
    const waterHeater = p.waterHeater === 'enabled' || (p.waterHeater as any) === true;
    const program = p.program || 'normal'; // 'quick', 'normal', 'heavy'
    const cyclesPerDay = Math.max(0.1, Number(p.cyclesPerDay !== undefined ? p.cyclesPerDay : 1) || 1);
    const cycleDurationMin = Math.max(15, Number(p.cycleDurationMin !== undefined ? p.cycleDurationMin : (wmType === 'frontLoad' ? 60 : 45)) || 45);
    const manufacturerKwhCycle = Number(p.manufacturerKwhCycle) || 0;

    let kwhPerCycle = 0;
    let motorWatts = 240;
    let ratedWatts = 450;

    if (manufacturerKwhCycle > 0) {
      kwhPerCycle = manufacturerKwhCycle;
    } else {
      let baseKwh = 0.18;
      if (wmType === 'semi') {
        baseKwh = 0.12;
        motorWatts = 200;
        ratedWatts = 350;
      } else if (wmType === 'topLoad') {
        baseKwh = 0.18;
        motorWatts = 240;
        ratedWatts = 450;
      } else if (wmType === 'frontLoad') {
        baseKwh = 0.28;
        motorWatts = 300;
        ratedWatts = 550;
      }

      const capMult = 1.0 + (capacityKg - 7) * 0.05;
      const progMult = ({ quick: 0.65, normal: 1.0, heavy: 1.35 } as Record<string, number>)[program] || 1.0;
      kwhPerCycle = baseKwh * capMult * progMult;

      if (waterHeater) {
        kwhPerCycle += 1.0; // ~1.0 kWh for heating wash water
        ratedWatts = 2050; // Heater element ~1800W + motor
      }
    }

    const dailyKwh = Number((kwhPerCycle * cyclesPerDay).toFixed(3));
    const dailyWh = Math.round(dailyKwh * 1000);
    const dailyHours = Number(((cycleDurationMin / 60) * cyclesPerDay).toFixed(2));
    const averageWatts = dailyHours > 0 ? Math.round(dailyWh / dailyHours) : motorWatts;

    return {
      appId: 'wm',
      appName: 'Washing Machine',
      ratedWatts,
      averageWatts,
      dailyHours,
      dailyWh,
      dailyKwh,
      explanation: `${capacityKg}kg ${wmType === 'frontLoad' ? 'Front Load' : (wmType === 'semi' ? 'Semi-Automatic' : 'Top Load')} (${waterHeater ? '60°C Hot Wash + Heater' : 'Cold Wash'}). Average running power: ${averageWatts}W across ${cyclesPerDay} cycle(s)/day (${cycleDurationMin} min/cycle).`,
      params: { wmType, capacityKg, waterHeater: waterHeater ? 'enabled' : 'disabled', program, cyclesPerDay, cycleDurationMin, manufacturerKwhCycle: manufacturerKwhCycle || '', dailyHours }
    };
  },

  /**
   * Geyser / Water Heater Load Calculator
   */
  calculateGeyser(p: CalcParams = {}): CalcResult {
    const ratedWatts = Math.max(500, Number(p.ratedWatts) || 2000);
    const capacityL = Math.max(5, Number(p.capacityL) || 15);
    const sessionsPerDay = Math.max(0.1, Number(p.sessionsPerDay !== undefined ? p.sessionsPerDay : 1) || 1);
    const sessionDurationMin = Math.max(5, Number(p.sessionDurationMin !== undefined ? p.sessionDurationMin : 20) || 20);
    const standbyLoss = p.standbyLoss === 'keptOn';

    const sessionHours = (sessionDurationMin / 60) * sessionsPerDay;
    const activeWh = ratedWatts * sessionHours;
    const standingWh = standbyLoss ? 500 : 0; // 0.50 kWh standing loss if kept on
    const dailyWh = Math.round(activeWh + standingWh);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));
    const dailyHours = Number(sessionHours.toFixed(2));

    return {
      appId: 'geyser',
      appName: 'Geyser',
      ratedWatts,
      averageWatts: ratedWatts,
      dailyHours,
      dailyWh,
      dailyKwh,
      explanation: `${capacityL}L Geyser with ${ratedWatts}W heating element running for ${sessionsPerDay} session(s) (${sessionDurationMin} min/session)${standbyLoss ? ' + 0.50 kWh standing thermal loss' : ''}.`,
      params: { ratedWatts, capacityL, sessionsPerDay, sessionDurationMin, standbyLoss: standbyLoss ? 'keptOn' : 'switchedOff', dailyHours }
    };
  },

  /**
   * Electric Iron Load Calculator
   */
  calculateIron(p: CalcParams = {}): CalcResult {
    const ironType = p.ironType || 'dry';
    const ratedWatts = Math.max(400, Number(p.ratedWatts) || (ironType === 'steam' ? 1600 : 1000));
    const thermostatDuty = p.thermostatDuty || 'medium'; // 'low' (35%), 'medium' (50%), 'high' (65%)
    const sessionDurationMin = Math.max(5, Number(p.sessionDurationMin !== undefined ? p.sessionDurationMin : 30) || 30);
    const daysPerWeek = Math.max(1, Math.min(7, Number(p.daysPerWeek !== undefined ? p.daysPerWeek : 7) || 7));

    const dutyFactor = ({ low: 0.35, medium: 0.50, high: 0.65 } as Record<string, number>)[thermostatDuty] || 0.50;
    const averageWatts = Math.round(ratedWatts * dutyFactor);
    const sessionHours = sessionDurationMin / 60;
    const dailyHours = Number(((sessionHours * daysPerWeek) / 7).toFixed(2));
    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'iron',
      appName: 'Iron',
      ratedWatts,
      averageWatts,
      dailyHours,
      dailyWh,
      dailyKwh,
      explanation: `${ironType === 'steam' ? 'Steam' : 'Dry'} Iron (${ratedWatts}W) with ${Math.round(dutyFactor * 100)}% thermostat duty cycle. Operating power: ${averageWatts}W. Ironing ${daysPerWeek} day(s)/week for ${sessionDurationMin} min.`,
      params: { ironType, ratedWatts, thermostatDuty, sessionDurationMin, daysPerWeek, dailyHours }
    };
  },

  /**
   * Induction Cooktop Load Calculator
   */
  calculateInduction(p: CalcParams = {}): CalcResult {
    const ratedWatts = Math.max(800, Number(p.ratedWatts) || 2000);
    const powerLevel = p.powerLevel || 'mixed'; // 'low' (35%), 'medium' (60%), 'high' (90%), 'mixed' (58%)
    const sessionsPerDay = Math.max(0.1, Number(p.sessionsPerDay !== undefined ? p.sessionsPerDay : 2) || 2);
    const durationPerSessionMin = Math.max(5, Number(p.durationPerSessionMin !== undefined ? p.durationPerSessionMin : 30) || 30);

    const levelFactor = ({ low: 0.35, medium: 0.60, high: 0.90, mixed: 0.58 } as Record<string, number>)[powerLevel] || 0.58;
    const averageWatts = Math.round(ratedWatts * levelFactor);
    const dailyHours = Number(((durationPerSessionMin / 60) * sessionsPerDay).toFixed(2));
    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'induction',
      appName: 'Induction Cooker',
      ratedWatts,
      averageWatts,
      dailyHours,
      dailyWh,
      dailyKwh,
      explanation: `${ratedWatts}W Induction Cooker at ${powerLevel} heat setting (~${averageWatts}W average power). Cooking ${sessionsPerDay} session(s)/day (${durationPerSessionMin} min each).`,
      params: { ratedWatts, powerLevel, sessionsPerDay, durationPerSessionMin, dailyHours }
    };
  },

  /**
   * Air Conditioner Load Calculator (BEE ISEER Inverter Model)
   */
  calculateAc(p: CalcParams = {}): CalcResult {
    const ton = String(p.ton || '1.5');
    const technology = p.technology || 'inverter'; // 'inverter', 'nonInverter'
    const starRating = String(p.starRating || '3');
    const ambientTemp = p.ambientTemp || 'normal'; // 'mild', 'normal', 'peak'
    const setpoint = String(p.setpoint || '24');
    const roomSize = p.roomSize || 'medium'; // 'small', 'medium', 'large'
    const insulation = p.insulation || 'average'; // 'good', 'average', 'poor'
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 8) || 8);
    const manualWatts = Number(p.manualWatts) || 0;

    const ratedWattsMap: Record<string, number> = { '0.5': 600, '1': 1050, '1.5': 1450, '2': 1950 };
    const ratedWatts = ratedWattsMap[ton] || 1450;

    let averageWatts = 0;

    if (manualWatts > 0) {
      averageWatts = manualWatts;
    } else {
      let baseAvgWatts = ({ '0.5': 380, '1': 620, '1.5': 850, '2': 1180 } as Record<string, number>)[ton] || 850;

      if (technology === 'nonInverter') {
        baseAvgWatts = Math.round(ratedWatts * 0.75); // Non-inverter cycling average ~75%
      }

      const starFactor = ({ '1-2': 1.15, '3': 1.00, '5': 0.82 } as Record<string, number>)[starRating] || 1.00;
      const setpointFactor = ({ '20': 1.25, '22': 1.12, '24': 1.00, '26': 0.88 } as Record<string, number>)[setpoint] || 1.00;
      const ambientFactor = ({ mild: 0.88, normal: 1.00, peak: 1.22 } as Record<string, number>)[ambientTemp] || 1.00;
      const roomFactor = ({ small: 0.90, medium: 1.00, large: 1.15 } as Record<string, number>)[roomSize] || 1.00;
      const insulFactor = ({ good: 0.90, average: 1.00, poor: 1.15 } as Record<string, number>)[insulation] || 1.00;

      averageWatts = Math.round(baseAvgWatts * starFactor * setpointFactor * ambientFactor * roomFactor * insulFactor);
    }

    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'ac',
      appName: 'Air Conditioner',
      ratedWatts,
      averageWatts,
      dailyHours: Number(dailyHours.toFixed(1)),
      dailyWh,
      dailyKwh,
      explanation: `${ton} Ton ${starRating}-Star (${technology === 'inverter' ? 'Inverter' : 'Fixed Speed'}) AC at ${setpoint}°C setpoint. Rated peak input: ${ratedWatts}W, estimated modulated operating average: ${averageWatts}W.`,
      params: { ton, technology, starRating, ambientTemp, setpoint, roomSize, insulation, dailyHours, manualWatts: manualWatts || '' }
    };
  },

  /**
   * Water Pump Motor Load Calculator
   */
  calculatePump(p: CalcParams = {}): CalcResult {
    const motorHp = String(p.motorHp || '1');
    const pumpType = p.pumpType || 'monoblock'; // 'monoblock', 'submersible'
    const motorEfficiency = Math.max(50, Math.min(95, Number(p.motorEfficiency) || 70));
    const totalHeadM = Math.max(5, Number(p.totalHeadM) || 25);
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 1) || 1);
    const manualWatts = Number(p.manualWatts) || 0;

    const hpVal = Number(motorHp) || 1.0;
    const shaftPowerWatts = hpVal * 746;
    const calculatedInputWatts = Math.round(shaftPowerWatts / (motorEfficiency / 100));

    let electricalWatts = manualWatts > 0 ? manualWatts : calculatedInputWatts;
    const dailyWh = Math.round(electricalWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'pump',
      appName: 'Water Pump',
      ratedWatts: electricalWatts,
      averageWatts: electricalWatts,
      dailyHours: Number(dailyHours.toFixed(2)),
      dailyWh,
      dailyKwh,
      explanation: `${motorHp} HP ${pumpType === 'submersible' ? 'Submersible' : 'Monoblock'} Pump (${motorEfficiency}% motor efficiency, ${totalHeadM}m head). Calculated electrical input: ${electricalWatts}W (~${(electricalWatts / 1000).toFixed(2)} kW).`,
      params: { motorHp, pumpType, motorEfficiency, totalHeadM, dailyHours, manualWatts: manualWatts || '' }
    };
  },

  /**
   * LED Lighting Load Calculator
   */
  calculateLed(p: CalcParams = {}): CalcResult {
    const bulbWatts = Math.max(1, Number(p.bulbWatts) || 10);
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 14) || 14);
    const dailyWh = Math.round(bulbWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'led',
      appName: 'LED Light',
      ratedWatts: bulbWatts,
      averageWatts: bulbWatts,
      dailyHours: Number(dailyHours.toFixed(1)),
      dailyWh,
      dailyKwh,
      explanation: `${bulbWatts}W LED lighting operating for ${dailyHours} hrs/day.`,
      params: { bulbWatts, dailyHours }
    };
  },

  /**
   * Fan Load Calculator
   */
  calculateFan(p: CalcParams = {}): CalcResult {
    const fanType = p.fanType || 'induction'; // 'induction', 'bldc'
    const speed = p.speed || 'medium'; // 'low', 'medium', 'high'
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 14) || 14);

    let ratedWatts = 75;
    let averageWatts = 55;

    if (fanType === 'bldc') {
      ratedWatts = 32;
      averageWatts = ({ low: 14, medium: 24, high: 32 } as Record<string, number>)[speed] || 24;
    } else {
      ratedWatts = 75;
      averageWatts = ({ low: 35, medium: 55, high: 75 } as Record<string, number>)[speed] || 55;
    }

    const dailyWh = Math.round(averageWatts * dailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'fan',
      appName: 'Fan',
      ratedWatts,
      averageWatts,
      dailyHours: Number(dailyHours.toFixed(1)),
      dailyWh,
      dailyKwh,
      explanation: `${fanType === 'bldc' ? 'BLDC Energy-Saving' : 'Standard Ceiling'} Fan at ${speed} speed setting (Avg: ${averageWatts}W, Rated: ${ratedWatts}W).`,
      params: { fanType, speed, dailyHours }
    };
  },

  /**
   * Generic / Other Custom Appliance Calculator
   */
  calculateOther(p: CalcParams = {}): CalcResult {
    const appName = String(p.appName || 'Custom Appliance');
    const ratedWatts = Math.max(1, Number(p.ratedWatts) || 100);
    const operatingWatts = Math.max(1, Number(p.operatingWatts !== undefined ? p.operatingWatts : ratedWatts) || 100);
    const dailyHours = Math.max(0.1, Number(p.dailyHours !== undefined ? p.dailyHours : 4) || 4);
    const daysPerWeek = Math.max(1, Math.min(7, Number(p.daysPerWeek !== undefined ? p.daysPerWeek : 7) || 7));

    const effectiveDailyHours = Number(((dailyHours * daysPerWeek) / 7).toFixed(2));
    const dailyWh = Math.round(operatingWatts * effectiveDailyHours);
    const dailyKwh = Number((dailyWh / 1000).toFixed(3));

    return {
      appId: 'other',
      appName,
      ratedWatts,
      averageWatts: operatingWatts,
      dailyHours: effectiveDailyHours,
      dailyWh,
      dailyKwh,
      explanation: `${appName} with ${ratedWatts}W rated power and ${operatingWatts}W operating average power used ${daysPerWeek} day(s)/week for ${dailyHours} hrs/day.`,
      params: { appName, ratedWatts, operatingWatts, dailyHours, daysPerWeek }
    };
  },

  /**
   * Master Dispatcher: maps any appliance ID or keyword to the right calculator
   */
  calculate(appId: string, appName: string = '', params: CalcParams = {}): CalcResult {
    const id = String(appId || '').toLowerCase();
    const name = String(appName || '').toLowerCase();

    if (id === 'tv' || name.includes('tv') || name.includes('television')) {
      return this.calculateTv(params);
    }
    if (id === 'fridge' || name.includes('fridge') || name.includes('refrigerator')) {
      return this.calculateFridge(params);
    }
    if (id === 'comp' || name.includes('computer') || name.includes('laptop') || name.includes('pc')) {
      return this.calculateComputer(params);
    }
    if (id === 'wm' || name.includes('washing') || name.includes('washer')) {
      return this.calculateWashingMachine(params);
    }
    if (id === 'geyser' || name.includes('geyser') || name.includes('water heater')) {
      return this.calculateGeyser(params);
    }
    if (id === 'iron' || name.includes('iron')) {
      return this.calculateIron(params);
    }
    if (id === 'induction' || name.includes('induction') || name.includes('cooker')) {
      return this.calculateInduction(params);
    }
    if (id === 'ac' || name.includes('ac') || name.includes('air conditioner') || name.includes('cooler')) {
      return this.calculateAc(params);
    }
    if (id === 'pump' || name.includes('pump') || name.includes('motor')) {
      return this.calculatePump(params);
    }
    if (id === 'led' || name.includes('light') || name.includes('led') || name.includes('tube')) {
      return this.calculateLed(params);
    }
    if (id === 'fan' || name.includes('fan')) {
      return this.calculateFan(params);
    }

    return this.calculateOther({ ...params, appName: appName || 'Custom Appliance' });
  }
};
