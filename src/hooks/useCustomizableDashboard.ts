import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { WidgetConfig } from '../components/DashboardWidget';
import { customizableDashboardService, DEFAULT_WIDGETS } from '../services/customizableDashboardService';

export interface UseCustomizableDashboardReturn {
  widgets: WidgetConfig[];
  visibleWidgets: WidgetConfig[];
  isDragMode: boolean;
  showAddWidget: boolean;
  showSettings: boolean;
  isRefreshing: boolean;
  setIsDragMode: (value: boolean) => void;
  setShowAddWidget: (value: boolean) => void;
  setShowSettings: (value: boolean) => void;
  handleWidgetConfigChange: (config: WidgetConfig) => void;
  handleRemoveWidget: (widgetId: string) => void;
  handleAddWidget: (type: string) => void;
  handleToggleWidgetVisibility: (widgetId: string) => void;
  handleRefreshAll: () => Promise<void>;
  handleResetToDefault: () => void;
}

export function useCustomizableDashboard(): UseCustomizableDashboardReturn {
  const [widgets, setWidgets] = useLocalStorage<WidgetConfig[]>('dashboard-widgets', DEFAULT_WIDGETS);
  const [isDragMode, setIsDragMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const visibleWidgets = useMemo(
    () => customizableDashboardService.getVisibleWidgets(widgets),
    [widgets]
  );

  const handleWidgetConfigChange = useCallback((config: WidgetConfig) => {
    setWidgets(prev => customizableDashboardService.updateWidget(prev, config.id, config));
  }, [setWidgets]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => customizableDashboardService.removeWidget(prev, widgetId));
  }, [setWidgets]);

  const handleAddWidget = useCallback((type: string) => {
    const newWidget = customizableDashboardService.createWidget(type);
    if (newWidget) {
      setWidgets(prev => [...prev, newWidget]);
      setShowAddWidget(false);
    }
  }, [setWidgets]);

  const handleToggleWidgetVisibility = useCallback((widgetId: string) => {
    setWidgets(prev => customizableDashboardService.toggleWidgetVisibility(prev, widgetId));
  }, [setWidgets]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setWidgets(prev => customizableDashboardService.refreshAllWidgets(prev));
    setIsRefreshing(false);
  }, [setWidgets]);

  const handleResetToDefault = useCallback(() => {
    setWidgets(customizableDashboardService.resetToDefault());
    setShowSettings(false);
  }, [setWidgets]);

  return {
    widgets,
    visibleWidgets,
    isDragMode,
    showAddWidget,
    showSettings,
    isRefreshing,
    setIsDragMode,
    setShowAddWidget,
    setShowSettings,
    handleWidgetConfigChange,
    handleRemoveWidget,
    handleAddWidget,
    handleToggleWidgetVisibility,
    handleRefreshAll,
    handleResetToDefault
  };
}