import { logger } from './loggingService';

type AnalyticsPayload = Record<string, unknown>;

export interface AnalyticsEvent {
  eventName: string;
  payload: AnalyticsPayload;
  timestamp: string;
}

type AnalyticsForwarder = (event: AnalyticsEvent) => void;

const MAX_BUFFER_SIZE = 100;
const buffer: AnalyticsEvent[] = [];
const forwarders = new Set<AnalyticsForwarder>();

const OFFLINE_QUEUE_KEY = 'analytics_offline_queue_v1';
const MAX_OFFLINE_QUEUE_SIZE = 500;
const offlineQueue: AnalyticsEvent[] = [];

const loadOfflineQueue = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    if (Array.isArray(parsed)) {
      offlineQueue.push(...parsed);
    }
  } catch {
    // Ignore parse failures
  }
};

const persistOfflineQueue = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (offlineQueue.length === 0) {
      window.localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    }
  } catch {
    // Ignore persistence failures
  }
};

const enqueueOffline = (event: AnalyticsEvent): void => {
  offlineQueue.push(event);
  if (offlineQueue.length > MAX_OFFLINE_QUEUE_SIZE) {
    offlineQueue.shift();
  }
  persistOfflineQueue();
};

const pushToBuffer = (event: AnalyticsEvent): void => {
  buffer.push(event);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift();
  }

  if (typeof window !== 'undefined') {
    (window as typeof window & { __analyticsEvents__?: AnalyticsEvent[] }).__analyticsEvents__ = buffer;
  }
};

const defaultForwarder: AnalyticsForwarder = (event) => {
  logger.info('Analytics event', event, 'AnalyticsBridge');
};

forwarders.add(defaultForwarder);

let listenerRegistered = false;

const handleAnalyticsEvent = (event: Event): void => {
  const detail = (event as CustomEvent<{ eventName: string; payload: AnalyticsPayload }>).detail;
  if (!detail || typeof detail.eventName !== 'string') {
    return;
  }

  const analyticsEvent: AnalyticsEvent = {
    eventName: detail.eventName,
    payload: detail.payload ?? {},
    timestamp: new Date().toISOString(),
  };

  pushToBuffer(analyticsEvent);

  forwarders.forEach((forwarder) => {
    try {
      forwarder(analyticsEvent);
    } catch (error) {
      logger.error('Analytics forwarder threw', error, 'AnalyticsBridge');
    }
  });
};

const registerListener = (): void => {
  if (listenerRegistered || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('analytics-track', handleAnalyticsEvent as EventListener);
  listenerRegistered = true;
};

registerListener();
loadOfflineQueue();

export const registerAnalyticsForwarder = (forwarder: AnalyticsForwarder): (() => void) => {
  forwarders.add(forwarder);
  return () => {
    forwarders.delete(forwarder);
  };
};

interface NetworkForwarderConfig {
  endpoint: string;
  headers?: Record<string, string>;
  includeCredentials?: boolean;
}

const sendEventWithBeacon = (endpoint: string, event: AnalyticsEvent): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  try {
    const payload = JSON.stringify(event);
    const blob = new Blob([payload], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
};

const sendEventWithFetch = (endpoint: string, event: AnalyticsEvent, headers: Record<string, string>, includeCredentials: boolean): void => {
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(event),
      keepalive: true,
      credentials: includeCredentials ? 'include' : 'omit',
    }).catch(() => {
      enqueueOffline(event);
    });
  } catch {
    enqueueOffline(event);
  }
};

export const registerAnalyticsNetworkForwarder = (config: NetworkForwarderConfig | null | undefined): (() => void) => {
  if (!config || !config.endpoint) {
    return () => undefined;
  }

  const { endpoint, headers = {}, includeCredentials = false } = config;

  const forwarder: AnalyticsForwarder = (event) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueOffline(event);
      return;
    }

    const beaconSent = sendEventWithBeacon(endpoint, event);
    if (beaconSent) {
      return;
    }

    sendEventWithFetch(endpoint, event, headers, includeCredentials);
  };

  const flushOfflineQueue = (): void => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    if (offlineQueue.length === 0) {
      return;
    }

    const pending = offlineQueue.splice(0, offlineQueue.length);
    persistOfflineQueue();
    pending.forEach(forwarder);
  };

  const unsubscribe = registerAnalyticsForwarder(forwarder);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', flushOfflineQueue);
  }

  flushOfflineQueue();

  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', flushOfflineQueue);
    }
  };
};

export const getAnalyticsBuffer = (): AnalyticsEvent[] => [...buffer];

export const clearAnalyticsBuffer = (): void => {
  buffer.length = 0;
};

export const __analyticsBridgeTestUtils = {
  handleAnalyticsEvent,
  isListenerRegistered: () => listenerRegistered,
  loadOfflineQueue,
  persistOfflineQueue,
  enqueueOffline,
  offlineQueue,
};
