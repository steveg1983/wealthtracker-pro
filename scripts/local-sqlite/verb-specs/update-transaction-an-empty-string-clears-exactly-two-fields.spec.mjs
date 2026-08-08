import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceOf, balanceIdentityHolds, storedText,
} from './_shared.mjs';

// BEHAVIOUR CLASS 2 OF 4: present-and-empty CLEARS — for two fields out of
// fifteen, and this is both of them.
//
// The documented contract (TS-T3, canonical #41) states this as a protocol:
// "present-and-empty clears, absent is ignored". AUDIT3 §1 found that it is a
// correct statement about `transfer_account_id` and `category_id` that was
// generalised into a rule the other thirteen fields do not follow. The SQL is
//
//     CASE WHEN p ? 'transfer_account_id'
//          THEN NULLIF(p->>'transfer_account_id','')::uuid
//          ELSE transfer_account_id END          -- 20260808100000:326-332
//
// and the NULLIF is what makes '' mean NULL here and nothing like it elsewhere.
//
// This is the behaviour the application actually depends on:
// src/utils/strandedTransferActions.ts:57 sends `{ transferAccountId: '' }` to
// unlink a stranded transfer, and it is correct precisely because it happens to
// use one of the two fields where the contract holds.
export default {
  invariant: 'TS-T3',
  title: "an empty string clears transfer_account_id and category_id — the two fields it is true of",
  design: 'update_transaction_atomic 20260808100000:326-332, the two NULLIF-guarded CASE arms',
  consequence: 'lose this and the unlink button in the stranded-transfer repair silently does nothing, leaving a transfer pointing at an account it no longer belongs to',
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { transfer_account_id: '', category_id: '' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    transfer_account_id: null,
    category_id: null,
    // Nothing else moved. `category` is a different column from `category_id`
    // and a different behaviour class; it is untouched here.
    category: 'c0000000-0000-0000-0000-000000000003',
    notes: 'a note',
    amount: '-25.00',
  },

  state: [
    storedText(CORNER_SHOP, 'transfer_account_id', 'NULL'),
    storedText(CORNER_SHOP, 'category_id', 'NULL'),
    storedText(CORNER_SHOP, 'notes', 'a note'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
