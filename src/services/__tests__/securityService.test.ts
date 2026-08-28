/**
 * What is left of SecurityService after 28 August 2026: settings, the audit
 * log, session timeout and account lockout. Everything else it used to expose
 * — two-factor, biometrics, encryptData/decryptData — was removed, because
 * the August ruling recorded in `SecuritySettings.tsx` had already found it
 * dead and taken away the toggles, leaving the implementations behind.
 *
 * The harness shrank with it. It used to inject a WebAuthn credentials
 * container, a PublicKeyCredential constructor, a location and a full
 * SubtleCrypto, because the deleted methods needed all four. What remains
 * needs storage, a clock and `getRandomValues`.
 */
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

  return { crypto: { getRandomValues }, getRandomValues };
};

const buildService = (overrides: Partial<SecurityServiceOptions> = {}) => {
  const storage = overrides.storage ?? createStorageMock();
  const cryptoHarness = overrides.crypto ? null : createCryptoStub();
  const logger = createLogger();

  const service = new SecurityService({
    storage,
    crypto: overrides.crypto ?? cryptoHarness?.crypto ?? null,
    navigator: overrides.navigator ?? { userAgent: 'test-agent' },
    now: overrides.now,
    logger
  });

  return { service, storage, logger, cryptoHarness };
};

describe('SecurityService', () => {
  it('returns default settings when storage is empty', () => {
    const { service } = buildService();
    expect(service.getSecuritySettings()).toMatchObject({
      sessionTimeout: 30,
      failedAttempts: 0
    });
  });

  it('carries no setting for a protection it does not provide', () => {
    // The August ruling's point, kept as a test rather than a memory: a
    // settings object that reports `encryptionEnabled` while encrypting
    // nothing is the same false statement as a toggle that does nothing.
    const settings = service_settings();

    expect(settings).not.toHaveProperty('encryptionEnabled');
    expect(settings).not.toHaveProperty('twoFactorEnabled');
    expect(settings).not.toHaveProperty('biometricEnabled');
    expect(settings).not.toHaveProperty('readOnlyMode');
  });

  it('updates settings and records an audit log entry', () => {
    const { service, storage } = buildService();

    service.updateSecuritySettings({ sessionTimeout: 45 });

    expect(storage.setItem).toHaveBeenCalledWith(
      'security_settings',
      expect.stringContaining('"sessionTimeout":45')
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
});

function service_settings(): Record<string, unknown> {
  const storage = createStorageMock();
  const service = new SecurityService({
    storage,
    crypto: createCryptoStub().crypto,
    navigator: { userAgent: 'test-agent' },
    logger: createLogger()
  });
  return service.getSecuritySettings() as unknown as Record<string, unknown>;
}
