import type { ReactNode } from 'react';
import { AccountProvider } from './AccountContext';
import { BudgetProvider } from './BudgetContext';
import { CategoryProvider } from './CategoryContext';
import { PreferencesProvider } from './PreferencesContext';
import { LayoutProvider } from './LayoutContext';
import { getDefaultTestAccounts, getDefaultTestBudgets } from '../data/defaultTestData';

interface CombinedProviderProps {
  children: ReactNode;
  useTestData?: boolean;
}

/**
 * The app's live state comes from AppContextSupabase; these providers are the
 * remaining localStorage-backed contexts that still have consumers.
 *
 * TransactionProvider and GoalProvider used to be mounted here too. Nothing
 * read them — they only mirrored transactions and goals into plaintext
 * localStorage under money_management_*, leaving financial data readable by any
 * script on the origin for no benefit. They were removed rather than migrated.
 */
export function CombinedProvider({ children, useTestData = false }: CombinedProviderProps) {
  // Get test data if requested
  const initialAccounts = useTestData ? getDefaultTestAccounts() : [];
  const initialBudgets = useTestData ? getDefaultTestBudgets() : [];

  return (
    <PreferencesProvider>
      <LayoutProvider>
        <CategoryProvider>
          <AccountProvider initialAccounts={initialAccounts}>
            <BudgetProvider initialBudgets={initialBudgets}>
              {children}
            </BudgetProvider>
          </AccountProvider>
        </CategoryProvider>
      </LayoutProvider>
    </PreferencesProvider>
  );
}
