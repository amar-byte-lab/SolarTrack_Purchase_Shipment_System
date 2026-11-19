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
  isPreviewVisible = signal<boolean>(false);

  isFormValid = computed<boolean>(() => {
    const name = this.quotationService.customerName()?.trim();
    const address = this.quotationService.customerAddress()?.trim();
    return Boolean(name && address);
  });

  selectedProductTitle = computed<string>(() => {
    const sets = this.quotationService.selectedProductSets();
    if (sets && sets.length > 0) {
      return sets.join(' & ').toUpperCase();
    }
    return '3 KW DCR ONGRID SOLAR SET';
  });

  currentSubsidy = computed(() => {
    return this.quotationService.selectedSubsidy() || 
           this.quotationService.companyProfile().subsidies[0] || 
           { kw: 3, central: 78000, state: 60000, total: 138000 };
  });

  cgstRate = computed<number>(() => {
    const adj = this.quotationService.adjustments().find(a => a.key === 'cgst');
    return (adj && adj.active) ? (Number(adj.value) || 0) : 2.5;
  });

  sgstRate = computed<number>(() => {
    const adj = this.quotationService.adjustments().find(a => a.key === 'sgst');
    return (adj && adj.active) ? (Number(adj.value) || 0) : 2.5;
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

  togglePdfPreview(): void {
    this.isPreviewVisible.update(v => !v);
  }

  formatQuoteDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }

  getAmountInWords(amount: number): string {
    const num = Math.round(Math.max(0, Number(amount) || 0));
    if (num === 0) return 'Zero';

    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const convertLessThanOneThousand = (n: number): string => {
      let str = '';
      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        str += ones[n] + ' ';
      }
      return str.trim();
    };

    let words = '';
    let rem = num;

    if (rem >= 10000000) {
      const crore = Math.floor(rem / 10000000);
      words += convertLessThanOneThousand(crore) + ' Crore ';
      rem %= 10000000;
    }

    if (rem >= 100000) {
      const lakh = Math.floor(rem / 100000);
      words += convertLessThanOneThousand(lakh) + ' Lakh ';
      rem %= 100000;
    }

    if (rem >= 1000) {
      const thousand = Math.floor(rem / 1000);
      words += convertLessThanOneThousand(thousand) + ' Thousand ';
      rem %= 1000;
    }

    if (rem > 0) {
      words += convertLessThanOneThousand(rem);
    }

    return words.trim();
  }

  printQuotation(): void {
    const origTitle = document.title;
    const custName = (this.quotationService.customerName() || '').trim().replace(/\s+/g, '_') || 'Customer';
    document.title = `Quot_${custName}`;
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  }
}
