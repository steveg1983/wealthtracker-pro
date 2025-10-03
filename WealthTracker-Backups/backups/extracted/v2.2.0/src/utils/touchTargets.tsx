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

  if (Component === 'button') {
    return (
      <button
        className={touchClasses}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        type="button"
      >
        {children}
      </button>
    );
  }

  const Tag = Component as keyof JSX.IntrinsicElements;
  return (
    <Tag
      className={touchClasses}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </Tag>
  );
}
