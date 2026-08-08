import { USER, RESTORED_ACCOUNT, backupAccount, chunk, wiped } from './_shared.mjs';

export default {
  invariant: 'C-3',
  title: 'restoring an account mints no To/From category, because there is no anchor to hang one on',
  design: '20260807083000:17-33 — the decision the whole file turns on. Inserting an account fires create_transfer_category_for_account, which mints a To/From category with a FRESH id; the backup already carries that category under its ORIGINAL id. The trigger returns early when there is no level=\'type\' Transfer anchor (20260708140000:53), and an empty login has none, so the collision class disappears rather than being worked around',
  consequence: 'let the trigger fire and every transfer in the file points at a category that no longer exists — or the insert dies on categories_user_id_name_parent_id_key. No ordering avoids it while categories already exist, which is why the emptiness precondition is load-bearing rather than cautious',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('accounts', [backupAccount()])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      // NONE, on both engines. The account is in, and the ground is clear for the
      // categories chunk that follows to put the file's own To/From row back
      // under the id every transaction already names.
      name: 'transfer_categories_minted',
      sqlite: `SELECT COALESCE((SELECT group_concat(id, ',') FROM categories
                 WHERE account_id = '${RESTORED_ACCOUNT}'), 'NONE')`,
      postgres: `SELECT COALESCE(string_agg(id::text, ','), 'NONE') FROM public.categories
                   WHERE account_id = '${RESTORED_ACCOUNT}'`,
      expect: 'NONE',
    },
    {
      name: 'categories_anywhere',
      sqlite: `SELECT COUNT(*) FROM categories WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE user_id = '${USER}'`,
      expect: '0',
    },
  ],
};
