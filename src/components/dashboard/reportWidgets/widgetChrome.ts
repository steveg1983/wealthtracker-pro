/**
 * The measurements every Dashboard report card shares.
 *
 * Kept apart from the components that use them so that file exports components
 * and nothing else — a module mixing components with constants loses React Fast
 * Refresh for every component in it (same reason as pinnableReports.ts).
 *
 * Four cards sit beside each other in two columns, and cards of four different
 * heights read as four unrelated things. Height is settled here rather than in
 * each card, so "the same height" is a fact of the code instead of something
 * four files happen to agree on today. Every card is therefore:
 *
 *   p-4 (16) + title (20) + mb-1 (4) + subtitle slot (28) + mb-3 (12)
 *            + chart (208) + p-4 (16)  = 304px
 */

/**
 * The chart area of every Dashboard report card. Taken from the Account
 * Distribution card, which had the height the others are matched to.
 */
export const WIDGET_CHART_HEIGHT = 'h-52';

/**
 * The one line under the title. Fixed height, so a card whose line is a big
 * money figure and one whose line is a sentence still end up the same size.
 * h-7 is the line box of the tallest of them (text-xl).
 */
export const WIDGET_SUBTITLE_SLOT = 'h-7 flex items-center gap-2 min-w-0';
