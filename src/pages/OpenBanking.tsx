import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/PageWrapper';
import PlaidLink from '../components/PlaidLink';
import { plaidService } from '../services/plaidService';
import { useApp } from '../contexts/AppContextSupabase';
import { BankIcon, ShieldIcon, ClockIcon, CheckCircleIcon } from '../components/icons';

export default function OpenBanking() {
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState('24'); // hours
  const { accounts } = useApp();
  
  // Count connected accounts
  const connectedAccountsCount = accounts.filter(acc => acc.plaidConnectionId).length;
  const totalConnections = plaidService.getConnections().length;

  const handleAutoSyncToggle = () => {
    setIsAutoSyncEnabled(!isAutoSyncEnabled);
    // In production, this would update user preferences
  };

  const handleSyncIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSyncInterval(e.target.value);
    // In production, this would update sync settings
  };

  return (
    <PageWrapper title="Open Banking">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Connected Banks</p>
              <p className="text-2xl font-bold">{totalConnections}</p>
            </div>
            <BankIcon size={32} className="text-gray-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Synced Accounts</p>
              <p className="text-2xl font-bold">{connectedAccountsCount}</p>
            </div>
            <CheckCircleIcon size={32} className="text-green-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Security Status</p>
              <p className="text-lg font-semibold text-green-600">Secured</p>
            </div>
            <ShieldIcon size={32} className="text-green-600" />
          </div>
        </div>
      </div>

      {/* Plaid Link Component */}
      <PlaidLink />

      {/* Sync Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Sync Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Automatic Sync</label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically sync transactions from connected banks
              </p>
            </div>
            <button
              onClick={handleAutoSyncToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAutoSyncEnabled ? 'bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {isAutoSyncEnabled && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Sync Frequency
              </label>
              <select
                value={syncInterval}
                onChange={handleSyncIntervalChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Daily</option>
                <option value="168">Weekly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Security Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldIcon size={24} className="text-green-600" />
          <h3 className="text-lg font-semibold">Bank-Level Security</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Data Protection</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• 256-bit encryption for all data</li>
              <li>• Read-only access to your accounts</li>
              <li>• No access to move money</li>
              <li>• Credentials never stored locally</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Privacy First</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Your data stays on your device</li>
              <li>• No third-party data sharing</li>
              <li>• Delete connections anytime</li>
              <li>• Full control over your information</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported Banks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Supported Banks</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connect to over 12,000 financial institutions across the US, Canada, and Europe.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="font-medium">Major Banks</div>
          <div className="font-medium">Credit Unions</div>
          <div className="font-medium">Investment Firms</div>
          <div className="font-medium">Credit Cards</div>
          <div className="text-gray-600 dark:text-gray-400">Chase</div>
          <div className="text-gray-600 dark:text-gray-400">Navy Federal</div>
          <div className="text-gray-600 dark:text-gray-400">Vanguard</div>
          <div className="text-gray-600 dark:text-gray-400">American Express</div>
          <div className="text-gray-600 dark:text-gray-400">Bank of America</div>
          <div className="text-gray-600 dark:text-gray-400">Alliant</div>
          <div className="text-gray-600 dark:text-gray-400">Fidelity</div>
          <div className="text-gray-600 dark:text-gray-400">Capital One</div>
          <div className="text-gray-600 dark:text-gray-400">Wells Fargo</div>
          <div className="text-gray-600 dark:text-gray-400">PenFed</div>
          <div className="text-gray-600 dark:text-gray-400">Charles Schwab</div>
          <div className="text-gray-600 dark:text-gray-400">Discover</div>
          <div className="text-gray-600 dark:text-gray-400">Citi</div>
          <div className="text-gray-600 dark:text-gray-400">BECU</div>
          <div className="text-gray-600 dark:text-gray-400">E*TRADE</div>
          <div className="text-gray-600 dark:text-gray-400">And 12,000+ more...</div>
        </div>
      </div>
    </PageWrapper>
  );
}