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

import {
  ensureSupabaseClient,
  isSupabaseStub,
  type SupabaseDatabase
} from '@wealthtracker/core';
import type { Json } from '@app-types/supabase';
import { userIdService } from './userIdService';
import { lazyLogger as logger } from './serviceFactory';

export interface WidgetPosition {
  x: number;
  y: number;
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

const SERVICE_PREFIX = '[DashboardWidgetService]';

type DashboardSupabaseClient = SupabaseDatabase;

class DashboardWidgetService {
  private readonly storageKey = 'dashboard-widgets';
  private readonly layoutsKey = 'dashboard-layouts';

  private serializeWidgets(widgets: WidgetConfig[]): Json {
    return JSON.parse(JSON.stringify(widgets)) as Json;
  }

  private normalizeWidget(value: unknown): WidgetConfig | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) {
      return null;
    }

    const type = typeof record.type === 'string' ? record.type : 'custom';
    const title = typeof record.title === 'string' ? record.title : type;

    const size = record.size;
    const validSize = size === 'small' || size === 'medium' || size === 'large' || size === 'full'
      ? (size as WidgetConfig['size'])
      : 'medium';

    const positionCandidate = record.position as Record<string, unknown> | undefined;
    const position: WidgetPosition = {
      x: typeof positionCandidate?.x === 'number' ? positionCandidate.x : 0,
      y: typeof positionCandidate?.y === 'number' ? positionCandidate.y : 0
    };

    const isVisible = typeof record.isVisible === 'boolean' ? record.isVisible : true;
    const settings = record.settings && typeof record.settings === 'object' && !Array.isArray(record.settings)
      ? (record.settings as Record<string, unknown>)
      : {};
    const order = typeof record.order === 'number' ? record.order : undefined;

    const widget: WidgetConfig = {
      id,
      type,
      title,
      size: validSize,
      position,
      isVisible,
      settings
    };

    if (order !== undefined) {
      widget.order = order;
    }

    return widget;
  }

  private deserializeWidgets(value: Json | null | undefined): WidgetConfig[] {
    if (!value || !Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => this.normalizeWidget(item))
      .filter((widget): widget is WidgetConfig => widget !== null);
  }

  private async getClient(context: string): Promise<DashboardSupabaseClient | null> {
    try {
      const client = await ensureSupabaseClient();
      if (!client || isSupabaseStub(client)) {
        logger.warn(`${SERVICE_PREFIX} Supabase unavailable during ${context}`);
        return null;
      }
      return client;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Failed to resolve Supabase client for ${context}`, error);
      return null;
    }
  }

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
      const client = await this.getClient('getWidgets');
      if (!client) {
        return this.getFromLocalStorage();
      }

      const { data, error } = await client
        .from('dashboard_layouts')
        .select('widgets')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (!error && data?.widgets) {
        const parsed = this.deserializeWidgets(data.widgets);
        if (parsed.length > 0) {
          return parsed;
        }
      }

      // Fall back to localStorage
      return this.getFromLocalStorage();
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting widgets`, error);
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
      const client = await this.getClient('saveWidgets');
      if (!client) {
        return;
      }

      const { error } = await client
        .from('dashboard_layouts')
        .upsert({
          user_id: userId,
          name: 'Default Layout',
          widgets: this.serializeWidgets(widgets),
          is_default: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.error(`${SERVICE_PREFIX} Error saving widgets to database`, error);
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error saving widgets`, error);
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
      const sanitizedUpdates = this.sanitizeWidgetUpdates(updates);
      const widget = widgets[widgetIndex];
      if (!widget) {
        return;
      }

      if (sanitizedUpdates.type !== undefined) {
        widget.type = sanitizedUpdates.type;
      }

      if (sanitizedUpdates.title !== undefined) {
        widget.title = sanitizedUpdates.title;
      }

      if (sanitizedUpdates.size !== undefined) {
        widget.size = sanitizedUpdates.size;
      }

      if (sanitizedUpdates.position !== undefined) {
        widget.position = sanitizedUpdates.position;
      }

      if (sanitizedUpdates.isVisible !== undefined) {
        widget.isVisible = sanitizedUpdates.isVisible;
      }

      if (sanitizedUpdates.settings !== undefined) {
        widget.settings = sanitizedUpdates.settings;
      }

      if (sanitizedUpdates.order !== undefined) {
        widget.order = sanitizedUpdates.order;
      }

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

  private sanitizeWidgetUpdates(
    updates: Partial<WidgetConfig>
  ): Partial<Omit<WidgetConfig, 'id'>> {
    const { id: _ignoredId, ...rest } = updates;
    const sanitized: Partial<Omit<WidgetConfig, 'id'>> = {};

    if (rest.type !== undefined) {
      sanitized.type = rest.type;
    }

    if (rest.title !== undefined) {
      sanitized.title = rest.title;
    }

    if (rest.size !== undefined) {
      sanitized.size = rest.size;
    }

    if (rest.position !== undefined) {
      sanitized.position = rest.position;
    }

    if (rest.isVisible !== undefined) {
      sanitized.isVisible = rest.isVisible;
    }

    if (rest.settings !== undefined) {
      sanitized.settings = rest.settings;
    }

    if (rest.order !== undefined) {
      sanitized.order = rest.order;
    }

    return sanitized;
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
      layoutConfig: unknown;
      widgets: WidgetConfig[];
    }
  ): Promise<void> {
    try {
      const client = await this.getClient('saveLayout');
      if (!client) {
        this.persistLayoutFallback(layout);
        return;
      }

      const payload = {
        user_id: userId,
        name: layout.name,
        widgets: this.serializeWidgets(layout.widgets),
        is_default: false,
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('dashboard_layouts')
        .upsert(payload, {
          onConflict: 'user_id,name'
        });

      if (error) {
        logger.error(`${SERVICE_PREFIX} Error saving layout to database`, error);
        this.persistLayoutFallback(layout);
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error saving layout`, error);
      this.persistLayoutFallback(layout);
    }
  }

  /**
   * Get the active dashboard layout
   */
  async getLayout(userId: string): Promise<{ id: string; name: string; layoutConfig: unknown; widgets: WidgetConfig[] } | null> {
    try {
      const client = await this.getClient('getLayout');
      if (!client) {
        return this.retrieveLayoutFallback();
      }

      const { data, error } = await client
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          layoutConfig: null,
          widgets: this.deserializeWidgets(data.widgets)
        };
      }

      return this.retrieveLayoutFallback();
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting layout`, error);
      return this.retrieveLayoutFallback();
    }
  }

  /**
   * Save a layout as a preset
   */
  async saveLayoutPreset(
    clerkId: string,
    name: string,
    layoutConfig: unknown,
    widgets: WidgetConfig[]
  ): Promise<DashboardLayout> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const client = await this.getClient('saveLayoutPreset');
      if (!client) {
        throw new Error('Supabase client unavailable');
      }

      const { data, error } = await client
        .from('dashboard_layouts')
        .insert({
          user_id: userId,
          name,
          widgets: this.serializeWidgets(widgets),
          is_default: false,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        widgets: this.deserializeWidgets(data.widgets),
        isDefault: data.is_default,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error saving layout`, error);
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

      const client = await this.getClient('loadLayout');
      if (!client) {
        throw new Error('Supabase client unavailable');
      }

      const { data, error } = await client
        .from('dashboard_layouts')
        .select('widgets')
        .eq('id', layoutId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data?.widgets) {
        const parsed = this.deserializeWidgets(data.widgets);
        await this.saveWidgets(clerkId, parsed);
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error loading layout`, error);
      throw error;
    }
  }

  /**
   * Get all saved layouts
   */
  async getLayouts(clerkId: string): Promise<DashboardLayout[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) {
        return [];
      }

      const client = await this.getClient('getLayouts');
      if (!client) {
        return [];
      }

      const { data, error } = await client
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(layout => ({
        id: layout.id,
        userId: layout.user_id,
        name: layout.name,
        widgets: this.deserializeWidgets(layout.widgets),
        isDefault: layout.is_default,
        createdAt: new Date(layout.created_at),
        updatedAt: new Date(layout.updated_at)
      }));
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error getting layouts`, error);
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

  private persistLayoutFallback(layout: unknown): void {
    if (typeof window === 'undefined') {
      logger.warn(`${SERVICE_PREFIX} Cannot access localStorage to persist layout fallback`);
      return;
    }

    try {
      window.localStorage.setItem('dashboardV2Layouts', JSON.stringify(layout));
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error saving layout fallback to localStorage`, error);
    }
  }

  private retrieveLayoutFallback(): { id: string; name: string; layoutConfig: unknown; widgets: WidgetConfig[] } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const saved = window.localStorage.getItem('dashboardV2Layouts');
      return saved ? JSON.parse(saved) as { id: string; name: string; layoutConfig: unknown; widgets: WidgetConfig[] } : null;
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error reading layout fallback from localStorage`, error);
      return null;
    }
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
    if (typeof window === 'undefined') {
      return this.getDefaultWidgets();
    }

    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error reading widgets from localStorage`, error);
    }
    return this.getDefaultWidgets();
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(widgets: WidgetConfig[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(widgets));
    } catch (error) {
      logger.error(`${SERVICE_PREFIX} Error saving widgets to localStorage`, error);
    }
  }
}

export const dashboardWidgetService = new DashboardWidgetService();
