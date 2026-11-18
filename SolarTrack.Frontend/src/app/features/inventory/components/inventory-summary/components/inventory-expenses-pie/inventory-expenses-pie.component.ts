import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesSummary, ExpenseBreakdownItem } from '../../../../models/inventory.model';
import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

export interface PieSliceArc {
  item: ExpenseBreakdownItem;
  pathData: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  isHovered: boolean;
}

@Component({
  selector: 'app-inventory-expenses-pie',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './inventory-expenses-pie.component.html',
  styleUrls: ['./inventory-expenses-pie.component.scss']
})
export class InventoryExpensesPieComponent {
  @Input() expensesSummary: ExpensesSummary | null = null;
  @Input() isLoading: boolean = false;

  readonly center = 160;
  readonly outerRadius = 120;
  readonly innerRadius = 76;

  readonly activeHoverId = signal<string | null>(null);

  get summary(): ExpensesSummary {
    if (this.expensesSummary && this.expensesSummary.totalExpenses > 0) {
      return this.expensesSummary;
    }
    // Fallback default structure
    return {
      materialCost: 0,
      transportationCost: 0,
      installationCost: 0,
      otherCost: 0,
      totalExpenses: 0,
      items: [
        { id: 'material', label: 'Material Cost', amount: 0, percentage: 0, color: '#6366f1', accentBg: 'rgba(99, 102, 241, 0.12)', icon: 'boxes', description: 'Equipment & panels' },
        { id: 'transportation', label: 'Transportation Cost', amount: 0, percentage: 0, color: '#0284c7', accentBg: 'rgba(2, 132, 199, 0.12)', icon: 'truck', description: 'Transit & freight' },
        { id: 'installation', label: 'Installation Cost', amount: 0, percentage: 0, color: '#f59e0b', accentBg: 'rgba(245, 158, 11, 0.12)', icon: 'zap', description: 'Civil & mounting' },
        { id: 'other', label: 'Other Cost', amount: 0, percentage: 0, color: '#10b981', accentBg: 'rgba(16, 185, 129, 0.12)', icon: 'wallet', description: 'Statutory fees & meter' }
      ]
    };
  }

  // Pre-calculated SVG donut arc paths
  readonly slices = computed<PieSliceArc[]>(() => {
    const s = this.summary;
    const total = s.totalExpenses;
    if (total <= 0 || !s.items || s.items.length === 0) return [];

    let currentAngle = -Math.PI / 2; // Start at 12 o'clock
    const result: PieSliceArc[] = [];

    // Filter items with amount > 0 for drawing
    const activeItems = s.items.filter(item => item.amount > 0);
    if (activeItems.length === 0) return [];

    activeItems.forEach(item => {
      const sliceAngle = (item.amount / total) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      const midAngle = (startAngle + endAngle) / 2;

      // Calculate path
      const pathData = this.describeDonutArc(this.center, this.center, this.innerRadius, this.outerRadius, startAngle, endAngle);

      result.push({
        item,
        pathData,
        startAngle,
        endAngle,
        midAngle,
        isHovered: this.activeHoverId() === item.id
      });

      currentAngle = endAngle;
    });

    return result;
  });

  readonly hoveredItem = computed<ExpenseBreakdownItem | null>(() => {
    const id = this.activeHoverId();
    if (!id) return null;
    return this.summary.items.find(i => i.id === id) || null;
  });

  onSliceHover(id: string): void {
    this.activeHoverId.set(id);
  }

  onSliceLeave(): void {
    this.activeHoverId.set(null);
  }

  // Polar to Cartesian coordinate converter
  private polarToCartesian(cx: number, cy: number, radius: number, angleInRadians: number): { x: number; y: number } {
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians)
    };
  }

  // Generate SVG Donut Arc Path: M outerStart A outerEnd L innerEnd A innerStart Z
  private describeDonutArc(
    cx: number,
    cy: number,
    rInner: number,
    rOuter: number,
    startAngle: number,
    endAngle: number
  ): string {
    // If arc is full circle (single category has 100%), draw slightly less to prevent SVG 360 wrap glitch
    if (endAngle - startAngle >= 2 * Math.PI - 0.0001) {
      endAngle = startAngle + 2 * Math.PI - 0.0001;
    }

    const outerStart = this.polarToCartesian(cx, cy, rOuter, startAngle);
    const outerEnd = this.polarToCartesian(cx, cy, rOuter, endAngle);
    const innerEnd = this.polarToCartesian(cx, cy, rInner, endAngle);
    const innerStart = this.polarToCartesian(cx, cy, rInner, startAngle);

    const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

    return [
      `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
      `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
      'Z'
    ].join(' ');
  }
}
