import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavService, NavItem } from '../../../core/services/nav.service';
import { AuthService } from '../../../core/services/auth.service';
import { RolePermissionService } from '../../../core/services/role-permission.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  navService = inject(NavService);
  authService = inject(AuthService);
  rolePermissionService = inject(RolePermissionService);

  visibleNavItems = computed(() => {
    if (this.authService.isAdmin()) return this.navService.navItems;
    const rule = this.rolePermissionService.currentRule();

    return this.navService.navItems.filter(item => {
      if (item.path === '/summary') return rule.summaryAccess;
      if (item.path === '/quotation') return rule.quotationAccess;
      if (item.path === '/document') return rule.documentAccess;
      if (item.path === '/sizing-calc' || item.path === '/sld') return rule.calculatorAccess;
      if (item.path === '/ledger') return rule.ledgerAccess;
      if (item.path === '/inventory') return rule.inventoryAccess;
      if (item.path === '/files') return rule.filesAccess;
      if (item.path === '/settings') return rule.settingsAccess;
      return true;
    });
  });

  onLinkClick(): void {
    if (window.innerWidth <= 900) {
      this.navService.closeMobileSidebar();
    }
  }

  onLogout(): void {
    this.authService.logout();
  }
}
