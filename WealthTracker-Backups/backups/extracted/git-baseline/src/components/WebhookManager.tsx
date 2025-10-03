import React, { useState, useEffect } from 'react';
import { 
  LinkIcon as Webhook,
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle,
  AlertCircleIcon as AlertCircle,
  RefreshCwIcon as RefreshCw,
  ClockIcon as Clock,
  ActivityIcon as Activity,
  ZapIcon as Zap
} from './icons';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '../services/loggingService';

interface WebhookEvent {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  timestamp: Date;
  attempts: number;
  error?: string;
  data?: any;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  active: boolean;
  events: string[];
  lastPing?: Date;
  failureRate: number;
}

export default function WebhookManager(): React.JSX.Element {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);

  useEffect(() => {
    // Load webhook data
    loadWebhookData();
    
    // Set up polling for real-time updates
    const interval = setInterval(loadWebhookData, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadWebhookData = async () => {
    try {
      // In production, this would fetch from your API
      // For now, we'll use mock data
      setEvents([
        {
          id: 'evt_1',
          type: 'customer.subscription.updated',
          status: 'success',
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          attempts: 1,
        },
        {
          id: 'evt_2',
          type: 'invoice.paid',
          status: 'success',
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          attempts: 1,
        },
        {
          id: 'evt_3',
          type: 'payment_method.attached',
          status: 'failed',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          attempts: 3,
          error: 'Connection timeout'
        }
      ]);

      setEndpoints([
        {
          id: 'ep_1',
          url: 'https://api.wealthtracker.com/webhooks/stripe',
          active: true,
          events: ['customer.*', 'invoice.*', 'payment_method.*'],
          lastPing: new Date(Date.now() - 1000 * 60 * 2),
          failureRate: 0.02
        }
      ]);

      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load webhook data:', error);
      setIsLoading(false);
    }
  };

  const retryWebhook = async (eventId: string) => {
    // In production, this would trigger a webhook retry
    logger.info('Retrying webhook:', eventId);
    
    // Update UI to show processing
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, status: 'processing' } : e
    ));

    // Simulate retry
    setTimeout(() => {
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, status: 'success', attempts: e.attempts + 1 } : e
      ));
    }, 2000);
  };

  const getStatusIcon = (status: WebhookEvent['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      case 'processing':
        return <RefreshCw size={16} className="text-blue-600 animate-spin" />;
      default:
        return <Clock size={16} className="text-yellow-600" />;
    }
  };

  const getStatusColor = (status: WebhookEvent['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'processing':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook Endpoints */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Webhook Endpoints
          </h3>
          <button
            onClick={loadWebhookData}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {endpoints.map(endpoint => (
          <div key={endpoint.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Webhook size={16} className="text-gray-500" />
                  <code className="text-sm text-gray-900 dark:text-white font-mono">
                    {endpoint.url}
                  </code>
                  {endpoint.active ? (
                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Activity size={12} />
                    Last ping: {endpoint.lastPing ? formatDistanceToNow(endpoint.lastPing, { addSuffix: true }) : 'Never'}
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle size={12} />
                    Failure rate: {(endpoint.failureRate * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Events: {endpoint.events.join(', ')}
                  </p>
                </div>
              </div>

              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Zap size={16} className="text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Webhook Events
        </h3>

        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No webhook events yet
            </p>
          ) : (
            events.map(event => (
              <div
                key={event.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.type}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                        {event.attempts > 1 && ` • ${event.attempts} attempts`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                    
                    {event.status === 'failed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          retryWebhook(event.id);
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>

                {event.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                    Error: {event.error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Webhook Event Details
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Event ID
                  </label>
                  <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                    {selectedEvent.id}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {selectedEvent.type}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusIcon(selectedEvent.status)}
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedEvent.status)}`}>
                      {selectedEvent.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timestamp
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {selectedEvent.timestamp.toLocaleString()}
                  </p>
                </div>

                {selectedEvent.error && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Error
                    </label>
                    <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {selectedEvent.error}
                      </p>
                    </div>
                  </div>
                )}

                {selectedEvent.data && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Event Data
                    </label>
                    <pre className="mt-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
