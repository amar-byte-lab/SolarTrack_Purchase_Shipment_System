import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, tap } from 'rxjs';
import { ManagedUser, SettingsState } from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  settings = signal<SettingsState>({
    companyName: 'Shri Trutiyadev Solar Enterprises',
    companyEmail: 'shritrutiyadevsolar@gmail.com',
    companyPhone: '8763443172',
    companyGst: '21BWBPM8649F1ZJ',
    defaultGst: 5,
    terms: '',
    bankAcHolder: '',
    bankName: '',
    bankAcNo: '',
    bankBranchIfs: '',
    upiId: '',
    addresses: [],
    subsidies: []
  });

  users = signal<ManagedUser[]>([]);
  roles = signal<string[]>([]);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  loadAll(): Observable<any> {
    this.isLoading.set(true);
    return forkJoin({
      settingsList: this.http.get<{ Key: string; Value: string }[]>('/api/get?table=settings'),
      authConfig: this.http.get<{ users: ManagedUser[]; roles: string[] }>('/api/auth-config')
    }).pipe(
      tap(({ settingsList, authConfig }) => {
        this.isLoading.set(false);

        // Process Settings List
        if (settingsList && Array.isArray(settingsList)) {
          const getVal = (key: string, def = '') => settingsList.find(s => s.Key === key)?.Value ?? def;

          let parsedAddresses: string[] = [];
          try {
            parsedAddresses = JSON.parse(getVal('CompanyAddresses', '[]'));
          } catch {}

          let parsedSubsidies: { kw: number; state: number; central: number }[] = [];
          try {
            parsedSubsidies = JSON.parse(getVal('GovtSubsidies', '[]'));
          } catch {}

          this.settings.set({
            companyName: getVal('CompanyName', 'Shri Trutiyadev Solar Enterprises'),
            companyEmail: getVal('CompanyEmail', 'shritrutiyadevsolar@gmail.com'),
            companyPhone: getVal('CompanyPhone', '8763443172'),
            companyGst: getVal('CompanyGST', '21BWBPM8649F1ZJ'),
            defaultGst: Number(getVal('DefaultGST', '5')) || 5,
            terms: getVal('CompanyTerms', ''),
            bankAcHolder: getVal('BankAcHolder', ''),
            bankName: getVal('BankName', ''),
            bankAcNo: getVal('BankAcNo', ''),
            bankBranchIfs: getVal('BankBranchIFS', ''),
            upiId: getVal('CompanyUPI', ''),
            addresses: parsedAddresses,
            subsidies: parsedSubsidies
          });
        }

        // Process Auth Config
        if (authConfig) {
          this.users.set(authConfig.users || []);
          this.roles.set(authConfig.roles || ['admin', 'superadmin', 'partner', 'user', 'Employee']);
        }
      })
    );
  }

  saveSettings(): Observable<any> {
    this.isSaving.set(true);
    const s = this.settings();

    const settingsRows = [
      { Key: 'CompanyName', Value: s.companyName },
      { Key: 'CompanyEmail', Value: s.companyEmail },
      { Key: 'CompanyPhone', Value: s.companyPhone },
      { Key: 'CompanyGST', Value: s.companyGst },
      { Key: 'DefaultGST', Value: String(s.defaultGst) },
      { Key: 'CompanyTerms', Value: s.terms },
      { Key: 'BankAcHolder', Value: s.bankAcHolder },
      { Key: 'BankName', Value: s.bankName },
      { Key: 'BankAcNo', Value: s.bankAcNo },
      { Key: 'BankBranchIFS', Value: s.bankBranchIfs },
      { Key: 'CompanyUPI', Value: s.upiId },
      { Key: 'CompanyAddresses', Value: JSON.stringify(s.addresses) },
      { Key: 'GovtSubsidies', Value: JSON.stringify(s.subsidies) }
    ];

    return this.http.post('/api/save-table', { table: 'settings', rows: settingsRows }).pipe(
      tap(() => this.isSaving.set(false))
    );
  }

  saveAuthConfig(): Observable<any> {
    return this.http.post('/api/auth-config', {
      users: this.users(),
      roles: this.roles()
    });
  }

  addUser(user: ManagedUser): void {
    this.users.set([...this.users(), user]);
    this.saveAuthConfig().subscribe();
  }

  updateUser(userid: string, updated: ManagedUser): void {
    this.users.set(this.users().map(u => u.userid === userid ? updated : u));
    this.saveAuthConfig().subscribe();
  }

  deleteUser(userid: string): void {
    this.users.set(this.users().filter(u => u.userid !== userid));
    this.saveAuthConfig().subscribe();
  }

  addRole(role: string): void {
    if (!this.roles().includes(role)) {
      this.roles.set([...this.roles(), role]);
      this.saveAuthConfig().subscribe();
    }
  }

  deleteRole(role: string): void {
    this.roles.set(this.roles().filter(r => r !== role));
    this.saveAuthConfig().subscribe();
  }
}
