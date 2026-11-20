import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { SummaryService } from '../../../core/services/summary.service';
import { ToastService } from '../../../shared/services/toast.service';
import { InstallmentRow } from '../../../core/models/summary.model';

export const ODISHA_DISTRICTS: string[] = [
  'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
  'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
  'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Keonjhar', 'Khordha',
  'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada',
  'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'
];

@Component({
  selector: 'app-customer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-modal.component.html',
  styleUrls: ['./customer-modal.component.scss']
})
export class CustomerModalComponent implements OnChanges {
  private http = inject(HttpClient);
  private summaryService = inject(SummaryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() customer: InstallmentRow | null = null;
  @Input() isViewOnly = false;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<InstallmentRow>();

  // Customer Basic Display (Readonly header info)
  slNo: number | null = null;
  name = '';
  consumerNo = '';
  district = '';

  // Financial & Expense Fields (Editable)
  customerPrice = 0;      // Customer Price / Turnover
  partnerPrice = 0;       // Partner Price
  billingPrice = 0;       // Billing Price (GST is calculated on this)
  customerPayment = 0;    // Customer Payment
  originalPayment = 0;    // Payment tracker
  commission = 0;         // Broker / Partner Commission
  materialCost = 0;       // Material Cost
  deliveryCost = 0;       // Delivery Cost
  installationCost = 0;   // Installation Cost
  netMeterPayment = 0;    // NetMeter Cost
  netMeterPaid = false;   // NetMeter Paid status
  gstPercentage = 18;     // GST (%)
  otherCost = 0;          // Others Cost

  // Payments Info (Readonly from txns)
  totalPaid = 0;

  isSaving = false;

  get modalTitle(): string {
    return this.name ? `Financial Summary: ${this.name}` : (this.slNo ? `Financial Summary: Customer #${this.slNo}` : 'Customer Financial Summary');
  }

  get gstAmount(): number {
    const base = Number(this.billingPrice) || 0;
    const gstPct = Number(this.gstPercentage) || 0;
    return Math.round(base * (gstPct / 100));
  }

  get totalExpense(): number {
    const mat = Number(this.materialCost) || 0;
    const deliv = Number(this.deliveryCost) || 0;
    const nm = Number(this.netMeterPayment) || 0;
    const inst = Number(this.installationCost) || 0;
    const oth = Number(this.otherCost) || 0;
    return mat + deliv + nm + inst + this.gstAmount + oth;
  }

  get estimatedProfit(): number {
    const partner = Number(this.partnerPrice) || 0;
    const custPrice = Number(this.customerPrice) || 0;
    const profitBase = partner > 0 ? partner : custPrice;
    return profitBase - this.totalExpense;
  }

  get unpaidAmount(): number {
    const turnover = Number(this.customerPrice) || 0;
    const paid = Number(this.customerPayment) || 0;
    return Math.max(0, turnover - paid);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['customer']) {
      if (this.isOpen) {
        this.populateForm(this.customer);
      }
    }
  }

  private populateForm(r: InstallmentRow | null): void {
    if (r) {
      this.slNo = r.SlNo ? Number(r.SlNo) : null;
      this.name = r.Name || '';
      this.consumerNo = r.ConsumerNo ? String(r.ConsumerNo) : '';
      this.district = r.District || '';

      // Extract expenses from BrokerNumber if present
      let expenses: any = null;
      if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
        try {
          expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]);
        } catch (e) {}
      }

      this.customerPrice = Number(r.CommittedPrice) || (expenses && Number(expenses.partner)) || 0;
      this.partnerPrice = Number(expenses?.partner) || 0;
      this.billingPrice = (expenses && expenses.billing !== undefined && expenses.billing !== null && expenses.billing !== '')
        ? Number(expenses.billing)
        : 0;
      this.commission = Number(r.Commission) || 0;
      this.materialCost = Number(expenses?.material) || 0;
      this.deliveryCost = (expenses && expenses.delivery !== undefined && expenses.delivery !== '')
        ? Number(expenses.delivery)
        : (Number(expenses?.transport) || 0);
      this.installationCost = Number(expenses?.install) || 0;
      this.otherCost = Number(expenses?.other) || 0;
      this.gstPercentage = (expenses && expenses.gst_pct !== undefined && expenses.gst_pct !== null && expenses.gst_pct !== '') 
        ? Number(expenses.gst_pct) 
        : 18;

      this.netMeterPayment = (r.NetMeterPayment != null && r.NetMeterPayment !== ('' as any)) 
        ? Number(r.NetMeterPayment) 
        : (Number(expenses?.net_meter_payment) || 0);

      this.netMeterPaid = (r.NetMeterPaid != null) 
        ? Boolean(r.NetMeterPaid) 
        : Boolean(expenses?.net_meter_paid);

      // Payment summary
      const payMap = this.summaryService.paymentsMap();
      this.totalPaid = payMap.get(Number(r.SlNo)) || Number(r.Total) || 0;
      this.customerPayment = this.totalPaid;
      this.originalPayment = this.totalPaid;

    } else {
      this.slNo = null;
      this.name = '';
      this.consumerNo = '';
      this.district = '';
      this.customerPrice = 0;
      this.partnerPrice = 0;
      this.billingPrice = 0;
      this.customerPayment = 0;
      this.originalPayment = 0;
      this.commission = 0;
      this.materialCost = 0;
      this.deliveryCost = 0;
      this.installationCost = 0;
      this.otherCost = 0;
      this.gstPercentage = 18;
      this.netMeterPayment = 0;
      this.netMeterPaid = false;
      this.totalPaid = 0;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  saveCustomer(): void {
    this.isSaving = true;
    const existing = this.customer;

    // Expenses object
    const calculatedGst = this.gstAmount;
    const calculatedTotalExpense = this.totalExpense;

    const expenses = {
      material: Number(this.materialCost) || 0,
      partner: Number(this.partnerPrice) || 0,
      billing: Number(this.billingPrice) || 0,
      install: Number(this.installationCost) || 0,
      delivery: Number(this.deliveryCost) || 0,
      transport: Number(this.deliveryCost) || 0,
      gst_pct: Number(this.gstPercentage) || 0,
      gst: calculatedGst,
      other: Number(this.otherCost) || 0,
      net_meter_payment: Number(this.netMeterPayment) || 0,
      net_meter_paid: Boolean(this.netMeterPaid || (Number(this.netMeterPayment) > 0))
    };

    // Reconstruct BrokerNumber with updated expenses while preserving creator and work metadata
    let brokerNumber = existing?.BrokerNumber || '';
    if (brokerNumber) {
      const expIdx = brokerNumber.indexOf('|expenses:');
      if (expIdx !== -1) {
        const expEnd = brokerNumber.indexOf('|', expIdx + 1);
        const expNew = `|expenses:${JSON.stringify(expenses)}`;
        brokerNumber = brokerNumber.slice(0, expIdx) + expNew + (expEnd !== -1 ? brokerNumber.slice(expEnd) : '');
      } else {
        const workIdx = brokerNumber.indexOf('|work:');
        if (workIdx !== -1) {
          brokerNumber = brokerNumber.slice(0, workIdx) + `|expenses:${JSON.stringify(expenses)}` + brokerNumber.slice(workIdx);
        } else {
          brokerNumber += `|expenses:${JSON.stringify(expenses)}`;
        }
      }

      // Also update work metadata if present to sync NetMeter
      const workIdx = brokerNumber.indexOf('|work:');
      if (workIdx !== -1) {
        try {
          const workEnd = brokerNumber.indexOf('|', workIdx + 1);
          const workJson = workEnd !== -1 ? brokerNumber.slice(workIdx + 6, workEnd) : brokerNumber.slice(workIdx + 6);
          const workObj = JSON.parse(workJson) || {};
          workObj.NetMeterPayment = expenses.net_meter_payment;
          workObj.NetMeterPaid = expenses.net_meter_paid;
          const workNew = `|work:${JSON.stringify(workObj)}`;
          brokerNumber = brokerNumber.slice(0, workIdx) + workNew + (workEnd !== -1 ? brokerNumber.slice(workEnd) : '');
        } catch (e) {}
      }
    } else {
      brokerNumber = `|expenses:${JSON.stringify(expenses)}`;
    }

    const payload: Partial<InstallmentRow> = {
      CommittedPrice: Number(this.customerPrice) || 0,
      VendorPrice: calculatedTotalExpense,
      Commission: Number(this.commission) || 0,
      NetMeterPayment: expenses.net_meter_payment,
      NetMeterPaid: expenses.net_meter_paid,
      BrokerNumber: brokerNumber
    };

    if (this.slNo) {
      const payChanged = Number(this.customerPayment) !== Number(this.originalPayment);
      const updateObs$ = this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${this.slNo}`, payload);
      const today = new Date().toISOString().slice(0, 10);
      const save$ = payChanged 
        ? forkJoin([updateObs$, this.summaryService.updateCustomerPaidTotal(this.slNo, Number(this.customerPayment) || 0, today)])
        : updateObs$;

      save$.subscribe({
        next: () => {
          this.toastService.success(`Financial summary for "${this.name || 'Customer'}" updated successfully.`);
          this.summaryService.loadAllData().subscribe(() => {
            this.isSaving = false;
            this.saved.emit({ ...existing, ...payload, Total: Number(this.customerPayment) || 0 } as InstallmentRow);
            this.close.emit();
          });
        },
        error: (err) => {
          console.error('Update error:', err);
          this.isSaving = false;
          this.toastService.error('Error updating financial summary: ' + (err.message || 'Server error'));
        }
      });
    } else {
      this.isSaving = false;
      this.close.emit();
    }
  }
}
