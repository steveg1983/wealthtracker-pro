import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
// import { initSentry } from './lib/sentry'

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
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('Service Worker registered successfully');
  },
  onUpdate: (registration) => {
    console.log('New app version available');
    // Show update notification to user
    const updateBanner = document.createElement('div');
    updateBanner.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    updateBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <span>A new version is available!</span>
        <button onclick="window.location.reload()" class="px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50 transition-colors">
          Update Now
        </button>
      </div>
    `;
    document.body.appendChild(updateBanner);
    
    // Remove banner after 10 seconds
    setTimeout(() => {
      updateBanner.remove();
    }, 10000);
  }
});