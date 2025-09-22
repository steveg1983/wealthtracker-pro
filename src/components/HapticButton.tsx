import React from 'react';
import { useHapticFeedback, HapticPattern, HapticPatternType } from '../hooks/useHapticFeedback';

interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hapticPattern?: HapticPatternType;
  hapticDisabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * Button component with haptic feedback
 */
export function HapticButton({
  hapticPattern = HapticPattern.LIGHT,
  hapticDisabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  children,
  disabled,
  ...props
}: HapticButtonProps): React.JSX.Element {
  const { trigger } = useHapticFeedback();

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !hapticDisabled) {
      // Trigger haptic based on variant
      let pattern = hapticPattern;
      if (hapticPattern === HapticPattern.LIGHT) {
        switch (variant) {
          case 'danger':
            pattern = HapticPattern.WARNING;
            break;
          case 'success':
            pattern = HapticPattern.SUCCESS;
            break;
          case 'primary':
            pattern = HapticPattern.MEDIUM;
            break;
          default:
            pattern = HapticPattern.LIGHT;
        }
      }
      
      await trigger(pattern);
    }
    
    onClick?.(e);
  };

  // Base classes
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'active:scale-95', // Subtle press animation
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
  ];

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  // Variant classes
  const variantClasses = {
    primary: [
      'bg-gray-600 text-white',
      'hover:bg-gray-700 focus:ring-gray-500',
      'dark:bg-gray-500 dark:hover:bg-gray-600'
    ],
    secondary: [
      'bg-gray-200 text-gray-900',
      'hover:bg-gray-300 focus:ring-gray-500',
      'dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
    ],
    danger: [
      'bg-red-600 text-white',
      'hover:bg-red-700 focus:ring-red-500',
      'dark:bg-red-500 dark:hover:bg-red-600'
    ],
    success: [
      'bg-green-600 text-white',
      'hover:bg-green-700 focus:ring-green-500',
      'dark:bg-green-500 dark:hover:bg-green-600'
    ],
    ghost: [
      'bg-transparent text-gray-700',
      'hover:bg-gray-100 focus:ring-gray-500',
      'dark:text-gray-300 dark:hover:bg-gray-800'
    ]
  };

  const classes = [
    ...baseClasses,
    sizeClasses[size],
    ...variantClasses[variant],
    className
  ].join(' ');

  return (
    <button
      {...props}
      className={classes}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/**
 * Haptic Toggle Button
 */
export function HapticToggle({
  checked,
  onChange,
  label,
  hapticDisabled = false,
  className = '',
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { trigger } = useHapticFeedback();

  const handleToggle = async () => {
    if (!disabled && !hapticDisabled) {
      // Different haptic for on/off
      await trigger(checked ? HapticPattern.LIGHT : HapticPattern.MEDIUM);
    }
    
    onChange(!checked);
  };

  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
        checked ? 'bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={handleToggle}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={label}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/**
 * Haptic Slider
 */
export function HapticSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  hapticSteps = 10,
  hapticDisabled = false,
  className = '',
  disabled = false
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hapticSteps?: number;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { trigger } = useHapticFeedback();
  const lastHapticValue = React.useRef(value);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    
    if (!disabled && !hapticDisabled) {
      // Trigger haptic every N steps
      const stepSize = (max - min) / hapticSteps;
      const currentStep = Math.floor((newValue - min) / stepSize);
      const lastStep = Math.floor((lastHapticValue.current - min) / stepSize);
      
      if (currentStep !== lastStep) {
        await trigger(HapticPattern.SELECTION);
        lastHapticValue.current = newValue;
      }
    }
    
    onChange(newValue);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    />
  );
}

/**
 * Haptic Card - Pressable card with haptic feedback
 */
export function HapticCard({
  children,
  onClick,
  hapticPattern = HapticPattern.LIGHT,
  hapticDisabled = false,
  className = '',
  disabled = false
}: {
  children: React.ReactNode;
  onClick?: () => void;
  hapticPattern?: HapticPatternType;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { trigger } = useHapticFeedback();

  const handleClick = async () => {
    if (!disabled && !hapticDisabled && onClick) {
      await trigger(hapticPattern);
      onClick();
    }
  };

  const classes = [
    'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700',
    'transition-all duration-200',
    onClick && !disabled ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : '',
    disabled ? 'opacity-50' : '',
    className
  ].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={handleClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

/**
 * Haptic Settings Panel
 */
export function HapticSettings() {
  const { isAvailable, isEnabled, setEnabled, trigger } = useHapticFeedback();

  if (!isAvailable) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Haptic feedback is not available on this device.
        </p>
      </div>
    );
  }

  const testHaptic = async (pattern: HapticPatternType) => {
    await trigger(pattern, { force: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Haptic Feedback
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Feel subtle vibrations for button presses and interactions
          </p>
        </div>
        <HapticToggle
          checked={isEnabled}
          onChange={setEnabled}
          label="Enable haptic feedback"
        />
      </div>

      {isEnabled && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Test Haptic Patterns
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <HapticButton
              size="sm"
              variant="ghost"
              onClick={() => testHaptic(HapticPattern.LIGHT)}
              hapticDisabled
            >
              Light
            </HapticButton>
            <HapticButton
              size="sm"
              variant="ghost"
              onClick={() => testHaptic(HapticPattern.MEDIUM)}
              hapticDisabled
            >
              Medium
            </HapticButton>
            <HapticButton
              size="sm"
              variant="ghost"
              onClick={() => testHaptic(HapticPattern.HEAVY)}
              hapticDisabled
            >
              Heavy
            </HapticButton>
            <HapticButton
              size="sm"
              variant="ghost"
              onClick={() => testHaptic(HapticPattern.SUCCESS)}
              hapticDisabled
            >
              Success
            </HapticButton>
          </div>
        </div>
      )}
    </div>
  );
}