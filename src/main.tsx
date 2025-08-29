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

// Check environment variables in development
if (import.meta.env.DEV) {
  checkEnvironmentVariables();
}

// Get Clerk publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  console.error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
  console.error('Available env vars:', Object.keys(import.meta.env));
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
        console.log('[ServiceWorker] Unregistered old:', registration.scope);
      }
    }
  });
}

// Initialize Sentry error tracking
try {
  initSentry();
} catch (error) {
  console.error('Error initializing Sentry:', error);
}

// Add error logging
window.addEventListener('error', (event): void => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event): void => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Remove any pre-existing dark class on app start
document.documentElement.classList.remove('dark');

try {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Root element not found!');
  } else {
    console.log('Starting React app...');
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
    console.log('React app rendered');
  }
} catch (error) {
  console.error('Error rendering app:', error);
}

// Register service worker for offline support
let swRegistration: ServiceWorkerRegistration | null = null;

serviceWorkerRegistration.register({
  onSuccess: async (registration) => {
    swRegistration = registration;
    console.log('Service Worker registered successfully');
    
    // Store registration globally for React components to access
    (window as any).swRegistration = registration;
    
    // Initialize push notifications
    try {
      await pushNotificationService.initialize();
      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  },
  onUpdate: (registration) => {
    swRegistration = registration;
    console.log('New app version available');
    
    // Store registration globally for React components to access
    (window as any).swRegistration = registration;
    
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