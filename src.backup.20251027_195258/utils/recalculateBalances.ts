import { Decimal, toDecimal } from '@wealthtracker/utils';
import type { Account, Transaction } from '../types';

export function recalculateAccountBalances(
  accounts: Account[], 
  transactions: Transaction[]
): Account[] {
  return accounts.map(account => {
    // Get all transactions for this account
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    
    // Start with opening balance
    let balanceDecimal = toDecimal(account.openingBalance || 0);
    
    // Add each transaction based on type
    accountTransactions.forEach(transaction => {
      switch (transaction.type) {
        case 'income':
          balanceDecimal = balanceDecimal.plus(toDecimal(transaction.amount));
          break;
        case 'expense':
          balanceDecimal = balanceDecimal.minus(toDecimal(transaction.amount));
          break;
        case 'transfer':
          // Transfers can be positive (incoming) or negative (outgoing)
          // The amount sign indicates the direction
          balanceDecimal = balanceDecimal.plus(toDecimal(transaction.amount));
          break;
        // Unknown types are ignored
      }
    });
    
    // For investment accounts, add the value of holdings
    if (account.type === 'investment' && account.holdings) {
      const holdingsValueDecimal = account.holdings.reduce((total, holding) => {
        const holdingValue = holding.marketValue ?? holding.value ?? 0;
        return total.plus(toDecimal(holdingValue));
      }, toDecimal(0));
      balanceDecimal = balanceDecimal.plus(holdingsValueDecimal);
    }
    
    return {
      ...account,
      balance: balanceDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(), // Round to 2 decimal places
      lastUpdated: new Date()
    };
  });
}
