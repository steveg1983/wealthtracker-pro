import { describe, it, expect, vi } from 'vitest';
import { RealtimeService } from '../realtimeService';

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createUserIdService = (resolvedId: string | null) => ({
  getDatabaseUserId: vi.fn(async () => resolvedId)
});

describe('RealtimeService (deterministic)', () => {
  it('logs when max reconnection attempts are reached', () => {
    const logger = createLogger();
    const service = new RealtimeService({
      supabaseClient: null,
      userIdService: createUserIdService(null) as any,
      logger,
      setTimeoutFn: vi.fn(),
      clearTimeoutFn: vi.fn()
    });

    (service as any).reconnectAttempts = (service as any).maxReconnectAttempts;
    (service as any).scheduleReconnect();

    expect(logger.warn).toHaveBeenCalledWith('Max reconnection attempts reached');
  });

  it('logs errors when Clerk ID cannot be resolved', async () => {
    const logger = createLogger();
    const userService = createUserIdService(null);
    const supabaseMock = {
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }))
    };

    const service = new RealtimeService({
      supabaseClient: supabaseMock as any,
      userIdService: userService as any,
      logger,
      setTimeoutFn: vi.fn(),
      clearTimeoutFn: vi.fn()
    });

    const result = await service.subscribeToAccounts('user_123', vi.fn());
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      '[RealtimeService] Could not resolve database ID for Clerk ID:',
      'user_123'
    );
  });
});
