import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureSupabaseClient,
  isSupabaseStub,
  type SupabaseDatabase
} from '@wealthtracker/core';
import type { Json } from '@app-types/supabase';

interface WidgetSettings {
  compactMode?: boolean;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  chartType?: 'line' | 'bar' | 'area';
  [key: string]: unknown;
}

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  isCompact?: boolean;
  settings?: WidgetSettings;
}

interface DashboardLayout {
  widgets: Widget[];
  order: string[];
}

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  isDefault?: boolean;
}

const EMPTY_LAYOUT: DashboardLayout = {
  widgets: [],
  order: [],
};

const DEFAULT_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'A well-rounded view of your finances',
    isDefault: true,
    layout: {
      widgets: [
        { id: 'netWorth-1', type: 'netWorth', title: 'Net Worth', size: 'medium' },
        { id: 'accounts-1', type: 'accounts', title: 'Accounts', size: 'large' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Cash Flow', size: 'medium' },
        { id: 'budgets-1', type: 'budgets', title: 'Budget Status', size: 'medium' },
        { id: 'savingsGoals-1', type: 'savingsGoals', title: 'Savings Goals', size: 'medium' },
        { id: 'recentAlerts-1', type: 'recentAlerts', title: 'Recent Alerts', size: 'small' }
      ],
      order: ['netWorth-1', 'accounts-1', 'cashFlow-1', 'budgets-1', 'savingsGoals-1', 'recentAlerts-1']
    }
  },
  {
    id: 'budget-focused',
    name: 'Budget Master',
    description: 'Deep focus on budgeting and expense tracking',
    layout: {
      widgets: [
        { id: 'budgets-1', type: 'budgets', title: 'Budget Status', size: 'large' },
        { id: 'expenseCategories-1', type: 'expenseCategories', title: 'Expense Breakdown', size: 'medium' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Cash Flow Analysis', size: 'medium' },
        { id: 'billReminders-1', type: 'billReminders', title: 'Upcoming Bills', size: 'medium' },
        { id: 'transactions-1', type: 'transactions', title: 'Recent Transactions', size: 'large' },
        { id: 'recentAlerts-1', type: 'recentAlerts', title: 'Budget Alerts', size: 'medium' }
      ],
      order: ['budgets-1', 'expenseCategories-1', 'cashFlow-1', 'billReminders-1', 'transactions-1', 'recentAlerts-1']
    }
  },
  {
    id: 'investment-focused',
    name: 'Investment Tracker',
    description: 'Portfolio performance and wealth building',
    layout: {
      widgets: [
        { id: 'investmentPerformance-1', type: 'investmentPerformance', title: 'Portfolio Performance', size: 'large' },
        { id: 'netWorthTrend-1', type: 'netWorthTrend', title: 'Net Worth Trend', size: 'large' },
        { id: 'accounts-1', type: 'accounts', title: 'Investment Accounts', size: 'large' },
        { id: 'savingsGoals-1', type: 'savingsGoals', title: 'Investment Goals', size: 'medium' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Income vs Expenses', size: 'medium' }
      ],
      order: ['investmentPerformance-1', 'netWorthTrend-1', 'accounts-1', 'savingsGoals-1', 'cashFlow-1']
    }
  },
  {
    id: 'debt-payoff',
    name: 'Debt Crusher',
    description: 'Focus on eliminating debt and improving credit',
    layout: {
      widgets: [
        { id: 'debtTracker-1', type: 'debtTracker', title: 'Debt Overview', size: 'large' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Available for Debt Payment', size: 'medium' },
        { id: 'billReminders-1', type: 'billReminders', title: 'Payment Due Dates', size: 'medium' },
        { id: 'savingsGoals-1', type: 'savingsGoals', title: 'Debt Payoff Goals', size: 'medium' },
        { id: 'budgets-1', type: 'budgets', title: 'Expense Control', size: 'medium' },
        { id: 'recentAlerts-1', type: 'recentAlerts', title: 'Payment Reminders', size: 'small' }
      ],
      order: ['debtTracker-1', 'cashFlow-1', 'billReminders-1', 'savingsGoals-1', 'budgets-1', 'recentAlerts-1']
    }
  },
  {
    id: 'retirement-planning',
    name: 'Retirement Ready',
    description: 'Long-term wealth and retirement planning',
    layout: {
      widgets: [
        { id: 'netWorthTrend-1', type: 'netWorthTrend', title: 'Wealth Growth', size: 'large' },
        { id: 'investmentPerformance-1', type: 'investmentPerformance', title: 'Retirement Portfolio', size: 'large' },
        { id: 'savingsGoals-1', type: 'savingsGoals', title: 'Retirement Goals', size: 'medium' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Savings Rate', size: 'medium' },
        { id: 'accounts-1', type: 'accounts', title: 'Retirement Accounts', size: 'large' }
      ],
      order: ['netWorthTrend-1', 'investmentPerformance-1', 'savingsGoals-1', 'cashFlow-1', 'accounts-1']
    }
  },
  {
    id: 'business-owner',
    name: 'Business Dashboard',
    description: 'Track business and personal finances',
    layout: {
      widgets: [
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Business Cash Flow', size: 'large' },
        { id: 'expenseCategories-1', type: 'expenseCategories', title: 'Business Expenses', size: 'medium' },
        { id: 'accounts-1', type: 'accounts', title: 'Business & Personal Accounts', size: 'large' },
        { id: 'billReminders-1', type: 'billReminders', title: 'Vendor Payments', size: 'medium' },
        { id: 'savingsGoals-1', type: 'savingsGoals', title: 'Business Goals', size: 'medium' },
        { id: 'recentAlerts-1', type: 'recentAlerts', title: 'Important Notices', size: 'small' }
      ],
      order: ['cashFlow-1', 'expenseCategories-1', 'accounts-1', 'billReminders-1', 'savingsGoals-1', 'recentAlerts-1']
    }
  },
  {
    id: 'student',
    name: 'Student Budget',
    description: 'Simple tracking for students',
    layout: {
      widgets: [
        { id: 'accounts-1', type: 'accounts', title: 'Bank Accounts', size: 'medium' },
        { id: 'budgets-1', type: 'budgets', title: 'Monthly Budget', size: 'medium' },
        { id: 'expenseCategories-1', type: 'expenseCategories', title: 'Spending Categories', size: 'medium' },
        { id: 'billReminders-1', type: 'billReminders', title: 'Bills & Subscriptions', size: 'small' },
        { id: 'transactions-1', type: 'transactions', title: 'Recent Spending', size: 'medium' }
      ],
      order: ['accounts-1', 'budgets-1', 'expenseCategories-1', 'billReminders-1', 'transactions-1']
    }
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Just the essentials',
    layout: {
      widgets: [
        { id: 'netWorth-1', type: 'netWorth', title: 'Net Worth', size: 'large' },
        { id: 'accounts-1', type: 'accounts', title: 'Accounts', size: 'large' },
        { id: 'cashFlow-1', type: 'cashFlow', title: 'Cash Flow', size: 'medium' }
      ],
      order: ['netWorth-1', 'accounts-1', 'cashFlow-1']
    }
  }
];
const readLocalLayout = (): DashboardLayout | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const saved = window.localStorage.getItem('dashboardLayout');
    return saved ? (JSON.parse(saved) as DashboardLayout) : null;
  } catch (error) {
    console.error('Failed to parse saved layout:', error);
    return null;
  }
};

const writeLocalLayout = (layout: DashboardLayout): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem('dashboardLayout', JSON.stringify(layout));
  } catch (error) {
    console.error('Failed to persist dashboard layout locally:', error);
  }
};

const parseLayoutFromJson = (value: Json | null | undefined): DashboardLayout | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawWidgets = Array.isArray(record.widgets) ? record.widgets : null;
  const rawOrder = Array.isArray(record.order) ? record.order : null;

  if (!rawWidgets || rawWidgets.length === 0) {
    return null;
  }

  const widgets: Widget[] = rawWidgets
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const baseSize = typeof candidate.size === 'string' ? candidate.size : undefined;
      const normalisedSize =
        baseSize === 'small' || baseSize === 'medium' || baseSize === 'large' || baseSize === 'full'
          ? baseSize
          : undefined;

      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.type !== 'string' ||
        typeof candidate.title !== 'string' ||
        !normalisedSize
      ) {
        return null;
      }

      const parsedWidget: Widget = {
        id: candidate.id,
        type: candidate.type,
        title: candidate.title,
        size: normalisedSize,
      };

      if (typeof candidate.isCompact === 'boolean') {
        parsedWidget.isCompact = candidate.isCompact;
      }

      if (candidate.settings && typeof candidate.settings === 'object') {
        parsedWidget.settings = candidate.settings as WidgetSettings;
      }

      return parsedWidget;
    })
    .filter((item): item is Widget => item !== null);

  if (widgets.length === 0) {
    return null;
  }

  const order = rawOrder
    ? rawOrder.filter((entry): entry is string => typeof entry === 'string')
    : widgets.map(widget => widget.id);

  return { widgets, order };
};

const serialiseLayoutToJson = (layout: DashboardLayout): Json => {
  const payload = {
    widgets: layout.widgets,
    order: layout.order
  };
  return JSON.parse(JSON.stringify(payload)) as Json;
};

export function useDashboardLayout() {
  const { user } = useAuth();

  const initialLayout = readLocalLayout()
    ?? DEFAULT_TEMPLATES.find(template => template.isDefault)?.layout
    ?? DEFAULT_TEMPLATES[0]?.layout
    ?? EMPTY_LAYOUT;
  const [layout, setLayout] = useState<DashboardLayout>(initialLayout);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getSupabaseClient = useCallback(async (): Promise<SupabaseDatabase | null> => {
    const client = await ensureSupabaseClient();
    if (isSupabaseStub(client)) {
      return null;
    }
    return client;
  }, []);

  const loadLayoutFromDatabase = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      return;
    }

    const client = await getSupabaseClient();
    if (!client) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await client
        .from('dashboard_layouts')
        .select('widgets')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        const parsedLayout = parseLayoutFromJson(data[0]?.widgets);
        if (parsedLayout) {
          setLayout(parsedLayout);
          writeLocalLayout(parsedLayout);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getSupabaseClient, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    void loadLayoutFromDatabase();
  }, [user?.id, loadLayoutFromDatabase]);

  const saveLayout = useCallback(async (newLayout: DashboardLayout): Promise<void> => {
    setLayout(newLayout);
    writeLocalLayout(newLayout);

    if (!user?.id) {
      return;
    }

    const client = await getSupabaseClient();
    if (!client) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await client
        .from('dashboard_layouts')
        .upsert(
          {
            user_id: user.id,
            name: 'Primary Layout',
            widgets: serialiseLayoutToJson(newLayout),
            is_default: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Failed to save dashboard layout:', error);
      }
    } catch (error) {
      console.error('Failed to save dashboard layout:', error);
    } finally {
      setIsSaving(false);
    }
  }, [getSupabaseClient, user?.id]);

  const addWidget = useCallback((widget: Widget): void => {
    const newLayout = {
      widgets: [...layout.widgets, widget],
      order: [...layout.order, widget.id],
    };
    void saveLayout(newLayout);
  }, [layout, saveLayout]);

  const removeWidget = useCallback((widgetId: string): void => {
    const newLayout = {
      widgets: layout.widgets.filter((w) => w.id !== widgetId),
      order: layout.order.filter((id) => id !== widgetId),
    };
    void saveLayout(newLayout);
  }, [layout, saveLayout]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>): void => {
    const newLayout = {
      ...layout,
      widgets: layout.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)),
    };
    void saveLayout(newLayout);
  }, [layout, saveLayout]);

  const reorderWidgets = useCallback((newOrder: string[]): void => {
    const newLayout = {
      ...layout,
      order: newOrder,
    };
    void saveLayout(newLayout);
  }, [layout, saveLayout]);

  const applyTemplate = useCallback((templateId: string): void => {
    const template = DEFAULT_TEMPLATES.find((t) => t.id === templateId);
    void saveLayout(template?.layout ?? EMPTY_LAYOUT);
  }, [saveLayout]);

  const resetToDefault = useCallback((): void => {
    const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.isDefault) ?? DEFAULT_TEMPLATES[0];
    void saveLayout(defaultTemplate?.layout ?? EMPTY_LAYOUT);
  }, [saveLayout]);

  return {
    layout,
    isLoading,
    isSaving,
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,
    applyTemplate,
    resetToDefault,
    templates: DEFAULT_TEMPLATES,
  };
}
