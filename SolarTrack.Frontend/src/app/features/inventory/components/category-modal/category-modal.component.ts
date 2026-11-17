import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './category-modal.component.html',
  styleUrls: ['./category-modal.component.scss']
})
export class CategoryModalComponent {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  newCategoryName = '';
  editingCategory: string | null = null;
  renamedCategoryValue = '';

  get categories(): string[] {
    return this.inventoryService.categories();
  }

  onClose(): void {
    this.editingCategory = null;
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) {
      this.toastService.warning('Please enter a category name.');
      return;
    }

    const success = this.inventoryService.addCategory(name);
    if (success) {
      this.toastService.success(`Category "${name}" added.`);
      this.newCategoryName = '';
    } else {
      this.toastService.warning(`Category "${name}" already exists.`);
    }
  }

  startRename(cat: string): void {
    this.editingCategory = cat;
    this.renamedCategoryValue = cat;
  }

  cancelRename(): void {
    this.editingCategory = null;
    this.renamedCategoryValue = '';
  }

  saveRename(oldName: string): void {
    const newName = this.renamedCategoryValue.trim();
    if (!newName) {
      this.toastService.warning('Category name cannot be empty.');
      return;
    }

    const success = this.inventoryService.renameCategory(oldName, newName);
    if (success) {
      this.toastService.success(`Category renamed to "${newName}".`);
      this.editingCategory = null;
    } else {
      this.toastService.warning(`Category "${newName}" already exists or invalid.`);
    }
  }

  deleteCategory(cat: string): void {
    this.confirmDialogService.confirm({
      title: 'Delete Category',
      message: `Delete category "${cat}"? Any existing items under this category will be moved to "Others".`,
      confirmText: 'Delete Category',
      isDanger: true
    }).then(confirmed => {
      if (confirmed) {
        this.inventoryService.deleteCategory(cat);
        this.toastService.info(`Category "${cat}" removed.`);
      }
    });
  }
}
