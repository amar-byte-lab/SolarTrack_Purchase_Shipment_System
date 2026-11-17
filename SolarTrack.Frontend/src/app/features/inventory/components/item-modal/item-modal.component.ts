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
        this.itemCode = '';
        this.itemName = '';
        this.category = this.defaultCategory || 'Panels';
        this.unit = 'Nos';
        this.minThreshold = 5;
        this.buyingPrice = 0;
        this.location = 'Main Godown';
      }
    }
  }

  private generateItemCode(category: string, name: string): string {
    const catUpper = (category || '').trim().toUpperCase();
    let catCode = 'GEN';
    if (catUpper.includes('PANEL')) catCode = 'PV';
    else if (catUpper.includes('INVERT')) catCode = 'INV';
    else if (catUpper.includes('CABLE')) catCode = 'CAB';
    else if (catUpper.includes('STRUCT')) catCode = 'STR';
    else if (catUpper.includes('HARDWARE')) catCode = 'HDW';
    else if (catUpper.includes('ELECT')) catCode = 'ELE';
    else if (catUpper.includes('CONDUIT')) catCode = 'CND';
    else if (catUpper.includes('EARTH')) catCode = 'EAR';
    else {
      const clean = catUpper.replace(/[^A-Z0-9]/g, '').slice(0, 3);
      if (clean) catCode = clean;
    }

    const existingCodes = new Set(
      this.inventoryService.rawItems().map(i => (i.ItemCode || '').toUpperCase().trim())
    );

    // Extract useful alphanumeric keyword / rating from name (e.g. 540W, 3kW, 4SQ, etc.)
    const words = name.trim().split(/\s+/).filter(w => Boolean(w));
    let tag = '';
    for (const w of words) {
      if (/\d/.test(w)) {
        tag = w.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        break;
      }
    }
    if (!tag && words.length > 0) {
      tag = words[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    }

    const basePrefix = tag ? `SKU-${catCode}-${tag}` : `SKU-${catCode}`;

    let candidate = basePrefix;
    if (existingCodes.has(candidate.toUpperCase())) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      candidate = `${basePrefix}-${randomSuffix}`;
      while (existingCodes.has(candidate.toUpperCase())) {
        candidate = `${basePrefix}-${Date.now().toString().slice(-4)}`;
      }
    }

    return candidate;
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
    const name = this.itemName.trim();
    if (!name) {
      this.toastService.warning('Please enter the Equipment Item Name.');
      return;
    }

    let code = this.itemCode?.trim();
    if (!this.isEditMode || !code) {
      code = this.generateItemCode(this.category, name);
      this.itemCode = code;
    }

    const payload: InventoryItem = {
      ItemCode: code,
      ItemName: name,
      Category: this.category,
      Unit: this.unit,
      MinThreshold: Number(this.minThreshold) || 0,
      BuyingPrice: Number(this.buyingPrice) || 0,
      Location: this.location || 'Main Godown'
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
