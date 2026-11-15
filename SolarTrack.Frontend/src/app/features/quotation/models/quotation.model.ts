export interface ProductSet {
  ProductName: string;
  CreatedAt?: string;
}

export interface ProductItem {
  RowID?: string;
  ProductName: string;
  ItemName: string;
  Price: number;
}

export interface QuotationItem {
  id: string;
  productName: string;
  itemName: string;
  qty: number;
  price: number;
  isCustom?: boolean;
}

export interface QuotationGroup {
  productName: string;
  isCustom: boolean;
  items: QuotationItem[];
}

export interface AdjustmentLine {
  key: string;
  label: string;
  type: 'subtraction' | 'tax' | 'addition';
  value: number;
  active: boolean;
  sign: '+' | '-';
}

export interface SubsidyOption {
  kw: number;
  state: number;
  central: number;
  total: number;
}

export interface CompanyBank {
  holder: string;
  name: string;
  accountNo: string;
  ifsc: string;
}

export interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  gst: string;
  defaultGst: number;
  addresses: string[];
  selectedAddress: string;
  bank: CompanyBank;
  terms: string;
  subsidies: SubsidyOption[];
}
