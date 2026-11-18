import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from './services/inventory.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import {
  InventoryItem,
  InventoryItemWithStock,
  GroupedInwardConsignment,
  GroupedDispatchConsignment,
  StockStatusType
} from './models/inventory.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ItemModalComponent } from './components/item-modal/item-modal.component';
import { CategoryModalComponent } from './components/category-modal/category-modal.component';
import { StockInModalComponent } from './components/stock-in-modal/stock-in-modal.component';
import { SiteDispatchModalComponent } from './components/site-dispatch-modal/site-dispatch-modal.component';
import { InventorySummaryModalComponent } from './components/inventory-summary-modal/inventory-summary-modal.component';
import { InventorySummaryComponent } from './components/inventory-summary/inventory-summary.component';
import { PriceHistoryModalComponent } from './components/price-history-modal/price-history-modal.component';

type ActiveTab = 'ledger' | 'dispatches' | 'inwards' | 'summary';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ItemModalComponent,
    CategoryModalComponent,
    StockInModalComponent,
    SiteDispatchModalComponent,
    InventorySummaryModalComponent,
    InventorySummaryComponent,
    PriceHistoryModalComponent
  ],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  protected readonly invService = inject(InventoryService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);

  // Active Tab
  activeTab = signal<ActiveTab>('ledger');

  // Search & Filters
  searchTerm = signal('');
  selectedStatus = signal<StockStatusType | 'all'>('all');
  selectedCategory = signal<string>('all');

  // Selected Item Codes for bulk delete
  selectedCodes = signal<Set<string>>(new Set<string>());

  // Collapsed categories state in ledger
  collapsedCategories = signal<Set<string>>(new Set<string>());

  // Expanded consignments state (dispatch/inward)
  expandedConsignments = signal<Set<string>>(new Set<string>());

  // Modal Visibility Signals
  showItemModal = signal(false);
  itemToEdit = signal<InventoryItem | null>(null);

  showCategoryModal = signal(false);
  showStockInModal = signal(false);
  showDispatchModal = signal(false);
  showSummaryModal = signal(false);

  showPriceHistoryModal = signal(false);
  priceHistoryItem = signal<InventoryItemWithStock | null>(null);

  // Selected items for specific Stock In or Stock Out
  selectedItemForStockIn = signal<string | undefined>(undefined);
  selectedItemForStockOut = signal<string | undefined>(undefined);
  selectedItemCodesForStockIn = signal<string[]>([]);
  selectedItemCodesForStockOut = signal<string[]>([]);

  // Active Document Dropdown Popover Key in table
  openDocMenuKey = signal<string | null>(null);

  // Filtered Items with Stock
  filteredItems = computed(() => {
    let items = this.invService.itemsWithStock();
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();
    const cat = this.selectedCategory();

    if (cat !== 'all') {
      items = items.filter(it => (it.Category || '').toLowerCase() === cat.toLowerCase());
    }

    if (status !== 'all') {
      items = items.filter(it => it.status === status);
    }

    if (query) {
      items = items.filter(it =>
        (it.ItemCode || '').toLowerCase().includes(query) ||
        (it.ItemName || '').toLowerCase().includes(query) ||
        (it.Category || '').toLowerCase().includes(query) ||
        (it.Description || '').toLowerCase().includes(query) ||
        (it.Location || '').toLowerCase().includes(query)
      );
    }

    return items;
  });

  // Group filtered items by category for Tree view
  categorizedItems = computed(() => {
    const items = this.filteredItems();
    const groups = new Map<string, InventoryItemWithStock[]>();

    for (const item of items) {
      const cat = item.Category || 'General';
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat)!.push(item);
    }

    return Array.from(groups.entries()).map(([category, itemsList]) => {
      const totalValuation = itemsList.reduce((sum, it) => sum + it.totalStockValuation, 0);
      const totalUnits = itemsList.reduce((sum, it) => sum + it.inHandQty, 0);
      return {
        category,
        items: itemsList,
        totalValuation,
        totalUnits
      };
    });
  });

  // Filtered Dispatches
  filteredDispatches = computed(() => {
    let list = this.invService.groupedDispatches();
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return list;

    return list.filter(g =>
      (g.siteName || '').toLowerCase().includes(query) ||
      (g.vehicle || '').toLowerCase().includes(query) ||
      (g.remarks || '').toLowerCase().includes(query) ||
      g.items.some(i => (i.itemName || '').toLowerCase().includes(query) || (i.itemCode || '').toLowerCase().includes(query)) ||
      g.customerAllocations.some(c => (c.customerName || '').toLowerCase().includes(query))
    );
  });

  // Filtered Inwards
  filteredInwards = computed(() => {
    let list = this.invService.groupedInwards();
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return list;

    return list.filter(g =>
      (g.supplier || '').toLowerCase().includes(query) ||
      (g.location || '').toLowerCase().includes(query) ||
      (g.remarks || '').toLowerCase().includes(query) ||
      g.items.some(i => (i.itemName || '').toLowerCase().includes(query) || (i.itemCode || '').toLowerCase().includes(query))
    );
  });

  ngOnInit(): void {
    this.invService.loadAllData().subscribe();
  }

  // --- Tab & Filter Actions ---
  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  setStatus(status: StockStatusType | 'all'): void {
    this.selectedStatus.set(status);
  }

  setCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  // --- Category Collapsing ---
  toggleCategoryCollapse(cat: string): void {
    this.collapsedCategories.update(set => {
      const next = new Set(set);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  isCategoryCollapsed(cat: string): boolean {
    return this.collapsedCategories().has(cat);
  }

  // --- Consignment Accordion ---
  toggleConsignment(key: string): void {
    this.expandedConsignments.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isConsignmentExpanded(key: string): boolean {
    return this.expandedConsignments().has(key);
  }

  // --- Item Selection ---
  toggleSelectItem(code: string): void {
    this.selectedCodes.update(set => {
      const next = new Set(set);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  isItemSelected(code: string): boolean {
    return this.selectedCodes().has(code);
  }

  isCategoryAllSelected(grp: { category: string; items: InventoryItemWithStock[] }): boolean {
    if (!grp.items || grp.items.length === 0) return false;
    return grp.items.every(it => this.selectedCodes().has(it.ItemCode));
  }

  isCategoryPartiallySelected(grp: { category: string; items: InventoryItemWithStock[] }): boolean {
    if (!grp.items || grp.items.length === 0) return false;
    const selectedCount = grp.items.filter(it => this.selectedCodes().has(it.ItemCode)).length;
    return selectedCount > 0 && selectedCount < grp.items.length;
  }

  toggleSelectCategory(grp: { category: string; items: InventoryItemWithStock[] }): void {
    const allSelected = this.isCategoryAllSelected(grp);
    this.selectedCodes.update(prev => {
      const next = new Set(prev);
      if (allSelected) {
        grp.items.forEach(it => next.delete(it.ItemCode));
      } else {
        grp.items.forEach(it => next.add(it.ItemCode));
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    const current = this.selectedCodes();
    const all = this.filteredItems();
    if (current.size === all.length && all.length > 0) {
      this.selectedCodes.set(new Set<string>());
    } else {
      this.selectedCodes.set(new Set<string>(all.map(it => it.ItemCode)));
    }
  }

  clearSelection(): void {
    this.selectedCodes.set(new Set<string>());
  }

  // --- Item CRUD Actions ---
  defaultCategoryForItem = signal<string>('Panels');

  // Inline Category Add State in Tree
  isAddingCategory = signal(false);
  newCategoryInput = signal('');

  // Inline Category Rename State in Tree
  editingCategoryName = signal<string | null>(null);
  editingCategoryInput = signal('');

  startAddCategory(): void {
    this.isAddingCategory.set(true);
    this.newCategoryInput.set('');
  }

  saveNewCategory(): void {
    const name = this.newCategoryInput().trim();
    if (!name) {
      this.isAddingCategory.set(false);
      return;
    }
    const success = this.invService.addCategory(name);
    if (success) {
      this.toastService.success(`Category "${name}" created successfully.`);
      this.isAddingCategory.set(false);
      this.newCategoryInput.set('');
    } else {
      this.toastService.warning(`Category "${name}" already exists or is invalid.`);
    }
  }

  cancelAddCategory(): void {
    this.isAddingCategory.set(false);
    this.newCategoryInput.set('');
  }

  startEditCategory(cat: string): void {
    this.editingCategoryName.set(cat);
    this.editingCategoryInput.set(cat);
  }

  saveEditCategory(oldName: string): void {
    const newName = this.editingCategoryInput().trim();
    if (!newName || newName.toLowerCase() === oldName.toLowerCase()) {
      this.editingCategoryName.set(null);
      return;
    }
    const success = this.invService.renameCategory(oldName, newName);
    if (success) {
      this.toastService.success(`Category renamed to "${newName}".`);
      this.editingCategoryName.set(null);
    } else {
      this.toastService.warning(`Cannot rename category. Name already exists.`);
    }
  }

  cancelEditCategory(): void {
    this.editingCategoryName.set(null);
  }

  async deleteCategory(cat: string): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${cat}"? Items under this category will be moved to "Others".`,
      confirmText: 'Delete',
      isDanger: true
    });
    if (!confirmed) return;

    this.invService.deleteCategory(cat);
    this.toastService.success(`Category "${cat}" deleted.`);
  }

  openAddItem(category?: string): void {
    this.itemToEdit.set(null);
    if (category) {
      this.defaultCategoryForItem.set(category);
    } else {
      this.defaultCategoryForItem.set('Panels');
    }
    this.showItemModal.set(true);
  }

  openEditItem(item: InventoryItem): void {
    this.itemToEdit.set(item);
    this.showItemModal.set(true);
  }

  onItemSaved(): void {
    this.showItemModal.set(false);
    this.itemToEdit.set(null);
    this.invService.loadAllData().subscribe();
  }

  openStockIn(itemCode?: string): void {
    if (itemCode) {
      this.selectedItemCodesForStockIn.set([itemCode]);
      this.selectedItemForStockIn.set(itemCode);
    } else if (this.selectedCodes().size > 0) {
      const codes = Array.from(this.selectedCodes());
      this.selectedItemCodesForStockIn.set(codes);
      this.selectedItemForStockIn.set(codes[0]);
    } else {
      this.selectedItemCodesForStockIn.set([]);
      this.selectedItemForStockIn.set(undefined);
    }
    this.showStockInModal.set(true);
  }

  openStockOut(itemCode?: string): void {
    if (itemCode) {
      this.selectedItemCodesForStockOut.set([itemCode]);
      this.selectedItemForStockOut.set(itemCode);
    } else if (this.selectedCodes().size > 0) {
      const codes = Array.from(this.selectedCodes());
      this.selectedItemCodesForStockOut.set(codes);
      this.selectedItemForStockOut.set(codes[0]);
    } else {
      this.selectedItemCodesForStockOut.set([]);
      this.selectedItemForStockOut.set(undefined);
    }
    this.showDispatchModal.set(true);
  }

  onStockInSaved(): void {
    this.showStockInModal.set(false);
    this.selectedItemForStockIn.set(undefined);
    this.selectedItemCodesForStockIn.set([]);
    this.selectedCodes.set(new Set());
    // Switch to Inwards tab so user immediately sees newly saved stock in and documents!
    this.activeTab.set('inwards');
    this.invService.loadAllData().subscribe();
  }

  onDispatchSaved(): void {
    this.showDispatchModal.set(false);
    this.selectedItemForStockOut.set(undefined);
    this.selectedItemCodesForStockOut.set([]);
    this.selectedCodes.set(new Set());
    // Switch to Dispatches tab so user immediately sees newly saved dispatch!
    this.activeTab.set('dispatches');
    this.invService.loadAllData().subscribe();
  }

  toggleDocMenu(key: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openDocMenuKey() === key) {
      this.openDocMenuKey.set(null);
    } else {
      this.openDocMenuKey.set(key);
    }
  }

  closeDocMenu(): void {
    this.openDocMenuKey.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openDocMenuKey()) {
      this.closeDocMenu();
    }
  }

  async deleteItem(item: InventoryItem): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete SKU "${item.ItemCode}" (${item.ItemName})?`,
      confirmText: 'Delete',
      isDanger: true
    });
    if (!confirmed) return;

    this.invService.deleteItem(item.ItemCode).subscribe({
      next: () => {
        this.toastService.success(`Item "${item.ItemName}" deleted successfully.`);
      },
      error: (err) => {
        this.toastService.error('Failed to delete item: ' + (err.message || 'Server error'));
      }
    });
  }

  async deleteSelected(): Promise<void> {
    const codes = Array.from(this.selectedCodes());
    if (codes.length === 0) return;

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Selected Items',
      message: `Delete ${codes.length} selected inventory items? This cannot be undone.`,
      confirmText: 'Delete All',
      isDanger: true
    });
    if (!confirmed) return;

    this.invService.deleteItemsBatch(codes).subscribe({
      next: () => {
        this.toastService.success(`${codes.length} items deleted successfully.`);
        this.clearSelection();
      },
      error: (err) => {
        this.toastService.error('Failed to delete selected items: ' + (err.message || 'Server error'));
      }
    });
  }

  // --- Consignment Deletion ---
  async deleteDispatchConsignment(consignment: GroupedDispatchConsignment): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Dispatch Consignment',
      message: `Delete dispatch consignment for "${consignment.siteName}" on ${consignment.date}? All items will be restored to warehouse stock.`,
      confirmText: 'Delete Consignment',
      isDanger: true
    });
    if (!confirmed) return;

    this.invService.deleteDispatchConsignment(consignment.dispatchIds).subscribe({
      next: () => {
        this.toastService.success(`Dispatch consignment deleted and stock restored.`);
      },
      error: (err) => {
        this.toastService.error('Failed to delete dispatch consignment: ' + (err.message || 'Server error'));
      }
    });
  }

  async deleteInwardConsignment(consignment: GroupedInwardConsignment): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Delete Inward Consignment',
      message: `Delete inward consignment from "${consignment.supplier}" on ${consignment.date}? Inward quantities will be deducted from warehouse stock.`,
      confirmText: 'Delete Consignment',
      isDanger: true
    });
    if (!confirmed) return;

    this.invService.deleteInwardConsignment(consignment.inwardIds).subscribe({
      next: () => {
        this.toastService.success(`Inward consignment deleted and stock adjusted.`);
      },
      error: (err) => {
        this.toastService.error('Failed to delete inward consignment: ' + (err.message || 'Server error'));
      }
    });
  }

  // --- Price History ---
  openPriceHistory(item: InventoryItemWithStock): void {
    this.priceHistoryItem.set(item);
    this.showPriceHistoryModal.set(true);
  }

  // Document Viewer / Download Helper
  openDocument(doc: { name: string; data?: string }): void {
    if (!doc.data) {
      this.toastService.info(`Document "${doc.name}" has no preview data.`);
      return;
    }
    const win = window.open();
    if (win) {
      if (doc.data.startsWith('data:image/') || doc.data.startsWith('data:application/pdf')) {
        win.document.write(
          `<html><head><title>${doc.name}</title></head><body style="margin:0;background:#1e1e1e;display:flex;align-items:center;justify-content:center;"><iframe src="${doc.data}" style="border:none;width:100%;height:100vh;"></iframe></body></html>`
        );
      } else {
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        link.click();
      }
    }
  }

  // Formatting helpers
  formatDate(d: string): string {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
  }
}
