import {
  USER, EVERYDAY, RAINY_DAY, OPENED_SECOND,
  setups, accountWithEveryFigure, pinnedReadTimes, listedAccount,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-4',
  title: 'all four money columns on an account leave as decimal strings, and the dates beside them as days',
  design: 'PHASE3-PLAN D-4, the decisive reason reads are verbs in this crate at all: money.rs is the ONE place minor units become the text the app parses, and "a second layer\'s `minor as f64 / 100.0` is one careless line in the numbers on screen". A bare fixture cannot prove it — every optional figure is NULL, and NULL cannot tell a working conversion from a missing one',
  consequence: 'a JSON number is a double the moment any parser touches it. £123.45 through a float is the class of defect this whole edition exists to make structurally impossible, and the balance is only one of four figures on this row that would go through it',
  parity: 'match',

  setup: setups(accountWithEveryFigure, pinnedReadTimes),
  command: { verb: 'list_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({
        id: EVERYDAY,
        name: 'Everyday',
        type: 'checking',
        // balance = initial_balance + Σ amounts = −10.00 + −15.00.
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
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
