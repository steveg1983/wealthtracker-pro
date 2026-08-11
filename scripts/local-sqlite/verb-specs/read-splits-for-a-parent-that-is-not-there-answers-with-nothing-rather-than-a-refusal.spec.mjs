import {
  USER, EVERYDAY,
  setups, plainSplitParent, pinnedLedgerTimes,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-12',
  title: 'an id that names no transaction of yours answers with an empty list, and says nothing about why',
  design: 'the cloud\'s query is .eq(\'transaction_id\', …) under RLS: a row belonging to somebody else matches the filter and is then removed by the policy, so the caller gets an empty array and cannot tell it from a row with no lines. The local read reproduces both halves — the id and the owner — and therefore reproduces the silence',
  consequence: 'this is row/account.rs\'s reasoning for not distinguishing "no such account" from "not your account", applied to lines: an answer that told the two apart would confirm that an id the caller cannot see exists',
  parity: 'match',

  // A real split IS in the file, so the empty answer is the id\'s doing rather
  // than the file\'s.
  setup: setups(plainSplitParent, pinnedLedgerTimes),
  command: {
    verb: 'splits_for',
    payload: { user_id: USER, transaction_id: '70000000-0000-0000-0000-00000000dead' },
  },
  expect: { outcome: 'ok' },
  result: { splits: [] },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
