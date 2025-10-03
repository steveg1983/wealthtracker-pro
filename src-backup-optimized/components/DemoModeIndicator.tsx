/**
 * DemoModeIndicator Component - Shows when app is in demo mode
 *
 * Features:
 * - Visual indicator for demo mode
 * - Warning about demo data
 * - Link to create real account
 */

import React from 'react';
import { useDemoMode } from '../hooks/useDemoMode';

export default function DemoModeIndicator(): React.JSX.Element {
  const { isDemoMode, exitDemoMode } = useDemoMode();

  if (!isDemoMode) {
    return <></>;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-amber-500 text-amber-900 px-4 py-2 text-center text-sm font-medium">
      <div className="flex items-center justify-center space-x-2">
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          Demo Mode - You're viewing sample data.{' '}
          <button
            onClick={exitDemoMode}
            className="underline hover:no-underline font-semibold"
          >
            Sign up for a real account
          </button>
        </span>
      </div>
    </div>
  );
}