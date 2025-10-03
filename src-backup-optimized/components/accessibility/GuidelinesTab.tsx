import React, { useEffect, memo } from 'react';
import { 
  EyeIcon, 
  KeyboardIcon, 
  InfoIcon, 
  TagIcon 
} from '../icons';
import { accessibleColorClasses } from '../../design-system/accessible-colors';
import { useLogger } from '../services/ServiceProvider';

const GuidelinesTab = memo(function GuidelinesTab(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GuidelinesTab component initialized', {
      componentName: 'GuidelinesTab'
    });
  }, []);
  const guidelines = [
    {
      icon: EyeIcon,
      title: 'Perceivable',
      items: [
        'Provide text alternatives for non-text content',
        'Ensure sufficient color contrast (4.5:1 for normal text)',
        'Make content adaptable to different presentations',
        'Use more than color alone to convey information'
      ]
    },
    {
      icon: KeyboardIcon,
      title: 'Operable',
      items: [
        'Make all functionality keyboard accessible',
        'Provide users enough time to read content',
        "Don't use content that causes seizures",
        'Help users navigate and find content'
      ]
    },
    {
      icon: InfoIcon,
      title: 'Understandable',
      items: [
        'Make text readable and understandable',
        'Make web pages appear and operate predictably',
        'Help users avoid and correct mistakes',
        'Label all form inputs clearly'
      ]
    },
    {
      icon: TagIcon,
      title: 'Robust',
      items: [
        'Use valid, well-structured HTML',
        'Ensure compatibility with assistive technologies',
        'Use ARIA attributes appropriately',
        'Provide name, role, and value for all UI components'
      ]
    }
  ];

  const testingTools = [
    'Use keyboard navigation (Tab, Shift+Tab, Enter, Space, Arrow keys)',
    'Test with screen readers (NVDA, JAWS, VoiceOver)',
    'Check color contrast with browser DevTools',
    'Use automated tools like axe DevTools',
    'Test with browser zoom at 200%',
    'Disable CSS to check content structure'
  ];

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-lg ${accessibleColorClasses['bg-secondary']} ${accessibleColorClasses['border-default']} border`}>
        <h3 className={`text-lg font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
          WCAG 2.1 AA Guidelines
        </h3>
        
        <div className="space-y-4">
          {guidelines.map((guideline) => {
            const Icon = guideline.icon;
            return (
              <div key={guideline.title}>
                <h4 className={`font-medium mb-2 flex items-center gap-2 ${accessibleColorClasses['text-primary']}`}>
                  <Icon className="h-5 w-5" />
                  {guideline.title}
                </h4>
                <ul className={`space-y-1 text-sm ${accessibleColorClasses['text-secondary']} list-disc list-inside`}>
                  {guideline.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`p-6 rounded-lg ${accessibleColorClasses['bg-secondary']} ${accessibleColorClasses['border-default']} border`}>
        <h3 className={`font-semibold mb-3 ${accessibleColorClasses['text-primary']}`}>
          Testing Tools
        </h3>
        <ul className={`space-y-2 text-sm ${accessibleColorClasses['text-secondary']}`}>
          {testingTools.map((tool, index) => (
            <li key={index}>• {tool}</li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default GuidelinesTab;