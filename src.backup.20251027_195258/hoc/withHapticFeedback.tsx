import React from 'react';
import type { MouseEventHandler } from 'react';
import useHapticFeedback, {
  HAPTIC_PATTERN,
  type HapticOptions,
  type HapticPattern,
} from '../hooks/useHapticFeedback';

interface WithHapticConfig {
  defaultPattern?: HapticPattern;
}

type HapticProps = {
  hapticPattern?: HapticPattern;
  hapticOptions?: HapticOptions;
  hapticDisabled?: boolean;
};

export function withHapticFeedback<P extends { onClick?: MouseEventHandler<unknown> }>(
  Component: React.ComponentType<P>,
  config: WithHapticConfig = {}
) {
  const { defaultPattern = HAPTIC_PATTERN.LIGHT } = config;

  const HapticEnhancedComponent: React.FC<P & HapticProps> = ({
    hapticPattern = defaultPattern,
    hapticOptions = {},
    hapticDisabled = false,
    onClick,
    ...rest
  }) => {
    const { trigger } = useHapticFeedback();

    const handleClick: MouseEventHandler<unknown> = event => {
      if (!hapticDisabled) {
        void trigger(hapticPattern, hapticOptions);
      }
      onClick?.(event);
    };

    return <Component {...(rest as P)} onClick={handleClick as P['onClick']} />;
  };

  HapticEnhancedComponent.displayName = `withHapticFeedback(${Component.displayName ?? Component.name ?? 'Component'})`;

  return HapticEnhancedComponent;
}
