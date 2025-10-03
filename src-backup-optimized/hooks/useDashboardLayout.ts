/**
 * Dashboard Layout Hook
 * Manage dashboard layout state and operations
 */

import { useState, useCallback } from 'react';
import { useLogger } from '../services/ServiceProvider';

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    config: Record<string, unknown>;
  }>;
  isDefault: boolean;
}

export function useDashboardLayout() {
  const logger = useLogger();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadLayout = useCallback(async (layoutId?: string) => {
    setIsLoading(true);
    try {
      // Load layout from storage or API
      const defaultLayout: DashboardLayout = {
        id: layoutId || 'default',
        name: 'Default Layout',
        widgets: [],
        isDefault: true
      };
      setLayout(defaultLayout);
      logger.info('Dashboard layout loaded');
    } catch (error) {
      logger.error('Failed to load dashboard layout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveLayout = useCallback(async (layoutData: DashboardLayout) => {
    try {
      setLayout(layoutData);
      logger.info('Dashboard layout saved');
    } catch (error) {
      logger.error('Failed to save dashboard layout:', error);
    }
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(null);
  }, []);

  return {
    layout,
    isLoading,
    loadLayout,
    saveLayout,
    resetLayout
  };
}