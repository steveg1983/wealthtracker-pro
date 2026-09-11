import { USER, EVERYDAY, FILED_ROW, everyShapeOfFiling,
  storedFlag, auditRowsForUpdate, balanceIdentityHolds } from './_shared.mjs';

// Taking a tick back says nothing about whether the row was looked at: a
// filed row that was bold stays bold, a filed row that was not stays not. The
// ELSE branch of the review CASE — and the reason it is a CASE rather than an
// unconditional write, exactly as the C/R column beside it.
export default {
  invariant: 'A-1',
  title: 'unmarking says nothing about review',
  design: 'set_transactions_cleared 20260911213000 — the ELSE branch of the needs_review CASE',
  consequence: 'un-ticking a row would either bold it for no reason or quietly end a review nobody did',
  parity: 'match',

  setup: {
    sqlite: `${everyShapeOfFiling.sqlite}
      UPDATE transactions SET is_cleared = 1, needs_review = 1 WHERE id = '${FILED_ROW}';`,
    postgres: `${everyShapeOfFiling.postgres}
      UPDATE public.transactions SET is_cleared = true, needs_review = true WHERE id = '${FILED_ROW}';`,
  },
  command: { verb: 'set_transactions_cleared', payload: { ids: [FILED_ROW], cleared: false, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(FILED_ROW, 'is_cleared', 'no'),
    storedFlag(FILED_ROW, 'needs_review', 'yes'),
    auditRowsForUpdate(FILED_ROW, '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
