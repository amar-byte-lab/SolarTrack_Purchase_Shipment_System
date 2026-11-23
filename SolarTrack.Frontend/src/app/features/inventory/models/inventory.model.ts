export type StockStatusType = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface InventoryItem {
  ItemCode: string;
  ItemName: string;
  Category: string;
  Unit: string;
  MinThreshold: number;
  BuyingPrice: number;
  Location?: string;
  Description?: string;
}

export interface InventoryItemWithStock extends InventoryItem {
  totalInward: number;
  totalDispatched: number;
  inHandQty: number;
  status: StockStatusType;
  totalStockValuation: number;
}

export interface InwardItemEntry {
  itemCode: string;
  itemName: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  gstRate: number;
  costWithGst: number;
  totalCostWithGst: number;
  deliveryCostShare: number;
  effectiveCostPerUnit: number;
}

export interface InventoryInwardRow {
  InwardID: string;
  Date: string;
  InvoiceNo?: string;
  Supplier: string;
  ItemCode: string;
  Quantity: number;
  UnitPrice: number;
  GstRate?: number;
  CostPerUnit?: number;
  TransportCost?: number;
  ConsignmentTransportCost?: number;
  TotalCost: number;
  Location?: string;
  Remarks?: string;
  DocumentName?: string;
  DocumentData?: string;
  Documents?: string;
}

export interface GroupedInwardConsignment {
  key: string;
  id?: string;
  date: string;
  supplier: string;
  location: string;
  transportCost: number;
  remarks: string;
  items: Array<{
    id?: string;
    itemCode: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    gstRate: number;
    costPerUnit: number;
    totalCost: number;
    unit?: string;
  }>;
  inwardIds: string[];
  totalQty: number;
  totalMaterialCost: number;
  totalGst: number;
  grandTotal: number;
  documents: Array<{ name: string; data?: string }>;
}

export interface CustomerAllocationEntry {
  slNo?: number;
  customerName: string;
  setCost: number;
  installCost: number;
  deliveryCost: number;
  otherCost: number;
  remark: string;
  description?: string;
  total: number;
}

export interface DispatchItemEntry {
  id?: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitBuyingPrice: number;
  dispatchedCost: number;
  unit?: string;
  availableStock?: number;
}

export interface InventoryDispatchRow {
  DispatchID: string;
  Date: string;
  ChallanNo?: string;
  SiteName: string;
  ItemCode: string;
  Quantity: number;
  UnitBuyingPrice: number;
  DispatchedCost: number;
  TransportCost?: number;
  DistanceKm?: number;
  ChargePerKm?: number;
  Vehicle?: string;
  Remarks?: string;
  CustomerNotes?: string;
  CustomerAllocations?: string | CustomerAllocationEntry[];
  DocumentName?: string;
  DocumentData?: string;
  Documents?: string;
}

export interface GroupedDispatchConsignment {
  key: string;
  id?: string;
  challanNo?: string;
  date: string;
  siteName: string;
  vehicle: string;
  transportCost: number;
  distanceKm?: number;
  chargePerKm?: number;
  customerNotes?: string;
  costPerKm?: number;
  extraDeliveryCost?: number;
  extraDeliveryComment?: string;
  isOurProject: boolean;
  remarks: string;
  items: Array<{
    id: string;
    itemCode: string;
    itemName: string;
    qty: number;
    unitBuyingPrice: number;
    dispatchedCost: number;
    unit?: string;
  }>;
  dispatchIds: string[];
  totalQty: number;
  totalMaterialCost: number;
  grandTotal: number;
  customerAllocations: CustomerAllocationEntry[];
  documents: Array<{ name: string; data?: string }>;
}

export interface InventoryKpiSummary {
  totalTurnover: number;
  totalDispatchedCost: number;
  totalTransportationCost: number;
  warehouseValuation: number;
  totalInHandStock: number;
  totalSkus: number;
}

export interface MonthlyFinancialPoint {
  monthKey: string;
  monthLabel: string;
  totalTurnover: number;
  dispatchedCost: number;
  warehouseValuation: number;
  transportationCost: number;
}

export interface ExpenseBreakdownItem {
  id: 'transportation' | 'installation' | 'material' | 'other';
  label: string;
  amount: number;
  percentage: number;
  color: string;
  accentBg: string;
  icon: string;
  description: string;
}

export interface ExpensesSummary {
  materialCost: number;
  transportationCost: number;
  installationCost: number;
  otherCost: number;
  totalExpenses: number;
  items: ExpenseBreakdownItem[];
}
