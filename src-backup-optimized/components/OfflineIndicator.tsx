/**
 * OfflineIndicator Component - Shows offline status
 *
 * Features:
 * - Network status detection
 * - Visual offline indicator
 * - Accessibility support
 */

import React from 'react';
import { useApp } from '../contexts/AppContext';

export default function OfflineIndicator(): React.JSX.Element {
  const { isOnline } = useApp();

  // Don't show anything if online
  if (isOnline) {
    return <></>;
  }

  return (
    <div
      className="fixed bottom-4 left-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
        />
      </svg>
      <span className="text-sm font-medium">Working Offline</span>
    </div>
  );
}