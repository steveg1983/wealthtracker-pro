/**
 * The yellow that means "your next action is here".
 *
 * ─ WHY IT LIVES HERE NOW ───────────────────────────────────────────────────
 *
 * It was born in `components/reconciliation/`, and stayed there through two
 * more consumers on the grounds that moving it was never worth its own risk on
 * top of whatever fix was in hand. Three consumers in three different areas is
 * where that stops being true: a constant every area imports, that lives inside
 * one area, reads as though that area owns the meaning. It does not. The
 * meaning is the app's.
 *
 * `CONFIRM_BALANCE_HINT_ID` did NOT come with it, and the split is the point —
 * that id names one paragraph on one page, and is reconciliation's own.
 *
 * ─ WHAT IT MEANS ───────────────────────────────────────────────────────────
 *
 * A condition holds, and exactly ONE control ends it. Wear this on that
 * control. It is not "blocked", not "warning", not "attention" — it is an
 * instruction about where to go next, and it is the only colour in the app that
 * means that.
 *
 * It once meant "blocked", and was worn by two controls at once. That read as
 * two refusals rather than one instruction, and left the user's actual next
 * step the quietest thing on screen. Same eight utilities, one meaning changed,
 * so the name changed with it: a constant called UNCONFIRMED_YELLOW hanging off
 * a CONFIRMED button would be a lie in the one place a design must read
 * literally.
 *
 * Its original thread is still the clearest illustration. While the closing
 * balance is unconfirmed the question is on the balance bar, so the
 * closing-balance affordance wears it while Finalize sits dimmed and disabled.
 * Confirm the figure and the bar goes quiet while Finalize lights up in this
 * same yellow, because pressing it is now the only thing left to do. The eye
 * follows the colour from the question to the action.
 *
 * ─ CONSTRAINT: one at a time, PER CONTEXT ──────────────────────────────────
 *
 * Within a view, at most one control may wear this — two next actions is no
 * next action. Across views it is unremarkable: Reconciliation's thread and a
 * subscription notice on another page never share a screen.
 *
 * Reconciliation's pair are mutually exclusive BY CONSTRUCTION, both branching
 * on the same fact and emitting on opposite sides of it, and
 * `src/pages/__tests__/Reconciliation.yellowThread.test.tsx` asserts that in
 * both directions of the transition. A thread that has drifted is worse than no
 * thread: the colours then claim a relationship that is no longer true.
 *
 * ─ CONSTRAINT: swap this in, never append it ───────────────────────────────
 *
 * Every utility here sets a colour (background, text, border), and Tailwind
 * resolves two utilities for the same property by CSS source order, not by
 * their order in a className — so emitting this alongside `text-gray-900` or
 * `dark:bg-gray-700` would leave the winner to whichever the compiler happened
 * to write last. Callers pick one branch or the other.
 *
 * ─ CONSTRAINT: colour only ─────────────────────────────────────────────────
 *
 * Border WIDTH, radius, padding and typography stay with each element, because
 * a header button, a figure in a four-up grid and a notice in a card do not
 * share those. Keeping this list purely `amber-*` is also what lets the
 * structural test compare two elements' yellow exactly, and catch a hardcoded
 * near-miss.
 *
 * ─ CONTRAST: measured, and no longer remembered ────────────────────────────
 *
 * This is an ENABLED control's colour wherever it lands, so it clears WCAG
 * 1.4.3 AA (4.5:1) on its own — a disabled control would have been exempt, a
 * pressable one is not.
 *
 * The figures are NOT quoted here any more. They were, in this header and again
 * in prose at each call site, and by 15 August the copies disagreed: 6.37 here
 * against 6.15 in `SubscriptionStatus`, and a dark figure of 10.7 quoted there
 * for a panel that sits on a CARD, where the real number is 9.16. Nothing was
 * failing — every pair clears AA with room — but a remembered number that has
 * drifted is exactly what this repo's contrast doctrine exists to prevent.
 *
 * `src/design-system/__tests__/semantic-contrast.test.ts` now measures all six
 * pairs on every surface this is used on, and fails if a shade here changes
 * into something that does not clear AA. Read the number off the test.
 */
export const NEXT_ACTION_YELLOW =
  'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 ' +
  'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/50';
