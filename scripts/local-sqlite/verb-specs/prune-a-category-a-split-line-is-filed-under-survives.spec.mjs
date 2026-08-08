import {
  EVERYDAY, PRUNABLE, bothLinesUnderTheSource, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, splitSumHolds, CORNER_SHOP,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a category a split LINE names is left alone — the clause 20260713100000 was written to add',
  design: '20260713100000:340-343, and its own comment at :314-318: "the only change is the transaction_splits NOT EXISTS … deleting a category a split references would orphan that split line\'s categorisation permanently"',
  consequence: 'a split line must carry a non-blank category by CHECK, so an orphaned one cannot even show as blank — it renders as a raw id belonging to no group, in a panel whose whole purpose is showing where the money went',
  parity: 'match',

  setup: setups(prunablePair, bothLinesUnderTheSource),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [
    categoryPresent(PRUNABLE, 'HERE'),
    splitSumHolds(CORNER_SHOP),
    balanceIdentityHolds(EVERYDAY),
  ],
};
