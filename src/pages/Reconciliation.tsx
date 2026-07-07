import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeftIcon, CheckCircleIcon } from '../components/icons';
import { useReconciliation } from '../hooks/useReconciliation';
import ReconciliationAccountList from '../components/reconciliation/ReconciliationAccountList';
import ReconciliationBalanceBar from '../components/reconciliation/ReconciliationBalanceBar';
import ReconciliationTransactionList from '../components/reconciliation/ReconciliationTransactionList';
import ReconciliationFinalizationModal from '../components/reconciliation/ReconciliationFinalizationModal';
import EditTransactionModal from '../components/EditTransactionModal';
import type { Transaction } from '../types';

export default function Reconciliation() {
  const { transactions, accounts, categories, addTransaction, updateAccount, setTransactionsCleared } = useApp();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    searchParams.get('account') || null
  );
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
    setSearchParams({ account: accountId });
  }, [setSearchParams]);

  const handleBack = useCallback(() => {
    setSelectedAccountId(null);
    setSearchParams({});
  }, [setSearchParams]);

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

        <ReconciliationAccountList
          summaries={reconciliationDetails}
          onSelectAccount={handleSelectAccount}
        />
      </div>
    );
  }

  // Step 2: Transaction Review
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ArrowLeftIcon size={20} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
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
      />

      {/* Edit / add transaction (new transactions default to this account) */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        transaction={editingTransaction}
        defaultAccountId={selectedAccountId}
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
