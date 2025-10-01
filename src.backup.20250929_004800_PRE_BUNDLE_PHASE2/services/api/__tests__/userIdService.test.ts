import { beforeEach, describe, expect, it, vi } from 'vitest';

type SupabaseStub = ReturnType<typeof createSupabaseStub>;

type ResolveDatabaseUserId = typeof import('../../userIdService')['resolveDatabaseUserId'];
type IsDatabaseUuid = typeof import('../../userIdService')['isDatabaseUuid'];

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

vi.mock('../../serviceFactory', () => ({
  lazyLogger: loggerMock
}));

function createSupabaseStub() {
  const chain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn()
  };

  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });

  return chain;
}

let supabaseConfigured = true;
let supabaseStub: SupabaseStub | null = createSupabaseStub();

vi.mock('../../api/supabaseClient', () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => supabaseConfigured
}));

let resolveDatabaseUserId: ResolveDatabaseUserId;
let isDatabaseUuid: IsDatabaseUuid;

beforeEach(async () => {
  vi.resetModules();

  supabaseConfigured = true;
  supabaseStub = createSupabaseStub();

  Object.values(loggerMock).forEach(mockFn => mockFn.mockReset());

  const module = await import('../../userIdService');
  resolveDatabaseUserId = module.resolveDatabaseUserId;
  isDatabaseUuid = module.isDatabaseUuid;
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
    expect(supabaseStub?.from).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('delegates to Supabase when resolving Clerk IDs', async () => {
    supabaseStub?.maybeSingle.mockResolvedValue({
      data: { database_user_id: 'resolved-id' },
      error: null
    });

    await expect(resolveDatabaseUserId('user_123')).resolves.toBe('resolved-id');

    expect(supabaseStub?.from).toHaveBeenCalledWith('user_id_mappings');
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('returns null and logs warning when mapping is missing', async () => {
    supabaseStub?.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(resolveDatabaseUserId('user_missing')).resolves.toBeNull();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[userIdService] No mapping found for clerk ID; returning null',
      { clerkId: 'user_missing' }
    );
  });

  it('returns null and logs error when Supabase lookup throws', async () => {
    const error = new Error('boom');
    supabaseStub?.maybeSingle.mockRejectedValue(error);

    await expect(resolveDatabaseUserId('user_error')).resolves.toBeNull();

    expect(loggerMock.error).toHaveBeenCalledWith(
      '[userIdService] Unexpected error fetching user mapping by clerk ID',
      error
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[userIdService] No mapping found for clerk ID; returning null',
      { clerkId: 'user_error' }
    );
  });

  it('falls back to Clerk IDs when Supabase is not configured', async () => {
    supabaseConfigured = false;
    supabaseStub = null;

    await expect(resolveDatabaseUserId('user_offline')).resolves.toBe('user_offline');

    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
