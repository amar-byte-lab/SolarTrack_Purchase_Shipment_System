import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { RoleAccessRule, SpecialUserSettings } from '../models/role-permission.model';
import { AuthService } from './auth.service';

export const DEFAULT_ROLE_RULES: RoleAccessRule[] = [
  {
    role: 'admin',
    summaryAccess: true,
    summaryMode: 'full',
    summaryScope: 'all',
    summaryActionView: 'edit',
    quotationAccess: true,
    quotationMode: 'full',
    documentAccess: true,
    documentMode: 'full',
    calculatorAccess: true,
    ledgerAccess: true,
    ledgerScope: 'all',
    inventoryAccess: true,
    filesAccess: true,
    settingsAccess: true
  },
  {
    role: 'superadmin',
    summaryAccess: true,
    summaryMode: 'full',
    summaryScope: 'all',
    summaryActionView: 'edit',
    quotationAccess: true,
    quotationMode: 'full',
    documentAccess: true,
    documentMode: 'full',
    calculatorAccess: true,
    ledgerAccess: true,
    ledgerScope: 'all',
    inventoryAccess: true,
    filesAccess: true,
    settingsAccess: true
  },
  {
    role: 'Employee',
    summaryAccess: false,
    summaryMode: 'default_view',
    summaryScope: 'own_customers',
    summaryActionView: 'popup_view',
    quotationAccess: true,
    quotationMode: 'full',
    documentAccess: true,
    documentMode: 'view',
    calculatorAccess: true,
    ledgerAccess: true,
    ledgerScope: 'own',
    inventoryAccess: false,
    filesAccess: false,
    settingsAccess: false
  },
  {
    role: 'Associates',
    summaryAccess: true,
    summaryMode: 'default_view',
    summaryScope: 'own_customers',
    summaryActionView: 'popup_view',
    quotationAccess: true,
    quotationMode: 'full',
    documentAccess: true,
    documentMode: 'view',
    calculatorAccess: true,
    ledgerAccess: true,
    ledgerScope: 'own',
    inventoryAccess: false,
    filesAccess: false,
    settingsAccess: false
  },
  {
    role: 'partner',
    summaryAccess: true,
    summaryMode: 'default_view',
    summaryScope: 'own_customers',
    summaryActionView: 'popup_view',
    quotationAccess: true,
    quotationMode: 'full',
    documentAccess: true,
    documentMode: 'view',
    calculatorAccess: true,
    ledgerAccess: true,
    ledgerScope: 'own',
    inventoryAccess: false,
    filesAccess: false,
    settingsAccess: false
  },
  {
    role: 'user',
    summaryAccess: false,
    summaryMode: 'default_view',
    summaryScope: 'own_customers',
    summaryActionView: 'popup_view',
    quotationAccess: true,
    quotationMode: 'view',
    documentAccess: true,
    documentMode: 'view',
    calculatorAccess: true,
    ledgerAccess: false,
    ledgerScope: 'own',
    inventoryAccess: false,
    filesAccess: false,
    settingsAccess: false
  }
];

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // All Role Access Rules signal
  roleRules = signal<RoleAccessRule[]>(DEFAULT_ROLE_RULES);

  // Special User Settings signal (userid -> { isSpecialUser, allowedPartners, assignedPartner })
  specialUsers = signal<SpecialUserSettings>({});

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Current active user's rule
  currentRule = computed<RoleAccessRule>(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return DEFAULT_ROLE_RULES.find(r => r.role === 'user') || DEFAULT_ROLE_RULES[0];
    }
    const roleName = (user.role || '').toLowerCase().trim();
    
    // Check if admin or superadmin
    if (roleName === 'admin' || roleName === 'superadmin') {
      return this.roleRules().find(r => r.role.toLowerCase() === roleName) || DEFAULT_ROLE_RULES[0];
    }

    const matched = this.roleRules().find(r => r.role.toLowerCase() === roleName);
    if (matched) return matched;

    // Default fallback
    return {
      role: user.role,
      summaryAccess: false,
      summaryMode: 'default_view',
      summaryScope: 'own_customers',
      summaryActionView: 'popup_view',
      quotationAccess: true,
      quotationMode: 'full',
      documentAccess: true,
      documentMode: 'view',
      calculatorAccess: true,
      ledgerAccess: true,
      ledgerScope: 'own',
      inventoryAccess: false,
      filesAccess: false,
      settingsAccess: false
    };
  });

  // Current user's special user config
  currentUserSpecialConfig = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return null;
    const uid = (user.userid || '').toLowerCase().trim();
    return this.specialUsers()[uid] || null;
  });

  // Helper computed permissions for UI components
  isSummaryAccessible = computed(() => {
    if (this.authService.isAdmin()) return true;
    return this.currentRule().summaryAccess;
  });

  isSummaryDefaultViewOnly = computed(() => {
    if (this.authService.isAdmin()) return false;
    return this.currentRule().summaryMode === 'default_view';
  });

  isSummaryOwnOnly = computed(() => {
    if (this.authService.isAdmin()) return false;
    return this.currentRule().summaryScope === 'own_customers';
  });

  isSummaryActionPopup = computed(() => {
    if (this.authService.isAdmin()) return false;
    return this.currentRule().summaryActionView === 'popup_view';
  });

  isDocumentViewOnly = computed(() => {
    if (this.authService.isAdmin()) return false;
    return this.currentRule().documentMode === 'view';
  });

  isLedgerOwnOnly = computed(() => {
    if (this.authService.isAdmin()) return false;
    return this.currentRule().ledgerScope === 'own';
  });

  currentUserAllowedPartners = computed<string[]>(() => {
    const spec = this.currentUserSpecialConfig();
    if (spec && spec.isSpecialUser && Array.isArray(spec.allowedPartners) && spec.allowedPartners.length > 0) {
      return spec.allowedPartners;
    }
    return [];
  });

  constructor() {
    this.loadRules();
  }

  loadRules(): void {
    this.isLoading.set(true);
    this.http.get<{ Key: string; Value: string }[]>('/api/get?table=settings').pipe(
      catchError(() => of([]))
    ).subscribe(list => {
      this.isLoading.set(false);
      if (Array.isArray(list)) {
        const rulesRow = list.find(s => s.Key === 'RoleAccessRules');
        if (rulesRow && rulesRow.Value) {
          try {
            const parsed: RoleAccessRule[] = JSON.parse(rulesRow.Value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Merge with default rules for any missing roles
              const merged = [...parsed];
              DEFAULT_ROLE_RULES.forEach(def => {
                if (!merged.some(m => m.role.toLowerCase() === def.role.toLowerCase())) {
                  merged.push(def);
                }
              });
              this.roleRules.set(merged);
            }
          } catch (e) {
            console.warn('Could not parse RoleAccessRules JSON:', e);
          }
        }

        const specRow = list.find(s => s.Key === 'SpecialUserSettings');
        if (specRow && specRow.Value) {
          try {
            const parsedSpec: SpecialUserSettings = JSON.parse(specRow.Value);
            this.specialUsers.set(parsedSpec || {});
          } catch (e) {
            console.warn('Could not parse SpecialUserSettings JSON:', e);
          }
        }
      }
    });
  }

  saveRules(rules: RoleAccessRule[]): Observable<any> {
    this.isSaving.set(true);
    this.roleRules.set(rules);
    const row = {
      Key: 'RoleAccessRules',
      Value: JSON.stringify(rules)
    };
    return this.http.post('/api/save-table', {
      table: 'settings',
      rows: [row]
    }).pipe(
      tap(() => this.isSaving.set(false))
    );
  }

  saveSpecialUsers(settings: SpecialUserSettings): Observable<any> {
    this.specialUsers.set(settings);
    const row = {
      Key: 'SpecialUserSettings',
      Value: JSON.stringify(settings)
    };
    return this.http.post('/api/save-table', {
      table: 'settings',
      rows: [row]
    });
  }

  getRuleForRole(roleName: string): RoleAccessRule {
    const r = this.roleRules().find(item => item.role.toLowerCase() === roleName.toLowerCase());
    if (r) return { ...r };
    return {
      role: roleName,
      summaryAccess: false,
      summaryMode: 'default_view',
      summaryScope: 'own_customers',
      summaryActionView: 'popup_view',
      quotationAccess: true,
      quotationMode: 'full',
      documentAccess: true,
      documentMode: 'view',
      calculatorAccess: true,
      ledgerAccess: true,
      ledgerScope: 'own',
      inventoryAccess: false,
      filesAccess: false,
      settingsAccess: false
    };
  }

  updateRule(updated: RoleAccessRule): void {
    const list = this.roleRules().map(r => 
      r.role.toLowerCase() === updated.role.toLowerCase() ? updated : r
    );
    if (!list.some(r => r.role.toLowerCase() === updated.role.toLowerCase())) {
      list.push(updated);
    }
    this.roleRules.set(list);
  }
}
