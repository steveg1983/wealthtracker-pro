import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, OPENED_SECOND,
  setups, namedTransferCategories, accountWithEveryFigure, pinnedReadTimes, pinnedLedgerTimes,
  listedAccount, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BOOT-6',
  title: 'money crosses the composite as text: four figures on an account and the amount on the row, all decimal strings',
  design: 'PHASE3-PLAN D-4 is the reason reads are verbs in this crate at all — money.rs is the ONE place minor units become the text the app parses — and a composite is the most likely place for a second conversion to appear, because it is the one verb that gathers money from four tables at once and could be tempted to total something on the way past',
  consequence: 'a JSON number is a double the moment any parser touches it, and this call is the app\'s FIRST sight of every figure it will show. £123.45 arriving through a float on the boot is wrong on the dashboard, wrong in the register and wrong in the reports, all from one line',
  parity: 'match',

  // The account with every optional figure filled in: on a bare fixture they are
  // all NULL, and NULL is the one value that cannot tell a working conversion
  // from a missing one. `initial_balance −10.00` and the row at −15.00 keep B-1
  // holding at the same −25.00 the fixture started with.
  setup: setups(
    namedTransferCategories,
    accountWithEveryFigure,
    pinnedReadTimes,
    pinnedLedgerTimes,
  ),
  command: { verb: 'load_boot', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({
        id: EVERYDAY,
        name: 'Everyday',
        type: 'checking',
        balance: '-25.00',
        initial_balance: '-10.00',
        bank_balance: '123.45',
        bank_balance_date: '2024-02-29',
        last_reconciled_date: '2024-02-01',
        low_balance_alert_enabled: true,
        low_balance_threshold: '-50.00',
        opening_balance_date: '2023-12-31',
        archive_through_date: '2023-06-30',
        institution: 'A Bank',
        account_number: '12345678',
        sort_code: '00-00-00',
        icon: 'wallet',
        color: '#123456',
        notes: 'the everyday one',
        metadata: { k: 1 },
      }),
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings',
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
    transactions: [listedTransaction({ amount: '-15.00', category: WEEKLY_SHOP })],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
