// This spec was a FINDING before it was a match.
//
// DESIGN.md classes C-3 as "T + V" — a ported trigger, backed by a
// verify_integrity() check — but schema.sql contained no such trigger, so a new
// account in the local file started life with no To/From category and the
// file's own v_integrity_violations reported account_missing_transfer_category.
// The trigger was written from the Postgres original
// (20260708140000_transfer_categories_lifecycle.sql:34-82) into both copies of
// the schema, and the two engines now agree. Kept as a match rather than
// deleted: it is the regression test for the gap.
export default {
  invariant: 'C-3',
  title: 'creating an account creates its To/From category',
  design: 'DESIGN.md §1.4 C-3 ("T + V"); cloud trigger create_transfer_category_for_account, 20260708140000:34-82',
  consequence: 'transfer bookkeeping for that account has nowhere to go: the transfer writer has no category to file either side under',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
      VALUES ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
              'Holiday fund', 'savings', 0, 0);`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
      VALUES ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
              'Holiday fund', 'savings', 0, 0);`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'transfer_categories_for_the_new_account',
      sqlite: `SELECT COUNT(*) FROM categories
                WHERE account_id = 'a0000000-0000-0000-0000-000000000003' AND is_transfer_category = 1`,
      postgres: `SELECT COUNT(*) FROM public.categories
                  WHERE account_id = 'a0000000-0000-0000-0000-000000000003' AND is_transfer_category`,
      expect: '1',
    },
    {
      // Name, parent and kind, not just a count: a category minted under the
      // wrong parent renders as junk, which is the reason the cloud skips when
      // there is no Transfer anchor.
      name: 'minted_category_shape',
      sqlite: `SELECT c.name || '|' || p.name || '|' || c.level || '|' || c.type || '|' || c.is_active
                 FROM categories c JOIN categories p ON p.id = c.parent_id
                WHERE c.account_id = 'a0000000-0000-0000-0000-000000000003'`,
      postgres: `SELECT c.name || '|' || p.name || '|' || c.level || '|' || c.type || '|' || c.is_active::int
                   FROM public.categories c JOIN public.categories p ON p.id = c.parent_id
                  WHERE c.account_id = 'a0000000-0000-0000-0000-000000000003'`,
      expect: 'To/From Holiday fund|Transfer|detail|both|1',
    },
  ],
};
