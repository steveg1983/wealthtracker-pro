import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { CheckCircle, Building2, CreditCard, ChevronRight, ArrowLeft, Edit } from 'lucide-react';
import EditTransactionModal from '../components/EditTransactionModal';
import { useCurrency } from '../hooks/useCurrency';
import { useReconciliation } from '../hooks/useReconciliation';

// Bank transactions are now imported from shared utility

export default function Reconciliation() {
  const { transactions, accounts, updateTransaction } = useApp();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(
    searchParams.get('account') || null
  );
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Use shared reconciliation hook
  const { 
    reconciliationDetails: accountSummaries, 
    totalUnreconciledCount, 
    getUnreconciledCount 
  } = useReconciliation(accounts, transactions);

  // Get uncleared transactions for selected account
  const unclearedTransactions = selectedAccount 
    ? transactions.filter(t => t.accountId === selectedAccount && !t.cleared)
    : [];
    
  const currentTransaction = unclearedTransactions[currentTransactionIndex] || null;

  // Reset index when account changes
  useEffect(() => {
    setCurrentTransactionIndex(0);
  }, [selectedAccount]);




  // Handle marking transaction as cleared/reconciled
  const handleReconcile = () => {
    if (!currentTransaction) return;

    // Update the transaction to mark it as cleared
    updateTransaction(currentTransaction.id, {
      ...currentTransaction,
      cleared: true
    });

    // Move to next transaction
    moveToNext();
  };

  // Handle editing transaction
  const handleEdit = () => {
    if (!currentTransaction) return;
    setEditingTransaction(currentTransaction);
    setShowEditModal(true);
  };

  // Skip current transaction
  const handleSkip = () => {
    moveToNext();
  };

  // Move to next unreconciled transaction
  const moveToNext = () => {
    if (currentTransactionIndex < unclearedTransactions.length - 1) {
      setCurrentTransactionIndex(currentTransactionIndex + 1);
    }
  };
  
  // Move to previous unreconciled transaction
  const moveToPrevious = () => {
    if (currentTransactionIndex > 0) {
      setCurrentTransactionIndex(currentTransactionIndex - 1);
    }
  };

  // Currency formatting now handled by useCurrency hook

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setCurrentTransactionIndex(0);
    setSearchParams({});
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId);
    setSearchParams({ account: accountId });
  };

  // totalUnreconciledCount now comes from useReconciliation hook

  // Show account summary view if no account is selected
  if (!selectedAccount) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-blue-900 dark:text-white">Bank Reconciliation</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Select an account below to reconcile imported bank transactions
          </p>
        </div>

        {accountSummaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              All caught up!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              All bank transactions have been reconciled across all accounts.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    Reconciliation Summary
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    You have {totalUnreconciledCount} transactions to reconcile across {accountSummaries.length} accounts
                  </p>
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {totalUnreconciledCount}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {accountSummaries.map(({ account, unreconciledCount, totalToReconcile, lastImportDate }: any) => (
                <div
                  key={account.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleSelectAccount(account.id)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {account.type === 'credit' ? (
                            <CreditCard className="text-gray-400" size={24} />
                          ) : (
                            <Building2 className="text-gray-400" size={24} />
                          )}
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {account.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {account.institution} • Last import: {formatDate(lastImportDate)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Transactions to reconcile</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{unreconciledCount}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total amount</p>
                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(totalToReconcile)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="text-gray-400" size={24} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Show reconciliation view for selected account
  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const unreconciledCount = selectedAccount ? getUnreconciledCount(selectedAccount) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToAccounts}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Reconcile {selectedAccountData?.name}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedAccountData?.institution}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {unreconciledCount} items to reconcile
        </div>
      </div>

      {!currentTransaction ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Account reconciled!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            All transactions for {selectedAccountData?.name} have been reconciled.
          </p>
          <button
            onClick={handleBackToAccounts}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            Back to Accounts
          </button>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Transaction Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Transaction {currentTransactionIndex + 1} of {unclearedTransactions.length}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(((currentTransactionIndex + 1) / unclearedTransactions.length) * 100)}% Complete
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Date</h3>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatDate(currentTransaction.date)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</h3>
                  <p className={`text-lg font-bold ${
                    currentTransaction.type === 'income' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {currentTransaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(currentTransaction.amount)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</h3>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {currentTransaction.description}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Category</h3>
                  <p className="text-base text-gray-900 dark:text-white">
                    {currentTransaction.category || 'Uncategorized'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Unreconciled
                  </span>
                </div>
                {currentTransaction.notes && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</h3>
                    <p className="text-base text-gray-700 dark:text-gray-300">
                      {currentTransaction.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={moveToPrevious}
              disabled={currentTransactionIndex === 0}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Previous
            </button>
            
            <button
              onClick={handleEdit}
              className="px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 flex items-center justify-center gap-2"
            >
              <Edit size={20} />
              Edit Transaction
            </button>
            
            <button
              onClick={handleReconcile}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 flex-1"
            >
              <CheckCircle size={20} />
              Mark as Reconciled
            </button>
            
            <button
              onClick={handleSkip}
              disabled={currentTransactionIndex === unclearedTransactions.length - 1}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Skip
              <ChevronRight size={20} />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-8">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentTransactionIndex + 1) / unclearedTransactions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
      />
    </div>
  );
}