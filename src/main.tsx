import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
import { initSentry } from './lib/sentry'

// Initialize Sentry error tracking
initSentry();

// Remove any pre-existing dark class on app start
document.documentElement.classList.remove('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for offline support
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('Service Worker registered successfully');
  },
  onUpdate: () => {
    console.log('New app version available');
    // You could show a notification to the user here
  }
});