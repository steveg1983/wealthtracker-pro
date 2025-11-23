import { useCallback, useState } from 'react';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

type UsePullToRefreshOptions = {
  threshold?: number;
  disabled?: boolean;
};

type UsePullToRefreshResult = {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
};

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: UsePullToRefreshOptions = {}
): UsePullToRefreshResult {
  const logger = useMemoizedLogger('usePullToRefresh');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { disabled = false } = options;

  const refresh = useCallback(async () => {
    if (isRefreshing || disabled) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
      logger.error?.('Refresh failed', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, disabled, logger]);

  return {
    isRefreshing,
    lastRefresh,
    refresh,
  };
}

export default usePullToRefresh;
