import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SettingsService } from './services/settings.service';
import { NavService } from '../../core/services/nav.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { ManagedUser } from './models/settings.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  settingsService = inject(SettingsService);
  navService = inject(NavService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);

  // Active Tab: 'company' | 'users'
  activeTab = signal<'company' | 'users'>('company');

  // User Filter & Search
  userSearch = signal<string>('');
  selectedRoleFilter = signal<string>('ALL');

  // New Role input
  newRoleName = '';

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

  // Filtered Users computed signal
  filteredUsers = computed(() => {
    const term = this.userSearch().toLowerCase().trim();
    const roleFilter = this.selectedRoleFilter();
    return this.settingsService.users().filter(u => {
      const matchesSearch = !term ||
        u.userid?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        (u.mobile && u.mobile.toLowerCase().includes(term));
      const matchesRole = roleFilter === 'ALL' || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());
      return matchesSearch && matchesRole;
    });
  });

  ngOnInit(): void {
    this.navService.setPageTitle('Settings & Configuration');
    this.settingsService.loadAll().subscribe({
      next: () => {},
      error: () => this.toastService.error('Failed to load settings.')
    });
  }

  setTab(tab: 'company' | 'users'): void {
    this.activeTab.set(tab);
  }

  // Office Addresses - open for edit
  onAddAddressRow(): void {
    const current = this.settingsService.settings();
    this.settingsService.settings.set({
      ...current,
      addresses: [...current.addresses, '']
    });
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

  // Government Subsidy - open for edit
  onAddSubsidyRow(): void {
    const current = this.settingsService.settings();
    const maxKw = current.subsidies.length > 0 ? Math.max(...current.subsidies.map(s => Number(s.kw) || 0)) + 1 : 1;
    this.settingsService.settings.set({
      ...current,
      subsidies: [...current.subsidies, { kw: maxKw, state: 0, central: 0 }]
    });
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

  // User RBAC Actions
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

  // Role Management Actions
  getUserCountForRole(role: string): number {
    return this.settingsService.users().filter(u => u.role?.toLowerCase() === role?.toLowerCase()).length;
  }

  onAddRole(): void {
    const name = this.newRoleName.trim();
    if (!name) return;
    if (this.settingsService.roles().some(r => r.toLowerCase() === name.toLowerCase())) {
      this.toastService.warning(`Role "${name}" already exists.`);
      return;
    }
    this.settingsService.addRole(name);
    this.toastService.success(`Role "${name}" added.`);
    this.newRoleName = '';
  }

  async onRemoveRole(role: string): Promise<void> {
    const reserved = ['admin', 'superadmin', 'user'];
    if (reserved.includes(role.toLowerCase())) {
      this.toastService.warning(`Role "${role}" is a system role and cannot be deleted.`);
      return;
    }
    const count = this.getUserCountForRole(role);
    if (count > 0) {
      this.toastService.warning(`Cannot delete role "${role}" because ${count} user(s) are assigned to it.`);
      return;
    }
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Custom Role',
      message: `Are you sure you want to remove role "${role}"?`,
      confirmText: 'Delete Role',
      isDanger: true
    });
    if (confirmed) {
      this.settingsService.deleteRole(role);
      this.toastService.success(`Role "${role}" removed.`);
    }
  }

  // Company Profile Settings Final Submit
  onSaveAllSettings(): void {
    const current = this.settingsService.settings();
    const cleanedAddresses = current.addresses
      .map(a => a?.trim())
      .filter(a => !!a);
    const cleanedSubsidies = current.subsidies
      .filter(s => s && Number(s.kw) > 0);

    this.settingsService.settings.set({
      ...current,
      addresses: cleanedAddresses,
      subsidies: cleanedSubsidies
    });

    this.settingsService.saveSettings().subscribe({
      next: () => this.toastService.success('Company profile & settings saved successfully!'),
      error: () => this.toastService.error('Failed to save settings to database.')
    });
  }
}
