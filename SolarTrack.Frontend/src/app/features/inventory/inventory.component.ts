import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { PriceHistoryModalComponent } from './components/price-history-modal/price-history-modal.component';

type ActiveTab = 'ledger' | 'dispatches' | 'inwards';

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
  openAddItem(): void {
    this.itemToEdit.set(null);
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

  onStockInSaved(): void {
    this.showStockInModal.set(false);
    this.invService.loadAllData().subscribe();
  }

  onDispatchSaved(): void {
    this.showDispatchModal.set(false);
    this.invService.loadAllData().subscribe();
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

  // Formatting helpers
  formatDate(d: string): string {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
  }
}
