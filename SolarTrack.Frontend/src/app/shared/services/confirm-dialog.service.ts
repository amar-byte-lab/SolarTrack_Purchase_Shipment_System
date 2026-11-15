import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  isOpen = signal<boolean>(false);
  title = signal<string>('Please Confirm');
  message = signal<string>('');
  confirmText = signal<string>('Confirm');
  cancelText = signal<string>('Cancel');
  isDanger = signal<boolean>(false);

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.title.set(options.title || 'Please Confirm');
    this.message.set(options.message);
    this.confirmText.set(options.confirmText || 'Confirm');
    this.cancelText.set(options.cancelText || 'Cancel');
    this.isDanger.set(options.isDanger ?? false);
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  handleConfirm(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(true);
      this.resolver = null;
    }
  }

  handleCancel(): void {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
  }
}
