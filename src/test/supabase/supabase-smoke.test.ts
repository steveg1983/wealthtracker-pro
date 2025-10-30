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

  it('creates a transaction via service role and reads it as anon user', async () => {
    const inserted = await recordTransaction(userId, accountId);
    expect(inserted.user_id).toBe(userId);

    const rows = await fetchTransactionsAsUser(userId);
    const match = rows.find((row) => row.id === inserted.id);
    expect(match).toBeDefined();
    expect(match?.amount).toBeCloseTo(123.45);
    expect(match?.type).toBe('expense');
  });

  it('enforces RLS by blocking anon deletion', async () => {
    const inserted = await recordTransaction(userId, accountId);
    const { error, data } = await tryDeleteTransactionAsAnon(inserted.id);

    // RLS should silently block the delete – no error, no rows affected
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);

    // Anonymous reader should still see the transaction
    const rowsAfter = await fetchTransactionsAsUser(userId);
    expect(rowsAfter.some((row) => row.id === inserted.id)).toBe(true);

    // Service-role fetch confirms the record still exists in the table
    const serviceRow = await fetchTransactionByIdService(inserted.id);
    expect(serviceRow.id).toBe(inserted.id);
  });
  });
});
