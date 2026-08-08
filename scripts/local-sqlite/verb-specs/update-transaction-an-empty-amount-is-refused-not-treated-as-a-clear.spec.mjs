import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceOf, balanceIdentityHolds, storedAmount, auditRowsInTotal,
} from './_shared.mjs';

// BEHAVIOUR CLASS 4 OF 4: present-and-empty RAISES.
//
// Five of the fifteen fields go through a Postgres cast that has no reading for
// the empty string — `amount`, `date`, `is_recurring`, `is_cleared` and
// `category_confirmed` — so `''` is refused rather than meaning anything.
//
//     amount = COALESCE((p->>'amount')::numeric, amount)   -- 20260808100000:307
//
// MEASURED, reference cluster: `invalid input syntax for type numeric: ""`.
//
// This is the class that matters most, because it is the one where a port that
// "helpfully" treated '' as absent would turn a refused edit into an accepted
// one — the caller believes they set an amount, the ledger keeps the old one,
// and the balance is consistent with a figure nobody chose. Refusing is the only
// outcome that leaves the ledger and the caller agreeing.
//
// The two engines word it differently and that is declared per engine: Postgres
// names the cast, the local edition names its own money boundary. Both refuse,
// both write nothing, and `parity` is about the outcome and the state.
export default {
  invariant: 'MONEY-1',
  title: 'an empty amount is refused by both engines, and nothing is written',
  design: 'update_transaction_atomic 20260808100000:307 — a numeric cast, which has no reading for ""',
  consequence: "treating '' as absent would accept an edit that set no amount while telling the caller it had, and the balance would then be consistent with a figure nobody chose",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { amount: '', description: 'should not survive' },
    },
  },

  expect: {
    // Same outcome, different prose. Postgres refuses at the cast; the local
    // edition refuses at Money's own grammar, before the file is opened for
    // writing at all.
    sqlite: { outcome: 'refused', error: 'amount_malformed' },
    postgres: { outcome: 'refused', error: 'invalid input syntax for type numeric' },
  },

  state: [
    // The whole edit rolled back — including the description that would have
    // been perfectly legal on its own.
    storedAmount(CORNER_SHOP, '-25.00'),
    {
      name: 'description_after_the_refusal',
      sqlite: `SELECT description FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT description FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: 'Corner shop',
    },
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
