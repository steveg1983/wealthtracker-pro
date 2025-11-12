import { describe, it, expect, vi } from 'vitest';
import { MobileService } from '../mobileService';
import type { MobileServiceOptions } from '../mobileService';

const createStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    data
  };
};

const createEnv = (overrides: Partial<MobileServiceOptions> = {}) => {
  const storage = overrides.storage ?? createStorage();
  const windowRef = overrides.windowRef ?? {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  const navigatorRef = overrides.navigatorRef ?? { onLine: true };
  const notificationAdapter = overrides.notificationAdapter ?? {
    getPermission: vi.fn(() => 'granted' as NotificationPermission),
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
    show: vi.fn()
  };

  const service = new MobileService({
    storage,
    windowRef,
    navigatorRef,
    notificationAdapter
  });

  return { service, storage, windowRef, navigatorRef, notificationAdapter };
};

describe('MobileService (injected env)', () => {
  it('registers network listeners and tracks offline transactions', () => {
    const env = createEnv();
    expect(env.windowRef.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(env.windowRef.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

    const id = env.service.addOfflineTransaction({ amount: 50 }, 'create');
    expect(id).toBeTruthy();
    expect(env.storage.setItem).toHaveBeenCalledWith(
      'offline_transactions',
      expect.stringContaining('"action":"create"')
    );
  });

  it('updates notification settings when permission requested', async () => {
    const getPermission = vi.fn(() => 'default' as NotificationPermission);
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    const env = createEnv({
      notificationAdapter: {
        getPermission,
        requestPermission,
        show: vi.fn()
      }
    });

    const granted = await env.service.requestNotificationPermission();
    expect(granted).toBe(true);
    expect(requestPermission).toHaveBeenCalled();
  });

  it('sends notifications through adapter when enabled', async () => {
    const show = vi.fn();
    const env = createEnv({
      notificationAdapter: {
        getPermission: () => 'granted',
        requestPermission: async () => 'granted',
        show
      }
    });

    env.service.updateNotificationSettings({
      enabled: true,
      quietHours: { enabled: false, start: '22:00', end: '06:00' }
    });

    await env.service.sendNotification('Test', 'Body');
    expect(show).toHaveBeenCalledWith('Test', expect.objectContaining({ body: 'Body' }));
  });
});
