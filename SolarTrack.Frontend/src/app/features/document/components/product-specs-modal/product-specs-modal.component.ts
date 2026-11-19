import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TechnicalProductSpecs } from '../../models/document.model';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { TechnicalSpecsAccordionComponent } from '../technical-specs-accordion/technical-specs-accordion.component';

@Component({
  selector: 'app-product-specs-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TechnicalSpecsAccordionComponent],
  templateUrl: './product-specs-modal.component.html',
  styleUrls: ['./product-specs-modal.component.scss']
})
export class ProductSpecsModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() customer: InstallmentRow | null = null;
  @Input() specs: TechnicalProductSpecs = {};

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<TechnicalProductSpecs>();

  tempSpecs: TechnicalProductSpecs = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['specs'] || changes['customer'] || changes['isOpen']) {
      if (this.isOpen) {
        this.tempSpecs = JSON.parse(JSON.stringify(this.specs || {}));
      }
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    this.save.emit(this.tempSpecs);
  }
}
