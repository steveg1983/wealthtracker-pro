import { USER, EVERYDAY, COMMITTED_ROW, everyStateOfCommitment, everydayIsAnInvestment,
  setups, storedFlag, archivedRowsIn, accountText, balanceIdentityHolds } from './_shared.mjs';

// v1 excludes investment accounts, and the soft-archive migration says why:
// "their transfers/cost-basis want special handling". Both engines refuse with
// the cloud's own sentence, so a person reading the message gets the same words
// either way.
//
// The refusal comes BEFORE both writes, which is what the state assertions here
// are for: the committed row is still live and the account has no cutoff, so a
// port that archived first and checked the type second would fail this even
// while naming the right refusal.
export default {
  invariant: 'A-4',
  title: 'an investment account cannot be archived yet, and nothing of it moves',
  design: 'archive_transactions_before 20260810200000:310-312 (from 20260721130000:67-69)',
  consequence: 'an investment account\'s cost basis is hidden from the register with no handling for its transfers',
  parity: 'match',

  setup: setups(everyStateOfCommitment, everydayIsAnInvestment),
  command: {
    verb: 'archive_transactions_before',
    payload: { account_id: EVERYDAY, cutoff: '2024-02-28', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'investment accounts cannot be archived yet' },

  state: [
    storedFlag(COMMITTED_ROW, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    accountText(EVERYDAY, 'archive_through_date', 'NULL'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
