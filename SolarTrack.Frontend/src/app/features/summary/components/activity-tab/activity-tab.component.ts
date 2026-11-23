import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SummaryService } from '../../../../core/services/summary.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ActivityLogItem } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-activity-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './activity-tab.component.html',
  styleUrls: ['./activity-tab.component.scss']
})
export class ActivityTabComponent {
  summaryService = inject(SummaryService);
  confirmDialogService = inject(ConfirmDialogService);
  toastService = inject(ToastService);

  todayISO = new Date().toISOString().slice(0, 10);
  searchQuery = signal<string>('');
  fromDate = signal<string>(this.todayISO);
  toDate = signal<string>(this.todayISO);
  selectedPreset = signal<string>('TODAY');
  selectedSource = signal<string>('ALL');

  filteredLogs = computed(() => {
    const logs = this.summaryService.activityItems();
    const query = this.searchQuery().toLowerCase().trim();
    const from = this.fromDate();
    const to = this.toDate();
    const preset = this.selectedPreset();
    const source = this.selectedSource();

    return logs.filter(act => {
      // Date filter
      const d = act.date || (act.timestamp ? act.timestamp.slice(0, 10) : '');
      if (preset !== 'ALL') {
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
      }

      // Source filter
      if (source !== 'ALL') {
        const itemPage = (act.page || '').toLowerCase();
        if (source === 'Summary') {
          if (!itemPage.includes('summary') && !itemPage.includes('manage work') && !itemPage.includes('customer')) {
            return false;
          }
        } else if (!itemPage.includes(source.toLowerCase())) {
          return false;
        }
      }

      // Search filter
      if (query) {
        const matchCust = (act.customerName || '').toLowerCase().includes(query);
        const matchUser = (act.user || '').toLowerCase().includes(query);
        const matchPage = (act.page || '').toLowerCase().includes(query);
        const matchAction = (act.action || '').toLowerCase().includes(query);
        const matchChanges = (act.changes || []).some(c => 
          (c.field || '').toLowerCase().includes(query) ||
          String(c.oldVal || '').toLowerCase().includes(query) ||
          String(c.newVal || '').toLowerCase().includes(query)
        );
        if (!matchCust && !matchUser && !matchPage && !matchAction && !matchChanges) return false;
      }

      return true;
    });
  });

  setPreset(preset: string): void {
    this.selectedPreset.set(preset);
    const today = new Date().toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      this.fromDate.set(today);
      this.toDate.set(today);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.fromDate.set(y);
      this.toDate.set(y);
    } else if (preset === '7DAYS') {
      const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      this.fromDate.set(d7);
      this.toDate.set(today);
    } else if (preset === 'ALL') {
      this.fromDate.set('');
      this.toDate.set('');
    }
  }

  onFromDateChange(val: string): void {
    this.fromDate.set(val);
    this.selectedPreset.set('');
  }

  onToDateChange(val: string): void {
    this.toDate.set(val);
    this.selectedPreset.set('');
  }

  setSource(source: string): void {
    this.selectedSource.set(source);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.setPreset('TODAY');
    this.setSource('ALL');
  }

  presetStats = computed(() => {
    return [
      { key: 'TODAY', label: 'Today', active: this.selectedPreset() === 'TODAY' },
      { key: 'YESTERDAY', label: 'Yesterday', active: this.selectedPreset() === 'YESTERDAY' },
      { key: '7DAYS', label: 'Last 7 Days', active: this.selectedPreset() === '7DAYS' },
      { key: 'ALL', label: 'All Dates', active: this.selectedPreset() === 'ALL' }
    ];
  });

  sourceStats = computed(() => {
    const logs = this.summaryService.activityItems();
    const query = this.searchQuery().toLowerCase().trim();
    const from = this.fromDate();
    const to = this.toDate();
    const preset = this.selectedPreset();

    const dateLogs = logs.filter(act => {
      const d = act.date || (act.timestamp ? act.timestamp.slice(0, 10) : '');
      if (preset !== 'ALL') {
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
      }
      if (query) {
        const matchCust = (act.customerName || '').toLowerCase().includes(query);
        const matchUser = (act.user || '').toLowerCase().includes(query);
        const matchPage = (act.page || '').toLowerCase().includes(query);
        const matchAction = (act.action || '').toLowerCase().includes(query);
        const matchChanges = (act.changes || []).some(c => 
          (c.field || '').toLowerCase().includes(query) ||
          String(c.oldVal || '').toLowerCase().includes(query) ||
          String(c.newVal || '').toLowerCase().includes(query)
        );
        if (!matchCust && !matchUser && !matchPage && !matchAction && !matchChanges) return false;
      }
      return true;
    });

    const sources = [
      { key: 'ALL', label: 'All Pages' },
      { key: 'Summary', label: 'Summary' },
      { key: 'Ledger', label: 'Ledger' }
    ];

    return sources.map(s => {
      let count = 0;
      if (s.key === 'ALL') {
        count = dateLogs.length;
      } else if (s.key === 'Summary') {
        count = dateLogs.filter(act => {
          const p = (act.page || '').toLowerCase();
          return p.includes('summary') || p.includes('manage work') || p.includes('customer');
        }).length;
      } else {
        count = dateLogs.filter(act => (act.page || '').toLowerCase().includes(s.key.toLowerCase())).length;
      }
      return {
        key: s.key,
        label: s.label,
        count,
        active: this.selectedSource() === s.key
      };
    });
  });

  async undoActivity(act: ActivityLogItem): Promise<void> {
    if (act.undone) {
      this.toastService.show('Transaction has already been undone.', 'warning');
      return;
    }

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Revert Database Transaction',
      message: `Are you sure you want to revert this database transaction for "${act.customerName || 'Customer'}"? The previous data will be restored directly into the database.`,
      confirmText: 'Yes, Undo Change',
      isDanger: true
    });

    if (!confirmed) return;

    this.summaryService.undoActivity(act).subscribe({
      next: () => {
        this.toastService.show('Transaction successfully reverted and database restored!', 'success');
      },
      error: (err) => {
        this.toastService.show(err.message || 'Failed to undo transaction', 'danger');
      }
    });
  }

  formatTimestamp(iso?: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
             d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return iso;
    }
  }
}
