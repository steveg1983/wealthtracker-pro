/**
 * Data Migration Modal
 * 
 * Allows users to migrate their local data to cloud storage
 * Shows progress and handles errors gracefully
 */

import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { DataMigrationService } from '../services/dataMigrationService';
import { userIdService } from '../services/userIdService';
import { DatabaseIcon, CheckCircleIcon, AlertCircleIcon, LoadingIcon } from './icons';

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function DataMigrationModal({ isOpen, onClose, onComplete }: DataMigrationModalProps) {
  const { userId } = useAuth();
  const [migrationState, setMigrationState] = useState<'idle' | 'migrating' | 'completed' | 'error'>('idle');
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleMigration = async () => {
    if (!userId) {
      setErrorMessage('User not authenticated');
      setMigrationState('error');
      return;
    }

    setMigrationState('migrating');
    setErrorMessage('');

    try {
      // Ensure user exists and get database ID
      const databaseId = await userIdService.ensureUserExists(
        userId,
        'migration@example.com', // Will be updated by user profile
        undefined,
        undefined
      );

      if (!databaseId) {
        setErrorMessage('Failed to initialize user in database');
        setMigrationState('error');
        return;
      }

      const result = await DataMigrationService.migrateToSupabase(userId);
      
      if (result.error && result.error !== 'User already has cloud data') {
        setErrorMessage(result.error);
        setMigrationState('error');
      } else {
        setMigrationStats(result.stats);
        setMigrationState('completed');
        
        // If user already has cloud data, mark migration as complete
        if (result.error === 'User already has cloud data') {
          localStorage.setItem('supabaseMigrationCompleted', 'true');
          localStorage.setItem('supabaseMigrationDate', new Date().toISOString());
        }
        
        // Refresh the page after successful migration
        setTimeout(() => {
          onComplete?.();
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Migration error:', error);
      setErrorMessage('An unexpected error occurred during migration');
      setMigrationState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DatabaseIcon size={24} className="text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Migrate to Cloud Storage
            </h2>
          </div>
          {migrationState === 'idle' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content based on state */}
        {migrationState === 'idle' && (
          <>
            <div className="space-y-4 mb-6">
              <p className="text-gray-600 dark:text-gray-300">
                Ready to upgrade your WealthTracker experience? Migrating to cloud storage enables:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon size={20} className="text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Access your data from any device
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon size={20} className="text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Automatic backups and data protection
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon size={20} className="text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Real-time sync across all your devices
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon size={20} className="text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Share accounts with family members (coming soon)
                  </span>
                </li>
              </ul>
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Your local data will be preserved as a backup until you're confident everything is working in the cloud.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMigration}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Start Migration
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Maybe Later
              </button>
            </div>
          </>
        )}

        {migrationState === 'migrating' && (
          <div className="text-center py-8">
            <LoadingIcon size={48} className="text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Migrating Your Data...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This may take a few moments. Please don't close this window.
            </p>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <LoadingIcon size={16} className="animate-spin" />
                <span>Processing accounts...</span>
              </div>
            </div>
          </div>
        )}

        {migrationState === 'completed' && (
          <div className="text-center py-8">
            <CheckCircleIcon size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Migration Complete!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Your data has been successfully migrated to the cloud.
            </p>
            
            {migrationStats && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Migration Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Accounts:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {migrationStats.accounts.migrated}/{migrationStats.accounts.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Transactions:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {migrationStats.transactions.migrated}/{migrationStats.transactions.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Budgets:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {migrationStats.budgets.migrated}/{migrationStats.budgets.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Goals:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {migrationStats.goals.migrated}/{migrationStats.goals.total}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Refreshing page in 3 seconds...
            </p>
          </div>
        )}

        {migrationState === 'error' && (
          <div className="text-center py-8">
            <AlertCircleIcon size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Migration Failed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {errorMessage || 'An error occurred during migration.'}
            </p>
            
            {errorMessage === 'User already has cloud data' ? (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Good news! Your data is already in the cloud. No migration needed.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Don't worry, your local data is still safe. You can try again later or contact support if the issue persists.
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              {errorMessage !== 'User already has cloud data' && (
                <button
                  onClick={handleMigration}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}