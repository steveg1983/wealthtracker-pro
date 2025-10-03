import { createContext } from 'react';
import type { Account, Holding } from '../types';

export type { Account, Holding };

export interface AccountContextType {
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  getAccount: (id: string) => Account | undefined;
}

export const AccountContext = createContext<AccountContextType | undefined>(undefined);
