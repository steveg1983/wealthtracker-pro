import {
  USER, EVERYDAY, WEEKLY_SHOP,
  setups, twoTagsInTheWrongOrder, pinnedLedgerTimes, listedTransaction,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-9',
  title: 'both engines answer with the same two tags, and only one of them can say which was typed first',
  design: 'the cloud stores tags as text[] — an ORDERED list, which remembers that "zebra" was written before "apple". schema.sql stores them as transaction_tags with PRIMARY KEY (transaction_id, tag), which is a SET and has no insertion order to remember, so the local read answers in tag order. Neither is wrong; they are two data structures, and only one of them holds the fact',
  consequence: 'this is the divergence lib/verb-sqlite.mjs already sorts around for the WRITE verbs ("a child table is a SET; sorting both is the only comparison that is not an accident"). It is declared here rather than sorted, because a read answers with rows and the sorting the runner does at the top level does not reach a field inside one — and because the alternative, sorting every nested array of strings, would make list_suggestion_dismissals\' role-order proof vacuous: THAT array\'s order is a fact and this one\'s is not',
  parity: 'divergent',
  reason: 'tag ORDER only. Both engines answer with exactly the same two tags on the same row; the cloud gives them back as written and the local file gives them back in tag order, because a set has no other order to give',

  setup: setups(twoTagsInTheWrongOrder, pinnedLedgerTimes),
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    transactions: {
      sqlite: [listedTransaction({ category: WEEKLY_SHOP, tags: ['apple', 'zebra'] })],
      postgres: [listedTransaction({ category: WEEKLY_SHOP, tags: ['zebra', 'apple'] })],
    },
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
