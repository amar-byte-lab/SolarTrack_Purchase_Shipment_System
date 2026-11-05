/**
 * SolarProductService.js
 * Central catalogue service managing solar manufacturer providers, caching, deduplication,
 * and filtering for Panels, Inverters, and Batteries.
 */

const fs = require('fs');
const path = require('path');
const LuminousProductProvider = require('../providers/LuminousProductProvider');
const WaareeProductProvider = require('../providers/WaareeProductProvider');
const AdaniProductProvider = require('../providers/AdaniProductProvider');
const VikramProductProvider = require('../providers/VikramProductProvider');
const TataPowerProductProvider = require('../providers/TataPowerProductProvider');

class SolarProductService {
  constructor() {
    this.cacheFile = path.join(__dirname, '../../data/solar_products_cache.json');
    this.providers = new Map();
    this.catalogue = {
      panels: [],
      inverters: [],
      batteries: []
    };
    this.lastRefreshed = null;
    this.refreshIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

    this.registerDefaultProviders();
    this.loadFromCacheOrRefresh();
  }

  registerDefaultProviders() {
    const list = [
      new LuminousProductProvider(),
      new WaareeProductProvider(),
      new AdaniProductProvider(),
      new VikramProductProvider(),
      new TataPowerProductProvider()
    ];

    list.forEach(p => {
      this.providers.set(p.id, p);
    });
  }

  /**
   * Register an additional provider dynamically
   */
  registerProvider(provider) {
    if (!provider || !provider.id) {
      throw new Error('Valid provider with id required');
    }
    this.providers.set(provider.id, provider);
  }

  getManufacturers() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      officialUrl: p.officialUrl,
      logoUrl: p.logoUrl,
      isDefault: p.id === 'luminous',
      supportedCategories: p.supportedCategories,
      lastUpdated: p.lastUpdated,
      status: p.status
    }));
  }

  loadFromCacheOrRefresh() {
    let loadedFromDisk = false;
    if (fs.existsSync(this.cacheFile)) {
      try {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.catalogue && parsed.catalogue.panels && parsed.catalogue.panels.length > 0) {
          this.catalogue = parsed.catalogue;
          this.lastRefreshed = parsed.lastRefreshed;
          loadedFromDisk = true;
          console.log(`[SolarProductService] Loaded ${this.catalogue.panels.length} panels, ${this.catalogue.inverters.length} inverters, ${this.catalogue.batteries.length} batteries from cache.`);
        }
      } catch (err) {
        console.error('[SolarProductService] Cache read error, refreshing:', err);
      }
    }

    if (!loadedFromDisk) {
      this.refreshCatalogue();
    }
  }

  refreshCatalogue() {
    console.log('[SolarProductService] Refreshing catalogue from all providers...');
    const allPanels = [];
    const allInverters = [];
    const allBatteries = [];

    for (const [id, provider] of this.providers.entries()) {
      try {
        const products = provider.getProducts();
        if (products.panels) allPanels.push(...products.panels);
        if (products.inverters) allInverters.push(...products.inverters);
        if (products.batteries) allBatteries.push(...products.batteries);
        provider.status = 'active';
        provider.lastUpdated = new Date().toISOString();
      } catch (err) {
        provider.status = 'error';
        provider.logError(err, 'refreshCatalogue');
      }
    }

    this.catalogue = {
      panels: allPanels,
      inverters: allInverters,
      batteries: allBatteries
    };
    this.lastRefreshed = new Date().toISOString();

    // Persist to cache file
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({
        lastRefreshed: this.lastRefreshed,
        catalogue: this.catalogue
      }, null, 2), 'utf8');
      console.log(`[SolarProductService] Cache successfully persisted (${allPanels.length} panels, ${allInverters.length} inverters, ${allBatteries.length} batteries).`);
    } catch (err) {
      console.error('[SolarProductService] Failed to write cache to disk:', err);
    }
  }

  /**
   * Filter catalogue products by manufacturer and optional parameters
   */
  getProducts({
    manufacturerId = 'luminous',
    category,
    technology,
    minWatts,
    maxWatts,
    phase,
    inverterType,
    batteryChemistry
  } = {}) {
    let result = {
      manufacturerId,
      lastRefreshed: this.lastRefreshed,
      panels: [],
      inverters: [],
      batteries: []
    };

    // Filter Panels
    if (!category || category === 'panels') {
      result.panels = this.catalogue.panels.filter(p => {
        if (manufacturerId && manufacturerId !== 'all' && p.manufacturerId !== manufacturerId) return false;
        if (technology && !p.technology.toLowerCase().includes(technology.toLowerCase())) return false;
        if (minWatts && p.ratedWatts < Number(minWatts)) return false;
        if (maxWatts && p.ratedWatts > Number(maxWatts)) return false;
        return true;
      });
    }

    // Filter Inverters
    if (!category || category === 'inverters') {
      result.inverters = this.catalogue.inverters.filter(i => {
        if (manufacturerId && manufacturerId !== 'all' && i.manufacturerId !== manufacturerId) return false;
        if (phase && i.phase !== phase) return false;
        if (inverterType && i.inverterType !== inverterType) return false;
        return true;
      });
    }

    // Filter Batteries
    if (!category || category === 'batteries') {
      result.batteries = this.catalogue.batteries.filter(b => {
        if (manufacturerId && manufacturerId !== 'all' && b.manufacturerId !== manufacturerId) return false;
        if (batteryChemistry && b.chemistryCategory !== batteryChemistry) return false;
        return true;
      });
    }

    return result;
  }
}

// Singleton instance
module.exports = new SolarProductService();
