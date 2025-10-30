import type {
  RealtimeChannel,
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import {
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  REALTIME_SUBSCRIBE_STATES,
} from '@supabase/supabase-js';
import { ensureSupabaseClient, isSupabaseStub, type SupabaseDatabase } from './supabase';

type ListenEvent = `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`;

const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

const noop = (): void => {
  // Intentionally blank
};

const consoleLogger = (() => {
  if (typeof console === 'undefined') {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    debug: (...args: unknown[]) => {
      if (typeof console.debug === 'function') {
        console.debug(...args);
      }
    },
    info: (...args: unknown[]) => {
      if (typeof console.info === 'function') {
        console.info(...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (typeof console.warn === 'function') {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]) => {
      if (typeof console.error === 'function') {
        console.error(...args);
      }
    },
  };
})();

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeEvent<T = unknown> {
  eventType: RealtimeEventType;
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
}

export interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  connectionCount: number;
}

export type RealtimeCallback<T = unknown> = (event: RealtimeEvent<T>) => void;
export type ConnectionCallback = (state: ConnectionState) => void;

export interface RealtimeLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

export interface RealtimeServiceOptions {
  logger?: RealtimeLogger;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

type AnyRow = unknown;

export interface RealtimeSubscriptionConfig<T extends AnyRow = AnyRow> {
  key: string;
  channel: string;
  schema?: string;
  table?: string;
  filter?: string;
  event?: ListenEvent;
  onEvent: (event: RealtimeEvent<T>) => void;
  mapEvent?: (payload: PostgresPayload) => RealtimeEvent<T>;
}

type PostgresPayload = RealtimePostgresChangesPayload<Record<string, any>>;

interface StoredSubscription {
  channel: RealtimeChannel;
  config: RealtimeSubscriptionConfig;
}

export interface RealtimeService {
  initialize(): void;
  subscribe<T extends AnyRow>(config: RealtimeSubscriptionConfig<T>): Promise<string | null>;
  unsubscribe(key: string): void;
  unsubscribeAll(): void;
  onConnectionChange(callback: ConnectionCallback): () => void;
  getConnectionState(): ConnectionState;
  getSubscriptionCount(): number;
  forceReconnect(): void;
  destroy(): void;
}

function defaultEventMapper(payload: PostgresPayload): RealtimeEvent<AnyRow> {
  return {
    eventType: payload.eventType as RealtimeEventType,
    new: (payload.new ?? null) as AnyRow | null,
    old: (payload.old ?? null) as AnyRow | null,
    table: payload.table,
    schema: payload.schema,
  };
}

async function resolveClient(
  logger: RealtimeLogger,
  hasLoggedStubWarning: { value: boolean },
): Promise<SupabaseDatabase | null> {
  const client = await ensureSupabaseClient();
  if (isSupabaseStub(client)) {
    if (!hasLoggedStubWarning.value) {
      logger.warn('[RealtimeService] Supabase client unavailable (stub mode); realtime features disabled.');
      hasLoggedStubWarning.value = true;
    }
    return null;
  }

  hasLoggedStubWarning.value = false;
  return client;
}

export function createRealtimeService(options: RealtimeServiceOptions = {}): RealtimeService {
  const logger: RealtimeLogger = {
    debug: options.logger?.debug?.bind(options.logger) ?? consoleLogger.debug,
    info: options.logger?.info?.bind(options.logger) ?? consoleLogger.info,
    warn: options.logger?.warn?.bind(options.logger) ?? consoleLogger.warn,
    error: options.logger?.error?.bind(options.logger) ?? consoleLogger.error,
  };

  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;

  const subscriptions = new Map<string, StoredSubscription>();
  const connectionCallbacks = new Set<ConnectionCallback>();
  const hasLoggedStubWarning = { value: false };

  let connectionState: ConnectionState = {
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    lastDisconnected: null,
    connectionCount: 0,
  };

  let reconnectTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
  let reconnectAttempts = 0;
  let isInitialized = false;

  const notifyConnectionCallbacks = (): void => {
    connectionCallbacks.forEach(callback => {
      try {
        callback({ ...connectionState });
      } catch (error) {
        logger.error('[RealtimeService] Connection callback failed', error as Error);
      }
    });
  };

  const scheduleReconnect = (immediate = false): void => {
    if (!subscriptions.size) {
      return;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      logger.warn('[RealtimeService] Max reconnection attempts reached');
      connectionState = {
        ...connectionState,
        isReconnecting: false,
      };
      notifyConnectionCallbacks();
      return;
    }

    if (reconnectTimeout) {
      return;
    }

    connectionState = {
      ...connectionState,
      isReconnecting: true,
    };
    notifyConnectionCallbacks();

    const delay = immediate ? 0 : reconnectDelayMs * Math.pow(2, reconnectAttempts);

    reconnectTimeout = globalThis.setTimeout(() => {
      reconnectTimeout = null;
      reconnectAttempts += 1;
      logger.info('[RealtimeService] Attempting to re-establish realtime subscriptions', {
        attempt: reconnectAttempts,
        max: maxReconnectAttempts,
      });

      void (async () => {
        const client = await resolveClient(logger, hasLoggedStubWarning);
        if (!client) {
          return;
        }

        const currentSubscriptions = Array.from(subscriptions.entries());
        subscriptions.clear();

        await Promise.all(
          currentSubscriptions.map(async ([key, { channel, config }]) => {
            try {
              channel.unsubscribe();
            } catch (error) {
              logger.warn('[RealtimeService] Failed to unsubscribe stale channel during reconnect', {
                key,
                error,
              });
            }

            await subscribeInternal(config, key, client);
          }),
        );
      })();
    }, delay);
  };

  const handleConnectionChange = (isConnected: boolean): void => {
    const now = new Date();
    const wasConnected = connectionState.isConnected;

    connectionState = {
      ...connectionState,
      isConnected,
      isReconnecting: false,
      lastConnected: isConnected ? now : connectionState.lastConnected,
      lastDisconnected: !isConnected ? now : connectionState.lastDisconnected,
      connectionCount: isConnected && !wasConnected ? connectionState.connectionCount + 1 : connectionState.connectionCount,
    };

    if (isConnected) {
      if (reconnectTimeout) {
        globalThis.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      reconnectAttempts = 0;
    } else if (!reconnectTimeout) {
      scheduleReconnect();
    }

    notifyConnectionCallbacks();
  };

  const subscribeInternal = async (
    config: RealtimeSubscriptionConfig,
    key: string,
    client?: SupabaseDatabase,
  ): Promise<boolean> => {
    const resolvedClient = client ?? (await resolveClient(logger, hasLoggedStubWarning));
    if (!resolvedClient) {
      return false;
    }

    const baseFilter = {
      schema: config.schema ?? 'public',
      ...(config.table ? { table: config.table } : {}),
      ...(config.filter ? { filter: config.filter } : {}),
    } satisfies Partial<RealtimePostgresChangesFilter<ListenEvent>>;

    const listenEvent = config.event ?? REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL;
    const channelBase = resolvedClient.channel(config.channel);

    const handlePayload = (payload: PostgresPayload): void => {
      try {
        const mapper = (config.mapEvent ?? defaultEventMapper) as (
          input: PostgresPayload,
        ) => RealtimeEvent<AnyRow>;
        const event = mapper(payload);
        config.onEvent(event);
      } catch (error) {
        logger.error('[RealtimeService] Failed to process realtime payload', error as Error);
      }
    };

    let channel: RealtimeChannel;

    switch (listenEvent) {
      case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT: {
        const typedFilter: RealtimePostgresChangesFilter<'INSERT'> = {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT,
          ...baseFilter,
        };
        channel = channelBase.on('postgres_changes', typedFilter, handlePayload);
        break;
      }
      case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE: {
        const typedFilter: RealtimePostgresChangesFilter<'UPDATE'> = {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE,
          ...baseFilter,
        };
        channel = channelBase.on('postgres_changes', typedFilter, handlePayload);
        break;
      }
      case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE: {
        const typedFilter: RealtimePostgresChangesFilter<'DELETE'> = {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE,
          ...baseFilter,
        };
        channel = channelBase.on('postgres_changes', typedFilter, handlePayload);
        break;
      }
      default: {
        const typedFilter: RealtimePostgresChangesFilter<'*'> = {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL,
          ...baseFilter,
        };
        channel = channelBase.on('postgres_changes', typedFilter, handlePayload);
        break;
      }
    }

    channel.subscribe((status, err) => {
        logger.info('[RealtimeService] Subscription status change', {
          key,
          status,
        });

        switch (status) {
          case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
            handleConnectionChange(true);
            break;
          case REALTIME_SUBSCRIBE_STATES.CLOSED:
          case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
          case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
            logger.warn('[RealtimeService] Subscription reported disconnection', {
              key,
              status,
              error: err?.message,
            });
            handleConnectionChange(false);
            break;
          default:
            // No-op for intermediate states
            break;
        }
      });

    subscriptions.set(key, { channel, config });
    return true;
  };

  return {
    initialize(): void {
      if (isInitialized) {
        return;
      }

      isInitialized = true;

      void (async () => {
        const client = await resolveClient(logger, hasLoggedStubWarning);
        if (!client) {
          isInitialized = false;
          return;
        }

        logger.info('[RealtimeService] Monitoring initialised', { channelCount: subscriptions.size });
        handleConnectionChange(true);
      })();
    },

    async subscribe<T extends AnyRow>(config: RealtimeSubscriptionConfig<T>): Promise<string | null> {
      const key = config.key;

      if (subscriptions.has(key)) {
        this.unsubscribe(key);
      }

      const success = await subscribeInternal(config as RealtimeSubscriptionConfig, key);
      return success ? key : null;
    },

    unsubscribe(subscriptionKey: string): void {
      const entry = subscriptions.get(subscriptionKey);
      if (!entry) {
        return;
      }

      try {
        entry.channel.unsubscribe();
      } catch (error) {
        logger.warn('[RealtimeService] Failed to unsubscribe channel', {
          key: subscriptionKey,
          error,
        });
      }
      subscriptions.delete(subscriptionKey);

      if (!subscriptions.size) {
        connectionState = {
          ...connectionState,
          isConnected: false,
          isReconnecting: false,
        };
        notifyConnectionCallbacks();
      }
    },

    unsubscribeAll(): void {
      subscriptions.forEach((entry, key) => {
        try {
          entry.channel.unsubscribe();
        } catch (error) {
          logger.warn('[RealtimeService] Failed to unsubscribe channel during cleanup', {
            key,
            error,
          });
        }
      });
      subscriptions.clear();

      if (reconnectTimeout) {
        globalThis.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      connectionState = {
        ...connectionState,
        isConnected: false,
        isReconnecting: false,
      };
      notifyConnectionCallbacks();
    },

    onConnectionChange(callback: ConnectionCallback): () => void {
      connectionCallbacks.add(callback);
      try {
        callback({ ...connectionState });
      } catch (error) {
        logger.error('[RealtimeService] Initial connection callback failed', error as Error);
      }

      return () => {
        connectionCallbacks.delete(callback);
      };
    },

    getConnectionState(): ConnectionState {
      return { ...connectionState };
    },

    getSubscriptionCount(): number {
      return subscriptions.size;
    },

    forceReconnect(): void {
      if (!subscriptions.size) {
        return;
      }

      if (reconnectTimeout) {
        globalThis.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      reconnectAttempts = 0;
      scheduleReconnect(true);
    },

    destroy(): void {
      this.unsubscribeAll();
      connectionCallbacks.clear();
      reconnectAttempts = 0;
      isInitialized = false;
      hasLoggedStubWarning.value = false;
    },
  };
}
