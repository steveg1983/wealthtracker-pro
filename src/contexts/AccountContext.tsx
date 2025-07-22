/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  averageCost?: number;
  currentPrice?: number;
  marketValue?: number;
  gain?: number;
  gainPercent?: number;
  currency?: string;
  lastUpdated?: Date;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other' | 'mortgage' | 'checking' | 'asset';
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  holdings?: Holding[];
  notes?: string;
  openingBalance?: number;
  openingBalanceDate?: Date;
  sortCode?: string;
  accountNumber?: string;
}

interface AccountContextType {
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  getAccount: (id: string) => Account | undefined;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

interface AccountProviderProps {
  children: ReactNode;
  initialAccounts?: Account[];
}

export function AccountProvider({ children, initialAccounts = [] }: AccountProviderProps) {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const savedAccounts = localStorage.getItem('money_management_accounts');
    if (savedAccounts) {
      try {
        const parsed = JSON.parse(savedAccounts);
        return parsed.map((acc: Account) => ({
          ...acc,
          lastUpdated: new Date(acc.lastUpdated),
          openingBalanceDate: acc.openingBalanceDate ? new Date(acc.openingBalanceDate) : undefined
        }));
      } catch (error) {
        console.error('Error parsing saved accounts:', error);
        return initialAccounts;
      }
    }
    return initialAccounts;
  });

  // Save accounts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_accounts', JSON.stringify(accounts));
  }, [accounts]);

  const addAccount = (accountData: Omit<Account, 'id'>) => {
    const newAccount: Account = {
      ...accountData,
      id: uuidv4(),
      lastUpdated: new Date()
    };
    setAccounts(prev => [...prev, newAccount]);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev => prev.map(account => 
      account.id === id 
        ? { ...account, ...updates, lastUpdated: new Date() }
        : account
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(account => account.id !== id));
  };

  const getAccount = (id: string) => {
    return accounts.find(account => account.id === id);
  };

  return (
    <AccountContext.Provider value={{
      accounts,
      addAccount,
      updateAccount,
      deleteAccount,
      getAccount
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccounts must be used within AccountProvider');
  }
  return context;
}

