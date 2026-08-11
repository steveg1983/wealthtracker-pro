import {
  USER, NEW_ACCOUNT,
  accountText, balanceIdentityHolds, transferCategoriesFor, writeInstants,
} from './_shared.mjs';

// A create with nothing but a name. Every other value in the answer is a
// DEFAULT, and each one is the cloud writer's rather than the column's.
export default {
  invariant: 'D-2',
  title: 'a create with only a name takes the writer’s defaults, not the column’s',
  design: 'accountService.createAccount:229-233 — `mappedType || \'checking\'`, `currency || \'GBP\'`, `balance || 0`, `isActive !== undefined ? isActive : true`, and `|| null` on the four text columns',
  consequence: 'a default invented by one edition is an account that reads differently depending on where it was made — the exact class of gap the two account mappers produced',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: { id: NEW_ACCOUNT, user_id: USER, name: 'Bare' },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: {
    type: 'checking',
    currency: 'GBP',
    balance: '0.00',
    initial_balance: '0.00',
    is_active: true,
    institution: null,
    notes: null,
    sort_code: null,
    account_number: null,
    icon: null,
    color: null,
  },

  state: [
    // `|| null`, not the empty string: NULL and "not mentioned" store the same
    // thing in a column with no default, and an empty string does not.
    accountText(NEW_ACCOUNT, 'institution', 'NULL'),
    accountText(NEW_ACCOUNT, 'notes', 'NULL'),
    transferCategoriesFor(NEW_ACCOUNT, 'To/From Bare:open'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
