import { useEffect, useState } from 'react';
import { useLogger } from '../services/ServiceProvider';

export function useOnlineStatus(): boolean {
  const logger = useLogger();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true);
      logger.info('Connection restored');
    };

    const handleOffline = (): void => {
      setIsOnline(false);
      logger.warn('Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for custom app events
    window.addEventListener('app-online', handleOnline);
    window.addEventListener('app-offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-online', handleOnline);
      window.removeEventListener('app-offline', handleOffline);
    };
  }, []);

  return isOnline;
}
