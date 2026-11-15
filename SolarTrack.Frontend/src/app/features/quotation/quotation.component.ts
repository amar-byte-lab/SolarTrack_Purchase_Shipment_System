import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuotationService } from './services/quotation.service';
import { NavService } from '../../core/services/nav.service';
import { AdjustmentLine, ProductItem } from './models/quotation.model';

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation.component.html',
  styleUrls: ['./quotation.component.scss']
})
export class QuotationComponent implements OnInit {
  quotationService = inject(QuotationService);
  navService = inject(NavService);

  isAddressesExpanded = signal<boolean>(false);
  isTermsExpanded = signal<boolean>(false);
  expandedProduct = signal<string | null>(null);

  ngOnInit(): void {
    this.navService.setPageTitle('Quotation');
    this.quotationService.loadInitialData().subscribe({
      next: () => {},
      error: (err) => console.error('Failed to load quotation initial data:', err)
    });
  }

  isProductSelected(name: string): boolean {
    return this.quotationService.selectedProductSets().includes(name);
  }

  toggleProductSet(name: string): void {
    this.quotationService.toggleProductSet(name);
  }

  toggleAccordion(name: string): void {
    this.expandedProduct.update(curr => curr === name ? null : name);
  }

  getProductItems(productName: string): ProductItem[] {
    return this.quotationService.allProductItems().filter(it => it.ProductName === productName);
  }

  removeProductSet(name: string): void {
    this.quotationService.removeProductSet(name);
  }

  removeItemById(id: string): void {
    const idx = this.quotationService.quotationItems().findIndex(it => it.id === id);
    if (idx !== -1) {
      this.quotationService.removeItem(idx);
    }
  }

  isFirstRow(groupIndex: number, itemIndex: number): boolean {
    return groupIndex === 0 && itemIndex === 0;
  }

  onAddressChange(newAddress: string): void {
    const current = this.quotationService.companyProfile();
    this.quotationService.companyProfile.set({
      ...current,
      selectedAddress: newAddress
    });
  }

  onSubsidySelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!val) {
      this.quotationService.setSubsidy(null);
    } else {
      this.quotationService.setSubsidy(Number(val));
    }
  }

  getAdjustmentAmount(adj: AdjustmentLine): number {
    if (adj.type === 'tax') {
      return (this.quotationService.taxableAmount() * (Number(adj.value) || 0)) / 100;
    }
    return Number(adj.value) || 0;
  }

  goBack(): void {
    window.history.back();
  }

  printQuotation(): void {
    window.print();
  }
}
