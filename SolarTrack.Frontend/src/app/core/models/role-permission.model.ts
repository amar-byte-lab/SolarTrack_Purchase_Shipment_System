export interface RoleAccessRule {
  role: string;
  // Summary Module
  summaryAccess: boolean;
  summaryMode: 'full' | 'default_view'; // 'default_view' hides Select column and Exclude
  summaryScope: 'all' | 'own_customers'; // 'own_customers' limits to own associated customers
  summaryActionView: 'edit' | 'popup_view'; // 'popup_view' opens clean read-only popup view
  
  // Quotation Module
  quotationAccess: boolean;
  quotationMode: 'full' | 'view';
  
  // Document Module
  documentAccess: boolean;
  documentMode: 'full' | 'view';
  
  // Calculator Module
  calculatorAccess: boolean;
  
  // Ledger Module
  ledgerAccess: boolean;
  ledgerScope: 'all' | 'own'; // 'own' limits to own transactions
  
  // Inventory Module
  inventoryAccess: boolean;
  
  // Files Module
  filesAccess: boolean;
  
  // Settings Module
  settingsAccess: boolean;
}

export interface SpecialUserSettings {
  [userid: string]: {
    isSpecialUser?: boolean;
    allowedPartners?: string[]; // multiple selected partners
    assignedPartner?: string;
  };
}
