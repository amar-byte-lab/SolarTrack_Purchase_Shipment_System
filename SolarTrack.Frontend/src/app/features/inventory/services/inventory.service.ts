import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  InventoryItem,
  InventoryItemWithStock,
  InventoryInwardRow,
  GroupedInwardConsignment,
  InventoryDispatchRow,
  GroupedDispatchConsignment,
  InventoryKpiSummary,
  CustomerAllocationEntry
} from '../models/inventory.model';
import { InstallmentRow } from '../../../core/models/summary.model';

export const DEFAULT_INVENTORY_CATEGORIES: string[] = [
  'Panels',
  'Inverters',
  'Cables',
  'Structure',
  'Hardware',
  'Electricals',
  'Conduit',
  'Earthing',
  'Others'
];

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);

  // Raw Data Signals
  readonly rawItems = signal<InventoryItem[]>([]);
  readonly rawInwards = signal<InventoryInwardRow[]>([]);
  readonly rawDispatches = signal<InventoryDispatchRow[]>([]);
  readonly rawInstallments = signal<InstallmentRow[]>([]);
  readonly categories = signal<string[]>(this.loadCategoriesFromStorage());

  // Loading indicator
  readonly isLoading = signal<boolean>(false);

  // Computed: Items with calculated stock, status, and valuation
  readonly itemsWithStock = computed<InventoryItemWithStock[]>(() => {
    const items = this.rawItems();
    const inwards = this.rawInwards();
    const dispatches = this.rawDispatches();

    return items.map(item => {
      const codeLower = (item.ItemCode || '').toLowerCase().trim();
      const nameLower = (item.ItemName || '').toLowerCase().trim();

      // Total received qty
      const totalInward = inwards
        .filter(r => {
          const rCode = (r.ItemCode || '').toLowerCase().trim();
          return rCode === codeLower;
        })
        .reduce((sum, r) => sum + (Number(r.Quantity) || 0), 0);

      // Total dispatched qty
      const totalDispatched = dispatches
        .filter(r => {
          const rCode = (r.ItemCode || '').toLowerCase().trim();
          return rCode === codeLower;
        })
        .reduce((sum, r) => sum + (Number(r.Quantity) || 0), 0);

      const inHandQty = totalInward - totalDispatched;
      const minThreshold = Number(item.MinThreshold) || 5;
      const buyingPrice = Number(item.BuyingPrice) || 0;

      let status: 'in-stock' | 'low-stock' | 'out-of-stock' = 'in-stock';
      if (inHandQty <= 0) {
        status = 'out-of-stock';
      } else if (inHandQty <= minThreshold) {
        status = 'low-stock';
      }

      const totalStockValuation = Math.max(0, inHandQty) * buyingPrice;

      return {
        ...item,
        totalInward,
        totalDispatched,
        inHandQty,
        status,
        totalStockValuation
      };
    });
  });

  // Computed: Grouped Inward Consignments
  readonly groupedInwards = computed<GroupedInwardConsignment[]>(() => {
    const inwards = this.rawInwards();
    const items = this.rawItems();
    const itemMap = new Map(items.map(i => [i.ItemCode.toLowerCase(), i]));

    const mapGroup = new Map<string, GroupedInwardConsignment>();

    inwards.forEach(row => {
      const dateStr = (row.Date || '').slice(0, 10);
      const supplierStr = (row.Supplier || 'Unknown Supplier').trim();
      const locStr = (row.Location || 'Main Godown').trim();
      const key = `${dateStr}_${supplierStr}_${locStr}`;

      if (!mapGroup.has(key)) {
        mapGroup.set(key, {
          key,
          date: dateStr,
          supplier: supplierStr,
          location: locStr,
          transportCost: Number(row.ConsignmentTransportCost ?? row.TransportCost) || 0,
          remarks: row.Remarks || '',
          items: [],
          inwardIds: [],
          totalQty: 0,
          totalMaterialCost: 0,
          totalGst: 0,
          grandTotal: 0,
          documents: []
        });
      }

      const grp = mapGroup.get(key)!;
      grp.inwardIds.push(row.InwardID);

      const itm = itemMap.get((row.ItemCode || '').toLowerCase());
      const itemName = itm?.ItemName || row.ItemCode;
      const unit = itm?.Unit || 'Nos';

      const qty = Number(row.Quantity) || 0;
      const unitPrice = Number(row.UnitPrice) || 0;
      const gstRate = Number(row.GstRate ?? 18);
      const costPerUnit = Number(row.CostPerUnit) || unitPrice;
      const totalCost = Number(row.TotalCost) || (qty * unitPrice);

      grp.items.push({
        id: row.InwardID,
        itemCode: row.ItemCode,
        itemName,
        qty,
        unitPrice,
        gstRate,
        costPerUnit,
        totalCost,
        unit
      });

      grp.totalQty += qty;
      grp.totalMaterialCost += totalCost;
      const gstAmt = (totalCost * gstRate) / 100;
      grp.totalGst += gstAmt;
      grp.grandTotal += totalCost + gstAmt;

      if (row.Documents) {
        try {
          const parsed = typeof row.Documents === 'string' ? JSON.parse(row.Documents) : row.Documents;
          if (Array.isArray(parsed)) {
            parsed.forEach((d: any) => {
              if (d && d.name && !grp.documents.some(x => x.name === d.name)) {
                grp.documents.push({ name: d.name, data: d.data });
              }
            });
          }
        } catch {}
      }
      if (row.DocumentName && !grp.documents.some(d => d.name === row.DocumentName)) {
        grp.documents.push({ name: row.DocumentName, data: row.DocumentData });
      }
    });

    return Array.from(mapGroup.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  // Computed: Grouped Site Dispatches
  readonly groupedDispatches = computed<GroupedDispatchConsignment[]>(() => {
    const dispatches = this.rawDispatches();
    const items = this.rawItems();
    const itemMap = new Map(items.map(i => [i.ItemCode.toLowerCase(), i]));

    const mapGroup = new Map<string, GroupedDispatchConsignment>();

    dispatches.forEach(row => {
      const dateStr = (row.Date || '').slice(0, 10);
      const siteStr = (row.SiteName || 'Site Dispatch').trim();
      const challanStr = (row.ChallanNo || '').trim();
      const key = challanStr ? `CH_${challanStr}` : `${dateStr}_${siteStr}`;

      if (!mapGroup.has(key)) {
        let custAllocs: CustomerAllocationEntry[] = [];
        if (row.CustomerAllocations) {
          try {
            custAllocs = typeof row.CustomerAllocations === 'string'
              ? JSON.parse(row.CustomerAllocations)
              : row.CustomerAllocations;
          } catch {}
        }

        mapGroup.set(key, {
          key,
          challanNo: challanStr || (row.DispatchID ? String(row.DispatchID) : ''),
          date: dateStr,
          siteName: siteStr,
          vehicle: row.Vehicle || '',
          transportCost: Number(row.TransportCost) || 0,
          isOurProject: true,
          remarks: row.Remarks || '',
          items: [],
          dispatchIds: [],
          totalQty: 0,
          totalMaterialCost: 0,
          customerAllocations: custAllocs,
          documents: []
        });
      }

      const grp = mapGroup.get(key)!;
      grp.dispatchIds.push(row.DispatchID);

      const itm = itemMap.get((row.ItemCode || '').toLowerCase());
      const itemName = itm?.ItemName || row.ItemCode;
      const unit = itm?.Unit || 'Nos';

      const qty = Number(row.Quantity) || 0;
      const unitBuyingPrice = Number(row.UnitBuyingPrice) || (itm?.BuyingPrice || 0);
      const dispatchedCost = Number(row.DispatchedCost) || (qty * unitBuyingPrice);

      grp.items.push({
        id: row.DispatchID,
        itemCode: row.ItemCode,
        itemName,
        qty,
        unitBuyingPrice,
        dispatchedCost,
        unit
      });

      grp.totalQty += qty;
      grp.totalMaterialCost += dispatchedCost;

      if (row.Documents) {
        try {
          const parsed = typeof row.Documents === 'string' ? JSON.parse(row.Documents) : row.Documents;
          if (Array.isArray(parsed)) {
            parsed.forEach((d: any) => {
              if (d && d.name && !grp.documents.some(x => x.name === d.name)) {
                grp.documents.push({ name: d.name, data: d.data });
              }
            });
          }
        } catch {}
      }
      if (row.DocumentName && !grp.documents.some(d => d.name === row.DocumentName)) {
        grp.documents.push({ name: row.DocumentName, data: row.DocumentData });
      }
    });

    return Array.from(mapGroup.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  // Computed: Real-time KPI Summary
  readonly kpis = computed<InventoryKpiSummary>(() => {
    const items = this.itemsWithStock();
    const dispatches = this.groupedDispatches();
    const inwards = this.groupedInwards();
    const installments = this.rawInstallments();

    const warehouseValuation = items.reduce((s, i) => s + i.totalStockValuation, 0);
    const totalInHandStock = items.reduce((s, i) => s + Math.max(0, i.inHandQty), 0);
    const totalSkus = items.length;

    const totalDispatchedCost = dispatches.reduce((s, d) => s + d.totalMaterialCost, 0);
    const totalTransportationCost = dispatches.reduce((s, d) => s + d.transportCost, 0) +
                               inwards.reduce((s, i) => s + i.transportCost, 0);

    const totalTurnover = installments.reduce((s, c) => s + (Number(c.CommittedPrice) || 0), 0);

    return {
      totalTurnover,
      totalDispatchedCost,
      totalTransportationCost,
      warehouseValuation,
      totalInHandStock,
      totalSkus
    };
  });

  // Load all inventory data from backend API
  loadAllData(): Observable<any> {
    this.isLoading.set(true);
    return forkJoin({
      items: this.http.get<any>('/api/get?table=inventory_items').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || [])) as InventoryItem[]),
        catchError(() => of([] as InventoryItem[]))
      ),
      inwards: this.http.get<any>('/api/get?table=inventory_inwards').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || [])) as InventoryInwardRow[]),
        catchError(() => of([] as InventoryInwardRow[]))
      ),
      dispatches: this.http.get<any>('/api/get?table=inventory_dispatches').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || [])) as InventoryDispatchRow[]),
        catchError(() => of([] as InventoryDispatchRow[]))
      ),
      installments: this.http.get<any>('/api/get?table=installments').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || [])) as InstallmentRow[]),
        catchError(() => of([] as InstallmentRow[]))
      )
    }).pipe(
      tap(({ items, inwards, dispatches, installments }) => {
        let finalItems = items;
        // If no equipment items registered, provide standard catalog
        if (!finalItems || finalItems.length === 0) {
          finalItems = this.getInitialFallbackItems();
        }
        this.rawItems.set(finalItems);
        this.rawInwards.set(inwards || []);
        this.rawDispatches.set(dispatches || []);
        this.rawInstallments.set(installments || []);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.isLoading.set(false);
        return of(null);
      })
    );
  }

  // --- CRUD: Inventory Items (SKUs) ---
  saveItem(item: InventoryItem): Observable<any> {
    const payload = {
      ItemCode: item.ItemCode,
      ItemName: item.ItemName,
      Category: item.Category,
      Unit: item.Unit,
      MinThreshold: Number(item.MinThreshold) || 5,
      BuyingPrice: Number(item.BuyingPrice) || 0,
      Location: item.Location || '',
      Description: item.Description || ''
    };

    return this.http.post('/api/insert?table=inventory_items', payload).pipe(
      tap(() => {
        this.rawItems.update(list => [...list, payload as InventoryItem]);
      })
    );
  }

  updateItem(itemCode: string, patch: Partial<InventoryItem>): Observable<any> {
    return this.http.post(
      `/api/update?table=inventory_items&matchField=ItemCode&matchValue=${encodeURIComponent(itemCode)}`,
      patch
    ).pipe(
      tap(() => {
        this.rawItems.update(list =>
          list.map(i => i.ItemCode.toLowerCase() === itemCode.toLowerCase() ? { ...i, ...patch } : i)
        );
      })
    );
  }

  deleteItem(itemCode: string): Observable<any> {
    return this.http.post(
      `/api/delete?table=inventory_items&matchField=ItemCode&matchValue=${encodeURIComponent(itemCode)}`,
      {}
    ).pipe(
      tap(() => {
        this.rawItems.update(list =>
          list.filter(i => i.ItemCode.toLowerCase() !== itemCode.toLowerCase())
        );
      })
    );
  }

  deleteItemsBatch(itemCodes: string[]): Observable<any> {
    return this.http.post(
      '/api/delete-batch?table=inventory_items&matchField=ItemCode',
      { MatchValues: itemCodes }
    ).pipe(
      tap(() => {
        const set = new Set(itemCodes.map(c => c.toLowerCase()));
        this.rawItems.update(list => list.filter(i => !set.has(i.ItemCode.toLowerCase())));
      })
    );
  }

  // --- Inward Purchases (Stock In) ---
  saveStockInConsignment(
    header: {
      date: string;
      supplier: string;
      location: string;
      transportCost: number;
      remarks: string;
      docName?: string;
      docData?: string;
      documents?: Array<{ name: string; data?: string }>;
    },
    itemsList: Array<{
      itemCode: string;
      qty: number;
      unitPrice: number;
      gstRate: number;
      costPerUnit: number;
      totalCost: number;
      deliveryShare?: number;
    }>
  ): Observable<any> {
    const docsJson = header.documents && header.documents.length > 0
      ? JSON.stringify(header.documents)
      : null;
    const primaryDocName = header.documents?.[0]?.name || header.docName || null;
    const primaryDocData = header.documents?.[0]?.data || header.docData || null;

    const rowsToInsert: any[] = itemsList.map((item, idx) => {
      const inwardId = 'INW_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
      return {
        InwardID: inwardId,
        Date: header.date,
        Supplier: header.supplier,
        ItemCode: item.itemCode,
        Quantity: item.qty,
        UnitPrice: item.unitPrice,
        GstRate: item.gstRate,
        CostPerUnit: item.costPerUnit,
        TransportCost: item.deliveryShare !== undefined ? item.deliveryShare : (header.transportCost / (itemsList.length || 1)),
        ConsignmentTransportCost: header.transportCost,
        TotalCost: item.totalCost,
        Location: header.location,
        Remarks: header.remarks,
        DocumentName: primaryDocName,
        DocumentData: primaryDocData,
        Documents: docsJson,
        CreatedAt: new Date().toISOString()
      };
    });

    return this.http.post('/api/insert-batch?table=inventory_inwards', rowsToInsert).pipe(
      tap(() => {
        this.rawInwards.update(list => [...list, ...rowsToInsert]);
        // Update item buying prices
        itemsList.forEach(it => {
          if (it.costPerUnit > 0) {
            this.updateItem(it.itemCode, { BuyingPrice: it.costPerUnit }).subscribe();
          }
        });
      })
    );
  }

  deleteInwardConsignment(inwardIds: string[]): Observable<any> {
    return this.http.post(
      '/api/delete-batch?table=inventory_inwards&matchField=InwardID',
      { MatchValues: inwardIds }
    ).pipe(
      tap(() => {
        const set = new Set(inwardIds);
        this.rawInwards.update(list => list.filter(r => !set.has(r.InwardID)));
      })
    );
  }

  // --- Site Dispatches ---
  saveSiteDispatchConsignment(
    header: {
      siteName: string;
      date: string;
      vehicle: string;
      transportCost: number;
      distanceKm?: number;
      extraDeliveryCost?: number;
      extraDeliveryComment?: string;
      remarks: string;
      isOurProject: boolean;
      customerAllocations: CustomerAllocationEntry[];
      docName?: string;
      docData?: string;
      documents?: Array<{ name: string; data?: string }>;
    },
    itemsList: Array<{ itemCode: string; qty: number; unitBuyingPrice: number; dispatchedCost: number }>
  ): Observable<any> {
    const challanNo = 'DSP_' + Date.now().toString().slice(-6);
    const allocJson = JSON.stringify(header.customerAllocations || []);
    const docsJson = header.documents && header.documents.length > 0
      ? JSON.stringify(header.documents)
      : null;
    const primaryDocName = header.documents?.[0]?.name || header.docName || null;
    const primaryDocData = header.documents?.[0]?.data || header.docData || null;

    const rowsToInsert: any[] = itemsList.map((item, idx) => {
      const dispatchId = 'DSP_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
      return {
        DispatchID: dispatchId,
        Date: header.date,
        ChallanNo: challanNo,
        SiteName: header.siteName,
        ItemCode: item.itemCode,
        Quantity: item.qty,
        UnitBuyingPrice: item.unitBuyingPrice,
        DispatchedCost: item.dispatchedCost,
        TransportCost: header.transportCost,
        Vehicle: header.vehicle,
        Remarks: header.remarks,
        CustomerAllocations: allocJson,
        DocumentName: primaryDocName,
        DocumentData: primaryDocData,
        Documents: docsJson,
        CreatedAt: new Date().toISOString()
      };
    });

    return this.http.post('/api/insert-batch?table=inventory_dispatches', rowsToInsert).pipe(
      tap(() => {
        this.rawDispatches.update(list => [...list, ...rowsToInsert]);
      })
    );
  }

  deleteDispatchConsignment(dispatchIds: string[]): Observable<any> {
    return this.http.post(
      '/api/delete-batch?table=inventory_dispatches&matchField=DispatchID',
      { MatchValues: dispatchIds }
    ).pipe(
      tap(() => {
        const set = new Set(dispatchIds);
        this.rawDispatches.update(list => list.filter(r => !set.has(r.DispatchID)));
      })
    );
  }

  // --- Categories Management ---
  private loadCategoriesFromStorage(): string[] {
    try {
      const stored = localStorage.getItem('solartrack_inv_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [...DEFAULT_INVENTORY_CATEGORIES];
  }

  saveCategoriesToStorage(cats: string[]): void {
    try {
      localStorage.setItem('solartrack_inv_categories', JSON.stringify(cats));
    } catch {}
    this.categories.set([...cats]);
  }

  addCategory(name: string): boolean {
    const clean = name.trim();
    if (!clean) return false;
    const cats = this.categories();
    if (cats.some(c => c.toLowerCase() === clean.toLowerCase())) return false;
    const next = [...cats, clean];
    this.saveCategoriesToStorage(next);
    return true;
  }

  renameCategory(oldName: string, newName: string): boolean {
    const clean = newName.trim();
    if (!clean || oldName.toLowerCase() === clean.toLowerCase()) return false;
    const next = this.categories().map(c => c.toLowerCase() === oldName.toLowerCase() ? clean : c);
    this.saveCategoriesToStorage(next);

    // Update items with old category
    this.rawItems.update(list =>
      list.map(i => i.Category.toLowerCase() === oldName.toLowerCase() ? { ...i, Category: clean } : i)
    );
    return true;
  }

  deleteCategory(catName: string): void {
    const next = this.categories().filter(c => c.toLowerCase() !== catName.toLowerCase());
    this.saveCategoriesToStorage(next);

    // Reassign items to Others
    this.rawItems.update(list =>
      list.map(i => i.Category.toLowerCase() === catName.toLowerCase() ? { ...i, Category: 'Others' } : i)
    );
  }

  // Fallback initial items catalog
  private getInitialFallbackItems(): InventoryItem[] {
    return [
      { ItemCode: 'SKU-PV-540W', ItemName: 'Solar PV Module 540W Mono PERC', Category: 'Panels', Unit: 'Nos', MinThreshold: 10, BuyingPrice: 10800 },
      { ItemCode: 'SKU-PV-450W', ItemName: 'Solar PV Module 450W Bi-Facial', Category: 'Panels', Unit: 'Nos', MinThreshold: 8, BuyingPrice: 9200 },
      { ItemCode: 'SKU-INV-3KW', ItemName: '3kW On-Grid String Inverter', Category: 'Inverters', Unit: 'Nos', MinThreshold: 4, BuyingPrice: 28500 },
      { ItemCode: 'SKU-INV-5KW', ItemName: '5kW Hybrid Dual MPPT Inverter', Category: 'Inverters', Unit: 'Nos', MinThreshold: 3, BuyingPrice: 48000 },
      { ItemCode: 'SKU-CAB-4SQ', ItemName: '4 sq.mm DC Solar Cable (Red/Black)', Category: 'Cables', Unit: 'Meters', MinThreshold: 100, BuyingPrice: 42 },
      { ItemCode: 'SKU-CAB-AC6SQ', ItemName: '6 sq.mm 4-Core AC Armoured Cable', Category: 'Cables', Unit: 'Meters', MinThreshold: 50, BuyingPrice: 165 },
      { ItemCode: 'SKU-STR-GI3KW', ItemName: '3kW Rooftop GI Mounting Structure', Category: 'Structure', Unit: 'Sets', MinThreshold: 5, BuyingPrice: 12500 },
      { ItemCode: 'SKU-EARTH-ROD', ItemName: 'Chemical Earthing Electrode Rod 14mm x 2m', Category: 'Earthing', Unit: 'Nos', MinThreshold: 10, BuyingPrice: 1450 },
      { ItemCode: 'SKU-ELE-ACDB', ItemName: '1-Phase ACDB with SPD & MCB Protection', Category: 'Electricals', Unit: 'Nos', MinThreshold: 6, BuyingPrice: 3200 },
      { ItemCode: 'SKU-HDW-FASTENER', ItemName: 'SS304 M10 Fasteners & Hardware Pack', Category: 'Hardware', Unit: 'Sets', MinThreshold: 15, BuyingPrice: 850 }
    ];
  }
}
