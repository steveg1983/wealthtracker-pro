import type { Transaction } from '../types';

// Helper functions
function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Daily spending categories and ranges
const SPENDING_PATTERNS = {
  groceries: { min: 20, max: 80, frequency: 3, cards: ['5', '6'] }, // 3 times per week
  restaurants: { min: 25, max: 120, frequency: 2, cards: ['5', '6'] }, // 2 times per week
  transport: { min: 15, max: 50, frequency: 2, cards: ['5', '6'] }, // 2 times per week
  shopping: { min: 30, max: 200, frequency: 1, cards: ['5', '6'] }, // 1 time per week
  entertainment: { min: 20, max: 100, frequency: 1, cards: ['5', '6'] }, // 1 time per week
  online: { min: 15, max: 150, frequency: 2, cards: ['5', '6'] }, // 2 times per week
  coffee: { min: 3, max: 8, frequency: 5, cards: ['5', '6'] }, // 5 times per week
  subscriptions: { min: 9.99, max: 19.99, frequency: 0.25, cards: ['6'] }, // monthly
  fuel: { min: 50, max: 80, frequency: 0.5, cards: ['5'] }, // twice per month
};

const CATEGORY_NAMES = {
  groceries: 'Groceries',
  restaurants: 'Dining Out',
  transport: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  online: 'Online Shopping',
  coffee: 'Coffee Shops',
  subscriptions: 'Subscriptions',
  fuel: 'Fuel'
};

const MERCHANT_NAMES = {
  groceries: ['Tesco', 'Sainsbury\'s', 'Waitrose', 'ASDA', 'Morrisons', 'Lidl', 'Aldi'],
  restaurants: ['Pizza Express', 'Nando\'s', 'Wagamama', 'The Ivy', 'Dishoom', 'Franco Manca'],
  transport: ['Uber', 'TfL', 'National Rail', 'Addison Lee', 'Citymapper'],
  shopping: ['John Lewis', 'M&S', 'Zara', 'H&M', 'Next', 'Selfridges', 'ASOS'],
  entertainment: ['Odeon', 'Vue Cinema', 'National Theatre', 'O2 Arena', 'Ticketmaster'],
  online: ['Amazon', 'eBay', 'Argos', 'Currys', 'Apple Store'],
  coffee: ['Pret', 'Starbucks', 'Costa', 'Nero', 'Gail\'s'],
  subscriptions: ['Netflix', 'Spotify', 'Amazon Prime', 'Disney+', 'Apple Music'],
  fuel: ['Shell', 'BP', 'Esso', 'Texaco']
};

// Monthly bills (paid from Current Account on 1st)
const MONTHLY_BILLS = [
  { description: 'Council Tax', amount: 180, category: 'Bills' },
  { description: 'Gas & Electric', amount: 150, category: 'Utilities' },
  { description: 'Water Bill', amount: 45, category: 'Utilities' },
  { description: 'Internet & Phone', amount: 55, category: 'Utilities' },
  { description: 'Mobile Phone', amount: 35, category: 'Bills' },
  { description: 'Home Insurance', amount: 65, category: 'Insurance' },
  { description: 'Life Insurance', amount: 45, category: 'Insurance' },
  { description: 'Car Insurance', amount: 85, category: 'Insurance' },
  { description: 'Gym Membership', amount: 55, category: 'Health & Fitness' }
];

export function generateMonthlyTransactions(
  year: number,
  month: number,
  transactionIdStart: number
): { transactions: Transaction[], creditCardBalances: { natwest: number, amex: number }, nextId: number } {
  const transactions: Transaction[] = [];
  let transactionId = transactionIdStart;
  let natwesrCreditBalance = 0;
  let amexBalance = 0;
  
  const monthStart = new Date(year, month, 1);
  const monthEnd = getMonthEnd(year, month);
  const daysInMonth = monthEnd.getDate();
  
  // 1. Salary on 1st
  transactions.push({
    id: `t${transactionId++}`,
    date: monthStart,
    description: 'Monthly Salary',
    amount: 6000,
    type: 'income',
    category: 'Salary',
    accountId: '1', // Natwest Current
    cleared: true
  });
  
  // 2. Mortgage payment on 1st
  transactions.push({
    id: `t${transactionId++}`,
    date: monthStart,
    description: 'Mortgage Payment',
    amount: -1200,
    type: 'transfer',
    category: 'transfer',
    accountId: '1', // Natwest Current (OUT)
    cleared: true
  });
  transactions.push({
    id: `t${transactionId++}`,
    date: monthStart,
    description: 'Mortgage Payment',
    amount: 1200,
    type: 'transfer',
    category: 'transfer',
    accountId: '8', // Natwest Mortgage (IN)
    cleared: true
  });
  
  // 3. Monthly bills on 1st
  MONTHLY_BILLS.forEach(bill => {
    transactions.push({
      id: `t${transactionId++}`,
      date: monthStart,
      description: bill.description,
      amount: bill.amount,
      type: 'expense',
      category: bill.category,
      accountId: '1', // Natwest Current
      cleared: true
    });
  });
  
  // 4. Generate daily spending throughout the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();
    
    // Skip some random days (people don't spend every single day)
    if (Math.random() > 0.85) continue;
    
    Object.entries(SPENDING_PATTERNS).forEach(([category, pattern]) => {
      // Determine if this category happens today
      let shouldHappen = false;
      
      if (pattern.frequency >= 1) {
        // Weekly frequency - distribute throughout the week
        const daysPerWeek = Math.floor(7 / pattern.frequency);
        shouldHappen = dayOfWeek % daysPerWeek === 0;
      } else {
        // Monthly frequency
        const dayOfMonth = Math.floor(1 / pattern.frequency);
        shouldHappen = day === dayOfMonth;
      }
      
      // Add some randomness
      if (shouldHappen && Math.random() < 0.8) {
        const amount = randomBetween(pattern.min, pattern.max);
        const cardId = pattern.cards[Math.floor(Math.random() * pattern.cards.length)];
        const merchants = MERCHANT_NAMES[category as keyof typeof MERCHANT_NAMES];
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        
        transactions.push({
          id: `t${transactionId++}`,
          date: currentDate,
          description: merchant,
          amount: amount,
          type: 'expense',
          category: CATEGORY_NAMES[category as keyof typeof CATEGORY_NAMES],
          accountId: cardId,
          cleared: day < daysInMonth - 2 // Not cleared if very recent
        });
        
        // Track credit card balances
        if (cardId === '5') {
          natwesrCreditBalance += amount;
        } else if (cardId === '6') {
          amexBalance += amount;
        }
      }
    });
  }
  
  return {
    transactions,
    creditCardBalances: { natwest: natwesrCreditBalance, amex: amexBalance },
    nextId: transactionId
  };
}

export function generateCreditCardPayments(
  year: number,
  month: number,
  previousBalances: { natwest: number, amex: number },
  transactionIdStart: number
): { transactions: Transaction[], nextId: number } {
  const transactions: Transaction[] = [];
  let transactionId = transactionIdStart;
  
  // Payment date is 14th of the month
  const paymentDate = new Date(year, month, 14);
  
  // Pay off Natwest Credit Card
  if (previousBalances.natwest > 0) {
    transactions.push({
      id: `t${transactionId++}`,
      date: paymentDate,
      description: 'Credit Card Payment - Natwest',
      amount: -previousBalances.natwest,
      type: 'transfer',
      category: 'transfer',
      accountId: '1', // Natwest Current (OUT)
      cleared: true
    });
    transactions.push({
      id: `t${transactionId++}`,
      date: paymentDate,
      description: 'Credit Card Payment - Natwest',
      amount: previousBalances.natwest,
      type: 'transfer',
      category: 'transfer',
      accountId: '5', // Natwest Credit Card (IN)
      cleared: true
    });
  }
  
  // Pay off Amex
  if (previousBalances.amex > 0) {
    transactions.push({
      id: `t${transactionId++}`,
      date: paymentDate,
      description: 'Credit Card Payment - American Express',
      amount: -previousBalances.amex,
      type: 'transfer',
      category: 'transfer',
      accountId: '1', // Natwest Current (OUT)
      cleared: true
    });
    transactions.push({
      id: `t${transactionId++}`,
      date: paymentDate,
      description: 'Credit Card Payment - American Express',
      amount: previousBalances.amex,
      type: 'transfer',
      category: 'transfer',
      accountId: '6', // Amex (IN)
      cleared: true
    });
  }
  
  return { transactions, nextId: transactionId };
}

export function calculateCurrentAccountBalance(
  transactions: Transaction[],
  accountId: string
): number {
  return transactions
    .filter(t => t.accountId === accountId)
    .reduce((balance, t) => {
      if (t.type === 'income' || (t.type === 'transfer' && t.amount > 0)) {
        return balance + t.amount;
      } else {
        return balance - Math.abs(t.amount);
      }
    }, 0);
}

export function generateBalanceSweep(
  year: number,
  month: number,
  currentAccountBalance: number,
  transactionIdStart: number
): { transactions: Transaction[], nextId: number } {
  const transactions: Transaction[] = [];
  let transactionId = transactionIdStart;
  
  const sweepDate = getMonthEnd(year, month);
  
  if (currentAccountBalance > 0.01) {
    // Transfer excess to savings
    transactions.push({
      id: `t${transactionId++}`,
      date: sweepDate,
      description: 'Balance Sweep to Savings',
      amount: -currentAccountBalance,
      type: 'transfer',
      category: 'transfer',
      accountId: '1', // Natwest Current (OUT)
      cleared: true
    });
    transactions.push({
      id: `t${transactionId++}`,
      date: sweepDate,
      description: 'Balance Sweep from Current',
      amount: currentAccountBalance,
      type: 'transfer',
      category: 'transfer',
      accountId: '3', // Natwest Savings (IN)
      cleared: true
    });
  } else if (currentAccountBalance < -0.01) {
    // Transfer from savings to cover deficit
    const amountNeeded = Math.abs(currentAccountBalance);
    transactions.push({
      id: `t${transactionId++}`,
      date: sweepDate,
      description: 'Balance Transfer from Savings',
      amount: -amountNeeded,
      type: 'transfer',
      category: 'transfer',
      accountId: '3', // Natwest Savings (OUT)
      cleared: true
    });
    transactions.push({
      id: `t${transactionId++}`,
      date: sweepDate,
      description: 'Balance Transfer to Current',
      amount: amountNeeded,
      type: 'transfer',
      category: 'transfer',
      accountId: '1', // Natwest Current (IN)
      cleared: true
    });
  }
  
  return { transactions, nextId: transactionId };
}