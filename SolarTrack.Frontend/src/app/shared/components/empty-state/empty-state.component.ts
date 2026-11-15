import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state-wrapper text-center py-5 px-3">
      <div class="empty-icon-box mb-2">
        <span class="fs-1">{{ icon }}</span>
      </div>
      <h6 class="fw-bold text-dark fs-7 mb-1">{{ title }}</h6>
      @if (description) {
        <p class="text-muted fs-8 mb-3 mx-auto" style="max-width: 420px;">{{ description }}</p>
      }
      @if (actionText) {
        <button 
          type="button" 
          class="btn btn-sm btn-primary fw-semibold" 
          (click)="actionClick.emit()">
          {{ actionText }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state-wrapper {
      background: #ffffff;
      border-radius: 6px;
    }
    .empty-icon-box {
      opacity: 0.85;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon: string = '📦';
  @Input() title: string = 'No records found';
  @Input() description?: string;
  @Input() actionText?: string;
  @Output() actionClick = new EventEmitter<void>();
}
