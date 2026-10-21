/**
 * A ledger in memory, behind the connector's port — what the server specs
 * drive the real MCP client against. Every figure invented (public repo).
 */

import type { Budget, Category, Transaction, TransactionSplit } from '../../../types';
import { isAwaitingReview } from '../../../utils/transactionReview';
import type {
  PortAccount,
  ReckleyPort,
  TransactionFilter,
} from '../../../../api/_lib/mcp/port';

export const accounts: PortAccount[] = [
  { id: 'acc-current', name: 'Current Account', type: 'checking', currency: 'GBP', isActive: true, institution: 'Example Bank', balance: 1234.56, bankBalance: 1230.00, bankBalanceDate: '2026-10-14', lastReconciledDate: '2026-09-30' },
  { id: 'acc-savings', name: 'Savings', type: 'savings', currency: 'GBP', isActive: true, institution: null, balance: 5000, bankBalance: null, bankBalanceDate: null, lastReconciledDate: null },
  { id: 'acc-old', name: 'Old Card', type: 'credit', currency: 'GBP', isActive: false, institution: null, balance: 0, bankBalance: null, bankBalanceDate: null, lastReconciledDate: null },
];

export const categories: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'sub-bills', name: 'Bills (Household)', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-phone', name: 'Telephone', type: 'expense', level: 'detail', parentId: 'sub-bills' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: 'det-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'type-expense' },
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'det-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'sub', parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-savings' },
  { id: 'det-retired', name: 'Old Hobby', type: 'expense', level: 'detail', parentId: 'type-expense', isActive: false },
];

const row = (over: Partial<Transaction> & { id: string; date: string; amount: number }): Transaction => ({
  description: 'A row',
  accountId: 'acc-current',
  type: over.amount < 0 ? 'expense' : 'income',
  category: 'det-groceries',
  cleared: false,
  categoryConfirmed: true,
  ...over,
  date: new Date(`${over.date}T00:00:00.000Z`),
} as Transaction);

export const transactions: Transaction[] = [
  row({ id: 't1', date: '2026-10-01', amount: -45, description: 'NORTHGATE MARKET', cleared: true }),
  row({ id: 't2', date: '2026-10-03', amount: -30, description: 'Direct Debit - SKYLINE TELECOM', category: 'det-phone', categoryConfirmed: false, needsReview: true }),
  row({ id: 't3', date: '2026-10-05', amount: 2000, description: 'ACME LTD SALARY', category: 'det-salary' }),
  row({ id: 't4', date: '2026-10-06', amount: -500, description: 'Transfer to Savings', type: 'transfer', category: 'tofrom-savings', transferAccountId: 'acc-savings', linkedTransferId: 't4b' }),
  row({ id: 't5', date: '2026-10-08', amount: 12.5, description: 'NORTHGATE MARKET REFUND', type: 'income' }),
  row({ id: 't6', date: '2026-10-09', amount: -20, description: 'CASH MACHINE', category: '' }),
  row({ id: 't7', date: '2026-09-28', amount: -60, description: 'NORTHGATE MARKET', cleared: true }),
  row({ id: 't8', date: '2026-10-10', amount: -100, description: 'BIG SHOP', category: '', isSplit: true, notes: 'split at the till' }),
];

export const splits: TransactionSplit[] = [
  { id: 's1', transactionId: 't8', category: 'det-groceries', amount: -70, sortOrder: 0 },
  { id: 's2', transactionId: 't8', category: 'det-fuel', amount: -30, sortOrder: 1 },
];

export const budgets: Budget[] = [
  { id: 'b-groceries', name: 'Groceries', categoryId: 'det-groceries', amount: 150, period: 'monthly', isActive: true, createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1), spent: 0 },
  { id: 'b-paused', name: 'Paused', categoryId: 'det-fuel', amount: 50, period: 'monthly', isActive: false, createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1), spent: 0 },
];

const dayOf = (date: Date | string): string => new Date(date).toISOString().slice(0, 10);

/** Newest-first over ISO days and ids: a code-point order, no locale involved. */
const byCodePoint = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

function matches(t: Transaction, filter: TransactionFilter): boolean {
  if (filter.text && !t.description.toLowerCase().includes(filter.text.toLowerCase())) return false;
  if (filter.accountId && t.accountId !== filter.accountId) return false;
  if (filter.categoryId && t.category !== filter.categoryId) return false;
  if (filter.from && dayOf(t.date) < filter.from) return false;
  if (filter.to && dayOf(t.date) > filter.to) return false;
  if (filter.minAmount !== undefined && t.amount < filter.minAmount) return false;
  if (filter.maxAmount !== undefined && t.amount > filter.maxAmount) return false;
  if (filter.cleared !== undefined && (t.cleared === true) !== filter.cleared) return false;
  if (filter.review === 'awaiting' && !isAwaitingReview(t)) return false;
  if (filter.review === 'done' && isAwaitingReview(t)) return false;
  return true;
}

export function fakePort(over: Partial<{ transactions: Transaction[]; splits: TransactionSplit[]; budgets: Budget[] }> = {}): ReckleyPort {
  const rows = over.transactions ?? transactions;
  const lines = over.splits ?? splits;
  const plans = over.budgets ?? budgets;
  return {
    async listAccounts() { return accounts; },
    async searchTransactions(filter, page) {
      const all = rows
        .filter(t => matches(t, filter))
        .sort((a, b) => byCodePoint(dayOf(b.date), dayOf(a.date)) || byCodePoint(b.id, a.id));
      return { rows: all.slice(page.offset, page.offset + page.limit), total: all.length };
    },
    async getTransaction(id) {
      const transaction = rows.find(t => t.id === id);
      if (!transaction) return null;
      return { transaction, splits: lines.filter(line => line.transactionId === id) };
    },
    async listCategories() { return categories; },
    async listBudgets() { return plans; },
    async transactionsBetween(from, to, cap) {
      const inRange = rows.filter(t => dayOf(t.date) >= from && dayOf(t.date) <= to);
      const capped = inRange.length > cap;
      const kept = capped ? inRange.slice(0, cap) : inRange;
      const ids = new Set(kept.filter(t => t.isSplit).map(t => t.id));
      return { rows: kept, splits: lines.filter(line => ids.has(line.transactionId)), capped };
    },
  };
}
