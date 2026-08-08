import {
  USER, EVERYDAY, balanceIdentityHolds, importedRow,
} from './_shared.mjs';

// TS-I9: FOUR cleared policies, one per source — the feed and OFX always false,
// CSV false, QIF the file's own `C` flag, MS Money `clearedStatus === 2`. The
// likely porting error is one policy for all four.
//
// This RPC is not where any of them lives: it honours what the caller states and
// defaults to false, because it cannot know which parser filled the field in.
// That is the correct place to draw the line and this spec is where it is drawn
// — a QIF row the file marked reconciled must arrive reconciled, and a CSV row
// must not.
export default {
  invariant: 'A-3',
  title: 'a row the file said was reconciled arrives reconciled, and one that said nothing does not',
  design: 'import_transactions_atomic 20260808140000:345 — COALESCE((r->>\'is_cleared\')::boolean, false); TS-I9 places the four policies in the parsers, not here',
  consequence: 'defaulting a QIF\'s own C flag to false re-asks for reconciliation work already done; defaulting a CSV to true removes the step that catches a payment the bank has not sent',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Qif reconciled', amount: '-1.00', type: 'expense', date: '2024-05-01', is_cleared: true },
        { description: 'Csv row', amount: '-1.00', type: 'expense', date: '2024-05-01' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0, idempotent: false },

  state: [
    importedRow('Qif reconciled', '- | confirmed=yes | cleared=yes | seq=-'),
    importedRow('Csv row', '- | confirmed=yes | cleared=no | seq=-'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
