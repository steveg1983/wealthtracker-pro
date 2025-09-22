import React, { useEffect } from 'react';
import { useActivityLogger } from '../hooks/useActivityLogger';
import { useLogger } from '../services/ServiceProvider';

/**
 * Provider component that initializes activity logging throughout the app
 */
export function ActivityLoggerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const logger = useLogger();
  // Initialize activity logger
  useActivityLogger();

  // Log app startup
  useEffect(() => {
    logger.info('Activity logging initialized');
  }, []);

  return <>{children}</>;
}
