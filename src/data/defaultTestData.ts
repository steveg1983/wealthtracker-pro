// Import types from main types file
import type { Account, Transaction, Budget, Goal } from '../types';

export const getDefaultTestAccounts = (): Account[] => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return [
  // Current Accounts
  {
    id: '2',
    name: 'Natwest Current Account',
    type: 'current',
    balance: 8250.75, // Target closing balance
    currency: 'GBP',
    institution: 'Natwest',
    lastUpdated: new Date(),
    openingBalance: 2500.00, // Opening balance 6 months ago
    openingBalanceDate: sixMonthsAgo
  },
  {
    id: '3',
    name: 'Monzo Current Account',
    type: 'current',
    balance: 450.00,
    currency: 'GBP',
    institution: 'Monzo',
    lastUpdated: new Date(),
    openingBalance: 200.00,
    openingBalanceDate: sixMonthsAgo
  },
  // Savings Accounts
  {
    id: '5',
    name: 'NS&I Premium Bonds',
    type: 'savings',
    balance: 15000.00,
    currency: 'GBP',
    institution: 'NS&I',
    lastUpdated: new Date()
  },
  {
    id: '7',
    name: 'Natwest Savings Account',
    type: 'savings',
    balance: 10000.00,
    currency: 'GBP',
    institution: 'Natwest',
    lastUpdated: new Date(),
    openingBalance: 7000.00, // £500/month * 6 months = £3000 added
    openingBalanceDate: sixMonthsAgo
  },
  // Credit Cards
  {
    id: '8',
    name: 'Natwest Credit Card',
    type: 'credit',
    balance: -1245.67,
    currency: 'GBP',
    institution: 'Natwest',
    lastUpdated: new Date(),
    openingBalance: -1500.00, // Started higher, payments reduced it
    openingBalanceDate: sixMonthsAgo
  },
  {
    id: '9',
    name: 'American Express Gold',
    type: 'credit',
    balance: -3200.00,
    currency: 'GBP',
    institution: 'American Express',
    lastUpdated: new Date()
  },
  // Loans
  {
    id: '11',
    name: 'Natwest Personal Loan',
    type: 'loan',
    balance: -8800.00, // Starting at -10000, paid 1200 (6 months * 200)
    currency: 'GBP',
    institution: 'Natwest',
    lastUpdated: new Date(),
    openingBalance: -10000.00, // Original loan amount
    openingBalanceDate: sixMonthsAgo
  },
  {
    id: '16',
    name: 'Natwest Mortgage',
    type: 'loan',
    balance: -180000.00, // Current balance
    currency: 'GBP',
    institution: 'Natwest',
    lastUpdated: new Date(),
    openingBalance: -187200.00, // 6 months ago (6 * £1,200 = £7,200 paid)
    openingBalanceDate: sixMonthsAgo
  },
  // Investment Accounts
  {
    id: '12',
    name: 'Hargreaves Lansdown ISA',
    type: 'investment',
    balance: 45000.00,
    currency: 'GBP',
    institution: 'Hargreaves Lansdown',
    lastUpdated: new Date(),
    holdings: [
      { ticker: 'BP.', name: 'BP', shares: 2500, value: 6682.50 }, // £2.673 per share
      { ticker: 'SHEL', name: 'Shell', shares: 1200, value: 3207.60 }, // £2.673 per share
      { ticker: 'HSBA', name: 'HSBC', shares: 1100, value: 9999.00 }, // £9.09 per share
      { ticker: 'ULVR', name: 'Unilever', shares: 300, value: 13632.00 }, // £45.44 per share
      { ticker: 'VWRL', name: 'Vanguard FTSE All-World ETF', shares: 110, value: 11478.90 } // ~£104.35 per share
    ]
  },
  {
    id: '13',
    name: 'Hargreaves Lansdown SIPP',
    type: 'investment',
    balance: 209992.00,
    currency: 'GBP',
    institution: 'Hargreaves Lansdown',
    lastUpdated: new Date(),
    holdings: [
      { ticker: 'AZN', name: 'AstraZeneca', shares: 350, value: 41867.00 }, // £119.62 per share
      { ticker: 'VWRL', name: 'Vanguard FTSE All-World ETF', shares: 500, value: 52175.00 }, // ~£104.35 per share
      { ticker: 'GB00B41YBW71', name: 'Fundsmith Equity', shares: 1850, value: 42550.00 }, // ~£23 per unit
      { ticker: 'GB00B8JYLC77', name: 'Lindsell Train Global Equity', shares: 2500, value: 35000.00 }, // ~£14 per unit
      { ticker: 'GB00BYTYHS72', name: 'Baillie Gifford Long Term Global Growth', shares: 3200, value: 38400.00 } // ~£12 per unit
    ]
  },
  {
    id: '14',
    name: 'City Index Trader',
    type: 'investment',
    balance: 2500.00,
    currency: 'GBP',
    institution: 'City Index',
    lastUpdated: new Date()
  },
  // Assets
  {
    id: '15',
    name: 'Primary Residence',
    type: 'assets',
    balance: 300000.00,
    currency: 'GBP',
    institution: 'Property',
    lastUpdated: new Date(),
    openingBalance: 300000.00,
    openingBalanceDate: sixMonthsAgo
  }
  ];
};

export const getDefaultTestTransactions = (): Transaction[] => {
  const today = new Date();
  const transactions: Transaction[] = [];
  let transactionId = 1;

  // Helper to create a date n days ago
  const daysAgo = (n: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - n);
    return date;
  };

  // Helper to create date for specific day of month
  const monthsAgoOnDay = (monthsAgo: number, dayOfMonth: number) => {
    const date = new Date(today);
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(dayOfMonth);
    return date;
  };

  // Generate 6 months of transactions
  // Starting from 6 months ago to today
  
  // Monthly Salary - £5,250 on 25th of each month
  for (let month = 5; month >= 0; month--) {
    const salaryDate = monthsAgoOnDay(month, 25);
    if (salaryDate <= today) {
      transactions.push({
        id: `t${transactionId++}`,
        date: salaryDate,
        description: 'ABC Corp - Monthly Salary',
        amount: 5250.00,
        type: 'income',
        category: 'cat-1', // Salary
        categoryName: 'Salary',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
    }
  }

  // Monthly Loan Payments - £200 on 1st of each month
  for (let month = 5; month >= 0; month--) {
    const loanPaymentDate = monthsAgoOnDay(month, 1);
    if (loanPaymentDate <= today) {
      // Payment from current account
      transactions.push({
        id: `t${transactionId++}`,
        date: loanPaymentDate,
        description: 'Loan Payment - Natwest Personal Loan',
        amount: -200.00, // Negative for money leaving
        type: 'transfer',
        category: 'cat-31', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Personal Loan',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
      
      // Payment to loan account
      transactions.push({
        id: `t${transactionId++}`,
        date: loanPaymentDate,
        description: 'Loan Payment Received - Natwest Personal Loan',
        amount: 200.00,
        type: 'transfer',
        category: 'cat-31', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Personal Loan',
        accountId: '11', // Natwest Personal Loan
        cleared: false
      });
    }
  }

  // Monthly Rent - £1,200 on 1st of each month
  for (let month = 5; month >= 0; month--) {
    const rentDate = monthsAgoOnDay(month, 1);
    if (rentDate <= today) {
      transactions.push({
        id: `t${transactionId++}`,
        date: rentDate,
        description: 'Monthly Rent Payment',
        amount: 1200.00,
        type: 'expense',
        category: 'cat-10', // Rent
        categoryName: 'Rent',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
    }
  }

  // Monthly Credit Card Payments - £500 on 15th of each month
  for (let month = 5; month >= 0; month--) {
    const ccPaymentDate = monthsAgoOnDay(month, 15);
    if (ccPaymentDate <= today) {
      // Payment from current account
      transactions.push({
        id: `t${transactionId++}`,
        date: ccPaymentDate,
        description: 'Credit Card Payment - Natwest',
        amount: -500.00, // Negative for money leaving
        type: 'transfer',
        category: 'cat-32', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Credit Card',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
      
      // Payment to credit card
      transactions.push({
        id: `t${transactionId++}`,
        date: ccPaymentDate,
        description: 'Payment Received - Natwest Credit Card',
        amount: 500.00,
        type: 'transfer',
        category: 'cat-32', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Credit Card',
        accountId: '8', // Natwest Credit Card
        cleared: false
      });
    }
  }

  // Monthly Savings Transfer - £500 on 26th of each month
  for (let month = 5; month >= 0; month--) {
    const savingsDate = monthsAgoOnDay(month, 26);
    if (savingsDate <= today) {
      // Transfer from current account
      transactions.push({
        id: `t${transactionId++}`,
        date: savingsDate,
        description: 'Transfer to Savings',
        amount: -500.00, // Negative for money leaving
        type: 'transfer',
        category: 'cat-33', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Savings Account',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
      
      // Transfer to savings account
      transactions.push({
        id: `t${transactionId++}`,
        date: savingsDate,
        description: 'Transfer from Current Account - Natwest Savings',
        amount: 500.00,
        type: 'transfer',
        category: 'cat-33', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and Natwest Savings Account',
        accountId: '7', // Natwest Savings Account
        cleared: false
      });
    }
  }

  // Weekly Groceries - varying amounts
  for (let week = 24; week >= 0; week--) {
    const groceryDate = daysAgo(week * 7);
    const amount = Math.round((80 + Math.random() * 40) * 100) / 100; // £80-120
    
    transactions.push({
      id: `t${transactionId++}`,
      date: groceryDate,
      description: week % 3 === 0 ? 'Tesco Supermarket' : week % 3 === 1 ? 'Sainsbury\'s' : 'ASDA',
      amount: Math.round(amount * 100) / 100,
      type: 'expense',
      category: 'cat-12', // Groceries
      categoryName: 'Groceries',
      accountId: week % 2 === 0 ? '8' : '2', // Alternate between credit card and current account
      cleared: true
    });
  }

  // Monthly Utilities
  for (let month = 5; month >= 0; month--) {
    // Electric & Gas - around 10th
    const utilityDate = monthsAgoOnDay(month, 10);
    if (utilityDate <= today) {
      transactions.push({
        id: `t${transactionId++}`,
        date: utilityDate,
        description: 'British Gas - Monthly Bill',
        amount: Math.round((120 + Math.random() * 40) * 100) / 100, // £120-160
        type: 'expense',
        category: 'cat-11', // Utilities
        categoryName: 'Utilities',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
    }

    // Water - around 5th
    const waterDate = monthsAgoOnDay(month, 5);
    if (waterDate <= today) {
      transactions.push({
        id: `t${transactionId++}`,
        date: waterDate,
        description: 'Thames Water',
        amount: 45.00,
        type: 'expense',
        category: 'cat-11', // Utilities
        categoryName: 'Utilities',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
    }

    // Mobile phone - 20th
    const phoneDate = monthsAgoOnDay(month, 20);
    if (phoneDate <= today) {
      transactions.push({
        id: `t${transactionId++}`,
        date: phoneDate,
        description: 'Vodafone Mobile',
        amount: 35.00,
        type: 'expense',
        category: 'cat-11', // Utilities
        categoryName: 'Utilities',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
    }
  }

  // Credit Card Spending (various)
  for (let days = 180; days >= 0; days -= 3) { // Every 3 days
    const spendDate = daysAgo(days);
    const rand = Math.random();
    
    if (rand < 0.3) { // 30% dining out
      transactions.push({
        id: `t${transactionId++}`,
        date: spendDate,
        description: ['Pizza Express', 'Nandos', 'Wagamama', 'Starbucks', 'Costa Coffee'][Math.floor(Math.random() * 5)],
        amount: Math.round((15 + Math.random() * 35) * 100) / 100, // £15-50
        type: 'expense',
        category: 'cat-13', // Dining Out
        categoryName: 'Dining Out',
        accountId: '8', // Natwest Credit Card
        cleared: days > 14
      });
    } else if (rand < 0.5) { // 20% shopping
      transactions.push({
        id: `t${transactionId++}`,
        date: spendDate,
        description: ['Amazon', 'John Lewis', 'M&S', 'Next', 'ASOS'][Math.floor(Math.random() * 5)],
        amount: Math.round((25 + Math.random() * 75) * 100) / 100, // £25-100
        type: 'expense',
        category: 'cat-22', // Clothing
        categoryName: 'Clothing',
        accountId: '8', // Natwest Credit Card
        cleared: days > 14
      });
    } else if (rand < 0.7) { // 20% entertainment
      transactions.push({
        id: `t${transactionId++}`,
        date: spendDate,
        description: ['Netflix', 'Spotify', 'Odeon Cinema', 'Vue Cinema', 'Amazon Prime'][Math.floor(Math.random() * 5)],
        amount: Math.round((10 + Math.random() * 30) * 100) / 100, // £10-40
        type: 'expense',
        category: 'cat-21', // Entertainment
        categoryName: 'Subscriptions',
        accountId: '8', // Natwest Credit Card
        cleared: days > 14
      });
    }
  }

  // Monthly Mortgage Payments - £1,200 on 1st of each month
  for (let month = 5; month >= 0; month--) {
    const mortgageDate = monthsAgoOnDay(month, 1);
    if (mortgageDate <= today) {
      // Payment from current account
      transactions.push({
        id: `t${transactionId++}`,
        date: mortgageDate,
        description: 'Mortgage Payment - Natwest',
        amount: -1200.00, // Negative for money leaving
        type: 'transfer',
        category: 'cat-35', // Specific transfer category for mortgage
        categoryName: 'Transfers between Natwest Current Account and Natwest Mortgage',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
      
      // Payment to mortgage account
      transactions.push({
        id: `t${transactionId++}`,
        date: mortgageDate,
        description: 'Mortgage Payment Received',
        amount: 1200.00,
        type: 'transfer',
        category: 'cat-35', // Specific transfer category for mortgage
        categoryName: 'Transfers between Natwest Current Account and Natwest Mortgage',
        accountId: '16', // Natwest Mortgage
        cleared: false
      });
    }
  }

  // Weekly fuel
  for (let week = 24; week >= 0; week -= 2) { // Every 2 weeks
    const fuelDate = daysAgo(week * 7 + 3);
    transactions.push({
      id: `t${transactionId++}`,
      date: fuelDate,
      description: ['Shell', 'BP', 'Esso', 'Tesco Fuel'][Math.floor(Math.random() * 4)],
      amount: Math.round((50 + Math.random() * 20) * 100) / 100, // £50-70
      type: 'expense',
      category: 'cat-14', // Fuel
      categoryName: 'Fuel',
      accountId: '8', // Credit card
      cleared: true
    });
  }

  // Monzo spending (coffees, small purchases)
  for (let days = 180; days >= 0; days -= 2) { // Every 2 days
    if (Math.random() < 0.4) { // 40% chance
      transactions.push({
        id: `t${transactionId++}`,
        date: daysAgo(days),
        description: ['Pret A Manger', 'Greggs', 'Boots', 'WH Smith', 'Co-op'][Math.floor(Math.random() * 5)],
        amount: Math.round((3 + Math.random() * 12) * 100) / 100, // £3-15
        type: 'expense',
        category: 'cat-13', // Dining Out
        categoryName: 'Dining Out',
        accountId: '3', // Monzo
        cleared: false
      });
    }
  }

  // Healthcare/Pharmacy - occasional
  for (let month = 5; month >= 0; month--) {
    if (Math.random() < 0.5) { // 50% chance each month
      const healthDate = monthsAgoOnDay(month, Math.floor(Math.random() * 28) + 1);
      if (healthDate <= today) {
        transactions.push({
          id: `t${transactionId++}`,
          date: healthDate,
          description: 'Boots Pharmacy',
          amount: Math.round((10 + Math.random() * 30) * 100) / 100, // £10-40
          type: 'expense',
          category: 'cat-25', // Pharmacy
          categoryName: 'Pharmacy',
          accountId: '2', // Natwest Current Account
          cleared: false
        });
      }
    }
  }

  // Insurance - annual/monthly
  transactions.push({
    id: `t${transactionId++}`,
    date: monthsAgoOnDay(4, 15),
    description: 'Home Insurance - Annual',
    amount: 450.00,
    type: 'expense',
    category: 'cat-26', // Insurance
    categoryName: 'Insurance',
    accountId: '2', // Natwest Current Account
    cleared: true
  });

  transactions.push({
    id: `t${transactionId++}`,
    date: monthsAgoOnDay(2, 15),
    description: 'Car Insurance - Annual',
    amount: 680.00,
    type: 'expense',
    category: 'cat-26', // Insurance
    categoryName: 'Insurance',
    accountId: '2', // Natwest Current Account
    cleared: true
  });

  // Amex spending
  for (let days = 180; days >= 0; days -= 5) { // Every 5 days
    if (Math.random() < 0.6) { // 60% chance
      const amexDate = daysAgo(days);
      transactions.push({
        id: `t${transactionId++}`,
        date: amexDate,
        description: ['Waitrose', 'Selfridges', 'Hotel Booking', 'BA Flights', 'Restaurant'][Math.floor(Math.random() * 5)],
        amount: Math.round((50 + Math.random() * 150) * 100) / 100, // £50-200
        type: 'expense',
        category: ['cat-12', 'cat-22', 'cat-13', 'cat-30'][Math.floor(Math.random() * 4)],
        categoryName: ['Groceries', 'Clothing', 'Dining Out', 'Other'][Math.floor(Math.random() * 4)],
        accountId: '9', // American Express
        cleared: days > 30
      });
    }
  }

  // Monthly Amex payment
  for (let month = 5; month >= 1; month--) {
    const amexPaymentDate = monthsAgoOnDay(month, 22);
    if (amexPaymentDate <= today) {
      const paymentAmount = Math.round((600 + Math.random() * 400) * 100) / 100; // £600-1000
      
      transactions.push({
        id: `t${transactionId++}`,
        date: amexPaymentDate,
        description: 'Credit Card Payment - American Express',
        amount: -Math.round(paymentAmount * 100) / 100, // Negative for money leaving
        type: 'transfer',
        category: 'cat-34', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and American Express',
        accountId: '2', // Natwest Current Account
        cleared: false
      });
      
      transactions.push({
        id: `t${transactionId++}`,
        date: amexPaymentDate,
        description: 'Payment Received - American Express',
        amount: Math.round(paymentAmount * 100) / 100,
        type: 'transfer',
        category: 'cat-34', // Specific transfer category
        categoryName: 'Transfers between Natwest Current Account and American Express',
        accountId: '9', // American Express
        cleared: false
      });
    }
  }

  // Sort transactions by date (newest first)
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return transactions;
};

export const getDefaultTestBudgets = (): Budget[] => {
  const now = new Date();
  return [
    {
      id: 'b1',
      category: 'Groceries',
      amount: 400,
      period: 'monthly',
      isActive: true,
      createdAt: now
    },
    {
      id: 'b2',
      category: 'Dining Out',
      amount: 200,
      period: 'monthly',
      isActive: true,
      createdAt: now
    },
    {
      id: 'b3',
      category: 'Entertainment',
      amount: 150,
      period: 'monthly',
      isActive: true,
      createdAt: now
    },
    {
      id: 'b4',
      category: 'Transport',
      amount: 250,
      period: 'monthly',
      isActive: true,
      createdAt: now
    },
    {
      id: 'b5',
      category: 'Shopping',
      amount: 300,
      period: 'monthly',
      isActive: true,
      createdAt: now
    }
  ];
};

export const getDefaultTestGoals = (): Goal[] => [
  {
    id: 'g1',
    name: 'Emergency Fund',
    type: 'savings',
    targetAmount: 15000,
    currentAmount: 12750,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    description: 'Build 6 months of expenses as emergency fund',
    linkedAccountIds: ['4', '5'],
    isActive: true,
    createdAt: new Date()
  },
  {
    id: 'g2',
    name: 'Pay Off Credit Cards',
    type: 'debt-payoff',
    targetAmount: 4445.67,
    currentAmount: 1500,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 8)),
    description: 'Clear all credit card debt',
    linkedAccountIds: ['8', '9'],
    isActive: true,
    createdAt: new Date()
  },
  {
    id: 'g3',
    name: 'Holiday Fund',
    type: 'savings',
    targetAmount: 3000,
    currentAmount: 450,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 10)),
    description: 'Save for summer holiday',
    linkedAccountIds: ['3'],
    isActive: true,
    createdAt: new Date()
  }
];