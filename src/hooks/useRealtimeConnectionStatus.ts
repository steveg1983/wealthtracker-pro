/**
 * Lightweight hook exposing the realtime connection state.
 *
 * Extracted from the former useRealtimeSync.ts, whose main hook dispatched
 * realtime events into the Redux store — a store nothing read (the app
 * renders from AppContextSupabase). That dead pipeline was deleted along
 * with the Redux store; this connection-status reader was its only live
 * export.
 */

import { useEffect, useRef } from 'react';
import realtimeService, { type ConnectionState } from '../services/realtimeService';

export function useRealtimeConnectionStatus(): ConnectionState {
  const connectionStateRef = useRef<ConnectionState>(realtimeService.getConnectionState());

  useEffect(() => {
    const unsubscribe = realtimeService.onConnectionChange((state) => {
      connectionStateRef.current = state;
    });

    return unsubscribe;
  }, []);

  return connectionStateRef.current;
}
