import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'an unreadable date on the incoming row leaves it unpaired',
  design: 'src/utils/statementDuplicates.ts:278-282',
  consequence: 'guessing a position on the calendar pairs the row with whatever happened to '
    + 'share its amount',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: 'not a date', amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'held', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
