import { USER, accountsOwned } from './_shared.mjs';

const NOBODYS_ACCOUNT = 'a0000000-0000-0000-0000-0000000000ff';

export default {
  invariant: 'X-6',
  title: 'closing an id that does not exist is refused here and reported as success by the cloud',
  design: 'the two cases are deliberately one refusal — telling "no such account" from "not your account" confirms an id exists to a caller who may not see it (crate::row::account::read_owned)',
  consequence: 'a close that quietly does nothing is a Close button that appears to work while the account stays in every picker',
  parity: 'divergent',
  reason: 'the same reason as the ownership spec beside this one: a PostgREST update matching zero rows is not an error there, and is a named refusal here',

  command: {
    verb: 'close_account',
    payload: { id: NOBODYS_ACCOUNT, user_id: USER },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'account_not_found_or_not_owned' },
    postgres: { outcome: 'ok' },
  },

  state: [accountsOwned('2')],
};
