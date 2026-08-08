import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceIdentityHolds, storedText,
} from './_shared.mjs';

// BEHAVIOUR CLASS 3 OF 4: present-and-empty stores THE EMPTY STRING.
//
//     category      = CASE WHEN p ? 'category'      THEN p->>'category'      ELSE ... END
//     notes         = CASE WHEN p ? 'notes'         THEN p->>'notes'         ELSE ... END
//     merchant_name = CASE WHEN p ? 'merchant_name' THEN p->>'merchant_name' ELSE ... END
//                                                        -- 20260808100000:311, :320, :333
//
// No NULLIF. `''` is a value and it is stored as one, which is NOT the same as
// NULL and the rest of the system knows the difference: `20260708100000:26`
// defines "categorised" as `category IS NOT NULL AND btrim(category) <> ''`
// precisely because both spellings of "no category" exist in this column.
//
// The distinction is asserted with the EMPTY sentinel rather than by eye, since
// an empty string and a NULL render identically in every psql and sqlite3
// output anyone would look at.
export default {
  invariant: 'TS-T3',
  title: 'an empty string is stored verbatim in category, notes and merchant_name — not turned into NULL',
  design: "update_transaction_atomic 20260808100000:311/:320/:333 — a `p ? 'k'` test with no NULLIF",
  consequence: "a port that NULLIF'd these would make the empty-string and NULL spellings of 'uncategorised' converge, and every rule that distinguishes them (20260708100000:26) would start disagreeing with the data",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { category: '', notes: '', merchant_name: '' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    category: '',
    notes: '',
    merchant_name: '',
    // category_id is a different column and was not sent, so it survives.
    category_id: 'c0000000-0000-0000-0000-000000000003',
    // Branch 2 of the three-way CASE: '' IS DISTINCT FROM the old category, so
    // this counts as changing it, so it counts as vouching for it.
    category_confirmed: true,
  },

  state: [
    storedText(CORNER_SHOP, 'category', 'EMPTY'),
    storedText(CORNER_SHOP, 'notes', 'EMPTY'),
    storedText(CORNER_SHOP, 'merchant_name', 'EMPTY'),
    storedText(CORNER_SHOP, 'category_id', 'c0000000-0000-0000-0000-000000000003'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
