import {
  USER, EVERYDAY, CORNER_SHOP,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-12',
  title: 'a transaction that is not split has no lines, and that is an answer rather than a refusal',
  design: 'dataPort.ts: "Splits for one transaction, in display order (empty when not split)." Every ordinary transaction in a ledger answers this way, so it is the common case and not an edge one',
  consequence: 'the edit modal asks this before it knows whether a row is split. A refusal here would be an error dialog for opening an ordinary transaction',
  parity: 'match',

  command: { verb: 'splits_for', payload: { user_id: USER, transaction_id: CORNER_SHOP } },
  expect: { outcome: 'ok' },
  result: { splits: [] },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
