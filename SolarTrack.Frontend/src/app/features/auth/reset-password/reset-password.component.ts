import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  token = signal<string>('');
  hasValidToken = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isCompleted = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  newPassword = '';
  confirmPassword = '';

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParams['token'];
    if (tokenParam && tokenParam.trim()) {
      this.token.set(tokenParam.trim());
      this.hasValidToken.set(true);
    } else {
      this.hasValidToken.set(false);
      this.errorMessage.set('Invalid password reset request. Missing or invalid reset token.');
    }
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  onResetSubmit(): void {
    const password = this.newPassword;
    const confirm = this.confirmPassword;
    const token = this.token();

    if (!token) {
      this.errorMessage.set('Missing reset token.');
      return;
    }

    if (!password || !confirm) {
      this.errorMessage.set('Please fill in both password fields.');
      return;
    }

    if (password !== confirm) {
      this.errorMessage.set('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 4) {
      this.errorMessage.set('Password must be at least 4 characters long.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    this.authService.resetPassword({ token, password }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.isCompleted.set(true);
          this.successMessage.set(res.message || 'Password has been reset successfully! Redirecting to login...');
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2500);
        } else {
          this.errorMessage.set(res.error || 'Failed to reset password.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errDetail = err?.error?.error || err?.error?.message || 'Server connection error.';
        this.errorMessage.set(errDetail);
      }
    });
  }
}
