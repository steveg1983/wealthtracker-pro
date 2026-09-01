/**
 * The address that ends the loop.
 *
 * ── THE BUG (owner, from a user, 1 Sep 2026) ────────────────────────────────
 *
 * Rows filed under a category that no longer exists were announced in two
 * places, and the two announcements pointed at each other:
 *
 *   Accounts → Categorisation   "N of these are filed under a category that no
 *                               longer exists — repair them under Manage →
 *                               Categories", linking to that page;
 *   Manage → Categories         "N rows point at a category that no longer
 *                               exists — re-file them", linking back to
 *                               Categorisation.
 *
 * A reader who followed either arrived at the other announcement. The rows were
 * never on screen. Two true sentences and a closed circle.
 *
 * ── THE RULING ─────────────────────────────────────────────────────────────
 *
 * A dangling row HAS a category — a dead one — so putting it right is a CHANGE
 * to something already filed. That is housekeeping, and housekeeping lives on
 * Manage → Categories, where the Re-categorise section already searched those
 * rows and already said so beside each picker. What was missing was the way to
 * FIND them, which is now a filter of its own (FilterAndFileList). Both former
 * ends of the loop point HERE, and this path is what they point at.
 *
 * ── WHY A QUERY PARAMETER ──────────────────────────────────────────────────
 *
 * One of the two ends is on another page, so the request has to survive a
 * navigation — which lifted state on the destination cannot do. A parameter is
 * the app's own idiom for exactly that (`?account=` on Reconciliation, `?txn=`
 * in the register, `?q=` on Find), and it keeps the address honest: the URL
 * says what the page was opened to do, so it can be shared and reloaded.
 */

/** The parameter Manage → Categories reads on arrival. */
export const REFILE_PARAM = 'refile';

/** The one search it can ask for: the rows whose category is gone. */
export const REFILE_DANGLING = 'dangling';

/** Manage → Categories, opened on those rows with their pickers beside them. */
export const CATEGORY_REFILE_DANGLING_PATH =
  `/settings/categories?${REFILE_PARAM}=${REFILE_DANGLING}`;
