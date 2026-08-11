import {
  USER, RAINY_DAY, closedRainyDay,
  accountFlag, transferCategoriesFor, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// There is no reopen verb, in either edition, and this is why none is needed.
export default {
  invariant: 'C-4',
  title: 'reopening is an ordinary update, and the To/From category comes back with it',
  design: 'the Closed Accounts section reopens by writing is_active = true; C-4 mirrors the flag onto the category in the same statement',
  consequence: 'a reopened account whose transfer category stayed hidden cannot be the far side of a transfer, so the register offers no way to move money into the account somebody has just brought back',
  parity: 'match',

  setup: closedRainyDay,

  command: {
    verb: 'update_account',
    payload: { id: RAINY_DAY, user_id: USER, patch: { is_active: true } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { id: RAINY_DAY, is_active: true },

  state: [
    accountFlag(RAINY_DAY, 'is_active', 'yes'),
    transferCategoriesFor(RAINY_DAY, 'To/From Rainy day:open'),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
