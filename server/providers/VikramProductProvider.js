/**
 * VikramProductProvider.js
 * Official Reference Provider for Vikram Solar Ltd.
 * Product Catalogue verified against official technical datasheets (https://www.vikramsolar.com/)
 */

const BaseProductProvider = require('./BaseProductProvider');

class VikramProductProvider extends BaseProductProvider {
  constructor() {
    super({
      id: 'vikram',
      name: 'Vikram Solar',
      officialUrl: 'https://www.vikramsolar.com/',
      logoUrl: 'https://www.vikramsolar.com/wp-content/themes/vikramsolar/images/logo.png',
      supportedCategories: ['panels', 'inverters', 'batteries']
    });
  }

  getProducts() {
    const rawPanels = [
      {
        model: 'VS-SURYAVA-580-TOPCON',
        series: 'Suryava N-Type TOPCon Series',
        ratedWatts: 580,
        technology: 'N-Type TOPCon',
        cellType: '144 Half-Cut N-Type Cells (M10 182mm)',
        efficiencyPct: 22.45,
        voc: 51.20,
        vmp: 43.10,
        isc: 14.25,
        imp: 13.46,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 30 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 30,
        isDcr: true,
        datasheetUrl: 'https://www.vikramsolar.com/suryava-topcon-series/',
        productPageUrl: 'https://www.vikramsolar.com/suryava-topcon-series/',
        source: 'Vikram Solar Suryava TOPCon Official Datasheet'
      },
      {
        model: 'VS-SOMERA-550-HC',
        series: 'Somera Grand Mono PERC Series',
        ratedWatts: 550,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 21.28,
        voc: 49.80,
        vmp: 41.90,
        isc: 14.01,
        imp: 13.13,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.5,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.vikramsolar.com/somera-grand-series/',
        productPageUrl: 'https://www.vikramsolar.com/somera-grand-series/',
        source: 'Vikram Solar Somera Grand Technical Datasheet'
      },
      {
        model: 'VS-SOMERA-540-HC',
        series: 'Somera Grand Mono PERC Series',
        ratedWatts: 540,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 20.89,
        voc: 49.50,
        vmp: 41.60,
        isc: 13.86,
        imp: 12.98,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.vikramsolar.com/somera-grand-series/',
        productPageUrl: 'https://www.vikramsolar.com/somera-grand-series/',
        source: 'Vikram Solar Somera Grand Technical Datasheet'
      },
      {
        model: 'VS-PREVA-545-BIFI',
        series: 'Preva Bifacial Dual-Glass Series',
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
        weightKg: 32.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 30,
        isDcr: false,
        datasheetUrl: 'https://www.vikramsolar.com/preva-series/',
        productPageUrl: 'https://www.vikramsolar.com/preva-series/',
        source: 'Vikram Solar Preva Dual Glass Datasheet'
      }
    ];

    const rawInverters = [
      {
        model: 'Vikram Sol-GTI 3kW 1-Ph',
        series: 'Vikram Residential On-Grid GTI',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/inverters-3kw',
        source: 'Vikram Solar Inverter Catalogue'
      },
      {
        model: 'Vikram Sol-GTI 5kW 1-Ph',
        series: 'Vikram Residential On-Grid GTI',
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
        maxEfficiencyPct: 98.2,
        continuousWatts: 5000,
        surgeWatts: 5500,
        ipRating: 'IP65',
        warrantyYears: 5,
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/inverters-5kw',
        source: 'Vikram Solar Inverter Catalogue'
      },
      {
        model: 'Vikram Sol-GTI 10kW 3-Ph',
        series: 'Vikram Commercial Three-Phase Series',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/inverters-10kw',
        source: 'Vikram Solar Inverter Catalogue'
      },
      {
        model: 'Vikram Sol-HY-5K (5kW Hybrid)',
        series: 'Vikram Hybrid Energy Storage Series',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/hybrid-5kw',
        source: 'Vikram Hybrid Inverter Technical Datasheet'
      }
    ];

    const rawBatteries = [
      {
        model: 'Vikram V-Store 48V 100Ah LFP',
        series: 'Vikram Solar Energy Storage Pack',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/v-store-48v',
        source: 'Vikram V-Store LFP Technical Datasheet'
      },
      {
        model: 'Vikram V-Tube 12V 150Ah Tubular',
        series: 'Vikram Solar Tall Tubular C10 Battery',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/v-tube-150ah',
        source: 'Vikram Tall Tubular Technical Datasheet'
      },
      {
        model: 'Vikram V-Flat 12V 150Ah Flat Plate',
        series: 'Vikram Solar Flat Plate Series',
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
        datasheetUrl: 'https://www.vikramsolar.com/products/',
        productPageUrl: 'https://www.vikramsolar.com/products/v-flat-150ah',
        source: 'Vikram Solar Flat Plate Datasheet'
      }
    ];

    return {
      panels: this.deduplicateByModel(rawPanels.map(p => this.normalizePanel(p))),
      inverters: this.deduplicateByModel(rawInverters.map(i => this.normalizeInverter(i))),
      batteries: this.deduplicateByModel(rawBatteries.map(b => this.normalizeBattery(b)))
    };
  }
}

module.exports = VikramProductProvider;
