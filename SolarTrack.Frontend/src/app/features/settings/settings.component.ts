import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SettingsService } from './services/settings.service';
import { NavService } from '../../core/services/nav.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { RolePermissionService, DEFAULT_ROLE_RULES } from '../../core/services/role-permission.service';
import { RoleAccessRule } from '../../core/models/role-permission.model';
import { SummaryService } from '../../core/services/summary.service';
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
  rolePermissionService = inject(RolePermissionService);
  summaryService = inject(SummaryService);

  // Active Tab: 'company' | 'users' | 'roles'
  activeTab = signal<'company' | 'users' | 'roles'>('company');

  // Role Access Rules Management
  selectedRoleName = signal<string>('Employee');
  currentRoleRule = signal<RoleAccessRule>(this.rolePermissionService.getRuleForRole('Employee'));

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
    role: 'Employee',
    status: 'Approved',
    isSpecialUser: false,
    allowedPartners: [],
    assignedPartner: ''
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
    // Ensure customer & partner data is loaded for partner assignment
    this.summaryService.loadAllData().subscribe();
  }

  setTab(tab: 'company' | 'users' | 'roles'): void {
    this.activeTab.set(tab);
    if (tab === 'roles') {
      this.currentRoleRule.set(this.rolePermissionService.getRuleForRole(this.selectedRoleName()));
    }
  }

  // --- Special User Helpers ---
  getUserSpecialConfig(userid: string) {
    return this.rolePermissionService.specialUsers()[userid?.toLowerCase().trim()] || null;
  }

  toggleAllowedPartner(partner: string): void {
    if (!this.modalUser.allowedPartners) {
      this.modalUser.allowedPartners = [];
    }
    const idx = this.modalUser.allowedPartners.indexOf(partner);
    if (idx >= 0) {
      this.modalUser.allowedPartners.splice(idx, 1);
    } else {
      this.modalUser.allowedPartners.push(partner);
    }
  }

  isPartnerAllowed(partner: string): boolean {
    return (this.modalUser.allowedPartners || []).includes(partner);
  }

  // --- Role Access Rules Actions ---
  onSelectRoleForRule(role: string): void {
    this.selectedRoleName.set(role);
    this.currentRoleRule.set(this.rolePermissionService.getRuleForRole(role));
  }

  onSaveRoleRule(): void {
    const updated = this.currentRoleRule();
    this.rolePermissionService.updateRule(updated);
    this.rolePermissionService.saveRules(this.rolePermissionService.roleRules()).subscribe({
      next: () => this.toastService.success(`Access rules for role "${updated.role}" saved successfully!`),
      error: () => this.toastService.error(`Failed to save rules for "${updated.role}".`)
    });
  }

  onResetRoleRule(): void {
    const role = this.selectedRoleName();
    const defaultRule = DEFAULT_ROLE_RULES.find(r => r.role.toLowerCase() === role.toLowerCase());
    if (defaultRule) {
      this.currentRoleRule.set({ ...defaultRule });
      this.toastService.info(`Reset rules to defaults for "${role}". Click Save to persist.`);
    } else {
      this.toastService.warning(`No predefined defaults for custom role "${role}".`);
    }
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
      role: 'Employee',
      status: 'Approved',
      isSpecialUser: false,
      allowedPartners: [],
      assignedPartner: ''
    };
    this.isUserModalOpen.set(true);
  }

  editUser(u: ManagedUser): void {
    this.isEditMode.set(true);
    const spec = this.getUserSpecialConfig(u.userid);
    this.modalUser = { 
      ...u,
      isSpecialUser: spec?.isSpecialUser || false,
      allowedPartners: spec?.allowedPartners ? [...spec.allowedPartners] : [],
      assignedPartner: spec?.assignedPartner || ''
    };
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

    // Save special user mapping into settings
    const specs = { ...this.rolePermissionService.specialUsers() };
    const uid = this.modalUser.userid.toLowerCase().trim();
    if (this.modalUser.isSpecialUser || (this.modalUser.allowedPartners && this.modalUser.allowedPartners.length > 0) || this.modalUser.assignedPartner) {
      specs[uid] = {
        isSpecialUser: this.modalUser.isSpecialUser || false,
        allowedPartners: this.modalUser.allowedPartners || [],
        assignedPartner: this.modalUser.assignedPartner || ''
      };
    } else {
      delete specs[uid];
    }
    this.rolePermissionService.saveSpecialUsers(specs).subscribe();

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
