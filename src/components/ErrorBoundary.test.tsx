/**
 * ErrorBoundary Tests
 * Tests for the error boundary component that catches React errors
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

// Mock the icons
vi.mock('./icons', () => ({
  AlertTriangleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="alert-icon" className={className} style={{ fontSize: size }}>⚠️</span>
  ),
  RefreshCwIcon: ({ size }: { size?: number }) => (
    <span data-testid="refresh-icon" style={{ fontSize: size }}>🔄</span>
  ),
  HomeIcon: ({ size }: { size?: number }) => (
    <span data-testid="home-icon" style={{ fontSize: size }}>🏠</span>
  )
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Working component</div>;
};

describe('ErrorBoundary', () => {
  const mockOnError = vi.fn();
  const originalConsoleError = console.error;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.env.NODE_ENV = originalEnv;
  });

  describe('Normal Operation', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders multiple children correctly', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('does not interfere with child component props', () => {
      const ChildComponent = ({ text }: { text: string }) => <div>{text}</div>;
      
      render(
        <ErrorBoundary>
          <ChildComponent text="Props work" />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Props work')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.queryByText('Working component')).not.toBeInTheDocument();
    });

    it('displays default message when error has no message', () => {
      const ThrowEmptyError = () => {
        throw new Error();
      };
      
      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    });

    it('calls onError callback when error occurs', () => {
      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
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
  });

  describe('Error UI', () => {
    it('displays error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });

    it('displays Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
      expect(tryAgainButton).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('displays Go Home button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const goHomeButton = screen.getByRole('button', { name: /Go Home/i });
      expect(goHomeButton).toBeInTheDocument();
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    });

    it('resets error state when Try Again is clicked', () => {
      const TestComponent = () => (
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      render(<TestComponent />);
      
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
      
      // After clicking Try Again, error boundary resets but the same error would occur
      // The error UI should be shown again
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('navigates to home when Go Home is clicked', () => {
      const originalLocation = window.location;
      
      // Mock window.location
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/some-page' };
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByRole('button', { name: /Go Home/i }));
      
      expect(window.location.href).toBe('/');
      
      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('Error Details (Development Mode)', () => {
    it('shows error details in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Error details')).toBeInTheDocument();
    });

    it('displays error stack trace when expanded', () => {
      process.env.NODE_ENV = 'development';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const details = screen.getByText('Error details');
      fireEvent.click(details);
      
      expect(screen.getByText(/Error: Test error message/)).toBeInTheDocument();
    });

    it('displays component stack when available', () => {
      process.env.NODE_ENV = 'development';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const details = screen.getByText('Error details');
      fireEvent.click(details);
      
      // Component stack is shown in a pre element
      const pre = screen.getByText((content, element) => {
        return element?.tagName === 'PRE' && content.includes('ThrowError');
      });
      expect(pre).toBeInTheDocument();
    });

    it('hides error details in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.queryByText('Error details')).not.toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const CustomFallback = <div>Custom error UI</div>;
      
      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('custom fallback can be a component', () => {
      const CustomFallbackComponent = () => (
        <div>
          <h1>Error occurred</h1>
          <button>Retry</button>
        </div>
      );
      
      render(
        <ErrorBoundary fallback={<CustomFallbackComponent />}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  describe('Multiple Errors', () => {
    it('handles consecutive errors', () => {
      // Create a component that can throw different errors
      const MultiErrorComponent = ({ errorType }: { errorType: number }) => {
        if (errorType === 1) {
          throw new Error('First error');
        } else if (errorType === 2) {
          throw new Error('Second error');
        }
        return <div>No error</div>;
      };
      
      const { rerender } = render(
        <ErrorBoundary>
          <MultiErrorComponent errorType={1} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('First error')).toBeInTheDocument();
      
      // Reset the error boundary
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
      
      // The same component will throw the same error again
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
  });

  describe('Error Types', () => {
    it('handles non-Error objects being thrown', () => {
      const ThrowString = () => {
        throw 'String error';  
      };
      
      render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      );
      
      // Should still show error UI
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles errors in lifecycle methods', () => {
      class ComponentWithErrorInLifecycle extends React.Component {
        componentDidMount() {
          throw new Error('Lifecycle error');
        }
        render() {
          return <div>Component content</div>;
        }
      }
      
      render(
        <ErrorBoundary>
          <ComponentWithErrorInLifecycle />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Lifecycle error')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct container styling', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const container = screen.getByText('Oops! Something went wrong').closest('.bg-white');
      expect(container).toHaveClass(
        'max-w-md',
        'w-full',
        'bg-white',
        'dark:bg-gray-800',
        'rounded-2xl',
        'shadow-xl',
        'p-8',
        'text-center'
      );
    });

    it('applies correct icon container styling', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const iconContainer = screen.getByTestId('alert-icon').parentElement;
      expect(iconContainer).toHaveClass(
        'w-20',
        'h-20',
        'bg-red-100',
        'dark:bg-red-900/30',
        'rounded-full',
        'flex',
        'items-center',
        'justify-center'
      );
    });
  });
});
