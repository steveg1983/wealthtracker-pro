/**
 * The yellow that means "your next action is here".
 *
 * ONE constant, worn by exactly ONE control at a time — and it MOVES. While the
 * closing balance is unconfirmed the question is on the balance bar, so the
 * closing-balance affordance wears it (the figure, the invitation to type one,
 * the editor) while Finalize Reconciliation sits dimmed and disabled. Confirm
 * the figure and the bar goes quiet while Finalize lights up in this same
 * yellow, because pressing it is now the only thing left to do. The eye follows
 * the colour from the question to the action.
 *
 * It used to mean "blocked", and was worn by both controls at once. That read
 * as two refusals rather than one instruction, and it left the user's actual
 * next step — the Confirm button — the quietest thing on the bar. Same eight
 * utilities, one meaning changed, so the name changed with it: a constant
 * called UNCONFIRMED_YELLOW hanging off a CONFIRMED button would be a lie in
 * the one place the design has to be read literally.
 *
 * CONSTRAINT: mutually exclusive, by construction. Both consumers branch on the
 * same fact — the closing balance has been agreed to — and emit this on
 * OPPOSITE sides of it, so there is no state in which both are yellow and none
 * in which neither is while the question is still open. Structural tests in
 * src/pages/__tests__/Reconciliation.yellowThread.test.tsx assert exactly that,
 * in both directions of the transition, because a thread that has drifted is
 * worse than no thread: the colours then claim a relationship that is no longer
 * true.
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
 *
 * CONTRAST: this is now an ENABLED control's colour on the Finalize side, so it
 * has to clear WCAG 1.4.3 AA (4.5:1) on its own — a disabled control would have
 * been exempt, a pressable one is not. Measured: amber-800 on amber-100 is
 * 6.37:1, and 5.69:1 against the amber-200 hover; in dark, amber-300 over
 * amber-900/30 composited on the page's gray-900 is 10.68:1, and 9.34:1 against
 * the amber-900/50 hover. All four pass AA; both dark pairs pass AAA. Re-measure
 * before changing any shade here.
 */
export const NEXT_ACTION_YELLOW =
  'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 ' +
  'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/50';

/**
 * The id of the paragraph that says, in words, why the balance bar is yellow
 * and why Finalize will not press.
 *
 * Lives here because the balance bar prints it while both the bar's affordance
 * and the page's Finalize button point at it with `aria-describedby` — colour
 * is never the only signal, and a hardcoded id in three files is a dangling
 * reference waiting to happen. Referenced ONLY while that paragraph is
 * rendered (i.e. while unconfirmed), so it never points at nothing.
 */
export const CONFIRM_BALANCE_HINT_ID = 'reconciliation-confirm-hint';
