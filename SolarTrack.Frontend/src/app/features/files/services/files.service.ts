import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, map, catchError } from 'rxjs';
import { FileItem } from '../models/file-item.model';

@Injectable({
  providedIn: 'root'
})
export class FilesService {
  files = signal<FileItem[]>([]);
  searchQuery = signal<string>('');
  fromDate = signal<string>('');
  toDate = signal<string>('');
  isLoading = signal<boolean>(false);
  isUploading = signal<boolean>(false);

  filteredFiles = computed(() => {
    let list = this.files();
    const query = this.searchQuery().toLowerCase().trim();
    const from = this.fromDate();
    const to = this.toDate();

    if (query) {
      list = list.filter(f => (f.originalName || f.storedFileName || '').toLowerCase().includes(query));
    }

    if (from || to) {
      list = list.filter(f => {
        const d = (f.fileDate || f.uploadedAt || '').slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    return list;
  });

  constructor(private http: HttpClient) {}

  loadFiles(): Observable<any> {
    this.isLoading.set(true);
    return this.http.get<{ success: boolean; files: FileItem[] }>('/api/files').pipe(
      tap(res => {
        this.isLoading.set(false);
        this.files.set(res.files || []);
      })
    );
  }

  uploadFiles(files: File[], fileDate?: string): Observable<number> {
    if (!files || files.length === 0) return of(0);
    this.isUploading.set(true);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f, f.name));

    const d = fileDate || new Date().toISOString().slice(0, 10);
    const url = `/api/files/upload?fileDate=${d}`;

    return this.http.post<{ success: boolean; files?: any[]; count?: number }>(url, formData).pipe(
      tap(() => {
        this.isUploading.set(false);
        this.loadFiles().subscribe();
      }),
      map(res => res.files?.length || res.count || files.length),
      catchError(err => {
        this.isUploading.set(false);
        throw err;
      })
    );
  }

  uploadFile(file: File, fileDate?: string): Observable<any> {
    return this.uploadFiles([file], fileDate);
  }

  renameFile(file: FileItem, newFileName: string): Observable<any> {
    const payload = {
      fileId: file.id || file.fileId || '',
      storedFileName: file.storedFileName || '',
      newFileName: newFileName.trim()
    };
    return this.http.post('/api/files/rename', payload).pipe(
      tap(() => this.loadFiles().subscribe())
    );
  }

  deleteFile(file: FileItem): Observable<any> {
    const payload = {
      fileId: file.id || file.fileId || '',
      storedFileName: file.storedFileName || ''
    };
    return this.http.post('/api/files/delete', payload).pipe(
      tap(() => this.loadFiles().subscribe())
    );
  }
}
