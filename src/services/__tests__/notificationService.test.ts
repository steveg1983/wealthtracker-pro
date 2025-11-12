import { describe, it, expect, vi } from 'vitest';
import { NotificationService, type NotificationRule } from '../notificationService';

const createStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
};

const fixedNow = Date.UTC(2025, 0, 1);

const createService = (overrides: {
  storage?: ReturnType<typeof createStorage>;
  navigate?: ReturnType<typeof vi.fn>;
} = {}) => {
  const storage = overrides.storage ?? createStorage();
  const navigate = overrides.navigate ?? vi.fn();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const service = new NotificationService({
    storage,
    navigate,
    logger,
    now: () => fixedNow
  });
  return { service, storage, navigate, logger };
};

describe('NotificationService (deterministic)', () => {
  it('loads configs from injected storage', () => {
    const storage = createStorage();
    storage.setItem('notificationService_budgetConfig', JSON.stringify({ warningThreshold: 90 }));

    const { service } = createService({ storage });
    expect(service.getRules()).toBeDefined();
    expect(storage.getItem).toHaveBeenCalledWith('notificationService_budgetConfig');
  });

  it('persists config through injected storage', () => {
    const storage = createStorage();
    const { service } = createService({ storage });

    service['saveToStorage']('notificationService_goalConfig', { enableProgressReminders: false } as any);

    expect(storage.setItem).toHaveBeenCalledWith(
      'notificationService_goalConfig',
      JSON.stringify({ enableProgressReminders: false })
    );
  });

  it('converts persisted rule timestamps to Date objects', () => {
    const storage = createStorage();
    storage.setItem('notificationService_rules', JSON.stringify([
      {
        id: 'stored',
        name: 'Stored Rule',
        type: 'budget',
        enabled: true,
        conditions: [],
        actions: [],
        priority: 'low',
        cooldown: 0,
        created: '2024-01-01T00:00:00.000Z',
        lastTriggered: '2024-01-02T00:00:00.000Z'
      }
    ] satisfies Partial<NotificationRule>[]));

    const { service } = createService({ storage });
    const rule = service.getRules()[0];
    expect(rule.created).toBeInstanceOf(Date);
    expect(rule.lastTriggered).toBeInstanceOf(Date);
  });

  it('uses injected navigate handler for rule action buttons', () => {
    const navigate = vi.fn();
    const { service } = createService({ navigate });

    const rule: NotificationRule = {
      id: 'rule-test',
      name: 'Test',
      type: 'budget',
      enabled: true,
      conditions: [],
      actions: [
        {
          type: 'show_notification',
          config: {
            title: 'Check',
            message: 'Please review',
            actionButton: { label: 'Go', action: '/budget' }
          }
        }
      ],
      priority: 'low',
      cooldown: 0,
      created: new Date()
    };

    const notification = (service as any).createNotificationFromRule(rule, {});
    expect(notification?.timestamp.getTime()).toBe(fixedNow);
    notification?.action?.onClick?.();
    expect(navigate).toHaveBeenCalledWith('/budget');
  });

  it('generates deterministic ids and timestamps via injected clock when adding rules', () => {
    const { service } = createService();
    const newRule = service.addRule({
      name: 'Custom',
      type: 'budget',
      enabled: true,
      conditions: [],
      actions: [],
      priority: 'low',
      cooldown: 0
    });

    expect(newRule.id).toBe(`rule-${fixedNow}`);
    expect(newRule.created.getTime()).toBe(fixedNow);
  });
});
