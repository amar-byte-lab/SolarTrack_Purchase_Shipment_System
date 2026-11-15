import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ReportColumn, ReportRow } from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  reportType = signal<string>('daily');
  fromDate = signal<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  toDate = signal<string>(new Date().toISOString().slice(0, 10));

  columns = signal<ReportColumn[]>([]);
  data = signal<ReportRow[]>([]);
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  generateReport(): Observable<any> {
    this.isLoading.set(true);
    const type = this.reportType();
    
    // Choose table based on report type
    let table = 'purchases';
    if (type === 'shipment' || type === 'transport') table = 'shipments';
    else if (type === 'inventory') table = 'inventory';
    else if (type === 'vendor') table = 'vendors';
    else if (type === 'item') table = 'items';

    return this.http.get<any[]>(`/api/get?table=${table}`).pipe(
      tap((rawRows) => {
        this.isLoading.set(false);
        this.processReportData(type, rawRows || []);
      })
    );
  }

  private processReportData(type: string, rawRows: any[]): void {
    const from = this.fromDate();
    const to = this.toDate();

    let filtered = rawRows;
    if (from || to) {
      filtered = rawRows.filter(r => {
        const d = r.date || r.Date || r.created_at || r.CreatedAt;
        if (!d) return true;
        const dStr = String(d).slice(0, 10);
        if (from && dStr < from) return false;
        if (to && dStr > to) return false;
        return true;
      });
    }

    if (type === 'shipment' || type === 'transport') {
      this.columns.set([
        { key: 'shipment_id', label: 'Shipment ID' },
        { key: 'tracking_no', label: 'Tracking No' },
        { key: 'carrier', label: 'Carrier / Transporter' },
        { key: 'status', label: 'Status' },
        { key: 'cost', label: 'Transport Cost (₹)', isNumeric: true },
        { key: 'dispatch_date', label: 'Date' }
      ]);
      this.data.set(filtered.map(r => ({
        shipment_id: r.shipment_id || r.ShipmentID || '-',
        tracking_no: r.tracking_no || r.TrackingNo || '-',
        carrier: r.transporter || r.carrier || r.Carrier || '-',
        status: r.status || r.Status || 'In Transit',
        cost: Number(r.freight_charges || r.cost || 0),
        dispatch_date: String(r.dispatch_date || r.date || '').slice(0, 10)
      })));
    } else if (type === 'vendor') {
      this.columns.set([
        { key: 'vendor_name', label: 'Vendor Name' },
        { key: 'contact_person', label: 'Contact Person' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'gst', label: 'GST Number' },
        { key: 'city', label: 'City / District' }
      ]);
      this.data.set(filtered.map(r => ({
        vendor_name: r.name || r.VendorName || r.vendor_name || '-',
        contact_person: r.contact_person || r.contact || '-',
        mobile: r.mobile || r.phone || '-',
        gst: r.gst || r.gstin || '-',
        city: r.city || r.district || '-'
      })));
    } else {
      // Default Purchases / Daily / Monthly / Items
      this.columns.set([
        { key: 'date', label: 'Date' },
        { key: 'item_name', label: 'Item / Description' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'qty', label: 'Quantity', isNumeric: true },
        { key: 'rate', label: 'Rate (₹)', isNumeric: true },
        { key: 'amount', label: 'Total Amount (₹)', isNumeric: true }
      ]);
      this.data.set(filtered.map(r => {
        const qty = Number(r.qty || r.quantity || 1);
        const rate = Number(r.rate || r.price || 0);
        return {
          date: String(r.date || r.Date || r.created_at || '').slice(0, 10),
          item_name: r.item_name || r.ItemName || r.description || 'Solar Equipment',
          vendor: r.vendor_name || r.vendor || '-',
          qty: qty,
          rate: rate,
          amount: Number(r.amount || r.total || (qty * rate))
        };
      }));
    }
  }

  exportToCsv(): void {
    const cols = this.columns();
    const rows = this.data();
    if (rows.length === 0) return;

    const header = cols.map(c => `"${c.label}"`).join(',');
    const body = rows.map(r => cols.map(c => `"${r[c.key] ?? ''}"`).join(',')).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + '\n' + body);

    const a = document.createElement('a');
    a.setAttribute('href', csvContent);
    a.setAttribute('download', `Report_${this.reportType()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
