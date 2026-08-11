import { USER, EVERYDAY, STRANGER, secondUser, accountText, balanceIdentityHolds } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'an update naming another login’s id changes nothing, and says so here',
  design: 'accountService.updateAccount’s optional `.eq(\'user_id\', userId)` — "defence-in-depth so a caller that knows the owner can never touch a mis-routed row"',
  consequence: 'an account edited under the wrong owner is somebody else’s ledger being renamed. The cloud reports success because a PostgREST update that matches nothing is not an error',
  parity: 'divergent',
  reason: 'a PostgREST UPDATE that matches no row is a successful request affecting zero rows — there is nothing to raise. The verb reads the row under the same clause first and refuses by name, which is what lets a caller tell "changed nothing" from "was not allowed to"',

  setup: secondUser,

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: STRANGER, patch: { name: 'Mine now' } },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'account_not_found_or_not_owned' },
    postgres: { outcome: 'ok' },
  },

  state: [
    accountText(EVERYDAY, 'name', 'Everyday'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
