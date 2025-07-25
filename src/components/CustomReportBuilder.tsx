import React, { useState, useCallback } from 'react';
import { 
  PlusIcon, 
  GripVerticalIcon, 
  XIcon, 
  SettingsIcon,
  BarChart3Icon,
  PieChartIcon,
  LineChartIcon,
  TableIcon,
  FileTextIcon,
  TrendingUpIcon,
  DollarSignIcon,
  CalendarIcon,
  SaveIcon,
  PlayIcon
} from './icons';
import { useApp } from '../contexts/AppContext';
import { useNotifications } from '../contexts/NotificationContext';

// Report component types
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
  config: Record<string, any>;
  width: 'full' | 'half' | 'third';
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  components: ReportComponent[];
  filters: {
    dateRange: 'month' | 'quarter' | 'year' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    accounts?: string[];
    categories?: string[];
    tags?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Available components catalog
const COMPONENT_CATALOG: Array<{
  type: ReportComponentType;
  name: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  defaultConfig: Record<string, any>;
}> = [
  {
    type: 'summary-stats',
    name: 'Summary Statistics',
    description: 'Key financial metrics overview',
    icon: TrendingUpIcon,
    defaultConfig: {
      metrics: ['income', 'expenses', 'netIncome', 'savingsRate']
    }
  },
  {
    type: 'line-chart',
    name: 'Line Chart',
    description: 'Trends over time',
    icon: LineChartIcon,
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
    icon: PieChartIcon,
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
    icon: BarChart3Icon,
    defaultConfig: {
      dataType: 'monthly-expenses',
      orientation: 'vertical'
    }
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Detailed tabular data',
    icon: TableIcon,
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
    icon: FileTextIcon,
    defaultConfig: {
      content: '',
      fontSize: 'medium'
    }
  },
  {
    type: 'category-breakdown',
    name: 'Category Analysis',
    description: 'Detailed category breakdown',
    icon: DollarSignIcon,
    defaultConfig: {
      showSubcategories: true,
      comparisonType: 'budget'
    }
  },
  {
    type: 'date-comparison',
    name: 'Period Comparison',
    description: 'Compare different time periods',
    icon: CalendarIcon,
    defaultConfig: {
      periods: ['current', 'previous'],
      metric: 'netIncome'
    }
  }
];

interface CustomReportBuilderProps {
  report?: CustomReport;
  onSave: (report: CustomReport) => void;
  onCancel: () => void;
}

export default function CustomReportBuilder({ 
  report, 
  onSave, 
  onCancel 
}: CustomReportBuilderProps): React.JSX.Element {
  const { accounts, categories, tags } = useApp();
  const { addNotification } = useNotifications();
  
  const [reportName, setReportName] = useState(report?.name || '');
  const [reportDescription, setReportDescription] = useState(report?.description || '');
  const [components, setComponents] = useState<ReportComponent[]>(report?.components || []);
  const [filters, setFilters] = useState(report?.filters || {
    dateRange: 'month' as const
  });
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  const moveComponent = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= components.length) return;

    const items = Array.from(components);
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);

    setComponents(items);
  };

  const addComponent = (type: ReportComponentType) => {
    const catalogItem = COMPONENT_CATALOG.find(c => c.type === type);
    if (!catalogItem) return;

    const newComponent: ReportComponent = {
      id: `component-${Date.now()}`,
      type,
      title: catalogItem.name,
      config: { ...catalogItem.defaultConfig },
      width: 'full'
    };

    setComponents([...components, newComponent]);
    setShowCatalog(false);
  };

  const updateComponent = (id: string, updates: Partial<ReportComponent>) => {
    setComponents(components.map(comp => 
      comp.id === id ? { ...comp, ...updates } : comp
    ));
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(comp => comp.id !== id));
  };

  const handleSave = () => {
    if (!reportName.trim()) {
      addNotification({
        type: 'error',
        title: 'Report name required',
        message: 'Please enter a name for your report'
      });
      return;
    }

    const customReport: CustomReport = {
      id: report?.id || `report-${Date.now()}`,
      name: reportName,
      description: reportDescription,
      components,
      filters,
      createdAt: report?.createdAt || new Date(),
      updatedAt: new Date()
    };

    onSave(customReport);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {report ? 'Edit Report' : 'Create Custom Report'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <SaveIcon size={16} />
              Save Report
            </button>
          </div>
        </div>
        
        {/* Report Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Report Name
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Monthly Financial Summary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Overview of monthly income, expenses, and savings"
            />
          </div>
        </div>
      </div>

      {/* Global Filters */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Report Filters
        </h3>
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {filters.dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={filters.customStartDate || ''}
                onChange={(e) => setFilters({ ...filters, customStartDate: e.target.value })}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
              <input
                type="date"
                value={filters.customEndDate || ''}
                onChange={(e) => setFilters({ ...filters, customEndDate: e.target.value })}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Report Canvas */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 min-h-[200px]">
          {components.map((component, index) => (
            <div
              key={component.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveComponent(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveComponent(index, 'down')}
                      disabled={index === components.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {component.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {COMPONENT_CATALOG.find(c => c.type === component.type)?.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={component.width}
                    onChange={(e) => updateComponent(component.id, { width: e.target.value as any })}
                    className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    <option value="full">Full Width</option>
                    <option value="half">Half Width</option>
                    <option value="third">Third Width</option>
                  </select>
                  <button
                    onClick={() => setEditingComponent(component.id)}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-primary"
                    title="Configure"
                  >
                    <SettingsIcon size={16} />
                  </button>
                  <button
                    onClick={() => removeComponent(component.id)}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600"
                    title="Remove"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <ComponentPreview component={component} />
              </div>
            </div>
          ))}
        </div>

        {/* Add Component Button */}
        {components.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start building your report by adding components
            </p>
          </div>
        )}
        
        <button
          onClick={() => setShowCatalog(true)}
          className="mt-4 w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <PlusIcon size={24} className="mx-auto text-gray-400 dark:text-gray-600" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Add Component</p>
        </button>
      </div>

      {/* Component Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add Report Component
                </h3>
                <button
                  onClick={() => setShowCatalog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMPONENT_CATALOG.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addComponent(item.type)}
                    className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                  >
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <item.icon size={24} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Component preview renderer
function ComponentPreview({ component }: { component: ReportComponent }): React.JSX.Element {
  const Icon = COMPONENT_CATALOG.find(c => c.type === component.type)?.icon || FileTextIcon;
  
  return (
    <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-600">
      <Icon size={48} />
      <p className="ml-4 text-sm">Preview will be shown when report is generated</p>
    </div>
  );
}