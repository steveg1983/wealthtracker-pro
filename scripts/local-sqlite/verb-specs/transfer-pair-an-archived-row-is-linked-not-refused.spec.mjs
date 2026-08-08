import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, PAIR_IN, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  storedFlag, auditShape } from './_shared.mjs';

// A DELIBERATE ABSENCE, pinned so that nobody "fixes" it in one engine only.
//
// `repair_claimed_transfer` and `link_split_line_transfer` both refuse an
// archived row by name — `archived_row_not_repairable`, because *"repairing one
// would change something the user cannot see"*. `link_transfer_pair` has no such
// check, and MEASURED (probe-transfers.sh, `ltp-archived-is-allowed`) the live
// RPC links two archived rows without complaint and leaves them archived.
//
// This port reproduces that rather than harmonising the three, because a local
// edition that refused a call the cloud accepts is a bug in the port. The spec
// exists so the inconsistency is a recorded fact with a test behind it instead
// of an oversight somebody trips over later.
export default {
  invariant: 'T-13',
  title: 'an archived row can still be linked — the gate the other two verbs have, this one does not',
  design: 'link_transfer_pair 20260716100000:65-147 — no `archived` test anywhere, unlike 20260805145035:346-349',
  consequence: 'the three transfer verbs would disagree about archived rows in a way that depends on which one the UI happened to call',
  parity: 'match',

  setup: {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET archived = 1 WHERE id IN ('${PAIR_OUT}', '${PAIR_IN}');`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET archived = true WHERE id IN ('${PAIR_OUT}', '${PAIR_IN}');`,
  },
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: PAIR_OUT, type: 'transfer', archived: true },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(PAIR_OUT, `transfer:To/From Rainy day:0002:${PAIR_IN.slice(-4)}:-`),
    transferShape(PAIR_IN, `transfer:To/From Everyday:0001:${PAIR_OUT.slice(-4)}:-`),
    storedFlag(PAIR_OUT, 'archived', 'yes'),
    storedFlag(PAIR_IN, 'archived', 'yes'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update'),
  ],
};
