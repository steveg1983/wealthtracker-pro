/**
 * Layout Templates Service
 * Manages dashboard layout templates and configurations
 */

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layouts {
  lg: LayoutItem[];
  md?: LayoutItem[];
  sm?: LayoutItem[];
  xs?: LayoutItem[];
  xxs?: LayoutItem[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  widgets: string[];
  layouts: { lg: LayoutItem[] };
  category: 'personal' | 'professional' | 'minimalist' | 'advanced';
}

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isVisible: boolean;
  settings: Record<string, any>;
}

class LayoutTemplatesService {
  /**
   * Get predefined layout templates
   */
  getTemplates(): LayoutTemplate[] {
    return [
      {
        id: 'minimalist',
        name: 'Minimalist',
        description: 'Clean and simple layout focusing on essential information',
        icon: null, // Icons will be provided by component
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
        icon: null,
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
        icon: null,
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
        icon: null,
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
        icon: null,
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
        icon: null,
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
        icon: null,
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
  }

  /**
   * Get category color classes
   */
  getCategoryColor(category: string): string {
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
  }

  /**
   * Create widget instances from template
   */
  createWidgetInstances(widgets: string[]): WidgetInstance[] {
    return widgets.map(widgetType => ({
      id: widgetType,
      type: widgetType,
      title: this.formatWidgetTitle(widgetType),
      size: 'medium' as const,
      isVisible: true,
      settings: {}
    }));
  }

  /**
   * Format widget type to title
   */
  formatWidgetTitle(widgetType: string): string {
    return widgetType
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate responsive layouts from base layout
   */
  generateResponsiveLayouts(baseLayout: LayoutItem[]): Layouts {
    return {
      lg: baseLayout,
      md: baseLayout, // Use same layout for medium
      sm: baseLayout.map((item) => ({ 
        ...item, 
        w: Math.min(item.w, 6) 
      })), // Adjust for small
      xs: baseLayout.map((item, index) => ({ 
        ...item, 
        w: 4, 
        x: 0,
        y: index * 2 
      })), // Stack for extra small
      xxs: baseLayout.map((item, index) => ({ 
        ...item, 
        w: 2, 
        x: 0,
        y: index * 2 
      })) // Stack for mobile
    };
  }

  /**
   * Apply template to dashboard
   */
  applyTemplate(template: LayoutTemplate): {
    widgets: WidgetInstance[];
    layouts: Layouts;
  } {
    const widgetInstances = this.createWidgetInstances(template.widgets);
    const responsiveLayouts = this.generateResponsiveLayouts(template.layouts.lg);

    return {
      widgets: widgetInstances,
      layouts: responsiveLayouts
    };
  }

  /**
   * Process template for application
   */
  processTemplateForApplication(template: LayoutTemplate): {
    widgets: WidgetInstance[];
    layouts: Layouts;
  } {
    return this.applyTemplate(template);
  }

  /**
   * Format widget name for display
   */
  formatWidgetName(widgetId: string): string {
    return this.formatWidgetTitle(widgetId);
  }

  /**
   * Get widget preview text
   */
  getWidgetPreview(widgets: string[]): { visible: string[]; remaining: number } {
    const maxVisible = 3;
    const visible = widgets.slice(0, maxVisible);
    const remaining = Math.max(0, widgets.length - maxVisible);
    
    return {
      visible,
      remaining
    };
  }

}

export const layoutTemplatesService = new LayoutTemplatesService();