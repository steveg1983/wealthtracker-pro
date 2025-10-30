// Import types from main types file
import type { Account, Transaction, Budget, Goal, Investment, Holding } from '../types';
import { 
  generateMonthlyTransactions, 
  generateCreditCardPayments, 
  generateBalanceSweep, 
  calculateCurrentAccountBalance 
} from './generateTransactions';

// Account opening date: 01/07/2024
const ACCOUNT_OPENING_DATE = new Date('2024-07-01');

// Helper function to get month end date
function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

// Stock/Fund prices as of 01/07/2024 (researched approximate values)
const PORTFOLIO_PRICES = {
  // FTSE 100 Shares (in GBP)
  'LLOY.L': { symbol: 'LLOY', name: 'Lloyds Banking Group', price: 0.54 }, // ~54p
  'BARC.L': { symbol: 'BARC', name: 'Barclays', price: 2.10 }, // ~210p
  'BP.L': { symbol: 'BP', name: 'BP', price: 4.85 }, // ~485p
  'GSK.L': { symbol: 'GSK', name: 'GlaxoSmithKline', price: 16.50 }, // ~1650p
  'AZN.L': { symbol: 'AZN', name: 'AstraZeneca', price: 124.00 }, // ~12400p
  
  // US Tech Shares (in USD, converted to GBP at ~1.27)
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc', price: 154.72 }, // ~$197 / 1.27
  'MSFT': { symbol: 'MSFT', name: 'Microsoft Corp', price: 355.90 }, // ~$452 / 1.27
  'GOOGL': { symbol: 'GOOGL', name: 'Alphabet Inc', price: 142.52 }, // ~$181 / 1.27
  'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corp', price: 96.06 }, // ~$122 / 1.27
  
  // Funds (in GBP)
  'VWRL': { symbol: 'VWRL', name: 'Vanguard FTSE All-World ETF', price: 108.50 },
  'SMT': { symbol: 'SMT', name: 'Scottish Mortgage Trust', price: 8.45 },
  'CTY': { symbol: 'CTY', name: 'City of London Investment Trust', price: 4.25 }
};

// Helper function to convert investments to holdings
const convertInvestmentsToHoldings = (investments: Investment[]): Holding[] => {
  return investments.map(inv => ({
    ticker: inv.symbol,
    name: inv.name,
    shares: inv.quantity,
    value: inv.quantity * inv.purchasePrice,
    averageCost: inv.averageCost || inv.purchasePrice,
    currentPrice: inv.currentPrice,
    marketValue: inv.currentValue,
    gain: inv.currentValue - (inv.quantity * inv.purchasePrice),
    gainPercent: ((inv.currentValue - (inv.quantity * inv.purchasePrice)) / (inv.quantity * inv.purchasePrice)) * 100,
    currency: 'GBP',
    lastUpdated: inv.lastUpdated
  }));
};

export const getDefaultTestAccounts = (): Account[] => {
  return [
    // Current Accounts
    {
      id: '1',
      name: 'Natwest Current Account',
      type: 'current',
      balance: 0,
      currency: 'GBP',
      institution: 'Natwest',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    {
      id: '2',
      name: 'Monzo Current Account',
      type: 'current',
      balance: 0,
      currency: 'GBP',
      institution: 'Monzo',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    
    // Savings Accounts
    {
      id: '3',
      name: 'Natwest Savings Account',
      type: 'savings',
      balance: 0,
      currency: 'GBP',
      institution: 'Natwest',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    {
      id: '4',
      name: 'NS&I Premium Bonds',
      type: 'savings',
      balance: 0,
      currency: 'GBP',
      institution: 'NS&I',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    
    // Credit Cards
    {
      id: '5',
      name: 'Natwest Credit Card',
      type: 'credit',
      balance: 0,
      currency: 'GBP',
      institution: 'Natwest',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    {
      id: '6',
      name: 'American Express Gold',
      type: 'credit',
      balance: 0,
      currency: 'GBP',
      institution: 'American Express',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    
    // Loans
    {
      id: '7',
      name: 'Natwest Personal Loan',
      type: 'loan',
      balance: 0,
      currency: 'GBP',
      institution: 'Natwest',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    {
      id: '8',
      name: 'Natwest Mortgage',
      type: 'mortgage',
      balance: 0,
      currency: 'GBP',
      institution: 'Natwest',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    
    // Investment Accounts
    {
      id: '9',
      name: 'Hargreaves Lansdown SIPP',
      type: 'investment',
      balance: 0, // Will be calculated from holdings
      currency: 'GBP',
      institution: 'Hargreaves Lansdown',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE,
      holdings: convertInvestmentsToHoldings(getDefaultTestInvestments().filter(inv => inv.accountId === '9'))
    },
    {
      id: '10',
      name: 'Hargreaves Lansdown ISA',
      type: 'investment',
      balance: 0,
      currency: 'GBP',
      institution: 'Hargreaves Lansdown',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    {
      id: '11',
      name: 'City Trader Account',
      type: 'investment',
      balance: 10000, // Opening balance as requested
      currency: 'GBP',
      institution: 'City Trading',
      lastUpdated: new Date(),
      openingBalance: 10000,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    },
    
    // Assets
    {
      id: '12',
      name: 'Primary Residence',
      type: 'asset',
      balance: 0,
      currency: 'GBP',
      institution: 'Property',
      lastUpdated: new Date(),
      openingBalance: 0,
      openingBalanceDate: ACCOUNT_OPENING_DATE
    }
  ];
};

export const getDefaultTestInvestments = (): Investment[] => {
  // Calculate quantities to reach ~£150,000 total
  return [
    // FTSE 100 Shares (~£40,000)
    {
      id: 'inv1',
      accountId: '9', // SIPP
      symbol: 'LLOY.L',
      name: 'Lloyds Banking Group',
      quantity: 20000,
      purchasePrice: 0.54,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 0.56,
      lastUpdated: new Date(),
      currentValue: 20000 * 0.56,
      averageCost: 0.54,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv2',
      accountId: '9',
      symbol: 'BARC.L',
      name: 'Barclays',
      quantity: 3000,
      purchasePrice: 2.10,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 2.15,
      lastUpdated: new Date(),
      currentValue: 3000 * 2.15,
      averageCost: 2.10,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv3',
      accountId: '9',
      symbol: 'BP.L',
      name: 'BP',
      quantity: 2000,
      purchasePrice: 4.85,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 4.90,
      lastUpdated: new Date(),
      currentValue: 2000 * 4.90,
      averageCost: 4.85,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv4',
      accountId: '9',
      symbol: 'GSK.L',
      name: 'GlaxoSmithKline',
      quantity: 800,
      purchasePrice: 16.50,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 16.75,
      lastUpdated: new Date(),
      currentValue: 800 * 16.75,
      averageCost: 16.50,
      createdAt: ACCOUNT_OPENING_DATE
    },
    
    // US Tech Shares (~£60,000)
    {
      id: 'inv5',
      accountId: '9',
      symbol: 'AAPL',
      name: 'Apple Inc',
      quantity: 100,
      purchasePrice: 154.72,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 158.50,
      lastUpdated: new Date(),
      currentValue: 100 * 158.50,
      averageCost: 154.72,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv6',
      accountId: '9',
      symbol: 'MSFT',
      name: 'Microsoft Corp',
      quantity: 50,
      purchasePrice: 355.90,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 365.00,
      lastUpdated: new Date(),
      currentValue: 50 * 365.00,
      averageCost: 355.90,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv7',
      accountId: '9',
      symbol: 'GOOGL',
      name: 'Alphabet Inc',
      quantity: 100,
      purchasePrice: 142.52,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 145.00,
      lastUpdated: new Date(),
      currentValue: 100 * 145.00,
      averageCost: 142.52,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv8',
      accountId: '9',
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      quantity: 100,
      purchasePrice: 96.06,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 98.50,
      lastUpdated: new Date(),
      currentValue: 100 * 98.50,
      averageCost: 96.06,
      createdAt: ACCOUNT_OPENING_DATE
    },
    
    // Funds (~£50,000)
    {
      id: 'inv9',
      accountId: '9',
      symbol: 'VWRL',
      name: 'Vanguard FTSE All-World ETF',
      quantity: 250,
      purchasePrice: 108.50,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 110.00,
      lastUpdated: new Date(),
      currentValue: 250 * 110.00,
      averageCost: 108.50,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv10',
      accountId: '9',
      symbol: 'SMT',
      name: 'Scottish Mortgage Trust',
      quantity: 2000,
      purchasePrice: 8.45,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 8.60,
      lastUpdated: new Date(),
      currentValue: 2000 * 8.60,
      averageCost: 8.45,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: 'inv11',
      accountId: '9',
      symbol: 'CTY',
      name: 'City of London Investment Trust',
      quantity: 1500,
      purchasePrice: 4.25,
      purchaseDate: ACCOUNT_OPENING_DATE,
      currentPrice: 4.30,
      lastUpdated: new Date(),
      currentValue: 1500 * 4.30,
      averageCost: 4.25,
      createdAt: ACCOUNT_OPENING_DATE
    }
  ];
};


export const getDefaultTestTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  let transactionId = 1;
  
  // Initial setup transactions on 01/07/2024
  const setupDate = new Date('2024-07-01');
  
  // 1. Mortgage Loan
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Mortgage Loan',
    amount: -200000,
    type: 'transfer',
    category: 'transfer',
    accountId: '8', // Natwest Mortgage (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Mortgage Loan',
    amount: 200000,
    type: 'transfer',
    category: 'transfer',
    accountId: '12', // Primary Residence (IN)
    cleared: true
  });
  
  // 2. Personal Loan
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Personal Loan',
    amount: -50000,
    type: 'transfer',
    category: 'transfer',
    accountId: '7', // Natwest Personal Loan (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Personal Loan',
    amount: 50000,
    type: 'transfer',
    category: 'transfer',
    accountId: '1', // Natwest Current Account (IN)
    cleared: true
  });
  
  // 3. House Deposit
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'House Deposit',
    amount: -20000,
    type: 'transfer',
    category: 'transfer',
    accountId: '1', // Natwest Current Account (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'House Deposit',
    amount: 20000,
    type: 'transfer',
    category: 'transfer',
    accountId: '12', // Primary Residence (IN)
    cleared: true
  });
  
  // 4. Hargreaves ISA
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Hargreaves ISA',
    amount: -20000,
    type: 'transfer',
    category: 'transfer',
    accountId: '1', // Natwest Current Account (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'Hargreaves ISA',
    amount: 20000,
    type: 'transfer',
    category: 'transfer',
    accountId: '10', // Hargreaves Lansdown ISA (IN)
    cleared: true
  });
  
  // 5. Premium Bonds
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'NS&I Premium Bonds',
    amount: -10000,
    type: 'transfer',
    category: 'transfer',
    accountId: '1', // Natwest Current Account (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: setupDate,
    description: 'NS&I Premium Bonds',
    amount: 10000,
    type: 'transfer',
    category: 'transfer',
    accountId: '4', // NS&I Premium Bonds (IN)
    cleared: true
  });
  
  // Investment purchases for SIPP on 01/07/2024
  const investments = getDefaultTestInvestments();
  investments.forEach(inv => {
    const baseCost = inv.quantity * inv.purchasePrice;
    // Add typical UK transaction fees and stamp duty (0.5% for UK shares)
    const transactionFee = 24.95; // Typical broker fee
    const stampDuty = inv.symbol.endsWith('.L') ? baseCost * 0.005 : 0; // 0.5% stamp duty for UK shares
    const totalCost = baseCost + transactionFee + stampDuty;
    
    transactions.push({
      id: `t${transactionId++}`,
      date: setupDate,
      description: `Buy ${inv.quantity} ${inv.symbol}`,
      amount: -totalCost,
      type: 'expense',
      category: 'Investments',
      accountId: inv.accountId,
      cleared: true,
      investmentData: {
        symbol: inv.symbol,
        quantity: inv.quantity,
        pricePerShare: inv.purchasePrice,
        transactionFee: transactionFee,
        stampDuty: stampDuty,
        totalCost: totalCost
      }
    });
  });
  
  // Generate 12 months of transactions from July 2024 to June 2025
  let previousCreditBalances = { natwest: 0, amex: 0 };
  
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const year = 2024 + Math.floor((6 + monthOffset) / 12); // Start from July 2024
    const month = (6 + monthOffset) % 12; // 6 = July (0-indexed)
    
    // Don't generate future transactions
    const monthDate = new Date(year, month, 1);
    if (monthDate > new Date()) break;
    
    // Generate monthly transactions
    const monthlyResult = generateMonthlyTransactions(year, month, transactionId);
    transactions.push(...monthlyResult.transactions);
    transactionId = monthlyResult.nextId;
    
    // Generate credit card payments on 14th (for previous month's balances)
    if (monthOffset > 0) {
      const paymentResult = generateCreditCardPayments(
        year, 
        month, 
        previousCreditBalances, 
        transactionId
      );
      transactions.push(...paymentResult.transactions);
      transactionId = paymentResult.nextId;
    }
    
    // Calculate current account balance before sweep
    const currentBalance = calculateCurrentAccountBalance(
      transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate <= getMonthEnd(year, month);
      }),
      '1' // Natwest Current Account
    );
    
    // Generate balance sweep at month end
    const sweepResult = generateBalanceSweep(year, month, currentBalance, transactionId);
    transactions.push(...sweepResult.transactions);
    transactionId = sweepResult.nextId;
    
    // Store credit card balances for next month's payment
    previousCreditBalances = monthlyResult.creditCardBalances;
  }
  
  return transactions;
};

export const getDefaultTestBudgets = (): Budget[] => {
  return [
    {
      id: '1',
      category: 'Groceries',
      amount: 600,
      period: 'monthly',
      isActive: true,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: '2',
      category: 'Transport',
      amount: 300,
      period: 'monthly',
      isActive: true,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: '3',
      category: 'Utilities',
      amount: 200,
      period: 'monthly',
      isActive: true,
      createdAt: ACCOUNT_OPENING_DATE
    },
    {
      id: '4',
      category: 'Entertainment',
      amount: 400,
      period: 'monthly',
      isActive: true,
      createdAt: ACCOUNT_OPENING_DATE
    }
  ];
};

export const getDefaultTestGoals = (): Goal[] => {
  return [
    {
      id: '1',
      name: 'Emergency Fund',
      targetAmount: 20000,
      currentAmount: 10000,
      targetDate: new Date('2025-12-31'),
      type: 'savings',
      createdAt: ACCOUNT_OPENING_DATE,
      isActive: true
    },
    {
      id: '2',
      name: 'Holiday Fund',
      targetAmount: 5000,
      currentAmount: 2000,
      targetDate: new Date('2025-08-01'),
      type: 'savings',
      createdAt: ACCOUNT_OPENING_DATE,
      isActive: true
    }
  ];
};