import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createScopedLogger } from '../loggers/scopedLogger';
import { captureException } from '../lib/sentry';
import { isChunkLoadError } from '../utils/chunkLoadError';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Outermost boundary: it only fires when the inner ErrorBoundary or the Sentry
 * boundary has itself thrown, so nothing below is left to report the failure.
 * It therefore reports to Sentry directly, and shows the developer detail
 * (message, stack, component stack) ONLY in a dev build — in production that
 * detail names internal components and code paths to whoever hit the crash,
 * and tells a user nothing they can act on.
 */
export class DebugErrorBoundary extends Component<Props, State> {
  private logger = createScopedLogger('DebugErrorBoundary');
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.logger.error('DebugErrorBoundary caught', { error, context: 'DebugErrorBoundary' });
    // The inner boundaries failed, so this is the last chance to record it.
    captureException(error, {
      boundary: 'DebugErrorBoundary',
      componentStack: errorInfo.componentStack
    });
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Same distinction the inner boundary draws: code that would not download
    // is a deploy race, not a crash, and saying so turns a scary page into an
    // obvious one-click fix.
    const staleChunk = isChunkLoadError(this.state.error);

    if (!import.meta.env.DEV) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {staleChunk ? 'WealthTracker has been updated' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {staleChunk
                ? "This tab is still running the older version, so the page couldn't load. Reload to pick up the update — nothing you've saved is affected."
                : 'The page could not be displayed. Your data has not been changed. Reloading usually fixes it.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors text-sm"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-red-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Application Error</h1>

          <div className="bg-white p-6 rounded-lg shadow-lg mb-4">
            <h2 className="text-xl font-semibold mb-2">Error Message:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {this.state.error?.toString()}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg mb-4">
            <h2 className="text-xl font-semibold mb-2">Stack Trace:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm text-red-600">
              {this.state.error?.stack}
            </pre>
          </div>

          {this.state.errorInfo && (
            <div className="bg-white p-6 rounded-lg shadow-lg mb-4">
              <h2 className="text-xl font-semibold mb-2">Component Stack:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-action text-on-primary-action rounded hover:bg-primary-action-hover"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
