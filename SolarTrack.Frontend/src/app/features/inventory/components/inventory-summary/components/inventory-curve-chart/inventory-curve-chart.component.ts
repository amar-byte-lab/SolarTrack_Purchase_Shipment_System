import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonthlyFinancialPoint } from '../../../../models/inventory.model';
import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

export interface ChartSeriesConfig {
  key: 'totalTurnover' | 'dispatchedCost' | 'warehouseValuation' | 'transportationCost';
  label: string;
  color: string;
  accentBg: string;
  gradientId: string;
  visible: boolean;
  description: string;
}

export interface ChartPointCoord {
  x: number;
  y: number;
  value: number;
}

export interface MonthSeriesPoint {
  monthKey: string;
  monthLabel: string;
  x: number;
  points: { [key: string]: ChartPointCoord };
}

@Component({
  selector: 'app-inventory-curve-chart',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './inventory-curve-chart.component.html',
  styleUrls: ['./inventory-curve-chart.component.scss']
})
export class InventoryCurveChartComponent {
  @Input() monthlyData: MonthlyFinancialPoint[] = [];
  @Input() isLoading: boolean = false;

  readonly viewBoxWidth = 920;
  readonly viewBoxHeight = 330;
  readonly padLeft = 70;
  readonly padRight = 30;
  readonly padTop = 25;
  readonly padBottom = 45;

  readonly seriesList = signal<ChartSeriesConfig[]>([
    {
      key: 'totalTurnover',
      label: 'Total Project Turnover',
      color: '#ff4500',
      accentBg: 'rgba(255, 69, 0, 0.12)',
      gradientId: 'gradTurnover',
      visible: true,
      description: 'Customer project value & order bookings'
    },
    {
      key: 'dispatchedCost',
      label: 'Dispatched Material Cost',
      color: '#f59e0b',
      accentBg: 'rgba(245, 158, 11, 0.12)',
      gradientId: 'gradDispatched',
      visible: true,
      description: 'Equipment delivered and installed at project sites'
    },
    {
      key: 'warehouseValuation',
      label: 'Warehouse Valuation',
      color: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.12)',
      gradientId: 'gradValuation',
      visible: true,
      description: 'Cumulative stock sitting in physical godown inventory'
    },
    {
      key: 'transportationCost',
      label: 'Transportation Cost',
      color: '#0284c7',
      accentBg: 'rgba(2, 132, 199, 0.12)',
      gradientId: 'gradTransport',
      visible: true,
      description: 'Freight, inter-state transit and site logistics expenses'
    }
  ]);

  readonly activeHoverIndex = signal<number | null>(null);
  readonly hoveredSeriesKey = signal<string | null>(null);

  get innerWidth(): number {
    return this.viewBoxWidth - this.padLeft - this.padRight;
  }

  get innerHeight(): number {
    return this.viewBoxHeight - this.padTop - this.padBottom;
  }

  get baselineY(): number {
    return this.viewBoxHeight - this.padBottom;
  }

  // Maximum value across active series for dynamic Y-scaling
  readonly maxVal = computed<number>(() => {
    const data = this.monthlyData;
    const series = this.seriesList().filter(s => s.visible);
    if (!data || data.length === 0 || series.length === 0) return 100000;

    let max = 0;
    data.forEach(d => {
      series.forEach(s => {
        const val = Number((d as any)[s.key]) || 0;
        if (val > max) max = val;
      });
    });

    if (max <= 0) return 100000;
    return max * 1.15; // 15% head room
  });

  // 5 Y-Axis ticks
  readonly yTicks = computed<Array<{ val: number; label: string; y: number }>>(() => {
    const max = this.maxVal();
    const count = 4; // 0, 1/3, 2/3, max
    const ticks: Array<{ val: number; label: string; y: number }> = [];

    for (let i = 0; i <= count; i++) {
      const v = (max / count) * i;
      const y = this.baselineY - (v / max) * this.innerHeight;
      ticks.push({
        val: v,
        label: this.formatCurrencyAbbr(v),
        y
      });
    }
    return ticks;
  });

  // Series totals for legend summary
  getSeriesTotal(key: string): number {
    if (!this.monthlyData) return 0;
    if (key === 'warehouseValuation') {
      // For valuation, return the peak or latest valuation
      const vals = this.monthlyData.map(d => d.warehouseValuation || 0);
      return vals.length > 0 ? vals[vals.length - 1] : 0;
    }
    return this.monthlyData.reduce((sum, d) => sum + (Number((d as any)[key]) || 0), 0);
  }

  // Calculate coordinates for all data points
  readonly pointCoords = computed<MonthSeriesPoint[]>(() => {
    const data = this.monthlyData;
    if (!data || data.length === 0) return [];
    const max = this.maxVal();
    const n = data.length;
    const step = n > 1 ? this.innerWidth / (n - 1) : 0;

    return data.map((d, i) => {
      const x = n > 1 ? this.padLeft + i * step : this.padLeft + this.innerWidth / 2;
      const points: { [key: string]: ChartPointCoord } = {};

      this.seriesList().forEach(s => {
        const val = Number((d as any)[s.key]) || 0;
        const y = this.baselineY - (val / max) * this.innerHeight;
        points[s.key] = { x, y, value: val };
      });

      return {
        monthKey: d.monthKey,
        monthLabel: d.monthLabel,
        x,
        points
      };
    });
  });

  // Generate smooth cubic Bézier spline curve path
  getSplinePath(key: string): string {
    const coords = this.pointCoords();
    if (!coords || coords.length === 0) return '';
    const points = coords.map(c => c.points[key]);
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 1} ${points[0].y}`;
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      // Catmull-Rom to Cubic Bézier conversion factor (1/6 = ~0.1667)
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;

      // Prevent control points dipping below chart baseline
      cp1y = Math.min(this.baselineY, cp1y);
      cp2y = Math.min(this.baselineY, cp2y);

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  // Generate closed area path for smooth gradient fill under the curve
  getAreaPath(key: string): string {
    const spline = this.getSplinePath(key);
    if (!spline) return '';
    const coords = this.pointCoords();
    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    return `${spline} L ${lastX.toFixed(1)} ${this.baselineY} L ${firstX.toFixed(1)} ${this.baselineY} Z`;
  }

  toggleSeries(key: string): void {
    this.seriesList.update(list =>
      list.map(s => (s.key === key ? { ...s, visible: !s.visible } : s))
    );
  }

  onMouseMove(event: MouseEvent): void {
    const coords = this.pointCoords();
    if (!coords || coords.length === 0) return;

    const svgRect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    const svgX = (mouseX / svgRect.width) * this.viewBoxWidth;

    // Find closest month coordinate
    let closestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    this.activeHoverIndex.set(closestIdx);
  }

  onMouseLeave(): void {
    this.activeHoverIndex.set(null);
    this.hoveredSeriesKey.set(null);
  }

  formatCurrencyAbbr(val: number): string {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${Math.round(val / 1000)}k`;
    return `₹${Math.round(val)}`;
  }
}
