import type { Transaction } from '../types';
import { formatShortDate } from './dateFormatter';
import { formatCurrency } from './currency-decimal';

/**
 * What to tell someone whose import stopped part-way.
 *
 * ── WHY NOT JUST A COUNT ────────────────────────────────────────────────────
 * "Imported 412 of 900" is a number, not information. The person reading it has
 * a statement in front of them and one question: which payments are missing
 * from my register, and what do I do about it? A count answers neither. It
 * cannot even be acted on — 488 unnamed rows are 488 rows to hunt for.
 *
 * So this names them. The rows that did NOT land are the tail of the batch: the
 * cloud path posts ordered chunks and stops at the first that will not commit,
 * so everything after the confirmed count is missing; the local path writes in
 * one storage transaction, so it is all of them or none. Either way the missing
 * rows are `rows.slice(inserted)`, and each one is a payment with a date, a
 * payee and an amount that can be looked up on the statement.
 *
 * ── WHY A CAP ───────────────────────────────────────────────────────────────
 * A 500-line list inside a modal is another way of saying nothing. The first
 * few name the shape of what is missing and prove the app knows; the remainder
 * is stated as a number, because "and 483 more from 12 Feb onwards" is the part
 * that can actually be acted on — re-import from that date.
 */

/** A row that did not make it into the register. */
export type MissingRow = Pick<Transaction, 'date' | 'description' | 'amount'>;

export interface MissingRowsSummary {
  /** How many rows did not land, in total. */
  count: number;
  /** The first few, each as "dd/mm/yyyy · Payee · -£12.34". */
  named: string[];
  /** How many more there are beyond `named`. */
  hidden: number;
  /** The earliest date among the missing rows, formatted; '' when there are none. */
  earliestDate: string;
}

const DEFAULT_LIMIT = 5;

const asDate = (value: Transaction['date']): Date =>
  value instanceof Date ? value : new Date(String(value));

/**
 * Describe the rows an import failed to write.
 *
 * `currency` is the DESTINATION ACCOUNT's, not the user's display currency: the
 * amounts being named are the ones printed on the statement in front of them,
 * and converting those to another currency would make them unfindable.
 */
export function summariseMissingRows(
  rows: ReadonlyArray<MissingRow>,
  currency: string,
  limit: number = DEFAULT_LIMIT
): MissingRowsSummary {
  if (rows.length === 0) {
    return { count: 0, named: [], hidden: 0, earliestDate: '' };
  }

  const named = rows.slice(0, Math.max(0, limit)).map(row =>
    `${formatShortDate(asDate(row.date))} · ${row.description} · ${formatCurrency(row.amount, currency)}`
  );

  // The earliest missing day, because that is where a re-import has to start —
  // not the first row in file order, which need not be the oldest.
  const earliest = rows.reduce((oldest, row) => {
    const time = asDate(row.date).getTime();
    return Number.isFinite(time) && time < oldest ? time : oldest;
  }, Number.POSITIVE_INFINITY);

  return {
    count: rows.length,
    named,
    hidden: Math.max(0, rows.length - named.length),
    earliestDate: Number.isFinite(earliest) ? formatShortDate(new Date(earliest)) : ''
  };
}
