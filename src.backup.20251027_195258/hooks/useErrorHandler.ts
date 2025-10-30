import { useCallback } from 'react';
import { captureException } from '../lib/sentry';
import { logger } from '../services/loggingService';

type ErrorContext = Record<string, unknown>;

export function useErrorHandler(): {
  handleError: (error: Error, context?: ErrorContext) => void;
  handleAsyncError: <T>(promise: Promise<T>, context?: ErrorContext) => Promise<T | null>;
} {
  const handleError = useCallback((error: Error, context?: ErrorContext) => {
    captureException(error, context);
    logger.error('Error handled:', { error, context });
  }, []);

  const handleAsyncError = useCallback(async <T,>(
    promise: Promise<T>,
    context?: ErrorContext
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
}
