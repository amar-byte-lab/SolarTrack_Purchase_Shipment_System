import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { TechnicalProductSpecs, ModuleSerialItem } from '../../models/document.model';

@Component({
  selector: 'app-technical-specs-accordion',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './technical-specs-accordion.component.html',
  styleUrls: ['./technical-specs-accordion.component.scss']
})
export class TechnicalSpecsAccordionComponent implements OnInit {
  @Input() specs: TechnicalProductSpecs = {};
  @Input() customer: InstallmentRow | null = null;
  @Input() readOnly: boolean = false;
  @Input() showActions: boolean = false;

  @Output() specsChange = new EventEmitter<TechnicalProductSpecs>();
  @Output() saveSpecs = new EventEmitter<TechnicalProductSpecs>();
  @Output() resetSpecs = new EventEmitter<void>();

  // Only one section open at a time
  activeSection: string | null = 'site';

  ngOnInit(): void {
    if (!this.specs) {
      this.specs = {};
    }
  }

  toggleSection(sectionKey: string): void {
    if (this.activeSection === sectionKey) {
      this.activeSection = null;
    } else {
      this.activeSection = sectionKey;
    }
  }

  isSectionOpen(sectionKey: string): boolean {
    return this.activeSection === sectionKey;
  }

  onModuleCountChange(): void {
    const raw = Number(this.specs.moduleCount);
    if (!raw || raw < 1) {
      this.specs.moduleSerials = [];
      this.specs.moduleTotalCapacity = '';
      this.emitChange();
      return;
    }
    const count = Math.min(48, raw);
    this.specs.moduleCount = count;

    const existingSerials = this.specs.moduleSerials || [];
    const newSerials: ModuleSerialItem[] = [];

    for (let i = 1; i <= count; i++) {
      const found = existingSerials.find(s => s.index === i);
      if (found) {
        newSerials.push(found);
      } else {
        newSerials.push({
          index: i,
          serialNo: '',
          capacity: 0
        });
      }
    }
    this.specs.moduleSerials = newSerials;
    this.recalculateTotalCapacity();
    this.emitChange();
  }

  onSerialCapacityChange(): void {
    this.recalculateTotalCapacity();
    this.emitChange();
  }

  recalculateTotalCapacity(): void {
    if (this.specs.moduleSerials && this.specs.moduleSerials.length > 0) {
      const totalWp = this.specs.moduleSerials.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0);
      if (totalWp > 0) {
        this.specs.moduleTotalCapacity = `${(totalWp / 1000).toFixed(2)} kWp`;
      }
    }
  }

  emitChange(): void {
    this.specsChange.emit(this.specs);
  }

  onSave(): void {
    this.saveSpecs.emit(this.specs);
  }

  onReset(): void {
    this.resetSpecs.emit();
  }
}
