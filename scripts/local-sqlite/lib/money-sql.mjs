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
 * A SQLite INTEGER column at 1e8, as an exact decimal string at EIGHT places.
 *
 * The twin of {@link minorToDecimal}, and here for the same reason and with the
 * same prohibition: `quantity_e8 / 1e8` would produce a REAL, inside the tool
 * that is supposed to be proving no float exists on this path. Integer division
 * and a zero-padded remainder, exactly as `crate::scaled::to_decimal_string`
 * does it in Rust.
 *
 * EIGHT PLACES ALWAYS, because that is what `numeric(20,8)::text` prints on the
 * other side (`'32.77500000'`, never `'32.775'`), and a comparison that first
 * has to normalise a spelling is a comparison with a normaliser in it that can
 * be wrong.
 *
 * `substr('0000000' || x, -8, 8)` rather than a `printf`: SQLite's `printf`
 * exists, but the minor-units helper above uses `substr` and two spellings of
 * one idea in one file is how the two come to disagree.
 * @param {string} expr a column or expression yielding an INTEGER at 1e8
 */
export function scaledToDecimal(expr) {
  return `(CASE WHEN (${expr}) < 0 THEN '-' ELSE '' END
           || CAST(abs(${expr}) / 100000000 AS TEXT)
           || '.'
           || substr('0000000' || CAST(abs(${expr}) % 100000000 AS TEXT), -8, 8))`;
}

/**
 * A Postgres numeric(20,8) column, as a decimal string at eight places.
 *
 * Identical to {@link numericToDecimal} in body and deliberately separate in
 * NAME, because the two answer different questions — `::text` on a scaled
 * numeric yields the column's own scale, so which scale you get depends on which
 * column you asked, and a caller who cannot see that at the call site is a
 * caller who will one day render a quantity with the money helper.
 * @param {string} expr a column or expression of type numeric(20,8)
 */
export function scaledNumericToDecimal(expr) {
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
