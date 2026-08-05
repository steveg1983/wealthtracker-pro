import type { ReactNode } from 'react';
import { AccountProvider } from './AccountContext';
import { CategoryProvider } from './CategoryContext';
import { PreferencesProvider } from './PreferencesContext';
import { LayoutProvider } from './LayoutContext';
import { getDefaultTestAccounts } from '../data/defaultTestData';

interface CombinedProviderProps {
  children: ReactNode;
  useTestData?: boolean;
}

/**
 * The app's live state comes from AppContextSupabase; these providers are the
 * remaining localStorage-backed contexts that still have consumers.
 *
 * TransactionProvider, GoalProvider and BudgetProvider used to be mounted here
 * too. Nothing useful read them — they only mirrored financial data into
 * plaintext localStorage under money_management_*, readable by any script on
 * the origin, for no benefit. BudgetProvider was worse than useless: the
 * envelope, template, rollover and alert tabs read budgets from it rather than
 * from Supabase, so for a real signed-in user those four tabs were permanently
 * empty. They all read `useApp()` now, and the providers were removed rather
 * than migrated.
 */
export function CombinedProvider({ children, useTestData = false }: CombinedProviderProps) {
  // Get test data if requested
  const initialAccounts = useTestData ? getDefaultTestAccounts() : [];

  return (
    <PreferencesProvider>
      <LayoutProvider>
        <CategoryProvider>
          <AccountProvider initialAccounts={initialAccounts}>
            {children}
          </AccountProvider>
        </CategoryProvider>
      </LayoutProvider>
    </PreferencesProvider>
  );
}
