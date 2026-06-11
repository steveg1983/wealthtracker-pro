import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubEventPii } from '../sentry';

const ev = (partial: Partial<ErrorEvent>): ErrorEvent => partial as ErrorEvent;

describe('scrubEventPii — Sentry PII minimization', () => {
  it('redacts PII keys in request.data, including nested', () => {
    const event = ev({
      request: {
        data: {
          email: 'a@b.com',
          password: 'hunter2',
          description: 'Tesco groceries', // not PII — kept
          nested: { sortCode: '12-34-56', accountNumber: '12345678', amount: 50 }
        }
      }
    });
    scrubEventPii(event);
    const data = event.request!.data as Record<string, unknown>;
    expect(data.email).toBe('[redacted]');
    expect(data.password).toBe('[redacted]');
    expect(data.description).toBe('Tesco groceries');
    const nested = data.nested as Record<string, unknown>;
    expect(nested.sortCode).toBe('[redacted]');
    expect(nested.accountNumber).toBe('[redacted]');
    expect(nested.amount).toBe(50);
  });

  it('drops query strings and cookies entirely', () => {
    const event = ev({
      request: { query_string: 'email=a@b.com&token=abc', cookies: { session: 'xyz' } }
    });
    scrubEventPii(event);
    expect(event.request!.query_string).toBe('[redacted]');
    expect(event.request!.cookies).toBeUndefined();
  });

  it('scrubs breadcrumb data', () => {
    const event = ev({
      breadcrumbs: [
        { timestamp: 0, data: { firstName: 'Jane', clicked: 'save-button' } }
      ]
    });
    scrubEventPii(event);
    const data = event.breadcrumbs![0].data as Record<string, unknown>;
    expect(data.firstName).toBe('[redacted]');
    expect(data.clicked).toBe('save-button');
  });

  it('scrubs extra context (component state, etc.)', () => {
    const event = ev({ extra: { userEmail: 'a@b.com', count: 3 } });
    scrubEventPii(event);
    expect((event.extra as Record<string, unknown>).userEmail).toBe('[redacted]');
    expect((event.extra as Record<string, unknown>).count).toBe(3);
  });

  it('is safe on an empty event', () => {
    const event = ev({});
    expect(() => scrubEventPii(event)).not.toThrow();
  });

  it('does not recurse infinitely on deep structures', () => {
    let deep: Record<string, unknown> = { value: 1 };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    const event = ev({ extra: { deep } });
    expect(() => scrubEventPii(event)).not.toThrow();
  });
});
