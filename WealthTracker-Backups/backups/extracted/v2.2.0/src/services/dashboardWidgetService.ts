/**
 * Dashboard Widget Service - Manages customizable dashboard widgets
 * 
 * Features:
 * - Widget configuration persistence
 * - Drag-and-drop positioning
 * - Visibility toggle
 * - Settings management
 * - Default layouts
 */

import { supabase } from '../lib/supabase';
import { userIdService } from './userIdService';
import { logger } from './loggingService';

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface Layouts {
  lg?: LayoutItem[];
  md?: LayoutItem[];
  sm?: LayoutItem[];
  xs?: LayoutItem[];
  xxs?: LayoutItem[];
}

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: WidgetPosition;
  isVisible: boolean;
  settings: Record<string, unknown>;
  order?: number;
}

export interface DashboardLayout {
  id?: string;
  userId: string;
  name: string;
  widgets: WidgetConfig[];
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class DashboardWidgetService {
  private readonly storageKey = 'dashboard-widgets';
  private readonly layoutsKey = 'dashboard-layouts';

  /**
   * Get default widget configuration
   */
  getDefaultWidgets(): WidgetConfig[] {
    return [
      {
        id: 'net-worth',
        type: 'net-worth',
        title: 'Net Worth',
        size: 'medium',
        position: { x: 0, y: 0 },
        isVisible: true,
        settings: {},
        order: 0
      },
      {
        id: 'cash-flow',
        type: 'cash-flow',
        title: 'Cash Flow',
        size: 'large',
        position: { x: 2, y: 0 },
        isVisible: true,
        settings: { forecastPeriod: 6 },
        order: 1
      },
      {
        id: 'budget-summary',
        type: 'budget-summary',
        title: 'Budget Summary',
        size: 'medium',
        position: { x: 0, y: 1 },
        isVisible: true,
        settings: { period: 'current' },
        order: 2
      },
      {
        id: 'recent-transactions',
        type: 'recent-transactions',
        title: 'Recent Transactions',
        size: 'medium',
        position: { x: 2, y: 1 },
        isVisible: true,
        settings: { count: 5 },
        order: 3
      }
    ];
  }

  /**
   * Get user's widget configuration
   */
  async getWidgets(clerkId: string): Promise<WidgetConfig[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) {
        return this.getFromLocalStorage();
      }

      // Try to get from Supabase
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('widgets')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (!error && data?.widgets) {
        return data.widgets as WidgetConfig[];
      }

      // Fall back to localStorage
      return this.getFromLocalStorage();
    } catch (error) {
      logger.error('Error getting widgets:', error);
      return this.getFromLocalStorage();
    }
  }

  /**
   * Save widget configuration
   */
  async saveWidgets(clerkId: string, widgets: WidgetConfig[]): Promise<void> {
    // Always save to localStorage for immediate access
    this.saveToLocalStorage(widgets);

    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) return;

      // Save to Supabase
      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
          user_id: userId,
          name: 'Default Layout',
          widgets: widgets,
          is_default: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,is_default'
        });

      if (error) {
        logger.error('Error saving widgets to database:', error);
      }
    } catch (error) {
      logger.error('Error saving widgets:', error);
    }
  }

  /**
   * Add a new widget
   */
  async addWidget(
    clerkId: string,
    widgetType: string,
    title: string,
    settings?: Record<string, unknown>
  ): Promise<WidgetConfig> {
    const widgets = await this.getWidgets(clerkId);
    
    // Generate unique ID
    const id = `${widgetType}-${Date.now()}`;
    
    // Find optimal position
    const position = this.findOptimalPosition(widgets);
    
    const newWidget: WidgetConfig = {
      id,
      type: widgetType,
      title,
      size: 'medium',
      position,
      isVisible: true,
      settings: settings || {},
      order: widgets.length
    };

    widgets.push(newWidget);
    await this.saveWidgets(clerkId, widgets);
    
    return newWidget;
  }

  /**
   * Remove a widget
   */
  async removeWidget(clerkId: string, widgetId: string): Promise<void> {
    const widgets = await this.getWidgets(clerkId);
    const filtered = widgets.filter(w => w.id !== widgetId);
    
    // Reorder remaining widgets
    filtered.forEach((widget, index) => {
      widget.order = index;
    });
    
    await this.saveWidgets(clerkId, filtered);
  }

  /**
   * Update widget configuration
   */
  async updateWidget(
    clerkId: string,
    widgetId: string,
    updates: Partial<WidgetConfig>
  ): Promise<void> {
    const widgets = await this.getWidgets(clerkId);
    const widgetIndex = widgets.findIndex(w => w.id === widgetId);
    
    if (widgetIndex !== -1) {
      widgets[widgetIndex] = {
        ...widgets[widgetIndex],
        ...updates
      };
      await this.saveWidgets(clerkId, widgets);
    }
  }

  /**
   * Toggle widget visibility
   */
  async toggleWidgetVisibility(clerkId: string, widgetId: string): Promise<void> {
    const widgets = await this.getWidgets(clerkId);
    const widget = widgets.find(w => w.id === widgetId);
    
    if (widget) {
      widget.isVisible = !widget.isVisible;
      await this.saveWidgets(clerkId, widgets);
    }
  }

  /**
   * Update widget position
   */
  async updateWidgetPosition(
    clerkId: string,
    widgetId: string,
    position: WidgetPosition
  ): Promise<void> {
    await this.updateWidget(clerkId, widgetId, { position });
  }

  /**
   * Reorder widgets
   */
  async reorderWidgets(clerkId: string, widgetIds: string[]): Promise<void> {
    const widgets = await this.getWidgets(clerkId);
    
    // Create a map for quick lookup
    const widgetMap = new Map(widgets.map(w => [w.id, w]));
    
    // Reorder based on provided IDs
    const reordered = widgetIds
      .map((id, index) => {
        const widget = widgetMap.get(id);
        if (widget) {
          widget.order = index;
        }
        return widget;
      })
      .filter(Boolean) as WidgetConfig[];
    
    await this.saveWidgets(clerkId, reordered);
  }

  /**
   * Save a complete dashboard layout
   */
  async saveLayout(
    userId: string,
    layout: {
      name: string;
      layoutConfig: Layouts;
      widgets: WidgetConfig[];
    }
  ): Promise<void> {
    try {
      // Save to database
      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
          user_id: userId,
          name: layout.name,
          layout_config: layout.layoutConfig,
          widgets: layout.widgets,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,is_active'
        });

      if (error) {
        logger.error('Error saving layout to database:', error);
        // Fall back to localStorage
        localStorage.setItem('dashboardV2Layouts', JSON.stringify(layout));
      }
    } catch (error) {
      logger.error('Error saving layout:', error);
      localStorage.setItem('dashboardV2Layouts', JSON.stringify(layout));
    }
  }

  /**
   * Get the active dashboard layout
   */
  async getLayout(userId: string): Promise<{
    id?: string;
    name: string;
    layoutConfig: Layouts;
    widgets: WidgetConfig[];
  } | null> {
    try {
      // Get from database
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          layoutConfig: data.layout_config,
          widgets: data.widgets
        };
      }

      // Fall back to localStorage
      const saved = localStorage.getItem('dashboardV2Layouts');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      logger.error('Error getting layout:', error);
      return null;
    }
  }

  /**
   * Save a layout as a preset
   */
  async saveLayoutPreset(
    clerkId: string,
    name: string,
    layoutConfig: Layouts,
    widgets: WidgetConfig[]
  ): Promise<DashboardLayout> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('dashboard_layouts')
        .insert({
          user_id: userId,
          name,
          layout_config: layoutConfig,
          widgets,
          is_default: false,
          is_active: false
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        widgets: data.widgets,
        isDefault: data.is_default,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error('Error saving layout:', error);
      throw error;
    }
  }

  /**
   * Load a saved layout
   */
  async loadLayout(clerkId: string, layoutId: string): Promise<void> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('widgets')
        .eq('id', layoutId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data?.widgets) {
        await this.saveWidgets(clerkId, data.widgets);
      }
    } catch (error) {
      logger.error('Error loading layout:', error);
      throw error;
    }
  }

  /**
   * Get all saved layouts
   */
  async getLayouts(clerkId: string): Promise<DashboardLayout[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) return [];

      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(layout => ({
        id: layout.id,
        userId: layout.user_id,
        name: layout.name,
        widgets: layout.widgets,
        isDefault: layout.is_default,
        createdAt: new Date(layout.created_at),
        updatedAt: new Date(layout.updated_at)
      }));
    } catch (error) {
      logger.error('Error getting layouts:', error);
      return [];
    }
  }

  /**
   * Reset to default layout
   */
  async resetToDefault(clerkId: string): Promise<void> {
    const defaultWidgets = this.getDefaultWidgets();
    await this.saveWidgets(clerkId, defaultWidgets);
  }

  /**
   * Find optimal position for new widget
   */
  private findOptimalPosition(widgets: WidgetConfig[]): WidgetPosition {
    // Simple grid-based positioning
    const maxY = Math.max(...widgets.map(w => w.position.y), -1);
    const widgetsInLastRow = widgets.filter(w => w.position.y === maxY);
    const maxX = Math.max(...widgetsInLastRow.map(w => w.position.x), -1);
    
    // Try to place in the same row if there's space
    if (maxX < 3) {
      return { x: maxX + 1, y: maxY };
    }
    
    // Otherwise, start a new row
    return { x: 0, y: maxY + 1 };
  }

  /**
   * Get from localStorage
   */
  private getFromLocalStorage(): WidgetConfig[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error reading from localStorage:', error);
    }
    return this.getDefaultWidgets();
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(widgets: WidgetConfig[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(widgets));
    } catch (error) {
      logger.error('Error saving to localStorage:', error);
    }
  }
}

export const dashboardWidgetService = new DashboardWidgetService();