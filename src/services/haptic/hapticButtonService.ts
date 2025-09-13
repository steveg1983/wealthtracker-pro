/**
 * Haptic Button Service
 * World-class haptic button service with Apple-level refinement
 * Implements material design and iOS principles
 */

import { HapticPattern, HapticPatternType } from '../../hooks/useHapticFeedback';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Enterprise-grade haptic button styling service
 */
class HapticButtonService {
  /**
   * Get haptic pattern for button variant
   */
  getButtonHapticPattern(variant: ButtonVariant, defaultPattern: HapticPatternType): HapticPatternType {
    if (defaultPattern !== HapticPattern.LIGHT) {
      return defaultPattern;
    }

    const variantPatterns: Record<ButtonVariant, HapticPatternType> = {
      danger: HapticPattern.WARNING,
      success: HapticPattern.SUCCESS,
      primary: HapticPattern.MEDIUM,
      secondary: HapticPattern.LIGHT,
      ghost: HapticPattern.LIGHT
    };

    return variantPatterns[variant] || HapticPattern.LIGHT;
  }

  /**
   * Get button base classes
   */
  getButtonBaseClasses(disabled?: boolean): string[] {
    return [
      'inline-flex items-center justify-center',
      'font-medium rounded-lg transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'active:scale-95',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ];
  }

  /**
   * Get button size classes
   */
  getButtonSizeClasses(size: ButtonSize): string {
    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };
    return sizeClasses[size];
  }

  /**
   * Get button variant classes
   */
  getButtonVariantClasses(variant: ButtonVariant): string[] {
    const variantClasses: Record<ButtonVariant, string[]> = {
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
    return variantClasses[variant];
  }

  /**
   * Build complete button class string
   */
  buildButtonClasses(
    variant: ButtonVariant,
    size: ButtonSize,
    disabled?: boolean,
    className?: string
  ): string {
    return [
      ...this.getButtonBaseClasses(disabled),
      this.getButtonSizeClasses(size),
      ...this.getButtonVariantClasses(variant),
      className || ''
    ].join(' ');
  }

  /**
   * Get toggle button classes
   */
  getToggleClasses(checked: boolean, disabled?: boolean, className?: string): string {
    return `relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
      checked ? 'bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className || ''}`;
  }

  /**
   * Get toggle thumb classes
   */
  getToggleThumbClasses(checked: boolean): string {
    return `inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
      checked ? 'translate-x-6' : 'translate-x-1'
    }`;
  }

  /**
   * Get haptic pattern for toggle
   */
  getToggleHapticPattern(checked: boolean): HapticPatternType {
    return checked ? HapticPattern.LIGHT : HapticPattern.MEDIUM;
  }

  /**
   * Calculate slider haptic step
   */
  shouldTriggerSliderHaptic(
    newValue: number,
    lastValue: number,
    min: number,
    max: number,
    hapticSteps: number
  ): boolean {
    const stepSize = (max - min) / hapticSteps;
    const currentStep = Math.floor((newValue - min) / stepSize);
    const lastStep = Math.floor((lastValue - min) / stepSize);
    return currentStep !== lastStep;
  }

  /**
   * Get slider classes
   */
  getSliderClasses(disabled?: boolean, className?: string): string {
    return `w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    } ${className || ''}`;
  }

  /**
   * Get card classes
   */
  getCardClasses(
    hasOnClick: boolean,
    disabled?: boolean,
    className?: string
  ): string {
    return [
      'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700',
      'transition-all duration-200',
      hasOnClick && !disabled ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : '',
      disabled ? 'opacity-50' : '',
      className || ''
    ].filter(Boolean).join(' ');
  }

  /**
   * Get test patterns for settings
   */
  getTestPatterns(): Array<{ pattern: HapticPatternType; label: string }> {
    return [
      { pattern: HapticPattern.LIGHT, label: 'Light' },
      { pattern: HapticPattern.MEDIUM, label: 'Medium' },
      { pattern: HapticPattern.HEAVY, label: 'Heavy' },
      { pattern: HapticPattern.SUCCESS, label: 'Success' }
    ];
  }
}

export const hapticButtonService = new HapticButtonService();