import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilesService } from './services/files.service';
import { NavService } from '../../core/services/nav.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { FileItem } from './models/file-item.model';

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  filesService = inject(FilesService);
  navService = inject(NavService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmDialogService);

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

  getFileUrl(file: FileItem): string {
    return `/files/${encodeURIComponent(file.storedFileName || file.originalName)}`;
  }

  getFileDownloadUrl(file: FileItem): string {
    return `/files/${encodeURIComponent(file.storedFileName || file.originalName)}?download=1&name=${encodeURIComponent(file.originalName)}`;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.filesService.uploadFile(file).subscribe({
        next: () => {
          input.value = '';
          this.toastService.success(`"${file.name}" uploaded successfully!`);
        },
        error: () => this.toastService.error('Failed to upload file.')
      });
    }
  }

  async onDeleteFile(file: FileItem): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Document',
      message: `Are you sure you want to permanently delete "${file.originalName}"?`,
      confirmText: 'Delete',
      isDanger: true
    });

    if (confirmed) {
      this.filesService.deleteFile(file).subscribe({
        next: () => this.toastService.success(`"${file.originalName}" deleted.`),
        error: () => this.toastService.error('Failed to delete file.')
      });
    }
  }
}
