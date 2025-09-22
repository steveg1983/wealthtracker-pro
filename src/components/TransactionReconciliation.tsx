/**
 * TransactionReconciliation Component - Reconcile transactions against bank statements
 *
 * Features:
 * - Statement comparison and matching
 * - Manual transaction reconciliation
 * - Bulk reconciliation operations
 * - Reconciliation status tracking
 * - Bank statement import integration
 */

import React, { useState, useEffect } from 'react';

const logger = lazyLogger.getLogger('TransactionReconciliation');

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  account_id: string;
  reconciliation_status: 'unreconciled' | 'reconciled' | 'pending' | 'disputed';
  reconciliation_date?: string;
  statement_ref?: string;
}

export interface BankStatement {
  id: string;
  account_id: string;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  transactions: StatementTransaction[];
  file_name?: string;
  uploaded_at: string;
}

export interface StatementTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  reference: string;
  balance: number;
  matched_transaction_id?: string;
}

export interface ReconciliationSummary {
  total_transactions: number;
  reconciled_count: number;
  unreconciled_count: number;
  disputed_count: number;
  balance_difference: number;
  statement_balance: number;
  book_balance: number;
}

interface TransactionReconciliationProps {
  accountId?: string;
  statementId?: string;
  onReconciliationComplete?: (summary: ReconciliationSummary) => void;
  onClose?: () => void;
  className?: string;
  autoMatch?: boolean;
}

export function TransactionReconciliation({
  accountId,
  statementId,
  onReconciliationComplete,
  onClose,
  className = '',
  autoMatch = true
}: TransactionReconciliationProps): React.JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedStatementItems, setSelectedStatementItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'split' | 'unmatched' | 'matched'>('split');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unreconciled' | 'reconciled' | 'disputed'>('all');

  useEffect(() => {
    if (accountId) {
      loadTransactions();
    }
    if (statementId) {
      loadStatement();
    }
  }, [accountId, statementId]);

  useEffect(() => {
    if (transactions.length > 0 && statement) {
      if (autoMatch) {
        performAutoMatching();
      }
      calculateSummary();
    }
  }, [transactions, statement, autoMatch]);

  const loadTransactions = async (): Promise<void> => {

    try {
      // Mock transaction data
      const mockTransactions: Transaction[] = [
        {
          id: 'txn-1',
          date: '2024-01-15',
          amount: -25.00,
          description: 'Coffee Shop Purchase',
          category: 'Food & Dining',
          account_id: accountId || 'acc-1',
          reconciliation_status: 'unreconciled'
        },
        {
          id: 'txn-2',
          date: '2024-01-16',
          amount: 1500.00,
          description: 'Salary Deposit',
          category: 'Income',
          account_id: accountId || 'acc-1',
          reconciliation_status: 'reconciled',
          reconciliation_date: '2024-01-16',
          statement_ref: 'stmt-txn-2'
        },
        {
          id: 'txn-3',
          date: '2024-01-17',
          amount: -120.50,
          description: 'Grocery Store',
          category: 'Groceries',
          account_id: accountId || 'acc-1',
          reconciliation_status: 'unreconciled'
        }
      ];

      setTransactions(mockTransactions);
    } catch (error) {
    }
  };

  const loadStatement = async (): Promise<void> => {

    try {
      // Mock statement data
      const mockStatement: BankStatement = {
        id: statementId || 'stmt-1',
        account_id: accountId || 'acc-1',
        statement_date: '2024-01-31',
        opening_balance: 1200.00,
        closing_balance: 2554.50,
        uploaded_at: '2024-02-01T10:00:00Z',
        file_name: 'statement_jan_2024.pdf',
        transactions: [
          {
            id: 'stmt-txn-1',
            date: '2024-01-15',
            amount: -25.00,
            description: 'COFFEE SHOP #123',
            reference: 'REF001',
            balance: 1175.00
          },
          {
            id: 'stmt-txn-2',
            date: '2024-01-16',
            amount: 1500.00,
            description: 'PAYROLL DEPOSIT',
            reference: 'REF002',
            balance: 2675.00,
            matched_transaction_id: 'txn-2'
          },
          {
            id: 'stmt-txn-3',
            date: '2024-01-17',
            amount: -120.50,
            description: 'GROCERY MART',
            reference: 'REF003',
            balance: 2554.50
          }
        ]
      };

      setStatement(mockStatement);
    } catch (error) {
    }
  };

  const performAutoMatching = (): void => {
    if (!statement) return;


    const updatedTransactions = transactions.map(transaction => {
      if (transaction.reconciliation_status === 'reconciled') {
        return transaction;
      }

      // Find potential matches in statement
      const potentialMatch = statement.transactions.find(stmtTxn =>
        !stmtTxn.matched_transaction_id &&
        Math.abs(transaction.amount - stmtTxn.amount) < 0.01 &&
        Math.abs(new Date(transaction.date).getTime() - new Date(stmtTxn.date).getTime()) <= 2 * 24 * 60 * 60 * 1000 // 2 days
      );

      if (potentialMatch) {
        potentialMatch.matched_transaction_id = transaction.id;
        return {
          ...transaction,
          reconciliation_status: 'reconciled' as const,
          reconciliation_date: new Date().toISOString().split('T')[0],
          statement_ref: potentialMatch.id
        };
      }

      return transaction;
    });

    setTransactions(updatedTransactions);
  };

  const calculateSummary = (): void => {
    const summary: ReconciliationSummary = {
      total_transactions: transactions.length,
      reconciled_count: transactions.filter(t => t.reconciliation_status === 'reconciled').length,
      unreconciled_count: transactions.filter(t => t.reconciliation_status === 'unreconciled').length,
      disputed_count: transactions.filter(t => t.reconciliation_status === 'disputed').length,
      balance_difference: 0,
      statement_balance: statement?.closing_balance || 0,
      book_balance: 0
    };

    // Calculate book balance from reconciled transactions
    const reconciledTransactions = transactions.filter(t => t.reconciliation_status === 'reconciled');
    summary.book_balance = reconciledTransactions.reduce((sum, t) => sum + t.amount, statement?.opening_balance || 0);
    summary.balance_difference = summary.statement_balance - summary.book_balance;

    setReconciliationSummary(summary);
  };

  const handleManualMatch = (transactionId: string, statementTransactionId: string): void => {

    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId
          ? {
              ...t,
              reconciliation_status: 'reconciled',
              reconciliation_date: new Date().toISOString().split('T')[0],
              statement_ref: statementTransactionId
            }
          : t
      )
    );

    if (statement) {
      setStatement({
        ...statement,
        transactions: statement.transactions.map(st =>
          st.id === statementTransactionId
            ? { ...st, matched_transaction_id: transactionId }
            : st
        )
      });
    }
  };

  const handleUnmatch = (transactionId: string): void => {

    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction?.statement_ref) return;

    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId
          ? {
              ...t,
              reconciliation_status: 'unreconciled',
              reconciliation_date: undefined,
              statement_ref: undefined
            }
          : t
      )
    );

    if (statement) {
      setStatement({
        ...statement,
        transactions: statement.transactions.map(st =>
          st.matched_transaction_id === transactionId
            ? { ...st, matched_transaction_id: undefined }
            : st
        )
      });
    }
  };

  const handleMarkDisputed = (transactionId: string): void => {

    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId
          ? { ...t, reconciliation_status: 'disputed' }
          : t
      )
    );
  };

  const handleCompleteReconciliation = (): void => {
    if (!reconciliationSummary) return;

    onReconciliationComplete?.(reconciliationSummary);
  };

  const formatAmount = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const formattedAmount = `£${absAmount.toFixed(2)}`;
    return amount >= 0 ? `+${formattedAmount}` : `-${formattedAmount}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'reconciled': return 'text-green-600 bg-green-50';
      case 'unreconciled': return 'text-yellow-600 bg-yellow-50';
      case 'disputed': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterStatus === 'all') return true;
    return t.reconciliation_status === filterStatus;
  });

  const unmatched = statement?.transactions.filter(st => !st.matched_transaction_id) || [];

  return (
    <div className={`bg-white dark:bg-gray-900 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Transaction Reconciliation
            </h2>
            {statement && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {statement.file_name} • {formatDate(statement.statement_date)}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={performAutoMatching}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              Auto Match
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Reconciliation Summary */}
        {reconciliationSummary && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Reconciliation Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {reconciliationSummary.reconciled_count}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Reconciled</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">
                  {reconciliationSummary.unreconciled_count}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Unreconciled</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {reconciliationSummary.disputed_count}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Disputed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatAmount(reconciliationSummary.statement_balance)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Statement Balance</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-semibold ${
                  Math.abs(reconciliationSummary.balance_difference) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {formatAmount(reconciliationSummary.balance_difference)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Difference</div>
              </div>
            </div>
          </div>
        )}

        {/* View Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
              {(['split', 'unmatched', 'matched'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-sm font-medium capitalize ${
                    viewMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-700 dark:text-gray-400'
                  } first:rounded-l-lg last:rounded-r-lg`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="reconciled">Reconciled</option>
              <option value="unreconciled">Unreconciled</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>
        </div>

        {/* Reconciliation Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Book Transactions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Book Transactions ({filteredTransactions.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border border-gray-200 dark:border-gray-700 rounded p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(transaction.date)}
                        {transaction.category && ` • ${transaction.category}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${
                        transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatAmount(transaction.amount)}
                      </div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(transaction.reconciliation_status)}`}>
                        {transaction.reconciliation_status}
                      </span>
                    </div>
                  </div>
                  {transaction.reconciliation_status === 'unreconciled' && (
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={() => handleMarkDisputed(transaction.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Mark Disputed
                      </button>
                    </div>
                  )}
                  {transaction.reconciliation_status === 'reconciled' && (
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={() => handleUnmatch(transaction.id)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Unmatch
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Statement Transactions */}
          {statement && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Statement Transactions ({unmatched.length} unmatched)
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {unmatched.map((stmtTxn) => (
                  <div
                    key={stmtTxn.id}
                    className="border border-gray-200 dark:border-gray-700 rounded p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {stmtTxn.description}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(stmtTxn.date)} • Ref: {stmtTxn.reference}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${
                          stmtTxn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatAmount(stmtTxn.amount)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Balance: {formatAmount(stmtTxn.balance)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {reconciliationSummary && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {reconciliationSummary.reconciled_count} of {reconciliationSummary.total_transactions} transactions reconciled
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCompleteReconciliation}
                disabled={reconciliationSummary.unreconciled_count > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
              >
                Complete Reconciliation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionReconciliation;