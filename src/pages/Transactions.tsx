import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams , useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { Suspense } from 'react';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';

// Lazy load heavy modals to improve initial page load
const EditTransactionModal = lazyWithRecovery(() => import('../components/EditTransactionModal'));
const TransactionDetailsView = lazyWithRecovery(() => import('../components/TransactionDetailsView'));
const QuickDateFilters = lazyWithRecovery(() => import('../components/QuickDateFilters'));
import { CalendarIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, TrendingUpIcon, TrendingDownIcon } from '../components/icons';
import DatePicker from '../components/common/DatePicker';
import GroupedAccountOptions from '../components/common/GroupedAccountOptions';
import { Modal, ModalBody } from '../components/common/Modal';
import type { Transaction } from '../types';
import type { DecimalTransaction, DecimalInstance } from '../types/decimal-types';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import TransactionContextMenu from '../components/TransactionContextMenu';
import { useToast } from '../contexts/ToastContext';
import { TransactionRow } from '../components/TransactionRow';
import { transactionRowDomId } from '../components/transactionRowDomId';
import { countAwaitingReview, isAwaitingReview } from '../utils/transactionReview';
// Lazy load list components that are conditionally rendered
const InfiniteScrollTransactionList = lazyWithRecovery(() => import('../components/InfiniteScrollTransactionList').then(m => ({ default: m.InfiniteScrollTransactionList })));
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { compareChronological } from '../utils/transactionSort';
import { useDebounce } from '../hooks/useDebounce';
import { SkeletonTableRow, SkeletonList } from '../components/loading/Skeleton';

const Transactions = React.memo(function Transactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { transactions, accounts, deleteTransaction, updateTransaction, categories, getDecimalTransactions } = useApp();
  const { compactView, setCompactView: _setCompactView, currency: displayCurrency } = usePreferences();
  const { isWideView } = useLayout();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense' | 'net' | null>(null);
  // Sorting for the breakdown popup's headers (house convention: every
  // drilled-into transaction list sorts by its columns).
  const [breakdownSortKey, setBreakdownSortKey] = useState<'date' | 'description' | 'account' | 'amount'>('date');
  const [breakdownSortDir, setBreakdownSortDir] = useState<1 | -1>(-1);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(20); // Increased for better UX
  const [sortField, setSortField] = useState<'date' | 'account' | 'description' | 'category' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  /**
   * The ONE row the keyboard is on — the register's highlight, on this table.
   *
   * There is no bulk-selection mode here to fight with, and that is a fact
   * rather than a hope: the page carried a `bulkSelectMode` flag whose setter
   * was never called and a selected-id set that nothing could ever add to, so
   * the desktop row's click did nothing at all and the phone list's checkboxes
   * could never appear. Both are gone; the click was free, and this is what
   * now has it. If a bulk mode is ever wanted here, TransactionRow still has
   * the props for it and states which of the two wins the click.
   */
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  /**
   * "Show me only what has arrived and not been dealt with" — the register's
   * To Review box, pressed.
   */
  const [reviewOnly, setReviewOnly] = useState(false);
  const [columnWidths, setColumnWidths] = useState({
    date: 110,
    // Room for the header word: this column is headed C/R, not R, because it
    // now draws both of Money's letters.
    reconciled: 56,
    account: 140,
    description: 260,
    category: 160,
    amount: 110,
    balance: 110,
    actions: 80
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [columnOrder, setColumnOrder] = useState(['date', 'reconciled', 'account', 'description', 'category', 'amount', 'balance', 'actions']);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; transaction: Transaction } | null>(null);

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

  // Soft archive: hide archived transactions from the live register unless the
  // user opts to show them. Reports read the full context set, not this — so
  // hiding here never affects any report or balance.
  const archivedCount = useMemo(() => transactions.reduce((n, t) => n + (t.archived ? 1 : 0), 0), [transactions]);
  const liveTransactions = useMemo(
    () => (showArchived ? transactions : transactions.filter(t => !t.archived)),
    [transactions, showArchived]
  );

  const { transactions: filteredAndSortedTransactions, getCategoryPath } = useTransactionFilters(
    liveTransactions,
    accounts,
    categories,
    filterOptions,
    sortOptions
  );

  /**
   * How many of the rows in front of the user have arrived and not been dealt
   * with — the figure in the To Review box.
   *
   * COUNTED OVER THE ROWS THIS PAGE IS SHOWING, deliberately, and not over the
   * whole book. The box is a button: pressing it must produce exactly this many
   * rows, or the number is a lie the moment it is believed. The register counts
   * the same predicate over its own filtered list for the same reason.
   *
   * `reviewOnly` is deliberately NOT a dependency: this counts the list BEFORE
   * the review filter, so pressing the button cannot change the number the
   * button is showing.
   */
  const toReviewCount = useMemo(
    () => countAwaitingReview(filteredAndSortedTransactions),
    [filteredAndSortedTransactions]
  );

  /**
   * Nothing left to review ends the filter, rather than leaving somebody
   * looking at an empty list with the button that got them there gone (the box
   * hides itself at zero — the house rule that a zero count renders nothing).
   *
   * Cannot loop: toReviewCount is computed from the list above, without it.
   */
  useEffect(() => {
    if (toReviewCount === 0) setReviewOnly(false);
  }, [toReviewCount]);

  /**
   * The rows the page actually lists. One more filter on the end of the chain,
   * applied here rather than inside the hook so the count above can be taken
   * from the list without it.
   */
  const visibleTransactions = useMemo(
    () => (reviewOnly ? filteredAndSortedTransactions.filter(isAwaitingReview) : filteredAndSortedTransactions),
    [filteredAndSortedTransactions, reviewOnly]
  );

  // Get account ID from URL params
  const accountIdFromUrl = searchParams.get('account');
  
  // Set filter from URL on mount
  useEffect(() => {
    if (accountIdFromUrl) {
      setFilterAccountId(accountIdFromUrl);
    }
  }, [accountIdFromUrl]);

  // Simulate loading state
  useEffect(() => {
    // Set loading to false once we have data
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);


  // Sort handler
  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  }, [sortField, sortDirection]);

  // Handle column resize
  const handleMouseDown = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column as keyof typeof columnWidths]);
  }, [columnWidths]);

  // Column configuration with display names and properties (defined before use in callbacks)
  const columnConfig = useMemo(() => ({
    date: {
      label: 'Date',
      sortable: true,
      className: 'text-left',
      cellClassName: 'pl-7 pr-6',
      hidden: ''
    },
    reconciled: {
      // The register's own header, because the column now draws the register's
      // own two letters: C is a mark made while balancing, R is a
      // reconciliation that was finished. A column headed R that showed both
      // would be naming one of the two states it holds.
      label: 'C/R',
      sortable: false,
      className: 'text-center',
      cellClassName: 'px-2',
      hidden: ''
    },
    account: {
      label: 'Account',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: ''
    },
    description: {
      label: 'Description',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: ''
    },
    category: {
      label: 'Category',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: 'hidden sm:table-cell'
    },
    amount: {
      label: 'Amount',
      sortable: true,
      className: 'text-right',
      cellClassName: 'px-6',
      hidden: ''
    },
    balance: {
      label: 'Balance',
      sortable: false,
      className: 'text-right',
      cellClassName: 'px-6',
      hidden: 'hidden xl:table-cell'
    },
    actions: {
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      cellClassName: 'pl-6 pr-7',
      hidden: ''
    }
  }), []);

  // Handle column drag start
  const handleDragStart = useCallback((column: string, e: React.DragEvent) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
    
    // Create a custom drag image with enhanced styling
    const dragImage = document.createElement('div');
    dragImage.innerHTML = columnConfig[column as keyof typeof columnConfig].label;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 12px 24px;
      background: rgba(107, 134, 179, 0.95);
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(10px);
      z-index: 1000;
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, [columnConfig]);

  // Handle column drag over
  const handleDragOver = useCallback((column: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  }, []);

  // Handle column drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // Handle column drop
  const handleDrop = useCallback((targetColumn: string, e: React.DragEvent) => {
    e.preventDefault();
    const draggedColumn = e.dataTransfer.getData('text/plain');
    
    if (draggedColumn && draggedColumn !== targetColumn) {
      const newOrder = [...columnOrder];
      const draggedIndex = newOrder.indexOf(draggedColumn);
      const targetIndex = newOrder.indexOf(targetColumn);
      
      // Remove dragged column from its current position
      newOrder.splice(draggedIndex, 1);
      
      // Insert dragged column at target position
      newOrder.splice(targetIndex, 0, draggedColumn);
      
      setColumnOrder(newOrder);
    }
    
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [columnOrder]);


  // Add mouse event listeners when resizing
  React.useEffect(() => {
    if (isResizing) {
      const handleMouseMoveEvent = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        
        setColumnWidths(prev => ({
          ...prev,
          [isResizing]: newWidth
        }));
      };

      const handleMouseUpEvent = () => {
        setIsResizing(null);
      };

      document.addEventListener('mousemove', handleMouseMoveEvent);
      document.addEventListener('mouseup', handleMouseUpEvent);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveEvent);
        document.removeEventListener('mouseup', handleMouseUpEvent);
      };
    }
  }, [isResizing, startX, startWidth]);


  // Pagination logic - show all transactions if account is selected
  const showAllTransactions = !!accountIdFromUrl;
  const totalPages = showAllTransactions ? 1 : Math.ceil(visibleTransactions.length / transactionsPerPage);
  const startIndex = showAllTransactions ? 0 : (currentPage - 1) * transactionsPerPage;
  const endIndex = showAllTransactions ? visibleTransactions.length : startIndex + transactionsPerPage;
  const paginatedTransactions = visibleTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Add this to filter change handlers
  const handleFilterChange = useCallback(<T,>(filterSetter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    filterSetter(value);
    resetPagination();
  }, [resetPagination]);


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

  // ── Picking a row out, and walking the list ────────────────────────────────
  //
  // The register's idiom, on this table: a click highlights the row, the arrows
  // move the highlight, Enter opens whatever a click opens, Escape lets go.
  //
  // ─ WHY THE ROWS ARE READ THROUGH A REF ────────────────────────────────────
  // TransactionRow is memoised on a hand-written comparator, so a handler whose
  // identity changed with the selection would be either stale in every row or
  // the cause of every row re-rendering on each arrow key — and this table has
  // an "All transactions" page size. The two handlers below therefore keep ONE
  // identity for the life of the page and read what they need from here.
  //
  // The rows are the ones ON SCREEN. The ends stop rather than wrap and rather
  // than turning the page: the highlight can only ever be somewhere the user
  // can see it, which is also why a row hidden by a filter or left on another
  // page simply stops being the highlight without anything having to notice.
  const navigationRef = useRef<{ rows: Transaction[]; selectedId: string | null }>({
    rows: [],
    selectedId: null
  });
  useEffect(() => {
    navigationRef.current = { rows: paginatedTransactions, selectedId: selectedTransactionId };
  }, [paginatedTransactions, selectedTransactionId]);

  /**
   * Highlight `id` and hand it the focus.
   *
   * The row is already rendered — only its tabindex changes — so it can be
   * given the focus by name. `preventScroll` with `scrollIntoView({ block:
   * 'nearest' })` after it: browsing wants the least scroll that shows the row,
   * and none at all while it is already on screen. (The register centres
   * instead, but only while a row is being EDITED, and no row is edited here.)
   */
  const selectRow = useCallback((id: string): void => {
    setSelectedTransactionId(id);
    const node = document.getElementById(transactionRowDomId(id));
    node?.focus({ preventScroll: true });
    node?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  /**
   * A click on a row: the first one picks it out, a second on the same row
   * opens it.
   *
   * The second click is the register's own idiom (there, a click on the row it
   * is already editing asks for the full editor), and it opens exactly what
   * clicking the description has always opened here — one destination, so the
   * two cannot drift.
   */
  const handleRowClick = useCallback((transaction: Transaction): void => {
    if (navigationRef.current.selectedId === transaction.id) {
      handleView(transaction);
      return;
    }
    selectRow(transaction.id);
  }, [handleView, selectRow]);

  /**
   * The keys, on the row that has the focus.
   *
   * On the ROW rather than on the page or the window, which is what keeps them
   * out of everything else's way: the search box, a filter, a sortable column
   * header or one of the row's own buttons has the focus while it is being
   * used, so the arrows never reach this at all — by construction, not by a
   * list of exceptions. The row's own handler has already refused any key that
   * was pressed inside one of its boxes.
   *
   * Everything claimed is also stopped: the app carries a window-level shortcut
   * listener, and an Escape or an Enter it sees after this page has answered it
   * would be one gesture doing two things.
   */
  const handleRowKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLTableRowElement>,
    transaction: Transaction
  ): void => {
    const { rows, selectedId } = navigationRef.current;
    const claim = (): void => {
      event.preventDefault();
      event.stopPropagation();
    };
    /**
     * Walk by `delta`, or land on the row the key was pressed on.
     *
     * -1 covers both "nothing is highlighted" and "the highlight is on a row
     * this page no longer shows" — in either case the key is an arrival on the
     * row under the user's hand, and jumping to a neighbour of nowhere would be
     * a surprise.
     */
    const move = (delta: number): void => {
      if (rows.length === 0) return;
      const currentIndex = selectedId === null ? -1 : rows.findIndex(row => row.id === selectedId);
      const next = currentIndex === -1
        ? transaction
        : rows[Math.min(rows.length - 1, Math.max(0, currentIndex + delta))];
      if (next === undefined) return;
      selectRow(next.id);
    };

    switch (event.key) {
      case 'ArrowDown':
        claim();
        move(1);
        break;
      case 'ArrowUp':
        claim();
        move(-1);
        break;
      case 'Home':
        claim();
        if (rows[0]) selectRow(rows[0].id);
        break;
      case 'End':
        claim();
        if (rows[rows.length - 1]) selectRow(rows[rows.length - 1].id);
        break;
      case 'Enter':
        claim();
        // Whatever a click opens — the transaction's details. One call, so
        // the keyboard and the mouse cannot end up at different screens.
        handleView(transaction);
        break;
      case 'Escape':
        // Claimed ONLY when there is something to let go of. Escape belongs to
        // whatever layer is outermost, and a list holding nothing is not a
        // layer — the register and the Accounts list keep the same rule.
        if (selectedId === null) return;
        claim();
        // The focus stays where it is: the user is still standing here, they
        // have simply stopped pointing at anything.
        setSelectedTransactionId(null);
        break;
      default:
        break;
    }
  }, [handleView, selectRow]);

  /**
   * The single tab stop for the whole table (see TransactionRow's isTabStop):
   * the highlighted row while it is on screen, and otherwise the first row, so
   * Tab always lands somewhere the arrows can start from.
   */
  const tabStopRowId = selectedTransactionId !== null
    && paginatedTransactions.some(t => t.id === selectedTransactionId)
    ? selectedTransactionId
    : paginatedTransactions[0]?.id;

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleCloseDetailsView = useCallback(() => {
    setIsDetailsViewOpen(false);
    setViewingTransaction(null);
  }, []);

  // Calculate totals using decimal arithmetic
  const totals = useMemo(() => {
    const decimalTransactions = getDecimalTransactions();
    const filteredIds = new Set(visibleTransactions.map(t => t.id));
    
    return decimalTransactions
      .filter((t: DecimalTransaction) => filteredIds.has(t.id))
      .reduce((acc: { income: DecimalInstance, expense: DecimalInstance, net: DecimalInstance }, t: DecimalTransaction) => {
        if (t.type === 'income') {
          acc.income = acc.income.plus(t.amount);
        } else if (t.type === 'expense') {
          acc.expense = acc.expense.plus(t.amount);
        }
        return acc;
      }, {
        income: toDecimal(0),
        expense: toDecimal(0),
        get net() { return this.income.plus(this.expense); } // expenses are already negative
      });
  }, [visibleTransactions, getDecimalTransactions]);

  // Each transaction's running balance for ITS account.
  //
  // compareChronological, the same order the account register accumulates in
  // and the same order useTransactionFilters displays a Date sort in. A local
  // date-only sort left same-day rows to Array.prototype.sort's stability,
  // which is not the same answer as the display's — so the newest row of a day
  // did not carry the account's balance. Decimal, because a float running total
  // over a whole account's history drifts.
  const runningBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();
    const allSorted = [...transactions].sort(compareChronological);

    const accountBalances = new Map<string, DecimalInstance>();
    accounts.forEach(acc => accountBalances.set(acc.id, toDecimal(acc.openingBalance ?? 0)));

    allSorted.forEach(t => {
      const current = accountBalances.get(t.accountId) ?? toDecimal(0);
      const next = current.plus(toDecimal(t.amount));
      accountBalances.set(t.accountId, next);
      balanceMap.set(t.id, next.toNumber());
    });

    return balanceMap;
  }, [transactions, accounts]);

  // Flat category list for inline editing
  const flatCategories = useMemo(() => {
    return categories.map(c => ({ id: c.id, name: c.name }));
  }, [categories]);

  // Handle inline category update — failures must be visible, never silent.
  //
  // ONLY the category is sent. Spreading the whole row used to re-send its
  // stored `categoryConfirmed: false` alongside the new category, and an
  // explicit flag beats the "changing a category is vouching for it" rule in
  // both the RPC and its local twin — so the user's own deliberate choice came
  // back still branded a guess.
  const handleUpdateCategory = useCallback((transactionId: string, categoryId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      void updateTransaction(transactionId, { category: categoryId })
        .then(() => showSuccess('Category updated'))
        .catch((error: unknown) => showError(error));
    }
  }, [transactions, updateTransaction, showSuccess, showError]);

  // Handle inline amount update — failures must be visible, never silent.
  const handleUpdateAmount = useCallback((transactionId: string, amount: number) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      void updateTransaction(transactionId, { ...transaction, amount })
        .then(() => showSuccess('Amount updated'))
        .catch((error: unknown) => showError(error));
    }
  }, [transactions, updateTransaction, showSuccess, showError]);

  // Get filtered account name for display
  const filteredAccount = filterAccountId ? accounts.find(a => a.id === filterAccountId) : null;

  // Render table header cell
  const renderHeaderCell = useCallback((columnKey: string) => {
    const config = columnConfig[columnKey as keyof typeof columnConfig];
    if (!config) return null;

    const isDragging = draggedColumn === columnKey;
    const isDragOver = dragOverColumn === columnKey;

    return (
      <th
        key={columnKey}
        draggable={!isResizing}
        onDragStart={(e) => handleDragStart(columnKey, e)}
        onDragOver={(e) => handleDragOver(columnKey, e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(columnKey, e)}
        className={`px-6 ${compactView ? 'py-2' : 'py-3'} ${config.className} text-sm font-semibold text-white dark:text-gray-200 uppercase tracking-wider ${
          config.sortable ? 'cursor-pointer hover:text-white/80 dark:hover:text-gray-100' : ''
        } ${config.hidden || ''} relative ${
          isDragging ? 'opacity-70 shadow-2xl border-2 border-white/50 dark:border-gray-300/50 bg-white/10 dark:bg-gray-700/50 transform scale-105 z-50' : ''
        } ${
          isDragOver ? 'bg-white/20 border-l-4 border-l-white/80 dark:border-l-gray-300/80 before:absolute before:top-0 before:left-0 before:w-full before:h-full before:bg-white/10 before:animate-pulse' : ''
        } transition-all duration-200 ease-in-out`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={config.sortable && ['date', 'account', 'description', 'category', 'amount'].includes(columnKey) ? () => handleSort(columnKey as 'date' | 'account' | 'description' | 'category' | 'amount') : undefined}
        role="columnheader"
        aria-sort={sortField === columnKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        tabIndex={config.sortable ? 0 : -1}
        onKeyDown={config.sortable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (['date', 'account', 'description', 'category', 'amount'].includes(columnKey)) {
              handleSort(columnKey as 'date' | 'account' | 'description' | 'category' | 'amount');
            }
          }
        } : undefined}
        aria-label={`${config.label} column${config.sortable ? ', sortable' : ''}${sortField === columnKey ? `, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      >
        <div className="flex items-center gap-1" style={{ justifyContent: config.className === 'text-right' ? 'flex-end' : 'flex-start' }}>
          {config.label}
          {config.sortable && sortField === columnKey && (
            <span className="font-bold text-white dark:text-gray-200">
              {sortDirection === 'asc' ? <ChevronUpIcon size={18} strokeWidth={3} /> : <ChevronDownIcon size={18} strokeWidth={3} />}
            </span>
          )}
        </div>
        <div 
          className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[#5A729A] dark:bg-gray-600"
          onMouseDown={(e) => handleMouseDown(columnKey, e)}
        />
      </th>
    );
  }, [columnConfig, draggedColumn, dragOverColumn, isResizing, compactView, columnWidths, sortField, sortDirection, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleSort, handleMouseDown]);


  return (
    <PageWrapper 
      title="Transactions"
      headerContent={
        filteredAccount && (
          <p className="text-sm text-white/80 mt-1 ml-4">
            Showing transactions for: <span className="font-semibold">{filteredAccount.name}</span>
          </p>
        )
      }
      rightContent={
        <div className="flex items-center gap-2">
          {/* Same affordance Accounts has: add from the page header. Opens
              via the ?action=add deep link Layout already honours, so the
              header button, the mobile + menu and any future entry point
              share ONE code path. */}
          <button
            onClick={() => {
              const params = new URLSearchParams(location.search);
              params.set('action', 'add');
              navigate({ pathname: '/transactions', search: params.toString() });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white text-sm font-medium rounded-lg hover:bg-[#2d3a4d] transition-colors shadow-sm"
            title="Add Transaction"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Transaction
          </button>
          {/* Compact View Toggle - Hidden but kept in code */}
          {/* <div 
            onClick={() => setCompactView(!compactView)}
            className="cursor-pointer"
            title={compactView ? "Switch to normal view" : "Switch to compact view"}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
              
            >
              <circle
                cx="24"
                cy="24"
                r="24"
                fill="#D9E1F2"
                className="transition-all duration-200"
                onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
              />
              {compactView ? (
                <g transform="translate(12, 12)">
                  <path 
                    d="M8 3H5a2 2 0 00-2 2v3m0 0h18M3 8v8a2 2 0 002 2h3m0 0v3m0-3h8m0 3v-3m0 0h3a2 2 0 002-2v-3m0 0V8m0 0V5a2 2 0 00-2-2h-3" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>
              ) : (
                <g transform="translate(12, 12)">
                  <path 
                    d="M3 8V5a2 2 0 012-2h3M3 8h18M3 8v8a2 2 0 002 2h3m13-10v8a2 2 0 01-2 2h-3m0 0v3m0-3H8m8 3v-3m0-10V3m0 0h3a2 2 0 012 2v3M16 3H8" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>
              )}
            </svg>
          </div> */}
          
          {/* Wide View Toggle and Add Transaction buttons removed */}
        </div>
      }
    >
      <div className={isWideView ? "w-[100vw] relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw] px-4 md:px-6 lg:px-8" : ""}>
        {/* Main content grid with consistent spacing */}
        <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => setBreakdownType('income')}
          className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Income</p>
              <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.income, displayCurrency)}</p>
            </div>
            <TrendingUpIcon className="text-green-500" size={20} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setBreakdownType('expense')}
          className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense, displayCurrency)}</p>
            </div>
            <TrendingDownIcon className="text-red-500" size={20} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setBreakdownType('net')}
          className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Net Cash Flow</p>
              <p className={`text-lg md:text-xl font-bold ${totals.net.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totals.net, displayCurrency)}
              </p>
            </div>
            <CalendarIcon className="text-primary" size={20} />
          </div>
        </button>
        </div>

        {/* Filters and Search */}
        <div className="pt-4">
          <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="space-y-3">
          {/* Search Input */}
          <div className="w-full">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm md:text-base bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="type-filter" className="sr-only">Transaction type filter</label>
              <select
                id="type-filter"
                className="w-full px-3 py-2 text-sm md:text-base bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterType}
                onChange={(e) => handleFilterChange(setFilterType)(e.target.value as 'all' | 'income' | 'expense')}
                aria-label="Filter transactions by type"
              >
                <option value="all">All Types</option>
                <option value="income">Income Only</option>
                <option value="expense">Expenses Only</option>
              </select>
            </div>
            
            {/* Account Filter */}
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="account-filter" className="sr-only">Account filter</label>
              <select
                id="account-filter"
                className="w-full px-3 py-2 text-sm md:text-base bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterAccountId}
                onChange={(e) => handleFilterChange(setFilterAccountId)(e.target.value)}
                aria-label="Filter transactions by account"
              >
                <option value="">All Accounts</option>
                {/* Banded into the app's account sections, alphabetical inside
                    each — the same list the Accounts page shows. */}
                <GroupedAccountOptions accounts={accounts} />
              </select>
            </div>
          </div>
          
          {/* Quick Date Filters */}
          <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />}>
            <QuickDateFilters 
              onDateRangeSelect={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                resetPagination();
              }}
              currentFrom={dateFrom}
              currentTo={dateTo}
            />
          </Suspense>
          
          {/* Custom Date Range — label on its own line, the two pickers as
              equal halves beneath it on phones; the single wrapping row from
              sm up. */}
          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
            <span className="col-span-2 sm:col-auto text-sm font-medium text-gray-700 dark:text-gray-300">Custom Range:</span>
            <div className="min-w-0 sm:flex-1 sm:min-w-[150px]">
              <DatePicker
                id="date-from"
                value={dateFrom}
                onChange={(val) => handleFilterChange(setDateFrom)(val)}
                className="bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                aria-label="Filter from date"
              />
            </div>
            <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">to</span>
            <div className="min-w-0 sm:flex-1 sm:min-w-[150px]">
              <DatePicker
                id="date-to"
                value={dateTo}
                onChange={(val) => handleFilterChange(setDateTo)(val)}
                className="bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                aria-label="Filter to date"
              />
            </div>
          </div>

          {/* To Review — how many rows have arrived and not been dealt with,
              and the switch that narrows the list to exactly them. The
              register's box, in the same words and the same colours.

              NOTHING AT ZERO. Not a greyed-out button, not "To Review 0" — the
              house rule is that a zero count renders nothing, because a
              permanent box reading 0 is a box the eye learns to skip, and then
              it says nothing on the day it reads 40.

              It is here rather than nowhere because the bold in the list has to
              lead somewhere: marking rows as new on a page that offered no way
              to work through them was the reason this page did not mark them at
              all (see SwipeableTransactionRow's markNewArrivals). Not redundant
              with the filters above it either — none of type, account, date or
              search can express "arrived and not dealt with". */}
          {toReviewCount > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => { setReviewOnly(prev => !prev); resetPagination(); }}
                aria-pressed={reviewOnly}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                  reviewOnly
                    ? 'border-[#1a2332] dark:border-blue-500 text-[#1a2332] dark:text-blue-400 bg-gray-50 dark:bg-gray-700'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={
                  reviewOnly
                    ? 'Showing only transactions that have arrived and not been dealt with. Click to show them all again.'
                    : 'Transactions that arrived from an import and have not been saved yet. Click to show only those.'
                }
              >
                To Review
                {/* Amber, the colour this app already uses for "this wants your
                    attention". The number is the point, so it carries the
                    colour rather than the whole button. */}
                <span className="inline-flex items-center px-1.5 py-0 rounded-full text-xs font-semibold tabular-nums bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {toReviewCount}
                </span>
              </button>
            </div>
          )}

          {/* Archived transactions toggle — only shown when some exist */}
          {archivedCount > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <input
                id="show-archived"
                type="checkbox"
                checked={showArchived}
                onChange={(e) => { setShowArchived(e.target.checked); resetPagination(); }}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="show-archived" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                Show {archivedCount.toLocaleString()} archived transaction{archivedCount === 1 ? '' : 's'}
              </label>
            </div>
          )}
        </div>
        </div>
        </div>

        {/* Transactions List */}
        {visibleTransactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {transactions.length === 0 
              ? "No transactions yet. Add transactions from within an account."
              : searchQuery 
                ? `No transactions found for "${searchQuery}"`
                : "No transactions match your filters."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Swipeable List View with Infinite Scroll */}
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-4">
            {isLoading ? (
              <SkeletonList items={5} className="p-4" />
            ) : (
              <Suspense fallback={<SkeletonList items={5} className="p-4" />}>
                <InfiniteScrollTransactionList
                  transactions={visibleTransactions} // Use all filtered transactions, not paginated
                  accounts={accounts}
                  categories={categories}
                  formatCurrency={formatCurrency}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={handleView}
                  // The phone gets the mark too, now that this page carries the
                  // To Review counter and filter that make it a job rather than
                  // a decoration — see the prop's own note.
                  markNewArrivals
                  itemsPerBatch={20}
                />
              </Suspense>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className={`hidden lg:block bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 ${isWideView ? 'w-full' : ''}`} style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
            {isLoading ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#1a2332] dark:bg-gray-700 border-b border-[#2d3a4d] dark:border-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Account</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Description</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200 hidden sm:table-cell">Category</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-white dark:text-gray-200">Amount</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-white dark:text-gray-200 hidden xl:table-cell">Balance</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-white dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(10)].map((_, index) => (
                      <SkeletonTableRow key={index} columns={6} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={isWideView ? '' : 'overflow-x-auto'} role="region" aria-label="Transactions table">
                <table className="w-full" style={{ tableLayout: 'fixed' }} role="table" aria-label="Financial transactions">
                {/* Says what the keys actually do now. It used to promise
                    "Enter to sort", which was only ever true with a column
                    header focused — a screen-reader user who took it at its
                    word on a row got a transaction opened instead. */}
                <caption className="sr-only">
                  List of financial transactions. Tab into the list, then use the up and down arrow keys to move between
                  transactions, Enter to open the highlighted one, and Escape to let go of it. On a column header, Enter
                  sorts by that column.
                </caption>
                <thead className="bg-[#1a2332] dark:bg-gray-700 border-b border-[#2d3a4d] dark:border-gray-600 sticky top-0 z-10">
                  <tr role="row">
                    {columnOrder.map(renderHeaderCell)}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedTransactions.map((transaction) => {
                    const account = accounts.find(a => a.id === transaction.accountId);
                    const categoryPath = getCategoryPath(transaction.category, transaction);
                    
                    return (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        account={account}
                        categoryPath={categoryPath}
                        compactView={compactView}
                        formatCurrency={formatCurrency}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onView={handleView}
                        columnOrder={columnOrder}
                        columnWidths={columnWidths}
                        isCurrentRow={selectedTransactionId === transaction.id}
                        isTabStop={tabStopRowId === transaction.id}
                        onRowClick={handleRowClick}
                        onRowKeyDown={handleRowKeyDown}
                        runningBalance={runningBalances.get(transaction.id)}
                        onContextMenu={(e, t) => setContextMenu({ x: e.clientX, y: e.clientY, transaction: t })}
                        categories={flatCategories}
                        onUpdateCategory={handleUpdateCategory}
                        onUpdateAmount={handleUpdateAmount}
                      />
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
            </div>
            
            {/* Pagination Controls - Desktop Only (Mobile uses infinite scroll) */}
            {totalPages > 1 && (
              <div>
              <div className="hidden lg:block px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `Showing all ${visibleTransactions.length} transactions`
                      : `Showing ${startIndex + 1} to ${Math.min(endIndex, visibleTransactions.length)} of ${visibleTransactions.length} transactions`
                    }
                  </span>
                  <label htmlFor="per-page-desktop" className="sr-only">Items per page</label>
                  <select
                    id="per-page-desktop"
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? visibleTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-sm bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    aria-label="Select number of transactions per page"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value="all">All transactions</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to previous page"
                  >
                    <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Show first page */}
                    {currentPage > 3 && (
                      <>
                        <button
                          onClick={() => setCurrentPage(1)}
                          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          1
                        </button>
                        {currentPage > 4 && <span className="text-gray-500 dark:text-gray-400">...</span>}
                      </>
                    )}
                    
                    {/* Show pages around current */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      if (pageNum > totalPages - 3 && currentPage < totalPages - 2) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm rounded ${
                            currentPage === pageNum
                              ? 'bg-[#1a2332] text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {/* Show last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && <span className="text-gray-500 dark:text-gray-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to next page"
                  >
                    <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Pagination Controls - Hidden: Using Infinite Scroll Instead */}
            <div className="hidden lg:hidden bg-white dark:bg-gray-800 rounded-2xl shadow-lg px-4 py-3 border border-gray-100 dark:border-gray-700">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `All ${visibleTransactions.length}`
                      : `${startIndex + 1}-${Math.min(endIndex, visibleTransactions.length)} of ${visibleTransactions.length}`
                    }
                  </span>
                  <label htmlFor="per-page-mobile" className="sr-only">Items per page</label>
                  <select
                    id="per-page-mobile"
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? visibleTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    aria-label="Select number of transactions per page"
                  >
                    <option value={5}>5/page</option>
                    <option value={10}>10/page</option>
                    <option value={20}>20/page</option>
                    <option value={50}>50/page</option>
                    <option value={100}>100/page</option>
                    <option value="all">All</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to previous page"
                  >
                    <ChevronLeftIcon size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Simplified pagination for mobile */}
                    <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to next page"
                  >
                    <ChevronRightIcon size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            </div>
            )}
          </>
        )}

      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
        <EditTransactionModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal}
          transaction={editingTransaction}
        />
      </Suspense>

      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
        <TransactionDetailsView
          isOpen={isDetailsViewOpen}
          onClose={handleCloseDetailsView}
          transaction={viewingTransaction}
          accounts={accounts}
          categories={categories}
        />
      </Suspense>
      
      </div>
      </div>
      {/* Income/Expense/Net Breakdown Modal */}
      <Modal
        isOpen={breakdownType !== null}
        onClose={() => setBreakdownType(null)}
        title={breakdownType === 'income' ? 'Income Breakdown' : breakdownType === 'expense' ? 'Expense Breakdown' : 'Net Cash Flow Breakdown'}
        size="md"
      >
        <ModalBody>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                {([
                  ['date', 'Date'],
                  ['description', 'Description'],
                  ['account', 'Account'],
                  ['amount', 'Amount'],
                ] as const).map(([key, label]) => (
                  <th key={key} className="text-center pb-2 font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        if (breakdownSortKey === key) setBreakdownSortDir(d => (d === 1 ? -1 : 1));
                        else { setBreakdownSortKey(key); setBreakdownSortDir(key === 'date' || key === 'amount' ? -1 : 1); }
                      }}
                      className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      title={`Sort by ${label.toLowerCase()}`}
                    >
                      {label}{breakdownSortKey === key ? (breakdownSortDir === 1 ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const txns = visibleTransactions
                  .filter(t => {
                    if (breakdownType === 'income') return t.type === 'income';
                    if (breakdownType === 'expense') return t.type === 'expense';
                    return t.type === 'income' || t.type === 'expense';
                  })
                  .sort((a, b) => {
                    const accName = (t: typeof a): string => accounts.find(x => x.id === t.accountId)?.name ?? '';
                    switch (breakdownSortKey) {
                      case 'description': return breakdownSortDir * a.description.localeCompare(b.description);
                      case 'account': return breakdownSortDir * accName(a).localeCompare(accName(b));
                      case 'amount': return breakdownSortDir * (Math.abs(a.amount) - Math.abs(b.amount));
                      default: return breakdownSortDir * (new Date(a.date).getTime() - new Date(b.date).getTime());
                    }
                  });

                if (txns.length === 0) {
                  return <tr><td colSpan={4} className="text-center py-8 text-gray-400">No transactions</td></tr>;
                }

                return txns.map(t => {
                  const acc = accounts.find(a => a.id === t.accountId);
                  return (
                    <tr key={t.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-2 text-sm text-gray-900 dark:text-white">{t.description}</td>
                      <td className="py-2 text-xs text-gray-500 dark:text-gray-400">{acc?.name}</td>
                      <td className={`py-2 text-sm font-medium text-right whitespace-nowrap ${
                        t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(Math.abs(t.amount), displayCurrency)}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                <td colSpan={3} className="pt-3 text-sm font-semibold text-gray-900 dark:text-white">Total</td>
                <td className={`pt-3 text-sm font-bold text-right ${
                  breakdownType === 'income' ? 'text-green-600 dark:text-green-400'
                    : breakdownType === 'expense' ? 'text-red-600 dark:text-red-400'
                    : totals.net.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(
                    breakdownType === 'income' ? totals.income.toNumber()
                      : breakdownType === 'expense' ? Math.abs(totals.expense.toNumber())
                      : totals.net.toNumber(),
                    displayCurrency
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </ModalBody>
      </Modal>

      {/* Right-click context menu */}
      {contextMenu && (
        <TransactionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          transaction={contextMenu.transaction}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
          onClose={() => setContextMenu(null)}
        />
      )}

      <PageTip
        id="transactions-intro"
        title="Your transactions"
        description="Filter by account, date range, or search by description. Click a transaction to pick it out, then use the arrow keys to move and Enter to open it — the same as in an account register. Right-click any transaction for quick actions. The Balance column shows your running account balance."
      />
    </PageWrapper>
  );
});

export default Transactions;
