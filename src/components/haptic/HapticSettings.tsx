/**
 * Haptic Settings Component
 * World-class settings panel for haptic feedback configuration
 */

import React, { useEffect, memo, useCallback } from 'react';
import { useHapticFeedback, HapticPattern, HapticPatternType } from '../../hooks/useHapticFeedback';
import { HapticToggle } from './HapticToggle';
import { hapticButtonService } from '../../services/haptic/hapticButtonService';
import { logger } from '../../services/loggingService';

/**
 * Premium haptic settings panel
 */
export const HapticSettings = memo(function HapticSettings(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('HapticSettings component initialized', {
      componentName: 'HapticSettings'
    });
  }, []);
  const { isAvailable, isEnabled, setEnabled, trigger } = useHapticFeedback();

  const testHaptic = useCallback(async (pattern: HapticPatternType) => {
    await trigger(pattern, { force: true });
  }, [trigger]);

  if (!isAvailable) {
    return <UnavailableState />;
  }

  return (
    <div className="space-y-4">
      <SettingsHeader isEnabled={isEnabled} onToggle={setEnabled} />
      {isEnabled && <TestPatterns onTest={testHaptic} />}
    </div>
  );
});

/**
 * Unavailable state
 */
const UnavailableState = memo(function UnavailableState(): React.JSX.Element {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
        Haptic feedback is not available on this device.
      </p>
    </div>
  );
});

/**
 * Settings header
 */
const SettingsHeader = memo(function SettingsHeader({
  isEnabled,
  onToggle
}: {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}): React.JSX.Element {
  return (
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
        onChange={onToggle}
        label="Enable haptic feedback"
      />
    </div>
  );
});

/**
 * Test patterns section
 */
const TestPatterns = memo(function TestPatterns({
  onTest
}: {
  onTest: (pattern: HapticPatternType) => void;
}): React.JSX.Element {
  const patterns = hapticButtonService.getTestPatterns();

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Test Haptic Patterns
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {patterns.map(({ pattern, label }) => (
          <TestButton
            key={pattern}
            pattern={pattern}
            label={label}
            onTest={onTest}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * Test button
 */
const TestButton = memo(function TestButton({
  pattern,
  label,
  onTest
}: {
  pattern: HapticPatternType;
  label: string;
  onTest: (pattern: HapticPatternType) => void;
}): React.JSX.Element {
  const handleClick = useCallback(() => {
    onTest(pattern);
  }, [pattern, onTest]);

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 text-sm bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      {label}
    </button>
  );
});
