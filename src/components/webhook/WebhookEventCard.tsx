/**
 * Webhook Event Card Component
 * World-class component for webhook event display
 * Implements Google Material Design with Apple-level refinement
 */

import React, { useEffect, memo, useCallback } from 'react';
import { 
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle,
  RefreshCwIcon as RefreshCw,
  ClockIcon as Clock
} from '../icons';
import { webhookService, type WebhookEvent } from '../../services/webhook/webhookService';
import { logger } from '../../services/loggingService';

interface WebhookEventCardProps {
  event: WebhookEvent;
  onRetry: (eventId: string) => void;
  onClick: (event: WebhookEvent) => void;
}

/**
 * High-performance event card with optimal UX
 */
export const WebhookEventCard = memo(function WebhookEventCard({
  event,
  onRetry,
  onClick
}: WebhookEventCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('WebhookEventCard component initialized', {
        eventId: event.id,
        eventType: event.type,
        eventStatus: event.status,
        componentName: 'WebhookEventCard'
      });
    } catch (error) {
      logger.error('WebhookEventCard initialization failed:', error, 'WebhookEventCard');
    }
  }, [event.id, event.type, event.status]);
  
  const statusConfig = (() => {
    try {
      return webhookService.getStatusConfig(event.status);
    } catch (error) {
      logger.error('Failed to get status config:', error, 'WebhookEventCard');
      return { icon: 'AlertCircle', color: 'text-gray-400', bgColor: 'bg-gray-100', textColor: 'text-gray-600', animate: false };
    }
  })();
  
  const shouldShowRetry = (() => {
    try {
      return webhookService.shouldRetry(event);
    } catch (error) {
      logger.error('Failed to check retry eligibility:', error, 'WebhookEventCard');
      return false;
    }
  })();
  
  const handleClick = useCallback(() => {
    try {
      logger.debug('Webhook event card clicked', { eventId: event.id, componentName: 'WebhookEventCard' });
      onClick(event);
    } catch (error) {
      logger.error('Failed to handle event click:', error, 'WebhookEventCard');
    }
  }, [event, onClick]);
  
  const handleRetry = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      logger.debug('Webhook event retry requested', { eventId: event.id, componentName: 'WebhookEventCard' });
      onRetry(event.id);
    } catch (error) {
      logger.error('Failed to handle retry:', error, 'WebhookEventCard');
    }
  }, [event.id, onRetry]);

  return (
    <article
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Webhook event: ${event.type}`}
      onKeyDown={(e) => {
        try {
          if (e.key === 'Enter') {
            logger.debug('Webhook event card activated via keyboard', { eventId: event.id, componentName: 'WebhookEventCard' });
            handleClick();
          }
        } catch (error) {
          logger.error('Failed to handle keyboard event:', error, 'WebhookEventCard');
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={event.status} config={statusConfig} />
          
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {event.type}
            </h4>
            <EventMetadata event={event} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge config={statusConfig} status={event.status} />
          
          {shouldShowRetry && (
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
              aria-label="Retry webhook event"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {event.error && <ErrorDisplay error={event.error} />}
    </article>
  );
});

/**
 * Status icon component
 */
const StatusIcon = memo(function StatusIcon({
  status,
  config
}: {
  status: WebhookEvent['status'];
  config: ReturnType<typeof webhookService.getStatusConfig>;
}): React.JSX.Element {
  const iconProps = {
    size: 16,
    className: `${config.color} ${'animate' in config && config.animate ? 'animate-spin' : ''}`,
    'aria-hidden': true
  };

  switch (status) {
    case 'success':
      return <CheckCircle {...iconProps} />;
    case 'failed':
      return <XCircle {...iconProps} />;
    case 'processing':
      return <RefreshCw {...iconProps} />;
    default:
      return <Clock {...iconProps} />;
  }
});

/**
 * Event metadata display
 */
const EventMetadata = memo(function EventMetadata({
  event
}: {
  event: WebhookEvent;
}): React.JSX.Element {
  try {
    const parts = [];
    
    try {
      parts.push(webhookService.formatTimestamp(event.timestamp));
    } catch (timestampError) {
      logger.error('Failed to format timestamp:', timestampError, 'WebhookEventCard.EventMetadata');
      parts.push('Invalid timestamp');
    }
    
    if (event.attempts && event.attempts > 1) {
      parts.push(`${event.attempts} attempts`);
    }
    
    if (event.responseTime) {
      parts.push(`${event.responseTime}ms`);
    }

    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {parts.join(' • ')}
      </p>
    );
  } catch (error) {
    logger.error('Failed to render event metadata:', error, 'WebhookEventCard.EventMetadata');
    return (
      <p className="text-xs text-red-500 dark:text-red-400">
        Metadata error
      </p>
    );
  }
});

/**
 * Status badge component
 */
const StatusBadge = memo(function StatusBadge({
  config,
  status
}: {
  config: ReturnType<typeof webhookService.getStatusConfig>;
  status: WebhookEvent['status'];
}): React.JSX.Element {
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${config.bgColor} ${config.textColor}`}>
      {status}
    </span>
  );
});

/**
 * Error display component
 */
const ErrorDisplay = memo(function ErrorDisplay({
  error
}: {
  error: string;
}): React.JSX.Element {
  return (
    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
      <span className="font-medium">Error:</span> {error}
    </div>
  );
});