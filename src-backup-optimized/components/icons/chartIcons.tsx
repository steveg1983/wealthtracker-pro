import { memo } from 'react';
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconChartArea,
  IconChartDonut,
  IconReportAnalytics,
  IconPresentation,
} from '@tabler/icons-react';
import { createIconComponent } from './iconUtils';

/**
 * Chart and analytics icons module
 * Extracted from index.tsx for better organization
 */

// Chart Icons
export const BarChart3Icon = memo(createIconComponent(IconChartBar, 'BarChart3Icon'));
export const LineChartIcon = memo(createIconComponent(IconChartLine, 'LineChartIcon'));
export const PieChartIcon = memo(createIconComponent(IconChartPie, 'PieChartIcon'));

// Trending Icons moved to financialIcons.tsx

// Goal Icons moved to uiIcons.tsx