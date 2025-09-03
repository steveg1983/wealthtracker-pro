import React, { useEffect } from 'react';
import { useActivityLogger } from '../hooks/useActivityLogger';

/**
 * Provider component that initializes activity logging throughout the app
 */
export function ActivityLoggerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Initialize activity logger
  useActivityLogger();

  // Log app startup
  useEffect(() => {
    logger.info('Activity logging initialized');
  }, []);

  return <>{children}</>;
}
