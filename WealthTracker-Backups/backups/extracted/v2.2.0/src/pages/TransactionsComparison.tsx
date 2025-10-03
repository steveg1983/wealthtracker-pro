import React, { useState } from 'react';
import { BarChart3Icon, ToggleLeftIcon, ToggleRightIcon } from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import { VirtualizedTransactionList } from '../components/VirtualizedTransactionList';
import { TransactionListRedux } from '../components/TransactionListRedux';
import AddTransactionModal from '../components/AddTransactionModal';
import { useApp } from '../contexts/AppContextSupabase';
import { useAppSelector } from '../store';
import { PlusIcon } from '../components/icons';

/**
 * Page that allows comparing Context API vs Redux implementations
 * Useful for testing feature parity during migration
 */
export default function TransactionsComparison() {
  const [useRedux, setUseRedux] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Get data from both sources for comparison
  const contextTransactions = useApp().transactions;
  const reduxTransactions = useAppSelector(state => state.transactions.transactions);
  
  const transactionCountMatch = contextTransactions.length === reduxTransactions.length;

  return (
    <PageWrapper
      title="Transactions"
      subtitle="Compare Context API vs Redux implementations"
      icon={<BarChart3Icon size={24} />}
      actions={
        <div className="flex items-center gap-4">
          {/* Toggle Switch */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setUseRedux(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !useRedux 
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <ToggleLeftIcon size={16} />
              Context API
            </button>
            <button
              onClick={() => setUseRedux(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                useRedux 
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <ToggleRightIcon size={16} />
              Redux
            </button>
          </div>
          
          {/* Add Transaction Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <PlusIcon size={20} />
            Add Transaction
          </button>
        </div>
      }
    >
      {/* Migration Status */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold mb-2 dark:text-white">Migration Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Context Transactions:</span>
            <span className="ml-2 font-medium dark:text-white">{contextTransactions.length}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Redux Transactions:</span>
            <span className="ml-2 font-medium dark:text-white">{reduxTransactions.length}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 dark:text-gray-400">Data Sync:</span>
            <span className={`ml-2 font-medium ${
              transactionCountMatch ? 'text-green-600' : 'text-red-600'
            }`}>
              {transactionCountMatch ? '✓ Synced' : '✗ Out of Sync'}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Currently viewing: <strong>{useRedux ? 'Redux' : 'Context API'}</strong> implementation
        </p>
      </div>

      {/* Transaction List */}
      {useRedux ? (
        <TransactionListRedux />
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-gray-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-gray-300">
              <strong>Context Mode:</strong> This is the original implementation using Context API.
            </p>
          </div>
          <VirtualizedTransactionList />
        </div>
      )}

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={() => setShowAddModal(false)}
      />
    </PageWrapper>
  );
}