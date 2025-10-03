/**
 * Report Builder Service
 * Handles report component management and validation
 */

export type ReportComponentType = 
  | 'summary-stats'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'table'
  | 'text-block'
  | 'date-comparison'
  | 'category-breakdown'
  | 'account-summary'
  | 'transaction-list'
  | 'budget-progress'
  | 'goal-tracker';

export interface ReportComponent {
  id: string;
  type: ReportComponentType;
  title: string;
  config: Record<string, unknown>;
  width: 'full' | 'half' | 'third';
}

export interface ReportFilters {
  dateRange: 'month' | 'quarter' | 'year' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  accounts?: string[];
  categories?: string[];
  tags?: string[];
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  components: ReportComponent[];
  filters: ReportFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentCatalogItem {
  type: ReportComponentType;
  name: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}

/**
 * Report builder service class
 */
export class ReportBuilderService {
  
  /**
   * Component catalog
   */
  static readonly COMPONENT_CATALOG: ComponentCatalogItem[] = [
    {
      type: 'summary-stats',
      name: 'Summary Statistics',
      description: 'Key financial metrics overview',
      defaultConfig: {
        metrics: ['income', 'expenses', 'netIncome', 'savingsRate']
      }
    },
    {
      type: 'line-chart',
      name: 'Line Chart',
      description: 'Trends over time',
      defaultConfig: {
        dataType: 'income-vs-expenses',
        showLegend: true,
        showDataLabels: false
      }
    },
    {
      type: 'pie-chart',
      name: 'Pie Chart',
      description: 'Category breakdown',
      defaultConfig: {
        dataType: 'expenses-by-category',
        showPercentages: true,
        limit: 10
      }
    },
    {
      type: 'bar-chart',
      name: 'Bar Chart',
      description: 'Comparisons',
      defaultConfig: {
        dataType: 'monthly-expenses',
        orientation: 'vertical'
      }
    },
    {
      type: 'table',
      name: 'Data Table',
      description: 'Detailed tabular data',
      defaultConfig: {
        dataType: 'top-transactions',
        limit: 20,
        sortBy: 'amount',
        sortOrder: 'desc'
      }
    },
    {
      type: 'text-block',
      name: 'Text Block',
      description: 'Custom text or notes',
      defaultConfig: {
        content: '',
        fontSize: 'medium'
      }
    },
    {
      type: 'category-breakdown',
      name: 'Category Analysis',
      description: 'Detailed category breakdown',
      defaultConfig: {
        showSubcategories: true,
        comparisonType: 'budget'
      }
    },
    {
      type: 'date-comparison',
      name: 'Period Comparison',
      description: 'Compare different time periods',
      defaultConfig: {
        periods: ['current', 'previous'],
        metric: 'netIncome'
      }
    }
  ];

  /**
   * Get default filters
   */
  static getDefaultFilters(): ReportFilters {
    return {
      dateRange: 'month'
    };
  }

  /**
   * Create a new component
   */
  static createComponent(type: ReportComponentType): ReportComponent | null {
    const catalogItem = this.COMPONENT_CATALOG.find(c => c.type === type);
    if (!catalogItem) return null;

    return {
      id: `component-${Date.now()}`,
      type,
      title: catalogItem.name,
      config: { ...catalogItem.defaultConfig },
      width: 'full'
    };
  }

  /**
   * Move component in list
   */
  static moveComponent(
    components: ReportComponent[],
    fromIndex: number,
    direction: 'up' | 'down'
  ): ReportComponent[] {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= components.length) return components;

    const items = [...components];
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);

    return items;
  }

  /**
   * Update component
   */
  static updateComponent(
    components: ReportComponent[],
    id: string,
    updates: Partial<ReportComponent>
  ): ReportComponent[] {
    return components.map(comp => 
      comp.id === id ? { ...comp, ...updates } : comp
    );
  }

  /**
   * Remove component
   */
  static removeComponent(
    components: ReportComponent[],
    id: string
  ): ReportComponent[] {
    return components.filter(comp => comp.id !== id);
  }

  /**
   * Validate report
   */
  static validateReport(name: string): string | null {
    if (!name.trim()) {
      return 'Report name required';
    }
    return null;
  }

  /**
   * Create report object
   */
  static createReport(
    id: string | null,
    name: string,
    description: string,
    components: ReportComponent[],
    filters: ReportFilters,
    existingCreatedAt?: Date
  ): CustomReport {
    return {
      id: id || `report-${Date.now()}`,
      name,
      description,
      components,
      filters,
      createdAt: existingCreatedAt || new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get catalog item for type
   */
  static getCatalogItem(type: ReportComponentType): ComponentCatalogItem | undefined {
    return this.COMPONENT_CATALOG.find(c => c.type === type);
  }

  /**
   * Get component description
   */
  static getComponentDescription(type: ReportComponentType): string {
    const item = this.getCatalogItem(type);
    return item?.description || '';
  }
}