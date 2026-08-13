import type { ReactNode } from 'react';

/**
 * The ONE column definition the Accounts list's rows share.
 *
 * ─ WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The list draws two kinds of row: a top-level account card, and — for an
 * investment↔cash pair (the Microsoft Money model) — a nested cash row inside
 * it. They showed the same figures under the same headings, and each laid them
 * out its own way: the card on a nine-column grid, the cash row on a flex line
 * with three hand-matched widths. So the two lines of figures did not line up,
 * and every later change to one of them had to be remembered into the other.
 *
 * Matching the numbers up again would have fixed today's misalignment and left
 * tomorrow's in place. What stops them drifting is that neither row owns a
 * column definition any more: both render <AccountRowColumns>, which is the
 * only place the template lives, and both fill it with the cells below in the
 * same order. A figure can only move for one row by moving for the other.
 *
 * ─ THE COLUMNS, LEFT TO RIGHT ──────────────────────────────────────────────
 *   1 Bank Bal      what the bank last said (empty for a row with no feed)
 *   2 Account Bal   what the ledger says
 *   3 Unreconciled  how many rows have not been agreed with the bank
 *   4 To Review     how many freshly-imported rows nobody has dealt with
 *   5–9             five action slots, always all five, so the buttons in
 *                   them land at the same x on every card whether or not a
 *                   given account has that action (portfolio, bank feed,
 *                   settings, reconcile, close).
 *
 * A row that has nothing for a column renders <AccountRowEmptyCell /> rather
 * than dropping the column: an omitted cell pulls everything to its right one
 * place along, which is precisely the alignment this file exists to keep.
 *
 * ─ PHONES ──────────────────────────────────────────────────────────────────
 * Below sm the grid gives way to a wrapping row: the stat columns need about
 * 490px and a phone card offers ~330, so the figures take one line and the
 * buttons the next. The balance is shown beside the account NAME at that width
 * instead (where a banking app puts it), which is why AccountBalanceCell can be
 * asked to keep itself off small screens rather than saying it twice.
 */

/**
 * The template itself. Fixed widths, not fractions: a column that sized itself
 * to its content would be a different width on every card, and lining the cards
 * up with each other is the whole point.
 */
export const ACCOUNT_ROW_COLUMNS_CLASS =
  'flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:grid ' +
  'sm:grid-cols-[6.5rem_7.5rem_5.5rem_5.5rem_repeat(5,3rem)] ' +
  'sm:justify-items-end sm:items-center sm:gap-x-2 sm:gap-y-0';

/**
 * The look of a row the user has picked out, echoing the register's own active
 * row (.selected-transaction-row in index.css): the same blue wash, the same
 * #6B86B3 ring, the same two-layer elevation that lifts the row off the page.
 *
 * Echoed in utilities rather than by wearing that class, because three of its
 * declarations belong to a table row and not to a card: a forced `margin: 4px 0`
 * would fight the list's own spacing (and make a card twitch as it is selected),
 * `border-radius: 12px` would square off the card's 16px corners, and
 * `font-weight: 600` would embolden every word on the card rather than mark it.
 * What is left — colour, ring, lift — is the part that means "this one", and it
 * is what is copied here.
 *
 * ─ WHY `border-transparent` IS IN A LIST OF SELECTION COLOURS ───────────────
 * Because a row wears a 1px `border` at every moment of its life — the width is
 * geometry, held constant so a card cannot jump 1px as it is picked out — and a
 * border with no colour of its own does not stay invisible. Tailwind's preflight
 * gives every element `border-color: #e5e7eb`, so a selected row that named no
 * colour drew that near-white hairline on three sides while the fourth kept the
 * list's divider (#e2e6ed light, gray-700 dark) — a second and third tone packed
 * against the ring, which is the "two colours in the border" the owner saw. It
 * is worst in dark mode, where #e5e7eb is a light-mode grey sitting on a dark
 * card. Naming the colour transparent here leaves the ring as the only stroke
 * the row draws, uniform on all four sides.
 *
 * This is a state's OWN colour rather than a fight with the base class: the row
 * that is NOT selected names `border-transparent border-b-line …` for itself
 * (see Accounts.tsx). Neither state has to outrank the other in a cascade whose
 * order between `border-*`, `border-b-*`, `last:` and `dark:` is Tailwind's to
 * decide and not ours to depend on.
 */
export const ACCOUNT_ROW_SELECTED_CLASS =
  'relative z-10 bg-blue-50/80 dark:bg-blue-900/30 border-transparent ' +
  // ─ ONE STROKE WHEN THE KEYBOARD IS DRIVING ─────────────────────────────────
  // `focus-visible:ring-0` because otherwise an arrowed-to row wears TWO
  // concentric strokes: this SELECTION ring, and — 2px further out — the
  // app-wide `*:focus-visible { outline: 2px solid var(--focus-ring-color) }`
  // in accessibility-colors.css, which carries `!important` and so cannot be
  // turned off by the row's own `focus:outline-none`. Light mode resolves that
  // variable to the brand navy, which is why it read as "a blue and a black
  // double border". Clicking never showed it, because a click does not match
  // :focus-visible — so the same row looked clean by mouse and doubled by
  // keyboard.
  //
  // The FOCUS outline is the one kept, deliberately: it is the app's single
  // focus indicator, it is what every other control uses, and it is the stroke
  // with a contrast obligation (WCAG 2.4.11). The selection ring stands down
  // while the row holds focus and comes back the moment focus leaves — and the
  // blue wash and the lift never go anywhere, so a selected row still reads as
  // selected either way.
  //
  // THIS ONE SURVIVED THE APP-WIDE SWEEP, and it is the only `ring-0` left.
  // Every component-level `focus-visible:ring-*` came out in
  // RULINGS_ON_CAUSE_2026-08-13 §3, on the grounds that a component declaring
  // its own ring paints a second one over the global outline. The ruling
  // expected this workaround to come out with them as having "nothing left to
  // fight" — but what it suppresses is not a focus ring. It is the `ring-1`
  // selection indicator on the SAME element, three classes to its left, which
  // is §6 law and stays. Delete this and a selected, arrowed-to row wears both
  // strokes again, which is the exact bug that was reported.
  'ring-1 ring-[#6B86B3]/50 dark:ring-[#6B86B3]/70 focus-visible:ring-0 ' +
  'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] ' +
  'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_10px_15px_-3px_rgba(0,0,0,0.3)]';

/**
 * The account NAME as a link — one definition, worn by both kinds of row.
 *
 * ─ WHY IT HUGS ITS OWN TEXT ────────────────────────────────────────────────
 * The name opens the register and the rest of the row picks the row out. That
 * division only holds if the link's HIT AREA ends where the letters end. As a
 * plain `block` (what shipped) the anchor filled its whole flex track, so a
 * click in what looks like empty row a hand's width right of a short name still
 * landed on the link and opened the account — the hover underline and the
 * "Open …" tooltip appearing under a cursor nowhere near the text. `w-fit`
 * (width: fit-content) is the cure: the box is as wide as the name and no
 * wider, at whatever length that name happens to be. Everything past the last
 * character is row background, and row background selects.
 *
 * ─ THE OTHER THREE ARE NOT DECORATION ──────────────────────────────────────
 * `block`      an inline <a> cannot be clipped at all (overflow does not apply
 *              to a non-replaced inline box), so a long name could not ellipse.
 * `max-w-full` fit-content of a nowrap line is the FULL text width however long
 *              it runs, so without a cap a long name would sail out over the
 *              figures to its right instead of truncating.
 * `truncate`   the ellipsis itself — which only has an edge to break against
 *              because of the cap above.
 * Drop any one of the four and either the hit area or the truncation goes.
 *
 * ─ WHAT IS DELIBERATELY NOT IN HERE ────────────────────────────────────────
 * The type/wallet icon beside the name stays OUTSIDE the link. Clicking an
 * item's icon to open it is a fair convention, but the rule this page can then
 * state in one line — "the letters open it, anything else on the row picks it
 * out" — is worth more than the extra few pixels, and a decorative type glyph
 * is not the account's name.
 *
 * Resting colour is the caller's (a nested cash row is drawn quieter than the
 * card it sits in); the geometry and the hover are shared, so the hit area
 * cannot come out right for one kind of row and wrong for the other. The link
 * declares NO focus ring: it used to carry `focus:outline-none
 * focus-visible:ring-2 focus-visible:ring-blue-500`, which painted a blue ring
 * INSIDE the app-wide focus outline — the same doubling the selected row above
 * had to work around. The global outline is the app's one focus ring
 * (RULINGS_ON_CAUSE_2026-08-13 §3), and `rounded` is kept because the outline
 * follows the border radius.
 *
 * On touch, index.css floors every anchor at 44×44 — a hit area small enough to
 * miss is its own failure, and 44px beside a four-letter name is still nothing
 * like the full width of the row.
 */
export const ACCOUNT_ROW_NAME_LINK_CLASS =
  'block w-fit max-w-full truncate rounded transition-colors ' +
  'hover:text-blue-600 dark:hover:text-blue-400 hover:underline';

/** The column heading over a figure — small, quiet, and the same for every row. */
const CELL_LABEL_CLASS = 'text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500';

/**
 * The same label ON A ROW: drawn on a phone, spoken everywhere.
 *
 * From `sm` up the band's header strip says these four words once, so repeating
 * them on every row is ink for something already answered — but `sr-only`
 * rather than `hidden`, because a screen reader reads a row as a row and would
 * otherwise hear four bare figures. The strip is `aria-hidden` for the mirror
 * image of the same reason.
 */
const ROW_LABEL_CLASS = `${CELL_LABEL_CLASS} sm:sr-only`;

/** The figures themselves: tabular so the digits line up down the column. */
const CELL_FIGURE_CLASS = 'text-sm font-semibold tabular-nums';

/**
 * The columns of one row.
 *
 * Its children ARE the nine slots, in order — there is no way to render this
 * grid without going through here, which is what keeps the two row types in
 * step.
 */
export function AccountRowColumns({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div data-account-columns className={ACCOUNT_ROW_COLUMNS_CLASS}>
      {children}
    </div>
  );
}

/**
 * The BOX a row's grid sits in — the padding and border of the account card,
 * with none of its colour. The header strip wears it so its labels land at the
 * same x as the figures below them, and keeps landing there if the card's
 * padding is ever changed.
 *
 * Kept beside the column template deliberately: these two together are what
 * "a column of this list" means, and splitting them across files is how the
 * strip and the rows would come to disagree.
 */
export const ACCOUNT_ROW_COLUMN_HEADER_BOX_CLASS = 'p-3 sm:p-4 border border-transparent';

/** What the four figure columns are called, in the template's own order. */
const COLUMN_LABELS = ['Bank Bal', 'Account Bal', 'Unreconciled', 'To Review'] as const;

/**
 * The four column names, said ONCE for a band instead of once per row.
 *
 * ─ WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Every row carried its own labels — twenty-odd repetitions of the same four
 * words down a list, which is the cost of a card that has to explain itself in
 * isolation. The reconciliation list was given one strip per group in the
 * August design pass; this page never was, and the omission surfaced when a
 * design objection was drafted on the assumption that a header strip existed
 * here to be made sticky. It did not. This is that strip.
 *
 * ─ IT WEARS THE ROW'S OWN TEMPLATE ─────────────────────────────────────────
 * `ACCOUNT_ROW_COLUMNS_CLASS`, unchanged — the same fixed widths and the same
 * nine slots, four named and five empty. A strip that declared its own columns
 * would be a second definition of the grid and would drift from the rows on the
 * first edit, which is the exact failure this module was created to stop.
 *
 * ─ FROM `sm` ONLY, BECAUSE THAT IS WHERE THE GRID IS ───────────────────────
 * Below `sm` the template gives way to a wrapping row and a card is read on its
 * own rather than as part of a table, so the per-cell labels stay there and this
 * does not render. The labels and the strip are the same information at two
 * widths; neither surface ever shows both.
 */
export function AccountColumnHeader(): React.JSX.Element {
  return (
    <div
      data-account-column-header
      // `aria-hidden`: each cell keeps its own visually-hidden label, so a
      // screen reader already hears "Bank Bal £6,378.06" per row and does not
      // need the strip read to it as four loose words.
      aria-hidden="true"
      /*
       * `justify-end` and the row card's own right inset, because the grid is
       * CONTENT-SIZED inside each row and pushed to the right by the account
       * name beside it. Measured before this was written: as a plain block grid
       * the strip filled the container and packed its fixed columns at the LEFT,
       * putting "Bank Bal" 471px away from the figures it names. The row's card
       * carries `p-4` and a 1px border inside the band's own `px-4 sm:px-6`, so
       * the strip repeats both to land on the same right edge.
       */
      className="hidden sm:flex justify-end pb-1"
    >
      {/* AN INVISIBLE ROW CARD around the labels, rather than a hand-tuned
          right margin. A row's grid is inset from the band by the card's own
          `p-3 sm:p-4` and its 1px border — 17px at this width — and a strip
          that hard-coded 17 would drift the moment that padding changed, which
          is exactly how the page shell's `calc(100vh-13rem)` came to be 40px
          wrong. Wearing the same box means the labels move when the rows move. */}
      <div className={`${ACCOUNT_ROW_COLUMN_HEADER_BOX_CLASS}`}>
      <div className={ACCOUNT_ROW_COLUMNS_CLASS}>
        {COLUMN_LABELS.map(label => (
          <p key={label} className={CELL_LABEL_CLASS}>{label}</p>
        ))}
        {/* The five action slots, empty — the grid has nine columns, and a strip
            that stopped after four would right-align its labels against the
            wrong edge. */}
        {[0, 1, 2, 3, 4].map(slot => <span key={slot} aria-hidden="true" />)}
      </div>
      </div>
    </div>
  );
}

/**
 * A money figure in its column.
 *
 * `smOnly` keeps the cell off phones, where the same figure is shown beside the
 * account name; the cell still exists in the grid at every other width.
 */
export function AccountBalanceCell({
  label,
  value,
  smOnly = false,
}: {
  label: string;
  value: string;
  smOnly?: boolean;
}): React.JSX.Element {
  return (
    <div className={smOnly ? 'hidden sm:block text-right' : 'text-right'}>
      <p className={ROW_LABEL_CLASS}>{label}</p>
      <p className={`${CELL_FIGURE_CLASS} text-gray-900 dark:text-white`}>{value}</p>
    </div>
  );
}

/**
 * A count of outstanding work: readable while there is some, quieter when
 * there is none. Neither is a colour with a meaning.
 *
 * It wore amber until DESIGN_RULINGS_2026-08-12 (ruling A): amber marks the
 * CONTROL you should touch next — a single, clickable next action — and this
 * is a count, which reports a quantity and does nothing when clicked. Two
 * ambers on one screen where one is actionable and one is not teaches the eye
 * that amber means "look here-ish", eroding the one signal the yellow thread
 * depends on. If the row should invite the work, the invitation belongs on
 * the row's reconcile control, which already exists.
 *
 * ─ AND THE ZERO STOPPED BEING THE LOUDEST THING ON THE ROW ─────────────────
 * That de-ambering left an inversion behind, which is worth naming because it
 * was introduced by fixing something else: the count WITH work went quiet
 * slate while the ZERO kept the app's link blue, so a row with nothing to do
 * shouted across the page and a row with thirty outstanding rows murmured.
 * Colour marks what needs attention — ruling A's own argument — and a zero
 * needs nothing. Neither state is coloured now; the one with work is simply
 * legible and the one without recedes. (The same correction shipped on the
 * reconciliation list as finding §1.4, where a settled row wore a link-blue
 * pill for the ABSENCE of work.)
 *
 * A QUIET 0 RATHER THAN A BLANK, unlike the register's own counters, and the
 * difference is the surface rather than an inconsistency: this is a COLUMN, and
 * a column of figures with a hole in it reads as "not known" — the eye has to
 * stop and work out which. The register's counters are chrome, and there it is
 * absence that means "nothing to do".
 */
export function AccountCountCell({
  label,
  count,
}: {
  label: string;
  count: number;
}): React.JSX.Element {
  return (
    <div className="text-right">
      <p className={ROW_LABEL_CLASS}>{label}</p>
      <p
        className={`${CELL_FIGURE_CLASS} ${
          count > 0 ? 'text-slate-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {count}
      </p>
    </div>
  );
}

/**
 * A column this row has nothing for.
 *
 * Rendered from sm up only: that is where the grid is, and where a missing cell
 * would shunt everything after it out of line. Below sm the columns are a
 * wrapping flex row, and an invisible item there would only add a gap.
 */
export function AccountRowEmptyCell(): React.JSX.Element {
  return <div className="hidden sm:block" aria-hidden="true" />;
}

/**
 * One of the five action slots.
 *
 * Rendered whether or not this row has that action — an account with no bank
 * feed keeps an empty feed slot rather than letting the buttons after it
 * shuffle left, because muscle memory is the point. A row that has no such
 * action AT ALL (a cash sleeve has no portfolio and no feed) uses
 * AccountRowEmptyCell instead, which costs nothing on a phone.
 */
export function AccountRowActionSlot({ children }: { children?: ReactNode }): React.JSX.Element {
  return <div className="flex items-center justify-end">{children}</div>;
}
