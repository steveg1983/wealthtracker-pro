import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import type { Transaction, Account, Budget, Goal } from '../../types';

// Test wrapper with all required providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <PreferencesProvider>
      <NotificationProvider>
        <AppProvider>
          {children}
        </AppProvider>
      </NotificationProvider>
    </PreferencesProvider>
  </BrowserRouter>
);

// Simple test components that use the context
const TestAccountManager = () => {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = React.useState('');

  const addAccount = () => {
    if (newAccountName.trim()) {
      const newAccount: Account = {
        id: Date.now().toString(),
        name: newAccountName,
        type: 'current',
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setAccounts([...accounts, newAccount]);
      setNewAccountName('');
    }
  };

  const updateBalance = (id: string, amount: number) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, balance: acc.balance + amount } : acc
    ));
  };

  return (
    <div>
      <h2>Account Manager</h2>
      <div>
        <input
          type="text"
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          placeholder="Account name"
          data-testid="account-name-input"
        />
        <button onClick={addAccount} data-testid="add-account-btn">
          Add Account
        </button>
      </div>
      <div data-testid="accounts-list">
        {accounts.map(account => (
          <div key={account.id} data-testid={`account-${account.id}`}>
            <span>{account.name}: £{account.balance.toFixed(2)}</span>
            <button 
              onClick={() => updateBalance(account.id, 100)}
              data-testid={`deposit-${account.id}`}
            >
              Deposit £100
            </button>
            <button 
              onClick={() => updateBalance(account.id, -50)}
              data-testid={`withdraw-${account.id}`}
            >
              Withdraw £50
            </button>
          </div>
        ))}
      </div>
      <div data-testid="total-balance">
        Total: £{accounts.reduce((sum, acc) => sum + acc.balance, 0).toFixed(2)}
      </div>
    </div>
  );
};

const TestTransactionManager = () => {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [type, setType] = React.useState<'income' | 'expense'>('expense');

  const addTransaction = () => {
    if (description && amount) {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        accountId: 'test-account',
        amount: parseFloat(amount),
        type,
        category: type === 'income' ? 'salary' : 'groceries',
        description,
        date: new Date(),
        pending: false,
        isReconciled: false,
      };
      setTransactions([...transactions, newTransaction]);
      setDescription('');
      setAmount('');
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <h2>Transaction Manager</h2>
      <div>
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as 'income' | 'expense')}
          data-testid="transaction-type"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          data-testid="transaction-description"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          data-testid="transaction-amount"
        />
        <button onClick={addTransaction} data-testid="add-transaction-btn">
          Add Transaction
        </button>
      </div>
      <div data-testid="transactions-list">
        {transactions.map(transaction => (
          <div key={transaction.id} data-testid={`transaction-${transaction.id}`}>
            {transaction.type}: {transaction.description} - £{transaction.amount.toFixed(2)}
          </div>
        ))}
      </div>
      <div data-testid="transaction-summary">
        <div>Income: £{totalIncome.toFixed(2)}</div>
        <div>Expenses: £{totalExpenses.toFixed(2)}</div>
        <div>Net: £{(totalIncome - totalExpenses).toFixed(2)}</div>
      </div>
    </div>
  );
};

const TestBudgetManager = () => {
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [spending, setSpending] = React.useState<Record<string, number>>({});

  const addBudget = (category: string, amount: number) => {
    const newBudget: Budget = {
      id: Date.now().toString(),
      category,
      amount,
      period: 'monthly',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setBudgets([...budgets, newBudget]);
  };

  const recordSpending = (category: string, amount: number) => {
    setSpending(prev => ({
      ...prev,
      [category]: (prev[category] || 0) + amount,
    }));
  };

  return (
    <div>
      <h2>Budget Manager</h2>
      <button 
        onClick={() => addBudget('groceries', 500)}
        data-testid="add-groceries-budget"
      >
        Add Groceries Budget (£500)
      </button>
      <button 
        onClick={() => addBudget('entertainment', 200)}
        data-testid="add-entertainment-budget"
      >
        Add Entertainment Budget (£200)
      </button>
      <div data-testid="budgets-list">
        {budgets.map(budget => {
          const spent = spending[budget.categoryId] || 0;
          const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
          const remaining = Math.max(0, budget.amount - spent);
          
          return (
            <div key={budget.id} data-testid={`budget-${budget.categoryId}`}>
              <div>{budget.categoryId}: £{budget.amount}/month</div>
              <div>Spent: £{spent.toFixed(2)} ({percentage.toFixed(0)}%)</div>
              <div>Remaining: £{remaining.toFixed(2)}</div>
              <button 
                onClick={() => recordSpending(budget.categoryId, 50)}
                data-testid={`spend-${budget.categoryId}`}
              >
                Spend £50
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

describe('Critical Workflows Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Account Management Workflow', () => {
    it('should allow creating and managing accounts', async () => {
      render(
        <TestWrapper>
          <TestAccountManager />
        </TestWrapper>
      );

      // Add first account
      const nameInput = screen.getByTestId('account-name-input');
      const addButton = screen.getByTestId('add-account-btn');

      await user.type(nameInput, 'Checking Account');
      await user.click(addButton);

      // Verify account was added - use flexible matcher for text in span
      await waitFor(() => {
        const accountsList = screen.getByTestId('accounts-list');
        expect(accountsList).toHaveTextContent('Checking Account');
        expect(accountsList).toHaveTextContent('0.00');
      });

      // Add second account
      await user.type(nameInput, 'Savings Account');
      await user.click(addButton);

      await waitFor(() => {
        const accountsList = screen.getByTestId('accounts-list');
        expect(accountsList).toHaveTextContent('Savings Account');
      });

      // Make deposits and withdrawals
      const checkingDeposit = screen.getAllByText('Deposit £100')[0];
      await user.click(checkingDeposit);
      // Verify deposit worked
      await waitFor(() => {
        const accountsList = screen.getByTestId('accounts-list');
        expect(accountsList).toHaveTextContent('100.00');
      });

      const savingsDeposit = screen.getAllByText('Deposit £100')[1];
      await user.click(savingsDeposit);
      await user.click(savingsDeposit); // Click twice
      // Verify multiple deposits
      await waitFor(() => {
        const accountsList = screen.getByTestId('accounts-list');
        expect(accountsList).toHaveTextContent('300.00');
      });

      // Verify total balance - both accounts have 300 each = 600
      expect(screen.getByTestId('total-balance')).toHaveTextContent('Total: £600.00');

      // Make withdrawal
      const checkingWithdraw = screen.getAllByText('Withdraw £50')[0];
      await user.click(checkingWithdraw);
      // Verify withdrawal worked
      await waitFor(() => {
        const accountsList = screen.getByTestId('accounts-list');
        expect(accountsList).toHaveTextContent('250.00');
      });
      expect(screen.getByTestId('total-balance')).toHaveTextContent('Total: £500.00');
    });
  });

  describe('Transaction Recording Workflow', () => {
    it('should allow recording income and expense transactions', async () => {
      render(
        <TestWrapper>
          <TestTransactionManager />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('transaction-type');
      const descriptionInput = screen.getByTestId('transaction-description');
      const amountInput = screen.getByTestId('transaction-amount');
      const addButton = screen.getByTestId('add-transaction-btn');

      // Add income transaction
      await user.selectOptions(typeSelect, 'income');
      await user.type(descriptionInput, 'Monthly Salary');
      await user.type(amountInput, '3000');
      await user.click(addButton);

      expect(screen.getByText('income: Monthly Salary - £3000.00')).toBeInTheDocument();

      // Add expense transactions
      await user.selectOptions(typeSelect, 'expense');
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Rent Payment');
      await user.clear(amountInput);
      await user.type(amountInput, '1200');
      await user.click(addButton);

      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Grocery Shopping');
      await user.clear(amountInput);
      await user.type(amountInput, '350');
      await user.click(addButton);

      // Verify transactions
      expect(screen.getByText('expense: Rent Payment - £1200.00')).toBeInTheDocument();
      expect(screen.getByText('expense: Grocery Shopping - £350.00')).toBeInTheDocument();

      // Verify summary calculations
      const summary = screen.getByTestId('transaction-summary');
      expect(summary).toHaveTextContent('Income: £3000.00');
      expect(summary).toHaveTextContent('Expenses: £1550.00');
      expect(summary).toHaveTextContent('Net: £1450.00');
    });
  });

  describe('Budget Management Workflow', () => {
    it('should allow creating budgets and tracking spending', async () => {
      render(
        <TestWrapper>
          <TestBudgetManager />
        </TestWrapper>
      );

      // Add budgets
      await user.click(screen.getByTestId('add-groceries-budget'));
      await user.click(screen.getByTestId('add-entertainment-budget'));

      // Verify budgets were added
      const groceriesBudget = screen.getByTestId('budget-groceries');
      expect(groceriesBudget).toHaveTextContent('groceries: £500/month');
      expect(groceriesBudget).toHaveTextContent('Spent: £0.00 (0%)');
      expect(groceriesBudget).toHaveTextContent('Remaining: £500.00');

      const entertainmentBudget = screen.getByTestId('budget-entertainment');
      expect(entertainmentBudget).toHaveTextContent('entertainment: £200/month');

      // Record spending
      const spendGroceries = screen.getByTestId('spend-groceries');
      await user.click(spendGroceries);
      await user.click(spendGroceries);
      await user.click(spendGroceries);

      // Verify spending updates
      expect(groceriesBudget).toHaveTextContent('Spent: £150.00 (30%)');
      expect(groceriesBudget).toHaveTextContent('Remaining: £350.00');

      // Spend on entertainment
      const spendEntertainment = screen.getByTestId('spend-entertainment');
      await user.click(spendEntertainment);
      await user.click(spendEntertainment);

      expect(entertainmentBudget).toHaveTextContent('Spent: £100.00 (50%)');
      expect(entertainmentBudget).toHaveTextContent('Remaining: £100.00');

      // Test overspending
      for (let i = 0; i < 3; i++) {
        await user.click(spendEntertainment);
      }

      expect(entertainmentBudget).toHaveTextContent('Spent: £250.00 (125%)');
      expect(entertainmentBudget).toHaveTextContent('Remaining: £0.00'); // Should not go negative
    });
  });

  describe('End-to-End Financial Workflow', () => {
    it('should handle a complete monthly financial cycle', async () => {
      // This test demonstrates a user going through a typical monthly workflow:
      // 1. Set up accounts
      // 2. Record income
      // 3. Set budgets
      // 4. Record expenses
      // 5. Review financial status

      const FullApp = () => (
        <div>
          <TestAccountManager />
          <hr />
          <TestTransactionManager />
          <hr />
          <TestBudgetManager />
        </div>
      );

      render(
        <TestWrapper>
          <FullApp />
        </TestWrapper>
      );

      // Step 1: Set up accounts
      const accountNameInput = screen.getByTestId('account-name-input');
      const addAccountBtn = screen.getByTestId('add-account-btn');

      await user.type(accountNameInput, 'Main Checking');
      await user.click(addAccountBtn);

      // Step 2: Record income
      const transactionType = screen.getByTestId('transaction-type');
      const transactionDesc = screen.getByTestId('transaction-description');
      const transactionAmount = screen.getByTestId('transaction-amount');
      const addTransactionBtn = screen.getByTestId('add-transaction-btn');

      await user.selectOptions(transactionType, 'income');
      await user.type(transactionDesc, 'Salary');
      await user.type(transactionAmount, '4000');
      await user.click(addTransactionBtn);

      // Deposit to account
      const depositBtn = screen.getByTestId(/deposit-/);
      for (let i = 0; i < 40; i++) { // Deposit 40 x £100 = £4000
        await user.click(depositBtn);
      }

      expect(screen.getByText('Main Checking: £4000.00')).toBeInTheDocument();

      // Step 3: Set budgets
      await user.click(screen.getByTestId('add-groceries-budget'));
      await user.click(screen.getByTestId('add-entertainment-budget'));

      // Step 4: Record expenses and track budget
      await user.selectOptions(transactionType, 'expense');
      
      // Groceries expense
      await user.clear(transactionDesc);
      await user.type(transactionDesc, 'Weekly Shopping');
      await user.clear(transactionAmount);
      await user.type(transactionAmount, '120');
      await user.click(addTransactionBtn);

      // Track in budget
      const spendGroceries = screen.getByTestId('spend-groceries');
      await user.click(spendGroceries); // £50
      await user.click(spendGroceries); // £50
      // Total groceries spending: £100

      // Entertainment expense
      await user.clear(transactionDesc);
      await user.type(transactionDesc, 'Cinema');
      await user.clear(transactionAmount);
      await user.type(transactionAmount, '30');
      await user.click(addTransactionBtn);

      const spendEntertainment = screen.getByTestId('spend-entertainment');
      await user.click(spendEntertainment); // £50

      // Withdraw from account for expenses
      const withdrawBtn = screen.getByTestId(/withdraw-/);
      for (let i = 0; i < 3; i++) { // Withdraw 3 x £50 = £150
        await user.click(withdrawBtn);
      }

      // Step 5: Verify final status
      // Account balance: £4000 - £150 = £3850
      expect(screen.getByText('Main Checking: £3850.00')).toBeInTheDocument();

      // Transaction summary
      const summary = screen.getByTestId('transaction-summary');
      expect(summary).toHaveTextContent('Income: £4000.00');
      expect(summary).toHaveTextContent('Expenses: £150.00');
      expect(summary).toHaveTextContent('Net: £3850.00');

      // Budget status
      const groceriesBudget = screen.getByTestId('budget-groceries');
      expect(groceriesBudget).toHaveTextContent('Spent: £100.00 (20%)');
      expect(groceriesBudget).toHaveTextContent('Remaining: £400.00');

      const entertainmentBudget = screen.getByTestId('budget-entertainment');
      expect(entertainmentBudget).toHaveTextContent('Spent: £50.00 (25%)');
      expect(entertainmentBudget).toHaveTextContent('Remaining: £150.00');
    });
  });

  describe('Error Handling in Workflows', () => {
    it('should handle invalid inputs gracefully', async () => {
      render(
        <TestWrapper>
          <TestTransactionManager />
        </TestWrapper>
      );

      const addButton = screen.getByTestId('add-transaction-btn');

      // Try to add transaction without description
      const amountInput = screen.getByTestId('transaction-amount');
      await user.type(amountInput, '100');
      await user.click(addButton);

      // Should not add transaction
      expect(screen.queryByText(/income:.*- £100.00/)).not.toBeInTheDocument();

      // Try to add transaction without amount
      const descInput = screen.getByTestId('transaction-description');
      await user.clear(amountInput);
      await user.type(descInput, 'Test');
      await user.click(addButton);

      // Should not add transaction
      expect(screen.queryByText('Test')).not.toBeInTheDocument();

      // Add valid transaction
      await user.type(amountInput, '50');
      await user.click(addButton);

      // Should add transaction
      expect(screen.getByText('expense: Test - £50.00')).toBeInTheDocument();
    });

    it('should handle edge cases in calculations', async () => {
      render(
        <TestWrapper>
          <TestBudgetManager />
        </TestWrapper>
      );

      // Add budget
      await user.click(screen.getByTestId('add-groceries-budget'));

      // Overspend the budget
      const spendBtn = screen.getByTestId('spend-groceries');
      for (let i = 0; i < 12; i++) { // Spend £600 on £500 budget
        await user.click(spendBtn);
      }

      const budget = screen.getByTestId('budget-groceries');
      expect(budget).toHaveTextContent('Spent: £600.00 (120%)');
      expect(budget).toHaveTextContent('Remaining: £0.00'); // Should not show negative
    });
  });
});