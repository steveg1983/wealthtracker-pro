import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserService, UserService } from '../api/userService';

const createLocalStorage = () => ({
  setItem: vi.fn(),
  getItem: vi.fn()
});

describe('UserService (fallback + DI)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const now = vi.fn(() => new Date('2025-08-01T00:00:00.000Z'));

  beforeEach(() => {
    Object.values(logger).forEach(fn => fn.mockReset());
    now.mockClear();
  });

  it('falls back to local storage preferences when Supabase is disabled', async () => {
    const localStorage = createLocalStorage();
    const service = createUserService({
      isSupabaseConfigured: () => false,
      localStorage,
      logger,
      now
    });

    await service.updatePreferences('user', { theme: 'dark' });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'wealthtracker_preferences',
      JSON.stringify({ theme: 'dark' })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when local storage is unavailable for fallback writes', async () => {
    const service = createUserService({
      isSupabaseConfigured: () => false,
      localStorage: null,
      logger,
      now
    });

    await service.updateSettings('user', { language: 'en' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Local storage unavailable; skipping write for wealthtracker_settings'
    );
  });

  it('allows the static UserService to be reconfigured for tests', async () => {
    const localStorage = createLocalStorage();
    UserService.configure({
      isSupabaseConfigured: () => false,
      localStorage,
      logger,
      now
    });

    await UserService.updatePreferences('user', { notifications: true });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'wealthtracker_preferences',
      JSON.stringify({ notifications: true })
    );
  });
});
