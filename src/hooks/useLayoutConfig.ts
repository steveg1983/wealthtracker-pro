import { useState, useEffect } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

export interface LayoutConfig {
  dashboard: Layout[];
  analytics: Layout[];
  _version?: number;
}

const DEFAULT_DASHBOARD_LAYOUT: Layout[] = [
  { i: 'asset-chart', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'investment-performance', x: 6, y: 0, w: 6, h: 4, minW: 6, minH: 3 },
  { i: 'recent-transactions', x: 0, y: 4, w: 12, h: 7, minW: 4, minH: 3 },
];

const DEFAULT_ANALYTICS_LAYOUT: Layout[] = [
  { i: 'monthly-spending', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'category-breakdown', x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'income-expenses', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'net-worth', x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'forecast', x: 0, y: 8, w: 12, h: 4, minW: 6, minH: 3 },
];

const STORAGE_KEY = 'wealthtracker-layout-config';

interface UseLayoutConfigReturn {
  layouts: LayoutConfig;
  updateDashboardLayout: (newLayout: Layout[]) => void;
  updateAnalyticsLayout: (newLayout: Layout[]) => void;
  resetDashboardLayout: () => void;
  resetAnalyticsLayout: () => void;
  resetAllLayouts: () => void;
}

export function useLayoutConfig(): UseLayoutConfigReturn {
  const logger = useMemoizedLogger('useLayoutConfig');
  const [layouts, setLayouts] = useState<LayoutConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if layout version matches (force reset if structure changed)
        if (parsed._version === 3) {
          return parsed;
        }
      } catch (e) {
        logger.error?.('Failed to parse saved layouts', e);
      }
    }
    return {
      dashboard: DEFAULT_DASHBOARD_LAYOUT,
      analytics: DEFAULT_ANALYTICS_LAYOUT,
      _version: 3,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  }, [layouts]);

  const updateDashboardLayout = (newLayout: Layout[]) => {
    setLayouts(prev => ({ ...prev, dashboard: newLayout }));
  };

  const updateAnalyticsLayout = (newLayout: Layout[]) => {
    setLayouts(prev => ({ ...prev, analytics: newLayout }));
  };

  const resetDashboardLayout = () => {
    setLayouts(prev => ({ ...prev, dashboard: DEFAULT_DASHBOARD_LAYOUT }));
  };

  const resetAnalyticsLayout = () => {
    setLayouts(prev => ({ ...prev, analytics: DEFAULT_ANALYTICS_LAYOUT }));
  };

  const resetAllLayouts = () => {
    setLayouts({
      dashboard: DEFAULT_DASHBOARD_LAYOUT,
      analytics: DEFAULT_ANALYTICS_LAYOUT,
    });
  };

  return {
    layouts,
    updateDashboardLayout,
    updateAnalyticsLayout,
    resetDashboardLayout,
    resetAnalyticsLayout,
    resetAllLayouts,
  };
}

export function useResponsiveLayouts(baseLayouts: Layouts): Layouts {
  return {
    lg: baseLayouts.lg || [],
    md: baseLayouts.md || baseLayouts.lg || [],
    sm: baseLayouts.sm || baseLayouts.md || baseLayouts.lg || [],
    xs: baseLayouts.xs || baseLayouts.sm || baseLayouts.md || baseLayouts.lg || [],
    xxs: baseLayouts.xxs || baseLayouts.xs || baseLayouts.sm || baseLayouts.md || baseLayouts.lg || [],
  };
}
