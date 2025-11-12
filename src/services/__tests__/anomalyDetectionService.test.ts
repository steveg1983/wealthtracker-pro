import { describe, it, expect, vi } from 'vitest';
import { AnomalyDetectionService, type Anomaly } from '../anomalyDetectionService';
import type { Transaction, Category } from '../../types';

const createStorage = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    })
  };
};

const fixedNow = Date.UTC(2025, 0, 1);

const buildService = (overrides: { storage?: ReturnType<typeof createStorage> } = {}) => {
  const storage = overrides.storage ?? createStorage();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const service = new AnomalyDetectionService({
    storage,
    logger,
    now: () => fixedNow
  });
  return { service, storage, logger };
};

const sampleCategory: Category = {
  id: 'cat-groceries',
  name: 'Groceries',
  type: 'expense',
  level: 'type'
};

const buildTransactions = (): Transaction[] => {
  const baseDate = new Date(fixedNow);
  baseDate.setMonth(baseDate.getMonth() - 1);
  return Array.from({ length: 6 }).map((_, index) => ({
    id: `txn-${index}`,
    date: new Date(baseDate.getTime() - index * 24 * 60 * 60 * 1000),
    amount: index === 5 ? -5000 : -50,
    description: index === 5 ? 'Huge grocery stock-up' : 'Grocery store',
    category: sampleCategory.id,
    accountId: 'account-1',
    type: 'expense'
  }));
};

describe('AnomalyDetectionService (deterministic)', () => {
  it('hydrates configuration from injected storage as a Set', () => {
    const storage = createStorage({
      money_management_anomaly_config: JSON.stringify({
        enabledTypes: ['unusual_amount'],
        sensitivityLevel: 'high',
        lookbackMonths: 2,
        minTransactionHistory: 5,
        autoAlert: false
      })
    });
    const { service } = buildService({ storage });

    const config = service.getConfig();
    expect(config.enabledTypes instanceof Set).toBe(true);
    expect(config.enabledTypes.has('unusual_amount')).toBe(true);
  });

  it('persists config updates and filters anomalies deterministically', async () => {
    const { service, storage } = buildService();
    service.saveConfig({
      minTransactionHistory: 3,
      enabledTypes: new Set(['unusual_amount']),
      sensitivityLevel: 'high'
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      'money_management_anomaly_config',
      expect.stringContaining('"unusual_amount"')
    );

    const anomalies = await service.detectAnomalies(buildTransactions(), [sampleCategory]);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].detectedAt.getTime()).toBe(fixedNow);
  });

  it('saves and dismisses anomalies via injected storage', () => {
    const storage = createStorage();
    storage.setItem(
      'money_management_detected_anomalies',
      JSON.stringify([
        {
          id: 'a-1',
          type: 'unusual_amount',
          severity: 'high',
          title: 'Large spend',
          description: 'Large amount',
          detectedAt: new Date(fixedNow).toISOString()
        },
        {
          id: 'a-2',
          type: 'new_merchant',
          severity: 'low',
          title: 'New merchant',
          description: 'First time',
          detectedAt: new Date(fixedNow).toISOString()
        }
      ])
    );
    const { service } = buildService({ storage });

    const anomaly: Anomaly = {
      id: 'a-3',
      type: 'duplicate_charge',
      severity: 'medium',
      title: 'Duplicate',
      description: 'Duplicate charge detected',
      detectedAt: new Date(fixedNow)
    };
    service.saveAnomalies([anomaly]);
    expect(storage.setItem).toHaveBeenCalledWith(
      'money_management_detected_anomalies',
      expect.stringContaining('"a-3"')
    );

    // Re-seed storage with dismissable anomaly so dismiss flow has data
    storage.setItem(
      'money_management_detected_anomalies',
      JSON.stringify([
        {
          id: 'a-1',
          type: 'unusual_amount',
          severity: 'high',
          title: 'Large spend',
          description: 'Large amount',
          detectedAt: new Date(fixedNow).toISOString()
        }
      ])
    );

    service.dismissAnomaly('a-1');
    const latestCall = storage.setItem.mock.calls.pop();
    expect(latestCall?.[1]).toContain('"dismissed":true');
  });
});
