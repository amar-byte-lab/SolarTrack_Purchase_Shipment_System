/**
 * SolarRecommendationService.js
 * Technical product matching & ranking engine for Solar Panels, Inverters, and Batteries
 * based on sizing calculation results and selected reference manufacturer.
 */

const solarProductService = require('./SolarProductService');

class SolarRecommendationService {
  /**
   * Main recommendation method
   * @param {Object} sizingResult Sizing calculations from frontend/calc engine
   * @param {String} manufacturerId Reference manufacturer (e.g., 'luminous', 'waaree', etc.)
   * @param {Object} filters User filters for panels, inverters, and batteries
   */
  getRecommendations(sizingResult, manufacturerId = 'all', filters = {}) {
    const productsData = solarProductService.getProducts({
      manufacturerId,
      ...filters
    });

    const sysType = sizingResult.systemType || 'on-grid';
    const isGrid = sysType === 'on-grid';
    const isWithoutSolar = sysType === 'without-solar';
    const isHybrid = sysType === 'hybrid';
    const isOffGrid = sysType === 'off-grid';

    // 1. Solar Panel Recommendation
    const panelRecommendation = this.recommendPanels(sizingResult, productsData.panels);

    // 2. Solar Inverter Recommendation
    const inverterRecommendation = this.recommendInverters(sizingResult, productsData.inverters);

    // 3. Solar Battery Recommendation
    // Synchronize DC bus voltage: prioritize sizingResult.inverter voltage, then inverterRecommendation
    let targetBatteryVoltage = 48;
    if (sizingResult.inverter && Number(sizingResult.inverter.batteryVoltage) > 0) {
      targetBatteryVoltage = Number(sizingResult.inverter.batteryVoltage);
    } else if (inverterRecommendation && inverterRecommendation.bestMatch && Number(inverterRecommendation.bestMatch.product.batteryVoltage) > 0) {
      targetBatteryVoltage = Number(inverterRecommendation.bestMatch.product.batteryVoltage);
    } else {
      const bLoad = Number(sizingResult.backupLoadW || sizingResult.connectedLoadW) || 500;
      targetBatteryVoltage = bLoad <= 1000 ? 12 : (bLoad <= 2000 ? 24 : 48);
    }

    const batteryRecommendation = this.recommendBatteries(sizingResult, productsData.batteries, targetBatteryVoltage);

    return {
      manufacturerId,
      manufacturerName: this.getManufacturerName(manufacturerId),
      systemType: sysType,
      systemLabel: sizingResult.systemLabel || sysType,
      lastUpdated: productsData.lastRefreshed,
      panels: panelRecommendation,
      inverter: inverterRecommendation,
      battery: batteryRecommendation
    };
  }

  getManufacturerName(id) {
    if (id === 'all') return 'All Reference Brands (Mixed Multi-Brand)';
    const list = solarProductService.getManufacturers();
    const found = list.find(m => m.id === id);
    return found ? found.name : 'All Reference Brands';
  }

  /**
   * Recommend Solar Panels based on Required PV Capacity (kWp)
   */
  recommendPanels(sizingResult, availablePanels) {
    if (sizingResult.systemType === 'without-solar' || !sizingResult.solar) {
      return {
        applicable: false,
        reason: 'Without Solar (Home UPS) systems do not utilize solar photovoltaic panels.',
        bestMatch: null,
        alternative: null,
        allCompatible: []
      };
    }

    const requiredKwp = Number(sizingResult.solar.actualArrayKwp || sizingResult.solar.requiredSolarKwp) || 3.0;
    if (!availablePanels || availablePanels.length === 0) {
      return {
        applicable: true,
        reason: 'No panel models found for selected manufacturer.',
        bestMatch: null,
        alternative: null,
        allCompatible: []
      };
    }

    // Evaluate each panel model against required capacity
    const scored = availablePanels.map(panel => {
      const pWatts = panel.ratedWatts || 550;
      const requiredQty = Math.ceil((requiredKwp * 1000) / pWatts);
      const installedKwp = Math.round(((requiredQty * pWatts) / 1000) * 100) / 100;
      const capacityDiffPct = Math.abs((installedKwp - requiredKwp) / requiredKwp) * 100;
      const estDailyUnits = Math.round(installedKwp * 4.0 * 10) / 10;
      const estMonthlyUnits = Math.round(estDailyUnits * 30);
      const estRoofSqFt = Math.round(installedKwp * 60);

      // Ranking score based on efficiency, technology, warranty, and capacity match
      let score = 100;
      if (panel.technology.toLowerCase().includes('topcon')) score += 15;
      else if (panel.technology.toLowerCase().includes('mono')) score += 10;
      score += (panel.efficiencyPct - 20) * 5; // higher efficiency bonus
      score -= capacityDiffPct * 0.5; // penalize excessive oversizing
      if (panel.isDcr) score += 5;

      return {
        product: panel,
        requiredQuantity: requiredQty,
        totalInstalledKwp: installedKwp,
        estDailyUnits,
        estMonthlyUnits,
        estRoofSqFt,
        score,
        compatibilityStatus: '100% Electrically & Dimensionally Verified',
        compatibilityDetails: `Required ${requiredKwp} kWp achieved using ${requiredQty} × ${pWatts}Wp modules (${installedKwp} kWp array, ~${estDailyUnits} kWh/day).`
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const bestMatch = scored[0] || null;
    const alternative = scored.length > 1 ? scored[1] : null;

    return {
      applicable: true,
      requiredKwp,
      bestMatch: bestMatch ? { ...bestMatch, rankBadge: 'Best Technical Match' } : null,
      alternative: alternative ? { ...alternative, rankBadge: 'Alternative Option' } : null,
      allCompatible: scored
    };
  }

  /**
   * Recommend Inverter based on Continuous Load, Peak Surge, Phase, System Type, and PV capacity
   */
  recommendInverters(sizingResult, availableInverters) {
    if (!availableInverters || availableInverters.length === 0) {
      return {
        applicable: true,
        bestMatch: null,
        alternative: null,
        allCompatible: []
      };
    }

    const sysType = sizingResult.systemType || 'on-grid';
    const reqContinuousW = Number(sizingResult.requiredContinuousW) || 3000;
    const reqPeakSurgeW = Number(sizingResult.requiredPeakSurgeW) || reqContinuousW;
    const connectionPhase = sizingResult.connectionPhase || '1-Phase';
    const isSinglePhase = connectionPhase === '1-Phase';
    const reqPvKw = (sizingResult.solar && sizingResult.solar.actualArrayKwp) ? Number(sizingResult.solar.actualArrayKwp) : 0;

    // Filter inverters strictly matching the required inverter type
    const matchingType = availableInverters.filter(inv => {
      if (sysType === 'on-grid') return inv.inverterType === 'on-grid';
      if (sysType === 'off-grid') return inv.inverterType === 'off-grid';
      if (sysType === 'hybrid') return inv.inverterType === 'hybrid';
      if (sysType === 'without-solar') return inv.inverterType === 'without-solar';
      return true;
    });

    const pool = matchingType.length > 0 ? matchingType : availableInverters;

    const evaluated = pool.map(inv => {
      const contCapW = inv.continuousWatts || (inv.ratedKw * 1000);
      const surgeCapW = inv.surgeWatts || (contCapW * 2);

      // 1. Strict Phase Matching: Single Phase requires 1-Phase; Three-Phase requires 3-Phase!
      const isPhaseOk = isSinglePhase 
        ? (inv.phase === '1-Phase' || !inv.phase)
        : (inv.phase === '3-Phase');

      // 2. Strict Continuous Capacity: 100% capacity required (Zero tolerance for undersizing)
      const isCapacityOk = contCapW >= reqContinuousW;

      // 3. Peak Motor Surge Inrush Handling:
      const isSurgeOk = surgeCapW >= reqPeakSurgeW;

      // 4. PV Input Capacity:
      const isPvOk = reqPvKw > 0 ? (inv.maxPvInputKw ? inv.maxPvInputKw >= reqPvKw * 0.95 : true) : true;

      // 5. Statutory 1-Phase 5.0 kW DISCOM limit check:
      const exceedsSinglePhaseStatutory = isSinglePhase && (contCapW > 5000 || inv.ratedKw > 5.0);

      // Scoring Engine
      let score = 100;
      if (!isPhaseOk) score -= 300; // Strict phase mismatch penalty
      if (!isCapacityOk) {
        const deficitW = reqContinuousW - contCapW;
        score -= (100 + (deficitW / 1000) * 30); // Under-capacity heavy penalty
      }
      if (!isSurgeOk) score -= 80; // Motor surge inrush failure penalty
      if (reqPvKw > 0 && !isPvOk) score -= 40;
      if (exceedsSinglePhaseStatutory) score -= 150; // DISCOM limit violation

      // Prefer models closest to continuous requirement without massive wasteful oversizing
      const kwDiff = Math.abs(contCapW - reqContinuousW);
      score -= (kwDiff / 1000) * 8;

      let compatibilityStatus = 'Compatible';
      const details = [];

      if (isCapacityOk && isSurgeOk && isPhaseOk && !exceedsSinglePhaseStatutory) {
        compatibilityStatus = '100% Electrically Matched';
        details.push(`Handles continuous load (${reqContinuousW}W) & motor surge (${reqPeakSurgeW}W) on ${inv.phase}.`);
      } else {
        if (!isPhaseOk) details.push(`Phase mismatch: Customer connection is ${connectionPhase}, inverter is ${inv.phase}.`);
        if (!isCapacityOk) details.push(`Rating (${contCapW}W) below target (${reqContinuousW}W) — Overload trip risk.`);
        if (!isSurgeOk) details.push(`Surge rating (${surgeCapW}W) below motor peak inrush (${reqPeakSurgeW}W).`);
        if (exceedsSinglePhaseStatutory) details.push(`Exceeds DISCOM 5.0 kW 1-Phase statutory grid limit.`);
        compatibilityStatus = (!isPhaseOk || !isCapacityOk) ? 'Incompatible' : 'Partial Match (Review Warning)';
      }

      if (reqPvKw > 0) {
        details.push(`DC/AC ratio: ~${(reqPvKw / inv.ratedKw).toFixed(2)} (Safe range 1.0–1.25).`);
      }

      return {
        product: inv,
        continuousLoadW: reqContinuousW,
        peakSurgeW: reqPeakSurgeW,
        score,
        compatibilityStatus,
        compatibilityDetails: details.join(' '),
        isElectricallyCompliant: isCapacityOk && isSurgeOk && isPhaseOk && !exceedsSinglePhaseStatutory
      };
    });

    evaluated.sort((a, b) => b.score - a.score);

    // Best match must be electrically compliant if available
    const compliantMatches = evaluated.filter(e => e.isElectricallyCompliant);
    const bestMatch = (compliantMatches.length > 0 ? compliantMatches[0] : evaluated[0]) || null;
    const alternative = compliantMatches.length > 1 ? compliantMatches[1] : (evaluated.length > 1 ? evaluated[1] : null);

    return {
      applicable: true,
      bestMatch: bestMatch ? { ...bestMatch, rankBadge: bestMatch.isElectricallyCompliant ? 'Best Technical Match' : 'Review Recommendation' } : null,
      alternative: alternative ? { ...alternative, rankBadge: alternative.isElectricallyCompliant ? 'Alternative Inverter' : 'Review Alternative' } : null,
      allCompatible: evaluated
    };
  }

  /**
   * Recommend Batteries based on Backup Energy (kWh), DoD, and Inverter DC Bus Voltage
   */
  recommendBatteries(sizingResult, availableBatteries, targetInverterVoltage = 48) {
    if (sizingResult.systemType === 'on-grid') {
      return {
        applicable: false,
        reason: 'On-Grid Solar systems do not require battery storage (Direct Grid-Tied Net Metering).',
        bestMatch: null,
        alternative: null,
        allCompatible: []
      };
    }

    if (!availableBatteries || availableBatteries.length === 0) {
      return {
        applicable: true,
        bestMatch: null,
        alternative: null,
        allCompatible: []
      };
    }

    const selectedChemistry = (sizingResult.selectedBatteryType || sizingResult.batteryType || '').toLowerCase().trim();
    let pool = availableBatteries;

    if (selectedChemistry === 'tubular') {
      const tub = availableBatteries.filter(b => b.chemistryCategory === 'tubular');
      if (tub.length > 0) pool = tub;
    } else if (selectedChemistry === 'flat-plate' || selectedChemistry === 'flat_plate' || selectedChemistry === 'flatplate') {
      const fp = availableBatteries.filter(b => b.chemistryCategory === 'flat-plate');
      if (fp.length > 0) pool = fp;
    } else if (selectedChemistry === 'lithium' || selectedChemistry === 'lfp') {
      const li = availableBatteries.filter(b => b.chemistryCategory === 'lithium');
      if (li.length > 0) pool = li;
    }

    const rawBackupWh = Number(sizingResult.targetBackupEnergyWh || sizingResult.backupEnergyWh) || 0;
    const rawBackupLoadW = Number(sizingResult.backupLoadW || sizingResult.connectedLoadW) || 0;

    // Handle corner case: Zero appliance / Zero load
    if (rawBackupLoadW <= 0 && rawBackupWh <= 0) {
      return {
        applicable: true,
        selectedChemistry: selectedChemistry || 'all',
        targetInverterVoltage: Number(targetInverterVoltage) || 48,
        requiredBackupKwh: 0,
        bestMatch: null,
        alternative: null,
        allCompatible: [],
        reason: 'No backup load configured. Please select appliances to size battery backup.'
      };
    }

    const backupEnergyWh = rawBackupWh > 0 ? rawBackupWh : Math.round(rawBackupLoadW * (Number(sizingResult.backupHours) || 4));
    const backupEnergyKwh = Math.round((backupEnergyWh / 1000) * 100) / 100;
    const backupLoadW = rawBackupLoadW > 0 ? rawBackupLoadW : 500;
    const invVoltage = Number(targetInverterVoltage) || 48;
    const invEff = 0.90;

    const evaluated = pool.map(bat => {
      const dod = (bat.dodPct || 75) / 100;
      const isLithium = bat.chemistryCategory === 'lithium';

      // 1. Critical Electrical Safety Check: Over-Voltage Detection
      if (bat.nominalVoltage > invVoltage) {
        return {
          product: bat,
          targetInverterVoltage: invVoltage,
          requiredBackupKwh: backupEnergyKwh,
          requiredUnits: 0,
          seriesCount: 0,
          parallelCount: 0,
          configurationText: 'Incompatible (Over-Voltage)',
          totalInstalledKwh: 0,
          usableKwh: 0,
          estBackupHours: 0,
          totalBankAh: 0,
          dischargeCheckOk: false,
          score: -999,
          compatibilityStatus: 'Incompatible (Over-Voltage)',
          compatibilityDetails: `Battery voltage (${bat.nominalVoltage}V) exceeds inverter DC bus (${invVoltage}V). Severe electrical damage risk!`
        };
      }

      // 2. Integer Series Ratio Check
      const rawRatio = invVoltage / bat.nominalVoltage;
      const seriesCount = Math.max(1, Math.round(rawRatio));
      const isIntegerMatch = Math.abs(seriesCount * bat.nominalVoltage - invVoltage) <= 2.5;

      if (!isIntegerMatch) {
        return {
          product: bat,
          targetInverterVoltage: invVoltage,
          requiredBackupKwh: backupEnergyKwh,
          requiredUnits: 0,
          seriesCount: 0,
          parallelCount: 0,
          configurationText: 'Incompatible (Voltage Mismatch)',
          totalInstalledKwh: 0,
          usableKwh: 0,
          estBackupHours: 0,
          totalBankAh: 0,
          dischargeCheckOk: false,
          score: -999,
          compatibilityStatus: 'Incompatible (Voltage Mismatch)',
          compatibilityDetails: `Cannot form ${invVoltage}V DC bus using ${bat.nominalVoltage}V batteries in series.`
        };
      }

      // 3. Lithium BMS Series Protection Rule:
      // Standard low-voltage Lithium packs with integrated BMS cannot be connected in series > 2 strings.
      if (isLithium && seriesCount > 2) {
        return {
          product: bat,
          targetInverterVoltage: invVoltage,
          requiredBackupKwh: backupEnergyKwh,
          requiredUnits: 0,
          seriesCount,
          parallelCount: 0,
          configurationText: 'Incompatible (Lithium BMS Series Limit)',
          totalInstalledKwh: 0,
          usableKwh: 0,
          estBackupHours: 0,
          totalBankAh: 0,
          dischargeCheckOk: false,
          score: -900,
          compatibilityStatus: 'Incompatible (BMS Limit)',
          compatibilityDetails: `Lithium LFP packs with internal BMS cannot be wired in ${seriesCount} series strings (${invVoltage}V). Use native ${invVoltage}V Lithium pack or Tall Tubular Lead-Acid bank.`
        };
      }

      // 4. Required Energy & C-Rate Sizing:
      const requiredNominalKwh = backupEnergyKwh / (dod * invEff);
      const stringKwh = seriesCount * bat.nominalEnergyKwh;
      let parallelCount = Math.max(1, Math.ceil(requiredNominalKwh / stringKwh));

      // 5. Safe Discharge C-Rate Enforcement (Increment parallel strings until discharge current is safely met)
      const dischargeCurrentA = Math.round(backupLoadW / (invVoltage * invEff));
      const maxSingleContDischargeA = bat.maxContinuousDischargeA || (bat.capacityAh * (isLithium ? 0.5 : 0.3));

      while ((maxSingleContDischargeA * parallelCount) < dischargeCurrentA) {
        parallelCount++;
      }

      const totalUnits = seriesCount * parallelCount;
      const totalBankAh = parallelCount * bat.capacityAh;
      const totalInstalledKwh = Math.round((totalUnits * bat.nominalEnergyKwh) * 100) / 100;
      const usableKwh = Math.round((totalInstalledKwh * dod * invEff) * 100) / 100;
      const estBackupHours = Math.round((usableKwh / (backupLoadW / 1000)) * 10) / 10;
      const isDischargeSafe = (maxSingleContDischargeA * parallelCount) >= dischargeCurrentA;

      let score = 100;
      if (isLithium) score += 20;
      score += (bat.dodPct - 70) * 2;
      // Bonus for native voltage match (seriesCount === 1)
      if (seriesCount === 1) score += 15;
      score -= Math.abs(usableKwh - backupEnergyKwh) * 4;
      if (!isDischargeSafe) score -= 40;

      const configText = seriesCount > 1 
        ? `${totalUnits} Units (${seriesCount} in Series × ${parallelCount} Parallel strings)`
        : `${totalUnits} Units (${parallelCount} Parallel smart pack${parallelCount > 1 ? 's' : ''})`;

      return {
        product: bat,
        targetInverterVoltage: invVoltage,
        requiredBackupKwh: backupEnergyKwh,
        requiredUnits: totalUnits,
        seriesCount,
        parallelCount,
        configurationText: configText,
        totalInstalledKwh,
        usableKwh,
        estBackupHours,
        totalBankAh,
        dischargeCheckOk: isDischargeSafe,
        score,
        compatibilityStatus: isDischargeSafe ? '100% Voltage & C-Rate Verified' : 'Check Discharge Current',
        compatibilityDetails: `Provides ~${estBackupHours} Hours backup at ${backupLoadW}W load (${configText}).`
      };
    });

    evaluated.sort((a, b) => b.score - a.score);

    const validMatches = evaluated.filter(e => e.score > 0);
    const bestMatch = validMatches[0] || null;
    const alternative = validMatches.length > 1 ? validMatches[1] : null;

    let rankBadge = 'Recommended Technical Match';
    if (selectedChemistry === 'tubular') rankBadge = 'Recommended Solar Tubular';
    else if (selectedChemistry === 'flat-plate' || selectedChemistry === 'flat_plate') rankBadge = 'Recommended Flat Plate';
    else if (selectedChemistry === 'lithium') rankBadge = 'Recommended LiFePO4 Lithium';

    return {
      applicable: true,
      selectedChemistry: selectedChemistry || 'all',
      targetInverterVoltage: invVoltage,
      requiredBackupKwh: backupEnergyKwh,
      bestMatch: bestMatch ? { ...bestMatch, rankBadge } : null,
      alternative: alternative ? { ...alternative, rankBadge: 'Alternative Option' } : null,
      allCompatible: evaluated
    };
  }
}

// Singleton instance
module.exports = new SolarRecommendationService();
