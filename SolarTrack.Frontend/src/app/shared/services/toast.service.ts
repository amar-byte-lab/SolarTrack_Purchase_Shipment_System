import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);

  show(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success', duration = 3200): void {
    const id = 'toast_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast: ToastMessage = { id, message, type, duration };
    this.toasts.set([...this.toasts(), newToast]);

    setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  success(msg: string): void {
    this.show(msg, 'success');
  }

  error(msg: string): void {
    this.show(msg, 'danger');
  }

  warning(msg: string): void {
    this.show(msg, 'warning');
  }

  info(msg: string): void {
    this.show(msg, 'info');
  }

  remove(id: string): void {
    this.toasts.set(this.toasts().filter(t => t.id !== id));
  }
}
