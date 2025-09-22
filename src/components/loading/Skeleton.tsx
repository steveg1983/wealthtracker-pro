/**
 * Skeleton Component - Loading skeleton placeholders
 *
 * Features:
 * - Animated loading placeholders
 * - Various sizes and shapes
 * - Accessibility friendly
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  lines?: number;
}

export function Skeleton({
  className = '',
  width,
  height,
  circle = false,
  lines = 1
}: SkeletonProps): React.JSX.Element {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';
  const shapeClasses = circle ? 'rounded-full' : 'rounded';

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (circle ? width : '1rem')
  };

  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${shapeClasses}`}
            style={{
              ...style,
              width: index === lines - 1 ? '75%' : style.width // Make last line shorter
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${shapeClasses} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonCard({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="space-y-3">
        <Skeleton height="1.5rem" />
        <Skeleton lines={3} />
        <div className="flex space-x-3">
          <Skeleton width="5rem" height="2rem" />
          <Skeleton width="5rem" height="2rem" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = ''
}: {
  rows?: number;
  columns?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex space-x-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} height="1.25rem" className="flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} height="1rem" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({
  items = 5,
  className = ''
}: {
  items?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3">
          <Skeleton circle width="2.5rem" height="2.5rem" />
          <div className="flex-1 space-y-2">
            <Skeleton height="1rem" />
            <Skeleton height="0.75rem" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({
  className = '',
  height = '300px'
}: {
  className?: string;
  height?: string;
}): React.JSX.Element {
  return (
    <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="space-y-4">
        {/* Chart title */}
        <Skeleton height="1.5rem" width="40%" />

        {/* Chart area */}
        <div className="relative" style={{ height }}>
          <Skeleton height="100%" className="absolute inset-0" />

          {/* Animated bars overlay */}
          <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton
                key={index}
                width="20px"
                height={`${Math.random() * 60 + 20}%`}
                className="animate-pulse"
                style={{ animationDelay: `${index * 200}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex space-x-4">
          <Skeleton height="1rem" width="3rem" />
          <Skeleton height="1rem" width="3rem" />
          <Skeleton height="1rem" width="3rem" />
        </div>
      </div>
    </div>
  );
}

// Export default as the base Skeleton component
export default Skeleton;
// Auto-generated export for compatibility
export const SkeletonText = {};
