import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LedgerService } from './services/ledger.service';
import { NavService } from '../../core/services/nav.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { Borrower, BorrowerTxn } from './models/ledger.model';

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ledger.component.html',
  styleUrls: ['./ledger.component.scss']
})
export class LedgerComponent implements OnInit {
  ledgerService = inject(LedgerService);
  navService = inject(NavService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);

  readonly Math = Math;

  // Modals state
  isAddBorrowerModalOpen = signal<boolean>(false);
  isStatementModalOpen = signal<boolean>(false);
  isEditTxnModalOpen = signal<boolean>(false);

  // Active transaction actions ID (for double click on desktop or long hold on mobile)
  activeActionsTxnId = signal<number | null>(null);

  // Active borrower actions ID (for double click on desktop or long hold on mobile on customer row)
  activeActionsBorrowerId = signal<number | null>(null);

  // Edit transaction modal form
  editTxnId: number | null = null;
  editTxnType: 'Credit' | 'Debit' = 'Credit';
  editTxnDate: string = '';
  editTxnAmount: number | null = null;
  editTxnRemarks: string = '';

  // Add customer form
  newBorrowerName = '';
  newBorrowerMobile = '';
  newBorrowerAddress = '';

  // Transaction form
  todayStr = new Date().toISOString().slice(0, 10);
  txnDate = this.todayStr;
  txnAmount: number | null = null;
  txnRemarks = '';

  // Filter dropdown state
  isFilterMenuOpen = false;

  // Touch tracking for mobile long-press on transactions
  private touchTimer: any = null;
  private touchStartX = 0;
  private touchStartY = 0;

  // Click & Touch tracking for mobile long-press / desktop dblclick on customer rows
  private borrowerClickTimer: any = null;
  private borrowerTouchTimer: any = null;
  private borrowerTouchStartX = 0;
  private borrowerTouchStartY = 0;

  ngOnInit(): void {
    this.navService.setPageTitle('Ledger');
    this.loadData();
  }

  loadData(): void {
    this.ledgerService.loadAllData().subscribe({
      next: () => {},
      error: () => this.toastService.show('Failed to load ledger accounts.', 'danger')
    });
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  }

  setFilter(status: 'all' | 'due' | 'advance' | 'settled'): void {
    this.ledgerService.filterStatus.set(status);
    this.isFilterMenuOpen = false;
  }

  get filterLabel(): string {
    const s = this.ledgerService.filterStatus();
    if (s === 'due') return 'Due / You Get';
    if (s === 'advance') return 'Advance / You Give';
    if (s === 'settled') return 'Settled';
    return 'All';
  }

  openAddBorrowerModal(): void {
    this.newBorrowerName = '';
    this.newBorrowerMobile = '';
    this.newBorrowerAddress = '';
    this.isAddBorrowerModalOpen.set(true);
  }

  closeAddBorrowerModal(): void {
    this.isAddBorrowerModalOpen.set(false);
  }

  saveNewBorrower(): void {
    const name = this.newBorrowerName.trim();
    if (!name) {
      this.toastService.show('Please enter customer name.', 'warning');
      return;
    }

    this.ledgerService.addBorrower({
      Name: name,
      Mobile: this.newBorrowerMobile.trim(),
      Address: this.newBorrowerAddress.trim()
    }).subscribe({
      next: () => {
        this.closeAddBorrowerModal();
        this.toastService.show(`Customer "${name}" added successfully!`, 'success');
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to add customer.', 'danger');
      }
    });
  }

  // Customer row interaction handlers (Click vs DblClick & Mobile Long Hold)
  onBorrowerClick(borrower: Borrower, event: MouseEvent): void {
    if (this.activeActionsBorrowerId() === borrower.BorrowerID) {
      return;
    }
    if (this.borrowerClickTimer) {
      clearTimeout(this.borrowerClickTimer);
      this.borrowerClickTimer = null;
      return;
    }
    this.borrowerClickTimer = setTimeout(() => {
      this.openStatement(borrower);
      this.borrowerClickTimer = null;
    }, 220);
  }

  onBorrowerDblClick(borrower: Borrower, event: MouseEvent): void {
    event.stopPropagation();
    if (this.borrowerClickTimer) {
      clearTimeout(this.borrowerClickTimer);
      this.borrowerClickTimer = null;
    }
    if (this.activeActionsBorrowerId() === borrower.BorrowerID) {
      this.activeActionsBorrowerId.set(null);
    } else {
      this.activeActionsBorrowerId.set(borrower.BorrowerID);
    }
  }

  onBorrowerTouchStart(borrower: Borrower, e: TouchEvent): void {
    this.borrowerTouchStartX = e.touches[0].clientX;
    this.borrowerTouchStartY = e.touches[0].clientY;

    this.borrowerTouchTimer = setTimeout(() => {
      this.activeActionsBorrowerId.set(borrower.BorrowerID);
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (_) {}
      }
    }, 500);
  }

  onBorrowerTouchMove(e: TouchEvent): void {
    if (!this.borrowerTouchTimer) return;
    const dx = Math.abs(e.touches[0].clientX - this.borrowerTouchStartX);
    const dy = Math.abs(e.touches[0].clientY - this.borrowerTouchStartY);
    if (dx > 10 || dy > 10) {
      clearTimeout(this.borrowerTouchTimer);
      this.borrowerTouchTimer = null;
    }
  }

  onBorrowerTouchEnd(): void {
    if (this.borrowerTouchTimer) {
      clearTimeout(this.borrowerTouchTimer);
      this.borrowerTouchTimer = null;
    }
  }

  onBorrowerTouchCancel(): void {
    if (this.borrowerTouchTimer) {
      clearTimeout(this.borrowerTouchTimer);
      this.borrowerTouchTimer = null;
    }
  }

  closeBorrowerActions(): void {
    this.activeActionsBorrowerId.set(null);
  }

  async deleteBorrower(borrower: Borrower, event: Event): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Customer',
      message: `Are you sure you want to delete customer "${borrower.Name}" and all associated transactions? This cannot be undone.`,
      confirmText: 'Delete',
      isDanger: true
    });

    if (!confirmed) return;

    this.ledgerService.deleteBorrower(borrower.BorrowerID).subscribe({
      next: () => {
        this.toastService.show(`Customer "${borrower.Name}" deleted successfully.`, 'success');
        this.activeActionsBorrowerId.set(null);
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to delete customer.', 'danger');
      }
    });
  }

  openStatement(borrower: Borrower): void {
    this.ledgerService.selectedBorrower.set(borrower);
    this.txnDate = this.todayStr;
    this.txnAmount = null;
    this.txnRemarks = '';
    this.activeActionsTxnId.set(null);
    this.isStatementModalOpen.set(true);
  }

  closeStatement(): void {
    this.isStatementModalOpen.set(false);
    this.ledgerService.selectedBorrower.set(null);
    this.activeActionsTxnId.set(null);
  }

  toggleTxnActions(txnId: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.activeActionsTxnId() === txnId) {
      this.activeActionsTxnId.set(null);
    } else {
      this.activeActionsTxnId.set(txnId);
    }
  }

  closeTxnActions(): void {
    this.activeActionsTxnId.set(null);
  }

  // Mobile Touch Event Handlers
  onTouchStart(txnId: number, e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;

    this.touchTimer = setTimeout(() => {
      this.activeActionsTxnId.set(txnId);
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (_) {}
      }
    }, 500);
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.touchTimer) return;
    const dx = Math.abs(e.touches[0].clientX - this.touchStartX);
    const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
    if (dx > 10 || dy > 10) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  onTouchEnd(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  onTouchCancel(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  openEditModal(txn: BorrowerTxn, event: Event): void {
    event.stopPropagation();
    this.editTxnId = txn.TxnID;
    this.editTxnType = txn.Type;
    this.editTxnDate = (txn.TxnDate ? txn.TxnDate.slice(0, 10) : '') || this.todayStr;
    this.editTxnAmount = txn.Amount;
    this.editTxnRemarks = txn.Remarks || '';
    this.isEditTxnModalOpen.set(true);
    this.activeActionsTxnId.set(null);
  }

  closeEditModal(): void {
    this.isEditTxnModalOpen.set(false);
  }

  saveEditTxn(): void {
    if (!this.editTxnId) return;
    const amt = Number(this.editTxnAmount);
    if (!amt || amt <= 0) {
      this.toastService.show('Please enter a valid amount > 0', 'warning');
      return;
    }
    if (!this.editTxnDate) {
      this.toastService.show('Please select a date', 'warning');
      return;
    }

    this.ledgerService.updateTransaction({
      TxnID: this.editTxnId,
      Amount: amt,
      Type: this.editTxnType,
      TxnDate: this.editTxnDate,
      Remarks: this.editTxnRemarks.trim()
    }).subscribe({
      next: () => {
        this.closeEditModal();
        this.toastService.show('Transaction updated successfully!', 'success');
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to update transaction.', 'danger');
      }
    });
  }

  saveTxn(type: 'Credit' | 'Debit'): void {
    const sel = this.ledgerService.selectedBorrower();
    if (!sel) return;

    const amt = Number(this.txnAmount);
    if (!amt || amt <= 0) {
      this.toastService.show('Please enter a valid amount greater than 0.', 'warning');
      return;
    }

    this.ledgerService.addTransaction({
      BorrowerID: Number(sel.BorrowerID),
      Amount: amt,
      Type: type,
      TxnDate: this.txnDate || this.todayStr,
      Remarks: this.txnRemarks.trim()
    }).subscribe({
      next: () => {
        const typeLabel = type === 'Credit' ? 'Given' : 'Received';
        this.toastService.show(`₹${amt.toLocaleString('en-IN')} ${typeLabel} recorded successfully!`, 'success');
        this.txnAmount = null;
        this.txnRemarks = '';
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to record transaction.', 'danger');
      }
    });
  }

  async deleteTxn(txn: BorrowerTxn, event: Event): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Transaction',
      message: `Are you sure you want to delete this ₹${Number(txn.Amount).toLocaleString('en-IN')} transaction?`,
      confirmText: 'Delete',
      isDanger: true
    });

    if (!confirmed) return;

    this.ledgerService.deleteTransaction(txn.TxnID).subscribe({
      next: () => {
        this.toastService.show('Transaction deleted successfully.', 'success');
        this.activeActionsTxnId.set(null);
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to delete transaction.', 'danger');
      }
    });
  }

  shareWhatsapp(): void {
    const sel = this.ledgerService.selectedBorrower();
    if (!sel) return;

    const bName = sel.Name;
    const balance = sel.balance || 0;
    const balanceText = Math.abs(balance).toLocaleString('en-IN');
    const statusText = balance > 0 ? 'outstanding due' : (balance < 0 ? 'advance balance' : 'settled balance');

    let msg = `Dear ${bName},\nYour net ${statusText} as of ${new Date().toLocaleDateString('en-GB')} is ₹${balanceText}.\n\nThank you,\nShri Trutiyadev Solar Enterprises`;
    const cleanPhone = (sel.Mobile || '').replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone) : '';
    const url = `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  fmtMoney(n: number | undefined): string {
    return '₹' + Math.abs(Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  fmtNetTotal(n: number | undefined): string {
    return '₹' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('en-IN');
  }

  shouldShowDateDivider(txns: BorrowerTxn[], index: number): boolean {
    if (index === 0) return true;
    const prev = this.ledgerService.formatDate(txns[index - 1].TxnDate);
    const curr = this.ledgerService.formatDate(txns[index].TxnDate);
    return prev !== curr;
  }
}
