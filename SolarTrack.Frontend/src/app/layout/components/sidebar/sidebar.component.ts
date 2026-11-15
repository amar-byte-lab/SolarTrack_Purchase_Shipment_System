import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavService, NavItem } from '../../../core/services/nav.service';
import { AuthService } from '../../../core/services/auth.service';

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

  visibleNavItems = computed(() => {
    const user = this.authService.currentUser();
    const role = (user?.role || '').toLowerCase().trim();
    const isPowerUser = role === 'admin' || role === 'superadmin';
    const isEmployee = role === 'employee';

    return this.navService.navItems.filter(item => {
      if (isPowerUser) return true;
      if (isEmployee) {
        return ['/quotation', '/document', '/sizing-calc', '/sld'].includes(item.path);
      }
      if (item.roles && !item.roles.includes(role)) {
        return false;
      }
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
