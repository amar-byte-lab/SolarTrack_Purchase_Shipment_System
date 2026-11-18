import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customer-mapping-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-mapping-table.component.html',
  styleUrls: ['./customer-mapping-table.component.scss']
})
export class CustomerMappingTableComponent {
  @Input() customers: any[] = [];
  @Input() selectAll: boolean = true;
  @Input() maxHeight: string = '500px';
  @Input() allowSelection: boolean = true;
  @Input() emptyMessage: string = 'No customer records to display.';

  @Output() selectAllChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() customerChange = new EventEmitter<{ item: any; field: string }>();

  toggleSelectAll(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.selectAll = isChecked;
    this.selectAllChange.emit(this.selectAll);

    this.customers.forEach(c => {
      if (!c.IsDuplicate) {
        c.selected = isChecked;
      }
    });
    this.selectionChange.emit(this.getSelectedCustomers());
  }

  onItemSelectChange(): void {
    const selectable = this.customers.filter(c => !c.IsDuplicate);
    this.selectAll = selectable.length > 0 && selectable.every(c => c.selected);
    this.selectAllChange.emit(this.selectAll);
    this.selectionChange.emit(this.getSelectedCustomers());
  }

  onFieldChanged(item: any, field: string): void {
    item._isDirty = true;
    this.customerChange.emit({ item, field });
  }

  getSelectedCustomers(): any[] {
    return this.customers.filter(c => c.selected && !c.IsDuplicate);
  }

  formatDiscom(subDiv?: string, div?: string, circle?: string): string {
    const parts = [subDiv, div].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : (circle || '—');
  }

  fmtDateExcel(d: any): string {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  }

  getDelayInfo(dateStr: string | null | undefined): { text: string; colorType: 'red' | 'yellow' | 'normal' } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - d.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 0) return { text: '0D', colorType: 'normal' };

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

    return { text, colorType };
  }
}
