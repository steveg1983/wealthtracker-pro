import { describe, it, expect, afterEach } from 'vitest';
import { registerSupabaseTokenGetter, getSupabaseAccessToken } from '../supabaseToken';

describe('supabaseToken registry', () => {
  afterEach(() => {
    registerSupabaseTokenGetter(null);
  });

  it('returns null when no getter is registered (signed out → anon)', async () => {
    registerSupabaseTokenGetter(null);
    expect(await getSupabaseAccessToken()).toBeNull();
  });

  it('returns the token from the registered getter', async () => {
    registerSupabaseTokenGetter(async () => 'jwt-abc');
    expect(await getSupabaseAccessToken()).toBe('jwt-abc');
  });

  it('passes through a null token from the getter', async () => {
    registerSupabaseTokenGetter(async () => null);
    expect(await getSupabaseAccessToken()).toBeNull();
  });

  it('degrades to null when the getter throws — never propagates into data calls', async () => {
    registerSupabaseTokenGetter(async () => {
      throw new Error('clerk session expired');
    });
    await expect(getSupabaseAccessToken()).resolves.toBeNull();
  });

  it('unregistering restores anon behaviour', async () => {
    registerSupabaseTokenGetter(async () => 'jwt-abc');
    registerSupabaseTokenGetter(null);
    expect(await getSupabaseAccessToken()).toBeNull();
  });
});
