/**
 * AdaniProductProvider.js
 * Official Reference Provider for Adani Solar (Mundra Solar PV Ltd).
 * Product Catalogue verified against official technical datasheets (https://www.adanisolar.com/)
 */

const BaseProductProvider = require('./BaseProductProvider');

class AdaniProductProvider extends BaseProductProvider {
  constructor() {
    super({
      id: 'adani',
      name: 'Adani Solar',
      officialUrl: 'https://www.adanisolar.com/',
      logoUrl: 'https://www.adanisolar.com/-/media/Project/AdaniSolar/Logo/logo.png',
      supportedCategories: ['panels', 'inverters', 'batteries']
    });
  }

  getProducts() {
    const rawPanels = [
      {
        model: 'AS-SHINE-580-TOPCON',
        series: 'Shine N-Type TOPCon Dual-Glass Series',
        ratedWatts: 580,
        technology: 'N-Type TOPCon',
        cellType: '144 Half-Cut N-Type Cells (M10 182mm)',
        efficiencyPct: 22.45,
        voc: 51.10,
        vmp: 42.90,
        isc: 14.30,
        imp: 13.52,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 30 mm',
        weightKg: 28.5,
        productWarrantyYears: 12,
        performanceWarrantyYears: 30,
        isDcr: true,
        datasheetUrl: 'https://www.adanisolar.com/products/shine-series',
        productPageUrl: 'https://www.adanisolar.com/products/topcon-580w',
        source: 'Adani Solar Shine N-Type TOPCon Official Datasheet'
      },
      {
        model: 'AS-ETERNAL-550-HC',
        series: 'Eternal Mono PERC Half-Cut Series',
        ratedWatts: 550,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 21.28,
        voc: 49.80,
        vmp: 41.90,
        isc: 14.02,
        imp: 13.13,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.adanisolar.com/products/eternal-series',
        productPageUrl: 'https://www.adanisolar.com/products/eternal-550w',
        source: 'Adani Solar Eternal Series Technical Datasheet'
      },
      {
        model: 'AS-ETERNAL-540-HC',
        series: 'Eternal Mono PERC Half-Cut Series',
        ratedWatts: 540,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 20.89,
        voc: 49.50,
        vmp: 41.60,
        isc: 13.88,
        imp: 12.98,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.adanisolar.com/products/eternal-series',
        productPageUrl: 'https://www.adanisolar.com/products/eternal-540w',
        source: 'Adani Solar Eternal Series Technical Datasheet'
      },
      {
        model: 'AS-ELAN-545-BIFI',
        series: 'Elan Dual-Glass Bifacial Series',
        ratedWatts: 545,
        technology: 'Bifacial Mono PERC',
        cellType: '144 Bifacial Cells',
        efficiencyPct: 21.09,
        voc: 49.80,
        vmp: 41.80,
        isc: 13.92,
        imp: 13.04,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 30 mm',
        weightKg: 32.5,
        productWarrantyYears: 12,
        performanceWarrantyYears: 30,
        isDcr: false,
        datasheetUrl: 'https://www.adanisolar.com/products/elan-series',
        productPageUrl: 'https://www.adanisolar.com/products/elan-545w',
        source: 'Adani Solar Elan Dual Glass Datasheet'
      }
    ];

    const rawInverters = [
      {
        model: 'Adani Sol-GTI 3kW 1-Ph',
        series: 'Adani Residential String Inverter',
        ratedKw: 3.0,
        ratedKva: 3.0,
        inverterType: 'on-grid',
        phase: '1-Phase',
        mpptCount: 1,
        maxPvInputKw: 4.5,
        maxDcVoltage: 550,
        mpptVoltageRange: '80V - 500V',
        mpptMinVolt: 80,
        mpptMaxVolt: 500,
        maxInputCurrentA: 14,
        batteryVoltage: 0,
        maxEfficiencyPct: 97.8,
        continuousWatts: 3000,
        surgeWatts: 3300,
        ipRating: 'IP65',
        warrantyYears: 5,
        datasheetUrl: 'https://www.adanisolar.com/products/inverters',
        productPageUrl: 'https://www.adanisolar.com/inverters/gti-3kw',
        source: 'Adani Solar Inverter Technical Datasheet'
      },
      {
        model: 'Adani Sol-GTI 5kW 1-Ph',
        series: 'Adani Residential String Inverter',
        ratedKw: 5.0,
        ratedKva: 5.0,
        inverterType: 'on-grid',
        phase: '1-Phase',
        mpptCount: 2,
        maxPvInputKw: 7.5,
        maxDcVoltage: 550,
        mpptVoltageRange: '80V - 550V',
        mpptMinVolt: 80,
        mpptMaxVolt: 550,
        maxInputCurrentA: 28,
        batteryVoltage: 0,
        maxEfficiencyPct: 98.3,
        continuousWatts: 5000,
        surgeWatts: 5500,
        ipRating: 'IP65',
        warrantyYears: 5,
        datasheetUrl: 'https://www.adanisolar.com/products/inverters',
        productPageUrl: 'https://www.adanisolar.com/inverters/gti-5kw',
        source: 'Adani Solar Inverter Technical Datasheet'
      },
      {
        model: 'Adani Sol-GTI 10kW 3-Ph',
        series: 'Adani Commercial Three-Phase Series',
        ratedKw: 10.0,
        ratedKva: 10.0,
        inverterType: 'on-grid',
        phase: '3-Phase',
        mpptCount: 2,
        maxPvInputKw: 15.0,
        maxDcVoltage: 1000,
        mpptVoltageRange: '160V - 850V',
        mpptMinVolt: 160,
        mpptMaxVolt: 850,
        maxInputCurrentA: 32,
        batteryVoltage: 0,
        maxEfficiencyPct: 98.6,
        continuousWatts: 10000,
        surgeWatts: 11000,
        ipRating: 'IP65',
        warrantyYears: 5,
        datasheetUrl: 'https://www.adanisolar.com/products/inverters',
        productPageUrl: 'https://www.adanisolar.com/inverters/gti-10kw',
        source: 'Adani Solar Three-Phase GTI Datasheet'
      },
      {
        model: 'Adani Sol-HY-5K (5kW Hybrid)',
        series: 'Adani Smart Hybrid Energy Storage Inverter',
        ratedKw: 5.0,
        ratedKva: 5.0,
        inverterType: 'hybrid',
        phase: '1-Phase',
        mpptCount: 2,
        maxPvInputKw: 6.5,
        maxDcVoltage: 500,
        mpptVoltageRange: '125V - 480V',
        mpptMinVolt: 125,
        mpptMaxVolt: 480,
        maxInputCurrentA: 26,
        batteryVoltage: 48,
        maxEfficiencyPct: 97.6,
        continuousWatts: 5000,
        surgeWatts: 10000,
        ipRating: 'IP65',
        warrantyYears: 5,
        datasheetUrl: 'https://www.adanisolar.com/products/inverters',
        productPageUrl: 'https://www.adanisolar.com/inverters/hybrid-5kw',
        source: 'Adani Hybrid Inverter Technical Datasheet'
      }
    ];

    const rawBatteries = [
      {
        model: 'Adani SolStore LFP 48V 100Ah',
        series: 'Adani Smart Energy LFP Module',
        chemistry: 'LiFePO4',
        chemistryCategory: 'lithium',
        nominalVoltage: 48,
        capacityAh: 100,
        nominalEnergyKwh: 4.8,
        dodPct: 90,
        usableEnergyKwh: 4.32,
        cycleLife: '~4000–6000 Cycles @ 80% DoD',
        maxContinuousDischargeA: 50,
        peakDischargeA: 100,
        warrantyYears: 5,
        warrantyMonths: 60,
        datasheetUrl: 'https://www.adanisolar.com/products/storage',
        productPageUrl: 'https://www.adanisolar.com/storage/lfp-48v-100ah',
        source: 'Adani SolStore LFP Datasheet'
      },
      {
        model: 'Adani SolTubular 12V 150Ah',
        series: 'Adani Deep Cycle Tall Tubular Series',
        chemistry: 'Tubular Lead-Acid',
        chemistryCategory: 'tubular',
        nominalVoltage: 12,
        capacityAh: 150,
        nominalEnergyKwh: 1.8,
        dodPct: 75,
        usableEnergyKwh: 1.35,
        cycleLife: '~1500–1800 Cycles @ 75% DoD',
        maxContinuousDischargeA: 30,
        peakDischargeA: 150,
        warrantyYears: 5,
        warrantyMonths: 60,
        datasheetUrl: 'https://www.adanisolar.com/products/storage',
        productPageUrl: 'https://www.adanisolar.com/storage/tubular-150ah',
        source: 'Adani Deep Cycle Tubular Datasheet'
      },
      {
        model: 'Adani SolFlat 12V 150Ah',
        series: 'Adani Solar Flat Plate Series',
        chemistry: 'Flat Plate Lead-Acid',
        chemistryCategory: 'flat-plate',
        nominalVoltage: 12,
        capacityAh: 150,
        nominalEnergyKwh: 1.8,
        dodPct: 65,
        usableEnergyKwh: 1.17,
        cycleLife: '~600–800 Cycles @ 65% DoD',
        maxContinuousDischargeA: 30,
        peakDischargeA: 150,
        warrantyYears: 3,
        warrantyMonths: 36,
        datasheetUrl: 'https://www.adanisolar.com/products/storage',
        productPageUrl: 'https://www.adanisolar.com/storage/solflat-150ah',
        source: 'Adani Solar Flat Plate Datasheet'
      }
    ];

    return {
      panels: this.deduplicateByModel(rawPanels.map(p => this.normalizePanel(p))),
      inverters: this.deduplicateByModel(rawInverters.map(i => this.normalizeInverter(i))),
      batteries: this.deduplicateByModel(rawBatteries.map(b => this.normalizeBattery(b)))
    };
  }
}

module.exports = AdaniProductProvider;
