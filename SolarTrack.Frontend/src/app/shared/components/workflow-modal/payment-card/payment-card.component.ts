import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../../core/services/summary.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { IconComponent } from '../../icon/icon.component';
import { InstallmentRow, InstallmentTxnRow } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './payment-card.component.html',
  styleUrls: ['./payment-card.component.scss']
})
export class PaymentCardComponent implements OnChanges {
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  confirmDialogService = inject(ConfirmDialogService);

  @Input() customer: InstallmentRow | null = null;
  @Output() updated = new EventEmitter<void>();

  // Cost edit state
  isCostEditing = false;
  costInput = 0;

  // Paid edit state
  isPaidEditing = false;
  paidInput = 0;
  paidDateInput = '';

  // Pending / Quick Pay state
  isPendingEditing = false;
  pendingPayAmount = 0;
  pendingPayDate = '';

  get todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get costVal(): number {
    return Number(this.customer?.CommittedPrice) || 0;
  }

  get customerTxns(): InstallmentTxnRow[] {
    if (!this.customer?.SlNo) return [];
    return this.summaryService.getTxnsForCustomer(this.customer.SlNo);
  }

  get totalPaid(): number {
    const txns = this.customerTxns;
    if (txns.length > 0) {
      return txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);
    }
    return Number(this.customer?.Total) || 0;
  }

  get pendingBalance(): number {
    return Math.max(0, this.costVal - this.totalPaid);
  }

  get isFullyPaid(): boolean {
    return this.totalPaid >= this.costVal && this.costVal > 0;
  }

  get hasPayment(): boolean {
    return this.totalPaid > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      this.resetStates();
    }
  }

  resetStates(): void {
    this.isCostEditing = false;
    this.costInput = this.costVal;

    this.isPaidEditing = false;
    this.paidInput = Math.round(this.totalPaid);
    const sorted = [...this.customerTxns].sort((a, b) => new Date(a.TxnDate).getTime() - new Date(b.TxnDate).getTime());
    const latest = sorted.length ? sorted[sorted.length - 1] : null;
    this.paidDateInput = latest && latest.TxnDate ? latest.TxnDate.slice(0, 10) : this.todayISO;

    this.isPendingEditing = false;
    this.pendingPayAmount = this.pendingBalance;
    this.pendingPayDate = this.todayISO;
  }

  formatDisplayDate(dStr: string): string {
    if (!dStr) return '';
    const clean = dStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean;
  }

  // 1. Payment Active Toggle / Clear
  handlePaymentToggle(event: Event): void {
    const chk = event.target as HTMLInputElement;
    const c = this.customer;
    if (!c) return;

    if (!chk.checked && this.totalPaid > 0) {
      this.confirmDialogService.confirm({
        title: 'Clear Customer Payment',
        message: `Clear payment of ₹${Math.round(this.totalPaid).toLocaleString('en-IN')} for customer "${c.Name || 'Sl No ' + c.SlNo}"? This will reset paid amount to ₹0 and delete payment transactions.`,
        confirmText: 'Clear Payment',
        isDanger: true
      }).then(confirmed => {
        if (confirmed) {
          this.summaryService.clearCustomerPayments(c.SlNo).subscribe({
            next: () => {
              this.toastService.info('Customer payments cleared.');
              this.refreshData();
            },
            error: (err) => {
              this.toastService.error('Error clearing payment: ' + (err.message || 'Server error'));
              chk.checked = true;
            }
          });
        } else {
          chk.checked = true;
        }
      });
    }
  }

  // 2. Cost Handlers
  startEditCost(): void {
    this.costInput = this.costVal;
    this.isCostEditing = true;
  }

  cancelEditCost(): void {
    this.costInput = this.costVal;
    this.isCostEditing = false;
  }

  saveCost(): void {
    const c = this.customer;
    if (!c) return;
    const newCost = Number(this.costInput) || 0;
    if (newCost < 0) {
      this.toastService.warning('Cost cannot be negative.');
      return;
    }

    this.summaryService.saveCustomerCost(c.SlNo, newCost).subscribe({
      next: () => {
        this.toastService.success(`Customer cost updated to ₹${Math.round(newCost).toLocaleString('en-IN')}`);
        this.isCostEditing = false;
        this.refreshData();
      },
      error: (err) => {
        this.toastService.error('Error saving cost: ' + (err.message || 'Server error'));
      }
    });
  }

  // 3. Paid Handlers
  startEditPaid(): void {
    this.paidInput = Math.round(this.totalPaid);
    const sorted = [...this.customerTxns].sort((a, b) => new Date(a.TxnDate).getTime() - new Date(b.TxnDate).getTime());
    const latest = sorted.length ? sorted[sorted.length - 1] : null;
    this.paidDateInput = latest && latest.TxnDate ? latest.TxnDate.slice(0, 10) : this.todayISO;
    this.isPaidEditing = true;
  }

  cancelEditPaid(): void {
    this.isPaidEditing = false;
  }

  savePaid(): void {
    const c = this.customer;
    if (!c) return;
    const newPaid = Number(this.paidInput) || 0;
    if (newPaid < 0) {
      this.toastService.warning('Paid amount cannot be negative.');
      return;
    }

    const payDate = this.paidDateInput || this.todayISO;
    const custName = c.Name || `Customer #${c.SlNo}`;
    const formattedAmt = `₹${Math.round(newPaid).toLocaleString('en-IN')}`;

    this.confirmDialogService.confirm({
      title: 'Confirm Paid Amount Update',
      message: `Update total paid amount for "${custName}" to ${formattedAmt} dated ${payDate}? This will update the payment record and recalculate pending balance.`,
      confirmText: 'Yes, Update Paid',
      isDanger: false
    }).then(confirmed => {
      if (confirmed) {
        this.summaryService.updateCustomerPaidTotal(c.SlNo, newPaid, payDate).subscribe({
          next: () => {
            this.toastService.success(`Paid amount updated to ${formattedAmt}`);
            this.isPaidEditing = false;
            this.refreshData();
          },
          error: (err) => {
            this.toastService.error('Error saving paid amount: ' + (err.message || 'Server error'));
          }
        });
      }
    });
  }

  // 4. Pending / Quick Pay Handlers
  startEditPending(): void {
    this.pendingPayAmount = this.pendingBalance;
    this.pendingPayDate = this.todayISO;
    this.isPendingEditing = true;
  }

  cancelEditPending(): void {
    this.isPendingEditing = false;
  }

  savePendingPayment(): void {
    const c = this.customer;
    if (!c) return;
    const payAmt = Number(this.pendingPayAmount) || 0;
    if (payAmt <= 0) {
      this.toastService.warning('Please enter a valid payment amount greater than 0.');
      return;
    }

    const payDate = this.pendingPayDate || this.todayISO;
    const custName = c.Name || `Customer #${c.SlNo}`;
    const formattedAmt = `₹${Math.round(payAmt).toLocaleString('en-IN')}`;

    this.confirmDialogService.confirm({
      title: 'Confirm Payment Save',
      message: `Add payment of ${formattedAmt} dated ${payDate} for "${custName}"? This will update the customer payment and pending balance.`,
      confirmText: 'Yes, Save Payment',
      isDanger: false
    }).then(confirmed => {
      if (confirmed) {
        this.summaryService.addCustomerPaymentTxn(c.SlNo, payAmt, payDate).subscribe({
          next: () => {
            this.toastService.success(`Payment of ${formattedAmt} added successfully.`);
            this.isPendingEditing = false;
            this.refreshData();
          },
          error: (err) => {
            this.toastService.error('Error saving payment: ' + (err.message || 'Server error'));
          }
        });
      }
    });
  }

  private refreshData(): void {
    this.summaryService.loadAllData().subscribe(() => {
      this.resetStates();
      this.updated.emit();
    });
  }
}
