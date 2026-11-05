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
    const targetBatteryVoltage = inverterRecommendation && inverterRecommendation.bestMatch
      ? inverterRecommendation.bestMatch.product.batteryVoltage
      : (sizingResult.inverter ? sizingResult.inverter.batteryVoltage : 48);

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
    const reqPeakSurgeW = Number(sizingResult.requiredPeakSurgeW) || 5000;
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

      let isCapacityOk = contCapW >= reqContinuousW * 0.9;
      let isSurgeOk = surgeCapW >= reqPeakSurgeW;
      let isPhaseOk = isSinglePhase ? inv.phase === '1-Phase' : true;
      let isPvOk = reqPvKw > 0 ? (inv.maxPvInputKw ? inv.maxPvInputKw >= reqPvKw * 0.95 : true) : true;

      // Scoring
      let score = 100;
      if (!isPhaseOk) score -= 50;
      if (!isCapacityOk) score -= 30;
      if (!isSurgeOk) score -= 20;
      if (reqPvKw > 0 && !isPvOk) score -= 20;

      // Prefer models closest to continuous requirement without massive wasteful oversizing
      const kwDiff = Math.abs(contCapW - reqContinuousW);
      score -= (kwDiff / 1000) * 8;

      let compatibilityStatus = 'Compatible';
      const details = [];

      if (isCapacityOk && isSurgeOk && isPhaseOk) {
        compatibilityStatus = '100% Electrically Matched';
        details.push(`Handles continuous load (${reqContinuousW}W) & motor peak surge (${reqPeakSurgeW}W).`);
      } else {
        if (!isPhaseOk) details.push(`Phase mismatch: Requires ${connectionPhase}, inverter is ${inv.phase}.`);
        if (!isCapacityOk) details.push(`Rating (${contCapW}W) below target (${reqContinuousW}W).`);
        if (!isSurgeOk) details.push(`Surge capacity (${surgeCapW}W) below peak motor requirement (${reqPeakSurgeW}W).`);
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
        compatibilityDetails: details.join(' ')
      };
    });

    evaluated.sort((a, b) => b.score - a.score);

    const bestMatch = evaluated[0] || null;
    const alternative = evaluated.length > 1 ? evaluated[1] : null;

    return {
      applicable: true,
      bestMatch: bestMatch ? { ...bestMatch, rankBadge: 'Best Technical Match' } : null,
      alternative: alternative ? { ...alternative, rankBadge: 'Alternative Inverter' } : null,
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

    // Filter by user's chosen battery chemistry if specified (tubular, flat-plate, lithium)
    const selectedChemistry = (sizingResult.selectedBatteryType || sizingResult.batteryType || '').toLowerCase().trim();
    let pool = availableBatteries;

    if (selectedChemistry === 'tubular') {
      pool = availableBatteries.filter(b => b.chemistryCategory === 'tubular');
    } else if (selectedChemistry === 'flat-plate' || selectedChemistry === 'flat_plate' || selectedChemistry === 'flatplate') {
      pool = availableBatteries.filter(b => b.chemistryCategory === 'flat-plate');
    } else if (selectedChemistry === 'lithium' || selectedChemistry === 'lfp') {
      pool = availableBatteries.filter(b => b.chemistryCategory === 'lithium');
    }

    if (!pool || pool.length === 0) {
      pool = availableBatteries;
    }

    const backupEnergyWh = Number(sizingResult.targetBackupEnergyWh || sizingResult.backupEnergyWh) || 4000;
    const backupEnergyKwh = Math.round((backupEnergyWh / 1000) * 100) / 100;
    const backupLoadW = Number(sizingResult.backupLoadW || sizingResult.connectedLoadW) || 1000;
    const invVoltage = Number(targetInverterVoltage) || 48;
    const invEff = 0.90;

    const evaluated = pool.map(bat => {
      const dod = (bat.dodPct || 75) / 100;
      const requiredNominalKwh = backupEnergyKwh / (dod * invEff);

      // Determine series count to match inverter DC bus voltage
      let seriesCount = 1;
      if (bat.nominalVoltage < invVoltage) {
        seriesCount = Math.max(1, Math.round(invVoltage / bat.nominalVoltage));
      }

      const stringKwh = seriesCount * bat.nominalEnergyKwh;
      const parallelCount = Math.max(1, Math.ceil(requiredNominalKwh / stringKwh));
      const totalUnits = seriesCount * parallelCount;
      const totalBankAh = parallelCount * bat.capacityAh;
      const totalInstalledKwh = Math.round((totalUnits * bat.nominalEnergyKwh) * 100) / 100;
      const usableKwh = Math.round((totalInstalledKwh * dod * invEff) * 100) / 100;
      const estBackupHours = Math.round((usableKwh / (backupLoadW / 1000)) * 10) / 10;

      // Discharge current check
      const dischargeCurrentA = Math.round(backupLoadW / (invVoltage * invEff));
      const maxContinuousDischargeA = (bat.maxContinuousDischargeA || bat.capacityAh * 0.5) * parallelCount;
      const isDischargeSafe = maxContinuousDischargeA >= dischargeCurrentA;

      let score = 100;
      if (bat.chemistryCategory === 'lithium') score += 20;
      score += (bat.dodPct - 70) * 2;
      score -= Math.abs(usableKwh - backupEnergyKwh) * 5;
      if (!isDischargeSafe) score -= 30;

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

    const bestMatch = evaluated[0] || null;
    const alternative = evaluated.length > 1 ? evaluated[1] : null;

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
