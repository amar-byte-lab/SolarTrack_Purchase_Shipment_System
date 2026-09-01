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
    const sysTypeKey = (input && input.systemType) || 'off-grid';
    const sysMeta = SYSTEM_TYPE_MAP[sysTypeKey] || SYSTEM_TYPE_MAP['off-grid'];

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
      const qty = Math.max(0, Math.floor(Number(app.qty) || 0));
      if (qty <= 0) return;

      let watts = Math.max(0, Number(app.watts) || 0);

      // Handle Heavy Load Overrides & Starting Surge Calculation
      if (app.acTon) {
        if (app.acActualWatts && Number(app.acActualWatts) > 0) {
          watts = Math.max(1, Number(app.acActualWatts));
        }
        const acType = app.acType || 'inverter';
        const surgeMultiplier = acType === 'inverter'
          ? (Number(params.acInverterSurgeFactor) || 1.5)
          : (Number(params.acNonInverterSurgeFactor) || 3.0);

        // Surge delta above running watts = watts * (multiplier - 1) * qty
        const surgeDelta = Math.round((watts * (surgeMultiplier - 1)) * qty);
        heavyLoadSurgeDeltaW += surgeDelta;
        acWarnings.push(`AC starting surge (${acType === 'inverter' ? 'Inverter' : 'Non-Inverter'}, ${surgeMultiplier}x) accounted for in inverter peak rating.`);
      }

      if (app.pumpHp) {
        const surgeMultiplier = Number(params.pumpSurgeFactor) || 3.5;
        const surgeDelta = Math.round((watts * (surgeMultiplier - 1)) * qty);
        heavyLoadSurgeDeltaW += surgeDelta;
        pumpWarnings.push(`Pump motor starting surge (${surgeMultiplier}x) accounted for in inverter peak rating.`);
      }

      const totalAppWatts = watts * qty;
      connectedLoadW += totalAppWatts;

      const isBackup = !!app.isBackup;
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

    // 2. Base Load & Continuous/Peak Requirements
    const requiresBattery = sysMeta.requiresBattery || !!input.enableOnGridBattery;
    
    // For battery systems, use Backup Load if specified, otherwise fall back to Connected Load
    let baseRunningLoadW = connectedLoadW;
    if (requiresBattery) {
      baseRunningLoadW = backupLoadW > 0 ? backupLoadW : connectedLoadW;
    }

    const safetyMarginPct = Math.max(0, Number(params.safetyMarginPct) || 25);
    const requiredContinuousW = Math.round(baseRunningLoadW * (1 + safetyMarginPct / 100));
    const requiredPeakSurgeW = Math.round(requiredContinuousW + heavyLoadSurgeDeltaW);

    // 3. Solar PV Sizing (Calculated early so inverter selection can verify PV input limits)
    let solarResult = null;
    if (sysMeta.requiresSolar) {
      solarResult = calculateSolar({
        systemType: sysTypeKey,
        monthlyUnits: Number(input.monthlyUnits) || 0,
        dailyUsageKwh: Number(input.dailyUsageKwh) || estimatedDailyKwh,
        backupLoadW: backupLoadW > 0 ? backupLoadW : connectedLoadW,
        backupHours,
        peakSunHours: Number(params.peakSunHours) || 5.0,
        pvSystemEfficiencyPct: Number(params.pvSystemEfficiencyPct) || 78,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        batteryType: params.preferredBatteryType || 'lithium',
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        leadAcidDoDPct: Number(params.leadAcidDoDPct) || 50
      });
    }

    // 4. Select Inverter from Master Database
    const reqPvInputW = solarResult ? Math.round(solarResult.rawKwp * 1000) : 0;
    let inverterMatch = selectInverter({
      targetType: sysMeta.dbType,
      requiredContinuousW,
      requiredPeakSurgeW,
      reqPvInputW,
      inverterList: SizingDB.getInverters()
    });

    // 5. Calculate Battery Sizing & Configuration
    let batteryResult = null;
    if (requiresBattery) {
      const batteryType = params.preferredBatteryType || 'lithium';
      batteryResult = selectBattery({
        backupLoadW: backupLoadW > 0 ? backupLoadW : connectedLoadW,
        backupHours,
        inverterBatteryVoltage: inverterMatch.batteryVoltage,
        inverterMaxDischargeA: inverterMatch.maxBatteryDischargeCurrent,
        inverterEfficiencyPct: Number(params.inverterEfficiencyPct) || 90,
        batteryType,
        lithiumDoDPct: Number(params.lithiumDoDPct) || 90,
        leadAcidDoDPct: Number(params.leadAcidDoDPct) || 50,
        batteryList: SizingDB.getBatteries(),
        peakSurgeW: requiredPeakSurgeW
      });
    }

    // 6. Generate Contextual Warnings
    const warnings = generateWarnings({
      sysMeta,
      acWarnings,
      pumpWarnings,
      inverterMatch,
      batteryResult,
      solarResult
    });

    return {
      systemType: sysTypeKey,
      systemLabel: sysMeta.label,
      inverterCategory: sysMeta.inverterType,
      connectedLoadW,
      backupLoadW,
      backupHours,
      safetyMarginPct,
      requiredContinuousW,
      requiredPeakSurgeW,
      inverter: inverterMatch,
      battery: batteryResult,
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
        leadAcidDoDPct: Number(params.leadAcidDoDPct) || 50,
        peakSunHours: Number(params.peakSunHours) || 5.0,
        pvSystemEfficiencyPct: Number(params.pvSystemEfficiencyPct) || 78
      }
    };
  }

  /**
   * Search Inverter Master Database & Select Compliant Model (Single Phase Only)
   */
  function selectInverter({ targetType, requiredContinuousW, requiredPeakSurgeW, reqPvInputW, inverterList }) {
    const activeInverters = (inverterList || []).filter(inv => 
      inv.active && 
      inv.type === targetType && 
      (inv.phase === '1-Phase' || !inv.phase)
    );

    // Filter candidate inverters satisfying continuous output AND surge capability
    let candidates = activeInverters.filter(inv => {
      const contCap = inv.continuousOutput || Math.round(inv.kW * 1000);
      const surgeCap = inv.surgeOutput || (contCap * 2);
      return contCap >= requiredContinuousW && surgeCap >= requiredPeakSurgeW;
    });

    // If PV input requirement exists, prioritize candidates that also satisfy maxPvInput
    if (reqPvInputW > 0 && candidates.length > 0) {
      const pvCompliant = candidates.filter(inv => (inv.maxPvInput || 0) >= reqPvInputW);
      if (pvCompliant.length > 0) {
        candidates = pvCompliant;
      }
    }

    // Sort by continuous output (kW) ascending
    candidates.sort((a, b) => {
      const aKw = a.continuousOutput || (a.kW * 1000);
      const bKw = b.continuousOutput || (b.kW * 1000);
      if (aKw !== bKw) return aKw - bKw;
      return a.kVA - b.kVA;
    });

    if (candidates.length > 0) {
      const selected = candidates[0];
      return {
        matched: true,
        brand: selected.brand || 'Generic',
        model: selected.model || `${selected.kVA}kVA ${targetType}`,
        kVA: selected.kVA,
        kW: selected.kW,
        phase: '1-Phase (230V)',
        batteryVoltage: selected.batteryVoltage || 0,
        continuousOutput: selected.continuousOutput || Math.round(selected.kW * 1000),
        surgeOutput: selected.surgeOutput || (selected.kW * 2000),
        surgeDuration: selected.surgeDuration || 5,
        maxPvInput: selected.maxPvInput || 0,
        mpptVoltageRange: selected.mpptVoltageRange || 'N/A',
        maxPvCurrent: selected.maxPvCurrent || 0,
        maxBatteryDischargeCurrent: selected.maxBatteryDischargeCurrent || 150,
        ipRating: selected.ipRating || 'Not specified by manufacturer',
        warranty: selected.warranty || 2,
        notes: `Selected database model satisfying ${selected.continuousOutput || selected.kW * 1000}W continuous and ${selected.surgeOutput || selected.kW * 2000}W surge (Single Phase 230V).`
      };
    }

    // Mathematical Fallback if no exact model matches in DB (Single Phase Only)
    const approxKva = Math.max(0.9, Math.ceil((requiredContinuousW / 0.8) / 500) * 0.5);
    const approxKw = Math.round(approxKva * 0.8 * 10) / 10;
    
    let recVoltage = 48;
    if (requiredContinuousW <= 1500) recVoltage = 12;
    else if (requiredContinuousW <= 3000) recVoltage = 24;

    return {
      matched: false,
      brand: 'Product specification not available',
      model: `${approxKva} kVA ${targetType}`,
      kVA: approxKva,
      kW: approxKw,
      phase: '1-Phase (230V)',
      batteryVoltage: targetType === 'GTI' ? 0 : recVoltage,
      continuousOutput: requiredContinuousW,
      surgeOutput: requiredPeakSurgeW,
      surgeDuration: 5,
      maxPvInput: Math.round(approxKw * 1250),
      mpptVoltageRange: 'Datasheet pending',
      maxPvCurrent: 0,
      maxBatteryDischargeCurrent: 150,
      ipRating: 'Not specified by manufacturer',
      warranty: 0,
      notes: 'Product specification not available — verify manufacturer datasheet.'
    };
  }

  /**
   * Calculate Battery Sizing & Configuration
   */
  function selectBattery({
    backupLoadW,
    backupHours,
    inverterBatteryVoltage,
    inverterMaxDischargeA,
    inverterEfficiencyPct,
    batteryType,
    lithiumDoDPct,
    leadAcidDoDPct,
    batteryList,
    peakSurgeW
  }) {
    const backupEnergyWh = backupLoadW * backupHours;
    const eff = (inverterEfficiencyPct || 90) / 100;
    const dod = (batteryType === 'lithium' ? (lithiumDoDPct || 90) : (leadAcidDoDPct || 50)) / 100;

    // Nominal Required Energy (Wh) = Backup Energy ÷ (Inverter Efficiency × Usable DoD)
    const requiredBatteryWh = Math.round(backupEnergyWh / (eff * dod));

    // Recommend System Battery Voltage
    let systemVoltage = inverterBatteryVoltage;
    if (!systemVoltage || systemVoltage === 0) {
      if (backupLoadW <= 1500) systemVoltage = 12;
      else if (backupLoadW <= 3000) systemVoltage = 24;
      else systemVoltage = 48;
    }

    const requiredAh = Math.ceil(requiredBatteryWh / systemVoltage);

    // Continuous & Peak Discharge DC Currents required from Battery Bank
    const contDischargeCurrentA = Math.round(backupLoadW / (systemVoltage * eff));
    const peakDischargeCurrentA = Math.round((peakSurgeW || backupLoadW * 2) / (systemVoltage * eff));

    // Search Database for matching active battery models
    const isLithium = batteryType === 'lithium';
    const activeBatteries = (batteryList || []).filter(b => b.active && (isLithium ? b.type.includes('Lithium') : !b.type.includes('Lithium')));

    let selectedBat = activeBatteries[0];
    if (activeBatteries.length > 0) {
      // Sort by closest Ah capacity
      const sorted = [...activeBatteries].sort((a, b) => Math.abs(a.ah - requiredAh) - Math.abs(b.ah - requiredAh));
      selectedBat = sorted[0];
    }

    const singleVolt = selectedBat ? selectedBat.voltage : (systemVoltage >= 48 && isLithium ? systemVoltage : 12);
    const singleAh = selectedBat ? selectedBat.ah : 200;
    const singleKwh = selectedBat ? (selectedBat.kWh || (singleVolt * singleAh / 1000)) : (singleVolt * singleAh / 1000);
    const maxSingleContDischargeA = selectedBat ? (selectedBat.maxContinuousDischarge || 60) : 60;
    const maxSinglePeakDischargeA = selectedBat ? (selectedBat.peakDischarge || maxSingleContDischargeA * 1.5) : maxSingleContDischargeA * 1.5;
    const ratingLabel = selectedBat ? selectedBat.capacityRating : (isLithium ? 'Manufacturer Specified Discharge Rating' : 'C10');

    // Configuration Calculations: Series (S) & Parallel (P)
    let series = 1;
    if (singleVolt < systemVoltage) {
      series = Math.max(1, Math.round(systemVoltage / singleVolt));
    }

    let parallel = Math.max(1, Math.ceil(requiredAh / singleAh));

    // Ensure parallel strings satisfy continuous and peak DC discharge currents
    while ((maxSingleContDischargeA * parallel) < contDischargeCurrentA || (maxSinglePeakDischargeA * parallel) < peakDischargeCurrentA) {
      parallel++;
    }

    const totalUnits = series * parallel;
    const totalInstalledKwh = Math.round((totalUnits * singleKwh) * 10) / 10;
    const totalAh = parallel * singleAh;

    const dischargeCapA = maxSingleContDischargeA * parallel;
    const dischargeCheckOk = dischargeCapA >= contDischargeCurrentA;

    return {
      backupEnergyWh,
      requiredBatteryWh,
      systemVoltage,
      requiredAh,
      maxDischargeCurrentA: contDischargeCurrentA,
      peakDischargeCurrentA,
      batteryType: isLithium ? 'Lithium LFP' : 'Lead-Acid / Tubular',
      selectedBrand: selectedBat ? selectedBat.brand : 'Generic',
      selectedModel: selectedBat ? selectedBat.model : `${systemVoltage}V ${totalAh}Ah Bank`,
      singleBatteryVolt: singleVolt,
      singleBatteryAh: singleAh,
      singleBatteryKwh: singleKwh,
      capacityRating: ratingLabel,
      series,
      parallel,
      totalUnits,
      totalInstalledKwh,
      totalAh,
      configurationText: `${totalUnits} × ${singleVolt}V ${singleAh}Ah ${ratingLabel} (${series} Series × ${parallel} Parallel)`,
      dischargeCheckOk,
      maxDischargeCurrentCapacityA: dischargeCapA
    };
  }

  /**
   * Calculate Solar PV Capacity (Audited for Off-Grid Battery Recharge Energy)
   */
  function calculateSolar({
    systemType,
    monthlyUnits,
    dailyUsageKwh,
    backupLoadW,
    backupHours,
    peakSunHours,
    pvSystemEfficiencyPct,
    inverterEfficiencyPct,
    batteryType,
    lithiumDoDPct,
    leadAcidDoDPct
  }) {
    let dailyKwh = Math.max(0, dailyUsageKwh || 0);

    if (systemType === 'on-grid' && monthlyUnits > 0) {
      dailyKwh = monthlyUnits / 30;
    }

    // For Off-Grid & Hybrid: Include energy required to recharge discharged battery bank
    if (systemType === 'off-grid' || systemType === 'hybrid') {
      const backupWh = (backupLoadW || 0) * (backupHours || 4);
      const eff = (inverterEfficiencyPct || 90) / 100;
      const dod = (batteryType === 'lithium' ? (lithiumDoDPct || 90) : (leadAcidDoDPct || 50)) / 100;
      
      const batteryRechargeKwh = (backupWh / 1000) / (eff * dod);
      // Assume battery recharge replenishment adds to daily solar demand
      dailyKwh = Math.round((dailyKwh + batteryRechargeKwh * 0.5) * 100) / 100;
    }

    const sunHours = Math.max(1, peakSunHours || 5.0);
    const eff = Math.max(0.1, (pvSystemEfficiencyPct || 78) / 100);

    const rawKwp = dailyKwh / (sunHours * eff);
    // Round up to nearest 0.5 kWp
    const recommendedKwp = Math.max(1.0, Math.ceil(rawKwp * 2) / 2);

    const estDailyGenKwh = Math.round(recommendedKwp * sunHours * eff * 10) / 10;

    // Panel Sizing (Standard 550Wp Mono PERC)
    const panelWatts = 550;
    const panelCount = Math.ceil((recommendedKwp * 1000) / panelWatts);

    return {
      dailyKwh: Math.round(dailyKwh * 10) / 10,
      monthlyUnits: Math.round(dailyKwh * 30),
      rawKwp: Math.round(rawKwp * 100) / 100,
      recommendedKwp,
      estDailyGenKwh,
      panelCount,
      panelWatts,
      panelSpec: `${panelCount} × ${panelWatts}Wp Mono PERC Half-Cut Solar Modules`
    };
  }

  /**
   * Build Warnings Array
   */
  function generateWarnings({ sysMeta, acWarnings, pumpWarnings, inverterMatch, batteryResult, solarResult }) {
    const list = [];

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

  return {
    SYSTEM_TYPE_MAP,
    calculateSystem,
    selectInverter,
    selectBattery,
    calculateSolar
  };

})();
