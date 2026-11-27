import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { NavService, NavItem } from '../../../core/services/nav.service';
import { AuthService } from '../../../core/services/auth.service';
import { RolePermissionService } from '../../../core/services/role-permission.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  host: {
    '[class.collapsed]': '!navService.isSidebarOpen()',
    '[class.open]': 'navService.isSidebarOpen()'
  }
})
export class SidebarComponent {
  navService = inject(NavService);
  authService = inject(AuthService);
  rolePermissionService = inject(RolePermissionService);

  visibleNavItems = computed(() => {
    if (this.authService.isAdmin()) return this.navService.navItems;
    const rule = this.rolePermissionService.currentRule();

    return this.navService.navItems.filter(item => {
      if (item.path === '/cost-analysis') return false; // Strictly Admin only (Admin checked above on line 22)
      if (item.path === '/summary') return rule.summaryAccess;
      if (item.path === '/quotation') return rule.quotationAccess;
      if (item.path === '/document') return rule.documentAccess;
      if (item.path === '/sizing-calculation' || item.path === '/sizing-calc' || item.path === '/sld') return rule.calculatorAccess;
      if (item.path === '/ledger') return rule.ledgerAccess;
      if (item.path === '/inventory') return rule.inventoryAccess;
      if (item.path === '/files') return rule.filesAccess;
      if (item.path === '/settings') return rule.settingsAccess;
      return true;
    });
  });

  onLinkClick(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.navService.closeSidebar();
    }
  }

  onLogout(): void {
    this.authService.logout();
  }
}
