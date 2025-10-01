/**
 * Dashboard Builder Component
 * Drag-and-drop dashboard creation with customizable widgets
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import {
  PlusIcon,
  SettingsIcon,
  SaveIcon,
  GridIcon,
  XIcon,
  MaximizeIcon,
  MinimizeIcon,
  RefreshCwIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LockIcon,
  UnlockIcon,
  CopyIcon,
  TrashIcon
} from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { useNotifications } from '../../contexts/NotificationContext';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
  locked?: boolean;
  refreshInterval?: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  settings: {
    columns?: number;
    rowHeight?: number;
    theme?: 'light' | 'dark' | 'auto';
    autoRefresh?: boolean;
    refreshInterval?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isPublic?: boolean;
  tags?: string[];
}

interface DashboardBuilderProps {
  dashboard?: Dashboard;
  onSave?: (dashboard: Dashboard) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

// Available widget types catalog
const WIDGET_CATALOG = [
  // Core Metrics
  { id: 'net-worth', name: 'Net Worth', category: 'Core Metrics', icon: '💰', defaultSize: { w: 2, h: 2 } },
  { id: 'income-expense', name: 'Income vs Expenses', category: 'Core Metrics', icon: '📊', defaultSize: { w: 4, h: 3 } },
  { id: 'savings-rate', name: 'Savings Rate', category: 'Core Metrics', icon: '💹', defaultSize: { w: 2, h: 2 } },
  { id: 'cash-flow', name: 'Cash Flow', category: 'Core Metrics', icon: '💵', defaultSize: { w: 4, h: 3 } },
  
  // Charts
  { id: 'line-chart', name: 'Line Chart', category: 'Charts', icon: '📈', defaultSize: { w: 4, h: 3 } },
  { id: 'bar-chart', name: 'Bar Chart', category: 'Charts', icon: '📊', defaultSize: { w: 4, h: 3 } },
  { id: 'pie-chart', name: 'Pie Chart', category: 'Charts', icon: '🥧', defaultSize: { w: 3, h: 3 } },
  { id: 'area-chart', name: 'Area Chart', category: 'Charts', icon: '📉', defaultSize: { w: 4, h: 3 } },
  { id: 'scatter-plot', name: 'Scatter Plot', category: 'Charts', icon: '⚫', defaultSize: { w: 3, h: 3 } },
  { id: 'heatmap', name: 'Heatmap', category: 'Charts', icon: '🗓️', defaultSize: { w: 4, h: 4 } },
  { id: 'treemap', name: 'Treemap', category: 'Charts', icon: '🌳', defaultSize: { w: 4, h: 4 } },
  { id: 'sankey', name: 'Sankey Diagram', category: 'Charts', icon: '🔀', defaultSize: { w: 6, h: 4 } },
  { id: 'waterfall', name: 'Waterfall Chart', category: 'Charts', icon: '💧', defaultSize: { w: 4, h: 3 } },
  { id: 'radar', name: 'Radar Chart', category: 'Charts', icon: '🎯', defaultSize: { w: 3, h: 3 } },
  { id: 'bubble', name: 'Bubble Chart', category: 'Charts', icon: '🫧', defaultSize: { w: 4, h: 3 } },
  { id: 'candlestick', name: 'Candlestick Chart', category: 'Charts', icon: '🕯️', defaultSize: { w: 4, h: 3 } },
  
  // Analytics
  { id: 'trend-analysis', name: 'Trend Analysis', category: 'Analytics', icon: '📈', defaultSize: { w: 4, h: 3 } },
  { id: 'forecast', name: 'Forecast', category: 'Analytics', icon: '🔮', defaultSize: { w: 4, h: 3 } },
  { id: 'anomalies', name: 'Anomaly Detection', category: 'Analytics', icon: '⚠️', defaultSize: { w: 3, h: 3 } },
  { id: 'correlations', name: 'Correlations', category: 'Analytics', icon: '🔗', defaultSize: { w: 3, h: 3 } },
  { id: 'seasonality', name: 'Seasonal Patterns', category: 'Analytics', icon: '🍂', defaultSize: { w: 4, h: 3 } },
  { id: 'cohort', name: 'Cohort Analysis', category: 'Analytics', icon: '👥', defaultSize: { w: 4, h: 4 } },
  
  // Tables & Lists
  { id: 'data-table', name: 'Data Table', category: 'Tables', icon: '📋', defaultSize: { w: 6, h: 4 } },
  { id: 'transaction-list', name: 'Transaction List', category: 'Tables', icon: '📝', defaultSize: { w: 4, h: 4 } },
  { id: 'top-expenses', name: 'Top Expenses', category: 'Tables', icon: '💸', defaultSize: { w: 3, h: 3 } },
  { id: 'upcoming-bills', name: 'Upcoming Bills', category: 'Tables', icon: '📅', defaultSize: { w: 3, h: 3 } },
  
  // Goals & Budget
  { id: 'goal-progress', name: 'Goal Progress', category: 'Goals', icon: '🎯', defaultSize: { w: 3, h: 2 } },
  { id: 'budget-status', name: 'Budget Status', category: 'Goals', icon: '💰', defaultSize: { w: 4, h: 3 } },
  { id: 'budget-variance', name: 'Budget Variance', category: 'Goals', icon: '📊', defaultSize: { w: 4, h: 3 } },
  
  // Custom
  { id: 'custom-metric', name: 'Custom Metric', category: 'Custom', icon: '🔧', defaultSize: { w: 2, h: 2 } },
  { id: 'custom-query', name: 'Custom Query', category: 'Custom', icon: '🔍', defaultSize: { w: 4, h: 3 } },
  { id: 'text-note', name: 'Text Note', category: 'Custom', icon: '📝', defaultSize: { w: 2, h: 2 } },
];

export default function DashboardBuilder({
  dashboard,
  onSave,
  onClose,
  readOnly = false
}: DashboardBuilderProps) {
  const { addNotification } = useNotifications();
  const { accounts, transactions, budgets, goals, categories } = useApp();
  
  // State
  const [widgets, setWidgets] = useState<DashboardWidget[]>(dashboard?.widgets || []);
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState(dashboard?.name || 'New Dashboard');
  const [dashboardDescription, setDashboardDescription] = useState(dashboard?.description || '');
  const [isEditMode, setIsEditMode] = useState(!readOnly);
  const [showSettings, setShowSettings] = useState(false);
  
  // Get unique categories
  const widgetCategories = useMemo(() => {
    const cats = new Set(['All']);
    WIDGET_CATALOG.forEach(w => cats.add(w.category));
    return Array.from(cats);
  }, []);
  
  // Filter widgets by category
  const filteredWidgets = useMemo(() => {
    if (selectedCategory === 'All') return WIDGET_CATALOG;
    return WIDGET_CATALOG.filter(w => w.category === selectedCategory);
  }, [selectedCategory]);
  
  // Handle layout changes
  const handleLayoutChange = useCallback((layout: Layout[], layouts: { [key: string]: Layout[] }) => {
    setLayouts(layouts);
    
    // Update widget layouts
    const updatedWidgets = widgets.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          layout: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          }
        };
      }
      return widget;
    });
    
    setWidgets(updatedWidgets);
  }, [widgets]);
  
  // Add new widget
  const handleAddWidget = useCallback((widgetType: typeof WIDGET_CATALOG[0]) => {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType.id,
      title: widgetType.name,
      config: {},
      layout: {
        x: 0,
        y: 0,
        w: widgetType.defaultSize.w,
        h: widgetType.defaultSize.h,
        minW: 1,
        minH: 1
      }
    };
    
    setWidgets([...widgets, newWidget]);
    setIsAddingWidget(false);
    addNotification({ type: 'success', title: `Added ${widgetType.name} widget` });
  }, [widgets, addNotification]);
  
  // Remove widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    addNotification({ type: 'info', title: 'Widget removed' });
  }, [widgets, addNotification]);
  
  // Toggle widget lock
  const handleToggleLock = useCallback((widgetId: string) => {
    setWidgets(widgets.map(w => 
      w.id === widgetId ? { ...w, locked: !w.locked } : w
    ));
  }, [widgets]);
  
  // Save dashboard
  const handleSaveDashboard = useCallback(() => {
    const dashboardData: Dashboard = {
      id: dashboard?.id || `dashboard-${Date.now()}`,
      name: dashboardName,
      description: dashboardDescription,
      widgets,
      settings: {
        columns: 12,
        rowHeight: 60,
        theme: 'auto',
        autoRefresh: false
      },
      createdAt: dashboard?.createdAt || new Date(),
      updatedAt: new Date(),
      tags: []
    };
    
    onSave?.(dashboardData);
    addNotification({ type: 'success', title: 'Dashboard saved successfully' });
  }, [dashboard, dashboardName, dashboardDescription, widgets, onSave, addNotification]);
  
  // Export dashboard
  const handleExportDashboard = useCallback(() => {
    const data = JSON.stringify({
      name: dashboardName,
      description: dashboardDescription,
      widgets,
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboardName.replace(/\s+/g, '-').toLowerCase()}-dashboard.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addNotification({ type: 'success', title: 'Dashboard exported' });
  }, [dashboardName, dashboardDescription, widgets, addNotification]);
  
  return (
    <div className="flex flex-col h-full bg-blue-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GridIcon size={24} className="text-primary" />
            <div>
              {isEditMode ? (
                <input
                  type="text"
                  value={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  className="text-xl font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary focus:outline-none"
                  placeholder="Dashboard Name"
                />
              ) : (
                <h1 className="text-xl font-bold">{dashboardName}</h1>
              )}
              {dashboardDescription && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{dashboardDescription}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                    isEditMode 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {isEditMode ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
                  {isEditMode ? 'Editing' : 'View Only'}
                </button>
                
                {isEditMode && (
                  <>
                    <button
                      onClick={() => setIsAddingWidget(true)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <PlusIcon size={16} />
                      Add Widget
                    </button>
                    
                    <button
                      onClick={handleSaveDashboard}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
                    >
                      <SaveIcon size={16} />
                      Save
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleExportDashboard}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <DownloadIcon size={16} />
                  Export
                </button>
                
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <SettingsIcon size={20} />
                </button>
              </>
            )}
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XIcon size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Dashboard Grid */}
      <div className="flex-1 overflow-auto p-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map(widget => (
            <div
              key={widget.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              data-grid={{
                x: widget.layout.x,
                y: widget.layout.y,
                w: widget.layout.w,
                h: widget.layout.h,
                minW: widget.layout.minW,
                minH: widget.layout.minH,
                static: widget.locked || !isEditMode
              }}
            >
              {/* Widget Header */}
              <div className="px-4 py-2 bg-blue-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-medium text-sm">{widget.title}</h3>
                {isEditMode && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingWidget(widget.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <SettingsIcon size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleLock(widget.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {widget.locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
                    </button>
                    <button
                      onClick={() => handleRemoveWidget(widget.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded transition-colors"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Widget Content */}
              <div className="p-4 h-full">
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <div className="text-4xl mb-2">
                      {WIDGET_CATALOG.find(w => w.id === widget.type)?.icon}
                    </div>
                    <p className="text-sm">{widget.title}</p>
                    <p className="text-xs mt-1">Widget Placeholder</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
        
        {widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <GridIcon size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No widgets yet
            </h2>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              Start building your dashboard by adding widgets
            </p>
            {!readOnly && (
              <button
                onClick={() => setIsAddingWidget(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors"
              >
                <PlusIcon size={20} />
                Add Your First Widget
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Add Widget Modal */}
      {isAddingWidget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add Widget</h2>
                <button
                  onClick={() => setIsAddingWidget(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XIcon size={20} />
                </button>
              </div>
              
              {/* Category Filter */}
              <div className="flex gap-2 mt-4">
                {widgetCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredWidgets.map(widget => (
                  <button
                    key={widget.id}
                    onClick={() => handleAddWidget(widget)}
                    className="p-4 bg-blue-50 dark:bg-gray-900 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-800 transition-colors text-center group"
                  >
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                      {widget.icon}
                    </div>
                    <h3 className="font-medium text-sm">{widget.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {widget.category}
                    </p>
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