/**
 * The geometry a responsive table and its loading placeholder must AGREE on.
 *
 * A separate module because it has two consumers that have to produce the same
 * number — the real row and the skeleton standing in for it — and because a
 * skeleton of the wrong height is a layout shift with extra steps, which is
 * the one thing skeletons exist to prevent (DESIGN_PASS §4). One function,
 * both callers: they cannot disagree about the height without disagreeing with
 * themselves.
 */

/**
 * The em-dash that stands where a figure isn't.
 *
 * Same character, and the same reasoning, as the reconciliation rule: a blank
 * cell is indistinguishable from a cell that failed to render, so "nothing
 * here" gets a mark of its own. (DESIGN_PASS §3.2.)
 */
export const ABSENT_VALUE = '—';

/**
 * The 1px hairline each row is ruled with, which BOTH numbers below have to
 * carry.
 *
 * Not pedantry — it was measured wrong first. Everything here is `border-box`,
 * and the skeleton row declares an explicit `height`, so its rule is drawn
 * INSIDE the number. A real row sizes itself from its content and puts the
 * rule OUTSIDE that, so `py-2` over a 20px line is a 36px row occupying 37px.
 * Three placeholder rows built on the smaller figure shift the table 3px when
 * the data lands, which is precisely the fault this whole mechanism exists to
 * prevent.
 */
const ROW_RULE = 1;

/**
 * The desktop row, in px: `py-2` twice over `text-body`'s 20px line, plus the
 * rule beneath it.
 *
 * MEASURED in the running app at 375px and 1280px: a two-row table is 74px
 * tall, so a row occupies 37. (`Find` derives 36 from the same padding
 * arithmetic, but hands its number to a virtualiser that sets the row height
 * explicitly, where the rule falls inside it.)
 */
export const DESKTOP_ROW_HEIGHT = 36 + ROW_RULE;

/** `py-3` twice: the mobile row's padding, above and below the fields. */
const MOBILE_ROW_PADDING_Y = 24;
/** One field: `text-body`'s line box, and every field is exactly one line. */
const MOBILE_FIELD_LINE = 20;
/** `space-y-1` between fields. */
const MOBILE_FIELD_GAP = 4;

/**
 * How tall a mobile row stands, given how many fields it carries.
 *
 * Derived rather than guessed, then CHECKED against the running app: a
 * three-field row measures 93px at 375px, which is what this returns for 3.
 * Every field is held to a single line (values truncate) so the arithmetic
 * stays true of real data rather than of the happy case — a wrapping value
 * would make the row taller than the placeholder that preceded it, which is
 * the shift all of this is here to avoid.
 */
export function mobileRowHeight(fieldCount: number): number {
  if (fieldCount <= 0) return MOBILE_ROW_PADDING_Y + ROW_RULE;
  return (
    MOBILE_ROW_PADDING_Y +
    fieldCount * MOBILE_FIELD_LINE +
    (fieldCount - 1) * MOBILE_FIELD_GAP +
    ROW_RULE
  );
}
