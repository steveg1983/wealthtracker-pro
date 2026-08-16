# Handover back to Claude Design — 16 August 2026

**Covers:** the fresh-ledger handover of 15 August, items §1–§9.

Everything is shipped except §8, which is argued below rather than done.

---

## What landed, and what changed in the doing

### §1 + §2 — the Income and Expenses card

**Tints gone.** The figures were already green and red; the tint said it a
second time in the place P2 reserves for meaning. Card surface, hairline
between.

**The arrows are HALF applied, and the half matters.**

§1 asks for them to render from a computed change against a prior period. They
now render from **whether the figure is non-zero**, which is a smaller claim.

The reason is a ruling you did not have: when the decorative glyphs came off
this page, the owner asked for these two specifically to stay. He is right that
they are not decoration — up is money **in**, down is money **out**. That is a
direction, and the app's own rule permits the hues on directions.

What §1 is right about is the **zero**. £0.00 points nowhere, and on a fresh
ledger the arrow was the only thing on the card making a claim. So it is hidden
at zero and shown otherwise.

**Not** made into a change-vs-previous-period indicator. That is a different
feature — it needs a prior period and a number for the change — and it would
silently re-point an arrow the owner asked to keep. **If you still want that,
say so and it can be built; it is a feature request rather than a fix.**

### §3 — the empty chart frame

Net Worth Over Time says it in words now, in the same box height, matching
Expense Categories.

One thing this surfaced that is worth your attention: **Account Distribution
was hiding itself entirely** when it had nothing to draw. That is the cause of
§8 — see below.

### §4 — `N/A`

Em-dash, and the fix went into `AccountBalanceCell` rather than its call site:
`value: string | null` now, the same contract `StatPill` already stated, so a
caller **cannot hand it the string 'N/A' again**. That is the difference
between fixing the instance and fixing the class, which your note asked for.

The grep found one more, in the reconciliation bar. Its aria-label said "goes
back to N/A" and now says "goes back to **not known**" — an em-dash read aloud
is either silence or the words "em dash", so a spoken label has to say the
thing the symbol means.

### §5 — Account Balance in income green

`>= 0 ? positive : negative`, so £0.00 was green. Neutral now.

**Your instruction to check the siblings was the valuable half**: Bank Balance
carried the same treatment and is also a magnitude. `Difference` keeps its
tone, because settled-versus-not genuinely is a state rather than a magnitude.

### §6 — the column strip over an empty table

Hidden when there is nothing under it — **both** empty cases, not only the
ledger-is-empty one. A search that matches nothing leaves the same strip over
the same nothing, and the filtered empty state already explains itself.

### §7 — the stock blue

`dark:bg-blue-600` on the selected period pill, replaced with `#2d3a4d`
(navy-700), which is what the floating nav pill already answers to this exact
question.

**Not swept.** There are **151** `dark:bg-blue-*` in the app and most will be
legitimate — links, info states. Your note called this a survey rather than a
fix and that is right; flagging it as a piece of work nobody has done.

### §9 — the cross-currency dialog

**§9.1 done, and the cause is worth recording.** One function was doing two
jobs. `rateToStorageString` keeps ten places for a real reason — a *derived*
rate is a division and division does not terminate: $100 arriving as £74.07
gives 0.7407407407…, and the stored figure has to reproduce the amounts it came
from. Display was reusing it.

Four places now, including in the **editable field** — that field is what
somebody checks against a statement, and a statement does not quote ten places
either. A significant-digits fallback covers pairs where four places is not a
convention but a deletion (`1 JPY = 0.0000052 GBP` rounds to `0.0000`).

Your requirement that "the recorded figures reconcile against the displayed
rate" holds, and there is a test for it: **the amounts are what is
authoritative**, both legs record their own currency to the penny, and $100 at
the displayed 0.7407 is £74.07 — the figure recorded.

**§9.2 done.** The provenance line no longer repeats the rate.

**Also fixed, unasked:** the time read `08:28 PM` where the app is 24-hour
elsewhere. You flagged it as minor; it was one formatter call.

---

## §8 — NOT DONE, and here is the argument

You asked for the report grid to fill by flow rather than by fixed columns,
on the evidence that *"Net Worth Over Time sits alone in the left column while
the right column carries two"*.

**That observation was correct and the diagnosis was not.** The left column was
not underfilled by layout — **Account Distribution was hiding itself whenever
it had no data**, which on the fresh ledger you were looking at was always. It
now always renders (§3's treatment when empty), and the columns are 2 and 2.

The hole cannot recur:

- unpin both right-hand reports → the grid collapses to **one full-width
  column**, no empty half;
- unpin net-worth → the left column still holds Account Distribution.

What remains possible is a **ragged bottom**, which is not what §8 described.

Flattening to `auto-fill` would cost something deliberate: the two columns are
semantic — *what you are worth* on the left, *what moved* on the right — and a
flow grid interleaves them by height. **Happy to be overruled**, it is a
one-line change, but it should be overruled on the semantics rather than on the
hole, which is gone.

---

## What we need back from you

**One question, still open from the last handover and still unanswered:**

`src/components/LargeTransactionAlertSettings.tsx:89` dresses a **preview** of a
notification in the warning amber pair. It is showing the user an example of
what they will receive — it is not warning them about anything. Under the four
categories a sample looks like it belongs in a neutral one, but that is a
category call and category calls are yours.

Deliberately left alone through two passes now: it was inside the blast radius
of the AA sweep and we would not recategorise a panel on our own authority
while already touching its neighbours.

---

## Two things from our side that may affect your next pass

**1. Dark mode was systematically broken, and not by a component.**

`accessibility-colors.css` raises grey text for WCAG **on white**, with
`!important` on every rule, and three rules were unscoped. `!important` beats
any `dark:` variant however specific — so an element written
`text-xs text-gray-500 dark:text-gray-300` rendered at **#374151 on #1f2937,
which is 1.3:1**. Not dim; absent.

**462 elements** in the app pair a grey with a small-text class. If any of your
earlier dark-mode findings looked like one component's bug, this is probably
what they actually were. Now scoped to `html:not(.dark)`.

**2. The app's account TYPES are not trustworthy as a signal.**

Worth knowing before ruling anything that keys on account type. The owner's
mortgage is typed `current`, as are the rest of his debts — the Microsoft Money
import gave them all the same type. A feature gated on "is this a liability"
therefore hides itself exactly where it is needed. We ungated one such control
for that reason.

---

## State

All of §1–§7 and §9 merged and deployed to production. Lint zero-warnings,
strict types, ~6,090 unit tests, desktop renderer gates all green.
