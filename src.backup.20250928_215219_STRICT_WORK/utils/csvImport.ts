import { toDecimal } from './decimal';
import type { Transaction, Account } from '../types';
import { logger } from '../services/loggingService';

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): string[][] {
  const lines = content.trim().split('\n');
  const rows: string[][] = [];
  
  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    row.push(current);
    rows.push(row);
  }
  
  return rows;
}

/**
 * Import transactions from CSV
 * Returns transactions with amounts as numbers (will be converted to Decimal in AppContext)
 */
export function importTransactionsFromCSV(
  content: string,
  accountMap: Map<string, string>
): Omit<Transaction, 'id'>[] {
  const rows = parseCSV(content);
  if (rows.length < 2) return []; // Need at least headers and one row

  const firstRow = rows[0];
  if (!firstRow) return [];
  const headers = firstRow.map(h => h.toLowerCase().trim());
  const transactions: Omit<Transaction, 'id'>[] = [];
  
  // Find column indices
  const dateIndex = headers.findIndex(h => h.includes('date'));
  const descIndex = headers.findIndex(h => h.includes('description') || h.includes('desc'));
  const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('cat'));
  const typeIndex = headers.findIndex(h => h.includes('type'));
  const amountIndex = headers.findIndex(h => h.includes('amount'));
  const accountIndex = headers.findIndex(h => h.includes('account'));
  const tagsIndex = headers.findIndex(h => h.includes('tag'));
  const notesIndex = headers.findIndex(h => h.includes('note'));
  const clearedIndex = headers.findIndex(h => h.includes('clear') || h.includes('reconcile'));
  
  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue; // Skip incomplete rows

    try {
      const dateStr = dateIndex >= 0 ? (row[dateIndex] || '') : '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue; // Skip invalid dates

      const description = descIndex >= 0 ? (row[descIndex] || 'Imported transaction') : 'Imported transaction';
      const category = categoryIndex >= 0 ? (row[categoryIndex] || 'Other') : 'Other';
      const typeRaw = typeIndex >= 0 ? (row[typeIndex] || 'expense') : 'expense';
      const type = typeRaw.toLowerCase() as 'income' | 'expense';
      const amountStr = amountIndex >= 0 ? (row[amountIndex] || '0') : '0';
      const amount = Math.abs(parseFloat((amountStr || '0').replace(/[^0-9.-]/g, '')) || 0);
      
      // Find account ID
      const accountName: string = accountIndex >= 0 ? (row[accountIndex] ?? '') : '';
      const accountId = accountMap.get(accountName) || Array.from(accountMap.values())[0] || 'default';
      
      // Parse optional fields
      const tagsRaw = tagsIndex >= 0 ? row[tagsIndex] : undefined;
      const tags = tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : undefined;
      const notes = notesIndex >= 0 ? row[notesIndex] : undefined;
      const clearedRaw = clearedIndex >= 0 ? row[clearedIndex] : '';
      const cleared = clearedRaw ? (clearedRaw.toLowerCase() === 'y' || clearedRaw === '1') : false;
      
      const transaction: Omit<Transaction, 'id'> = {
        date,
        description,
        category,
        type,
        amount,
        accountId,
        cleared
      };

      if (tags && tags.length > 0) {
        transaction.tags = tags;
      }

      if (notes && notes.trim().length > 0) {
        transaction.notes = notes;
      }

      transactions.push(transaction);
    } catch (error) {
      logger.error(`Error parsing row ${i}:`, error);
      // Skip problematic rows
    }
  }
  
  return transactions;
}

/**
 * Import accounts from CSV
 * Returns accounts with balances as numbers (will be converted to Decimal in AppContext)
 */
export function importAccountsFromCSV(content: string): Omit<Account, 'id' | 'lastUpdated'>[] {
  const rows = parseCSV(content);
  if (rows.length < 2) return [];
  
  const headerRow = rows[0];
  if (!headerRow) return [];

  const headers = headerRow.map(h => h.toLowerCase().trim());
  const accounts: Omit<Account, 'id' | 'lastUpdated'>[] = [];
  
  // Find column indices
  const nameIndex = headers.findIndex(h => h.includes('name'));
  const typeIndex = headers.findIndex(h => h.includes('type'));
  const balanceIndex = headers.findIndex(h => h.includes('balance'));
  const currencyIndex = headers.findIndex(h => h.includes('currency') || h.includes('curr'));
  const institutionIndex = headers.findIndex(h => h.includes('institution') || h.includes('bank'));
  
  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue; // Need at least name, type, and balance
    
    try {
      const name = nameIndex >= 0 ? row[nameIndex] : '';
      if (!name) continue;
      
      const typeRaw = typeIndex >= 0 ? row[typeIndex] : 'current';
      const typeStr = (typeRaw || 'current').toLowerCase();
      const type = (['current', 'savings', 'credit', 'loan', 'investment', 'assets'].includes(typeStr) ? typeStr : 'current') as Account['type'];
      
      const balanceStr: string = balanceIndex >= 0 ? row[balanceIndex] ?? '0' : '0';
      const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || 0;
      
      const currency = currencyIndex >= 0 ? row[currencyIndex] || 'GBP' : 'GBP';
      const institution = institutionIndex >= 0 ? row[institutionIndex] : undefined;
      
      const account: Omit<Account, 'id' | 'lastUpdated'> = {
        name,
        type,
        balance,
        currency
      };

      if (institution && institution.trim().length > 0) {
        account.institution = institution;
      }

      accounts.push(account);
    } catch (error) {
      logger.error(`Error parsing account row ${i}:`, error);
    }
  }
  
  return accounts;
}
