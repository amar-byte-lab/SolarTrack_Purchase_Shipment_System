import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CustomerModalComponent } from '../../../../shared/components/customer-modal/customer-modal.component';
import { InstallmentRow } from '../../../../core/models/summary.model';

@Component({
  selector: 'app-customer-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, CustomerModalComponent],
  templateUrl: './customer-directory.component.html',
  styleUrls: ['./customer-directory.component.scss']
})
export class CustomerDirectoryComponent {
  @Input() customers: InstallmentRow[] = [];
  @Input() selectedCustomer: InstallmentRow | null = null;
  @Input() districtStats: { name: string; count: number }[] = [];
  @Input() selectedDistrict: string = 'All';
  @Input() searchQuery: string = '';

  @Output() customerSelected = new EventEmitter<InstallmentRow>();
  @Output() districtSelected = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() openImportModal = new EventEmitter<void>();

  isModalOpen = false;
  customerForEdit: InstallmentRow | null = null;

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    this.searchChange.emit(val);
  }

  onSelectDistrict(district: string): void {
    this.districtSelected.emit(district);
  }

  onSelectCustomer(cust: InstallmentRow): void {
    this.customerSelected.emit(cust);
  }

  onEditCustomer(cust: InstallmentRow): void {
    this.customerForEdit = cust;
    this.isModalOpen = true;
  }

  onAddCustomer(): void {
    this.customerForEdit = null;
    this.isModalOpen = true;
  }

  onCustomerSaved(cust: InstallmentRow): void {
    this.isModalOpen = false;
    this.customerSelected.emit(cust);
  }
}
