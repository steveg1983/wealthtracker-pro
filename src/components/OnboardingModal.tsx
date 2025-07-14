import { useState } from 'react';
import { X } from 'lucide-react';
import { supportedCurrencies } from '../utils/currency';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (name: string, currency: string) => void;
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [firstName, setFirstName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GBP');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim()) {
      onComplete(firstName.trim(), baseCurrency);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Welcome to WealthTracker!
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Let's personalize your experience with a few quick settings.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What's your first name?
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your first name"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This will be used to personalize your dashboard
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred base currency
            </label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {supportedCurrencies.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.symbol} {curr.name} ({curr.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose your preferred base currency to display your net worth in
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
            >
              Get Started
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 You can change these settings anytime in Settings → App Settings
          </p>
        </div>
      </div>
    </div>
  );
}