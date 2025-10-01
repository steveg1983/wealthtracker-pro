/**
 * Base interface for widget settings
 * Can be extended by individual widgets as needed
 */
export interface WidgetSettings {
  // Widget-specific settings can be added here
  // For now, keeping it as an empty interface to replace 'any'
}

/**
 * Common props for all dashboard widgets
 */
export interface BaseWidgetProps {
  size?: 'small' | 'medium' | 'large';
  settings?: WidgetSettings;
}