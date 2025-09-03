import React from 'react';
import { useActivityTracking } from '../hooks/useActivityTracking';

interface ActivityBadgeProps {
  type?: 'transaction' | 'account' | 'budget' | 'goal' | 'sync' | 'system';
  variant?: 'dot' | 'count' | 'both';
  className?: string;
  showIfZero?: boolean;
  max?: number;
}

export default function ActivityBadge({ 
  type,
  variant = 'count',
  className = '',
  showIfZero = false,
  max = 99
}: ActivityBadgeProps): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0 && !showIfZero) {
    return null;
  }

  if (variant === 'dot') {
    return count > 0 ? (
      <span className={`w-2 h-2 bg-red-500 rounded-full ${className}`} />
    ) : null;
  }

  if (variant === 'count') {
    return (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full ${className}`}>
        {count > max ? `${max}+` : count}
      </span>
    );
  }

  // variant === 'both'
  return count > 0 ? (
    <div className={`relative inline-block ${className}`}>
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
        {count > max ? `${max}+` : count}
      </span>
    </div>
  ) : null;
}

// Inline badge for navigation items
export function NavigationBadge({ 
  type,
  className = ''
}: {
  type?: ActivityBadgeProps['type'];
  className?: string;
}): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0) return null;

  return (
    <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-gray-500 rounded-full ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Card badge for dashboard widgets
export function CardBadge({ 
  type,
  position = 'top-right',
  pulse = true
}: {
  type?: ActivityBadgeProps['type'];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  pulse?: boolean;
}): React.JSX.Element | null {
  const { getUnreadCount, getNewSinceLastCheck } = useActivityTracking();
  const count = getUnreadCount(type);
  const newActivities = getNewSinceLastCheck();
  const hasNew = type ? newActivities.some(a => a.type === type) : newActivities.length > 0;

  if (count === 0) return null;

  const positionClasses = {
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2'
  };

  return (
    <div className={`absolute ${positionClasses[position]}`}>
      {pulse && hasNew && (
        <span className="absolute w-full h-full bg-red-500 rounded-full animate-ping" />
      )}
      <span className="relative inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full shadow-lg">
        {count > 99 ? '99+' : count}
      </span>
    </div>
  );
}

// Text badge for inline use
export function InlineBadge({ 
  type,
  prefix = 'New: ',
  className = ''
}: {
  type?: ActivityBadgeProps['type'];
  prefix?: string;
  className?: string;
}): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0) return null;

  return (
    <span className={`text-xs font-medium text-gray-600 dark:text-gray-500 ${className}`}>
      {prefix}{count}
    </span>
  );
}

// Icon badge overlay
export function IconBadge({ 
  children,
  type,
  showDot = false
}: {
  children: React.ReactNode;
  type?: ActivityBadgeProps['type'];
  showDot?: boolean;
}): React.JSX.Element {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  return (
    <div className="relative inline-flex">
      {children}
      {count > 0 && (
        showDot ? (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full" />
        ) : (
          <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {count > 9 ? '9+' : count}
          </span>
        )
      )}
    </div>
  );
}