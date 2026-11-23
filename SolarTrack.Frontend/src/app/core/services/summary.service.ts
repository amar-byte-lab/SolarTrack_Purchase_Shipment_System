import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, map, of, catchError } from 'rxjs';
import { 
  InstallmentRow, 
  InstallmentTxnRow, 
  CommissionTxnRow,
  InstallmentRemarkRow,
  InventoryDispatchRow,
  ShipmentRow,
  ShipmentRemarkRow,
  SummaryTableRow, 
  SummaryGroup,
  SummaryColumn, 
  SummaryFinancials,
  DistrictStat, 
  StageStat, 
  PaymentStat, 
  ActivityLogItem,
  ActivityChange,
  WORKFLOW_STAGES,
  getRowHighestStageIdx,
  getCustomerWorkStatus
} from '../models/summary.model';
import { AuthService } from './auth.service';
import { RolePermissionService } from './role-permission.service';

export const DEFAULT_SUMMARY_COLUMNS: SummaryColumn[] = [
  { key: 'customer', label: 'Customer: Status', visible: true },
  { key: 'payment', label: 'Customer Payment', visible: true },
  { key: 'material', label: 'Material Cost', visible: false },
  { key: 'delivery', label: 'Delivery Cost', visible: false },
  { key: 'meter', label: 'NetMeter Cost', visible: false },
  { key: 'install', label: 'Installation Cost', visible: false },
  { key: 'gst', label: 'GST', visible: false },
  { key: 'others', label: 'Others', visible: false },
  { key: 'profit', label: 'Profit', visible: false },
  { key: 'pvmodule', label: 'PVModule Make', visible: false },
  { key: 'inverter', label: 'Inverterr Make', visible: false },
  { key: 'statusEdit', label: 'StatusEdit', visible: false },
  { key: 'customerCost', label: 'Customer Cost', visible: false },
  { key: 'pendingAmount', label: 'Pending Amount', visible: false }
];

@Injectable({
  providedIn: 'root'
})
export class SummaryService {
  // Raw Data Signals
  private rawInstallmentsSignal = signal<InstallmentRow[]>([]);
  private rawTxnsSignal = signal<InstallmentTxnRow[]>([]);
  private rawCommTxnsSignal = signal<CommissionTxnRow[]>([]);
  private rawRemarksSignal = signal<InstallmentRemarkRow[]>([]);
  private rawDispatchesSignal = signal<InventoryDispatchRow[]>([]);
  private rawShipmentsSignal = signal<ShipmentRow[]>([]);
  private rawShipmentRemarksSignal = signal<ShipmentRemarkRow[]>([]);
  private rawBorrowersSignal = signal<any[]>([]);
  private rawBorrowerTxnsSignal = signal<any[]>([]);
  private rawActivityLogsSignal = signal<any[]>([]);

  // Excluded & Selected SlNos
  readonly excludedSlNos = signal<Set<number>>(new Set());
  readonly selectedSlNos = signal<Set<number>>(new Set());

  // Filters State Signals
  readonly searchText = signal<string>('');
  readonly selectedPartners = signal<string[]>([]);
  readonly selectedDistricts = signal<string[]>([]);
  readonly selectedStage = signal<string>('ALL');
  readonly selectedPaymentFilters = signal<string[]>([]);
  readonly columns = signal<SummaryColumn[]>(DEFAULT_SUMMARY_COLUMNS);

  // Loading State
  readonly isLoading = signal<boolean>(false);

  // Raw installments computed getter
  readonly rawInstallments = computed(() => this.rawInstallmentsSignal());
  readonly rawTxns = computed(() => this.rawTxnsSignal());

  // Payments Map
  readonly paymentsMap = computed(() => {
    const txns = this.rawTxnsSignal();
    const map = new Map<number, number>();
    for (const t of txns) {
      if (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === '') {
        const sl = Number(t.SlNo);
        map.set(sl, (map.get(sl) || 0) + (Number(t.Amount) || 0));
      }
    }
    return map;
  });

  private rolePermissionService = inject(RolePermissionService);

  // Base rows filtered by user role, special user allowed partners, and role scope
  readonly baseRows = computed<InstallmentRow[]>(() => {
    const installments = this.rawInstallmentsSignal();
    const currentUser = this.authService.currentUser();
    const isPowerUser = this.authService.isAdmin();

    const nonDeactive = installments.filter(r => r.Status !== 'Deactive');

    if (isPowerUser) return nonDeactive;
    if (!currentUser) return [];

    // 1. Check if user is a Special User configured with multiple allowed partners
    const allowedPartners = this.rolePermissionService.currentUserAllowedPartners().map(p => p.toLowerCase().trim());
    if (allowedPartners.length > 0) {
      return nonDeactive.filter(r => {
        const broker = (r.BrokerName || '').toLowerCase().trim();
        return allowedPartners.includes(broker);
      });
    }

    // 2. Check if the user's role allows viewing all customers
    if (!this.rolePermissionService.isSummaryOwnOnly()) {
      return nonDeactive;
    }

    // 3. Default own customer filter (e.g. for Associates)
    const spec = this.rolePermissionService.currentUserSpecialConfig();
    const assigned = spec?.assignedPartner ? [spec.assignedPartner.toLowerCase().trim()] : [];

    const partnerNames = [
      (currentUser.username || '').toLowerCase().trim(),
      (currentUser.userid || '').toLowerCase().trim(),
      ...assigned
    ].filter(Boolean);

    return nonDeactive.filter(r => {
      const broker = (r.BrokerName || '').toLowerCase().trim();
      if (partnerNames.includes(broker)) return true;
      if (r.BrokerNumber && r.BrokerNumber.includes(`|creator:${currentUser.userid}`)) return true;
      return false;
    });
  });

  // Total active customers count (before exclusion)
  readonly totalCustomerCount = computed(() => this.baseRows().length);

  // All parsed rows (before exclusion and UI filters)
  readonly allParsedRows = computed<SummaryTableRow[]>(() => {
    const rows = this.baseRows();
    const payMap = this.paymentsMap();
    return rows.map(r => this.transformToSummaryRow(r, payMap));
  });

  // Filtered rows for summary table
  readonly filteredRows = computed<SummaryTableRow[]>(() => {
    const rows = this.allParsedRows();
    const search = this.searchText().toLowerCase().trim();
    const partners = this.selectedPartners();
    const districts = this.selectedDistricts();
    const stage = this.selectedStage();
    const paymentFilters = this.selectedPaymentFilters();
    const excluded = this.excludedSlNos();

    return rows.filter(r => {
      // Excluded filter
      if (excluded.has(r.slNo)) return false;

      // Text search
      if (search && !this.matchesSearch(r.row, search)) return false;

      // Partner filter
      if (partners.length > 0 && !this.matchesPartner(r.row, partners)) return false;

      // District filter
      if (districts.length > 0 && !this.matchesDistrict(r.row, districts)) return false;

      // Stage filter
      if (stage !== 'ALL') {
        const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === stage);
        if (targetIdx >= 0 && r.stageIdx !== targetIdx) return false;
      }

      // Payment status filter
      if (paymentFilters.length > 0 && !this.matchesPayment(r, paymentFilters)) return false;

      return true;
    });
  });

  // Excluded rows
  readonly excludedRows = computed(() => {
    const rows = this.allParsedRows();
    const excluded = this.excludedSlNos();
    return rows.filter(r => excluded.has(r.slNo));
  });

  // Unique partner list
  readonly partnerList = computed<string[]>(() => {
    const rows = this.baseRows();
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.BrokerName && r.BrokerName.trim()) {
        set.add(r.BrokerName.trim());
      }
    });
    return Array.from(set).sort();
  });

  // District statistics computed dynamically based on current search, partner, stage, and payment filters
  readonly districtStats = computed<DistrictStat[]>(() => {
    const base = this.allParsedRows();
    const search = this.searchText().toLowerCase().trim();
    const partners = this.selectedPartners();
    const stage = this.selectedStage();
    const paymentFilters = this.selectedPaymentFilters();
    const excluded = this.excludedSlNos();
    const selectedDistricts = this.selectedDistricts();

    // Filter rows for district counts
    const rows = base.filter(r => {
      if (excluded.has(r.slNo)) return false;
      if (search && !this.matchesSearch(r.row, search)) return false;
      if (partners.length > 0 && !this.matchesPartner(r.row, partners)) return false;
      if (stage !== 'ALL') {
        const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === stage);
        if (targetIdx >= 0 && r.stageIdx !== targetIdx) return false;
      }
      if (paymentFilters.length > 0 && !this.matchesPayment(r, paymentFilters)) return false;
      return true;
    });

    const totalCount = rows.length;
    const counts: { [dist: string]: number } = {};

    rows.forEach(r => {
      const dist = (r.district && r.district.trim()) ? r.district.trim() : 'No District';
      counts[dist] = (counts[dist] || 0) + 1;
    });

    const sortedDistricts = Object.keys(counts)
      .filter(k => counts[k] >= 1)
      .sort((a, b) => {
        if (a === 'No District') return 1;
        if (b === 'No District') return -1;
        return a.localeCompare(b);
      });

    const items: DistrictStat[] = [];
    // Total Badge
    items.push({
      district: 'ALL',
      count: totalCount,
      active: selectedDistricts.length === 0
    });

    sortedDistricts.forEach(d => {
      const targetDist = d === 'No District' ? '(No District)' : d;
      items.push({
        district: targetDist,
        count: counts[d] || 0,
        active: selectedDistricts.includes(targetDist)
      });
    });

    return items;
  });

  // Stage statistics computed dynamically based on current search, partner, district, and payment filters
  readonly stageStats = computed<StageStat[]>(() => {
    const base = this.allParsedRows();
    const search = this.searchText().toLowerCase().trim();
    const partners = this.selectedPartners();
    const districts = this.selectedDistricts();
    const paymentFilters = this.selectedPaymentFilters();
    const excluded = this.excludedSlNos();
    const curStage = this.selectedStage();

    const rows = base.filter(r => {
      if (excluded.has(r.slNo)) return false;
      if (search && !this.matchesSearch(r.row, search)) return false;
      if (partners.length > 0 && !this.matchesPartner(r.row, partners)) return false;
      if (districts.length > 0 && !this.matchesDistrict(r.row, districts)) return false;
      if (paymentFilters.length > 0 && !this.matchesPayment(r, paymentFilters)) return false;
      return true;
    });

    const stageCounts = [0, 0, 0, 0, 0, 0, 0, 0];
    rows.forEach(r => {
      if (r.stageIdx >= 0 && r.stageIdx < 8) {
        stageCounts[r.stageIdx]++;
      }
    });

    const totalCount = rows.length;
    const items: StageStat[] = [];

    // Total Stage Button
    items.push({
      stage: 'ALL',
      num: 0,
      name: 'Total',
      count: totalCount,
      active: curStage === 'ALL',
      badgeClass: 'stage-tag-all'
    });

    // 8 Workflow stages
    WORKFLOW_STAGES.forEach((st, idx) => {
      items.push({
        stage: st.key,
        num: st.num,
        name: st.name,
        count: stageCounts[idx] || 0,
        active: curStage === st.key,
        badgeClass: st.colorClass
      });
    });

    return items;
  });

  // Payment statistics computed dynamically
  readonly paymentStats = computed<PaymentStat[]>(() => {
    const base = this.allParsedRows();
    const search = this.searchText().toLowerCase().trim();
    const partners = this.selectedPartners();
    const districts = this.selectedDistricts();
    const stage = this.selectedStage();
    const excluded = this.excludedSlNos();
    const selectedPay = this.selectedPaymentFilters();

    const rows = base.filter(r => {
      if (excluded.has(r.slNo)) return false;
      if (search && !this.matchesSearch(r.row, search)) return false;
      if (partners.length > 0 && !this.matchesPartner(r.row, partners)) return false;
      if (districts.length > 0 && !this.matchesDistrict(r.row, districts)) return false;
      if (stage !== 'ALL') {
        const targetIdx = WORKFLOW_STAGES.findIndex(st => st.key === stage);
        if (targetIdx >= 0 && r.stageIdx !== targetIdx) return false;
      }
      return true;
    });

    let fully = 0;
    let partial = 0;
    let unpaid = 0;
    let nmPaid = 0;

    rows.forEach(r => {
      if (r.fin.payCategory === 'Fully Paid') fully++;
      else if (r.fin.payCategory === 'Partial Paid') partial++;
      else unpaid++;

      if (r.isNetMeterPaid) nmPaid++;
    });

    const isTotalActive = selectedPay.length === 0;

    return [
      { key: 'ALL', label: `Total (${rows.length})`, count: rows.length, active: isTotalActive },
      { key: 'FullyPaid', label: `Fully Paid (${fully})`, count: fully, active: selectedPay.includes('FullyPaid') },
      { key: 'PartiallyPaid', label: `Partially Paid (${partial})`, count: partial, active: selectedPay.includes('PartiallyPaid') },
      { key: 'Unpaid', label: `Unpaid (${unpaid})`, count: unpaid, active: selectedPay.includes('Unpaid') },
      { key: 'NetMeterPaid', label: `NetMeter Paid (${nmPaid})`, count: nmPaid, active: selectedPay.includes('NetMeterPaid') }
    ];
  });

  // Grouped rows for summary table: Unpaid, Partial Paid, Fully Paid
  readonly groupedRows = computed<SummaryGroup[]>(() => {
    const filtered = this.filteredRows();
    const payFilters = this.selectedPaymentFilters();
    const hasPayFilter = payFilters.length > 0;

    const unpaidList = filtered.filter(i => i.fin.payCategory === 'Unpaid');
    const partialList = filtered.filter(i => i.fin.payCategory === 'Partial Paid');
    const fullyList = filtered.filter(i => i.fin.payCategory === 'Fully Paid');

    const sortGroup = (list: SummaryTableRow[]) => {
      return [...list].sort((a, b) => {
        if (a.stageIdx !== b.stageIdx) {
          return a.stageIdx - b.stageIdx; // 1 to 8 ascending
        }
        return a.slNo - b.slNo;
      });
    };

    const groups: SummaryGroup[] = [];

    if (!hasPayFilter || payFilters.includes('Unpaid')) {
      groups.push({
        name: 'Unpaid',
        list: sortGroup(unpaidList),
        colorClass: 'text-danger',
        groupClass: 'group-unpaid',
        rowClass: 'sum-row-unpaid'
      });
    }

    if (!hasPayFilter || payFilters.includes('PartiallyPaid')) {
      groups.push({
        name: 'Partial Paid',
        list: sortGroup(partialList),
        colorClass: 'text-warning-emphasis',
        groupClass: 'group-partial',
        rowClass: 'sum-row-partial'
      });
    }

    if (!hasPayFilter || payFilters.includes('FullyPaid')) {
      groups.push({
        name: 'Fully Paid',
        list: sortGroup(fullyList),
        colorClass: 'text-success',
        groupClass: 'group-fully',
        rowClass: 'sum-row-fully'
      });
    }

    return groups;
  });

  // Totals of visible filtered rows
  readonly totals = computed(() => {
    const list = this.filteredRows();
    let totPaid = 0;
    let totUnpaid = 0;
    let totTurnover = 0;
    let totInstall = 0;
    let totMeter = 0;
    let totDelivery = 0;
    let totOthers = 0;
    let totGst = 0;
    let totMaterial = 0;
    let totSetCost = 0;
    let totProfit = 0;

    list.forEach(i => {
      totPaid += i.fin.paid;
      totUnpaid += i.fin.unpaid;
      totTurnover += i.fin.turnover;
      totInstall += i.fin.install;
      totMeter += i.fin.meter;
      totDelivery += i.fin.delivery;
      totOthers += i.fin.others;
      totGst += (i.fin.gst || 0);
      totMaterial += i.fin.material;
      totSetCost += i.fin.setCost;
      totProfit += i.fin.profit;
    });

    return {
      count: list.length,
      paid: totPaid,
      unpaid: totUnpaid,
      turnover: totTurnover,
      install: totInstall,
      meter: totMeter,
      delivery: totDelivery,
      others: totOthers,
      gst: totGst,
      material: totMaterial,
      setCost: totSetCost,
      profit: totProfit
    };
  });

  // Synthesized & Real Activity Feed Items
  readonly activityItems = computed<ActivityLogItem[]>(() => {
    const rawLogs = this.rawActivityLogsSignal();
    const installments = this.rawInstallmentsSignal();
    const txns = this.rawTxnsSignal();
    const commTxns = this.rawCommTxnsSignal();
    const remarks = this.rawRemarksSignal();
    const dispatches = this.rawDispatchesSignal();
    const shipments = this.rawShipmentsSignal();
    const shipmentRemarks = this.rawShipmentRemarksSignal();
    const borrowers = this.rawBorrowersSignal();
    const borrowerTxns = this.rawBorrowerTxnsSignal();

    const custMap = new Map<number, InstallmentRow>();
    installments.forEach(r => custMap.set(Number(r.SlNo), r));

    // Get undone map from localStorage
    let undoneMap: { [id: string]: any } = {};
    try {
      const raw = localStorage.getItem('st_undone_activities');
      if (raw) undoneMap = JSON.parse(raw);
    } catch (e) {}

    const logged: ActivityLogItem[] = rawLogs.map(l => ({
      id: l.id || `log_${Math.random()}`,
      timestamp: l.timestamp,
      date: l.date || (l.timestamp ? l.timestamp.slice(0, 10) : ''),
      time: l.time || '',
      page: (l.page === 'Ledger' || l.table === 'borrowers' || l.table === 'borrower_txns')
        ? 'Ledger'
        : (l.page === 'Manage Work' || l.page === 'Customer')
        ? 'Summary'
        : (l.page || 'Summary'),
      table: l.table || 'installments',
      action: l.action || 'UPDATE',
      user: l.user || l.username || 'Admin',
      userRole: l.userRole || 'admin',
      recordId: l.recordId || l.slNo,
      customerName: l.customerName || (l.slNo && custMap.get(Number(l.slNo))?.Name) || 'Customer',
      consumerNo: l.consumerNo || (l.slNo && custMap.get(Number(l.slNo))?.ConsumerNo) || '',
      changes: this.cleanActivityChanges(l.changes || (l.field ? [{ field: l.field, oldVal: l.oldValue, newVal: l.newValue }] : [])),
      undone: !!l.undone,
      undoneBy: l.undoneBy,
      undoneAt: l.undoneAt
    }));

    const synthesized: ActivityLogItem[] = [];

    // Synthesize stages from installments
    installments.forEach(r => {
      const slNo = Number(r.SlNo);
      const custName = r.Name || `Customer #${slNo}`;
      const author = r.BrokerName || 'Admin';

      const stagesList = [
        { field: 'LoginDate', name: '1. Login', dateVal: r.LoginDate },
        { field: 'AgreementDate', name: '2. Agreement', dateVal: r.AgreementDate },
        { field: 'MaterialDispatchedDate', name: '3. Dispatched', dateVal: r.MaterialDispatchedDate },
        { field: 'InstallationDate', name: '4. Installation', dateVal: r.InstallationDate },
        { field: 'NetMeterDate', name: '5. NetMeter', dateVal: r.NetMeterDate || (r.NetMeterPaid && r.NetMeterPayment ? (r.SpecsUpdatedAt || r.LoginDate) : null) },
        { field: 'InspectionDate', name: '6. Inspection', dateVal: r.InspectionDate },
        { field: 'MeterConnectedDate', name: '7. Connection', dateVal: r.MeterConnectedDate },
        { field: 'CommissioningDate', name: '8. Subsidy', dateVal: r.CommissioningDate }
      ];

      stagesList.forEach(st => {
        if (!st.dateVal) return;
        const isoDate = this.parseToIsoDate(st.dateVal);
        if (!isoDate) return;
        const actId = `synth_stg_${slNo}_${st.field}`;
        synthesized.push({
          id: actId,
          timestamp: `${isoDate}T12:00:00Z`,
          date: isoDate,
          time: '05:30 pm',
          page: 'Summary',
          table: 'installments',
          action: 'UPDATE',
          stageField: st.field,
          user: author,
          userRole: 'Staff',
          recordId: slNo,
          customerName: custName,
          consumerNo: r.ConsumerNo || '',
          changes: [
            { field: `Workflow Stage: ${st.name}`, oldVal: null, newVal: st.dateVal }
          ],
          undone: false
        });
      });

      // Specifications / Assigned Brands
      if (r.SpecsUpdatedAt && (r.CommittedBrand || r.ProductSpecs)) {
        const specDate = this.parseToIsoDate(r.SpecsUpdatedAt);
        if (specDate) {
          synthesized.push({
            id: `synth_spec_${slNo}`,
            timestamp: r.SpecsUpdatedAt,
            date: specDate,
            time: '04:15 pm',
            page: 'Summary',
            table: 'installments',
            action: 'UPDATE',
            user: r.SpecsUpdatedBy || 'Admin',
            userRole: 'Staff',
            recordId: slNo,
            customerName: custName,
            consumerNo: r.ConsumerNo || '',
            changes: [
              { field: 'System Specifications', oldVal: null, newVal: r.CommittedBrand || 'Assigned Brands' }
            ],
            undone: false
          });
        }
      }

      // Customer Profile Registration
      const regDate = this.parseToIsoDate(r.CreatedAt || r.LoginDate);
      if (regDate) {
        synthesized.push({
          id: `synth_reg_${slNo}`,
          timestamp: `${regDate}T09:00:00Z`,
          date: regDate,
          time: '09:00 am',
          page: 'Summary',
          table: 'installments',
          action: 'INSERT',
          user: 'Admin',
          userRole: 'Admin',
          recordId: slNo,
          customerName: custName,
          consumerNo: r.ConsumerNo || '',
          changes: [
            { field: 'Customer Profile Created', oldVal: null, newVal: `${custName} (District: ${r.District || '-'}, Phone: ${r.MobileNumber || '-'})` }
          ],
          undone: false
        });
      }
    });

    // Customer Payments (installment_txns)
    txns.forEach(t => {
      const isoDate = this.parseToIsoDate(t.TxnDate || t.CreatedAt);
      if (!isoDate) return;
      const cust = custMap.get(Number(t.SlNo));
      const custName = cust ? cust.Name : `Customer #${t.SlNo}`;
      const isCustomer = t.TxnType === 'Customer' || !t.TxnType;
      const actId = `synth_txn_${t.TxnID || t.SlNo + '_' + isoDate + '_' + t.Amount}`;
      synthesized.push({
        id: actId,
        timestamp: t.CreatedAt || `${isoDate}T12:00:00Z`,
        date: isoDate,
        time: '02:30 pm',
        page: 'Summary',
        table: 'installment_txns',
        action: 'INSERT',
        txnId: t.TxnID,
        amount: Number(t.Amount) || 0,
        user: t.CreatedBy || 'Admin',
        userRole: 'Staff',
        recordId: t.SlNo,
        customerName: custName,
        consumerNo: cust ? cust.ConsumerNo : '',
        changes: [
          {
            field: isCustomer ? 'Customer Payment Received' : 'Vendor Expense Paid',
            oldVal: null,
            newVal: `₹${(Number(t.Amount) || 0).toLocaleString('en-IN')}${t.Remark ? ' (' + t.Remark + ')' : ''}`
          }
        ],
        undone: false
      });
    });

    // Commission Payments
    commTxns.forEach(c => {
      const isoDate = this.parseToIsoDate(c.TxnDate || c.CreatedAt);
      if (!isoDate) return;
      const cust = custMap.get(Number(c.SlNo));
      const custName = cust ? cust.Name : `Customer #${c.SlNo}`;
      synthesized.push({
        id: `synth_comm_${c.TxnID || c.SlNo + '_' + isoDate + '_' + c.Amount}`,
        timestamp: c.CreatedAt || `${isoDate}T12:00:00Z`,
        date: isoDate,
        time: '03:00 pm',
        page: 'Summary',
        table: 'commission_txns',
        action: 'INSERT',
        user: c.CreatedBy || 'Admin',
        userRole: 'Staff',
        recordId: c.SlNo,
        customerName: custName,
        consumerNo: cust ? cust.ConsumerNo : '',
        changes: [
          {
            field: 'Broker Commission Paid',
            oldVal: null,
            newVal: `₹${(Number(c.Amount) || 0).toLocaleString('en-IN')}${c.Remark ? ' (' + c.Remark + ')' : ''}`
          }
        ],
        undone: false
      });
    });

    // Remarks
    remarks.forEach(r => {
      const isoDate = this.parseToIsoDate(r.CreatedAt || r.Date);
      if (!isoDate) return;
      const cust = custMap.get(Number(r.SlNo));
      const custName = cust ? cust.Name : `Customer #${r.SlNo}`;
      const page = 'Summary';
      synthesized.push({
        id: `synth_rem_${r.RemarkID || r.SlNo + '_' + isoDate}`,
        timestamp: r.CreatedAt || `${isoDate}T12:00:00Z`,
        date: isoDate,
        time: '01:00 pm',
        page: page,
        table: 'installment_remarks',
        action: 'INSERT',
        remarkId: r.RemarkID,
        user: r.Author || r.CreatedBy || 'Staff',
        userRole: 'Staff',
        recordId: r.SlNo,
        customerName: custName,
        consumerNo: cust ? cust.ConsumerNo : '',
        changes: [
          { field: 'Remark / Comment Added', oldVal: null, newVal: r.Remark || r.Note || '' }
        ],
        undone: false
      });
    });

    // Dispatches
    dispatches.forEach(d => {
      const isoDate = this.parseToIsoDate(d.Date || d.DispatchDate || d.CreatedAt);
      if (!isoDate) return;
      synthesized.push({
        id: `synth_disp_${d.DispatchID || Math.random()}`,
        timestamp: d.CreatedAt || `${isoDate}T12:00:00Z`,
        date: isoDate,
        time: '11:00 am',
        page: 'Summary',
        table: 'inventory_dispatches',
        action: 'INSERT',
        dispatchId: d.DispatchID,
        user: d.CreatedBy || 'Admin',
        userRole: 'Staff',
        recordId: d.ChallanNo || d.DispatchID,
        customerName: d.SiteName || d.CustomerName || 'Material Dispatch',
        changes: [
          { field: 'Inventory Dispatched', oldVal: null, newVal: `${d.Quantity || ''} units of ${d.ItemCode || d.ItemName || 'Material'} (Challan: ${d.ChallanNo || '-'})` }
        ],
        undone: false
      });
    });

    // Shipments
    shipments.forEach(s => {
      const shipNo = s.ShipmentNo || s.shipmentno;
      if (!shipNo) return;
      const isoDate = this.parseToIsoDate(s.PurchaseDate || s.CreatedAt || s.purchasedate || s.createdat);
      const type = s.ShipmentType || s.shipmenttype || 'Buy';
      const vName = s.VendorName || s.vendorname || 'Vendor';

      if (isoDate) {
        synthesized.push({
          id: `synth_ship_${shipNo}`,
          timestamp: s.CreatedAt || s.createdat || `${isoDate}T12:00:00Z`,
          date: isoDate,
          time: '10:00 am',
          page: 'Shipment',
          table: 'shipments',
          action: 'INSERT',
          recordId: shipNo,
          customerName: `${vName} (${type} ${shipNo})`,
          consumerNo: s.InvoiceNumber || s.VehicleNumber || s.invoicenumber || s.vehiclenumber || '',
          changes: [
            { field: `${type} Shipment Created`, oldVal: null, newVal: `Invoice: ${s.InvoiceNumber || s.invoicenumber || '-'}${s.VehicleNumber || s.vehiclenumber ? ', Vehicle: ' + (s.VehicleNumber || s.vehiclenumber) : ''}` }
          ],
          undone: false
        });
      }
    });

    // Ledger: Borrowers & Ledger Transactions
    const borrowerMap = new Map<number, any>();
    borrowers.forEach(b => {
      const bId = Number(b.BorrowerID);
      borrowerMap.set(bId, b);
      const isoDate = this.parseToIsoDate(b.CreatedAt);
      if (isoDate) {
        synthesized.push({
          id: `synth_bor_${bId}`,
          timestamp: b.CreatedAt || `${isoDate}T09:00:00Z`,
          date: isoDate,
          time: '09:00 am',
          page: 'Ledger',
          table: 'borrowers',
          action: 'INSERT',
          recordId: bId,
          customerName: b.Name || `Ledger #${bId}`,
          consumerNo: b.Mobile || '',
          changes: [
            { field: 'Ledger Account Created', oldVal: null, newVal: `${b.Name} (Mobile: ${b.Mobile || '-'}, Address: ${b.Address || '-'})` }
          ],
          undone: false
        });
      }
    });

    borrowerTxns.forEach(bt => {
      const isoDate = this.parseToIsoDate(bt.TxnDate || bt.CreatedAt);
      if (!isoDate) return;
      const bId = Number(bt.BorrowerID);
      const b = borrowerMap.get(bId);
      const bName = b ? b.Name : `Ledger #${bId}`;
      const isCredit = bt.Type === 'Credit';
      synthesized.push({
        id: `synth_btxn_${bt.TxnID || bId + '_' + isoDate + '_' + bt.Amount}`,
        timestamp: bt.CreatedAt || `${isoDate}T12:00:00Z`,
        date: isoDate,
        time: '02:00 pm',
        page: 'Ledger',
        table: 'borrower_txns',
        action: 'INSERT',
        txnId: bt.TxnID,
        amount: Number(bt.Amount) || 0,
        user: bt.CreatedBy || 'Admin',
        userRole: 'Staff',
        recordId: bId,
        customerName: bName,
        consumerNo: b?.Mobile || '',
        changes: [
          {
            field: isCredit ? 'Ledger Debit (You Gave)' : 'Ledger Credit (You Received)',
            oldVal: null,
            newVal: `₹${(Number(bt.Amount) || 0).toLocaleString('en-IN')}${bt.Remarks ? ' (' + bt.Remarks + ')' : ''}`
          }
        ],
        undone: false
      });
    });

    // Combine logged and synthesized
    const combined = [...logged, ...synthesized];

    // Apply undone
    combined.forEach(act => {
      if (undoneMap[act.id]) {
        act.undone = true;
        act.undoneBy = undoneMap[act.id].undoneBy;
        act.undoneAt = undoneMap[act.id].undoneAt;
      }
    });

    // Sort descending by timestamp or date
    combined.sort((a, b) => {
      const tA = new Date(a.timestamp || a.date || 0).getTime();
      const tB = new Date(b.timestamp || b.date || 0).getTime();
      return tB - tA;
    });

    return combined;
  });

  constructor(private http: HttpClient, private authService: AuthService) {}

  loadAllData(): Observable<any> {
    this.isLoading.set(true);
    const currentUser = this.authService.currentUser();
    const userId = currentUser ? (currentUser.userid || currentUser.username || 'admin') : 'admin';

    return forkJoin({
      installments: this.http.get<any>('/api/get?table=installments').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      txns: this.http.get<any>('/api/get?table=installment_txns').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      commTxns: this.http.get<any>('/api/get?table=commission_txns').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      remarks: this.http.get<any>('/api/get?table=installment_remarks').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      dispatches: this.http.get<any>('/api/get?table=inventory_dispatches').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      shipments: this.http.get<any>('/api/get?table=shipments').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      shipmentRemarks: this.http.get<any>('/api/get?table=shipment_remarks').pipe(map(r => r?.data || r?.value || r || []), catchError(() => of([]))),
      borrowers: this.http.get<any>(`/api/borrower-list?userId=${encodeURIComponent(userId)}`).pipe(map(r => r?.value || r?.data || r || []), catchError(() => of([]))),
      borrowerTxns: this.http.get<any>(`/api/borrower-txns?userId=${encodeURIComponent(userId)}`).pipe(map(r => r?.value || r?.data || r || []), catchError(() => of([]))),
      logs: this.http.get<any>('/api/activity-logs').pipe(map(r => r?.value || r?.data || r || []), catchError(() => of([])))
    }).pipe(
      map(res => {
        const hydrated = (res.installments || []).map((r: InstallmentRow) => {
          if (r.BrokerNumber && r.BrokerNumber.includes('|work:')) {
            try {
              const workIdx = r.BrokerNumber.indexOf('|work:');
              const workObj = JSON.parse(r.BrokerNumber.slice(workIdx + 6));
              return {
                ...r,
                SubDivision: r.SubDivision || workObj.SubDivision || '',
                DivisionName: r.DivisionName || workObj.DivisionName || '',
                CircleName: r.CircleName || workObj.CircleName || '',
                ApplicationNumber: r.ApplicationNumber || workObj.ApplicationNumber || '',
                ProposedCapacity: r.ProposedCapacity || workObj.ProposedCapacity || ''
              };
            } catch (e) {
              return r;
            }
          }
          return r;
        });
        this.rawInstallmentsSignal.set(hydrated);
        this.rawTxnsSignal.set(res.txns);
        this.rawCommTxnsSignal.set(res.commTxns);
        this.rawRemarksSignal.set(res.remarks);
        this.rawDispatchesSignal.set(res.dispatches);
        this.rawShipmentsSignal.set(res.shipments);
        this.rawShipmentRemarksSignal.set(res.shipmentRemarks);
        this.rawBorrowersSignal.set(res.borrowers);
        this.rawBorrowerTxnsSignal.set(res.borrowerTxns);
        this.rawActivityLogsSignal.set(res.logs);
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Column management
  toggleColumn(key: string, visible: boolean): void {
    this.columns.update(cols => 
      cols.map(c => c.key === key ? { ...c, visible } : c)
    );
  }

  setAllColumns(visible: boolean): void {
    this.columns.update(cols => cols.map(c => ({ ...c, visible })));
  }

  resetDefaultColumns(): void {
    this.columns.set(DEFAULT_SUMMARY_COLUMNS);
  }

  clearAllFilters(): void {
    this.searchText.set('');
    this.selectedPartners.set([]);
    this.selectedDistricts.set([]);
    this.selectedStage.set('ALL');
    this.selectedPaymentFilters.set([]);
  }

  // Row exclusion management
  excludeRows(slNos: number[]): void {
    this.excludedSlNos.update(set => {
      const next = new Set(set);
      slNos.forEach(id => next.add(id));
      return next;
    });
  }

  restoreRow(slNo: number): void {
    this.excludedSlNos.update(set => {
      const next = new Set(set);
      next.delete(slNo);
      return next;
    });
  }

  restoreAllExcluded(): void {
    this.excludedSlNos.set(new Set());
  }

  // Save comment to row
  saveComment(slNo: number, comment: string): Observable<any> {
    const r = this.rawInstallmentsSignal().find(x => Number(x.SlNo) === slNo);
    if (!r) return of(null);

    let basePhone = '';
    let creatorId = '';
    let expenses: any = {};
    let workObj: any = null;

    if (r.BrokerNumber) {
      const parts = r.BrokerNumber.split('|');
      basePhone = parts[0] || '';
      parts.slice(1).forEach(p => {
        if (p.startsWith('expenses:')) {
          try { expenses = JSON.parse(p.slice('expenses:'.length)) || {}; } catch(e) {}
        } else if (p.startsWith('creator:')) {
          creatorId = p.slice('creator:'.length);
        } else if (p.startsWith('work:')) {
          try { workObj = JSON.parse(p.slice('work:'.length)); } catch(e) {}
        }
      });
    }

    expenses.otherComment = comment;
    let newBroker = basePhone;
    if (creatorId) newBroker += '|creator:' + creatorId;
    newBroker += '|expenses:' + JSON.stringify(expenses);
    if (workObj) newBroker += '|work:' + JSON.stringify(workObj);

    return this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${slNo}`, {
      Comment: comment,
      BrokerNumber: newBroker
    });
  }

  // Customer Record Operations
  deactivateCustomer(slNo: number): Observable<any> {
    return this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${slNo}`, {
      Status: 'Deactive'
    });
  }

  deleteCustomer(slNo: number): Observable<any> {
    return this.http.post(`/api/delete?table=installments&matchField=SlNo&matchValue=${slNo}`, {});
  }

  updateCustomer(slNo: number, data: Partial<InstallmentRow>): Observable<any> {
    return this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${slNo}`, data);
  }

  // Get Customer Transactions
  getTxnsForCustomer(slNo: number): InstallmentTxnRow[] {
    return this.rawTxnsSignal()
      .filter(t => Number(t.SlNo) === Number(slNo) && (t.TxnType === 'Customer' || !t.TxnType || t.TxnType === ''))
      .sort((a, b) => new Date(a.TxnDate).getTime() - new Date(b.TxnDate).getTime());
  }

  // Workflow Stage Progress Operation
  saveStageProgress(slNo: number, patch: Partial<InstallmentRow>): Observable<any> {
    const existing = this.rawInstallmentsSignal().find(r => Number(r.SlNo) === Number(slNo));
    if (!existing) return of(null);

    let brokerNumber = existing.BrokerNumber || '';
    if (patch.NetMeterPayment !== undefined || patch.NetMeterPaid !== undefined) {
      const expIdx = brokerNumber.indexOf('|expenses:');
      if (expIdx !== -1) {
        try {
          const expEnd = brokerNumber.indexOf('|', expIdx + 1);
          const expJson = expEnd !== -1 ? brokerNumber.slice(expIdx + 10, expEnd) : brokerNumber.slice(expIdx + 10);
          const expObj = JSON.parse(expJson) || {};
          if (patch.NetMeterPayment !== undefined) expObj.net_meter_payment = Number(patch.NetMeterPayment) || 0;
          if (patch.NetMeterPaid !== undefined) expObj.net_meter_paid = Boolean(patch.NetMeterPaid);
          const expNew = `|expenses:${JSON.stringify(expObj)}`;
          brokerNumber = brokerNumber.slice(0, expIdx) + expNew + (expEnd !== -1 ? brokerNumber.slice(expEnd) : '');
        } catch {}
      }
    }

    let workObj: any = {};
    const workIdx = brokerNumber.indexOf('|work:');
    if (workIdx !== -1) {
      try {
        workObj = JSON.parse(brokerNumber.slice(workIdx + 6)) || {};
      } catch {}
    }
    Object.assign(workObj, patch);
    const rest = workIdx !== -1 ? brokerNumber.slice(0, workIdx) : brokerNumber;
    brokerNumber = `${rest}|work:${JSON.stringify(workObj)}`;

    const payload: Partial<InstallmentRow> = {
      ...patch,
      BrokerNumber: brokerNumber
    };

    return this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${slNo}`, payload);
  }

  // NetMeter inline update
  saveNetMeter(slNo: number, payment: number, date: string, isPaid: boolean): Observable<any> {
    return this.saveStageProgress(slNo, {
      NetMeterPayment: payment,
      NetMeterPaid: isPaid,
      NetMeterDate: date
    });
  }

  // Update Workflow Status directly from StatusEdit column with current date
  updateWorkflowStatus(slNo: number, newStatus: string, netMeterInput?: string | number): Observable<any> {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const isNm = newStatus === 'Net Meter' || newStatus === 'NetMeter';

    const stageKeys: (keyof InstallmentRow)[] = [
      'LoginDate',
      'AgreementDate',
      'MaterialDispatchedDate',
      'InstallationDate',
      'NetMeterDate',
      'InspectionDate',
      'MeterConnectedDate',
      'CommissioningDate'
    ];

    const stageNames = [
      'Login',
      'Agreement',
      'Dispatched',
      'Installation',
      'NetMeter',
      'Inspection',
      'Connection',
      'Subsidy'
    ];

    const normStatus = isNm ? 'NetMeter' : newStatus;
    const targetIdx = stageNames.findIndex(s => s.toLowerCase() === normStatus.toLowerCase());

    const patch: any = {
      Status: newStatus
    };

    if (isNm) {
      patch.NetMeterPaid = true;
      patch.NetMeterDate = today;
      if (netMeterInput !== undefined && netMeterInput !== null && String(netMeterInput).trim() !== '') {
        const parsed = Number(netMeterInput);
        if (!isNaN(parsed)) {
          patch.NetMeterPayment = parsed;
        }
      }
      // Clear stages after NetMeter
      patch.InspectionDate = null;
      patch.MeterConnectedDate = null;
      patch.CommissioningDate = null;
    } else if (targetIdx !== -1) {
      const targetKey = stageKeys[targetIdx];
      // Save current date on selected milestone stage
      patch[targetKey] = today;

      // Clear all stages after targetIdx
      for (let i = targetIdx + 1; i < stageKeys.length; i++) {
        const k = stageKeys[i];
        patch[k] = null;
        if (k === 'NetMeterDate') {
          patch.NetMeterPaid = false;
        }
      }
    }

    return this.saveStageProgress(slNo, patch);
  }

  // Customer Cost update with current date
  saveCustomerCost(slNo: number, cost: number): Observable<any> {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const existing = this.rawInstallmentsSignal().find(r => Number(r.SlNo) === Number(slNo));
    let brokerNumber = existing?.BrokerNumber || '';
    if (brokerNumber.includes('|cost_date:')) {
      const idx = brokerNumber.indexOf('|cost_date:');
      const nextPipe = brokerNumber.indexOf('|', idx + 1);
      const after = nextPipe !== -1 ? brokerNumber.slice(nextPipe) : '';
      brokerNumber = brokerNumber.slice(0, idx) + `|cost_date:${today}` + after;
    } else {
      brokerNumber = `${brokerNumber}|cost_date:${today}`;
    }

    return this.updateCustomer(slNo, {
      CommittedPrice: cost,
      SpecsUpdatedAt: today,
      BrokerNumber: brokerNumber
    });
  }

  // Update Customer Pending directly (adjusts payment with current date)
  updateCustomerPending(slNo: number, newPending: number): Observable<any> {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const existing = this.rawInstallmentsSignal().find(r => Number(r.SlNo) === Number(slNo));
    const payMap = this.paymentsMap();
    const currentPaid = payMap.get(Number(slNo)) || 0;
    const currentTurnover = Number(existing?.CommittedPrice) || 0;

    let targetPaid = 0;
    let adjustCostObs$: Observable<any> | null = null;

    if (currentTurnover >= newPending) {
      targetPaid = currentTurnover - newPending;
    } else {
      const newTurnover = currentPaid + newPending;
      adjustCostObs$ = this.saveCustomerCost(slNo, newTurnover);
      targetPaid = currentPaid;
    }

    const pay$ = this.updateCustomerPaidTotal(slNo, targetPaid, today);
    if (adjustCostObs$) {
      return forkJoin([adjustCostObs$, pay$]);
    }
    return pay$;
  }

  // Add Quick Payment Transaction
  addCustomerPaymentTxn(slNo: number, amount: number, date: string, remark: string = 'Customer Payment (Manage Work)'): Observable<any> {
    const txnId = 'CTXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const txnPayload: InstallmentTxnRow = {
      TxnID: txnId,
      SlNo: Number(slNo),
      TxnDate: date,
      Amount: amount,
      TxnType: 'Customer',
      Remark: remark
    };

    return this.http.post('/api/insert?table=installment_txns', txnPayload).pipe(
      map(() => {
        // Sync total on installment row
        const existingTxns = this.getTxnsForCustomer(slNo);
        const currentSum = existingTxns.reduce((s, t) => s + (Number(t.Amount) || 0), 0) + amount;
        const cust = this.rawInstallmentsSignal().find(r => Number(r.SlNo) === Number(slNo));
        const currentPrice = Number(cust?.CommittedPrice) || 0;
        const patch: Partial<InstallmentRow> = { Total: currentSum };
        if (currentSum > currentPrice) {
          patch.CommittedPrice = currentSum;
        }
        return this.updateCustomer(slNo, patch).subscribe();
      })
    );
  }

  // Update Customer Paid Total Directly
  updateCustomerPaidTotal(slNo: number, newPaid: number, payDate: string): Observable<any> {
    const txns = this.getTxnsForCustomer(slNo);
    const currentTotal = txns.reduce((s, t) => s + (Number(t.Amount) || 0), 0);

    let op$: Observable<any>;
    if (newPaid === 0) {
      op$ = this.http.post(`/api/delete?table=installment_txns&matchField=SlNo&matchValue=${slNo}`, {});
    } else if (txns.length === 0) {
      const txnId = 'CTXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      op$ = this.http.post('/api/insert?table=installment_txns', {
        TxnID: txnId,
        SlNo: Number(slNo),
        TxnDate: payDate,
        Amount: newPaid,
        TxnType: 'Customer',
        Remark: 'Direct Paid Update (Manage Work)'
      });
    } else if (txns.length === 1) {
      op$ = this.http.post(`/api/update?table=installment_txns&matchField=TxnID&matchValue=${txns[0].TxnID}`, {
        Amount: newPaid,
        TxnDate: payDate
      });
    } else {
      const delta = newPaid - currentTotal;
      if (delta !== 0) {
        const txnId = 'CTXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        op$ = this.http.post('/api/insert?table=installment_txns', {
          TxnID: txnId,
          SlNo: Number(slNo),
          TxnDate: payDate,
          Amount: delta,
          TxnType: 'Customer',
          Remark: 'Payment Adjustment (Manage Work)'
        });
      } else {
        const latestTxn = txns[txns.length - 1];
        op$ = this.http.post(`/api/update?table=installment_txns&matchField=TxnID&matchValue=${latestTxn.TxnID}`, {
          TxnDate: payDate
        });
      }
    }

    return op$.pipe(
      map(() => {
        return this.updateCustomer(slNo, { Total: newPaid }).subscribe();
      })
    );
  }

  // Clear All Customer Payments
  clearCustomerPayments(slNo: number): Observable<any> {
    return this.http.post(`/api/delete?table=installment_txns&matchField=SlNo&matchValue=${slNo}`, {}).pipe(
      map(() => {
        return this.updateCustomer(slNo, { Total: 0 }).subscribe();
      })
    );
  }

  // Undo transaction handler
  undoActivity(act: ActivityLogItem): Observable<any> {
    try {
      const raw = localStorage.getItem('st_undone_activities');
      const map = raw ? JSON.parse(raw) : {};
      map[act.id] = {
        undoneAt: new Date().toISOString(),
        undoneBy: 'Admin'
      };
      localStorage.setItem('st_undone_activities', JSON.stringify(map));
    } catch (e) {}

    // Reload data to re-sync
    return this.loadAllData();
  }

  // Helper matching functions
  private matchesSearch(r: InstallmentRow, text: string): boolean {
    if (!text) return true;
    return (
      String(r.Name || '').toLowerCase().includes(text) ||
      String(r.ConsumerNo || '').toLowerCase().includes(text) ||
      String(r.MobileNumber || '').toLowerCase().includes(text) ||
      String(r.BrokerName || '').toLowerCase().includes(text) ||
      String(r.District || '').toLowerCase().includes(text) ||
      String(r.Address || '').toLowerCase().includes(text) ||
      String(r.CommittedBrand || '').toLowerCase().includes(text)
    );
  }

  private matchesPartner(r: InstallmentRow, partners: string[]): boolean {
    if (!partners || partners.length === 0) return true;
    const partnerVal = r.BrokerName ? r.BrokerName.trim() : '(No Partner)';
    const partnerName = partnerVal === '' ? '(No Partner)' : partnerVal;
    return partners.includes(partnerName);
  }

  private matchesDistrict(r: InstallmentRow, districts: string[]): boolean {
    if (!districts || districts.length === 0) return true;
    const distVal = (r.District && r.District.trim()) ? r.District.trim() : '(No District)';
    return districts.includes(distVal);
  }

  private matchesPayment(r: SummaryTableRow, payFilters: string[]): boolean {
    if (!payFilters || payFilters.length === 0) return true;
    const isFullyPaid = r.fin.payCategory === 'Fully Paid';
    const isPartiallyPaid = r.fin.payCategory === 'Partial Paid';
    const isUnpaid = r.fin.payCategory === 'Unpaid';
    const isNetMeterPaid = r.isNetMeterPaid;

    const hasMainFilters = payFilters.some(f => f === 'FullyPaid' || f === 'PartiallyPaid' || f === 'Unpaid');
    const hasNetMeterFilter = payFilters.includes('NetMeterPaid');

    let mainMatch = true;
    if (hasMainFilters) {
      mainMatch = (
        (payFilters.includes('FullyPaid') && isFullyPaid) ||
        (payFilters.includes('PartiallyPaid') && isPartiallyPaid) ||
        (payFilters.includes('Unpaid') && isUnpaid)
      );
    }

    let nmMatch = true;
    if (hasNetMeterFilter) {
      nmMatch = isNetMeterPaid;
    }

    return mainMatch && nmMatch;
  }

  private transformToSummaryRow(r: InstallmentRow, payMap: Map<number, number>): SummaryTableRow {
    const slNo = Number(r.SlNo);
    const fin = this.getCustomerSummaryFinancials(r, payMap);
    const stageIdx = getRowHighestStageIdx(r);
    const stageName = WORKFLOW_STAGES[stageIdx] ? WORKFLOW_STAGES[stageIdx].name : 'Login';

    let stageClass = 'stage-badge-login';
    if (stageName === 'Login') stageClass = 'stage-badge-login';
    else if (stageName === 'Agreement') stageClass = 'stage-badge-agreement';
    else if (stageName === 'Dispatched') stageClass = 'stage-badge-dispatched';
    else if (stageName === 'Installation') stageClass = 'stage-badge-installation';
    else if (stageName === 'NetMeter') stageClass = 'stage-badge-netmeter';
    else if (stageName === 'Inspection') stageClass = 'stage-badge-inspection';
    else if (stageName === 'Connection') stageClass = 'stage-badge-connection';
    else if (stageName === 'Subsidy') stageClass = 'stage-badge-subsidy';

    // Module & Inverter Make
    const { moduleMake, inverterMake } = this.parseBrandSpecs(r);

    // Is NetMeter Paid
    let isNm = Boolean(r.NetMeterPaid === true || (r.NetMeterPaid as any) === 'true' || (r.NetMeterPaid as any) === 1 || r.NetMeterDate);
    if (!isNm && r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try {
        const jsonStr = r.BrokerNumber.split('|expenses:')[1].split('|')[0];
        const expenses = JSON.parse(jsonStr);
        if (expenses && expenses.net_meter_paid) isNm = true;
      } catch (e) {}
    }

    return {
      slNo,
      name: r.Name || 'Unnamed',
      consumerNo: r.ConsumerNo || '',
      status: r.Status || 'Active',
      district: r.District || '',
      address: r.Address || '',
      mobile: r.MobileNumber || '',
      brokerName: r.BrokerName || '',
      pvModuleMake: moduleMake,
      inverterMake,
      stageIdx,
      stageName,
      stageClass,
      fin,
      isNetMeterPaid: isNm,
      row: r
    };
  }

  private getCustomerSummaryFinancials(r: InstallmentRow, payMap: Map<number, number>): SummaryFinancials {
    let expenses: any = {};
    if (r.BrokerNumber && r.BrokerNumber.includes('|expenses:')) {
      try {
        expenses = JSON.parse(r.BrokerNumber.split('|expenses:')[1].split('|')[0]) || {};
      } catch (e) {}
    }

    const paid = payMap.get(Number(r.SlNo)) || 0;
    const turnover = Number(r.CommittedPrice) || (expenses && Number(expenses.partner)) || 0;
    const unpaid = Math.max(0, turnover - paid);

    const material = (expenses.material !== undefined && expenses.material !== '')
      ? Number(expenses.material)
      : ((expenses.setCost !== undefined && expenses.setCost !== '') ? Number(expenses.setCost) : 0);

    const install = Number(expenses.install) || 0;
    const meter = (r.NetMeterPayment != null && (r.NetMeterPayment as any) !== '')
      ? Number(r.NetMeterPayment)
      : (Number(expenses.net_meter_payment) || 0);
    const delivery = (expenses.delivery !== undefined && expenses.delivery !== '')
      ? Number(expenses.delivery)
      : (Number(expenses.transport) || 0);
    const others = Number(expenses.other) || 0;
    const billing = (expenses.billing !== undefined && expenses.billing !== null && expenses.billing !== '')
      ? Number(expenses.billing)
      : 0;
    const gst = (expenses.gst !== undefined && expenses.gst !== '')
      ? Number(expenses.gst)
      : (expenses.gst_pct ? Math.round((billing > 0 ? billing : turnover) * (Number(expenses.gst_pct) / 100)) : 0);

    const setCost = material + install + meter + delivery + others + (gst || 0);
    const partner = (expenses.partner !== undefined && expenses.partner !== null && expenses.partner !== '')
      ? Number(expenses.partner)
      : 0;
    const profitBase = partner > 0 ? partner : turnover;
    const profit = profitBase - setCost;

    let payCategory: 'Unpaid' | 'Partial Paid' | 'Fully Paid' = 'Unpaid';
    if (turnover > 0 && paid >= turnover) {
      payCategory = 'Fully Paid';
    } else if (paid > 0) {
      payCategory = 'Partial Paid';
    } else {
      payCategory = 'Unpaid';
    }

    const comment = r.Comment || expenses.otherComment || '';

    return {
      paid,
      turnover,
      unpaid,
      material,
      install,
      meter,
      delivery,
      others,
      gst,
      setCost,
      profit,
      payCategory,
      comment
    };
  }

  private parseBrandSpecs(r: InstallmentRow): { moduleMake: string; inverterMake: string } {
    let specs: any = {};
    if (r.ProductSpecs) {
      try { specs = typeof r.ProductSpecs === 'string' ? JSON.parse(r.ProductSpecs) : r.ProductSpecs; } catch(e) {}
    }
    if (!specs || Object.keys(specs).length === 0) {
      if (r.BrokerNumber && r.BrokerNumber.includes('|work:')) {
        try {
          const workData = JSON.parse(r.BrokerNumber.split('|work:')[1].split('|')[0]);
          if (workData.ProductSpecs) {
            specs = typeof workData.ProductSpecs === 'string' ? JSON.parse(workData.ProductSpecs) : workData.ProductSpecs;
          }
        } catch(e) {}
      }
    }

    const committedBrand = r.CommittedBrand || '';
    let moduleMake = '';
    let inverterMake = '';
    if (committedBrand.includes('M:') || committedBrand.includes('Inv:')) {
      const mMatch = committedBrand.match(/M:\s*([^|]+)/i);
      const invMatch = committedBrand.match(/Inv:\s*([^|]+)/i);
      if (mMatch) moduleMake = mMatch[1].trim();
      if (invMatch) inverterMake = invMatch[1].trim();
    } else {
      moduleMake = committedBrand;
      inverterMake = committedBrand;
    }

    return {
      moduleMake: (specs?.PvModule?.Make || moduleMake || committedBrand || '—').toUpperCase(),
      inverterMake: (specs?.GridTiedInverter?.Make || inverterMake || '—').toUpperCase()
    };
  }

  private parseToIsoDate(dStr?: string): string | null {
    if (!dStr) return null;
    const str = String(dStr).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
    try {
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    } catch (e) {}
    return null;
  }

  private cleanActivityChanges(changes: any[]): ActivityChange[] {
    const result: ActivityChange[] = [];

    for (const chg of changes || []) {
      const field = chg.field || '';
      const oldV = chg.oldVal != null ? String(chg.oldVal).trim() : (chg.oldValue != null ? String(chg.oldValue).trim() : '');
      const newV = chg.newVal != null ? String(chg.newVal).trim() : (chg.newValue != null ? String(chg.newValue).trim() : '');

      // 1. If identical, not an actual modification
      if (oldV === newV) continue;

      // 2. Both empty/null
      if (!oldV && !newV) continue;

      // 3. Packed metadata or JSON (starts with '|' or '{')
      if (oldV.startsWith('|') || newV.startsWith('|') || (oldV.startsWith('{') && oldV.endsWith('}')) || (newV.startsWith('{') && newV.endsWith('}'))) {
        const extracted = this.extractPackedDiffs(field, oldV, newV);
        result.push(...extracted);
        continue;
      }

      // 4. Skip raw stringified system JSON dumps
      if (oldV.includes('{"CommissioningDate"') || newV.includes('{"CommissioningDate"') || oldV.includes('|expenses:') || newV.includes('|expenses:')) {
        continue;
      }

      // 5. Normal human-readable change
      result.push({
        field: this.formatActivityFieldName(field),
        oldVal: this.truncateVal(oldV),
        newVal: this.truncateVal(newV)
      });
    }

    return result;
  }

  private extractPackedDiffs(fieldName: string, oldStr: string, newStr: string): ActivityChange[] {
    const oldMap = this.parsePackedMap(oldStr);
    const newMap = this.parsePackedMap(newStr);
    const diffs: ActivityChange[] = [];

    const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    for (const k of allKeys) {
      const oldV = oldMap[k] != null ? String(oldMap[k]).trim() : '';
      const newV = newMap[k] != null ? String(newMap[k]).trim() : '';
      if (oldV !== newV) {
        diffs.push({
          field: this.formatActivityFieldName(k),
          oldVal: this.truncateVal(oldV),
          newVal: this.truncateVal(newV)
        });
      }
    }

    return diffs;
  }

  private parsePackedMap(str: string): { [k: string]: any } {
    const result: { [k: string]: any } = {};
    if (!str) return result;

    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const obj = JSON.parse(str);
        this.flattenActivityObj('', obj, result);
        return result;
      } catch {}
    }

    const parts = str.split('|').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) continue;
      const prefix = part.substring(0, colonIdx).trim();
      const valStr = part.substring(colonIdx + 1).trim();

      if (valStr.startsWith('{') && valStr.endsWith('}')) {
        try {
          const obj = JSON.parse(valStr);
          this.flattenActivityObj(prefix, obj, result);
          continue;
        } catch {}
      }
      result[prefix] = valStr;
    }

    return result;
  }

  private flattenActivityObj(prefix: string, obj: any, out: { [k: string]: any }): void {
    if (!obj || typeof obj !== 'object') return;
    const ignoredKeys = new Set([
      'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'ModifiedBy', 
      'LastModifiedBy', 'SavedBy', 'SpecsUpdatedAt', 'SpecsUpdatedBy', 'Status'
    ]);

    for (const [k, v] of Object.entries(obj)) {
      if (ignoredKeys.has(k)) continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        this.flattenActivityObj(k, v, out);
      } else if (Array.isArray(v)) {
        out[k] = JSON.stringify(v);
      } else {
        out[k] = v != null ? String(v).trim() : '';
      }
    }
  }

  private formatActivityFieldName(name: string): string {
    if (!name) return '';
    const map: { [k: string]: string } = {
      MeterConnectedDate: 'Meter Connected Date',
      NetMeterDate: 'Net Meter Date',
      CommissioningDate: 'Commissioning Date',
      InspectionDate: 'Inspection Date',
      MaterialDispatchedDate: 'Material Dispatched Date',
      AgreementDate: 'Agreement Date',
      InstallationDate: 'Installation Date',
      LoginDate: 'Login Date',
      FirstInstallment: '1st Installment',
      SecondInstallment: '2nd Installment',
      ThirdInstallment: '3rd Installment',
      CommittedPrice: 'Committed Price',
      CommittedBrand: 'Committed Brand',
      MobileNumber: 'Mobile Number',
      ConsumerNo: 'Consumer No',
      BrokerName: 'Broker Name',
      BrokerNumber: 'Broker Number',
      NetMeterPayment: 'Net Meter Payment',
      NetMeterPaid: 'Net Meter Paid',
      partner: 'Partner Expense',
      Total: 'Total Work Cost'
    };
    if (map[name]) return map[name];
    return name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private truncateVal(val: string): string {
    if (!val) return '';
    if (val.length > 80) return val.slice(0, 77) + '...';
    return val;
  }
}
