import { describe, it, expect, beforeEach, vi } from 'vitest';

import { analyticsEngine } from '../analyticsEngine';
import {
  registerAnalyticsForwarder,
  getAnalyticsBuffer,
  clearAnalyticsBuffer,
  registerAnalyticsNetworkForwarder,
  __analyticsBridgeTestUtils,
} from '../analyticsBridge';
import { logger } from '../loggingService';

describe('analyticsBridge', () => {
  beforeEach(() => {
    clearAnalyticsBuffer();
    vi.restoreAllMocks();
    __analyticsBridgeTestUtils.offlineQueue.length = 0;
    window.localStorage.removeItem('analytics_offline_queue_v1');
  });

  it('logs events through the default forwarder', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    analyticsEngine.track('conflict_detected', { entity: 'goal' });

    expect(infoSpy).toHaveBeenCalledWith(
      'Analytics event',
      expect.objectContaining({
        eventName: 'conflict_detected',
        payload: { entity: 'goal' },
      }),
      'AnalyticsBridge',
    );
  });

  it('allows registering custom forwarders', () => {
    const forwarder = vi.fn();
    const unregister = registerAnalyticsForwarder(forwarder);

    analyticsEngine.track('conflict_resolved_manual', { entity: 'account' });

    expect(forwarder).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'conflict_resolved_manual',
        payload: { entity: 'account' },
      }),
    );

    unregister();
    forwarder.mockClear();

    analyticsEngine.track('conflict_resolved_manual', { entity: 'account' });
    expect(forwarder).not.toHaveBeenCalled();
  });

  it('maintains a bounded in-memory buffer', () => {
    const MAX = 120;
    for (let index = 0; index < MAX; index += 1) {
      analyticsEngine.track(`event-${index}`, { index });
    }

    const buffer = getAnalyticsBuffer();
    expect(buffer).toHaveLength(100);
    expect(buffer[0]?.eventName).toBe('event-20');
    expect(buffer[buffer.length - 1]?.eventName).toBe('event-119');
  });

  it('exposes internal handler for tests', () => {
    const detail = { eventName: 'test-event', payload: { foo: 'bar' } };
    const event = new CustomEvent('analytics-track', { detail });

    __analyticsBridgeTestUtils.handleAnalyticsEvent(event);

    const buffer = getAnalyticsBuffer();
    expect(buffer[0]).toEqual(
      expect.objectContaining({
        eventName: 'test-event',
        payload: { foo: 'bar' },
      }),
    );

    expect((window as typeof window & { __analyticsEvents__?: unknown }).__analyticsEvents__).toStrictEqual(buffer);
  });

  it('queues events offline and flushes when back online', async () => {
    const originalSendBeacon = navigator.sendBeacon;
    const originalOnline = navigator.onLine;

    const sendBeaconMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
    });

    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    const unregister = registerAnalyticsNetworkForwarder({ endpoint: '/collect' });

    analyticsEngine.track('offline_event', { foo: 'bar' });
    expect(__analyticsBridgeTestUtils.offlineQueue.length).toBe(1);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    window.dispatchEvent(new Event('online'));

    expect(__analyticsBridgeTestUtils.offlineQueue.length).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/collect',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(sendBeaconMock).toHaveBeenCalled();

    unregister();

    if (originalSendBeacon !== undefined) {
      Object.defineProperty(window.navigator, 'sendBeacon', {
        value: originalSendBeacon,
        configurable: true,
      });
    } else {
      delete (window.navigator as { sendBeacon?: unknown }).sendBeacon;
    }

    Object.defineProperty(window.navigator, 'onLine', {
      value: originalOnline,
      configurable: true,
    });

    globalThis.fetch = originalFetch;
  });
});
