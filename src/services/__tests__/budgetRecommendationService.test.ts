import { describe, it, expect, vi } from 'vitest';
import { BudgetRecommendationService } from '../budgetRecommendationService';
import type { Transaction, Category, Budget } from '../../types';

const fixedNow = Date.UTC(2025, 0, 15);

const createStorage = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    })
  };
};

const buildService = (overrides: { storage?: ReturnType<typeof createStorage> } = {}) => {
  const storage = overrides.storage ?? createStorage();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const service = new BudgetRecommendationService({
    storage,
    logger,
    now: () => fixedNow
  });
  return { service, storage, logger };
};

const category: Category = {
  id: 'cat-groceries',
  name: 'Groceries',
  type: 'expense',
  level: 'type'
};

const createTransaction = (date: string, amount: number): Transaction => ({
  id: `txn-${date}`,
  date: new Date(date),
  amount,
  description: 'Purchase',
  category: category.id,
  accountId: 'acc-1',
  type: 'expense'
});

const sampleBudget: Budget = {
  id: 'bud-1',
  categoryId: category.id,
  amount: 250,
  period: 'monthly',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-12-01T00:00:00Z'),
  spent: 0,
  name: 'Groceries'
};

describe('BudgetRecommendationService (deterministic)', () => {
  it('hydrates config from injected storage', () => {
    const storage = createStorage({
      budget_recommendation_config: JSON.stringify({
        lookbackMonths: 3,
        includeSeasonality: false,
        aggressiveness: 'conservative',
        minConfidence: 0.8,
        considerGoals: false
      })
    });
    const { service } = buildService({ storage });

    const config = service.getConfig();
    expect(config.lookbackMonths).toBe(3);
    expect(config.aggressiveness).toBe('conservative');
    expect(storage.getItem).toHaveBeenCalledWith('budget_recommendation_config');
  });

  it('persists merged config via injected storage', () => {
    const { service, storage } = buildService();
    service.saveConfig({ minConfidence: 0.9 });

    expect(storage.setItem).toHaveBeenCalledWith(
      'budget_recommendation_config',
      expect.stringContaining('"minConfidence":0.9')
    );
  });

  it('analyzes budgets deterministically using injected clock', () => {
    const { service } = buildService();
    const transactions: Transaction[] = [
      createTransaction('2024-12-10T00:00:00Z', -220),
      createTransaction('2024-11-10T00:00:00Z', -210),
      createTransaction('2024-10-10T00:00:00Z', -200)
    ];

    const analysis = service.analyzeBudgets(transactions, [category], [sampleBudget]);

    expect(analysis.recommendations.length).toBeGreaterThan(0);
    const [recommendation] = analysis.recommendations;
    expect(recommendation.categoryId).toBe(category.id);
    expect(recommendation.confidence).toBeGreaterThan(0.5);
    expect(analysis.totalCurrentBudget).toBe(sampleBudget.amount);
  });
});
