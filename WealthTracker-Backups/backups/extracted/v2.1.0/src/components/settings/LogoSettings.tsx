import React from 'react';
import { InfoIcon } from '../icons';

export default function LogoSettings() {
  const clearLogoCache = () => {
    localStorage.removeItem('merchantLogos');
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Merchant Logo Settings
        </h3>
        
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600 mb-6">
          <div className="flex items-start gap-3">
            <InfoIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
            <div className="text-sm">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                About Merchant Logos
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                WealthTracker can display real company logos for recognized merchants in your transactions.
              </p>
              <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Logos are fetched from Clearbit's free API</li>
                <li>• No personal data is shared - only company domains</li>
                <li>• Logos are cached locally for better performance</li>
                <li>• Falls back to emoji icons if logos can't be loaded</li>
              </ul>
              
              {/* Warning about ad blockers */}
              <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                  <strong>Note:</strong> Ad blockers or privacy extensions may block logo loading. 
                  This is normal and the app will use emoji fallbacks instead.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo Cache Management
            </h4>
            <button
              onClick={clearLogoCache}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Clear Logo Cache
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Clear cached logos to re-fetch them. Useful if logos aren't displaying correctly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}