import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryKpiSummary } from '../../models/inventory.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventorySummaryComponent } from '../inventory-summary/inventory-summary.component';

@Component({
  selector: 'app-inventory-summary-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, InventorySummaryComponent],
  templateUrl: './inventory-summary-modal.component.html',
  styleUrls: ['./inventory-summary-modal.component.scss']
})
export class InventorySummaryModalComponent {
  @Input() kpis: InventoryKpiSummary | null = null;
  @Output() close = new EventEmitter<void>();
}
