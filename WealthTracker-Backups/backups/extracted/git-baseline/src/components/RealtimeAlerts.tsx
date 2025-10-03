/**
 * Real-time Alerts Component
 * Displays portfolio changes and spending anomalies
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, X, ChevronRight, Activity } from 'lucide-react';
import { useRealtimeSyncContext } from '../contexts/RealtimeSyncProvider';
import { formatCurrency } from '../utils/formatters';
import type { SpendingAnomaly } from '../services/advancedAnalyticsService';

interface RealtimeAlertsProps {
  /**
   * Position of the alerts panel
   */
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  
  /**
   * Maximum number of alerts to show
   */
  maxAlerts?: number;
  
  /**
   * Auto-dismiss alerts after this many seconds (0 = no auto-dismiss)
   */
  autoDismissSeconds?: number;
  
  /**
   * Show portfolio change indicator
   */
  showPortfolioChange?: boolean;
  
  /**
   * Show anomaly alerts
   */
  showAnomalies?: boolean;
}

export default function RealtimeAlerts({
  position = 'top-right',
  maxAlerts = 3,
  autoDismissSeconds = 30,
  showPortfolioChange = true,
  showAnomalies = true,
}: RealtimeAlertsProps): React.JSX.Element | null {
  const syncContext = useRealtimeSyncContext();
  const { recentAnomalies = [], portfolioChange24h } = syncContext || {};
  
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Auto-dismiss alerts
  useEffect(() => {
    if (autoDismissSeconds <= 0 || recentAnomalies.length === 0) return;
    
    const timer = setTimeout(() => {
      const alertIds = recentAnomalies.map(a => a.transactionId || '').filter(Boolean);
      setDismissedAlerts(prev => new Set([...prev, ...alertIds]));
    }, autoDismissSeconds * 1000);
    
    return () => clearTimeout(timer);
  }, [recentAnomalies, autoDismissSeconds]);
  
  // Filter out dismissed alerts
  const visibleAnomalies = showAnomalies 
    ? recentAnomalies.filter(a => !dismissedAlerts.has(a.transactionId || ''))
    : [];
  
  const limitedAnomalies = isExpanded 
    ? visibleAnomalies 
    : visibleAnomalies.slice(0, maxAlerts);
  
  // Don't render if nothing to show
  if (!syncContext || (!showPortfolioChange && !showAnomalies)) {
    return null;
  }
  
  if (!portfolioChange24h && visibleAnomalies.length === 0) {
    return null;
  }
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  };
  
  const dismissAlert = (alertId: string): void => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };
  
  const getSeverityColor = (severity: SpendingAnomaly['severity']): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };
  
  const getAnomalyIcon = (type: SpendingAnomaly['type']): React.ReactNode => {
    switch (type) {
      case 'unusual_amount':
        return <AlertCircle className="w-4 h-4" />;
      case 'unusual_frequency':
        return <Activity className="w-4 h-4" />;
      case 'duplicate_charge':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50 space-y-2 max-w-sm`}>
      {/* Portfolio Change Indicator */}
      {showPortfolioChange && portfolioChange24h !== null && (
        <div className={`
          flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg
          bg-white dark:bg-gray-800 border
          ${portfolioChange24h >= 0 
            ? 'border-green-200 dark:border-green-700' 
            : 'border-red-200 dark:border-red-700'}
        `}>
          {portfolioChange24h >= 0 ? (
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Portfolio 24h
            </div>
            <div className={`text-lg font-bold ${
              portfolioChange24h >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {portfolioChange24h >= 0 ? '+' : ''}{portfolioChange24h.toFixed(2)}%
            </div>
          </div>
        </div>
      )}
      
      {/* Anomaly Alerts */}
      {limitedAnomalies.length > 0 && (
        <div className="space-y-2">
          {limitedAnomalies.map((anomaly, index) => (
            <div
              key={anomaly.transactionId || index}
              className={`
                flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg
                border transition-all duration-300
                ${getSeverityColor(anomaly.severity)}
              `}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getAnomalyIcon(anomaly.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {anomaly.type === 'unusual_amount' && 'Unusual Amount'}
                  {anomaly.type === 'unusual_frequency' && 'Unusual Pattern'}
                  {anomaly.type === 'duplicate_charge' && 'Possible Duplicate'}
                  {anomaly.type === 'new_merchant' && 'New Merchant'}
                </div>
                <div className="text-xs mt-1 opacity-90">
                  {anomaly.description}
                </div>
                {anomaly.amount && (
                  <div className="text-sm font-semibold mt-1">
                    {formatCurrency(anomaly.amount)}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => dismissAlert(anomaly.transactionId || '')}
                className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {/* Show more/less toggle */}
          {visibleAnomalies.length > maxAlerts && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 
                text-sm text-gray-600 dark:text-gray-400 
                hover:text-gray-900 dark:hover:text-gray-200
                bg-white dark:bg-gray-800 rounded-lg shadow border
                border-gray-200 dark:border-gray-700 transition-colors"
            >
              {isExpanded ? (
                <>Show less</>
              ) : (
                <>
                  Show {visibleAnomalies.length - maxAlerts} more
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}
      
      {/* Connection status indicator */}
      {syncContext?.connectionState && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs 
          bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${
            syncContext.connectionState.isConnected 
              ? 'bg-green-500 animate-pulse' 
              : 'bg-gray-400'
          }`} />
          <span className="text-gray-600 dark:text-gray-400">
            {syncContext.connectionState.isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      )}
    </div>
  );
}