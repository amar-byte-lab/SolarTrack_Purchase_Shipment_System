import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../../core/services/summary.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { InstallmentRow } from '../../../../core/models/summary.model';

export interface WorkflowStageItem {
  key: keyof InstallmentRow;
  label: string;
  num: number;
  color: string;
}

export const WORKFLOW_STAGES: WorkflowStageItem[] = [
  { key: 'LoginDate', label: '1. LOGIN', num: 1, color: '#0284c7' },
  { key: 'AgreementDate', label: '2. AGREEMENT', num: 2, color: '#7c3aed' },
  { key: 'MaterialDispatchedDate', label: '3. DISPATCHED', num: 3, color: '#0891b2' },
  { key: 'InstallationDate', label: '4. INSTALL', num: 4, color: '#d97706' },
  { key: 'NetMeterDate', label: '5. NETMETER', num: 5, color: '#7c3aed' },
  { key: 'InspectionDate', label: '6. INSPECTION', num: 6, color: '#475569' },
  { key: 'MeterConnectedDate', label: '7. CONNECTION', num: 7, color: '#ff4500' },
  { key: 'CommissioningDate', label: '8. SUBSIDY', num: 8, color: '#16a34a' }
];

@Component({
  selector: 'app-process-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './process-card.component.html',
  styleUrls: ['./process-card.component.scss']
})
export class ProcessCardComponent {
  summaryService = inject(SummaryService);
  toastService = inject(ToastService);
  confirmDialogService = inject(ConfirmDialogService);

  @Input() customer: InstallmentRow | null = null;
  @Output() updated = new EventEmitter<void>();

  readonly stages = WORKFLOW_STAGES;

  get todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get completedStagesCount(): number {
    return this.stages.filter(s => this.isStageCompleted(s.key)).length;
  }

  get trackPct(): number {
    const count = this.completedStagesCount;
    return Math.round((count / this.stages.length) * 100);
  }

  getShortLabel(label: string): string {
    const clean = label.replace(/^\d+\.\s*/, '').trim();
    if (clean === 'LOGIN') return 'Login';
    if (clean === 'AGREEMENT') return 'Agree';
    if (clean === 'DISPATCHED') return 'Dispatch';
    if (clean === 'INSTALL') return 'Install';
    if (clean === 'NETMETER') return 'NetMtr';
    if (clean === 'INSPECTION') return 'Inspect';
    if (clean === 'CONNECTION') return 'Connect';
    if (clean === 'SUBSIDY') return 'Subsidy';
    return clean;
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

  getDelayInfo(dateStr?: string): { text: string; totalDays: number; colorType: string } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - d.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 0) return { totalDays, text: '0D', colorType: 'normal' };

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
    let colorType = 'normal';
    if (totalDays > 90) colorType = 'red';
    else if (totalDays > 60) colorType = 'yellow';

    return { totalDays, text, colorType };
  }

  isStageDelayedRed(key: keyof InstallmentRow): boolean {
    const val = this.customer ? this.customer[key] : '';
    if (!val) return false;
    const info = this.getDelayInfo(String(val));
    return info?.colorType === 'red';
  }

  getStageDate(key: keyof InstallmentRow): string {
    const val = this.customer ? this.customer[key] : '';
    if (!val) return '';
    try {
      const d = new Date(String(val));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {}
    return String(val).slice(0, 10);
  }

  isStageCompleted(key: keyof InstallmentRow): boolean {
    if (!this.customer) return false;
    if (key === 'NetMeterDate') {
      return Boolean(this.customer.NetMeterDate || this.customer.NetMeterPaid);
    }
    return Boolean(this.customer[key]);
  }

  onStageToggle(stage: WorkflowStageItem, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const isChecked = checkbox.checked;
    const c = this.customer;
    if (!c) return;

    const custName = c.Name || `Customer #${c.SlNo}`;
    const today = this.todayISO;

    if (isChecked) {
      this.confirmDialogService.confirm({
        title: `Confirm Milestone: ${stage.label}`,
        message: `Mark stage "${stage.label}" as COMPLETED today (${today}) for "${custName}"?`,
        confirmText: 'Yes, Complete',
        isDanger: false
      }).then(confirmed => {
        if (confirmed) {
          this.applyStageChange(stage.key, today);
        } else {
          checkbox.checked = false;
        }
      });
    } else {
      this.confirmDialogService.confirm({
        title: `Revert Milestone: ${stage.label}`,
        message: `Clear date and unmark "${stage.label}" for "${custName}"?`,
        confirmText: 'Yes, Revert',
        isDanger: true
      }).then(confirmed => {
        if (confirmed) {
          this.applyStageChange(stage.key, null);
        } else {
          checkbox.checked = true;
        }
      });
    }
  }

  onDateChange(stage: WorkflowStageItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newDate = input.value;
    const c = this.customer;
    if (!c) return;

    const custName = c.Name || `Customer #${c.SlNo}`;

    this.confirmDialogService.confirm({
      title: `Update Milestone Date: ${stage.label}`,
      message: `Change date for "${stage.label}" to ${newDate || 'None'} for "${custName}"?`,
      confirmText: 'Yes, Update',
      isDanger: false
    }).then(confirmed => {
      if (confirmed) {
        this.applyStageChange(stage.key, newDate || null);
      } else {
        input.value = this.getStageDate(stage.key);
      }
    });
  }

  private applyStageChange(key: keyof InstallmentRow, dateVal: string | null): void {
    const c = this.customer;
    if (!c) return;

    if (key === 'NetMeterDate') {
      const isPaid = dateVal !== null;
      this.summaryService.saveNetMeter(c.SlNo, 0, dateVal || '', isPaid).subscribe({
        next: () => {
          this.toastService.success(`Net Meter status updated successfully.`);
          this.refreshData();
        },
        error: (err) => {
          this.toastService.error('Error updating Net Meter: ' + (err.message || 'Server error'));
        }
      });
      return;
    }

    this.summaryService.saveStageProgress(c.SlNo, { [key]: dateVal || undefined }).subscribe({
      next: () => {
        this.toastService.success(`Milestone stage updated successfully.`);
        this.refreshData();
      },
      error: (err) => {
        this.toastService.error('Error updating stage: ' + (err.message || 'Server error'));
      }
    });
  }

  private refreshData(): void {
    this.summaryService.loadAllData().subscribe(() => {
      this.updated.emit();
    });
  }
}
