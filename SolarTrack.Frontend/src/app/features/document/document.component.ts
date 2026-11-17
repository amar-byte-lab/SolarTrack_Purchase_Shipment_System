import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DocumentService } from './services/document.service';
import { SummaryService } from '../../core/services/summary.service';
import { ToastService } from '../../shared/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
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

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    CommonModule, 
    IconComponent,
    CustomerDirectoryComponent,
    ProductSpecsModalComponent,
    AgreementFormComponent,
    Form1ApplicationComponent,
    Form3InspectionComponent,
    Form4CompletionComponent,
    Form6CommissionComponent,
    CustomerImportModalComponent
  ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit {
  docService = inject(DocumentService);
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  // Active document type
  activeDocType = this.docService.activeDocType;

  // Selected customer & specs
  selectedCustomer = this.docService.selectedCustomer;
  currentSpecs = this.docService.currentSpecs;

  // Directory filter signals
  searchQuery = this.docService.searchQuery;
  selectedDistrict = this.docService.selectedDistrict;
  districtStats = this.docService.districtStats;
  filteredCustomers = this.docService.filteredCustomers;

  // Technical Specs Modal State
  isSpecsModalOpen = signal<boolean>(false);

  // Customer Import Modal State
  isImportModalOpen = signal<boolean>(false);

  // Document Preview Modal State
  isPreviewModalOpen = signal<boolean>(false);
  previewDocType = signal<DocumentType>('form4');

  ngOnInit(): void {
    // Ensure all customer data is loaded from server
    if (this.summaryService.rawInstallments().length === 0) {
      this.summaryService.loadAllData().subscribe(() => {
        if (!this.selectedCustomer() && this.filteredCustomers().length > 0) {
          this.docService.selectCustomer(this.filteredCustomers()[0]);
        }
      });
    }

    // Check route query params to support ?tab=agreement or ?doc=form1
    this.route.queryParams.subscribe(params => {
      const doc = params['doc'] || params['form'] || params['tab'];
      if (doc && ['agreement', 'form1', 'form3', 'form4', 'form6'].includes(doc)) {
        this.activeDocType.set(doc as DocumentType);
      }
    });

    // Auto-select first customer if none selected
    if (!this.selectedCustomer() && this.filteredCustomers().length > 0) {
      this.docService.selectCustomer(this.filteredCustomers()[0]);
    }
  }

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
    this.toastService.success('Customer import complete. Customer directory refreshed!');
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
