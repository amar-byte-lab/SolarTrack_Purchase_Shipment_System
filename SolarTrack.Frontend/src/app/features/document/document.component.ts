import { Component, OnInit, inject, signal, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { DocumentService } from './services/document.service';
import { SummaryService } from '../../core/services/summary.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerModalComponent } from '../../shared/components/customer-modal/customer-modal.component';
import { InstallmentRow } from '../../core/models/summary.model';
import { TechnicalProductSpecs, DocumentType, Form1Data, Form3Data, Form4Data } from './models/document.model';

// Reusable Sub-components
import { ProductSpecsModalComponent } from './components/product-specs-modal/product-specs-modal.component';
import { TechnicalSpecsAccordionComponent } from './components/technical-specs-accordion/technical-specs-accordion.component';
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
    ProductSpecsModalComponent,
    TechnicalSpecsAccordionComponent,
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
  confirmDialogService = inject(ConfirmDialogService);
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

  // Customer Mapping Tab Signals (Matching Summary page filter design)
  mappingCustomers = signal<any[]>([]);
  mappingSearchQuery = signal<string>('');
  mappingSelectedPartners = signal<string[]>([]);
  mappingSelectedDistricts = signal<string[]>([]);
  mappingSelectedStatuses = signal<string[]>([]);
  isMappingPartnerMenuOpen = false;
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

  // Form 1 State
  form1Data = signal<Form1Data>(this.buildDefaultForm1Data(null, {}));

  // Form 3 State
  form3Data = signal<Form3Data>(this.buildDefaultForm3Data(null, {}));

  // Form 4 State
  form4Data = signal<Form4Data>(this.buildDefaultForm4Data(null, {}));

  constructor() {
    effect(() => {
      const cust = this.selectedCustomer();
      const specs = this.currentSpecs();
      this.form1Data.set(this.buildDefaultForm1Data(cust, specs));
      this.form3Data.set(this.buildDefaultForm3Data(cust, specs));
      this.form4Data.set(this.buildDefaultForm4Data(cust, specs));
    });

    effect(() => {
      const cust = this.selectedCustomer();
      const isModalOpen = this.isPreviewModalOpen();
      const docType = this.previewDocType();
      if (isModalOpen && docType === 'agreement' && cust) {
        setTimeout(() => this.renderAgreementDocxPreview(), 50);
      }
    });
  }

  // Searchable Customer Dropdown in Form Tab
  isCustomerDropdownOpen = false;
  customerSearchText = signal<string>('');

  searchedCustomers = computed<InstallmentRow[]>(() => {
    const list = this.docService.allCustomers();
    const query = this.customerSearchText().toLowerCase().trim();
    if (!query) return list;

    // Split query by whitespace so user can search by name or title (surname)
    const tokens = query.split(/\s+/).filter(t => t.length > 0);

    return list.filter((c: InstallmentRow) => {
      const name = (c.Name || '').toLowerCase();
      const district = (c.District || '').toLowerCase();
      const cons = (c.ConsumerNo || '').toLowerCase();

      return tokens.every(token => name.includes(token) || district.includes(token) || cons.includes(token));
    });
  });

  toggleCustomerDropdown(): void {
    this.isCustomerDropdownOpen = !this.isCustomerDropdownOpen;
  }

  onCustomerSearchTextChange(val: string): void {
    this.customerSearchText.set(val);
  }

  clearCustomerSearch(): void {
    this.customerSearchText.set('');
  }

  selectDropdownCustomer(cust: InstallmentRow): void {
    this.docService.selectCustomer(cust);
    this.isCustomerDropdownOpen = false;
    this.customerSearchText.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.isMappingPartnerMenuOpen = false;
    }
    if (!target.closest('.customer-dropdown-container')) {
      this.isCustomerDropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isCustomerDropdownOpen = false;
    this.isMappingPartnerMenuOpen = false;
  }

  // --- Computed signals for Customer Mapping Tab ---
  mappingPartnersList = computed<string[]>(() => {
    const set = new Set<string>();
    this.summaryService.partnerList().forEach(p => {
      if (p && p.trim()) set.add(p.trim());
    });
    this.mappingCustomers().forEach(c => {
      if (c.BrokerName && c.BrokerName.trim()) {
        set.add(c.BrokerName.trim());
      }
    });
    return Array.from(set).sort();
  });

  mappingDistrictStats = computed<{ name: string; count: number; active: boolean }[]>(() => {
    const list = this.mappingCustomers();
    const map = new Map<string, number>();
    
    list.forEach(c => {
      const dist = (c.District && c.District.trim()) ? c.District.trim() : '(No District)';
      map.set(dist, (map.get(dist) || 0) + 1);
    });

    const sel = this.mappingSelectedDistricts();
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        active: sel.includes(name)
      }))
      .sort((a, b) => {
        if (a.name === '(No District)') return 1;
        if (b.name === '(No District)') return -1;
        return a.name.localeCompare(b.name);
      });
  });

  mappingStatusStats = computed<{ name: string; count: number; active: boolean }[]>(() => {
    const list = this.mappingCustomers();
    const map = new Map<string, number>();

    list.forEach(c => {
      const st = (c.Status && c.Status.trim()) ? c.Status.trim() : 'Active';
      map.set(st, (map.get(st) || 0) + 1);
    });

    const sel = this.mappingSelectedStatuses();
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        active: sel.includes(name)
      }))
      .sort((a, b) => {
        if (a.name.toLowerCase() === 'active') return -1;
        if (b.name.toLowerCase() === 'active') return 1;
        return a.name.localeCompare(b.name);
      });
  });

  filteredMappingCustomers = computed(() => {
    let items = this.mappingCustomers();
    const query = this.mappingSearchQuery().trim().toLowerCase();
    const partners = this.mappingSelectedPartners();
    const districts = this.mappingSelectedDistricts();
    const statuses = this.mappingSelectedStatuses();

    if (query) {
      items = items.filter(c => 
        (c.Name && c.Name.toLowerCase().includes(query)) ||
        (c.ConsumerNo && c.ConsumerNo.toLowerCase().includes(query)) ||
        (c.ApplicationNumber && c.ApplicationNumber.toLowerCase().includes(query)) ||
        (c.MobileNumber && c.MobileNumber.toLowerCase().includes(query)) ||
        (c.Address && c.Address.toLowerCase().includes(query)) ||
        (c.PinCode && c.PinCode.toLowerCase().includes(query)) ||
        (c.District && c.District.toLowerCase().includes(query)) ||
        (c.BrokerName && c.BrokerName.toLowerCase().includes(query)) ||
        (c.SubDivision && c.SubDivision.toLowerCase().includes(query)) ||
        (c.DivisionName && c.DivisionName.toLowerCase().includes(query)) ||
        (c.Status && c.Status.toLowerCase().includes(query))
      );
    }

    if (partners.length > 0) {
      items = items.filter(c => {
        const broker = c.BrokerName ? c.BrokerName.trim() : '';
        if (partners.includes('(No Partner)') && !broker) {
          return true;
        }
        return broker ? partners.includes(broker) : false;
      });
    }

    if (districts.length > 0) {
      items = items.filter(c => {
        const dist = c.District ? c.District.trim() : '';
        if (districts.includes('(No District)') && !dist) {
          return true;
        }
        return dist ? districts.includes(dist) : false;
      });
    }

    if (statuses.length > 0) {
      items = items.filter(c => {
        const st = (c.Status && c.Status.trim()) ? c.Status.trim() : 'Active';
        return statuses.includes(st);
      });
    }

    // Always sort descending by SlNo so most recently inserted customers appear first
    return [...items].sort((a, b) => (Number(b.SlNo) || 0) - (Number(a.SlNo) || 0));
  });

  dirtyCount = computed(() => {
    return this.mappingCustomers().filter(c => c._isDirty).length;
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
      Address: r.Address || '',
      PinCode: r.PinCode || '',
      Pin: r.PinCode || '',
      District: r.District || '',
      BrokerName: r.BrokerName || '',
      LoginDate: r.LoginDate || '',
      Status: r.Status || 'Active',
      IsDuplicate: false,
      selected: false,
      _isDirty: false
    };
  }

  initMappingCustomers(list: InstallmentRow[]): void {
    const items = list.map(r => this.hydrateCustomer(r));
    // Sort descending by SlNo so most recently inserted customers appear first
    items.sort((a, b) => (Number(b.SlNo) || 0) - (Number(a.SlNo) || 0));
    this.mappingCustomers.set(items);
  }

  // --- Mapping Filters Methods (Exact matching Summary toolbar) ---
  onMappingSearchChange(query: string): void {
    this.mappingSearchQuery.set(query);
  }

  toggleMappingPartnerDropdown(): void {
    this.isMappingPartnerMenuOpen = !this.isMappingPartnerMenuOpen;
  }

  closeMappingPartnerDropdown(): void {
    this.isMappingPartnerMenuOpen = false;
  }

  isMappingPartnerSelected(partner: string): boolean {
    return this.mappingSelectedPartners().includes(partner);
  }

  toggleMappingPartner(partner: string): void {
    const current = this.mappingSelectedPartners();
    if (current.includes(partner)) {
      this.mappingSelectedPartners.set(current.filter(p => p !== partner));
    } else {
      this.mappingSelectedPartners.set([...current, partner]);
    }
  }

  get mappingPartnerDropdownLabel(): string {
    const sel = this.mappingSelectedPartners();
    if (sel.length === 0) return 'All Partners';
    if (sel.length === 1) return sel[0];
    return `${sel.length} Partners`;
  }

  isMappingDistrictSelected(distVal: string): boolean {
    if (distVal === 'ALL') {
      return this.mappingSelectedDistricts().length === 0;
    }
    return this.mappingSelectedDistricts().includes(distVal);
  }

  toggleMappingDistrict(distVal: string): void {
    if (distVal === 'ALL') {
      this.mappingSelectedDistricts.set([]);
      return;
    }
    const current = this.mappingSelectedDistricts();
    if (current.includes(distVal)) {
      this.mappingSelectedDistricts.set(current.filter(d => d !== distVal));
    } else {
      this.mappingSelectedDistricts.set([...current, distVal]);
    }
  }

  isMappingStatusSelected(statusVal: string): boolean {
    if (statusVal === 'ALL') {
      return this.mappingSelectedStatuses().length === 0;
    }
    return this.mappingSelectedStatuses().includes(statusVal);
  }

  toggleMappingStatus(statusVal: string): void {
    if (statusVal === 'ALL') {
      this.mappingSelectedStatuses.set([]);
      return;
    }
    const current = this.mappingSelectedStatuses();
    if (current.includes(statusVal)) {
      this.mappingSelectedStatuses.set(current.filter(s => s !== statusVal));
    } else {
      this.mappingSelectedStatuses.set([...current, statusVal]);
    }
  }

  clearMappingFilters(): void {
    this.mappingSearchQuery.set('');
    this.mappingSelectedPartners.set([]);
    this.mappingSelectedDistricts.set([]);
    this.mappingSelectedStatuses.set([]);
  }

  onMappingCustomerChange(event: { item: any; field: string }): void {
    // Dropdown change marks row dirty
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
        Status: c.Status,
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

  // --- Action Column Methods: Inline Row Save, Edit Modal, Deactive/Activate, Delete ---
  onSaveCustomerRow(c: any): void {
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
      Address: (c.Address || '').toUpperCase(),
      PinCode: c.PinCode || c.Pin || '',
      District: c.District || '',
      BrokerName: c.BrokerName || '',
      BrokerNumber: newBrokerNum
    };

    this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${c.SlNo}`, updatePayload).subscribe({
      next: () => {
        c._isDirty = false;
        this.toastService.success(`Customer "${c.Name || 'Record'}" saved successfully.`);
        this.summaryService.loadAllData().subscribe(() => {
          this.initMappingCustomers(this.summaryService.rawInstallments());
        });
      },
      error: (err) => {
        this.toastService.error('Error saving customer: ' + (err.message || 'Server error'));
        console.error(err);
      }
    });
  }

  onEditCustomerFromMapping(c: any): void {
    const existing = this.summaryService.rawInstallments().find(r => Number(r.SlNo) === Number(c.SlNo));
    this.customerForModal = existing || c;
    this.isCustomerModalOpen.set(true);
  }

  onToggleStatusCustomer(c: any): void {
    const desc = c.Name ? `${c.Name}${c.District ? ' (' + c.District + ')' : ''}` : `Sl No. ${c.SlNo}`;
    const isCurrentlyDeactive = c.Status === 'Deactive';
    const actionText = isCurrentlyDeactive ? 'activate' : 'deactivate';

    this.confirmDialogService.confirm({
      title: isCurrentlyDeactive ? 'Confirm Activation' : 'Confirm Deactivation',
      message: `Are you sure you want to ${actionText} customer ${desc}?`,
      confirmText: isCurrentlyDeactive ? 'Activate' : 'Deactivate',
      isDanger: !isCurrentlyDeactive
    }).then(confirmed => {
      if (confirmed) {
        if (isCurrentlyDeactive) {
          this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${c.SlNo}`, { Status: 'Active' }).subscribe({
            next: () => {
              c.Status = 'Active';
              this.toastService.success(`Customer ${desc} activated successfully.`);
              this.summaryService.loadAllData().subscribe(() => {
                this.initMappingCustomers(this.summaryService.rawInstallments());
              });
            },
            error: (err) => {
              this.toastService.error('Error activating customer: ' + (err.message || 'Server error'));
            }
          });
        } else {
          this.summaryService.deactivateCustomer(c.SlNo).subscribe({
            next: () => {
              c.Status = 'Deactive';
              this.toastService.success(`Customer ${desc} deactivated successfully.`);
              this.summaryService.loadAllData().subscribe(() => {
                this.initMappingCustomers(this.summaryService.rawInstallments());
              });
            },
            error: (err) => {
              this.toastService.error('Error deactivating customer: ' + (err.message || 'Server error'));
            }
          });
        }
      }
    });
  }

  onDeleteCustomer(c: any): void {
    const desc = c.Name ? `${c.Name}${c.District ? ' (' + c.District + ')' : ''}` : `Sl No. ${c.SlNo}`;
    this.confirmDialogService.confirm({
      title: 'Confirm Customer Removal',
      message: `Are you sure you want to permanently delete customer ${desc}? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      isDanger: true
    }).then(confirmed => {
      if (confirmed) {
        this.summaryService.deleteCustomer(c.SlNo).subscribe({
          next: () => {
            this.toastService.success(`Customer ${desc} removed successfully.`);
            this.summaryService.loadAllData().subscribe(() => {
              this.initMappingCustomers(this.summaryService.rawInstallments());
            });
          },
          error: (err) => {
            this.toastService.error('Error removing customer: ' + (err.message || 'Server error'));
          }
        });
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
      this.toastService.success('Customer saved successfully.');
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

  onSpecsUpdated(updatedSpecs: TechnicalProductSpecs): void {
    this.docService.currentSpecs.set({ ...updatedSpecs });
  }

  onAgreementFieldChange(): void {
    this.docService.currentSpecs.set({ ...this.currentSpecs() });
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
    const targetDocType = docType || this.activeDocType();
    this.previewDocType.set(targetDocType);
    this.isPreviewModalOpen.set(true);

    if (targetDocType === 'agreement') {
      setTimeout(() => {
        this.renderAgreementDocxPreview();
      }, 50);
    }
  }

  closePreviewModal(): void {
    this.isPreviewModalOpen.set(false);
  }

  printDocument(): void {
    window.print();
  }

  getFormattedAgreementDate(): string {
    const cust = this.selectedCustomer();
    const raw = cust?.AgreementDate || cust?.InstallationDate;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return String(raw);
    }
    const today = new Date();
    return today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  getCustomerSalutationName(): string {
    const name = (this.selectedCustomer()?.Name || '').trim();
    if (!name) return 'Consumer';
    if (/^(mr|mrs|ms|dr|shri|smt)\b/i.test(name)) {
      return name;
    }
    return `Mr ${name}`;
  }

  getAgreementAddress(): string {
    const cust = this.selectedCustomer();
    const specs = this.currentSpecs();
    let addr = (specs.address || cust?.Address || '').trim();
    const dist = (specs.district || cust?.District || '').trim();
    const state = (specs.state || cust?.State || 'ODISHA').trim();
    const pin = (specs.pinCode || cust?.PinCode || '').trim();

    const parts: string[] = [];
    if (addr) {
      if (!addr.toUpperCase().startsWith('AT:') && !addr.toUpperCase().startsWith('AT-') && !addr.toUpperCase().startsWith('AT ')) {
        addr = `AT: ${addr}`;
      }
      parts.push(addr);
    }
    if (dist) parts.push(`DISTRICT: ${dist}`);
    if (state) parts.push(`STATE: ${state}`);
    if (pin) parts.push(`PIN: ${pin}`);
    return parts.length > 0 ? parts.join(', ') : (addr || 'AT: _______________________');
  }

  onForm1DataChange(data: Form1Data): void {
    this.form1Data.set({ ...data });
  }

  resetForm1Data(): void {
    this.form1Data.set(this.buildDefaultForm1Data(this.selectedCustomer(), this.currentSpecs()));
    this.toastService.info('Form 1 reset to default database values.');
  }

  formatDateToDisplay(val: any): string {
    if (!val) {
      val = new Date();
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).toUpperCase();
    const day = d.getDate();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  buildDefaultForm1Data(cust: InstallmentRow | null, specs: TechnicalProductSpecs): Form1Data {
    if (!cust) {
      return {
        discomOffice: 'The Designated Officer TPNODL',
        displayDate: this.formatDateToDisplay(new Date()),
        applicantName: '',
        address: '',
        consumerNo: '',
        mobile: '',
        email: '',
        reTypeCapacity: 'Solar – 3.0kwp',
        sanctionLoad: '3',
        meterProcChoice: 'DISCOM',
        location: '',
        inverterMakeType: 'WAAREE / Grid Tied',
        inverterAutoIso: 'Yes',
        existingPlants: 'No',
        existingCapacity: '0',
        commissionDays: '30 Days',
        category: 'Domestic',
        voltageLevel: '230 V',
        declarationText: 'I hereby request you to provide grid connectivity to the solar Rooftop PV system installed or planning to install at premises owned/occupied by me. I do hereby declare that the information furnished above for NM/BD/GM have been checked & verified to the best of my knowledge and belief.',
        signApplicant: ''
      };
    }

    // DISCOM determination based on District
    const dist = (specs.district || cust.District || '').toUpperCase().trim();
    let discomName = 'TPNODL';
    const tpwodlDists = ['SAMBALPUR', 'BARGARH', 'JHARSUGUDA', 'DEOGARH', 'SUNDARGARH', 'BOLANGIR', 'SONEPUR', 'KALAHANDI', 'NUAPADA', 'KORAPUT', 'NABARANGPUR', 'MALKANGIRI', 'RAYAGADA'];
    const tpsodlDists = ['GANJAM', 'GAJAPATI', 'KANDHAMAL', 'BOUDH'];
    const tpcodlDists = ['CUTTACK', 'PURI', 'KHURDA', 'KHORDHA', 'NAYAGARH', 'KENDRAPARA', 'JAGATSINGHPUR', 'JAJPUR', 'DHENKANAL', 'ANGUL'];

    if (tpwodlDists.some(d => dist.includes(d))) discomName = 'TPWODL';
    else if (tpsodlDists.some(d => dist.includes(d))) discomName = 'TPSODL';
    else if (tpcodlDists.some(d => dist.includes(d))) discomName = 'TPCODL';
    else discomName = 'TPNODL';

    const discomOffice = `The Designated Officer ${discomName}`;

    // Date determination
    const dateVal = cust.LoginDate || cust.InstallationDate || specs.dateOfInstallation || new Date();
    const displayDate = this.formatDateToDisplay(dateVal);

    // Full Address
    let fullAddr = (specs.address || cust.Address || '').trim();
    if (fullAddr && !fullAddr.toUpperCase().startsWith('AT:') && !fullAddr.toUpperCase().startsWith('AT-') && !fullAddr.toUpperCase().startsWith('AT ')) {
      fullAddr = `AT: ${fullAddr}`;
    }
    const distPart = specs.district || cust.District;
    const pinPart = specs.pinCode || cust.PinCode;
    if (distPart && !fullAddr.toUpperCase().includes(distPart.toUpperCase())) {
      fullAddr += `, Dist-${distPart}`;
    }
    if (pinPart && !fullAddr.includes(pinPart)) {
      fullAddr += `, ${pinPart}`;
    }

    // Applicant Name
    let name = (cust.Name || '').trim();
    if (name && !/^(mr|mrs|ms|dr|shri|smt)\b/i.test(name)) {
      name = `Mr. ${name}`;
    }

    // Capacity & Load
    const cap = cust.ProposedCapacity || specs.inverterCapacity || '3';
    const capNum = parseFloat(String(cap)) || 3;
    const reTypeCapacity = `Solar – ${cap}kwp`;
    const sanctionLoad = String(Math.round(capNum) || 3);
    const voltage = capNum > 5 ? '415 V' : '230 V';

    // Inverter Make
    const invMake = (specs.inverterMake || '').trim();
    const inverterMakeType = invMake ? `${invMake} / Grid Tied` : '';

    return {
      discomOffice,
      displayDate,
      applicantName: name,
      address: fullAddr,
      consumerNo: cust.ConsumerNo || cust.ApplicationNumber || '',
      mobile: cust.MobileNumber || '',
      email: (cust as any).Email || '',
      reTypeCapacity,
      sanctionLoad,
      meterProcChoice: 'DISCOM',
      location: fullAddr,
      inverterMakeType,
      inverterAutoIso: 'Yes',
      existingPlants: 'No',
      existingCapacity: '0',
      commissionDays: '30 Days',
      category: 'Domestic',
      voltageLevel: voltage,
      declarationText: 'I hereby request you to provide grid connectivity to the solar Rooftop PV system installed or planning to install at premises owned/occupied by me. I do hereby declare that the information furnished above for NM/BD/GM have been checked & verified to the best of my knowledge and belief.',
      signApplicant: name
    };
  }

  buildDefaultForm3Data(cust: InstallmentRow | null, specs: TechnicalProductSpecs): Form3Data {
    if (!cust) {
      return {
        discomOffice: '',
        capacityKwp: '',
        inspectionLocation: '',
        headerSummary: '',
        applicantName: '',
        applicationNoWithDate: '',
        address: '',
        consumerNo: '',
        consumerCategory: 'DOMESTIC',
        connectionType: '1ph LT',
        contractDemand: '',
        arrear: '0',
        vendorName: 'Shri Trutiyadev Solar Enterprises',
        installationDate: '',
        transformerCapacity: '',
        transformerLocation: '',
        transformerTotalRtsCapacity: '',
        transformerCapacityAdequate: 'Yes',
        proposedPlantDetails: '',
        sldOkStatus: 'YES/NO(if it is no, state reasons for the same and suggest alternate arrangements )',
        inverterMake: '',
        inverterSerialNo: '',
        inverterCapacity: '',
        inverterVoltages: '',
        inverterAntiIslanding: 'YES/NO (Need to be checked practically before charging)',
        moduleMake: '',
        moduleSerials: '',
        moduleType: '',
        moduleCapacityEach: '',
        moduleCount: '',
        moduleTotalCapacity: '',
        dcEarthing: '',
        acEarthing: '',
        earthingPermissibleText: 'Within permissible limit or Not (Values should be certified by TPNODL official)',
        protectiveSystemDetails: 'AC & DC DB: Yes/No\nManual Switch at Solar Side: Yes/No\nlightening arrestor: Yes/No\nSPDs: Yes/No\nRelay operated automatic switch at net- meter side: Yes/ No',
        protectionBackFeeding: '',
        eicInspectionLetter: 'Yes/ No',
        safetyCertificate: 'Yes/No',
        actualSldDiagram: 'Yes/ No',
        testReportComponents: 'Yes/NO',
        netMeterTotal: '',
        netMeterMake: '',
        netMeterSerial: '',
        netMeterPhase: '',
        netMeterCapacity: '',
        netMeterConstant: '',
        solarMeterTotal: '',
        solarMeterMake: '',
        solarMeterSerial: '',
        solarMeterPhase: '',
        solarMeterCapacity: '',
        solarMeterConstant: '',
        otherRemarks: '',
        satisfactorySyncStatus: 'Yes/No ( if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)',
        provisionSwitches: 'Provision of manual and automatic switches: Yes / No',
        omInfoStatus: "Whether Operation and Maintenance information:\nSuch as Do's and Don'ts are provided by the System Installer: Yes*/ No*",
        applicantSignName: '',
        applicantSignDate: '',
        installerFirmName: 'Shri Trutiyadev Solar Enterprises',
        installerAddress: 'AT-TALAMUNDALI, PO-KANKADAJODI, DIST-CUTTACK,\nPIN-754035, Odisha',
        installerSignDate: '',
        certifiedOfficerTitle: 'Designated officer TPNODL',
        certifiedOfficerDate: ''
      };
    }

    // DISCOM determination based on District
    const dist = (specs.district || cust.District || '').toUpperCase().trim();
    let discomName = 'TPNODL';
    const tpwodlDists = ['SAMBALPUR', 'BARGARH', 'JHARSUGUDA', 'DEOGARH', 'SUNDARGARH', 'BOLANGIR', 'SONEPUR', 'KALAHANDI', 'NUAPADA', 'KORAPUT', 'NABARANGPUR', 'MALKANGIRI', 'RAYAGADA'];
    const tpsodlDists = ['GANJAM', 'GAJAPATI', 'KANDHAMAL', 'BOUDH'];
    const tpcodlDists = ['CUTTACK', 'PURI', 'KHURDA', 'KHORDHA', 'NAYAGARH', 'KENDRAPARA', 'JAGATSINGHPUR', 'JAJPUR', 'DHENKANAL', 'ANGUL'];

    if (tpwodlDists.some(d => dist.includes(d))) discomName = 'TPWODL';
    else if (tpsodlDists.some(d => dist.includes(d))) discomName = 'TPSODL';
    else if (tpcodlDists.some(d => dist.includes(d))) discomName = 'TPCODL';
    else discomName = 'TPNODL';

    const distPart = (specs.district || cust.District || '').trim();
    const div = cust.DivisionName || (distPart ? `CED ${distPart.toUpperCase()}` : '');
    const discomOffice = [div, discomName].filter(Boolean).join(', ');

    // Full Address
    let fullAddr = (specs.address || cust.Address || '').trim();
    if (fullAddr && !fullAddr.toUpperCase().startsWith('AT:') && !fullAddr.toUpperCase().startsWith('AT-') && !fullAddr.toUpperCase().startsWith('AT ')) {
      fullAddr = `AT: ${fullAddr}`;
    }
    const pinPart = specs.pinCode || cust.PinCode;
    if (distPart && !fullAddr.toUpperCase().includes(distPart.toUpperCase())) {
      fullAddr += `, Dist-${distPart}`;
    }
    if (pinPart && !fullAddr.includes(pinPart)) {
      fullAddr += `, ${pinPart}`;
    }

    // Applicant Name
    let name = (cust.Name || '').trim();
    if (name && !/^(mr|mrs|ms|dr|shri|smt)\b/i.test(name)) {
      name = `Mr. ${name}`;
    }

    // Capacity & Demand
    const cap = cust.ProposedCapacity || specs.inverterCapacity || '';
    const capNum = parseFloat(String(cap)) || 0;
    const capacityKwp = cap ? `${cap} Kwp` : '';
    const contractDemand = capNum ? `${Math.round(capNum)} KW` : '';
    const connectionType = specs.connectionType || (capNum > 5 ? '3 ph LT/HT' : '1ph LT');

    // App No & Date
    const appNo = cust.ApplicationNumber || cust.ConsumerNo || '';
    const rawDate = cust.LoginDate || cust.InstallationDate || specs.dateOfInstallation;
    let dateStr = '';
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = d.getFullYear();
          dateStr = `${dd}-${mm}-${yy}`;
        }
      } catch {}
    }
    const applicationNoWithDate = appNo ? (dateStr ? `${appNo} / ${dateStr}` : appNo) : '';

    // Date of installation
    const installDate = specs.dateOfInstallation 
      ? this.formatDateToDisplay(specs.dateOfInstallation) 
      : (cust.InstallationDate ? this.formatDateToDisplay(cust.InstallationDate) : '');

    // Inverter
    const invMake = (specs.inverterMake || '').trim();
    const invSerial = (specs.inverterSerialNo || '').trim();
    const invCap = specs.inverterCapacity ? `${specs.inverterCapacity} KW` : (cust.ProposedCapacity ? `${cust.ProposedCapacity} KW` : '');
    const inVolt = specs.inverterInputVoltage;
    const outVolt = specs.inverterOutputVoltage;
    const invVoltages = (inVolt || outVolt) ? `${inVolt || ''}/${outVolt || ''}` : '';

    // Modules
    const modMake = (specs.moduleMake || '').trim();
    const modType = (specs.moduleTypeModel || '').trim();
    const modCapEach = specs.moduleCapacityEach ? `${specs.moduleCapacityEach}WP` : '';
    const modCount = specs.moduleCount ? `${specs.moduleCount} NOS.` : '';
    const modTotal = specs.moduleTotalCapacity || (cust.ProposedCapacity ? `${cust.ProposedCapacity}KW` : '');

    let serialsText = '';
    if (specs.moduleSerials && specs.moduleSerials.length > 0) {
      serialsText = specs.moduleSerials.map((s: any) => s.serialNo).filter(Boolean).join('\n');
    }

    // Earthing
    const dcEarth = specs.dcEarthing ? `${specs.dcEarthing} in Ohm` : '';
    const acEarth = specs.acEarthing ? `${specs.acEarthing} in Ohm` : '';

    return {
      discomOffice,
      capacityKwp,
      inspectionLocation: fullAddr,
      headerSummary: capacityKwp ? `Work Completion and Inspection Report for ${capacityKwp} Solar Roof Top PV System(SRTPV) ${fullAddr}` : '',

      applicantName: name,
      applicationNoWithDate,
      address: fullAddr,
      consumerNo: cust.ConsumerNo || cust.ApplicationNumber || '',
      consumerCategory: 'DOMESTIC',
      connectionType,
      contractDemand,
      arrear: '0',
      vendorName: 'Shri Trutiyadev Solar Enterprises',
      installationDate: installDate,

      transformerCapacity: '',
      transformerLocation: '',
      transformerTotalRtsCapacity: '',
      transformerCapacityAdequate: 'Yes',

      proposedPlantDetails: cap ? `${cap} KW\nSINGLE SITE\nSINGLE POINT` : '',
      sldOkStatus: 'YES/NO(if it is no, state reasons for the same and suggest alternate arrangements )',

      inverterMake: invMake,
      inverterSerialNo: invSerial,
      inverterCapacity: invCap,
      inverterVoltages: invVoltages,
      inverterAntiIslanding: 'YES/NO (Need to be checked practically before charging)',

      moduleMake: modMake,
      moduleSerials: serialsText,
      moduleType: modType,
      moduleCapacityEach: modCapEach,
      moduleCount: modCount,
      moduleTotalCapacity: modTotal,

      dcEarthing: dcEarth,
      acEarthing: acEarth,
      earthingPermissibleText: `Within permissible limit or Not (Values should be certified by ${discomName} official)`,

      protectiveSystemDetails: 'AC & DC DB: Yes/No\nManual Switch at Solar Side: Yes/No\nlightening arrestor: Yes/No\nSPDs: Yes/No\nRelay operated automatic switch at net- meter side: Yes/ No',

      protectionBackFeeding: '',
      eicInspectionLetter: 'Yes/ No',
      safetyCertificate: 'Yes/No',
      actualSldDiagram: 'Yes/ No',
      testReportComponents: 'Yes/NO',

      netMeterTotal: '',
      netMeterMake: '',
      netMeterSerial: '',
      netMeterPhase: '',
      netMeterCapacity: '',
      netMeterConstant: '',

      solarMeterTotal: '',
      solarMeterMake: '',
      solarMeterSerial: '',
      solarMeterPhase: '',
      solarMeterCapacity: '',
      solarMeterConstant: '',

      otherRemarks: '',
      satisfactorySyncStatus: 'Yes/No ( if it is not satisfactory, state reasons for the same and suggest alternate arrangements required to evacuate power from the SRTPV system)',
      provisionSwitches: 'Provision of manual and automatic switches: Yes / No',
      omInfoStatus: "Whether Operation and Maintenance information:\nSuch as Do's and Don'ts are provided by the System Installer: Yes*/ No*",

      applicantSignName: name,
      applicantSignDate: '',
      installerFirmName: 'Shri Trutiyadev Solar Enterprises',
      installerAddress: 'AT-TALAMUNDALI, PO-KANKADAJODI, DIST-CUTTACK,\nPIN-754035, Odisha',
      installerSignDate: '',
      certifiedOfficerTitle: `Designated officer ${discomName}`,
      certifiedOfficerDate: ''
    };
  }

  buildDefaultForm4Data(cust: InstallmentRow | null, specs: TechnicalProductSpecs): Form4Data {
    if (!cust) {
      return {
        officerDesignation: 'The Circle solar executive/SDO/Executive Engineer (Ele),',
        officerAddress: '',
        refPmsgy: '',
        appFgNoDate: '',
        appFees: '',
        moduleModelNo: '',
        moduleTotalCapacity: '',
        moduleMake: '',
        moduleSerials: '',
        moduleCount: '',
        moduleCapacityEach: '',
        moduleInstallDate: '',
        moduleCommissionDate: '',
        inverterCount: '',
        inverterType: '',
        inverterMake: '',
        inverterModelNo: '',
        inverterCapacity: '',
        inverterSerialNo: '',
        inverterInputVolt: '',
        inverterOutputVolt: '',
        inverterInstallDate: '',
        inverterCommissionDate: '',
        dcCableMake: '',
        dcCableSize: '',
        acCableMake: '',
        acCableSize: '',
        dcdbMake: '',
        dcdbSerialNo: '',
        dcdbSpdRating: '',
        dcdbMcbDetails: '',
        acdbMake: '',
        acdbSerialNo: '',
        acdbSpdRating: '',
        acdbMcbDetails: '',
        earthResistance: '',
        earthWireSize: '',
        twoEarthingPoints: 'YES',
        lighteningArrester: 'YES',
        laSizeType: '',
        earthingNote: 'Note:* Earthing shall be done in accordance IS 3043-1986',
        netMeterCount: '',
        netMeterMake: '',
        netMeterSerial: '',
        netMeterCapacity: '',
        netMeterModel: '',
        netMeterPhase: '',
        netMeterCtPtRatio: '',
        netMeterTestDate: '',
        solarMeterCount: '',
        solarMeterMake: '',
        solarMeterSerial: '',
        solarMeterCapacity: '',
        solarMeterModel: '',
        solarMeterPhase: '',
        solarMeterCtPtRatio: '',
        solarMeterTestDate: '',
        cautionPanels: '',
        cautionInverters: '',
        cautionDcAcdb: '',
        provisionSwitches: 'Provision of manual and automatic switches: Yes / No',
        omInfoStatus: "Whether Operation and Maintenance information:\nSuch as Do's and Don'ts are provided by the System Installer: Yes* / No*.",
        complianceCert: "Certified that the above said SPV system was installed by me and the equipment used, comply with the Technical and Safety standards as specified by CEA/MNRE/IEGC/OGC/OERC and TPNODL's requirement.",
        applicantName: '',
        applicantAddress: '',
        applicantDate: '',
        installerFirm: 'Shri Trutiyadev Solar Enterprises',
        installerAddress: 'AT-Talamundali,PO- Kankadajodi, PS-Maniabandha,\nDist-Cuttack PIN-754035',
        installerDate: '',
        officerTitle: 'Circle solar executive/SDO/Executive Engineer, TPNODL',
        officerDate: ''
      };
    }

    // DISCOM determination
    const dist = (specs.district || cust.District || '').toUpperCase().trim();
    let discomName = 'TPNODL';
    const tpwodlDists = ['SAMBALPUR', 'BARGARH', 'JHARSUGUDA', 'DEOGARH', 'SUNDARGARH', 'BOLANGIR', 'SONEPUR', 'KALAHANDI', 'NUAPADA', 'KORAPUT', 'NABARANGPUR', 'MALKANGIRI', 'RAYAGADA'];
    const tpsodlDists = ['GANJAM', 'GAJAPATI', 'KANDHAMAL', 'BOUDH'];
    const tpcodlDists = ['CUTTACK', 'PURI', 'KHURDA', 'KHORDHA', 'NAYAGARH', 'KENDRAPARA', 'JAGATSINGHPUR', 'JAJPUR', 'DHENKANAL', 'ANGUL'];

    if (tpwodlDists.some(d => dist.includes(d))) discomName = 'TPWODL';
    else if (tpsodlDists.some(d => dist.includes(d))) discomName = 'TPSODL';
    else if (tpcodlDists.some(d => dist.includes(d))) discomName = 'TPCODL';
    else discomName = 'TPNODL';

    const distPart = (specs.district || cust.District || '').trim();
    const div = cust.DivisionName || (distPart ? `CED ${distPart.toUpperCase()}` : '');
    const subDiv = cust.SubDivision ? `${cust.SubDivision} Subdivision` : '';
    const officerAddrParts = [subDiv, div, distPart ? distPart.toUpperCase() : '', discomName].filter(Boolean);
    const officerAddress = officerAddrParts.join(', ');

    // App No & Registration Ref
    const appNo = cust.ApplicationNumber || cust.ConsumerNo || '';
    const rawDate = cust.LoginDate || cust.InstallationDate || specs.dateOfInstallation;
    let dateStr = '';
    let installDateStr = '';
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = d.getFullYear();
          dateStr = `${dd}-${mm}-${yy}`;
          installDateStr = `${dd}-${mm}-${yy}`;
        }
      } catch {}
    }
    const refPmsgy = appNo ? (dateStr ? `Your PMSGY REG. N0.- ${appNo}/${dateStr}` : `Your PMSGY REG. N0.- ${appNo}`) : '';
    const appFgNoDate = appNo ? (installDateStr ? `${appNo}/${installDateStr}` : appNo) : '';

    // Dates
    const installDate = specs.dateOfInstallation 
      ? this.formatDateToDisplay(specs.dateOfInstallation) 
      : (cust.InstallationDate ? this.formatDateToDisplay(cust.InstallationDate) : '');
    const commissionDate = specs.dateOfCommission 
      ? this.formatDateToDisplay(specs.dateOfCommission) 
      : (cust.CommissioningDate ? this.formatDateToDisplay(cust.CommissioningDate) : '');

    // Modules
    const cap = cust.ProposedCapacity || specs.inverterCapacity || '';
    const modTotal = specs.moduleTotalCapacity ? specs.moduleTotalCapacity.trim() : (cap ? `${cap} KWP` : '');
    const modMake = (specs.moduleMake || '').trim();
    const modModel = (specs.moduleTypeModel || '').trim();
    const modCount = specs.moduleCount ? `${specs.moduleCount} Nos` : '';
    const modCapEach = specs.moduleCapacityEach ? `${specs.moduleCapacityEach} Wp` : '';

    let serialsText = '';
    if (specs.moduleSerials && specs.moduleSerials.length > 0) {
      serialsText = specs.moduleSerials.map((s: any) => s.serialNo).filter(Boolean).join('\n');
    }

    // Inverter
    const invMake = (specs.inverterMake || '').trim();
    const invModel = (specs.inverterModelNo || (specs.inverterName && specs.inverterName !== 'GRID-TIED' ? specs.inverterName : '') || '').trim();
    const invSerial = (specs.inverterSerialNo || '').trim();
    const invCount = specs.inverterCount ? `${specs.inverterCount} Nos` : (invMake || invModel || invSerial ? '1 Nos' : '');
    const invType = specs.inverterName ? specs.inverterName : (invMake || invModel || invSerial ? 'Grid Tied' : '');
    const invCap = specs.inverterCapacity ? `${specs.inverterCapacity} KW` : (cap ? `${cap} KW` : '');
    const invInputVolt = specs.inverterInputVoltage ? `${specs.inverterInputVoltage}V DC` : '';
    const invOutputVolt = specs.inverterOutputVoltage ? `${specs.inverterOutputVoltage}V AC` : '';

    // Cables & Protection
    const dcCable = (specs.dcCableMake || '').trim();
    const dcSize = specs.dcCableSizeType ? `${specs.dcCableSizeType} SQ MM` : '';
    const acCable = ((specs as any).acCableMake || '').trim();
    const acSize = (specs as any).acCableSizeType ? `${(specs as any).acCableSizeType} SQ MM` : '';
    const dcdb = (specs.dcdbMake || '').trim();
    const dcdbMcb = specs.dcdbMcbDetails ? `${specs.dcdbMcbDetails}AMP` : '';
    const acdb = (specs.acdbMake || '').trim();
    const acdbMcb = specs.acdbMcbDetails ? `${specs.acdbMcbDetails}AMP` : '';

    // Earthing
    const earthRes = specs.earthResistance ? `${specs.earthResistance} OHM` : '';
    const earthWire = specs.earthWireSize ? `${specs.earthWireSize} SQ MM Aluminum` : '';
    const laType = (specs.laSizeType || '').trim();

    // Applicant Name & Address
    let name = (cust.Name || '').trim();
    if (name && !/^(mr|mrs|ms|dr|shri|smt)\b/i.test(name)) {
      name = `MR ${name.toUpperCase()}`;
    }
    let addr = (specs.address || cust.Address || '').trim();
    if (addr && !addr.toUpperCase().startsWith('AT:') && !addr.toUpperCase().startsWith('AT-')) {
      addr = `AT: ${addr}`;
    }
    const pin = specs.pinCode || cust.PinCode || '';
    const addrParts = [addr, distPart ? `Dist-${distPart.toUpperCase()}` : '', pin ? `PIN-${pin}` : ''].filter(Boolean);
    const applicantAddress = addrParts.join('\n');

    return {
      officerDesignation: 'The Circle solar executive/SDO/Executive Engineer (Ele),',
      officerAddress,
      refPmsgy,
      appFgNoDate,
      appFees: '',
      moduleModelNo: modModel,
      moduleTotalCapacity: modTotal,
      moduleMake: modMake,
      moduleSerials: serialsText,
      moduleCount: modCount,
      moduleCapacityEach: modCapEach,
      moduleInstallDate: installDate,
      moduleCommissionDate: commissionDate,
      inverterCount: invCount,
      inverterType: invType,
      inverterMake: invMake,
      inverterModelNo: invModel,
      inverterCapacity: invCap,
      inverterSerialNo: invSerial,
      inverterInputVolt: invInputVolt,
      inverterOutputVolt: invOutputVolt,
      inverterInstallDate: installDate,
      inverterCommissionDate: commissionDate,
      dcCableMake: dcCable,
      dcCableSize: dcSize,
      acCableMake: acCable,
      acCableSize: acSize,
      dcdbMake: dcdb,
      dcdbSerialNo: specs.dcdbSerialNo || '',
      dcdbSpdRating: specs.dcdbSpdRating || '',
      dcdbMcbDetails: dcdbMcb,
      acdbMake: acdb,
      acdbSerialNo: specs.acdbSerialNo || '',
      acdbSpdRating: specs.acdbSpdRating || '',
      acdbMcbDetails: acdbMcb,
      earthResistance: earthRes,
      earthWireSize: earthWire,
      twoEarthingPoints: 'YES',
      lighteningArrester: 'YES',
      laSizeType: laType,
      earthingNote: 'Note:* Earthing shall be done in accordance IS 3043-1986',
      netMeterCount: '',
      netMeterMake: '',
      netMeterSerial: '',
      netMeterCapacity: '',
      netMeterModel: '',
      netMeterPhase: '',
      netMeterCtPtRatio: '',
      netMeterTestDate: '',
      solarMeterCount: '',
      solarMeterMake: '',
      solarMeterSerial: '',
      solarMeterCapacity: '',
      solarMeterModel: '',
      solarMeterPhase: '',
      solarMeterCtPtRatio: '',
      solarMeterTestDate: '',
      cautionPanels: '',
      cautionInverters: '',
      cautionDcAcdb: '',
      provisionSwitches: 'Provision of manual and automatic switches: Yes / No',
      omInfoStatus: "Whether Operation and Maintenance information:\nSuch as Do's and Don'ts are provided by the System Installer: Yes* / No*.",
      complianceCert: `Certified that the above said SPV system was installed by me and the equipment used, comply with the Technical and Safety standards as specified by CEA/MNRE/IEGC/OGC/OERC and ${discomName}’s requirement.`,
      applicantName: name,
      applicantAddress,
      applicantDate: '',
      installerFirm: 'Shri Trutiyadev Solar Enterprises',
      installerAddress: 'AT-Talamundali,PO- Kankadajodi, PS-Maniabandha,\nDist-Cuttack PIN-754035',
      installerDate: '',
      officerTitle: `Circle solar executive/SDO/Executive Engineer, ${discomName}`,
      officerDate: ''
    };
  }

  setPreviewMeterProc(choice: 'Beneficiary' | 'DISCOM'): void {
    this.form1Data.update(d => ({ ...d, meterProcChoice: choice }));
  }

  downloadForm1Pdf(options?: { useLivePreviewValues?: boolean }): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }

    try {
      let d = { ...this.form1Data() };

      if (options?.useLivePreviewValues) {
        const getText = (id: string, fallback: string = '') => {
          const el = document.getElementById(id);
          if (!el) return fallback;
          return (el.innerText || el.textContent || '').trim();
        };

        const rawDiscom = getText('f1PrevDiscom', d.discomOffice);
        d.discomOffice = rawDiscom.replace(/,\s*$/, '').trim();
        d.displayDate = getText('f1PrevDate', d.displayDate);
        d.applicantName = getText('f1PrevName', d.applicantName);
        d.address = getText('f1PrevAddress', d.address);
        d.consumerNo = getText('f1PrevConsumerNo', d.consumerNo);
        d.mobile = getText('f1PrevMobile', d.mobile);
        d.email = getText('f1PrevEmail', d.email);
        d.reTypeCapacity = getText('f1PrevReType', d.reTypeCapacity);
        d.sanctionLoad = getText('f1PrevSanctionLoad', d.sanctionLoad);
        d.location = getText('f1PrevLocation', d.location);
        d.inverterMakeType = getText('f1PrevInverterMake', d.inverterMakeType);
        d.inverterAutoIso = getText('f1PrevAutoIso', d.inverterAutoIso);
        d.existingPlants = getText('f1PrevExistingPlants', d.existingPlants);
        d.existingCapacity = getText('f1PrevExistingCapacity', d.existingCapacity);
        d.commissionDays = getText('f1PrevCommissionDays', d.commissionDays);
        d.category = getText('f1PrevCategory', d.category);
        d.voltageLevel = getText('f1PrevVoltage', d.voltageLevel);
        d.declarationText = getText('f1PrevDeclaration', d.declarationText);
        d.signApplicant = getText('f1PrevSign', d.signApplicant || d.applicantName);
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = 210;
      const marginX = 14;
      const tableWidth = 182;
      const col1Width = 12;
      const col2Width = 100;
      const col3Width = 70;

      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);

      let curY = 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Form - 1', pageWidth / 2, curY, { align: 'center' });
      curY += 5;

      doc.setFontSize(9.5);
      doc.text('Application form - Net Metering/Bi-directional/Gross Metering Connection', pageWidth / 2, curY, { align: 'center' });
      curY += 7;

      doc.setFontSize(8.5);
      doc.text('To,', marginX, curY); curY += 4.2;
      const discomStr = d.discomOffice ? (d.discomOffice.endsWith(',') ? d.discomOffice : `${d.discomOffice},`) : 'The Designated Officer TPNODL,';
      doc.text(discomStr, marginX, curY); curY += 4.2;
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${d.displayDate || ''}`, marginX, curY); curY += 5;

      const preamble = 'I/we intend to connect Renewable Energy System through net-metering/ bi-directional/ Gross metering arrangement in compliance to order dated 19.08.2016 or OERC on Net Metering/bi-directional metering and their connectivity with respect to Solar PV projects as amended on 05.05.2022 and subsequent amendments from time to time. The details are given below:';
      const preLines = doc.splitTextToSize(preamble, tableWidth);
      doc.setFontSize(8.2);
      doc.text(preLines, marginX, curY);
      curY += (preLines.length * 3.8) + 2.5;

      const drawTableRow = (y: number, slText: string, labelText: string, valText: string, opt: any = {}) => {
        const fontSize = opt.fontSize || 8.2;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

        const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
        const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);
        const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
        const lineHeight = opt.lineHeight || 3.9;
        const padding = 2.0;
        const rowHeight = Math.max(opt.minHeight || 5.2, maxLines * lineHeight + padding);

        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
        doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

        if (slText) {
          doc.text(String(slText), marginX + (col1Width / 2), y + 3.8, { align: 'center' });
        }
        doc.text(col2Lines, marginX + col1Width + 2, y + 3.8);
        doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 3.8);

        return rowHeight;
      };

      const rows: [string, string, string][] = [
        ['1.', 'Name of the Registered applicant/consumer', d.applicantName || ''],
        ['2.', 'Address of the Registered applicant/consumer', d.address || ''],
        ['3.', 'Consumer No.', d.consumerNo || ''],
        ['4.', 'Telephone number(s) of Consumer/Applicant (Mobile No.)', d.mobile || ''],
        ['5.', 'Email ID of Consumer/Applicant', d.email || ''],
        ['6.', 'Type of RE (Solar/Wind) & Capacity of RE system (Watts)', d.reTypeCapacity || ''],
        ['7.', 'Sanction load as per latest electricity bill (kW)', d.sanctionLoad || ''],
        ['8.', 'Meter procurement by (Please Tick)', d.meterProcChoice || 'DISCOM'],
        ['9.', 'Location of proposed RE system (RTS system/Ground mounted system)', d.location || ''],
        ['10.', 'Solar PV Project inverter make and type', d.inverterMakeType || ''],
        ['11.', 'Solar PV Project inverter has automatic isolation protection (Y/N)?', d.inverterAutoIso || 'Yes'],
        ['12.', 'Are there any existing Solar or Renewable Energy plants currently installed? (Y/N)', d.existingPlants || 'No'],
        ['13.', 'Capacity of existing Solar/RE plant.', d.existingCapacity || '0'],
        ['14', 'Expected date of commissioning of solar PV Project.', d.commissionDays || '30 Days'],
        ['15', 'Category of consumer (Domestic/ Industrial/ Commercial/ Govt. establishment etc.)', d.category || 'Domestic'],
        ['16', 'Supply voltage level of RE system proposed to be connected [230 V (1-phase)/ 415 V (3- phase/11 kV & above (3–phase)]', d.voltageLevel || '230 V']
      ];

      rows.forEach(r => {
        if (r[0] === '8.') {
          const rowHeight = 10.5;
          doc.setLineWidth(0.2);
          doc.rect(marginX, curY, tableWidth, rowHeight);
          doc.line(marginX + col1Width, curY, marginX + col1Width, curY + rowHeight);
          doc.line(marginX + col1Width + col2Width, curY, marginX + col1Width + col2Width, curY + rowHeight);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.text('8.', marginX + (col1Width / 2), curY + 3.8, { align: 'center' });
          doc.text('Meter procurement by', marginX + col1Width + 2, curY + 3.8);
          doc.text('(Please Tick)', marginX + col1Width + 2, curY + 7.8);

          doc.setFont('helvetica', 'bold');
          const c3x = marginX + col1Width + col2Width + 3;

          // Beneficiary row
          doc.text('Beneficiary', c3x, curY + 3.8);
          const box1X = c3x + 24;
          const box1Y = curY + 1.2;
          doc.rect(box1X, box1Y, 3.2, 3.2);
          if (d.meterProcChoice === 'Beneficiary') {
            doc.setLineWidth(0.4);
            doc.line(box1X + 0.6, box1Y + 1.6, box1X + 1.3, box1Y + 2.5);
            doc.line(box1X + 1.3, box1Y + 2.5, box1X + 2.6, box1Y + 0.7);
            doc.setLineWidth(0.2);
          }

          // DISCOM row
          doc.text('DISCOM', c3x, curY + 8.0);
          const box2X = c3x + 24;
          const box2Y = curY + 5.4;
          doc.rect(box2X, box2Y, 3.2, 3.2);
          if (d.meterProcChoice !== 'Beneficiary') {
            doc.setLineWidth(0.4);
            doc.line(box2X + 0.6, box2Y + 1.6, box2X + 1.3, box2Y + 2.5);
            doc.line(box2X + 1.3, box2Y + 2.5, box2X + 2.6, box2Y + 0.7);
            doc.setLineWidth(0.2);
          }

          doc.setFont('helvetica', 'normal');
          curY += rowHeight;
        } else {
          const h = drawTableRow(curY, r[0], r[1], r[2]);
          curY += h;
        }
      });

      curY += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.text('DECLARATION', marginX, curY); curY += 4.2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const decLines = doc.splitTextToSize(d.declarationText, tableWidth);
      doc.text(decLines, marginX, curY);
      curY += (decLines.length * 3.6) + 14;

      const signX = marginX + tableWidth - 80;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('Signature with Name of the applicant /consumer:', signX, curY); curY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.text(d.signApplicant || d.applicantName || '', signX, curY);

      const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanConsumerNo = (d.consumerNo || 'Form1').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Form_1_${cleanName}_${cleanConsumerNo}.pdf`;

      doc.save(fileName);
      this.toastService.success(`Form 1 PDF (${fileName}) downloaded successfully!`);
    } catch (err: any) {
      console.error('Error generating Form 1 PDF:', err);
      this.toastService.error(`Error generating Form 1 PDF: ${err?.message || err}`);
    }
  }

  downloadForm3Pdf(options?: { useLivePreviewValues?: boolean }): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }

    try {
      let d = { ...this.form3Data() };

      if (options?.useLivePreviewValues) {
        const getText = (id: string, fallback: string = '') => {
          const el = document.getElementById(id);
          if (!el) return fallback;
          return (el.innerText || el.textContent || '').trim();
        };

        d.discomOffice = getText('f3PrevDiscomOffice', d.discomOffice);
        d.capacityKwp = getText('f3PrevCapacityKwp', d.capacityKwp);
        d.inspectionLocation = getText('f3PrevInspectionLoc', d.inspectionLocation);
        d.headerSummary = getText('f3PrevHeaderSummary', d.headerSummary);

        // Section A
        d.applicantName = getText('f3PrevAppName', d.applicantName);
        d.applicationNoWithDate = getText('f3PrevAppNoDate', d.applicationNoWithDate);
        d.address = getText('f3PrevAddress', d.address);
        d.consumerNo = getText('f3PrevConsumerNo', d.consumerNo);
        d.consumerCategory = getText('f3PrevCategory', d.consumerCategory);
        d.connectionType = getText('f3PrevConnType', d.connectionType);
        d.contractDemand = getText('f3PrevContractDemand', d.contractDemand);
        d.arrear = getText('f3PrevArrear', d.arrear);
        d.vendorName = getText('f3PrevVendorName', d.vendorName);
        d.installationDate = getText('f3PrevInstallDate', d.installationDate);

        // Section B
        d.transformerCapacity = getText('f3PrevTrCap', d.transformerCapacity);
        d.transformerLocation = getText('f3PrevTrLoc', d.transformerLocation);
        d.transformerTotalRtsCapacity = getText('f3PrevTrTotalRts', d.transformerTotalRtsCapacity);
        d.transformerCapacityAdequate = getText('f3PrevTrAdequate', d.transformerCapacityAdequate);

        // Section C
        d.proposedPlantDetails = getText('f3PrevProposedDetails', d.proposedPlantDetails);
        d.sldOkStatus = getText('f3PrevSldOk', d.sldOkStatus);

        // Section D
        d.inverterMake = getText('f3PrevInvMake', d.inverterMake);
        d.inverterSerialNo = getText('f3PrevInvSerial', d.inverterSerialNo);
        d.inverterCapacity = getText('f3PrevInvCap', d.inverterCapacity);
        d.inverterVoltages = getText('f3PrevInvVolt', d.inverterVoltages);
        d.inverterAntiIslanding = getText('f3PrevInvAntiIsland', d.inverterAntiIslanding);

        // Section E
        d.moduleMake = getText('f3PrevModMake', d.moduleMake);
        d.moduleSerials = getText('f3PrevModSerials', d.moduleSerials);
        d.moduleType = getText('f3PrevModType', d.moduleType);
        d.moduleCapacityEach = getText('f3PrevModCapEach', d.moduleCapacityEach);
        d.moduleCount = getText('f3PrevModCount', d.moduleCount);
        d.moduleTotalCapacity = getText('f3PrevModTotal', d.moduleTotalCapacity);

        // Section F
        d.dcEarthing = getText('f3PrevDcEarth', d.dcEarthing);
        d.acEarthing = getText('f3PrevAcEarth', d.acEarthing);
        d.earthingPermissibleText = getText('f3PrevEarthPermissible', d.earthingPermissibleText);

        // Section G
        d.protectiveSystemDetails = getText('f3PrevProtSys', d.protectiveSystemDetails);

        // Section H - L
        d.protectionBackFeeding = getText('f3PrevBackFeed', d.protectionBackFeeding);
        d.eicInspectionLetter = getText('f3PrevEic', d.eicInspectionLetter);
        d.safetyCertificate = getText('f3PrevSafetyCert', d.safetyCertificate);
        d.actualSldDiagram = getText('f3PrevActualSld', d.actualSldDiagram);
        d.testReportComponents = getText('f3PrevTestReport', d.testReportComponents);

        // Section M
        d.netMeterTotal = getText('f3PrevNmTotal', d.netMeterTotal);
        d.netMeterMake = getText('f3PrevNmMake', d.netMeterMake);
        d.netMeterSerial = getText('f3PrevNmSerial', d.netMeterSerial);
        d.netMeterPhase = getText('f3PrevNmPhase', d.netMeterPhase);
        d.netMeterCapacity = getText('f3PrevNmCap', d.netMeterCapacity);
        d.netMeterConstant = getText('f3PrevNmConst', d.netMeterConstant);

        d.solarMeterTotal = getText('f3PrevSmTotal', d.solarMeterTotal);
        d.solarMeterMake = getText('f3PrevSmMake', d.solarMeterMake);
        d.solarMeterSerial = getText('f3PrevSmSerial', d.solarMeterSerial);
        d.solarMeterPhase = getText('f3PrevSmPhase', d.solarMeterPhase);
        d.solarMeterCapacity = getText('f3PrevSmCap', d.solarMeterCapacity);
        d.solarMeterConstant = getText('f3PrevSmConst', d.solarMeterConstant);

        // Section N & Inspection Report
        d.otherRemarks = getText('f3PrevRemarks', d.otherRemarks);
        d.satisfactorySyncStatus = getText('f3PrevSyncStatus', d.satisfactorySyncStatus);
        d.provisionSwitches = getText('f3PrevSwitches', d.provisionSwitches);
        d.omInfoStatus = getText('f3PrevOmInfo', d.omInfoStatus);

        // Signatures
        d.applicantSignName = getText('f3PrevSignAppName', d.applicantSignName);
        d.applicantSignDate = getText('f3PrevSignAppDate', d.applicantSignDate);
        d.installerFirmName = getText('f3PrevSignInstFirm', d.installerFirmName);
        d.installerAddress = getText('f3PrevSignInstAddr', d.installerAddress);
        d.installerSignDate = getText('f3PrevSignInstDate', d.installerSignDate);
        d.certifiedOfficerTitle = getText('f3PrevSignOffTitle', d.certifiedOfficerTitle);
        d.certifiedOfficerDate = getText('f3PrevSignOffDate', d.certifiedOfficerDate);
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const marginX = 14;
      const tableWidth = 182;
      const col1Width = 12;
      const col2Width = 100;
      const col3Width = 70;

      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);

      const drawTableRow = (y: number, slText: string, labelText: string, valText: string, opt: any = {}) => {
        const fontSize = opt.fontSize || 8.0;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

        const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
        const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);
        const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
        const lineHeight = opt.lineHeight || 3.7;
        const padding = 2.0;
        const rowHeight = Math.max(opt.minHeight || 5.0, maxLines * lineHeight + padding);

        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
        doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

        if (slText) {
          doc.text(String(slText), marginX + (col1Width / 2), y + 3.6, { align: 'center' });
        }
        doc.text(col2Lines, marginX + col1Width + 2, y + 3.6);
        doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 3.6);

        return rowHeight;
      };

      const drawSectionHeader = (y: number, slText: string, sectionTitle: string) => {
        const rowHeight = 5.2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
        doc.text(slText, marginX + (col1Width / 2), y + 3.7, { align: 'center' });
        doc.text(sectionTitle, marginX + col1Width + 2, y + 3.7);
        return rowHeight;
      };

      const drawTableHeaderRow = (y: number) => {
        const rowHeight = 5.4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
        doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);
        doc.text('Sl. No.', marginX + (col1Width / 2), y + 3.8, { align: 'center' });
        doc.text('Parameter', marginX + col1Width + 2, y + 3.8);
        doc.text('Utility Observation', marginX + col1Width + col2Width + 2, y + 3.8);
        return rowHeight;
      };

      // ══════════════════════════════════════════════════════════
      // PAGE 1
      // ══════════════════════════════════════════════════════════
      let curY = 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('FORM- 3 : Work completion and Inspection Report', pageWidth / 2, curY, { align: 'center' });
      curY += 4.8;

      doc.setFontSize(10);
      doc.text('TP NORTHERN ODISHA DISTRIBUTION LIMITED', pageWidth / 2, curY, { align: 'center' });
      curY += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      const certStatement = `Certified that I Designated officer, ${d.discomOffice} along MRT have personally inspected the ${d.capacityKwp} SRTPV system ${d.inspectionLocation} the details of SRTPV system and inspection report are as below:`;
      const certLines = doc.splitTextToSize(certStatement, tableWidth);
      doc.text(certLines, marginX, curY);
      curY += (certLines.length * 3.4) + 2.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      const summaryLines = doc.splitTextToSize(d.headerSummary, tableWidth);
      doc.text(summaryLines, marginX, curY);
      curY += (summaryLines.length * 3.6) + 2.5;

      // Page 1 Table
      curY += drawTableHeaderRow(curY);

      // Section A
      curY += drawSectionHeader(curY, 'A', 'Applicant Details');
      curY += drawTableRow(curY, '1', 'Name of the Applicant', d.applicantName);
      curY += drawTableRow(curY, '2', 'Application No./Registration No. with Date', d.applicationNoWithDate);
      curY += drawTableRow(curY, '2', 'Address', d.address);
      curY += drawTableRow(curY, '3', 'Consumer Number', d.consumerNo);
      curY += drawTableRow(curY, '4', 'Consumer Category', d.consumerCategory);
      curY += drawTableRow(curY, '5', 'Type of Connection: 1ph LT or 3 ph LT/HT', d.connectionType);
      curY += drawTableRow(curY, '6', 'contract demand of consumer', d.contractDemand);
      curY += drawTableRow(curY, '7', 'Arrear, if any', d.arrear);
      curY += drawTableRow(curY, '8', 'Name of Developer/Vendor', d.vendorName);
      curY += drawTableRow(curY, '9', 'Date of Installation', d.installationDate);

      // Section B
      curY += drawSectionHeader(curY, 'B', 'Distribution Transformer Details');
      curY += drawTableRow(curY, '1', 'Capacity in KVA', d.transformerCapacity);
      curY += drawTableRow(curY, '2', 'Location', d.transformerLocation);
      curY += drawTableRow(curY, '3', 'Total Capacity of rooftop solar photovoltaic systems already connected to the Distribution Transformer in kWp (individual capacity may be mentioned)', d.transformerTotalRtsCapacity);
      curY += drawTableRow(curY, '4', 'Whether the transformer capacity is adequate to deliver the proposed Solar rooftop PV system in addition to existing SRTPV systems', d.transformerCapacityAdequate);

      // Section C
      curY += drawSectionHeader(curY, 'C', 'Solar Rooftop PV Power Plant Details');
      curY += drawTableRow(curY, '1', 'Details of proposed power plant\nCapacity of the SPV Power Plant (kWp)\nPlant proposed at single site/multiple sites\nInterconnection with the electricity network at single point or multiple point', d.proposedPlantDetails);
      curY += drawTableRow(curY, '2', 'Whether the Single Line Diagram of the SRTPV System (Submitted by the consumer indicating all the Safety aspects of Grid Connectivity) is OK for grid Connectivity', d.sldOkStatus);

      // Section D
      curY += drawSectionHeader(curY, 'D', 'Grid Tied Inverter');
      curY += drawTableRow(curY, '1', 'Make', d.inverterMake);
      curY += drawTableRow(curY, '2', 'Serial No.', d.inverterSerialNo);
      curY += drawTableRow(curY, '3', 'Capacity', d.inverterCapacity);
      curY += drawTableRow(curY, '4', 'Input Voltage/ Output Voltage', d.inverterVoltages);
      curY += drawTableRow(curY, '5', 'Whether Anti-islanding feature is in working condition', d.inverterAntiIslanding);

      // Page 1 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 1 of 3', pageWidth - marginX, 288, { align: 'right' });

      // ══════════════════════════════════════════════════════════
      // PAGE 2
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      curY = 12;

      curY += drawTableHeaderRow(curY);

      // Section E
      curY += drawSectionHeader(curY, 'E', 'P.V Module');
      curY += drawTableRow(curY, '1', 'Make', d.moduleMake);
      curY += drawTableRow(curY, '2', 'Serial No.', d.moduleSerials);
      curY += drawTableRow(curY, '3', 'Type of Module', d.moduleType);
      curY += drawTableRow(curY, '4', 'Capacity of each Module', d.moduleCapacityEach);
      curY += drawTableRow(curY, '5', 'No. of Module', d.moduleCount);
      curY += drawTableRow(curY, '6', 'Total capacity of PV array', d.moduleTotalCapacity);

      // Section F
      const fObsText = `${d.dcEarthing}\n${d.acEarthing}\n${d.earthingPermissibleText}`;
      curY += drawTableRow(curY, 'F', 'Earthing Verification (i)D.C Earthing (ii)A.C Earthing', fObsText, { isBold: false });

      // Section G
      curY += drawTableRow(curY, 'G', 'Details of protective system available', d.protectiveSystemDetails);

      // Section H to L
      curY += drawTableRow(curY, 'H', 'Details of protection system provided to prevent back feeding from DG/ Battery/Inverter any other', d.protectionBackFeeding);
      curY += drawTableRow(curY, 'I', 'EIC inspection and approval letter Submitted by the consumer above 50KVA', d.eicInspectionLetter);
      curY += drawTableRow(curY, 'J', 'Safety certificate from designated Safety officer of TPNODL below 50KVA', d.safetyCertificate);
      curY += drawTableRow(curY, 'K', 'Actual Single line wiring diagram of the SPV System.', d.actualSldDiagram);
      curY += drawTableRow(curY, 'L', 'Test report of all component of SRTPV system (including inverter) is as per CEA/OERC regulation and IS/ BIS standards', d.testReportComponents);

      // Section M: Meter Details (4 columns)
      const mCol1W = 12;
      const mCol2W = 70;
      const mCol3W = 50;
      const mCol4W = 50;

      const drawMeterRow = (y: number, sl: string, param: string, netVal: string, solarVal: string, isHead: boolean = false) => {
        doc.setFont('helvetica', isHead ? 'bold' : 'normal');
        doc.setFontSize(7.8);
        const pLines = doc.splitTextToSize(param || '', mCol2W - 4);
        const nLines = doc.splitTextToSize(netVal || '', mCol3W - 4);
        const sLines = doc.splitTextToSize(solarVal || '', mCol4W - 4);
        const maxL = Math.max(pLines.length, nLines.length, sLines.length, 1);
        const rH = Math.max(5.0, maxL * 3.6 + 1.8);

        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rH);
        doc.line(marginX + mCol1W, y, marginX + mCol1W, y + rH);
        doc.line(marginX + mCol1W + mCol2W, y, marginX + mCol1W + mCol2W, y + rH);
        doc.line(marginX + mCol1W + mCol2W + mCol3W, y, marginX + mCol1W + mCol2W + mCol3W, y + rH);

        doc.text(sl, marginX + (mCol1W / 2), y + 3.6, { align: 'center' });
        doc.text(pLines, marginX + mCol1W + 2, y + 3.6);
        doc.text(nLines, marginX + mCol1W + mCol2W + 2, y + 3.6);
        doc.text(sLines, marginX + mCol1W + mCol2W + mCol3W + 2, y + 3.6);
        return rH;
      };

      curY += drawMeterRow(curY, 'M', 'Meter Details', 'Net Meter (Bi-directional\nMeter)', 'Solar Generation Meter\n(Details of all Solar meters)', true);
      curY += drawMeterRow(curY, '1', 'Total Nos. of Meters', d.netMeterTotal, d.solarMeterTotal);
      curY += drawMeterRow(curY, '2', 'Meter Make', d.netMeterMake, d.solarMeterMake);
      curY += drawMeterRow(curY, '3', 'Meter Sl. No.', d.netMeterSerial, d.solarMeterSerial);
      curY += drawMeterRow(curY, '4', '1 Ph/ 3Ph', d.netMeterPhase, d.solarMeterPhase);
      curY += drawMeterRow(curY, '5', 'Capacity', d.netMeterCapacity, d.solarMeterCapacity);
      curY += drawMeterRow(curY, '6', 'Meter Constant', d.netMeterConstant, d.solarMeterConstant);

      // Page 2 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 2 of 3', pageWidth - marginX, 288, { align: 'right' });

      // ══════════════════════════════════════════════════════════
      // PAGE 3
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      curY = 12;

      // Section N
      curY += drawTableRow(curY, 'N', 'Any other necessary details with Remarks', d.otherRemarks);

      // Inspection Report
      const inspHeadH = 5.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.rect(marginX, curY, tableWidth, inspHeadH);
      doc.text('Inspection Report', pageWidth / 2, curY + 3.7, { align: 'center' });
      curY += inspHeadH;

      curY += drawTableRow(curY, '', 'Whether this installed SRTPV system is satisfactory for grid connectivity/ Synchronization', d.satisfactorySyncStatus);

      curY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.text(d.provisionSwitches, marginX, curY); curY += 4.5;

      const omLines = doc.splitTextToSize(d.omInfoStatus, tableWidth);
      doc.text(omLines, marginX, curY);
      curY += (omLines.length * 4.0) + 18;

      // Signatures
      const sigStartY = curY;
      const leftColX = marginX;
      const rightColX = marginX + 95;

      // Left: Applicant
      doc.setFont('helvetica', 'bold');
      doc.text('Signature of the Applicant', leftColX, sigStartY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${d.applicantSignName}`, leftColX, sigStartY + 4.5);
      doc.text(`Date: ${d.applicantSignDate}`, leftColX, sigStartY + 9.0);

      // Right: Installer
      doc.setFont('helvetica', 'bold');
      doc.text('Name and Signature of the System Installer with Seal', rightColX, sigStartY);
      doc.setFont('helvetica', 'normal');
      doc.text('Name of the firm and address:', rightColX, sigStartY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text(d.installerFirmName, rightColX, sigStartY + 9.0);
      doc.setFont('helvetica', 'normal');
      const instAddrLines = doc.splitTextToSize(d.installerAddress, 85);
      doc.text(instAddrLines, rightColX, sigStartY + 13.5);
      const afterInstY = sigStartY + 13.5 + (instAddrLines.length * 4.0);
      doc.text(`Date: ${d.installerSignDate}`, rightColX, afterInstY);

      // Certified by
      const certByY = Math.max(sigStartY + 26, afterInstY + 8);
      doc.setFont('helvetica', 'bold');
      doc.text('Certified by', leftColX, certByY);
      doc.text(d.certifiedOfficerTitle, leftColX, certByY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${d.certifiedOfficerDate}`, leftColX, certByY + 9.0);

      // Enclosures
      const encY = certByY + 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('Enclosures:', leftColX, encY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      let eY = encY + 4.5;
      doc.text('Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.', leftColX, eY); eY += 4.0;
      doc.text('Data sheets/Drawing for the array mounting System.', leftColX, eY); eY += 4.0;
      doc.text('Actual Single line wiring diagram of the SPV System.', leftColX, eY); eY += 4.0;
      doc.text('Copy of Maintenance & Operation information provided by the System Installer.', leftColX, eY);

      // Page 3 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 3 of 3', pageWidth - marginX, 288, { align: 'right' });

      // Save PDF
      const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanConsumerNo = (d.consumerNo || 'Form3').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Form_3_Inspection_${cleanName}_${cleanConsumerNo}.pdf`;

      doc.save(fileName);
      this.toastService.success(`Form 3 PDF (${fileName}) downloaded successfully!`);
    } catch (err: any) {
      console.error('Error generating Form 3 PDF:', err);
      this.toastService.error(`Error generating Form 3 PDF: ${err?.message || err}`);
    }
  }

  downloadForm4Pdf(options?: { useLivePreviewValues?: boolean }): void {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }

    try {
      let d = { ...this.form4Data() };

      if (options?.useLivePreviewValues) {
        const getText = (id: string, fallback: string = '') => {
          const el = document.getElementById(id);
          if (!el) return fallback;
          return (el.innerText || el.textContent || '').trim();
        };

        d.officerDesignation = getText('f4PrevOffDesig', d.officerDesignation);
        d.officerAddress = getText('f4PrevOffAddr', d.officerAddress);
        d.refPmsgy = getText('f4PrevRefPmsgy', d.refPmsgy);

        // Section A
        d.appFgNoDate = getText('f4PrevAppFgNo', d.appFgNoDate);
        d.appFees = getText('f4PrevAppFees', d.appFees);

        // Section B
        d.moduleModelNo = getText('f4PrevModModel', d.moduleModelNo);
        d.moduleTotalCapacity = getText('f4PrevModTotalCap', d.moduleTotalCapacity);
        d.moduleMake = getText('f4PrevModMake', d.moduleMake);
        d.moduleSerials = getText('f4PrevModSerials', d.moduleSerials);
        d.moduleCount = getText('f4PrevModCount', d.moduleCount);
        d.moduleCapacityEach = getText('f4PrevModCapEach', d.moduleCapacityEach);
        d.moduleInstallDate = getText('f4PrevModInstDate', d.moduleInstallDate);
        d.moduleCommissionDate = getText('f4PrevModCommDate', d.moduleCommissionDate);

        // Section C
        d.inverterCount = getText('f4PrevInvCount', d.inverterCount);
        d.inverterType = getText('f4PrevInvType', d.inverterType);
        d.inverterMake = getText('f4PrevInvMake', d.inverterMake);
        d.inverterModelNo = getText('f4PrevInvModel', d.inverterModelNo);
        d.inverterCapacity = getText('f4PrevInvCap', d.inverterCapacity);
        d.inverterSerialNo = getText('f4PrevInvSerial', d.inverterSerialNo);
        d.inverterInputVolt = getText('f4PrevInvInVolt', d.inverterInputVolt);
        d.inverterOutputVolt = getText('f4PrevInvOutVolt', d.inverterOutputVolt);
        d.inverterInstallDate = getText('f4PrevInvInstDate', d.inverterInstallDate);
        d.inverterCommissionDate = getText('f4PrevInvCommDate', d.inverterCommissionDate);

        // Section D & E
        d.dcCableMake = getText('f4PrevDcCableMake', d.dcCableMake);
        d.dcCableSize = getText('f4PrevDcCableSize', d.dcCableSize);
        d.acCableMake = getText('f4PrevAcCableMake', d.acCableMake);
        d.acCableSize = getText('f4PrevAcCableSize', d.acCableSize);

        // Section F & G
        d.dcdbMake = getText('f4PrevDcdbMake', d.dcdbMake);
        d.dcdbSerialNo = getText('f4PrevDcdbSerial', d.dcdbSerialNo);
        d.dcdbSpdRating = getText('f4PrevDcdbSpd', d.dcdbSpdRating);
        d.dcdbMcbDetails = getText('f4PrevDcdbMcb', d.dcdbMcbDetails);
        d.acdbMake = getText('f4PrevAcdbMake', d.acdbMake);
        d.acdbSerialNo = getText('f4PrevAcdbSerial', d.acdbSerialNo);
        d.acdbSpdRating = getText('f4PrevAcdbSpd', d.acdbSpdRating);
        d.acdbMcbDetails = getText('f4PrevAcdbMcb', d.acdbMcbDetails);

        // Section H
        d.earthResistance = getText('f4PrevEarthRes', d.earthResistance);
        d.earthWireSize = getText('f4PrevEarthWire', d.earthWireSize);
        d.twoEarthingPoints = getText('f4PrevTwoPoints', d.twoEarthingPoints);
        d.lighteningArrester = getText('f4PrevLa', d.lighteningArrester);
        d.laSizeType = getText('f4PrevLaType', d.laSizeType);

        // Section I: Net Meter
        d.netMeterCount = getText('f4PrevNmCount', d.netMeterCount);
        d.netMeterMake = getText('f4PrevNmMake', d.netMeterMake);
        d.netMeterSerial = getText('f4PrevNmSerial', d.netMeterSerial);
        d.netMeterCapacity = getText('f4PrevNmCap', d.netMeterCapacity);
        d.netMeterModel = getText('f4PrevNmModel', d.netMeterModel);
        d.netMeterPhase = getText('f4PrevNmPhase', d.netMeterPhase);
        d.netMeterCtPtRatio = getText('f4PrevNmCtPt', d.netMeterCtPtRatio);
        d.netMeterTestDate = getText('f4PrevNmDate', d.netMeterTestDate);

        // Section I: Solar Meter
        d.solarMeterCount = getText('f4PrevSmCount', d.solarMeterCount);
        d.solarMeterMake = getText('f4PrevSmMake', d.solarMeterMake);
        d.solarMeterSerial = getText('f4PrevSmSerial', d.solarMeterSerial);
        d.solarMeterCapacity = getText('f4PrevSmCap', d.solarMeterCapacity);
        d.solarMeterModel = getText('f4PrevSmModel', d.solarMeterModel);
        d.solarMeterPhase = getText('f4PrevSmPhase', d.solarMeterPhase);
        d.solarMeterCtPtRatio = getText('f4PrevSmCtPt', d.solarMeterCtPtRatio);
        d.solarMeterTestDate = getText('f4PrevSmDate', d.solarMeterTestDate);

        // Section J
        d.cautionPanels = getText('f4PrevCautPanels', d.cautionPanels);
        d.cautionInverters = getText('f4PrevCautInverters', d.cautionInverters);
        d.cautionDcAcdb = getText('f4PrevCautBoxes', d.cautionDcAcdb);

        // K & L
        d.provisionSwitches = getText('f4PrevSwitches', d.provisionSwitches);
        d.omInfoStatus = getText('f4PrevOmInfo', d.omInfoStatus);
        d.complianceCert = getText('f4PrevCompliance', d.complianceCert);

        // Signatures
        d.applicantName = getText('f4PrevSignAppName', d.applicantName);
        d.applicantAddress = getText('f4PrevSignAppAddr', d.applicantAddress);
        d.applicantDate = getText('f4PrevSignAppDate', d.applicantDate);
        d.installerFirm = getText('f4PrevSignInstFirm', d.installerFirm);
        d.installerAddress = getText('f4PrevSignInstAddr', d.installerAddress);
        d.installerDate = getText('f4PrevSignInstDate', d.installerDate);
        d.officerTitle = getText('f4PrevSignOffTitle', d.officerTitle);
        d.officerDate = getText('f4PrevSignOffDate', d.officerDate);
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const marginX = 14;
      const tableWidth = 182;
      const col1Width = 12;
      const col2Width = 90;
      const col3Width = 80;

      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);

      const drawTableRow = (y: number, slText: string, labelText: string, valText: string, opt: any = {}) => {
        const fontSize = opt.fontSize || 8.0;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', opt.isBold ? 'bold' : 'normal');

        const col2Lines = doc.splitTextToSize(labelText || '', col2Width - 4);
        const col3Lines = doc.splitTextToSize(valText || '', col3Width - 4);
        const maxLines = Math.max(col2Lines.length, col3Lines.length, 1);
        const lineHeight = opt.lineHeight || 3.7;
        const padding = 2.0;
        const rowHeight = Math.max(opt.minHeight || 5.0, maxLines * lineHeight + padding);

        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.line(marginX + col1Width, y, marginX + col1Width, y + rowHeight);
        doc.line(marginX + col1Width + col2Width, y, marginX + col1Width + col2Width, y + rowHeight);

        if (slText) {
          doc.text(String(slText), marginX + (col1Width / 2), y + 3.6, { align: 'center' });
        }
        doc.text(col2Lines, marginX + col1Width + 2, y + 3.6);
        doc.text(col3Lines, marginX + col1Width + col2Width + 2, y + 3.6);

        return rowHeight;
      };

      const drawSectionHeader = (y: number, sectionTitle: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.0);
        const lines = doc.splitTextToSize(sectionTitle, tableWidth - 6);
        const lineHeight = 3.6;
        const rowHeight = Math.max(5.2, (lines.length * lineHeight) + 2.0);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, tableWidth, rowHeight);
        doc.text(lines, marginX + 3, y + 3.6);
        return rowHeight;
      };

      // ══════════════════════════════════════════════════════════
      // PAGE 1
      // ══════════════════════════════════════════════════════════
      let curY = 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text('Work Completion Report (Form-4)', pageWidth / 2, curY, { align: 'center' });
      curY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.text('(To be submitted by the applicant)', pageWidth / 2, curY, { align: 'center' });
      curY += 6.5;

      doc.setFontSize(8.0);
      doc.text('To,', marginX, curY); curY += 3.8;
      doc.text(d.officerDesignation, marginX, curY); curY += 3.8;
      doc.text(d.officerAddress, marginX, curY); curY += 4.2;

      doc.setFont('helvetica', 'bold');
      doc.text('Sub: Submission of work completion report for System documentation requirements.', marginX, curY); curY += 4.0;
      doc.text(`Ref: ${d.refPmsgy}`, marginX, curY); curY += 4.2;

      doc.setFont('helvetica', 'normal');
      doc.text('Sir,', marginX, curY); curY += 3.8;

      const introText = 'With reference to the above, I would like to submit the following basic information of my Solar Rooftop PV System (SRTPV System) for your kind perusal and request for arranging to Inspect and Commission at the earliest:';
      const introLines = doc.splitTextToSize(introText, tableWidth);
      doc.text(introLines, marginX, curY);
      curY += (introLines.length * 3.6) + 3.0;

      // Section A
      curY += drawSectionHeader(curY, 'A. Details of the Application:');
      curY += drawTableRow(curY, '1', 'Application FG No/Date', d.appFgNoDate);
      curY += drawTableRow(curY, '2', 'Application fees in Rs.', d.appFees);

      // Section B
      curY += drawSectionHeader(curY, 'B. Details of the Solar PV Module:');
      curY += drawTableRow(curY, '1', 'Model', d.moduleModelNo);
      curY += drawTableRow(curY, '2', 'Total Capacity in kWp', d.moduleTotalCapacity);
      curY += drawTableRow(curY, '3', 'Make', d.moduleMake);
      curY += drawTableRow(curY, '4', 'Sl. NO', d.moduleSerials);
      curY += drawTableRow(curY, '5', 'Total No. of PV Modules', d.moduleCount);
      curY += drawTableRow(curY, '6', 'Capacity of each Module in kWp', d.moduleCapacityEach);
      curY += drawTableRow(curY, '7', 'Date of Installation', d.moduleInstallDate);
      curY += drawTableRow(curY, '8', 'Date of Commission', d.moduleCommissionDate);

      // Section C (Part 1 on Page 1)
      curY += drawSectionHeader(curY, 'C. Details of the Inverter:');
      curY += drawTableRow(curY, '1', 'Total No of Inverter', d.inverterCount);
      curY += drawTableRow(curY, '2', 'Name of the inverter (Type)', d.inverterType);
      curY += drawTableRow(curY, '3', 'Make', d.inverterMake);
      curY += drawTableRow(curY, '4', 'Model No.', d.inverterModelNo);
      curY += drawTableRow(curY, '5', 'Capacity', d.inverterCapacity);
      curY += drawTableRow(curY, '6', 'Serial No.', d.inverterSerialNo);

      // Page 1 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 1 of 3', pageWidth - marginX, 288, { align: 'right' });

      // ══════════════════════════════════════════════════════════
      // PAGE 2
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      curY = 12;

      // Section C (Part 2 on Page 2)
      curY += drawTableRow(curY, '7', 'Input Voltage', d.inverterInputVolt);
      curY += drawTableRow(curY, '8', 'Output Voltage', d.inverterOutputVolt);
      curY += drawTableRow(curY, '9', 'Date of Installation', d.inverterInstallDate);
      curY += drawTableRow(curY, '10', 'Date of Commission', d.inverterCommissionDate);

      // Section D
      curY += drawSectionHeader(curY, 'D. Details of Cables: DC');
      curY += drawTableRow(curY, '1', 'Make', d.dcCableMake);
      curY += drawTableRow(curY, '2', 'Size & Type', d.dcCableSize);

      // Section E
      curY += drawSectionHeader(curY, 'E. Details of AC Wiring:');
      curY += drawTableRow(curY, '1', 'Make', d.acCableMake);
      curY += drawTableRow(curY, '2', 'Size & Type', d.acCableSize);

      // Section F
      curY += drawSectionHeader(curY, 'F. Details of the DC distribution box:');
      curY += drawTableRow(curY, '1', 'Make', d.dcdbMake);
      curY += drawTableRow(curY, '2', 'Sl. No.', d.dcdbSerialNo);
      curY += drawTableRow(curY, '3', 'DC Surge Protection Device rating', d.dcdbSpdRating);
      curY += drawTableRow(curY, '4', 'MCB / Isolator quantity & capacity', d.dcdbMcbDetails);

      // Section G
      curY += drawSectionHeader(curY, 'G. Details of AC distribution box:');
      curY += drawTableRow(curY, '1', 'Make', d.acdbMake);
      curY += drawTableRow(curY, '2', 'Sl. No.', d.acdbSerialNo);
      curY += drawTableRow(curY, '3', 'AC Surge Protection Device rating', d.acdbSpdRating);
      curY += drawTableRow(curY, '4', 'MCB / MCCB quantity & capacity', d.acdbMcbDetails);

      // Section H
      curY += drawSectionHeader(curY, 'H. Details of Earthing:');
      curY += drawTableRow(curY, '1', 'Earth resistance (in ohms)', d.earthResistance);
      curY += drawTableRow(curY, '2', 'Size of the Earth wire / flat*(Copper/Al)', d.earthWireSize);
      curY += drawTableRow(curY, '3', 'Two separate earthing points', d.twoEarthingPoints);
      curY += drawTableRow(curY, '4', 'Lightening Arrester', d.lighteningArrester);
      curY += drawTableRow(curY, '5', 'LA Size & Type', d.laSizeType);

      // Note below H
      const noteH = 5.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.rect(marginX, curY, tableWidth, noteH);
      doc.text(d.earthingNote, marginX + 3, curY + 3.7);
      curY += noteH;

      // Section I: Net Meter Header & Rows
      curY += drawSectionHeader(curY, 'I. Details of the NET and Solar meters details (please enclose the test report of the bidirectional meter tested at MRT division, TPNODL)');
      curY += drawTableRow(curY, '1', 'No of Net Meter', d.netMeterCount);
      curY += drawTableRow(curY, '2', 'Make', d.netMeterMake);
      curY += drawTableRow(curY, '3', 'Serial No.', d.netMeterSerial);
      curY += drawTableRow(curY, '4', 'Capacity', d.netMeterCapacity);
      curY += drawTableRow(curY, '5', 'Type/Model', d.netMeterModel);
      curY += drawTableRow(curY, '6', 'Single ph./Three ph.', d.netMeterPhase);
      curY += drawTableRow(curY, '7', 'Line CT/ PT Ratio', d.netMeterCtPtRatio);
      curY += drawTableRow(curY, '8', 'Date of Test by MRT, TPNODL', d.netMeterTestDate);

      // Page 2 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 2 of 3', pageWidth - marginX, 288, { align: 'right' });

      // ══════════════════════════════════════════════════════════
      // PAGE 3
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      curY = 12;

      // Section I (cont.): Solar Meters
      curY += drawTableRow(curY, '1', 'No. of Solar Meters', d.solarMeterCount);
      curY += drawTableRow(curY, '2', 'Make', d.solarMeterMake);
      curY += drawTableRow(curY, '3', 'Serial No.', d.solarMeterSerial);
      curY += drawTableRow(curY, '4', 'Capacity', d.solarMeterCapacity);
      curY += drawTableRow(curY, '5', 'Type/Model', d.solarMeterModel);
      curY += drawTableRow(curY, '6', 'Single ph./Three ph.', d.solarMeterPhase);
      curY += drawTableRow(curY, '7', 'Line CT/ PT Ratio', d.solarMeterCtPtRatio);
      curY += drawTableRow(curY, '8', 'Date of Test by MRT, TPNODL', d.solarMeterTestDate);

      // Section J
      const jHeadH = 8.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.rect(marginX, curY, tableWidth, jHeadH);
      doc.text('J. Details of the Caution signs', marginX + 3, curY + 3.5);
      doc.setFont('helvetica', 'normal');
      doc.text('(Size of the caution label: 105 mm width X 20 mm height, with white letters on a red background)', marginX + 3, curY + 7.0);
      curY += jHeadH;

      curY += drawTableRow(curY, '1', 'Panels', d.cautionPanels);
      curY += drawTableRow(curY, '2', 'Inverters', d.cautionInverters);
      curY += drawTableRow(curY, '3', 'DC/ AC distribution box', d.cautionDcAcdb);

      // Row K
      const kH = 5.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.rect(marginX, curY, tableWidth, kH);
      doc.text(d.provisionSwitches, marginX + 3, curY + 3.7);
      curY += kH;

      // Row L
      const lH = 8.8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.rect(marginX, curY, tableWidth, lH);
      doc.text('L. Whether Operation and Maintenance information:', marginX + 3, curY + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text("Such as Do’s and Don’ts are provided by the System Installer: Yes* / No*.", marginX + 3, curY + 7.2);
      curY += lH + 4.0;

      // Compliance statement
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      const compLines = doc.splitTextToSize(d.complianceCert, tableWidth);
      doc.text(compLines, marginX, curY);
      curY += (compLines.length * 3.6) + 16;

      // Signatures
      const sigStartY = curY;
      const leftColX = marginX;
      const rightColX = marginX + 95;

      // Left: Applicant
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('Signature of the Applicant', leftColX, sigStartY);
      doc.text(`Name:- ${d.applicantName}`, leftColX, sigStartY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      const appAddrLines = doc.splitTextToSize(`Address:- ${d.applicantAddress}`, 85);
      doc.text(appAddrLines, leftColX, sigStartY + 8.5);
      const afterAppY = sigStartY + 8.5 + (appAddrLines.length * 3.8);
      doc.text(`Date: ${d.applicantDate}`, leftColX, afterAppY);

      // Right: Installer
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('Name and Signature of the System Installer with Seal', rightColX, sigStartY);
      doc.text(`Name of the firm: ${d.installerFirm}`, rightColX, sigStartY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      const instAddrLines = doc.splitTextToSize(`Address: ${d.installerAddress}`, 85);
      doc.text(instAddrLines, rightColX, sigStartY + 8.5);
      const afterInstY = sigStartY + 8.5 + (instAddrLines.length * 3.8);
      doc.text(`Date: ${d.installerDate}`, rightColX, afterInstY);

      // Certified by
      const certByY = Math.max(afterAppY, afterInstY) + 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('Certified by', leftColX, certByY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.text(d.officerTitle, leftColX, certByY + 4.2);
      doc.text(`Date: ${d.officerDate}`, leftColX, certByY + 8.2);

      // Enclosures
      const encY = certByY + 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.text('Enclosures:', leftColX, encY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      let eY = encY + 4.0;
      doc.text('1. Test report of bi-directional meter tested at MMG/MRT division, TPNODL.', leftColX, eY); eY += 3.6;
      doc.text('2. Copy of the IEC/IS Test reports/ certificate of PV modules, Inverter, Cable etc.', leftColX, eY); eY += 3.6;
      doc.text('3. Data sheets/Drawing for the array mounting System.', leftColX, eY); eY += 3.6;
      doc.text('4. Actual Single line wiring diagram of the SPV System.', leftColX, eY); eY += 3.6;
      doc.text('5. Copy of Maintenance & Operation information provided by the System Installer.', leftColX, eY);

      // Page 3 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 3 of 3', pageWidth - marginX, 288, { align: 'right' });

      // Save PDF
      const cleanName = (d.applicantName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanConsumerNo = (cust.ConsumerNo || cust.ApplicationNumber || 'Form4').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Form_4_Work_Completion_${cleanName}_${cleanConsumerNo}.pdf`;

      doc.save(fileName);
      this.toastService.success(`Form 4 PDF (${fileName}) downloaded successfully!`);
    } catch (err: any) {
      console.error('Error generating Form 4 PDF:', err);
      this.toastService.error(`Error generating Form 4 PDF: ${err?.message || err}`);
    }
  }

  onDownloadClicked(): void {
    const docType = this.activeDocType();
    if (docType === 'agreement') {
      this.downloadAgreementDoc();
    } else if (docType === 'form1') {
      this.downloadForm1Pdf();
    } else if (docType === 'form3') {
      this.downloadForm3Pdf();
    } else if (docType === 'form4') {
      this.downloadForm4Pdf();
    } else {
      this.openPreviewModal(docType);
    }
  }

  async buildAgreementDocxBlob(options?: { useLivePreviewValues?: boolean }): Promise<{
    blob: Blob;
    filename: string;
    consumerName: string;
    consumerNo: string;
    addressStr: string;
    dateStr: string;
  }> {
    const cust = this.selectedCustomer();
    if (!cust) {
      throw new Error('Please select a customer first.');
    }

    let consumerName = this.getCustomerSalutationName();
    let addressStr = this.getAgreementAddress();
    let consumerNo = cust.ConsumerNo || cust.ApplicationNumber || '';
    let dateStr = this.getFormattedAgreementDate();

    // If reading live values modified by user directly in preview container
    if (options?.useLivePreviewValues) {
      const container = document.getElementById('docxPreviewTarget');
      if (container) {
        const paragraphs = Array.from(container.querySelectorAll('p'));

        // 1. First Party Paragraph
        const firstPartyP = paragraphs.find(p => {
          const t = p.textContent || '';
          return t.includes('having premises') && t.includes('as the first Party');
        });
        if (firstPartyP) {
          const text = (firstPartyP.textContent || '').trim();
          const m = text.match(/^(?:Between\s+)?([\s\S]+?)\s+having premises\s+([\s\S]+?)\s+and Consumer No\s+([0-9a-zA-Z\s\/-]+?)\s+as the first Party/i);
          if (m) {
            if (m[1]?.trim()) consumerName = m[1].trim();
            if (m[2]?.trim()) addressStr = m[2].trim();
            if (m[3]?.trim()) consumerNo = m[3].trim();
          }
        }

        // 2. Execution Date Paragraph
        const dateP = paragraphs.find(p => (p.textContent || '').includes('This agreement is executed on'));
        if (dateP) {
          const dText = (dateP.textContent || '').trim();
          const dm = dText.match(/This agreement is executed on\s+([0-9a-zA-Z\s\/.,-]+?)\s+for design/i);
          if (dm && dm[1]?.trim()) {
            dateStr = dm[1].trim();
          }
        }
      }
    }

    // 1. Fetch authentic uploaded master template
    const response = await fetch('assets/Agreement_Template.docx');
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Open archive with JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlEntry = zip.file('word/document.xml');
    if (!docXmlEntry) {
      throw new Error('Invalid docx format in template');
    }

    let xml = await docXmlEntry.async('string');

    // 3. Exact in-place substitution of values into genuine OpenXML
    xml = xml.replace('Mr KIRAN KUMAR BINDHANI', consumerName);

    // Calculate extra lines produced by Address to auto-adjust Page 5 Disclaimer spacing
    const cleanAddress = (addressStr || '').replace(/\r/g, '').trim();
    const addressLines = cleanAddress.split('\n');
    let totalAddressRenderedLines = 0;
    for (const line of addressLines) {
      totalAddressRenderedLines += Math.max(1, Math.ceil(line.length / 65));
    }
    // Baseline address in template was 1 line (71 characters)
    const extraAddressLines = Math.max(0, totalAddressRenderedLines - 1);

    // Auto-adjust blank spacer paragraphs on Page 5 so Disclaimer stays strictly on Page 5
    const dateEndStr = '</w:p><w:p w14:paraId="00000059"';
    const discStartStr = '<w:p w14:paraId="00000067"';
    const startIdx = xml.indexOf(dateEndStr);
    const endIdx = xml.indexOf(discStartStr);

    if (startIdx !== -1 && endIdx !== -1) {
      const singleP = '<w:p w14:paraId="00000059" w14:textId="77777777" w:rsidR="007E1B41" w:rsidRDefault="007E1B41"><w:pPr><w:tabs><w:tab w:val="center" w:pos="720"/><w:tab w:val="center" w:pos="1440"/><w:tab w:val="center" w:pos="2161"/><w:tab w:val="center" w:pos="2881"/><w:tab w:val="center" w:pos="3601"/><w:tab w:val="center" w:pos="4321"/><w:tab w:val="center" w:pos="5041"/><w:tab w:val="center" w:pos="5761"/><w:tab w:val="center" w:pos="6481"/><w:tab w:val="center" w:pos="7434"/></w:tabs><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:p>';

      // Original template had 11 blank paragraphs. If extraAddressLines > 0, deduct extra lines + 1 safety buffer
      const adjustedBlanksCount = Math.max(1, 11 - extraAddressLines - (extraAddressLines > 0 ? 1 : 0));
      const newBlankBlock = singleP.repeat(adjustedBlanksCount);
      xml = xml.substring(0, startIdx + '</w:p>'.length) + newBlankBlock + xml.substring(endIdx);
    }

    // If address is extraordinarily long (> 8 extra lines), also compress the 4 blank lines between payment and signatures
    if (extraAddressLines > 8) {
      const p86End = 'installation)</w:t></w:r></w:p>';
      const p91Start = '<w:p w14:paraId="00000054"';
      const s = xml.indexOf(p86End);
      const e = xml.indexOf(p91Start);
      if (s !== -1 && e !== -1) {
        const singleP = '<w:p w14:paraId="00000059" w14:textId="77777777" w:rsidR="007E1B41" w:rsidRDefault="007E1B41"><w:pPr><w:tabs><w:tab w:val="center" w:pos="720"/><w:tab w:val="center" w:pos="1440"/><w:tab w:val="center" w:pos="2161"/><w:tab w:val="center" w:pos="2881"/><w:tab w:val="center" w:pos="3601"/><w:tab w:val="center" w:pos="4321"/><w:tab w:val="center" w:pos="5041"/><w:tab w:val="center" w:pos="5761"/><w:tab w:val="center" w:pos="6481"/><w:tab w:val="center" w:pos="7434"/></w:tabs><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:p>';
        const reducedPaymentBlanks = singleP.repeat(Math.max(1, 4 - Math.floor((extraAddressLines - 8) / 2)));
        xml = xml.substring(0, s + p86End.length) + reducedPaymentBlanks + xml.substring(e);
      }
    }

    // Format address for OpenXML (convert newlines to <w:br/>)
    const formattedAddressXml = cleanAddress
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('</w:t><w:br/><w:t xml:space="preserve">');

    xml = xml.replace('AT: 601, PATANA, AJODHYA, DISTRICT: BALASORE, STATE: ODISHA, PIN: 756020', formattedAddressXml);
    xml = xml.replace('324313051063', consumerNo);

    const dateSnippet = 'This agreement is executed on</w:t></w:r><w:r w:rsidR="00ED05EC"><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00577AF0"><w:t>2</w:t></w:r><w:r w:rsidR="00F45C3C"><w:t>2</w:t></w:r><w:r w:rsidR="00577AF0"><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00F45C3C"><w:t>April</w:t></w:r><w:r w:rsidR="00644EAD"><w:t xml:space="preserve"> 2026 for</w:t></w:r>';
    xml = xml.replace(dateSnippet, `This agreement is executed on ${dateStr} for</w:t></w:r>`);

    zip.file('word/document.xml', xml);

    // 4. Generate native .docx binary blob
    const outBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const filename = `Agreement_${consumerName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${consumerNo || cust.SlNo}.docx`;

    return {
      blob: outBlob,
      filename,
      consumerName,
      consumerNo,
      addressStr,
      dateStr
    };
  }

  async renderAgreementDocxPreview(): Promise<void> {
    const cust = this.selectedCustomer();
    if (!cust) return;

    const container = document.getElementById('docxPreviewTarget');
    if (!container) return;

    container.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
        <div class="spinner-border text-primary mb-2" role="status">
          <span class="visually-hidden">Loading document...</span>
        </div>
        <div class="fs-8">Rendering exact Word document preview...</div>
      </div>
    `;

    try {
      const { blob } = await this.buildAgreementDocxBlob({ useLivePreviewValues: false });
      container.innerHTML = '';

      const { renderAsync } = await import('docx-preview');
      await renderAsync(blob, container, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        experimental: true,
        className: 'docx-preview-wrap'
      });

      // Enable direct inline editing on preview
      container.setAttribute('contenteditable', 'true');
      container.setAttribute('spellcheck', 'false');

      const sections = container.querySelectorAll('section.docx');
      sections.forEach(sec => {
        (sec as HTMLElement).style.outline = 'none';
        (sec as HTMLElement).style.cursor = 'text';
      });

    } catch (err) {
      console.error('docx-preview rendering error, fallback to verbatim:', err);
      container.innerHTML = this.generateAgreementHtmlVerbatim();
      container.setAttribute('contenteditable', 'true');
    }
  }

  async downloadAgreementDoc(): Promise<void> {
    const cust = this.selectedCustomer();
    if (!cust) {
      this.toastService.warning('Please select a customer first.');
      return;
    }

    try {
      const { blob, filename } = await this.buildAgreementDocxBlob({ useLivePreviewValues: true });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      this.toastService.success(`Agreement downloaded: ${filename}`);
    } catch (err) {
      console.warn('Direct DOCX generation fallback to HTML doc:', err);
      this.downloadAgreementDocHtmlFallback(
        this.getCustomerSalutationName(),
        this.getAgreementAddress(),
        cust.ConsumerNo || cust.ApplicationNumber || '',
        this.getFormattedAgreementDate()
      );
    }
  }

  downloadAgreementDocHtmlFallback(consumerName: string, addressStr: string, consumerNo: string, dateStr: string): void {
    const cust = this.selectedCustomer();
    if (!cust) return;

    const contentHtml = this.generateAgreementHtmlVerbatim();

    const docFileContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Agreement_${consumerName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 210mm 297mm;
            margin: 25.9mm 22.5mm 31.4mm 23.6mm;
            mso-header-margin: 36pt;
            mso-footer-margin: 36pt;
            mso-page-orientation: portrait;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10.5pt;
            line-height: 1.15;
            color: #000000;
          }
          p {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10.5pt;
            line-height: 1.15;
            margin: 0;
            padding: 0;
            text-align: justify;
          }
          .empty-line {
            min-height: 1.15em;
          }
          .page-break {
            page-break-before: always;
            mso-break-type: section-break;
            clear: both;
          }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .fw-bold { font-weight: bold; }
          table.sig-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
            margin-bottom: 0;
          }
          table.sig-table td {
            width: 50%;
            vertical-align: top;
            padding: 0;
            font-family: 'Times New Roman', Times, serif;
            font-size: 10.5pt;
            line-height: 1.15;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${contentHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + docFileContent], { type: 'application/msword;charset=utf-8' });
    const filename = `Agreement_${consumerName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${consumerNo || cust.SlNo}.doc`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    this.toastService.success(`Agreement downloaded: ${filename}`);
  }

  generateAgreementHtmlVerbatim(): string {
    const dateStr = this.getFormattedAgreementDate();
    const consumerName = this.getCustomerSalutationName();
    const consumerNo = this.selectedCustomer()?.ConsumerNo || '';
    const addressStr = this.getAgreementAddress();

    // Auto-adjust blank spacer paragraphs so Disclaimer stays on Page 5
    const cleanAddress = (addressStr || '').replace(/\r/g, '').trim();
    const addressLines = cleanAddress.split('\n');
    let totalAddressRenderedLines = 0;
    for (const line of addressLines) {
      totalAddressRenderedLines += Math.max(1, Math.ceil(line.length / 65));
    }
    const extraP1Lines = Math.max(0, totalAddressRenderedLines - 1);
    const sigExtraLines = Math.max(0, Math.ceil(cleanAddress.length / 35) - 2);
    const totalExtra = extraP1Lines + sigExtraLines;

    const emptyLinesCount = Math.max(1, 11 - totalExtra - (totalExtra > 0 ? 1 : 0));
    const dynamicBlankLines = Array(emptyLinesCount).fill('        <p class="empty-line">&nbsp;</p>').join('\n');

    const paymentEmptyCount = totalExtra > 8 ? Math.max(1, 4 - Math.floor((totalExtra - 8) / 2)) : 4;
    const dynamicPaymentBlankLines = Array(paymentEmptyCount).fill('        <p class="empty-line">&nbsp;</p>').join('\n');

    return `
      <!-- PAGE 1: 17 blank lines top space + Header + Parties -->
      <div class="agreement-page">
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>

        <p style="text-align: right;">Annexure 2</p>
        <p style="font-weight: bold; text-align: left;">
          Model Draft Agreement between Consumer &amp; Vendor for Installation of grid connected rooftop solar (RTS) project under PM _Surya Ghar: Muft Bijli Yojana
        </p>
        <p>----------------------------------------------------------------------------------------------------------------------------</p>

        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">
          This agreement is executed on ${dateStr} for design, supply, installation, commissioning, and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar: Muft Bijli Yojana.
        </p>

        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">Between</p>

        <p style="font-weight: bold;">
          ${consumerName} having premises ${addressStr} and Consumer No ${consumerNo} as the first Party,
        </p>

        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">
          SHRI TRUTIYADEV SOLAR ENTERPRISES, having registered office AT-TALAMUNDALI, PO-KANKADAJODI, PS-MANIABANDHA, DIST-CUTTACK, ODISHA-754035 (hereinafter referred to as second Party i.e. Vendor.)
        </p>

        <p class="empty-line">&nbsp;</p>
      </div>

      <!-- PAGE 2: Whereas + First Party Undertakings -->
      <div class="agreement-page page-break" style="page-break-before: always; mso-break-type: section-break;">
        <p>Whereas</p>
        <p>
          The First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.
        </p>

        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">And whereas</p>

        <p class="empty-line">&nbsp;</p>

        <p>
          Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period
        </p>

        <p class="empty-line">&nbsp;</p>

        <p>On this day, the First Party and Second Party agree to the following:</p>

        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">The First Party hereby undertakes to perform the following activities:</p>
        <p>1. Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme</p>
        <p>2. Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system.</p>
        <p>3. Provide access to the Roof Top during installation of the plant, operation &amp;                maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</p>
        <p>4. Provide electricity during plant installation and water for cleaning of the panels.</p>
        <p>5. Report any malfunctioning of the plant to the Vendor during the warranty period.</p>
        <p>6. Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work /customization required depending upon the building condition.</p>
        <p>7. Acknowledge that, if the Grid-tied Rooftop Solar plant (or any part thereof), gets damaged to any extent because of the following reasons:</p>
        <div style="padding-left: 24pt;">
          <p>i. &ldquo;Act of God Phenomena&rdquo;,</p>
          <p>ii. Poor Maintenance,</p>
          <p>iii. Structural issues with the home itself,</p>
          <p>iv.  Burglary, sabotage or riot like scenarios then,</p>
          <p>For Solar Modules or panels that suffer physical damage (breakage of glass layer regardless of severity, bending, twisting or complete dismantling), no requests regarding repairs or replacement shall be entertained by the Vendor (as such damages aren't covered under warranty); the damaged Solar modules (panels) shall be treated as scrap and dealt accordingly.</p>
        </div>
      </div>

      <!-- PAGE 3: Damage Repairs + Clause 8 + Second Party start -->
      <div class="agreement-page page-break" style="page-break-before: always; mso-break-type: section-break;">
        <div style="padding-left: 24pt;">
          <p>For other parts if damaged, there could be a repair job done, for which, the first party has to bear the cost (after a mutually agreed budget &amp; date etc are discussed) only within the time frame of this agreement.</p>
        </div>
        <p>8. The first party understands that following actions might compromise the project itself and if the installation/modification/repair is carried out anyway then the first party will be responsible for partial or total loss of the Rooftop Solar system:</p>
        <div style="padding-left: 24pt;">
          <p>Any undisclosed modifications to the rooftop area between the initial survey (by vendor) and the day of installation.</p>
          <p>Absence or lack of cooperation of first party (contact person) OR, Disturbance created by any third-party during installation, modifications, repair or maintenance jobs.</p>
        </div>

        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">The Second Party hereby undertakes to perform the following activities:</p>
        <p>The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/ scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</p>
        <p><strong>Site Survey:</strong> Site visit, survey and development of detailed project report for installation of RTS system. This also includes, feasibility study of roof, strength of roof and shadow free area.  If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise a separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</p>
        <p><strong>Design &amp; Engineering:</strong> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</p>
        <p><strong>Module and Inverter:</strong> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</p>
        <p><strong>Procurement &amp; Supply:</strong> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
      </div>

      <!-- PAGE 4: Second Party remaining + Payment Terms + Signatures + Disclaimer -->
      <div class="agreement-page page-break" style="page-break-before: always; mso-break-type: section-break;">
        <p><strong>Installation &amp; Civil work:</strong> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
        <p><strong>Documentation (Technical Catalogues/Warranty Certificates/BIS certificates/other test reports etc):</strong> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
        <p><strong>Project completion report (PCR):</strong> Assisting the consumer in filling and uploading signed documents (Consumer &amp; Vendor) on the national portal.</p>
        <p><strong>Warranty:</strong> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</p>
        <p><strong>NET meter &amp; Grid Connectivity:</strong> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</p>
        <p><strong>Testing and Commissioning:</strong> The vendor shall be present at the time of testing and commissioning by the DISCOM.</p>
        <p><strong>Operation &amp; Maintenance:</strong> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</p>
        <p><strong>Insurance:</strong> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</p>
        <p><strong>Applicable Standard:</strong> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</p>
        <p><strong>Project/system cost &amp; payment terms:</strong>  The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</p>
        <p><strong>Dispute:</strong> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to any dispute arising between vendor and consumer.</p>
        <p><strong>Subsidy / Project Related Documents:</strong> Vendor must provide all the documents to the consumer and help in uploading the same to National Portal for smooth release of subsidy.</p>

        <p class="empty-line">&nbsp;</p>

        <p><strong>Performance of Plant:</strong> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorised agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning / testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</p>

        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>
        <p class="empty-line">&nbsp;</p>

        <p style="font-weight: bold;">Mutually Agreed Terms of Payment …</p>

        <p class="empty-line">&nbsp;</p>

        <p>Payment should be 100% In advance. (in this case 70% advance and rest on the completion of installation)</p>

${dynamicPaymentBlankLines}

        <table class="sig-table" style="width: 100%; border-collapse: collapse; margin-top: 0; margin-bottom: 0;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 12pt;">
              <p style="font-weight: bold;">First Party</p>
              <p>Name: ${consumerName}</p>
              <p>Address: ${addressStr}</p>
              <p>Sign: _______________________</p>
              <p>Date: ${dateStr}</p>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 12pt;">
              <p style="font-weight: bold;">Second Party</p>
              <p>Name: SHRI TRUTIYADEV SOLAR ENTERPRISES</p>
              <p>Address: AT-TALAMUNDALI, PO-KANKADAJODI, PS-MANIABANDHA, DIST-CUTTACK, ODISHA-754035</p>
              <p>Sign: _______________________</p>
              <p>Date: ${dateStr}</p>
            </td>
          </tr>
        </table>

${dynamicBlankLines}

        <p style="font-size: 9.5pt; font-style: italic;">Disclaimer: This agreement is between vendor and consumer and any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.</p>
      </div>
    `;
  }

  resetCurrentDocument(): void {
    const cust = this.selectedCustomer();
    if (cust) {
      this.docService.selectCustomer(cust);
      this.toastService.info('Form reloaded with latest customer details.');
    }
  }
}
