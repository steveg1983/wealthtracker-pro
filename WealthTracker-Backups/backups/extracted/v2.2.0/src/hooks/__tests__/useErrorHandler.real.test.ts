/**
 * useErrorHandler REAL Tests
 * Tests error handling with real scenarios
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';

describe('useErrorHandler - REAL Tests', () => {
  it('handles real errors correctly', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    // Test error handling
    const testError = new Error('Real test error');
    const testContext = { userId: 'test-123', action: 'test-action' };
    
    // Should not throw when handling error
    expect(() => {
      act(() => {
        result.current.handleError(testError, testContext);
      });
    }).not.toThrow();
    
    // Verify functions exist
    expect(result.current.handleError).toBeDefined();
    expect(result.current.handleAsyncError).toBeDefined();
  });
  
  it('handles async errors and returns null on failure', async () => {
    const { result } = renderHook(() => useErrorHandler());
    
    // Test with failing promise
    const failingPromise = Promise.reject(new Error('Async error'));
    
    const value = await result.current.handleAsyncError(failingPromise);
    expect(value).toBeNull();
    
    // Test with successful promise
    const successPromise = Promise.resolve('success');
    const successValue = await result.current.handleAsyncError(successPromise);
    expect(successValue).toBe('success');
  });
});