import type { AlertConfig } from './types';

export const DEFAULT_ALERT_CONFIGS: AlertConfig[] = [
  {
    id: '1',
    name: 'Budget Warning',
    enabled: true,
    thresholds: { warning: 75, critical: 90 },
    notificationTypes: { inApp: true, email: false, push: false },
    frequency: 'realtime',
    categories: [],
    sound: false,
    vibrate: false
  },
  {
    id: '2',
    name: 'Overspending Alert',
    enabled: true,
    thresholds: { warning: 90, critical: 100 },
    notificationTypes: { inApp: true, email: true, push: true },
    frequency: 'realtime',
    categories: [],
    sound: true,
    vibrate: true
  },
  {
    id: '3',
    name: 'Weekly Summary',
    enabled: false,
    thresholds: { warning: 50, critical: 80 },
    notificationTypes: { inApp: true, email: true, push: false },
    frequency: 'weekly',
    categories: [],
    sound: false,
    vibrate: false
  }
];