import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledReportService, type ScheduledReportServiceOptions, type ScheduledCustomReport } from '../scheduledReportService';

type StorageInstance = NonNullable<ScheduledReportServiceOptions['storage']>;

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

const baseReport = (): ScheduledCustomReport => ({
  id: 'r-1',
  customReportId: 'cr-1',
  reportName: 'Weekly Summary',
  frequency: 'weekly',
  dayOfWeek: 5,
  time: '09:00',
  deliveryFormat: 'pdf',
  nextRun: new Date(),
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

const createService = (overrides: ScheduledReportServiceOptions = {}) => {
  const storage = (overrides.storage ?? createStorageMock()) as StorageInstance;
  const intervalHandle = { id: Symbol('interval') } as unknown as ReturnType<typeof setInterval>;
  const setIntervalFn =
    overrides.setIntervalFn ??
    vi.fn<typeof setInterval>(() => intervalHandle);
  const clearIntervalFn =
    overrides.clearIntervalFn ?? vi.fn<typeof clearInterval>();
  const now = overrides.now ?? vi.fn(() => new Date('2024-01-01T09:00:00Z'));

  const service = new ScheduledReportService({
    storage,
    setIntervalFn,
    clearIntervalFn,
    now
  });

  return { service, storage, setIntervalFn, clearIntervalFn, intervalHandle, now };
};

describe('ScheduledReportService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes interval scheduling and triggers an immediate check', () => {
    const { service, setIntervalFn } = createService();
    const checkSpy = vi
      .spyOn(service as unknown as { checkAndRunDueReports: () => Promise<void> }, 'checkAndRunDueReports')
      .mockResolvedValue();

    service.initialize();

    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(checkSpy).toHaveBeenCalledTimes(1);

    service.destroy();
  });

  it('calculates next weekly run using the injected clock', () => {
    const now = vi.fn(() => new Date('2024-01-01T09:00:00Z')); // Tuesday
    const { service } = createService({ now });
    const report = { ...baseReport(), dayOfWeek: 3, time: '10:30' }; // Wednesday

    const nextRun = service.calculateNextRun(report);

    expect(nextRun.getUTCDay()).toBe(3);
    expect(nextRun.getUTCHours()).toBe(10);
    expect(nextRun.getUTCMinutes()).toBe(30);
    expect(nextRun.getUTCDate()).toBe(3); // Jan 3rd 2024 is Wednesday
  });

  it('runs only due reports when checking schedule', async () => {
    const { service, storage } = createService();
    const now = new Date('2024-01-05T09:00:00Z');
    (service as any).now = () => now;
    const dueReport = {
      ...baseReport(),
      id: 'due',
      nextRun: new Date('2024-01-05T08:00:00Z'),
      enabled: true
    };
    const futureReport = {
      ...baseReport(),
      id: 'future',
      nextRun: new Date('2024-01-06T08:00:00Z'),
      enabled: true
    };
    storage.setItem(
      'money_management_scheduled_custom_reports',
      JSON.stringify([dueReport, futureReport])
    );
    const runSpy = vi
      .spyOn(service, 'runScheduledReport')
      .mockResolvedValue();

    await (service as any).checkAndRunDueReports();

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'due' }));
  });

  it('clears interval handles on destroy', () => {
    const { service, setIntervalFn, clearIntervalFn, intervalHandle } = createService();
    vi.spyOn(service as any, 'checkAndRunDueReports').mockResolvedValue();

    service.initialize();
    expect(setIntervalFn).toHaveBeenCalledTimes(1);

    service.destroy();
    expect(clearIntervalFn).toHaveBeenCalledWith(intervalHandle);
  });
});
