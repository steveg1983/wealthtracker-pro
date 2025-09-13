/**
 * Widget Registry Service
 * Manages widget definitions and instances
 */

import { ReactNode, ComponentType } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon: string;
  component: ComponentType<WidgetComponentProps>;
  defaultSize: 'small' | 'medium' | 'large' | 'full';
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  refreshInterval?: number;
  requiresAuth?: boolean;
  requiresData?: string[];
  category: 'overview' | 'budget' | 'investment' | 'analytics' | 'planning' | 'system';
  defaultSettings?: Record<string, unknown>;
}

export interface WidgetComponentProps {
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position?: { x: number; y: number };
  isVisible: boolean;
  settings: Record<string, unknown>;
  order?: number;
}

class WidgetRegistryService {
  private widgets: Map<string, WidgetDefinition> = new Map();

  /**
   * Register a widget definition
   */
  register(definition: WidgetDefinition): void {
    this.widgets.set(definition.type, definition);
  }

  /**
   * Get a widget definition by type
   */
  getWidget(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  /**
   * Get all registered widgets
   */
  getAllWidgets(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widgets by category
   */
  getWidgetsByCategory(category: string): WidgetDefinition[] {
    return this.getAllWidgets().filter(w => w.category === category);
  }

  /**
   * Create a new widget instance
   */
  createWidget(type: string): WidgetInstance | null {
    const definition = this.getWidget(type);
    if (!definition) return null;

    return {
      id: uuidv4(),
      type,
      title: definition.title,
      size: definition.defaultSize,
      isVisible: true,
      settings: definition.defaultSettings || {},
      order: 999
    };
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllWidgets().forEach(w => categories.add(w.category));
    return Array.from(categories);
  }

  /**
   * Validate widget against available data
   */
  validateWidget(instance: WidgetInstance, availableData: string[]): boolean {
    const definition = this.getWidget(instance.type);
    if (!definition) return false;

    if (definition.requiresData) {
      for (const required of definition.requiresData) {
        if (!availableData.includes(required)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get widget metadata for display
   */
  getWidgetMetadata(type: string): {
    title: string;
    description: string;
    icon: string;
    category: string;
  } | null {
    const definition = this.getWidget(type);
    if (!definition) return null;

    return {
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      category: definition.category
    };
  }

  /**
   * Get size constraints for a widget
   */
  getSizeConstraints(type: string): {
    defaultSize: string;
    minSize: { w: number; h: number };
    maxSize: { w: number; h: number };
  } | null {
    const definition = this.getWidget(type);
    if (!definition) return null;

    return {
      defaultSize: definition.defaultSize,
      minSize: definition.minSize,
      maxSize: definition.maxSize
    };
  }

  /**
   * Check if widget requires authentication
   */
  requiresAuth(type: string): boolean {
    const definition = this.getWidget(type);
    return definition?.requiresAuth || false;
  }

  /**
   * Get refresh interval for widget
   */
  getRefreshInterval(type: string): number | undefined {
    const definition = this.getWidget(type);
    return definition?.refreshInterval;
  }

  /**
   * Update widget instance settings
   */
  updateWidgetSettings(
    instance: WidgetInstance,
    newSettings: Partial<Record<string, unknown>>
  ): WidgetInstance {
    return {
      ...instance,
      settings: {
        ...instance.settings,
        ...newSettings
      }
    };
  }

  /**
   * Sort widgets by order
   */
  sortWidgetsByOrder(instances: WidgetInstance[]): WidgetInstance[] {
    return [...instances].sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  /**
   * Group widgets by category
   */
  groupWidgetsByCategory(
    instances: WidgetInstance[]
  ): Map<string, WidgetInstance[]> {
    const grouped = new Map<string, WidgetInstance[]>();

    instances.forEach(instance => {
      const definition = this.getWidget(instance.type);
      if (!definition) return;

      const category = definition.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)?.push(instance);
    });

    return grouped;
  }

  /**
   * Filter widgets by required data
   */
  filterByRequiredData(
    definitions: WidgetDefinition[],
    availableData: string[]
  ): WidgetDefinition[] {
    return definitions.filter(def => {
      if (!def.requiresData) return true;
      return def.requiresData.every(req => availableData.includes(req));
    });
  }
}

export const widgetRegistryService = new WidgetRegistryService();