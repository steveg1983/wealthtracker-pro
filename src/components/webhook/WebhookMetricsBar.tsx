/**
 * Webhook Metrics Bar Component
 * World-class metrics display with Datadog-level clarity
 */

import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface WebhookMetrics {
  totalEvents: number;
  successRate: number;
  averageResponseTime: number;
  failedEvents: number;
}

interface WebhookMetricsBarProps {
  metrics: WebhookMetrics;
}

/**
 * Premium metrics dashboard
 */
export const WebhookMetricsBar = memo(function WebhookMetricsBar({ metrics
 }: WebhookMetricsBarProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('WebhookMetricsBar component initialized', {
        totalEvents: metrics.totalEvents,
        successRate: metrics.successRate,
        failedEvents: metrics.failedEvents,
        componentName: 'WebhookMetricsBar'
      });
    } catch (error) {
      logger.error('WebhookMetricsBar initialization failed:', error, 'WebhookMetricsBar');
    }
  }, [metrics.totalEvents, metrics.successRate, metrics.failedEvents]);
  try {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard 
          label="Total Events" 
          value={(() => {
            try {
              return (metrics.totalEvents || 0).toString();
            } catch (error) {
              logger.error('Failed to format total events:', error, 'WebhookMetricsBar');
              return 'Error';
            }
          })()} 
        />
        <MetricCard 
          label="Success Rate" 
          value={(() => {
            try {
              const rate = metrics.successRate || 0;
              return `${rate.toFixed(1)}%`;
            } catch (error) {
              logger.error('Failed to format success rate:', error, 'WebhookMetricsBar');
              return 'Error';
            }
          })()}
          color={(() => {
            try {
              return getSuccessRateColor(metrics.successRate || 0);
            } catch (error) {
              logger.error('Failed to get success rate color:', error, 'WebhookMetricsBar');
              return 'default';
            }
          })()}
        />
        <MetricCard 
          label="Avg Response" 
          value={(() => {
            try {
              return `${metrics.averageResponseTime || 0}ms`;
            } catch (error) {
              logger.error('Failed to format average response time:', error, 'WebhookMetricsBar');
              return 'Error';
            }
          })()} 
        />
        <MetricCard 
          label="Failed Events" 
          value={(() => {
            try {
              return (metrics.failedEvents || 0).toString();
            } catch (error) {
              logger.error('Failed to format failed events:', error, 'WebhookMetricsBar');
              return 'Error';
            }
          })()}
          color={(() => {
            try {
              const failed = metrics.failedEvents || 0;
              return failed > 0 ? 'red' : 'green';
            } catch (error) {
              logger.error('Failed to determine failed events color:', error, 'WebhookMetricsBar');
              return 'default';
            }
          })()}
        />
      </div>
    );
  } catch (error) {
    logger.error('Failed to render WebhookMetricsBar:', error, 'WebhookMetricsBar');
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm p-4">
          <dt className="text-xs text-red-600 dark:text-red-400 mb-1">Error</dt>
          <dd className="text-lg font-semibold text-red-600 dark:text-red-400">
            Failed to load metrics
          </dd>
        </div>
      </div>
    );
  }
});

/**
 * Individual metric card
 */
const MetricCard = memo(function MetricCard({
  label,
  value,
  color = 'default'
}: {
  label: string;
  value: string;
  color?: 'default' | 'green' | 'yellow' | 'red';
}): React.JSX.Element {
  const logger = useLogger();
  const colorClasses = {
    default: 'text-gray-900 dark:text-white',
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <dt className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</dt>
      <dd className={`text-2xl font-semibold ${colorClasses[color]}`}>{value}</dd>
    </div>
  );
});

/**
 * Get color based on success rate
 */
function getSuccessRateColor(rate: number): 'green' | 'yellow' | 'red' {
  if (rate >= 95) return 'green';
  if (rate >= 90) return 'yellow';
  return 'red';
}