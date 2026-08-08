import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'no category suggested, so no refusal to make',
  design: 'src/utils/transferMatch.ts:90',
  consequence: 'a blank suggestion refused would report a categorisation failure where there '
    + 'was no categorisation attempted',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [category({ id: 'to-from-current', is_transfer_category: true, account_id: 'current' })],
      category_id: '',
      account_id: 'current',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: true, refusal: null },
};
