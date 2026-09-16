import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ensureProfile,
  cleanupProfile,
  createAccount,
  recordTransaction,
  tryFetchTransactionsAsAnon,
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

  it('refuses anon outright: no read, no delete, and the row survives', async () => {
    const inserted = await recordTransaction(userId, accountId);
    const del = await tryDeleteTransactionAsAnon(inserted.id);

    // 20260916161455 revoked every table privilege from anon, so the DELETE
    // is refused at the privilege check (SQLSTATE 42501) before RLS is even
    // consulted. This is one rung stronger than what this test asserted
    // before that migration — error:null with zero rows affected, the grant
    // present and RLS doing all the work — and one stronger again than the
    // pre-2026-06-11 state, when anon SELECT was USING (true) and the
    // assertion was inverted. If 42501 ever stops arriving here, a grant has
    // come back; that is a finding, not a flake.
    expect(del.error?.code).toBe('42501');
    expect(del.data ?? []).toHaveLength(0);

    // Reads are refused the same way — an unauthenticated request no longer
    // even gets its empty set.
    const read = await tryFetchTransactionsAsAnon(userId);
    expect(read.error?.code).toBe('42501');
    expect(read.data ?? []).toHaveLength(0);

    // The service role bypasses all of it and confirms the refused delete
    // did NOT remove the row.
    const serviceRow = await fetchTransactionByIdService(inserted.id);
    expect(serviceRow.id).toBe(inserted.id);
  });
});
