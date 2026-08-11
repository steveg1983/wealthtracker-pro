// The tidy-up that never once ran.
//
// FOUND 2026-08 (PHASE3-PLAN slice 19), by the seam's own contract suite rather
// than by this harness — `contract.ts`'s "forgets a refusal about a row that no
// longer exists", which asks the question through `deleteTransaction` and reads
// the store back independently.
//
// The two engines store one fact in two shapes, and the shapes decide the
// trigger's timing. The cloud keeps a dismissal's subjects in a `text[]` ON the
// dismissal row, so `subject_ids @> ARRAY[OLD.id]` is still true whenever its
// AFTER DELETE trigger runs. This schema keeps them in a child table with a
// foreign key — a deliberate strengthening, because it makes "every id resolves
// in exactly one table" a key rather than a promise — and that key carries
// ON DELETE CASCADE. SQLite applies the cascade before the AFTER trigger, so the
// subject rows were already gone when the prune went looking for them: the
// subquery matched nothing, the dismissal survived, and nothing raised.
//
// The cost is not untidiness. The dismissal is left naming a transaction that no
// longer exists, with no subjects at all, and it travels into every backup taken
// afterwards — which is the exact sentence the contract rule uses ("a restored
// backup carries junk"). The fix is one word, BEFORE for AFTER, and this spec is
// what stops it being changed back: the same delete, asserted on both engines,
// where only one of them ever had the timing problem.
export default {
  invariant: 'R-13',
  title: 'a dismissal dies with the transaction it named',
  design:
    'prune_suggestion_dismissals_for_transaction (20260806180000:156-170). The cloud reads an array on the dismissal; this schema joins a child table whose FK cascades first, so the port must fire BEFORE the delete rather than after it',
  consequence:
    'a refusal about a row nobody can see again, kept for ever, exported into every backup and restored back out of one',
  parity: 'match',

  sqlite: {
    setup: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
        VALUES ('70000000-0000-0000-0000-0000000000d2', '11111111-1111-1111-1111-111111111111',
                'a0000000-0000-0000-0000-000000000001', 'Corner shop again', -2500, 'expense',
                '2024-03-02');
      UPDATE accounts SET balance_minor = balance_minor - 2500
        WHERE id = 'a0000000-0000-0000-0000-000000000001';
      INSERT INTO suggestion_dismissals (id, user_id, kind, subject_key)
        VALUES ('d0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111',
                'duplicate', 'corner-shop-25-00');
      INSERT INTO suggestion_dismissal_subjects (dismissal_id, transaction_id, role_order) VALUES
        ('d0000000-0000-0000-0000-0000000000d1', '70000000-0000-0000-0000-000000000001', 0),
        ('d0000000-0000-0000-0000-0000000000d1', '70000000-0000-0000-0000-0000000000d2', 1);
    `,
    action: `DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
        VALUES ('70000000-0000-0000-0000-0000000000d2', '11111111-1111-1111-1111-111111111111',
                'a0000000-0000-0000-0000-000000000001', 'Corner shop again', -25.00, 'expense',
                '2024-03-02');
      UPDATE public.accounts SET balance = balance - 25.00
        WHERE id = 'a0000000-0000-0000-0000-000000000001';
      INSERT INTO public.suggestion_dismissals (id, user_id, kind, subject_key, subject_ids)
        VALUES ('d0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111',
                'duplicate', 'corner-shop-25-00',
                ARRAY['70000000-0000-0000-0000-000000000001',
                      '70000000-0000-0000-0000-0000000000d2']::uuid[]);
    `,
    action: `DELETE FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'dismissals_left_behind',
      sqlite: `SELECT COUNT(*) FROM suggestion_dismissals`,
      postgres: `SELECT COUNT(*) FROM public.suggestion_dismissals`,
      expect: '0',
    },
    {
      // The OTHER subject is untouched as a row — deleting one half of a
      // suggestion cannot delete the transaction the other half named.
      name: 'the_other_subject_row_survives',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '70000000-0000-0000-0000-0000000000d2'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '70000000-0000-0000-0000-0000000000d2'`,
      expect: '1',
    },
  ],
};
