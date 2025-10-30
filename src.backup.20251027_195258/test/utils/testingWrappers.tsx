import React, { type FC, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';

import { store } from '@/store';
import { AppProvider } from '@/contexts/AppContextSupabase';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/design-system';

const defaultClerkProps = {
  user: {
    id: 'test-user-id',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  },
  isLoaded: true,
  isSignedIn: true,
};

export const AllProviders: FC<{ children?: ReactNode }> = ({ children }) => (
  <ClerkProvider publishableKey="pk_test_dummy" {...defaultClerkProps}>
    <BrowserRouter>
      <Provider store={store}>
        <PreferencesProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppProvider>
                <NotificationProvider>
                  <LayoutProvider>{children}</LayoutProvider>
                </NotificationProvider>
              </AppProvider>
            </ToastProvider>
          </ThemeProvider>
        </PreferencesProvider>
      </Provider>
    </BrowserRouter>
  </ClerkProvider>
);
