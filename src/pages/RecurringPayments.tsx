import React from 'react';
import PageWrapper from '../components/PageWrapper';
import RecurringCommitmentsReport from './reports/RecurringCommitmentsReport';
import MixedCurrencyDisclosure from '../components/MixedCurrencyDisclosure';

/**
 * Plan → Recurring Payments (owner's ruling, 18 Aug: the MENU says what the
 * page is; the HEADING keeps the question the page answers).
 *
 * This used to be a Reports gallery entry. It moved out because it is not a
 * read-out: confirming patterns here is what feeds the calendar's forward
 * view and, next, the forecast — which makes it a working surface among the
 * forward-looking pages, beside Budget and Calendar. The old address,
 * /reports/recurring-commitments, redirects here so a bookmark or a pinned
 * link keeps working.
 */
export default function RecurringPayments(): React.JSX.Element {
  return (
    <PageWrapper title="What I'm committed to">
      {/* Phase 0 (the disclosure ruling, 22 Aug §2): the annual totals below
          still sum each commitment in its account's own units — said here
          until their conversion phase. Nothing for a single-currency ledger. */}
      <MixedCurrencyDisclosure className="mb-4" />
      <RecurringCommitmentsReport />
    </PageWrapper>
  );
}
