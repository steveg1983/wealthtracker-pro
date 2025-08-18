/**
 * Touch target React components
 * Components for ensuring minimum touch target sizes for mobile usability
 */

import { useTouchTarget, touchTargetClasses } from './touchTargetConstants';

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

export default function TouchTarget({
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