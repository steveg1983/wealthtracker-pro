// Ids from fixtures/base.*.sql, and the assertions every verb spec repeats.
//
// All data is invented. This repo is public: no real payee, account number or
// figure appears anywhere in it.

import { accountBalance, balanceIdentity, minorToDecimal, numericToDecimal } from '../lib/money-sql.mjs';

export const USER = '11111111-1111-1111-1111-111111111111';
export const EVERYDAY = 'a0000000-0000-0000-0000-000000000001';
export const RAINY_DAY = 'a0000000-0000-0000-0000-000000000002';
export const WEEKLY_SHOP = 'c0000000-0000-0000-0000-000000000003';
export const OUTGOINGS = 'c0000000-0000-0000-0000-000000000002';

/** The Everyday account starts at -25.00 with one -25.00 row against it. */
export const OPENING_BALANCE = '-25.00';

/** That row: 'Corner shop', -25.00, filed under Weekly shop. */
export const CORNER_SHOP = '70000000-0000-0000-0000-000000000001';

/** A second login, and an account this one does not own. */
export const STRANGER = '22222222-2222-2222-2222-222222222222';
export const SOMEONE_ELSES_ACCOUNT = 'a0000000-0000-0000-0000-000000000009';

export const secondUser = {
  sqlite: `
    INSERT INTO users (id, email) VALUES ('${STRANGER}', 'stranger@example.test');
    INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
      VALUES ('${SOMEONE_ELSES_ACCOUNT}', '${STRANGER}', 'Not yours', 'checking', 0, 0);`,
  postgres: `
    INSERT INTO public.users (id, clerk_id, email)
      VALUES ('${STRANGER}', 'clerk_local_sqlite_stranger', 'stranger@example.test');
    INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
      VALUES ('${SOMEONE_ELSES_ACCOUNT}', '${STRANGER}', 'Not yours', 'checking', 0.00, 0.00);`,
};

/**
 * The Corner shop row with every nullable field FILLED IN.
 *
 * The whole point of the update verb's sentinel table is telling "cleared to
 * NULL" from "left alone", and on the bare fixture those two are the same
 * observation — every one of those columns starts NULL. Nothing here moves an
 * amount, so B-1 still holds on both accounts.
 */
export const enriched = {
  sqlite: `
    UPDATE transactions SET
      category_id = '${WEEKLY_SHOP}',
      notes = 'a note',
      merchant_name = 'a merchant',
      transfer_account_id = '${RAINY_DAY}',
      is_cleared = 1,
      is_recurring = 1,
      category_confirmed = 0,
      metadata = '{"k":1}'
     WHERE id = '${CORNER_SHOP}';
    INSERT INTO transaction_tags (transaction_id, tag) VALUES
      ('${CORNER_SHOP}', 'one'), ('${CORNER_SHOP}', 'two');`,
  postgres: `
    UPDATE public.transactions SET
      category_id = '${WEEKLY_SHOP}'::uuid,
      notes = 'a note',
      merchant_name = 'a merchant',
      transfer_account_id = '${RAINY_DAY}'::uuid,
      is_cleared = true,
      is_recurring = true,
      category_confirmed = false,
      metadata = '{"k":1}'::jsonb,
      tags = ARRAY['one','two']
     WHERE id = '${CORNER_SHOP}';`,
};

/** A second transfer row in the Everyday account, so a transfer pair exists. */
export const OTHER_LEG = '70000000-0000-0000-0000-000000000004';
export const THIS_LEG = '70000000-0000-0000-0000-000000000005';

/**
 * A linked transfer pair: -15.00 out of Everyday, +15.00 into Rainy day,
 * mutually linked, with BOTH balances moved so B-1 keeps holding.
 *
 * Everyday ends at -40.00 and Rainy day at 15.00.
 */
export const transferPair = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              transfer_account_id) VALUES
      ('${OTHER_LEG}', '${USER}', '${EVERYDAY}',  'To savings',    -1500, 'transfer', '2024-04-01', '${RAINY_DAY}'),
      ('${THIS_LEG}',  '${USER}', '${RAINY_DAY}', 'From everyday',  1500, 'transfer', '2024-04-01', '${EVERYDAY}');
    UPDATE transactions SET linked_transfer_id = '${THIS_LEG}'  WHERE id = '${OTHER_LEG}';
    UPDATE transactions SET linked_transfer_id = '${OTHER_LEG}' WHERE id = '${THIS_LEG}';
    UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${EVERYDAY}';
    UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${RAINY_DAY}';`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     transfer_account_id) VALUES
      ('${OTHER_LEG}', '${USER}', '${EVERYDAY}',  'To savings',    -15.00, 'transfer', '2024-04-01', '${RAINY_DAY}'),
      ('${THIS_LEG}',  '${USER}', '${RAINY_DAY}', 'From everyday',  15.00, 'transfer', '2024-04-01', '${EVERYDAY}');
    UPDATE public.transactions SET linked_transfer_id = '${THIS_LEG}'  WHERE id = '${OTHER_LEG}';
    UPDATE public.transactions SET linked_transfer_id = '${OTHER_LEG}' WHERE id = '${THIS_LEG}';
    UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${EVERYDAY}';
    UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${RAINY_DAY}';`,
};

/** The split parent, its two lines, and the transfer counterpart one line links to. */
export const LEG_COUNTERPART = '70000000-0000-0000-0000-000000000009';
export const LEG_LINE = '50000000-0000-0000-0000-000000000001';
export const PLAIN_LINE = '50000000-0000-0000-0000-000000000002';

/**
 * The R-5 shape: Corner shop becomes a split of -15.00 (a transfer leg) and
 * -10.00, and the leg points at a +15.00 counterpart in Rainy day.
 *
 * Adapted from `specs/_setups.mjs`'s fragment of the same name, with ONE
 * addition: the counterpart's balance effect is applied, because every verb spec
 * asserts B-1 and that fragment was written for a harness that does not.
 * Everyday stays at -25.00 (the split lines sum to the parent) and Rainy day
 * ends at 15.00.
 */
export const splitWithTransferLeg = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 1500, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${RAINY_DAY}';
    -- The To/From category is minted by a trigger on BOTH engines, so its id is
    -- unknown at authoring time on both: reach it through the account.
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                    transfer_account_id, linked_transfer_id) VALUES
      ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}',
       (SELECT id FROM categories WHERE account_id = '${RAINY_DAY}' AND is_transfer_category = 1),
       -1500, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 1);
    UPDATE transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 15.00, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${RAINY_DAY}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order,
                                           transfer_account_id, linked_transfer_id) VALUES
      ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}',
       (SELECT id::text FROM public.categories WHERE account_id = '${RAINY_DAY}' AND is_transfer_category),
       -15.00, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1);
    UPDATE public.transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    SELECT set_config('app.split_rpc', '0', true);`,
};

/**
 * The same shape, but with the leg filed under an ORDINARY category.
 *
 * This is the MS Money importer's population — 86 of the owner's 364 split lines
 * — and it is not a variation for its own sake: while a leg is filed under a
 * To/From category, `split_leg_not_declared` fires before the pinned-leg checks
 * are ever reached, so `split_leg_target_locked` is UNREACHABLE. MEASURED on the
 * reference cluster; this fixture is the only way to prove that refusal exists.
 */
export const splitWithAnOrdinarilyFiledLeg = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 1500, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${RAINY_DAY}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                    transfer_account_id, linked_transfer_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',
              -1500, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 1);
    UPDATE transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 15.00, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${RAINY_DAY}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order,
                                           transfer_account_id, linked_transfer_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',
              -15.00, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1);
    UPDATE public.transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    SELECT set_config('app.split_rpc', '0', true);`,
};

/**
 * An UNLINKED leg: a line carrying a transfer target whose counterpart is gone.
 *
 * The state the R-5 delete leaves behind, and the one the transfer-matching
 * sweep exists to repair. It matters to the split writer because a re-save must
 * NOT invent a second counterpart for money that already moved once.
 */
export const splitWithAnUnlinkedLeg = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                    transfer_account_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1500, 0, '${RAINY_DAY}');
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 1);
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order,
                                           transfer_account_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -15.00, 0, '${RAINY_DAY}');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1);
    SELECT set_config('app.split_rpc', '0', true);`,
};

/**
 * The two To/From categories, given ids a payload can name.
 *
 * The base fixture's own comment says no spec may ASSUME a transfer category's
 * id, because both engines mint them from a trigger with a generated one. That
 * stands. This does the other thing: it renames them, in the setup, to ids the
 * spec then names on purpose — which is the only way to write a payload that
 * files a line under a To/From category, and therefore the only way to reach
 * `split_leg_not_declared` and `split_leg_category_mismatch` at all.
 *
 * Safe on both engines: nothing references a category id at this point in the
 * fixture (no transaction carries `category_id`, and a To/From category has no
 * children), so the rename cascades to nothing.
 */
export const TO_FROM_RAINY_DAY = 'c0000000-0000-0000-0000-0000000000fa';
export const TO_FROM_EVERYDAY = 'c0000000-0000-0000-0000-0000000000fb';

export const namedTransferCategories = {
  sqlite: `
    UPDATE categories SET id = '${TO_FROM_RAINY_DAY}'
     WHERE account_id = '${RAINY_DAY}' AND is_transfer_category = 1;
    UPDATE categories SET id = '${TO_FROM_EVERYDAY}'
     WHERE account_id = '${EVERYDAY}' AND is_transfer_category = 1;`,
  postgres: `
    UPDATE public.categories SET id = '${TO_FROM_RAINY_DAY}'::uuid
     WHERE account_id = '${RAINY_DAY}' AND is_transfer_category;
    UPDATE public.categories SET id = '${TO_FROM_EVERYDAY}'::uuid
     WHERE account_id = '${EVERYDAY}' AND is_transfer_category;`,
};

/** A third account in the same currency, so a leg has somewhere else to point. */
export const HOLIDAY_FUND = 'a0000000-0000-0000-0000-000000000003';

export const thirdAccount = {
  sqlite: `
    INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
      VALUES ('${HOLIDAY_FUND}', '${USER}', 'Holiday fund', 'savings', 0, 0);`,
  postgres: `
    INSERT INTO public.accounts (id, user_id, name, type, balance, initial_balance)
      VALUES ('${HOLIDAY_FUND}', '${USER}', 'Holiday fund', 'savings', 0.00, 0.00);`,
};

/** An account in another currency, so T-9 has something to refuse. */
export const DOLLARS = 'a0000000-0000-0000-0000-00000000000d';

export const dollarAccount = {
  sqlite: `
    INSERT INTO accounts (id, user_id, name, type, currency, balance_minor, initial_balance_minor)
      VALUES ('${DOLLARS}', '${USER}', 'Dollars', 'checking', 'USD', 0, 0);`,
  postgres: `
    INSERT INTO public.accounts (id, user_id, name, type, currency, balance, initial_balance)
      VALUES ('${DOLLARS}', '${USER}', 'Dollars', 'checking', 'USD', 0.00, 0.00);`,
};

// ── REMOVED 2026-08-08: `rowAgainstAForeignAccount` / `FOREIGN_ROW` ─────────
//
// It planted "the pairing neither schema forbids": a transaction whose user_id
// was this caller and whose account_id belonged to somebody else. Three specs
// used it, because it was the ONLY way to reach a balance statement that
// matches no row — the account foreign key caught every other route:
//
//     b1-a-delete-that-cannot-reach-its-account-refuses-rather-than-losing-the-money
//     split-a-parent-whose-account-is-not-yours-refuses-rather-than-losing-the-money
//     counterpart-a-row-against-a-foreign-account-skips-the-currency-guard
//
// Both schemas forbid it now — the cloud since
// 20260808170000_rows_cannot_name_a_foreign_account.sql, the local file since
// the amendment that discharged its parity obligation — so the fragment cannot
// be planted on either engine and the three specs cannot be built. That is the
// migration working, not the harness breaking, and the three have successors in
// the CONSTRAINT harness, which is where a rule about what a table will hold
// belongs:
//
//     specs/r12-a-row-cannot-be-filed-against-a-strangers-account.spec.mjs
//     specs/r12-a-row-cannot-be-moved-onto-a-strangers-account.spec.mjs
//     specs/r12-a-transfer-cannot-point-at-a-strangers-account.spec.mjs
//
// Each carries its ancestor's name in its header. `SOMEONE_ELSES_ACCOUNT` and
// `secondUser` above stay: an account this login does not own is still a thing
// verbs are handed, and several specs still refuse it.

// ── The transfer family's fixtures ─────────────────────────────────────────

/** Two UNLINKED rows with exactly opposite amounts, in two accounts. */
export const PAIR_OUT = '70000000-0000-0000-0000-00000000000a';
export const PAIR_IN = '70000000-0000-0000-0000-00000000000b';

/**
 * The shape `link_transfer_pair` exists for: both banks imported their own side
 * of one movement and nobody has told the ledger they are the same movement.
 *
 * −30.00 out of Everyday (filed under Weekly shop, so the re-filing is visible)
 * and +30.00 into Rainy day (filed under nothing). Everyday ends at −55.00 and
 * Rainy day at 30.00, so B-1 holds on both before the verb runs.
 */
export const pairableRows = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category) VALUES
      ('${PAIR_OUT}', '${USER}', '${EVERYDAY}',  'Moved out', -3000, 'expense', '2024-04-02', '${WEEKLY_SHOP}'),
      ('${PAIR_IN}',  '${USER}', '${RAINY_DAY}', 'Moved in',   3000, 'income',  '2024-04-02', NULL);
    UPDATE accounts SET balance_minor = balance_minor - 3000 WHERE id = '${EVERYDAY}';
    UPDATE accounts SET balance_minor = balance_minor + 3000 WHERE id = '${RAINY_DAY}';`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category) VALUES
      ('${PAIR_OUT}', '${USER}', '${EVERYDAY}',  'Moved out', -30.00, 'expense', '2024-04-02', '${WEEKLY_SHOP}'),
      ('${PAIR_IN}',  '${USER}', '${RAINY_DAY}', 'Moved in',   30.00, 'income',  '2024-04-02', NULL);
    UPDATE public.accounts SET balance = balance - 30.00 WHERE id = '${EVERYDAY}';
    UPDATE public.accounts SET balance = balance + 30.00 WHERE id = '${RAINY_DAY}';`,
};

/** The user's own 'Account Adjustment' category — a leaf, active, not To/From. */
export const ADJUSTMENT = 'c0000000-0000-0000-0000-0000000000a1';

export const adjustmentCategory = {
  sqlite: `
    INSERT INTO categories (id, user_id, name, type, level, parent_id)
      VALUES ('${ADJUSTMENT}', '${USER}', 'Account Adjustment', 'both', 'sub',
              'c0000000-0000-0000-0000-000000000001');`,
  postgres: `
    INSERT INTO public.categories (id, user_id, name, type, level, parent_id)
      VALUES ('${ADJUSTMENT}', '${USER}', 'Account Adjustment', 'both', 'sub',
              'c0000000-0000-0000-0000-000000000001');`,
};

/** The row that really matches the counterpart, sitting a day away, unfiled. */
export const STRANDED = '70000000-0000-0000-0000-00000000000e';

/**
 * `repair_claimed_transfer`'s whole world, on top of [`transferPair`].
 *
 * The counterpart (+15.00, Rainy day) is linked to the WRONG partner (−15.00,
 * Everyday), and the row it should be linked to is [`STRANDED`] — same account
 * as the wrong partner, same day, exactly opposite, and uncategorised.
 * Everyday ends at −55.00, Rainy day at 15.00.
 */
export const strandedRow = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
      VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Really the other side', -1500, 'expense', '2024-04-01');
    UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${EVERYDAY}';`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
      VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Really the other side', -15.00, 'expense', '2024-04-01');
    UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${EVERYDAY}';`,
};

/** The row in Rainy day that an unmatched split leg is waiting for. */
export const MATCHING = '70000000-0000-0000-0000-00000000000c';

/**
 * +15.00 in Rainy day: the other side of [`splitWithAnUnlinkedLeg`]'s leg,
 * already imported by its own bank and not yet recognised.
 *
 * Everyday stays at −25.00 (the split lines sum to the parent) and Rainy day
 * ends at 15.00.
 */
export const matchingRow = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
      VALUES ('${MATCHING}', '${USER}', '${RAINY_DAY}', 'From everyday', 1500, 'income', '2024-03-02');
    UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${RAINY_DAY}';`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
      VALUES ('${MATCHING}', '${USER}', '${RAINY_DAY}', 'From everyday', 15.00, 'income', '2024-03-02');
    UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${RAINY_DAY}';`,
};

// ── The category family's fixtures ─────────────────────────────────────────

/**
 * Two ordinary expense leaves under Outgoings: the commonest mess in imported
 * history, and the pair every merge spec starts from.
 *
 * Both are `detail` level with no children, both `expense`, both active, and
 * neither carries any of the three semantic flags — so every one of the
 * seventeen refusals is reached by changing exactly one thing about this pair,
 * which is what makes each spec's setup readable as "and this is the difference".
 */
export const MERGE_SOURCE = 'c0000000-0000-0000-0000-0000000000e1';
export const MERGE_TARGET = 'c0000000-0000-0000-0000-0000000000e2';

export const mergeablePair = {
  sqlite: `
    INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
      ('${MERGE_SOURCE}', '${USER}', 'Food shopping', 'expense', 'detail', '${OUTGOINGS}'),
      ('${MERGE_TARGET}', '${USER}', 'Groceries',     'expense', 'detail', '${OUTGOINGS}');`,
  postgres: `
    INSERT INTO public.categories (id, user_id, name, type, level, parent_id) VALUES
      ('${MERGE_SOURCE}', '${USER}', 'Food shopping', 'expense', 'detail', '${OUTGOINGS}'),
      ('${MERGE_TARGET}', '${USER}', 'Groceries',     'expense', 'detail', '${OUTGOINGS}');`,
};

/** A category of the STRANGER's, so the two owner refusals have a subject. */
export const THEIR_CATEGORY = 'c0000000-0000-0000-0000-0000000000d1';

export const strangersCategory = {
  sqlite: `
    INSERT INTO categories (id, user_id, name, type, level)
      VALUES ('${THEIR_CATEGORY}', '${STRANGER}', 'Theirs', 'expense', 'detail');`,
  postgres: `
    INSERT INTO public.categories (id, user_id, name, type, level)
      VALUES ('${THEIR_CATEGORY}', '${STRANGER}', 'Theirs', 'expense', 'detail');`,
};

/** A child under a category, so `has_children` has something to find. */
export function childOf(parentId, id = 'c0000000-0000-0000-0000-0000000000c1') {
  const columns = "(id, user_id, name, type, level, parent_id)";
  const values = `('${id}', '${USER}', 'Underneath ${parentId.slice(-4)}', 'expense', 'detail', '${parentId}')`;
  return {
    sqlite: `INSERT INTO categories ${columns} VALUES ${values};`,
    postgres: `INSERT INTO public.categories ${columns} VALUES ${values};`,
  };
}

/**
 * Corner shop, filed under the merge source through BOTH reference columns.
 *
 * `category` is TEXT with no foreign key and `category_id` is the uuid twin with
 * one; the merge has to move them together, and the delete-and-reassign dialog
 * that preceded it moved the first and silently nulled the second.
 */
export const filedUnderTheSource = {
  sqlite: `
    UPDATE transactions SET category = '${MERGE_SOURCE}', category_id = '${MERGE_SOURCE}'
     WHERE id = '${CORNER_SHOP}';`,
  postgres: `
    UPDATE public.transactions SET category = '${MERGE_SOURCE}', category_id = '${MERGE_SOURCE}'::uuid
     WHERE id = '${CORNER_SHOP}';`,
};

/** A budget measuring the merge source, through both of ITS reference columns. */
export const BUDGET = 'b0000000-0000-0000-0000-000000000001';

export const budgetOnTheSource = {
  sqlite: `
    INSERT INTO budgets (id, user_id, name, amount_minor, period, category, category_id, start_date)
      VALUES ('${BUDGET}', '${USER}', 'Food', 10000, 'monthly',
              '${MERGE_SOURCE}', '${MERGE_SOURCE}', '2024-01-01');`,
  postgres: `
    INSERT INTO public.budgets (id, user_id, name, amount, period, category, category_id, start_date)
      VALUES ('${BUDGET}', '${USER}', 'Food', 100.00, 'monthly',
              '${MERGE_SOURCE}', '${MERGE_SOURCE}'::uuid, '2024-01-01');`,
};

/**
 * A recurring template filed under the merge source.
 *
 * The two engines disagree about what `recurring_transactions.user_id` IS — the
 * Clerk id in the cloud (text, FK to `user_profiles.clerk_user_id`), a
 * `users(id)` uuid locally — so this is the one fixture whose owner value is
 * genuinely different per engine rather than differently spelled. The cloud side
 * has to mint the profile row its foreign key wants; the base fixture's
 * `clerk_id` is the one it refers to.
 *
 * The verb matches on the category id alone, so neither value is load-bearing:
 * that is the point of the migration's own argument (a category id is a globally
 * unique uuid, so matching on it can only reach this owner's templates).
 */
export const RECURRING = 'd0000000-0000-0000-0000-000000000001';

export const recurringOnTheSource = {
  sqlite: `
    INSERT INTO recurring_transactions
      (id, user_id, account_id, description, amount_minor, type, category, frequency,
       start_date, next_date)
    VALUES ('${RECURRING}', '${USER}', '${EVERYDAY}', 'Weekly food', -2000, 'expense',
            '${MERGE_SOURCE}', 'weekly', '2024-01-01', '2024-01-08');`,
  postgres: `
    INSERT INTO public.user_profiles (clerk_user_id, email)
      VALUES ('clerk_local_sqlite_harness', 'harness@example.test');
    INSERT INTO public.recurring_transactions
      (id, user_id, account_id, description, amount, type, category, frequency,
       start_date, next_date)
    VALUES ('${RECURRING}', 'clerk_local_sqlite_harness', '${EVERYDAY}', 'Weekly food',
            -20.00, 'expense', '${MERGE_SOURCE}', 'weekly', '2024-01-01', '2024-01-08');`,
};

/**
 * A split line THIS user owns, on a parent the STRANGER owns.
 *
 * The only route to `merge_left_references` there is, and it exists because the
 * lines loop walks parents scoped by `transactions.user_id` while the final
 * check scans lines scoped by `transaction_splits.user_id`. Requires
 * [`secondUser`]. Nothing here moves this user's money — the parent and its
 * amount belong to the stranger — so B-1 still holds on Everyday and Rainy day.
 */
export const THEIR_SPLIT_PARENT = '70000000-0000-0000-0000-0000000000aa';

export const myLineOnTheirParent = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              is_split, category)
      VALUES ('${THEIR_SPLIT_PARENT}', '${STRANGER}', '${SOMEONE_ELSES_ACCOUNT}', 'Theirs',
              -1000, 'expense', '2024-05-01', 1, '');
    UPDATE accounts SET balance_minor = balance_minor - 1000 WHERE id = '${SOMEONE_ELSES_ACCOUNT}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('50000000-0000-0000-0000-0000000000aa', '${THEIR_SPLIT_PARENT}', '${USER}',
              '${MERGE_SOURCE}', -1000, 0);`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     is_split, category)
      VALUES ('${THEIR_SPLIT_PARENT}', '${STRANGER}', '${SOMEONE_ELSES_ACCOUNT}', 'Theirs',
              -10.00, 'expense', '2024-05-01', true, '');
    UPDATE public.accounts SET balance = balance - 10.00 WHERE id = '${SOMEONE_ELSES_ACCOUNT}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('50000000-0000-0000-0000-0000000000aa', '${THEIR_SPLIT_PARENT}', '${USER}',
              '${MERGE_SOURCE}', -10.00, 0);`,
};

/**
 * Corner shop as a split whose FIRST line is filed under the merge source, and
 * whose parent carries the source in the uuid column too.
 *
 * The shape that proves the double count: the transactions loop moves the
 * parent's `category_id` (leaving its blank `category` blank, which is what
 * stops `trg_protect_split_category` firing) and the lines loop moves its line,
 * so one row is counted once in each and audited twice.
 */
export const splitParentUnderTheSource = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '', category_id = '${MERGE_SOURCE}'
     WHERE id = '${CORNER_SHOP}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -1500, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',  -1000, 1);
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '', category_id = '${MERGE_SOURCE}'::uuid
     WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -15.00, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}',  -10.00, 1);
    SELECT set_config('app.split_rpc', '0', true);`,
};

/** The same, with BOTH lines under the source: two lines, one audit entry. */
export const bothLinesUnderTheSource = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -1500, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -1000, 1);
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -15.00, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}', -10.00, 1);
    SELECT set_config('app.split_rpc', '0', true);`,
};

/**
 * A LINKED transfer leg filed under the merge source — the guard case.
 *
 * `splitWithAnOrdinarilyFiledLeg` in the same shape, with the leg's category
 * moved onto the merge source so a merge has to re-file it. This is the MS Money
 * importer's population (86 of the owner's 364 split lines are legs filed under
 * ordinary categories), and it is the fixture that separates a local port with
 * `_rpc_guard('leg')` from one without: without the guard,
 * `trg_protect_linked_leg` raises `split_leg_locked` and the merge is refused
 * locally while the cloud performs it.
 *
 * Everyday stays at −25.00 (the lines sum to the parent) and Rainy day ends at
 * 15.00, so B-1 holds on both before the verb runs.
 */
export const linkedLegUnderTheSource = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 1500, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${RAINY_DAY}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                    transfer_account_id, linked_transfer_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}',
              -1500, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 1);
    UPDATE transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     transfer_account_id)
    VALUES ('${LEG_COUNTERPART}', '${USER}', '${RAINY_DAY}', 'Counterpart', 15.00, 'transfer',
            '2024-03-01', '${EVERYDAY}');
    UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${RAINY_DAY}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order,
                                           transfer_account_id, linked_transfer_id)
      VALUES ('${LEG_LINE}', '${CORNER_SHOP}', '${USER}', '${MERGE_SOURCE}',
              -15.00, 0, '${RAINY_DAY}', '${LEG_COUNTERPART}');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order)
      VALUES ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1);
    UPDATE public.transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${LEG_COUNTERPART}';
    SELECT set_config('app.split_rpc', '0', true);`,
};

// ── The provenance verbs' fixtures ─────────────────────────────────────────

/** Five rows in Everyday, one per state the two verbs' WHERE clauses tell apart. */
export const BLANK_ROW = '70000000-0000-0000-0000-000000000021';
export const NULL_ROW = '70000000-0000-0000-0000-000000000022';
export const SPACES_ROW = '70000000-0000-0000-0000-000000000023';
export const FILED_ROW = '70000000-0000-0000-0000-000000000024';
export const GUESSED_ROW = '70000000-0000-0000-0000-000000000025';

/**
 * Three shapes of "not categorised", one row that is filed and vouched for, and
 * one that is filed as a SUGGESTION.
 *
 * The three blanks are not decoration: `category IS NULL OR btrim(category) = ''`
 * is the predicate both verbs turn on, and on a fixture with only one of the
 * three shapes a port that tested `= ''` (or only `IS NULL`) would pass.
 *
 * Each row is −1.00 and Everyday's balance is moved by −5.00, so B-1 holds.
 */
export const everyShapeOfFiling = {
  sqlite: `
    UPDATE accounts SET balance_minor = balance_minor - 500 WHERE id = '${EVERYDAY}';
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              category, category_confirmed) VALUES
      ('${BLANK_ROW}',   '${USER}', '${EVERYDAY}', 'Blank',     -100, 'expense', '2024-05-01', '',              0),
      ('${NULL_ROW}',    '${USER}', '${EVERYDAY}', 'Null',      -100, 'expense', '2024-05-02', NULL,            0),
      ('${SPACES_ROW}',  '${USER}', '${EVERYDAY}', 'Spaces',    -100, 'expense', '2024-05-03', '   ',           0),
      ('${FILED_ROW}',   '${USER}', '${EVERYDAY}', 'Filed',     -100, 'expense', '2024-05-04', '${WEEKLY_SHOP}', 1),
      ('${GUESSED_ROW}', '${USER}', '${EVERYDAY}', 'Guessed',   -100, 'expense', '2024-05-05', '${WEEKLY_SHOP}', 0);`,
  postgres: `
    UPDATE public.accounts SET balance = balance - 5.00 WHERE id = '${EVERYDAY}';
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     category, category_confirmed) VALUES
      ('${BLANK_ROW}',   '${USER}', '${EVERYDAY}', 'Blank',   -1.00, 'expense', '2024-05-01', '',              false),
      ('${NULL_ROW}',    '${USER}', '${EVERYDAY}', 'Null',    -1.00, 'expense', '2024-05-02', NULL,            false),
      ('${SPACES_ROW}',  '${USER}', '${EVERYDAY}', 'Spaces',  -1.00, 'expense', '2024-05-03', '   ',           false),
      ('${FILED_ROW}',   '${USER}', '${EVERYDAY}', 'Filed',   -1.00, 'expense', '2024-05-04', '${WEEKLY_SHOP}', true),
      ('${GUESSED_ROW}', '${USER}', '${EVERYDAY}', 'Guessed', -1.00, 'expense', '2024-05-05', '${WEEKLY_SHOP}', false);`,
};

/** A blank, unconfirmed row of the STRANGER's. Requires [`secondUser`]. */
export const THEIR_ROW = '70000000-0000-0000-0000-0000000000ab';

export const strangersRow = {
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              category, category_confirmed)
      VALUES ('${THEIR_ROW}', '${STRANGER}', '${SOMEONE_ELSES_ACCOUNT}', 'Theirs', -100, 'expense',
              '2024-05-01', NULL, 0);
    UPDATE accounts SET balance_minor = balance_minor - 100 WHERE id = '${SOMEONE_ELSES_ACCOUNT}';`,
  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     category, category_confirmed)
      VALUES ('${THEIR_ROW}', '${STRANGER}', '${SOMEONE_ELSES_ACCOUNT}', 'Theirs', -1.00, 'expense',
              '2024-05-01', NULL, false);
    UPDATE public.accounts SET balance = balance - 1.00 WHERE id = '${SOMEONE_ELSES_ACCOUNT}';`,
};

/** Corner shop as a split parent — blank category, two ordinary lines. */
export const plainSplitParent = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '', category_confirmed = 0
     WHERE id = '${CORNER_SHOP}';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1500, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -1000, 1);
    DELETE FROM _rpc_guard;`,
  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '', category_confirmed = false
     WHERE id = '${CORNER_SHOP}';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
      ('${LEG_LINE}',   '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -15.00, 0),
      ('${PLAIN_LINE}', '${CORNER_SHOP}', '${USER}', '${WEEKLY_SHOP}', -10.00, 1);
    SELECT set_config('app.split_rpc', '0', true);`,
};

/** Join two setup fragments, keeping them per engine. */
export function setups(...parts) {
  return {
    sqlite: parts.map((part) => part.sqlite).join('\n'),
    postgres: parts.map((part) => part.postgres).join('\n'),
  };
}

/** `accounts.balance` for one account, as a decimal string on either engine. */
export function balanceOf(accountId, expect) {
  return {
    name: `balance_of_${accountId.slice(-4)}`,
    sqlite: accountBalance.sqlite(accountId),
    postgres: accountBalance.postgres(accountId),
    expect,
  };
}

/**
 * B-1: `balance = initial_balance + SUM(amount)`, which must be 0.00 out.
 *
 * Asserted on EVERY verb spec, including the refusals, because B-1 is the
 * invariant the whole application rests on and neither schema enforces it. A
 * verb that refuses must leave it holding just as much as one that accepts.
 */
export function balanceIdentityHolds(accountId) {
  return {
    name: `balance_identity_holds_for_${accountId.slice(-4)}`,
    sqlite: balanceIdentity.sqlite(accountId),
    postgres: balanceIdentity.postgres(accountId),
    expect: '0.00',
  };
}

/**
 * Whether the account NAMED by a refused write is actually there.
 *
 * Written for R-12. Since 20260808170000 widened `transactions.account_id` to
 * (account, owner), "this account does not exist" and "this account is not
 * yours" are refused by the SAME key with the same wording, and the pair of
 * specs that exists to keep those two cases apart can no longer do it by
 * reading the error. It can do it by reading the database: only the ownership
 * half of a composite key can refuse a write that names an account which is
 * demonstrably present.
 */
export function accountExists(accountId, expect) {
  return {
    name: `account_exists_${accountId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM accounts WHERE id = '${accountId}'`,
    postgres: `SELECT COUNT(*) FROM public.accounts WHERE id = '${accountId}'`,
    expect,
  };
}

/** How many rows exist against an account. */
export function rowsInAccount(accountId, expect) {
  return {
    name: `rows_in_account_${accountId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM transactions WHERE account_id = '${accountId}'`,
    postgres: `SELECT COUNT(*) FROM public.transactions WHERE account_id = '${accountId}'`,
    expect,
  };
}

/**
 * U-1 + U-6: exactly one `create` audit row for this transaction, with no
 * `before` and a `after`. The shape assertion is free and catches a port that
 * writes the audit row with the wrong action or fills in `before`.
 *
 * Every per-row assertion in this file carries the row's last four characters in
 * its NAME, and that is load-bearing rather than tidy. Results are collected
 * into a Map keyed by name, so two entries sharing one silently discard the
 * first. It was not tidy before:
 * `repair-the-whole-re-pair-happens-in-one-transaction` asserted
 * `auditRowsForUpdate` on all THREE rows the repair writes — the whole of T-14 —
 * and, all three being called `audit_rows_for_this_update`, only the last was
 * ever checked. `lib/verb-specs.mjs` now refuses a duplicate state name outright,
 * so the class of mistake cannot come back quietly.
 */
export function auditRowsForCreate(transactionId, expect) {
  const predicate = `entity = 'transaction'
      AND entity_id = '${transactionId}'
      AND action = 'create'
      AND before_data IS NULL
      AND after_data IS NOT NULL`;
  return {
    name: `audit_rows_for_create_${transactionId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE ${predicate}`,
    postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE ${predicate}`,
    expect,
  };
}

/** Every audit row in the file, regardless of subject. */
export function auditRowsInTotal(expect) {
  return {
    name: 'audit_rows_in_total',
    sqlite: 'SELECT COUNT(*) FROM financial_audit_log',
    postgres: 'SELECT COUNT(*) FROM public.financial_audit_log',
    expect,
  };
}

/**
 * U-1 + U-6 for an edit: exactly one `update` audit row, with BOTH a before and
 * an after. The shape assertion catches a port that logs an update as a create,
 * or that forgets the `before` — which is the half that makes the log evidence
 * rather than a list of current values.
 */
export function auditRowsForUpdate(transactionId, expect) {
  const predicate = `entity = 'transaction'
      AND entity_id = '${transactionId}'
      AND action = 'update'
      AND before_data IS NOT NULL
      AND after_data IS NOT NULL`;
  return {
    name: `audit_rows_for_update_${transactionId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE ${predicate}`,
    postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE ${predicate}`,
    expect,
  };
}

/** U-1 + U-6 for a delete: a `before`, and deliberately no `after`. */
export function auditRowsForDelete(transactionId, expect) {
  const predicate = `entity = 'transaction'
      AND entity_id = '${transactionId}'
      AND action = 'delete'
      AND before_data IS NOT NULL
      AND after_data IS NULL`;
  return {
    name: `audit_rows_for_delete_${transactionId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE ${predicate}`,
    postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE ${predicate}`,
    expect,
  };
}

/**
 * One TEXT-ish column of one row, read back from the file.
 *
 * Three states have to stay distinguishable and the engines spell none of them
 * alike, so they are normalised HERE, once: a missing row is `ABSENT`, a SQL
 * NULL is `NULL`, and an empty string is `EMPTY`. Without the last one the two
 * behaviours this whole verb turns on — "clears to NULL" and "stores the empty
 * string" — would both read as a blank line.
 */
export function storedText(transactionId, column, expect) {
  const wrap = (cast) => `CASE WHEN ${cast} IS NULL THEN 'NULL'
                              WHEN ${cast} = '' THEN 'EMPTY'
                              ELSE ${cast} END`;
  return {
    name: `stored_${column}_${transactionId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT ${wrap(column)} FROM transactions
        WHERE id = '${transactionId}'), 'ABSENT')`,
    postgres: `SELECT COALESCE((SELECT ${wrap(`${column}::text`)} FROM public.transactions
        WHERE id = '${transactionId}'), 'ABSENT')`,
    expect,
  };
}

/**
 * One boolean column, as `yes`/`no`.
 *
 * SQLite stores 0/1 and Postgres stores t/f; comparing the raw values would
 * report a divergence on every boolean in the schema and hide the one that
 * matters.
 */
export function storedFlag(transactionId, column, expect) {
  return {
    name: `stored_${column}_${transactionId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT CASE WHEN ${column} = 1 THEN 'yes' ELSE 'no' END
        FROM transactions WHERE id = '${transactionId}'), 'ABSENT')`,
    postgres: `SELECT COALESCE((SELECT CASE WHEN ${column} THEN 'yes' ELSE 'no' END
        FROM public.transactions WHERE id = '${transactionId}'), 'ABSENT')`,
    expect,
  };
}

/** Is this row still there? */
export function rowExists(transactionId, expect) {
  return {
    name: `row_exists_${transactionId.slice(-4)}`,
    sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '${transactionId}'`,
    postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '${transactionId}'`,
    expect,
  };
}

/**
 * The tags on one row, as a comma-separated list in a stable order.
 *
 * `NONE` covers "no tags" on both engines, and it has to be spelled out: a
 * child table with no rows and a NULL `text[]` are the same fact, and both
 * render as an empty line, which the runner would then read as a NULL.
 */
export function storedTags(transactionId, expect) {
  return {
    name: `stored_tags_${transactionId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT group_concat(tag, ',') FROM
        (SELECT tag FROM transaction_tags WHERE transaction_id = '${transactionId}' ORDER BY tag)), 'NONE')`,
    postgres: `SELECT COALESCE(NULLIF((SELECT array_to_string(ARRAY(SELECT unnest(tags) ORDER BY 1), ',')
        FROM public.transactions WHERE id = '${transactionId}'), ''), 'NONE')`,
    expect,
  };
}

// ── The split line set, and the rows a leg mints ───────────────────────────
//
// Comparing splits across engines needs three things a transaction comparison
// did not: money as a decimal string from an integer column on one side and a
// numeric on the other; a category rendered by NAME, because a To/From category
// is minted by a trigger and its id is unknowable on both engines; and a link
// rendered as a FACT rather than an id, because a counterpart minted during the
// call gets a different uuid on each engine and always will.

/** A category id column, rendered as the category's name where there is one. */
const categoryName = {
  sqlite: (expr) => `COALESCE((SELECT c.name FROM categories c WHERE c.id = ${expr}), ${expr})`,
  postgres: (expr) =>
    `COALESCE((SELECT c.name FROM public.categories c WHERE c.id::text = ${expr}), ${expr})`,
};

/**
 * The WHOLE line set of one split, as one canonical string.
 *
 * `sort_order:amount:category:target:link:memo` per line, joined by ` | `, in
 * display order. One assertion covers S-1's inputs, the sort order the writer
 * assigns, which line kept its target and which line is half of a transfer —
 * and it fails loudly if any of them moves, which a per-field assertion would
 * not.
 */
export function splitLines(parentId, expect) {
  const parts = (engine) => {
    const money = engine === 'sqlite'
      ? minorToDecimal('s.amount_minor')
      : numericToDecimal('s.amount');
    const target = engine === 'sqlite'
      ? "COALESCE(substr(s.transfer_account_id, -4), '-')"
      : "COALESCE(right(s.transfer_account_id::text, 4), '-')";
    return `CAST(s.sort_order AS TEXT) || ':' || ${money} || ':'
            || ${categoryName[engine]('s.category')} || ':' || ${target} || ':'
            || CASE WHEN s.linked_transfer_id IS NULL THEN '-' ELSE 'linked' END
            || ':' || COALESCE(s.memo, '-')`;
  };
  return {
    name: `split_lines_${parentId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT group_concat(line, ' | ') FROM (
               SELECT ${parts('sqlite')} AS line
                 FROM transaction_splits s
                WHERE s.transaction_id = '${parentId}'
                ORDER BY s.sort_order)), 'NONE')`,
    postgres: `SELECT COALESCE(string_agg(${parts('postgres')}, ' | ' ORDER BY s.sort_order), 'NONE')
                 FROM public.transaction_splits s
                WHERE s.transaction_id = '${parentId}'`,
    expect,
  };
}

/**
 * Every transaction sitting in one account, as one canonical string.
 *
 * `amount:type:category:description:notes:cleared:leg` per row. This is how a
 * minted counterpart is compared without naming its id: everything about it that
 * the writer decided is here, and the one thing it did not decide — the uuid —
 * is not.
 */
export function rowsIn(accountId, expect) {
  const parts = (engine) => {
    const money = engine === 'sqlite'
      ? minorToDecimal('t.amount_minor')
      : numericToDecimal('t.amount');
    const cleared = engine === 'sqlite'
      ? "CASE WHEN t.is_cleared = 1 THEN 'cleared' ELSE 'uncleared' END"
      : "CASE WHEN t.is_cleared THEN 'cleared' ELSE 'uncleared' END";
    return `${money} || ':' || t.type || ':' || ${categoryName[engine]("COALESCE(t.category, '-')")}
            || ':' || t.description || ':' || COALESCE(t.notes, '-') || ':' || ${cleared}
            || ':' || CASE WHEN t.linked_transfer_split_id IS NOT NULL THEN 'leg-of-a-split'
                           WHEN t.linked_transfer_id IS NOT NULL THEN 'linked'
                           ELSE '-' END`;
  };
  return {
    name: `rows_in_${accountId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT group_concat(row, ' | ') FROM (
               SELECT ${parts('sqlite')} AS row
                 FROM transactions t
                WHERE t.account_id = '${accountId}'
                ORDER BY t.amount_minor, t.description)), 'NONE')`,
    postgres: `SELECT COALESCE(string_agg(${parts('postgres')}, ' | ' ORDER BY t.amount, t.description), 'NONE')
                 FROM public.transactions t
                WHERE t.account_id = '${accountId}'`,
    expect,
  };
}

/**
 * T-11, over the whole file: a counterpart that names a split line is named back
 * by it, and a line that names a counterpart is named back by that.
 *
 * Asserted on every split spec, refusals included. Half a pair is the one-sided
 * transfer this entire feature exists to prevent, and neither schema forbids it.
 */
export function legPairsAreMutual() {
  const check = (transactions, splits) => `SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM ${transactions} t
       WHERE t.linked_transfer_split_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM ${splits} s
                          WHERE s.id = t.linked_transfer_split_id
                            AND s.linked_transfer_id = t.id))
    AND NOT EXISTS (
      SELECT 1 FROM ${splits} s
       WHERE s.linked_transfer_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM ${transactions} t
                          WHERE t.id = s.linked_transfer_id
                            AND t.linked_transfer_split_id = s.id))
    THEN 'MUTUAL' ELSE 'BROKEN' END`;
  return {
    name: 'leg_pairs_are_mutual',
    sqlite: check('transactions', 'transaction_splits'),
    postgres: check('public.transactions', 'public.transaction_splits'),
    expect: 'MUTUAL',
  };
}

/**
 * S-1, as an assertion rather than as a hope: the parent's amount minus the sum
 * of its lines, which must be `0.00` whenever the row is split at all.
 *
 * `NOT-SPLIT` is a real answer and not a failure — every refusal spec runs
 * against a fixture that may or may not already be split, and reporting the two
 * cases as one blank line is how a broken sum would hide.
 */
export function splitSumHolds(parentId) {
  const check = (engine) => {
    const table = engine === 'sqlite' ? 'transactions' : 'public.transactions';
    const lines = engine === 'sqlite' ? 'transaction_splits' : 'public.transaction_splits';
    const amount = engine === 'sqlite' ? 't.amount_minor' : 't.amount';
    const lineAmount = engine === 'sqlite' ? 's.amount_minor' : 's.amount';
    const split = engine === 'sqlite' ? 't.is_split = 1' : 't.is_split';
    const difference = `${amount} - COALESCE((SELECT SUM(${lineAmount}) FROM ${lines} s
                          WHERE s.transaction_id = t.id), 0)`;
    const rendered = engine === 'sqlite'
      ? minorToDecimal(difference)
      : numericToDecimal(difference);
    return `SELECT COALESCE((SELECT CASE WHEN ${split} THEN ${rendered} ELSE 'NOT-SPLIT' END
              FROM ${table} t WHERE t.id = '${parentId}'), 'ABSENT')`;
  };
  return {
    name: `split_sum_holds_${parentId.slice(-4)}`,
    sqlite: check('sqlite'),
    postgres: check('postgres'),
    expect: '0.00',
  };
}

/**
 * Every audit row in the file as `entity/action`, sorted.
 *
 * The split writer audits THREE entities and the shape of that set is the
 * assertion: `transaction/create,account/update,transaction/update` is a leg
 * being minted, `transaction/update,account/update` is a total that moved, and a
 * bare `transaction/update` is a re-filing that moved no money. Counting rows
 * would pass on all three.
 */
export function auditShape(expect) {
  return {
    name: 'audit_shape',
    sqlite: `SELECT COALESCE((SELECT group_concat(entry, ',') FROM (
               SELECT entity || '/' || action AS entry
                 FROM financial_audit_log ORDER BY entity, action)), 'NONE')`,
    postgres: `SELECT COALESCE(string_agg(entity || '/' || action, ',' ORDER BY entity, action), 'NONE')
                 FROM public.financial_audit_log`,
    expect,
  };
}

/** Is this split line still there, and does it still name a counterpart? */
export function splitLineState(lineId, expect) {
  return {
    name: `split_line_${lineId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT CASE WHEN linked_transfer_id IS NULL THEN 'unlinked' ELSE 'linked' END
               FROM transaction_splits WHERE id = '${lineId}'), 'GONE')`,
    postgres: `SELECT COALESCE((SELECT CASE WHEN linked_transfer_id IS NULL THEN 'unlinked' ELSE 'linked' END
                 FROM public.transaction_splits WHERE id = '${lineId}'), 'GONE')`,
    expect,
  };
}

/**
 * One row's whole transfer scaffolding, as one canonical string.
 *
 * `type:category:target:link:splitlink`, with the category rendered by NAME
 * (a To/From category's id is minted by a trigger and unknowable on either
 * engine) and every account or row reference by its last four characters.
 *
 * One assertion covers T-6 (which account's To/From category each side landed
 * on), the target, and both halves of the link — and it fails loudly if any of
 * them moves, which four separate assertions would let slide one at a time.
 *
 * `namesIds: false` renders the links as bare `linked` / `leg-of-a-split`
 * instead. That is for the one verb that MINTS the row on the other side:
 * `create_transfer_counterpart` generates a uuid, the two engines generate
 * different ones, and they always will.
 */
export function transferShape(transactionId, expect, { namesIds = true } = {}) {
  const build = (engine) => {
    const last4 = (column) => (engine === 'sqlite'
      ? `COALESCE(substr(${column}, -4), '-')`
      : `COALESCE(right(${column}::text, 4), '-')`);
    const link = namesIds
      ? last4('t.linked_transfer_id')
      : "CASE WHEN t.linked_transfer_id IS NULL THEN '-' ELSE 'linked' END";
    const splitLink = namesIds
      ? last4('t.linked_transfer_split_id')
      : "CASE WHEN t.linked_transfer_split_id IS NULL THEN '-' ELSE 'leg-of-a-split' END";
    const table = engine === 'sqlite' ? 'transactions' : 'public.transactions';
    return `SELECT COALESCE((SELECT t.type || ':' || ${categoryName[engine]("COALESCE(t.category, '-')")}
              || ':' || ${last4('t.transfer_account_id')} || ':' || ${link} || ':' || ${splitLink}
              FROM ${table} t WHERE t.id = '${transactionId}'), 'ABSENT')`;
  };
  return {
    name: `transfer_shape_${transactionId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/**
 * T-7, over the whole file: `A.linked = B.id AND B.linked = A.id`.
 *
 * Enforced **nowhere** in the cloud — DESIGN.md §1.3 records that only
 * `repair_claimed_transfer` even checks it, and then only for the one pair it is
 * about to break. So this is asserted on every transfer spec the way B-1 is: as
 * a property nothing in either engine defends, which therefore has to be looked
 * at rather than assumed.
 *
 * Rows whose link lives on a split LINE are excluded — their mutuality runs
 * through the line and is [`legPairsAreMutual`]'s business.
 *
 * `BROKEN` is a legitimate expectation and one spec uses it on purpose:
 * `clear_transfer_links` unlinks only the rows it was given, so naming one side
 * of a pair leaves the other pointing at it. Both engines do that, it is the
 * documented contract, and a spec that expected `MUTUAL` there would be asserting
 * a fix neither engine has.
 */
export function transferLinksAreMutual(expect = 'MUTUAL') {
  const check = (table) => `SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM ${table} a
       WHERE a.linked_transfer_id IS NOT NULL
         AND a.linked_transfer_split_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM ${table} b
                          WHERE b.id = a.linked_transfer_id
                            AND b.linked_transfer_id = a.id))
    THEN 'MUTUAL' ELSE 'BROKEN' END`;
  return {
    name: 'transfer_links_are_mutual',
    sqlite: check('transactions'),
    postgres: check('public.transactions'),
    expect,
  };
}

/** How many rows in the whole file carry a `linked_transfer_id`. */
export function linkedRows(expect) {
  return {
    name: 'linked_rows_in_file',
    sqlite: 'SELECT COUNT(*) FROM transactions WHERE linked_transfer_id IS NOT NULL',
    postgres: 'SELECT COUNT(*) FROM public.transactions WHERE linked_transfer_id IS NOT NULL',
    expect,
  };
}

// ── Category assertions ────────────────────────────────────────────────────

/**
 * One category's whole shape, as one canonical string.
 *
 * `name:type:level:parent:flags:active`, with the parent by its last four
 * characters and the three semantic flags as letters (`t`ransfer,
 * `r`evaluation, `u`nassigned, plus `s`ystem) so a spec can say "and none of
 * them" as `-`.
 *
 * `GONE` is a first-class answer and most merge specs use it on purpose: the
 * whole operation ends by removing the source, and a refusal spec that only
 * counted rows would pass on a merge that deleted the wrong one.
 */
export function categoryShape(categoryId, expect) {
  const build = (engine) => {
    const table = engine === 'sqlite' ? 'categories' : 'public.categories';
    const truthy = (column) => (engine === 'sqlite' ? `c.${column} = 1` : `c.${column}`);
    const last4 = engine === 'sqlite'
      ? "COALESCE(substr(c.parent_id, -4), '-')"
      : "COALESCE(right(c.parent_id::text, 4), '-')";
    const flags = `COALESCE(NULLIF(
        CASE WHEN ${truthy('is_system')} THEN 's' ELSE '' END ||
        CASE WHEN ${truthy('is_transfer_category')} THEN 't' ELSE '' END ||
        CASE WHEN ${truthy('is_revaluation_category')} THEN 'r' ELSE '' END ||
        CASE WHEN ${truthy('is_unassigned_bucket')} THEN 'u' ELSE '' END, ''), '-')`;
    const active = `CASE WHEN ${truthy('is_active')} THEN 'active' ELSE 'hidden' END`;
    return `SELECT COALESCE((SELECT c.name || ':' || c.type || ':' || c.level || ':' || ${last4}
              || ':' || ${flags} || ':' || ${active}
              FROM ${table} c WHERE c.id = '${categoryId}'), 'GONE')`;
  };
  return {
    name: `category_${categoryId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/**
 * How one transaction is filed, through BOTH reference columns.
 *
 * `category/category_id`, each rendered by the category's NAME where it resolves
 * and by its raw value where it does not — because "the text column still points
 * at a category that no longer exists" is a state this family produces on
 * purpose, and rendering it as a name would hide it.
 *
 * `EMPTY` for the empty string and `NULL` for SQL NULL, kept apart for the reason
 * [`storedText`] gives.
 */
export function filedAs(transactionId, expect) {
  const build = (engine) => {
    const table = engine === 'sqlite' ? 'transactions' : 'public.transactions';
    // `trim` in both, not `btrim`: SQLite has no btrim, and Postgres's trim(x)
    // IS btrim(x). One spelling that means the same thing on both engines.
    const show = (expr) => `CASE WHEN ${expr} IS NULL THEN 'NULL'
                                 WHEN trim(${expr}) = '' THEN 'EMPTY'
                                 ELSE ${categoryName[engine](expr)} END`;
    const uuid = engine === 'sqlite' ? 't.category_id' : 't.category_id::text';
    return `SELECT COALESCE((SELECT ${show('t.category')} || '/' || ${show(uuid)}
              FROM ${table} t WHERE t.id = '${transactionId}'), 'ABSENT')`;
  };
  return {
    name: `filed_as_${transactionId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/** A budget's two reference columns, rendered the same way. */
export function budgetFiledAs(budgetId, expect) {
  const build = (engine) => {
    const table = engine === 'sqlite' ? 'budgets' : 'public.budgets';
    const show = (expr) => `CASE WHEN ${expr} IS NULL THEN 'NULL'
                                 ELSE ${categoryName[engine](expr)} END`;
    const uuid = engine === 'sqlite' ? 'b.category_id' : 'b.category_id::text';
    return `SELECT COALESCE((SELECT ${show('b.category')} || '/' || ${show(uuid)}
              FROM ${table} b WHERE b.id = '${budgetId}'), 'ABSENT')`;
  };
  return {
    name: `budget_filed_as_${budgetId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/** A recurring template's single reference column. */
export function recurringFiledAs(recurringId, expect) {
  const build = (engine) => {
    const table = engine === 'sqlite' ? 'recurring_transactions' : 'public.recurring_transactions';
    return `SELECT COALESCE((SELECT ${categoryName[engine]('r.category')}
              FROM ${table} r WHERE r.id = '${recurringId}'), 'ABSENT')`;
  };
  return {
    name: `recurring_filed_as_${recurringId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/**
 * How many rows in the whole file still refer to one category, by ANY route.
 *
 * The five surfaces `merge_left_references` checks, added together, and
 * deliberately NOT scoped by owner — a merge that left somebody else's row
 * pointing at a deleted category is a real outcome of the cloud's design and
 * this is what makes it visible instead of assumed.
 */
export function referencesTo(categoryId, expect) {
  const build = (engine) => {
    const p = engine === 'sqlite' ? '' : 'public.';
    const uuid = engine === 'sqlite' ? `'${categoryId}'` : `'${categoryId}'::uuid`;
    return `SELECT
        (SELECT COUNT(*) FROM ${p}transactions WHERE category = '${categoryId}' OR category_id = ${uuid})
      + (SELECT COUNT(*) FROM ${p}transaction_splits WHERE category = '${categoryId}')
      + (SELECT COUNT(*) FROM ${p}budgets WHERE category = '${categoryId}' OR category_id = ${uuid})
      + (SELECT COUNT(*) FROM ${p}recurring_transactions WHERE category = '${categoryId}')
      + (SELECT COUNT(*) FROM ${p}categories WHERE parent_id = ${uuid})`;
  };
  return {
    name: `references_to_${categoryId.slice(-4)}`,
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/**
 * Every row of the provenance fixture, as `description=category/vouched|guess`.
 *
 * One assertion covering which rows a bulk verb touched, what it filed them
 * under, and whether it claimed a human agreed — the three things these two
 * verbs decide. Three separate assertions would let one of them slide.
 */
export function filingBoard(expect) {
  const build = (engine) => {
    const table = engine === 'sqlite' ? 'transactions' : 'public.transactions';
    const vouched = engine === 'sqlite'
      ? "CASE WHEN t.category_confirmed = 1 THEN 'vouched' ELSE 'guess' END"
      : "CASE WHEN t.category_confirmed THEN 'vouched' ELSE 'guess' END";
    const filed = `CASE WHEN t.category IS NULL THEN 'NULL'
                        WHEN trim(t.category) = '' THEN 'EMPTY'
                        ELSE ${categoryName[engine]('t.category')} END`;
    const parts = `t.description || '=' || ${filed} || '/' || ${vouched}`;
    return engine === 'sqlite'
      ? `SELECT COALESCE((SELECT group_concat(row, ' | ') FROM (
           SELECT ${parts} AS row FROM ${table} t
            WHERE t.id IN ('${BLANK_ROW}','${NULL_ROW}','${SPACES_ROW}','${FILED_ROW}','${GUESSED_ROW}')
            ORDER BY t.date)), 'NONE')`
      : `SELECT COALESCE(string_agg(${parts}, ' | ' ORDER BY t.date), 'NONE') FROM ${table} t
          WHERE t.id IN ('${BLANK_ROW}','${NULL_ROW}','${SPACES_ROW}','${FILED_ROW}','${GUESSED_ROW}')`;
  };
  return {
    name: 'filing_board',
    sqlite: build('sqlite'),
    postgres: build('postgres'),
    expect,
  };
}

/** The amount stored against one row, read back from the file as a decimal. */
export function storedAmount(transactionId, expect) {
  return {
    name: `stored_amount_${transactionId.slice(-4)}`,
    sqlite: `SELECT COALESCE((SELECT ${'(CASE WHEN amount_minor < 0 THEN \'-\' ELSE \'\' END'
      + " || CAST(abs(amount_minor) / 100 AS TEXT) || '.'"
      + " || substr('0' || CAST(abs(amount_minor) % 100 AS TEXT), -2, 2))"}
        FROM transactions WHERE id = '${transactionId}'), 'ABSENT')`,
    postgres: `SELECT COALESCE((SELECT amount::text FROM public.transactions
        WHERE id = '${transactionId}'), 'ABSENT')`,
    expect,
  };
}
