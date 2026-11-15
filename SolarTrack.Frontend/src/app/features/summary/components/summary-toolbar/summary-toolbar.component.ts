import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SummaryService } from '../../../../core/services/summary.service';

@Component({
  selector: 'app-summary-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './summary-toolbar.component.html',
  styleUrls: ['./summary-toolbar.component.scss']
})
export class SummaryToolbarComponent {
  summaryService = inject(SummaryService);

  isPartnerMenuOpen = false;

  onSearchChange(val: string): void {
    this.summaryService.searchText.set(val);
  }

  togglePartnerDropdown(): void {
    this.isPartnerMenuOpen = !this.isPartnerMenuOpen;
  }

  closePartnerDropdown(): void {
    this.isPartnerMenuOpen = false;
  }

  isPartnerSelected(partner: string): boolean {
    return this.summaryService.selectedPartners().includes(partner);
  }

  togglePartner(partner: string): void {
    const current = this.summaryService.selectedPartners();
    if (current.includes(partner)) {
      this.summaryService.selectedPartners.set(current.filter(p => p !== partner));
    } else {
      this.summaryService.selectedPartners.set([...current, partner]);
    }
  }

  get partnerDropdownLabel(): string {
    const sel = this.summaryService.selectedPartners();
    if (sel.length === 0) return 'All Partners';
    if (sel.length === 1) return sel[0];
    return `${sel.length} Partners`;
  }

  toggleDistrict(distVal: string): void {
    if (distVal === 'ALL') {
      this.summaryService.selectedDistricts.set([]);
      return;
    }
    const current = this.summaryService.selectedDistricts();
    if (current.includes(distVal)) {
      this.summaryService.selectedDistricts.set(current.filter(d => d !== distVal));
    } else {
      this.summaryService.selectedDistricts.set([...current, distVal]);
    }
  }

  selectStage(stVal: string): void {
    const current = this.summaryService.selectedStage();
    if (stVal === 'ALL' || current === stVal) {
      this.summaryService.selectedStage.set('ALL');
    } else {
      this.summaryService.selectedStage.set(stVal);
    }
  }

  togglePaymentFilter(payVal: string): void {
    if (payVal === 'ALL') {
      this.summaryService.selectedPaymentFilters.set([]);
      return;
    }
    const current = this.summaryService.selectedPaymentFilters();
    if (current.includes(payVal)) {
      this.summaryService.selectedPaymentFilters.set(current.filter(k => k !== payVal));
    } else {
      this.summaryService.selectedPaymentFilters.set([...current, payVal]);
    }
  }

  clearFilters(): void {
    this.summaryService.searchText.set('');
    this.summaryService.selectedPartners.set([]);
    this.summaryService.selectedDistricts.set([]);
    this.summaryService.selectedStage.set('ALL');
    this.summaryService.selectedPaymentFilters.set([]);
  }
}
