import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { QuotationService } from './services/quotation.service';
import { NavService } from '../../core/services/nav.service';
import { AdjustmentLine, ProductItem } from './models/quotation.model';

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './quotation.component.html',
  styleUrls: ['./quotation.component.scss']
})
export class QuotationComponent implements OnInit {
  quotationService = inject(QuotationService);
  navService = inject(NavService);

  isAddressesExpanded = signal<boolean>(true);
  isTermsExpanded = signal<boolean>(true);
  isBankExpanded = signal<boolean>(false);
  activeAddressTab = signal<'to' | 'from'>('to');
  expandedProduct = signal<string | null>(null);

  isFormValid = computed<boolean>(() => {
    const name = this.quotationService.customerName()?.trim();
    const address = this.quotationService.customerAddress()?.trim();
    return Boolean(name && address);
  });

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

  onGrandTotalChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = Number(input.value);
    if (!isNaN(val) && val >= 0) {
      this.quotationService.setGrandTotal(val);
    } else {
      input.value = String(this.quotationService.grandTotal());
    }
  }

  onItemPriceChange(item: ProductItem | any, newPrice: any): void {
    const p = Math.max(0, Number(newPrice) || 0);
    item.price = p;
    item.basePrice = p;
  }

  getItemRows(text: string | undefined): number {
    if (!text) return 1;
    const lines = text.split('\n');
    let count = 0;
    for (const line of lines) {
      count += Math.max(1, Math.ceil(line.length / 22));
    }
    return Math.min(count, 5);
  }

  adjustTextarea(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
    }
  }

  goBack(): void {
    window.history.back();
  }

  printQuotation(): void {
    window.print();
  }
}
