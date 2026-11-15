import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from './services/settings.service';
import { NavService } from '../../core/services/nav.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { ManagedUser } from './models/settings.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  settingsService = inject(SettingsService);
  navService = inject(NavService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);

  // Address inputs
  newAddressText = '';

  // Subsidy inputs
  newSubsidyKw = 3;
  newSubsidyState = 60000;
  newSubsidyCentral = 78000;

  // User Modal
  isUserModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  modalUser: ManagedUser = {
    userid: '',
    username: '',
    email: '',
    mobile: '',
    password: '',
    role: 'user',
    status: 'Approved'
  };

  ngOnInit(): void {
    this.navService.setPageTitle('Settings & Configuration');
    this.settingsService.loadAll().subscribe({
      next: () => {},
      error: () => this.toastService.error('Failed to load settings.')
    });
  }

  onAddAddress(): void {
    const text = this.newAddressText.trim();
    if (!text) return;
    const current = this.settingsService.settings();
    this.settingsService.settings.set({
      ...current,
      addresses: [...current.addresses, text]
    });
    this.toastService.success('Address added to profile list.');
    this.newAddressText = '';
  }

  onRemoveAddress(index: number): void {
    const current = this.settingsService.settings();
    const updated = [...current.addresses];
    updated.splice(index, 1);
    this.settingsService.settings.set({
      ...current,
      addresses: updated
    });
  }

  onAddSubsidy(): void {
    if (this.newSubsidyKw <= 0) return;
    const current = this.settingsService.settings();
    this.settingsService.settings.set({
      ...current,
      subsidies: [
        ...current.subsidies.filter(s => s.kw !== this.newSubsidyKw),
        { kw: this.newSubsidyKw, state: this.newSubsidyState, central: this.newSubsidyCentral }
      ]
    });
    this.toastService.success(`Subsidy for ${this.newSubsidyKw} kW updated.`);
  }

  onRemoveSubsidy(index: number): void {
    const current = this.settingsService.settings();
    const updated = [...current.subsidies];
    updated.splice(index, 1);
    this.settingsService.settings.set({
      ...current,
      subsidies: updated
    });
  }

  openUserModal(): void {
    this.isEditMode.set(false);
    this.modalUser = {
      userid: '',
      username: '',
      email: '',
      mobile: '',
      password: '',
      role: this.settingsService.roles()[0] || 'user',
      status: 'Approved'
    };
    this.isUserModalOpen.set(true);
  }

  editUser(u: ManagedUser): void {
    this.isEditMode.set(true);
    this.modalUser = { ...u };
    this.isUserModalOpen.set(true);
  }

  onSaveUserModal(): void {
    if (!this.modalUser.userid || !this.modalUser.username || !this.modalUser.email) {
      this.toastService.warning('Please fill in User ID, Name, and Email.');
      return;
    }
    if (this.isEditMode()) {
      this.settingsService.updateUser(this.modalUser.userid, this.modalUser);
      this.toastService.success(`User "${this.modalUser.username}" updated.`);
    } else {
      this.settingsService.addUser(this.modalUser);
      this.toastService.success(`User "${this.modalUser.username}" added.`);
    }
    this.isUserModalOpen.set(false);
  }

  async onDeleteUser(userid: string): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Remove User Account',
      message: `Are you sure you want to delete user "${userid}"? This action cannot be undone.`,
      confirmText: 'Delete User',
      isDanger: true
    });

    if (confirmed) {
      this.settingsService.deleteUser(userid);
      this.toastService.success(`User "${userid}" deleted.`);
    }
  }

  onSaveAllSettings(): void {
    this.settingsService.saveSettings().subscribe({
      next: () => this.toastService.success('Company profile & settings saved successfully!'),
      error: () => this.toastService.error('Failed to save settings to database.')
    });
  }
}
