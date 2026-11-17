import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryKpiSummary } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-inventory-summary',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './inventory-summary.component.html',
  styleUrls: ['./inventory-summary.component.scss']
})
export class InventorySummaryComponent {
  invService = inject(InventoryService);

  @Input() kpis: InventoryKpiSummary | null = null;
  @Input() showHeader: boolean = true;

  get resolvedKpis(): InventoryKpiSummary {
    return this.kpis || this.invService.kpis();
  }

  refresh(): void {
    this.invService.loadAllData().subscribe();
  }
}
