import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ItemTreeSelectComponent } from '../item-tree-select/item-tree-select.component';
import { CustomerSelectComponent } from '../customer-select/customer-select.component';
import {
  InventoryItemWithStock,
  DispatchItemEntry,
  CustomerAllocationEntry
} from '../../models/inventory.model';
import { InstallmentRow } from '../../../../core/models/summary.model';

export interface DispatchUploadedDoc {
  id: string;
  name: string;
  originalName: string;
  data: string;
  sizeFormatted: string;
  isEditingName?: boolean;
  tempName?: string;
}

@Component({
  selector: 'app-site-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ItemTreeSelectComponent, CustomerSelectComponent],
  templateUrl: './site-dispatch-modal.component.html',
  styleUrls: ['./site-dispatch-modal.component.scss']
})
export class SiteDispatchModalComponent implements OnChanges {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() initialItemCodes: string[] = [];
  @Input() initialItemCode?: string;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  siteName = '';
  date = '';
  
  // Logistics & Transport Details: Driver, Delivery Charge (Col-1) & Charge/km, Distance (Col-2)
  driver = '';
  chargePerKm: number | null = null;
  distanceKm: number | null = null;
  deliveryCharge = 0;

  // Active tab: 'items' (Equipment Items) or 'customer' (Customer Allocation)
  activeTab: 'items' | 'customer' = 'items';

  remarks = '';
  customerRemarks = '';

  // Multiple Uploaded Documents with Rename & Delete (Reactive Signal, same as Stock In)
  readonly uploadedDocs = signal<DispatchUploadedDoc[]>([]);

  itemsList: DispatchItemEntry[] = [];
  customerAllocations: CustomerAllocationEntry[] = [];
  isSubmitting = false;

  get availableItemsWithStock(): InventoryItemWithStock[] {
    return this.inventoryService.itemsWithStock();
  }

  get customersList(): InstallmentRow[] {
    return this.inventoryService.rawInstallments();
  }

  get totalUnits(): number {
    return this.itemsList.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  }

  get totalMaterialCost(): number {
    return this.itemsList.reduce((s, r) => s + (Number(r.dispatchedCost) || 0), 0);
  }

  get perCustomerAvgMaterialCost(): number {
    const count = this.customerAllocations.length;
    if (count <= 0) return 0;
    return Math.round((this.totalMaterialCost / count) * 100) / 100;
  }

  get totalCustomerAllocatedCost(): number {
    return this.customerAllocations.reduce((sum, ca) => sum + (Number(ca.total) || 0), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.siteName = '';
    this.date = new Date().toISOString().slice(0, 10);
    this.driver = '';
    this.chargePerKm = null;
    this.distanceKm = null;
    this.deliveryCharge = 0;
    this.activeTab = 'items';
    this.remarks = '';
    this.customerRemarks = '';
    this.uploadedDocs.set([]);
    this.isSubmitting = false;

    this.itemsList = [];
    this.customerAllocations = [];

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
            itemName: itm.ItemName,
            qty: 1,
            unitBuyingPrice: bp,
            dispatchedCost: bp,
            unit: itm.Unit || 'Nos',
            availableStock: itm.inHandQty || 0
          });
        }
      });
    } else if (this.availableItemsWithStock.length > 0) {
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
    this.itemsList.push({
      itemCode: defaultItem?.ItemCode || '',
      itemName: defaultItem?.ItemName || '',
      qty: 1,
      unitBuyingPrice: Number(defaultItem?.BuyingPrice) || 0,
      dispatchedCost: Number(defaultItem?.BuyingPrice) || 0,
      unit: defaultItem?.Unit || 'Nos',
      availableStock: defaultItem?.inHandQty || 0
    });
    this.recalculateCosts();
  }

  removeItemRow(index: number): void {
    this.itemsList.splice(index, 1);
    this.recalculateCosts();
  }

  onItemChanged(row: DispatchItemEntry): void {
    const itm = this.availableItemsWithStock.find(i => i.ItemCode === row.itemCode);
    if (itm) {
      row.itemName = itm.ItemName;
      row.unitBuyingPrice = Number(itm.BuyingPrice) || 0;
      row.unit = itm.Unit;
      row.availableStock = itm.inHandQty;
    }
    this.recalculateCosts();
  }

  onTreeItemSelected(row: DispatchItemEntry, itm: InventoryItemWithStock): void {
    row.itemCode = itm.ItemCode;
    row.itemName = itm.ItemName;
    row.unitBuyingPrice = Number(itm.BuyingPrice) || 0;
    row.unit = itm.Unit;
    row.availableStock = itm.inHandQty;
    this.recalculateCosts();
  }

  recalculateCosts(): void {
    this.itemsList.forEach(r => {
      const q = Math.max(0, Number(r.qty) || 0);
      const cost = Math.max(0, Number(r.unitBuyingPrice) || 0);
      r.dispatchedCost = Math.round(q * cost * 100) / 100;
    });
  }

  // Bidirectional calculation between Distance, Charge/km and Delivery Charge
  onDistanceOrRateChange(): void {
    const dist = Number(this.distanceKm) || 0;
    const rate = Number(this.chargePerKm) || 0;
    if (dist > 0 && rate > 0) {
      this.deliveryCharge = Math.round(dist * rate * 100) / 100;
      this.distributeDeliveryChargeToCustomers();
    }
  }

  onDeliveryChargeChange(): void {
    const charge = Number(this.deliveryCharge) || 0;
    const dist = Number(this.distanceKm) || 0;
    if (dist > 0 && charge > 0) {
      this.chargePerKm = Math.round((charge / dist) * 100) / 100;
    }
    this.distributeDeliveryChargeToCustomers();
  }

  addCustomerAllocation(): void {
    const defaultCust = this.customersList.length > 0 ? this.customersList[0] : null;
    this.customerAllocations.push({
      slNo: defaultCust?.SlNo,
      customerName: defaultCust?.Name || '',
      setCost: 0,
      installCost: 0,
      deliveryCost: 0,
      otherCost: 0,
      remark: '',
      total: 0
    });
    this.distributeDeliveryChargeToCustomers();
  }

  removeCustomerAllocation(index: number): void {
    this.customerAllocations.splice(index, 1);
    this.distributeDeliveryChargeToCustomers();
  }

  onCustomerSelected(ca: CustomerAllocationEntry, cust?: InstallmentRow): void {
    const found = cust || this.customersList.find(c => c.Name === ca.customerName);
    if (found) {
      ca.slNo = found.SlNo;
      ca.customerName = found.Name || '';
    }
  }

  onCustomerSetCostChange(ca: CustomerAllocationEntry): void {
    this.distributeDeliveryChargeToCustomers();
  }

  distributeDeliveryChargeToCustomers(): void {
    const totalDelivery = Math.max(0, Number(this.deliveryCharge) || 0);
    const count = this.customerAllocations.length;
    if (count === 0) return;

    const totalSetCost = this.customerAllocations.reduce((sum, ca) => sum + (Math.max(0, Number(ca.setCost)) || 0), 0);

    let allocatedSum = 0;
    this.customerAllocations.forEach((ca, idx) => {
      let share = 0;
      if (idx === count - 1) {
        // Last customer gets exact remainder to prevent 1-paisa rounding gap
        share = Math.max(0, Math.round((totalDelivery - allocatedSum) * 100) / 100);
      } else {
        if (totalSetCost > 0) {
          const ratio = (Math.max(0, Number(ca.setCost)) || 0) / totalSetCost;
          share = Math.round(totalDelivery * ratio * 100) / 100;
        } else {
          share = Math.round((totalDelivery / count) * 100) / 100;
        }
        allocatedSum += share;
      }
      ca.deliveryCost = share;
      ca.total = Math.round(((Number(ca.setCost) || 0) + share) * 100) / 100;
    });
  }

  recalcCustomerTotal(ca: CustomerAllocationEntry): void {
    const sc = Number(ca.setCost) || 0;
    const dc = Number(ca.deliveryCost) || 0;
    ca.total = Math.round((sc + dc) * 100) / 100;
  }

  // --- Multiple File Upload Handling (Same as Stock In: Reactive, Rename & Delete) ---
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    let remaining = files.length;
    const newDocs: DispatchUploadedDoc[] = [];

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

    input.value = '';
  }

  startRenameDoc(doc: DispatchUploadedDoc, event?: Event): void {
    if (event) event.stopPropagation();
    doc.tempName = doc.name;
    doc.isEditingName = true;
    this.cdr.markForCheck();
  }

  saveRenameDoc(doc: DispatchUploadedDoc, event?: Event): void {
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

  cancelRenameDoc(doc: DispatchUploadedDoc, event?: Event): void {
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

  previewDoc(doc: DispatchUploadedDoc, event?: Event): void {
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

  submitDispatch(): void {
    if (!this.siteName.trim()) {
      this.toastService.warning('Please enter the Site / Project name.');
      return;
    }
    if (this.itemsList.length === 0) {
      this.toastService.warning('Please add at least one equipment item to dispatch.');
      return;
    }

    const invalid = this.itemsList.some(r => !r.itemCode || r.qty <= 0);
    if (invalid) {
      this.toastService.warning('Please ensure all items have a valid product selected and quantity > 0.');
      return;
    }

    this.isSubmitting = true;

    const fullRemarks = [
      this.remarks ? this.remarks.trim() : '',
      this.customerRemarks ? `Customer Notes: ${this.customerRemarks.trim()}` : ''
    ].filter(Boolean).join('\n\n');

    const docsPayload = this.uploadedDocs().map(d => ({
      name: d.name,
      data: d.data
    }));

    const header = {
      siteName: this.siteName.trim(),
      date: this.date || new Date().toISOString().slice(0, 10),
      vehicle: this.driver.trim(),
      transportCost: Number(this.deliveryCharge) || 0,
      distanceKm: Number(this.distanceKm) || 0,
      extraDeliveryCost: 0,
      extraDeliveryComment: '',
      remarks: fullRemarks,
      isOurProject: true,
      customerAllocations: this.customerAllocations,
      docName: docsPayload[0]?.name || undefined,
      docData: docsPayload[0]?.data || undefined,
      documents: docsPayload
    };

    const itemsPayload = this.itemsList.map(r => ({
      itemCode: r.itemCode,
      qty: Number(r.qty) || 0,
      unitBuyingPrice: Number(r.unitBuyingPrice) || 0,
      dispatchedCost: Number(r.dispatchedCost) || 0
    }));

    this.inventoryService.saveSiteDispatchConsignment(header, itemsPayload).subscribe({
      next: () => {
        this.toastService.success(`Site dispatch to "${header.siteName}" recorded successfully.`);
        this.saved.emit();
        this.onClose();
      },
      error: (err) => {
        this.toastService.error('Error saving site dispatch: ' + (err.message || 'Server error'));
        this.isSubmitting = false;
      }
    });
  }
}
