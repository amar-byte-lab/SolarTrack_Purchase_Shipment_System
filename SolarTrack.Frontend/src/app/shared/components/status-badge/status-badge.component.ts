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
      font-family: var(--st-font-mono, monospace);
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 4px 10px;
      border-radius: var(--st-radius-pill, 999px);
      line-height: 1.2;
    }
    .status-dot {
      font-size: 0.6rem;
    }
    .badge-success-theme {
      background-color: var(--st-success-light, #ecfdf5) !important;
      color: var(--st-success-dark, #065f46) !important;
      border-color: #a7f3d0 !important;
    }
    .badge-danger-theme {
      background-color: var(--st-danger-light, #fef2f2) !important;
      color: var(--st-danger-dark, #991b1b) !important;
      border-color: #fecaca !important;
    }
    .badge-warning-theme {
      background-color: var(--st-warning-light, #fffbeb) !important;
      color: var(--st-warning-dark, #92400e) !important;
      border-color: #fde68a !important;
    }
    .badge-info-theme {
      background-color: var(--st-primary-light, #fff2ed) !important;
      color: var(--st-primary, #ff4500) !important;
      border-color: rgba(255, 69, 0, 0.25) !important;
    }
    .badge-secondary-theme {
      background-color: var(--st-surface-raised, #eeece7) !important;
      color: var(--st-text-secondary, #545f46) !important;
      border-color: var(--st-border, #e5e2dc) !important;
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
