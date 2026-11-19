export interface InstallmentRow {
  SlNo: number;
  Name?: string;
  ConsumerNo?: string;
  Status?: string;
  District?: string;
  Address?: string;
  MobileNumber?: string;
  CommittedBrand?: string;
  FirstInstallment?: number;
  SecondInstallment?: number;
  ThirdInstallment?: number;
  Total?: number;
  CommittedPrice?: number;
  VendorPrice?: number;
  VendorPaid?: number;
  LoginDate?: string;
  AgreementDate?: string;
  MaterialDispatchedDate?: string;
  InstallationDate?: string;
  NetMeterDate?: string;
  InspectionDate?: string;
  MeterConnectedDate?: string;
  Commission?: number;
  CommissionPaid?: number;
  BrokerName?: string;
  BrokerNumber?: string;
  CommissioningDate?: string;
  PinCode?: string;
  State?: string;
  NetMeterPayment?: number;
  NetMeterPaid?: boolean;
  SubDivision?: string;
  DivisionName?: string;
  CircleName?: string;
  ApplicationNumber?: string;
  ProposedCapacity?: string;
  ProductSpecs?: any;
  SpecsUpdatedBy?: string;
  SpecsUpdatedAt?: string;
  CreatedAt?: string;
  Comment?: string;
}

export interface InstallmentTxnRow {
  TxnID: string;
  SlNo: number;
  TxnDate: string;
  Amount: number;
  Remark?: string;
  TxnType?: string;
  CreatedAt?: string;
  CreatedBy?: string;
}

export interface CommissionTxnRow {
  TxnID?: string;
  SlNo: number;
  TxnDate?: string;
  Amount: number;
  Remark?: string;
  CreatedAt?: string;
  CreatedBy?: string;
}

export interface InstallmentRemarkRow {
  RemarkID?: string;
  SlNo: number;
  CreatedAt?: string;
  Date?: string;
  Remark?: string;
  Note?: string;
  Author?: string;
  CreatedBy?: string;
  Type?: string;
}

export interface InventoryDispatchRow {
  DispatchID?: string;
  Date?: string;
  DispatchDate?: string;
  CreatedAt?: string;
  CreatedBy?: string;
  ChallanNo?: string;
  SiteName?: string;
  CustomerName?: string;
  Quantity?: number | string;
  ItemCode?: string;
  ItemName?: string;
}

export interface ShipmentRow {
  ShipmentNo?: string;
  shipmentno?: string;
  PurchaseDate?: string;
  purchasedate?: string;
  CreatedAt?: string;
  createdat?: string;
  UpdatedAt?: string;
  updatedat?: string;
  ShipmentType?: string;
  shipmenttype?: string;
  VendorName?: string;
  vendorname?: string;
  InvoiceNumber?: string;
  invoicenumber?: string;
  VehicleNumber?: string;
  vehiclenumber?: string;
  TransportationCost?: number;
  transportationcost?: number;
}

export interface ShipmentRemarkRow {
  RemarkID?: string;
  ShipmentNo?: string;
  CreatedAt?: string;
  Date?: string;
  Remark?: string;
}

export interface SummaryColumn {
  key: string;
  label: string;
  visible: boolean;
}

export interface SummaryFinancials {
  paid: number;
  turnover: number;
  unpaid: number;
  material: number;
  install: number;
  meter: number;
  delivery: number;
  others: number;
  gst: number;
  setCost: number;
  profit: number;
  payCategory: 'Unpaid' | 'Partial Paid' | 'Fully Paid';
  comment: string;
}

export interface SummaryTableRow {
  slNo: number;
  name: string;
  consumerNo: string;
  status: string;
  district: string;
  address: string;
  mobile: string;
  brokerName: string;
  pvModuleMake: string;
  inverterMake: string;
  stageIdx: number;
  stageName: string;
  stageClass: string;
  fin: SummaryFinancials;
  isNetMeterPaid: boolean;
  row: InstallmentRow;
}

export interface SummaryGroup {
  name: 'Unpaid' | 'Partial Paid' | 'Fully Paid';
  list: SummaryTableRow[];
  colorClass: string;
  groupClass: string;
  rowClass: string;
}

export interface DistrictStat {
  district: string;
  count: number;
  active: boolean;
}

export interface StageStat {
  stage: string;
  num: number;
  name: string;
  count: number;
  active: boolean;
  badgeClass: string;
}

export interface PaymentStat {
  key: string;
  label: string;
  count: number;
  active: boolean;
}

export interface ActivityChange {
  field: string;
  oldVal?: string | null;
  newVal?: string | null;
}

export interface ActivityLogItem {
  id: string;
  timestamp?: string;
  date?: string;
  time?: string;
  page?: string;
  table?: string;
  action?: string;
  user?: string;
  userRole?: string;
  recordId?: string | number;
  customerName?: string;
  consumerNo?: string;
  changes: ActivityChange[];
  undone?: boolean;
  undoneBy?: string;
  undoneAt?: string;
  stageField?: string;
  txnId?: string;
  amount?: number;
  remarkId?: string;
  dispatchId?: string;
}

export interface ActivityLog {
  id: string;
  timestamp?: string;
  date?: string;
  time?: string;
  user?: string;
  username?: string;
  action?: string;
  actionType?: string;
  page?: string;
  table?: string;
  customerName?: string;
  consumerNo?: string;
  slNo?: number | string;
  recordId?: number | string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  changes?: ActivityChange[];
  details?: string;
  message?: string;
  undone?: boolean;
}

export const WORKFLOW_STAGES = [
  { key: 'LoginDate', name: 'Login', num: 1, colorClass: 'stage-tag-1' },
  { key: 'AgreementDate', name: 'Agreement', num: 2, colorClass: 'stage-tag-2' },
  { key: 'MaterialDispatchedDate', name: 'Dispatched', num: 3, colorClass: 'stage-tag-3' },
  { key: 'InstallationDate', name: 'Installation', num: 4, colorClass: 'stage-tag-4' },
  { key: 'NetMeter', name: 'NetMeter', num: 5, colorClass: 'stage-tag-5' },
  { key: 'InspectionDate', name: 'Inspection', num: 6, colorClass: 'stage-tag-6' },
  { key: 'MeterConnectedDate', name: 'Connection', num: 7, colorClass: 'stage-tag-7' },
  { key: 'CommissioningDate', name: 'Subsidy', num: 8, colorClass: 'stage-tag-8' }
];

export function getRowHighestStageIdx(r: any): number {
  let work: any = {};
  if (r.BrokerNumber && r.BrokerNumber.includes('|work:')) {
    try {
      work = JSON.parse(r.BrokerNumber.split('|work:')[1].split('|')[0]) || {};
    } catch (e) {}
  }
  const isNm = Boolean(r.NetMeterPaid === true || r.NetMeterPaid === 'true' || r.NetMeterPaid === 1 || r.NetMeterDate || work.NetMeterDate);
  const stages = [
    Boolean(r.LoginDate || work.LoginDate),
    Boolean(r.AgreementDate || work.AgreementDate),
    Boolean(r.MaterialDispatchedDate || work.MaterialDispatchedDate),
    Boolean(r.InstallationDate || work.InstallationDate),
    isNm,
    Boolean(r.InspectionDate || work.InspectionDate),
    Boolean(r.MeterConnectedDate || work.MeterConnectedDate),
    Boolean(r.CommissioningDate || work.CommissioningDate)
  ];
  let highestIdx = -1;
  stages.forEach((d, idx) => {
    if (d) highestIdx = Math.max(highestIdx, idx);
  });
  return highestIdx < 0 ? 0 : highestIdx;
}

export function getCustomerWorkStatus(r: any): string {
  const idx = getRowHighestStageIdx(r);
  return WORKFLOW_STAGES[idx] ? WORKFLOW_STAGES[idx].name : 'Login';
}
