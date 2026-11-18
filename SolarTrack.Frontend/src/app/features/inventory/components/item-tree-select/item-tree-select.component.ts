import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryItemWithStock } from '../../models/inventory.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

export interface CategoryTreeNode {
  category: string;
  totalStock: number;
  items: InventoryItemWithStock[];
  isExpanded: boolean;
  matchCount?: number;
}

@Component({
  selector: 'app-item-tree-select',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './item-tree-select.component.html',
  styleUrls: ['./item-tree-select.component.scss'],
  host: {
    '[class.is-open]': 'isOpen()',
    '[style.position]': '"relative"',
    '[style.z-index]': 'isOpen() ? "1080" : "auto"'
  }
})
export class ItemTreeSelectComponent {
  private elementRef = inject(ElementRef);

  @Input() set items(val: InventoryItemWithStock[]) {
    this.itemsSignal.set(val || []);
  }

  @Input() set selectedCode(val: string) {
    this.selectedCodeSignal.set(val || '');
  }
  get selectedCode(): string {
    return this.selectedCodeSignal();
  }

  @Input() placeholder: string = '-- Select Item --';
  @Input() disabled: boolean = false;

  @Output() selectedCodeChange = new EventEmitter<string>();
  @Output() itemSelected = new EventEmitter<InventoryItemWithStock>();

  readonly itemsSignal = signal<InventoryItemWithStock[]>([]);
  readonly selectedCodeSignal = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  // Set of collapsed categories (by default all are expanded for consistent discovery)
  readonly collapsedCategories = signal<Set<string>>(new Set<string>());

  // Computed selected item (fully reactive)
  readonly selectedItem = computed(() => {
    const code = this.selectedCodeSignal();
    if (!code) return null;
    return this.itemsSignal().find(
      i => (i.ItemCode || '').toLowerCase() === code.toLowerCase()
    ) || null;
  });

  // Computed: Category Tree with Search Filtering
  readonly treeNodes = computed<CategoryTreeNode[]>(() => {
    const allItems = this.itemsSignal();
    const query = this.searchQuery().trim().toLowerCase();
    const collapsedSet = this.collapsedCategories();

    // Group items by category
    const categoryMap = new Map<string, InventoryItemWithStock[]>();

    allItems.forEach(item => {
      const cat = (item.Category || 'Others').trim();
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item);
    });

    const nodes: CategoryTreeNode[] = [];

    categoryMap.forEach((catItems, category) => {
      // Calculate category total available stock
      const totalStock = catItems.reduce(
        (sum, item) => sum + (Number(item.inHandQty) || 0),
        0
      );

      // Filter items if query exists
      let matchedItems = catItems;
      if (query) {
        const catMatches = category.toLowerCase().includes(query);
        if (!catMatches) {
          matchedItems = catItems.filter(item => {
            const name = (item.ItemName || '').toLowerCase();
            const desc = (item.Description || '').toLowerCase();
            return name.includes(query) || desc.includes(query);
          });
        }
      }

      if (matchedItems.length > 0) {
        // By default expanded; if user collapsed this category, keep it collapsed unless searching
        const isExpanded = query ? true : !collapsedSet.has(category);

        nodes.push({
          category,
          totalStock,
          items: matchedItems,
          isExpanded,
          matchCount: matchedItems.length
        });
      }
    });

    // Sort categories alphabetically
    return nodes.sort((a, b) => a.category.localeCompare(b.category));
  });

  // Total matching items count
  readonly totalMatches = computed(() => {
    return this.treeNodes().reduce((sum, n) => sum + n.items.length, 0);
  });

  // Close dropdown on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  // Close on Escape key
  @HostListener('keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;

    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    this.isOpen.set(true);
    this.searchQuery.set('');
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  toggleCategory(category: string, event: MouseEvent): void {
    event.stopPropagation();
    this.collapsedCategories.update(set => {
      const next = new Set(set);
      if (next.has(category)) {
        next.delete(category); // Expand
      } else {
        next.add(category); // Collapse
      }
      return next;
    });
  }

  selectItem(item: InventoryItemWithStock, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedCodeSignal.set(item.ItemCode);
    this.selectedCodeChange.emit(item.ItemCode);
    this.itemSelected.emit(item);
    this.closeDropdown();
  }

  clearSearch(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.searchQuery.set('');
  }
}
