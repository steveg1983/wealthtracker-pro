/**
 * WHAT THE PORTFOLIO IS ACTUALLY IN — by security, not by account.
 *
 * The Asset Allocation ring answers "which of my accounts holds the money".
 * That is a question about where things are kept, and somebody with one broker
 * and six wrappers learns nothing from it. This answers the other one: how much
 * of the portfolio is Apple, how much is the bond fund, how much is sitting in
 * cash — across every account at once, because a holding split over an ISA and
 * a dealing account is one position.
 *
 * ─ WHICH NUMBER, AND WHY IT IS NOT THE LEDGER'S ────────────────────────────
 *
 * Securities are valued at `quantity × price`, which is the MARKET side of the
 * page. `Investments.tsx` states the rule this obeys: holdings × price is a
 * second opinion about the same money, and the ledger figures are the page's
 * truth — the two are never added together.
 *
 * Adding CASH to it does not break that rule, because cash and securities are
 * disjoint: an investment account's value is its holdings plus its settlement
 * cash, so summing market-valued securities with ledger cash produces one
 * coherent market-side total. What would break the rule is adding an account's
 * ledger value on top, and nothing here does.
 *
 * ─ UNPRICED HOLDINGS ARE COUNTED AND REPORTED, NEVER DROPPED ───────────────
 *
 * `marketValue` is null when a holding has never been priced. Such a position
 * cannot go in the ring — there is no number for it — but silently omitting it
 * would make the shares add to 100% of a total that is missing something the
 * user owns. So they are counted separately and handed back for the caller to
 * say out loud. A chart that quietly excludes part of your portfolio is the
 * same offence as a filtered-empty list claiming your money is gone.
 */
import { toDecimal, type DecimalInstance } from './decimal';
import type { InvestmentHolding } from '../services/investments/holding';
import type { PortfolioLine } from './portfolioSummary';

export interface HoldingAllocationSlice {
  /** Ticker where there is one, otherwise the holding's name. */
  key: string;
  label: string;
  value: DecimalInstance;
}

export interface HoldingAllocation {
  /** Securities by symbol plus, when there is any, a single Cash entry. */
  slices: HoldingAllocationSlice[];
  total: DecimalInstance;
  /** Positions with no price. Their value is unknown, so it is not in `total`. */
  unpricedCount: number;
  /**
   * How many of the slices are securities — i.e. everything except the one
   * Cash entry. Zero means the "allocation" is all settlement cash, and a
   * ring dividing one category into one part is a sentence's job (Claude
   * Design, 22 Aug §4). The caller needs the fact, not the inference from
   * slice labels.
   */
  securityCount: number;
}

/** The label for the one cash slice. Exported so the UI cannot misspell it. */
export const CASH_SLICE_LABEL = 'Cash';

export function buildHoldingAllocation(
  holdings: readonly InvestmentHolding[],
  lines: readonly PortfolioLine[]
): HoldingAllocation {
  const bySymbol = new Map<string, HoldingAllocationSlice>();
  let unpricedCount = 0;

  for (const holding of holdings) {
    if (holding.marketValue === null) {
      // Owned, and worth something unknown. See the note above.
      unpricedCount += 1;
      continue;
    }
    if (holding.marketValue.lessThanOrEqualTo(0)) continue;

    // Apple in an ISA and Apple in a dealing account are ONE position. The
    // symbol is the identity; the name is only what to print, and two rows for
    // the same ticker can spell it differently.
    const key = (holding.symbol || holding.name).trim().toUpperCase();
    const existing = bySymbol.get(key);
    if (existing) {
      existing.value = existing.value.plus(holding.marketValue);
    } else {
      bySymbol.set(key, {
        key,
        label: holding.name?.trim() || holding.symbol,
        value: holding.marketValue
      });
    }
  }

  // Every settlement sleeve in the portfolio, as ONE category — the owner's
  // ask, and the right shape: six brokers' cash is one answer to "how much of
  // this is not invested", and six slices of it would drown the securities.
  const cashTotal = lines.reduce(
    (sum, line) => line.cash.reduce((inner, cash) => inner.plus(cash.value), sum),
    toDecimal(0)
  );

  const slices = [...bySymbol.values()].sort((a, b) => b.value.comparedTo(a.value));
  if (cashTotal.greaterThan(0)) {
    slices.push({ key: '__cash__', label: CASH_SLICE_LABEL, value: cashTotal });
  }
  // Re-sorted so Cash takes its place by size rather than always trailing:
  // for most portfolios it is a small tail, but for one that has just sold up
  // it is the largest single thing and hiding it at the end would mislead.
  slices.sort((a, b) => b.value.comparedTo(a.value));

  return {
    slices,
    total: slices.reduce((sum, slice) => sum.plus(slice.value), toDecimal(0)),
    unpricedCount,
    securityCount: bySymbol.size
  };
}
