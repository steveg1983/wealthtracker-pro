/**
 * THE ONLY BLUE LEFT IN THIS APP.
 *
 * Claude Design's ruling of 28 August 2026, in one sentence: **the stock blue is
 * retired; links keep it, nothing else does.**
 *
 * The colour is roughly `#2563eb` — Tailwind `blue-600` — and it appears nowhere
 * in this app's palette. It had been the fifth stock blue standing in for a
 * design decision, after the dark-mode primaries, the progress fills, the
 * ToggleSwitch track and the two donut legend labels. Each of those was ruled
 * individually and each came back, which is the tell: a colour that returns five
 * times is not an oversight, it is a missing rule.
 *
 * So the fix is not a sixth sweep. It is this file plus the lint rule in
 * `eslint.config.js` that points at it — the same treatment the `!important`
 * globals earned, where the fault was never the instance but that nothing
 * prevented the next one. A blue utility class may be written HERE and nowhere
 * else in `src/`.
 *
 * ── WHAT COUNTS AS A LINK ───────────────────────────────────────────────────
 * A control that NAVIGATES — it takes the reader somewhere, and the browser's
 * own convention for that is underlined blue. Everything else in this app that
 * once wore this colour was one of two mistakes:
 *
 *   - a control's state (a progress fill, a toggle track, a selected tile, a
 *     primary button), which takes its own control family's token: the
 *     `primary-action` pair for the press that is being invited, `#94a3b8` for
 *     the selected and on states;
 *   - a resting state that needed no colour at all (`Difference £0.00`,
 *     `Cleared Balance`, `Confirmed`, a C on 7,240 rows). Colour marks what
 *     needs attention, and those need none.
 *
 * ── WHY THIS IS FOR EXTERNAL LINKS ──────────────────────────────────────────
 * Blue-as-link is a convention about LEAVING — it belongs on an `<a href>` that
 * hands the reader to a browser tab this app does not control. In-app navigation
 * already has its own answer and has had for months: `text-primary
 * hover:text-secondary`, the brand navy, which `index.css` gives a dark
 * counterpart (`#f9fafb`) so it reads on both grounds. An internal `<Link>` in
 * link blue is borrowed chrome inside an app that owns its own.
 */

/**
 * External-link ink, both grounds.
 *
 * `blue-700` rather than `blue-600` on light: 6.5:1 on white against 4.5:1,
 * and the underline is what carries the affordance anyway, so the colour can
 * afford to be the darker, quieter one.
 */
export const LINK_CLASS = 'text-blue-700 dark:text-blue-400 hover:underline';

/**
 * ── IN-APP NAVIGATION, AND THE TRAP UNDER IT ────────────────────────────────
 *
 * There is no constant here, deliberately. In-app navigation takes
 * `text-primary`, and what it takes for a HOVER depends on something the sweep
 * of 29 August 2026 measured rather than assumed — three separate passes over
 * different parts of the app arrived at it independently, so it is written down
 * once, here, next to the colour it qualifies.
 *
 * **`hover:text-secondary` does not work.** Two reasons, both in `index.css`:
 *
 *   1. `.text-primary` is declared with `!important` (it has to be: it is a
 *      `var()` token that needs a dark counterpart). Tailwind emits
 *      `.hover\:text-secondary:hover` WITHOUT `!important`, and `!important`
 *      wins regardless of source order — so on a link that names `text-primary`
 *      the hover simply never fires. It is inert at every existing call site.
 *   2. `.dark .text-secondary` lifts the token for dark mode, and that selector
 *      matches the bare class only. The `hover:` variant escapes the lift, so
 *      on a link that declares its own near-white resting ink the hover would
 *      DARKEN it to navy on a gray-800 card — an invisible hover, not a
 *      quieter one.
 *
 * So: a link that has no resting ink of its own takes `text-primary`, and its
 * hover is the underline. A link that deliberately declares its own ink — a
 * row name drawn to match the figure beside it — takes no colour at all and
 * hovers with the underline alone. `ACCOUNT_ROW_NAME_LINK_CLASS` in
 * `components/AccountRowColumns.tsx` is the worked example, and it is worth
 * reading before writing a new one.
 *
 * An underline IS the link. A colour change on top of one is decoration.
 */
