import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-select',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-select.component.html',
  styleUrls: ['./customer-select.component.scss'],
  host: {
    '[class.is-open]': 'isOpen()',
    '[style.position]': '"relative"',
    '[style.z-index]': 'isOpen() ? "1080" : "auto"'
  }
})
export class CustomerSelectComponent {
  private elementRef = inject(ElementRef);

  @Input() set customers(val: InstallmentRow[]) {
    this.customersSignal.set(val || []);
  }

  @Input() set selectedName(val: string) {
    this.selectedNameSignal.set(val || '');
  }
  get selectedName(): string {
    return this.selectedNameSignal();
  }

  @Input() placeholder: string = '-- Select Customer --';
  @Input() disabled: boolean = false;

  @Output() selectedNameChange = new EventEmitter<string>();
  @Output() customerSelected = new EventEmitter<InstallmentRow>();

  readonly customersSignal = signal<InstallmentRow[]>([]);
  readonly selectedNameSignal = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  readonly selectedCustomer = computed(() => {
    const name = this.selectedNameSignal();
    if (!name) return null;
    return this.customersSignal().find(c => c.Name === name) || null;
  });

  readonly filteredCustomers = computed(() => {
    const list = this.customersSignal();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return list;

    return list.filter(c => {
      const name = (c.Name || '').toLowerCase();
      const dist = (c.District || '').toLowerCase();
      const consumer = (c.ConsumerNo || '').toLowerCase();
      const mobile = (c.MobileNumber || '').toLowerCase();
      const sl = String(c.SlNo || '').toLowerCase();
      return name.includes(q) || dist.includes(q) || consumer.includes(q) || mobile.includes(q) || sl.includes(q);
    });
  });

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.searchQuery.set('');
    }
  }

  openDropdown(): void {
    if (this.disabled) return;
    this.isOpen.set(true);
    this.searchQuery.set('');
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  selectCustomer(c: InstallmentRow, event?: Event): void {
    if (event) event.stopPropagation();
    const cName = c.Name || '';
    this.selectedNameSignal.set(cName);
    this.selectedNameChange.emit(cName);
    this.customerSelected.emit(c);
    this.closeDropdown();
  }

  clearSearch(event: Event): void {
    event.stopPropagation();
    this.searchQuery.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.closeDropdown();
    }
  }
}
