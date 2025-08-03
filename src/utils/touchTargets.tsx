/**
 * Touch target optimization utilities
 * Ensures interactive elements meet minimum size requirements for mobile usability
 */

// Minimum touch target size in pixels (44x44 as per Apple HIG and Google Material Design)
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * CSS classes for ensuring minimum touch target sizes
 */
export const touchTargetClasses = {
  // Base touch target class - ensures minimum 44x44px
  base: 'min-w-[44px] min-h-[44px] touch-target',
  
  // Touch target with padding for smaller icons/text
  withPadding: 'p-2.5', // 10px padding = 44px total with 24px icon
  
  // Invisible expanded touch target for small elements
  expanded: 'relative after:absolute after:inset-0 after:-m-1.5 after:content-[""]',
  
  // Touch-friendly button sizes
  button: {
    sm: 'px-4 py-2.5 min-h-[44px]', // Small button with touch-friendly height
    md: 'px-5 py-3 min-h-[44px]',   // Medium button
    lg: 'px-6 py-3.5 min-h-[48px]', // Large button
  },
  
  // Touch-friendly icon button
  iconButton: 'w-11 h-11 flex items-center justify-center', // 44x44px
  
  // Touch-friendly input fields
  input: 'h-11 px-3', // 44px height
  
  // Touch-friendly list items
  listItem: 'min-h-[44px] py-3',
};

/**
 * Hook to ensure touch target compliance
 */
export function useTouchTarget(className?: string): string {
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;
  
  if (!isMobile) {
    return className || '';
  }
  
  // Combine provided classes with touch target base
  return `${touchTargetClasses.base} ${className || ''}`;
}

/**
 * Component wrapper to ensure touch target compliance
 */
interface TouchTargetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export function TouchTarget({
  children,
  className = '',
  onClick,
  disabled,
  as: Component = 'button'
}: TouchTargetProps): React.JSX.Element {
  const touchClasses = useTouchTarget(className);
  
  const props = {
    className: touchClasses,
    onClick: disabled ? undefined : onClick,
    disabled,
    type: Component === 'button' ? 'button' as const : undefined
  };
  
  return <Component {...props}>{children}</Component>;
}