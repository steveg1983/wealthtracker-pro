import React, { useEffect, useState } from 'react';
import { KeyboardIcon } from './icons';

interface KeyboardSequenceIndicatorProps {
  activeSequence: string | null;
}

export default function KeyboardSequenceIndicator({ activeSequence }: KeyboardSequenceIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (activeSequence) {
      setIsVisible(true);
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [activeSequence]);

  if (!isVisible || !activeSequence) return null;

  const getSequenceText = () => {
    switch (activeSequence) {
      case 'g':
        return 'Go to... (press H/D/A/T/I/B/G/R/S)';
      case 'n':
        return 'New... (press T/A/G/B)';
      default:
        return `Waiting for next key...`;
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn">
      <div className="bg-gray-900 dark:bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl flex items-center space-x-3">
        <KeyboardIcon size={20} className="text-primary" />
        <div className="flex items-center space-x-2">
          <kbd className="px-2 py-1 text-sm font-semibold bg-gray-800 dark:bg-gray-700 border border-gray-600 rounded">
            {activeSequence.toUpperCase()}
          </kbd>
          <span className="text-sm">{getSequenceText()}</span>
        </div>
      </div>
    </div>
  );
}