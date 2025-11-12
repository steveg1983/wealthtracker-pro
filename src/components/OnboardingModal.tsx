import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supportedCurrencies } from '../utils/currency';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (name: string, currency: string) => void;
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps): React.JSX.Element | null {
  const [firstName, setFirstName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GBP');
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (firstName.trim()) {
      onComplete(firstName.trim(), baseCurrency);
    }
  };

  // No scroll prevention - user can scroll freely
  useEffect(() => {
    if (!isOpen) return;
    // Modal will stay fixed in viewport automatically
    // No need to prevent scrolling
  }, [isOpen]);

  if (!isOpen) return null;

  // Render modal using React Portal at document.body level
  // This ensures the modal is outside any transformed parents
  return createPortal(
    <>
      {/* Fixed backdrop that covers the viewport */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 99998
        }}
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Modal centered in viewport using fixed positioning */}
      <div 
        ref={modalRef}
        className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl p-6 shadow-2xl"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '448px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 99999,
          animation: 'fadeInScale 0.3s ease-out'
        }}
      >
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
    </>,
    document.body
  );
}