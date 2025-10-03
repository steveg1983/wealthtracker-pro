import type { Layout } from 'react-grid-layout';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
  locked?: boolean;
  refreshInterval?: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  settings: {
    columns?: number;
    rowHeight?: number;
    theme?: 'light' | 'dark' | 'auto';
    autoRefresh?: boolean;
    refreshInterval?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isPublic?: boolean;
  tags?: string[];
}

export interface WidgetCatalogItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  defaultSize: { w: number; h: number };
}

/**
 * Service for dashboard builder operations
 */
export class DashboardBuilderService {
  /**
   * Available widget types catalog
   */
  static readonly WIDGET_CATALOG: WidgetCatalogItem[] = [
    // Core Metrics
    { id: 'net-worth', name: 'Net Worth', category: 'Core Metrics', icon: '💰', defaultSize: { w: 2, h: 2 } },
    { id: 'income-expense', name: 'Income vs Expenses', category: 'Core Metrics', icon: '📊', defaultSize: { w: 4, h: 3 } },
    { id: 'savings-rate', name: 'Savings Rate', category: 'Core Metrics', icon: '💹', defaultSize: { w: 2, h: 2 } },
    { id: 'cash-flow', name: 'Cash Flow', category: 'Core Metrics', icon: '💵', defaultSize: { w: 4, h: 3 } },
    
    // Charts
    { id: 'line-chart', name: 'Line Chart', category: 'Charts', icon: '📈', defaultSize: { w: 4, h: 3 } },
    { id: 'bar-chart', name: 'Bar Chart', category: 'Charts', icon: '📊', defaultSize: { w: 4, h: 3 } },
    { id: 'pie-chart', name: 'Pie Chart', category: 'Charts', icon: '🥧', defaultSize: { w: 3, h: 3 } },
    { id: 'area-chart', name: 'Area Chart', category: 'Charts', icon: '📉', defaultSize: { w: 4, h: 3 } },
    { id: 'scatter-plot', name: 'Scatter Plot', category: 'Charts', icon: '⚫', defaultSize: { w: 3, h: 3 } },
    { id: 'heatmap', name: 'Heatmap', category: 'Charts', icon: '🗓️', defaultSize: { w: 4, h: 4 } },
    { id: 'treemap', name: 'Treemap', category: 'Charts', icon: '🌳', defaultSize: { w: 4, h: 4 } },
    { id: 'sankey', name: 'Sankey Diagram', category: 'Charts', icon: '🔀', defaultSize: { w: 6, h: 4 } },
    { id: 'waterfall', name: 'Waterfall Chart', category: 'Charts', icon: '💧', defaultSize: { w: 4, h: 3 } },
    { id: 'radar', name: 'Radar Chart', category: 'Charts', icon: '🎯', defaultSize: { w: 3, h: 3 } },
    { id: 'bubble', name: 'Bubble Chart', category: 'Charts', icon: '🫧', defaultSize: { w: 4, h: 3 } },
    { id: 'candlestick', name: 'Candlestick Chart', category: 'Charts', icon: '🕯️', defaultSize: { w: 4, h: 3 } },
    
    // Analytics
    { id: 'trend-analysis', name: 'Trend Analysis', category: 'Analytics', icon: '📈', defaultSize: { w: 4, h: 3 } },
    { id: 'forecast', name: 'Forecast', category: 'Analytics', icon: '🔮', defaultSize: { w: 4, h: 3 } },
    { id: 'anomalies', name: 'Anomaly Detection', category: 'Analytics', icon: '⚠️', defaultSize: { w: 3, h: 3 } },
    { id: 'correlations', name: 'Correlations', category: 'Analytics', icon: '🔗', defaultSize: { w: 3, h: 3 } },
    { id: 'seasonality', name: 'Seasonal Patterns', category: 'Analytics', icon: '🍂', defaultSize: { w: 4, h: 3 } },
    { id: 'cohort', name: 'Cohort Analysis', category: 'Analytics', icon: '👥', defaultSize: { w: 4, h: 4 } },
    
    // Tables & Lists
    { id: 'data-table', name: 'Data Table', category: 'Tables', icon: '📋', defaultSize: { w: 6, h: 4 } },
    { id: 'transaction-list', name: 'Transaction List', category: 'Tables', icon: '📝', defaultSize: { w: 4, h: 4 } },
    { id: 'top-expenses', name: 'Top Expenses', category: 'Tables', icon: '💸', defaultSize: { w: 3, h: 3 } },
    { id: 'upcoming-bills', name: 'Upcoming Bills', category: 'Tables', icon: '📅', defaultSize: { w: 3, h: 3 } },
    
    // Goals & Budget
    { id: 'goal-progress', name: 'Goal Progress', category: 'Goals', icon: '🎯', defaultSize: { w: 3, h: 2 } },
    { id: 'budget-status', name: 'Budget Status', category: 'Goals', icon: '💰', defaultSize: { w: 4, h: 3 } },
    { id: 'budget-variance', name: 'Budget Variance', category: 'Goals', icon: '📊', defaultSize: { w: 4, h: 3 } },
    
    // Custom
    { id: 'custom-metric', name: 'Custom Metric', category: 'Custom', icon: '🔧', defaultSize: { w: 2, h: 2 } },
    { id: 'custom-query', name: 'Custom Query', category: 'Custom', icon: '🔍', defaultSize: { w: 4, h: 3 } },
    { id: 'text-note', name: 'Text Note', category: 'Custom', icon: '📝', defaultSize: { w: 2, h: 2 } },
  ];

  /**
   * Get unique widget categories
   */
  static getCategories(): string[] {
    const categories = new Set(['All']);
    this.WIDGET_CATALOG.forEach(w => categories.add(w.category));
    return Array.from(categories);
  }

  /**
   * Filter widgets by category
   */
  static filterByCategory(category: string): WidgetCatalogItem[] {
    if (category === 'All') return this.WIDGET_CATALOG;
    return this.WIDGET_CATALOG.filter(w => w.category === category);
  }

  /**
   * Create a new widget instance
   */
  static createWidget(widgetType: WidgetCatalogItem): DashboardWidget {
    return {
      id: `widget-${Date.now()}`,
      type: widgetType.id,
      title: widgetType.name,
      config: {},
      layout: {
        x: 0,
        y: 0,
        w: widgetType.defaultSize.w,
        h: widgetType.defaultSize.h,
        minW: 1,
        minH: 1
      }
    };
  }

  /**
   * Update widget layouts from grid changes
   */
  static updateWidgetLayouts(
    widgets: DashboardWidget[],
    layout: Layout[]
  ): DashboardWidget[] {
    return widgets.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          layout: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
            minW: widget.layout.minW,
            minH: widget.layout.minH
          }
        };
      }
      return widget;
    });
  }

  /**
   * Create dashboard data object
   */
  static createDashboard(
    id: string | undefined,
    name: string,
    description: string,
    widgets: DashboardWidget[],
    createdAt?: Date
  ): Dashboard {
    return {
      id: id || `dashboard-${Date.now()}`,
      name,
      description,
      widgets,
      settings: {
        columns: 12,
        rowHeight: 60,
        theme: 'auto',
        autoRefresh: false
      },
      createdAt: createdAt || new Date(),
      updatedAt: new Date(),
      tags: []
    };
  }

  /**
   * Export dashboard as JSON
   */
  static exportDashboard(
    name: string,
    description: string,
    widgets: DashboardWidget[]
  ): void {
    const data = JSON.stringify({
      name,
      description,
      widgets,
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-dashboard.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get grid layout configuration
   */
  static getGridConfig() {
    return {
      breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
      cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      rowHeight: 60
    };
  }
}

export const dashboardBuilderService = new DashboardBuilderService();