import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User, AuthResponse, RegisterRequest, ResetPasswordRequest, RolesResponse } from '../models/user.model';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USER_KEY = 'st_user';
  private readonly LEGACY_KEY = 'solar_auth_user';

  private currentUserSignal = signal<User | null>(this.loadInitialUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly isAdmin = computed(() => {
    const r = this.currentUserSignal()?.role?.toLowerCase();
    return r === 'admin' || r === 'superadmin';
  });

  constructor(private http: HttpClient, private router: Router) {}

  private loadInitialUser(): User | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY) || 
                     localStorage.getItem(this.LEGACY_KEY) || 
                     sessionStorage.getItem(this.USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading stored user session:', e);
    }
    return null;
  }

  login(userid: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/login', { userid, password }).pipe(
      tap(res => {
        if (res.success && res.user) {
          this.currentUserSignal.set(res.user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          localStorage.setItem(this.LEGACY_KEY, JSON.stringify(res.user));
        }
      })
    );
  }

  register(payload: RegisterRequest): Observable<{ success: boolean; message?: string; error?: string }> {
    return this.http.post<{ success: boolean; message?: string; error?: string }>('/api/register', payload);
  }

  forgotPassword(email: string): Observable<{ success: boolean; message?: string; error?: string }> {
    return this.http.post<{ success: boolean; message?: string; error?: string }>('/api/forgot-password', { email });
  }

  resetPassword(payload: ResetPasswordRequest): Observable<{ success: boolean; message?: string; error?: string }> {
    return this.http.post<{ success: boolean; message?: string; error?: string }>('/api/reset-password', payload);
  }

  getRoles(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>('/api/roles');
  }

  logout(): void {
    this.currentUserSignal.set(null);
    try {
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.LEGACY_KEY);
      sessionStorage.removeItem(this.USER_KEY);
    } catch {}

    this.http.post('/api/logout', {}).subscribe({
      next: () => {},
      error: () => {}
    });

    this.router.navigate(['/login']);
  }
}
