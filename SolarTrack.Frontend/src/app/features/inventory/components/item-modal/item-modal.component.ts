import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryItem } from '../../models/inventory.model';

@Component({
  selector: 'app-item-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './item-modal.component.html',
  styleUrls: ['./item-modal.component.scss']
})
export class ItemModalComponent implements OnChanges {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() editItem: InventoryItem | null = null;
  @Input() defaultCategory: string = 'Panels';

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  itemCode = '';
  itemName = '';
  category = 'Panels';
  unit = 'Nos';
  minThreshold = 5;
  buyingPrice = 0;
  location = 'Main Godown';

  get categories(): string[] {
    return this.inventoryService.categories();
  }

  get isEditMode(): boolean {
    return Boolean(this.editItem);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.editItem) {
        this.itemCode = this.editItem.ItemCode;
        this.itemName = this.editItem.ItemName;
        this.category = this.editItem.Category || 'Others';
        this.unit = this.editItem.Unit || 'Nos';
        this.minThreshold = Number(this.editItem.MinThreshold) || 5;
        this.buyingPrice = Number(this.editItem.BuyingPrice) || 0;
        this.location = this.editItem.Location || 'Main Godown';
      } else {
        this.itemCode = 'SKU-' + Date.now().toString().slice(-6);
        this.itemName = '';
        this.category = this.defaultCategory || 'Panels';
        this.unit = 'Nos';
        this.minThreshold = 5;
        this.buyingPrice = 0;
        this.location = 'Main Godown';
      }
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  saveItem(): void {
    const code = this.itemCode.trim();
    const name = this.itemName.trim();
    if (!code) {
      this.toastService.warning('Please enter an Item Code / SKU.');
      return;
    }
    if (!name) {
      this.toastService.warning('Please enter the Equipment Item Name.');
      return;
    }

    const payload: InventoryItem = {
      ItemCode: code,
      ItemName: name,
      Category: this.category,
      Unit: this.unit,
      MinThreshold: Number(this.minThreshold) || 0,
      BuyingPrice: Number(this.buyingPrice) || 0,
      Location: this.location
    };

    if (this.isEditMode) {
      this.inventoryService.updateItem(code, payload).subscribe({
        next: () => {
          this.toastService.success(`Item "${name}" updated successfully.`);
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          this.toastService.error('Error updating item: ' + (err.message || 'Server error'));
        }
      });
    } else {
      this.inventoryService.saveItem(payload).subscribe({
        next: () => {
          this.toastService.success(`Item "${name}" registered successfully.`);
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          this.toastService.error('Error registering item: ' + (err.message || 'Server error'));
        }
      });
    }
  }
}
