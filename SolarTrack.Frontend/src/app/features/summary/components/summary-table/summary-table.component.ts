import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../../core/services/summary.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { RolePermissionService } from '../../../../core/services/role-permission.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { CustomerModalComponent } from '../../../../shared/components/customer-modal/customer-modal.component';
import { WorkflowModalComponent } from '../../../../shared/components/workflow-modal/workflow-modal.component';
import { CustomerHistoryModalComponent } from '../../../../shared/components/customer-history-modal/customer-history-modal.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InstallmentRow, SummaryTableRow, SummaryGroup } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-summary-table',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomerModalComponent, WorkflowModalComponent, CustomerHistoryModalComponent, IconComponent],
  templateUrl: './summary-table.component.html',
  styleUrls: ['./summary-table.component.scss']
})
export class SummaryTableComponent {
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  rolePermissionService = inject(RolePermissionService);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.sum-columns-dropdown-container')) {
      this.isColumnsMenuOpen = false;
    }
    if (!target.closest('.sum-excluded-dropdown-container')) {
      this.isExcludedMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isColumnsMenuOpen = false;
    this.isExcludedMenuOpen = false;
  }

  // Status Edit column state
  editingStatusSlNo = signal<number | null>(null);
  statusEditDrafts: { [slNo: number]: { status: string; netMeterInput: string } } = {};
  savingStatusSlNos = signal<Set<number>>(new Set());

  // Customer Cost column state
  editingCostSlNo = signal<number | null>(null);
  costEditDrafts: { [slNo: number]: number | string } = {};
  savingCostSlNos = signal<Set<number>>(new Set());

  // Pending Amount column state
  editingPendingSlNo = signal<number | null>(null);
  pendingEditDrafts: { [slNo: number]: number | string } = {};
  savingPendingSlNos = signal<Set<number>>(new Set());

  readonly statusOptions: string[] = [
    'Login',
    'Agreement',
    'Dispatched',
    'Installation',
    'Net Meter',
    'Inspection',
    'Connection',
    'Subsidy'
  ];

  // Customer Edit Modal State
  isEditModalOpen = false;
  selectedCustomerForEdit: InstallmentRow | null = null;

  // Customer Workflow & Payment Modal State
  isWorkflowModalOpen = false;
  selectedCustomerForWorkflow: InstallmentRow | null = null;
  workflowModalTab: 'process' | 'payment' = 'process';

  // Customer Status & Payment History Modal State
  isHistoryModalOpen = false;
  selectedRowForHistory: SummaryTableRow | null = null;

  openCustomerHistory(item: SummaryTableRow): void {
    this.selectedRowForHistory = item;
    this.isHistoryModalOpen = true;
  }

  closeCustomerHistory(): void {
    this.isHistoryModalOpen = false;
    this.selectedRowForHistory = null;
  }

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
    if (key === 'customer') return true;
    const col = this.summaryService.columns().find(c => c.key === key);
    return col?.visible ?? true;
  }

  get visibleColumnsCount(): number {
    const actionsCount = this.authService.isAdmin() ? 1 : 0;
    return this.summaryService.columns().filter(c => c.visible).length + actionsCount;
  }

  // Status Edit column helpers
  isStatusEditing(slNo: number): boolean {
    return this.editingStatusSlNo() === slNo;
  }

  isSavingStatus(slNo: number): boolean {
    return this.savingStatusSlNos().has(slNo);
  }

  getStatusDraftValue(item: SummaryTableRow): string {
    const draft = this.statusEditDrafts[item.slNo];
    if (draft) return draft.status;
    const stage = item.stageName;
    return (stage === 'NetMeter' || stage === 'Net Meter') ? 'Net Meter' : stage;
  }

  onStatusSelectChange(slNo: number, newStatus: string): void {
    if (!this.statusEditDrafts[slNo]) {
      this.statusEditDrafts[slNo] = { status: newStatus, netMeterInput: '' };
    } else {
      this.statusEditDrafts[slNo].status = newStatus;
    }
  }

  isNetMeterSelected(slNo: number): boolean {
    const st = this.statusEditDrafts[slNo]?.status;
    return st === 'Net Meter' || st === 'NetMeter';
  }

  startStatusEdit(item: SummaryTableRow): void {
    const rawVal = item.stageName;
    const normalized = (rawVal === 'NetMeter' || rawVal === 'Net Meter') ? 'Net Meter' : rawVal;
    const nmPayment = item.row.NetMeterPayment != null && (item.row.NetMeterPayment as any) !== '' 
      ? String(item.row.NetMeterPayment) 
      : (item.fin?.meter ? String(item.fin.meter) : '');

    this.statusEditDrafts[item.slNo] = {
      status: normalized,
      netMeterInput: nmPayment
    };
    this.editingStatusSlNo.set(item.slNo);
  }

  cancelStatusEdit(slNo: number): void {
    delete this.statusEditDrafts[slNo];
    if (this.editingStatusSlNo() === slNo) {
      this.editingStatusSlNo.set(null);
    }
  }

  saveStatusEdit(item: SummaryTableRow): void {
    const slNo = item.slNo;
    const draft = this.statusEditDrafts[slNo];
    if (!draft) return;

    const currentSaving = new Set(this.savingStatusSlNos());
    currentSaving.add(slNo);
    this.savingStatusSlNos.set(currentSaving);

    this.summaryService.updateWorkflowStatus(slNo, draft.status, draft.netMeterInput).subscribe({
      next: () => {
        const saving = new Set(this.savingStatusSlNos());
        saving.delete(slNo);
        this.savingStatusSlNos.set(saving);

        this.cancelStatusEdit(slNo);
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${day}-${month}-${year}`;
        this.toastService.success(`Status updated to "${draft.status}" with date (${dateStr}) successfully!`);
        this.summaryService.loadAllData().subscribe();
      },
      error: (err) => {
        const saving = new Set(this.savingStatusSlNos());
        saving.delete(slNo);
        this.savingStatusSlNos.set(saving);
        this.toastService.error('Error updating status: ' + (err.message || 'Server error'));
      }
    });
  }

  // Cost Edit helpers
  isCostEditing(slNo: number): boolean {
    return this.editingCostSlNo() === slNo;
  }

  isSavingCost(slNo: number): boolean {
    return this.savingCostSlNos().has(slNo);
  }

  startCostEdit(item: SummaryTableRow): void {
    this.costEditDrafts[item.slNo] = item.fin.turnover;
    this.editingCostSlNo.set(item.slNo);
  }

  cancelCostEdit(slNo: number): void {
    delete this.costEditDrafts[slNo];
    if (this.editingCostSlNo() === slNo) {
      this.editingCostSlNo.set(null);
    }
  }

  saveCostEdit(item: SummaryTableRow): void {
    const slNo = item.slNo;
    const rawVal = this.costEditDrafts[slNo];
    const newCost = Number(rawVal);
    if (isNaN(newCost) || newCost < 0) {
      this.toastService.warning('Please enter a valid cost amount.');
      return;
    }

    const currentSaving = new Set(this.savingCostSlNos());
    currentSaving.add(slNo);
    this.savingCostSlNos.set(currentSaving);

    this.summaryService.saveCustomerCost(slNo, newCost).subscribe({
      next: () => {
        const saving = new Set(this.savingCostSlNos());
        saving.delete(slNo);
        this.savingCostSlNos.set(saving);

        this.cancelCostEdit(slNo);
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${day}-${month}-${year}`;
        this.toastService.success(`Customer Cost updated to ${this.fmtCurr(newCost)} with date (${dateStr}) successfully!`);
        this.summaryService.loadAllData().subscribe();
      },
      error: (err) => {
        const saving = new Set(this.savingCostSlNos());
        saving.delete(slNo);
        this.savingCostSlNos.set(saving);
        this.toastService.error('Error updating customer cost: ' + (err.message || 'Server error'));
      }
    });
  }

  // Pending Edit helpers
  isPendingEditing(slNo: number): boolean {
    return this.editingPendingSlNo() === slNo;
  }

  isSavingPending(slNo: number): boolean {
    return this.savingPendingSlNos().has(slNo);
  }

  startPendingEdit(item: SummaryTableRow): void {
    this.pendingEditDrafts[item.slNo] = item.fin.unpaid;
    this.editingPendingSlNo.set(item.slNo);
  }

  cancelPendingEdit(slNo: number): void {
    delete this.pendingEditDrafts[slNo];
    if (this.editingPendingSlNo() === slNo) {
      this.editingPendingSlNo.set(null);
    }
  }

  savePendingEdit(item: SummaryTableRow): void {
    const slNo = item.slNo;
    const rawVal = this.pendingEditDrafts[slNo];
    const newPending = Number(rawVal);
    if (isNaN(newPending) || newPending < 0) {
      this.toastService.warning('Please enter a valid pending amount.');
      return;
    }

    const currentSaving = new Set(this.savingPendingSlNos());
    currentSaving.add(slNo);
    this.savingPendingSlNos.set(currentSaving);

    this.summaryService.updateCustomerPending(slNo, newPending).subscribe({
      next: () => {
        const saving = new Set(this.savingPendingSlNos());
        saving.delete(slNo);
        this.savingPendingSlNos.set(saving);

        this.cancelPendingEdit(slNo);
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${day}-${month}-${year}`;
        this.toastService.success(`Pending amount updated to ${this.fmtCurr(newPending)} with date (${dateStr}) successfully!`);
        this.summaryService.loadAllData().subscribe();
      },
      error: (err) => {
        const saving = new Set(this.savingPendingSlNos());
        saving.delete(slNo);
        this.savingPendingSlNos.set(saving);
        this.toastService.error('Error updating pending amount: ' + (err.message || 'Server error'));
      }
    });
  }

  openEditCustomer(row: InstallmentRow): void {
    if (!this.authService.isAdmin()) return;
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
    if (!this.authService.isAdmin()) return;
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

    const TABLE_COLUMN_ORDER = [
      'customer',
      'delayedLogin',
      'statusEdit',
      'customerCost',
      'pendingAmount',
      'payment',
      'material',
      'delivery',
      'meter',
      'install',
      'gst',
      'others',
      'profit',
      'pvmodule',
      'inverter'
    ];

    const allCols = this.summaryService.columns();
    const visibleCols = TABLE_COLUMN_ORDER
      .map(key => allCols.find(c => c.key === key))
      .filter((c): c is (typeof allCols)[0] => !!c && c.visible);

    if (visibleCols.length === 0) {
      this.toastService.show('No visible columns to copy. Please select columns first.', 'warning');
      return;
    }

    const lines: string[] = [];

    // Header line with visible column labels
    const headerRow = ['#', ...visibleCols.map(c => c.label)].join('\t');
    lines.push(headerRow);

    const activeGroups = groups.filter(grp => grp.list.length > 0);
    const hasMultipleGroups = activeGroups.length > 1;
    let serialNo = 1;

    activeGroups.forEach(grp => {
      if (hasMultipleGroups) {
        lines.push(`--- ${grp.name} (${grp.list.length}) ---`);
      }

      grp.list.forEach(item => {
        const rowVals = visibleCols.map(c => this.getColumnValue(item, c.key));
        lines.push([`${serialNo}`, ...rowVals].join('\t'));
        serialNo++;
      });
    });

    // Totals summary
    const tot = this.summaryService.totals();
    lines.push('');
    lines.push(`Total Paid: ${this.fmtCurr(tot.paid)}`);
    lines.push(`Total Unpaid: ${this.fmtCurr(tot.unpaid)}`);

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.toastService.show('Customer summary copied to clipboard!', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.toastService.show('Customer summary copied to clipboard!', 'success');
    });
  }

  private getColumnValue(item: SummaryTableRow, key: string): string {
    switch (key) {
      case 'customer':
        return `${item.name || 'Unnamed'} (${item.stageName || 'N/A'})`;
      case 'delayedLogin':
        const delay = this.getDelayInfo(item);
        if (!delay) return '—';
        return `${delay.dateStr} (${delay.text})`;
      case 'statusEdit':
        return this.getStatusDraftValue(item) || item.stageName || '';
      case 'customerCost':
        return this.fmtCurr(item.fin.turnover);
      case 'pendingAmount':
        return this.fmtCurr(item.fin.unpaid);
      case 'payment':
        return item.fin.unpaid > 0
          ? `${this.fmtCurr(item.fin.paid)} (Unpaid: ${this.fmtCurr(item.fin.unpaid)})`
          : this.fmtCurr(item.fin.paid);
      case 'material':
        return this.fmtCurr(item.fin.material);
      case 'delivery':
        return this.fmtCurr(item.fin.delivery);
      case 'meter':
        return this.fmtCurr(item.fin.meter);
      case 'install':
        return this.fmtCurr(item.fin.install);
      case 'gst':
        return this.fmtCurr(item.fin.gst);
      case 'others':
        return this.fmtCurr(item.fin.others);
      case 'profit':
        return this.fmtCurr(item.fin.profit);
      case 'pvmodule':
        return item.pvModuleMake || '—';
      case 'inverter':
        return item.inverterMake || '—';
      default:
        return '';
    }
  }

  fmtCurr(n: number): string {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  parseDate(dStr?: string | null): Date | null {
    if (!dStr) return null;
    const str = String(dStr).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const parts = str.substring(0, 10).split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? null : dt;
  }

  formatDisplayDate(dt: Date): string {
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  }

  getDelayInfo(item: SummaryTableRow): { text: string; colorType: 'red' | 'yellow' | 'normal'; totalDays: number; dateStr: string } | null {
    const rawDate = item.row?.LoginDate || item.row?.CreatedAt;
    if (!rawDate) return null;
    const d = this.parseDate(rawDate);
    if (!d) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - d.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 0) return { totalDays, text: '0D', colorType: 'normal', dateStr: this.formatDisplayDate(d) };

    let y = today.getFullYear() - d.getFullYear();
    let m = today.getMonth() - d.getMonth();
    let day = today.getDate() - d.getDate();

    if (day < 0) {
      m -= 1;
      const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      day += prevMonthDays;
    }
    if (m < 0) {
      y -= 1;
      m += 12;
    }

    const parts: string[] = [];
    if (y > 0) parts.push(`${y}Y`);
    if (m > 0) parts.push(`${m}M`);
    if (day > 0 || parts.length === 0) parts.push(`${day}D`);

    const text = parts.join(' ');
    let colorType: 'red' | 'yellow' | 'normal' = 'normal';
    if (totalDays > 90) {
      colorType = 'red';
    } else if (totalDays > 60) {
      colorType = 'yellow';
    }

    return { totalDays, text, colorType, dateStr: this.formatDisplayDate(d) };
  }
}
