import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DocumentService } from './services/document.service';
import { SummaryService } from '../../core/services/summary.service';
import { ToastService } from '../../shared/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerModalComponent } from '../../shared/components/customer-modal/customer-modal.component';
import { InstallmentRow } from '../../core/models/summary.model';
import { TechnicalProductSpecs, DocumentType } from './models/document.model';

// Reusable Sub-components
import { CustomerDirectoryComponent } from './components/customer-directory/customer-directory.component';
import { ProductSpecsModalComponent } from './components/product-specs-modal/product-specs-modal.component';
import { AgreementFormComponent } from './components/agreement-form/agreement-form.component';
import { Form1ApplicationComponent } from './components/form1-application/form1-application.component';
import { Form3InspectionComponent } from './components/form3-inspection/form3-inspection.component';
import { Form4CompletionComponent } from './components/form4-completion/form4-completion.component';
import { Form6CommissionComponent } from './components/form6-commission/form6-commission.component';
import { CustomerImportModalComponent } from './components/customer-import-modal/customer-import-modal.component';
import { CustomerMappingTableComponent } from './components/customer-mapping-table/customer-mapping-table.component';

export type MainDocumentTab = 'form' | 'customer-mapping';

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IconComponent,
    CustomerDirectoryComponent,
    ProductSpecsModalComponent,
    AgreementFormComponent,
    Form1ApplicationComponent,
    Form3InspectionComponent,
    Form4CompletionComponent,
    Form6CommissionComponent,
    CustomerImportModalComponent,
    CustomerMappingTableComponent,
    CustomerModalComponent
  ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit {
  docService = inject(DocumentService);
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  // Top-level Navigation Tab: 'form' vs 'customer-mapping'
  mainTab = signal<MainDocumentTab>('form');

  // Active document type within Form tab
  activeDocType = this.docService.activeDocType;

  // Selected customer & specs
  selectedCustomer = this.docService.selectedCustomer;
  currentSpecs = this.docService.currentSpecs;

  // Directory filter signals
  searchQuery = this.docService.searchQuery;
  selectedDistrict = this.docService.selectedDistrict;
  districtStats = this.docService.districtStats;
  filteredCustomers = this.docService.filteredCustomers;

  // Customer Mapping Tab Signals
  mappingCustomers = signal<any[]>([]);
  mappingSearchQuery = signal<string>('');
  mappingDistrictFilter = signal<string>('All');
  mappingPartnerFilter = signal<string>('All');
  selectAllMapping = signal<boolean>(true);
  isSavingMapping = signal<boolean>(false);

  // Technical Specs Modal State
  isSpecsModalOpen = signal<boolean>(false);

  // Customer Import Modal State
  isImportModalOpen = signal<boolean>(false);

  // Add / Edit Customer Modal State
  isCustomerModalOpen = signal<boolean>(false);
  customerForModal: InstallmentRow | null = null;

  // Document Preview Modal State
  isPreviewModalOpen = signal<boolean>(false);
  previewDocType = signal<DocumentType>('form4');

  // Computed signals for Customer Mapping Tab
  filteredMappingCustomers = computed(() => {
    let items = this.mappingCustomers();
    const query = this.mappingSearchQuery().trim().toLowerCase();
    const dist = this.mappingDistrictFilter();
    const part = this.mappingPartnerFilter();

    if (query) {
      items = items.filter(c => 
        (c.Name && c.Name.toLowerCase().includes(query)) ||
        (c.ConsumerNo && c.ConsumerNo.toLowerCase().includes(query)) ||
        (c.ApplicationNumber && c.ApplicationNumber.toLowerCase().includes(query)) ||
        (c.MobileNumber && c.MobileNumber.toLowerCase().includes(query)) ||
        (c.District && c.District.toLowerCase().includes(query)) ||
        (c.BrokerName && c.BrokerName.toLowerCase().includes(query)) ||
        (c.SubDivision && c.SubDivision.toLowerCase().includes(query)) ||
        (c.DivisionName && c.DivisionName.toLowerCase().includes(query))
      );
    }

    if (dist === '__unmapped__') {
      items = items.filter(c => !c.District || c.District.trim() === '');
    } else if (dist && dist !== 'All') {
      items = items.filter(c => c.District && c.District.toLowerCase() === dist.toLowerCase());
    }

    if (part === '__unmapped__') {
      items = items.filter(c => !c.BrokerName || c.BrokerName.trim() === '');
    } else if (part && part !== 'All') {
      items = items.filter(c => c.BrokerName && c.BrokerName.toLowerCase() === part.toLowerCase());
    }

    return items;
  });

  mappingDistrictsList = computed(() => {
    const set = new Set<string>();
    this.mappingCustomers().forEach(c => {
      if (c.District && c.District.trim()) {
        set.add(c.District.trim());
      }
    });
    return Array.from(set).sort();
  });

  mappingPartnersList = computed(() => {
    const set = new Set<string>();
    this.mappingCustomers().forEach(c => {
      if (c.BrokerName && c.BrokerName.trim()) {
        set.add(c.BrokerName.trim());
      }
    });
    return Array.from(set).sort();
  });

  dirtyCount = computed(() => {
    return this.mappingCustomers().filter(c => c._isDirty).length;
  });

  selectedMappingCount = computed(() => {
    return this.filteredMappingCustomers().filter(c => c.selected && !c.IsDuplicate).length;
  });

  unmappedDistrictCount = computed(() => {
    return this.mappingCustomers().filter(c => !c.District || c.District.trim() === '').length;
  });

  unmappedPartnerCount = computed(() => {
    return this.mappingCustomers().filter(c => !c.BrokerName || c.BrokerName.trim() === '').length;
  });

  ngOnInit(): void {
    // Ensure all customer data is loaded from server
    if (this.summaryService.rawInstallments().length === 0) {
      this.summaryService.loadAllData().subscribe(() => {
        this.initMappingCustomers(this.summaryService.rawInstallments());
        if (!this.selectedCustomer() && this.filteredCustomers().length > 0) {
          this.docService.selectCustomer(this.filteredCustomers()[0]);
        }
      });
    } else {
      this.initMappingCustomers(this.summaryService.rawInstallments());
    }

    // Check route query params to support ?tab=customer-mapping or ?tab=form or ?doc=form1
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'customer-mapping' || tab === 'customer_mapping' || tab === 'mapping') {
        this.mainTab.set('customer-mapping');
      } else if (tab === 'form') {
        this.mainTab.set('form');
      }

      const doc = params['doc'] || params['form'];
      if (doc && ['agreement', 'form1', 'form3', 'form4', 'form6'].includes(doc)) {
        this.activeDocType.set(doc as DocumentType);
      }
    });

    // Auto-select first customer if none selected
    if (!this.selectedCustomer() && this.filteredCustomers().length > 0) {
      this.docService.selectCustomer(this.filteredCustomers()[0]);
    }
  }

  setMainTab(tab: MainDocumentTab): void {
    this.mainTab.set(tab);
  }

  // --- Customer Mapping Hydration & Helpers ---
  private parseBrokerNumberForWork(brokerStr: string | null | undefined): any {
    if (!brokerStr || typeof brokerStr !== 'string') return {};
    const workIdx = brokerStr.indexOf('|work:');
    if (workIdx !== -1) {
      try {
        return JSON.parse(brokerStr.slice(workIdx + 6)) || {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  private formatBrokerNumberWithWorkMeta(currentBrokerNumber: string, updates: any): string {
    const workIdx = (currentBrokerNumber || '').indexOf('|work:');
    let rest = currentBrokerNumber || '';
    let workObj: any = {};
    if (workIdx !== -1) {
      const workStr = rest.slice(workIdx + 6);
      rest = rest.slice(0, workIdx);
      try {
        workObj = JSON.parse(workStr) || {};
      } catch (e) {}
    }
    Object.assign(workObj, updates || {});
    return rest + (Object.keys(workObj).length > 0 ? '|work:' + JSON.stringify(workObj) : '');
  }

  private hydrateCustomer(r: InstallmentRow): any {
    const workObj = this.parseBrokerNumberForWork(r.BrokerNumber);
    return {
      SlNo: r.SlNo,
      Name: r.Name || '',
      ConsumerNo: r.ConsumerNo || '',
      ApplicationNumber: r.ApplicationNumber || workObj.ApplicationNumber || '',
      ProposedCapacity: r.ProposedCapacity || workObj.ProposedCapacity || '',
      SubDivision: r.SubDivision || workObj.SubDivision || '',
      DivisionName: r.DivisionName || workObj.DivisionName || '',
      CircleName: r.CircleName || workObj.CircleName || '',
      MobileNumber: r.MobileNumber || '',
      District: r.District || '',
      BrokerName: r.BrokerName || '',
      LoginDate: r.LoginDate || '',
      Status: r.Status || 'Active',
      IsDuplicate: false,
      selected: true,
      _isDirty: false
    };
  }

  initMappingCustomers(list: InstallmentRow[]): void {
    const items = list.map(r => this.hydrateCustomer(r));
    this.mappingCustomers.set(items);
  }

  onMappingSearchChange(query: string): void {
    this.mappingSearchQuery.set(query);
  }

  onMappingDistrictChange(dist: string): void {
    this.mappingDistrictFilter.set(dist);
  }

  onMappingPartnerChange(partner: string): void {
    this.mappingPartnerFilter.set(partner);
  }

  onMappingSelectionChange(items: any[]): void {
    // updates reactive counts
  }

  onMappingCustomerChange(event: { item: any; field: string }): void {
    // triggered when District or Partner edited
  }

  saveMappingChanges(): void {
    const dirtyItems = this.mappingCustomers().filter(c => c._isDirty);
    if (dirtyItems.length === 0) {
      this.toastService.info('No modified customer mappings to save.');
      return;
    }

    this.isSavingMapping.set(true);
    const requests = dirtyItems.map(c => {
      const existingRow = this.summaryService.rawInstallments().find(r => Number(r.SlNo) === Number(c.SlNo));
      const currentBrokerNumber = existingRow?.BrokerNumber || '';
      const workMetaUpdates = {
        SubDivision: c.SubDivision || '',
        DivisionName: c.DivisionName || '',
        CircleName: c.CircleName || '',
        ApplicationNumber: c.ApplicationNumber || '',
        ProposedCapacity: c.ProposedCapacity || ''
      };
      const newBrokerNum = this.formatBrokerNumberWithWorkMeta(currentBrokerNumber, workMetaUpdates);

      const updatePayload = {
        District: c.District,
        BrokerName: c.BrokerName,
        BrokerNumber: newBrokerNum
      };
      return this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${c.SlNo}`, updatePayload);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.summaryService.loadAllData().subscribe(() => {
          this.isSavingMapping.set(false);
          this.initMappingCustomers(this.summaryService.rawInstallments());
          this.toastService.success(`Successfully saved ${dirtyItems.length} customer mapping record(s).`);
        });
      },
      error: (err) => {
        this.isSavingMapping.set(false);
        this.toastService.error('Error saving customer mappings: ' + (err.message || 'Server error'));
        console.error(err);
      }
    });
  }

  onAddCustomerFromMapping(): void {
    this.customerForModal = null;
    this.isCustomerModalOpen.set(true);
  }

  closeCustomerModal(): void {
    this.isCustomerModalOpen.set(false);
  }

  onCustomerSaved(cust: InstallmentRow): void {
    this.isCustomerModalOpen.set(false);
    this.summaryService.loadAllData().subscribe(() => {
      this.initMappingCustomers(this.summaryService.rawInstallments());
      this.toastService.success('Customer added successfully.');
    });
  }

  // --- Form & Directory Handlers ---
  onSelectCustomer(cust: InstallmentRow): void {
    this.docService.selectCustomer(cust);
  }

  onDistrictFilter(district: string): void {
    this.selectedDistrict.set(district);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  setDocType(type: DocumentType): void {
    this.activeDocType.set(type);
  }

  // --- Specifications Modal ---
  openSpecsModal(): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }
    this.isSpecsModalOpen.set(true);
  }

  closeSpecsModal(): void {
    this.isSpecsModalOpen.set(false);
  }

  onSaveSpecs(updatedSpecs: TechnicalProductSpecs): void {
    this.docService.saveCustomerSpecs(updatedSpecs);
    this.isSpecsModalOpen.set(false);
  }

  // --- Customer Import Modal ---
  openImportModal(): void {
    this.isImportModalOpen.set(true);
  }

  closeImportModal(): void {
    this.isImportModalOpen.set(false);
  }

  onImportCompleted(): void {
    this.isImportModalOpen.set(false);
    this.summaryService.loadAllData().subscribe(() => {
      this.initMappingCustomers(this.summaryService.rawInstallments());
      this.toastService.success('Customer import complete. Records refreshed!');
    });
  }

  // --- Print & Preview Modal ---
  openPreviewModal(docType?: DocumentType): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }
    this.previewDocType.set(docType || this.activeDocType());
    this.isPreviewModalOpen.set(true);
  }

  closePreviewModal(): void {
    this.isPreviewModalOpen.set(false);
  }

  printDocument(): void {
    window.print();
  }

  resetCurrentDocument(): void {
    const cust = this.selectedCustomer();
    if (cust) {
      this.docService.selectCustomer(cust);
      this.toastService.info('Form reloaded with latest customer details.');
    }
  }
}
