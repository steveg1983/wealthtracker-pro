import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ensureProfile,
  cleanupProfile,
  createAccount,
  recordTransaction,
  fetchTransactionsAsUser,
  tryDeleteTransactionAsAnon,
  fetchTransactionByIdService,
} from './helpers';

// Only run these tests when RUN_SUPABASE_REAL_TESTS is set
const shouldRunTests = process.env.RUN_SUPABASE_REAL_TESTS === 'true';

describe.skipIf(!shouldRunTests)('Supabase smoke', { timeout: 60000 }, () => {
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const profile = await ensureProfile();
    userId = profile.id;
    const account = await createAccount(userId);
    accountId = account.id;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupProfile(userId);
    }
  });

  it('creates a transaction via service role and persists it', async () => {
    const inserted = await recordTransaction(userId, accountId);
    expect(inserted.user_id).toBe(userId);

    const serviceRow = await fetchTransactionByIdService(inserted.id);
    expect(serviceRow).toBeDefined();
    expect(serviceRow.amount).toBeCloseTo(123.45);
    expect(serviceRow.type).toBe('expense');
  });

  it('enforces RLS: anon cannot delete OR read another user\'s rows', async () => {
    const inserted = await recordTransaction(userId, accountId);
    const { error, data } = await tryDeleteTransactionAsAnon(inserted.id);

    // RLS silently blocks the delete — no error, zero rows affected (the row
    // is invisible to the anon key, so the DELETE matches nothing).
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);

    // Hardened RLS (2026-06-11): the anon key can no longer READ the row
    // either. Per-user isolation means an unauthenticated request sees an
    // empty set, not the row. (This assertion was inverted before the
    // RLS-data-isolation migration, when anon SELECT was USING (true).)
    const anonRows = await fetchTransactionsAsUser(userId);
    expect(anonRows.some((row) => row.id === inserted.id)).toBe(false);

    // The service role bypasses RLS and confirms the blocked delete did NOT
    // actually remove the row — it still exists, it's just invisible to anon.
    const serviceRow = await fetchTransactionByIdService(inserted.id);
    expect(serviceRow.id).toBe(inserted.id);
  });
});
