import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomaticBackupService, type AutomaticBackupServiceOptions } from '../automaticBackupService';

type StorageInstance = NonNullable<AutomaticBackupServiceOptions['storage']>;

interface StorageMock extends StorageInstance {
  data: Map<string, string>;
}

const createStorageMock = (): StorageMock => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    })
  };
};

const seedConfig = (storage: StorageInstance, overrides: Record<string, unknown> = {}) => {
  const baseConfig = {
    enabled: true,
    frequency: 'daily',
    time: '00:30',
    format: 'json',
    encryptionEnabled: false,
    retentionDays: 7,
    includeAttachments: false
  };
  storage.setItem?.('money_management_backup_config', JSON.stringify({ ...baseConfig, ...overrides }));
  storage.setItem?.('money_management_backup_history', JSON.stringify([]));
};

const createService = (overrides: AutomaticBackupServiceOptions = {}) => {
  const storage = (overrides.storage ?? createStorageMock()) as StorageInstance;
  const intervalHandle = { id: Symbol('interval') } as unknown as ReturnType<typeof setInterval>;
  const setIntervalFn =
    overrides.setIntervalFn ??
    vi.fn<typeof setInterval>(() => intervalHandle);
  const clearIntervalFn =
    overrides.clearIntervalFn ?? vi.fn<typeof clearInterval>();
  const dateNow = overrides.dateNow ?? vi.fn(() => new Date('2024-01-01T12:00:00Z').getTime());
  const dateFactory = overrides.dateFactory ?? (() => new Date(dateNow()));

  const service = new AutomaticBackupService({
    storage,
    setIntervalFn,
    clearIntervalFn,
    dateNow,
    dateFactory,
    navigatorRef: overrides.navigatorRef ?? null,
    windowRef: overrides.windowRef ?? null,
    permissionsQuery: overrides.permissionsQuery,
    notificationFactory: overrides.notificationFactory
  });

  return { service, storage, setIntervalFn, clearIntervalFn, intervalHandle, dateNow };
};

describe('AutomaticBackupService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips scheduling when backups are disabled', async () => {
    const { service, storage, setIntervalFn } = createService();
    storage.setItem?.(
      'money_management_backup_config',
      JSON.stringify({ enabled: false, frequency: 'daily', time: '01:00', format: 'json', encryptionEnabled: false, retentionDays: 7, includeAttachments: false })
    );

    await service.initializeBackups();

    expect(setIntervalFn).not.toHaveBeenCalled();
    service.destroy();
  });

  it('runs fallback scheduler and schedules interval when due', async () => {
    const { service, storage, setIntervalFn } = createService();
    seedConfig(storage);
    const performSpy = vi
      .spyOn(service, 'performBackup')
      .mockResolvedValue();

    await service.initializeBackups();

    expect(performSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);

    service.destroy();
  });

  it('updates backup config and re-initializes scheduling', () => {
    const { service, storage } = createService();
    const initSpy = vi.spyOn(service, 'initializeBackups').mockResolvedValue(undefined);

    service.updateBackupConfig({ enabled: true, frequency: 'weekly' });

    expect(storage.setItem).toHaveBeenCalledWith(
      'money_management_backup_config',
      expect.stringContaining('"frequency":"weekly"')
    );
    expect(initSpy).toHaveBeenCalled();
  });
});
