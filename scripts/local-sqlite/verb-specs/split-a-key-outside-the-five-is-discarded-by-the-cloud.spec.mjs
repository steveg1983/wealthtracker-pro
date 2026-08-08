import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, rowsIn,
} from './_shared.mjs';

// D-7 AGAIN, on the surface where it costs the most.
//
// A split line has five keys: `id`, `category`, `amount`, `memo` and
// `transfer_account_id`. The RPC reads those five with `->>` and never looks at
// anything else, so a sixth is silently discarded. MEASURED: a line carrying
// `memmo` instead of `memo` is accepted, the memo is dropped, and the call
// reports success.
//
// The create and update verbs already carry this divergence and the argument for
// it (`update-transaction-a-key-outside-the-allow-list-is-discarded-by-the-cloud`
// is where it is written down). What makes it worse HERE is which key gets
// misspelled. A lost memo is a lost memo. A misspelled `transfer_account_id`
// stores an ordinary line where the caller meant one half of a transfer: no
// counterpart is minted, the other account never hears about the money, and the
// only evidence is a success response. That is the exact failure mode the
// migration this verb ports was written to end — and silence is how it would
// come back.
//
// The divergence is one-directional and safe in the direction that matters: no
// caller that works today stops working, because a caller sending a sixth key is
// by construction a caller whose intent is already not being carried out. It
// stops being told that it was.
export default {
  invariant: 'D-7',
  title: 'a sixth key on a split line is discarded by the cloud and refused by the local edition',
  design: 'set_transaction_splits_with_legs 20260806094058:245-262 — five ->> reads and nothing else; there is no key list anywhere to compare against',
  consequence: 'a misspelled transfer_account_id stores an ordinary line where a transfer was meant, mints nothing, tells nobody, and reports success',
  parity: 'divergent',
  reason: 'DECLARED, and the same divergence the create and update verbs carry. The cloud discards unknown keys on a split line; the local edition refuses by name (unknown_field) so the caller can tell a typo from a rejection. The cloud side of this spec is what pins the discard — the day the RPC starts refusing, this fails and the divergence is retired on purpose rather than by drift.',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        // Everything about this line is legal except the spelling of `memo`.
        { category: WEEKLY_SHOP, amount: '-15.00', memmo: 'bread' },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: {
    // The cloud takes the line and drops the memo, and says so by saying nothing.
    postgres: { outcome: 'ok' },
    // The local edition takes neither line. A split is one instruction: if part
    // of it cannot be carried out, none of it is.
    sqlite: { outcome: 'refused', error: 'unknown_field' },
  },

  state: [
    {
      // The heart of it: the cloud stored the line WITHOUT the memo. The user
      // asked for a memo and got a success.
      name: 'split_lines_after',
      sqlite: `SELECT COALESCE((SELECT group_concat(line, ' | ') FROM (
                 SELECT CAST(sort_order AS TEXT) || ':' || COALESCE(memo, 'NO-MEMO') AS line
                   FROM transaction_splits WHERE transaction_id = '${CORNER_SHOP}'
                  ORDER BY sort_order)), 'NONE')`,
      postgres: `SELECT COALESCE(string_agg(CAST(sort_order AS TEXT) || ':' || COALESCE(memo, 'NO-MEMO'),
                   ' | ' ORDER BY sort_order), 'NONE')
                   FROM public.transaction_splits WHERE transaction_id = '${CORNER_SHOP}'`,
      expect: {
        postgres: '1:NO-MEMO | 2:NO-MEMO',
        sqlite: 'NONE',
      },
    },
    // Neither engine moved any money: the divergence is about what the caller is
    // told, never about the ledger.
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    rowsIn(RAINY_DAY, 'NONE'),
    auditShape({ postgres: 'transaction/update', sqlite: 'NONE' }),
    splitLines(CORNER_SHOP, {
      postgres: '1:-15.00:Weekly shop:-:-:- | 2:-10.00:Weekly shop:-:-:-',
      sqlite: 'NONE',
    }),
  ],
};
