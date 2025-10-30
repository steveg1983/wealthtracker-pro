import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { parseCurrencyDecimal } from '../utils/currency-decimal';
import { Modal } from './common/Modal';
import {
  CheckCircleIcon,
  LinkIcon,
  RefreshCwIcon,
  CalendarIcon
} from './icons';
import type { Transaction } from '../types';
import type { DecimalInstance } from '../types/decimal-types';
import { logger } from '../services/loggingService';

interface TransactionReconciliationProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

interface MatchCandidate {
  transaction: Transaction;
  score: number;
  reasons: string[];
}

interface ReconciliationResult {
  matched: number;
  unmatched: number;
  suggestions: number;
}

export default function TransactionReconciliation({ 
  isOpen, 
  onClose,
  accountId
}: TransactionReconciliationProps) {
  const { transactions, accounts, updateTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [selectedAccount, setSelectedAccount] = useState(accountId || '');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date()
  });
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [results, setResults] = useState<ReconciliationResult | null>(null);
  const [manualMatches, setManualMatches] = useState<Map<string, string>>(new Map());
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Get transactions for selected account and date range
  const accountTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    
    return transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return t.accountId === selectedAccount &&
             tDate >= dateRange.start &&
             tDate <= dateRange.end;
    });
  }, [transactions, selectedAccount, dateRange]);


  // Find uncleared transactions
  const unclearedTransactions = useMemo(() => {
    return accountTransactions.filter(t => !t.cleared);
  }, [accountTransactions]);

  // Find cleared transactions
  const clearedTransactions = useMemo(() => {
    return accountTransactions.filter(t => t.cleared);
  }, [accountTransactions]);

  // Calculate cleared balance
  const clearedBalance = useMemo(() => {
    return clearedTransactions.reduce((sum, t) => {
      const amount = typeof t.amount === 'number' ? t.amount : (t.amount as DecimalInstance).toNumber();
      return sum + (t.type === 'income' ? amount : -amount);
    }, 0);
  }, [clearedTransactions]);

  // Find matching candidates for uncleared transactions
  const findMatchingCandidates = (uncleared: Transaction): MatchCandidate[] => {
    const candidates: MatchCandidate[] = [];
    const unclearedDate = uncleared.date instanceof Date ? uncleared.date : new Date(uncleared.date);
    const unclearedAmount = typeof uncleared.amount === 'number' ? uncleared.amount : (uncleared.amount as DecimalInstance).toNumber();
    
    // Look for similar transactions in history
    const historicalTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return t.accountId === selectedAccount &&
             t.cleared &&
             tDate < dateRange.start &&
             t.id !== uncleared.id;
    });
    
    historicalTransactions.forEach(historical => {
      const historicalDate = historical.date instanceof Date ? historical.date : new Date(historical.date);
      const historicalAmount = typeof historical.amount === 'number' ? historical.amount : (historical.amount as DecimalInstance).toNumber();
      
      let score = 0;
      const reasons: string[] = [];
      
      // Check amount similarity
      if (Math.abs(historicalAmount - unclearedAmount) < 0.01) {
        score += 40;
        reasons.push('Exact amount match');
      } else if (Math.abs(historicalAmount - unclearedAmount) / unclearedAmount < 0.1) {
        score += 20;
        reasons.push('Similar amount (within 10%)');
      }
      
      // Check description similarity
      const descSimilarity = calculateDescriptionSimilarity(
        uncleared.description.toLowerCase(),
        historical.description.toLowerCase()
      );
      if (descSimilarity > 0.8) {
        score += 30;
        reasons.push('Very similar description');
      } else if (descSimilarity > 0.6) {
        score += 20;
        reasons.push('Similar description');
      }
      
      // Check category match
      if (uncleared.category === historical.category) {
        score += 20;
        reasons.push('Same category');
      }
      
      // Check if it's a recurring transaction (similar day of month)
      if (unclearedDate.getDate() === historicalDate.getDate()) {
        score += 10;
        reasons.push('Same day of month (recurring?)');
      }
      
      if (score >= 50) {
        candidates.push({
          transaction: historical,
          score,
          reasons
        });
      }
    });
    
    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  // Calculate string similarity
  const calculateDescriptionSimilarity = (str1: string, str2: string): number => {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  // Auto-reconcile transactions
  const autoReconcile = async () => {
    setReconciling(true);
    
    try {
      let matched = 0;
      let unmatched = 0;
      let suggestions = 0;
      
      // First pass: Clear transactions that should be cleared based on patterns
      for (const transaction of unclearedTransactions) {
        const candidates = findMatchingCandidates(transaction);
        const topCandidate = candidates[0];

        if (topCandidate && topCandidate.score >= 80) {
          // High confidence match - auto clear
          await updateTransaction(transaction.id, { cleared: true });
          matched++;
        } else if (topCandidate) {
          // Has suggestions but needs manual review
          suggestions++;
        } else {
          // No good matches found
          unmatched++;
        }
      }
      
      setResults({ matched, unmatched, suggestions });
    } catch (error) {
      logger.error('Error during reconciliation:', error);
    } finally {
      setReconciling(false);
    }
  };

  // Manual match transaction
  const handleManualMatch = async (transactionId: string, matchId: string) => {
    const newMatches = new Map(manualMatches);
    newMatches.set(transactionId, matchId);
    setManualMatches(newMatches);
    
    // Clear the transaction
    await updateTransaction(transactionId, { cleared: true });
  };

  // Clear all selected transactions
  const handleClearSelected = async (transactionIds: string[]) => {
    for (const id of transactionIds) {
      await updateTransaction(id, { cleared: true });
    }
  };

  const statementDifference = statementBalance ?
    parseCurrencyDecimal(statementBalance).toNumber() - clearedBalance : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Reconciliation"
      size="xl"
    >
      <div className="p-6">
        {/* Setup Section */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">Reconciliation Setup</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700"
              >
                <option value="">Select an account...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Statement Balance</label>
              <input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="Enter statement ending balance"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => setDateRange({
                  ...dateRange,
                  start: new Date(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => setDateRange({
                  ...dateRange,
                  end: new Date(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {selectedAccount && (
          <>
            {/* Balance Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">Cleared Balance</div>
                <div className="text-xl font-semibold mt-1">{formatCurrency(clearedBalance)}</div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">Statement Balance</div>
                <div className="text-xl font-semibold mt-1">
                  {statementBalance ? formatCurrency(parseCurrencyDecimal(statementBalance)) : '-'}
                </div>
              </div>
              
              <div className={`rounded-lg p-4 border ${
                Math.abs(statementDifference) < 0.01
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="text-sm text-gray-600 dark:text-gray-400">Difference</div>
                <div className={`text-xl font-semibold mt-1 ${
                  Math.abs(statementDifference) < 0.01
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(statementDifference)}
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">Uncleared</div>
                <div className="text-xl font-semibold mt-1">{unclearedTransactions.length}</div>
              </div>
            </div>

            {/* Auto-Reconcile Button */}
            <div className="flex justify-center mb-6">
              <button
                onClick={autoReconcile}
                disabled={reconciling || !selectedAccount}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg
                         hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reconciling ? (
                  <>
                    <RefreshCwIcon size={20} className="animate-spin" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    <LinkIcon size={20} />
                    Auto-Reconcile Transactions
                  </>
                )}
              </button>
            </div>

            {/* Results */}
            {results && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Reconciliation Results
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Matched:</span>
                    <span className="ml-2 font-medium">{results.matched}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Suggestions:</span>
                    <span className="ml-2 font-medium">{results.suggestions}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Unmatched:</span>
                    <span className="ml-2 font-medium">{results.unmatched}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Uncleared Transactions */}
            {unclearedTransactions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Uncleared Transactions</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showSuggestions}
                      onChange={(e) => setShowSuggestions(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Show suggestions</span>
                  </label>
                </div>
                
                <div className="space-y-4">
                  {unclearedTransactions.map(transaction => {
                    const tDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
                    const candidates = showSuggestions ? findMatchingCandidates(transaction) : [];
                    
                    return (
                      <div key={transaction.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium">{transaction.description}</div>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon size={14} />
                                    {tDate.toLocaleDateString()}
                                  </span>
                                  <span>{transaction.category}</span>
                                </div>
                              </div>
                              <div className={`font-medium ${
                                transaction.type === 'income' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}
                                {formatCurrency(transaction.amount)}
                              </div>
                            </div>
                            
                            {candidates.length > 0 && (
                              <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded p-3">
                                <div className="text-sm font-medium mb-2">Possible matches:</div>
                                <div className="space-y-2">
                                  {candidates.map((candidate, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                      <div>
                                        <span className="font-medium">{candidate.transaction.description}</span>
                                        <span className="text-gray-500 ml-2">
                                          ({candidate.reasons.join(', ')})
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleManualMatch(transaction.id, candidate.transaction.id)}
                                        className="text-primary hover:underline"
                                      >
                                        Use this
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleClearSelected([transaction.id])}
                            className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Success Message */}
            {unclearedTransactions.length === 0 && Math.abs(statementDifference) < 0.01 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
                <CheckCircleIcon className="mx-auto text-green-600 dark:text-green-400 mb-3" size={48} />
                <h4 className="text-lg font-medium text-green-900 dark:text-green-300">
                  Account Reconciled!
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  All transactions are cleared and your balance matches the statement.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
