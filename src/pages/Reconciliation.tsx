import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { ArrowLeftIcon, CheckCircleIcon } from '../components/icons';
import { useReconciliation } from '../hooks/useReconciliation';
import ReconciliationAccountList from '../components/reconciliation/ReconciliationAccountList';
import ReconciliationBalanceBar from '../components/reconciliation/ReconciliationBalanceBar';
import ReconciliationTransactionList from '../components/reconciliation/ReconciliationTransactionList';
import ReconciliationFinalizationModal from '../components/reconciliation/ReconciliationFinalizationModal';
import type { Transaction } from '../types';

export default function Reconciliation() {
  const { transactions, accounts, categories, updateTransaction, addTransaction, updateAccount } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    searchParams.get('account') || null
  );
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);

  const {
    reconciliationDetails,
    totalUnreconciledCount,
    computeAccountBalance,
    computeClearedBalance,
  } = useReconciliation(accounts, transactions);

  // Selected account data
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const accountTransactions = useMemo(
    () =>
      selectedAccountId
        ? transactions.filter(t => t.accountId === selectedAccountId)
        : [],
    [transactions, selectedAccountId]
  );

  const accountBalance = selectedAccountId ? computeAccountBalance(selectedAccountId) : 0;
  const clearedBalance = selectedAccountId ? computeClearedBalance(selectedAccountId) : 0;
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

  const handleToggleCleared = useCallback((transactionId: string, cleared: boolean) => {
    updateTransaction(transactionId, { cleared });
  }, [updateTransaction]);

  const handleBankBalanceChange = useCallback((newBalance: number) => {
    if (selectedAccountId) {
      updateAccount(selectedAccountId, { bankBalance: newBalance });
    }
  }, [selectedAccountId, updateAccount]);

  const handleFinalize = useCallback(() => {
    if (selectedAccountId) {
      updateAccount(selectedAccountId, {
        lastReconciledDate: new Date(),
      });
      setShowFinalizationModal(false);
      handleBack();
    }
  }, [selectedAccountId, updateAccount, handleBack]);

  const handleCreateAdjustment = useCallback((data: {
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

    addTransaction(adjustmentTxn);

    // After adjustment, finalize
    updateAccount(selectedAccountId, {
      lastReconciledDate: new Date(),
    });

    setShowFinalizationModal(false);
    handleBack();
  }, [selectedAccountId, addTransaction, updateAccount, handleBack]);

  const handleAddTransaction = useCallback(() => {
    // Placeholder — will be wired to a transaction creation modal
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
        onBankBalanceChange={handleBankBalanceChange}
      />

      {/* Transaction List */}
      <ReconciliationTransactionList
        transactions={accountTransactions}
        categories={categories}
        currency={selectedAccount?.currency}
        openingBalance={selectedAccount?.openingBalance ?? 0}
        onToggleCleared={handleToggleCleared}
        onAddTransaction={handleAddTransaction}
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
