import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import { FilesService } from './services/files.service';
import { NavService } from '../../core/services/nav.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { FileItem } from './models/file-item.model';

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  filesService = inject(FilesService);
  navService = inject(NavService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);
  private sanitizer = inject(DomSanitizer);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  // Preview Modal State
  previewFile: FileItem | null = null;
  excelSheets: { name: string; rows: any[][] }[] = [];
  activeSheetIndex: number = 0;
  isLoadingExcel: boolean = false;
  excelError: string | null = null;
  excelSearchQuery: string = '';

  isLoadingDocx: boolean = false;
  docxContent: string = '';

  // Rename Modal State
  renameFileItem: FileItem | null = null;
  newFileNameInput: string = '';
  isRenaming: boolean = false;

  ngOnInit(): void {
    this.navService.setPageTitle('Saved Files & Documents');
    this.filesService.loadFiles().subscribe({
      next: () => {},
      error: () => this.toastService.error('Failed to load files from server.')
    });
  }

  clearFilters(): void {
    this.filesService.searchQuery.set('');
    this.filesService.fromDate.set('');
    this.filesService.toDate.set('');
  }

  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getDisplayName(file: FileItem): string {
    return file.fileName || file.originalName || file.storedFileName || 'Document';
  }

  getFileUrl(file: FileItem): string {
    if (file.url && file.url.startsWith('/bills/')) return file.url;
    return `/bills/${encodeURIComponent(file.storedFileName || file.fileName || file.originalName || '')}`;
  }

  getFileDownloadUrl(file: FileItem): string {
    const displayName = this.getDisplayName(file);
    const base = this.getFileUrl(file);
    return `${base}?download=1&name=${encodeURIComponent(displayName)}`;
  }

  // --- Preview Logic ---
  openPreview(file: FileItem): void {
    this.previewFile = file;
    this.excelSheets = [];
    this.activeSheetIndex = 0;
    this.excelError = null;
    this.excelSearchQuery = '';
    this.docxContent = '';
    this.cdr.markForCheck();

    if (this.isExcel(file)) {
      this.loadExcelPreview(file);
    } else if (this.isDocx(file)) {
      this.loadDocxPreview(file);
    }
  }

  closePreview(): void {
    this.previewFile = null;
    this.excelSheets = [];
    this.docxContent = '';
    this.cdr.markForCheck();
  }

  selectSheet(index: number): void {
    this.activeSheetIndex = index;
    this.excelSearchQuery = '';
    this.cdr.markForCheck();
  }

  loadExcelPreview(file: FileItem): void {
    this.isLoadingExcel = true;
    this.excelError = null;
    this.excelSheets = [];
    this.activeSheetIndex = 0;
    this.cdr.markForCheck();

    const url = this.getFileUrl(file);

    this.http.get(url, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
        const origError = console.error;
        const origWarn = console.warn;
        try {
          console.error = (...args: any[]) => {
            if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Bad uncompressed size')) return;
            origError.apply(console, args);
          };
          console.warn = (...args: any[]) => {
            if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Bad uncompressed size')) return;
            origWarn.apply(console, args);
          };

          const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          this.excelSheets = wb.SheetNames.map(sheetName => {
            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
            return { name: sheetName, rows };
          });
          this.activeSheetIndex = 0;
          this.isLoadingExcel = false;
          this.cdr.markForCheck();
        } catch (e: any) {
          this.isLoadingExcel = false;
          this.excelError = 'Could not parse spreadsheet data: ' + (e?.message || 'Invalid format');
          this.cdr.markForCheck();
        } finally {
          console.error = origError;
          console.warn = origWarn;
        }
      },
      error: (err) => {
        this.isLoadingExcel = false;
        this.excelError = 'Failed to load spreadsheet file from server: ' + (err.statusText || err.message || 'Network error');
        this.cdr.markForCheck();
      }
    });
  }

  loadDocxPreview(file: FileItem): void {
    this.isLoadingDocx = true;
    this.docxContent = '';
    this.cdr.markForCheck();

    const url = this.getFileUrl(file);

    this.http.get(url, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
        try {
          const cfb = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' });
          const entry = XLSX.CFB.find(cfb, 'word/document.xml') || XLSX.CFB.find(cfb, '/word/document.xml');
          if (entry && entry.content) {
            const decoder = new TextDecoder('utf-8');
            const xml = typeof entry.content === 'string' ? entry.content : decoder.decode(entry.content);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'text/xml');
            const pElements = xmlDoc.getElementsByTagName('w:p');
            const paragraphs: string[] = [];
            for (let i = 0; i < pElements.length; i++) {
              const text = pElements[i].textContent || '';
              if (text.trim()) paragraphs.push(text.trim());
            }
            this.docxContent = paragraphs.join('\n\n') || 'Empty document.';
          } else {
            this.docxContent = 'Document content could not be extracted.';
          }
          this.isLoadingDocx = false;
          this.cdr.markForCheck();
        } catch (e: any) {
          this.isLoadingDocx = false;
          this.docxContent = 'Could not preview document: ' + (e?.message || 'Error parsing docx');
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isLoadingDocx = false;
        this.docxContent = 'Failed to load document from server.';
        this.cdr.markForCheck();
      }
    });
  }

  get currentSheet(): { name: string; rows: any[][] } | null {
    return this.excelSheets[this.activeSheetIndex] || null;
  }

  get hasHeader(): boolean {
    const rows = this.currentSheet?.rows;
    if (!rows || rows.length === 0) return false;
    return rows.length > 1 && rows[0].some(cell => typeof cell === 'string' && cell.trim().length > 0);
  }

  get headerRow(): any[] {
    const rows = this.currentSheet?.rows;
    if (!rows || rows.length === 0) return [];
    if (this.hasHeader) return rows[0];

    const maxCols = Math.max(...rows.map(r => (r ? r.length : 0)), 1);
    return Array.from({ length: maxCols }, (_, i) => this.getColLetter(i));
  }

  get filteredSheetRows(): any[][] {
    const rows = this.currentSheet?.rows;
    if (!rows || rows.length === 0) return [];
    const dataRows = this.hasHeader ? rows.slice(1) : rows;
    const q = this.excelSearchQuery.toLowerCase().trim();
    if (!q) return dataRows;

    return dataRows.filter(row => 
      row.some(cell => String(cell || '').toLowerCase().includes(q))
    );
  }

  getColLetter(colIdx: number): string {
    let temp = '';
    let letter = '';
    let n = colIdx;
    while (n >= 0) {
      temp = String.fromCharCode((n % 26) + 65);
      letter = temp + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  getSafePreviewUrl(file: FileItem): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.getFileUrl(file));
  }

  getFileExt(file: FileItem): string {
    const name = file.storedFileName || file.fileName || file.originalName || '';
    const idx = name.lastIndexOf('.');
    return idx !== -1 ? name.slice(idx).toLowerCase() : '';
  }

  isExcel(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ['.xlsx', '.xls', '.csv', '.tsv', '.ods'].includes(ext);
  }

  isImage(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'].includes(ext);
  }

  isPdf(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ext === '.pdf';
  }

  isText(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ['.txt', '.log', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.md', '.sql', '.yaml', '.yml'].includes(ext);
  }

  isDocx(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ext === '.docx' || ext === '.doc';
  }

  isPreviewable(file: FileItem): boolean {
    return this.isExcel(file) || this.isImage(file) || this.isPdf(file) || this.isText(file) || this.isDocx(file);
  }

  // --- Rename Logic ---
  openRename(file: FileItem): void {
    this.renameFileItem = file;
    this.newFileNameInput = this.getDisplayName(file);
  }

  closeRename(): void {
    this.renameFileItem = null;
    this.newFileNameInput = '';
    this.isRenaming = false;
  }

  saveRename(): void {
    if (!this.renameFileItem || !this.newFileNameInput.trim()) return;

    this.isRenaming = true;
    this.filesService.renameFile(this.renameFileItem, this.newFileNameInput.trim()).subscribe({
      next: () => {
        this.toastService.success('File renamed successfully.');
        this.closeRename();
      },
      error: (err) => {
        this.isRenaming = false;
        this.toastService.error('Failed to rename file: ' + (err.error?.error || err.message || 'Server error'));
      }
    });
  }

  // --- File Upload ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const fileList = Array.from(input.files);
      input.value = '';

      this.filesService.uploadFiles(fileList).subscribe({
        next: (count) => {
          if (fileList.length === 1) {
            this.toastService.success(`"${fileList[0].name}" uploaded successfully!`);
          } else {
            this.toastService.success(`${count} files uploaded successfully!`);
          }
        },
        error: () => this.toastService.error('Failed to upload files.')
      });
    }
  }

  // --- Delete File ---
  async onDeleteFile(file: FileItem): Promise<void> {
    const displayName = this.getDisplayName(file);
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Document',
      message: `Are you sure you want to permanently delete "${displayName}"?`,
      confirmText: 'Delete',
      isDanger: true
    });

    if (confirmed) {
      this.filesService.deleteFile(file).subscribe({
        next: () => this.toastService.success(`"${displayName}" deleted.`),
        error: () => this.toastService.error('Failed to delete file.')
      });
    }
  }
}
