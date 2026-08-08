import {
  USER, EVERYDAY, balanceIdentityHolds, importedRow,
} from './_shared.mjs';

// 20260808090000's whole subject: transactions.date is a DATE, so rows sharing a
// day carry no order and the register has to invent one. The bank states the
// order and OFX lists <STMTTRN> in it; the importer used to throw it away.
//
// The three cases are one spec because the third is what makes the first two
// mean anything: NULL is "unknown", and `0` is a real position. A port that
// COALESCEd absent to 0 would put every hand-entered row at the head of its day.
export default {
  invariant: 'D-7',
  title: 'the bank\'s own within-day order is carried per row, and an absent one stays unknown rather than becoming zero',
  design: 'import_transactions_atomic 20260808140000:346 — NULLIF(r->>\'statement_sequence\',\'\')::integer; the column\'s meaning is 20260808090000:75-78 ("An ordinal, not a time")',
  consequence: 'the register runs a balance down the page in this order; inventing one shows intermediate balances the account never held',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'First', amount: '-1.00', type: 'expense', date: '2024-05-01', statement_sequence: 0 },
        { description: 'Second', amount: '-1.00', type: 'expense', date: '2024-05-01', statement_sequence: '2' },
        { description: 'Unknown', amount: '-1.00', type: 'expense', date: '2024-05-01' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 3, skipped: 0, idempotent: false },

  state: [
    importedRow('First', '- | confirmed=yes | cleared=no | seq=0'),
    importedRow('Second', '- | confirmed=yes | cleared=no | seq=2'),
    importedRow('Unknown', '- | confirmed=yes | cleared=no | seq=-'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
