/**
 * ErrorBoundary Tests
 * Tests for error handling and recovery
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Mock the icons to avoid import issues
vi.mock('../icons', () => ({
  AlertTriangleIcon: ({ className }: { className?: string }) => (
    <div data-testid="alert-icon" className={className}>Alert</div>
  ),
  RefreshCwIcon: () => (
    <div data-testid="refresh-icon">Refresh</div>
  ),
  HomeIcon: () => (
    <div data-testid="home-icon">Home</div>
  ),
}));

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Mock window.location for testing
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLocation.href = '';
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches errors and displays error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('displays custom fallback when provided', () => {
    const customFallback = <div>Custom error UI</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalledWith(
      'Error caught by boundary:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Error details')).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(screen.getByText('Error details'));
    
    // Should show error message in details
    expect(screen.getByText(/Error: Test error message/)).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.queryByText('Error details')).not.toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('handles Try Again button click', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Error should be displayed
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    
    // Click Try Again - this clears the error state but doesn't automatically re-render children
    fireEvent.click(screen.getByText('Try Again'));
    
    // The error UI should still be visible because the component that threw the error
    // will throw again when re-rendered unless we change its props
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('handles Go Home button click', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Click Go Home
    fireEvent.click(screen.getByText('Go Home'));
    
    // Should navigate to home
    expect(mockLocation.href).toBe('/');
  });

  it('displays generic error message when error has no message', () => {
    // Component that throws error without message
    const ThrowEmptyError = () => {
      const error = new Error();
      error.message = '';
      throw error;
    };
    
    render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders error UI with proper styling', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Check for key UI elements
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    
    // Check buttons exist
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    const goHomeButton = screen.getByRole('button', { name: /go home/i });
    
    expect(tryAgainButton).toBeInTheDocument();
    expect(goHomeButton).toBeInTheDocument();
  });

  it('handles multiple sequential errors', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // First error
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    
    // Try again
    fireEvent.click(screen.getByText('Try Again'));
    
    // Throw another error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Should show error again
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});
