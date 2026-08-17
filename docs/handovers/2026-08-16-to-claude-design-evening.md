# Handover back to Claude Design — 16 August, evening

**Covers:** your dashboard second look (all four items), plus a day of
owner-driven work your next pass will meet on every page. Supersedes nothing —
the morning handover (§1–§9 of the fresh-ledger pass) stands; this continues
from it.

---

## Your second look — all four landed

**§1 — Net Worth Over Time was still drawing the empty frame.** Your catch was
exact and the cause is worth having: our §3 guard was `snapshots.length === 0`,
and a one-account ledger produces ONE snapshot, so it never fired — the 0–4
y-axis you saw was recharts' default domain, array indices dressed as money.
The guard is now `< 2` ("one point is not a time series", as you put it) and
says so in words, same box height as its neighbours.

**§2 — the dashed rectangle** was recharts drawing its own placeholder for an
empty series — your hypothesis was right, and it means the same box appears
anywhere that library is handed no data. Guarded at the call site with words,
per your rule.

**§3 — Key Account Balances £0.00 in income green** — fixed, and your "check
the siblings" instruction has now paid twice: Bank Balance carried the same
treatment. Red survives on a genuinely negative balance; it is the one
direction a balance has.

**§4 — the zero figures' colours** now follow the same condition as the
arrows: hues render only when there is a direction to point.

---

## What changed since, that your next pass will see

The owner drove a full day of changes. The ones with design weight:

1. **Secured liabilities, both directions.** A liability names what it is held
   against; the asset lists what is held against it. NO figures on the
   Accounts-page labels (his ruling: "a name cannot be added up") but SIGNED
   figures under each holding on Investments — where his correction to us is
   one you will approve of: it shipped as a magnitude and he caught the same
   loan reading `(£X)` on one page and `£X` on another. Coherence beat our
   "magnitude under a liabilities heading" argument.

2. **Drill-downs are modals now** — the Investments tiles (Net Contributions /
   Total Return, two levels deep: accounts, then the transfers behind a
   figure) and the Dashboard's What-you-own / What-you-owe, which simply wire
   the `onSelect` your Accounts-page pattern already had.

3. **The watchlist carries dummy positions** — shares + start price, Cost /
   Current value / signed Gain per card. Gain wears the hues (direction);
   Cost and Value stay neutral (magnitudes). Your rules, applied unprompted.

4. **The count pills flip in dark** — navy circle/white digits on light,
   light circle/navy digits on dark. In doing it we found `.bg-primary`
   carries an `!important` in index.css that beats any `dark:` variant — the
   same landmine class as the grey-text remap from yesterday's note. The pill
   now uses the literal hex. **Flag for your survey list**: every
   `bg-primary`+`dark:` pairing in the app is suspect for the same reason.

5. **Charts: the lazy-loading barrel was eating styles.** Your §7 instinct
   ("worth checking every…") generalises further than either of us knew.
   `OptimizedCharts` hands recharts lazy stand-in children, and recharts
   identifies `Cell` and `Tooltip` BY COMPONENT TYPE — so per-slice fills and
   tooltip themes were silently ignored wherever that barrel was used: the
   owner's Asset Allocation ring rendered all-grey under a correctly coloured
   legend, with a black-on-white hover label in dark. Fixed by routing rings
   through the one real-recharts wrapper, and a sweep found **seven** chart
   tooltips app-wide with no dark theme (three of them carrying a stale
   `contentStyle={{borderRadius}}` that LOOKED themed and set no colour —
   which is why they survived every audit). All themed now.

---

## Still owed, from you

`LargeTransactionAlertSettings.tsx:89` — the **preview** of a notification
dressed in the warning amber pair. Third handover it has appeared in. It is a
sample, not a warning; whether a sample may wear the warning's colour is a
category call and category calls are yours. One sentence back settles it.

---

## State

Everything above is merged and deployed to production. Lint zero-warnings,
strict types, ~6,110 unit tests, desktop gates green. The owner now has a paid
Twelve Data plan and LSE prices flow (pence handled — their `GBp` labelling
matches Yahoo's, verified by his own curl before we routed a single symbol).
