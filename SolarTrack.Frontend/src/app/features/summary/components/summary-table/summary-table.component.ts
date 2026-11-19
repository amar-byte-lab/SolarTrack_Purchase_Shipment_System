import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../../core/services/summary.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { CustomerModalComponent } from '../../../../shared/components/customer-modal/customer-modal.component';
import { WorkflowModalComponent } from '../../../../shared/components/workflow-modal/workflow-modal.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InstallmentRow, SummaryTableRow, SummaryGroup } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-summary-table',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomerModalComponent, WorkflowModalComponent, IconComponent],
  templateUrl: './summary-table.component.html',
  styleUrls: ['./summary-table.component.scss']
})
export class SummaryTableComponent {
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  confirmDialogService = inject(ConfirmDialogService);

  // Exclude selection tracking
  selectedSlNos = signal<Set<number>>(new Set());

  // Active open section - only ONE section can be open at a time (null means all collapsed)
  activeOpenGroup = signal<string | null>(null);

  // Active / marked row tracking (persists even after workflow modal closes)
  markedRowSlNo = signal<number | null>(null);

  // UI Dropdown states
  isExcludedMenuOpen = false;
  isColumnsMenuOpen = false;

  // Customer Edit Modal State
  isEditModalOpen = false;
  selectedCustomerForEdit: InstallmentRow | null = null;

  // Customer Workflow & Payment Modal State
  isWorkflowModalOpen = false;
  selectedCustomerForWorkflow: InstallmentRow | null = null;
  workflowModalTab: 'process' | 'payment' = 'process';

  // Collapse / Expand helpers - Accordion behavior (only one section open at a time)
  toggleGroupCollapse(groupName: string): void {
    if (this.activeOpenGroup() === groupName) {
      this.activeOpenGroup.set(null); // click currently open group to collapse it
    } else {
      this.activeOpenGroup.set(groupName); // open only this group, automatically closing others
    }
  }

  isGroupCollapsed(groupName: string): boolean {
    return this.activeOpenGroup() !== groupName;
  }

  markRow(slNo: number): void {
    this.markedRowSlNo.set(slNo);
  }

  get isAllSelected(): boolean {
    const rows = this.summaryService.filteredRows();
    if (rows.length === 0) return false;
    const selected = this.selectedSlNos();
    return rows.every(r => selected.has(r.slNo));
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      const allIds = this.summaryService.filteredRows().map(r => r.slNo);
      this.selectedSlNos.set(new Set(allIds));
    } else {
      this.selectedSlNos.set(new Set());
    }
  }

  toggleGroupSelect(grp: SummaryGroup, checked: boolean): void {
    const current = new Set(this.selectedSlNos());
    grp.list.forEach(item => {
      if (checked) current.add(item.slNo);
      else current.delete(item.slNo);
    });
    this.selectedSlNos.set(current);
  }

  isGroupAllSelected(grp: SummaryGroup): boolean {
    if (grp.list.length === 0) return false;
    const selected = this.selectedSlNos();
    return grp.list.every(item => selected.has(item.slNo));
  }

  toggleRowSelection(slNo: number, event: Event): void {
    event.stopPropagation();
    const current = new Set(this.selectedSlNos());
    if (current.has(slNo)) {
      current.delete(slNo);
    } else {
      current.add(slNo);
    }
    this.selectedSlNos.set(current);
  }

  isRowSelected(slNo: number): boolean {
    return this.selectedSlNos().has(slNo);
  }

  excludeSelected(): void {
    const ids = Array.from(this.selectedSlNos());
    if (ids.length > 0) {
      this.summaryService.excludeRows(ids);
      this.selectedSlNos.set(new Set());
      this.toastService.show('Selected customer(s) excluded from summary.', 'info');
    }
  }

  restoreRow(slNo: number): void {
    this.summaryService.restoreRow(slNo);
    this.toastService.show('Customer returned to summary table.', 'success');
  }

  restoreAllExcluded(): void {
    this.summaryService.restoreAllExcluded();
    this.isExcludedMenuOpen = false;
    this.toastService.show('All excluded customers returned to summary table.', 'success');
  }

  isColumnVisible(key: string): boolean {
    const col = this.summaryService.columns().find(c => c.key === key);
    return col?.visible ?? true;
  }

  get visibleColumnsCount(): number {
    return this.summaryService.columns().filter(c => c.visible).length + 1; // +1 for Actions column
  }

  openEditCustomer(row: InstallmentRow): void {
    this.markedRowSlNo.set(row.SlNo);
    this.selectedCustomerForEdit = row;
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.selectedCustomerForEdit = null;
  }

  onCustomerSaved(savedRow: InstallmentRow): void {
    this.closeEditModal();
  }

  openWorkflowModal(row: InstallmentRow, tab: 'process' | 'payment' = 'process'): void {
    this.markedRowSlNo.set(row.SlNo);
    this.selectedCustomerForWorkflow = row;
    this.workflowModalTab = tab;
    this.isWorkflowModalOpen = true;
  }

  closeWorkflowModal(): void {
    this.isWorkflowModalOpen = false;
    this.selectedCustomerForWorkflow = null;
    // Note: markedRowSlNo is intentionally NOT cleared, so the row remains marked after popup closes
  }

  onWorkflowModalUpdated(): void {
    if (this.selectedCustomerForWorkflow) {
      const slNo = this.selectedCustomerForWorkflow.SlNo;
      const found = this.summaryService.rawInstallments().find(r => Number(r.SlNo) === Number(slNo));
      if (found) {
        this.selectedCustomerForWorkflow = { ...found };
      }
    }
  }

  deactivateCustomer(row: InstallmentRow): void {
    const desc = row.Name ? `${row.Name}${row.District ? ' (' + row.District + ')' : ''}` : `Sl No. ${row.SlNo}`;
    this.confirmDialogService.confirm({
      title: 'Confirm Deactivation',
      message: `Are you sure you want to deactivate customer ${desc}?`,
      confirmText: 'Deactivate',
      isDanger: true
    }).then(confirmed => {
      if (confirmed) {
        this.summaryService.deactivateCustomer(row.SlNo).subscribe({
          next: () => {
            this.toastService.success('Customer deactivated successfully.');
            this.summaryService.loadAllData().subscribe();
          },
          error: (err) => {
            this.toastService.error('Error deactivating customer: ' + (err.message || 'Server error'));
          }
        });
      }
    });
  }

  removeCustomer(row: InstallmentRow): void {
    const desc = row.Name ? `${row.Name}${row.District ? ' (' + row.District + ')' : ''}` : `Sl No. ${row.SlNo}`;
    this.confirmDialogService.confirm({
      title: 'Confirm Customer Removal',
      message: `Are you sure you want to permanently delete customer ${desc}? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      isDanger: true
    }).then(confirmed => {
      if (confirmed) {
        this.summaryService.deleteCustomer(row.SlNo).subscribe({
          next: () => {
            this.toastService.success('Customer deleted successfully.');
            this.summaryService.loadAllData().subscribe();
          },
          error: (err) => {
            this.toastService.error('Error deleting customer: ' + (err.message || 'Server error'));
          }
        });
      }
    });
  }

  toggleColumn(key: string, checked: boolean): void {
    this.summaryService.toggleColumn(key, checked);
  }

  selectAllColumns(): void {
    this.summaryService.setAllColumns(true);
  }

  deselectAllColumns(): void {
    this.summaryService.setAllColumns(false);
  }

  resetDefaultColumns(): void {
    this.summaryService.resetDefaultColumns();
  }

  onCommentChange(slNo: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.summaryService.saveComment(slNo, input.value).subscribe();
    }
  }

  copyFormattedSummary(): void {
    const groups = this.summaryService.groupedRows();
    const filteredList = this.summaryService.filteredRows();
    if (filteredList.length === 0) {
      this.toastService.show('No customers to copy.', 'warning');
      return;
    }

    const lines: string[] = [];
    lines.push('==============================');
    lines.push('SOLAR WORK & PAYMENT SUMMARY');
    lines.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
    lines.push(`Total Customers: ${filteredList.length}`);
    lines.push('==============================\n');

    let serialNo = 1;

    groups.forEach(grp => {
      if (grp.list.length === 0) return;
      lines.push(`--- ${grp.name.toUpperCase()} (${grp.list.length}) ---`);

      grp.list.forEach(item => {
        const r = item.row;
        const fin = item.fin;

        lines.push(`${serialNo}. ${r.Name || 'Unnamed'}`);
        if (r.ConsumerNo) lines.push(`   Consumer No: ${r.ConsumerNo}`);
        if (r.District) lines.push(`   District: ${r.District}`);
        if (r.MobileNumber) lines.push(`   Mobile: ${r.MobileNumber}`);
        if (r.BrokerName) lines.push(`   Partner: ${r.BrokerName}`);
        lines.push(`   Status: ${item.stageName}`);

        if (this.isColumnVisible('pvmodule')) lines.push(`   PV Module: ${item.pvModuleMake}`);
        if (this.isColumnVisible('inverter')) lines.push(`   Inverter: ${item.inverterMake}`);

        if (this.isColumnVisible('payment')) {
          lines.push(`   Paid: ${this.fmtCurr(fin.paid)} | Unpaid: ${this.fmtCurr(fin.unpaid)} | Turnover: ${this.fmtCurr(fin.turnover)}`);
        }
        if (this.isColumnVisible('install')) lines.push(`   Install: ${this.fmtCurr(fin.install)}`);
        if (this.isColumnVisible('meter')) lines.push(`   Meter: ${this.fmtCurr(fin.meter)}`);
        if (this.isColumnVisible('delivery')) lines.push(`   Delivery: ${this.fmtCurr(fin.delivery)}`);
        if (this.isColumnVisible('others')) lines.push(`   Others: ${this.fmtCurr(fin.others)}`);
        if (this.isColumnVisible('material')) lines.push(`   Material: ${this.fmtCurr(fin.material)}`);
        if (this.isColumnVisible('setcost')) lines.push(`   Set Cost: ${this.fmtCurr(fin.setCost)}`);
        if (this.isColumnVisible('profit')) lines.push(`   Profit: ${this.fmtCurr(fin.profit)}`);
        if (fin.comment) lines.push(`   Note: ${fin.comment}`);

        lines.push('');
        serialNo++;
      });
    });

    const tot = this.summaryService.totals();
    lines.push('==============================');
    lines.push('SUMMARY TOTALS');
    lines.push('==============================');
    lines.push(`Total Customers: ${tot.count}`);
    if (this.isColumnVisible('payment')) {
      lines.push(`Paid: ${this.fmtCurr(tot.paid)}`);
      lines.push(`Unpaid: ${this.fmtCurr(tot.unpaid)}`);
      lines.push(`Turnover: ${this.fmtCurr(tot.turnover)}`);
    }
    if (this.isColumnVisible('install')) lines.push(`Total Install: ${this.fmtCurr(tot.install)}`);
    if (this.isColumnVisible('meter')) lines.push(`Total Meter: ${this.fmtCurr(tot.meter)}`);
    if (this.isColumnVisible('delivery')) lines.push(`Total Delivery: ${this.fmtCurr(tot.delivery)}`);
    if (this.isColumnVisible('others')) lines.push(`Total Others: ${this.fmtCurr(tot.others)}`);
    if (this.isColumnVisible('material')) lines.push(`Total Material: ${this.fmtCurr(tot.material)}`);
    if (this.isColumnVisible('setcost')) lines.push(`Total Investment (Set Cost): ${this.fmtCurr(tot.setCost)}`);
    if (this.isColumnVisible('profit')) lines.push(`Total Profit: ${this.fmtCurr(tot.profit)}`);
    lines.push('==============================');

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.toastService.show('Summary copied to clipboard (readable WhatsApp/Notepad format)!', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.toastService.show('Summary copied to clipboard!', 'success');
    });
  }

  fmtCurr(n: number): string {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
