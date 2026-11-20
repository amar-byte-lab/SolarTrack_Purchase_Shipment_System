import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ODISHA_DISTRICTS } from '../../../../shared/components/customer-modal/customer-modal.component';

export interface CustomerMappingEditModel {
  SlNo?: number | string;
  Name?: string;
  ConsumerNo?: string;
  ApplicationNumber?: string;
  ProposedCapacity?: string | number;
  SubDivision?: string;
  DivisionName?: string;
  CircleName?: string;
  MobileNumber?: string;
  Address?: string;
  PinCode?: string;
  District?: string;
  BrokerName?: string;
  Status?: string;
}

@Component({
  selector: 'app-customer-mapping-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-mapping-edit-modal.component.html',
  styleUrls: ['./customer-mapping-edit-modal.component.scss']
})
export class CustomerMappingEditModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() customer: any = null;
  @Input() districts: string[] = ODISHA_DISTRICTS;
  @Input() partnerOptions: string[] = [];
  @Input() isSaving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CustomerMappingEditModel>();

  readonly statusOptions: string[] = ['Active', 'Deactive', 'Pending', 'New Name', 'Duplicate (In Excel)'];

  form: CustomerMappingEditModel = {
    SlNo: '',
    Name: '',
    ConsumerNo: '',
    ApplicationNumber: '',
    ProposedCapacity: '',
    SubDivision: '',
    DivisionName: '',
    CircleName: '',
    MobileNumber: '',
    Address: '',
    PinCode: '',
    District: '',
    BrokerName: '',
    Status: 'Active'
  };

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] && this.isOpen) || (changes['customer'] && this.customer)) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (!this.customer) return;
    this.form = {
      SlNo: this.customer.SlNo,
      Name: this.customer.Name || '',
      ConsumerNo: this.customer.ConsumerNo || '',
      ApplicationNumber: this.customer.ApplicationNumber || '',
      ProposedCapacity: this.customer.ProposedCapacity || '',
      SubDivision: this.customer.SubDivision || '',
      DivisionName: this.customer.DivisionName || '',
      CircleName: this.customer.CircleName || '',
      MobileNumber: this.customer.MobileNumber || '',
      Address: (this.customer.Address || '').toUpperCase(),
      PinCode: this.customer.PinCode || this.customer.Pin || '',
      District: this.customer.District || '',
      BrokerName: this.customer.BrokerName || '',
      Status: this.customer.Status || 'Active'
    };
  }

  onAddressInput(val: string): void {
    this.form.Address = (val || '').toUpperCase();
  }

  onSave(): void {
    if (this.form.Address) {
      this.form.Address = this.form.Address.toUpperCase();
    }
    this.save.emit({ ...this.form });
  }

  onClose(): void {
    if (!this.isSaving) {
      this.close.emit();
    }
  }
}
