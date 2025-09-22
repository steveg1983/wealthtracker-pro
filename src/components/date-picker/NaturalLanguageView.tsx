import React, { useEffect, memo, useState, useRef } from 'react';
import { CheckIcon, SparklesIcon } from '../icons';
import { useNaturalLanguageParser } from './useNaturalLanguageParser';
import type { DateRange } from './dateRangePresets';
import { useLogger } from '../services/ServiceProvider';

interface NaturalLanguageViewProps {
  onChange: (range: DateRange) => void;
  onClose: () => void;
}

export const NaturalLanguageView = memo(function NaturalLanguageView({ onChange,
  onClose
 }: NaturalLanguageViewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NaturalLanguageView component initialized', {
      componentName: 'NaturalLanguageView'
    });
  }, []);

  const [naturalInput, setNaturalInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { parseNaturalLanguage } = useNaturalLanguageParser();

  const applyNaturalLanguage = () => {
    const parsed = parseNaturalLanguage(naturalInput);
    if (parsed) {
      onChange(parsed);
      onClose();
      setNaturalInput('');
    }
  };

  const examples = [
    'last 30 days',
    'this month',
    'last quarter',
    'january 2024',
    'between jan 1 and jan 31',
    'yesterday',
    'last year'
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon size={16} className="text-purple-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Natural Language Input
          </span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={naturalInput}
          onChange={(e) => setNaturalInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyNaturalLanguage()}
          placeholder="Try: 'last 30 days', 'this month', 'january 2024', 'between jan 1 and jan 31'"
          className="w-full px-4 py-3 bg-blue-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          autoFocus
        />
      </div>
      
      <div className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">Examples:</p>
        <div className="grid grid-cols-2 gap-2">
          {examples.map(example => (
            <button
              key={example}
              onClick={() => {
                const parsed = parseNaturalLanguage(example);
                if (parsed) {
                  onChange(parsed);
                  onClose();
                }
              }}
              className="text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              "{example}"
            </button>
          ))}
        </div>
      </div>
      
      {naturalInput && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={applyNaturalLanguage}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <CheckIcon size={16} />
            Apply
          </button>
        </div>
      )}
    </div>
  );
});