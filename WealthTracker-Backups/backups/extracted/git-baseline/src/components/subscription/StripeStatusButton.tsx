import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CheckCircleIcon, AlertCircleIcon } from '../icons';
import { apiUrl } from '../../config/api';
import { logger } from '../../services/loggingService';

export default function StripeStatusButton(): React.JSX.Element {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');

  const checkStatus = async () => {
    setLoading(true);
    setError('');
    setStatus(null);
    
    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(apiUrl('subscriptions/stripe-status'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setStatus(data);
      } else {
        setError(data.error || 'Failed to check status');
      }
    } catch (error) {
      logger.error('Status check error:', error);
      setError('Failed to check subscription status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Stripe Subscription Status</h3>
      
      <button
        onClick={checkStatus}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Checking...' : 'Check Stripe Status'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {status && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
            <span className="font-medium">Status Retrieved Successfully</span>
          </div>
          
          {status.hasSubscription ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">{status.tier}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`ml-2 font-medium capitalize ${
                    status.status === 'trialing' ? 'text-blue-600' :
                    status.status === 'active' ? 'text-green-600' :
                    status.status === 'canceled' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {status.status}
                  </span>
                </div>
              </div>
              
              {status.subscription && (
                <>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Customer ID:</span>
                    <span className="ml-2 font-mono text-xs">{status.subscription.customerId}</span>
                  </div>
                  {status.subscription.trialEnd && (
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Trial Ends:</span>
                      <span className="ml-2">{new Date(status.subscription.trialEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Current Period Ends:</span>
                    <span className="ml-2">{new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="ml-2">£{(status.subscription.priceAmount / 100).toFixed(2)}/{status.subscription.currency.toUpperCase()}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400">No active subscription found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{status.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
