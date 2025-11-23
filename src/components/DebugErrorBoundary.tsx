import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createScopedLogger } from '../loggers/scopedLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

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
    this.logger.error('DebugErrorBoundary caught', error, 'DebugErrorBoundary');
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
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
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
