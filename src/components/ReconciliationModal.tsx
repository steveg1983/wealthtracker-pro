import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { XIcon, ArrowRightIcon, CheckIcon, AlertCircleIcon } from './icons';
import type { Transaction } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';

interface ReconciliationMatch {
  outTransaction: Transaction;
  inTransaction: Transaction;
  confidence: number;
  reason: string;
  matchType?: 'exact' | 'fuzzy' | 'amount-only';
}

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  match?: ReconciliationMatch;
  transaction?: Transaction;
}

export default function ReconciliationModal({ isOpen, onClose, match, transaction }: ReconciliationModalProps) {
  const { transactions, accounts, updateTransaction } = useApp();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [notes, setNotes] = useState('');
  const { formatCurrency } = useCurrencyDecimal();

  useEffect(() => {
    if (match) {
      // Pre-fill with matched transaction
      setSelectedTransaction(match.outTransaction.id === transaction?.id ? match.inTransaction : match.outTransaction);
    }
  }, [match, transaction]);

  const handleReconcile = () => {
    if (!transaction && match) {
      // Reconciling a suggested match
      updateTransaction(match.outTransaction.id, {
        reconciledWith: match.inTransaction.id,
        reconciledDate: new Date(),
        reconciledNotes: notes
      });
      
      updateTransaction(match.inTransaction.id, {
        reconciledWith: match.outTransaction.id,
        reconciledDate: new Date(),
        reconciledNotes: notes
      });
    } else if (transaction && selectedTransaction) {
      // Manual reconciliation
      updateTransaction(transaction.id, {
        reconciledWith: selectedTransaction.id,
        reconciledDate: new Date(),
        reconciledNotes: notes
      });
      
      updateTransaction(selectedTransaction.id, {
        reconciledWith: transaction.id,
        reconciledDate: new Date(),
        reconciledNotes: notes
      });
    }
    
    onClose();
  };

  const filteredTransactions = transactions.filter(t => {
    if (transaction && t.id === transaction.id) return false;
    if (t.reconciledWith) return false;
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterAccount && t.accountId !== filterAccount) return false;
    if (transaction) {
      // For manual reconciliation, show opposite type transactions
      if (transaction.type === 'expense' && t.type !== 'income') return false;
      if (transaction.type === 'income' && t.type !== 'expense') return false;
    }
    return true;
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  if (!isOpen) return null;

  const sourceTransaction = match ? match.outTransaction : transaction;
  const targetTransaction = match ? match.inTransaction : selectedTransaction;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">
            {match ? 'Review Transfer Match' : 'Manual Reconciliation'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XIcon size={24} />
          </button>
        </div>

        {/* Transaction Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Source Transaction */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-3 dark:text-white">
              {sourceTransaction?.type === 'expense' ? 'From' : 'Source'}
            </h3>
            {sourceTransaction && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  Account: <span className="text-gray-900 dark:text-white font-medium">
                    {getAccountName(sourceTransaction.accountId)}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Date: <span className="text-gray-900 dark:text-white font-medium">
                    {formatDate(sourceTransaction.date)}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Description: <span className="text-gray-900 dark:text-white font-medium">
                    {sourceTransaction.description}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Amount: <span className={`font-medium ${
                    sourceTransaction.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {sourceTransaction.type === 'expense' ? '-' : '+'}{formatCurrency(toDecimal(sourceTransaction.amount))}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <ArrowRightIcon className="text-gray-400" size={32} />
          </div>

          {/* Target Transaction */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-3 dark:text-white">
              {sourceTransaction?.type === 'expense' ? 'To' : 'Target'}
            </h3>
            {targetTransaction ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  Account: <span className="text-gray-900 dark:text-white font-medium">
                    {getAccountName(targetTransaction.accountId)}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Date: <span className="text-gray-900 dark:text-white font-medium">
                    {formatDate(targetTransaction.date)}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Description: <span className="text-gray-900 dark:text-white font-medium">
                    {targetTransaction.description}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Amount: <span className={`font-medium ${
                    targetTransaction.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {targetTransaction.type === 'expense' ? '-' : '+'}{formatCurrency(toDecimal(targetTransaction.amount))}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                Select a matching transaction below
              </p>
            )}
          </div>
        </div>

        {/* Match Confidence (if applicable) */}
        {match && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="text-blue-600 dark:text-blue-400" size={20} />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This match has a <span className="font-semibold">{match.confidence}%</span> confidence score.
                {match.matchType === 'exact' && ' The descriptions match exactly.'}
                {match.matchType === 'fuzzy' && ' The descriptions are similar.'}
                {match.matchType === 'amount-only' && ' Only the amounts match.'}
              </p>
            </div>
          </div>
        )}

        {/* Manual Selection (if not a match) */}
        {!match && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3 dark:text-white">Select Matching Transaction</h3>
            
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Accounts</option>
                {accounts.filter(a => transaction && a.id !== transaction.accountId).map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            {/* Transaction List */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <p className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No matching transactions found
                </p>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTransactions.map((trans) => (
                      <tr
                        key={trans.id}
                        onClick={() => setSelectedTransaction(trans)}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedTransaction?.id === trans.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="radio"
                            checked={selectedTransaction?.id === trans.id}
                            onChange={() => setSelectedTransaction(trans)}
                            className="text-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {trans.description}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getAccountName(trans.accountId)} · {formatDate(trans.date)}
                          </p>
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          trans.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {trans.type === 'income' ? '+' : '-'}{formatCurrency(toDecimal(trans.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any notes about this reconciliation..."
            className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleReconcile}
            disabled={!match && !selectedTransaction}
            className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
              (match || selectedTransaction)
                ? 'bg-primary text-white hover:bg-secondary'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <CheckIcon size={20} />
            Reconcile Transactions
          </button>
        </div>
      </div>
    </div>
  );
}
