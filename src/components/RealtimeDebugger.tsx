import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserId } from '../hooks/useUserId';
import { useLogger } from '../services/ServiceProvider';

export default function RealtimeDebugger() {
  const logger = useLogger();
  const { databaseId, isLoading } = useUserId();
  const [status, setStatus] = useState<string>('Not connected');
  const [events, setEvents] = useState<any[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !databaseId || !supabase) return;

    // Expose supabase to window for debugging
    (window as any).supabase = supabase;

    const setupDebugger = async () => {
      // Use the database ID from hook
      setDbUserId(databaseId);
      logger.info('[RealtimeDebugger] Database user ID', { databaseId });

      // Set up direct subscription for debugging
      if (!supabase) return;
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
            (payload) => {
              logger.debug('[RealtimeDebugger] Event received', payload);
              setEvents(prev => [{
                time: new Date().toISOString(),
                type: payload.eventType,
                table: payload.table,
                data: payload
              }, ...prev].slice(0, 10));
            }
          )
          .subscribe((status, error) => {
            logger.info('[RealtimeDebugger] Status', { status });
            setStatus(status);
            if (error) {
              logger.error('❌ [RealtimeDebugger] Error:', error);
            }
          });

      return () => {
        logger.info('[RealtimeDebugger] Cleaning up');
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    };

    setupDebugger();
  }, [databaseId, isLoading]);

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">Realtime Debugger</h3>
      <div className="text-xs space-y-1">
        <div>Status: <span className={status === 'SUBSCRIBED' ? 'text-green-600' : 'text-yellow-600'}>{status}</span></div>
        <div>DB User ID: {databaseId?.slice(0, 10)}...</div>
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
