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

describe('Supabase smoke', { timeout: 60000 }, () => {
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

  it('enforces RLS by blocking anon deletion', async () => {
    const inserted = await recordTransaction(userId, accountId);
    const { error, data } = await tryDeleteTransactionAsAnon(inserted.id);

    // RLS should silently block the delete – no error, no rows affected
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);

    // Anonymous reader should not see the transaction at all
    const rowsAfter = await fetchTransactionsAsUser(userId);
    expect(rowsAfter.some((row) => row.id === inserted.id)).toBe(false);

    // Service-role fetch confirms the record still exists in the table
    const serviceRow = await fetchTransactionByIdService(inserted.id);
    expect(serviceRow.id).toBe(inserted.id);
  });
});
