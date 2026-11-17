import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorService } from '../../services/calculator.service';

interface CatalogProduct {
  id: string;
  brand: string;
  category: 'Inverters' | 'Batteries' | 'Panels';
  type: 'inverters' | 'batteries' | 'panels';
  title: string;
  subtitle: string;
  specs: string[];
  price: number;
}

@Component({
  selector: 'app-product-catalog-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-catalog-modal.component.html',
  styleUrls: ['./product-catalog-modal.component.scss']
})
export class ProductCatalogModalComponent {
  readonly calc = inject(CalculatorService);

  @Input() set initialCategory(val: 'inverters' | 'batteries' | 'panels') {
    if (val) this.activeTab.set(val);
  }

  @Output() close = new EventEmitter<void>();

  readonly activeTab = signal<'inverters' | 'batteries' | 'panels'>('inverters');
  readonly selectedBrand = signal<string>('all');
  searchQuery = '';

  readonly brands = [
    { id: 'all', label: 'All Brands' },
    { id: 'luminous', label: 'Luminous' },
    { id: 'waaree', label: 'Waaree' },
    { id: 'adani', label: 'Adani Solar' },
    { id: 'vikram', label: 'Vikram Solar' },
    { id: 'tatapower', label: 'Tata Power' },
    { id: 'growatt', label: 'Growatt' },
    { id: 'solis', label: 'Solis' }
  ];

  readonly catalogProducts: CatalogProduct[] = [
    // Inverters
    { id: 'p-inv-1', brand: 'Luminous', category: 'Inverters', type: 'inverters', title: 'Solarverter PRO 2kVA 24V', subtitle: 'Solar PCU with pure sine wave output', specs: ['2.0 kVA / 1.6 kW', '24V DC Battery', 'MPPT Solar Charger', 'Efficiency > 93%'], price: 24500 },
    { id: 'p-inv-2', brand: 'Growatt', category: 'Inverters', type: 'inverters', title: 'Growatt MIC 3000TL-X', subtitle: 'Single Phase On-Grid GTI Inverter', specs: ['3.0 kW AC Output', 'Dual MPPT 65V-550V', 'Transformerless IP65', 'Wi-Fi Monitoring'], price: 38000 },
    { id: 'p-inv-3', brand: 'Growatt', category: 'Inverters', type: 'inverters', title: 'Growatt MIN 5000TL-X', subtitle: 'Single Phase 5kW On-Grid Inverter', specs: ['5.0 kW AC Output', 'Dual MPPT 80V-550V', 'Compact 10.8kg', 'Max PV 7000W'], price: 48000 },
    { id: 'p-inv-4', brand: 'Solis', category: 'Inverters', type: 'inverters', title: 'Solis S5-GR3P10K 10kW', subtitle: 'Three Phase On-Grid GTI Inverter', specs: ['10.0 kW 3-Phase 415V', 'Dual MPPT 160V-1000V', 'IP66 Waterproof', '10 Years Warranty'], price: 85000 },
    { id: 'p-inv-5', brand: 'Luminous', category: 'Inverters', type: 'inverters', title: 'Cruze+ 5kVA / 48V UPS', subtitle: 'Heavy Duty Sine Wave Home UPS', specs: ['5.0 kVA / 4.0 kW', '48V DC Battery Bus', 'Runs Heavy Appliances', 'Intuitive LCD Display'], price: 34000 },
    { id: 'p-inv-6', brand: 'Growatt', category: 'Inverters', type: 'inverters', title: 'SPH 3000 Hybrid', subtitle: 'Bi-Directional Solar Hybrid Inverter', specs: ['3.0 kW Grid + Battery', '48V Low Voltage Battery', 'Zero Export Capable', 'EPS Backup Switchover < 10ms'], price: 78000 },

    // Batteries
    { id: 'p-bat-1', brand: 'Tata Power', category: 'Batteries', type: 'batteries', title: 'Tata Solar LiFePO4 48V 100Ah', subtitle: 'Wall-Mount Lithium Battery Bank', specs: ['5.12 kWh Storage', '48V (51.2V Nominal)', '3500+ Cycles @ 90% DoD', 'Built-in Smart BMS'], price: 110000 },
    { id: 'p-bat-2', brand: 'Luminous', category: 'Batteries', type: 'batteries', title: 'Luminous LPT12200H 200Ah', subtitle: 'Tall Tubular Solar Deep Cycle Battery', specs: ['12V 200Ah @ C10', 'Hadi High Pressure Casting', '1500 Cycles @ 75% DoD', '60 Months Warranty'], price: 18500 },
    { id: 'p-bat-3', brand: 'Luminous', category: 'Batteries', type: 'batteries', title: 'Luminous 12V 150Ah Tubular', subtitle: 'Standard Deep-Cycle Solar Battery', specs: ['12V 150Ah @ C10', 'Heavy Duty Tubular Plates', 'Low Antimony Alloy', 'Low Water Loss'], price: 14500 },
    { id: 'p-bat-4', brand: 'Growatt', category: 'Batteries', type: 'batteries', title: 'Growatt AXE 5.0L Lithium LFP', subtitle: 'Modular Stackable LiFePO4 Storage', specs: ['5.0 kWh Capacity', '51.2V DC Low Voltage', 'Cobalt-Free Safe LFP', 'Scalable up to 50 kWh'], price: 105000 },

    // Solar Panels
    { id: 'p-pan-1', brand: 'Waaree', category: 'Panels', type: 'panels', title: 'Waaree 545W Mono PERC', subtitle: '144 Half-Cut Cells High-Efficiency PV', specs: ['545 Wp STC Rating', '21.2% Module Efficiency', '10 Busbar Technology', '25 Yrs Performance Warranty'], price: 14200 },
    { id: 'p-pan-2', brand: 'Adani Solar', category: 'Panels', type: 'panels', title: 'Adani Elan Shine 550W', subtitle: 'Bifacial / Mono PERC Half-Cut Module', specs: ['550 Wp Output', 'Up to 25% Rear Bifacial Gain', 'PID Resistant', 'Anodized Aluminium Frame'], price: 14800 },
    { id: 'p-pan-3', brand: 'Vikram Solar', category: 'Panels', type: 'panels', title: 'Vikram Somera 550W Mono', subtitle: 'Half-Cut Multi-Busbar PV Module', specs: ['550 Wp Peak Power', 'Lower Temperature Coefficient', 'Excellent Low Light Yield', 'Certified Wind 2400Pa / Snow 5400Pa'], price: 14400 },
    { id: 'p-pan-4', brand: 'Tata Power', category: 'Panels', type: 'panels', title: 'Tata Power Solar 545W Module', subtitle: 'Tier-1 Mono PERC Half-Cut Panel', specs: ['545 Wp Rated', 'Tier 1 Certified Quality', 'Strict IEC / BIS Compliance', 'IP68 Junction Box'], price: 15200 }
  ];

  readonly filteredProducts = computed(() => {
    const tab = this.activeTab();
    const brand = this.selectedBrand().toLowerCase();
    const q = this.searchQuery.trim().toLowerCase();

    return this.catalogProducts.filter(p => {
      if (p.type !== tab) return false;
      if (brand !== 'all' && !p.brand.toLowerCase().includes(brand)) return false;
      if (q) {
        const str = (p.title + ' ' + p.subtitle + ' ' + p.brand + ' ' + p.specs.join(' ')).toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  });

  setTab(tab: 'inverters' | 'batteries' | 'panels') {
    this.activeTab.set(tab);
  }

  getBrandBadgeClass(brand: string): string {
    const b = brand.toLowerCase();
    if (b.includes('luminous')) return 'bg-primary text-white';
    if (b.includes('waaree')) return 'bg-warning text-dark';
    if (b.includes('adani')) return 'bg-info text-dark';
    if (b.includes('vikram')) return 'bg-secondary text-white';
    if (b.includes('tata')) return 'bg-success text-white';
    return 'bg-dark text-white';
  }

  selectProduct(prod: CatalogProduct) {
    if (prod.type === 'inverters') {
      // You can bind selected inverter model override if desired
    }
    this.close.emit();
  }
}
