import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IconComponent } from '../icon/icon.component';
import { SummaryService } from '../../../core/services/summary.service';
import { AuthService } from '../../../core/services/auth.service';
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
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() customer: InstallmentRow | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<InstallmentRow>();

  readonly districts = ODISHA_DISTRICTS;

  // Form Fields
  slNo: number | null = null;
  name = '';
  consumerNo = '';
  applicationNo = '';
  proposedCapacity = '';
  circle = '';
  division = '';
  subDivision = '';
  district = '';
  mobile = '';
  loginDate = '';
  address = '';
  brand = '';
  brokerName = '';
  brokerPhone = '';
  pinCode = '';
  state = 'Odisha';

  // Financial & Expense Fields
  customerPrice = 0;
  partnerPrice = 0;
  commission = 0;
  materialCost = 0;
  transportCost = 0;
  otherCost = 0;
  installationCost = 0;
  gstPercentage = 18;
  netMeterPayment = 0;
  netMeterPaid = false;

  isSaving = false;

  get modalTitle(): string {
    return this.slNo ? 'Edit Customer Record' : 'Add New Customer Record';
  }

  get isPartnerRole(): boolean {
    const user = this.authService.currentUser();
    return user?.role === 'partner' || user?.role === 'associates';
  }

  get partnerOptions(): string[] {
    return this.summaryService.partnerList();
  }

  get gstAmount(): number {
    const price = Number(this.customerPrice) || 0;
    const gstPct = Number(this.gstPercentage) || 0;
    return price * (gstPct / 100);
  }

  get totalExpense(): number {
    const mat = Number(this.materialCost) || 0;
    const inst = Number(this.installationCost) || 0;
    const trans = Number(this.transportCost) || 0;
    const oth = Number(this.otherCost) || 0;
    return mat + inst + trans + this.gstAmount + oth;
  }

  get estimatedProfit(): number {
    const partner = Number(this.partnerPrice) || 0;
    const comm = Number(this.commission) || 0;
    return partner - comm - this.totalExpense;
  }

  get delayInfo(): { text: string; totalDays: number; colorType: string } | null {
    if (!this.loginDate) return null;
    const d = new Date(this.loginDate);
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
      this.consumerNo = r.ConsumerNo || '';
      this.applicationNo = r.ApplicationNumber || '';
      this.proposedCapacity = r.ProposedCapacity || '';
      this.circle = r.CircleName || '';
      this.division = r.DivisionName || '';
      this.subDivision = r.SubDivision || '';
      this.district = r.District || '';
      this.mobile = r.MobileNumber || '';
      this.loginDate = r.LoginDate ? this.formatDateForInput(r.LoginDate) : '';
      this.address = r.Address || '';
      this.brand = r.CommittedBrand || '';
      this.brokerName = r.BrokerName || '';
      this.pinCode = r.PinCode || '';
      this.state = r.State || 'Odisha';

      this.customerPrice = Number(r.CommittedPrice) || 0;
      this.commission = Number(r.Commission) || 0;

      // Extract broker number parts, expenses JSON, and work metadata
      let expenses: any = null;
      let phoneClean = '';
      if (r.BrokerNumber) {
        phoneClean = r.BrokerNumber.split('|')[0] || '';
        if (r.BrokerNumber.includes('|expenses:')) {
          try {
            expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]);
          } catch (e) {
            console.warn('Error parsing expenses from BrokerNumber:', e);
          }
        }
      }
      this.brokerPhone = phoneClean;

      this.materialCost = Number(expenses?.material) || 0;
      this.partnerPrice = Number(expenses?.partner) || 0;
      this.installationCost = Number(expenses?.install) || 0;
      this.transportCost = Number(expenses?.transport) || 0;
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
    } else {
      // New Customer Defaults
      this.slNo = null;
      this.name = '';
      this.consumerNo = '';
      this.applicationNo = '';
      this.proposedCapacity = '';
      this.circle = '';
      this.division = '';
      this.subDivision = '';
      this.district = '';
      this.mobile = '';
      this.loginDate = new Date().toISOString().slice(0, 10);
      this.address = '';
      this.brand = '';
      this.brokerPhone = '';
      this.pinCode = '';
      this.state = 'Odisha';

      this.customerPrice = 0;
      this.partnerPrice = 0;
      this.commission = 0;
      this.materialCost = 0;
      this.transportCost = 0;
      this.otherCost = 0;
      this.installationCost = 0;
      this.gstPercentage = 18;
      this.netMeterPayment = 0;
      this.netMeterPaid = false;

      const currentUser = this.authService.currentUser();
      if (this.isPartnerRole && currentUser) {
        this.brokerName = currentUser.username || currentUser.userid || '';
      } else {
        this.brokerName = '';
      }
    }
  }

  private formatDateForInput(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {}
    return dateStr.slice(0, 10);
  }

  onClose(): void {
    this.close.emit();
  }

  saveCustomer(): void {
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.toastService.error('Customer Name is required.');
      return;
    }

    this.isSaving = true;
    const existing = this.customer;

    // Expenses object
    const calculatedGst = this.gstAmount;
    const calculatedTotalExpense = this.totalExpense;

    const expenses = {
      material: Number(this.materialCost) || 0,
      partner: Number(this.partnerPrice) || 0,
      install: Number(this.installationCost) || 0,
      transport: Number(this.transportCost) || 0,
      gst_pct: Number(this.gstPercentage) || 0,
      gst: calculatedGst,
      other: Number(this.otherCost) || 0,
      net_meter_payment: Number(this.netMeterPayment) || 0,
      net_meter_paid: Boolean(this.netMeterPaid)
    };

    // Work metadata
    const workMeta: any = {
      SubDivision: this.subDivision.trim(),
      DivisionName: this.division.trim(),
      CircleName: this.circle.trim(),
      ApplicationNumber: this.applicationNo.trim(),
      ProposedCapacity: this.proposedCapacity.trim()
    };

    if (existing) {
      if (existing.ProductSpecs) workMeta.ProductSpecs = existing.ProductSpecs;
      if (existing.SpecsUpdatedBy) workMeta.SpecsUpdatedBy = existing.SpecsUpdatedBy;
      if (existing.SpecsUpdatedAt) workMeta.SpecsUpdatedAt = existing.SpecsUpdatedAt;
      const stageKeys: (keyof InstallmentRow)[] = [
        'AgreementDate', 'MaterialDispatchedDate', 'NetMeterDate', 
        'InspectionDate', 'MeterConnectedDate', 'CommissioningDate'
      ];
      stageKeys.forEach(k => {
        if (existing[k]) workMeta[k] = existing[k];
      });
    }

    // Creator suffix
    const currentUser = this.authService.currentUser();
    let creatorSuffix = '';
    if (existing?.BrokerNumber && existing.BrokerNumber.includes('|creator:')) {
      creatorSuffix = '|creator:' + existing.BrokerNumber.split('|creator:')[1].split('|')[0];
    } else if (currentUser) {
      creatorSuffix = '|creator:' + (currentUser.userid || currentUser.username);
    }

    const phoneClean = (this.brokerPhone || '').trim().split('|')[0];
    const baseBroker = phoneClean + creatorSuffix + '|expenses:' + JSON.stringify(expenses);
    const formattedBrokerNumber = `${baseBroker}|work:${JSON.stringify(workMeta)}`;

    const rowData: Partial<InstallmentRow> = {
      Name: trimmedName,
      ConsumerNo: this.consumerNo.trim(),
      ApplicationNumber: workMeta.ApplicationNumber,
      ProposedCapacity: workMeta.ProposedCapacity,
      CircleName: workMeta.CircleName,
      DivisionName: workMeta.DivisionName,
      SubDivision: workMeta.SubDivision,
      MobileNumber: this.mobile.trim(),
      District: this.district,
      PinCode: this.pinCode.trim(),
      State: this.state.trim() || 'Odisha',
      Address: this.address.trim(),
      CommittedBrand: this.brand.trim(),
      CommittedPrice: Number(this.customerPrice) || 0,
      VendorPrice: calculatedTotalExpense,
      LoginDate: this.loginDate || undefined,
      BrokerName: this.brokerName.trim(),
      BrokerNumber: formattedBrokerNumber,
      Commission: Number(this.commission) || 0,
      NetMeterPayment: expenses.net_meter_payment,
      NetMeterPaid: expenses.net_meter_paid
    };

    if (this.slNo) {
      // Update existing record
      this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${this.slNo}`, rowData).subscribe({
        next: () => {
          this.toastService.success('Customer record updated successfully.');
          this.summaryService.loadAllData().subscribe(() => {
            this.isSaving = false;
            this.saved.emit({ ...existing, ...rowData } as InstallmentRow);
            this.close.emit();
          });
        },
        error: (err) => {
          console.error('Update error:', err);
          this.isSaving = false;
          this.toastService.error('Error updating customer: ' + (err.message || 'Server error'));
        }
      });
    } else {
      // Insert new record
      const allRows = this.summaryService.rawInstallments();
      const maxSl = allRows.reduce((max, r) => Math.max(max, Number(r.SlNo) || 0), 0);
      const newSlNo = maxSl + 1;

      const newRow: Partial<InstallmentRow> = {
        ...rowData,
        SlNo: newSlNo,
        Status: 'Active',
        FirstInstallment: 0,
        SecondInstallment: 0,
        ThirdInstallment: 0,
        Total: 0,
        VendorPaid: 0,
        CommissionPaid: 0
      };

      this.http.post('/api/insert?table=installments', newRow).subscribe({
        next: () => {
          this.toastService.success('New customer record added successfully.');
          this.summaryService.loadAllData().subscribe(() => {
            this.isSaving = false;
            this.saved.emit(newRow as InstallmentRow);
            this.close.emit();
          });
        },
        error: (err) => {
          console.error('Insert error:', err);
          this.isSaving = false;
          this.toastService.error('Error creating customer: ' + (err.message || 'Server error'));
        }
      });
    }
  }
}
