import React, { Component, ReactNode } from 'react';
import { AlertCircleIcon, RefreshCwIcon, DownloadIcon } from './icons';
import { isChunkLoadError } from '../utils/chunkLoadError';
// Through the seam, like every other reporter in the app. This boundary used to
// read `window.Sentry` directly — a global reach-around that both bypassed
// `lib/sentry` (so it never got the app's own scopes or user context) and put
// the word "sentry" into a desktop bundle, where `desktop:greps` found it and
// was right to. `@telemetry` is Sentry in a browser and this machine's console
// in a window. See src/editions/telemetry.ts.
import { captureException } from '@telemetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class LazyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureException(error, {
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // A chunk that would not download needs a fresh document, not a retry:
      // React caches the failed lazy import and re-throws it on every later
      // render, so the retry button below would do nothing at all here.
      const staleChunk = isChunkLoadError(this.state.error);
      const subject = this.props.componentName ?? 'this part of the page';

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          {staleChunk ? (
            <DownloadIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-4" aria-hidden="true" />
          ) : (
            <AlertCircleIcon className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {staleChunk ? 'WealthTracker has been updated' : 'Something went wrong'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
            {staleChunk
              ? `This tab is still running the older version, so ${subject} couldn't load. Reload to pick up the update — nothing you've saved is affected.`
              : this.props.componentName
                ? `Failed to load ${this.props.componentName}`
                : 'Failed to load this component'}
          </p>
          <button
            onClick={staleChunk ? () => window.location.reload() : this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors"
            aria-label={staleChunk ? 'Reload the page' : 'Retry loading component'}
          >
            <RefreshCwIcon className="w-4 h-4" aria-hidden="true" />
            {staleChunk ? 'Reload' : 'Try Again'}
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 w-full">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
                Error details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default LazyErrorBoundary;
