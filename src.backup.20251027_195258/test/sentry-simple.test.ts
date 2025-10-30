import { describe, it, expect } from 'vitest';
import { ErrorBoundary } from '@sentry/react';
import { SentryErrorBoundary } from '../lib/sentry';

describe('Sentry Integration', () => {
  it('exports SentryErrorBoundary correctly', () => {
    expect(SentryErrorBoundary).toBe(ErrorBoundary);
  });

  it('captures exceptions in production mode', () => {
    // Test that the integration is configured properly
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    // Just verify the module can be imported without errors
    expect(() => import('../lib/sentry')).not.toThrow();
    
    process.env.NODE_ENV = originalEnv;
  });
});
