import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { ArrowRightLeft, Check, X, Search, AlertCircle, CheckCircle, Eye, Link } from 'lucide-react';
import ReconciliationModal from '../components/ReconciliationModal';

interface PotentialMatch {
  id: string;
  outTransaction: any;
  inTransaction: any;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'amount-only';
}

export default function Reconciliation() {
  const { transactions, accounts, updateTransaction } = useApp();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [showOnlyUnreconciled, setShowOnlyUnreconciled] = useState(true);
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<PotentialMatch | null>(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [manualReconcileTransaction, setManualReconcileTransaction] = useState<any>(null);

  // Find potential transfer matches
  useEffect(() => {
    const findMatches = () => {
      const matches: PotentialMatch[] = [];
      const processedPairs = new Set<string>();

      // Look for potential transfers
      transactions.forEach(outTrans => {
        if (outTrans.type === 'expense' && !outTrans.reconciledWith) {
          transactions.forEach(inTrans => {
            if (inTrans.type === 'income' && 
                !inTrans.reconciledWith && 
                outTrans.id !== inTrans.id &&
                outTrans.accountId !== inTrans.accountId) {
              
              const pairKey = [outTrans.id, inTrans.id].sort().join('-');
              if (processedPairs.has(pairKey)) return;
              processedPairs.add(pairKey);

              // Check for exact date and amount match
              const sameDate = new Date(outTrans.date).toDateString() === new Date(inTrans.date).toDateString();
              const sameAmount = Math.abs(outTrans.amount - inTrans.amount) < 0.01;
              
              if (sameDate && sameAmount) {
                // Check description similarity
                const outDesc = outTrans.description.toLowerCase();
                const inDesc = inTrans.description.toLowerCase();
                
                let confidence = 50; // Base confidence for same date and amount
                let matchType: 'exact' | 'fuzzy' | 'amount-only' = 'amount-only';

                // Check for transfer keywords
                const transferKeywords = ['transfer', 'tfr', 'from', 'to'];
                const hasTransferKeyword = transferKeywords.some(keyword => 
                  outDesc.includes(keyword) || inDesc.includes(keyword)
                );
                
                if (hasTransferKeyword) {
                  confidence += 20;
                }

                // Check if descriptions reference account names
                const outAccount = accounts.find(a => a.id === outTrans.accountId);
                const inAccount = accounts.find(a => a.id === inTrans.accountId);
                
                if (outAccount && inAccount) {
                  if (inDesc.toLowerCase().includes(outAccount.name.toLowerCase()) ||
                      outDesc.toLowerCase().includes(inAccount.name.toLowerCase())) {
                    confidence += 20;
                    matchType = 'fuzzy';
                  }
                }

                // Check for similar descriptions
                const similarity = calculateSimilarity(outDesc, inDesc);
                if (similarity > 0.7) {
                  confidence += 10;
                  if (similarity > 0.9) {
                    matchType = 'exact';
                  }
                }

                matches.push({
                  id: `${outTrans.id}-${inTrans.id}`,
                  outTransaction: outTrans,
                  inTransaction: inTrans,
                  confidence,
                  matchType
                });
              }
              
              // Also check for near-date matches (within 3 days)
              const daysDiff = Math.abs(
                (new Date(outTrans.date).getTime() - new Date(inTrans.date).getTime()) / (1000 * 60 * 60 * 24)
              );
              
              if (daysDiff <= 3 && sameAmount && !sameDate) {
                matches.push({
                  id: `${outTrans.id}-${inTrans.id}`,
                  outTransaction: outTrans,
                  inTransaction: inTrans,
                  confidence: 30 + (3 - daysDiff) * 10,
                  matchType: 'fuzzy'
                });
              }
            }
          });
        }
      });

      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);
      setPotentialMatches(matches);
    };

    findMatches();
  }, [transactions, accounts]);

  // Calculate string similarity (Levenshtein distance)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = (longer: string, shorter: string): number => {
      const matrix: number[][] = [];
      
      for (let i = 0; i <= shorter.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= longer.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= shorter.length; i++) {
        for (let j = 1; j <= longer.length; j++) {
          if (shorter.charAt(i - 1) === longer.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      
      return matrix[shorter.length][longer.length];
    };
    
    return (longer.length - editDistance(longer, shorter)) / longer.length;
  };

  // Quick reconcile a match
  const handleQuickReconcile = (match: PotentialMatch) => {
    // Update both transactions to mark them as reconciled
    updateTransaction(match.outTransaction.id, {
      ...match.outTransaction,
      reconciledWith: match.inTransaction.id,
      reconciledDate: new Date()
    });
    
    updateTransaction(match.inTransaction.id, {
      ...match.inTransaction,
      reconciledWith: match.outTransaction.id,
      reconciledDate: new Date()
    });
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (selectedAccount !== 'all' && transaction.accountId !== selectedAccount) {
        return false;
      }
      if (showOnlyUnreconciled && transaction.reconciledWith) {
        return false;
      }
      return true;
    });
  }, [transactions, selectedAccount, showOnlyUnreconciled]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-600 dark:text-green-400';
    if (confidence >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Account Reconciliation</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Accounts</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlyUnreconciled}
              onChange={(e) => setShowOnlyUnreconciled(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show only unreconciled</span>
          </label>
        </div>
      </div>

      {/* Potential Matches */}
      {potentialMatches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white flex items-center gap-2">
            <Search size={24} />
            Potential Transfer Matches
          </h2>
          
          <div className="space-y-3">
            {potentialMatches.slice(0, 5).map(match => (
              <div key={match.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">From:</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getAccountName(match.outTransaction.accountId)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {match.outTransaction.description}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          -{formatCurrency(match.outTransaction.amount)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(match.outTransaction.date)}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">To:</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getAccountName(match.inTransaction.accountId)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {match.inTransaction.description}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          +{formatCurrency(match.inTransaction.amount)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(match.inTransaction.date)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-sm font-medium ${getConfidenceColor(match.confidence)}`}>
                        {match.confidence}% match
                      </span>
                      {match.matchType === 'exact' && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                          Exact match
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedMatch(match);
                        setShowReconciliationModal(true);
                      }}
                      className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Review"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={() => handleQuickReconcile(match)}
                      className="p-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      title="Quick reconcile"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => {
                        // Remove from suggestions
                        setPotentialMatches(potentialMatches.filter(m => m.id !== match.id));
                      }}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Dismiss"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {potentialMatches.length > 5 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
              And {potentialMatches.length - 5} more potential matches...
            </p>
          )}
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Transactions</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {getAccountName(transaction.accountId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {transaction.description}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${
                    transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.reconciledWith ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200">
                        <CheckCircle size={14} />
                        Reconciled
                      </span>
                    ) : transaction.cleared ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                        <Check size={14} />
                        Cleared
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        <AlertCircle size={14} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setManualReconcileTransaction(transaction);
                        setShowReconciliationModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Link size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reconciliation Modal */}
      <ReconciliationModal
        isOpen={showReconciliationModal}
        onClose={() => {
          setShowReconciliationModal(false);
          setSelectedMatch(null);
          setManualReconcileTransaction(null);
        }}
        match={selectedMatch}
        transaction={manualReconcileTransaction}
      />
    </div>
  );
}
