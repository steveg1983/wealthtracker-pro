// BEYOND THE VITEST SUITE. The other half of the same guard: an empty
// destination cannot make anything a self-transfer, so the answer is admitted
// rather than a refusal a caller would have to interpret.
import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'an empty destination account is not a self-transfer either',
  design: 'src/utils/transferMatch.ts:90',
  consequence: 'refusing on a blank account would make every suggestion fail for a caller '
    + 'that had not yet resolved the destination, which is a different error entirely',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [category({ id: 'to-from-current', is_transfer_category: true, account_id: 'current' })],
      category_id: 'to-from-current',
      account_id: '',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: true, refusal: null },
};
