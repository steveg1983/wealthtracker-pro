import React, { memo } from 'react';
import { XIcon, PlusIcon } from '../icons';
import { 
  TrendingUpIcon,
  LineChartIcon,
  PieChartIcon,
  BarChart3Icon,
  GridIcon,
  FileTextIcon,
  DollarSignIcon,
  CalendarIcon
} from '../icons';
import type { ReportComponentType } from '../../services/customReportService';

interface ComponentCatalogItem {
  type: ReportComponentType;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CATALOG_ITEMS: ComponentCatalogItem[] = [
  {
    type: 'summary-stats',
    name: 'Summary Statistics',
    description: 'Key financial metrics overview',
    icon: TrendingUpIcon
  },
  {
    type: 'line-chart',
    name: 'Line Chart',
    description: 'Trends over time',
    icon: LineChartIcon
  },
  {
    type: 'pie-chart',
    name: 'Pie Chart',
    description: 'Category breakdown',
    icon: PieChartIcon
  },
  {
    type: 'bar-chart',
    name: 'Bar Chart',
    description: 'Comparisons',
    icon: BarChart3Icon
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Detailed tabular data',
    icon: GridIcon
  },
  {
    type: 'text-block',
    name: 'Text Block',
    description: 'Custom text or notes',
    icon: FileTextIcon
  },
  {
    type: 'category-breakdown',
    name: 'Category Analysis',
    description: 'Detailed category breakdown',
    icon: DollarSignIcon
  },
  {
    type: 'date-comparison',
    name: 'Period Comparison',
    description: 'Compare different time periods',
    icon: CalendarIcon
  }
];

interface ComponentCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComponent: (type: ReportComponentType) => void;
}

/**
 * Component catalog modal
 */
export const ComponentCatalog = memo(function ComponentCatalog({
  isOpen,
  onClose,
  onAddComponent
}: ComponentCatalogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add Report Component
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATALOG_ITEMS.map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  onAddComponent(item.type);
                  onClose();
                }}
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
  );
});

/**
 * Add component button
 */
export const AddComponentButton = memo(function AddComponentButton({
  onClick
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <PlusIcon size={24} className="mx-auto text-gray-400 dark:text-gray-600" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Add Component</p>
    </button>
  );
});