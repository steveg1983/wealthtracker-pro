import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';

// Mock the sentry module
vi.mock('../../lib/sentry', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

// Import the mocked function
import { captureException } from '../../lib/sentry';

describe('useErrorHandler', () => {
  // Mock console methods
  const originalConsoleError = console.error;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  describe('handleError', () => {
    it('should capture exception with Sentry', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      act(() => {
        result.current.handleError(error, context);
      });

      expect(captureException).toHaveBeenCalledWith(error, context);
      expect(captureException).toHaveBeenCalledTimes(1);
    });

    it('should handle error and call captureException', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');
      const context = { userId: '123' };

      act(() => {
        result.current.handleError(error, context);
      });

      // Verify captureException was called with the error
      expect(captureException).toHaveBeenCalledWith(error, context);
    });

    it('should handle error without context', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');

      act(() => {
        result.current.handleError(error);
      });

      expect(captureException).toHaveBeenCalledWith(error, undefined);
    });

    it('should return the same function reference on re-renders', () => {
      const { result, rerender } = renderHook(() => useErrorHandler());
      const firstRender = result.current.handleError;

      rerender();
      const secondRender = result.current.handleError;

      expect(firstRender).toBe(secondRender);
    });
  });

  describe('handleAsyncError', () => {
    it('should resolve promise and return result on success', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const successValue = { data: 'success' };
      const promise = Promise.resolve(successValue);

      const resultValue = await act(async () => {
        return result.current.handleAsyncError(promise);
      });

      expect(resultValue).toEqual(successValue);
      expect(captureException).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle rejected promise and return null', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Async error');
      const promise = Promise.reject(error);
      const context = { operation: 'async-test' };

      const resultValue = await act(async () => {
        return result.current.handleAsyncError(promise, context);
      });

      expect(resultValue).toBeNull();
      expect(captureException).toHaveBeenCalledWith(error, context);
    });

    it('should handle non-Error rejections', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const errorString = 'String error';
      const promise = Promise.reject(errorString);

      const resultValue = await act(async () => {
        return result.current.handleAsyncError(promise);
      });

      expect(resultValue).toBeNull();
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorString
        }),
        undefined
      );
    });

    it('should handle null/undefined rejections', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const promise = Promise.reject(null);

      const resultValue = await act(async () => {
        return result.current.handleAsyncError(promise);
      });

      expect(resultValue).toBeNull();
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'null'
        }),
        undefined
      );
    });

    it('should handle object rejections', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const errorObj = { code: 'ERROR_CODE', message: 'Object error' };
      const promise = Promise.reject(errorObj);

      const resultValue = await act(async () => {
        return result.current.handleAsyncError(promise);
      });

      expect(resultValue).toBeNull();
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[object Object]')
        }),
        undefined
      );
    });

    it('should return the same function reference on re-renders', () => {
      const { result, rerender } = renderHook(() => useErrorHandler());
      const firstRender = result.current.handleAsyncError;

      rerender();
      const secondRender = result.current.handleAsyncError;

      expect(firstRender).toBe(secondRender);
    });

    it('should preserve generic type for successful promises', async () => {
      const { result } = renderHook(() => useErrorHandler());
      
      interface TestData {
        id: number;
        name: string;
      }
      
      const data: TestData = { id: 1, name: 'test' };
      const promise = Promise.resolve(data);

      const resultValue = await act(async () => {
        return result.current.handleAsyncError<TestData>(promise);
      });

      // TypeScript should infer this as TestData | null
      expect(resultValue).toEqual(data);
      expect(resultValue?.id).toBe(1);
      expect(resultValue?.name).toBe('test');
    });
  });

  describe('integration', () => {
    it('should call captureException when handleAsyncError rejects', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Integration test error');
      const promise = Promise.reject(error);
      const context = { test: 'integration' };

      await act(async () => {
        await result.current.handleAsyncError(promise, context);
      });

      // Verify that captureException was called (which proves handleError was used internally)
      expect(captureException).toHaveBeenCalledWith(error, context);
    });

    it('should handle multiple async errors in sequence', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      const promise1 = Promise.reject(error1);
      const promise2 = Promise.reject(error2);

      await act(async () => {
        await result.current.handleAsyncError(promise1);
        await result.current.handleAsyncError(promise2);
      });

      expect(captureException).toHaveBeenCalledTimes(2);
      expect(captureException).toHaveBeenNthCalledWith(1, error1, undefined);
      expect(captureException).toHaveBeenNthCalledWith(2, error2, undefined);
    });
  });
});