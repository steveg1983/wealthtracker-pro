import React from 'react';
import { ExternalLinkIcon } from '../icons';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

/**
 * Accessible external link component that:
 * - Opens in new window/tab
 * - Has proper security attributes
 * - Indicates to screen readers that it opens in a new window
 * - Optionally shows an icon
 */
export function ExternalLink({ 
  href, 
  children, 
  className = 'text-blue-600 dark:text-blue-400 hover:underline',
  showIcon = true 
}: ExternalLinkProps): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={`${children} (opens in new window)`}
    >
      {children}
      {showIcon && (
        <ExternalLinkIcon 
          size={14} 
          className="inline-block" 
          aria-hidden="true"
        />
      )}
      <span className="sr-only">(opens in new window)</span>
    </a>
  );
}