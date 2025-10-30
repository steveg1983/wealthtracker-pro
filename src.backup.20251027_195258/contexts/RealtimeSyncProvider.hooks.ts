import { useContext } from 'react';
import { RealtimeSyncContext } from './RealtimeSyncProvider.context';
import type { RealtimeSyncContextType } from './RealtimeSyncProvider.types';

export function useRealtimeSyncContext(): RealtimeSyncContextType {
  const context = useContext(RealtimeSyncContext);
  if (context === null) {
    throw new Error('useRealtimeSyncContext must be used within a RealtimeSyncProvider');
  }
  return context;
}

export function useOptionalRealtimeSync(): RealtimeSyncContextType | null {
  return useContext(RealtimeSyncContext);
}
