# The investment register — Money's model, what ships now, what remains

**Written 17 August 2026**, answering the owner's ask: charges on a purchase,
the cash leg out of a funding account, and "the investment account needs to
act as a proper investment register... do some research as to how MS Money
structured theirs."

## 1. How Microsoft Money actually structured it (measured, not remembered)

From the .mny import work (real files read table-by-table, plus the KB
archive) — the same sources that drive the importer:

- **The pairing is two real accounts.** An investment account and its cash
  account are separate rows linked 1:1 (`ACCT.hacctRel`); the cash side has
  its own register and reconciliation but no settings page of its own. This
  app mirrors that exactly — the nested "(Cash)" account — and deliberately
  lifts Money's one limitation (there the link could only be made at
  creation).
- **A buy is an investment transaction plus an optional cash leg.** The buy
  row lives in the investment register with security, units, price and
  commission; its **total** (units × price + commission) is what the linked
  cash leg moves. Measured across real files: 2,015 of 2,029 buys carried a
  cash leg, and the funding account was a **free choice** — any cash account,
  not just the paired sleeve.
- **Commission folds into cost.** Money's average cost is total paid ÷ shares
  held, charges included. There is no "cost excluding fees" figure anywhere
  in its UI.
- **Cash sufficiency is never enforced.** Sleeves run negative freely; only
  negative *share* balances are blocked.
- **Some flows never touch cash**: reinvested distributions (0 of 1,020 had
  a cash leg) and employer matches (0 of 92). A cash dividend always did
  (1,090 of 1,090).

## 2. What ships today (this change)

The Add-a-holding flow now carries Money's buy semantics without a schema
change:

- **Charges** (stamp duty, levy, commission) fold into the stored average
  cost — `allInAverageCost` in `services/investments/purchaseMath.ts` — so
  the derived cost basis is the money actually spent, with a provenance note
  on the holding. This is Money's own definition of average cost.
- **"Paid from"** offers any open account in the investment account's
  currency (the free choice, the paired cash sleeve sorted first) and writes
  the transfer through the same out-leg + `createTransferCounterpart`
  machinery every transfer uses. The investment account's register shows the
  arriving leg described as the buy ("Buy 100 SHEL.L"), so the ledger
  balance moves by the real cash cost.
- **The holding carries its own currency**, stated by its quote rather than
  assumed from the account, and the portfolio totals convert to the display
  currency instead of summing dollars into pounds.

Cross-currency funding is deliberately not offered in this dialog: the
counterpart write copies the row's digits, and a converted transfer needs its
confirmed figure (the CrossCurrencyTransferDialog flow, from the register).

## 3. What a full investment register would add, and what it costs

Money's register shows **investment columns** — activity, security, units,
price, charges, total — where ours shows a transfer row with a descriptive
line. Closing that gap properly means:

1. **An investment-transaction shape**: either a sibling table
   (`investment_transactions`: activity buy/sell/reinvest/dividend, units,
   price, charges, linked cash transaction id) or typed columns on the
   holding's history. Money uses the former.
2. **Sells and dividends**, which are where the shape earns its keep: a sell
   reduces units and realises a gain (cost-basis lot accounting — Money used
   average cost; FIFO is the HMRC-relevant alternative the owner may care
   about); a cash dividend writes income into the cash sleeve against the
   security.
3. **Register rendering** for investment accounts: the extra columns, shown
   only there — the account-type switch the register already does for cards.
4. **Reconciliation of units**, not just money: statements state holdings.

Each is real work with schema, importer and local-edition (Rust core)
consequences, so it should be sliced deliberately rather than ridden in on a
dialog change. The importer already understands Money's investment tables,
which means a future migration of his own history into this shape is
tractable.

**Recommended order** when picked up: sells (with average-cost realisation,
Money-compatible) → dividends into the sleeve → the register columns →
unit-level reconciliation.
