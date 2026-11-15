import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavService } from '../../../core/services/nav.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {
  navService = inject(NavService);
  authService = inject(AuthService);

  onLogout(): void {
    this.authService.logout();
  }
}
