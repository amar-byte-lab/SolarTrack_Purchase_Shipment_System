import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../core/services/summary.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { 
  SummaryTableRow, 
  InstallmentRow, 
  InstallmentTxnRow, 
  ActivityLogItem, 
  WORKFLOW_STAGES 
} from '../../../core/models/summary.model';

export interface TimelineEventItem {
  id: string;
  type: 'status' | 'payment' | 'milestone' | 'info';
  date: string;
  time?: string;
  title: string;
  description?: string;
  amount?: number;
  badgeText: string;
  badgeClass: string;
  icon: string;
  user?: string;
  rawTimestamp?: string;
}

@Component({
  selector: 'app-customer-history-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-history-modal.component.html',
  styleUrls: ['./customer-history-modal.component.scss']
})
export class CustomerHistoryModalComponent {
  summaryService = inject(SummaryService);
  authService = inject(AuthService);

  @Input() isOpen = false;
  @Input() summaryRow: SummaryTableRow | null = null;
  @Output() close = new EventEmitter<void>();

  sortOrder: 'desc' | 'asc' = 'desc';

  get customer(): InstallmentRow | null {
    return this.summaryRow?.row || null;
  }

  get customerName(): string {
    return this.summaryRow?.name || this.customer?.Name || 'Customer';
  }

  get consumerNo(): string {
    return this.summaryRow?.consumerNo || this.customer?.ConsumerNo || '—';
  }

  get mobile(): string {
    return this.summaryRow?.mobile || this.customer?.MobileNumber || '—';
  }

  get district(): string {
    return this.summaryRow?.district || this.customer?.District || '—';
  }

  get currentStage(): string {
    return this.summaryRow?.stageName || this.customer?.Status || 'Login';
  }

  get stageClass(): string {
    return this.summaryRow?.stageClass || 'stage-badge-login';
  }

  get cost(): number {
    return this.summaryRow?.fin?.turnover || Number(this.customer?.CommittedPrice) || 0;
  }

  get paid(): number {
    return this.summaryRow?.fin?.paid || 0;
  }

  get unpaid(): number {
    return this.summaryRow?.fin?.unpaid != null ? this.summaryRow.fin.unpaid : Math.max(0, this.cost - this.paid);
  }

  // 8 Workflow Milestones
  get milestoneStages() {
    const c = this.customer;
    if (!c) return [];

    let work: any = {};
    if (c.BrokerNumber && c.BrokerNumber.includes('|work:')) {
      try {
        const idx = c.BrokerNumber.indexOf('|work:');
        const end = c.BrokerNumber.indexOf('|', idx + 1);
        const str = end !== -1 ? c.BrokerNumber.slice(idx + 6, end) : c.BrokerNumber.slice(idx + 6);
        work = JSON.parse(str) || {};
      } catch {}
    }

    const isNm = Boolean(
      c.NetMeterPaid === true || 
      (c.NetMeterPaid as any) === 'true' || 
      (c.NetMeterPaid as any) === 1 || 
      c.NetMeterDate || 
      work.NetMeterDate
    );

    return [
      {
        num: 1,
        key: 'LoginDate',
        name: 'Login',
        date: c.LoginDate || work.LoginDate || null,
        completed: Boolean(c.LoginDate || work.LoginDate),
        color: '#6366f1'
      },
      {
        num: 2,
        key: 'AgreementDate',
        name: 'Agreement',
        date: c.AgreementDate || work.AgreementDate || null,
        completed: Boolean(c.AgreementDate || work.AgreementDate),
        color: '#8b5cf6'
      },
      {
        num: 3,
        key: 'MaterialDispatchedDate',
        name: 'Dispatched',
        date: c.MaterialDispatchedDate || work.MaterialDispatchedDate || null,
        completed: Boolean(c.MaterialDispatchedDate || work.MaterialDispatchedDate),
        color: '#06b6d4'
      },
      {
        num: 4,
        key: 'InstallationDate',
        name: 'Installation',
        date: c.InstallationDate || work.InstallationDate || null,
        completed: Boolean(c.InstallationDate || work.InstallationDate),
        color: '#f59e0b'
      },
      {
        num: 5,
        key: 'NetMeterDate',
        name: 'Net Meter',
        date: c.NetMeterDate || work.NetMeterDate || (isNm ? (c.SpecsUpdatedAt || c.LoginDate) : null),
        completed: isNm,
        charges: c.NetMeterPayment || work.NetMeterPayment || 0,
        color: '#10b981'
      },
      {
        num: 6,
        key: 'InspectionDate',
        name: 'Inspection',
        date: c.InspectionDate || work.InspectionDate || null,
        completed: Boolean(c.InspectionDate || work.InspectionDate),
        color: '#3b82f6'
      },
      {
        num: 7,
        key: 'MeterConnectedDate',
        name: 'Connection',
        date: c.MeterConnectedDate || work.MeterConnectedDate || null,
        completed: Boolean(c.MeterConnectedDate || work.MeterConnectedDate),
        color: '#14b8a6'
      },
      {
        num: 8,
        key: 'CommissioningDate',
        name: 'Subsidy',
        date: c.CommissioningDate || work.CommissioningDate || null,
        completed: Boolean(c.CommissioningDate || work.CommissioningDate),
        color: '#22c55e'
      }
    ];
  }

  // Customer Transactions
  get transactions(): (InstallmentTxnRow & { runningTotal?: number })[] {
    const slNo = this.summaryRow?.slNo || this.customer?.SlNo;
    if (!slNo) return [];

    const txns: InstallmentTxnRow[] = this.summaryService.getTxnsForCustomer(Number(slNo));
    let run = 0;
    return txns.map((t: InstallmentTxnRow) => {
      run += Number(t.Amount) || 0;
      return { ...t, runningTotal: run };
    });
  }

  // Customer Specific Activity Logs
  get customerLogs(): ActivityLogItem[] {
    const slNo = this.summaryRow?.slNo || this.customer?.SlNo;
    if (!slNo) return [];

    const allLogs: ActivityLogItem[] = this.summaryService.activityItems();
    return allLogs.filter((l: ActivityLogItem) => Number(l.recordId) === Number(slNo) || l.customerName === this.customerName);
  }

  // Combined Timeline of Milestones, Payments, and Activity Logs
  get combinedTimeline(): TimelineEventItem[] {
    const events: TimelineEventItem[] = [];
    const c = this.customer;
    if (!c) return [];

    // 1. Add Milestone Stages with Dates
    this.milestoneStages.forEach(st => {
      if (st.date) {
        const extra = (st.key === 'NetMeterDate' && st.charges) ? `Charges: ₹${Math.round(st.charges).toLocaleString('en-IN')}` : undefined;
        events.push({
          id: `ms_${st.num}_${st.key}`,
          type: 'milestone',
          date: st.date,
          title: `Milestone: ${st.num}. ${st.name} Completed`,
          description: extra,
          badgeText: st.name,
          badgeClass: `bg-primary-subtle text-primary border border-primary-subtle`,
          icon: 'check',
          user: c.BrokerName || 'Staff',
          rawTimestamp: `${st.date}T10:00:00Z`
        });
      }
    });

    // 2. Add Payment Transactions
    this.transactions.forEach((tx: InstallmentTxnRow, idx: number) => {
      const amtStr = `₹${Math.round(Number(tx.Amount) || 0).toLocaleString('en-IN')}`;
      events.push({
        id: `tx_${tx.TxnID || idx}`,
        type: 'payment',
        date: tx.TxnDate || '',
        title: `Payment Received: ${amtStr}`,
        description: `Txn ID: ${tx.TxnID || 'N/A'}${tx.TxnType ? ' • ' + tx.TxnType : ''}`,
        amount: Number(tx.Amount) || 0,
        badgeText: 'Payment',
        badgeClass: 'bg-success-subtle text-success border border-success-subtle',
        icon: 'credit-card',
        user: tx.CreatedBy || 'Admin',
        rawTimestamp: tx.CreatedAt || `${tx.TxnDate}T12:00:00Z`
      });
    });

    // 3. Add Activity Logs (Status updates, cost changes, profile changes)
    this.customerLogs.forEach((l: ActivityLogItem) => {
      // Avoid duplicate synthesized items if milestone/txn is already covered
      if (l.id.startsWith('synth_stg_') || l.id.startsWith('synth_txn_')) return;

      const changeTexts = (l.changes || []).map((ch: any) => {
        if (ch.field === 'Status') {
          return `Status updated from "${ch.oldVal || 'None'}" to "${ch.newVal}"`;
        }
        return `${ch.field}: ${ch.newVal || ''}`;
      }).join(' • ');

      events.push({
        id: l.id,
        type: 'status',
        date: l.date || '',
        time: l.time,
        title: l.changes?.some((ch: any) => ch.field === 'Status') ? `Status Change: ${l.changes.find((ch: any) => ch.field === 'Status')?.newVal}` : `Activity: ${l.action}`,
        description: changeTexts || l.action,
        badgeText: l.changes?.some((ch: any) => ch.field === 'Status') ? 'Status Update' : 'Log',
        badgeClass: 'bg-info-subtle text-info border border-info-subtle',
        icon: 'history',
        user: l.user || 'Admin',
        rawTimestamp: l.timestamp || `${l.date}T12:00:00Z`
      });
    });

    // Sort by Date
    return events.sort((a, b) => {
      const timeA = new Date(a.rawTimestamp || a.date).getTime() || 0;
      const timeB = new Date(b.rawTimestamp || b.date).getTime() || 0;
      return this.sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  toggleSort(): void {
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
  }

  fmtCurr(amount: number | undefined | null): string {
    if (amount == null || isNaN(amount)) return '₹0';
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  formatDisplayDate(val: string | null | undefined): string {
    if (!val) return '—';
    try {
      const parts = val.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD -> DD-MM-YYYY
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return val;
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch {}
    return val;
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
