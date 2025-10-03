import { Page } from '@playwright/test';

export async function createAccount(
  page: Page,
  name: string,
  balance: string,
  type: string = 'checking'
) {
  await page.click('text=Accounts');
  await page.click('text=Add Account');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="balance"]', balance);
  await page.selectOption('select[name="type"]', type);
  await page.click('button[type="submit"]');
}

export async function createTransaction(
  page: Page,
  description: string,
  amount: string,
  type: 'income' | 'expense',
  category: string
) {
  await page.click('text=Transactions');
  await page.click('text=Add Transaction');
  await page.fill('input[name="description"]', description);
  await page.fill('input[name="amount"]', amount);
  await page.selectOption('select[name="type"]', type);
  await page.selectOption('select[name="category"]', category);
  await page.click('button[type="submit"]');
}

export async function createBudget(
  page: Page,
  category: string,
  amount: string,
  period: string = 'monthly'
) {
  await page.click('text=Budget');
  await page.click('text=Add Budget');
  await page.selectOption('select[name="category"]', category);
  await page.fill('input[name="amount"]', amount);
  await page.selectOption('select[name="period"]', period);
  await page.click('button[type="submit"]');
}

export async function createGoal(
  page: Page,
  name: string,
  targetAmount: string,
  currentAmount: string = '0',
  type: string = 'savings'
) {
  await page.click('text=Goals');
  await page.click('text=Add Goal');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="targetAmount"]', targetAmount);
  await page.fill('input[name="currentAmount"]', currentAmount);
  await page.selectOption('select[name="type"]', type);
  
  // Set target date to 1 year from now
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  await page.fill('input[name="targetDate"]', futureDate.toISOString().split('T')[0]);
  
  await page.click('button[type="submit"]');
}

export async function login(page: Page, email: string, password: string) {
  // If app has authentication
  if (await page.getByText('Login').isVisible()) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  }
}

export async function clearAllData(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

export async function waitForChartAnimation(page: Page) {
  // Wait for recharts animations to complete
  await page.waitForTimeout(500);
}

export async function expectCurrency(
  page: Page,
  amount: number,
  currency: string = 'USD'
) {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  
  const symbol = symbols[currency] || currency;
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return page.getByText(new RegExp(`\\${symbol}${formattedAmount}`));
}