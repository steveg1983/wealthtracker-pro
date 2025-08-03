import type { Account, Transaction } from '../types';

export function recalculateAccountBalances(
  accounts: Account[], 
  transactions: Transaction[]
): Account[] {
  return accounts.map(account => {
    // Get all transactions for this account
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    
    // Start with opening balance
    let balance = account.openingBalance || 0;
    
    // Add/subtract each transaction
    accountTransactions.forEach(transaction => {
      if (transaction.type === 'income') {
        balance += transaction.amount;
      } else if (transaction.type === 'expense') {
        balance -= transaction.amount;
      } else if (transaction.type === 'transfer') {
        // For transfers, the amount sign indicates direction
        // Positive = money coming IN, Negative = money going OUT
        balance += transaction.amount;
      }
    });
    
    // For investment accounts, add the value of holdings
    if (account.type === 'investment' && account.holdings) {
      const holdingsValue = account.holdings.reduce((total, holding) => {
        return total + (holding.marketValue || holding.value || 0);
      }, 0);
      balance += holdingsValue;
    }
    
    return {
      ...account,
      balance: Math.round(balance * 100) / 100, // Round to 2 decimal places
      lastUpdated: new Date()
    };
  });
}