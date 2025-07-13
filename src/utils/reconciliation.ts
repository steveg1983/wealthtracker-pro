// Shared reconciliation logic between Dashboard and Reconciliation pages

export interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  accountId: string;
  type: 'credit' | 'debit';
  bankReference?: string;
  merchantCategory?: string;
}

// Mock bank transactions (same data used by both pages)
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

export const mockBankTransactions: BankTransaction[] = [
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

// Shared reconciliation utility functions
export const getUnreconciledCount = (accountId: string, transactions: any[]) => {
  return mockBankTransactions.filter(bt => 
    bt.accountId === accountId && !transactions.some(t => (t as any).bankReference === bt.id)
  ).length;
};

export interface ReconciliationSummary {
  account: any;
  unreconciledCount: number;
  totalToReconcile: number;
  lastImportDate: Date | null;
}

export const getReconciliationSummary = (accounts: any[], transactions: any[]): ReconciliationSummary[] => {
  // Filter to bank-connected accounts only
  const bankAccounts = accounts.filter(a => a.type === 'current' || a.type === 'credit' || a.type === 'savings');
  
  const reconciliationDetails = bankAccounts.map(account => {
    const unreconciledCount = getUnreconciledCount(account.id, transactions);
    const accountBankTransactions = mockBankTransactions.filter(bt => bt.accountId === account.id);
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
  }).filter(summary => summary.unreconciledCount > 0); // Only accounts with unreconciled items

  return reconciliationDetails;
};