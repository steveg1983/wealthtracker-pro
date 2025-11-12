import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataIntelligenceService } from '../dataIntelligenceService';

const MERCHANTS_KEY = 'data-intelligence-merchants';
const SUBSCRIPTIONS_KEY = 'data-intelligence-subscriptions';
const PATTERNS_KEY = 'data-intelligence-patterns';
const SMART_CATEGORIES_KEY = 'data-intelligence-smart-categories';
const INSIGHTS_KEY = 'data-intelligence-insights';

const createStorage = (initial: Record<string, unknown> = {}) => {
  const store = new Map<string, string>();
  Object.entries(initial).forEach(([key, value]) => {
    store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    })
  };
};

describe('DataIntelligenceService (deterministic)', () => {
  const logger = { warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    logger.warn.mockReset();
    logger.error.mockReset();
  });

  it('hydrates persisted collections from injected storage', () => {
    const fixedNow = new Date('2025-02-15T00:00:00.000Z').getTime();
    const storage = createStorage({
      [MERCHANTS_KEY]: [
        {
          id: 'merchant-1',
          name: 'Stored Merchant',
          cleanName: 'Stored Merchant',
          category: 'Services',
          industry: 'Testing',
          frequency: 'monthly',
          tags: [],
          confidence: 0.9,
          createdAt: '2025-01-01T00:00:00.000Z',
          lastUpdated: '2025-01-02T00:00:00.000Z'
        }
      ],
      [SUBSCRIPTIONS_KEY]: [
        {
          id: 'sub-1',
          merchantId: 'merchant-1',
          merchantName: 'Stored Merchant',
          amount: 25,
          frequency: 'monthly',
          nextPaymentDate: '2025-02-20T00:00:00.000Z',
          category: 'Services',
          status: 'active',
          startDate: '2024-12-01T00:00:00.000Z',
          renewalType: 'auto',
          paymentMethod: 'card',
          transactionIds: [],
          createdAt: '2024-12-01T00:00:00.000Z',
          lastUpdated: '2024-12-15T00:00:00.000Z'
        }
      ],
      [PATTERNS_KEY]: [
        {
          id: 'pattern-1',
          patternType: 'recurring',
          category: 'Services',
          frequency: 'monthly',
          amount: 25,
          variance: 0.5,
          confidence: 0.8,
          description: 'Sample',
          transactions: [],
          detectedAt: '2024-12-01T00:00:00.000Z',
          isActive: true
        }
      ],
      [SMART_CATEGORIES_KEY]: [
        {
          id: 'smart-1',
          name: 'Stored Category',
          confidence: 0.9,
          rules: [],
          merchantPatterns: [],
          descriptionPatterns: [],
          amountRanges: [],
          createdAt: '2024-12-01T00:00:00.000Z',
          lastTrained: '2024-12-10T00:00:00.000Z'
        }
      ],
      [INSIGHTS_KEY]: [
        {
          id: 'insight-1',
          type: 'subscription_alert',
          title: 'Alert',
          description: 'Stored insight',
          severity: 'low',
          transactionIds: [],
          actionable: true,
          dismissed: false,
          createdAt: '2024-12-05T00:00:00.000Z'
        }
      ]
    });

    const service = new DataIntelligenceService({
      storage,
      logger,
      now: () => fixedNow
    });

    const snapshot = service.exportData();
    expect(snapshot.merchants[0].createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(snapshot.subscriptions[0].nextPaymentDate.toISOString()).toBe('2025-02-20T00:00:00.000Z');
    expect(snapshot.patterns[0].detectedAt.toISOString()).toBe('2024-12-01T00:00:00.000Z');
    expect(snapshot.insights[0].createdAt.toISOString()).toBe('2024-12-05T00:00:00.000Z');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('builds subscription renewal insights using the injected clock', () => {
    const baseTime = new Date('2025-04-01T00:00:00.000Z').getTime();
    const storage = createStorage({
      [MERCHANTS_KEY]: [],
      [SUBSCRIPTIONS_KEY]: [
        {
          id: 'sub-1',
          merchantId: 'merchant-1',
          merchantName: 'Testing SaaS',
          amount: 42,
          frequency: 'monthly',
          nextPaymentDate: '2025-04-05T00:00:00.000Z',
          category: 'Software',
          status: 'active',
          startDate: '2024-01-01T00:00:00.000Z',
          renewalType: 'auto',
          paymentMethod: 'card',
          transactionIds: ['t-1'],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastUpdated: '2024-02-01T00:00:00.000Z'
        }
      ],
      [PATTERNS_KEY]: [],
      [SMART_CATEGORIES_KEY]: [],
      [INSIGHTS_KEY]: []
    });

    const service = new DataIntelligenceService({
      storage,
      logger,
      now: () => baseTime
    });

    const insights = service.generateInsights([]);
    expect(insights).toHaveLength(1);
    expect(insights[0].description).toContain('in 4 days');
    expect(insights[0].createdAt.getTime()).toBe(baseTime);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('persists dismissals back to injected storage', () => {
    const storage = createStorage({
      [MERCHANTS_KEY]: [],
      [SUBSCRIPTIONS_KEY]: [],
      [PATTERNS_KEY]: [],
      [SMART_CATEGORIES_KEY]: [],
      [INSIGHTS_KEY]: [
        {
          id: 'insight-keep',
          type: 'subscription_alert',
          title: 'Keep',
          description: 'Keep me',
          severity: 'low',
          transactionIds: [],
          actionable: true,
          dismissed: false,
          createdAt: '2025-01-01T00:00:00.000Z'
        }
      ]
    });

    const service = new DataIntelligenceService({
      storage,
      logger,
      now: () => new Date('2025-01-10T00:00:00.000Z').getTime()
    });

    storage.setItem.mockClear();
    service.dismissInsight('insight-keep');

    const persistedCall = storage.setItem.mock.calls.find(
      ([key]) => key === INSIGHTS_KEY
    );
    expect(persistedCall).toBeDefined();
    const persistedInsights = JSON.parse(persistedCall![1]);
    expect(persistedInsights[0].dismissed).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
