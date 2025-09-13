/**
 * Webhook Endpoint Card Component
 * World-class component for displaying webhook endpoint information
 * Implements Material Design 3 principles with Apple-level polish
 */

import React, { useEffect, memo, useCallback } from 'react';
import { 
  LinkIcon as Webhook,
  ActivityIcon as Activity,
  AlertCircleIcon as AlertCircle,
  ZapIcon as Zap
} from '../icons';
import { webhookService, type WebhookEndpoint } from '../../services/webhook/webhookService';
import { logger } from '../../services/loggingService';

interface WebhookEndpointCardProps {
  endpoint: WebhookEndpoint;
  onTest: (endpointId: string) => void;
}

/**
 * Premium endpoint card with exceptional attention to detail
 */
export const WebhookEndpointCard = memo(function WebhookEndpointCard({
  endpoint,
  onTest
}: WebhookEndpointCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('WebhookEndpointCard component initialized', {
        endpointId: endpoint.id,
        endpointUrl: endpoint.url,
        isActive: endpoint.active,
        componentName: 'WebhookEndpointCard'
      });
    } catch (error) {
      logger.error('WebhookEndpointCard initialization failed:', error, 'WebhookEndpointCard');
    }
  }, [endpoint.id, endpoint.url, endpoint.active]);
  
  const handleTest = useCallback(() => {
    try {
      logger.debug('Webhook endpoint test requested', { 
        endpointId: endpoint.id, 
        endpointUrl: endpoint.url, 
        componentName: 'WebhookEndpointCard' 
      });
      onTest(endpoint.id);
    } catch (error) {
      logger.error('Failed to test webhook endpoint:', error, 'WebhookEndpointCard');
    }
  }, [endpoint.id, endpoint.url, onTest]);

  return (
    <article 
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
      aria-label={`Webhook endpoint: ${endpoint.url}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <header className="flex items-center gap-2 mb-2">
            <Webhook size={16} className="text-gray-500" aria-hidden="true" />
            <code className="text-sm text-gray-900 dark:text-white font-mono">
              {endpoint.url || 'Invalid URL'}
            </code>
            <EndpointStatus active={endpoint.active} />
          </header>
          
          {/* Metrics */}
          <EndpointMetrics endpoint={endpoint} />
          
          {/* Events */}
          <div className="mt-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Events:</span> {(() => {
                try {
                  return endpoint.events?.length > 0 ? endpoint.events.join(', ') : 'None configured';
                } catch (error) {
                  logger.error('Failed to format endpoint events:', error, 'WebhookEndpointCard');
                  return 'Events error';
                }
              })()}
            </p>
          </div>
        </div>

        {/* Test Button */}
        <button 
          onClick={handleTest}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Test endpoint"
          aria-label="Test webhook endpoint"
        >
          <Zap size={16} className="text-gray-500" />
        </button>
      </div>
    </article>
  );
});

/**
 * Endpoint status badge
 */
const EndpointStatus = memo(function EndpointStatus({ 
  active 
}: { 
  active: boolean;
}): React.JSX.Element {
  if (active) {
    return (
      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
        Active
      </span>
    );
  }
  
  return (
    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
      Inactive
    </span>
  );
});

/**
 * Endpoint metrics display
 */
const EndpointMetrics = memo(function EndpointMetrics({ 
  endpoint 
}: { 
  endpoint: WebhookEndpoint;
}): React.JSX.Element {
  try {
    return (
      <dl className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Activity size={12} aria-hidden="true" />
          <dt className="sr-only">Last ping</dt>
          <dd>
            Last ping: {(() => {
              try {
                return endpoint.lastPing 
                  ? webhookService.formatTimestamp(endpoint.lastPing) 
                  : 'Never';
              } catch (timestampError) {
                logger.error('Failed to format last ping timestamp:', timestampError, 'WebhookEndpointCard.EndpointMetrics');
                return 'Invalid date';
              }
            })()}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle size={12} aria-hidden="true" />
          <dt className="sr-only">Failure rate</dt>
          <dd>
            Failure rate: {(() => {
              try {
                const rate = endpoint.failureRate || 0;
                return `${(rate * 100).toFixed(1)}%`;
              } catch (rateError) {
                logger.error('Failed to format failure rate:', rateError, 'WebhookEndpointCard.EndpointMetrics');
                return 'Error%';
              }
            })()}
          </dd>
        </div>
        {endpoint.averageResponseTime && (
          <div>
            <dt className="sr-only">Response time</dt>
            <dd>
              Avg: {(() => {
                try {
                  return `${endpoint.averageResponseTime}ms`;
                } catch (responseTimeError) {
                  logger.error('Failed to format response time:', responseTimeError, 'WebhookEndpointCard.EndpointMetrics');
                  return 'Error';
                }
              })()}
            </dd>
          </div>
        )}
      </dl>
    );
  } catch (error) {
    logger.error('Failed to render endpoint metrics:', error, 'WebhookEndpointCard.EndpointMetrics');
    return (
      <div className="text-xs text-red-500 dark:text-red-400">
        Metrics error
      </div>
    );
  }
});