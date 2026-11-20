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

    // Parse saved specs from database if available
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

    // Database values with user-requested defaults for specific fields
    const completeSpecs: TechnicalProductSpecs = {
      // 1. Site
      dateOfInstallation: specs.dateOfInstallation || customer.InstallationDate || '',
      dateOfCommission: specs.dateOfCommission || customer.CommissioningDate || '',
      connectionType: specs.connectionType || '1ph LT',
      state: specs.state || customer.State || '',
      district: specs.district || customer.District || '',
      pinCode: specs.pinCode || customer.PinCode || '',
      address: specs.address || customer.Address || '',

      // 2. Inverter (Defaults: GRID-TIED, count 1, capacity 3, i/p voltage 300, o/p voltage 220-240)
      inverterMake: specs.inverterMake || customer.CommittedBrand || '',
      inverterName: specs.inverterName || 'GRID-TIED',
      inverterModelNo: specs.inverterModelNo || '',
      inverterSerialNo: specs.inverterSerialNo || '',
      inverterCapacity: specs.inverterCapacity !== undefined && specs.inverterCapacity !== null 
        ? specs.inverterCapacity 
        : (customer.ProposedCapacity ? parseFloat(customer.ProposedCapacity) || 3 : 3),
      inverterInputVoltage: specs.inverterInputVoltage ?? 300,
      inverterOutputVoltage: specs.inverterOutputVoltage || '220-240',
      inverterCount: specs.inverterCount ?? 1,

      // 3. PV Module
      moduleMake: specs.moduleMake || customer.CommittedBrand || '',
      moduleCount: specs.moduleCount ?? undefined,
      moduleTypeModel: specs.moduleTypeModel || '',
      moduleCapacityEach: specs.moduleCapacityEach ?? undefined,
      moduleTotalCapacity: specs.moduleTotalCapacity || '',
      moduleSerials: specs.moduleSerials && specs.moduleSerials.length > 0 ? specs.moduleSerials : [],

      // 4. DCDB & ACDB (Defaults: MCB 32)
      dcdbMake: specs.dcdbMake || '',
      dcdbMcbDetails: specs.dcdbMcbDetails ?? 32,
      dcdbSerialNo: specs.dcdbSerialNo || '',
      acdbMake: specs.acdbMake || '',
      acdbMcbDetails: specs.acdbMcbDetails ?? 32,
      acdbSerialNo: specs.acdbSerialNo || '',

      // 5. Cables & Earthing (Defaults: Earth res 3, Wire size 16, DC earth 1.7, AC earth 2.3, LA COPPER BOUNDED, DC cable size 4)
      dcCableMake: specs.dcCableMake || '',
      dcCableSizeType: specs.dcCableSizeType ?? 4,
      acCableMake: specs.acCableMake || '',
      acCableSizeType: specs.acCableSizeType ?? 4,
      earthResistance: specs.earthResistance ?? 3,
      dcEarthing: specs.dcEarthing ?? 1.7,
      acEarthing: specs.acEarthing ?? 2.3,
      earthWireSize: specs.earthWireSize ?? 16,
      laSizeType: specs.laSizeType || 'COPPER BOUNDED'
    };

    this.currentSpecs.set(completeSpecs);
  }

  saveCustomerSpecs(specs: TechnicalProductSpecs): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }

    this.currentSpecs.set({ ...specs });
    cust.ProductSpecs = specs;
    if (specs.address) cust.Address = specs.address;
    if (specs.pinCode) cust.PinCode = specs.pinCode;
    if (specs.district) cust.District = specs.district;
    if (specs.state) cust.State = specs.state;
    if (specs.dateOfInstallation) cust.InstallationDate = specs.dateOfInstallation;

    const payload: any = {
      ProductSpecs: JSON.stringify(specs),
      InstallationDate: specs.dateOfInstallation || null,
      Address: specs.address || '',
      PinCode: specs.pinCode || null,
      District: specs.district || cust.District || '',
      State: specs.state || 'Odisha'
    };

    this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${cust.SlNo}`, payload).subscribe({
      next: () => {
        const inMemory = this.summaryService.rawInstallments().find(r => Number(r.SlNo) === Number(cust.SlNo));
        if (inMemory) {
          inMemory.ProductSpecs = specs;
          if (specs.address) inMemory.Address = specs.address;
          if (specs.pinCode) inMemory.PinCode = specs.pinCode;
          if (specs.district) inMemory.District = specs.district;
          if (specs.dateOfInstallation) inMemory.InstallationDate = specs.dateOfInstallation;
        }
        this.toastService.success(`Specifications saved for ${cust.Name || 'customer'}!`);
      },
      error: () => {
        this.toastService.info('Specifications saved in active session.');
      }
    });
  }
}
