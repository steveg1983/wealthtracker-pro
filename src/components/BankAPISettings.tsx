import React, { useState, useEffect } from 'react';
import { bankConnectionService } from '../services/bankConnectionService';
import { KeyIcon, CheckIcon, AlertCircleIcon, EyeIcon, EyeOffIcon } from './icons';

export default function BankAPISettings() {
  const [plaidConfig, setPlaidConfig] = useState({
    clientId: '',
    secret: '',
    environment: 'sandbox' as 'sandbox' | 'development' | 'production'
  });
  
  const [trueLayerConfig, setTrueLayerConfig] = useState({
    clientId: '',
    clientSecret: '',
    environment: 'sandbox' as 'sandbox' | 'live',
    redirectUri: window.location.origin + '/auth/callback'
  });
  
  const [showSecrets, setShowSecrets] = useState({
    plaidSecret: false,
    trueLayerSecret: false
  });
  
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load existing config (would need to implement secure retrieval)
    const status = bankConnectionService.getConfigStatus();
    // For security, we don't load actual secrets back into the form
  }, []);

  const handleSave = (): void => {
    bankConnectionService.initialize({
      plaid: plaidConfig.clientId && plaidConfig.secret ? plaidConfig : undefined,
      trueLayer: trueLayerConfig.clientId && trueLayerConfig.clientSecret ? trueLayerConfig : undefined
    });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isPlaidConfigured = !!(plaidConfig.clientId && plaidConfig.secret);
  const isTrueLayerConfigured = !!(trueLayerConfig.clientId && trueLayerConfig.clientSecret);

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircleIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Important Security Notice
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              API credentials are stored locally in your browser. For production use, 
              credentials should be stored securely on a backend server.
            </p>
          </div>
        </div>
      </div>

      {/* Plaid Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyIcon size={20} />
            Plaid Configuration
          </h3>
          {isPlaidConfigured && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckIcon size={16} />
              Configured
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Environment
            </label>
            <select
              value={plaidConfig.environment}
              onChange={(e) => setPlaidConfig({
                ...plaidConfig,
                environment: e.target.value as 'sandbox' | 'development' | 'production'
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="sandbox">Sandbox (Testing)</option>
              <option value="development">Development</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={plaidConfig.clientId}
              onChange={(e) => setPlaidConfig({ ...plaidConfig, clientId: e.target.value })}
              placeholder="Enter your Plaid Client ID"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secret Key
            </label>
            <div className="relative">
              <input
                type={showSecrets.plaidSecret ? 'text' : 'password'}
                value={plaidConfig.secret}
                onChange={(e) => setPlaidConfig({ ...plaidConfig, secret: e.target.value })}
                placeholder="Enter your Plaid Secret"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowSecrets({
                  ...showSecrets,
                  plaidSecret: !showSecrets.plaidSecret
                })}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showSecrets.plaidSecret ? "Hide secret key" : "Show secret key"}
              >
                {showSecrets.plaidSecret ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Get your Plaid credentials from{' '}
            <a
              href="https://dashboard.plaid.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              dashboard.plaid.com
            </a>
          </div>
        </div>
      </div>

      {/* TrueLayer Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyIcon size={20} />
            TrueLayer Configuration
          </h3>
          {isTrueLayerConfigured && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckIcon size={16} />
              Configured
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Environment
            </label>
            <select
              value={trueLayerConfig.environment}
              onChange={(e) => setTrueLayerConfig({
                ...trueLayerConfig,
                environment: e.target.value as 'sandbox' | 'live'
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="sandbox">Sandbox (Testing)</option>
              <option value="live">Live</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={trueLayerConfig.clientId}
              onChange={(e) => setTrueLayerConfig({ ...trueLayerConfig, clientId: e.target.value })}
              placeholder="Enter your TrueLayer Client ID"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets.trueLayerSecret ? 'text' : 'password'}
                value={trueLayerConfig.clientSecret}
                onChange={(e) => setTrueLayerConfig({ ...trueLayerConfig, clientSecret: e.target.value })}
                placeholder="Enter your TrueLayer Client Secret"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowSecrets({
                  ...showSecrets,
                  trueLayerSecret: !showSecrets.trueLayerSecret
                })}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showSecrets.trueLayerSecret ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Redirect URI
            </label>
            <input
              type="text"
              value={trueLayerConfig.redirectUri}
              onChange={(e) => setTrueLayerConfig({ ...trueLayerConfig, redirectUri: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add this URI to your TrueLayer app settings
            </p>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Get your TrueLayer credentials from{' '}
            <a
              href="https://console.truelayer.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              console.truelayer.com
            </a>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          {saved ? (
            <>
              <CheckIcon size={20} />
              Saved
            </>
          ) : (
            <>
              Save Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}