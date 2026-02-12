import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ClerkProvider } from '@clerk/clerk-react'
import { ClerkErrorBoundary } from './components/auth/ClerkErrorBoundary'
import { store } from './store'
import './styles/borders.css'
import './styles/accessibility-colors.css'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
import { initializeSecurity } from './security'
import { pushNotificationService } from './services/pushNotificationService'
import { checkEnvironmentVariables } from './utils/env-check'
import { captureMessage, initSentry } from './lib/sentry'
import { createScopedLogger } from './loggers/scopedLogger'
import {
  persistRuntimeControlSanitizationSignal,
  sanitizeRuntimeControlSearchWithDetails,
  sanitizeRuntimeControlStorageWithDetails
} from './utils/runtimeMode'

const bootstrapLogger = createScopedLogger('AppBootstrap');
const disableServiceWorker = import.meta.env.VITE_DISABLE_SERVICE_WORKER === 'true';
let runtimeControlSanitizationContext: {
  removedQueryParams: ('demo' | 'testMode')[];
  removedStorageKeys: ('isTestMode' | 'demoMode')[];
  path: string;
} | null = null;

if (typeof window !== 'undefined') {
  const searchSanitization = sanitizeRuntimeControlSearchWithDetails(window.location.search, import.meta.env);
  if (searchSanitization.sanitizedSearch !== window.location.search) {
    const sanitizedUrl = `${window.location.pathname}${searchSanitization.sanitizedSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', sanitizedUrl);
  }
  const storageSanitization = sanitizeRuntimeControlStorageWithDetails(import.meta.env, window.localStorage);

  if (searchSanitization.removedParams.length > 0 || storageSanitization.removedKeys.length > 0) {
    runtimeControlSanitizationContext = {
      removedQueryParams: searchSanitization.removedParams,
      removedStorageKeys: storageSanitization.removedKeys,
      path: window.location.pathname
    };

    persistRuntimeControlSanitizationSignal(
      runtimeControlSanitizationContext,
      window.sessionStorage
    );
  }
}

// Check environment variables in development
if (import.meta.env.DEV) {
  checkEnvironmentVariables();
}

// Get Clerk publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  bootstrapLogger.error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
  bootstrapLogger.info('Available env vars', { keys: Object.keys(import.meta.env) });
}

// Initialize all security features
initializeSecurity();

// Clean up old service workers (for migration)
if (!disableServiceWorker && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      // Only unregister if it's not our current service worker
      if (!registration.active?.scriptURL.includes('sw.js')) {
        registration.unregister();
        bootstrapLogger.info('Unregistered legacy service worker', { scope: registration.scope });
      }
    }
  });
}

// Initialize Sentry error tracking
try {
  initSentry();
} catch (error) {
  bootstrapLogger.error('Error initializing Sentry', error);
}

if (runtimeControlSanitizationContext) {
  bootstrapLogger.warn('Sanitized runtime control inputs at bootstrap', runtimeControlSanitizationContext);
  captureMessage(
    'Sanitized runtime control inputs at bootstrap',
    'warning',
    runtimeControlSanitizationContext
  );
}

// Add error logging
window.addEventListener('error', (event): void => {
  // Filter benign errors
  if (event.message?.includes('ResizeObserver')) {
    event.preventDefault();
    return;
  }

  // bootstrapLogger.error() already suppresses console in production via LoggingService
  // (src/services/loggingService.ts line 151: if (this.outputToConsole))
  bootstrapLogger.error('Global error captured', event.error);

  // Prevent browser's default console logging in production
  if (!import.meta.env.DEV) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event): void => {
  bootstrapLogger.error('Unhandled promise rejection', event.reason);

  // Prevent browser's default console logging in production
  if (!import.meta.env.DEV) {
    event.preventDefault();
  }
});

// Remove any pre-existing dark class on app start
document.documentElement.classList.remove('dark');

try {
  const root = document.getElementById('root');
  if (!root) {
    bootstrapLogger.error('Root element not found');
  } else {
    bootstrapLogger.info('Starting React app');
    createRoot(root).render(
      <StrictMode>
        <ClerkErrorBoundary>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            afterSignOutUrl="/"
            appearance={{
              variables: {
                colorPrimary: '#3b82f6'
              }
            }}
            allowedRedirectOrigins={[window.location.origin]}
          >
            <Provider store={store}>
              <App />
            </Provider>
          </ClerkProvider>
        </ClerkErrorBoundary>
      </StrictMode>,
    );
    bootstrapLogger.info('React app rendered');
  }
} catch (error) {
  bootstrapLogger.error('Error rendering app', error);
}

// Register service worker for offline support
let _swRegistration: ServiceWorkerRegistration | null = null;

if (disableServiceWorker) {
  bootstrapLogger.info('Service worker registration disabled by VITE_DISABLE_SERVICE_WORKER');
} else {
  serviceWorkerRegistration.register({
    onSuccess: async (registration) => {
      _swRegistration = registration;
      bootstrapLogger.info('Service Worker registered successfully');

      // Store registration globally for React components to access
      window.swRegistration = registration;

      // Initialize push notifications
      try {
        await pushNotificationService.initialize();
        bootstrapLogger.info('Push notifications initialized');
      } catch (error) {
        bootstrapLogger.error('Failed to initialize push notifications', error);
      }
    },
    onUpdate: (registration) => {
      _swRegistration = registration;
      bootstrapLogger.info('New app version available');

      // Store registration globally for React components to access
      window.swRegistration = registration;

      // The ServiceWorkerUpdateNotification component will handle the UI
      // Dispatch a custom event that React components can listen to
      window.dispatchEvent(new CustomEvent('sw-update-available', {
        detail: { registration }
      }));
    },
    onOffline: () => {
      // Dispatch offline event for React components
      window.dispatchEvent(new Event('app-offline'));
    },
    onOnline: () => {
      // Dispatch online event for React components
      window.dispatchEvent(new Event('app-online'));
    }
  });
}
