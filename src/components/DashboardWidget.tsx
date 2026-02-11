import React, { useState } from 'react';
import { 
  GripVerticalIcon, 
  SettingsIcon, 
  MaximizeIcon, 
  MinimizeIcon, 
  XIcon,
  RefreshCwIcon,
  BarChart3Icon,
  TrendingUpIcon,
  PiggyBankIcon,
  CreditCardIcon,
  TargetIcon
} from './icons';

export interface WidgetConfig {
  id: string;
  type: 'net-worth' | 'cash-flow' | 'budget-summary' | 'goal-progress' | 'recent-transactions' | 
        'expense-breakdown' | 'investment-summary' | 'upcoming-bills' | 'weekly-summary' | 
        'monthly-summary' | 'bank-connections' | 'ai-analytics' | 'tax-planning' | 
        'investment-enhancement' | 'security' | 'collaboration' | 'mobile-app' | 
        'business' | 'financial-planning' | 'data-intelligence';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  isVisible: boolean;
  settings: Record<string, string | number | boolean | null>;
  refreshInterval?: number;
  lastRefresh?: Date;
}

interface DashboardWidgetProps {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
  onRemove: (widgetId: string) => void;
  isDragMode?: boolean;
  children: React.ReactNode;
}

const WIDGET_ICONS = {
  'net-worth': TrendingUpIcon,
  'cash-flow': BarChart3Icon,
  'budget-summary': PiggyBankIcon,
  'goal-progress': TargetIcon,
  'recent-transactions': CreditCardIcon,
  'expense-breakdown': BarChart3Icon,
  'investment-summary': TrendingUpIcon,
  'upcoming-bills': CreditCardIcon,
  'weekly-summary': BarChart3Icon,
  'monthly-summary': BarChart3Icon,
  'bank-connections': CreditCardIcon,
  'ai-analytics': TrendingUpIcon,
  'tax-planning': CreditCardIcon,
  'investment-enhancement': TrendingUpIcon,
  'security': SettingsIcon,
  'collaboration': SettingsIcon,
  'mobile-app': SettingsIcon,
  'business': BarChart3Icon,
  'financial-planning': TrendingUpIcon,
  'data-intelligence': BarChart3Icon,
} as const;

export default function DashboardWidget({ 
  config, 
  onConfigChange, 
  onRemove, 
  isDragMode = false,
  children 
}: DashboardWidgetProps): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tempConfig, setTempConfig] = useState(config);

  const IconComponent = WIDGET_ICONS[config.type] || BarChart3Icon;

  const handleRefresh = async (): Promise<void> => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedConfig = {
      ...config,
      lastRefresh: new Date()
    };
    onConfigChange(updatedConfig);
    setIsRefreshing(false);
  };

  const handleSizeChange = (size: 'small' | 'medium' | 'large'): void => {
    onConfigChange({ ...config, size });
  };

  const handleSettingsChange = (key: string, value: string | number | boolean | null): void => {
    setTempConfig({
      ...tempConfig,
      settings: {
        ...tempConfig.settings,
        [key]: value
      }
    });
  };

  const handleSaveSettings = (): void => {
    onConfigChange(tempConfig);
    setShowSettings(false);
  };

  const handleCancelSettings = (): void => {
    setTempConfig(config);
    setShowSettings(false);
  };

  const getSizeClasses = (): string => {
    switch (config.size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-2 row-span-2';
      default: return 'col-span-1 row-span-1';
    }
  };

  return (
    <div className={`relative group ${getSizeClasses()}`}>
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 h-full flex flex-col">
        {/* Widget Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isDragMode && (
              <GripVerticalIcon 
                className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                size={20}
              />
            )}
            <IconComponent className="text-[var(--color-primary)]" size={20} />
            <h3 className="font-semibold text-gray-900 dark:text-white">{config.title}</h3>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="min-w-[44px] min-h-[44px] p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 rounded-lg"
              title="Refresh"
              aria-label="Refresh widget"
            >
              <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="min-w-[44px] min-h-[44px] p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              title="Settings"
              aria-label="Widget settings"
            >
              <SettingsIcon size={16} />
            </button>
            
            <div className="flex">
              <button
                onClick={() => handleSizeChange('small')}
                className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg ${config.size === 'small' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Small"
                aria-label="Resize to small"
                aria-pressed={config.size === 'small'}
              >
                <MinimizeIcon size={16} />
              </button>
              <button
                onClick={() => handleSizeChange('medium')}
                className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg ${config.size === 'medium' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Medium"
                aria-label="Resize to medium"
                aria-pressed={config.size === 'medium'}
              >
                <BarChart3Icon size={16} />
              </button>
              <button
                onClick={() => handleSizeChange('large')}
                className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg ${config.size === 'large' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Large"
                aria-label="Resize to large"
                aria-pressed={config.size === 'large'}
              >
                <MaximizeIcon size={16} />
              </button>
            </div>
            
            <button
              onClick={() => onRemove(config.id)}
              className="min-w-[44px] min-h-[44px] p-2.5 text-gray-400 hover:text-red-500 rounded-lg"
              title="Remove"
              aria-label="Remove widget"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Widget Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Last Refresh Indicator */}
        {config.lastRefresh && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {config.lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {config.title} Settings
              </h3>
              <button
                onClick={handleCancelSettings}
                className="min-w-[44px] min-h-[44px] p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close settings"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Widget Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={tempConfig.title}
                  onChange={(e) => setTempConfig({ ...tempConfig, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Refresh Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto Refresh (minutes)
                </label>
                <select
                  value={tempConfig.refreshInterval || 0}
                  onChange={(e) => setTempConfig({ 
                    ...tempConfig, 
                    refreshInterval: parseInt(e.target.value) || undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={0}>Manual only</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>

              {/* Widget-specific settings */}
              {config.type === 'budget-summary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Show Period
                  </label>
                  <select
                    value={(tempConfig.settings.period || 'current') as string}
                    onChange={(e) => handleSettingsChange('period', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="current">Current Month</option>
                    <option value="last">Last Month</option>
                    <option value="ytd">Year to Date</option>
                  </select>
                </div>
              )}

              {config.type === 'recent-transactions' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Transactions
                  </label>
                  <select
                    value={(tempConfig.settings.count || 5) as number}
                    onChange={(e) => handleSettingsChange('count', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              )}

              {config.type === 'cash-flow' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forecast Period
                  </label>
                  <select
                    value={(tempConfig.settings.forecastPeriod || 6) as number}
                    onChange={(e) => handleSettingsChange('forecastPeriod', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelSettings}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
