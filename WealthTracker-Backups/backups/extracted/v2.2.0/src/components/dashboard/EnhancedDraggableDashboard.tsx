import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { usePreferences } from '../../contexts/PreferencesContext';
import { DraggableWidget } from './DraggableWidget';
import AddWidgetModal from '../AddWidgetModal';
import DashboardTemplateSelector from './DashboardTemplateSelector';
import {
  DebtTrackerWidget,
  BillRemindersWidget,
  InvestmentPerformanceWidget,
  SavingsGoalsWidget,
  CashFlowWidget,
  RecentAlertsWidget,
  NetWorthTrendWidget,
  ExpenseCategoriesWidget
} from './widgets';
import { 
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  TargetIcon,
  CreditCardIcon,
  PieChartIcon,
  BanknoteIcon,
  CalendarIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  EditIcon,
  SaveIcon,
  GridIcon as LayoutIcon,
  ArrowRightLeftIcon
} from '../icons';
import { toDecimal } from '../../utils/decimal';
import { formatCurrency } from '../../utils/formatters';

// Widget type definitions
interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
}

interface WidgetLayout {
  widgets: Widget[];
  order: string[];
}

// Available widget types
const WIDGET_TYPES = {
  netWorth: { title: 'Net Worth', icon: WalletIcon, defaultSize: 'medium', description: 'Track your total net worth' },
  netWorthTrend: { title: 'Net Worth Trend', icon: TrendingUpIcon, defaultSize: 'large', description: 'Historical net worth chart' },
  accounts: { title: 'Accounts Overview', icon: BanknoteIcon, defaultSize: 'large', description: 'View all your accounts' },
  transactions: { title: 'Recent Transactions', icon: CreditCardIcon, defaultSize: 'large', description: 'Latest transactions' },
  budgets: { title: 'Budget Status', icon: PieChartIcon, defaultSize: 'medium', description: 'Budget tracking' },
  savingsGoals: { title: 'Savings Goals', icon: TargetIcon, defaultSize: 'large', description: 'Track savings goals progress' },
  debtTracker: { title: 'Debt Tracker', icon: CreditCardIcon, defaultSize: 'medium', description: 'Monitor debts and loans' },
  billReminders: { title: 'Bill Reminders', icon: CalendarIcon, defaultSize: 'medium', description: 'Upcoming bills and payments' },
  investmentPerformance: { title: 'Investment Performance', icon: TrendingUpIcon, defaultSize: 'large', description: 'Portfolio performance' },
  cashFlow: { title: 'Cash Flow', icon: ArrowRightLeftIcon, defaultSize: 'large', description: 'Income vs expenses' },
  recentAlerts: { title: 'Recent Alerts', icon: AlertCircleIcon, defaultSize: 'medium', description: 'Important notifications' },
  expenseCategories: { title: 'Expense Categories', icon: PieChartIcon, defaultSize: 'medium', description: 'Spending by category' }
};

export default function EnhancedDraggableDashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency: formatCurrencyWithSymbol } = useCurrencyDecimal();
  const { preferences, updatePreferences } = usePreferences();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layout, setLayout] = useState<WidgetLayout>(() => {
    // Load saved layout or use default
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Default layout
    return {
      widgets: [
        { id: 'netWorth-1', type: 'netWorth', title: 'Net Worth', size: 'medium' },
        { id: 'accounts-1', type: 'accounts', title: 'Accounts', size: 'large' },
        { id: 'transactions-1', type: 'transactions', title: 'Recent Transactions', size: 'large' },
        { id: 'budgets-1', type: 'budgets', title: 'Budget Status', size: 'medium' },
        { id: 'goals-1', type: 'goals', title: 'Financial Goals', size: 'medium' }
      ],
      order: ['netWorth-1', 'accounts-1', 'transactions-1', 'budgets-1', 'goals-1']
    };
  });

  // Sensor configuration for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save layout to localStorage and preferences
  useEffect(() => {
    if (!isEditMode) {
      localStorage.setItem('dashboardLayout', JSON.stringify(layout));
      // Also save to user preferences in database
      updatePreferences({ dashboardLayout: layout });
    }
  }, [layout, isEditMode]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(acc.balance)), toDecimal(0));
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), toDecimal(0));
    
    const netWorth = totalAssets.minus(totalLiabilities);
    
    // Monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    
    const monthlyIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
    
    const monthlyExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      savingsRate: monthlyIncome.isZero() ? 0 : 
        monthlyIncome.minus(monthlyExpenses).dividedBy(monthlyIncome).times(100).toNumber()
    };
  }, [accounts, transactions]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setLayout((prev) => {
        const oldIndex = prev.order.indexOf(active.id as string);
        const newIndex = prev.order.indexOf(over.id as string);
        
        return {
          ...prev,
          order: arrayMove(prev.order, oldIndex, newIndex)
        };
      });
    }
    
    setActiveId(null);
  };

  // Add widget
  const handleAddWidget = (type: string) => {
    const widgetConfig = WIDGET_TYPES[type as keyof typeof WIDGET_TYPES];
    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      title: widgetConfig.title,
      size: widgetConfig.defaultSize as Widget['size']
    };
    
    setLayout(prev => ({
      widgets: [...prev.widgets, newWidget],
      order: [...prev.order, newWidget.id]
    }));
    
    setShowAddWidget(false);
  };

  // Remove widget
  const handleRemoveWidget = (id: string) => {
    setLayout(prev => ({
      widgets: prev.widgets.filter(w => w.id !== id),
      order: prev.order.filter(wId => wId !== id)
    }));
  };

  // Toggle widget size
  const handleToggleSize = (id: string) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === id ? { ...w, isCompact: !w.isCompact } : w
      )
    }));
  };

  // Render widget content based on type
  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'netWorth':
        return (
          <div className="space-y-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyWithSymbol(metrics.netWorth.toNumber())}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400">Assets</div>
                <div className="text-green-600 font-semibold">
                  {formatCurrencyWithSymbol(metrics.totalAssets.toNumber())}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Liabilities</div>
                <div className="text-red-600 font-semibold">
                  {formatCurrencyWithSymbol(metrics.totalLiabilities.toNumber())}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'accounts':
        return (
          <div className="space-y-3">
            {accounts.slice(0, widget.isCompact ? 3 : 5).map(account => (
              <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{account.name}</div>
                  <div className="text-xs text-gray-500">{account.type}</div>
                </div>
                <div className={`font-semibold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrencyWithSymbol(account.balance)}
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate('/accounts')}
              className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
            >
              View all accounts →
            </button>
          </div>
        );
      
      case 'transactions':
        const recentTransactions = transactions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, widget.isCompact ? 3 : 5);
        
        return (
          <div className="space-y-3">
            {recentTransactions.map(transaction => (
              <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{transaction.description}</div>
                  <div className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</div>
                </div>
                <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrencyWithSymbol(Math.abs(transaction.amount))}
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate('/transactions')}
              className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
            >
              View all transactions →
            </button>
          </div>
        );
      
      case 'budgets':
        const activeBudgets = budgets.filter(b => b.isActive);
        const overBudget = activeBudgets.filter(b => (b.spent || 0) > b.amount);
        
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Budgets</span>
              <span className="text-2xl font-bold">{activeBudgets.length}</span>
            </div>
            {overBudget.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircleIcon size={20} />
                  <span className="font-medium">{overBudget.length} budgets exceeded</span>
                </div>
              </div>
            )}
            <button
              onClick={() => navigate('/budget')}
              className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
            >
              Manage budgets →
            </button>
          </div>
        );
      
      case 'savingsGoals':
        return <SavingsGoalsWidget isCompact={widget.isCompact} />;
      
      case 'debtTracker':
        return <DebtTrackerWidget isCompact={widget.isCompact} />;
      
      case 'billReminders':
        return <BillRemindersWidget isCompact={widget.isCompact} />;
      
      case 'investmentPerformance':
        return <InvestmentPerformanceWidget isCompact={widget.isCompact} />;
      
      case 'cashFlow':
        return <CashFlowWidget isCompact={widget.isCompact} />;
      
      case 'recentAlerts':
        return <RecentAlertsWidget isCompact={widget.isCompact} />;
      
      case 'netWorthTrend':
        return <NetWorthTrendWidget isCompact={widget.isCompact} />;
      
      case 'expenseCategories':
        return <ExpenseCategoriesWidget isCompact={widget.isCompact} />;
      
      default:
        return <div className="text-gray-500">Widget content</div>;
    }
  };

  // Get active widget for drag overlay
  const activeWidget = activeId ? layout.widgets.find(w => w.id === activeId) : null;

  return (
    <div className="p-4 space-y-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button
                onClick={() => setShowAddWidget(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <PlusCircleIcon size={20} />
                Add Widget
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <SaveIcon size={20} />
                Save Layout
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <LayoutIcon size={20} />
                Templates
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <EditIcon size={20} />
                Edit Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <div className="bg-blue-50 dark:bg-gray-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <LayoutIcon size={20} />
            <span className="font-medium">Edit Mode Active</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-gray-300 mt-1">
            Drag widgets to reorder, click settings to configure, or remove widgets you don't need.
          </p>
        </div>
      )}

      {/* Dashboard Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always
          }
        }}
      >
        <SortableContext items={layout.order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {layout.order.map(widgetId => {
              const widget = layout.widgets.find(w => w.id === widgetId);
              if (!widget) return null;
              
              return (
                <div
                  key={widget.id}
                  className={`
                    ${widget.size === 'small' ? 'md:col-span-1' : ''}
                    ${widget.size === 'medium' ? 'md:col-span-1 lg:col-span-1' : ''}
                    ${widget.size === 'large' ? 'md:col-span-2 lg:col-span-2' : ''}
                  `}
                >
                  <DraggableWidget
                    id={widget.id}
                    title={widget.title}
                    isEditMode={isEditMode}
                    isCompact={widget.isCompact}
                    onRemove={() => handleRemoveWidget(widget.id)}
                    onToggleSize={() => handleToggleSize(widget.id)}
                  >
                    {renderWidgetContent(widget)}
                  </DraggableWidget>
                </div>
              );
            })}
          </div>
        </SortableContext>
        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeWidget ? (
            <div className="opacity-80 transform rotate-3">
              <DraggableWidget
                id={activeWidget.id}
                title={activeWidget.title}
                isDragging
              >
                {renderWidgetContent(activeWidget)}
              </DraggableWidget>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {layout.widgets.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <LayoutIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No widgets added
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start customizing your dashboard by adding widgets
          </p>
          <button
            onClick={() => {
              setIsEditMode(true);
              setShowAddWidget(true);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Add Your First Widget
          </button>
        </div>
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <DashboardTemplateSelector 
          onClose={() => {
            setShowTemplateSelector(false);
            // Reload layout after template selection
            const saved = localStorage.getItem('dashboardLayout');
            if (saved) {
              setLayout(JSON.parse(saved));
            }
          }} 
        />
      )}

      {/* Add Widget Modal */}
      {showAddWidget && (
        <AddWidgetModal
          isOpen={showAddWidget}
          onClose={() => setShowAddWidget(false)}
          onAdd={handleAddWidget}
          availableWidgets={Object.entries(WIDGET_TYPES).map(([key, config]) => ({
            id: key,
            ...config
          }))}
          existingWidgets={layout.widgets.map(w => w.type)}
        />
      )}
    </div>
  );
}