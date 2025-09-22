import React, { useEffect, memo } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useLogger } from '../services/ServiceProvider';

interface HelpMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}

export const HelpMenu = memo(function HelpMenu({ isOpen, onToggle, t  }: HelpMenuProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HelpMenu component initialized', {
      componentName: 'HelpMenu'
    });
  }, []);

  return (
    <div className="help-menu-container relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2 bg-secondary text-white hover:bg-secondary/80 rounded-lg transition-all duration-200 hover:scale-105"
      >
        <QuestionMarkCircleIcon className="w-4 h-4" />
        <span className="text-sm">{t('navigation.help')}</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-[9999]">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('help.getHelp')}</h3>
          
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.showPageTips')}</span>
                <div className="w-12 h-6 bg-gray-200 dark:bg-gray-600 rounded-full relative">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.keyboardShortcuts')}</span>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.visitHelpCenter')}</span>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('help.contactSupport')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});