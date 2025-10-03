import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
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

export function useDashboardLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved layout:', e);
      }
    }
    // Return default layout
    return DEFAULT_TEMPLATES[0].layout;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load layout from database when user changes
  useEffect(() => {
    if (user?.id) {
      loadLayoutFromDatabase();
    }
  }, [user?.id]);

  // Load layout from database
  const loadLayoutFromDatabase = async (): Promise<void> => {
    if (!user?.id || !supabase) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('dashboard_layout')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.dashboard_layout) {
        setLayout(data.dashboard_layout as DashboardLayout);
        // Also save to localStorage for offline access
        localStorage.setItem('dashboardLayout', JSON.stringify(data.dashboard_layout));
      }
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save layout to database
  const saveLayout = useCallback(async (newLayout: DashboardLayout): Promise<void> => {
    setLayout(newLayout);
    
    // Always save to localStorage for immediate persistence
    localStorage.setItem('dashboardLayout', JSON.stringify(newLayout));
    
    // Save to database if user is logged in
    if (!user?.id || !supabase) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          dashboard_layout: newLayout,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.error('Failed to save dashboard layout:', error);
      }
    } catch (error) {
      console.error('Failed to save dashboard layout:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user?.id]);

  // Add widget
  const addWidget = useCallback((widget: Widget): void => {
    const newLayout = {
      widgets: [...layout.widgets, widget],
      order: [...layout.order, widget.id]
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Remove widget
  const removeWidget = useCallback((widgetId: string): void => {
    const newLayout = {
      widgets: layout.widgets.filter(w => w.id !== widgetId),
      order: layout.order.filter(id => id !== widgetId)
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Update widget
  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>): void => {
    const newLayout = {
      ...layout,
      widgets: layout.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      )
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Reorder widgets
  const reorderWidgets = useCallback((newOrder: string[]): void => {
    const newLayout = {
      ...layout,
      order: newOrder
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Apply template
  const applyTemplate = useCallback((templateId: string): void => {
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      saveLayout(template.layout);
    }
  }, [saveLayout]);

  // Reset to default
  const resetToDefault = useCallback((): void => {
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.isDefault) || DEFAULT_TEMPLATES[0];
    saveLayout(defaultTemplate.layout);
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
    templates: DEFAULT_TEMPLATES
  };
}