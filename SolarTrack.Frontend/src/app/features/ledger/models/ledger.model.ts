export interface Borrower {
  BorrowerID: number;
  Name: string;
  Mobile?: string;
  Address?: string;
  Status?: string;
  CreatedAt?: string;
  CreatedBy?: string;
  // Computed / UI properties
  balance?: number;
  direction?: 'due' | 'advance' | 'settled';
  lastTxnText?: string;
  avatarBg?: string;
}

export interface BorrowerTxn {
  TxnID: number;
  BorrowerID: number;
  TxnDate: string;
  Amount: number;
  Type: 'Credit' | 'Debit'; // Credit = You Gave (Red), Debit = You Got / Received (Green)
  Remarks?: string;
  CreatedAt?: string;
}
