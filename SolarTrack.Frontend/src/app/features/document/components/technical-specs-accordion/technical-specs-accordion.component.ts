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
    const count = Math.max(1, Math.min(48, Number(this.specs.moduleCount) || 1));
    this.specs.moduleCount = count;

    const capEach = Number(this.specs.moduleCapacityEach) || 545;
    const totalKWp = ((count * capEach) / 1000).toFixed(2);
    this.specs.moduleTotalCapacity = `${totalKWp} kWp`;

    const existingSerials = this.specs.moduleSerials || [];
    const prefix = this.customer?.ConsumerNo ? this.customer.ConsumerNo.slice(-4) : '7721';
    const newSerials: ModuleSerialItem[] = [];

    for (let i = 1; i <= count; i++) {
      const found = existingSerials.find(s => s.index === i);
      if (found) {
        newSerials.push(found);
      } else {
        newSerials.push({
          index: i,
          serialNo: `SLM${prefix}${String(i).padStart(3, '0')}`,
          capacity: capEach
        });
      }
    }
    this.specs.moduleSerials = newSerials;
    this.emitChange();
  }

  regenerateSerials(): void {
    const count = Number(this.specs.moduleCount) || 6;
    const capEach = Number(this.specs.moduleCapacityEach) || 545;
    const prefix = this.customer?.ConsumerNo ? this.customer.ConsumerNo.slice(-4) : '7721';
    const list: ModuleSerialItem[] = [];

    for (let i = 1; i <= count; i++) {
      list.push({
        index: i,
        serialNo: `SLM${prefix}${String(i).padStart(3, '0')}`,
        capacity: capEach
      });
    }
    this.specs.moduleSerials = list;
    this.emitChange();
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
