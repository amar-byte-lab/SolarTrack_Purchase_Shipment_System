import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

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
  private router = inject(Router);

  isSidebarOpen = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
  isMobileSidebarOpen = signal<boolean>(false);
  pageTitle = signal<string>('Solar Track ERP');

  readonly navItems: NavItem[] = [
    { path: '/summary', label: 'Summary', icon: 'summary' },
    { path: '/cost-analysis', label: 'Cost Analysis', icon: 'table', roles: ['admin', 'superadmin'] },
    { path: '/inventory', label: 'Inventory', icon: 'boxes' },
    { path: '/files', label: 'Upload File', icon: 'file' },
    { path: '/quotation', label: 'Quotation', icon: 'offer' },
    { path: '/document', label: 'Document', icon: 'agreement' },
    { path: '/sizing-calculation', label: 'Sizing Calculation', icon: 'calculator' },
    { path: '/sizing-calc', label: 'Calculator', icon: 'calculator' },
    { path: '/ledger', label: 'Ledger', icon: 'wallet' },
    { path: '/settings', label: 'Settings', icon: 'gear' }
  ];

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTitleFromUrl(event.urlAfterRedirects || event.url);
    });

    // Check initial location pathname if available
    if (typeof window !== 'undefined' && window.location && window.location.pathname) {
      this.updateTitleFromUrl(window.location.pathname);
    }
  }

  updateTitleFromUrl(url: string): void {
    if (!url) return;
    const path = url.split('?')[0].split('#')[0];
    if (path.startsWith('/summary')) {
      this.pageTitle.set('Summary');
    } else if (path.startsWith('/cost-analysis') || path.startsWith('/customer-cost')) {
      this.pageTitle.set('Cost Analysis');
    } else if (path.startsWith('/inventory')) {
      this.pageTitle.set('Inventory');
    } else if (path.startsWith('/files')) {
      this.pageTitle.set('Upload File');
    } else if (path.startsWith('/quotation')) {
      this.pageTitle.set('Quotation');
    } else if (path.startsWith('/document') || path.startsWith('/agreement')) {
      this.pageTitle.set('Document');
    } else if (path.startsWith('/sizing-calculation')) {
      this.pageTitle.set('Sizing Calculation');
    } else if (path.startsWith('/sizing-calc') || path.startsWith('/calculator')) {
      this.pageTitle.set('Calculator');
    } else if (path.startsWith('/ledger')) {
      this.pageTitle.set('Ledger');
    } else if (path.startsWith('/reports')) {
      this.pageTitle.set('Reports & Analytics');
    } else if (path.startsWith('/settings')) {
      this.pageTitle.set('Settings');
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
    this.isMobileSidebarOpen.set(this.isSidebarOpen());
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
    this.isMobileSidebarOpen.set(false);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
    this.isMobileSidebarOpen.set(true);
  }

  toggleMobileSidebar(): void {
    this.toggleSidebar();
  }

  closeMobileSidebar(): void {
    this.closeSidebar();
  }

  setPageTitle(title: string): void {
    this.pageTitle.set(title);
  }
}

