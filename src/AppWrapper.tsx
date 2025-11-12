import { Component, ReactNode, ErrorInfo } from 'react';
import App from './App';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const appLogger = typeof console !== 'undefined'
  ? console
  : { log: () => {}, error: () => {} };

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    appLogger.error('App Error Boundary caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    appLogger.error('Error details:', error);
    appLogger.error('Error info:', errorInfo);
  }

  render(): ReactNode {
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
  appLogger.log('AppWrapper rendering...');
  
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
