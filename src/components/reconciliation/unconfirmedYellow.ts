/**
 * The yellow that means "not yet".
 *
 * ONE constant, worn by every control that is waiting on the same fact: the
 * closing balance has not been confirmed. That is the closing-balance
 * affordance on the balance bar (the figure, the invitation to type one, the
 * editor) and the Finalize Reconciliation button in the page header. Sharing
 * the literal string is the whole point — the eye is meant to read "this
 * yellow is why that yellow", and two hand-copied class lists drift the first
 * time either is touched. A thread that has drifted is worse than no thread,
 * because the colours then claim a relationship that is no longer true.
 *
 * These eight utilities are exactly the amber vocabulary the Finalize button
 * already shipped with — border, text and wash, in both themes — lifted out
 * rather than re-picked, so nothing was approximated in the move.
 *
 * CONSTRAINT: swap this in, never append it. Every utility here sets a colour
 * (background, text, border), and Tailwind resolves two utilities for the same
 * property by CSS source order, not by their order in a className — so emitting
 * this alongside `text-gray-900` or `dark:bg-gray-700` would leave the winner
 * to whichever the compiler happened to write last. Callers pick one branch or
 * the other.
 *
 * CONSTRAINT: colour only. Border WIDTH, radius, padding and typography stay
 * with each element, because a header button and a figure in a four-up grid do
 * not share those. Keeping this list purely `amber-*` is also what lets the
 * structural test compare two elements' yellow exactly, and catch a hardcoded
 * near-miss.
 */
export const UNCONFIRMED_YELLOW =
  'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 ' +
  'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/50';

/**
 * The id of the paragraph that says, in words, why the yellow is there.
 *
 * Lives here because the balance bar prints it and both the bar's affordance
 * and the page's Finalize button point at it with `aria-describedby` — colour
 * is never the only signal, and a hardcoded id in three files is a dangling
 * reference waiting to happen. Referenced ONLY while that paragraph is
 * rendered (i.e. while unconfirmed), so it never points at nothing.
 */
export const CONFIRM_BALANCE_HINT_ID = 'reconciliation-confirm-hint';
