import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Transaction, Account, Category } from '../types';

export function useTransactionManagement(
  account: Account | undefined,
  transactions: Transaction[],
  categories: Category[]
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount' | 'category' | 'tags'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmTransaction, setDeleteConfirmTransaction] = useState<Transaction | null>(null);

  // Get account-specific transactions
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    
    return transactions
      .filter(t => t.accountId === account.id)
      .filter(t => {
        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        
        // Date range filter
        if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
        if (dateTo && new Date(t.date) > new Date(dateTo)) return false;
        
        // Search filter
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          t.description.toLowerCase().includes(search) ||
          t.amount.toString().includes(search) ||
          (t.category && categories.find(c => c.id === t.category)?.name.toLowerCase().includes(search)) ||
          (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(search))) ||
          (t.notes && t.notes.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        let aValue: string | number | Date = a[sortField as keyof Transaction] as string | number | Date;
        let bValue: string | number | Date = b[sortField as keyof Transaction] as string | number | Date;
        
        if (sortField === 'date') {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          
          if (dateA !== dateB) {
            aValue = dateA;
            bValue = dateB;
          } else {
            const typeOrder = { income: 0, transfer: 1, expense: 2 };
            return typeOrder[a.type] - typeOrder[b.type];
          }
        }
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [account, transactions, searchTerm, dateFrom, dateTo, typeFilter, sortField, sortDirection, categories]);

  // Calculate running balance
  const transactionsWithBalance = useMemo(() => {
    if (!account) return [];
    
    const typeOrder = { income: 0, transfer: 1, expense: 2 };
    const sortedForBalance = [...accountTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    let runningBalance = account.openingBalance || 0;
    
    const withBalance = sortedForBalance.map((transaction) => {
      runningBalance += transaction.amount;
      return { ...transaction, balance: runningBalance };
    });
    
    const balanceMap = new Map(withBalance.map(t => [t.id, t.balance]));
    
    return accountTransactions.map(t => ({
      ...t,
      balance: balanceMap.get(t.id) || 0
    }));
  }, [account, accountTransactions]);

  // Calculate unreconciled total
  const unreconciledTotal = useMemo(() => {
    if (!account) return 0;
    return accountTransactions
      .filter(t => !t.cleared)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [account, accountTransactions]);

  // Keyboard event handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedTransactionId) {
        const transaction = transactionsWithBalance.find(t => t.id === selectedTransactionId);
        if (transaction) {
          setDeleteConfirmTransaction(transaction);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransactionId, transactionsWithBalance]);

  // Handle transaction click
  const handleTransactionClick = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    
    if (selectedTransactionId === transaction.id) {
      setIsEditModalOpen(true);
    } else {
      setSelectedTransactionId(transaction.id);
    }
  }, [selectedTransactionId]);

  // Get category display name
  const getCategoryName = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    
    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    
    return category.name;
  }, [categories]);

  return {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    typeFilter,
    setTypeFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    selectedTransactionId,
    setSelectedTransactionId,
    selectedTransaction,
    setSelectedTransaction,
    isEditModalOpen,
    setIsEditModalOpen,
    deleteConfirmTransaction,
    setDeleteConfirmTransaction,
    accountTransactions,
    transactionsWithBalance,
    unreconciledTotal,
    handleTransactionClick,
    getCategoryName
  };
}