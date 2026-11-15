import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type AuthView = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // View state signals
  currentView = signal<AuthView>('login');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  showPassword = signal<boolean>(false);
  showRegPassword = signal<boolean>(false);
  availableRoles = signal<string[]>(['user', 'partner', 'Employee']);

  // Login form model
  loginUserid = '';
  loginPassword = '';

  // Register form model
  regUserid = '';
  regUsername = '';
  regEmail = '';
  regMobile = '';
  regPassword = '';
  regRole = 'user';

  // Forgot password form model
  forgotEmail = '';

  private returnUrl = '/summary';

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/summary';

    // If already logged in, redirect to summary
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }

    this.loadRoles();
  }

  loadRoles(): void {
    this.authService.getRoles().subscribe({
      next: (res) => {
        if (res && res.roles && res.roles.length > 0) {
          const roles = [...res.roles];
          if (!roles.some(r => r.toLowerCase() === 'employee')) {
            roles.push('Employee');
          }
          this.availableRoles.set(roles);
          if (roles.includes('user')) {
            this.regRole = 'user';
          } else {
            this.regRole = roles[0];
          }
        }
      },
      error: () => {
        this.availableRoles.set(['user', 'partner', 'Employee']);
      }
    });
  }

  switchView(view: AuthView): void {
    this.clearAlerts();
    this.currentView.set(view);
    if (view === 'register') {
      this.loadRoles();
    }
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleRegPassword(): void {
    this.showRegPassword.update(v => !v);
  }

  clearAlerts(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  onLoginSubmit(): void {
    const userid = this.loginUserid.trim();
    const password = this.loginPassword;

    if (!userid || !password) {
      this.errorMessage.set('Please enter both User ID / Email and Password.');
      return;
    }

    this.clearAlerts();
    this.isLoading.set(true);

    this.authService.login(userid, password).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage.set(res.error || 'Invalid User ID or Password.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errDetail = err?.error?.error || err?.error?.message || 'Invalid credentials or connection issue.';
        this.errorMessage.set(errDetail);
      }
    });
  }

  onRegisterSubmit(): void {
    const userid = this.regUserid.trim().toLowerCase();
    const username = this.regUsername.trim();
    const email = this.regEmail.trim().toLowerCase();
    const password = this.regPassword;
    const role = this.regRole;
    const mobile = this.regMobile.trim();

    if (!userid || !username || !email || !password) {
      this.errorMessage.set('Please fill in all required fields.');
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(userid)) {
      this.errorMessage.set('User ID must be lowercase letters, numbers, hyphen or underscore only.');
      return;
    }

    this.clearAlerts();
    this.isLoading.set(true);

    this.authService.register({ userid, username, email, password, mobile, role }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.successMessage.set(res.message || 'Registration request sent successfully! Please wait for Admin approval.');
          this.currentView.set('login');
          // Reset form
          this.regUserid = '';
          this.regUsername = '';
          this.regEmail = '';
          this.regMobile = '';
          this.regPassword = '';
        } else {
          this.errorMessage.set(res.error || 'Registration failed.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errDetail = err?.error?.error || err?.error?.message || 'Server connection error during registration.';
        this.errorMessage.set(errDetail);
      }
    });
  }

  onForgotSubmit(): void {
    const email = this.forgotEmail.trim().toLowerCase();
    if (!email) {
      this.errorMessage.set('Please enter your registered email address.');
      return;
    }

    this.clearAlerts();
    this.isLoading.set(true);

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message || 'If your email is registered, a password reset link has been dispatched.');
        this.currentView.set('login');
        this.forgotEmail = '';
      },
      error: (err) => {
        this.isLoading.set(false);
        const errDetail = err?.error?.error || err?.error?.message || 'Failed to process password reset request.';
        this.errorMessage.set(errDetail);
      }
    });
  }
}
