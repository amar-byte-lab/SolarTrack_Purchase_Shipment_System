import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
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
  @ViewChild('chatFeed') chatFeedRef?: ElementRef<HTMLDivElement>;

  ledgerService = inject(LedgerService);
  navService = inject(NavService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);

  readonly Math = Math;

  // Modals state
  isAddBorrowerModalOpen = signal<boolean>(false);
  isEditBorrowerModalOpen = signal<boolean>(false);
  isStatementModalOpen = signal<boolean>(false);
  isEditTxnModalOpen = signal<boolean>(false);

  // Edit borrower form
  editBorrowerId: number | null = null;
  editBorrowerName = '';
  editBorrowerMobile = '';
  editBorrowerAddress = '';

  // Inline edit transaction state
  readonly editingTxn = signal<BorrowerTxn | null>(null);

  // Active transaction actions ID (for double click on desktop or long hold on mobile)
  activeActionsTxnId = signal<number | null>(null);

  // Active borrower actions ID (for double click on desktop or long hold on mobile on customer row)
  activeActionsBorrowerId = signal<number | null>(null);

  // Edit transaction form
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
  onBorrowerClick(borrower: Borrower, event?: MouseEvent): void {
    if (this.activeActionsBorrowerId() === borrower.BorrowerID) {
      return;
    }
    this.openStatement(borrower);
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

  isCustomerInactive(b?: Borrower): boolean {
    if (!b) return false;
    const s = (b.Status || '').toLowerCase();
    return s === 'inactive' || s === 'closed' || s === 'deactive';
  }

  toggleBorrowerStatus(borrower: Borrower, event: Event): void {
    event.stopPropagation();
    const isInactive = this.isCustomerInactive(borrower);
    const newStatus = isInactive ? 'Active' : 'Inactive';
    this.ledgerService.updateBorrower({
      BorrowerID: borrower.BorrowerID,
      Status: newStatus
    }).subscribe({
      next: () => {
        const actionLabel = newStatus === 'Inactive' ? 'deactivated' : 'activated';
        this.toastService.show(`Customer "${borrower.Name}" ${actionLabel} successfully.`, 'success');
        this.activeActionsBorrowerId.set(null);
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to update customer status.', 'danger');
      }
    });
  }

  openEditBorrowerModal(borrower: Borrower, event: Event): void {
    event.stopPropagation();
    this.editBorrowerId = borrower.BorrowerID;
    this.editBorrowerName = borrower.Name || '';
    this.editBorrowerMobile = borrower.Mobile || '';
    this.editBorrowerAddress = borrower.Address || '';
    this.isEditBorrowerModalOpen.set(true);
    this.activeActionsBorrowerId.set(null);
  }

  closeEditBorrowerModal(): void {
    this.isEditBorrowerModalOpen.set(false);
    this.editBorrowerId = null;
  }

  saveEditBorrower(): void {
    if (!this.editBorrowerId) return;
    const name = this.editBorrowerName.trim();
    if (!name) {
      this.toastService.show('Please enter customer name.', 'warning');
      return;
    }

    this.ledgerService.updateBorrower({
      BorrowerID: this.editBorrowerId,
      Name: name,
      Mobile: this.editBorrowerMobile.trim(),
      Address: this.editBorrowerAddress.trim()
    }).subscribe({
      next: () => {
        this.toastService.show('Customer details updated successfully!', 'success');
        this.closeEditBorrowerModal();
        this.loadData();
      },
      error: () => {
        this.toastService.show('Failed to update customer.', 'danger');
      }
    });
  }

  openStatement(borrower: Borrower): void {
    this.cancelEditTxn();
    this.ledgerService.selectedBorrower.set(borrower);
    this.txnDate = this.todayStr;
    this.txnAmount = null;
    this.txnRemarks = '';
    this.activeActionsTxnId.set(null);
    this.isStatementModalOpen.set(true);
    this.scrollToLatestTxn();
  }

  closeStatement(): void {
    this.cancelEditTxn();
    this.isStatementModalOpen.set(false);
    this.ledgerService.selectedBorrower.set(null);
    this.activeActionsTxnId.set(null);
  }

  scrollToLatestTxn(): void {
    setTimeout(() => {
      if (this.chatFeedRef?.nativeElement) {
        this.chatFeedRef.nativeElement.scrollTop = this.chatFeedRef.nativeElement.scrollHeight;
      }
    }, 60);
    setTimeout(() => {
      if (this.chatFeedRef?.nativeElement) {
        this.chatFeedRef.nativeElement.scrollTop = this.chatFeedRef.nativeElement.scrollHeight;
      }
    }, 200);
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

  startEditTxn(txn: BorrowerTxn, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingTxn.set(txn);
    this.editTxnId = txn.TxnID;
    this.editTxnType = txn.Type;
    this.editTxnDate = (txn.TxnDate ? txn.TxnDate.slice(0, 10) : '') || this.todayStr;
    this.editTxnAmount = txn.Amount;
    this.editTxnRemarks = txn.Remarks || '';
    this.activeActionsTxnId.set(null);
    this.scrollToLatestTxn();
  }

  cancelEditTxn(): void {
    this.editingTxn.set(null);
    this.editTxnId = null;
    this.editTxnAmount = null;
    this.editTxnRemarks = '';
  }

  openEditModal(txn: BorrowerTxn, event: Event): void {
    this.startEditTxn(txn, event);
  }

  closeEditModal(): void {
    this.cancelEditTxn();
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
        this.cancelEditTxn();
        this.toastService.show('Transaction updated successfully!', 'success');
        this.loadData();
        this.scrollToLatestTxn();
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
        this.scrollToLatestTxn();
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

  downloadStatementPdf(): void {
    const sel = this.ledgerService.selectedBorrower();
    if (!sel) return;

    const txns = this.ledgerService.selectedBorrowerTxns();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = 297;
    const marginX = 14;
    const contentWidth = 182;

    const colW = {
      sl: 10,
      date: 24,
      desc: 68,
      given: 26,
      received: 26,
      bal: 28
    };

    let y = 14;

    // Header title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('SHRI TRUTIYADEV SOLAR ENTERPRISES', marginX, y);

    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Customer Account Statement / Khata Ledger', marginX, y);

    // Right-aligned statement generation date
    const genDateStr = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    doc.text(genDateStr, marginX + contentWidth, y, { align: 'right' });

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, marginX + contentWidth, y);

    y += 4;

    // Customer summary card
    const cardHeight = 22;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(marginX, y, contentWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, cardHeight, 1.5, 1.5, 'S');

    // Inside card: Customer info (left) & Balance info (right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Customer: ${sel.Name}`, marginX + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const phoneStr = sel.Mobile ? `Phone: ${sel.Mobile}` : 'Phone: -';
    const addrStr = sel.Address ? `Address: ${sel.Address}` : '';
    const details = addrStr ? `${phoneStr}  |  ${addrStr}` : phoneStr;
    doc.text(details, marginX + 4, y + 12);

    const periodStr = txns.length > 0 
      ? `Total Records: ${txns.length} transactions` 
      : 'No transactions recorded';
    doc.text(periodStr, marginX + 4, y + 17.5);

    // Balance summary (right)
    const netBal = sel.balance || 0;
    const balColor = netBal > 0.01 ? [220, 38, 38] : (netBal < -0.01 ? [22, 163, 74] : [100, 116, 139]);
    const balStatus = netBal > 0.01 ? 'Outstanding Due (You Get)' : (netBal < -0.01 ? 'Advance Balance (You Give)' : 'Settled');
    const balAmountStr = (netBal >= 0 ? 'Rs. ' : '- Rs. ') + Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Net Balance', marginX + contentWidth - 4, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(balColor[0], balColor[1], balColor[2]);
    doc.text(balAmountStr, marginX + contentWidth - 4, y + 11.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(balStatus, marginX + contentWidth - 4, y + 17, { align: 'right' });

    y += cardHeight + 6;

    // Function to draw Table Header
    const drawTableHeader = () => {
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(marginX, y, contentWidth, 7.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);

      let curX = marginX;
      doc.text('Sl.', curX + colW.sl / 2, y + 5, { align: 'center' });
      curX += colW.sl;

      doc.text('Date', curX + 2, y + 5);
      curX += colW.date;

      doc.text('Description / Remarks', curX + 2, y + 5);
      curX += colW.desc;

      doc.text('Given (-)', curX + colW.given - 2, y + 5, { align: 'right' });
      curX += colW.given;

      doc.text('Received (+)', curX + colW.received - 2, y + 5, { align: 'right' });
      curX += colW.received;

      doc.text('Balance', curX + colW.bal - 2, y + 5, { align: 'right' });

      y += 7.5;
    };

    const drawPageFooter = (pageNum: number, totalPages: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a computer-generated statement by SolarTrack - Shri Trutiyadev Solar Enterprises', marginX, pageHeight - 8);
      doc.text(`Page ${pageNum} of ${totalPages}`, marginX + contentWidth, pageHeight - 8, { align: 'right' });
    };

    drawTableHeader();

    let runningBal = 0;
    let totalGiven = 0;
    let totalReceived = 0;

    if (txns.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX, y, contentWidth, 12, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, y, contentWidth, 12, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('No transactions recorded for this customer.', marginX + contentWidth / 2, y + 7.5, { align: 'center' });
      y += 12;
    } else {
      txns.forEach((t, idx) => {
        const amt = Number(t.Amount) || 0;
        let givenVal = 0;
        let receivedVal = 0;

        if (t.Type === 'Credit') {
          runningBal += amt;
          totalGiven += amt;
          givenVal = amt;
        } else {
          runningBal -= amt;
          totalReceived += amt;
          receivedVal = amt;
        }

        const dateStr = this.ledgerService.formatDate(t.TxnDate);
        const remarkText = (t.Remarks || '').trim() || '-';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const splitDesc = doc.splitTextToSize(remarkText, colW.desc - 4);
        const rowHeight = Math.max(6.5, splitDesc.length * 4 + 2);

        // Page break check
        if (y + rowHeight > pageHeight - 16) {
          doc.addPage();
          y = 14;
          drawTableHeader();
        }

        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginX, y, contentWidth, rowHeight, 'F');
        }

        // Row border
        doc.setDrawColor(241, 245, 249);
        doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

        let curX = marginX;

        // Sl
        doc.setTextColor(100, 116, 139);
        doc.text(String(idx + 1), curX + colW.sl / 2, y + 4.5, { align: 'center' });
        curX += colW.sl;

        // Date
        doc.setTextColor(30, 41, 59);
        doc.text(dateStr, curX + 2, y + 4.5);
        curX += colW.date;

        // Remarks
        doc.text(splitDesc, curX + 2, y + 4.5);
        curX += colW.desc;

        // Given (-)
        if (givenVal > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38); // red
          doc.text(`Rs. ${givenVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, curX + colW.given - 2, y + 4.5, { align: 'right' });
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text('-', curX + colW.given - 2, y + 4.5, { align: 'right' });
        }
        curX += colW.given;

        // Received (+)
        if (receivedVal > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(22, 163, 74); // green
          doc.text(`Rs. ${receivedVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, curX + colW.received - 2, y + 4.5, { align: 'right' });
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text('-', curX + colW.received - 2, y + 4.5, { align: 'right' });
        }
        curX += colW.received;

        // Running Balance
        doc.setFont('helvetica', 'bold');
        const runningBalColor = runningBal > 0.01 ? [220, 38, 38] : (runningBal < -0.01 ? [22, 163, 74] : [100, 116, 139]);
        doc.setTextColor(runningBalColor[0], runningBalColor[1], runningBalColor[2]);
        const balLabel = (runningBal < 0 ? '-' : '') + `Rs. ${Math.abs(runningBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        doc.text(balLabel, curX + colW.bal - 2, y + 4.5, { align: 'right' });

        y += rowHeight;
      });

      // Total Row
      if (y + 8 > pageHeight - 16) {
        doc.addPage();
        y = 14;
        drawTableHeader();
      }

      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(marginX, y, contentWidth, 8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, y, marginX + contentWidth, y);
      doc.line(marginX, y + 8, marginX + contentWidth, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const totalLabelSpan = colW.sl + colW.date + colW.desc;
      doc.text('TOTAL', marginX + 4, y + 5.5);

      let curX = marginX + totalLabelSpan;
      doc.setTextColor(220, 38, 38);
      doc.text(`Rs. ${totalGiven.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, curX + colW.given - 2, y + 5.5, { align: 'right' });
      curX += colW.given;

      doc.setTextColor(22, 163, 74);
      doc.text(`Rs. ${totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, curX + colW.received - 2, y + 5.5, { align: 'right' });
      curX += colW.received;

      doc.setTextColor(balColor[0], balColor[1], balColor[2]);
      doc.text(balAmountStr, curX + colW.bal - 2, y + 5.5, { align: 'right' });

      y += 12;
    }

    // Number of pages count and write footers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawPageFooter(p, totalPages);
    }

    // Generate safe filename and save
    const safeName = (sel.Name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const today = new Date().toISOString().slice(0, 10);
    doc.save(`${safeName}_Ledger_Statement_${today}.pdf`);
    this.toastService.show('Ledger statement PDF downloaded successfully!', 'success');
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

  fmtBal(bal: number | undefined): string {
    const b = Number(bal) || 0;
    if (b > 0.01) return `Bal: ₹${Math.abs(b).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Due)`;
    if (b < -0.01) return `Bal: ₹${Math.abs(b).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Adv)`;
    return 'Bal: ₹0.00';
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
