import { useCallback, useState } from 'react';
import { logger } from '../services/loggingService';

interface PullToRefreshOptions {
  threshold?: number;
  disabled?: boolean;
}

interface PullToRefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: PullToRefreshOptions = {}
): PullToRefreshState {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (isRefreshing || options.disabled) {
      return;
    }

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
      logger.error('Refresh failed:', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, options.disabled]);

  return {
    isRefreshing,
    lastRefresh,
    refresh,
  };
}
