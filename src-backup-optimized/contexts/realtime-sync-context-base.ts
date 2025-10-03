import { createContext } from 'react';
import type { UseRealtimeSyncReturn } from '../hooks/useRealtimeSync';
import type { SpendingAnomaly } from '../services/advancedAnalyticsService';

export interface RealtimeSyncContextType extends UseRealtimeSyncReturn {
  setEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  recentAnomalies: SpendingAnomaly[];
  portfolioChange24h: number | null;
}

export const RealtimeSyncContext = createContext<RealtimeSyncContextType | null>(null);

