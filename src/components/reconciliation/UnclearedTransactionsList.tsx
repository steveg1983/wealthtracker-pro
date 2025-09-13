import { memo, useEffect } from 'react';
import { CalendarIcon } from '../icons';
import type { Transaction } from '../../types';
import type { MatchCandidate } from '../../services/reconciliationService';
import { logger } from '../../services/loggingService';

interface UnclearedTransactionsListProps {
  transactions: Transaction[];
  showSuggestions: boolean;
  formatCurrency: (amount: number) => string;
  findMatchingCandidates: (transaction: Transaction) => MatchCandidate[];
  onManualMatch: (transactionId: string, matchId: string) => void;
  onClearTransaction: (transactionId: string) => void;
  onToggleSuggestions: (show: boolean) => void;
}

/**
 * Uncleared transactions list component
 * Shows uncleared transactions with matching suggestions
 */
export const UnclearedTransactionsList = memo(function UnclearedTransactionsList({
  transactions,
  showSuggestions,
  formatCurrency,
  findMatchingCandidates,
  onManualMatch,
  onClearTransaction,
  onToggleSuggestions
}: UnclearedTransactionsListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('UnclearedTransactionsList component initialized', {
      componentName: 'UnclearedTransactionsList'
    });
  }, []);

  if (transactions.length === 0) return <></>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Uncleared Transactions</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSuggestions}
            onChange={(e) => onToggleSuggestions(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show suggestions</span>
        </label>
      </div>
      
      <div className="space-y-4">
        {transactions.map(transaction => {
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
                    <MatchingSuggestions
                      candidates={candidates}
                      transactionId={transaction.id}
                      onManualMatch={onManualMatch}
                    />
                  )}
                </div>
                
                <button
                  onClick={() => onClearTransaction(transaction.id)}
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
  );
});

/**
 * Matching suggestions sub-component
 */
const MatchingSuggestions = memo(function MatchingSuggestions({
  candidates,
  transactionId,
  onManualMatch
}: {
  candidates: MatchCandidate[];
  transactionId: string;
  onManualMatch: (transactionId: string, matchId: string) => void;
}) {
  return (
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
              onClick={() => onManualMatch(transactionId, candidate.transaction.id)}
              className="text-primary hover:underline"
            >
              Use this
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});