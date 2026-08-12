import {
  USER, EVERYDAY, LISTED_HOLDING, twoHoldings,
  auditTrailFor, investmentShape, balanceIdentityHolds,
} from './_shared.mjs';

// DIVERGENCE 10, a third time, asserted ONCE for the entity rather than on every
// spec in the family — `delete_unused_categories` argues that restraint: *"a
// family of divergences is how a real one gets missed"*.
//
// PHASE1-PLAN §2.2 traced U-1 ("every financial write emits an audit row")
// against the four money columns the cloud audits nowhere and ruled that the
// local edition fixes it. Holdings were not on that list because they had no
// writer at all when it was made: `public.investments` had existed since the
// initial schema and NOTHING wrote to it. They inherit the ruling rather than an
// exemption, and with the sharpest version of its reason — a position's
// quantity, its cost and its price are three figures whose last edit decides
// what a portfolio is worth.
export default {
  invariant: 'U-1',
  title: 'a holding’s whole life is audited on a device and nowhere in the cloud',
  design: 'PHASE1-PLAN §2.2; there is no write_financial_audit call for investments anywhere in supabase/migrations, and InvestmentService writes the table directly over PostgREST',
  consequence: '"what changed that figure" is the question U-1 exists to answer, and a share quantity is a figure whose last edit decides what somebody thinks they own',
  parity: 'divergent',
  reason: 'the cloud has no function to write an audit row from — DESIGN.md §5 divergence 10, inherited from the planning family rather than decided again here',

  setup: twoHoldings,

  command: {
    verb: 'update_investment',
    payload: { id: LISTED_HOLDING, user_id: USER, patch: { quantity: '150' } },
  },

  expect: { outcome: 'ok' },
  rowDivergence: { updated_at: 'the instant of the write, on two clocks and in two transactions' },

  result: { id: LISTED_HOLDING, quantity: '150.00000000', cost_basis: '4916.25' },

  state: [
    // The edit itself lands identically, to the penny. Only the trail differs.
    investmentShape(
      LISTED_HOLDING,
      'AAAA.L:A Listed Company plc:150.00000000:4916.25:40.00000000:32.77500000:stock:GBP:2024-06-01:0001:held in the ISA'
    ),
    auditTrailFor('investment', { sqlite: 'update', postgres: 'NONE' }),
    balanceIdentityHolds(EVERYDAY),
  ],
};
