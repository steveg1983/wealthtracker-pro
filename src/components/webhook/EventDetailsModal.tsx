/**
 * Event Details Modal Component
 * World-class modal implementation with exceptional UX
 */

import React, { useEffect, memo } from 'react';
import { XCircleIcon as XCircle } from '../icons';
import { webhookService, type WebhookEvent } from '../../services/webhook/webhookService';
import { logger } from '../../services/loggingService';

interface EventDetailsModalProps {
  event: WebhookEvent;
  onClose: () => void;
}

/**
 * Premium modal with smooth animations and accessibility
 */
export const EventDetailsModal = memo(function EventDetailsModal({
  event,
  onClose
}: EventDetailsModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EventDetailsModal component initialized', {
      componentName: 'EventDetailsModal'
    });
  }, []);

  const statusConfig = webhookService.getStatusConfig(event.status);
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader onClose={onClose} />
        <ModalContent event={event} statusConfig={statusConfig} />
      </div>
    </div>
  );
});

/**
 * Modal header
 */
const ModalHeader = memo(function ModalHeader({
  onClose
}: {
  onClose: () => void;
}): React.JSX.Element {
  return (
    <header className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h3 id="event-details-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          Webhook Event Details
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label="Close details"
        >
          <XCircle size={20} />
        </button>
      </div>
    </header>
  );
});

/**
 * Modal content
 */
const ModalContent = memo(function ModalContent({
  event,
  statusConfig
}: {
  event: WebhookEvent;
  statusConfig: ReturnType<typeof webhookService.getStatusConfig>;
}): React.JSX.Element {
  return (
    <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(80vh-88px)]">
      <DetailField label="Event ID" value={event.id} mono />
      <DetailField label="Type" value={event.type} />
      <DetailField 
        label="Status" 
        value={
          <StatusBadge statusConfig={statusConfig} status={event.status} />
        } 
      />
      <DetailField label="Timestamp" value={event.timestamp.toLocaleString()} />
      {event.responseTime && (
        <DetailField label="Response Time" value={`${event.responseTime}ms`} />
      )}
      {event.attempts > 1 && (
        <DetailField label="Attempts" value={`${event.attempts}${event.maxAttempts ? ` / ${event.maxAttempts}` : ''}`} />
      )}
      {event.error && <ErrorField error={event.error} />}
      {event.data !== undefined && <DataField data={event.data} />}
    </div>
  );
});

/**
 * Detail field
 */
const DetailField = memo(function DetailField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</dt>
      <dd className={`mt-1 ${mono ? 'font-mono text-sm' : ''} text-gray-900 dark:text-white`}>
        {value}
      </dd>
    </div>
  );
});

/**
 * Status badge
 */
const StatusBadge = memo(function StatusBadge({
  statusConfig,
  status
}: {
  statusConfig: ReturnType<typeof webhookService.getStatusConfig>;
  status: WebhookEvent['status'];
}): React.JSX.Element {
  return (
    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}>
      {status}
    </span>
  );
});

/**
 * Error field
 */
const ErrorField = memo(function ErrorField({ 
  error 
}: { 
  error: string;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Error</dt>
      <dd className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400 font-mono">{error}</p>
      </dd>
    </div>
  );
});

/**
 * Data field
 */
const DataField = memo(function DataField({ 
  data 
}: { 
  data: unknown;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Event Data</dt>
      <dd className="mt-1">
        <pre className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs overflow-x-auto font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      </dd>
    </div>
  );
});