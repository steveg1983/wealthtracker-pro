import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { parseMoneyInput } from '../utils/decimal';
import { preserveDemoParam } from '../utils/navigation';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ArrowLeftIcon, SearchIcon, PlusIcon, CalendarIcon, XIcon, SettingsIcon, FilterIcon, ChevronUpIcon, ChevronDownIcon, MaximizeIcon, MinimizeIcon, EyeIcon } from '../components/icons';
import LocalMerchantLogo from '../components/LocalMerchantLogo';
import DatePicker from '../components/common/DatePicker';
import EditTransactionModal from '../components/EditTransactionModal';
import QuickEditTransactionPanel from '../components/QuickEditTransactionPanel';
import CategorySelector from '../components/CategorySelector';
import { usePreferences } from '../contexts/PreferencesContext';
import { VirtualizedTable, Column } from '../components/VirtualizedTable';
import { compareTransactions } from '../utils/transactionSort';
import { orderColumnKeys, moveColumnKey } from '../utils/columnLayout';
import { computeArchiveWindow, ARCHIVE_PRESETS, type ArchiveRange } from '../utils/archiveRange';
import type { Transaction } from '../types';

type TransactionWithBalance = Transaction & { balance: number };

interface OpeningBalanceRow {
  id: 'opening-balance';
  isOpeningBalance: true;
  date: Date;
  description: string;
  amount: number;
  balance: number;
  type: 'income';
  category: string;
  accountId: string;
  tags: string[];
  cleared: true;
}

type DisplayRow = TransactionWithBalance | OpeningBalanceRow;

function isOpeningBalanceRow(row: DisplayRow): row is OpeningBalanceRow {
  return 'isOpeningBalance' in row && row.isOpeningBalance === true;
}

// Persisted (per browser) column layout for the account register.
const COLUMN_ORDER_KEY = 'accountRegister.columnOrder.v1';
const COLUMN_WIDTHS_KEY = 'accountRegister.columnWidths.v1';
const HIDDEN_COLUMNS_KEY = 'accountRegister.hiddenColumns.v1';
const ARCHIVE_KEY = 'accountRegister.archive.v1';
// Columns off by default; the user can switch them on in the View dropdown.
const DEFAULT_HIDDEN_COLUMNS = ['amount', 'notes'];

interface ArchiveState { range: ArchiveRange; from: string; to: string }

// Friendly labels for the View dropdown's column checkboxes.
const COLUMN_LABELS: Record<string, string> = { reconciled: 'Reconciled (R)' };

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function AccountTransactions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, transactions, categories, deleteTransaction, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { compactView, setCompactView: _setCompactView } = usePreferences();
  
  // Find the specific account
  const account = accounts.find(acc => acc.id === accountId);
  
  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  // Single-viewport layout: search collapses behind a toggle, and the table
  // can expand over the bottom add/edit dock for bulk browsing.
  const [showFilters, setShowFilters] = useState(false);
  const [tableExpanded, setTableExpanded] = useState(false);
  // The table's height is MEASURED (viewport minus everything above it and a
  // reserve for the bottom dock) so the whole page always fits one screen,
  // whatever banners/nav are present. Fixed calc() guesses drift.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(480);
  const measureTableHeight = useCallback(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const dockReserve = tableExpanded ? 32 : 224; // dock (~178) + gaps/padding, or just padding
    setTableHeight(Math.max(240, window.innerHeight - top - dockReserve));
  }, [tableExpanded]);
  useLayoutEffect(() => {
    measureTableHeight();
    window.addEventListener('resize', measureTableHeight);
    return () => window.removeEventListener('resize', measureTableHeight);
  }, [measureTableHeight, showFilters]);
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount' | 'category' | 'tags' | 'payment' | 'deposit' | 'notes'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Column layout (order + widths), drag-controlled and persisted per browser.
  const [columnOrder, setColumnOrder] = useState<string[]>(() => readStored<string[]>(COLUMN_ORDER_KEY, []));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => readStored<Record<string, number>>(COLUMN_WIDTHS_KEY, {}));

  useEffect(() => {
    try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder)); } catch { /* storage may be unavailable */ }
  }, [columnOrder]);
  useEffect(() => {
    try { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths)); } catch { /* storage may be unavailable */ }
  }, [columnWidths]);

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }));
  }, []);

  // View dropdown: which columns are hidden, and how far back to show.
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => readStored<string[]>(HIDDEN_COLUMNS_KEY, DEFAULT_HIDDEN_COLUMNS));
  const [archive, setArchive] = useState<ArchiveState>(() => readStored<ArchiveState>(ARCHIVE_KEY, { range: 'all', from: '', to: '' }));
  const [showView, setShowView] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(hiddenColumns)); } catch { /* storage may be unavailable */ }
  }, [hiddenColumns]);
  useEffect(() => {
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); } catch { /* storage may be unavailable */ }
  }, [archive]);

  // Close the View dropdown on outside click.
  useEffect(() => {
    if (!showView) return;
    const onDown = (e: MouseEvent) => {
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) setShowView(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showView]);

  const archiveWindow = useMemo(() => computeArchiveWindow(archive.range, archive.from, archive.to), [archive]);

  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }, []);
  
  // State for modals and selection
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmTransaction, setDeleteConfirmTransaction] = useState<Transaction | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  
  // State for quick add form
  const [quickAddForm, setQuickAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category: '',
    tags: [] as string[],
    notes: ''
  });
  const [quickAddError, setQuickAddError] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Get account-specific transactions
  const accountTransactions = useMemo<Transaction[]>(() => {
    if (!account) return [];
    
    
    return transactions
      .filter(t => t.accountId === account.id)
      .filter(t => {
        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        
        // Date range filter (Search & filters)
        if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
        if (dateTo && new Date(t.date) > new Date(dateTo)) return false;

        // Archive window (View dropdown "Show" presets)
        if (archiveWindow.from && new Date(t.date) < archiveWindow.from) return false;
        if (archiveWindow.to && new Date(t.date) > archiveWindow.to) return false;

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
      .sort((a, b) => compareTransactions(a, b, sortField, sortDirection, categories));
  }, [account, transactions, searchTerm, dateFrom, dateTo, typeFilter, archiveWindow, sortField, sortDirection, categories]);
  
  // Calculate running balance
  const transactionsWithBalance = useMemo<TransactionWithBalance[]>(() => {
    if (!account) return [] as TransactionWithBalance[];
    
    
    // Sort transactions by date and type for proper balance calculation
    // Within the same date: income first, then transfers, then expenses
    const typeOrder = { income: 0, transfer: 1, expense: 2 };
    const sortedForBalance = [...accountTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // First sort by date
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // If same date, sort by type (income first, then transfers, then expenses)
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    // Start from opening balance or 0
    let runningBalance = account.openingBalance || 0;
    
    // Calculate running balance for each transaction
    const withBalance = sortedForBalance.map((transaction) => {
      // Since amounts are already signed (negative for expenses), just add them
      runningBalance += transaction.amount;
      return { ...transaction, balance: runningBalance };
    });
    
    // Now sort back to the user's requested order, but keep the calculated balances
    const balanceMap = new Map(withBalance.map(t => [t.id, t.balance]));
    
    const result = accountTransactions.map(t => ({
      ...t,
      balance: balanceMap.get(t.id) || 0
    }));
    
    return result;
  }, [account, accountTransactions]);

  // Build display rows with virtual Opening Balance as first entry
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (!account) return [];

    const openingBalance = account.openingBalance ?? 0;

    // Date: use openingBalanceDate, or 1 day before oldest transaction, or today
    let obDate: Date;
    if (account.openingBalanceDate) {
      obDate = new Date(account.openingBalanceDate);
    } else if (transactionsWithBalance.length > 0) {
      const oldest = transactionsWithBalance.reduce((min, t) => {
        const d = new Date(t.date).getTime();
        return d < min ? d : min;
      }, Infinity);
      obDate = new Date(oldest);
      obDate.setDate(obDate.getDate() - 1);
    } else {
      obDate = new Date();
    }

    const openingBalanceRow: OpeningBalanceRow = {
      id: 'opening-balance',
      isOpeningBalance: true,
      date: obDate,
      description: 'Opening Balance',
      amount: openingBalance,
      balance: openingBalance,
      type: 'income',
      category: '',
      accountId: account.id,
      tags: [],
      cleared: true,
    };

    // Respect sort direction — opening balance is always chronologically first
    if (sortField === 'date' && sortDirection === 'desc') {
      return [...transactionsWithBalance, openingBalanceRow];
    }
    return [openingBalanceRow, ...transactionsWithBalance];
  }, [account, transactionsWithBalance, sortField, sortDirection]);

  // Calculate unreconciled total
  const unreconciledTotal = useMemo(() => {
    if (!account) return 0;

    return accountTransactions
      .filter(t => !t.cleared)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [account, accountTransactions]);

  // Compute account balance from transactions (opening balance + sum of all txns)
  const computedAccountBalance = useMemo(() => {
    if (!account) return 0;
    const openingBalance = account.openingBalance ?? 0;
    const txnTotal = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
    return openingBalance + txnTotal;
  }, [account, accountTransactions]);

  // Bank balance from TrueLayer sync (or null if not available)
  const bankBalance = account?.bankBalance ?? null;
  
  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never hijack Delete while the user is typing (the quick-edit panel
      // keeps a row selected while its inputs are focused).
      const target = e.target as HTMLElement | null;
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )) {
        return;
      }
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
  
  // Remove auto-scroll - we want to start at the top with oldest transactions

  // Handle scroll isolation
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    let isMouseOverContainer = false;
    
    const handleMouseEnter = () => {
      isMouseOverContainer = true;
    };
    
    const handleMouseLeave = () => {
      isMouseOverContainer = false;
    };
    
    const handleGlobalWheel = (e: WheelEvent) => {
      if (isMouseOverContainer && scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isScrollable = scrollHeight > clientHeight;
        
        if (isScrollable) {
          // Prevent the default page scroll
          e.preventDefault();
          
          // Apply the scroll to our container instead
          const newScrollTop = scrollTop + e.deltaY;
          scrollContainer.scrollTop = Math.max(0, Math.min(newScrollTop, scrollHeight - clientHeight));
        }
      }
    };
    
    // Add mouse enter/leave listeners
    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    
    // Add global wheel listener with passive: false to allow preventDefault
    document.addEventListener('wheel', handleGlobalWheel, { passive: false });
    
    return () => {
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);
  
  // Handle transaction row click
  const handleTransactionClick = useCallback((item: DisplayRow) => {
    if (isOpeningBalanceRow(item)) return;
    setSelectedTransaction(item);

    if (selectedTransactionId === item.id) {
      // Second click on already selected transaction - open edit modal
      setIsEditModalOpen(true);
    } else {
      // First click - select and pin the quick-edit panel under the table
      setSelectedTransactionId(item.id);
    }
  }, [selectedTransactionId]);

  // The quick-edit panel always reflects the latest saved state of the
  // selected transaction (context updates flow straight back in).
  const quickEditTarget = useMemo(
    () => transactionsWithBalance.find(t => t.id === selectedTransactionId) ?? null,
    [transactionsWithBalance, selectedTransactionId]
  );

  // Clicking the page background deselects: the row un-highlights and the
  // bottom dock flips back from Quick Edit to Quick Add. Clicks inside the
  // table, the dock, or any dialog keep the selection.
  useEffect(() => {
    if (!selectedTransactionId) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-transaction-table]') ||
        target.closest('[data-quick-edit-panel]') ||
        target.closest('[role="dialog"]')
      ) {
        return;
      }
      setSelectedTransactionId(null);
      setSelectedTransaction(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [selectedTransactionId]);

  // Next non-summary row below the given one in the CURRENT visible order —
  // powers "Save & Next" in both the quick-edit panel and the full modal.
  const getNextTransactionId = useCallback((currentId: string): string | null => {
    const index = displayRows.findIndex(row => row.id === currentId);
    if (index === -1) return null;
    for (let i = index + 1; i < displayRows.length; i += 1) {
      if (!isOpeningBalanceRow(displayRows[i])) {
        return displayRows[i].id;
      }
    }
    return null;
  }, [displayRows]);

  const advanceToNextTransaction = useCallback((currentId: string): boolean => {
    const nextId = getNextTransactionId(currentId);
    if (!nextId) return false;
    const nextTransaction = transactionsWithBalance.find(t => t.id === nextId) ?? null;
    setSelectedTransactionId(nextId);
    setSelectedTransaction(nextTransaction);
    return true;
  }, [getNextTransactionId, transactionsWithBalance]);
  
  
  // Handle quick add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError('');
    if (!account) return;
    if (!quickAddForm.description.trim()) {
      setQuickAddError('Description is required');
      return;
    }
    if (!quickAddForm.amount) {
      setQuickAddError('Amount is required');
      return;
    }
    if (quickAddForm.type !== 'transfer' && !quickAddForm.category) {
      setQuickAddError('Please select a category');
      return;
    }
    if (quickAddForm.type === 'transfer' && !quickAddForm.category) {
      setQuickAddError('Please select a target account');
      return;
    }
    
    // Calculate the correct amount based on transaction type
    let amount = parseMoneyInput(quickAddForm.amount) ?? 0;
    if (quickAddForm.type === 'expense') {
      amount = -Math.abs(amount); // Expenses are always negative
    } else if (quickAddForm.type === 'income') {
      amount = Math.abs(amount); // Income is always positive
    } else if (quickAddForm.type === 'transfer') {
      // For transfers, amount is negative (money leaving this account)
      amount = -Math.abs(amount);
    }
    
    // Create the transaction
    const isTransfer = quickAddForm.type === 'transfer';
    const targetAccountId = isTransfer ? quickAddForm.category : undefined;

    const transactionData: Omit<Transaction, 'id'> = {
      date: new Date(quickAddForm.date),
      description: quickAddForm.description,
      amount: amount,
      type: quickAddForm.type,
      accountId: account.id,
      transferAccountId: targetAccountId,
      tags: quickAddForm.tags,
      notes: quickAddForm.notes,
      cleared: false,
      category: isTransfer ? 'transfer-out' : quickAddForm.category
    };

    try {
      const newTransaction = await addTransaction(transactionData);

      // For transfers, create the paired transaction in the target account
      if (isTransfer && targetAccountId && newTransaction) {
        await addTransaction({
          date: new Date(quickAddForm.date),
          description: quickAddForm.description,
          amount: Math.abs(amount),
          type: 'transfer',
          category: 'transfer-in',
          accountId: targetAccountId,
          transferAccountId: account.id,
          tags: quickAddForm.tags,
          notes: quickAddForm.notes,
          cleared: false
        });
      }

      // Reset form and error
      setQuickAddError('');
      setQuickAddForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'expense',
        category: '',
        tags: [],
        notes: ''
      });
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : 'Failed to add transaction. Please try again.');
    }
  };
  
  
  const handleDeleteConfirm = () => {
    if (deleteConfirmTransaction) {
      deleteTransaction(deleteConfirmTransaction.id);
      setDeleteConfirmTransaction(null);
    }
  };
  
  // Get category display name
  const getCategoryName = useCallback((categoryId: string, transaction?: TransactionWithBalance) => {
    if (!categoryId) return '';

    // For transfers, show target/source account name
    if (transaction?.type === 'transfer' && transaction.transferAccountId) {
      const targetAccount = accounts.find(a => a.id === transaction.transferAccountId);
      const accountName = targetAccount?.name ?? 'Unknown';
      if (categoryId === 'transfer-out' || categoryId === 'transfer-in') return `Transfer > ${accountName}`;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
        return '';
      }
      return '';
    }

    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }

    return category.name;
  }, [categories, accounts]);

  // Define table columns for VirtualizedTable (base definitions; order + widths
  // are applied below from the persisted layout).
  const baseColumns: Column<DisplayRow>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      width: '100px',
      accessor: (transaction) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {new Date(transaction.date).toLocaleDateString('en-GB')}
        </span>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
      sortable: true
    },
    {
      key: 'reconciled',
      header: 'R',
      width: '35px',
      accessor: (transaction) => (
        transaction.cleared ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : null
      ),
      className: 'text-center',
      headerClassName: 'text-center'
    },
    {
      key: 'description',
      header: 'Description',
      width: undefined, // flex column — uses flex:1 via className
      accessor: (transaction) => (
        <div className="flex items-center gap-2 min-w-0">
          <LocalMerchantLogo description={transaction.description} size="sm" />
          <span className="text-sm text-gray-900 dark:text-white truncate">
            {transaction.description}
          </span>
        </div>
      ),
      className: 'flex-1 min-w-0',
      headerClassName: 'flex-1 min-w-0',
      sortable: true,
      // The flex filler: it absorbs the slack when other columns are resized, so
      // it has no resize handle of its own.
      resizable: false
    },
    {
      key: 'category',
      header: 'Category',
      width: '280px',
      accessor: (transaction) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate block">
          {getCategoryName(transaction.category, transaction)}
        </span>
      ),
      className: 'text-left',
      headerClassName: 'text-left',
      sortable: true
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '120px',
      accessor: (transaction) => (
        <div className="flex flex-wrap gap-1 overflow-hidden max-h-[1.5rem] justify-center">
          {transaction.tags?.map((tag: string, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
      sortable: true
    },
    {
      key: 'payment',
      header: 'Payment',
      width: '120px',
      // Money out — the magnitude (no sign), in red, like MS Money's Payment column.
      accessor: (transaction) => (
        transaction.amount < 0 ? (
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {formatCurrency(Math.abs(transaction.amount), account?.currency)}
          </span>
        ) : null
      ),
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true
    },
    {
      key: 'deposit',
      header: 'Deposit',
      width: '120px',
      // Money in — in green, like MS Money's Deposit column.
      accessor: (transaction) => (
        transaction.amount > 0 ? (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {formatCurrency(transaction.amount, account?.currency)}
          </span>
        ) : null
      ),
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true
    },
    {
      // Single signed Amount column (off by default; Payment/Deposit replace it).
      key: 'amount',
      header: 'Amount',
      width: '120px',
      accessor: (transaction) => (
        <span className={`text-sm font-medium ${
          transaction.amount > 0
            ? 'text-green-600 dark:text-green-400'
            : transaction.amount < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {formatCurrency(transaction.amount, account?.currency)}
        </span>
      ),
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true
    },
    {
      key: 'notes',
      header: 'Notes',
      width: '200px',
      accessor: (transaction) => {
        const notes = 'notes' in transaction ? transaction.notes : undefined;
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate block" title={notes || ''}>
            {notes || ''}
          </span>
        );
      },
      className: 'text-left',
      headerClassName: 'text-left',
      sortable: true
    },
    {
      key: 'balance',
      header: 'Balance',
      width: '120px',
      accessor: (transaction) => (
        <span className={`text-sm font-medium ${
          transaction.balance < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {formatCurrency(transaction.balance, account?.currency)}
        </span>
      ),
      className: 'text-right',
      headerClassName: 'text-right'
    }
  ], [formatCurrency, account?.currency, getCategoryName]);

  // Apply the persisted order + widths on top of the base definitions.
  const columns: Column<DisplayRow>[] = useMemo(() => {
    const baseKeys = baseColumns.map(c => c.key);
    const byKey = new Map(baseColumns.map(c => [c.key, c] as const));
    const hidden = new Set(hiddenColumns);
    return orderColumnKeys(baseKeys, columnOrder)
      .filter(key => !hidden.has(key))
      .map(key => byKey.get(key))
      .filter((c): c is Column<DisplayRow> => Boolean(c))
      .map(c => (columnWidths[c.key] != null ? { ...c, width: columnWidths[c.key] } : c));
  }, [baseColumns, columnOrder, columnWidths, hiddenColumns]);

  const handleColumnReorder = useCallback((fromKey: string, toKey: string) => {
    setColumnOrder(prev => moveColumnKey(orderColumnKeys(baseColumns.map(c => c.key), prev), fromKey, toKey));
  }, [baseColumns]);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Account not found</p>
        <button
          onClick={() => navigate('/accounts')}
          className="mt-4 text-primary hover:text-secondary"
        >
          Return to Accounts
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-3 self-start"
      >
        <ArrowLeftIcon size={16} />
        <span className="text-sm">Back to Accounts</span>
      </button>

      {/* Compact header with inline stat boxes */}
      <div className="bg-[#1a2332] dark:bg-gray-700 rounded-2xl shadow px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white leading-tight">
                {account.name}
              </h1>
              <button
                onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
                className="p-1 text-white/50 hover:text-white transition-colors"
                title="Account Settings"
                type="button"
              >
                <SettingsIcon size={16} />
              </button>
            </div>
            {(account.sortCode && account.sortCode !== '000000') || (account.accountNumber && account.accountNumber !== '00000000') ? (
              <div className="flex items-center gap-3 mt-0.5">
                {account.sortCode && account.sortCode !== '000000' && (
                  <span className="text-xs text-white/70">{account.sortCode}</span>
                )}
                {account.accountNumber && account.accountNumber !== '00000000' && (
                  <span className="text-xs text-white/70">{account.accountNumber}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Account Balance</span>
            <span className={`text-sm font-bold whitespace-nowrap ${
              computedAccountBalance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(computedAccountBalance, account.currency)}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Bank Balance</span>
            <span className={`text-sm font-bold whitespace-nowrap ${
              bankBalance != null
                ? bankBalance >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              {bankBalance != null ? formatCurrency(bankBalance, account.currency) : 'N/A'}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Unreconciled</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
              {formatCurrency(unreconciledTotal, account.currency)}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Difference</span>
            {bankBalance != null ? (() => {
              const difference = bankBalance - computedAccountBalance;
              return (
                <span className={`text-sm font-bold whitespace-nowrap ${
                  difference === 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(difference, account.currency)}
                </span>
              );
            })() : (
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">N/A</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content — single-viewport layout: toolbar, table, bottom dock */}
      <div className="flex flex-col gap-3">
      {/* Toolbar: filter toggle + table size toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(prev => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <FilterIcon size={14} />
          Search &amp; filters
          {(searchTerm || typeFilter !== 'all' || dateFrom || dateTo) && (
            <span className="w-2 h-2 rounded-full bg-blue-500" title="Filters active" />
          )}
          {showFilters ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </button>

        {/* View: choose which columns to show, and how far back to list */}
        <div className="relative" ref={viewRef}>
          <button
            onClick={() => setShowView(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <EyeIcon size={14} />
            View
            {archive.range !== 'all' && (
              <span className="w-2 h-2 rounded-full bg-blue-500" title="Showing a limited date range" />
            )}
            {showView ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          </button>
          {showView && (
            <div className="absolute z-50 mt-1 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Columns</p>
              <div className="max-h-52 overflow-y-auto -mx-1 px-1">
                {baseColumns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {COLUMN_LABELS[col.key] ?? col.header}
                  </label>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Show</p>
                {ARCHIVE_PRESETS.map(preset => (
                  <label key={preset.value} className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                    <input
                      type="radio"
                      name="archive-range"
                      checked={archive.range === preset.value}
                      onChange={() => setArchive(prev => ({ ...prev, range: preset.value }))}
                      className="border-gray-300 dark:border-gray-600"
                    />
                    {preset.label}
                  </label>
                ))}
                {archive.range === 'custom' && (
                  <div className="mt-2 space-y-2 pl-6">
                    <div>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">From</span>
                      <DatePicker
                        value={archive.from}
                        onChange={(v) => setArchive(prev => ({ ...prev, from: v }))}
                        className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        aria-label="Archive from date"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">To</span>
                      <DatePicker
                        value={archive.to}
                        onChange={(v) => setArchive(prev => ({ ...prev, to: v }))}
                        className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        aria-label="Archive to date"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
        <button
          onClick={() => setTableExpanded(prev => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={tableExpanded ? 'Shrink the table and show the add/edit bar' : 'Expand the table over the add/edit bar'}
        >
          {tableExpanded ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
          {tableExpanded ? 'Standard view' : 'Expand table'}
        </button>
      </div>

      {/* Search and Filter Bar (collapsed by default to keep one viewport) */}
      {showFilters && (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by description, amount, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                />
              </div>
            </div>
            
            {/* Type Filter and Compact View Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-[#1a2332] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter('income')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'income'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setTypeFilter('expense')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'expense'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Expense
                </button>
                <button
                  onClick={() => setTypeFilter('transfer')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'transfer'
                      ? 'bg-[#1a2332] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
          
          {/* Date Range and Additional Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
              <div className="w-40">
                <DatePicker
                  value={dateFrom}
                  onChange={(val) => setDateFrom(val)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                  aria-label="Filter from date"
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
              <div className="w-40">
                <DatePicker
                  value={dateTo}
                  onChange={(val) => setDateTo(val)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                  aria-label="Filter to date"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                  title="Clear date range"
                >
                  <XIcon size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Transactions Table — measured to keep the whole page in one viewport;
          the table scrolls internally. Expanded mode trades the bottom dock
          for more visible rows. */}
      <div
        ref={tableWrapRef}
        data-transaction-table
        style={{ height: tableHeight }}
        className="overflow-hidden"
      >
        <VirtualizedTable
          items={displayRows}
          columns={columns}
          getItemKey={(row: DisplayRow) => row.id}
          onRowClick={(item) => handleTransactionClick(item)}
          rowHeight={compactView ? 36 : 44}
          selectedItems={selectedTransactionId ? new Set([selectedTransactionId]) : new Set()}
          onSort={(column, direction) => {
            // Every header sorts except the running Balance (which stays in its
            // chronological order regardless — see transactionsWithBalance).
            const sortableFields = ['date', 'description', 'category', 'tags', 'payment', 'deposit', 'amount', 'notes'] as const;
            if ((sortableFields as readonly string[]).includes(column)) {
              setSortField(column as typeof sortField);
              setSortDirection(direction);
            }
          }}
          sortColumn={sortField}
          sortDirection={sortDirection}
          onColumnReorder={handleColumnReorder}
          onColumnResize={handleColumnResize}
          emptyMessage="No transactions found"
          threshold={50}
          className="virtualized-table bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-[#6B86B3] h-full"
          headerClassName="bg-[#1a2332] dark:bg-gray-700 text-white"
          rowClassName={(row: DisplayRow) => {
            if (isOpeningBalanceRow(row)) {
              return 'bg-blue-50/60 dark:bg-blue-900/20 italic';
            }
            const isSelected = selectedTransactionId === row.id;
            return isSelected ? 'selected-transaction-row' : '';
          }}
        />
      </div>

      {/* Bottom dock — ONE always-visible bar (hidden only in expanded mode):
          editing the selected row, or adding a new transaction when nothing
          is selected. */}
      {!tableExpanded && quickEditTarget && !isEditModalOpen && (
        <QuickEditTransactionPanel
          transaction={quickEditTarget}
          onNext={
            getNextTransactionId(quickEditTarget.id)
              ? () => { advanceToNextTransaction(quickEditTarget.id); }
              : undefined
          }
          onClose={() => {
            setSelectedTransactionId(null);
            setSelectedTransaction(null);
          }}
        />
      )}

      {/* Quick Add Transaction (the dock's default mode) */}
      {!tableExpanded && !(quickEditTarget && !isEditModalOpen) && (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 px-4 py-3">
        <form onSubmit={handleQuickAdd}>
          {/* Row 1: Date | Type | Description */}
          <div className="flex items-end gap-3">
            <div className="w-[160px] shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Date</label>
              <DatePicker
                value={quickAddForm.date}
                onChange={(val) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, date: val }); }}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white text-xs"
                aria-label="Transaction date"
              />
            </div>

            <div className="shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Type</label>
              <div className="flex gap-0.5 items-center h-[32px] bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                {([
                  { value: 'expense', label: 'Exp', activeColor: 'text-red-600 dark:text-red-400' },
                  { value: 'income', label: 'Inc', activeColor: 'text-green-600 dark:text-green-400' },
                  { value: 'transfer', label: 'Txfr', activeColor: 'text-emerald-700 dark:text-emerald-400' },
                ] as const).map(({ value, label, activeColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, type: value }); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      quickAddForm.type === value
                        ? `bg-white dark:bg-gray-600 shadow-sm ${activeColor}`
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Description</label>
              <input
                type="text"
                placeholder="Description"
                value={quickAddForm.description}
                onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, description: e.target.value }); }}
                className="w-full px-2.5 py-1.5 h-[32px] text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                required
              />
            </div>
          </div>

          {/* Row 2: Category | Amount | Add */}
          <div className="flex items-end gap-3 mt-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">
                {quickAddForm.type === 'transfer' ? 'To Account' : 'Category'}
              </label>
              {quickAddForm.type === 'transfer' ? (
                <select
                  value={quickAddForm.category}
                  onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, category: e.target.value }); }}
                  className="w-full px-2.5 py-1.5 h-[32px] text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option value="">Select account...</option>
                  {accounts
                    .filter(acc => acc.id !== account?.id)
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                </select>
              ) : (
                <CategorySelector
                  selectedCategory={quickAddForm.category}
                  onCategoryChange={(categoryId) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, category: categoryId }); }}
                  transactionType={quickAddForm.type}
                  placeholder="Category..."
                  allowCreate={false}
                />
              )}
            </div>

            <div className="w-[120px] shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={quickAddForm.amount}
                onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, amount: e.target.value }); }}
                className="w-full px-2.5 py-1.5 h-[32px] text-xs text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="shrink-0 px-4 py-1.5 h-[32px] text-xs bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-1"
              title="Add Transaction"
            >
              <PlusIcon size={14} />
              Add
            </button>
          </div>

          {quickAddError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{quickAddError}</p>
          )}
        </form>
      </div>
      )}
      </div>

      {/* Edit Modal */}
      {selectedTransaction && (
        <EditTransactionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTransaction(null);
            setSelectedTransactionId(null);
          }}
          transaction={selectedTransaction}
          onSaveAndNext={
            getNextTransactionId(selectedTransaction.id)
              ? () => {
                  if (!advanceToNextTransaction(selectedTransaction.id)) {
                    setIsEditModalOpen(false);
                    setSelectedTransaction(null);
                    setSelectedTransactionId(null);
                  }
                }
              : undefined
          }
        />
      )}
      
      {/* Delete Confirmation */}
      {deleteConfirmTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Delete Transaction</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{deleteConfirmTransaction.description}"?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmTransaction(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
