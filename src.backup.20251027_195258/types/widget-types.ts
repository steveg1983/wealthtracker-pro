import type { JsonValue } from './common';

/**
 * Base type for widget settings that allows nested JSON-compatible values.
 */
export type WidgetSettingValue = JsonValue;

export type WidgetSettings = Record<string, WidgetSettingValue>;

/**
 * Common props for all dashboard widgets
 */
export interface BaseWidgetProps {
  size?: 'small' | 'medium' | 'large';
  settings?: WidgetSettings;
}
