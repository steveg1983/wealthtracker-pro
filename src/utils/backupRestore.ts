import type { Account, Transaction, Budget, Goal, Category, RecurringTransaction } from '../types';

export interface BackupData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories?: Category[];
  recurringTransactions?: RecurringTransaction[];
  tags?: string[];
  exportDate: string;
  version: string;
}

/**
 * Validate backup data structure
 */
export function validateBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as any;
  
  // Check required fields
  if (!Array.isArray(obj.accounts)) return false;
  if (!Array.isArray(obj.transactions)) return false;
  if (!Array.isArray(obj.budgets)) return false;
  if (!Array.isArray(obj.goals)) return false;
  if (!obj.version || typeof obj.version !== 'string') return false;
  
  // Basic validation of array contents
  for (const account of obj.accounts) {
    if (!account.id || !account.name || typeof account.balance !== 'number') return false;
  }
  
  for (const transaction of obj.transactions) {
    if (!transaction.id || !transaction.date || typeof transaction.amount !== 'number') return false;
  }
  
  return true;
}

/**
 * Import backup data from JSON file
 */
export async function importBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (!validateBackupData(data)) {
          throw new Error('Invalid backup file format');
        }
        
        resolve(data);
      } catch (error) {
        reject(new Error('Failed to parse backup file: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read backup file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Create a backup filename with current date
 */
export function createBackupFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `wealthtracker-backup-${date}.json`;
}