export function generateTestData() {
  const today = new Date();
  
  // Helper function for date manipulation
  function subDaysFromDate(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  // Test Accounts - More variety
  const accounts = [
    // Bank Accounts
    {
      id: 'acc1',
      name: 'Barclays Current Account',
      type: 'checking' as const,
      balance: 3567.89,
      currency: 'GBP',
      institution: 'Barclays',
      lastUpdated: today,
    },
    {
      id: 'acc2',
      name: 'Halifax Savings',
      type: 'savings' as const,
      balance: 12750.00,
      currency: 'GBP',
      institution: 'Halifax',
      lastUpdated: today,
    },
    {
      id: 'acc3',
      name: 'HSBC Joint Account',
      type: 'checking' as const,
      balance: 1234.56,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: today,
    },
    {
      id: 'acc4',
      name: 'Marcus Savings',
      type: 'savings' as const,
      balance: 25000.00,
      currency: 'GBP',
      institution: 'Marcus by Goldman Sachs',
      lastUpdated: today,
    },
    
    // Credit Cards
    {
      id: 'acc5',
      name: 'Amex Platinum',
      type: 'credit' as const,
      balance: -2345.67,
      currency: 'GBP',
      institution: 'American Express',
      lastUpdated: today,
    },
    {
      id: 'acc6',
      name: 'Barclaycard Rewards',
      type: 'credit' as const,
      balance: -567.89,
      currency: 'GBP',
      institution: 'Barclays',
      lastUpdated: today,
    },
    
    // Loans
    {
      id: 'acc7',
      name: 'Mortgage - Home',
      type: 'loan' as const,
      balance: -187500.00,
      currency: 'GBP',
      institution: 'Nationwide',
      lastUpdated: today,
    },
    {
      id: 'acc8',
      name: 'Car Finance - Tesla Model 3',
      type: 'loan' as const,
      balance: -22750.00,
      currency: 'GBP',
      institution: 'Tesla Finance',
      lastUpdated: today,
    },
    {
      id: 'acc9',
      name: 'Student Loan',
      type: 'loan' as const,
      balance: -28500.00,
      currency: 'GBP',
      institution: 'Student Loans Company',
      lastUpdated: today,
    },
    
    // UK Investments
    {
      id: 'acc10',
      name: 'Vanguard ISA',
      type: 'investment' as const,
      balance: 15670.50,
      currency: 'GBP',
      institution: 'Vanguard',
      lastUpdated: today,
    },
    {
      id: 'acc11',
      name: 'Hargreaves Lansdown SIPP',
      type: 'investment' as const,
      balance: 45230.75,
      currency: 'GBP',
      institution: 'Hargreaves Lansdown',
      lastUpdated: today,
    },
    {
      id: 'acc12',
      name: 'Trading 212 - UK Stocks',
      type: 'investment' as const,
      balance: 3456.78,
      currency: 'GBP',
      institution: 'Trading 212',
      lastUpdated: today,
    },
    
    // US Investments
    {
      id: 'acc13',
      name: 'Robinhood - US Stocks',
      type: 'investment' as const,
      balance: 5234.00,
      currency: 'USD',
      institution: 'Robinhood',
      lastUpdated: today,
    },
    {
      id: 'acc14',
      name: 'E*TRADE Portfolio',
      type: 'investment' as const,
      balance: 12500.00,
      currency: 'USD',
      institution: 'E*TRADE',
      lastUpdated: today,
    },
    
    // Crypto (as investment)
    {
      id: 'acc15',
      name: 'Coinbase Crypto',
      type: 'investment' as const,
      balance: 2890.45,
      currency: 'GBP',
      institution: 'Coinbase',
      lastUpdated: today,
    },
  ];

  // Generate transactions for the last 60 days
  const transactions = [];
  let transactionId = 1;

  // Recurring transactions
  const recurringTransactions = [
    // Income
    { description: 'Salary - Main Job', amount: 3850, type: 'income' as const, category: 'Salary', accountId: 'acc1', dayOfMonth: 28 },
    { description: 'Freelance Income', amount: 750, type: 'income' as const, category: 'Freelance', accountId: 'acc1', dayOfMonth: 15 },
    
    // Housing
    { description: 'Mortgage Payment', amount: 1450, type: 'expense' as const, category: 'Bills', accountId: 'acc3', dayOfMonth: 1 },
    { description: 'Council Tax', amount: 156, type: 'expense' as const, category: 'Bills', accountId: 'acc3', dayOfMonth: 5 },
    { description: 'Gas & Electric', amount: 125, type: 'expense' as const, category: 'Bills', accountId: 'acc3', dayOfMonth: 15 },
    { description: 'Water Bill', amount: 35, type: 'expense' as const, category: 'Bills', accountId: 'acc3', dayOfMonth: 20 },
    { description: 'Internet - BT Fibre', amount: 49.99, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 12 },
    
    // Transport
    { description: 'Car Finance - Tesla', amount: 425, type: 'expense' as const, category: 'Transport', accountId: 'acc1', dayOfMonth: 10 },
    { description: 'Car Insurance', amount: 89, type: 'expense' as const, category: 'Transport', accountId: 'acc1', dayOfMonth: 8 },
    
    // Subscriptions
    { description: 'Mobile Phone - EE', amount: 45, type: 'expense' as const, category: 'Bills', accountId: 'acc1', dayOfMonth: 22 },
    { description: 'Gym - PureGym', amount: 24.99, type: 'expense' as const, category: 'Healthcare', accountId: 'acc5', dayOfMonth: 5 },
    { description: 'Netflix', amount: 15.99, type: 'expense' as const, category: 'Entertainment', accountId: 'acc5', dayOfMonth: 8 },
    { description: 'Spotify Premium', amount: 10.99, type: 'expense' as const, category: 'Entertainment', accountId: 'acc5', dayOfMonth: 12 },
    
    // Investments
    { description: 'Vanguard ISA - Monthly', amount: 500, type: 'expense' as const, category: 'Investment', accountId: 'acc1', dayOfMonth: 1 },
    { description: 'Pension Contribution', amount: 300, type: 'expense' as const, category: 'Investment', accountId: 'acc1', dayOfMonth: 28 },
  ];

  // Random transactions
  const randomExpenses = [
    // UK Shops
    { description: 'Tesco Metro', category: 'Food & Dining', min: 15, max: 80 },
    { description: 'Sainsbury\'s Local', category: 'Food & Dining', min: 10, max: 60 },
    { description: 'Waitrose', category: 'Food & Dining', min: 25, max: 100 },
    { description: 'ASDA', category: 'Food & Dining', min: 30, max: 120 },
    { description: 'M&S Food', category: 'Food & Dining', min: 15, max: 50 },
    
    // Coffee & Dining
    { description: 'Pret A Manger', category: 'Food & Dining', min: 4, max: 12 },
    { description: 'Costa Coffee', category: 'Food & Dining', min: 3, max: 8 },
    { description: 'Starbucks', category: 'Food & Dining', min: 4, max: 10 },
    { description: 'Nando\'s', category: 'Food & Dining', min: 15, max: 35 },
    { description: 'Pizza Express', category: 'Food & Dining', min: 25, max: 60 },
    { description: 'Dishoom', category: 'Food & Dining', min: 30, max: 80 },
    
    // Shopping
    { description: 'Amazon UK', category: 'Shopping', min: 10, max: 150 },
    { description: 'John Lewis', category: 'Shopping', min: 30, max: 200 },
    { description: 'Next', category: 'Shopping', min: 25, max: 100 },
    { description: 'Zara', category: 'Shopping', min: 20, max: 80 },
    { description: 'Boots', category: 'Healthcare', min: 5, max: 40 },
    { description: 'Waterstones', category: 'Shopping', min: 10, max: 30 },
    
    // Transport
    { description: 'Shell Petrol', category: 'Transport', min: 40, max: 70 },
    { description: 'BP Fuel', category: 'Transport', min: 45, max: 75 },
    { description: 'TfL - Oyster Card', category: 'Transport', min: 5, max: 20 },
    { description: 'Uber', category: 'Transport', min: 8, max: 25 },
    { description: 'National Rail', category: 'Transport', min: 15, max: 50 },
    
    // Entertainment
    { description: 'Vue Cinema', category: 'Entertainment', min: 10, max: 25 },
    { description: 'Steam Games', category: 'Entertainment', min: 5, max: 40 },
    { description: 'The Gym Group', category: 'Healthcare', min: 3, max: 10 },
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

    // Add 1-4 random transactions per day
    const numRandomTransactions = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < numRandomTransactions; i++) {
      const expense = randomExpenses[Math.floor(Math.random() * randomExpenses.length)];
      const amount = expense.min + Math.random() * (expense.max - expense.min);
      
      // Mix between accounts - 50% checking, 30% joint, 20% credit cards
      let accountId = 'acc1';
      const accountChoice = Math.random();
      if (accountChoice < 0.5) {
        accountId = 'acc1'; // Main checking
      } else if (accountChoice < 0.8) {
        accountId = 'acc3'; // Joint account
      } else if (accountChoice < 0.9) {
        accountId = 'acc5'; // Amex
      } else {
        accountId = 'acc6'; // Barclaycard
      }
      
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

  // Add some investment transactions
  const investmentTransactions = [
    // UK Stocks
    { accountId: 'acc12', description: 'Bought Rolls-Royce shares', amount: 500, date: subDaysFromDate(today, 45) },
    { accountId: 'acc12', description: 'Bought BP shares', amount: 300, date: subDaysFromDate(today, 38) },
    { accountId: 'acc12', description: 'Bought Lloyds shares', amount: 250, date: subDaysFromDate(today, 30) },
    { accountId: 'acc10', description: 'Dividend - FTSE All-Share', amount: 125.50, date: subDaysFromDate(today, 25), type: 'income' },
    
    // US Stocks
    { accountId: 'acc13', description: 'Bought Apple shares', amount: 1000, date: subDaysFromDate(today, 40) },
    { accountId: 'acc13', description: 'Bought Microsoft shares', amount: 750, date: subDaysFromDate(today, 35) },
    { accountId: 'acc13', description: 'Bought Tesla shares', amount: 500, date: subDaysFromDate(today, 28) },
    { accountId: 'acc14', description: 'Bought Amazon shares', amount: 1500, date: subDaysFromDate(today, 20) },
    { accountId: 'acc14', description: 'Dividend - S&P 500 ETF', amount: 85.25, date: subDaysFromDate(today, 15), type: 'income' },
    
    // Crypto
    { accountId: 'acc15', description: 'Bought Bitcoin', amount: 500, date: subDaysFromDate(today, 22) },
    { accountId: 'acc15', description: 'Bought Ethereum', amount: 300, date: subDaysFromDate(today, 18) },
  ];

  investmentTransactions.forEach(inv => {
    transactions.push({
      id: `trans${transactionId++}`,
      accountId: inv.accountId,
      date: inv.date,
      description: inv.description,
      amount: inv.amount,
      type: (inv.type || 'expense') as 'income' | 'expense',
      category: 'Investment',
    });
  });

  // Add some loan payments that aren't recurring
  transactions.push(
    {
      id: `trans${transactionId++}`,
      accountId: 'acc1',
      date: subDaysFromDate(today, 50),
      description: 'Student Loan - Extra Payment',
      amount: 200,
      type: 'expense' as const,
      category: 'Bills',
    },
    {
      id: `trans${transactionId++}`,
      accountId: 'acc2',
      date: subDaysFromDate(today, 15),
      description: 'Interest Earned',
      amount: 45.83,
      type: 'income' as const,
      category: 'Investment',
    },
    {
      id: `trans${transactionId++}`,
      accountId: 'acc4',
      date: subDaysFromDate(today, 10),
      description: 'Marcus Interest',
      amount: 89.58,
      type: 'income' as const,
      category: 'Investment',
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
      amount: 400,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
    {
      id: 'budget3',
      category: 'Transport',
      amount: 250,
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
      amount: 2200,
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
    {
      id: 'budget7',
      category: 'Investment',
      amount: 800,
      period: 'monthly' as const,
      isActive: true,
      createdAt: today,
    },
  ];

  return { accounts, transactions, budgets };
}
