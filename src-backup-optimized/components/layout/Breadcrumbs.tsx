/**
 * Breadcrumbs Component - Navigation breadcrumbs
 *
 * Features:
 * - Current page path navigation
 * - Accessible breadcrumb trail
 * - Route-based breadcrumb generation
 */

import React from 'react';
import { useLocation } from 'react-router-dom';

export function Breadcrumbs(): React.JSX.Element {
  const location = useLocation();

  // Generate breadcrumb items from current path
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Create breadcrumb items
  const breadcrumbs = [
    { label: 'Home', path: '/' },
    ...pathSegments.map((segment, index) => {
      const path = '/' + pathSegments.slice(0, index + 1).join('/');
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      return { label, path };
    })
  ];

  // Don't show breadcrumbs on home page
  if (location.pathname === '/') {
    return <div className="h-6" />; // Empty space to maintain layout
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.path} className="flex items-center">
            {index > 0 && (
              <svg
                className="w-4 h-4 mx-2 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-500 dark:text-gray-400 font-medium">
                {breadcrumb.label}
              </span>
            ) : (
              <a
                href={breadcrumb.path}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-200"
                aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
              >
                {breadcrumb.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}