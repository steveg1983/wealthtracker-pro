import {
  USER, RESTORED_ROW, RESTORED_OTHER, RESTORED_ACCOUNT,
  asExportedBefore, backupTransaction, chunk, rowsInAccount, storedFlag, wipedWithOneAccount,
} from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'a column the backup predates arrives at the schema\'s own default, stated or not',
  design: '20260811090000 — jsonb_populate_recordset emits an EXPLICIT NULL for every column the JSON omits, and an explicit NULL bypasses the column default. So `needs_review boolean NOT NULL DEFAULT false` (20260810090000) made every backup written before it unrestorable. The restore now lays the schema\'s constant defaults UNDER each row: an ABSENT key is answered by the default, and a key stated as null on a column that cannot hold null is treated as not stated, because no legal export could have produced it',
  consequence: 'EVERY backup file exported before 2026-08-10 failed to restore, with "null value in column needs_review violates not-null constraint" — the safety net offered before the MS Money migration holding until the day it was needed and then refusing, in language about a column the user has never heard of, on the one operation there is no second copy of',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [
        // The file from May: the column did not exist, so the key is not there.
        asExportedBefore(backupTransaction(), 'needs_review'),
        // The other half of the same rule. A NOT NULL column cannot hold null,
        // so no row that was ever in the table could have been exported saying
        // so — a hand-edited file, or a client that wrote a key it had no value
        // for. The default is the only honest reading, and it is the same
        // answer the absent case gets.
        backupTransaction({ id: RESTORED_OTHER, needs_review: null }),
      ])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 2 },
  state: [
    // false = reviewed. The right answer for both, and for the reason
    // 20260810090000 chose the direction: silence is safe, so a row from before
    // the review flow existed is a row the user had already dealt with, not
    // eleven thousand lines of bold asking to be looked at again.
    storedFlag(RESTORED_ROW, 'needs_review', 'no'),
    storedFlag(RESTORED_OTHER, 'needs_review', 'no'),
    // Both rows landed. Without the defaults the FIRST one takes the whole
    // chunk down, so a count is what tells "filled in" from "got away with it".
    rowsInAccount(RESTORED_ACCOUNT, '2'),
  ],
};
