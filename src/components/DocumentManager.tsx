import React, { useState, useEffect, useCallback } from 'react';
import { documentService } from '../services/documentService';
import type { Document, DocumentFilter } from '../services/documentService';
import DocumentUpload from './DocumentUpload';
import {
  FileTextIcon,
  ImageIcon,
  SearchIcon,
  DownloadIcon,
  DeleteIcon,
  EditIcon,
  XIcon,
  TagIcon,
  FolderIcon,
  CheckCircleIcon,
  PaperclipIcon,
  UploadIcon,
  RefreshCwIcon
} from './icons';
import { Modal, ModalBody, ModalFooter } from './common/Modal';

interface DocumentManagerProps {
  transactionId?: string;
  accountId?: string;
  compact?: boolean;
  onDocumentSelect?: (document: Document) => void;
}

interface StorageStats {
  totalDocuments: number;
  totalSize: number;
  totalSizeMB: number;
  byType: Record<string, number>;
  oldestDocument: Date | null;
  indexedDBUsage: number;
  indexedDBQuota: number;
  usagePercentage: number;
}

const documentTypeValues = ['receipt', 'invoice', 'statement', 'contract', 'other'] as const;
type DocumentType = typeof documentTypeValues[number];
type DocumentTypeFilter = DocumentType | 'all';
const isDocumentType = (value: string): value is DocumentType =>
  (documentTypeValues as readonly string[]).includes(value);

export default function DocumentManager({
  transactionId,
  accountId,
  compact = false,
  onDocumentSelect
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<DocumentTypeFilter>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    const filter: DocumentFilter = {};
    if (transactionId) filter.transactionId = transactionId;
    if (accountId) filter.accountId = accountId;
    
    const docs = await documentService.getDocuments(filter);
    setDocuments(docs);
    setIsLoading(false);
  }, [transactionId, accountId]);

  const loadStorageStats = useCallback(async () => {
    const stats = await documentService.getStorageStats();
    setStorageStats(stats);
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...documents];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.type === filterType);
    }

    // Apply tag filter
    if (filterTags.length > 0) {
      filtered = filtered.filter(doc =>
        filterTags.some(tag => doc.tags.includes(tag))
      );
    }

    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.fileName.toLowerCase().includes(search) ||
        doc.notes?.toLowerCase().includes(search) ||
        doc.extractedData?.merchant?.toLowerCase().includes(search) ||
        doc.extractedData?.rawText?.toLowerCase().includes(search)
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, filterType, filterTags, searchTerm]);

  useEffect(() => {
    loadDocuments();
    loadStorageStats();
  }, [loadDocuments, loadStorageStats]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDocumentUpload = (_document: Document) => {
    loadDocuments();
    loadStorageStats();
  };

  const handleDeleteDocument = (documentId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      documentService.deleteDocument(documentId);
      loadDocuments();
      loadStorageStats();
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setShowViewer(false);
      }
    }
  };

  const handleUpdateDocument = (document: Document, updates: Partial<Document>) => {
    documentService.updateDocument(document.id, updates);
    loadDocuments();
    setEditingDocument(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={20} className="text-blue-600" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileTextIcon size={20} className="text-red-600" />;
    }
    return <FileTextIcon size={20} className="text-gray-600" />;
  };

  const getTypeColor = (type: Document['type']) => {
    switch (type) {
      case 'receipt': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'invoice': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'statement': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'contract': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const downloadDocument = (document: Document) => {
    const link = window.document.createElement('a');
    link.href = document.fullUrl;
    link.download = document.fileName;
    link.click();
  };

  const getAllTags = () => {
    const tagSet = new Set<string>();
    documents.forEach(doc => doc.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PaperclipIcon size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Attachments ({documents.length})
            </span>
          </div>
          <DocumentUpload
            transactionId={transactionId}
            accountId={accountId}
            onUploadComplete={handleDocumentUpload}
            compact
          />
        </div>
        
        {documents.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {documents.slice(0, 4).map(doc => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDocument(doc);
                  setShowViewer(true);
                }}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
              >
                {getFileIcon(doc.mimeType)}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {doc.fileName}
                </span>
              </button>
            ))}
            {documents.length > 4 && (
              <button
                onClick={() => onDocumentSelect?.(documents[0])}
                className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-center text-sm text-gray-600 dark:text-gray-400"
              >
                +{documents.length - 4} more
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Document Manager
          </h2>
          {storageStats && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {storageStats.totalDocuments} documents • {storageStats.totalSizeMB} MB used
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UploadIcon size={16} />
          Upload Documents
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                setFilterType('all');
              } else if (isDocumentType(value)) {
                setFilterType(value);
              }
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="receipt">Receipts</option>
            <option value="invoice">Invoices</option>
            <option value="statement">Statements</option>
            <option value="contract">Contracts</option>
            <option value="other">Other</option>
          </select>

          {/* Tag Filter */}
          {getAllTags().length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !filterTags.includes(e.target.value)) {
                  setFilterTags([...filterTags, e.target.value]);
                }
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Filter by tag...</option>
              {getAllTags().map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
        </div>

        {/* Active Filters */}
        {filterTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filterTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                <TagIcon size={12} />
                {tag}
                <button
                  onClick={() => setFilterTags(filterTags.filter(t => t !== tag))}
                  className="hover:text-red-600"
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setFilterTags([])}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCwIcon size={48} className="animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <FolderIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {documents.length === 0 
              ? 'Upload receipts, invoices, and other documents to keep them organized'
              : 'Try adjusting your search or filters'
            }
          </p>
          {documents.length === 0 && (
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upload Your First Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Document Preview */}
              <div
                className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"
                onClick={() => {
                  setSelectedDocument(doc);
                  setShowViewer(true);
                }}
              >
                {doc.thumbnailUrl ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt={doc.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getFileIcon(doc.mimeType)
                )}
              </div>

              {/* Document Info */}
              <div className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate mb-2">
                  {doc.fileName}
                </h3>
                
                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatDate(doc.uploadDate)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getTypeColor(doc.type)}`}>
                      {doc.type}
                    </span>
                    {doc.extractedData && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircleIcon size={12} />
                        OCR
                      </span>
                    )}
                  </div>
                  
                  {doc.extractedData?.merchant && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {doc.extractedData.merchant}
                    </p>
                  )}
                  
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                        >
                          <TagIcon size={10} />
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{doc.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedDocument(doc);
                      setShowViewer(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadDocument(doc)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Download"
                    >
                      <DownloadIcon size={16} />
                    </button>
                    <button
                      onClick={() => setEditingDocument(doc)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Edit"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Documents"
        size="lg"
      >
        <ModalBody>
          <DocumentUpload
            transactionId={transactionId}
            accountId={accountId}
            onUploadComplete={handleDocumentUpload}
            onClose={() => setShowUpload(false)}
          />
        </ModalBody>
      </Modal>

      {/* Document Viewer Modal */}
      {selectedDocument && showViewer && (
        <Modal
          isOpen={showViewer}
          onClose={() => {
            setShowViewer(false);
            setSelectedDocument(null);
          }}
          title={selectedDocument.fileName}
          size="xl"
        >
          <ModalBody>
            <div className="space-y-4">
              {/* Document Preview */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 max-h-96 overflow-auto">
                {selectedDocument.mimeType.startsWith('image/') ? (
                  <img
                    src={selectedDocument.fullUrl}
                    alt={selectedDocument.fileName}
                    className="max-w-full h-auto mx-auto"
                  />
                ) : selectedDocument.mimeType === 'application/pdf' ? (
                  <div className="text-center">
                    <FileTextIcon size={64} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      PDF preview not available
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileTextIcon size={64} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </div>

              {/* Document Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Document Information
                  </h4>
                  <dl className="space-y-1 text-sm">
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Type:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white capitalize">
                        {selectedDocument.type}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Size:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">
                        {formatFileSize(selectedDocument.fileSize)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Uploaded:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedDocument.uploadDate)}
                      </dd>
                    </div>
                    {selectedDocument.expiryDate && (
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Expires:</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">
                          {formatDate(selectedDocument.expiryDate)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {selectedDocument.extractedData && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      Extracted Data
                    </h4>
                    <dl className="space-y-1 text-sm">
                      {selectedDocument.extractedData.merchant && (
                        <div>
                          <dt className="text-gray-600 dark:text-gray-400">Merchant:</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {selectedDocument.extractedData.merchant}
                          </dd>
                        </div>
                      )}
                      {selectedDocument.extractedData.totalAmount && (
                        <div>
                          <dt className="text-gray-600 dark:text-gray-400">Amount:</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            £{selectedDocument.extractedData.totalAmount}
                          </dd>
                        </div>
                      )}
                      {selectedDocument.extractedData.date && (
                        <div>
                          <dt className="text-gray-600 dark:text-gray-400">Date:</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formatDate(selectedDocument.extractedData.date)}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Confidence:</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">
                          {Math.round(selectedDocument.extractedData.confidence * 100)}%
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

              {selectedDocument.tags.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                      >
                        <TagIcon size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedDocument.notes}
                  </p>
                </div>
              )}
            </div>
          </ModalBody>
          
          <ModalFooter>
            <div className="flex justify-between w-full">
              <button
                onClick={() => downloadDocument(selectedDocument)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <DownloadIcon size={16} />
                Download
              </button>
              <button
                onClick={() => {
                  setShowViewer(false);
                  setSelectedDocument(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* Edit Document Modal */}
      {editingDocument && (
        <Modal
          isOpen={true}
          onClose={() => setEditingDocument(null)}
          title="Edit Document"
          size="md"
        >
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Type
                </label>
                <select
                  value={editingDocument.type}
                  onChange={(e) => setEditingDocument({
                    ...editingDocument,
                    type: e.target.value as Document['type']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="receipt">Receipt</option>
                  <option value="invoice">Invoice</option>
                  <option value="statement">Statement</option>
                  <option value="contract">Contract</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingDocument.notes || ''}
                  onChange={(e) => setEditingDocument({
                    ...editingDocument,
                    notes: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
            </div>
          </ModalBody>
          
          <ModalFooter>
            <button
              onClick={() => setEditingDocument(null)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => handleUpdateDocument(editingDocument, {
                type: editingDocument.type,
                notes: editingDocument.notes
              })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
