/**
 * RealtimeStatusIndicator - Shows real-time connection status
 * 
 * This component displays:
 * - Connection status (connected/disconnected/reconnecting)
 * - Last sync time
 * - Number of active subscriptions
 * - Manual reconnect option
 */

import React, { useState } from 'react';
import { useRealtimeConnectionStatus } from '../hooks/useRealtimeSync';
import realtimeService from '../services/realtimeService';

interface RealtimeStatusIndicatorProps {
  /**
   * Position of the indicator
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  
  /**
   * Show detailed status on hover/click
   */
  showDetails?: boolean;
  
  /**
   * Compact mode (just the status dot)
   */
  compact?: boolean;
}

export function RealtimeStatusIndicator({
  position = 'top-right',
  showDetails = true,
  compact = false,
}: RealtimeStatusIndicatorProps): React.JSX.Element {
  const connectionState = useRealtimeConnectionStatus();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = () => {
    if (connectionState.isConnected) {
      return 'bg-green-500';
    } else if (connectionState.isReconnecting) {
      return 'bg-yellow-500 animate-pulse';
    } else {
      return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    if (connectionState.isConnected) {
      return 'Connected';
    } else if (connectionState.isReconnecting) {
      return 'Reconnecting...';
    } else {
      return 'Disconnected';
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const handleReconnect = () => {
    realtimeService.forceReconnect();
  };

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  if (compact) {
    return (
      <div
        className={`fixed ${positionClasses[position]} z-50`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} border-2 border-white shadow-lg`} />
        
        {showTooltip && showDetails && (
          <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Real-time Sync
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Status: <span className="font-medium">{getStatusText()}</span></div>
              <div>Subscriptions: {realtimeService.getSubscriptionCount()}</div>
              {connectionState.lastConnected && (
                <div>Last connected: {formatTime(connectionState.lastConnected)}</div>
              )}
              {!connectionState.isConnected && (
                <button
                  onClick={handleReconnect}
                  className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <div 
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => showDetails && setIsExpanded(!isExpanded)}
        >
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {getStatusText()}
          </span>
          {showDetails && (
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {isExpanded && showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Active subscriptions:</span>
              <span className="font-medium">{realtimeService.getSubscriptionCount()}</span>
            </div>
            
            {connectionState.lastConnected && (
              <div className="flex justify-between">
                <span>Last connected:</span>
                <span className="font-medium">{formatTime(connectionState.lastConnected)}</span>
              </div>
            )}
            
            {connectionState.lastDisconnected && !connectionState.isConnected && (
              <div className="flex justify-between">
                <span>Disconnected:</span>
                <span className="font-medium">{formatTime(connectionState.lastDisconnected)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span>Connections:</span>
              <span className="font-medium">{connectionState.connectionCount}</span>
            </div>

            {!connectionState.isConnected && (
              <button
                onClick={handleReconnect}
                disabled={connectionState.isReconnecting}
                className="w-full mt-2 text-xs bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {connectionState.isReconnecting ? 'Reconnecting...' : 'Reconnect'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal connection status dot for the header/navbar
 */
export function RealtimeStatusDot(): React.JSX.Element {
  const connectionState = useRealtimeConnectionStatus();
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusColor = () => {
    if (connectionState.isConnected) {
      return 'bg-green-500';
    } else if (connectionState.isReconnecting) {
      return 'bg-yellow-500 animate-pulse';
    } else {
      return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    if (connectionState.isConnected) {
      return 'Real-time sync active';
    } else if (connectionState.isReconnecting) {
      return 'Reconnecting to real-time sync...';
    } else {
      return 'Real-time sync disconnected';
    }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          {getStatusText()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

export default RealtimeStatusIndicator;