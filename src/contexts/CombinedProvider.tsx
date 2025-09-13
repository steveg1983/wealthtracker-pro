import type { ReactNode } from 'react';
import { AccountProvider } from './AccountContext';
import { TransactionProvider } from './TransactionContext';
import { CategoryProvider } from './CategoryContext';
import { PreferencesProvider } from './PreferencesContext';
import { LayoutProvider } from './LayoutContext';
import { getDefaultTestAccounts, getDefaultTestTransactions } from '../data/defaultTestData';

interface CombinedProviderProps {
  children: ReactNode;
  useTestData?: boolean;
}

export function CombinedProvider({ children, useTestData = false }: CombinedProviderProps) {
  // Get test data if requested
  const initialAccounts = useTestData ? getDefaultTestAccounts() : [];
  const initialTransactions = useTestData ? getDefaultTestTransactions() : [];

  return (
    <PreferencesProvider>
      <LayoutProvider>
        <CategoryProvider>
          <AccountProvider initialAccounts={initialAccounts as any}>
            <TransactionProvider 
              initialTransactions={initialTransactions}
              initialRecurringTransactions={[]}
            >
              {children}
            </TransactionProvider>
          </AccountProvider>
        </CategoryProvider>
      </LayoutProvider>
    </PreferencesProvider>
  );
}