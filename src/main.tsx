import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
// import { initSentry } from './lib/sentry'

// Initialize Sentry error tracking
// try {
//   initSentry();
// } catch (error) {
//   console.error('Error initializing Sentry:', error);
// }

// Add error logging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
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
        <App />
      </StrictMode>,
    );
    console.log('React app rendered');
  }
} catch (error) {
  console.error('Error rendering app:', error);
}

// Register service worker for offline support
// serviceWorkerRegistration.register({
//   onSuccess: () => {
//     console.log('Service Worker registered successfully');
//   },
//   onUpdate: () => {
//     console.log('New app version available');
//     // You could show a notification to the user here
//   }
// });