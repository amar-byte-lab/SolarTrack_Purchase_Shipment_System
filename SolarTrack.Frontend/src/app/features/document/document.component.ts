import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DocumentService } from './services/document.service';
import { SummaryService } from '../../core/services/summary.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerModalComponent } from '../../shared/components/customer-modal/customer-modal.component';
import { InstallmentRow } from '../../core/models/summary.model';
import { TechnicalProductSpecs, DocumentType } from './models/document.model';

// Reusable Sub-components
import { CustomerDirectoryComponent } from './components/customer-directory/customer-directory.component';
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
    CustomerDirectoryComponent,
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.isMappingPartnerMenuOpen = false;
    }
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
