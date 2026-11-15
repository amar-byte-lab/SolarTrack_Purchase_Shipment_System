import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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

  uploadFile(file: File, fileDate?: string): Observable<any> {
    this.isUploading.set(true);
    const formData = new FormData();
    formData.append('file', file);

    const d = fileDate || new Date().toISOString().slice(0, 10);
    const url = `/api/files/upload?originalName=${encodeURIComponent(file.name)}&fileDate=${d}`;

    return this.http.post(url, formData).pipe(
      tap(() => {
        this.isUploading.set(false);
        this.loadFiles().subscribe();
      })
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
