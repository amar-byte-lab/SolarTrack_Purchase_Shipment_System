/* =========================================================================
   sizing-calc.js — Audited & Rectified Core Solar & Inverter-Battery Sizing Engine
   Full engineering & mathematical compliance for On-Grid, Off-Grid, Hybrid,
   and Without Solar systems (Single Phase 230V Focus).
   ========================================================================= */

const SizingCalc = (() => {

  const SYSTEM_TYPE_MAP = {
    'on-grid': {
      label: 'On-Grid Solar',
      inverterType: 'GTI / Grid-Tied Inverter',
      dbType: 'GTI',
      requiresBattery: false,
      requiresSolar: true,
    },
    'off-grid': {
      label: 'Off-Grid Solar',
      inverterType: 'PCU / Solar PCU',
      dbType: 'PCU',
      requiresBattery: true,
      requiresSolar: true,
    },
    'hybrid': {
      label: 'Hybrid Solar',
      inverterType: 'Bi-Directional / Hybrid Inverter',
      dbType: 'Hybrid',
      requiresBattery: true,
      requiresSolar: true,
    },
    'without-solar': {
      label: 'Without Solar / Battery Backup',
      inverterType: 'Home UPS / Digital UPS / Pure Sine Wave UPS',
      dbType: 'UPS',
      requiresBattery: true,
      requiresSolar: false,
    }
  };

  /**
   * Main Audited Sizing Function
   * @param {Object} input
   */
  function calculateSystem(input) {
    const params = { ...SizingDB.getParams(), ...(input.customParams || {}) };
    const sysTypeKey = (input && input.systemType) || 'on-grid';
    const sysMeta = SYSTEM_TYPE_MAP[sysTypeKey] || SYSTEM_TYPE_MAP['on-grid'];

    const rawAppliances = (input && input.appliances) || [];
    const backupHours = Math.max(0.5, Number(input.backupHours) || 4);

    // 1. Audit & Sanitize Appliance Inputs
    let connectedLoadW = 0;
    let backupLoadW = 0;
    let estimatedDailyKwh = 0;
    let heavyLoadSurgeDeltaW = 0;

    const acWarnings = [];
    const pumpWarnings = [];
    const sanitizedAppliances = [];

    rawAppliances.forEach(app => {
      if (app.checked === false || app.isSelected === false) return;
      const qty = Math.max(0, Math.floor(Number(app.qty !== undefined ? app.qty : app.defaultQty) || 0));
      if (qty <= 0) return;

      let watts = Math.max(0, Number(app.watts) || 0);

      // Handle Heavy Load Overrides & Starting Surge Calculation (AC)
      if (app.id === 'ac' || app.acTon || app.isHeavy && app.name && app.name.toLowerCase().includes('ac')) {
        const acTon = app.acTon || '1.5';
        if (app.acActualWatts && Number(app.acActualWatts) > 0) {
          watts = Math.max(1, Number(app.acActualWatts));
        } else if (!watts || watts === 0) {
          const tonWattsMap = { '0.5': 600, '1': 1200, '1.5': 1800, '2': 2400 };
          watts = tonWattsMap[acTon] || 1800;
        }
        const acType = app.acType || 'inverter';
        const surgeMultiplier = acType === 'inverter'
          ? (Number(params.acInverterSurgeFactor) || 1.5)
          : (Number(params.acNonInverterSurgeFactor) || 3.0);

        const surgeDelta = Math.round((watts * (surgeMultiplier - 1)) * qty);
        heavyLoadSurgeDeltaW += surgeDelta;
        acWarnings.push(`AC starting surge (${acType === 'inverter' ? 'Inverter AC' : 'Non-Inverter AC'}, ${surgeMultiplier}x) accounted for in inverter peak rating.`);
      }

      // Handle Heavy Load Overrides & Starting Surge Calculation (Water Pump)
      if (app.id === 'pump' || app.pumpHp || app.isHeavy && app.name && app.name.toLowerCase().includes('pump')) {
        const pumpHp = app.pumpHp || '1';
        if (!watts || watts === 0) {
          const hpWattsMap = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 };
          watts = hpWattsMap[pumpHp] || 746;
        }
        const surgeMultiplier = Number(params.pumpSurgeFactor) || 3.5;
        const surgeDelta = Math.round((watts * (surgeMultiplier - 1)) * qty);
        heavyLoadSurgeDeltaW += surgeDelta;
        pumpWarnings.push(`Pump motor starting surge (${surgeMultiplier}x) accounted for in inverter peak rating.`);
      }

      const totalAppWatts = watts * qty;
      connectedLoadW += totalAppWatts;

      const isBackup = app.isBackup !== undefined ? !!app.isBackup : true;
      if (isBackup) {
        backupLoadW += totalAppWatts;
      }

      const hours = Math.max(0.1, Number(app.hours || app.defaultHours) || 4);
      estimatedDailyKwh += (totalAppWatts * hours) / 1000;

      sanitizedAppliances.push({
        ...app,
        qty,
        watts,
        hours,
        totalAppWatts,
        isBackup
      });
    });

    // 2. Solar PV Sizing (Executed ONLY when requiresSolar is true: On-Grid, Hybrid, Off-Grid. NEVER Without Solar)
    let solarResult = null;
    if (sysMeta.requiresSolar) {
      solarResult = calculateSolar({
        systemType: sysTypeKey,
        monthlyUnits: Number(input.monthlyUnits) || 300,
        dailyUsageKwh: Number(input.dailyUsageKwh) || estimatedDailyKwh,
        peakSunHours: Number(params.peakSunHours) || 5.0,
        pvSystemEfficiencyPct: Number(params.pvSystemEfficiencyPct) || 78
      });
    }

    // 3. Base Load & Continuous/Peak Requirements
    const safetyMarginPct = Math.max(0, Number(params.safetyMarginPct) || 25);
    let baseRunningLoadW = connectedLoadW;
    let requiredContinuousW = Math.round(baseRunningLoadW * (1 + safetyMarginPct / 100));

    // For On-Grid (GTI) & Hybrid: Inverter continuous capacity is driven by Solar PV Array rating
    if (sysTypeKey === 'on-grid' && solarResult && solarResult.actualArrayKwp > 0) {
      const solarArrayContinuousW = Math.round(solarResult.actualArrayKwp * 1000);
      requiredContinuousW = Math.max(requiredContinuousW, solarArrayContinuousW);
    } else if (sysTypeKey === 'hybrid' && solarResult && solarResult.actualArrayKwp > 0) {
      const solarArrayContinuousW = Math.round(solarResult.actualArrayKwp * 1000);
      requiredContinuousW = Math.max(requiredContinuousW, solarArrayContinuousW);
    }

    const requiredPeakSurgeW = Math.round(requiredContinuousW + heavyLoadSurgeDeltaW);

    // 4. Validate Single-Phase Permissible Limit (5 kW max in India/DISCOMs) & Sanctioned Load
    const connectionPhase = input.connectionPhase || '1-Phase';
    const sanctionedLoadKw = Math.max(0.5, Number(input.sanctionedLoadKw) || 3);
    const isSinglePhase = connectionPhase === '1-Phase' || !connectionPhase;
    const SINGLE_PHASE_MAX_LIMIT_KW = 5.0;

    const rawRequiredKw = Math.round((requiredContinuousW / 1000) * 10) / 10;
    const exceedsSinglePhase = isSinglePhase && rawRequiredKw > SINGLE_PHASE_MAX_LIMIT_KW;
    const exceedsSanctionedLoad = rawRequiredKw > sanctionedLoadKw;

    const validation = {
      connectionPhase,
      isSinglePhase,
      sanctionedLoadKw,
      requiredKw: rawRequiredKw,
      maxAllowedSinglePhaseKw: SINGLE_PHASE_MAX_LIMIT_KW,
      exceedsSinglePhase,
      exceedsSanctionedLoad,
      status: exceedsSinglePhase ? 'ERROR_SINGLE_PHASE_EXCEEDED' : (exceedsSanctionedLoad ? 'WARN_SANCTIONED_LOAD_EXCEEDED' : 'OK'),
      title: '',
      message: '',
      suggestion: '',
      actionType: exceedsSinglePhase ? 'SWITCH_TO_3PHASE_OR_REDUCE' : (exceedsSanctionedLoad ? 'ENHANCE_SANCTIONED_LOAD' : 'NONE')
    };

    if (exceedsSinglePhase) {
      validation.title = 'Single-Phase Statutory Limit Exceeded';
      validation.message = `Calculated inverter requirement of ${rawRequiredKw} kW exceeds the permissible Single-Phase (230V) limit of 5.0 kW. Under DISCOM net-metering regulations in India, single-phase rooftop solar installations above 5 kW are not allowed.`;
      validation.suggestion = `Switch your grid supply connection to Three-Phase (415V) or reduce plant capacity to ≤ 5.0 kWp.`;
    } else if (exceedsSanctionedLoad) {
      validation.title = 'Sanctioned Meter Load Enhancement Required';
      validation.message = `Calculated inverter capacity (${rawRequiredKw} kW) exceeds customer's current sanctioned load (${sanctionedLoadKw} kW). Net-metering regulations require solar capacity not to exceed 100% of sanctioned load.`;
      validation.suggestion = `Customer must apply for sanctioned load enhancement to ${Math.ceil(rawRequiredKw)} kW before solar net-meter installation.`;
    }

    // 5. Select Inverter from Master Database
    const reqPvInputW = solarResult ? Math.round(solarResult.actualArrayKwp * 1000) : 0;
    let inverterMatch = selectInverter({
      targetType: sysMeta.dbType,
      requiredContinuousW,
      requiredPeakSurgeW,
      reqPvInputW,
      inverterList: SizingDB.getInverters(),
      connectionPhase,
      isSinglePhase,
      exceedsSinglePhase,
      sanctionedLoadKw
    });

    // 6. Calculate Battery Sizing & Configuration (STRICTLY for Without Solar, Hybrid, Off-Grid. NEVER for On-Grid)
    let batteryResult = null;
    let batteryLithium = null;
    let batteryTubular = null;
    let batteryFlatPlate = null;

    if (sysMeta.requiresBattery) {
      const activeBackupW = backupLoadW > 0 ? backupLoadW : connectedLoadW;
      const chosenBatteryType = input.batteryType || params.preferredBatteryType || 'lithium';

      batteryLithium = selectBattery({
        backupLoadW: activeBackupW,
        backupHours: backupHours || 4,
        inverterBatteryVoltage: inverterMatch.batteryVoltage,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        batteryType: 'lithium',
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        tubularDoDPct: Number(params.tubularDoDPct) || 75,
        flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
        batteryList: SizingDB.getBatteries(),
        peakSurgeW: requiredPeakSurgeW
      });

      batteryTubular = selectBattery({
        backupLoadW: activeBackupW,
        backupHours: backupHours || 4,
        inverterBatteryVoltage: inverterMatch.batteryVoltage,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        batteryType: 'tubular',
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        tubularDoDPct: Number(params.tubularDoDPct) || 75,
        flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
        batteryList: SizingDB.getBatteries(),
        peakSurgeW: requiredPeakSurgeW
      });

      batteryFlatPlate = selectBattery({
        backupLoadW: activeBackupW,
        backupHours: backupHours || 4,
        inverterBatteryVoltage: inverterMatch.batteryVoltage,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        batteryType: 'flat-plate',
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        tubularDoDPct: Number(params.tubularDoDPct) || 75,
        flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
        batteryList: SizingDB.getBatteries(),
        peakSurgeW: requiredPeakSurgeW
      });

      if (chosenBatteryType === 'tubular') {
        batteryResult = batteryTubular;
      } else if (chosenBatteryType === 'flat-plate') {
        batteryResult = batteryFlatPlate;
      } else {
        batteryResult = batteryLithium;
      }
    }

    // 7. Generate Contextual Warnings
    const warnings = generateWarnings({
      sysMeta,
      acWarnings,
      pumpWarnings,
      inverterMatch,
      batteryResult,
      solarResult,
      validation
    });

    return {
      systemType: sysTypeKey,
      systemLabel: sysMeta.label,
      inverterCategory: sysMeta.inverterType,
      connectionPhase,
      sanctionedLoadKw,
      connectedLoadW,
      backupLoadW,
      backupHours,
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
      estimatedDailyKwh: Math.round(estimatedDailyKwh * 100) / 100,
      calculationDetails: {
        baseRunningLoadW,
        heavyLoadSurgeDeltaW,
        safetyMarginW: Math.round(baseRunningLoadW * (safetyMarginPct / 100)),
        requiredContinuousW,
        requiredPeakSurgeW,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        tubularDoDPct: Number(params.tubularDoDPct) || 75,
        flatPlateDoDPct: Number(params.flatPlateDoDPct) || 65,
        peakSunHours: Number(params.peakSunHours) || 5.0,
        pvSystemEfficiencyPct: Number(params.pvSystemEfficiencyPct) || 78
      }
    };
  }

  /**
   * Search Inverter Master Database & Select Compliant Model (With Single-Phase Safeguards)
   */
  function selectInverter({
    targetType,
    requiredContinuousW,
    requiredPeakSurgeW,
    reqPvInputW,
    inverterList,
    connectionPhase = '1-Phase',
    isSinglePhase = true,
    exceedsSinglePhase = false,
    sanctionedLoadKw = 3
  }) {
    const activeInverters = (inverterList || []).filter(inv => 
      inv.active && 
      inv.type === targetType
    );

    // If customer has a single-phase connection and requirement exceeds 5 kW:
    // DO NOT recommend an oversized single-phase inverter (>5kW).
    // Cap single-phase recommendation to 5.0 kW max and flag upgrade requirement.
    if (isSinglePhase && exceedsSinglePhase) {
      const targetReqKw = Math.round((requiredContinuousW / 1000) * 10) / 10;

      // Find max compliant single-phase model (5 kW)
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
          surgeDuration: selected.surgeDuration || 5,
          maxPvInput: selected.maxPvInput || 7500,
          mpptVoltageRange: selected.mpptVoltageRange || '80V - 550V',
          maxPvCurrent: selected.maxPvCurrent || 13,
          maxBatteryDischargeCurrent: selected.maxBatteryDischargeCurrent || 100,
          ipRating: selected.ipRating || 'IP65',
          warranty: selected.warranty || 5,
          notes: `⚠️ CAPPED at DISCOM statutory 1-Phase limit (5.0 kW). System requires ${targetReqKw} kW — upgrade to Three-Phase (415V) to install full capacity.`
        };
      }

      // Fallback 5 kW 1-Phase capped
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
        surgeDuration: 5,
        maxPvInput: 7500,
        mpptVoltageRange: '80V - 550V',
        maxPvCurrent: 13,
        maxBatteryDischargeCurrent: 100,
        ipRating: 'IP65',
        warranty: 5,
        notes: `⚠️ CAPPED at DISCOM statutory 1-Phase limit (5.0 kW). System requires ${targetReqKw} kW — upgrade to Three-Phase (415V) to install full capacity.`
      };
    }

    // Standard Inverter Selection for compliant 1-Phase (<= 5kW) or 3-Phase
    let candidates = activeInverters.filter(inv => {
      const contCap = inv.continuousOutput || Math.round(inv.kW * 1000);
      const surgeCap = inv.surgeOutput || (contCap * 2);
      return contCap >= requiredContinuousW && surgeCap >= requiredPeakSurgeW;
    });

    // If PV input requirement exists, prioritize candidates that satisfy maxPvInput
    if (reqPvInputW > 0 && candidates.length > 0) {
      const pvCompliant = candidates.filter(inv => (inv.maxPvInput || 0) >= reqPvInputW);
      if (pvCompliant.length > 0) {
        candidates = pvCompliant;
      }
    }

    // Filter by supply phase
    if (isSinglePhase) {
      candidates = candidates.filter(c => c.phase === '1-Phase' || !c.phase);
    } else {
      // 3-Phase preference for >= 6kW or if 3-Phase is explicitly chosen
      const threePhaseCandidates = candidates.filter(c => c.phase === '3-Phase');
      if (threePhaseCandidates.length > 0) {
        candidates = threePhaseCandidates;
      }
    }

    // Sort by continuous output (kW) ascending, then kVA
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
        surgeDuration: selected.surgeDuration || 5,
        maxPvInput: selected.maxPvInput || 0,
        mpptVoltageRange: selected.mpptVoltageRange || 'N/A',
        maxPvCurrent: selected.maxPvCurrent || 0,
        maxBatteryDischargeCurrent: selected.maxBatteryDischargeCurrent || 150,
        ipRating: selected.ipRating || 'IP21 / IP65',
        warranty: selected.warranty || 5,
        notes: `Selected database model satisfying ${selected.continuousOutput || selected.kW * 1000}W continuous and ${selected.surgeOutput || selected.kW * 2000}W surge (${phaseLabel}).`
      };
    }

    // Mathematical Fallback for custom or high-capacity requirements
    const phaseText = isSinglePhase ? '1-Phase (230V)' : '3-Phase (415V)';

    if (targetType === 'GTI') {
      const approxKw = Math.max(1, Math.ceil(requiredContinuousW / 1000));
      const approxKva = approxKw;
      return {
        matched: false,
        cappedSinglePhase: false,
        brand: 'Tier 1 Grid-Tied Inverter',
        model: `${approxKw} kW ${phaseText} GTI`,
        kVA: approxKva,
        kW: approxKw,
        phase: phaseText,
        batteryVoltage: 0,
        continuousOutput: approxKw * 1000,
        surgeOutput: Math.round(approxKw * 1100),
        surgeDuration: 5,
        maxPvInput: Math.round(approxKw * 1400),
        mpptVoltageRange: isSinglePhase ? '80V - 550V' : '160V - 850V',
        maxPvCurrent: isSinglePhase ? 16 : 32,
        maxBatteryDischargeCurrent: 0,
        ipRating: 'IP65 (Outdoor Waterproof)',
        warranty: 5,
        notes: `Engineering sizing: ${approxKw} kW Grid-Tied Inverter (${phaseText}).`
      };
    }

    if (targetType === 'Hybrid') {
      const approxKw = Math.max(3, Math.ceil(requiredContinuousW / 1000));
      const approxKva = approxKw;
      return {
        matched: false,
        cappedSinglePhase: false,
        brand: 'Tier 1 Bi-Directional Hybrid Inverter',
        model: `${approxKw} kW ${phaseText} Hybrid`,
        kVA: approxKva,
        kW: approxKw,
        phase: phaseText,
        batteryVoltage: 48,
        continuousOutput: approxKw * 1000,
        surgeOutput: approxKw * 2000,
        surgeDuration: 10,
        maxPvInput: Math.round(approxKw * 1300),
        mpptVoltageRange: isSinglePhase ? '125V - 500V' : '160V - 800V',
        maxPvCurrent: isSinglePhase ? 26 : 32,
        maxBatteryDischargeCurrent: Math.round((approxKw * 1000) / 48),
        ipRating: 'IP65 (Outdoor Waterproof)',
        warranty: 5,
        notes: `Engineering sizing: ${approxKw} kW Hybrid Inverter with 48V DC battery interface (${phaseText}).`
      };
    }

    if (targetType === 'PCU') {
      const approxKva = Math.max(1, Math.ceil((requiredContinuousW / 0.8) / 500) * 0.5);
      const approxKw = Math.round(approxKva * 0.8 * 10) / 10;
      let recVoltage = 48;
      if (approxKw <= 1.0) recVoltage = 12;
      else if (approxKw <= 2.0) recVoltage = 24;
      else if (approxKw <= 5.0) recVoltage = 48;
      else if (approxKw <= 8.0) recVoltage = 96;
      else recVoltage = 120;

      return {
        matched: false,
        cappedSinglePhase: false,
        brand: 'Tier 1 Solar PCU',
        model: `${approxKva} kVA / ${recVoltage}V Solar PCU`,
        kVA: approxKva,
        kW: approxKw,
        phase: phaseText,
        batteryVoltage: recVoltage,
        continuousOutput: Math.round(approxKw * 1000),
        surgeOutput: Math.max(requiredPeakSurgeW, Math.round(approxKw * 2000)),
        surgeDuration: 10,
        maxPvInput: Math.round(approxKw * 1250),
        mpptVoltageRange: recVoltage >= 96 ? '120V - 240V' : (recVoltage >= 48 ? '60V - 160V' : '30V - 90V'),
        maxPvCurrent: 80,
        maxBatteryDischargeCurrent: Math.round((approxKw * 1000) / recVoltage),
        ipRating: 'IP21',
        warranty: 2,
        notes: `Engineering sizing: ${approxKva} kVA / ${approxKw} kW Solar PCU with ${recVoltage}V DC battery bank.`
      };
    }

    // Default UPS Fallback
    const approxKva = Math.max(0.9, Math.ceil((requiredContinuousW / 0.8) / 500) * 0.5);
    const approxKw = Math.round(approxKva * 0.8 * 10) / 10;
    let recVoltage = 12;
    if (approxKw <= 0.8) recVoltage = 12;
    else if (approxKw <= 1.6) recVoltage = 24;
    else if (approxKw <= 2.2) recVoltage = 36;
    else if (approxKw <= 4.0) recVoltage = 48;
    else if (approxKw <= 6.5) recVoltage = 96;
    else recVoltage = 120;

    return {
      matched: false,
      cappedSinglePhase: false,
      brand: 'Pure Sine Wave UPS',
      model: `${approxKva} kVA / ${recVoltage}V Sine Wave UPS`,
      kVA: approxKva,
      kW: approxKw,
      phase: '1-Phase (230V)',
      batteryVoltage: recVoltage,
      continuousOutput: Math.round(approxKw * 1000),
      surgeOutput: Math.max(requiredPeakSurgeW, Math.round(approxKw * 2000)),
      surgeDuration: 5,
      maxPvInput: 0,
      mpptVoltageRange: 'N/A',
      maxPvCurrent: 0,
      maxBatteryDischargeCurrent: Math.round((approxKw * 1000) / recVoltage),
      ipRating: 'IP20',
      warranty: 2,
      notes: `Engineering sizing: ${approxKva} kVA / ${approxKw} kW Pure Sine Wave Home UPS with ${recVoltage}V DC battery bank.`
    };
  }

  /**
   * Calculate Battery Sizing & Configuration
   * Strictly based on: Backup Energy = Connected Load (kW) × Backup Hours
   * Required Battery kWh = Backup Energy / (Usable DoD × Inverter Efficiency)
   */
  function selectBattery({
    backupLoadW,
    backupHours,
    inverterBatteryVoltage,
    inverterEfficiencyPct,
    batteryType,
    lithiumDoDPct,
    tubularDoDPct,
    flatPlateDoDPct,
    batteryList,
    peakSurgeW
  }) {
    const isLithium = batteryType === 'lithium';
    const isTubular = batteryType === 'tubular';
    const isFlatPlate = batteryType === 'flat-plate';

    const eff = (inverterEfficiencyPct || 90) / 100;
    let dod = 0.90;
    if (isLithium) {
      dod = (lithiumDoDPct || 90) / 100;
    } else if (isTubular) {
      dod = (tubularDoDPct || 75) / 100;
    } else if (isFlatPlate) {
      dod = (flatPlateDoDPct || 65) / 100;
    } else {
      dod = 0.75;
    }

    // 1. Backup Energy (kWh) = Connected Load (kW) × Backup Hours
    const loadKw = (Math.max(10, backupLoadW || 500)) / 1000;
    const targetHours = Math.max(0.5, Number(backupHours) || 4);
    const backupEnergyKwh = Math.round((loadKw * targetHours) * 100) / 100;
    const backupEnergyWh = Math.round(backupEnergyKwh * 1000);

    // 2. Required Nominal Battery Capacity (kWh) = Backup Energy ÷ (Inverter Efficiency × Usable DoD)
    const requiredBatteryKwh = Math.round((backupEnergyKwh / (eff * dod)) * 100) / 100;
    const requiredBatteryWh = Math.round(requiredBatteryKwh * 1000);

    // 3. Determine System DC Bus Voltage (matching inverter DC bus)
    let systemVoltage = inverterBatteryVoltage;
    if (!systemVoltage || systemVoltage === 0) {
      if (backupLoadW <= 1000) systemVoltage = 12;
      else if (backupLoadW <= 2000) systemVoltage = 24;
      else if (backupLoadW <= 4000) systemVoltage = 48;
      else if (backupLoadW <= 8000) systemVoltage = 96;
      else systemVoltage = 120;
    }

    const requiredAh = Math.ceil(requiredBatteryWh / systemVoltage);

    // Continuous & Peak Discharge DC Currents
    const contDischargeCurrentA = Math.round((loadKw * 1000) / (systemVoltage * eff));
    const peakDischargeCurrentA = Math.round((peakSurgeW || backupLoadW * 2) / (systemVoltage * eff));

    // 4. Search Database for matching active battery models
    const activeBatteries = (batteryList || []).filter(b => {
      if (!b.active) return false;
      if (isLithium) return b.type.toLowerCase().includes('lithium');
      if (isTubular) return b.type.toLowerCase().includes('tubular');
      if (isFlatPlate) return b.type.toLowerCase().includes('flat plate');
      return true;
    });

    let selectedBat = null;
    if (activeBatteries.length > 0) {
      if (isLithium) {
        // Match closest nominal voltage (12.8V for 12V, 25.6V for 24V, 48V/51.2V for 48V)
        const voltMatch = activeBatteries.filter(b => {
          if (systemVoltage === 12) return b.voltage <= 14;
          if (systemVoltage === 24) return b.voltage >= 20 && b.voltage <= 28;
          if (systemVoltage === 48) return b.voltage >= 40 && b.voltage <= 55;
          return b.voltage === systemVoltage;
        });
        const pool = voltMatch.length > 0 ? voltMatch : activeBatteries;
        const sorted = [...pool].sort((a, b) => Math.abs(a.ah - requiredAh) - Math.abs(b.ah - requiredAh));
        selectedBat = sorted[0];
      } else {
        // 12V 150Ah or 200Ah Lead-Acid
        const prefAh = requiredAh > 180 ? 200 : 150;
        selectedBat = activeBatteries.find(b => b.ah === prefAh) || activeBatteries[0];
      }
    }

    const singleVolt = selectedBat ? selectedBat.voltage : (isLithium && systemVoltage >= 48 ? systemVoltage : 12);
    const singleAh = selectedBat ? selectedBat.ah : (isLithium ? (requiredAh >= 150 ? 200 : 100) : 150);
    const singleKwh = Math.round(((singleVolt * singleAh) / 1000) * 100) / 100;
    const maxSingleContDischargeA = selectedBat ? (selectedBat.maxContinuousDischarge || (singleAh * 0.5)) : (singleAh * 0.5);
    const maxSinglePeakDischargeA = selectedBat ? (selectedBat.peakDischarge || singleAh) : singleAh;
    const ratingLabel = isLithium ? 'LiFePO4 Smart Pack' : (isTubular ? 'C10 Tall Tubular' : 'C20 Flat Plate');

    // 5. Calculate Exact Series (S) and Parallel (P) strings
    let series = 1;
    if (singleVolt < systemVoltage) {
      series = Math.max(1, Math.round(systemVoltage / singleVolt));
    }

    const stringKwh = series * singleKwh;
    let parallel = Math.max(1, Math.ceil(requiredBatteryKwh / stringKwh));

    // Ensure parallel strings satisfy continuous and peak DC discharge currents
    while ((maxSingleContDischargeA * parallel) < contDischargeCurrentA || (maxSinglePeakDischargeA * parallel) < peakDischargeCurrentA) {
      parallel++;
    }

    const totalUnits = series * parallel;
    // Total Installed kWh = Total Modules × Module Voltage × Module Ah / 1000 = System Voltage × System Bank Ah / 1000
    const systemBankAh = parallel * singleAh;
    const totalInstalledKwh = Math.round(((totalUnits * singleVolt * singleAh) / 1000) * 100) / 100;
    const usableKwh = Math.round((totalInstalledKwh * dod * eff) * 100) / 100;
    const actualBackupHours = Math.round((usableKwh / loadKw) * 10) / 10;

    const dischargeCapA = Math.round(maxSingleContDischargeA * parallel);
    const dischargeCheckOk = dischargeCapA >= contDischargeCurrentA;

    return {
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
      selectedBrand: selectedBat ? selectedBat.brand : (isLithium ? 'Tata Power / Growatt' : 'Exide / Luminous'),
      selectedModel: selectedBat ? selectedBat.model : `${systemVoltage}V ${systemBankAh}Ah Bank`,
      singleBatteryVolt: singleVolt,
      singleBatteryAh: singleAh,
      singleBatteryKwh: singleKwh,
      capacityRating: ratingLabel,
      dodPct: Math.round(dod * 100),
      inverterEffPct: Math.round(eff * 100),
      series,
      parallel,
      totalUnits,
      totalInstalledKwh,
      usableKwh,
      actualBackupHours,
      configurationText: `${totalUnits} × ${singleVolt}V ${singleAh}Ah (${series} Series × ${parallel} Parallel)`,
      dischargeCheckOk,
      maxDischargeCurrentCapacityA: dischargeCapA
    };
  }

  /**
   * Calculate Solar PV Capacity
   * Strictly based on:
   * Daily Demand = Monthly Billing Units / 30
   * Required Solar kWp = Daily Demand / (Peak Sun Hours × (PR / 100))
   * Panel Count = CEIL(Required Solar kWp * 1000 / Panel Wattage)
   * Actual Array kWp = Panel Count * Panel Wattage / 1000
   */
  function calculateSolar({
    systemType,
    monthlyUnits,
    dailyUsageKwh,
    peakSunHours,
    pvSystemEfficiencyPct
  }) {
    let dailyDemandKwh = 0;

    if (systemType === 'on-grid') {
      const units = Number(monthlyUnits) || 300;
      dailyDemandKwh = units / 30;
    } else {
      // For Hybrid / Off-Grid: Use monthly units if provided, else daily appliances kWh
      if (Number(monthlyUnits) > 0) {
        dailyDemandKwh = Number(monthlyUnits) / 30;
      } else {
        dailyDemandKwh = Math.max(1, Number(dailyUsageKwh) || 10);
      }
    }

    const sunHours = Math.max(1, Number(peakSunHours) || 5.0);
    const prEff = Math.max(0.1, (Number(pvSystemEfficiencyPct) || 78) / 100);

    // Required Solar kWp
    const requiredSolarKwp = dailyDemandKwh / (sunHours * prEff);

    // Standard 550Wp Mono PERC Panels
    const panelWatts = 550;
    const panelCount = Math.ceil((requiredSolarKwp * 1000) / panelWatts);

    // Actual Installed Array kWp = panelCount * panelWatts / 1000
    const actualArrayKwp = Math.round(((panelCount * panelWatts) / 1000) * 100) / 100;

    // Estimated Daily Generation = actualArrayKwp * PSH * PR
    const estDailyGenKwh = Math.round((actualArrayKwp * sunHours * prEff) * 100) / 100;
    const estMonthlyGenUnits = Math.round(estDailyGenKwh * 30);
    const roofAreaSqFt = Math.round(actualArrayKwp * 100);

    return {
      dailyDemandKwh: Math.round(dailyDemandKwh * 100) / 100,
      monthlyUnits: Math.round(dailyDemandKwh * 30),
      requiredSolarKwp: Math.round(requiredSolarKwp * 100) / 100,
      actualArrayKwp,
      recommendedKwp: actualArrayKwp,
      estDailyGenKwh,
      estMonthlyGenUnits,
      panelCount,
      panelWatts,
      roofAreaSqFt,
      panelSpec: `${panelCount} Panels × ${panelWatts}Wp Mono PERC Half-Cut Modules (${actualArrayKwp} kWp Array)`
    };
  }

  /**
   * Build Warnings Array
   */
  function generateWarnings({ sysMeta, acWarnings, pumpWarnings, inverterMatch, batteryResult, solarResult, validation }) {
    const list = [];

    if (validation) {
      if (validation.exceedsSinglePhase) {
        list.push(`⛔ Single-Phase Limit Exceeded: Calculated capacity (${validation.requiredKw} kW) exceeds statutory 1-Phase limit (5.0 kW). DISCOM requires Three-Phase (415V) connection.`);
      } else if (validation.exceedsSanctionedLoad) {
        list.push(`⚠️ Sanctioned Load Enhancement: Required inverter (${validation.requiredKw} kW) exceeds current sanctioned load (${validation.sanctionedLoadKw} kW). Apply for load enhancement before net-metering.`);
      }
    }

    acWarnings.forEach(w => list.push(`⚠️ ${w}`));
    list.push('⚠️ Verify actual AC nameplate wattage before final customer quotation.');

    pumpWarnings.forEach(w => list.push(`⚠️ ${w}`));

    if (solarResult && inverterMatch && inverterMatch.maxPvInput > 0) {
      if ((solarResult.recommendedKwp * 1000) > inverterMatch.maxPvInput) {
        list.push(`⚠️ Recommended Solar PV (${solarResult.recommendedKwp} kWp) exceeds inverter Max PV Input limit (${inverterMatch.maxPvInput / 1000} kWp). High-voltage MPPT stringing required.`);
      }
    }

    if (batteryResult) {
      if (batteryResult.capacityRating && batteryResult.capacityRating !== 'Manufacturer Specified Discharge Rating') {
        list.push(`⚠️ Battery ${batteryResult.capacityRating} rating is taken directly from manufacturer datasheets.`);
      } else {
        list.push('⚠️ Battery discharge rating is specified per manufacturer datasheet.');
      }
    }

    if (inverterMatch) {
      if (inverterMatch.ipRating && inverterMatch.ipRating !== 'Not specified by manufacturer') {
        list.push(`⚠️ Inverter IP rating (${inverterMatch.ipRating}) is product-specific and does not imply complete outdoor waterproofing.`);
      } else {
        list.push('⚠️ Inverter IP rating is not specified by manufacturer — verify datasheet before outdoor mounting.');
      }
    }

    list.push('⚠️ Final installation must comply with inverter, battery, and applicable electrical safety standards.');

    return list;
  }

  /**
   * Odisha OERC Domestic Tariff & Solar Investment Recovery Engine
   * @param {Object} opts
   * @returns {Object}
   */
  function calculateOdishaTariffAndPayback({ monthlyUnits = 450, capitalSpend = 150000, sanctionedLoadKw = 1, annualInterestRate = 0 }) {
    const u = Math.max(0, Number(monthlyUnits) || 0);
    const spend = Math.max(0, Number(capitalSpend) || 0);
    const loadKw = Math.max(0.5, Number(sanctionedLoadKw) || 1);
    const interestRate = Math.max(0, Number(annualInterestRate) || 0);

    // 1. Odisha OERC Telescopic Tariff Structure
    const slab1Units = Math.min(u, 50);
    const slab1Rate = 2.90;
    const slab1Amount = slab1Units * slab1Rate;

    const slab2Units = Math.min(Math.max(0, u - 50), 150);
    const slab2Rate = 4.70;
    const slab2Amount = slab2Units * slab2Rate;

    const slab3Units = Math.min(Math.max(0, u - 200), 200);
    const slab3Rate = 5.70;
    const slab3Amount = slab3Units * slab3Rate;

    const slab4Units = Math.max(0, u - 400);
    const slab4Rate = 6.10;
    const slab4Amount = slab4Units * slab4Rate;

    const baseEnergyCharge = slab1Amount + slab2Amount + slab3Amount + slab4Amount;
    const fixedCharge = loadKw * 20; // ₹20 per kW sanctioned load
    const meterRent = 10; // ₹10 flat meter rent
    const electricityDuty = baseEnergyCharge * 0.04; // 4% of Base Energy Charge
    const totalMonthlyBill = baseEnergyCharge + fixedCharge + meterRent + electricityDuty;
    const monthlySavings = totalMonthlyBill;
    const annualSavings = monthlySavings * 12;

    // 2. Recovery Timeline (Payback Period)
    let totalMonths = 0;
    let isRecoverable = true;
    let recoveryError = '';
    let totalInterestPaid = 0;

    if (spend <= 0) {
      totalMonths = 0;
    } else if (monthlySavings <= 0) {
      isRecoverable = false;
      recoveryError = 'Monthly savings is ₹0. Cannot calculate recovery timeline.';
    } else if (interestRate === 0) {
      totalMonths = spend / monthlySavings;
    } else {
      const monthlyInterestRate = (interestRate / 100) / 12;
      const initialMonthlyInterest = spend * monthlyInterestRate;

      if (monthlySavings <= initialMonthlyInterest) {
        isRecoverable = false;
        recoveryError = `Investment cannot be recovered with this savings rate. Initial monthly interest (₹${Math.round(initialMonthlyInterest).toLocaleString('en-IN')}) exceeds monthly savings (₹${Math.round(monthlySavings).toLocaleString('en-IN')}).`;
      } else {
        let remainingBalance = spend;
        let monthsCount = 0;
        const MAX_MONTHS = 600; // 50 years maximum limit

        while (remainingBalance > 0 && monthsCount < MAX_MONTHS) {
          const interest = remainingBalance * monthlyInterestRate;
          totalInterestPaid += interest;
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

    // 3. Format Human-Friendly Recovery Period
    let recoveryPeriodText = '';
    let wholeYears = 0;
    let remainingMonths = 0;

    if (isRecoverable) {
      if (spend <= 0) {
        recoveryPeriodText = 'Immediate (0 Months)';
      } else {
        wholeYears = Math.floor(totalMonths / 12);
        remainingMonths = Math.round(totalMonths % 12);
        if (remainingMonths === 12) {
          wholeYears += 1;
          remainingMonths = 0;
        }

        if (wholeYears === 0) {
          recoveryPeriodText = `${remainingMonths} Month${remainingMonths === 1 ? '' : 's'}`;
        } else if (remainingMonths === 0) {
          recoveryPeriodText = `${wholeYears} Year${wholeYears === 1 ? '' : 's'}`;
        } else {
          recoveryPeriodText = `${wholeYears} Year${wholeYears === 1 ? '' : 's'} and ${remainingMonths} Month${remainingMonths === 1 ? '' : 's'}`;
        }
      }
    }

    // 4. Lifetime Long-Term ROI Projections
    const fiveYearSavings = monthlySavings * 60;
    const tenYearSavings = monthlySavings * 120;
    const twentyFiveYearSavings = monthlySavings * 300;
    const net25YearProfit = twentyFiveYearSavings - spend - totalInterestPaid;
    const annualRoiPercent = spend > 0 ? ((annualSavings / spend) * 100).toFixed(1) : '100.0';

    return {
      monthlyUnits: u,
      capitalSpend: spend,
      sanctionedLoadKw: loadKw,
      annualInterestRate: interestRate,
      slabs: [
        { name: '1 to 50 Units', units: slab1Units, rate: slab1Rate, amount: slab1Amount },
        { name: '51 to 200 Units', units: slab2Units, rate: slab2Rate, amount: slab2Amount },
        { name: '201 to 400 Units', units: slab3Units, rate: slab3Rate, amount: slab3Amount },
        { name: 'Above 400 Units', units: slab4Units, rate: slab4Rate, amount: slab4Amount }
      ],
      baseEnergyCharge,
      fixedCharge,
      meterRent,
      electricityDuty,
      totalMonthlyBill,
      monthlySavings,
      annualSavings,
      isRecoverable,
      recoveryError,
      totalMonths: Number(totalMonths.toFixed(1)),
      wholeYears,
      remainingMonths,
      recoveryPeriodText,
      totalInterestPaid: Math.round(totalInterestPaid),
      fiveYearSavings,
      tenYearSavings,
      twentyFiveYearSavings,
      net25YearProfit,
      annualRoiPercent
    };
  }

  return {
    SYSTEM_TYPE_MAP,
    calculateSystem,
    selectInverter,
    selectBattery,
    calculateSolar,
    calculateOdishaTariffAndPayback
  };

})();
