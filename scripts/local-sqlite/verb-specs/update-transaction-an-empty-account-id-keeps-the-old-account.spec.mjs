import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  enriched, balanceOf, balanceIdentityHolds, storedText,
} from './_shared.mjs';

// READ THIS ONE BEFORE TRUSTING THE `''` SENTINEL ANYWHERE.
//
// BEHAVIOUR CLASS 2b: present-and-empty is IGNORED. One field, and it is the
// most dangerous field in the table.
//
//     account_id = COALESCE(NULLIF(p->>'account_id','')::uuid, account_id)
//                                                          -- 20260808100000:310
//
// The NULLIF turns '' into NULL and the COALESCE then falls back to the OLD
// value. So `{"account_id": ""}` means KEEP, which is the exact opposite of what
// the documented contract says the same three characters mean two rows above.
//
// A port that implemented TS-T3 uniformly — "present-and-empty clears" — would
// try to null an account reference the cloud preserves. `account_id` is NOT
// NULL, so it would not even fail cleanly: it would either violate a constraint
// on a row the user was only renaming, or, in a port that silently skipped NULLs,
// move a transaction's money to nowhere. AUDIT3 §1 called this "the dangerous
// row" from reading the SQL; this is that reading, executed on both engines.
export default {
  invariant: 'TS-T3',
  title: 'an empty account_id KEEPS the old account — the opposite of the documented sentinel',
  design: "update_transaction_atomic 20260808100000:310 — COALESCE(NULLIF(...,''), account_id), not a CASE on `p ? 'account_id'`",
  consequence: 'a port that read the contract as a protocol would null a NOT NULL account reference, or move a transaction off its account, on an edit the user thought was a rename',
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { account_id: '', description: 'Still in the Everyday account' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    account_id: EVERYDAY,
    description: 'Still in the Everyday account',
    amount: '-25.00',
  },

  state: [
    storedText(CORNER_SHOP, 'account_id', EVERYDAY),
    // And because the account did not move, neither balance did. This is the
    // assertion that would fail loudest if the sentinel were read the other way.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
