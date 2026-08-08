import { ACCOUNT, OTHER_ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'the same amount on the same day in a different account is a different transaction',
  design: 'src/utils/statementDuplicates.ts:214-224 — "only rows in accountId are ever considered"',
  consequence: 'suppressing a row against another account\'s history hides half a movement of money',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-77.45', description: 'Direct Debit - TELCO LTD  447221900-00007', fit_id: 'fit-1' })],
      held: [held({ id: 'elsewhere', account_id: OTHER_ACCOUNT, amount: '-77.45', description: 'Direct Debit - TELCO LTD  447' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
