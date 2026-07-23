import type { Account, Transaction } from '../types';

/**
 * When does an account's opening balance take effect?
 *
 * An opening balance is a lump of money that came into existence on a real day
 * — the day the account was opened — NOT at the dawn of time. Seeding it at
 * time-zero projects a 2011 account's £1.65M back to 2008 and overstates every
 * net-worth point before the account existed.
 *
 * Three history walks (the net-worth series, the statement report, the drill
 * modal) and the register's opening-balance row all need the SAME answer to
 * "on what date does this account's opening balance apply?" — so they can never
 * disagree, that single answer lives here.
 */

// Our own MS Money importer names an investment account's cash sibling
// "X (Cash)". The convention is reliable for imported accounts; for anything
// else it simply won't match.
const CASH_SUFFIX = ' (cash)';

/**
 * The lowercased name of the account this one would pair with under the
 * "X" ⟷ "X (Cash)" convention, matched in BOTH directions:
 * "X (Cash)" → "x", and "X" → "x (cash)". Returns undefined only for a name
 * that cannot form a pairing key at all (blank).
 */
function siblingNameKey(name: string): string | undefined {
  const lower = name.trim().toLowerCase();
  if (lower.length === 0) return undefined;
  if (lower.endsWith(CASH_SUFFIX)) {
    const base = lower.slice(0, lower.length - CASH_SUFFIX.length).trim();
    return base.length > 0 ? base : undefined;
  }
  return `${lower}${CASH_SUFFIX}`;
}

/**
 * The paired "(Cash)" sibling of an account by the naming convention our own
 * importer creates, matched in both directions. Reliable for imported accounts;
 * returns undefined for anything that doesn't fit the convention.
 */
export function findSiblingAccount(
  account: Account,
  accounts: Account[]
): Account | undefined {
  const key = siblingNameKey(account.name);
  if (key === undefined) return undefined;
  return accounts.find(
    a => a.id !== account.id && a.name.trim().toLowerCase() === key
  );
}

/**
 * The date an account's opening balance takes effect, by a four-rung
 * precedence. Returns undefined only when there is no signal at all — the
 * caller treats undefined as "beginning of time" (today's behaviour), which is
 * deliberately NOT excluded: silently dropping an undated lump from history is
 * worse than overstating it, so those accounts are WARNED about instead.
 *
 * @param account             the account whose opening balance we are dating
 * @param firstOwnTxnDate     the earliest date among the account's OWN
 *                            transactions, or undefined if it has none
 * @param siblingFirstTxnDate the earliest date among the paired "(Cash)"
 *                            sibling's transactions, or undefined
 */
export function effectiveOpeningDate(
  account: Account,
  firstOwnTxnDate: Date | undefined,
  siblingFirstTxnDate: Date | undefined
): Date | undefined {
  // Rung 1: an explicit date the user or importer recorded — CLAMPED so it can
  // never fall AFTER the first transaction. Money's dtOpen means "when the
  // account was created in the file", not "when the opening balance became
  // effective": production has an account whose recorded open date is eight
  // months after its first transaction, and the register's running balance
  // needs the opening lump to exist by that first transaction or the whole
  // balance column is wrong.
  if (account.openingBalanceDate) {
    const explicit = new Date(account.openingBalanceDate);
    if (firstOwnTxnDate && firstOwnTxnDate.getTime() < explicit.getTime()) {
      return firstOwnTxnDate;
    }
    return explicit;
  }
  // Rung 2: no explicit date → the opening balance applies the day of the first
  // transaction (same-day, so that transaction's running balance already
  // includes the opening lump).
  if (firstOwnTxnDate) return firstOwnTxnDate;
  // Rung 3: no transactions of its own → the paired "(Cash)" sibling's first
  // activity (the Money model: a position account whose money lives in its cash
  // sibling).
  if (siblingFirstTxnDate) return siblingFirstTxnDate;
  // Rung 4: no signal at all — beginning of time, flagged rather than hidden.
  return undefined;
}

/**
 * Every account's effective opening date, resolved in ONE pass over the
 * transactions. The history walks run on 50k+ rows, so per-account filtering
 * (O(accounts × transactions)) is not acceptable — the codebase already carries
 * that warning in ImprovedDashboard. Returns accountId → effective date, with
 * undefined for the flagged rung-4 accounts.
 */
export function resolveEffectiveOpeningDates(
  accounts: Account[],
  transactions: Transaction[]
): Map<string, Date | undefined> {
  // Earliest own-transaction date per account — the single expensive pass.
  const firstTxn = new Map<string, number>();
  for (const t of transactions) {
    const time = new Date(t.date).getTime();
    if (Number.isNaN(time)) continue;
    const existing = firstTxn.get(t.accountId);
    if (existing === undefined || time < existing) firstTxn.set(t.accountId, time);
  }

  // Name → account index, so the sibling lookup is O(1) and the whole resolver
  // stays linear in the number of accounts.
  const byLowerName = new Map<string, Account>();
  for (const a of accounts) {
    const key = a.name.trim().toLowerCase();
    if (!byLowerName.has(key)) byLowerName.set(key, a);
  }

  const result = new Map<string, Date | undefined>();
  for (const account of accounts) {
    const own = firstTxn.get(account.id);
    const siblingKey = siblingNameKey(account.name);
    const sibling = siblingKey ? byLowerName.get(siblingKey) : undefined;
    const siblingFirst =
      sibling && sibling.id !== account.id ? firstTxn.get(sibling.id) : undefined;
    result.set(
      account.id,
      effectiveOpeningDate(
        account,
        own === undefined ? undefined : new Date(own),
        siblingFirst === undefined ? undefined : new Date(siblingFirst)
      )
    );
  }
  return result;
}
