// Setup fragments shared by more than one spec.
//
// Not a spec (the loader only reads *.spec.mjs). These live here because three
// specs need the same split, and a copy that drifts would make two specs test
// two different things under one invariant number.
//
// All data is invented. Money is minor units on the SQLite side and decimal on
// the Postgres side — that is the whole point of writing both by hand.

/** The fixture's transaction turned into an ordinary two-line split. */
export const splitParent = {
  sqlite: `
    -- The command layer opens the guard, writes, and closes it inside one
    -- transaction (DESIGN.md §2.4).
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '70000000-0000-0000-0000-000000000001';
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
      ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -1500, 0),
      ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -1000, 1);
    DELETE FROM _rpc_guard;`,

  postgres: `
    -- The cloud's gate is a transaction-local session variable.
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '70000000-0000-0000-0000-000000000001';
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
      ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -15.00, 0),
      ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -10.00, 1);
    SELECT set_config('app.split_rpc', '0', true);`,
};

/**
 * The same split, but line 1 is a transfer LEG: it is linked to a counterpart
 * transaction in the other account, and that counterpart names the line back.
 * This is the shape 20260806094058_split_transfer_legs.sql exists to protect.
 */
export const splitWithTransferLeg = {
  sqlite: `
    INSERT INTO _rpc_guard VALUES ('split');
    UPDATE transactions SET is_split = 1, category = '' WHERE id = '70000000-0000-0000-0000-000000000001';
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
    VALUES ('70000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
            'a0000000-0000-0000-0000-000000000002', 'Counterpart', 1500, 'transfer', '2024-03-01',
            'a0000000-0000-0000-0000-000000000001');
    -- The To/From category is minted by a trigger on BOTH engines now, so its
    -- id is unknown at authoring time on both: reach it through the account.
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order,
                                    transfer_account_id, linked_transfer_id) VALUES
      ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111',
       (SELECT id FROM categories
         WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category = 1),
       -1500, 0, 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000009');
    INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
      ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -1000, 1);
    UPDATE transactions SET linked_transfer_split_id = '50000000-0000-0000-0000-000000000001'
     WHERE id = '70000000-0000-0000-0000-000000000009';
    DELETE FROM _rpc_guard;`,

  postgres: `
    SELECT set_config('app.split_rpc', '1', true);
    UPDATE public.transactions SET is_split = true, category = '' WHERE id = '70000000-0000-0000-0000-000000000001';
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, transfer_account_id)
    VALUES ('70000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
            'a0000000-0000-0000-0000-000000000002', 'Counterpart', 15.00, 'transfer', '2024-03-01',
            'a0000000-0000-0000-0000-000000000001');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order,
                                           transfer_account_id, linked_transfer_id) VALUES
      ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111',
       (SELECT id::text FROM public.categories
         WHERE account_id = 'a0000000-0000-0000-0000-000000000002' AND is_transfer_category),
       -15.00, 0, 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000009');
    INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
      ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
       '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -10.00, 1);
    UPDATE public.transactions SET linked_transfer_split_id = '50000000-0000-0000-0000-000000000001'
     WHERE id = '70000000-0000-0000-0000-000000000009';
    SELECT set_config('app.split_rpc', '0', true);`,
};

/** A transaction-level transfer pair: two rows, opposite amounts, mutual links. */
export const transferPair = {
  // Both engines link in a second pass here, deliberately: this fragment is
  // also used by a spec that runs OUTSIDE a transaction, where SQLite's
  // deferred check happens at the end of each statement and a forward
  // reference would fail. Closing the cycle in one transaction is r11's job,
  // and it gets a spec of its own rather than being assumed here.
  sqlite: `
    INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                              transfer_account_id) VALUES
      ('70000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
       'a0000000-0000-0000-0000-000000000001', 'To savings', -1500, 'transfer', '2024-04-01',
       'a0000000-0000-0000-0000-000000000002'),
      ('70000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
       'a0000000-0000-0000-0000-000000000002', 'From everyday', 1500, 'transfer', '2024-04-01',
       'a0000000-0000-0000-0000-000000000001');
    UPDATE transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000005'
     WHERE id = '70000000-0000-0000-0000-000000000004';
    UPDATE transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000004'
     WHERE id = '70000000-0000-0000-0000-000000000005';`,

  postgres: `
    INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                     transfer_account_id) VALUES
      ('70000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
       'a0000000-0000-0000-0000-000000000001', 'To savings', -15.00, 'transfer', '2024-04-01',
       'a0000000-0000-0000-0000-000000000002'),
      ('70000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
       'a0000000-0000-0000-0000-000000000002', 'From everyday', 15.00, 'transfer', '2024-04-01',
       'a0000000-0000-0000-0000-000000000001');
    -- Postgres cannot name a row that does not exist yet: this FK is not
    -- deferrable (see r11), so the links go on in a second pass.
    UPDATE public.transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000005'
     WHERE id = '70000000-0000-0000-0000-000000000004';
    UPDATE public.transactions SET linked_transfer_id = '70000000-0000-0000-0000-000000000004'
     WHERE id = '70000000-0000-0000-0000-000000000005';`,
};
