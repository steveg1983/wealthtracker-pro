import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeftIcon, CheckCircleIcon } from '../components/icons';
import { useReconciliation } from '../hooks/useReconciliation';
import ReconciliationAccountList, { type ReconciliationGroup } from '../components/reconciliation/ReconciliationAccountList';
import { ALL_ACCOUNT_SECTIONS, sectionTypeForAccount } from '../utils/accountSections';
import ReconciliationBalanceBar from '../components/reconciliation/ReconciliationBalanceBar';
import ReconciliationTransactionList from '../components/reconciliation/ReconciliationTransactionList';
import ReconciliationFinalizationModal from '../components/reconciliation/ReconciliationFinalizationModal';
import EditTransactionModal from '../components/EditTransactionModal';
import { preserveRuntimeControlParams } from '../utils/runtimeMode';
import type { Transaction } from '../types';

export default function Reconciliation() {
  const { transactions, accounts, categories, addTransaction, updateAccount, setTransactionsCleared } = useApp();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    searchParams.get('account') || null
  );
  const navigate = useNavigate();
  // Where the user CAME FROM, captured once — later in-page query rewrites
  // (selecting an account re-writes the whole search string) would drop it.
  // Arriving via an Accounts-page reconcile button means "done" and "Back"
  // both return THERE, not to this page's own account list.
  const [cameFromAccounts] = useState<boolean>(() => searchParams.get('from') === 'accounts');
  // Group + sort for the account list — the same controls (and persistence
  // keys pattern) as the Accounts page, so the two pages always feel the same.
  const [groupBy, setGroupBy] = useState<'type' | 'institution'>(() =>
    (localStorage.getItem('reconciliationGroupBy') as 'type' | 'institution') || 'type'
  );
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'balance-desc' | 'balance-asc'>(() => {
    const stored = localStorage.getItem('reconciliationSortMode');
    return stored === 'name' || stored === 'balance-desc' || stored === 'balance-asc' ? stored : 'default';
  });
  const handleGroupByChange = useCallback((value: 'type' | 'institution') => {
    setGroupBy(value);
    try { localStorage.setItem('reconciliationGroupBy', value); } catch { /* storage unavailable */ }
  }, []);
  const handleSortChange = useCallback((value: 'default' | 'name' | 'balance-desc' | 'balance-asc') => {
    setSortMode(value);
    try { localStorage.setItem('reconciliationSortMode', value); } catch { /* storage unavailable */ }
  }, []);
  // Hide the accounts that are already done — everything cleared AND no bank
  // balance difference — so the list is only the work. Grouping still applies:
  // the filter drops accounts within each section, never the sections shape.
  const [onlyAttention, setOnlyAttention] = useState<boolean>(() =>
    localStorage.getItem('reconciliationOnlyAttention') === 'true'
  );
  const handleOnlyAttentionToggle = useCallback(() => {
    setOnlyAttention(prev => {
      const next = !prev;
      try { localStorage.setItem('reconciliationOnlyAttention', String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Visible transaction order (sorted + filtered) as shown in the list, reported
  // by ReconciliationTransactionList. Drives "Save & Next" so it walks the same
  // order the user sees rather than the raw account order.
  const [visibleOrderIds, setVisibleOrderIds] = useState<string[]>([]);
  // Optimistic cleared-state overlay: the checkbox flips instantly while the
  // write is in flight, and reverts (with an error toast) if it fails.
  const [pendingCleared, setPendingCleared] = useState<Map<string, boolean>>(new Map());

  const overlaidTransactions = useMemo(() => {
    if (pendingCleared.size === 0) return transactions;
    return transactions.map(t => {
      const pending = pendingCleared.get(t.id);
      return pending === undefined ? t : { ...t, cleared: pending };
    });
  }, [transactions, pendingCleared]);

  const {
    reconciliationDetails,
    totalUnreconciledCount,
    computeAccountBalance,
    computeClearedBalance,
    computeClearedSummary,
  } = useReconciliation(accounts, overlaidTransactions);

  // An account needs attention when transactions are still unreconciled, or a
  // stated bank balance disagrees with the cleared balance. difference is
  // Decimal-computed, so a balanced account is exactly 0.
  const attentionCount = useMemo(
    () =>
      reconciliationDetails.filter(
        s => s.unreconciledCount > 0 || (s.difference != null && s.difference !== 0)
      ).length,
    [reconciliationDetails]
  );

  // Build the grouped, sorted account list (same sections as the Accounts page).
  const accountGroups = useMemo<ReconciliationGroup[]>(() => {
    const visibleDetails = onlyAttention
      ? reconciliationDetails.filter(
          s => s.unreconciledCount > 0 || (s.difference != null && s.difference !== 0)
        )
      : reconciliationDetails;

    const sortSummaries = (list: typeof reconciliationDetails) => {
      const sorted = [...list];
      if (sortMode === 'name') sorted.sort((a, b) => a.account.name.localeCompare(b.account.name));
      else if (sortMode === 'balance-desc') sorted.sort((a, b) => b.accountBalance - a.accountBalance);
      else if (sortMode === 'balance-asc') sorted.sort((a, b) => a.accountBalance - b.accountBalance);
      return sorted;
    };

    if (groupBy === 'institution') {
      const byInstitution = new Map<string, typeof reconciliationDetails>();
      for (const s of visibleDetails) {
        const key = s.account.institution || 'Other Accounts';
        (byInstitution.get(key) ?? byInstitution.set(key, []).get(key)!).push(s);
      }
      return [...byInstitution.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([title, summaries]) => ({ title, summaries: sortSummaries(summaries) }));
    }

    // Same aliasing as the Accounts page (sectionTypeForAccount), so a
    // 'mortgage' account reconciles under Loans there AND here — this page's
    // old local catch-all put it under "Other" while Accounts showed it under
    // Loans, and the module exists precisely so the two cannot diverge.
    const groups: ReconciliationGroup[] = ALL_ACCOUNT_SECTIONS.map(section => ({
      title: section.title,
      summaries: sortSummaries(
        visibleDetails.filter(s => sectionTypeForAccount(s.account.type) === section.type)
      ),
    })).filter(g => g.summaries.length > 0);
    return groups;
  }, [reconciliationDetails, groupBy, sortMode, onlyAttention]);

  // Selected account data
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const accountTransactions = useMemo(
    () =>
      selectedAccountId
        ? overlaidTransactions.filter(t => t.accountId === selectedAccountId)
        : [],
    [overlaidTransactions, selectedAccountId]
  );

  const accountBalance = selectedAccountId ? computeAccountBalance(selectedAccountId) : 0;
  const clearedBalance = selectedAccountId ? computeClearedBalance(selectedAccountId) : 0;
  const clearedSummary = selectedAccountId ? computeClearedSummary(selectedAccountId) : undefined;
  const bankBalance = selectedAccount?.bankBalance ?? null;

  // Handlers
  const handleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    // Preserve demo/testMode so an in-page navigation doesn't drop the flag that
    // keeps a demo/test session alive (which would bounce us to the landing page).
    setSearchParams(prev => preserveRuntimeControlParams(prev, { account: accountId }));
    // Same route, so the router restores nothing: without this, a scrolled
    // account list hands its scroll position to the detail view and the page
    // opens with the header off-screen.
    window.scrollTo(0, 0);
  }, [setSearchParams]);

  const handleBack = useCallback(() => {
    if (cameFromAccounts) {
      // Return whence the user came: the Accounts page sent them here for ONE
      // account, so leaving that account means leaving this page too.
      const params = new URLSearchParams(preserveRuntimeControlParams(searchParams));
      navigate({ pathname: '/accounts', search: params.toString() });
      return;
    }
    setSelectedAccountId(null);
    setSearchParams(prev => preserveRuntimeControlParams(prev));
    window.scrollTo(0, 0);
  }, [cameFromAccounts, searchParams, navigate, setSearchParams]);

  const applyCleared = useCallback(async (requestedIds: string[], cleared: boolean) => {
    // Drop ids that already have a write in flight — the checkbox is disabled
    // while pending, and skipping here closes the race for bulk overlaps too
    // (two in-flight writes for one id could otherwise resolve out of order).
    const ids = requestedIds.filter(id => !pendingCleared.has(id));
    if (ids.length === 0) {
      return;
    }

    // Optimistic: flip immediately, revert on failure.
    setPendingCleared(prev => {
      const next = new Map(prev);
      ids.forEach(id => next.set(id, cleared));
      return next;
    });

    try {
      await setTransactionsCleared(ids, cleared);
    } catch (error) {
      showError(error);
    } finally {
      setPendingCleared(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [pendingCleared, setTransactionsCleared, showError]);

  const handleToggleCleared = useCallback((transactionId: string, cleared: boolean) => {
    void applyCleared([transactionId], cleared);
  }, [applyCleared]);

  const handleBulkSetCleared = useCallback((transactionIds: string[], cleared: boolean) => {
    void applyCleared(transactionIds, cleared);
  }, [applyCleared]);

  const handleBankBalanceChange = useCallback((newBalance: number) => {
    if (selectedAccountId) {
      updateAccount(selectedAccountId, { bankBalance: newBalance });
    }
  }, [selectedAccountId, updateAccount]);

  const handleFinalize = useCallback(async () => {
    if (!selectedAccountId) {
      return;
    }
    try {
      // Await the write — success feedback must not fire on a failed save.
      await updateAccount(selectedAccountId, {
        lastReconciledDate: new Date(),
      });
      setShowFinalizationModal(false);
      showSuccess('Reconciliation complete.', 'Account reconciled');
      handleBack();
    } catch (error) {
      showError(error);
    }
  }, [selectedAccountId, updateAccount, handleBack, showSuccess, showError]);

  const handleCreateAdjustment = useCallback(async (data: {
    amount: number;
    type: 'income' | 'expense';
    description: string;
    category: string;
    date: Date;
  }) => {
    if (!selectedAccountId) return;

    const adjustmentTxn: Omit<Transaction, 'id'> = {
      date: data.date,
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category,
      accountId: selectedAccountId,
      cleared: true,
    };

    try {
      // The modal stays open: the cleared adjustment shrinks the difference and
      // the modal re-renders with the remainder (zero → balanced state), so the
      // user can create several adjustments — the Microsoft Money model.
      await addTransaction(adjustmentTxn);
      showSuccess('Adjustment transaction created.', 'Adjustment added');
    } catch (error) {
      showError(error);
    }
  }, [selectedAccountId, addTransaction, showSuccess, showError]);

  const handleRowClick = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  }, []);

  const handleAddTransaction = useCallback(() => {
    setEditingTransaction(null);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleVisibleOrderChange = useCallback((orderedIds: string[]) => {
    setVisibleOrderIds(orderedIds);
  }, []);

  // "Save & Next" navigation: find the transaction shown immediately after the
  // current one, and swap it into the still-open modal. Mirrors AccountTransactions.
  const getNextTransactionId = useCallback((currentId: string): string | null => {
    const index = visibleOrderIds.indexOf(currentId);
    if (index === -1) return null;
    return visibleOrderIds[index + 1] ?? null;
  }, [visibleOrderIds]);

  const advanceToNextTransaction = useCallback((currentId: string): boolean => {
    const nextId = getNextTransactionId(currentId);
    if (!nextId) return false;
    const nextTransaction = accountTransactions.find(t => t.id === nextId) ?? null;
    if (!nextTransaction) return false;
    setEditingTransaction(nextTransaction);
    return true;
  }, [getNextTransactionId, accountTransactions]);

  const getPreviousTransactionId = useCallback((currentId: string): string | null => {
    const index = visibleOrderIds.indexOf(currentId);
    if (index <= 0) return null;
    return visibleOrderIds[index - 1] ?? null;
  }, [visibleOrderIds]);

  const advanceToPreviousTransaction = useCallback((currentId: string): boolean => {
    const previousId = getPreviousTransactionId(currentId);
    if (!previousId) return false;
    const previousTransaction = accountTransactions.find(t => t.id === previousId) ?? null;
    if (!previousTransaction) return false;
    setEditingTransaction(previousTransaction);
    return true;
  }, [getPreviousTransactionId, accountTransactions]);

  // Step 1: Account Selection
  if (!selectedAccountId) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reconciliation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalUnreconciledCount > 0
              ? `${totalUnreconciledCount} unreconciled transactions across all accounts`
              : 'All accounts are up to date'}
          </p>
        </div>

        {/* Group + sort controls — mirrors the Accounts page */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">Group by:</span>
            <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              {([['type', 'Account Type'], ['institution', 'Institution']] as const).map(([value, label]) => (
                <button key={value} onClick={() => handleGroupByChange(value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    groupBy === value
                      ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">Sort:</span>
            <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              <button onClick={() => handleSortChange('default')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'default' ? 'bg-[#1a2332] dark:bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Default
              </button>
              <button onClick={() => handleSortChange('name')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'name' ? 'bg-[#1a2332] dark:bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Name A–Z
              </button>
              <button onClick={() => handleSortChange(sortMode === 'balance-desc' ? 'balance-asc' : 'balance-desc')}
                title={sortMode === 'balance-desc'
                  ? 'Sorted highest value first — click for lowest first'
                  : sortMode === 'balance-asc'
                    ? 'Sorted lowest value first — click for highest first'
                    : 'Sort by account value'}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'balance-desc' || sortMode === 'balance-asc'
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Value {sortMode === 'balance-asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center">
            <button
              type="button"
              onClick={handleOnlyAttentionToggle}
              aria-pressed={onlyAttention}
              title="Hide accounts that are fully reconciled with no balance difference"
              className={`w-full sm:w-auto px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                onlyAttention
                  ? 'bg-[#1a2332] dark:bg-blue-600 border-[#1a2332] dark:border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Needs attention only{attentionCount > 0 ? ` (${attentionCount})` : ''}
            </button>
          </div>
        </div>

        <ReconciliationAccountList
          groups={accountGroups}
          onSelectAccount={handleSelectAccount}
        />
      </div>
    );
  }

  // Step 2: Transaction Review
  return (
    <div className="flex flex-col h-full gap-4">
      {/* The header and balance bar stay pinned below the app nav while the
          transaction list scrolls: reconciliation is done by watching the
          cleared balance approach the bank's figure, so the numbers — and the
          way out, Finalize — must never scroll away. The negative margins
          bleed the strip across the page gutters so passing rows (and their
          shadows) never peek out at the sides. */}
      <div className="sticky top-16 md:top-12 z-30 bg-[#f8f9fb] dark:bg-gray-900 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 pb-2 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <ArrowLeftIcon size={20} />
              Back
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {selectedAccount?.name ?? 'Account'}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowFinalizationModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors font-medium dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/50"
          >
            <CheckCircleIcon size={18} />
            Finalize Reconciliation
          </button>
        </div>

        {/* Balance Bar */}
        <ReconciliationBalanceBar
          bankBalance={bankBalance}
          accountBalance={accountBalance}
          clearedBalance={clearedBalance}
          currency={selectedAccount?.currency}
          clearedSummary={clearedSummary}
          onBankBalanceChange={handleBankBalanceChange}
        />
      </div>

      {/* Transaction List */}
      <ReconciliationTransactionList
        transactions={accountTransactions}
        categories={categories}
        currency={selectedAccount?.currency}
        openingBalance={selectedAccount?.openingBalance ?? 0}
        pendingClearedIds={pendingCleared}
        onToggleCleared={handleToggleCleared}
        onBulkSetCleared={handleBulkSetCleared}
        onRowClick={handleRowClick}
        onAddTransaction={handleAddTransaction}
        onVisibleOrderChange={handleVisibleOrderChange}
      />

      {/* Edit / add transaction (new transactions default to this account) */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        transaction={editingTransaction}
        defaultAccountId={selectedAccountId}
        onSaveAndNext={
          editingTransaction && getNextTransactionId(editingTransaction.id)
            ? () => {
                if (!advanceToNextTransaction(editingTransaction.id)) {
                  handleCloseEditModal();
                }
              }
            : undefined
        }
        onSaveAndPrevious={
          editingTransaction && getPreviousTransactionId(editingTransaction.id)
            ? () => { advanceToPreviousTransaction(editingTransaction.id); }
            : undefined
        }
      />

      {/* Finalization Modal */}
      <ReconciliationFinalizationModal
        isOpen={showFinalizationModal}
        bankBalance={bankBalance}
        clearedBalance={clearedBalance}
        currency={selectedAccount?.currency}
        onClose={() => setShowFinalizationModal(false)}
        onFinalize={handleFinalize}
        onCreateAdjustment={handleCreateAdjustment}
      />
    </div>
  );
}
