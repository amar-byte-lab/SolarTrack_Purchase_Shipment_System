import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnChanges,
  SimpleChanges,
  signal,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryItemWithStock } from '../../models/inventory.model';
import { ItemTreeSelectComponent } from '../item-tree-select/item-tree-select.component';

export interface StockInUploadedDoc {
  id: string;
  name: string;
  originalName: string;
  data: string;
  sizeFormatted: string;
  isEditingName?: boolean;
  tempName?: string;
}

export interface InwardRowForm {
  itemCode: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
  totalExclGst: number;
  costWithGst: number;
  totalWithGst: number;
  deliveryShare: number;
  deliveryPercent: number;
  costPerUnit: number;
}

@Component({
  selector: 'app-stock-in-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ItemTreeSelectComponent],
  templateUrl: './stock-in-modal.component.html',
  styleUrls: ['./stock-in-modal.component.scss']
})
export class StockInModalComponent implements OnChanges {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() initialItemCodes: string[] = [];
  @Input() initialItemCode?: string;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  date = '';
  supplier = '';
  location = 'Main Godown';
  transportCost = 0;
  remarks = '';

  // Multiple Uploaded Documents with Rename & Delete (Reactive Signal)
  readonly uploadedDocs = signal<StockInUploadedDoc[]>([]);

  itemsList: InwardRowForm[] = [];
  isSubmitting = false;

  get availableItemsWithStock(): InventoryItemWithStock[] {
    return this.inventoryService.itemsWithStock();
  }

  get totalMaterialCost(): number {
    return this.itemsList.reduce((s, r) => s + (r.totalExclGst || 0), 0);
  }

  get totalGst(): number {
    return this.itemsList.reduce((s, r) => s + ((r.totalWithGst || 0) - (r.totalExclGst || 0)), 0);
  }

  get totalWithGstAll(): number {
    return this.itemsList.reduce((s, r) => s + (r.totalWithGst || 0), 0);
  }

  get grandInwardTotal(): number {
    return this.totalWithGstAll + (Math.max(0, Number(this.transportCost)) || 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.date = new Date().toISOString().slice(0, 10);
    this.supplier = '';
    this.location = 'Main Godown';
    this.transportCost = 0;
    this.remarks = '';
    this.uploadedDocs.set([]);
    this.isSubmitting = false;

    this.itemsList = [];

    // Support multiple selected items from ledger checkboxes or single initial code
    const codesToLoad = (this.initialItemCodes && this.initialItemCodes.length > 0)
      ? this.initialItemCodes
      : (this.initialItemCode ? [this.initialItemCode] : []);

    if (codesToLoad.length > 0) {
      codesToLoad.forEach(code => {
        const itm = this.availableItemsWithStock.find(
          i => (i.ItemCode || '').toLowerCase() === code.toLowerCase()
        );
        if (itm) {
          const bp = Number(itm.BuyingPrice) || 0;
          this.itemsList.push({
            itemCode: itm.ItemCode,
            qty: 1,
            unitPrice: bp,
            gstRate: 18,
            totalExclGst: bp,
            costWithGst: Math.round(bp * 1.18 * 100) / 100,
            totalWithGst: Math.round(bp * 1.18 * 100) / 100,
            deliveryShare: 0,
            deliveryPercent: 0,
            costPerUnit: Math.round(bp * 1.18 * 100) / 100
          });
        }
      });
    }

    if (this.itemsList.length === 0 && this.availableItemsWithStock.length > 0) {
      this.addItemRow();
    }
    this.recalculateCosts();
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  addItemRow(): void {
    const defaultItem = this.availableItemsWithStock.length > 0 ? this.availableItemsWithStock[0] : null;
    const bp = Number(defaultItem?.BuyingPrice) || 0;
    this.itemsList.push({
      itemCode: defaultItem?.ItemCode || '',
      qty: 1,
      unitPrice: bp,
      gstRate: 18,
      totalExclGst: bp,
      costWithGst: Math.round(bp * 1.18 * 100) / 100,
      totalWithGst: Math.round(bp * 1.18 * 100) / 100,
      deliveryShare: 0,
      deliveryPercent: 0,
      costPerUnit: Math.round(bp * 1.18 * 100) / 100
    });
    this.recalculateCosts();
  }

  removeItemRow(index: number): void {
    this.itemsList.splice(index, 1);
    this.recalculateCosts();
  }

  onItemSelected(row: InwardRowForm, item: InventoryItemWithStock): void {
    row.itemCode = item.ItemCode;
    row.unitPrice = Number(item.BuyingPrice) || 0;
    this.recalculateCosts();
  }

  // Delivery Cost is distributed proportionately to each item's Total+GST value
  recalculateCosts(): void {
    const tCost = Math.max(0, Number(this.transportCost) || 0);

    // Step 1: Calculate totalExclGst, GST and totalWithGst for each item
    this.itemsList.forEach(r => {
      const q = Math.max(0, Number(r.qty) || 0);
      const up = Math.max(0, Number(r.unitPrice) || 0);
      const gst = Number(r.gstRate) || 0;

      r.totalExclGst = Math.round(q * up * 100) / 100;
      const gstFactor = 1 + (gst / 100);
      const lineGst = Math.round(r.totalExclGst * (gst / 100) * 100) / 100;
      r.totalWithGst = Math.round((r.totalExclGst + lineGst) * 100) / 100;
      r.costWithGst = q > 0 ? Math.round((r.totalWithGst / q) * 100) / 100 : Math.round(up * gstFactor * 100) / 100;
    });

    // Step 2: Sum of Total+GST across all items
    const sumTotalWithGst = this.itemsList.reduce((s, r) => s + (r.totalWithGst || 0), 0);

    // Step 3: Distribute Delivery Cost proportionately based on Total+GST
    this.itemsList.forEach(r => {
      const q = Math.max(0, Number(r.qty) || 0);
      let share = 0;
      let percent = 0;

      if (sumTotalWithGst > 0) {
        const ratio = r.totalWithGst / sumTotalWithGst;
        share = Math.round(tCost * ratio * 100) / 100;
        percent = Math.round(ratio * 1000) / 10;
      } else if (this.itemsList.length > 0) {
        share = Math.round((tCost / this.itemsList.length) * 100) / 100;
        percent = Math.round((100 / this.itemsList.length) * 10) / 10;
      }

      r.deliveryShare = share;
      r.deliveryPercent = percent;

      // Effective Cost Per Unit = (Total+GST + Delivery Cost Share) / Quantity
      if (q > 0) {
        r.costPerUnit = Math.round(((r.totalWithGst + share) / q) * 100) / 100;
      } else {
        r.costPerUnit = r.costWithGst;
      }
    });
  }

  // --- Multiple File Upload Handling (Immediate Reactive Reflection) ---
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    let remaining = files.length;
    const newDocs: StockInUploadedDoc[] = [];

    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => {
        newDocs.push({
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: f.name,
          originalName: f.name,
          data: reader.result as string,
          sizeFormatted: this.formatFileSize(f.size),
          isEditingName: false,
          tempName: f.name
        });
        remaining--;
        if (remaining === 0) {
          this.uploadedDocs.update(docs => [...docs, ...newDocs]);
          this.cdr.markForCheck();
        }
      };
      reader.onerror = () => {
        remaining--;
        if (remaining === 0) {
          this.uploadedDocs.update(docs => [...docs, ...newDocs]);
          this.cdr.markForCheck();
        }
      };
      reader.readAsDataURL(f);
    });

    // Reset input value so same files can be selected again
    input.value = '';
  }

  startRenameDoc(doc: StockInUploadedDoc, event?: Event): void {
    if (event) event.stopPropagation();
    doc.tempName = doc.name;
    doc.isEditingName = true;
    this.cdr.markForCheck();
  }

  saveRenameDoc(doc: StockInUploadedDoc, event?: Event): void {
    if (event) event.stopPropagation();
    const newName = (doc.tempName || '').trim();
    if (newName) {
      doc.name = newName;
      doc.isEditingName = false;
      this.uploadedDocs.update(docs => [...docs]);
      this.toastService.info(`File renamed to "${newName}"`);
    } else {
      this.toastService.warning('File name cannot be empty.');
    }
    this.cdr.markForCheck();
  }

  cancelRenameDoc(doc: StockInUploadedDoc, event?: Event): void {
    if (event) event.stopPropagation();
    doc.tempName = doc.name;
    doc.isEditingName = false;
    this.cdr.markForCheck();
  }

  removeDoc(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    const docs = this.uploadedDocs();
    const removed = docs[index];
    this.uploadedDocs.update(list => list.filter((_, i) => i !== index));
    if (removed) {
      this.toastService.info(`Document "${removed.name}" removed.`);
    }
    this.cdr.markForCheck();
  }

  previewDoc(doc: StockInUploadedDoc, event?: Event): void {
    if (event) event.stopPropagation();
    if (!doc.data) return;

    const win = window.open();
    if (win) {
      if (doc.data.startsWith('data:image/') || doc.data.startsWith('data:application/pdf')) {
        win.document.write(
          `<html><head><title>${doc.name}</title></head><body style="margin:0;background:#1e1e1e;display:flex;align-items:center;justify-content:center;"><iframe src="${doc.data}" style="border:none;width:100%;height:100vh;"></iframe></body></html>`
        );
      } else {
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        link.click();
      }
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  submitStockIn(): void {
    if (!this.supplier.trim()) {
      this.toastService.warning('Please enter the Supplier / Vendor name.');
      return;
    }
    if (this.itemsList.length === 0) {
      this.toastService.warning('Please add at least one item to stock in.');
      return;
    }

    const invalid = this.itemsList.some(r => !r.itemCode || r.qty <= 0);
    if (invalid) {
      this.toastService.warning('Please ensure all items have a valid product selected and quantity > 0.');
      return;
    }

    this.isSubmitting = true;

    // Prepare documents payload
    const docsPayload = this.uploadedDocs().map(d => ({
      name: d.name,
      data: d.data
    }));

    const header = {
      date: this.date || new Date().toISOString().slice(0, 10),
      supplier: this.supplier.trim(),
      location: this.location.trim() || 'Main Godown',
      transportCost: Number(this.transportCost) || 0,
      remarks: this.remarks.trim(),
      docName: docsPayload[0]?.name || undefined,
      docData: docsPayload[0]?.data || undefined,
      documents: docsPayload
    };

    const itemsPayload = this.itemsList.map(r => ({
      itemCode: r.itemCode,
      qty: Number(r.qty) || 0,
      unitPrice: Number(r.unitPrice) || 0,
      gstRate: Number(r.gstRate) || 0,
      costPerUnit: Number(r.costPerUnit) || 0,
      totalCost: Number(r.totalExclGst) || 0,
      deliveryShare: Number(r.deliveryShare) || 0
    }));

    this.inventoryService.saveStockInConsignment(header, itemsPayload).subscribe({
      next: () => {
        this.toastService.success(`Stock In consignment from "${header.supplier}" recorded successfully.`);
        this.saved.emit();
        this.onClose();
      },
      error: (err) => {
        this.toastService.error('Error saving stock in: ' + (err.message || 'Server error'));
        this.isSubmitting = false;
      }
    });
  }
}
