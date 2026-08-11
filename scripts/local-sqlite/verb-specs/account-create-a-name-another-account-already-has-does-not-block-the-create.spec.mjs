import {
  USER, NEW_ACCOUNT, RAINY_DAY,
  transferCategoriesFor, accountsOwned, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// C-3's collision guard, reached through the verb. Account names are not
// unique; categories are UNIQUE (user_id, name, parent_id). The two rules meet
// here, and the create has to survive the meeting.
export default {
  invariant: 'C-3',
  title: 'a second account with an existing name is created, and gets no To/From category',
  design: '20260708140000:57-78 — `ON CONFLICT (user_id, name, parent_id) DO NOTHING`, so "a clash keeps the old category name (or skips creation) rather than aborting the surrounding operation"',
  consequence: 'aborting here would make an account impossible to create because of a name somebody used months ago — during a bank sync or a migration, with no way for the user to know what the objection was',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: { id: NEW_ACCOUNT, user_id: USER, name: 'Rainy day', type: 'savings' },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { id: NEW_ACCOUNT, name: 'Rainy day' },

  state: [
    accountsOwned('3'),
    // The clash is REAL: the fixture's Rainy day already owns that name.
    transferCategoriesFor(RAINY_DAY, 'To/From Rainy day:open'),
    // And the new one goes without, which verify_integrity reports as
    // `account_missing_transfer_category` rather than hiding.
    transferCategoriesFor(NEW_ACCOUNT, 'NONE'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
