# Reply to your 17 August handover — all six findings landed, and the £-drift explained

Everything in §2 is implemented, the §1 ruling is applied as written, and §3
turned out to be answerable from the code. Causes below, because several were
not what either of us guessed.

---

## §1 — the specimen

As ruled: neutral container, hairline, an **Example** label in the quiet
uppercase the app uses for such things, and inside it the warning likeness
untouched — amber panel, amber icon, amber text. Your sentence about the
colour belonging to the thing illustrated is now the header comment on the
panel, so the next person who reaches to neutralise the amber inside reads
the ruling before they do it. Fourth handover, cleared.

## §2.1 — the ring closes over the whole now

The fold lives in `buildAccountDistribution` itself, not in either view — the
card and the report take their slices from one array, so they cannot fold
differently (the same one-implementation rule that already kept their
rankings in agreement). Four named slices plus "N smaller accounts", the
remainder computed by Decimal subtraction from the in-credit total so ring
and total agree by construction. The subtitle now says "Your top 4 accounts,
and the other N" — the words and the shape make the same claim.

Clicking the remainder can't open one register, so on the card it opens the
full report; on the report it scrolls you to the table that lists every
folded account.

## §2.2 — you were right that it wasn't five wrong values, but it wasn't a missing branch either

Your two hypotheses, in the order you asked them checked:

1. **The barrel** — eliminated first, per your instruction. Account
   Distribution renders through the real-recharts wrapper; the lazy barrel
   was never in its path.
2. **A missing light/dark branch** — no: one module, both ramps authored
   side by side. The values themselves were derived wrong.

The actual cause is worth keeping: the extension rule was *bisection* — each
adjacent ruled pair gets its midpoint. On the light ground the usable half of
the axis is the DARK half, where the ruled stops are only ~10 L* apart, so
bisection manufactured three near-black navies ~1.17:1 from each other. The
ordering maximised **adjacent** separation, which is the only thing that had
ever been measured — nobody had measured the pairs, and the pairs are what a
legend asks a reader to match.

Re-derived to your prescription: five steps spaced **evenly in CIE L***
along the same axis, darkest ruled stop to the lightest step clearing 3:1 on
`#f8f9fb`. Measured: L* 13.5 / 24.1 / 34.6 / 45.1 / 55.5 — ΔL* ≈ 10.5 every
step, all ≥ 3:1, no pair anywhere below 1.37:1 (was 1.17). Three of the five
are ruled stops; the two interpolations sit on the ruled navy-700→navy-400
segment. Dark keeps its shipped values — measured fine, and you said so.

One deliberate niceness: both ramps now END at `#6b86b3`, each ground's
quietest step — so the fifth slice, which is where the fold puts "the rest",
wears the receding colour on either theme with no special-casing at all.
Your §2.1 "remainder at the lightest step" and this reordering are one
mechanism.

Instrumented: the ramp test now measures adjacent separation (≥1.5:1), an
all-pairs floor, and the last-step-is-quietest invariant, with the repo's own
checker. Proven non-vacuous by reinstating one of the old navies and watching
it fail at 1.17:1.

## §2.3 — the April that was sixteen years

The cause: the labels were `month + 2-digit year` — "Apr 10" WAS April 2010,
a year indistinguishable from a day (and an American date at that, in an
en-GB app). Labels now carry the full year ("Apr 2010"), and the axis follows
your rule — the tick format follows the span. Multi-year windows get explicit
year ticks ("2010 · 2012 · …", stepped to at most ~9); positions are supplied
as well as format, because left to its own tick choice recharts can land two
inside one year and print "2010 · 2010". Under two years, month labels;
within a quarter, day-first dates. Same helper on the widget and the full
report, so card and report tick identically. Unit-tested at the span
boundaries.

## §2.4 — where the −6.0M came from

The series (the owner's, walked from first principles) does dip below zero
early on — invisibly at this compression — and recharts answered that one
negative stretch with a *nice-tick* floor several intervals deep. The domain
now follows the data: bottom at `min(0, dataMin)` exactly, so it extends
below zero only as far as the data does, and the curve gets the plot back.

## §2.5 — done as specified

The arrow sits after the amount, same baseline, on both halves. The
hidden-at-zero rule survives untouched. The dead right-hand half of each card
is gone — `justify-between` was the entire cause.

## §2.6 — it was an eighth AND two survivors, and now it cannot recur

Your instinct to ask which was right, and the answer is "all of the above":

- The **report page's** ring passed no style at all — a true library default.
- The **dashboard card's** ring passed a styled object… built by reading the
  dark class ONCE at render (the exact read-once trap the chart module's own
  header warns about, living one directory away).
- The **Net Worth report** carried another radius-only `contentStyle` the
  16 August sweep missed — a fourth survivor of that pattern.

The fix is structural rather than another sweep: the house tooltip is now the
wrapper's **default**. A caller that passes nothing gets the themed,
theme-watching style; the read-once block is deleted. And per your spec: the
backgrounds are now **opaque** (an overlay covers, it does not blend — the
translucent white over your legend rows was half the unreadability), the type
matches the axis scale, `tabular-nums` applies (every figure in a tooltip is
money), and the ` : ` separator is replaced by the house `: ` at all thirteen
themed tooltips. If your next capture still shows the box physically landing
on legend rows, that residue is positional and I'll bound it — but opaque
card-on-hairline should already read cleanly where it lands.

## §3 — the four-figure difference between your two captures

Answerable from the code, and the answer is reassuring: **nothing in the
net-worth display path can drift**. The figure is raw ledger arithmetic —
`formatCurrency` formats without converting, so no FX rate touches it; live
share quotes never write account balances; and the boot-time handover (the
server's Postgres-summed balances stand in until the transaction set lands)
computes the identical invariant over the identical rows, with a row-count
backstop that throws the local snapshot away rather than ever serving a
stale total.

So the only thing that can move that figure is a **row** — and between two
captures minutes apart that means a real write landed: a bank-feed sync, a
recurring transaction firing, or an edit from another device. Ledger
movement, not display drift. The cross-surface agreement you audited in §4
holds: both captures were right, minutes apart.

If the owner wants it pinned to the row, a user-scoped query listing
transactions written in the capture window will name it — say the word.

---

## For your survey list

Nothing new this time. The `bg-primary` `!important` entry from yesterday
stands; the lazy-barrel entry can be marked contained — every ring now goes
through the one real-recharts wrapper, and the tooltip default means the
wrapper is also where the house format lives.
