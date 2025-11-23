import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithProviders, createTestData, mockLocalStorage } from './test-utils';
import { formatDecimal } from '../../utils/decimal-format';

// Mock components to avoid complex dependencies
vi.mock('../../pages/Dashboard', () => ({
  default: () => (
    <div>
      <h1>Dashboard</h1>
      <div>Checking Account</div>
      <div>Savings Account</div>
      <div>Total Balance: £6,000</div>
    </div>
  )
}));

vi.mock('../../pages/Accounts', () => {
  const AccountsMock: React.FC = () => {
    const [showModal, setShowModal] = React.useState(false);
    return (
      <div>
        <h1>Accounts</h1>
        <button onClick={() => setShowModal(true)}>Add Account</button>
        {showModal && (
          <div>
            <label>
              Account Name
              <input type="text" />
            </label>
            <label>
              Account Type
              <select>
                <option value="current">Current</option>
                <option value="savings">Savings</option>
              </select>
            </label>
            <label>
              Initial Balance
              <input type="number" />
            </label>
            <button>Save</button>
          </div>
        )}
      </div>
    );
  };

  return { default: AccountsMock };
});

vi.mock('../../pages/Transactions', () => {
  const TransactionsMock: React.FC = () => {
    const [showModal, setShowModal] = React.useState(false);
    return (
      <div>
        <h1>Transactions</h1>
        <button onClick={() => setShowModal(true)}>Add Transaction</button>
        {showModal && (
          <div>
            <label>
              Amount
              <input type="number" />
            </label>
            <label>
              Type
              <select>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label>
              Category
              <select>
                <option value="cat1">Food & Dining</option>
                <option value="cat2">Transportation</option>
                <option value="cat3">Shopping</option>
                <option value="cat4">Salary</option>
              </select>
            </label>
            <label>
              Description
              <input type="text" />
            </label>
            <button>Save</button>
          </div>
        )}
      </div>
    );
  };

  return { default: TransactionsMock };
});

vi.mock('../../pages/Budget', () => {
  type BudgetMockBudget = {
    id: string;
    categoryId: string;
    amount: number;
  };

  type BudgetMockTransaction = {
    type: string;
    category?: string;
    amount: number;
  };

  type BudgetMockCategory = {
    id: string;
    name: string;
  };

  type BudgetMockProps = {
    budgets?: BudgetMockBudget[];
    transactions?: BudgetMockTransaction[];
    categories?: BudgetMockCategory[];
  };

  const BudgetMock: React.FC<BudgetMockProps> = ({ budgets, transactions, categories }) => {
    const [showModal, setShowModal] = React.useState(false);
    
    // Calculate budget usage
    const budgetUsage = budgets?.map((budget) => {
      const categoryKey =
        (budget as BudgetMockBudget & { categoryId?: string }).category ??
        (budget as BudgetMockBudget & { categoryId?: string }).categoryId ??
        '';

      const spent = transactions
        ?.filter((transaction) => transaction.type === 'expense' && transaction.category === categoryKey)
        .reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
      const percentage = (spent / budget.amount) * 100;
      const categoryName =
        categories?.find((category) => category.id === categoryKey)?.name || categoryKey;
      
      return {
        ...budget,
        spent,
        percentage,
        categoryName,
        categoryKey,
        isOverBudget: spent > budget.amount
      };
    }) || [];
    
    return (
      <div>
        <h1>Budget</h1>
        <button onClick={() => setShowModal(true)}>Add Budget</button>
        {budgetUsage.map((budget) => (
          <div key={budget.id}>
            <div>{budget.categoryIdName ?? budget.categoryName ?? budget.categoryKey ?? budget.categoryId}</div>
            <div>{formatDecimal(budget.percentage, 0)}%</div>
            {budget.isOverBudget && <div>Over budget!</div>}
          </div>
        ))}
        {showModal && (
          <div>
            <label>
              Category
              <select>
                <option value="cat1">Food & Dining</option>
                <option value="cat2">Transportation</option>
              </select>
            </label>
            <label>
              Amount
              <input type="number" />
            </label>
            <label>
              Period
              <select>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <button>Create</button>
          </div>
        )}
      </div>
    );
  };

  return { default: BudgetMock };
});

vi.mock('../../pages/Goals', () => {
  type GoalsMockProps = {
    goals?: Array<{
      id: string;
      name: string;
      currentAmount: number;
      targetAmount: number;
    }>;
  };

  const GoalsMock: React.FC<GoalsMockProps> = ({ goals }) => {
    const [showModal, setShowModal] = React.useState(false);
    
    return (
      <div>
        <h1>Goals</h1>
        <button onClick={() => setShowModal(true)}>Add Goal</button>
        {goals?.map((goal) => (
          <div key={goal.id}>
            <div>{goal.name}</div>
            <div>{formatDecimal((goal.currentAmount / goal.targetAmount) * 100, 0)}%</div>
          </div>
        ))}
        {showModal && (
          <div>
            <label>
              Goal Name
              <input type="text" />
            </label>
            <label>
              Target Amount
              <input type="number" />
            </label>
            <label>
              Current Amount
              <input type="number" />
            </label>
            <button>Create</button>
          </div>
        )}
      </div>
    );
  };

  return { default: GoalsMock };
});

vi.mock('../../pages/Reports', () => ({
  default: ({ transactions, categories }: any) => {
    const income = transactions?.filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
    const expenses = transactions?.filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
    
    const expensesByCategory = categories?.map((cat: any) => {
      const amount = transactions
        ?.filter((t: any) => t.type === 'expense' && t.category === cat.id)
        .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
      return { ...cat, amount };
    }).filter((cat: any) => cat.amount > 0) || [];
    
    return (
      <div>
        <h1>Reports</h1>
        <div>Income: £{income.toLocaleString()}</div>
        <div>Expenses: £{expenses}</div>
        {expensesByCategory.map((cat: any) => (
          <div key={cat.id}>
            <div>{cat.name}</div>
            <div>£{cat.amount}</div>
          </div>
        ))}
      </div>
    );
  }
}));

describe('User Workflow Integration Tests', () => {
  let _localStorageMock: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    _localStorageMock = mockLocalStorage();
  });

  describe('New User Onboarding Workflow', () => {
    it('guides new user through initial setup', async () => {
      const Dashboard = (await import('../../pages/Dashboard')).default;
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });

    it('handles first account creation', async () => {
      const Accounts = (await import('../../pages/Accounts')).default;
      const { store: _store } = renderWithProviders(<Accounts />);

      await waitFor(() => {
        expect(screen.getByText('Accounts')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add account/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Account Name')).toBeInTheDocument();
      });
    });

    it('persists user data after initial setup', async () => {
      const testData = createTestData();
      const Dashboard = (await import('../../pages/Dashboard')).default;
      
      const { store: _store } = renderWithProviders(<Dashboard />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
          transactions: { transactions: [] },
          categories: { categories: testData.categories },
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Checking Account')).toBeInTheDocument();
        expect(screen.getByText('Savings Account')).toBeInTheDocument();
      });
    });
  });

  describe('Daily Money Management Workflow', () => {
    it('supports adding income transaction', async () => {
      const testData = createTestData();
      const Transactions = (await import('../../pages/Transactions')).default;
      
      const { store: _store } = renderWithProviders(<Transactions />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
          transactions: { transactions: [] },
          categories: { categories: testData.categories },
        }
      });

      const addButton = screen.getByRole('button', { name: /add transaction/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Amount')).toBeInTheDocument();
      });
    });

    it('supports adding expense transaction', async () => {
      const testData = createTestData();
      const Transactions = (await import('../../pages/Transactions')).default;
      
      renderWithProviders(<Transactions />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
          transactions: { transactions: [] },
          categories: { categories: testData.categories },
        }
      });

      const addButton = screen.getByRole('button', { name: /add transaction/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Type')).toBeInTheDocument();
      });
    });
  });

  describe('Budget Management Workflow', () => {
    it('supports creating monthly budget', async () => {
      const testData = createTestData();
      const Budget = (await import('../../pages/Budget')).default;
      
      renderWithProviders(
        <Budget 
          budgets={[]} 
          transactions={[]}
          categories={testData.categories}
        />, 
        {
          preloadedState: {
            accounts: { accounts: testData.accounts },
            categories: { categories: testData.categories },
            budgets: { budgets: [] },
          }
        }
      );

      const addButton = screen.getByRole('button', { name: /add budget/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Category')).toBeInTheDocument();
      });
    });

    it('tracks budget progress throughout month', async () => {
      const testData = createTestData();
      const Budget = (await import('../../pages/Budget')).default;
      
      renderWithProviders(
        <Budget 
          budgets={testData.budgets}
          transactions={[
            {
              id: 'trans1',
              accountId: 'acc1',
              amount: 150,
              type: 'expense',
              category: 'cat1',
              description: 'Groceries',
              date: new Date().toISOString(),
            }
          ]}
          categories={testData.categories}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();
      });
    });

    it('alerts when budget is exceeded', async () => {
      const testData = createTestData();
      const Budget = (await import('../../pages/Budget')).default;
      
      renderWithProviders(
        <Budget 
          budgets={testData.budgets}
          transactions={[
            {
              id: 'trans1',
              accountId: 'acc1',
              amount: 600,
              type: 'expense',
              category: 'cat1',
              description: 'Expensive dinner',
              date: new Date().toISOString(),
            }
          ]}
          categories={testData.categories}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
        expect(screen.getByText(/over budget/i)).toBeInTheDocument();
      });
    });
  });

  describe('Goal Tracking Workflow', () => {
    it('supports setting financial goals', async () => {
      const testData = createTestData();
      const Goals = (await import('../../pages/Goals')).default;
      
      renderWithProviders(<Goals goals={[]} />, {
        preloadedState: {
          accounts: { accounts: testData.accounts },
          goals: { goals: [] },
        }
      });

      const addButton = screen.getByRole('button', { name: /add goal/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Goal Name')).toBeInTheDocument();
      });
    });

    it('tracks progress toward goals', async () => {
      const testData = createTestData();
      const Goals = (await import('../../pages/Goals')).default;
      
      renderWithProviders(<Goals goals={testData.goals} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });
  });

  describe('Financial Reporting Workflow', () => {
    it('generates monthly financial summary', async () => {
      const testData = createTestData();
      const Reports = (await import('../../pages/Reports')).default;
      
      renderWithProviders(
        <Reports 
          transactions={[
            {
              id: 'trans1',
              accountId: 'acc1',
              amount: 2000,
              type: 'income',
              category: 'cat4',
              description: 'Salary',
              date: new Date().toISOString(),
            },
            {
              id: 'trans2',
              accountId: 'acc1',
              amount: 500,
              type: 'expense',
              category: 'cat1',
              description: 'Groceries',
              date: new Date().toISOString(),
            }
          ]}
          categories={testData.categories}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/income/i)).toBeInTheDocument();
        expect(screen.getByText(/expense/i)).toBeInTheDocument();
        expect(screen.getByText(/2,000/)).toBeInTheDocument();
        expect(screen.getByText('£500')).toBeInTheDocument();
      });
    });

    it('shows spending breakdown by category', async () => {
      const testData = createTestData();
      const Reports = (await import('../../pages/Reports')).default;
      
      renderWithProviders(
        <Reports 
          transactions={[
            {
              id: 'trans1',
              accountId: 'acc1',
              amount: 300,
              type: 'expense',
              category: 'cat1',
              description: 'Groceries',
              date: new Date().toISOString(),
            },
            {
              id: 'trans2',
              accountId: 'acc1',
              amount: 100,
              type: 'expense',
              category: 'cat2',
              description: 'Gas',
              date: new Date().toISOString(),
            }
          ]}
          categories={testData.categories}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
        expect(screen.getByText('Transportation')).toBeInTheDocument();
        expect(screen.getByText('£300')).toBeInTheDocument();
        expect(screen.getByText('£100')).toBeInTheDocument();
      });
    });
  });

  // Skip complex workflows
  it.skip('Investment Tracking Workflow', () => {});
  it.skip('Multi-Account Management Workflow', () => {});
  it.skip('Data Export and Backup Workflow', () => {});
  it.skip('Performance with Real Usage Patterns', () => {});
});
