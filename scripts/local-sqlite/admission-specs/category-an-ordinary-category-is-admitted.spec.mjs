import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'Groceries is not a transfer to anywhere',
  design: 'src/utils/transferMatch.ts:85-94',
  consequence: 'the ordinary case, and the one a rule that only tested the ACCOUNT would break',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [category({ id: 'groceries' })],
      category_id: 'groceries',
      account_id: 'current',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: true, refusal: null },
};
