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

    // Only populate what is actually saved in the database (ProductSpecs or customer record columns)
    // No mock/dummy fillers: all unsaved fields remain empty so the user can fill them up
    const completeSpecs: TechnicalProductSpecs = {
      // 1. Site
      dateOfInstallation: specs.dateOfInstallation || customer.InstallationDate || '',
      dateOfCommission: specs.dateOfCommission || customer.CommissioningDate || '',
      connectionType: specs.connectionType || '',
      state: specs.state || customer.State || '',
      district: specs.district || customer.District || '',
      pinCode: specs.pinCode || customer.PinCode || '',
      address: specs.address || customer.Address || '',

      // 2. Inverter
      inverterMake: specs.inverterMake || customer.CommittedBrand || '',
      inverterName: specs.inverterName || '',
      inverterSerialNo: specs.inverterSerialNo || '',
      inverterCapacity: specs.inverterCapacity !== undefined && specs.inverterCapacity !== null 
        ? specs.inverterCapacity 
        : (customer.ProposedCapacity ? parseFloat(customer.ProposedCapacity) || undefined : undefined),
      inverterInputVoltage: specs.inverterInputVoltage ?? undefined,
      inverterOutputVoltage: specs.inverterOutputVoltage || '',
      inverterCount: specs.inverterCount ?? undefined,

      // 3. PV Module
      moduleMake: specs.moduleMake || customer.CommittedBrand || '',
      moduleCount: specs.moduleCount ?? undefined,
      moduleTypeModel: specs.moduleTypeModel || '',
      moduleCapacityEach: specs.moduleCapacityEach ?? undefined,
      moduleTotalCapacity: specs.moduleTotalCapacity || '',
      moduleSerials: specs.moduleSerials && specs.moduleSerials.length > 0 ? specs.moduleSerials : [],

      // 4. DCDB & ACDB
      dcdbMake: specs.dcdbMake || '',
      dcdbMcbDetails: specs.dcdbMcbDetails ?? undefined,
      dcdbSerialNo: specs.dcdbSerialNo || '',
      dcdbSpdRating: specs.dcdbSpdRating || '',
      acdbMake: specs.acdbMake || '',
      acdbMcbDetails: specs.acdbMcbDetails ?? undefined,
      acdbSerialNo: specs.acdbSerialNo || '',
      acdbSpdRating: specs.acdbSpdRating || '',

      // 5. Cables & Earthing
      dcCableMake: specs.dcCableMake || '',
      earthResistance: specs.earthResistance ?? undefined,
      dcEarthing: specs.dcEarthing ?? undefined,
      acEarthing: specs.acEarthing ?? undefined,
      earthWireSize: specs.earthWireSize ?? undefined,
      laSizeType: specs.laSizeType || '',
      dcCableSizeType: specs.dcCableSizeType ?? undefined
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
