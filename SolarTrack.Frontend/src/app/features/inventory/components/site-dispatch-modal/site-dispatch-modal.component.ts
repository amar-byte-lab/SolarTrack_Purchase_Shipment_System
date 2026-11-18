import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ItemTreeSelectComponent } from '../item-tree-select/item-tree-select.component';
import {
  InventoryItemWithStock,
  DispatchItemEntry,
  CustomerAllocationEntry
} from '../../models/inventory.model';
import { InstallmentRow } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-site-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ItemTreeSelectComponent],
  templateUrl: './site-dispatch-modal.component.html',
  styleUrls: ['./site-dispatch-modal.component.scss']
})
export class SiteDispatchModalComponent implements OnChanges {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() initialItemCodes: string[] = [];
  @Input() initialItemCode?: string;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  siteName = '';
  date = '';
  
  // Logistics & Transport Details: Only Driver, Charge/km, Distance, Delivery Charge, Description
  driver = '';
  chargePerKm: number | null = null;
  distanceKm: number | null = null;
  deliveryCharge = 0;
  transportDescription = '';

  // Customer-wise Cost Allocation: hidden by default, toggled via button
  showCustomerAllocation = false;

  remarks = '';
  docName: string | null = null;
  docData: string | null = null;

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
    this.transportDescription = '';
    this.showCustomerAllocation = false;
    this.remarks = '';
    this.docName = null;
    this.docData = null;
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
    }
  }

  onDeliveryChargeChange(): void {
    const charge = Number(this.deliveryCharge) || 0;
    const dist = Number(this.distanceKm) || 0;
    if (dist > 0 && charge > 0) {
      this.chargePerKm = Math.round((charge / dist) * 100) / 100;
    }
  }

  toggleCustomerAllocation(): void {
    this.showCustomerAllocation = !this.showCustomerAllocation;
    if (this.showCustomerAllocation && this.customerAllocations.length === 0) {
      this.addCustomerAllocation();
    }
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
  }

  removeCustomerAllocation(index: number): void {
    this.customerAllocations.splice(index, 1);
  }

  onCustomerSelected(ca: CustomerAllocationEntry): void {
    const found = this.customersList.find(c => c.Name === ca.customerName);
    if (found) {
      ca.slNo = found.SlNo;
    }
  }

  recalcCustomerTotal(ca: CustomerAllocationEntry): void {
    const sc = Number(ca.setCost) || 0;
    const ic = Number(ca.installCost) || 0;
    const dc = Number(ca.deliveryCost) || 0;
    const oc = Number(ca.otherCost) || 0;
    ca.total = Math.round((sc + ic + dc + oc) * 100) / 100;
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
      this.transportDescription ? `Transport: ${this.transportDescription.trim()}` : '',
      this.remarks ? this.remarks.trim() : ''
    ].filter(Boolean).join('\n');

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
      docName: this.docName || undefined,
      docData: this.docData || undefined
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
