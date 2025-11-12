import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ThemeSchedule } from '../themeSchedulingService';
import { ThemeSchedulingService } from './themeSchedulingService';

type StorageWithData = Storage & { data: Map<string, string> };

const createMemoryStorage = (): StorageWithData => {
  const data = new Map<string, string>();
  const storage: Partial<Storage> & { data: Map<string, string> } = {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
    clear: vi.fn(() => data.clear()),
    key: vi.fn((index: number) => Array.from(data.keys())[index] ?? null)
  };

  Object.defineProperty(storage, 'length', {
    get: () => data.size
  });

  return storage as StorageWithData;
};

const createClassListMock = () => {
  let hasDark = false;
  return {
    add: vi.fn(() => {
      hasDark = true;
    }),
    remove: vi.fn(() => {
      hasDark = false;
    }),
    contains: vi.fn(() => hasDark),
    toggle: vi.fn()
  } as unknown as DOMTokenList;
};

const createTimerHarness = () => {
  const callbacks: Array<() => void> = [];
  const intervalHandle = { id: Symbol('interval') } as unknown as ReturnType<typeof setInterval>;
  const setIntervalFn = vi.fn<typeof setInterval>((handler) => {
    callbacks.push(handler as () => void);
    return intervalHandle;
  });
  const clearIntervalFn = vi.fn<typeof clearInterval>();

  return {
    callbacks,
    intervalHandle,
    setIntervalFn,
    clearIntervalFn
  };
};

const createService = () => {
  const localStorage = createMemoryStorage();
  const classList = createClassListMock();
  const documentRef = {
    documentElement: {
      classList
    }
  } as unknown as Document;
  const timers = createTimerHarness();

  let currentTime = new Date('2024-06-15T12:00:00Z');
  const service = new ThemeSchedulingService({
    localStorage,
    documentRef,
    setIntervalFn: timers.setIntervalFn,
    clearIntervalFn: timers.clearIntervalFn,
    dateFactory: () => new Date(currentTime)
  });

  const setCurrentTime = (date: Date) => {
    currentTime = date;
  };

  return { service, localStorage, classList, timers, setCurrentTime };
};

describe('ThemeSchedulingService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes defaults and schedules interval checks', () => {
    const { service, timers } = createService();
    expect(service.getPresets().length).toBeGreaterThan(0);
    expect(service.getSchedules().length).toBeGreaterThan(0);
    expect(timers.setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60000);
    service.cleanup();
  });

  it('creates and persists schedules', () => {
    const { service, localStorage } = createService();
    const schedule: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'> = {
      name: 'Custom',
      isActive: false,
      scheduleType: 'time-based',
      lightModeStart: '07:00',
      darkModeStart: '19:00',
      activeDays: [1, 2, 3, 4, 5]
    };

    const created = service.createSchedule(schedule);
    expect(created.name).toBe('Custom');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme-schedules', expect.any(String));
    service.cleanup();
  });

  it('updates schedules and refreshes timestamps', () => {
    const { service } = createService();
    const schedule = service.createSchedule({
      name: 'Update Me',
      isActive: false,
      scheduleType: 'manual'
    });

    const originalUpdated = schedule.lastUpdated.getTime();
    const updated = service.updateSchedule(schedule.id, { name: 'Updated Name' });
    expect(updated?.name).toBe('Updated Name');
    expect(updated?.lastUpdated.getTime()).toBeGreaterThanOrEqual(originalUpdated);
    service.cleanup();
  });

  it('applies dark theme when schedule dictates', () => {
    const { service, classList, setCurrentTime } = createService();
    const schedule = service.createSchedule({
      name: 'Night Mode',
      isActive: false,
      scheduleType: 'time-based',
      lightModeStart: '10:00',
      darkModeStart: '02:00'
    });
    service.activateSchedule(schedule.id);

    setCurrentTime(new Date('2024-06-15T05:00:00Z')); // Between darkStart and lightStart
    service.applyScheduleNow();

    expect(classList.add).toHaveBeenCalledWith('dark');
    service.cleanup();
  });

  it('computes next theme change for time-based schedules', () => {
    const { service, setCurrentTime } = createService();
    const schedule = service.createSchedule({
      name: 'Office',
      isActive: false,
      scheduleType: 'time-based',
      lightModeStart: '09:00',
      darkModeStart: '17:00'
    });
    service.activateSchedule(schedule.id);

    setCurrentTime(new Date('2024-06-15T10:00:00Z')); // During light period
    const nextChange = service.getNextThemeChange();

    expect(nextChange).toEqual({ time: '17:00', theme: 'dark' });
    service.cleanup();
  });
});
