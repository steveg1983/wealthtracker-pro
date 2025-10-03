import type { Document, DocumentUploadOptions } from './documentService';

export interface UploadState {
  selectedFiles: File[];
  uploadProgress: Record<string, number>;
  uploadedDocs: Document[];
  errors: Record<string, string>;
}

export interface DocumentOptions {
  type: Document['type'];
  tags: string[];
  notes: string;
  extractData: boolean;
}

/**
 * Service for document upload operations
 */
export class DocumentUploadService {
  /**
   * Supported file types
   */
  static readonly SUPPORTED_FILE_TYPES = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx';
  static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Get initial document options
   */
  static getInitialOptions(): DocumentOptions {
    return {
      type: 'receipt',
      tags: [],
      notes: '',
      extractData: true
    };
  }

  /**
   * Check if camera is supported
   */
  static checkCameraSupport(): boolean {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const hasMediaDevices = typeof navigator !== 'undefined' && 
                           'mediaDevices' in navigator;
    return isMobile || hasMediaDevices;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  }

  /**
   * Get icon type for file
   */
  static getFileIconType(mimeType: string): 'image' | 'pdf' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'document';
  }

  /**
   * Validate file
   */
  static validateFile(file: File): string | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return `File ${file.name} exceeds 10MB limit`;
    }
    
    const validTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }
    
    return null;
  }

  /**
   * Handle file drop
   */
  static handleFileDrop(event: React.DragEvent): File[] {
    event.preventDefault();
    return Array.from(event.dataTransfer.files);
  }

  /**
   * Handle drag over
   */
  static handleDragOver(event: React.DragEvent): void {
    event.preventDefault();
  }

  /**
   * Create upload options
   */
  static createUploadOptions(
    options: DocumentOptions,
    transactionId?: string,
    accountId?: string
  ): DocumentUploadOptions {
    return {
      transactionId,
      accountId,
      type: options.type,
      tags: options.tags,
      notes: options.notes,
      extractData: options.extractData
    };
  }

  /**
   * Simulate upload progress
   */
  static simulateProgress(
    fileName: string,
    onProgress: (fileName: string, progress: number) => void
  ): NodeJS.Timeout {
    let progress = 0;
    return setInterval(() => {
      progress = Math.min(progress + 10, 90);
      onProgress(fileName, progress);
    }, 100);
  }

  /**
   * Process tag input
   */
  static processTagInput(tagInput: string, existingTags: string[]): string[] {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !existingTags.includes(trimmedTag)) {
      return [...existingTags, trimmedTag];
    }
    return existingTags;
  }

  /**
   * Get document type options
   */
  static getDocumentTypes(): Array<{ value: Document['type']; label: string }> {
    return [
      { value: 'receipt', label: 'Receipt' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'statement', label: 'Statement' },
      { value: 'contract', label: 'Contract' },
      { value: 'other', label: 'Other' }
    ];
  }
}