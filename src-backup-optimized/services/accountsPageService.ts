import { toDecimal } from '../utils/decimal';
import { calculateTotalBalance } from '../utils/calculations-decimal';
import type { Account } from '../types';
import type { DecimalInstance } from '../types/decimal-types';

export interface AccountTypeMetadata {
  type: string;
  title: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface GroupedAccounts {
  [type: string]: Account[];
}

export interface DecimalAccount extends Omit<Account, 'balance' | 'openingBalance' | 'holdings'> {
  balance: DecimalInstance;
  openingBalance?: DecimalInstance;
  holdings?: Array<{
    ticker: string;
    name: string;
    shares: DecimalInstance;
    value: DecimalInstance;
    averageCost?: DecimalInstance;
    currentPrice?: DecimalInstance;
    marketValue?: DecimalInstance;
    gain?: DecimalInstance;
    gainPercent?: DecimalInstance;
    currency?: string;
  }>;
}

export interface GroupedDecimalAccounts {
  [type: string]: DecimalAccount[];
}

export interface InvestmentSummary {
  cashBalance: number;
  holdingsValue: number;
  totalValue: number;
  positionCount: number;
}

class AccountsPageService {
  getAccountTypeMetadata(): AccountTypeMetadata[] {
    return [
      { 
        type: 'current', 
        title: 'Current Accounts', 
        icon: 'WalletIcon', 
        color: 'text-gray-600 dark:text-gray-500',
        bgColor: 'bg-blue-200 dark:bg-gray-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      },
      { 
        type: 'savings', 
        title: 'Savings Accounts', 
        icon: 'PiggyBankIcon', 
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-200 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800'
      },
      { 
        type: 'credit', 
        title: 'Credit Cards', 
        icon: 'CreditCardIcon', 
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-200 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800'
      },
      { 
        type: 'loan', 
        title: 'Loans', 
        icon: 'TrendingDownIcon', 
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-200 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800'
      },
      { 
        type: 'investment', 
        title: 'Investments', 
        icon: 'TrendingUpIcon', 
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-200 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800'
      },
      { 
        type: 'asset', 
        title: 'Assets', 
        icon: 'HomeIcon', 
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-200 dark:bg-indigo-900/20',
        borderColor: 'border-indigo-200 dark:border-indigo-800'
      },
      { 
        type: 'liability', 
        title: 'Liabilities', 
        icon: 'TrendingDownIcon', 
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-200 dark:bg-gray-900/20',
        borderColor: 'border-gray-200 dark:border-gray-800'
      }
    ];
  }

  convertToDecimalAccounts(accounts: Account[]): DecimalAccount[] {
    return accounts.map(a => ({
      ...a,
      balance: toDecimal(a.balance),
      openingBalance: a.openingBalance ? toDecimal(a.openingBalance) : undefined,
      holdings: a.holdings ? a.holdings.map(h => ({
        ticker: h.ticker,
        name: h.name,
        shares: toDecimal(h.shares),
        value: toDecimal(h.value),
        averageCost: h.averageCost ? toDecimal(h.averageCost) : undefined,
        currentPrice: h.currentPrice ? toDecimal(h.currentPrice) : undefined,
        marketValue: h.marketValue ? toDecimal(h.marketValue) : undefined
      })) : undefined
    }));
  }

  groupAccountsByType(accounts: Account[]): GroupedAccounts {
    return accounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as GroupedAccounts);
  }

  groupDecimalAccountsByType(accounts: DecimalAccount[]): GroupedDecimalAccounts {
    return accounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as GroupedDecimalAccounts);
  }

  calculateTypeTotal(accounts: DecimalAccount[]): DecimalInstance {
    return calculateTotalBalance(accounts);
  }

  getInvestmentSummary(account: Account): InvestmentSummary | null {
    if (account.type !== 'investment' || !account.holdings || account.holdings.length === 0) {
      return null;
    }

    const holdingsValue = account.holdings.reduce((sum, h) => 
      sum + (h.marketValue || h.value || 0), 0
    );

    return {
      cashBalance: account.balance - holdingsValue,
      holdingsValue,
      totalValue: account.balance,
      positionCount: account.holdings.length
    };
  }

  validateBalanceEdit(value: string): number | null {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  formatLastUpdated(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  }

  shouldShowEmptyState(accounts: Account[]): boolean {
    return accounts.length === 0;
  }

  getEmptyStateMessage(): string {
    return 'No accounts yet. Click "Add Account" to get started!';
  }
}

export const accountsPageService = new AccountsPageService();