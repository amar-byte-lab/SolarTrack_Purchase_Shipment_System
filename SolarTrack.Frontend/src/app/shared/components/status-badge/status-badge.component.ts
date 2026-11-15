import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span 
      class="badge d-inline-flex align-items-center gap-1 border"
      [ngClass]="badgeClass"
      [style.font-size]="fontSize">
      <span class="status-dot">●</span>
      <span>{{ label || status }}</span>
    </span>
  `,
  styles: [`
    .badge {
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      line-height: 1.2;
    }
    .status-dot {
      font-size: 0.65rem;
    }
    .badge-success-theme {
      background-color: #ecfdf5 !important;
      color: #065f46 !important;
      border-color: #a7f3d0 !important;
    }
    .badge-danger-theme {
      background-color: #fef2f2 !important;
      color: #991b1b !important;
      border-color: #fecaca !important;
    }
    .badge-warning-theme {
      background-color: #fffbeb !important;
      color: #92400e !important;
      border-color: #fde68a !important;
    }
    .badge-info-theme {
      background-color: #eef2ff !important;
      color: #3730a3 !important;
      border-color: #c7d2fe !important;
    }
    .badge-secondary-theme {
      background-color: #f1f5f9 !important;
      color: #475569 !important;
      border-color: #cbd5e1 !important;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: string = '';
  @Input() label?: string;
  @Input() fontSize: string = '0.75rem';

  get badgeClass(): string {
    const s = (this.status || '').toLowerCase().trim();
    if (['approved', 'done', 'completed', 'delivered', 'active', 'due', 'ok', 'settled'].includes(s)) {
      return 'badge-success-theme';
    }
    if (['rejected', 'cancelled', 'advance', 'overdue', 'failed'].includes(s)) {
      return 'badge-danger-theme';
    }
    if (['pending', 'in progress', 'working', 'dispatched'].includes(s)) {
      return 'badge-warning-theme';
    }
    if (['in transit', 'employee', 'admin', 'partner'].includes(s)) {
      return 'badge-info-theme';
    }
    return 'badge-secondary-theme';
  }
}
