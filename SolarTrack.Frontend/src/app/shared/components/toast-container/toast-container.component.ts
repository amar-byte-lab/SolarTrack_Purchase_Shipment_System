import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 2500;">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="toast show align-items-center border-0 mb-2 shadow-md"
          [ngClass]="getToastBg(toast.type)"
          role="alert" 
          aria-live="assertive" 
          aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2 fs-8">
              <span>{{ getToastIcon(toast.type) }}</span>
              <span>{{ toast.message }}</span>
            </div>
            <button 
              type="button" 
              class="btn-close btn-close-white me-2 m-auto" 
              (click)="toastService.remove(toast.id)"
              aria-label="Close"></button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      max-width: 380px;
    }
    .toast {
      border-radius: 6px;
      font-weight: 500;
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);

  getToastBg(type: string): string {
    switch (type) {
      case 'success': return 'text-bg-success';
      case 'danger': return 'text-bg-danger';
      case 'warning': return 'text-bg-warning text-dark';
      case 'info': return 'text-bg-primary';
      default: return 'text-bg-dark';
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'danger': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  }
}
