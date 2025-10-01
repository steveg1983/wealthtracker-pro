/**
 * PROPER Test Utilities
 * Real test setup with minimal mocking - only external dependencies
 * 
 * PRINCIPLE: Test real code, not mocks
 */

import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { AppProvider } from '../../contexts/AppContextSupabase';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { BudgetProvider } from '../../contexts/BudgetContext';
import { GoalProvider } from '../../contexts/GoalContext';
import { CategoryProvider } from '../../contexts/CategoryContext';
import { AccountProvider } from '../../contexts/AccountContext';
import { TransactionProvider } from '../../contexts/TransactionContext';

// Only mock what MUST be mocked - external dependencies
// Mock Clerk (external auth service)
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ 
    user: { 
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User'
    } 
  }),
  useAuth: () => ({ 
    isSignedIn: true,
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    getToken: () => Promise.resolve('test-token')
  }),
  ClerkProvider: ({ children }: any) => <>{children}</>,
  SignIn: () => <div>Sign In</div>,
  SignUp: () => <div>Sign Up</div>,
  UserButton: () => <div>User Button</div>,
}));

// Mock Supabase (external database)
const mockSupabaseClient = {
  from: (table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb)),
  }),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  storage: {
    from: (bucket: string) => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.url/file' } }),
    }),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

// Mock localStorage (browser API)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for external API calls only
const originalFetch = global.fetch;
global.fetch = vi.fn((url: string, ...args) => {
  // Only mock external API calls, not internal ones
  if (typeof url === 'string' && (
    url.includes('api.exchangerate-api.com') ||
    url.includes('yahoo-finance') ||
    url.includes('alpha-vantage') ||
    url.includes('finnhub.io')
  )) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ rates: { USD: 1, EUR: 0.85, GBP: 0.73 } }),
      text: () => Promise.resolve(''),
      status: 200,
    } as Response);
  }
  // Let internal calls go through
  return originalFetch(url, ...args);
});

// Test data factory for consistent test data
export const createTestData = () => ({
  accounts: [
    {
      id: 'test-acc-1',
      name: 'Test Checking',
      type: 'checking' as const,
      balance: 1000,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'test-acc-2',
      name: 'Test Savings',
      type: 'savings' as const,
      balance: 5000,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  categories: [
    {
      id: 'cat-expense',
      name: 'Expense',
      type: 'expense' as const,
      level: 'type' as const,
      parentId: null,
    },
    {
      id: 'cat-income',
      name: 'Income',
      type: 'income' as const,
      level: 'type' as const,
      parentId: null,
    },
    {
      id: 'cat-food',
      name: 'Food',
      type: 'expense' as const,
      level: 'sub' as const,
      parentId: 'cat-expense',
    },
    {
      id: 'cat-salary',
      name: 'Salary',
      type: 'income' as const,
      level: 'sub' as const,
      parentId: 'cat-income',
    },
  ],
  transactions: [
    {
      id: 'test-trans-1',
      accountId: 'test-acc-1',
      amount: -50,
      description: 'Grocery Store',
      date: new Date('2024-01-15'),
      category: 'cat-food',
      type: 'expense' as const,
    },
    {
      id: 'test-trans-2',
      accountId: 'test-acc-1',
      amount: 3000,
      description: 'Monthly Salary',
      date: new Date('2024-01-01'),
      category: 'cat-salary',
      type: 'income' as const,
    },
  ],
  budgets: [
    {
      id: 'test-budget-1',
      category: 'cat-food',
      amount: 500,
      period: 'monthly' as const,
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  ],
  goals: [
    {
      id: 'test-goal-1',
      name: 'Emergency Fund',
      type: 'savings' as const,
      targetAmount: 10000,
      currentAmount: 2000,
      targetDate: new Date('2024-12-31'),
      isActive: true,
    },
  ],
});

// Import ClerkProvider for auth context
import { ClerkProvider } from '@clerk/clerk-react';

// REAL Provider wrapper with all contexts
interface TestProviderProps {
  children: React.ReactNode;
  initialData?: ReturnType<typeof createTestData>;
}

export function TestProvider({ children, initialData }: TestProviderProps) {
  // Use real providers with test data
  // ClerkProvider needs a publishableKey
  const testClerkKey = 'pk_test_fake_key_for_testing';
  
  return (
    <ClerkProvider publishableKey={testClerkKey}>
      <AppProvider>
        <ToastProvider>
          <NotificationProvider>
            <NavigationProvider>
              <AccountProvider>
                <CategoryProvider>
                  <TransactionProvider>
                    <BudgetProvider>
                      <GoalProvider>
                        {children}
                      </GoalProvider>
                    </BudgetProvider>
                  </TransactionProvider>
                </CategoryProvider>
              </AccountProvider>
            </NavigationProvider>
          </NotificationProvider>
        </ToastProvider>
      </AppProvider>
    </ClerkProvider>
  );
}

// Custom render function that includes all providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialData?: ReturnType<typeof createTestData> }
) {
  const { initialData, ...renderOptions } = options || {};
  
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <TestProvider initialData={initialData}>
        {children}
      </TestProvider>
    ),
    ...renderOptions,
  });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Export test utilities
export {
  mockSupabaseClient,
};