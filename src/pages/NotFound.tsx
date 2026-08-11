import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Shown for any address the app does not recognise.
 *
 * Until this existed there was no catch-all at all, so an unknown URL rendered
 * an empty page — indistinguishable from the app having crashed. That mattered
 * most for addresses that USED to work: the retired Notifications and
 * Accessibility settings pages, and the handful of older routes that now
 * redirect. Anyone holding a bookmark got a blank screen and no way to tell
 * whether their data was gone.
 *
 * So this says which address failed, and offers the two places worth going next
 * rather than a bare apology.
 */
export default function NotFound(): React.JSX.Element {
  const { pathname } = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Page not found
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          There is nothing at that address
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Nothing has happened to your data — the app simply has no page called{' '}
          <span className="font-mono text-gray-900 dark:text-gray-100 break-all">
            {pathname}
          </span>
          . It may have been renamed or removed.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-[#1a2332] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d3a4d] dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
          >
            Go to your dashboard
          </Link>
          <Link
            to="/accounts"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Go to your accounts
          </Link>
        </div>
      </div>
    </div>
  );
}
