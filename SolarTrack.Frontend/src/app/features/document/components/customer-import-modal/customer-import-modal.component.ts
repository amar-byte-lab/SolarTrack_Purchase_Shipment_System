import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { ToastService } from '../../../../shared/services/toast.service';
import { SummaryService } from '../../../../core/services/summary.service';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CustomerMappingTableComponent } from '../customer-mapping-table/customer-mapping-table.component';
import { 
  ParsedCustomerItem, 
  ConflictingCustomerItem, 
  MissingCustomerItem, 
  ImportAnalysisSummary 
} from '../../models/import.model';

@Component({
  selector: 'app-customer-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, CustomerMappingTableComponent],
  templateUrl: './customer-import-modal.component.html',
  styleUrls: ['./customer-import-modal.component.scss']
})
export class CustomerImportModalComponent {
  @Input() isOpen = false;
  @Input() existingCustomers: InstallmentRow[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() importCompleted = new EventEmitter<void>();

  private http = inject(HttpClient);
  private toastService = inject(ToastService);
  private summaryService = inject(SummaryService);

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Parsed analysis state
  parsedFileLoaded = signal<boolean>(false);
  uploadedFileName = signal<string>('');
  
  newCustomers: ParsedCustomerItem[] = [];
  conflictingCustomers: ConflictingCustomerItem[] = [];
  missingCustomers: MissingCustomerItem[] = [];
  identicalCount = 0;

  selectAllNew = true;

  get summary(): ImportAnalysisSummary {
    return {
      newCount: this.newCustomers.filter(c => !c.IsDuplicate).length,
      conflictCount: this.conflictingCustomers.length,
      identicalCount: this.identicalCount,
      missingCount: this.missingCustomers.length
    };
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.processExcelFile(file);
    input.value = '';
  }

  onDropFile(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processExcelFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private cleanName(n: string): string {
    return n ? n.toLowerCase().replace(/\s+/g, ' ').trim() : '';
  }

  private parseExcelDate(val: any): string {
    if (val === undefined || val === null || val === '') return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    // Match DD-MM-YY, DD-MM-YYYY, DD/MM/YY, DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    // Match YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
      let year = parseInt(ymd[1], 10);
      let month = parseInt(ymd[2], 10);
      let day = parseInt(ymd[3], 10);
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return s;
  }

  fmtDateExcel(d: any): string {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  }

  getDelayInfo(dateStr: string | null | undefined): { text: string; colorType: 'red' | 'yellow' | 'normal' } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - d.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 0) return { text: '0D', colorType: 'normal' };

    let y = today.getFullYear() - d.getFullYear();
    let m = today.getMonth() - d.getMonth();
    let day = today.getDate() - d.getDate();

    if (day < 0) {
      m -= 1;
      const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      day += prevMonthDays;
    }
    if (m < 0) {
      y -= 1;
      m += 12;
    }

    const parts: string[] = [];
    if (y > 0) parts.push(`${y}Y`);
    if (m > 0) parts.push(`${m}M`);
    if (day > 0 || parts.length === 0) parts.push(`${day}D`);

    const text = parts.join(' ');
    let colorType: 'red' | 'yellow' | 'normal' = 'normal';
    if (totalDays > 90) {
      colorType = 'red';
    } else if (totalDays > 60) {
      colorType = 'yellow';
    }

    return { text, colorType };
  }

  formatDiscom(subDiv?: string, div?: string, circle?: string): string {
    const parts = [subDiv, div].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : (circle || '—');
  }

  private parseBrokerNumberForWork(brokerStr: string | null | undefined): any {
    if (!brokerStr || typeof brokerStr !== 'string') return {};
    const workIdx = brokerStr.indexOf('|work:');
    if (workIdx !== -1) {
      try {
        return JSON.parse(brokerStr.slice(workIdx + 6)) || {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  private hydrateRowWithWorkMeta(r: InstallmentRow): InstallmentRow {
    const workObj = this.parseBrokerNumberForWork(r.BrokerNumber);
    return {
      ...r,
      SubDivision: r.SubDivision || workObj.SubDivision || '',
      DivisionName: r.DivisionName || workObj.DivisionName || '',
      CircleName: r.CircleName || workObj.CircleName || '',
      ApplicationNumber: r.ApplicationNumber || workObj.ApplicationNumber || '',
      ProposedCapacity: r.ProposedCapacity || workObj.ProposedCapacity || ''
    };
  }

  private formatBrokerNumberWithWorkMeta(currentBrokerNumber: string, updates: any): string {
    const workIdx = (currentBrokerNumber || '').indexOf('|work:');
    let rest = currentBrokerNumber || '';
    let workObj: any = {};
    if (workIdx !== -1) {
      const workStr = rest.slice(workIdx + 6);
      rest = rest.slice(0, workIdx);
      try {
        workObj = JSON.parse(workStr) || {};
      } catch (e) {}
    }
    Object.assign(workObj, updates || {});
    return rest + (Object.keys(workObj).length > 0 ? '|work:' + JSON.stringify(workObj) : '');
  }

  loadSampleFile(): void {
    this.isLoading.set(true);
    this.uploadedFileName.set('My_Applications_List.xlsx');
    this.http.get('assets/sampleFiles/My_Applications_List.xlsx', { responseType: 'arraybuffer' })
      .subscribe({
        next: (buf: ArrayBuffer) => {
          this.processExcelArrayBuffer(new Uint8Array(buf), 'My_Applications_List.xlsx');
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toastService.error('Failed to load sample Excel file.');
          console.error(err);
        }
      });
  }

  processExcelFile(file: File): void {
    this.isLoading.set(true);
    this.uploadedFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.processExcelArrayBuffer(new Uint8Array(e.target.result), file.name);
    };
    reader.onerror = () => {
      this.isLoading.set(false);
      this.toastService.error('Failed to read the uploaded Excel file.');
    };
    reader.readAsArrayBuffer(file);
  }

  processExcelArrayBuffer(data: Uint8Array, fileName: string): void {
    this.isLoading.set(true);
    this.uploadedFileName.set(fileName);

    // If existing records aren't loaded or passed, query backend to ensure complete reconciliation
    if (!this.existingCustomers || this.existingCustomers.length === 0) {
      this.http.get<any>('/api/get?table=installments').subscribe({
        next: (res) => {
          const list: InstallmentRow[] = Array.isArray(res) ? res : (res?.data || res?.value || []);
          this.existingCustomers = list.map(r => this.hydrateRowWithWorkMeta(r));
          this.executeAnalysis(data);
        },
        error: (err) => {
          console.error('Failed to load DB installments:', err);
          this.executeAnalysis(data);
        }
      });
    } else {
      this.existingCustomers = this.existingCustomers.map(r => this.hydrateRowWithWorkMeta(r));
      this.executeAnalysis(data);
    }
  }

  private executeAnalysis(data: Uint8Array): void {
    try {
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData || jsonData.length === 0) {
        this.toastService.error('The Excel file contains no data.');
        this.isLoading.set(false);
        return;
      }

      // Map columns case-insensitively using legacy exact match rules
      const sampleRow = jsonData[0];
      const keys = Object.keys(sampleRow);

      const nameKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'consumer name' || lk === 'name' || lk === 'customer name' || lk === 'consumername';
      });

      const consumerNoKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'consumer no' || lk === 'consumer no.' || lk === 'consumer number' || lk === 'consumer_no' || lk === 'consumerno' || lk === 'consumer id' || lk === 'consumerid' || lk === 'account no' || lk === 'ca no' || lk === 'consumer #' || lk === 'consumer_id' || lk === 'c.a. no' || lk === 'cano';
      });

      const mobileKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'mobile no.' || lk === 'mobile no' || lk === 'mobile' || lk === 'mobile number' || lk === 'phone' || lk === 'phonenumber' || lk === 'mobileno';
      });

      const districtKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'district' || lk === 'dist';
      });

      const brokerKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'broker' || lk === 'partner' || lk === 'broker name' || lk === 'partner name' || lk === 'broker/partner name';
      });

      const addressKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'address' || lk === 'full address' || lk === 'location';
      });

      const loginDateKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return lk === 'submitted on' || lk === 'submitted_on' || lk === 'submitted date' || lk === 'submission date' || lk === 'submission on' || lk === 'login date' || lk === 'logindate' || lk === 'login_date' || lk === 'application date' || lk === 'applied on' || lk === 'submission_date';
      });

      const subDivisionKey = keys.find(k => {
        const lk = k.toLowerCase().replace(/[\s\-_]/g, '').trim();
        return lk === 'subdivision' || lk === 'subdivisionname' || lk === 'subdiv';
      });

      const divisionKey = keys.find(k => {
        const lk = k.toLowerCase().replace(/[\s\-_]/g, '').trim();
        return (lk === 'divisionname' || lk === 'division' || lk === 'divname' || lk === 'discomdivision') && !lk.includes('sub');
      });

      const circleKey = keys.find(k => {
        const lk = k.toLowerCase().replace(/[\s\-_]/g, '').trim();
        return lk === 'circlename' || lk === 'circle' || lk === 'discomcircle';
      });

      const applicationNoKey = keys.find(k => {
        const lk = k.toLowerCase().replace(/[\s\-_.]/g, '').trim();
        return lk === 'applicationnumber' || lk === 'applicationno' || lk === 'applicationid' || lk === 'applno' || lk === 'appno' || lk === 'application' || lk === 'referenceno' || lk === 'referencenumber' || lk === 'refno';
      });

      const proposedCapacityKey = keys.find(k => {
        const raw = k.toLowerCase().trim();
        const lk = raw.replace(/[\s\-_.]/g, '');
        return lk.includes('proposedcapacity') || lk.includes('plantcapacity') || lk.includes('solarcapacity') || lk === 'capacity' || lk.startsWith('capacity(') || lk.startsWith('capacitykw') || lk === 'requestedload' || lk === 'sanctionedload' || lk === 'proposedload' || (lk.includes('capacity') && !lk.includes('battery'));
      });

      const pinKey = keys.find(k => {
        const lk = k.toLowerCase().replace(/[\s\-_.]/g, '').trim();
        return lk === 'pin' || lk === 'pincode' || lk === 'postalcode' || lk === 'zip' || lk === 'zipcode';
      });

      if (!nameKey) {
        this.toastService.error('Invalid format! Could not find "Consumer Name" or "Name" column.');
        this.isLoading.set(false);
        return;
      }

      // Analyze rows against existing database records
      const existingRecords = this.existingCustomers || [];
      const seenNamesInExcel = new Set<string>();
      const excelNamesSet = new Set<string>();

      this.newCustomers = [];
      this.conflictingCustomers = [];
      this.missingCustomers = [];
      this.identicalCount = 0;

      const norm = (v: any) => (v ? String(v).trim().toLowerCase() : '');

      jsonData.forEach((row: any) => {
        const rawName = String(row[nameKey] || '').trim();
        if (!rawName) return;

        const rawConsumerNo = consumerNoKey ? String(row[consumerNoKey] || '').trim() : '';
        const rawMobile = mobileKey ? String(row[mobileKey] || '').trim() : '';
        const rawDistrict = districtKey ? String(row[districtKey] || '').trim() : '';
        const rawBroker = brokerKey ? String(row[brokerKey] || '').trim() : '';
        const rawAddress = addressKey ? String(row[addressKey] || '').trim() : '';
        const rawLoginDate = loginDateKey ? this.parseExcelDate(row[loginDateKey]) : '';
        const rawSubDivision = subDivisionKey ? String(row[subDivisionKey] || '').trim() : '';
        const rawDivision = divisionKey ? String(row[divisionKey] || '').trim() : '';
        const rawCircle = circleKey ? String(row[circleKey] || '').trim() : '';
        const rawApplicationNo = applicationNoKey ? String(row[applicationNoKey] || '').trim() : '';
        const rawProposedCapacity = proposedCapacityKey ? String(row[proposedCapacityKey] || '').trim() : '';
        const rawPin = pinKey ? String(row[pinKey] || '').trim() : '';

        const cleanNameVal = this.cleanName(rawName);
        excelNamesSet.add(cleanNameVal);

        // Check if already in database by Name
        const gridMatch = existingRecords.find(r => this.cleanName(r.Name || '') === cleanNameVal);

        if (gridMatch) {
          const cNoDiff = norm(gridMatch.ConsumerNo) !== norm(rawConsumerNo) && Boolean(rawConsumerNo);
          const mobDiff = norm(gridMatch.MobileNumber) !== norm(rawMobile) && Boolean(rawMobile);
          const distDiff = norm(gridMatch.District) !== norm(rawDistrict) && Boolean(rawDistrict);
          const brokerDiff = norm(gridMatch.BrokerName) !== norm(rawBroker) && Boolean(rawBroker);
          const addrDiff = norm(gridMatch.Address) !== norm(rawAddress) && Boolean(rawAddress);
          const loginDiff = rawLoginDate && gridMatch.LoginDate && norm(gridMatch.LoginDate) !== norm(rawLoginDate);
          const subDivDiff = norm(gridMatch.SubDivision) !== norm(rawSubDivision) && Boolean(rawSubDivision);
          const divDiff = norm(gridMatch.DivisionName) !== norm(rawDivision) && Boolean(rawDivision);
          const circleDiff = norm(gridMatch.CircleName) !== norm(rawCircle) && Boolean(rawCircle);
          const appNoDiff = norm(gridMatch.ApplicationNumber) !== norm(rawApplicationNo) && Boolean(rawApplicationNo);
          
          const capA = parseFloat(gridMatch.ProposedCapacity || '');
          const capB = parseFloat(rawProposedCapacity);
          const capDiff = (!isNaN(capA) && !isNaN(capB)) 
            ? capA !== capB && Boolean(rawProposedCapacity)
            : norm(gridMatch.ProposedCapacity) !== norm(rawProposedCapacity) && Boolean(rawProposedCapacity);

          const hasDifferences = cNoDiff || mobDiff || distDiff || brokerDiff || addrDiff || Boolean(loginDiff) || subDivDiff || divDiff || circleDiff || appNoDiff || capDiff;

          if (!hasDifferences) {
            this.identicalCount++;
          } else {
            this.conflictingCustomers.push({
              SlNo: gridMatch.SlNo,
              Name: gridMatch.Name || rawName,
              GridData: {
                ConsumerNo: gridMatch.ConsumerNo || '',
                ApplicationNumber: gridMatch.ApplicationNumber || '',
                ProposedCapacity: gridMatch.ProposedCapacity || '',
                SubDivision: gridMatch.SubDivision || '',
                DivisionName: gridMatch.DivisionName || '',
                CircleName: gridMatch.CircleName || '',
                MobileNumber: gridMatch.MobileNumber || '',
                District: gridMatch.District || '',
                BrokerName: gridMatch.BrokerName || '',
                Address: gridMatch.Address || '',
                LoginDate: gridMatch.LoginDate || ''
              },
              ExcelData: {
                ConsumerNo: rawConsumerNo || gridMatch.ConsumerNo || '',
                ApplicationNumber: rawApplicationNo || gridMatch.ApplicationNumber || '',
                ProposedCapacity: rawProposedCapacity || gridMatch.ProposedCapacity || '',
                SubDivision: rawSubDivision || gridMatch.SubDivision || '',
                DivisionName: rawDivision || gridMatch.DivisionName || '',
                CircleName: rawCircle || gridMatch.CircleName || '',
                MobileNumber: rawMobile || gridMatch.MobileNumber || '',
                District: rawDistrict || gridMatch.District || '',
                BrokerName: rawBroker || gridMatch.BrokerName || '',
                Address: rawAddress || gridMatch.Address || '',
                LoginDate: rawLoginDate || gridMatch.LoginDate || ''
              },
              Diffs: {
                ConsumerNo: cNoDiff,
                ApplicationNumber: appNoDiff,
                ProposedCapacity: capDiff,
                SubDivision: subDivDiff,
                DivisionName: divDiff,
                CircleName: circleDiff,
                MobileNumber: mobDiff,
                District: distDiff,
                BrokerName: brokerDiff,
                Address: addrDiff,
                LoginDate: Boolean(loginDiff)
              },
              SelectedChoice: 'EXCEL'
            });
          }
        } 
        else if (seenNamesInExcel.has(cleanNameVal)) {
          this.newCustomers.push({
            Name: rawName,
            ConsumerNo: rawConsumerNo,
            ApplicationNumber: rawApplicationNo,
            ProposedCapacity: rawProposedCapacity,
            SubDivision: rawSubDivision,
            DivisionName: rawDivision,
            CircleName: rawCircle,
            MobileNumber: rawMobile,
            District: rawDistrict,
            BrokerName: rawBroker,
            Address: rawAddress ? rawAddress.toUpperCase() : '',
            PinCode: rawPin,
            Pin: rawPin,
            LoginDate: rawLoginDate || new Date().toISOString().slice(0, 10),
            Status: 'Duplicate (In Excel)',
            IsDuplicate: true,
            selected: false
          });
        } else {
          seenNamesInExcel.add(cleanNameVal);
          this.newCustomers.push({
            Name: rawName,
            ConsumerNo: rawConsumerNo,
            ApplicationNumber: rawApplicationNo,
            ProposedCapacity: rawProposedCapacity,
            SubDivision: rawSubDivision,
            DivisionName: rawDivision,
            CircleName: rawCircle,
            MobileNumber: rawMobile,
            District: rawDistrict,
            BrokerName: rawBroker,
            Address: rawAddress ? rawAddress.toUpperCase() : '',
            PinCode: rawPin,
            Pin: rawPin,
            LoginDate: rawLoginDate || new Date().toISOString().slice(0, 10),
            Status: 'New Name',
            IsDuplicate: false,
            selected: true
          });
        }
      });

      // Find grid records missing in the Excel file
      existingRecords.forEach(r => {
        const cleanGridName = this.cleanName(r.Name || '');
        if (!excelNamesSet.has(cleanGridName)) {
          this.missingCustomers.push({
            SlNo: Number(r.SlNo) || 0,
            Name: r.Name || '',
            ConsumerNo: r.ConsumerNo || '',
            ApplicationNumber: r.ApplicationNumber || '',
            ProposedCapacity: r.ProposedCapacity || '',
            SubDivision: r.SubDivision || '',
            DivisionName: r.DivisionName || '',
            CircleName: r.CircleName || '',
            MobileNumber: r.MobileNumber || '',
            District: r.District || '',
            BrokerName: r.BrokerName || '',
            LoginDate: r.LoginDate || '',
            Status: 'Missing in Excel'
          });
        }
      });

      this.parsedFileLoaded.set(true);
      this.toastService.success(`Excel analyzed: ${this.summary.newCount} new, ${this.summary.conflictCount} diffs, ${this.identicalCount} identical, ${this.summary.missingCount} missing.`);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      this.toastService.error('Error reading Excel: ' + (err.message || 'Invalid format'));
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleSelectAllNew(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllNew = checked;
    this.newCustomers.forEach(c => {
      if (!c.IsDuplicate) c.selected = checked;
    });
  }

  bulkSelectConflictChoice(choice: 'EXCEL' | 'GRID'): void {
    this.conflictingCustomers.forEach(c => c.SelectedChoice = choice);
  }

  setConflictChoice(item: ConflictingCustomerItem, choice: 'EXCEL' | 'GRID'): void {
    item.SelectedChoice = choice;
  }

  downloadTxtReport(): void {
    let txt = '======================================================================\n';
    txt += `SOLARTRACK CUSTOMER IMPORT RECONCILIATION REPORT\n`;
    txt += `File: ${this.uploadedFileName()} | Generated: ${new Date().toLocaleString()}\n`;
    txt += `Summary: New Customers: ${this.summary.newCount} | Data Differences: ${this.summary.conflictCount} | Identical: ${this.summary.identicalCount} | Missing in Excel: ${this.summary.missingCount}\n`;
    txt += '======================================================================\n\n';

    txt += 'SECTION 1: DATA DIFFERENCES (CONFLICTS)\n';
    txt += '----------------------------------------------------------------------\n';
    if (this.conflictingCustomers.length === 0) {
      txt += 'None.\n';
    } else {
      this.conflictingCustomers.forEach((c, idx) => {
        txt += `${idx + 1}. Customer: ${c.Name} (Sl. #${c.SlNo}) [Chosen: ${c.SelectedChoice}]\n`;
        txt += `   Excel Data: ConsNo=${c.ExcelData.ConsumerNo}, ApplNo=${c.ExcelData.ApplicationNumber}, Cap=${c.ExcelData.ProposedCapacity}, SubDiv=${c.ExcelData.SubDivision}, Div=${c.ExcelData.DivisionName}, Mob=${c.ExcelData.MobileNumber}, Dist=${c.ExcelData.District}, Partner=${c.ExcelData.BrokerName}, Date=${c.ExcelData.LoginDate}\n`;
        txt += `   Grid Data:  ConsNo=${c.GridData.ConsumerNo}, ApplNo=${c.GridData.ApplicationNumber}, Cap=${c.GridData.ProposedCapacity}, SubDiv=${c.GridData.SubDivision}, Div=${c.GridData.DivisionName}, Mob=${c.GridData.MobileNumber}, Dist=${c.GridData.District}, Partner=${c.GridData.BrokerName}, Date=${c.GridData.LoginDate}\n\n`;
      });
    }

    txt += '\nSECTION 2: NEW CUSTOMERS TO ADD\n';
    txt += '----------------------------------------------------------------------\n';
    const activeNew = this.newCustomers.filter(c => !c.IsDuplicate);
    if (activeNew.length === 0) {
      txt += 'None.\n';
    } else {
      activeNew.forEach((c, idx) => {
        txt += `${idx + 1}. Name: ${c.Name} | ConsumerNo: ${c.ConsumerNo} | District: ${c.District} | Capacity: ${c.ProposedCapacity}\n`;
      });
    }

    txt += '\nSECTION 3: GRID RECORDS MISSING IN EXCEL FILE\n';
    txt += '----------------------------------------------------------------------\n';
    if (this.missingCustomers.length === 0) {
      txt += 'None.\n';
    } else {
      this.missingCustomers.forEach((c, idx) => {
        txt += `${idx + 1}. Name: ${c.Name} | ConsumerNo: ${c.ConsumerNo || '—'} | ApplNo: ${c.ApplicationNumber || '—'} | Capacity: ${c.ProposedCapacity || '—'} | District: ${c.District || '—'} | Mobile: ${c.MobileNumber || '—'} | LoginDate: ${c.LoginDate || '—'}\n`;
      });
    }

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Import_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toastService.success('Report downloaded.');
  }

  saveToDatabase(): void {
    const selectedNew = this.newCustomers.filter(c => c.selected && !c.IsDuplicate);
    const selectedExcelUpdates = this.conflictingCustomers.filter(c => c.SelectedChoice === 'EXCEL');

    if (selectedNew.length === 0 && selectedExcelUpdates.length === 0) {
      this.toastService.warning('No changes or new customers selected to save.');
      return;
    }

    this.isSaving.set(true);
    const requests: any[] = [];

    // 1. Insert New Customers
    selectedNew.forEach(c => {
      const workMeta = {
        SubDivision: c.SubDivision || '',
        DivisionName: c.DivisionName || '',
        CircleName: c.CircleName || '',
        ApplicationNumber: c.ApplicationNumber || '',
        ProposedCapacity: c.ProposedCapacity || ''
      };
      const brokerNum = this.formatBrokerNumberWithWorkMeta('', workMeta);

      const payload = {
        Name: c.Name,
        ConsumerNo: c.ConsumerNo || '',
        ApplicationNumber: c.ApplicationNumber || '',
        ProposedCapacity: c.ProposedCapacity || '',
        CircleName: c.CircleName || '',
        DivisionName: c.DivisionName || '',
        SubDivision: c.SubDivision || '',
        MobileNumber: c.MobileNumber || '',
        Status: 'Active',
        District: c.District || '',
        Address: (c.Address || '').toUpperCase(),
        PinCode: c.PinCode || c.Pin || '',
        CommittedBrand: '',
        FirstInstallment: 0,
        SecondInstallment: 0,
        ThirdInstallment: 0,
        Total: 0,
        CommittedPrice: 0,
        VendorPrice: 0,
        VendorPaid: 0,
        LoginDate: c.LoginDate || new Date().toISOString().slice(0, 10),
        InstallationDate: null,
        BrokerName: c.BrokerName || '',
        BrokerNumber: brokerNum,
        Commission: 0,
        CommissionPaid: 0,
        CommissioningDate: ''
      };
      requests.push(this.http.post('/api/insert?table=installments', payload));
    });

    // 2. Update Conflicting Customers where Excel Data was chosen
    selectedExcelUpdates.forEach(c => {
      const existingRow = this.existingCustomers.find(r => Number(r.SlNo) === Number(c.SlNo));
      const currentBrokerNumber = existingRow?.BrokerNumber || '';
      const workMetaUpdates = {
        SubDivision: c.ExcelData.SubDivision || '',
        DivisionName: c.ExcelData.DivisionName || '',
        CircleName: c.ExcelData.CircleName || '',
        ApplicationNumber: c.ExcelData.ApplicationNumber || '',
        ProposedCapacity: c.ExcelData.ProposedCapacity || ''
      };
      const newBrokerNum = this.formatBrokerNumberWithWorkMeta(currentBrokerNumber, workMetaUpdates);

      const updatePayload = {
        ConsumerNo: c.ExcelData.ConsumerNo,
        ApplicationNumber: c.ExcelData.ApplicationNumber,
        ProposedCapacity: c.ExcelData.ProposedCapacity,
        CircleName: c.ExcelData.CircleName,
        DivisionName: c.ExcelData.DivisionName,
        SubDivision: c.ExcelData.SubDivision,
        MobileNumber: c.ExcelData.MobileNumber,
        District: c.ExcelData.District,
        BrokerName: c.ExcelData.BrokerName,
        Address: (c.ExcelData.Address || '').toUpperCase(),
        LoginDate: c.ExcelData.LoginDate,
        BrokerNumber: newBrokerNum
      };
      requests.push(this.http.post(`/api/update?table=installments&matchField=SlNo&matchValue=${c.SlNo}`, updatePayload));
    });

    forkJoin(requests.length > 0 ? requests : [of(true)]).subscribe({
      next: () => {
        // Refresh summary service signals to re-sync everywhere
        this.summaryService.loadAllData().subscribe(() => {
          this.isSaving.set(false);
          this.toastService.success(`Saved successfully: ${selectedNew.length} new customer(s) added, ${selectedExcelUpdates.length} existing customer(s) updated.`);
          this.closeModal();
          this.importCompleted.emit();
        });
      },
      error: (err) => {
        console.error('Save error:', err);
        this.isSaving.set(false);
        this.toastService.error('Error saving imported records: ' + (err.message || 'Server error'));
      }
    });
  }

  closeModal(): void {
    this.parsedFileLoaded.set(false);
    this.uploadedFileName.set('');
    this.newCustomers = [];
    this.conflictingCustomers = [];
    this.missingCustomers = [];
    this.close.emit();
  }
}
