import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TechnicalProductSpecs, ModuleSerialItem } from '../../models/document.model';
import { InstallmentRow } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-product-specs-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-specs-modal.component.html',
  styleUrls: ['./product-specs-modal.component.scss']
})
export class ProductSpecsModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() customer: InstallmentRow | null = null;
  @Input() specs: TechnicalProductSpecs = {};

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<TechnicalProductSpecs>();

  activeTab: 'general' | 'inverter' | 'module' | 'distribution' | 'cables' = 'general';
  tempSpecs: TechnicalProductSpecs = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['specs'] || changes['customer'] || changes['isOpen']) {
      if (this.isOpen) {
        this.tempSpecs = JSON.parse(JSON.stringify(this.specs || {}));
        this.activeTab = 'general';
      }
    }
  }

  setTab(tab: 'general' | 'inverter' | 'module' | 'distribution' | 'cables'): void {
    this.activeTab = tab;
  }

  onModuleCountChange(): void {
    const count = Math.max(1, Math.min(48, Number(this.tempSpecs.moduleCount) || 1));
    const capEach = Number(this.tempSpecs.moduleCapacityEach) || 545;
    const prefix = this.customer?.ConsumerNo ? this.customer.ConsumerNo.slice(-4) : '7721';

    const currentSerials = this.tempSpecs.moduleSerials || [];
    const newSerials: ModuleSerialItem[] = [];

    for (let i = 1; i <= count; i++) {
      const existing = currentSerials.find(s => s.index === i);
      if (existing) {
        newSerials.push(existing);
      } else {
        newSerials.push({
          index: i,
          serialNo: `SLM${prefix}${String(i).padStart(3, '0')}`,
          capacity: capEach
        });
      }
    }

    const totalKw = (count * capEach / 1000).toFixed(2);
    this.tempSpecs.moduleCount = count;
    this.tempSpecs.moduleSerials = newSerials;
    this.tempSpecs.moduleTotalCapacity = `${totalKw} kWp`;
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    this.save.emit(this.tempSpecs);
  }
}
