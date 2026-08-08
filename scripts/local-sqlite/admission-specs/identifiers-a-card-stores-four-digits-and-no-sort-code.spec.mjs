import { account, ofxCard } from './_shared.mjs';

export default {
  invariant: 'TS-A1',
  title: 'a credit account keeps the last four digits and nothing else',
  design: 'src/utils/ofxAccountIdentifiers.ts:154-164; src/utils/accountNumberInput.ts:12-25',
  consequence: 'anything stored is stored in plain text and reaches the backups, the JSON '
    + 'export and the audit history — a full card number must never get that far',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxCard(), account: account({ type: 'credit' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: null, account_number: null, card_last_four: '9012' },
    backfill: {
      // No sort code. A card does not have one, whatever the file contains.
      updates: { sort_code: null, account_number: '9012' },
      summary: 'card ending 9012',
    },
  },
};
