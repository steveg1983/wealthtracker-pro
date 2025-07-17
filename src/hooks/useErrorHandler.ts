import { useCallback } from 'react';
import { captureException } from '../lib/sentry';

export function useErrorHandler() {
  const handleError = useCallback((error: Error, context?: Record<string, any>) => {
    captureException(error, context);
    console.error('Error handled:', error, context);
  }, []);

  const handleAsyncError = useCallback(async <T,>(
    promise: Promise<T>, 
    context?: Record<string, any>
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