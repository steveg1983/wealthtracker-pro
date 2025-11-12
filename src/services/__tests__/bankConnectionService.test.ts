import { describe, it, expect, vi } from 'vitest';
import { BankConnectionService } from '../bankConnectionService';

type StorageSeed = Record<string, string>;

const createStorageMock = (seed: StorageSeed = {}) => {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    dump: () => Object.fromEntries(store)
  };
};

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const DAY = 24 * 60 * 60 * 1000;

const createService = (options?: { storageSeed?: StorageSeed; startTime?: number }) => {
  const storage = createStorageMock(options?.storageSeed);
  const logger = createLogger();
  let currentTime = options?.startTime ?? Date.UTC(2025, 0, 1);
  let idCounter = 0;

  const service = new BankConnectionService({
    storage,
    location: { origin: 'https://app.wealth.local' },
    logger,
    now: () => currentTime,
    idFactory: () => `conn_test_${++idCounter}`
  });

  return {
    service,
    storage,
    logger,
    advance: (ms: number) => {
      currentTime += ms;
    }
  };
};

describe('BankConnectionService', () => {
  it('restores persisted connections and config from storage', () => {
    const seedConnection = [
      {
        id: 'conn_seed',
        provider: 'plaid' as const,
        institutionId: 'seed-bank',
        institutionName: 'Seed Bank',
        status: 'connected' as const,
        accounts: ['acc_1'],
        createdAt: '2025-01-01T00:00:00.000Z',
        lastSync: '2025-01-02T00:00:00.000Z'
      }
    ];

    const seedConfig = {
      plaid: { clientId: 'abc', secret: 'def' },
      trueLayer: { clientId: 'ghi', clientSecret: 'jkl' }
    };

    const { service } = createService({
      storageSeed: {
        bankConnections: JSON.stringify(seedConnection),
        bankAPIConfig: JSON.stringify(seedConfig)
      }
    });

    expect(service.getConnections()).toHaveLength(1);
    expect(service.getConnections()[0].createdAt).toBeInstanceOf(Date);
    expect(service.getConfigStatus()).toEqual({ plaid: true, trueLayer: true });
  });

  it('builds a TrueLayer auth URL using configured redirect', async () => {
    const { service } = createService();
    service.initialize({
      trueLayer: { clientId: 'tl-client', redirectUri: 'https://demo/callback' }
    });

    const result = await service.connectBank('barclays', 'truelayer');
    expect(result.url).toContain('auth.truelayer.com');
    expect(result.url).toContain('client_id=tl-client');
    expect(result.url).toContain(encodeURIComponent('https://demo/callback'));
    expect(result.linkToken).toBeUndefined();
  });

  it('falls back to Plaid link tokens when requested', async () => {
    const { service } = createService();
    const result = await service.connectBank('hsbc', 'plaid');
    expect(result.linkToken).toBe('link-sandbox-demo-token');
    expect(result.url).toBeUndefined();
  });

  it('creates and persists a connection after OAuth callback', async () => {
    const { service, storage } = createService();
    const connection = await service.handleOAuthCallback('auth-code');

    expect(connection.id).toMatch(/^conn_test_/);
    expect(connection.createdAt).toBeInstanceOf(Date);
    const stored = storage.dump().bankConnections;
    expect(stored).toContain(connection.id);
    expect(service.getConnection(connection.id)).toBeDefined();
  });

  it('updates lastSync during syncConnection and reports account counts', async () => {
    const { service, advance } = createService();
    const connection = await service.handleOAuthCallback('code');
    const initialLastSync = connection.lastSync?.getTime() ?? 0;
    service.linkAccount(connection.id, 'ext-1', 'acc-1');

    advance(DAY);
    const result = await service.syncConnection(connection.id);
    expect(result.success).toBe(true);
    expect(result.accountsUpdated).toBe(1);
    expect(service.getConnection(connection.id)?.lastSync?.getTime()).toBeGreaterThan(initialLastSync);
  });

  it('identifies connections that require reauthorization by status or expiry', async () => {
    const { service, advance } = createService({ startTime: Date.UTC(2025, 0, 1) });
    const reauthNeeded = await service.handleOAuthCallback('reauth');
    const expired = await service.handleOAuthCallback('expired');
    const healthy = await service.handleOAuthCallback('healthy');

    // Force statuses
    service.getConnection(reauthNeeded.id)!.status = 'reauth_required';
    const expiredConn = service.getConnection(expired.id)!;
    expiredConn.expiresAt = new Date(expiredConn.createdAt.getTime() + DAY);

    advance(2 * DAY);
    const list = service.needsReauth();
    expect(list.map(c => c.id)).toEqual(expect.arrayContaining([reauthNeeded.id, expired.id]));
    expect(list.map(c => c.id)).not.toContain(healthy.id);
  });

  it('disconnect removes the connection and updates persistent storage', async () => {
    const { service, storage } = createService();
    const connection = await service.handleOAuthCallback('code');
    const removed = await service.disconnect(connection.id);
    expect(removed).toBe(true);
    expect(service.getConnection(connection.id)).toBeUndefined();
    expect(storage.dump().bankConnections).toBe('[]');
  });

  it('reports configuration status per provider', () => {
    const { service } = createService();
    service.initialize({
      plaid: { clientId: 'plaid', secret: 'secret' }
    });

    expect(service.isConfigured()).toBe(true);
    expect(service.getConfigStatus()).toEqual({ plaid: true, trueLayer: false });
  });

  it('logs and swallows storage errors', () => {
    const faultyStorage = {
      getItem: vi.fn(() => {
        throw new Error('boom');
      }),
      setItem: vi.fn(() => {
        throw new Error('boom');
      })
    };
    const logger = createLogger();

    expect(() => {
      // eslint-disable-next-line no-new
      new BankConnectionService({ storage: faultyStorage, logger });
    }).not.toThrow();

    expect(logger.error).toHaveBeenCalled();
  });
});
