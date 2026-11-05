/**
 * TataPowerProductProvider.js
 * Official Reference Provider for Tata Power Solar Systems Ltd.
 * Product Catalogue verified against official technical datasheets (https://www.tatapowersolar.com/)
 */

const BaseProductProvider = require('./BaseProductProvider');

class TataPowerProductProvider extends BaseProductProvider {
  constructor() {
    super({
      id: 'tatapower',
      name: 'Tata Power Solar',
      officialUrl: 'https://www.tatapowersolar.com/',
      logoUrl: 'https://www.tatapowersolar.com/wp-content/themes/tpsolar/images/logo.png',
      supportedCategories: ['panels', 'inverters', 'batteries']
    });
  }

  getProducts() {
    const rawPanels = [
      {
        model: 'TP-580-TOPCON',
        series: 'Tata Power N-Type TOPCon Series',
        ratedWatts: 580,
        technology: 'N-Type TOPCon',
        cellType: '144 Half-Cut N-Type Cells (182mm)',
        efficiencyPct: 22.45,
        voc: 51.20,
        vmp: 43.10,
        isc: 14.28,
        imp: 13.46,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 30 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 30,
        isDcr: true,
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/solar-modules/',
        productPageUrl: 'https://www.tatapowersolar.com/solar-modules/topcon-580w/',
        source: 'Tata Power Solar TOPCon Official Datasheet'
      },
      {
        model: 'TP-550M-144HC',
        series: 'Tata Power Mono PERC Half-Cut Series',
        ratedWatts: 550,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 21.28,
        voc: 49.80,
        vmp: 41.90,
        isc: 13.98,
        imp: 13.12,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.5,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/solar-modules/',
        productPageUrl: 'https://www.tatapowersolar.com/solar-modules/mono-perc-550w/',
        source: 'Tata Power Solar Mono PERC Official Datasheet'
      },
      {
        model: 'TP-545M-144HC',
        series: 'Tata Power Mono PERC Half-Cut Series',
        ratedWatts: 545,
        technology: 'Mono PERC',
        cellType: '144 Half-Cut P-Type Cells',
        efficiencyPct: 21.09,
        voc: 49.60,
        vmp: 41.70,
        isc: 13.88,
        imp: 13.02,
        maxSystemVoltage: 1500,
        dimensions: '2278 × 1134 × 35 mm',
        weightKg: 28.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/solar-modules/',
        productPageUrl: 'https://www.tatapowersolar.com/solar-modules/mono-perc-545w/',
        source: 'Tata Power Solar Mono PERC Official Datasheet'
      },
      {
        model: 'TP-440M-120HC',
        series: 'Tata Power Compact Mono Series',
        ratedWatts: 440,
        technology: 'Mono PERC',
        cellType: '120 Half-Cut Cells',
        efficiencyPct: 20.25,
        voc: 41.20,
        vmp: 34.60,
        isc: 13.55,
        imp: 12.72,
        maxSystemVoltage: 1500,
        dimensions: '1903 × 1134 × 35 mm',
        weightKg: 24.0,
        productWarrantyYears: 12,
        performanceWarrantyYears: 25,
        isDcr: true,
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/solar-modules/',
        productPageUrl: 'https://www.tatapowersolar.com/solar-modules/mono-440w/',
        source: 'Tata Power Solar Technical Catalogue'
      }
    ];

    const rawInverters = [
      {
        model: 'TP Solar-GTI 3kW 1-Ph',
        series: 'Tata Power Residential On-Grid GTI',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/inverters/',
        productPageUrl: 'https://www.tatapowersolar.com/inverters/gti-3kw/',
        source: 'Tata Power Solar GTI Datasheet'
      },
      {
        model: 'TP Solar-GTI 5kW 1-Ph',
        series: 'Tata Power Residential On-Grid GTI',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/inverters/',
        productPageUrl: 'https://www.tatapowersolar.com/inverters/gti-5kw/',
        source: 'Tata Power Solar GTI Datasheet'
      },
      {
        model: 'TP Solar-GTI 10kW 3-Ph',
        series: 'Tata Power Commercial Three-Phase Series',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/inverters/',
        productPageUrl: 'https://www.tatapowersolar.com/inverters/gti-10kw/',
        source: 'Tata Power Solar 3-Phase Datasheet'
      },
      {
        model: 'TP Solar-HY-5K (5kW Hybrid)',
        series: 'Tata Power Hybrid Energy Storage Series',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/inverters/',
        productPageUrl: 'https://www.tatapowersolar.com/inverters/hybrid-5kw/',
        source: 'Tata Power Hybrid Technical Datasheet'
      }
    ];

    const rawBatteries = [
      {
        model: 'TP PowerPack LFP 48V 100Ah',
        series: 'Tata Power Smart Lithium Energy Storage',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/storage/',
        productPageUrl: 'https://www.tatapowersolar.com/storage/powerpack-48v-100ah/',
        source: 'Tata Power LFP Storage Technical Datasheet'
      },
      {
        model: 'TP SolarTubular 12V 150Ah',
        series: 'Tata Power Deep Cycle C10 Tall Tubular',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/storage/',
        productPageUrl: 'https://www.tatapowersolar.com/storage/tubular-150ah/',
        source: 'Tata Power Tall Tubular Technical Datasheet'
      },
      {
        model: 'TP SolarTubular 12V 200Ah',
        series: 'Tata Power Deep Cycle C10 Tall Tubular',
        chemistry: 'Tubular Lead-Acid',
        chemistryCategory: 'tubular',
        nominalVoltage: 12,
        capacityAh: 200,
        nominalEnergyKwh: 2.4,
        dodPct: 75,
        usableEnergyKwh: 1.8,
        cycleLife: '~1500–1800 Cycles @ 75% DoD',
        maxContinuousDischargeA: 40,
        peakDischargeA: 200,
        warrantyYears: 5,
        warrantyMonths: 60,
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/storage/',
        productPageUrl: 'https://www.tatapowersolar.com/storage/tubular-200ah/',
        source: 'Tata Power Tall Tubular Technical Datasheet'
      },
      {
        model: 'TP SolarFlat 12V 150Ah Flat Plate',
        series: 'Tata Power Solar Flat Plate Battery Series',
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
        datasheetUrl: 'https://www.tatapowersolar.com/rooftops/storage/',
        productPageUrl: 'https://www.tatapowersolar.com/storage/solarflat-150ah/',
        source: 'Tata Power Flat Plate Technical Datasheet'
      }
    ];

    return {
      panels: this.deduplicateByModel(rawPanels.map(p => this.normalizePanel(p))),
      inverters: this.deduplicateByModel(rawInverters.map(i => this.normalizeInverter(i))),
      batteries: this.deduplicateByModel(rawBatteries.map(b => this.normalizeBattery(b)))
    };
  }
}

module.exports = TataPowerProductProvider;
