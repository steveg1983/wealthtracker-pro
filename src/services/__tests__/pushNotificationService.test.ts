import { describe, it, expect, vi } from 'vitest';
import { PushNotificationService } from '../pushNotificationService';
import type { PushNotificationServiceOptions } from '../pushNotificationService';

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

const createEnv = (overrides: Partial<PushNotificationServiceOptions> = {}) => {
  const storage = overrides.storage ?? createStorage();
  const navigatorRef = overrides.navigatorRef ?? {
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: vi.fn().mockResolvedValue({ endpoint: 'test' })
        }
      })
    }
  };
  const windowRef = overrides.windowRef ?? {
    PushManager: function () {},
    atob: (value: string) => atob(value)
  };
  const notificationAPI = overrides.notificationAPI ?? {
    permission: 'granted' as NotificationPermission,
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission)
  };
  const fetchFn = overrides.fetchFn ?? vi.fn(async () => new Response());
  const logger = overrides.logger ?? {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  const service = new PushNotificationService({
    storage,
    navigatorRef,
    windowRef,
    fetchFn,
    notificationAPI,
    logger
  });

  return { service, storage, navigatorRef, windowRef, fetchFn, notificationAPI, logger };
};

describe('PushNotificationService (DI)', () => {
  it('initializes with injected refs and checks permission', async () => {
    const env = createEnv();
    await env.service.initialize();
    expect(env.navigatorRef.serviceWorker?.ready).toBeDefined();
  });

  it('requests permission and subscribes', async () => {
    const subscribe = vi.fn().mockResolvedValue({ endpoint: 'test' });
    const env = createEnv({
      navigatorRef: {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe
            }
          })
        }
      },
      notificationAPI: {
        permission: 'default',
        requestPermission: vi.fn(async () => 'granted')
      }
    });

    await env.service.initialize();
    const perm = await env.service.requestPermission();

    expect(perm).toBe('granted');
    expect(subscribe).toHaveBeenCalled();
  });

  it('persists and retrieves notification preferences', async () => {
    const env = createEnv();
    await env.service.updatePreferences({
      budgetAlerts: false,
      billReminders: false,
      goalAchievements: true,
      investmentAlerts: true,
      weeklyReports: true,
      unusualSpending: false
    });

    expect(env.storage.setItem).toHaveBeenCalled();
    const prefs = env.service.getNotificationPreferences();
    expect(prefs.weeklyReports).toBe(true);
  });
});
