import { memo, useEffect } from 'react';
import { 
  FileTextIcon,
  TrendingUpIcon,
  LineChartIcon,
  PieChartIcon,
  BarChart3Icon,
  GridIcon,
  DollarSignIcon,
  CalendarIcon
} from '../icons';
import type { ReportComponent, ReportComponentType } from '../../services/customReportService';
import { useLogger } from '../services/ServiceProvider';

interface ComponentPreviewProps {
  component: ReportComponent;
}

const COMPONENT_ICONS: Record<ReportComponentType, any> = {
  'summary-stats': TrendingUpIcon,
  'line-chart': LineChartIcon,
  'bar-chart': BarChart3Icon,
  'pie-chart': PieChartIcon,
  'table': GridIcon,
  'text-block': FileTextIcon,
  'date-comparison': CalendarIcon,
  'category-breakdown': DollarSignIcon,
  'account-summary': TrendingUpIcon,
  'transaction-list': GridIcon,
  'budget-progress': TrendingUpIcon,
  'goal-tracker': TrendingUpIcon,
  'summary': TrendingUpIcon,
  'text': FileTextIcon,
  'chart': LineChartIcon,
  'kpi': TrendingUpIcon
};

/**
 * Component preview renderer
 */
export const ComponentPreview = memo(function ComponentPreview({ component 
 }: ComponentPreviewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ComponentPreview component initialized', {
      componentName: 'ComponentPreview'
    });
  }, []);

  const Icon = COMPONENT_ICONS[component.type] || FileTextIcon;
  
  return (
    <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-600">
      <Icon size={48} />
      <p className="ml-4 text-sm">Preview will be shown when report is generated</p>
    </div>
  );
});