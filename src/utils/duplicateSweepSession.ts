/**
 * What the Find-duplicates sweep remembers about where the user was, so a trip
 * out to the register and back does not cost them their place.
 *
 * The jump out to "see this row in the register" used to be one-way: the modal
 * closed, Data Management unmounted it, and the browser's back button returned
 * to a page with no dialog on it and no memory of the list the user had spent
 * five minutes working down. This is the crumbs that trip carries — written by
 * the sweep for the sweep, handed to the register as opaque provenance
 * (see navigationProvenance) and handed straight back on the way home.
 *
 * Its own module, and nothing but types and a parser, because the page that
 * receives the crumbs (settings/DataManagement) must be able to read them
 * WITHOUT importing the sweep: the modal is code-split precisely so its scan
 * does not run on every visit to that page.
 */

/** How far apart two copies of the same payment may be, in days. */
export const WINDOW_CHOICES = [1, 3, 7, 14] as const;
export type WindowDays = (typeof WINDOW_CHOICES)[number];

/** The default reach of a sweep — see DuplicateSweepModal for why 3. */
export const DEFAULT_WINDOW_DAYS: WindowDays = 3;

export type DuplicateSortKey = 'date' | 'account' | 'description' | 'amount';

/** Where the user was when they left the sweep. */
export interface DuplicateSweepSession {
  /**
   * Which tool these crumbs are for. Data Management hosts several dialogs and
   * has to know which one to reopen — and must not reopen anything at all for
   * crumbs left by a build that had a different set of them.
   */
  tool: 'find-duplicates';
  windowDays: WindowDays;
  /** Account id, or '' for all accounts. */
  accountFilter: string;
  sortKey: DuplicateSortKey;
  /** 1 ascending, -1 descending — as the sweep's own comparator reads it. */
  sortDir: 1 | -1;
  /**
   * The pair they jumped from (duplicateDismissalKey of the two rows). Its row
   * is scrolled back into view and highlighted, which is what "their place in
   * the list" actually means on a list three hundred long.
   */
  pairKey: string;
  /** True when they left from INSIDE the review of that pair, not the list. */
  reviewing: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isWindowDays = (value: unknown): value is WindowDays =>
  typeof value === 'number' && WINDOW_CHOICES.some((choice): boolean => choice === value);

const isSortKey = (value: unknown): value is DuplicateSortKey =>
  value === 'date' || value === 'account' || value === 'description' || value === 'amount';

/**
 * Crumbs read back off a history entry, or null when there are none for this
 * tool.
 *
 * Narrowed field by field rather than trusted: history state outlives a deploy,
 * so this can be handed a shape from a build that is no longer running. Every
 * field that fails falls back to the sweep's own default rather than rejecting
 * the whole thing — coming back to the list at the wrong sort order is a small
 * annoyance; coming back to no dialog at all is the bug being fixed.
 */
export function readDuplicateSweepSession(state: unknown): DuplicateSweepSession | null {
  if (!isRecord(state)) return null;
  const resume: unknown = state.resume;
  if (!isRecord(resume) || resume.tool !== 'find-duplicates') return null;
  if (typeof resume.pairKey !== 'string' || resume.pairKey === '') return null;

  return {
    tool: 'find-duplicates',
    windowDays: isWindowDays(resume.windowDays) ? resume.windowDays : DEFAULT_WINDOW_DAYS,
    accountFilter: typeof resume.accountFilter === 'string' ? resume.accountFilter : '',
    sortKey: isSortKey(resume.sortKey) ? resume.sortKey : 'date',
    sortDir: resume.sortDir === 1 ? 1 : -1,
    pairKey: resume.pairKey,
    reviewing: resume.reviewing === true,
  };
}
