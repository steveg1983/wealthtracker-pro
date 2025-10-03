import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { useDeviceType } from './useDeviceType';
import { useTranslation } from './useTranslation';
import { useTransactionFilters } from './useTransactionFilters';
import { useDebounce } from './useDebounce';
import { useColumnDragDrop } from '../components/transactions/table/useColumnDragDrop';
import { useColumnResize } from '../components/transactions/table/useColumnResize';
import { transactionsPageService, type FilterType, type SortField, type SortDirection } from '../services/transactionsPageService';
import type { Transaction } from '../types';

export function useTransactionsPage() {
  const { transactions, accounts, deleteTransaction, categories, getDecimalTransactions } = useApp();
  const { compactView, setCompactView, currency: displayCurrency } = usePreferences();
  const { isWideView, setIsWideView } = useLayout();
  const { formatCurrency } = useCurrencyDecimal();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);
  
  // Filter states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(20);
  
  // Sort states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Bulk selection states
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  
  // Use custom hooks for column features
  const defaultColumnWidths = transactionsPageService.getDefaultColumnWidths();
  const { columnWidths, isResizing, handleMouseDown } = useColumnResize(defaultColumnWidths);
  
  const defaultColumnOrder = transactionsPageService.getDefaultColumnOrder();
  const {
    columnOrder,
    draggedColumn,
    dragOverColumn,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  } = useColumnDragDrop(defaultColumnOrder);

  // Get account ID from URL params
  const accountIdFromUrl = searchParams.get('account');
  const showAllTransactions = !!accountIdFromUrl;
  
  // Set filter from URL on mount
  useEffect(() => {
    if (accountIdFromUrl) {
      setFilterAccountId(accountIdFromUrl);
    }
  }, [accountIdFromUrl]);

  // Simulate loading state
  useEffect(() => {
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);

  // Use optimized transaction filters hook
  const filterOptions = useMemo(() => ({
    filterType,
    filterAccountId,
    searchQuery: debouncedSearchQuery,
    dateFrom,
    dateTo
  }), [filterType, filterAccountId, debouncedSearchQuery, dateFrom, dateTo]);

  const sortOptions = useMemo(() => ({
    field: sortField,
    direction: sortDirection
  }), [sortField, sortDirection]);

  const { transactions: filteredAndSortedTransactions, getCategoryPath } = useTransactionFilters(
    transactions,
    accounts,
    categories,
    filterOptions,
    sortOptions
  );

  // Calculate totals
  const totals = useMemo(() => {
    const decimalTransactions = getDecimalTransactions();
    return transactionsPageService.calculateTotals(filteredAndSortedTransactions, decimalTransactions);
  }, [filteredAndSortedTransactions, getDecimalTransactions]);

  // Calculate pagination
  const paginationInfo = useMemo(() => {
    return transactionsPageService.calculatePagination(
      filteredAndSortedTransactions.length,
      currentPage,
      transactionsPerPage,
      showAllTransactions
    );
  }, [filteredAndSortedTransactions.length, currentPage, transactionsPerPage, showAllTransactions]);

  const paginatedTransactions = filteredAndSortedTransactions.slice(
    paginationInfo.startIndex,
    paginationInfo.endIndex
  );

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  }, [sortField, sortDirection]);

  // Reset to page 1 when filters change
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback(<T,>(filterSetter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    filterSetter(value);
    resetPagination();
  }, [resetPagination]);

  // Transaction handlers
  const handleDelete = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id);
    }
  }, [deleteTransaction]);

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  }, []);

  const handleView = useCallback((transaction: Transaction) => {
    setViewingTransaction(transaction);
    setIsDetailsViewOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleCloseDetailsView = useCallback(() => {
    setIsDetailsViewOpen(false);
    setViewingTransaction(null);
  }, []);

  const handleQuickDateSelect = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    resetPagination();
  }, [resetPagination]);

  const toggleWideView = useCallback(() => {
    setIsWideView(!isWideView);
  }, [isWideView, setIsWideView]);

  const openAddModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Get filtered account name
  const filteredAccountName = filterAccountId 
    ? transactionsPageService.getFilteredAccountName(accounts, filterAccountId) 
    : null;

  // Check if should use virtualization
  const shouldUseVirtualization = transactionsPageService.shouldUseVirtualization(
    transactionsPerPage,
    showAllTransactions,
    filteredAndSortedTransactions.length,
    isMobile
  );

  // Get empty state message
  const emptyStateMessage = transactionsPageService.getEmptyStateMessage(
    transactions.length,
    searchQuery
  );

  return {
    // State
    isLoading,
    isModalOpen,
    editingTransaction,
    viewingTransaction,
    isDetailsViewOpen,
    isWideView,
    compactView,
    
    // Filter state
    filterType,
    filterAccountId,
    searchQuery,
    dateFrom,
    dateTo,
    debouncedSearchQuery,
    
    // Pagination state
    currentPage,
    transactionsPerPage,
    paginationInfo,
    
    // Sort state
    sortField,
    sortDirection,
    
    // Column state
    columnWidths,
    columnOrder,
    isResizing,
    draggedColumn,
    dragOverColumn,
    
    // Data
    transactions,
    accounts,
    categories,
    filteredAndSortedTransactions,
    paginatedTransactions,
    totals,
    filteredAccountName,
    shouldUseVirtualization,
    emptyStateMessage,
    displayCurrency,
    
    // Handlers
    handleSort,
    handleFilterChange,
    handleDelete,
    handleEdit,
    handleView,
    handleCloseModal,
    handleCloseDetailsView,
    handleQuickDateSelect,
    handleMouseDown,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    toggleWideView,
    openAddModal,
    setCurrentPage,
    setTransactionsPerPage,
    setFilterType,
    setFilterAccountId,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    
    // Utilities
    formatCurrency,
    t,
    getCategoryPath,
    isMobile,
    isTablet,
    isDesktop
  };
}