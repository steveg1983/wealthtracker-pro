import type { Anomaly, AnomalyDetectionConfig } from '../../services/anomalyDetectionService';

export interface AnomalyDetectionState {
  anomalies: Anomaly[];
  loading: boolean;
  config: AnomalyDetectionConfig;
  showSettings: boolean;
  selectedAnomaly: Anomaly | null;
}

export const ANOMALY_ICONS = {
  unusual_amount: 'DollarSignIcon',
  frequency_spike: 'TrendingUpIcon',
  new_merchant: 'ShieldIcon',
  category_overspend: 'AlertTriangleIcon',
  time_pattern: 'ClockIcon',
  duplicate_charge: 'RepeatIcon'
} as const;

export const ANOMALY_COLORS = {
  high: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200',
  medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
  low: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200'
} as const;