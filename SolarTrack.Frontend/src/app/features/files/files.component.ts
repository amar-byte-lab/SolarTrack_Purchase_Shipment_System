import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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

  // Preview Modal State
  previewFile: FileItem | null = null;

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
    return `/files/${encodeURIComponent(file.storedFileName || file.fileName || file.originalName || '')}`;
  }

  getFileDownloadUrl(file: FileItem): string {
    const displayName = this.getDisplayName(file);
    return `/files/${encodeURIComponent(file.storedFileName || displayName)}?download=1&name=${encodeURIComponent(displayName)}`;
  }

  // --- Preview Logic ---
  openPreview(file: FileItem): void {
    this.previewFile = file;
  }

  closePreview(): void {
    this.previewFile = null;
  }

  getSafePreviewUrl(file: FileItem): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.getFileUrl(file));
  }

  getFileExt(file: FileItem): string {
    const name = file.storedFileName || file.fileName || file.originalName || '';
    const idx = name.lastIndexOf('.');
    return idx !== -1 ? name.slice(idx).toLowerCase() : '';
  }

  isImage(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext);
  }

  isPdf(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ext === '.pdf';
  }

  isPreviewable(file: FileItem): boolean {
    const ext = (file.ext || this.getFileExt(file)).toLowerCase();
    return ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.txt', '.json', '.csv', '.log'].includes(ext);
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
