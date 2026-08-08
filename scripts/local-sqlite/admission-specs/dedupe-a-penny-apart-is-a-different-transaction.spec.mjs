import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'a penny apart is a different transaction, however close it looks',
  design: 'src/utils/statementDuplicates.ts:142-152 — exact pence, Decimal in, integer out',
  consequence: 'a near-miss suppressed is a payment the user never sees again',
  parity: 'match',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ amount: '-77.46', description: 'Direct Debit - TELCO LTD  447221900-00007', fit_id: 'fit-1' })],
      held: [held({ id: 'telco', amount: '-77.45', description: 'Direct Debit - TELCO LTD  447' })],
    },
  },

  expect: { outcome: 'ok' },
  result: { certain: [], possible: [] },
};
