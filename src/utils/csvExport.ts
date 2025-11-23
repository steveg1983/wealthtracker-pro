import type { Transaction, Account } from '../types';
import type { DecimalTransaction, DecimalAccount } from '../types/decimal-types';
import { toDecimal } from './decimal';
import { formatDecimal } from './decimal-format';

/**
 * Export transactions to CSV format
 * Handles both regular and decimal transactions
 */
export function exportTransactionsToCSV(
  transactions: Transaction[] | DecimalTransaction[],
  accounts: Account[] | DecimalAccount[]
): string {
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Account', 'Tags', 'Notes', 'Cleared'];
  
  const rows = transactions.map(t => {
    const account = accounts.find(a => a.id === t.accountId);
    const amountDecimal = typeof t.amount === 'number' ? toDecimal(t.amount) : toDecimal(t.amount);
    
    return [
      new Date(t.date).toISOString().split('T')[0], // YYYY-MM-DD format
      t.description,
      t.category,
      t.type,
      formatDecimal(amountDecimal, 2), // Always export with 2 decimal places
      account?.name || 'Unknown',
      t.tags?.join(';') || '', // Semicolon-separated tags
      t.notes || '',
      t.cleared ? 'Y' : 'N'
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
    .join('\n');

  return csv;
}

/**
 * Export accounts to CSV format
 * Handles both regular and decimal accounts
 */
export function exportAccountsToCSV(accounts: Account[] | DecimalAccount[]): string {
  const headers = ['Name', 'Type', 'Balance', 'Currency', 'Institution', 'Last Updated'];
  
  const rows = accounts.map(a => {
    const balanceDecimal = typeof a.balance === 'number' ? toDecimal(a.balance) : toDecimal(a.balance);
    
    return [
      a.name,
      a.type,
      formatDecimal(balanceDecimal, 2),
      a.currency || 'GBP',
      a.institution || '',
      new Date(a.lastUpdated).toISOString().split('T')[0]
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
    .join('\n');

  return csv;
}

/**
 * Create and download a CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
