import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

interface Account {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  holdings?: any[];
  notes?: string;
}

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string; // This will now store the detail category ID
  categoryName?: string; // For backward compatibility and display
  accountId: string;
  tags?: string[];
  notes?: string;
  cleared?: boolean;
  isSplit?: boolean;
  originalTransactionId?: string;
  isRecurring?: boolean;
  recurringId?: string;
  reconciledWith?: string;
  reconciledDate?: Date;
  reconciledNotes?: string;
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: "monthly" | "yearly";
  isActive?: boolean;
  spent?: number;
}

interface RecurringTransaction {
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  lastProcessed?: string;
}

interface Goal {
  id: string;
  name: string;
  type: 'savings' | 'debt-payoff' | 'investment' | 'custom';
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  description?: string;
  linkedAccountIds?: string[];
  isActive: boolean;
  createdAt: Date;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail'; // Level in hierarchy
  parentId?: string; // ID of parent category
  color?: string;
  icon?: string;
  isSystem?: boolean; // System categories cannot be deleted
}

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  goals: Goal[];
  categories: Category[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, goal: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
  loadTestData: () => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  deleteRecurringTransaction: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string, newCategoryId?: string) => void;
  getCategoriesForTransactions: (transactionIds: string[]) => Record<string, number>;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  getCategoryPath: (categoryId: string) => string;
  getCategoryByPath: (detailCategoryId: string) => Category | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default categories with hierarchy
const defaultCategories: Category[] = [
  // Top-level type categories
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  
  // Income sub-categories
  { id: 'sub-employment', name: 'Employment', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
  { id: 'sub-investment', name: 'Investment', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
  { id: 'sub-other-income', name: 'Other Income', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
  
  // Income detail categories
  { id: 'cat-1', name: 'Salary', type: 'income', level: 'detail', parentId: 'sub-employment', isSystem: true },
  { id: 'cat-2', name: 'Freelance', type: 'income', level: 'detail', parentId: 'sub-employment', isSystem: true },
  { id: 'cat-3', name: 'Bonus', type: 'income', level: 'detail', parentId: 'sub-employment', isSystem: true },
  { id: 'cat-4', name: 'Dividends', type: 'income', level: 'detail', parentId: 'sub-investment', isSystem: true },
  { id: 'cat-5', name: 'Interest', type: 'income', level: 'detail', parentId: 'sub-investment', isSystem: true },
  { id: 'cat-6', name: 'Capital Gains', type: 'income', level: 'detail', parentId: 'sub-investment', isSystem: true },
  
  // Expense sub-categories
  { id: 'sub-food', name: 'Food & Dining', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-transport', name: 'Transportation', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-housing', name: 'Housing', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-utilities', name: 'Utilities', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-entertainment', name: 'Entertainment', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-shopping', name: 'Shopping', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-healthcare', name: 'Healthcare', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-financial', name: 'Financial', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  { id: 'sub-other-expense', name: 'Other Expenses', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
  
  // Expense detail categories
  { id: 'cat-7', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food', isSystem: true },
  { id: 'cat-8', name: 'Restaurants', type: 'expense', level: 'detail', parentId: 'sub-food', isSystem: true },
  { id: 'cat-9', name: 'Takeout', type: 'expense', level: 'detail', parentId: 'sub-food', isSystem: true },
  { id: 'cat-10', name: 'Public Transport', type: 'expense', level: 'detail', parentId: 'sub-transport', isSystem: true },
  { id: 'cat-11', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'sub-transport', isSystem: true },
  { id: 'cat-12', name: 'Car Maintenance', type: 'expense', level: 'detail', parentId: 'sub-transport', isSystem: true },
  { id: 'cat-13', name: 'Rent/Mortgage', type: 'expense', level: 'detail', parentId: 'sub-housing', isSystem: true },
  { id: 'cat-14', name: 'Home Maintenance', type: 'expense', level: 'detail', parentId: 'sub-housing', isSystem: true },
  { id: 'cat-15', name: 'Electricity', type: 'expense', level: 'detail', parentId: 'sub-utilities', isSystem: true },
  { id: 'cat-16', name: 'Gas', type: 'expense', level: 'detail', parentId: 'sub-utilities', isSystem: true },
  { id: 'cat-17', name: 'Water', type: 'expense', level: 'detail', parentId: 'sub-utilities', isSystem: true },
  { id: 'cat-18', name: 'Internet', type: 'expense', level: 'detail', parentId: 'sub-utilities', isSystem: true },
  { id: 'cat-19', name: 'Phone', type: 'expense', level: 'detail', parentId: 'sub-utilities', isSystem: true },
  { id: 'cat-20', name: 'Movies', type: 'expense', level: 'detail', parentId: 'sub-entertainment', isSystem: true },
  { id: 'cat-21', name: 'Subscriptions', type: 'expense', level: 'detail', parentId: 'sub-entertainment', isSystem: true },
  { id: 'cat-22', name: 'Clothing', type: 'expense', level: 'detail', parentId: 'sub-shopping', isSystem: true },
  { id: 'cat-23', name: 'Electronics', type: 'expense', level: 'detail', parentId: 'sub-shopping', isSystem: true },
  { id: 'cat-24', name: 'Doctor', type: 'expense', level: 'detail', parentId: 'sub-healthcare', isSystem: true },
  { id: 'cat-25', name: 'Pharmacy', type: 'expense', level: 'detail', parentId: 'sub-healthcare', isSystem: true },
  { id: 'cat-26', name: 'Insurance', type: 'expense', level: 'detail', parentId: 'sub-financial', isSystem: true },
  { id: 'cat-27', name: 'Taxes', type: 'expense', level: 'detail', parentId: 'sub-financial', isSystem: true },
  { id: 'cat-28', name: 'Bank Fees', type: 'expense', level: 'detail', parentId: 'sub-financial', isSystem: true },
  
  // Both type categories (for transfers)
  { id: 'cat-29', name: 'Transfer', type: 'both', level: 'detail', isSystem: true },
  { id: 'cat-30', name: 'Other', type: 'both', level: 'detail', isSystem: true },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('moneyTrackerData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.accounts) {
          setAccounts(parsedData.accounts.map((a: any) => ({
            ...a,
            lastUpdated: new Date(a.lastUpdated)
          })));
        }
        if (parsedData.transactions) {
          // Migrate transactions to use category IDs
          const migratedTransactions = parsedData.transactions.map((t: any) => {
            let categoryId = t.category;
            let categoryName = t.categoryName;
            
            // If category looks like a name (not an ID starting with 'cat-'), find the matching category
            if (t.category && !t.category.startsWith('cat-')) {
              // Try to find a detail category with this name
              const matchingCategory = defaultCategories.find(c => 
                c.level === 'detail' && c.name.toLowerCase() === t.category.toLowerCase()
              );
              
              if (matchingCategory) {
                categoryId = matchingCategory.id;
                categoryName = matchingCategory.name;
              } else {
                // Use 'Other' as fallback
                categoryId = 'cat-30';
                categoryName = t.category; // Keep original name for reference
              }
            }
            
            return {
              ...t,
              date: new Date(t.date),
              category: categoryId,
              categoryName: categoryName
            };
          });
          
          setTransactions(migratedTransactions);
        }
        if (parsedData.budgets) {
          setBudgets(parsedData.budgets.map((b: any) => ({
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
          })));
        }
        if (parsedData.recurringTransactions) setRecurringTransactions(parsedData.recurringTransactions);
        if (parsedData.goals) {
          setGoals(parsedData.goals.map((g: any) => ({
            ...g,
            targetDate: new Date(g.targetDate),
            createdAt: new Date(g.createdAt)
          })));
        }
        if (parsedData.categories) {
          // Merge saved categories with default ones (in case new defaults were added)
          const savedCategoryIds = parsedData.categories.map((c: any) => c.id);
          const newDefaultCategories = defaultCategories.filter(dc => !savedCategoryIds.includes(dc.id));
          setCategories([...parsedData.categories, ...newDefaultCategories]);
        }
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      accounts,
      transactions,
      budgets,
      recurringTransactions,
      goals,
      categories
    };
    localStorage.setItem('moneyTrackerData', JSON.stringify(dataToSave));
  }, [accounts, transactions, budgets, recurringTransactions, goals, categories]);

  // Account methods
  const addAccount = (account: Omit<Account, 'id'>) => {
    const newAccount = { ...account, id: Date.now().toString() };
    setAccounts([...accounts, newAccount]);
  };

  const updateAccount = (id: string, updatedAccount: Partial<Account>) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, ...updatedAccount } : acc
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
    // Also delete related transactions
    setTransactions(transactions.filter(t => t.accountId !== id));
  };

  // Transaction methods
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...transaction, id: Date.now().toString() };
    setTransactions([...transactions, newTransaction]);
    
    // Update account balance
    const account = accounts.find(acc => acc.id === transaction.accountId);
    if (account) {
      const balanceChange = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      updateAccount(account.id, { balance: account.balance + balanceChange });
    }
  };

  const updateTransaction = (id: string, updatedTransaction: Partial<Transaction>) => {
    const oldTransaction = transactions.find(t => t.id === id);
    if (!oldTransaction) return;

    // Update the transaction
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, ...updatedTransaction } : t
    ));

    // If amount or type changed, update account balance
    if (updatedTransaction.amount !== undefined || updatedTransaction.type !== undefined) {
      const account = accounts.find(acc => acc.id === oldTransaction.accountId);
      if (account) {
        // Reverse old transaction
        const oldBalanceChange = oldTransaction.type === 'income' ? oldTransaction.amount : -oldTransaction.amount;
        // Apply new transaction
        const newAmount = updatedTransaction.amount || oldTransaction.amount;
        const newType = updatedTransaction.type || oldTransaction.type;
        const newBalanceChange = newType === 'income' ? newAmount : -newAmount;
        
        updateAccount(account.id, { 
          balance: account.balance - oldBalanceChange + newBalanceChange 
        });
      }
    }
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    setTransactions(transactions.filter(t => t.id !== id));
    
    // Update account balance
    const account = accounts.find(acc => acc.id === transaction.accountId);
    if (account) {
      const balanceChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
      updateAccount(account.id, { balance: account.balance + balanceChange });
    }
  };

  // Budget methods
  const addBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget = { ...budget, id: Date.now().toString() };
    setBudgets([...budgets, newBudget]);
  };

  const updateBudget = (id: string, updatedBudget: Partial<Budget>) => {
    setBudgets(budgets.map(budget => 
      budget.id === id ? { ...budget, ...updatedBudget } : budget
    ));
  };

  const deleteBudget = (id: string) => {
    setBudgets(budgets.filter(budget => budget.id !== id));
  };

  // Goal methods
  const addGoal = (goal: Omit<Goal, 'id'>) => {
    const newGoal = { ...goal, id: Date.now().toString() };
    setGoals([...goals, newGoal]);
  };

  const updateGoal = (id: string, updatedGoal: Partial<Goal>) => {
    setGoals(goals.map(goal => 
      goal.id === id ? { ...goal, ...updatedGoal } : goal
    ));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(goal => goal.id !== id));
  };

  // Recurring transaction methods
  const addRecurringTransaction = (transaction: RecurringTransaction) => {
    const newTransaction = { ...transaction, id: Date.now().toString() };
    setRecurringTransactions([...recurringTransactions, newTransaction]);
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions(recurringTransactions.filter(t => t.id !== id));
  };

  // Category methods
  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory = { ...category, id: `cat-${Date.now()}` };
    setCategories([...categories, newCategory]);
  };

  const updateCategory = (id: string, updatedCategory: Partial<Category>) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, ...updatedCategory } : cat
    ));
  };

  const deleteCategory = (id: string, newCategoryId?: string) => {
    // Check if category is system category
    const category = categories.find(c => c.id === id);
    if (category?.isSystem) {
      throw new Error('Cannot delete system categories');
    }

    // Check if category has children
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      throw new Error('Cannot delete category with subcategories. Delete subcategories first.');
    }

    // If newCategoryId provided, update all transactions with the old category
    if (newCategoryId) {
      const updatedTransactions = transactions.map(t => 
        t.category === id ? { 
          ...t, 
          category: newCategoryId,
          categoryName: categories.find(c => c.id === newCategoryId)?.name || 'Other'
        } : t
      );
      setTransactions(updatedTransactions);
      
      // Update budgets as well (budgets still use category names for now)
      const newCategoryName = categories.find(c => c.id === newCategoryId)?.name || 'Other';
      const updatedBudgets = budgets.map(b => 
        b.category === category?.name ? { ...b, category: newCategoryName } : b
      );
      setBudgets(updatedBudgets);
    }

    setCategories(categories.filter(cat => cat.id !== id));
  };

  const getCategoriesForTransactions = (transactionIds: string[]): Record<string, number> => {
    const categoryCount: Record<string, number> = {};
    
    transactions
      .filter(t => transactionIds.includes(t.id))
      .forEach(t => {
        categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
      });
    
    return categoryCount;
  };

  // Helper functions for hierarchical categories
  const getSubCategories = (parentId: string): Category[] => {
    return categories.filter(cat => cat.parentId === parentId);
  };

  const getDetailCategories = (parentId: string): Category[] => {
    return categories.filter(cat => cat.parentId === parentId && cat.level === 'detail');
  };

  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    
    const path: string[] = [category.name];
    let currentCategory = category;
    
    while (currentCategory.parentId) {
      const parent = categories.find(c => c.id === currentCategory.parentId);
      if (!parent) break;
      path.unshift(parent.name);
      currentCategory = parent;
    }
    
    return path.join(' > ');
  };

  const getCategoryByPath = (detailCategoryId: string): Category | undefined => {
    return categories.find(c => c.id === detailCategoryId);
  };

  // Data management
  const clearAllData = () => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setRecurringTransactions([]);
    setGoals([]);
    setCategories(defaultCategories);
    localStorage.removeItem('moneyTrackerData');
  };

  const exportData = () => {
    return JSON.stringify({
      accounts,
      transactions,
      budgets,
      recurringTransactions,
      goals,
      categories,
      exportDate: new Date().toISOString()
    }, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.accounts) setAccounts(data.accounts);
      if (data.transactions) {
        setTransactions(data.transactions.map((t: any) => ({
          ...t,
          date: new Date(t.date)
        })));
      }
      if (data.budgets) setBudgets(data.budgets);
      if (data.recurringTransactions) setRecurringTransactions(data.recurringTransactions);
      if (data.goals) {
        setGoals(data.goals.map((g: any) => ({
          ...g,
          targetDate: new Date(g.targetDate),
          createdAt: new Date(g.createdAt)
        })));
      }
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  };

  // Helper function to generate random amount within range
  const randomAmount = (min: number, max: number): number => {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  };

  // Helper function to generate transactions over time
  const generateTransactionsOverTime = () => {
    const transactions: Transaction[] = [];
    let transactionId = 1000;
    const now = new Date();
    
    // Generate transactions for the past 12 months
    for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
      const currentDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Monthly salary - HSBC Current
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 1),
        description: 'Monthly Salary - Tech Corp Ltd',
        amount: 5500.00,
        type: 'income',
        category: 'Salary',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Freelance income - HSBC Current (every 2-3 months)
      if (monthsAgo % 3 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 15),
          description: 'Freelance Project - Web Development',
          amount: randomAmount(1000, 2500),
          type: 'income',
          category: 'Freelance',
          accountId: '1',
          cleared: true
        });
      }
      
      // Dividend income - Investment account (quarterly)
      if (monthsAgo % 3 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 5),
          description: 'Dividend Payment - AAPL',
          amount: randomAmount(100, 150),
          type: 'income',
          category: 'Investment Income',
          accountId: '13',
          cleared: true
        });
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 5),
          description: 'Dividend Payment - MSFT',
          amount: randomAmount(80, 120),
          type: 'income',
          category: 'Investment Income',
          accountId: '13',
          cleared: true
        });
      }
      
      // Interest income - Savings accounts
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 1),
        description: 'Interest Credit',
        amount: randomAmount(15, 25),
        type: 'income',
        category: 'Interest Income',
        accountId: '4',
        cleared: true
      });
      
      // Mortgage payment - HSBC Current
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 2),
        description: 'Mortgage Payment - Nationwide',
        amount: 1850.00,
        type: 'expense',
        category: 'Housing',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Car finance - HSBC Current
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 10),
        description: 'Tesla Model 3 Finance',
        amount: 650.00,
        type: 'expense',
        category: 'Transportation',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Council tax - Barclays Joint
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 1),
        description: 'Council Tax',
        amount: 185.00,
        type: 'expense',
        category: 'Housing',
        accountId: '2',
        cleared: true,
        isRecurring: true
      });
      
      // Utilities - British Gas
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 15),
        description: 'British Gas - Electricity & Gas',
        amount: randomAmount(150, 220),
        type: 'expense',
        category: 'Utilities',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Internet - BT
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 20),
        description: 'BT Internet & Phone',
        amount: 55.00,
        type: 'expense',
        category: 'Utilities',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Water bill - quarterly
      if (monthsAgo % 3 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 10),
          description: 'Thames Water',
          amount: randomAmount(90, 120),
          type: 'expense',
          category: 'Utilities',
          accountId: '2',
          cleared: true
        });
      }
      
      // Mobile phones - family plan
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 8),
        description: 'EE Mobile - Family Plan',
        amount: 85.00,
        type: 'expense',
        category: 'Utilities',
        accountId: '2',
        cleared: true,
        isRecurring: true
      });
      
      // Insurance - monthly
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 5),
        description: 'Home Insurance - Direct Line',
        amount: 45.00,
        type: 'expense',
        category: 'Insurance',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 5),
        description: 'Car Insurance - Admiral',
        amount: 125.00,
        type: 'expense',
        category: 'Insurance',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Subscriptions
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 8),
        description: 'Netflix',
        amount: 15.99,
        type: 'expense',
        category: 'Entertainment',
        accountId: '8',
        cleared: true,
        isRecurring: true
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 10),
        description: 'Spotify Family',
        amount: 16.99,
        type: 'expense',
        category: 'Entertainment',
        accountId: '8',
        cleared: true,
        isRecurring: true
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 12),
        description: 'Amazon Prime',
        amount: 8.99,
        type: 'expense',
        category: 'Shopping',
        accountId: '8',
        cleared: true,
        isRecurring: true
      });
      
      // Gym membership
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 1),
        description: 'PureGym Membership',
        amount: 24.99,
        type: 'expense',
        category: 'Healthcare',
        accountId: '3',
        cleared: true,
        isRecurring: true
      });
      
      // Weekly grocery shopping (4-5 times per month)
      for (let week = 0; week < 4; week++) {
        const groceryStores = ['Tesco', 'Sainsbury\'s', 'ASDA', 'Waitrose', 'M&S Food'];
        const store = groceryStores[Math.floor(Math.random() * groceryStores.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 3 + (week * 7)),
          description: `${store} Weekly Shop`,
          amount: randomAmount(80, 150),
          type: 'expense',
          category: 'Groceries',
          accountId: week % 2 === 0 ? '3' : '7',
          cleared: true,
          tags: ['groceries', 'weekly']
        });
      }
      
      // Additional grocery top-ups
      for (let i = 0; i < 3; i++) {
        const miniStores = ['Tesco Express', 'Co-op', 'Sainsbury\'s Local'];
        const store = miniStores[Math.floor(Math.random() * miniStores.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 5 + (i * 10)),
          description: store,
          amount: randomAmount(15, 40),
          type: 'expense',
          category: 'Groceries',
          accountId: '3',
          cleared: true
        });
      }
      
      // Petrol/fuel (2-3 times per month)
      for (let i = 0; i < 2; i++) {
        const stations = ['Shell', 'BP', 'Esso', 'Tesco Petrol'];
        const station = stations[Math.floor(Math.random() * stations.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 8 + (i * 12)),
          description: `${station} - Fuel`,
          amount: randomAmount(60, 90),
          type: 'expense',
          category: 'Transportation',
          accountId: '7',
          cleared: true,
          tags: ['fuel', 'car']
        });
      }
      
      // Public transport
      for (let i = 0; i < 10; i++) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 1 + (i * 3)),
          description: 'TfL Travel',
          amount: randomAmount(5, 15),
          type: 'expense',
          category: 'Transportation',
          accountId: '3',
          cleared: true,
          tags: ['transport', 'tube']
        });
      }
      
      // Restaurants and dining (varied frequency)
      const restaurants = [
        'The Ivy', 'Dishoom', 'Nando\'s', 'Pizza Express', 'Wagamama',
        'Honest Burger', 'Five Guys', 'Pret A Manger', 'Leon', 'Zizzi'
      ];
      
      for (let i = 0; i < 6; i++) {
        const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 2 + (i * 5)),
          description: restaurant,
          amount: randomAmount(25, 120),
          type: 'expense',
          category: 'Dining',
          accountId: i % 3 === 0 ? '8' : '7',
          cleared: true,
          tags: ['restaurant', 'dining']
        });
      }
      
      // Coffee shops
      for (let i = 0; i < 12; i++) {
        const coffeeShops = ['Starbucks', 'Costa Coffee', 'Pret', 'Nero'];
        const shop = coffeeShops[Math.floor(Math.random() * coffeeShops.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 1 + (i * 2.5)),
          description: shop,
          amount: randomAmount(3.50, 8.50),
          type: 'expense',
          category: 'Dining',
          accountId: '3',
          cleared: true,
          tags: ['coffee']
        });
      }
      
      // Shopping (clothes, electronics, etc.)
      const shops = [
        'John Lewis', 'Next', 'M&S', 'H&M', 'Zara', 'Uniqlo',
        'Amazon', 'Apple Store', 'Currys PC World', 'Argos'
      ];
      
      for (let i = 0; i < 4; i++) {
        const shop = shops[Math.floor(Math.random() * shops.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 5 + (i * 7)),
          description: shop,
          amount: randomAmount(30, 250),
          type: 'expense',
          category: 'Shopping',
          accountId: '8',
          cleared: true,
          tags: ['shopping']
        });
      }
      
      // Healthcare
      if (monthsAgo % 2 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 12),
          description: 'Boots Pharmacy',
          amount: randomAmount(10, 40),
          type: 'expense',
          category: 'Healthcare',
          accountId: '7',
          cleared: true
        });
      }
      
      // Dental (every 6 months)
      if (monthsAgo % 6 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 20),
          description: 'Dental Checkup',
          amount: 85.00,
          type: 'expense',
          category: 'Healthcare',
          accountId: '1',
          cleared: true
        });
      }
      
      // Entertainment (varied)
      for (let i = 0; i < 2; i++) {
        const activities = [
          'Vue Cinema', 'Odeon Cinema', 'Theatre Royal', 'O2 Arena Concert',
          'Emirates Stadium', 'Bowling', 'Mini Golf', 'Escape Room'
        ];
        const activity = activities[Math.floor(Math.random() * activities.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 8 + (i * 10)),
          description: activity,
          amount: randomAmount(15, 120),
          type: 'expense',
          category: 'Entertainment',
          accountId: '8',
          cleared: true
        });
      }
      
      // Monthly savings transfer
      const savingsId = (transactionId++).toString();
      transactions.push({
        id: savingsId,
        date: new Date(year, month, 5),
        description: 'Transfer to Savings',
        amount: 1000.00,
        type: 'expense',
        category: 'Transfer',
        accountId: '1',
        cleared: true,
        notes: 'Monthly savings goal'
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 5),
        description: 'Transfer from Current',
        amount: 1000.00,
        type: 'income',
        category: 'Transfer',
        accountId: '5',
        cleared: true,
        reconciledWith: savingsId
      });
      
      // Investment contributions
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 20),
        description: 'Pension Contribution',
        amount: 500.00,
        type: 'expense',
        category: 'Retirement',
        accountId: '1',
        cleared: true,
        isRecurring: true
      });
      
      // Stock purchases (occasional)
      if (monthsAgo % 2 === 0) {
        const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];
        const stock = stocks[Math.floor(Math.random() * stocks.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 15),
          description: `Buy shares - ${stock}`,
          amount: randomAmount(1000, 3000),
          type: 'expense',
          category: 'Investment',
          accountId: '13',
          cleared: true,
          tags: ['stocks', stock]
        });
      }
      
      // Credit card payments
      const ccPaymentId = (transactionId++).toString();
      transactions.push({
        id: ccPaymentId,
        date: new Date(year, month, 25),
        description: 'Barclaycard Payment',
        amount: randomAmount(400, 800),
        type: 'expense',
        category: 'Credit Card Payment',
        accountId: '1',
        cleared: true
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 25),
        description: 'Payment Received',
        amount: randomAmount(400, 800),
        type: 'income',
        category: 'Payment',
        accountId: '7',
        cleared: true,
        reconciledWith: ccPaymentId
      });
      
      // AMEX payment
      const amexPaymentId = (transactionId++).toString();
      transactions.push({
        id: amexPaymentId,
        date: new Date(year, month, 28),
        description: 'AMEX Payment',
        amount: randomAmount(300, 600),
        type: 'expense',
        category: 'Credit Card Payment',
        accountId: '2',
        cleared: true
      });
      
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 28),
        description: 'Payment Received',
        amount: randomAmount(300, 600),
        type: 'income',
        category: 'Payment',
        accountId: '8',
        cleared: true,
        reconciledWith: amexPaymentId
      });
      
      // Business loan interest (monthly)
      transactions.push({
        id: (transactionId++).toString(),
        date: new Date(year, month, 1),
        description: 'Loan Interest - TechStartup Ltd',
        amount: 666.67,
        type: 'income',
        category: 'Interest Income',
        accountId: '15',
        cleared: true,
        notes: 'Monthly interest at 8% annual rate'
      });
      
      // Charity donations (occasional)
      if (monthsAgo % 3 === 0) {
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 15),
          description: 'Red Cross Donation',
          amount: 50.00,
          type: 'expense',
          category: 'Charity',
          accountId: '1',
          cleared: true
        });
      }
      
      // Home maintenance (occasional)
      if (monthsAgo % 4 === 0) {
        const maintenance = ['B&Q', 'Wickes', 'Plumber Call Out', 'Electrician'];
        const item = maintenance[Math.floor(Math.random() * maintenance.length)];
        
        transactions.push({
          id: (transactionId++).toString(),
          date: new Date(year, month, 18),
          description: item,
          amount: randomAmount(50, 300),
          type: 'expense',
          category: 'Housing',
          accountId: '2',
          cleared: true
        });
      }
    }
    
    return transactions;
  };

  const loadTestData = () => {
    // Comprehensive test accounts
    const testAccounts: Account[] = [
      // Current Accounts
      {
        id: '1',
        name: 'HSBC Personal Current',
        type: 'current',
        balance: 8420.50,
        currency: 'GBP',
        institution: 'HSBC',
        lastUpdated: new Date()
      },
      {
        id: '2',
        name: 'Barclays Joint Current',
        type: 'current',
        balance: 3250.75,
        currency: 'GBP',
        institution: 'Barclays',
        lastUpdated: new Date()
      },
      {
        id: '3',
        name: 'Monzo Current Account',
        type: 'current',
        balance: 450.00,
        currency: 'GBP',
        institution: 'Monzo',
        lastUpdated: new Date()
      },
      // Savings Accounts
      {
        id: '4',
        name: 'HSBC Regular Saver',
        type: 'savings',
        balance: 12750.00,
        currency: 'GBP',
        institution: 'HSBC',
        lastUpdated: new Date()
      },
      {
        id: '5',
        name: 'Marcus High Yield Savings',
        type: 'savings',
        balance: 25000.00,
        currency: 'GBP',
        institution: 'Marcus by Goldman Sachs',
        lastUpdated: new Date()
      },
      {
        id: '6',
        name: 'NS&I Premium Bonds',
        type: 'savings',
        balance: 10000.00,
        currency: 'GBP',
        institution: 'NS&I',
        lastUpdated: new Date()
      },
      // Credit Cards
      {
        id: '7',
        name: 'Barclaycard Platinum',
        type: 'credit',
        balance: -2345.67,
        currency: 'GBP',
        institution: 'Barclaycard',
        lastUpdated: new Date()
      },
      {
        id: '8',
        name: 'American Express Gold',
        type: 'credit',
        balance: -890.50,
        currency: 'GBP',
        institution: 'American Express',
        lastUpdated: new Date()
      },
      {
        id: '9',
        name: 'Halifax Clarity',
        type: 'credit',
        balance: -150.00,
        currency: 'GBP',
        institution: 'Halifax',
        lastUpdated: new Date()
      },
      // Mortgage
      {
        id: '10',
        name: 'Home Mortgage',
        type: 'loan',
        balance: -285000.00,
        currency: 'GBP',
        institution: 'Nationwide',
        lastUpdated: new Date()
      },
      // Car Finance
      {
        id: '11',
        name: 'Tesla Model 3 Finance',
        type: 'loan',
        balance: -18500.00,
        currency: 'GBP',
        institution: 'Tesla Finance',
        lastUpdated: new Date()
      },
      // Retirement Account
      {
        id: '12',
        name: 'Company Pension (SIPP)',
        type: 'investment',
        balance: 125000.00,
        currency: 'GBP',
        institution: 'Hargreaves Lansdown',
        lastUpdated: new Date()
      },
      // Investment Account with Stocks
      {
        id: '13',
        name: 'Trading 212 ISA',
        type: 'investment',
        balance: 75000.00,
        currency: 'GBP',
        institution: 'Trading 212',
        lastUpdated: new Date(),
        holdings: [
          { ticker: 'AAPL', shares: 50, value: 8750.00 },
          { ticker: 'MSFT', shares: 30, value: 10200.00 },
          { ticker: 'GOOGL', shares: 15, value: 12000.00 },
          { ticker: 'AMZN', shares: 20, value: 7500.00 },
          { ticker: 'NVDA', shares: 10, value: 6200.00 },
          { ticker: 'TSLA', shares: 25, value: 5500.00 },
          { ticker: 'BRK.B', shares: 20, value: 7000.00 },
          { ticker: 'JPM', shares: 40, value: 6800.00 },
          { ticker: 'JNJ', shares: 35, value: 5550.00 },
          { ticker: 'V', shares: 25, value: 5500.00 }
        ]
      },
      // Private Business Investment
      {
        id: '14',
        name: 'TechStartup Ltd (50% ownership)',
        type: 'other',
        balance: 500000.00,
        currency: 'USD',
        institution: 'Private Investment',
        lastUpdated: new Date(),
        notes: '50% equity stake in private technology company'
      },
      // Business Loan
      {
        id: '15',
        name: 'Loan to TechStartup Ltd',
        type: 'other',
        balance: 100000.00,
        currency: 'USD',
        institution: 'Private Loan',
        lastUpdated: new Date(),
        notes: 'Business loan at 8% annual interest'
      }
    ];

    // Generate comprehensive test transactions over 12 months
    const testTransactions = generateTransactionsOverTime();

    // Comprehensive budgets
    const testBudgets: Budget[] = [
      {
        id: '201',
        category: 'Groceries',
        amount: 500,
        period: 'monthly',
        isActive: true
      },
      {
        id: '202',
        category: 'Utilities',
        amount: 300,
        period: 'monthly',
        isActive: true
      },
      {
        id: '203',
        category: 'Entertainment',
        amount: 200,
        period: 'monthly',
        isActive: true
      },
      {
        id: '204',
        category: 'Dining',
        amount: 300,
        period: 'monthly',
        isActive: true
      },
      {
        id: '205',
        category: 'Transportation',
        amount: 750,
        period: 'monthly',
        isActive: true
      },
      {
        id: '206',
        category: 'Housing',
        amount: 1850,
        period: 'monthly',
        isActive: true
      },
      {
        id: '207',
        category: 'Investment',
        amount: 12000,
        period: 'yearly',
        isActive: true
      },
      {
        id: '208',
        category: 'Retirement',
        amount: 6000,
        period: 'yearly',
        isActive: true
      },
      {
        id: '209',
        category: 'Shopping',
        amount: 250,
        period: 'monthly',
        isActive: true
      },
      {
        id: '210',
        category: 'Healthcare',
        amount: 100,
        period: 'monthly',
        isActive: true
      }
    ];
    
    // Sample goals
    const testGoals: Goal[] = [
      {
        id: '301',
        name: 'Emergency Fund',
        targetAmount: 15000,
        currentAmount: 8500,
        targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        type: 'savings',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: '302',
        name: 'House Deposit Top-up',
        targetAmount: 50000,
        currentAmount: 25000,
        targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
        type: 'savings',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: '303',
        name: 'Dream Vacation - Japan',
        targetAmount: 5000,
        currentAmount: 1200,
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 8)),
        type: 'savings',
        isActive: true,
        createdAt: new Date()
      },
      {
        id: '304',
        name: 'New Car Fund',
        targetAmount: 35000,
        currentAmount: 5000,
        targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 3)),
        type: 'savings',
        isActive: true,
        createdAt: new Date()
      }
    ];

    setAccounts(testAccounts);
    setTransactions(testTransactions);
    setBudgets(testBudgets);
    setGoals(testGoals);
  };

  return (
    <AppContext.Provider value={{
      accounts,
      transactions,
      budgets,
      recurringTransactions,
      goals,
      categories,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      clearAllData,
      exportData,
      importData,
      loadTestData,
      addRecurringTransaction,
      deleteRecurringTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      getCategoriesForTransactions,
      getSubCategories,
      getDetailCategories,
      getCategoryPath,
      getCategoryByPath
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
