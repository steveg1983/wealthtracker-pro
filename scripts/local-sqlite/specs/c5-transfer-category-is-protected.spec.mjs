export default {
  invariant: 'C-5',
  title: 'a To/From category cannot be deleted while its account exists',
  design: 'DESIGN.md §1.4 C-5 ("D — trg_protect_transfer_category"); cloud BEFORE DELETE trigger, 20260708140000:127-146',
  consequence: "the account's transfer bookkeeping disappears and every transfer filed under it becomes uncategorised",
  parity: 'match',

  sqlite: {
    action: `DELETE FROM categories
              WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1;`,
    expect: { outcome: 'refused', message: 'transfer_category_protected' },
  },

  postgres: {
    action: `DELETE FROM public.categories
              WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category;`,
    expect: { outcome: 'refused', message: 'transfer_category_protected' },
  },
};
