import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ClerkProvider } from '@clerk/clerk-react'
import { ClerkErrorBoundary } from './components/auth/ClerkErrorBoundary'
import { store } from './store'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
import { initializeSecurity } from './security'
import { pushNotificationService } from './services/pushNotificationService'
import { checkEnvironmentVariables } from './utils/env-check'
import { initSentry } from './lib/sentry'
import { createScopedLogger } from './loggers/scopedLogger'

const bootstrapLogger = createScopedLogger('AppBootstrap');

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
if ('serviceWorker' in navigator) {
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

// Add error logging
window.addEventListener('error', (event): void => {
  bootstrapLogger.error('Global error captured', event.error);
});

window.addEventListener('unhandledrejection', (event): void => {
  bootstrapLogger.error('Unhandled promise rejection', event.reason);
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
