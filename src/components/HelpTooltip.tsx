/**
 * HelpTooltip Component - Contextual help tooltips
 *
 * Features:
 * - Hover and click-to-show tooltips
 * - Rich content support (text, links, images)
 * - Positioning options
 * - Accessibility compliant
 * - Mobile-friendly
 */

import React, { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  trigger?: 'hover' | 'click';
  maxWidth?: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export default function HelpTooltip({
  content,
  title,
  position = 'auto',
  trigger = 'hover',
  maxWidth = '300px',
  className = '',
  children,
  disabled = false
}: HelpTooltipProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Calculate optimal position
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let optimalPosition: 'top' | 'bottom' | 'left' | 'right' = position as any;

    if (position === 'auto') {
      // Determine best position based on available space
      const spaceTop = triggerRect.top;
      const spaceBottom = viewport.height - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewport.width - triggerRect.right;

      const tooltipHeight = tooltipRect.height || 100; // Fallback estimate
      const tooltipWidth = tooltipRect.width || 200; // Fallback estimate

      // Prefer top/bottom first, then left/right
      if (spaceBottom >= tooltipHeight) {
        optimalPosition = 'bottom';
      } else if (spaceTop >= tooltipHeight) {
        optimalPosition = 'top';
      } else if (spaceRight >= tooltipWidth) {
        optimalPosition = 'right';
      } else if (spaceLeft >= tooltipWidth) {
        optimalPosition = 'left';
      } else {
        // Fallback to position with most space
        const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
        if (maxSpace === spaceBottom) optimalPosition = 'bottom';
        else if (maxSpace === spaceTop) optimalPosition = 'top';
        else if (maxSpace === spaceRight) optimalPosition = 'right';
        else optimalPosition = 'left';
      }
    }

    setActualPosition(optimalPosition);
  }, [isVisible, position]);

  // Handle click outside to close tooltip
  useEffect(() => {
    if (trigger !== 'click' || !isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        tooltipRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [trigger, isVisible]);

  // Handle escape key to close tooltip
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible]);

  const handleTriggerEvent = (event: React.MouseEvent) => {
    if (disabled) return;

    if (trigger === 'click') {
      event.preventDefault();
      setIsVisible(!isVisible);
    }
  };

  const handleMouseEnter = () => {
    if (disabled || trigger !== 'hover') return;
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (disabled || trigger !== 'hover') return;
    setIsVisible(false);
  };

  const getTooltipPosition = () => {
    const baseClasses = 'absolute z-50 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg';

    switch (actualPosition) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const arrowBase = 'absolute w-2 h-2 bg-gray-900 dark:bg-gray-100 transform rotate-45';

    switch (actualPosition) {
      case 'top':
        return `${arrowBase} top-full left-1/2 -translate-x-1/2 -mt-1`;
      case 'bottom':
        return `${arrowBase} bottom-full left-1/2 -translate-x-1/2 -mb-1`;
      case 'left':
        return `${arrowBase} left-full top-1/2 -translate-y-1/2 -ml-1`;
      case 'right':
        return `${arrowBase} right-full top-1/2 -translate-y-1/2 -mr-1`;
      default:
        return `${arrowBase} top-full left-1/2 -translate-x-1/2 -mt-1`;
    }
  };

  if (disabled) {
    return <>{children || <DefaultTrigger />}</>;
  }

  return (
    <div className={`relative inline-block ${className}`} ref={triggerRef}>
      {/* Trigger */}
      <div
        onClick={handleTriggerEvent}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${trigger === 'click' ? 'cursor-pointer' : ''}`}
        role={trigger === 'click' ? 'button' : undefined}
        tabIndex={trigger === 'click' ? 0 : undefined}
        onKeyDown={(e) => {
          if (trigger === 'click' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsVisible(!isVisible);
          }
        }}
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children || <DefaultTrigger />}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={getTooltipPosition()}
          style={{ maxWidth }}
        >
          {/* Arrow */}
          <div className={getArrowClasses()}></div>

          {/* Content */}
          <div>
            {title && (
              <div className="font-semibold mb-1 text-white dark:text-gray-900">
                {title}
              </div>
            )}
            <div className="text-white dark:text-gray-900">
              {typeof content === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                content
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Default help icon trigger
function DefaultTrigger(): React.JSX.Element {
  return (
    <div className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors duration-200">
      <span>?</span>
    </div>
  );
}

// Convenience wrapper for common help scenarios
interface QuickHelpProps {
  text: string;
  title?: string;
  className?: string;
}

export function QuickHelp({ text, title, className }: QuickHelpProps): React.JSX.Element {
  return (
    <HelpTooltip
      content={text}
      title={title}
      trigger="hover"
      position="auto"
      className={className}
    />
  );
}

// Wrapper for inline help within forms
interface InlineHelpProps {
  children: React.ReactNode;
  helpText: string;
  helpTitle?: string;
}

export function InlineHelp({ children, helpText, helpTitle }: InlineHelpProps): React.JSX.Element {
  return (
    <div className="flex items-center space-x-2">
      {children}
      <HelpTooltip
        content={helpText}
        title={helpTitle}
        trigger="hover"
        position="auto"
      />
    </div>
  );
}

// Wrapper for help buttons
interface HelpButtonProps {
  content: string | React.ReactNode;
  title?: string;
  buttonText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HelpButton({
  content,
  title,
  buttonText = 'Help',
  size = 'md'
}: HelpButtonProps): React.JSX.Element {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <HelpTooltip
      content={content}
      title={title}
      trigger="click"
      position="auto"
    >
      <button
        type="button"
        className={`${sizeClasses[size]} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200 font-medium`}
      >
        {buttonText}
      </button>
    </HelpTooltip>
  );
}