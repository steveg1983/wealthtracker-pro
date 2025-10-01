import { generateTestData } from './generateTestData';
import { logger } from '../services/loggingService';

export function initializeAppData() {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined') {
      logger.error('LocalStorage not available');
      return generateTestData();
    }
    
    // Check for existing data
    const hasAccounts = localStorage.getItem('wealthtracker_accounts');
    const hasTransactions = localStorage.getItem('wealthtracker_transactions');
    const hasBudgets = localStorage.getItem('wealthtracker_budgets');
    
    // If no data exists, generate test data
    if (!hasAccounts && !hasTransactions && !hasBudgets) {
      logger.info('No existing data found, generating test data...');
      const testData = generateTestData();
      
      // Save to localStorage with error handling
      try {
        localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
        localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
        localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
        
        // Force default preferences on first load
        if (!localStorage.getItem('money_management_theme')) {
          localStorage.setItem('money_management_theme', 'dark');
        }
        if (!localStorage.getItem('money_management_accent_color')) {
          localStorage.setItem('money_management_accent_color', 'pink');
        }
      } catch (e) {
        logger.error('Error saving to localStorage:', e);
      }
      
      return testData;
    }
    
    // Load existing data
    return {
      accounts: hasAccounts ? JSON.parse(hasAccounts) : [],
      transactions: hasTransactions ? JSON.parse(hasTransactions) : [],
      budgets: hasBudgets ? JSON.parse(hasBudgets) : []
    };
  } catch (error) {
    logger.error('Error initializing app data:', error);
    return generateTestData();
  }
}
