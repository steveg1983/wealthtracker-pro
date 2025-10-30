import React, { type FC, type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from '@/contexts/AppContextSupabase';
import { ToastProvider } from '@/contexts/ToastContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { BudgetProvider } from '@/contexts/BudgetContext';
import { GoalProvider } from '@/contexts/GoalContext';
import { CategoryProvider } from '@/contexts/CategoryContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { TransactionProvider } from '@/contexts/TransactionContext';

type RealTestProviderProps = {
  children?: React.ReactNode;
};

const noop = () => {};

export const RealTestProvider: FC<RealTestProviderProps> = ({ children = null }) => {
  const testClerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_fake';

  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={testClerkKey}>
        <AppProvider>
          <ToastProvider>
            <NotificationProvider>
              <NavigationProvider
                navigate={noop}
                setCurrentPage={noop}
                setSelectedAccountId={noop}
              >
                <PreferencesProvider>
                  <AccountProvider>
                    <CategoryProvider>
                      <TransactionProvider>
                        <BudgetProvider>
                          <GoalProvider>{children}</GoalProvider>
                        </BudgetProvider>
                      </TransactionProvider>
                    </CategoryProvider>
                  </AccountProvider>
                </PreferencesProvider>
              </NavigationProvider>
            </NotificationProvider>
          </ToastProvider>
        </AppProvider>
      </ClerkProvider>
    </BrowserRouter>
  );
};

export function renderWithRealData(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    wrapper: RealTestProvider,
    ...options,
  });
}

export { RealTestDatabase, withRealDatabase } from './realDatabase';
