export interface ManagedUser {
  userid: string;
  username: string;
  email: string;
  mobile?: string;
  password?: string;
  role: string;
  status?: string;
}

export interface SettingsState {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyGst: string;
  defaultGst: number;
  terms: string;
  bankAcHolder: string;
  bankName: string;
  bankAcNo: string;
  bankBranch: string;
  bankIfsc: string;
  bankBranchIfs: string;
  upiId: string;
  addresses: string[];
  subsidies: { kw: number; state: number; central: number }[];
}
