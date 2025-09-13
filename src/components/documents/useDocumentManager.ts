import { useState, useEffect, useCallback, useMemo } from 'react';
import { documentService } from '../../services/documentService';
import type { Document, DocumentFilter } from '../../services/documentService';

export function useDocumentManager(
  transactionId?: string,
  accountId?: string
) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<Document['type'] | 'all'>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [storageStats, setStorageStats] = useState<any>(null);

  // Load documents
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    const filter: DocumentFilter = {};
    if (transactionId) filter.transactionId = transactionId;
    if (accountId) filter.accountId = accountId;
    
    const docs = await documentService.getDocuments(filter);
    setDocuments(docs);
    setIsLoading(false);
  }, [transactionId, accountId]);

  // Load storage stats
  const loadStorageStats = useCallback(() => {
    const stats = documentService.getStorageStats();
    setStorageStats(stats);
  }, []);

  // Initial load
  useEffect(() => {
    loadDocuments();
    loadStorageStats();
  }, [loadDocuments, loadStorageStats]);

  // Apply filters
  const filteredDocuments = useMemo(() => {
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

    return filtered;
  }, [documents, searchTerm, filterType, filterTags]);

  // Get all unique tags
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach(doc => doc.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  }, [documents]);

  // Handle document upload
  const handleDocumentUpload = useCallback((document: Document) => {
    loadDocuments();
    loadStorageStats();
  }, [loadDocuments, loadStorageStats]);

  // Handle delete document
  const handleDeleteDocument = useCallback((documentId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      documentService.deleteDocument(documentId);
      loadDocuments();
      loadStorageStats();
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setShowViewer(false);
      }
    }
  }, [selectedDocument, loadDocuments, loadStorageStats]);

  // Handle update document
  const handleUpdateDocument = useCallback((document: Document, updates: Partial<Document>) => {
    documentService.updateDocument(document.id, updates);
    loadDocuments();
    setEditingDocument(null);
  }, [loadDocuments]);

  // Handle download document
  const downloadDocument = useCallback((document: Document) => {
    const link = window.document.createElement('a');
    link.href = document.fullUrl;
    link.download = document.fileName;
    link.click();
  }, []);

  // Handle view document
  const handleViewDocument = useCallback((document: Document) => {
    setSelectedDocument(document);
    setShowViewer(true);
  }, []);

  return {
    // State
    documents: filteredDocuments,
    selectedDocument,
    showUpload,
    showViewer,
    searchTerm,
    filterType,
    filterTags,
    isLoading,
    editingDocument,
    storageStats,
    availableTags,
    
    // Setters
    setShowUpload,
    setShowViewer,
    setSearchTerm,
    setFilterType,
    setFilterTags,
    setEditingDocument,
    setSelectedDocument,
    
    // Handlers
    handleDocumentUpload,
    handleDeleteDocument,
    handleUpdateDocument,
    handleViewDocument,
    downloadDocument,
    loadDocuments,
    loadStorageStats
  };
}