import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'and one day further is not a pairing at all',
  design: 'src/utils/statementDuplicates.ts:71 — DEFAULT_STATEMENT_DATE_TOLERANCE_DAYS = 3',
  consequence: 'a window too wide suppresses a genuine repeat payment a week later',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: '2027-02-07', amount: '-63.20', description: 'Direct Debit - STREAMCO  00110022330044', fit_id: 'fit-1' })],
      held: [held({ id: 'streamco', date: '2027-02-11', amount: '-63.20', description: 'Direct Debit - STREAMCO' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
