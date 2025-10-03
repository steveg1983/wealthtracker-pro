import { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { useInView } from 'react-intersection-observer';
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
import type { Account, Transaction, Budget, Goal } from '../../types';
import type Decimal from 'decimal.js';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { DraggableWidget } from './DraggableWidget';
import { 
  TrendingUpIcon,
  WalletIcon,
  TargetIcon,
  CreditCardIcon,
  PieChartIcon,
  BanknoteIcon,
  CalendarIcon,
  AlertCircleIcon,
  PlusCircleIcon,
  EditIcon,
  SaveIcon,
  GridIcon as LayoutIcon,
  ArrowRightLeftIcon
} from '../icons';
import { toDecimal } from '../../utils/decimal';

// Lazy load heavy widgets
const DebtTrackerWidget = lazy(() => import('./widgets/DebtTrackerWidget'));
const BillRemindersWidget = lazy(() => import('./widgets/BillRemindersWidget'));
const InvestmentPerformanceWidget = lazy(() => import('./widgets/InvestmentPerformanceWidget'));
const SavingsGoalsWidget = lazy(() => import('./widgets/SavingsGoalsWidget'));
const CashFlowWidget = lazy(() => import('./widgets/CashFlowWidget'));
const RecentAlertsWidget = lazy(() => import('./widgets/RecentAlertsWidget'));
const NetWorthTrendWidget = lazy(() => import('./widgets/NetWorthTrendWidget'));
const ExpenseCategoriesWidget = lazy(() => import('./widgets/ExpenseCategoriesWidget'));
const AddWidgetModal = lazy(() => import('../AddWidgetModal'));
const DashboardTemplateSelector = lazy(() => import('./DashboardTemplateSelector'));

// Widget type definitions
interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
}

// Widget loading skeleton
const WidgetSkeleton = memo(({ size }: { size: string }) => (
  <div className={`
    animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-4
    ${size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'}
  `}>
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3"></div>
    <div className="space-y-2">
      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
    </div>
  </div>
));

// Virtualized widget renderer with lazy loading
const VirtualizedWidget = memo(({ widget, isEditMode, onRemove, onToggleSize, children }: {
  widget: Widget;
  isEditMode: boolean;
  onRemove: () => void;
  onToggleSize: () => void;
  children: React.ReactNode;
}) => {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: '100px' // Start loading 100px before widget comes into view
  });

  return (
    <div ref={ref}>
      {inView ? (
        <DraggableWidget
          id={widget.id}
          title={widget.title}
          isEditMode={isEditMode}
          isCompact={widget.isCompact}
          onRemove={onRemove}
          onToggleSize={onToggleSize}
        >
          <Suspense fallback={<WidgetSkeleton size={widget.size} />}>
            {children}
          </Suspense>
        </DraggableWidget>
      ) : (
        <WidgetSkeleton size={widget.size} />
      )}
    </div>
  );
});

// Memoized widget content renderer
interface WidgetContentProps {
  widget: Widget;
  metrics: {
    totalAssets: Decimal;
    totalLiabilities: Decimal;
    netWorth: Decimal;
  };
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  navigate: (path: string) => void;
  formatCurrencyWithSymbol: (amount: number) => string;
}

const WidgetContent = memo(({ widget, metrics, accounts, transactions, budgets, goals, navigate, formatCurrencyWithSymbol }: WidgetContentProps) => {
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
      
    case 'accounts': {
      const visibleAccounts = widget.isCompact ? accounts.slice(0, 3) : accounts.slice(0, 5);
      return (
        <div className="space-y-3">
          {visibleAccounts.map((account) => (
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
    }
      
    case 'transactions': {
      const recentTransactions = transactions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, widget.isCompact ? 3 : 5);
      
      return (
        <div className="space-y-3">
          {recentTransactions.map((transaction) => (
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
    }
      
    case 'budgets': {
      const activeBudgets = budgets.filter((b) => b.isActive);
      const overBudget = activeBudgets.filter((b) => (b.spent || 0) > b.amount);
      
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
    }
      
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
});

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

export default function OptimizedDashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency: formatCurrencyWithSymbol } = useCurrencyDecimal();
  const { layout, isLoading, addWidget, removeWidget, updateWidget, reorderWidgets, templates } = useDashboardLayout();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Memoized metrics calculation
  const metrics = useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(acc.balance)), toDecimal(0));
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), toDecimal(0));
    
    const netWorth = totalAssets.minus(totalLiabilities);
    
    return {
      totalAssets,
      totalLiabilities,
      netWorth
    };
  }, [accounts]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = layout.order.indexOf(active.id as string);
      const newIndex = layout.order.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(layout.order, oldIndex, newIndex);
        reorderWidgets(newOrder);
      }
    }
    
    setActiveId(null);
  }, [layout.order, reorderWidgets]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    removeWidget(widgetId);
  }, [removeWidget]);

  const handleToggleSize = useCallback((widgetId: string) => {
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (widget) {
      updateWidget(widgetId, { isCompact: !widget.isCompact });
    }
  }, [layout.widgets, updateWidget]);

  const handleAddWidget = useCallback((widgetType: string) => {
    const config = WIDGET_TYPES[widgetType as keyof typeof WIDGET_TYPES];
    if (!config) return;
    
    const newWidget: Widget = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
      title: config.title,
      size: config.defaultSize as Widget['size']
    };
    
    addWidget(newWidget);
    setShowAddWidget(false);
  }, [addWidget]);

  // Get active widget for drag overlay
  const activeWidget = useMemo(() => 
    activeId ? layout.widgets.find(w => w.id === activeId) : null,
    [activeId, layout.widgets]
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <WidgetSkeleton key={i} size="medium" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {isEditMode ? (
            <>
              <button
                onClick={() => setShowAddWidget(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <PlusCircleIcon size={20} />
                Add Widget
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
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

      {/* Dashboard Grid with Virtualization */}
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
                  <VirtualizedWidget
                    widget={widget}
                    isEditMode={isEditMode}
                    onRemove={() => handleRemoveWidget(widget.id)}
                    onToggleSize={() => handleToggleSize(widget.id)}
                  >
                    <WidgetContent
                      widget={widget}
                      metrics={metrics}
                      accounts={accounts}
                      transactions={transactions}
                      budgets={budgets}
                      goals={goals}
                      navigate={navigate}
                      formatCurrencyWithSymbol={formatCurrencyWithSymbol}
                    />
                  </VirtualizedWidget>
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
                <WidgetSkeleton size={activeWidget.size} />
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

      {/* Modals - Lazy loaded */}
      <Suspense fallback={null}>
        {showTemplateSelector && (
          <DashboardTemplateSelector 
            onClose={() => setShowTemplateSelector(false)} 
          />
        )}

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
      </Suspense>
    </div>
  );
}