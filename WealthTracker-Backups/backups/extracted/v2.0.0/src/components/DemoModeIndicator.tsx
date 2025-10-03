import React from 'react';
import { isDemoMode } from '../utils/demoData';

export const DemoModeIndicator: React.FC = () => {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-2 px-4">
      <div className="flex items-center justify-center gap-2">
        <span className="text-xl">🎭</span>
        <span className="font-semibold">Demo Mode Active</span>
        <span className="text-sm">- Using sample data for UI/UX testing</span>
        <a
          href="/"
          className="ml-4 text-sm underline hover:no-underline"
          onClick={() => {
            // Clear demo mode and reload
            const url = new URL(window.location.href);
            url.searchParams.delete('demo');
            window.location.href = url.toString();
          }}
        >
          Exit Demo
        </a>
      </div>
    </div>
  );
};

export default DemoModeIndicator;