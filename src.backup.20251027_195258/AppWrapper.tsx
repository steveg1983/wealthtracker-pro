import React from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import App from './App';
import { logger } from './services/loggingService';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    logger.error('App Error Boundary caught:', error);
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Error details:', error);
    logger.error('Error info:', errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', color: '#c00' }}>
          <h1>Application Error</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AppWrapper(): React.JSX.Element {
  logger.debug('AppWrapper rendering...');
  
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
