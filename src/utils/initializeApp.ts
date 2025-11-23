import { generateTestData } from './generateTestData';
import { createScopedLogger } from '../loggers/scopedLogger';

const initLogger = createScopedLogger('InitializeApp');

export function initializeAppData() {
  try {
    if (typeof Storage === 'undefined') {
      initLogger.error('LocalStorage not available');
      return generateTestData();
    }

    const hasAccounts = localStorage.getItem('wealthtracker_accounts');
    const hasTransactions = localStorage.getItem('wealthtracker_transactions');
    const hasBudgets = localStorage.getItem('wealthtracker_budgets');

    if (!hasAccounts && !hasTransactions && !hasBudgets) {
      initLogger.info('No existing data found, generating test data...');
      const testData = generateTestData();

      try {
        localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
        localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
        localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));

        if (!localStorage.getItem('money_management_theme')) {
          localStorage.setItem('money_management_theme', 'dark');
        }
        if (!localStorage.getItem('money_management_accent_color')) {
          localStorage.setItem('money_management_accent_color', 'pink');
        }
      } catch (error) {
        initLogger.error('Error saving generated test data to localStorage', error);
      }

      return testData;
    }

    return {
      accounts: hasAccounts ? JSON.parse(hasAccounts) : [],
      transactions: hasTransactions ? JSON.parse(hasTransactions) : [],
      budgets: hasBudgets ? JSON.parse(hasBudgets) : []
    };
  } catch (error) {
    initLogger.error('Error initializing app data', error);
    return generateTestData();
  }
}
