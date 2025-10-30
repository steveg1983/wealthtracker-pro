import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseClientMock,
  type SupabaseClientMock,
  type SupabaseTableMock,
  buildUserIdMappingRow,
} from '@wealthtracker/testing';

type ResolveDatabaseUserId = typeof import('../../userIdService')['resolveDatabaseUserId'];
type IsDatabaseUuid = typeof import('../../userIdService')['isDatabaseUuid'];

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
})) as Record<'info' | 'warn' | 'error' | 'debug', ReturnType<typeof vi.fn>>;

vi.mock('../../serviceFactory', () => ({
  lazyLogger: {
    debug: loggerMock.debug,
    info: loggerMock.info,
    warn: loggerMock.warn,
    error: loggerMock.error,
    getHistory: vi.fn(() => []),
    clearHistory: vi.fn(),
    getLogger: () => loggerMock,
  },
}));

let supabaseConfigured = true;
let supabaseClient: SupabaseClientMock | null = null;
let userIdMappingsTable: SupabaseTableMock<'user_id_mappings'>;

const configureSupabaseClient = (): void => {
  supabaseClient = createSupabaseClientMock();
  userIdMappingsTable = supabaseClient.__mock.table('user_id_mappings');
};

const loadUserIdService = async (): Promise<void> => {
  vi.resetModules();
  const module = await import('../../userIdService');
  module.__testing.setSupabaseClient(supabaseClient);
  resolveDatabaseUserId = module.resolveDatabaseUserId;
  isDatabaseUuid = module.isDatabaseUuid;
};

vi.mock('@wealthtracker/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@wealthtracker/core')>();
  return {
    ...actual,
    async ensureSupabaseClient() {
      if (!supabaseClient) {
        throw new Error('Supabase mock not configured');
      }
      return supabaseClient;
    },
    isSupabaseConfigured: () => supabaseConfigured,
  };
});

let resolveDatabaseUserId: ResolveDatabaseUserId;
let isDatabaseUuid: IsDatabaseUuid;

beforeEach(async () => {
  supabaseConfigured = true;
  configureSupabaseClient();
  Object.values(loggerMock).forEach(mockFn => mockFn.mockReset());
  await loadUserIdService();
});

describe('isDatabaseUuid', () => {
  it('returns true for valid UUIDs', () => {
    expect(isDatabaseUuid('11111111-2222-3333-4444-555555555555')).toBe(true);
  });

  it('returns false for Clerk IDs or empty strings', () => {
    expect(isDatabaseUuid('user_123')).toBe(false);
    expect(isDatabaseUuid('')).toBe(false);
    expect(isDatabaseUuid(undefined)).toBe(false);
  });
});

describe('resolveDatabaseUserId', () => {
  it('returns database UUID as-is without calling Supabase', async () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const result = await resolveDatabaseUserId(uuid);

  expect(result).toBe(uuid);
  expect(userIdMappingsTable.query.select).not.toHaveBeenCalled();
  expect(userIdMappingsTable.filter.maybeSingle).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('delegates to Supabase when resolving Clerk IDs', async () => {
    const mapping = buildUserIdMappingRow({
      clerk_id: 'user_123',
      database_user_id: 'resolved-id',
    });
    userIdMappingsTable.filter.maybeSingle.mockResolvedValue({
      data: mapping,
      error: null,
    });

    const client = supabaseClient;
    if (!client) {
      throw new Error('Supabase client not configured');
    }

    const probe = await client
      .from('user_id_mappings')
      .select('database_user_id')
      .eq('clerk_id', 'user_123')
      .maybeSingle();
    expect(probe).toEqual({ data: mapping, error: null });

    await expect(resolveDatabaseUserId('user_123')).resolves.toBe('resolved-id');

    expect(userIdMappingsTable.query.select).toHaveBeenCalledWith('database_user_id');
    expect(userIdMappingsTable.filter.eq).toHaveBeenCalledWith('clerk_id', 'user_123');
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('returns null and logs warning when mapping is missing', async () => {
    userIdMappingsTable.filter.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(resolveDatabaseUserId('user_missing')).resolves.toBeNull();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[userIdService] No mapping found for clerk ID; returning null',
      { clerkId: 'user_missing' },
    );
  });

  it('returns null and logs error when Supabase lookup throws', async () => {
    const error = new Error('boom');
    userIdMappingsTable.filter.maybeSingle.mockRejectedValue(error);

    await expect(resolveDatabaseUserId('user_error')).resolves.toBeNull();

    expect(loggerMock.error).toHaveBeenCalledWith(
      '[userIdService] Unexpected error fetching user mapping by clerk ID',
      error,
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[userIdService] No mapping found for clerk ID; returning null',
      { clerkId: 'user_error' },
    );
  });

  it('falls back to Clerk IDs when Supabase is not configured', async () => {
    supabaseConfigured = false;
    supabaseClient = null;

    Object.values(loggerMock).forEach(mockFn => mockFn.mockReset());
    await loadUserIdService();
    const core = await import('@wealthtracker/core');
    expect(core.isSupabaseConfigured()).toBe(false);

    await expect(resolveDatabaseUserId('user_offline')).resolves.toBe('user_offline');

    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
