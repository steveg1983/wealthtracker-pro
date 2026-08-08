// The file is not this account file, so the blank field is not an invitation.
import { account, ofxBank } from './_shared.mjs';

export default {
  invariant: 'TS-A3',
  title: 'a disagreeing sort code stops the account number being filled in too',
  design: 'src/utils/ofxAccountIdentifiers.ts:138-152 — the guard runs before either write',
  consequence: 'filling the blank half would make a half-wrong record look complete, which is '
    + 'the state that is hardest to notice and hardest to undo',
  parity: 'match',

  command: {
    verb: 'plan_account_identifiers',
    payload: { ofx: ofxBank(), account: account({ sort_code: '99-99-99' }) },
  },

  expect: { outcome: 'ok' },
  result: {
    values: { sort_code: '12-34-56', account_number: '12345678', card_last_four: '5678' },
    backfill: null,
  },
};
