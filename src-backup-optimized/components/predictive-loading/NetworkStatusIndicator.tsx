/**
 * NetworkStatusIndicator - World-Class Component
 * Extracted from PredictiveLoadingIndicator architectural disaster
 */

import React, { useState, useEffect, memo } from 'react';
import { WifiIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

// Network Information API types
interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

// Extend Navigator interface for Network Information API
declare global {
  interface Navigator {
    connection?: NetworkInformation;
  }
}

/**
 * Network status indicator with professional error handling
 */
export const NetworkStatusIndicator = memo(function NetworkStatusIndicator(): React.JSX.Element {
  const logger = useLogger();
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const updateNetworkStatus = () => {
      try {
        if (!navigator.onLine) {
          setNetworkStatus('offline');
        } else if ('connection' in navigator) {
          const connection = navigator.connection;
          setConnectionType(connection?.effectiveType || 'unknown');
          
          if (['slow-2g', '2g'].includes(connection?.effectiveType || '')) {
            setNetworkStatus('slow');
          } else {
            setNetworkStatus('online');
          }
        }
      } catch (error) {
        logger.error('Failed to update network status:', error);
      }
    };

    updateNetworkStatus();
    
    try {
      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);
      
      if ('connection' in navigator) {
        navigator.connection?.addEventListener('change', updateNetworkStatus);
      }
    } catch (error) {
      logger.error('Failed to add network event listeners:', error);
    }

    return () => {
      try {
        window.removeEventListener('online', updateNetworkStatus);
        window.removeEventListener('offline', updateNetworkStatus);
        if ('connection' in navigator) {
          navigator.connection?.removeEventListener('change', updateNetworkStatus);
        }
      } catch (error) {
        logger.error('Failed to remove network event listeners:', error);
      }
    };
  }, []);

  const getStatusColor = (): string => {
    switch (networkStatus) {
      case 'offline': return 'text-red-500';
      case 'slow': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getStatusText = (): string => {
    switch (networkStatus) {
      case 'offline': return 'Offline';
      case 'slow': return `Slow (${connectionType})`;
      default: return `Online (${connectionType})`;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <WifiIcon size={16} className={getStatusColor()} />
      <span className={`text-sm ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </div>
  );
});