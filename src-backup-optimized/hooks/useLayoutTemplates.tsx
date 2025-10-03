/**
 * Custom Hook for Layout Templates
 * Manages layout template selection and application
 */

// Converted to .tsx to allow inline icon JSX in template metadata
import { useState, useCallback, useMemo } from 'react';
import { layoutTemplatesService, LayoutTemplate } from '../services/layoutTemplatesService';
import { 
  SparklesIcon,
  ChartBarIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  HomeIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';

export interface UseLayoutTemplatesReturn {
  templates: LayoutTemplate[];
  selectedTemplate: string | null;
  selectedTemplateData: LayoutTemplate | undefined;
  setSelectedTemplate: (id: string | null) => void;
  handleApplyTemplate: () => void;
  getCategoryColor: (category: string) => string;
  formatWidgetName: (widgetId: string) => string;
  getWidgetPreview: (widgets: string[]) => { visible: string[]; remaining: number };
}

export function useLayoutTemplates(
  onSelect: (template: any) => void
): UseLayoutTemplatesReturn {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Define template data
  const templates = useMemo<LayoutTemplate[]>(() => [
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
  ], []);

  // Get selected template data
  const selectedTemplateData = useMemo(
    () => templates.find(t => t.id === selectedTemplate),
    [templates, selectedTemplate]
  );

  // Handle template application
  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplateData) return;
    
    const processedTemplate = layoutTemplatesService.processTemplateForApplication(selectedTemplateData);
    onSelect(processedTemplate);
  }, [selectedTemplateData, onSelect]);

  // Service methods
  const getCategoryColor = useCallback((category: string) => {
    return layoutTemplatesService.getCategoryColor(category);
  }, []);

  const formatWidgetName = useCallback((widgetId: string) => {
    return layoutTemplatesService.formatWidgetName(widgetId);
  }, []);

  const getWidgetPreview = useCallback((widgets: string[]) => {
    return layoutTemplatesService.getWidgetPreview(widgets);
  }, []);

  return {
    templates,
    selectedTemplate,
    selectedTemplateData,
    setSelectedTemplate,
    handleApplyTemplate,
    getCategoryColor,
    formatWidgetName,
    getWidgetPreview
  };
}
