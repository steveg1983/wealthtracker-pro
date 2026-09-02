/**
 * Numbers and sorting, in the region the reader chose.
 *
 * ─ THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * #549 fixed every formatting call that NAMED a region — `'en-US'` written out
 * by hand, in a locale argument or one indirection away in a `const`. Its guard
 * (`design-system/__tests__/localeObeysTheSetting.test.ts`) says in as many
 * words that it does not cover the other half:
 *
 *     A bare `toLocaleDateString()` with no argument at all also ignores the
 *     setting — it takes the browser's locale.
 *
 * That is the subtler bug of the two. `(1234).toLocaleString()` does not name a
 * region, so it reads as neutral, and it is not: it asks the BROWSER what to
 * do. Settings ▸ Region & Date Format is then a control that governs some of
 * the app's output and not the rest, and which half a given number falls into
 * depends on the machine it is read on. A reader who sets English (UK) on a
 * laptop configured for Germany gets `1.234` where the app promised `1,234`.
 *
 * `getDateLocale()` is the one answer: the explicit choice, en-GB when there is
 * none. Everything here routes through it.
 *
 * ─ WHY IT IS SAFE TO CHANGE 280 CALL SITES AT ONCE ──────────────────────────
 *
 * Because at the default the output does not move, and that was measured
 * rather than assumed. en-GB and en-US group and separate numbers identically
 * (`1,234,567.89` either way) and order ASCII text identically, so every one of
 * the number and sorting sites this sweep touched renders the same bytes before
 * and after. The sweep's DATE sites are the ones that genuinely change on a
 * machine set to en-US — and that change is the bug being fixed, the one
 * reported from a real phone in #549: "the register still read Jun 2, 2026".
 *
 * ─ WHY THESE ARE FUNCTIONS AND NOT AN INLINE ARGUMENT ───────────────────────
 *
 * For numbers, so the formatter is built once instead of once per row: a
 * register can put several thousand counts on a page.
 *
 * For sorting the reason is sharper, and it is a measured one. Passing options
 * to `localeCompare` builds a collator per comparison, and a comparator runs
 * O(n log n) times. Sorting 20,000 names on this machine:
 *
 *     a.localeCompare(b)                              12.0 ms
 *     a.localeCompare(b, locale)                       6.5 ms
 *     a.localeCompare(b, undefined, { sensitivity })  478.4 ms   ← today
 *     a.localeCompare(b, locale,    { sensitivity })  734.7 ms   ← the naive fix
 *     memoised Intl.Collator.compare                   10.1 ms   ← this file
 *
 * So the obvious edit — add a locale argument beside the options already there
 * — would have made the app's thirty case-insensitive sorts HALF AS FAST AGAIN
 * while fixing them. A collator held per locale is instead ~47x faster than
 * what those sites do today, and identical in result (also measured, over
 * accents, case, empty strings and digits).
 *
 * ─ WHAT DOES NOT BELONG HERE ────────────────────────────────────────────────
 *
 * MONEY. `formatCurrency` has its own currency-and-locale logic — a symbol, a
 * currency code, and rules about sign and colour that a bare number formatter
 * knows nothing about. Counts are not money and money is not a count; routing
 * one through the other is how a total loses its £.
 */
import { getDateLocale } from './dateFormatter';

/**
 * Held per locale rather than per call. `getDateLocale()` is itself cached and
 * only `setUserLocale` can change what it answers, so comparing the string is
 * enough to notice a change of region — no invalidation hook to forget to call.
 */
let counts: { locale: string; formatter: Intl.NumberFormat } | null = null;
let exact: { locale: string; collator: Intl.Collator } | null = null;
let loose: { locale: string; collator: Intl.Collator } | null = null;

/**
 * A whole number for a person to read: thousands grouped, in their region.
 *
 * Takes no options on purpose. Every one of the ~190 call sites this replaced
 * passed none, and an options bag would defeat the memoisation above — a
 * formatter would be rebuilt on every call, silently, precisely in the render
 * and sort loops the cache exists for. If a site ever needs decimals it should
 * say so here, with its own cached formatter.
 *
 * Not for money: see the header.
 */
export function formatCount(value: number): string {
  const locale = getDateLocale();
  if (counts === null || counts.locale !== locale) {
    counts = { locale, formatter: new Intl.NumberFormat(locale) };
  }
  return counts.formatter.format(value);
}

/**
 * Order two strings the way the reader's region orders them.
 *
 * Case- and accent-SENSITIVE, matching what a bare `a.localeCompare(b)` did
 * before it — same result, one collator instead of one per comparison.
 */
export function compareText(a: string, b: string): number {
  const locale = getDateLocale();
  if (exact === null || exact.locale !== locale) {
    exact = { locale, collator: new Intl.Collator(locale) };
  }
  return exact.collator.compare(a, b);
}

/**
 * The same, ignoring case and accents (`sensitivity: 'base'`).
 *
 * This is what the app sorts NAMES with — payees, categories, accounts — because
 * they are typed by people, and a list that files "Tesco" above "acme" because
 * capitals sort first looks broken to the person who typed both.
 */
export function compareNames(a: string, b: string): number {
  const locale = getDateLocale();
  if (loose === null || loose.locale !== locale) {
    loose = { locale, collator: new Intl.Collator(locale, { sensitivity: 'base' }) };
  }
  return loose.collator.compare(a, b);
}

/** For tests, and for a restore that rewrites preferences underneath us. */
export function forgetCachedFormatters(): void {
  counts = null;
  exact = null;
  loose = null;
}
