import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryItemWithStock, InventoryInwardRow } from '../../models/inventory.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';

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
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './price-history-modal.component.html',
  styleUrls: ['./price-history-modal.component.scss']
})
export class PriceHistoryModalComponent {
  @Input() item: InventoryItemWithStock | null = null;
  @Input() inwards: InventoryInwardRow[] = [];
  @Output() close = new EventEmitter<void>();

  private invService = inject(InventoryService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);

  readonly width = 700;
  readonly height = 250;
  readonly paddingLeft = 70;
  readonly paddingRight = 60;
  readonly paddingTop = 45;
  readonly paddingBottom = 45;

  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  editDraft = {
    id: '',
    date: '',
    supplier: '',
    qty: 0,
    rate: 0
  };

  currentItem = computed(() => {
    if (!this.item) return null;
    const code = (this.item.ItemCode || '').toLowerCase();
    const live = this.invService.itemsWithStock().find(i => i.ItemCode.toLowerCase() === code);
    return live || this.item;
  });

  priceData = computed(() => {
    const itm = this.currentItem();
    if (!itm) return { points: [], polyline: '', areaPolygon: '', gridLevels: [], latestRate: 0 };

    const itemCode = (itm.ItemCode || '').toLowerCase();
    const allInwards = this.invService.rawInwards().length > 0 ? this.invService.rawInwards() : this.inwards;
    const itemInwards = allInwards
      .filter(inw => (inw.ItemCode || '').toLowerCase() === itemCode)
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

    let rawPoints: { id: string; date: string; supplier: string; rate: number; qty: number; totalCost: number }[] = [];

    if (itemInwards.length > 0) {
      rawPoints = itemInwards.map(inw => {
        const rate = Number(inw.CostPerUnit) || Number(inw.UnitPrice) || Number(itm.BuyingPrice) || 0;
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
        rate: Number(itm.BuyingPrice) || 0,
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
      gridLevels,
      latestRate: rawPoints[rawPoints.length - 1]?.rate ?? 0
    };
  });

  startEdit(pt: PricePoint): void {
    this.editDraft = {
      id: pt.id,
      date: pt.date,
      supplier: pt.supplier,
      qty: pt.qty,
      rate: pt.rate
    };
    this.editingId.set(pt.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(): void {
    const itm = this.currentItem();
    if (!itm) return;
    const draft = this.editDraft;
    const rateNum = Number(draft.rate);
    const qtyNum = Number(draft.qty);

    if (isNaN(rateNum) || rateNum <= 0) {
      this.toastService.warning('Please enter a valid rate.');
      return;
    }

    this.isSaving.set(true);

    if (draft.id === 'BASE') {
      this.invService.updateItem(itm.ItemCode, { BuyingPrice: rateNum }).subscribe({
        next: () => {
          this.toastService.success('Catalog base rate updated.');
          this.editingId.set(null);
          this.isSaving.set(false);
          this.invService.loadAllData().subscribe();
        },
        error: (err) => {
          this.toastService.error('Failed to update rate: ' + (err?.message || 'Server error'));
          this.isSaving.set(false);
        }
      });
    } else {
      this.invService.updateInwardRecord(itm.ItemCode, draft.id, {
        date: draft.date,
        supplier: draft.supplier.trim() || 'Supplier',
        qty: isNaN(qtyNum) ? 0 : qtyNum,
        rate: rateNum
      }).subscribe({
        next: () => {
          this.toastService.success('Purchase record updated.');
          this.editingId.set(null);
          this.isSaving.set(false);
        },
        error: (err) => {
          this.toastService.error('Failed to update record: ' + (err?.message || 'Server error'));
          this.isSaving.set(false);
        }
      });
    }
  }

  async deleteRecord(pt: PricePoint): Promise<void> {
    const itm = this.currentItem();
    if (!itm) return;

    if (pt.id === 'BASE') {
      this.toastService.info('Base catalog rate cannot be deleted. You can edit its rate.');
      return;
    }

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Purchase Record',
      message: `Delete purchase record of ₹${pt.rate} from "${pt.supplier}" on ${this.formatDate(pt.date)}? Warehouse stock will be adjusted.`,
      confirmText: 'Delete Record'
    });

    if (!confirmed) return;

    this.isSaving.set(true);
    this.invService.deleteInwardRecord(itm.ItemCode, pt.id).subscribe({
      next: () => {
        this.toastService.success('Purchase record deleted.');
        this.isSaving.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to delete record: ' + (err?.message || 'Server error'));
        this.isSaving.set(false);
      }
    });
  }

  formatDate(d: string): string {
    if (!d || d === 'CATALOG-INIT') return 'Catalog';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0].slice(2)}`;
    return d;
  }
}
