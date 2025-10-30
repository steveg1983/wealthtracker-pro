import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from './icons';
import { checkHeadingHierarchy } from '../utils/accessibility-fixes';
import { Decimal, formatPercentageFromRatio } from '@wealthtracker/utils';

interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  wcag: string;
  check: () => { passed: boolean; details?: string };
}

export default function AccessibilityChecklist(): React.JSX.Element {
  const [results, setResults] = useState<Record<string, { passed: boolean; details?: string }>>({});
  const [isChecking, setIsChecking] = useState(false);

  const checklist: ChecklistItem[] = [
    {
      id: 'skip-links',
      category: 'Navigation',
      description: 'Skip navigation links are present',
      wcag: '2.4.1',
      check: () => {
        const skipLinks = document.querySelectorAll('[href^="#"][class*="skip"], .skip-link');
        return { 
          passed: skipLinks.length > 0,
          details: `Found ${skipLinks.length} skip link(s)`
        };
      }
    },
    {
      id: 'page-title',
      category: 'Navigation',
      description: 'Page has a descriptive title',
      wcag: '2.4.2',
      check: () => {
        const title = document.title;
        return { 
          passed: title.length > 0 && title !== 'Document',
          details: `Title: "${title}"`
        };
      }
    },
    {
      id: 'focus-visible',
      category: 'Navigation',
      description: 'Focus indicators are visible',
      wcag: '2.4.7',
      check: () => {
        const hasCustomFocus = document.querySelector('style')?.textContent?.includes('focus:') || 
                              document.querySelector('[class*="focus:"]');
        return { 
          passed: !!hasCustomFocus,
          details: hasCustomFocus ? 'Custom focus styles detected' : 'No custom focus styles found'
        };
      }
    },
    {
      id: 'heading-hierarchy',
      category: 'Structure',
      description: 'Proper heading hierarchy',
      wcag: '1.3.1',
      check: () => {
        const result = checkHeadingHierarchy();
        return { 
          passed: result.valid,
          details: result.issues.join('; ') || 'Heading hierarchy is correct'
        };
      }
    },
    {
      id: 'landmarks',
      category: 'Structure',
      description: 'ARIA landmarks are present',
      wcag: '1.3.1',
      check: () => {
        const main = document.querySelector('main, [role="main"]');
        const nav = document.querySelector('nav, [role="navigation"]');
        const header = document.querySelector('header, [role="banner"]');
        
        const landmarks = [];
        if (main) landmarks.push('main');
        if (nav) landmarks.push('navigation');
        if (header) landmarks.push('header');
        
        return { 
          passed: landmarks.length >= 2,
          details: `Found landmarks: ${landmarks.join(', ') || 'none'}`
        };
      }
    },
    {
      id: 'images-alt',
      category: 'Images',
      description: 'All images have alt text',
      wcag: '1.1.1',
      check: () => {
        const images = document.querySelectorAll('img');
        const withoutAlt = Array.from(images).filter(img => !img.hasAttribute('alt'));
        return { 
          passed: withoutAlt.length === 0,
          details: withoutAlt.length > 0 
            ? `${withoutAlt.length} image(s) missing alt text`
            : `All ${images.length} images have alt text`
        };
      }
    },
    {
      id: 'form-labels',
      category: 'Forms',
      description: 'Form inputs have labels',
      wcag: '3.3.2',
      check: () => {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        const unlabeled = Array.from(inputs).filter(input => {
          const id = input.getAttribute('id');
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.hasAttribute('aria-label');
          return !hasLabel && !hasAriaLabel;
        });
        
        return { 
          passed: unlabeled.length === 0,
          details: unlabeled.length > 0
            ? `${unlabeled.length} input(s) missing labels`
            : `All ${inputs.length} inputs have labels`
        };
      }
    },
    {
      id: 'button-labels',
      category: 'Interactive',
      description: 'Buttons have accessible names',
      wcag: '4.1.2',
      check: () => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        const unlabeled = Array.from(buttons).filter(button => {
          const text = button.textContent?.trim();
          const ariaLabel = button.getAttribute('aria-label');
          return !text && !ariaLabel;
        });
        
        return { 
          passed: unlabeled.length === 0,
          details: unlabeled.length > 0
            ? `${unlabeled.length} button(s) missing accessible names`
            : `All ${buttons.length} buttons have accessible names`
        };
      }
    },
    {
      id: 'color-contrast',
      category: 'Visual',
      description: 'Sufficient color contrast',
      wcag: '1.4.3',
      check: () => {
        // This is a simplified check
        const lowContrastClasses = ['text-gray-400', 'text-gray-300', 'text-gray-200'];
        const elements = lowContrastClasses.flatMap(cls => 
          Array.from(document.getElementsByClassName(cls))
        );
        
        return { 
          passed: elements.length === 0,
          details: elements.length > 0
            ? `${elements.length} elements may have low contrast`
            : 'No obvious contrast issues detected'
        };
      }
    },
    {
      id: 'touch-targets',
      category: 'Mobile',
      description: 'Touch targets are 44x44 pixels',
      wcag: '2.5.5',
      check: () => {
        const interactive = document.querySelectorAll('button, a, input, select, textarea');
        const tooSmall = Array.from(interactive).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        });
        
        return { 
          passed: tooSmall.length === 0,
          details: tooSmall.length > 0
            ? `${tooSmall.length} elements below minimum touch target size`
            : `All ${interactive.length} interactive elements meet size requirements`
        };
      }
    }
  ];

  const runChecklist = async () => {
    setIsChecking(true);
    const newResults: Record<string, { passed: boolean; details?: string }> = {};
    
    for (const item of checklist) {
      try {
        newResults[item.id] = item.check();
      } catch (error) {
        newResults[item.id] = { 
          passed: false, 
          details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
    
    setResults(newResults);
    setIsChecking(false);
  };

  const getIcon = (passed?: boolean) => {
    if (passed === undefined) return <AlertCircle size={20} className="text-gray-400" />;
    return passed 
      ? <CheckCircle size={20} className="text-green-600" />
      : <XCircle size={20} className="text-red-600" />;
  };

  const getStats = () => {
    const total = checklist.length;
    const checked = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r.passed).length;
    const failed = checked - passed;
    
    return { total, checked, passed, failed };
  };

  const stats = getStats();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Accessibility Checklist
        </h2>
        <button
          onClick={runChecklist}
          disabled={isChecking}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'Run Checklist'}
        </button>
      </div>

      {stats.checked > 0 && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.checked > 0
                ? formatPercentageFromRatio(
                    new Decimal(stats.passed ?? 0).dividedBy(stats.checked ?? 1),
                    0
                  )
                : '0%'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Score</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checklist.map((item) => {
          const result = results[item.id];
          return (
            <div
              key={item.id}
              className={`p-4 rounded-lg border ${
                result === undefined
                  ? 'border-gray-200 dark:border-gray-700'
                  : result.passed
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
              }`}
            >
              <div className="flex items-start gap-3">
                {getIcon(result?.passed)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {item.description}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      WCAG {item.wcag}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {item.category}
                  </div>
                  {result?.details && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      {result.details}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
