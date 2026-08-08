// TS-I8, and the incident it exists for: the importers automatic categoriser
// keys on the generic payment channel — "immediate faster payment", "direct
// debit" — which a swept account own internal sweeps share with every
// third-party payment on the statement. So ordinary direct debits arrived filed
// as transfers to the very account they sat in.
import { category } from './_shared.mjs';

export default {
  invariant: 'TS-I8',
  title: 'a transfer to the account the row is already in describes nothing',
  design: 'src/utils/transferMatch.ts:71-94; applied ofxImportService.ts:595, '
    + 'qifImportService.ts:415',
  consequence: 'ordinary spending filed as an internal transfer disappears from every '
    + 'expense report, because a transfer is not spending',
  parity: 'match',

  command: {
    verb: 'plan_category_admission',
    payload: {
      categories: [
        category({ id: 'to-from-current', is_transfer_category: true, account_id: 'current' }),
        category({ id: 'to-from-savings', is_transfer_category: true, account_id: 'savings' }),
      ],
      category_id: 'to-from-current',
      account_id: 'current',
    },
  },

  expect: { outcome: 'ok' },
  result: { admitted: false, refusal: 'self_transfer' },
};
