import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.isOpen()) {
      <div class="modal-backdrop fade show" style="z-index: 2100;"></div>
      <div class="modal fade show d-block" tabindex="-1" style="z-index: 2105;" (click)="confirmService.handleCancel()">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="modal-content border-0 shadow-lg rounded-2 overflow-hidden">
            <div class="modal-header py-2.5 px-3 bg-light border-bottom">
              <h6 class="modal-title fw-bold text-dark fs-7 mb-0">{{ confirmService.title() }}</h6>
              <button type="button" class="btn-close" (click)="confirmService.handleCancel()"></button>
            </div>
            <div class="modal-body p-3 fs-8 text-secondary" style="white-space: pre-line;">
              {{ confirmService.message() }}
            </div>
            <div class="modal-footer py-2 px-3 bg-light border-top">
              <button 
                type="button" 
                class="btn btn-sm btn-outline-secondary px-3 fs-8" 
                (click)="confirmService.handleCancel()">
                {{ confirmService.cancelText() }}
              </button>
              <button 
                type="button" 
                class="btn btn-sm px-3 fs-8 fw-semibold"
                [class.btn-danger]="confirmService.isDanger()"
                [class.btn-primary]="!confirmService.isDanger()"
                (click)="confirmService.handleConfirm()">
                {{ confirmService.confirmText() }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmDialogService);
}
