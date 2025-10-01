import { logger } from '../services/loggingService';

export function generateTestData() {
  const today = new Date();
  

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
      balance: 45678.90,
      currency: 'GBP',
      institution: 'Vanguard UK',
      lastUpdated: today,
    },
    {
      id: 'acc11',
      name: 'Hargreaves Lansdown SIPP',
      type: 'investment' as const,
      balance: 67890.12,
      currency: 'GBP',
      institution: 'Hargreaves Lansdown',
      lastUpdated: today,
    },
    {
      id: 'acc12',
      name: 'Trading 212',
      type: 'investment' as const,
      balance: 8765.43,
      currency: 'GBP',
      institution: 'Trading 212',
      lastUpdated: today,
    },
    
    // US Investments
    {
      id: 'acc13',
      name: 'Robinhood',
      type: 'investment' as const,
      balance: 12345.67,
      currency: 'USD',
      institution: 'Robinhood',
      lastUpdated: today,
    },
    {
      id: 'acc14',
      name: 'E*TRADE IRA',
      type: 'investment' as const,
      balance: 34567.89,
      currency: 'USD',
      institution: 'E*TRADE',
      lastUpdated: today,
    },
    
    // Crypto
    {
      id: 'acc15',
      name: 'Coinbase',
      type: 'investment' as const,
      balance: 9876.54,
      currency: 'GBP',
      institution: 'Coinbase',
      lastUpdated: today,
    },
  ];

  // Generate transactions for 12 months starting from July 1, 2024
  const transactions = [];
  const startDate = new Date(2024, 6, 1); // July 1, 2024
  const endDate = today;
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  
  logger.info('Test data generation', {
    startDate: startDate.toDateString(),
    endDate: endDate.toDateString(),
    daysDiff: daysDiff,
    monthsDiff: totalMonths
  });

  let transactionId = 1;

  // Helper function to generate transaction ID
  const generateTransactionId = () => `txn${transactionId++}`;

  // Helper function to generate matching transfer transactions
  const generateTransfer = (date: Date, fromAccount: string, toAccount: string, amount: number, description: string): void => {
    const baseId = generateTransactionId();
    
    // From account (money going out)
    transactions.push({
      id: `${baseId}-out`,
      accountId: fromAccount,
      date: date,
      description: description,
      amount: amount,
      type: 'expense' as const,
      category: 'transfer-out',
      cleared: false,  // Not reconciled
      tags: [],
    });
    
    // To account (money coming in)
    transactions.push({
      id: `${baseId}-in`,
      accountId: toAccount,
      date: date,
      description: description,
      amount: amount,
      type: 'income' as const,
      category: 'transfer-in',
      cleared: false,  // Not reconciled
      tags: [],
    });
  };

  // Generate monthly recurring transactions
  // Calculate actual months between dates
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  
  for (let monthOffset = 0; monthOffset <= monthsDiff; monthOffset++) {
    // Create date properly to avoid month boundary issues
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + monthOffset;
    const monthDate = new Date(year, month, 1);

    // Salary - 25th of each month
    const salaryDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 25);
    if (salaryDate <= endDate && salaryDate >= startDate) {
      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc1', // Barclays Current Account
        date: salaryDate,
        description: 'Salary - Acme Corp Ltd',
        amount: 4500.00,
        type: 'income' as const,
        category: 'inc-salary-regular',
        cleared: false,
        tags: ['salary'],
      });
    }

    // Mortgage payment - 1st of each month
    const mortgageDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    if (mortgageDate <= endDate && mortgageDate >= startDate) {
      generateTransfer(
        mortgageDate,
        'acc1', // From Barclays Current
        'acc7', // To Mortgage
        1250.00,
        'Mortgage Payment - Nationwide'
      );
    }

    // Car loan payment - 5th of each month
    const carLoanDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 5);
    if (carLoanDate <= endDate && carLoanDate >= startDate) {
      generateTransfer(
        carLoanDate,
        'acc1', // From Barclays Current
        'acc8', // To Car Finance
        450.00,
        'Car Finance Payment - Tesla'
      );
    }

    // Credit card payments - 15th of each month
    const ccPaymentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 15);
    if (ccPaymentDate <= endDate && ccPaymentDate >= startDate) {
      // Pay off Amex
      if (Math.random() > 0.3) { // 70% chance of paying
        generateTransfer(
          ccPaymentDate,
          'acc1', // From Barclays Current
          'acc5', // To Amex
          Math.random() * 1500 + 500, // Random amount between 500-2000
          'Amex Payment'
        );
      }
      
      // Pay off Barclaycard
      if (Math.random() > 0.5) { // 50% chance of paying
        generateTransfer(
          ccPaymentDate,
          'acc1', // From Barclays Current
          'acc6', // To Barclaycard
          Math.random() * 300 + 200, // Random amount between 200-500
          'Barclaycard Payment'
        );
      }
    }

    // Transfer to savings - 26th of each month
    const savingsDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 26);
    if (savingsDate <= endDate && savingsDate >= startDate) {
      generateTransfer(
        savingsDate,
        'acc1', // From Barclays Current
        'acc2', // To Halifax Savings
        500.00,
        'Monthly Savings'
      );
    }

    // ISA contribution - 10th of each month
    const isaDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 10);
    if (isaDate <= endDate && isaDate >= startDate) {
      generateTransfer(
        isaDate,
        'acc1', // From Barclays Current
        'acc10', // To Vanguard ISA
        300.00,
        'ISA Monthly Contribution'
      );
    }

    // Utilities and bills
    const bills = [
      { day: 3, desc: 'British Gas - Electricity & Gas', amount: 145.00, category: 'exp-utilities-electricity' },
      { day: 5, desc: 'Thames Water', amount: 35.50, category: 'exp-utilities-water' },
      { day: 8, desc: 'BT Broadband', amount: 49.99, category: 'exp-utilities-internet' },
      { day: 10, desc: 'Council Tax - Westminster', amount: 189.00, category: 'exp-housing-tax' },
      { day: 12, desc: 'EE Mobile', amount: 45.00, category: 'exp-utilities-phone' },
      { day: 20, desc: 'Netflix', amount: 15.99, category: 'exp-entertainment-streaming' },
      { day: 21, desc: 'Spotify Premium', amount: 10.99, category: 'exp-entertainment-streaming' },
      { day: 22, desc: 'Amazon Prime', amount: 8.99, category: 'exp-shopping-online' },
    ];

    bills.forEach(bill => {
      const billDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), bill.day);
      if (billDate <= endDate && billDate >= startDate) {
        transactions.push({
          id: generateTransactionId(),
          accountId: 'acc1', // Barclays Current Account
          date: billDate,
          description: bill.desc,
          amount: -bill.amount,
          type: 'expense' as const,
          category: bill.category,
          cleared: false,
          tags: ['bills'],
        });
      }
    });
  }

  // Generate daily random transactions
  for (let dayOffset = 0; dayOffset <= daysDiff; dayOffset++) {
    // Create a new date by adding days to the start date's timestamp
    const transactionDate = new Date(startDate.getTime() + (dayOffset * 24 * 60 * 60 * 1000));

    // Skip some days randomly
    if (Math.random() < 0.3) continue;

    // Grocery shopping (2-3 times per week)
    if (Math.random() < 0.43) { // ~3 times per week
      const groceryStores = [
        { name: 'Tesco Express', category: 'exp-food-groceries' },
        { name: 'Sainsbury\'s Local', category: 'exp-food-groceries' },
        { name: 'Waitrose', category: 'exp-food-groceries' },
        { name: 'Marks & Spencer Food', category: 'exp-food-groceries' },
        { name: 'Co-op Food', category: 'exp-food-groceries' },
      ];
      const store = groceryStores[Math.floor(Math.random() * groceryStores.length)];
      if (!store) continue;

      transactions.push({
        id: generateTransactionId(),
        accountId: Math.random() > 0.7 ? 'acc5' : 'acc1', // 30% chance on Amex
        date: transactionDate,
        description: store.name,
        amount: -(Math.random() * 80 + 20), // £20-100
        type: 'expense' as const,
        category: store.category,
        cleared: false,
        tags: ['groceries'],
      });
    }

    // Restaurants and takeaways
    if (Math.random() < 0.3) {
      const restaurants = [
        { name: 'Pret A Manger', category: 'exp-food-restaurants', amount: [8, 15] },
        { name: 'Wagamama', category: 'exp-food-restaurants', amount: [25, 40] },
        { name: 'Nando\'s', category: 'exp-food-restaurants', amount: [20, 35] },
        { name: 'Pizza Express', category: 'exp-food-restaurants', amount: [30, 50] },
        { name: 'Dishoom', category: 'exp-food-restaurants', amount: [35, 60] },
        { name: 'Starbucks', category: 'exp-food-coffee', amount: [4, 8] },
        { name: 'Costa Coffee', category: 'exp-food-coffee', amount: [3, 7] },
        { name: 'Deliveroo', category: 'exp-food-takeaway', amount: [25, 45] },
        { name: 'Uber Eats', category: 'exp-food-takeaway', amount: [20, 40] },
      ];
      const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
      if (!restaurant) continue;

      transactions.push({
        id: generateTransactionId(),
        accountId: Math.random() > 0.5 ? 'acc5' : 'acc1', // 50% chance on Amex
        date: transactionDate,
        description: restaurant.name,
        amount: -(Math.random() * ((restaurant.amount?.[1] || 0) - (restaurant.amount?.[0] || 0)) + (restaurant.amount?.[0] || 0)),
        type: 'expense' as const,
        category: restaurant.category,
        cleared: false,
        tags: ['dining'],
      });
    }

    // Transport
    if (Math.random() < 0.4) {
      const transport = [
        { name: 'TfL Travel', category: 'exp-transport-public', amount: [2.80, 9.50] },
        { name: 'Uber', category: 'exp-transport-taxi', amount: [8, 25] },
        { name: 'Shell Petrol Station', category: 'exp-transport-fuel', amount: [40, 80] },
        { name: 'BP Fuel', category: 'exp-transport-fuel', amount: [45, 85] },
      ];
      const trip = transport[Math.floor(Math.random() * transport.length)];
      if (!trip) continue;

      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc1', // Barclays Current Account
        date: transactionDate,
        description: trip.name,
        amount: -(Math.random() * ((trip.amount?.[1] || 0) - (trip.amount?.[0] || 0)) + (trip.amount?.[0] || 0)),
        type: 'expense' as const,
        category: trip.category,
        cleared: false,
        tags: ['transport'],
      });
    }

    // Shopping (occasional)
    if (Math.random() < 0.15) {
      const shops = [
        { name: 'John Lewis', category: 'exp-shopping-clothing', amount: [50, 200] },
        { name: 'Zara', category: 'exp-shopping-clothing', amount: [30, 120] },
        { name: 'Boots', category: 'exp-personal-care', amount: [15, 50] },
        { name: 'Argos', category: 'exp-shopping-household', amount: [20, 150] },
        { name: 'Amazon.co.uk', category: 'exp-shopping-online', amount: [15, 100] },
      ];
      const shop = shops[Math.floor(Math.random() * shops.length)];

      if (!shop) continue; // Skip if shop is undefined

      transactions.push({
        id: generateTransactionId(),
        accountId: Math.random() > 0.6 ? 'acc5' : 'acc6', // Mix of credit cards
        date: transactionDate,
        description: shop.name,
        amount: -(Math.random() * ((shop.amount[1] || 100) - (shop.amount[0] || 10)) + (shop.amount[0] || 10)),
        type: 'expense' as const,
        category: shop.category,
        cleared: false,
        tags: ['shopping'],
      });
    }

    // Entertainment (occasional)
    if (Math.random() < 0.1) {
      const entertainment = [
        { name: 'Vue Cinema', category: 'exp-entertainment-movies', amount: [12, 25] },
        { name: 'Odeon Cinema', category: 'exp-entertainment-movies', amount: [10, 22] },
        { name: 'The Old Vic Theatre', category: 'exp-entertainment-events', amount: [35, 85] },
        { name: 'O2 Arena - Concert', category: 'exp-entertainment-events', amount: [50, 150] },
      ];
      const event = entertainment[Math.floor(Math.random() * entertainment.length)];

      if (!event) continue; // Skip if event is undefined

      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc5', // Amex
        date: transactionDate,
        description: event.name,
        amount: -(Math.random() * ((event.amount[1] || 100) - (event.amount[0] || 10)) + (event.amount[0] || 10)),
        type: 'expense' as const,
        category: event.category,
        cleared: false,
        tags: ['entertainment'],
      });
    }

    // Healthcare (occasional)
    if (Math.random() < 0.05) {
      const healthcare = [
        { name: 'Boots Pharmacy', category: 'exp-healthcare-pharmacy', amount: [8, 25] },
        { name: 'Private GP Consultation', category: 'exp-healthcare-doctor', amount: [150, 250] },
        { name: 'Dental Checkup', category: 'exp-healthcare-dental', amount: [60, 150] },
      ];
      const health = healthcare[Math.floor(Math.random() * healthcare.length)];

      if (!health) continue; // Skip if health is undefined

      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc1',
        date: transactionDate,
        description: health.name,
        amount: -(Math.random() * ((health.amount[1] || 100) - (health.amount[0] || 10)) + (health.amount[0] || 10)),
        type: 'expense' as const,
        category: health.category,
        cleared: false,
        tags: ['healthcare'],
      });
    }
  }

  // Add some investment transactions
  const investmentDates = [
    new Date(2024, 7, 15),  // Aug 15
    new Date(2024, 9, 20),  // Oct 20
    new Date(2024, 11, 10), // Dec 10
    new Date(2025, 1, 15),  // Feb 15
    new Date(2025, 3, 25),  // Apr 25
  ];

  investmentDates.forEach(date => {
    if (date <= endDate) {
      // Dividend income
      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc10', // Vanguard ISA
        date: date,
        description: 'Dividend Payment - FTSE All-Share',
        amount: Math.random() * 200 + 50,
        type: 'income' as const,
        category: 'inc-investment-dividends',
        cleared: false,
        tags: ['investment', 'dividend'],
      });

      // US dividend (in USD)
      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc13', // Robinhood
        date: date,
        description: 'Dividend - S&P 500 ETF',
        amount: Math.random() * 100 + 25,
        type: 'income' as const,
        category: 'inc-investment-dividends',
        cleared: false,
        tags: ['investment', 'dividend'],
      });
    }
  });

  // Add some irregular income
  const bonusDates = [
    { date: new Date(2024, 11, 20), desc: 'Year End Bonus', amount: 8500 },
    { date: new Date(2025, 2, 25), desc: 'Performance Bonus Q1', amount: 2500 },
  ];

  bonusDates.forEach(bonus => {
    if (bonus.date <= endDate) {
      transactions.push({
        id: generateTransactionId(),
        accountId: 'acc1',
        date: bonus.date,
        description: bonus.desc,
        amount: bonus.amount,
        type: 'income' as const,
        category: 'inc-salary-bonus',
        cleared: false,
        tags: ['bonus'],
      });
    }
  });

  // Sort transactions by date (newest first)
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  logger.info('Generated transactions', { count: transactions.length });
  if (transactions.length > 0) {
    logger.info('Date range', {
      start: transactions[transactions.length - 1]?.date.toDateString() || 'Unknown',
      end: transactions[0]?.date.toDateString() || 'Unknown'
    });
  }

  // Budgets
  const budgets = [
    {
      id: 'budget1',
      category: 'exp-food',
      amount: 600,
      period: 'monthly' as const,
      spent: 0, // Will be calculated by the app
    },
    {
      id: 'budget2',
      category: 'exp-shopping',
      amount: 300,
      period: 'monthly' as const,
      spent: 0,
    },
    {
      id: 'budget3',
      category: 'exp-transport',
      amount: 200,
      period: 'monthly' as const,
      spent: 0,
    },
    {
      id: 'budget4',
      category: 'exp-entertainment',
      amount: 150,
      period: 'monthly' as const,
      spent: 0,
    },
    {
      id: 'budget5',
      category: 'exp-utilities',
      amount: 350,
      period: 'monthly' as const,
      spent: 0,
    },
    {
      id: 'budget6',
      category: 'exp-healthcare',
      amount: 100,
      period: 'monthly' as const,
      spent: 0,
    },
    {
      id: 'budget7',
      category: 'exp-housing',
      amount: 1500,
      period: 'monthly' as const,
      spent: 0,
    },
  ];

  // Goals
  const goals = [
    {
      id: 'goal1',
      name: 'Emergency Fund',
      targetAmount: 15000,
      currentAmount: 12750, // Halifax Savings balance
      targetDate: new Date(2025, 11, 31), // End of 2025
      category: 'Emergency Fund',
    },
    {
      id: 'goal2',
      name: 'House Deposit',
      targetAmount: 50000,
      currentAmount: 25000, // Marcus Savings balance
      targetDate: new Date(2026, 11, 31), // End of 2026
      category: 'Property',
    },
    {
      id: 'goal3',
      name: 'Dream Holiday - Japan',
      targetAmount: 5000,
      currentAmount: 1500,
      targetDate: new Date(2025, 6, 1), // July 2025
      category: 'Travel',
    },
  ];

  return { accounts, transactions, budgets, goals };
}
