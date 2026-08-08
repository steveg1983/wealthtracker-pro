import { USER, THEIR_ROW, WEEKLY_SHOP, everyShapeOfFiling, secondUser, strangersRow,
  setups, storedFlag, auditShape, balanceIdentityHolds, SOMEONE_ELSES_ACCOUNT } from './_shared.mjs';

// X-6 through the cursor rather than through a refusal, exactly as its sibling
// verb does — a bulk verb tells you how many decisions it recorded, not which of
// your ids were somebody else's.
export default {
  invariant: 'X-6',
  title: 'a suggestion on somebody else\'s row stays a suggestion',
  design: 'confirm_transaction_categories 20260808100000:456 — (p_user_id IS NULL OR user_id = p_user_id)',
  consequence: 'a mis-routed owner id marks another login\'s guesses as decisions they never made',
  parity: 'match',

  setup: setups(everyShapeOfFiling, secondUser, strangersRow, {
    sqlite: `UPDATE transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${THEIR_ROW}';`,
    postgres: `UPDATE public.transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${THEIR_ROW}';`,
  }),
  command: { verb: 'confirm_transaction_categories', payload: { ids: [THEIR_ROW], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(THEIR_ROW, 'category_confirmed', 'no'),
    auditShape('NONE'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
