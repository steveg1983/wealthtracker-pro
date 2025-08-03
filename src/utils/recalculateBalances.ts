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
    
    // Add each transaction (amounts are already signed: negative for expenses, positive for income)
    accountTransactions.forEach(transaction => {
      balance += transaction.amount;
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