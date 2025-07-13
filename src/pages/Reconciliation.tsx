import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { CheckCircle, Building2, CreditCard, Plus, Lightbulb, ChevronRight, ArrowLeft } from 'lucide-react';
import EditTransactionModal from '../components/EditTransactionModal';

// Mock imported bank transactions (in real app, these would come from bank API/import)
interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  accountId: string;
  type: 'credit' | 'debit';
  bankReference?: string;
  merchantCategory?: string;
}

// Simulated bank transactions to reconcile
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

const mockBankTransactions: BankTransaction[] = [
  {
    id: 'bank-1',
    date: new Date(currentYear, currentMonth, 10),
    description: 'TESCO STORES 2345',
    amount: 45.67,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Groceries'
  },
  {
    id: 'bank-2',
    date: new Date(currentYear, currentMonth, 11),
    description: 'TFL TRAVEL CHARGE',
    amount: 8.40,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Transportation'
  },
  {
    id: 'bank-3',
    date: new Date(currentYear, currentMonth, 12),
    description: 'SALARY - TECH CORP LTD',
    amount: 3500.00,
    accountId: '1',
    type: 'credit',
    merchantCategory: 'Salary'
  },
  {
    id: 'bank-4',
    date: new Date(currentYear, currentMonth, 13),
    description: 'TRANSFER TO SAVINGS',
    amount: 500.00,
    accountId: '1',
    type: 'debit',
    bankReference: 'TFR-123456'
  },
  {
    id: 'bank-5',
    date: new Date(currentYear, currentMonth, 14),
    description: 'NETFLIX.COM',
    amount: 15.99,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Entertainment'
  },
  {
    id: 'bank-6',
    date: new Date(currentYear, currentMonth, 15),
    description: 'BARCLAYCARD PAYMENT',
    amount: 250.00,
    accountId: '7',
    type: 'credit',
    merchantCategory: 'Payment'
  },
  {
    id: 'bank-7',
    date: new Date(currentYear, currentMonth, 16),
    description: 'AMAZON.CO.UK',
    amount: 89.99,
    accountId: '7',
    type: 'debit',
    merchantCategory: 'Shopping'
  },
  {
    id: 'bank-8',
    date: new Date(currentYear, currentMonth, 16),
    description: 'MORTGAGE PAYMENT',
    amount: 1200.00,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Housing'
  },
  {
    id: 'bank-9',
    date: new Date(currentYear, currentMonth, 17),
    description: 'INTEREST CREDIT',
    amount: 2.50,
    accountId: '2',
    type: 'credit',
    merchantCategory: 'Interest'
  },
  {
    id: 'bank-10',
    date: new Date(currentYear, currentMonth, 18),
    description: 'TRANSFER FROM CURRENT',
    amount: 500.00,
    accountId: '2',
    type: 'credit',
    bankReference: 'TFR-123456'
  }
];

export default function Reconciliation() {
  const { transactions, accounts, addTransaction, updateTransaction } = useApp();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [bankTransactions] = useState<BankTransaction[]>(mockBankTransactions);
  const [currentBankTransaction, setCurrentBankTransaction] = useState<BankTransaction | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newTransactionData, setNewTransactionData] = useState<any>({});
  const [suggestedMatches, setSuggestedMatches] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Get accounts with bank imports (in real app, filter by accounts with bank connections)
  const bankAccounts = accounts.filter(a => a.type === 'current' || a.type === 'credit' || a.type === 'savings');

  // Calculate unreconciled transactions per account
  const getUnreconciledCount = (accountId: string) => {
    return bankTransactions.filter(bt => 
      bt.accountId === accountId && !transactions.some(t => (t as any).bankReference === bt.id)
    ).length;
  };

  // Get account summary data
  const accountSummaries = bankAccounts.map(account => {
    const unreconciledCount = getUnreconciledCount(account.id);
    const accountBankTransactions = bankTransactions.filter(bt => bt.accountId === account.id);
    const totalToReconcile = accountBankTransactions
      .filter(bt => !transactions.some(t => (t as any).bankReference === bt.id))
      .reduce((sum, bt) => sum + bt.amount, 0);

    return {
      account,
      unreconciledCount,
      totalToReconcile,
      lastImportDate: accountBankTransactions.length > 0 
        ? new Date(Math.max(...accountBankTransactions.map(bt => bt.date.getTime())))
        : null
    };
  }).filter(summary => summary.unreconciledCount > 0);

  // Set initial bank transaction when account is selected
  useEffect(() => {
    if (!selectedAccount) return;
    
    const unreconciled = bankTransactions.filter(bt => 
      bt.accountId === selectedAccount && !transactions.some(t => (t as any).bankReference === bt.id)
    );
    if (unreconciled.length > 0) {
      setCurrentBankTransaction(unreconciled[0]);
    }
  }, [selectedAccount, bankTransactions, transactions]);

  // Find suggested matches when bank transaction changes
  useEffect(() => {
    if (!currentBankTransaction) {
      setSuggestedMatches([]);
      return;
    }

    // Find potential matches
    const matches = transactions.filter(t => {
      // Skip already reconciled transactions
      if (t.reconciledWith) return false;
      
      // Check date proximity (within 3 days)
      const daysDiff = Math.abs(
        (new Date(t.date).getTime() - currentBankTransaction.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 3) return false;

      // Check amount match
      const amountMatch = Math.abs(t.amount - currentBankTransaction.amount) < 0.01;
      if (!amountMatch) return false;

      // Check type match
      const typeMatch = (currentBankTransaction.type === 'credit' && t.type === 'income') ||
                       (currentBankTransaction.type === 'debit' && t.type === 'expense');
      
      return typeMatch;
    });

    setSuggestedMatches(matches);

    // Pre-populate new transaction data based on bank transaction
    const suggestedCategory = getSuggestedCategory(currentBankTransaction);
    setNewTransactionData({
      date: currentBankTransaction.date,
      description: cleanDescription(currentBankTransaction.description),
      amount: currentBankTransaction.amount,
      type: currentBankTransaction.type === 'credit' ? 'income' : 'expense',
      category: suggestedCategory,
      accountId: currentBankTransaction.accountId,
      bankReference: currentBankTransaction.id
    });
  }, [currentBankTransaction, transactions]);

  // Get suggested category based on description and merchant category
  const getSuggestedCategory = (bankTrans: BankTransaction): string => {
    // Check merchant category mapping
    const categoryMap: Record<string, string> = {
      'Groceries': 'Groceries',
      'Transportation': 'Transportation',
      'Salary': 'Salary',
      'Entertainment': 'Entertainment',
      'Housing': 'Housing',
      'Shopping': 'Shopping',
      'Payment': 'Credit Card Payment',
      'Interest': 'Interest Income'
    };

    if (bankTrans.merchantCategory && categoryMap[bankTrans.merchantCategory]) {
      return categoryMap[bankTrans.merchantCategory];
    }

    // Check description patterns
    const desc = bankTrans.description.toLowerCase();
    if (desc.includes('tesco') || desc.includes('sainsbury') || desc.includes('asda')) return 'Groceries';
    if (desc.includes('tfl') || desc.includes('uber') || desc.includes('transport')) return 'Transportation';
    if (desc.includes('salary') || desc.includes('wages')) return 'Salary';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('cinema')) return 'Entertainment';
    if (desc.includes('mortgage')) return 'Housing';
    if (desc.includes('transfer')) return 'Transfer';
    
    return 'Other';
  };

  // Clean bank description for display
  const cleanDescription = (description: string): string => {
    // Remove common bank reference patterns
    return description
      .replace(/\s+\d{4,}$/, '') // Remove trailing numbers
      .replace(/^(POS|DD|SO|FT|)\s+/, '') // Remove payment type prefixes
      .trim();
  };

  // Handle matching with existing transaction
  const handleMatch = (transaction: any) => {
    if (!currentBankTransaction) return;

    // Update the existing transaction with bank reference
    updateTransaction(transaction.id, {
      ...transaction,
      reconciledWith: currentBankTransaction.id,
      bankReference: currentBankTransaction.id,
      cleared: true
    });

    // Move to next bank transaction
    moveToNext();
  };

  // Handle creating new transaction
  const handleCreateNew = () => {
    if (!currentBankTransaction) return;

    addTransaction({
      ...newTransactionData,
      reconciledWith: currentBankTransaction.id,
      cleared: true
    });

    // Move to next bank transaction
    moveToNext();
  };

  // Skip current bank transaction
  const handleSkip = () => {
    moveToNext();
  };

  // Move to next unreconciled bank transaction
  const moveToNext = () => {
    if (!selectedAccount) return;
    
    const currentIndex = bankTransactions.findIndex(bt => bt.id === currentBankTransaction?.id);
    const remaining = bankTransactions.slice(currentIndex + 1).filter(bt => 
      bt.accountId === selectedAccount && !transactions.some(t => (t as any).bankReference === bt.id)
    );
    
    if (remaining.length > 0) {
      setCurrentBankTransaction(remaining[0]);
      setShowCreateNew(false);
    } else {
      setCurrentBankTransaction(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

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
    setCurrentBankTransaction(null);
    setShowCreateNew(false);
  };

  // Count total unreconciled transactions
  const totalUnreconciledCount = bankTransactions.filter(bt => 
    !transactions.some(t => (t as any).bankReference === bt.id)
  ).length;

  // Show account summary view if no account is selected
  if (!selectedAccount) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bank Reconciliation</h1>
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
              {accountSummaries.map(({ account, unreconciledCount, totalToReconcile, lastImportDate }) => (
                <div
                  key={account.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedAccount(account.id)}
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
  const unreconciledCount = getUnreconciledCount(selectedAccount);

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

      {!currentBankTransaction ? (
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Bank Transaction */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 size={20} />
                Bank Transaction
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(currentBankTransaction.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">
                    {currentBankTransaction.description}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                  <span className={`text-xl font-bold ${
                    currentBankTransaction.type === 'credit' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {currentBankTransaction.type === 'credit' ? '+' : '-'}
                    {formatCurrency(currentBankTransaction.amount)}
                  </span>
                </div>
                {currentBankTransaction.merchantCategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Category hint</span>
                    <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      {currentBankTransaction.merchantCategory}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={() => {/* Add manual matching mode */}}
                    className="flex-1 px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10"
                  >
                    Find match
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Matching Options */}
          <div className="space-y-6">
            {/* Suggested Matches */}
            {suggestedMatches.length > 0 && !showCreateNew && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Lightbulb size={20} className="text-yellow-500" />
                    Suggested Matches
                  </h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {suggestedMatches.map(match => (
                    <div key={match.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {match.description}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(match.date)} • {match.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${
                            match.type === 'income' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatCurrency(match.amount)}
                          </span>
                          <button
                            onClick={() => handleMatch(match)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Match
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Transaction */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Plus size={20} />
                  {showCreateNew ? 'New Transaction Details' : 'No Match Found?'}
                </h3>
              </div>
              <div className="p-6">
                {!showCreateNew ? (
                  <button
                    onClick={() => setShowCreateNew(true)}
                    className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary"
                  >
                    Create New Transaction
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newTransactionData.description}
                        onChange={(e) => setNewTransactionData({
                          ...newTransactionData,
                          description: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={newTransactionData.category}
                        onChange={(e) => setNewTransactionData({
                          ...newTransactionData,
                          category: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                      >
                        <option value="Groceries">Groceries</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Dining">Dining</option>
                        <option value="Housing">Housing</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Investment">Investment</option>
                        <option value="Retirement">Retirement</option>
                        <option value="Charity">Charity</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCreateNew(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateNew}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Create & Match
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Tip:</strong> Bank transfers between your accounts? Look for the corresponding 
                transaction in another account or create both sides of the transfer.
              </p>
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