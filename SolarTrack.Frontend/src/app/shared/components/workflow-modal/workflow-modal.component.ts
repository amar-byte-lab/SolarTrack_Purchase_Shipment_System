import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessCardComponent } from './process-card/process-card.component';
import { PaymentCardComponent } from './payment-card/payment-card.component';
import { IconComponent } from '../icon/icon.component';
import { InstallmentRow } from '../../../core/models/summary.model';

@Component({
  selector: 'app-workflow-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessCardComponent, PaymentCardComponent, IconComponent],
  templateUrl: './workflow-modal.component.html',
  styleUrls: ['./workflow-modal.component.scss']
})
export class WorkflowModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() customer: InstallmentRow | null = null;
  @Input() initialTab: 'process' | 'payment' = 'process';

  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  activeTab: 'process' | 'payment' = 'process';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.activeTab = this.initialTab || 'process';
    }
  }

  setTab(tab: 'process' | 'payment'): void {
    this.activeTab = tab;
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  onDataUpdated(): void {
    this.updated.emit();
  }
}
