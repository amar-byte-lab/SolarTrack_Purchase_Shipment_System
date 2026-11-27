import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SummaryService } from '../../core/services/summary.service';
import { NavService } from '../../core/services/nav.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { SummaryTableRow, InstallmentRow, WORKFLOW_STAGES } from '../../core/models/summary.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

export interface EditableCostRow {
  slNo: number;
  name: string;
  consumerNo: string;
  district: string;
  brokerName: string;
  pvModuleMake: string;
  inverterMake: string;
  stageIdx: number;
  stageName: string;
  // Editable Fields
  askingPrice: number;
  billingPrice: number;
  systemCost: number;
  installCost: number;
  meterCost: number;
  deliveryCost: number;
  otherCost: number;
  description: string;
  // State
  isSaving: boolean;
  isDirty: boolean;
  rawRow: InstallmentRow;
}

@Component({
  selector: 'app-cost-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './cost-analysis.component.html',
  styleUrls: ['./cost-analysis.component.scss']
})
export class CostAnalysisComponent implements OnInit {
  summaryService = inject(SummaryService);
  navService = inject(NavService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  http = inject(HttpClient);
  router = inject(Router);

  // Filter Signals
  searchQuery = signal<string>('');
  selectedPartners = signal<string[]>([]);
  selectedDistrict = signal<string>('ALL');
  selectedStage = signal<string>('ALL');

  // Sort State for Panel Name & Inverter Name
  sortField = signal<'panel' | 'inverter' | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Google Note Modal State & Signals
  isNoteModalOpen = signal<boolean>(false);
  isNoteSaving = signal<boolean>(false);
  isNoteLoading = signal<boolean>(false);
  noteExistsInDb = signal<boolean>(false);

  // Note Content State
  savedNoteTitle = signal<string>('Cost Analysis Notes');
  savedNoteContent = signal<string>('');
  currentNoteTitle = signal<string>('Cost Analysis Notes');
  currentNoteContent = signal<string>('');
  noteLastUpdated = signal<string>('');

  // Dirty state: checks if current input differs from saved database state
  isNoteDirty = computed<boolean>(() => {
    return this.currentNoteTitle() !== this.savedNoteTitle() ||
           this.currentNoteContent() !== this.savedNoteContent();
  });

  // Indicator for button badge
  hasNoteContent = computed<boolean>(() => {
    return !!(this.savedNoteContent()?.trim() || (this.savedNoteTitle() && this.savedNoteTitle() !== 'Cost Analysis Notes'));
  });

  // Multi-select dropdown state
  isPartnerMenuOpen = signal<boolean>(false);
  isExcludedMenuOpen = signal<boolean>(false);

  // Row selection for exclusion
  selectedSlNos = signal<Set<number>>(new Set());

  // In-memory map of editable rows to preserve user edits across filters
  private editableStore = new Map<number, EditableCostRow>();
  // Store version signal to trigger reactivity when store updates
  storeVersion = signal<number>(0);

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.toastService.warning('Access denied: Cost Analysis is restricted to Administrators.');
      this.router.navigate(['/summary']);
      return;
    }

    this.navService.setPageTitle('Cost Analysis');
    this.loadNotes();
    if (this.summaryService.baseRows().length === 0) {
      this.summaryService.loadAllData().subscribe({
        next: () => {},
        error: (err) => console.error('Error loading cost data:', err)
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.partner-dropdown-container')) {
      this.isPartnerMenuOpen.set(false);
    }
    if (!target.closest('.excluded-dropdown-container')) {
      this.isExcludedMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isPartnerMenuOpen.set(false);
    this.isExcludedMenuOpen.set(false);
    if (this.isNoteModalOpen()) {
      this.closeNotesModal();
    }
  }

  // District list with counts for filtered active set
  districtList = computed<{ district: string; count: number }[]>(() => {
    const all = this.summaryService.allParsedRows();
    const excluded = this.summaryService.excludedSlNos();
    const search = this.searchQuery().toLowerCase().trim();
    const partners = this.selectedPartners();
    const stage = this.selectedStage();
    const counts: { [key: string]: number } = {};

    let total = 0;
    all.forEach(r => {
      if (excluded.has(r.slNo)) return;

      if (stage !== 'ALL') {
        const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === stage);
        if (targetIdx >= 0 && r.stageIdx !== targetIdx) return;
      }

      if (partners.length > 0) {
        const p = (r.brokerName || '').trim();
        const hasNoP = !p || p === '—' || p === '-';
        if (partners.includes('(No Partner)')) {
          if (!hasNoP && !partners.includes(p)) return;
        } else {
          if (hasNoP || !partners.includes(p)) return;
        }
      }

      if (search) {
        const matchesName = (r.name || '').toLowerCase().includes(search);
        const matchesConsumer = (r.consumerNo || '').toLowerCase().includes(search);
        const matchesDistrict = (r.district || '').toLowerCase().includes(search);
        const matchesPartner = (r.brokerName || '').toLowerCase().includes(search);
        if (!matchesName && !matchesConsumer && !matchesDistrict && !matchesPartner) return;
      }

      total++;
      const d = (r.district && r.district.trim()) ? r.district.trim() : 'No District';
      counts[d] = (counts[d] || 0) + 1;
    });

    const list = Object.keys(counts)
      .map(d => ({ district: d, count: counts[d] }))
      .sort((a, b) => {
        if (a.district === 'No District') return 1;
        if (b.district === 'No District') return -1;
        return a.district.localeCompare(b.district);
      });

    return [{ district: 'ALL', count: total }, ...list];
  });

  // Workflow Stage list with dynamic counts
  stageList = computed<{ stage: string; num: number; name: string; count: number }[]>(() => {
    const all = this.summaryService.allParsedRows();
    const excluded = this.summaryService.excludedSlNos();
    const search = this.searchQuery().toLowerCase().trim();
    const partners = this.selectedPartners();
    const district = this.selectedDistrict();

    let total = 0;
    const stageCounts = [0, 0, 0, 0, 0, 0, 0, 0];

    all.forEach(r => {
      if (excluded.has(r.slNo)) return;

      if (district !== 'ALL') {
        const rowD = (r.district && r.district.trim()) ? r.district.trim() : 'No District';
        if (rowD !== district) return;
      }

      if (partners.length > 0) {
        const p = (r.brokerName || '').trim();
        const hasNoP = !p || p === '—' || p === '-';
        if (partners.includes('(No Partner)')) {
          if (!hasNoP && !partners.includes(p)) return;
        } else {
          if (hasNoP || !partners.includes(p)) return;
        }
      }

      if (search) {
        const matchesName = (r.name || '').toLowerCase().includes(search);
        const matchesConsumer = (r.consumerNo || '').toLowerCase().includes(search);
        const matchesDistrict = (r.district || '').toLowerCase().includes(search);
        const matchesPartner = (r.brokerName || '').toLowerCase().includes(search);
        if (!matchesName && !matchesConsumer && !matchesDistrict && !matchesPartner) return;
      }

      total++;
      if (r.stageIdx >= 0 && r.stageIdx < 8) {
        stageCounts[r.stageIdx]++;
      }
    });

    const items = [
      { stage: 'ALL', num: 0, name: 'All Stages', count: total }
    ];

    WORKFLOW_STAGES.forEach((st, idx) => {
      items.push({
        stage: st.key,
        num: st.num,
        name: st.name,
        count: stageCounts[idx] || 0
      });
    });

    return items;
  });

  // Strict GST@5% calculation upon Billing price
  getGst5(r: EditableCostRow): number {
    const billing = Number(r.billingPrice) || 0;
    return Math.round(billing * 0.05);
  }

  // Row Total Cost (System Cost + GST@5% + Install Cost + Net Meter + Delivery + Others)
  getRowTotalCost(r: EditableCostRow): number {
    return (Number(r.systemCost) || 0) +
           this.getGst5(r) +
           (Number(r.installCost) || 0) +
           (Number(r.meterCost) || 0) +
           (Number(r.deliveryCost) || 0) +
           (Number(r.otherCost) || 0);
  }

  // Get or initialize editable row from store
  private getOrCreateEditableRow(r: SummaryTableRow): EditableCostRow {
    let item = this.editableStore.get(r.slNo);
    if (!item) {
      item = {
        slNo: r.slNo,
        name: r.name,
        consumerNo: r.consumerNo,
        district: r.district,
        brokerName: r.brokerName,
        pvModuleMake: (!r.pvModuleMake || r.pvModuleMake === '—' || r.pvModuleMake === '-') ? '' : r.pvModuleMake,
        inverterMake: (!r.inverterMake || r.inverterMake === '—' || r.inverterMake === '-') ? '' : r.inverterMake,
        stageIdx: r.stageIdx,
        stageName: r.stageName,
        askingPrice: r.fin.turnover || 0,
        billingPrice: r.fin.billing || 0,
        systemCost: r.fin.material || 0,
        installCost: r.fin.install || 0,
        meterCost: r.fin.meter || 0,
        deliveryCost: r.fin.delivery || 0,
        otherCost: r.fin.others || 0,
        description: r.row.Comment || r.fin.comment || '',
        isSaving: false,
        isDirty: false,
        rawRow: r.row
      };
      this.editableStore.set(r.slNo, item);
    }
    return item;
  }

  // Filtered Rows for Cost Analysis Table (All in Edit mode)
  filteredRows = computed<EditableCostRow[]>(() => {
    // Read version signal for reactivity
    this.storeVersion();
    const all = this.summaryService.allParsedRows();
    const search = this.searchQuery().toLowerCase().trim();
    const partners = this.selectedPartners();
    const district = this.selectedDistrict();
    const stage = this.selectedStage();
    const excluded = this.summaryService.excludedSlNos();

    const matching: EditableCostRow[] = [];

    for (const r of all) {
      if (excluded.has(r.slNo)) continue;

      const editRow = this.getOrCreateEditableRow(r);

      // Text search
      if (search) {
        const matchesName = (editRow.name || '').toLowerCase().includes(search);
        const matchesConsumer = (editRow.consumerNo || '').toLowerCase().includes(search);
        const matchesDistrict = (editRow.district || '').toLowerCase().includes(search);
        const matchesPartner = (editRow.brokerName || '').toLowerCase().includes(search);
        const matchesPanel = (editRow.pvModuleMake || '').toLowerCase().includes(search);
        const matchesInverter = (editRow.inverterMake || '').toLowerCase().includes(search);
        const matchesDesc = (editRow.description || '').toLowerCase().includes(search);

        if (!matchesName && !matchesConsumer && !matchesDistrict && 
            !matchesPartner && !matchesPanel && !matchesInverter && !matchesDesc) {
          continue;
        }
      }

      // Partner filter
      if (partners.length > 0) {
        const partnerName = (editRow.brokerName || '').trim();
        const hasNoPartner = !partnerName || partnerName === '—' || partnerName === '-';
        if (partners.includes('(No Partner)')) {
          if (!hasNoPartner && !partners.includes(partnerName)) continue;
        } else {
          if (hasNoPartner || !partners.includes(partnerName)) continue;
        }
      }

      // District filter
      if (district !== 'ALL') {
        const rowDistrict = (editRow.district && editRow.district.trim()) ? editRow.district.trim() : 'No District';
        if (rowDistrict !== district) continue;
      }

      // Stage filter
      if (stage !== 'ALL') {
        const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === stage);
        if (targetIdx >= 0 && editRow.stageIdx !== targetIdx) continue;
      }

      matching.push(editRow);
    }

    // Apply sorting for Panel Name or Inverter Name
    const currentSortField = this.sortField();
    if (currentSortField) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      matching.sort((a, b) => {
        const valA = ((currentSortField === 'panel' ? a.pvModuleMake : a.inverterMake) || '').trim();
        const valB = ((currentSortField === 'panel' ? b.pvModuleMake : b.inverterMake) || '').trim();

        const isEmptyA = !valA || valA === '—' || valA === '-';
        const isEmptyB = !valB || valB === '—' || valB === '-';

        if (isEmptyA && isEmptyB) return 0;
        if (isEmptyA) return 1;
        if (isEmptyB) return -1;

        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return matching;
  });

  // Summary Metrics / Totals computed on active filtered rows
  totals = computed(() => {
    const rows = this.filteredRows();
    let totalAsking = 0;
    let totalBilling = 0;
    let totalSystem = 0;
    let totalGst5 = 0;
    let totalInstall = 0;
    let totalMeter = 0;
    let totalDelivery = 0;
    let totalOthers = 0;

    rows.forEach(r => {
      totalAsking += Number(r.askingPrice) || 0;
      totalBilling += Number(r.billingPrice) || 0;
      totalSystem += Number(r.systemCost) || 0;
      totalGst5 += this.getGst5(r);
      totalInstall += Number(r.installCost) || 0;
      totalMeter += Number(r.meterCost) || 0;
      totalDelivery += Number(r.deliveryCost) || 0;
      totalOthers += Number(r.otherCost) || 0;
    });

    const totalExpense = totalSystem + totalGst5 + totalInstall + totalMeter + totalDelivery + totalOthers;

    return {
      count: rows.length,
      asking: totalAsking,
      billing: totalBilling,
      system: totalSystem,
      gst5: totalGst5,
      install: totalInstall,
      meter: totalMeter,
      delivery: totalDelivery,
      others: totalOthers,
      totalExpense
    };
  });

  // Count of dirty (modified) rows
  dirtyRowsCount = computed(() => {
    this.storeVersion();
    let count = 0;
    for (const item of this.editableStore.values()) {
      if (item.isDirty) count++;
    }
    return count;
  });

  markDirty(r: EditableCostRow): void {
    r.isDirty = true;
    this.storeVersion.update(v => v + 1);
  }

  // Excluded rows from SummaryService
  excludedCustomers = computed(() => {
    return this.summaryService.excludedRows();
  });

  // Filter Actions
  onSearchChange(text: string): void {
    this.searchQuery.set(text);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  togglePartnerDropdown(): void {
    this.isPartnerMenuOpen.update(v => !v);
  }

  isPartnerSelected(partner: string): boolean {
    return this.selectedPartners().includes(partner);
  }

  togglePartner(partner: string): void {
    const current = [...this.selectedPartners()];
    const idx = current.indexOf(partner);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(partner);
    }
    this.selectedPartners.set(current);
  }

  selectAllPartners(): void {
    const all = ['(No Partner)', ...this.summaryService.partnerList()];
    this.selectedPartners.set(all);
  }

  clearPartners(): void {
    this.selectedPartners.set([]);
  }

  get partnerDropdownLabel(): string {
    const list = this.selectedPartners();
    if (list.length === 0) return 'All Partners';
    if (list.length === 1) return list[0];
    return `${list.length} Partners`;
  }

  selectDistrict(d: string): void {
    if (this.selectedDistrict() === d) {
      this.selectedDistrict.set('ALL');
    } else {
      this.selectedDistrict.set(d);
    }
  }

  selectStage(s: string): void {
    if (this.selectedStage() === s) {
      this.selectedStage.set('ALL');
    } else {
      this.selectedStage.set(s);
    }
  }

  toggleSort(field: 'panel' | 'inverter'): void {
    if (this.sortField() === field) {
      if (this.sortDirection() === 'asc') {
        this.sortDirection.set('desc');
      } else {
        this.sortField.set(null);
        this.sortDirection.set('asc');
      }
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  trackBySlNo(index: number, item: EditableCostRow): number {
    return item.slNo;
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.selectedPartners.set([]);
    this.selectedDistrict.set('ALL');
    this.selectedStage.set('ALL');
    this.sortField.set(null);
    this.sortDirection.set('asc');
  }

  // Google Note handlers
  loadNotes(): void {
    this.isNoteLoading.set(true);
    this.http.get<any[]>('/api/get?table=work_notes').subscribe({
      next: (rows) => {
        this.isNoteLoading.set(false);
        const note = rows?.find(r => r.NoteID === 'cost_analysis_note');
        if (note) {
          this.noteExistsInDb.set(true);
          const title = note.NoteTitle || 'Cost Analysis Notes';
          const content = note.CommonNote || '';
          this.savedNoteTitle.set(title);
          this.savedNoteContent.set(content);
          this.currentNoteTitle.set(title);
          this.currentNoteContent.set(content);
          this.noteLastUpdated.set(note.UpdatedAt || note.CreatedAt || '');
        } else {
          this.noteExistsInDb.set(false);
          this.savedNoteTitle.set('Cost Analysis Notes');
          this.savedNoteContent.set('');
          this.currentNoteTitle.set('Cost Analysis Notes');
          this.currentNoteContent.set('');
          this.noteLastUpdated.set('');
        }
      },
      error: (err) => {
        this.isNoteLoading.set(false);
        console.error('Failed to load notes:', err);
      }
    });
  }

  openNotesModal(): void {
    // Open in edit mode with current saved values
    this.currentNoteTitle.set(this.savedNoteTitle());
    this.currentNoteContent.set(this.savedNoteContent());
    this.isNoteModalOpen.set(true);
  }

  closeNotesModal(): void {
    this.isNoteModalOpen.set(false);
  }

  resetNote(): void {
    // Reset currently modified edits back to saved database state
    this.currentNoteTitle.set(this.savedNoteTitle());
    this.currentNoteContent.set(this.savedNoteContent());
    this.toastService.info('Modifications undone. Restored saved note.');
  }

  saveNote(): void {
    const title = this.currentNoteTitle().trim() || 'Cost Analysis Notes';
    const content = this.currentNoteContent();
    const now = new Date().toISOString();

    this.isNoteSaving.set(true);

    if (this.noteExistsInDb()) {
      const payload = {
        NoteTitle: title,
        CommonNote: content,
        UpdatedAt: now
      };
      this.http.post('/api/update?table=work_notes&matchField=NoteID&matchValue=cost_analysis_note', payload).subscribe({
        next: () => {
          this.isNoteSaving.set(false);
          this.savedNoteTitle.set(title);
          this.savedNoteContent.set(content);
          this.noteLastUpdated.set(now);
          this.toastService.success('Note saved to database successfully!');
        },
        error: (err) => {
          this.isNoteSaving.set(false);
          console.error('Failed to update note:', err);
          this.toastService.error('Failed to save note. Please try again.');
        }
      });
    } else {
      const payload = {
        NoteID: 'cost_analysis_note',
        NoteTitle: title,
        CommonNote: content,
        CreatedAt: now,
        UpdatedAt: now
      };
      this.http.post('/api/insert?table=work_notes', payload).subscribe({
        next: () => {
          this.isNoteSaving.set(false);
          this.noteExistsInDb.set(true);
          this.savedNoteTitle.set(title);
          this.savedNoteContent.set(content);
          this.noteLastUpdated.set(now);
          this.toastService.success('Note saved to database successfully!');
        },
        error: (err) => {
          this.isNoteSaving.set(false);
          console.error('Failed to insert note:', err);
          this.toastService.error('Failed to save note. Please try again.');
        }
      });
    }
  }

  // Row selection & Exclusion handlers
  toggleSelectAll(): void {
    const rows = this.filteredRows();
    const current = this.selectedSlNos();
    if (current.size === rows.length && rows.length > 0) {
      this.selectedSlNos.set(new Set());
    } else {
      const next = new Set<number>();
      rows.forEach(r => next.add(r.slNo));
      this.selectedSlNos.set(next);
    }
  }

  isAllSelected(): boolean {
    const rows = this.filteredRows();
    return rows.length > 0 && this.selectedSlNos().size === rows.length;
  }

  isPartiallySelected(): boolean {
    const count = this.selectedSlNos().size;
    const total = this.filteredRows().length;
    return count > 0 && count < total;
  }

  toggleSelectRow(slNo: number): void {
    const current = new Set(this.selectedSlNos());
    if (current.has(slNo)) {
      current.delete(slNo);
    } else {
      current.add(slNo);
    }
    this.selectedSlNos.set(current);
  }

  isRowSelected(slNo: number): boolean {
    return this.selectedSlNos().has(slNo);
  }

  excludeSelected(): void {
    const ids = Array.from(this.selectedSlNos());
    if (ids.length > 0) {
      this.summaryService.excludeRows(ids);
      this.selectedSlNos.set(new Set());
      this.toastService.show(`Excluded ${ids.length} customer(s) from table.`, 'info');
    }
  }

  restoreRow(slNo: number): void {
    this.summaryService.restoreRow(slNo);
    this.toastService.show('Customer restored to table.', 'success');
  }

  restoreAllExcluded(): void {
    const count = this.excludedCustomers().length;
    this.summaryService.restoreAllExcluded();
    this.isExcludedMenuOpen.set(false);
    this.toastService.show(`All ${count} excluded customers returned to table.`, 'success');
  }

  // Save single row directly to backend
  saveRow(r: EditableCostRow): void {
    r.isSaving = true;
    const calculatedGst = this.getGst5(r);
    const calculatedTotalExpense = 
      Number(r.systemCost || 0) + 
      Number(r.deliveryCost || 0) + 
      Number(r.meterCost || 0) + 
      Number(r.installCost || 0) + 
      calculatedGst + 
      Number(r.otherCost || 0);

    const expenses = {
      material: Number(r.systemCost) || 0,
      billing: Number(r.billingPrice) || 0,
      partner: Number(r.askingPrice) || 0,
      install: Number(r.installCost) || 0,
      delivery: Number(r.deliveryCost) || 0,
      transport: Number(r.deliveryCost) || 0,
      gst_pct: 5,
      gst: calculatedGst,
      other: Number(r.otherCost) || 0,
      otherComment: r.description || '',
      net_meter_payment: Number(r.meterCost) || 0,
      net_meter_paid: Boolean(Number(r.meterCost) > 0)
    };

    // Parse or build product specifications for Module & Inverter Make
    let specs: any = {};
    if (r.rawRow?.ProductSpecs) {
      try {
        specs = typeof r.rawRow.ProductSpecs === 'string' ? JSON.parse(r.rawRow.ProductSpecs) : { ...r.rawRow.ProductSpecs };
      } catch (e) {
        specs = {};
      }
    }

    const panelVal = (r.pvModuleMake || '').trim();
    const inverterVal = (r.inverterMake || '').trim();

    if (!specs.PvModule) specs.PvModule = {};
    specs.PvModule.Make = panelVal;
    specs.moduleMake = panelVal;

    if (!specs.GridTiedInverter) specs.GridTiedInverter = {};
    specs.GridTiedInverter.Make = inverterVal;
    specs.inverterMake = inverterVal;

    let committedBrand = '';
    if (panelVal || inverterVal) {
      committedBrand = `M: ${panelVal} | Inv: ${inverterVal}`;
    }

    // Reconstruct BrokerNumber with updated expenses
    let brokerNumber = r.rawRow?.BrokerNumber || '';
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

      // Also update work metadata if present
      const workIdx = brokerNumber.indexOf('|work:');
      if (workIdx !== -1) {
        try {
          const workEnd = brokerNumber.indexOf('|', workIdx + 1);
          const workJson = workEnd !== -1 ? brokerNumber.slice(workIdx + 6, workEnd) : brokerNumber.slice(workIdx + 6);
          const workObj = JSON.parse(workJson) || {};
          workObj.NetMeterPayment = expenses.net_meter_payment;
          workObj.NetMeterPaid = expenses.net_meter_paid;
          workObj.ProductSpecs = specs;
          const workNew = `|work:${JSON.stringify(workObj)}`;
          brokerNumber = brokerNumber.slice(0, workIdx) + workNew + (workEnd !== -1 ? brokerNumber.slice(workEnd) : '');
        } catch (e) {}
      }
    } else {
      brokerNumber = `|expenses:${JSON.stringify(expenses)}`;
    }

    const payload: Partial<InstallmentRow> = {
      CommittedPrice: Number(r.askingPrice) || 0,
      VendorPrice: calculatedTotalExpense,
      NetMeterPayment: expenses.net_meter_payment,
      NetMeterPaid: expenses.net_meter_paid,
      BrokerNumber: brokerNumber,
      CommittedBrand: committedBrand,
      ProductSpecs: JSON.stringify(specs)
    };

    this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${r.slNo}`, payload).subscribe({
      next: () => {
        r.isSaving = false;
        r.isDirty = false;
        if (r.rawRow) {
          r.rawRow.CommittedPrice = payload.CommittedPrice;
          r.rawRow.VendorPrice = payload.VendorPrice;
          r.rawRow.NetMeterPayment = payload.NetMeterPayment;
          r.rawRow.NetMeterPaid = payload.NetMeterPaid;
          r.rawRow.BrokerNumber = payload.BrokerNumber;
          r.rawRow.Comment = r.description || '';
          r.rawRow.CommittedBrand = committedBrand;
          r.rawRow.ProductSpecs = specs;
        }
        this.summaryService.patchRawInstallment(r.slNo, {
          CommittedPrice: payload.CommittedPrice,
          VendorPrice: payload.VendorPrice,
          NetMeterPayment: payload.NetMeterPayment,
          NetMeterPaid: payload.NetMeterPaid,
          BrokerNumber: payload.BrokerNumber,
          Comment: r.description || '',
          CommittedBrand: committedBrand,
          ProductSpecs: specs
        });
        this.storeVersion.update(v => v + 1);
        this.toastService.success(`Saved "${r.name}" successfully.`);
      },
      error: (err) => {
        console.error('Save error:', err);
        r.isSaving = false;
        this.toastService.error(`Failed to save "${r.name}": ` + (err.error?.message || err.message || 'Server error'));
      }
    });
  }

  // Save all modified rows
  saveAllDirty(): void {
    const dirty = Array.from(this.editableStore.values()).filter(r => r.isDirty);
    if (dirty.length === 0) return;

    dirty.forEach(r => this.saveRow(r));
    this.toastService.info(`Saving ${dirty.length} modified customer(s)...`);
  }

  // Export to Excel / CSV
  async exportToExcel(): Promise<void> {
    const rows = this.filteredRows();
    if (rows.length === 0) {
      this.toastService.warning('No records to export.');
      return;
    }

    const XLSX = await import('xlsx');

    const data = rows.map((r, idx) => ({
      '#': idx + 1,
      'Customer Name': r.name,
      'Panel Name': r.pvModuleMake || '—',
      'Inverter Name': r.inverterMake || '—',
      'Asking Price': Number(r.askingPrice) || 0,
      'Billing Price': Number(r.billingPrice) || 0,
      'System Cost': Number(r.systemCost) || 0,
      'GST@5%': this.getGst5(r),
      'Installation Cost': Number(r.installCost) || 0,
      'Net Meter Cost': Number(r.meterCost) || 0,
      'Delivery Cost': Number(r.deliveryCost) || 0,
      'Others': Number(r.otherCost) || 0,
      'Descriptions': r.description || '',
      'Total': this.getRowTotalCost(r)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Analysis');
    const fileName = `Cost_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    this.toastService.success(`Exported ${rows.length} rows to Excel.`);
  }

  copyTableData(): void {
    const rows = this.filteredRows();
    if (rows.length === 0) {
      this.toastService.warning('No records to copy.');
      return;
    }

    const headers = [
      'Customer Name',
      'Panel Name',
      'Inverter Name',
      'Asking Price',
      'Billing Price',
      'System Cost',
      'GST@5%',
      'Installation Cost',
      'Net Meter Cost',
      'Delivery Cost',
      'Others',
      'Descriptions',
      'Total'
    ];

    const lines = [headers.join('\t')];
    rows.forEach(r => {
      lines.push([
        r.name,
        r.pvModuleMake || '—',
        r.inverterMake || '—',
        r.askingPrice || 0,
        r.billingPrice || 0,
        r.systemCost || 0,
        this.getGst5(r),
        r.installCost || 0,
        r.meterCost || 0,
        r.deliveryCost || 0,
        r.otherCost || 0,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        this.getRowTotalCost(r)
      ].join('\t'));
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.toastService.success(`Copied ${rows.length} rows to clipboard!`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard.');
    });
  }

  refreshData(): void {
    this.editableStore.clear();
    this.summaryService.loadAllData().subscribe({
      next: () => {
        this.storeVersion.update(v => v + 1);
        this.toastService.info('Data refreshed.');
      },
      error: () => this.toastService.error('Failed to refresh data.')
    });
  }
}
