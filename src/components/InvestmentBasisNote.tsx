/**
 * The one sentence that says how investments joined a value figure — shared
 * by every surface that takes the valuation term (slice 3b), so the wording
 * cannot drift between the net-worth report and the balance reports.
 *
 * Renders NOTHING when the ledger holds no valued positions — the
 * data-health rule: a user with no investment history has nothing to
 * qualify, and a basis line over nothing is noise. The two counted
 * degradations (positions with no usable price, price series in another
 * currency) each add their clause only when nonzero, naming the consequence:
 * those positions count at cost.
 */
import type { InvestmentValuation } from '../services/investments/investmentValuation';

interface InvestmentBasisNoteProps {
  valuation: InvestmentValuation;
}

export default function InvestmentBasisNote({
  valuation
}: InvestmentBasisNoteProps): React.JSX.Element | null {
  if (valuation.accountIds.size === 0) return null;

  const atCost = valuation.unpricedPositions + valuation.currencyMismatches;
  return (
    <p className="text-dense text-gray-500 dark:text-gray-400" data-testid="investment-basis">
      Investments are valued at the last recorded price on or before each date.
      {atCost > 0 && (
        <>
          {' '}
          {atCost} position{atCost === 1 ? '' : 's'} with no usable price count
          {atCost === 1 ? 's' : ''} at cost.
        </>
      )}
    </p>
  );
}
