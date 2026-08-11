import {
  USER, EVERYDAY,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// mapAccountToDb's second half, and the whole reason AccountUpdate exists as a
// type distinct from Partial<Account>: `null` means "remove the stored value".
export default {
  invariant: 'TS-T3',
  title: 'a stated null clears the stored value rather than being ignored',
  design: 'AccountUpdate (src/types/index.ts:102) and mapAccountToDb — "null means clear the stored value and is kept"; a card’s sort code is cleared exactly that way',
  consequence: 'if null were treated as absence there would be no way to remove a sort code at all, and the field would be write-once for the life of the account',
  parity: 'match',

  setup: {
    sqlite: `UPDATE accounts SET notes = 'remove me', sort_code = '00-00-00' WHERE id = '${EVERYDAY}';`,
    postgres: `UPDATE public.accounts SET notes = 'remove me', sort_code = '00-00-00' WHERE id = '${EVERYDAY}';`,
  },

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { notes: null, sort_code: null } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { notes: null, sort_code: null },

  state: [
    accountText(EVERYDAY, 'notes', 'NULL'),
    accountText(EVERYDAY, 'sort_code', 'NULL'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
