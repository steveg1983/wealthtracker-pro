import {
  CalendarIcon as Calendar,
  ReceiptIcon as Receipt,
  TrendingUpIcon as TrendingUp,
  PieChartIcon as PieChart,
  DollarSignIcon as DollarSign
} from '../components/icons';

export type ExportFormat = 'pdf' | 'excel' | 'csv';
export type ReportType = 'transactions' | 'summary' | 'budget' | 'tax' | 'investment' | 'networth' | 'custom';

export interface ExportOptions {
  format: ExportFormat;
  reportType: ReportType;
  dateRange: 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';
  startDate?: string;
  endDate?: string;
  accounts: string[];
  categories: string[];
  includeCharts: boolean;
  includeNotes: boolean;
  groupBy: 'none' | 'account' | 'category' | 'month';
  customTitle?: string;
  paperSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
}

export interface ReportTemplate {
  id: string;
  name: string;
  icon: React.FC<{ size?: number; className?: string }>;
  description: string;
  reportType: ReportType;
  defaults: Partial<ExportOptions>;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'monthly-statement',
    name: 'Monthly Statement',
    icon: Calendar,
    description: 'Professional bank-style monthly statement',
    reportType: 'transactions',
    defaults: {
      dateRange: 'lastMonth',
      groupBy: 'account',
      includeCharts: true
    }
  },
  {
    id: 'tax-summary',
    name: 'Tax Summary',
    icon: Receipt,
    description: 'Annual tax-deductible expenses report',
    reportType: 'tax',
    defaults: {
      dateRange: 'lastYear',
      groupBy: 'category',
      includeCharts: false
    }
  },
  {
    id: 'investment-performance',
    name: 'Investment Performance',
    icon: TrendingUp,
    description: 'Portfolio performance and holdings report',
    reportType: 'investment',
    defaults: {
      dateRange: 'thisYear',
      includeCharts: true
    }
  },
  {
    id: 'budget-analysis',
    name: 'Budget Analysis',
    icon: PieChart,
    description: 'Budget vs actual spending analysis',
    reportType: 'budget',
    defaults: {
      dateRange: 'thisMonth',
      groupBy: 'category',
      includeCharts: true
    }
  },
  {
    id: 'net-worth',
    name: 'Net Worth Statement',
    icon: DollarSign,
    description: 'Complete assets and liabilities statement',
    reportType: 'networth',
    defaults: {
      dateRange: 'all',
      includeCharts: true
    }
  }
];

export function getReportTitle(reportType: ReportType): string {
  switch (reportType) {
    case 'transactions': return 'Transaction Report';
    case 'summary': return 'Financial Summary';
    case 'budget': return 'Budget Analysis Report';
    case 'tax': return 'Tax Summary Report';
    case 'investment': return 'Investment Performance Report';
    case 'networth': return 'Net Worth Statement';
    default: return 'Financial Report';
  }
}