import {
  USER, FED, aFeedCreatedAccount, storedBalances, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The same first refusal the file importer carries, and the same reason the
// local command struct takes `rows` as raw JSON rather than as a Vec: a typed
// list would refuse this before the verb ran, under a deserialiser's name, while
// the cloud refuses it inside the function under its own.
export default {
  invariant: 'I-1',
  title: 'a sync payload that is not an array is refused by the function, not by the parser',
  design: 'import_bank_transactions_atomic 20260808100000:579-581',
  consequence: 'a caller that sends the wrong shape is told about the wrong problem, and handleSupabaseError puts that sentence in front of the user',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: { verb: 'import_bank_transactions', payload: { user_id: USER, rows: { rows: [] } } },

  expect: { outcome: 'refused', error: 'p_rows must be a jsonb array' },

  state: [
    rowsInAccount(FED, '0'),
    storedBalances(FED, '100.00/100.00'),
    auditTrail('NONE'),
  ],
};
