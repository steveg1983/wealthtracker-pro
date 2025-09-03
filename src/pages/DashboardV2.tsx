import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { dashboardWidgetService } from '../services/dashboardWidgetService';
import { WidgetRegistry } from '../components/widgets/WidgetRegistry';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import { 
  CogIcon,
  PlusIcon,
  Squares2X2Icon,
  LockClosedIcon,
  LockOpenIcon,
  BookmarkIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { logger } from '../services/loggingService';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Lazy load modals
const AddWidgetModal = lazy(() => import('../components/dashboard/AddWidgetModal'));
const ExportModal = lazy(() => import('../components/export/ExportModal'));
const LayoutTemplatesModal = lazy(() => import('../components/dashboard/LayoutTemplatesModal'));

interface DashboardV2Props {}

export default function DashboardV2(): React.JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accounts, transactions, budgets, goals, refreshData } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { firstName } = usePreferences();
  
  // Dashboard state
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<any>({});
  const [widgets, setWidgets] = useState<any[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<string>('default');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal state
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Breakpoints for responsive design
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
  
  // Load saved layout on mount
  useEffect(() => {
    loadDashboardLayout();
  }, [user]);
  
  // Load dashboard layout from service
  const loadDashboardLayout = async () => {
    try {
      setIsLoading(true);
      
      if (user) {
        // Load from database
        const savedLayout = await dashboardWidgetService.getLayout(user.id);
        if (savedLayout) {
          setLayouts(savedLayout.layoutConfig);
          setWidgets(savedLayout.widgets);
        } else {
          // Use default layout
          loadDefaultLayout();
        }
      } else {
        // Use localStorage for demo mode
        const savedLayouts = localStorage.getItem('dashboardV2Layouts');
        if (savedLayouts) {
          const parsed = JSON.parse(savedLayouts);
          setLayouts(parsed.layouts);
          setWidgets(parsed.widgets);
        } else {
          loadDefaultLayout();
        }
      }
    } catch (error) {
      logger.error('Failed to load dashboard layout:', error);
      loadDefaultLayout();
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load default layout
  const loadDefaultLayout = () => {
    const defaultWidgets = dashboardWidgetService.getDefaultWidgets();
    const defaultLayouts = generateDefaultLayouts(defaultWidgets);
    setLayouts(defaultLayouts);
    setWidgets(defaultWidgets);
  };
  
  // Generate default layouts for all breakpoints
  const generateDefaultLayouts = (widgets: any[]) => {
    const layouts: any = {};
    
    ['lg', 'md', 'sm', 'xs', 'xxs'].forEach(breakpoint => {
      layouts[breakpoint] = widgets.map((widget, index) => ({
        i: widget.id,
        x: (index % 3) * 4,
        y: Math.floor(index / 3) * 3,
        w: widget.size === 'large' ? 6 : widget.size === 'medium' ? 4 : 2,
        h: widget.size === 'large' ? 4 : widget.size === 'medium' ? 3 : 2,
        minW: 2,
        minH: 2,
        static: !isEditMode
      }));
    });
    
    return layouts;
  };
  
  // Handle layout change
  const handleLayoutChange = useCallback((layout: Layout[], layouts: any) => {
    setLayouts(layouts);
    
    // Save to database or localStorage
    if (user) {
      dashboardWidgetService.saveLayout(user.id, {
        name: selectedLayout,
        layoutConfig: layouts,
        widgets: widgets
      });
    } else {
      localStorage.setItem('dashboardV2Layouts', JSON.stringify({
        layouts,
        widgets
      }));
    }
  }, [user, widgets, selectedLayout]);
  
  // Add new widget
  const handleAddWidget = (widgetType: string) => {
    const newWidget = WidgetRegistry.createWidget(widgetType);
    if (newWidget) {
      setWidgets([...widgets, newWidget]);
      
      // Add to layouts
      const newLayouts = { ...layouts };
      Object.keys(newLayouts).forEach(breakpoint => {
        newLayouts[breakpoint].push({
          i: newWidget.id,
          x: 0,
          y: 1000, // Put at bottom
          w: newWidget.size === 'large' ? 6 : newWidget.size === 'medium' ? 4 : 2,
          h: newWidget.size === 'large' ? 4 : newWidget.size === 'medium' ? 3 : 2,
          minW: 2,
          minH: 2
        });
      });
      setLayouts(newLayouts);
    }
    setShowAddWidget(false);
  };
  
  // Remove widget
  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    
    // Remove from layouts
    const newLayouts = { ...layouts };
    Object.keys(newLayouts).forEach(breakpoint => {
      newLayouts[breakpoint] = newLayouts[breakpoint].filter((item: any) => item.i !== widgetId);
    });
    setLayouts(newLayouts);
  };
  
  // Update widget settings
  const handleUpdateWidget = (widgetId: string, settings: any) => {
    setWidgets(widgets.map(w => 
      w.id === widgetId ? { ...w, settings } : w
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
    setIsEditMode(!isEditMode);
    
    // Update static property in layouts
    const newLayouts = { ...layouts };
    Object.keys(newLayouts).forEach(breakpoint => {
      newLayouts[breakpoint] = newLayouts[breakpoint].map((item: any) => ({
        ...item,
        static: isEditMode // Will be opposite after toggle
      }));
    });
    setLayouts(newLayouts);
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
                  <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                
                {/* Export Button */}
                <button
                  onClick={() => setShowExport(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Export data"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </button>
                
                {/* Templates Button */}
                <button
                  onClick={() => setShowTemplates(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Layout templates"
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </button>
                
                {/* Add Widget Button */}
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 dark:bg-gray-700/20 dark:hover:bg-gray-700/30 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                  title="Add widget"
                >
                  <PlusIcon className="h-5 w-5" />
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
                  {isEditMode ? (
                    <LockOpenIcon className="h-5 w-5" />
                  ) : (
                    <LockClosedIcon className="h-5 w-5" />
                  )}
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
              breakpoints={breakpoints}
              cols={cols}
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
                      onUpdate: (settings) => handleUpdateWidget(widget.id, settings)
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
                setLayouts(template.layouts);
                setWidgets(template.widgets);
                setShowTemplates(false);
              }}
            />
          )}
        </Suspense>
      </div>
    </PageWrapper>
  );
}