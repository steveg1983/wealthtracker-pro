import React, { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  ensureSupabaseClient,
  isSupabaseStub,
  type SupabaseDatabase
} from '@wealthtracker/core';
import { useUserId } from '../hooks/useUserId';
import { logger } from '../services/loggingService';

const SERVICE_PREFIX = '[RealtimeDebugger]';

declare global {
  interface Window {
    supabase?: SupabaseDatabase;
  }
}

interface DebugEvent {
  time: string;
  type: string;
  table?: string;
  data: RealtimePostgresChangesPayload<Record<string, unknown>>;
}

export default function RealtimeDebugger() {
  const { databaseId, isLoading } = useUserId();
  const [status, setStatus] = useState<string>('Not connected');
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !databaseId) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const setupDebugger = async () => {
      try {
        const client = await ensureSupabaseClient();
        if (cancelled || !client || isSupabaseStub(client)) {
          logger.warn(`${SERVICE_PREFIX} Supabase client unavailable for realtime debugging`, { cancelled });
          return;
        }

        if (typeof window !== 'undefined') {
          window.supabase = client;
        }

        setDbUserId(databaseId);
        logger.info(`${SERVICE_PREFIX} Database user ID ready`, { databaseId });

        const channel = client
          .channel(`debug-accounts-${databaseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'accounts',
              filter: `user_id=eq.${databaseId}`
            },
            (payload) => {
              logger.debug(`${SERVICE_PREFIX} Event received`, payload);
              setEvents(prev => [
                {
                  time: new Date().toISOString(),
                  type: payload.eventType ?? 'unknown',
                  table: payload.table,
                  data: payload
                },
                ...prev
              ].slice(0, 10));
            }
          )
          .subscribe((subscriptionStatus, error) => {
            logger.info(`${SERVICE_PREFIX} Subscription status`, { subscriptionStatus });
            setStatus(subscriptionStatus);
            if (error) {
              logger.error(`${SERVICE_PREFIX} Subscription error`, error);
            }
          });

        unsubscribe = () => {
          logger.info(`${SERVICE_PREFIX} Cleaning up channel`);
          client.removeChannel(channel);
        };
      } catch (error) {
        logger.error(`${SERVICE_PREFIX} Failed to set up realtime debugger`, error);
        setStatus('Error');
      }
    };

    setupDebugger();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [databaseId, isLoading]);

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">Realtime Debugger</h3>
      <div className="text-xs space-y-1">
        <div>Status: <span className={status === 'SUBSCRIBED' ? 'text-green-600' : 'text-yellow-600'}>{status}</span></div>
        <div>DB User ID: {dbUserId ? `${dbUserId.slice(0, 10)}...` : 'Unavailable'}</div>
        <div className="mt-2">
          <div className="font-semibold">Recent Events:</div>
          {events.length === 0 ? (
            <div className="text-gray-500">No events yet</div>
          ) : (
            <div className="space-y-1 mt-1">
              {events.map((event, i) => (
                <div key={i} className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded">
                  {event.type} - {event.table} - {new Date(event.time).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
