import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import {
  InventoryItem,
  InventoryItemWithStock,
  InventoryInwardRow,
  GroupedInwardConsignment,
  InventoryDispatchRow,
  GroupedDispatchConsignment,
  InventoryKpiSummary,
  CustomerAllocationEntry,
  MonthlyFinancialPoint,
  ExpenseBreakdownItem,
  ExpensesSummary
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
  readonly rawShipments = signal<any[]>([]);
  readonly rawMaterials = signal<any[]>([]);
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
        const inwardIdDisplay = (row.InvoiceNo || row.InwardID || '').toString();
        mapGroup.set(key, {
          key,
          id: inwardIdDisplay,
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

        const dispatchIdDisplay = challanStr || (row.DispatchID ? String(row.DispatchID) : '');
        mapGroup.set(key, {
          key,
          id: dispatchIdDisplay,
          challanNo: dispatchIdDisplay,
          date: dateStr,
          siteName: siteStr,
          vehicle: row.Vehicle || '',
          transportCost: Number(row.TransportCost) || 0,
          distanceKm: Number(row.DistanceKm) || 0,
          chargePerKm: row.ChargePerKm !== undefined && row.ChargePerKm !== null ? Number(row.ChargePerKm) : undefined,
          customerNotes: row.CustomerNotes || '',
          isOurProject: true,
          remarks: row.Remarks || '',
          items: [],
          dispatchIds: [],
          totalQty: 0,
          totalMaterialCost: 0,
          grandTotal: 0,
          customerAllocations: custAllocs,
          documents: []
        });
      }

      const grp = mapGroup.get(key)!;
      grp.dispatchIds.push(row.DispatchID);

      if (!grp.distanceKm && row.DistanceKm) {
        grp.distanceKm = Number(row.DistanceKm) || 0;
      }
      if (grp.chargePerKm === undefined && row.ChargePerKm !== undefined && row.ChargePerKm !== null) {
        grp.chargePerKm = Number(row.ChargePerKm);
      }
      if (!grp.customerNotes && row.CustomerNotes) {
        grp.customerNotes = row.CustomerNotes;
      }

      if (grp.customerAllocations.length === 0 && row.CustomerAllocations) {
        try {
          const parsed = typeof row.CustomerAllocations === 'string'
            ? JSON.parse(row.CustomerAllocations)
            : row.CustomerAllocations;
          if (Array.isArray(parsed) && parsed.length > 0) {
            grp.customerAllocations = parsed;
          }
        } catch {}
      }

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

    mapGroup.forEach(grp => {
      grp.grandTotal = (grp.totalMaterialCost || 0) + (grp.transportCost || 0);
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
    const shipments = this.rawShipments();
    const materials = this.rawMaterials();

    let warehouseValuation = items.reduce((s, i) => s + i.totalStockValuation, 0);
    const totalInHandStock = items.reduce((s, i) => s + Math.max(0, i.inHandQty), 0);
    const totalSkus = items.length;

    // Dispatched equipment cost from dispatches table
    const dispatchesMaterial = dispatches.reduce((s, d) => s + (Number(d.totalMaterialCost) || 0), 0);

    // Dispatched material cost from customer installments (backup/primary when dispatches table is empty)
    let installmentMaterialCost = 0;
    let installmentTransportCost = 0;
    installments.forEach(inst => {
      const broker = inst.BrokerNumber || '';
      if (broker.includes('|expenses:')) {
        try {
          const exp = JSON.parse(broker.split('|expenses:')[1].split('|')[0]) || {};
          if (exp.material) installmentMaterialCost += Number(exp.material) || 0;
          if (exp.transport || exp.delivery) installmentTransportCost += Number(exp.transport || exp.delivery) || 0;
        } catch {}
      }
    });

    const totalDispatchedCost = dispatchesMaterial > 0 ? dispatchesMaterial : installmentMaterialCost;

    // Warehouse Valuation fallback: Total materials purchased minus total dispatched material cost
    if (warehouseValuation === 0 && materials.length > 0) {
      const totalPurchased = materials.reduce((s, m) => s + (Number(m.TotalPurchaseValue) || 0), 0);
      warehouseValuation = Math.max(0, totalPurchased - totalDispatchedCost);
    }

    // Total transportation: dispatches transport + inwards transport + shipments transport + installments transport
    const dispatchesTransport = dispatches.reduce((s, d) => s + (Number(d.transportCost) || 0), 0);
    const inwardsTransport = inwards.reduce((s, i) => s + (Number(i.transportCost) || 0), 0);
    const shipmentsTransport = shipments.reduce((s, sh) => s + (Number(sh.TransportationCost) || 0), 0);

    const totalTransportationCost = dispatchesTransport + inwardsTransport + shipmentsTransport + installmentTransportCost;

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

  // Computed: Month-wise Financials for Curve Charts
  readonly monthlyFinancials = computed<MonthlyFinancialPoint[]>(() => {
    const installments = this.rawInstallments();
    const dispatches = this.groupedDispatches();
    const inwards = this.groupedInwards();
    const shipments = this.rawShipments();
    const materials = this.rawMaterials();

    const monthMap = new Map<string, {
      turnover: number;
      dispatched: number;
      inwardPurchase: number;
      transport: number;
    }>();

    const getMonthKey = (dStr?: string | null): string | null => {
      if (!dStr || typeof dStr !== 'string') return null;
      const m = dStr.match(/^(\d{4})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}` : null;
    };

    const ensureMonth = (k: string) => {
      if (!monthMap.has(k)) {
        monthMap.set(k, { turnover: 0, dispatched: 0, inwardPurchase: 0, transport: 0 });
      }
      return monthMap.get(k)!;
    };

    // 1. Installments (Turnover & Expenses)
    installments.forEach(inst => {
      const dateKey = getMonthKey(inst.LoginDate) || getMonthKey(inst.AgreementDate);
      if (dateKey) {
        const mObj = ensureMonth(dateKey);
        mObj.turnover += Number(inst.CommittedPrice) || 0;

        const broker = inst.BrokerNumber || '';
        if (broker.includes('|expenses:')) {
          try {
            const exp = JSON.parse(broker.split('|expenses:')[1].split('|')[0]) || {};
            const dispKey = getMonthKey(inst.MaterialDispatchedDate) || dateKey;
            const dispObj = ensureMonth(dispKey);
            if (exp.material) dispObj.dispatched += Number(exp.material) || 0;
            if (exp.transport || exp.delivery) mObj.transport += Number(exp.transport || exp.delivery) || 0;
          } catch {}
        }
      }
    });

    // 2. Dispatches (Material and Transport Outflows)
    dispatches.forEach(disp => {
      const dateKey = getMonthKey(disp.date);
      if (dateKey) {
        const mObj = ensureMonth(dateKey);
        mObj.dispatched += Number(disp.totalMaterialCost) || 0;
        mObj.transport += Number(disp.transportCost) || 0;
      }
    });

    // 3. Inwards (Material Purchases & Freight)
    inwards.forEach(inw => {
      const dateKey = getMonthKey(inw.date);
      if (dateKey) {
        const mObj = ensureMonth(dateKey);
        mObj.inwardPurchase += Number(inw.totalMaterialCost) || 0;
        mObj.transport += Number(inw.transportCost) || 0;
      }
    });

    // 4. Shipments & Materials (Purchase Logistics and Stock Inward)
    const shipmentDateMap = new Map<string, string>();
    shipments.forEach(sh => {
      const dateKey = getMonthKey(sh.PurchaseDate);
      if (dateKey) {
        const mObj = ensureMonth(dateKey);
        mObj.transport += Number(sh.TransportationCost) || 0;
        if (sh.ShipmentNo) {
          shipmentDateMap.set(sh.ShipmentNo, dateKey);
        }
      }
    });

    materials.forEach(mat => {
      const shKey = mat.ShipmentNo ? shipmentDateMap.get(mat.ShipmentNo) : null;
      if (shKey) {
        const mObj = ensureMonth(shKey);
        mObj.inwardPurchase += Number(mat.TotalPurchaseValue) || 0;
      }
    });

    // Target relevant active calendar months (e.g. 2026-01 to 2026-11)
    let sortedKeys = Array.from(monthMap.keys())
      .filter(k => k >= '2026-01' && k <= '2026-12')
      .sort();

    if (sortedKeys.length === 0) {
      for (let m = 1; m <= 11; m++) {
        const k = `2026-${String(m).padStart(2, '0')}`;
        ensureMonth(k);
        sortedKeys.push(k);
      }
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let runningValuation = 0;
    const result: MonthlyFinancialPoint[] = [];

    sortedKeys.forEach(k => {
      const [y, mStr] = k.split('-');
      const mIdx = parseInt(mStr, 10) - 1;
      const monthLabel = `${monthNames[mIdx] || mStr} '${y.slice(2)}`;
      const mObj = monthMap.get(k)!;

      // Cumulative inventory valuation curve
      runningValuation = Math.max(0, runningValuation + mObj.inwardPurchase - mObj.dispatched);

      result.push({
        monthKey: k,
        monthLabel,
        totalTurnover: Math.round(mObj.turnover * 100) / 100,
        dispatchedCost: Math.round(mObj.dispatched * 100) / 100,
        warehouseValuation: Math.round(runningValuation * 100) / 100,
        transportationCost: Math.round(mObj.transport * 100) / 100
      });
    });

    return result;
  });

  // Computed: Expenses Breakdown for Pie/Donut Chart
  readonly expensesBreakdown = computed<ExpensesSummary>(() => {
    const installments = this.rawInstallments();
    const dispatches = this.groupedDispatches();
    const inwards = this.groupedInwards();
    const shipments = this.rawShipments();

    let materialCost = 0;
    let installationCost = 0;
    let transportationCost = 0;
    let otherCost = 0;

    // 1. From Installments
    installments.forEach(inst => {
      const broker = inst.BrokerNumber || '';
      if (broker.includes('|expenses:')) {
        try {
          const exp = JSON.parse(broker.split('|expenses:')[1].split('|')[0]) || {};
          if (exp.material) materialCost += Number(exp.material) || 0;
          if (exp.install) installationCost += Number(exp.install) || 0;
          if (exp.transport || exp.delivery) transportationCost += Number(exp.transport || exp.delivery) || 0;
          if (exp.other) otherCost += Number(exp.other) || 0;
        } catch {}
      }
    });

    // 2. From Dispatches
    const dispatchMaterial = dispatches.reduce((s, d) => s + (Number(d.totalMaterialCost) || 0), 0);
    if (dispatchMaterial > 0) {
      materialCost = dispatchMaterial;
    }
    const dispatchTransport = dispatches.reduce((s, d) => s + (Number(d.transportCost) || 0), 0);
    transportationCost += dispatchTransport;

    dispatches.forEach(d => {
      (d.customerAllocations || []).forEach(ca => {
        if (ca.installCost) installationCost += Number(ca.installCost) || 0;
        if (ca.otherCost) otherCost += Number(ca.otherCost) || 0;
      });
    });

    // 3. From Inwards
    const inwardTransport = inwards.reduce((s, i) => s + (Number(i.transportCost) || 0), 0);
    transportationCost += inwardTransport;

    // 4. From Shipments
    const shipmentTransport = shipments.reduce((s, sh) => s + (Number(sh.TransportationCost) || 0), 0);
    transportationCost += shipmentTransport;

    const totalExpenses = materialCost + transportationCost + installationCost + otherCost;

    const calcPct = (amt: number): number => {
      if (totalExpenses <= 0) return 0;
      return Math.round((amt / totalExpenses) * 1000) / 10;
    };

    const items: ExpenseBreakdownItem[] = [
      {
        id: 'material',
        label: 'Material Cost',
        amount: materialCost,
        percentage: calcPct(materialCost),
        color: '#6366f1',
        accentBg: 'rgba(99, 102, 241, 0.12)',
        icon: 'boxes',
        description: 'Solar PV modules, string inverters & balance of system (BOS)'
      },
      {
        id: 'transportation',
        label: 'Transportation Cost',
        amount: transportationCost,
        percentage: calcPct(transportationCost),
        color: '#0284c7',
        accentBg: 'rgba(2, 132, 199, 0.12)',
        icon: 'truck',
        description: 'Inter-warehouse freight, site dispatch transport & logistics'
      },
      {
        id: 'installation',
        label: 'Installation Cost',
        amount: installationCost,
        percentage: calcPct(installationCost),
        color: '#f59e0b',
        accentBg: 'rgba(245, 158, 11, 0.12)',
        icon: 'zap',
        description: 'Civil foundation, structural mounting & electrical labor charges'
      },
      {
        id: 'other',
        label: 'Other Cost',
        amount: otherCost,
        percentage: calcPct(otherCost),
        color: '#10b981',
        accentBg: 'rgba(16, 185, 129, 0.12)',
        icon: 'wallet',
        description: 'Net meter DISCOM processing, testing and site miscellaneous'
      }
    ];

    return {
      materialCost,
      transportationCost,
      installationCost,
      otherCost,
      totalExpenses,
      items
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
      ),
      shipments: this.http.get<any>('/api/get?table=shipments').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || []))),
        catchError(() => of([]))
      ),
      materials: this.http.get<any>('/api/get?table=materials').pipe(
        map(r => (Array.isArray(r) ? r : (r?.data || r?.value || []))),
        catchError(() => of([]))
      )
    }).pipe(
      tap(({ items, inwards, dispatches, installments, shipments, materials }) => {
        let finalItems = items;
        // If no equipment items registered, provide standard catalog
        if (!finalItems || finalItems.length === 0) {
          finalItems = this.getInitialFallbackItems();
        }
        this.rawItems.set(finalItems);
        this.rawInwards.set(inwards || []);
        this.rawDispatches.set(dispatches || []);
        this.rawInstallments.set(installments || []);
        this.rawShipments.set(shipments || []);
        this.rawMaterials.set(materials || []);
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

  updateStockAndRate(itemCode: string, newStock: number, newRate: number): Observable<any> {
    const currentItem = this.itemsWithStock().find(i => i.ItemCode.toLowerCase() === itemCode.toLowerCase());
    const currentStock = currentItem?.inHandQty ?? 0;
    const delta = Number((newStock - currentStock).toFixed(4));
    const todayStr = new Date().toISOString().split('T')[0];

    const requests: Observable<any>[] = [
      this.http.post(
        `/api/update?table=inventory_items&matchField=ItemCode&matchValue=${encodeURIComponent(itemCode)}`,
        { BuyingPrice: newRate }
      )
    ];

    if (delta > 0) {
      const inwardId = 'INW_ADJ_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const inwardRow = {
        InwardID: inwardId,
        Date: todayStr,
        Supplier: 'Stock Adjustment',
        ItemCode: itemCode,
        Quantity: delta,
        UnitPrice: newRate,
        GstRate: 0,
        CostPerUnit: newRate,
        TransportCost: 0,
        ConsignmentTransportCost: 0,
        TotalCost: Number((delta * newRate).toFixed(2)),
        Location: currentItem?.Location || 'Main Godown',
        Remarks: 'Inline Stock Adjustment',
        CreatedAt: new Date().toISOString()
      };
      requests.push(this.http.post('/api/insert?table=inventory_inwards', inwardRow));
    } else if (delta < 0) {
      const dispatchQty = Math.abs(delta);
      const dispatchId = 'DSP_ADJ_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const dispatchRow = {
        DispatchID: dispatchId,
        Date: todayStr,
        ChallanNo: 'ADJ-' + Date.now().toString().slice(-6),
        SiteName: 'Stock Adjustment',
        ItemCode: itemCode,
        Quantity: dispatchQty,
        UnitBuyingPrice: newRate,
        DispatchedCost: Number((dispatchQty * newRate).toFixed(2)),
        TransportCost: 0,
        Remarks: 'Inline Stock Adjustment',
        CreatedAt: new Date().toISOString()
      };
      requests.push(this.http.post('/api/insert?table=inventory_dispatches', dispatchRow));
    }

    return forkJoin(requests).pipe(
      switchMap(() => this.loadAllData())
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
        DocumentName: idx === 0 ? primaryDocName : null,
        DocumentData: idx === 0 ? primaryDocData : null,
        Documents: idx === 0 ? docsJson : null,
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

  updateInwardRecord(itemCode: string, inwardId: string, patch: { date: string; supplier: string; qty: number; rate: number }): Observable<any> {
    const totalCost = Number((patch.qty * patch.rate).toFixed(2));
    const inwardPatch: any = {
      Date: patch.date,
      Supplier: patch.supplier,
      Quantity: patch.qty,
      UnitPrice: patch.rate,
      CostPerUnit: patch.rate,
      TotalCost: totalCost
    };

    return this.http.post(
      `/api/update?table=inventory_inwards&matchField=InwardID&matchValue=${encodeURIComponent(inwardId)}`,
      inwardPatch
    ).pipe(
      switchMap(() => {
        // If this record is the latest by date, ensure item BuyingPrice matches
        const itemInwards = this.rawInwards()
          .filter(i => (i.ItemCode || '').toLowerCase() === itemCode.toLowerCase())
          .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
        const isLatest = itemInwards.length === 0 || itemInwards[0].InwardID === inwardId || new Date(patch.date).getTime() >= new Date(itemInwards[0].Date).getTime();
        if (isLatest && patch.rate > 0) {
          return this.http.post(
            `/api/update?table=inventory_items&matchField=ItemCode&matchValue=${encodeURIComponent(itemCode)}`,
            { BuyingPrice: patch.rate }
          );
        }
        return of(null);
      }),
      switchMap(() => this.loadAllData())
    );
  }

  deleteInwardRecord(itemCode: string, inwardId: string): Observable<any> {
    return this.http.post(
      `/api/delete?table=inventory_inwards&matchField=InwardID&matchValue=${encodeURIComponent(inwardId)}`,
      {}
    ).pipe(
      switchMap(() => {
        // Find latest remaining inward for this item to sync BuyingPrice
        const remaining = this.rawInwards()
          .filter(i => (i.ItemCode || '').toLowerCase() === itemCode.toLowerCase() && i.InwardID !== inwardId)
          .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
        if (remaining.length > 0) {
          const latestRate = Number(remaining[0].CostPerUnit || remaining[0].UnitPrice) || 0;
          if (latestRate > 0) {
            return this.http.post(
              `/api/update?table=inventory_items&matchField=ItemCode&matchValue=${encodeURIComponent(itemCode)}`,
              { BuyingPrice: latestRate }
            );
          }
        }
        return of(null);
      }),
      switchMap(() => this.loadAllData())
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

  updateStockInConsignment(
    oldInwardIds: string[],
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
    return this.deleteInwardConsignment(oldInwardIds).pipe(
      switchMap(() => this.saveStockInConsignment(header, itemsList))
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
      chargePerKm?: number;
      customerNotes?: string;
      extraDeliveryCost?: number;
      extraDeliveryComment?: string;
      remarks: string;
      isOurProject: boolean;
      customerAllocations: CustomerAllocationEntry[];
      docName?: string;
      docData?: string;
      documents?: Array<{ name: string; data?: string }>;
      challanNo?: string;
    },
    itemsList: Array<{ itemCode: string; qty: number; unitBuyingPrice: number; dispatchedCost: number }>
  ): Observable<any> {
    const challanNo = header.challanNo || ('DSP_' + Date.now().toString().slice(-6));
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
        DistanceKm: header.distanceKm !== undefined && header.distanceKm !== null ? Number(header.distanceKm) : null,
        ChargePerKm: header.chargePerKm !== undefined && header.chargePerKm !== null ? Number(header.chargePerKm) : null,
        CustomerNotes: idx === 0 && header.customerNotes ? header.customerNotes.trim() : null,
        Vehicle: header.vehicle,
        Remarks: header.remarks,
        CustomerAllocations: idx === 0 ? allocJson : null,
        DocumentName: idx === 0 ? primaryDocName : null,
        DocumentData: idx === 0 ? primaryDocData : null,
        Documents: idx === 0 ? docsJson : null,
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

  updateSiteDispatchConsignment(
    oldDispatchIds: string[],
    header: {
      siteName: string;
      date: string;
      vehicle: string;
      transportCost: number;
      distanceKm?: number;
      chargePerKm?: number;
      customerNotes?: string;
      extraDeliveryCost?: number;
      extraDeliveryComment?: string;
      remarks: string;
      isOurProject: boolean;
      customerAllocations: CustomerAllocationEntry[];
      docName?: string;
      docData?: string;
      documents?: Array<{ name: string; data?: string }>;
      challanNo?: string;
    },
    itemsList: Array<{ itemCode: string; qty: number; unitBuyingPrice: number; dispatchedCost: number }>
  ): Observable<any> {
    return this.deleteDispatchConsignment(oldDispatchIds).pipe(
      switchMap(() => this.saveSiteDispatchConsignment(header, itemsList))
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
