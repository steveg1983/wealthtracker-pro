import { useState, useEffect } from 'react';
import { skipWaiting } from '../utils/serviceWorkerRegistration';
import { RefreshCwIcon, XIcon } from './icons';

interface ServiceWorkerUpdateNotificationProps {
  registration: ServiceWorkerRegistration | null;
}

export default function ServiceWorkerUpdateNotification({ 
  registration 
}: ServiceWorkerUpdateNotificationProps): React.JSX.Element | null {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!registration) return;

    // In development, don't show update prompts as they can be confusing
    const isDevelopment = window.location.hostname === 'localhost' && window.location.port === '5173';
    if (isDevelopment) {
      console.log('[SW Update] Skipping update prompt in development');
      return;
    }

    const handleUpdateFound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New update available
          setShowUpdatePrompt(true);
        }
      });
    };

    if (registration.waiting) {
      // Update is already waiting
      setShowUpdatePrompt(true);
    }

    registration.addEventListener('updatefound', handleUpdateFound);

    return () => {
      registration.removeEventListener('updatefound', handleUpdateFound);
    };
  }, [registration]);

  const handleUpdate = () => {
    setIsUpdating(true);
    
    // Set a timeout to force reload if the update gets stuck
    const reloadTimeout = setTimeout(() => {
      console.log('[SW Update] Update seems stuck, forcing reload...');
      window.location.reload();
    }, 3000); // Force reload after 3 seconds if update doesn't complete
    
    // Listen for the controller change which indicates successful update
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      clearTimeout(reloadTimeout);
      window.location.reload();
    }, { once: true });
    
    skipWaiting();
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    // Show again after 4 hours
    setTimeout(() => {
      if (registration?.waiting) {
        setShowUpdatePrompt(true);
      }
    }, 4 * 60 * 60 * 1000);
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <RefreshCwIcon 
              size={24} 
              className={`text-blue-600 dark:text-blue-400 ${isUpdating ? 'animate-spin' : ''}`}
            />
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Update Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              A new version of WealthTracker is available with bug fixes and improvements.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                {isUpdating ? 'Updating...' : 'Update Now'}
              </button>
              
              <button
                onClick={handleDismiss}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Later
              </button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss update notification"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}