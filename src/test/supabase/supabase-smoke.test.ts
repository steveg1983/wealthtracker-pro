import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureProfile, cleanupProfile, createAccount, recordTransaction, fetchTransactionsAsUser, tryDeleteTransactionAsAnon } from './helpers';

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
    const error = await tryDeleteTransactionAsAnon(inserted.id);
    expect(error).toBeTruthy();
    if (error && 'code' in error) {
      expect(error.code).toBe('42501');
    } else {
      expect(error?.message ?? '').toMatch(/permission|Unauthorized/i);
    }
  });
});
