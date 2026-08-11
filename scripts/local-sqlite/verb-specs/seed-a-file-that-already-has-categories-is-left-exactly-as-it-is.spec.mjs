import {
  USER, namedTransferCategories, pinnedReadTimes, setups,
  balanceIdentityHolds, categoriesOwnedBy, categoryTree,
} from './_shared.mjs';

// The idempotency guard, and the reason it is a GATE rather than a per-id check:
// somebody who deleted every default but one must not have the rest come back at
// the next boot. The cloud asks the same question — `if (rows.length > 0) return
// rows` — one round trip earlier.
export default {
  invariant: 'B-4',
  title: 'a seed into a file that already has categories writes nothing and answers with what is there',
  design: 'planningService.ensureCategories:450-454 — `if (rows.length > 0) return rows`; the RPC re-asks it as `categories_already_migrated`',
  consequence: 'the boot asks this on every launch. A seed that ran twice would give a person two of every category, and one that ran per-id would resurrect the ones they deleted on purpose',
  parity: 'match',

  // Two fixtures, and both are needed to make the ANSWER comparable — which is
  // this spec's whole subject, so a `rowDivergence` on `categories` would take
  // the comparison out with the columns it was about.
  //
  // The To/From categories are minted by a TRIGGER on both engines, with a
  // generated id on both, so no spec may ever compare one by id: they are
  // renamed to ids a spec can name. Then the timestamps are pinned, because on
  // a fixture they are two clocks in two processes. The order is the usual one —
  // whatever WRITES a row goes before the pin that fixes its updated_at.
  setup: setups(namedTransferCategories, pinnedReadTimes),

  command: {
    verb: 'seed_categories',
    payload: {
      user_id: USER,
      categories: [
        { id: 'type-income', name: 'Income', type: 'income', level: 'type', is_system: true },
        { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', is_system: true },
      ],
    },
  },

  expect: { outcome: 'ok' },

  state: [
    // Five: the fixture's three, plus the two To/From categories C-3 minted. Not
    // seven, which is what a per-id seed would have left.
    categoriesOwnedBy(USER, '5'),
    categoryTree(USER, 'Outgoings:expense:type:-:-:active | To/From Everyday:both:detail:Transfer:t:active | To/From Rainy day:both:detail:Transfer:t:active | Transfer:both:type:-:-:active | Weekly shop:expense:sub:Outgoings:-:active'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
