import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseService, SupabaseService } from '../supabaseService';

const createLogger = () => ({ error: vi.fn(), warn: vi.fn() });

describe('SupabaseService (fallback)', () => {
  const logger = createLogger();

  beforeEach(() => {
    logger.error.mockReset();
    logger.warn.mockReset();
  });

  it('returns safe defaults when supabase client is unavailable', async () => {
    const service = createSupabaseService({
      supabaseClient: null,
      logger
    });

    expect(await service.getAccounts('user')).toEqual([]);
    expect(await service.getTransactions('user')).toEqual([]);
    expect(await service.createAccount('user', { name: 'Checking' })).toBeNull();
    expect(await service.createTransaction('user', { amount: 10 })).toBeNull();
    expect(await service.importTransactions('user', [{ amount: 5 }])).toEqual({ success: 0, failed: 0 });
    expect(service.subscribeToAccounts('user', vi.fn())).toBeNull();
  });

  it('allows static SupabaseService reconfiguration', async () => {
    SupabaseService.configure({
      supabaseClient: null,
      logger
    });

    expect(await SupabaseService.getAccounts('user')).toEqual([]);
    expect(await SupabaseService.getGoals('user')).toEqual([]);
  });
});
