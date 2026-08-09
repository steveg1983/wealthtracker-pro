import type { Transaction, Account, Category } from '../types';
import type { DecimalTransaction, DecimalAccount } from '../types/decimal-types';
import { toDecimal } from './decimal';
import { formatDecimal } from './decimal-format';
import { buildCategoryNameLookup } from './categoryNames';

/**
 * One CSV field, RFC 4180 quoted.
 *
 * EVERY field is quoted, unconditionally — not just the ones that happen to
 * contain a comma today. Conditional quoting has to ask "does this value need
 * it?", and that question was being asked of the value's TYPE rather than its
 * text: a tags array reached the file as `food,essential` and silently became
 * two columns, shifting every column after it on that row alone. Quoting
 * everything removes the question. It costs two bytes a field and is read
 * identically by Excel, Numbers, Sheets and every CSV parser.
 *
 * A null/undefined field is written as an empty quoted field, never the text
 * "null" — the only honest rendering of "nothing here".
 */
export function csvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** One CSV line: every field quoted, comma separated. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(',');
}

/** A whole CSV document from a header row plus body rows. */
export function csvDocument(rows: readonly (readonly unknown[])[]): string {
  return rows.map(csvRow).join('\n');
}

/**
 * Export transactions to CSV format
 * Handles both regular and decimal transactions
 *
 * Pass `categories` so the Category column carries the human name
 * ("Parent : Child") — a raw category id is a UUID and means nothing in a
 * spreadsheet. Without it the stored value is written through unchanged.
 */
export function exportTransactionsToCSV(
  transactions: Transaction[] | DecimalTransaction[],
  accounts: Account[] | DecimalAccount[],
  categories?: Category[]
): string {
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Account', 'Tags', 'Notes', 'Cleared'];
  const categoryName = categories ? buildCategoryNameLookup(categories) : null;

  const rows = transactions.map(t => {
    const account = accounts.find(a => a.id === t.accountId);
    const amountDecimal = typeof t.amount === 'number' ? toDecimal(t.amount) : toDecimal(t.amount);
    
    return [
      new Date(t.date).toISOString().split('T')[0], // YYYY-MM-DD format
      t.description,
      categoryName ? categoryName(t.category) : t.category,
      t.type,
      formatDecimal(amountDecimal, 2), // Always export with 2 decimal places
      account?.name || 'Unknown',
      t.tags?.join(';') || '', // Semicolon-separated tags
      t.notes || '',
      t.cleared ? 'Y' : 'N'
    ];
  });

  return csvDocument([headers, ...rows]);
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

  return csvDocument([headers, ...rows]);
}

/**
 * Write a text file to the user's disk. One implementation for every text
 * export this app produces — CSV, QIF, OFX — so the object URL is revoked
 * exactly once wherever the file came from.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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

/**
 * Create and download a CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  downloadTextFile(content, filename, 'text/csv;charset=utf-8;');
}
