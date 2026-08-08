import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  enriched, balanceOf, balanceIdentityHolds, storedText, storedFlag,
} from './_shared.mjs';

// THE STATE AN `Option` CANNOT HOLD.
//
// `p ? 'k'` is TRUE for a key whose value is JSON null, and `p->>'k'` is SQL
// NULL for it. So a JSON null is a PRESENT key carrying no value, and the
// fifteen fields split on that exactly as they split on `''` — but not the same
// way, which is why it needs its own spec:
//
//   * the `CASE WHEN p ? 'k'` fields (category, notes, merchant_name,
//     transfer_account_id, category_id) SET NULL — the key was there;
//   * the `COALESCE(...)` fields (description, type, amount, date, account_id,
//     is_recurring, is_cleared) KEEP the old value — COALESCE cannot tell a null
//     that arrived from a null that did not.
//
// MEASURED, reference cluster, one call per field. This payload sends a null to
// one field from each group, so a port that collapsed absent and null into a
// single `None` fails on the first group and a port that treated every present
// key as a set fails on the second.
export default {
  invariant: 'TS-T3',
  title: 'a JSON null clears the fields a present key clears, and is ignored by the fields COALESCE guards',
  design: "update_transaction_atomic 20260808100000:305-333 — `p ? 'k'` versus COALESCE, measured per field",
  consequence: 'collapsing absent and null into one state loses either the ability to clear a note or the ability to leave a description alone, depending on which way it collapses',
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: {
        // present-key group: these clear.
        notes: null,
        merchant_name: null,
        transfer_account_id: null,
        // COALESCE group: these do not.
        description: null,
        amount: null,
        is_cleared: null,
      },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    notes: null,
    merchant_name: null,
    transfer_account_id: null,
    description: 'Corner shop',
    amount: '-25.00',
    is_cleared: true,
  },

  state: [
    storedText(CORNER_SHOP, 'notes', 'NULL'),
    storedText(CORNER_SHOP, 'merchant_name', 'NULL'),
    storedText(CORNER_SHOP, 'transfer_account_id', 'NULL'),
    storedText(CORNER_SHOP, 'description', 'Corner shop'),
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    // A null amount is not a zero amount. If it were, the balance would move.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
