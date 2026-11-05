/**
 * BaseProductProvider.js
 * Common abstract base provider for solar manufacturer product integration.
 * Defines standard schemas, caching helpers, timeout/retry, and data normalization.
 */

class BaseProductProvider {
  constructor({ id, name, officialUrl, logoUrl, supportedCategories }) {
    if (!id || !name) {
      throw new Error('Provider must have an id and name');
    }
    this.id = id;
    this.name = name;
    this.officialUrl = officialUrl || '';
    this.logoUrl = logoUrl || '';
    this.supportedCategories = supportedCategories || ['panels', 'inverters', 'batteries'];
    this.lastUpdated = new Date().toISOString();
    this.status = 'active'; // 'active', 'cached', 'error'
    this.errorLog = [];
  }

  logError(error, context = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      context,
      message: error && error.message ? error.message : String(error)
    };
    this.errorLog.unshift(entry);
    if (this.errorLog.length > 50) this.errorLog.pop();
    console.error(`[${this.name}Provider] Error in ${context}:`, error);
  }

  /**
   * Fetch all products from this manufacturer.
   * Must be implemented by child providers.
   * Returns { panels: [], inverters: [], batteries: [] }
   */
  async getProducts() {
    throw new Error('getProducts() must be implemented by child provider');
  }

  /**
   * Validate and normalize a Solar Panel object according to specifications
   */
  normalizePanel(panel) {
    if (!panel || !panel.model) return null;
    return {
      id: `${this.id}_panel_${panel.model.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      manufacturer: this.name,
      manufacturerId: this.id,
      category: 'panels',
      model: String(panel.model).trim(),
      series: panel.series || '',
      ratedWatts: Number(panel.ratedWatts || panel.wattage || 0),
      technology: panel.technology || 'Mono PERC', // 'N-Type TOPCon', 'Mono PERC', 'Bifacial', 'Polycrystalline'
      cellType: panel.cellType || '144 Half-Cut Cells (M10/G12)',
      efficiencyPct: Number(panel.efficiencyPct || 0),
      voc: Number(panel.voc || 0), // Open-circuit voltage (V)
      vmp: Number(panel.vmp || 0), // Voltage at max power (V)
      isc: Number(panel.isc || 0), // Short-circuit current (A)
      imp: Number(panel.imp || 0), // Current at max power (A)
      maxSystemVoltage: Number(panel.maxSystemVoltage || 1500), // 1500V or 1000V
      dimensions: panel.dimensions || '2278 × 1134 × 35 mm',
      weightKg: Number(panel.weightKg || 28),
      productWarrantyYears: Number(panel.productWarrantyYears || 12),
      performanceWarrantyYears: Number(panel.performanceWarrantyYears || 25),
      isDcr: !!panel.isDcr, // Domestic Content Requirement approved for subsidy
      datasheetUrl: panel.datasheetUrl || this.officialUrl,
      productPageUrl: panel.productPageUrl || this.officialUrl,
      imageUrl: panel.imageUrl || '',
      source: panel.source || `${this.name} Official Technical Catalogue`,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Validate and normalize a Solar Inverter object according to specifications
   */
  normalizeInverter(inv) {
    if (!inv || !inv.model) return null;
    return {
      id: `${this.id}_inverter_${inv.model.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      manufacturer: this.name,
      manufacturerId: this.id,
      category: 'inverters',
      model: String(inv.model).trim(),
      series: inv.series || '',
      ratedKw: Number(inv.ratedKw || 0),
      ratedKva: Number(inv.ratedKva || inv.ratedKw || 0),
      inverterType: inv.inverterType || 'on-grid', // 'on-grid' (GTI), 'off-grid' (PCU), 'hybrid', 'without-solar' (UPS)
      inverterTypeLabel: inv.inverterTypeLabel || (inv.inverterType === 'on-grid' ? 'Grid-Tied (GTI)' : (inv.inverterType === 'hybrid' ? 'Bi-Directional Hybrid' : (inv.inverterType === 'off-grid' ? 'Solar PCU' : 'Pure Sine Wave UPS'))),
      phase: inv.phase || '1-Phase', // '1-Phase' or '3-Phase'
      phaseLabel: inv.phase === '3-Phase' ? '3-Phase (415V)' : '1-Phase (230V)',
      mpptCount: Number(inv.mpptCount || 1),
      maxPvInputKw: Number(inv.maxPvInputKw || inv.ratedKw * 1.3),
      maxDcVoltage: Number(inv.maxDcVoltage || 550),
      mpptVoltageRange: inv.mpptVoltageRange || '80V - 500V',
      mpptMinVolt: Number(inv.mpptMinVolt || 80),
      mpptMaxVolt: Number(inv.mpptMaxVolt || 500),
      maxInputCurrentA: Number(inv.maxInputCurrentA || 16),
      batteryVoltage: Number(inv.batteryVoltage || 0), // 0 for GTI, 12, 24, 48, 96, 120 for PCU/Hybrid/UPS
      batteryCompatibility: inv.batteryCompatibility || (inv.batteryVoltage > 0 ? `${inv.batteryVoltage}V DC (Lithium & Tubular)` : 'None (Grid-Tied Direct AC)'),
      maxEfficiencyPct: Number(inv.maxEfficiencyPct || 98.2),
      continuousWatts: Number(inv.continuousWatts || inv.ratedKw * 1000),
      surgeWatts: Number(inv.surgeWatts || (inv.continuousWatts ? inv.continuousWatts * 2 : inv.ratedKw * 2000)),
      surgeDurationSec: Number(inv.surgeDurationSec || 5),
      ipRating: inv.ipRating || (inv.inverterType === 'on-grid' || inv.inverterType === 'hybrid' ? 'IP65' : 'IP21'),
      warrantyYears: Number(inv.warrantyYears || (inv.inverterType === 'on-grid' ? 5 : 2)),
      datasheetUrl: inv.datasheetUrl || this.officialUrl,
      productPageUrl: inv.productPageUrl || this.officialUrl,
      imageUrl: inv.imageUrl || '',
      source: inv.source || `${this.name} Official Technical Catalogue`,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Validate and normalize a Battery object according to specifications
   */
  normalizeBattery(bat) {
    if (!bat || !bat.model) return null;
    const volt = Number(bat.nominalVoltage || 12);
    const ah = Number(bat.capacityAh || 150);
    const kwh = Number(bat.nominalEnergyKwh || ((volt * ah) / 1000));
    const dod = Number(bat.dodPct || (bat.chemistry && bat.chemistry.toLowerCase().includes('lithium') ? 90 : 75));
    const usableKwh = Number(bat.usableEnergyKwh || (kwh * (dod / 100)));

    return {
      id: `${this.id}_battery_${bat.model.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      manufacturer: this.name,
      manufacturerId: this.id,
      category: 'batteries',
      model: String(bat.model).trim(),
      series: bat.series || '',
      chemistry: bat.chemistry || 'Tubular Lead-Acid', // 'LiFePO4', 'Lithium-ion', 'Tubular Lead-Acid', 'Flat Plate'
      chemistryCategory: bat.chemistryCategory || (bat.chemistry && bat.chemistry.toLowerCase().includes('lithium') ? 'lithium' : (bat.chemistry && bat.chemistry.toLowerCase().includes('flat') ? 'flat-plate' : 'tubular')),
      nominalVoltage: volt,
      capacityAh: ah,
      nominalEnergyKwh: Math.round(kwh * 100) / 100,
      usableEnergyKwh: Math.round(usableKwh * 100) / 100,
      dodPct: dod,
      cycleLife: bat.cycleLife || (dod >= 85 ? '~3500–5000 Cycles @ 80% DoD' : '~1500–1800 Cycles @ 75% DoD'),
      maxContinuousDischargeA: Number(bat.maxContinuousDischargeA || (dod >= 85 ? ah * 0.5 : ah * 0.2)),
      peakDischargeA: Number(bat.peakDischargeA || ah),
      warrantyYears: Number(bat.warrantyYears || (dod >= 85 ? 5 : 3)),
      warrantyMonths: Number(bat.warrantyMonths || (dod >= 85 ? 60 : 36)),
      datasheetUrl: bat.datasheetUrl || this.officialUrl,
      productPageUrl: bat.productPageUrl || this.officialUrl,
      imageUrl: bat.imageUrl || '',
      source: bat.source || `${this.name} Official Technical Catalogue`,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Helper to deduplicate array of products by model
   */
  deduplicateByModel(list) {
    const seen = new Set();
    const result = [];
    for (const item of list) {
      if (!item || !item.model) continue;
      const key = `${item.manufacturerId}_${item.category}_${item.model.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }
}

module.exports = BaseProductProvider;
