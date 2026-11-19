import { Injectable, signal } from '@angular/core';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[]; // If undefined, accessible to all authorized roles
}

@Injectable({
  providedIn: 'root'
})
export class NavService {
  isMobileSidebarOpen = signal<boolean>(false);
  pageTitle = signal<string>('Solar Track ERP');

  readonly navItems: NavItem[] = [
    { path: '/summary', label: 'Summary', icon: 'summary' },
    { path: '/inventory', label: 'Inventory', icon: 'boxes', roles: ['admin', 'superadmin'] },
    { path: '/files', label: 'Files', icon: 'file', roles: ['admin', 'superadmin'] },
    { path: '/quotation', label: 'Quotation', icon: 'offer' },
    { path: '/document', label: 'Document', icon: 'agreement' },
    { path: '/sizing-calc', label: 'Calculator', icon: 'calculator' },
    { path: '/ledger', label: 'Ledger', icon: 'wallet', roles: ['admin', 'superadmin', 'partner', 'associates'] },
    { path: '/settings', label: 'Settings', icon: 'gear', roles: ['admin', 'superadmin'] }
  ];

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  setPageTitle(title: string): void {
    this.pageTitle.set(title);
  }
}
