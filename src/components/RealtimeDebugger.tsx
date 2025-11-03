import React, { useEffect, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useUserId } from '../hooks/useUserId';

declare global {
  interface Window {
    supabase?: typeof supabase;
  }
}

type SubscriptionStatus = `${REALTIME_SUBSCRIBE_STATES}`;

interface DebugEvent {
  time: string;
  type: RealtimePostgresChangesPayload<Record<string, unknown>>['eventType'];
  table: string;
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>;
}

export default function RealtimeDebugger() {
  const { databaseId, isLoading } = useUserId();
  const [status, setStatus] = useState<SubscriptionStatus>('CLOSED');
  const [events, setEvents] = useState<DebugEvent[]>([]);

  useEffect(() => {
    if (isLoading || !databaseId) return;

    // Expose supabase to window for debugging
    window.supabase = supabase;

    const channel = supabase
      .channel(`debug-accounts-${databaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${databaseId}`
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log('🎯 [RealtimeDebugger] Event received:', payload);
          setEvents(prev => [
            {
              time: new Date().toISOString(),
              type: payload.eventType,
              table: payload.table,
              payload
            },
            ...prev
          ].slice(0, 10));
        }
      )
      .subscribe((subscriptionStatus, error) => {
        console.log('📡 [RealtimeDebugger] Status:', subscriptionStatus);
        const validStatuses: SubscriptionStatus[] = [
          REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
          REALTIME_SUBSCRIBE_STATES.TIMED_OUT,
          REALTIME_SUBSCRIBE_STATES.CLOSED,
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR
        ];
        const normalizedStatus = validStatuses.includes(subscriptionStatus as SubscriptionStatus)
          ? (subscriptionStatus as SubscriptionStatus)
          : REALTIME_SUBSCRIBE_STATES.CLOSED;
        setStatus(normalizedStatus);
        if (error) {
          console.error('❌ [RealtimeDebugger] Error:', error);
        }
      });

    return () => {
      console.log('🔚 [RealtimeDebugger] Cleaning up');
      supabase!.removeChannel(channel);
    };
  }, [databaseId, isLoading]);

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">Realtime Debugger</h3>
      <div className="text-xs space-y-1">
        <div>Status: <span className={status === 'SUBSCRIBED' ? 'text-green-600' : 'text-yellow-600'}>{status}</span></div>
        <div>
          DB User ID:{' '}
          {databaseId ? `${databaseId.slice(0, 10)}…` : 'Not resolved'}
        </div>
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
