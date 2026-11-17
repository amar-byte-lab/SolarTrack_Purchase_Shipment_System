import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryItem } from '../../models/inventory.model';

interface InwardRowForm {
  itemCode: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
  totalExclGst: number;
  costWithGst: number;
  totalWithGst: number;
  deliveryShare: number;
  costPerUnit: number;
}

@Component({
  selector: 'app-stock-in-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './stock-in-modal.component.html',
  styleUrls: ['./stock-in-modal.component.scss']
})
export class StockInModalComponent implements OnChanges {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() initialItemCode?: string;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  date = '';
  supplier = '';
  location = 'Main Godown';
  transportCost = 0;
  remarks = '';
  docName: string | null = null;
  docData: string | null = null;

  itemsList: InwardRowForm[] = [];
  isSubmitting = false;

  get availableItems(): InventoryItem[] {
    return this.inventoryService.rawItems();
  }

  get totalMaterialCost(): number {
    return this.itemsList.reduce((s, r) => s + (r.totalExclGst || 0), 0);
  }

  get totalGst(): number {
    return this.itemsList.reduce((s, r) => s + ((r.totalWithGst || 0) - (r.totalExclGst || 0)), 0);
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
    this.docName = null;
    this.docData = null;
    this.isSubmitting = false;

    this.itemsList = [];
    if (this.initialItemCode) {
      const itm = this.availableItems.find(i => i.ItemCode === this.initialItemCode);
      if (itm) {
        this.itemsList.push({
          itemCode: itm.ItemCode,
          qty: 1,
          unitPrice: Number(itm.BuyingPrice) || 0,
          gstRate: 18,
          totalExclGst: Number(itm.BuyingPrice) || 0,
          costWithGst: (Number(itm.BuyingPrice) || 0) * 1.18,
          totalWithGst: (Number(itm.BuyingPrice) || 0) * 1.18,
          deliveryShare: 0,
          costPerUnit: (Number(itm.BuyingPrice) || 0) * 1.18
        });
      }
    } else if (this.availableItems.length > 0) {
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
    const defaultItem = this.availableItems.length > 0 ? this.availableItems[0] : null;
    this.itemsList.push({
      itemCode: defaultItem?.ItemCode || '',
      qty: 1,
      unitPrice: Number(defaultItem?.BuyingPrice) || 0,
      gstRate: 18,
      totalExclGst: Number(defaultItem?.BuyingPrice) || 0,
      costWithGst: (Number(defaultItem?.BuyingPrice) || 0) * 1.18,
      totalWithGst: (Number(defaultItem?.BuyingPrice) || 0) * 1.18,
      deliveryShare: 0,
      costPerUnit: (Number(defaultItem?.BuyingPrice) || 0) * 1.18
    });
    this.recalculateCosts();
  }

  removeItemRow(index: number): void {
    this.itemsList.splice(index, 1);
    this.recalculateCosts();
  }

  onItemChanged(row: InwardRowForm): void {
    const itm = this.availableItems.find(i => i.ItemCode === row.itemCode);
    if (itm) {
      row.unitPrice = Number(itm.BuyingPrice) || 0;
    }
    this.recalculateCosts();
  }

  recalculateCosts(): void {
    const tCost = Number(this.transportCost) || 0;
    const totalCount = this.itemsList.length || 1;
    const totalUnits = this.itemsList.reduce((s, r) => s + (Number(r.qty) || 0), 0) || 1;

    this.itemsList.forEach(r => {
      const q = Math.max(0, Number(r.qty) || 0);
      const up = Math.max(0, Number(r.unitPrice) || 0);
      const gst = Number(r.gstRate) || 0;

      r.totalExclGst = Math.round(q * up * 100) / 100;
      const gstFactor = 1 + (gst / 100);
      r.costWithGst = Math.round(up * gstFactor * 100) / 100;
      r.totalWithGst = Math.round(r.totalExclGst * gstFactor * 100) / 100;

      // Delivery cost share allocated proportionally by quantity
      const share = totalUnits > 0 ? (tCost * (q / totalUnits)) : (tCost / totalCount);
      r.deliveryShare = Math.round(share * 100) / 100;

      const perUnitDelivery = q > 0 ? (share / q) : 0;
      r.costPerUnit = Math.round((r.costWithGst + perUnitDelivery) * 100) / 100;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      this.docName = f.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.docData = reader.result as string;
      };
      reader.readAsDataURL(f);
    }
  }

  removeFile(): void {
    this.docName = null;
    this.docData = null;
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
    const header = {
      date: this.date || new Date().toISOString().slice(0, 10),
      supplier: this.supplier.trim(),
      location: this.location.trim() || 'Main Godown',
      transportCost: Number(this.transportCost) || 0,
      remarks: this.remarks.trim(),
      docName: this.docName || undefined,
      docData: this.docData || undefined
    };

    const itemsPayload = this.itemsList.map(r => ({
      itemCode: r.itemCode,
      qty: Number(r.qty) || 0,
      unitPrice: Number(r.unitPrice) || 0,
      gstRate: Number(r.gstRate) || 0,
      costPerUnit: Number(r.costPerUnit) || 0,
      totalCost: Number(r.totalExclGst) || 0
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
