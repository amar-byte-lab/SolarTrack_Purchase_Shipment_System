import { Component, EventEmitter, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorService } from '../../services/calculator.service';
import { SystemType, SupplyPhase } from '../../models/calculator.model';

@Component({
  selector: 'app-system-type-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-type-selector.component.html',
  styleUrls: ['./system-type-selector.component.scss']
})
export class SystemTypeSelectorComponent {
  readonly calc = inject(CalculatorService);

  @Output() openSchematic = new EventEmitter<void>();

  readonly isDropdownOpen = signal<boolean>(false);

  readonly currentSystemMeta = computed(() => {
    const type = this.calc.systemType();
    switch (type) {
      case 'off-grid':
        return {
          title: 'Off-Grid Solar',
          desc: 'Solar with battery storage for off-grid power.'
        };
      case 'on-grid':
        return {
          title: 'On-Grid Solar',
          desc: 'Direct grid-tied net-metering solar without batteries.'
        };
      case 'hybrid':
        return {
          title: 'Hybrid Solar',
          desc: 'Solar + Grid + Battery backup combined smartly.'
        };
      case 'without-solar':
        return {
          title: 'Without Solar (Home UPS)',
          desc: 'Inverter + Battery bank for power backup from grid.'
        };
      default:
        return {
          title: 'Off-Grid Solar',
          desc: 'Solar with battery storage for off-grid power.'
        };
    }
  });

  toggleDropdown() {
    this.isDropdownOpen.update(v => !v);
  }

  selectSystem(type: SystemType) {
    this.calc.setSystemType(type);
    this.isDropdownOpen.set(false);
  }

  onPhaseChange(phase: SupplyPhase) {
    this.calc.setPhase(phase);
  }

  onSanctionedLoadChange(kw: any) {
    this.calc.setSanctionedLoad(Number(kw) || 3);
  }
}
