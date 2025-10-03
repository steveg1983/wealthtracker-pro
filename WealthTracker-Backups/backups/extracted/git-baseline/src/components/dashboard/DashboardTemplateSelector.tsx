import React, { useState } from 'react';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  CreditCardIcon,
  ClockIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  SparklesIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface DashboardTemplateSelectorProps {
  onClose: () => void;
}

const templateIcons: Record<string, React.ComponentType<any>> = {
  'balanced': Squares2X2Icon,
  'budget-focused': ChartBarIcon,
  'investment-focused': CurrencyDollarIcon,
  'debt-payoff': CreditCardIcon,
  'retirement-planning': ClockIcon,
  'business-owner': BriefcaseIcon,
  'student': AcademicCapIcon,
  'minimalist': SparklesIcon
};

export default function DashboardTemplateSelector({ onClose }: DashboardTemplateSelectorProps): React.JSX.Element {
  const { templates, applyTemplate, layout } = useDashboardLayout();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyTemplate = async (): Promise<void> => {
    if (!selectedTemplate) return;
    
    setIsApplying(true);
    try {
      applyTemplate(selectedTemplate);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to apply template:', error);
      setIsApplying(false);
    }
  };

  const currentTemplateId = templates.find(t => 
    JSON.stringify(t.layout) === JSON.stringify(layout)
  )?.id;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Choose a Dashboard Template
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select a pre-configured layout that matches your financial goals
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
              const Icon = templateIcons[template.id] || Squares2X2Icon;
              const isSelected = selectedTemplate === template.id;
              const isCurrent = currentTemplateId === template.id;
              
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all text-left
                    ${isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                    ${isCurrent ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-800' : ''}
                  `}
                >
                  {isCurrent && (
                    <div className="absolute -top-2 -right-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Current
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected 
                        ? 'bg-blue-100 dark:bg-blue-800' 
                        : 'bg-gray-100 dark:bg-gray-700'
                      }
                    `}>
                      <Icon className={`
                        h-6 w-6
                        ${isSelected 
                          ? 'text-blue-600 dark:text-blue-300' 
                          : 'text-gray-600 dark:text-gray-400'
                        }
                      `} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {template.description}
                      </p>
                      
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Includes:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.layout.widgets.slice(0, 3).map((widget) => (
                            <span
                              key={widget.id}
                              className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            >
                              {widget.title}
                            </span>
                          ))}
                          {template.layout.widgets.length > 3 && (
                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              +{template.layout.widgets.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedTemplate ? (
                <>
                  <span className="font-medium">
                    {templates.find(t => t.id === selectedTemplate)?.name}
                  </span>
                  {' template selected'}
                </>
              ) : (
                'Select a template to preview'
              )}
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplate || isApplying}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md
                  ${selectedTemplate && !isApplying
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isApplying ? 'Applying...' : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}