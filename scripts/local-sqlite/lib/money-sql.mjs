// Money, expressed so the two engines can be compared without either side
// touching a float.
//
// The local file stores INTEGER minor units; the cloud stores numeric(20,2).
// Comparing them means turning both into the SAME decimal string, and the only
// safe way to do that in SQLite is integer division — `amount_minor / 100.0`
// would produce a REAL, which is precisely what the local edition exists to
// avoid, and it would do it inside the tool that is supposed to be proving the
// avoidance.
//
// There is exactly one implementation of each here so a spec cannot invent its
// own and get it subtly wrong.

/**
 * A SQLite integer-minor-units column, as an exact decimal string.
 * @param {string} expr a column or expression yielding INTEGER minor units
 */
export function minorToDecimal(expr) {
  return `(CASE WHEN (${expr}) < 0 THEN '-' ELSE '' END
           || CAST(abs(${expr}) / 100 AS TEXT)
           || '.'
           || substr('0' || CAST(abs(${expr}) % 100 AS TEXT), -2, 2))`;
}

/**
 * A Postgres numeric(20,2) column, as a decimal string.
 * `::text` on a scaled numeric already yields exactly two places — no rounding
 * function is involved and none should be.
 * @param {string} expr a column or expression of type numeric
 */
export function numericToDecimal(expr) {
  return `(${expr})::text`;
}

/**
 * The B-1 identity as a single shared assertion:
 * `balance - (initial_balance + SUM(amount))` for one account, which must be
 * `0.00` on both engines.
 *
 * B-1 is the invariant the whole app rests on and the one nothing in either
 * schema enforces, so every verb spec asserts it rather than trusting the verb.
 * @param {string} accountId
 */
export const balanceIdentity = {
  sqlite: (accountId) =>
    `SELECT ${minorToDecimal(`a.balance_minor - (a.initial_balance_minor
        + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.account_id = a.id), 0))`)}
       FROM accounts a WHERE a.id = '${accountId}'`,
  postgres: (accountId) =>
    `SELECT ${numericToDecimal(`a.balance - (a.initial_balance
        + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.account_id = a.id), 0))`)}
       FROM public.accounts a WHERE a.id = '${accountId}'`,
};

/**
 * One account's balance, as a decimal string, on either engine.
 * @param {string} accountId
 */
export const accountBalance = {
  sqlite: (accountId) =>
    `SELECT ${minorToDecimal('balance_minor')} FROM accounts WHERE id = '${accountId}'`,
  postgres: (accountId) =>
    `SELECT ${numericToDecimal('balance')} FROM public.accounts WHERE id = '${accountId}'`,
};
