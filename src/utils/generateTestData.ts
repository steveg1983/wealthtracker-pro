export function generateTestData() {
  const today = new Date();
  
  // Helper function for date manipulation
  function subDaysFromDate(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  // Test Accounts
  const accounts = [
    {
      id: 'acc1',
      name: 'Main Checking',
      type: 'checking' as const,
      balance: 5234.67,
      currency: 'GBP',
      institution: 'Barclays',
      lastUpdated: today,
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      type: 'savings' as const,
      balance: 15750.00,
      currency: 'GBP',
      institution: 'Halifax',
      lastUpdated: today,
    },
    {
      id: 'acc3',
      name: 'Credit Card',
      type: 'credit' as const,
      balance: -1234.50,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: today,
    },
    {
      id: 'acc4',
      name: 'Investment Portfolio',
      type: 'investment' as const,
      balance: 25000.00,
      currency: 'GBP',
      institution: 'Vanguard',
      lastUpdated: today,
    },
    {
      id: 'acc5',
      name: 'Car Loan',
      type: 'loan' as const,
      balance: -8500.00,
      currency: 'GBP',
      institution: 'Santander',
      lastUpdated: today,
    },
  ];

  // Generate transactions for the last 60 days
  const transactions = [];
  let transactionId = 1;

  // Recurring transactions
  const recurringTransactions = [
    { description: 'Salary', amount: 3500, type: 'income' as const, category: 'Salary', accountId: 'acc1', dayOfMonth: 25 },
    { description: 'Rent Payment', amount: 1200, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 1 },
    { description: 'Electricity Bill', amount: 85, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 15 },
    { description: 'Internet Bill', amount: 45, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 20 },
    { description: 'Mobile Phone', amount: 35, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 10 },
    { description: 'Gym Membership', amount: 49.99, type: 'expense' as const, category: 'Healthcare', accountId: 'acc3', dayOfMonth: 5 },
  ];

  // Random transactions
  const randomExpenses = [
    { description: 'Tesco Groceries', category: 'Food & Dining', min: 30, max: 120 },
    { description: 'Sainsbury\'s', category: 'Food & Dining', min: 25, max: 80 },
    { description: 'Costa Coffee', category: 'Food & Dining', min: 3, max: 8 },
    { description: 'Starbucks', category: 'Food & Dining', min: 4, max: 10 },
    { description: 'Amazon Purchase', category: 'Shopping', min: 15, max: 150 },
    { description: 'Primark', category: 'Shopping', min: 20, max: 100 },
    { description: 'Petrol Station', category: 'Transport', min: 40, max: 70 },
    { description: 'TfL Travel', category: 'Transport', min: 5, max: 20 },
    { description: 'Uber', category: 'Transport', min: 8, max: 25 },
    { description: 'Netflix', category: 'Entertainment', min: 10.99, max: 10.99 },
    { description: 'Cinema Tickets', category: 'Entertainment', min: 12, max: 30 },
    { description: 'Restaurant', category: 'Food & Dining', min: 30, max: 100 },
    { description: 'Boots Pharmacy', category: 'Healthcare', min: 5, max: 30 },
    { description: 'Deliveroo', category: 'Food & Dining', min: 15, max: 40 },
  ];

  // Generate transactions for last 60 days
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const currentDate = subDaysFromDate(today, daysAgo);
    const dayOfMonth = currentDate.getDate();

    // Add recurring transactions
    recurringTransactions.forEach(recurring => {
      if (dayOfMonth === recurring.dayOfMonth) {
        transactions.push({
          id: `trans${transactionId++}`,
          accountId: recurring.accountId,
          date: currentDate,
          description: recurring.description,
          amount: recurring.amount,
          type: recurring.type,
          category: recurring.category,
        });
      }
    });

    // Add 0-3 random transactions per day
    const numRandomTransactions = Math.floor(Math.random() * 4);
    for (let i = 0; i < numRandomTransactions; i++) {
      const expense = randomExpenses[Math.floor(Math.random() * randomExpenses.length)];
      const amount = expense.min + Math.random() * (expense.max - expense.min);
      
      // 70% chance for checking account, 30% for credit card
      const accountId = Math.random() < 0.7 ? 'acc1' : 'acc3';
      
      transactions.push({
        id: `trans${transactionId++}`,
        accountId: accountId,
        date: currentDate,
        description: expense.description,
        amount: Number(amount.toFixed(2)),
        type: 'expense' as const,
        category: expense.category,
      });
    }
  }

  // Add some income transactions
  transactions.push(
    {
      id: `trans${transactionId++}`,
      accountId: 'acc1',
      date: subDaysFromDate(today, 35),
      description: 'Freelance Project',
      amount: 500,
      type: 'income' as const,
      category: 'Freelance',
    },
    {
      id: `trans${transactionId++}`,
      accountId: 'acc2',
      date: subDaysFromDate(today, 20),
      description: 'Interest Payment',
      amount: 25.50,
      type: 'income' as const,
      category: 'Investment',
    },
    {
      id: `trans${transactionId++}`,
      accountId: 'acc1',
      date: subDaysFromDate(today, 15),
      description: 'Tax Refund',
      amount: 234.00,
      type: 'income' as const,
      category: 'Other',
    }
  );

  // Test Budgets
  const budgets = [
    {
      id: 'budget1',
      category: 'Food & Dining',
      amount: 600,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget2',
      category: 'Shopping',
      amount: 300,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget3',
      category: 'Transport',
      amount: 200,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget4',
      category: 'Entertainment',
      amount: 150,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget5',
      category: 'Bills',
      amount: 1400,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget6',
      category: 'Healthcare',
      amount: 100,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
  ];

  return { accounts, transactions, budgets };
}
