import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalculatorService } from '../../services/calculator.service';
import { SystemType } from '../../models/calculator.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-schematic-viewer-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './schematic-viewer-modal.component.html',
  styleUrls: ['./schematic-viewer-modal.component.scss']
})
export class SchematicViewerModalComponent {
  protected calc = inject(CalculatorService);
  @Output() close = new EventEmitter<void>();

  currentSystem = signal<SystemType>(this.calc.systemType());
  zoomLevel = signal<number>(1);

  setSystem(type: SystemType): void {
    this.currentSystem.set(type);
  }

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(1.8, Math.round((z + 0.15) * 100) / 100));
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
  }
}
