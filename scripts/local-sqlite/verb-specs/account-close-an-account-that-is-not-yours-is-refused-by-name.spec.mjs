import {
  USER, EVERYDAY, STRANGER, secondUser,
  accountFlag, balanceIdentityHolds,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'closing another login’s account changes nothing, and says so here',
  design: 'accountService.deleteAccount’s optional `.eq(\'user_id\', userId)`, which RLS makes belt-and-braces in production',
  consequence: 'closing somebody else’s account takes it out of their pickers and hides its transfer category. Reporting success for a write that did nothing is how a caller stops checking',
  parity: 'divergent',
  reason: 'a PostgREST UPDATE that matches no row is a successful request affecting zero rows. The verb reads the row under the same clause first and refuses by name, so "changed nothing" and "was not allowed to" stay distinguishable',

  setup: secondUser,

  command: {
    verb: 'close_account',
    payload: { id: EVERYDAY, user_id: STRANGER },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'account_not_found_or_not_owned' },
    postgres: { outcome: 'ok' },
  },

  state: [
    accountFlag(EVERYDAY, 'is_active', 'yes'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
