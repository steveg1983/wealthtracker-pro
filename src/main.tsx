import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
import { initializeSecurity } from './security'
import { pushNotificationService } from './services/pushNotificationService'
// import { initSentry } from './lib/sentry'

// Initialize all security features
initializeSecurity();

// Unregister any existing service worker to fix errors
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('[ServiceWorker] Unregistered:', registration.scope);
    }
  });
}

// Initialize Sentry error tracking
// try {
//   initSentry();
// } catch (error) {
//   console.error('Error initializing Sentry:', error);
// }

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
        <Provider store={store}>
          <App />
        </Provider>
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