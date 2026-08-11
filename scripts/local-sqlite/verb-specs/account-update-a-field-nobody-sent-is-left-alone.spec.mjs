import {
  USER, EVERYDAY,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// mapAccountToDb's first half: `undefined` is dropped, so an absent key is not
// an instruction. One class for every column, which is what makes the account
// patch simpler than the transaction one.
export default {
  invariant: 'TS-T3',
  title: 'an update touches only the keys it carries',
  design: 'mapAccountToDb (src/services/api/accountMapping.ts:227-237) — "undefined means leave this alone and is dropped"',
  consequence: 'a patch that blanked the fields it did not mention is the account settings modal writing back whatever it failed to load — the bug accountMapping.ts exists to have ended',
  parity: 'match',

  setup: {
    sqlite: `UPDATE accounts SET notes = 'keep me', institution = 'Made Up Bank'
              WHERE id = '${EVERYDAY}';`,
    postgres: `UPDATE public.accounts SET notes = 'keep me', institution = 'Made Up Bank'
                WHERE id = '${EVERYDAY}';`,
  },

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { name: 'Everyday spending' } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { notes: 'keep me', institution: 'Made Up Bank' },

  state: [
    accountText(EVERYDAY, 'notes', 'keep me'),
    accountText(EVERYDAY, 'institution', 'Made Up Bank'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
