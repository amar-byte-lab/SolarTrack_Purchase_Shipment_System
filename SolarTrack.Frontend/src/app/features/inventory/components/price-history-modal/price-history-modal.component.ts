import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryItemWithStock, InventoryInwardRow } from '../../models/inventory.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

interface PricePoint {
  id: string;
  date: string;
  supplier: string;
  rate: number;
  qty: number;
  totalCost: number;
  diff: number | null;
  x: number;
  y: number;
}

@Component({
  selector: 'app-price-history-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './price-history-modal.component.html',
  styleUrls: ['./price-history-modal.component.scss']
})
export class PriceHistoryModalComponent {
  @Input() item: InventoryItemWithStock | null = null;
  @Input() inwards: InventoryInwardRow[] = [];
  @Output() close = new EventEmitter<void>();

  readonly width = 760;
  readonly height = 260;
  readonly paddingLeft = 70;
  readonly paddingRight = 60;
  readonly paddingTop = 45;
  readonly paddingBottom = 40;

  priceData = computed(() => {
    if (!this.item) return { points: [], polyline: '', areaPolygon: '', gridLevels: [] };

    const itemCode = (this.item.ItemCode || '').toLowerCase();
    const itemInwards = this.inwards
      .filter(inw => (inw.ItemCode || '').toLowerCase() === itemCode)
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

    let rawPoints: { id: string; date: string; supplier: string; rate: number; qty: number; totalCost: number }[] = [];

    if (itemInwards.length > 0) {
      rawPoints = itemInwards.map(inw => {
        const rate = Number(inw.CostPerUnit) || Number(inw.UnitPrice) || Number(this.item?.BuyingPrice) || 0;
        const qty = Number(inw.Quantity) || 0;
        const total = Number(inw.TotalCost) || (rate * qty);
        return {
          id: inw.InwardID,
          date: inw.Date,
          supplier: inw.Supplier || inw.Remarks || 'Consignment Inward',
          rate,
          qty,
          totalCost: total
        };
      });
    } else {
      rawPoints = [{
        id: 'BASE',
        date: new Date().toISOString().slice(0, 10),
        supplier: 'Catalog Base Rate (Initial)',
        rate: Number(this.item.BuyingPrice) || 0,
        qty: 0,
        totalCost: 0
      }];
    }

    const rates = rawPoints.map(p => p.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);

    const plotW = this.width - this.paddingLeft - this.paddingRight;
    const plotH = this.height - this.paddingTop - this.paddingBottom;

    let yMin = minRate;
    let yMax = maxRate;
    if (yMin === yMax) {
      yMin = Math.max(0, Math.floor(yMin * 0.85));
      yMax = Math.ceil((yMax * 1.15) || 100);
    } else {
      const diff = yMax - yMin;
      yMin = Math.max(0, Math.floor(yMin - diff * 0.20));
      yMax = Math.ceil(yMax + diff * 0.25);
    }

    const getY = (val: number) => {
      const pct = (val - yMin) / (yMax - yMin || 1);
      return this.paddingTop + plotH - (pct * plotH);
    };

    const getX = (idx: number) => {
      if (rawPoints.length === 1) return this.paddingLeft + plotW / 2;
      return this.paddingLeft + (idx / (rawPoints.length - 1)) * plotW;
    };

    const points: PricePoint[] = rawPoints.map((p, idx) => {
      const prev = idx > 0 ? rawPoints[idx - 1] : null;
      const diff = prev ? Math.round((p.rate - prev.rate) * 100) / 100 : null;
      return {
        ...p,
        diff,
        x: getX(idx),
        y: getY(p.rate)
      };
    });

    const gridVals = [yMin, yMin + (yMax - yMin) * 0.5, yMax];
    const gridLevels = gridVals.map(val => ({
      val: Math.round(val),
      y: getY(val)
    }));

    const pointsStr = points.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const bottomY = this.paddingTop + plotH;
    const areaPolygon = points.length > 0 
      ? `${points[0].x.toFixed(1)},${bottomY.toFixed(1)} ${pointsStr} ${points[points.length - 1].x.toFixed(1)},${bottomY.toFixed(1)}` 
      : '';

    return {
      points,
      polyline: pointsStr,
      areaPolygon,
      gridLevels
    };
  });

  formatDate(d: string): string {
    if (!d || d === 'CATALOG-INIT') return 'Catalog';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0].slice(2)}`;
    return d;
  }
}
