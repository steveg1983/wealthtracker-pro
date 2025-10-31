import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ExternalLink, Chrome, Globe } from 'lucide-react';
import { shouldShowSafariWarning, dismissSafariWarning, initClerkSafariCompat } from '../utils/clerkSafarifix';

type SafariCompatInfo = {
  safari?: boolean;
  localStorage?: boolean;
  sessionStorage?: boolean;
  thirdPartyCookies?: boolean;
  compatible?: boolean;
  warnings?: string[];
};

export default function SafariWarning(): React.JSX.Element | null {
  const [show, setShow] = useState(false);
  const [compatInfo, setCompatInfo] = useState<SafariCompatInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSafari = async () => {
      if (shouldShowSafariWarning()) {
        const compat = await initClerkSafariCompat();
        setCompatInfo(compat);
        
        // Only show if there are actual issues
        if (compat.warnings && compat.warnings.length > 0) {
          setShow(true);
        }
      }
      setIsLoading(false);
    };

    checkSafari();
  }, []);

  const handleDismiss = () => {
    dismissSafariWarning();
    setShow(false);
  };

  const handleTryAnyway = () => {
    dismissSafariWarning();
    setShow(false);
    // Continue to sign in
    window.location.href = '/login';
  };

  if (isLoading || !show || !compatInfo) {
    return null;
  }

  const hasPrivateMode = !compatInfo.localStorage || !compatInfo.sessionStorage;
  const hasCookieIssues = !compatInfo.thirdPartyCookies;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">Safari Compatibility Issue</h2>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            We've detected that you're using Safari, which has some compatibility issues with our secure authentication system.
          </p>

          {/* Specific Issues */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-2">
              Issues Detected:
            </h3>
            
            {hasPrivateMode && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle size={16} className="text-orange-600 mt-0.5" />
                <div>
                  <span className="font-medium text-orange-900 dark:text-orange-300">
                    Private Browsing Mode
                  </span>
                  <p className="text-orange-700 dark:text-orange-400">
                    Safari's private mode blocks storage needed for authentication.
                  </p>
                </div>
              </div>
            )}

            {hasCookieIssues && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle size={16} className="text-orange-600 mt-0.5" />
                <div>
                  <span className="font-medium text-orange-900 dark:text-orange-300">
                    Cross-Site Tracking Prevention
                  </span>
                  <p className="text-orange-700 dark:text-orange-400">
                    Safari's privacy settings may block authentication cookies.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Solutions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Recommended Solutions:
            </h3>

            {/* Option 1: Fix Safari Settings */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Option 1: Adjust Safari Settings
              </h4>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                {hasPrivateMode && (
                  <li>Exit Private Browsing mode (File → New Window)</li>
                )}
                <li>Open Safari → Preferences → Privacy</li>
                <li>Uncheck "Prevent cross-site tracking"</li>
                <li>Ensure "Block all cookies" is unchecked</li>
                <li>Reload this page and try again</li>
              </ol>
            </div>

            {/* Option 2: Use Different Browser */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Option 2: Use a Different Browser (Recommended)
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                For the best experience, we recommend using:
              </p>
              <div className="flex gap-3">
                <a
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Chrome size={18} />
                  Chrome
                  <ExternalLink size={14} />
                </a>
                <a
                  href="https://www.microsoft.com/edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                >
                  <Globe size={18} />
                  Edge
                  <ExternalLink size={14} />
                </a>
                <a
                  href="https://www.mozilla.org/firefox/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors"
                >
                  <Globe size={18} />
                  Firefox
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleTryAnyway}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Try Anyway
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              I'll Use Another Browser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
