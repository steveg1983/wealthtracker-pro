import {
  USER, CORNER_SHOP, SECOND_ROW, PAIR_DISMISSAL,
  twoDismissals, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-7',
  title: 'a uuid[] in the cloud and a child table here answer with the same array in the same order',
  design: 'schema.sql turns subject_ids into suggestion_dismissal_subjects because SQLite has neither arrays nor a GIN index, and argues the child table is the better shape. role_order is what keeps the reassembly honest: the positions in the list are ROLES — for a transfer pair, which row was the out and which the in',
  consequence: 'a reader that rebuilt the array as a SET would answer a different question. The rows come back in an order that is deliberately NOT their id order, so a port that sorted them, or that let SQLite return them in rowid order, is caught here rather than by a sweep offering the wrong suggestion back',
  parity: 'match',

  setup: twoDismissals,
  command: { verb: 'list_suggestion_dismissals', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  state: [
    auditRowsInTotal('0'),
    {
      name: 'the_subjects_as_each_engine_stores_them',
      // Deliberately in the stored order on both sides, not sorted: the child
      // table is read by role_order and the array by its own position, and if
      // either engine started answering in id order this would say so.
      sqlite: `SELECT group_concat(substr(transaction_id, -4), ',') FROM (
                 SELECT transaction_id FROM suggestion_dismissal_subjects
                  WHERE dismissal_id = '${PAIR_DISMISSAL}' ORDER BY role_order)`,
      postgres: `SELECT string_agg(right(id::text, 4), ',')
                   FROM (SELECT unnest(subject_ids) AS id
                           FROM public.suggestion_dismissals
                          WHERE id = '${PAIR_DISMISSAL}') s`,
      expect: `${SECOND_ROW.slice(-4)},${CORNER_SHOP.slice(-4)}`,
    },
  ],
};
