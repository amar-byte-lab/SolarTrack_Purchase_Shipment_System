import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryKpiSummary, MonthlyFinancialPoint, ExpensesSummary } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryCurveChartComponent } from './components/inventory-curve-chart/inventory-curve-chart.component';
import { InventoryExpensesPieComponent } from './components/inventory-expenses-pie/inventory-expenses-pie.component';

@Component({
  selector: 'app-inventory-summary',
  standalone: true,
  imports: [
    CommonModule, 
    IconComponent, 
    InventoryCurveChartComponent, 
    InventoryExpensesPieComponent
  ],
  templateUrl: './inventory-summary.component.html',
  styleUrls: ['./inventory-summary.component.scss']
})
export class InventorySummaryComponent {
  invService = inject(InventoryService);

  @Input() kpis: InventoryKpiSummary | null = null;
  @Input() showHeader: boolean = true;
  @Input() showCharts: boolean = true;

  get resolvedKpis(): InventoryKpiSummary {
    return this.kpis || this.invService.kpis();
  }

  get monthlyData(): MonthlyFinancialPoint[] {
    return this.invService.monthlyFinancials();
  }

  get expensesSummary(): ExpensesSummary {
    return this.invService.expensesBreakdown();
  }

  refresh(): void {
    this.invService.loadAllData().subscribe();
  }
}
