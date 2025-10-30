import type { ReactNode } from 'react';
import type { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { SpendingAnomaly } from '../services/advancedAnalyticsService';

type RealtimeSyncBase = ReturnType<typeof useRealtimeSync>;

export interface RealtimeSyncContextType extends RealtimeSyncBase {
  setEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  recentAnomalies: SpendingAnomaly[];
  portfolioChange24h: number | null;
}

export interface RealtimeSyncProviderProps {
  children: ReactNode;
  defaultConfig?: {
    enabled?: boolean;
    showNotifications?: boolean;
    syncData?: {
      accounts?: boolean;
      transactions?: boolean;
      budgets?: boolean;
      goals?: boolean;
    };
  };
}
