import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SummaryService } from '../../../core/services/summary.service';
import { ToastService } from '../../../shared/services/toast.service';
import { InstallmentRow } from '../../../core/models/summary.model';
import { 
  TechnicalProductSpecs, 
  ModuleSerialItem,
  DocumentType 
} from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private summaryService = inject(SummaryService);
  private toastService = inject(ToastService);

  // Active official document form: 'agreement' | 'form1' | 'form3' | 'form4' | 'form6'
  activeDocType = signal<DocumentType>('agreement');

  // Customer selection & filtering
  searchQuery = signal<string>('');
  selectedDistrict = signal<string>('All');
  selectedCustomer = signal<InstallmentRow | null>(null);

  // Technical specifications of selected customer
  currentSpecs = signal<TechnicalProductSpecs>({});

  // Computed: All customers from summaryService
  allCustomers = computed<InstallmentRow[]>(() => {
    return this.summaryService.rawInstallments().filter((r: InstallmentRow) => r.Status !== 'Deactive');
  });

  // Computed: Distinct districts with counts
  districtStats = computed<{ name: string; count: number }[]>(() => {
    const list = this.allCustomers();
    const stats: { name: string; count: number }[] = [];
    const map = new Map<string, number>();

    list.forEach((c: InstallmentRow) => {
      const dist = (c.District || 'Others').trim();
      map.set(dist, (map.get(dist) || 0) + 1);
    });

    stats.push({ name: 'All', count: list.length });
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        stats.push({ name, count });
      });

    return stats;
  });

  // Computed: Filtered customers for directory
  filteredCustomers = computed<InstallmentRow[]>(() => {
    const list = this.allCustomers();
    const query = this.searchQuery().toLowerCase().trim();
    const district = this.selectedDistrict();

    return list.filter((c: InstallmentRow) => {
      if (district !== 'All' && (c.District || 'Others').trim().toLowerCase() !== district.toLowerCase()) {
        return false;
      }
      if (!query) return true;
      const matchName = (c.Name || '').toLowerCase().includes(query);
      const matchCons = (c.ConsumerNo || '').toLowerCase().includes(query);
      const matchMob = (c.MobileNumber || '').toLowerCase().includes(query);
      const matchDist = (c.District || '').toLowerCase().includes(query);
      return matchName || matchCons || matchMob || matchDist;
    });
  });

  constructor() {
    this.initDefaultCustomer();
  }

  private initDefaultCustomer(): void {
    const list = this.allCustomers();
    if (list.length > 0 && !this.selectedCustomer()) {
      this.selectCustomer(list[0]);
    }
  }

  selectCustomer(customer: InstallmentRow | null): void {
    if (!customer) {
      this.selectedCustomer.set(null);
      this.currentSpecs.set({});
      return;
    }

    this.selectedCustomer.set(customer);

    // Parse or build specs
    let specs: TechnicalProductSpecs = {};
    if (customer.ProductSpecs) {
      try {
        specs = typeof customer.ProductSpecs === 'string' 
          ? JSON.parse(customer.ProductSpecs) 
          : customer.ProductSpecs;
      } catch {
        specs = {};
      }
    }

    const loadKW = parseFloat(customer.ProposedCapacity || '3') || 3;
    const defaultModuleCount = Math.max(1, Math.round(loadKW * 2));

    const completeSpecs: TechnicalProductSpecs = {
      dateOfInstallation: specs.dateOfInstallation || customer.InstallationDate || new Date().toISOString().slice(0, 10),
      dateOfCommission: specs.dateOfCommission || customer.CommissioningDate || '',
      connectionType: specs.connectionType || (loadKW > 5 ? '3ph LT' : '1ph LT'),
      state: specs.state || customer.State || 'Odisha',
      district: specs.district || customer.District || '',
      pinCode: specs.pinCode || customer.PinCode || '',
      address: specs.address || customer.Address || '',

      inverterMake: specs.inverterMake || customer.CommittedBrand || 'V-GUARD',
      inverterName: specs.inverterName || 'GRID-TIED',
      inverterSerialNo: specs.inverterSerialNo || ('INV' + (customer.ConsumerNo || customer.SlNo || '101')),
      inverterCapacity: specs.inverterCapacity !== undefined ? specs.inverterCapacity : loadKW,
      inverterInputVoltage: specs.inverterInputVoltage || 300,
      inverterOutputVoltage: specs.inverterOutputVoltage || '220 - 240',
      inverterCount: specs.inverterCount || 1,

      moduleMake: specs.moduleMake || customer.CommittedBrand || 'LUMINOUS',
      moduleCount: specs.moduleCount || defaultModuleCount,
      moduleTypeModel: specs.moduleTypeModel || 'BIFACIAL / TOPCON 545Wp',
      moduleCapacityEach: specs.moduleCapacityEach || 545,
      moduleTotalCapacity: specs.moduleTotalCapacity || (loadKW.toFixed(2) + ' kWp'),
      moduleSerials: specs.moduleSerials && specs.moduleSerials.length > 0 
        ? specs.moduleSerials 
        : this.generateDefaultModuleSerials(specs.moduleCount || defaultModuleCount, 545, customer.ConsumerNo || ''),

      dcdbMake: specs.dcdbMake || 'HAVELLS',
      dcdbMcbDetails: specs.dcdbMcbDetails || 32,
      dcdbSerialNo: specs.dcdbSerialNo || ('DCDB-' + (customer.ConsumerNo || customer.SlNo)),
      dcdbSpdRating: specs.dcdbSpdRating || '600V DC / 20kA',
      acdbMake: specs.acdbMake || 'HAVELLS',
      acdbMcbDetails: specs.acdbMcbDetails || 32,
      acdbSerialNo: specs.acdbSerialNo || ('ACDB-' + (customer.ConsumerNo || customer.SlNo)),
      acdbSpdRating: specs.acdbSpdRating || '415V AC / 40kA',

      dcCableMake: specs.dcCableMake || 'KEI',
      earthResistance: specs.earthResistance || 3,
      dcEarthing: specs.dcEarthing || 1.7,
      acEarthing: specs.acEarthing || 2.3,
      earthWireSize: specs.earthWireSize || 16,
      laSizeType: specs.laSizeType || 'COPPER BONDED',
      dcCableSizeType: specs.dcCableSizeType || 4
    };

    this.currentSpecs.set(completeSpecs);
  }

  generateDefaultModuleSerials(count: number, capEach: number, prefix: string): ModuleSerialItem[] {
    const serials: ModuleSerialItem[] = [];
    const base = prefix ? prefix.slice(-4) : '7721';
    for (let i = 1; i <= count; i++) {
      serials.push({
        index: i,
        serialNo: `SLM${base}${String(i).padStart(3, '0')}`,
        capacity: capEach
      });
    }
    return serials;
  }

  saveCustomerSpecs(specs: TechnicalProductSpecs): void {
    const cust = this.selectedCustomer();
    if (!cust) return;

    this.currentSpecs.set(specs);
    cust.ProductSpecs = specs;

    this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${cust.SlNo}`, {
      ProductSpecs: JSON.stringify(specs)
    }).subscribe({
      next: () => {
        this.toastService.success('Technical specifications & RTS record updated successfully!');
      },
      error: () => {
        this.toastService.info('Specifications saved in active session.');
      }
    });
  }
}
