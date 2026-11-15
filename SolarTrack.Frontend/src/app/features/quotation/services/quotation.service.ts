import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, tap } from 'rxjs';
import { 
  ProductSet, 
  ProductItem, 
  QuotationItem, 
  QuotationGroup,
  AdjustmentLine, 
  SubsidyOption, 
  CompanyProfile 
} from '../models/quotation.model';

@Injectable({
  providedIn: 'root'
})
export class QuotationService {
  // Master data signals
  availableProducts = signal<ProductSet[]>([]);
  allProductItems = signal<ProductItem[]>([]);
  companyProfile = signal<CompanyProfile>({
    name: 'Shri Trutiyadev Solar Enterprises',
    email: 'shritrutiyadevsolar@gmail.com',
    phone: '8763443172',
    gst: '21BWBPM8649F1ZJ',
    defaultGst: 5,
    addresses: ['Chandi Chhaka, Nuapatna, Tigiria, Cuttack, Odisha 754035'],
    selectedAddress: 'Chandi Chhaka, Nuapatna, Tigiria, Cuttack, Odisha 754035',
    bank: {
      holder: 'SHRI TRUTIYADEV SOLAR ENTERPRISES',
      name: 'PUNJAB NATIONAL BANK',
      accountNo: '0936202100000988',
      ifsc: 'NUAPATNA Branch & PUNB0093620'
    },
    terms: '1. We declare that this quotation reflects actual price.\n2. Payment within 7 days.\n3. Bhubaneswar jurisdiction.',
    subsidies: [{ kw: 3, state: 60000, central: 78000, total: 138000 }]
  });

  // Quotation form signals
  selectedProductSets = signal<string[]>([]);
  quotationItems = signal<QuotationItem[]>([]);
  mergeTotalValue = signal<boolean>(true);
  mergedTotalValue = signal<number>(200000);

  // Grouped quotation items for section headers and merged layout
  groupedQuotationItems = computed<QuotationGroup[]>(() => {
    const items = this.quotationItems();
    const groups: QuotationGroup[] = [];
    const setNames = Array.from(new Set(items.map(it => it.productName || 'Custom Items')));
    
    setNames.forEach(name => {
      const groupItems = items.filter(it => (it.productName || 'Custom Items') === name);
      groups.push({
        productName: name,
        isCustom: name === 'Custom Items',
        items: groupItems
      });
    });
    return groups;
  });

  // Quote Metadata
  quoteNo = signal<string>(this.generateQuoteNo());
  quoteDate = signal<string>(new Date().toISOString().slice(0, 10));
  validity = signal<string>('10 Days');
  delivery = signal<string>('Within 1 wk. in advance');
  paymentTerms = signal<string>('Advance Mode');

  // Customer Details
  customerName = signal<string>('');
  customerMobile = signal<string>('');
  customerAddress = signal<string>('');

  // Adjustments & Subsidy
  adjustments = signal<AdjustmentLine[]>([
    { key: 'discount', label: 'Discount (₹)', type: 'subtraction', value: 0, active: false, sign: '-' },
    { key: 'gst', label: 'GST (%)', type: 'tax', value: 0, active: false, sign: '+' },
    { key: 'cgst', label: 'CGST (%)', type: 'tax', value: 0, active: false, sign: '+' },
    { key: 'sgst', label: 'SGST (%)', type: 'tax', value: 0, active: false, sign: '+' },
    { key: 'transport', label: 'Transportation (₹)', type: 'addition', value: 0, active: false, sign: '+' },
    { key: 'labour', label: 'Labour Charges (₹)', type: 'addition', value: 0, active: false, sign: '+' },
    { key: 'other', label: 'Other Charges (₹)', type: 'addition', value: 0, active: false, sign: '+' }
  ]);

  selectedSubsidy = signal<SubsidyOption | null>(null);
  isLoading = signal<boolean>(false);

  // Computed Financial Calculations
  subtotal = computed(() => {
    if (this.mergeTotalValue()) {
      return Number(this.mergedTotalValue()) || 0;
    }
    return this.quotationItems().reduce((sum, item) => sum + (item.price * item.qty), 0);
  });

  discountAmount = computed(() => {
    const adj = this.adjustments().find(a => a.key === 'discount');
    return (adj && adj.active) ? Number(adj.value) || 0 : 0;
  });

  taxableAmount = computed(() => {
    return Math.max(0, this.subtotal() - this.discountAmount());
  });

  gstAmount = computed(() => {
    const adj = this.adjustments().find(a => a.key === 'gst');
    return (adj && adj.active) ? (this.taxableAmount() * (Number(adj.value) || 0)) / 100 : 0;
  });

  cgstAmount = computed(() => {
    const adj = this.adjustments().find(a => a.key === 'cgst');
    return (adj && adj.active) ? (this.taxableAmount() * (Number(adj.value) || 0)) / 100 : 0;
  });

  sgstAmount = computed(() => {
    const adj = this.adjustments().find(a => a.key === 'sgst');
    return (adj && adj.active) ? (this.taxableAmount() * (Number(adj.value) || 0)) / 100 : 0;
  });

  totalTaxAmount = computed(() => {
    return this.gstAmount() + this.cgstAmount() + this.sgstAmount();
  });

  additionsAmount = computed(() => {
    return this.adjustments()
      .filter(a => a.active && a.type === 'addition')
      .reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  });

  grandTotal = computed(() => {
    return Math.round(this.taxableAmount() + this.totalTaxAmount() + this.additionsAmount());
  });

  subsidyTotal = computed(() => {
    const s = this.selectedSubsidy();
    return s ? s.total : 0;
  });

  netPayable = computed(() => {
    return Math.max(0, this.grandTotal() - this.subsidyTotal());
  });

  constructor(private http: HttpClient) {}

  generateQuoteNo(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `TR${yy}/${dd}${mm}${hh}${mi}`;
  }

  loadInitialData(): Observable<any> {
    this.isLoading.set(true);
    return forkJoin({
      products: this.http.get<ProductSet[]>('/api/get?table=products'),
      items: this.http.get<ProductItem[]>('/api/get?table=product_items'),
      settings: this.http.get<{ Key: string; Value: string }[]>('/api/get?table=settings')
    }).pipe(
      tap(({ products, items, settings }) => {
        this.isLoading.set(false);
        this.availableProducts.set(products || []);
        this.allProductItems.set(items || []);

        // Parse Settings
        if (settings && Array.isArray(settings)) {
          const getVal = (key: string, def = '') => settings.find(s => s.Key === key)?.Value ?? def;
          let parsedAddresses: string[] = [];
          try {
            parsedAddresses = JSON.parse(getVal('CompanyAddresses', '[]'));
          } catch {
            parsedAddresses = ['Chandi Chhaka, Nuapatna, Tigiria, Cuttack, Odisha 754035'];
          }

          let parsedSubsidies: SubsidyOption[] = [];
          try {
            const rawSubs = JSON.parse(getVal('GovtSubsidies', '[]'));
            parsedSubsidies = rawSubs.map((s: any) => ({
              kw: Number(s.kw) || 0,
              state: Number(s.state) || 0,
              central: Number(s.central) || 0,
              total: (Number(s.state) || 0) + (Number(s.central) || 0)
            }));
          } catch {
            parsedSubsidies = [{ kw: 3, state: 60000, central: 78000, total: 138000 }];
          }

          const defaultGstNum = Number(getVal('DefaultGST', '5')) || 5;

          this.companyProfile.set({
            name: getVal('CompanyName', 'Shri Trutiyadev Solar Enterprises'),
            email: getVal('CompanyEmail', 'shritrutiyadevsolar@gmail.com'),
            phone: getVal('CompanyPhone', '8763443172'),
            gst: getVal('CompanyGST', '21BWBPM8649F1ZJ'),
            defaultGst: defaultGstNum,
            addresses: parsedAddresses.length > 0 ? parsedAddresses : ['Chandi Chhaka, Nuapatna, Tigiria, Cuttack, Odisha 754035'],
            selectedAddress: parsedAddresses[0] || 'Chandi Chhaka, Nuapatna, Tigiria, Cuttack, Odisha 754035',
            bank: {
              holder: getVal('BankAcHolder', 'SHRI TRUTIYADEV SOLAR ENTERPRISES'),
              name: getVal('BankName', 'PUNJAB NATIONAL BANK'),
              accountNo: getVal('BankAcNo', '0936202100000988'),
              ifsc: getVal('BankBranchIFS', 'NUAPATNA Branch & PUNB0093620')
            },
            terms: getVal('CompanyTerms', '1. Quotation reflects actual goods price.\n2. Payment within 7 days.\n3. Bhubaneswar jurisdiction.'),
            subsidies: parsedSubsidies
          });

          // Don't auto-check so placeholder is visible initially if needed
          if (this.selectedProductSets().length > 0) {
            const sum = this.quotationItems().reduce((s, it) => s + (it.price * it.qty), 0);
            this.mergedTotalValue.set(sum || 200000);
          }
        }
      })
    );
  }

  toggleProductSet(productName: string): void {
    const current = this.selectedProductSets();
    if (current.includes(productName)) {
      this.selectedProductSets.set(current.filter(p => p !== productName));
      // Remove items belonging to this product set
      const remaining = this.quotationItems().filter(it => it.productName !== productName);
      this.quotationItems.set(remaining);
      const newSum = remaining.reduce((sum, it) => sum + (it.price * it.qty), 0);
      this.mergedTotalValue.set(newSum || 200000);
    } else {
      this.selectedProductSets.set([...current, productName]);
      // Add items belonging to this product set
      const itemsToAdd = this.allProductItems().filter(it => it.ProductName === productName);
      const newQuoteItems: QuotationItem[] = itemsToAdd.map(it => ({
        id: it.RowID || Math.random().toString(36).substring(2, 9),
        productName: it.ProductName,
        itemName: it.ItemName,
        qty: 1,
        price: Number(it.Price) || 0,
        isCustom: false
      }));
      const updated = [...this.quotationItems(), ...newQuoteItems];
      this.quotationItems.set(updated);
      const newSum = updated.reduce((sum, it) => sum + (it.price * it.qty), 0);
      this.mergedTotalValue.set(newSum || 200000);
    }
  }

  removeProductSet(productName: string): void {
    this.selectedProductSets.set(this.selectedProductSets().filter(p => p !== productName));
    const remaining = this.quotationItems().filter(it => it.productName !== productName);
    this.quotationItems.set(remaining);
    const newSum = remaining.reduce((sum, it) => sum + (it.price * it.qty), 0);
    this.mergedTotalValue.set(newSum || 200000);
  }

  addCustomItem(): void {
    const newItem: QuotationItem = {
      id: 'custom-' + Date.now(),
      productName: 'Custom Items',
      itemName: 'Custom Solar Equipment / Service',
      qty: 1,
      price: 0,
      isCustom: true
    };
    const updated = [...this.quotationItems(), newItem];
    this.quotationItems.set(updated);
  }

  removeItem(index: number): void {
    const updated = [...this.quotationItems()];
    const removed = updated.splice(index, 1)[0];
    this.quotationItems.set(updated);

    if (removed && removed.productName && removed.productName !== 'Custom Items') {
      const stillHas = updated.some(it => it.productName === removed.productName);
      if (!stillHas) {
        this.selectedProductSets.set(this.selectedProductSets().filter(p => p !== removed.productName));
      }
    }

    if (!this.mergeTotalValue()) {
      const newSum = updated.reduce((sum, it) => sum + (it.price * it.qty), 0);
      this.mergedTotalValue.set(newSum);
    }
  }

  toggleAdjustment(key: string): void {
    const updated = this.adjustments().map(a => {
      if (a.key === key) {
        const nextActive = !a.active;
        let defaultVal = a.value;
        if (nextActive && defaultVal === 0 && (a.key === 'gst' || a.key === 'cgst' || a.key === 'sgst')) {
          defaultVal = this.companyProfile().defaultGst || 5;
        }
        return { ...a, active: nextActive, value: defaultVal };
      }
      return a;
    });
    this.adjustments.set(updated);
  }

  updateAdjustmentValue(key: string, value: number): void {
    const updated = this.adjustments().map(a => {
      if (a.key === key) {
        return { ...a, value: Math.max(0, value) };
      }
      return a;
    });
    this.adjustments.set(updated);
  }

  setSubsidy(kw: number | null): void {
    if (kw === null) {
      this.selectedSubsidy.set(null);
    } else {
      const match = this.companyProfile().subsidies.find(s => s.kw === kw);
      this.selectedSubsidy.set(match || null);
    }
  }
}
