import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { dashboardWidgetService, type WidgetConfig } from '../services/dashboardWidgetService';
import { WidgetRegistry, type WidgetInstance, type WidgetSize } from '../components/widgets/WidgetRegistry';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import { ProfessionalIcon } from '../components/icons/ProfessionalIcons';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('DashboardV2');
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);
const breakpointKeys = ['lg', 'md', 'sm', 'xs', 'xxs'] as const;
type BreakpointKey = typeof breakpointKeys[number];
type ResponsiveLayouts = Record<BreakpointKey, Layout[]>;

const createEmptyLayouts = (): ResponsiveLayouts => {
  return breakpointKeys.reduce<ResponsiveLayouts>((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as ResponsiveLayouts);
};

const isLayoutItem = (value: unknown): value is Layout => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Layout>;
  return (
    typeof candidate.i === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.w === 'number' &&
    typeof candidate.h === 'number'
  );
};

const normalizeLayouts = (raw: unknown): ResponsiveLayouts => {
  const base = createEmptyLayouts();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const source = raw as Record<string, unknown>;
  for (const key of breakpointKeys) {
    const items = source[key];
    if (Array.isArray(items)) {
      base[key] = items.filter(isLayoutItem).map(item => ({ ...item }));
    }
  }

  return base;
};

const isWidgetConfig = (value: unknown): value is WidgetConfig => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<WidgetConfig>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.size === 'string' &&
    typeof candidate.isVisible === 'boolean' &&
    typeof candidate.settings === 'object' &&
    candidate.settings !== null
  );
};

const normalizeWidgets = (raw: unknown): WidgetConfig[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isWidgetConfig)
    .map(widget => ({
      ...widget,
      settings: widget.settings ?? {}
    }));
};

const widgetDimension = (size: WidgetSize): { width: number; height: number } => {
  switch (size) {
    case 'full':
      return { width: 12, height: 4 };
    case 'large':
      return { width: 6, height: 4 };
    case 'medium':
      return { width: 4, height: 3 };
    default:
      return { width: 2, height: 2 };
  }
};

const toWidgetConfig = (widget: WidgetInstance): WidgetConfig => {
  const base: WidgetConfig = {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    size: widget.size,
    position: widget.position ?? { x: 0, y: 0 },
    isVisible: widget.isVisible,
    settings: widget.settings
  };

  if (widget.order !== undefined) {
    base.order = widget.order;
  }

  return base;
};

const breakpointSizes: Record<BreakpointKey, number> = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const breakpointColumns: Record<BreakpointKey, number> = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

// Lazy load modals
const AddWidgetModal = lazy(() => import('../components/dashboard/AddWidgetModal'));
const ExportModal = lazy(() => import('../components/export/ExportModal'));
const LayoutTemplatesModal = lazy(() => import('../components/dashboard/LayoutTemplatesModal'));

export default function DashboardV2(): React.JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accounts, transactions, budgets, goals, refreshData } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { firstName } = usePreferences();
  
  // Dashboard state
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => createEmptyLayouts());
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal state
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const generateDefaultLayouts = useCallback((widgetList: WidgetConfig[]): ResponsiveLayouts => {
    const base = createEmptyLayouts();

    widgetList.forEach((widget, index) => {
      const { width, height } = widgetDimension(widget.size);

      for (const breakpoint of breakpointKeys) {
        const maxCols = breakpointColumns[breakpoint];
        const clampedWidth = Math.min(width, maxCols);
        const xPosition = Math.min((index % 3) * 4, Math.max(0, maxCols - clampedWidth));

        base[breakpoint].push({
          i: widget.id,
          x: xPosition,
          y: Math.floor(index / 3) * 3,
          w: clampedWidth,
          h: height,
          minW: 2,
          minH: 2,
          static: !isEditMode
        });
      }
    });

    return base;
  }, [isEditMode]);

  const loadDefaultLayout = useCallback(() => {
    const defaultWidgets = dashboardWidgetService.getDefaultWidgets();
    setLayouts(generateDefaultLayouts(defaultWidgets));
    setWidgets(defaultWidgets);
  }, [generateDefaultLayouts]);

  const loadDashboardLayout = useCallback(async () => {
    try {
      setIsLoading(true);

      if (user) {
        const savedLayout = await dashboardWidgetService.getLayout(user.id);
        if (savedLayout) {
          const normalizedLayouts = normalizeLayouts(savedLayout.layoutConfig);
          const normalizedWidgets = normalizeWidgets(savedLayout.widgets);

          if (normalizedWidgets.length > 0) {
            setLayouts(normalizedLayouts);
            setWidgets(normalizedWidgets);
            return;
          }
        }

        loadDefaultLayout();
        return;
      }

      const savedLayouts = localStorage.getItem('dashboardV2Layouts');
      if (savedLayouts) {
        try {
          const parsed = JSON.parse(savedLayouts) as { layouts?: unknown; widgets?: unknown };
          const normalizedLayouts = normalizeLayouts(parsed.layouts);
          const normalizedWidgets = normalizeWidgets(parsed.widgets);

          if (normalizedWidgets.length > 0) {
            setLayouts(normalizedLayouts);
            setWidgets(normalizedWidgets);
            return;
          }
        } catch (parseError) {
          logger.warn('Failed to parse dashboard layouts from localStorage', parseError);
        }
      }

      loadDefaultLayout();
    } catch (error) {
      logger.error('Failed to load dashboard layout:', error);
      loadDefaultLayout();
    } finally {
      setIsLoading(false);
    }
  }, [loadDefaultLayout, user]);

  useEffect(() => {
    void loadDashboardLayout();
  }, [loadDashboardLayout]);
  
  // Handle layout change
  const handleLayoutChange = useCallback((_: Layout[], updatedLayouts: Record<string, Layout[]>) => {
    const normalized = normalizeLayouts(updatedLayouts);
    setLayouts(normalized);

    if (user) {
      dashboardWidgetService.saveLayout(user.id, {
        name: 'default',
        layoutConfig: normalized,
        widgets
      });
    } else {
      localStorage.setItem(
        'dashboardV2Layouts',
        JSON.stringify({ layouts: normalized, widgets })
      );
    }
  }, [user, widgets]);
  
  // Add new widget
  const handleAddWidget = (widgetType: string) => {
    const widgetInstance = WidgetRegistry.createWidget(widgetType);
    if (!widgetInstance) {
      setShowAddWidget(false);
      return;
    }

    const widgetConfig = toWidgetConfig(widgetInstance);
    const { width, height } = widgetDimension(widgetConfig.size);

    setWidgets(prev => [...prev, widgetConfig]);
    setLayouts(prev => {
      const next = { ...prev };

      for (const breakpoint of breakpointKeys) {
        const maxCols = breakpointColumns[breakpoint];
        const clampedWidth = Math.min(width, maxCols);
        next[breakpoint] = [
          ...next[breakpoint],
          {
            i: widgetConfig.id,
            x: 0,
            y: 1000,
            w: clampedWidth,
            h: height,
            minW: 2,
            minH: 2
          }
        ];
      }

      return next;
    });

    setShowAddWidget(false);
  };
  
  // Remove widget
  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(widget => widget.id !== widgetId));

    setLayouts(prev => {
      const next = { ...prev };
      for (const breakpoint of breakpointKeys) {
        next[breakpoint] = prev[breakpoint].filter(item => item.i !== widgetId);
      }
      return next;
    });
  };
  
  // Update widget settings
  const handleUpdateWidget = (widgetId: string, settings: Record<string, unknown>) => {
    setWidgets(prev => prev.map(widget =>
      widget.id === widgetId ? { ...widget, settings } : widget
    ));
  };
  
  // Refresh all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(prev => {
      const nextEditMode = !prev;

      setLayouts(previousLayouts => {
        const nextLayouts = { ...previousLayouts };
        for (const breakpoint of breakpointKeys) {
          nextLayouts[breakpoint] = previousLayouts[breakpoint].map(item => ({
            ...item,
            static: !nextEditMode
          }));
        }
        return nextLayouts;
      });

      return nextEditMode;
    });
  };
  
  // Calculate key metrics for welcome message
  const metrics = useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    
    const netWorth = totalAssets - totalLiabilities;
    
    // Calculate monthly savings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    const monthlyIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const monthlySavings = monthlyIncome - monthlyExpenses;
    
    return { netWorth, monthlySavings, totalAssets, totalLiabilities };
  }, [accounts, transactions]);
  
  return (
    <PageWrapper title="Dashboard">
      <div className="min-h-screen">
        {/* Welcome Section */}
        <div 
          className="rounded-2xl mt-4 p-6 text-gray-600 dark:text-gray-300 shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59, 130, 246, 0.1)'
          }}
        >
          <div className="max-w-full mx-auto">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                  Welcome back{firstName ? `, ${firstName}` : ''}!
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Your net worth is {formatCurrency(metrics.netWorth)} • 
                  {metrics.monthlySavings >= 0 ? ' Saved ' : ' Spent '} 
                  {formatCurrency(Math.abs(metrics.monthlySavings))} this month
                </p>
              </div>
              
              {/* Dashboard Controls */}
              <div className="flex items-center space-x-2">
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Refresh data"
                >
                  <ProfessionalIcon
                    name="refresh"
                    size={20}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                </button>
                
                {/* Export Button */}
                <button
                  onClick={() => setShowExport(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Export data"
                >
                  <ProfessionalIcon name="download" size={20} />
                </button>
                
                {/* Templates Button */}
                <button
                  onClick={() => setShowTemplates(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Layout templates"
                >
                  <ProfessionalIcon name="grid" size={20} />
                </button>
                
                {/* Add Widget Button */}
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Add widget"
                >
                  <ProfessionalIcon name="add" size={20} />
                </button>
                
                {/* Edit Mode Toggle */}
                <button
                  onClick={toggleEditMode}
                  className={`p-2 rounded-lg transition-colors ${
                    isEditMode 
                      ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' 
                      : 'bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 text-gray-600 dark:text-gray-300'
                  }`}
                  title={isEditMode ? 'Lock layout' : 'Edit layout'}
                >
                  <ProfessionalIcon
                    name={isEditMode ? 'unlock' : 'lock'}
                    size={20}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Dashboard Grid */}
        <div className="max-w-full mx-auto py-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} className="h-48" />
              ))}
            </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              onLayoutChange={handleLayoutChange}
              breakpoints={breakpointSizes}
              cols={breakpointColumns}
              rowHeight={60}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              useCSSTransforms={true}
            >
              {widgets.filter(w => w.isVisible).map(widget => (
                <div 
                  key={widget.id} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Widget Header */}
                  {isEditMode && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b flex justify-between items-center">
                      <span className="text-sm font-medium">{widget.title}</span>
                      <button
                        onClick={() => handleRemoveWidget(widget.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Widget Content */}
                  <div className="p-4 h-full">
                    {WidgetRegistry.renderWidget(widget, {
                      accounts,
                      transactions,
                      budgets,
                      goals,
                      formatCurrency,
                      navigate,
                      onUpdate: (settings: Record<string, unknown>) => handleUpdateWidget(widget.id, settings)
                    })}
                  </div>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
        
        {/* Modals */}
        <Suspense fallback={null}>
          {showAddWidget && (
            <AddWidgetModal
              isOpen={showAddWidget}
              onClose={() => setShowAddWidget(false)}
              onAdd={handleAddWidget}
              existingWidgets={widgets}
            />
          )}
          
          {showExport && (
            <ExportModal
              isOpen={showExport}
              onClose={() => setShowExport(false)}
              accounts={accounts}
              transactions={transactions}
              budgets={budgets}
              goals={goals}
            />
          )}
          
          {showTemplates && (
            <LayoutTemplatesModal
              isOpen={showTemplates}
              onClose={() => setShowTemplates(false)}
              onSelect={(template) => {
                setLayouts(normalizeLayouts(template.layouts));
                setWidgets(normalizeWidgets(template.widgets));
                setShowTemplates(false);
              }}
            />
          )}
        </Suspense>
      </div>
    </PageWrapper>
  );
}
