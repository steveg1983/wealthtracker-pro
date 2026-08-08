import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'a transfer to a DIFFERENT account is an ordinary suggestion',
  design: 'src/utils/transferMatch.ts:85-94',
  consequence: 'refusing every To/From category would switch off the one categorisation an '
    + 'importer is most often right about',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [
        category({ id: 'to-from-current', is_transfer_category: true, account_id: 'current' }),
        category({ id: 'to-from-savings', is_transfer_category: true, account_id: 'savings' }),
      ],
      category_id: 'to-from-savings',
      account_id: 'current',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: true, refusal: null },
};
