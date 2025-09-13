import { dashboardWidgetService } from './dashboardWidgetService';
import type { Layout } from 'react-grid-layout';

export interface Widget {
  id: string;
  type: string;
  title: string;
  settings?: Record<string, unknown>;
  data?: unknown;
}

export type Layouts = { [key: string]: Layout[] };

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  widgets: Widget[];
  layouts: Layouts;
}

class DashboardV2PageService {
  /**
   * Get responsive breakpoints
   */
  getBreakpoints() {
    return { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  }

  /**
   * Get column configuration
   */
  getColumnConfig() {
    return { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
  }

  /**
   * Get default layout templates
   */
  getDefaultTemplates(): DashboardTemplate[] {
    return [
      {
        id: 'default',
        name: 'Default Layout',
        description: 'Balanced view with key metrics',
        widgets: [],
        layouts: {}
      },
      {
        id: 'compact',
        name: 'Compact View',
        description: 'Maximized screen space usage',
        widgets: [],
        layouts: {}
      },
      {
        id: 'analytics',
        name: 'Analytics Focus',
        description: 'Charts and trends focused layout',
        widgets: [],
        layouts: {}
      },
      {
        id: 'financial',
        name: 'Financial Overview',
        description: 'Budget and spending focused',
        widgets: [],
        layouts: {}
      }
    ];
  }

  /**
   * Get default widgets
   */
  getDefaultWidgets(): Widget[] {
    return [
      {
        id: 'networth-1',
        type: 'netWorth',
        title: 'Net Worth'
      },
      {
        id: 'accounts-1',
        type: 'accounts',
        title: 'Accounts'
      },
      {
        id: 'budget-1',
        type: 'budgetOverview',
        title: 'Budget Overview'
      },
      {
        id: 'transactions-1',
        type: 'recentTransactions',
        title: 'Recent Transactions'
      },
      {
        id: 'cashflow-1',
        type: 'cashFlow',
        title: 'Cash Flow'
      },
      {
        id: 'goals-1',
        type: 'goalsProgress',
        title: 'Goals Progress'
      }
    ];
  }

  /**
   * Get default layout
   */
  getDefaultLayout(): Layouts {
    return {
      lg: [
        { i: 'networth-1', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
        { i: 'accounts-1', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
        { i: 'budget-1', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
        { i: 'transactions-1', x: 0, y: 2, w: 6, h: 3, minW: 4, minH: 2 },
        { i: 'cashflow-1', x: 6, y: 2, w: 6, h: 3, minW: 4, minH: 2 },
        { i: 'goals-1', x: 0, y: 5, w: 12, h: 2, minW: 6, minH: 2 }
      ],
      md: [
        { i: 'networth-1', x: 0, y: 0, w: 5, h: 2 },
        { i: 'accounts-1', x: 5, y: 0, w: 5, h: 2 },
        { i: 'budget-1', x: 0, y: 2, w: 10, h: 2 },
        { i: 'transactions-1', x: 0, y: 4, w: 5, h: 3 },
        { i: 'cashflow-1', x: 5, y: 4, w: 5, h: 3 },
        { i: 'goals-1', x: 0, y: 7, w: 10, h: 2 }
      ],
      sm: [
        { i: 'networth-1', x: 0, y: 0, w: 6, h: 2 },
        { i: 'accounts-1', x: 0, y: 2, w: 6, h: 2 },
        { i: 'budget-1', x: 0, y: 4, w: 6, h: 2 },
        { i: 'transactions-1', x: 0, y: 6, w: 6, h: 3 },
        { i: 'cashflow-1', x: 0, y: 9, w: 6, h: 3 },
        { i: 'goals-1', x: 0, y: 12, w: 6, h: 2 }
      ]
    };
  }

  /**
   * Load dashboard layout
   */
  async loadDashboardLayout(userId: string | null) {
    if (userId) {
      // Load from database
      const savedLayout = await dashboardWidgetService.getLayout(userId);
      if (savedLayout) {
        return {
          widgets: savedLayout.widgets || this.getDefaultWidgets(),
          layouts: savedLayout.layouts || this.getDefaultLayout()
        };
      }
    }
    
    // Return defaults
    return {
      widgets: this.getDefaultWidgets(),
      layouts: this.getDefaultLayout()
    };
  }

  /**
   * Save dashboard layout
   */
  async saveDashboardLayout(userId: string, widgets: Widget[], layouts: Layouts): Promise<void> {
    await dashboardWidgetService.saveLayout(userId, {
      name: 'Default Layout',
      layoutConfig: layouts,
      widgets
    });
  }

  /**
   * Export layout to JSON
   */
  exportLayout(widgets: Widget[], layouts: Layouts): void {
    const data = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      widgets,
      layouts
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-layout-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import layout from JSON
   */
  async importLayout(file: File): Promise<{ widgets: Widget[]; layouts: Layouts }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          resolve({
            widgets: data.widgets || [],
            layouts: data.layouts || {}
          });
        } catch (error) {
          reject(new Error('Invalid layout file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Get widget size constraints
   */
  getWidgetConstraints(widgetType: string) {
    const constraints: Record<string, { minW: number; minH: number; maxW?: number; maxH?: number }> = {
      netWorth: { minW: 3, minH: 2 },
      accounts: { minW: 3, minH: 2 },
      budgetOverview: { minW: 4, minH: 2 },
      recentTransactions: { minW: 4, minH: 2, maxH: 6 },
      cashFlow: { minW: 4, minH: 2 },
      goalsProgress: { minW: 6, minH: 2 },
      spending: { minW: 4, minH: 3 },
      billReminders: { minW: 3, minH: 2 }
    };
    
    return constraints[widgetType] || { minW: 2, minH: 2 };
  }

  /**
   * Reset to default layout
   */
  resetToDefault() {
    return {
      widgets: this.getDefaultWidgets(),
      layouts: this.getDefaultLayout()
    };
  }

  /**
   * Apply template
   */
  applyTemplate(templateId: string) {
    const templates = this.getDefaultTemplates();
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      return {
        widgets: template.widgets.length > 0 ? template.widgets : this.getDefaultWidgets(),
        layouts: Object.keys(template.layouts).length > 0 ? template.layouts : this.getDefaultLayout()
      };
    }
    
    return this.resetToDefault();
  }
}

export const dashboardV2PageService = new DashboardV2PageService();
