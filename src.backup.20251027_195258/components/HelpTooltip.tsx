import React, { useState } from 'react';
import { InfoIcon, XIcon } from './icons';
import { HELP_CONTENT, type HelpContentKey } from './helpTooltipContent';

interface HelpTooltipProps {
  title: string;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  iconSize?: number;
  showOnHover?: boolean;
}

const HelpTooltip = ({ 
  title, 
  content, 
  position = 'top',
  className = '',
  iconSize = 16,
  showOnHover = true
}: HelpTooltipProps): React.JSX.Element => {
  const [isVisible, setIsVisible] = useState(false);
  
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 -mt-1';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 -mb-1 rotate-180';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 -ml-1 -rotate-90';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 -mr-1 rotate-90';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 -mt-1';
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
        onMouseEnter={() => showOnHover && setIsVisible(true)}
        onMouseLeave={() => showOnHover && setIsVisible(false)}
        onClick={() => !showOnHover && setIsVisible(!isVisible)}
        aria-label={`Help: ${title}`}
      >
        <InfoIcon size={iconSize} />
      </button>
      
      {isVisible && (
        <div 
          className={`absolute z-50 ${getPositionClasses()} pointer-events-none`}
          style={{ minWidth: '250px', maxWidth: '350px' }}
        >
          <div className="bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl p-3 pointer-events-auto border-l-4 border-amber-400 dark:border-amber-600">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm">{title}</h4>
              {!showOnHover && (
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close help tooltip"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
              {content}
            </div>
            {/* Arrow */}
            <div className={`absolute ${getArrowClasses()}`}>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-amber-50 dark:border-t-amber-900/20" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component for inline help icons next to labels
interface InlineHelpProps {
  helpKey: HelpContentKey;
  label: string;
  className?: string;
}

export function InlineHelp({ helpKey, label, className = '' }: InlineHelpProps): React.JSX.Element {
  const help = HELP_CONTENT[helpKey];
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span>{label}</span>
      <HelpTooltip
        title={help.title}
        content={help.content}
        iconSize={14}
        position="top"
      />
    </div>
  );
}

export default HelpTooltip;
