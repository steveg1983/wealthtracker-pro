import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { dashboardV2PageService } from '../services/dashboardV2PageService';
import type { LayoutTemplate } from '../services/layoutTemplatesService';
import type { Widget, Layouts } from '../services/dashboardV2PageService';
import { useLogger } from '../services/ServiceProvider';

interface DashboardV2State {
  isLoading: boolean;
  isEditMode: boolean;
  layouts: Layouts;
  widgets: Widget[];
  selectedLayout: string;
  isRefreshing: boolean;
  showAddWidget: boolean;
  showExport: boolean;
  showTemplates: boolean;
  isDirty: boolean;
}

export function useDashboardV2Page() {
  const logger = useLogger();
  const { user } = useAuth();
  const appContext = useApp();
  const { accounts, transactions, budgets, goals } = appContext;
  const refreshData = () => Promise.resolve();
  const { firstName } = usePreferences();
  
  // Initialize state
  const [state, setState] = useState<DashboardV2State>({
    isLoading: true,
    isEditMode: false,
    layouts: {},
    widgets: [],
    selectedLayout: 'default',
    isRefreshing: false,
    showAddWidget: false,
    showExport: false,
    showTemplates: false,
    isDirty: false
  });

  // Get configurations
  const breakpoints = useMemo(() => dashboardV2PageService.getBreakpoints(), []);
  const cols = useMemo(() => dashboardV2PageService.getColumnConfig(), []);
  const templates = useMemo(() => dashboardV2PageService.getDefaultTemplates(), []);

  // Load dashboard layout on mount
  useEffect(() => {
    loadDashboardLayout();
  }, [user]);

  // Load dashboard layout
  const loadDashboardLayout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const { widgets, layouts } = await dashboardV2PageService.loadDashboardLayout(user?.id || null);
      
      setState(prev => ({
        ...prev,
        widgets,
        layouts,
        isLoading: false,
        isDirty: false
      }));
      
      logger.info('Dashboard layout loaded', { widgetCount: widgets.length });
    } catch (error) {
      logger.error('Failed to load dashboard layout', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // Save dashboard layout
  const saveDashboardLayout = useCallback(async () => {
    if (!user) return;
    
    try {
      await dashboardV2PageService.saveDashboardLayout(
        user.id,
        state.widgets,
        state.layouts
      );
      
      setState(prev => ({ ...prev, isDirty: false }));
      logger.info('Dashboard layout saved');
    } catch (error) {
      logger.error('Failed to save dashboard layout', error);
    }
  }, [user, state.widgets, state.layouts]);

  // Handle layout change
  const handleLayoutChange = useCallback((currentLayout: any, allLayouts: Layouts) => {
    setState(prev => ({
      ...prev,
      layouts: allLayouts,
      isDirty: true
    }));
  }, []);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setState(prev => {
      const newEditMode = !prev.isEditMode;
      
      // Save when exiting edit mode if dirty
      if (!newEditMode && prev.isDirty) {
        saveDashboardLayout();
      }
      
      return { ...prev, isEditMode: newEditMode };
    });
  }, [saveDashboardLayout]);

  // Add widget
  const addWidget = useCallback((widgetType: string) => {
    const widgetId = `${widgetType}-${Date.now()}`;
    const newWidget: Widget = {
      id: widgetId,
      type: widgetType,
      title: widgetType.replace(/([A-Z])/g, ' $1').trim()
    };
    
    const constraints = dashboardV2PageService.getWidgetConstraints(widgetType);
    
    // Add to layouts
    const newLayouts = { ...state.layouts };
    Object.keys(breakpoints).forEach(breakpoint => {
      const existingLayout = newLayouts[breakpoint] || [];
      newLayouts[breakpoint] = [
        ...existingLayout,
        {
          i: widgetId,
          x: 0,
          y: Infinity, // Place at bottom
          w: constraints.minW || 4,
          h: constraints.minH || 2,
          ...constraints
        }
      ];
    });
    
    setState(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      layouts: newLayouts,
      isDirty: true,
      showAddWidget: false
    }));
  }, [state.layouts, breakpoints]);

  // Remove widget
  const removeWidget = useCallback((widgetId: string) => {
    setState(prev => {
      const newWidgets = prev.widgets.filter(w => w.id !== widgetId);
      const newLayouts = { ...prev.layouts };
      
      Object.keys(newLayouts).forEach(breakpoint => {
        newLayouts[breakpoint] = newLayouts[breakpoint]?.filter(
          item => item.i !== widgetId
        );
      });
      
      return {
        ...prev,
        widgets: newWidgets,
        layouts: newLayouts,
        isDirty: true
      };
    });
  }, []);

  // Reset to default
  const resetToDefault = useCallback(() => {
    const { widgets, layouts } = dashboardV2PageService.resetToDefault();
    setState(prev => ({
      ...prev,
      widgets,
      layouts,
      isDirty: true
    }));
  }, []);

  // Apply template
  const applyTemplate = useCallback((template: LayoutTemplate) => {
    const { widgets, layouts } = dashboardV2PageService.applyTemplate(template.id);
    setState(prev => ({
      ...prev,
      widgets,
      layouts,
      selectedLayout: template.id,
      isDirty: true,
      showTemplates: false
    }));
  }, []);

  // Export layout
  const exportLayout = useCallback(() => {
    dashboardV2PageService.exportLayout(state.widgets, state.layouts);
    setState(prev => ({ ...prev, showExport: false }));
  }, [state.widgets, state.layouts]);

  // Import layout
  const importLayout = useCallback(async (file: File) => {
    try {
      const { widgets, layouts } = await dashboardV2PageService.importLayout(file);
      setState(prev => ({
        ...prev,
        widgets,
        layouts,
        isDirty: true
      }));
      logger.info('Layout imported successfully');
    } catch (error) {
      logger.error('Failed to import layout', error);
    }
  }, []);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, isRefreshing: true }));
    await refreshData();
    setState(prev => ({ ...prev, isRefreshing: false }));
  }, [refreshData]);

  // Toggle modals
  const toggleModal = useCallback((modalName: 'showAddWidget' | 'showExport' | 'showTemplates', value?: boolean) => {
    setState(prev => ({
      ...prev,
      [modalName]: value !== undefined ? value : !prev[modalName]
    }));
  }, []);

  // Get widget data
  const getWidgetData = useCallback((widgetType: string) => {
    // This would normally fetch specific data for each widget type
    return {
      accounts,
      transactions,
      budgets,
      goals
    };
  }, [accounts, transactions, budgets, goals]);

  return {
    // State
    ...state,
    firstName,
    
    // Configs
    breakpoints,
    cols,
    templates,
    
    // Handlers
    handleLayoutChange,
    toggleEditMode,
    addWidget,
    removeWidget,
    resetToDefault,
    applyTemplate,
    exportLayout,
    importLayout,
    handleRefresh,
    toggleModal,
    saveDashboardLayout,
    getWidgetData
  };
}