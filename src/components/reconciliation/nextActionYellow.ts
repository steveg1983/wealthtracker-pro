/**
 * The id of the paragraph that says, in words, why the balance bar is yellow
 * and why Finalize will not press.
 *
 * Lives here because the balance bar prints it while both the bar's affordance
 * and the page's Finalize button point at it with `aria-describedby` — colour
 * is never the only signal, and a hardcoded id in three files is a dangling
 * reference waiting to happen. Referenced ONLY while that paragraph is
 * rendered (i.e. while unconfirmed), so it never points at nothing.
 *
 * NEXT_ACTION_YELLOW used to sit beside this and has moved to
 * `src/design-system/nextActionYellow.ts`: three areas import the colour, only
 * this page has this paragraph. The file kept its name so the reconciliation
 * imports still read the same way.
 */
export const CONFIRM_BALANCE_HINT_ID = 'reconciliation-confirm-hint';
