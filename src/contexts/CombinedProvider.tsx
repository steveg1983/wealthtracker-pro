import type { ReactNode } from 'react';
import { AccountProvider } from './AccountContext';
import { TransactionProvider } from './TransactionContext';
import { BudgetProvider } from './BudgetContext';
import { CategoryProvider } from './CategoryContext';
import { GoalProvider } from './GoalContext';
import { PreferencesProvider } from './PreferencesContext';
import { LayoutProvider } from './LayoutContext';
import { getDefaultTestAccounts, getDefaultTestTransactions, getDefaultTestBudgets, getDefaultTestGoals } from '../data/defaultTestData';

interface CombinedProviderProps {
  children: ReactNode;
  useTestData?: boolean;
}

export function CombinedProvider({ children, useTestData = false }: CombinedProviderProps) {
  // Get test data if requested
  const initialAccounts = useTestData ? getDefaultTestAccounts() : [];
  const initialTransactions = useTestData ? getDefaultTestTransactions() : [];
  const initialBudgets = useTestData ? getDefaultTestBudgets() : [];
  const initialGoals = useTestData ? getDefaultTestGoals() : [];

  return (
    <PreferencesProvider>
      <LayoutProvider>
        <CategoryProvider>
          <AccountProvider initialAccounts={initialAccounts}>
            <TransactionProvider 
              initialTransactions={initialTransactions}
              initialRecurringTransactions={[]}
            >
              <BudgetProvider initialBudgets={initialBudgets}>
                <GoalProvider initialGoals={initialGoals}>
                  {children}
                </GoalProvider>
              </BudgetProvider>
            </TransactionProvider>
          </AccountProvider>
        </CategoryProvider>
      </LayoutProvider>
    </PreferencesProvider>
  );
}