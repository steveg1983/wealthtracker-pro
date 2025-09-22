import { toDecimal } from './decimal';
import type { Transaction, Account } from '../types';
import { lazyLogger as logger } from '../services/serviceFactory';

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
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
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
    if (row.length < 5) continue; // Skip incomplete rows
    
    try {
      const dateStr = dateIndex >= 0 ? row[dateIndex] : '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue; // Skip invalid dates
      
      const description = descIndex >= 0 ? row[descIndex] : 'Imported transaction';
      const category = categoryIndex >= 0 ? row[categoryIndex] : 'Other';
      const type = typeIndex >= 0 ? row[typeIndex].toLowerCase() as 'income' | 'expense' : 'expense';
      const amountStr = amountIndex >= 0 ? row[amountIndex] : '0';
      const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0);
      
      // Find account ID
      const accountName = accountIndex >= 0 ? row[accountIndex] : '';
      const accountId = accountMap.get(accountName) || Array.from(accountMap.values())[0] || 'default';
      
      // Parse optional fields
      const tags = tagsIndex >= 0 && row[tagsIndex] ? row[tagsIndex].split(';').map(t => t.trim()) : undefined;
      const notes = notesIndex >= 0 ? row[notesIndex] : undefined;
      const cleared = clearedIndex >= 0 ? row[clearedIndex].toLowerCase() === 'y' || row[clearedIndex] === '1' : false;
      
      transactions.push({
        date,
        description,
        category,
        type,
        amount,
        accountId,
        tags,
        notes,
        cleared
      });
    } catch (error) {
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
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
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
    if (row.length < 3) continue; // Need at least name, type, and balance
    
    try {
      const name = nameIndex >= 0 ? row[nameIndex] : '';
      if (!name) continue;
      
      const typeStr = typeIndex >= 0 ? row[typeIndex].toLowerCase() : 'current';
      const type = (['current', 'savings', 'credit', 'loan', 'investment', 'assets'].includes(typeStr) ? typeStr : 'current') as Account['type'];
      
      const balanceStr = balanceIndex >= 0 ? row[balanceIndex] : '0';
      const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || 0;
      
      const currency = currencyIndex >= 0 ? row[currencyIndex] || 'GBP' : 'GBP';
      const institution = institutionIndex >= 0 ? row[institutionIndex] : undefined;
      
      accounts.push({
        name,
        type,
        balance,
        currency,
        institution
      });
    } catch (error) {
    }
  }
  
  return accounts;
}