import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  XMarkIcon,
  SparklesIcon,
  ChartBarIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  HomeIcon,
  RocketLaunchIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  widgets: string[];
  layouts: any;
  category: 'personal' | 'professional' | 'minimalist' | 'advanced';
}

interface LayoutTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: LayoutTemplate) => void;
}

export default function LayoutTemplatesModal({
  isOpen,
  onClose,
  onSelect
}: LayoutTemplatesModalProps): React.JSX.Element {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const templates: LayoutTemplate[] = [
    {
      id: 'minimalist',
      name: 'Minimalist',
      description: 'Clean and simple layout focusing on essential information',
      icon: <SparklesIcon className="h-8 w-8" />,
      category: 'minimalist',
      widgets: ['net-worth', 'cash-flow', 'recent-transactions', 'budget-summary'],
      layouts: {
        lg: [
          { i: 'net-worth', x: 0, y: 0, w: 6, h: 3 },
          { i: 'cash-flow', x: 6, y: 0, w: 6, h: 3 },
          { i: 'recent-transactions', x: 0, y: 3, w: 6, h: 4 },
          { i: 'budget-summary', x: 6, y: 3, w: 6, h: 4 }
        ]
      }
    },
    {
      id: 'budgeter',
      name: 'Budget Master',
      description: 'Perfect for tracking expenses and staying within budget',
      icon: <ChartBarIcon className="h-8 w-8" />,
      category: 'personal',
      widgets: ['budget-vs-actual', 'expense-breakdown', 'budget-summary', 'bill-reminder', 'upcoming-bills', 'monthly-summary'],
      layouts: {
        lg: [
          { i: 'budget-vs-actual', x: 0, y: 0, w: 8, h: 4 },
          { i: 'monthly-summary', x: 8, y: 0, w: 4, h: 4 },
          { i: 'expense-breakdown', x: 0, y: 4, w: 4, h: 3 },
          { i: 'budget-summary', x: 4, y: 4, w: 4, h: 3 },
          { i: 'bill-reminder', x: 8, y: 4, w: 4, h: 3 },
          { i: 'upcoming-bills', x: 0, y: 7, w: 12, h: 2 }
        ]
      }
    },
    {
      id: 'investor',
      name: 'Investor Pro',
      description: 'Advanced layout for investment tracking and analysis',
      icon: <CurrencyDollarIcon className="h-8 w-8" />,
      category: 'professional',
      widgets: ['investment-summary', 'net-worth', 'cash-flow', 'ai-analytics', 'goal-progress', 'financial-planning'],
      layouts: {
        lg: [
          { i: 'investment-summary', x: 0, y: 0, w: 8, h: 4 },
          { i: 'net-worth', x: 8, y: 0, w: 4, h: 2 },
          { i: 'goal-progress', x: 8, y: 2, w: 4, h: 2 },
          { i: 'cash-flow', x: 0, y: 4, w: 6, h: 3 },
          { i: 'ai-analytics', x: 6, y: 4, w: 6, h: 3 },
          { i: 'financial-planning', x: 0, y: 7, w: 12, h: 3 }
        ]
      }
    },
    {
      id: 'debt-crusher',
      name: 'Debt Crusher',
      description: 'Focus on paying off debt and tracking progress',
      icon: <BanknotesIcon className="h-8 w-8" />,
      category: 'personal',
      widgets: ['debt-tracker', 'budget-vs-actual', 'cash-flow', 'goal-progress', 'monthly-summary'],
      layouts: {
        lg: [
          { i: 'debt-tracker', x: 0, y: 0, w: 6, h: 4 },
          { i: 'goal-progress', x: 6, y: 0, w: 6, h: 2 },
          { i: 'monthly-summary', x: 6, y: 2, w: 6, h: 2 },
          { i: 'budget-vs-actual', x: 0, y: 4, w: 6, h: 3 },
          { i: 'cash-flow', x: 6, y: 4, w: 6, h: 3 }
        ]
      }
    },
    {
      id: 'family-finance',
      name: 'Family Finance',
      description: 'Comprehensive view for managing household finances',
      icon: <HomeIcon className="h-8 w-8" />,
      category: 'personal',
      widgets: ['net-worth', 'budget-summary', 'expense-breakdown', 'bill-reminder', 'goal-progress', 'recent-transactions', 'sync-status'],
      layouts: {
        lg: [
          { i: 'net-worth', x: 0, y: 0, w: 4, h: 2 },
          { i: 'budget-summary', x: 4, y: 0, w: 4, h: 2 },
          { i: 'sync-status', x: 8, y: 0, w: 4, h: 2 },
          { i: 'expense-breakdown', x: 0, y: 2, w: 4, h: 3 },
          { i: 'bill-reminder', x: 4, y: 2, w: 4, h: 3 },
          { i: 'goal-progress', x: 8, y: 2, w: 4, h: 3 },
          { i: 'recent-transactions', x: 0, y: 5, w: 12, h: 3 }
        ]
      }
    },
    {
      id: 'student',
      name: 'Student Budget',
      description: 'Simple tracking for students and young professionals',
      icon: <AcademicCapIcon className="h-8 w-8" />,
      category: 'minimalist',
      widgets: ['monthly-summary', 'weekly-summary', 'expense-breakdown', 'budget-summary', 'recent-transactions'],
      layouts: {
        lg: [
          { i: 'monthly-summary', x: 0, y: 0, w: 6, h: 2 },
          { i: 'weekly-summary', x: 6, y: 0, w: 6, h: 2 },
          { i: 'budget-summary', x: 0, y: 2, w: 6, h: 3 },
          { i: 'expense-breakdown', x: 6, y: 2, w: 6, h: 3 },
          { i: 'recent-transactions', x: 0, y: 5, w: 12, h: 3 }
        ]
      }
    },
    {
      id: 'power-user',
      name: 'Power User',
      description: 'Everything at your fingertips - all widgets enabled',
      icon: <RocketLaunchIcon className="h-8 w-8" />,
      category: 'advanced',
      widgets: [
        'net-worth', 'cash-flow', 'budget-vs-actual', 'debt-tracker',
        'bill-reminder', 'investment-summary', 'ai-analytics', 'data-intelligence',
        'goal-progress', 'recent-transactions', 'expense-breakdown', 'sync-status'
      ],
      layouts: {
        lg: [
          { i: 'net-worth', x: 0, y: 0, w: 3, h: 2 },
          { i: 'cash-flow', x: 3, y: 0, w: 6, h: 2 },
          { i: 'sync-status', x: 9, y: 0, w: 3, h: 2 },
          { i: 'budget-vs-actual', x: 0, y: 2, w: 4, h: 3 },
          { i: 'debt-tracker', x: 4, y: 2, w: 4, h: 3 },
          { i: 'bill-reminder', x: 8, y: 2, w: 4, h: 3 },
          { i: 'investment-summary', x: 0, y: 5, w: 6, h: 3 },
          { i: 'ai-analytics', x: 6, y: 5, w: 3, h: 3 },
          { i: 'data-intelligence', x: 9, y: 5, w: 3, h: 3 },
          { i: 'goal-progress', x: 0, y: 8, w: 4, h: 2 },
          { i: 'expense-breakdown', x: 4, y: 8, w: 4, h: 2 },
          { i: 'recent-transactions', x: 8, y: 8, w: 4, h: 2 }
        ]
      }
    }
  ];
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'minimalist':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'personal':
        return 'bg-blue-100 text-blue-800 dark:bg-gray-900 dark:text-blue-200';
      case 'professional':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleApplyTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      // Create widget instances for the template
      const widgetInstances = template.widgets.map(widgetType => ({
        id: widgetType,
        type: widgetType,
        title: widgetType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        size: 'medium' as const,
        isVisible: true,
        settings: {}
      }));
      
      onSelect({
        ...template,
        widgets: widgetInstances,
        layouts: {
          lg: template.layouts.lg,
          md: template.layouts.lg, // Use same layout for medium
          sm: template.layouts.lg.map((item: any) => ({ ...item, w: Math.min(item.w, 6) })), // Adjust for small
          xs: template.layouts.lg.map((item: any) => ({ ...item, w: 4, x: 0 })), // Stack for extra small
          xxs: template.layouts.lg.map((item: any) => ({ ...item, w: 2, x: 0 })) // Stack for mobile
        }
      } as any);
    }
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                    >
                      Dashboard Layout Templates
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Choose a pre-configured layout that matches your financial management style
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Template Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedTemplate === template.id
                          ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      {selectedTemplate === template.id && (
                        <CheckIcon className="absolute top-4 right-4 h-5 w-5 text-gray-600 dark:text-gray-500" />
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <div className="text-gray-600 dark:text-gray-400">
                          {template.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                            {template.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {template.description}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                              {template.category}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {template.widgets.length} widgets
                            </span>
                          </div>
                          
                          {/* Widget Preview */}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {template.widgets.slice(0, 5).map(widget => (
                              <span 
                                key={widget}
                                className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                              >
                                {widget.replace(/-/g, ' ')}
                              </span>
                            ))}
                            {template.widgets.length > 5 && (
                              <span className="inline-block px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                +{template.widgets.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-between items-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You can customize any template after applying it
                  </p>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleApplyTemplate}
                      disabled={!selectedTemplate}
                    >
                      Apply Template
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}