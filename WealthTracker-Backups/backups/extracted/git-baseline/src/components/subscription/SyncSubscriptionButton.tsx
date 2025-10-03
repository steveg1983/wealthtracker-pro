import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { RefreshCwIcon } from '../icons';
import { apiUrl } from '../../config/api';
import { logger } from '../../services/loggingService';

export default function SyncSubscriptionButton({ onSync }: { onSync?: () => void }): React.JSX.Element {
  const { getToken } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    
    try {
      const token = await getToken();
      if (!token) {
        setMessage('Not authenticated');
        return;
      }

      const response = await fetch(apiUrl('subscriptions/sync'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.subscription) {
          setMessage(`✓ Synced: ${data.subscription.planType} (${data.subscription.status})`);
        } else {
          setMessage('No active subscription found');
        }
        
        // Trigger parent refresh if provided
        if (onSync) {
          setTimeout(onSync, 500);
        }
      } else {
        setMessage(`Error: ${data.error || 'Sync failed'}`);
      }
    } catch (error) {
      logger.error('Sync error:', error);
      setMessage('Failed to sync subscription');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCwIcon size={16} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing...' : 'Sync Subscription'}
      </button>
      {message && (
        <span className={`text-sm ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
