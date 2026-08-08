import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'an explicit window of zero pairs the same day and refuses the next one',
  design: 'src/utils/statementDuplicates.ts:229-235, :288-290',
  consequence: 'a caller that has a reason to want no settlement slack must actually get none',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      date_tolerance_days: 0,
      incoming: [incoming({ date: '2027-02-07', amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'next-day', date: '2027-02-08', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
