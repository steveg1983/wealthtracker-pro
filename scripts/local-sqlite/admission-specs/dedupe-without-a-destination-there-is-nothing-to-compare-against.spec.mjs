import { held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'an import with no destination account matches nothing at all',
  design: 'src/utils/statementDuplicates.ts:218-233',
  consequence: 'a blank destination that matched anything would compare a file against the '
    + 'whole register, across every account',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: '',
      incoming: [incoming({ amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'held', account_id: '', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
