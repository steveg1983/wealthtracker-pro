import {
  USER, EVERYDAY, RAINY_DAY, OPENED_SECOND,
  setups, namedTransferCategories, aStoredBalanceThatDrifted, pinnedReadTimes, pinnedLedgerTimes,
  listedAccount, balanceOf, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BOOT-5',
  title: 'the boot carries the stored balance and no derived one: the money verb is a separate question, asked earlier',
  design: 'dataPort.ts states it at length — getAccountBalances is DELIBERATELY OUT of BootSnapshot, because "those figures exist for exactly the seconds a long history is in flight" and the seeding rule that uses them fires only while transactions.length === 0. The accounts in this answer therefore carry accounts.balance, the column the accounts read projects, and nothing in this call computes a total',
  consequence: 'R-4, in both of its halves. Fold the map INTO the boot and it arrives WITH the transactions it was meant to cover for, so the seeding window closes and every account reads £0.00 for the whole boot instead of for none of it. Correct the stored column WITH the derived figure and the two numbers stop being independent — verify_integrity\'s balance_identity would then be reporting a drift that no figure on screen contradicts, which is the one instrument for the one bug it exists to find',
  parity: 'match',

  // The one fixture outside the integrity-* family that plants a B-1 violation,
  // planted because the violation IS the subject: the rows say −25.00 and the
  // column says 999.99. balanceIdentityHolds is therefore not asserted below —
  // it would be asserting that the fixture failed to do its job — and the stored
  // figure is asserted instead, which proves it did.
  setup: setups(
    namedTransferCategories,
    aStoredBalanceThatDrifted,
    pinnedReadTimes,
    pinnedLedgerTimes,
  ),
  command: { verb: 'load_boot', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({ id: EVERYDAY, name: 'Everyday', type: 'checking', balance: '999.99' }),
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings', balance: '0.00',
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
    // ABSENT, and asserted absent. `undefined` here means "no such key in the
    // answer", and the runner says so in as many words when one appears:
    // `result.account_balances: expected (absent), got […]`. That is the first
    // half of R-4 as a test — a composite that folded the map in fails here on
    // both engines, because the oracle has no such key either.
    account_balances: undefined,
  },
  state: [
    balanceOf(EVERYDAY, '999.99'),
    auditRowsInTotal('0'),
  ],
};
