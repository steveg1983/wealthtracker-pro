import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface TestDataWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearData?: () => void;
}

export default function TestDataWarningModal({ isOpen, onClose, onClearData }: TestDataWarningModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the warning
    const dismissed = localStorage.getItem('testDataWarningDismissed');
    if (dismissed === 'true') {
      onClose();
    }
  }, [onClose]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('testDataWarningDismissed', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full animate-fadeIn">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Test Data Active
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              You are currently viewing <span className="font-semibold">sample test data</span>. This includes:
            </p>
            
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-primary mt-1">•</span>
                <span>Example accounts from various UK banks</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-primary mt-1">•</span>
                <span>6 months of sample transactions</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-primary mt-1">•</span>
                <span>Pre-configured budgets and financial goals</span>
              </li>
            </ul>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Getting Started:</strong> Explore the app with test data, then clear it from Settings → Data Management when you're ready to add your real accounts.
              </p>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="dontShowAgain"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
              />
              <label htmlFor="dontShowAgain" className="text-sm text-gray-600 dark:text-gray-300">
                Don't show this warning again
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
            >
              Continue with Test Data
            </button>
            {onClearData && (
              <button
                onClick={onClearData}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear & Start Fresh
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}