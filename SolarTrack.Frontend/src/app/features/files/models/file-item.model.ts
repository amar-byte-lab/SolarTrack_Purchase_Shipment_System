export interface FileItem {
  id?: string;
  fileId?: string;
  fileName?: string;
  originalName?: string;
  storedFileName: string;
  fileDate?: string;
  fileSize?: number;
  size?: number;
  fileSizeFormatted?: string;
  fileType?: string;
  ext?: string;
  uploadedAt?: string;
  uploadDate?: string;
  url?: string;
}
