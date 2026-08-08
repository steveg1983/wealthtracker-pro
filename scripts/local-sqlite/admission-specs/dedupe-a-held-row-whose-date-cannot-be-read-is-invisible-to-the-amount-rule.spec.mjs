import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'and an unreadable date in the REGISTER keeps that row out of the amount index',
  design: 'src/utils/statementDuplicates.ts:244-248 — the finite check on the held side',
  consequence: 'a row with no readable date has no position to compare, and pairing it on '
    + 'amount alone is pairing it on nothing',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'held', date: 'not a date', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
