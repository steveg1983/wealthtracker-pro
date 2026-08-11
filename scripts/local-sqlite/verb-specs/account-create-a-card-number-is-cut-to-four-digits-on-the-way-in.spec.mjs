import {
  USER, NEW_ACCOUNT,
  balanceIdentityHolds, accountText, nowhereInTheAccounts, writeInstants,
} from './_shared.mjs';

// The seam's B-7 card rule, on the one engine pair that can prove both halves of
// it: the field holds four digits AND the number is nowhere in the file.
export default {
  invariant: 'TS-A1',
  title: 'a credit account stores the last four digits of its number and nothing else',
  design: 'accountNumberForStorage + isCardAccountType (src/utils/accountNumberInput.ts:105-111, :53); the cloud applies it in the service, the local edition inside the verb, from the same keepLastFour the admission lane already ports',
  consequence: 'a full card number written here lives on in every backup, JSON export and audit row taken afterwards — and the source does not matter, only the account type does',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Spending card',
      type: 'credit',
      // Card-shaped but invented. This repo is public.
      account_number: '1111222233334444',
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { account_number: '4444', type: 'credit' },

  state: [
    accountText(NEW_ACCOUNT, 'account_number', '4444'),
    // Not "the field was truncated" — the number is not in the table at all.
    nowhereInTheAccounts('1111222233334444', '0'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
