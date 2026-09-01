/**
 * Addresses for the flows that had none.
 *
 * ── THE PROBLEM (owner, 1 Sep 2026) ─────────────────────────────────────────
 *
 * Three of the app's most useful tools are modal state on a page: the transfer
 * sweep and the payee sweep on Accounts → Categorisation, the setup wizard on
 * Budget. Nothing outside those pages could ask for them, so every surface that
 * wanted to send somebody to one had to land on the page and then say "press the
 * X card" — an instruction the reader has to carry across a navigation, which is
 * exactly the thing a link exists to do for them. The history guide's steps were
 * the surface that made it obvious: seven steps, each one line, three of them
 * ending in a sentence about a button.
 *
 * ── THE ANSWER, AND WHY IT IS THIS ONE ──────────────────────────────────────
 *
 * `?open=` — the same idiom `?refile=dangling` took the same morning, and the
 * app's own idiom before that (`?account=` on Reconciliation, `?txn=` in the
 * register, `?q=` on Find). A request that has to survive a navigation cannot be
 * lifted state, and a parameter keeps the address honest: the URL says what the
 * page was opened to do, so it can be shared, bookmarked and reloaded.
 *
 * Two rules bind every reader of these values, and they are the whole contract:
 *
 *  1. READ ONCE, ON MOUNT. The parameter is HOW THE PAGE WAS OPENED, not a
 *     standing instruction — a reader who closes the sweep has closed it, and a
 *     value re-read on every render would put the modal back up in their face.
 *  2. AN UNKNOWN VALUE DOES NOTHING. Every reader compares against the constants
 *     below and opens nothing otherwise, so a mistyped address, a stale link
 *     from an older build or a value from a future one lands on the ordinary
 *     page rather than on an error.
 *
 * The paths are built here rather than typed at each call site so a link and the
 * page that answers it cannot drift apart, and every one of them still goes
 * through `preserveDemoParam` at the point of use — that flag belongs to the
 * session doing the navigating, not to the address.
 */

/** The parameter every page below reads on arrival. */
export const OPEN_PARAM = 'open';

/** Accounts → Categorisation: the equal-and-opposite pair sweep. */
export const OPEN_TRANSFER_SWEEP = 'transfers';

/** Accounts → Categorisation: file a whole merchant at once. */
export const OPEN_PAYEE_SWEEP = 'payees';

/** Accounts → Categorisation: the filter-and-file list, revealed in place. */
export const OPEN_FILE_LIST = 'file';

/** Budget: the evidence-first setup wizard. */
export const OPEN_BUDGET_WIZARD = 'wizard';

export const CATEGORISATION_TRANSFERS_PATH = `/categorisation?${OPEN_PARAM}=${OPEN_TRANSFER_SWEEP}`;
export const CATEGORISATION_PAYEES_PATH = `/categorisation?${OPEN_PARAM}=${OPEN_PAYEE_SWEEP}`;
export const CATEGORISATION_FILE_PATH = `/categorisation?${OPEN_PARAM}=${OPEN_FILE_LIST}`;
export const BUDGET_WIZARD_PATH = `/budget?${OPEN_PARAM}=${OPEN_BUDGET_WIZARD}`;
