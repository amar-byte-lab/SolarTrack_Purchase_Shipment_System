export interface ParsedCustomerItem {
  Name: string;
  ConsumerNo: string;
  ApplicationNumber: string;
  ProposedCapacity: string;
  SubDivision: string;
  DivisionName: string;
  CircleName: string;
  MobileNumber: string;
  District: string;
  BrokerName: string;
  LoginDate: string;
  Address?: string;
  PinCode?: string;
  Pin?: string;
  Status: string;
  IsDuplicate?: boolean;
  selected?: boolean;
}

export interface ConflictingCustomerItem {
  SlNo: number;
  Name: string;
  GridData: {
    ConsumerNo: string;
    ApplicationNumber: string;
    ProposedCapacity: string;
    SubDivision: string;
    DivisionName: string;
    CircleName: string;
    MobileNumber: string;
    District: string;
    BrokerName: string;
    Address: string;
    LoginDate: string;
  };
  ExcelData: {
    ConsumerNo: string;
    ApplicationNumber: string;
    ProposedCapacity: string;
    SubDivision: string;
    DivisionName: string;
    CircleName: string;
    MobileNumber: string;
    District: string;
    BrokerName: string;
    Address: string;
    LoginDate: string;
  };
  Diffs: {
    ConsumerNo: boolean;
    ApplicationNumber: boolean;
    ProposedCapacity: boolean;
    SubDivision: boolean;
    DivisionName: boolean;
    CircleName: boolean;
    MobileNumber: boolean;
    District: boolean;
    BrokerName: boolean;
    Address: boolean;
    LoginDate: boolean;
  };
  SelectedChoice: 'EXCEL' | 'GRID';
}

export interface MissingCustomerItem {
  SlNo: number;
  Name: string;
  ConsumerNo?: string;
  ApplicationNumber?: string;
  ProposedCapacity?: string;
  SubDivision?: string;
  DivisionName?: string;
  CircleName?: string;
  MobileNumber?: string;
  District?: string;
  BrokerName?: string;
  LoginDate?: string;
  Status?: string;
}

export interface ImportAnalysisSummary {
  newCount: number;
  conflictCount: number;
  identicalCount: number;
  missingCount: number;
}
