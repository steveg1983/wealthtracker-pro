import { describe, it, expect, vi } from 'vitest';
import { SecurityService, type SecurityServiceOptions } from '../securityService';

const createStorageMock = () => {
  const store = new Map<string, string>();
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

const createCryptoStub = () => {
  const getRandomValues = vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = (i + 13) % 255;
    }
    return array;
  });

  const subtle = {
    importKey: vi.fn(async () => ({} as CryptoKey)),
    deriveKey: vi.fn(async () => ({} as CryptoKey)),
    encrypt: vi.fn(async (_algo: Algorithm, _key: CryptoKey, data: ArrayBufferView) => data.buffer ?? data),
    decrypt: vi.fn(async (_algo: Algorithm, _key: CryptoKey, data: ArrayBufferView) => data.buffer ?? data)
  } as unknown as SubtleCrypto;

  return {
    crypto: {
      getRandomValues,
      subtle
    },
    getRandomValues,
    subtle
  };
};

const createCredentialsContainer = () => {
  const create = vi.fn(async () => ({
    rawId: new Uint8Array([1, 2, 3, 4]).buffer
  } as unknown as PublicKeyCredential));

  const get = vi.fn(async () => ({} as Credential));

  return {
    container: {
      create,
      get
    },
    create,
    get
  };
};

const createPublicKeyCredential = (available: boolean) => ({
  isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => available)
});

const buildService = (overrides: Partial<SecurityServiceOptions> = {}) => {
  const storage = overrides.storage ?? createStorageMock();
  const cryptoHarness = overrides.crypto ? null : createCryptoStub();
  const crypto = overrides.crypto ?? cryptoHarness?.crypto ?? null;
  const logger = createLogger();
  const navigator = overrides.navigator ?? { userAgent: 'test-agent', credentials: overrides.credentials ?? null };

  const service = new SecurityService({
    storage,
    crypto,
    navigator,
    credentials: overrides.credentials ?? navigator.credentials ?? null,
    publicKeyCredential: overrides.publicKeyCredential ?? null,
    location: overrides.location ?? { hostname: 'test.local' },
    now: overrides.now,
    logger
  });

  return {
    service,
    storage,
    logger,
    cryptoHarness
  };
};

describe('SecurityService', () => {
  it('returns default settings when storage is empty', () => {
    const { service } = buildService();
    expect(service.getSecuritySettings()).toMatchObject({
      twoFactorEnabled: false,
      biometricEnabled: false,
      readOnlyMode: false,
      encryptionEnabled: false,
      sessionTimeout: 30,
      failedAttempts: 0
    });
  });

  it('updates settings and records an audit log entry', () => {
    const { service, storage } = buildService();

    service.updateSecuritySettings({ twoFactorEnabled: true, sessionTimeout: 45 });

    expect(storage.setItem).toHaveBeenCalledWith(
      'security_settings',
      expect.stringContaining('"twoFactorEnabled":true')
    );
    const logs = service.getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'update',
      resourceType: 'settings'
    });
  });

  it('locks the account after repeated failures and unlocks after timeout', () => {
    let currentTime = 0;
    const thirtyMinutes = 30 * 60 * 1000;
    const { service } = buildService({ now: () => currentTime });

    for (let i = 0; i < 5; i += 1) {
      service.recordFailedAttempt();
    }
    expect(service.isAccountLocked()).toBe(true);

    currentTime += thirtyMinutes + 1000;
    expect(service.isAccountLocked()).toBe(false);
  });

  it('encrypts and decrypts data when encryption is enabled', async () => {
    const { service } = buildService();
    service.updateSecuritySettings({ encryptionEnabled: true });

    const encrypted = await service.encryptData('secret-data');
    expect(encrypted).not.toEqual('secret-data');

    const decrypted = await service.decryptData(encrypted);
    expect(decrypted).toEqual('secret-data');
  });

  it('reports biometric availability based on injected constructor', async () => {
    const unavailableService = buildService();
    expect(await unavailableService.service.isBiometricAvailable()).toBe(false);

    const availableCtor = createPublicKeyCredential(true);
    const availableService = buildService({ publicKeyCredential: availableCtor });
    await expect(availableService.service.isBiometricAvailable()).resolves.toBe(true);
  });

  it('saves biometric credentials when setup succeeds', async () => {
    const credentialsHarness = createCredentialsContainer();
    const cryptoHarness = createCryptoStub();
    const storage = createStorageMock();
    const publicKeyCtor = createPublicKeyCredential(true);

    const { service } = buildService({
      storage,
      credentials: credentialsHarness.container,
      crypto: cryptoHarness.crypto,
      publicKeyCredential: publicKeyCtor
    });

    const credential = await service.setupBiometric();
    expect(credential).not.toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      'biometric_credentials',
      expect.stringContaining('credentialId')
    );
  });
});
