import { USER, EVERYDAY, BLANK_ROW, NULL_ROW, SPACES_ROW, everyShapeOfFiling,
  storedFlag, auditRowsForUpdate, balanceIdentityHolds } from './_shared.mjs';

// The other half of the ruling: "if it does not have a category or transfer
// then it has to be reviewed." A tick is not a filing. All three shapes of
// blank are marked, because `NULLIF(btrim(category), '')` is the predicate and
// a port that tested one shape would pass on a fixture holding only that one.
//
// The register would hold these three in To Review through its unfiled arm
// whatever the flag said; the flag is pinned anyway, because the two arms
// agreeing is what makes the count the same on every surface.
export default {
  invariant: 'A-1',
  title: 'marking an unfiled row cleared leaves it in review',
  design: 'set_transactions_cleared 20260911213000 — v_filed false for every shape of blank, so the CASE falls to needs_review',
  consequence: 'a tick quietly files a row nobody has categorised, and the unfiled backlog shrinks without anyone having filed anything',
  parity: 'match',

  setup: {
    sqlite: `${everyShapeOfFiling.sqlite}
      UPDATE transactions SET needs_review = 1
       WHERE id IN ('${BLANK_ROW}', '${NULL_ROW}', '${SPACES_ROW}');`,
    postgres: `${everyShapeOfFiling.postgres}
      UPDATE public.transactions SET needs_review = true
       WHERE id IN ('${BLANK_ROW}', '${NULL_ROW}', '${SPACES_ROW}');`,
  },
  command: { verb: 'set_transactions_cleared', payload: { ids: [BLANK_ROW, NULL_ROW, SPACES_ROW], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(BLANK_ROW, 'is_cleared', 'yes'),
    storedFlag(NULL_ROW, 'is_cleared', 'yes'),
    storedFlag(SPACES_ROW, 'is_cleared', 'yes'),
    storedFlag(BLANK_ROW, 'needs_review', 'yes'),
    storedFlag(NULL_ROW, 'needs_review', 'yes'),
    storedFlag(SPACES_ROW, 'needs_review', 'yes'),
    auditRowsForUpdate(BLANK_ROW, '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
