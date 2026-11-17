import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { Borrower, BorrowerTxn } from '../models/ledger.model';
import { AuthService } from '../../../core/services/auth.service';

export const AVATAR_COLORS = [
  '#ff4500', '#10b981', '#0ea5e9', '#14b8a6', '#f59e0b',
  '#8b5cf6', '#3b82f6', '#f43f5e', '#ec4899', '#84cc16'
];

@Injectable({
  providedIn: 'root'
})
export class LedgerService {
  private rawBorrowersSignal = signal<Borrower[]>([]);
  private rawTxnsSignal = signal<BorrowerTxn[]>([]);
  
  // Selected borrower for modal view
  selectedBorrower = signal<Borrower | null>(null);

  // Filters State
  searchQuery = signal<string>('');
  filterStatus = signal<'all' | 'due' | 'advance' | 'settled'>('all');
  isMasked = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  // Parsed borrowers with balances, last transaction info, and avatar colors
  readonly borrowers = computed<Borrower[]>(() => {
    const rawList = this.rawBorrowersSignal();
    const allTxns = this.rawTxnsSignal();

    return rawList.map(b => {
      const bId = Number(b.BorrowerID);
      const bTxns = allTxns.filter(t => Number(t.BorrowerID) === bId);
      
      // Sort ascending by date
      bTxns.sort((x, y) => (x.TxnDate || '').localeCompare(y.TxnDate || '') || (x.TxnID - y.TxnID));

      let credit = 0; // You gave
      let debit = 0;  // You got
      let lastTxn: BorrowerTxn | null = null;

      bTxns.forEach(t => {
        const amt = Number(t.Amount) || 0;
        if (t.Type === 'Credit') {
          credit += amt;
        } else {
          debit += amt;
        }
        lastTxn = t;
      });

      const net = credit - debit;
      let direction: 'due' | 'advance' | 'settled' = 'settled';
      if (net > 0.01) direction = 'due';
      else if (net < -0.01) direction = 'advance';

      let lastTxnText = '';
      if (lastTxn) {
        const typeStr = (lastTxn as BorrowerTxn).Type === 'Credit' ? 'Given' : 'Received';
        const amtStr = '₹' + (Number((lastTxn as BorrowerTxn).Amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const dateStr = this.formatDate((lastTxn as BorrowerTxn).TxnDate);
        lastTxnText = `${amtStr} ${typeStr} on ${dateStr}`;
      } else {
        const createdStr = this.formatDate(b.CreatedAt);
        lastTxnText = createdStr ? `Added on ${createdStr}` : 'Added recently';
      }

      return {
        ...b,
        balance: net,
        direction,
        lastTxnText,
        avatarBg: this.getAvatarColor(b.Name)
      };
    });
  });

  // Filtered borrowers matching search query and status filter
  readonly filteredBorrowers = computed(() => {
    const list = this.borrowers();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.filterStatus();

    return list.filter(b => {
      // Search filter
      if (query) {
        const nameMatch = (b.Name || '').toLowerCase().includes(query);
        const mobileMatch = (b.Mobile || '').includes(query);
        const addrMatch = (b.Address || '').toLowerCase().includes(query);
        if (!nameMatch && !mobileMatch && !addrMatch) return false;
      }

      // Status filter
      if (filter === 'due') return (b.balance || 0) > 0.01;
      if (filter === 'advance') return (b.balance || 0) < -0.01;
      if (filter === 'settled') return Math.abs(b.balance || 0) <= 0.01;

      return true;
    });
  });

  // Net Balance (sum of all balances)
  readonly netBalance = computed(() => {
    return this.borrowers().reduce((sum, b) => sum + (b.balance || 0), 0);
  });

  // Net Direction ('YOU GET' or 'YOU GIVE' or 'SETTLED')
  readonly netDirection = computed(() => {
    const net = this.netBalance();
    if (net > 0.01) return 'YOU GET';
    if (net < -0.01) return 'YOU GIVE';
    return 'SETTLED';
  });

  // Active accounts count
  readonly activeAccountsCount = computed(() => {
    return this.borrowers().filter(b => b.Status !== 'Inactive' && b.Status !== 'Closed').length;
  });

  // Active borrower transactions for modal view
  readonly selectedBorrowerTxns = computed<BorrowerTxn[]>(() => {
    const sel = this.selectedBorrower();
    if (!sel) return [];
    const bId = Number(sel.BorrowerID);
    const allTxns = this.rawTxnsSignal();
    const txns = allTxns.filter(t => Number(t.BorrowerID) === bId);
    
    // Sort ascending by date
    return [...txns].sort((x, y) => (x.TxnDate || '').localeCompare(y.TxnDate || '') || (x.TxnID - y.TxnID));
  });

  constructor(private http: HttpClient, private authService: AuthService) {}

  loadAllData(): Observable<any> {
    this.isLoading.set(true);
    const currentUser = this.authService.currentUser();
    const userId = currentUser ? (currentUser.userid || currentUser.username || 'admin') : 'admin';

    return forkJoin({
      borrowers: this.http.get<any>(`/api/borrower-list?userId=${encodeURIComponent(userId)}`).pipe(
        map(res => (res?.value || res?.data || res || []) as Borrower[]),
        catchError(() => of([] as Borrower[]))
      ),
      txns: this.http.get<any>(`/api/borrower-txns?userId=${encodeURIComponent(userId)}`).pipe(
        map(res => (res?.value || res?.data || res || []) as BorrowerTxn[]),
        catchError(() => of([] as BorrowerTxn[]))
      )
    }).pipe(
      map(res => {
        this.rawBorrowersSignal.set(res.borrowers);
        this.rawTxnsSignal.set(res.txns);
        this.isLoading.set(false);

        // If a borrower was selected, update its reference
        const currentSel = this.selectedBorrower();
        if (currentSel) {
          const updated = res.borrowers.find(b => Number(b.BorrowerID) === Number(currentSel.BorrowerID));
          if (updated) {
            const bTxns = res.txns.filter(t => Number(t.BorrowerID) === Number(updated.BorrowerID));
            let credit = 0, debit = 0;
            bTxns.forEach(t => {
              if (t.Type === 'Credit') credit += (Number(t.Amount) || 0);
              else debit += (Number(t.Amount) || 0);
            });
            this.selectedBorrower.set({ ...updated, balance: credit - debit });
          }
        }

        return res;
      })
    );
  }

  toggleMask(): void {
    this.isMasked.update(v => !v);
  }

  addBorrower(payload: { Name: string; Mobile?: string; Address?: string }): Observable<any> {
    const currentUser = this.authService.currentUser();
    const userId = (currentUser?.userid || currentUser?.username || 'admin').toLowerCase();

    return this.http.post('/api/borrower-add', {
      Name: payload.Name,
      Mobile: payload.Mobile || '',
      Address: payload.Address || '',
      CreatedBy: userId
    });
  }

  addTransaction(payload: { BorrowerID: number; Amount: number; Type: 'Credit' | 'Debit'; TxnDate: string; Remarks?: string }): Observable<any> {
    const currentUser = this.authService.currentUser();
    const userId = (currentUser?.userid || currentUser?.username || 'admin').toLowerCase();

    return this.http.post('/api/borrower-txn-add', {
      BorrowerID: payload.BorrowerID,
      Amount: payload.Amount,
      Type: payload.Type,
      TxnDate: payload.TxnDate,
      Remarks: payload.Remarks || '',
      CreatedBy: userId
    });
  }

  updateTransaction(payload: { TxnID: number; Amount: number; Type: 'Credit' | 'Debit'; TxnDate: string; Remarks?: string }): Observable<any> {
    return this.http.post('/api/borrower-txn-update', payload);
  }

  deleteTransaction(txnId: number): Observable<any> {
    return this.http.post('/api/borrower-txn-delete', { TxnID: txnId });
  }

  deleteBorrower(borrowerId: number): Observable<any> {
    return this.http.post('/api/borrower-delete', { BorrowerID: borrowerId });
  }

  formatDate(d?: string): string {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  }

  getAvatarColor(name?: string): string {
    let hash = 0;
    const str = name || '';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }
}
