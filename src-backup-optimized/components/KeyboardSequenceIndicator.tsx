/**
 * KeyboardSequenceIndicator Component - Shows current keyboard sequence
 *
 * Features:
 * - Display current keyboard sequence (like Gmail's G + D)
 * - Auto-hide after timeout
 * - Visual feedback for multi-key sequences
 */

import React, { useState, useEffect } from 'react';

interface KeyboardSequenceIndicatorProps {
  sequence: string[];
  isVisible: boolean;
  onTimeout?: () => void;
  timeout?: number; // in milliseconds
}

export default function KeyboardSequenceIndicator({
  sequence,
  isVisible,
  onTimeout,
  timeout = 2000
}: KeyboardSequenceIndicatorProps): React.JSX.Element {
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    setVisible(isVisible);

    if (isVisible && timeout > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onTimeout?.();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [isVisible, timeout, onTimeout]);

  if (!visible || sequence.length === 0) {
    return <></>;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
        <div className="flex items-center space-x-1">
          <span className="text-sm font-mono">
            {sequence.map((key, index) => (
              <span key={index}>
                {index > 0 && <span className="mx-1 text-gray-300">+</span>}
                <kbd className="px-2 py-1 bg-white/20 rounded text-xs font-mono">
                  {key.toUpperCase()}
                </kbd>
              </span>
            ))}
          </span>
          <span className="text-xs text-gray-300 ml-2">...</span>
        </div>
      </div>
    </div>
  );
}

// Hook for managing keyboard sequences
export function useKeyboardSequence(timeout: number = 2000) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const addToSequence = (key: string) => {
    setSequence(prev => [...prev, key]);
    setIsVisible(true);
  };

  const clearSequence = () => {
    setSequence([]);
    setIsVisible(false);
  };

  const handleTimeout = () => {
    clearSequence();
  };

  return {
    sequence,
    isVisible,
    addToSequence,
    clearSequence,
    handleTimeout,
    SequenceIndicator: () => (
      <KeyboardSequenceIndicator
        sequence={sequence}
        isVisible={isVisible}
        onTimeout={handleTimeout}
        timeout={timeout}
      />
    )
  };
}