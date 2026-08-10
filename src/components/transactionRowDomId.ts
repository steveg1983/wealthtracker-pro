/**
 * A transaction row's element id — the one string the row and the list that
 * holds it must agree on.
 *
 * The row writes it; the list spends it, handing a row the focus by name as the
 * selection moves (`document.getElementById`). It is the same mechanism the
 * Accounts list uses for its own rows, and it lives in a module of its own for
 * a mechanical reason: a file that exports components may not also export
 * functions without breaking fast refresh, and this is a function.
 *
 * ─ CONSTRAINTS ─────────────────────────────────────────────────────────────
 * Transaction ids are UUIDs, so the result is safe as an HTML id and as a
 * getElementById argument, both of which take the string literally. It is never
 * interpolated into a CSS selector — the one place where a stray character in
 * an id would need escaping — and it should not start being.
 */
export const transactionRowDomId = (transactionId: string): string => `transaction-row-${transactionId}`;
