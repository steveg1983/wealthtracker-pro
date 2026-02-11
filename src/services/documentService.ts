import { performOCR } from './ocrService';
import { indexedDBService, migrateFromLocalStorage } from './indexedDBService';

interface SavedDocument extends Omit<Document, 'uploadDate' | 'expiryDate' | 'extractedData'> {
  uploadDate: string;
  expiryDate?: string;
  extractedData?: {
    merchant?: string;
    date?: string;
    totalAmount?: number;
    taxAmount?: number;
    currency?: string;
    items?: ExtractedItem[];
    confidence?: number;
    rawText?: string;
    paymentMethod?: string;
  };
}

export interface Document {
  id: string;
  transactionId?: string; // Optional - documents can be attached to transactions
  accountId?: string; // Optional - documents can be attached to accounts
  type: 'receipt' | 'invoice' | 'statement' | 'contract' | 'other';
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: Date;
  expiryDate?: Date; // For contracts, warranties, etc.
  tags: string[];
  notes?: string;
  extractedData?: ExtractedData; // OCR results
  thumbnailUrl?: string;
  fullUrl: string;
  cloudProvider?: 'local' | 'dropbox' | 'google-drive' | 'onedrive';
  cloudId?: string; // ID in the cloud storage provider
}

export interface ExtractedData {
  merchant?: string;
  date?: Date;
  amount?: number;
  currency?: string;
  items?: ExtractedItem[];
  taxAmount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  confidence: number; // 0-1 confidence score
  rawText?: string;
  error?: string; // Error message if extraction failed
}

export interface ExtractedItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  category?: string;
}

export interface DocumentUploadOptions {
  transactionId?: string;
  accountId?: string;
  type: Document['type'];
  tags?: string[];
  notes?: string;
  extractData?: boolean; // Whether to run OCR
}

export interface DocumentFilter {
  transactionId?: string;
  accountId?: string;
  type?: Document['type'];
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Logger = Pick<Console, 'error' | 'warn' | 'log'>;
type IndexedDBLike = typeof indexedDBService;
type MigrateFn = typeof migrateFromLocalStorage;

export interface DocumentServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  dbService?: IndexedDBLike;
  migrateFn?: MigrateFn;
  now?: () => Date;
  idGenerator?: () => string;
}

export class DocumentService {
  private initialized = false;
  private storageKey = 'wealthtracker_documents';
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;
  private readonly dbService: IndexedDBLike;
  private readonly migrateFn: MigrateFn;
  private readonly nowProvider: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: DocumentServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {})),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? (() => {})),
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? (() => {}))
    };
    this.dbService = options.dbService ?? indexedDBService;
    this.migrateFn = options.migrateFn ?? migrateFromLocalStorage;
    this.nowProvider = options.now ?? (() => new Date());
    this.idGenerator =
      options.idGenerator ??
      (() => `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.init();
  }

  private async init() {
    try {
      await this.dbService.init();
      await this.migrateDocuments();
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize document service:', error as Error);
      // Fallback to localStorage if IndexedDB fails
    }
  }

  private async migrateDocuments() {
    // Check if we have documents in localStorage that need migration
    const stored = this.storage?.getItem(this.storageKey);
    if (stored) {
      await this.migrateFn<Document>(this.storageKey, 'documents', (doc) => ({
        ...doc,
        uploadDate: new Date(doc.uploadDate),
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
        extractedData: doc.extractedData
          ? {
            ...doc.extractedData,
            date: doc.extractedData.date ? new Date(doc.extractedData.date) : undefined
          }
          : undefined
      }));
      
      // Clear localStorage after successful migration
      const count = await this.dbService.count('documents');
      if (count > 0) {
        this.storage?.removeItem(this.storageKey);
        this.logger.log('Documents migrated to IndexedDB');
      }
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  private async loadDocuments(): Promise<Document[]> {
    try {
      await this.ensureInitialized();
      return await this.dbService.getAll<Document>('documents');
    } catch (error) {
      this.logger.error('Failed to load documents from IndexedDB:', error as Error);
      // Fallback to localStorage
      try {
        const stored = this.storage?.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.map((doc: SavedDocument) => ({
            ...doc,
            uploadDate: new Date(doc.uploadDate),
            expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
            extractedData: doc.extractedData ? {
              ...doc.extractedData,
              date: doc.extractedData.date ? new Date(doc.extractedData.date) : undefined
            } : undefined
          }));
        }
      } catch (err) {
        this.logger.error('Failed to load documents from localStorage:', err as Error);
      }
      return [];
    }
  }

  private async saveDocument(document: Document): Promise<void> {
    try {
      await this.ensureInitialized();
      // Serialize document for IndexedDB storage (convert Dates to strings)
      const serialized = { ...document, uploadDate: document.uploadDate.toISOString(), expiryDate: document.expiryDate?.toISOString() };
      await this.dbService.put('documents', serialized as Record<string, unknown>);
    } catch (error) {
      this.logger.error('Failed to save document to IndexedDB:', error as Error);
      // Fallback: Keep in memory only, don't save to localStorage
      throw new Error('Failed to save document');
    }
  }

  async uploadDocument(file: File, options: DocumentUploadOptions): Promise<Document> {
    try {
      // Validate file
      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      if (!this.allowedMimeTypes.includes(file.type)) {
        throw new Error('File type not supported');
      }

      await this.ensureInitialized();

      // Create document object
      const documentId = this.idGenerator();
      const uploadTimestamp = this.nowProvider();
      const document: Document = {
        id: documentId,
        transactionId: options.transactionId,
        accountId: options.accountId,
        type: options.type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadDate: uploadTimestamp,
        tags: options.tags || [],
        notes: options.notes,
        fullUrl: documentId, // Reference to blob storage
        cloudProvider: 'local'
      };

      // Store the file as a blob in IndexedDB
      await indexedDBService.storeBlob(documentId, file);
      
      // Generate thumbnail for images
      if (file.type.startsWith('image/')) {
        const thumbnailBlob = await this.generateThumbnailBlob(file);
        if (thumbnailBlob) {
          const thumbnailId = `${documentId}-thumb`;
          await indexedDBService.storeBlob(thumbnailId, thumbnailBlob);
          document.thumbnailUrl = thumbnailId;
        }
      }

      // Extract data if requested
      if (options.extractData && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          document.extractedData = await this.extractDataFromDocument(file);
        } catch (error) {
          this.logger.error('OCR extraction failed:', error as Error);
          // Continue without extracted data
        }
      }

      // Save document metadata
      await this.saveDocument(document);

      return document;
    } catch (error) {
      this.logger.error('Failed to upload document:', error as Error);
      throw error;
    }
  }

  async extractDataFromDocument(file: File): Promise<ExtractedData> {
    // Use the OCR service for real extraction
    return await performOCR(file);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  private async generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        // Calculate thumbnail dimensions (max 200px)
        const maxSize = 200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  private async generateThumbnailBlob(file: File): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        try {
          // Calculate thumbnail dimensions (max 200px)
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.7);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => resolve(null);
      const url = URL.createObjectURL(file);
      img.src = url;
      // Clean up the object URL after loading
      img.onload = function() {
        URL.revokeObjectURL(url);
      };
    });
  }

  async getDocument(documentId: string): Promise<Document | null> {
    try {
      await this.ensureInitialized();
      const doc = await this.dbService.get<Document>('documents', documentId);
      return doc ?? null;
    } catch (error) {
      this.logger.error('Failed to get document:', error as Error);
      return null;
    }
  }

  async getDocuments(filter?: DocumentFilter): Promise<Document[]> {
    try {
      await this.ensureInitialized();
      let documents: Document[] = [];

      // If filtering by specific IDs, use index queries
      if (filter?.transactionId) {
        documents = await this.dbService.getByIndex<Document>('documents', 'transactionId', filter.transactionId);
      } else if (filter?.accountId) {
        documents = await this.dbService.getByIndex<Document>('documents', 'accountId', filter.accountId);
      } else {
        documents = await this.loadDocuments();
      }

      // Apply additional filters
      let filtered = [...documents];
      if (filter) {
        if (filter.type) {
          filtered = filtered.filter(d => d.type === filter.type);
        }
        if (filter.tags && filter.tags.length > 0) {
          filtered = filtered.filter(d => 
            filter.tags!.some(tag => d.tags.includes(tag))
          );
        }
        if (filter.dateFrom) {
          filtered = filtered.filter(d => d.uploadDate >= filter.dateFrom!);
        }
        if (filter.dateTo) {
          filtered = filtered.filter(d => d.uploadDate <= filter.dateTo!);
        }
        if (filter.searchTerm) {
          const search = filter.searchTerm.toLowerCase();
          filtered = filtered.filter(d => 
            d.fileName.toLowerCase().includes(search) ||
            d.notes?.toLowerCase().includes(search) ||
            d.extractedData?.merchant?.toLowerCase().includes(search) ||
            d.extractedData?.rawText?.toLowerCase().includes(search)
          );
        }
      }

      return filtered.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
    } catch (error) {
      this.logger.error('Failed to get documents:', error as Error);
      return [];
    }
  }

  async updateDocument(documentId: string, updates: Partial<Document>): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const existing = await this.getDocument(documentId);
      if (!existing) return false;

      const updated = {
        ...existing,
        ...updates,
        id: existing.id // Prevent ID changes
      };

      await this.saveDocument(updated);
      return true;
    } catch (error) {
      this.logger.error('Failed to update document:', error as Error);
      return false;
    }
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // Delete document metadata
      await this.dbService.delete('documents', documentId);
      
      // Delete associated blobs
      await this.dbService.delete('documentBlobs', documentId);
      await this.dbService.delete('documentBlobs', `${documentId}-thumb`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to delete document:', error as Error);
      return false;
    }
  }

  // Get documents for a specific transaction
  async getTransactionDocuments(transactionId: string): Promise<Document[]> {
    return await this.getDocuments({ transactionId });
  }

  // Get documents for a specific account
  async getAccountDocuments(accountId: string): Promise<Document[]> {
    return await this.getDocuments({ accountId });
  }

  // Get document file as blob
  async getDocumentBlob(documentId: string): Promise<Blob | undefined> {
    try {
      await this.ensureInitialized();
      return await this.dbService.getBlob(documentId);
    } catch (error) {
      this.logger.error('Failed to get document blob:', error as Error);
      return undefined;
    }
  }

  // Get document URL for viewing
  async getDocumentUrl(documentId: string): Promise<string | null> {
    try {
      const blob = await this.getDocumentBlob(documentId);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    } catch (error) {
      this.logger.error('Failed to get document URL:', error as Error);
      return null;
    }
  }

  // Get storage statistics
  async getStorageStats() {
    try {
      await this.ensureInitialized();
      const documents = await this.loadDocuments();
      const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
      const byType = documents.reduce((acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Get IndexedDB storage info
      const storageInfo = await this.dbService.getStorageInfo();

      return {
        totalDocuments: documents.length,
        totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        byType,
        oldestDocument: documents.length > 0 
          ? new Date(Math.min(...documents.map(d => d.uploadDate.getTime())))
          : null,
        indexedDBUsage: storageInfo.usage,
        indexedDBQuota: storageInfo.quota,
        usagePercentage: storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats:', error as Error);
      return {
        totalDocuments: 0,
        totalSize: 0,
        totalSizeMB: 0,
        byType: {},
        oldestDocument: null,
        indexedDBUsage: 0,
        indexedDBQuota: 0,
        usagePercentage: 0
      };
    }
  }

  // Export documents metadata (without file data)
  async exportMetadata(): Promise<string> {
    try {
      const documents = await this.loadDocuments();
      const metadata = documents.map(({ fullUrl, thumbnailUrl, ...doc }) => doc);
      return JSON.stringify(metadata, null, 2);
    } catch (error) {
      this.logger.error('Failed to export metadata:', error as Error);
      return '[]';
    }
  }

  // Cleanup old documents
  async cleanupOldDocuments(daysToKeep: number = 365): Promise<number> {
    try {
      await this.ensureInitialized();
      const now = this.nowProvider();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const documents = await this.loadDocuments();
      const toDelete = documents.filter(d => d.uploadDate <= cutoffDate);
      
      for (const doc of toDelete) {
        await this.deleteDocument(doc.id);
      }
      
      // Clean up expired cache
      await this.dbService.cleanCache();
      
      return toDelete.length;
    } catch (error) {
      this.logger.error('Failed to cleanup old documents:', error as Error);
      return 0;
    }
  }

  // Search documents by extracted data
  async searchByExtractedData(searchTerm: string): Promise<Document[]> {
    try {
      const documents = await this.loadDocuments();
      const search = searchTerm.toLowerCase();
      return documents.filter(doc => {
        if (!doc.extractedData) return false;
        
        return (
          doc.extractedData.merchant?.toLowerCase().includes(search) ||
          doc.extractedData.items?.some(item => 
            item.description.toLowerCase().includes(search)
          ) ||
          doc.extractedData.rawText?.toLowerCase().includes(search)
        );
      });
    } catch (error) {
      this.logger.error('Failed to search documents:', error as Error);
      return [];
    }
  }

  // Get documents expiring soon
  async getExpiringDocuments(daysAhead: number = 30): Promise<Document[]> {
    try {
      const documents = await this.loadDocuments();
      const now = this.nowProvider();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + daysAhead);
      
      return documents.filter(doc => 
        doc.expiryDate && 
        doc.expiryDate <= futureDate && 
        doc.expiryDate >= now
      );
    } catch (error) {
      this.logger.error('Failed to get expiring documents:', error as Error);
      return [];
    }
  }
}

export const documentService = new DocumentService();
