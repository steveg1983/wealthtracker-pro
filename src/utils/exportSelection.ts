import type { Account, Category, Transaction, TransactionSplit } from '../types';
import { PERIOD_LABELS, type PeriodKey, type PeriodRange } from '../hooks/usePeriod';
import type { DataExportTransaction } from './pdfExport';
import { expandSplitTransactions } from './transactionSplits';
import { buildCategoryNameLookup } from './categoryNames';
import { compareText } from './localeFormat';

/**
 * Which accounts belong in the file.
 *
 * 'all' is the balance-sheet answer a PDF or a spreadsheet wants. The
 * interchange formats want 'with-transactions': QIF and OFX name an account as
 * a HEADER for the rows beneath it, so an account with nothing in the period
 * would arrive at the far end as an empty account the user never asked to
 * create.
 */
export type AccountsScope = 'all' | 'with-transactions';

export interface ExportSelectionInput {
  transactions: Transaction[];
  transactionSplits: TransactionSplit[];
  accounts: Account[];
  categories: Category[];
  range: PeriodRange;
  includeTransactions: boolean;
  includeAccounts: boolean;
  accountsScope: AccountsScope;
}

export interface ExportSelection {
  /**
   * null when the user did not ask for transactions — which is a different
   * thing from an empty period, and the two must not print the same.
   */
  transactions: DataExportTransaction[] | null;
  accounts: Account[] | null;
}

/**
 * WHAT GOES IN THE FILE — decided once, for the preview and for every format.
 *
 * The preview and the export used to answer this question separately, and gave
 * different answers: the panel counted the whole dataset while the file was
 * date-filtered, and one button on the page read raw transactions while the
 * others expanded splits, so the same range exported different totals
 * depending on which button you pressed. There is now one answer, and the
 * count beside the button is a count OF the file.
 *
 * - Split parents become one row per line (expandSplitTransactions), so
 *   category columns are right and the lines still sum to the parent.
 * - Category and account NAMES are resolved here. Ids are UUIDs; none may
 *   reach a file.
 * - Rows come out oldest-first — a statement's order, not React state's.
 */
export function selectExportData(input: ExportSelectionInput): ExportSelection {
  const {
    transactions,
    transactionSplits,
    accounts,
    categories,
    range,
    includeTransactions,
    includeAccounts,
    accountsScope
  } = input;

  if (!includeTransactions) {
    // Nothing to narrow accounts against, so 'with-transactions' can only mean
    // every account.
    return { transactions: null, accounts: includeAccounts ? accounts : null };
  }

  const categoryName = buildCategoryNameLookup(categories);
  const accountName = new Map(accounts.map(account => [account.id, account.name]));

  const from = range.from ? range.from.getTime() : null;
  const to = range.to ? range.to.getTime() : null;

  const rows = expandSplitTransactions(transactions, transactionSplits)
    .filter(transaction => {
      const time = new Date(transaction.date).getTime();
      if (Number.isNaN(time)) return false;
      if (from !== null && time < from) return false;
      if (to !== null && time > to) return false;
      return true;
    })
    .map(transaction => ({
      ...transaction,
      categoryLabel: categoryName(transaction.category),
      accountLabel: accountName.get(transaction.accountId) ?? 'Unknown'
    }))
    .sort((a, b) => {
      const difference = new Date(a.date).getTime() - new Date(b.date).getTime();
      // Same-day rows keep a stable order rather than whatever sort() felt
      // like, so two exports of the same data are the same file.
      return difference !== 0 ? difference : compareText(a.id, b.id);
    });

  if (!includeAccounts) {
    return { transactions: rows, accounts: null };
  }

  if (accountsScope === 'with-transactions') {
    const used = new Set(rows.map(row => row.accountId));
    return { transactions: rows, accounts: accounts.filter(account => used.has(account.id)) };
  }

  return { transactions: rows, accounts };
}

const ukDate = (date: Date): string =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

/**
 * The period in words AND in dates, for the line printed under an export's
 * title. "This month" alone is unreadable six months later, when the file is
 * the only thing left; the dates alone lose what the user actually asked for.
 *
 * An open end ("this month", "tax year" — both run to today) is printed as
 * today, because that is the last day the file can contain.
 */
export function describeExportRange(period: PeriodKey, range: PeriodRange, now: Date = new Date()): string {
  if (period === 'all' || (range.from === null && range.to === null)) {
    return PERIOD_LABELS.all;
  }
  const from = range.from ? ukDate(range.from) : 'the beginning';
  const to = ukDate(range.to ?? now);
  return `${PERIOD_LABELS[period]}: ${from} to ${to}`;
}
